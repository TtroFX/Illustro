import { parseRevision, type LayerId, type Revision } from '../domain/identity.js';
import type { RasterLayerV1, RasterTileReferenceV1 } from '../domain/layers.js';
import { tileBoundsForDocumentV1 } from '../gpu/sparse-tile-model.js';
import type {
  PaintDecodedRasterTileV1,
  PaintRasterTilePixelFormatV1,
} from './paint-persistence-controller.js';
import type { PaintProjectSnapshotV1 } from './paint-session-controller.js';
import type {
  PreparedRasterMergeTileV1,
  RasterMergePersistencePortV1,
} from './layer-raster-merge.js';
import { prepareLayerRasterizeV1 } from './layer-rasterize.js';
import type { RasterSelectionCoverageV1 } from './selection-coverage-controller.js';

export const SELECTION_SCOPED_RASTER_FILTER_IDS_V1 = ['invert-rgb'] as const;
export type SelectionScopedRasterFilterIdV1 =
  (typeof SELECTION_SCOPED_RASTER_FILTER_IDS_V1)[number];

export interface SelectionScopedFilterEligibilityV1 {
  readonly eligible: boolean;
  readonly layerId: LayerId;
  readonly reason: string | null;
}

export interface PreparedSelectionScopedFilterV1 {
  readonly schema: 'illustro.prepared-selection-scoped-filter/1';
  readonly layerId: LayerId;
  readonly filterId: SelectionScopedRasterFilterIdV1;
  readonly sourceRevision: Revision;
  readonly documentRevision: Revision;
  readonly selectionSourceRevision: Revision;
  readonly tiles: readonly PreparedRasterMergeTileV1[];
}

interface DecodedCoverageTileV1 {
  readonly width: number;
  readonly height: number;
  readonly values: Uint8Array<ArrayBuffer>;
}

function unavailable(layerId: LayerId, reason: string): SelectionScopedFilterEligibilityV1 {
  return Object.freeze({ eligible: false, layerId, reason });
}

function hasUnbakedLayerStrokeV1(snapshot: PaintProjectSnapshotV1, layerId: LayerId): boolean {
  return snapshot.committedStrokes.some(
    (entry) => entry.stroke.layerId === layerId && entry.bakedToRasterLayer !== true,
  );
}

function effectiveDefaultCoverageV1(coverage: RasterSelectionCoverageV1): 0 | 1 {
  return coverage.inverted ? (coverage.defaultCoverage === 1 ? 0 : 1) : coverage.defaultCoverage;
}

function assertSupportedFilterV1(
  filterId: SelectionScopedRasterFilterIdV1,
): SelectionScopedRasterFilterIdV1 {
  if (!SELECTION_SCOPED_RASTER_FILTER_IDS_V1.includes(filterId)) {
    throw new RangeError(`unsupported selection-scoped raster filter: ${String(filterId)}`);
  }
  return filterId;
}

export function selectionScopedFilterEligibilityV1(
  snapshot: PaintProjectSnapshotV1,
  layerId: LayerId,
  coverage: RasterSelectionCoverageV1 | null,
): SelectionScopedFilterEligibilityV1 {
  const layer = snapshot.document.layerTree.layers[layerId];
  if (layer === undefined) {
    return unavailable(layerId, 'selection-scoped filter target layer is missing');
  }
  if (layer.type !== 'raster') {
    return unavailable(layerId, 'selection-scoped filter currently requires a Raster Layer');
  }
  if (layer.locks.all || layer.locks.pixels) {
    return unavailable(layerId, 'selection-scoped filter is blocked by the layer pixel lock');
  }
  if (layer.transformStack.length > 0) {
    return unavailable(
      layerId,
      'selection-scoped filter on a transformed layer requires canonical transform baking',
    );
  }
  if (layer.effectStack.length > 0) {
    return unavailable(
      layerId,
      'selection-scoped filter on an effected layer requires effect rendering',
    );
  }
  if (coverage === null) {
    return unavailable(layerId, 'selection-scoped filter requires an active selection');
  }
  if (coverage.transformStack.length > 0) {
    return unavailable(
      layerId,
      'selection-scoped filter requires transformed selection coverage to be baked',
    );
  }
  if (coverage.effectStack.length > 0) {
    return unavailable(
      layerId,
      'selection-scoped filter requires effected selection coverage to be baked',
    );
  }
  if (effectiveDefaultCoverageV1(coverage) === 0 && coverage.tiles.length === 0) {
    return unavailable(layerId, 'selection-scoped filter requires non-empty selection coverage');
  }
  if ((layer as RasterLayerV1).tiles.length === 0 && !hasUnbakedLayerStrokeV1(snapshot, layerId)) {
    return unavailable(layerId, 'selection-scoped filter requires raster content');
  }
  return Object.freeze({ eligible: true, layerId, reason: null });
}

