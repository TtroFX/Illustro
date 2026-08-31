import {
  DirtyTileTrackerV1,
  SparseTileMapV1,
  tileGridForDocumentV1,
  type DirtyTileStateV1,
  type RectV1,
  type SparseTileEntryV1,
  type TileCoordinateV1,
  type TileGridV1,
} from './sparse-tile-model.js';

export interface RendererLogicalTileV1 {
  readonly schema: 'illustro.renderer-logical-tile/1';
  readonly revision: number;
}

export interface RendererTileStateSnapshotV1 {
  readonly schema: 'illustro.renderer-tile-state/1';
  readonly documentWidth: number;
  readonly documentHeight: number;
  readonly grid: TileGridV1;
  readonly allocatedTileCount: number;
  readonly dirtyTileCount: number;
}

export class RendererTileStateV1 {
  readonly #documentWidth: number;
  readonly #documentHeight: number;
  readonly #grid: TileGridV1;
  readonly #tiles: SparseTileMapV1<RendererLogicalTileV1>;
  readonly #dirty: DirtyTileTrackerV1;

  constructor(documentWidth: number, documentHeight: number) {
    this.#grid = tileGridForDocumentV1(documentWidth, documentHeight);
    this.#documentWidth = documentWidth;
    this.#documentHeight = documentHeight;
    this.#tiles = new SparseTileMapV1(documentWidth, documentHeight);
    this.#dirty = new DirtyTileTrackerV1(documentWidth, documentHeight);
  }

  snapshot(): RendererTileStateSnapshotV1 {
    return Object.freeze({
      schema: 'illustro.renderer-tile-state/1',
      documentWidth: this.#documentWidth,
      documentHeight: this.#documentHeight,
      grid: this.#grid,
      allocatedTileCount: this.#tiles.size,
      dirtyTileCount: this.#dirty.size,
    });
  }

  allocate(coordinate: TileCoordinateV1): SparseTileEntryV1<RendererLogicalTileV1> {
    return this.#tiles.allocate(coordinate, () =>
      Object.freeze({ schema: 'illustro.renderer-logical-tile/1', revision: 0 }),
    );
  }

  deallocate(coordinate: TileCoordinateV1): boolean {
    this.#dirty.clear(coordinate);
    return this.#tiles.deallocate(coordinate);
  }

  markDirty(coordinate: TileCoordinateV1, rect: RectV1): DirtyTileStateV1 | null {
    if (!this.#tiles.has(coordinate)) {
      throw new Error('cannot mark an absent sparse tile dirty; allocate it first');
    }
    return this.#dirty.markRect(coordinate, rect);
  }

  clearDirty(coordinate: TileCoordinateV1): boolean {
    return this.#dirty.clear(coordinate);
  }

  getTile(coordinate: TileCoordinateV1): SparseTileEntryV1<RendererLogicalTileV1> | null {
    return this.#tiles.get(coordinate);
  }

  getDirty(coordinate: TileCoordinateV1): DirtyTileStateV1 | null {
    return this.#dirty.get(coordinate);
  }
}
