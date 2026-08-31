export type PersistenceFlushReasonV1 = 'recovery' | 'autosave';

export interface PersistenceSchedulerClockV1 {
  now(): number;
  setTimeout(callback: () => void, delayMs: number): number;
  clearTimeout(token: number): void;
}

export interface PersistenceSchedulerPolicyV1 {
  readonly recoveryQuietMs: number;
  readonly recoveryMaxMs: number;
  readonly autosaveIntervalMs: number;
  readonly retryDelayMs: number;
}

export interface PersistenceSchedulerStateV1 {
  readonly dirtyGeneration: number;
  readonly durableGeneration: number;
  readonly autosavedGeneration: number;
  readonly firstDirtyAt: number | null;
  readonly hasRecoveryTimer: boolean;
  readonly hasAutosaveTimer: boolean;
  readonly inFlight: boolean;
}

export const DEFAULT_PERSISTENCE_SCHEDULER_POLICY: PersistenceSchedulerPolicyV1 = Object.freeze({
  recoveryQuietMs: 2_000,
  recoveryMaxMs: 2_000,
  autosaveIntervalMs: 30_000,
  retryDelayMs: 5_000,
});

function validateDelay(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) throw new RangeError(`${label} must be non-negative`);
}

function validatePolicy(policy: PersistenceSchedulerPolicyV1): void {
  validateDelay(policy.recoveryQuietMs, 'recoveryQuietMs');
  validateDelay(policy.recoveryMaxMs, 'recoveryMaxMs');
  validateDelay(policy.autosaveIntervalMs, 'autosaveIntervalMs');
  validateDelay(policy.retryDelayMs, 'retryDelayMs');
  if (policy.recoveryMaxMs < policy.recoveryQuietMs) {
    throw new RangeError('recoveryMaxMs must be greater than or equal to recoveryQuietMs');
  }
  if (policy.autosaveIntervalMs < policy.recoveryQuietMs) {
    throw new RangeError('autosaveIntervalMs must be greater than or equal to recoveryQuietMs');
  }
}

function browserClock(): PersistenceSchedulerClockV1 {
  return {
    now: () => performance.now(),
    setTimeout(callback, delayMs) {
      return globalThis.setTimeout(callback, delayMs);
    },
    clearTimeout(token) {
      globalThis.clearTimeout(token);
    },
  };
}

export class ProjectPersistenceSchedulerV1<Payload, Result> {
  readonly #clock: PersistenceSchedulerClockV1;
  readonly #policy: PersistenceSchedulerPolicyV1;
  readonly #persist: (reason: PersistenceFlushReasonV1, payload: Payload) => Promise<Result>;
  readonly #onAutosaveSettled: (payload: Payload, result: Result | null) => void;
  readonly #onError: (reason: PersistenceFlushReasonV1, error: unknown) => void;

  #payload: Payload | null = null;
  #dirtyGeneration = 0;
  #durableGeneration = 0;
  #autosavedGeneration = 0;
  #firstDirtyAt: number | null = null;
  #recoveryTimer: number | null = null;
  #autosaveTimer: number | null = null;
  #inFlight: Promise<void> | null = null;
  #disposed = false;
  #lastDurableResult: Result | null = null;

