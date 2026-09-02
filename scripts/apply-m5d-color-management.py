from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    if new in text:
        return
    if text.count(old) != 1:
        raise SystemExit(f'{path}: expected exactly one anchor, found {text.count(old)}')
    file.write_text(text.replace(old, new, 1))


# Document profile metadata remains optional on the interface so legacy M1/M2 snapshots
# without the additive field continue to open; all newly-created documents persist it.
replace_once(
    'src/domain/document.ts',
    "export type CanonicalAlphaMode = 'straight';\n\nexport type RgbaUnitColor = readonly [number, number, number, number];",
    """export type CanonicalAlphaMode = 'straight';

export interface DocumentColorProfileV1 {
  readonly kind: 'builtin-rgb';
  readonly space: DocumentColorSpace;
  readonly whitePoint: 'd65';
  readonly transfer: 'srgb';
}

export type RgbaUnitColor = readonly [number, number, number, number];""",
)
replace_once(
    'src/domain/document.ts',
    """export interface DocumentColorSpec {
  readonly workingSpace: DocumentColorSpace;
  readonly precision: DocumentPrecision;
  readonly alphaMode: CanonicalAlphaMode;
}""",
    """export interface DocumentColorSpec {
  readonly workingSpace: DocumentColorSpace;
  readonly precision: DocumentPrecision;
  readonly alphaMode: CanonicalAlphaMode;
  readonly profile?: DocumentColorProfileV1;
}""",
)
replace_once(
    'src/domain/document.ts',
    """export function createDocumentColorSpec(
  workingSpace: DocumentColorSpace = 'srgb',
  precision: DocumentPrecision = 'rgba8-unorm',
): DocumentColorSpec {
  return Object.freeze({ workingSpace, precision, alphaMode: 'straight' as const });
}""",
    """export function createDocumentColorProfileV1(
  workingSpace: DocumentColorSpace,
): DocumentColorProfileV1 {
  return Object.freeze({
    kind: 'builtin-rgb' as const,
    space: workingSpace,
    whitePoint: 'd65' as const,
    transfer: 'srgb' as const,
  });
}

export function resolveDocumentColorProfileV1(color: DocumentColorSpec): DocumentColorProfileV1 {
  const profile = color.profile;
  if (profile !== undefined && profile.space === color.workingSpace) return profile;
  return createDocumentColorProfileV1(color.workingSpace);
}

export function createDocumentColorSpec(
  workingSpace: DocumentColorSpace = 'srgb',
  precision: DocumentPrecision = 'rgba8-unorm',
): DocumentColorSpec {
  return Object.freeze({
    workingSpace,
    precision,
    alphaMode: 'straight' as const,
    profile: createDocumentColorProfileV1(workingSpace),
  });
}""",
)

# Palette interchange now performs a real supported-space conversion instead of
# preserving mismatched encoded components.
replace_once(
    'src/app/color-workspace-state.ts',
    "import type { DocumentColorSpace } from '../domain/document.js';",
    "import { convertEncodedRgbV1 } from '../domain/color-management.js';\nimport type { DocumentColorSpace } from '../domain/document.js';",
)
replace_once(
    'src/app/color-workspace-state.ts',
    """function uniqueImportedPaletteIdV1(existing: ReadonlySet<string>, requested: string): string {""",
    """export function convertColorPaletteBundleWorkingSpaceV1(
  bundle: ColorPaletteBundleV1,
  targetWorkingSpace: DocumentColorSpace,
): ColorPaletteBundleV1 {
  if (bundle.workingSpace === targetWorkingSpace) return bundle;
  return Object.freeze({
    ...bundle,
    workingSpace: targetWorkingSpace,
    palettes: Object.freeze(
      bundle.palettes.map((palette) =>
        createColorPaletteV1(
          palette.id,
          palette.name,
          palette.colors.map((color) =>
            convertEncodedRgbV1(color, bundle.workingSpace, targetWorkingSpace),
          ),
        ),
      ),
    ),
  });
}

function uniqueImportedPaletteIdV1(existing: ReadonlySet<string>, requested: string): string {""",
)
replace_once(
    'src/app/color-workflow-controller.ts',
    "  commitColorWorkspaceCurrentV1,\n  createColorPaletteInWorkspaceV1,",
    "  commitColorWorkspaceCurrentV1,\n  convertColorPaletteBundleWorkingSpaceV1,\n  createColorPaletteInWorkspaceV1,",
)
replace_once(
    'src/app/color-workflow-controller.ts',
    """      const bundle = parseColorPaletteBundleV1(JSON.parse(await file.text()));
      const next = importColorPaletteBundleV1(state, bundle);
      selectedPaletteColorIndex = null;
      const mismatch = bundle.workingSpace !== workingSpace();
      paletteUpdate(
        next,
        mismatch
          ? `パレットを読込: ${bundle.workingSpace}値を変換せず保持（profile変換は後続M5D）`
          : 'パレットを読み込みました',
      );""",
    """      const bundle = parseColorPaletteBundleV1(JSON.parse(await file.text()));
      const targetWorkingSpace = workingSpace();
      const mismatch = bundle.workingSpace !== targetWorkingSpace;
      const converted = convertColorPaletteBundleWorkingSpaceV1(bundle, targetWorkingSpace);
      const next = importColorPaletteBundleV1(state, converted);
      selectedPaletteColorIndex = null;
      paletteUpdate(
        next,
        mismatch
          ? `パレットを読込: ${bundle.workingSpace} → ${targetWorkingSpace} にprofile-aware変換`
          : 'パレットを読み込みました',
      );""",
)

