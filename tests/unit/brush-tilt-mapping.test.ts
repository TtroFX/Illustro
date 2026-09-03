import { describe, expect, it } from 'vitest';
import {
  brushTiltFlowEnabledV1,
  brushTiltOpacityEnabledV1,
  brushTiltResponseCurveV1,
  brushTiltSizeEnabledV1,
  createBaselineBrushPresetV1,
  withBrushTiltFlowEnabledV1,
  withBrushTiltOpacityEnabledV1,
  withBrushTiltResponseCurveV1,
  withBrushTiltSizeEnabledV1,
} from '../../src/domain/brush-schema.js';
import { LINEAR_RESPONSE_CURVE_V1 } from '../../src/domain/response-curve.js';
import {
  BaselineBrushDabBuilderV1,
  baselineBrushSampleTiltUprightnessV1,
} from '../../src/gpu/baseline-brush.js';
import { CanonicalRasterBrushStrokeV1 } from '../../src/app/canonical-raster-brush.js';
import { PaintSessionControllerV1 } from '../../src/app/paint-session-controller.js';

class FakeRendererDocumentPort {
  async configureDocument(): Promise<void> {}
  async restoreBaselineStrokes(): Promise<void> {}
  async applyBaselineTilePatches(): Promise<void> {}
  async restoreBaselineCanonicalTiles(): Promise<void> {}
  async exportBaselineCanonicalTiles(): Promise<readonly never[]> {
    return [];
  }
  async exportBaselineCompositeTiles(): Promise<readonly never[]> {
    return [];
  }
}

const CUSTOM_CURVE = Object.freeze([
  Object.freeze({ input: 0, output: 0 }),
  Object.freeze({ input: 0.5, output: 0.75 }),
  Object.freeze({ input: 1, output: 1 }),
]);

describe('M6A-045 tilt mapping', () => {
  it('is opt-in in preset data and keeps linear upright-neutral defaults', () => {
    const preset = createBaselineBrushPresetV1({
      id: 'tilt.mapping',
      name: 'Tilt Mapping',
      category: 'Test',
      behavior: 'paint',
    });
    expect(brushTiltSizeEnabledV1(preset)).toBe(false);
    expect(brushTiltOpacityEnabledV1(preset)).toBe(false);
    expect(brushTiltFlowEnabledV1(preset)).toBe(false);
    expect(brushTiltResponseCurveV1(preset)).toEqual(LINEAR_RESPONSE_CURVE_V1);
    expect(brushTiltSizeEnabledV1(withBrushTiltSizeEnabledV1(preset, true))).toBe(true);
    expect(brushTiltOpacityEnabledV1(withBrushTiltOpacityEnabledV1(preset, true))).toBe(true);
    expect(brushTiltFlowEnabledV1(withBrushTiltFlowEnabledV1(preset, true))).toBe(true);
    expect(brushTiltResponseCurveV1(withBrushTiltResponseCurveV1(preset, CUSTOM_CURVE))).toEqual(
      CUSTOM_CURVE,
    );
  });

  it('prefers altitudeAngle and derives the same uprightness domain from tiltX/tiltY', () => {
    expect(
      baselineBrushSampleTiltUprightnessV1({
        documentX: 0,
        documentY: 0,
        altitudeAngle: Math.PI / 4,
      }),
    ).toBeCloseTo(0.5, 10);
    expect(
      baselineBrushSampleTiltUprightnessV1({ documentX: 0, documentY: 0, tiltX: 60, tiltY: 0 }),
    ).toBeCloseTo(1 / 3, 10);
    expect(
      baselineBrushSampleTiltUprightnessV1({ documentX: 0, documentY: 0, tiltX: 0, tiltY: 0 }),
    ).toBe(1);
  });

  it('linearly interpolates tilt at logical stamps and maps one shared response independently', () => {
    const builder = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      opacity: 0.8,
      flow: 0.6,
      spacingRatio: 0.25,
      minimumStampDistancePx: 1,
      tiltSizeEnabled: true,
      tiltOpacityEnabled: true,
      tiltFlowEnabled: true,
    });
    builder.beginDelta({ documentX: 0, documentY: 0, altitudeAngle: Math.PI / 2 });
    builder.appendDelta([{ documentX: 10, documentY: 0, altitudeAngle: 0 }]);
    const dabs = builder.dabs();
    expect(dabs.map((dab) => dab.x)).toEqual([0, 5]);
    expect(dabs[0]?.radius).toBe(10);
    expect(dabs[1]?.radius).toBeCloseTo(5, 10);
    expect(dabs[1]?.strokeOpacity).toBeCloseTo(0.4, 10);
    expect(dabs[1]?.flow).toBeCloseTo(0.3, 10);
  });

  it('keeps pressure and tilt independent while sharing resolved primitive fields', () => {
    const builder = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      opacity: 0.8,
      flow: 0.6,
      pressureSizeEnabled: true,
      pressureOpacityEnabled: true,
      pressureFlowEnabled: true,
      tiltSizeEnabled: true,
      tiltOpacityEnabled: true,
      tiltFlowEnabled: true,
    });
    const [dab] = builder.beginDelta({
      documentX: 1,
      documentY: 1,
      pressure: 0.5,
      altitudeAngle: Math.PI / 4,
    });
    expect(dab?.radius).toBeCloseTo(2.5, 10);
    expect(dab?.strokeOpacity).toBeCloseTo(0.2, 10);
    expect(dab?.flow).toBeCloseTo(0.15, 10);
  });

  it('forwards tilt through canonical/runtime state and keeps mouse-style zero tilt neutral', () => {
    const stroke = new CanonicalRasterBrushStrokeV1({ sizePx: 20, tiltSizeEnabled: true });
    const [dab] = stroke.beginConfirmed({ documentX: 1, documentY: 1, tiltX: 0, tiltY: 0 });
    expect(dab?.radius).toBe(10);

    const session = new PaintSessionControllerV1(new FakeRendererDocumentPort());
    expect(session.setBrushTiltSizeEnabled(true)).toBe(true);
    expect(session.setBrushTiltOpacityEnabled(true)).toBe(true);
    expect(session.setBrushTiltFlowEnabled(true)).toBe(true);
    expect(session.setBrushTiltResponseCurve(CUSTOM_CURVE)).toEqual(CUSTOM_CURVE);
    const snapshot = session.snapshot();
    expect(snapshot.brushTiltSizeEnabled).toBe(true);
    expect(snapshot.brushTiltOpacityEnabled).toBe(true);
    expect(snapshot.brushTiltFlowEnabled).toBe(true);
    expect(snapshot.brushTiltResponseCurve).toEqual(CUSTOM_CURVE);
  });
});
