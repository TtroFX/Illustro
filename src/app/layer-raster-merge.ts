import { parseRevision, type LayerId, type Revision } from '../domain/identity.js';
import {
  createRasterLayer,
  type RasterLayerV1,
  type RasterTileReferenceV1,
} from '../domain/layers.js';
import {
  baselineDabRadiusXV1,
  baselineDabRadiusYV1,
  planBaselineBrushTilesV1,
  type BaselineBrushDabV1,
} from '../gpu/baseline-brush.js';
import { tileBoundsForDocumentV1, type TileCoordinateV1 } from '../gpu/sparse-tile-model.js';
import type {
  PaintDecodedRasterTileV1,
  PaintPersistedRasterTileV1,
  PaintRasterTilePixelFormatV1,
} from './paint-persistence-controller.js';
import type { CompletedPaintStrokeV1, PaintProjectSnapshotV1 } from './paint-session-controller.js';

export interface RasterMergePersistencePortV1 {
  readRasterTile(payloadRef: string): Promise<PaintDecodedRasterTileV1>;
  persistRasterTile(input: {
    readonly width: number;
    readonly height: number;
    readonly pixelFormat: PaintRasterTilePixelFormatV1;
    readonly bytes: Uint8Array | ArrayBuffer;
  }): Promise<PaintPersistedRasterTileV1>;
}

export interface RasterMergeDownEligibilityV1 {
  readonly eligible: boolean;
  readonly sourceLayerId: LayerId;
  readonly targetLayerId: LayerId | null;
  readonly reason: string | null;
}

export interface PreparedRasterMergeTileV1 {
  readonly x: number;
  readonly y: number;
  readonly payloadRef: string;
}

export interface PreparedRasterMergeDownV1 {
  readonly schema: 'illustro.prepared-raster-merge-down/1';
  readonly sourceLayerId: LayerId;
  readonly targetLayerId: LayerId;
  readonly sourceLayerRevision: Revision;
  readonly targetLayerRevision: Revision;
  readonly documentRevision: Revision;
  readonly tiles: readonly PreparedRasterMergeTileV1[];
}

export interface RasterMergeVisibleCopyEligibilityV1 {
  readonly eligible: boolean;
  readonly visibleLayerIds: readonly LayerId[];
  readonly reason: string | null;
}

export interface PreparedRasterMergeVisibleCopySourceV1 {
  readonly layerId: LayerId;
  readonly revision: Revision;
}

