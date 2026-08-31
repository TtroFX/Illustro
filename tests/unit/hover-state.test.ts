import { describe, expect, it } from 'vitest';
import { PointerHoverTrackerV1 } from '../../src/input/hover-state.js';
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
    pointerId: 1,
    source,
    eventType,
    origin: 'direct',
    isPrimary: true,
    timestampMs: 10,
    clientX: 40,
    clientY: 50,
    surfaceX: 30,
    surfaceY: 35,
    pressure: 0,
    tangentialPressure: 0,
    tiltX: 20,
    tiltY: -10,
    twist: 45,
    altitudeAngle: 0.6,
    azimuthAngle: 1.2,
    contactWidth: 1,
    contactHeight: 1,
    buttons: 0,
    button: -1,
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

describe('M3 hover data foundation', () => {
  it('tracks pen hover position and rich pen axes without treating it as contact', () => {
    const hover = new PointerHoverTrackerV1();
    const snapshot = hover.ingest(batch(sample('pen', 'pointermove')));
    expect(snapshot).toMatchObject({
      schema: 'illustro.pointer-hover-state/1',
      active: true,
      source: 'pen',
      pointerId: 1,
      surfaceX: 30,
      surfaceY: 35,
      pressure: 0,
      tiltX: 20,
      tiltY: -10,
      twist: 45,
      altitudeAngle: 0.6,
      azimuthAngle: 1.2,
      timestampMs: 10,
    });
  });

  it('supports mouse hover and clears hover when contact starts', () => {
    const hover = new PointerHoverTrackerV1();
    expect(hover.ingest(batch(sample('mouse', 'pointermove'))).active).toBe(true);
    const contact = sample('mouse', 'pointerdown', { buttons: 1, pressure: 0.5 });
    expect(hover.ingest(batch(contact)).active).toBe(false);
  });

  it('ignores touch movement as hover presentation data', () => {
    const hover = new PointerHoverTrackerV1();
    const snapshot = hover.ingest(batch(sample('touch', 'pointermove')));
    expect(snapshot.active).toBe(false);
  });

  it('clears an active hover on terminal events for the same pointer', () => {
    const hover = new PointerHoverTrackerV1();
    hover.ingest(batch(sample('pen', 'pointermove', { pointerId: 7 })));
    expect(hover.snapshot().active).toBe(true);
    hover.ingest(batch(sample('pen', 'pointercancel', { pointerId: 7 })));
    expect(hover.snapshot().active).toBe(false);
  });
});