# WebGPU presentation requests the document output color space explicitly. If P3
# configuration fails, the caller can move to the color-converting Canvas2D backend.
Path('src/gpu/renderer-device-resources.ts').write_text("""import type { DocumentColorSpace } from '../domain/document.js';
import { bootstrapShaderSource } from '../generated/bootstrap-shader.js';
import type { IllustroGpuDeviceV1 } from './webgpu-capability.js';

const GPU_TEXTURE_USAGE_COPY_DST = 0x0002;
const GPU_TEXTURE_USAGE_RENDER_ATTACHMENT = 0x0010;
const ILLUSTRO_CANVAS_TEXTURE_USAGE =
  GPU_TEXTURE_USAGE_COPY_DST | GPU_TEXTURE_USAGE_RENDER_ATTACHMENT;

export interface RendererSurfaceLikeV1 {
  width: number;
  height: number;
  getContext(contextId: string): unknown;
}

interface WebGpuCanvasContextLikeV1 {
  configure(descriptor: {
    readonly device: IllustroGpuDeviceV1;
    readonly format: string;
    readonly alphaMode: 'premultiplied';
    readonly usage: number;
    readonly colorSpace: DocumentColorSpace;
  }): void;
}

export class RendererPreviewColorSpaceUnavailableErrorV1 extends Error {
  readonly code = 'preview-color-space-unavailable' as const;
  readonly requestedColorSpace: DocumentColorSpace;

  constructor(requestedColorSpace: DocumentColorSpace, cause?: unknown) {
    super(`renderer preview color space is unavailable: ${requestedColorSpace}`, { cause });
    this.name = 'RendererPreviewColorSpaceUnavailableErrorV1';
    this.requestedColorSpace = requestedColorSpace;
  }
}

export interface RendererDeviceResourcesSnapshotV1 {
  readonly schema: 'illustro.renderer-device-resources/1';
  readonly generation: number;
  readonly surfaceConfigured: boolean;
  readonly canvasFormat: string | null;
  readonly canvasColorSpace: DocumentColorSpace | null;
}

function browserPreferredCanvasFormat(): string {
  if (typeof navigator === 'undefined') return 'bgra8unorm';
  const gpu = (
    navigator as Navigator & {
      readonly gpu?: { readonly getPreferredCanvasFormat?: () => string };
    }
  ).gpu;
  const format = gpu?.getPreferredCanvasFormat?.();
  return typeof format === 'string' && format.length > 0 ? format : 'bgra8unorm';
}

export function configureRendererSurfaceV1(
  surface: RendererSurfaceLikeV1,
  device: IllustroGpuDeviceV1,
  colorSpace: DocumentColorSpace = 'srgb',
): string {
  const context = surface.getContext('webgpu') as WebGpuCanvasContextLikeV1 | null;
  if (context === null || typeof context.configure !== 'function') {
    throw new Error('WebGPU canvas context is unavailable');
  }
  const format = browserPreferredCanvasFormat();
  const configure = (space: DocumentColorSpace): void =>
    context.configure({
      device,
      format,
      alphaMode: 'premultiplied',
      usage: ILLUSTRO_CANVAS_TEXTURE_USAGE,
      colorSpace: space,
    });
  try {
    configure(colorSpace);
  } catch (error) {
    if (colorSpace !== 'display-p3') throw error;
    try {
      configure('srgb');
    } catch {
      // Preserve the original P3 failure as the actionable preview-boundary reason.
    }
    throw new RendererPreviewColorSpaceUnavailableErrorV1(colorSpace, error);
  }
  return format;
}

export function rebuildRendererDeviceResourcesV1(
  device: IllustroGpuDeviceV1,
  generation: number,
  surface: RendererSurfaceLikeV1 | null = null,
  colorSpace: DocumentColorSpace = 'srgb',
): RendererDeviceResourcesSnapshotV1 {
  device.createShaderModule({
    label: `illustro-renderer-bootstrap-g${generation}`,
    code: bootstrapShaderSource,
  });
  const canvasFormat =
    surface === null ? null : configureRendererSurfaceV1(surface, device, colorSpace);
  return Object.freeze({
    schema: 'illustro.renderer-device-resources/1',
    generation,
    surfaceConfigured: surface !== null,
    canvasFormat,
    canvasColorSpace: surface === null ? null : colorSpace,
  });
}
""")

