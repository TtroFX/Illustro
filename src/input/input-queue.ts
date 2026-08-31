import type { PointerInputBatchV1, PointerInputSampleV1 } from './pointer-input.js';

export const DEFAULT_POINTER_INPUT_QUEUE_CAPACITY_V1 = 4_096;

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

function isNonDroppable(sample: PointerInputSampleV1): boolean {
  return (
    sample.eventType === 'pointerdown' ||
    sample.eventType === 'pointerup' ||
    sample.eventType === 'pointercancel'
  );
}

function reductionImportance(
  items: readonly PointerInputSampleV1[],
  index: number,
  incoming: PointerInputSampleV1,
): number {
  const current = items[index];
  if (current === undefined || !isHighFrequencyUpdate(current)) return Number.POSITIVE_INFINITY;

  const previousCandidate = items[index - 1];
  const nextCandidate = items[index + 1];
  const previous =
    previousCandidate?.pointerId === current.pointerId ? previousCandidate : null;
  const next =
    nextCandidate?.pointerId === current.pointerId
      ? nextCandidate
      : incoming.pointerId === current.pointerId
        ? incoming
        : null;

  // A per-stream endpoint is intentionally expensive to remove so the latest
  // confirmed position survives queue pressure whenever an interior point exists.
  if (previous === null || next === null) return 1_000_000;

  const span = next.timestampMs - previous.timestampMs;
  const ratio = span > 0 ? (current.timestampMs - previous.timestampMs) / span : 0.5;
  const t = Math.max(0, Math.min(1, ratio));
  const interpolate = (left: number, right: number): number => left + (right - left) * t;
  const geometryDeviation = Math.hypot(
    current.surfaceX - interpolate(previous.surfaceX, next.surfaceX),
    current.surfaceY - interpolate(previous.surfaceY, next.surfaceY),
  );
  const pressureDeviation = Math.abs(
    current.pressure - interpolate(previous.pressure, next.pressure),
  );
  const tangentialDeviation = Math.abs(
    current.tangentialPressure -
      interpolate(previous.tangentialPressure, next.tangentialPressure),
  );
  const tiltDeviation =
    Math.abs(current.tiltX - interpolate(previous.tiltX, next.tiltX)) +
    Math.abs(current.tiltY - interpolate(previous.tiltY, next.tiltY));

  const pressureExtremum =
    (current.pressure > previous.pressure && current.pressure > next.pressure) ||
    (current.pressure < previous.pressure && current.pressure < next.pressure);
  const tangentialExtremum =
    (current.tangentialPressure > previous.tangentialPressure &&
      current.tangentialPressure > next.tangentialPressure) ||
    (current.tangentialPressure < previous.tangentialPressure &&
      current.tangentialPressure < next.tangentialPressure);

  return (
    geometryDeviation +
    pressureDeviation * 256 +
    tangentialDeviation * 128 +
    tiltDeviation * 2 +
    (pressureExtremum ? 100_000 : 0) +
    (tangentialExtremum ? 50_000 : 0)
  );
}

function reductionCandidateIndex(
  items: readonly PointerInputSampleV1[],
  incoming: PointerInputSampleV1,
): number {
  let selected = -1;
  let selectedImportance = Number.POSITIVE_INFINITY;
  let selectedMatchesIncomingPointer = false;

  for (let index = 0; index < items.length; index += 1) {
    const current = items[index];
    if (current === undefined || !isHighFrequencyUpdate(current)) continue;
    const matchesIncomingPointer = current.pointerId === incoming.pointerId;
    if (selectedMatchesIncomingPointer && !matchesIncomingPointer) continue;

    const importance = reductionImportance(items, index, incoming);
    if (
      selected < 0 ||
      (matchesIncomingPointer && !selectedMatchesIncomingPointer) ||
      (matchesIncomingPointer === selectedMatchesIncomingPointer && importance < selectedImportance)
    ) {
      selected = index;
      selectedImportance = importance;
      selectedMatchesIncomingPointer = matchesIncomingPointer;
    }
  }
  return selected;
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

    const candidateIndex = reductionCandidateIndex(this.#items, sample);
    if (candidateIndex >= 0) {
      const displaced = this.#items[candidateIndex];
      this.#items.splice(candidateIndex, 1);
      this.#items.push(sample);
      if (displaced?.pointerId === sample.pointerId && isHighFrequencyUpdate(sample)) {
        this.#coalesced += 1;
      } else {
        this.#dropped += 1;
      }
      return;
    }

    if (isNonDroppable(sample)) {
      throw new Error('pointer input backpressure cannot discard a non-droppable boundary event');
    }
    this.#dropped += 1;
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
