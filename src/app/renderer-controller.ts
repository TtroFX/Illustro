import { type BaselineBrushDabV1 } from '../gpu/baseline-brush.js';
import {
  BaselinePaintRendererV1,
  type BaselinePaintFinalizationV1,
  type BaselinePaintRendererSnapshotV1,
} from '../gpu/baseline-paint-renderer.js';
import { acquireCoreWebGpuV1 } from '../gpu/webgpu-capability.js';
import {
  RendererDeviceManagerV1,
  type RendererDeviceSnapshotV1,
  type RendererDeviceStateV1,
} from '../gpu/renderer-device-manager.js';
import { rebuildRendererDeviceResourcesV1 } from '../gpu/renderer-device-resources.js';
import { RendererTileStateV1 } from '../gpu/renderer-tile-state.js';
import type { FoundationShell } from './shell.js';

type RendererOwnerV1 = 'pending' | 'worker' | 'main';

type WorkerLikeV1 = {
  postMessage(message: unknown, transfer?: readonly Transferable[]): void;
  addEventListener(type: 'message', listener: (event: MessageEvent<unknown>) => void): void;
  removeEventListener(type: 'message', listener: (event: MessageEvent<unknown>) => void): void;
};

interface RendererWorkerResponseV1 {
  readonly type: 'renderer.response';
  readonly requestId: string;
  readonly ok: boolean;
  readonly result: unknown;
}

export interface RendererControllerSnapshotV1 {
  readonly schema: 'illustro.renderer-controller/1';
  readonly owner: RendererOwnerV1;
  readonly deviceState: RendererDeviceStateV1;
  readonly generation: number;
}

export interface RendererDocumentConfigurationV1 {
  readonly schema: 'illustro.renderer-document-configuration/1';
  readonly owner: Exclude<RendererOwnerV1, 'pending'>;
  readonly width: number;
  readonly height: number;
}

const WORKER_RESPONSE_TIMEOUT_MS = 4_000;

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseDeviceSnapshot(value: unknown): RendererDeviceSnapshotV1 | null {
  if (
    !isRecord(value) ||
    value.schema !== 'illustro.renderer-device-state/1' ||
    typeof value.state !== 'string' ||
    typeof value.generation !== 'number' ||
    typeof value.reacquireAttempt !== 'number'
  ) {
    return null;
  }
  return value as unknown as RendererDeviceSnapshotV1;
}

function parsePaintSnapshot(value: unknown): BaselinePaintRendererSnapshotV1 | null {
  if (
    !isRecord(value) ||
    value.schema !== 'illustro.baseline-paint-renderer/1' ||
    typeof value.activeDabCount !== 'number' ||
    typeof value.committedStrokeCount !== 'number' ||
    typeof value.committedDabCount !== 'number' ||
    typeof value.surfaceReady !== 'boolean' ||
    typeof value.deviceReady !== 'boolean'
  ) {
    return null;
  }
  return value as unknown as BaselinePaintRendererSnapshotV1;
}

function parsePaintFinalization(value: unknown): BaselinePaintFinalizationV1 | null {
  if (
    !isRecord(value) ||
    value.schema !== 'illustro.baseline-paint-finalization/1' ||
    typeof value.strokeId !== 'string' ||
    typeof value.dabCount !== 'number' ||
    !Array.isArray(value.affectedTiles) ||
    parsePaintSnapshot(value.renderer) === null
  ) {
    return null;
  }
  return value as unknown as BaselinePaintFinalizationV1;
}

function parseWorkerResponse(value: unknown, requestId: string): RendererWorkerResponseV1 | null {
  if (
    !isRecord(value) ||
    value.type !== 'renderer.response' ||
    value.requestId !== requestId ||
    typeof value.ok !== 'boolean'
  ) {
    return null;
  }
  return {
    type: 'renderer.response',
    requestId,
    ok: value.ok,
    result: value.result,
  };
}

