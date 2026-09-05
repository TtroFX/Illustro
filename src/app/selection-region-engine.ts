import type { LayerId, Revision } from '../domain/identity.js';
import type { RasterLayerV1, RasterTileReferenceV1 } from '../domain/layers.js';
import {
  CANONICAL_TILE_SIZE_PX,
  tileBoundsForDocumentV1,
  tileGridForDocumentV1,
} from '../gpu/sparse-tile-model.js';
import type { PaintDecodedRasterTileV1 } from './paint-persistence-controller.js';
import type { PaintProjectSnapshotV1 } from './paint-session-controller.js';
import type { RasterMergePersistencePortV1 } from './layer-raster-merge.js';
import { prepareLayerRasterizeV1 } from './layer-rasterize.js';
import type {
  PreparedSelectionCoverageV1,
  SelectionCoveragePersistencePortV1,
  SelectionPointV1,
} from './selection-shape-engine.js';

export type SelectionRgbaV1 = readonly [number, number, number, number];

export interface SelectionPixelSourceV1 {
  readonly width: number;
  readonly height: number;
  rgbaAt(x: number, y: number): SelectionRgbaV1;
}

interface SelectionBitTileV1 {
  readonly tx: number;
  readonly ty: number;
  readonly bits: Uint8Array;
}

class SelectionBitsetV1 {
  readonly #width: number;
  readonly #height: number;
  readonly #tiles = new Map<string, SelectionBitTileV1>();
  #selectedCount = 0;

  constructor(width: number, height: number) {
    this.#width = width;
    this.#height = height;
  }

  get selectedCount(): number {
    return this.#selectedCount;
  }

