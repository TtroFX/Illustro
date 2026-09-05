import { describe, expect, it } from 'vitest';
import type {
  PaintDecodedRasterTileV1,
  PaintPersistedRasterTileV1,
} from '../../src/app/paint-persistence-controller.js';
import {
  QuickMaskControllerV1,
  quickMaskOverlayAlphaV1,
} from '../../src/app/quick-mask-controller.js';
import type { SelectionCoverageStoragePortV1 } from '../../src/app/selection-combine-engine.js';
import {
  type RasterSelectionCoverageV1,
  SelectionCoverageControllerV1,
} from '../../src/app/selection-coverage-controller.js';
import { prepareRectangularSelectionV1 } from '../../src/app/selection-shape-engine.js';
import { parseRevision } from '../../src/domain/identity.js';

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
  coverage: RasterSelectionCoverageV1,
  x: number,
  y: number,
  storage: SelectionCoverageStoragePortV1,
): Promise<number> {
  const tx = Math.floor(x / 128);
  const ty = Math.floor(y / 128);
  const reference = coverage.tiles.find((tile) => tile.x === tx && tile.y === ty);
  const base = coverage.defaultCoverage === 1 ? 255 : 0;
  if (reference === undefined) return coverage.inverted ? 255 - base : base;
  const decoded = await storage.readRasterTile(reference.payloadRef);
  const localX = x - tx * 128;
  const localY = y - ty * 128;
  const value = decoded.bytes[(localY * decoded.width + localX) * 4] ?? 0;
  return coverage.inverted ? 255 - value : value;
}

describe('M7A Quick Mask controller', () => {
  it('keeps the canonical selection unchanged while Quick Mask is active', () => {
    const selection = new SelectionCoverageControllerV1();
    const quickMask = new QuickMaskControllerV1(selection);
    const snapshot = quickMask.enter(parseRevision(1));

    expect(snapshot.active).toBe(true);
    expect(snapshot.workingCoverage?.defaultCoverage).toBe(0);
    expect(selection.snapshot().coverage).toBeNull();
    expect(quickMaskOverlayAlphaV1(0)).toBeCloseTo(0.45);
    expect(quickMaskOverlayAlphaV1(255)).toBe(0);
  });

  it('paints selection coverage and commits it back to the canonical selection', async () => {
    const storage = memorySelectionStorageV1();
    const selection = new SelectionCoverageControllerV1();
    const quickMask = new QuickMaskControllerV1(selection);
    quickMask.enter(parseRevision(2));

    await quickMask.paintBrush(
      [{ x: 4, y: 4, radius: 2 }],
      'select',
      {
        documentWidth: 8,
        documentHeight: 8,
        revision: parseRevision(3),
        storage,
      },
    );
    expect(selection.snapshot().coverage).toBeNull();

    const committed = quickMask.commit().coverage;
    expect(committed).not.toBeNull();
    if (committed === null) throw new Error('Quick Mask commit unexpectedly cleared selection');
    expect(await coverageAtV1(committed, 4, 4, storage)).toBe(255);
    expect(await coverageAtV1(committed, 0, 0, storage)).toBe(0);
  });

  it('paints masked coverage by subtracting from the working selection', async () => {
    const storage = memorySelectionStorageV1();
    const selection = new SelectionCoverageControllerV1();
    const full = await prepareRectangularSelectionV1(
      { x: 0, y: 0 },
      { x: 8, y: 8 },
      {
        documentWidth: 8,
        documentHeight: 8,
        revision: parseRevision(4),
        persistence: storage,
      },
    );
    selection.replacePrepared(full);
    const quickMask = new QuickMaskControllerV1(selection);
    quickMask.enter(parseRevision(5));

    await quickMask.paintBrush(
      [{ x: 4, y: 4, radius: 1.5 }],
      'mask',
      {
        documentWidth: 8,
        documentHeight: 8,
        revision: parseRevision(6),
        storage,
      },
    );
    const committed = quickMask.commit().coverage;
    expect(committed).not.toBeNull();
    if (committed === null) throw new Error('Quick Mask subtract unexpectedly cleared selection');
    expect(await coverageAtV1(committed, 4, 4, storage)).toBe(0);
    expect(await coverageAtV1(committed, 0, 0, storage)).toBe(255);
  });

  it('cancel restores the exact selection that existed on entry', async () => {
    const storage = memorySelectionStorageV1();
    const selection = new SelectionCoverageControllerV1();
    const original = await prepareRectangularSelectionV1(
      { x: 1, y: 1 },
      { x: 5, y: 5 },
      {
        documentWidth: 8,
        documentHeight: 8,
        revision: parseRevision(7),
        persistence: storage,
      },
    );
    const baseline = selection.replacePrepared(original).coverage;
    const quickMask = new QuickMaskControllerV1(selection);
    quickMask.enter(parseRevision(8));
    selection.clear();

    const cancelled = quickMask.cancel().coverage;
    expect(cancelled).toEqual(baseline);
  });

  it('committing an untouched empty Quick Mask remains deselected', () => {
    const selection = new SelectionCoverageControllerV1();
    const quickMask = new QuickMaskControllerV1(selection);
    quickMask.enter(parseRevision(9));

    expect(quickMask.commit().coverage).toBeNull();
    expect(quickMask.snapshot().active).toBe(false);
  });
});
