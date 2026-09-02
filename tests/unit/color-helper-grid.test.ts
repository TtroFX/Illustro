import { describe, expect, it } from 'vitest';
import {
  approximateColorGridV1,
  intermediateColorGridV1,
} from '../../src/app/color-helper-grid.js';
import { rgbToHsvV1 } from '../../src/domain/color.js';

describe('M5D intermediate / approximate color helper', () => {
  it('bilinearly interpolates four registered corner colors', () => {
    const grid = intermediateColorGridV1(
      {
        topLeft: [1, 0, 0],
        topRight: [0, 1, 0],
        bottomLeft: [0, 0, 1],
        bottomRight: [1, 1, 1],
      },
      3,
      3,
    );
    expect(grid[0]).toEqual([1, 0, 0]);
    expect(grid[2]).toEqual([0, 1, 0]);
    expect(grid[6]).toEqual([0, 0, 1]);
    expect(grid[8]).toEqual([1, 1, 1]);
    expect(grid[4]).toEqual([0.5, 0.5, 0.5]);
  });

  it('keeps the selected drawing color at the center of the approximate grid', () => {
    const base = [0.25, 0.5, 0.75] as const;
    const grid = approximateColorGridV1({
      base,
      xAxis: 'hue',
      yAxis: 'saturation',
      xAmount: 0.5,
      yAmount: 0.5,
      columns: 5,
      rows: 5,
    });
    expect(grid[12]).toEqual(base);
  });

  it('varies hue horizontally and lightness vertically', () => {
    const base = [0.8, 0.3, 0.2] as const;
    const hueGrid = approximateColorGridV1({
      base,
      xAxis: 'hue',
      yAxis: 'lightness',
      xAmount: 0.5,
      yAmount: 0.5,
      columns: 3,
      rows: 3,
    });
    const leftHue = rgbToHsvV1(hueGrid[3] ?? base).h;
    const rightHue = rgbToHsvV1(hueGrid[5] ?? base).h;
    expect(Math.abs(leftHue - rightHue)).toBeGreaterThan(50);
    const top = hueGrid[1] ?? base;
    const bottom = hueGrid[7] ?? base;
    expect(top[0] + top[1] + top[2]).toBeGreaterThan(bottom[0] + bottom[1] + bottom[2]);
  });

  it('clamps RGB-axis variations into encoded unit range', () => {
    const grid = approximateColorGridV1({
      base: [0.95, 0.02, 0.5],
      xAxis: 'red',
      yAxis: 'green',
      xAmount: 1,
      yAmount: 1,
      columns: 3,
      rows: 3,
    });
    for (const color of grid) {
      expect(color.every((component) => component >= 0 && component <= 1)).toBe(true);
    }
    expect(grid[5]?.[0]).toBe(1);
    expect(grid[7]?.[1]).toBe(0);
  });
});
