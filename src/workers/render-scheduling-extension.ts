import {
  buildFrameCompositePlanV1,
  enqueueFrameCompositePlanV1,
  type FrameCompositeColorSpaceV1,
  type FrameCompositeNodeV1,
  type FrameCompositePrecisionV1,
  type FrameCompositeQualityV1,
} from '../gpu/frame-compositor.js';
import {
  RenderSchedulerV1,
  type RenderPriorityV1,
  type RenderTaskDescriptorV1,
} from '../gpu/render-scheduler.js';
import type { RendererTileStateV1 } from '../gpu/renderer-tile-state.js';
import {
  TransientTargetManagerV1,
  type TransientTargetDescriptorV1,
  type TransientTargetKindV1,
  type TransientTargetStrategyV1,
} from '../gpu/transient-targets.js';
import type { GpuAtlasPixelFormatV1 } from '../gpu/gpu-atlas.js';
import type { IllustroGpuDeviceV1 } from '../gpu/webgpu-capability.js';
import type { DocumentViewportRectV1 } from '../gpu/viewport-tiles.js';

const TRANSIENT_TEXTURE_USAGE = 0x01 | 0x02 | 0x04 | 0x08 | 0x10;

type WorkerMessageEvent<T> = { readonly data: T };
export interface RenderSchedulingScopeV1 {
  addEventListener(type: 'message', listener: (event: WorkerMessageEvent<unknown>) => void): void;
  postMessage(message: unknown): void;
}

interface TransientTextureLikeV1 {
  destroy?(): void;
}

interface TransientTextureDeviceV1 extends IllustroGpuDeviceV1 {
  createTexture?(descriptor: {
    readonly label: string;
    readonly size: {
      readonly width: number;
      readonly height: number;
      readonly depthOrArrayLayers: number;
    };
    readonly format: 'rgba8unorm' | 'rgba16float';
    readonly usage: number;
  }): TransientTextureLikeV1;
}

export interface RenderSchedulingControllerV1 {
  attachGpuDevice(device: IllustroGpuDeviceV1 | null): void;
  dispose(): void;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isPriority(value: unknown): value is RenderPriorityV1 {
  return value === 'P0' || value === 'P1' || value === 'P2' || value === 'P3';
}

function isPixelFormat(value: unknown): value is GpuAtlasPixelFormatV1 {
  return value === 'rgba8-unorm' || value === 'rgba16-float';
}

function isTargetKind(value: unknown): value is TransientTargetKindV1 {
  return value === 'filter-halo' || value === 'compositor-intermediate';
}

function isTargetStrategy(value: unknown): value is TransientTargetStrategyV1 {
  return (
    value === 'direct-tile' ||
    value === 'expanded-region' ||
    value === 'separable' ||
    value === 'multiscale'
  );
}

function isQuality(value: unknown): value is FrameCompositeQualityV1 {
  return value === 'interactive' || value === 'full';
}

function isColorSpace(value: unknown): value is FrameCompositeColorSpaceV1 {
  return value === 'srgb' || value === 'display-p3';
}

function isPrecision(value: unknown): value is FrameCompositePrecisionV1 {
  return value === 'rgba8-unorm' || value === 'rgba16-float';
}

function parseViewport(value: unknown): DocumentViewportRectV1 | null {
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
    height <= 0
  ) {
    return null;
  }
  return Object.freeze({ x, y, width, height });
}

function parseNodes(value: unknown): readonly FrameCompositeNodeV1[] | null {
  if (!Array.isArray(value)) return null;
  const nodes: FrameCompositeNodeV1[] = [];
  for (const item of value) {
    if (!isRecord(item)) return null;
    const dependencies = item.dependencyRevisionKeys;
    if (
      typeof item.nodeId !== 'string' ||
      !isNonNegativeInteger(item.revision) ||
      typeof item.visible !== 'boolean' ||
      typeof item.opacity !== 'number' ||
      !Number.isFinite(item.opacity) ||
      typeof item.blendMode !== 'string' ||
      !Array.isArray(dependencies) ||
      !dependencies.every((entry) => typeof entry === 'string')
    ) {
      return null;
    }
    nodes.push(
      Object.freeze({
        nodeId: item.nodeId,
        revision: item.revision,
        visible: item.visible,
        opacity: item.opacity,
        blendMode: item.blendMode,
        dependencyRevisionKeys: Object.freeze([...dependencies]),
      }),
    );
  }
  return Object.freeze(nodes);
}

function postResponse(
  scope: RenderSchedulingScopeV1,
  requestId: string,
  ok: boolean,
  result: unknown,
): void {
  scope.postMessage({ type: 'renderer.response', requestId, ok, result });
}

function webGpuFormat(pixelFormat: GpuAtlasPixelFormatV1): 'rgba8unorm' | 'rgba16float' {
  return pixelFormat === 'rgba8-unorm' ? 'rgba8unorm' : 'rgba16float';
}

