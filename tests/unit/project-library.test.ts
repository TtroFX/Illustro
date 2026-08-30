import { describe, expect, it } from 'vitest';
import { createResourceId } from '../../src/domain/identity.js';
import {
  LocalProjectLibraryV1,
  readLocalProjectLibrary,
} from '../../src/storage/project-library.js';
import {
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

async function fixture(): Promise<{
  storage: MemoryStorageManager;
  root: Awaited<ReturnType<typeof openIllustroOpfsRoot>>;
  library: LocalProjectLibraryV1;
}> {
  const storage = new MemoryStorageManager();
  const root = await openIllustroOpfsRoot(storage);
  return { storage, root, library: new LocalProjectLibraryV1(root) };
}

describe('local project library lifecycle', () => {
  it('creates a coherent project, opens it, renames it, updates preview metadata, and closes it', async () => {
    const { library } = await fixture();
    const createdAt = new Date('2026-08-30T00:00:00.000Z');
    const created = await library.create({
      name: ' First Project ',
      initialSnapshot: { schema: 'test.snapshot/1', value: 1 },
      now: createdAt,
    });

    expect(created.metadata.name).toBe('First Project');
    expect(created.metadata.createdAt).toBe(createdAt.toISOString());
    expect(created.metadata.modifiedAt).toBe(createdAt.toISOString());
    expect(created.commit.recoveryGeneration).toBe(1);
    expect(created.snapshot).toEqual({ schema: 'test.snapshot/1', value: 1 });
    expect(created.documentRevision).toBe(0);

    const opened = await library.open(created.metadata.projectId);
    expect(opened.snapshot).toEqual(created.snapshot);
    expect(opened.recoveryGeneration).toBe(1);

    const renamedAt = new Date('2026-08-30T00:01:00.000Z');
    const renamed = await library.rename(created.metadata.projectId, 'Renamed', renamedAt);
    expect(renamed.name).toBe('Renamed');
    expect(renamed.modifiedAt).toBe(renamedAt.toISOString());
    expect(renamed.createdAt).toBe(createdAt.toISOString());

    const previewResourceId = createResourceId();
    const previewed = await library.updatePreview(created.metadata.projectId, previewResourceId);
    expect(previewed.previewResourceId).toBe(previewResourceId);
    expect(previewed.modifiedAt).toBe(renamed.modifiedAt);

    expect((await library.close(created.metadata.projectId)).projectId).toBe(
      created.metadata.projectId,
    );
    expect(await library.list()).toHaveLength(1);
  });

  it('duplicates the newest coherent snapshot under a new stable project ID', async () => {
    const { library } = await fixture();
    const previewResourceId = createResourceId();
    const source = await library.create({
      name: 'Source',
      initialSnapshot: { pixels: 'canonical' },
      documentRevision: 7,
      previewResourceId,
      now: new Date('2026-08-30T00:00:00.000Z'),
    });
    const duplicate = await library.duplicate(source.metadata.projectId, {
      name: 'Source copy 2',
      now: new Date('2026-08-30T00:02:00.000Z'),
    });

    expect(duplicate.metadata.projectId).not.toBe(source.metadata.projectId);
    expect(duplicate.metadata.name).toBe('Source copy 2');
    expect(duplicate.metadata.previewResourceId).toBe(previewResourceId);
    expect(duplicate.snapshot).toEqual(source.snapshot);
    expect(duplicate.documentRevision).toBe(source.documentRevision);
    expect(duplicate.sequence).toBe(1);
    expect(await library.list()).toHaveLength(2);
  });

  it('moves deletion into reversible Recently Deleted state and restores without rewriting content', async () => {
    const { library } = await fixture();
    const created = await library.create({
      name: 'Recover me',
      initialSnapshot: { value: 42 },
      now: new Date('2026-08-30T00:00:00.000Z'),
    });
    const deletedAt = new Date('2026-08-30T00:03:00.000Z');
    const trashed = await library.trash(created.metadata.projectId, deletedAt);

    expect(trashed.lifecycle).toBe('trashed');
    expect(trashed.deletedAt).toBe(deletedAt.toISOString());
    expect(await library.list()).toHaveLength(0);
    expect(await library.list({ includeTrashed: true })).toHaveLength(1);
    await expect(library.open(created.metadata.projectId)).rejects.toThrow('Recently Deleted');

    const restored = await library.restore(created.metadata.projectId);
    expect(restored.lifecycle).toBe('active');
    expect(restored.deletedAt).toBeNull();
    expect((await library.open(created.metadata.projectId)).snapshot).toEqual({ value: 42 });
  });

  it('falls back to the older valid dual-slot library state when the newest slot is corrupt', async () => {
    const { storage, root, library } = await fixture();
    const created = await library.create({
      name: 'Generation one',
      initialSnapshot: { value: 1 },
      now: new Date('2026-08-30T00:00:00.000Z'),
    });
    await library.rename(
      created.metadata.projectId,
      'Generation two',
      new Date('2026-08-30T00:01:00.000Z'),
    );

    const illustroRoot = storage.root.directories.get('illustro');
    if (illustroRoot === undefined) throw new Error('Illustro OPFS root missing');
    const newest = illustroRoot.files.get('library-b.json');
    if (newest === undefined) throw new Error('newest library slot missing');
    newest.bytes = new TextEncoder().encode('{broken');

    const fallback = await readLocalProjectLibrary(root);
    expect(fallback.generation).toBe(1);
    expect(fallback.projects[0]?.name).toBe('Generation one');
  });
});
