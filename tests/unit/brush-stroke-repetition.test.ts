import { describe, expect, it } from 'vitest';
import {
  brushTipSelectionModeV1,
  createBaselineBrushPresetV1,
  withBrushTipSelectionModeV1,
} from '../../src/domain/brush-schema.js';
import { BaselineBrushDabBuilderV1 } from '../../src/gpu/baseline-brush.js';

function singlePixelAlpha(index: number): readonly number[] {
  return Object.freeze(Array.from({ length: 25 }, (_, current) => (current === index ? 255 : 0)));
}

describe('M6A-027 stroke repetition', () => {
  it('keeps legacy presets fixed and exposes sequence/random-per-stamp selector modes', () => {
    const preset = createBaselineBrushPresetV1({
      id: 'repeat.paint',
      name: 'Repeat',
      category: 'Test',
      behavior: 'paint',
    });
    expect(brushTipSelectionModeV1(preset)).toBe('fixed');
    expect(brushTipSelectionModeV1(withBrushTipSelectionModeV1(preset, 'sequence'))).toBe(
      'sequence',
    );
    expect(brushTipSelectionModeV1(withBrushTipSelectionModeV1(preset, 'random-per-stamp'))).toBe(
      'random-per-stamp',
    );
  });

  it('repeats ordered tip alternatives once per logical stamp without Dual Brush compositing', () => {
    const top = singlePixelAlpha(2);
    const right = singlePixelAlpha(14);
    const builder = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      spacingRatio: 0.5,
      tipShape: 'sampled-image',
      sampledTipAlphas: [top, right],
      tipSelectionMode: 'sequence',
      tipSelectionStartIndex: 0,
    });
    builder.begin({ documentX: 20, documentY: 20 });
    builder.append([{ documentX: 40, documentY: 20 }]);
    expect(builder.finish().map((dab) => [dab.x, dab.y])).toEqual([
      [20, 12],
      [38, 20],
      [40, 12],
    ]);
  });

  it('uses the selected alternative for every stamp in fixed mode', () => {
    const top = singlePixelAlpha(2);
    const right = singlePixelAlpha(14);
    const builder = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      spacingRatio: 0.5,
      tipShape: 'sampled-image',
      sampledTipAlphas: [top, right],
      tipSelectionMode: 'fixed',
      tipSelectionStartIndex: 1,
    });
    builder.begin({ documentX: 20, documentY: 20 });
    builder.append([{ documentX: 40, documentY: 20 }]);
    expect(builder.finish().map((dab) => [dab.x, dab.y])).toEqual([
      [28, 20],
      [38, 20],
      [48, 20],
    ]);
  });

  it('makes random-per-stamp selection deterministic for an explicit stroke seed', () => {
    const alternatives = [singlePixelAlpha(2), singlePixelAlpha(14), singlePixelAlpha(22)];
    const draw = (seed: number): readonly (readonly [number, number])[] => {
      const builder = new BaselineBrushDabBuilderV1({
        sizePx: 20,
        spacingRatio: 0.25,
        tipShape: 'sampled-image',
        sampledTipAlphas: alternatives,
        tipSelectionMode: 'random-per-stamp',
        tipSelectionSeed: seed,
      });
      builder.begin({ documentX: 20, documentY: 20 });
      builder.append([{ documentX: 60, documentY: 20 }]);
      return builder.finish().map((dab) => [dab.x, dab.y] as const);
    };
    expect(draw(0x12345678)).toEqual(draw(0x12345678));
    expect(draw(0x12345678)).not.toEqual(draw(0x87654321));
  });
});
