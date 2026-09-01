import { describe, expect, it } from 'vitest';
import {
  BaselineBrushDabBuilderV1,
  planBaselineBrushTilesV1,
} from '../../src/gpu/baseline-brush.js';

describe('M4 baseline brush dab generation', () => {
  it('places deterministic 4px-spaced round dabs and retains the final endpoint', () => {
    const builder = new BaselineBrushDabBuilderV1();
    builder.begin({ documentX: 0, documentY: 12 });
    builder.append([{ documentX: 10, documentY: 12 }]);

    expect(builder.finish().map((dab) => [dab.x, dab.y])).toEqual([
      [0, 12],
      [4, 12],
      [8, 12],
      [10, 12],
    ]);
  });

  it('carries spacing continuously across short confirmed pointer batches', () => {
    const builder = new BaselineBrushDabBuilderV1();
    builder.begin({ documentX: 0, documentY: 0 });
    builder.append([{ documentX: 2, documentY: 0 }]);
    builder.append([{ documentX: 4, documentY: 0 }]);
    builder.append([{ documentX: 6, documentY: 0 }]);
    builder.append([{ documentX: 8, documentY: 0 }]);

    expect(builder.finish().map((dab) => dab.x)).toEqual([0, 4, 8]);
  });

  it('emits only newly confirmed dabs through the incremental hot-path API', () => {
    const builder = new BaselineBrushDabBuilderV1();

    expect(builder.beginDelta({ documentX: 0, documentY: 0 }).map((dab) => dab.x)).toEqual([0]);
    expect(builder.appendDelta([{ documentX: 8, documentY: 0 }]).map((dab) => dab.x)).toEqual([
      4, 8,
    ]);
    expect(builder.appendDelta([{ documentX: 12, documentY: 0 }]).map((dab) => dab.x)).toEqual([
      12,
    ]);
    expect(builder.dabCount()).toBe(4);
    expect(builder.finishDelta()).toEqual([]);
    expect(builder.dabs().map((dab) => dab.x)).toEqual([0, 4, 8, 12]);
  });

  it('splits one dab across canonical sparse-tile boundaries with local dirty rectangles', () => {
    const builder = new BaselineBrushDabBuilderV1();
    const [dab] = builder.begin({ documentX: 127, documentY: 64 });
    expect(dab).toBeDefined();

    const plans = planBaselineBrushTilesV1([dab!], 256, 128);
    expect(plans).toHaveLength(2);
    expect(plans[0]).toMatchObject({
      coordinate: { tx: 0, ty: 0 },
      dirtyRect: { x: 119, y: 56, width: 9, height: 16 },
    });
    expect(plans[1]).toMatchObject({
      coordinate: { tx: 1, ty: 0 },
      dirtyRect: { x: 0, y: 56, width: 7, height: 16 },
    });
  });

  it('clips off-canvas brush coverage before producing tile dirtiness', () => {
    const builder = new BaselineBrushDabBuilderV1();
    const [dab] = builder.begin({ documentX: 2, documentY: 64 });
    expect(dab).toBeDefined();

    expect(planBaselineBrushTilesV1([dab!], 256, 256)).toMatchObject([
      {
        coordinate: { tx: 0, ty: 0 },
        dirtyRect: { x: 0, y: 56, width: 10, height: 16 },
      },
    ]);
  });
});