export interface PreparedRasterMergeVisibleCopyV1 {
  readonly schema: 'illustro.prepared-raster-merge-visible-copy/1';
  readonly outputLayerId: LayerId;
  readonly outputLayerName: string;
  readonly documentRevision: Revision;
  readonly sourceLayers: readonly PreparedRasterMergeVisibleCopySourceV1[];
  readonly tiles: readonly PreparedRasterMergeTileV1[];
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function compatibleRasterLayer(layer: RasterLayerV1): string | null {
  if (!layer.visible) return 'merge down requires visible raster layers';
  if (layer.opacity !== 1) return 'merge down opacity baking requires the compositor milestone';
  if (layer.blendMode !== 'normal')
    return 'merge down blend baking requires the compositor milestone';
  if (layer.clipping !== null) return 'merge down clipping baking requires compositor integration';
  if (layer.masks.length > 0) return 'merge down mask baking requires mask compositor integration';
  if (layer.transformStack.length > 0)
    return 'merge down transform baking requires rasterize integration';
  if (layer.effectStack.length > 0)
    return 'merge down effect baking requires effect compositor integration';
  if (layer.locks.all || layer.locks.pixels) return 'merge down is blocked by the layer pixel lock';
  return null;
}

export function rasterMergeDownEligibilityV1(
  snapshot: PaintProjectSnapshotV1,
  sourceLayerId: LayerId,
): RasterMergeDownEligibilityV1 {
  const roots = snapshot.document.layerTree.rootLayerIds;
  const sourceIndex = roots.indexOf(sourceLayerId);
  const targetLayerId = sourceIndex > 0 ? (roots[sourceIndex - 1] ?? null) : null;
  if (sourceIndex < 0) {
    return Object.freeze({
      eligible: false,
      sourceLayerId,
      targetLayerId: null,
      reason: 'merge down requires a root layer',
    });
  }
  if (targetLayerId === null) {
    return Object.freeze({
      eligible: false,
      sourceLayerId,
      targetLayerId: null,
      reason: 'merge down requires a layer below the active layer',
    });
  }
  const source = snapshot.document.layerTree.layers[sourceLayerId];
  const target = snapshot.document.layerTree.layers[targetLayerId];
  if (source?.type !== 'raster' || target?.type !== 'raster') {
    return Object.freeze({
      eligible: false,
      sourceLayerId,
      targetLayerId,
      reason: 'baseline merge down currently requires two raster layers',
    });
  }
  const sourceRaster = source as RasterLayerV1;
  const targetRaster = target as RasterLayerV1;
  const reason = compatibleRasterLayer(sourceRaster) ?? compatibleRasterLayer(targetRaster);
  return Object.freeze({
    eligible: reason === null,
    sourceLayerId,
    targetLayerId,
    reason,
  });
}

function visibleCopyRasterReason(layer: RasterLayerV1): string | null {
  if (layer.opacity !== 1)
    return 'merge visible copy opacity baking requires the compositor milestone';
  if (layer.blendMode !== 'normal')
    return 'merge visible copy blend baking requires the compositor milestone';
  if (layer.clipping !== null)
    return 'merge visible copy clipping baking requires compositor integration';
  if (layer.masks.length > 0)
    return 'merge visible copy mask baking requires mask compositor integration';
  if (layer.transformStack.length > 0)
    return 'merge visible copy transform baking requires rasterize integration';
  if (layer.effectStack.length > 0)
    return 'merge visible copy effect baking requires effect compositor integration';
  return null;
}

export function rasterMergeVisibleCopyEligibilityV1(
  snapshot: PaintProjectSnapshotV1,
): RasterMergeVisibleCopyEligibilityV1 {
  const visibleLayerIds: LayerId[] = [];
  for (const layerId of snapshot.document.layerTree.rootLayerIds) {
    const layer = snapshot.document.layerTree.layers[layerId];
    if (layer === undefined) {
      return Object.freeze({
        eligible: false,
        visibleLayerIds: Object.freeze([...visibleLayerIds]),
        reason: 'merge visible copy found a missing root layer',
      });
    }
    if (!layer.visible || layer.type === 'lineartBoundary') continue;
    visibleLayerIds.push(layerId);
    if (layer.type !== 'raster') {
      return Object.freeze({
        eligible: false,
        visibleLayerIds: Object.freeze([...visibleLayerIds]),
        reason: 'baseline merge visible copy currently requires visible raster artwork layers',
      });
    }
    const reason = visibleCopyRasterReason(layer as RasterLayerV1);
    if (reason !== null) {
      return Object.freeze({
        eligible: false,
        visibleLayerIds: Object.freeze([...visibleLayerIds]),
        reason,
      });
    }
  }
  if (visibleLayerIds.length === 0) {
    return Object.freeze({
      eligible: false,
      visibleLayerIds: Object.freeze([]),
      reason: 'merge visible copy requires at least one visible artwork layer',
    });
  }
  return Object.freeze({
    eligible: true,
    visibleLayerIds: Object.freeze([...visibleLayerIds]),
    reason: null,
  });
}

function tileKey(tx: number, ty: number): string {
  return `${tx}:${ty}`;
}

function indexTileReferences(layer: RasterLayerV1): ReadonlyMap<string, RasterTileReferenceV1> {
  const result = new Map<string, RasterTileReferenceV1>();
  for (const tile of layer.tiles) {
    const key = tileKey(tile.x, tile.y);
    if (result.has(key)) throw new Error(`duplicate raster tile reference: ${key}`);
    result.set(key, tile);
  }
  return result;
}

function halfToFloat(value: number): number {
  const sign = (value & 0x8000) !== 0 ? -1 : 1;
  const exponent = (value >>> 10) & 0x1f;
  const fraction = value & 0x03ff;
  if (exponent === 0) return sign * 2 ** -14 * (fraction / 1024);
  if (exponent === 0x1f) return fraction === 0 ? sign * Number.POSITIVE_INFINITY : Number.NaN;
  return sign * 2 ** (exponent - 15) * (1 + fraction / 1024);
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

function decodeStraightToPremultiplied(
  tile: PaintDecodedRasterTileV1,
  expectedFormat: PaintRasterTilePixelFormatV1,
  width: number,
  height: number,
): Float32Array<ArrayBuffer> {
  if (tile.pixelFormat !== expectedFormat || tile.width !== width || tile.height !== height) {
    throw new Error('canonical raster tile does not match the document tile contract');
  }
  const result = new Float32Array(width * height * 4);
  if (expectedFormat === 'rgba8-unorm') {
    if (tile.bytes.byteLength !== width * height * 4) throw new Error('invalid RGBA8 tile length');
    for (let offset = 0; offset < result.length; offset += 4) {
      const alpha = (tile.bytes[offset + 3] ?? 0) / 255;
      result[offset] = ((tile.bytes[offset] ?? 0) / 255) * alpha;
      result[offset + 1] = ((tile.bytes[offset + 1] ?? 0) / 255) * alpha;
      result[offset + 2] = ((tile.bytes[offset + 2] ?? 0) / 255) * alpha;
      result[offset + 3] = alpha;
    }
    return result;
  }
  if (tile.bytes.byteLength !== width * height * 8) throw new Error('invalid RGBA16F tile length');
  const view = new DataView(tile.bytes.buffer, tile.bytes.byteOffset, tile.bytes.byteLength);
  for (let pixel = 0; pixel < width * height; pixel += 1) {
    const byteOffset = pixel * 8;
    const resultOffset = pixel * 4;
    const alpha = clamp01(halfToFloat(view.getUint16(byteOffset + 6, true)));
    result[resultOffset] = clamp01(halfToFloat(view.getUint16(byteOffset, true))) * alpha;
    result[resultOffset + 1] = clamp01(halfToFloat(view.getUint16(byteOffset + 2, true))) * alpha;
    result[resultOffset + 2] = clamp01(halfToFloat(view.getUint16(byteOffset + 4, true))) * alpha;
    result[resultOffset + 3] = alpha;
  }
  return result;
}

function encodePremultipliedToStraight(
  premultiplied: Float32Array<ArrayBuffer>,
  format: PaintRasterTilePixelFormatV1,
): Uint8Array<ArrayBuffer> {
  const bytesPerPixel = format === 'rgba8-unorm' ? 4 : 8;
  const output = new Uint8Array((premultiplied.length / 4) * bytesPerPixel);
  if (format === 'rgba8-unorm') {
    for (let offset = 0; offset < premultiplied.length; offset += 4) {
      const alpha = clamp01(premultiplied[offset + 3] ?? 0);
      const inverse = alpha > 0 ? 1 / alpha : 0;
      output[offset] = Math.round(clamp01((premultiplied[offset] ?? 0) * inverse) * 255);
      output[offset + 1] = Math.round(clamp01((premultiplied[offset + 1] ?? 0) * inverse) * 255);
      output[offset + 2] = Math.round(clamp01((premultiplied[offset + 2] ?? 0) * inverse) * 255);
      output[offset + 3] = Math.round(alpha * 255);
    }
    return output;
  }
  const view = new DataView(output.buffer);
  for (let offset = 0; offset < premultiplied.length; offset += 4) {
    const alpha = clamp01(premultiplied[offset + 3] ?? 0);
    const inverse = alpha > 0 ? 1 / alpha : 0;
    const byteOffset = (offset / 4) * 8;
    view.setUint16(byteOffset, floatToHalf((premultiplied[offset] ?? 0) * inverse), true);
    view.setUint16(byteOffset + 2, floatToHalf((premultiplied[offset + 1] ?? 0) * inverse), true);
    view.setUint16(byteOffset + 4, floatToHalf((premultiplied[offset + 2] ?? 0) * inverse), true);
    view.setUint16(byteOffset + 6, floatToHalf(alpha), true);
  }
  return output;
}

function validateDab(dab: BaselineBrushDabV1): void {
  if (
    !Number.isFinite(dab.x) ||
    !Number.isFinite(dab.y) ||
    !Number.isFinite(dab.radius) ||
    dab.radius <= 0 ||
    !Number.isFinite(dab.opacity) ||
    dab.opacity < 0 ||
    dab.opacity > 1
  ) {
    throw new RangeError('invalid baseline dab for raster merge');
  }
}

function rasterizeBlackDab(
  premultiplied: Float32Array<ArrayBuffer>,
  tileX: number,
  tileY: number,
  width: number,
  height: number,
  dab: BaselineBrushDabV1,
): void {
  validateDab(dab);
  const radiusX = baselineDabRadiusXV1(dab);
  const radiusY = baselineDabRadiusYV1(dab);
  const minX = Math.max(tileX, Math.floor(dab.x - radiusX));
  const minY = Math.max(tileY, Math.floor(dab.y - radiusY));
  const maxX = Math.min(tileX + width - 1, Math.ceil(dab.x + radiusX) - 1);
  const maxY = Math.min(tileY + height - 1, Math.ceil(dab.y + radiusY) - 1);
  for (let documentY = minY; documentY <= maxY; documentY += 1) {
    const localY = (documentY + 0.5 - dab.y) / radiusY;
    for (let documentX = minX; documentX <= maxX; documentX += 1) {
      const localX = (documentX + 0.5 - dab.x) / radiusX;
      const radialDistance = Math.hypot(localX, localY);
      if (radialDistance >= 1) continue;
      const sourceAlpha = clamp01(dab.opacity * (1 - smoothstep(0.85, 1, radialDistance)));
      if (sourceAlpha <= 0) continue;
      const offset = ((documentY - tileY) * width + (documentX - tileX)) * 4;
      const destinationScale = 1 - sourceAlpha;
      premultiplied[offset] = (premultiplied[offset] ?? 0) * destinationScale;
      premultiplied[offset + 1] = (premultiplied[offset + 1] ?? 0) * destinationScale;
      premultiplied[offset + 2] = (premultiplied[offset + 2] ?? 0) * destinationScale;
      premultiplied[offset + 3] = sourceAlpha + (premultiplied[offset + 3] ?? 0) * destinationScale;
    }
  }
}

function sourceOver(
  destination: Float32Array<ArrayBuffer>,
  source: Float32Array<ArrayBuffer>,
): Float32Array<ArrayBuffer> {
  if (destination.length !== source.length) throw new Error('raster merge tile size mismatch');
  const output = new Float32Array(destination);
  for (let offset = 0; offset < output.length; offset += 4) {
    const sourceAlpha = clamp01(source[offset + 3] ?? 0);
    const destinationScale = 1 - sourceAlpha;
    output[offset] = (source[offset] ?? 0) + (destination[offset] ?? 0) * destinationScale;
    output[offset + 1] =
      (source[offset + 1] ?? 0) + (destination[offset + 1] ?? 0) * destinationScale;
    output[offset + 2] =
      (source[offset + 2] ?? 0) + (destination[offset + 2] ?? 0) * destinationScale;
    output[offset + 3] = sourceAlpha + (destination[offset + 3] ?? 0) * destinationScale;
  }
  return output;
}

function hasCoverage(premultiplied: Float32Array<ArrayBuffer>): boolean {
  for (let offset = 3; offset < premultiplied.length; offset += 4) {
    if ((premultiplied[offset] ?? 0) > 0) return true;
  }
  return false;
}

function unbakedLayerStrokes(
  snapshot: PaintProjectSnapshotV1,
  layerId: LayerId,
): readonly CompletedPaintStrokeV1[] {
  return snapshot.committedStrokes.filter(
    (entry) => entry.stroke.layerId === layerId && entry.bakedToRasterLayer !== true,
  );
}

function touchedCoordinates(
  layer: RasterLayerV1,
  strokes: readonly CompletedPaintStrokeV1[],
  documentWidth: number,
  documentHeight: number,
): ReadonlyMap<string, TileCoordinateV1> {
  const result = new Map<string, TileCoordinateV1>();
  for (const tile of layer.tiles) {
    const coordinate = Object.freeze({ tx: tile.x, ty: tile.y });
    tileBoundsForDocumentV1(documentWidth, documentHeight, coordinate);
    result.set(tileKey(tile.x, tile.y), coordinate);
  }
  for (const entry of strokes) {
    for (const plan of planBaselineBrushTilesV1(entry.dabs, documentWidth, documentHeight)) {
      result.set(tileKey(plan.coordinate.tx, plan.coordinate.ty), plan.coordinate);
    }
  }
  return result;
}

async function loadLayerTile(
  persistence: RasterMergePersistencePortV1,
  reference: RasterTileReferenceV1 | undefined,
  format: PaintRasterTilePixelFormatV1,
  width: number,
  height: number,
): Promise<Float32Array<ArrayBuffer>> {
  if (reference === undefined) return new Float32Array(width * height * 4);
  return decodeStraightToPremultiplied(
    await persistence.readRasterTile(reference.payloadRef),
    format,
    width,
    height,
  );
}

function rasterizeStrokes(
  pixels: Float32Array<ArrayBuffer>,
  strokes: readonly CompletedPaintStrokeV1[],
  tileX: number,
  tileY: number,
  width: number,
  height: number,
): void {
  for (const entry of strokes) {
    for (const dab of entry.dabs) rasterizeBlackDab(pixels, tileX, tileY, width, height, dab);
  }
}

export async function prepareRasterMergeDownV1(
  snapshot: PaintProjectSnapshotV1,
  sourceLayerId: LayerId,
  persistence: RasterMergePersistencePortV1,
): Promise<PreparedRasterMergeDownV1> {
  const eligibility = rasterMergeDownEligibilityV1(snapshot, sourceLayerId);
  if (!eligibility.eligible || eligibility.targetLayerId === null) {
    throw new Error(eligibility.reason ?? 'merge down is unavailable');
  }
  const source = snapshot.document.layerTree.layers[sourceLayerId] as RasterLayerV1;
  const target = snapshot.document.layerTree.layers[eligibility.targetLayerId] as RasterLayerV1;
  const width = snapshot.document.canvas.width;
  const height = snapshot.document.canvas.height;
  const format = snapshot.document.color.precision;
  const sourceStrokes = unbakedLayerStrokes(snapshot, sourceLayerId);
  const targetStrokes = unbakedLayerStrokes(snapshot, target.id);
  const sourceRefs = indexTileReferences(source);
  const targetRefs = indexTileReferences(target);
  const coordinates = new Map<string, TileCoordinateV1>([
    ...touchedCoordinates(target, targetStrokes, width, height),
    ...touchedCoordinates(source, sourceStrokes, width, height),
  ]);
  const tiles: PreparedRasterMergeTileV1[] = [];
  for (const [key, coordinate] of [...coordinates.entries()].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    const bounds = tileBoundsForDocumentV1(width, height, coordinate);
    const targetPixels = await loadLayerTile(
      persistence,
      targetRefs.get(key),
      format,
      bounds.validWidth,
      bounds.validHeight,
    );
    rasterizeStrokes(
      targetPixels,
      targetStrokes,
      bounds.x,
      bounds.y,
      bounds.validWidth,
      bounds.validHeight,
    );
    const sourcePixels = await loadLayerTile(
      persistence,
      sourceRefs.get(key),
      format,
      bounds.validWidth,
      bounds.validHeight,
    );
    rasterizeStrokes(
      sourcePixels,
      sourceStrokes,
      bounds.x,
      bounds.y,
      bounds.validWidth,
      bounds.validHeight,
    );
    const merged = sourceOver(targetPixels, sourcePixels);
    if (!hasCoverage(merged)) continue;
    const persisted = await persistence.persistRasterTile({
      width: bounds.validWidth,
      height: bounds.validHeight,
      pixelFormat: format,
      bytes: encodePremultipliedToStraight(merged, format),
    });
    tiles.push(
      Object.freeze({ x: coordinate.tx, y: coordinate.ty, payloadRef: persisted.payloadRef }),
    );
  }
  return Object.freeze({
    schema: 'illustro.prepared-raster-merge-down/1' as const,
    sourceLayerId,
    targetLayerId: target.id,
    sourceLayerRevision: source.revision,
    targetLayerRevision: target.revision,
    documentRevision: snapshot.document.revision,
    tiles: Object.freeze(tiles),
  });
}

export function applyPreparedRasterMergeDownV1(
  snapshot: PaintProjectSnapshotV1,
  prepared: PreparedRasterMergeDownV1,
  revisionValue: Revision | number,
  now: Date = new Date(),
): PaintProjectSnapshotV1 {
  const revision = parseRevision(revisionValue);
  const eligibility = rasterMergeDownEligibilityV1(snapshot, prepared.sourceLayerId);
  if (!eligibility.eligible || eligibility.targetLayerId !== prepared.targetLayerId) {
    throw new Error('merge down target changed before commit');
  }
  const source = snapshot.document.layerTree.layers[prepared.sourceLayerId] as RasterLayerV1;
  const target = snapshot.document.layerTree.layers[prepared.targetLayerId] as RasterLayerV1;
  if (
    snapshot.document.revision !== prepared.documentRevision ||
    source.revision !== prepared.sourceLayerRevision ||
    target.revision !== prepared.targetLayerRevision
  ) {
    throw new Error('merge down source changed before commit');
  }
  const mergedTarget = Object.freeze({
    ...target,
    revision,
    tiles: Object.freeze(
      prepared.tiles.map(
        (tile): RasterTileReferenceV1 =>
          Object.freeze({ x: tile.x, y: tile.y, revision, payloadRef: tile.payloadRef }),
      ),
    ),
    boundsHint: null,
  }) as RasterLayerV1;
  const layers = { ...snapshot.document.layerTree.layers };
  delete layers[prepared.sourceLayerId];
  for (const [id, layer] of Object.entries(layers)) {
    if (id === prepared.targetLayerId) continue;
    if (layer.clipping?.baseLayerId === prepared.sourceLayerId) {
      layers[id] = Object.freeze({
        ...layer,
        revision,
        clipping: Object.freeze({ mode: 'alpha' as const, baseLayerId: prepared.targetLayerId }),
      });
    }
  }
  layers[prepared.targetLayerId] = mergedTarget;
  const committedStrokes = snapshot.committedStrokes.map((entry) => {
    if (
      entry.stroke.layerId !== prepared.sourceLayerId &&
      entry.stroke.layerId !== prepared.targetLayerId
    ) {
      return entry;
    }
    return Object.freeze({
      ...entry,
      stroke: Object.freeze({ ...entry.stroke, layerId: prepared.targetLayerId }),
      bakedToRasterLayer: true,
    });
  });
  return Object.freeze({
    schema: 'illustro.paint-project-snapshot/1' as const,
    document: Object.freeze({
      ...snapshot.document,
      revision,
      modifiedAt: now.toISOString(),
      layerTree: Object.freeze({
        rootLayerIds: Object.freeze(
          snapshot.document.layerTree.rootLayerIds.filter((id) => id !== prepared.sourceLayerId),
        ),
        layers: Object.freeze(layers),
      }),
    }),
    committedStrokes: Object.freeze(committedStrokes),
  });
}

export async function prepareRasterMergeVisibleCopyV1(
  snapshot: PaintProjectSnapshotV1,
  outputLayerName: string,
  persistence: RasterMergePersistencePortV1,
): Promise<PreparedRasterMergeVisibleCopyV1> {
  const eligibility = rasterMergeVisibleCopyEligibilityV1(snapshot);
  if (!eligibility.eligible) {
    throw new Error(eligibility.reason ?? 'merge visible copy is unavailable');
  }
  const outputTemplate = createRasterLayer({ name: outputLayerName });
  const width = snapshot.document.canvas.width;
  const height = snapshot.document.canvas.height;
  const format = snapshot.document.color.precision;
  const sourceStates = eligibility.visibleLayerIds.map((layerId) => {
    const layer = snapshot.document.layerTree.layers[layerId];
    if (layer?.type !== 'raster') throw new Error('merge visible copy source changed');
    const raster = layer as RasterLayerV1;
    return Object.freeze({
      layer: raster,
      strokes: unbakedLayerStrokes(snapshot, layerId),
      refs: indexTileReferences(raster),
    });
  });
  const coordinates = new Map<string, TileCoordinateV1>();
  for (const state of sourceStates) {
    for (const [key, coordinate] of touchedCoordinates(state.layer, state.strokes, width, height)) {
      coordinates.set(key, coordinate);
    }
  }
  const tiles: PreparedRasterMergeTileV1[] = [];
  for (const [key, coordinate] of [...coordinates.entries()].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    const bounds = tileBoundsForDocumentV1(width, height, coordinate);
    let composite = new Float32Array(bounds.validWidth * bounds.validHeight * 4);
    for (const state of sourceStates) {
      const layerPixels = await loadLayerTile(
        persistence,
        state.refs.get(key),
        format,
        bounds.validWidth,
        bounds.validHeight,
      );
      rasterizeStrokes(
        layerPixels,
        state.strokes,
        bounds.x,
        bounds.y,
        bounds.validWidth,
        bounds.validHeight,
      );
      composite = sourceOver(composite, layerPixels);
    }
    if (!hasCoverage(composite)) continue;
    const persisted = await persistence.persistRasterTile({
      width: bounds.validWidth,
      height: bounds.validHeight,
      pixelFormat: format,
      bytes: encodePremultipliedToStraight(composite, format),
    });
    tiles.push(
      Object.freeze({ x: coordinate.tx, y: coordinate.ty, payloadRef: persisted.payloadRef }),
    );
  }
  return Object.freeze({
    schema: 'illustro.prepared-raster-merge-visible-copy/1' as const,
    outputLayerId: outputTemplate.id,
    outputLayerName: outputTemplate.name,
    documentRevision: snapshot.document.revision,
    sourceLayers: Object.freeze(
      sourceStates.map((state) =>
        Object.freeze({ layerId: state.layer.id, revision: state.layer.revision }),
      ),
    ),
    tiles: Object.freeze(tiles),
  });
}

export function applyPreparedRasterMergeVisibleCopyV1(
  snapshot: PaintProjectSnapshotV1,
  prepared: PreparedRasterMergeVisibleCopyV1,
  revisionValue: Revision | number,
  now: Date = new Date(),
): PaintProjectSnapshotV1 {
  const revision = parseRevision(revisionValue);
  if (snapshot.document.revision !== prepared.documentRevision) {
    throw new Error('merge visible copy document changed before commit');
  }
  if (prepared.outputLayerId in snapshot.document.layerTree.layers) {
    throw new Error('merge visible copy output layer identity already exists');
  }
  const eligibility = rasterMergeVisibleCopyEligibilityV1(snapshot);
  if (!eligibility.eligible) {
    throw new Error(eligibility.reason ?? 'merge visible copy is unavailable');
  }
  if (
    eligibility.visibleLayerIds.length !== prepared.sourceLayers.length ||
    eligibility.visibleLayerIds.some(
      (layerId, index) => layerId !== prepared.sourceLayers[index]?.layerId,
    )
  ) {
    throw new Error('merge visible copy source set changed before commit');
  }
  for (const source of prepared.sourceLayers) {
    const layer = snapshot.document.layerTree.layers[source.layerId];
    if (layer?.type !== 'raster' || layer.revision !== source.revision) {
      throw new Error('merge visible copy source changed before commit');
    }
  }
  const outputLayer = Object.freeze({
    ...createRasterLayer({ id: prepared.outputLayerId, name: prepared.outputLayerName }),
    revision,
    tiles: Object.freeze(
      prepared.tiles.map(
        (tile): RasterTileReferenceV1 =>
          Object.freeze({ x: tile.x, y: tile.y, revision, payloadRef: tile.payloadRef }),
      ),
    ),
    boundsHint: null,
  }) as RasterLayerV1;
  return Object.freeze({
    schema: 'illustro.paint-project-snapshot/1' as const,
    document: Object.freeze({
      ...snapshot.document,
      revision,
      modifiedAt: now.toISOString(),
      layerTree: Object.freeze({
        rootLayerIds: Object.freeze([
          ...snapshot.document.layerTree.rootLayerIds,
          prepared.outputLayerId,
        ]),
        layers: Object.freeze({
          ...snapshot.document.layerTree.layers,
          [prepared.outputLayerId]: outputLayer,
        }),
      }),
    }),
    committedStrokes: snapshot.committedStrokes,
  });
}
