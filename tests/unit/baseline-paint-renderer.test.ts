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
  let instanceCount = 0;
  const bufferWrites: number[] = [];
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
    createCommandEncoder() {
      return {
        beginRenderPass() {
          renderPasses += 1;
          return {
            setPipeline() {},
            setVertexBuffer() {},
            draw(_vertexCount: number, nextInstanceCount: number) {
              drawCalls += 1;
              instanceCount = nextInstanceCount;
            },
            end() {},
          };
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
  return {
    device,
    surface,
    counts: () => ({ drawCalls, renderPasses, submits, instanceCount, bufferWrites }),
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
  return { harness, tileState, renderer };
}

describe('M4 baseline WebGPU paint renderer', () => {
  it('rasterizes provisional dabs through one instanced WebGPU render pass', () => {
    const { harness, renderer } = configuredRenderer();
    const snapshot = renderer.presentStroke('stroke-a', [dab(20, 30), dab(24, 30), dab(28, 30)]);

    expect(snapshot).toMatchObject({
      activeStrokeId: 'stroke-a',
      activeDabCount: 3,
      committedStrokeCount: 0,
      surfaceReady: true,
      deviceReady: true,
    });
    expect(harness.counts()).toMatchObject({
      drawCalls: 1,
      renderPasses: 1,
      submits: 1,
      instanceCount: 3,
      bufferWrites: [15],
    });
  });

  it('finalizes the same dabs into sparse-tile dirty state and leaves the canvas visible', () => {
    const { harness, tileState, renderer } = configuredRenderer();
    const dabs = [dab(255, 128)];
    renderer.presentStroke('stroke-b', dabs);
    const result = renderer.finalizeStroke('stroke-b', dabs);

    expect(result).toMatchObject({
      schema: 'illustro.baseline-paint-finalization/1',
      strokeId: 'stroke-b',
      dabCount: 1,
      affectedTiles: [
        { coordinate: { tx: 0, ty: 0 } },
        { coordinate: { tx: 1, ty: 0 } },
      ],
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
    expect(harness.counts()).toMatchObject({ renderPasses: 2, submits: 2 });
  });

  it('drops a cancelled provisional stroke without dirtying canonical sparse tiles', () => {
    const { harness, tileState, renderer } = configuredRenderer();
    renderer.presentStroke('stroke-c', [dab(64, 64)]);
    const snapshot = renderer.cancelStroke('stroke-c');

    expect(snapshot).toMatchObject({
      activeStrokeId: null,
      activeDabCount: 0,
      committedStrokeCount: 0,
    });
    expect(tileState.snapshot()).toMatchObject({ allocatedTileCount: 0, dirtyTileCount: 0 });
    expect(harness.counts()).toMatchObject({ renderPasses: 2, submits: 2 });
  });
});
