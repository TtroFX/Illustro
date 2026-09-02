import { describe, expect, it } from 'vitest';
import {
  BaselineBrushDabBuilderV1,
  type BaselineBrushDabV1,
} from '../../src/gpu/baseline-brush.js';
import { BaselineRasterTileStoreV1 } from '../../src/gpu/baseline-raster-tile-store.js';

describe('M5D baseline paint color integration', () => {
  it('captures the chosen encoded RGB color in every new dab', () => {
    const builder = new BaselineBrushDabBuilderV1({ color: [1, 0.25, 0] });
    builder.begin({ documentX: 8, documentY: 8 });
    expect(builder.dabs()[0]?.color).toEqual([1, 0.25, 0]);
  });

  it('writes colored straight-alpha pixels into canonical raster tiles', () => {
    const store = new BaselineRasterTileStoreV1(32, 32, 'rgba8-unorm', [
      { layerId: 'paint', visible: true, opacity: 1 },
    ]);
    const dab: BaselineBrushDabV1 = Object.freeze({
      schema: 'illustro.baseline-brush-dab/1',
      x: 16,
      y: 16,
      radius: 8,
      opacity: 1,
      color: Object.freeze([1, 0, 0]),
    });
    store.applyDabs('paint', 'red', [dab]);
    store.finalize('red');
    const tile = store.exportTiles()[0];
    const offset = (16 * 32 + 16) * 4;
    expect(tile?.bytes[offset]).toBe(255);
    expect(tile?.bytes[offset + 1]).toBe(0);
    expect(tile?.bytes[offset + 2]).toBe(0);
    expect(tile?.bytes[offset + 3]).toBe(255);
  });

  it('keeps legacy colorless dabs black for recovery compatibility', () => {
    const store = new BaselineRasterTileStoreV1(32, 32, 'rgba8-unorm', [
      { layerId: 'paint', visible: true, opacity: 1 },
    ]);
    const legacy: BaselineBrushDabV1 = Object.freeze({
      schema: 'illustro.baseline-brush-dab/1',
      x: 16,
      y: 16,
      radius: 8,
      opacity: 1,
    });
    store.applyDabs('paint', 'legacy', [legacy]);
    store.finalize('legacy');
    const tile = store.exportTiles()[0];
    const offset = (16 * 32 + 16) * 4;
    expect([...(tile?.bytes.slice(offset, offset + 4) ?? [])]).toEqual([0, 0, 0, 255]);
  });
});
