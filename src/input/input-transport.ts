import { BoundedPointerInputQueueV1 } from './input-queue.js';
import type {
  PointerInputBatchV1,
  PointerInputEventTypeV1,
  PointerInputSampleV1,
  PointerInputSourceV1,
  PointerSampleOriginV1,
} from './pointer-input.js';

export const POINTER_INPUT_RECORD_STRIDE_V1 = 22;
export const DEFAULT_POINTER_SHARED_RING_CAPACITY_V1 = 256;

const HEADER_WRITE_INDEX = 0;
const HEADER_READ_INDEX = 1;
const HEADER_COUNT_INDEX = 2;
const HEADER_LENGTH = 3;

const SOURCE_CODES: Readonly<Record<PointerInputSourceV1, number>> = Object.freeze({
  unknown: 0,
  pen: 1,
  touch: 2,
  mouse: 3,
});

const EVENT_CODES: Readonly<Record<PointerInputEventTypeV1, number>> = Object.freeze({
  pointerdown: 0,
  pointermove: 1,
  pointerup: 2,
  pointercancel: 3,
  pointerrawupdate: 4,
});

const ORIGIN_CODES: Readonly<Record<PointerSampleOriginV1, number>> = Object.freeze({
  direct: 0,
  coalesced: 1,
  predicted: 2,
});

function sourceFromCode(code: number): PointerInputSourceV1 {
  if (code === 1) return 'pen';
  if (code === 2) return 'touch';
  if (code === 3) return 'mouse';
  return 'unknown';
}

function eventTypeFromCode(code: number): PointerInputEventTypeV1 {
  if (code === 0) return 'pointerdown';
  if (code === 1) return 'pointermove';
  if (code === 2) return 'pointerup';
  if (code === 3) return 'pointercancel';
  if (code === 4) return 'pointerrawupdate';
  throw new RangeError(`unsupported pointer event code: ${code}`);
}

function originFromCode(code: number): PointerSampleOriginV1 {
  if (code === 0) return 'direct';
  if (code === 1) return 'coalesced';
  if (code === 2) return 'predicted';
  throw new RangeError(`unsupported pointer origin code: ${code}`);
}

export function writePointerSampleRecordV1(
  view: Float64Array,
  offset: number,
  sample: PointerInputSampleV1,
): void {
  if (
    !Number.isSafeInteger(offset) ||
    offset < 0 ||
    offset + POINTER_INPUT_RECORD_STRIDE_V1 > view.length
  ) {
    throw new RangeError('pointer sample record offset is outside the destination view');
  }
  view[offset] = sample.sequence;
  view[offset + 1] = sample.pointerId;
  view[offset + 2] = SOURCE_CODES[sample.source];
  view[offset + 3] = EVENT_CODES[sample.eventType];
  view[offset + 4] = ORIGIN_CODES[sample.origin];
  view[offset + 5] = sample.isPrimary ? 1 : 0;
  view[offset + 6] = sample.timestampMs;
  view[offset + 7] = sample.clientX;
  view[offset + 8] = sample.clientY;
  view[offset + 9] = sample.surfaceX;
  view[offset + 10] = sample.surfaceY;
  view[offset + 11] = sample.pressure;
  view[offset + 12] = sample.tangentialPressure;
  view[offset + 13] = sample.tiltX;
  view[offset + 14] = sample.tiltY;
  view[offset + 15] = sample.twist;
  view[offset + 16] = sample.altitudeAngle ?? Number.NaN;
  view[offset + 17] = sample.azimuthAngle ?? Number.NaN;
  view[offset + 18] = sample.contactWidth;
  view[offset + 19] = sample.contactHeight;
  view[offset + 20] = sample.buttons;
  view[offset + 21] = sample.button;
}

