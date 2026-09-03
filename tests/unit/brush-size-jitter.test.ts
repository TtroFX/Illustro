import { describe, expect, it } from 'vitest';
import {
  brushSizeJitterV1,
  createBaselineBrushPresetV1,
  withBrushSizeJitterV1,
} from '../../src/domain/brush-schema.js';
import {
  BaselineBrushDabBuilderV1,
  deterministicBaselineBrushRandomV1,
  deterministicBaselineBrushSizeJitterV1,
} from '../../src/gpu/baseline-brush.js';

describe('M6A-051 size jitter', () => {
  it('stores a normalized direct jitter amount with an exact zero default', () => {
    const preset = createBaselineBrushPresetV1({
      id: 'test.size-jitter',
      name: 'Size Jitter',
      category: 'Test',
      behavior: 'paint',
    });
    expect(brushSizeJitterV1(preset)).toBe(0);
    const changed = withBrushSizeJitterV1(preset, 0.4);
    expect(brushSizeJitterV1(changed)).toBe(0.4);
    expect(changed.jitter.size).toBe(0.4);
    const reset = withBrushSizeJitterV1(changed, 0);
    expect(brushSizeJitterV1(reset)).toBe(0);
    expect(reset.jitter.size).toBeUndefined();
    expect(() => withBrushSizeJitterV1(preset, -0.01)).toThrow(RangeError);
    expect(() => withBrushSizeJitterV1(preset, 1.01)).toThrow(RangeError);
  });

  it('keeps zero jitter as an exact radius identity', () => {
    const baseline = new BaselineBrushDabBuilderV1({ sizePx: 20, spacingRatio: 1, randomSeed: 19 });
    baseline.begin({ documentX: 0, documentY: 0 });
    baseline.append([{ documentX: 20, documentY: 0 }]);
    baseline.finish();
    const explicitZero = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      spacingRatio: 1,
      randomSeed: 19,
      sizeJitter: 0,
    });
    explicitZero.begin({ documentX: 0, documentY: 0 });
    explicitZero.append([{ documentX: 20, documentY: 0 }]);
    explicitZero.finish();
    expect(explicitZero.dabs()).toEqual(baseline.dabs());
  });

  it('applies deterministic one-sided size variation per logical stamp attempt', () => {
    const seed = 0x12345678;
    const amount = 0.5;
    const brush = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      spacingRatio: 1,
      sizeJitter: amount,
      randomSeed: seed,
    });
    brush.begin({ documentX: 0, documentY: 0 });
    brush.append([{ documentX: 20, documentY: 0 }]);
    brush.finish();
    const dabs = brush.dabs();
    expect(dabs).toHaveLength(2);
    expect(dabs[0]?.radius).toBeCloseTo(
      10 * (1 - amount * deterministicBaselineBrushSizeJitterV1(seed, 0)),
      10,
    );
    expect(dabs[1]?.radius).toBeCloseTo(
      10 * (1 - amount * deterministicBaselineBrushSizeJitterV1(seed, 1)),
      10,
    );
  });

  it('advances the size-jitter attempt index even when taper suppresses a logical stamp', () => {
    const seed = 0x89abcdef;
    const amount = 0.75;
    const brush = new BaselineBrushDabBuilderV1({
      sizePx: 10,
      spacingRatio: 1,
      startTaperLengthPx: 10,
      sizeJitter: amount,
      randomSeed: seed,
    });
    brush.begin({ documentX: 0, documentY: 0 });
    brush.append([{ documentX: 10, documentY: 0 }]);
    const dabs = brush.dabs();
    expect(dabs).toHaveLength(1);
    expect(dabs[0]?.radius).toBeCloseTo(
      5 * (1 - amount * deterministicBaselineBrushSizeJitterV1(seed, 1)),
      10,
    );
  });

  it('uses a random channel independent from generalized random dynamics', () => {
    const seed = 0x0badc0de;
    expect(deterministicBaselineBrushSizeJitterV1(seed, 0)).not.toBe(
      deterministicBaselineBrushRandomV1(seed, 0),
    );
    const plain = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      spacingRatio: 1,
      sizeJitter: 0.5,
      randomSeed: seed,
    });
    const withDynamics = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      spacingRatio: 1,
      sizeJitter: 0.5,
      randomSeed: seed,
      randomFlowEnabled: true,
    });
    for (const brush of [plain, withDynamics]) {
      brush.begin({ documentX: 0, documentY: 0 });
      brush.append([{ documentX: 20, documentY: 0 }]);
      brush.finish();
    }
    expect(withDynamics.dabs().map((dab) => dab.radius)).toEqual(
      plain.dabs().map((dab) => dab.radius),
    );
  });

  it('reuses the stored jitter scale when reconciling the mutable end tail', () => {
    const seed = 0xfeed1234;
    const amount = 0.6;
    const brush = new BaselineBrushDabBuilderV1({
      sizePx: 10,
      spacingRatio: 1,
      endTaperLengthPx: 10,
      sizeTaperMinimumRatio: 1,
      opacityTaperMinimumRatio: 1,
      sizeJitter: amount,
      randomSeed: seed,
    });
    brush.begin({ documentX: 0, documentY: 0 });
    brush.append([
      { documentX: 10, documentY: 0 },
      { documentX: 20, documentY: 0 },
    ]);
    const beforeFinish = brush.dabs().map((dab) => dab.radius);
    brush.finish();
    expect(brush.dabs().map((dab) => dab.radius)).toEqual(beforeFinish);
  });
});
