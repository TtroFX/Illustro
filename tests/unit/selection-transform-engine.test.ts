import { describe, expect, it } from 'vitest';
import type { RasterMergePersistencePortV1 } from '../../src/app/layer-raster-merge.js';
import type {
  PaintDecodedRasterTileV1,
  PaintPersistedRasterTileV1,
  PaintRasterTilePixelFormatV1,
} from '../../src/app/paint-persistence-controller.js';
import type { PaintProjectSnapshotV1 } from '../../src/app/paint-session-controller.js';
import type { RasterSelectionCoverageV1 } from '../../src/app/selection-coverage-controller.js';
import {
  applyPreparedSelectionTransformV1,
  prepareSelectionAffineTransformV1,
  selectionAffineMatrixV1,
  selectionTransformEligibilityV1,
  type SelectionAffineTransformInputV1,
} from '../../src/app/selection-transform-engine.js';
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

const TRANSLATE_ONE: SelectionAffineTransformInputV1 = Object.freeze({
  translateX: 1,
  translateY: 0,
  scaleX: 1,
  scaleY: 1,
  rotationDeg: 0,
  pivotX: 0,
  pivotY: 0,
});

function snapshotWith(layer: RasterLayerV1, width: number, height: number): PaintProjectSnapshotV1 {
  const document = createDocumentV1({ width, height });
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

function snapshotWithPrecision(
  layer: RasterLayerV1,
  width: number,
  height: number,
  precision: 'rgba8-unorm' | 'rgba16-float',
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
    committedStrokes: Object.freeze([]),
  });
}

async function rasterLayerV1(
  persistence: MemoryRasterPersistence,
  width: number,
  height: number,
  pixelFormat: PaintRasterTilePixelFormatV1,
  bytes: Uint8Array,
  options: Parameters<typeof createRasterLayer>[0] = { name: 'Transform Source' },
): Promise<RasterLayerV1> {
  const persisted = await persistence.persistRasterTile({ width, height, pixelFormat, bytes });
  return createRasterLayer({
    ...options,
    name: options.name ?? 'Transform Source',
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
    defaultCoverage: 0 as const,
    tiles: Object.freeze([
      createRasterTileReference({ x: 0, y: 0, payloadRef: persisted.payloadRef }),
    ]),
    inverted: false,
    transformStack: Object.freeze([]),
    effectStack: Object.freeze([]),
    sourceRevision: parseRevision(7),
  });
}

async function committedBytesV1(
  persistence: MemoryRasterPersistence,
  snapshot: PaintProjectSnapshotV1,
  layerId: RasterLayerV1['id'],
): Promise<Uint8Array> {
  const layer = snapshot.document.layerTree.layers[layerId];
  if (layer?.type !== 'raster') throw new Error('expected committed Raster Layer');
  const reference = layer.tiles[0];
  if (reference === undefined) return new Uint8Array();
  return (await persistence.readRasterTile(reference.payloadRef)).bytes;
}

