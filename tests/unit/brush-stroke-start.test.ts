import { describe, expect, it } from 'vitest';
import {
  brushStrokeStartLengthPxV1,
  createBaselineBrushPresetV1,
  withBrushStrokeStartLengthPxV1,
} from '../../src/domain/brush-schema.js';
import { BaselineBrushDabBuilderV1 } from '../../src/gpu/baseline-brush.js';

describe('M6A-028 stroke-start behavior', () => {
  it('preserves immediate legacy starts and validates a preset-local start length', () => {
    const preset = createBaselineBrushPresetV1({
      id: 'start.paint',
      name: 'Start',
      category: 'Test',
      behavior: 'paint',
    });
    expect(brushStrokeStartLengthPxV1(preset)).toBe(0);
    expect(brushStrokeStartLengthPxV1(withBrushStrokeStartLengthPxV1(preset, 48))).toBe(48);
    expect(() => withBrushStrokeStartLengthPxV1(preset, -1)).toThrow(RangeError);
  });

  it('applies the start envelope from cumulative stroke distance without rewriting prior dabs', () => {
    const builder = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      opacity: 1,
      flow: 1,
      spacingRatio: 0.5,
      startTaperLengthPx: 20,
      tipShape: 'round',
    });
    expect(builder.beginDelta({ documentX: 0, documentY: 0 })).toEqual([]);
    const firstDelta = builder.appendDelta([{ documentX: 10, documentY: 0 }]);
    expect(firstDelta).toHaveLength(1);
    expect(firstDelta[0]?.x).toBeCloseTo(10, 6);
    expect(firstDelta[0]?.radius).toBeCloseTo(5, 6);
    expect(firstDelta[0]?.strokeOpacity).toBeCloseTo(0.5, 6);
    const stableFirst = firstDelta[0];
    const secondDelta = builder.appendDelta([{ documentX: 20, documentY: 0 }]);
    expect(secondDelta).toHaveLength(1);
    expect(secondDelta[0]?.radius).toBeCloseTo(10, 6);
    expect(secondDelta[0]?.strokeOpacity).toBeCloseTo(1, 6);
    expect(builder.dabs()[0]).toEqual(stableFirst);
  });

  it('resolves a short stroke endpoint against the same start envelope', () => {
    const builder = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      opacity: 0.8,
      flow: 1,
      spacingRatio: 1,
      startTaperLengthPx: 20,
    });
    builder.beginDelta({ documentX: 0, documentY: 0 });
    builder.appendDelta([{ documentX: 5, documentY: 0 }]);
    const finishDelta = builder.finishDelta();
    expect(finishDelta).toHaveLength(1);
    expect(finishDelta[0]?.radius).toBeCloseTo(2.5, 6);
    expect(finishDelta[0]?.strokeOpacity).toBeCloseTo(0.2, 6);
  });

  it('keeps the first visible repeated tip asset as the sequence anchor', () => {
    const top = Object.freeze(Array.from({ length: 25 }, (_, index) => (index === 2 ? 255 : 0)));
    const right = Object.freeze(Array.from({ length: 25 }, (_, index) => (index === 14 ? 255 : 0)));
    const builder = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      spacingRatio: 0.5,
      startTaperLengthPx: 20,
      tipShape: 'sampled-image',
      sampledTipAlphas: [top, right],
      tipSelectionMode: 'sequence',
    });
    builder.beginDelta({ documentX: 0, documentY: 0 });
    const firstVisible = builder.appendDelta([{ documentX: 10, documentY: 0 }]);
    expect(firstVisible).toHaveLength(1);
    expect(firstVisible[0]?.x).toBeCloseTo(10, 6);
    expect(firstVisible[0]?.y).toBeCloseTo(-4, 6);
  });
});
