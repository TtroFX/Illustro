import { parseRevision, type LayerId, type Revision } from '../domain/identity.js';
import type { DocumentColorSpace } from '../domain/document.js';
import type { RasterLayerV1, RasterTileReferenceV1 } from '../domain/layers.js';
import { CANONICAL_TILE_SIZE_PX, tileBoundsForDocumentV1 } from '../gpu/sparse-tile-model.js';
import type {
  PaintDecodedRasterTileV1,
  PaintPersistedRasterTileV1,
  PaintRasterTilePixelFormatV1,
} from './paint-persistence-controller.js';
import type { PaintProjectSnapshotV1 } from './paint-session-controller.js';
import type {
  PreparedRasterMergeTileV1,
  RasterMergePersistencePortV1,
} from './layer-raster-merge.js';
import { prepareLayerRasterizeV1 } from './layer-rasterize.js';

export type ColorMatchTripletV1 = readonly [number, number, number];

export interface ColorMatchStatisticsV1 {
  readonly schema: 'illustro.color-match-statistics/1';
  readonly mean: ColorMatchTripletV1;
  readonly stddev: ColorMatchTripletV1;
  readonly weight: number;
}

export interface LayerColorMatchEligibilityV1 {
  readonly eligible: boolean;
  readonly layerId: LayerId;
  readonly reason: string | null;
}

export interface LayerColorMatchSourceTileV1 {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly pixelFormat: PaintRasterTilePixelFormatV1;
  readonly bytes: Uint8Array;
}

export interface LayerColorMatchSourceV1 {
  readonly schema: 'illustro.layer-color-match-source/1';
  readonly layerId: LayerId;
  readonly sourceRevision: Revision;
  readonly documentRevision: Revision;
  readonly documentWidth: number;
  readonly documentHeight: number;
  readonly workingSpace: DocumentColorSpace;
  readonly statistics: ColorMatchStatisticsV1;
  readonly tiles: readonly LayerColorMatchSourceTileV1[];
}

export interface PreparedLayerColorMatchTileV1 extends LayerColorMatchSourceTileV1 {
  readonly matchedBytes: Uint8Array;
}

export interface PreparedLayerColorMatchV1 {
  readonly schema: 'illustro.prepared-layer-color-match/1';
  readonly layerId: LayerId;
  readonly sourceRevision: Revision;
  readonly documentRevision: Revision;
  readonly documentWidth: number;
  readonly documentHeight: number;
  readonly workingSpace: DocumentColorSpace;
  readonly strength: number;
  readonly sourceStatistics: ColorMatchStatisticsV1;
  readonly targetStatistics: ColorMatchStatisticsV1;
  readonly tiles: readonly PreparedLayerColorMatchTileV1[];
}

export interface PersistedLayerColorMatchV1 {
  readonly schema: 'illustro.persisted-layer-color-match/1';
  readonly layerId: LayerId;
  readonly sourceRevision: Revision;
  readonly documentRevision: Revision;
  readonly strength: number;
  readonly sourceStatistics: ColorMatchStatisticsV1;
  readonly targetStatistics: ColorMatchStatisticsV1;
  readonly tiles: readonly PreparedRasterMergeTileV1[];
}

export interface ColorMatchPreviewImageV1 {
  readonly width: number;
  readonly height: number;
  readonly bytes: Uint8ClampedArray;
}

interface StatisticsAccumulatorV1 {
  weight: number;
  readonly sum: [number, number, number];
  readonly sumSquares: [number, number, number];
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function freezeTriplet(values: readonly number[]): ColorMatchTripletV1 {
  return Object.freeze([values[0] ?? 0, values[1] ?? 0, values[2] ?? 0]);
}

function createAccumulator(): StatisticsAccumulatorV1 {
  return { weight: 0, sum: [0, 0, 0], sumSquares: [0, 0, 0] };
}

function accumulateColor(
  accumulator: StatisticsAccumulatorV1,
  color: ColorMatchTripletV1,
  weight: number,
): void {
  if (!Number.isFinite(weight) || weight <= 0) return;
  accumulator.weight += weight;
  for (let channel = 0; channel < 3; channel += 1) {
    const value = color[channel] ?? 0;
    accumulator.sum[channel] = (accumulator.sum[channel] ?? 0) + value * weight;
    accumulator.sumSquares[channel] =
      (accumulator.sumSquares[channel] ?? 0) + value * value * weight;
  }
}

function finishStatistics(accumulator: StatisticsAccumulatorV1): ColorMatchStatisticsV1 | null {
  if (!(accumulator.weight > 0)) return null;
  const mean = accumulator.sum.map((sum) => sum / accumulator.weight);
  const stddev = accumulator.sumSquares.map((sumSquares, channel) => {
    const channelMean = mean[channel] ?? 0;
    return Math.sqrt(Math.max(0, sumSquares / accumulator.weight - channelMean * channelMean));
  });
  return Object.freeze({
    schema: 'illustro.color-match-statistics/1' as const,
    mean: freezeTriplet(mean),
    stddev: freezeTriplet(stddev),
    weight: accumulator.weight,
  });
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
    if (exponent >= 31) return sign | 0x7c00;
  }
  return sign | (exponent << 10) | (fraction >>> 13);
}

