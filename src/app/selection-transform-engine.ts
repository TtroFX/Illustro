import { parseRevision, type LayerId, type Revision } from '../domain/identity.js';
import type { RasterLayerV1, RasterTileReferenceV1 } from '../domain/layers.js';
import { CANONICAL_TILE_SIZE_PX, tileBoundsForDocumentV1 } from '../gpu/sparse-tile-model.js';
import type {
  PaintDecodedRasterTileV1,
  PaintRasterTilePixelFormatV1,
} from './paint-persistence-controller.js';
import type { PaintProjectSnapshotV1 } from './paint-session-controller.js';
import type {
  PreparedRasterMergeTileV1,
  RasterMergePersistencePortV1,
} from './layer-raster-merge.js';
import type { RasterSelectionCoverageV1 } from './selection-coverage-controller.js';
import {
  prepareSelectionCutV1,
  selectionCutEligibilityV1,
  type PreparedSelectionCutV1,
} from './selection-cut-engine.js';

export type SelectionAffineMatrixV1 = readonly [number, number, number, number, number, number];

export interface SelectionAffineTransformInputV1 {
  readonly translateX: number;
  readonly translateY: number;
  readonly scaleX: number;
  readonly scaleY: number;
  readonly rotationDeg: number;
  readonly pivotX: number;
  readonly pivotY: number;
}

export interface SelectionTransformEligibilityV1 {
  readonly eligible: boolean;
  readonly layerId: LayerId;
  readonly reason: string | null;
}

export interface PreparedSelectionTransformV1 {
  readonly schema: 'illustro.prepared-selection-transform/1';
  readonly layerId: LayerId;
  readonly sourceRevision: Revision;
  readonly documentRevision: Revision;
  readonly selectionSourceRevision: Revision;
  readonly transform: SelectionAffineTransformInputV1;
  readonly matrix: SelectionAffineMatrixV1;
  readonly resampling: 'nearest-neighbor';
  readonly tiles: readonly PreparedRasterMergeTileV1[];
}

interface DecodedSparseTileV1 {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly bytes: Uint8Array<ArrayBuffer>;
}

interface MutableRasterTileV1 {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly bytes: Uint8Array<ArrayBuffer>;
}

