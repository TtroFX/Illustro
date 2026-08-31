export type PointerInputSourceV1 = 'pen' | 'touch' | 'mouse' | 'unknown';
export type PointerInputEventTypeV1 =
  | 'pointerdown'
  | 'pointermove'
  | 'pointerup'
  | 'pointercancel'
  | 'pointerrawupdate';
export type PointerSampleOriginV1 = 'direct' | 'coalesced' | 'predicted';

export interface PointerSurfaceRectV1 {
  readonly left: number;
  readonly top: number;
}

export interface PointerEventLikeV1 {
  readonly type: string;
  readonly pointerId: number;
  readonly pointerType: string;
  readonly isPrimary: boolean;
  readonly clientX: number;
  readonly clientY: number;
  readonly pressure: number;
  readonly tangentialPressure?: number;
  readonly tiltX: number;
  readonly tiltY: number;
  readonly twist?: number;
  readonly altitudeAngle?: number;
  readonly azimuthAngle?: number;
  readonly width: number;
  readonly height: number;
  readonly buttons: number;
  readonly button: number;
  readonly timeStamp: number;
  getCoalescedEvents?(): readonly PointerEventLikeV1[];
  getPredictedEvents?(): readonly PointerEventLikeV1[];
}

export interface PointerInputSampleV1 {
  readonly schema: 'illustro.pointer-sample/1';
  readonly sequence: number;
  readonly pointerId: number;
  readonly source: PointerInputSourceV1;
  readonly eventType: PointerInputEventTypeV1;
  readonly origin: PointerSampleOriginV1;
  readonly isPrimary: boolean;
  readonly timestampMs: number;
  readonly clientX: number;
  readonly clientY: number;
  readonly surfaceX: number;
  readonly surfaceY: number;
  readonly pressure: number;
  readonly tangentialPressure: number;
  readonly tiltX: number;
  readonly tiltY: number;
  readonly twist: number;
  readonly altitudeAngle: number | null;
  readonly azimuthAngle: number | null;
  readonly contactWidth: number;
  readonly contactHeight: number;
  readonly buttons: number;
  readonly button: number;
}

export interface PointerInputBatchV1 {
  readonly schema: 'illustro.pointer-batch/1';
  readonly eventType: PointerInputEventTypeV1;
  readonly pointerId: number;
  readonly confirmed: readonly PointerInputSampleV1[];
  readonly predicted: readonly PointerInputSampleV1[];
}

function finite(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function sourceFromPointerType(pointerType: string): PointerInputSourceV1 {
  if (pointerType === 'pen' || pointerType === 'touch' || pointerType === 'mouse') return pointerType;
  return 'unknown';
}

function parseEventType(type: string): PointerInputEventTypeV1 {
  if (
    type === 'pointerdown' ||
    type === 'pointermove' ||
    type === 'pointerup' ||
    type === 'pointercancel' ||
    type === 'pointerrawupdate'
  ) {
    return type;
  }
  throw new TypeError(`unsupported pointer event type: ${type}`);
}

function nullableAngle(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function normalizePointerSampleV1(
  event: PointerEventLikeV1,
  surfaceRect: PointerSurfaceRectV1,
  origin: PointerSampleOriginV1,
  sequence: number,
  eventTypeOverride?: PointerInputEventTypeV1,
): PointerInputSampleV1 {
  if (!Number.isSafeInteger(sequence) || sequence < 0) {
    throw new RangeError('pointer sample sequence must be a non-negative safe integer');
  }
  if (!Number.isSafeInteger(event.pointerId) || event.pointerId < 0) {
    throw new RangeError('pointerId must be a non-negative safe integer');
  }
  const eventType = eventTypeOverride ?? parseEventType(event.type);
  const clientX = finite(event.clientX);
  const clientY = finite(event.clientY);
  return Object.freeze({
    schema: 'illustro.pointer-sample/1',
    sequence,
    pointerId: event.pointerId,
    source: sourceFromPointerType(event.pointerType),
    eventType,
    origin,
    isPrimary: event.isPrimary === true,
    timestampMs: Math.max(0, finite(event.timeStamp)),
    clientX,
    clientY,
    surfaceX: clientX - finite(surfaceRect.left),
    surfaceY: clientY - finite(surfaceRect.top),
    pressure: clamp(finite(event.pressure), 0, 1),
    tangentialPressure: clamp(finite(event.tangentialPressure), -1, 1),
    tiltX: clamp(finite(event.tiltX), -90, 90),
    tiltY: clamp(finite(event.tiltY), -90, 90),
    twist: clamp(finite(event.twist), 0, 359),
    altitudeAngle: nullableAngle(event.altitudeAngle),
    azimuthAngle: nullableAngle(event.azimuthAngle),
    contactWidth: Math.max(0, finite(event.width)),
    contactHeight: Math.max(0, finite(event.height)),
    buttons: Math.max(0, Math.trunc(finite(event.buttons))),
    button: Math.trunc(finite(event.button, -1)),
  });
}

export class PointerBatchBuilderV1 {
  #sequence = 0;

  build(event: PointerEventLikeV1, surfaceRect: PointerSurfaceRectV1): PointerInputBatchV1 {
    const eventType = parseEventType(event.type);
    const coalesced = event.getCoalescedEvents?.() ?? [];
    const confirmedEvents = coalesced.length > 0 ? coalesced : [event];
    const confirmedOrigin: PointerSampleOriginV1 = coalesced.length > 0 ? 'coalesced' : 'direct';
    const confirmed = confirmedEvents.map((sample) =>
      normalizePointerSampleV1(sample, surfaceRect, confirmedOrigin, this.#sequence++, eventType),
    );

    const predictedEvents =
      eventType === 'pointermove' || eventType === 'pointerrawupdate'
        ? (event.getPredictedEvents?.() ?? [])
        : [];
    const predicted = predictedEvents.map((sample) =>
      normalizePointerSampleV1(sample, surfaceRect, 'predicted', this.#sequence++, eventType),
    );

    return Object.freeze({
      schema: 'illustro.pointer-batch/1',
      eventType,
      pointerId: event.pointerId,
      confirmed: Object.freeze(confirmed),
      predicted: Object.freeze(predicted),
    });
  }
}
