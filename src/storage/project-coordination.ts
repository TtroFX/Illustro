import { isUuid, parseProjectId, type ProjectId } from '../domain/identity.js';
import { toJsonValue, type JsonValue } from '../domain/serialization.js';

export const PROJECT_COORDINATION_CHANNEL = 'illustro.project-coordination.v1' as const;

export type ProjectAccessModeV1 = 'read-write' | 'read-only';
export type ProjectAccessReasonV1 = 'acquired' | 'locked-elsewhere' | 'locks-unavailable';

export interface ProjectAccessStateV1 {
  readonly projectId: ProjectId;
  readonly mode: ProjectAccessModeV1;
  readonly reason: ProjectAccessReasonV1;
}

export const PROJECT_COORDINATION_EVENT_KINDS = [
  'project.opened',
  'project.closed',
  'project.read-only',
  'project.created',
  'project.duplicated',
  'project.renamed',
  'project.preview-updated',
  'project.trashed',
  'project.restored',
  'project.changed',
  'project.save-status',
] as const;

export type ProjectCoordinationEventKindV1 = (typeof PROJECT_COORDINATION_EVENT_KINDS)[number];

export interface ProjectCoordinationEventV1 {
  readonly schema: 'illustro.project-coordination-event/1';
  readonly eventId: string;
  readonly sourceId: string;
  readonly projectId: ProjectId;
  readonly kind: ProjectCoordinationEventKindV1;
  readonly occurredAt: string;
  readonly detail: JsonValue;
}

export interface LockTokenLikeV1 {
  readonly name: string;
  readonly mode: 'exclusive';
}

export interface LockManagerLikeV1 {
  request<Result>(
    name: string,
    options: { readonly mode: 'exclusive'; readonly ifAvailable: true },
    callback: (lock: LockTokenLikeV1 | null) => Result | PromiseLike<Result>,
  ): Promise<Result>;
}

export interface BroadcastChannelLikeV1 {
  postMessage(message: unknown): void;
  addEventListener(type: 'message', listener: (event: MessageEvent<unknown>) => void): void;
  removeEventListener(type: 'message', listener: (event: MessageEvent<unknown>) => void): void;
  close(): void;
}

export type BroadcastChannelFactoryV1 = (name: string) => BroadcastChannelLikeV1 | null;

interface HeldProjectLockV1 {
  readonly release: () => void;
  readonly task: Promise<unknown>;
}

function browserLockManager(): LockManagerLikeV1 | null {
  if (typeof navigator === 'undefined') return null;
  const locks = (navigator as Navigator & { readonly locks?: LockManagerLikeV1 }).locks;
  return locks ?? null;
}

