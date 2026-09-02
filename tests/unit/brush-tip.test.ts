import { describe, expect, it } from 'vitest';
import {
  appendSampledBrushTipAssetsV1,
  brushTipDescriptorV1,
  createBrushTipMaskAssetV1,
  decodeBrushTipMaskAlphaV1,
} from '../../src/domain/brush-tip.js';
import { createBaselineBrushPresetV1 } from '../../src/domain/brush-schema.js';
import { BaselineBrushDabBuilderV1 } from '../../src/gpu/baseline-brush.js';
import {
  BaselineRasterTileStoreV1,
  readBaselineRasterTilePixelV1,
} from '../../src/gpu/baseline-raster-tile-store.js';
import {
  createBrushPresetLibraryStateV1,
  selectedBrushPresetItemV1,
  updateBrushPresetTipV1,
} from '../../src/app/brush-preset-library.js';

describe('M6A-017..020 brush tip system', () => {
  it('normalizes legacy procedural-round preset data into canonical procedural semantics', () => {
    const preset = createBaselineBrushPresetV1({
      id: 'tip.round',
      name: 'Round',
      category: 'Test',
      behavior: 'paint',
    });
    expect(brushTipDescriptorV1(preset)).toEqual({
      kind: 'procedural',
      shape: 'round',
      hardness: 0.85,
    });
  });

  it('round-trips bounded 8-bit sampled masks', () => {
    const asset = createBrushTipMaskAssetV1({
      id: 'mask.a',
      width: 2,
      height: 2,
      alpha: new Uint8Array([255, 128, 64, 1]),
    });
    expect([...decodeBrushTipMaskAlphaV1(asset)]).toEqual([255, 128, 64, 1]);
  });

  it('cycles multiple sampled assets one at a time without Dual Brush compositing', () => {
    const a = createBrushTipMaskAssetV1({
      id: 'mask.a',
      width: 1,
      height: 1,
      alpha: new Uint8Array([255]),
    });
    const b = createBrushTipMaskAssetV1({
      id: 'mask.b',
      width: 1,
      height: 1,
      alpha: new Uint8Array([128]),
    });
    const tip = appendSampledBrushTipAssetsV1(
      { kind: 'procedural', shape: 'round', hardness: 0.85 },
      [a, b],
    );
    const builder = new BaselineBrushDabBuilderV1({ tip });
    builder.beginDelta({ documentX: 8, documentY: 8 });
    builder.appendDelta([{ documentX: 16, documentY: 8 }]);
    const dabs = builder.dabs();
    expect(dabs.map((dab) => dab.tipAssetIndex)).toEqual([0, 1, 0]);
    expect(dabs[0]?.tip).toEqual(tip);
    expect(dabs[1]?.tip).toBeUndefined();
  });

  it('uses sampled mask coverage in canonical Raster Tile paint', () => {
    const asset = createBrushTipMaskAssetV1({
      id: 'mask.corner',
      width: 2,
      height: 2,
      alpha: new Uint8Array([255, 0, 0, 1]),
    });
    const tip = { kind: 'sampled' as const, sequence: 'cycle' as const, assets: [asset] };
    const builder = new BaselineBrushDabBuilderV1({ sizePx: 16, tip });
    const dabs = builder.beginDelta({ documentX: 8, documentY: 8 });
    const store = new BaselineRasterTileStoreV1(16, 16, 'rgba8-unorm', [
      { layerId: 'layer', visible: true, opacity: 1 },
    ]);
    store.applyDabs('layer', 'stroke', dabs, 'paint');
    store.finalize('stroke');
    const tile = store.exportTiles()[0];
    expect(tile).toBeDefined();
    const topLeft = readBaselineRasterTilePixelV1(tile!, 2 * 16 + 2)[3];
    const bottomRight = readBaselineRasterTilePixelV1(tile!, 13 * 16 + 13)[3];
    expect(topLeft).toBeGreaterThan(bottomRight);
  });

  it('persists a user-selected sampled tip as a normal Modified preset value', () => {
    const asset = createBrushTipMaskAssetV1({
      id: 'mask.persist',
      width: 1,
      height: 1,
      alpha: new Uint8Array([255]),
    });
    let state = createBrushPresetLibraryStateV1();
    state = updateBrushPresetTipV1(state, state.selectedPresetId, {
      kind: 'sampled',
      sequence: 'cycle',
      assets: [asset],
    });
    const selected = selectedBrushPresetItemV1(state);
    expect(selected.modified).toBe(true);
    expect(brushTipDescriptorV1(selected.preset)).toMatchObject({ kind: 'sampled' });
  });
});
