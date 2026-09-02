import { describe, expect, it } from 'vitest';
import {
  BaselineRasterTileStoreV1,
  type BaselineRasterTileImageV1,
} from '../../src/gpu/baseline-raster-tile-store.js';

function pixelTile(
  layerId: string,
  rgba: readonly [number, number, number, number],
): BaselineRasterTileImageV1 {
  return Object.freeze({
    schema: 'illustro.baseline-raster-tile/1' as const,
    layerId,
    coordinate: Object.freeze({ tx: 0, ty: 0 }),
    width: 1,
    height: 1,
    pixelFormat: 'rgba8-unorm' as const,
    bytes: new Uint8Array(rgba),
  });
}

describe('M5C baseline tile compositor integration', () => {
  it('composites canonical raster layers with the configured blend mode', () => {
    const store = new BaselineRasterTileStoreV1(1, 1, 'rgba8-unorm', [
      { layerId: 'bottom', visible: true, opacity: 1 },
      { layerId: 'top', visible: true, opacity: 1, blendMode: 'multiply' },
    ]);
    store.restore([
      pixelTile('bottom', [128, 128, 128, 255]),
      pixelTile('top', [128, 128, 128, 255]),
    ]);

    expect([...store.compositeTiles()[0]!.bytes]).toEqual([64, 64, 64, 255]);
  });

  it('invalidates cached composites when blend configuration changes', () => {
    const store = new BaselineRasterTileStoreV1(1, 1, 'rgba8-unorm', [
      { layerId: 'bottom', visible: true, opacity: 1 },
      { layerId: 'top', visible: true, opacity: 1, blendMode: 'multiply' },
    ]);
    store.restore([
      pixelTile('bottom', [128, 128, 128, 255]),
      pixelTile('top', [128, 128, 128, 255]),
    ]);
    expect([...store.compositeTiles()[0]!.bytes]).toEqual([64, 64, 64, 255]);

    store.setLayers([
      { layerId: 'bottom', visible: true, opacity: 1 },
      { layerId: 'top', visible: true, opacity: 1, blendMode: 'screen' },
    ]);
    expect([...store.compositeTiles()[0]!.bytes]).toEqual([192, 192, 192, 255]);

    store.setLayers([
      { layerId: 'bottom', visible: true, opacity: 1 },
      { layerId: 'top', visible: true, opacity: 1, blendMode: 'hard-mix' },
    ]);
    expect([...store.compositeTiles()[0]!.bytes]).toEqual([255, 255, 255, 255]);
  });
});
