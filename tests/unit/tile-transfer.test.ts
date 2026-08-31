import { describe, expect, it } from 'vitest';
import type { GpuAtlasSlotV1 } from '../../src/gpu/gpu-atlas.js';
import type { TileBoundsV1 } from '../../src/gpu/sparse-tile-model.js';
import {
  alignGpuBytesPerRowV1,
  readbackTileFromAtlasV1,
  type TileTransferGpuDeviceV1,
  uploadTileToAtlasV1,
} from '../../src/gpu/tile-transfer.js';

const slot: GpuAtlasSlotV1 = Object.freeze({
  pageId: 'atlas-1',
  slotIndex: 9,
  x: 256,
  y: 256,
  width: 256,
  height: 256,
  pixelFormat: 'rgba8-unorm',
});

function bounds(validWidth: number, validHeight: number): TileBoundsV1 {
  return Object.freeze({
    coordinate: { tx: 2, ty: 1 },
    x: 512,
    y: 256,
    width: validWidth,
    height: validHeight,
    validWidth,
    validHeight,
  });
}

describe('M3 tile GPU transfer foundation', () => {
  it('uploads only valid edge pixels into the assigned atlas slot', () => {
    const calls: unknown[][] = [];
    const device = {
      queue: {
        writeTexture(...args: unknown[]) {
          calls.push(args);
        },
        submit() {},
      },
      createBuffer() {
        throw new Error('unused');
      },
      createCommandEncoder() {
        throw new Error('unused');
      },
    } as unknown as TileTransferGpuDeviceV1;
    const bytes = new Uint8Array(1 * 44 * 4);
    const result = uploadTileToAtlasV1(device, {}, slot, bounds(1, 44), bytes);
    expect(result).toEqual({
      schema: 'illustro.tile-upload/1',
      width: 1,
      height: 44,
      bytesTransferred: 176,
      bytesPerRow: 4,
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.[0]).toEqual({ texture: {}, origin: { x: 256, y: 256, z: 0 } });
    expect(calls[0]?.[2]).toEqual({ offset: 0, bytesPerRow: 4, rowsPerImage: 44 });
    expect(calls[0]?.[3]).toEqual({ width: 1, height: 44, depthOrArrayLayers: 1 });
  });

  it('rejects upload payloads that do not match edge valid bounds', () => {
    const device = {
      queue: { writeTexture() {}, submit() {} },
      createBuffer() {
        throw new Error('unused');
      },
      createCommandEncoder() {
        throw new Error('unused');
      },
    } as unknown as TileTransferGpuDeviceV1;
    expect(() => uploadTileToAtlasV1(device, {}, slot, bounds(2, 2), new Uint8Array(15))).toThrow(
      'expected 16',
    );
  });

  it('aligns texture-to-buffer readback rows to 256 bytes and strips staging padding', async () => {
    const mapped = new Uint8Array(512);
    mapped.set(Array.from({ length: 12 }, (_, index) => index + 1), 0);
    mapped.set(Array.from({ length: 12 }, (_, index) => index + 21), 256);
    let createdBuffer: unknown = null;
    let copied: unknown[] | null = null;
    let submitted = 0;
    let unmapped = 0;
    let destroyed = 0;
    const buffer = {
      async mapAsync(mode: number) {
        expect(mode).toBe(1);
      },
      getMappedRange() {
        return mapped.buffer;
      },
      unmap() {
        unmapped += 1;
      },
      destroy() {
        destroyed += 1;
      },
    };
    const device: TileTransferGpuDeviceV1 = {
      queue: {
        writeTexture() {},
        submit(commandBuffers) {
          submitted += commandBuffers.length;
        },
      },
      createBuffer(descriptor) {
        createdBuffer = descriptor;
        return buffer;
      },
      createCommandEncoder() {
        return {
          copyTextureToBuffer(...args) {
            copied = args;
          },
          finish() {
            return {};
          },
        };
      },
    };
    const result = await readbackTileFromAtlasV1(device, {}, slot, bounds(3, 2));
    expect(alignGpuBytesPerRowV1(12)).toBe(256);
    expect(createdBuffer).toEqual({
      label: 'illustro-tile-readback-2-1',
      size: 512,
      usage: 9,
    });
    expect(copied?.[1]).toMatchObject({ offset: 0, bytesPerRow: 256, rowsPerImage: 2 });
    expect(submitted).toBe(1);
    expect(unmapped).toBe(1);
    expect(destroyed).toBe(1);
    expect(result).toMatchObject({
      schema: 'illustro.tile-readback/1',
      width: 3,
      height: 2,
      bytesTransferred: 24,
      bytesPerRow: 12,
      stagingBytesPerRow: 256,
    });
    expect([...result.bytes]).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32,
    ]);
  });

  it('keeps already-aligned full RGBA16F rows unchanged', () => {
    expect(alignGpuBytesPerRowV1(256 * 8)).toBe(2_048);
  });
});
