import { describe, expect, it } from 'vitest';
import {
  applyPreparedLayerInvertV1,
  invertStraightRgbaBytesV1,
  layerInvertEligibilityV1,
  prepareLayerInvertV1,
} from '../../src/app/layer-raster-invert.js';
import type { RasterMergePersistencePortV1 } from '../../src/app/layer-raster-merge.js';
import type {
  PaintDecodedRasterTileV1,
  PaintPersistedRasterTileV1,
  PaintRasterTilePixelFormatV1,
} from '../../src/app/paint-persistence-controller.js';
import type { PaintProjectSnapshotV1 } from '../../src/app/paint-session-controller.js';
import { createDocumentV1 } from '../../src/domain/document.js';
import { parseRevision } from '../../src/domain/identity.js';
import {
  createRasterLayer,
  createRasterTileReference,
  createVectorLayer,
} from '../../src/domain/layers.js';

class MemoryRasterPersistence implements RasterMergePersistencePortV1 {
  readonly tiles = new Map<string, PaintDecodedRasterTileV1>();
  readonly writes: PaintPersistedRasterTileV1[] = [];

  seed(input: {
    readonly payloadRef: string;
    readonly width: number;
    readonly height: number;
    readonly pixelFormat: PaintRasterTilePixelFormatV1;
    readonly bytes: Uint8Array;
  }): void {
    this.tiles.set(
      input.payloadRef,
      Object.freeze({
        schema: 'illustro.paint-decoded-raster-tile/1' as const,
        payloadRef: input.payloadRef,
        objectHash: input.payloadRef.replace('sha256:', ''),
        codec: 'raw' as const,
        pixelFormat: input.pixelFormat,
        width: input.width,
        height: input.height,
        bytes: new Uint8Array(input.bytes),
      }),
    );
  }

  async readRasterTile(payloadRef: string): Promise<PaintDecodedRasterTileV1> {
    const tile = this.tiles.get(payloadRef);
    if (tile === undefined) throw new Error(`missing tile ${payloadRef}`);
    return tile;
  }

  async persistRasterTile(input: {
    readonly width: number;
    readonly height: number;
    readonly pixelFormat: PaintRasterTilePixelFormatV1;
    readonly bytes: Uint8Array | ArrayBuffer;
  }): Promise<PaintPersistedRasterTileV1> {
    const index = this.writes.length + 1;
    const objectHash = index.toString(16).padStart(64, '0');
    const payloadRef = `sha256:${objectHash}`;
    const bytes =
      input.bytes instanceof Uint8Array
        ? new Uint8Array(input.bytes)
        : new Uint8Array(input.bytes.slice(0));
    this.tiles.set(
      payloadRef,
      Object.freeze({
        schema: 'illustro.paint-decoded-raster-tile/1' as const,
        payloadRef,
        objectHash,
        codec: 'raw' as const,
        pixelFormat: input.pixelFormat,
        width: input.width,
        height: input.height,
        bytes,
      }),
    );
    const persisted = Object.freeze({
      schema: 'illustro.paint-persisted-raster-tile/1' as const,
      payloadRef,
      objectHash,
      codec: 'raw' as const,
      pixelFormat: input.pixelFormat,
      width: input.width,
      height: input.height,
      rawByteLength: bytes.byteLength,
      encodedByteLength: bytes.byteLength,
    });
    this.writes.push(persisted);
    return persisted;
  }
}

function snapshotWith(
  layer: ReturnType<typeof createRasterLayer> | ReturnType<typeof createVectorLayer>,
  input: {
    readonly width?: number;
    readonly height?: number;
    readonly precision?: 'rgba8-unorm' | 'rgba16-float';
    readonly committedStrokes?: PaintProjectSnapshotV1['committedStrokes'];
  } = {},
): PaintProjectSnapshotV1 {
  const document = createDocumentV1({
    width: input.width ?? 2,
    height: input.height ?? 1,
    precision: input.precision ?? 'rgba8-unorm',
  });
  return Object.freeze({
    schema: 'illustro.paint-project-snapshot/1' as const,
    document: Object.freeze({
      ...document,
      layerTree: Object.freeze({
        rootLayerIds: Object.freeze([layer.id]),
        layers: Object.freeze({ [layer.id]: layer }),
      }),
    }),
    committedStrokes: input.committedStrokes ?? Object.freeze([]),
  });
}

function unbakedStroke(layerId: string): PaintProjectSnapshotV1['committedStrokes'][number] {
  return Object.freeze({
    stroke: Object.freeze({
      schema: 'illustro.paint-stroke/1' as const,
      strokeId: '11111111-1111-4111-8111-111111111111',
      pointerId: 1,
      source: 'pen' as const,
      layerId: layerId as never,
      samples: Object.freeze([]),
    }),
    dabs: Object.freeze([
      Object.freeze({
        schema: 'illustro.baseline-brush-dab/1' as const,
        x: 20,
        y: 20,
        radius: 8,
        radiusX: 8,
        radiusY: 8,
        opacity: 1,
      }),
    ]),
    bakedToRasterLayer: false,
  });
}

