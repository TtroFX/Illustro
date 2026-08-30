import { describe, expect, it } from 'vitest';
import { createProjectId } from '../../src/domain/identity.js';
import {
  ProjectWriteCoordinatorV1,
  type BroadcastChannelLikeV1,
  type LockManagerLikeV1,
  type LockTokenLikeV1,
  type ProjectCoordinationEventV1,
} from '../../src/storage/project-coordination.js';

class SharedLockManager implements LockManagerLikeV1 {
  readonly held = new Set<string>();

  async request<Result>(
    name: string,
    _options: { readonly mode: 'exclusive'; readonly ifAvailable: true },
    callback: (lock: LockTokenLikeV1 | null) => Result | PromiseLike<Result>,
  ): Promise<Result> {
    if (this.held.has(name)) return callback(null);
    this.held.add(name);
    try {
      return await callback({ name, mode: 'exclusive' });
    } finally {
      this.held.delete(name);
    }
  }
}

class ChannelHub {
  readonly channels = new Set<FakeChannel>();

  create(): FakeChannel {
    const channel = new FakeChannel(this);
    this.channels.add(channel);
    return channel;
  }
}

class FakeChannel implements BroadcastChannelLikeV1 {
  readonly #listeners = new Set<(event: MessageEvent<unknown>) => void>();
  #closed = false;

  constructor(private readonly hub: ChannelHub) {}

  postMessage(message: unknown): void {
    if (this.#closed) throw new Error('channel closed');
    for (const channel of this.hub.channels) {
      if (channel === this || channel.#closed) continue;
      channel.#deliver(message);
    }
  }

  addEventListener(type: 'message', listener: (event: MessageEvent<unknown>) => void): void {
    if (type === 'message') this.#listeners.add(listener);
  }

  removeEventListener(type: 'message', listener: (event: MessageEvent<unknown>) => void): void {
    if (type === 'message') this.#listeners.delete(listener);
  }

  close(): void {
    this.#closed = true;
    this.hub.channels.delete(this);
    this.#listeners.clear();
  }

  #deliver(message: unknown): void {
    const event = { data: message } as MessageEvent<unknown>;
    for (const listener of this.#listeners) listener(event);
  }
}

function coordinator(
  lockManager: SharedLockManager | null,
  hub: ChannelHub,
  sourceId: string,
): ProjectWriteCoordinatorV1 {
  return new ProjectWriteCoordinatorV1({
    lockManager,
    channelFactory: () => hub.create(),
    sourceId,
    now: () => '2026-08-31T00:00:00.000Z',
  });
}

describe('project cross-context coordination', () => {
  it('grants exactly one writer and degrades a second tab to read-only until release', async () => {
    const locks = new SharedLockManager();
    const hub = new ChannelHub();
    const projectId = createProjectId();
    const first = coordinator(locks, hub, crypto.randomUUID());
    const second = coordinator(locks, hub, crypto.randomUUID());

    const firstAccess = await first.openProject(projectId);
    expect(firstAccess).toMatchObject({ mode: 'read-write', reason: 'acquired' });
    expect(first.hasWriteOwnership(projectId)).toBe(true);

    const secondAccess = await second.openProject(projectId);
    expect(secondAccess).toMatchObject({ mode: 'read-only', reason: 'locked-elsewhere' });
    expect(second.hasWriteOwnership(projectId)).toBe(false);
    expect(() => second.assertWriteOwnership(projectId)).toThrow('write ownership');

    await first.closeProject(projectId);
    const retried = await second.openProject(projectId);
    expect(retried.mode).toBe('read-write');
    expect(second.hasWriteOwnership(projectId)).toBe(true);

    await Promise.all([first.dispose(), second.dispose()]);
  });

  it('refuses unsafe writes when Web Locks are unavailable', async () => {
    const hub = new ChannelHub();
    const projectId = createProjectId();
    const instance = coordinator(null, hub, crypto.randomUUID());
    const access = await instance.openProject(projectId);

    expect(access).toMatchObject({ mode: 'read-only', reason: 'locks-unavailable' });
    await expect(instance.runExclusive(projectId, () => 'unsafe')).rejects.toThrow(
      'Web Locks unavailable',
    );
    await instance.dispose();
  });

  it('propagates same-origin project status to a second tab and ignores malformed broadcasts', async () => {
    const locks = new SharedLockManager();
    const hub = new ChannelHub();
    const projectId = createProjectId();
    const first = coordinator(locks, hub, crypto.randomUUID());
    const second = coordinator(locks, hub, crypto.randomUUID());
    const observed: ProjectCoordinationEventV1[] = [];
    second.subscribe((event) => observed.push(event));

    await first.openProject(projectId);
    first.announce('project.renamed', projectId, { name: 'Second-tab update' });
    first.announce('project.save-status', projectId, { status: 'saved' });

    expect(observed.map((event) => event.kind)).toEqual([
      'project.opened',
      'project.renamed',
      'project.save-status',
    ]);
    expect(observed[1]?.detail).toEqual({ name: 'Second-tab update' });

    const rogue = hub.create();
    rogue.postMessage({ schema: 'not-illustro', projectId });
    expect(observed).toHaveLength(3);
    rogue.close();

    await Promise.all([first.dispose(), second.dispose()]);
  });

  it('allows transient exclusive library mutations without stealing an already-held writer lock', async () => {
    const locks = new SharedLockManager();
    const hub = new ChannelHub();
    const projectId = createProjectId();
    const first = coordinator(locks, hub, crypto.randomUUID());
    const second = coordinator(locks, hub, crypto.randomUUID());

    await first.openProject(projectId);
    await expect(second.runExclusive(projectId, () => 1)).rejects.toThrow(
      'locked by another writer',
    );
    expect(await first.runExclusive(projectId, () => 42)).toBe(42);
    expect(first.hasWriteOwnership(projectId)).toBe(true);

    await Promise.all([first.dispose(), second.dispose()]);
  });
});
