import { describe, expect, it } from 'vitest';
import {
  applyLayerAlphaSelectionModeV1,
  layerAlphaSelectionEligibilityV1,
  prepareLayerAlphaSelectionV1,
} from '../../src/app/selection-alpha-engine.js';
import { SelectionCoverageControllerV1 } from '../../src/app/selection-coverage-controller.js';
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
  createRasterTileReference,
  createTransformNode,
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
  layer: ReturnType<typeof createRasterLayer> | ReturnType<typeof createFillLayer>,
  width: number,
  height: number,
  precision: 'rgba8-unorm' | 'rgba16-float' = 'rgba8-unorm',
  committedStrokes: PaintProjectSnapshotV1['committedStrokes'] = Object.freeze([]),
): PaintProjectSnapshotV1 {
  const document = createDocumentV1({ width, height, precision });
  return Object.freeze({
    schema: 'illustro.paint-project-snapshot/1' as const,
    document: Object.freeze({
      ...document,
      layerTree: Object.freeze({
        rootLayerIds: Object.freeze([layer.id]),
        layers: Object.freeze({ [layer.id]: layer }),
      }),
    }),
    committedStrokes,
  });
}

async function sourceRasterV1(
  persistence: MemoryRasterPersistence,
  width: number,
  height: number,
  pixelFormat: PaintRasterTilePixelFormatV1,
  bytes: Uint8Array,
  options: { readonly visible?: boolean; readonly opacity?: number } = {},
): Promise<ReturnType<typeof createRasterLayer>> {
  const persisted = await persistence.persistRasterTile({ width, height, pixelFormat, bytes });
  return createRasterLayer({
    name: 'Alpha Source',
    visible: options.visible,
    opacity: options.opacity,
    tiles: [createRasterTileReference({ x: 0, y: 0, payloadRef: persisted.payloadRef })],
  });
}

async function coverageBytesV1(
  prepared: Awaited<ReturnType<typeof prepareLayerAlphaSelectionV1>>,
  persistence: MemoryRasterPersistence,
): Promise<readonly number[]> {
  const reference = prepared.tiles[0];
  if (reference === undefined) return Object.freeze([]);
  const decoded = await persistence.readRasterTile(reference.payloadRef);
  const values: number[] = [];
  for (let offset = 0; offset < decoded.bytes.length; offset += 4) {
    values.push(decoded.bytes[offset] ?? 0);
  }
  return Object.freeze(values);
}

