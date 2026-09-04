import { describe, expect, it } from 'vitest';
import {
  brushReferenceAntiOverflowV1,
  createBaselineBrushPresetV1,
  withBrushReferenceAntiOverflowV1,
} from '../../src/domain/brush-schema.js';
import {
  BaselineBrushDabBuilderV1,
  type BaselineBrushDabV1,
} from '../../src/gpu/baseline-brush.js';
import {
  BaselineRasterTileStoreV1,
  readBaselineRasterTilePixelV1,
  type BaselineRasterTileImageV1,
} from '../../src/gpu/baseline-raster-tile-store.js';

function referenceTile(): BaselineRasterTileImageV1 {
  const bytes = new Uint8Array(16 * 16 * 4);
  for (let y = 0; y < 16; y += 1) bytes[(y * 16 + 8) * 4 + 3] = 255;
  return Object.freeze({
    schema: 'illustro.baseline-raster-tile/1' as const,
    layerId: 'reference',
    coordinate: Object.freeze({ tx: 0, ty: 0 }),
    width: 16,
    height: 16,
    pixelFormat: 'rgba8-unorm' as const,
    bytes,
  });
}

const layers = Object.freeze([
  Object.freeze({ layerId: 'paint', visible: true, opacity: 1 }),
  Object.freeze({ layerId: 'reference', visible: true, opacity: 1, reference: true }),
]);

function guardedDab(x: number, y: number, radius: number): BaselineBrushDabV1 {
  return Object.freeze({
    schema: 'illustro.baseline-brush-dab/1' as const,
    x,
    y,
    radius,
    opacity: 1,
    color: Object.freeze([1, 0, 0] as const),
    referenceAntiOverflow: true,
    referenceOriginX: x,
    referenceOriginY: y,
  });
}

function paintTile(store: BaselineRasterTileStoreV1): BaselineRasterTileImageV1 {
  const tile = store.exportTiles().find((candidate) => candidate.layerId === 'paint');
  if (tile === undefined) throw new Error('expected painted tile');
  return tile;
}

describe('reference-aware anti-overflow painting', () => {
  it('keeps the preset opt-in and default identity', () => {
    const base = createBaselineBrushPresetV1({
      id: 'anti-overflow-test',
      name: 'Anti Overflow',
      category: 'test',
      behavior: 'paint',
      defaultSizePx: 16,
      tags: ['test'],
    });
    expect(brushReferenceAntiOverflowV1(base)).toBe(false);
    expect(brushReferenceAntiOverflowV1(withBrushReferenceAntiOverflowV1(base, true))).toBe(true);
  });

  it('shares one logical reference origin across sampled-image micro dabs', () => {
    const builder = new BaselineBrushDabBuilderV1({
      sizePx: 10,
      tipShape: 'sampled-image',
      referenceAntiOverflow: true,
    });
    const dabs = builder.begin({ documentX: 7, documentY: 9 });
    expect(dabs.length).toBeGreaterThan(1);
    expect(
      dabs.every(
        (dab) =>
          dab.referenceAntiOverflow === true &&
          dab.referenceOriginX === 7 &&
          dab.referenceOriginY === 9,
      ),
    ).toBe(true);
  });

  it('clips brush-radius overflow to the connected side of a reference line', () => {
    const guarded = new BaselineRasterTileStoreV1(16, 16, 'rgba8-unorm', layers);
    guarded.restore([referenceTile()]);
    guarded.applyDabs('paint', 'guarded-radius', [guardedDab(6, 8, 5)]);
    guarded.finalize('guarded-radius');
    const guardedTile = paintTile(guarded);
    expect(readBaselineRasterTilePixelV1(guardedTile, 8 * 16 + 6)[3]).toBeGreaterThan(0);
    expect(readBaselineRasterTilePixelV1(guardedTile, 8 * 16 + 9)[3]).toBe(0);

    const legacy = new BaselineRasterTileStoreV1(16, 16, 'rgba8-unorm', layers);
    legacy.restore([referenceTile()]);
    legacy.applyDabs('paint', 'legacy-radius', [
      Object.freeze({ ...guardedDab(6, 8, 5), referenceAntiOverflow: false }),
    ]);
    legacy.finalize('legacy-radius');
    expect(readBaselineRasterTilePixelV1(paintTile(legacy), 8 * 16 + 9)[3]).toBeGreaterThan(0);
  });

  it('rejects a later logical origin that crosses the reference boundary', () => {
    const store = new BaselineRasterTileStoreV1(16, 16, 'rgba8-unorm', layers);
    store.restore([referenceTile()]);
    store.applyDabs('paint', 'crossing', [guardedDab(6, 8, 2)]);
    store.applyDabs('paint', 'crossing', [guardedDab(10, 8, 2)]);
    store.finalize('crossing');
    const tile = paintTile(store);
    expect(readBaselineRasterTilePixelV1(tile, 8 * 16 + 6)[3]).toBeGreaterThan(0);
    expect(readBaselineRasterTilePixelV1(tile, 8 * 16 + 10)[3]).toBe(0);
  });
});
