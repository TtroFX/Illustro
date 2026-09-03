import { describe, expect, it } from 'vitest';
import {
  brushSprayEnabledV1,
  createBaselineBrushPresetV1,
  withBrushSprayEnabledV1,
} from '../../src/domain/brush-schema.js';
import { PaintSessionControllerV1 } from '../../src/app/paint-session-controller.js';
import {
  BASELINE_BRUSH_SPRAY_PARTICLE_COUNT_V1,
  BASELINE_BRUSH_SPRAY_PARTICLE_SCALE_V1,
  BaselineBrushDabBuilderV1,
  deterministicBaselineBrushSprayParticleV1,
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

const centers = (dabs: readonly { x: number; y: number }[]) => dabs.map((dab) => [dab.x, dab.y]);

describe('M6A-057 spray/particle mode', () => {
  it('stores a boolean spray toggle with an exact false default', () => {
    const preset = createBaselineBrushPresetV1({
      id: 'test.spray',
      name: 'Spray',
      category: 'Test',
      behavior: 'paint',
    });
    expect(brushSprayEnabledV1(preset)).toBe(false);
    const enabled = withBrushSprayEnabledV1(preset, true);
    expect(brushSprayEnabledV1(enabled)).toBe(true);
    expect(enabled.spray.enabled).toBe(true);
    const reset = withBrushSprayEnabledV1(enabled, false);
    expect(brushSprayEnabledV1(reset)).toBe(false);
    expect(reset.spray.enabled).toBeUndefined();
  });

  it('keeps disabled spray as an exact ordinary-stamp identity', () => {
    const baseline = new BaselineBrushDabBuilderV1({ sizePx: 20, spacingRatio: 1, randomSeed: 7 });
    const explicitOff = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      spacingRatio: 1,
      sprayEnabled: false,
      randomSeed: 7,
    });
    for (const brush of [baseline, explicitOff]) {
      brush.begin({ documentX: 0, documentY: 0 });
      brush.append([{ documentX: 20, documentY: 0 }]);
      brush.finish();
    }
    expect(explicitOff.dabs()).toEqual(baseline.dabs());
  });

  it('turns one logical stamp into a deterministic bounded multi-particle burst', () => {
    const seed = 0x12345678;
    const brush = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      sprayEnabled: true,
      randomSeed: seed,
    });
    const burst = brush.beginDelta({ documentX: 40, documentY: 30 });
    expect(burst).toHaveLength(BASELINE_BRUSH_SPRAY_PARTICLE_COUNT_V1);
    expect(
      burst.every(
        (dab) => Math.abs(dab.radius - 10 * BASELINE_BRUSH_SPRAY_PARTICLE_SCALE_V1) < 1e-10,
      ),
    ).toBe(true);
    burst.forEach((dab, particleIndex) => {
      const unit = deterministicBaselineBrushSprayParticleV1(seed, 0, particleIndex);
      expect(dab.x).toBeCloseTo(40 + unit.x * 10, 10);
      expect(dab.y).toBeCloseTo(30 + unit.y * 10, 10);
      expect(Math.hypot(dab.x - 40, dab.y - 30)).toBeLessThanOrEqual(10 + 1e-10);
      expect('sprayEnabled' in dab).toBe(false);
    });
  });

  it('keeps spray randomness independent from the existing random and jitter channels', () => {
    const seed = 0x0badc0de;
    const plain = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      spacingRatio: 1,
      sprayEnabled: true,
      randomSeed: seed,
    });
    const combined = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      spacingRatio: 1,
      sprayEnabled: true,
      sizeJitter: 0.4,
      opacityJitter: 0.4,
      rotationJitter: 0.4,
      densityJitter: 0.4,
      hueJitter: 0.4,
      saturationJitter: 0.4,
      valueJitter: 0.4,
      randomFlowEnabled: true,
      randomSeed: seed,
    });
    for (const brush of [plain, combined]) {
      brush.begin({ documentX: 0, documentY: 0 });
      brush.append([{ documentX: 20, documentY: 0 }]);
      brush.finish();
    }
    expect(centers(combined.dabs())).toEqual(centers(plain.dabs()));
  });

  it('advances the spray attempt index when taper suppresses an ordinary logical stamp', () => {
    const seed = 0x89abcdef;
    const reference = new BaselineBrushDabBuilderV1({
      sizePx: 10,
      spacingRatio: 1,
      sprayEnabled: true,
      randomSeed: seed,
    });
    reference.begin({ documentX: 0, documentY: 0 });
    reference.append([{ documentX: 10, documentY: 0 }]);
    const expectedSecondBurst = centers(
      reference.dabs().slice(BASELINE_BRUSH_SPRAY_PARTICLE_COUNT_V1),
    );
    const suppressed = new BaselineBrushDabBuilderV1({
      sizePx: 10,
      spacingRatio: 1,
      startTaperLengthPx: 10,
      sprayEnabled: true,
      randomSeed: seed,
    });
    suppressed.begin({ documentX: 0, documentY: 0 });
    suppressed.append([{ documentX: 10, documentY: 0 }]);
    expect(centers(suppressed.dabs())).toEqual(expectedSecondBurst);
  });

  it('reuses resolved particle centers during mutable end-tail reconciliation', () => {
    const brush = new BaselineBrushDabBuilderV1({
      sizePx: 10,
      spacingRatio: 1,
      endTaperLengthPx: 10,
      sizeTaperMinimumRatio: 1,
      opacityTaperMinimumRatio: 1,
      sprayEnabled: true,
      randomSeed: 0xfeed1234,
    });
    brush.begin({ documentX: 0, documentY: 0 });
    brush.append([
      { documentX: 10, documentY: 0 },
      { documentX: 20, documentY: 0 },
    ]);
    const beforeFinish = centers(brush.dabs());
    brush.finish();
    expect(centers(brush.dabs())).toEqual(beforeFinish);
  });

  it('captures the runtime mode without adding a spray-specific primitive field', () => {
    const session = new PaintSessionControllerV1(new FakeRendererDocumentPort());
    expect(session.setBrushSprayEnabled(true)).toBe(true);
    expect(session.snapshot().brushSprayEnabled).toBe(true);
    const [dab] = new BaselineBrushDabBuilderV1({ sprayEnabled: true, randomSeed: 17 }).beginDelta({
      documentX: 0,
      documentY: 0,
    });
    expect(dab).toBeDefined();
    expect('spray' in (dab ?? {})).toBe(false);
  });
});
