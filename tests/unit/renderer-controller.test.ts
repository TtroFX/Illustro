import { describe, expect, it } from 'vitest';
import type { BaselineBrushDabV1 } from '../../src/gpu/baseline-brush.js';
import {
  RendererControllerV1,
  selectRendererExecutionPathV1,
  shouldHandoffRendererToCompatibilityV1,
} from '../../src/app/renderer-controller.js';
import type { FoundationShell } from '../../src/app/shell.js';

interface WorkerRequestV1 extends Readonly<Record<string, unknown>> {
  readonly type: string;
  readonly requestId?: string;
}

function readyDeviceSnapshotV1(): Readonly<Record<string, unknown>> {
  return Object.freeze({
    schema: 'illustro.renderer-device-state/1',
    state: 'ready',
    generation: 1,
    reacquireAttempt: 0,
  });
}

function paintSnapshotV1(strokeId: string | null, activeDabCount: number): Readonly<Record<string, unknown>> {
  return Object.freeze({
    schema: 'illustro.baseline-paint-renderer/1',
    documentWidth: 64,
    documentHeight: 64,
    activeStrokeId: strokeId,
    activeDabCount,
    committedStrokeCount: 0,
    committedDabCount: 0,
    surfaceReady: true,
    deviceReady: true,
  });
}

class FakeRendererWorkerV1 {
  readonly #listeners = new Set<(event: MessageEvent<unknown>) => void>();
  readonly requestOrder: string[] = [];
  readonly pendingPresent: WorkerRequestV1[] = [];

  postMessage(message: unknown, _transfer?: readonly Transferable[]): void {
    if (typeof message !== 'object' || message === null || !('type' in message)) return;
    const request = message as WorkerRequestV1;
    this.requestOrder.push(request.type);
    if (request.type === 'renderer.probe' || request.type === 'renderer.attach') {
      this.#respond(request, readyDeviceSnapshotV1());
      return;
    }
    if (request.type === 'renderer.tiles.configure') {
      this.#respond(request, Object.freeze({ configured: true }));
      return;
    }
    if (request.type === 'renderer.paint.present') {
      this.pendingPresent.push(request);
      return;
    }
    if (request.type === 'renderer.paint.finalize') {
      const strokeId = typeof request.strokeId === 'string' ? request.strokeId : 'stroke-a';
      this.#respond(
        request,
        Object.freeze({
          schema: 'illustro.baseline-paint-finalization/1',
          strokeId,
          dabCount: Array.isArray(request.dabs) ? request.dabs.length : 0,
          affectedTiles: Object.freeze([]),
          tilePatches: Object.freeze([]),
          renderer: paintSnapshotV1(null, 0),
        }),
      );
    }
  }

  addEventListener(_type: 'message', listener: (event: MessageEvent<unknown>) => void): void {
    this.#listeners.add(listener);
  }

  removeEventListener(_type: 'message', listener: (event: MessageEvent<unknown>) => void): void {
    this.#listeners.delete(listener);
  }

  resolveNextPresent(): void {
    const request = this.pendingPresent.shift();
    if (request === undefined) throw new Error('no pending renderer.paint.present request');
    const strokeId = typeof request.strokeId === 'string' ? request.strokeId : 'stroke-a';
    const dabCount = Array.isArray(request.dabs) ? request.dabs.length : 0;
    this.#respond(request, paintSnapshotV1(strokeId, dabCount));
  }

  #respond(request: WorkerRequestV1, result: unknown): void {
    if (request.requestId === undefined) return;
    const event = {
      data: Object.freeze({
        type: 'renderer.response',
        requestId: request.requestId,
        ok: true,
        result,
      }),
    } as MessageEvent<unknown>;
    for (const listener of [...this.#listeners]) listener(event);
  }
}

function fakeShellV1(): FoundationShell {
  const offscreen = {} as OffscreenCanvas;
  const canvas = {
    transferControlToOffscreen: () => offscreen,
  } as unknown as HTMLCanvasElement;
  const size = Object.freeze({ width: 64, height: 64, pixelRatio: 1 });
  return {
    canvas,
    currentRenderSurfaceSize: () => size,
    transferRenderSurface: () => offscreen,
    subscribeRenderSurfaceSize(listener) {
      listener(size);
      return () => undefined;
    },
    dispose: () => undefined,
  };
}

