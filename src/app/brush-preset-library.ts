import {
  BRUSH_V1_SCHEMA,
  brushSelectedTipAssetIdV1,
  brushTipAssetsV1,
  createBaselineBrushPresetV1,
  normalizeBrushPresetV1,
  withBrushCustomSampledTipV1,
  withBrushTipHardnessV1,
  withBrushTipDensityV1,
  withBrushTipAngleDegreesV1,
  withBrushTipDirectionDegreesV1,
  withBrushFollowStrokeRotationV1,
  withBrushTipSelectionModeV1,
  withBrushStrokeStartLengthPxV1,
  withBrushStrokeEndLengthPxV1,
  withBrushSizeTaperMinimumRatioV1,
  withBrushOpacityTaperMinimumRatioV1,
  withBrushForcedTaperV1,
  withBrushRealtimeStabilizationAmountV1,
  withBrushPostStrokeCorrectionAmountV1,
  withBrushGrainResourceIdV1,
  withBrushPaperTextureResourceIdV1,
  withBrushStrokeSpacingV1,
  withBrushTipAssetAddedV1,
  withBrushTipAssetDeletedV1,
  withBrushTipAssetReplacementV1,
  withBrushTipAssetSelectionV1,
  withBrushParameterValuesV1,
  withBrushProceduralTipShapeV1,
  withBrushTipShapeV1,
  type BrushBehaviorV1,
  type BrushParameterValuesV1,
  type BrushProceduralTipShapeV1,
  type BrushSampledTipAlphaV1,
  type BrushTipAssetV1,
  type BrushTipSelectionModeV1,
  type BrushTipShapeV1,
  type BrushPresetV1,
} from '../domain/brush-schema.js';

export const BRUSH_PRESET_LIBRARY_SCHEMA_V1 = 'illustro.brush-preset-library/1' as const;
export const BRUSH_PRESET_STORAGE_SCHEMA_V1 = 'illustro.brush-preset-library-storage/1' as const;
export const BRUSH_PRESET_LIMIT_V1 = 512;
export type BrushPresetSourceV1 = 'factory' | 'user';

export interface BrushPresetLibraryItemV1 {
  readonly source: BrushPresetSourceV1;
  readonly locked: boolean;
  readonly baseline: BrushPresetV1;
  readonly preset: BrushPresetV1;
  readonly modified: boolean;
}

export interface BrushPresetLibraryStateV1 {
  readonly schema: typeof BRUSH_PRESET_LIBRARY_SCHEMA_V1;
  readonly items: readonly BrushPresetLibraryItemV1[];
  readonly selectedPresetId: string;
  readonly query: string;
  readonly category: string | null;
}

interface StoredUserPresetV1 {
  readonly baseline: BrushPresetV1;
  readonly preset: BrushPresetV1;
  readonly locked: boolean;
}

interface StoredFactoryOverrideV1 {
  readonly id: string;
  readonly preset?: BrushPresetV1;
  readonly locked: boolean;
}

interface BrushPresetStorageV1 {
  readonly schema: typeof BRUSH_PRESET_STORAGE_SCHEMA_V1;
  readonly selectedPresetId: string;
  readonly users: readonly StoredUserPresetV1[];
  readonly factoryOverrides: readonly StoredFactoryOverrideV1[];
}

function itemV1(input: {
  source: BrushPresetSourceV1;
  baseline: BrushPresetV1;
  preset?: BrushPresetV1;
  locked?: boolean;
}): BrushPresetLibraryItemV1 {
  const baseline = normalizeBrushPresetV1(input.baseline);
  const preset = normalizeBrushPresetV1(input.preset ?? baseline);
  if (baseline.id !== preset.id) throw new TypeError('brush preset baseline id mismatch');
  return Object.freeze({
    source: input.source,
    baseline,
    preset,
    locked: input.locked ?? false,
    modified: JSON.stringify(baseline) !== JSON.stringify(preset),
  });
}

