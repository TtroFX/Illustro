import { describe, expect, it } from 'vitest';
import type { CommandTransactionId } from '../../src/domain/command-registry.js';
import { createProjectId, INITIAL_REVISION } from '../../src/domain/identity.js';
import {
  collectProjectGarbageCollectionRootsV1,
  planGarbageCollectionV1,
} from '../../src/storage/garbage-collection.js';
import { putImmutableObject } from '../../src/storage/immutable-object-store.js';
import {
  ensureProjectDirectoryLayout,
  openIllustroOpfsRoot,
  type DirectoryHandleLike,
  type FileHandleLike,
  type StorageManagerLike,
  type WritableFileStreamLike,
} from '../../src/storage/opfs-layout.js';
import {
  calculateStorageQuotaSnapshotV1,
  MEBIBYTE,
  StorageQuotaMonitorV1,
  type StorageManagerQuotaLikeV1,
} from '../../src/storage/storage-quota.js';
import type { SyncAccessHandleLike } from '../../src/storage/sync-access.js';
import { commitProjectTransaction } from '../../src/storage/transaction.js';

class FakeQuotaStorage implements StorageManagerQuotaLikeV1 {
  usage = 0;
  quota = 2 * 1024 * MEBIBYTE;
  persistent = false;
  persistCalls = 0;

  async estimate(): Promise<{ usage: number; quota: number }> {
    return { usage: this.usage, quota: this.quota };
  }

  async persisted(): Promise<boolean> {
    return this.persistent;
  }

  async persist(): Promise<boolean> {
    this.persistCalls += 1;
    this.persistent = true;
    return true;
  }
}

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

  async *entries(): AsyncIterableIterator<[string, unknown]> {
    for (const entry of this.directories) yield entry;
    for (const entry of this.files) yield entry;
  }
}

class MemoryStorageManager implements StorageManagerLike {
  readonly root = new MemoryDirectoryHandle();

  async getDirectory(): Promise<DirectoryHandleLike> {
    return this.root;
  }
}

describe('storage quota safety policy', () => {
  it('computes the frozen warning, critical, and hard reserves exactly', () => {
    const twoGiB = 2 * 1024 * MEBIBYTE;
    const snapshot = calculateStorageQuotaSnapshotV1({ usage: 0, quota: twoGiB, persisted: false });
    expect(snapshot.warningReserveBytes).toBe(512 * MEBIBYTE);
    expect(snapshot.criticalReserveBytes).toBe(256 * MEBIBYTE);
    expect(snapshot.hardReserveBytes).toBe(128 * MEBIBYTE);

    const tenGiB = 10 * 1024 * MEBIBYTE;
    const proportional = calculateStorageQuotaSnapshotV1({ usage: 0, quota: tenGiB });
    expect(proportional.warningReserveBytes).toBe(tenGiB * 0.15);
    expect(proportional.criticalReserveBytes).toBe(tenGiB * 0.08);
    expect(proportional.hardReserveBytes).toBe(tenGiB * 0.05);
  });

  it('blocks projected durable growth below the hard reserve but permits non-origin safe export', async () => {
    const storage = new FakeQuotaStorage();
    storage.usage = storage.quota - 200 * MEBIBYTE;
    const monitor = new StorageQuotaMonitorV1(storage);

    const safe = await monitor.preflight(64 * MEBIBYTE);
    expect(safe.allowed).toBe(true);
    expect(safe.reason).toBe('safe');

    const unsafe = await monitor.preflight(100 * MEBIBYTE);
    expect(unsafe.allowed).toBe(false);
    expect(unsafe.reason).toBe('hard-reserve-breach');
    await expect(monitor.assertCanGrow(100 * MEBIBYTE)).rejects.toMatchObject({
      name: 'QuotaExceededError',
    });

    const exportPreflight = await monitor.preflight(100 * MEBIBYTE, { safeExport: true });
    expect(exportPreflight).toMatchObject({ allowed: true, reason: 'safe-export' });
  });

  it('requests persistent storage once and records before/after state', async () => {
    const storage = new FakeQuotaStorage();
    const monitor = new StorageQuotaMonitorV1(storage);
    const first = await monitor.requestPersistence();
    expect(first).toMatchObject({
      supported: true,
      persistedBefore: false,
      requested: true,
      persistedAfter: true,
    });
    expect(storage.persistCalls).toBe(1);

    const second = await monitor.requestPersistence();
    expect(second.requested).toBe(false);
    expect(second.persistedAfter).toBe(true);
    expect(storage.persistCalls).toBe(1);
  });
});

describe('immutable object GC planning', () => {
  it('marks published checkpoint/journal dependencies and only proposes unreachable objects', async () => {
    const root = await openIllustroOpfsRoot(new MemoryStorageManager());
    const project = await ensureProjectDirectoryLayout(root, createProjectId());
    const child = await putImmutableObject(root.sha256Objects, new TextEncoder().encode('child'));
    const orphan = await putImmutableObject(root.sha256Objects, new TextEncoder().encode('orphan'));
    const commit = await commitProjectTransaction(root, project, {
      transactionId: crypto.randomUUID() as CommandTransactionId,
      sequence: 1,
      documentRevision: INITIAL_REVISION,
      snapshot: { childObjectHash: child.hash },
      createdAt: '2026-08-31T00:00:00.000Z',
    });

    const roots = await collectProjectGarbageCollectionRootsV1(project);
    const plan = await planGarbageCollectionV1(root, roots);

    expect(plan.destructive).toBe(false);
    expect(plan.enumerationSupported).toBe(true);
    expect(plan.reachableObjectHashes).toContain(commit.checkpointObjectHash);
    expect(plan.reachableObjectHashes).toContain(commit.snapshotObjectHash);
    expect(plan.reachableObjectHashes).toContain(child.hash);
    expect(plan.unreachableCandidateHashes).toContain(orphan.hash);
    expect(plan.unreachableCandidateHashes).not.toContain(commit.checkpointObjectHash);
    expect(plan.unreachableCandidateHashes).not.toContain(commit.snapshotObjectHash);
    expect(plan.unreachableCandidateHashes).not.toContain(child.hash);
    expect(plan.missingReferencedHashes).toEqual([]);
  });
});