export function installRenderSchedulingExtensionV1(
  scope: RenderSchedulingScopeV1,
  input: { readonly getTileState: () => Pick<RendererTileStateV1, 'resolveViewport'> | null },
): RenderSchedulingControllerV1 {
  const scheduler = new RenderSchedulerV1<unknown>();
  let gpuDevice: TransientTextureDeviceV1 | null = null;
  let transientTargets: TransientTargetManagerV1<TransientTextureLikeV1> | null = null;

  const attachGpuDevice = (device: IllustroGpuDeviceV1 | null): void => {
    transientTargets?.clear();
    gpuDevice = device as TransientTextureDeviceV1 | null;
    transientTargets =
      gpuDevice?.createTexture === undefined
        ? null
        : new TransientTargetManagerV1({
            create(descriptor: TransientTargetDescriptorV1) {
              const activeDevice = gpuDevice;
              if (activeDevice?.createTexture === undefined) {
                throw new Error('renderer GPU device is unavailable for transient targets');
              }
              return activeDevice.createTexture({
                label: `illustro-${descriptor.kind}-${descriptor.targetId}`,
                size: {
                  width: descriptor.width,
                  height: descriptor.height,
                  depthOrArrayLayers: 1,
                },
                format: webGpuFormat(descriptor.pixelFormat),
                usage: TRANSIENT_TEXTURE_USAGE,
              });
            },
            destroy(texture) {
              texture.destroy?.();
            },
          });
  };

  scope.addEventListener('message', (event) => {
    const value = event.data;
    if (!isRecord(value) || typeof value.type !== 'string' || typeof value.requestId !== 'string') {
      return;
    }
    const requestId = value.requestId;
    try {
      if (value.type === 'renderer.transient.inspect') {
        postResponse(scope, requestId, true, transientTargets?.snapshot() ?? null);
        return;
      }
      if (value.type === 'renderer.transient.release') {
        if (typeof value.targetId !== 'string') return;
        postResponse(scope, requestId, true, {
          released: transientTargets?.release(value.targetId) ?? false,
          state: transientTargets?.snapshot() ?? null,
        });
        return;
      }
      if (value.type === 'renderer.transient.acquire') {
        if (
          !isTargetKind(value.kind) ||
          !isTargetStrategy(value.strategy) ||
          !isPixelFormat(value.pixelFormat) ||
          !isPositiveInteger(value.coreWidth) ||
          !isPositiveInteger(value.coreHeight) ||
          !isNonNegativeInteger(value.haloPx)
        ) {
          return;
        }
        if (transientTargets === null) throw new Error('renderer GPU device is not attached');
        const target = transientTargets.acquire({
          kind: value.kind,
          strategy: value.strategy,
          pixelFormat: value.pixelFormat,
          coreWidth: value.coreWidth,
          coreHeight: value.coreHeight,
          haloPx: value.haloPx,
        });
        postResponse(scope, requestId, true, {
          descriptor: target.descriptor,
          state: transientTargets.snapshot(),
        });
        return;
      }
      if (value.type === 'renderer.schedule.inspect') {
        postResponse(scope, requestId, true, scheduler.snapshot());
        return;
      }
      if (value.type === 'renderer.schedule.drain') {
        if (!isNonNegativeInteger(value.maxTasks)) return;
        postResponse(scope, requestId, true, {
          tasks: scheduler.drain(value.maxTasks),
          state: scheduler.snapshot(),
        });
        return;
      }
      if (value.type === 'renderer.schedule.enqueue') {
        const task = value.task;
        if (
          !isRecord(task) ||
          typeof task.id !== 'string' ||
          !isPriority(task.priority) ||
          typeof task.kind !== 'string'
        ) {
          return;
        }
        const descriptor: RenderTaskDescriptorV1<unknown> = Object.freeze({
          id: task.id,
          priority: task.priority,
          kind: task.kind,
          payload: task.payload,
        });
        postResponse(scope, requestId, true, {
          result: scheduler.enqueue(descriptor),
          state: scheduler.snapshot(),
        });
        return;
      }
      if (value.type === 'renderer.frame.plan') {
        const viewport = parseViewport(value.viewport);
        const nodes = parseNodes(value.nodes);
        if (
          typeof value.frameId !== 'string' ||
          viewport === null ||
          nodes === null ||
          !isQuality(value.quality) ||
          !isColorSpace(value.colorSpace) ||
          !isPrecision(value.precision) ||
          typeof value.interactionCritical !== 'boolean'
        ) {
          return;
        }
        const tileState = input.getTileState();
        if (tileState === null) throw new Error('renderer tile state is not configured');
        const visible = tileState.resolveViewport(viewport).visible;
        const plan = buildFrameCompositePlanV1({
          frameId: value.frameId,
          visibleTiles: visible,
          nodes,
          quality: value.quality,
          colorSpace: value.colorSpace,
          precision: value.precision,
        });
        const schedule = enqueueFrameCompositePlanV1(scheduler, plan, value.interactionCritical);
        postResponse(scope, requestId, schedule.accepted, {
          plan,
          schedule,
          scheduler: scheduler.snapshot(),
        });
      }
    } catch (error) {
      postResponse(scope, requestId, false, {
        message: error instanceof Error ? error.message : String(error),
        scheduler: scheduler.snapshot(),
        transient: transientTargets?.snapshot() ?? null,
      });
    }
  });

  return Object.freeze({
    attachGpuDevice,
    dispose() {
      scheduler.clear();
      transientTargets?.clear();
      transientTargets = null;
      gpuDevice = null;
    },
  });
}
