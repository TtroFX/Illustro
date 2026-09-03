import { describe, expect, it } from 'vitest';
import {
  brushFollowStrokeRotationV1,
  createBaselineBrushPresetV1,
  withBrushFollowStrokeRotationV1,
} from '../../src/domain/brush-schema.js';
import { BaselineBrushDabBuilderV1 } from '../../src/gpu/baseline-brush.js';

describe('M6A-026 follow stroke rotation', () => {
  it('defaults legacy presets to fixed orientation and persists an explicit follow flag', () => {
    const preset = createBaselineBrushPresetV1({
      id: 'follow.paint',
      name: 'Paint',
      category: 'Test',
      behavior: 'paint',
    });
    expect(brushFollowStrokeRotationV1(preset)).toBe(false);
    expect(brushFollowStrokeRotationV1(withBrushFollowStrokeRotationV1(preset, true))).toBe(true);
  });

  it('rotates only newly emitted stamps from the local stroke tangent without rewriting the stable prefix', () => {
    const builder = new BaselineBrushDabBuilderV1({
      sizePx: 16,
      tipShape: 'square',
      tipAngleDegrees: 45,
      tipDirectionDegrees: 90,
      followStrokeRotation: true,
    });
    builder.begin({ documentX: 0, documentY: 0 });
    builder.append([{ documentX: 8, documentY: 0 }]);
    builder.append([{ documentX: 8, documentY: 8 }]);
    const dabs = builder.finish();
    expect(dabs.map((dab) => [dab.x, dab.y])).toEqual([
      [0, 0],
      [4, 0],
      [8, 0],
      [8, 4],
      [8, 8],
    ]);
    expect(dabs.map((dab) => dab.tipAngleDegrees)).toEqual([315, 315, 315, 45, 45]);
  });

  it('uses the last confirmed movement direction for a retained short endpoint', () => {
    const builder = new BaselineBrushDabBuilderV1({
      sizePx: 16,
      spacingRatio: 1,
      tipShape: 'square',
      tipAngleDegrees: 45,
      tipDirectionDegrees: 90,
      followStrokeRotation: true,
    });
    builder.begin({ documentX: 0, documentY: 0 });
    builder.append([{ documentX: 0, documentY: 3 }]);
    const dabs = builder.finish();
    expect(dabs.map((dab) => [dab.x, dab.y])).toEqual([
      [0, 0],
      [0, 3],
    ]);
    expect(dabs.map((dab) => dab.tipAngleDegrees)).toEqual([315, 45]);
  });

  it('keeps static angle minus tip direction when follow rotation is disabled', () => {
    const builder = new BaselineBrushDabBuilderV1({
      sizePx: 16,
      tipShape: 'square',
      tipAngleDegrees: 45,
      tipDirectionDegrees: 90,
      followStrokeRotation: false,
    });
    builder.begin({ documentX: 0, documentY: 0 });
    builder.append([{ documentX: 0, documentY: 8 }]);
    expect(builder.finish().map((dab) => dab.tipAngleDegrees)).toEqual([315, 315, 315]);
  });
});
