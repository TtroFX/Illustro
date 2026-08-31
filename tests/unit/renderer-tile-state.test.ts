import { describe, expect, it } from 'vitest';
import { RendererTileStateV1 } from '../../src/gpu/renderer-tile-state.js';

describe('M3 production renderer sparse tile state', () => {
  it('starts empty, allocates on demand, and exposes canonical edge bounds', () => {
    const state = new RendererTileStateV1(513, 300);
    expect(state.snapshot()).toEqual({
      schema: 'illustro.renderer-tile-state/1',
      documentWidth: 513,
      documentHeight: 300,
      grid: { columns: 3, rows: 2 },
      allocatedTileCount: 0,
      dirtyTileCount: 0,
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
    expect(
      state.markDirty({ tx: 0, ty: 0 }, { x: 0, y: 0, width: 128, height: 256 }),
    ).toEqual({ coordinate: { tx: 0, ty: 0 }, region: { kind: 'whole' } });
    expect(state.snapshot().dirtyTileCount).toBe(1);
  });

  it('clears dirty state when a sparse tile is deallocated', () => {
    const state = new RendererTileStateV1(512, 512);
    state.allocate({ tx: 1, ty: 1 });
    state.markDirty({ tx: 1, ty: 1 }, { x: 4, y: 5, width: 6, height: 7 });
    expect(state.deallocate({ tx: 1, ty: 1 })).toBe(true);
    expect(state.getTile({ tx: 1, ty: 1 })).toBeNull();
    expect(state.getDirty({ tx: 1, ty: 1 })).toBeNull();
    expect(state.snapshot()).toMatchObject({ allocatedTileCount: 0, dirtyTileCount: 0 });
  });
});
