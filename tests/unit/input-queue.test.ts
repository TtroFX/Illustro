import { describe, expect, it } from 'vitest';
import {
  BoundedPointerInputQueueV1,
  DEFAULT_POINTER_INPUT_QUEUE_CAPACITY_V1,
} from '../../src/input/input-queue.js';
import type {
  PointerInputBatchV1,
  PointerInputEventTypeV1,
  PointerInputSampleV1,
} from '../../src/input/pointer-input.js';

function sample(
  sequence: number,
  eventType: PointerInputEventTypeV1,
  pointerId = 1,
  overrides: Partial<PointerInputSampleV1> = {},
): PointerInputSampleV1 {
  return Object.freeze({
    schema: 'illustro.pointer-sample/1' as const,
    sequence,
    pointerId,
    source: 'pen' as const,
    eventType,
    origin: 'direct' as const,
    isPrimary: true,
    timestampMs: sequence,
    clientX: sequence,
    clientY: sequence,
    surfaceX: sequence,
    surfaceY: sequence,
    pressure: 0.5,
    tangentialPressure: 0,
    tiltX: 0,
    tiltY: 0,
    twist: 0,
    altitudeAngle: null,
    azimuthAngle: null,
    contactWidth: 1,
    contactHeight: 1,
    buttons: eventType === 'pointerup' ? 0 : 1,
    button: eventType === 'pointerdown' ? 0 : -1,
    ...overrides,
  });
}

function batch(samples: readonly PointerInputSampleV1[]): PointerInputBatchV1 {
  return Object.freeze({
    schema: 'illustro.pointer-batch/1' as const,
    eventType: samples.at(-1)?.eventType ?? 'pointermove',
    pointerId: samples.at(-1)?.pointerId ?? 1,
    confirmed: Object.freeze([...samples]),
    predicted: Object.freeze([]),
  });
}

describe('M3 bounded pointer input queue', () => {
  it('uses the frozen P4-7 logical pointer bound by default', () => {
    const queue = new BoundedPointerInputQueueV1();
    expect(DEFAULT_POINTER_INPUT_QUEUE_CAPACITY_V1).toBe(4_096);
    expect(queue.snapshot().capacity).toBe(4_096);
  });

  it('stays bounded and coalesces newest high-frequency updates for the same pointer', () => {
    const queue = new BoundedPointerInputQueueV1(4);
    queue.enqueue(sample(0, 'pointerdown'));
    for (let sequence = 1; sequence <= 20; sequence += 1) {
      queue.enqueue(sample(sequence, 'pointermove'));
    }
    expect(queue.snapshot().size).toBe(4);
    expect(queue.snapshot().coalesced).toBeGreaterThan(0);
    expect(queue.drain().at(-1)?.sequence).toBe(20);
  });

  it('evicts expendable move samples before stroke boundary events under backpressure', () => {
    const queue = new BoundedPointerInputQueueV1(4);
    queue.enqueueBatch(
      batch([
        sample(0, 'pointerdown'),
        sample(1, 'pointermove'),
        sample(2, 'pointermove'),
        sample(3, 'pointermove'),
        sample(4, 'pointerup'),
      ]),
    );
    const drained = queue.drain();
    expect(drained).toHaveLength(4);
    expect(drained[0]?.eventType).toBe('pointerdown');
    expect(drained.at(-1)?.eventType).toBe('pointerup');
    expect(queue.snapshot().dropped).toBe(1);
  });

  it('preserves pressure extrema when a less important motion sample can be reduced', () => {
    const queue = new BoundedPointerInputQueueV1(5);
    queue.enqueue(sample(0, 'pointerdown'));
    queue.enqueue(sample(1, 'pointermove', 1, { pressure: 0.2 }));
    queue.enqueue(sample(2, 'pointermove', 1, { pressure: 1 }));
    queue.enqueue(sample(3, 'pointermove', 1, { pressure: 0.4 }));
    queue.enqueue(sample(4, 'pointermove', 1, { pressure: 0.45 }));
    queue.enqueue(sample(5, 'pointermove', 1, { pressure: 0.5 }));

    const drained = queue.drain();
    expect(drained).toHaveLength(5);
    expect(drained.some((entry) => entry.sequence === 2 && entry.pressure === 1)).toBe(true);
    expect(drained.at(-1)?.sequence).toBe(5);
  });

  it('never silently discards a boundary event when no motion sample is available', () => {
    const queue = new BoundedPointerInputQueueV1(2);
    queue.enqueue(sample(0, 'pointerdown', 1));
    queue.enqueue(sample(1, 'pointerdown', 2));
    expect(() => queue.enqueue(sample(2, 'pointercancel', 1))).toThrow(/non-droppable/);
    expect(queue.drain().map((entry) => entry.sequence)).toEqual([0, 1]);
  });

  it('bounds multi-pointer bursts without unbounded growth', () => {
    const queue = new BoundedPointerInputQueueV1(8);
    for (let sequence = 0; sequence < 100; sequence += 1) {
      queue.enqueue(sample(sequence, 'pointerrawupdate', (sequence % 3) + 1));
    }
    expect(queue.snapshot().size).toBeLessThanOrEqual(8);
    expect(queue.snapshot().enqueued).toBe(100);
    expect(queue.snapshot().coalesced + queue.snapshot().dropped).toBeGreaterThan(0);
  });
});
