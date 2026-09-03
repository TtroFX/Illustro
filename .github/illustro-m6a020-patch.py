from pathlib import Path


def read(path: str) -> str:
    return Path(path).read_text(encoding='utf-8')


def write(path: str, content: str) -> None:
    Path(path).write_text(content, encoding='utf-8')


def replace_once(path: str, before: str, after: str) -> None:
    source = read(path)
    count = source.count(before)
    if count != 1:
        raise RuntimeError(f'{path}: expected exactly one replacement, found {count}')
    write(path, source.replace(before, after, 1))


def insert_before(path: str, marker: str, block: str) -> None:
    replace_once(path, marker, block.rstrip() + '\n' + marker)


def append_once(path: str, marker: str, block: str) -> None:
    source = read(path)
    if marker in source:
        return
    write(path, source.rstrip() + '\n\n' + block.strip() + '\n')


def write_new(path: str, content: str) -> None:
    target = Path(path)
    if target.exists():
        raise RuntimeError(f'{path}: already exists')
    target.write_text(content.strip() + '\n', encoding='utf-8')


# Canonical preset-local tip-asset collection. Runtime still receives one active tip only.
replace_once(
    'src/domain/brush-schema.ts',
    "export type BrushSampledTipAlphaV1 = readonly number[];\n",
    """export type BrushSampledTipAlphaV1 = readonly number[];
export const BRUSH_TIP_ASSET_LIMIT_V1 = 16 as const;
export interface BrushTipAssetV1 {
  readonly id: string;
  readonly name: string;
  readonly alpha: BrushSampledTipAlphaV1;
}
""",
)

insert_before(
    'src/domain/brush-schema.ts',
    'export function brushSampledTipAlphaV1(preset: BrushPresetV1): BrushSampledTipAlphaV1 | null {',
    """function normalizedTipAssetTextV1(value: unknown, label: string, maximum: number): string {
  if (typeof value !== 'string') throw new TypeError(label + ' must be text');
  const normalized = value.trim();
  if (normalized.length < 1 || normalized.length > maximum) {
    throw new RangeError(label + ' must be 1..' + maximum + ' characters');
  }
  return normalized;
}

function normalizeBrushTipAssetV1(value: JsonValue, index: number): BrushTipAssetV1 {
  const record = jsonRecord(value);
  if (record === null) throw new TypeError('brush tip asset ' + index + ' must be an object');
  if (record.side !== CUSTOM_SAMPLED_IMAGE_BRUSH_TIP_SIDE_V1) {
    throw new RangeError('brush tip asset side must be 5');
  }
  return Object.freeze({
    id: normalizedTipAssetTextV1(record.id, 'brush tip asset id', 120),
    name: normalizedTipAssetTextV1(record.name, 'brush tip asset name', 80),
    alpha: freezeCustomSampledTipAlphaV1(record.alpha),
  });
}

function brushTipAssetStateV1(extensions: BrushPresetSectionV1): Readonly<{
  assets: readonly BrushTipAssetV1[];
  selectedAssetId: string | null;
}> {
  const rawAssets = extensions.tipAssets;
  const rawSelected = extensions.selectedTipAssetId;
  if (rawAssets === undefined) {
    if (rawSelected !== undefined) throw new TypeError('selected tip asset requires a tip asset collection');
    return Object.freeze({ assets: Object.freeze([]), selectedAssetId: null });
  }
  if (!Array.isArray(rawAssets) || rawAssets.length < 1 || rawAssets.length > BRUSH_TIP_ASSET_LIMIT_V1) {
    throw new RangeError('brush tip assets must contain 1..' + BRUSH_TIP_ASSET_LIMIT_V1 + ' items');
  }
  const assets = Object.freeze(rawAssets.map((value, index) => normalizeBrushTipAssetV1(value, index)));
  const ids = new Set<string>();
  for (const asset of assets) {
    if (ids.has(asset.id)) throw new TypeError('duplicate brush tip asset id: ' + asset.id);
    ids.add(asset.id);
  }
  if (typeof rawSelected !== 'string' || !ids.has(rawSelected)) {
    throw new RangeError('selected brush tip asset is missing');
  }
  return Object.freeze({ assets, selectedAssetId: rawSelected });
}

export function brushTipAssetsV1(preset: BrushPresetV1): readonly BrushTipAssetV1[] {
  return brushTipAssetStateV1(preset.extensions).assets;
}

export function brushSelectedTipAssetIdV1(preset: BrushPresetV1): string | null {
  return brushTipAssetStateV1(preset.extensions).selectedAssetId;
}

""",
)

