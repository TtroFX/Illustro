import { describe, expect, it } from 'vitest';
import { DEFAULT_POINTER_INPUT_QUEUE_CAPACITY_V1 } from '../../src/input/input-queue.js';
import {
  createPointerInputTransportV1,
  decodePointerSamplesV1,
  DEFAULT_POINTER_SHARED_RING_CAPACITY_V1,
  encodePointerSamplesV1,
  POINTER_INPUT_RECORD_STRIDE_V1,
} from '../../src/input/input-transport.js';
import { installRenderInputIngressV1 } from '../../src/workers/input-ingress-extension.js';
import type {
  PointerInputBatchV1,
  PointerInputEventTypeV1,
  PointerInputSampleV1,
} from '../../src/input/pointer-input.js';

function sample(
  sequence: number,
  eventType: PointerInputEventTypeV1 = 'pointermove',
): PointerInputSampleV1 {
  return Object.freeze({
    schema: 'illustro.pointer-sample/1' as const,
    sequence,
    pointerId: 9,
    source: 'pen' as const,
    eventType,
    origin: 'direct' as const,
    isPrimary: true,
    timestampMs: 100 + sequence,
    clientX: 10 + sequence,
    clientY: 20 + sequence,
    surfaceX: 5 + sequence,
    surfaceY: 6 + sequence,
    pressure: 0.75,
    tangentialPressure: -0.1,
    tiltX: 12,
    tiltY: -18,
    twist: 240,
    altitudeAngle: 0.8,
    azimuthAngle: 1.2,
    contactWidth: 3,
    contactHeight: 4,
    buttons: eventType === 'pointerup' ? 0 : 1,
    button: eventType === 'pointerdown' ? 0 : -1,
  });
}

function batch(samples: readonly PointerInputSampleV1[]): PointerInputBatchV1 {
  return Object.freeze({
    schema: 'illustro.pointer-batch/1' as const,
    eventType: samples.at(-1)?.eventType ?? 'pointermove',
    pointerId: 9,
    confirmed: Object.freeze([...samples]),
    predicted: Object.freeze([]),
  });
}

class FakeTarget {
  readonly messages: { readonly message: unknown; readonly transfer: readonly Transferable[] }[] =
    [];

  postMessage(message: unknown, transfer: Transferable[] = []): void {
    this.messages.push({ message, transfer: Object.freeze([...transfer]) });
  }
}

class FakeScope {
  readonly messages: unknown[] = [];

  postMessage(message: unknown): void {
    this.messages.push(message);
  }
}

function record(value: unknown): Readonly<Record<string, unknown>> {
  if (typeof value !== 'object' || value === null) throw new TypeError('expected record');
  return value as Readonly<Record<string, unknown>>;
}

describe('M3 pointer input transport codec', () => {
  it('round-trips complete pointer samples through the fixed-stride binary format', () => {
    const original = [sample(1, 'pointerdown'), sample(2), sample(3, 'pointerup')];
    const decoded = decodePointerSamplesV1(encodePointerSamplesV1(original), original.length);
    expect(decoded).toEqual(original);
  });

  it('uses the frozen 4096-sample P4-7 logical bound for queue and SAB ring defaults', () => {
    expect(DEFAULT_POINTER_INPUT_QUEUE_CAPACITY_V1).toBe(4_096);
    expect(DEFAULT_POINTER_SHARED_RING_CAPACITY_V1).toBe(4_096);
  });
});

describe('M3 Transferable fallback transport', () => {
  it('moves bounded confirmed samples through an ArrayBuffer transfer list', () => {
    const target = new FakeTarget();
    const transport = createPointerInputTransportV1(target, {
      sharedMemoryFastPath: false,
      queueCapacity: 8,
    });
    transport.enqueueBatch(batch([sample(1, 'pointerdown'), sample(2)]));
    expect(transport.snapshot().mode).toBe('transferable');
    expect(target.messages).toHaveLength(1);

    const posted = target.messages[0];
    const message = record(posted?.message);
    expect(message.type).toBe('renderer.input.transfer');
    expect(message.stride).toBe(POINTER_INPUT_RECORD_STRIDE_V1);
    expect(message.count).toBe(2);
    expect(message.buffer).toBeInstanceOf(ArrayBuffer);
    expect(posted?.transfer).toEqual([message.buffer]);
    const decoded = decodePointerSamplesV1(message.buffer as ArrayBuffer, 2);
    expect(decoded.map((entry) => entry.sequence)).toEqual([1, 2]);
  });

  it('caps an oversized fallback batch at the same 4096-sample logical bound', () => {
    const target = new FakeTarget();
    const transport = createPointerInputTransportV1(target, { sharedMemoryFastPath: false });
    const oversized = Array.from({ length: 4_500 }, (_, index) => sample(index));
    transport.enqueueBatch(batch(oversized));
    const message = record(target.messages[0]?.message);
    expect(message.type).toBe('renderer.input.transfer');
    expect(message.count).toBe(4_096);
    const decoded = decodePointerSamplesV1(message.buffer as ArrayBuffer, 4_096);
    expect(decoded.at(-1)?.sequence).toBe(4_499);
  });

  it('is the functional mode whenever the shared-memory fast path is disabled', () => {
    const target = new FakeTarget();
    const transport = createPointerInputTransportV1(target, { sharedMemoryFastPath: false });
    expect(transport.snapshot().mode).toBe('transferable');
    expect(transport.snapshot().queue.capacity).toBe(4_096);
  });
});

describe('M3 render worker input ingress', () => {
  it('accepts transferred ArrayBuffer messages into a bounded worker-side queue', () => {
    const scope = new FakeScope();
    const ingress = installRenderInputIngressV1(scope, 4);
    const samples = [sample(1), sample(2)];
    expect(
      ingress.handle({
        type: 'renderer.input.transfer',
        schema: 'illustro.pointer-transfer/1',
        stride: POINTER_INPUT_RECORD_STRIDE_V1,
        count: samples.length,
        buffer: encodePointerSamplesV1(samples),
      }),
    ).toBe(true);
    expect(ingress.snapshot().mode).toBe('transferable');
    expect(ingress.drain().map((entry) => entry.sequence)).toEqual([1, 2]);
  });

  it('uses the same 4096-sample logical bound by default', () => {
    const ingress = installRenderInputIngressV1(new FakeScope());
    expect(ingress.snapshot().queue.capacity).toBe(4_096);
  });

  it('uses SharedArrayBuffer + Atomics when available and preserves transferable fallback separately', () => {
    if (typeof SharedArrayBuffer === 'undefined' || typeof Atomics === 'undefined') return;
    const target = new FakeTarget();
    const transport = createPointerInputTransportV1(target, {
      sharedMemoryFastPath: true,
      queueCapacity: 8,
      sharedRingCapacity: 8,
    });
    expect(transport.snapshot().mode).toBe('shared-memory');
    expect(target.messages).toHaveLength(1);

    const scope = new FakeScope();
    const ingress = installRenderInputIngressV1(scope, 8);
    expect(ingress.handle(target.messages[0]?.message)).toBe(true);

    transport.enqueueBatch(batch([sample(10, 'pointerdown'), sample(11), sample(12, 'pointerup')]));
    expect(target.messages).toHaveLength(2);
    expect(ingress.handle(target.messages[1]?.message)).toBe(true);
    expect(ingress.snapshot().mode).toBe('shared-memory');
    expect(ingress.drain().map((entry) => entry.sequence)).toEqual([10, 11, 12]);
    expect(transport.snapshot().sharedPendingSamples).toBe(0);
  });
});
