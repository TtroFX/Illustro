import { describe, expect, it } from 'vitest';
import {
  openSyncAccessFile,
  probeSyncAccessHandle,
  type SyncAccessHandleLike,
} from '../../src/storage/sync-access.js';
import type {
  DirectoryHandleLike,
  FileHandleLike,
  WritableFileStreamLike,
} from '../../src/storage/opfs-layout.js';

class MemorySyncHandle implements SyncAccessHandleLike {
  bytes = new Uint8Array<ArrayBuffer>();
  closed = false;

  read(buffer: Uint8Array<ArrayBuffer>, options?: { at?: number }): number {
    const at = options?.at ?? 0;
    const available = Math.max(0, this.bytes.byteLength - at);
    const count = Math.min(buffer.byteLength, available);
    buffer.set(this.bytes.subarray(at, at + count));
    return count;
  }

  write(buffer: Uint8Array<ArrayBuffer>, options?: { at?: number }): number {
    const at = options?.at ?? 0;
    const required = at + buffer.byteLength;
    if (required > this.bytes.byteLength) {
      const expanded = new Uint8Array(required);
      expanded.set(this.bytes);
      this.bytes = expanded;
    }
    this.bytes.set(buffer, at);
    return buffer.byteLength;
  }

  truncate(newSize: number): void {
    const next = new Uint8Array(newSize);
    next.set(this.bytes.subarray(0, newSize));
    this.bytes = next;
  }

  getSize(): number {
    return this.bytes.byteLength;
  }

  flush(): void {}

  close(): void {
    this.closed = true;
  }
}

class MemorySyncFile implements FileHandleLike {
  readonly sync = new MemorySyncHandle();

  async getFile(): Promise<Blob> {
    return new Blob([this.sync.bytes]);
  }

  async createWritable(): Promise<WritableFileStreamLike> {
    throw new Error('not used');
  }

  async createSyncAccessHandle(): Promise<SyncAccessHandleLike> {
    return this.sync;
  }
}

class MemorySyncDirectory implements DirectoryHandleLike {
  readonly files = new Map<string, MemorySyncFile>();

  async getDirectoryHandle(): Promise<DirectoryHandleLike> {
    throw new Error('not used');
  }

  async getFileHandle(name: string, options?: { create?: boolean }): Promise<FileHandleLike> {
    const existing = this.files.get(name);
    if (existing) return existing;
    if (options?.create !== true) throw new DOMException('missing', 'NotFoundError');
    const created = new MemorySyncFile();
    this.files.set(name, created);
    return created;
  }
}

describe('FileSystemSyncAccessHandle layer', () => {
  it('supports replace, read, append, flush and idempotent close', async () => {
    const directory = new MemorySyncDirectory();
    const file = await openSyncAccessFile(directory, 'journal.bin');
    file.replace(new TextEncoder().encode('abc'));
    const offset = file.append(new TextEncoder().encode('def'));

    expect(offset).toBe(3);
    expect(new TextDecoder().decode(file.readAll())).toBe('abcdef');
    file.flush();
    file.close();
    file.close();
  });

  it('probes a sync-access capable OPFS directory without retaining probe data', async () => {
    const directory = new MemorySyncDirectory();
    await expect(probeSyncAccessHandle(directory)).resolves.toBe(true);
    expect(directory.files.get('sync-access.probe')?.sync.bytes.byteLength).toBe(0);
    expect(directory.files.get('sync-access.probe')?.sync.closed).toBe(true);
  });
});
