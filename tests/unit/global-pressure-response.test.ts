import { describe, expect, it } from 'vitest';
import {
  brushPressureResponseCurveOverrideV1,
  createBaselineBrushPresetV1,
  resolveBrushPressureResponseCurveV1,
  withBrushPressureResponseCurveV1,
  withoutBrushPressureResponseCurveOverrideV1,
} from '../../src/domain/brush-schema.js';
import {
  createGlobalPressureResponseSnapshotV1,
  parseGlobalPressureResponseV1,
  serializeGlobalPressureResponseV1,
} from '../../src/app/global-pressure-response-controller.js';
import { LINEAR_RESPONSE_CURVE_V1 } from '../../src/domain/response-curve.js';

const SOFT_CURVE = Object.freeze([
  Object.freeze({ input: 0, output: 0 }),
  Object.freeze({ input: 0.35, output: 0.6 }),
  Object.freeze({ input: 1, output: 1 }),
]);

function preset() {
  return createBaselineBrushPresetV1({
    id: 'global.pressure.test',
    name: 'Global Pressure Test',
    category: 'Test',
    behavior: 'paint',
  });
}

describe('M6A-068 global/default pressure response controls', () => {
  it('inherits the global curve only when a brush has no explicit override', () => {
    const inherited = preset();
    expect(brushPressureResponseCurveOverrideV1(inherited)).toBeNull();
    expect(resolveBrushPressureResponseCurveV1(inherited, SOFT_CURVE)).toEqual(SOFT_CURVE);

    const explicitLinear = withBrushPressureResponseCurveV1(inherited, LINEAR_RESPONSE_CURVE_V1);
    expect(brushPressureResponseCurveOverrideV1(explicitLinear)).toEqual(LINEAR_RESPONSE_CURVE_V1);
    expect(resolveBrushPressureResponseCurveV1(explicitLinear, SOFT_CURVE)).toEqual(
      LINEAR_RESPONSE_CURVE_V1,
    );
  });

  it('returns to global inheritance only through explicit override clearing', () => {
    const overridden = withBrushPressureResponseCurveV1(preset(), SOFT_CURVE);
    const cleared = withoutBrushPressureResponseCurveOverrideV1(overridden);
    expect(brushPressureResponseCurveOverrideV1(cleared)).toBeNull();
    expect(resolveBrushPressureResponseCurveV1(cleared, SOFT_CURVE)).toEqual(SOFT_CURVE);
  });

  it('persists one normalized application-level default curve independently from presets', () => {
    const state = createGlobalPressureResponseSnapshotV1(SOFT_CURVE);
    expect(parseGlobalPressureResponseV1(serializeGlobalPressureResponseV1(state))).toEqual(state);
    expect(createGlobalPressureResponseSnapshotV1().curve).toEqual(LINEAR_RESPONSE_CURVE_V1);
  });
});
