import { describe, expect, it } from 'vitest';
import {
  applyPreparedLayerRasterFlipV1,
  layerRasterFlipEligibilityV1,
  prepareLayerRasterFlipV1,
} from '../../src/app/layer-raster-flip.js';
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
      strokeId: '22222222-2222-4222-8222-222222222222',
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
        radius: 5,
        radiusX: 5,
        radiusY: 5,
        opacity: 1,
      }),
    ]),
    bakedToRasterLayer: false,
  });
}

function pixel(bytes: Uint8Array, width: number, x: number, y = 0): number[] {
  const offset = (y * width + x) * 4;
  return [...bytes.slice(offset, offset + 4)];
}

describe('M5B layer horizontal flip', () => {
  it('requires editable Raster Layer content and respects position lock', () => {
    const emptyRaster = createRasterLayer({ name: 'Empty' });
    expect(layerRasterFlipEligibilityV1(snapshotWith(emptyRaster), emptyRaster.id)).toMatchObject({
      eligible: false,
      reason: expect.stringContaining('requires raster content'),
    });

    const vector = createVectorLayer({ name: 'Vector' });
    expect(layerRasterFlipEligibilityV1(snapshotWith(vector), vector.id)).toMatchObject({
      eligible: false,
      reason: expect.stringContaining('Raster Layer'),
    });

    const locked = createRasterLayer({
      name: 'Locked',
      locks: { position: true },
      tiles: [
        createRasterTileReference({
          x: 0,
          y: 0,
          payloadRef: `sha256:${'a'.repeat(64)}`,
        }),
      ],
    });
    expect(layerRasterFlipEligibilityV1(snapshotWith(locked), locked.id)).toMatchObject({
      eligible: false,
      reason: expect.stringContaining('position lock'),
    });
  });

  it('mirrors selected RGBA8 layer across document width through partial sparse-tile edges', async () => {
    const leftRef = `sha256:${'b'.repeat(64)}`;
    const rightRef = `sha256:${'c'.repeat(64)}`;
    const raster = createRasterLayer({
      name: 'Paint',
      opacity: 0.75,
      locks: { alpha: true },
      roleFlags: { reference: true },
      tiles: [
        createRasterTileReference({ x: 0, y: 0, payloadRef: leftRef }),
        createRasterTileReference({ x: 2, y: 0, payloadRef: rightRef }),
      ],
    });
    const snapshot = snapshotWith(raster, { width: 300, height: 1 });
    const persistence = new MemoryRasterPersistence();
    const left = new Uint8Array(128 * 4);
    left.set([10, 20, 30, 40], 0);
    left.set([50, 60, 70, 80], 127 * 4);
    const right = new Uint8Array(44 * 4);
    right.set([90, 100, 110, 120], 43 * 4);
    persistence.seed({
      payloadRef: leftRef,
      width: 128,
      height: 1,
      pixelFormat: 'rgba8-unorm',
      bytes: left,
    });
    persistence.seed({
      payloadRef: rightRef,
      width: 44,
      height: 1,
      pixelFormat: 'rgba8-unorm',
      bytes: right,
    });

    const prepared = await prepareLayerRasterFlipV1(snapshot, raster.id, 'horizontal', persistence);
    expect(prepared.tiles.map(({ x, y }) => [x, y])).toEqual([
      [0, 0],
      [1, 0],
      [2, 0],
    ]);
    const output0 = persistence.tiles.get(prepared.tiles[0]?.payloadRef ?? '');
    const output1 = persistence.tiles.get(prepared.tiles[1]?.payloadRef ?? '');
    const output2 = persistence.tiles.get(prepared.tiles[2]?.payloadRef ?? '');
    expect(output0).toBeDefined();
    expect(output1).toBeDefined();
    expect(output2).toBeDefined();
    if (output0 === undefined || output1 === undefined || output2 === undefined) return;
    expect(pixel(output0.bytes, 128, 0)).toEqual([90, 100, 110, 120]);
    expect(pixel(output1.bytes, 128, 44)).toEqual([50, 60, 70, 80]);
    expect(pixel(output2.bytes, 44, 43)).toEqual([10, 20, 30, 40]);

    const after = applyPreparedLayerRasterFlipV1(snapshot, prepared, parseRevision(1), new Date(0));
    expect(after.document.layerTree.layers[raster.id]).toMatchObject({
      id: raster.id,
      type: 'raster',
      revision: 1,
      opacity: 0.75,
      locks: { alpha: true },
      roleFlags: { reference: true },
    });
  });

  it('moves RGBA16F pixels byte-exactly without color conversion', async () => {
    const payloadRef = `sha256:${'d'.repeat(64)}`;
    const raster = createRasterLayer({
      name: '16F',
      tiles: [createRasterTileReference({ x: 0, y: 0, payloadRef })],
    });
    const snapshot = snapshotWith(raster, {
      width: 2,
      height: 1,
      precision: 'rgba16-float',
    });
    const persistence = new MemoryRasterPersistence();
    const first = [1, 2, 3, 4, 5, 6, 7, 8];
    const second = [9, 10, 11, 12, 13, 14, 15, 16];
    persistence.seed({
      payloadRef,
      width: 2,
      height: 1,
      pixelFormat: 'rgba16-float',
      bytes: new Uint8Array([...first, ...second]),
    });
    const prepared = await prepareLayerRasterFlipV1(snapshot, raster.id, 'horizontal', persistence);
    const output = persistence.tiles.get(prepared.tiles[0]?.payloadRef ?? '');
    expect(output === undefined ? [] : [...output.bytes]).toEqual([...second, ...first]);
  });

  it('materializes pending stroke pixels before the flip and marks history as baked', async () => {
    const raster = createRasterLayer({ name: 'Stroke' });
    const snapshot = snapshotWith(raster, {
      width: 64,
      height: 64,
      committedStrokes: Object.freeze([unbakedStroke(raster.id)]),
    });
    const persistence = new MemoryRasterPersistence();
    const prepared = await prepareLayerRasterFlipV1(snapshot, raster.id, 'horizontal', persistence);
    expect(prepared.tiles).toHaveLength(1);
    const output = persistence.tiles.get(prepared.tiles[0]?.payloadRef ?? '');
    expect(output).toBeDefined();
    if (output === undefined) return;
    const mirroredCenter = pixel(output.bytes, 64, 43, 20);
    expect(mirroredCenter[3]).toBeGreaterThan(0);
    const after = applyPreparedLayerRasterFlipV1(snapshot, prepared, parseRevision(1));
    expect(after.committedStrokes[0]?.bakedToRasterLayer).toBe(true);
  });
});