function tileKeyV1(x: number, y: number): string {
  return `${x}:${y}`;
}

function bytesPerPixelV1(format: PaintRasterTilePixelFormatV1): 4 | 8 {
  return format === 'rgba8-unorm' ? 4 : 8;
}

function validateSourceTileV1(
  tile: PaintDecodedRasterTileV1,
  format: PaintRasterTilePixelFormatV1,
  width: number,
  height: number,
): void {
  if (tile.pixelFormat !== format || tile.width !== width || tile.height !== height) {
    throw new Error(
      'selection-scoped filter source tile does not match the document raster contract',
    );
  }
  if (tile.bytes.byteLength !== width * height * bytesPerPixelV1(format)) {
    throw new Error('selection-scoped filter source tile byte length is invalid');
  }
}

function validateCoverageTileV1(
  tile: PaintDecodedRasterTileV1,
  width: number,
  height: number,
): Uint8Array<ArrayBuffer> {
  if (tile.pixelFormat !== 'rgba8-unorm' || tile.width !== width || tile.height !== height) {
    throw new Error(
      'selection-scoped filter coverage tile does not match canonical RGBA8 coverage',
    );
  }
  if (tile.bytes.byteLength !== width * height * 4) {
    throw new Error('selection-scoped filter coverage tile byte length is invalid');
  }
  const values = new Uint8Array(width * height);
  for (let pixel = 0; pixel < values.length; pixel += 1) {
    const offset = pixel * 4;
    const red = tile.bytes[offset] ?? 0;
    const green = tile.bytes[offset + 1] ?? 0;
    const blue = tile.bytes[offset + 2] ?? 0;
    const alpha = tile.bytes[offset + 3] ?? 0;
    if (red !== green || red !== blue || alpha !== 255) {
      throw new Error(
        'selection-scoped filter coverage tile violates canonical grayscale encoding',
      );
    }
    values[pixel] = red;
  }
  return values;
}

async function decodeCoverageTilesV1(
  snapshot: PaintProjectSnapshotV1,
  coverage: RasterSelectionCoverageV1,
  persistence: RasterMergePersistencePortV1,
): Promise<ReadonlyMap<string, DecodedCoverageTileV1>> {
  const decoded = new Map<string, DecodedCoverageTileV1>();
  const width = snapshot.document.canvas.width;
  const height = snapshot.document.canvas.height;
  for (const reference of coverage.tiles) {
    const key = tileKeyV1(reference.x, reference.y);
    if (decoded.has(key)) {
      throw new Error(`duplicate selection-scoped filter coverage tile: ${key}`);
    }
    const bounds = tileBoundsForDocumentV1(width, height, {
      tx: reference.x,
      ty: reference.y,
    });
    const payload = await persistence.readRasterTile(reference.payloadRef);
    let values = validateCoverageTileV1(payload, bounds.validWidth, bounds.validHeight);
    if (coverage.inverted) {
      const inverted = new Uint8Array(values.length);
      for (let pixel = 0; pixel < values.length; pixel += 1) {
        inverted[pixel] = 255 - (values[pixel] ?? 0);
      }
      values = inverted;
    }
    decoded.set(
      key,
      Object.freeze({
        width: bounds.validWidth,
        height: bounds.validHeight,
        values,
      }),
    );
  }
  return decoded;
}

async function sourceTilesV1(
  snapshot: PaintProjectSnapshotV1,
  layer: RasterLayerV1,
  persistence: RasterMergePersistencePortV1,
): Promise<readonly PreparedRasterMergeTileV1[]> {
  if (hasUnbakedLayerStrokeV1(snapshot, layer.id)) {
    return (await prepareLayerRasterizeV1(snapshot, layer.id, persistence)).tiles;
  }
  return Object.freeze(
    layer.tiles.map((tile) => Object.freeze({ x: tile.x, y: tile.y, payloadRef: tile.payloadRef })),
  );
}

function halfToFloatV1(value: number): number {
  const sign = (value & 0x8000) !== 0 ? -1 : 1;
  const exponent = (value >>> 10) & 0x1f;
  const fraction = value & 0x03ff;
  if (exponent === 0) return sign * 2 ** -14 * (fraction / 1024);
  if (exponent === 0x1f) {
    return fraction === 0 ? sign * Number.POSITIVE_INFINITY : Number.NaN;
  }
  return sign * 2 ** (exponent - 15) * (1 + fraction / 1024);
}

