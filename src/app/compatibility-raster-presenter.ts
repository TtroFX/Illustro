import { convertEncodedRgbV1 } from '../domain/color-management.js';
import type { RgbUnitColorV1 } from '../domain/color.js';
import type { DocumentColorSpace } from '../domain/document.js';
import {
  baselineDabColorV1,
  baselineDabRadiusXV1,
  baselineDabRadiusYV1,
  type BaselineBrushDabV1,
} from '../gpu/baseline-brush.js';
import type { BaselineRasterTileImageV1 } from '../gpu/baseline-raster-tile-store.js';
import { tileBoundsForDocumentV1, type TileCoordinateV1 } from '../gpu/sparse-tile-model.js';
import type { CanvasBackingSizeV1 } from './shell.js';

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function clampByte(value: number): number {
  return Math.round(clamp01(value) * 255);
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

function getManaged2dContext(
  canvas: HTMLCanvasElement,
  colorSpace: DocumentColorSpace,
): CanvasRenderingContext2D | null {
  try {
    const context = canvas.getContext('2d', {
      alpha: true,
      colorSpace,
    } as CanvasRenderingContext2DSettings);
    if (context === null) return null;
    const attributes = (
      context as CanvasRenderingContext2D & {
        getContextAttributes?: () => { readonly colorSpace?: string };
      }
    ).getContextAttributes?.();
    if (attributes?.colorSpace !== undefined && attributes.colorSpace !== colorSpace) {
      return null;
    }
    return context;
  } catch {
    return null;
  }
}

function createManagedImageData(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  colorSpace: DocumentColorSpace,
): ImageData {
  const Constructor = ImageData as unknown as {
    new (
      data: Uint8ClampedArray,
      width: number,
      height: number,
      settings?: { readonly colorSpace?: DocumentColorSpace },
    ): ImageData;
  };
  return new Constructor(data, width, height, { colorSpace });
}

function imageDataSpaceSupported(colorSpace: DocumentColorSpace): boolean {
  try {
    const image = createManagedImageData(new Uint8ClampedArray(4), 1, 1, colorSpace);
    const actual = (image as ImageData & { readonly colorSpace?: string }).colorSpace;
    return actual === undefined || actual === colorSpace;
  } catch {
    return colorSpace === 'srgb';
  }
}

function presentationCssColor(
  color: RgbUnitColorV1,
  alpha: number,
  colorSpace: DocumentColorSpace,
): string {
  return colorSpace === 'display-p3'
    ? `color(display-p3 ${color[0]} ${color[1]} ${color[2]} / ${alpha})`
    : `rgb(${Math.round(color[0] * 255)} ${Math.round(color[1] * 255)} ${Math.round(color[2] * 255)} / ${alpha})`;
}

/**
 * Canvas2D is a presentation backend only. Canonical pixels remain in the shared
 * Raster Tile store owned by BaselinePaintRendererV1.
 */
export class CompatibilityRasterPresenterV1 {
  readonly #hostCanvas: HTMLCanvasElement;
  #scratch: HTMLCanvasElement | null = null;
  #scratchContext: CanvasRenderingContext2D | null = null;
  #canvas: HTMLCanvasElement | null = null;
  #context: CanvasRenderingContext2D | null = null;
  #documentWidth: number | null = null;
  #documentHeight: number | null = null;
  #workingSpace: DocumentColorSpace = 'srgb';
  #outputColorSpace: DocumentColorSpace = 'srgb';
  #size: CanvasBackingSizeV1 | null = null;

  constructor(hostCanvas: HTMLCanvasElement) {
    this.#hostCanvas = hostCanvas;
  }

  attach(): boolean {
    if (this.#canvas !== null && this.#context !== null && this.#scratchContext !== null) {
      return true;
    }
    return this.#recreateContexts('srgb');
  }

  outputColorSpace(): DocumentColorSpace {
    return this.#outputColorSpace;
  }

  configureDocument(
    width: number,
    height: number,
    workingSpace: DocumentColorSpace = 'srgb',
  ): void {
    if (!Number.isSafeInteger(width) || width < 1 || !Number.isSafeInteger(height) || height < 1) {
      throw new RangeError(
        'compatibility renderer document dimensions must be positive safe integers',
      );
    }
    if (!this.attach()) throw new Error('Canvas2D compatibility surface is unavailable');
    this.#workingSpace = workingSpace;
    if (workingSpace !== this.#outputColorSpace) {
      if (!this.#recreateContexts(workingSpace)) {
        throw new Error('Canvas2D compatibility color-space boundary is unavailable');
      }
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
      if (this.#scratch === null) continue;
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
      const color = this.#presentationColor(baselineDabColorV1(dab));
      gradient.addColorStop(0, presentationCssColor(color, 1, this.#outputColorSpace));
      gradient.addColorStop(0.85, presentationCssColor(color, 1, this.#outputColorSpace));
      gradient.addColorStop(0.93, presentationCssColor(color, 0.5, this.#outputColorSpace));
      gradient.addColorStop(1, presentationCssColor(color, 0, this.#outputColorSpace));
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
    this.#scratch = null;
    this.#scratchContext = null;
  }

  dispose(): void {
    this.detach();
    this.#documentWidth = null;
    this.#documentHeight = null;
    this.#size = null;
  }

  #presentationColor(color: readonly [number, number, number]): RgbUnitColorV1 {
    const unit = Object.freeze([
      clamp01(color[0]),
      clamp01(color[1]),
      clamp01(color[2]),
    ]) as RgbUnitColorV1;
    return this.#workingSpace === this.#outputColorSpace
      ? unit
      : convertEncodedRgbV1(unit, this.#workingSpace, this.#outputColorSpace);
  }

  #writeScratch(tile: BaselineRasterTileImageV1): void {
    const scratch = this.#scratch;
    const scratchContext = this.#scratchContext;
    if (scratch === null || scratchContext === null) return;
    if (scratch.width !== tile.width) scratch.width = tile.width;
    if (scratch.height !== tile.height) scratch.height = tile.height;
    const output = new Uint8ClampedArray(tile.width * tile.height * 4);
    const conversionRequired = this.#workingSpace !== this.#outputColorSpace;
    if (tile.pixelFormat === 'rgba8-unorm' && !conversionRequired) {
      output.set(tile.bytes);
    } else if (tile.pixelFormat === 'rgba8-unorm') {
      for (let pixel = 0; pixel < tile.width * tile.height; pixel += 1) {
        const offset = pixel * 4;
        const color = this.#presentationColor([
          (tile.bytes[offset] ?? 0) / 255,
          (tile.bytes[offset + 1] ?? 0) / 255,
          (tile.bytes[offset + 2] ?? 0) / 255,
        ]);
        output[offset] = clampByte(color[0]);
        output[offset + 1] = clampByte(color[1]);
        output[offset + 2] = clampByte(color[2]);
        output[offset + 3] = tile.bytes[offset + 3] ?? 0;
      }
    } else {
      const source = new DataView(tile.bytes.buffer, tile.bytes.byteOffset, tile.bytes.byteLength);
      for (let pixel = 0; pixel < tile.width * tile.height; pixel += 1) {
        const sourceOffset = pixel * 8;
        const targetOffset = pixel * 4;
        const color = this.#presentationColor([
          clamp01(halfToFloat(source.getUint16(sourceOffset, true))),
          clamp01(halfToFloat(source.getUint16(sourceOffset + 2, true))),
          clamp01(halfToFloat(source.getUint16(sourceOffset + 4, true))),
        ]);
        output[targetOffset] = clampByte(color[0]);
        output[targetOffset + 1] = clampByte(color[1]);
        output[targetOffset + 2] = clampByte(color[2]);
        output[targetOffset + 3] = clampByte(halfToFloat(source.getUint16(sourceOffset + 6, true)));
      }
    }
    scratchContext.putImageData(
      createManagedImageData(output, tile.width, tile.height, this.#outputColorSpace),
      0,
      0,
    );
  }

  #recreateContexts(requestedSpace: DocumentColorSpace): boolean {
    const parent = this.#canvas?.parentElement ?? this.#hostCanvas.parentElement;
    if (parent === null) return false;
    const attempt = (space: DocumentColorSpace) => {
      if (!imageDataSpaceSupported(space)) return null;
      const canvas = document.createElement('canvas');
      const context = getManaged2dContext(canvas, space);
      if (context === null) return null;
      const scratch = document.createElement('canvas');
      const scratchContext = getManaged2dContext(scratch, space);
      if (scratchContext === null) return null;
      return { canvas, context, scratch, scratchContext, space } as const;
    };
    const created =
      attempt(requestedSpace) ?? (requestedSpace === 'display-p3' ? attempt('srgb') : null);
    if (created === null) return false;
    created.canvas.className = 'shell-compatibility-surface';
    created.canvas.dataset.renderBackend = 'compatibility-canvas2d';
    created.canvas.dataset.outputColorSpace = created.space;
    created.canvas.setAttribute('aria-hidden', 'true');
    Object.assign(created.canvas.style, {
      position: 'absolute',
      inset: '0',
      zIndex: '1',
      display: 'block',
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      borderRadius: '10px',
    });
    const previous = this.#canvas;
    if (previous === null) parent.append(created.canvas);
    else previous.replaceWith(created.canvas);
    this.#canvas = created.canvas;
    this.#context = created.context;
    this.#scratch = created.scratch;
    this.#scratchContext = created.scratchContext;
    this.#outputColorSpace = created.space;
    created.context.imageSmoothingEnabled = false;
    if (this.#size !== null) this.resize(this.#size);
    return true;
  }
}
