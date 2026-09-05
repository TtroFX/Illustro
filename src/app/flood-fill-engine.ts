import { freezeRgbUnitColorV1, type RgbUnitColorV1 } from '../domain/color.js';
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
import { prepareLayerRasterizeV1 } from './layer-rasterize.js';
import { applySelectionScopedRasterFillBytesV1 } from './selection-fill-engine.js';
import {
  prepareRasterLayerSelectionPixelSourceV1,
  selectionColorDistanceV1,
  type SelectionPixelSourceV1,
} from './selection-region-engine.js';
import type { SelectionPointV1 } from './selection-shape-engine.js';

export interface FloodFillEligibilityV1 {
  readonly eligible: boolean;
  readonly layerId: LayerId;
  readonly reason: string | null;
}

export interface FloodFillRegionTileV1 {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly coverage: Uint8Array<ArrayBuffer>;
}

export interface FloodFillRegionV1 {
  readonly schema: 'illustro.flood-fill-region/1';
  readonly width: number;
  readonly height: number;
  readonly pixelCount: number;
  readonly tiles: readonly FloodFillRegionTileV1[];
}

export interface PreparedFloodFillV1 {
  readonly schema: 'illustro.prepared-flood-fill/1';
  readonly layerId: LayerId;
  readonly color: RgbUnitColorV1;
  readonly seed: SelectionPointV1;
  readonly regionPixelCount: number;
  readonly alphaLocked: boolean;
  readonly sourceRevision: Revision;
  readonly documentRevision: Revision;
  readonly tiles: readonly PreparedRasterMergeTileV1[];
}

interface FloodFillBitTileV1 {
  readonly x: number;
  readonly y: number;
  readonly bits: Uint8Array<ArrayBuffer>;
}

class FloodFillBitsetV1 {
  readonly #width: number;
  readonly #height: number;
  readonly #tiles = new Map<string, FloodFillBitTileV1>();
  #pixelCount = 0;

  constructor(width: number, height: number) {
    this.#width = width;
    this.#height = height;
  }

  get pixelCount(): number {
    return this.#pixelCount;
  }

