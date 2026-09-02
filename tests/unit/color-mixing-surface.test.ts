import { describe, expect, it } from 'vitest';
import { ColorMixingSurfaceV1 } from '../../src/app/color-mixing-surface.js';
import { convertEncodedRgbV1 } from '../../src/domain/color-management.js';
import { freezeRgbUnitColorV1, rgbUnitToBytesV1 } from '../../src/domain/color.js';

function expectNearColor(
  actual: readonly number[],
  expected: readonly number[],
  tolerance = 2,
): void {
  const actualBytes = rgbUnitToBytesV1(freezeRgbUnitColorV1(actual));
  const expectedBytes = rgbUnitToBytesV1(freezeRgbUnitColorV1(expected));
  expect(Math.abs(actualBytes[0] - expectedBytes[0])).toBeLessThanOrEqual(tolerance);
  expect(Math.abs(actualBytes[1] - expectedBytes[1])).toBeLessThanOrEqual(tolerance);
  expect(Math.abs(actualBytes[2] - expectedBytes[2])).toBeLessThanOrEqual(tolerance);
}

describe('M5D Color Mixing Surface', () => {
  it('paints a bounded direct-manipulation stroke without touching unrelated pixels', () => {
    const surface = new ColorMixingSurfaceV1(16, 12, 'srgb');
    surface.paintLine({ x: 5, y: 6 }, { x: 11, y: 6 }, [1, 0, 0], 5, 1);

    const center = surface.sample(8, 6);
    expect(center[0]).toBeGreaterThan(0.95);
    expect(center[1]).toBeLessThan(0.2);
    expect(center[2]).toBeLessThan(0.2);
    expectNearColor(surface.sample(0, 0), [1, 1, 1], 0);
  });

  it('blends toward a local neighborhood while leaving distant pixels intact', () => {
    const surface = new ColorMixingSurfaceV1(20, 12, 'srgb');
    surface.paintLine({ x: 7, y: 6 }, { x: 7, y: 6 }, [1, 0, 0], 7, 1);
    surface.paintLine({ x: 13, y: 6 }, { x: 13, y: 6 }, [0, 0, 1], 7, 1);
    const before = surface.sample(10, 6);

    surface.blendLine({ x: 10, y: 6 }, { x: 10, y: 6 }, 9, 1);
    const after = surface.sample(10, 6);

    expect(after).not.toEqual(before);
    expect(after[0]).toBeGreaterThan(0.1);
    expect(after[2]).toBeGreaterThan(0.1);
    expectNearColor(surface.sample(0, 0), [1, 1, 1], 0);
  });

  it('restores exact bounded snapshots for workspace undo/redo', () => {
    const surface = new ColorMixingSurfaceV1(10, 10, 'srgb');
    surface.paintLine({ x: 5, y: 5 }, { x: 5, y: 5 }, [0.2, 0.4, 0.8], 6, 1);
    const snapshot = surface.snapshot();
    const expected = surface.sample(5, 5);

    surface.clear([0, 0, 0]);
    surface.restore(snapshot);

    expect(surface.workingSpace()).toBe('srgb');
    expect(surface.sample(5, 5)).toEqual(expected);
    expect(surface.snapshot().pixels).toEqual(snapshot.pixels);
  });

  it('converts the canonical mixing surface when document working space changes', () => {
    const surface = new ColorMixingSurfaceV1(4, 4, 'display-p3');
    surface.clear([1, 0, 0]);
    const expected = convertEncodedRgbV1([1, 0, 0], 'display-p3', 'srgb');

    surface.convertWorkingSpace('srgb');

    expect(surface.workingSpace()).toBe('srgb');
    expectNearColor(surface.sample(2, 2), expected, 1);
  });

  it('converts only presentation bytes when a P3 surface is shown through an sRGB UI canvas', () => {
    const surface = new ColorMixingSurfaceV1(2, 1, 'display-p3');
    surface.clear([1, 0, 0]);
    const expected = rgbUnitToBytesV1(convertEncodedRgbV1([1, 0, 0], 'display-p3', 'srgb'));

    const presentation = surface.presentationRgba8('srgb');

    expect([...presentation.slice(0, 4)]).toEqual([expected[0], expected[1], expected[2], 255]);
    expectNearColor(surface.sample(0, 0), [1, 0, 0], 0);
    expect(surface.workingSpace()).toBe('display-p3');
  });
});
