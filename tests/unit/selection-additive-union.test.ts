import { describe, expect, it } from 'vitest';
import { parseRevision } from '../../src/domain/identity.js';
import type {
  PaintDecodedRasterTileV1,
  PaintPersistedRasterTileV1,
} from '../../src/app/paint-persistence-controller.js';
import {
  applyPreparedSelectionModeV1,
  type SelectionCoverageStoragePortV1,
} from '../../src/app/selection-combine-engine.js';
import {
  rasterSelectionCoverageFromPreparedV1,
  SelectionCoverageControllerV1,
} from '../../src/app/selection-coverage-controller.js';
import { prepareRectangularSelectionV1 } from '../../src/app/selection-shape-engine.js';

interface MemoryTileV1 {
  readonly payloadRef: string;
  readonly objectHash: string;
  readonly width: number;
  readonly height: number;
  readonly bytes: Uint8Array<ArrayBuffer>;
}

function memoryStorageV1(): {
  readonly storage: SelectionCoverageStoragePortV1;
  persistCount(): number;
} {
  const tiles = new Map<string, MemoryTileV1>();
  let sequence = 1;
  let persists = 0;
  const storage: SelectionCoverageStoragePortV1 = {
    async persistRasterTile(input): Promise<PaintPersistedRasterTileV1> {
      persists += 1;
      const bytes =
        input.bytes instanceof Uint8Array
          ? new Uint8Array(input.bytes)
          : new Uint8Array(input.bytes.slice(0));
      const objectHash = sequence.toString(16).padStart(64, '0');
      sequence += 1;
      const payloadRef = `sha256:${objectHash}`;
      tiles.set(payloadRef, {
        payloadRef,
        objectHash,
        width: input.width,
        height: input.height,
        bytes,
      });
      return Object.freeze({
        schema: 'illustro.paint-persisted-raster-tile/1' as const,
        payloadRef,
        objectHash,
        codec: 'raw' as const,
        pixelFormat: 'rgba8-unorm' as const,
        width: input.width,
        height: input.height,
        rawByteLength: bytes.byteLength,
        encodedByteLength: bytes.byteLength,
      });
    },
    async readRasterTile(payloadRef: string): Promise<PaintDecodedRasterTileV1> {
      const tile = tiles.get(payloadRef);
      if (!tile) throw new Error(`missing tile: ${payloadRef}`);
      return Object.freeze({
        schema: 'illustro.paint-decoded-raster-tile/1' as const,
        payloadRef,
        objectHash: tile.objectHash,
        codec: 'raw' as const,
        pixelFormat: 'rgba8-unorm' as const,
        width: tile.width,
        height: tile.height,
        bytes: new Uint8Array(tile.bytes),
      });
    },
  };
  return { storage, persistCount: () => persists };
}

describe('M7A additive selection union', () => {
  it('does not create a nested selection boundary when the incoming selection is fully contained', async () => {
    const revision = parseRevision(40);
    const memory = memoryStorageV1();
    const existingPrepared = await prepareRectangularSelectionV1(
      { x: 8, y: 8 },
      { x: 56, y: 56 },
      {
        documentWidth: 64,
        documentHeight: 64,
        revision,
        persistence: memory.storage,
      },
    );
    const incoming = await prepareRectangularSelectionV1(
      { x: 20, y: 20 },
      { x: 40, y: 40 },
      {
        documentWidth: 64,
        documentHeight: 64,
        revision,
        persistence: memory.storage,
      },
    );

    const controller = new SelectionCoverageControllerV1();
    controller.replace(rasterSelectionCoverageFromPreparedV1(existingPrepared));
    let publishes = 0;
    const unsubscribe = controller.subscribe(() => {
      publishes += 1;
    });
    publishes = 0;
    const beforePersistCount = memory.persistCount();

    const result = await applyPreparedSelectionModeV1(controller, incoming, 'add', {
      documentWidth: 64,
      documentHeight: 64,
      revision,
      storage: memory.storage,
    });

    expect(result.coverage?.tiles.map((tile) => tile.payloadRef)).toEqual(
      existingPrepared.tiles.map((tile) => tile.payloadRef),
    );
    expect(memory.persistCount()).toBe(beforePersistCount);
    expect(publishes).toBe(0);
    unsubscribe();
  });
});