function stateV1(
  items: readonly BrushPresetLibraryItemV1[],
  selectedPresetId: string,
  query = '',
  category: string | null = null,
): BrushPresetLibraryStateV1 {
  if (items.length < 1 || items.length > BRUSH_PRESET_LIMIT_V1) {
    throw new RangeError(`brush preset library must contain 1..${BRUSH_PRESET_LIMIT_V1} items`);
  }
  const ids = new Set<string>();
  for (const item of items) {
    if (ids.has(item.preset.id))
      throw new TypeError(`duplicate brush preset id: ${item.preset.id}`);
    ids.add(item.preset.id);
  }
  const selected = ids.has(selectedPresetId) ? selectedPresetId : items[0]?.preset.id;
  if (selected === undefined) throw new Error('brush preset library has no selectable preset');
  const normalizedCategory = category?.trim() || null;
  return Object.freeze({
    schema: BRUSH_PRESET_LIBRARY_SCHEMA_V1,
    items: Object.freeze([...items]),
    selectedPresetId: selected,
    query: query.trimStart().slice(0, 120),
    category: normalizedCategory,
  });
}

export function createRuntimeFactoryBrushPresetsV1(): readonly BrushPresetV1[] {
  return Object.freeze([
    createBaselineBrushPresetV1({
      id: 'builtin.runtime.round',
      name: '丸ブラシ',
      category: '基本',
      behavior: 'paint',
      defaultSizePx: 16,
      tags: ['基本', 'ラスタ'],
    }),
    createBaselineBrushPresetV1({
      id: 'builtin.runtime.eraser',
      name: '消しゴム',
      category: '消去',
      behavior: 'erase',
      defaultSizePx: 24,
      tags: ['消去'],
    }),
    createBaselineBrushPresetV1({
      id: 'builtin.runtime.smudge',
      name: '指先',
      category: 'ブレンド',
      behavior: 'smudge',
      defaultSizePx: 24,
      tags: ['ブレンド', '指先'],
    }),
    createBaselineBrushPresetV1({
      id: 'builtin.runtime.blur',
      name: 'ぼかし',
      category: 'ブレンド',
      behavior: 'blur',
      defaultSizePx: 24,
      tags: ['ブレンド', 'ぼかし'],
    }),
  ]);
}

export function createBrushPresetLibraryStateV1(
  factoryPresets: readonly BrushPresetV1[] = createRuntimeFactoryBrushPresetsV1(),
): BrushPresetLibraryStateV1 {
  if (factoryPresets.length < 1)
    throw new RangeError('at least one factory brush preset is required');
  const items = factoryPresets.map((preset) =>
    itemV1({ source: 'factory', baseline: preset, locked: false }),
  );
  return stateV1(items, items[0]?.preset.id ?? '');
}

export function selectedBrushPresetItemV1(
  state: BrushPresetLibraryStateV1,
): BrushPresetLibraryItemV1 {
  const item = state.items.find((entry) => entry.preset.id === state.selectedPresetId);
  if (item === undefined) throw new RangeError('selected brush preset is missing');
  return item;
}

export function selectBrushPresetV1(
  state: BrushPresetLibraryStateV1,
  presetId: string,
): BrushPresetLibraryStateV1 {
  if (!state.items.some((item) => item.preset.id === presetId))
    throw new RangeError('brush preset not found');
  if (presetId === state.selectedPresetId) return state;
  return stateV1(state.items, presetId, state.query, state.category);
}

function uniquePresetNameV1(state: BrushPresetLibraryStateV1, requested: string): string {
  const base = requested.trim() || '新規ブラシ';
  const names = new Set(state.items.map((item) => item.preset.name));
  if (!names.has(base)) return base;
  let suffix = 2;
  while (names.has(`${base} ${suffix}`)) suffix += 1;
  return `${base} ${suffix}`;
}

function requireAvailableId(state: BrushPresetLibraryStateV1, id: string): string {
  const normalized = id.trim();
  if (normalized.length < 1) throw new RangeError('brush preset id must not be empty');
  if (state.items.some((item) => item.preset.id === normalized))
    throw new RangeError('brush preset id already exists');
  return normalized;
}

