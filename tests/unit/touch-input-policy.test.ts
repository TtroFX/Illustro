import { describe, expect, it } from 'vitest';
import {
  createTouchInputPolicySnapshotV1,
  parseTouchInputPolicyV1,
  serializeTouchInputPolicyV1,
} from '../../src/app/touch-input-policy-controller.js';

describe('M6A-069 touch input policy persistence', () => {
  it('defaults to finger drawing with zero position correction', () => {
    expect(createTouchInputPolicySnapshotV1()).toEqual({
      schema: 'illustro.touch-input-policy/1',
      fingerDrawingEnabled: true,
      offsetXCssPx: 0,
      offsetYCssPx: 0,
    });
  });

  it('round-trips finite CSS-pixel correction settings', () => {
    const state = createTouchInputPolicySnapshotV1({
      fingerDrawingEnabled: false,
      offsetXCssPx: -18,
      offsetYCssPx: 24,
    });
    expect(parseTouchInputPolicyV1(serializeTouchInputPolicyV1(state))).toEqual(state);
  });

  it('rejects correction outside the bounded application-side range', () => {
    expect(() => createTouchInputPolicySnapshotV1({ offsetXCssPx: 257 })).toThrow(RangeError);
  });
});
