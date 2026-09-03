import { describe, expect, it } from 'vitest';
import {
  brushTipHardnessV1,
  createBaselineBrushPresetV1,
  withBrushTipHardnessV1,
} from '../../src/domain/brush-schema.js';
import { BaselineBrushDabBuilderV1 } from '../../src/gpu/baseline-brush.js';
import {
  BaselineRasterTileStoreV1,
  readBaselineRasterTilePixelV1,
} from '../../src/gpu/baseline-raster-tile-store.js';

describe('M6A-021 brush hardness', () => {
  it('reads existing baseline hardness and persists a static 0..1 preset value', () => {
    const paint = createBaselineBrushPresetV1({
      id: 'hardness.paint',
      name: 'Paint',
      category: 'Test',
      behavior: 'paint',
    });
    const blur = createBaselineBrushPresetV1({
      id: 'hardness.blur',
      name: 'Blur',
      category: 'Test',
      behavior: 'blur',
    });
    expect(brushTipHardnessV1(paint)).toBe(0.85);
    expect(brushTipHardnessV1(blur)).toBe(0.35);
    const soft = withBrushTipHardnessV1(paint, 0.2);
    expect(soft.schema).toBe('illustro.brush/1');
    expect(brushTipHardnessV1(soft)).toBe(0.2);
    expect(() => withBrushTipHardnessV1(paint, 1.01)).toThrow(RangeError);
  });

  it('captures hardness into every primitive dab, including sampled image micro dabs', () => {
    const round = new BaselineBrushDabBuilderV1({ sizePx: 16, hardness: 0.3 });
    round.begin({ documentX: 24, documentY: 24 });
    round.append([{ documentX: 36, documentY: 24 }]);
    expect(round.finish().every((dab) => dab.hardness === 0.3)).toBe(true);

    const sampled = new BaselineBrushDabBuilderV1({
      sizePx: 16,
      hardness: 0.1,
      tipShape: 'sampled-image',
    });
    expect(
      sampled.begin({ documentX: 24, documentY: 24 }).every((dab) => dab.hardness === 0.1),
    ).toBe(true);
  });

  it('softens the canonical tip edge while hardness 1 keeps full interior coverage', () => {
    const soft = new BaselineRasterTileStoreV1(64, 64, 'rgba8-unorm', [
      { layerId: 'layer', visible: true, opacity: 1 },
    ]);
    const hard = new BaselineRasterTileStoreV1(64, 64, 'rgba8-unorm', [
      { layerId: 'layer', visible: true, opacity: 1 },
    ]);
    const base = {
      schema: 'illustro.baseline-brush-dab/1' as const,
      x: 32,
      y: 32,
      radius: 10,
      opacity: 1,
      flow: 1,
      strokeOpacity: 1,
      tipShape: 'round' as const,
      color: [1, 0, 0] as const,
    };
    soft.applyDabs('layer', 'soft', [Object.freeze({ ...base, hardness: 0 })], 'paint');
    hard.applyDabs('layer', 'hard', [Object.freeze({ ...base, hardness: 1 })], 'paint');
    soft.finalize('soft');
    hard.finalize('hard');
    const softTile = soft.exportTiles()[0];
    const hardTile = hard.exportTiles()[0];
    if (softTile === undefined || hardTile === undefined) throw new Error('missing raster tile');
    const nearEdgePixel = 32 * softTile.width + 40;
    const softAlpha = readBaselineRasterTilePixelV1(softTile, nearEdgePixel)[3];
    const hardAlpha = readBaselineRasterTilePixelV1(hardTile, nearEdgePixel)[3];
    expect(softAlpha).toBeGreaterThan(0);
    expect(hardAlpha).toBeGreaterThan(softAlpha);
  });
});
