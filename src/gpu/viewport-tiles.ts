import {
  CANONICAL_TILE_SIZE_PX,
  tileBoundsForDocumentV1,
  tileGridForDocumentV1,
  type TileBoundsV1,
  type TileCoordinateV1,
} from './sparse-tile-model.js';

export interface DocumentViewportRectV1 {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface ViewportTileResolutionV1 {
  readonly schema: 'illustro.viewport-tiles/1';
  readonly visible: readonly TileCoordinateV1[];
  readonly bounds: readonly TileBoundsV1[];
}

function assertFiniteViewport(rect: DocumentViewportRectV1): void {
  if (
    !Number.isFinite(rect.x) ||
    !Number.isFinite(rect.y) ||
    !Number.isFinite(rect.width) ||
    !Number.isFinite(rect.height) ||
    rect.width <= 0 ||
    rect.height <= 0 ||
    !Number.isFinite(rect.x + rect.width) ||
    !Number.isFinite(rect.y + rect.height)
  ) {
    throw new RangeError('viewport rect must contain finite coordinates and positive dimensions');
  }
}

export function resolveViewportTilesV1(
  documentWidth: number,
  documentHeight: number,
  viewport: DocumentViewportRectV1,
): ViewportTileResolutionV1 {
  const grid = tileGridForDocumentV1(documentWidth, documentHeight);
  assertFiniteViewport(viewport);
  const left = Math.max(0, viewport.x);
  const top = Math.max(0, viewport.y);
  const right = Math.min(documentWidth, viewport.x + viewport.width);
  const bottom = Math.min(documentHeight, viewport.y + viewport.height);
  if (right <= left || bottom <= top) {
    return Object.freeze({
      schema: 'illustro.viewport-tiles/1',
      visible: Object.freeze([]),
      bounds: Object.freeze([]),
    });
  }

  const startTx = Math.max(0, Math.floor(left / CANONICAL_TILE_SIZE_PX));
  const startTy = Math.max(0, Math.floor(top / CANONICAL_TILE_SIZE_PX));
  const endTx = Math.min(grid.columns - 1, Math.ceil(right / CANONICAL_TILE_SIZE_PX) - 1);
  const endTy = Math.min(grid.rows - 1, Math.ceil(bottom / CANONICAL_TILE_SIZE_PX) - 1);
  const visible: TileCoordinateV1[] = [];
  const bounds: TileBoundsV1[] = [];
  for (let ty = startTy; ty <= endTy; ty += 1) {
    for (let tx = startTx; tx <= endTx; tx += 1) {
      const coordinate = Object.freeze({ tx, ty });
      visible.push(coordinate);
      bounds.push(tileBoundsForDocumentV1(documentWidth, documentHeight, coordinate));
    }
  }
  return Object.freeze({
    schema: 'illustro.viewport-tiles/1',
    visible: Object.freeze(visible),
    bounds: Object.freeze(bounds),
  });
}
