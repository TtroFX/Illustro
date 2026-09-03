import { describe, expect, it } from 'vitest';
import {
  brushSprayParticleDensityV1,
  createBaselineBrushPresetV1,
  withBrushSprayParticleDensityV1,
} from '../../src/domain/brush-schema.js';
import { PaintSessionControllerV1 } from '../../src/app/paint-session-controller.js';
import {
  BASELINE_BRUSH_SPRAY_PARTICLE_COUNT_V1,
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

describe('M6A-059 spray particle density', () => {
  it('stores particles per logical stamp with the M6A-057 default of four', () => {
    const preset = createBaselineBrushPresetV1({
      id: 'test.spray-particle-density',
      name: 'Spray Particle Density',
      category: 'Test',
      behavior: 'paint',
    });
    expect(brushSprayParticleDensityV1(preset)).toBe(BASELINE_BRUSH_SPRAY_PARTICLE_COUNT_V1);
    const changed = withBrushSprayParticleDensityV1(preset, 9);
    expect(brushSprayParticleDensityV1(changed)).toBe(9);
    expect(changed.spray.particleDensity).toBe(9);
    const reset = withBrushSprayParticleDensityV1(changed, 4);
    expect(brushSprayParticleDensityV1(reset)).toBe(4);
    expect(reset.spray.particleDensity).toBeUndefined();
    expect(() => withBrushSprayParticleDensityV1(preset, 0)).toThrow(RangeError);
    expect(() => withBrushSprayParticleDensityV1(preset, 33)).toThrow(RangeError);
    expect(() => withBrushSprayParticleDensityV1(preset, 4.5)).toThrow(RangeError);
  });

  it('keeps omitted density identical to the existing four-particle spray baseline', () => {
    const implicit = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      sprayEnabled: true,
      randomSeed: 0x12345678,
    });
    const explicit = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      sprayEnabled: true,
      sprayParticleDensity: 4,
      randomSeed: 0x12345678,
    });
    expect(explicit.beginDelta({ documentX: 40, documentY: 50 })).toEqual(
      implicit.beginDelta({ documentX: 40, documentY: 50 }),
    );
  });

  it('changes only burst count while preserving the deterministic prefix of particle centers', () => {
    const seed = 0x2468ace0;
    const four = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      sprayEnabled: true,
      sprayParticleDensity: 4,
      randomSeed: seed,
    });
    const eight = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      sprayEnabled: true,
      sprayParticleDensity: 8,
      randomSeed: seed,
    });
    const fourDabs = four.beginDelta({ documentX: 20, documentY: 30 });
    const eightDabs = eight.beginDelta({ documentX: 20, documentY: 30 });
    expect(fourDabs).toHaveLength(4);
    expect(eightDabs).toHaveLength(8);
    expect(eightDabs.slice(0, 4).map((dab) => [dab.x, dab.y])).toEqual(
      fourDabs.map((dab) => [dab.x, dab.y]),
    );
    expect(eightDabs.slice(0, 4).map((dab) => dab.radius)).toEqual(
      fourDabs.map((dab) => dab.radius),
    );
  });

  it('does not reinterpret tip-density jitter as particle density', () => {
    const seed = 0x0badc0de;
    const plain = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      sprayEnabled: true,
      sprayParticleDensity: 6,
      tipDensity: 0.8,
      randomSeed: seed,
    });
    const jittered = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      sprayEnabled: true,
      sprayParticleDensity: 6,
      tipDensity: 0.8,
      densityJitter: 0.5,
      randomSeed: seed,
    });
    const plainDabs = plain.beginDelta({ documentX: 0, documentY: 0 });
    const jitteredDabs = jittered.beginDelta({ documentX: 0, documentY: 0 });
    expect(plainDabs).toHaveLength(6);
    expect(jitteredDabs).toHaveLength(6);
    expect(jitteredDabs.map((dab) => [dab.x, dab.y])).toEqual(
      plainDabs.map((dab) => [dab.x, dab.y]),
    );
    expect(jitteredDabs.some((dab) => dab.tipDensity !== plainDabs[0]?.tipDensity)).toBe(true);
  });

  it('keeps particle density inert when Scatter is off', () => {
    const baseline = new BaselineBrushDabBuilderV1({ sizePx: 20, randomSeed: 5 });
    const configured = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      sprayEnabled: false,
      sprayParticleDensity: 20,
      randomSeed: 5,
    });
    expect(configured.beginDelta({ documentX: 10, documentY: 10 })).toEqual(
      baseline.beginDelta({ documentX: 10, documentY: 10 }),
    );
  });

  it('reuses resolved particle centers during mutable end-tail reconciliation', () => {
    const brush = new BaselineBrushDabBuilderV1({
      sizePx: 10,
      spacingRatio: 1,
      endTaperLengthPx: 10,
      sizeTaperMinimumRatio: 1,
      opacityTaperMinimumRatio: 1,
      sprayEnabled: true,
      sprayParticleDensity: 7,
      randomSeed: 0xfeed1234,
    });
    brush.begin({ documentX: 0, documentY: 0 });
    brush.append([
      { documentX: 10, documentY: 0 },
      { documentX: 20, documentY: 0 },
    ]);
    const before = brush.dabs().map((dab) => [dab.x, dab.y]);
    brush.finish();
    expect(brush.dabs().map((dab) => [dab.x, dab.y])).toEqual(before);
  });

  it('captures density in runtime state without adding a spray-density primitive field', () => {
    const session = new PaintSessionControllerV1(new FakeRendererDocumentPort());
    expect(session.setBrushSprayParticleDensity(12)).toBe(12);
    expect(session.snapshot().brushSprayParticleDensity).toBe(12);
    const [dab] = new BaselineBrushDabBuilderV1({
      sprayEnabled: true,
      sprayParticleDensity: 12,
      randomSeed: 7,
    }).beginDelta({ documentX: 0, documentY: 0 });
    expect(dab).toBeDefined();
    expect('sprayParticleDensity' in (dab ?? {})).toBe(false);
  });
});