  touchedTiles(): readonly SelectionBitTileV1[] {
    return Object.freeze([...this.#tiles.values()]);
  }

  has(x: number, y: number): boolean {
    if (x < 0 || y < 0 || x >= this.#width || y >= this.#height) return false;
    const tx = Math.floor(x / CANONICAL_TILE_SIZE_PX);
    const ty = Math.floor(y / CANONICAL_TILE_SIZE_PX);
    const tile = this.#tiles.get(`${tx}:${ty}`);
    if (tile === undefined) return false;
    const localX = x - tx * CANONICAL_TILE_SIZE_PX;
    const localY = y - ty * CANONICAL_TILE_SIZE_PX;
    const index = localY * CANONICAL_TILE_SIZE_PX + localX;
    const byteIndex = index >>> 3;
    const mask = 1 << (index & 7);
    return ((tile.bits[byteIndex] ?? 0) & mask) !== 0;
  }

  add(x: number, y: number): boolean {
    if (x < 0 || y < 0 || x >= this.#width || y >= this.#height) return false;
    const tx = Math.floor(x / CANONICAL_TILE_SIZE_PX);
    const ty = Math.floor(y / CANONICAL_TILE_SIZE_PX);
    const key = `${tx}:${ty}`;
    let tile = this.#tiles.get(key);
    if (tile === undefined) {
      tile = {
        tx,
        ty,
        bits: new Uint8Array((CANONICAL_TILE_SIZE_PX * CANONICAL_TILE_SIZE_PX) / 8),
      };
      this.#tiles.set(key, tile);
    }
    const localX = x - tx * CANONICAL_TILE_SIZE_PX;
    const localY = y - ty * CANONICAL_TILE_SIZE_PX;
    const index = localY * CANONICAL_TILE_SIZE_PX + localX;
    const byteIndex = index >>> 3;
    const mask = 1 << (index & 7);
    const previous = tile.bits[byteIndex] ?? 0;
    if ((previous & mask) !== 0) return false;
    tile.bits[byteIndex] = previous | mask;
    this.#selectedCount += 1;
    return true;
  }
}

interface DecodedSourceTileV1 {
  readonly tx: number;
  readonly ty: number;
  readonly width: number;
  readonly height: number;
  readonly tile: PaintDecodedRasterTileV1;
}

function validateDimension(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < 1) throw new RangeError(`${label} must be a positive safe integer`);
  return value;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function normalizeTolerance(value: number): number {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError('selection tolerance must be between 0 and 1');
  }
  return value;
}

function normalizeRgba(value: SelectionRgbaV1): SelectionRgbaV1 {
  if (value.length !== 4 || value.some((channel) => !Number.isFinite(channel))) {
    throw new TypeError('selection color must contain four finite channels');
  }
  return Object.freeze([
    clamp01(value[0]),
    clamp01(value[1]),
    clamp01(value[2]),
    clamp01(value[3]),
  ]);
}

function halfToFloat(value: number): number {
  const sign = (value & 0x8000) !== 0 ? -1 : 1;
  const exponent = (value >>> 10) & 0x1f;
  const fraction = value & 0x03ff;
  if (exponent === 0) return sign * 2 ** -14 * (fraction / 1024);
  if (exponent === 0x1f) return fraction === 0 ? sign * Number.POSITIVE_INFINITY : Number.NaN;
  return sign * 2 ** (exponent - 15) * (1 + fraction / 1024);
}

function decodeRgbaAt(tile: PaintDecodedRasterTileV1, x: number, y: number): SelectionRgbaV1 {
  const pixel = y * tile.width + x;
  if (tile.pixelFormat === 'rgba8-unorm') {
    const offset = pixel * 4;
    return Object.freeze([
      (tile.bytes[offset] ?? 0) / 255,
      (tile.bytes[offset + 1] ?? 0) / 255,
      (tile.bytes[offset + 2] ?? 0) / 255,
      (tile.bytes[offset + 3] ?? 0) / 255,
    ]);
  }
  const offset = pixel * 8;
  const view = new DataView(tile.bytes.buffer, tile.bytes.byteOffset, tile.bytes.byteLength);
  return Object.freeze([
    clamp01(halfToFloat(view.getUint16(offset, true))),
    clamp01(halfToFloat(view.getUint16(offset + 2, true))),
    clamp01(halfToFloat(view.getUint16(offset + 4, true))),
    clamp01(halfToFloat(view.getUint16(offset + 6, true))),
  ]);
}

function assertDecodedTileV1(
  tile: PaintDecodedRasterTileV1,
  expectedFormat: PaintProjectSnapshotV1['document']['color']['precision'],
  width: number,
  height: number,
): void {
  if (tile.pixelFormat !== expectedFormat || tile.width !== width || tile.height !== height) {
    throw new Error('selection source tile does not match the document tile contract');
  }
  const bytesPerPixel = expectedFormat === 'rgba8-unorm' ? 4 : 8;
  if (tile.bytes.byteLength !== width * height * bytesPerPixel) {
    throw new Error('selection source tile byte length is invalid');
  }
}

function hasUnbakedStrokeV1(snapshot: PaintProjectSnapshotV1, layerId: LayerId): boolean {
  return snapshot.committedStrokes.some(
    (entry) => entry.stroke.layerId === layerId && entry.bakedToRasterLayer !== true,
  );
}

export function selectionColorDistanceV1(leftValue: SelectionRgbaV1, rightValue: SelectionRgbaV1): number {
  const left = normalizeRgba(leftValue);
  const right = normalizeRgba(rightValue);
  const leftAlpha = left[3];
  const rightAlpha = right[3];
  const red = left[0] * leftAlpha - right[0] * rightAlpha;
  const green = left[1] * leftAlpha - right[1] * rightAlpha;
  const blue = left[2] * leftAlpha - right[2] * rightAlpha;
  const alpha = leftAlpha - rightAlpha;
  return Math.hypot(red, green, blue, alpha) / 2;
}

export function createArraySelectionPixelSourceV1(input: {
  readonly width: number;
  readonly height: number;
  readonly rgba: readonly SelectionRgbaV1[];
}): SelectionPixelSourceV1 {
  const width = validateDimension(input.width, 'selection source width');
  const height = validateDimension(input.height, 'selection source height');
  if (input.rgba.length !== width * height) {
    throw new RangeError('selection source color count does not match dimensions');
  }
  const colors = Object.freeze(input.rgba.map(normalizeRgba));
  return Object.freeze({
    width,
    height,
    rgbaAt(x: number, y: number): SelectionRgbaV1 {
      if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y) || x < 0 || y < 0 || x >= width || y >= height) {
        throw new RangeError('selection source coordinate is out of bounds');
      }
      const value = colors[y * width + x];
      if (value === undefined) throw new Error('selection source pixel is missing');
      return value;
    },
  });
}

export async function prepareRasterLayerSelectionPixelSourceV1(
  snapshot: PaintProjectSnapshotV1,
  layerId: LayerId,
  persistence: RasterMergePersistencePortV1,
): Promise<SelectionPixelSourceV1> {
  const layer = snapshot.document.layerTree.layers[layerId];
  if (layer?.type !== 'raster') throw new Error('selection pixel source requires a Raster Layer');
  if (layer.transformStack.length > 0) {
    throw new Error('selection from a live-transformed Raster Layer requires transform rendering integration');
  }
  if (layer.effectStack.length > 0) {
    throw new Error('selection from a live-effect Raster Layer requires effect compositor integration');
  }
  const raster = layer as RasterLayerV1;
  const references = hasUnbakedStrokeV1(snapshot, layerId)
    ? (await prepareLayerRasterizeV1(snapshot, layerId, persistence)).tiles
    : raster.tiles;
  const width = snapshot.document.canvas.width;
  const height = snapshot.document.canvas.height;
  const format = snapshot.document.color.precision;
  const decoded = new Map<string, DecodedSourceTileV1>();
  for (const reference of references) {
    const key = `${reference.x}:${reference.y}`;
    if (decoded.has(key)) throw new Error(`duplicate selection source tile: ${key}`);
    const bounds = tileBoundsForDocumentV1(width, height, { tx: reference.x, ty: reference.y });
    const tile = await persistence.readRasterTile(reference.payloadRef);
    assertDecodedTileV1(tile, format, bounds.validWidth, bounds.validHeight);
    decoded.set(
      key,
      Object.freeze({
        tx: reference.x,
        ty: reference.y,
        width: bounds.validWidth,
        height: bounds.validHeight,
        tile,
      }),
    );
  }
  return Object.freeze({
    width,
    height,
    rgbaAt(x: number, y: number): SelectionRgbaV1 {
      if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y) || x < 0 || y < 0 || x >= width || y >= height) {
        throw new RangeError('selection source coordinate is out of bounds');
      }
      const tx = Math.floor(x / CANONICAL_TILE_SIZE_PX);
      const ty = Math.floor(y / CANONICAL_TILE_SIZE_PX);
      const source = decoded.get(`${tx}:${ty}`);
      if (source === undefined) return Object.freeze([0, 0, 0, 0]);
      const localX = x - tx * CANONICAL_TILE_SIZE_PX;
      const localY = y - ty * CANONICAL_TILE_SIZE_PX;
      if (localX >= source.width || localY >= source.height) return Object.freeze([0, 0, 0, 0]);
      return decodeRgbaAt(source.tile, localX, localY);
    },
  });
}

