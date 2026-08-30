import { describe, expect, it } from 'vitest';
import {
  ProjectPersistenceSchedulerV1,
  type PersistenceFlushReasonV1,
  type PersistenceSchedulerClockV1,
  type PersistenceSchedulerPolicyV1,
} from '../../src/storage/persistence-scheduler.js';

class ManualClock implements PersistenceSchedulerClockV1 {
  #now = 0;
  #nextToken = 1;
  readonly #timers = new Map<number, { deadline: number; callback: () => void }>();

  now(): number {
    return this.#now;
  }

  setTimeout(callback: () => void, delayMs: number): number {
    const token = this.#nextToken;
    this.#nextToken += 1;
    this.#timers.set(token, { deadline: this.#now + delayMs, callback });
    return token;
  }

  clearTimeout(token: number): void {
    this.#timers.delete(token);
  }

  advance(ms: number): void {
    this.#now += ms;
    for (;;) {
      const due = [...this.#timers.entries()]
        .filter(([, timer]) => timer.deadline <= this.#now)
        .sort((left, right) => left[1].deadline - right[1].deadline)[0];
      if (due === undefined) return;
      this.#timers.delete(due[0]);
      due[1].callback();
    }
  }
}

const POLICY: PersistenceSchedulerPolicyV1 = Object.freeze({
  recoveryQuietMs: 100,
  recoveryMaxMs: 300,
  autosaveIntervalMs: 1_000,
  retryDelayMs: 200,
});

async function settle(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe('ProjectPersistenceSchedulerV1', () => {
  it('coalesces recovery flushes and reuses durable recovery data at autosave deadline', async () => {
    const clock = new ManualClock();
    const persisted: Array<{ reason: PersistenceFlushReasonV1; payload: string }> = [];
    const autosaved: string[] = [];
    const scheduler = new ProjectPersistenceSchedulerV1<string, string>({
      clock,
      policy: POLICY,
      async persist(reason, payload) {
        persisted.push({ reason, payload });
        return `durable:${payload}`;
      },
      onAutosaveSettled(payload) {
        autosaved.push(payload);
      },
    });

    expect(scheduler.markDirty('first')).toBe(1);
    clock.advance(50);
    expect(scheduler.markDirty('latest')).toBe(2);
    clock.advance(99);
    await settle();
    expect(persisted).toEqual([]);

    clock.advance(1);
    await settle();
    expect(persisted).toEqual([{ reason: 'recovery', payload: 'latest' }]);
    expect(scheduler.state().durableGeneration).toBe(2);
    expect(scheduler.state().autosavedGeneration).toBe(0);

    clock.advance(850);
    await settle();
    expect(persisted).toHaveLength(1);
    expect(autosaved).toEqual(['latest']);
    expect(scheduler.state().autosavedGeneration).toBe(2);
    expect(scheduler.state().firstDirtyAt).toBeNull();
  });

  it('enforces the recovery maximum deadline under continuous edits', async () => {
    const clock = new ManualClock();
    const persisted: string[] = [];
    const scheduler = new ProjectPersistenceSchedulerV1<string, string>({
      clock,
      policy: POLICY,
      async persist(_reason, payload) {
        persisted.push(payload);
        return payload;
      },
    });

    scheduler.markDirty('0');
    clock.advance(80);
    scheduler.markDirty('80');
    clock.advance(80);
    scheduler.markDirty('160');
    clock.advance(80);
    scheduler.markDirty('240');
    clock.advance(59);
    await settle();
    expect(persisted).toEqual([]);

    clock.advance(1);
    await settle();
    expect(persisted).toEqual(['240']);
    expect(scheduler.state().durableGeneration).toBe(4);
  });

  it('supports explicit autosave flush and records it as both durable and autosaved', async () => {
    const clock = new ManualClock();
    const reasons: PersistenceFlushReasonV1[] = [];
    const autosaved: string[] = [];
    const scheduler = new ProjectPersistenceSchedulerV1<string, string>({
      clock,
      policy: POLICY,
      async persist(reason, payload) {
        reasons.push(reason);
        return payload;
      },
      onAutosaveSettled(payload) {
        autosaved.push(payload);
      },
    });

    scheduler.markDirty('manual');
    await scheduler.flushNow('autosave');
    expect(reasons).toEqual(['autosave']);
    expect(autosaved).toEqual(['manual']);
    expect(scheduler.state()).toMatchObject({
      dirtyGeneration: 1,
      durableGeneration: 1,
      autosavedGeneration: 1,
      firstDirtyAt: null,
    });
  });
});
