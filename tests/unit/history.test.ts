import { describe, expect, it } from 'vitest';
import {
  createHistoryPayloadV1,
  createHistoryTransactionV1,
  HISTORY_PAYLOAD_STRATEGIES,
  HistorySpineV1,
  type HistoryTransactionV1,
} from '../../src/history/history.js';
import { createProjectId } from '../../src/domain/identity.js';
import { ProjectHistoryStoreV1 } from '../../src/storage/history-store.js';
import {
  ensureProjectDirectoryLayout,
  openIllustroOpfsRoot,
  type DirectoryHandleLike,
  type FileHandleLike,
  type StorageManagerLike,
  type WritableFileStreamLike,
} from '../../src/storage/opfs-layout.js';
import type { SyncAccessHandleLike } from '../../src/storage/sync-access.js';

class MemorySyncAccessHandle implements SyncAccessHandleLike {
  #closed = false;

  constructor(private readonly file: MemoryFileHandle) {}

  #assertOpen(): void {
    if (this.#closed) throw new Error('closed');
  }

  read(buffer: Uint8Array<ArrayBuffer>, options?: { at?: number }): number {
    this.#assertOpen();
    const at = options?.at ?? 0;
    const count = Math.max(0, Math.min(buffer.byteLength, this.file.bytes.byteLength - at));
    buffer.set(this.file.bytes.subarray(at, at + count));
    return count;
  }

  write(buffer: Uint8Array<ArrayBuffer>, options?: { at?: number }): number {
    this.#assertOpen();
    const at = options?.at ?? 0;
    const next = new Uint8Array(Math.max(this.file.bytes.byteLength, at + buffer.byteLength));
    next.set(this.file.bytes);
    next.set(buffer, at);
    this.file.bytes = next;
    return buffer.byteLength;
  }

  truncate(newSize: number): void {
    this.#assertOpen();
    const next = new Uint8Array(newSize);
    next.set(this.file.bytes.subarray(0, Math.min(newSize, this.file.bytes.byteLength)));
    this.file.bytes = next;
  }

  getSize(): number {
    this.#assertOpen();
    return this.file.bytes.byteLength;
  }

  flush(): void {
    this.#assertOpen();
  }

  close(): void {
    this.#closed = true;
  }
}

class MemoryFileHandle implements FileHandleLike {
  bytes: Uint8Array<ArrayBuffer> = new Uint8Array(0);

  async getFile(): Promise<Blob> {
    return new Blob([this.bytes]);
  }

  async createWritable(): Promise<WritableFileStreamLike> {
    let pending = this.bytes;
    return {
      write: async (data) => {
        if (typeof data === 'string') pending = new TextEncoder().encode(data);
        else if (data instanceof Blob) pending = new Uint8Array(await data.arrayBuffer());
        else if (data instanceof ArrayBuffer) pending = new Uint8Array(data.slice(0));
        else {
          const copy = new Uint8Array(data.byteLength);
          copy.set(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
          pending = copy;
        }
      },
      close: async () => {
        this.bytes = pending.slice();
      },
    };
  }

  async createSyncAccessHandle(): Promise<SyncAccessHandleLike> {
    return new MemorySyncAccessHandle(this);
  }
}

class MemoryDirectoryHandle implements DirectoryHandleLike {
  readonly directories = new Map<string, MemoryDirectoryHandle>();
  readonly files = new Map<string, MemoryFileHandle>();

  async getDirectoryHandle(
    name: string,
    options?: { create?: boolean },
  ): Promise<MemoryDirectoryHandle> {
    const existing = this.directories.get(name);
    if (existing) return existing;
    if (options?.create !== true) throw new DOMException('missing', 'NotFoundError');
    const created = new MemoryDirectoryHandle();
    this.directories.set(name, created);
    return created;
  }

  async getFileHandle(name: string, options?: { create?: boolean }): Promise<MemoryFileHandle> {
    const existing = this.files.get(name);
    if (existing) return existing;
    if (options?.create !== true) throw new DOMException('missing', 'NotFoundError');
    const created = new MemoryFileHandle();
    this.files.set(name, created);
    return created;
  }
}

class MemoryStorageManager implements StorageManagerLike {
  readonly root = new MemoryDirectoryHandle();