interface PixelBoundsV1 {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

function unavailable(layerId: LayerId, reason: string): SelectionTransformEligibilityV1 {
  return Object.freeze({ eligible: false, layerId, reason });
}

export function selectionTransformEligibilityV1(
  snapshot: PaintProjectSnapshotV1,
  layerId: LayerId,
  coverage: RasterSelectionCoverageV1 | null,
): SelectionTransformEligibilityV1 {
  const cut = selectionCutEligibilityV1(snapshot, layerId, coverage);
  if (!cut.eligible)
    return unavailable(layerId, cut.reason ?? 'selection transform is unavailable');
  const layer = snapshot.document.layerTree.layers[layerId];
  if (layer === undefined)
    return unavailable(layerId, 'selection transform target layer is missing');
  if (layer.locks.position) {
    return unavailable(layerId, 'selection transform is blocked by the layer position lock');
  }
  return Object.freeze({ eligible: true, layerId, reason: null });
}

function finite(value: number, label: string): number {
  if (!Number.isFinite(value)) throw new RangeError(`${label} must be finite`);
  return value;
}

function normalizeTransformV1(
  input: SelectionAffineTransformInputV1,
): SelectionAffineTransformInputV1 {
  const normalized = Object.freeze({
    translateX: finite(input.translateX, 'translateX'),
    translateY: finite(input.translateY, 'translateY'),
    scaleX: finite(input.scaleX, 'scaleX'),
    scaleY: finite(input.scaleY, 'scaleY'),
    rotationDeg: finite(input.rotationDeg, 'rotationDeg'),
    pivotX: finite(input.pivotX, 'pivotX'),
    pivotY: finite(input.pivotY, 'pivotY'),
  });
  if (normalized.scaleX <= 0 || normalized.scaleY <= 0) {
    throw new RangeError('selection transform scale must be greater than zero');
  }
  if (
    normalized.translateX === 0 &&
    normalized.translateY === 0 &&
    normalized.scaleX === 1 &&
    normalized.scaleY === 1 &&
    normalized.rotationDeg === 0
  ) {
    throw new Error('selection transform has no changes');
  }
  return normalized;
}

function canonicalZero(value: number): number {
  return Object.is(value, -0) ? 0 : value;
}

export function selectionAffineMatrixV1(
  input: SelectionAffineTransformInputV1,
): SelectionAffineMatrixV1 {
  const normalized = normalizeTransformV1(input);
  const radians = (normalized.rotationDeg * Math.PI) / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  const a = canonicalZero(cosine * normalized.scaleX);
  const b = canonicalZero(sine * normalized.scaleX);
  const c = canonicalZero(-sine * normalized.scaleY);
  const d = canonicalZero(cosine * normalized.scaleY);
  const e = canonicalZero(
    normalized.translateX + normalized.pivotX - a * normalized.pivotX - c * normalized.pivotY,
  );
  const f = canonicalZero(
    normalized.translateY + normalized.pivotY - b * normalized.pivotX - d * normalized.pivotY,
  );
  return Object.freeze([a, b, c, d, e, f]);
}

function inverseAffineV1(matrix: SelectionAffineMatrixV1): SelectionAffineMatrixV1 {
  const [a, b, c, d, e, f] = matrix;
  const determinant = a * d - b * c;
  if (!Number.isFinite(determinant) || Math.abs(determinant) < 1e-12) {
    throw new Error('selection transform affine matrix is not invertible');
  }
  const inverse = 1 / determinant;
  return Object.freeze([
    canonicalZero(d * inverse),
    canonicalZero(-b * inverse),
    canonicalZero(-c * inverse),
    canonicalZero(a * inverse),
    canonicalZero((c * f - d * e) * inverse),
    canonicalZero((b * e - a * f) * inverse),
  ]);
}

function transformPointV1(
  matrix: SelectionAffineMatrixV1,
  x: number,
  y: number,
): readonly [number, number] {
  return Object.freeze([
    matrix[0] * x + matrix[2] * y + matrix[4],
    matrix[1] * x + matrix[3] * y + matrix[5],
  ]);
}

function tileKeyV1(x: number, y: number): string {
  return `${x}:${y}`;
}

function bytesPerPixelV1(pixelFormat: PaintRasterTilePixelFormatV1): 4 | 8 {
  return pixelFormat === 'rgba8-unorm' ? 4 : 8;
}

function validateTileV1(
  tile: PaintDecodedRasterTileV1,
  pixelFormat: PaintRasterTilePixelFormatV1,
  width: number,
  height: number,
  label: string,
): void {
  if (tile.pixelFormat !== pixelFormat || tile.width !== width || tile.height !== height) {
    throw new Error(`${label} does not match the document raster contract`);
  }
  if (tile.bytes.byteLength !== width * height * bytesPerPixelV1(pixelFormat)) {
    throw new Error(`${label} byte length is invalid`);
  }
}

async function decodePreparedTilesV1(
  tiles: readonly PreparedRasterMergeTileV1[],
  width: number,
  height: number,
  pixelFormat: PaintRasterTilePixelFormatV1,
  persistence: RasterMergePersistencePortV1,
  label: string,
): Promise<ReadonlyMap<string, DecodedSparseTileV1>> {
  const decoded = new Map<string, DecodedSparseTileV1>();
  for (const reference of tiles) {
    const key = tileKeyV1(reference.x, reference.y);
    if (decoded.has(key)) throw new Error(`${label} contains duplicate tile ${key}`);
    const bounds = tileBoundsForDocumentV1(width, height, { tx: reference.x, ty: reference.y });
    const payload = await persistence.readRasterTile(reference.payloadRef);
    validateTileV1(payload, pixelFormat, bounds.validWidth, bounds.validHeight, label);
    decoded.set(
      key,
      Object.freeze({
        x: reference.x,
        y: reference.y,
        width: bounds.validWidth,
        height: bounds.validHeight,
        bytes: payload.bytes,
      }),
    );
  }
  return decoded;
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
  if (!Number.isFinite(value))
    throw new Error('selection transform produced a non-finite RGBA16F value');
  const float = new Float32Array([value]);
  const bits = new Uint32Array(float.buffer)[0] ?? 0;
  const sign = (bits >>> 16) & 0x8000;
  let exponent = ((bits >>> 23) & 0xff) - 127 + 15;
  let fraction = bits & 0x7fffff;
  if (exponent <= 0) {
    if (exponent < -10) return sign;
    fraction = (fraction | 0x800000) >>> (1 - exponent);
    return sign | ((fraction + 0x1000) >>> 13);
  }
  if (exponent >= 31) return sign | 0x7bff;
  fraction += 0x1000;
  if ((fraction & 0x800000) !== 0) {
    fraction = 0;
    exponent += 1;
    if (exponent >= 31) return sign | 0x7bff;
  }
  return sign | (exponent << 10) | (fraction >>> 13);
}

function alphaAtV1(
  bytes: Uint8Array,
  offset: number,
  pixelFormat: PaintRasterTilePixelFormatV1,
): number {
  if (pixelFormat === 'rgba8-unorm') return (bytes[offset + 3] ?? 0) / 255;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const alpha = halfToFloatV1(view.getUint16(offset + 6, true));
  if (!Number.isFinite(alpha))
    throw new Error('selection transform source contains non-finite alpha');
  return Math.min(1, Math.max(0, alpha));
}

function pixelBoundsV1(
  tiles: ReadonlyMap<string, DecodedSparseTileV1>,
  pixelFormat: PaintRasterTilePixelFormatV1,
): PixelBoundsV1 | null {
  const bytesPerPixel = bytesPerPixelV1(pixelFormat);
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const tile of tiles.values()) {
    const originX = tile.x * CANONICAL_TILE_SIZE_PX;
    const originY = tile.y * CANONICAL_TILE_SIZE_PX;
    for (let localY = 0; localY < tile.height; localY += 1) {
      for (let localX = 0; localX < tile.width; localX += 1) {
        const offset = (localY * tile.width + localX) * bytesPerPixel;
        if (alphaAtV1(tile.bytes, offset, pixelFormat) <= 0) continue;
        const x = originX + localX;
        const y = originY + localY;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }
  if (!Number.isFinite(minX)) return null;
  return Object.freeze({ minX, minY, maxX, maxY });
}

function transformedBoundsV1(
  source: PixelBoundsV1,
  matrix: SelectionAffineMatrixV1,
  width: number,
  height: number,
): PixelBoundsV1 | null {
  const corners = [
    transformPointV1(matrix, source.minX, source.minY),
    transformPointV1(matrix, source.maxX + 1, source.minY),
    transformPointV1(matrix, source.minX, source.maxY + 1),
    transformPointV1(matrix, source.maxX + 1, source.maxY + 1),
  ];
  const xs = corners.map((point) => point[0]);
  const ys = corners.map((point) => point[1]);
  const minX = Math.max(0, Math.floor(Math.min(...xs)));
  const minY = Math.max(0, Math.floor(Math.min(...ys)));
  const maxX = Math.min(width - 1, Math.ceil(Math.max(...xs)) - 1);
  const maxY = Math.min(height - 1, Math.ceil(Math.max(...ys)) - 1);
  if (minX > maxX || minY > maxY) return null;
  return Object.freeze({ minX, minY, maxX, maxY });
}

function pixelSourceV1(
  tiles: ReadonlyMap<string, DecodedSparseTileV1>,
  x: number,
  y: number,
  pixelFormat: PaintRasterTilePixelFormatV1,
): { readonly bytes: Uint8Array<ArrayBuffer>; readonly offset: number } | null {
  if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y) || x < 0 || y < 0) return null;
  const tx = Math.floor(x / CANONICAL_TILE_SIZE_PX);
  const ty = Math.floor(y / CANONICAL_TILE_SIZE_PX);
  const tile = tiles.get(tileKeyV1(tx, ty));
  if (tile === undefined) return null;
  const localX = x - tx * CANONICAL_TILE_SIZE_PX;
  const localY = y - ty * CANONICAL_TILE_SIZE_PX;
  if (localX >= tile.width || localY >= tile.height) return null;
  return Object.freeze({
    bytes: tile.bytes,
    offset: (localY * tile.width + localX) * bytesPerPixelV1(pixelFormat),
  });
}

