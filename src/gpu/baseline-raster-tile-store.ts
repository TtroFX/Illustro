import type { DocumentPrecision } from '../domain/document.js';
import type { BlendModeId } from '../domain/layers.js';
import {
  baselineDabRadiusXV1,
  baselineDabRadiusYV1,
  planBaselineBrushTilesV1,
  type BaselineBrushDabV1,
} from './baseline-brush.js';
import { compositeBlendRgbaV1, isM5cBaseBlendModeV1 } from './blend-modes.js';
import { tileBoundsForDocumentV1, tileKeyV1, type TileCoordinateV1 } from './sparse-tile-model.js';

export interface BaselineRasterLayerDescriptorV1 {
  readonly layerId: string;
  readonly visible: boolean;
  readonly opacity: number;
  readonly draft?: boolean;
  readonly blendMode?: BlendModeId;
}

export interface BaselineRasterTileImageV1 {
  readonly schema: 'illustro.baseline-raster-tile/1';
  readonly layerId: string;
  readonly coordinate: TileCoordinateV1;
  readonly width: number;
  readonly height: number;
  readonly pixelFormat: DocumentPrecision;
  readonly bytes: Uint8Array<ArrayBuffer>;
}

export interface BaselineRasterTilePatchV1 {
  readonly schema: 'illustro.baseline-raster-tile-patch/1';
  readonly layerId: string;
  readonly coordinate: TileCoordinateV1;
  readonly before: BaselineRasterTileImageV1 | null;
  readonly after: BaselineRasterTileImageV1 | null;
}

export type BaselineRasterTilePatchDirectionV1 = 'before' | 'after';

