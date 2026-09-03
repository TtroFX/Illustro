import { describe, expect, it } from 'vitest';
import {
  brushSizeTaperMinimumRatioV1,
  createBaselineBrushPresetV1,
  withBrushSizeTaperMinimumRatioV1,
} from '../../src/domain/brush-schema.js';
import { BaselineBrushDabBuilderV1 } from '../../src/gpu/baseline-brush.js';

describe('M6A-030 size taper', () => {
  it('stores a preset-local minimum size ratio with the current zero-minimum compatibility default', () => {
    const preset = createBaselineBrushPresetV1({
      id: 'size-taper.paint',
      name: 'Size taper',
      category: 'Test',
      behavior: 'paint',
    });
    expect(brushSizeTaperMinimumRatioV1(preset)).toBe(0);
    expect(brushSizeTaperMinimumRatioV1(withBrushSizeTaperMinimumRatioV1(preset, 0.4))).toBe(0.4);
    expect(() => withBrushSizeTaperMinimumRatioV1(preset, -0.01)).toThrow(RangeError);
    expect(() => withBrushSizeTaperMinimumRatioV1(preset, 1.01)).toThrow(RangeError);
  });

  it('keeps opacity taper independent from the size minimum on the stroke start envelope', () => {
    const builder = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      opacity: 1,
      flow: 1,
      spacingRatio: 0.5,
      startTaperLengthPx: 20,
      sizeTaperMinimumRatio: 0.4,
    });
    expect(builder.beginDelta({ documentX: 0, documentY: 0 })).toEqual([]);
    const half = builder.appendDelta([{ documentX: 10, documentY: 0 }]);
    expect(half).toHaveLength(1);
    expect(half[0]?.radius).toBeCloseTo(7, 6);
    expect(half[0]?.flow).toBeCloseTo(0.5, 6);
    expect(half[0]?.strokeOpacity).toBeCloseTo(1, 6);
    const full = builder.appendDelta([{ documentX: 20, documentY: 0 }]);
    expect(full[0]?.radius).toBeCloseTo(10, 6);
    expect(full[0]?.flow).toBeCloseTo(1, 6);
  });

  it('can disable size shrink while retaining the same deposit envelope', () => {
    const builder = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      opacity: 1,
      flow: 1,
      spacingRatio: 0.5,
      startTaperLengthPx: 20,
      sizeTaperMinimumRatio: 1,
    });
    builder.beginDelta({ documentX: 0, documentY: 0 });
    const half = builder.appendDelta([{ documentX: 10, documentY: 0 }]);
    expect(half[0]?.radius).toBeCloseTo(10, 6);
    expect(half[0]?.flow).toBeCloseTo(0.5, 6);
  });

  it('applies the same size minimum to the bounded stroke-end tail without changing stable dabs', () => {
    const builder = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      opacity: 1,
      flow: 1,
      spacingRatio: 0.5,
      endTaperLengthPx: 20,
      sizeTaperMinimumRatio: 0.4,
    });
    builder.beginDelta({ documentX: 0, documentY: 0 });
    builder.appendDelta([{ documentX: 40, documentY: 0 }]);
    expect(builder.dabs().map((dab) => dab.radius)).toEqual([10, 10, 10, 10, 10]);
    builder.finishDelta();
    expect(builder.dabs().map((dab) => dab.x)).toEqual([0, 10, 20, 30]);
    expect(builder.dabs()[2]?.radius).toBeCloseTo(10, 6);
    expect(builder.dabs()[3]?.radius).toBeCloseTo(7, 6);
    expect(builder.dabs()[3]?.flow).toBeCloseTo(0.5, 6);
  });
});