function clonePresetV1(
  source: BrushPresetV1,
  update: Partial<
    Pick<
      BrushPresetV1,
      'id' | 'revision' | 'name' | 'category' | 'tags' | 'behavior' | 'defaultSizePx'
    >
  >,
): BrushPresetV1 {
  return normalizeBrushPresetV1({ ...source, ...update, schema: BRUSH_V1_SCHEMA });
}

export function createUserBrushPresetV1(
  state: BrushPresetLibraryStateV1,
  input: { readonly id: string; readonly name?: string; readonly behavior?: BrushBehaviorV1 },
): BrushPresetLibraryStateV1 {
  if (state.items.length >= BRUSH_PRESET_LIMIT_V1)
    throw new RangeError('brush preset library is full');
  const selected = selectedBrushPresetItemV1(state).preset;
  const id = requireAvailableId(state, input.id);
  const behavior = input.behavior ?? selected.behavior;
  const preset = createBaselineBrushPresetV1({
    id,
    name: uniquePresetNameV1(state, input.name ?? '新規ブラシ'),
    category: 'カスタム',
    behavior,
    defaultSizePx: selected.defaultSizePx,
    tags: ['カスタム'],
  });
  const item = itemV1({ source: 'user', baseline: preset });
  return stateV1([...state.items, item], id, state.query, state.category);
}

export function duplicateBrushPresetV1(
  state: BrushPresetLibraryStateV1,
  sourceId: string,
  newId: string,
): BrushPresetLibraryStateV1 {
  if (state.items.length >= BRUSH_PRESET_LIMIT_V1)
    throw new RangeError('brush preset library is full');
  const source = state.items.find((item) => item.preset.id === sourceId);
  if (source === undefined) throw new RangeError('brush preset not found');
  const id = requireAvailableId(state, newId);
  const preset = clonePresetV1(source.preset, {
    id,
    revision: 1,
    name: uniquePresetNameV1(state, `${source.preset.name} コピー`),
  });
  const duplicate = itemV1({ source: 'user', baseline: preset });
  return stateV1([...state.items, duplicate], id, state.query, state.category);
}

function updateItemV1(
  state: BrushPresetLibraryStateV1,
  presetId: string,
  update: (item: BrushPresetLibraryItemV1) => BrushPresetLibraryItemV1,
): BrushPresetLibraryStateV1 {
  let found = false;
  const items = state.items.map((item) => {
    if (item.preset.id !== presetId) return item;
    found = true;
    return update(item);
  });
  if (!found) throw new RangeError('brush preset not found');
  return stateV1(items, state.selectedPresetId, state.query, state.category);
}

export function renameBrushPresetV1(
  state: BrushPresetLibraryStateV1,
  presetId: string,
  name: string,
): BrushPresetLibraryStateV1 {
  return updateItemV1(state, presetId, (item) => {
    if (item.locked) throw new Error('locked brush preset cannot be renamed');
    const next = clonePresetV1(item.preset, { revision: item.preset.revision + 1, name });
    return itemV1({
      source: item.source,
      baseline: item.baseline,
      preset: next,
      locked: item.locked,
    });
  });
}

export function updateBrushPresetParametersV1(
  state: BrushPresetLibraryStateV1,
  presetId: string,
  patch: Partial<BrushParameterValuesV1>,
): BrushPresetLibraryStateV1 {
  return updateItemV1(state, presetId, (item) => {
    if (item.locked) throw new Error('locked brush preset cannot be edited');
    const current = withBrushParameterValuesV1(item.preset, patch);
    if (JSON.stringify(current) === JSON.stringify(item.preset)) return item;
    const next = normalizeBrushPresetV1({
      ...current,
      revision: item.preset.revision + 1,
    });
    return itemV1({
      source: item.source,
      baseline: item.baseline,
      preset: next,
      locked: item.locked,
    });
  });
}