insert_before(
    'src/domain/brush-schema.ts',
    'export interface BrushPresetV1 {',
    """function serializedBrushTipAssetV1(asset: BrushTipAssetV1): JsonValue {
  return {
    id: asset.id,
    name: asset.name,
    side: CUSTOM_SAMPLED_IMAGE_BRUSH_TIP_SIDE_V1,
    alpha: [...asset.alpha],
  };
}

function withBrushTipAssetStateV1(
  preset: BrushPresetV1,
  assets: readonly BrushTipAssetV1[],
  selectedAssetId: string,
): BrushPresetV1 {
  const selected = assets.find((asset) => asset.id === selectedAssetId);
  if (selected === undefined) throw new RangeError('selected brush tip asset is missing');
  return normalizeBrushPresetV1({
    ...preset,
    tip: {
      ...brushTipBaseV1(preset.tip),
      kind: 'sampled-image-custom',
      side: CUSTOM_SAMPLED_IMAGE_BRUSH_TIP_SIDE_V1,
      alpha: [...selected.alpha],
    },
    extensions: {
      ...preset.extensions,
      tipAssets: assets.map(serializedBrushTipAssetV1),
      selectedTipAssetId: selectedAssetId,
    },
  });
}

export function withBrushTipAssetAddedV1(
  preset: BrushPresetV1,
  asset: BrushTipAssetV1,
): BrushPresetV1 {
  const currentAssets = [...brushTipAssetsV1(preset)];
  if (currentAssets.length === 0 && preset.tip.kind === 'sampled-image-custom') {
    const existingAlpha = brushSampledTipAlphaV1(preset);
    if (existingAlpha !== null) {
      currentAssets.push(
        Object.freeze({ id: 'm6a019-custom', name: '先端 1', alpha: existingAlpha }),
      );
    }
  }
  if (currentAssets.length >= BRUSH_TIP_ASSET_LIMIT_V1) {
    throw new RangeError('brush tip asset limit reached');
  }
  const normalized = normalizeBrushTipAssetV1(
    {
      id: asset.id,
      name: asset.name,
      side: CUSTOM_SAMPLED_IMAGE_BRUSH_TIP_SIDE_V1,
      alpha: [...asset.alpha],
    },
    currentAssets.length,
  );
  if (currentAssets.some((entry) => entry.id === normalized.id)) {
    throw new RangeError('brush tip asset id already exists');
  }
  return withBrushTipAssetStateV1(preset, [...currentAssets, normalized], normalized.id);
}

export function withBrushTipAssetSelectionV1(
  preset: BrushPresetV1,
  assetId: string,
): BrushPresetV1 {
  const assets = brushTipAssetsV1(preset);
  if (!assets.some((asset) => asset.id === assetId)) throw new RangeError('brush tip asset not found');
  return withBrushTipAssetStateV1(preset, assets, assetId);
}

export function withBrushTipAssetReplacementV1(
  preset: BrushPresetV1,
  assetId: string,
  alpha: BrushSampledTipAlphaV1,
): BrushPresetV1 {
  const normalizedAlpha = freezeCustomSampledTipAlphaV1(alpha);
  const assets = brushTipAssetsV1(preset).map((asset) =>
    asset.id === assetId ? Object.freeze({ ...asset, alpha: normalizedAlpha }) : asset,
  );
  if (!assets.some((asset) => asset.id === assetId)) throw new RangeError('brush tip asset not found');
  return withBrushTipAssetStateV1(preset, assets, assetId);
}

export function withBrushTipAssetDeletedV1(
  preset: BrushPresetV1,
  assetId: string,
): BrushPresetV1 {
  const assets = brushTipAssetsV1(preset);
  if (!assets.some((asset) => asset.id === assetId)) throw new RangeError('brush tip asset not found');
  if (assets.length <= 1) throw new RangeError('at least one brush tip asset must remain');
  const remaining = assets.filter((asset) => asset.id !== assetId);
  const selectedAssetId = brushSelectedTipAssetIdV1(preset);
  const nextSelected =
    selectedAssetId === assetId || selectedAssetId === null
      ? (remaining[0]?.id ?? '')
      : selectedAssetId;
  return withBrushTipAssetStateV1(preset, remaining, nextSelected);
}

""",
)

