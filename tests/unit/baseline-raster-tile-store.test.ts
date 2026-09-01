import { describe, expect, it } from 'vitest';
import type { BaselineBrushDabV1 } from '../../src/gpu/baseline-brush.js';
import { BaselineRasterTileStoreV1 } from '../../src/gpu/baseline-raster-tile-store.js';

const layers = Object.freeze([Object.freeze({ layerId: 'layer-a', visible: true, opacity: 1 })]);

function dab(x: number, y: number): BaselineBrushDabV1 {
  return Object.freeze({
    schema: 'illustro.baseline-brush-dab/1' as const,
    x,
    y,
    radius: 8,
    opacity: 1,
  });
}

describe('baseline raster tile canonical state', () => {
  it('captures only affected 128px tiles and restores their before/after states', () => {
    const store = new BaselineRasterTileStoreV1(256, 128, 'rgba8-unorm', layers);
    store.applyDabs('layer-a', 'stroke-a', [dab(127, 64)]);
    const patches = store.finalize('stroke-a');

    expect(patches).toHaveLength(2);
    expect(patches.map((patch) => patch.coordinate)).toEqual([
      { tx: 0, ty: 0 },
      { tx: 1, ty: 0 },
    ]);
    expect(patches.every((patch) => patch.before === null && patch.after !== null)).toBe(true);
    expect(store.exportTiles()).toHaveLength(2);

    store.applyPatches(patches, 'before');
    expect(store.exportTiles()).toHaveLength(0);

    store.applyPatches(patches, 'after');
    expect(store.exportTiles()).toHaveLength(2);
  });

  it('cancels an active stroke by restoring the captured tile bytes', () => {
    const store = new BaselineRasterTileStoreV1(128, 128, 'rgba8-unorm', layers);
    store.applyDabs('layer-a', 'stroke-base', [dab(32, 32)]);
    store.finalize('stroke-base');
    const before = store.exportTiles()[0]?.bytes.slice();

    store.applyDabs('layer-a', 'stroke-cancelled', [dab(40, 32)]);
    store.cancel('stroke-cancelled');

    expect(store.exportTiles()[0]?.bytes).toEqual(before);
  });

  it('keeps 16-bit-float document tiles at eight bytes per pixel', () => {
    const store = new BaselineRasterTileStoreV1(128, 128, 'rgba16-float', layers);
    store.applyDabs('layer-a', 'stroke-hdr', [dab(32, 32)]);
    const [patch] = store.finalize('stroke-hdr');

    expect(patch?.after?.pixelFormat).toBe('rgba16-float');
    expect(patch?.after?.bytes.byteLength).toBe(128 * 128 * 8);
  });
});