# Canvas2D is the correctness fallback when a P3 WebGPU output surface is unavailable.
# It requests a matching 2D/ImageData color space where possible and explicitly converts
# P3 canonical values to sRGB when the platform only provides an sRGB 2D boundary.
Path('src/app/compatibility-raster-presenter.ts').write_text("""import { convertEncodedRgbV1 } from '../domain/color-management.js';
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
    const context = canvas.getContext(
      '2d',
      { alpha: true, colorSpace } as CanvasRenderingContext2DSettings,
    );
    if (context === null) return null;
    const attributes = (
      context as CanvasRenderingContext2D & {
        getContextAttributes?: () => { readonly colorSpace?: string };
      }
    ).getContextAttributes?.();
    if (
      attributes?.colorSpace !== undefined &&
      attributes.colorSpace !== colorSpace
    ) {
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
        output[targetOffset + 3] = clampByte(
          halfToFloat(source.getUint16(sourceOffset + 6, true)),
        );
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
    const created = attempt(requestedSpace) ?? (requestedSpace === 'display-p3' ? attempt('srgb') : null);
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
""")

# Renderer controller: color-managed WebGPU surface, exact P3-or-Canvas2D fallback,
# and preview-boundary diagnostics.
replace_once(
    'src/app/renderer-controller.ts',
    "import { rebuildRendererDeviceResourcesV1 } from '../gpu/renderer-device-resources.js';",
    """import {
  configureRendererSurfaceV1,
  rebuildRendererDeviceResourcesV1,
  RendererPreviewColorSpaceUnavailableErrorV1,
} from '../gpu/renderer-device-resources.js';""",
)
replace_once(
    'src/app/renderer-controller.ts',
    """function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}""",
    """function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPreviewColorSpaceFailureV1(value: unknown): boolean {
  return isRecord(value) && value.code === 'preview-color-space-unavailable';
}""",
)
replace_once(
    'src/app/renderer-controller.ts',
    "#compatibilityDocument: { readonly width: number; readonly height: number } | null = null;",
    """#compatibilityDocument: {
    readonly width: number;
    readonly height: number;
    readonly workingSpace: DocumentColorSpace;
  } | null = null;""",
)
replace_once(
    'src/app/renderer-controller.ts',
    """      if (response?.ok !== true) {
        throw new Error('Render Worker failed to configure document tile state');
      }""",
    """      if (response?.ok !== true) {
        if (isPreviewColorSpaceFailureV1(response?.result)) {
          this.#worker.postMessage({ type: 'renderer.dispose' });
          this.#startCompatibilityFallback('worker-preview-color-space-unavailable');
          return this.configureDocument(input);
        }
        throw new Error('Render Worker failed to configure document tile state');
      }""",
)
replace_once(
    'src/app/renderer-controller.ts',
    """    if (snapshot.owner === 'main' && device === null) {
      throw new Error('main renderer device is unavailable');
    }
    this.#mainTileState?.dispose();""",
    """    if (snapshot.owner === 'main' && device === null) {
      throw new Error('main renderer device is unavailable');
    }
    if (snapshot.owner === 'main' && device !== null) {
      try {
        const canvasFormat = configureRendererSurfaceV1(
          this.#shell.canvas,
          device,
          input.workingSpace,
        );
        this.#mainBaselinePaint.attachSurface(this.#shell.canvas, canvasFormat);
      } catch (error) {
        if (error instanceof RendererPreviewColorSpaceUnavailableErrorV1) {
          this.#startCompatibilityFallback('main-preview-color-space-unavailable');
          return this.configureDocument(input);
        }
        throw error;
      }
    }
    this.#mainTileState?.dispose();""",
)
replace_once(
    'src/app/renderer-controller.ts',
    "this.#compatibilityPresenter.configureDocument(input.width, input.height);",
    "this.#compatibilityPresenter.configureDocument(input.width, input.height, input.workingSpace);",
)
replace_once(
    'src/app/renderer-controller.ts',
    """        const resources = rebuildRendererDeviceResourcesV1(device, generation, this.#shell.canvas);""",
    """        const resources = rebuildRendererDeviceResourcesV1(
          device,
          generation,
          this.#shell.canvas,
          this.#canonicalDocument?.workingSpace ?? 'srgb',
        );""",
)
replace_once(
    'src/app/renderer-controller.ts',
    """      this.#compatibilityPresenter.configureDocument(
        this.#compatibilityDocument.width,
        this.#compatibilityDocument.height,
      );""",
    """      this.#compatibilityPresenter.configureDocument(
        this.#compatibilityDocument.width,
        this.#compatibilityDocument.height,
        this.#compatibilityDocument.workingSpace,
      );""",
)
replace_once(
    'src/app/renderer-controller.ts',
    "this.#compatibilityDocument = Object.freeze({ width: input.width, height: input.height });",
    """this.#compatibilityDocument = Object.freeze({
      width: input.width,
      height: input.height,
      workingSpace: input.workingSpace,
    });""",
)
replace_once(
    'src/app/renderer-controller.ts',
    """    this.#compatibilityDocument = Object.freeze({
      width: documentValue.width,
      height: documentValue.height,
    });""",
    """    this.#compatibilityDocument = Object.freeze({
      width: documentValue.width,
      height: documentValue.height,
      workingSpace: documentValue.workingSpace,
    });""",
)
replace_once(
    'src/app/renderer-controller.ts',
    """    this.#root.dataset.illustroRendererWorkingSpace = input.workingSpace;
    this.#root.dataset.illustroRendererPrecision = input.precision;""",
    """    this.#root.dataset.illustroRendererWorkingSpace = input.workingSpace;
    this.#root.dataset.illustroRendererPrecision = input.precision;
    const outputSpace =
      this.#owner === 'compatibility'
        ? this.#compatibilityPresenter.outputColorSpace()
        : input.workingSpace;
    this.#root.dataset.illustroRendererPreviewColorSpace = outputSpace;
    this.#root.dataset.illustroRendererPreviewConversion =
      outputSpace === input.workingSpace ? 'none' : `${input.workingSpace}-to-${outputSpace}`;""",
)

