import { describe, expect, it } from 'vitest';
import { hydratePaintRasterLayerDescriptorsV1 } from '../../src/app/raster-compositor-descriptors.js';
import { createDocumentV1 } from '../../src/domain/document.js';
import {
  createEffectNode,
  createRasterLayer,
  createRasterMask,
  createRasterTileReference,
} from '../../src/domain/layers.js';
import {
  BaselineRasterTileStoreV1,
  type BaselineRasterLayerDescriptorV1,
  type BaselineRasterMaskDescriptorV1,
  type BaselineRasterTileImageV1,
} from '../../src/gpu/baseline-raster-tile-store.js';

function rasterTile(
  layerId: string,
  width: number,
  height: number,
  rgba: readonly number[],
): BaselineRasterTileImageV1 {
  const bytes = new Uint8Array(width * height * 4);
  for (let pixel = 0; pixel < width * height; pixel += 1) bytes.set(rgba, pixel * 4);
  return Object.freeze({
    schema: 'illustro.baseline-raster-tile/1' as const,
    layerId,
    coordinate: Object.freeze({ tx: 0, ty: 0 }),
    width,
    height,
    pixelFormat: 'rgba8-unorm' as const,
    bytes,
  });
}

function maskDescriptor(
  bytes: readonly number[],
  options: Partial<BaselineRasterMaskDescriptorV1> = {},
): BaselineRasterMaskDescriptorV1 {
  const coverage = new Uint8Array(bytes.length * 4);
  bytes.forEach((value, pixel) => {
    coverage[pixel * 4] = value;
    coverage[pixel * 4 + 1] = value;
    coverage[pixel * 4 + 2] = value;
    coverage[pixel * 4 + 3] = 255;
  });
  return Object.freeze({
    maskId: 'mask-1',
    enabled: true,
    inverted: false,
    defaultCoverage: 1,
    effects: Object.freeze([]),
    tiles: Object.freeze([
      Object.freeze({
        coordinate: Object.freeze({ tx: 0, ty: 0 }),
        width: bytes.length,
        height: 1,
        bytes: coverage,
      }),
    ]),
    ...options,
  });
}

describe('M5C Raster Mask / clipping compositor integration', () => {
  it('multiplies canonical Raster Mask coverage into source alpha and supports inversion', () => {
    const source = rasterTile('paint', 2, 1, [255, 0, 0, 255]);
    const masked: BaselineRasterLayerDescriptorV1 = Object.freeze({
      layerId: 'paint',
      visible: true,
      opacity: 1,
      masks: Object.freeze([maskDescriptor([255, 0])]),
    });
    const store = new BaselineRasterTileStoreV1(2, 1, 'rgba8-unorm', [masked]);
    store.restore([source]);
    expect([...store.compositeTiles()[0]!.bytes]).toEqual([255, 0, 0, 255, 0, 0, 0, 0]);

    const invertedStore = new BaselineRasterTileStoreV1(2, 1, 'rgba8-unorm', [
      Object.freeze({
        ...masked,
        masks: Object.freeze([maskDescriptor([255, 0], { inverted: true })]),
      }),
    ]);
    invertedStore.restore([source]);
    expect([...invertedStore.compositeTiles()[0]!.bytes]).toEqual([0, 0, 0, 0, 255, 0, 0, 255]);
  });

  it('clips a Raster Layer to the effective alpha of its base layer', () => {
    const base: BaselineRasterTileImageV1 = Object.freeze({
      schema: 'illustro.baseline-raster-tile/1' as const,
      layerId: 'base',
      coordinate: Object.freeze({ tx: 0, ty: 0 }),
      width: 2,
      height: 1,
      pixelFormat: 'rgba8-unorm' as const,
      bytes: new Uint8Array([0, 0, 255, 255, 0, 0, 255, 0]),
    });
    const clipped = rasterTile('clipped', 2, 1, [0, 255, 0, 255]);
    const store = new BaselineRasterTileStoreV1(2, 1, 'rgba8-unorm', [
      { layerId: 'base', visible: true, opacity: 1 },
      { layerId: 'clipped', visible: true, opacity: 1, clippingBaseLayerId: 'base' },
    ]);
    store.restore([base, clipped]);
    expect([...store.compositeTiles()[0]!.bytes]).toEqual([0, 255, 0, 255, 0, 0, 0, 0]);
  });

  it('uses bounded binomial softening for non-destructive mask feather/blur', () => {
    const source = rasterTile('paint', 5, 1, [255, 255, 255, 255]);
    const mask = maskDescriptor([255, 255, 0, 0, 0], {
      effects: Object.freeze([{ kind: 'blur', radiusPx: 2 }]),
    });
    const store = new BaselineRasterTileStoreV1(5, 1, 'rgba8-unorm', [
      { layerId: 'paint', visible: true, opacity: 1, masks: [mask] },
    ]);
    store.restore([source]);
    const alpha = store.compositeTiles()[0]!.bytes[2 * 4 + 3] ?? 0;
    expect(alpha).toBeGreaterThan(0);
    expect(alpha).toBeLessThan(255);
  });

  it('hydrates Raster Mask payloads, affine transforms, effects and clipping without changing document storage', async () => {
    const tileRef = createRasterTileReference({ x: 0, y: 0, payloadRef: 'sha256:mask' });
    const feather = createEffectNode('mask.feather', { radiusPx: 4 });
    const mask = Object.freeze({
      ...createRasterMask({ tiles: [tileRef], effectStack: [feather] }),
      transformStack: Object.freeze([
        Object.freeze({
          id: '00000000-0000-4000-8000-000000000001' as never,
          revision: 0 as never,
          kind: 'affine' as const,
          parameters: Object.freeze({ matrix: [1, 0, 0, 1, 3, 0] }),
        }),
      ]),
    });
    const base = createRasterLayer({ name: 'Base' });
    const clipped = createRasterLayer({
      name: 'Clipped',
      masks: [mask],
      clipping: Object.freeze({ mode: 'alpha' as const, baseLayerId: base.id }),
    });
    const document = createDocumentV1({ width: 4, height: 1 });
    const withLayers = Object.freeze({
      ...document,
      layerTree: Object.freeze({
        rootLayerIds: Object.freeze([base.id, clipped.id]),
        layers: Object.freeze({ [base.id]: base, [clipped.id]: clipped }),
      }),
    });
    let reads = 0;
    const descriptors = await hydratePaintRasterLayerDescriptorsV1(withLayers, async () => {
      reads += 1;
      return Object.freeze({
        pixelFormat: 'rgba8-unorm' as const,
        width: 4,
        height: 1,
        bytes: new Uint8Array(16).fill(255),
      });
    });
    const hydrated = descriptors.find((entry) => entry.layerId === clipped.id);
    expect(reads).toBe(1);
    expect(hydrated?.clippingBaseLayerId).toBe(base.id);
    expect(hydrated?.masks?.[0]?.effects).toEqual([{ kind: 'feather', radiusPx: 4 }]);
    expect(hydrated?.masks?.[0]?.documentToMask).toEqual([1, 0, 0, 1, -3, 0]);
    expect(mask.tiles[0]?.payloadRef).toBe('sha256:mask');
  });
});
