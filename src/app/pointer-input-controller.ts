import {
  PointerBatchBuilderV1,
  type PointerEventLikeV1,
  type PointerInputBatchV1,
  type PointerInputSampleV1,
} from '../input/pointer-input.js';

export interface PointerInputTargetV1 {
  addEventListener(type: string, listener: EventListener): void;
  removeEventListener(type: string, listener: EventListener): void;
  getBoundingClientRect(): { readonly left: number; readonly top: number };
  setPointerCapture?(pointerId: number): void;
  releasePointerCapture?(pointerId: number): void;
}

export interface PointerInputSnapshotV1 {
  readonly schema: 'illustro.pointer-input-state/1';
  readonly batchCount: number;
  readonly confirmedSampleCount: number;
  readonly latestConfirmed: PointerInputSampleV1 | null;
  readonly predictedPresentation: readonly PointerInputSampleV1[];
}

export interface PointerInputControllerV1 {
  readonly schema: 'illustro.pointer-input-controller/1';
  snapshot(): PointerInputSnapshotV1;
  dispose(): void;
}

export function installPointerInputControllerV1(
  target: PointerInputTargetV1,
  onBatch: (batch: PointerInputBatchV1) => void = () => undefined,
): PointerInputControllerV1 {
  const builder = new PointerBatchBuilderV1();
  const activePointers = new Set<number>();
  const rawPrimaryPenPointers = new Set<number>();
  let surfaceRect = target.getBoundingClientRect();
  let disposed = false;
  let batchCount = 0;
  let confirmedSampleCount = 0;
  let latestConfirmed: PointerInputSampleV1 | null = null;
  let predictedPresentation: readonly PointerInputSampleV1[] = Object.freeze([]);

  const snapshot = (): PointerInputSnapshotV1 =>
    Object.freeze({
      schema: 'illustro.pointer-input-state/1',
      batchCount,
      confirmedSampleCount,
      latestConfirmed,
      predictedPresentation,
    });

  const listener: EventListener = (rawEvent) => {
    if (disposed) return;
    const event = rawEvent as unknown as PointerEventLikeV1;

    if (event.type === 'pointerdown') {
      activePointers.add(event.pointerId);
      rawPrimaryPenPointers.delete(event.pointerId);
      surfaceRect = target.getBoundingClientRect();
    } else if (event.type === 'pointermove' && !activePointers.has(event.pointerId)) {
      // Hover can happen after responsive layout movement. It is outside the drawing hot path,
      // so refresh the surface origin there rather than forcing layout on every active sample.
      surfaceRect = target.getBoundingClientRect();
    }

    if (event.type === 'pointerrawupdate') {
      // Raw updates are a latency optimization for pen input. On Android touch hardware they can
      // be sparse or otherwise unsuitable as the sole drawing stream, so finger drawing keeps
      // pointermove (including its coalesced samples) as the canonical confirmed stream.
      if (event.pointerType === 'touch') return;
      if (event.pointerType === 'pen') rawPrimaryPenPointers.add(event.pointerId);
    } else if (
      event.type === 'pointermove' &&
      event.pointerType === 'pen' &&
      activePointers.has(event.pointerId) &&
      rawPrimaryPenPointers.has(event.pointerId)
    ) {
      // Once raw pen delivery is observed, pointerrawupdate is the confirmed pen stream and the
      // lower-rate pointermove must not duplicate canonical pen paint samples.
      return;
    }

    const batch = builder.build(event, surfaceRect);
    if (batch.eventType === 'pointerdown') {
      try {
        target.setPointerCapture?.(batch.pointerId);
      } catch {
        // Pointer capture can fail when the browser has already invalidated the pointer.
      }
    }

    batchCount += 1;
    confirmedSampleCount += batch.confirmed.length;
    latestConfirmed = batch.confirmed.at(-1) ?? latestConfirmed;
    predictedPresentation = batch.predicted;
    if (batch.eventType === 'pointerup' || batch.eventType === 'pointercancel') {
      predictedPresentation = Object.freeze([]);
    }
    onBatch(batch);

    if (batch.eventType === 'pointerup' || batch.eventType === 'pointercancel') {
      activePointers.delete(batch.pointerId);
      rawPrimaryPenPointers.delete(batch.pointerId);
      try {
        target.releasePointerCapture?.(batch.pointerId);
      } catch {
        // Release is best-effort; the UA may already have released capture.
      }
    }
  };

  const eventTypes = [
    'pointerdown',
    'pointermove',
    'pointerup',
    'pointercancel',
    'pointerrawupdate',
  ] as const;
  for (const type of eventTypes) target.addEventListener(type, listener);

  return Object.freeze({
    schema: 'illustro.pointer-input-controller/1' as const,
    snapshot,
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const type of eventTypes) target.removeEventListener(type, listener);
      activePointers.clear();
      rawPrimaryPenPointers.clear();
      predictedPresentation = Object.freeze([]);
    },
  });
}
