import { describe, expect, it } from 'vitest';
import {
  applyPreparedSelectionScopedFilterV1,
  applySelectionScopedRasterFilterBytesV1,
  prepareSelectionScopedFilterV1,
  selectionScopedFilterEligibilityV1,
} from '../../src/app/selection-filter-engine.js';
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
  createEffectNode,
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
  precision: PaintRasterTilePixelFormatV1 = 'rgba8-unorm',
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
  options: Parameters<typeof createRasterLayer>[0] = { name: 'Filter Source' },
): Promise<RasterLayerV1> {
  const persisted = await persistence.persistRasterTile({ width, height, pixelFormat, bytes });
  return createRasterLayer({
    ...options,
    name: options.name ?? 'Filter Source',
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

function fullCoverageV1(): RasterSelectionCoverageV1 {
  return Object.freeze({
    schema: 'illustro.raster-selection-coverage/1' as const,
    defaultCoverage: 1,
    tiles: Object.freeze([]),
    inverted: false,
    transformStack: Object.freeze([]),
    effectStack: Object.freeze([]),
    sourceRevision: parseRevision(8),
  });
}

function floatToHalf(value: number): number {
  const float = new Float32Array([value]);
  const bits = new Uint32Array(float.buffer)[0] ?? 0;
  const sign = (bits >>> 16) & 0x8000;
  const sourceExponent = (bits >>> 23) & 0xff;
  let fraction = bits & 0x7fffff;
  if (sourceExponent === 0xff) return sign | (fraction === 0 ? 0x7c00 : 0x7e00);
  let exponent = sourceExponent - 127 + 15;
  if (exponent <= 0) {
    if (exponent < -10) return sign;
    fraction = (fraction | 0x800000) >>> (1 - exponent);
    return sign | ((fraction + 0x1000) >>> 13);
  }
  if (exponent >= 31) return sign | 0x7c00;
  fraction += 0x1000;
  if ((fraction & 0x800000) !== 0) {
    fraction = 0;
    exponent += 1;
  }
  return exponent >= 31 ? sign | 0x7c00 : sign | (exponent << 10) | (fraction >>> 13);
}

function halfToFloat(value: number): number {
  const sign = (value & 0x8000) !== 0 ? -1 : 1;
  const exponent = (value >>> 10) & 0x1f;
  const fraction = value & 0x03ff;
  if (exponent === 0) return sign * 2 ** -14 * (fraction / 1024);
  if (exponent === 0x1f) {
    return fraction === 0 ? sign * Number.POSITIVE_INFINITY : Number.NaN;
  }
  return sign * 2 ** (exponent - 15) * (1 + fraction / 1024);
}

function rgba16Bytes(values: readonly [number, number, number, number]): Uint8Array {
  const bytes = new Uint8Array(8);
  const view = new DataView(bytes.buffer);
  for (let channel = 0; channel < 4; channel += 1) {
    view.setUint16(channel * 2, floatToHalf(values[channel] ?? 0), true);
  }
  return bytes;
}

describe('M7A selection-scoped filter', () => {
  it('applies image invert only inside hard selection coverage and preserves alpha/outside pixels', async () => {
    const persistence = new MemoryRasterPersistence();
    const sourceBytes = new Uint8Array([10, 20, 30, 200, 100, 110, 120, 210]);
    const layer = await rasterLayerV1(persistence, 2, 1, 'rgba8-unorm', sourceBytes);
    const snapshot = snapshotWith(layer, 2, 1);
    const coverage = await coverageV1(persistence, [255, 0]);

    const prepared = await prepareSelectionScopedFilterV1(
      snapshot,
      layer.id,
      coverage,
      'invert-rgb',
      persistence,
    );
    expect(prepared.filterId).toBe('invert-rgb');
    expect(prepared.selectionSourceRevision).toBe(7);
    const filteredTile = await persistence.readRasterTile(prepared.tiles[0]?.payloadRef ?? '');
    expect([...filteredTile.bytes]).toEqual([245, 235, 225, 200, 100, 110, 120, 210]);

    const committed = applyPreparedSelectionScopedFilterV1(
      snapshot,
      prepared,
      parseRevision(9),
      new Date(10),
    );
    expect(committed.document.revision).toBe(9);
    expect(committed.document.modifiedAt).toBe(new Date(10).toISOString());
    const committedLayer = committed.document.layerTree.layers[layer.id];
    expect(committedLayer?.revision).toBe(9);
    expect(committedLayer?.type).toBe('raster');
  });

  it('uses fractional coverage as filter strength and honors inverted/default coverage semantics', async () => {
    const partial = applySelectionScopedRasterFilterBytesV1(
      new Uint8Array([10, 20, 30, 77]),
      'rgba8-unorm',
      'invert-rgb',
      new Uint8Array([128]),
      0,
      1,
      1,
    );
    expect([...partial.bytes]).toEqual([128, 128, 128, 77]);

    const persistence = new MemoryRasterPersistence();
    const sourceBytes = new Uint8Array([10, 20, 30, 200, 100, 110, 120, 210]);
    const layer = await rasterLayerV1(persistence, 2, 1, 'rgba8-unorm', sourceBytes);
    const snapshot = snapshotWith(layer, 2, 1);
    const invertedCoverage = await coverageV1(persistence, [255, 0], {
      defaultCoverage: 0,
      inverted: true,
    });
    const prepared = await prepareSelectionScopedFilterV1(
      snapshot,
      layer.id,
      invertedCoverage,
      'invert-rgb',
      persistence,
    );
    const filteredTile = await persistence.readRasterTile(prepared.tiles[0]?.payloadRef ?? '');
    expect([...filteredTile.bytes]).toEqual([10, 20, 30, 200, 155, 145, 135, 210]);
  });

  it('supports RGBA16F soft selection while preserving alpha', async () => {
    const persistence = new MemoryRasterPersistence();
    const sourceBytes = rgba16Bytes([0.25, 0.5, 0.75, 0.4]);
    const layer = await rasterLayerV1(persistence, 1, 1, 'rgba16-float', sourceBytes);
    const snapshot = snapshotWith(layer, 1, 1, 'rgba16-float');
    const coverage = await coverageV1(persistence, [128]);
    const prepared = await prepareSelectionScopedFilterV1(
      snapshot,
      layer.id,
      coverage,
      'invert-rgb',
      persistence,
    );
    const tile = await persistence.readRasterTile(prepared.tiles[0]?.payloadRef ?? '');
    const view = new DataView(tile.bytes.buffer, tile.bytes.byteOffset, tile.bytes.byteLength);
    expect(halfToFloat(view.getUint16(0, true))).toBeCloseTo(0.501, 2);
    expect(halfToFloat(view.getUint16(2, true))).toBeCloseTo(0.5, 3);
    expect(halfToFloat(view.getUint16(4, true))).toBeCloseTo(0.499, 2);
    expect(halfToFloat(view.getUint16(6, true))).toBeCloseTo(0.4, 3);
  });

  it('keeps alpha-lock compatible with RGB-only invert but rejects pixel locks/live transforms/effects', async () => {
    const persistence = new MemoryRasterPersistence();
    const alphaLocked = await rasterLayerV1(
      persistence,
      1,
      1,
      'rgba8-unorm',
      new Uint8Array([10, 20, 30, 255]),
      { name: 'Alpha locked', locks: { alpha: true } },
    );
    const coverage = fullCoverageV1();
    expect(selectionScopedFilterEligibilityV1(snapshotWith(alphaLocked, 1, 1), alphaLocked.id, coverage))
      .toMatchObject({ eligible: true });

    const pixelLocked = await rasterLayerV1(
      persistence,
      1,
      1,
      'rgba8-unorm',
      new Uint8Array([10, 20, 30, 255]),
      { name: 'Pixel locked', locks: { pixels: true } },
    );
    expect(selectionScopedFilterEligibilityV1(snapshotWith(pixelLocked, 1, 1), pixelLocked.id, coverage))
      .toMatchObject({ eligible: false, reason: expect.stringContaining('pixel lock') });

    const transformed = await rasterLayerV1(
      persistence,
      1,
      1,
      'rgba8-unorm',
      new Uint8Array([10, 20, 30, 255]),
      { name: 'Transformed', transformStack: [createTransformNode('affine')] },
    );
    expect(selectionScopedFilterEligibilityV1(snapshotWith(transformed, 1, 1), transformed.id, coverage))
      .toMatchObject({ eligible: false, reason: expect.stringContaining('transform') });

    const effected = await rasterLayerV1(
      persistence,
      1,
      1,
      'rgba8-unorm',
      new Uint8Array([10, 20, 30, 255]),
      { name: 'Effected', effectStack: [createEffectNode('test.effect')] },
    );
    expect(selectionScopedFilterEligibilityV1(snapshotWith(effected, 1, 1), effected.id, coverage))
      .toMatchObject({ eligible: false, reason: expect.stringContaining('effect') });
  });

  it('rejects missing/derived selection coverage and stale prepared commits', async () => {
    const persistence = new MemoryRasterPersistence();
    const layer = await rasterLayerV1(
      persistence,
      1,
      1,
      'rgba8-unorm',
      new Uint8Array([20, 40, 60, 255]),
    );
    const snapshot = snapshotWith(layer, 1, 1);
    expect(selectionScopedFilterEligibilityV1(snapshot, layer.id, null)).toMatchObject({
      eligible: false,
      reason: expect.stringContaining('active selection'),
    });

    const transformedCoverage = Object.freeze({
      ...fullCoverageV1(),
      transformStack: Object.freeze([createTransformNode('affine')]),
    });
    expect(selectionScopedFilterEligibilityV1(snapshot, layer.id, transformedCoverage)).toMatchObject({
      eligible: false,
      reason: expect.stringContaining('coverage'),
    });

    const prepared = await prepareSelectionScopedFilterV1(
      snapshot,
      layer.id,
      fullCoverageV1(),
      'invert-rgb',
      persistence,
    );
    const changed = Object.freeze({
      ...snapshot,
      document: Object.freeze({ ...snapshot.document, revision: parseRevision(1) }),
    });
    expect(() => applyPreparedSelectionScopedFilterV1(changed, prepared, 2)).toThrow(
      'document changed',
    );
  });

  it('fails closed when active selection does not change any raster pixel', async () => {
    const persistence = new MemoryRasterPersistence();
    const layer = await rasterLayerV1(
      persistence,
      1,
      1,
      'rgba8-unorm',
      new Uint8Array([10, 20, 30, 255]),
    );
    const snapshot = snapshotWith(layer, 1, 1);
    const zeroCoverage = await coverageV1(persistence, [0]);
    await expect(
      prepareSelectionScopedFilterV1(snapshot, layer.id, zeroCoverage, 'invert-rgb', persistence),
    ).rejects.toThrow('does not intersect');
  });
});
