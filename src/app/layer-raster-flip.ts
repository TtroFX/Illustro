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

export type LayerRasterFlipAxisV1 = 'horizontal' | 'vertical';

export interface LayerRasterFlipEligibilityV1 {
  readonly eligible: boolean;
  readonly layerId: LayerId;
  readonly reason: string | null;
}

export interface PreparedLayerRasterFlipV1 {
  readonly schema: 'illustro.prepared-layer-raster-flip/1';
  readonly layerId: LayerId;
  readonly axis: LayerRasterFlipAxisV1;
  readonly sourceRevision: Revision;
  readonly documentRevision: Revision;
  readonly tiles: readonly PreparedRasterMergeTileV1[];
}

interface MutableDestinationTileV1 {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly bytes: Uint8Array<ArrayBuffer>;
}

function unavailable(layerId: LayerId, reason: string): LayerRasterFlipEligibilityV1 {
  return Object.freeze({ eligible: false, layerId, reason });
}

function hasUnbakedLayerStrokeV1(snapshot: PaintProjectSnapshotV1, layerId: LayerId): boolean {
  return snapshot.committedStrokes.some(
    (entry) => entry.stroke.layerId === layerId && entry.bakedToRasterLayer !== true,
  );
}

export function layerRasterFlipEligibilityV1(
  snapshot: PaintProjectSnapshotV1,
  layerId: LayerId,
): LayerRasterFlipEligibilityV1 {
  const layer = snapshot.document.layerTree.layers[layerId];
  if (layer === undefined) return unavailable(layerId, 'layer flip target is missing');
  if (layer.type !== 'raster') {
    return unavailable(layerId, 'layer flip currently requires a Raster Layer');
  }
  if (layer.locks.all || layer.locks.pixels || layer.locks.position) {
    return unavailable(layerId, 'layer flip is blocked by the layer pixel/position lock');
  }
  if (layer.transformStack.length > 0) {
    return unavailable(
      layerId,
      'layer flip under a live transform requires transform renderer integration',
    );
  }
  if (layer.effectStack.length > 0) {
    return unavailable(
      layerId,
      'layer flip with live effects requires effect compositor integration',
    );
  }
  const hasUnbakedStroke = hasUnbakedLayerStrokeV1(snapshot, layerId);
  if ((layer as RasterLayerV1).tiles.length === 0 && !hasUnbakedStroke) {
    return unavailable(layerId, 'layer flip requires raster content');
  }
  return Object.freeze({ eligible: true, layerId, reason: null });
}

