import { describe, expect, it } from 'vitest';
import {
  applyPreparedSelectionScopedLayerOperationV1,
  prepareSelectionScopedLayerOperationV1,
  SELECTION_SCOPED_LAYER_OPERATION_IDS_V1,
  selectionScopedLayerOperationEligibilityV1,
} from '../../src/app/selection-layer-operation-engine.js';
import type { RasterMergePersistencePortV1 } from '../../src/app/layer-raster-merge.js';
import type {
  PaintDecodedRasterTileV1,
  PaintPersistedRasterTileV1,
  PaintRasterTilePixelFormatV1,
} from '../../src/app/paint-persistence-controller.js';
import type { PaintProjectSnapshotV1 } from '../../src/app/paint-session-controller.js';
import type { RasterSelectionCoverageV1 } from '../../src/app/selection-coverage-controller.js';
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

async function rasterLayerV1(
  persistence: MemoryRasterPersistence,
  bytes: Uint8Array,
  options: Parameters<typeof createRasterLayer>[0] = { name: 'Layer Operation Source' },
): Promise<RasterLayerV1> {
  const persisted = await persistence.persistRasterTile({
    width: bytes.length / 4,
    height: 1,
    pixelFormat: 'rgba8-unorm',
    bytes,
  });
  return createRasterLayer({
    ...options,
    name: options.name ?? 'Layer Operation Source',
    tiles: [createRasterTileReference({ x: 0, y: 0, payloadRef: persisted.payloadRef })],
  });
}

async function coverageV1(
  persistence: MemoryRasterPersistence,
  values: readonly number[],
): Promise<RasterSelectionCoverageV1> {
  const bytes = new Uint8Array(values.length * 4);
  for (let pixel = 0; pixel < values.length; pixel += 1) {
    const value = values[pixel] ?? 0;
    const offset = pixel * 4;
    bytes[offset] = value;
    bytes[offset + 1] = value;
    bytes[offset + 2] = value;
    bytes[offset + 3] = 255;
  }
  const persisted = await persistence.persistRasterTile({
    width: values.length,
    height: 1,
    pixelFormat: 'rgba8-unorm',
    bytes,
  });
  return Object.freeze({
    schema: 'illustro.raster-selection-coverage/1' as const,
    defaultCoverage: 0,
    tiles: Object.freeze([
      createRasterTileReference({ x: 0, y: 0, payloadRef: persisted.payloadRef }),
    ]),
    inverted: false,
    transformStack: Object.freeze([]),
    effectStack: Object.freeze([]),
    sourceRevision: parseRevision(7),
  });
}

describe('M7A selection-scoped layer operations', () => {
  it('defines Clear Layer and Invert Layer Color as the canonical scoped operations', () => {
    expect(SELECTION_SCOPED_LAYER_OPERATION_IDS_V1).toEqual(['clear', 'invert-color']);
  });

  it('clears only selected alpha using soft selection coverage and commits the raster result', async () => {
    const persistence = new MemoryRasterPersistence();
    const layer = await rasterLayerV1(
      persistence,
      new Uint8Array([10, 20, 30, 200, 40, 50, 60, 200]),
    );
    const snapshot = snapshotWith(layer, 2, 1);
    const coverage = await coverageV1(persistence, [128, 0]);

    const prepared = await prepareSelectionScopedLayerOperationV1(
      snapshot,
      layer.id,
      coverage,
      'clear',
      persistence,
    );
    expect(prepared.operationId).toBe('clear');
    expect(prepared.selectionSourceRevision).toBe(7);
    expect(prepared.tiles).toHaveLength(1);
    const cleared = await persistence.readRasterTile(prepared.tiles[0]?.payloadRef ?? '');
    expect([...cleared.bytes]).toEqual([10, 20, 30, 100, 40, 50, 60, 200]);

    const committed = applyPreparedSelectionScopedLayerOperationV1(
      snapshot,
      prepared,
      parseRevision(9),
      new Date(10),
    );
    expect(committed.document.revision).toBe(9);
    expect(committed.document.modifiedAt).toBe(new Date(10).toISOString());
    const committedLayer = committed.document.layerTree.layers[layer.id];
    expect(committedLayer?.type).toBe('raster');
    expect(committedLayer?.revision).toBe(9);
    if (committedLayer?.type !== 'raster') throw new Error('expected committed raster layer');
    expect(committedLayer.tiles[0]?.payloadRef).toBe(prepared.tiles[0]?.payloadRef);
  });

  it('routes Invert Layer Color through selection strength while preserving alpha', async () => {
    const persistence = new MemoryRasterPersistence();
    const layer = await rasterLayerV1(
      persistence,
      new Uint8Array([10, 20, 30, 200, 100, 110, 120, 210]),
      { name: 'Alpha locked invert', locks: { alpha: true } },
    );
    const snapshot = snapshotWith(layer, 2, 1);
    const coverage = await coverageV1(persistence, [128, 0]);

    expect(
      selectionScopedLayerOperationEligibilityV1(snapshot, layer.id, coverage, 'invert-color'),
    ).toMatchObject({ eligible: true, operationId: 'invert-color' });
    const prepared = await prepareSelectionScopedLayerOperationV1(
      snapshot,
      layer.id,
      coverage,
      'invert-color',
      persistence,
    );
    const inverted = await persistence.readRasterTile(prepared.tiles[0]?.payloadRef ?? '');
    expect([...inverted.bytes]).toEqual([128, 128, 128, 200, 100, 110, 120, 210]);
  });

  it('keeps alpha lock valid for RGB invert but blocks selection-scoped clear', async () => {
    const persistence = new MemoryRasterPersistence();
    const layer = await rasterLayerV1(
      persistence,
      new Uint8Array([10, 20, 30, 255]),
      { name: 'Alpha locked', locks: { alpha: true } },
    );
    const snapshot = snapshotWith(layer, 1, 1);
    const coverage = await coverageV1(persistence, [255]);

    expect(
      selectionScopedLayerOperationEligibilityV1(snapshot, layer.id, coverage, 'invert-color'),
    ).toMatchObject({ eligible: true });
    expect(
      selectionScopedLayerOperationEligibilityV1(snapshot, layer.id, coverage, 'clear'),
    ).toMatchObject({ eligible: false, reason: expect.stringContaining('alpha lock') });
  });

  it('requires an active selection and rejects a stale prepared commit', async () => {
    const persistence = new MemoryRasterPersistence();
    const layer = await rasterLayerV1(
      persistence,
      new Uint8Array([20, 40, 60, 255]),
    );
    const snapshot = snapshotWith(layer, 1, 1);
    expect(
      selectionScopedLayerOperationEligibilityV1(snapshot, layer.id, null, 'clear'),
    ).toMatchObject({ eligible: false, reason: expect.stringContaining('active selection') });
    expect(
      selectionScopedLayerOperationEligibilityV1(snapshot, layer.id, null, 'invert-color'),
    ).toMatchObject({ eligible: false, reason: expect.stringContaining('active selection') });

    const coverage = await coverageV1(persistence, [255]);
    const prepared = await prepareSelectionScopedLayerOperationV1(
      snapshot,
      layer.id,
      coverage,
      'invert-color',
      persistence,
    );
    const stale = Object.freeze({
      ...snapshot,
      document: Object.freeze({ ...snapshot.document, revision: parseRevision(99) }),
    });
    expect(() =>
      applyPreparedSelectionScopedLayerOperationV1(stale, prepared, parseRevision(100)),
    ).toThrow(/document changed before commit/);
  });
});