function pointToPixelV1(source: SelectionPixelSourceV1, value: SelectionPointV1): readonly [number, number] {
  if (!Number.isFinite(value.x) || !Number.isFinite(value.y)) {
    throw new TypeError('selection seed must contain finite coordinates');
  }
  const x = Math.floor(value.x);
  const y = Math.floor(value.y);
  if (x < 0 || y < 0 || x >= source.width || y >= source.height) {
    throw new RangeError('selection seed is outside the source');
  }
  return Object.freeze([x, y]);
}

function matchesTargetV1(
  source: SelectionPixelSourceV1,
  x: number,
  y: number,
  target: SelectionRgbaV1,
  tolerance: number,
): boolean {
  return selectionColorDistanceV1(source.rgbaAt(x, y), target) <= tolerance + Number.EPSILON;
}

function buildMagicWandBitsV1(
  source: SelectionPixelSourceV1,
  seedX: number,
  seedY: number,
  target: SelectionRgbaV1,
  tolerance: number,
): SelectionBitsetV1 {
  const selected = new SelectionBitsetV1(source.width, source.height);
  const stack: Array<readonly [number, number]> = [[seedX, seedY]];
  while (stack.length > 0) {
    const current = stack.pop();
    if (current === undefined) break;
    const [x, y] = current;
    if (selected.has(x, y) || !matchesTargetV1(source, x, y, target, tolerance)) continue;

    let left = x;
    while (
      left > 0 &&
      !selected.has(left - 1, y) &&
      matchesTargetV1(source, left - 1, y, target, tolerance)
    ) {
      left -= 1;
    }
    let right = x;
    while (
      right + 1 < source.width &&
      !selected.has(right + 1, y) &&
      matchesTargetV1(source, right + 1, y, target, tolerance)
    ) {
      right += 1;
    }
    for (let scanX = left; scanX <= right; scanX += 1) selected.add(scanX, y);

    for (const adjacentY of [y - 1, y + 1]) {
      if (adjacentY < 0 || adjacentY >= source.height) continue;
      let scanX = left;
      while (scanX <= right) {
        const eligible =
          !selected.has(scanX, adjacentY) &&
          matchesTargetV1(source, scanX, adjacentY, target, tolerance);
        if (!eligible) {
          scanX += 1;
          continue;
        }
        stack.push([scanX, adjacentY]);
        scanX += 1;
        while (
          scanX <= right &&
          !selected.has(scanX, adjacentY) &&
          matchesTargetV1(source, scanX, adjacentY, target, tolerance)
        ) {
          scanX += 1;
        }
      }
    }
  }
  return selected;
}

