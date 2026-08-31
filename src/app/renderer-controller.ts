import { acquireCoreWebGpuV1 } from '../gpu/webgpu-capability.js';
import {
  RendererDeviceManagerV1,
  type RendererDeviceSnapshotV1,
  type RendererDeviceStateV1,
} from '../gpu/renderer-device-manager.js';
import { rebuildRendererDeviceResourcesV1 } from '../gpu/renderer-device-resources.js';
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
  #owner: RendererOwnerV1 = 'pending';
  #deviceState: RendererDeviceStateV1 = 'idle';
  #generation = 0;
  #mainDeviceManager: RendererDeviceManagerV1 | null = null;
  #removeSizeSubscription: (() => void) | null = null;
  #startTask: Promise<RendererControllerSnapshotV1> | null = null;
  #disposed = false;

  constructor(shell: FoundationShell, worker: WorkerLikeV1, root: HTMLElement = document.documentElement) {
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
    this.#mainDeviceManager?.dispose();
    this.#mainDeviceManager = null;
    this.#worker.removeEventListener('message', this.#workerStateListener);
    this.#worker.postMessage({ type: 'renderer.dispose' });
    this.#deviceState = 'disposed';
    this.#publish();
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
        rebuildRendererDeviceResourcesV1(device, generation, this.#shell.canvas);
      },
      onState: (snapshot) => this.#applyDeviceSnapshot(snapshot),
      onDiscardProvisional: () => {
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
