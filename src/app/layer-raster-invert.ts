import { parseRevision, type LayerId, type Revision } from '../domain/identity.js';
import type { RasterLayerV1, RasterTileReferenceV1 } from '../domain/layers.js';
import { tileBoundsForDocumentV1 } from '../gpu/sparse-tile-model.js';
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

export interface LayerInvertEligibilityV1 {
  readonly eligible: boolean;
  readonly layerId: LayerId;
  readonly reason: string | null;
}

export interface PreparedLayerInvertV1 {
  readonly schema: 'illustro.prepared-layer-invert/1';
  readonly layerId: LayerId;
  readonly sourceRevision: Revision;
  readonly documentRevision: Revision;
  readonly tiles: readonly PreparedRasterMergeTileV1[];
}

function unavailable(layerId: LayerId, reason: string): LayerInvertEligibilityV1 {
  return Object.freeze({ eligible: false, layerId, reason });
}

function hasUnbakedLayerStrokeV1(snapshot: PaintProjectSnapshotV1, layerId: LayerId): boolean {
  return snapshot.committedStrokes.some(
    (entry) => entry.stroke.layerId === layerId && entry.bakedToRasterLayer !== true,
  );
}

export function layerInvertEligibilityV1(
  snapshot: PaintProjectSnapshotV1,
  layerId: LayerId,
): LayerInvertEligibilityV1 {
  const layer = snapshot.document.layerTree.layers[layerId];
  if (layer === undefined) return unavailable(layerId, 'invert target layer is missing');
  if (layer.type !== 'raster') {
    return unavailable(layerId, 'layer invert currently requires a Raster Layer');
  }
  if (layer.locks.all || layer.locks.pixels) {
    return unavailable(layerId, 'layer invert is blocked by the layer pixel lock');
  }
  const hasUnbakedStroke = hasUnbakedLayerStrokeV1(snapshot, layerId);
  if (hasUnbakedStroke && layer.transformStack.length > 0) {
    return unavailable(
      layerId,
      'inverting pending stroke content under a live transform requires transform renderer integration',
    );
  }
  if (hasUnbakedStroke && layer.effectStack.length > 0) {
    return unavailable(
      layerId,
      'inverting pending stroke content under live effects requires effect compositor integration',
    );
  }
  if ((layer as RasterLayerV1).tiles.length === 0 && !hasUnbakedStroke) {
    return unavailable(layerId, 'layer invert requires raster content');
  }
  return Object.freeze({ eligible: true, layerId, reason: null });
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
  if (sourceExponent === 0xff) {
    return sign | (fraction === 0 ? 0x7c00 : 0x7e00);
  }
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

function assertTileContract(
  tile: PaintDecodedRasterTileV1,
  format: PaintRasterTilePixelFormatV1,
  width: number,
  height: number,
): void {
  if (tile.pixelFormat !== format || tile.width !== width || tile.height !== height) {
    throw new Error('canonical invert tile does not match the document tile contract');
  }
  const expectedLength = width * height * (format === 'rgba8-unorm' ? 4 : 8);
  if (tile.bytes.byteLength !== expectedLength) {
    throw new Error('canonical invert tile byte length is invalid');
  }
}

export function invertStraightRgbaBytesV1(
  bytes: Uint8Array,
  format: PaintRasterTilePixelFormatV1,
  width: number,
  height: number,
): Uint8Array<ArrayBuffer> {
  const expectedLength = width * height * (format === 'rgba8-unorm' ? 4 : 8);
  if (bytes.byteLength !== expectedLength) {
    throw new RangeError('invert source byte length does not match dimensions');
  }
  const output = new Uint8Array(bytes);
  if (format === 'rgba8-unorm') {
    for (let offset = 0; offset < output.byteLength; offset += 4) {
      output[offset] = 255 - (bytes[offset] ?? 0);
      output[offset + 1] = 255 - (bytes[offset + 1] ?? 0);
      output[offset + 2] = 255 - (bytes[offset + 2] ?? 0);
    }
    return output;
  }
  const source = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const target = new DataView(output.buffer, output.byteOffset, output.byteLength);
  for (let offset = 0; offset < output.byteLength; offset += 8) {
    for (const channelOffset of [0, 2, 4] as const) {
      const channel = halfToFloat(source.getUint16(offset + channelOffset, true));
      target.setUint16(offset + channelOffset, floatToHalf(1 - channel), true);
    }
  }
  return output;
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

export async function prepareLayerInvertV1(
  snapshot: PaintProjectSnapshotV1,
  layerId: LayerId,
  persistence: RasterMergePersistencePortV1,
): Promise<PreparedLayerInvertV1> {
  const eligibility = layerInvertEligibilityV1(snapshot, layerId);
  if (!eligibility.eligible) throw new Error(eligibility.reason ?? 'layer invert is unavailable');
  const source = snapshot.document.layerTree.layers[layerId];
  if (source?.type !== 'raster') throw new Error('layer invert source changed');
  const width = snapshot.document.canvas.width;
  const height = snapshot.document.canvas.height;
  const format = snapshot.document.color.precision;
  const tiles: PreparedRasterMergeTileV1[] = [];
  const materialized = await sourceTilesV1(snapshot, source as RasterLayerV1, persistence);
  for (const tile of [...materialized].sort(
    (left, right) => left.y - right.y || left.x - right.x,
  )) {
    const bounds = tileBoundsForDocumentV1(width, height, { tx: tile.x, ty: tile.y });
    const decoded = await persistence.readRasterTile(tile.payloadRef);
    assertTileContract(decoded, format, bounds.validWidth, bounds.validHeight);
    const persisted = await persistence.persistRasterTile({
      width: bounds.validWidth,
      height: bounds.validHeight,
      pixelFormat: format,
      bytes: invertStraightRgbaBytesV1(
        decoded.bytes,
        format,
        bounds.validWidth,
        bounds.validHeight,
      ),
    });
    tiles.push(Object.freeze({ x: tile.x, y: tile.y, payloadRef: persisted.payloadRef }));
  }
  return Object.freeze({
    schema: 'illustro.prepared-layer-invert/1' as const,
    layerId,
    sourceRevision: source.revision,
    documentRevision: snapshot.document.revision,
    tiles: Object.freeze(tiles),
  });
}

export function applyPreparedLayerInvertV1(
  snapshot: PaintProjectSnapshotV1,
  prepared: PreparedLayerInvertV1,
  revisionValue: Revision | number,
  now: Date = new Date(),
): PaintProjectSnapshotV1 {
  const revision = parseRevision(revisionValue);
  if (snapshot.document.revision !== prepared.documentRevision) {
    throw new Error('layer invert document changed before commit');
  }
  const source = snapshot.document.layerTree.layers[prepared.layerId];
  if (source?.type !== 'raster' || source.revision !== prepared.sourceRevision) {
    throw new Error('layer invert source changed before commit');
  }
  const eligibility = layerInvertEligibilityV1(snapshot, prepared.layerId);
  if (!eligibility.eligible) throw new Error(eligibility.reason ?? 'layer invert is unavailable');
  const inverted = Object.freeze({
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
          [prepared.layerId]: inverted,
        }),
      }),
    }),
    committedStrokes: Object.freeze(committedStrokes),
  });
}