  async getDirectory(): Promise<DirectoryHandleLike> {
    return this.root;
  }
}

function transaction(
  index: number,
  strategy: (typeof HISTORY_PAYLOAD_STRATEGIES)[number] = 'typed-before-after',
  extra = '',
): HistoryTransactionV1 {
  return createHistoryTransactionV1({
    transactionId: crypto.randomUUID(),
    commandId: 'history.test',
    beforeRevision: index,
    afterRevision: index + 1,
    committedAt: `2026-08-30T00:00:${String(index).padStart(2, '0')}.000Z`,
    payload: createHistoryPayloadV1({
      strategy,
      before: { value: index, extra },
      after: { value: index + 1, extra },
    }),
  });
}

function payloadValue(transactionValue: HistoryTransactionV1, direction: 'undo' | 'redo'): number {
  const value =
    direction === 'undo' ? transactionValue.payload.before : transactionValue.payload.after;
  if (value === null || Array.isArray(value) || typeof value !== 'object') {
    throw new TypeError('test payload must be an object');
  }
  const observed = value.value;
  if (typeof observed !== 'number') throw new TypeError('test payload value must be numeric');
  return observed;
}

describe('history transaction spine', () => {
  it('records hybrid exact payload strategies', () => {
    for (const [index, strategy] of HISTORY_PAYLOAD_STRATEGIES.entries()) {
      const entry = transaction(index, strategy);
      expect(entry.payload.strategy).toBe(strategy);
      expect(entry.payload.before).toMatchObject({ value: index });
      expect(entry.payload.after).toMatchObject({ value: index + 1 });
    }
  });

  it('undoes, redoes, and invalidates the redo branch on a new mutation', async () => {
    const spine = new HistorySpineV1();
    spine.commit(transaction(0));
    spine.commit(transaction(1));
    let canonicalValue = 2;
    const restore = (entry: HistoryTransactionV1, direction: 'undo' | 'redo'): void => {
      canonicalValue = payloadValue(entry, direction);
    };

    expect(await spine.undo(restore)).toBe(true);
    expect(canonicalValue).toBe(1);
    expect(spine.canRedo).toBe(true);
    expect(await spine.redo(restore)).toBe(true);
    expect(canonicalValue).toBe(2);

    await spine.undo(restore);
    const branch = createHistoryTransactionV1({
      transactionId: crypto.randomUUID(),
      commandId: 'history.branch',
      beforeRevision: 1,
      afterRevision: 3,
      committedAt: '2026-08-30T00:01:00.000Z',
      payload: createHistoryPayloadV1({
        strategy: 'snapshot-ref',
        before: { value: 1 },
        after: { value: 7 },
      }),
    });
    canonicalValue = 7;
    spine.commit(branch);
    expect(spine.length).toBe(2);
    expect(spine.canRedo).toBe(false);
    expect(await spine.undo(restore)).toBe(true);
    expect(canonicalValue).toBe(1);
  });

  it('prunes only complete applied prefix transactions', async () => {
    const spine = new HistorySpineV1();
    for (let index = 0; index < 5; index += 1) spine.commit(transaction(index));
    expect(spine.prune(3)).toHaveLength(2);
    expect(spine.length).toBe(3);
    expect(spine.cursor).toBe(3);

    const restore = (): void => undefined;
    await spine.undo(restore);
    await spine.undo(restore);
    await spine.undo(restore);
    expect(spine.cursor).toBe(0);
    expect(spine.prune(1)).toHaveLength(0);
    expect(spine.length).toBe(3);
  });
});

describe('history spill and reload persistence', () => {
  it('spills cold complete transactions and restores Undo/Redo across reload', async () => {
    const root = await openIllustroOpfsRoot(new MemoryStorageManager());
    const project = await ensureProjectDirectoryLayout(root, createProjectId());
    const store = new ProjectHistoryStoreV1(project);
    const spine = new HistorySpineV1();
    for (let index = 0; index < 4; index += 1) {
      spine.commit(transaction(index, 'tile-patch-set', 'x'.repeat(2_048)));
    }

    const spilled = await spine.spillCold(store, 1_000);
    expect(spilled.length).toBeGreaterThan(0);
    expect(spine.residentByteLength).toBeLessThanOrEqual(1_000);
    await store.saveState(spine.exportState());

    const firstReload = await store.loadState();
    expect(firstReload.status).toBe('ok');
    if (firstReload.status !== 'ok') throw new Error('history state was not restored');
    const hydrated = HistorySpineV1.hydrate(firstReload.state);
    expect(hydrated.cursor).toBe(4);
    expect(hydrated.canUndo).toBe(true);

    let canonicalValue = 4;
    await hydrated.undo((entry, direction) => {
      canonicalValue = payloadValue(entry, direction);
    }, store);
    expect(canonicalValue).toBe(3);
    expect(hydrated.canRedo).toBe(true);
    await store.saveState(hydrated.exportState());

    const secondReload = await store.loadState();
    expect(secondReload.status).toBe('ok');
    if (secondReload.status !== 'ok') throw new Error('history state was not restored');
    const reopened = HistorySpineV1.hydrate(secondReload.state);
    expect(reopened.canRedo).toBe(true);
    await reopened.redo((entry, direction) => {
      canonicalValue = payloadValue(entry, direction);
    }, store);
    expect(canonicalValue).toBe(4);
  });

  it('fails history state closed without treating it as canonical document corruption', async () => {
    const root = await openIllustroOpfsRoot(new MemoryStorageManager());
    const project = await ensureProjectDirectoryLayout(root, createProjectId());
    const store = new ProjectHistoryStoreV1(project);
    const spine = new HistorySpineV1();
    spine.commit(transaction(0));
    await store.saveState(spine.exportState());

    const stateFile = await project.directories.history.getFileHandle('state.json');
    const writable = await stateFile.createWritable({ keepExistingData: false });
    await writable.write('{broken');
    await writable.close();

    const degraded = await store.loadState();
    expect(degraded.status).toBe('corrupt');
    expect(degraded.state).toBeNull();
  });
});
