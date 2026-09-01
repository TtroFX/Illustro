import { describe, expect, it } from 'vitest';
import { prepareLayerRasterFlipV1 } from '../../src/app/layer-raster-flip.js';
import type { RasterMergePersistencePortV1 } from '../../src/app/layer-raster-merge.js';
import type {
  PaintDecodedRasterTileV1,
  PaintPersistedRasterTileV1,
  PaintRasterTilePixelFormatV1,
} from '../../src/app/paint-persistence-controller.js';
import type { PaintProjectSnapshotV1 } from '../../src/app/paint-session-controller.js';
import { createDocumentV1 } from '../../src/domain/document.js';
import { createRasterLayer, createRasterTileReference } from '../../src/domain/layers.js';

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

function pixel(bytes: Uint8Array, width: number, x: number, y: number): number[] {
  const offset = (y * width + x) * 4;
  return [...bytes.slice(offset, offset + 4)];
}

describe('M5B layer vertical flip', () => {
  it('mirrors selected layer through partial sparse-tile bottom edges', async () => {
    const topRef = `sha256:${'e'.repeat(64)}`;
    const bottomRef = `sha256:${'f'.repeat(64)}`;
    const raster = createRasterLayer({
      name: 'Vertical',
      tiles: [
        createRasterTileReference({ x: 0, y: 0, payloadRef: topRef }),
        createRasterTileReference({ x: 0, y: 2, payloadRef: bottomRef }),
      ],
    });
    const document = createDocumentV1({ width: 1, height: 300 });
    const snapshot: PaintProjectSnapshotV1 = Object.freeze({
      schema: 'illustro.paint-project-snapshot/1' as const,
      document: Object.freeze({
        ...document,
        layerTree: Object.freeze({
          rootLayerIds: Object.freeze([raster.id]),
          layers: Object.freeze({ [raster.id]: raster }),
        }),
      }),
      committedStrokes: Object.freeze([]),
    });
    const persistence = new MemoryRasterPersistence();
    const top = new Uint8Array(128 * 4);
    top.set([10, 20, 30, 40], 0);
    top.set([50, 60, 70, 80], 127 * 4);
    const bottom = new Uint8Array(44 * 4);
    bottom.set([90, 100, 110, 120], 43 * 4);
    persistence.seed({
      payloadRef: topRef,
      width: 1,
      height: 128,
      pixelFormat: 'rgba8-unorm',
      bytes: top,
    });
    persistence.seed({
      payloadRef: bottomRef,
      width: 1,
      height: 44,
      pixelFormat: 'rgba8-unorm',
      bytes: bottom,
    });

    const prepared = await prepareLayerRasterFlipV1(snapshot, raster.id, 'vertical', persistence);
    expect(prepared.tiles.map(({ x, y }) => [x, y])).toEqual([
      [0, 0],
      [0, 1],
      [0, 2],
    ]);
    const output0 = persistence.tiles.get(prepared.tiles[0]?.payloadRef ?? '');
    const output1 = persistence.tiles.get(prepared.tiles[1]?.payloadRef ?? '');
    const output2 = persistence.tiles.get(prepared.tiles[2]?.payloadRef ?? '');
    expect(output0).toBeDefined();
    expect(output1).toBeDefined();
    expect(output2).toBeDefined();
    if (output0 === undefined || output1 === undefined || output2 === undefined) return;
    expect(pixel(output0.bytes, 1, 0, 0)).toEqual([90, 100, 110, 120]);
    expect(pixel(output1.bytes, 1, 0, 44)).toEqual([50, 60, 70, 80]);
    expect(pixel(output2.bytes, 1, 0, 43)).toEqual([10, 20, 30, 40]);
  });
});
