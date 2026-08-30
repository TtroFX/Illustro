import { isSha256Hex } from '../domain/resources.js';
import type { DirectoryHandleLike } from './opfs-layout.js';

export interface ImmutableObjectRefV1 {
  readonly algorithm: 'sha256';
  readonly hash: string;
  readonly byteLength: number;
}

export interface ImmutableObjectWriteResultV1 extends ImmutableObjectRefV1 {
  readonly created: boolean;
}

async function sha256Hex(data: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function normalizeBytes(data: Uint8Array | ArrayBuffer): Uint8Array {
  return data instanceof Uint8Array ? data : new Uint8Array(data);
}

export function immutableObjectPath(hash: string): readonly [string, string] {
  if (!isSha256Hex(hash)) throw new TypeError('object hash must be lowercase SHA-256 hex');
  return Object.freeze([hash.slice(0, 2), hash]);
}

async function readExistingObject(
  root: DirectoryHandleLike,
  hash: string,
): Promise<Uint8Array | null> {
  const [shard, filename] = immutableObjectPath(hash);
  try {
    const shardDirectory = await root.getDirectoryHandle(shard);
    const handle = await shardDirectory.getFileHandle(filename);
    const file = await handle.getFile();
    return new Uint8Array(await file.arrayBuffer());
  } catch (error) {
    if (error instanceof DOMException && error.name === 'NotFoundError') return null;
    throw error;
  }
}

export async function putImmutableObject(
  root: DirectoryHandleLike,
  data: Uint8Array | ArrayBuffer,
): Promise<ImmutableObjectWriteResultV1> {
  const bytes = normalizeBytes(data);
  const hash = await sha256Hex(bytes);
  const existing = await readExistingObject(root, hash);
  if (existing !== null) {
    const existingHash = await sha256Hex(existing);
    if (existingHash !== hash) throw new Error('content-addressed object failed integrity verification');
    return Object.freeze({ algorithm: 'sha256', hash, byteLength: existing.byteLength, created: false });
  }

  const [shard, filename] = immutableObjectPath(hash);
  const shardDirectory = await root.getDirectoryHandle(shard, { create: true });
  const handle = await shardDirectory.getFileHandle(filename, { create: true });
  const writable = await handle.createWritable({ keepExistingData: false });
  try {
    await writable.write(bytes);
    await writable.close();
  } catch (error) {
    await writable.abort?.(error);
    throw error;
  }

  return Object.freeze({ algorithm: 'sha256', hash, byteLength: bytes.byteLength, created: true });
}

export async function readImmutableObject(
  root: DirectoryHandleLike,
  hash: string,
): Promise<Uint8Array> {
  const bytes = await readExistingObject(root, hash);
  if (bytes === null) throw new Error(`immutable object not found: ${hash}`);
  const actualHash = await sha256Hex(bytes);
  if (actualHash !== hash) throw new Error('content-addressed object failed integrity verification');
  return bytes;
}
