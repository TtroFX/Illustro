import { describe, expect, it } from 'vitest';
import {
  applyPreparedSelectionScopedFillV1,
  applySelectionScopedRasterFillBytesV1,
  prepareSelectionScopedFillV1,
  selectionScopedFillEligibilityV1,
} from '../../src/app/selection-fill-engine.js';
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
  options: Parameters<typeof createRasterLayer>[0] = { name: 'Fill Source' },
): Promise<RasterLayerV1> {
  const persisted = await persistence.persistRasterTile({ width, height, pixelFormat, bytes });
  return createRasterLayer({
    ...options,
    name: options.name ?? 'Fill Source',
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

describe('M7A selection-scoped fill', () => {
  it('fills selected pixels on an empty Raster Layer and commits one canonical artwork revision', async () => {
    const persistence = new MemoryRasterPersistence();
    const layer = createRasterLayer({ name: 'Empty' });
    const snapshot = snapshotWith(layer, 2, 1);
    const coverage = await coverageV1(persistence, [255, 0]);

    const prepared = await prepareSelectionScopedFillV1(
      snapshot,
      layer.id,
      coverage,
      { color: [1, 0, 0] },
      persistence,
    );
    expect(prepared.selectionSourceRevision).toBe(7);
    expect(prepared.tiles).toHaveLength(1);
    const tile = await persistence.readRasterTile(prepared.tiles[0]?.payloadRef ?? '');
    expect([...tile.bytes]).toEqual([255, 0, 0, 255, 0, 0, 0, 0]);

    const committed = applyPreparedSelectionScopedFillV1(
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
  });

  it('uses fractional selection coverage as source-over fill opacity and preserves outside pixels', () => {
    const result = applySelectionScopedRasterFillBytesV1(
      new Uint8Array([0, 0, 255, 255, 20, 30, 40, 50]),
      'rgba8-unorm',
      [1, 0, 0],
      1,
      new Uint8Array([128, 0]),
      0,
      2,
      1,
    );
    expect([...result.bytes]).toEqual([128, 0, 127, 255, 20, 30, 40, 50]);
  });

  it('honors alpha lock by preserving alpha and refusing to create pixels in transparent areas', () => {
    const result = applySelectionScopedRasterFillBytesV1(
      new Uint8Array([0, 0, 255, 128, 10, 20, 30, 0]),
      'rgba8-unorm',
      [1, 0, 0],
      1,
      null,
      1,
      2,
      1,
      true,
    );
    expect([...result.bytes]).toEqual([255, 0, 0, 128, 10, 20, 30, 0]);
  });

  it('supports RGBA16F soft selection and straight-alpha compositing', () => {
    const result = applySelectionScopedRasterFillBytesV1(
      rgba16Bytes([0, 0, 0, 0]),
      'rgba16-float',
      [0, 1, 0],
      1,
      new Uint8Array([128]),
      0,
      1,
      1,
    );
    const view = new DataView(
      result.bytes.buffer,
      result.bytes.byteOffset,
      result.bytes.byteLength,
    );
    expect(halfToFloat(view.getUint16(0, true))).toBeCloseTo(0, 3);
    expect(halfToFloat(view.getUint16(2, true))).toBeCloseTo(1, 3);
    expect(halfToFloat(view.getUint16(4, true))).toBeCloseTo(0, 3);
    expect(halfToFloat(view.getUint16(6, true))).toBeCloseTo(128 / 255, 3);
  });

  it('materializes every canonical tile when effective default selection coverage is full', async () => {
    const persistence = new MemoryRasterPersistence();
    const layer = createRasterLayer({ name: 'Wide Empty' });
    const snapshot = snapshotWith(layer, 129, 1);
    const prepared = await prepareSelectionScopedFillV1(
      snapshot,
      layer.id,
      fullCoverageV1(),
      { color: [0, 0, 1], opacity: 0.5 },
      persistence,
    );
    expect(prepared.tiles.map((tile) => [tile.x, tile.y])).toEqual([
      [0, 0],
      [1, 0],
    ]);
    const edge = await persistence.readRasterTile(prepared.tiles[1]?.payloadRef ?? '');
    expect(edge.width).toBe(1);
    expect([...edge.bytes]).toEqual([0, 0, 255, 128]);
  });

  it('honors inverted coverage and rejects unavailable or stale targets', async () => {
    const persistence = new MemoryRasterPersistence();
    const layer = await rasterLayerV1(
      persistence,
      2,
      1,
      'rgba8-unorm',
      new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0]),
    );
    const snapshot = snapshotWith(layer, 2, 1);
    const inverted = await coverageV1(persistence, [255, 0], {
      defaultCoverage: 0,
      inverted: true,
    });
    const prepared = await prepareSelectionScopedFillV1(
      snapshot,
      layer.id,
      inverted,
      { color: [1, 1, 0] },
      persistence,
    );
    const tile = await persistence.readRasterTile(prepared.tiles[0]?.payloadRef ?? '');
    expect([...tile.bytes]).toEqual([0, 0, 0, 0, 255, 255, 0, 255]);

    expect(selectionScopedFillEligibilityV1(snapshot, layer.id, null)).toMatchObject({
      eligible: false,
      reason: expect.stringContaining('active selection'),
    });
    const pixelLocked = createRasterLayer({ name: 'Locked', locks: { pixels: true } });
    expect(
      selectionScopedFillEligibilityV1(
        snapshotWith(pixelLocked, 1, 1),
        pixelLocked.id,
        fullCoverageV1(),
      ),
    ).toMatchObject({ eligible: false, reason: expect.stringContaining('pixel lock') });
    const transformedCoverage = Object.freeze({
      ...fullCoverageV1(),
      transformStack: Object.freeze([createTransformNode('affine')]),
    });
    expect(selectionScopedFillEligibilityV1(snapshot, layer.id, transformedCoverage)).toMatchObject(
      { eligible: false, reason: expect.stringContaining('coverage') },
    );

    const changedSnapshot = Object.freeze({
      ...snapshot,
      document: Object.freeze({ ...snapshot.document, revision: parseRevision(2) }),
    });
    expect(() => applyPreparedSelectionScopedFillV1(changedSnapshot, prepared, 10)).toThrow(
      'document changed before commit',
    );
  });

  it('blocks transformed/effected raster targets and alpha-lock changes before commit', async () => {
    const persistence = new MemoryRasterPersistence();
    const transformed = createRasterLayer({
      name: 'Transformed',
      transformStack: [createTransformNode('affine')],
    });
    expect(
      selectionScopedFillEligibilityV1(
        snapshotWith(transformed, 1, 1),
        transformed.id,
        fullCoverageV1(),
      ),
    ).toMatchObject({ eligible: false, reason: expect.stringContaining('transform') });
    const effected = createRasterLayer({
      name: 'Effected',
      effectStack: [createEffectNode('test.effect')],
    });
    expect(
      selectionScopedFillEligibilityV1(snapshotWith(effected, 1, 1), effected.id, fullCoverageV1()),
    ).toMatchObject({ eligible: false, reason: expect.stringContaining('effect') });

    const layer = createRasterLayer({ name: 'Alpha state' });
    const snapshot = snapshotWith(layer, 1, 1);
    const prepared = await prepareSelectionScopedFillV1(
      snapshot,
      layer.id,
      fullCoverageV1(),
      { color: [1, 0, 1] },
      persistence,
    );
    const changedLayer = Object.freeze({
      ...layer,
      locks: Object.freeze({ ...layer.locks, alpha: true }),
    });
    const changedSnapshot = Object.freeze({
      ...snapshot,
      document: Object.freeze({
        ...snapshot.document,
        layerTree: Object.freeze({
          ...snapshot.document.layerTree,
          layers: Object.freeze({ [layer.id]: changedLayer }),
        }),
      }),
    });
    expect(() => applyPreparedSelectionScopedFillV1(changedSnapshot, prepared, 11)).toThrow(
      'alpha-lock state changed',
    );
  });
});
