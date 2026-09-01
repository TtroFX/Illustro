import { describe, expect, it } from 'vitest';
import { resolveViewportTilesV1 } from '../../src/gpu/viewport-tiles.js';

describe('M3 viewport tile visibility resolver', () => {
  it('resolves fractional document-space viewport bounds without rerasterization semantics', () => {
    const result = resolveViewportTilesV1(513, 300, {
      x: 250.5,
      y: 250.5,
      width: 20,
      height: 20,
    });
    expect(result.visible).toEqual([
      { tx: 1, ty: 1 },
      { tx: 2, ty: 1 },
      { tx: 1, ty: 2 },
      { tx: 2, ty: 2 },
    ]);
  });

  it('clips viewport bounds to the document and returns canonical edge bounds', () => {
    const result = resolveViewportTilesV1(513, 300, {
      x: 512.25,
      y: 280,
      width: 20,
      height: 100,
    });
    expect(result.visible).toEqual([{ tx: 4, ty: 2 }]);
    expect(result.bounds[0]).toMatchObject({
      x: 512,
      y: 256,
      validWidth: 1,
      validHeight: 44,
    });
  });

  it('does not include the preceding tile when the viewport starts on an exact tile boundary', () => {
    const result = resolveViewportTilesV1(768, 256, {
      x: 256,
      y: 0,
      width: 128,
      height: 128,
    });
    expect(result.visible).toEqual([{ tx: 2, ty: 0 }]);
  });

  it('returns no tiles for a viewport entirely outside the document', () => {
    const result = resolveViewportTilesV1(512, 512, {
      x: -100,
      y: -100,
      width: 20,
      height: 20,
    });
    expect(result.visible).toEqual([]);
    expect(result.bounds).toEqual([]);
  });
});