function mutableTileV1(
  tiles: Map<string, MutableRasterTileV1>,
  width: number,
  height: number,
  pixelFormat: PaintRasterTilePixelFormatV1,
  documentX: number,
  documentY: number,
): MutableRasterTileV1 {
  const tx = Math.floor(documentX / CANONICAL_TILE_SIZE_PX);
  const ty = Math.floor(documentY / CANONICAL_TILE_SIZE_PX);
  const key = tileKeyV1(tx, ty);
  const existing = tiles.get(key);
  if (existing !== undefined) return existing;
  const bounds = tileBoundsForDocumentV1(width, height, { tx, ty });
  const created: MutableRasterTileV1 = {
    x: tx,
    y: ty,
    width: bounds.validWidth,
    height: bounds.validHeight,
    bytes: new Uint8Array(bounds.validWidth * bounds.validHeight * bytesPerPixelV1(pixelFormat)),
  };
  tiles.set(key, created);
  return created;
}

function copyPixelV1(
  source: Uint8Array,
  sourceOffset: number,
  target: Uint8Array,
  targetOffset: number,
  bytesPerPixel: number,
): void {
  target.set(source.subarray(sourceOffset, sourceOffset + bytesPerPixel), targetOffset);
}

function rasterizeNearestV1(
  sourceTiles: ReadonlyMap<string, DecodedSparseTileV1>,
  sourceBounds: PixelBoundsV1,
  matrix: SelectionAffineMatrixV1,
  width: number,
  height: number,
  pixelFormat: PaintRasterTilePixelFormatV1,
): ReadonlyMap<string, MutableRasterTileV1> {
  const destinationBounds = transformedBoundsV1(sourceBounds, matrix, width, height);
  const staged = new Map<string, MutableRasterTileV1>();
  if (destinationBounds === null) return staged;
  const inverse = inverseAffineV1(matrix);
  const bytesPerPixel = bytesPerPixelV1(pixelFormat);
  for (let y = destinationBounds.minY; y <= destinationBounds.maxY; y += 1) {
    for (let x = destinationBounds.minX; x <= destinationBounds.maxX; x += 1) {
      const [sourceX, sourceY] = transformPointV1(inverse, x + 0.5, y + 0.5);
      const sourcePixel = pixelSourceV1(
        sourceTiles,
        Math.floor(sourceX),
        Math.floor(sourceY),
        pixelFormat,
      );
      if (sourcePixel === null) continue;
      if (alphaAtV1(sourcePixel.bytes, sourcePixel.offset, pixelFormat) <= 0) continue;
      const target = mutableTileV1(staged, width, height, pixelFormat, x, y);
      const targetBounds = tileBoundsForDocumentV1(width, height, { tx: target.x, ty: target.y });
      const targetOffset =
        ((y - targetBounds.y) * target.width + (x - targetBounds.x)) * bytesPerPixel;
      copyPixelV1(sourcePixel.bytes, sourcePixel.offset, target.bytes, targetOffset, bytesPerPixel);
    }
  }
  return staged;
}

