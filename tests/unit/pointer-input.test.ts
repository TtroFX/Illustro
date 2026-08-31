import { describe, expect, it } from 'vitest';
import {
  normalizePointerSampleV1,
  PointerBatchBuilderV1,
  type PointerEventLikeV1,
} from '../../src/input/pointer-input.js';

function event(overrides: Partial<PointerEventLikeV1> = {}): PointerEventLikeV1 {
  return {
    type: 'pointermove',
    pointerId: 7,
    pointerType: 'pen',
    isPrimary: true,
    clientX: 120.5,
    clientY: 220.25,
    pressure: 0.75,
    tangentialPressure: -0.2,
    tiltX: 20,
    tiltY: -30,
    twist: 270,
    altitudeAngle: 0.8,
    azimuthAngle: 1.4,
    width: 4,
    height: 5,
    buttons: 1,
    button: -1,
    timeStamp: 123.4,
    ...overrides,
  };
}

describe('M3 pointer sample normalization', () => {
  it('ingests pressure, tilt and orientation without dropping pointer identity or timestamp', () => {
    const sample = normalizePointerSampleV1(event(), { left: 20, top: 100 }, 'direct', 4);
    expect(sample).toMatchObject({
      schema: 'illustro.pointer-sample/1',
      sequence: 4,
      pointerId: 7,
      source: 'pen',
      eventType: 'pointermove',
      surfaceX: 100.5,
      surfaceY: 120.25,
      pressure: 0.75,
      tangentialPressure: -0.2,
      tiltX: 20,
      tiltY: -30,
      twist: 270,
      altitudeAngle: 0.8,
      azimuthAngle: 1.4,
      timestampMs: 123.4,
    });
  });

  it('clamps malformed analog ranges and preserves unavailable orientation as null', () => {
    const sample = normalizePointerSampleV1(
      event({
        pressure: 2,
        tangentialPressure: -3,
        tiltX: 120,
        tiltY: -120,
        twist: 500,
        altitudeAngle: undefined,
      }),
      { left: 0, top: 0 },
      'direct',
      0,
    );
    expect(sample).toMatchObject({
      pressure: 1,
      tangentialPressure: -1,
      tiltX: 90,
      tiltY: -90,
      twist: 359,
      altitudeAngle: null,
    });
  });
});

describe('M3 coalesced/raw/predicted pointer batches', () => {
  it('uses coalesced events as the confirmed ordered stream and keeps prediction separate', () => {
    const builder = new PointerBatchBuilderV1();
    const first = event({ clientX: 10, timeStamp: 1 });
    const second = event({ clientX: 20, timeStamp: 2 });
    const predicted = event({ clientX: 30, timeStamp: 3 });
    const batch = builder.build(
      event({
        getCoalescedEvents: () => [first, second],
        getPredictedEvents: () => [predicted],
      }),
      { left: 0, top: 0 },
    );
    expect(batch.confirmed.map((sample) => [sample.surfaceX, sample.origin])).toEqual([
      [10, 'coalesced'],
      [20, 'coalesced'],
    ]);
    expect(batch.predicted.map((sample) => [sample.surfaceX, sample.origin])).toEqual([
      [30, 'predicted'],
    ]);
    expect(batch.confirmed.map((sample) => sample.sequence)).toEqual([0, 1]);
    expect(batch.predicted[0]?.sequence).toBe(2);
  });

  it('ingests pointerrawupdate as a confirmed event and allows predicted presentation samples', () => {
    const builder = new PointerBatchBuilderV1();
    const batch = builder.build(
      event({
        type: 'pointerrawupdate',
        getPredictedEvents: () => [event({ clientX: 140 })],
      }),
      { left: 100, top: 0 },
    );
    expect(batch.eventType).toBe('pointerrawupdate');
    expect(batch.confirmed[0]).toMatchObject({ eventType: 'pointerrawupdate', origin: 'direct' });
    expect(batch.predicted[0]).toMatchObject({
      eventType: 'pointerrawupdate',
      origin: 'predicted',
      surfaceX: 40,
    });
  });

  it('never treats predicted samples as confirmed on pointerup', () => {
    const builder = new PointerBatchBuilderV1();
    const batch = builder.build(
      event({ type: 'pointerup', getPredictedEvents: () => [event({ clientX: 999 })] }),
      { left: 0, top: 0 },
    );
    expect(batch.confirmed).toHaveLength(1);
    expect(batch.predicted).toHaveLength(0);
  });
});