function floatToHalfV1(value: number): number {
  const float = new Float32Array([value]);
  const bits = new Uint32Array(float.buffer)[0] ?? 0;
  const sign = (bits >>> 16) & 0x8000;
  const sourceExponent = (bits >>> 23) & 0xff;
  let fraction = bits & 0x7fffff;
  if (sourceExponent === 0xff) {
    return sign | (fraction === 0 ? 0x7c00 : 0x7e00);
  }
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
    if (exponent >= 31) return sign | 0x7c00;
  }
  return sign | (exponent << 10) | (fraction >>> 13);
}

function filterCoverageAtV1(
  coverage: Uint8Array | null,
  pixel: number,
  defaultCoverage: 0 | 1,
): number {
  return coverage?.[pixel] ?? (defaultCoverage === 1 ? 255 : 0);
}

export function applySelectionScopedRasterFilterBytesV1(
  bytes: Uint8Array,
  format: PaintRasterTilePixelFormatV1,
  filterId: SelectionScopedRasterFilterIdV1,
  coverage: Uint8Array | null,
  defaultCoverage: 0 | 1,
  width: number,
  height: number,
): Readonly<{ bytes: Uint8Array<ArrayBuffer>; changed: boolean }> {
  assertSupportedFilterV1(filterId);
  const bytesPerPixel = bytesPerPixelV1(format);
  if (bytes.byteLength !== width * height * bytesPerPixel) {
    throw new RangeError('selection-scoped filter source byte length does not match dimensions');
  }
  if (coverage !== null && coverage.length !== width * height) {
    throw new RangeError('selection-scoped filter coverage length does not match dimensions');
  }
  const output = new Uint8Array(bytes);
  let changed = false;

  if (format === 'rgba8-unorm') {
    for (let pixel = 0; pixel < width * height; pixel += 1) {
      const selectionByte = filterCoverageAtV1(coverage, pixel, defaultCoverage);
      if (selectionByte === 0) continue;
      const selection = selectionByte / 255;
      const offset = pixel * 4;
      for (let channel = 0; channel < 3; channel += 1) {
        const source = bytes[offset + channel] ?? 0;
        const filtered = 255 - source;
        const result =
          selectionByte === 255 ? filtered : Math.round(source + (filtered - source) * selection);
        if (result !== source) changed = true;
        output[offset + channel] = result;
      }
    }
    return Object.freeze({ bytes: output, changed });
  }

  const sourceView = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const targetView = new DataView(output.buffer, output.byteOffset, output.byteLength);
  for (let pixel = 0; pixel < width * height; pixel += 1) {
    const selectionByte = filterCoverageAtV1(coverage, pixel, defaultCoverage);
    if (selectionByte === 0) continue;
    const selection = selectionByte / 255;
    const offset = pixel * 8;
    for (let channel = 0; channel < 3; channel += 1) {
      const channelOffset = offset + channel * 2;
      const sourceBits = sourceView.getUint16(channelOffset, true);
      const source = halfToFloatV1(sourceBits);
      if (!Number.isFinite(source)) {
        throw new Error('selection-scoped filter requires finite RGBA16F color values');
      }
      const filtered = 1 - source;
      const result = selectionByte === 255 ? filtered : source + (filtered - source) * selection;
      const resultBits = floatToHalfV1(result);
      if (resultBits !== sourceBits) changed = true;
      targetView.setUint16(channelOffset, resultBits, true);
    }
  }
  return Object.freeze({ bytes: output, changed });
}