# Render Worker mirrors the same preview-boundary policy. A P3 surface failure is
# returned as a structured capability failure so Main can hand off canonical state.
replace_once(
    'src/workers/render.worker.ts',
    """  configureRendererSurfaceV1,
  rebuildRendererDeviceResourcesV1,
  type RendererSurfaceLikeV1,""",
    """  configureRendererSurfaceV1,
  rebuildRendererDeviceResourcesV1,
  RendererPreviewColorSpaceUnavailableErrorV1,
  type RendererSurfaceLikeV1,""",
)
replace_once(
    'src/workers/render.worker.ts',
    """let surface: RendererSurfaceLikeV1 | null = null;
let tileState: RendererTileStateV1 | null = null;""",
    """let surface: RendererSurfaceLikeV1 | null = null;
let currentWorkingSpace: DocumentColorSpace = 'srgb';
let tileState: RendererTileStateV1 | null = null;""",
)
replace_once(
    'src/workers/render.worker.ts',
    "const resources = rebuildRendererDeviceResourcesV1(device, generation, surface);",
    "const resources = rebuildRendererDeviceResourcesV1(device, generation, surface, currentWorkingSpace);",
)
replace_once(
    'src/workers/render.worker.ts',
    """    if (request.type === 'renderer.tiles.configure') {
      tileState?.dispose();""",
    """    if (request.type === 'renderer.tiles.configure') {
      const device = deviceManager.currentDevice();
      if (surface !== null && device !== null) {
        const canvasFormat = configureRendererSurfaceV1(surface, device, request.workingSpace);
        baselinePaint.attachSurface(surface, canvasFormat);
      }
      currentWorkingSpace = request.workingSpace;
      tileState?.dispose();""",
)
# Both attach/retry sites use the active document working space. The replacement is global
# because both occurrences have identical semantics.
worker = Path('src/workers/render.worker.ts')
worker_text = worker.read_text()
old_surface = "const canvasFormat = configureRendererSurfaceV1(surface, device);"
if old_surface in worker_text:
    worker_text = worker_text.replace(
        old_surface,
        "const canvasFormat = configureRendererSurfaceV1(surface, device, currentWorkingSpace);",
    )
