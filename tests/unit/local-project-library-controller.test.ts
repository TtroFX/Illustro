import { describe, expect, it } from 'vitest';
import { LocalProjectLibraryControllerV1 } from '../../src/app/local-project-library-controller.js';
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
  #open(): void {
    if (this.#closed) throw new Error('closed');
  }
  read(buffer: Uint8Array<ArrayBuffer>, options?: { at?: number }): number {
    this.#open();
    const at = options?.at ?? 0;
    const count = Math.max(0, Math.min(buffer.byteLength, this.file.bytes.byteLength - at));
    buffer.set(this.file.bytes.subarray(at, at + count));
    return count;
  }
  write(buffer: Uint8Array<ArrayBuffer>, options?: { at?: number }): number {
    this.#open();
    const at = options?.at ?? 0;
    const next = new Uint8Array(Math.max(this.file.bytes.byteLength, at + buffer.byteLength));
    next.set(this.file.bytes);
    next.set(buffer, at);
    this.file.bytes = next;
    return buffer.byteLength;
  }
  truncate(size: number): void {
    this.#open();
    const next = new Uint8Array(size);
    next.set(this.file.bytes.subarray(0, Math.min(size, this.file.bytes.byteLength)));
    this.file.bytes = next;
  }
  getSize(): number {
    this.#open();
    return this.file.bytes.byteLength;
  }
  flush(): void {
    this.#open();
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

async function controllerFixture(importName = 'Imported') {
  const storage = new MemoryStorageManager();
  const root = await openIllustroOpfsRoot(storage);
  return new LocalProjectLibraryControllerV1(root, {
    importAdapter: {
      async importProject() {
        return { name: importName, snapshot: { imported: true } };
      },
    },
  });
}

describe('M9A local project library controller', () => {
  it('queries active projects with search and deterministic sort while exposing coherent recovery state', async () => {
    const controller = await controllerFixture();
    await controller.create({
      name: 'Beta',
      initialSnapshot: { value: 1 },
      now: new Date('2026-09-01T00:00:00.000Z'),
    });
    await controller.create({
      name: 'alpha',
      initialSnapshot: { value: 2 },
      now: new Date('2026-09-02T00:00:00.000Z'),
    });

    const byName = await controller.query({ section: 'projects', sort: 'name-asc' });
    expect(byName.cards.map((card) => card.name)).toEqual(['alpha', 'Beta']);
    expect(byName.cards.every((card) => card.recovery.coherent)).toBe(true);

    const searched = await controller.query({ search: 'ALP' });
    expect(searched.total).toBe(1);
    expect(searched.cards[0]?.name).toBe('alpha');

    const recent = await controller.query({ section: 'recent', limit: 1 });
    expect(recent.total).toBe(2);
    expect(recent.cards[0]?.name).toBe('alpha');
  });

  it('keeps Recently Deleted separate and restores the same canonical project', async () => {
    const controller = await controllerFixture();
    const created = await controller.create({
      name: 'Trash me',
      initialSnapshot: { canonical: 42 },
      now: new Date('2026-09-01T00:00:00.000Z'),
    });
    await controller.trash(created.metadata.projectId, new Date('2026-09-03T00:00:00.000Z'));

    expect((await controller.query()).cards).toHaveLength(0);
    const deleted = await controller.query({ section: 'recently-deleted' });
    expect(deleted.cards).toHaveLength(1);
    expect(deleted.cards[0]?.deletedAt).toBe('2026-09-03T00:00:00.000Z');

    await controller.restore(created.metadata.projectId);
    const reopened = await controller.open(created.metadata.projectId);
    expect(reopened.snapshot).toEqual({ canonical: 42 });
    expect((await controller.query({ section: 'recently-deleted' })).cards).toHaveLength(0);
  });

  it('routes Library import through an injected format adapter and creates a normal recoverable project', async () => {
    const controller = await controllerFixture('Imported artwork');
    const imported = await controller.import(new Blob(['fixture']));
    expect(imported.metadata.name).toBe('Imported artwork');
    expect(imported.snapshot).toEqual({ imported: true });

    const recovery = await controller.query({ section: 'recovery' });
    expect(recovery.cards.some((card) => card.projectId === imported.metadata.projectId)).toBe(
      true,
    );
  });

  it('rejects invalid limits rather than silently producing unstable pagination', async () => {
    const controller = await controllerFixture();
    await expect(controller.query({ limit: 0 })).rejects.toThrow('positive safe integer');
  });
});
