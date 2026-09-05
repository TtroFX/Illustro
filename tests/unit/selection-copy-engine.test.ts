import { describe, expect, it } from 'vitest';
import {
  prepareSelectionCopyV1,
  selectionCopyEligibilityV1,
} from '../../src/app/selection-copy-engine.js';
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
  createTransformNode,
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
  layer: RasterLayerV1,
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

async function rasterLayerV1(
  persistence: MemoryRasterPersistence,
  width: number,
  height: number,
  pixelFormat: PaintRasterTilePixelFormatV1,
  bytes: Uint8Array,
  options: Parameters<typeof createRasterLayer>[0] = { name: 'Copy Source' },
): Promise<RasterLayerV1> {
  const persisted = await persistence.persistRasterTile({ width, height, pixelFormat, bytes });
  return createRasterLayer({
    ...options,
    name: options.name ?? 'Copy Source',
    tiles: [createRasterTileReference({ x: 0, y: 0, payloadRef: persisted.payloadRef })],
  });
}

async function coverageV1(
  persistence: MemoryRasterPersistence,
  values: readonly number[],
  options: { readonly defaultCoverage?: 0 | 1; readonly inverted?: boolean } = {},
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
    defaultCoverage: options.defaultCoverage ?? 0,
    tiles: Object.freeze([
      createRasterTileReference({ x: 0, y: 0, payloadRef: persisted.payloadRef }),
    ]),
    inverted: options.inverted ?? false,
    transformStack: Object.freeze([]),
    effectStack: Object.freeze([]),
    sourceRevision: parseRevision(7),
  });
}

function allSelectionV1(inverted = false): RasterSelectionCoverageV1 {
  return Object.freeze({
    schema: 'illustro.raster-selection-coverage/1' as const,
    defaultCoverage: 1 as const,
    tiles: Object.freeze([]),
    inverted,
    transformStack: Object.freeze([]),
    effectStack: Object.freeze([]),
    sourceRevision: parseRevision(8),
  });
}

function floatToHalf(value: number): number {
  const clamped = Math.min(1, Math.max(0, value));
  if (clamped === 0) return 0;
  const float = new Float32Array([clamped]);
  const bits = new Uint32Array(float.buffer)[0] ?? 0;
  let exponent = ((bits >>> 23) & 0xff) - 127 + 15;
  let fraction = bits & 0x7fffff;
  if (exponent <= 0) {
    if (exponent < -10) return 0;
    fraction = (fraction | 0x800000) >>> (1 - exponent);
    return (fraction + 0x1000) >>> 13;
  }
  if (exponent >= 31) return 0x7c00;
  fraction += 0x1000;
  if ((fraction & 0x800000) !== 0) {
    fraction = 0;
    exponent += 1;
  }
  return exponent >= 31 ? 0x7c00 : (exponent << 10) | (fraction >>> 13);
}

function halfToFloat(value: number): number {
  const exponent = (value >>> 10) & 0x1f;
  const fraction = value & 0x03ff;
  if (exponent === 0) return 2 ** -14 * (fraction / 1024);
  if (exponent === 0x1f) return fraction === 0 ? Number.POSITIVE_INFINITY : Number.NaN;
  return 2 ** (exponent - 15) * (1 + fraction / 1024);
}

