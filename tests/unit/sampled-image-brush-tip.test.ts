import { describe, expect, it } from 'vitest';
import {
  BUILTIN_SAMPLED_IMAGE_BRUSH_TIP_ID_V1,
  brushTipShapeV1,
  createBaselineBrushPresetV1,
  withBrushTipShapeV1,
} from '../../src/domain/brush-schema.js';
import {
  createBrushPresetLibraryStateV1,
  selectedBrushPresetItemV1,
  updateBrushPresetTipShapeV1,
} from '../../src/app/brush-preset-library.js';
import { BaselineBrushDabBuilderV1 } from '../../src/gpu/baseline-brush.js';
import {
  BaselineRasterTileStoreV1,
  readBaselineRasterTilePixelV1,
} from '../../src/gpu/baseline-raster-tile-store.js';

describe('M6A-018 sampled image brush tip', () => {
  it('stores the single canonical sampled resource in illustro.brush/1 without changing schema', () => {
    const baseline = createBaselineBrushPresetV1({
      id: 'sampled.test',
      name: 'Sampled Test',
      category: 'Test',
      behavior: 'paint',
    });
    const sampled = withBrushTipShapeV1(baseline, 'sampled-image');
    expect(sampled.schema).toBe('illustro.brush/1');
    expect(sampled.tip.kind).toBe('sampled-image');
    expect(sampled.tip.sampleId).toBe(BUILTIN_SAMPLED_IMAGE_BRUSH_TIP_ID_V1);
    expect(brushTipShapeV1(sampled)).toBe('sampled-image');
  });

  it('mutates an unlocked preset to the sampled tip through the canonical preset state', () => {
    const state = createBrushPresetLibraryStateV1();
    const next = updateBrushPresetTipShapeV1(state, state.selectedPresetId, 'sampled-image');
    expect(brushTipShapeV1(selectedBrushPresetItemV1(next).preset)).toBe('sampled-image');
    expect(selectedBrushPresetItemV1(next).modified).toBe(true);
  });

  it('expands one sampled logical stamp deterministically into alpha-weighted primitive dabs', () => {
    const create = () => {
      const builder = new BaselineBrushDabBuilderV1({
        sizePx: 20,
        opacity: 0.8,
        flow: 0.75,
        tipShape: 'sampled-image',
      });
      builder.begin({ documentX: 32, documentY: 32 });
      return builder.finish();
    };
    const first = create();
    const second = create();
    expect(first).toEqual(second);
    expect(first.length).toBeGreaterThan(8);
    expect(first.every((dab) => dab.tipShape === 'round')).toBe(true);
    expect(new Set(first.map((dab) => dab.opacity.toFixed(6))).size).toBeGreaterThan(3);
    expect(first.at(-1)?.x).toBe(32);
    expect(first.at(-1)?.y).toBe(32);
  });

  it('produces canonical raster coverage without a sampled-tip renderer branch', () => {
    const builder = new BaselineBrushDabBuilderV1({ sizePx: 20, tipShape: 'sampled-image' });
    const dabs = builder.begin({ documentX: 32, documentY: 32 });
    const store = new BaselineRasterTileStoreV1(64, 64, 'rgba8-unorm', [
      { layerId: 'layer', visible: true, opacity: 1 },
    ]);
    store.applyDabs('layer', 'sampled', dabs, 'paint');
    store.finalize('sampled');
    const tile = store.exportTiles()[0];
    if (tile === undefined) throw new Error('missing sampled raster tile');
    const center = 32 * tile.width + 32;
    const untouched = 18 * tile.width + 18;
    expect(readBaselineRasterTilePixelV1(tile, center)[3]).toBeGreaterThan(0);
    expect(readBaselineRasterTilePixelV1(tile, untouched)[3]).toBe(0);
  });
});