export function updateBrushPresetProceduralTipV1(
  state: BrushPresetLibraryStateV1,
  presetId: string,
  shape: BrushProceduralTipShapeV1,
): BrushPresetLibraryStateV1 {
  return updateItemV1(state, presetId, (item) => {
    if (item.locked) throw new Error('locked brush preset cannot be edited');
    const current = withBrushProceduralTipShapeV1(item.preset, shape);
    if (JSON.stringify(current) === JSON.stringify(item.preset)) return item;
    const next = normalizeBrushPresetV1({ ...current, revision: item.preset.revision + 1 });
    return itemV1({
      source: item.source,
      baseline: item.baseline,
      preset: next,
      locked: item.locked,
    });
  });
}

export function updateBrushPresetTipShapeV1(
  state: BrushPresetLibraryStateV1,
  presetId: string,
  shape: BrushTipShapeV1,
): BrushPresetLibraryStateV1 {
  return updateItemV1(state, presetId, (item) => {
    if (item.locked) throw new Error('locked brush preset cannot be edited');
    const current = withBrushTipShapeV1(item.preset, shape);
    if (JSON.stringify(current) === JSON.stringify(item.preset)) return item;
    const next = normalizeBrushPresetV1({ ...current, revision: item.preset.revision + 1 });
    return itemV1({
      source: item.source,
      baseline: item.baseline,
      preset: next,
      locked: item.locked,
    });
  });
}

export function updateBrushPresetHardnessV1(
  state: BrushPresetLibraryStateV1,
  presetId: string,
  hardness: number,
): BrushPresetLibraryStateV1 {
  return updateItemV1(state, presetId, (item) => {
    if (item.locked) throw new Error('locked brush preset cannot be edited');
    const current = withBrushTipHardnessV1(item.preset, hardness);
    if (JSON.stringify(current) === JSON.stringify(item.preset)) return item;
    const next = normalizeBrushPresetV1({ ...current, revision: item.preset.revision + 1 });
    return itemV1({
      source: item.source,
      baseline: item.baseline,
      preset: next,
      locked: item.locked,
    });
  });
}
export function updateBrushPresetTipDensityV1(
  state: BrushPresetLibraryStateV1,
  presetId: string,
  density: number,
): BrushPresetLibraryStateV1 {
  return updateItemV1(state, presetId, (item) => {
    if (item.locked) throw new Error('locked brush preset cannot be edited');
    const current = withBrushTipDensityV1(item.preset, density);
    if (JSON.stringify(current) === JSON.stringify(item.preset)) return item;
    const next = normalizeBrushPresetV1({ ...current, revision: item.preset.revision + 1 });
    return itemV1({
      source: item.source,
      baseline: item.baseline,
      preset: next,
      locked: item.locked,
    });
  });
}

export function updateBrushPresetSpacingV1(
  state: BrushPresetLibraryStateV1,
  presetId: string,
  spacingRatio: number,
): BrushPresetLibraryStateV1 {
  return updateItemV1(state, presetId, (item) => {
    if (item.locked) throw new Error('locked brush preset cannot be edited');
    const current = withBrushStrokeSpacingV1(item.preset, spacingRatio);
    if (JSON.stringify(current) === JSON.stringify(item.preset)) return item;
    const next = normalizeBrushPresetV1({ ...current, revision: item.preset.revision + 1 });
    return itemV1({
      source: item.source,
      baseline: item.baseline,
      preset: next,
      locked: item.locked,
    });
  });
}

export function updateBrushPresetTipAngleV1(
  state: BrushPresetLibraryStateV1,
  presetId: string,
  angleDegrees: number,
): BrushPresetLibraryStateV1 {
  return updateItemV1(state, presetId, (item) => {
    if (item.locked) throw new Error('locked brush preset cannot be edited');
    const current = withBrushTipAngleDegreesV1(item.preset, angleDegrees);
    if (JSON.stringify(current) === JSON.stringify(item.preset)) return item;
    const next = normalizeBrushPresetV1({ ...current, revision: item.preset.revision + 1 });
    return itemV1({
      source: item.source,
      baseline: item.baseline,
      preset: next,
      locked: item.locked,
    });
  });
}