function sourceOverRgba8V1(
  target: Uint8Array,
  targetOffset: number,
  source: Uint8Array,
  sourceOffset: number,
): void {
  const sourceAlpha = (source[sourceOffset + 3] ?? 0) / 255;
  if (sourceAlpha <= 0) return;
  if (sourceAlpha >= 1) {
    copyPixelV1(source, sourceOffset, target, targetOffset, 4);
    return;
  }
  const targetAlpha = (target[targetOffset + 3] ?? 0) / 255;
  if (targetAlpha <= 0) {
    copyPixelV1(source, sourceOffset, target, targetOffset, 4);
    return;
  }
  const outputAlpha = sourceAlpha + targetAlpha * (1 - sourceAlpha);
  for (let channel = 0; channel < 3; channel += 1) {
    const sourceValue = (source[sourceOffset + channel] ?? 0) / 255;
    const targetValue = (target[targetOffset + channel] ?? 0) / 255;
    const output =
      (sourceValue * sourceAlpha + targetValue * targetAlpha * (1 - sourceAlpha)) / outputAlpha;
    target[targetOffset + channel] = Math.round(Math.min(1, Math.max(0, output)) * 255);
  }
  target[targetOffset + 3] = Math.round(outputAlpha * 255);
}

function sourceOverRgba16V1(
  target: Uint8Array,
  targetOffset: number,
  source: Uint8Array,
  sourceOffset: number,
): void {
  const sourceView = new DataView(source.buffer, source.byteOffset, source.byteLength);
  const targetView = new DataView(target.buffer, target.byteOffset, target.byteLength);
  const sourceAlpha = Math.min(
    1,
    Math.max(0, halfToFloatV1(sourceView.getUint16(sourceOffset + 6, true))),
  );
  if (!Number.isFinite(sourceAlpha))
    throw new Error('selection transform source alpha is non-finite');
  if (sourceAlpha <= 0) return;
  if (sourceAlpha >= 1) {
    copyPixelV1(source, sourceOffset, target, targetOffset, 8);
    return;
  }
  const targetAlpha = Math.min(
    1,
    Math.max(0, halfToFloatV1(targetView.getUint16(targetOffset + 6, true))),
  );
  if (!Number.isFinite(targetAlpha))
    throw new Error('selection transform target alpha is non-finite');
  if (targetAlpha <= 0) {
    copyPixelV1(source, sourceOffset, target, targetOffset, 8);
    return;
  }
  const outputAlpha = sourceAlpha + targetAlpha * (1 - sourceAlpha);
  for (let channel = 0; channel < 3; channel += 1) {
    const sourceValue = halfToFloatV1(sourceView.getUint16(sourceOffset + channel * 2, true));
    const targetValue = halfToFloatV1(targetView.getUint16(targetOffset + channel * 2, true));
    if (!Number.isFinite(sourceValue) || !Number.isFinite(targetValue)) {
      throw new Error('selection transform source-over requires finite RGBA16F color values');
    }
    const output =
      (sourceValue * sourceAlpha + targetValue * targetAlpha * (1 - sourceAlpha)) / outputAlpha;
    targetView.setUint16(targetOffset + channel * 2, floatToHalfV1(output), true);
  }
  targetView.setUint16(targetOffset + 6, floatToHalfV1(outputAlpha), true);
}

