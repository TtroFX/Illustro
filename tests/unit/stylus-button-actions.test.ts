import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PRIMARY_STYLUS_BARREL_COMMAND_ID_V1,
  StylusButtonStateRouterV1,
} from '../../src/input/stylus-button-actions.js';
import {
  createStylusButtonSettingsSnapshotV1,
  parseStylusButtonSettingsV1,
  serializeStylusButtonSettingsV1,
} from '../../src/app/stylus-button-action-controller.js';
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
    schema: 'illustro.pointer-sample/1' as const,
    sequence: 0,
    pointerId: 4,
    source,
    eventType,
    origin: 'direct' as const,
    isPrimary: true,
    timestampMs: 100,
    clientX: 10,
    clientY: 20,
    surfaceX: 10,
    surfaceY: 20,
    pressure: 0.5,
    tangentialPressure: 0,
    tiltX: 0,
    tiltY: 0,
    twist: 0,
    altitudeAngle: null,
    azimuthAngle: null,
    contactWidth: 1,
    contactHeight: 1,
    buttons: 1,
    button: -1,
    ...overrides,
  });
}

function batch(value: PointerInputSampleV1): PointerInputBatchV1 {
  return Object.freeze({
    schema: 'illustro.pointer-batch/1' as const,
    eventType: value.eventType,
    pointerId: value.pointerId,
    confirmed: Object.freeze([value]),
    predicted: Object.freeze([]),
  });
}

describe('M6A-070 stylus-button action plumbing', () => {
  it('detects primary barrel state transitions from the Pointer Events buttons bitmask', () => {
    const router = new StylusButtonStateRouterV1();
    expect(router.route(batch(sample('pen', 'pointerdown', { buttons: 1, button: 0 })))).toEqual(
      [],
    );
    expect(
      router.route(batch(sample('pen', 'pointermove', { buttons: 3, button: 2 }))),
    ).toMatchObject([{ pointerId: 4, slot: 'barrel-primary', phase: 'pressed' }]);
    expect(router.route(batch(sample('pen', 'pointermove', { buttons: 3, button: -1 })))).toEqual(
      [],
    );
    expect(
      router.route(batch(sample('pen', 'pointermove', { buttons: 1, button: 2 }))),
    ).toMatchObject([{ pointerId: 4, slot: 'barrel-primary', phase: 'released' }]);
  });

  it('ignores non-pen secondary-button state and predicted samples', () => {
    const router = new StylusButtonStateRouterV1();
    expect(router.route(batch(sample('mouse', 'pointerdown', { buttons: 2, button: 2 })))).toEqual(
      [],
    );
    const confirmed = sample('pen', 'pointermove', { buttons: 1 });
    const predicted = sample('pen', 'pointermove', { origin: 'predicted', buttons: 3, button: 2 });
    expect(
      router.route(
        Object.freeze({
          schema: 'illustro.pointer-batch/1' as const,
          eventType: 'pointermove' as const,
          pointerId: 4,
          confirmed: Object.freeze([confirmed]),
          predicted: Object.freeze([predicted]),
        }),
      ),
    ).toEqual([]);
  });

  it('forces a release on terminal/cancel or focus-loss cleanup', () => {
    const router = new StylusButtonStateRouterV1();
    router.route(batch(sample('pen', 'pointermove', { pointerId: 9, buttons: 2, button: 2 })));
    expect(router.releaseAll()).toMatchObject([
      { pointerId: 9, slot: 'barrel-primary', phase: 'released' },
    ]);
    expect(router.snapshot().primaryBarrelHeldPointers).toBe(0);
  });

  it('defaults the first barrel to temporary eyedropper and persists an explicit unbound state', () => {
    const defaults = createStylusButtonSettingsSnapshotV1();
    expect(defaults.primaryBarrelBinding?.commandId).toBe(
      DEFAULT_PRIMARY_STYLUS_BARREL_COMMAND_ID_V1,
    );
    const unbound = createStylusButtonSettingsSnapshotV1({ primaryBarrelBinding: null });
    expect(parseStylusButtonSettingsV1(serializeStylusButtonSettingsV1(unbound))).toEqual(unbound);
  });
});
