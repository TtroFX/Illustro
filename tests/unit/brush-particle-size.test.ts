import { describe, expect, it } from 'vitest';
import {
  brushSprayParticleSizeRatioV1,
  createBaselineBrushPresetV1,
  withBrushSprayParticleSizeRatioV1,
} from '../../src/domain/brush-schema.js';
import { PaintSessionControllerV1 } from '../../src/app/paint-session-controller.js';
import {
  BASELINE_BRUSH_SPRAY_PARTICLE_SCALE_V1,
  BaselineBrushDabBuilderV1,
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

describe('M6A-058 spray particle size', () => {
  it('keeps the M6A-057 35% particle-size baseline as the canonical default', () => {
    const preset = createBaselineBrushPresetV1({
      id: 'test.spray-particle-size',
      name: 'Spray Particle Size',
      category: 'Test',
      behavior: 'paint',
    });
    expect(brushSprayParticleSizeRatioV1(preset)).toBe(BASELINE_BRUSH_SPRAY_PARTICLE_SCALE_V1);
    const changed = withBrushSprayParticleSizeRatioV1(preset, 0.6);
    expect(brushSprayParticleSizeRatioV1(changed)).toBe(0.6);
    expect(changed.spray.particleSizeRatio).toBe(0.6);
    const reset = withBrushSprayParticleSizeRatioV1(changed, 0.35);
    expect(brushSprayParticleSizeRatioV1(reset)).toBe(0.35);
    expect(reset.spray.particleSizeRatio).toBeUndefined();
    expect(() => withBrushSprayParticleSizeRatioV1(preset, 0.009)).toThrow(RangeError);
    expect(() => withBrushSprayParticleSizeRatioV1(preset, 4.01)).toThrow(RangeError);
  });

  it('keeps the existing spray output identical when the size ratio is omitted or explicitly 35%', () => {
    const implicit = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      sprayEnabled: true,
      randomSeed: 0x12345678,
    });
    const explicit = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      sprayEnabled: true,
      sprayParticleSizeRatio: 0.35,
      randomSeed: 0x12345678,
    });
    expect(explicit.beginDelta({ documentX: 40, documentY: 50 })).toEqual(
      implicit.beginDelta({ documentX: 40, documentY: 50 }),
    );
  });

  it('changes particle radius without changing the deterministic particle centers or burst count', () => {
    const seed = 0x2468ace0;
    const small = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      sprayEnabled: true,
      sprayParticleSizeRatio: 0.25,
      randomSeed: seed,
    });
    const large = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      sprayEnabled: true,
      sprayParticleSizeRatio: 0.75,
      randomSeed: seed,
    });
    const smallDabs = small.beginDelta({ documentX: 20, documentY: 30 });
    const largeDabs = large.beginDelta({ documentX: 20, documentY: 30 });
    expect(smallDabs).toHaveLength(4);
    expect(largeDabs).toHaveLength(4);
    expect(largeDabs.map((dab) => [dab.x, dab.y])).toEqual(smallDabs.map((dab) => [dab.x, dab.y]));
    expect(smallDabs.every((dab) => Math.abs(dab.radius - 2.5) < 1e-10)).toBe(true);
    expect(largeDabs.every((dab) => Math.abs(dab.radius - 7.5) < 1e-10)).toBe(true);
  });

  it('applies the particle ratio after parent size dynamics and jitter are resolved', () => {
    const seed = 0x10203040;
    const parent = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      sizeJitter: 0.4,
      randomSeed: seed,
    });
    const spray = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      sizeJitter: 0.4,
      sprayEnabled: true,
      sprayParticleSizeRatio: 0.5,
      randomSeed: seed,
    });
    const [parentDab] = parent.beginDelta({ documentX: 0, documentY: 0 });
    const particles = spray.beginDelta({ documentX: 0, documentY: 0 });
    expect(parentDab).toBeDefined();
    expect(
      particles.every((dab) => Math.abs(dab.radius - (parentDab?.radius ?? 0) * 0.5) < 1e-10),
    ).toBe(true);
  });

  it('does not affect ordinary non-spray stamps', () => {
    const baseline = new BaselineBrushDabBuilderV1({ sizePx: 20, randomSeed: 5 });
    const configured = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      sprayEnabled: false,
      sprayParticleSizeRatio: 2,
      randomSeed: 5,
    });
    expect(configured.beginDelta({ documentX: 10, documentY: 10 })).toEqual(
      baseline.beginDelta({ documentX: 10, documentY: 10 }),
    );
  });

  it('captures particle size in runtime state without adding a primitive-only field', () => {
    const session = new PaintSessionControllerV1(new FakeRendererDocumentPort());
    expect(session.setBrushSprayParticleSizeRatio(0.8)).toBe(0.8);
    expect(session.snapshot().brushSprayParticleSizeRatio).toBe(0.8);
    const [dab] = new BaselineBrushDabBuilderV1({
      sprayEnabled: true,
      sprayParticleSizeRatio: 0.8,
      randomSeed: 7,
    }).beginDelta({ documentX: 0, documentY: 0 });
    expect(dab).toBeDefined();
    expect('sprayParticleSizeRatio' in (dab ?? {})).toBe(false);
  });
});
