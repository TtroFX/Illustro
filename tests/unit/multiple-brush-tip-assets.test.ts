import { describe, expect, it } from 'vitest';
import {
  brushSampledTipAlphaV1,
  brushSelectedTipAssetIdV1,
  brushTipAssetsV1,
  createBaselineBrushPresetV1,
  withBrushCustomSampledTipV1,
  withBrushTipAssetAddedV1,
  withBrushTipAssetDeletedV1,
  withBrushTipAssetReplacementV1,
  withBrushTipAssetSelectionV1,
} from '../../src/domain/brush-schema.js';
import {
  addBrushPresetTipAssetV1,
  createBrushPresetLibraryStateV1,
  parseBrushPresetLibraryV1,
  selectedBrushPresetItemV1,
  serializeBrushPresetLibraryV1,
  selectBrushPresetTipAssetV1,
  updateBrushPresetCustomTipV1,
} from '../../src/app/brush-preset-library.js';
import { BaselineBrushDabBuilderV1 } from '../../src/gpu/baseline-brush.js';

function mask(index: number, value = 255): readonly number[] {
  const result = Array.from({ length: 25 }, () => 0);
  result[index] = value;
  return Object.freeze(result);
}

describe('M6A-020 multiple tip assets without Dual Brush semantics', () => {
  it('promotes an existing single custom tip into a preset-local asset collection', () => {
    const base = createBaselineBrushPresetV1({
      id: 'asset.test',
      name: 'Asset Test',
      category: 'Test',
      behavior: 'paint',
    });
    const first = withBrushCustomSampledTipV1(base, mask(0));
    const multiple = withBrushTipAssetAddedV1(first, {
      id: 'second',
      name: '先端 2',
      alpha: mask(24),
    });
    expect(brushTipAssetsV1(multiple)).toHaveLength(2);
    expect(brushTipAssetsV1(multiple)[0]?.alpha).toEqual(mask(0));
    expect(brushSelectedTipAssetIdV1(multiple)).toBe('second');
    expect(brushSampledTipAlphaV1(multiple)).toEqual(mask(24));
  });

  it('switches exactly one active asset and never merges two masks as Dual Brush', () => {
    const base = withBrushCustomSampledTipV1(
      createBaselineBrushPresetV1({
        id: 'single-active.test',
        name: 'Single Active',
        category: 'Test',
        behavior: 'paint',
      }),
      mask(0),
    );
    const multiple = withBrushTipAssetAddedV1(base, {
      id: 'right',
      name: 'Right',
      alpha: mask(24),
    });
    const left = withBrushTipAssetSelectionV1(multiple, 'm6a019-custom');
    const builder = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      tipShape: 'sampled-image',
      sampledTipAlpha: brushSampledTipAlphaV1(left) ?? undefined,
    });
    const dabs = builder.begin({ documentX: 32, documentY: 32 });
    expect(dabs).toHaveLength(1);
    expect(dabs[0]?.x).toBeLessThan(32);
    expect(dabs[0]?.y).toBeLessThan(32);
  });

  it('replaces the selected asset in-place and preserves the other assets', () => {
    const base = withBrushCustomSampledTipV1(
      createBaselineBrushPresetV1({
        id: 'replace.test',
        name: 'Replace',
        category: 'Test',
        behavior: 'paint',
      }),
      mask(0),
    );
    const multiple = withBrushTipAssetAddedV1(base, {
      id: 'second',
      name: 'Second',
      alpha: mask(24),
    });
    const replaced = withBrushTipAssetReplacementV1(multiple, 'second', mask(12, 180));
    expect(brushTipAssetsV1(replaced)).toHaveLength(2);
    expect(brushTipAssetsV1(replaced).find((asset) => asset.id === 'm6a019-custom')?.alpha).toEqual(
      mask(0),
    );
    expect(brushSampledTipAlphaV1(replaced)).toEqual(mask(12, 180));
    const deleted = withBrushTipAssetDeletedV1(replaced, 'm6a019-custom');
    expect(brushTipAssetsV1(deleted).map((asset) => asset.id)).toEqual(['second']);
  });

  it('persists asset collection and selected identity through the existing preset library envelope', () => {
    let state = createBrushPresetLibraryStateV1();
    state = updateBrushPresetCustomTipV1(state, state.selectedPresetId, mask(0));
    state = addBrushPresetTipAssetV1(state, state.selectedPresetId, {
      id: 'second',
      name: 'Second',
      alpha: mask(24),
    });
    state = selectBrushPresetTipAssetV1(state, state.selectedPresetId, 'm6a019-custom');
    const restored = parseBrushPresetLibraryV1(serializeBrushPresetLibraryV1(state));
    const preset = selectedBrushPresetItemV1(restored).preset;
    expect(brushTipAssetsV1(preset)).toHaveLength(2);
    expect(brushSelectedTipAssetIdV1(preset)).toBe('m6a019-custom');
    expect(brushSampledTipAlphaV1(preset)).toEqual(mask(0));
  });
});
