import { parseRevision, type LayerId, type Revision } from '../domain/identity.js';
import {
  createRasterLayer,
  type FillLayerV1,
  type LayerBaseV1,
  type RasterLayerV1,
  type RasterTileReferenceV1,
  type VectorLayerV1,
} from '../domain/layers.js';
import { tileBoundsForDocumentV1, tileGridForDocumentV1 } from '../gpu/sparse-tile-model.js';
import {
  prepareRasterMergeVisibleCopyV1,
  type PreparedRasterMergeTileV1,
  type RasterMergePersistencePortV1,
} from './layer-raster-merge.js';
import type { PaintProjectSnapshotV1 } from './paint-session-controller.js';

export interface LayerRasterizeEligibilityV1 {
  readonly eligible: boolean;
  readonly layerId: LayerId;
  readonly reason: string | null;
}

export interface PreparedLayerRasterizeV1 {
  readonly schema: 'illustro.prepared-layer-rasterize/1';
  readonly layerId: LayerId;
  readonly sourceType: LayerBaseV1['type'];
  readonly sourceRevision: Revision;
  readonly documentRevision: Revision;
  readonly tiles: readonly PreparedRasterMergeTileV1[];
}

function unavailable(layerId: LayerId, reason: string): LayerRasterizeEligibilityV1 {
  return Object.freeze({ eligible: false, layerId, reason });
}