function unbakedStroke(layerId: string): PaintProjectSnapshotV1['committedStrokes'][number] {
  return Object.freeze({
    stroke: Object.freeze({
      schema: 'illustro.paint-stroke/1' as const,
      strokeId: '22222222-2222-4222-8222-222222222222',
      pointerId: 2,
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

describe('M7A selection copy', () => {
  it('copies soft RGBA8 selection without mutating the document and permits locked source pixels', async () => {
    const persistence = new MemoryRasterPersistence();
    const source = await rasterLayerV1(
      persistence,
      3,
      1,
      'rgba8-unorm',
      new Uint8Array([10, 20, 30, 200, 40, 50, 60, 200, 70, 80, 90, 200]),
      { name: 'Locked Copy', locks: { all: true, pixels: true, alpha: true } },
    );
    const selection = await coverageV1(persistence, [0, 128, 255]);
    const snapshot = snapshotWith(source, 3, 1);
    const before = JSON.stringify(snapshot);
    const writesBeforeCopy = persistence.writes.length;

    expect(selectionCopyEligibilityV1(snapshot, source.id, selection).eligible).toBe(true);
    const transfer = await prepareSelectionCopyV1(snapshot, source.id, selection, persistence);

    expect(transfer.schema).toBe('illustro.selection-transfer/1');
    expect(transfer.sourceLayerId).toBe(source.id);
    expect(transfer.sourceRevision).toBe(source.revision);
    expect(transfer.documentRevision).toBe(snapshot.document.revision);
    expect(transfer.selectionSourceRevision).toBe(selection.sourceRevision);
    expect(transfer.tiles).toHaveLength(1);
    expect(persistence.writes.length - writesBeforeCopy).toBe(1);
    const copied = await persistence.readRasterTile(transfer.tiles[0]?.payloadRef ?? '');
    expect([...copied.bytes]).toEqual([10, 20, 30, 0, 40, 50, 60, 100, 70, 80, 90, 200]);
    expect(JSON.stringify(snapshot)).toBe(before);
    expect(snapshot.document.layerTree.layers[source.id]).toBe(source);
  });

  it('honors inverted coverage and rejects an inverted all-selection as empty', async () => {
    const persistence = new MemoryRasterPersistence();
    const source = await rasterLayerV1(
      persistence,
      2,
      1,
      'rgba8-unorm',
      new Uint8Array([1, 2, 3, 200, 4, 5, 6, 200]),
    );
    const selection = await coverageV1(persistence, [0, 255], { inverted: true });
    const transfer = await prepareSelectionCopyV1(
      snapshotWith(source, 2, 1),
      source.id,
      selection,
      persistence,
    );
    const copied = await persistence.readRasterTile(transfer.tiles[0]?.payloadRef ?? '');
    expect(copied.bytes[3]).toBe(200);
    expect(copied.bytes[7]).toBe(0);

    expect(
      selectionCopyEligibilityV1(snapshotWith(source, 2, 1), source.id, allSelectionV1(true)),
    ).toMatchObject({ eligible: false, reason: expect.stringContaining('non-empty') });
  });

  it('copies RGBA16F soft alpha while preserving straight RGB channels', async () => {
    const persistence = new MemoryRasterPersistence();
    const bytes = new Uint8Array(8);
    const sourceView = new DataView(bytes.buffer);
    sourceView.setUint16(0, floatToHalf(0.25), true);
    sourceView.setUint16(2, floatToHalf(0.5), true);
    sourceView.setUint16(4, floatToHalf(0.75), true);
    sourceView.setUint16(6, floatToHalf(0.8), true);
    const source = await rasterLayerV1(persistence, 1, 1, 'rgba16-float', bytes);
    const selection = await coverageV1(persistence, [128]);

    const transfer = await prepareSelectionCopyV1(
      snapshotWith(source, 1, 1, 'rgba16-float'),
      source.id,
      selection,
      persistence,
    );
    const copied = await persistence.readRasterTile(transfer.tiles[0]?.payloadRef ?? '');
    const copiedView = new DataView(
      copied.bytes.buffer,
      copied.bytes.byteOffset,
      copied.bytes.byteLength,
    );
    expect(halfToFloat(copiedView.getUint16(6, true))).toBeCloseTo(0.8 * (128 / 255), 3);
    expect(copiedView.getUint16(0, true)).toBe(sourceView.getUint16(0, true));
    expect(copiedView.getUint16(2, true)).toBe(sourceView.getUint16(2, true));
    expect(copiedView.getUint16(4, true)).toBe(sourceView.getUint16(4, true));
  });

  it('materializes unbaked strokes for transfer without marking the snapshot stroke baked', async () => {
    const persistence = new MemoryRasterPersistence();
    const source = createRasterLayer({ name: 'Live Copy' });
    const snapshot = snapshotWith(
      source,
      64,
      64,
      'rgba8-unorm',
      Object.freeze([unbakedStroke(source.id)]),
    );

    const transfer = await prepareSelectionCopyV1(
      snapshot,
      source.id,
      allSelectionV1(),
      persistence,
    );
    expect(transfer.tiles.length).toBeGreaterThan(0);
    expect(snapshot.document.layerTree.layers[source.id]).toBe(source);
    expect(snapshot.committedStrokes[0]?.bakedToRasterLayer).toBe(false);
    expect(source.tiles).toEqual([]);
  });

  it('fails closed for missing selection, unbaked transforms, and non-intersecting coverage', async () => {
    const persistence = new MemoryRasterPersistence();
    const source = await rasterLayerV1(
      persistence,
      1,
      1,
      'rgba8-unorm',
      new Uint8Array([1, 2, 3, 255]),
    );
    const snapshot = snapshotWith(source, 1, 1);
    expect(selectionCopyEligibilityV1(snapshot, source.id, null)).toMatchObject({
      eligible: false,
      reason: expect.stringContaining('active selection'),
    });

    const transformed = await rasterLayerV1(
      persistence,
      1,
      1,
      'rgba8-unorm',
      new Uint8Array([1, 2, 3, 255]),
      {
        name: 'Transformed Copy',
        transformStack: [createTransformNode({})],
      },
    );
    expect(
      selectionCopyEligibilityV1(
        snapshotWith(transformed, 1, 1),
        transformed.id,
        allSelectionV1(),
      ),
    ).toMatchObject({ eligible: false, reason: expect.stringContaining('transform') });

    const zeroCoverage = await coverageV1(persistence, [0]);
    await expect(
      prepareSelectionCopyV1(snapshot, source.id, zeroCoverage, persistence),
    ).rejects.toThrow('does not intersect');
  });
});
