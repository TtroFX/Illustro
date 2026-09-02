import { describe, expect, it } from 'vitest';
import {
  applyColorMatchRgbaBytesV1,
  applyPersistedLayerColorMatchV1,
  colorMatchPreviewImageV1,
  colorMatchStatisticsFromRgba8V1,
  layerColorMatchEligibilityV1,
  persistPreparedLayerColorMatchV1,
  prepareLayerColorMatchV1,
  readLayerColorMatchSourceV1,
} from '../../src/app/color-match.js';
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
  createRasterLayer,
  createRasterTileReference,
  createVectorLayer,
} from '../../src/domain/layers.js';

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
    const bytes = input.bytes instanceof Uint8Array ? new Uint8Array(input.bytes) : new Uint8Array(input.bytes.slice(0));
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

function snapshotWith(
  layer: ReturnType<typeof createRasterLayer> | ReturnType<typeof createVectorLayer>,
): PaintProjectSnapshotV1 {
  const document = createDocumentV1({ width: 2, height: 1 });
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

describe('M5D Color Match', () => {
  it('computes alpha-weighted RGB mean and variance', () => {
    const statistics = colorMatchStatisticsFromRgba8V1(
      new Uint8Array([0, 0, 0, 255, 255, 255, 255, 255]),
      2,
      1,
    );
    expect(statistics).not.toBeNull();
    expect(statistics?.weight).toBe(2);
    for (const channel of [0, 1, 2] as const) {
      expect(statistics?.mean[channel]).toBeCloseTo(0.5, 6);
      expect(statistics?.stddev[channel]).toBeCloseTo(0.5, 6);
    }
  });

  it('matches RGB statistics while preserving alpha and supports zero-strength preview', () => {
    const source = colorMatchStatisticsFromRgba8V1(
      new Uint8Array([32, 64, 96, 255, 96, 128, 160, 255]),
      2,
      1,
    );
    const target = colorMatchStatisticsFromRgba8V1(
      new Uint8Array([128, 32, 16, 255, 192, 96, 80, 255]),
      2,
      1,
    );
    expect(source).not.toBeNull();
    expect(target).not.toBeNull();
    if (source === null || target === null) return;
    const original = new Uint8Array([32, 64, 96, 77, 96, 128, 160, 155]);
    const zero = applyColorMatchRgbaBytesV1(original, 'rgba8-unorm', 2, 1, source, target, 0);
    expect([...zero]).toEqual([...original]);
    const matched = applyColorMatchRgbaBytesV1(original, 'rgba8-unorm', 2, 1, source, target, 1);
    expect(matched[3]).toBe(77);
    expect(matched[7]).toBe(155);
    expect(matched[0]).toBeGreaterThan(original[0] ?? 0);
    expect(matched[1]).toBeLessThan(original[1] ?? 0);
  });

  it('requires editable raster content', () => {
    const vector = createVectorLayer({ name: 'Vector' });
    expect(layerColorMatchEligibilityV1(snapshotWith(vector), vector.id)).toMatchObject({
      eligible: false,
      reason: expect.stringContaining('Raster Layer'),
    });
    const locked = createRasterLayer({
      name: 'Locked',
      locks: { pixels: true },
      tiles: [
        createRasterTileReference({
          x: 0,
          y: 0,
          payloadRef: `sha256:${'a'.repeat(64)}`,
        }),
      ],
    });
    expect(layerColorMatchEligibilityV1(snapshotWith(locked), locked.id)).toMatchObject({
      eligible: false,
      reason: expect.stringContaining('pixel lock'),
    });
  });

  it('previews in memory, persists on Apply, and updates the canonical Raster Layer once', async () => {
    const sourceRef = `sha256:${'b'.repeat(64)}`;
    const raster = createRasterLayer({
      name: 'Paint',
      opacity: 0.8,
      tiles: [createRasterTileReference({ x: 0, y: 0, payloadRef: sourceRef })],
    });
    const snapshot = snapshotWith(raster);
    const persistence = new MemoryRasterPersistence();
    persistence.seed({
      payloadRef: sourceRef,
      width: 2,
      height: 1,
      pixelFormat: 'rgba8-unorm',
      bytes: new Uint8Array([32, 64, 96, 255, 96, 128, 160, 255]),
    });
    const source = await readLayerColorMatchSourceV1(snapshot, raster.id, persistence);
    const target = colorMatchStatisticsFromRgba8V1(
      new Uint8Array([160, 32, 24, 255, 224, 96, 88, 255]),
      2,
      1,
    );
    expect(target).not.toBeNull();
    if (target === null) return;
    const prepared = prepareLayerColorMatchV1(source, target, 1);
    expect(persistence.writes).toHaveLength(0);
    const beforePreview = colorMatchPreviewImageV1(prepared, 'before', 64);
    const afterPreview = colorMatchPreviewImageV1(prepared, 'after', 64);
    expect([...afterPreview.bytes]).not.toEqual([...beforePreview.bytes]);
    const persisted = await persistPreparedLayerColorMatchV1(prepared, persistence);
    expect(persistence.writes).toHaveLength(1);
    const after = applyPersistedLayerColorMatchV1(snapshot, persisted, parseRevision(1), new Date(0));
    expect(after.document.revision).toBe(1);
    expect(after.document.modifiedAt).toBe(new Date(0).toISOString());
    expect(after.document.layerTree.layers[raster.id]).toMatchObject({
      id: raster.id,
      type: 'raster',
      revision: 1,
      opacity: 0.8,
    });
    expect(after.document.layerTree.layers[raster.id]?.tiles[0]?.payloadRef).toBe(
      persisted.tiles[0]?.payloadRef,
    );
  });
});
