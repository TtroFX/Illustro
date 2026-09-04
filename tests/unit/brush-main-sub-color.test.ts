import { describe, expect, it } from 'vitest';
import {
  BaselineBrushDabBuilderV1,
  mixBaselineBrushMainSubColorV1,
} from '../../src/gpu/baseline-brush.js';

describe('M6A-064 main/sub brush color', () => {
  it('keeps ratio zero as exact main-color compatibility and ratio one as sub color', () => {
    const main = Object.freeze([1, 0, 0] as const);
    const sub = Object.freeze([0, 0, 1] as const);
    expect(mixBaselineBrushMainSubColorV1(main, sub, 0)).toBe(main);
    expect(mixBaselineBrushMainSubColorV1(main, sub, 1)).toBe(sub);
  });

  it('mixes main and sub colors in linear light before creating resolved dabs', () => {
    const builder = new BaselineBrushDabBuilderV1({
      color: [1, 0, 0],
      subColor: [0, 0, 1],
      subColorRatio: 0.5,
      sizePx: 16,
    });
    const dabs = builder.begin({ documentX: 8, documentY: 8 });
    expect(dabs).toHaveLength(1);
    const color = dabs[0]?.color;
    expect(color).toBeDefined();
    expect(color?.[0]).toBeCloseTo(0.735, 2);
    expect(color?.[1]).toBeCloseTo(0, 4);
    expect(color?.[2]).toBeCloseTo(0.735, 2);
  });

  it('applies existing HSV jitter after resolving the fixed main/sub contribution', () => {
    const base = mixBaselineBrushMainSubColorV1([1, 0, 0], [0, 0, 1], 0.5);
    const builder = new BaselineBrushDabBuilderV1({
      color: [1, 0, 0],
      subColor: [0, 0, 1],
      subColorRatio: 0.5,
      hueJitter: 0.2,
      randomSeed: 123,
      sizePx: 16,
    });
    const color = builder.begin({ documentX: 8, documentY: 8 })[0]?.color;
    expect(color).toBeDefined();
    expect(color).not.toEqual(base);
  });
});
