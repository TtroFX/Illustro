import { describe, expect, it } from 'vitest';
import {
  DEFAULT_GRID_COLOR_V1,
  DEFAULT_GRID_SPACING_PX_V1,
  GridSettingsV1,
} from '../../src/app/grid-controller.js';

describe('M5A grid settings', () => {
  it('defaults to a hidden non-document grid with stable defaults', () => {
    expect(new GridSettingsV1().snapshot()).toEqual({
      schema: 'illustro.grid-settings/1',
      enabled: false,
      spacing: DEFAULT_GRID_SPACING_PX_V1,
      offsetX: 0,
      offsetY: 0,
      color: DEFAULT_GRID_COLOR_V1,
    });
  });

  it('configures spacing, position and color without changing document data', () => {
    const grid = new GridSettingsV1();
    grid.configure({ spacing: 24, offsetX: -5, offsetY: 11, color: '#A0b1C2' });
    grid.setEnabled(true);
    expect(grid.snapshot()).toMatchObject({
      enabled: true,
      spacing: 24,
      offsetX: -5,
      offsetY: 11,
      color: '#a0b1c2',
    });
  });

  it('rejects unusable spacing and malformed color values', () => {
    const grid = new GridSettingsV1();
    expect(() =>
      grid.configure({ spacing: 0, offsetX: 0, offsetY: 0, color: '#000000' }),
    ).toThrow();
    expect(() => grid.configure({ spacing: 8, offsetX: 0, offsetY: 0, color: 'black' })).toThrow();
  });
});
