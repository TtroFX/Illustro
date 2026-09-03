import { describe, expect, it } from 'vitest';
import {
  brushDensityJitterV1,
  createBaselineBrushPresetV1,
  withBrushDensityJitterV1,
} from '../../src/domain/brush-schema.js';
import { PaintSessionControllerV1 } from '../../src/app/paint-session-controller.js';
import {
  BaselineBrushDabBuilderV1,
  deterministicBaselineBrushDensityJitterV1,
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

describe('M6A-055 density jitter', () => {
  it('stores normalized density jitter with an exact zero default', () => {
    const preset = createBaselineBrushPresetV1({
      id: 'test.density-jitter',
      name: 'Density Jitter',
      category: 'Test',
      behavior: 'paint',
    });
    expect(brushDensityJitterV1(preset)).toBe(0);
    const changed = withBrushDensityJitterV1(preset, 0.4);
    expect(brushDensityJitterV1(changed)).toBe(0.4);
    expect(changed.jitter.density).toBe(0.4);
    const reset = withBrushDensityJitterV1(changed, 0);
    expect(brushDensityJitterV1(reset)).toBe(0);
    expect(reset.jitter.density).toBeUndefined();
    expect(() => withBrushDensityJitterV1(preset, -0.01)).toThrow(RangeError);
    expect(() => withBrushDensityJitterV1(preset, 1.01)).toThrow(RangeError);
  });

  it('keeps zero jitter as an exact tip-density identity', () => {
    const baseline = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      spacingRatio: 1,
      tipDensity: 0.8,
      randomSeed: 19,
    });
    const explicitZero = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      spacingRatio: 1,
      tipDensity: 0.8,
      densityJitter: 0,
      randomSeed: 19,
    });
    for (const brush of [baseline, explicitZero]) {
      brush.begin({ documentX: 0, documentY: 0 });
      brush.append([{ documentX: 20, documentY: 0 }]);
      brush.finish();
    }
    expect(explicitZero.dabs()).toEqual(baseline.dabs());
  });

  it('applies deterministic one-sided coverage-density variation without changing flow', () => {
    const seed = 0x12345678;
    const amount = 0.5;
    const baseDensity = 0.8;
    const brush = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      spacingRatio: 1,
      flow: 0.7,
      tipDensity: baseDensity,
      densityJitter: amount,
      randomSeed: seed,
    });
    brush.begin({ documentX: 0, documentY: 0 });
    brush.append([{ documentX: 20, documentY: 0 }]);
    brush.finish();
    const dabs = brush.dabs();
    expect(dabs[0]?.tipDensity).toBeCloseTo(
      baseDensity * (1 - amount * deterministicBaselineBrushDensityJitterV1(seed, 0)),
      10,
    );
    expect(dabs[1]?.tipDensity).toBeCloseTo(
      baseDensity * (1 - amount * deterministicBaselineBrushDensityJitterV1(seed, 1)),
      10,
    );
    expect(dabs.every((dab) => dab.flow === 0.7)).toBe(true);
  });

  it('shares one logical-stamp density sample across sampled-tip micro dabs', () => {
    const seed = 0x2468ace0;
    const amount = 0.6;
    const baseDensity = 0.9;
    const brush = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      tipShape: 'sampled-image',
      tipDensity: baseDensity,
      densityJitter: amount,
      randomSeed: seed,
    });
    const firstStamp = brush.beginDelta({ documentX: 20, documentY: 20 });
    const expected =
      baseDensity * (1 - amount * deterministicBaselineBrushDensityJitterV1(seed, 0));
    expect(firstStamp.length).toBeGreaterThan(1);
    expect(firstStamp.every((dab) => Math.abs((dab.tipDensity ?? 0) - expected) < 1e-10)).toBe(
      true,
    );
  });

  it('advances the density-jitter attempt index even when taper suppresses a logical stamp', () => {
    const seed = 0x89abcdef;
    const amount = 0.75;
    const baseDensity = 0.8;
    const brush = new BaselineBrushDabBuilderV1({
      sizePx: 10,
      spacingRatio: 1,
      startTaperLengthPx: 10,
      tipDensity: baseDensity,
      densityJitter: amount,
      randomSeed: seed,
    });
    brush.begin({ documentX: 0, documentY: 0 });
    brush.append([{ documentX: 10, documentY: 0 }]);
    const [dab] = brush.dabs();
    expect(dab?.tipDensity).toBeCloseTo(
      baseDensity * (1 - amount * deterministicBaselineBrushDensityJitterV1(seed, 1)),
      10,
    );
  });

  it('keeps its random sequence independent from other randomized brush channels', () => {
    const seed = 0x0badc0de;
    const plain = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      spacingRatio: 1,
      densityJitter: 0.5,
      randomSeed: seed,
    });
    const combined = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      spacingRatio: 1,
      densityJitter: 0.5,
      sizeJitter: 0.5,
      opacityJitter: 0.5,
      rotationJitter: 0.5,
      positionJitter: 0.5,
      randomFlowEnabled: true,
      randomSeed: seed,
    });
    for (const brush of [plain, combined]) {
      brush.begin({ documentX: 0, documentY: 0 });
      brush.append([{ documentX: 20, documentY: 0 }]);
      brush.finish();
    }
    expect(combined.dabs().map((dab) => dab.tipDensity)).toEqual(
      plain.dabs().map((dab) => dab.tipDensity),
    );
  });

  it('reuses the resolved density scale when reconciling the mutable end tail', () => {
    const brush = new BaselineBrushDabBuilderV1({
      sizePx: 10,
      spacingRatio: 1,
      endTaperLengthPx: 10,
      sizeTaperMinimumRatio: 1,
      opacityTaperMinimumRatio: 1,
      tipDensity: 0.8,
      densityJitter: 0.6,
      randomSeed: 0xfeed1234,
    });
    brush.begin({ documentX: 0, documentY: 0 });
    brush.append([
      { documentX: 10, documentY: 0 },
      { documentX: 20, documentY: 0 },
    ]);
    const beforeFinish = brush.dabs().map((dab) => dab.tipDensity);
    brush.finish();
    expect(brush.dabs().map((dab) => dab.tipDensity)).toEqual(beforeFinish);
  });

  it('captures runtime density jitter without adding a density-jitter primitive field', () => {
    const session = new PaintSessionControllerV1(new FakeRendererDocumentPort());
    expect(session.setBrushDensityJitter(0.35)).toBe(0.35);
    expect(session.snapshot().brushDensityJitter).toBe(0.35);
    const [dab] = new BaselineBrushDabBuilderV1({
      densityJitter: 0.35,
      randomSeed: 7,
    }).beginDelta({ documentX: 0, documentY: 0 });
    expect(dab).toBeDefined();
    expect('densityJitter' in (dab ?? {})).toBe(false);
  });
});
