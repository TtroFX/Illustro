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

export interface SelectionCutEligibilityV1 {
  readonly eligible: boolean;
  readonly layerId: LayerId;
  readonly reason: string | null;
}

export interface SelectionTransferPayloadV1 {
  readonly schema: 'illustro.selection-transfer/1';
  readonly sourceLayerId: LayerId;
  readonly sourceRevision: Revision;
  readonly selectionSourceRevision: Revision;
  readonly documentRevision: Revision;
  readonly width: number;
  readonly height: number;
  readonly pixelFormat: PaintRasterTilePixelFormatV1;
  readonly tiles: readonly PreparedRasterMergeTileV1[];
}

export interface PreparedSelectionCutV1 {
  readonly schema: 'illustro.prepared-selection-cut/1';
  readonly layerId: LayerId;
  readonly sourceRevision: Revision;
  readonly documentRevision: Revision;
  readonly selectionSourceRevision: Revision;
  readonly remainingTiles: readonly PreparedRasterMergeTileV1[];
  readonly transfer: SelectionTransferPayloadV1;
}

interface DecodedCoverageTileV1 {
  readonly width: number;
  readonly height: number;
  readonly values: Uint8Array<ArrayBuffer>;
}

interface SplitRasterTileV1 {
  readonly remaining: Uint8Array<ArrayBuffer>;
  readonly selected: Uint8Array<ArrayBuffer>;
  readonly remainingHasAlpha: boolean;
  readonly selectedHasAlpha: boolean;
}