function expectedByteLength(
  format: PaintRasterTilePixelFormatV1,
  width: number,
  height: number,
): number {
  return width * height * (format === 'rgba8-unorm' ? 4 : 8);
}

function assertTileBytes(
  bytes: Uint8Array,
  format: PaintRasterTilePixelFormatV1,
  width: number,
  height: number,
): void {
  if (bytes.byteLength !== expectedByteLength(format, width, height)) {
    throw new RangeError('color match raster bytes do not match tile dimensions');
  }
}

function readPixel(
  bytes: Uint8Array,
  format: PaintRasterTilePixelFormatV1,
  pixelIndex: number,
): readonly [ColorMatchTripletV1, number] {
  if (format === 'rgba8-unorm') {
    const offset = pixelIndex * 4;
    return Object.freeze([
      freezeTriplet([
        (bytes[offset] ?? 0) / 255,
        (bytes[offset + 1] ?? 0) / 255,
        (bytes[offset + 2] ?? 0) / 255,
      ]),
      (bytes[offset + 3] ?? 0) / 255,
    ]);
  }
  const offset = pixelIndex * 8;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return Object.freeze([
    freezeTriplet([
      halfToFloat(view.getUint16(offset, true)),
      halfToFloat(view.getUint16(offset + 2, true)),
      halfToFloat(view.getUint16(offset + 4, true)),
    ]),
    halfToFloat(view.getUint16(offset + 6, true)),
  ]);
}

function writePixelRgb(
  bytes: Uint8Array,
  format: PaintRasterTilePixelFormatV1,
  pixelIndex: number,
  color: ColorMatchTripletV1,
): void {
  if (format === 'rgba8-unorm') {
    const offset = pixelIndex * 4;
    bytes[offset] = Math.round(clamp01(color[0]) * 255);
    bytes[offset + 1] = Math.round(clamp01(color[1]) * 255);
    bytes[offset + 2] = Math.round(clamp01(color[2]) * 255);
    return;
  }
  const offset = pixelIndex * 8;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  view.setUint16(offset, floatToHalf(clamp01(color[0])), true);
  view.setUint16(offset + 2, floatToHalf(clamp01(color[1])), true);
  view.setUint16(offset + 4, floatToHalf(clamp01(color[2])), true);
}

function accumulateRasterBytes(
  accumulator: StatisticsAccumulatorV1,
  bytes: Uint8Array,
  format: PaintRasterTilePixelFormatV1,
  width: number,
  height: number,
): void {
  assertTileBytes(bytes, format, width, height);
  const pixelCount = width * height;
  for (let pixelIndex = 0; pixelIndex < pixelCount; pixelIndex += 1) {
    const [color, alpha] = readPixel(bytes, format, pixelIndex);
    const weight = clamp01(Number.isFinite(alpha) ? alpha : 0);
    accumulateColor(accumulator, color, weight);
  }
}

export function colorMatchStatisticsFromRgba8V1(
  bytes: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
): ColorMatchStatisticsV1 | null {
  if (!Number.isSafeInteger(width) || width < 1 || !Number.isSafeInteger(height) || height < 1) {
    throw new RangeError('color match statistics dimensions must be positive integers');
  }
  if (bytes.byteLength !== width * height * 4) {
    throw new RangeError('color match RGBA8 statistics byte length is invalid');
  }
  const accumulator = createAccumulator();
  for (let pixelIndex = 0; pixelIndex < width * height; pixelIndex += 1) {
    const offset = pixelIndex * 4;
    const alpha = (bytes[offset + 3] ?? 0) / 255;
    accumulateColor(
      accumulator,
      freezeTriplet([
        (bytes[offset] ?? 0) / 255,
        (bytes[offset + 1] ?? 0) / 255,
        (bytes[offset + 2] ?? 0) / 255,
      ]),
      alpha,
    );
  }
  return finishStatistics(accumulator);
}

