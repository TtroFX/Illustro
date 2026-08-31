import { describe, expect, it } from 'vitest';
import { RendererTileStateV1 } from '../../src/gpu/renderer-tile-state.js';
import { MEBIBYTE } from '../../src/gpu/tile-cache.js';

function gpuDeviceHarness() {
  const descriptors: Array<{
    readonly label: string;
    readonly size: { readonly width: number; readonly height: number; readonly depthOrArrayLayers: number };
    readonly format: string;
    readonly usage: number;
  }> = [];
  let destroyed = 0;
  const device = {
    lost: new Promise<never>(() => undefined),
    createShaderModule() {
      return {};
    },
    createTexture(descriptor: (typeof descriptors)[number]) {
      descriptors.push(descriptor);
      return {
        destroy() {
          destroyed += 1;
        },
      };
    },
  };
  return {
    device,
    descriptors,
    destroyed: () => destroyed,
  };
}

describe('M3 production renderer sparse tile state', () => {
  it('starts empty with frozen Conservative GPU/CPU cache budgets', () => {
    const state = new RendererTileStateV1(513, 300);
    expect(state.snapshot()).toMatchObject({
      schema: 'illustro.renderer-tile-state/1',
      documentWidth: 513,
      documentHeight: 300,
      grid: { columns: 3, rows: 2 },
      allocatedTileCount: 0,
      dirtyTileCount: 0,
      cacheProfile: 'conservative',
      gpuCache: { budgetBytes: 128 * MEBIBYTE, residentBytes: 0, entryCount: 0 },
      cpuCache: { budgetBytes: 192 * MEBIBYTE, residentBytes: 0, entryCount: 0 },
      atlas: { pageCount: 0, residentBytes: 0 },
    });

    const tile = state.allocate({ tx: 2, ty: 1 });
    expect(tile.bounds).toMatchObject({ validWidth: 1, validHeight: 44 });
    expect(tile.value).toEqual({ schema: 'illustro.renderer-logical-tile/1', revision: 0 });
    expect(state.snapshot().allocatedTileCount).toBe(1);
  });

  it('requires sparse allocation before tracking mutation dirtiness', () => {
    const state = new RendererTileStateV1(512, 512);
    expect(() =>
      state.markDirty({ tx: 0, ty: 0 }, { x: 0, y: 0, width: 32, height: 32 }),
    ).toThrow('allocate it first');

    state.allocate({ tx: 0, ty: 0 });
    expect(state.markDirty({ tx: 0, ty: 0 }, { x: 0, y: 0, width: 128, height: 256 })).toEqual({
      coordinate: { tx: 0, ty: 0 },
      region: { kind: 'whole' },
    });
  });

  it('backs GPU tile residency with a real 2048px WebGPU atlas texture', () => {
    const harness = gpuDeviceHarness();
    const state = new RendererTileStateV1(512, 512);
    state.allocate({ tx: 0, ty: 0 });
    state.attachGpuDevice(harness.device);

    const slot = state.reserveGpuTile({ tx: 0, ty: 0 }, 'rgba8-unorm', 'visible');
    expect(slot).toMatchObject({ pageId: 'atlas-1', slotIndex: 0, x: 0, y: 0 });
    expect(harness.descriptors).toEqual([
      {
        label: 'illustro-tile-atlas-1',
        size: { width: 2_048, height: 2_048, depthOrArrayLayers: 1 },
        format: 'rgba8unorm',
        usage: 31,
      },
    ]);
    expect(state.snapshot()).toMatchObject({
      gpuCache: { residentBytes: 256 * 256 * 4, entryCount: 1 },
      atlas: { pageCount: 1, residentBytes: 16 * MEBIBYTE },
    });
  });

  it('preserves canonical/CPU state while discarding stale GPU residency across device loss', () => {
    const harness = gpuDeviceHarness();
    const state = new RendererTileStateV1(512, 512);
    state.allocate({ tx: 1, ty: 1 });
    const source = new Uint8Array([1, 2, 3]);
    state.cacheCpuBacking({ tx: 1, ty: 1 }, source, 'visible');
    source[0] = 99;
    state.attachGpuDevice(harness.device);
    state.reserveGpuTile({ tx: 1, ty: 1 }, 'rgba8-unorm', 'visible');

    state.attachGpuDevice(null);
    expect(state.getTile({ tx: 1, ty: 1 })).not.toBeNull();
    expect([...state.getCpuBacking({ tx: 1, ty: 1 })!]).toEqual([1, 2, 3]);
    expect(state.getGpuSlot({ tx: 1, ty: 1 })).toBeNull();
    expect(state.snapshot()).toMatchObject({
      allocatedTileCount: 1,
      gpuCache: { residentBytes: 0, entryCount: 0 },
      cpuCache: { residentBytes: 3, entryCount: 1 },
      atlas: { pageCount: 0, residentBytes: 0 },
    });
    expect(harness.destroyed()).toBe(1);
  });

  it('clears cache residency and dirty state when a sparse tile is deallocated', () => {
    const harness = gpuDeviceHarness();
    const state = new RendererTileStateV1(512, 512);
    state.allocate({ tx: 1, ty: 1 });
    state.markDirty({ tx: 1, ty: 1 }, { x: 4, y: 5, width: 6, height: 7 });
    state.cacheCpuBacking({ tx: 1, ty: 1 }, new Uint8Array([7]));
    state.attachGpuDevice(harness.device);
    state.reserveGpuTile({ tx: 1, ty: 1 }, 'rgba8-unorm');

    expect(state.deallocate({ tx: 1, ty: 1 })).toBe(true);
    expect(state.getTile({ tx: 1, ty: 1 })).toBeNull();
    expect(state.getDirty({ tx: 1, ty: 1 })).toBeNull();
    expect(state.snapshot()).toMatchObject({
      allocatedTileCount: 0,
      dirtyTileCount: 0,
      gpuCache: { entryCount: 0 },
      cpuCache: { entryCount: 0 },
      atlas: { pageCount: 0 },
    });
  });

  it('resolves fractional viewport movement to visible tile coordinates only', () => {
    const state = new RendererTileStateV1(768, 512);
    expect(
      state.resolveViewport({ x: 255.5, y: 10.25, width: 2, height: 20 }).visible,
    ).toEqual([
      { tx: 0, ty: 0 },
      { tx: 1, ty: 0 },
    ]);
  });
});