function dabV1(x: number): BaselineBrushDabV1 {
  return Object.freeze({
    schema: 'illustro.baseline-brush-dab/1',
    x,
    y: 10,
    radius: 4,
    opacity: 1,
  });
}

async function flushMicrotasksV1(count = 6): Promise<void> {
  for (let index = 0; index < count; index += 1) await Promise.resolve();
}

describe('M3 renderer execution ownership selection', () => {
  it('prefers Render Worker only when both worker WebGPU and OffscreenCanvas transfer are ready', () => {
    expect(
      selectRendererExecutionPathV1({
        workerDeviceReady: true,
        offscreenTransferAvailable: true,
      }),
    ).toBe('worker');
  });

  it('keeps the canvas on main when worker WebGPU or OffscreenCanvas transfer is unavailable', () => {
    expect(
      selectRendererExecutionPathV1({
        workerDeviceReady: false,
        offscreenTransferAvailable: true,
      }),
    ).toBe('main');
    expect(
      selectRendererExecutionPathV1({
        workerDeviceReady: true,
        offscreenTransferAvailable: false,
      }),
    ).toBe('main');
  });

  it('selects compatibility rendering after both WebGPU execution paths are unavailable', () => {
    expect(
      selectRendererExecutionPathV1({
        workerDeviceReady: false,
        offscreenTransferAvailable: true,
        mainDeviceReady: false,
      }),
    ).toBe('compatibility');
  });

  it('hands a live GPU backend to compatibility only after device recovery is exhausted', () => {
    expect(shouldHandoffRendererToCompatibilityV1('worker', 'recovery-required')).toBe(true);
    expect(shouldHandoffRendererToCompatibilityV1('main', 'recovery-required')).toBe(true);
    expect(shouldHandoffRendererToCompatibilityV1('worker', 'recovering')).toBe(false);
    expect(shouldHandoffRendererToCompatibilityV1('main', 'unavailable')).toBe(false);
    expect(shouldHandoffRendererToCompatibilityV1('compatibility', 'recovery-required')).toBe(
      false,
    );
  });
});

describe('realtime paint renderer backpressure', () => {
  it('returns from interactive present before Worker ACK and keeps finalize behind the flush barrier', async () => {
    const worker = new FakeRendererWorkerV1();
    const root = { dataset: {} } as unknown as HTMLElement;
    const renderer = new RendererControllerV1(fakeShellV1(), worker, root);

    await renderer.start();
    await renderer.configureDocument({
      width: 64,
      height: 64,
      workingSpace: 'srgb',
      precision: 'rgba8-unorm',
      rasterLayers: Object.freeze([]),
    });

    await renderer.presentBaselineStroke('stroke-a', Object.freeze([dabV1(10)]), 'layer-a');
    await flushMicrotasksV1();
    expect(worker.pendingPresent).toHaveLength(1);
    expect(renderer.realtimePaintSnapshot()).toMatchObject({
      inFlight: true,
      pendingSegmentCount: 0,
      submittedBatchCount: 1,
    });

    await renderer.presentBaselineStroke('stroke-a', Object.freeze([dabV1(20)]), 'layer-a');
    await flushMicrotasksV1();
    expect(worker.pendingPresent).toHaveLength(1);
    expect(renderer.realtimePaintSnapshot()).toMatchObject({
      inFlight: true,
      pendingSegmentCount: 1,
      pendingDabCount: 1,
    });

    let finalized = false;
    const finalize = renderer
      .finalizeBaselineStroke('stroke-a', Object.freeze([]), 'layer-a')
      .then((result) => {
        finalized = true;
        return result;
      });
    await flushMicrotasksV1();
    expect(finalized).toBe(false);
    expect(worker.requestOrder.filter((type) => type === 'renderer.paint.finalize')).toHaveLength(0);

    worker.resolveNextPresent();
    await flushMicrotasksV1();
    expect(worker.pendingPresent).toHaveLength(1);
    expect(finalized).toBe(false);

    worker.resolveNextPresent();
    const finalization = await finalize;
    expect(finalization.strokeId).toBe('stroke-a');
    expect(worker.requestOrder.filter((type) => type === 'renderer.paint.present')).toHaveLength(2);
    expect(worker.requestOrder.at(-1)).toBe('renderer.paint.finalize');
    expect(renderer.realtimePaintSnapshot()).toMatchObject({
      inFlight: false,
      pendingSegmentCount: 0,
      pendingDabCount: 0,
    });

    renderer.dispose();
  });
});
