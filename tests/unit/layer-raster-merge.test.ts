import { describe, expect, it } from 'vitest';
import {
  applyPreparedRasterMergeDownV1,
  prepareRasterMergeDownV1,
  rasterMergeDownEligibilityV1,
  type RasterMergePersistencePortV1,
} from '../../src/app/layer-raster-merge.js';
import type {
  PaintDecodedRasterTileV1,
  PaintPersistedRasterTileV1,
  PaintRasterTilePixelFormatV1,
} from '../../src/app/paint-persistence-controller.js';
import type { PaintProjectSnapshotV1 } from '../../src/app/paint-session-controller.js';
import { createDocumentV1 } from '../../src/domain/document.js';
import { parseRevision } from '../../src/domain/identity.js';
import { createRasterLayer } from '../../src/domain/layers.js';

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

function stroke(layerId: string, strokeId: string, x: number, opacity: number) {
  return Object.freeze({
    stroke: Object.freeze({
      schema: 'illustro.paint-stroke/1' as const,
      strokeId,
      pointerId: 1,
      source: 'pen' as const,
      layerId: layerId as never,
      samples: Object.freeze([]),
    }),
    dabs: Object.freeze([
      Object.freeze({
        schema: 'illustro.baseline-brush-dab/1' as const,
        x,
        y: 16,
        radius: 8,
        radiusX: 8,
        radiusY: 8,
        opacity,
      }),
    ]),
    bakedToRasterLayer: false,
  });
}

function fixture(precision: 'rgba8-unorm' | 'rgba16-float' = 'rgba8-unorm') {
  const document = createDocumentV1({ width: 64, height: 64, precision });
  const bottom = createRasterLayer({ name: 'Bottom' });
  const top = createRasterLayer({ name: 'Top' });
  const snapshot: PaintProjectSnapshotV1 = Object.freeze({
    schema: 'illustro.paint-project-snapshot/1' as const,
    document: Object.freeze({
      ...document,
      layerTree: Object.freeze({
        rootLayerIds: Object.freeze([bottom.id, top.id]),
        layers: Object.freeze({ [bottom.id]: bottom, [top.id]: top }),
      }),
    }),
    committedStrokes: Object.freeze([
      stroke(bottom.id, '11111111-1111-4111-8111-111111111111', 16, 0.5),
      stroke(top.id, '22222222-2222-4222-8222-222222222222', 16, 0.5),
    ]),
  });
  return { snapshot, bottom, top };
}

describe('M5B canonical raster merge down', () => {
  it('materializes two raster layers into immutable tile payloads and a single history snapshot', async () => {
    const { snapshot, bottom, top } = fixture();
    const persistence = new MemoryRasterPersistence();
    const eligibility = rasterMergeDownEligibilityV1(snapshot, top.id);
    expect(eligibility).toMatchObject({ eligible: true, targetLayerId: bottom.id });

    const prepared = await prepareRasterMergeDownV1(snapshot, top.id, persistence);
    expect(prepared.tiles).toHaveLength(1);
    expect(persistence.writes).toHaveLength(1);
    const bytes = persistence.tiles.get(prepared.tiles[0]!.payloadRef)?.bytes;
    expect(bytes).toBeDefined();
    const centerAlpha = bytes?.[(16 * 64 + 16) * 4 + 3];
    expect(centerAlpha).toBeGreaterThanOrEqual(190);
    expect(centerAlpha).toBeLessThanOrEqual(192);

    const merged = applyPreparedRasterMergeDownV1(
      snapshot,
      prepared,
      parseRevision(1),
      new Date(0),
    );
    expect(merged.document.layerTree.rootLayerIds).toEqual([bottom.id]);
    expect(merged.document.layerTree.layers[top.id]).toBeUndefined();
    expect(merged.document.layerTree.layers[bottom.id]).toMatchObject({
      type: 'raster',
      revision: 1,
      tiles: [{ x: 0, y: 0, revision: 1, payloadRef: prepared.tiles[0]!.payloadRef }],
    });
    expect(merged.committedStrokes).toHaveLength(2);
    expect(merged.committedStrokes.every((entry) => entry.stroke.layerId === bottom.id)).toBe(true);
    expect(merged.committedStrokes.every((entry) => entry.bakedToRasterLayer)).toBe(true);
  });

  it('preserves RGBA16F document precision in canonical tile persistence', async () => {
    const { snapshot, top } = fixture('rgba16-float');
    const persistence = new MemoryRasterPersistence();
    await prepareRasterMergeDownV1(snapshot, top.id, persistence);
    expect(persistence.writes[0]?.pixelFormat).toBe('rgba16-float');
    expect(persistence.tiles.get(persistence.writes[0]!.payloadRef)?.bytes.byteLength).toBe(
      64 * 64 * 8,
    );
  });

  it('defers unsupported blend/opacity semantics to the compositor milestone instead of flattening incorrectly', () => {
    const { snapshot, bottom, top } = fixture();
    const changedTop = Object.freeze({ ...top, opacity: 0.5 });
    const changed: PaintProjectSnapshotV1 = Object.freeze({
      ...snapshot,
      document: Object.freeze({
        ...snapshot.document,
        layerTree: Object.freeze({
          rootLayerIds: snapshot.document.layerTree.rootLayerIds,
          layers: Object.freeze({ [bottom.id]: bottom, [top.id]: changedTop }),
        }),
      }),
    });
    expect(rasterMergeDownEligibilityV1(changed, top.id)).toMatchObject({
      eligible: false,
      reason: expect.stringContaining('compositor'),
    });
  });
});
