import type {
  PointerInputBatchV1,
  PointerInputSampleV1,
  PointerInputSourceV1,
} from './pointer-input.js';

export interface PointerHoverSnapshotV1 {
  readonly schema: 'illustro.pointer-hover-state/1';
  readonly active: boolean;
  readonly source: PointerInputSourceV1 | null;
  readonly pointerId: number | null;
  readonly surfaceX: number | null;
  readonly surfaceY: number | null;
  readonly pressure: number | null;
  readonly tiltX: number | null;
  readonly tiltY: number | null;
  readonly twist: number | null;
  readonly altitudeAngle: number | null;
  readonly azimuthAngle: number | null;
  readonly timestampMs: number | null;
}

function isHoverSample(sample: PointerInputSampleV1): boolean {
  return (
    (sample.source === 'pen' || sample.source === 'mouse') &&
    (sample.eventType === 'pointermove' || sample.eventType === 'pointerrawupdate') &&
    sample.buttons === 0 &&
    sample.pressure === 0
  );
}

export class PointerHoverTrackerV1 {
  #sample: PointerInputSampleV1 | null = null;

  ingest(batch: PointerInputBatchV1): PointerHoverSnapshotV1 {
    const sample = batch.confirmed.at(-1) ?? null;
    if (sample === null) return this.snapshot();

    if (isHoverSample(sample)) {
      this.#sample = sample;
      return this.snapshot();
    }

    if (
      this.#sample?.pointerId === batch.pointerId &&
      (batch.eventType === 'pointerdown' ||
        batch.eventType === 'pointerup' ||
        batch.eventType === 'pointercancel' ||
        sample.buttons !== 0 ||
        sample.pressure !== 0)
    ) {
      this.#sample = null;
    }
    return this.snapshot();
  }

  snapshot(): PointerHoverSnapshotV1 {
    const sample = this.#sample;
    if (sample === null) {
      return Object.freeze({
        schema: 'illustro.pointer-hover-state/1' as const,
        active: false,
        source: null,
        pointerId: null,
        surfaceX: null,
        surfaceY: null,
        pressure: null,
        tiltX: null,
        tiltY: null,
        twist: null,
        altitudeAngle: null,
        azimuthAngle: null,
        timestampMs: null,
      });
    }
    return Object.freeze({
      schema: 'illustro.pointer-hover-state/1' as const,
      active: true,
      source: sample.source,
      pointerId: sample.pointerId,
      surfaceX: sample.surfaceX,
      surfaceY: sample.surfaceY,
      pressure: sample.pressure,
      tiltX: sample.tiltX,
      tiltY: sample.tiltY,
      twist: sample.twist,
      altitudeAngle: sample.altitudeAngle,
      azimuthAngle: sample.azimuthAngle,
      timestampMs: sample.timestampMs,
    });
  }

  clear(): void {
    this.#sample = null;
  }
}
