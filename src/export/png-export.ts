import type { CanvasBackgroundSpec, DocumentV1 } from '../domain/document.js';
import {
  baselineDabRadiusXV1,
  baselineDabRadiusYV1,
  type BaselineBrushDabV1,
} from '../gpu/baseline-brush.js';
import type { BaselineRasterTileImageV1 } from '../gpu/baseline-raster-tile-store.js';
import {
  CANONICAL_TILE_SIZE_PX,
  tileBoundsForDocumentV1,
  type TileCoordinateV1,
} from '../gpu/sparse-tile-model.js';
import type { PaintProjectSnapshotV1 } from '../app/paint-session-controller.js';

export const PNG_MIME_TYPE = 'image/png' as const;
export const PNG_FLATTEN_TILE_SIZE_PX = 256 as const;
export const PNG_SIGNATURE = Object.freeze([137, 80, 78, 71, 13, 10, 26, 10] as const);

export interface BaselinePaintFlattenTileV1 {
  readonly schema: 'illustro.baseline-paint-flatten-tile/1';
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly rgba: Uint8ClampedArray<ArrayBuffer>;
}

export interface PngRasterSurfaceV1 {
  putTile(tile: BaselinePaintFlattenTileV1): void;
  encode(): Promise<Blob>;
  dispose(): void;
}

export type PngRasterSurfaceFactoryV1 = (width: number, height: number) => PngRasterSurfaceV1;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function validateDab(dab: BaselineBrushDabV1): void {
  if (
    dab.schema !== 'illustro.baseline-brush-dab/1' ||
    !Number.isFinite(dab.x) ||
    !Number.isFinite(dab.y) ||
    !Number.isFinite(dab.radius) ||
    dab.radius <= 0 ||
    !Number.isFinite(baselineDabRadiusXV1(dab)) ||
    baselineDabRadiusXV1(dab) <= 0 ||
    !Number.isFinite(baselineDabRadiusYV1(dab)) ||
    baselineDabRadiusYV1(dab) <= 0 ||
    !Number.isFinite(dab.opacity) ||
    dab.opacity < 0 ||
    dab.opacity > 1
  ) {
    throw new RangeError('invalid baseline dab for PNG flatten');
  }
}

function backgroundPremultiplied(
  background: CanvasBackgroundSpec,
): readonly [number, number, number, number] {
  if (background.kind === 'transparent') return Object.freeze([0, 0, 0, 0]);
  const [red, green, blue, alpha] = background.rgba;
  for (const component of background.rgba) {
    if (!Number.isFinite(component) || component < 0 || component > 1) {
      throw new RangeError('invalid canvas background color for PNG flatten');
    }
  }
  return Object.freeze([red * alpha, green * alpha, blue * alpha, alpha]);
}

function dabIntersectsTile(
  dab: BaselineBrushDabV1,
  tileX: number,
  tileY: number,
  tileWidth: number,
  tileHeight: number,
): boolean {
  const radiusX = baselineDabRadiusXV1(dab);
  const radiusY = baselineDabRadiusYV1(dab);
  return (
    dab.x + radiusX > tileX &&
    dab.y + radiusY > tileY &&
    dab.x - radiusX < tileX + tileWidth &&
    dab.y - radiusY < tileY + tileHeight
  );
}

function rasterizeBlackDab(
  premultiplied: Float32Array<ArrayBuffer>,
  tileX: number,
  tileY: number,
  tileWidth: number,
  tileHeight: number,
  dab: BaselineBrushDabV1,
): void {
  validateDab(dab);
  const radiusX = baselineDabRadiusXV1(dab);
  const radiusY = baselineDabRadiusYV1(dab);
  const minX = Math.max(tileX, Math.floor(dab.x - radiusX));
  const minY = Math.max(tileY, Math.floor(dab.y - radiusY));
  const maxX = Math.min(tileX + tileWidth - 1, Math.ceil(dab.x + radiusX) - 1);
  const maxY = Math.min(tileY + tileHeight - 1, Math.ceil(dab.y + radiusY) - 1);
  if (maxX < minX || maxY < minY) return;

  for (let documentY = minY; documentY <= maxY; documentY += 1) {
    const localY = (documentY + 0.5 - dab.y) / radiusY;
    for (let documentX = minX; documentX <= maxX; documentX += 1) {
      const localX = (documentX + 0.5 - dab.x) / radiusX;
      const radialDistance = Math.hypot(localX, localY);
      if (radialDistance >= 1) continue;
      const coverage = 1 - smoothstep(0.85, 1, radialDistance);
      const sourceAlpha = clamp01(dab.opacity * coverage);
      if (sourceAlpha <= 0) continue;
      const offset = ((documentY - tileY) * tileWidth + (documentX - tileX)) * 4;
      const destinationScale = 1 - sourceAlpha;
      premultiplied[offset] = (premultiplied[offset] ?? 0) * destinationScale;
      premultiplied[offset + 1] = (premultiplied[offset + 1] ?? 0) * destinationScale;
      premultiplied[offset + 2] = (premultiplied[offset + 2] ?? 0) * destinationScale;
      premultiplied[offset + 3] = sourceAlpha + (premultiplied[offset + 3] ?? 0) * destinationScale;
    }
  }
}

