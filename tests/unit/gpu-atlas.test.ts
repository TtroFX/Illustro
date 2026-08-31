import { describe, expect, it } from 'vitest';
import {
  GPU_ATLAS_PAGE_SIZE_PX,
  GPU_ATLAS_SLOTS_PER_AXIS,
  GPU_ATLAS_SLOTS_PER_PAGE,
  GpuAtlasPageManagerV1,
} from '../../src/gpu/gpu-atlas.js';
import { MEBIBYTE } from '../../src/gpu/tile-cache.js';

describe('M3 GPU atlas page management', () => {
  it('uses the frozen 2048px page with an 8x8 grid of 256px slots', () => {
    expect(GPU_ATLAS_PAGE_SIZE_PX).toBe(2_048);
    expect(GPU_ATLAS_SLOTS_PER_AXIS).toBe(8);
    expect(GPU_ATLAS_SLOTS_PER_PAGE).toBe(64);
  });

  it('allocates slots incrementally and opens a second page only after 64 residents', () => {
    const created: string[] = [];
    const destroyed: string[] = [];
    const atlas = new GpuAtlasPageManagerV1({
      create(descriptor) {
        created.push(descriptor.pageId);
        return { pageId: descriptor.pageId };
      },
      destroy(resource) {
        destroyed.push(resource.pageId);
      },
    });

    const slots = Array.from({ length: 65 }, (_, index) =>
      atlas.allocate(`tile-${index}`, 'rgba8-unorm'),
    );
    expect(created).toEqual(['atlas-1', 'atlas-2']);
    expect(slots[0]).toMatchObject({ pageId: 'atlas-1', slotIndex: 0, x: 0, y: 0 });
    expect(slots[63]).toMatchObject({
      pageId: 'atlas-1',
      slotIndex: 63,
      x: 1_792,
      y: 1_792,
    });
    expect(slots[64]).toMatchObject({ pageId: 'atlas-2', slotIndex: 0, x: 0, y: 0 });
    expect(atlas.snapshot()).toMatchObject({
      pageCount: 2,
      residentBytes: 32 * MEBIBYTE,
    });

    for (let index = 0; index < 64; index += 1) atlas.release(`tile-${index}`);
    expect(destroyed).toEqual(['atlas-1']);
    expect(atlas.snapshot()).toMatchObject({ pageCount: 1, residentBytes: 16 * MEBIBYTE });
  });

  it('keeps RGBA8 and RGBA16F residents on format-compatible pages', () => {
    const atlas = new GpuAtlasPageManagerV1({
      create(descriptor) {
        return { pageId: descriptor.pageId };
      },
    });
    const rgba8 = atlas.allocate('rgba8', 'rgba8-unorm');
    const rgba16 = atlas.allocate('rgba16', 'rgba16-float');
    expect(rgba8.pageId).not.toBe(rgba16.pageId);
    expect(atlas.snapshot()).toMatchObject({
      pageCount: 2,
      residentBytes: 48 * MEBIBYTE,
    });
  });
});