interface ActiveTileTransactionV1 {
  readonly strokeId: string;
  readonly layerId: string;
  readonly before: Map<string, BaselineRasterTileImageV1 | null>;
  readonly affected: Map<string, TileCoordinateV1>;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
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

function halfToFloat(value: number): number {
  const sign = (value & 0x8000) !== 0 ? -1 : 1;
  const exponent = (value >>> 10) & 0x1f;
  const fraction = value & 0x03ff;
  if (exponent === 0) return sign * 2 ** -14 * (fraction / 1024);
  if (exponent === 0x1f) return fraction === 0 ? sign * Number.POSITIVE_INFINITY : Number.NaN;
  return sign * 2 ** (exponent - 15) * (1 + fraction / 1024);
}

function bytesPerPixel(format: DocumentPrecision): number {
  return format === 'rgba8-unorm' ? 4 : 8;
}

function ownedBytes(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  const owned = new Uint8Array(bytes.byteLength);
  owned.set(bytes);
  return owned;
}

function freezeCoordinate(coordinate: TileCoordinateV1): TileCoordinateV1 {
  return Object.freeze({ tx: coordinate.tx, ty: coordinate.ty });
}

function tileStateKey(layerId: string, coordinate: TileCoordinateV1): string {
  if (layerId.length === 0) throw new TypeError('raster tile layerId must not be empty');
  return `${layerId}/${tileKeyV1(coordinate)}`;
}

function validateTileImage(
  image: BaselineRasterTileImageV1,
  documentWidth: number,
  documentHeight: number,
  pixelFormat: DocumentPrecision,
): void {
  if (image.schema !== 'illustro.baseline-raster-tile/1' || image.layerId.length === 0) {
    throw new TypeError('invalid baseline raster tile identity');
  }
  const bounds = tileBoundsForDocumentV1(documentWidth, documentHeight, image.coordinate);
  if (
    image.pixelFormat !== pixelFormat ||
    image.width !== bounds.validWidth ||
    image.height !== bounds.validHeight ||
    image.bytes.byteLength !== image.width * image.height * bytesPerPixel(pixelFormat)
  ) {
    throw new Error('baseline raster tile violates the document tile contract');
  }
}

function cloneTile(
  image: BaselineRasterTileImageV1,
  layerId: string = image.layerId,
): BaselineRasterTileImageV1 {
  return Object.freeze({
    schema: 'illustro.baseline-raster-tile/1' as const,
    layerId,
    coordinate: freezeCoordinate(image.coordinate),
    width: image.width,
    height: image.height,
    pixelFormat: image.pixelFormat,
    bytes: ownedBytes(image.bytes),
  });
}

function createTransparentTile(
  layerId: string,
  coordinate: TileCoordinateV1,
  documentWidth: number,
  documentHeight: number,
  pixelFormat: DocumentPrecision,
): BaselineRasterTileImageV1 {
  const bounds = tileBoundsForDocumentV1(documentWidth, documentHeight, coordinate);
  return Object.freeze({
    schema: 'illustro.baseline-raster-tile/1' as const,
    layerId,
    coordinate: freezeCoordinate(coordinate),
    width: bounds.validWidth,
    height: bounds.validHeight,
    pixelFormat,
    bytes: new Uint8Array(bounds.validWidth * bounds.validHeight * bytesPerPixel(pixelFormat)),
  });
}

function readPixel(
  image: BaselineRasterTileImageV1,
  pixel: number,
): [number, number, number, number] {
  if (image.pixelFormat === 'rgba8-unorm') {
    const offset = pixel * 4;
    return [
      (image.bytes[offset] ?? 0) / 255,
      (image.bytes[offset + 1] ?? 0) / 255,
      (image.bytes[offset + 2] ?? 0) / 255,
      (image.bytes[offset + 3] ?? 0) / 255,
    ];
  }
  const offset = pixel * 8;
  const view = new DataView(image.bytes.buffer, image.bytes.byteOffset, image.bytes.byteLength);
  return [
    clamp01(halfToFloat(view.getUint16(offset, true))),
    clamp01(halfToFloat(view.getUint16(offset + 2, true))),
    clamp01(halfToFloat(view.getUint16(offset + 4, true))),
    clamp01(halfToFloat(view.getUint16(offset + 6, true))),
  ];
}

function writePixel(
  image: BaselineRasterTileImageV1,
  pixel: number,
  rgba: readonly [number, number, number, number],
): void {
  if (image.pixelFormat === 'rgba8-unorm') {
    const offset = pixel * 4;
    image.bytes[offset] = Math.round(clamp01(rgba[0]) * 255);
    image.bytes[offset + 1] = Math.round(clamp01(rgba[1]) * 255);
    image.bytes[offset + 2] = Math.round(clamp01(rgba[2]) * 255);
    image.bytes[offset + 3] = Math.round(clamp01(rgba[3]) * 255);
    return;
  }
  const offset = pixel * 8;
  const view = new DataView(image.bytes.buffer, image.bytes.byteOffset, image.bytes.byteLength);
  view.setUint16(offset, floatToHalf(rgba[0]), true);
  view.setUint16(offset + 2, floatToHalf(rgba[1]), true);
  view.setUint16(offset + 4, floatToHalf(rgba[2]), true);
  view.setUint16(offset + 6, floatToHalf(rgba[3]), true);
}

const BASELINE_BRUSH_HARDNESS = 0.85;
const BASELINE_BRUSH_HARDNESS_SQUARED = BASELINE_BRUSH_HARDNESS * BASELINE_BRUSH_HARDNESS;

function rasterizeBlackDab(
  tile: BaselineRasterTileImageV1,
  tileX: number,
  tileY: number,
  dab: BaselineBrushDabV1,
): void {
  const radiusX = baselineDabRadiusXV1(dab);
  const radiusY = baselineDabRadiusYV1(dab);
  const minX = Math.max(tileX, Math.floor(dab.x - radiusX));
  const minY = Math.max(tileY, Math.floor(dab.y - radiusY));
  const maxX = Math.min(tileX + tile.width - 1, Math.ceil(dab.x + radiusX) - 1);
  const maxY = Math.min(tileY + tile.height - 1, Math.ceil(dab.y + radiusY) - 1);
  const opacity = clamp01(dab.opacity);

  if (tile.pixelFormat === 'rgba8-unorm') {
    const bytes = tile.bytes;
    for (let documentY = minY; documentY <= maxY; documentY += 1) {
      const localY = (documentY + 0.5 - dab.y) / radiusY;
      const localYSquared = localY * localY;
      if (localYSquared >= 1) continue;
      for (let documentX = minX; documentX <= maxX; documentX += 1) {
        const localX = (documentX + 0.5 - dab.x) / radiusX;
        const distanceSquared = localX * localX + localYSquared;
        if (distanceSquared >= 1) continue;
        const sourceAlpha =
          distanceSquared <= BASELINE_BRUSH_HARDNESS_SQUARED
            ? opacity
            : clamp01(
                opacity * (1 - smoothstep(BASELINE_BRUSH_HARDNESS, 1, Math.sqrt(distanceSquared))),
              );
        if (sourceAlpha <= 0) continue;

        const pixelOffset = ((documentY - tileY) * tile.width + (documentX - tileX)) * 4;
        const destinationAlpha = (bytes[pixelOffset + 3] ?? 0) / 255;
        const inverseSourceAlpha = 1 - sourceAlpha;
        const outputAlpha = sourceAlpha + destinationAlpha * inverseSourceAlpha;
        const destinationScale =
          outputAlpha > 0 ? (destinationAlpha * inverseSourceAlpha) / outputAlpha : 0;
        bytes[pixelOffset] = Math.round((bytes[pixelOffset] ?? 0) * destinationScale);
        bytes[pixelOffset + 1] = Math.round((bytes[pixelOffset + 1] ?? 0) * destinationScale);
        bytes[pixelOffset + 2] = Math.round((bytes[pixelOffset + 2] ?? 0) * destinationScale);
        bytes[pixelOffset + 3] = Math.round(outputAlpha * 255);
      }
    }
    return;
  }

  for (let documentY = minY; documentY <= maxY; documentY += 1) {
    const localY = (documentY + 0.5 - dab.y) / radiusY;
    const localYSquared = localY * localY;
    if (localYSquared >= 1) continue;
    for (let documentX = minX; documentX <= maxX; documentX += 1) {
      const localX = (documentX + 0.5 - dab.x) / radiusX;
      const distanceSquared = localX * localX + localYSquared;
      if (distanceSquared >= 1) continue;
      const sourceAlpha =
        distanceSquared <= BASELINE_BRUSH_HARDNESS_SQUARED
          ? opacity
          : clamp01(
              opacity * (1 - smoothstep(BASELINE_BRUSH_HARDNESS, 1, Math.sqrt(distanceSquared))),
            );
      if (sourceAlpha <= 0) continue;
      const pixel = (documentY - tileY) * tile.width + (documentX - tileX);
      const destination = readPixel(tile, pixel);
      const destinationAlpha = destination[3];
      const outputAlpha = sourceAlpha + destinationAlpha * (1 - sourceAlpha);
      const scale = outputAlpha > 0 ? (destinationAlpha * (1 - sourceAlpha)) / outputAlpha : 0;
      writePixel(tile, pixel, [
        destination[0] * scale,
        destination[1] * scale,
        destination[2] * scale,
        outputAlpha,
      ]);
    }
  }
}

function isTransparent(image: BaselineRasterTileImageV1): boolean {
  const alphaStride = image.pixelFormat === 'rgba8-unorm' ? 4 : 8;
  const alphaOffset = image.pixelFormat === 'rgba8-unorm' ? 3 : 6;
  for (let offset = alphaOffset; offset < image.bytes.byteLength; offset += alphaStride) {
    if (
      (image.bytes[offset] ?? 0) !== 0 ||
      (alphaStride === 8 && (image.bytes[offset + 1] ?? 0) !== 0)
    ) {
      return false;
    }
  }
  return true;
}

export class BaselineRasterTileStoreV1 {
  readonly #documentWidth: number;
  readonly #documentHeight: number;
  readonly #pixelFormat: DocumentPrecision;
  readonly #tiles = new Map<string, BaselineRasterTileImageV1>();
  readonly #compositeCache = new Map<string, BaselineRasterTileImageV1>();
  #layers: readonly BaselineRasterLayerDescriptorV1[];
  #active: ActiveTileTransactionV1 | null = null;

