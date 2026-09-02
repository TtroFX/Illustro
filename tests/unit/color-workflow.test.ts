import { describe, expect, it } from 'vitest';
import {
  formatHexRgbV1,
  hsvToRgbV1,
  parseHexRgbV1,
  rgbBytesToUnitV1,
  rgbToHsvV1,
  rgbUnitToBytesV1,
} from '../../src/domain/color.js';
import {
  COLOR_HISTORY_LIMIT_V1,
  commitColorWorkspaceCurrentV1,
  createColorWorkspaceStateV1,
  parseColorWorkspaceStateV1,
  swapColorWorkspaceColorsV1,
} from '../../src/app/color-workspace-state.js';

describe('M5D color model foundation', () => {
  it('round-trips RGB and HSV without changing encoded component intent', () => {
    expect(rgbUnitToBytesV1(hsvToRgbV1({ h: 0, s: 1, v: 1 }))).toEqual([255, 0, 0]);
    expect(rgbUnitToBytesV1(hsvToRgbV1({ h: 120, s: 1, v: 1 }))).toEqual([0, 255, 0]);
    expect(rgbUnitToBytesV1(hsvToRgbV1({ h: 240, s: 1, v: 1 }))).toEqual([0, 0, 255]);
    const source = rgbBytesToUnitV1(31, 137, 219);
    const roundTrip = hsvToRgbV1(rgbToHsvV1(source));
    expect(rgbUnitToBytesV1(roundTrip)).toEqual([31, 137, 219]);
  });

  it('parses short/full HEX and formats the canonical full form', () => {
    expect(rgbUnitToBytesV1(parseHexRgbV1('#0af'))).toEqual([0, 170, 255]);
    expect(formatHexRgbV1(parseHexRgbV1('12abEF'))).toBe('#12ABEF');
    expect(() => parseHexRgbV1('#abcd')).toThrow(/HEX/);
  });

  it('tracks current, previous and bounded de-duplicated history', () => {
    let state = createColorWorkspaceStateV1();
    state = commitColorWorkspaceCurrentV1(state, rgbBytesToUnitV1(255, 0, 0));
    expect(rgbUnitToBytesV1(state.current)).toEqual([255, 0, 0]);
    expect(rgbUnitToBytesV1(state.previous)).toEqual([0, 0, 0]);
    state = swapColorWorkspaceColorsV1(state);
    expect(rgbUnitToBytesV1(state.current)).toEqual([0, 0, 0]);
    for (let value = 0; value < COLOR_HISTORY_LIMIT_V1 + 8; value += 1) {
      state = commitColorWorkspaceCurrentV1(state, rgbBytesToUnitV1(value, 40, 80));
    }
    expect(state.history).toHaveLength(COLOR_HISTORY_LIMIT_V1);
    const restored = parseColorWorkspaceStateV1(JSON.parse(JSON.stringify(state)));
    expect(restored).toEqual(state);
  });
});