function sourceOverV1(
  target: Uint8Array,
  targetOffset: number,
  source: Uint8Array,
  sourceOffset: number,
  pixelFormat: PaintRasterTilePixelFormatV1,
): void {
  if (pixelFormat === 'rgba8-unorm') {
    sourceOverRgba8V1(target, targetOffset, source, sourceOffset);
  } else {
    sourceOverRgba16V1(target, targetOffset, source, sourceOffset);
  }
}

function tileHasAlphaV1(bytes: Uint8Array, pixelFormat: PaintRasterTilePixelFormatV1): boolean {
  const bytesPerPixel = bytesPerPixelV1(pixelFormat);
  for (let offset = 0; offset < bytes.byteLength; offset += bytesPerPixel) {
    if (alphaAtV1(bytes, offset, pixelFormat) > 0) return true;
  }
  return false;
}

async function composeTransformV1(
  cut: PreparedSelectionCutV1,
  matrix: SelectionAffineMatrixV1,
  width: number,
  height: number,
  pixelFormat: PaintRasterTilePixelFormatV1,
  persistence: RasterMergePersistencePortV1,
): Promise<readonly PreparedRasterMergeTileV1[]> {
  const selected = await decodePreparedTilesV1(
    cut.transfer.tiles,
    width,
    height,
    pixelFormat,
    persistence,
    'selection transform selected tile',
  );
  const sourceBounds = pixelBoundsV1(selected, pixelFormat);
  if (sourceBounds === null) throw new Error('selection transform selected content is empty');
  const transformed = rasterizeNearestV1(
    selected,
    sourceBounds,
    matrix,
    width,
    height,
    pixelFormat,
  );
  const remainingRefs = new Map<string, PreparedRasterMergeTileV1>();
  for (const tile of cut.remainingTiles) remainingRefs.set(tileKeyV1(tile.x, tile.y), tile);
  const finalTiles: PreparedRasterMergeTileV1[] = [];
  const bytesPerPixel = bytesPerPixelV1(pixelFormat);

  for (const transformedTile of [...transformed.values()].sort(
    (left, right) => left.y - right.y || left.x - right.x,
  )) {
    const key = tileKeyV1(transformedTile.x, transformedTile.y);
    const remaining = remainingRefs.get(key);
    let combined = new Uint8Array(transformedTile.bytes.byteLength);
    if (remaining !== undefined) {
      const decoded = await persistence.readRasterTile(remaining.payloadRef);
      validateTileV1(
        decoded,
        pixelFormat,
        transformedTile.width,
        transformedTile.height,
        'selection transform remaining tile',
      );
      combined = new Uint8Array(decoded.bytes);
      remainingRefs.delete(key);
    }
    for (let offset = 0; offset < transformedTile.bytes.byteLength; offset += bytesPerPixel) {
      if (alphaAtV1(transformedTile.bytes, offset, pixelFormat) <= 0) continue;
      sourceOverV1(combined, offset, transformedTile.bytes, offset, pixelFormat);
    }
    if (!tileHasAlphaV1(combined, pixelFormat)) continue;
    const persisted = await persistence.persistRasterTile({
      width: transformedTile.width,
      height: transformedTile.height,
      pixelFormat,
      bytes: combined,
    });
    finalTiles.push(
      Object.freeze({
        x: transformedTile.x,
        y: transformedTile.y,
        payloadRef: persisted.payloadRef,
      }),
    );
  }

  for (const remaining of remainingRefs.values()) {
    finalTiles.push(Object.freeze({ ...remaining }));
  }
  return Object.freeze(finalTiles.sort((left, right) => left.y - right.y || left.x - right.x));
}

