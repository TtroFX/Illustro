import { describe, expect, it } from 'vitest';
import {
  RealtimePaintPresenterV1,
  type RealtimePaintPresentationV1,
} from '../../src/app/realtime-paint-presenter.js';

interface DabV1 {
  readonly id: number;
}

type PresentationV1 = RealtimePaintPresentationV1<DabV1, 'source-over' | 'erase'>;

function deferredV1(): {
  readonly promise: Promise<void>;
  readonly resolve: () => void;
  readonly reject: (reason: unknown) => void;
} {
  let resolve!: () => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function presentationV1(
  id: number,
  options: {
    readonly strokeId?: string;
    readonly layerId?: string;
    readonly operation?: 'source-over' | 'erase';
  } = {},
): PresentationV1 {
  return Object.freeze({
    strokeId: options.strokeId ?? 'stroke-a',
    layerId: options.layerId ?? 'layer-a',
    operation: options.operation ?? 'source-over',
    dabs: Object.freeze([{ id }]),
  });
}

describe('RealtimePaintPresenterV1', () => {
  it('keeps one submission in flight and coalesces high-frequency input into one pending segment', async () => {
    const first = deferredV1();
    const second = deferredV1();
    const submitted: PresentationV1[] = [];
    const presenter = new RealtimePaintPresenterV1<DabV1, PresentationV1['operation']>({
      submit: async (presentation) => {
        submitted.push(presentation);
        if (submitted.length === 1) await first.promise;
        else await second.promise;
      },
    });

    presenter.enqueue(presentationV1(0));
    await Promise.resolve();
    for (let id = 1; id <= 100; id += 1) presenter.enqueue(presentationV1(id));

    expect(submitted).toHaveLength(1);
    expect(submitted[0]?.dabs.map((dab) => dab.id)).toEqual([0]);
    expect(presenter.snapshot()).toMatchObject({
      inFlight: true,
      pendingSegmentCount: 1,
      pendingDabCount: 100,
      acceptedBatchCount: 101,
      submittedBatchCount: 1,
      coalescedBatchCount: 99,
    });

    first.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(submitted).toHaveLength(2);
    expect(submitted[1]?.dabs.map((dab) => dab.id)).toEqual(
      Array.from({ length: 100 }, (_, index) => index + 1),
    );

    second.resolve();
    await presenter.flush();
    expect(presenter.snapshot()).toMatchObject({
      inFlight: false,
      pendingSegmentCount: 0,
      pendingDabCount: 0,
      submittedBatchCount: 2,
    });
  });

  it('preserves ordering across stroke/layer/operation boundaries without merging them', async () => {
    const submitted: PresentationV1[] = [];
    const presenter = new RealtimePaintPresenterV1<DabV1, PresentationV1['operation']>({
      submit: async (presentation) => {
        submitted.push(presentation);
      },
    });

    presenter.enqueue(presentationV1(1));
    presenter.enqueue(presentationV1(2, { operation: 'erase' }));
    presenter.enqueue(presentationV1(3, { strokeId: 'stroke-b' }));
    presenter.enqueue(presentationV1(4, { strokeId: 'stroke-b' }));
    await presenter.flush();

    expect(submitted.map((batch) => batch.dabs.map((dab) => dab.id))).toEqual([[1], [2], [3, 4]]);
    expect(presenter.snapshot().coalescedBatchCount).toBe(1);
  });

  it('uses flush as an ordering barrier through the final pending submission', async () => {
    const first = deferredV1();
    const second = deferredV1();
    let submissions = 0;
    const presenter = new RealtimePaintPresenterV1<DabV1, PresentationV1['operation']>({
      submit: async () => {
        submissions += 1;
        if (submissions === 1) await first.promise;
        else await second.promise;
      },
    });

    presenter.enqueue(presentationV1(1));
    await Promise.resolve();
    presenter.enqueue(presentationV1(2));

    let flushed = false;
    const flushPromise = presenter.flush().then(() => {
      flushed = true;
    });
    await Promise.resolve();
    expect(flushed).toBe(false);

    first.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(submissions).toBe(2);
    expect(flushed).toBe(false);

    second.resolve();
    await flushPromise;
    expect(flushed).toBe(true);
  });

  it('bounds pending stream segments instead of allowing an unbounded request queue', async () => {
    const first = deferredV1();
    const presenter = new RealtimePaintPresenterV1<DabV1, PresentationV1['operation']>({
      maximumPendingSegments: 2,
      submit: async () => {
        await first.promise;
      },
    });

    presenter.enqueue(presentationV1(1));
    await Promise.resolve();
    presenter.enqueue(presentationV1(2, { strokeId: 'stroke-b' }));
    presenter.enqueue(presentationV1(3, { strokeId: 'stroke-c' }));

    expect(() => presenter.enqueue(presentationV1(4, { strokeId: 'stroke-d' }))).toThrow(
      /backpressure/i,
    );
    first.resolve();
    await presenter.flush();
  });

  it('surfaces renderer failure through the barrier and rejects further input', async () => {
    const presenter = new RealtimePaintPresenterV1<DabV1, PresentationV1['operation']>({
      submit: async () => {
        throw new Error('renderer failed');
      },
    });

    presenter.enqueue(presentationV1(1));
    await expect(presenter.flush()).rejects.toThrow('renderer failed');
    expect(presenter.snapshot().failed).toBe(true);
    expect(() => presenter.enqueue(presentationV1(2))).toThrow('renderer failed');
  });
});