export function combineColorMatchStatisticsV1(
  samples: readonly { readonly statistics: ColorMatchStatisticsV1; readonly scale?: number }[],
): ColorMatchStatisticsV1 | null {
  const accumulator = createAccumulator();
  for (const sample of samples) {
    const scale = sample.scale ?? 1;
    if (!Number.isFinite(scale) || scale <= 0) continue;
    const weight = sample.statistics.weight * scale;
    if (!(weight > 0)) continue;
    accumulator.weight += weight;
    for (let channel = 0; channel < 3; channel += 1) {
      const mean = sample.statistics.mean[channel] ?? 0;
      const stddev = sample.statistics.stddev[channel] ?? 0;
      accumulator.sum[channel] = (accumulator.sum[channel] ?? 0) + mean * weight;
      accumulator.sumSquares[channel] =
        (accumulator.sumSquares[channel] ?? 0) + (stddev * stddev + mean * mean) * weight;
    }
  }
  return finishStatistics(accumulator);
}

function normalizedStrength(value: number): number {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError('color match strength must be finite in 0..1');
  }
  return value;
}

function matchedChannel(
  value: number,
  channel: number,
  source: ColorMatchStatisticsV1,
  target: ColorMatchStatisticsV1,
  strength: number,
): number {
  const sourceMean = source.mean[channel] ?? 0;
  const sourceStddev = source.stddev[channel] ?? 0;
  const targetMean = target.mean[channel] ?? 0;
  const targetStddev = target.stddev[channel] ?? 0;
  const ratio = sourceStddev > 1e-6 ? targetStddev / sourceStddev : 1;
  const boundedRatio = Math.min(4, Math.max(0.25, Number.isFinite(ratio) ? ratio : 1));
  const fullyMatched = targetMean + (value - sourceMean) * boundedRatio;
  return clamp01(value + (fullyMatched - value) * strength);
}

export function applyColorMatchRgbaBytesV1(
  bytes: Uint8Array,
  format: PaintRasterTilePixelFormatV1,
  width: number,
  height: number,
  source: ColorMatchStatisticsV1,
  target: ColorMatchStatisticsV1,
  strengthValue: number,
): Uint8Array<ArrayBuffer> {
  assertTileBytes(bytes, format, width, height);
  const strength = normalizedStrength(strengthValue);
  const output = new Uint8Array(bytes);
  for (let pixelIndex = 0; pixelIndex < width * height; pixelIndex += 1) {
    const [color, alpha] = readPixel(bytes, format, pixelIndex);
    if (!(alpha > 0)) continue;
    writePixelRgb(
      output,
      format,
      pixelIndex,
      freezeTriplet([
        matchedChannel(color[0], 0, source, target, strength),
        matchedChannel(color[1], 1, source, target, strength),
        matchedChannel(color[2], 2, source, target, strength),
      ]),
    );
  }
  return output;
}

function hasUnbakedLayerStrokeV1(snapshot: PaintProjectSnapshotV1, layerId: LayerId): boolean {
  return snapshot.committedStrokes.some(
    (entry) => entry.stroke.layerId === layerId && entry.bakedToRasterLayer !== true,
  );
}

function unavailable(layerId: LayerId, reason: string): LayerColorMatchEligibilityV1 {
  return Object.freeze({ eligible: false, layerId, reason });
}

export function layerColorMatchEligibilityV1(
  snapshot: PaintProjectSnapshotV1,
  layerId: LayerId,
): LayerColorMatchEligibilityV1 {
  const layer = snapshot.document.layerTree.layers[layerId];
  if (layer === undefined) return unavailable(layerId, 'color match target layer is missing');
  if (layer.type !== 'raster') return unavailable(layerId, 'Color Match requires a Raster Layer');
  if (layer.locks.all || layer.locks.pixels) {
    return unavailable(layerId, 'Color Match is blocked by the layer pixel lock');
  }
  const hasUnbakedStroke = hasUnbakedLayerStrokeV1(snapshot, layerId);
  if (hasUnbakedStroke && layer.transformStack.length > 0) {
    return unavailable(
      layerId,
      'Color Match cannot bake pending stroke content under a live transform yet',
    );
  }
  if (hasUnbakedStroke && layer.effectStack.length > 0) {
    return unavailable(
      layerId,
      'Color Match cannot bake pending stroke content under live effects yet',
    );
  }
  if ((layer as RasterLayerV1).tiles.length === 0 && !hasUnbakedStroke) {
    return unavailable(layerId, 'Color Match requires raster content');
  }
  return Object.freeze({ eligible: true, layerId, reason: null });
}