function buildColorRangeBitsV1(
  source: SelectionPixelSourceV1,
  target: SelectionRgbaV1,
  tolerance: number,
): SelectionBitsetV1 {
  const selected = new SelectionBitsetV1(source.width, source.height);
  for (let y = 0; y < source.height; y += 1) {
    for (let x = 0; x < source.width; x += 1) {
      if (matchesTargetV1(source, x, y, target, tolerance)) selected.add(x, y);
    }
  }
  return selected;
}

function encodeCoverageTileV1(
  selected: SelectionBitsetV1,
  tx: number,
  ty: number,
  width: number,
  height: number,
): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(width * height * 4);
  const documentX = tx * CANONICAL_TILE_SIZE_PX;
  const documentY = ty * CANONICAL_TILE_SIZE_PX;
  for (let localY = 0; localY < height; localY += 1) {
    for (let localX = 0; localX < width; localX += 1) {
      const coverage = selected.has(documentX + localX, documentY + localY) ? 255 : 0;
      const offset = (localY * width + localX) * 4;
      bytes[offset] = coverage;
      bytes[offset + 1] = coverage;
      bytes[offset + 2] = coverage;
      bytes[offset + 3] = 255;
    }
  }
  return bytes;
}

function tileDiffersFromDefaultV1(bytes: Uint8Array, defaultCoverage: 0 | 1): boolean {
  const expected = defaultCoverage === 1 ? 255 : 0;
  for (let offset = 0; offset < bytes.byteLength; offset += 4) {
    if ((bytes[offset] ?? 0) !== expected) return true;
  }
  return false;
}

async function persistSelectionBitsV1(
  selected: SelectionBitsetV1,
  input: {
    readonly width: number;
    readonly height: number;
    readonly revision: Revision;
    readonly persistence: SelectionCoveragePersistencePortV1;
  },
): Promise<PreparedSelectionCoverageV1> {
  const totalPixels = input.width * input.height;
  const defaultCoverage: 0 | 1 = selected.selectedCount > totalPixels / 2 ? 1 : 0;
  const grid = tileGridForDocumentV1(input.width, input.height);
  const coordinates: Array<readonly [number, number]> = [];
  if (defaultCoverage === 0) {
    for (const tile of selected.touchedTiles()) coordinates.push([tile.tx, tile.ty]);
  } else {
    for (let ty = 0; ty < grid.rows; ty += 1) {
      for (let tx = 0; tx < grid.columns; tx += 1) coordinates.push([tx, ty]);
    }
  }
  coordinates.sort((left, right) => left[1] - right[1] || left[0] - right[0]);
  const tiles: RasterTileReferenceV1[] = [];
  for (const [tx, ty] of coordinates) {
    const bounds = tileBoundsForDocumentV1(input.width, input.height, { tx, ty });
    const bytes = encodeCoverageTileV1(selected, tx, ty, bounds.validWidth, bounds.validHeight);
    if (!tileDiffersFromDefaultV1(bytes, defaultCoverage)) continue;
    const persisted = await input.persistence.persistRasterTile({
      width: bounds.validWidth,
      height: bounds.validHeight,
      pixelFormat: 'rgba8-unorm',
      bytes,
    });
    tiles.push(
      Object.freeze({
        x: tx,
        y: ty,
        revision: input.revision,
        payloadRef: persisted.payloadRef,
      }),
    );
  }
  return Object.freeze({
    schema: 'illustro.prepared-selection-coverage/1' as const,
    defaultCoverage,
    tiles: Object.freeze(tiles),
    sourceRevision: input.revision,
  });
}

