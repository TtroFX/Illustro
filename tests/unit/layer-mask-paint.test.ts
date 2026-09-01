import { describe, expect, it } from 'vitest';
import {
  applyPreparedMaskPaintV1,
  prepareMaskPaintV1,
  rasterizeMaskCoverageTileV1,
  type MaskPaintPersistencePortV1,
} from '../../src/app/layer-mask-paint.js';
import type {
  PaintDecodedRasterTileV1,
  PaintPersistedRasterTileV1,
} from '../../src/app/paint-persistence-controller.js';
import type { PaintProjectSnapshotV1 } from '../../src/app/paint-session-controller.js';
import { createDocumentV1 } from '../../src/domain/document.js';
import { parseRevision } from '../../src/domain/identity.js';
import { createRasterLayer, createRasterMask } from '../../src/domain/layers.js';
import type { BaselineBrushDabV1 } from '../../src/gpu/baseline-brush.js';

class FakePersistence implements MaskPaintPersistencePortV1 {
  readonly tiles = new Map<string, PaintDecodedRasterTileV1>();
  readonly writes: PaintPersistedRasterTileV1[] = [];

  async readRasterTile(payloadRef: string): Promise<PaintDecodedRasterTileV1> {
    const tile = this.tiles.get(payloadRef);
    if (tile === undefined) throw new Error(`missing fake tile: ${payloadRef}`);
    return tile;
  }

  async persistRasterTile(input: {
    readonly width: number;
    readonly height: number;
    readonly pixelFormat: 'rgba8-unorm';
    readonly bytes: Uint8Array | ArrayBuffer;
  }): Promise<PaintPersistedRasterTileV1> {
    const index = this.writes.length + 1;
    const objectHash = String(index).padStart(64, '0');
    const payloadRef = `sha256:${objectHash}`;
    const bytes =
      input.bytes instanceof Uint8Array ? new Uint8Array(input.bytes) : new Uint8Array(input.bytes);
    const decoded: PaintDecodedRasterTileV1 = Object.freeze({
      schema: 'illustro.paint-decoded-raster-tile/1' as const,
      payloadRef,
      objectHash,
      codec: 'raw' as const,
      pixelFormat: 'rgba8-unorm' as const,
      width: input.width,
      height: input.height,
      bytes,
    });
    this.tiles.set(payloadRef, decoded);
    const persisted: PaintPersistedRasterTileV1 = Object.freeze({
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
    this.writes.push(persisted);
    return persisted;
  }
}

function fixture(defaultCoverage: 0 | 1 = 1): {
  readonly snapshot: PaintProjectSnapshotV1;
  readonly layer: ReturnType<typeof createRasterLayer>;
  readonly mask: ReturnType<typeof createRasterMask>;
} {
  const mask = createRasterMask({ defaultCoverage });
  const layer = createRasterLayer({ name: 'Masked', masks: [mask] });
  const document = createDocumentV1({ width: 32, height: 32 });
  return {
    snapshot: Object.freeze({
      schema: 'illustro.paint-project-snapshot/1' as const,
      document: Object.freeze({
        ...document,
        layerTree: Object.freeze({
          rootLayerIds: Object.freeze([layer.id]),
          layers: Object.freeze({ [layer.id]: layer }),
        }),
      }),
      committedStrokes: Object.freeze([]),
    }),
    layer,
    mask,
  };
}

const centerDab: BaselineBrushDabV1 = Object.freeze({
  schema: 'illustro.baseline-brush-dab/1' as const,
  x: 16,
  y: 16,
  radius: 8,
  opacity: 1,
});

describe('M5B mask painting', () => {
  it('paints hide coverage into a canonical RGBA8 mask tile without changing distant pixels', () => {
    const source = new Uint8Array(32 * 32 * 4);
    for (let offset = 0; offset < source.byteLength; offset += 4) {
      source[offset] = 255;
      source[offset + 1] = 255;
      source[offset + 2] = 255;
      source[offset + 3] = 255;
    }
    const result = rasterizeMaskCoverageTileV1(source, {
      tileDocumentX: 0,
      tileDocumentY: 0,
      width: 32,
      height: 32,
      paintValue: 0,
      dabs: [centerDab],
    });
    const center = (16 * 32 + 16) * 4;
    expect(result[center]).toBeLessThan(16);
    expect(result[0]).toBe(255);
    expect(result[center + 3]).toBe(255);
  });

  it('materializes sparse default coverage, persists the edited tile and applies it as one snapshot revision', async () => {
    const { snapshot, layer, mask } = fixture(1);
    const persistence = new FakePersistence();
    const prepared = await prepareMaskPaintV1(
      snapshot,
      layer.id,
      mask.id,
      0,
      [centerDab],
      persistence,
    );
    expect(prepared.tiles).toHaveLength(1);
    expect(persistence.writes).toHaveLength(1);
    const bytes = persistence.tiles.get(prepared.tiles[0]?.payloadRef ?? '')?.bytes;
    expect(bytes?.[(16 * 32 + 16) * 4]).toBeLessThan(16);
    expect(bytes?.[0]).toBe(255);

    const next = applyPreparedMaskPaintV1(snapshot, prepared, parseRevision(1), new Date(0));
    const nextLayer = next.document.layerTree.layers[layer.id];
    const nextMask = nextLayer?.masks.find((entry) => entry.id === mask.id);
    expect(next.document.revision).toBe(1);
    expect(next.document.modifiedAt).toBe(new Date(0).toISOString());
    expect(nextLayer?.revision).toBe(1);
    expect(nextMask?.revision).toBe(1);
    expect(nextMask?.kind === 'raster-mask' ? nextMask.tiles : []).toHaveLength(1);
  });

  it('can reveal into an existing zero-coverage tile and rejects a stale prepared commit', async () => {
    const { snapshot, layer, mask } = fixture(0);
    const persistence = new FakePersistence();
    const hidden = new Uint8Array(32 * 32 * 4);
    for (let offset = 3; offset < hidden.byteLength; offset += 4) hidden[offset] = 255;
    const existing = await persistence.persistRasterTile({
      width: 32,
      height: 32,
      pixelFormat: 'rgba8-unorm',
      bytes: hidden,
    });
    const existingMask = Object.freeze({
      ...mask,
      tiles: Object.freeze([
        Object.freeze({ x: 0, y: 0, revision: parseRevision(0), payloadRef: existing.payloadRef }),
      ]),
    });
    const existingLayer = Object.freeze({ ...layer, masks: Object.freeze([existingMask]) });
    const existingSnapshot = Object.freeze({
      ...snapshot,
      document: Object.freeze({
        ...snapshot.document,
        layerTree: Object.freeze({
          rootLayerIds: snapshot.document.layerTree.rootLayerIds,
          layers: Object.freeze({ [layer.id]: existingLayer }),
        }),
      }),
    });
    const prepared = await prepareMaskPaintV1(
      existingSnapshot,
      layer.id,
      mask.id,
      1,
      [centerDab],
      persistence,
    );
    const revealed = persistence.tiles.get(prepared.tiles[0]?.payloadRef ?? '')?.bytes;
    expect(revealed?.[(16 * 32 + 16) * 4]).toBeGreaterThan(239);
    const stale = Object.freeze({
      ...existingSnapshot,
      document: Object.freeze({ ...existingSnapshot.document, revision: parseRevision(1) }),
    });
    expect(() => applyPreparedMaskPaintV1(stale, prepared, parseRevision(2))).toThrow(
      /document changed/,
    );
  });
});
