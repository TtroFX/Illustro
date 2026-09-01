import { describe, expect, it } from 'vitest';
import {
  PointerInputArbitrationV1,
  type PointerInputDispositionV1,
} from '../../src/input/input-arbitration.js';
import type {
  PointerInputBatchV1,
  PointerInputEventTypeV1,
  PointerInputSampleV1,
  PointerInputSourceV1,
} from '../../src/input/pointer-input.js';

function sample(
  source: PointerInputSourceV1,
  eventType: PointerInputEventTypeV1,
  overrides: Partial<PointerInputSampleV1> = {},
): PointerInputSampleV1 {
  return Object.freeze({
    schema: 'illustro.pointer-sample/1',
    sequence: 0,
    pointerId: source === 'touch' ? 2 : 1,
    source,
    eventType,
    origin: 'direct',
    isPrimary: true,
    timestampMs: 100,
    clientX: 10,
    clientY: 20,
    surfaceX: 10,
    surfaceY: 20,
    pressure: eventType === 'pointermove' ? 0 : 0.5,
    tangentialPressure: 0,
    tiltX: 0,
    tiltY: 0,
    twist: 0,
    altitudeAngle: null,
    azimuthAngle: null,
    contactWidth: source === 'touch' ? 8 : 1,
    contactHeight: source === 'touch' ? 8 : 1,
    buttons: eventType === 'pointermove' || eventType === 'pointerup' ? 0 : 1,
    button: eventType === 'pointerdown' ? 0 : -1,
    ...overrides,
  });
}

function batch(value: PointerInputSampleV1): PointerInputBatchV1 {
  return Object.freeze({
    schema: 'illustro.pointer-batch/1',
    eventType: value.eventType,
    pointerId: value.pointerId,
    confirmed: Object.freeze([value]),
    predicted: Object.freeze([]),
  });
}

function disposition(
  arbitration: PointerInputArbitrationV1,
  value: PointerInputSampleV1,
): PointerInputDispositionV1 {
  return arbitration.route(batch(value)).disposition;
}

describe('M3 pointer source arbitration and palm rejection foundation', () => {
  it('routes pen and mouse contact to the active tool while hover remains presentation-only', () => {
    const arbitration = new PointerInputArbitrationV1();
    expect(disposition(arbitration, sample('pen', 'pointermove'))).toBe('hover');
    expect(disposition(arbitration, sample('pen', 'pointerdown'))).toBe('tool');
    expect(disposition(arbitration, sample('mouse', 'pointermove'))).toBe('hover');
    expect(disposition(arbitration, sample('mouse', 'pointerdown'))).toBe('tool');
  });

  it('keeps touch in navigation mode by default and does not forward it to the drawing transport', () => {
    const arbitration = new PointerInputArbitrationV1();
    const decision = arbitration.route(batch(sample('touch', 'pointerdown')));
    expect(decision).toMatchObject({
      disposition: 'navigation',
      reason: 'touch-navigation',
      forwardBatch: null,
      cancelToolPointerIds: [],
    });
    expect(arbitration.snapshot().activeTouchContacts).toBe(1);
    arbitration.route(batch(sample('touch', 'pointerup')));
    expect(arbitration.snapshot().activeTouchContacts).toBe(0);
  });

  it('rejects new canvas touch contacts while a pen contact transaction is active', () => {
    const arbitration = new PointerInputArbitrationV1();
    arbitration.route(batch(sample('pen', 'pointerdown', { timestampMs: 100 })));
    const touch = arbitration.route(
      batch(
        sample('touch', 'pointerdown', { timestampMs: 110, contactWidth: 6, contactHeight: 6 }),
      ),
    );
    expect(touch).toMatchObject({
      disposition: 'rejected-palm',
      reason: 'touch-during-pen-contact',
      forwardBatch: null,
    });
    expect(arbitration.snapshot()).toMatchObject({
      activePenContacts: 1,
      rejectedPalmContacts: 1,
    });
    arbitration.route(batch(sample('pen', 'pointerup', { timestampMs: 120 })));
    expect(arbitration.snapshot().activePenContacts).toBe(0);
  });

  it('biases large ambiguous touch toward palm rejection shortly after pen proximity', () => {
    const arbitration = new PointerInputArbitrationV1({ recentPenBiasMs: 500 });
    arbitration.route(batch(sample('pen', 'pointermove', { timestampMs: 100 })));
    const rejected = arbitration.route(
      batch(
        sample('touch', 'pointerdown', {
          pointerId: 5,
          timestampMs: 300,
          contactWidth: 24,
          contactHeight: 20,
        }),
      ),
    );
    expect(rejected).toMatchObject({
      disposition: 'rejected-palm',
      reason: 'touch-recent-pen-large-contact',
    });

    const later = arbitration.route(
      batch(
        sample('touch', 'pointerdown', {
          pointerId: 6,
          timestampMs: 800,
          contactWidth: 24,
          contactHeight: 20,
        }),
      ),
    );
    expect(later.disposition).toBe('navigation');
  });

  it('supports explicit finger drawing without changing the default policy', () => {
    const arbitration = new PointerInputArbitrationV1({ fingerDrawingEnabled: true });
    const decision = arbitration.route(
      batch(sample('touch', 'pointerdown', { timestampMs: 1000 })),
    );
    expect(decision).toMatchObject({
      disposition: 'tool',
      reason: 'touch-finger-drawing',
      cancelToolPointerIds: [],
    });
    expect(decision.forwardBatch).not.toBeNull();
  });

  it('cancels the one-finger tool transaction and promotes both touches to navigation', () => {
    const arbitration = new PointerInputArbitrationV1({ fingerDrawingEnabled: true });
    const first = arbitration.route(
      batch(sample('touch', 'pointerdown', { pointerId: 2, timestampMs: 1000 })),
    );
    expect(first).toMatchObject({ disposition: 'tool', reason: 'touch-finger-drawing' });

    const second = arbitration.route(
      batch(sample('touch', 'pointerdown', { pointerId: 3, timestampMs: 1010 })),
    );
    expect(second).toMatchObject({
      disposition: 'navigation',
      reason: 'touch-multitouch-navigation',
      forwardBatch: null,
      cancelToolPointerIds: [2],
    });

    const firstMove = arbitration.route(
      batch(
        sample('touch', 'pointermove', {
          pointerId: 2,
          timestampMs: 1020,
          buttons: 1,
          pressure: 0.5,
        }),
      ),
    );
    expect(firstMove).toMatchObject({
      disposition: 'navigation',
      reason: 'touch-multitouch-navigation',
      forwardBatch: null,
    });
  });

  it('keeps a rejected touch rejected for its complete pointer transaction', () => {
    const arbitration = new PointerInputArbitrationV1();
    arbitration.route(batch(sample('pen', 'pointerdown', { timestampMs: 100 })));
    const down = sample('touch', 'pointerdown', { pointerId: 9, timestampMs: 110 });
    expect(arbitration.route(batch(down)).disposition).toBe('rejected-palm');
    arbitration.route(batch(sample('pen', 'pointerup', { timestampMs: 120 })));
    const move = sample('touch', 'pointermove', {
      pointerId: 9,
      timestampMs: 130,
      buttons: 1,
      pressure: 0.5,
    });
    expect(arbitration.route(batch(move)).disposition).toBe('rejected-palm');
    const up = arbitration.route(
      batch(sample('touch', 'pointerup', { pointerId: 9, timestampMs: 140 })),
    );
    expect(up.disposition).toBe('rejected-palm');
    expect(arbitration.snapshot().activeTouchContacts).toBe(0);
  });
});
