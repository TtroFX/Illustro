export const RENDER_COMMAND_QUEUE_SOFT_BOUND = 1_024 as const;

export type RenderPriorityV1 = 'P0' | 'P1' | 'P2' | 'P3';

export interface RenderTaskDescriptorV1<Payload = unknown> {
  readonly id: string;
  readonly priority: RenderPriorityV1;
  readonly kind: string;
  readonly payload: Payload;
}

interface QueuedRenderTaskV1<Payload> extends RenderTaskDescriptorV1<Payload> {
  readonly sequence: number;
}

export interface RenderScheduleEnqueueResultV1 {
  readonly accepted: boolean;
  readonly displacedTaskId: string | null;
}

export interface RenderSchedulerSnapshotV1 {
  readonly schema: 'illustro.render-scheduler/1';
  readonly bound: number;
  readonly size: number;
  readonly byPriority: Readonly<Record<RenderPriorityV1, number>>;
}

const PRIORITY_RANK: Readonly<Record<RenderPriorityV1, number>> = Object.freeze({
  P0: 0,
  P1: 1,
  P2: 2,
  P3: 3,
});

export class RenderSchedulerV1<Payload = unknown> {
  readonly #bound: number;
  readonly #tasks = new Map<string, QueuedRenderTaskV1<Payload>>();
  #sequence = 0;

  constructor(bound: number = RENDER_COMMAND_QUEUE_SOFT_BOUND) {
    if (!Number.isSafeInteger(bound) || bound < 1) {
      throw new RangeError('render scheduler bound must be a positive safe integer');
    }
    this.#bound = bound;
  }

  snapshot(): RenderSchedulerSnapshotV1 {
    const counts: Record<RenderPriorityV1, number> = { P0: 0, P1: 0, P2: 0, P3: 0 };
    for (const task of this.#tasks.values()) counts[task.priority] += 1;
    return Object.freeze({
      schema: 'illustro.render-scheduler/1',
      bound: this.#bound,
      size: this.#tasks.size,
      byPriority: Object.freeze(counts),
    });
  }

  enqueue(task: RenderTaskDescriptorV1<Payload>): RenderScheduleEnqueueResultV1 {
    if (task.id.length === 0) throw new TypeError('render task id must not be empty');
    if (task.kind.length === 0) throw new TypeError('render task kind must not be empty');
    if (this.#tasks.has(task.id)) throw new Error(`render task id already exists: ${task.id}`);

    let displacedTaskId: string | null = null;
    if (this.#tasks.size >= this.#bound) {
      const candidate = this.#displacementCandidate();
      if (candidate === null || PRIORITY_RANK[task.priority] >= PRIORITY_RANK[candidate.priority]) {
        return Object.freeze({ accepted: false, displacedTaskId: null });
      }
      this.#tasks.delete(candidate.id);
      displacedTaskId = candidate.id;
    }

    this.#tasks.set(
      task.id,
      Object.freeze({
        ...task,
        sequence: ++this.#sequence,
      }),
    );
    return Object.freeze({ accepted: true, displacedTaskId });
  }

  dequeue(): RenderTaskDescriptorV1<Payload> | null {
    const next = this.#ordered()[0];
    if (next === undefined) return null;
    this.#tasks.delete(next.id);
    return Object.freeze({
      id: next.id,
      priority: next.priority,
      kind: next.kind,
      payload: next.payload,
    });
  }

  drain(maxTasks: number): readonly RenderTaskDescriptorV1<Payload>[] {
    if (!Number.isSafeInteger(maxTasks) || maxTasks < 0) {
      throw new RangeError('maxTasks must be a non-negative safe integer');
    }
    const drained: RenderTaskDescriptorV1<Payload>[] = [];
    while (drained.length < maxTasks) {
      const task = this.dequeue();
      if (task === null) break;
      drained.push(task);
    }
    return Object.freeze(drained);
  }

  clear(): void {
    this.#tasks.clear();
  }

  #ordered(): readonly QueuedRenderTaskV1<Payload>[] {
    return [...this.#tasks.values()].sort((left, right) => {
      const priority = PRIORITY_RANK[left.priority] - PRIORITY_RANK[right.priority];
      return priority !== 0 ? priority : left.sequence - right.sequence;
    });
  }

  #displacementCandidate(): QueuedRenderTaskV1<Payload> | null {
    const candidates = [...this.#tasks.values()].sort((left, right) => {
      const priority = PRIORITY_RANK[right.priority] - PRIORITY_RANK[left.priority];
      return priority !== 0 ? priority : left.sequence - right.sequence;
    });
    return candidates[0] ?? null;
  }
}