worker.write_text(worker_text)
replace_once(
    'src/workers/render.worker.ts',
    """        message: error instanceof Error ? error.message : String(error),
      });""",
    """        code:
          error instanceof RendererPreviewColorSpaceUnavailableErrorV1
            ? error.code
            : 'renderer-request-failed',
        message: error instanceof Error ? error.message : String(error),
      });""",
)

# Publish explicit document-profile identity for diagnostics and later import/export reuse.
replace_once(
    'src/app/main.ts',
    "import type { DocumentV1 } from '../domain/document.js';",
    "import { resolveDocumentColorProfileV1, type DocumentV1 } from '../domain/document.js';",
)
replace_once(
    'src/app/main.ts',
    """  root.dataset.illustroDocumentWorkingSpace = documentValue.color.workingSpace;
  root.dataset.illustroDocumentPrecision = documentValue.color.precision;""",
    """  root.dataset.illustroDocumentWorkingSpace = documentValue.color.workingSpace;
  root.dataset.illustroDocumentPrecision = documentValue.color.precision;
  const colorProfile = resolveDocumentColorProfileV1(documentValue.color);
  root.dataset.illustroDocumentColorProfile = colorProfile.space;
  root.dataset.illustroDocumentColorTransfer = colorProfile.transfer;
  root.dataset.illustroDocumentColorWhitePoint = colorProfile.whitePoint;""",
)

