import { describe, expect, it } from 'vitest';
import {
  brushOpacityJitterV1,
  createBaselineBrushPresetV1,
  withBrushOpacityJitterV1,
} from '../../src/domain/brush-schema.js';
import { PaintSessionControllerV1 } from '../../src/app/paint-session-controller.js';
import {
  BaselineBrushDabBuilderV1,
  deterministicBaselineBrushOpacityJitterV1,
  deterministicBaselineBrushRandomV1,
  deterministicBaselineBrushSizeJitterV1,
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

describe('M6A-052 opacity jitter', () => {
  it('stores a normalized direct jitter amount with an exact zero default', () => {
    const preset = createBaselineBrushPresetV1({
      id: 'test.opacity-jitter',
      name: 'Opacity Jitter',
      category: 'Test',
      behavior: 'paint',
    });
    expect(brushOpacityJitterV1(preset)).toBe(0);
    const changed = withBrushOpacityJitterV1(preset, 0.4);
    expect(brushOpacityJitterV1(changed)).toBe(0.4);
    expect(changed.jitter.opacity).toBe(0.4);
    const reset = withBrushOpacityJitterV1(changed, 0);
    expect(brushOpacityJitterV1(reset)).toBe(0);
    expect(reset.jitter.opacity).toBeUndefined();
    expect(() => withBrushOpacityJitterV1(preset, -0.01)).toThrow(RangeError);
    expect(() => withBrushOpacityJitterV1(preset, 1.01)).toThrow(RangeError);
  });

  it('keeps zero jitter as an exact stroke-opacity identity', () => {
    const baseline = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      opacity: 0.8,
      spacingRatio: 1,
      randomSeed: 19,
    });
    baseline.begin({ documentX: 0, documentY: 0 });
    baseline.append([{ documentX: 20, documentY: 0 }]);
    baseline.finish();
    const explicitZero = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      opacity: 0.8,
      spacingRatio: 1,
      randomSeed: 19,
      opacityJitter: 0,
    });
    explicitZero.begin({ documentX: 0, documentY: 0 });
    explicitZero.append([{ documentX: 20, documentY: 0 }]);
    explicitZero.finish();
    expect(explicitZero.dabs()).toEqual(baseline.dabs());
  });

  it('applies deterministic one-sided opacity variation per logical stamp attempt', () => {
    const seed = 0x12345678;
    const amount = 0.5;
    const brush = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      opacity: 0.8,
      spacingRatio: 1,
      opacityJitter: amount,
      randomSeed: seed,
    });
    brush.begin({ documentX: 0, documentY: 0 });
    brush.append([{ documentX: 20, documentY: 0 }]);
    brush.finish();
    const dabs = brush.dabs();
    expect(dabs).toHaveLength(2);
    expect(dabs[0]?.strokeOpacity).toBeCloseTo(
      0.8 * (1 - amount * deterministicBaselineBrushOpacityJitterV1(seed, 0)),
      10,
    );
    expect(dabs[1]?.strokeOpacity).toBeCloseTo(
      0.8 * (1 - amount * deterministicBaselineBrushOpacityJitterV1(seed, 1)),
      10,
    );
  });

  it('advances the opacity-jitter attempt index even when taper suppresses a logical stamp', () => {
    const seed = 0x89abcdef;
    const amount = 0.75;
    const brush = new BaselineBrushDabBuilderV1({
      sizePx: 10,
      opacity: 1,
      spacingRatio: 1,
      startTaperLengthPx: 10,
      opacityJitter: amount,
      randomSeed: seed,
    });
    brush.begin({ documentX: 0, documentY: 0 });
    brush.append([{ documentX: 10, documentY: 0 }]);
    const dabs = brush.dabs();
    expect(dabs).toHaveLength(1);
    expect(dabs[0]?.strokeOpacity).toBeCloseTo(
      1 - amount * deterministicBaselineBrushOpacityJitterV1(seed, 1),
      10,
    );
  });

  it('uses a random channel independent from generalized random dynamics and size jitter', () => {
    const seed = 0x0badc0de;
    expect(deterministicBaselineBrushOpacityJitterV1(seed, 0)).not.toBe(
      deterministicBaselineBrushRandomV1(seed, 0),
    );
    expect(deterministicBaselineBrushOpacityJitterV1(seed, 0)).not.toBe(
      deterministicBaselineBrushSizeJitterV1(seed, 0),
    );
    const plain = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      spacingRatio: 1,
      opacityJitter: 0.5,
      randomSeed: seed,
    });
    const withOtherRandomChannels = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      spacingRatio: 1,
      opacityJitter: 0.5,
      sizeJitter: 0.5,
      randomSeed: seed,
      randomFlowEnabled: true,
    });
    for (const brush of [plain, withOtherRandomChannels]) {
      brush.begin({ documentX: 0, documentY: 0 });
      brush.append([{ documentX: 20, documentY: 0 }]);
      brush.finish();
    }
    expect(withOtherRandomChannels.dabs().map((dab) => dab.strokeOpacity)).toEqual(
      plain.dabs().map((dab) => dab.strokeOpacity),
    );
  });

  it('reuses the stored opacity-jitter scale when reconciling the mutable end tail', () => {
    const seed = 0xfeed1234;
    const amount = 0.6;
    const brush = new BaselineBrushDabBuilderV1({
      sizePx: 10,
      opacity: 0.8,
      spacingRatio: 1,
      endTaperLengthPx: 10,
      sizeTaperMinimumRatio: 1,
      opacityTaperMinimumRatio: 1,
      opacityJitter: amount,
      randomSeed: seed,
    });
    brush.begin({ documentX: 0, documentY: 0 });
    brush.append([
      { documentX: 10, documentY: 0 },
      { documentX: 20, documentY: 0 },
    ]);
    const beforeFinish = brush.dabs().map((dab) => dab.strokeOpacity);
    brush.finish();
    expect(brush.dabs().map((dab) => dab.strokeOpacity)).toEqual(beforeFinish);
  });

  it('captures the runtime amount without extending the primitive dab schema', () => {
    const session = new PaintSessionControllerV1(new FakeRendererDocumentPort());
    expect(session.setBrushOpacityJitter(0.35)).toBe(0.35);
    expect(session.snapshot().brushOpacityJitter).toBe(0.35);
    const [dab] = new BaselineBrushDabBuilderV1({ opacityJitter: 0.35, randomSeed: 7 }).beginDelta({
      documentX: 0,
      documentY: 0,
    });
    expect(dab).toBeDefined();
    expect('opacityJitter' in (dab ?? {})).toBe(false);
  });
});