function encodeStraightRgba(
  premultiplied: Float32Array<ArrayBuffer>,
): Uint8ClampedArray<ArrayBuffer> {
  const rgba = new Uint8ClampedArray(premultiplied.length);
  for (let offset = 0; offset < premultiplied.length; offset += 4) {
    const alpha = clamp01(premultiplied[offset + 3] ?? 0);
    const inverseAlpha = alpha > 0 ? 1 / alpha : 0;
    rgba[offset] = Math.round(clamp01((premultiplied[offset] ?? 0) * inverseAlpha) * 255);
    rgba[offset + 1] = Math.round(clamp01((premultiplied[offset + 1] ?? 0) * inverseAlpha) * 255);
    rgba[offset + 2] = Math.round(clamp01((premultiplied[offset + 2] ?? 0) * inverseAlpha) * 255);
    rgba[offset + 3] = Math.round(alpha * 255);
  }
  return rgba;
}

function halfToFloat(value: number): number {
  const sign = (value & 0x8000) !== 0 ? -1 : 1;
  const exponent = (value >>> 10) & 0x1f;
  const fraction = value & 0x03ff;
  if (exponent === 0) return sign * 2 ** -14 * (fraction / 1024);
  if (exponent === 0x1f) return fraction === 0 ? sign * Number.POSITIVE_INFINITY : Number.NaN;
  return sign * 2 ** (exponent - 15) * (1 + fraction / 1024);
}

function readRasterTilePixel(
  tile: BaselineRasterTileImageV1,
  pixel: number,
): readonly [number, number, number, number] {
  if (tile.pixelFormat === 'rgba8-unorm') {
    const offset = pixel * 4;
    return [
      (tile.bytes[offset] ?? 0) / 255,
      (tile.bytes[offset + 1] ?? 0) / 255,
      (tile.bytes[offset + 2] ?? 0) / 255,
      (tile.bytes[offset + 3] ?? 0) / 255,
    ];
  }
  const offset = pixel * 8;
  const view = new DataView(tile.bytes.buffer, tile.bytes.byteOffset, tile.bytes.byteLength);
  return [
    clamp01(halfToFloat(view.getUint16(offset, true))),
    clamp01(halfToFloat(view.getUint16(offset + 2, true))),
    clamp01(halfToFloat(view.getUint16(offset + 4, true))),
    clamp01(halfToFloat(view.getUint16(offset + 6, true))),
  ];
}

export function flattenCompositeRasterTileV1(
  documentValue: DocumentV1,
  coordinate: TileCoordinateV1,
  tile: BaselineRasterTileImageV1 | null,
): BaselinePaintFlattenTileV1 {
  const bounds = tileBoundsForDocumentV1(
    documentValue.canvas.width,
    documentValue.canvas.height,
    coordinate,
  );
  if (tile !== null) {
    const expectedByteLength =
      bounds.validWidth * bounds.validHeight * (tile.pixelFormat === 'rgba8-unorm' ? 4 : 8);
    if (
      tile.coordinate.tx !== coordinate.tx ||
      tile.coordinate.ty !== coordinate.ty ||
      tile.width !== bounds.validWidth ||
      tile.height !== bounds.validHeight ||
      tile.pixelFormat !== documentValue.color.precision ||
      tile.bytes.byteLength !== expectedByteLength
    ) {
      throw new Error('PNG composite tile violates the document tile contract');
    }
  }

  const premultiplied = new Float32Array(bounds.validWidth * bounds.validHeight * 4);
  const background = backgroundPremultiplied(documentValue.canvas.background);
  for (let pixel = 0; pixel < bounds.validWidth * bounds.validHeight; pixel += 1) {
    const offset = pixel * 4;
    if (tile === null) {
      premultiplied[offset] = background[0];
      premultiplied[offset + 1] = background[1];
      premultiplied[offset + 2] = background[2];
      premultiplied[offset + 3] = background[3];
      continue;
    }
    const source = readRasterTilePixel(tile, pixel);
    const sourceAlpha = source[3];
    const destinationScale = 1 - sourceAlpha;
    premultiplied[offset] = source[0] * sourceAlpha + background[0] * destinationScale;
    premultiplied[offset + 1] = source[1] * sourceAlpha + background[1] * destinationScale;
    premultiplied[offset + 2] = source[2] * sourceAlpha + background[2] * destinationScale;
    premultiplied[offset + 3] = sourceAlpha + background[3] * destinationScale;
  }
  return Object.freeze({
    schema: 'illustro.baseline-paint-flatten-tile/1' as const,
    x: bounds.x,
    y: bounds.y,
    width: bounds.validWidth,
    height: bounds.validHeight,
    rgba: encodeStraightRgba(premultiplied),
  });
}