# Unit tests for standard-space conversion, ICC matrix/TRC parsing, profile metadata,
# and preview-surface color-space requests.
Path('tests/unit/color-management.test.ts').write_text(r"""import { describe, expect, it } from 'vitest';
import {
  convertEncodedRgbV1,
  convertEncodedRgbWithReportV1,
  convertProfileEncodedRgbV1,
  decodeSrgbTransferComponentV1,
  encodeSrgbTransferComponentV1,
  parseIccRgbMatrixProfileV1,
  UnsupportedIccProfileErrorV1,
} from '../../src/domain/color-management.js';

function writeSignature(bytes: Uint8Array, offset: number, signature: string): void {
  for (let index = 0; index < 4; index += 1) bytes[offset + index] = signature.charCodeAt(index);
}

function writeFixed(view: DataView, offset: number, value: number): void {
  view.setInt32(offset, Math.round(value * 65536), false);
}

function xyzTag(values: readonly [number, number, number]): Uint8Array {
  const bytes = new Uint8Array(20);
  const view = new DataView(bytes.buffer);
  writeSignature(bytes, 0, 'XYZ ');
  writeFixed(view, 8, values[0]);
  writeFixed(view, 12, values[1]);
  writeFixed(view, 16, values[2]);
  return bytes;
}

function srgbParametricTrc(): Uint8Array {
  const bytes = new Uint8Array(40);
  const view = new DataView(bytes.buffer);
  writeSignature(bytes, 0, 'para');
  view.setUint16(8, 4, false);
  const parameters = [
    2.4,
    1 / 1.055,
    0.055 / 1.055,
    1 / 12.92,
    0.04045,
    0,
    0,
  ];
  parameters.forEach((value, index) => writeFixed(view, 12 + index * 4, value));
  return bytes;
}

function syntheticSrgbMatrixProfile(): Uint8Array {
  const entries = [
    ['rXYZ', xyzTag([0.4360747, 0.2225045, 0.0139322])],
    ['gXYZ', xyzTag([0.3850649, 0.7168786, 0.0971045])],
    ['bXYZ', xyzTag([0.1430804, 0.0606169, 0.7141733])],
    ['rTRC', srgbParametricTrc()],
    ['gTRC', srgbParametricTrc()],
    ['bTRC', srgbParametricTrc()],
  ] as const;
  const tableBytes = 4 + entries.length * 12;
  let cursor = 128 + tableBytes;
  const offsets = entries.map(([, payload]) => {
    const offset = cursor;
    cursor += payload.byteLength;
    cursor = (cursor + 3) & ~3;
    return offset;
  });
  const bytes = new Uint8Array(cursor);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, bytes.byteLength, false);
  bytes[8] = 4;
  writeSignature(bytes, 12, 'mntr');
  writeSignature(bytes, 16, 'RGB ');
  writeSignature(bytes, 20, 'XYZ ');
  view.setUint32(128, entries.length, false);
  entries.forEach(([signature, payload], index) => {
    const entryOffset = 132 + index * 12;
    writeSignature(bytes, entryOffset, signature);
    view.setUint32(entryOffset + 4, offsets[index] ?? 0, false);
    view.setUint32(entryOffset + 8, payload.byteLength, false);
    bytes.set(payload, offsets[index] ?? 0);
  });
  return bytes;
}

describe('M5D color management', () => {
  it('implements the standard sRGB transfer function', () => {
    expect(decodeSrgbTransferComponentV1(0.04045)).toBeCloseTo(0.0031308, 7);
    expect(encodeSrgbTransferComponentV1(0.0031308)).toBeCloseTo(0.0404499, 6);
    const decoded = decodeSrgbTransferComponentV1(0.5);
    expect(encodeSrgbTransferComponentV1(decoded)).toBeCloseTo(0.5, 12);
  });

  it('converts encoded sRGB and Display-P3 through D65 linear RGB', () => {
    const p3 = convertEncodedRgbV1([1, 0, 0], 'srgb', 'display-p3');
    expect(p3[0]).toBeCloseTo(0.9175, 3);
    expect(p3[1]).toBeCloseTo(0.2003, 3);
    expect(p3[2]).toBeCloseTo(0.1386, 3);
    const roundTrip = convertEncodedRgbV1(p3, 'display-p3', 'srgb');
    expect(roundTrip[0]).toBeCloseTo(1, 5);
    expect(roundTrip[1]).toBeCloseTo(0, 5);
    expect(roundTrip[2]).toBeCloseTo(0, 5);
  });

  it('reports clipping when a Display-P3 color is outside sRGB', () => {
    const result = convertEncodedRgbWithReportV1([1, 0, 0], 'display-p3', 'srgb');
    expect(result.clipped).toBe(true);
    expect(result.color).toEqual([1, 0, 0]);
  });

  it('parses a matrix/TRC RGB ICC profile and converts it into the document space', () => {
    const profile = parseIccRgbMatrixProfileV1(syntheticSrgbMatrixProfile());
    expect(profile.kind).toBe('icc-rgb-matrix-trc');
    expect(profile.versionMajor).toBe(4);
    const source = [0.2, 0.4, 0.8] as const;
    const converted = convertProfileEncodedRgbV1(source, profile, 'srgb');
    expect(converted.color[0]).toBeCloseTo(source[0], 2);
    expect(converted.color[1]).toBeCloseTo(source[1], 2);
    expect(converted.color[2]).toBeCloseTo(source[2], 2);
  });

  it('rejects non-RGB ICC profiles instead of silently reinterpreting them', () => {
    const bytes = syntheticSrgbMatrixProfile();
    writeSignature(bytes, 16, 'CMYK');
    expect(() => parseIccRgbMatrixProfileV1(bytes)).toThrow(UnsupportedIccProfileErrorV1);
  });
});
""")

# Keep the existing DocumentV1 test explicit about the new additive profile metadata.
doc_test = Path('tests/unit/document-contract.test.ts')
doc_text = doc_test.read_text()
doc_text = doc_text.replace(
    """    expect(document.color).toEqual({
      workingSpace: 'srgb',
      precision: 'rgba8-unorm',
      alphaMode: 'straight',
    });""",
    """    expect(document.color).toEqual({
      workingSpace: 'srgb',
      precision: 'rgba8-unorm',
      alphaMode: 'straight',
      profile: { kind: 'builtin-rgb', space: 'srgb', whitePoint: 'd65', transfer: 'srgb' },
    });""",
)
doc_text = doc_text.replace(
    """    expect(document.color).toEqual({
      workingSpace: 'display-p3',
      precision: 'rgba16-float',
      alphaMode: 'straight',
    });""",
    """    expect(document.color).toEqual({
      workingSpace: 'display-p3',
      precision: 'rgba16-float',
      alphaMode: 'straight',
      profile: {
        kind: 'builtin-rgb',
        space: 'display-p3',
        whitePoint: 'd65',
        transfer: 'srgb',
      },
    });""",
)
doc_test.write_text(doc_text)

