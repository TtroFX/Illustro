export const CANONICAL_TILE_SIZE_PX = 128 as const;
export const CANONICAL_TILE_AREA_PX = CANONICAL_TILE_SIZE_PX * CANONICAL_TILE_SIZE_PX;
export const WHOLE_TILE_DIRTY_PROMOTION_RATIO = 0.5 as const;

export interface TileCoordinateV1 {
  readonly tx: number;
  readonly ty: number;
}

export interface PixelCoordinateV1 {
  readonly x: number;
  readonly y: number;
}

export interface RectV1 {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface TileGridV1 {
  readonly columns: number;
  readonly rows: number;
}

export interface TileBoundsV1 extends RectV1 {
  readonly coordinate: TileCoordinateV1;
  readonly validWidth: number;
  readonly validHeight: number;
}

export interface TileAddressV1 {
  readonly coordinate: TileCoordinateV1;
  readonly localX: number;
  readonly localY: number;
}

export type TileDirtyRegionV1 =
  | { readonly kind: 'whole' }
  | { readonly kind: 'rect'; readonly rect: RectV1 };

export interface DirtyTileStateV1 {
  readonly coordinate: TileCoordinateV1;
  readonly region: TileDirtyRegionV1;
}

export interface SparseTileEntryV1<Value> {
  readonly coordinate: TileCoordinateV1;
  readonly bounds: TileBoundsV1;
  readonly value: Value;
}

function assertPositiveDimension(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new RangeError(`${label} must be a positive safe integer`);
  }
}

function assertNonNegativeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${label} must be a non-negative safe integer`);
  }
}

function assertRect(rect: RectV1, label: string): void {
  for (const [name, value] of Object.entries(rect)) {
    if (!Number.isSafeInteger(value))
      throw new RangeError(`${label}.${name} must be a safe integer`);
  }
  if (rect.x < 0 || rect.y < 0 || rect.width < 1 || rect.height < 1) {
    throw new RangeError(`${label} must have non-negative origin and positive size`);
  }
}

function freezeCoordinate(tx: number, ty: number): TileCoordinateV1 {
  return Object.freeze({ tx, ty });
}

export function tileKeyV1(coordinate: TileCoordinateV1): string {
  assertNonNegativeInteger(coordinate.tx, 'tile tx');
  assertNonNegativeInteger(coordinate.ty, 'tile ty');
  return `${coordinate.tx}:${coordinate.ty}`;
}

export function tileGridForDocumentV1(width: number, height: number): TileGridV1 {
  assertPositiveDimension(width, 'document width');
  assertPositiveDimension(height, 'document height');
  return Object.freeze({
    columns: Math.ceil(width / CANONICAL_TILE_SIZE_PX),
    rows: Math.ceil(height / CANONICAL_TILE_SIZE_PX),
  });
}

export function tileBoundsForDocumentV1(
  width: number,
  height: number,
  coordinate: TileCoordinateV1,
): TileBoundsV1 {
  const grid = tileGridForDocumentV1(width, height);
  assertNonNegativeInteger(coordinate.tx, 'tile tx');
  assertNonNegativeInteger(coordinate.ty, 'tile ty');
  if (coordinate.tx >= grid.columns || coordinate.ty >= grid.rows) {
    throw new RangeError('tile coordinate is outside document tile grid');
  }
  const x = coordinate.tx * CANONICAL_TILE_SIZE_PX;
  const y = coordinate.ty * CANONICAL_TILE_SIZE_PX;
  const validWidth = Math.min(CANONICAL_TILE_SIZE_PX, width - x);
  const validHeight = Math.min(CANONICAL_TILE_SIZE_PX, height - y);
  return Object.freeze({
    coordinate: freezeCoordinate(coordinate.tx, coordinate.ty),
    x,
    y,
    width: validWidth,
    height: validHeight,
    validWidth,
    validHeight,
  });
}

export function addressDocumentPixelV1(
  width: number,
  height: number,
  pixel: PixelCoordinateV1,
): TileAddressV1 {
  assertPositiveDimension(width, 'document width');
  assertPositiveDimension(height, 'document height');
  assertNonNegativeInteger(pixel.x, 'pixel x');
  assertNonNegativeInteger(pixel.y, 'pixel y');
  if (pixel.x >= width || pixel.y >= height) {
    throw new RangeError('pixel coordinate is outside document bounds');
  }
  const tx = Math.floor(pixel.x / CANONICAL_TILE_SIZE_PX);
  const ty = Math.floor(pixel.y / CANONICAL_TILE_SIZE_PX);
  return Object.freeze({
    coordinate: freezeCoordinate(tx, ty),
    localX: pixel.x - tx * CANONICAL_TILE_SIZE_PX,
    localY: pixel.y - ty * CANONICAL_TILE_SIZE_PX,
  });
}

function intersectRect(left: RectV1, right: RectV1): RectV1 | null {
  const x = Math.max(left.x, right.x);
  const y = Math.max(left.y, right.y);
  const rightEdge = Math.min(left.x + left.width, right.x + right.width);
  const bottomEdge = Math.min(left.y + left.height, right.y + right.height);
  if (rightEdge <= x || bottomEdge <= y) return null;
  return Object.freeze({ x, y, width: rightEdge - x, height: bottomEdge - y });
}

function unionRect(left: RectV1, right: RectV1): RectV1 {
  const x = Math.min(left.x, right.x);
  const y = Math.min(left.y, right.y);
  const rightEdge = Math.max(left.x + left.width, right.x + right.width);
  const bottomEdge = Math.max(left.y + left.height, right.y + right.height);
  return Object.freeze({ x, y, width: rightEdge - x, height: bottomEdge - y });
}

function rectArea(rect: RectV1): number {
  return rect.width * rect.height;
}

function coversValidTile(rect: RectV1, bounds: TileBoundsV1): boolean {
  return (
    rect.x === 0 &&
    rect.y === 0 &&
    rect.width >= bounds.validWidth &&
    rect.height >= bounds.validHeight
  );
}

function shouldPromoteWhole(rect: RectV1, bounds: TileBoundsV1): boolean {
  return (
    rectArea(rect) >= CANONICAL_TILE_AREA_PX * WHOLE_TILE_DIRTY_PROMOTION_RATIO ||
    coversValidTile(rect, bounds)
  );
}

export class DirtyTileTrackerV1 {
  readonly #documentWidth: number;
  readonly #documentHeight: number;
  readonly #dirty = new Map<string, DirtyTileStateV1>();

  constructor(documentWidth: number, documentHeight: number) {
    tileGridForDocumentV1(documentWidth, documentHeight);
    this.#documentWidth = documentWidth;
    this.#documentHeight = documentHeight;
  }

  get size(): number {
    return this.#dirty.size;
  }

  get(coordinate: TileCoordinateV1): DirtyTileStateV1 | null {
    return this.#dirty.get(tileKeyV1(coordinate)) ?? null;
  }

  markWhole(coordinate: TileCoordinateV1): DirtyTileStateV1 {
    tileBoundsForDocumentV1(this.#documentWidth, this.#documentHeight, coordinate);
    const state = Object.freeze({
      coordinate: freezeCoordinate(coordinate.tx, coordinate.ty),
      region: Object.freeze({ kind: 'whole' as const }),
    });
    this.#dirty.set(tileKeyV1(coordinate), state);
    return state;
  }

  markRect(coordinate: TileCoordinateV1, rect: RectV1): DirtyTileStateV1 | null {
    assertRect(rect, 'dirty rect');
    const bounds = tileBoundsForDocumentV1(this.#documentWidth, this.#documentHeight, coordinate);
    const validLocalRect: RectV1 = Object.freeze({
      x: 0,
      y: 0,
      width: bounds.validWidth,
      height: bounds.validHeight,
    });
    const clipped = intersectRect(rect, validLocalRect);
    if (clipped === null) return this.get(coordinate);

    const key = tileKeyV1(coordinate);
    const current = this.#dirty.get(key);
    if (current?.region.kind === 'whole') return current;
    const combined =
      current?.region.kind === 'rect' ? unionRect(current.region.rect, clipped) : clipped;
    if (shouldPromoteWhole(combined, bounds)) return this.markWhole(coordinate);

    const state = Object.freeze({
      coordinate: freezeCoordinate(coordinate.tx, coordinate.ty),
      region: Object.freeze({ kind: 'rect' as const, rect: combined }),
    });
    this.#dirty.set(key, state);
    return state;
  }

  clear(coordinate: TileCoordinateV1): boolean {
    return this.#dirty.delete(tileKeyV1(coordinate));
  }

  clearAll(): void {
    this.#dirty.clear();
  }

  entries(): readonly DirtyTileStateV1[] {
    return Object.freeze([...this.#dirty.values()]);
  }
}

export class SparseTileMapV1<Value> {
  readonly #documentWidth: number;
  readonly #documentHeight: number;
  readonly #tiles = new Map<string, SparseTileEntryV1<Value>>();

  constructor(documentWidth: number, documentHeight: number) {
    tileGridForDocumentV1(documentWidth, documentHeight);
    this.#documentWidth = documentWidth;
    this.#documentHeight = documentHeight;
  }

  get size(): number {
    return this.#tiles.size;
  }

  has(coordinate: TileCoordinateV1): boolean {
    return this.#tiles.has(tileKeyV1(coordinate));
  }

  get(coordinate: TileCoordinateV1): SparseTileEntryV1<Value> | null {
    return this.#tiles.get(tileKeyV1(coordinate)) ?? null;
  }

  allocate(
    coordinate: TileCoordinateV1,
    create: (bounds: TileBoundsV1) => Value,
  ): SparseTileEntryV1<Value> {
    const key = tileKeyV1(coordinate);
    const existing = this.#tiles.get(key);
    if (existing !== undefined) return existing;
    const bounds = tileBoundsForDocumentV1(this.#documentWidth, this.#documentHeight, coordinate);
    const entry = Object.freeze({
      coordinate: bounds.coordinate,
      bounds,
      value: create(bounds),
    });
    this.#tiles.set(key, entry);
    return entry;
  }

  deallocate(coordinate: TileCoordinateV1): boolean {
    return this.#tiles.delete(tileKeyV1(coordinate));
  }

  clear(): void {
    this.#tiles.clear();
  }

  entries(): readonly SparseTileEntryV1<Value>[] {
    return Object.freeze([...this.#tiles.values()]);
  }
}
