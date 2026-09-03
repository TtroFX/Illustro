import { describe, expect, it } from 'vitest';
import {
  brushRotationJitterV1,
  createBaselineBrushPresetV1,
  withBrushRotationJitterV1,
} from '../../src/domain/brush-schema.js';
import { PaintSessionControllerV1 } from '../../src/app/paint-session-controller.js';
import {
  BaselineBrushDabBuilderV1,
  deterministicBaselineBrushOpacityJitterV1,
  deterministicBaselineBrushRandomV1,
  deterministicBaselineBrushRotationJitterV1,
  deterministicBaselineBrushSizeJitterV1,
  normalizeBaselineBrushTipAngleDegreesV1,
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

function expectedAngle(seed: number, index: number, amount: number, baseDegrees: number): number {
  const offset = (deterministicBaselineBrushRotationJitterV1(seed, index) - 0.5) * 360 * amount;
  return normalizeBaselineBrushTipAngleDegreesV1(baseDegrees + offset);
}

describe('M6A-053 rotation jitter', () => {
  it('stores a normalized random-rotation amount with an exact zero default', () => {
    const preset = createBaselineBrushPresetV1({
      id: 'test.rotation-jitter',
      name: 'Rotation Jitter',
      category: 'Test',
      behavior: 'paint',
    });
    expect(brushRotationJitterV1(preset)).toBe(0);
    const changed = withBrushRotationJitterV1(preset, 0.4);
    expect(brushRotationJitterV1(changed)).toBe(0.4);
    expect(changed.jitter.rotation).toBe(0.4);
    const reset = withBrushRotationJitterV1(changed, 0);
    expect(brushRotationJitterV1(reset)).toBe(0);
    expect(reset.jitter.rotation).toBeUndefined();
    expect(() => withBrushRotationJitterV1(preset, -0.01)).toThrow(RangeError);
    expect(() => withBrushRotationJitterV1(preset, 1.01)).toThrow(RangeError);
  });

  it('keeps zero jitter as an exact tip-angle identity', () => {
    const baseline = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      spacingRatio: 1,
      tipShape: 'square',
      tipAngleDegrees: 32,
      tipDirectionDegrees: 7,
      randomSeed: 19,
    });
    const explicitZero = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      spacingRatio: 1,
      tipShape: 'square',
      tipAngleDegrees: 32,
      tipDirectionDegrees: 7,
      randomSeed: 19,
      rotationJitter: 0,
    });
    for (const brush of [baseline, explicitZero]) {
      brush.begin({ documentX: 0, documentY: 0 });
      brush.append([{ documentX: 20, documentY: 0 }]);
      brush.finish();
    }
    expect(explicitZero.dabs()).toEqual(baseline.dabs());
  });

  it('applies a deterministic symmetric angle offset after the resolved base angle', () => {
    const seed = 0x12345678;
    const amount = 0.5;
    const baseDegrees = 20;
    const brush = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      spacingRatio: 1,
      tipShape: 'square',
      tipAngleDegrees: 30,
      tipDirectionDegrees: 10,
      rotationJitter: amount,
      randomSeed: seed,
    });
    brush.begin({ documentX: 0, documentY: 0 });
    brush.append([{ documentX: 20, documentY: 0 }]);
    brush.finish();
    const dabs = brush.dabs();
    expect(dabs).toHaveLength(2);
    expect(dabs[0]?.tipAngleDegrees).toBeCloseTo(expectedAngle(seed, 0, amount, baseDegrees), 10);
    expect(dabs[1]?.tipAngleDegrees).toBeCloseTo(expectedAngle(seed, 1, amount, baseDegrees), 10);
  });

  it('advances the rotation-jitter attempt index even when taper suppresses a logical stamp', () => {
    const seed = 0x89abcdef;
    const amount = 0.75;
    const brush = new BaselineBrushDabBuilderV1({
      sizePx: 10,
      spacingRatio: 1,
      startTaperLengthPx: 10,
      tipAngleDegrees: 40,
      tipDirectionDegrees: 10,
      rotationJitter: amount,
      randomSeed: seed,
    });
    brush.begin({ documentX: 0, documentY: 0 });
    brush.append([{ documentX: 10, documentY: 0 }]);
    const dabs = brush.dabs();
    expect(dabs).toHaveLength(1);
    expect(dabs[0]?.tipAngleDegrees).toBeCloseTo(expectedAngle(seed, 1, amount, 30), 10);
  });

  it('uses a random channel independent from generalized, size and opacity random channels', () => {
    const seed = 0x0badc0de;
    const value = deterministicBaselineBrushRotationJitterV1(seed, 0);
    expect(value).not.toBe(deterministicBaselineBrushRandomV1(seed, 0));
    expect(value).not.toBe(deterministicBaselineBrushSizeJitterV1(seed, 0));
    expect(value).not.toBe(deterministicBaselineBrushOpacityJitterV1(seed, 0));
    const plain = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      spacingRatio: 1,
      tipShape: 'square',
      rotationJitter: 0.5,
      randomSeed: seed,
    });
    const withOtherRandomChannels = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      spacingRatio: 1,
      tipShape: 'square',
      rotationJitter: 0.5,
      sizeJitter: 0.5,
      opacityJitter: 0.5,
      randomFlowEnabled: true,
      randomSeed: seed,
    });
    for (const brush of [plain, withOtherRandomChannels]) {
      brush.begin({ documentX: 0, documentY: 0 });
      brush.append([{ documentX: 20, documentY: 0 }]);
      brush.finish();
    }
    expect(withOtherRandomChannels.dabs().map((dab) => dab.tipAngleDegrees)).toEqual(
      plain.dabs().map((dab) => dab.tipAngleDegrees),
    );
  });

  it('reuses the resolved jittered angle when reconciling the mutable end tail', () => {
    const brush = new BaselineBrushDabBuilderV1({
      sizePx: 10,
      spacingRatio: 1,
      endTaperLengthPx: 10,
      sizeTaperMinimumRatio: 1,
      opacityTaperMinimumRatio: 1,
      tipShape: 'square',
      rotationJitter: 0.6,
      randomSeed: 0xfeed1234,
    });
    brush.begin({ documentX: 0, documentY: 0 });
    brush.append([
      { documentX: 10, documentY: 0 },
      { documentX: 20, documentY: 0 },
    ]);
    const beforeFinish = brush.dabs().map((dab) => dab.tipAngleDegrees);
    brush.finish();
    expect(brush.dabs().map((dab) => dab.tipAngleDegrees)).toEqual(beforeFinish);
  });

  it('captures the runtime amount without adding a rotation-jitter primitive field', () => {
    const session = new PaintSessionControllerV1(new FakeRendererDocumentPort());
    expect(session.setBrushRotationJitter(0.35)).toBe(0.35);
    expect(session.snapshot().brushRotationJitter).toBe(0.35);
    const [dab] = new BaselineBrushDabBuilderV1({
      rotationJitter: 0.35,
      randomSeed: 7,
    }).beginDelta({ documentX: 0, documentY: 0 });
    expect(dab).toBeDefined();
    expect('rotationJitter' in (dab ?? {})).toBe(false);
    expect(dab?.tipAngleDegrees).toBeDefined();
  });
});
