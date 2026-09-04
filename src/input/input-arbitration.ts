import type { PointerInputBatchV1, PointerInputSampleV1 } from './pointer-input.js';

export const DEFAULT_RECENT_PEN_BIAS_MS_V1 = 750;
export const DEFAULT_PALM_CONTACT_THRESHOLD_CSS_PX_V1 = 18;
export const TOUCH_POSITION_OFFSET_LIMIT_CSS_PX_V1 = 256;

export type PointerInputDispositionV1 = 'tool' | 'navigation' | 'hover' | 'rejected-palm';
export type PointerInputArbitrationReasonV1 =
  | 'pen-tool'
  | 'pen-hover'
  | 'mouse-tool'
  | 'mouse-hover'
  | 'touch-navigation'
  | 'touch-finger-drawing'
  | 'touch-multitouch-navigation'
  | 'touch-during-pen-contact'
  | 'touch-recent-pen-large-contact'
  | 'unknown-source';

export interface PointerInputArbitrationOptionsV1 {
  readonly fingerDrawingEnabled?: boolean;
  readonly recentPenBiasMs?: number;
  readonly palmContactThresholdCssPx?: number;
  readonly touchOffsetXCssPx?: number;
  readonly touchOffsetYCssPx?: number;
}

export interface PointerInputArbitrationDecisionV1 {
  readonly schema: 'illustro.pointer-arbitration-decision/1';
  readonly disposition: PointerInputDispositionV1;
  readonly reason: PointerInputArbitrationReasonV1;
  readonly forwardBatch: PointerInputBatchV1 | null;
  readonly cancelToolPointerIds: readonly number[];
}

export interface PointerInputArbitrationSnapshotV1 {
  readonly schema: 'illustro.pointer-arbitration-state/1';
  readonly fingerDrawingEnabled: boolean;
  readonly touchOffsetXCssPx: number;
  readonly touchOffsetYCssPx: number;
  readonly activePenContacts: number;
  readonly activeTouchContacts: number;
  readonly lastPenTimestampMs: number | null;
  readonly rejectedPalmContacts: number;
}

function latestConfirmed(batch: PointerInputBatchV1): PointerInputSampleV1 | null {
  return batch.confirmed.at(-1) ?? null;
}

function isHoverSample(sample: PointerInputSampleV1): boolean {
  return (
    (sample.eventType === 'pointermove' || sample.eventType === 'pointerrawupdate') &&
    sample.buttons === 0 &&
    sample.pressure === 0
  );
}

function isTerminal(batch: PointerInputBatchV1): boolean {
  return batch.eventType === 'pointerup' || batch.eventType === 'pointercancel';
}

function defaultFingerDrawingEnabledV1(): boolean {
  return true;
}

function normalizeTouchOffsetCssPxV1(value: number, label: string): number {
  if (!Number.isFinite(value)) throw new RangeError(`${label} must be finite`);
  if (Math.abs(value) > TOUCH_POSITION_OFFSET_LIMIT_CSS_PX_V1) {
    throw new RangeError(
      `${label} must be within -${TOUCH_POSITION_OFFSET_LIMIT_CSS_PX_V1}..${TOUCH_POSITION_OFFSET_LIMIT_CSS_PX_V1}`,
    );
  }
  return Object.is(value, -0) ? 0 : value;
}

function mapTouchSampleToToolV1(
  sample: PointerInputSampleV1,
  offsetXCssPx: number,
  offsetYCssPx: number,
): PointerInputSampleV1 {
  if (sample.source !== 'touch') return sample;
  return Object.freeze({
    ...sample,
    source: 'mouse' as const,
    clientX: sample.clientX + offsetXCssPx,
    clientY: sample.clientY + offsetYCssPx,
    surfaceX: sample.surfaceX + offsetXCssPx,
    surfaceY: sample.surfaceY + offsetYCssPx,
  });
}

function mapTouchBatchToToolV1(
  batch: PointerInputBatchV1,
  offsetXCssPx: number,
  offsetYCssPx: number,
): PointerInputBatchV1 {
  return Object.freeze({
    ...batch,
    confirmed: Object.freeze(
      batch.confirmed.map((sample) => mapTouchSampleToToolV1(sample, offsetXCssPx, offsetYCssPx)),
    ),
    predicted: Object.freeze(
      batch.predicted.map((sample) => mapTouchSampleToToolV1(sample, offsetXCssPx, offsetYCssPx)),
    ),
  });
}

