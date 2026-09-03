import { describe, expect, it } from 'vitest';
import {
  brushPositionJitterV1,
  createBaselineBrushPresetV1,
  withBrushPositionJitterV1,
} from '../../src/domain/brush-schema.js';
import { PaintSessionControllerV1 } from '../../src/app/paint-session-controller.js';
import {
  BaselineBrushDabBuilderV1,
  deterministicBaselineBrushPositionJitterV1,
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

describe('M6A-054 position/scatter jitter', () => {
  it('stores normalized position jitter with an exact zero default', () => {
    const preset = createBaselineBrushPresetV1({
      id: 'test.position-jitter',
      name: 'Position Jitter',
      category: 'Test',
      behavior: 'paint',
    });
    expect(brushPositionJitterV1(preset)).toBe(0);
    const changed = withBrushPositionJitterV1(preset, 0.4);
    expect(brushPositionJitterV1(changed)).toBe(0.4);
    expect(changed.jitter.position).toBe(0.4);
    const reset = withBrushPositionJitterV1(changed, 0);
    expect(brushPositionJitterV1(reset)).toBe(0);
    expect(reset.jitter.position).toBeUndefined();
    expect(() => withBrushPositionJitterV1(preset, -0.01)).toThrow(RangeError);
    expect(() => withBrushPositionJitterV1(preset, 1.01)).toThrow(RangeError);
  });

  it('keeps zero jitter as an exact stamp-position identity', () => {
    const baseline = new BaselineBrushDabBuilderV1({ sizePx: 20, spacingRatio: 1, randomSeed: 19 });
    const explicitZero = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      spacingRatio: 1,
      randomSeed: 19,
      positionJitter: 0,
    });
    for (const brush of [baseline, explicitZero]) {
      brush.begin({ documentX: 0, documentY: 0 });
      brush.append([{ documentX: 20, documentY: 0 }]);
      brush.finish();
    }
    expect(explicitZero.dabs()).toEqual(baseline.dabs());
  });

  it('uses a deterministic isotropic unit-disk vector scaled by base brush diameter', () => {
    const seed = 0x12345678;
    const amount = 0.5;
    const sizePx = 20;
    const brush = new BaselineBrushDabBuilderV1({
      sizePx,
      spacingRatio: 1,
      positionJitter: amount,
      randomSeed: seed,
    });
    brush.begin({ documentX: 0, documentY: 0 });
    brush.append([{ documentX: 20, documentY: 0 }]);
    brush.finish();
    const first = deterministicBaselineBrushPositionJitterV1(seed, 0);
    const second = deterministicBaselineBrushPositionJitterV1(seed, 1);
    expect(Math.hypot(first.x, first.y)).toBeLessThanOrEqual(1);
    expect(Math.hypot(second.x, second.y)).toBeLessThanOrEqual(1);
    expect(brush.dabs()[0]?.x).toBeCloseTo(first.x * sizePx * amount, 10);
    expect(brush.dabs()[0]?.y).toBeCloseTo(first.y * sizePx * amount, 10);
    expect(brush.dabs()[1]?.x).toBeCloseTo(20 + second.x * sizePx * amount, 10);
    expect(brush.dabs()[1]?.y).toBeCloseTo(second.y * sizePx * amount, 10);
  });

  it('does not feed jittered centers back into spacing or stroke geometry', () => {
    const brush = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      spacingRatio: 1,
      positionJitter: 1,
      randomSeed: 0x2468ace0,
    });
    brush.begin({ documentX: 0, documentY: 0 });
    brush.append([{ documentX: 40, documentY: 0 }]);
    brush.finish();
    expect(brush.dabs()).toHaveLength(3);
  });

  it('advances the position-jitter attempt index even when taper suppresses a logical stamp', () => {
    const seed = 0x89abcdef;
    const amount = 0.75;
    const sizePx = 10;
    const brush = new BaselineBrushDabBuilderV1({
      sizePx,
      spacingRatio: 1,
      startTaperLengthPx: 10,
      positionJitter: amount,
      randomSeed: seed,
    });
    brush.begin({ documentX: 0, documentY: 0 });
    brush.append([{ documentX: 10, documentY: 0 }]);
    const vector = deterministicBaselineBrushPositionJitterV1(seed, 1);
    const [dab] = brush.dabs();
    expect(dab).toBeDefined();
    expect(dab?.x).toBeCloseTo(10 + vector.x * sizePx * amount, 10);
    expect(dab?.y).toBeCloseTo(vector.y * sizePx * amount, 10);
  });

  it('keeps its random sequence independent from other randomized brush channels', () => {
    const seed = 0x0badc0de;
    const plain = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      spacingRatio: 1,
      positionJitter: 0.5,
      randomSeed: seed,
    });
    const combined = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      spacingRatio: 1,
      positionJitter: 0.5,
      sizeJitter: 0.5,
      opacityJitter: 0.5,
      rotationJitter: 0.5,
      randomFlowEnabled: true,
      randomSeed: seed,
    });
    for (const brush of [plain, combined]) {
      brush.begin({ documentX: 0, documentY: 0 });
      brush.append([{ documentX: 20, documentY: 0 }]);
      brush.finish();
    }
    expect(combined.dabs().map((dab) => [dab.x, dab.y])).toEqual(
      plain.dabs().map((dab) => [dab.x, dab.y]),
    );
  });

  it('reuses the resolved jittered center when reconciling the mutable end tail', () => {
    const brush = new BaselineBrushDabBuilderV1({
      sizePx: 10,
      spacingRatio: 1,
      endTaperLengthPx: 10,
      sizeTaperMinimumRatio: 1,
      opacityTaperMinimumRatio: 1,
      positionJitter: 0.6,
      randomSeed: 0xfeed1234,
    });
    brush.begin({ documentX: 0, documentY: 0 });
    brush.append([
      { documentX: 10, documentY: 0 },
      { documentX: 20, documentY: 0 },
    ]);
    const beforeFinish = brush.dabs().map((dab) => [dab.x, dab.y]);
    brush.finish();
    expect(brush.dabs().map((dab) => [dab.x, dab.y])).toEqual(beforeFinish);
  });

  it('captures runtime position jitter without extending the primitive dab schema', () => {
    const session = new PaintSessionControllerV1(new FakeRendererDocumentPort());
    expect(session.setBrushPositionJitter(0.35)).toBe(0.35);
    expect(session.snapshot().brushPositionJitter).toBe(0.35);
    const [dab] = new BaselineBrushDabBuilderV1({
      positionJitter: 0.35,
      randomSeed: 7,
    }).beginDelta({ documentX: 0, documentY: 0 });
    expect(dab).toBeDefined();
    expect('positionJitter' in (dab ?? {})).toBe(false);
  });
});
