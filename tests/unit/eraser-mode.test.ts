import { describe, expect, it } from 'vitest';
import { CanonicalRasterBrushStrokeV1 } from '../../src/app/canonical-raster-brush.js';
import {
  BaselineRasterTileStoreV1,
  readBaselineRasterTilePixelV1,
} from '../../src/gpu/baseline-raster-tile-store.js';

describe('M6A-002 Eraser mode', () => {
  it('uses the same incremental geometry kernel while retaining eraser mode identity', () => {
    const stroke = new CanonicalRasterBrushStrokeV1({ mode: 'eraser' });
    stroke.beginConfirmed({ documentX: 64, documentY: 64 });
    const delta = stroke.appendConfirmed([{ documentX: 72, documentY: 64 }]);
    expect(delta).toHaveLength(2);
    expect(stroke.snapshot()).toMatchObject({
      mode: 'eraser',
      stablePrefixDabCount: 3,
      reprocessedStableDabCount: 0,
    });
  });

  it('reduces active-layer alpha instead of painting white', () => {
    const store = new BaselineRasterTileStoreV1(128, 128, 'rgba8-unorm', [
      { layerId: 'layer', visible: true, opacity: 1 },
    ]);
    const paint = new CanonicalRasterBrushStrokeV1({ color: [1, 0, 0] });
    const paintDabs = paint.beginConfirmed({ documentX: 64, documentY: 64 });
    store.applyDabs('layer', 'paint-stroke', paintDabs, 'paint');
    store.finalize('paint-stroke');
    const before = store.exportTiles()[0];
    expect(before).toBeDefined();
    const centerPixel = 64 * 128 + 64;
    expect(readBaselineRasterTilePixelV1(before!, centerPixel)).toEqual([1, 0, 0, 1]);

    const eraser = new CanonicalRasterBrushStrokeV1({ mode: 'eraser' });
    const eraseDabs = eraser.beginConfirmed({ documentX: 64, documentY: 64 });
    store.applyDabs('layer', 'erase-stroke', eraseDabs, 'erase');
    const patches = store.finalize('erase-stroke');
    const after = store.exportTiles()[0];
    expect(after).toBeDefined();
    expect(readBaselineRasterTilePixelV1(after!, centerPixel)[3]).toBe(0);
    expect(patches).toHaveLength(1);
    expect(readBaselineRasterTilePixelV1(patches[0]!.before!, centerPixel)).toEqual([1, 0, 0, 1]);
  });

  it('does not allocate a new canonical tile when erasing empty space', () => {
    const store = new BaselineRasterTileStoreV1(128, 128, 'rgba8-unorm', [
      { layerId: 'layer', visible: true, opacity: 1 },
    ]);
    const eraser = new CanonicalRasterBrushStrokeV1({ mode: 'eraser' });
    store.applyDabs(
      'layer',
      'empty-erase',
      eraser.beginConfirmed({ documentX: 64, documentY: 64 }),
      'erase',
    );
    expect(store.finalize('empty-erase')).toEqual([]);
    expect(store.exportTiles()).toEqual([]);
  });
});