function cancellationBatchV1(
  sample: PointerInputSampleV1,
  offsetXCssPx: number,
  offsetYCssPx: number,
): PointerInputBatchV1 {
  const cancelled = mapTouchSampleToToolV1(
    Object.freeze({
      ...sample,
      eventType: 'pointercancel' as const,
      origin: 'direct' as const,
      pressure: 0,
      buttons: 0,
      button: -1,
    }),
    offsetXCssPx,
    offsetYCssPx,
  );
  return Object.freeze({
    schema: 'illustro.pointer-batch/1' as const,
    eventType: 'pointercancel' as const,
    pointerId: sample.pointerId,
    confirmed: Object.freeze([cancelled]),
    predicted: Object.freeze([]),
  });
}

export class PointerInputArbitrationV1 {
  #fingerDrawingEnabled: boolean;
  #touchOffsetXCssPx: number;
  #touchOffsetYCssPx: number;
  readonly #recentPenBiasMs: number;
  readonly #palmContactThresholdCssPx: number;
  readonly #activePenPointers = new Set<number>();
  readonly #activeTouchPointers = new Set<number>();
  readonly #touchDisposition = new Map<number, PointerInputDispositionV1>();
  readonly #touchReason = new Map<number, PointerInputArbitrationReasonV1>();
  readonly #latestTouchSample = new Map<number, PointerInputSampleV1>();
  #lastPenTimestampMs: number | null = null;
  #rejectedPalmContacts = 0;