  touchedTiles(): readonly FloodFillBitTileV1[] {
    return Object.freeze([...this.#tiles.values()]);
  }

  has(x: number, y: number): boolean {
    if (x < 0 || y < 0 || x >= this.#width || y >= this.#height) return false;
    const tx = Math.floor(x / CANONICAL_TILE_SIZE_PX);
    const ty = Math.floor(y / CANONICAL_TILE_SIZE_PX);
    const tile = this.#tiles.get(tileKeyV1(tx, ty));
    if (tile === undefined) return false;
    const localX = x - tx * CANONICAL_TILE_SIZE_PX;
    const localY = y - ty * CANONICAL_TILE_SIZE_PX;
    const index = localY * CANONICAL_TILE_SIZE_PX + localX;
    return ((tile.bits[index >>> 3] ?? 0) & (1 << (index & 7))) !== 0;
  }

  add(x: number, y: number): boolean {
    if (x < 0 || y < 0 || x >= this.#width || y >= this.#height) return false;
    const tx = Math.floor(x / CANONICAL_TILE_SIZE_PX);
    const ty = Math.floor(y / CANONICAL_TILE_SIZE_PX);
    const key = tileKeyV1(tx, ty);
    let tile = this.#tiles.get(key);
    if (tile === undefined) {
      tile = Object.freeze({
        x: tx,
        y: ty,
        bits: new Uint8Array((CANONICAL_TILE_SIZE_PX * CANONICAL_TILE_SIZE_PX) / 8),
      });
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
    this.#pixelCount += 1;
    return true;
  }
}

function tileKeyV1(x: number, y: number): string {
  return `${x}:${y}`;
}

function validateDimensionV1(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new RangeError(`${label} must be a positive safe integer`);
  }
  return value;
}

function seedPixelV1(
  source: SelectionPixelSourceV1,
  seed: SelectionPointV1,
): readonly [number, number] {
  if (!Number.isFinite(seed.x) || !Number.isFinite(seed.y)) {
    throw new TypeError('flood-fill seed must contain finite coordinates');
  }
  const x = Math.floor(seed.x);
  const y = Math.floor(seed.y);
  if (x < 0 || y < 0 || x >= source.width || y >= source.height) {
    throw new RangeError('flood-fill seed is outside the source');
  }
  return Object.freeze([x, y]);
}

function exactVisibleColorMatchV1(
  source: SelectionPixelSourceV1,
  x: number,
  y: number,
  target: ReturnType<SelectionPixelSourceV1['rgbaAt']>,
): boolean {
  return selectionColorDistanceV1(source.rgbaAt(x, y), target) <= Number.EPSILON;
}

function buildExactConnectedRegionV1(
  source: SelectionPixelSourceV1,
  seedX: number,
  seedY: number,
): FloodFillBitsetV1 {
  const selected = new FloodFillBitsetV1(source.width, source.height);
  const target = source.rgbaAt(seedX, seedY);
  const stack: Array<readonly [number, number]> = [[seedX, seedY]];

  while (stack.length > 0) {
    const current = stack.pop();
    if (current === undefined) break;
    const [x, y] = current;
    if (selected.has(x, y) || !exactVisibleColorMatchV1(source, x, y, target)) continue;

    let left = x;
    while (
      left > 0 &&
      !selected.has(left - 1, y) &&
      exactVisibleColorMatchV1(source, left - 1, y, target)
    ) {
      left -= 1;
    }
    let right = x;
    while (
      right + 1 < source.width &&
      !selected.has(right + 1, y) &&
      exactVisibleColorMatchV1(source, right + 1, y, target)
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
          exactVisibleColorMatchV1(source, scanX, adjacentY, target);
        if (!eligible) {
          scanX += 1;
          continue;
        }
        stack.push([scanX, adjacentY]);
        scanX += 1;
        while (
          scanX <= right &&
          !selected.has(scanX, adjacentY) &&
          exactVisibleColorMatchV1(source, scanX, adjacentY, target)
        ) {
          scanX += 1;
        }
      }
    }
  }

  return selected;
}

function coverageTileV1(
  region: FloodFillBitsetV1,
  tx: number,
  ty: number,
  width: number,
  height: number,
): Uint8Array<ArrayBuffer> {
  const coverage = new Uint8Array(width * height);
  const documentX = tx * CANONICAL_TILE_SIZE_PX;
  const documentY = ty * CANONICAL_TILE_SIZE_PX;
  for (let localY = 0; localY < height; localY += 1) {
    for (let localX = 0; localX < width; localX += 1) {
      if (region.has(documentX + localX, documentY + localY)) {
        coverage[localY * width + localX] = 255;
      }
    }
  }
  return coverage;
}

export function resolveFloodFillRegionV1(
  source: SelectionPixelSourceV1,
  seed: SelectionPointV1,
): FloodFillRegionV1 {
  const width = validateDimensionV1(source.width, 'flood-fill source width');
  const height = validateDimensionV1(source.height, 'flood-fill source height');
  const [seedX, seedY] = seedPixelV1(source, seed);
  const region = buildExactConnectedRegionV1(source, seedX, seedY);
  const tiles = region
    .touchedTiles()
    .map((tile): FloodFillRegionTileV1 => {
      const bounds = tileBoundsForDocumentV1(width, height, { tx: tile.x, ty: tile.y });
      return Object.freeze({
        x: tile.x,
        y: tile.y,
        width: bounds.validWidth,
        height: bounds.validHeight,
        coverage: coverageTileV1(region, tile.x, tile.y, bounds.validWidth, bounds.validHeight),
      });
    })
    .sort((left, right) => left.y - right.y || left.x - right.x);
  return Object.freeze({
    schema: 'illustro.flood-fill-region/1' as const,
    width,
    height,
    pixelCount: region.pixelCount,
    tiles: Object.freeze(tiles),
  });
}

function unavailableV1(layerId: LayerId, reason: string): FloodFillEligibilityV1 {
  return Object.freeze({ eligible: false, layerId, reason });
}

export function floodFillEligibilityV1(
  snapshot: PaintProjectSnapshotV1,
  layerId: LayerId,
): FloodFillEligibilityV1 {
  const layer = snapshot.document.layerTree.layers[layerId];
  if (layer === undefined) return unavailableV1(layerId, 'flood-fill target layer is missing');
  if (layer.type !== 'raster') {
    return unavailableV1(layerId, 'flood-fill currently requires a Raster Layer');
  }
  if (layer.locks.all || layer.locks.pixels) {
    return unavailableV1(layerId, 'flood-fill is blocked by the layer pixel lock');
  }
  if (layer.transformStack.length > 0) {
    return unavailableV1(layerId, 'flood-fill requires transformed raster content to be baked');
  }
  if (layer.effectStack.length > 0) {
    return unavailableV1(layerId, 'flood-fill requires effected raster content to be baked');
  }
  return Object.freeze({ eligible: true, layerId, reason: null });
}

function hasUnbakedStrokeV1(snapshot: PaintProjectSnapshotV1, layerId: LayerId): boolean {
  return snapshot.committedStrokes.some(
    (entry) => entry.stroke.layerId === layerId && entry.bakedToRasterLayer !== true,
  );
}

async function sourceTilesV1(
  snapshot: PaintProjectSnapshotV1,
  layer: RasterLayerV1,
  persistence: RasterMergePersistencePortV1,
): Promise<readonly PreparedRasterMergeTileV1[]> {
  if (hasUnbakedStrokeV1(snapshot, layer.id)) {
    return (await prepareLayerRasterizeV1(snapshot, layer.id, persistence)).tiles;
  }
  return Object.freeze(
    layer.tiles.map((tile) => Object.freeze({ x: tile.x, y: tile.y, payloadRef: tile.payloadRef })),
  );
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
    throw new Error('flood-fill source tile does not match the document raster contract');
  }
  if (tile.bytes.byteLength !== width * height * bytesPerPixelV1(format)) {
    throw new Error('flood-fill source tile byte length is invalid');
  }
}

export async function prepareFloodFillV1(
  snapshot: PaintProjectSnapshotV1,
  layerId: LayerId,
  seed: SelectionPointV1,
  colorValue: RgbUnitColorV1,
  persistence: RasterMergePersistencePortV1,
): Promise<PreparedFloodFillV1> {
  const eligibility = floodFillEligibilityV1(snapshot, layerId);
  if (!eligibility.eligible) throw new Error(eligibility.reason ?? 'flood-fill is unavailable');
  const layer = snapshot.document.layerTree.layers[layerId];
  if (layer?.type !== 'raster') throw new Error('flood-fill source changed');
  const color = freezeRgbUnitColorV1(colorValue);
  const pixelSource = await prepareRasterLayerSelectionPixelSourceV1(
    snapshot,
    layerId,
    persistence,
  );
  const region = resolveFloodFillRegionV1(pixelSource, seed);
  const sourceTiles = await sourceTilesV1(snapshot, layer as RasterLayerV1, persistence);
  const sourceByKey = new Map<string, PreparedRasterMergeTileV1>();
  for (const tile of sourceTiles) {
    const key = tileKeyV1(tile.x, tile.y);
    if (sourceByKey.has(key)) throw new Error(`duplicate flood-fill source tile: ${key}`);
    sourceByKey.set(key, tile);
  }
  const regionByKey = new Map(region.tiles.map((tile) => [tileKeyV1(tile.x, tile.y), tile]));
  const coordinates = new Map<string, Readonly<{ x: number; y: number }>>();
  for (const tile of sourceTiles) {
    coordinates.set(tileKeyV1(tile.x, tile.y), Object.freeze({ x: tile.x, y: tile.y }));
  }
  for (const tile of region.tiles) {
    coordinates.set(tileKeyV1(tile.x, tile.y), Object.freeze({ x: tile.x, y: tile.y }));
  }

  const documentWidth = snapshot.document.canvas.width;
  const documentHeight = snapshot.document.canvas.height;
  const pixelFormat = snapshot.document.color.precision;
  const tiles: PreparedRasterMergeTileV1[] = [];
  let changedTileCount = 0;
  const orderedCoordinates = [...coordinates.values()].sort(
    (left, right) => left.y - right.y || left.x - right.x,
  );
  for (const coordinate of orderedCoordinates) {
    const key = tileKeyV1(coordinate.x, coordinate.y);
    const sourceReference = sourceByKey.get(key);
    const regionTile = regionByKey.get(key);
    if (regionTile === undefined) {
      if (sourceReference !== undefined) tiles.push(sourceReference);
      continue;
    }
    const bounds = tileBoundsForDocumentV1(documentWidth, documentHeight, {
      tx: coordinate.x,
      ty: coordinate.y,
    });
    let sourceBytes: Uint8Array<ArrayBuffer>;
    if (sourceReference === undefined) {
      sourceBytes = new Uint8Array(
        bounds.validWidth * bounds.validHeight * bytesPerPixelV1(pixelFormat),
      );
    } else {
      const decoded = await persistence.readRasterTile(sourceReference.payloadRef);
      validateSourceTileV1(decoded, pixelFormat, bounds.validWidth, bounds.validHeight);
      sourceBytes = new Uint8Array(decoded.bytes);
    }
    if (regionTile.width !== bounds.validWidth || regionTile.height !== bounds.validHeight) {
      throw new Error('flood-fill region tile dimensions changed during prepare');
    }
    const filled = applySelectionScopedRasterFillBytesV1(
      sourceBytes,
      pixelFormat,
      color,
      1,
      regionTile.coverage,
      0,
      bounds.validWidth,
      bounds.validHeight,
      layer.locks.alpha,
    );
    if (!filled.changed) {
      if (sourceReference !== undefined) tiles.push(sourceReference);
      continue;
    }
    const persisted = await persistence.persistRasterTile({
      width: bounds.validWidth,
      height: bounds.validHeight,
      pixelFormat,
      bytes: filled.bytes,
    });
    changedTileCount += 1;
    tiles.push(
      Object.freeze({ x: coordinate.x, y: coordinate.y, payloadRef: persisted.payloadRef }),
    );
  }

  if (changedTileCount === 0) throw new Error('flood-fill does not change raster content');
  return Object.freeze({
    schema: 'illustro.prepared-flood-fill/1' as const,
    layerId,
    color,
    seed: Object.freeze({ x: seed.x, y: seed.y }),
    regionPixelCount: region.pixelCount,
    alphaLocked: layer.locks.alpha,
    sourceRevision: layer.revision,
    documentRevision: snapshot.document.revision,
    tiles: Object.freeze(tiles),
  });
}

export function applyPreparedFloodFillV1(
  snapshot: PaintProjectSnapshotV1,
  prepared: PreparedFloodFillV1,
  revisionValue: Revision | number,
  now: Date = new Date(),
): PaintProjectSnapshotV1 {
  const revision = parseRevision(revisionValue);
  if (snapshot.document.revision !== prepared.documentRevision) {
    throw new Error('flood-fill document changed before commit');
  }
  const source = snapshot.document.layerTree.layers[prepared.layerId];
  if (source?.type !== 'raster' || source.revision !== prepared.sourceRevision) {
    throw new Error('flood-fill source changed before commit');
  }
  if (source.locks.all || source.locks.pixels) {
    throw new Error('flood-fill became blocked by the layer pixel lock');
  }
  if (source.locks.alpha !== prepared.alphaLocked) {
    throw new Error('flood-fill alpha-lock state changed before commit');
  }
  if (source.transformStack.length > 0 || source.effectStack.length > 0) {
    throw new Error('flood-fill source gained an unbaked transform/effect before commit');
  }

  const filled = Object.freeze({
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
          [prepared.layerId]: filled,
        }),
      }),
    }),
    committedStrokes: Object.freeze(committedStrokes),
  });
}
