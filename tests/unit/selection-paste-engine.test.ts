import { describe, expect, it } from 'vitest';
import type { RasterMergePersistencePortV1 } from '../../src/app/layer-raster-merge.js';
import type {
  PaintDecodedRasterTileV1,
  PaintPersistedRasterTileV1,
  PaintRasterTilePixelFormatV1,
} from '../../src/app/paint-persistence-controller.js';
import type { PaintProjectSnapshotV1 } from '../../src/app/paint-session-controller.js';
import {
  applyPreparedSelectionPasteV1,
  prepareSelectionPasteV1,
  selectionPasteEligibilityV1,
} from '../../src/app/selection-paste-engine.js';
import type { SelectionTransferPayloadV1 } from '../../src/app/selection-cut-engine.js';
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

function snapshotWith(
  layers: readonly RasterLayerV1[],
  width: number,
  height: number,
  precision: 'rgba8-unorm' | 'rgba16-float' = 'rgba8-unorm',
): PaintProjectSnapshotV1 {
  const document = createDocumentV1({ width, height, precision });
  return Object.freeze({
    schema: 'illustro.paint-project-snapshot/1' as const,
    document: Object.freeze({
      ...document,
      layerTree: Object.freeze({
        rootLayerIds: Object.freeze(layers.map((layer) => layer.id)),
        layers: Object.freeze(Object.fromEntries(layers.map((layer) => [layer.id, layer]))),
      }),
    }),
    committedStrokes: Object.freeze([]),
  });
}

function transferV1(
  source: RasterLayerV1,
  payloadRef: string,
  options: {
    readonly width?: number;
    readonly height?: number;
    readonly pixelFormat?: PaintRasterTilePixelFormatV1;
    readonly x?: number;
    readonly y?: number;
  } = {},
): SelectionTransferPayloadV1 {
  return Object.freeze({
    schema: 'illustro.selection-transfer/1' as const,
    sourceLayerId: source.id,
    sourceRevision: source.revision,
    selectionSourceRevision: parseRevision(3),
    documentRevision: parseRevision(4),
    width: options.width ?? 2,
    height: options.height ?? 1,
    pixelFormat: options.pixelFormat ?? 'rgba8-unorm',
    tiles: Object.freeze([
      Object.freeze({
        x: options.x ?? 0,
        y: options.y ?? 0,
        payloadRef,
      }),
    ]),
  });
}

async function persistedTileV1(
  persistence: MemoryRasterPersistence,
  width: number,
  height: number,
  pixelFormat: PaintRasterTilePixelFormatV1,
): Promise<string> {
  const bytesPerPixel = pixelFormat === 'rgba8-unorm' ? 4 : 8;
  const bytes = new Uint8Array(width * height * bytesPerPixel);
  if (pixelFormat === 'rgba8-unorm') {
    for (let offset = 3; offset < bytes.length; offset += 4) bytes[offset] = 255;
  } else {
    for (let offset = 6; offset < bytes.length; offset += 8) {
      bytes[offset] = 0x00;
      bytes[offset + 1] = 0x3c;
    }
  }
  return (await persistence.persistRasterTile({ width, height, pixelFormat, bytes })).payloadRef;
}

