import { describe, expect, it } from 'vitest';
import { CanonicalRasterBrushStrokeV1 } from '../../src/app/canonical-raster-brush.js';
import {
  BaselineRasterTileStoreV1,
  readBaselineRasterTilePixelV1,
  type BaselineRasterTileImageV1,
} from '../../src/gpu/baseline-raster-tile-store.js';

function tileWithPixel(
  layerId: string,
  tx: number,
  ty: number,
  localX: number,
  localY: number,
  rgba: readonly [number, number, number, number],
): BaselineRasterTileImageV1 {
  const bytes = new Uint8Array(128 * 128 * 4);
  const offset = (localY * 128 + localX) * 4;
  bytes[offset] = rgba[0];
  bytes[offset + 1] = rgba[1];
  bytes[offset + 2] = rgba[2];
  bytes[offset + 3] = rgba[3];
  return Object.freeze({
    schema: 'illustro.baseline-raster-tile/1' as const,
    layerId,
    coordinate: Object.freeze({ tx, ty }),
    width: 128,
    height: 128,
    pixelFormat: 'rgba8-unorm' as const,
    bytes,
  });
}

function requireTile(
  tiles: readonly BaselineRasterTileImageV1[],
  tx: number,
  ty: number,
): BaselineRasterTileImageV1 {
  const tile = tiles.find(
    (candidate) => candidate.coordinate.tx === tx && candidate.coordinate.ty === ty,
  );
  if (tile === undefined) throw new Error(`missing tile ${tx}:${ty}`);
  return tile;
}

function blurDab(x: number, y: number) {
  return Object.freeze({
    schema: 'illustro.baseline-brush-dab/1' as const,
    x,
    y,
    radius: 8,
    opacity: 1,
  });
}

describe('M6A-004 Blur brush mode', () => {
  it('retains Blur identity while using the incremental canonical geometry kernel', () => {
    const stroke = new CanonicalRasterBrushStrokeV1({ mode: 'blur' });
    stroke.beginConfirmed({ documentX: 64, documentY: 64 });
    stroke.appendConfirmed([{ documentX: 72, documentY: 64 }]);
    expect(stroke.snapshot()).toMatchObject({
      mode: 'blur',
      stablePrefixDabCount: 3,
      reprocessedStableDabCount: 0,
    });
  });

  it('applies a bounded premultiplied blur without introducing dark RGB fringes', () => {
    const store = new BaselineRasterTileStoreV1(128, 128, 'rgba8-unorm', [
      { layerId: 'layer', visible: true, opacity: 1 },
    ]);
    store.restore([tileWithPixel('layer', 0, 0, 64, 64, [255, 0, 0, 255])]);
    store.applyDabs('layer', 'blur-center', [blurDab(64.5, 64.5)], 'blur');
    const patches = store.finalize('blur-center');
    const tile = requireTile(store.exportTiles(), 0, 0);
    const center = readBaselineRasterTilePixelV1(tile, 64 * 128 + 64);
    const neighbor = readBaselineRasterTilePixelV1(tile, 64 * 128 + 65);

    expect(center[3]).toBeGreaterThan(0);
    expect(center[3]).toBeLessThan(1);
    expect(center[0]).toBe(1);
    expect(center[1]).toBe(0);
    expect(center[2]).toBe(0);
    expect(neighbor[3]).toBeGreaterThan(0);
    expect(neighbor[0]).toBe(1);
    expect(patches).toHaveLength(1);
  });

  it('samples across canonical tile boundaries but never from lower layers', () => {
    const store = new BaselineRasterTileStoreV1(256, 128, 'rgba8-unorm', [
      { layerId: 'bottom', visible: true, opacity: 1 },
      { layerId: 'top', visible: true, opacity: 1 },
    ]);
    store.restore([
      tileWithPixel('bottom', 0, 0, 127, 64, [0, 255, 0, 255]),
      tileWithPixel('top', 0, 0, 127, 64, [255, 0, 0, 255]),
    ]);
    store.applyDabs('top', 'blur-boundary', [blurDab(128.5, 64.5)], 'blur');
    store.finalize('blur-boundary');
    const destination = requireTile(
      store.exportTiles().filter((tile) => tile.layerId === 'top'),
      1,
      0,
    );
    const pixel = readBaselineRasterTilePixelV1(destination, 64 * 128);

    expect(pixel[3]).toBeGreaterThan(0);
    expect(pixel[0]).toBe(1);
    expect(pixel[1]).toBe(0);
    expect(pixel[2]).toBe(0);
  });

  it('produces reversible canonical tile patches for Undo/Redo', () => {
    const store = new BaselineRasterTileStoreV1(128, 128, 'rgba8-unorm', [
      { layerId: 'layer', visible: true, opacity: 1 },
    ]);
    store.restore([tileWithPixel('layer', 0, 0, 64, 64, [255, 0, 0, 255])]);
    store.applyDabs('layer', 'blur-undo', [blurDab(64.5, 64.5)], 'blur');
    const patches = store.finalize('blur-undo');
    store.applyPatches(patches, 'before');
    let tile = requireTile(store.exportTiles(), 0, 0);
    expect(readBaselineRasterTilePixelV1(tile, 64 * 128 + 64)).toEqual([1, 0, 0, 1]);
    expect(readBaselineRasterTilePixelV1(tile, 64 * 128 + 65)).toEqual([0, 0, 0, 0]);

    store.applyPatches(patches, 'after');
    tile = requireTile(store.exportTiles(), 0, 0);
    expect(readBaselineRasterTilePixelV1(tile, 64 * 128 + 65)[3]).toBeGreaterThan(0);
  });
});