function rgba8Pixels(bytes: Uint8Array): readonly (readonly [number, number, number, number])[] {
  const pixels: (readonly [number, number, number, number])[] = [];
  for (let offset = 0; offset < bytes.byteLength; offset += 4) {
    pixels.push(
      Object.freeze([
        bytes[offset] ?? 0,
        bytes[offset + 1] ?? 0,
        bytes[offset + 2] ?? 0,
        bytes[offset + 3] ?? 0,
      ]),
    );
  }
  return Object.freeze(pixels);
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

function rgba16PixelBytes(
  pixels: readonly (readonly [number, number, number, number])[],
): Uint8Array {
  const bytes = new Uint8Array(pixels.length * 8);
  const view = new DataView(bytes.buffer);
  for (let pixel = 0; pixel < pixels.length; pixel += 1) {
    const rgba = pixels[pixel] ?? [0, 0, 0, 0];
    const offset = pixel * 8;
    for (let channel = 0; channel < 4; channel += 1) {
      view.setUint16(offset + channel * 2, floatToHalf(rgba[channel] ?? 0), true);
    }
  }
  return bytes;
}

describe('M7A selection-scoped transform', () => {
  it('moves only selected RGBA8 pixels and recomposites them into the same Raster Layer', async () => {
    const persistence = new MemoryRasterPersistence();
    const source = await rasterLayerV1(
      persistence,
      4,
      1,
      'rgba8-unorm',
      new Uint8Array([0, 0, 255, 255, 255, 0, 0, 255, 0, 255, 0, 255, 255, 255, 0, 255]),
    );
    const selection = await coverageV1(persistence, [0, 255, 255, 0]);
    const snapshot = snapshotWith(source, 4, 1);

    expect(selectionTransformEligibilityV1(snapshot, source.id, selection)).toEqual({
      eligible: true,
      layerId: source.id,
      reason: null,
    });
    const prepared = await prepareSelectionAffineTransformV1(
      snapshot,
      source.id,
      selection,
      TRANSLATE_ONE,
      persistence,
    );
    expect(prepared.matrix).toEqual([1, 0, 0, 1, 1, 0]);
    expect(prepared.resampling).toBe('nearest-neighbor');

    const committed = applyPreparedSelectionTransformV1(
      snapshot,
      prepared,
      parseRevision(9),
      new Date(10),
    );
    expect(committed.document.revision).toBe(9);
    expect(committed.document.modifiedAt).toBe(new Date(10).toISOString());
    expect(committed.document.layerTree.rootLayerIds).toBe(
      snapshot.document.layerTree.rootLayerIds,
    );
    expect(rgba8Pixels(await committedBytesV1(persistence, committed, source.id))).toEqual([
      [0, 0, 255, 255],
      [255, 0, 0, 0],
      [255, 0, 0, 255],
      [0, 255, 0, 255],
    ]);
  });

  it('uses inverse-mapped nearest-neighbor rasterization for affine scale without moving unselected pixels', async () => {
    const persistence = new MemoryRasterPersistence();
    const source = await rasterLayerV1(
      persistence,
      5,
      1,
      'rgba8-unorm',
      new Uint8Array([0, 0, 0, 0, 220, 10, 20, 255, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
    );
    const selection = await coverageV1(persistence, [0, 255, 0, 0, 0]);
    const snapshot = snapshotWith(source, 5, 1);
    const prepared = await prepareSelectionAffineTransformV1(
      snapshot,
      source.id,
      selection,
      {
        translateX: 0,
        translateY: 0,
        scaleX: 2,
        scaleY: 1,
        rotationDeg: 0,
        pivotX: 0,
        pivotY: 0,
      },
      persistence,
    );
    expect(prepared.matrix).toEqual([2, 0, 0, 1, 0, 0]);
    const committed = applyPreparedSelectionTransformV1(snapshot, prepared, 3);
    const pixels = rgba8Pixels(await committedBytesV1(persistence, committed, source.id));
    expect(pixels[1]?.[3]).toBe(0);
    expect(pixels[2]).toEqual([220, 10, 20, 255]);
    expect(pixels[3]).toEqual([220, 10, 20, 255]);
  });

  it('supports canonical RGBA16F selected content without degrading the document precision', async () => {
    const persistence = new MemoryRasterPersistence();
    const source = await rasterLayerV1(
      persistence,
      3,
      1,
      'rgba16-float',
      rgba16PixelBytes([
        [0, 0, 0, 0],
        [1, 0.25, 0.5, 1],
        [0, 0, 0, 0],
      ]),
    );
    const selection = await coverageV1(persistence, [0, 255, 0]);
    const snapshot = snapshotWithPrecision(source, 3, 1, 'rgba16-float');
    const prepared = await prepareSelectionAffineTransformV1(
      snapshot,
      source.id,
      selection,
      TRANSLATE_ONE,
      persistence,
    );
    const committed = applyPreparedSelectionTransformV1(snapshot, prepared, 4);
    const bytes = await committedBytesV1(persistence, committed, source.id);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    expect(halfToFloat(view.getUint16(1 * 8 + 6, true))).toBe(0);
    expect(halfToFloat(view.getUint16(2 * 8, true))).toBeCloseTo(1, 3);
    expect(halfToFloat(view.getUint16(2 * 8 + 2, true))).toBeCloseTo(0.25, 3);
    expect(halfToFloat(view.getUint16(2 * 8 + 4, true))).toBeCloseTo(0.5, 3);
    expect(halfToFloat(view.getUint16(2 * 8 + 6, true))).toBeCloseTo(1, 3);
  });

  it('fails closed for missing selection, position locks, transformed selection coverage, and invalid affine inputs', async () => {
    const persistence = new MemoryRasterPersistence();
    const source = await rasterLayerV1(
      persistence,
      2,
      1,
      'rgba8-unorm',
      new Uint8Array([10, 20, 30, 255, 40, 50, 60, 255]),
    );
    const selection = await coverageV1(persistence, [255, 0]);
    const snapshot = snapshotWith(source, 2, 1);

    expect(selectionTransformEligibilityV1(snapshot, source.id, null)).toMatchObject({
      eligible: false,
      reason: expect.stringContaining('active selection'),
    });

    const positionLocked = Object.freeze({
      ...source,
      locks: Object.freeze({ ...source.locks, position: true }),
    }) as RasterLayerV1;
    expect(
      selectionTransformEligibilityV1(snapshotWith(positionLocked, 2, 1), source.id, selection),
    ).toMatchObject({ eligible: false, reason: expect.stringContaining('position lock') });

    const transformedSelection = Object.freeze({
      ...selection,
      transformStack: Object.freeze([
        createTransformNode('affine', { matrix: Object.freeze([1, 0, 0, 1, 1, 0]) }),
      ]),
    });
    expect(
      selectionTransformEligibilityV1(snapshot, source.id, transformedSelection),
    ).toMatchObject({
      eligible: false,
      reason: expect.stringContaining('baked'),
    });

    await expect(
      prepareSelectionAffineTransformV1(
        snapshot,
        source.id,
        selection,
        {
          ...TRANSLATE_ONE,
          translateX: 0,
        },
        persistence,
      ),
    ).rejects.toThrow('no changes');
    expect(() => selectionAffineMatrixV1({ ...TRANSLATE_ONE, scaleX: 0 })).toThrow(
      'greater than zero',
    );
    expect(() => selectionAffineMatrixV1({ ...TRANSLATE_ONE, rotationDeg: Number.NaN })).toThrow(
      'must be finite',
    );
  });

  it('rejects stale prepared commits and lock changes before the atomic layer replacement', async () => {
    const persistence = new MemoryRasterPersistence();
    const source = await rasterLayerV1(
      persistence,
      2,
      1,
      'rgba8-unorm',
      new Uint8Array([255, 0, 0, 255, 0, 0, 0, 0]),
    );
    const selection = await coverageV1(persistence, [255, 0]);
    const snapshot = snapshotWith(source, 2, 1);
    const prepared = await prepareSelectionAffineTransformV1(
      snapshot,
      source.id,
      selection,
      TRANSLATE_ONE,
      persistence,
    );

    const stale = Object.freeze({
      ...snapshot,
      document: Object.freeze({ ...snapshot.document, revision: parseRevision(1) }),
    });
    expect(() => applyPreparedSelectionTransformV1(stale, prepared, 2)).toThrow('document changed');

    const locked = Object.freeze({
      ...source,
      locks: Object.freeze({ ...source.locks, position: true }),
    }) as RasterLayerV1;
    const lockedSnapshot = snapshotWith(locked, 2, 1);
    expect(() => applyPreparedSelectionTransformV1(lockedSnapshot, prepared, 2)).toThrow(
      'layer lock',
    );
  });
});
