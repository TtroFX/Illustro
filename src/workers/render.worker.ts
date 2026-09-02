import type { GpuAtlasPixelFormatV1 } from '../gpu/gpu-atlas.js';
import type { DocumentColorSpace, DocumentPrecision } from '../domain/document.js';
import { freezeBaselineBrushColorV1, type BaselineBrushDabV1 } from '../gpu/baseline-brush.js';
import { isM5cBaseBlendModeV1 } from '../gpu/blend-modes.js';
import {
  BaselinePaintRendererV1,
  type BaselinePaintCommittedStrokeV1,
} from '../gpu/baseline-paint-renderer.js';
import type {
  BaselineAffineMatrixV1,
  BaselineRasterLayerDescriptorV1,
  BaselineRasterMaskDescriptorV1,
  BaselineRasterMaskTileImageV1,
  BaselineRasterTileImageV1,
  BaselineRasterTilePatchDirectionV1,
  BaselineRasterTilePatchV1,
} from '../gpu/baseline-raster-tile-store.js';
import { acquireCoreWebGpuV1 } from '../gpu/webgpu-capability.js';
import { RendererDeviceManagerV1 } from '../gpu/renderer-device-manager.js';
import {
  configureRendererSurfaceV1,
  rebuildRendererDeviceResourcesV1,
  type RendererSurfaceLikeV1,
} from '../gpu/renderer-device-resources.js';
import { RendererTileStateV1 } from '../gpu/renderer-tile-state.js';
import {
  installRenderSchedulingExtensionV1,
  type RenderSchedulingControllerV1,
} from './render-scheduling-extension.js';
import type { RectV1, TileCoordinateV1 } from '../gpu/sparse-tile-model.js';
import type { TileCacheResidencyV1 } from '../gpu/tile-cache.js';
import type { DocumentViewportRectV1 } from '../gpu/viewport-tiles.js';
import { installRenderInputIngressV1 } from './input-ingress-extension.js';

type WorkerMessageEvent<T> = { readonly data: T };
type WorkerScope = {
  addEventListener(type: 'message', listener: (event: WorkerMessageEvent<unknown>) => void): void;
  postMessage(message: unknown, transfer?: readonly Transferable[]): void;
};

type RenderWorkerRequestV1 =
  | { readonly type: 'ping' }
  | { readonly type: 'renderer.probe'; readonly requestId: string }
  | {
      readonly type: 'renderer.attach';
      readonly requestId: string;
      readonly canvas: RendererSurfaceLikeV1;
      readonly width: number;
      readonly height: number;
    }
  | { readonly type: 'renderer.resize'; readonly width: number; readonly height: number }
  | { readonly type: 'renderer.retry'; readonly requestId: string }
  | {
      readonly type: 'renderer.tiles.configure';
      readonly requestId: string;
      readonly width: number;
      readonly height: number;
      readonly workingSpace: DocumentColorSpace;
      readonly precision: DocumentPrecision;
      readonly rasterLayers: readonly BaselineRasterLayerDescriptorV1[];
    }
  | {
      readonly type:
        | 'renderer.tiles.allocate'
        | 'renderer.tiles.deallocate'
        | 'renderer.tiles.inspect'
        | 'renderer.tiles.releaseGpu'
        | 'renderer.tiles.dropCpu';
      readonly requestId: string;
      readonly coordinate: TileCoordinateV1;
    }
  | {
      readonly type: 'renderer.tiles.markDirty';
      readonly requestId: string;
      readonly coordinate: TileCoordinateV1;
      readonly rect: RectV1;
    }
  | {
      readonly type: 'renderer.tiles.reserveGpu' | 'renderer.tiles.upload';
      readonly requestId: string;
      readonly coordinate: TileCoordinateV1;
      readonly pixelFormat: GpuAtlasPixelFormatV1;
      readonly residency: TileCacheResidencyV1;
    }
  | {
      readonly type: 'renderer.tiles.readback';
      readonly requestId: string;
      readonly coordinate: TileCoordinateV1;
      readonly residency: TileCacheResidencyV1;
    }
  | {
      readonly type: 'renderer.tiles.cacheCpu';
      readonly requestId: string;
      readonly coordinate: TileCoordinateV1;
      readonly bytes: ArrayBuffer;
      readonly residency: TileCacheResidencyV1;
    }
  | {
      readonly type: 'renderer.tiles.viewport';
      readonly requestId: string;
      readonly rect: DocumentViewportRectV1;
    }
  | {
      readonly type: 'renderer.paint.present' | 'renderer.paint.finalize';
      readonly requestId: string;
      readonly strokeId: string;
      readonly layerId: string;
      readonly dabs: readonly BaselineBrushDabV1[];
    }
  | {
      readonly type: 'renderer.paint.cancel';
      readonly requestId: string;
      readonly strokeId: string;
    }
  | {
      readonly type: 'renderer.paint.restore';
      readonly requestId: string;
      readonly strokes: readonly BaselinePaintCommittedStrokeV1[];
    }
  | {
      readonly type: 'renderer.paint.restoreTiles';
      readonly requestId: string;
      readonly tiles: readonly BaselineRasterTileImageV1[];
      readonly rasterLayers: readonly BaselineRasterLayerDescriptorV1[];
    }
  | {
      readonly type: 'renderer.paint.exportTiles';
      readonly requestId: string;
      readonly composite: boolean;
      readonly includeDraft?: boolean;
    }
  | {
      readonly type: 'renderer.paint.applyPatches';
      readonly requestId: string;
      readonly patches: readonly BaselineRasterTilePatchV1[];
      readonly direction: BaselineRasterTilePatchDirectionV1;
    }
  | { readonly type: 'renderer.dispose' };

