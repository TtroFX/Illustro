import { describe, expect, it } from 'vitest';
import { parseRevision } from '../../src/domain/identity.js';
import type {
  PaintDecodedRasterTileV1,
  PaintPersistedRasterTileV1,
} from '../../src/app/paint-persistence-controller.js';
import {
  applyPreparedSelectionModeV1,
  prepareCombinedSelectionCoverageV1,
  type SelectionCoverageStoragePortV1,
} from '../../src/app/selection-combine-engine.js';
import {
  rasterSelectionCoverageFromPreparedV1,
  SelectionCoverageControllerV1,
} from '../../src/app/selection-coverage-controller.js';
import {
  createArraySelectionPixelSourceV1,
  prepareColorRangeSelectionAtPointV1,
  prepareMagicWandSelectionV1,
  selectionColorDistanceV1,
  type SelectionRgbaV1,
} from '../../src/app/selection-region-engine.js';
import {
  prepareRectangularSelectionV1,
  type PreparedSelectionCoverageV1,
} from '../../src/app/selection-shape-engine.js';

interface MemoryTileV1 {
  readonly payloadRef: string;
  readonly objectHash: string;
  readonly width: number;
  readonly height: number;
  readonly bytes: Uint8Array<ArrayBuffer>;
}

function memorySelectionStorageV1(): SelectionCoverageStoragePortV1 {
  const tiles = new Map<string, MemoryTileV1>();
  let sequence = 1;
  return {
    async persistRasterTile(input): Promise<PaintPersistedRasterTileV1> {
      const bytes =
        input.bytes instanceof Uint8Array
          ? new Uint8Array(input.bytes)
          : new Uint8Array(input.bytes.slice(0));
      const objectHash = sequence.toString(16).padStart(64, '0');
      sequence += 1;
      const payloadRef = `sha256:${objectHash}`;
      tiles.set(
        payloadRef,
        Object.freeze({
          payloadRef,
          objectHash,
          width: input.width,
          height: input.height,
          bytes,
        }),
      );
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
      if (tile === undefined) throw new Error(`missing memory selection tile: ${payloadRef}`);
      return Object.freeze({
        schema: 'illustro.paint-decoded-raster-tile/1' as const,
        payloadRef: tile.payloadRef,
        objectHash: tile.objectHash,
        codec: 'raw' as const,
        pixelFormat: 'rgba8-unorm' as const,
        width: tile.width,
        height: tile.height,
        bytes: new Uint8Array(tile.bytes),
      });
    },
  };
}

async function coverageAtV1(
  prepared: PreparedSelectionCoverageV1,
  x: number,
  y: number,
  storage: SelectionCoverageStoragePortV1,
): Promise<number> {
  const tx = Math.floor(x / 128);
  const ty = Math.floor(y / 128);
  const reference = prepared.tiles.find((tile) => tile.x === tx && tile.y === ty);
  if (reference === undefined) return prepared.defaultCoverage === 1 ? 255 : 0;
  const tile = await storage.readRasterTile(reference.payloadRef);
  const localX = x - tx * 128;
  const localY = y - ty * 128;
  return tile.bytes[(localY * tile.width + localX) * 4] ?? 0;
}

function colorGridV1(rows: readonly (readonly SelectionRgbaV1[])[]) {
  const width = rows[0]?.length ?? 0;
  return createArraySelectionPixelSourceV1({
    width,
    height: rows.length,
    rgba: rows.flat(),
  });
}

const RED = Object.freeze([1, 0, 0, 1]) as SelectionRgbaV1;
const BLUE = Object.freeze([0, 0, 1, 1]) as SelectionRgbaV1;
const CLEAR = Object.freeze([0, 0, 0, 0]) as SelectionRgbaV1;

