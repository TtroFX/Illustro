import { describe, expect, it } from 'vitest';
import { RenderSchedulerV1 } from '../../src/gpu/render-scheduler.js';

describe('M3 render scheduling and priority foundation', () => {
  it('dequeues P0 before P1/P2/P3 while preserving FIFO inside a priority', () => {
    const scheduler = new RenderSchedulerV1<string>();
    scheduler.enqueue({ id: 'p3-a', priority: 'P3', kind: 'background', payload: 'p3-a' });
    scheduler.enqueue({ id: 'p1-a', priority: 'P1', kind: 'visible', payload: 'p1-a' });
    scheduler.enqueue({ id: 'p0-a', priority: 'P0', kind: 'stroke', payload: 'p0-a' });
    scheduler.enqueue({ id: 'p1-b', priority: 'P1', kind: 'visible', payload: 'p1-b' });
    scheduler.enqueue({ id: 'p2-a', priority: 'P2', kind: 'near', payload: 'p2-a' });
    expect(scheduler.drain(5).map((task) => task.id)).toEqual([
      'p0-a',
      'p1-a',
      'p1-b',
      'p2-a',
      'p3-a',
    ]);
  });

  it('lets interaction-critical work pre-empt queued lower-priority work at the bound', () => {
    const scheduler = new RenderSchedulerV1<string>(3);
    scheduler.enqueue({ id: 'visible', priority: 'P1', kind: 'visible', payload: 'v' });
    scheduler.enqueue({ id: 'near', priority: 'P2', kind: 'near', payload: 'n' });
    scheduler.enqueue({ id: 'background', priority: 'P3', kind: 'background', payload: 'b' });
    const result = scheduler.enqueue({ id: 'stroke', priority: 'P0', kind: 'stroke', payload: 's' });
    expect(result).toEqual({ accepted: true, displacedTaskId: 'background' });
    expect(scheduler.drain(3).map((task) => task.id)).toEqual(['stroke', 'visible', 'near']);
  });

  it('does not evict equal or higher priority work merely to admit more low-priority backlog', () => {
    const scheduler = new RenderSchedulerV1<string>(2);
    scheduler.enqueue({ id: 'a', priority: 'P0', kind: 'critical', payload: 'a' });
    scheduler.enqueue({ id: 'b', priority: 'P1', kind: 'visible', payload: 'b' });
    expect(
      scheduler.enqueue({ id: 'c', priority: 'P1', kind: 'visible', payload: 'c' }),
    ).toEqual({ accepted: false, displacedTaskId: null });
    expect(scheduler.snapshot()).toMatchObject({ size: 2, byPriority: { P0: 1, P1: 1 } });
  });
});