replace_once(
    'src/domain/brush-schema.ts',
    """  const tip = normalizeSection(input.tip, 'brush tip');
  if (tip.kind === 'sampled-image-custom') {
    if (tip.side !== CUSTOM_SAMPLED_IMAGE_BRUSH_TIP_SIDE_V1) {
      throw new RangeError('unsupported custom sampled brush tip side');
    }
    freezeCustomSampledTipAlphaV1(tip.alpha);
  }
  return Object.freeze({
""",
    """  const tip = normalizeSection(input.tip, 'brush tip');
  if (tip.kind === 'sampled-image-custom') {
    if (tip.side !== CUSTOM_SAMPLED_IMAGE_BRUSH_TIP_SIDE_V1) {
      throw new RangeError('unsupported custom sampled brush tip side');
    }
    freezeCustomSampledTipAlphaV1(tip.alpha);
  }
  const extensions = normalizeSection(input.extensions, 'brush extensions');
  brushTipAssetStateV1(extensions);
  return Object.freeze({
""",
)
replace_once(
    'src/domain/brush-schema.ts',
    "    extensions: normalizeSection(input.extensions, 'brush extensions'),\n",
    "    extensions,\n",
)

# Library mutations keep preset revision/lock semantics and update only one active asset at a time.
replace_once(
    'src/app/brush-preset-library.ts',
    """  BRUSH_V1_SCHEMA,
  createBaselineBrushPresetV1,
  normalizeBrushPresetV1,
  withBrushCustomSampledTipV1,
""",
    """  BRUSH_V1_SCHEMA,
  brushSelectedTipAssetIdV1,
  brushTipAssetsV1,
  createBaselineBrushPresetV1,
  normalizeBrushPresetV1,
  withBrushCustomSampledTipV1,
  withBrushTipAssetAddedV1,
  withBrushTipAssetDeletedV1,
  withBrushTipAssetReplacementV1,
  withBrushTipAssetSelectionV1,
""",
)
replace_once(
    'src/app/brush-preset-library.ts',
    """  type BrushSampledTipAlphaV1,
  type BrushTipShapeV1,
  type BrushPresetV1,
""",
    """  type BrushSampledTipAlphaV1,
  type BrushTipAssetV1,
  type BrushTipShapeV1,
  type BrushPresetV1,
""",
)
replace_once(
    'src/app/brush-preset-library.ts',
    """    const current = withBrushCustomSampledTipV1(item.preset, alpha);
""",
    """    const selectedAssetId = brushSelectedTipAssetIdV1(item.preset);
    const current =
      brushTipAssetsV1(item.preset).length > 0 && selectedAssetId !== null
        ? withBrushTipAssetReplacementV1(item.preset, selectedAssetId, alpha)
        : withBrushCustomSampledTipV1(item.preset, alpha);
""",
)
insert_before(
    'src/app/brush-preset-library.ts',
    'export function deleteBrushPresetV1(',
    """export function addBrushPresetTipAssetV1(
  state: BrushPresetLibraryStateV1,
  presetId: string,
  asset: BrushTipAssetV1,
): BrushPresetLibraryStateV1 {
  return updateItemV1(state, presetId, (item) => {
    if (item.locked) throw new Error('locked brush preset cannot be edited');
    const current = withBrushTipAssetAddedV1(item.preset, asset);
    const next = normalizeBrushPresetV1({ ...current, revision: item.preset.revision + 1 });
    return itemV1({ source: item.source, baseline: item.baseline, preset: next, locked: item.locked });
  });
}

export function selectBrushPresetTipAssetV1(
  state: BrushPresetLibraryStateV1,
  presetId: string,
  assetId: string,
): BrushPresetLibraryStateV1 {
  return updateItemV1(state, presetId, (item) => {
    if (item.locked) throw new Error('locked brush preset cannot be edited');
    const current = withBrushTipAssetSelectionV1(item.preset, assetId);
    if (JSON.stringify(current) === JSON.stringify(item.preset)) return item;
    const next = normalizeBrushPresetV1({ ...current, revision: item.preset.revision + 1 });
    return itemV1({ source: item.source, baseline: item.baseline, preset: next, locked: item.locked });
  });
}

export function deleteBrushPresetTipAssetV1(
  state: BrushPresetLibraryStateV1,
  presetId: string,
  assetId: string,
): BrushPresetLibraryStateV1 {
  return updateItemV1(state, presetId, (item) => {
    if (item.locked) throw new Error('locked brush preset cannot be edited');
    const current = withBrushTipAssetDeletedV1(item.preset, assetId);
    const next = normalizeBrushPresetV1({ ...current, revision: item.preset.revision + 1 });
    return itemV1({ source: item.source, baseline: item.baseline, preset: next, locked: item.locked });
  });
}

""",
)