  constructor(
    documentWidth: number,
    documentHeight: number,
    pixelFormat: DocumentPrecision,
    layers: readonly BaselineRasterLayerDescriptorV1[] = [],
  ) {
    tileBoundsForDocumentV1(documentWidth, documentHeight, { tx: 0, ty: 0 });
    this.#documentWidth = documentWidth;
    this.#documentHeight = documentHeight;
    this.#pixelFormat = pixelFormat;
    this.#layers = this.#normalizeLayers(layers);
  }

  get pixelFormat(): DocumentPrecision {
    return this.#pixelFormat;
  }

  setLayers(layers: readonly BaselineRasterLayerDescriptorV1[]): void {
    this.#layers = this.#normalizeLayers(layers);
    this.#compositeCache.clear();
  }

  applyDabs(layerId: string, strokeId: string, dabs: readonly BaselineBrushDabV1[]): void {
    if (strokeId.length === 0) throw new TypeError('tile transaction strokeId must not be empty');
    if (this.#active !== null && this.#active.strokeId !== strokeId) {
      throw new Error('another baseline raster tile transaction is active');
    }
    if (this.#active === null) {
      this.#active = {
        strokeId,
        layerId,
        before: new Map(),
        affected: new Map(),
      };
    }
    if (this.#active.layerId !== layerId) throw new Error('active stroke changed raster layer');

    for (const plan of planBaselineBrushTilesV1(dabs, this.#documentWidth, this.#documentHeight)) {
      const coordinateKey = tileKeyV1(plan.coordinate);
      this.#compositeCache.delete(coordinateKey);
      const key = tileStateKey(layerId, plan.coordinate);
      if (!this.#active.before.has(key)) {
        const current = this.#tiles.get(key);
        this.#active.before.set(key, current === undefined ? null : cloneTile(current));
        this.#active.affected.set(key, freezeCoordinate(plan.coordinate));
      }
      let tile = this.#tiles.get(key);
      if (tile === undefined) {
        tile = createTransparentTile(
          layerId,
          plan.coordinate,
          this.#documentWidth,
          this.#documentHeight,
          this.#pixelFormat,
        );
        this.#tiles.set(key, tile);
      }
      const bounds = tileBoundsForDocumentV1(
        this.#documentWidth,
        this.#documentHeight,
        plan.coordinate,
      );
      for (const dab of plan.dabs) rasterizeBlackDab(tile, bounds.x, bounds.y, dab);
    }
  }

  finalize(strokeId: string): readonly BaselineRasterTilePatchV1[] {
    const active = this.#active;
    if (active === null || active.strokeId !== strokeId) {
      throw new Error('baseline raster tile finalization has no matching active stroke');
    }
    const patches = [...active.affected.entries()].map(([key, coordinate]) => {
      const before = active.before.get(key) ?? null;
      const current = this.#tiles.get(key);
      const after = current === undefined || isTransparent(current) ? null : cloneTile(current);
      if (after === null) this.#tiles.delete(key);
      return Object.freeze({
        schema: 'illustro.baseline-raster-tile-patch/1' as const,
        layerId: active.layerId,
        coordinate,
        before,
        after,
      });
    });
    this.#active = null;
    return Object.freeze(patches);
  }

  cancel(strokeId: string): readonly BaselineRasterTilePatchV1[] {
    const active = this.#active;
    if (active === null || active.strokeId !== strokeId) return Object.freeze([]);
    const patches = [...active.affected.entries()].map(([key, coordinate]) => {
      const provisional = this.#tiles.get(key);
      const before = active.before.get(key) ?? null;
      if (before === null) this.#tiles.delete(key);
      else this.#tiles.set(key, cloneTile(before));
      this.#compositeCache.delete(tileKeyV1(coordinate));
      return Object.freeze({
        schema: 'illustro.baseline-raster-tile-patch/1' as const,
        layerId: active.layerId,
        coordinate,
        before: provisional === undefined ? null : cloneTile(provisional),
        after: before === null ? null : cloneTile(before),
      });
    });
    this.#active = null;
    return Object.freeze(patches);
  }

  applyPatches(
    patches: readonly BaselineRasterTilePatchV1[],
    direction: BaselineRasterTilePatchDirectionV1,
  ): readonly TileCoordinateV1[] {
    const affected = new Map<string, TileCoordinateV1>();
    for (const patch of patches) {
      const selected = direction === 'before' ? patch.before : patch.after;
      const key = tileStateKey(patch.layerId, patch.coordinate);
      if (selected === null) this.#tiles.delete(key);
      else {
        validateTileImage(selected, this.#documentWidth, this.#documentHeight, this.#pixelFormat);
        this.#tiles.set(key, cloneTile(selected));
      }
      const coordinateKey = tileKeyV1(patch.coordinate);
      this.#compositeCache.delete(coordinateKey);
      affected.set(coordinateKey, freezeCoordinate(patch.coordinate));
    }
    return Object.freeze([...affected.values()]);
  }

  restore(tiles: readonly BaselineRasterTileImageV1[]): void {
    this.#tiles.clear();
    this.#compositeCache.clear();
    this.#active = null;
    for (const tile of tiles) {
      validateTileImage(tile, this.#documentWidth, this.#documentHeight, this.#pixelFormat);
      if (!isTransparent(tile))
        this.#tiles.set(tileStateKey(tile.layerId, tile.coordinate), cloneTile(tile));
    }
  }

  exportTiles(): readonly BaselineRasterTileImageV1[] {
    return Object.freeze([...this.#tiles.values()].map((tile) => cloneTile(tile)));
  }

  compositeTiles(
    coordinates?: readonly TileCoordinateV1[],
    options: { readonly includeDraft?: boolean } = {},
  ): readonly BaselineRasterTileImageV1[] {
    const selected = new Map<string, TileCoordinateV1>();
    if (coordinates === undefined) {
      for (const tile of this.#tiles.values()) {
        selected.set(tileKeyV1(tile.coordinate), tile.coordinate);
      }
    } else {
      for (const coordinate of coordinates) selected.set(tileKeyV1(coordinate), coordinate);
    }
    const includeDraft = options.includeDraft !== false;
    const visibleLayers = this.#layers.filter(
      (layer) => layer.visible && layer.opacity > 0 && (includeDraft || layer.draft !== true),
    );
    const result: BaselineRasterTileImageV1[] = [];
    for (const [key, coordinate] of selected) {
      let composite = includeDraft ? this.#compositeCache.get(key) : undefined;
      if (composite === undefined) {
        composite = this.#composeCoordinate(coordinate, visibleLayers);
        if (includeDraft) this.#compositeCache.set(key, composite);
      }
      result.push(cloneTile(composite));
    }
    return Object.freeze(result);
  }

  #composeCoordinate(
    coordinate: TileCoordinateV1,
    visibleLayers: readonly BaselineRasterLayerDescriptorV1[],
  ): BaselineRasterTileImageV1 {
    if (visibleLayers.length === 1 && visibleLayers[0]?.opacity === 1) {
      const source = this.#tiles.get(tileStateKey(visibleLayers[0].layerId, coordinate));
      if (source === undefined) {
        return createTransparentTile(
          '__composite__',
          coordinate,
          this.#documentWidth,
          this.#documentHeight,
          this.#pixelFormat,
        );
      }
      if (source.pixelFormat === 'rgba8-unorm') {
        const output = cloneTile(source, '__composite__');
        for (let alphaOffset = 3; alphaOffset < output.bytes.byteLength; alphaOffset += 4) {
          if ((output.bytes[alphaOffset] ?? 0) !== 0) continue;
          output.bytes[alphaOffset - 3] = 0;
          output.bytes[alphaOffset - 2] = 0;
          output.bytes[alphaOffset - 1] = 0;
        }
        return output;
      }
    }

    const output = createTransparentTile(
      '__composite__',
      coordinate,
      this.#documentWidth,
      this.#documentHeight,
      this.#pixelFormat,
    );
    for (const layer of visibleLayers) {
      const source = this.#tiles.get(tileStateKey(layer.layerId, coordinate));
      if (source === undefined) continue;
      for (let pixel = 0; pixel < output.width * output.height; pixel += 1) {
        const sourcePixel = readPixel(source, pixel);
        const destination = readPixel(output, pixel);
        const blendMode = layer.blendMode ?? 'normal';
        if (!isM5cBaseBlendModeV1(blendMode)) {
          throw new Error(`unsupported baseline blend mode: ${blendMode}`);
        }
        writePixel(
          output,
          pixel,
          compositeBlendRgbaV1(destination, sourcePixel, layer.opacity, blendMode),
        );
      }
    }
    return output;
  }

  #normalizeLayers(
    layers: readonly BaselineRasterLayerDescriptorV1[],
  ): readonly BaselineRasterLayerDescriptorV1[] {
    const seen = new Set<string>();
    return Object.freeze(
      layers.map((layer) => {
        if (layer.layerId.length === 0 || seen.has(layer.layerId)) {
          throw new TypeError('baseline raster layer IDs must be unique and non-empty');
        }
        if (!Number.isFinite(layer.opacity) || layer.opacity < 0 || layer.opacity > 1) {
          throw new RangeError('baseline raster layer opacity must be between 0 and 1');
        }
        const blendMode = layer.blendMode ?? 'normal';
        if (!isM5cBaseBlendModeV1(blendMode)) {
          throw new Error(`unsupported baseline blend mode: ${blendMode}`);
        }
        seen.add(layer.layerId);
        return Object.freeze({
          layerId: layer.layerId,
          visible: layer.visible,
          opacity: layer.opacity,
          draft: layer.draft ?? false,
          ...(blendMode === 'normal' ? {} : { blendMode }),
        });
      }),
    );
  }
}
