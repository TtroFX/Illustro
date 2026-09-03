import { describe, expect, it } from 'vitest';
import type { BaselineBrushDabV1 } from '../../src/gpu/baseline-brush.js';
import {
  BaselineRasterTileStoreV1,
  readBaselineRasterTilePixelV1,
} from '../../src/gpu/baseline-raster-tile-store.js';

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

  it('mixes ordinary paint with opaque canvas color in linear light', () => {
    const store = new BaselineRasterTileStoreV1(128, 128, 'rgba8-unorm', layers);
    const colored = (
      strokeId: string,
      color: readonly [number, number, number],
      mix = false,
    ): void => {
      store.applyDabs('layer-a', strokeId, [
        Object.freeze({
          schema: 'illustro.baseline-brush-dab/1' as const,
          x: 32,
          y: 32,
          radius: 8,
          opacity: 1,
          color,
          ...(mix
            ? {
                colorMixEnabled: true,
                colorMixCanvasRatio: 0.5,
                colorMixDepositAmount: 1,
              }
            : {}),
        }),
      ]);
      store.finalize(strokeId);
    };
    colored('stroke-blue', [0, 0, 1]);
    colored('stroke-red-mix', [1, 0, 0], true);
    const tile = store.exportTiles()[0];
    expect(tile).toBeDefined();
    const pixel = readBaselineRasterTilePixelV1(tile!, 32 * 128 + 32);
    expect(pixel[0]).toBeCloseTo(0.735, 2);
    expect(pixel[1]).toBeCloseTo(0, 3);
    expect(pixel[2]).toBeCloseTo(0.735, 2);
    expect(pixel[3]).toBeCloseTo(1, 3);
  });

  it('does not mix transparent black into ordinary paint and honors deposit amount', () => {
    const store = new BaselineRasterTileStoreV1(128, 128, 'rgba8-unorm', layers);
    store.applyDabs('layer-a', 'stroke-mix-transparent', [
      Object.freeze({
        schema: 'illustro.baseline-brush-dab/1' as const,
        x: 32,
        y: 32,
        radius: 8,
        opacity: 1,
        color: Object.freeze([1, 0, 0] as const),
        colorMixEnabled: true,
        colorMixCanvasRatio: 1,
        colorMixDepositAmount: 0.25,
      }),
    ]);
    store.finalize('stroke-mix-transparent');
    const tile = store.exportTiles()[0];
    expect(tile).toBeDefined();
    const pixel = readBaselineRasterTilePixelV1(tile!, 32 * 128 + 32);
    expect(pixel[0]).toBeCloseTo(1, 3);
    expect(pixel[1]).toBeCloseTo(0, 3);
    expect(pixel[2]).toBeCloseTo(0, 3);
    expect(pixel[3]).toBeCloseTo(0.25, 2);
  });

  it('keeps 16-bit-float document tiles at eight bytes per pixel', () => {
    const store = new BaselineRasterTileStoreV1(128, 128, 'rgba16-float', layers);
    store.applyDabs('layer-a', 'stroke-hdr', [dab(32, 32)]);
    const [patch] = store.finalize('stroke-hdr');

    expect(patch?.after?.pixelFormat).toBe('rgba16-float');
    expect(patch?.after?.bytes.byteLength).toBe(128 * 128 * 8);
  });
});