function unavailable(layerId: LayerId, reason: string): SelectionCutEligibilityV1 {
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

export function selectionCutEligibilityV1(
  snapshot: PaintProjectSnapshotV1,
  layerId: LayerId,
  coverage: RasterSelectionCoverageV1 | null,
): SelectionCutEligibilityV1 {
  const layer = snapshot.document.layerTree.layers[layerId];
  if (layer === undefined) return unavailable(layerId, 'selection cut target layer is missing');
  if (layer.type !== 'raster') {
    return unavailable(layerId, 'selection cut currently requires a Raster Layer');
  }
  if (layer.locks.all || layer.locks.pixels || layer.locks.alpha) {
    return unavailable(layerId, 'selection cut is blocked by the layer pixel/alpha lock');
  }
  if (layer.transformStack.length > 0) {
    return unavailable(
      layerId,
      'selection cut on a transformed layer requires canonical transform baking',
    );
  }
  if (layer.effectStack.length > 0) {
    return unavailable(layerId, 'selection cut on an effected layer requires effect rendering');
  }
  if (coverage === null) return unavailable(layerId, 'selection cut requires an active selection');
  if (coverage.transformStack.length > 0) {
    return unavailable(layerId, 'selection cut requires transformed selection coverage to be baked');
  }
  if (coverage.effectStack.length > 0) {
    return unavailable(layerId, 'selection cut requires effected selection coverage to be baked');
  }
  if (effectiveDefaultCoverageV1(coverage) === 0 && coverage.tiles.length === 0) {
    return unavailable(layerId, 'selection cut requires non-empty selection coverage');
  }
  if ((layer as RasterLayerV1).tiles.length === 0 && !hasUnbakedLayerStrokeV1(snapshot, layerId)) {
    return unavailable(layerId, 'selection cut requires raster content');
  }
  return Object.freeze({ eligible: true, layerId, reason: null });
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

function floatToHalf(value: number): number {
  const clamped = Math.min(1, Math.max(0, value));
  if (clamped === 0) return 0;
  const float = new Float32Array([clamped]);
  const bits = new Uint32Array(float.buffer)[0] ?? 0;
  const sign = (bits >>> 16) & 0x8000;
  let exponent = ((bits >>> 23) & 0xff) - 127 + 15;
  let fraction = bits & 0x7fffff;
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

function tileKeyV1(x: number, y: number): string {
  return `${x}:${y}`;
}

function validateSourceTileV1(
  tile: PaintDecodedRasterTileV1,
  format: PaintRasterTilePixelFormatV1,
  width: number,
  height: number,
): void {
  if (tile.pixelFormat !== format || tile.width !== width || tile.height !== height) {
    throw new Error('selection cut source tile does not match the document raster contract');
  }
  const bytesPerPixel = format === 'rgba8-unorm' ? 4 : 8;
  if (tile.bytes.byteLength !== width * height * bytesPerPixel) {
    throw new Error('selection cut source tile byte length is invalid');
  }
}

function validateCoverageTileV1(
  tile: PaintDecodedRasterTileV1,
  width: number,
  height: number,
): Uint8Array<ArrayBuffer> {
  if (tile.pixelFormat !== 'rgba8-unorm' || tile.width !== width || tile.height !== height) {
    throw new Error('selection cut coverage tile does not match canonical RGBA8 coverage');
  }
  if (tile.bytes.byteLength !== width * height * 4) {
    throw new Error('selection cut coverage tile byte length is invalid');
  }
  const values = new Uint8Array(width * height);
  for (let pixel = 0; pixel < values.length; pixel += 1) {
    const offset = pixel * 4;
    const red = tile.bytes[offset] ?? 0;
    const green = tile.bytes[offset + 1] ?? 0;
    const blue = tile.bytes[offset + 2] ?? 0;
    const alpha = tile.bytes[offset + 3] ?? 0;
    if (red !== green || red !== blue || alpha !== 255) {
      throw new Error('selection cut coverage tile violates canonical grayscale encoding');
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
  const result = new Map<string, DecodedCoverageTileV1>();
  const width = snapshot.document.canvas.width;
  const height = snapshot.document.canvas.height;
  for (const reference of coverage.tiles) {
    const key = tileKeyV1(reference.x, reference.y);
    if (result.has(key)) throw new Error(`duplicate selection cut coverage tile: ${key}`);
    const bounds = tileBoundsForDocumentV1(width, height, { tx: reference.x, ty: reference.y });
    const decoded = await persistence.readRasterTile(reference.payloadRef);
    let values = validateCoverageTileV1(decoded, bounds.validWidth, bounds.validHeight);
    if (coverage.inverted) {
      const inverted = new Uint8Array(values.length);
      for (let pixel = 0; pixel < values.length; pixel += 1) {
        inverted[pixel] = 255 - (values[pixel] ?? 0);
      }
      values = inverted;
    }
    result.set(
      key,
      Object.freeze({ width: bounds.validWidth, height: bounds.validHeight, values }),
    );
  }
  return result;
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

function splitStraightRgbaBytesV1(
  bytes: Uint8Array,
  format: PaintRasterTilePixelFormatV1,
  coverage: Uint8Array | null,
  defaultCoverage: 0 | 1,
  width: number,
  height: number,
): SplitRasterTileV1 {
  const bytesPerPixel = format === 'rgba8-unorm' ? 4 : 8;
  if (bytes.byteLength !== width * height * bytesPerPixel) {
    throw new RangeError('selection cut split source byte length does not match dimensions');
  }
  if (coverage !== null && coverage.length !== width * height) {
    throw new RangeError('selection cut split coverage length does not match dimensions');
  }
  const remaining = new Uint8Array(bytes);
  const selected = new Uint8Array(bytes);
  let remainingHasAlpha = false;
  let selectedHasAlpha = false;

  if (format === 'rgba8-unorm') {
    for (let pixel = 0; pixel < width * height; pixel += 1) {
      const offset = pixel * 4;
      const sourceAlpha = bytes[offset + 3] ?? 0;
      const selection = coverage?.[pixel] ?? (defaultCoverage === 1 ? 255 : 0);
      const selectedAlpha = Math.round((sourceAlpha * selection) / 255);
      const remainingAlpha = sourceAlpha - selectedAlpha;
      selected[offset + 3] = selectedAlpha;
      remaining[offset + 3] = remainingAlpha;
      if (selectedAlpha > 0) selectedHasAlpha = true;
      if (remainingAlpha > 0) remainingHasAlpha = true;
    }
  } else {
    const source = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const remainingView = new DataView(
      remaining.buffer,
      remaining.byteOffset,
      remaining.byteLength,
    );
    const selectedView = new DataView(selected.buffer, selected.byteOffset, selected.byteLength);
    for (let pixel = 0; pixel < width * height; pixel += 1) {
      const offset = pixel * 8;
      const rawAlpha = halfToFloat(source.getUint16(offset + 6, true));
      if (!Number.isFinite(rawAlpha)) {
        throw new Error('RGBA16F selection cut source contains non-finite alpha');
      }
      const sourceAlpha = Math.min(1, Math.max(0, rawAlpha));
      const selectionByte = coverage?.[pixel] ?? (defaultCoverage === 1 ? 255 : 0);
      const selectedAlpha = sourceAlpha * (selectionByte / 255);
      const remainingAlpha = sourceAlpha - selectedAlpha;
      selectedView.setUint16(offset + 6, floatToHalf(selectedAlpha), true);
      remainingView.setUint16(offset + 6, floatToHalf(remainingAlpha), true);
      if (selectedAlpha > 0) selectedHasAlpha = true;
      if (remainingAlpha > 0) remainingHasAlpha = true;
    }
  }

  return Object.freeze({ remaining, selected, remainingHasAlpha, selectedHasAlpha });
}

export async function prepareSelectionCutV1(
  snapshot: PaintProjectSnapshotV1,
  layerId: LayerId,
  coverage: RasterSelectionCoverageV1 | null,
  persistence: RasterMergePersistencePortV1,
): Promise<PreparedSelectionCutV1> {
  const eligibility = selectionCutEligibilityV1(snapshot, layerId, coverage);
  if (!eligibility.eligible) throw new Error(eligibility.reason ?? 'selection cut is unavailable');
  if (coverage === null) throw new Error('selection cut coverage disappeared');
  const source = snapshot.document.layerTree.layers[layerId];
  if (source?.type !== 'raster') throw new Error('selection cut source changed');

  const width = snapshot.document.canvas.width;
  const height = snapshot.document.canvas.height;
  const pixelFormat = snapshot.document.color.precision;
  const defaultCoverage = effectiveDefaultCoverageV1(coverage);
  const coverageTiles = await decodeCoverageTilesV1(snapshot, coverage, persistence);
  const sourceTiles = await sourceTilesV1(snapshot, source as RasterLayerV1, persistence);
  const remainingTiles: PreparedRasterMergeTileV1[] = [];
  const selectedTiles: PreparedRasterMergeTileV1[] = [];

  for (const reference of [...sourceTiles].sort(
    (left, right) => left.y - right.y || left.x - right.x,
  )) {
    const bounds = tileBoundsForDocumentV1(width, height, { tx: reference.x, ty: reference.y });
    const decoded = await persistence.readRasterTile(reference.payloadRef);
    validateSourceTileV1(decoded, pixelFormat, bounds.validWidth, bounds.validHeight);
    const coverageTile = coverageTiles.get(tileKeyV1(reference.x, reference.y));
    const split = splitStraightRgbaBytesV1(
      decoded.bytes,
      pixelFormat,
      coverageTile?.values ?? null,
      defaultCoverage,
      bounds.validWidth,
      bounds.validHeight,
    );
    if (split.remainingHasAlpha) {
      const persisted = await persistence.persistRasterTile({
        width: bounds.validWidth,
        height: bounds.validHeight,
        pixelFormat,
        bytes: split.remaining,
      });
      remainingTiles.push(
        Object.freeze({ x: reference.x, y: reference.y, payloadRef: persisted.payloadRef }),
      );
    }
    if (split.selectedHasAlpha) {
      const persisted = await persistence.persistRasterTile({
        width: bounds.validWidth,
        height: bounds.validHeight,
        pixelFormat,
        bytes: split.selected,
      });
      selectedTiles.push(
        Object.freeze({ x: reference.x, y: reference.y, payloadRef: persisted.payloadRef }),
      );
    }
  }

  if (selectedTiles.length === 0) {
    throw new Error('selection cut does not intersect raster content');
  }

  const transfer: SelectionTransferPayloadV1 = Object.freeze({
    schema: 'illustro.selection-transfer/1' as const,
    sourceLayerId: layerId,
    sourceRevision: source.revision,
    selectionSourceRevision: coverage.sourceRevision,
    documentRevision: snapshot.document.revision,
    width,
    height,
    pixelFormat,
    tiles: Object.freeze(selectedTiles),
  });

  return Object.freeze({
    schema: 'illustro.prepared-selection-cut/1' as const,
    layerId,
    sourceRevision: source.revision,
    documentRevision: snapshot.document.revision,
    selectionSourceRevision: coverage.sourceRevision,
    remainingTiles: Object.freeze(remainingTiles),
    transfer,
  });
}

export function applyPreparedSelectionCutV1(
  snapshot: PaintProjectSnapshotV1,
  prepared: PreparedSelectionCutV1,
  revisionValue: Revision | number,
  now: Date = new Date(),
): PaintProjectSnapshotV1 {
  const revision = parseRevision(revisionValue);
  if (snapshot.document.revision !== prepared.documentRevision) {
    throw new Error('selection cut document changed before commit');
  }
  const source = snapshot.document.layerTree.layers[prepared.layerId];
  if (source?.type !== 'raster' || source.revision !== prepared.sourceRevision) {
    throw new Error('selection cut source changed before commit');
  }
  if (source.locks.all || source.locks.pixels || source.locks.alpha) {
    throw new Error('selection cut became blocked by the layer pixel/alpha lock');
  }
  if (source.transformStack.length > 0 || source.effectStack.length > 0) {
    throw new Error('selection cut source gained an unbaked transform/effect before commit');
  }

  const cutLayer = Object.freeze({
    ...source,
    revision,
    boundsHint: null,
    tiles: Object.freeze(
      prepared.remainingTiles.map(
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
          [prepared.layerId]: cutLayer,
        }),
      }),
    }),
    committedStrokes: Object.freeze(committedStrokes),
  });
}