export async function prepareMagicWandSelectionV1(
  source: SelectionPixelSourceV1,
  seed: SelectionPointV1,
  toleranceValue: number,
  input: {
    readonly revision: Revision;
    readonly persistence: SelectionCoveragePersistencePortV1;
  },
): Promise<PreparedSelectionCoverageV1> {
  validateDimension(source.width, 'selection source width');
  validateDimension(source.height, 'selection source height');
  const tolerance = normalizeTolerance(toleranceValue);
  const [seedX, seedY] = pointToPixelV1(source, seed);
  const target = source.rgbaAt(seedX, seedY);
  const selected = buildMagicWandBitsV1(source, seedX, seedY, target, tolerance);
  return persistSelectionBitsV1(selected, {
    width: source.width,
    height: source.height,
    revision: input.revision,
    persistence: input.persistence,
  });
}

export async function prepareColorRangeSelectionV1(
  source: SelectionPixelSourceV1,
  targetValue: SelectionRgbaV1,
  toleranceValue: number,
  input: {
    readonly revision: Revision;
    readonly persistence: SelectionCoveragePersistencePortV1;
  },
): Promise<PreparedSelectionCoverageV1> {
  validateDimension(source.width, 'selection source width');
  validateDimension(source.height, 'selection source height');
  const tolerance = normalizeTolerance(toleranceValue);
  const target = normalizeRgba(targetValue);
  const selected = buildColorRangeBitsV1(source, target, tolerance);
  return persistSelectionBitsV1(selected, {
    width: source.width,
    height: source.height,
    revision: input.revision,
    persistence: input.persistence,
  });
}

export function prepareColorRangeSelectionAtPointV1(
  source: SelectionPixelSourceV1,
  seed: SelectionPointV1,
  tolerance: number,
  input: {
    readonly revision: Revision;
    readonly persistence: SelectionCoveragePersistencePortV1;
  },
): Promise<PreparedSelectionCoverageV1> {
  const [x, y] = pointToPixelV1(source, seed);
  return prepareColorRangeSelectionV1(source, source.rgbaAt(x, y), tolerance, input);
}

export async function prepareMagicWandSelectionFromRasterLayerV1(
  snapshot: PaintProjectSnapshotV1,
  layerId: LayerId,
  seed: SelectionPointV1,
  tolerance: number,
  persistence: RasterMergePersistencePortV1,
): Promise<PreparedSelectionCoverageV1> {
  const source = await prepareRasterLayerSelectionPixelSourceV1(snapshot, layerId, persistence);
  return prepareMagicWandSelectionV1(source, seed, tolerance, {
    revision: snapshot.document.revision,
    persistence,
  });
}

export async function prepareColorRangeSelectionFromRasterLayerV1(
  snapshot: PaintProjectSnapshotV1,
  layerId: LayerId,
  target: SelectionRgbaV1,
  tolerance: number,
  persistence: RasterMergePersistencePortV1,
): Promise<PreparedSelectionCoverageV1> {
  const source = await prepareRasterLayerSelectionPixelSourceV1(snapshot, layerId, persistence);
  return prepareColorRangeSelectionV1(source, target, tolerance, {
    revision: snapshot.document.revision,
    persistence,
  });
}
