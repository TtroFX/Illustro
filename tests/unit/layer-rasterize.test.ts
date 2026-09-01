import { describe, expect, it } from 'vitest';
import {
  applyPreparedLayerRasterizeV1,
  layerRasterizeEligibilityV1,
  prepareLayerRasterizeV1,
} from '../../src/app/layer-rasterize.js';
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
  createFillLayer,
  createRasterLayer,
  createVectorLayer,
  createVectorObject,
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
  layer:
    | ReturnType<typeof createRasterLayer>
    | ReturnType<typeof createFillLayer>
    | ReturnType<typeof createVectorLayer>,
  precision: 'rgba8-unorm' | 'rgba16-float' = 'rgba8-unorm',
): PaintProjectSnapshotV1 {
  const document = createDocumentV1({ width: 300, height: 260, precision });
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

function stroke(layerId: string) {
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

describe('M5B layer rasterize', () => {
  it('materializes a solid Fill Layer to sparse RGBA8 tiles while preserving layer identity and attachments', async () => {
    const document = createDocumentV1({ width: 300, height: 260 });
    const fill = createFillLayer({
      name: 'Color',
      opacity: 0.75,
      roleFlags: { reference: true },
      fill: {
        kind: 'solid',
        color: { space: document.color.workingSpace, rgba: [0.25, 0.5, 0.75, 0.5] },
      },
    });
    const snapshot: PaintProjectSnapshotV1 = Object.freeze({
      schema: 'illustro.paint-project-snapshot/1' as const,
      document: Object.freeze({
        ...document,
        layerTree: Object.freeze({
          rootLayerIds: Object.freeze([fill.id]),
          layers: Object.freeze({ [fill.id]: fill }),
        }),
      }),
      committedStrokes: Object.freeze([]),
    });
    const persistence = new MemoryRasterPersistence();
    expect(layerRasterizeEligibilityV1(snapshot, fill.id).eligible).toBe(true);
    const prepared = await prepareLayerRasterizeV1(snapshot, fill.id, persistence);
    expect(prepared.tiles).toHaveLength(4);
    expect(persistence.writes).toHaveLength(4);
    const first = persistence.tiles.get(prepared.tiles[0]!.payloadRef)!;
    expect(first.pixelFormat).toBe('rgba8-unorm');
    expect([...first.bytes.slice(0, 4)]).toEqual([64, 128, 191, 128]);
    const after = applyPreparedLayerRasterizeV1(snapshot, prepared, parseRevision(1), new Date(0));
    const raster = after.document.layerTree.layers[fill.id];
    expect(raster).toMatchObject({
      id: fill.id,
      type: 'raster',
      revision: 1,
      opacity: 0.75,
      roleFlags: { reference: true },
    });
    expect(raster?.type === 'raster' ? raster.tiles : []).toHaveLength(4);
  });

  it('preserves RGBA16F precision for solid fill rasterization', async () => {
    const document = createDocumentV1({ width: 300, height: 260, precision: 'rgba16-float' });
    const fill = createFillLayer({
      name: 'HDR Fill',
      fill: {
        kind: 'solid',
        color: { space: document.color.workingSpace, rgba: [1, 0.5, 0.25, 1] },
      },
    });
    const snapshot: PaintProjectSnapshotV1 = Object.freeze({
      schema: 'illustro.paint-project-snapshot/1' as const,
      document: Object.freeze({
        ...document,
        layerTree: Object.freeze({
          rootLayerIds: Object.freeze([fill.id]),
          layers: Object.freeze({ [fill.id]: fill }),
        }),
      }),
      committedStrokes: Object.freeze([]),
    });
    const persistence = new MemoryRasterPersistence();
    await prepareLayerRasterizeV1(snapshot, fill.id, persistence);
    expect(persistence.writes.every((write) => write.pixelFormat === 'rgba16-float')).toBe(true);
    expect(persistence.writes[0]?.rawByteLength).toBe(256 * 256 * 8);
  });

  it('materializes unbaked Raster Layer strokes and marks their canonical history as baked', async () => {
    const raster = createRasterLayer({ name: 'Paint' });
    const base = snapshotWith(raster);
    const snapshot: PaintProjectSnapshotV1 = Object.freeze({
      ...base,
      committedStrokes: Object.freeze([stroke(raster.id)]),
    });
    const persistence = new MemoryRasterPersistence();
    const prepared = await prepareLayerRasterizeV1(snapshot, raster.id, persistence);
    expect(prepared.tiles).toHaveLength(1);
    const after = applyPreparedLayerRasterizeV1(snapshot, prepared, parseRevision(1));
    expect(after.committedStrokes[0]?.bakedToRasterLayer).toBe(true);
    expect(after.document.layerTree.layers[raster.id]?.type).toBe('raster');
  });

  it('allows an empty vector layer to become an empty raster but blocks unsupported live vector geometry', async () => {
    const empty = createVectorLayer({ name: 'Empty Vector' });
    const emptySnapshot = snapshotWith(empty);
    const persistence = new MemoryRasterPersistence();
    const prepared = await prepareLayerRasterizeV1(emptySnapshot, empty.id, persistence);
    const after = applyPreparedLayerRasterizeV1(emptySnapshot, prepared, parseRevision(1));
    expect(after.document.layerTree.layers[empty.id]?.type).toBe('raster');
    expect(persistence.writes).toHaveLength(0);

    const populated = createVectorLayer({
      name: 'Vector',
      objects: [createVectorObject({ kind: 'shape', geometry: { kind: 'rect' } })],
    });
    const populatedSnapshot = snapshotWith(populated);
    expect(layerRasterizeEligibilityV1(populatedSnapshot, populated.id)).toMatchObject({
      eligible: false,
      reason: expect.stringContaining('vector renderer'),
    });
  });
});
