import { describe, expect, it } from 'vitest';
import {
  applyPreparedFloodFillV1,
  floodFillEligibilityV1,
  prepareFloodFillV1,
  resolveFloodFillRegionV1,
} from '../../src/app/flood-fill-engine.js';
import type { RasterMergePersistencePortV1 } from '../../src/app/layer-raster-merge.js';
import type {
  PaintDecodedRasterTileV1,
  PaintPersistedRasterTileV1,
  PaintRasterTilePixelFormatV1,
} from '../../src/app/paint-persistence-controller.js';
import type { PaintProjectSnapshotV1 } from '../../src/app/paint-session-controller.js';
import { createArraySelectionPixelSourceV1 } from '../../src/app/selection-region-engine.js';
import { createDocumentV1 } from '../../src/domain/document.js';
import { parseRevision } from '../../src/domain/identity.js';
import {
  createRasterLayer,
  createRasterTileReference,
  type RasterLayerV1,
} from '../../src/domain/layers.js';

class MemoryRasterPersistence implements RasterMergePersistencePortV1 {
  readonly tiles = new Map<string, PaintDecodedRasterTileV1>();
  readonly writes: PaintPersistedRasterTileV1[] = [];

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
    const decoded = Object.freeze({
      schema: 'illustro.paint-decoded-raster-tile/1' as const,
      payloadRef,
      objectHash,
      codec: 'raw' as const,
      pixelFormat: input.pixelFormat,
      width: input.width,
      height: input.height,
      bytes,
    });
    this.tiles.set(payloadRef, decoded);
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

function snapshotWith(layer: RasterLayerV1, width: number, height: number): PaintProjectSnapshotV1 {
  const document = createDocumentV1({ width, height, precision: 'rgba8-unorm' });
  return Object.freeze({
    schema: 'illustro.paint-project-snapshot/1' as const,
    document: Object.freeze({
      ...document,
      layerTree: Object.freeze({
        rootLayerIds: Object.freeze([layer.id]),
        layers: Object.freeze({ [layer.id]: layer }),
      }),
    }),
    committedStrokes: Object.freeze([]),
  });
}

function coverageAt(
  region: ReturnType<typeof resolveFloodFillRegionV1>,
  x: number,
  y: number,
): number {
  const tx = Math.floor(x / 128);
  const ty = Math.floor(y / 128);
  const tile = region.tiles.find((candidate) => candidate.x === tx && candidate.y === ty);
  if (tile === undefined) return 0;
  const localX = x - tx * 128;
  const localY = y - ty * 128;
  if (localX < 0 || localY < 0 || localX >= tile.width || localY >= tile.height) return 0;
  return tile.coverage[localY * tile.width + localX] ?? 0;
}

async function rasterLayerV1(
  persistence: MemoryRasterPersistence,
  width: number,
  height: number,
  bytes: Uint8Array,
  options: Parameters<typeof createRasterLayer>[0] = { name: 'Flood Source' },
): Promise<RasterLayerV1> {
  const persisted = await persistence.persistRasterTile({
    width,
    height,
    pixelFormat: 'rgba8-unorm',
    bytes,
  });
  return createRasterLayer({
    ...options,
    name: options.name ?? 'Flood Source',
    tiles: [createRasterTileReference({ x: 0, y: 0, payloadRef: persisted.payloadRef })],
  });
}

describe('M7B Flood Fill', () => {
  it('resolves the exact-color 4-connected region without crossing a barrier', () => {
    const red = [1, 0, 0, 1] as const;
    const blue = [0, 0, 1, 1] as const;
    const source = createArraySelectionPixelSourceV1({
      width: 3,
      height: 3,
      rgba: [red, red, blue, red, blue, red, blue, red, red],
    });

    const region = resolveFloodFillRegionV1(source, { x: 0.2, y: 0.8 });

    expect(region.pixelCount).toBe(3);
    expect(coverageAt(region, 0, 0)).toBe(255);
    expect(coverageAt(region, 1, 0)).toBe(255);
    expect(coverageAt(region, 0, 1)).toBe(255);
    expect(coverageAt(region, 2, 1)).toBe(0);
    expect(coverageAt(region, 1, 2)).toBe(0);
  });

  it('keeps the region sparse across canonical 128px tile boundaries', () => {
    const transparent = [0, 0, 0, 0] as const;
    const source = createArraySelectionPixelSourceV1({
      width: 129,
      height: 1,
      rgba: Array.from({ length: 129 }, () => transparent),
    });

    const region = resolveFloodFillRegionV1(source, { x: 0, y: 0 });

    expect(region.pixelCount).toBe(129);
    expect(region.tiles.map((tile) => [tile.x, tile.y, tile.width, tile.height])).toEqual([
      [0, 0, 128, 1],
      [1, 0, 1, 1],
    ]);
    expect(coverageAt(region, 128, 0)).toBe(255);
  });

  it('prepares direct raster replacement tiles and commits one artwork revision', async () => {
    const persistence = new MemoryRasterPersistence();
    const bytes = new Uint8Array([255, 0, 0, 255, 255, 0, 0, 255, 0, 0, 255, 255]);
    const layer = await rasterLayerV1(persistence, 3, 1, bytes);
    const snapshot = snapshotWith(layer, 3, 1);

    const prepared = await prepareFloodFillV1(
      snapshot,
      layer.id,
      { x: 0, y: 0 },
      [0, 1, 0],
      persistence,
    );

    expect(prepared.regionPixelCount).toBe(2);
    expect(prepared.tiles).toHaveLength(1);
    const output = await persistence.readRasterTile(prepared.tiles[0]?.payloadRef ?? '');
    expect([...output.bytes]).toEqual([0, 255, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255]);

    const committed = applyPreparedFloodFillV1(snapshot, prepared, parseRevision(12), new Date(20));
    expect(committed.document.revision).toBe(12);
    expect(committed.document.modifiedAt).toBe(new Date(20).toISOString());
    const committedLayer = committed.document.layerTree.layers[layer.id];
    expect(committedLayer?.type).toBe('raster');
    expect(committedLayer?.revision).toBe(12);
  });

  it('honors layer pixel locks at the production boundary', () => {
    const layer = createRasterLayer({ name: 'Locked', locks: { pixels: true } });
    const snapshot = snapshotWith(layer, 1, 1);
    const eligibility = floodFillEligibilityV1(snapshot, layer.id);
    expect(eligibility.eligible).toBe(false);
    expect(eligibility.reason).toContain('pixel lock');
  });
});
