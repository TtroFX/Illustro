import { describe, expect, it } from 'vitest';
import {
  brushTipAngleDegreesV1,
  createBaselineBrushPresetV1,
  withBrushTipAngleDegreesV1,
} from '../../src/domain/brush-schema.js';
import { BaselineBrushDabBuilderV1 } from '../../src/gpu/baseline-brush.js';
import {
  BaselineRasterTileStoreV1,
  readBaselineRasterTilePixelV1,
} from '../../src/gpu/baseline-raster-tile-store.js';

describe('M6A-024 static brush tip angle', () => {
  it('normalizes preset angle to a deterministic 0..360 degree domain', () => {
    const preset = createBaselineBrushPresetV1({
      id: 'angle.paint',
      name: 'Paint',
      category: 'Test',
      behavior: 'paint',
    });
    expect(brushTipAngleDegreesV1(preset)).toBe(0);
    expect(brushTipAngleDegreesV1(withBrushTipAngleDegreesV1(preset, 450))).toBe(90);
    expect(brushTipAngleDegreesV1(withBrushTipAngleDegreesV1(preset, -90))).toBe(270);
  });

  it('rotates an asymmetric sampled tip before primitive-dab expansion', () => {
    const alpha = Array.from({ length: 25 }, () => 0);
    alpha[2] = 255;
    const vertical = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      tipShape: 'sampled-image',
      sampledTipAlpha: alpha,
      tipAngleDegrees: 0,
    }).begin({ documentX: 20, documentY: 20 });
    const rotated = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      tipShape: 'sampled-image',
      sampledTipAlpha: alpha,
      tipAngleDegrees: 90,
    }).begin({ documentX: 20, documentY: 20 });
    expect(vertical).toHaveLength(1);
    expect(rotated).toHaveLength(1);
    expect(vertical[0]?.x).toBeCloseTo(20, 6);
    expect(vertical[0]?.y).toBeCloseTo(12, 6);
    expect(rotated[0]?.x).toBeCloseTo(28, 6);
    expect(rotated[0]?.y).toBeCloseTo(20, 6);
  });

  it('rotates square canonical coverage and expands dirty bounds for its corners', () => {
    const axis = new BaselineRasterTileStoreV1(64, 64, 'rgba8-unorm', [
      { layerId: 'layer', visible: true, opacity: 1 },
    ]);
    const rotated = new BaselineRasterTileStoreV1(64, 64, 'rgba8-unorm', [
      { layerId: 'layer', visible: true, opacity: 1 },
    ]);
    const base = {
      schema: 'illustro.baseline-brush-dab/1' as const,
      x: 32,
      y: 32,
      radius: 10,
      opacity: 1,
      hardness: 1,
      tipDensity: 1,
      tipShape: 'square' as const,
      color: [0, 0, 0] as const,
    };
    axis.applyDabs('layer', 'axis', [Object.freeze({ ...base, tipAngleDegrees: 0 })], 'paint');
    rotated.applyDabs(
      'layer',
      'rotated',
      [Object.freeze({ ...base, tipAngleDegrees: 45 })],
      'paint',
    );
    axis.finalize('axis');
    rotated.finalize('rotated');
    const axisTile = axis.exportTiles()[0];
    const rotatedTile = rotated.exportTiles()[0];
    if (axisTile === undefined || rotatedTile === undefined) throw new Error('missing raster tile');
    const outerAxisPixel = 32 * axisTile.width + 45;
    expect(readBaselineRasterTilePixelV1(axisTile, outerAxisPixel)[3]).toBe(0);
    expect(readBaselineRasterTilePixelV1(rotatedTile, outerAxisPixel)[3]).toBeGreaterThan(0);
  });
});
