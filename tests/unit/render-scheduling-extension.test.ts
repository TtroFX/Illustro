import { describe, expect, it } from 'vitest';
import { installRenderSchedulingExtensionV1 } from '../../src/workers/render-scheduling-extension.js';
import type { IllustroGpuDeviceV1 } from '../../src/gpu/webgpu-capability.js';

type Listener = (event: { readonly data: unknown }) => void;

function createScope() {
  const listeners: Listener[] = [];
  const messages: unknown[] = [];
  return {
    scope: {
      addEventListener(_type: 'message', listener: Listener) {
        listeners.push(listener);
      },
      postMessage(message: unknown) {
        messages.push(message);
      },
    },
    emit(data: unknown) {
      for (const listener of listeners) listener({ data });
    },
    messages,
  };
}

function fakeDevice(destroyed: string[]): IllustroGpuDeviceV1 {
  return {
    lost: new Promise(() => undefined),
    createShaderModule: () => ({}),
    createTexture: (descriptor: { readonly label: string }) => ({
      destroy: () => destroyed.push(descriptor.label),
    }),
  } as IllustroGpuDeviceV1;
}

describe('M3 render scheduling production worker extension', () => {
  it('allocates transient GPU targets and clears them on GPU generation change', () => {
    const harness = createScope();
    const destroyed: string[] = [];
    const controller = installRenderSchedulingExtensionV1(harness.scope, {
      getTileState: () => null,
    });
    controller.attachGpuDevice(fakeDevice(destroyed));
    harness.emit({
      type: 'renderer.transient.acquire',
      requestId: 'target-1',
      kind: 'filter-halo',
      strategy: 'direct-tile',
      pixelFormat: 'rgba8-unorm',
      coreWidth: 256,
      coreHeight: 256,
      haloPx: 32,
    });
    expect(harness.messages.at(-1)).toMatchObject({
      type: 'renderer.response',
      requestId: 'target-1',
      ok: true,
      result: { state: { activeCount: 1 } },
    });
    controller.attachGpuDevice(fakeDevice(destroyed));
    expect(destroyed).toHaveLength(1);
    controller.dispose();
  });

  it('plans only viewport-visible tiles and queues the frame through P1 scheduling', () => {
    const harness = createScope();
    const controller = installRenderSchedulingExtensionV1(harness.scope, {
      getTileState: () => ({
        resolveViewport: () => ({
          schema: 'illustro.viewport-tiles/1',
          visible: [{ tx: 3, ty: 4 }],
          bounds: [],
        }),
      }),
    });
    harness.emit({
      type: 'renderer.frame.plan',
      requestId: 'frame-request',
      frameId: 'frame-a',
      viewport: { x: 0.5, y: 0.5, width: 200, height: 200 },
      nodes: [
        {
          nodeId: 'layer-a',
          revision: 1,
          visible: true,
          opacity: 1,
          blendMode: 'normal',
          dependencyRevisionKeys: [],
        },
      ],
      quality: 'full',
      colorSpace: 'srgb',
      precision: 'rgba8-unorm',
      interactionCritical: false,
    });
    expect(harness.messages.at(-1)).toMatchObject({
      type: 'renderer.response',
      requestId: 'frame-request',
      ok: true,
      result: {
        plan: { tiles: [{ coordinate: { tx: 3, ty: 4 } }] },
        scheduler: { byPriority: { P1: 2 } },
      },
    });
    controller.dispose();
  });
});