export function readPointerSampleRecordV1(
  view: Float64Array,
  offset: number,
): PointerInputSampleV1 {
  if (
    !Number.isSafeInteger(offset) ||
    offset < 0 ||
    offset + POINTER_INPUT_RECORD_STRIDE_V1 > view.length
  ) {
    throw new RangeError('pointer sample record offset is outside the source view');
  }
  const altitude = view[offset + 16];
  const azimuth = view[offset + 17];
  return Object.freeze({
    schema: 'illustro.pointer-sample/1' as const,
    sequence: Math.max(0, Math.trunc(view[offset] ?? 0)),
    pointerId: Math.max(0, Math.trunc(view[offset + 1] ?? 0)),
    source: sourceFromCode(Math.trunc(view[offset + 2] ?? 0)),
    eventType: eventTypeFromCode(Math.trunc(view[offset + 3] ?? -1)),
    origin: originFromCode(Math.trunc(view[offset + 4] ?? -1)),
    isPrimary: (view[offset + 5] ?? 0) !== 0,
    timestampMs: Math.max(0, view[offset + 6] ?? 0),
    clientX: view[offset + 7] ?? 0,
    clientY: view[offset + 8] ?? 0,
    surfaceX: view[offset + 9] ?? 0,
    surfaceY: view[offset + 10] ?? 0,
    pressure: view[offset + 11] ?? 0,
    tangentialPressure: view[offset + 12] ?? 0,
    tiltX: view[offset + 13] ?? 0,
    tiltY: view[offset + 14] ?? 0,
    twist: view[offset + 15] ?? 0,
    altitudeAngle: altitude === undefined || Number.isNaN(altitude) ? null : altitude,
    azimuthAngle: azimuth === undefined || Number.isNaN(azimuth) ? null : azimuth,
    contactWidth: view[offset + 18] ?? 0,
    contactHeight: view[offset + 19] ?? 0,
    buttons: Math.max(0, Math.trunc(view[offset + 20] ?? 0)),
    button: Math.trunc(view[offset + 21] ?? -1),
  });
}

export function encodePointerSamplesV1(samples: readonly PointerInputSampleV1[]): ArrayBuffer {
  const buffer = new ArrayBuffer(
    samples.length * POINTER_INPUT_RECORD_STRIDE_V1 * Float64Array.BYTES_PER_ELEMENT,
  );
  const view = new Float64Array(buffer);
  samples.forEach((sample, index) => {
    writePointerSampleRecordV1(view, index * POINTER_INPUT_RECORD_STRIDE_V1, sample);
  });
  return buffer;
}

export function decodePointerSamplesV1(
  buffer: ArrayBuffer,
  count: number,
): readonly PointerInputSampleV1[] {
  if (!Number.isSafeInteger(count) || count < 0) {
    throw new RangeError('pointer sample count must be a non-negative safe integer');
  }
  const requiredBytes = count * POINTER_INPUT_RECORD_STRIDE_V1 * Float64Array.BYTES_PER_ELEMENT;
  if (buffer.byteLength < requiredBytes) {
    throw new RangeError('pointer sample buffer is shorter than the declared count');
  }
  const view = new Float64Array(buffer, 0, count * POINTER_INPUT_RECORD_STRIDE_V1);
  const samples: PointerInputSampleV1[] = [];
  for (let index = 0; index < count; index += 1) {
    samples.push(readPointerSampleRecordV1(view, index * POINTER_INPUT_RECORD_STRIDE_V1));
  }
  return Object.freeze(samples);
}

export type PointerInputTransportModeV1 = 'shared-memory' | 'transferable';

export interface PointerInputTransportTargetV1 {
  postMessage(message: unknown, transfer?: Transferable[]): void;
}

export interface PointerInputTransportOptionsV1 {
  readonly sharedMemoryFastPath: boolean;
  readonly queueCapacity?: number;
  readonly sharedRingCapacity?: number;
}

export interface PointerInputTransportSnapshotV1 {
  readonly schema: 'illustro.pointer-input-transport/1';
  readonly mode: PointerInputTransportModeV1;
  readonly queue: ReturnType<BoundedPointerInputQueueV1['snapshot']>;
  readonly sentSamples: number;
  readonly sentMessages: number;
  readonly sharedPendingSamples: number;
}

export class PointerInputTransportV1 {
  readonly #target: PointerInputTransportTargetV1;
  readonly #queue: BoundedPointerInputQueueV1;
  readonly #mode: PointerInputTransportModeV1;
  readonly #sharedCapacity: number;
  #sharedHeader: Int32Array | null = null;
  #sharedData: Float64Array | null = null;
  #disposed = false;
  #sentSamples = 0;
  #sentMessages = 0;

