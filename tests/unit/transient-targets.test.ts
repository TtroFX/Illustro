import { describe, expect, it } from 'vitest';
import {
  MAX_DIRECT_TILE_HALO_PX,
  TransientTargetManagerV1,
} from '../../src/gpu/transient-targets.js';

describe('M3 transient halo/filter target management', () => {
  it('allows direct tile halos through 64px and destroys released derived targets', () => {
    const destroyed: string[] = [];
    const manager = new TransientTargetManagerV1({
      create: (descriptor) => ({ id: descriptor.targetId }),
      destroy: (resource) => destroyed.push(resource.id),
    });
    const target = manager.acquire({
      kind: 'filter-halo',
      strategy: 'direct-tile',
      pixelFormat: 'rgba8-unorm',
      coreWidth: 256,
      coreHeight: 256,
      haloPx: MAX_DIRECT_TILE_HALO_PX,
    });
    expect(target.descriptor).toMatchObject({ width: 384, height: 384 });
    expect(manager.snapshot()).toMatchObject({ activeCount: 1, residentBytes: 384 * 384 * 4 });
    expect(manager.release(target.descriptor.targetId)).toBe(true);
    expect(destroyed).toEqual([target.descriptor.targetId]);
    expect(manager.snapshot()).toMatchObject({ activeCount: 0, residentBytes: 0 });
  });

  it('rejects direct halos wider than 64px instead of clipping them', () => {
    const manager = new TransientTargetManagerV1({ create: () => ({}) });
    expect(() =>
      manager.acquire({
        kind: 'filter-halo',
        strategy: 'direct-tile',
        pixelFormat: 'rgba16-float',
        coreWidth: 256,
        coreHeight: 256,
        haloPx: 65,
      }),
    ).toThrow('use an expanded/separable/multiscale planner path');
  });

  it('permits wider support only through an explicit non-direct planner strategy', () => {
    const manager = new TransientTargetManagerV1({ create: () => ({}) });
    const target = manager.acquire({
      kind: 'filter-halo',
      strategy: 'expanded-region',
      pixelFormat: 'rgba16-float',
      coreWidth: 512,
      coreHeight: 256,
      haloPx: 128,
    });
    expect(target.descriptor).toMatchObject({ width: 768, height: 512 });
  });
});