async function materializedSourceTilesV1(
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

function assertDecodedTile(
  tile: PaintDecodedRasterTileV1,
  format: PaintRasterTilePixelFormatV1,
  width: number,
  height: number,
): void {
  if (tile.pixelFormat !== format || tile.width !== width || tile.height !== height) {
    throw new Error('Color Match tile does not match the canonical document tile contract');
  }
  assertTileBytes(tile.bytes, format, width, height);
}

export async function readLayerColorMatchSourceV1(
  snapshot: PaintProjectSnapshotV1,
  layerId: LayerId,
  persistence: RasterMergePersistencePortV1,
): Promise<LayerColorMatchSourceV1> {
  const eligibility = layerColorMatchEligibilityV1(snapshot, layerId);
  if (!eligibility.eligible) throw new Error(eligibility.reason ?? 'Color Match is unavailable');
  const layer = snapshot.document.layerTree.layers[layerId];
  if (layer?.type !== 'raster') throw new Error('Color Match source changed');
  const raster = layer as RasterLayerV1;
  const documentWidth = snapshot.document.canvas.width;
  const documentHeight = snapshot.document.canvas.height;
  const format = snapshot.document.color.precision;
  const materialized = await materializedSourceTilesV1(snapshot, raster, persistence);
  const accumulator = createAccumulator();
  const tiles: LayerColorMatchSourceTileV1[] = [];
  for (const tile of [...materialized].sort(
    (left, right) => left.y - right.y || left.x - right.x,
  )) {
    const bounds = tileBoundsForDocumentV1(documentWidth, documentHeight, {
      tx: tile.x,
      ty: tile.y,
    });
    const decoded = await persistence.readRasterTile(tile.payloadRef);
    assertDecodedTile(decoded, format, bounds.validWidth, bounds.validHeight);
    const bytes = new Uint8Array(decoded.bytes);
    accumulateRasterBytes(accumulator, bytes, format, bounds.validWidth, bounds.validHeight);
    tiles.push(
      Object.freeze({
        x: tile.x,
        y: tile.y,
        width: bounds.validWidth,
        height: bounds.validHeight,
        pixelFormat: format,
        bytes,
      }),
    );
  }
  const statistics = finishStatistics(accumulator);
  if (statistics === null) throw new Error('Color Match requires non-transparent raster pixels');
  return Object.freeze({
    schema: 'illustro.layer-color-match-source/1' as const,
    layerId,
    sourceRevision: layer.revision,
    documentRevision: snapshot.document.revision,
    documentWidth,
    documentHeight,
    workingSpace: snapshot.document.color.workingSpace,
    statistics,
    tiles: Object.freeze(tiles),
  });
}

export function prepareLayerColorMatchV1(
  source: LayerColorMatchSourceV1,
  targetStatistics: ColorMatchStatisticsV1,
  strengthValue: number,
): PreparedLayerColorMatchV1 {
  const strength = normalizedStrength(strengthValue);
  const tiles = source.tiles.map((tile) =>
    Object.freeze({
      ...tile,
      matchedBytes: applyColorMatchRgbaBytesV1(
        tile.bytes,
        tile.pixelFormat,
        tile.width,
        tile.height,
        source.statistics,
        targetStatistics,
        strength,
      ),
    }),
  );
  return Object.freeze({
    schema: 'illustro.prepared-layer-color-match/1' as const,
    layerId: source.layerId,
    sourceRevision: source.sourceRevision,
    documentRevision: source.documentRevision,
    documentWidth: source.documentWidth,
    documentHeight: source.documentHeight,
    workingSpace: source.workingSpace,
    strength,
    sourceStatistics: source.statistics,
    targetStatistics,
    tiles: Object.freeze(tiles),
  });
}

export async function persistPreparedLayerColorMatchV1(
  prepared: PreparedLayerColorMatchV1,
  persistence: RasterMergePersistencePortV1,
): Promise<PersistedLayerColorMatchV1> {
  const tiles: PreparedRasterMergeTileV1[] = [];
  for (const tile of prepared.tiles) {
    const persisted: PaintPersistedRasterTileV1 = await persistence.persistRasterTile({
      width: tile.width,
      height: tile.height,
      pixelFormat: tile.pixelFormat,
      bytes: tile.matchedBytes,
    });
    tiles.push(Object.freeze({ x: tile.x, y: tile.y, payloadRef: persisted.payloadRef }));
  }
  return Object.freeze({
    schema: 'illustro.persisted-layer-color-match/1' as const,
    layerId: prepared.layerId,
    sourceRevision: prepared.sourceRevision,
    documentRevision: prepared.documentRevision,
    strength: prepared.strength,
    sourceStatistics: prepared.sourceStatistics,
    targetStatistics: prepared.targetStatistics,
    tiles: Object.freeze(tiles),
  });
}

export function applyPersistedLayerColorMatchV1(
  snapshot: PaintProjectSnapshotV1,
  persisted: PersistedLayerColorMatchV1,
  revisionValue: Revision | number,
  now: Date = new Date(),
): PaintProjectSnapshotV1 {
  const revision = parseRevision(revisionValue);
  if (snapshot.document.revision !== persisted.documentRevision) {
    throw new Error('Color Match document changed before Apply');
  }
  const source = snapshot.document.layerTree.layers[persisted.layerId];
  if (source?.type !== 'raster' || source.revision !== persisted.sourceRevision) {
    throw new Error('Color Match source layer changed before Apply');
  }
  const eligibility = layerColorMatchEligibilityV1(snapshot, persisted.layerId);
  if (!eligibility.eligible) throw new Error(eligibility.reason ?? 'Color Match is unavailable');
  const matched = Object.freeze({
    ...source,
    revision,
    boundsHint: null,
    tiles: Object.freeze(
      persisted.tiles.map(
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
    entry.stroke.layerId === persisted.layerId
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
          [persisted.layerId]: matched,
        }),
      }),
    }),
    committedStrokes: Object.freeze(committedStrokes),
  });
}

