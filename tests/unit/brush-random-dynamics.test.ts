import { describe, expect, it } from 'vitest';
import {
  brushRandomFlowEnabledV1,
  brushRandomOpacityEnabledV1,
  brushRandomResponseCurveV1,
  brushRandomSizeEnabledV1,
  createBaselineBrushPresetV1,
  withBrushRandomFlowEnabledV1,
  withBrushRandomOpacityEnabledV1,
  withBrushRandomResponseCurveV1,
  withBrushRandomSizeEnabledV1,
} from '../../src/domain/brush-schema.js';
import { LINEAR_RESPONSE_CURVE_V1 } from '../../src/domain/response-curve.js';
import {
  BaselineBrushDabBuilderV1,
  deterministicBaselineBrushRandomV1,
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
  Object.freeze({ input: 0.5, output: 0.8 }),
  Object.freeze({ input: 1, output: 1 }),
]);

const TIP_A = Object.freeze([
  0, 0, 0, 0, 0, 0, 0, 255, 0, 0, 0, 0, 255, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
]);
const TIP_B = Object.freeze([
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 255, 255, 255, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
]);

describe('M6A-048 random dynamics', () => {
  it('keeps random mappings opt-in with one shared linear response curve', () => {
    const preset = createBaselineBrushPresetV1({
      id: 'random.mapping',
      name: 'Random Mapping',
      category: 'Test',
      behavior: 'paint',
    });
    expect(brushRandomSizeEnabledV1(preset)).toBe(false);
    expect(brushRandomOpacityEnabledV1(preset)).toBe(false);
    expect(brushRandomFlowEnabledV1(preset)).toBe(false);
    expect(brushRandomResponseCurveV1(preset)).toEqual(LINEAR_RESPONSE_CURVE_V1);
    expect(brushRandomSizeEnabledV1(withBrushRandomSizeEnabledV1(preset, true))).toBe(true);
    expect(brushRandomOpacityEnabledV1(withBrushRandomOpacityEnabledV1(preset, true))).toBe(true);
    expect(brushRandomFlowEnabledV1(withBrushRandomFlowEnabledV1(preset, true))).toBe(true);
    expect(
      brushRandomResponseCurveV1(withBrushRandomResponseCurveV1(preset, CUSTOM_CURVE)),
    ).toEqual(CUSTOM_CURVE);
  });

  it('generates a deterministic per-attempt random sensor from seed and stamp index', () => {
    const sequenceA = Array.from({ length: 6 }, (_, index) =>
      deterministicBaselineBrushRandomV1(123, index),
    );
    const sequenceB = Array.from({ length: 6 }, (_, index) =>
      deterministicBaselineBrushRandomV1(123, index),
    );
    const sequenceC = Array.from({ length: 6 }, (_, index) =>
      deterministicBaselineBrushRandomV1(124, index),
    );
    expect(sequenceA).toEqual(sequenceB);
    expect(sequenceC).not.toEqual(sequenceA);
    expect(sequenceA.every((value) => value >= 0 && value < 1)).toBe(true);
  });

  it('advances the random attempt index even when a taper suppresses the first logical stamp', () => {
    const seed = 77;
    const builder = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      spacingRatio: 0.25,
      minimumStampDistancePx: 1,
      startTaperLengthPx: 5,
      randomSizeEnabled: true,
      randomSeed: seed,
    });
    expect(builder.beginDelta({ documentX: 0, documentY: 0 })).toEqual([]);
    const [dab] = builder.appendDelta([{ documentX: 5, documentY: 0 }]);
    expect(dab?.radius).toBeCloseTo(10 * deterministicBaselineBrushRandomV1(seed, 1), 10);
  });

  it('uses an independent random channel without changing random tip-selection order', () => {
    const baseOptions = {
      sizePx: 20,
      spacingRatio: 0.25,
      minimumStampDistancePx: 1,
      tipShape: 'sampled-image' as const,
      sampledTipAlphas: [TIP_A, TIP_B],
      tipSelectionMode: 'random-per-stamp' as const,
      tipSelectionSeed: 9182,
    };
    const plain = new BaselineBrushDabBuilderV1(baseOptions);
    plain.beginDelta({ documentX: 0, documentY: 0 });
    plain.appendDelta([{ documentX: 15, documentY: 0 }]);
    const randomized = new BaselineBrushDabBuilderV1({
      ...baseOptions,
      randomOpacityEnabled: true,
      randomSeed: 33,
    });
    randomized.beginDelta({ documentX: 0, documentY: 0 });
    randomized.appendDelta([{ documentX: 15, documentY: 0 }]);
    const geometry = (builder: BaselineBrushDabBuilderV1) =>
      builder.dabs().map((dab) => [Number(dab.x.toFixed(6)), Number(dab.y.toFixed(6))]);
    expect(geometry(randomized)).toEqual(geometry(plain));
  });

  it('samples one random response per logical stamp and composes it independently with other dynamics', () => {
    const seed = 51;
    const random = deterministicBaselineBrushRandomV1(seed, 0);
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
      randomSizeEnabled: true,
      randomOpacityEnabled: true,
      randomFlowEnabled: true,
      randomSeed: seed,
    });
    const [dab] = builder.beginDelta({
      documentX: 1,
      documentY: 1,
      pressure: 0.5,
      velocity: 0.5,
      altitudeAngle: Math.PI / 4,
    });
    expect(dab?.radius).toBeCloseTo(1.25 * random, 10);
    expect(dab?.strokeOpacity).toBeCloseTo(0.1 * random, 10);
    expect(dab?.flow).toBeCloseTo(0.075 * random, 10);
  });

  it('keeps forced taper zero authoritative and stores only resolved primitive values', () => {
    const stroke = new CanonicalRasterBrushStrokeV1({
      sizePx: 20,
      startTaperLengthPx: 10,
      sizeTaperMinimumRatio: 0.5,
      opacityTaperMinimumRatio: 0.5,
      forceStartTaper: true,
      randomSizeEnabled: true,
      randomOpacityEnabled: true,
      randomFlowEnabled: true,
      randomSeed: 8,
    });
    expect(stroke.beginConfirmed({ documentX: 0, documentY: 0 })).toEqual([]);
    const [dab] = stroke.appendConfirmed([{ documentX: 10, documentY: 0 }]);
    expect(dab).toBeDefined();
    expect('randomInput' in (dab ?? {})).toBe(false);

    const session = new PaintSessionControllerV1(new FakeRendererDocumentPort());
    expect(session.setBrushRandomSizeEnabled(true)).toBe(true);
    expect(session.setBrushRandomOpacityEnabled(true)).toBe(true);
    expect(session.setBrushRandomFlowEnabled(true)).toBe(true);
    expect(session.setBrushRandomResponseCurve(CUSTOM_CURVE)).toEqual(CUSTOM_CURVE);
    const snapshot = session.snapshot();
    expect(snapshot.brushRandomSizeEnabled).toBe(true);
    expect(snapshot.brushRandomOpacityEnabled).toBe(true);
    expect(snapshot.brushRandomFlowEnabled).toBe(true);
    expect(snapshot.brushRandomResponseCurve).toEqual(CUSTOM_CURVE);
  });
});