describe('M7A region selection engine', () => {
  it('Magic Wand selects only the connected matching region', async () => {
    const source = colorGridV1([
      [RED, RED, BLUE, RED, RED],
      [RED, BLUE, BLUE, BLUE, RED],
      [RED, RED, BLUE, RED, RED],
    ]);
    const storage = memorySelectionStorageV1();
    const prepared = await prepareMagicWandSelectionV1(source, { x: 0, y: 0 }, 0, {
      revision: parseRevision(10),
      persistence: storage,
    });
    expect(await coverageAtV1(prepared, 0, 0, storage)).toBe(255);
    expect(await coverageAtV1(prepared, 1, 2, storage)).toBe(255);
    expect(await coverageAtV1(prepared, 3, 0, storage)).toBe(0);
    expect(await coverageAtV1(prepared, 4, 2, storage)).toBe(0);
  });

  it('Color Range selects disconnected pixels matching the sampled color', async () => {
    const source = colorGridV1([
      [RED, RED, BLUE, RED, RED],
      [RED, BLUE, BLUE, BLUE, RED],
      [RED, RED, BLUE, RED, RED],
    ]);
    const storage = memorySelectionStorageV1();
    const prepared = await prepareColorRangeSelectionAtPointV1(source, { x: 0, y: 0 }, 0, {
      revision: parseRevision(11),
      persistence: storage,
    });
    expect(await coverageAtV1(prepared, 0, 0, storage)).toBe(255);
    expect(await coverageAtV1(prepared, 3, 0, storage)).toBe(255);
    expect(await coverageAtV1(prepared, 2, 1, storage)).toBe(0);
  });

  it('uses defaultCoverage=1 for dense selections so an all-selected canvas stores no tiles', async () => {
    const source = colorGridV1([
      [CLEAR, CLEAR, CLEAR],
      [CLEAR, CLEAR, CLEAR],
    ]);
    const storage = memorySelectionStorageV1();
    const prepared = await prepareMagicWandSelectionV1(source, { x: 1, y: 1 }, 0, {
      revision: parseRevision(12),
      persistence: storage,
    });
    expect(prepared.defaultCoverage).toBe(1);
    expect(prepared.tiles).toHaveLength(0);
  });

  it('compares transparent colors in premultiplied space so hidden RGB does not split transparency', () => {
    expect(selectionColorDistanceV1([1, 0, 0, 0], [0, 1, 1, 0])).toBe(0);
    expect(selectionColorDistanceV1(RED, BLUE)).toBeGreaterThan(0.5);
  });
});

describe('M7A selection combine modes', () => {
  async function overlappingSelections() {
    const storage = memorySelectionStorageV1();
    const existingPrepared = await prepareRectangularSelectionV1(
      { x: 0, y: 0 },
      { x: 4, y: 4 },
      {
        documentWidth: 8,
        documentHeight: 8,
        revision: parseRevision(20),
        persistence: storage,
      },
    );
    const incoming = await prepareRectangularSelectionV1(
      { x: 2, y: 0 },
      { x: 6, y: 4 },
      {
        documentWidth: 8,
        documentHeight: 8,
        revision: parseRevision(21),
        persistence: storage,
      },
    );
    return {
      storage,
      existing: rasterSelectionCoverageFromPreparedV1(existingPrepared),
      incoming,
    };
  }

  it('Replace mode discards the previous selection', async () => {
    const { storage, existing, incoming } = await overlappingSelections();
    const prepared = await prepareCombinedSelectionCoverageV1(existing, incoming, 'replace', {
      documentWidth: 8,
      documentHeight: 8,
      revision: parseRevision(22),
      storage,
    });
    expect(await coverageAtV1(prepared, 1, 1, storage)).toBe(0);
    expect(await coverageAtV1(prepared, 5, 1, storage)).toBe(255);
  });

  it('Add mode forms the union using max coverage', async () => {
    const { storage, existing, incoming } = await overlappingSelections();
    const prepared = await prepareCombinedSelectionCoverageV1(existing, incoming, 'add', {
      documentWidth: 8,
      documentHeight: 8,
      revision: parseRevision(23),
      storage,
    });
    expect(await coverageAtV1(prepared, 1, 1, storage)).toBe(255);
    expect(await coverageAtV1(prepared, 5, 1, storage)).toBe(255);
    expect(await coverageAtV1(prepared, 7, 7, storage)).toBe(0);
  });

  it('Subtract mode removes incoming coverage multiplicatively', async () => {
    const { storage, existing, incoming } = await overlappingSelections();
    const prepared = await prepareCombinedSelectionCoverageV1(existing, incoming, 'subtract', {
      documentWidth: 8,
      documentHeight: 8,
      revision: parseRevision(24),
      storage,
    });
    expect(await coverageAtV1(prepared, 1, 1, storage)).toBe(255);
    expect(await coverageAtV1(prepared, 3, 1, storage)).toBe(0);
    expect(await coverageAtV1(prepared, 5, 1, storage)).toBe(0);
  });

  it('Intersect mode keeps only shared coverage', async () => {
    const { storage, existing, incoming } = await overlappingSelections();
    const prepared = await prepareCombinedSelectionCoverageV1(existing, incoming, 'intersect', {
      documentWidth: 8,
      documentHeight: 8,
      revision: parseRevision(25),
      storage,
    });
    expect(await coverageAtV1(prepared, 1, 1, storage)).toBe(0);
    expect(await coverageAtV1(prepared, 3, 1, storage)).toBe(255);
    expect(await coverageAtV1(prepared, 5, 1, storage)).toBe(0);
  });

  it('applies a prepared mode directly to the production selection controller', async () => {
    const { storage, existing, incoming } = await overlappingSelections();
    const controller = new SelectionCoverageControllerV1();
    controller.replace(existing);
    const snapshot = await applyPreparedSelectionModeV1(controller, incoming, 'intersect', {
      documentWidth: 8,
      documentHeight: 8,
      revision: parseRevision(26),
      storage,
    });
    expect(snapshot.coverage?.tiles.length).toBeGreaterThan(0);
    expect(snapshot.coverage?.inverted).toBe(false);
  });
});
