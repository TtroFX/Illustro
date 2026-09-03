import { describe, expect, it } from 'vitest';
import {
  brushStrokeEndLengthPxV1,
  createBaselineBrushPresetV1,
  withBrushStrokeEndLengthPxV1,
} from '../../src/domain/brush-schema.js';
import { BaselineBrushDabBuilderV1 } from '../../src/gpu/baseline-brush.js';

describe('M6A-029 stroke-end behavior', () => {
  it('preserves legacy immediate endings and validates a preset-local end length', () => {
    const preset = createBaselineBrushPresetV1({
      id: 'end.paint',
      name: 'End',
      category: 'Test',
      behavior: 'paint',
    });
    expect(brushStrokeEndLengthPxV1(preset)).toBe(0);
    expect(brushStrokeEndLengthPxV1(withBrushStrokeEndLengthPxV1(preset, 48))).toBe(48);
    expect(() => withBrushStrokeEndLengthPxV1(preset, 5000)).toThrow(RangeError);
  });

  it('keeps a stable prefix and regenerates only the bounded release tail', () => {
    const builder = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      opacity: 0.8,
      flow: 1,
      spacingRatio: 0.5,
      endTaperLengthPx: 20,
    });
    builder.beginDelta({ documentX: 0, documentY: 0 });
    builder.appendDelta([{ documentX: 40, documentY: 0 }]);
    const before = builder.dabs();
    expect(before.map((dab) => dab.x)).toEqual([0, 10, 20, 30, 40]);
    expect(builder.stablePrefixDabCount()).toBe(3);
    expect(builder.mutableTailDabCount()).toBe(2);
    const stablePrefix = before.slice(0, 3);

    expect(builder.finishDelta()).toEqual([]);
    const final = builder.dabs();
    expect(final.map((dab) => dab.x)).toEqual([0, 10, 20, 30]);
    expect(final.slice(0, 3)).toEqual(stablePrefix);
    expect(final[3]?.radius).toBeCloseTo(5, 6);
    expect(final[3]?.flow).toBeCloseTo(0.5, 6);
    expect(final[3]?.strokeOpacity).toBeCloseTo(0.8, 6);
    expect(builder.mutableTailDabCount()).toBe(0);
    expect(builder.stablePrefixDabCount()).toBe(4);
  });

  it('shrinks a sampled tip around its logical center during end-tail reconciliation', () => {
    const top = Object.freeze(Array.from({ length: 25 }, (_, index) => (index === 2 ? 255 : 0)));
    const builder = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      spacingRatio: 0.5,
      endTaperLengthPx: 20,
      tipShape: 'sampled-image',
      sampledTipAlphas: [top],
    });
    builder.beginDelta({ documentX: 0, documentY: 20 });
    builder.appendDelta([{ documentX: 40, documentY: 20 }]);
    builder.finishDelta();
    const final = builder.dabs();
    const tapered = final.find((dab) => Math.abs(dab.x - 30) < 1e-6);
    expect(tapered).toBeDefined();
    expect(tapered?.y).toBeCloseTo(16, 6);
  });

  it('combines overlapping start/end envelopes by the stronger taper side', () => {
    const builder = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      opacity: 1,
      flow: 1,
      spacingRatio: 0.5,
      startTaperLengthPx: 20,
      endTaperLengthPx: 20,
    });
    builder.beginDelta({ documentX: 0, documentY: 0 });
    builder.appendDelta([{ documentX: 20, documentY: 0 }]);
    builder.finishDelta();
    expect(builder.dabs()).toHaveLength(1);
    expect(builder.dabs()[0]?.x).toBeCloseTo(10, 6);
    expect(builder.dabs()[0]?.radius).toBeCloseTo(5, 6);
    expect(builder.dabs()[0]?.flow).toBeCloseTo(0.5, 6);
  });
});
