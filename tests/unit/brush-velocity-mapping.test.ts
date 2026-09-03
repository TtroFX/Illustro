import { describe, expect, it } from 'vitest';
import {
  brushVelocityFlowEnabledV1,
  brushVelocityMaximumPxPerSecondV1,
  brushVelocityOpacityEnabledV1,
  brushVelocityResponseCurveV1,
  brushVelocitySizeEnabledV1,
  createBaselineBrushPresetV1,
  withBrushVelocityFlowEnabledV1,
  withBrushVelocityMaximumPxPerSecondV1,
  withBrushVelocityOpacityEnabledV1,
  withBrushVelocityResponseCurveV1,
  withBrushVelocitySizeEnabledV1,
} from '../../src/domain/brush-schema.js';
import { LINEAR_RESPONSE_CURVE_V1 } from '../../src/domain/response-curve.js';
import { BaselineBrushDabBuilderV1 } from '../../src/gpu/baseline-brush.js';
import { CanonicalRasterBrushStrokeV1 } from '../../src/app/canonical-raster-brush.js';
import {
  normalizedPaintVelocityV1,
  PaintSessionControllerV1,
} from '../../src/app/paint-session-controller.js';

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

describe('M6A-047 velocity mapping', () => {
  it('keeps velocity mappings opt-in with a deterministic 2000 document px/s default', () => {
    const preset = createBaselineBrushPresetV1({
      id: 'velocity.mapping',
      name: 'Velocity Mapping',
      category: 'Test',
      behavior: 'paint',
    });
    expect(brushVelocitySizeEnabledV1(preset)).toBe(false);
    expect(brushVelocityOpacityEnabledV1(preset)).toBe(false);
    expect(brushVelocityFlowEnabledV1(preset)).toBe(false);
    expect(brushVelocityResponseCurveV1(preset)).toEqual(LINEAR_RESPONSE_CURVE_V1);
    expect(brushVelocityMaximumPxPerSecondV1(preset)).toBe(2000);
    expect(brushVelocitySizeEnabledV1(withBrushVelocitySizeEnabledV1(preset, true))).toBe(true);
    expect(brushVelocityOpacityEnabledV1(withBrushVelocityOpacityEnabledV1(preset, true))).toBe(
      true,
    );
    expect(brushVelocityFlowEnabledV1(withBrushVelocityFlowEnabledV1(preset, true))).toBe(true);
    expect(
      brushVelocityResponseCurveV1(withBrushVelocityResponseCurveV1(preset, CUSTOM_CURVE)),
    ).toEqual(CUSTOM_CURVE);
    expect(
      brushVelocityMaximumPxPerSecondV1(withBrushVelocityMaximumPxPerSecondV1(preset, 4000)),
    ).toBe(4000);
  });

  it('derives document-space velocity only from confirmed sample distance and timestamps', () => {
    const first = { documentX: 0, documentY: 0, timestampMs: 100 };
    const second = { documentX: 10, documentY: 0, timestampMs: 110 };
    expect(normalizedPaintVelocityV1(null, first, 0, 2000)).toBe(0);
    expect(normalizedPaintVelocityV1(first, second, 0, 2000)).toBeCloseTo(0.5, 10);
    const duplicateTime = { documentX: 30, documentY: 0, timestampMs: 110 };
    expect(normalizedPaintVelocityV1(second, duplicateTime, 0.5, 2000)).toBe(0.5);
  });

  it('interpolates velocity at logical stamp positions before applying one shared response', () => {
    const builder = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      opacity: 0.8,
      flow: 0.6,
      spacingRatio: 0.25,
      minimumStampDistancePx: 1,
      velocitySizeEnabled: true,
      velocityOpacityEnabled: true,
      velocityFlowEnabled: true,
    });
    builder.beginDelta({ documentX: 0, documentY: 0, velocity: 0.25 });
    builder.appendDelta([{ documentX: 10, documentY: 0, velocity: 0.75 }]);
    const dabs = builder.dabs();
    expect(dabs.map((dab) => dab.x)).toEqual([0, 5, 10]);
    expect(dabs[0]?.radius).toBeCloseTo(2.5, 10);
    expect(dabs[1]?.radius).toBeCloseTo(5, 10);
    expect(dabs[2]?.radius).toBeCloseTo(7.5, 10);
    expect(dabs[1]?.strokeOpacity).toBeCloseTo(0.4, 10);
    expect(dabs[1]?.flow).toBeCloseTo(0.3, 10);
  });

  it('keeps velocity independent from pressure and tilt while resolving the same primitive fields', () => {
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
      velocitySizeEnabled: true,
      velocityOpacityEnabled: true,
      velocityFlowEnabled: true,
    });
    const [dab] = builder.beginDelta({
      documentX: 1,
      documentY: 1,
      pressure: 0.5,
      velocity: 0.5,
      altitudeAngle: Math.PI / 4,
    });
    expect(dab?.radius).toBeCloseTo(1.25, 10);
    expect(dab?.strokeOpacity).toBeCloseTo(0.1, 10);
    expect(dab?.flow).toBeCloseTo(0.075, 10);
  });

  it('forwards velocity through canonical and runtime state without adding a new dab field', () => {
    const stroke = new CanonicalRasterBrushStrokeV1({ sizePx: 20, velocitySizeEnabled: true });
    const [dab] = stroke.beginConfirmed({ documentX: 1, documentY: 1, velocity: 0.5 });
    expect(dab?.radius).toBe(5);
    expect('velocity' in (dab ?? {})).toBe(false);

    const session = new PaintSessionControllerV1(new FakeRendererDocumentPort());
    expect(session.setBrushVelocitySizeEnabled(true)).toBe(true);
    expect(session.setBrushVelocityOpacityEnabled(true)).toBe(true);
    expect(session.setBrushVelocityFlowEnabled(true)).toBe(true);
    expect(session.setBrushVelocityResponseCurve(CUSTOM_CURVE)).toEqual(CUSTOM_CURVE);
    expect(session.setBrushVelocityMaximumPxPerSecond(4000)).toBe(4000);
    const snapshot = session.snapshot();
    expect(snapshot.brushVelocitySizeEnabled).toBe(true);
    expect(snapshot.brushVelocityOpacityEnabled).toBe(true);
    expect(snapshot.brushVelocityFlowEnabled).toBe(true);
    expect(snapshot.brushVelocityResponseCurve).toEqual(CUSTOM_CURVE);
    expect(snapshot.brushVelocityMaximumPxPerSecond).toBe(4000);
  });
});
