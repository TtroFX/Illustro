import type { DocumentColorSpace, DocumentPrecision } from '../domain/document.js';
import type { BlendModeId } from '../domain/layers.js';
import {
  baselineDabColorV1,
  baselineDabFlowV1,
  baselineDabRadiusXV1,
  baselineDabRadiusYV1,
  baselineDabStrokeOpacityV1,
  baselineDabUsesFlowOpacityV1,
  planBaselineBrushTilesV1,
  type BaselineBrushCompositeOperationV1,
  type BaselineBrushDabV1,
} from './baseline-brush.js';
import { compositeBlendRgbaV1, isM5cBaseBlendModeV1 } from './blend-modes.js';
import {
  CANONICAL_TILE_SIZE_PX,
  tileBoundsForDocumentV1,
  tileKeyV1,
  type TileCoordinateV1,
} from './sparse-tile-model.js';

export type BaselineAffineMatrixV1 = readonly [number, number, number, number, number, number];

export interface BaselineRasterMaskTileImageV1 {
  readonly coordinate: TileCoordinateV1;
  readonly width: number;
  readonly height: number;
  readonly bytes: Uint8Array<ArrayBuffer>;
}

export interface BaselineRasterMaskEffectV1 {
  readonly kind: 'feather' | 'blur';
  readonly radiusPx: number;
}

export interface BaselineRasterMaskDescriptorV1 {
  readonly maskId: string;
  readonly enabled: boolean;
  readonly inverted: boolean;
  readonly defaultCoverage: 0 | 1;
  readonly documentToMask?: BaselineAffineMatrixV1;
  readonly effects: readonly BaselineRasterMaskEffectV1[];
  readonly tiles: readonly BaselineRasterMaskTileImageV1[];
}

export interface BaselineRasterLayerDescriptorV1 {
  readonly layerId: string;
  readonly visible: boolean;
  readonly opacity: number;
  readonly draft?: boolean;
  readonly blendMode?: BlendModeId;
  readonly clippingBaseLayerId?: string;
  readonly masks?: readonly BaselineRasterMaskDescriptorV1[];
}

export interface BaselineRasterTileImageV1 {
  readonly schema: 'illustro.baseline-raster-tile/1';
  readonly layerId: string;
  readonly coordinate: TileCoordinateV1;
  readonly width: number;
  readonly height: number;
  readonly pixelFormat: DocumentPrecision;
  readonly bytes: Uint8Array<ArrayBuffer>;
}

export interface BaselineRasterTilePatchV1 {
  readonly schema: 'illustro.baseline-raster-tile-patch/1';
  readonly layerId: string;
  readonly coordinate: TileCoordinateV1;
  readonly before: BaselineRasterTileImageV1 | null;
  readonly after: BaselineRasterTileImageV1 | null;
}

export type BaselineRasterTilePatchDirectionV1 = 'before' | 'after';