describe('M5B layer invert', () => {
  it('requires editable Raster Layer content', () => {
    const emptyRaster = createRasterLayer({ name: 'Empty' });
    const emptySnapshot = snapshotWith(emptyRaster);
    expect(layerInvertEligibilityV1(emptySnapshot, emptyRaster.id)).toMatchObject({
      eligible: false,
      reason: expect.stringContaining('requires raster content'),
    });

    const vector = createVectorLayer({ name: 'Vector' });
    expect(layerInvertEligibilityV1(snapshotWith(vector), vector.id)).toMatchObject({
      eligible: false,
      reason: expect.stringContaining('Raster Layer'),
    });

    const locked = createRasterLayer({
      name: 'Locked',
      locks: { pixels: true },
      tiles: [
        createRasterTileReference({
          x: 0,
          y: 0,
          payloadRef: `sha256:${'a'.repeat(64)}`,
        }),
      ],
    });
    expect(layerInvertEligibilityV1(snapshotWith(locked), locked.id)).toMatchObject({
      eligible: false,
      reason: expect.stringContaining('pixel lock'),
    });
  });

  it('inverts straight RGBA8 RGB while preserving alpha and layer properties', async () => {
    const payloadRef = `sha256:${'b'.repeat(64)}`;
    const raster = createRasterLayer({
      name: 'Paint',
      opacity: 0.75,
      locks: { alpha: true },
      roleFlags: { reference: true },
      tiles: [createRasterTileReference({ x: 0, y: 0, payloadRef })],
    });
    const snapshot = snapshotWith(raster);
    const persistence = new MemoryRasterPersistence();
    persistence.seed({
      payloadRef,
      width: 2,
      height: 1,
      pixelFormat: 'rgba8-unorm',
      bytes: new Uint8Array([10, 20, 30, 40, 250, 128, 0, 255]),
    });
    const prepared = await prepareLayerInvertV1(snapshot, raster.id, persistence);
    expect(prepared.tiles).toHaveLength(1);
    const resultRef = prepared.tiles[0]?.payloadRef;
    expect(resultRef).toBeDefined();
    const result = resultRef === undefined ? undefined : persistence.tiles.get(resultRef);
    expect(result === undefined ? [] : [...result.bytes]).toEqual([
      245, 235, 225, 40, 5, 127, 255, 255,
    ]);
    const after = applyPreparedLayerInvertV1(snapshot, prepared, parseRevision(1), new Date(0));
    const layer = after.document.layerTree.layers[raster.id];
    expect(layer).toMatchObject({
      id: raster.id,
      type: 'raster',
      revision: 1,
      opacity: 0.75,
      locks: { alpha: true },
      roleFlags: { reference: true },
    });
  });

  it('preserves RGBA16F alpha bits and supports 16F RGB inversion', () => {
    const bytes = new Uint8Array(8);
    const view = new DataView(bytes.buffer);
    view.setUint16(0, 0x3400, true);
    view.setUint16(2, 0x3800, true);
    view.setUint16(4, 0x3a00, true);
    view.setUint16(6, 0x3800, true);
    const inverted = invertStraightRgbaBytesV1(bytes, 'rgba16-float', 1, 1);
    const result = new DataView(inverted.buffer, inverted.byteOffset, inverted.byteLength);
    expect(result.getUint16(0, true)).toBe(0x3a00);
    expect(result.getUint16(2, true)).toBe(0x3800);
    expect(result.getUint16(4, true)).toBe(0x3400);
    expect(result.getUint16(6, true)).toBe(0x3800);
  });

  it('materializes unbaked stroke pixels before inversion and marks history as baked', async () => {
    const raster = createRasterLayer({ name: 'Stroke' });
    const snapshot = snapshotWith(raster, {
      width: 64,
      height: 64,
      committedStrokes: Object.freeze([unbakedStroke(raster.id)]),
    });
    expect(layerInvertEligibilityV1(snapshot, raster.id).eligible).toBe(true);
    const persistence = new MemoryRasterPersistence();
    const prepared = await prepareLayerInvertV1(snapshot, raster.id, persistence);
    expect(prepared.tiles).toHaveLength(1);
    const resultRef = prepared.tiles[0]?.payloadRef;
    const result = resultRef === undefined ? undefined : persistence.tiles.get(resultRef);
    expect(result).toBeDefined();
    const centerOffset = (20 * 64 + 20) * 4;
    expect(result?.bytes[centerOffset]).toBe(255);
    expect(result?.bytes[centerOffset + 1]).toBe(255);
    expect(result?.bytes[centerOffset + 2]).toBe(255);
    expect(result?.bytes[centerOffset + 3]).toBeGreaterThan(0);
    const after = applyPreparedLayerInvertV1(snapshot, prepared, parseRevision(1));
    expect(after.committedStrokes[0]?.bakedToRasterLayer).toBe(true);
  });
});
