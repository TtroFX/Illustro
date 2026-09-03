import { describe, expect, it } from 'vitest';
import {
  brushPressureResponseCurveV1,
  createBaselineBrushPresetV1,
  withBrushPressureResponseCurveV1,
} from '../../src/domain/brush-schema.js';
import { LINEAR_RESPONSE_CURVE_V1 } from '../../src/domain/response-curve.js';
import { BaselineBrushDabBuilderV1 } from '../../src/gpu/baseline-brush.js';
import { CanonicalRasterBrushStrokeV1 } from '../../src/app/canonical-raster-brush.js';
import { PaintSessionControllerV1 } from '../../src/app/paint-session-controller.js';

class FakeRendererDocumentPort {
  async configureDocument(): Promise<void> {}
  async restoreBaselineStrokes(): Promise<void> {}
  async applyBaselineTilePatches(): Promise<void> {}
}

const CUSTOM_CURVE = Object.freeze([
  Object.freeze({ input: 0, output: 0 }),
  Object.freeze({ input: 0.5, output: 0.8 }),
  Object.freeze({ input: 1, output: 1 }),
]);

describe('M6A-044 pressure response curve', () => {
  it('uses linear identity by default and persists only non-linear preset data', () => {
    const preset = createBaselineBrushPresetV1({
      id: 'pressure.curve',
      name: 'Pressure Curve',
      category: 'Test',
      behavior: 'paint',
    });
    expect(brushPressureResponseCurveV1(preset)).toEqual(LINEAR_RESPONSE_CURVE_V1);
    const custom = withBrushPressureResponseCurveV1(preset, CUSTOM_CURVE);
    expect(brushPressureResponseCurveV1(custom)).toEqual(CUSTOM_CURVE);
    expect(custom.dynamics.pressureResponseCurve).toBeDefined();
    expect(
      withBrushPressureResponseCurveV1(custom, LINEAR_RESPONSE_CURVE_V1).dynamics
        .pressureResponseCurve,
    ).toBeUndefined();
  });

  it('resolves one shared curve output before independent size, opacity and flow mappings', () => {
    const builder = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      opacity: 0.75,
      flow: 0.5,
      pressureSizeEnabled: true,
      pressureOpacityEnabled: true,
      pressureFlowEnabled: true,
      pressureResponseCurve: CUSTOM_CURVE,
    });
    const [dab] = builder.beginDelta({ documentX: 2, documentY: 2, pressure: 0.5 });
    expect(dab?.radius).toBeCloseTo(8, 10);
    expect(dab?.strokeOpacity).toBeCloseTo(0.6, 10);
    expect(dab?.flow).toBeCloseTo(0.4, 10);
  });

  it('does not change painting when pressure mappings are disabled', () => {
    const builder = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      opacity: 0.75,
      flow: 0.5,
      pressureResponseCurve: CUSTOM_CURVE,
    });
    const [dab] = builder.beginDelta({ documentX: 2, documentY: 2, pressure: 0.5 });
    expect(dab?.radius).toBe(10);
    expect(dab?.strokeOpacity).toBe(0.75);
    expect(dab?.flow).toBe(0.5);
  });

  it('forwards the curve through canonical/runtime state without a new primitive schema', () => {
    const stroke = new CanonicalRasterBrushStrokeV1({
      sizePx: 20,
      pressureSizeEnabled: true,
      pressureResponseCurve: CUSTOM_CURVE,
    });
    const [dab] = stroke.beginConfirmed({ documentX: 1, documentY: 1, pressure: 0.5 });
    expect(dab?.radius).toBeCloseTo(8, 10);

    const session = new PaintSessionControllerV1(new FakeRendererDocumentPort());
    expect(session.setBrushPressureResponseCurve(CUSTOM_CURVE)).toEqual(CUSTOM_CURVE);
    expect(session.snapshot().brushPressureResponseCurve).toEqual(CUSTOM_CURVE);
  });
});