export function layerRasterizeEligibilityV1(
  snapshot: PaintProjectSnapshotV1,
  layerId: LayerId,
): LayerRasterizeEligibilityV1 {
  const layer = snapshot.document.layerTree.layers[layerId];
  if (layer === undefined) return unavailable(layerId, 'rasterize target layer is missing');
  if (layer.type === 'lineartBoundary') {
    return unavailable(
      layerId,
      'Lineart Boundary data is non-rendering topology and cannot be rasterized',
    );
  }
  if (layer.locks.all || layer.locks.pixels) {
    return unavailable(layerId, 'rasterize is blocked by the layer pixel lock');
  }
  if (layer.transformStack.length > 0) {
    return unavailable(
      layerId,
      'rasterize transform baking requires the transform renderer milestone',
    );
  }
  if (layer.effectStack.length > 0) {
    return unavailable(layerId, 'rasterize effect baking requires the effect compositor milestone');
  }

  switch (layer.type) {
    case 'raster': {
      const hasUnbakedStroke = snapshot.committedStrokes.some(
        (entry) => entry.stroke.layerId === layerId && entry.bakedToRasterLayer !== true,
      );
      return hasUnbakedStroke
        ? Object.freeze({ eligible: true, layerId, reason: null })
        : unavailable(layerId, 'raster layer content is already materialized');
    }
    case 'fill': {
      const fill = layer as FillLayerV1;
      if (fill.fill.kind !== 'solid') {
        return unavailable(
          layerId,
          'pattern fill rasterization requires the material renderer milestone',
        );
      }
      if (fill.fill.color.space !== snapshot.document.color.workingSpace) {
        return unavailable(
          layerId,
          'fill color conversion requires the color-management milestone',
        );
      }
      return Object.freeze({ eligible: true, layerId, reason: null });
    }
    case 'vector': {
      const vector = layer as VectorLayerV1;
      return vector.objects.length === 0
        ? Object.freeze({ eligible: true, layerId, reason: null })
        : unavailable(
            layerId,
            'vector artwork rasterization requires the vector renderer milestone',
          );
    }
    case 'gradient':
      return unavailable(
        layerId,
        'gradient rasterization requires the canonical gradient renderer',
      );
    case 'adjustment':
      return unavailable(
        layerId,
        'adjustment rasterization requires the effect compositor milestone',
      );
    case 'folder':
      return unavailable(layerId, 'folder rasterization requires the layer compositor milestone');
    case 'linkedObject':
      return unavailable(
        layerId,
        'linked object rasterization requires canonical embedded representation completion',
      );
    case 'text':
      return unavailable(layerId, 'text rasterization requires the text renderer milestone');
  }
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
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

function solidFillBytes(
  width: number,
  height: number,
  precision: PaintProjectSnapshotV1['document']['color']['precision'],
  rgba: readonly [number, number, number, number],
): Uint8Array<ArrayBuffer> {
  const [red, green, blue, alpha] = rgba.map(clamp01) as [number, number, number, number];
  if (precision === 'rgba8-unorm') {
    const bytes = new Uint8Array(width * height * 4);
    const r = Math.round(red * 255);
    const g = Math.round(green * 255);
    const b = Math.round(blue * 255);
    const a = Math.round(alpha * 255);
    for (let offset = 0; offset < bytes.length; offset += 4) {
      bytes[offset] = r;
      bytes[offset + 1] = g;
      bytes[offset + 2] = b;
      bytes[offset + 3] = a;
    }
    return bytes;
  }
  const bytes = new Uint8Array(width * height * 8);
  const view = new DataView(bytes.buffer);
  const r = floatToHalf(red);
  const g = floatToHalf(green);
  const b = floatToHalf(blue);
  const a = floatToHalf(alpha);
  for (let pixel = 0; pixel < width * height; pixel += 1) {
    const offset = pixel * 8;
    view.setUint16(offset, r, true);
    view.setUint16(offset + 2, g, true);
    view.setUint16(offset + 4, b, true);
    view.setUint16(offset + 6, a, true);
  }
  return bytes;
}

async function materializeRasterContentV1(
  snapshot: PaintProjectSnapshotV1,
  layer: RasterLayerV1,
  persistence: RasterMergePersistencePortV1,
): Promise<readonly PreparedRasterMergeTileV1[]> {
  const contentLayer = createRasterLayer({ id: layer.id, name: layer.name, tiles: layer.tiles });
  const isolated: PaintProjectSnapshotV1 = Object.freeze({
    schema: 'illustro.paint-project-snapshot/1' as const,
    document: Object.freeze({
      ...snapshot.document,
      layerTree: Object.freeze({
        rootLayerIds: Object.freeze([layer.id]),
        layers: Object.freeze({ [layer.id]: contentLayer }),
      }),
    }),
    committedStrokes: Object.freeze(
      snapshot.committedStrokes.filter((entry) => entry.stroke.layerId === layer.id),
    ),
  });
  const prepared = await prepareRasterMergeVisibleCopyV1(
    isolated,
    '__rasterize-content__',
    persistence,
  );
  return prepared.tiles;
}

async function materializeSolidFillV1(
  snapshot: PaintProjectSnapshotV1,
  layer: FillLayerV1,
  persistence: RasterMergePersistencePortV1,
): Promise<readonly PreparedRasterMergeTileV1[]> {
  if (layer.fill.kind !== 'solid') throw new Error('solid fill rasterization source changed');
  if (layer.fill.color.space !== snapshot.document.color.workingSpace) {
    throw new Error('solid fill working space changed before rasterization');
  }
  const alpha = clamp01(layer.fill.color.rgba[3]);
  if (alpha === 0) return Object.freeze([]);
  const width = snapshot.document.canvas.width;
  const height = snapshot.document.canvas.height;
  const precision = snapshot.document.color.precision;
  const grid = tileGridForDocumentV1(width, height);
  const tiles: PreparedRasterMergeTileV1[] = [];
  for (let ty = 0; ty < grid.rows; ty += 1) {
    for (let tx = 0; tx < grid.columns; tx += 1) {
      const bounds = tileBoundsForDocumentV1(width, height, { tx, ty });
      const persisted = await persistence.persistRasterTile({
        width: bounds.validWidth,
        height: bounds.validHeight,
        pixelFormat: precision,
        bytes: solidFillBytes(
          bounds.validWidth,
          bounds.validHeight,
          precision,
          layer.fill.color.rgba,
        ),
      });
      tiles.push(Object.freeze({ x: tx, y: ty, payloadRef: persisted.payloadRef }));
    }
  }
  return Object.freeze(tiles);
}

export async function prepareLayerRasterizeV1(
  snapshot: PaintProjectSnapshotV1,
  layerId: LayerId,
  persistence: RasterMergePersistencePortV1,
): Promise<PreparedLayerRasterizeV1> {
  const eligibility = layerRasterizeEligibilityV1(snapshot, layerId);
  if (!eligibility.eligible) throw new Error(eligibility.reason ?? 'rasterize is unavailable');
  const layer = snapshot.document.layerTree.layers[layerId];
  if (layer === undefined) throw new Error('rasterize target disappeared');
  let tiles: readonly PreparedRasterMergeTileV1[];
  if (layer.type === 'raster') {
    tiles = await materializeRasterContentV1(snapshot, layer as RasterLayerV1, persistence);
  } else if (layer.type === 'fill') {
    tiles = await materializeSolidFillV1(snapshot, layer as FillLayerV1, persistence);
  } else if (layer.type === 'vector') {
    tiles = Object.freeze([]);
  } else {
    throw new Error('rasterize source type changed before preparation');
  }
  return Object.freeze({
    schema: 'illustro.prepared-layer-rasterize/1' as const,
    layerId,
    sourceType: layer.type,
    sourceRevision: layer.revision,
    documentRevision: snapshot.document.revision,
    tiles,
  });
}

export function applyPreparedLayerRasterizeV1(
  snapshot: PaintProjectSnapshotV1,
  prepared: PreparedLayerRasterizeV1,
  revisionValue: Revision | number,
  now: Date = new Date(),
): PaintProjectSnapshotV1 {
  const revision = parseRevision(revisionValue);
  if (snapshot.document.revision !== prepared.documentRevision) {
    throw new Error('rasterize document changed before commit');
  }
  const source = snapshot.document.layerTree.layers[prepared.layerId];
  if (
    source === undefined ||
    source.type !== prepared.sourceType ||
    source.revision !== prepared.sourceRevision
  ) {
    throw new Error('rasterize source changed before commit');
  }
  const eligibility = layerRasterizeEligibilityV1(snapshot, prepared.layerId);
  if (!eligibility.eligible) throw new Error(eligibility.reason ?? 'rasterize is unavailable');
  const raster = Object.freeze({
    ...createRasterLayer({
      id: source.id,
      parentId: source.parentId,
      name: source.name,
      visible: source.visible,
      opacity: source.opacity,
      blendMode: source.blendMode,
      locks: source.locks,
      clipping: source.clipping,
      roleFlags: source.roleFlags,
      masks: source.masks,
      transformStack: Object.freeze([]),
      effectStack: Object.freeze([]),
      metadata: source.metadata,
      tiles: prepared.tiles.map(
        (tile): RasterTileReferenceV1 =>
          Object.freeze({ x: tile.x, y: tile.y, revision, payloadRef: tile.payloadRef }),
      ),
    }),
    revision,
    boundsHint: null,
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
          [prepared.layerId]: raster,
        }),
      }),
    }),
    committedStrokes: Object.freeze(committedStrokes),
  });
}