interface ActiveTileTransactionV1 {
  readonly strokeId: string;
  readonly layerId: string;
  readonly operation: BaselineBrushCompositeOperationV1;
  readonly before: Map<string, BaselineRasterTileImageV1 | null>;
  readonly affected: Map<string, TileCoordinateV1>;
  readonly paintCoverage: Map<string, Float32Array>;
  paintStrokeOpacity: number | null;
  lastSmudgeDab: BaselineBrushDabV1 | null;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function floatToHalf(value: number): number {
  const clamped = clamp01(value);
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

function halfToFloat(value: number): number {
  const sign = (value & 0x8000) !== 0 ? -1 : 1;
  const exponent = (value >>> 10) & 0x1f;
  const fraction = value & 0x03ff;
  if (exponent === 0) return sign * 2 ** -14 * (fraction / 1024);
  if (exponent === 0x1f) return fraction === 0 ? sign * Number.POSITIVE_INFINITY : Number.NaN;
  return sign * 2 ** (exponent - 15) * (1 + fraction / 1024);
}

function bytesPerPixel(format: DocumentPrecision): number {
  return format === 'rgba8-unorm' ? 4 : 8;
}

function ownedBytes(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  const owned = new Uint8Array(bytes.byteLength);
  owned.set(bytes);
  return owned;
}

function freezeCoordinate(coordinate: TileCoordinateV1): TileCoordinateV1 {
  return Object.freeze({ tx: coordinate.tx, ty: coordinate.ty });
}

function tileStateKey(layerId: string, coordinate: TileCoordinateV1): string {
  if (layerId.length === 0) throw new TypeError('raster tile layerId must not be empty');
  return `${layerId}/${tileKeyV1(coordinate)}`;
}

function validateTileImage(
  image: BaselineRasterTileImageV1,
  documentWidth: number,
  documentHeight: number,
  pixelFormat: DocumentPrecision,
): void {
  if (image.schema !== 'illustro.baseline-raster-tile/1' || image.layerId.length === 0) {
    throw new TypeError('invalid baseline raster tile identity');
  }
  const bounds = tileBoundsForDocumentV1(documentWidth, documentHeight, image.coordinate);
  if (
    image.pixelFormat !== pixelFormat ||
    image.width !== bounds.validWidth ||
    image.height !== bounds.validHeight ||
    image.bytes.byteLength !== image.width * image.height * bytesPerPixel(pixelFormat)
  ) {
    throw new Error('baseline raster tile violates the document tile contract');
  }
}

function cloneTile(
  image: BaselineRasterTileImageV1,
  layerId: string = image.layerId,
): BaselineRasterTileImageV1 {
  return Object.freeze({
    schema: 'illustro.baseline-raster-tile/1' as const,
    layerId,
    coordinate: freezeCoordinate(image.coordinate),
    width: image.width,
    height: image.height,
    pixelFormat: image.pixelFormat,
    bytes: ownedBytes(image.bytes),
  });
}

function createTransparentTile(
  layerId: string,
  coordinate: TileCoordinateV1,
  documentWidth: number,
  documentHeight: number,
  pixelFormat: DocumentPrecision,
): BaselineRasterTileImageV1 {
  const bounds = tileBoundsForDocumentV1(documentWidth, documentHeight, coordinate);
  return Object.freeze({
    schema: 'illustro.baseline-raster-tile/1' as const,
    layerId,
    coordinate: freezeCoordinate(coordinate),
    width: bounds.validWidth,
    height: bounds.validHeight,
    pixelFormat,
    bytes: new Uint8Array(bounds.validWidth * bounds.validHeight * bytesPerPixel(pixelFormat)),
  });
}

function readPixel(
  image: BaselineRasterTileImageV1,
  pixel: number,
): [number, number, number, number] {
  if (image.pixelFormat === 'rgba8-unorm') {
    const offset = pixel * 4;
    return [
      (image.bytes[offset] ?? 0) / 255,
      (image.bytes[offset + 1] ?? 0) / 255,
      (image.bytes[offset + 2] ?? 0) / 255,
      (image.bytes[offset + 3] ?? 0) / 255,
    ];
  }
  const offset = pixel * 8;
  const view = new DataView(image.bytes.buffer, image.bytes.byteOffset, image.bytes.byteLength);
  return [
    clamp01(halfToFloat(view.getUint16(offset, true))),
    clamp01(halfToFloat(view.getUint16(offset + 2, true))),
    clamp01(halfToFloat(view.getUint16(offset + 4, true))),
    clamp01(halfToFloat(view.getUint16(offset + 6, true))),
  ];
}

export function readBaselineRasterTilePixelV1(
  image: BaselineRasterTileImageV1,
  pixel: number,
): readonly [number, number, number, number] {
  if (!Number.isSafeInteger(pixel) || pixel < 0 || pixel >= image.width * image.height) {
    throw new RangeError('baseline raster tile pixel index is out of range');
  }
  return Object.freeze(readPixel(image, pixel));
}

function writePixel(
  image: BaselineRasterTileImageV1,
  pixel: number,
  rgba: readonly [number, number, number, number],
): void {
  if (image.pixelFormat === 'rgba8-unorm') {
    const offset = pixel * 4;
    image.bytes[offset] = Math.round(clamp01(rgba[0]) * 255);
    image.bytes[offset + 1] = Math.round(clamp01(rgba[1]) * 255);
    image.bytes[offset + 2] = Math.round(clamp01(rgba[2]) * 255);
    image.bytes[offset + 3] = Math.round(clamp01(rgba[3]) * 255);
    return;
  }
  const offset = pixel * 8;
  const view = new DataView(image.bytes.buffer, image.bytes.byteOffset, image.bytes.byteLength);
  view.setUint16(offset, floatToHalf(rgba[0]), true);
  view.setUint16(offset + 2, floatToHalf(rgba[1]), true);
  view.setUint16(offset + 4, floatToHalf(rgba[2]), true);
  view.setUint16(offset + 6, floatToHalf(rgba[3]), true);
}

const BASELINE_BRUSH_HARDNESS = 0.85;

function baselineProceduralTipDistanceV1(
  dab: BaselineBrushDabV1,
  localX: number,
  localY: number,
): number {
  return dab.tipShape === 'square'
    ? Math.max(Math.abs(localX), Math.abs(localY))
    : Math.hypot(localX, localY);
}

function baselineProceduralTipCoverageV1(
  dab: BaselineBrushDabV1,
  localX: number,
  localY: number,
): number {
  const distance = baselineProceduralTipDistanceV1(dab, localX, localY);
  if (distance >= 1) return 0;
  return distance <= BASELINE_BRUSH_HARDNESS
    ? 1
    : clamp01(1 - smoothstep(BASELINE_BRUSH_HARDNESS, 1, distance));
}

function rasterizeColorDab(
  tile: BaselineRasterTileImageV1,
  tileX: number,
  tileY: number,
  dab: BaselineBrushDabV1,
  strokeCoverage: Float32Array | null = null,
): void {
  const radiusX = baselineDabRadiusXV1(dab);
  const radiusY = baselineDabRadiusYV1(dab);
  const minX = Math.max(tileX, Math.floor(dab.x - radiusX));
  const minY = Math.max(tileY, Math.floor(dab.y - radiusY));
  const maxX = Math.min(tileX + tile.width - 1, Math.ceil(dab.x + radiusX) - 1);
  const maxY = Math.min(tileY + tile.height - 1, Math.ceil(dab.y + radiusY) - 1);
  const opacity = clamp01(dab.opacity);
  const sourceColor = baselineDabColorV1(dab);
  const flow = clamp01(baselineDabFlowV1(dab));
  const strokeOpacity = clamp01(baselineDabStrokeOpacityV1(dab));
  const semanticFlowOpacity = strokeCoverage !== null && baselineDabUsesFlowOpacityV1(dab);
  const sourceAlphaForPixel = (pixel: number, coverage: number): number => {
    if (!semanticFlowOpacity || strokeCoverage === null) return clamp01(opacity * coverage);
    const deposit = clamp01(flow * coverage);
    const previousCoverage = strokeCoverage[pixel] ?? 0;
    const nextCoverage = previousCoverage + (1 - previousCoverage) * deposit;
    strokeCoverage[pixel] = nextCoverage;
    const previousEffective = clamp01(previousCoverage * strokeOpacity);
    const nextEffective = clamp01(nextCoverage * strokeOpacity);
    if (nextEffective <= previousEffective || previousEffective >= 1) return 0;
    return clamp01((nextEffective - previousEffective) / (1 - previousEffective));
  };

  if (tile.pixelFormat === 'rgba8-unorm') {
    const bytes = tile.bytes;
    for (let documentY = minY; documentY <= maxY; documentY += 1) {
      const localY = (documentY + 0.5 - dab.y) / radiusY;
      if (Math.abs(localY) >= 1) continue;
      for (let documentX = minX; documentX <= maxX; documentX += 1) {
        const localX = (documentX + 0.5 - dab.x) / radiusX;
        const tipCoverage = baselineProceduralTipCoverageV1(dab, localX, localY);
        if (tipCoverage <= 0) continue;
        const pixel = (documentY - tileY) * tile.width + (documentX - tileX);
        const sourceAlpha = sourceAlphaForPixel(pixel, tipCoverage);
        if (sourceAlpha <= 0) continue;

        const pixelOffset = pixel * 4;
        const destinationAlpha = (bytes[pixelOffset + 3] ?? 0) / 255;
        const inverseSourceAlpha = 1 - sourceAlpha;
        const outputAlpha = sourceAlpha + destinationAlpha * inverseSourceAlpha;
        const destinationRed = (bytes[pixelOffset] ?? 0) / 255;
        const destinationGreen = (bytes[pixelOffset + 1] ?? 0) / 255;
        const destinationBlue = (bytes[pixelOffset + 2] ?? 0) / 255;
        const destinationWeight = destinationAlpha * inverseSourceAlpha;
        const sourceWeight = sourceAlpha;
        bytes[pixelOffset] = Math.round(
          (outputAlpha > 0
            ? (sourceColor[0] * sourceWeight + destinationRed * destinationWeight) / outputAlpha
            : 0) * 255,
        );
        bytes[pixelOffset + 1] = Math.round(
          (outputAlpha > 0
            ? (sourceColor[1] * sourceWeight + destinationGreen * destinationWeight) / outputAlpha
            : 0) * 255,
        );
        bytes[pixelOffset + 2] = Math.round(
          (outputAlpha > 0
            ? (sourceColor[2] * sourceWeight + destinationBlue * destinationWeight) / outputAlpha
            : 0) * 255,
        );
        bytes[pixelOffset + 3] = Math.round(outputAlpha * 255);
      }
    }
    return;
  }

  for (let documentY = minY; documentY <= maxY; documentY += 1) {
    const localY = (documentY + 0.5 - dab.y) / radiusY;
    if (Math.abs(localY) >= 1) continue;
    for (let documentX = minX; documentX <= maxX; documentX += 1) {
      const localX = (documentX + 0.5 - dab.x) / radiusX;
      const tipCoverage = baselineProceduralTipCoverageV1(dab, localX, localY);
      if (tipCoverage <= 0) continue;
      const pixel = (documentY - tileY) * tile.width + (documentX - tileX);
      const sourceAlpha = sourceAlphaForPixel(pixel, tipCoverage);
      if (sourceAlpha <= 0) continue;
      const destination = readPixel(tile, pixel);
      const destinationAlpha = destination[3];
      const outputAlpha = sourceAlpha + destinationAlpha * (1 - sourceAlpha);
      const destinationWeight = destinationAlpha * (1 - sourceAlpha);
      writePixel(tile, pixel, [
        outputAlpha > 0
          ? (sourceColor[0] * sourceAlpha + destination[0] * destinationWeight) / outputAlpha
          : 0,
        outputAlpha > 0
          ? (sourceColor[1] * sourceAlpha + destination[1] * destinationWeight) / outputAlpha
          : 0,
        outputAlpha > 0
          ? (sourceColor[2] * sourceAlpha + destination[2] * destinationWeight) / outputAlpha
          : 0,
        outputAlpha,
      ]);
    }
  }
}

function rasterizeEraseDab(
  tile: BaselineRasterTileImageV1,
  tileX: number,
  tileY: number,
  dab: BaselineBrushDabV1,
): void {
  const radiusX = baselineDabRadiusXV1(dab);
  const radiusY = baselineDabRadiusYV1(dab);
  const minX = Math.max(tileX, Math.floor(dab.x - radiusX));
  const minY = Math.max(tileY, Math.floor(dab.y - radiusY));
  const maxX = Math.min(tileX + tile.width - 1, Math.ceil(dab.x + radiusX) - 1);
  const maxY = Math.min(tileY + tile.height - 1, Math.ceil(dab.y + radiusY) - 1);
  const opacity = clamp01(dab.opacity);

  for (let documentY = minY; documentY <= maxY; documentY += 1) {
    const localY = (documentY + 0.5 - dab.y) / radiusY;
    if (Math.abs(localY) >= 1) continue;
    for (let documentX = minX; documentX <= maxX; documentX += 1) {
      const localX = (documentX + 0.5 - dab.x) / radiusX;
      const eraseAlpha = opacity * baselineProceduralTipCoverageV1(dab, localX, localY);
      if (eraseAlpha <= 0) continue;
      const pixel = (documentY - tileY) * tile.width + (documentX - tileX);
      const destination = readPixel(tile, pixel);
      if (destination[3] <= 0) continue;
      const outputAlpha = clamp01(destination[3] * (1 - eraseAlpha));
      writePixel(
        tile,
        pixel,
        outputAlpha <= 0
          ? [0, 0, 0, 0]
          : [destination[0], destination[1], destination[2], outputAlpha],
      );
    }
  }
}

type BaselineSmudgeSourceSnapshotV1 = ReadonlyMap<string, BaselineRasterTileImageV1>;

function sampleSmudgeSnapshotInteger(
  snapshot: BaselineSmudgeSourceSnapshotV1,
  documentWidth: number,
  documentHeight: number,
  x: number,
  y: number,
): readonly [number, number, number, number] {
  if (x < 0 || y < 0 || x >= documentWidth || y >= documentHeight) return [0, 0, 0, 0];
  const tx = Math.floor(x / CANONICAL_TILE_SIZE_PX);
  const ty = Math.floor(y / CANONICAL_TILE_SIZE_PX);
  const tile = snapshot.get(tileKeyV1({ tx, ty }));
  if (tile === undefined) return [0, 0, 0, 0];
  const localX = x - tx * CANONICAL_TILE_SIZE_PX;
  const localY = y - ty * CANONICAL_TILE_SIZE_PX;
  if (localX < 0 || localY < 0 || localX >= tile.width || localY >= tile.height) {
    return [0, 0, 0, 0];
  }
  return readPixel(tile, localY * tile.width + localX);
}

function sampleSmudgeSnapshot(
  snapshot: BaselineSmudgeSourceSnapshotV1,
  documentWidth: number,
  documentHeight: number,
  documentX: number,
  documentY: number,
): readonly [number, number, number, number] {
  const sampleX = documentX - 0.5;
  const sampleY = documentY - 0.5;
  const x0 = Math.floor(sampleX);
  const y0 = Math.floor(sampleY);
  const tx = sampleX - x0;
  const ty = sampleY - y0;
  const samples = [
    sampleSmudgeSnapshotInteger(snapshot, documentWidth, documentHeight, x0, y0),
    sampleSmudgeSnapshotInteger(snapshot, documentWidth, documentHeight, x0 + 1, y0),
    sampleSmudgeSnapshotInteger(snapshot, documentWidth, documentHeight, x0, y0 + 1),
    sampleSmudgeSnapshotInteger(snapshot, documentWidth, documentHeight, x0 + 1, y0 + 1),
  ] as const;
  const weights = [(1 - tx) * (1 - ty), tx * (1 - ty), (1 - tx) * ty, tx * ty] as const;
  let alpha = 0;
  let redPremultiplied = 0;
  let greenPremultiplied = 0;
  let bluePremultiplied = 0;
  for (let index = 0; index < samples.length; index += 1) {
    const sample = samples[index] ?? [0, 0, 0, 0];
    const weight = weights[index] ?? 0;
    alpha += sample[3] * weight;
    redPremultiplied += sample[0] * sample[3] * weight;
    greenPremultiplied += sample[1] * sample[3] * weight;
    bluePremultiplied += sample[2] * sample[3] * weight;
  }
  if (alpha <= 1e-9) return [0, 0, 0, 0];
  return [
    clamp01(redPremultiplied / alpha),
    clamp01(greenPremultiplied / alpha),
    clamp01(bluePremultiplied / alpha),
    clamp01(alpha),
  ];
}

function mixPremultipliedRgba(
  destination: readonly [number, number, number, number],
  source: readonly [number, number, number, number],
  strength: number,
): readonly [number, number, number, number] {
  const amount = clamp01(strength);
  const destinationWeight = 1 - amount;
  const alpha = destination[3] * destinationWeight + source[3] * amount;
  const redPremultiplied =
    destination[0] * destination[3] * destinationWeight + source[0] * source[3] * amount;
  const greenPremultiplied =
    destination[1] * destination[3] * destinationWeight + source[1] * source[3] * amount;
  const bluePremultiplied =
    destination[2] * destination[3] * destinationWeight + source[2] * source[3] * amount;
  if (alpha <= 1e-9) return [0, 0, 0, 0];
  return [
    clamp01(redPremultiplied / alpha),
    clamp01(greenPremultiplied / alpha),
    clamp01(bluePremultiplied / alpha),
    clamp01(alpha),
  ];
}

function rasterizeSmudgeDab(
  tile: BaselineRasterTileImageV1,
  tileX: number,
  tileY: number,
  dab: BaselineBrushDabV1,
  deltaX: number,
  deltaY: number,
  snapshot: BaselineSmudgeSourceSnapshotV1,
  documentWidth: number,
  documentHeight: number,
): boolean {
  const radiusX = baselineDabRadiusXV1(dab);
  const radiusY = baselineDabRadiusYV1(dab);
  const minX = Math.max(tileX, Math.floor(dab.x - radiusX));
  const minY = Math.max(tileY, Math.floor(dab.y - radiusY));
  const maxX = Math.min(tileX + tile.width - 1, Math.ceil(dab.x + radiusX) - 1);
  const maxY = Math.min(tileY + tile.height - 1, Math.ceil(dab.y + radiusY) - 1);
  const opacity = clamp01(dab.opacity);
  let changed = false;

  for (let documentY = minY; documentY <= maxY; documentY += 1) {
    const localY = (documentY + 0.5 - dab.y) / radiusY;
    if (Math.abs(localY) >= 1) continue;
    for (let documentX = minX; documentX <= maxX; documentX += 1) {
      const localX = (documentX + 0.5 - dab.x) / radiusX;
      const strength = opacity * baselineProceduralTipCoverageV1(dab, localX, localY);
      if (strength <= 0) continue;
      const pixel = (documentY - tileY) * tile.width + (documentX - tileX);
      const destination = readPixel(tile, pixel);
      const source = sampleSmudgeSnapshot(
        snapshot,
        documentWidth,
        documentHeight,
        documentX + 0.5 - deltaX,
        documentY + 0.5 - deltaY,
      );
      const mixed = mixPremultipliedRgba(destination, source, strength);
      if (
        Math.abs(mixed[0] - destination[0]) <= 1e-9 &&
        Math.abs(mixed[1] - destination[1]) <= 1e-9 &&
        Math.abs(mixed[2] - destination[2]) <= 1e-9 &&
        Math.abs(mixed[3] - destination[3]) <= 1e-9
      ) {
        continue;
      }
      writePixel(tile, pixel, mixed);
      changed = true;
    }
  }
  return changed;
}

const BLUR_BRUSH_WEIGHTS = Object.freeze([1, 4, 6, 4, 1] as const);
const BLUR_BRUSH_WEIGHT_TOTAL = 256;

function blurBrushRadiusV1(dab: BaselineBrushDabV1): number {
  return Math.max(0.75, Math.min(baselineDabRadiusXV1(dab), baselineDabRadiusYV1(dab)) * 0.25);
}

function sampleBlurSnapshot(
  snapshot: BaselineSmudgeSourceSnapshotV1,
  documentWidth: number,
  documentHeight: number,
  documentX: number,
  documentY: number,
  radius: number,
): readonly [number, number, number, number] {
  const step = radius / 2;
  let alpha = 0;
  let redPremultiplied = 0;
  let greenPremultiplied = 0;
  let bluePremultiplied = 0;
  for (let yi = 0; yi < BLUR_BRUSH_WEIGHTS.length; yi += 1) {
    const wy = BLUR_BRUSH_WEIGHTS[yi] ?? 0;
    for (let xi = 0; xi < BLUR_BRUSH_WEIGHTS.length; xi += 1) {
      const wx = BLUR_BRUSH_WEIGHTS[xi] ?? 0;
      const weight = wx * wy;
      const sample = sampleSmudgeSnapshot(
        snapshot,
        documentWidth,
        documentHeight,
        documentX + (xi - 2) * step,
        documentY + (yi - 2) * step,
      );
      alpha += sample[3] * weight;
      redPremultiplied += sample[0] * sample[3] * weight;
      greenPremultiplied += sample[1] * sample[3] * weight;
      bluePremultiplied += sample[2] * sample[3] * weight;
    }
  }
  const normalizedAlpha = clamp01(alpha / BLUR_BRUSH_WEIGHT_TOTAL);
  if (normalizedAlpha <= 1e-9) return [0, 0, 0, 0];
  return [
    clamp01(redPremultiplied / alpha),
    clamp01(greenPremultiplied / alpha),
    clamp01(bluePremultiplied / alpha),
    normalizedAlpha,
  ];
}

function rasterizeBlurDab(
  tile: BaselineRasterTileImageV1,
  tileX: number,
  tileY: number,
  dab: BaselineBrushDabV1,
  snapshot: BaselineSmudgeSourceSnapshotV1,
  documentWidth: number,
  documentHeight: number,
): boolean {
  const radiusX = baselineDabRadiusXV1(dab);
  const radiusY = baselineDabRadiusYV1(dab);
  const blurRadius = blurBrushRadiusV1(dab);
  const minX = Math.max(tileX, Math.floor(dab.x - radiusX));
  const minY = Math.max(tileY, Math.floor(dab.y - radiusY));
  const maxX = Math.min(tileX + tile.width - 1, Math.ceil(dab.x + radiusX) - 1);
  const maxY = Math.min(tileY + tile.height - 1, Math.ceil(dab.y + radiusY) - 1);
  const opacity = clamp01(dab.opacity);
  let changed = false;

  for (let documentY = minY; documentY <= maxY; documentY += 1) {
    const localY = (documentY + 0.5 - dab.y) / radiusY;
    if (Math.abs(localY) >= 1) continue;
    for (let documentX = minX; documentX <= maxX; documentX += 1) {
      const localX = (documentX + 0.5 - dab.x) / radiusX;
      const strength = opacity * baselineProceduralTipCoverageV1(dab, localX, localY);
      if (strength <= 0) continue;
      const pixel = (documentY - tileY) * tile.width + (documentX - tileX);
      const destination = readPixel(tile, pixel);
      const blurred = sampleBlurSnapshot(
        snapshot,
        documentWidth,
        documentHeight,
        documentX + 0.5,
        documentY + 0.5,
        blurRadius,
      );
      const mixed = mixPremultipliedRgba(destination, blurred, strength);
      if (
        Math.abs(mixed[0] - destination[0]) <= 1e-9 &&
        Math.abs(mixed[1] - destination[1]) <= 1e-9 &&
        Math.abs(mixed[2] - destination[2]) <= 1e-9 &&
        Math.abs(mixed[3] - destination[3]) <= 1e-9
      ) {
        continue;
      }
      writePixel(tile, pixel, mixed);
      changed = true;
    }
  }
  return changed;
}

const MASK_SOFTEN_WEIGHTS = Object.freeze([1, 4, 6, 4, 1] as const);
const MASK_SOFTEN_WEIGHT_TOTAL = 256;

function maskTileStateKey(coordinate: TileCoordinateV1): string {
  return tileKeyV1(coordinate);
}

function validateMaskTileImage(
  image: BaselineRasterMaskTileImageV1,
  documentWidth: number,
  documentHeight: number,
): void {
  const bounds = tileBoundsForDocumentV1(documentWidth, documentHeight, image.coordinate);
  if (
    image.width !== bounds.validWidth ||
    image.height !== bounds.validHeight ||
    image.bytes.byteLength !== image.width * image.height * 4
  ) {
    throw new Error('baseline Raster Mask tile violates the document tile contract');
  }
}

function applyAffine(
  matrix: BaselineAffineMatrixV1 | undefined,
  x: number,
  y: number,
): readonly [number, number] {
  if (matrix === undefined) return [x, y];
  return [matrix[0] * x + matrix[2] * y + matrix[4], matrix[1] * x + matrix[3] * y + matrix[5]];
}

function sampleMaskInteger(
  mask: BaselineRasterMaskDescriptorV1,
  tileMap: ReadonlyMap<string, BaselineRasterMaskTileImageV1>,
  documentWidth: number,
  documentHeight: number,
  x: number,
  y: number,
): number {
  if (x < 0 || y < 0 || x >= documentWidth || y >= documentHeight) return mask.defaultCoverage;
  const tx = Math.floor(x / CANONICAL_TILE_SIZE_PX);
  const ty = Math.floor(y / CANONICAL_TILE_SIZE_PX);
  const tile = tileMap.get(maskTileStateKey({ tx, ty }));
  if (tile === undefined) return mask.defaultCoverage;
  const localX = x - tx * CANONICAL_TILE_SIZE_PX;
  const localY = y - ty * CANONICAL_TILE_SIZE_PX;
  if (localX < 0 || localY < 0 || localX >= tile.width || localY >= tile.height) {
    return mask.defaultCoverage;
  }
  return (tile.bytes[(localY * tile.width + localX) * 4] ?? mask.defaultCoverage * 255) / 255;
}

function sampleRawMaskCoverage(
  mask: BaselineRasterMaskDescriptorV1,
  tileMap: ReadonlyMap<string, BaselineRasterMaskTileImageV1>,
  documentWidth: number,
  documentHeight: number,
  documentX: number,
  documentY: number,
): number {
  const [maskX, maskY] = applyAffine(mask.documentToMask, documentX, documentY);
  const sampleX = maskX - 0.5;
  const sampleY = maskY - 0.5;
  const x0 = Math.floor(sampleX);
  const y0 = Math.floor(sampleY);
  const tx = sampleX - x0;
  const ty = sampleY - y0;
  const c00 = sampleMaskInteger(mask, tileMap, documentWidth, documentHeight, x0, y0);
  const c10 = sampleMaskInteger(mask, tileMap, documentWidth, documentHeight, x0 + 1, y0);
  const c01 = sampleMaskInteger(mask, tileMap, documentWidth, documentHeight, x0, y0 + 1);
  const c11 = sampleMaskInteger(mask, tileMap, documentWidth, documentHeight, x0 + 1, y0 + 1);
  const top = c00 + (c10 - c00) * tx;
  const bottom = c01 + (c11 - c01) * tx;
  return clamp01(top + (bottom - top) * ty);
}

function effectiveMaskSoftRadius(mask: BaselineRasterMaskDescriptorV1): number {
  let squared = 0;
  for (const effect of mask.effects) {
    if (effect.radiusPx <= 0) continue;
    squared += effect.radiusPx * effect.radiusPx;
  }
  return Math.sqrt(squared);
}

function sampleEffectiveMaskCoverage(
  mask: BaselineRasterMaskDescriptorV1,
  tileMap: ReadonlyMap<string, BaselineRasterMaskTileImageV1>,
  documentWidth: number,
  documentHeight: number,
  documentX: number,
  documentY: number,
): number {
  const radius = effectiveMaskSoftRadius(mask);
  let coverage: number;
  if (radius <= 0) {
    coverage = sampleRawMaskCoverage(
      mask,
      tileMap,
      documentWidth,
      documentHeight,
      documentX,
      documentY,
    );
  } else {
    const step = radius / 2;
    let weighted = 0;
    for (let yi = 0; yi < MASK_SOFTEN_WEIGHTS.length; yi += 1) {
      const wy = MASK_SOFTEN_WEIGHTS[yi] ?? 0;
      for (let xi = 0; xi < MASK_SOFTEN_WEIGHTS.length; xi += 1) {
        const wx = MASK_SOFTEN_WEIGHTS[xi] ?? 0;
        weighted +=
          sampleRawMaskCoverage(
            mask,
            tileMap,
            documentWidth,
            documentHeight,
            documentX + (xi - 2) * step,
            documentY + (yi - 2) * step,
          ) *
          wx *
          wy;
      }
    }
    coverage = weighted / MASK_SOFTEN_WEIGHT_TOTAL;
  }
  return mask.inverted ? 1 - coverage : coverage;
}

function isTransparent(image: BaselineRasterTileImageV1): boolean {
  const alphaStride = image.pixelFormat === 'rgba8-unorm' ? 4 : 8;
  const alphaOffset = image.pixelFormat === 'rgba8-unorm' ? 3 : 6;
  for (let offset = alphaOffset; offset < image.bytes.byteLength; offset += alphaStride) {
    if (
      (image.bytes[offset] ?? 0) !== 0 ||
      (alphaStride === 8 && (image.bytes[offset + 1] ?? 0) !== 0)
    ) {
      return false;
    }
  }
  return true;
}

export class BaselineRasterTileStoreV1 {
  readonly #documentWidth: number;
  readonly #documentHeight: number;
  readonly #pixelFormat: DocumentPrecision;
  readonly #workingSpace: DocumentColorSpace;
  readonly #tiles = new Map<string, BaselineRasterTileImageV1>();
  readonly #compositeCache = new Map<string, BaselineRasterTileImageV1>();
  #layers: readonly BaselineRasterLayerDescriptorV1[];
  #active: ActiveTileTransactionV1 | null = null;

  constructor(
    documentWidth: number,
    documentHeight: number,
    pixelFormat: DocumentPrecision,
    layers: readonly BaselineRasterLayerDescriptorV1[] = [],
    workingSpace: DocumentColorSpace = 'srgb',
  ) {
    tileBoundsForDocumentV1(documentWidth, documentHeight, { tx: 0, ty: 0 });
    this.#documentWidth = documentWidth;
    this.#documentHeight = documentHeight;
    this.#pixelFormat = pixelFormat;
    this.#workingSpace = workingSpace;
    this.#layers = this.#normalizeLayers(layers);
  }

  get pixelFormat(): DocumentPrecision {
    return this.#pixelFormat;
  }

  setLayers(layers: readonly BaselineRasterLayerDescriptorV1[]): void {
    this.#layers = this.#normalizeLayers(layers);
    this.#compositeCache.clear();
  }

  applyDabs(
    layerId: string,
    strokeId: string,
    dabs: readonly BaselineBrushDabV1[],
    operation: BaselineBrushCompositeOperationV1 = 'paint',
  ): void {
    if (strokeId.length === 0) throw new TypeError('tile transaction strokeId must not be empty');
    if (this.#active !== null && this.#active.strokeId !== strokeId) {
      throw new Error('another baseline raster tile transaction is active');
    }
    if (this.#active === null) {
      this.#active = {
        strokeId,
        layerId,
        operation,
        before: new Map(),
        affected: new Map(),
        paintCoverage: new Map(),
        paintStrokeOpacity: null,
        lastSmudgeDab: null,
      };
    }
    if (this.#active.layerId !== layerId) throw new Error('active stroke changed raster layer');
    if (this.#active.operation !== operation)
      throw new Error('active stroke changed brush operation');
    if (operation === 'smudge') {
      this.#applySmudgeDabs(layerId, dabs);
      return;
    }
    if (operation === 'blur') {
      this.#applyBlurDabs(layerId, dabs);
      return;
    }

    for (const plan of planBaselineBrushTilesV1(dabs, this.#documentWidth, this.#documentHeight)) {
      const coordinateKey = tileKeyV1(plan.coordinate);
      this.#compositeCache.delete(coordinateKey);
      const key = tileStateKey(layerId, plan.coordinate);
      const current = this.#tiles.get(key);
      if (operation === 'erase' && (current === undefined || isTransparent(current))) continue;
      if (!this.#active.before.has(key)) {
        this.#active.before.set(key, current === undefined ? null : cloneTile(current));
        this.#active.affected.set(key, freezeCoordinate(plan.coordinate));
      }
      let tile = current;
      if (tile === undefined) {
        tile = createTransparentTile(
          layerId,
          plan.coordinate,
          this.#documentWidth,
          this.#documentHeight,
          this.#pixelFormat,
        );
        this.#tiles.set(key, tile);
      }
      const bounds = tileBoundsForDocumentV1(
        this.#documentWidth,
        this.#documentHeight,
        plan.coordinate,
      );
      let coverage: Float32Array | null = null;
      if (operation === 'paint' && plan.dabs.some(baselineDabUsesFlowOpacityV1)) {
        const strokeOpacity = baselineDabStrokeOpacityV1(plan.dabs[0] ?? dabs[0]!);
        if (this.#active.paintStrokeOpacity === null) {
          this.#active.paintStrokeOpacity = strokeOpacity;
        } else if (Math.abs(this.#active.paintStrokeOpacity - strokeOpacity) > 1e-9) {
          throw new Error('active paint stroke changed opacity cap');
        }
        coverage =
          this.#active.paintCoverage.get(key) ?? new Float32Array(tile.width * tile.height);
        this.#active.paintCoverage.set(key, coverage);
      }
      for (const dab of plan.dabs) {
        if (operation === 'erase') rasterizeEraseDab(tile, bounds.x, bounds.y, dab);
        else rasterizeColorDab(tile, bounds.x, bounds.y, dab, coverage);
      }
    }
  }

  #applySmudgeDabs(layerId: string, dabs: readonly BaselineBrushDabV1[]): void {
    const active = this.#active;
    if (active === null || active.operation !== 'smudge') {
      throw new Error('smudge rasterization requires an active smudge transaction');
    }
    for (const dab of dabs) {
      const previous = active.lastSmudgeDab;
      active.lastSmudgeDab = dab;
      if (previous === null) continue;
      const deltaX = dab.x - previous.x;
      const deltaY = dab.y - previous.y;
      if (Math.hypot(deltaX, deltaY) <= 1e-9) continue;
      const snapshot = this.#snapshotSmudgeSourceTiles(layerId, dab, deltaX, deltaY);
      for (const plan of planBaselineBrushTilesV1(
        Object.freeze([dab]),
        this.#documentWidth,
        this.#documentHeight,
      )) {
        const key = tileStateKey(layerId, plan.coordinate);
        const current = this.#tiles.get(key);
        const working =
          current === undefined
            ? createTransparentTile(
                layerId,
                plan.coordinate,
                this.#documentWidth,
                this.#documentHeight,
                this.#pixelFormat,
              )
            : cloneTile(current);
        const bounds = tileBoundsForDocumentV1(
          this.#documentWidth,
          this.#documentHeight,
          plan.coordinate,
        );
        const changed = rasterizeSmudgeDab(
          working,
          bounds.x,
          bounds.y,
          dab,
          deltaX,
          deltaY,
          snapshot,
          this.#documentWidth,
          this.#documentHeight,
        );
        if (!changed) continue;
        if (!active.before.has(key)) {
          active.before.set(key, current === undefined ? null : cloneTile(current));
          active.affected.set(key, freezeCoordinate(plan.coordinate));
        }
        this.#tiles.set(key, working);
        this.#compositeCache.delete(tileKeyV1(plan.coordinate));
      }
    }
  }

  #snapshotSmudgeSourceTiles(
    layerId: string,
    dab: BaselineBrushDabV1,
    deltaX: number,
    deltaY: number,
  ): BaselineSmudgeSourceSnapshotV1 {
    const radiusX = baselineDabRadiusXV1(dab);
    const radiusY = baselineDabRadiusYV1(dab);
    const left = Math.max(0, Math.floor(dab.x - radiusX - deltaX) - 1);
    const top = Math.max(0, Math.floor(dab.y - radiusY - deltaY) - 1);
    const right = Math.min(this.#documentWidth - 1, Math.ceil(dab.x + radiusX - deltaX) + 1);
    const bottom = Math.min(this.#documentHeight - 1, Math.ceil(dab.y + radiusY - deltaY) + 1);
    const snapshot = new Map<string, BaselineRasterTileImageV1>();
    if (right < left || bottom < top) return snapshot;
    const minTx = Math.floor(left / CANONICAL_TILE_SIZE_PX);
    const minTy = Math.floor(top / CANONICAL_TILE_SIZE_PX);
    const maxTx = Math.floor(right / CANONICAL_TILE_SIZE_PX);
    const maxTy = Math.floor(bottom / CANONICAL_TILE_SIZE_PX);
    for (let ty = minTy; ty <= maxTy; ty += 1) {
      for (let tx = minTx; tx <= maxTx; tx += 1) {
        const coordinate = { tx, ty };
        const source = this.#tiles.get(tileStateKey(layerId, coordinate));
        if (source !== undefined) snapshot.set(tileKeyV1(coordinate), cloneTile(source));
      }
    }
    return snapshot;
  }

  #applyBlurDabs(layerId: string, dabs: readonly BaselineBrushDabV1[]): void {
    const active = this.#active;
    if (active === null || active.operation !== 'blur') {
      throw new Error('blur rasterization requires an active blur transaction');
    }
    for (const dab of dabs) {
      const blurRadius = blurBrushRadiusV1(dab);
      const snapshot = this.#snapshotBlurSourceTiles(layerId, dab, blurRadius);
      for (const plan of planBaselineBrushTilesV1(
        Object.freeze([dab]),
        this.#documentWidth,
        this.#documentHeight,
      )) {
        const key = tileStateKey(layerId, plan.coordinate);
        const current = this.#tiles.get(key);
        const working =
          current === undefined
            ? createTransparentTile(
                layerId,
                plan.coordinate,
                this.#documentWidth,
                this.#documentHeight,
                this.#pixelFormat,
              )
            : cloneTile(current);
        const bounds = tileBoundsForDocumentV1(
          this.#documentWidth,
          this.#documentHeight,
          plan.coordinate,
        );
        const changed = rasterizeBlurDab(
          working,
          bounds.x,
          bounds.y,
          dab,
          snapshot,
          this.#documentWidth,
          this.#documentHeight,
        );
        if (!changed) continue;
        if (!active.before.has(key)) {
          active.before.set(key, current === undefined ? null : cloneTile(current));
          active.affected.set(key, freezeCoordinate(plan.coordinate));
        }
        this.#tiles.set(key, working);
        this.#compositeCache.delete(tileKeyV1(plan.coordinate));
      }
    }
  }

  #snapshotBlurSourceTiles(
    layerId: string,
    dab: BaselineBrushDabV1,
    blurRadius: number,
  ): BaselineSmudgeSourceSnapshotV1 {
    const radiusX = baselineDabRadiusXV1(dab);
    const radiusY = baselineDabRadiusYV1(dab);
    const left = Math.max(0, Math.floor(dab.x - radiusX - blurRadius) - 1);
    const top = Math.max(0, Math.floor(dab.y - radiusY - blurRadius) - 1);
    const right = Math.min(this.#documentWidth - 1, Math.ceil(dab.x + radiusX + blurRadius) + 1);
    const bottom = Math.min(this.#documentHeight - 1, Math.ceil(dab.y + radiusY + blurRadius) + 1);
    const snapshot = new Map<string, BaselineRasterTileImageV1>();
    if (right < left || bottom < top) return snapshot;
    const minTx = Math.floor(left / CANONICAL_TILE_SIZE_PX);
    const minTy = Math.floor(top / CANONICAL_TILE_SIZE_PX);
    const maxTx = Math.floor(right / CANONICAL_TILE_SIZE_PX);
    const maxTy = Math.floor(bottom / CANONICAL_TILE_SIZE_PX);
    for (let ty = minTy; ty <= maxTy; ty += 1) {
      for (let tx = minTx; tx <= maxTx; tx += 1) {
        const coordinate = { tx, ty };
        const source = this.#tiles.get(tileStateKey(layerId, coordinate));
        if (source !== undefined) snapshot.set(tileKeyV1(coordinate), cloneTile(source));
      }
    }
    return snapshot;
  }

  finalize(strokeId: string): readonly BaselineRasterTilePatchV1[] {
    const active = this.#active;
    if (active === null || active.strokeId !== strokeId) {
      throw new Error('baseline raster tile finalization has no matching active stroke');
    }
    const patches = [...active.affected.entries()].map(([key, coordinate]) => {
      const before = active.before.get(key) ?? null;
      const current = this.#tiles.get(key);
      const after = current === undefined || isTransparent(current) ? null : cloneTile(current);
      if (after === null) this.#tiles.delete(key);
      return Object.freeze({
        schema: 'illustro.baseline-raster-tile-patch/1' as const,
        layerId: active.layerId,
        coordinate,
        before,
        after,
      });
    });
    this.#active = null;
    return Object.freeze(patches);
  }

  cancel(strokeId: string): readonly BaselineRasterTilePatchV1[] {
    const active = this.#active;
    if (active === null || active.strokeId !== strokeId) return Object.freeze([]);
    const patches = [...active.affected.entries()].map(([key, coordinate]) => {
      const provisional = this.#tiles.get(key);
      const before = active.before.get(key) ?? null;
      if (before === null) this.#tiles.delete(key);
      else this.#tiles.set(key, cloneTile(before));
      this.#compositeCache.delete(tileKeyV1(coordinate));
      return Object.freeze({
        schema: 'illustro.baseline-raster-tile-patch/1' as const,
        layerId: active.layerId,
        coordinate,
        before: provisional === undefined ? null : cloneTile(provisional),
        after: before === null ? null : cloneTile(before),
      });
    });
    this.#active = null;
    return Object.freeze(patches);
  }

  applyPatches(
    patches: readonly BaselineRasterTilePatchV1[],
    direction: BaselineRasterTilePatchDirectionV1,
  ): readonly TileCoordinateV1[] {
    const affected = new Map<string, TileCoordinateV1>();
    for (const patch of patches) {
      const selected = direction === 'before' ? patch.before : patch.after;
      const key = tileStateKey(patch.layerId, patch.coordinate);
      if (selected === null) this.#tiles.delete(key);
      else {
        validateTileImage(selected, this.#documentWidth, this.#documentHeight, this.#pixelFormat);
        this.#tiles.set(key, cloneTile(selected));
      }
      const coordinateKey = tileKeyV1(patch.coordinate);
      this.#compositeCache.delete(coordinateKey);
      affected.set(coordinateKey, freezeCoordinate(patch.coordinate));
    }
    return Object.freeze([...affected.values()]);
  }

  restore(tiles: readonly BaselineRasterTileImageV1[]): void {
    this.#tiles.clear();
    this.#compositeCache.clear();
    this.#active = null;
    for (const tile of tiles) {
      validateTileImage(tile, this.#documentWidth, this.#documentHeight, this.#pixelFormat);
      if (!isTransparent(tile))
        this.#tiles.set(tileStateKey(tile.layerId, tile.coordinate), cloneTile(tile));
    }
  }

  exportTiles(): readonly BaselineRasterTileImageV1[] {
    return Object.freeze([...this.#tiles.values()].map((tile) => cloneTile(tile)));
  }

  compositeTiles(
    coordinates?: readonly TileCoordinateV1[],
    options: { readonly includeDraft?: boolean } = {},
  ): readonly BaselineRasterTileImageV1[] {
    const selected = new Map<string, TileCoordinateV1>();
    if (coordinates === undefined) {
      for (const tile of this.#tiles.values()) {
        selected.set(tileKeyV1(tile.coordinate), tile.coordinate);
      }
    } else {
      for (const coordinate of coordinates) selected.set(tileKeyV1(coordinate), coordinate);
    }
    const includeDraft = options.includeDraft !== false;
    const visibleLayers = this.#layers.filter(
      (layer) => layer.visible && layer.opacity > 0 && (includeDraft || layer.draft !== true),
    );
    const result: BaselineRasterTileImageV1[] = [];
    for (const [key, coordinate] of selected) {
      let composite = includeDraft ? this.#compositeCache.get(key) : undefined;
      if (composite === undefined) {
        composite = this.#composeCoordinate(coordinate, visibleLayers);
        if (includeDraft) this.#compositeCache.set(key, composite);
      }
      result.push(cloneTile(composite));
    }
    return Object.freeze(result);
  }

  #composeCoordinate(
    coordinate: TileCoordinateV1,
    visibleLayers: readonly BaselineRasterLayerDescriptorV1[],
  ): BaselineRasterTileImageV1 {
    const only = visibleLayers[0];
    if (
      visibleLayers.length === 1 &&
      only?.opacity === 1 &&
      only.clippingBaseLayerId === undefined &&
      (only.masks?.length ?? 0) === 0
    ) {
      const source = this.#tiles.get(tileStateKey(only.layerId, coordinate));
      if (source === undefined) {
        return createTransparentTile(
          '__composite__',
          coordinate,
          this.#documentWidth,
          this.#documentHeight,
          this.#pixelFormat,
        );
      }
      if (source.pixelFormat === 'rgba8-unorm') {
        const output = cloneTile(source, '__composite__');
        for (let alphaOffset = 3; alphaOffset < output.bytes.byteLength; alphaOffset += 4) {
          if ((output.bytes[alphaOffset] ?? 0) !== 0) continue;
          output.bytes[alphaOffset - 3] = 0;
          output.bytes[alphaOffset - 2] = 0;
          output.bytes[alphaOffset - 1] = 0;
        }
        return output;
      }
    }

    const output = createTransparentTile(
      '__composite__',
      coordinate,
      this.#documentWidth,
      this.#documentHeight,
      this.#pixelFormat,
    );
    const bounds = tileBoundsForDocumentV1(this.#documentWidth, this.#documentHeight, coordinate);
    const eligibleLayerIds = new Set(visibleLayers.map((layer) => layer.layerId));
    const layersById = new Map(this.#layers.map((layer) => [layer.layerId, layer] as const));
    const maskCoverageMemo = new Map<string, Float32Array | null>();
    const effectiveAlphaMemo = new Map<string, Float32Array>();

    const maskCoverageForLayer = (layer: BaselineRasterLayerDescriptorV1): Float32Array | null => {
      if (maskCoverageMemo.has(layer.layerId)) return maskCoverageMemo.get(layer.layerId) ?? null;
      const masks = (layer.masks ?? []).filter((mask) => mask.enabled);
      if (masks.length === 0) {
        maskCoverageMemo.set(layer.layerId, null);
        return null;
      }
      const result = new Float32Array(output.width * output.height);
      result.fill(1);
      const tileMaps = new Map(
        masks.map(
          (mask) =>
            [
              mask.maskId,
              new Map(mask.tiles.map((tile) => [maskTileStateKey(tile.coordinate), tile] as const)),
            ] as const,
        ),
      );
      for (const mask of masks) {
        const tileMap = tileMaps.get(mask.maskId);
        if (tileMap === undefined) continue;
        for (let pixel = 0; pixel < result.length; pixel += 1) {
          const localX = pixel % output.width;
          const localY = Math.floor(pixel / output.width);
          result[pixel] =
            (result[pixel] ?? 1) *
            sampleEffectiveMaskCoverage(
              mask,
              tileMap,
              this.#documentWidth,
              this.#documentHeight,
              bounds.x + localX + 0.5,
              bounds.y + localY + 0.5,
            );
        }
      }
      maskCoverageMemo.set(layer.layerId, result);
      return result;
    };

    const effectiveAlphaForLayer = (
      layerId: string,
      resolving: ReadonlySet<string> = new Set(),
    ): Float32Array => {
      const cached = effectiveAlphaMemo.get(layerId);
      if (cached !== undefined) return cached;
      if (resolving.has(layerId)) throw new Error(`cyclic baseline clipping chain at ${layerId}`);
      const layer = layersById.get(layerId);
      const result = new Float32Array(output.width * output.height);
      if (layer === undefined || !eligibleLayerIds.has(layerId)) {
        effectiveAlphaMemo.set(layerId, result);
        return result;
      }
      const source = this.#tiles.get(tileStateKey(layerId, coordinate));
      if (source === undefined) {
        effectiveAlphaMemo.set(layerId, result);
        return result;
      }
      const masks = maskCoverageForLayer(layer);
      const nextResolving = new Set(resolving);
      nextResolving.add(layerId);
      const baseCoverage =
        layer.clippingBaseLayerId === undefined
          ? null
          : effectiveAlphaForLayer(layer.clippingBaseLayerId, nextResolving);
      for (let pixel = 0; pixel < result.length; pixel += 1) {
        const sourceAlpha = readPixel(source, pixel)[3];
        result[pixel] =
          sourceAlpha * layer.opacity * (masks?.[pixel] ?? 1) * (baseCoverage?.[pixel] ?? 1);
      }
      effectiveAlphaMemo.set(layerId, result);
      return result;
    };

    for (const layer of visibleLayers) {
      const source = this.#tiles.get(tileStateKey(layer.layerId, coordinate));
      if (source === undefined) continue;
      const masks = maskCoverageForLayer(layer);
      const clippingCoverage =
        layer.clippingBaseLayerId === undefined
          ? null
          : effectiveAlphaForLayer(layer.clippingBaseLayerId);
      for (let pixel = 0; pixel < output.width * output.height; pixel += 1) {
        const rawSource = readPixel(source, pixel);
        const coverage = (masks?.[pixel] ?? 1) * (clippingCoverage?.[pixel] ?? 1);
        if (rawSource[3] <= 0 || coverage <= 0) continue;
        const sourcePixel: [number, number, number, number] = [
          rawSource[0],
          rawSource[1],
          rawSource[2],
          rawSource[3] * coverage,
        ];
        const destination = readPixel(output, pixel);
        const blendMode = layer.blendMode ?? 'normal';
        if (!isM5cBaseBlendModeV1(blendMode)) {
          throw new Error(`unsupported baseline blend mode: ${blendMode}`);
        }
        writePixel(
          output,
          pixel,
          compositeBlendRgbaV1(
            destination,
            sourcePixel,
            layer.opacity,
            blendMode,
            this.#workingSpace,
          ),
        );
      }
    }
    return output;
  }

  #normalizeLayers(
    layers: readonly BaselineRasterLayerDescriptorV1[],
  ): readonly BaselineRasterLayerDescriptorV1[] {
    const seen = new Set<string>();
    const normalized = layers.map((layer) => {
      if (layer.layerId.length === 0 || seen.has(layer.layerId)) {
        throw new TypeError('baseline raster layer IDs must be unique and non-empty');
      }
      if (!Number.isFinite(layer.opacity) || layer.opacity < 0 || layer.opacity > 1) {
        throw new RangeError('baseline raster layer opacity must be between 0 and 1');
      }
      const blendMode = layer.blendMode ?? 'normal';
      if (!isM5cBaseBlendModeV1(blendMode)) {
        throw new Error(`unsupported baseline blend mode: ${blendMode}`);
      }
      const maskIds = new Set<string>();
      const masks = Object.freeze(
        (layer.masks ?? []).map((mask) => {
          if (mask.maskId.length === 0 || maskIds.has(mask.maskId)) {
            throw new TypeError('baseline Raster Mask IDs must be unique and non-empty per layer');
          }
          if (mask.defaultCoverage !== 0 && mask.defaultCoverage !== 1) {
            throw new TypeError('baseline Raster Mask default coverage must be 0 or 1');
          }
          maskIds.add(mask.maskId);
          const effects = Object.freeze(
            mask.effects.map((effect) => {
              if (
                (effect.kind !== 'feather' && effect.kind !== 'blur') ||
                !Number.isFinite(effect.radiusPx) ||
                effect.radiusPx < 0
              ) {
                throw new Error('invalid baseline Raster Mask coverage effect');
              }
              return Object.freeze({ kind: effect.kind, radiusPx: effect.radiusPx });
            }),
          );
          const matrix = mask.documentToMask;
          if (
            matrix !== undefined &&
            (matrix.length !== 6 || matrix.some((entry) => !Number.isFinite(entry)))
          ) {
            throw new Error('invalid baseline Raster Mask affine matrix');
          }
          const tiles = Object.freeze(
            mask.tiles.map((tile) => {
              validateMaskTileImage(tile, this.#documentWidth, this.#documentHeight);
              return Object.freeze({
                coordinate: freezeCoordinate(tile.coordinate),
                width: tile.width,
                height: tile.height,
                bytes: tile.bytes,
              });
            }),
          );
          return Object.freeze({
            maskId: mask.maskId,
            enabled: mask.enabled,
            inverted: mask.inverted,
            defaultCoverage: mask.defaultCoverage,
            effects,
            tiles,
            ...(matrix === undefined
              ? {}
              : { documentToMask: Object.freeze([...matrix]) as BaselineAffineMatrixV1 }),
          });
        }),
      );
      seen.add(layer.layerId);
      return Object.freeze({
        layerId: layer.layerId,
        visible: layer.visible,
        opacity: layer.opacity,
        draft: layer.draft ?? false,
        ...(blendMode === 'normal' ? {} : { blendMode }),
        ...(masks.length === 0 ? {} : { masks }),
        ...(layer.clippingBaseLayerId === undefined
          ? {}
          : { clippingBaseLayerId: layer.clippingBaseLayerId }),
      });
    });
    const layerIds = new Set(normalized.map((layer) => layer.layerId));
    for (const layer of normalized) {
      if (layer.clippingBaseLayerId === undefined) continue;
      if (layer.clippingBaseLayerId === layer.layerId || !layerIds.has(layer.clippingBaseLayerId)) {
        throw new Error('baseline clipping base must reference another configured Raster Layer');
      }
    }
    return Object.freeze(normalized);
  }
}
