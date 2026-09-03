import { describe, expect, it } from 'vitest';
import {
  brushSprayDeviationV1,
  brushSpraySpreadRadiusRatioV1,
  createBaselineBrushPresetV1,
  withBrushSprayDeviationV1,
  withBrushSpraySpreadRadiusRatioV1,
} from '../../src/domain/brush-schema.js';
import { PaintSessionControllerV1 } from '../../src/app/paint-session-controller.js';
import { BaselineBrushDabBuilderV1 } from '../../src/gpu/baseline-brush.js';

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

function radiiFrom(
  centerX: number,
  centerY: number,
  dabs: readonly { x: number; y: number }[],
): number[] {
  return dabs.map((dab) => Math.hypot(dab.x - centerX, dab.y - centerY));
}

describe('M6A-060 spray particle spread', () => {
  it('stores a 1x spread radius and uniform distribution as exact defaults', () => {
    const preset = createBaselineBrushPresetV1({
      id: 'test.spray-spread',
      name: 'Spray Spread',
      category: 'Test',
      behavior: 'paint',
    });
    expect(brushSpraySpreadRadiusRatioV1(preset)).toBe(1);
    expect(brushSprayDeviationV1(preset)).toBe(0);
    const changed = withBrushSprayDeviationV1(withBrushSpraySpreadRadiusRatioV1(preset, 2.5), -0.4);
    expect(brushSpraySpreadRadiusRatioV1(changed)).toBe(2.5);
    expect(brushSprayDeviationV1(changed)).toBe(-0.4);
    expect(changed.spray.spreadRadiusRatio).toBe(2.5);
    expect(changed.spray.deviation).toBe(-0.4);
    const reset = withBrushSprayDeviationV1(withBrushSpraySpreadRadiusRatioV1(changed, 1), 0);
    expect(reset.spray.spreadRadiusRatio).toBeUndefined();
    expect(reset.spray.deviation).toBeUndefined();
    expect(() => withBrushSpraySpreadRadiusRatioV1(preset, -0.01)).toThrow(RangeError);
    expect(() => withBrushSpraySpreadRadiusRatioV1(preset, 4.01)).toThrow(RangeError);
    expect(() => withBrushSprayDeviationV1(preset, -1.01)).toThrow(RangeError);
    expect(() => withBrushSprayDeviationV1(preset, 1.01)).toThrow(RangeError);
  });

  it('keeps 1x spread and zero deviation identical to the established spray baseline', () => {
    const implicit = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      sprayEnabled: true,
      sprayParticleDensity: 8,
      randomSeed: 0x12345678,
    });
    const explicit = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      sprayEnabled: true,
      sprayParticleDensity: 8,
      spraySpreadRadiusRatio: 1,
      sprayDeviation: 0,
      randomSeed: 0x12345678,
    });
    expect(explicit.beginDelta({ documentX: 40, documentY: 50 })).toEqual(
      implicit.beginDelta({ documentX: 40, documentY: 50 }),
    );
  });

  it('scales only particle-center offsets when spread radius changes', () => {
    const seed = 0x2468ace0;
    const one = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      sprayEnabled: true,
      sprayParticleDensity: 8,
      spraySpreadRadiusRatio: 1,
      randomSeed: seed,
    });
    const two = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      sprayEnabled: true,
      sprayParticleDensity: 8,
      spraySpreadRadiusRatio: 2,
      randomSeed: seed,
    });
    const oneDabs = one.beginDelta({ documentX: 20, documentY: 30 });
    const twoDabs = two.beginDelta({ documentX: 20, documentY: 30 });
    const oneRadii = radiiFrom(20, 30, oneDabs);
    const twoRadii = radiiFrom(20, 30, twoDabs);
    expect(twoDabs).toHaveLength(oneDabs.length);
    for (let index = 0; index < oneDabs.length; index += 1) {
      expect(twoRadii[index]).toBeCloseTo((oneRadii[index] ?? 0) * 2, 10);
      expect(twoDabs[index]?.radius).toBeCloseTo(oneDabs[index]?.radius ?? 0, 10);
      expect(twoDabs[index]?.tipAngleDegrees).toBe(oneDabs[index]?.tipAngleDegrees);
    }
  });

  it('uses positive deviation for center bias and negative deviation for edge bias', () => {
    const seed = 0x0badc0de;
    const make = (deviation: number) => {
      const brush = new BaselineBrushDabBuilderV1({
        sizePx: 20,
        sprayEnabled: true,
        sprayParticleDensity: 12,
        spraySpreadRadiusRatio: 1,
        sprayDeviation: deviation,
        randomSeed: seed,
      });
      return brush.beginDelta({ documentX: 0, documentY: 0 });
    };
    const uniform = radiiFrom(0, 0, make(0));
    const inward = radiiFrom(0, 0, make(0.5));
    const outward = radiiFrom(0, 0, make(-0.5));
    expect(inward.every((radius, index) => radius <= (uniform[index] ?? 0) + 1e-10)).toBe(true);
    expect(outward.every((radius, index) => radius >= (uniform[index] ?? 0) - 1e-10)).toBe(true);
    expect(inward.some((radius, index) => radius < (uniform[index] ?? 0) - 1e-8)).toBe(true);
    expect(outward.some((radius, index) => radius > (uniform[index] ?? 0) + 1e-8)).toBe(true);
  });

  it('keeps count and deterministic particle ordering stable across spread settings', () => {
    const seed = 0x89abcdef;
    const compact = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      sprayEnabled: true,
      sprayParticleDensity: 6,
      spraySpreadRadiusRatio: 0.5,
      sprayDeviation: 0.25,
      randomSeed: seed,
    });
    const broad = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      sprayEnabled: true,
      sprayParticleDensity: 6,
      spraySpreadRadiusRatio: 3,
      sprayDeviation: -0.25,
      randomSeed: seed,
    });
    const compactDabs = compact.beginDelta({ documentX: 0, documentY: 0 });
    const broadDabs = broad.beginDelta({ documentX: 0, documentY: 0 });
    expect(compactDabs).toHaveLength(6);
    expect(broadDabs).toHaveLength(6);
    expect(broadDabs.map((dab) => dab.radius)).toEqual(compactDabs.map((dab) => dab.radius));
    expect(broadDabs.map((dab) => dab.color)).toEqual(compactDabs.map((dab) => dab.color));
  });

  it('is inert when Scatter is off', () => {
    const baseline = new BaselineBrushDabBuilderV1({ sizePx: 20, randomSeed: 5 });
    const configured = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      sprayEnabled: false,
      spraySpreadRadiusRatio: 4,
      sprayDeviation: -1,
      randomSeed: 5,
    });
    expect(configured.beginDelta({ documentX: 10, documentY: 10 })).toEqual(
      baseline.beginDelta({ documentX: 10, documentY: 10 }),
    );
  });

  it('reuses resolved spread centers during mutable end-tail reconciliation', () => {
    const brush = new BaselineBrushDabBuilderV1({
      sizePx: 10,
      spacingRatio: 1,
      endTaperLengthPx: 10,
      sizeTaperMinimumRatio: 1,
      opacityTaperMinimumRatio: 1,
      sprayEnabled: true,
      sprayParticleDensity: 7,
      spraySpreadRadiusRatio: 2,
      sprayDeviation: -0.35,
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

  it('captures spread in runtime state without adding spread fields to primitive dabs', () => {
    const session = new PaintSessionControllerV1(new FakeRendererDocumentPort());
    expect(session.setBrushSpraySpread(1.75, -0.3)).toEqual({
      spreadRadiusRatio: 1.75,
      deviation: -0.3,
    });
    expect(session.snapshot().brushSpraySpreadRadiusRatio).toBe(1.75);
    expect(session.snapshot().brushSprayDeviation).toBe(-0.3);
    const [dab] = new BaselineBrushDabBuilderV1({
      sprayEnabled: true,
      spraySpreadRadiusRatio: 1.75,
      sprayDeviation: -0.3,
      randomSeed: 7,
    }).beginDelta({ documentX: 0, documentY: 0 });
    expect(dab).toBeDefined();
    expect('spraySpreadRadiusRatio' in (dab ?? {})).toBe(false);
    expect('sprayDeviation' in (dab ?? {})).toBe(false);
  });
});