# Reachable Inspector UI: collection + explicit active selection; no simultaneous combination.
replace_once(
    'src/app/brush-preset-controller.ts',
    """  brushParameterLimitsV1,
  brushParameterValuesV1,
  brushSampledTipAlphaV1,
  brushTipShapeV1,
""",
    """  BRUSH_TIP_ASSET_LIMIT_V1,
  brushParameterLimitsV1,
  brushParameterValuesV1,
  brushSampledTipAlphaV1,
  brushSelectedTipAssetIdV1,
  brushTipAssetsV1,
  brushTipShapeV1,
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  brushPresetCategoriesV1,
  createBrushPresetLibraryStateV1,
""",
    """  addBrushPresetTipAssetV1,
  brushPresetCategoriesV1,
  createBrushPresetLibraryStateV1,
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  resetBrushPresetV1,
  selectBrushPresetV1,
  selectedBrushPresetItemV1,
""",
    """  resetBrushPresetV1,
  selectBrushPresetTipAssetV1,
  selectBrushPresetV1,
  selectedBrushPresetItemV1,
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  setBrushPresetSearchV1,
  updateBrushPresetCustomTipV1,
""",
    """  setBrushPresetSearchV1,
  deleteBrushPresetTipAssetV1,
  updateBrushPresetCustomTipV1,
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  const customTipStatus = requireElement('#brush-tip-custom-status', HTMLOutputElement);
  const customTipPreview = requireElement('#brush-tip-custom-preview', HTMLCanvasElement);
  let state = loadState(storage);
""",
    """  const customTipStatus = requireElement('#brush-tip-custom-status', HTMLOutputElement);
  const customTipPreview = requireElement('#brush-tip-custom-preview', HTMLCanvasElement);
  const tipAssetSelect = requireElement('#brush-tip-asset-select', HTMLSelectElement);
  const tipAssetAdd = requireElement('#brush-tip-asset-add', HTMLButtonElement);
  const tipAssetDelete = requireElement('#brush-tip-asset-delete', HTMLButtonElement);
  const tipAssetFile = requireElement('#brush-tip-asset-file', HTMLInputElement);
  const tipAssetStatus = requireElement('#brush-tip-asset-status', HTMLOutputElement);
  let state = loadState(storage);
""",
)
insert_before(
    'src/app/brush-preset-controller.ts',
    '  const persist = (): void => {',
    """  const nextTipAssetId = (): string => {
    idCounter += 1;
    const uuid = globalThis.crypto?.randomUUID?.();
    return uuid === undefined
      ? 'user.tip.' + Date.now().toString(36) + '.' + idCounter.toString(36)
      : 'user.tip.' + uuid;
  };

""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    const customTipAlpha = brushSampledTipAlphaV1(selected.preset);
    customTipStatus.textContent = customTipAlpha === null ? '標準サンプル' : 'カスタム 5×5';
    customTipPreview.hidden = customTipAlpha === null;
    drawCustomBrushTipPreviewV1(customTipPreview, customTipAlpha);
""",
    """    const customTipAlpha = brushSampledTipAlphaV1(selected.preset);
    const tipAssets = brushTipAssetsV1(selected.preset);
    const selectedTipAssetId = brushSelectedTipAssetIdV1(selected.preset);
    customTipStatus.textContent =
      customTipAlpha === null
        ? tipAssets.length > 0
          ? '保存済み ' + tipAssets.length + ' assets'
          : '標準サンプル'
        : tipAssets.length > 0
          ? 'カスタム 5×5 · ' + tipAssets.length + ' assets'
          : 'カスタム 5×5';
    customTipPreview.hidden = customTipAlpha === null;
    drawCustomBrushTipPreviewV1(customTipPreview, customTipAlpha);
    tipAssetSelect.replaceChildren();
    if (tipAssets.length === 0) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = '未登録';
      tipAssetSelect.append(option);
    } else {
      for (const asset of tipAssets) {
        const option = document.createElement('option');
        option.value = asset.id;
        option.textContent = asset.name;
        tipAssetSelect.append(option);
      }
      tipAssetSelect.value = selectedTipAssetId ?? tipAssets[0]?.id ?? '';
    }
    tipAssetStatus.textContent = tipAssets.length + '/' + BRUSH_TIP_ASSET_LIMIT_V1;
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    duplicateButton.disabled = false;
    renameButton.disabled = locked;
""",
    """    tipAssetSelect.disabled = locked || tipAssets.length === 0;
    tipAssetAdd.disabled = locked || tipAssets.length >= BRUSH_TIP_ASSET_LIMIT_V1;
    tipAssetDelete.disabled = locked || tipAssets.length <= 1;
    tipAssetFile.disabled = locked;
    duplicateButton.disabled = false;
    renameButton.disabled = locked;
""",
)
insert_before(
    'src/app/brush-preset-controller.ts',
    "  search.addEventListener('input', onSearch);",
    """  const onTipAssetAdd = (): void => {
    tipAssetFile.value = '';
    tipAssetFile.click();
  };
  const onTipAssetFile = async (): Promise<void> => {
    const file = tipAssetFile.files?.[0];
    if (file === undefined) return;
    try {
      const alpha = await customBrushTipAlphaFromFileV1(file);
      const count = brushTipAssetsV1(selectedBrushPresetItemV1(state).preset).length;
      state = addBrushPresetTipAssetV1(state, state.selectedPresetId, {
        id: nextTipAssetId(),
        name: '先端 ' + (count + 1),
        alpha,
      });
      persist();
      applySelected();
      render();
      status.textContent = '先端アセットを追加しました';
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : '先端アセットの追加に失敗しました';
    }
  };
  const onTipAssetSelect = (): void => {
    if (tipAssetSelect.value === '') return;
    mutate(() =>
      selectBrushPresetTipAssetV1(state, state.selectedPresetId, tipAssetSelect.value),
    );
  };
  const onTipAssetDelete = (): void => {
    const assetId = brushSelectedTipAssetIdV1(selectedBrushPresetItemV1(state).preset);
    if (assetId === null) return;
    mutate(() => deleteBrushPresetTipAssetV1(state, state.selectedPresetId, assetId));
  };
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  customTipCreate.addEventListener('click', onCustomTipCreate);
  customTipFile.addEventListener('change', onCustomTipFile);
""",
    """  customTipCreate.addEventListener('click', onCustomTipCreate);
  customTipFile.addEventListener('change', onCustomTipFile);
  tipAssetAdd.addEventListener('click', onTipAssetAdd);
  tipAssetFile.addEventListener('change', onTipAssetFile);
  tipAssetSelect.addEventListener('change', onTipAssetSelect);
  tipAssetDelete.addEventListener('click', onTipAssetDelete);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """      customTipCreate.removeEventListener('click', onCustomTipCreate);
      customTipFile.removeEventListener('change', onCustomTipFile);
""",
    """      customTipCreate.removeEventListener('click', onCustomTipCreate);
      customTipFile.removeEventListener('change', onCustomTipFile);
      tipAssetAdd.removeEventListener('click', onTipAssetAdd);
      tipAssetFile.removeEventListener('change', onTipAssetFile);
      tipAssetSelect.removeEventListener('change', onTipAssetSelect);
      tipAssetDelete.removeEventListener('click', onTipAssetDelete);
""",
)

replace_once(
    'src/index.html',
    """              <div class="shell-brush-custom-tip-row">
                <span class="shell-brush-custom-tip-label">カスタム先端</span>
                <button id="brush-tip-custom-create" type="button" title="黒い部分ほど強い先端として画像から作成">画像から作成</button>
                <input id="brush-tip-custom-file" type="file" accept="image/png,image/jpeg,image/webp" hidden />
                <canvas id="brush-tip-custom-preview" width="5" height="5" aria-label="カスタムブラシ先端プレビュー" hidden></canvas>
                <output id="brush-tip-custom-status" aria-live="polite">標準サンプル</output>
              </div>
""",
    """              <div class="shell-brush-custom-tip-row">
                <span class="shell-brush-custom-tip-label">カスタム先端</span>
                <button id="brush-tip-custom-create" type="button" title="黒い部分ほど強い先端として画像から作成">画像から作成</button>
                <input id="brush-tip-custom-file" type="file" accept="image/png,image/jpeg,image/webp" hidden />
                <canvas id="brush-tip-custom-preview" width="5" height="5" aria-label="カスタムブラシ先端プレビュー" hidden></canvas>
                <output id="brush-tip-custom-status" aria-live="polite">標準サンプル</output>
              </div>
              <div class="shell-brush-tip-assets-row">
                <label for="brush-tip-asset-select">先端アセット</label>
                <select id="brush-tip-asset-select" aria-label="使用するブラシ先端アセット"><option value="">未登録</option></select>
                <span class="shell-brush-tip-asset-actions">
                  <button id="brush-tip-asset-add" type="button">追加</button>
                  <button id="brush-tip-asset-delete" type="button" disabled>削除</button>
                </span>
                <input id="brush-tip-asset-file" type="file" accept="image/png,image/jpeg,image/webp" hidden />
                <output id="brush-tip-asset-status" aria-live="polite">0/16</output>
              </div>
""",
)

append_once(
    'public/app-shell.css',
    '/* M6A multiple brush tip assets */',
    """/* M6A multiple brush tip assets */
.shell-brush-tip-assets-row {
  display: grid;
  grid-template-columns: minmax(72px, 1fr) minmax(0, 1.35fr) auto;
  align-items: center;
  gap: 6px;
  padding-top: 4px;
  border-top: 1px solid #edf0f5;
}

.shell-brush-tip-assets-row label,
#brush-tip-asset-status {
  color: #68758c;
  font-size: 10px;
}

