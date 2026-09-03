import { describe, expect, it } from 'vitest';
import {
  brushHueJitterV1,
  brushSaturationJitterV1,
  brushValueJitterV1,
  createBaselineBrushPresetV1,
  withBrushHueJitterV1,
  withBrushSaturationJitterV1,
  withBrushValueJitterV1,
} from '../../src/domain/brush-schema.js';
import { PaintSessionControllerV1 } from '../../src/app/paint-session-controller.js';
import {
  applyBaselineBrushColorJitterV1,
  BaselineBrushDabBuilderV1,
  deterministicBaselineBrushColorJitterV1,
} from '../../src/gpu/baseline-brush.js';

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

const baseColor = [0.8, 0.3, 0.15] as const;

describe('M6A-056 color jitter', () => {
  it('stores independent HSV jitter amounts with exact zero defaults', () => {
    const preset = createBaselineBrushPresetV1({
      id: 'test.color-jitter',
      name: 'Color Jitter',
      category: 'Test',
      behavior: 'paint',
    });
    expect([
      brushHueJitterV1(preset),
      brushSaturationJitterV1(preset),
      brushValueJitterV1(preset),
    ]).toEqual([0, 0, 0]);
    const changed = withBrushValueJitterV1(
      withBrushSaturationJitterV1(withBrushHueJitterV1(preset, 0.4), 0.3),
      0.2,
    );
    expect([
      brushHueJitterV1(changed),
      brushSaturationJitterV1(changed),
      brushValueJitterV1(changed),
    ]).toEqual([0.4, 0.3, 0.2]);
    expect(withBrushHueJitterV1(changed, 0).jitter.hue).toBeUndefined();
    expect(() => withBrushSaturationJitterV1(preset, 1.01)).toThrow(RangeError);
  });

  it('keeps all-zero color jitter as an exact RGB identity', () => {
    const baseline = new BaselineBrushDabBuilderV1({
      color: baseColor,
      sizePx: 20,
      spacingRatio: 1,
      randomSeed: 7,
    });
    const explicitZero = new BaselineBrushDabBuilderV1({
      color: baseColor,
      sizePx: 20,
      spacingRatio: 1,
      hueJitter: 0,
      saturationJitter: 0,
      valueJitter: 0,
      randomSeed: 7,
    });
    for (const brush of [baseline, explicitZero]) {
      brush.begin({ documentX: 0, documentY: 0 });
      brush.append([{ documentX: 20, documentY: 0 }]);
      brush.finish();
    }
    expect(explicitZero.dabs()).toEqual(baseline.dabs());
  });

  it('resolves deterministic HSV variation into the existing primitive RGB field', () => {
    const seed = 0x1234abcd;
    const random = deterministicBaselineBrushColorJitterV1(seed, 0);
    const expected = applyBaselineBrushColorJitterV1(baseColor, random, 0.5, 0.4, 0.3);
    const brush = new BaselineBrushDabBuilderV1({
      color: baseColor,
      hueJitter: 0.5,
      saturationJitter: 0.4,
      valueJitter: 0.3,
      randomSeed: seed,
    });
    const [dab] = brush.beginDelta({ documentX: 10, documentY: 12 });
    expect(dab?.color).toEqual(expected);
    expect(dab?.color?.every((component) => component >= 0 && component <= 1)).toBe(true);
    expect('hueJitter' in (dab ?? {})).toBe(false);
    expect('saturationJitter' in (dab ?? {})).toBe(false);
    expect('valueJitter' in (dab ?? {})).toBe(false);
  });

  it('shares one resolved color across sampled-tip micro dabs', () => {
    const brush = new BaselineBrushDabBuilderV1({
      color: baseColor,
      tipShape: 'sampled-image',
      hueJitter: 0.7,
      saturationJitter: 0.5,
      valueJitter: 0.4,
      randomSeed: 0x2468ace0,
    });
    const firstStamp = brush.beginDelta({ documentX: 20, documentY: 20 });
    expect(firstStamp.length).toBeGreaterThan(1);
    expect(
      firstStamp.every((dab) => JSON.stringify(dab.color) === JSON.stringify(firstStamp[0]?.color)),
    ).toBe(true);
  });

  it('advances the color-jitter attempt index even when taper suppresses a logical stamp', () => {
    const seed = 0x89abcdef;
    const reference = new BaselineBrushDabBuilderV1({
      color: baseColor,
      sizePx: 10,
      spacingRatio: 1,
      hueJitter: 0.8,
      saturationJitter: 0.3,
      valueJitter: 0.2,
      randomSeed: seed,
    });
    reference.begin({ documentX: 0, documentY: 0 });
    reference.append([{ documentX: 10, documentY: 0 }]);
    const suppressed = new BaselineBrushDabBuilderV1({
      color: baseColor,
      sizePx: 10,
      spacingRatio: 1,
      startTaperLengthPx: 10,
      hueJitter: 0.8,
      saturationJitter: 0.3,
      valueJitter: 0.2,
      randomSeed: seed,
    });
    suppressed.begin({ documentX: 0, documentY: 0 });
    suppressed.append([{ documentX: 10, documentY: 0 }]);
    expect(suppressed.dabs()[0]?.color).toEqual(reference.dabs()[1]?.color);
  });

  it('keeps its color random sequence independent from geometry and density random channels', () => {
    const seed = 0x0badc0de;
    const plain = new BaselineBrushDabBuilderV1({
      color: baseColor,
      sizePx: 20,
      spacingRatio: 1,
      hueJitter: 0.5,
      saturationJitter: 0.5,
      valueJitter: 0.5,
      randomSeed: seed,
    });
    const combined = new BaselineBrushDabBuilderV1({
      color: baseColor,
      sizePx: 20,
      spacingRatio: 1,
      hueJitter: 0.5,
      saturationJitter: 0.5,
      valueJitter: 0.5,
      sizeJitter: 0.5,
      opacityJitter: 0.5,
      rotationJitter: 0.5,
      positionJitter: 0.5,
      densityJitter: 0.5,
      randomFlowEnabled: true,
      randomSeed: seed,
    });
    for (const brush of [plain, combined]) {
      brush.begin({ documentX: 0, documentY: 0 });
      brush.append([{ documentX: 20, documentY: 0 }]);
      brush.finish();
    }
    expect(combined.dabs().map((dab) => dab.color)).toEqual(plain.dabs().map((dab) => dab.color));
  });

  it('reuses the resolved color when reconciling the mutable end tail', () => {
    const brush = new BaselineBrushDabBuilderV1({
      color: baseColor,
      sizePx: 10,
      spacingRatio: 1,
      endTaperLengthPx: 10,
      sizeTaperMinimumRatio: 1,
      opacityTaperMinimumRatio: 1,
      hueJitter: 0.6,
      saturationJitter: 0.4,
      valueJitter: 0.3,
      randomSeed: 0xfeed1234,
    });
    brush.begin({ documentX: 0, documentY: 0 });
    brush.append([
      { documentX: 10, documentY: 0 },
      { documentX: 20, documentY: 0 },
    ]);
    const beforeFinish = brush.dabs().map((dab) => dab.color);
    brush.finish();
    expect(brush.dabs().map((dab) => dab.color)).toEqual(beforeFinish);
  });

  it('captures runtime HSV jitter without adding color-jitter primitive fields', () => {
    const session = new PaintSessionControllerV1(new FakeRendererDocumentPort());
    expect(session.setBrushColorJitter(0.25, 0.35, 0.45)).toEqual({
      hue: 0.25,
      saturation: 0.35,
      value: 0.45,
    });
    expect(session.snapshot().brushHueJitter).toBe(0.25);
    expect(session.snapshot().brushSaturationJitter).toBe(0.35);
    expect(session.snapshot().brushValueJitter).toBe(0.45);
  });
});