  constructor(target: PointerInputTransportTargetV1, options: PointerInputTransportOptionsV1) {
    this.#target = target;
    this.#queue = new BoundedPointerInputQueueV1(options.queueCapacity);
    const sharedMemoryAvailable =
      options.sharedMemoryFastPath &&
      typeof SharedArrayBuffer !== 'undefined' &&
      typeof Atomics !== 'undefined';
    this.#mode = sharedMemoryAvailable ? 'shared-memory' : 'transferable';
    const requestedCapacity = options.sharedRingCapacity ?? DEFAULT_POINTER_SHARED_RING_CAPACITY_V1;
    if (!Number.isSafeInteger(requestedCapacity) || requestedCapacity < 1) {
      throw new RangeError('pointer shared ring capacity must be a positive safe integer');
    }
    this.#sharedCapacity = requestedCapacity;

    if (this.#mode === 'shared-memory') {
      const headerBuffer = new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT * HEADER_LENGTH);
      const dataBuffer = new SharedArrayBuffer(
        Float64Array.BYTES_PER_ELEMENT * this.#sharedCapacity * POINTER_INPUT_RECORD_STRIDE_V1,
      );
      this.#sharedHeader = new Int32Array(headerBuffer);
      this.#sharedData = new Float64Array(dataBuffer);
      this.#target.postMessage({
        type: 'renderer.input.sab.init',
        schema: 'illustro.pointer-sab/1',
        capacity: this.#sharedCapacity,
        stride: POINTER_INPUT_RECORD_STRIDE_V1,
        header: headerBuffer,
        data: dataBuffer,
      });
      this.#sentMessages += 1;
    }
  }

  enqueueBatch(batch: PointerInputBatchV1): void {
    if (this.#disposed) return;
    this.#queue.enqueueBatch(batch);
    this.flush();
  }

  flush(): void {
    if (this.#disposed || this.#queue.size === 0) return;
    if (this.#mode === 'shared-memory') {
      this.#flushShared();
      return;
    }
    const samples = this.#queue.drain();
    if (samples.length === 0) return;
    const buffer = encodePointerSamplesV1(samples);
    this.#target.postMessage(
      {
        type: 'renderer.input.transfer',
        schema: 'illustro.pointer-transfer/1',
        stride: POINTER_INPUT_RECORD_STRIDE_V1,
        count: samples.length,
        buffer,
      },
      [buffer],
    );
    this.#sentSamples += samples.length;
    this.#sentMessages += 1;
  }

  snapshot(): PointerInputTransportSnapshotV1 {
    return Object.freeze({
      schema: 'illustro.pointer-input-transport/1' as const,
      mode: this.#mode,
      queue: this.#queue.snapshot(),
      sentSamples: this.#sentSamples,
      sentMessages: this.#sentMessages,
      sharedPendingSamples:
        this.#sharedHeader === null ? 0 : Atomics.load(this.#sharedHeader, HEADER_COUNT_INDEX),
    });
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#queue.drain();
    this.#sharedHeader = null;
    this.#sharedData = null;
  }

  #flushShared(): void {
    const header = this.#sharedHeader;
    const data = this.#sharedData;
    if (header === null || data === null) return;
    let written = 0;
    while (
      this.#queue.size > 0 &&
      Atomics.load(header, HEADER_COUNT_INDEX) < this.#sharedCapacity
    ) {
      const sample = this.#queue.drain(1)[0];
      if (sample === undefined) break;
      const writeIndex = Atomics.load(header, HEADER_WRITE_INDEX);
      writePointerSampleRecordV1(data, writeIndex * POINTER_INPUT_RECORD_STRIDE_V1, sample);
      Atomics.store(header, HEADER_WRITE_INDEX, (writeIndex + 1) % this.#sharedCapacity);
      Atomics.add(header, HEADER_COUNT_INDEX, 1);
      written += 1;
    }
    if (written === 0) return;
    this.#target.postMessage({
      type: 'renderer.input.sab.notify',
      schema: 'illustro.pointer-sab/1',
      written,
    });
    this.#sentSamples += written;
    this.#sentMessages += 1;
  }
}

export function createPointerInputTransportV1(
  target: PointerInputTransportTargetV1,
  options: PointerInputTransportOptionsV1,
): PointerInputTransportV1 {
  return new PointerInputTransportV1(target, options);
}

export const POINTER_INPUT_SHARED_HEADER_INDICES_V1 = Object.freeze({
  write: HEADER_WRITE_INDEX,
  read: HEADER_READ_INDEX,
  count: HEADER_COUNT_INDEX,
});
