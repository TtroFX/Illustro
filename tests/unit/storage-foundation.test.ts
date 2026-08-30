import { describe, expect, it } from 'vitest';
import { createLayerId, createProjectId, INITIAL_REVISION } from '../../src/domain/identity.js';
import {
  entityRevisionPath,
  persistEntityRevision,
} from '../../src/storage/entity-revision-store.js';
import {
  immutableObjectPath,
  putImmutableObject,
  readImmutableObject,
} from '../../src/storage/immutable-object-store.js';
import {
  ensureProjectDirectoryLayout,
  openIllustroOpfsRoot,
  PROJECT_DIRECTORY_NAMES,
  type DirectoryHandleLike,
  type FileHandleLike,
  type StorageManagerLike,
  type WritableFileStreamLike,
} from '../../src/storage/opfs-layout.js';

class MemoryFileHandle implements FileHandleLike {
  bytes = new Uint8Array();

  async getFile(): Promise<Blob> {
    return new Blob([this.bytes]);
  }

  async createWritable(): Promise<WritableFileStreamLike> {
    let pending = this.bytes;
    return {
      write: async (data) => {
        if (typeof data === 'string') pending = new TextEncoder().encode(data);
        else if (data instanceof Blob) pending = new Uint8Array(await data.arrayBuffer());
        else if (data instanceof ArrayBuffer) pending = new Uint8Array(data);
        else pending = new Uint8Array(data.buffer, data.byteOffset, data.byteLength).slice();
      },
      close: async () => {
        this.bytes = pending.slice();
      },
    };
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

describe('OPFS project persistence foundation', () => {
  it('creates the canonical root and per-project directory layout idempotently', async () => {
    const storage = new MemoryStorageManager();
    const root = await openIllustroOpfsRoot(storage);
    const projectId = createProjectId();
    const first = await ensureProjectDirectoryLayout(root, projectId);
    const second = await ensureProjectDirectoryLayout(root, projectId);

    expect(Object.keys(first.directories).sort()).toEqual([...PROJECT_DIRECTORY_NAMES].sort());
    expect(second.project).toBe(first.project);
    expect(storage.root.directories.has('illustro')).toBe(true);
  });

  it('stores bytes by SHA-256 without rewriting an existing immutable object', async () => {
    const root = await openIllustroOpfsRoot(new MemoryStorageManager());
    const bytes = new TextEncoder().encode('illustro immutable object');
    const first = await putImmutableObject(root.sha256Objects, bytes);
    const second = await putImmutableObject(root.sha256Objects, bytes);

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.hash).toBe(first.hash);
    expect(immutableObjectPath(first.hash)[0]).toBe(first.hash.slice(0, 2));
    expect(await readImmutableObject(root.sha256Objects, first.hash)).toEqual(bytes);
  });

  it('persists stable entity ID + revision references to immutable content', async () => {
    const root = await openIllustroOpfsRoot(new MemoryStorageManager());
    const project = await ensureProjectDirectoryLayout(root, createProjectId());
    const layerId = createLayerId();
    const persisted = await persistEntityRevision(root, project, {
      kind: 'layer',
      entityId: layerId,
      revision: INITIAL_REVISION,
      snapshot: { id: layerId, revision: INITIAL_REVISION, name: 'Layer 1' },
    });

    expect(entityRevisionPath('layer', layerId, INITIAL_REVISION)).toEqual([
      'layer',
      layerId,
      '0.json',
    ]);
    expect(persisted.record.object.algorithm).toBe('sha256');
    expect(persisted.record.object.hash).toMatch(/^[0-9a-f]{64}$/);

    const again = await persistEntityRevision(root, project, {
      kind: 'layer',
      entityId: layerId,
      revision: INITIAL_REVISION,
      snapshot: { id: layerId, revision: INITIAL_REVISION, name: 'Layer 1' },
    });
    expect(again.record).toEqual(persisted.record);

    await expect(
      persistEntityRevision(root, project, {
        kind: 'layer',
        entityId: layerId,
        revision: INITIAL_REVISION,
        snapshot: { id: layerId, revision: INITIAL_REVISION, name: 'Conflicting revision' },
      }),
    ).rejects.toThrow('entity revision is immutable');
  });
});
