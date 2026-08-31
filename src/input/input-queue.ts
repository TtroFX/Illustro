import type { PointerInputBatchV1, PointerInputSampleV1 } from './pointer-input.js';

export const DEFAULT_POINTER_INPUT_QUEUE_CAPACITY_V1 = 256;

export interface PointerInputQueueSnapshotV1 {
  readonly schema: 'illustro.pointer-input-queue/1';
  readonly capacity: number;
  readonly size: number;
  readonly enqueued: number;
  readonly dropped: number;
  readonly coalesced: number;
}

function isHighFrequencyUpdate(sample: PointerInputSampleV1): boolean {
  return sample.eventType === 'pointermove' || sample.eventType === 'pointerrawupdate';
}

function canCoalesce(previous: PointerInputSampleV1, incoming: PointerInputSampleV1): boolean {
  return (
    previous.pointerId === incoming.pointerId &&
    isHighFrequencyUpdate(previous) &&
    isHighFrequencyUpdate(incoming)
  );
}

export class BoundedPointerInputQueueV1 {
  readonly #capacity: number;
  readonly #items: PointerInputSampleV1[] = [];
  #enqueued = 0;
  #dropped = 0;
  #coalesced = 0;

  constructor(capacity = DEFAULT_POINTER_INPUT_QUEUE_CAPACITY_V1) {
    if (!Number.isSafeInteger(capacity) || capacity < 1) {
      throw new RangeError('pointer input queue capacity must be a positive safe integer');
    }
    this.#capacity = capacity;
  }

  get size(): number {
    return this.#items.length;
  }

  enqueue(sample: PointerInputSampleV1): void {
    this.#enqueued += 1;
    if (this.#items.length < this.#capacity) {
      this.#items.push(sample);
      return;
    }

    if (isHighFrequencyUpdate(sample)) {
      for (let index = this.#items.length - 1; index >= 0; index -= 1) {
        const previous = this.#items[index];
        if (previous !== undefined && canCoalesce(previous, sample)) {
          this.#items[index] = sample;
          this.#coalesced += 1;
          return;
        }
      }
    }

    const expendableIndex = this.#items.findIndex(isHighFrequencyUpdate);
    if (expendableIndex >= 0) {
      this.#items.splice(expendableIndex, 1);
    } else {
      this.#items.shift();
    }
    this.#dropped += 1;
    this.#items.push(sample);
  }

  enqueueBatch(batch: PointerInputBatchV1): void {
    for (const sample of batch.confirmed) this.enqueue(sample);
  }

  drain(maxCount = this.#items.length): readonly PointerInputSampleV1[] {
    if (!Number.isSafeInteger(maxCount) || maxCount < 0) {
      throw new RangeError('pointer input drain count must be a non-negative safe integer');
    }
    if (maxCount === 0 || this.#items.length === 0) return Object.freeze([]);
    return Object.freeze(this.#items.splice(0, Math.min(maxCount, this.#items.length)));
  }

  snapshot(): PointerInputQueueSnapshotV1 {
    return Object.freeze({
      schema: 'illustro.pointer-input-queue/1' as const,
      capacity: this.#capacity,
      size: this.#items.length,
      enqueued: this.#enqueued,
      dropped: this.#dropped,
      coalesced: this.#coalesced,
    });
  }
}
