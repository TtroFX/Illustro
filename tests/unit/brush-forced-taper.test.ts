import { describe, expect, it } from 'vitest';
import {
  brushForcedTaperV1,
  createBaselineBrushPresetV1,
  withBrushForcedTaperV1,
} from '../../src/domain/brush-schema.js';
import { BaselineBrushDabBuilderV1 } from '../../src/gpu/baseline-brush.js';

describe('M6A-032 forced taper', () => {
  it('stores independent Force In and Force Out flags with compatibility defaults off', () => {
    const preset = createBaselineBrushPresetV1({
      id: 'forced-taper.paint',
      name: 'Forced taper',
      category: 'Test',
      behavior: 'paint',
    });
    expect(brushForcedTaperV1(preset)).toEqual({ start: false, end: false });
    expect(brushForcedTaperV1(withBrushForcedTaperV1(preset, true, false))).toEqual({
      start: true,
      end: false,
    });
    expect(brushForcedTaperV1(withBrushForcedTaperV1(preset, false, true))).toEqual({
      start: false,
      end: true,
    });
  });

  it('forces the stroke start from zero size and deposit even when taper minima are nonzero', () => {
    const builder = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      opacity: 1,
      flow: 1,
      spacingRatio: 0.5,
      startTaperLengthPx: 20,
      sizeTaperMinimumRatio: 0.4,
      opacityTaperMinimumRatio: 0.25,
      forceStartTaper: true,
    });
    expect(builder.beginDelta({ documentX: 0, documentY: 0 })).toEqual([]);
    const half = builder.appendDelta([{ documentX: 10, documentY: 0 }]);
    expect(half[0]?.radius).toBeCloseTo(5, 6);
    expect(half[0]?.flow).toBeCloseTo(0.5, 6);
    expect(half[0]?.strokeOpacity).toBeCloseTo(1, 6);
  });

  it('forces the stroke end down to zero while leaving an unforced start minimum intact', () => {
    const builder = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      opacity: 1,
      flow: 1,
      spacingRatio: 0.5,
      startTaperLengthPx: 20,
      endTaperLengthPx: 20,
      sizeTaperMinimumRatio: 0.4,
      opacityTaperMinimumRatio: 0.25,
      forceStartTaper: false,
      forceEndTaper: true,
    });
    const start = builder.beginDelta({ documentX: 0, documentY: 0 });
    expect(start).toHaveLength(1);
    expect(start[0]?.radius).toBeCloseTo(4, 6);
    expect(start[0]?.flow).toBeCloseTo(0.25, 6);
    builder.appendDelta([{ documentX: 40, documentY: 0 }]);
    builder.finishDelta();
    expect(builder.dabs().map((dab) => dab.x)).toEqual([0, 10, 20, 30]);
    expect(builder.dabs().at(-1)?.radius).toBeCloseTo(5, 6);
    expect(builder.dabs().at(-1)?.flow).toBeCloseTo(0.5, 6);
  });

  it('composes overlapping forced start/end envelopes without weakening either zero-endpoint rule', () => {
    const builder = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      opacity: 1,
      flow: 1,
      spacingRatio: 0.5,
      startTaperLengthPx: 40,
      endTaperLengthPx: 40,
      sizeTaperMinimumRatio: 0.8,
      opacityTaperMinimumRatio: 0.8,
      forceStartTaper: true,
      forceEndTaper: true,
    });
    builder.beginDelta({ documentX: 0, documentY: 0 });
    builder.appendDelta([{ documentX: 40, documentY: 0 }]);
    builder.finishDelta();
    const dabs = builder.dabs();
    expect(dabs.map((dab) => dab.x)).toEqual([10, 20, 30]);
    expect(dabs[0]?.radius).toBeCloseTo(2.5, 6);
    expect(dabs[1]?.radius).toBeCloseTo(5, 6);
    expect(dabs[2]?.radius).toBeCloseTo(2.5, 6);
  });
});
