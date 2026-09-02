import { describe, expect, it } from 'vitest';
import {
  blendRgbV1,
  compositeBlendRgbaV1,
  type M5cBaseBlendModeIdV1,
} from '../../src/gpu/blend-modes.js';

const backdrop = [0.6, 0.4, 0.2] as const;
const source = [0.5, 0.25, 0.8] as const;

const expected: Readonly<Record<M5cBaseBlendModeIdV1, readonly [number, number, number]>> = {
  normal: source,
  darken: [0.5, 0.25, 0.2],
  multiply: [0.3, 0.1, 0.16],
  'color-burn': [0.2, 0, 0],
  'linear-burn': [0.1, 0, 0],
  'darker-color': backdrop,
  lighten: [0.6, 0.4, 0.8],
  screen: [0.8, 0.55, 0.84],
  'color-dodge': [1, 0.5333333333333333, 1],
  'linear-dodge': [1, 0.65, 1],
};

describe('M5C base blend kernels', () => {
  for (const mode of Object.keys(expected) as M5cBaseBlendModeIdV1[]) {
    it(`implements ${mode}`, () => {
      const result = blendRgbV1(mode, backdrop, source);
      expect(result[0]).toBeCloseTo(expected[mode][0], 8);
      expect(result[1]).toBeCloseTo(expected[mode][1], 8);
      expect(result[2]).toBeCloseTo(expected[mode][2], 8);
    });
  }

  it('uses source-over alpha with the blend result only in the overlap region', () => {
    const result = compositeBlendRgbaV1(
      [0.8, 0.2, 0.1, 0.5],
      [0.25, 0.75, 0.5, 0.8],
      0.5,
      'multiply',
    );
    expect(result[3]).toBeCloseTo(0.7, 8);
    expect(result[0]).toBeCloseTo(0.5142857142857143, 8);
    expect(result[1]).toBeCloseTo(0.32142857142857145, 8);
    expect(result[2]).toBeCloseTo(0.20714285714285716, 8);
  });

  it('selects a complete RGB tuple for Darker Color instead of mixing channels', () => {
    expect(blendRgbV1('darker-color', [0.9, 0.1, 0.1], [0.4, 0.4, 0.4])).toEqual([
      0.9, 0.1, 0.1,
    ]);
    expect(blendRgbV1('darker-color', [0.8, 0.8, 0.1], [0.2, 0.2, 0.2])).toEqual([
      0.2, 0.2, 0.2,
    ]);
  });
});
