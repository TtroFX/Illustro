import { describe, expect, it } from 'vitest';
import {
  CanonicalRasterBrushStrokeV1,
  isImplementedCanonicalBrushModeV1,
  requireImplementedCanonicalBrushModeV1,
} from '../../src/app/canonical-raster-brush.js';

describe('M6A-001 canonical Raster Brush mode', () => {
  it('exposes Raster, Eraser, Smudge and Blur as implemented canonical brush modes', () => {
    expect(isImplementedCanonicalBrushModeV1('raster')).toBe(true);
    expect(isImplementedCanonicalBrushModeV1('eraser')).toBe(true);
    expect(isImplementedCanonicalBrushModeV1('smudge')).toBe(true);
    expect(isImplementedCanonicalBrushModeV1('blur')).toBe(true);
    expect(requireImplementedCanonicalBrushModeV1('raster')).toBe('raster');
    expect(requireImplementedCanonicalBrushModeV1('eraser')).toBe('eraser');
    expect(requireImplementedCanonicalBrushModeV1('smudge')).toBe('smudge');
    expect(requireImplementedCanonicalBrushModeV1('blur')).toBe('blur');
  });

  it('emits only newly generated dabs while retaining the stable prefix', () => {
    const stroke = new CanonicalRasterBrushStrokeV1();

    expect(stroke.beginConfirmed({ documentX: 0, documentY: 0 }).map((dab) => dab.x)).toEqual([0]);
    expect(stroke.appendConfirmed([{ documentX: 8, documentY: 0 }]).map((dab) => dab.x)).toEqual([
      4, 8,
    ]);
    expect(stroke.appendConfirmed([{ documentX: 12, documentY: 0 }]).map((dab) => dab.x)).toEqual([
      12,
    ]);

    expect(stroke.dabs().map((dab) => dab.x)).toEqual([0, 4, 8, 12]);
    expect(stroke.snapshot()).toMatchObject({
      mode: 'raster',
      confirmedSampleCount: 3,
      generatedDabCount: 4,
      emittedDabCount: 4,
      stablePrefixDabCount: 4,
      mutableTailDabCount: 0,
      reprocessedStableDabCount: 0,
      finished: false,
    });
  });

  it('keeps newly delivered work independent from a long stable prefix', () => {
    const stroke = new CanonicalRasterBrushStrokeV1();
    stroke.beginConfirmed({ documentX: 0, documentY: 0 });
    for (let index = 1; index <= 1_000; index += 1) {
      stroke.appendConfirmed([{ documentX: index * 4, documentY: 0 }]);
    }
    const prefix = stroke.snapshot().stablePrefixDabCount;
    const delta = stroke.appendConfirmed([{ documentX: 4_004, documentY: 0 }]);

    expect(prefix).toBe(1_001);
    expect(delta).toHaveLength(1);
    expect(stroke.snapshot()).toMatchObject({
      stablePrefixDabCount: 1_002,
      reprocessedStableDabCount: 0,
    });
  });

  it('retains the final endpoint through the incremental finish boundary', () => {
    const stroke = new CanonicalRasterBrushStrokeV1();
    stroke.beginConfirmed({ documentX: 0, documentY: 0 });
    stroke.appendConfirmed([{ documentX: 10, documentY: 0 }]);

    expect(stroke.finishConfirmed().map((dab) => dab.x)).toEqual([10]);
    expect(stroke.dabs().map((dab) => dab.x)).toEqual([0, 4, 8, 10]);
    expect(stroke.snapshot().finished).toBe(true);
    expect(stroke.finishConfirmed()).toEqual([]);
  });
});
