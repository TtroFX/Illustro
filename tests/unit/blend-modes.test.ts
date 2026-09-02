import { describe, expect, it } from 'vitest';
import {
  blendRgbV1,
  compositeBlendRgbaV1,
  M5C_BLEND_COLOR_SPACE_SEMANTICS_V1,
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
  'lighter-color': source,
  overlay: [0.6, 0.2, 0.32],
  'soft-light': [0.6, 0.28, 0.3488],
  'hard-light': [0.6, 0.2, 0.68],
  'vivid-light': [0.6, 0, 0.5],
  'linear-light': [0.6, 0, 0.8],
  'pin-light': [0.6, 0.4, 0.6],
  'hard-mix': [1, 0, 1],
  difference: [0.1, 0.15, 0.6],
  exclusion: [0.5, 0.45, 0.68],
  subtract: [0.1, 0.15, 0],
  divide: [1, 1, 0.25],
  hue: [0.5212727272727272, 0.33945454545454545, 0.7394545454545454],
  saturation: [0.66075, 0.38575, 0.11075],
  color: [0.5525, 0.3025, 0.8525],
  luminosity: [0.5475, 0.3475, 0.1475],
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
    expect(result[0]).toBeCloseTo(0.4714285714285714, 8);
    expect(result[1]).toBeCloseTo(0.34285714285714286, 8);
    expect(result[2]).toBeCloseTo(0.2, 8);
  });

  it('selects complete RGB tuples for Darker/Lighter Color instead of mixing channels', () => {
    expect(blendRgbV1('darker-color', [0.9, 0.1, 0.1], [0.4, 0.4, 0.4])).toEqual([0.9, 0.1, 0.1]);
    expect(blendRgbV1('darker-color', [0.8, 0.8, 0.1], [0.2, 0.2, 0.2])).toEqual([0.2, 0.2, 0.2]);
    expect(blendRgbV1('lighter-color', [0.9, 0.1, 0.1], [0.4, 0.4, 0.4])).toEqual([0.4, 0.4, 0.4]);
    expect(blendRgbV1('lighter-color', [0.8, 0.8, 0.1], [0.2, 0.2, 0.2])).toEqual([0.8, 0.8, 0.1]);
  });

  it('keeps comparative arithmetic edge cases bounded', () => {
    expect(blendRgbV1('difference', [0.2, 0.4, 0.6], [1, 0, 0.6])).toEqual([0.8, 0.4, 0]);
    expect(blendRgbV1('subtract', [0.2, 0.4, 0.6], [0.8, 0.1, 1])).toEqual([
      0, 0.30000000000000004, 0,
    ]);
    expect(blendRgbV1('divide', [0.2, 0.4, 0.6], [0, 1, 0.3])).toEqual([1, 0.4, 1]);
  });

  it('declares and executes blend math in the selected document working RGB space', () => {
    expect(M5C_BLEND_COLOR_SPACE_SEMANTICS_V1.supportedWorkingSpaces).toEqual([
      'srgb',
      'display-p3',
    ]);
    expect(M5C_BLEND_COLOR_SPACE_SEMANTICS_V1.componentDomain).toBe('normalized-document-rgb');
    expect(M5C_BLEND_COLOR_SPACE_SEMANTICS_V1.transferDomain).toBe(
      'encoded-working-space-components',
    );
    expect(blendRgbV1('multiply', backdrop, source, 'display-p3')).toEqual([
      0.3, 0.1, 0.16000000000000003,
    ]);
  });

  it('keeps W3C non-separable grayscale edge cases finite', () => {
    for (const mode of ['hue', 'saturation', 'color', 'luminosity'] as const) {
      const result = blendRgbV1(mode, [0.5, 0.5, 0.5], [0.2, 0.2, 0.2], 'display-p3');
      expect(result.every(Number.isFinite)).toBe(true);
      expect(result.every((value) => value >= 0 && value <= 1)).toBe(true);
    }
  });
});