export function* iterateCompositeRasterFlattenTilesV1(
  documentValue: DocumentV1,
  tiles: readonly BaselineRasterTileImageV1[],
): Generator<BaselinePaintFlattenTileV1, void, void> {
  const byCoordinate = new Map<string, BaselineRasterTileImageV1>();
  for (const tile of tiles) {
    const key = `${tile.coordinate.tx}:${tile.coordinate.ty}`;
    if (byCoordinate.has(key)) throw new Error(`duplicate PNG composite tile: ${key}`);
    byCoordinate.set(key, tile);
  }
  const tileColumns = Math.ceil(documentValue.canvas.width / CANONICAL_TILE_SIZE_PX);
  const tileRows = Math.ceil(documentValue.canvas.height / CANONICAL_TILE_SIZE_PX);
  for (let ty = 0; ty < tileRows; ty += 1) {
    for (let tx = 0; tx < tileColumns; tx += 1) {
      const coordinate = Object.freeze({ tx, ty });
      yield flattenCompositeRasterTileV1(
        documentValue,
        coordinate,
        byCoordinate.get(`${tx}:${ty}`) ?? null,
      );
    }
  }
}

export function flattenBaselinePaintTileV1(
  snapshot: PaintProjectSnapshotV1,
  input: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  },
): BaselinePaintFlattenTileV1 {
  const documentWidth = snapshot.document.canvas.width;
  const documentHeight = snapshot.document.canvas.height;
  if (
    !Number.isSafeInteger(input.x) ||
    !Number.isSafeInteger(input.y) ||
    !Number.isSafeInteger(input.width) ||
    !Number.isSafeInteger(input.height) ||
    input.x < 0 ||
    input.y < 0 ||
    input.width < 1 ||
    input.height < 1 ||
    input.x + input.width > documentWidth ||
    input.y + input.height > documentHeight
  ) {
    throw new RangeError('PNG flatten tile must lie inside the document');
  }
  const pixelCount = input.width * input.height;
  if (!Number.isSafeInteger(pixelCount) || pixelCount > Number.MAX_SAFE_INTEGER / 4) {
    throw new RangeError('PNG flatten tile is too large');
  }
  const premultiplied = new Float32Array(pixelCount * 4);
  const background = backgroundPremultiplied(snapshot.document.canvas.background);
  for (let offset = 0; offset < premultiplied.length; offset += 4) {
    premultiplied[offset] = background[0];
    premultiplied[offset + 1] = background[1];
    premultiplied[offset + 2] = background[2];
    premultiplied[offset + 3] = background[3];
  }

  for (const completed of snapshot.committedStrokes) {
    for (const dab of completed.dabs) {
      if (dabIntersectsTile(dab, input.x, input.y, input.width, input.height)) {
        rasterizeBlackDab(premultiplied, input.x, input.y, input.width, input.height, dab);
      }
    }
  }

  return Object.freeze({
    schema: 'illustro.baseline-paint-flatten-tile/1' as const,
    x: input.x,
    y: input.y,
    width: input.width,
    height: input.height,
    rgba: encodeStraightRgba(premultiplied),
  });
}