export async function prepareSelectionScopedFilterV1(
  snapshot: PaintProjectSnapshotV1,
  layerId: LayerId,
  coverage: RasterSelectionCoverageV1 | null,
  filterId: SelectionScopedRasterFilterIdV1,
  persistence: RasterMergePersistencePortV1,
): Promise<PreparedSelectionScopedFilterV1> {
  assertSupportedFilterV1(filterId);
  const eligibility = selectionScopedFilterEligibilityV1(snapshot, layerId, coverage);
  if (!eligibility.eligible) {
    throw new Error(eligibility.reason ?? 'selection-scoped filter is unavailable');
  }
  if (coverage === null) throw new Error('selection-scoped filter selection disappeared');
  const source = snapshot.document.layerTree.layers[layerId];
  if (source?.type !== 'raster') throw new Error('selection-scoped filter source changed');

  const width = snapshot.document.canvas.width;
  const height = snapshot.document.canvas.height;
  const pixelFormat = snapshot.document.color.precision;
  const defaultCoverage = effectiveDefaultCoverageV1(coverage);
  const coverageTiles = await decodeCoverageTilesV1(snapshot, coverage, persistence);
  const materialized = await sourceTilesV1(snapshot, source as RasterLayerV1, persistence);
  const tiles: PreparedRasterMergeTileV1[] = [];
  let changedTileCount = 0;

  for (const reference of [...materialized].sort(
    (left, right) => left.y - right.y || left.x - right.x,
  )) {
    const bounds = tileBoundsForDocumentV1(width, height, {
      tx: reference.x,
      ty: reference.y,
    });
    const decoded = await persistence.readRasterTile(reference.payloadRef);
    validateSourceTileV1(decoded, pixelFormat, bounds.validWidth, bounds.validHeight);
    const selectionTile = coverageTiles.get(tileKeyV1(reference.x, reference.y));
    if (
      selectionTile !== undefined &&
      (selectionTile.width !== bounds.validWidth || selectionTile.height !== bounds.validHeight)
    ) {
      throw new Error('selection-scoped filter coverage tile dimensions changed during prepare');
    }

    const filtered = applySelectionScopedRasterFilterBytesV1(
      decoded.bytes,
      pixelFormat,
      filterId,
      selectionTile?.values ?? null,
      defaultCoverage,
      bounds.validWidth,
      bounds.validHeight,
    );
    if (!filtered.changed) {
      tiles.push(
        Object.freeze({
          x: reference.x,
          y: reference.y,
          payloadRef: reference.payloadRef,
        }),
      );
      continue;
    }
    const persisted = await persistence.persistRasterTile({
      width: bounds.validWidth,
      height: bounds.validHeight,
      pixelFormat,
      bytes: filtered.bytes,
    });
    changedTileCount += 1;
    tiles.push(
      Object.freeze({
        x: reference.x,
        y: reference.y,
        payloadRef: persisted.payloadRef,
      }),
    );
  }

  if (changedTileCount === 0) {
    throw new Error(
      'selection-scoped filter does not intersect raster content or produces no pixel changes',
    );
  }

  return Object.freeze({
    schema: 'illustro.prepared-selection-scoped-filter/1' as const,
    layerId,
    filterId,
    sourceRevision: source.revision,
    documentRevision: snapshot.document.revision,
    selectionSourceRevision: coverage.sourceRevision,
    tiles: Object.freeze(tiles),
  });
}

export function applyPreparedSelectionScopedFilterV1(
  snapshot: PaintProjectSnapshotV1,
  prepared: PreparedSelectionScopedFilterV1,
  revisionValue: Revision | number,
  now: Date = new Date(),
): PaintProjectSnapshotV1 {
  assertSupportedFilterV1(prepared.filterId);
  const revision = parseRevision(revisionValue);
  if (snapshot.document.revision !== prepared.documentRevision) {
    throw new Error('selection-scoped filter document changed before commit');
  }
  const source = snapshot.document.layerTree.layers[prepared.layerId];
  if (source?.type !== 'raster' || source.revision !== prepared.sourceRevision) {
    throw new Error('selection-scoped filter source changed before commit');
  }
  if (source.locks.all || source.locks.pixels) {
    throw new Error('selection-scoped filter became blocked by the layer pixel lock');
  }
  if (source.transformStack.length > 0 || source.effectStack.length > 0) {
    throw new Error(
      'selection-scoped filter source gained an unbaked transform/effect before commit',
    );
  }

  const filtered = Object.freeze({
    ...source,
    revision,
    boundsHint: null,
    tiles: Object.freeze(
      prepared.tiles.map(
        (tile): RasterTileReferenceV1 =>
          Object.freeze({
            x: tile.x,
            y: tile.y,
            revision,
            payloadRef: tile.payloadRef,
          }),
      ),
    ),
  }) as RasterLayerV1;
  const committedStrokes = snapshot.committedStrokes.map((entry) =>
    entry.stroke.layerId === prepared.layerId
      ? Object.freeze({ ...entry, bakedToRasterLayer: true })
      : entry,
  );

  return Object.freeze({
    schema: 'illustro.paint-project-snapshot/1' as const,
    document: Object.freeze({
      ...snapshot.document,
      revision,
      modifiedAt: now.toISOString(),
      layerTree: Object.freeze({
        rootLayerIds: snapshot.document.layerTree.rootLayerIds,
        layers: Object.freeze({
          ...snapshot.document.layerTree.layers,
          [prepared.layerId]: filtered,
        }),
      }),
    }),
    committedStrokes: Object.freeze(committedStrokes),
  });
}