  constructor(input: {
    persist: (reason: PersistenceFlushReasonV1, payload: Payload) => Promise<Result>;
    onAutosaveSettled?: (payload: Payload, result: Result | null) => void;
    onError?: (reason: PersistenceFlushReasonV1, error: unknown) => void;
    policy?: PersistenceSchedulerPolicyV1;
    clock?: PersistenceSchedulerClockV1;
  }) {
    this.#policy = input.policy ?? DEFAULT_PERSISTENCE_SCHEDULER_POLICY;
    validatePolicy(this.#policy);
    this.#clock = input.clock ?? browserClock();
    this.#persist = input.persist;
    this.#onAutosaveSettled = input.onAutosaveSettled ?? (() => undefined);
    this.#onError = input.onError ?? (() => undefined);
  }

  markDirty(payload: Payload): number {
    if (this.#disposed) throw new Error('persistence scheduler is disposed');
    this.#payload = payload;
    this.#dirtyGeneration += 1;
    const now = this.#clock.now();
    if (this.#firstDirtyAt === null) this.#firstDirtyAt = now;
    this.#scheduleRecovery(now);
    this.#scheduleAutosave(now);
    return this.#dirtyGeneration;
  }

  state(): PersistenceSchedulerStateV1 {
    return Object.freeze({
      dirtyGeneration: this.#dirtyGeneration,
      durableGeneration: this.#durableGeneration,
      autosavedGeneration: this.#autosavedGeneration,
      firstDirtyAt: this.#firstDirtyAt,
      hasRecoveryTimer: this.#recoveryTimer !== null,
      hasAutosaveTimer: this.#autosaveTimer !== null,
      inFlight: this.#inFlight !== null,
    });
  }

  async flushNow(reason: PersistenceFlushReasonV1): Promise<void> {
    if (this.#disposed) throw new Error('persistence scheduler is disposed');
    this.#clearTimer(reason);
    await this.#run(reason);
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    if (this.#recoveryTimer !== null) this.#clock.clearTimeout(this.#recoveryTimer);
    if (this.#autosaveTimer !== null) this.#clock.clearTimeout(this.#autosaveTimer);
    this.#recoveryTimer = null;
    this.#autosaveTimer = null;
    this.#payload = null;
  }

  #scheduleRecovery(now: number): void {
    if (this.#recoveryTimer !== null) this.#clock.clearTimeout(this.#recoveryTimer);
    const firstDirtyAt = this.#firstDirtyAt ?? now;
    const quietDeadline = now + this.#policy.recoveryQuietMs;
    const hardDeadline = firstDirtyAt + this.#policy.recoveryMaxMs;
    const deadline = Math.min(quietDeadline, hardDeadline);
    this.#recoveryTimer = this.#clock.setTimeout(
      () => {
        this.#recoveryTimer = null;
        void this.#run('recovery');
      },
      Math.max(0, deadline - now),
    );
  }

  #scheduleAutosave(now: number): void {
    if (this.#autosaveTimer !== null) return;
    const firstDirtyAt = this.#firstDirtyAt ?? now;
    const deadline = firstDirtyAt + this.#policy.autosaveIntervalMs;
    this.#autosaveTimer = this.#clock.setTimeout(
      () => {
        this.#autosaveTimer = null;
        void this.#run('autosave');
      },
      Math.max(0, deadline - now),
    );
  }

  #clearTimer(reason: PersistenceFlushReasonV1): void {
    if (reason === 'recovery' && this.#recoveryTimer !== null) {
      this.#clock.clearTimeout(this.#recoveryTimer);
      this.#recoveryTimer = null;
    }
    if (reason === 'autosave' && this.#autosaveTimer !== null) {
      this.#clock.clearTimeout(this.#autosaveTimer);
      this.#autosaveTimer = null;
    }
  }

  async #run(reason: PersistenceFlushReasonV1): Promise<void> {
    if (this.#disposed || this.#payload === null) return;
    if (this.#inFlight !== null) {
      const pending = this.#inFlight;
      await pending;
      if (this.#inFlight === pending) this.#inFlight = null;
      if (!this.#disposed) await this.#run(reason);
      return;
    }

    const generation = this.#dirtyGeneration;
    const payload = this.#payload;
    const task = this.#persistIfNeeded(reason, payload, generation);
    this.#inFlight = task;
    try {
      await task;
    } finally {
      if (this.#inFlight === task) this.#inFlight = null;
    }
  }

  async #persistIfNeeded(
    reason: PersistenceFlushReasonV1,
    payload: Payload,
    generation: number,
  ): Promise<void> {
    let result = this.#lastDurableResult;
    try {
      if (generation > this.#durableGeneration) {
        result = await this.#persist(reason, payload);
        this.#lastDurableResult = result;
        this.#durableGeneration = generation;
      }

      if (reason === 'autosave') {
        this.#autosavedGeneration = Math.max(this.#autosavedGeneration, generation);
        this.#onAutosaveSettled(payload, result);
      }

      if (this.#dirtyGeneration === generation) {
        if (reason === 'autosave') {
          this.#firstDirtyAt = null;
          if (this.#recoveryTimer !== null) this.#clock.clearTimeout(this.#recoveryTimer);
          this.#recoveryTimer = null;
        }
      } else {
        const now = this.#clock.now();
        this.#scheduleRecovery(now);
        this.#scheduleAutosave(now);
      }
    } catch (error) {
      this.#onError(reason, error);
      const now = this.#clock.now();
      if (reason === 'recovery' && this.#recoveryTimer === null) {
        this.#recoveryTimer = this.#clock.setTimeout(() => {
          this.#recoveryTimer = null;
          void this.#run('recovery');
        }, this.#policy.retryDelayMs);
      }
      if (this.#autosaveTimer === null) this.#scheduleAutosave(now);
    }
  }
}
