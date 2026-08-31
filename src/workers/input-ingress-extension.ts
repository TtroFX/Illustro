import {
  BoundedPointerInputQueueV1,
  DEFAULT_POINTER_INPUT_QUEUE_CAPACITY_V1,
} from '../input/input-queue.js';
import {
  decodePointerSamplesV1,
  POINTER_INPUT_RECORD_STRIDE_V1,
  POINTER_INPUT_SHARED_HEADER_INDICES_V1,
  readPointerSampleRecordV1,
} from '../input/input-transport.js';
import type { PointerInputSampleV1 } from '../input/pointer-input.js';

export interface RenderInputIngressScopeV1 {
  postMessage(message: unknown): void;
}

export interface RenderInputIngressSnapshotV1 {
  readonly schema: 'illustro.render-input-ingress/1';
  readonly mode: 'uninitialized' | 'transferable' | 'shared-memory';
  readonly receivedSamples: number;
  readonly queue: ReturnType<BoundedPointerInputQueueV1['snapshot']>;
}

export interface RenderInputIngressControllerV1 {
  readonly schema: 'illustro.render-input-ingress-controller/1';
  handle(message: unknown): boolean;
  snapshot(): RenderInputIngressSnapshotV1;
  drain(maxCount?: number): readonly PointerInputSampleV1[];
  dispose(): void;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function installRenderInputIngressV1(
  scope: RenderInputIngressScopeV1,
  queueCapacity = DEFAULT_POINTER_INPUT_QUEUE_CAPACITY_V1,
): RenderInputIngressControllerV1 {
  const queue = new BoundedPointerInputQueueV1(queueCapacity);
  let disposed = false;
  let mode: RenderInputIngressSnapshotV1['mode'] = 'uninitialized';
  let receivedSamples = 0;
  let sharedHeader: Int32Array | null = null;
  let sharedData: Float64Array | null = null;
  let sharedCapacity = 0;

  const snapshot = (): RenderInputIngressSnapshotV1 =>
    Object.freeze({
      schema: 'illustro.render-input-ingress/1' as const,
      mode,
      receivedSamples,
      queue: queue.snapshot(),
    });

  const drainShared = (): void => {
    const header = sharedHeader;
    const data = sharedData;
    if (header === null || data === null || sharedCapacity < 1) return;
    let remaining = Atomics.load(header, POINTER_INPUT_SHARED_HEADER_INDICES_V1.count);
    let guard = 0;
    while (remaining > 0 && guard < sharedCapacity) {
      const readIndex = Atomics.load(header, POINTER_INPUT_SHARED_HEADER_INDICES_V1.read);
      queue.enqueue(readPointerSampleRecordV1(data, readIndex * POINTER_INPUT_RECORD_STRIDE_V1));
      Atomics.store(
        header,
        POINTER_INPUT_SHARED_HEADER_INDICES_V1.read,
        (readIndex + 1) % sharedCapacity,
      );
      Atomics.sub(header, POINTER_INPUT_SHARED_HEADER_INDICES_V1.count, 1);
      receivedSamples += 1;
      guard += 1;
      remaining = Atomics.load(header, POINTER_INPUT_SHARED_HEADER_INDICES_V1.count);
    }
  };

  const handle = (message: unknown): boolean => {
    if (disposed || !isRecord(message) || typeof message.type !== 'string') return false;

    if (message.type === 'renderer.input.transfer') {
      if (
        message.schema !== 'illustro.pointer-transfer/1' ||
        message.stride !== POINTER_INPUT_RECORD_STRIDE_V1 ||
        !(message.buffer instanceof ArrayBuffer) ||
        typeof message.count !== 'number' ||
        !Number.isSafeInteger(message.count) ||
        message.count < 0 ||
        message.count > queueCapacity
      ) {
        scope.postMessage({ type: 'renderer.input.error', reason: 'invalid-transfer-message' });
        return true;
      }
      const samples = decodePointerSamplesV1(message.buffer, message.count);
      for (const sample of samples) queue.enqueue(sample);
      receivedSamples += samples.length;
      mode = 'transferable';
      return true;
    }

    if (message.type === 'renderer.input.sab.init') {
      const sharedMemoryAvailable = typeof SharedArrayBuffer !== 'undefined';
      if (
        !sharedMemoryAvailable ||
        message.schema !== 'illustro.pointer-sab/1' ||
        message.stride !== POINTER_INPUT_RECORD_STRIDE_V1 ||
        typeof message.capacity !== 'number' ||
        !Number.isSafeInteger(message.capacity) ||
        message.capacity < 1 ||
        message.capacity > queueCapacity ||
        !(message.header instanceof SharedArrayBuffer) ||
        !(message.data instanceof SharedArrayBuffer)
      ) {
        scope.postMessage({ type: 'renderer.input.error', reason: 'invalid-shared-memory-init' });
        return true;
      }
      const header = new Int32Array(message.header);
      const data = new Float64Array(message.data);
      if (
        header.length <= POINTER_INPUT_SHARED_HEADER_INDICES_V1.count ||
        data.length < message.capacity * POINTER_INPUT_RECORD_STRIDE_V1
      ) {
        scope.postMessage({ type: 'renderer.input.error', reason: 'short-shared-memory-buffer' });
        return true;
      }
      queue.drain();
      sharedHeader = header;
      sharedData = data;
      sharedCapacity = message.capacity;
      mode = 'shared-memory';
      return true;
    }

    if (message.type === 'renderer.input.sab.notify') {
      if (message.schema !== 'illustro.pointer-sab/1') {
        scope.postMessage({ type: 'renderer.input.error', reason: 'invalid-shared-memory-notify' });
        return true;
      }
      drainShared();
      return true;
    }

    if (message.type === 'renderer.input.inspect') {
      if (typeof message.requestId === 'string') {
        scope.postMessage({
          type: 'renderer.input.snapshot',
          requestId: message.requestId,
          snapshot: snapshot(),
        });
      }
      return true;
    }

    return false;
  };

  return Object.freeze({
    schema: 'illustro.render-input-ingress-controller/1' as const,
    handle,
    snapshot,
    drain(maxCount?: number) {
      drainShared();
      return maxCount === undefined ? queue.drain() : queue.drain(maxCount);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      queue.drain();
      sharedHeader = null;
      sharedData = null;
      sharedCapacity = 0;
    },
  });
}