async function requestWorker(
  worker: WorkerLikeV1,
  message: Readonly<Record<string, unknown>> & { readonly requestId: string },
  transfer: readonly Transferable[] = [],
): Promise<RendererWorkerResponseV1 | null> {
  return new Promise((resolve) => {
    const listener = (event: MessageEvent<unknown>): void => {
      const response = parseWorkerResponse(event.data, message.requestId);
      if (response === null) return;
      cleanup();
      resolve(response);
    };
    const timeout = globalThis.setTimeout(() => {
      cleanup();
      resolve(null);
    }, WORKER_RESPONSE_TIMEOUT_MS);
    const cleanup = (): void => {
      globalThis.clearTimeout(timeout);
      worker.removeEventListener('message', listener);
    };
    worker.addEventListener('message', listener);
    try {
      worker.postMessage(message, transfer);
    } catch {
      cleanup();
      resolve(null);
    }
  });
}

export function selectRendererExecutionPathV1(input: {
  readonly workerDeviceReady: boolean;
  readonly offscreenTransferAvailable: boolean;
}): 'worker' | 'main' {
  return input.workerDeviceReady && input.offscreenTransferAvailable ? 'worker' : 'main';
}

export class RendererControllerV1 {
  readonly #shell: FoundationShell;
  readonly #worker: WorkerLikeV1;
  readonly #root: HTMLElement;
  readonly #workerStateListener: (event: MessageEvent<unknown>) => void;
  readonly #mainBaselinePaint = new BaselinePaintRendererV1();
  #owner: RendererOwnerV1 = 'pending';
  #deviceState: RendererDeviceStateV1 = 'idle';
  #generation = 0;
  #mainDeviceManager: RendererDeviceManagerV1 | null = null;
  #mainTileState: RendererTileStateV1 | null = null;
  #removeSizeSubscription: (() => void) | null = null;
  #startTask: Promise<RendererControllerSnapshotV1> | null = null;
  #disposed = false;