export function updateBrushPresetTipDirectionV1(
  state: BrushPresetLibraryStateV1,
  presetId: string,
  directionDegrees: number,
): BrushPresetLibraryStateV1 {
  return updateItemV1(state, presetId, (item) => {
    if (item.locked) throw new Error('locked brush preset cannot be edited');
    const current = withBrushTipDirectionDegreesV1(item.preset, directionDegrees);
    if (JSON.stringify(current) === JSON.stringify(item.preset)) return item;
    const next = normalizeBrushPresetV1({ ...current, revision: item.preset.revision + 1 });
    return itemV1({
      source: item.source,
      baseline: item.baseline,
      preset: next,
      locked: item.locked,
    });
  });
}

export function updateBrushPresetFollowRotationV1(
  state: BrushPresetLibraryStateV1,
  presetId: string,
  enabled: boolean,
): BrushPresetLibraryStateV1 {
  return updateItemV1(state, presetId, (item) => {
    if (item.locked) throw new Error('locked brush preset cannot be edited');
    const current = withBrushFollowStrokeRotationV1(item.preset, enabled);
    if (JSON.stringify(current) === JSON.stringify(item.preset)) return item;
    const next = normalizeBrushPresetV1({ ...current, revision: item.preset.revision + 1 });
    return itemV1({
      source: item.source,
      baseline: item.baseline,
      preset: next,
      locked: item.locked,
    });
  });
}

export function updateBrushPresetTipSelectionModeV1(
  state: BrushPresetLibraryStateV1,
  presetId: string,
  mode: BrushTipSelectionModeV1,
): BrushPresetLibraryStateV1 {
  return updateItemV1(state, presetId, (item) => {
    if (item.locked) throw new Error('locked brush preset cannot be edited');
    const current = withBrushTipSelectionModeV1(item.preset, mode);
    if (JSON.stringify(current) === JSON.stringify(item.preset)) return item;
    const next = normalizeBrushPresetV1({ ...current, revision: item.preset.revision + 1 });
    return itemV1({
      source: item.source,
      baseline: item.baseline,
      preset: next,
      locked: item.locked,
    });
  });
}

export function updateBrushPresetStartLengthV1(
  state: BrushPresetLibraryStateV1,
  presetId: string,
  lengthPx: number,
): BrushPresetLibraryStateV1 {
  return updateItemV1(state, presetId, (item) => {
    if (item.locked) throw new Error('locked brush preset cannot be edited');
    const current = withBrushStrokeStartLengthPxV1(item.preset, lengthPx);
    if (JSON.stringify(current) === JSON.stringify(item.preset)) return item;
    const next = normalizeBrushPresetV1({ ...current, revision: item.preset.revision + 1 });
    return itemV1({
      source: item.source,
      baseline: item.baseline,
      preset: next,
      locked: item.locked,
    });
  });
}

export function updateBrushPresetEndLengthV1(
  state: BrushPresetLibraryStateV1,
  presetId: string,
  lengthPx: number,
): BrushPresetLibraryStateV1 {
  return updateItemV1(state, presetId, (item) => {
    if (item.locked) throw new Error('locked brush preset cannot be edited');
    const current = withBrushStrokeEndLengthPxV1(item.preset, lengthPx);
    if (JSON.stringify(current) === JSON.stringify(item.preset)) return item;
    const next = normalizeBrushPresetV1({ ...current, revision: item.preset.revision + 1 });
    return itemV1({
      source: item.source,
      baseline: item.baseline,
      preset: next,
      locked: item.locked,
    });
  });
}

export function updateBrushPresetSizeTaperV1(
  state: BrushPresetLibraryStateV1,
  presetId: string,
  minimumRatio: number,
): BrushPresetLibraryStateV1 {
  return updateItemV1(state, presetId, (item) => {
    if (item.locked) throw new Error('locked brush preset cannot be edited');
    const current = withBrushSizeTaperMinimumRatioV1(item.preset, minimumRatio);
    if (JSON.stringify(current) === JSON.stringify(item.preset)) return item;
    const next = normalizeBrushPresetV1({ ...current, revision: item.preset.revision + 1 });
    return itemV1({
      source: item.source,
      baseline: item.baseline,
      preset: next,
      locked: item.locked,
    });
  });
}

