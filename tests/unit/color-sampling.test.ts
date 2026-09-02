import { describe, expect, it } from 'vitest';
import {
  ColorSamplingOwnershipV1,
  createRasterTileSamplingIndexV1,
  sampleActiveLayerColorV1,
  sampleMergedCanvasColorV1,
} from '../../src/app/color-sampling.js';
import { rgbUnitToBytesV1 } from '../../src/domain/color.js';
import type { BaselineRasterTileImageV1 } from '../../src/gpu/baseline-raster-tile-store.js';
import type { PointerInputBatchV1 } from '../../src/input/pointer-input.js';

function rgba8Tile(
  layerId: string,
  tx: number,
  ty: number,
  rgba: readonly [number, number, number, number],
): BaselineRasterTileImageV1 {
  return Object.freeze({
    schema: 'illustro.baseline-raster-tile/1' as const,
    layerId,
    coordinate: Object.freeze({ tx, ty }),
    width: 1,
    height: 1,
    pixelFormat: 'rgba8-unorm' as const,
    bytes: new Uint8Array(rgba),
  });
}

function rgba16Tile(layerId: string): BaselineRasterTileImageV1 {
  const bytes = new Uint8Array(8);
  const view = new DataView(bytes.buffer);
  view.setUint16(0, 0x3800, true); // 0.5
  view.setUint16(2, 0x3400, true); // 0.25
  view.setUint16(4, 0x3c00, true); // 1.0
  view.setUint16(6, 0x3c00, true); // alpha 1.0
  return Object.freeze({
    schema: 'illustro.baseline-raster-tile/1' as const,
    layerId,
    coordinate: Object.freeze({ tx: 0, ty: 0 }),
    width: 1,
    height: 1,
    pixelFormat: 'rgba16-float' as const,
    bytes,
  });
}

function batch(eventType: PointerInputBatchV1['eventType'], pointerId = 7): PointerInputBatchV1 {
  return Object.freeze({
    schema: 'illustro.pointer-batch/1' as const,
    eventType,
    pointerId,
    confirmed: Object.freeze([]),
    predicted: Object.freeze([]),
  });
}

describe('M5D eyedropper sampling', () => {
  it('samples only the requested active layer and preserves encoded RGB components', () => {
    const index = createRasterTileSamplingIndexV1(
      [rgba8Tile('other', 0, 0, [255, 0, 0, 255]), rgba8Tile('active', 0, 0, [12, 130, 240, 255])],
      'active',
    );
    expect(rgbUnitToBytesV1(sampleActiveLayerColorV1(index, 0.25, 0.75)!)).toEqual([12, 130, 240]);
  });

  it('returns no active-layer color for transparent pixels', () => {
    const index = createRasterTileSamplingIndexV1(
      [rgba8Tile('active', 0, 0, [200, 10, 40, 0])],
      'active',
    );
    expect(sampleActiveLayerColorV1(index, 0, 0)).toBeNull();
  });

  it('decodes rgba16-float tiles through the canonical raster pixel reader', () => {
    const index = createRasterTileSamplingIndexV1([rgba16Tile('active')], 'active');
    const color = sampleActiveLayerColorV1(index, 0, 0);
    expect(color).not.toBeNull();
    expect(color?.[0]).toBeCloseTo(0.5, 4);
    expect(color?.[1]).toBeCloseTo(0.25, 4);
    expect(color?.[2]).toBeCloseTo(1, 4);
  });

  it('samples merged pixels over the canonical solid canvas background', () => {
    const index = createRasterTileSamplingIndexV1([
      rgba8Tile('__composite__', 0, 0, [255, 0, 0, 128]),
    ]);
    const color = sampleMergedCanvasColorV1(index, 0, 0, {
      kind: 'solid',
      rgba: [0, 0, 1, 1],
    });
    expect(color).not.toBeNull();
    expect(color?.[0]).toBeCloseTo(128 / 255, 3);
    expect(color?.[1]).toBeCloseTo(0, 3);
    expect(color?.[2]).toBeCloseTo(127 / 255, 3);
  });

  it('keeps a quick-eyedropper pointer transaction owned until up', () => {
    const ownership = new ColorSamplingOwnershipV1();
    expect(ownership.route(batch('pointerdown')).consumed).toBe(false);
    ownership.setQuickEnabled(true);
    expect(ownership.route(batch('pointerdown'))).toMatchObject({
      consumed: true,
      shouldSample: true,
    });
    ownership.setQuickEnabled(false);
    expect(ownership.route(batch('pointermove'))).toMatchObject({
      consumed: true,
      shouldSample: true,
    });
    expect(ownership.route(batch('pointerup'))).toMatchObject({ consumed: true, finalize: true });
    expect(ownership.snapshot().ownedPointerCount).toBe(0);
  });

  it('reports cancellation so second-touch arbitration can abort sampling atomically', () => {
    const ownership = new ColorSamplingOwnershipV1();
    ownership.setExplicitEnabled(true);
    ownership.route(batch('pointerdown', 3));
    expect(ownership.route(batch('pointercancel', 3))).toMatchObject({
      consumed: true,
      shouldSample: false,
      finalize: false,
      cancel: true,
    });
  });
});
