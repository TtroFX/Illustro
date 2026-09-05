export interface RealtimePaintPresentationV1<TDab, TOperation> {
  readonly strokeId: string;
  readonly layerId: string;
  readonly operation: TOperation;
  readonly dabs: readonly TDab[];
}

export interface RealtimePaintPresenterMetricsV1 {
  readonly inFlight: boolean;
  readonly pendingSegmentCount: number;
  readonly pendingDabCount: number;
  readonly maximumPendingDabCount: number;
  readonly acceptedBatchCount: number;
  readonly submittedBatchCount: number;
  readonly coalescedBatchCount: number;
  readonly failed: boolean;
}

export interface RealtimePaintPresenterOptionsV1<TDab, TOperation> {
  readonly submit: (presentation: RealtimePaintPresentationV1<TDab, TOperation>) => Promise<void>;
  readonly maximumPendingSegments?: number;
}

interface MutablePendingPresentationV1<TDab, TOperation> {
  readonly strokeId: string;
  readonly layerId: string;
  readonly operation: TOperation;
  readonly dabs: TDab[];
}

const DEFAULT_MAXIMUM_PENDING_SEGMENTS = 8;

function samePresentationStreamV1<TDab, TOperation>(
  left: MutablePendingPresentationV1<TDab, TOperation>,
  right: RealtimePaintPresentationV1<TDab, TOperation>,
): boolean {
  return (
    left.strokeId === right.strokeId &&
    left.layerId === right.layerId &&
    Object.is(left.operation, right.operation)
  );
}

function freezePresentationV1<TDab, TOperation>(
  presentation: MutablePendingPresentationV1<TDab, TOperation>,
): RealtimePaintPresentationV1<TDab, TOperation> {
  return Object.freeze({
    strokeId: presentation.strokeId,
    layerId: presentation.layerId,
    operation: presentation.operation,
    dabs: Object.freeze([...presentation.dabs]),
  });
}

/**
 * Backpressure boundary for the interactive paint path.
 *
 * Pointer delivery is intentionally decoupled from renderer acknowledgement. At most one
 * renderer submission is in flight. Newly produced dabs are retained in a bounded number of
 * pending stream segments and consecutive segments for the same stroke/layer/operation are
 * coalesced before submission. Canonical dabs are never dropped or reordered.
 */
export class RealtimePaintPresenterV1<TDab, TOperation> {
  readonly #submit: RealtimePaintPresenterOptionsV1<TDab, TOperation>['submit'];
  readonly #maximumPendingSegments: number;
  readonly #pending: MutablePendingPresentationV1<TDab, TOperation>[] = [];

  #drainPromise: Promise<void> | null = null;
  #inFlight = false;
  #failure: unknown = null;
  #acceptedBatchCount = 0;
  #submittedBatchCount = 0;
  #coalescedBatchCount = 0;
  #maximumPendingDabCount = 0;

  constructor(options: RealtimePaintPresenterOptionsV1<TDab, TOperation>) {
    if (!Number.isInteger(options.maximumPendingSegments ?? DEFAULT_MAXIMUM_PENDING_SEGMENTS)) {
      throw new RangeError('maximumPendingSegments must be an integer');
    }
    const maximumPendingSegments =
      options.maximumPendingSegments ?? DEFAULT_MAXIMUM_PENDING_SEGMENTS;
    if (maximumPendingSegments < 1) {
      throw new RangeError('maximumPendingSegments must be at least 1');
    }
    this.#submit = options.submit;
    this.#maximumPendingSegments = maximumPendingSegments;
  }

  enqueue(presentation: RealtimePaintPresentationV1<TDab, TOperation>): void {
    if (this.#failure !== null) {
      throw this.#asError(this.#failure);
    }
    if (presentation.dabs.length === 0) return;

    this.#acceptedBatchCount += 1;
    const lastPending = this.#pending[this.#pending.length - 1];
    if (lastPending !== undefined && samePresentationStreamV1(lastPending, presentation)) {
      lastPending.dabs.push(...presentation.dabs);
      this.#coalescedBatchCount += 1;
    } else {
      if (this.#pending.length >= this.#maximumPendingSegments) {
        throw new Error(
          `Realtime paint backpressure exceeded ${this.#maximumPendingSegments} pending stream segments`,
        );
      }
      this.#pending.push({
        strokeId: presentation.strokeId,
        layerId: presentation.layerId,
        operation: presentation.operation,
        dabs: [...presentation.dabs],
      });
    }

    this.#maximumPendingDabCount = Math.max(this.#maximumPendingDabCount, this.#pendingDabCount());
    this.#ensureDrain();
  }

  async flush(): Promise<void> {
    while (true) {
      if (this.#failure !== null) {
        throw this.#asError(this.#failure);
      }
      if (this.#drainPromise === null) {
        if (this.#pending.length === 0 && !this.#inFlight) return;
        this.#ensureDrain();
      }
      const drainPromise = this.#drainPromise;
      if (drainPromise !== null) await drainPromise;
    }
  }

  snapshot(): RealtimePaintPresenterMetricsV1 {
    return Object.freeze({
      inFlight: this.#inFlight,
      pendingSegmentCount: this.#pending.length,
      pendingDabCount: this.#pendingDabCount(),
      maximumPendingDabCount: this.#maximumPendingDabCount,
      acceptedBatchCount: this.#acceptedBatchCount,
      submittedBatchCount: this.#submittedBatchCount,
      coalescedBatchCount: this.#coalescedBatchCount,
      failed: this.#failure !== null,
    });
  }

  #ensureDrain(): void {
    if (this.#drainPromise !== null || this.#pending.length === 0 || this.#failure !== null) return;

    this.#drainPromise = this.#drain()
      .catch((error: unknown) => {
        this.#failure = error;
        this.#pending.length = 0;
      })
      .finally(() => {
        this.#drainPromise = null;
        if (this.#pending.length > 0 && this.#failure === null) this.#ensureDrain();
      });
  }

  async #drain(): Promise<void> {
    while (this.#pending.length > 0) {
      const next = this.#pending.shift();
      if (next === undefined) return;

      this.#inFlight = true;
      this.#submittedBatchCount += 1;
      try {
        await this.#submit(freezePresentationV1(next));
      } finally {
        this.#inFlight = false;
      }
    }
  }

  #pendingDabCount(): number {
    let count = 0;
    for (const pending of this.#pending) count += pending.dabs.length;
    return count;
  }

  #asError(value: unknown): Error {
    return value instanceof Error ? value : new Error(String(value));
  }
}