function unbakedStroke(layerId: string): PaintProjectSnapshotV1['committedStrokes'][number] {
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

describe('M7A alpha/transparency to selection', () => {
  it('copies RGBA8 intrinsic alpha exactly into soft selection coverage', async () => {
    const persistence = new MemoryRasterPersistence();
    const source = await sourceRasterV1(
      persistence,
      4,
      1,
      'rgba8-unorm',
      new Uint8Array([10, 20, 30, 0, 10, 20, 30, 64, 10, 20, 30, 128, 10, 20, 30, 255]),
      { visible: false, opacity: 0.2 },
    );
    const snapshot = snapshotWith(source, 4, 1);

    const prepared = await prepareLayerAlphaSelectionV1(snapshot, source.id, {
      revision: parseRevision(3),
      persistence,
    });

    expect(prepared.defaultCoverage).toBe(0);
    expect(prepared.tiles).toHaveLength(1);
    expect(await coverageBytesV1(prepared, persistence)).toEqual([0, 64, 128, 255]);
  });

  it('keeps fully transparent sparse raster content as an empty selection', async () => {
    const persistence = new MemoryRasterPersistence();
    const source = await sourceRasterV1(
      persistence,
      2,
      1,
      'rgba8-unorm',
      new Uint8Array([255, 0, 0, 0, 0, 255, 0, 0]),
    );
    const snapshot = snapshotWith(source, 2, 1);

    const prepared = await prepareLayerAlphaSelectionV1(snapshot, source.id, {
      revision: parseRevision(4),
      persistence,
    });

    expect(prepared).toMatchObject({ defaultCoverage: 0, tiles: [] });
  });

  it('decodes RGBA16F alpha into canonical 8-bit soft selection coverage', async () => {
    const persistence = new MemoryRasterPersistence();
    const bytes = new Uint8Array(3 * 8);
    const view = new DataView(bytes.buffer);
    view.setUint16(6, 0x0000, true);
    view.setUint16(14, 0x3800, true);
    view.setUint16(22, 0x3c00, true);
    const source = await sourceRasterV1(persistence, 3, 1, 'rgba16-float', bytes);
    const snapshot = snapshotWith(source, 3, 1, 'rgba16-float');

    const prepared = await prepareLayerAlphaSelectionV1(snapshot, source.id, {
      revision: parseRevision(5),
      persistence,
    });

    expect(await coverageBytesV1(prepared, persistence)).toEqual([0, 128, 255]);
  });

  it('maps solid Fill Layer alpha to full-canvas selection without applying layer opacity', async () => {
    const persistence = new MemoryRasterPersistence();
    const document = createDocumentV1({ width: 130, height: 1 });
    const fill = createFillLayer({
      name: 'Half Alpha',
      opacity: 0.1,
      visible: false,
      fill: {
        kind: 'solid',
        color: { space: document.color.workingSpace, rgba: [0.1, 0.2, 0.3, 0.5] },
      },
    });
    const snapshot = snapshotWith(fill, 130, 1);

    const prepared = await prepareLayerAlphaSelectionV1(snapshot, fill.id, {
      revision: parseRevision(6),
      persistence,
    });

    expect(prepared.defaultCoverage).toBe(0);
    expect(prepared.tiles).toHaveLength(2);
    for (const reference of prepared.tiles) {
      const decoded = await persistence.readRasterTile(reference.payloadRef);
      expect(decoded.bytes[0]).toBe(128);
    }

    const opaque = createFillLayer({
      name: 'Opaque',
      fill: {
        kind: 'solid',
        color: { space: document.color.workingSpace, rgba: [0, 0, 0, 1] },
      },
    });
    const opaquePrepared = await prepareLayerAlphaSelectionV1(
      snapshotWith(opaque, 130, 1),
      opaque.id,
      {
        revision: parseRevision(7),
        persistence,
      },
    );
    expect(opaquePrepared).toMatchObject({ defaultCoverage: 1, tiles: [] });
  });

  it('includes unbaked raster strokes when deriving intrinsic alpha', async () => {
    const persistence = new MemoryRasterPersistence();
    const source = createRasterLayer({ name: 'Live Paint' });
    const snapshot = snapshotWith(
      source,
      64,
      64,
      'rgba8-unorm',
      Object.freeze([unbakedStroke(source.id)]),
    );

    const prepared = await prepareLayerAlphaSelectionV1(snapshot, source.id, {
      revision: parseRevision(8),
      persistence,
    });

    expect(prepared.tiles.length).toBeGreaterThan(0);
    const reference = prepared.tiles[0];
    if (reference === undefined) throw new Error('unbaked stroke alpha did not create selection coverage');
    const decoded = await persistence.readRasterTile(reference.payloadRef);
    expect(decoded.bytes[(20 * decoded.width + 20) * 4]).toBeGreaterThan(0);
  });

  it('applies the derived alpha through the existing selection combine path', async () => {
    const persistence = new MemoryRasterPersistence();
    const source = await sourceRasterV1(
      persistence,
      1,
      1,
      'rgba8-unorm',
      new Uint8Array([255, 255, 255, 200]),
    );
    const snapshot = snapshotWith(source, 1, 1);
    const controller = new SelectionCoverageControllerV1();

    const result = await applyLayerAlphaSelectionModeV1(
      controller,
      snapshot,
      source.id,
      'replace',
      { revision: parseRevision(9), persistence },
    );

    expect(result.coverage).not.toBeNull();
    expect(controller.snapshot()).toEqual(result);
    if (result.coverage === null) throw new Error('alpha selection unexpectedly cleared');
    const reference = result.coverage.tiles[0];
    if (reference === undefined) throw new Error('alpha selection did not create coverage tile');
    const decoded = await persistence.readRasterTile(reference.payloadRef);
    expect(decoded.bytes[0]).toBe(200);
  });

  it('rejects transformed sources until alpha can be rendered in document coordinates', async () => {
    const persistence = new MemoryRasterPersistence();
    const source = createRasterLayer({
      name: 'Transformed',
      transformStack: [createTransformNode('affine')],
    });
    const snapshot = snapshotWith(source, 16, 16);

    expect(layerAlphaSelectionEligibilityV1(snapshot, source.id)).toMatchObject({
      eligible: false,
      reason: expect.stringContaining('transform'),
    });
    await expect(
      prepareLayerAlphaSelectionV1(snapshot, source.id, {
        revision: parseRevision(10),
        persistence,
      }),
    ).rejects.toThrow(/transform/i);
  });
});