export function updateBrushPresetOpacityTaperV1(
  state: BrushPresetLibraryStateV1,
  presetId: string,
  minimumRatio: number,
): BrushPresetLibraryStateV1 {
  return updateItemV1(state, presetId, (item) => {
    if (item.locked) throw new Error('locked brush preset cannot be edited');
    const current = withBrushOpacityTaperMinimumRatioV1(item.preset, minimumRatio);
    if (JSON.stringify(current) === JSON.stringify(item.preset)) return item;
    const next = normalizeBrushPresetV1({ ...current, revision: item.preset.revision + 1 });
    return itemV1({
      source: item.source,
      baseline: item.baseline,
      preset: next,
      locked: item.locked,
    });
  });
}

export function updateBrushPresetForcedTaperV1(
  state: BrushPresetLibraryStateV1,
  presetId: string,
  forceStart: boolean,
  forceEnd: boolean,
): BrushPresetLibraryStateV1 {
  return updateItemV1(state, presetId, (item) => {
    if (item.locked) throw new Error('locked brush preset cannot be edited');
    const current = withBrushForcedTaperV1(item.preset, forceStart, forceEnd);
    if (JSON.stringify(current) === JSON.stringify(item.preset)) return item;
    const next = normalizeBrushPresetV1({ ...current, revision: item.preset.revision + 1 });
    return itemV1({
      source: item.source,
      baseline: item.baseline,
      preset: next,
      locked: item.locked,
    });
  });
}

export function updateBrushPresetRealtimeStabilizationV1(
  state: BrushPresetLibraryStateV1,
  presetId: string,
  amount: number,
): BrushPresetLibraryStateV1 {
  return updateItemV1(state, presetId, (item) => {
    if (item.locked) throw new Error('locked brush preset cannot be edited');
    const current = withBrushRealtimeStabilizationAmountV1(item.preset, amount);
    if (JSON.stringify(current) === JSON.stringify(item.preset)) return item;
    const next = normalizeBrushPresetV1({ ...current, revision: item.preset.revision + 1 });
    return itemV1({
      source: item.source,
      baseline: item.baseline,
      preset: next,
      locked: item.locked,
    });
  });
}

export function updateBrushPresetPostStrokeCorrectionV1(
  state: BrushPresetLibraryStateV1,
  presetId: string,
  amount: number,
): BrushPresetLibraryStateV1 {
  return updateItemV1(state, presetId, (item) => {
    if (item.locked) throw new Error('locked brush preset cannot be edited');
    const current = withBrushPostStrokeCorrectionAmountV1(item.preset, amount);
    if (JSON.stringify(current) === JSON.stringify(item.preset)) return item;
    const next = normalizeBrushPresetV1({ ...current, revision: item.preset.revision + 1 });
    return itemV1({
      source: item.source,
      baseline: item.baseline,
      preset: next,
      locked: item.locked,
    });
  });
}

export function updateBrushPresetGrainResourceV1(
  state: BrushPresetLibraryStateV1,
  presetId: string,
  resourceId: string | null,
): BrushPresetLibraryStateV1 {
  return updateItemV1(state, presetId, (item) => {
    if (item.locked) throw new Error('locked brush preset cannot be edited');
    const current = withBrushGrainResourceIdV1(item.preset, resourceId);
    if (JSON.stringify(current) === JSON.stringify(item.preset)) return item;
    const next = normalizeBrushPresetV1({ ...current, revision: item.preset.revision + 1 });
    return itemV1({
      source: item.source,
      baseline: item.baseline,
      preset: next,
      locked: item.locked,
    });
  });
}

export function updateBrushPresetPaperTextureResourceV1(
  state: BrushPresetLibraryStateV1,
  presetId: string,
  resourceId: string | null,
): BrushPresetLibraryStateV1 {
  return updateItemV1(state, presetId, (item) => {
    if (item.locked) throw new Error('locked brush preset cannot be edited');
    const current = withBrushPaperTextureResourceIdV1(item.preset, resourceId);
    if (JSON.stringify(current) === JSON.stringify(item.preset)) return item;
    const next = normalizeBrushPresetV1({ ...current, revision: item.preset.revision + 1 });
    return itemV1({
      source: item.source,
      baseline: item.baseline,
      preset: next,
      locked: item.locked,
    });
  });
}

