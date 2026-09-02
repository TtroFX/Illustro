import { describe, expect, it } from 'vitest';
import {
  brushParameterLimitsV1,
  brushParameterValuesV1,
  createBaselineBrushPresetV1,
  normalizeBrushPresetV1,
} from '../../src/domain/brush-schema.js';
import {
  createBrushPresetLibraryStateV1,
  selectedBrushPresetItemV1,
  setBrushPresetLockedV1,
  updateBrushPresetParametersV1,
} from '../../src/app/brush-preset-library.js';
import { CanonicalRasterBrushStrokeV1 } from '../../src/app/canonical-raster-brush.js';
import {
  BaselineRasterTileStoreV1,
  readBaselineRasterTilePixelV1,
} from '../../src/gpu/baseline-raster-tile-store.js';

describe('M6A-013..016 brush properties', () => {
  it('generates size-relative radius and spacing from the captured stroke size', () => {
    const stroke = new CanonicalRasterBrushStrokeV1({ sizePx: 40 });
    stroke.beginConfirmed({ documentX: 0, documentY: 0 });
    stroke.appendConfirmed([{ documentX: 20, documentY: 0 }]);
    expect(stroke.dabs().map((dab) => dab.x)).toEqual([0, 10, 20]);
    expect(stroke.dabs().every((dab) => dab.radius === 20)).toBe(true);
  });

  it('stores opacity as a stroke cap and flow as per-dab deposit', () => {
    const stroke = new CanonicalRasterBrushStrokeV1({ opacity: 0.5, flow: 0.25 });
    const [dab] = stroke.beginConfirmed({ documentX: 16, documentY: 16 });
    expect(dab).toMatchObject({ opacity: 0.125, flow: 0.25, strokeOpacity: 0.5 });
  });

  it('caps accumulated paint alpha at stroke opacity while repeated flow deposits build toward it', () => {
    const stroke = new CanonicalRasterBrushStrokeV1({ sizePx: 16, opacity: 0.5, flow: 0.25 });
    const [dab] = stroke.beginConfirmed({ documentX: 16, documentY: 16 });
    expect(dab).toBeDefined();
    const store = new BaselineRasterTileStoreV1(64, 64, 'rgba8-unorm', [
      Object.freeze({ layerId: 'layer-1', visible: true, opacity: 1 }),
    ]);
    const repeated = Array.from({ length: 32 }, () => dab!);
    store.applyDabs('layer-1', 'stroke-1', repeated, 'paint');
    store.finalize('stroke-1');
    const tile = store.exportTiles()[0];
    expect(tile).toBeDefined();
    const alpha = readBaselineRasterTilePixelV1(tile!, 16 * 64 + 16)[3];
    expect(alpha).toBeGreaterThan(0.45);
    expect(alpha).toBeLessThanOrEqual(0.505);
  });

  it('enforces parameter limits stored per preset and marks edits Modified/resettable', () => {
    const custom = normalizeBrushPresetV1({
      ...createBaselineBrushPresetV1({
        id: 'limited',
        name: 'Limited',
        category: 'Test',
        behavior: 'paint',
      }),
      extensions: {
        parameterLimits: {
          sizePx: { min: 4, max: 64 },
          opacity: { min: 0.2, max: 0.8 },
          flow: { min: 0.1, max: 0.6 },
        },
      },
    });
    expect(brushParameterLimitsV1(custom)).toEqual({
      sizePx: { min: 4, max: 64 },
      opacity: { min: 0.2, max: 0.8 },
      flow: { min: 0.1, max: 0.6 },
    });
    expect(brushParameterValuesV1(custom)).toEqual({ sizePx: 16, opacity: 0.8, flow: 0.6 });

    let state = createBrushPresetLibraryStateV1([custom]);
    state = updateBrushPresetParametersV1(state, 'limited', {
      sizePx: 999,
      opacity: 0.05,
      flow: 1,
    });
    expect(brushParameterValuesV1(selectedBrushPresetItemV1(state).preset)).toEqual({
      sizePx: 64,
      opacity: 0.2,
      flow: 0.6,
    });
    expect(selectedBrushPresetItemV1(state).modified).toBe(true);
    state = setBrushPresetLockedV1(state, 'limited', true);
    expect(() => updateBrushPresetParametersV1(state, 'limited', { sizePx: 32 })).toThrow(/locked/);
  });
});