function browserBroadcastChannelFactory(name: string): BroadcastChannelLikeV1 | null {
  if (typeof BroadcastChannel !== 'function') return null;
  return new BroadcastChannel(name);
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isEventKind(value: unknown): value is ProjectCoordinationEventKindV1 {
  return (
    typeof value === 'string' &&
    PROJECT_COORDINATION_EVENT_KINDS.includes(value as ProjectCoordinationEventKindV1)
  );
}

export function parseProjectCoordinationEventV1(value: unknown): ProjectCoordinationEventV1 {
  if (!isRecord(value) || value.schema !== 'illustro.project-coordination-event/1') {
    throw new TypeError('invalid project coordination event schema');
  }
  if (!isUuid(value.eventId) || !isUuid(value.sourceId)) {
    throw new TypeError('project coordination event IDs must be UUIDs');
  }
  if (!isEventKind(value.kind)) throw new TypeError('invalid project coordination event kind');
  if (typeof value.occurredAt !== 'string' || Number.isNaN(Date.parse(value.occurredAt))) {
    throw new TypeError('invalid project coordination event timestamp');
  }
  return Object.freeze({
    schema: 'illustro.project-coordination-event/1',
    eventId: value.eventId,
    sourceId: value.sourceId,
    projectId: parseProjectId(value.projectId),
    kind: value.kind,
    occurredAt: value.occurredAt,
    detail: toJsonValue(value.detail),
  });
}

function lockName(projectId: ProjectId): string {
  return `illustro.project.${projectId}.writer.v1`;
}

export class ProjectWriteCoordinatorV1 {
  readonly #lockManager: LockManagerLikeV1 | null;
  readonly #sourceId: string;
  readonly #now: () => string;
  readonly #channel: BroadcastChannelLikeV1 | null;
  readonly #listeners = new Set<(event: ProjectCoordinationEventV1) => void>();
  readonly #held = new Map<ProjectId, HeldProjectLockV1>();
  readonly #channelListener: (event: MessageEvent<unknown>) => void;
  #disposed = false;

  constructor(
    input: {
      readonly lockManager?: LockManagerLikeV1 | null;
      readonly channelFactory?: BroadcastChannelFactoryV1;
      readonly sourceId?: string;
      readonly now?: () => string;
    } = {},
  ) {
    this.#lockManager = input.lockManager === undefined ? browserLockManager() : input.lockManager;
    this.#sourceId = input.sourceId ?? crypto.randomUUID();
    if (!isUuid(this.#sourceId)) throw new TypeError('project coordinator sourceId must be a UUID');
    this.#now = input.now ?? (() => new Date().toISOString());
    const factory = input.channelFactory ?? browserBroadcastChannelFactory;
    this.#channel = factory(PROJECT_COORDINATION_CHANNEL);
    this.#channelListener = (event) => {
      try {
        const parsed = parseProjectCoordinationEventV1(event.data);
        if (parsed.sourceId === this.#sourceId) return;
        this.#notify(parsed);
      } catch {
        // Ignore malformed same-origin messages instead of poisoning project coordination.
      }
    };
    this.#channel?.addEventListener('message', this.#channelListener);
  }

  hasWriteOwnership(projectIdValue: ProjectId | string): boolean {
    return this.#held.has(parseProjectId(projectIdValue));
  }

  assertWriteOwnership(projectIdValue: ProjectId | string): void {
    const projectId = parseProjectId(projectIdValue);
    if (!this.#held.has(projectId)) {
      throw new Error(`project write ownership is not held: ${projectId}`);
    }
  }

  async acquire(projectIdValue: ProjectId | string): Promise<ProjectAccessStateV1> {
    this.#assertLive();
    const projectId = parseProjectId(projectIdValue);
    if (this.#held.has(projectId)) {
      return Object.freeze({ projectId, mode: 'read-write', reason: 'acquired' });
    }
    if (this.#lockManager === null) {
      return Object.freeze({ projectId, mode: 'read-only', reason: 'locks-unavailable' });
    }

    let releaseLock: (() => void) | null = null;
    let resolveAcquired: ((lock: LockTokenLikeV1 | null) => void) | null = null;
    let rejectAcquired: ((reason: unknown) => void) | null = null;
    const acquired = new Promise<LockTokenLikeV1 | null>((resolve, reject) => {
      resolveAcquired = resolve;
      rejectAcquired = reject;
    });
    const releaseSignal = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });
    const task = this.#lockManager.request(
      lockName(projectId),
      { mode: 'exclusive', ifAvailable: true },
      async (lock) => {
        resolveAcquired?.(lock);
        if (lock === null) return;
        await releaseSignal;
      },
    );
    void task.catch((error) => rejectAcquired?.(error));
    const lock = await acquired;
    if (lock === null) {
      await task;
      return Object.freeze({ projectId, mode: 'read-only', reason: 'locked-elsewhere' });
    }
    if (releaseLock === null) throw new Error('project lock release signal was not initialized');
    this.#held.set(projectId, { release: releaseLock, task });
    return Object.freeze({ projectId, mode: 'read-write', reason: 'acquired' });
  }

  async release(projectIdValue: ProjectId | string): Promise<boolean> {
    const projectId = parseProjectId(projectIdValue);
    const held = this.#held.get(projectId);
    if (held === undefined) return false;
    this.#held.delete(projectId);
    held.release();
    await held.task;
    return true;
  }

  async openProject(projectIdValue: ProjectId | string): Promise<ProjectAccessStateV1> {
    const access = await this.acquire(projectIdValue);
    this.announce(
      access.mode === 'read-write' ? 'project.opened' : 'project.read-only',
      access.projectId,
      { mode: access.mode, reason: access.reason },
    );
    return access;
  }

  async closeProject(projectIdValue: ProjectId | string): Promise<void> {
    const projectId = parseProjectId(projectIdValue);
    await this.release(projectId);
    this.announce('project.closed', projectId, null);
  }

  async runExclusive<Result>(
    projectIdValue: ProjectId | string,
    operation: () => Result | PromiseLike<Result>,
  ): Promise<Result> {
    const projectId = parseProjectId(projectIdValue);
    if (this.#held.has(projectId)) return operation();
    const access = await this.acquire(projectId);
    if (access.mode !== 'read-write') {
      throw new Error(
        access.reason === 'locks-unavailable'
          ? 'Web Locks unavailable; refusing unsafe project write'
          : 'project is locked by another writer',
      );
    }
    try {
      return await operation();
    } finally {
      await this.release(projectId);
    }
  }

  announce(
    kind: ProjectCoordinationEventKindV1,
    projectIdValue: ProjectId | string,
    detail: unknown,
  ): ProjectCoordinationEventV1 {
    this.#assertLive();
    const event = parseProjectCoordinationEventV1({
      schema: 'illustro.project-coordination-event/1',
      eventId: crypto.randomUUID(),
      sourceId: this.#sourceId,
      projectId: parseProjectId(projectIdValue),
      kind,
      occurredAt: this.#now(),
      detail: toJsonValue(detail),
    });
    this.#notify(event);
    this.#channel?.postMessage(event);
    return event;
  }

  subscribe(listener: (event: ProjectCoordinationEventV1) => void): () => void {
    this.#assertLive();
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  async dispose(): Promise<void> {
    if (this.#disposed) return;
    this.#disposed = true;
    const projectIds = [...this.#held.keys()];
    await Promise.all(projectIds.map((projectId) => this.release(projectId)));
    this.#channel?.removeEventListener('message', this.#channelListener);
    this.#channel?.close();
    this.#listeners.clear();
  }

  #notify(event: ProjectCoordinationEventV1): void {
    for (const listener of this.#listeners) listener(event);
  }

  #assertLive(): void {
    if (this.#disposed) throw new Error('project write coordinator is disposed');
  }
}

let sharedProjectWriteCoordinator: ProjectWriteCoordinatorV1 | null = null;

export function getProjectWriteCoordinator(): ProjectWriteCoordinatorV1 {
  sharedProjectWriteCoordinator ??= new ProjectWriteCoordinatorV1();
  return sharedProjectWriteCoordinator;
}
