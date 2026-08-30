import { describe, expect, it } from 'vitest';
import { readImmutableObject } from '../../src/storage/immutable-object-store.js';
import { compressLz4Block, decompressLz4Block } from '../../src/storage/lz4-block.js';
import {
  openIllustroOpfsRoot,
  type DirectoryHandleLike,
  type FileHandleLike,
  type StorageManagerLike,
  type WritableFileStreamLike,
} from '../../src/storage/opfs-layout.js';
import {
  decodeTile,
  encodeMaskTile,
  encodeRasterTileAuto,
  encodeRasterTileLz4,
  encodeRasterTileRaw,
  persistMaskTile,
} from '../../src/storage/tile-codec.js';

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

function pseudoRandomBytes(length: number): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(length);
  let state = 0x1234_5678;
  for (let index = 0; index < bytes.byteLength; index += 1) {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    bytes[index] = state & 0xff;
  }
  return bytes;
}

describe('LZ4 block codec', () => {
  it('round-trips compressible data with a compact standard block', () => {
    const source = new Uint8Array(16_384);
    for (let index = 0; index < source.byteLength; index += 4) {
      source[index] = 12;
      source[index + 1] = 34;
      source[index + 2] = 56;
      source[index + 3] = 255;
    }
    const compressed = compressLz4Block(source);
    expect(compressed.byteLength).toBeLessThan(source.byteLength / 4);
    expect(decompressLz4Block(compressed, source.byteLength)).toEqual(source);
  });

  it('round-trips high-entropy data and rejects invalid offsets', () => {
    const source = pseudoRandomBytes(8_192);
    const compressed = compressLz4Block(source);
    expect(decompressLz4Block(compressed, source.byteLength)).toEqual(source);
    expect(() => decompressLz4Block(new Uint8Array([0x00, 0x00, 0x00]), 4)).toThrow(
      'invalid LZ4 match offset',
    );
  });
});

describe('raster and mask tile persistence codecs', () => {
  it('encodes raw RGBA8 tiles with stable metadata and exact round-trip', () => {
    const source = pseudoRandomBytes(16 * 16 * 4);
    const encoded = encodeRasterTileRaw({
      width: 16,
      height: 16,
      pixelFormat: 'rgba8-unorm',
      bytes: source,
    });
    expect(encoded.codec).toBe('raw');
    const decoded = decodeTile(encoded.bytes);
    expect(decoded).toMatchObject({ width: 16, height: 16, pixelFormat: 'rgba8-unorm', codec: 'raw' });
    expect(decoded.bytes).toEqual(source);
  });

  it('encodes RGBA16F tiles through LZ4 and preserves their byte representation', () => {
    const source = new Uint8Array(8 * 8 * 8);
    source.fill(0x3c);
    const encoded = encodeRasterTileLz4({
      width: 8,
      height: 8,
      pixelFormat: 'rgba16-float',
      bytes: source,
    });
    expect(encoded.codec).toBe('lz4-block');
    const decoded = decodeTile(encoded.bytes);
    expect(decoded.pixelFormat).toBe('rgba16-float');
    expect(decoded.bytes).toEqual(source);
  });

  it('selects LZ4 only when it clears the configured savings threshold', () => {
    const compressible = new Uint8Array(64 * 64 * 4);
    const compressed = encodeRasterTileAuto({
      width: 64,
      height: 64,
      pixelFormat: 'rgba8-unorm',
      bytes: compressible,
    });
    expect(compressed.codec).toBe('lz4-block');

    const noisy = pseudoRandomBytes(32 * 32 * 4);
    const raw = encodeRasterTileAuto({
      width: 32,
      height: 32,
      pixelFormat: 'rgba8-unorm',
      bytes: noisy,
    });
    expect(raw.codec).toBe('raw');
    expect(decodeTile(raw.bytes).bytes).toEqual(noisy);
  });

  it('persists masks as single-channel content-addressed tiles', async () => {
    const root = await openIllustroOpfsRoot(new MemoryStorageManager());
    const mask = new Uint8Array(32 * 32);
    mask.fill(255);
    const encoded = encodeMaskTile({
      width: 32,
      height: 32,
      pixelFormat: 'r8-unorm',
      bytes: mask,
    });
    expect(decodeTile(encoded.bytes).pixelFormat).toBe('r8-unorm');

    const persisted = await persistMaskTile(root, {
      width: 32,
      height: 32,
      pixelFormat: 'r8-unorm',
      bytes: mask,
    });
    expect(persisted.pixelFormat).toBe('r8-unorm');
    expect(persisted.object.hash).toMatch(/^[0-9a-f]{64}$/);
    const stored = await readImmutableObject(root.sha256Objects, persisted.object.hash);
    const decoded = decodeTile(stored);
    expect(decoded.pixelFormat).toBe('r8-unorm');
    expect(decoded.bytes.byteLength).toBe(mask.byteLength);
    expect(decoded.bytes).toEqual(mask);
  });
});
