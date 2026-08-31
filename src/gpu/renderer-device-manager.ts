import {
  type IllustroGpuDeviceV1,
  type WebGpuAcquireResultV1,
  type WebGpuAcquireStatusV1,
  type WebGpuDeviceLostInfoLikeV1,
} from './webgpu-capability.js';

export const DEFAULT_DEVICE_REACQUIRE_ATTEMPTS = 2;

export type RendererDeviceStateV1 =
  | 'idle'
  | 'acquiring'
  | 'ready'
  | 'lost'
  | 'recovering'
  | 'unavailable'
  | 'recovery-required'
  | 'disposed';

export interface RendererDeviceSnapshotV1 {
  readonly schema: 'illustro.renderer-device-state/1';
  readonly state: RendererDeviceStateV1;
  readonly generation: number;
  readonly reacquireAttempt: number;
  readonly lastAcquireStatus: WebGpuAcquireStatusV1 | null;
  readonly lastLoss: WebGpuDeviceLostInfoLikeV1 | null;
}

type AcquireDeviceV1 = () => Promise<WebGpuAcquireResultV1>;
type RebuildDeviceResourcesV1 = (
  device: IllustroGpuDeviceV1,
  generation: number,
) => void | Promise<void>;

export class RendererDeviceManagerV1 {
  readonly #acquire: AcquireDeviceV1;
  readonly #rebuild: RebuildDeviceResourcesV1;
  readonly #onState: (snapshot: RendererDeviceSnapshotV1) => void;
  readonly #onDiscardProvisional: () => void;
  readonly #maxReacquireAttempts: number;

  #state: RendererDeviceStateV1 = 'idle';
  #generation = 0;
  #reacquireAttempt = 0;
  #lastAcquireStatus: WebGpuAcquireStatusV1 | null = null;
  #lastLoss: WebGpuDeviceLostInfoLikeV1 | null = null;
  #device: IllustroGpuDeviceV1 | null = null;
  #startTask: Promise<RendererDeviceSnapshotV1> | null = null;
  #disposed = false;

  constructor(input: {
    readonly acquire: AcquireDeviceV1;
    readonly rebuild: RebuildDeviceResourcesV1;
    readonly onState?: (snapshot: RendererDeviceSnapshotV1) => void;
    readonly onDiscardProvisional?: () => void;
    readonly maxReacquireAttempts?: number;
  }) {
    const maxReacquireAttempts = input.maxReacquireAttempts ?? DEFAULT_DEVICE_REACQUIRE_ATTEMPTS;
    if (!Number.isSafeInteger(maxReacquireAttempts) || maxReacquireAttempts < 1) {
      throw new RangeError('maxReacquireAttempts must be a positive safe integer');
    }
    this.#acquire = input.acquire;
    this.#rebuild = input.rebuild;
    this.#onState = input.onState ?? (() => undefined);
    this.#onDiscardProvisional = input.onDiscardProvisional ?? (() => undefined);
    this.#maxReacquireAttempts = maxReacquireAttempts;
  }

  snapshot(): RendererDeviceSnapshotV1 {
    return Object.freeze({
      schema: 'illustro.renderer-device-state/1',
      state: this.#state,
      generation: this.#generation,
      reacquireAttempt: this.#reacquireAttempt,
      lastAcquireStatus: this.#lastAcquireStatus,
      lastLoss: this.#lastLoss,
    });
  }

  currentDevice(): IllustroGpuDeviceV1 | null {
    return this.#device;
  }

  start(): Promise<RendererDeviceSnapshotV1> {
    if (this.#disposed) return Promise.resolve(this.snapshot());
    if (this.#state === 'ready') return Promise.resolve(this.snapshot());
    if (this.#startTask !== null) return this.#startTask;
    const task = this.#acquireInitial();
    this.#startTask = task;
    void task.finally(() => {
      if (this.#startTask === task) this.#startTask = null;
    });
    return task;
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#device = null;
    this.#state = 'disposed';
    this.#emit();
  }

  async #acquireInitial(): Promise<RendererDeviceSnapshotV1> {
    this.#state = 'acquiring';
    this.#reacquireAttempt = 0;
    this.#emit();
    const result = await this.#safeAcquire();
    this.#lastAcquireStatus = result.status;
    if (result.status !== 'ready' || result.device === null) {
      this.#device = null;
      this.#state = 'unavailable';
      this.#emit();
      return this.snapshot();
    }
    try {
      await this.#installDevice(result.device);
    } catch {
      this.#device = null;
      this.#state = 'unavailable';
      this.#lastAcquireStatus = 'device-failed';
      this.#emit();
    }
    return this.snapshot();
  }

  async #safeAcquire(): Promise<WebGpuAcquireResultV1> {
    try {
      return await this.#acquire();
    } catch (error) {
      return Object.freeze({
        schema: 'illustro.webgpu-acquire/1',
        status: 'device-failed',
        profile: null,
        adapter: null,
        device: null,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async #installDevice(device: IllustroGpuDeviceV1): Promise<void> {
    const generation = this.#generation + 1;
    await this.#rebuild(device, generation);
    if (this.#disposed) return;
    this.#device = device;
    this.#generation = generation;
    this.#reacquireAttempt = 0;
    this.#state = 'ready';
    this.#emit();
    void device.lost.then(
      (loss) => this.#handleLoss(generation, loss),
      (error: unknown) =>
        this.#handleLoss(generation, {
          reason: 'unknown',
          message: error instanceof Error ? error.message : String(error),
        }),
    );
  }

  async #handleLoss(generation: number, loss: WebGpuDeviceLostInfoLikeV1): Promise<void> {
    if (this.#disposed || generation !== this.#generation) return;
    this.#device = null;
    this.#lastLoss = Object.freeze({ reason: loss.reason, message: loss.message });
    this.#state = 'lost';
    this.#emit();
    this.#onDiscardProvisional();

    for (let attempt = 1; attempt <= this.#maxReacquireAttempts; attempt += 1) {
      if (this.#disposed) return;
      this.#reacquireAttempt = attempt;
      this.#state = 'recovering';
      this.#emit();
      const result = await this.#safeAcquire();
      this.#lastAcquireStatus = result.status;
      if (result.status !== 'ready' || result.device === null) continue;
      try {
        await this.#installDevice(result.device);
        return;
      } catch {
        this.#device = null;
        this.#lastAcquireStatus = 'device-failed';
      }
    }

    if (this.#disposed) return;
    this.#state = 'recovery-required';
    this.#emit();
  }

  #emit(): void {
    this.#onState(this.snapshot());
  }
}
