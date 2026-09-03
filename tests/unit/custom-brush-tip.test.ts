import { describe, expect, it } from 'vitest';
import { customBrushTipAlphaFromRgbaV1 } from '../../src/app/custom-brush-tip.js';
import {
  brushSampledTipAlphaV1,
  brushTipShapeV1,
  createBaselineBrushPresetV1,
  withBrushCustomSampledTipV1,
} from '../../src/domain/brush-schema.js';
import {
  createBrushPresetLibraryStateV1,
  parseBrushPresetLibraryV1,
  selectedBrushPresetItemV1,
  serializeBrushPresetLibraryV1,
  updateBrushPresetCustomTipV1,
} from '../../src/app/brush-preset-library.js';
import { BaselineBrushDabBuilderV1 } from '../../src/gpu/baseline-brush.js';

function maskAt(index: number, value = 255): readonly number[] {
  const alpha = Array.from({ length: 25 }, () => 0);
  alpha[index] = value;
  return Object.freeze(alpha);
}

describe('M6A-019 custom brush tip creation', () => {
  it('converts a 5x5 RGBA image into a deterministic custom alpha mask', () => {
    const rgba = new Uint8ClampedArray(25 * 4);
    for (let index = 0; index < 25; index += 1) {
      const offset = index * 4;
      rgba[offset] = 255;
      rgba[offset + 1] = 255;
      rgba[offset + 2] = 255;
      rgba[offset + 3] = 255;
    }
    rgba[0] = 0;
    rgba[1] = 0;
    rgba[2] = 0;
    rgba[3] = 255;
    rgba[4] = 0;
    rgba[5] = 0;
    rgba[6] = 0;
    rgba[7] = 128;
    const alpha = customBrushTipAlphaFromRgbaV1(rgba);
    expect(alpha).toHaveLength(25);
    expect(alpha[0]).toBe(255);
    expect(alpha[1]).toBe(128);
    expect(alpha[2]).toBe(0);
  });

  it('stores one custom sampled tip directly in the selected illustro.brush/1 preset', () => {
    const baseline = createBaselineBrushPresetV1({
      id: 'custom.tip.test',
      name: 'Custom Tip',
      category: 'Test',
      behavior: 'paint',
    });
    const alpha = maskAt(12);
    const custom = withBrushCustomSampledTipV1(baseline, alpha);
    expect(custom.schema).toBe('illustro.brush/1');
    expect(custom.tip.kind).toBe('sampled-image-custom');
    expect(custom.tip.side).toBe(5);
    expect(brushTipShapeV1(custom)).toBe('sampled-image');
    expect(brushSampledTipAlphaV1(custom)).toEqual(alpha);
  });

  it('persists the selected custom tip through the existing preset-library storage envelope', () => {
    const state = createBrushPresetLibraryStateV1();
    const changed = updateBrushPresetCustomTipV1(state, state.selectedPresetId, maskAt(7, 192));
    const restored = parseBrushPresetLibraryV1(serializeBrushPresetLibraryV1(changed));
    const preset = selectedBrushPresetItemV1(restored).preset;
    expect(preset.tip.kind).toBe('sampled-image-custom');
    expect(brushSampledTipAlphaV1(preset)?.[7]).toBe(192);
  });

  it('uses the custom alpha mask for primitive expansion without duplicating a center-empty endpoint', () => {
    const alpha = maskAt(0);
    const builder = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      tipShape: 'sampled-image',
      sampledTipAlpha: alpha,
    });
    builder.begin({ documentX: 32, documentY: 32 });
    const dabs = builder.finish();
    expect(dabs).toHaveLength(1);
    expect(dabs[0]?.tipShape).toBe('round');
    expect(dabs[0]?.x).toBeLessThan(32);
    expect(dabs[0]?.y).toBeLessThan(32);
  });
});
