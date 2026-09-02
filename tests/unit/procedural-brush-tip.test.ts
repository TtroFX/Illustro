import { describe, expect, it } from 'vitest';
import {
  brushProceduralTipShapeV1,
  createBaselineBrushPresetV1,
  withBrushProceduralTipShapeV1,
} from '../../src/domain/brush-schema.js';
import { BaselineBrushDabBuilderV1 } from '../../src/gpu/baseline-brush.js';
import {
  BaselineRasterTileStoreV1,
  readBaselineRasterTilePixelV1,
} from '../../src/gpu/baseline-raster-tile-store.js';

describe('M6A-017 procedural brush tip', () => {
  it('normalizes round by default and persists square without changing the brush schema', () => {
    const baseline = createBaselineBrushPresetV1({
      id: 'tip.test',
      name: 'Tip Test',
      category: 'Test',
      behavior: 'paint',
    });
    expect(brushProceduralTipShapeV1(baseline)).toBe('round');
    const square = withBrushProceduralTipShapeV1(baseline, 'square');
    expect(square.schema).toBe('illustro.brush/1');
    expect(square.tip.kind).toBe('procedural-square');
    expect(brushProceduralTipShapeV1(square)).toBe('square');
  });

  it('captures the procedural tip identity into every generated dab', () => {
    const builder = new BaselineBrushDabBuilderV1({ sizePx: 16, tipShape: 'square' });
    builder.begin({ documentX: 32, documentY: 32 });
    builder.append([{ documentX: 40, documentY: 32 }]);
    expect(builder.finish().every((dab) => dab.tipShape === 'square')).toBe(true);
  });

  it('renders square corners that remain outside the equivalent round tip', () => {
    const round = new BaselineRasterTileStoreV1(64, 64, 'rgba8-unorm', [
      { layerId: 'layer', visible: true, opacity: 1 },
    ]);
    const square = new BaselineRasterTileStoreV1(64, 64, 'rgba8-unorm', [
      { layerId: 'layer', visible: true, opacity: 1 },
    ]);
    const dab = {
      schema: 'illustro.baseline-brush-dab/1' as const,
      x: 32,
      y: 32,
      radius: 8,
      opacity: 1,
      color: [1, 0, 0] as const,
    };
    round.applyDabs(
      'layer',
      'round',
      [Object.freeze({ ...dab, tipShape: 'round' as const })],
      'paint',
    );
    square.applyDabs(
      'layer',
      'square',
      [Object.freeze({ ...dab, tipShape: 'square' as const })],
      'paint',
    );
    round.finalize('round');
    square.finalize('square');
    const roundTile = round.exportTiles()[0];
    const squareTile = square.exportTiles()[0];
    if (roundTile === undefined || squareTile === undefined) throw new Error('missing raster tile');
    const cornerPixel = 25 * roundTile.width + 25;
    expect(readBaselineRasterTilePixelV1(roundTile, cornerPixel)[3]).toBe(0);
    expect(readBaselineRasterTilePixelV1(squareTile, cornerPixel)[3]).toBeGreaterThan(0);
  });
});
