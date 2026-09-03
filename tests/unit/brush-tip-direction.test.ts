import { describe, expect, it } from 'vitest';
import {
  brushTipDirectionDegreesV1,
  createBaselineBrushPresetV1,
  withBrushTipDirectionDegreesV1,
} from '../../src/domain/brush-schema.js';
import { BaselineBrushDabBuilderV1 } from '../../src/gpu/baseline-brush.js';

describe('M6A-025 brush tip direction', () => {
  it('normalizes the asset-local forward direction independently from tip angle', () => {
    const preset = createBaselineBrushPresetV1({
      id: 'direction.paint',
      name: 'Paint',
      category: 'Test',
      behavior: 'paint',
    });
    expect(brushTipDirectionDegreesV1(preset)).toBe(0);
    expect(brushTipDirectionDegreesV1(withBrushTipDirectionDegreesV1(preset, 450))).toBe(90);
    expect(brushTipDirectionDegreesV1(withBrushTipDirectionDegreesV1(preset, -90))).toBe(270);
  });

  it('calibrates an asset-local forward direction before sampled-tip expansion', () => {
    const alpha = Array.from({ length: 25 }, () => 0);
    alpha[2] = 255;
    const direct = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      tipShape: 'sampled-image',
      sampledTipAlpha: alpha,
      tipAngleDegrees: 270,
    }).begin({ documentX: 20, documentY: 20 });
    const calibrated = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      tipShape: 'sampled-image',
      sampledTipAlpha: alpha,
      tipAngleDegrees: 0,
      tipDirectionDegrees: 90,
    }).begin({ documentX: 20, documentY: 20 });
    expect(calibrated).toHaveLength(1);
    expect(calibrated[0]?.x).toBeCloseTo(direct[0]?.x ?? Number.NaN, 6);
    expect(calibrated[0]?.y).toBeCloseTo(direct[0]?.y ?? Number.NaN, 6);
    expect(calibrated[0]?.tipAngleDegrees).toBe(270);
  });

  it('composes static tip angle minus forward direction into the resolved dab angle', () => {
    const [dab] = new BaselineBrushDabBuilderV1({
      tipShape: 'square',
      tipAngleDegrees: 45,
      tipDirectionDegrees: 90,
    }).begin({ documentX: 10, documentY: 10 });
    expect(dab?.tipAngleDegrees).toBe(315);
  });
});