#brush-tip-asset-select,
.shell-brush-tip-asset-actions button {
  min-height: 32px;
  border: 1px solid #dfe5ef;
  border-radius: 8px;
  background: #fff;
  color: #38445d;
  font: inherit;
}

#brush-tip-asset-select {
  min-width: 0;
  padding: 0 7px;
}

.shell-brush-tip-asset-actions {
  display: flex;
  gap: 4px;
}

.shell-brush-tip-asset-actions button {
  padding: 0 7px;
}

#brush-tip-asset-status {
  grid-column: 1 / -1;
  text-align: right;
}
""",
)

write_new(
    'tests/unit/multiple-brush-tip-assets.test.ts',
    """import { describe, expect, it } from 'vitest';
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
    const multiple = withBrushTipAssetAddedV1(base, { id: 'second', name: 'Second', alpha: mask(24) });
    const replaced = withBrushTipAssetReplacementV1(multiple, 'second', mask(12, 180));
    expect(brushTipAssetsV1(replaced)).toHaveLength(2);
    expect(brushTipAssetsV1(replaced).find((asset) => asset.id === 'm6a019-custom')?.alpha).toEqual(mask(0));
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
""",
)

insert_before(
    'scripts/verify-m6a-brush.mjs',
    """requireText(
  progress,
  'M6A-PERF-001 incremental active-stroke rendering（stable prefix + bounded mutable tail）:未完了',
""",
    """requireText(
  progress,
  'M6A-020 multiple tip assets without Dual Brush semantics:完了',
  'M6A-020 progress is not complete',
);
requireText(
  read('src/domain/brush-schema.ts'),
  'withBrushTipAssetSelectionV1',
  'multiple brush tip asset selection missing',
);
requireText(
  read('src/app/brush-preset-controller.ts'),
  'brush-tip-asset-select',
  'multiple brush tip asset UI is not production-connected',
);
requireText(
  read('src/index.html'),
  'id="brush-tip-asset-add"',
  'reachable multiple tip asset add control missing',
);
requireText(
  read('tests/unit/multiple-brush-tip-assets.test.ts'),
  'never merges two masks as Dual Brush',
  'multiple tip asset regression coverage missing',
);
""",
)

replace_once(
    'IMPLEMENTATION_PROGRESS.md',
    'M6A-020 multiple tip assets without Dual Brush semantics:未完了\nM6A-021 hardness:未完了',
    """M6A-020 multiple tip assets without Dual Brush semantics:完了
再開メモ: M6A-020はbrush preset内のextensionsに最大16個のsampled tip assetを保持し、selectedTipAssetIdで常に1個だけをactive tipへ投影する。既存M6A-019の単一custom tipは最初の追加時にasset collectionへ昇格する。選択・置換・削除はpreset revision/lock/persistenceを通し、runtimeには選択済みalpha maskだけを渡すためDual Brushの同時合成・ランダム混合・複数tip同時描画は実装しない。次はM6A-021 hardnessから再開する。
M6A-021 hardness:未完了""",
)

append_once(
    'ILLUSTRO_DESIGN_MEMO.md',
    '#### M6A multiple-tip-assets boundary — 2026-09-03',
    """#### M6A multiple-tip-assets boundary — 2026-09-03

- M6A-020 permits up to 16 sampled tip assets inside one brush preset. The collection is preset-local metadata in extensions; it is not the global resource manager reserved for M6A-072.
- Exactly one asset is selected by selectedTipAssetId. Selecting an asset copies that asset alpha mask into the existing active sampled-image-custom tip descriptor, so the runtime, canonical Raster Tile path, History, Persistence, recovery, and export still observe one active tip only.
- An M6A-019 single custom tip is promoted into the collection when another tip asset is added, preserving the original tip as the first asset. Replacing the custom tip while a collection exists replaces the selected asset rather than discarding sibling assets.
- This item explicitly does not implement Dual Brush semantics: no simultaneous mask multiplication, secondary-tip compositing, random multi-tip mixing, or more than one tip contribution per logical stamp is introduced.
- Asset add/select/delete operations use the existing preset revision, lock, reset, duplicate, and serialization boundaries. At least one asset must remain once a collection exists; explicit single-tip creation outside an asset collection remains supported for backward compatibility.
""",
)

Path('.github/illustro-m6a020-patch.py').unlink()
Path('.github/workflows/illustro-m6a020-patch.yml').unlink()
