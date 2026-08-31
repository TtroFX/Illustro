import { describe, expect, it } from 'vitest';
import { RendererTileStateV1 } from '../../src/gpu/renderer-tile-state.js';

function transferDeviceHarness(readbackBytes: readonly number[]) {
  const writes: unknown[][] = [];
  const copies: unknown[][] = [];
  const mapped = new Uint8Array(256);
  mapped.set(readbackBytes, 0);
  const texture = {};
  const device = {
    lost: new Promise<never>(() => undefined),
    createShaderModule() {
      return {};
    },
    createTexture() {
      return texture;
    },
    queue: {
      writeTexture(...args: unknown[]) {
        writes.push(args);
      },
      submit() {},
    },
    createBuffer() {
      return {
        async mapAsync() {},
        getMappedRange() {
          return mapped.buffer;
        },
        unmap() {},
        destroy() {},
      };
    },
    createCommandEncoder() {
      return {
        copyTextureToBuffer(...args: unknown[]) {
          copies.push(args);
        },
        finish() {
          return {};
        },
      };
    },
  };
  return { device, writes, copies, texture };
}

describe('M3 renderer tile upload/readback production path', () => {
  it('uploads cached CPU edge bytes into the real atlas resource', () => {
    const harness = transferDeviceHarness([9, 8, 7, 6]);
    const state = new RendererTileStateV1(257, 1);
    state.allocate({ tx: 1, ty: 0 });
    state.cacheCpuBacking({ tx: 1, ty: 0 }, new Uint8Array([1, 2, 3, 4]), 'visible');
    state.attachGpuDevice(harness.device);

    const transfer = state.uploadCpuBackingToGpu({ tx: 1, ty: 0 }, 'rgba8-unorm', 'visible');
    expect(transfer).toMatchObject({ width: 1, height: 1, bytesTransferred: 4, bytesPerRow: 4 });
    expect(harness.writes).toHaveLength(1);
    expect(harness.writes[0]?.[0]).toMatchObject({
      texture: harness.texture,
      origin: { x: 0, y: 0, z: 0 },
    });
  });

  it('reads GPU edge pixels back into owned CPU backing bytes', async () => {
    const harness = transferDeviceHarness([9, 8, 7, 6]);
    const state = new RendererTileStateV1(257, 1);
    state.allocate({ tx: 1, ty: 0 });
    state.cacheCpuBacking({ tx: 1, ty: 0 }, new Uint8Array([1, 2, 3, 4]), 'visible');
    state.attachGpuDevice(harness.device);
    state.uploadCpuBackingToGpu({ tx: 1, ty: 0 }, 'rgba8-unorm', 'visible');

    const transfer = await state.readbackGpuToCpu({ tx: 1, ty: 0 }, 'visible');
    expect(transfer).toMatchObject({
      width: 1,
      height: 1,
      bytesTransferred: 4,
      stagingBytesPerRow: 256,
    });
    expect(harness.copies).toHaveLength(1);
    const backing = state.getCpuBacking({ tx: 1, ty: 0 });
    expect(backing).not.toBeNull();
    expect(backing === null ? [] : [...backing]).toEqual([9, 8, 7, 6]);
  });
});