  constructor(options: PointerInputArbitrationOptionsV1 = {}) {
    this.#fingerDrawingEnabled = options.fingerDrawingEnabled ?? defaultFingerDrawingEnabledV1();
    this.#touchOffsetXCssPx = normalizeTouchOffsetCssPxV1(
      options.touchOffsetXCssPx ?? 0,
      'touch offset X',
    );
    this.#touchOffsetYCssPx = normalizeTouchOffsetCssPxV1(
      options.touchOffsetYCssPx ?? 0,
      'touch offset Y',
    );
    this.#recentPenBiasMs = options.recentPenBiasMs ?? DEFAULT_RECENT_PEN_BIAS_MS_V1;
    this.#palmContactThresholdCssPx =
      options.palmContactThresholdCssPx ?? DEFAULT_PALM_CONTACT_THRESHOLD_CSS_PX_V1;
    if (!Number.isFinite(this.#recentPenBiasMs) || this.#recentPenBiasMs < 0) {
      throw new RangeError('recent pen bias must be a finite non-negative duration');
    }
    if (!Number.isFinite(this.#palmContactThresholdCssPx) || this.#palmContactThresholdCssPx < 0) {
      throw new RangeError('palm contact threshold must be a finite non-negative size');
    }
  }

  route(batch: PointerInputBatchV1): PointerInputArbitrationDecisionV1 {
    const sample = latestConfirmed(batch);
    if (sample === null) return this.#decision('navigation', 'unknown-source', null);

    if (sample.source === 'pen') return this.#routePen(batch, sample);
    if (sample.source === 'touch') return this.#routeTouch(batch, sample);
    if (sample.source === 'mouse') {
      if (isHoverSample(sample)) return this.#decision('hover', 'mouse-hover', null);
      return this.#decision('tool', 'mouse-tool', batch);
    }
    return this.#decision('navigation', 'unknown-source', null);
  }

  snapshot(): PointerInputArbitrationSnapshotV1 {
    return Object.freeze({
      schema: 'illustro.pointer-arbitration-state/1' as const,
      fingerDrawingEnabled: this.#fingerDrawingEnabled,
      touchOffsetXCssPx: this.#touchOffsetXCssPx,
      touchOffsetYCssPx: this.#touchOffsetYCssPx,
      activePenContacts: this.#activePenPointers.size,
      activeTouchContacts: this.#activeTouchPointers.size,
      lastPenTimestampMs: this.#lastPenTimestampMs,
      rejectedPalmContacts: this.#rejectedPalmContacts,
    });
  }

  setFingerDrawingEnabled(enabled: boolean): PointerInputArbitrationSnapshotV1 {
    this.#fingerDrawingEnabled = enabled;
    return this.snapshot();
  }

  setTouchPositionOffset(
    offsetXCssPx: number,
    offsetYCssPx: number,
  ): PointerInputArbitrationSnapshotV1 {
    this.#touchOffsetXCssPx = normalizeTouchOffsetCssPxV1(offsetXCssPx, 'touch offset X');
    this.#touchOffsetYCssPx = normalizeTouchOffsetCssPxV1(offsetYCssPx, 'touch offset Y');
    return this.snapshot();
  }

  #routePen(
    batch: PointerInputBatchV1,
    sample: PointerInputSampleV1,
  ): PointerInputArbitrationDecisionV1 {
    this.#lastPenTimestampMs = sample.timestampMs;
    if (batch.eventType === 'pointerdown') this.#activePenPointers.add(batch.pointerId);

    const activeContact = this.#activePenPointers.has(batch.pointerId);
    const hover = !activeContact && isHoverSample(sample);
    const decision = hover
      ? this.#decision('hover', 'pen-hover', null)
      : this.#decision('tool', 'pen-tool', batch);

    if (isTerminal(batch)) this.#activePenPointers.delete(batch.pointerId);
    return decision;
  }

  #routeTouch(
    batch: PointerInputBatchV1,
    sample: PointerInputSampleV1,
  ): PointerInputArbitrationDecisionV1 {
    let disposition = this.#touchDisposition.get(batch.pointerId);
    let reason = this.#touchReason.get(batch.pointerId);
    const cancelToolPointerIds: number[] = [];
    let transitionCancelBatch: PointerInputBatchV1 | null = null;

    if (batch.eventType === 'pointerdown' || disposition === undefined || reason === undefined) {
      const penActive = this.#activePenPointers.size > 0;
      const recentPen =
        this.#lastPenTimestampMs !== null &&
        sample.timestampMs >= this.#lastPenTimestampMs &&
        sample.timestampMs - this.#lastPenTimestampMs <= this.#recentPenBiasMs;
      const largeContact =
        Math.max(sample.contactWidth, sample.contactHeight) >= this.#palmContactThresholdCssPx;

      if (penActive) {
        disposition = 'rejected-palm';
        reason = 'touch-during-pen-contact';
      } else if (recentPen && largeContact) {
        disposition = 'rejected-palm';
        reason = 'touch-recent-pen-large-contact';
      } else if (this.#fingerDrawingEnabled && this.#activeTouchPointers.size === 0) {
        disposition = 'tool';
        reason = 'touch-finger-drawing';
      } else if (this.#fingerDrawingEnabled && this.#activeTouchPointers.size > 0) {
        disposition = 'navigation';
        reason = 'touch-multitouch-navigation';
        for (const pointerId of this.#activeTouchPointers) {
          if (this.#touchDisposition.get(pointerId) === 'tool') {
            cancelToolPointerIds.push(pointerId);
            const previous = this.#latestTouchSample.get(pointerId);
            if (transitionCancelBatch === null && previous !== undefined) {
              transitionCancelBatch = cancellationBatchV1(
                previous,
                this.#touchOffsetXCssPx,
                this.#touchOffsetYCssPx,
              );
            }
          }
          if (this.#touchDisposition.get(pointerId) !== 'rejected-palm') {
            this.#touchDisposition.set(pointerId, 'navigation');
            this.#touchReason.set(pointerId, 'touch-multitouch-navigation');
          }
        }
      } else {
        disposition = 'navigation';
        reason = 'touch-navigation';
      }

      if (batch.eventType === 'pointerdown') {
        this.#activeTouchPointers.add(batch.pointerId);
        this.#touchDisposition.set(batch.pointerId, disposition);
        this.#touchReason.set(batch.pointerId, reason);
        if (disposition === 'rejected-palm') this.#rejectedPalmContacts += 1;
      }
    }

    this.#latestTouchSample.set(batch.pointerId, sample);
    const forwardBatch =
      transitionCancelBatch ??
      (disposition === 'tool'
        ? mapTouchBatchToToolV1(batch, this.#touchOffsetXCssPx, this.#touchOffsetYCssPx)
        : null);
    const decision = this.#decision(
      transitionCancelBatch === null ? disposition : 'tool',
      reason,
      forwardBatch,
      cancelToolPointerIds,
    );
    if (isTerminal(batch)) {
      this.#activeTouchPointers.delete(batch.pointerId);
      this.#touchDisposition.delete(batch.pointerId);
      this.#touchReason.delete(batch.pointerId);
      this.#latestTouchSample.delete(batch.pointerId);
    }
    return decision;
  }

  #decision(
    disposition: PointerInputDispositionV1,
    reason: PointerInputArbitrationReasonV1,
    forwardBatch: PointerInputBatchV1 | null,
    cancelToolPointerIds: readonly number[] = Object.freeze([]),
  ): PointerInputArbitrationDecisionV1 {
    return Object.freeze({
      schema: 'illustro.pointer-arbitration-decision/1' as const,
      disposition,
      reason,
      forwardBatch,
      cancelToolPointerIds: Object.freeze([...cancelToolPointerIds]),
    });
  }
}

export function createPointerInputArbitrationV1(
  options: PointerInputArbitrationOptionsV1 = {},
): PointerInputArbitrationV1 {
  return new PointerInputArbitrationV1(options);
}