export function* iterateBaselinePaintFlattenTilesV1(
  snapshot: PaintProjectSnapshotV1,
  tileSize = PNG_FLATTEN_TILE_SIZE_PX,
): Generator<BaselinePaintFlattenTileV1, void, void> {
  if (!Number.isSafeInteger(tileSize) || tileSize < 1) {
    throw new RangeError('PNG flatten tile size must be a positive safe integer');
  }
  const width = snapshot.document.canvas.width;
  const height = snapshot.document.canvas.height;
  for (let y = 0; y < height; y += tileSize) {
    for (let x = 0; x < width; x += tileSize) {
      yield flattenBaselinePaintTileV1(snapshot, {
        x,
        y,
        width: Math.min(tileSize, width - x),
        height: Math.min(tileSize, height - y),
      });
    }
  }
}

function createBrowserPngSurface(width: number, height: number): PngRasterSurfaceV1 {
  if (typeof OffscreenCanvas === 'function') {
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext('2d');
    if (context === null)
      throw new Error('OffscreenCanvas 2D context is unavailable for PNG export');
    return {
      putTile(tile) {
        context.putImageData(new ImageData(tile.rgba, tile.width, tile.height), tile.x, tile.y);
      },
      encode() {
        return canvas.convertToBlob({ type: PNG_MIME_TYPE });
      },
      dispose() {},
    };
  }
  if (typeof document === 'undefined') throw new Error('PNG encoding surface is unavailable');
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (context === null) throw new Error('Canvas 2D context is unavailable for PNG export');
  return {
    putTile(tile) {
      context.putImageData(new ImageData(tile.rgba, tile.width, tile.height), tile.x, tile.y);
    },
    encode() {
      return new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob === null) reject(new Error('browser failed to encode PNG'));
          else resolve(blob);
        }, PNG_MIME_TYPE);
      });
    },
    dispose() {
      canvas.width = 1;
      canvas.height = 1;
    },
  };
}

export async function assertPngBlobV1(blob: Blob): Promise<Blob> {
  if (blob.type !== PNG_MIME_TYPE)
    throw new Error(`PNG encoder returned unexpected MIME type: ${blob.type}`);
  if (blob.size < PNG_SIGNATURE.length)
    throw new Error('PNG encoder returned an empty/truncated blob');
  const header = new Uint8Array(await blob.slice(0, PNG_SIGNATURE.length).arrayBuffer());
  if (PNG_SIGNATURE.some((byte, index) => header[index] !== byte)) {
    throw new Error('PNG encoder returned invalid PNG signature');
  }
  return blob;
}

export async function encodePaintSnapshotToPngV1(
  snapshot: PaintProjectSnapshotV1,
  surfaceFactory: PngRasterSurfaceFactoryV1 = createBrowserPngSurface,
): Promise<Blob> {
  const surface = surfaceFactory(snapshot.document.canvas.width, snapshot.document.canvas.height);
  try {
    for (const tile of iterateBaselinePaintFlattenTilesV1(snapshot)) surface.putTile(tile);
    return await assertPngBlobV1(await surface.encode());
  } finally {
    surface.dispose();
  }
}

export async function encodeCompositeRasterTilesToPngV1(
  documentValue: DocumentV1,
  tiles: readonly BaselineRasterTileImageV1[],
  surfaceFactory: PngRasterSurfaceFactoryV1 = createBrowserPngSurface,
): Promise<Blob> {
  const surface = surfaceFactory(documentValue.canvas.width, documentValue.canvas.height);
  try {
    for (const tile of iterateCompositeRasterFlattenTilesV1(documentValue, tiles)) {
      surface.putTile(tile);
    }
    return await assertPngBlobV1(await surface.encode());
  } finally {
    surface.dispose();
  }
}

export function normalizePngFilenameV1(filename: string): string {
  const trimmed = filename.trim();
  const safe = [...trimmed]
    .map((character) => {
      const code = character.charCodeAt(0);
      return code <= 0x1f || '\\/:*?"<>|'.includes(character) ? '-' : character;
    })
    .join('')
    .replace(/\.+$/g, '');
  const base = safe.length === 0 ? 'Illustro' : safe;
  return base.toLowerCase().endsWith('.png') ? base : `${base}.png`;
}

export function downloadPngBlobV1(blob: Blob, filename = 'Illustro.png'): void {
  if (typeof document === 'undefined' || typeof URL.createObjectURL !== 'function') {
    throw new Error('browser download API is unavailable');
  }
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = normalizePngFilenameV1(filename);
    anchor.rel = 'noopener';
    anchor.style.display = 'none';
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    globalThis.setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}
