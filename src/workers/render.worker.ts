import { acquireCoreWebGpuV1 } from '../gpu/webgpu-capability.js';
import { RendererDeviceManagerV1 } from '../gpu/renderer-device-manager.js';
import {
  configureRendererSurfaceV1,
  rebuildRendererDeviceResourcesV1,
  type RendererSurfaceLikeV1,
} from '../gpu/renderer-device-resources.js';

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
  | { readonly type: 'renderer.dispose' };

const scope = globalThis as unknown as WorkerScope;
let surface: RendererSurfaceLikeV1 | null = null;

const deviceManager = new RendererDeviceManagerV1({
  acquire: acquireCoreWebGpuV1,
  rebuild(device, generation) {
    rebuildRendererDeviceResourcesV1(device, generation, surface);
  },
  onState(snapshot) {
    scope.postMessage({ type: 'renderer.device-state', snapshot });
  },
  onDiscardProvisional() {
    scope.postMessage({ type: 'renderer.provisional.discarded' });
  },
});

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function positiveDimension(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
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
  return null;
}

function postResponse(requestId: string, ok: boolean, result: unknown): void {
  scope.postMessage({ type: 'renderer.response', requestId, ok, result });
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
      configureRendererSurfaceV1(surface, device);
      postResponse(request.requestId, true, deviceManager.snapshot());
      return;
    }

    await deviceManager.start();
    const device = deviceManager.currentDevice();
    if (device !== null && surface !== null) configureRendererSurfaceV1(surface, device);
    postResponse(request.requestId, deviceManager.snapshot().state === 'ready', deviceManager.snapshot());
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

scope.addEventListener('message', (event) => {
  const request = parseRequest(event.data);
  if (request === null) return;
  void handleRequest(request);
});

scope.postMessage({ type: 'worker.render.ready' });