function assertTileContract(
  tile: PaintDecodedRasterTileV1,
  format: PaintRasterTilePixelFormatV1,
  width: number,
  height: number,
): void {
  if (tile.pixelFormat !== format || tile.width !== width || tile.height !== height) {
    throw new Error('canonical layer flip tile does not match the document tile contract');
  }
  const expectedLength = width * height * (format === 'rgba8-unorm' ? 4 : 8);
  if (tile.bytes.byteLength !== expectedLength) {
    throw new Error('canonical layer flip tile byte length is invalid');
  }
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

function destinationCoordinateV1(
  axis: LayerRasterFlipAxisV1,
  width: number,
  height: number,
  sourceX: number,
  sourceY: number,
): readonly [number, number] {
  if (axis === 'horizontal') return [width - 1 - sourceX, sourceY];
  if (axis === 'vertical') return [sourceX, height - 1 - sourceY];
  throw new TypeError(`unsupported layer flip axis: ${String(axis)}`);
}

function destinationTileV1(
  staged: Map<string, MutableDestinationTileV1>,
  width: number,
  height: number,
  pixelFormat: PaintRasterTilePixelFormatV1,
  documentX: number,
  documentY: number,
): MutableDestinationTileV1 {
  const tx = Math.floor(documentX / CANONICAL_TILE_SIZE_PX);
  const ty = Math.floor(documentY / CANONICAL_TILE_SIZE_PX);
  const key = `${tx}:${ty}`;
  const existing = staged.get(key);
  if (existing !== undefined) return existing;
  const bounds = tileBoundsForDocumentV1(width, height, { tx, ty });
  const bytesPerPixel = pixelFormat === 'rgba8-unorm' ? 4 : 8;
  const created: MutableDestinationTileV1 = {
    x: tx,
    y: ty,
    width: bounds.validWidth,
    height: bounds.validHeight,
    bytes: new Uint8Array(bounds.validWidth * bounds.validHeight * bytesPerPixel),
  };
  staged.set(key, created);
  return created;
}

export async function prepareLayerRasterFlipV1(
  snapshot: PaintProjectSnapshotV1,
  layerId: LayerId,
  axis: LayerRasterFlipAxisV1,
  persistence: RasterMergePersistencePortV1,
): Promise<PreparedLayerRasterFlipV1> {
  const eligibility = layerRasterFlipEligibilityV1(snapshot, layerId);
  if (!eligibility.eligible) {
    throw new Error(eligibility.reason ?? 'layer flip is unavailable');
  }
  const source = snapshot.document.layerTree.layers[layerId];
  if (source?.type !== 'raster') throw new Error('layer flip source changed');
  const width = snapshot.document.canvas.width;
  const height = snapshot.document.canvas.height;
  const pixelFormat = snapshot.document.color.precision;
  const bytesPerPixel = pixelFormat === 'rgba8-unorm' ? 4 : 8;
  const staged = new Map<string, MutableDestinationTileV1>();
  const materialized = await sourceTilesV1(snapshot, source as RasterLayerV1, persistence);
  for (const tile of [...materialized].sort(
    (left, right) => left.y - right.y || left.x - right.x,
  )) {
    const bounds = tileBoundsForDocumentV1(width, height, { tx: tile.x, ty: tile.y });
    const decoded = await persistence.readRasterTile(tile.payloadRef);
    assertTileContract(decoded, pixelFormat, bounds.validWidth, bounds.validHeight);
    for (let localY = 0; localY < bounds.validHeight; localY += 1) {
      for (let localX = 0; localX < bounds.validWidth; localX += 1) {
        const sourceX = bounds.x + localX;
        const sourceY = bounds.y + localY;
        const [destinationX, destinationY] = destinationCoordinateV1(
          axis,
          width,
          height,
          sourceX,
          sourceY,
        );
        const target = destinationTileV1(
          staged,
          width,
          height,
          pixelFormat,
          destinationX,
          destinationY,
        );
        const targetBounds = tileBoundsForDocumentV1(width, height, {
          tx: target.x,
          ty: target.y,
        });
        const sourceOffset = (localY * bounds.validWidth + localX) * bytesPerPixel;
        const targetOffset =
          ((destinationY - targetBounds.y) * target.width + (destinationX - targetBounds.x)) *
          bytesPerPixel;
        target.bytes.set(
          decoded.bytes.subarray(sourceOffset, sourceOffset + bytesPerPixel),
          targetOffset,
        );
      }
    }
  }
  const tiles: PreparedRasterMergeTileV1[] = [];
  for (const tile of [...staged.values()].sort(
    (left, right) => left.y - right.y || left.x - right.x,
  )) {
    const persisted = await persistence.persistRasterTile({
      width: tile.width,
      height: tile.height,
      pixelFormat,
      bytes: tile.bytes,
    });
    tiles.push(Object.freeze({ x: tile.x, y: tile.y, payloadRef: persisted.payloadRef }));
  }
  return Object.freeze({
    schema: 'illustro.prepared-layer-raster-flip/1' as const,
    layerId,
    axis,
    sourceRevision: source.revision,
    documentRevision: snapshot.document.revision,
    tiles: Object.freeze(tiles),
  });
}

export function applyPreparedLayerRasterFlipV1(
  snapshot: PaintProjectSnapshotV1,
  prepared: PreparedLayerRasterFlipV1,
  revisionValue: Revision | number,
  now: Date = new Date(),
): PaintProjectSnapshotV1 {
  const revision = parseRevision(revisionValue);
  if (snapshot.document.revision !== prepared.documentRevision) {
    throw new Error('layer flip document changed before commit');
  }
  const source = snapshot.document.layerTree.layers[prepared.layerId];
  if (source?.type !== 'raster' || source.revision !== prepared.sourceRevision) {
    throw new Error('layer flip source changed before commit');
  }
  const eligibility = layerRasterFlipEligibilityV1(snapshot, prepared.layerId);
  if (!eligibility.eligible) {
    throw new Error(eligibility.reason ?? 'layer flip is unavailable');
  }
  const flipped = Object.freeze({
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
          [prepared.layerId]: flipped,
        }),
      }),
    }),
    committedStrokes: Object.freeze(committedStrokes),
  });
}
