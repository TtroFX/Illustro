import {
  baselineDabColorV1,
  baselineDabRadiusXV1,
  baselineDabRadiusYV1,
  type BaselineBrushDabV1,
} from '../gpu/baseline-brush.js';
import type { BaselineRasterTileImageV1 } from '../gpu/baseline-raster-tile-store.js';
import { tileBoundsForDocumentV1, type TileCoordinateV1 } from '../gpu/sparse-tile-model.js';
import type { CanvasBackingSizeV1 } from './shell.js';

function clampByte(value: number): number {
  return Math.round(Math.min(1, Math.max(0, value)) * 255);
}

function halfToFloat(value: number): number {
  const sign = (value & 0x8000) !== 0 ? -1 : 1;
  const exponent = (value >>> 10) & 0x1f;
  const fraction = value & 0x03ff;
  if (exponent === 0) return sign * 2 ** -14 * (fraction / 1024);
  if (exponent === 0x1f) return fraction === 0 ? sign * Number.POSITIVE_INFINITY : Number.NaN;
  return sign * 2 ** (exponent - 15) * (1 + fraction / 1024);
}

function tileTargetRect(
  documentWidth: number,
  documentHeight: number,
  surfaceWidth: number,
  surfaceHeight: number,
  coordinate: TileCoordinateV1,
): { readonly x: number; readonly y: number; readonly width: number; readonly height: number } {
  const bounds = tileBoundsForDocumentV1(documentWidth, documentHeight, coordinate);
  const x = Math.floor((bounds.x * surfaceWidth) / documentWidth);
  const y = Math.floor((bounds.y * surfaceHeight) / documentHeight);
  const right = Math.ceil(((bounds.x + bounds.validWidth) * surfaceWidth) / documentWidth);
  const bottom = Math.ceil(((bounds.y + bounds.validHeight) * surfaceHeight) / documentHeight);
  return Object.freeze({
    x,
    y,
    width: Math.max(1, Math.min(surfaceWidth - x, right - x)),
    height: Math.max(1, Math.min(surfaceHeight - y, bottom - y)),
  });
}

/**
 * Canvas2D is a presentation backend only. Canonical pixels remain in the shared
 * Raster Tile store owned by BaselinePaintRendererV1.
 */
export class CompatibilityRasterPresenterV1 {
  readonly #hostCanvas: HTMLCanvasElement;
  readonly #scratch = document.createElement('canvas');
  readonly #scratchContext: CanvasRenderingContext2D | null;
  #canvas: HTMLCanvasElement | null = null;
  #context: CanvasRenderingContext2D | null = null;
  #documentWidth: number | null = null;
  #documentHeight: number | null = null;
  #size: CanvasBackingSizeV1 | null = null;

  constructor(hostCanvas: HTMLCanvasElement) {
    this.#hostCanvas = hostCanvas;
    this.#scratchContext = this.#scratch.getContext('2d', { alpha: true });
  }

