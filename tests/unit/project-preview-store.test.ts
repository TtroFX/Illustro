import { describe, expect, it } from 'vitest';
import { createProjectId } from '../../src/domain/identity.js';
import { PNG_MIME_TYPE } from '../../src/export/png-export.js';
import {
  openIllustroOpfsRoot,
  type DirectoryHandleLike,
  type FileHandleLike,
  type StorageManagerLike,
  type WritableFileStreamLike,
} from '../../src/storage/opfs-layout.js';
import {
  createProjectThumbnailPngV1,
  ProjectPreviewStoreV1,
} from '../../src/app/project-preview-store.js';

class MemoryFileHandle implements FileHandleLike {
  bytes = new Uint8Array(0);
  type = '';

  async getFile(): Promise<Blob> {
    return new Blob([this.bytes], { type: this.type });
  }

  async createWritable(): Promise<WritableFileStreamLike> {
    return {
      write: async (data) => {
        const blob = data instanceof Blob ? data : new Blob([data as BlobPart]);
        this.bytes = new Uint8Array(await blob.arrayBuffer());
        this.type = data instanceof Blob ? data.type : '';
      },
      close: async () => undefined,
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

describe('M9A project preview store', () => {
  it('persists and overwrites a project thumbnail under one stable resource ID', async () => {
    const storage = new MemoryStorageManager();
    const root = await openIllustroOpfsRoot(storage);
    const store = new ProjectPreviewStoreV1(root);
    const projectId = createProjectId();
    const png = new Blob([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], {
      type: PNG_MIME_TYPE,
    });

    const resourceId = await store.write(projectId, png);
    const restored = await store.read(projectId, resourceId);

    expect(restored).not.toBeNull();
    expect(restored?.type).toBe(PNG_MIME_TYPE);
    const restoredBytes = new Uint8Array(await restored!.arrayBuffer());
    expect(restoredBytes).toEqual(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]));

    const replacement = new Blob(
      [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1])],
      { type: PNG_MIME_TYPE },
    );
    const reusedResourceId = await store.write(projectId, replacement, resourceId);
    expect(reusedResourceId).toBe(resourceId);
    expect((await store.read(projectId, resourceId))?.size).toBe(9);
  });

  it('keeps a valid PNG as the thumbnail fallback when bitmap APIs are unavailable', async () => {
    const png = new Blob([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], {
      type: PNG_MIME_TYPE,
    });
    await expect(createProjectThumbnailPngV1(png)).resolves.toBe(png);
  });
});
