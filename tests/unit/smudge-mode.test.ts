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

const smudgeDabs = Object.freeze([
  Object.freeze({
    schema: 'illustro.baseline-brush-dab/1' as const,
    x: 124.5,
    y: 64.5,
    radius: 8,
    opacity: 1,
  }),
  Object.freeze({
    schema: 'illustro.baseline-brush-dab/1' as const,
    x: 132.5,
    y: 64.5,
    radius: 8,
    opacity: 1,
  }),
]);

describe('M6A-003 Smudge/Finger mode', () => {
  it('retains smudge identity while using the incremental canonical geometry kernel', () => {
    const stroke = new CanonicalRasterBrushStrokeV1({ mode: 'smudge' });
    stroke.beginConfirmed({ documentX: 64, documentY: 64 });
    const delta = stroke.appendConfirmed([{ documentX: 72, documentY: 64 }]);
    expect(delta).toHaveLength(2);
    expect(stroke.snapshot()).toMatchObject({
      mode: 'smudge',
      stablePrefixDabCount: 3,
      reprocessedStableDabCount: 0,
    });
  });

  it('pulls active-layer pixels across a tile boundary from an immutable pre-dab snapshot', () => {
    const store = new BaselineRasterTileStoreV1(256, 128, 'rgba8-unorm', [
      { layerId: 'layer', visible: true, opacity: 1 },
    ]);
    store.restore([tileWithPixel('layer', 0, 0, 124, 64, [255, 0, 0, 255])]);

    store.applyDabs('layer', 'smudge-stroke', smudgeDabs, 'smudge');
    const patches = store.finalize('smudge-stroke');
    const destination = store
      .exportTiles()
      .find((tile) => tile.coordinate.tx === 1 && tile.coordinate.ty === 0);

    expect(destination).toBeDefined();
    expect(readBaselineRasterTilePixelV1(destination!, 64 * 128 + 4)).toEqual([1, 0, 0, 1]);
    expect(patches.some((patch) => patch.coordinate.tx === 1)).toBe(true);
  });

  it('samples only the active raster layer rather than merged lower-layer color', () => {
    const store = new BaselineRasterTileStoreV1(256, 128, 'rgba8-unorm', [
      { layerId: 'bottom', visible: true, opacity: 1 },
      { layerId: 'top', visible: true, opacity: 1 },
    ]);
    store.restore([tileWithPixel('bottom', 0, 0, 124, 64, [255, 0, 0, 255])]);

    store.applyDabs('top', 'top-smudge', smudgeDabs, 'smudge');
    expect(store.finalize('top-smudge')).toEqual([]);
    expect(store.exportTiles()).toHaveLength(1);
  });

  it('produces reversible canonical tile patches for normal Undo/Redo', () => {
    const store = new BaselineRasterTileStoreV1(256, 128, 'rgba8-unorm', [
      { layerId: 'layer', visible: true, opacity: 1 },
    ]);
    store.restore([tileWithPixel('layer', 0, 0, 124, 64, [255, 0, 0, 255])]);
    store.applyDabs('layer', 'smudge-undo', smudgeDabs, 'smudge');
    const patches = store.finalize('smudge-undo');

    store.applyPatches(patches, 'before');
    const tiles = store.exportTiles();
    expect(tiles).toHaveLength(1);
    expect(tiles[0]?.coordinate.tx).toBe(0);
    expect(readBaselineRasterTilePixelV1(tiles[0]!, 64 * 128 + 124)).toEqual([1, 0, 0, 1]);

    store.applyPatches(patches, 'after');
    const destination = store.exportTiles().find((tile) => tile.coordinate.tx === 1);
    expect(destination).toBeDefined();
    expect(readBaselineRasterTilePixelV1(destination!, 64 * 128 + 4)).toEqual([1, 0, 0, 1]);
  });
});
