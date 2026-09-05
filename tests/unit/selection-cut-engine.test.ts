import { describe, expect, it } from 'vitest';
import { parseRevision } from '../../src/domain/identity.js';
import {
  createRasterLayer,
  createRasterTileReference,
  createTransformNode,
  type RasterLayerV1,
} from '../../src/domain/layers.js';
import {
  applyPreparedSelectionCutV1,
  prepareSelectionCutV1,
  selectionCutEligibilityV1,
} from '../../src/app/selection-cut-engine.js';
import type { RasterMergePersistencePortV1 } from '../../src/app/layer-raster-merge.js';
import type {
  PaintDecodedRasterTileV1,
  PaintPersistedRasterTileV1,
  PaintRasterTilePixelFormatV1,
} from '../../src/app/paint-persistence-controller.js';
import type { PaintProjectSnapshotV1 } from '../../src/app/paint-session-controller.js';
import type { RasterSelectionCoverageV1 } from '../../src/app/selection-coverage-controller.js';
import { createDocumentV1 } from '../../src/domain/document.js';

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
  options: Parameters<typeof createRasterLayer>[0] = { name: 'Cut Source' },
): Promise<RasterLayerV1> {
  const persisted = await persistence.persistRasterTile({ width, height, pixelFormat, bytes });
  return createRasterLayer({
    ...options,
    name: options.name ?? 'Cut Source',
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

async function decodedBytesV1(
  persistence: MemoryRasterPersistence,
  payloadRef: string,
): Promise<Uint8Array> {
  return (await persistence.readRasterTile(payloadRef)).bytes;
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

describe('M7A selection cut', () => {
  it('splits RGBA8 alpha by soft selection while preserving straight RGB and alpha mass', async () => {
    const persistence = new MemoryRasterPersistence();
    const source = await rasterLayerV1(
      persistence,
      3,
      1,
      'rgba8-unorm',
      new Uint8Array([10, 20, 30, 200, 40, 50, 60, 200, 70, 80, 90, 200]),
    );
    const selection = await coverageV1(persistence, [0, 128, 255]);
    const prepared = await prepareSelectionCutV1(
      snapshotWith(source, 3, 1),
      source.id,
      selection,
      persistence,
    );

    expect(prepared.remainingTiles).toHaveLength(1);
    expect(prepared.transfer.tiles).toHaveLength(1);
    const remaining = await decodedBytesV1(
      persistence,
      prepared.remainingTiles[0]?.payloadRef ?? '',
    );
    const selected = await decodedBytesV1(
      persistence,
      prepared.transfer.tiles[0]?.payloadRef ?? '',
    );
    expect([...remaining]).toEqual([10, 20, 30, 200, 40, 50, 60, 100, 70, 80, 90, 0]);
    expect([...selected]).toEqual([10, 20, 30, 0, 40, 50, 60, 100, 70, 80, 90, 200]);
    for (const pixel of [0, 1, 2]) {
      expect((remaining[pixel * 4 + 3] ?? 0) + (selected[pixel * 4 + 3] ?? 0)).toBe(200);
    }
  });

  it('cuts an all-selected sparse raster completely and retains source pixels in transfer', async () => {
    const persistence = new MemoryRasterPersistence();
    const source = await rasterLayerV1(
      persistence,
      1,
      1,
      'rgba8-unorm',
      new Uint8Array([12, 34, 56, 210]),
      { name: 'All Selected', opacity: 0.2, visible: false },
    );
    const prepared = await prepareSelectionCutV1(
      snapshotWith(source, 1, 1),
      source.id,
      allSelectionV1(),
      persistence,
    );

    expect(prepared.remainingTiles).toEqual([]);
    const selected = await decodedBytesV1(
      persistence,
      prepared.transfer.tiles[0]?.payloadRef ?? '',
    );
    expect([...selected]).toEqual([12, 34, 56, 210]);
  });

  it('honors inverted selection coverage', async () => {
    const persistence = new MemoryRasterPersistence();
    const source = await rasterLayerV1(
      persistence,
      2,
      1,
      'rgba8-unorm',
      new Uint8Array([1, 2, 3, 200, 4, 5, 6, 200]),
    );
    const selection = await coverageV1(persistence, [0, 255], { inverted: true });
    const prepared = await prepareSelectionCutV1(
      snapshotWith(source, 2, 1),
      source.id,
      selection,
      persistence,
    );
    const selected = await decodedBytesV1(
      persistence,
      prepared.transfer.tiles[0]?.payloadRef ?? '',
    );
    expect(selected[3]).toBe(200);
    expect(selected[7]).toBe(0);
  });

  it('splits RGBA16F alpha with soft coverage', async () => {
    const persistence = new MemoryRasterPersistence();
    const bytes = new Uint8Array(8);
    const view = new DataView(bytes.buffer);
    view.setUint16(0, floatToHalf(0.25), true);
    view.setUint16(2, floatToHalf(0.5), true);
    view.setUint16(4, floatToHalf(0.75), true);
    view.setUint16(6, floatToHalf(0.8), true);
    const source = await rasterLayerV1(persistence, 1, 1, 'rgba16-float', bytes);
    const selection = await coverageV1(persistence, [128]);
    const prepared = await prepareSelectionCutV1(
      snapshotWith(source, 1, 1, 'rgba16-float'),
      source.id,
      selection,
      persistence,
    );
    const remaining = await decodedBytesV1(
      persistence,
      prepared.remainingTiles[0]?.payloadRef ?? '',
    );
    const selected = await decodedBytesV1(
      persistence,
      prepared.transfer.tiles[0]?.payloadRef ?? '',
    );
    const remainingView = new DataView(
      remaining.buffer,
      remaining.byteOffset,
      remaining.byteLength,
    );
    const selectedView = new DataView(selected.buffer, selected.byteOffset, selected.byteLength);
    expect(halfToFloat(selectedView.getUint16(6, true))).toBeCloseTo(0.8 * (128 / 255), 3);
    expect(halfToFloat(remainingView.getUint16(6, true))).toBeCloseTo(0.8 * (127 / 255), 3);
    expect(selectedView.getUint16(0, true)).toBe(view.getUint16(0, true));
    expect(remainingView.getUint16(4, true)).toBe(view.getUint16(4, true));
  });

  it('materializes unbaked strokes and marks them baked when the cut commits', async () => {
    const persistence = new MemoryRasterPersistence();
    const source = createRasterLayer({ name: 'Live Paint' });
    const snapshot = snapshotWith(
      source,
      64,
      64,
      'rgba8-unorm',
      Object.freeze([unbakedStroke(source.id)]),
    );
    const prepared = await prepareSelectionCutV1(
      snapshot,
      source.id,
      allSelectionV1(),
      persistence,
    );
    expect(prepared.transfer.tiles.length).toBeGreaterThan(0);

    const applied = applyPreparedSelectionCutV1(snapshot, prepared, parseRevision(12));
    const layer = applied.document.layerTree.layers[source.id];
    expect(layer?.type).toBe('raster');
    if (layer?.type !== 'raster') throw new Error('cut raster target disappeared');
    expect(layer.tiles).toEqual([]);
    expect(applied.committedStrokes[0]?.bakedToRasterLayer).toBe(true);
  });

  it('rejects alpha/pixel locks and unbaked source or selection transforms', async () => {
    const persistence = new MemoryRasterPersistence();
    const alphaLocked = await rasterLayerV1(
      persistence,
      1,
      1,
      'rgba8-unorm',
      new Uint8Array([1, 1, 1, 255]),
      { name: 'Locked', locks: { alpha: true } },
    );
    expect(
      selectionCutEligibilityV1(snapshotWith(alphaLocked, 1, 1), alphaLocked.id, allSelectionV1()),
    ).toMatchObject({ eligible: false, reason: expect.stringContaining('lock') });

    const transformed = await rasterLayerV1(
      persistence,
      1,
      1,
      'rgba8-unorm',
      new Uint8Array([1, 1, 1, 255]),
      { name: 'Transformed', transformStack: [createTransformNode('affine')] },
    );
    expect(
      selectionCutEligibilityV1(snapshotWith(transformed, 1, 1), transformed.id, allSelectionV1()),
    ).toMatchObject({ eligible: false, reason: expect.stringContaining('transform') });

    const selection = Object.freeze({
      ...allSelectionV1(),
      transformStack: Object.freeze([createTransformNode('affine')]),
    });
    const normal = await rasterLayerV1(
      persistence,
      1,
      1,
      'rgba8-unorm',
      new Uint8Array([1, 1, 1, 255]),
    );
    expect(
      selectionCutEligibilityV1(snapshotWith(normal, 1, 1), normal.id, selection),
    ).toMatchObject({ eligible: false, reason: expect.stringContaining('selection') });
  });

  it('rejects a non-intersecting selection rather than creating a no-op cut', async () => {
    const persistence = new MemoryRasterPersistence();
    const source = await rasterLayerV1(
      persistence,
      2,
      1,
      'rgba8-unorm',
      new Uint8Array([1, 2, 3, 255, 4, 5, 6, 255]),
    );
    const selection = await coverageV1(persistence, [0, 0]);
    await expect(
      prepareSelectionCutV1(snapshotWith(source, 2, 1), source.id, selection, persistence),
    ).rejects.toThrow(/non-empty selection|does not intersect/i);
  });

  it('rejects a stale prepared cut at commit time', async () => {
    const persistence = new MemoryRasterPersistence();
    const source = await rasterLayerV1(
      persistence,
      1,
      1,
      'rgba8-unorm',
      new Uint8Array([1, 2, 3, 255]),
    );
    const snapshot = snapshotWith(source, 1, 1);
    const prepared = await prepareSelectionCutV1(
      snapshot,
      source.id,
      allSelectionV1(),
      persistence,
    );
    const changed = Object.freeze({
      ...snapshot,
      document: Object.freeze({
        ...snapshot.document,
        revision: parseRevision(Number(snapshot.document.revision) + 1),
      }),
    });
    expect(() => applyPreparedSelectionCutV1(changed, prepared, parseRevision(20))).toThrow(
      /document changed/i,
    );
  });
});
