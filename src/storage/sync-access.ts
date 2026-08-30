import type { DirectoryHandleLike } from './opfs-layout.js';

export interface SyncAccessHandleLike {
  read(buffer: Uint8Array<ArrayBuffer>, options?: { at?: number }): number;
  write(buffer: Uint8Array<ArrayBuffer>, options?: { at?: number }): number;
  truncate(newSize: number): void;
  getSize(): number;
  flush(): void;
  close(): void;
}

export interface SyncAccessFileV1 {
  readonly filename: string;
  readAll(): Uint8Array<ArrayBuffer>;
  replace(data: Uint8Array | ArrayBuffer): void;
  append(data: Uint8Array | ArrayBuffer): number;
  flush(): void;
  close(): void;
}

function ownedBytes(data: Uint8Array | ArrayBuffer): Uint8Array<ArrayBuffer> {
  if (data instanceof ArrayBuffer) return new Uint8Array(data.slice(0));
  const copy = new Uint8Array(data.byteLength);
  copy.set(data);
  return copy;
}

export async function openSyncAccessFile(
  directory: DirectoryHandleLike,
  filename: string,
): Promise<SyncAccessFileV1> {
  if (filename.length === 0 || filename.includes('/') || filename.includes('\\')) {
    throw new TypeError('sync access filename must be a single non-empty path segment');
  }
  const file = await directory.getFileHandle(filename, { create: true });
  if (typeof file.createSyncAccessHandle !== 'function') {
    throw new Error('FileSystemSyncAccessHandle is unavailable in this runtime');
  }
  const handle = await file.createSyncAccessHandle();
  let closed = false;

  const assertOpen = (): void => {
    if (closed) throw new Error('sync access file is closed');
  };

  return Object.freeze({
    filename,
    readAll(): Uint8Array<ArrayBuffer> {
      assertOpen();
      const size = handle.getSize();
      if (!Number.isSafeInteger(size) || size < 0) throw new Error('invalid sync access file size');
      const bytes = new Uint8Array(size);
      const count = handle.read(bytes, { at: 0 });
      if (count !== size) throw new Error('short read from sync access file');
      return bytes;
    },
    replace(data: Uint8Array | ArrayBuffer): void {
      assertOpen();
      const bytes = ownedBytes(data);
      handle.truncate(0);
      const written = handle.write(bytes, { at: 0 });
      if (written !== bytes.byteLength) throw new Error('short write to sync access file');
      handle.truncate(bytes.byteLength);
      handle.flush();
    },
    append(data: Uint8Array | ArrayBuffer): number {
      assertOpen();
      const bytes = ownedBytes(data);
      const offset = handle.getSize();
      const written = handle.write(bytes, { at: offset });
      if (written !== bytes.byteLength) throw new Error('short append to sync access file');
      handle.flush();
      return offset;
    },
    flush(): void {
      assertOpen();
      handle.flush();
    },
    close(): void {
      if (closed) return;
      handle.close();
      closed = true;
    },
  });
}

export async function probeSyncAccessHandle(directory: DirectoryHandleLike): Promise<boolean> {
  const marker = new TextEncoder().encode('illustro-sync-access-probe');
  let file: SyncAccessFileV1 | null = null;
  try {
    file = await openSyncAccessFile(directory, 'sync-access.probe');
    file.replace(marker);
    const observed = file.readAll();
    if (observed.byteLength !== marker.byteLength) return false;
    for (let index = 0; index < marker.byteLength; index += 1) {
      if (observed[index] !== marker[index]) return false;
    }
    file.replace(new Uint8Array());
    return true;
  } catch {
    return false;
  } finally {
    file?.close();
  }
}
