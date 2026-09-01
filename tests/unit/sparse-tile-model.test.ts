import { describe, expect, it } from 'vitest';
import {
  addressDocumentPixelV1,
  CANONICAL_TILE_AREA_PX,
  CANONICAL_TILE_SIZE_PX,
  DirtyTileTrackerV1,
  SparseTileMapV1,
  tileBoundsForDocumentV1,
  tileGridForDocumentV1,
  tileKeyV1,
  WHOLE_TILE_DIRTY_PROMOTION_RATIO,
} from '../../src/gpu/sparse-tile-model.js';

describe('M3 canonical sparse tile geometry', () => {
  it('fixes canonical tile core geometry to 128 pixels', () => {
    expect(CANONICAL_TILE_SIZE_PX).toBe(128);
    expect(CANONICAL_TILE_AREA_PX).toBe(16_384);
    expect(WHOLE_TILE_DIRTY_PROMOTION_RATIO).toBe(0.5);
    expect(tileGridForDocumentV1(513, 300)).toEqual({ columns: 5, rows: 3 });
  });

  it('keeps edge tiles on the same grid while clipping valid bounds', () => {
    expect(tileBoundsForDocumentV1(513, 300, { tx: 4, ty: 2 })).toEqual({
      coordinate: { tx: 4, ty: 2 },
      x: 512,
      y: 256,
      width: 1,
      height: 44,
      validWidth: 1,
      validHeight: 44,
    });
    expect(() => tileBoundsForDocumentV1(513, 300, { tx: 5, ty: 0 })).toThrow(
      'outside document tile grid',
    );
  });

  it('maps document pixels to integer tile and local coordinates', () => {
    expect(addressDocumentPixelV1(513, 300, { x: 0, y: 0 })).toEqual({
      coordinate: { tx: 0, ty: 0 },
      localX: 0,
      localY: 0,
    });
    expect(addressDocumentPixelV1(513, 300, { x: 512, y: 299 })).toEqual({
      coordinate: { tx: 4, ty: 2 },
      localX: 0,
      localY: 43,
    });
    expect(() => addressDocumentPixelV1(513, 300, { x: 513, y: 0 })).toThrow(
      'outside document bounds',
    );
    expect(tileKeyV1({ tx: 12, ty: 34 })).toBe('12:34');
  });
});

describe('M3 per-tile dirty tracking', () => {
  it('retains a compact dirty rectangle below the 50% core threshold', () => {
    const tracker = new DirtyTileTrackerV1(512, 512);
    const state = tracker.markRect({ tx: 0, ty: 0 }, { x: 0, y: 0, width: 63, height: 128 });
    expect(state).toEqual({
      coordinate: { tx: 0, ty: 0 },
      region: { kind: 'rect', rect: { x: 0, y: 0, width: 63, height: 128 } },
    });
  });

  it('unions dirty rectangles and promotes at exactly 50% of a 128px tile core', () => {
    const tracker = new DirtyTileTrackerV1(512, 512);
    tracker.markRect({ tx: 0, ty: 0 }, { x: 0, y: 0, width: 32, height: 128 });
    const state = tracker.markRect({ tx: 0, ty: 0 }, { x: 32, y: 0, width: 32, height: 128 });
    expect(state).toEqual({ coordinate: { tx: 0, ty: 0 }, region: { kind: 'whole' } });
  });

  it('clips dirty rectangles to valid edge bounds and treats a fully covered edge tile as whole', () => {
    const tracker = new DirtyTileTrackerV1(150, 140);
    const state = tracker.markRect({ tx: 1, ty: 1 }, { x: 0, y: 0, width: 128, height: 128 });
    expect(state).toEqual({ coordinate: { tx: 1, ty: 1 }, region: { kind: 'whole' } });
    expect(tracker.size).toBe(1);
    expect(tracker.clear({ tx: 1, ty: 1 })).toBe(true);
    expect(tracker.size).toBe(0);
  });
});

describe('M3 sparse tile allocation lifecycle', () => {
  it('allocates no document tiles eagerly and creates only addressed tiles', () => {
    const tiles = new SparseTileMapV1<{ readonly token: string }>(16_384, 16_384);
    expect(tiles.size).toBe(0);

    const first = tiles.allocate({ tx: 127, ty: 127 }, (bounds) => ({
      token: `${bounds.validWidth}x${bounds.validHeight}`,
    }));
    expect(tiles.size).toBe(1);
    expect(first.value.token).toBe('128x128');

    const same = tiles.allocate({ tx: 127, ty: 127 }, () => ({ token: 'must-not-replace' }));
    expect(same).toBe(first);
    expect(tiles.size).toBe(1);
  });

  it('deallocates individual sparse tiles without materializing absent content', () => {
    const tiles = new SparseTileMapV1<number>(513, 300);
    tiles.allocate({ tx: 4, ty: 2 }, (bounds) => bounds.validWidth * bounds.validHeight);
    expect(tiles.get({ tx: 4, ty: 2 })?.value).toBe(44);
    expect(tiles.deallocate({ tx: 4, ty: 2 })).toBe(true);
    expect(tiles.get({ tx: 4, ty: 2 })).toBeNull();
    expect(tiles.deallocate({ tx: 4, ty: 2 })).toBe(false);
    expect(tiles.size).toBe(0);
  });
});
