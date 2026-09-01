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
  let textureWrites = 0;
  let bufferCreates = 0;
  let bufferDestroys = 0;
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
      bufferCreates += 1;
      return {
        descriptor,
        destroy() {
          bufferDestroys += 1;
        },
      };
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
      writeTexture() {
        textureWrites += 1;
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
    textureWrites = 0;
    bufferCreates = 0;
    bufferDestroys = 0;
    instanceCounts.length = 0;
    bufferWrites.length = 0;
    loadOps.length = 0;
  };
  return {
    device,
    surface,
    reset,
    bufferCounts: () => ({ creates: bufferCreates, destroys: bufferDestroys }),
    counts: () => ({
      drawCalls,
      renderPasses,
      submits,
      textureCopies,
      textureWrites,
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
      textureWrites: 0,
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
      textureWrites: 0,
      instanceCounts: [2, 1, 1],
      bufferWrites: [10, 5, 5],
      loadOps: ['load', 'load', 'load'],
    });
    expect(harness.bufferCounts()).toEqual({ creates: 1, destroys: 0 });
  });

  it('finalizes already-rasterized dabs without replaying them and marks sparse-tile dirtiness', () => {
    const { harness, tileState, renderer } = configuredRenderer();
    const dabs = [dab(127, 64)];
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
      region: { kind: 'rect', rect: { x: 119, y: 56, width: 9, height: 16 } },
    });
    expect(tileState.getDirty({ tx: 1, ty: 0 })).toMatchObject({
      coordinate: { tx: 1, ty: 0 },
      region: { kind: 'rect', rect: { x: 0, y: 56, width: 7, height: 16 } },
    });
    expect(harness.counts()).toEqual({
      drawCalls: 1,
      renderPasses: 1,
      submits: 1,
      textureCopies: 1,
      textureWrites: 0,
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
      textureWrites: 0,
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
      renderPasses: 1,
      submits: 2,
      textureCopies: 2,
      textureWrites: 1,
      instanceCounts: [1],
      loadOps: ['load'],
    });
  });

  it('restores canonical committed strokes and redraws them after a GPU rebuild', () => {
    const { harness, tileState, renderer } = configuredRenderer();
    renderer.restoreCommittedStrokes([
      { strokeId: 'stroke-restored', dabs: [dab(64, 64), dab(192, 64)] },
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
      drawCalls: 0,
      renderPasses: 1,
      submits: 2,
      textureCopies: 2,
      textureWrites: 1,
      instanceCounts: [],
      bufferWrites: [],
      loadOps: ['clear'],
    });
  });

  it('keeps finalize work bounded to one affected tile at 100, 1,000, and 10,000 strokes', () => {
    const tileState = new RendererTileStateV1(1, 1);
    const renderer = new BaselinePaintRendererV1();
    renderer.configureDocument(tileState, 1, 1);
    const onePixelDab = dab(0.5, 0.5);
    const checkpoints = new Set([100, 1_000, 10_000]);
    const windowStarts = new Set([1, 901, 9_901]);
    const timings: Record<number, number> = {};
    let windowStartedAt = performance.now();
    for (let stroke = 1; stroke <= 10_000; stroke += 1) {
      if (windowStarts.has(stroke)) windowStartedAt = performance.now();
      const finalization = renderer.finalizeStroke(`scale-${stroke}`, [onePixelDab]);
      if (!checkpoints.has(stroke)) continue;
      timings[stroke] = performance.now() - windowStartedAt;
      expect(finalization.affectedTiles).toHaveLength(1);
      expect(finalization.tilePatches).toHaveLength(1);
      expect(finalization.tilePatches[0]?.coordinate).toEqual({ tx: 0, ty: 0 });
    }
    expect(renderer.snapshot()).toMatchObject({
      committedStrokeCount: 10_000,
      committedDabCount: 10_000,
    });
    expect(tileState.snapshot()).toMatchObject({ allocatedTileCount: 1, dirtyTileCount: 1 });
    console.info(JSON.stringify({ benchmark: 'paint-finalize-100-window-ms', timings }));
  });
});
