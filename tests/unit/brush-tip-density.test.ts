import { describe, expect, it } from 'vitest';
import {
  brushTipDensityV1,
  createBaselineBrushPresetV1,
  withBrushTipDensityV1,
} from '../../src/domain/brush-schema.js';
import { BaselineBrushDabBuilderV1 } from '../../src/gpu/baseline-brush.js';
import {
  BaselineRasterTileStoreV1,
  readBaselineRasterTilePixelV1,
} from '../../src/gpu/baseline-raster-tile-store.js';

describe('M6A-022 brush tip density', () => {
  it('uses a legacy-safe full-density fallback and persists a static 0..1 preset value', () => {
    const preset = createBaselineBrushPresetV1({
      id: 'density.paint',
      name: 'Paint',
      category: 'Test',
      behavior: 'paint',
    });
    expect(brushTipDensityV1(preset)).toBe(1);
    const sparse = withBrushTipDensityV1(preset, 0.4);
    expect(sparse.schema).toBe('illustro.brush/1');
    expect(brushTipDensityV1(sparse)).toBe(0.4);
    expect(() => withBrushTipDensityV1(preset, -0.01)).toThrow(RangeError);
    expect(() => withBrushTipDensityV1(preset, 1.01)).toThrow(RangeError);
  });

  it('captures tip density into every primitive dab including sampled image micro dabs', () => {
    const round = new BaselineBrushDabBuilderV1({ sizePx: 16, tipDensity: 0.3 });
    round.begin({ documentX: 24, documentY: 24 });
    round.append([{ documentX: 36, documentY: 24 }]);
    expect(round.finish().every((dab) => dab.tipDensity === 0.3)).toBe(true);

    const sampled = new BaselineBrushDabBuilderV1({
      sizePx: 16,
      tipDensity: 0.2,
      tipShape: 'sampled-image',
    });
    expect(
      sampled.begin({ documentX: 24, documentY: 24 }).every((dab) => dab.tipDensity === 0.2),
    ).toBe(true);
  });

  it('reduces canonical tip mask coverage independently from flow', () => {
    const sparse = new BaselineRasterTileStoreV1(64, 64, 'rgba8-unorm', [
      { layerId: 'layer', visible: true, opacity: 1 },
    ]);
    const dense = new BaselineRasterTileStoreV1(64, 64, 'rgba8-unorm', [
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
      hardness: 1,
      tipShape: 'round' as const,
      color: [1, 0, 0] as const,
    };
    sparse.applyDabs('layer', 'sparse', [Object.freeze({ ...base, tipDensity: 0.25 })], 'paint');
    dense.applyDabs('layer', 'dense', [Object.freeze({ ...base, tipDensity: 1 })], 'paint');
    sparse.finalize('sparse');
    dense.finalize('dense');
    const sparseTile = sparse.exportTiles()[0];
    const denseTile = dense.exportTiles()[0];
    if (sparseTile === undefined || denseTile === undefined) throw new Error('missing raster tile');
    const centerPixel = 32 * sparseTile.width + 32;
    const sparseAlpha = readBaselineRasterTilePixelV1(sparseTile, centerPixel)[3];
    const denseAlpha = readBaselineRasterTilePixelV1(denseTile, centerPixel)[3];
    expect(sparseAlpha).toBeGreaterThan(0);
    expect(denseAlpha).toBeGreaterThan(sparseAlpha);
  });
});