function previewPixelBytes(
  tile: PreparedLayerColorMatchTileV1,
  bytes: Uint8Array,
  localX: number,
  localY: number,
): readonly [number, number, number, number] {
  const pixelIndex = localY * tile.width + localX;
  if (tile.pixelFormat === 'rgba8-unorm') {
    const offset = pixelIndex * 4;
    return Object.freeze([
      bytes[offset] ?? 0,
      bytes[offset + 1] ?? 0,
      bytes[offset + 2] ?? 0,
      bytes[offset + 3] ?? 0,
    ]);
  }
  const offset = pixelIndex * 8;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return Object.freeze([
    Math.round(clamp01(halfToFloat(view.getUint16(offset, true))) * 255),
    Math.round(clamp01(halfToFloat(view.getUint16(offset + 2, true))) * 255),
    Math.round(clamp01(halfToFloat(view.getUint16(offset + 4, true))) * 255),
    Math.round(clamp01(halfToFloat(view.getUint16(offset + 6, true))) * 255),
  ]);
}

export function colorMatchPreviewImageV1(
  prepared: PreparedLayerColorMatchV1,
  variant: 'before' | 'after',
  maxDimension = 192,
): ColorMatchPreviewImageV1 {
  if (!Number.isSafeInteger(maxDimension) || maxDimension < 16 || maxDimension > 1024) {
    throw new RangeError('Color Match preview maxDimension must be an integer in 16..1024');
  }
  const scale = Math.min(
    1,
    maxDimension / Math.max(prepared.documentWidth, prepared.documentHeight),
  );
  const width = Math.max(1, Math.round(prepared.documentWidth * scale));
  const height = Math.max(1, Math.round(prepared.documentHeight * scale));
  const output = new Uint8ClampedArray(width * height * 4);
  const tileMap = new Map(prepared.tiles.map((tile) => [`${tile.x}:${tile.y}`, tile] as const));
  for (let previewY = 0; previewY < height; previewY += 1) {
    const documentY = Math.min(
      prepared.documentHeight - 1,
      Math.floor((previewY / height) * prepared.documentHeight),
    );
    const tileY = Math.floor(documentY / CANONICAL_TILE_SIZE_PX);
    const localY = documentY - tileY * CANONICAL_TILE_SIZE_PX;
    for (let previewX = 0; previewX < width; previewX += 1) {
      const documentX = Math.min(
        prepared.documentWidth - 1,
        Math.floor((previewX / width) * prepared.documentWidth),
      );
      const tileX = Math.floor(documentX / CANONICAL_TILE_SIZE_PX);
      const localX = documentX - tileX * CANONICAL_TILE_SIZE_PX;
      const tile = tileMap.get(`${tileX}:${tileY}`);
      if (tile === undefined || localX >= tile.width || localY >= tile.height) continue;
      const rgba = previewPixelBytes(
        tile,
        variant === 'after' ? tile.matchedBytes : tile.bytes,
        localX,
        localY,
      );
      const offset = (previewY * width + previewX) * 4;
      output[offset] = rgba[0];
      output[offset + 1] = rgba[1];
      output[offset + 2] = rgba[2];
      output[offset + 3] = rgba[3];
    }
  }
  return Object.freeze({ width, height, bytes: output });
}
