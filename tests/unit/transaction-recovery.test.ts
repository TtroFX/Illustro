import { describe, expect, it } from 'vitest';
import type { CommandTransactionId } from '../../src/domain/command-registry.js';
import { createProjectId, INITIAL_REVISION } from '../../src/domain/identity.js';
import { encodeJournalFrame, scanJournalFrames } from '../../src/storage/journal.js';
import {
  ensureProjectDirectoryLayout,
  openIllustroOpfsRoot,
  type DirectoryHandleLike,
  type FileHandleLike,
  type StorageManagerLike,
  type WritableFileStreamLike,
} from '../../src/storage/opfs-layout.js';
import { readDualRecoveryState } from '../../src/storage/recovery-head.js';
import type { SyncAccessHandleLike } from '../../src/storage/sync-access.js';
import { commitProjectTransaction } from '../../src/storage/transaction.js';

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

function transactionId(): CommandTransactionId {
  return crypto.randomUUID() as CommandTransactionId;
}

describe('transaction journal and recovery foundation', () => {
  it('frames journal payloads with checksum metadata and detects torn/corrupt frames', async () => {
    const encoded = await encodeJournalFrame({
      kind: 'prepare',
      sequence: 7,
      payload: { transactionId: crypto.randomUUID(), state: 'prepared' },
    });
    const scan = await scanJournalFrames(encoded);
    expect(scan.truncatedTail).toBe(false);
    expect(scan.frames).toHaveLength(1);
    expect(scan.frames[0]?.sequence).toBe(7);
    expect(scan.frames[0]?.checksum).toMatch(/^[0-9a-f]{64}$/);

    const torn = await scanJournalFrames(encoded.subarray(0, encoded.byteLength - 3));
    expect(torn.frames).toHaveLength(0);
    expect(torn.truncatedTail).toBe(true);

    const corrupted = encoded.slice();
    corrupted[corrupted.byteLength - 1] ^= 0xff;
    await expect(scanJournalFrames(corrupted)).rejects.toThrow('journal checksum mismatch');
  });

  it('commits immutable snapshots, checkpoint publications, and alternating recovery heads', async () => {
    const root = await openIllustroOpfsRoot(new MemoryStorageManager());
    const project = await ensureProjectDirectoryLayout(root, createProjectId());
    const firstId = transactionId();
    const first = await commitProjectTransaction(root, project, {
      transactionId: firstId,
      sequence: 1,
      documentRevision: INITIAL_REVISION,
      snapshot: { document: 'first' },
      createdAt: '2026-08-30T00:00:00.000Z',
    });
    expect(first.recoveryGeneration).toBe(1);

    const second = await commitProjectTransaction(root, project, {
      transactionId: transactionId(),
      sequence: 2,
      documentRevision: INITIAL_REVISION,
      snapshot: { document: 'second' },
      createdAt: '2026-08-30T00:00:01.000Z',
    });
    expect(second.recoveryGeneration).toBe(2);
    expect(second.snapshotObjectHash).not.toBe(first.snapshotObjectHash);

    const journalFile = await project.directories.journal.getFileHandle('main.ilj');
    const journalBytes = new Uint8Array(await (await journalFile.getFile()).arrayBuffer());
    const scan = await scanJournalFrames(journalBytes);
    expect(scan.frames.map((frame) => frame.kind)).toEqual([
      'prepare',
      'commit',
      'prepare',
      'commit',
    ]);
    expect(scan.truncatedTail).toBe(false);

    const state = await readDualRecoveryState(project);
    expect(state.a?.generation).toBe(1);
    expect(state.b?.generation).toBe(2);
    expect(state.current?.generation).toBe(2);

    const headB = await project.directories.heads.getFileHandle('head-b.json');
    const writable = await headB.createWritable({ keepExistingData: false });
    await writable.write('{broken');
    await writable.close();
    const recovered = await readDualRecoveryState(project);
    expect(recovered.b).toBeNull();
    expect(recovered.current?.transactionId).toBe(firstId);
  });
});