export function updateBrushPresetCustomTipV1(
  state: BrushPresetLibraryStateV1,
  presetId: string,
  alpha: BrushSampledTipAlphaV1,
): BrushPresetLibraryStateV1 {
  return updateItemV1(state, presetId, (item) => {
    if (item.locked) throw new Error('locked brush preset cannot be edited');
    const selectedAssetId = brushSelectedTipAssetIdV1(item.preset);
    const current =
      brushTipAssetsV1(item.preset).length > 0 && selectedAssetId !== null
        ? withBrushTipAssetReplacementV1(item.preset, selectedAssetId, alpha)
        : withBrushCustomSampledTipV1(item.preset, alpha);
    if (JSON.stringify(current) === JSON.stringify(item.preset)) return item;
    const next = normalizeBrushPresetV1({ ...current, revision: item.preset.revision + 1 });
    return itemV1({
      source: item.source,
      baseline: item.baseline,
      preset: next,
      locked: item.locked,
    });
  });
}
export function addBrushPresetTipAssetV1(
  state: BrushPresetLibraryStateV1,
  presetId: string,
  asset: BrushTipAssetV1,
): BrushPresetLibraryStateV1 {
  return updateItemV1(state, presetId, (item) => {
    if (item.locked) throw new Error('locked brush preset cannot be edited');
    const current = withBrushTipAssetAddedV1(item.preset, asset);
    const next = normalizeBrushPresetV1({ ...current, revision: item.preset.revision + 1 });
    return itemV1({
      source: item.source,
      baseline: item.baseline,
      preset: next,
      locked: item.locked,
    });
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
    return itemV1({
      source: item.source,
      baseline: item.baseline,
      preset: next,
      locked: item.locked,
    });
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
    return itemV1({
      source: item.source,
      baseline: item.baseline,
      preset: next,
      locked: item.locked,
    });
  });
}
export function deleteBrushPresetV1(
  state: BrushPresetLibraryStateV1,
  presetId: string,
): BrushPresetLibraryStateV1 {
  const index = state.items.findIndex((item) => item.preset.id === presetId);
  if (index < 0) throw new RangeError('brush preset not found');
  const item = state.items[index];
  if (item?.source === 'factory') throw new Error('factory brush preset cannot be deleted');
  if (item?.locked) throw new Error('locked brush preset cannot be deleted');
  const items = state.items.filter((entry) => entry.preset.id !== presetId);
  const selected =
    state.selectedPresetId === presetId
      ? (items[Math.min(index, items.length - 1)]?.preset.id ?? items[0]?.preset.id)
      : state.selectedPresetId;
  if (selected === undefined) throw new Error('brush preset deletion left no selection');
  return stateV1(items, selected, state.query, state.category);
}

export function setBrushPresetLockedV1(
  state: BrushPresetLibraryStateV1,
  presetId: string,
  locked: boolean,
): BrushPresetLibraryStateV1 {
  return updateItemV1(state, presetId, (item) =>
    item.locked === locked
      ? item
      : itemV1({
          source: item.source,
          baseline: item.baseline,
          preset: item.preset,
          locked,
        }),
  );
}

export function resetBrushPresetV1(
  state: BrushPresetLibraryStateV1,
  presetId: string,
): BrushPresetLibraryStateV1 {
  return updateItemV1(state, presetId, (item) => {
    if (item.locked) throw new Error('locked brush preset cannot be reset');
    if (!item.modified) return item;
    return itemV1({
      source: item.source,
      baseline: item.baseline,
      preset: item.baseline,
      locked: item.locked,
    });
  });
}

export function setBrushPresetSearchV1(
  state: BrushPresetLibraryStateV1,
  query: string,
): BrushPresetLibraryStateV1 {
  return stateV1(state.items, state.selectedPresetId, query, state.category);
}

export function setBrushPresetCategoryV1(
  state: BrushPresetLibraryStateV1,
  category: string | null,
): BrushPresetLibraryStateV1 {
  return stateV1(state.items, state.selectedPresetId, state.query, category);
}