  attach(): boolean {
    if (this.#canvas !== null && this.#context !== null) return true;
    if (this.#scratchContext === null) return false;
    const parent = this.#hostCanvas.parentElement;
    if (parent === null) return false;
    const canvas = document.createElement('canvas');
    canvas.className = 'shell-compatibility-surface';
    canvas.dataset.renderBackend = 'compatibility-canvas2d';
    canvas.setAttribute('aria-hidden', 'true');
    Object.assign(canvas.style, {
      position: 'absolute',
      inset: '0',
      zIndex: '1',
      display: 'block',
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      borderRadius: '10px',
    });
    const context = canvas.getContext('2d', { alpha: true });
    if (context === null) return false;
    context.imageSmoothingEnabled = false;
    parent.append(canvas);
    this.#canvas = canvas;
    this.#context = context;
    if (this.#size !== null) this.resize(this.#size);
    return true;
  }

  configureDocument(width: number, height: number): void {
    if (!Number.isSafeInteger(width) || width < 1 || !Number.isSafeInteger(height) || height < 1) {
      throw new RangeError(
        'compatibility renderer document dimensions must be positive safe integers',
      );
    }
    this.#documentWidth = width;
    this.#documentHeight = height;
    this.clear();
  }

  resize(size: CanvasBackingSizeV1): void {
    this.#size = size;
    const canvas = this.#canvas;
    if (canvas === null) return;
    if (canvas.width !== size.width) canvas.width = size.width;
    if (canvas.height !== size.height) canvas.height = size.height;
    const context = this.#context;
    if (context !== null) context.imageSmoothingEnabled = false;
  }

  clear(): void {
    const canvas = this.#canvas;
    const context = this.#context;
    if (canvas === null || context === null) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
  }

  presentAll(tiles: readonly BaselineRasterTileImageV1[]): void {
    this.clear();
    this.patchTiles(tiles);
  }

  clearTiles(coordinates: readonly TileCoordinateV1[]): void {
    const context = this.#context;
    const canvas = this.#canvas;
    const documentWidth = this.#documentWidth;
    const documentHeight = this.#documentHeight;
    if (context === null || canvas === null || documentWidth === null || documentHeight === null) {
      return;
    }
    for (const coordinate of coordinates) {
      const target = tileTargetRect(
        documentWidth,
        documentHeight,
        canvas.width,
        canvas.height,
        coordinate,
      );
      context.clearRect(target.x, target.y, target.width, target.height);
    }
  }

  patchTiles(tiles: readonly BaselineRasterTileImageV1[]): void {
    const context = this.#context;
    const canvas = this.#canvas;
    const documentWidth = this.#documentWidth;
    const documentHeight = this.#documentHeight;
    if (context === null || canvas === null || documentWidth === null || documentHeight === null) {
      return;
    }
    context.imageSmoothingEnabled = false;
    for (const tile of tiles) {
      const target = tileTargetRect(
        documentWidth,
        documentHeight,
        canvas.width,
        canvas.height,
        tile.coordinate,
      );
      context.clearRect(target.x, target.y, target.width, target.height);
      this.#writeScratch(tile);
      context.drawImage(
        this.#scratch,
        0,
        0,
        tile.width,
        tile.height,
        target.x,
        target.y,
        target.width,
        target.height,
      );
    }
  }

  presentDabs(dabs: readonly BaselineBrushDabV1[]): void {
    const context = this.#context;
    const canvas = this.#canvas;
    const documentWidth = this.#documentWidth;
    const documentHeight = this.#documentHeight;
    if (
      dabs.length === 0 ||
      context === null ||
      canvas === null ||
      documentWidth === null ||
      documentHeight === null
    ) {
      return;
    }
    const scaleX = canvas.width / documentWidth;
    const scaleY = canvas.height / documentHeight;
    for (const dab of dabs) {
      const radiusX = baselineDabRadiusXV1(dab) * scaleX;
      const radiusY = baselineDabRadiusYV1(dab) * scaleY;
      if (!(radiusX > 0) || !(radiusY > 0) || !(dab.opacity > 0)) continue;
      context.save();
      context.translate(dab.x * scaleX, dab.y * scaleY);
      context.scale(radiusX, radiusY);
      const gradient = context.createRadialGradient(0, 0, 0, 0, 0, 1);
      const color = baselineDabColorV1(dab);
      const red = Math.round(color[0] * 255);
      const green = Math.round(color[1] * 255);
      const blue = Math.round(color[2] * 255);
      gradient.addColorStop(0, `rgb(${red} ${green} ${blue} / 1)`);
      gradient.addColorStop(0.85, `rgb(${red} ${green} ${blue} / 1)`);
      gradient.addColorStop(0.93, `rgb(${red} ${green} ${blue} / 0.5)`);
      gradient.addColorStop(1, `rgb(${red} ${green} ${blue} / 0)`);
      context.globalAlpha = Math.min(1, Math.max(0, dab.opacity));
      context.fillStyle = gradient;
      context.beginPath();
      context.arc(0, 0, 1, 0, Math.PI * 2);
      context.fill();
      context.restore();
    }
  }

  detach(): void {
    this.#canvas?.remove();
    this.#canvas = null;
    this.#context = null;
  }

  dispose(): void {
    this.detach();
    this.#documentWidth = null;
    this.#documentHeight = null;
    this.#size = null;
  }

  #writeScratch(tile: BaselineRasterTileImageV1): void {
    const scratchContext = this.#scratchContext;
    if (scratchContext === null) return;
    if (this.#scratch.width !== tile.width) this.#scratch.width = tile.width;
    if (this.#scratch.height !== tile.height) this.#scratch.height = tile.height;
    const output = new Uint8ClampedArray(tile.width * tile.height * 4);
    if (tile.pixelFormat === 'rgba8-unorm') {
      output.set(tile.bytes);
    } else {
      const source = new DataView(tile.bytes.buffer, tile.bytes.byteOffset, tile.bytes.byteLength);
      for (let pixel = 0; pixel < tile.width * tile.height; pixel += 1) {
        const sourceOffset = pixel * 8;
        const targetOffset = pixel * 4;
        output[targetOffset] = clampByte(halfToFloat(source.getUint16(sourceOffset, true)));
        output[targetOffset + 1] = clampByte(halfToFloat(source.getUint16(sourceOffset + 2, true)));
        output[targetOffset + 2] = clampByte(halfToFloat(source.getUint16(sourceOffset + 4, true)));
        output[targetOffset + 3] = clampByte(halfToFloat(source.getUint16(sourceOffset + 6, true)));
      }
    }
    scratchContext.putImageData(new ImageData(output, tile.width, tile.height), 0, 0);
  }
}
