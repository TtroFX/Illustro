import { describe, expect, it } from 'vitest';
import {
  brushSprayAngleBasedOnCenterV1,
  createBaselineBrushPresetV1,
  withBrushSprayAngleBasedOnCenterV1,
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

const normalize = (degrees: number): number => ((degrees % 360) + 360) % 360;

describe('M6A-061 spray particle orientation', () => {
  it('stores center-based orientation as an exact false default', () => {
    const preset = createBaselineBrushPresetV1({
      id: 'test.spray-orientation',
      name: 'Spray Orientation',
      category: 'Test',
      behavior: 'paint',
    });
    expect(brushSprayAngleBasedOnCenterV1(preset)).toBe(false);
    const changed = withBrushSprayAngleBasedOnCenterV1(preset, true);
    expect(brushSprayAngleBasedOnCenterV1(changed)).toBe(true);
    expect(changed.spray.angleBasedOnCenter).toBe(true);
    const reset = withBrushSprayAngleBasedOnCenterV1(changed, false);
    expect(brushSprayAngleBasedOnCenterV1(reset)).toBe(false);
    expect(reset.spray.angleBasedOnCenter).toBeUndefined();
  });

  it('keeps disabled orientation identical to the established spray baseline', () => {
    const implicit = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      tipShape: 'square',
      tipAngleDegrees: 25,
      sprayEnabled: true,
      sprayParticleDensity: 8,
      randomSeed: 0x12345678,
    });
    const explicit = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      tipShape: 'square',
      tipAngleDegrees: 25,
      sprayEnabled: true,
      sprayParticleDensity: 8,
      sprayAngleBasedOnCenter: false,
      randomSeed: 0x12345678,
    });
    expect(explicit.beginDelta({ documentX: 40, documentY: 50 })).toEqual(
      implicit.beginDelta({ documentX: 40, documentY: 50 }),
    );
  });

  it('adds each particle radial angle to the already resolved parent tip angle', () => {
    const centerX = 20;
    const centerY = 30;
    const baseAngle = 25;
    const brush = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      tipShape: 'square',
      tipAngleDegrees: baseAngle,
      sprayEnabled: true,
      sprayParticleDensity: 8,
      sprayAngleBasedOnCenter: true,
      randomSeed: 0x2468ace0,
    });
    const dabs = brush.beginDelta({ documentX: centerX, documentY: centerY });
    expect(dabs).toHaveLength(8);
    for (const dab of dabs) {
      const radial = (Math.atan2(dab.y - centerY, dab.x - centerX) * 180) / Math.PI;
      expect(dab.tipAngleDegrees).toBeCloseTo(normalize(baseAngle + radial), 10);
    }
  });

  it('keeps particle centers, radius, color and count unchanged when center orientation is toggled', () => {
    const options = {
      sizePx: 20,
      tipShape: 'square' as const,
      tipAngleDegrees: 40,
      sprayEnabled: true,
      sprayParticleDensity: 9,
      spraySpreadRadiusRatio: 1.5,
      sprayDeviation: -0.25,
      randomSeed: 0x0badc0de,
    };
    const inherited = new BaselineBrushDabBuilderV1({ ...options, sprayAngleBasedOnCenter: false });
    const centered = new BaselineBrushDabBuilderV1({ ...options, sprayAngleBasedOnCenter: true });
    const inheritedDabs = inherited.beginDelta({ documentX: 0, documentY: 0 });
    const centeredDabs = centered.beginDelta({ documentX: 0, documentY: 0 });
    expect(centeredDabs.map((dab) => [dab.x, dab.y])).toEqual(
      inheritedDabs.map((dab) => [dab.x, dab.y]),
    );
    expect(centeredDabs.map((dab) => dab.radius)).toEqual(inheritedDabs.map((dab) => dab.radius));
    expect(centeredDabs.map((dab) => dab.color)).toEqual(inheritedDabs.map((dab) => dab.color));
    expect(
      centeredDabs.some(
        (dab, index) => dab.tipAngleDegrees !== inheritedDabs[index]?.tipAngleDegrees,
      ),
    ).toBe(true);
  });

  it('uses the inherited parent angle when the particle has no radial displacement', () => {
    const brush = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      tipShape: 'square',
      tipAngleDegrees: 73,
      sprayEnabled: true,
      sprayParticleDensity: 6,
      spraySpreadRadiusRatio: 0,
      sprayAngleBasedOnCenter: true,
      randomSeed: 0x89abcdef,
    });
    const dabs = brush.beginDelta({ documentX: 10, documentY: 15 });
    expect(dabs).toHaveLength(6);
    expect(dabs.every((dab) => dab.x === 10 && dab.y === 15)).toBe(true);
    expect(dabs.every((dab) => dab.tipAngleDegrees === 73)).toBe(true);
  });

  it('is inert when Scatter is off', () => {
    const baseline = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      tipShape: 'square',
      tipAngleDegrees: 15,
    });
    const configured = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      tipShape: 'square',
      tipAngleDegrees: 15,
      sprayEnabled: false,
      sprayAngleBasedOnCenter: true,
    });
    expect(configured.beginDelta({ documentX: 10, documentY: 10 })).toEqual(
      baseline.beginDelta({ documentX: 10, documentY: 10 }),
    );
  });

  it('reuses resolved particle angles during mutable end-tail reconciliation', () => {
    const brush = new BaselineBrushDabBuilderV1({
      sizePx: 10,
      spacingRatio: 1,
      endTaperLengthPx: 10,
      sizeTaperMinimumRatio: 1,
      opacityTaperMinimumRatio: 1,
      tipShape: 'square',
      tipAngleDegrees: 20,
      sprayEnabled: true,
      sprayParticleDensity: 7,
      sprayAngleBasedOnCenter: true,
      randomSeed: 0xfeed1234,
    });
    brush.begin({ documentX: 0, documentY: 0 });
    brush.append([
      { documentX: 10, documentY: 0 },
      { documentX: 20, documentY: 0 },
    ]);
    const before = brush.dabs().map((dab) => dab.tipAngleDegrees);
    brush.finish();
    expect(brush.dabs().map((dab) => dab.tipAngleDegrees)).toEqual(before);
  });

  it('captures orientation in runtime state without adding a spray-orientation primitive field', () => {
    const session = new PaintSessionControllerV1(new FakeRendererDocumentPort());
    expect(session.setBrushSprayAngleBasedOnCenter(true)).toBe(true);
    expect(session.snapshot().brushSprayAngleBasedOnCenter).toBe(true);
    const [dab] = new BaselineBrushDabBuilderV1({
      sprayEnabled: true,
      sprayAngleBasedOnCenter: true,
      randomSeed: 7,
    }).beginDelta({ documentX: 0, documentY: 0 });
    expect(dab).toBeDefined();
    expect('sprayAngleBasedOnCenter' in (dab ?? {})).toBe(false);
  });
});