Path('tests/unit/renderer-device-resources.test.ts').write_text("""import { describe, expect, it } from 'vitest';
import type {
  IllustroGpuDeviceV1,
  WebGpuDeviceLostInfoLikeV1,
} from '../../src/gpu/webgpu-capability.js';
import {
  configureRendererSurfaceV1,
  rebuildRendererDeviceResourcesV1,
  RendererPreviewColorSpaceUnavailableErrorV1,
} from '../../src/gpu/renderer-device-resources.js';

function testDevice(): { readonly device: IllustroGpuDeviceV1; readonly labels: string[] } {
  const labels: string[] = [];
  return {
    labels,
    device: {
      lost: new Promise<WebGpuDeviceLostInfoLikeV1>(() => undefined),
      createShaderModule(descriptor) {
        labels.push(descriptor.label ?? '');
        return {};
      },
    },
  };
}

describe('M3/M5D renderer device-dependent resource rebuild', () => {
  it('reconfigures replacement devices with an explicit sRGB preview boundary', () => {
    const configurations: unknown[] = [];
    const surface = {
      width: 640,
      height: 480,
      getContext(contextId: string) {
        expect(contextId).toBe('webgpu');
        return {
          configure(descriptor: unknown) {
            configurations.push(descriptor);
          },
        };
      },
    };
    const first = testDevice();
    const second = testDevice();

    const firstSnapshot = rebuildRendererDeviceResourcesV1(first.device, 1, surface);
    const secondSnapshot = rebuildRendererDeviceResourcesV1(second.device, 2, surface);

    expect(firstSnapshot).toMatchObject({
      generation: 1,
      surfaceConfigured: true,
      canvasColorSpace: 'srgb',
    });
    expect(secondSnapshot).toMatchObject({
      generation: 2,
      surfaceConfigured: true,
      canvasColorSpace: 'srgb',
    });
    expect(first.labels).toEqual(['illustro-renderer-bootstrap-g1']);
    expect(second.labels).toEqual(['illustro-renderer-bootstrap-g2']);
    expect(configurations).toHaveLength(2);
    expect(configurations[0]).toMatchObject({ device: first.device, usage: 0x12, colorSpace: 'srgb' });
    expect(configurations[1]).toMatchObject({ device: second.device, usage: 0x12, colorSpace: 'srgb' });
  });

  it('requests Display-P3 when the document working space is Display-P3', () => {
    const configurations: unknown[] = [];
    const { device } = testDevice();
    configureRendererSurfaceV1(
      {
        width: 1,
        height: 1,
        getContext() {
          return { configure(descriptor: unknown) { configurations.push(descriptor); } };
        },
      },
      device,
      'display-p3',
    );
    expect(configurations).toHaveLength(1);
    expect(configurations[0]).toMatchObject({ colorSpace: 'display-p3' });
  });

  it('reports an unavailable Display-P3 boundary and restores sRGB configuration', () => {
    const spaces: string[] = [];
    const { device } = testDevice();
    expect(() =>
      configureRendererSurfaceV1(
        {
          width: 1,
          height: 1,
          getContext() {
            return {
              configure(descriptor: { readonly colorSpace: string }) {
                spaces.push(descriptor.colorSpace);
                if (descriptor.colorSpace === 'display-p3') throw new Error('unsupported');
              },
            };
          },
        },
        device,
        'display-p3',
      ),
    ).toThrow(RendererPreviewColorSpaceUnavailableErrorV1);
    expect(spaces).toEqual(['display-p3', 'srgb']);
  });

  it('rejects a surface without a WebGPU canvas context', () => {
    const { device } = testDevice();
    expect(() =>
      configureRendererSurfaceV1(
        {
          width: 1,
          height: 1,
          getContext() {
            return null;
          },
        },
        device,
      ),
    ).toThrow('WebGPU canvas context is unavailable');
  });
});
""")

# M5D contract and progress.
verify = Path('scripts/verify-m5d-color.mjs')
verify_text = verify.read_text()
verify_text = verify_text.replace(
    "requireText('src/domain/color.ts', ['rgbToHsvV1', 'hsvToRgbV1', 'parseHexRgbV1', 'formatHexRgbV1']);",
    """requireText('src/domain/color.ts', ['rgbToHsvV1', 'hsvToRgbV1', 'parseHexRgbV1', 'formatHexRgbV1']);
requireText('src/domain/color-management.ts', [
  'decodeSrgbTransferComponentV1',
  'convertEncodedRgbV1',
  'parseIccRgbMatrixProfileV1',
  'convertProfileEncodedRgbV1',
  'XYZ_D50_TO_D65',
  'previewOutputColorSpaceV1',
]);
requireText('src/domain/document.ts', [
  'DocumentColorProfileV1',
  'createDocumentColorProfileV1',
  'resolveDocumentColorProfileV1',
]);""",
)
verify_text = verify_text.replace(
    """requireText('src/app/compatibility-raster-presenter.ts', [
  'baselineDabColorV1',
  'gradient.addColorStop',
]);""",
    """requireText('src/app/compatibility-raster-presenter.ts', [
  'baselineDabColorV1',
  'gradient.addColorStop',
  'convertEncodedRgbV1',
  'colorSpace',
  'outputColorSpace',
]);
requireText('src/gpu/renderer-device-resources.ts', [
  'RendererPreviewColorSpaceUnavailableErrorV1',
  'colorSpace',
]);""",
)
verify_text = verify_text.replace(
    "  'M5D-021 sRGB processing:未完了',",
    """  'M5D-021 sRGB processing:完了',
  'M5D-022 Display-P3 processing:完了',
  'M5D-023 color-profile metadata:完了',
  'M5D-024 profile-aware conversion:完了',
  'M5D-025 ICC/profile-aware preview boundary:完了',
  'M5D-026 Color Mixing Palette:未完了',""",
)
verify.write_text(verify_text)

