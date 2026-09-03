import { describe, expect, it } from 'vitest';
import {
  brushOpacityTaperMinimumRatioV1,
  createBaselineBrushPresetV1,
  withBrushOpacityTaperMinimumRatioV1,
} from '../../src/domain/brush-schema.js';
import { BaselineBrushDabBuilderV1 } from '../../src/gpu/baseline-brush.js';

describe('M6A-031 opacity taper', () => {
  it('stores a preset-local minimum deposit ratio with a zero-minimum compatibility default', () => {
    const preset = createBaselineBrushPresetV1({
      id: 'opacity-taper.paint',
      name: 'Opacity taper',
      category: 'Test',
      behavior: 'paint',
    });
    expect(brushOpacityTaperMinimumRatioV1(preset)).toBe(0);
    expect(brushOpacityTaperMinimumRatioV1(withBrushOpacityTaperMinimumRatioV1(preset, 0.4))).toBe(
      0.4,
    );
    expect(() => withBrushOpacityTaperMinimumRatioV1(preset, -0.01)).toThrow(RangeError);
    expect(() => withBrushOpacityTaperMinimumRatioV1(preset, 1.01)).toThrow(RangeError);
  });

  it('keeps size taper independent from the opacity/deposit minimum on the start envelope', () => {
    const builder = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      opacity: 0.8,
      flow: 1,
      spacingRatio: 0.5,
      startTaperLengthPx: 20,
      sizeTaperMinimumRatio: 1,
      opacityTaperMinimumRatio: 0.4,
    });
    builder.beginDelta({ documentX: 0, documentY: 0 });
    const half = builder.appendDelta([{ documentX: 10, documentY: 0 }]);
    expect(half[0]?.radius).toBeCloseTo(10, 6);
    expect(half[0]?.flow).toBeCloseTo(0.7, 6);
    expect(half[0]?.strokeOpacity).toBeCloseTo(0.8, 6);
    expect(half[0]?.opacity).toBeCloseTo(0.56, 6);
  });

  it('can disable deposit fade while retaining size taper', () => {
    const builder = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      opacity: 1,
      flow: 0.8,
      spacingRatio: 0.5,
      startTaperLengthPx: 20,
      sizeTaperMinimumRatio: 0.4,
      opacityTaperMinimumRatio: 1,
    });
    const start = builder.beginDelta({ documentX: 0, documentY: 0 });
    expect(start).toHaveLength(1);
    expect(start[0]?.radius).toBeCloseTo(4, 6);
    expect(start[0]?.flow).toBeCloseTo(0.8, 6);
    const half = builder.appendDelta([{ documentX: 10, documentY: 0 }]);
    expect(half[0]?.radius).toBeCloseTo(7, 6);
    expect(half[0]?.flow).toBeCloseTo(0.8, 6);
  });

  it('emits a visible zero-envelope endpoint only when both size and deposit minima are nonzero', () => {
    const builder = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      opacity: 1,
      flow: 1,
      spacingRatio: 0.5,
      endTaperLengthPx: 20,
      sizeTaperMinimumRatio: 0.4,
      opacityTaperMinimumRatio: 0.25,
    });
    builder.beginDelta({ documentX: 0, documentY: 0 });
    builder.appendDelta([{ documentX: 40, documentY: 0 }]);
    builder.finishDelta();
    const endpoint = builder.dabs().at(-1);
    expect(endpoint?.x).toBeCloseTo(40, 6);
    expect(endpoint?.radius).toBeCloseTo(4, 6);
    expect(endpoint?.flow).toBeCloseTo(0.25, 6);
    expect(endpoint?.strokeOpacity).toBeCloseTo(1, 6);
  });
});