  constructor(
    shell: FoundationShell,
    worker: WorkerLikeV1,
    root: HTMLElement = document.documentElement,
  ) {
    this.#shell = shell;
    this.#worker = worker;
    this.#root = root;
    this.#workerStateListener = (event) => {
      if (this.#owner !== 'worker' || !isRecord(event.data)) return;
      if (event.data.type !== 'renderer.device-state') return;
      const snapshot = parseDeviceSnapshot(event.data.snapshot);
      if (snapshot !== null) this.#applyDeviceSnapshot(snapshot);
    };
    worker.addEventListener('message', this.#workerStateListener);
    this.#publish();
  }

  snapshot(): RendererControllerSnapshotV1 {
    return Object.freeze({
      schema: 'illustro.renderer-controller/1',
      owner: this.#owner,
      deviceState: this.#deviceState,
      generation: this.#generation,
    });
  }

  start(): Promise<RendererControllerSnapshotV1> {
    if (this.#disposed) return Promise.resolve(this.snapshot());
    if (this.#deviceState === 'ready') return Promise.resolve(this.snapshot());
    if (this.#startTask !== null) return this.#startTask;
    const task = this.#startInternal();
    this.#startTask = task;
    void task.finally(() => {
      if (this.#startTask === task) this.#startTask = null;
    });
    return task;
  }

  async configureDocument(input: {
    readonly width: number;
    readonly height: number;
  }): Promise<RendererDocumentConfigurationV1> {
    if (this.#disposed) throw new Error('renderer controller is disposed');
    const snapshot = await this.start();
    if (snapshot.deviceState !== 'ready') {
      throw new Error(`renderer is not ready for document configuration: ${snapshot.deviceState}`);
    }

    if (snapshot.owner === 'worker') {
      const requestId = crypto.randomUUID();
      const response = await requestWorker(this.#worker, {
        type: 'renderer.tiles.configure',
        requestId,
        width: input.width,
        height: input.height,
      });
      if (response?.ok !== true) {
        throw new Error('Render Worker failed to configure document tile state');
      }
      this.#publishDocumentConfiguration(input.width, input.height);
      return Object.freeze({
        schema: 'illustro.renderer-document-configuration/1' as const,
        owner: 'worker' as const,
        width: input.width,
        height: input.height,
      });
    }

    if (snapshot.owner !== 'main' || this.#mainDeviceManager === null) {
      throw new Error('renderer ownership is unresolved');
    }
    const device = this.#mainDeviceManager.currentDevice();
    if (device === null) throw new Error('main renderer device is unavailable');
    this.#mainTileState?.dispose();
    this.#mainTileState = new RendererTileStateV1(input.width, input.height);
    this.#mainTileState.attachGpuDevice(device);
    this.#mainBaselinePaint.configureDocument(this.#mainTileState, input.width, input.height);
    this.#publishDocumentConfiguration(input.width, input.height);
    return Object.freeze({
      schema: 'illustro.renderer-document-configuration/1' as const,
      owner: 'main' as const,
      width: input.width,
      height: input.height,
    });
  }

  async presentBaselineStroke(
    strokeId: string,
    dabs: readonly BaselineBrushDabV1[],
  ): Promise<BaselinePaintRendererSnapshotV1> {
    const snapshot = await this.#requirePaintReady();
    if (snapshot.owner === 'worker') {
      const requestId = crypto.randomUUID();
      const response = await requestWorker(this.#worker, {
        type: 'renderer.paint.present',
        requestId,
        strokeId,
        dabs,
      });
      const paint = response?.ok === true ? parsePaintSnapshot(response.result) : null;
      if (paint === null) throw new Error('Render Worker failed to present baseline stroke');
      return paint;
    }
    return this.#mainBaselinePaint.presentStroke(strokeId, dabs);
  }

  async cancelBaselineStroke(strokeId: string): Promise<BaselinePaintRendererSnapshotV1> {
    const snapshot = await this.#requirePaintReady();
    if (snapshot.owner === 'worker') {
      const requestId = crypto.randomUUID();
      const response = await requestWorker(this.#worker, {
        type: 'renderer.paint.cancel',
        requestId,
        strokeId,
      });
      const paint = response?.ok === true ? parsePaintSnapshot(response.result) : null;
      if (paint === null) throw new Error('Render Worker failed to cancel baseline stroke');
      return paint;
    }
    return this.#mainBaselinePaint.cancelStroke(strokeId);
  }

  async finalizeBaselineStroke(
    strokeId: string,
    dabs: readonly BaselineBrushDabV1[],
  ): Promise<BaselinePaintFinalizationV1> {
    const snapshot = await this.#requirePaintReady();
    if (snapshot.owner === 'worker') {
      const requestId = crypto.randomUUID();
      const response = await requestWorker(this.#worker, {
        type: 'renderer.paint.finalize',
        requestId,
        strokeId,
        dabs,
      });
      const finalization = response?.ok === true ? parsePaintFinalization(response.result) : null;
      if (finalization === null)
        throw new Error('Render Worker failed to finalize baseline stroke');
      return finalization;
    }
    return this.#mainBaselinePaint.finalizeStroke(strokeId, dabs);
  }

  async retry(): Promise<RendererControllerSnapshotV1> {
    if (this.#disposed) return this.snapshot();
    if (this.#owner === 'worker') {
      const requestId = crypto.randomUUID();
      const response = await requestWorker(this.#worker, { type: 'renderer.retry', requestId });
      const snapshot = response === null ? null : parseDeviceSnapshot(response.result);
      if (snapshot !== null) this.#applyDeviceSnapshot(snapshot);
      return this.snapshot();
    }
    if (this.#mainDeviceManager !== null) {
      const snapshot = await this.#mainDeviceManager.start();
      this.#applyDeviceSnapshot(snapshot);
      return this.snapshot();
    }
    return this.start();
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#removeSizeSubscription?.();
    this.#removeSizeSubscription = null;
    this.#mainBaselinePaint.dispose();
    this.#mainTileState?.dispose();
    this.#mainTileState = null;
    this.#mainDeviceManager?.dispose();
    this.#mainDeviceManager = null;
    this.#worker.removeEventListener('message', this.#workerStateListener);
    this.#worker.postMessage({ type: 'renderer.dispose' });
    this.#deviceState = 'disposed';
    this.#publish();
  }

  async #requirePaintReady(): Promise<RendererControllerSnapshotV1> {
    if (this.#disposed) throw new Error('renderer controller is disposed');
    const snapshot = await this.start();
    if (snapshot.deviceState !== 'ready' || snapshot.owner === 'pending') {
      throw new Error(`renderer is not ready for paint presentation: ${snapshot.deviceState}`);
    }
    return snapshot;
  }

  async #startInternal(): Promise<RendererControllerSnapshotV1> {
    this.#owner = 'pending';
    this.#deviceState = 'acquiring';
    this.#publish();

    const probeRequestId = crypto.randomUUID();
    const probe = await requestWorker(this.#worker, {
      type: 'renderer.probe',
      requestId: probeRequestId,
    });
    const workerSnapshot = probe === null ? null : parseDeviceSnapshot(probe.result);
    const workerReady = probe?.ok === true && workerSnapshot?.state === 'ready';
    const executionPath = selectRendererExecutionPathV1({
      workerDeviceReady: workerReady,
      offscreenTransferAvailable:
        typeof this.#shell.canvas.transferControlToOffscreen === 'function',
    });

    if (executionPath === 'worker') {
      const offscreen = this.#shell.transferRenderSurface();
      if (offscreen !== null) {
        const size = this.#shell.currentRenderSurfaceSize();
        const attachRequestId = crypto.randomUUID();
        const attached = await requestWorker(
          this.#worker,
          {
            type: 'renderer.attach',
            requestId: attachRequestId,
            canvas: offscreen,
            width: size.width,
            height: size.height,
          },
          [offscreen],
        );
        const attachedSnapshot = attached === null ? null : parseDeviceSnapshot(attached.result);
        this.#owner = 'worker';
        if (attached?.ok === true && attachedSnapshot?.state === 'ready') {
          this.#applyDeviceSnapshot(attachedSnapshot);
          this.#removeSizeSubscription = this.#shell.subscribeRenderSurfaceSize((next) => {
            this.#worker.postMessage({
              type: 'renderer.resize',
              width: next.width,
              height: next.height,
            });
          });
        } else {
          this.#deviceState = 'recovery-required';
          this.#publish();
        }
        return this.snapshot();
      }
    }

    this.#worker.postMessage({ type: 'renderer.dispose' });
    return this.#startMainFallback();
  }

  async #startMainFallback(): Promise<RendererControllerSnapshotV1> {
    this.#owner = 'main';
    this.#mainDeviceManager ??= new RendererDeviceManagerV1({
      acquire: acquireCoreWebGpuV1,
      rebuild: (device, generation) => {
        const resources = rebuildRendererDeviceResourcesV1(device, generation, this.#shell.canvas);
        this.#mainTileState?.attachGpuDevice(device);
        this.#mainBaselinePaint.attachDevice(device);
        if (resources.canvasFormat === null) {
          throw new Error('main renderer surface format is unavailable after configuration');
        }
        this.#mainBaselinePaint.attachSurface(this.#shell.canvas, resources.canvasFormat);
      },
      onState: (snapshot) => this.#applyDeviceSnapshot(snapshot),
      onDiscardProvisional: () => {
        this.#mainTileState?.attachGpuDevice(null);
        this.#mainBaselinePaint.attachDevice(null);
        this.#root.dataset.illustroRendererProvisional = 'discarded';
      },
    });
    const snapshot = await this.#mainDeviceManager.start();
    this.#applyDeviceSnapshot(snapshot);
    return this.snapshot();
  }

  #applyDeviceSnapshot(snapshot: RendererDeviceSnapshotV1): void {
    this.#deviceState = snapshot.state;
    this.#generation = snapshot.generation;
    this.#publish();
  }

  #publishDocumentConfiguration(width: number, height: number): void {
    this.#root.dataset.illustroRendererDocument = 'configured';
    this.#root.dataset.illustroRendererDocumentWidth = String(width);
    this.#root.dataset.illustroRendererDocumentHeight = String(height);
  }

  #publish(): void {
    this.#root.dataset.illustroRendererOwner = this.#owner;
    this.#root.dataset.illustroRendererState = this.#deviceState;
    this.#root.dataset.illustroRendererGeneration = String(this.#generation);
    this.#root.dataset.illustroRendererMutationGate =
      this.#deviceState === 'ready' ? 'open' : 'blocked';
  }
}

export function startRendererController(
  shell: FoundationShell,
  worker: Worker,
  root: HTMLElement = document.documentElement,
): RendererControllerV1 {
  return new RendererControllerV1(shell, worker, root);
}