export function brushPresetCategoriesV1(state: BrushPresetLibraryStateV1): readonly string[] {
  return Object.freeze(
    [...new Set(state.items.map((item) => item.preset.category))].sort((left, right) =>
      left.localeCompare(right),
    ),
  );
}

export function filteredBrushPresetItemsV1(
  state: BrushPresetLibraryStateV1,
): readonly BrushPresetLibraryItemV1[] {
  const query = state.query.trim().toLocaleLowerCase();
  return Object.freeze(
    state.items.filter((item) => {
      if (state.category !== null && item.preset.category !== state.category) return false;
      if (query.length === 0) return true;
      return [item.preset.name, item.preset.category, ...item.preset.tags]
        .join('\n')
        .toLocaleLowerCase()
        .includes(query);
    }),
  );
}

export function serializeBrushPresetLibraryV1(state: BrushPresetLibraryStateV1): string {
  const storage: BrushPresetStorageV1 = Object.freeze({
    schema: BRUSH_PRESET_STORAGE_SCHEMA_V1,
    selectedPresetId: state.selectedPresetId,
    users: Object.freeze(
      state.items
        .filter((item) => item.source === 'user')
        .map((item) =>
          Object.freeze({ baseline: item.baseline, preset: item.preset, locked: item.locked }),
        ),
    ),
    factoryOverrides: Object.freeze(
      state.items
        .filter((item) => item.source === 'factory' && (item.modified || item.locked))
        .map((item) =>
          Object.freeze({
            id: item.preset.id,
            ...(item.modified ? { preset: item.preset } : {}),
            locked: item.locked,
          }),
        ),
    ),
  });
  return JSON.stringify(storage);
}

function recordV1(value: unknown, label: string): Readonly<Record<string, unknown>> {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new TypeError(`invalid ${label}`);
  return value as Readonly<Record<string, unknown>>;
}

function parsePresetV1(value: unknown): BrushPresetV1 {
  const record = recordV1(value, 'brush preset');
  if (record.schema !== BRUSH_V1_SCHEMA) throw new TypeError('invalid stored brush schema');
  return normalizeBrushPresetV1(record as unknown as BrushPresetV1);
}

export function parseBrushPresetLibraryV1(
  raw: string,
  factoryPresets: readonly BrushPresetV1[] = createRuntimeFactoryBrushPresetsV1(),
): BrushPresetLibraryStateV1 {
  const payload = recordV1(JSON.parse(raw), 'brush preset library');
  if (payload.schema !== BRUSH_PRESET_STORAGE_SCHEMA_V1)
    throw new TypeError('invalid brush preset storage schema');
  if (
    !Array.isArray(payload.users) ||
    !Array.isArray(payload.factoryOverrides) ||
    typeof payload.selectedPresetId !== 'string'
  ) {
    throw new TypeError('invalid brush preset storage payload');
  }
  const overrides = new Map<string, Readonly<Record<string, unknown>>>();
  for (const value of payload.factoryOverrides) {
    const override = recordV1(value, 'factory brush override');
    if (typeof override.id !== 'string' || typeof override.locked !== 'boolean')
      throw new TypeError('invalid factory brush override');
    overrides.set(override.id, override);
  }
  const items: BrushPresetLibraryItemV1[] = factoryPresets.map((baselineInput) => {
    const baseline = normalizeBrushPresetV1(baselineInput);
    const override = overrides.get(baseline.id);
    const preset = override?.preset === undefined ? baseline : parsePresetV1(override.preset);
    return itemV1({ source: 'factory', baseline, preset, locked: override?.locked === true });
  });
  for (const value of payload.users) {
    const stored = recordV1(value, 'user brush preset');
    if (typeof stored.locked !== 'boolean') throw new TypeError('invalid user brush lock');
    items.push(
      itemV1({
        source: 'user',
        baseline: parsePresetV1(stored.baseline),
        preset: parsePresetV1(stored.preset),
        locked: stored.locked,
      }),
    );
  }
  return stateV1(items, payload.selectedPresetId);
}