describe('M7A selection paste', () => {
  it('reuses immutable transfer tiles and inserts a new Raster Layer immediately above the anchor', async () => {
    const persistence = new MemoryRasterPersistence();
    const source = createRasterLayer({ name: 'Source' });
    const snapshot = snapshotWith([source], 2, 1);
    const payloadRef = await persistedTileV1(persistence, 2, 1, 'rgba8-unorm');
    const transfer = transferV1(source, payloadRef);
    const writesBeforePrepare = persistence.writes.length;

    expect(selectionPasteEligibilityV1(snapshot, transfer)).toEqual({
      eligible: true,
      reason: null,
    });
    const prepared = await prepareSelectionPasteV1(snapshot, transfer, persistence, {
      anchorLayerId: source.id,
    });
    expect(persistence.writes.length).toBe(writesBeforePrepare);

    const committed = applyPreparedSelectionPasteV1(
      snapshot,
      prepared,
      parseRevision(9),
      new Date(10),
    );
    expect(committed.document.revision).toBe(9);
    expect(committed.document.modifiedAt).toBe(new Date(10).toISOString());
    expect(committed.document.layerTree.rootLayerIds).toEqual([source.id, prepared.outputLayerId]);
    const pasted = committed.document.layerTree.layers[prepared.outputLayerId];
    expect(pasted?.type).toBe('raster');
    if (pasted?.type !== 'raster') throw new Error('expected pasted raster layer');
    expect(pasted.name).toBe('Pasted Selection');
    expect(pasted.revision).toBe(9);
    expect(pasted.tiles).toEqual([
      {
        x: 0,
        y: 0,
        revision: 9,
        payloadRef,
      },
    ]);
    expect(committed.committedStrokes).toBe(snapshot.committedStrokes);
    expect(snapshot.document.layerTree.layers[prepared.outputLayerId]).toBeUndefined();
  });

  it('defaults to the transfer source as anchor and generates a unique pasted layer name', async () => {
    const persistence = new MemoryRasterPersistence();
    const source = createRasterLayer({ name: 'Source' });
    const existingPaste = createRasterLayer({ name: 'Pasted Selection' });
    const snapshot = snapshotWith([source, existingPaste], 2, 1);
    const payloadRef = await persistedTileV1(persistence, 2, 1, 'rgba8-unorm');
    const prepared = await prepareSelectionPasteV1(
      snapshot,
      transferV1(source, payloadRef),
      persistence,
    );

    expect(prepared.anchorLayerId).toBe(source.id);
    expect(prepared.outputLayerName).toBe('Pasted Selection 2');
    const committed = applyPreparedSelectionPasteV1(snapshot, prepared, 5);
    expect(committed.document.layerTree.rootLayerIds).toEqual([
      source.id,
      prepared.outputLayerId,
      existingPaste.id,
    ]);
  });

  it('appends at the top when paste explicitly has no anchor', async () => {
    const persistence = new MemoryRasterPersistence();
    const source = createRasterLayer({ name: 'Source' });
    const other = createRasterLayer({ name: 'Other' });
    const snapshot = snapshotWith([source, other], 2, 1);
    const payloadRef = await persistedTileV1(persistence, 2, 1, 'rgba8-unorm');
    const prepared = await prepareSelectionPasteV1(
      snapshot,
      transferV1(source, payloadRef),
      persistence,
      {
        anchorLayerId: null,
        outputLayerName: 'Clipboard Pixels',
      },
    );
    const committed = applyPreparedSelectionPasteV1(snapshot, prepared, 6);
    expect(committed.document.layerTree.rootLayerIds).toEqual([
      source.id,
      other.id,
      prepared.outputLayerId,
    ]);
    expect(committed.document.layerTree.layers[prepared.outputLayerId]?.name).toBe(
      'Clipboard Pixels',
    );
  });

  it('accepts canonical RGBA16F transfer tiles without rewriting their payloads', async () => {
    const persistence = new MemoryRasterPersistence();
    const source = createRasterLayer({ name: 'Float Source' });
    const snapshot = snapshotWith([source], 1, 1, 'rgba16-float');
    const payloadRef = await persistedTileV1(persistence, 1, 1, 'rgba16-float');
    const transfer = transferV1(source, payloadRef, {
      width: 1,
      height: 1,
      pixelFormat: 'rgba16-float',
    });
    const writesBefore = persistence.writes.length;
    const prepared = await prepareSelectionPasteV1(snapshot, transfer, persistence);
    const committed = applyPreparedSelectionPasteV1(snapshot, prepared, 2);
    const pasted = committed.document.layerTree.layers[prepared.outputLayerId];
    if (pasted?.type !== 'raster') throw new Error('expected RGBA16F pasted raster layer');
    expect(pasted.tiles[0]?.payloadRef).toBe(payloadRef);
    expect(persistence.writes.length).toBe(writesBefore);
  });

  it('fails closed for incompatible canvas, precision, empty content, duplicate coordinates, and invalid anchors', async () => {
    const persistence = new MemoryRasterPersistence();
    const source = createRasterLayer({ name: 'Source' });
    const snapshot = snapshotWith([source], 2, 1);
    const payloadRef = await persistedTileV1(persistence, 2, 1, 'rgba8-unorm');

    expect(
      selectionPasteEligibilityV1(snapshot, transferV1(source, payloadRef, { width: 3 })),
    ).toMatchObject({
      eligible: false,
      reason: expect.stringContaining('dimensions'),
    });
    expect(
      selectionPasteEligibilityV1(
        snapshot,
        transferV1(source, payloadRef, { pixelFormat: 'rgba16-float' }),
      ),
    ).toMatchObject({ eligible: false, reason: expect.stringContaining('precision') });
    const empty = Object.freeze({ ...transferV1(source, payloadRef), tiles: Object.freeze([]) });
    expect(selectionPasteEligibilityV1(snapshot, empty)).toMatchObject({
      eligible: false,
      reason: expect.stringContaining('no raster tiles'),
    });
    const duplicate = Object.freeze({
      ...transferV1(source, payloadRef),
      tiles: Object.freeze([
        Object.freeze({ x: 0, y: 0, payloadRef }),
        Object.freeze({ x: 0, y: 0, payloadRef }),
      ]),
    });
    expect(selectionPasteEligibilityV1(snapshot, duplicate)).toMatchObject({
      eligible: false,
      reason: expect.stringContaining('duplicate'),
    });

    const nonRoot = createRasterLayer({ name: 'Child', parentId: source.id });
    const snapshotWithChild = Object.freeze({
      ...snapshot,
      document: Object.freeze({
        ...snapshot.document,
        layerTree: Object.freeze({
          ...snapshot.document.layerTree,
          layers: Object.freeze({
            ...snapshot.document.layerTree.layers,
            [nonRoot.id]: nonRoot,
          }),
        }),
      }),
    });
    await expect(
      prepareSelectionPasteV1(snapshotWithChild, transferV1(source, payloadRef), persistence, {
        anchorLayerId: nonRoot.id,
      }),
    ).rejects.toThrow('existing root layer');
  });

  it('validates persisted tile dimensions and byte lengths before preparing the paste', async () => {
    const persistence = new MemoryRasterPersistence();
    const source = createRasterLayer({ name: 'Source' });
    const snapshot = snapshotWith([source], 2, 1);
    const payloadRef = await persistedTileV1(persistence, 1, 1, 'rgba8-unorm');
    await expect(
      prepareSelectionPasteV1(snapshot, transferV1(source, payloadRef), persistence),
    ).rejects.toThrow('raster contract');

    const badRef = 'sha256:bad-byte-length';
    persistence.tiles.set(
      badRef,
      Object.freeze({
        schema: 'illustro.paint-decoded-raster-tile/1' as const,
        payloadRef: badRef,
        objectHash: '0'.repeat(64),
        codec: 'raw' as const,
        pixelFormat: 'rgba8-unorm' as const,
        width: 2,
        height: 1,
        bytes: new Uint8Array(7),
      }),
    );
    await expect(
      prepareSelectionPasteV1(snapshot, transferV1(source, badRef), persistence),
    ).rejects.toThrow('byte length');
  });

  it('rejects stale prepared commits and output-layer collisions', async () => {
    const persistence = new MemoryRasterPersistence();
    const source = createRasterLayer({ name: 'Source' });
    const snapshot = snapshotWith([source], 2, 1);
    const payloadRef = await persistedTileV1(persistence, 2, 1, 'rgba8-unorm');
    const prepared = await prepareSelectionPasteV1(
      snapshot,
      transferV1(source, payloadRef),
      persistence,
    );

    const changed = Object.freeze({
      ...snapshot,
      document: Object.freeze({ ...snapshot.document, revision: parseRevision(1) }),
    });
    expect(() => applyPreparedSelectionPasteV1(changed, prepared, 2)).toThrow('target changed');

    const collisionLayer = createRasterLayer({
      id: prepared.outputLayerId,
      name: 'Collision',
      tiles: [createRasterTileReference({ x: 0, y: 0, payloadRef })],
    });
    const collision = Object.freeze({
      ...snapshot,
      document: Object.freeze({
        ...snapshot.document,
        layerTree: Object.freeze({
          rootLayerIds: Object.freeze([
            ...snapshot.document.layerTree.rootLayerIds,
            collisionLayer.id,
          ]),
          layers: Object.freeze({
            ...snapshot.document.layerTree.layers,
            [collisionLayer.id]: collisionLayer,
          }),
        }),
      }),
    });
    expect(() => applyPreparedSelectionPasteV1(collision, prepared, 2)).toThrow(
      'output layer already exists',
    );
  });
});
