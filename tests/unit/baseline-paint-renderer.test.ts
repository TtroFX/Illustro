import { describe, expect, it } from 'vitest';
import type { BaselineBrushDabV1 } from '../../src/gpu/baseline-brush.js';
import { BaselinePaintRendererV1 } from '../../src/gpu/baseline-paint-renderer.js';
import { RendererTileStateV1 } from '../../src/gpu/renderer-tile-state.js';

function dab(x: number, y: number): BaselineBrushDabV1 {
  return Object.freeze({
    schema: 'illustro.baseline-brush-dab/1' as const,
    x,
    y,
    radius: 8,
    opacity: 1,
  });
}

function gpuHarness() {
  let drawCalls = 0;
  let renderPasses = 0;
  let submits = 0;
  let textureCopies = 0;
  const instanceCounts: number[] = [];
  const bufferWrites: number[] = [];
  const loadOps: Array<'clear' | 'load'> = [];
  const device = {
    lost: new Promise<never>(() => undefined),
    createShaderModule() {
      return {};
    },
    createRenderPipeline() {
      return {};
    },
    createBuffer(descriptor: { readonly size: number }) {
      return { descriptor, destroy() {} };
    },
    createTexture() {
      return {
        createView() {
          return {};
        },
        destroy() {},
      };
    },
    createCommandEncoder() {
      return {
        beginRenderPass(descriptor: {
          readonly colorAttachments: readonly [
            {
              readonly loadOp: 'clear' | 'load';
            },
          ];
        }) {
          renderPasses += 1;
          loadOps.push(descriptor.colorAttachments[0].loadOp);
          return {
            setPipeline() {},
            setVertexBuffer() {},
            draw(_vertexCount: number, nextInstanceCount: number) {
              drawCalls += 1;
              instanceCounts.push(nextInstanceCount);
            },
            end() {},
          };
        },
        copyTextureToTexture() {
          textureCopies += 1;
        },
        finish() {
          return {};
        },
      };
    },
    queue: {
      writeBuffer(_buffer: object, _offset: number, values: Float32Array) {
        bufferWrites.push(values.length);
      },
      submit() {
        submits += 1;
      },
    },
  };
  const surface = {
    width: 512,
    height: 256,
    getContext(contextId: string) {
      if (contextId !== 'webgpu') return null;
      return {
        getCurrentTexture() {
          return { createView: () => ({}) };
        },
      };
    },
  };
  const reset = (): void => {
    drawCalls = 0;
    renderPasses = 0;
    submits = 0;
    textureCopies = 0;
    instanceCounts.length = 0;
    bufferWrites.length = 0;
    loadOps.length = 0;
  };
  return {
    device,
    surface,
    reset,
    counts: () => ({
      drawCalls,
      renderPasses,
      submits,
      textureCopies,
      instanceCounts: [...instanceCounts],
      bufferWrites: [...bufferWrites],
      loadOps: [...loadOps],
    }),
  };
}

function configuredRenderer() {
  const harness = gpuHarness();
  const tileState = new RendererTileStateV1(512, 256);
  const renderer = new BaselinePaintRendererV1();
  tileState.attachGpuDevice(harness.device);
  renderer.attachDevice(harness.device);
  renderer.attachSurface(harness.surface, 'bgra8unorm');
  renderer.configureDocument(tileState, 512, 256);
  harness.reset();
  return { harness, tileState, renderer };
}

