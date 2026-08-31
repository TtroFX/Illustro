import { describe, expect, it } from 'vitest';
import { installPointerInputControllerV1 } from '../../src/app/pointer-input-controller.js';
import type { PointerEventLikeV1 } from '../../src/input/pointer-input.js';

class FakePointerTarget {
  readonly listeners = new Map<string, Set<EventListener>>();
  readonly captured: number[] = [];
  readonly released: number[] = [];

  addEventListener(type: string, listener: EventListener): void {
    const set = this.listeners.get(type) ?? new Set<EventListener>();
    set.add(listener);
    this.listeners.set(type, set);
  }

  removeEventListener(type: string, listener: EventListener): void {
    this.listeners.get(type)?.delete(listener);
  }

  getBoundingClientRect(): { readonly left: number; readonly top: number } {
    return { left: 10, top: 20 };
  }

  setPointerCapture(pointerId: number): void {
    this.captured.push(pointerId);
  }

  releasePointerCapture(pointerId: number): void {
    this.released.push(pointerId);
  }

  emit(event: PointerEventLikeV1): void {
    for (const listener of this.listeners.get(event.type) ?? []) {
      listener(event as unknown as Event);
    }
  }
}

function event(type: string, overrides: Partial<PointerEventLikeV1> = {}): PointerEventLikeV1 {
  return {
    type,
    pointerId: 1,
    pointerType: 'pen',
    isPrimary: true,
    clientX: 50,
    clientY: 70,
    pressure: 0.5,
    tiltX: 0,
    tiltY: 0,
    width: 1,
    height: 1,
    buttons: type === 'pointerup' ? 0 : 1,
    button: type === 'pointerdown' ? 0 : -1,
    timeStamp: 1,
    ...overrides,
  };
}

describe('M3 production canvas pointer controller', () => {
  it('subscribes to Pointer Events including pointerrawupdate and maintains confirmed state', () => {
    const target = new FakePointerTarget();
    const batches: string[] = [];
    const controller = installPointerInputControllerV1(target, (batch) =>
      batches.push(batch.eventType),
    );

    expect([...target.listeners.keys()]).toEqual([
      'pointerdown',
      'pointermove',
      'pointerup',
      'pointercancel',
      'pointerrawupdate',
    ]);
    target.emit(event('pointerdown'));
    target.emit(event('pointerrawupdate', { clientX: 60, pressure: 0.8 }));
    expect(batches).toEqual(['pointerdown', 'pointerrawupdate']);
    expect(target.captured).toEqual([1]);
    expect(controller.snapshot()).toMatchObject({
      schema: 'illustro.pointer-input-state/1',
      batchCount: 2,
      confirmedSampleCount: 2,
      latestConfirmed: { surfaceX: 50, pressure: 0.8, eventType: 'pointerrawupdate' },
    });
  });

  it('keeps predicted samples presentation-only and clears them on pointerup', () => {
    const target = new FakePointerTarget();
    const controller = installPointerInputControllerV1(target);
    target.emit(
      event('pointermove', {
        getPredictedEvents: () => [event('pointermove', { clientX: 80, timeStamp: 2 })],
      }),
    );
    expect(controller.snapshot().predictedPresentation).toHaveLength(1);
    expect(controller.snapshot().confirmedSampleCount).toBe(1);

    target.emit(event('pointerup'));
    expect(controller.snapshot().predictedPresentation).toHaveLength(0);
    expect(target.released).toEqual([1]);
  });

  it('removes every listener on dispose', () => {
    const target = new FakePointerTarget();
    const controller = installPointerInputControllerV1(target);
    controller.dispose();
    expect([...target.listeners.values()].every((listeners) => listeners.size === 0)).toBe(true);
  });
});