progress = Path('IMPLEMENTATION_PROGRESS.md')
progress_text = progress.read_text()
for item in [
    'M5D-021 sRGB processing',
    'M5D-022 Display-P3 processing',
    'M5D-023 color-profile metadata',
    'M5D-024 profile-aware conversion',
    'M5D-025 ICC/profile-aware preview boundary',
]:
    old = f'{item}:未完了'
    new = f'{item}:完了'
    if old not in progress_text and new not in progress_text:
        raise SystemExit(f'progress anchor missing: {item}')
    progress_text = progress_text.replace(old, new)
progress.write_text(progress_text)

memo = Path('ILLUSTRO_DESIGN_MEMO.md')
memo_text = memo.read_text()
marker = '#### M5D color-management semantic boundary — 2026-09-02'
if marker not in memo_text:
    memo_text += """

#### M5D color-management semantic boundary — 2026-09-02

- M5D-021 through M5D-025 centralize RGB color-management rather than changing the existing canonical encoded-component storage model. Canonical document/palette/paint RGB remains encoded in the active working space; color conversion occurs only at an explicit source-profile, document-conversion, import/export or presentation boundary.
- The supported built-in document profiles are sRGB and Display-P3, both D65 with the standard sRGB-style transfer curve. Conversion decodes transfer values, converts through linear-light XYZ D65 using fixed standard RGB matrices, converts to the target primaries, re-encodes, and applies an explicit `clip` gamut policy at the current bounded RGB UI/canonical boundary.
- `DocumentColorSpec` now carries additive built-in profile metadata (`builtin-rgb`, working-space identity, D65 white point and sRGB transfer). Legacy v1 snapshots without this additive field resolve the same profile deterministically from their existing `workingSpace`, so this M5D change does not invalidate prior persisted projects.
- Profile-aware input conversion additionally supports ordinary RGB ICC matrix/TRC profiles using ICC `rXYZ/gXYZ/bXYZ` plus `rTRC/gTRC/bTRC`, with both `curveType` and ICC parametric curve function types 0–4. ICC PCS XYZ D50 values are Bradford-adapted to D65 before conversion into the supported document space. Non-RGB, non-XYZ-PCS, LUT-only or otherwise unsupported ICC profiles fail explicitly and are never silently treated as sRGB.
- Palette bundles already identify their source working space; a mismatched sRGB/Display-P3 palette import now performs the centralized profile-aware conversion before entering Color Workspace state instead of preserving mismatched encoded components.
- WebGPU presentation explicitly requests the document color space in `GPUCanvasContext.configure`. If a Display-P3 WebGPU presentation boundary cannot be configured, Illustro uses the backend-independent canonical Raster Tiles and hands presentation to the Canvas2D compatibility backend rather than displaying P3 numbers as sRGB.
- Canvas2D compatibility presentation requests matching `CanvasRenderingContext2D` / `ImageData` color space when available. If only sRGB presentation is available for a Display-P3 document, tile pixels and provisional dab colors are converted from Display-P3 to sRGB at the presentation boundary; canonical tiles remain unchanged.
- Illustro's color-management responsibility ends at correctly defined/tagged web-canvas output. Physical display calibration, active monitor ICC/LUT state and final device characterization remain owned by the browser/OS/display stack under FC-4.
- The matrix/TRC ICC implementation is an independent implementation of the ICC profile-format semantics, guided by ICC.1:2022 and the public ICC parametric-curve definitions; no third-party source code is incorporated.
"""
    memo.write_text(memo_text)