describe('M4 baseline WebGPU paint renderer', () => {
  it('rasterizes provisional dabs through one retained-scene WebGPU render pass', () => {
    const { harness, renderer } = configuredRenderer();
    const snapshot = renderer.presentStroke('stroke-a', [dab(20, 30), dab(24, 30), dab(28, 30)]);

    expect(snapshot).toMatchObject({
      activeStrokeId: 'stroke-a',
      activeDabCount: 3,
      committedStrokeCount: 0,
      surfaceReady: true,
      deviceReady: true,
    });
    expect(harness.counts()).toEqual({
      drawCalls: 1,
      renderPasses: 1,
      submits: 1,
      textureCopies: 1,
      instanceCounts: [3],
      bufferWrites: [15],
      loadOps: ['load'],
    });
  });

  it('appends only the dab delta instead of replaying the stable stroke prefix', () => {
    const { harness, renderer } = configuredRenderer();

    renderer.presentStroke('stroke-long', [dab(20, 30), dab(24, 30)]);
    renderer.presentStroke('stroke-long', [dab(28, 30)]);
    const snapshot = renderer.presentStroke('stroke-long', [dab(32, 30)]);

    expect(snapshot).toMatchObject({ activeStrokeId: 'stroke-long', activeDabCount: 4 });
    expect(harness.counts()).toEqual({
      drawCalls: 3,
      renderPasses: 3,
      submits: 3,
      textureCopies: 3,
      instanceCounts: [2, 1, 1],
      bufferWrites: [10, 5, 5],
      loadOps: ['load', 'load', 'load'],
    });
  });

  it('finalizes already-rasterized dabs without replaying them and marks sparse-tile dirtiness', () => {
    const { harness, tileState, renderer } = configuredRenderer();
    const dabs = [dab(255, 128)];
    renderer.presentStroke('stroke-b', dabs);
    const result = renderer.finalizeStroke('stroke-b', dabs);

    expect(result).toMatchObject({
      schema: 'illustro.baseline-paint-finalization/1',
      strokeId: 'stroke-b',
      dabCount: 1,
      affectedTiles: [{ coordinate: { tx: 0, ty: 0 } }, { coordinate: { tx: 1, ty: 0 } }],
      renderer: {
        activeStrokeId: null,
        activeDabCount: 0,
        committedStrokeCount: 1,
        committedDabCount: 1,
      },
    });
    expect(tileState.snapshot()).toMatchObject({ allocatedTileCount: 2, dirtyTileCount: 2 });
    expect(tileState.getDirty({ tx: 0, ty: 0 })).toMatchObject({
      coordinate: { tx: 0, ty: 0 },
      region: { kind: 'rect', rect: { x: 247, y: 120, width: 9, height: 16 } },
    });
    expect(tileState.getDirty({ tx: 1, ty: 0 })).toMatchObject({
      coordinate: { tx: 1, ty: 0 },
      region: { kind: 'rect', rect: { x: 0, y: 120, width: 7, height: 16 } },
    });
    expect(harness.counts()).toEqual({
      drawCalls: 1,
      renderPasses: 1,
      submits: 1,
      textureCopies: 1,
      instanceCounts: [1],
      bufferWrites: [5],
      loadOps: ['load'],
    });
  });

  it('appends only a missing final tail when pointerup contributes the endpoint', () => {
    const { harness, renderer } = configuredRenderer();
    const first = dab(64, 64);
    const endpoint = dab(68, 64);

    renderer.presentStroke('stroke-tail', [first]);
    const result = renderer.finalizeStroke('stroke-tail', [first, endpoint]);

    expect(result.renderer).toMatchObject({
      activeStrokeId: null,
      committedStrokeCount: 1,
      committedDabCount: 2,
    });
    expect(harness.counts()).toMatchObject({
      drawCalls: 2,
      renderPasses: 2,
      submits: 2,
      textureCopies: 2,
      instanceCounts: [1, 1],
      bufferWrites: [5, 5],
      loadOps: ['load', 'load'],
    });
  });

  it('rebuilds the retained scene from committed state when a provisional stroke is cancelled', () => {
    const { harness, tileState, renderer } = configuredRenderer();
    renderer.presentStroke('stroke-c', [dab(64, 64)]);
    const snapshot = renderer.cancelStroke('stroke-c');

    expect(snapshot).toMatchObject({
      activeStrokeId: null,
      activeDabCount: 0,
      committedStrokeCount: 0,
    });
    expect(tileState.snapshot()).toMatchObject({ allocatedTileCount: 0, dirtyTileCount: 0 });
    expect(harness.counts()).toMatchObject({
      renderPasses: 2,
      submits: 2,
      textureCopies: 2,
      instanceCounts: [1],
      loadOps: ['load', 'clear'],
    });
  });

  it('restores canonical committed strokes and redraws them after a GPU rebuild', () => {
    const { harness, tileState, renderer } = configuredRenderer();
    renderer.restoreCommittedStrokes([
      { strokeId: 'stroke-restored', dabs: [dab(64, 64), dab(260, 64)] },
    ]);
    expect(renderer.snapshot()).toMatchObject({ committedStrokeCount: 1, committedDabCount: 2 });
    expect(tileState.snapshot().dirtyTileCount).toBe(2);
    const beforeRebuild = harness.counts().renderPasses;

    renderer.attachDevice(null);
    renderer.attachDevice(harness.device);

    expect(renderer.snapshot()).toMatchObject({ committedStrokeCount: 1, committedDabCount: 2 });
    expect(harness.counts().renderPasses).toBeGreaterThan(beforeRebuild);
  });

  it('re-presents canonical committed strokes after a GPU device rebuild', () => {
    const first = gpuHarness();
    const tileState = new RendererTileStateV1(512, 256);
    const renderer = new BaselinePaintRendererV1();
    tileState.attachGpuDevice(first.device);
    renderer.attachDevice(first.device);
    renderer.attachSurface(first.surface, 'bgra8unorm');
    renderer.configureDocument(tileState, 512, 256);
    renderer.finalizeStroke('stroke-rebuild', [dab(80, 90)]);

    const second = gpuHarness();
    tileState.attachGpuDevice(null);
    renderer.attachDevice(null);
    tileState.attachGpuDevice(second.device);
    renderer.attachDevice(second.device);

    expect(renderer.snapshot()).toMatchObject({
      committedStrokeCount: 1,
      committedDabCount: 1,
      deviceReady: true,
    });
    expect(second.counts()).toEqual({
      drawCalls: 1,
      renderPasses: 1,
      submits: 1,
      textureCopies: 1,
      instanceCounts: [1],
      bufferWrites: [5],
      loadOps: ['clear'],
    });
  });
});
