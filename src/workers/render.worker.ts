import type { GpuAtlasPixelFormatV1 } from '../gpu/gpu-atlas.js';
import type { BaselineBrushDabV1 } from '../gpu/baseline-brush.js';
import { BaselinePaintRendererV1 } from '../gpu/baseline-paint-renderer.js';
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
  postMessage(message: unknown): void;
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
      readonly dabs: readonly BaselineBrushDabV1[];
    }
  | {
      readonly type: 'renderer.paint.cancel';
      readonly requestId: string;
      readonly strokeId: string;
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
    dabs.push(
      Object.freeze({
        schema: 'illustro.baseline-brush-dab/1' as const,
        x: candidate.x,
        y: candidate.y,
        radius: candidate.radius,
        opacity: candidate.opacity,
      }),
    );
  }
  return Object.freeze(dabs);
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
    positiveDimension(value.height)
  ) {
    return {
      type: value.type,
      requestId: value.requestId,
      width: value.width,
      height: value.height,
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
    value.strokeId.length > 0
  ) {
    const dabs = parseBaselineDabs(value.dabs);
    return dabs === null
      ? null
      : { type: value.type, requestId: value.requestId, strokeId: value.strokeId, dabs };
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

function postResponse(requestId: string, ok: boolean, result: unknown): void {
  scope.postMessage({ type: 'renderer.response', requestId, ok, result });
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
      baselinePaint.configureDocument(tileState, request.width, request.height);
      postResponse(request.requestId, true, tileState.snapshot());
      return;
    }
    if (request.type === 'renderer.paint.present') {
      postResponse(
        request.requestId,
        true,
        baselinePaint.presentStroke(request.strokeId, request.dabs),
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
        baselinePaint.finalizeStroke(request.strokeId, request.dabs),
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