const scope = globalThis as unknown as WorkerScope;
const inputIngress = installRenderInputIngressV1(scope);
const baselinePaint = new BaselinePaintRendererV1();
let surface: RendererSurfaceLikeV1 | null = null;
let tileState: RendererTileStateV1 | null = null;
let renderSchedulingController: RenderSchedulingControllerV1 | null = null;

const deviceManager = new RendererDeviceManagerV1({
  acquire: acquireCoreWebGpuV1,
  rebuild(device, generation) {
    const resources = rebuildRendererDeviceResourcesV1(device, generation, surface);
    tileState?.attachGpuDevice(device);
    baselinePaint.attachDevice(device);
    if (surface !== null && resources.canvasFormat !== null) {
      baselinePaint.attachSurface(surface, resources.canvasFormat);
    }
    renderSchedulingController?.attachGpuDevice(device);
  },
  onState(snapshot) {
    scope.postMessage({ type: 'renderer.device-state', snapshot });
  },
  onDiscardProvisional() {
    tileState?.attachGpuDevice(null);
    baselinePaint.attachDevice(null);
    renderSchedulingController?.attachGpuDevice(null);
    scope.postMessage({ type: 'renderer.provisional.discarded' });
  },
});

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function positiveDimension(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function nonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isResidency(value: unknown): value is TileCacheResidencyV1 {
  return (
    value === 'interaction' || value === 'visible' || value === 'near' || value === 'background'
  );
}

function isAtlasPixelFormat(value: unknown): value is GpuAtlasPixelFormatV1 {
  return value === 'rgba8-unorm' || value === 'rgba16-float';
}

function isDocumentWorkingSpace(value: unknown): value is DocumentColorSpace {
  return value === 'srgb' || value === 'display-p3';
}

function isDocumentPrecision(value: unknown): value is DocumentPrecision {
  return value === 'rgba8-unorm' || value === 'rgba16-float';
}

function parseMaskTile(value: unknown): BaselineRasterMaskTileImageV1 | null {
  if (
    !isRecord(value) ||
    !isRecord(value.coordinate) ||
    !nonNegativeInteger(value.coordinate.tx) ||
    !nonNegativeInteger(value.coordinate.ty) ||
    !positiveDimension(value.width) ||
    !positiveDimension(value.height) ||
    !(value.bytes instanceof Uint8Array) ||
    value.bytes.byteLength !== value.width * value.height * 4
  ) {
    return null;
  }
  return Object.freeze({
    coordinate: Object.freeze({ tx: value.coordinate.tx, ty: value.coordinate.ty }),
    width: value.width,
    height: value.height,
    bytes: value.bytes as Uint8Array<ArrayBuffer>,
  });
}

function parseRasterMasks(value: unknown): readonly BaselineRasterMaskDescriptorV1[] | null {
  if (value === undefined) return Object.freeze([]);
  if (!Array.isArray(value)) return null;
  const result: BaselineRasterMaskDescriptorV1[] = [];
  const seen = new Set<string>();
  for (const candidate of value) {
    if (
      !isRecord(candidate) ||
      typeof candidate.maskId !== 'string' ||
      candidate.maskId.length === 0 ||
      seen.has(candidate.maskId) ||
      typeof candidate.enabled !== 'boolean' ||
      typeof candidate.inverted !== 'boolean' ||
      (candidate.defaultCoverage !== 0 && candidate.defaultCoverage !== 1) ||
      !Array.isArray(candidate.effects) ||
      !Array.isArray(candidate.tiles)
    ) {
      return null;
    }
    const effects = candidate.effects.map((effect) => {
      if (
        !isRecord(effect) ||
        (effect.kind !== 'feather' && effect.kind !== 'blur') ||
        typeof effect.radiusPx !== 'number' ||
        !Number.isFinite(effect.radiusPx) ||
        effect.radiusPx < 0
      ) {
        return null;
      }
      return Object.freeze({ kind: effect.kind, radiusPx: effect.radiusPx });
    });
    if (effects.some((effect) => effect === null)) return null;
    const tiles = candidate.tiles.map(parseMaskTile);
    if (tiles.some((tile) => tile === null)) return null;
    let documentToMask: BaselineAffineMatrixV1 | undefined;
    if (candidate.documentToMask !== undefined) {
      if (
        !Array.isArray(candidate.documentToMask) ||
        candidate.documentToMask.length !== 6 ||
        candidate.documentToMask.some(
          (entry) => typeof entry !== 'number' || !Number.isFinite(entry),
        )
      ) {
        return null;
      }
      documentToMask = Object.freeze([...candidate.documentToMask]) as BaselineAffineMatrixV1;
    }
    seen.add(candidate.maskId);
    result.push(
      Object.freeze({
        maskId: candidate.maskId,
        enabled: candidate.enabled,
        inverted: candidate.inverted,
        defaultCoverage: candidate.defaultCoverage,
        effects: Object.freeze(effects as Exclude<(typeof effects)[number], null>[]),
        tiles: Object.freeze(tiles as BaselineRasterMaskTileImageV1[]),
        ...(documentToMask === undefined ? {} : { documentToMask }),
      }),
    );
  }
  return Object.freeze(result);
}

function parseRasterLayers(value: unknown): readonly BaselineRasterLayerDescriptorV1[] | null {
  if (!Array.isArray(value)) return null;
  const layers: BaselineRasterLayerDescriptorV1[] = [];
  const seen = new Set<string>();
  for (const candidate of value) {
    if (
      !isRecord(candidate) ||
      typeof candidate.layerId !== 'string' ||
      candidate.layerId.length === 0 ||
      seen.has(candidate.layerId) ||
      typeof candidate.visible !== 'boolean' ||
      typeof candidate.opacity !== 'number' ||
      (candidate.draft !== undefined && typeof candidate.draft !== 'boolean') ||
      (candidate.blendMode !== undefined && !isM5cBaseBlendModeV1(candidate.blendMode)) ||
      !Number.isFinite(candidate.opacity) ||
      candidate.opacity < 0 ||
      candidate.opacity > 1
    ) {
      return null;
    }
    const masks = parseRasterMasks(candidate.masks);
    if (
      masks === null ||
      (candidate.clippingBaseLayerId !== undefined &&
        (typeof candidate.clippingBaseLayerId !== 'string' ||
          candidate.clippingBaseLayerId.length === 0))
    ) {
      return null;
    }
    seen.add(candidate.layerId);
    layers.push(
      Object.freeze({
        layerId: candidate.layerId,
        visible: candidate.visible,
        opacity: candidate.opacity,
        draft: candidate.draft ?? false,
        ...(candidate.blendMode === undefined ? {} : { blendMode: candidate.blendMode }),
        ...(masks.length === 0 ? {} : { masks }),
        ...(candidate.clippingBaseLayerId === undefined
          ? {}
          : { clippingBaseLayerId: candidate.clippingBaseLayerId }),
      }),
    );
  }
  return layers.length === 0 ? null : Object.freeze(layers);
}

function parseRasterTileImage(value: unknown): BaselineRasterTileImageV1 | null {
  if (
    !isRecord(value) ||
    value.schema !== 'illustro.baseline-raster-tile/1' ||
    typeof value.layerId !== 'string' ||
    value.layerId.length === 0 ||
    !positiveDimension(value.width) ||
    !positiveDimension(value.height) ||
    !isDocumentPrecision(value.pixelFormat) ||
    !(value.bytes instanceof Uint8Array)
  ) {
    return null;
  }
  const coordinate = isRecord(value.coordinate) ? parseCoordinate(value.coordinate) : null;
  if (coordinate === null) return null;
  const bytesPerPixel = value.pixelFormat === 'rgba8-unorm' ? 4 : 8;
  if (value.bytes.byteLength !== value.width * value.height * bytesPerPixel) return null;
  return Object.freeze({
    schema: 'illustro.baseline-raster-tile/1' as const,
    layerId: value.layerId,
    coordinate,
    width: value.width,
    height: value.height,
    pixelFormat: value.pixelFormat,
    bytes: value.bytes as Uint8Array<ArrayBuffer>,
  });
}

function parseRasterTilePatches(value: unknown): readonly BaselineRasterTilePatchV1[] | null {
  if (!Array.isArray(value)) return null;
  const patches: BaselineRasterTilePatchV1[] = [];
  for (const candidate of value) {
    if (
      !isRecord(candidate) ||
      candidate.schema !== 'illustro.baseline-raster-tile-patch/1' ||
      typeof candidate.layerId !== 'string' ||
      candidate.layerId.length === 0
    ) {
      return null;
    }
    const coordinate = isRecord(candidate.coordinate)
      ? parseCoordinate(candidate.coordinate)
      : null;
    const before = candidate.before === null ? null : parseRasterTileImage(candidate.before);
    const after = candidate.after === null ? null : parseRasterTileImage(candidate.after);
    const imageMatchesPatch = (image: BaselineRasterTileImageV1 | null): boolean =>
      image === null ||
      (coordinate !== null &&
        image.layerId === candidate.layerId &&
        image.coordinate.tx === coordinate.tx &&
        image.coordinate.ty === coordinate.ty);
    if (
      coordinate === null ||
      (candidate.before !== null && before === null) ||
      (candidate.after !== null && after === null) ||
      (before === null && after === null) ||
      !imageMatchesPatch(before) ||
      !imageMatchesPatch(after)
    ) {
      return null;
    }
    patches.push(
      Object.freeze({
        schema: 'illustro.baseline-raster-tile-patch/1' as const,
        layerId: candidate.layerId,
        coordinate,
        before,
        after,
      }),
    );
  }
  return patches.length === 0 ? null : Object.freeze(patches);
}

function parseRasterTileImages(value: unknown): readonly BaselineRasterTileImageV1[] | null {
  if (!Array.isArray(value)) return null;
  const tiles: BaselineRasterTileImageV1[] = [];
  for (const candidate of value) {
    const tile = parseRasterTileImage(candidate);
    if (tile === null) return null;
    tiles.push(tile);
  }
  return Object.freeze(tiles);
}

function parseCoordinate(value: Readonly<Record<string, unknown>>): TileCoordinateV1 | null {
  if (!nonNegativeInteger(value.tx) || !nonNegativeInteger(value.ty)) return null;
  return Object.freeze({ tx: value.tx, ty: value.ty });
}

function parseDirtyRect(value: unknown): RectV1 | null {
  if (!isRecord(value)) return null;
  if (
    !nonNegativeInteger(value.x) ||
    !nonNegativeInteger(value.y) ||
    !positiveDimension(value.width) ||
    !positiveDimension(value.height)
  ) {
    return null;
  }
  return Object.freeze({ x: value.x, y: value.y, width: value.width, height: value.height });
}

function parseViewportRect(value: unknown): DocumentViewportRectV1 | null {
  if (!isRecord(value)) return null;
  const { x, y, width, height } = value;
  if (
    typeof x !== 'number' ||
    typeof y !== 'number' ||
    typeof width !== 'number' ||
    typeof height !== 'number' ||
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0 ||
    !Number.isFinite(x + width) ||
    !Number.isFinite(y + height)
  ) {
    return null;
  }
  return Object.freeze({ x, y, width, height });
}

function parseBaselineDabs(value: unknown): readonly BaselineBrushDabV1[] | null {
  if (!Array.isArray(value)) return null;
  const dabs: BaselineBrushDabV1[] = [];
  for (const candidate of value) {
    if (
      !isRecord(candidate) ||
      candidate.schema !== 'illustro.baseline-brush-dab/1' ||
      typeof candidate.x !== 'number' ||
      typeof candidate.y !== 'number' ||
      typeof candidate.radius !== 'number' ||
      typeof candidate.opacity !== 'number' ||
      !Number.isFinite(candidate.x) ||
      !Number.isFinite(candidate.y) ||
      !Number.isFinite(candidate.radius) ||
      !Number.isFinite(candidate.opacity) ||
      candidate.radius <= 0 ||
      candidate.opacity < 0 ||
      candidate.opacity > 1
    ) {
      return null;
    }
    const radiusX = candidate.radiusX;
    const radiusY = candidate.radiusY;
    if (
      (radiusX !== undefined &&
        (typeof radiusX !== 'number' || !Number.isFinite(radiusX) || radiusX <= 0)) ||
      (radiusY !== undefined &&
        (typeof radiusY !== 'number' || !Number.isFinite(radiusY) || radiusY <= 0))
    ) {
      return null;
    }
    let color: readonly [number, number, number] | undefined;
    if (candidate.color !== undefined) {
      if (!Array.isArray(candidate.color)) return null;
      try {
        color = freezeBaselineBrushColorV1(candidate.color as number[]);
      } catch {
        return null;
      }
    }
    dabs.push(
      Object.freeze({
        schema: 'illustro.baseline-brush-dab/1' as const,
        x: candidate.x,
        y: candidate.y,
        radius: candidate.radius,
        ...(radiusX === undefined ? {} : { radiusX }),
        ...(radiusY === undefined ? {} : { radiusY }),
        opacity: candidate.opacity,
        ...(color === undefined ? {} : { color }),
      }),
    );
  }
  return Object.freeze(dabs);
}

function parseBaselineCommittedStrokes(
  value: unknown,
): readonly BaselinePaintCommittedStrokeV1[] | null {
  if (!Array.isArray(value)) return null;
  const strokes: BaselinePaintCommittedStrokeV1[] = [];
  const seen = new Set<string>();
  for (const candidate of value) {
    if (
      !isRecord(candidate) ||
      typeof candidate.strokeId !== 'string' ||
      candidate.strokeId.length === 0
    ) {
      return null;
    }
    if (seen.has(candidate.strokeId)) return null;
    const dabs = parseBaselineDabs(candidate.dabs);
    if (dabs === null) return null;
    seen.add(candidate.strokeId);
    if (candidate.layerId !== undefined && typeof candidate.layerId !== 'string') return null;
    strokes.push(
      candidate.layerId === undefined
        ? Object.freeze({ strokeId: candidate.strokeId, dabs })
        : Object.freeze({ strokeId: candidate.strokeId, layerId: candidate.layerId, dabs }),
    );
  }
  return Object.freeze(strokes);
}

function isRendererSurface(value: unknown): value is RendererSurfaceLikeV1 {
  return (
    isRecord(value) &&
    typeof value.getContext === 'function' &&
    typeof value.width === 'number' &&
    typeof value.height === 'number'
  );
}

function parseRequest(value: unknown): RenderWorkerRequestV1 | null {
  if (!isRecord(value) || typeof value.type !== 'string') return null;
  if (value.type === 'ping' || value.type === 'renderer.dispose') return { type: value.type };
  if (
    (value.type === 'renderer.probe' || value.type === 'renderer.retry') &&
    typeof value.requestId === 'string'
  ) {
    return { type: value.type, requestId: value.requestId };
  }
  if (
    value.type === 'renderer.attach' &&
    typeof value.requestId === 'string' &&
    isRendererSurface(value.canvas) &&
    positiveDimension(value.width) &&
    positiveDimension(value.height)
  ) {
    return {
      type: value.type,
      requestId: value.requestId,
      canvas: value.canvas,
      width: value.width,
      height: value.height,
    };
  }
  if (
    value.type === 'renderer.resize' &&
    positiveDimension(value.width) &&
    positiveDimension(value.height)
  ) {
    return { type: value.type, width: value.width, height: value.height };
  }
  if (
    value.type === 'renderer.tiles.configure' &&
    typeof value.requestId === 'string' &&
    positiveDimension(value.width) &&
    positiveDimension(value.height) &&
    isDocumentWorkingSpace(value.workingSpace) &&
    isDocumentPrecision(value.precision)
  ) {
    const rasterLayers = parseRasterLayers(value.rasterLayers);
    if (rasterLayers === null) return null;
    return {
      type: value.type,
      requestId: value.requestId,
      width: value.width,
      height: value.height,
      workingSpace: value.workingSpace,
      precision: value.precision,
      rasterLayers,
    };
  }
  if (value.type === 'renderer.tiles.viewport' && typeof value.requestId === 'string') {
    const rect = parseViewportRect(value.rect);
    return rect === null ? null : { type: value.type, requestId: value.requestId, rect };
  }
  if (
    (value.type === 'renderer.paint.present' || value.type === 'renderer.paint.finalize') &&
    typeof value.requestId === 'string' &&
    typeof value.strokeId === 'string' &&
    value.strokeId.length > 0 &&
    typeof value.layerId === 'string' &&
    value.layerId.length > 0
  ) {
    const dabs = parseBaselineDabs(value.dabs);
    return dabs === null
      ? null
      : {
          type: value.type,
          requestId: value.requestId,
          strokeId: value.strokeId,
          layerId: value.layerId,
          dabs,
        };
  }
  if (value.type === 'renderer.paint.restore' && typeof value.requestId === 'string') {
    const strokes = parseBaselineCommittedStrokes(value.strokes);
    return strokes === null ? null : { type: value.type, requestId: value.requestId, strokes };
  }
  if (value.type === 'renderer.paint.restoreTiles' && typeof value.requestId === 'string') {
    const tiles = parseRasterTileImages(value.tiles);
    const rasterLayers = parseRasterLayers(value.rasterLayers);
    return tiles === null || rasterLayers === null
      ? null
      : { type: value.type, requestId: value.requestId, tiles, rasterLayers };
  }
  if (
    value.type === 'renderer.paint.exportTiles' &&
    typeof value.requestId === 'string' &&
    typeof value.composite === 'boolean' &&
    (value.includeDraft === undefined || typeof value.includeDraft === 'boolean')
  ) {
    const includeDraft = value.includeDraft;
    return {
      type: value.type,
      requestId: value.requestId,
      composite: value.composite,
      ...(typeof includeDraft === 'boolean' ? { includeDraft } : {}),
    };
  }
  if (
    value.type === 'renderer.paint.applyPatches' &&
    typeof value.requestId === 'string' &&
    (value.direction === 'before' || value.direction === 'after')
  ) {
    const patches = parseRasterTilePatches(value.patches);
    return patches === null
      ? null
      : {
          type: value.type,
          requestId: value.requestId,
          patches,
          direction: value.direction,
        };
  }
  if (
    value.type === 'renderer.paint.cancel' &&
    typeof value.requestId === 'string' &&
    typeof value.strokeId === 'string' &&
    value.strokeId.length > 0
  ) {
    return { type: value.type, requestId: value.requestId, strokeId: value.strokeId };
  }
  if (
    (value.type === 'renderer.tiles.allocate' ||
      value.type === 'renderer.tiles.deallocate' ||
      value.type === 'renderer.tiles.inspect' ||
      value.type === 'renderer.tiles.releaseGpu' ||
      value.type === 'renderer.tiles.dropCpu' ||
      value.type === 'renderer.tiles.markDirty' ||
      value.type === 'renderer.tiles.reserveGpu' ||
      value.type === 'renderer.tiles.upload' ||
      value.type === 'renderer.tiles.readback' ||
      value.type === 'renderer.tiles.cacheCpu') &&
    typeof value.requestId === 'string'
  ) {
    const coordinate = parseCoordinate(value);
    if (coordinate === null) return null;
    if (value.type === 'renderer.tiles.markDirty') {
      const rect = parseDirtyRect(value.rect);
      return rect === null
        ? null
        : { type: value.type, requestId: value.requestId, coordinate, rect };
    }
    if (value.type === 'renderer.tiles.reserveGpu' || value.type === 'renderer.tiles.upload') {
      if (!isAtlasPixelFormat(value.pixelFormat) || !isResidency(value.residency)) return null;
      return {
        type: value.type,
        requestId: value.requestId,
        coordinate,
        pixelFormat: value.pixelFormat,
        residency: value.residency,
      };
    }
    if (value.type === 'renderer.tiles.readback') {
      if (!isResidency(value.residency)) return null;
      return {
        type: value.type,
        requestId: value.requestId,
        coordinate,
        residency: value.residency,
      };
    }
    if (value.type === 'renderer.tiles.cacheCpu') {
      if (!(value.bytes instanceof ArrayBuffer) || !isResidency(value.residency)) return null;
      return {
        type: value.type,
        requestId: value.requestId,
        coordinate,
        bytes: value.bytes,
        residency: value.residency,
      };
    }
    return { type: value.type, requestId: value.requestId, coordinate };
  }
  return null;
}

function postResponse(
  requestId: string,
  ok: boolean,
  result: unknown,
  transfer: readonly Transferable[] = [],
): void {
  scope.postMessage({ type: 'renderer.response', requestId, ok, result }, transfer);
}

function requireTileState(): RendererTileStateV1 {
  if (tileState === null) throw new Error('renderer tile state is not configured');
  return tileState;
}

async function ensureReady(): Promise<boolean> {
  const snapshot = await deviceManager.start();
  return snapshot.state === 'ready' && deviceManager.currentDevice() !== null;
}

async function handleRequest(request: RenderWorkerRequestV1): Promise<void> {
  if (request.type === 'ping') {
    scope.postMessage({ type: 'pong', subsystem: 'render' });
    return;
  }
  if (request.type === 'renderer.dispose') {
    inputIngress.dispose();
    baselinePaint.dispose();
    tileState?.dispose();
    tileState = null;
    renderSchedulingController?.dispose();
    renderSchedulingController = null;
    deviceManager.dispose();
    surface = null;
    return;
  }
  if (request.type === 'renderer.resize') {
    if (surface !== null) {
      surface.width = request.width;
      surface.height = request.height;
    }
    return;
  }

  try {
    if (request.type === 'renderer.tiles.configure') {
      tileState?.dispose();
      tileState = new RendererTileStateV1(request.width, request.height);
      tileState.attachGpuDevice(deviceManager.currentDevice());
      baselinePaint.configureDocument(
        tileState,
        request.width,
        request.height,
        request.precision,
        request.rasterLayers,
        request.workingSpace,
      );
      postResponse(request.requestId, true, {
        ...tileState.snapshot(),
        workingSpace: request.workingSpace,
        precision: request.precision,
      });
      return;
    }
    if (request.type === 'renderer.paint.restore') {
      postResponse(request.requestId, true, baselinePaint.restoreCommittedStrokes(request.strokes));
      return;
    }
    if (request.type === 'renderer.paint.restoreTiles') {
      postResponse(
        request.requestId,
        true,
        baselinePaint.restoreCanonicalTiles(request.tiles, request.rasterLayers),
      );
      return;
    }
    if (request.type === 'renderer.paint.exportTiles') {
      const tiles = request.composite
        ? baselinePaint.exportCompositeTiles({ includeDraft: request.includeDraft ?? true })
        : baselinePaint.exportCanonicalTiles();
      postResponse(
        request.requestId,
        true,
        tiles,
        tiles.map((tile) => tile.bytes.buffer),
      );
      return;
    }
    if (request.type === 'renderer.paint.applyPatches') {
      postResponse(
        request.requestId,
        true,
        baselinePaint.applyTilePatches(request.patches, request.direction),
      );
      return;
    }
    if (request.type === 'renderer.paint.present') {
      postResponse(
        request.requestId,
        true,
        baselinePaint.presentStroke(request.strokeId, request.dabs, request.layerId),
      );
      return;
    }
    if (request.type === 'renderer.paint.cancel') {
      postResponse(request.requestId, true, baselinePaint.cancelStroke(request.strokeId));
      return;
    }
    if (request.type === 'renderer.paint.finalize') {
      postResponse(
        request.requestId,
        true,
        baselinePaint.finalizeStroke(request.strokeId, request.dabs, request.layerId),
      );
      return;
    }
    if (request.type === 'renderer.tiles.allocate') {
      const state = requireTileState();
      postResponse(request.requestId, true, {
        tile: state.allocate(request.coordinate),
        state: state.snapshot(),
      });
      return;
    }
    if (request.type === 'renderer.tiles.deallocate') {
      const state = requireTileState();
      postResponse(request.requestId, true, {
        removed: state.deallocate(request.coordinate),
        state: state.snapshot(),
      });
      return;
    }
    if (request.type === 'renderer.tiles.markDirty') {
      const state = requireTileState();
      postResponse(request.requestId, true, {
        dirty: state.markDirty(request.coordinate, request.rect),
        state: state.snapshot(),
      });
      return;
    }
    if (request.type === 'renderer.tiles.reserveGpu') {
      const state = requireTileState();
      postResponse(request.requestId, true, {
        slot: state.reserveGpuTile(request.coordinate, request.pixelFormat, request.residency),
        state: state.snapshot(),
      });
      return;
    }
    if (request.type === 'renderer.tiles.upload') {
      const state = requireTileState();
      postResponse(request.requestId, true, {
        transfer: state.uploadCpuBackingToGpu(
          request.coordinate,
          request.pixelFormat,
          request.residency,
        ),
        state: state.snapshot(),
      });
      return;
    }
    if (request.type === 'renderer.tiles.readback') {
      const state = requireTileState();
      postResponse(request.requestId, true, {
        transfer: await state.readbackGpuToCpu(request.coordinate, request.residency),
        state: state.snapshot(),
      });
      return;
    }
    if (request.type === 'renderer.tiles.releaseGpu') {
      const state = requireTileState();
      postResponse(request.requestId, true, {
        removed: state.releaseGpuTile(request.coordinate),
        state: state.snapshot(),
      });
      return;
    }
    if (request.type === 'renderer.tiles.cacheCpu') {
      const state = requireTileState();
      postResponse(request.requestId, true, {
        admitted: state.cacheCpuBacking(
          request.coordinate,
          new Uint8Array(request.bytes),
          request.residency,
        ),
        state: state.snapshot(),
      });
      return;
    }
    if (request.type === 'renderer.tiles.dropCpu') {
      const state = requireTileState();
      postResponse(request.requestId, true, {
        removed: state.releaseCpuBacking(request.coordinate),
        state: state.snapshot(),
      });
      return;
    }
    if (request.type === 'renderer.tiles.viewport') {
      const state = requireTileState();
      postResponse(request.requestId, true, state.resolveViewport(request.rect));
      return;
    }
    if (request.type === 'renderer.tiles.inspect') {
      const state = requireTileState();
      postResponse(request.requestId, true, {
        tile: state.getTile(request.coordinate),
        dirty: state.getDirty(request.coordinate),
        gpuSlot: state.getGpuSlot(request.coordinate),
        cpuBackingBytes: state.getCpuBacking(request.coordinate)?.byteLength ?? 0,
        state: state.snapshot(),
      });
      return;
    }
    if (request.type === 'renderer.probe') {
      await deviceManager.start();
      postResponse(request.requestId, true, deviceManager.snapshot());
      return;
    }

    if (request.type === 'renderer.attach') {
      if (!(await ensureReady())) {
        postResponse(request.requestId, false, deviceManager.snapshot());
        return;
      }
      surface = request.canvas;
      surface.width = request.width;
      surface.height = request.height;
      const device = deviceManager.currentDevice();
      if (device === null) {
        postResponse(request.requestId, false, deviceManager.snapshot());
        return;
      }
      const canvasFormat = configureRendererSurfaceV1(surface, device);
      tileState?.attachGpuDevice(device);
      baselinePaint.attachDevice(device);
      baselinePaint.attachSurface(surface, canvasFormat);
      postResponse(request.requestId, true, deviceManager.snapshot());
      return;
    }

    await deviceManager.start();
    const device = deviceManager.currentDevice();
    if (device !== null && surface !== null) {
      const canvasFormat = configureRendererSurfaceV1(surface, device);
      baselinePaint.attachDevice(device);
      baselinePaint.attachSurface(surface, canvasFormat);
    }
    postResponse(
      request.requestId,
      deviceManager.snapshot().state === 'ready',
      deviceManager.snapshot(),
    );
  } catch (error) {
    const requestId = 'requestId' in request ? request.requestId : null;
    if (requestId !== null) {
      postResponse(requestId, false, {
        snapshot: deviceManager.snapshot(),
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

renderSchedulingController = installRenderSchedulingExtensionV1(scope, {
  getTileState: () => tileState,
});
renderSchedulingController.attachGpuDevice(deviceManager.currentDevice());

scope.addEventListener('message', (event) => {
  if (inputIngress.handle(event.data)) return;
  const request = parseRequest(event.data);
  if (request === null) return;
  void handleRequest(request);
});

scope.postMessage({ type: 'worker.render.ready' });
