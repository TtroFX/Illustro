import { describe, expect, it } from 'vitest';
import { parseRevision } from '../../src/domain/identity.js';
import type {
  PaintDecodedRasterTileV1,
  PaintPersistedRasterTileV1,
} from '../../src/app/paint-persistence-controller.js';
import {
  deselectSelectionV1,
  invertSelectionV1,
  prepareContractedSelectionCoverageV1,
  prepareExpandedSelectionCoverageV1,
  prepareFeatheredSelectionCoverageV1,
  type SelectionModifierStoragePortV1,
} from '../../src/app/selection-modifier-engine.js';
import {
  rasterSelectionCoverageFromPreparedV1,
  SelectionCoverageControllerV1,
} from '../../src/app/selection-coverage-controller.js';
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

function memorySelectionStorageV1(): SelectionModifierStoragePortV1 {
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
  storage: SelectionModifierStoragePortV1,
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

async function rectangleFixtureV1() {
  const storage = memorySelectionStorageV1();
  const prepared = await prepareRectangularSelectionV1(
    { x: 2, y: 2 },
    { x: 6, y: 6 },
    {
      documentWidth: 8,
      documentHeight: 8,
      revision: parseRevision(30),
      persistence: storage,
    },
  );
  return {
    storage,
    prepared,
    coverage: rasterSelectionCoverageFromPreparedV1(prepared),
  };
}

describe('M7A selection state modifiers', () => {
  it('deselect clears the active selection coverage', async () => {
    const { coverage } = await rectangleFixtureV1();
    const controller = new SelectionCoverageControllerV1();
    controller.replace(coverage);
    expect(controller.snapshot().coverage).not.toBeNull();
    expect(deselectSelectionV1(controller).coverage).toBeNull();
  });

  it('invert is sparse and toggles the canonical inverted flag without rewriting tiles', async () => {
    const { coverage } = await rectangleFixtureV1();
    const controller = new SelectionCoverageControllerV1();
    controller.replace(coverage);
    const beforeRefs = controller.snapshot().coverage?.tiles.map((tile) => tile.payloadRef);
    const inverted = invertSelectionV1(controller, parseRevision(31));
    expect(inverted.coverage?.inverted).toBe(true);
    expect(inverted.coverage?.sourceRevision).toBe(parseRevision(31));
    expect(inverted.coverage?.tiles.map((tile) => tile.payloadRef)).toEqual(beforeRefs);
    const restored = invertSelectionV1(controller, parseRevision(32));
    expect(restored.coverage?.inverted).toBe(false);
  });

  it('invert requires an active selection rather than treating no-selection as an empty mask', () => {
    const controller = new SelectionCoverageControllerV1();
    expect(() => invertSelectionV1(controller, parseRevision(33))).toThrow(/active selection/);
  });
});

describe('M7A selection morphology', () => {
  it('expand grows hard coverage by the requested radius', async () => {
    const { storage, coverage } = await rectangleFixtureV1();
    const expanded = await prepareExpandedSelectionCoverageV1(coverage, 1, {
      documentWidth: 8,
      documentHeight: 8,
      revision: parseRevision(34),
      storage,
    });
    expect(await coverageAtV1(expanded, 1, 3, storage)).toBe(255);
    expect(await coverageAtV1(expanded, 6, 3, storage)).toBe(255);
    expect(await coverageAtV1(expanded, 0, 3, storage)).toBe(0);
    expect(await coverageAtV1(expanded, 7, 7, storage)).toBe(0);
  });

  it('contract shrinks hard coverage by the requested radius', async () => {
    const { storage, coverage } = await rectangleFixtureV1();
    const contracted = await prepareContractedSelectionCoverageV1(coverage, 1, {
      documentWidth: 8,
      documentHeight: 8,
      revision: parseRevision(35),
      storage,
    });
    expect(await coverageAtV1(contracted, 2, 3, storage)).toBe(0);
    expect(await coverageAtV1(contracted, 3, 3, storage)).toBe(255);
    expect(await coverageAtV1(contracted, 4, 4, storage)).toBe(255);
    expect(await coverageAtV1(contracted, 5, 4, storage)).toBe(0);
  });

  it('feather creates deterministic soft coverage around the selection edge', async () => {
    const { storage, coverage } = await rectangleFixtureV1();
    const feathered = await prepareFeatheredSelectionCoverageV1(coverage, 1, {
      documentWidth: 8,
      documentHeight: 8,
      revision: parseRevision(36),
      storage,
    });
    expect(await coverageAtV1(feathered, 3, 3, storage)).toBe(255);
    expect(await coverageAtV1(feathered, 2, 3, storage)).toBe(170);
    expect(await coverageAtV1(feathered, 1, 3, storage)).toBe(85);
    expect(await coverageAtV1(feathered, 0, 3, storage)).toBe(0);
  });

  it('contract sees the outside of the document as unselected while preserving sparse default=1', async () => {
    const storage = memorySelectionStorageV1();
    const full = rasterSelectionCoverageFromPreparedV1(
      Object.freeze({
        schema: 'illustro.prepared-selection-coverage/1' as const,
        defaultCoverage: 1 as const,
        tiles: Object.freeze([]),
        sourceRevision: parseRevision(37),
      }),
    );
    const contracted = await prepareContractedSelectionCoverageV1(full, 1, {
      documentWidth: 4,
      documentHeight: 4,
      revision: parseRevision(38),
      storage,
    });
    expect(contracted.defaultCoverage).toBe(1);
    expect(contracted.tiles).toHaveLength(1);
    expect(await coverageAtV1(contracted, 0, 2, storage)).toBe(0);
    expect(await coverageAtV1(contracted, 1, 1, storage)).toBe(255);
    expect(await coverageAtV1(contracted, 3, 2, storage)).toBe(0);
  });

  it('morphology bakes an inverted selection into effective non-inverted prepared coverage', async () => {
    const { storage, coverage } = await rectangleFixtureV1();
    const inverted = Object.freeze({ ...coverage, inverted: true });
    const expanded = await prepareExpandedSelectionCoverageV1(inverted, 0, {
      documentWidth: 8,
      documentHeight: 8,
      revision: parseRevision(39),
      storage,
    });
    expect(expanded.defaultCoverage).toBe(1);
    expect(await coverageAtV1(expanded, 3, 3, storage)).toBe(0);
    expect(await coverageAtV1(expanded, 0, 0, storage)).toBe(255);
  });
});
