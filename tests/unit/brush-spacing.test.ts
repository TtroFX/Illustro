import { describe, expect, it } from 'vitest';
import {
  brushStrokeSpacingV1,
  createBaselineBrushPresetV1,
  withBrushStrokeSpacingV1,
} from '../../src/domain/brush-schema.js';
import { BaselineBrushDabBuilderV1 } from '../../src/gpu/baseline-brush.js';

describe('M6A-023 brush spacing / gap', () => {
  it('uses the canonical 25% / 1px preset fallback and persists spacing ratio', () => {
    const preset = createBaselineBrushPresetV1({
      id: 'spacing.paint',
      name: 'Paint',
      category: 'Test',
      behavior: 'paint',
    });
    expect(brushStrokeSpacingV1(preset)).toEqual({ spacingRatio: 0.25, minimumStampDistancePx: 1 });
    const wide = withBrushStrokeSpacingV1(preset, 0.5);
    expect(brushStrokeSpacingV1(wide)).toEqual({ spacingRatio: 0.5, minimumStampDistancePx: 1 });
    expect(() => withBrushStrokeSpacingV1(preset, 0)).toThrow(RangeError);
    expect(() => withBrushStrokeSpacingV1(preset, 4.01)).toThrow(RangeError);
  });

  it('changes deterministic logical stamp gap while retaining the stroke endpoint', () => {
    const builder = new BaselineBrushDabBuilderV1({
      sizePx: 16,
      spacingRatio: 0.5,
      minimumStampDistancePx: 1,
    });
    builder.begin({ documentX: 0, documentY: 8 });
    builder.append([{ documentX: 20, documentY: 8 }]);
    expect(builder.finish().map((dab) => dab.x)).toEqual([0, 8, 16, 20]);
  });

  it('enforces the preset minimum stamp distance for tiny brush sizes', () => {
    const builder = new BaselineBrushDabBuilderV1({
      sizePx: 1,
      spacingRatio: 0.01,
      minimumStampDistancePx: 1,
    });
    builder.begin({ documentX: 0, documentY: 0 });
    builder.append([{ documentX: 2.5, documentY: 0 }]);
    expect(builder.finish().map((dab) => dab.x)).toEqual([0, 1, 2, 2.5]);
  });
});