export async function prepareSelectionAffineTransformV1(
  snapshot: PaintProjectSnapshotV1,
  layerId: LayerId,
  coverage: RasterSelectionCoverageV1 | null,
  input: SelectionAffineTransformInputV1,
  persistence: RasterMergePersistencePortV1,
): Promise<PreparedSelectionTransformV1> {
  const transform = normalizeTransformV1(input);
  const eligibility = selectionTransformEligibilityV1(snapshot, layerId, coverage);
  if (!eligibility.eligible) {
    throw new Error(eligibility.reason ?? 'selection transform is unavailable');
  }
  const matrix = selectionAffineMatrixV1(transform);
  const cut = await prepareSelectionCutV1(snapshot, layerId, coverage, persistence);
  const tiles = await composeTransformV1(
    cut,
    matrix,
    snapshot.document.canvas.width,
    snapshot.document.canvas.height,
    snapshot.document.color.precision,
    persistence,
  );
  return Object.freeze({
    schema: 'illustro.prepared-selection-transform/1' as const,
    layerId,
    sourceRevision: cut.sourceRevision,
    documentRevision: cut.documentRevision,
    selectionSourceRevision: cut.selectionSourceRevision,
    transform,
    matrix,
    resampling: 'nearest-neighbor' as const,
    tiles,
  });
}

export function applyPreparedSelectionTransformV1(
  snapshot: PaintProjectSnapshotV1,
  prepared: PreparedSelectionTransformV1,
  revisionValue: Revision | number,
  now: Date = new Date(),
): PaintProjectSnapshotV1 {
  const revision = parseRevision(revisionValue);
  if (snapshot.document.revision !== prepared.documentRevision) {
    throw new Error('selection transform document changed before commit');
  }
  const source = snapshot.document.layerTree.layers[prepared.layerId];
  if (source?.type !== 'raster' || source.revision !== prepared.sourceRevision) {
    throw new Error('selection transform source changed before commit');
  }
  if (source.locks.all || source.locks.pixels || source.locks.alpha || source.locks.position) {
    throw new Error('selection transform became blocked by the layer lock');
  }
  if (source.transformStack.length > 0 || source.effectStack.length > 0) {
    throw new Error('selection transform source gained an unbaked transform/effect before commit');
  }
  const transformed = Object.freeze({
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
          [prepared.layerId]: transformed,
        }),
      }),
    }),
    committedStrokes: Object.freeze(committedStrokes),
  });
}
