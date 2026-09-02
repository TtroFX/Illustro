from pathlib import Path


def replace(path: str, old: str, new: str) -> None:
    target = Path(path)
    text = target.read_text()
    if old not in text:
        raise SystemExit(f'missing anchor in {path}: {old[:100]!r}')
    target.write_text(text.replace(old, new, 1))


def append(path: str, text: str) -> None:
    target = Path(path)
    current = target.read_text()
    if text.strip() in current:
        return
    target.write_text(current.rstrip() + '\n\n' + text.strip() + '\n')


Path('src/domain/brush-schema.ts').write_text(r'''import { toJsonValue, type JsonValue } from './serialization.js';

export const BRUSH_V1_SCHEMA = 'illustro.brush/1' as const;
export const BRUSH_SCHEMA_VERSION = 1 as const;
export const ILLBRUSH_PACKAGE_VERSION = '1.0' as const;
export const ILLBRUSH_MIME_TYPE = 'application/x-illustro-brush+zip' as const;

export type BrushSchemaIdentifier = typeof BRUSH_V1_SCHEMA;
export type BrushSchemaVersion = typeof BRUSH_SCHEMA_VERSION;
export type BrushBehaviorV1 = 'paint' | 'erase' | 'smudge' | 'blur';
export type BrushPresetSectionV1 = Readonly<Record<string, JsonValue>>;

export interface BrushPresetV1 {
  readonly schema: typeof BRUSH_V1_SCHEMA;
  readonly id: string;
  readonly revision: number;
  readonly name: string;
  readonly category: string;
  readonly tags: readonly string[];
  readonly behavior: BrushBehaviorV1;
  readonly defaultSizePx: number;
  readonly tip: BrushPresetSectionV1;
  readonly stroke: BrushPresetSectionV1;
  readonly ink: BrushPresetSectionV1;
  readonly dynamics: BrushPresetSectionV1;
  readonly jitter: BrushPresetSectionV1;
  readonly spray: BrushPresetSectionV1;
  readonly texture: BrushPresetSectionV1;
  readonly colorMix: BrushPresetSectionV1;
  readonly antiOverflow: BrushPresetSectionV1;
  readonly stabilization: BrushPresetSectionV1;
  readonly antiAlias: BrushPresetSectionV1;
  readonly provenance: BrushPresetSectionV1;
  readonly importCompatibility: BrushPresetSectionV1;
  readonly extensions: BrushPresetSectionV1;
}

export function isSupportedBrushSchema(value: unknown): value is BrushSchemaIdentifier {
  return value === BRUSH_V1_SCHEMA;
}

function normalizedText(value: string, label: string, maximum: number): string {
  const normalized = value.trim();
  if (normalized.length < 1 || normalized.length > maximum) {
    throw new RangeError(`${label} must be 1..${maximum} characters`);
  }
  return normalized;
}

function normalizeSection(value: unknown, label: string): BrushPresetSectionV1 {
  const json = toJsonValue(value);
  if (typeof json !== 'object' || json === null || Array.isArray(json)) {
    throw new TypeError(`${label} must be a JSON object`);
  }
  return Object.freeze({ ...json });
}

export function normalizeBrushPresetV1(input: BrushPresetV1): BrushPresetV1 {
  if (input.schema !== BRUSH_V1_SCHEMA) throw new TypeError('unsupported brush schema');
  if (!Number.isSafeInteger(input.revision) || input.revision < 1) {
    throw new RangeError('brush revision must be a positive safe integer');
  }
  if (!Number.isFinite(input.defaultSizePx) || input.defaultSizePx <= 0 || input.defaultSizePx > 4096) {
    throw new RangeError('brush default size must be finite and within 0..4096 px');
  }
  if (!['paint', 'erase', 'smudge', 'blur'].includes(input.behavior)) {
    throw new TypeError('unsupported brush behavior');
  }
  const tags = Object.freeze(
    [...new Set(input.tags.map((tag) => normalizedText(tag, 'brush tag', 80)))].slice(0, 64),
  );
  return Object.freeze({
    schema: BRUSH_V1_SCHEMA,
    id: normalizedText(input.id, 'brush id', 160),
    revision: input.revision,
    name: normalizedText(input.name, 'brush name', 120),
    category: normalizedText(input.category, 'brush category', 80),
    tags,
    behavior: input.behavior,
    defaultSizePx: input.defaultSizePx,
    tip: normalizeSection(input.tip, 'brush tip'),
    stroke: normalizeSection(input.stroke, 'brush stroke'),
    ink: normalizeSection(input.ink, 'brush ink'),
    dynamics: normalizeSection(input.dynamics, 'brush dynamics'),
    jitter: normalizeSection(input.jitter, 'brush jitter'),
    spray: normalizeSection(input.spray, 'brush spray'),
    texture: normalizeSection(input.texture, 'brush texture'),
    colorMix: normalizeSection(input.colorMix, 'brush colorMix'),
    antiOverflow: normalizeSection(input.antiOverflow, 'brush antiOverflow'),
    stabilization: normalizeSection(input.stabilization, 'brush stabilization'),
    antiAlias: normalizeSection(input.antiAlias, 'brush antiAlias'),
    provenance: normalizeSection(input.provenance, 'brush provenance'),
    importCompatibility: normalizeSection(input.importCompatibility, 'brush importCompatibility'),
    extensions: normalizeSection(input.extensions, 'brush extensions'),
  });
}

export function createBaselineBrushPresetV1(input: {
  readonly id: string;
  readonly name: string;
  readonly category: string;
  readonly behavior: BrushBehaviorV1;
  readonly defaultSizePx?: number;
  readonly tags?: readonly string[];
}): BrushPresetV1 {
  const behavior = input.behavior;
  return normalizeBrushPresetV1({
    schema: BRUSH_V1_SCHEMA,
    id: input.id,
    revision: 1,
    name: input.name,
    category: input.category,
    tags: input.tags ?? [],
    behavior,
    defaultSizePx: input.defaultSizePx ?? (behavior === 'paint' ? 16 : 24),
    tip: { kind: 'procedural-round', hardness: behavior === 'blur' ? 0.35 : 0.85 },
    stroke: { spacingRatio: 0.25, minimumStampDistancePx: 1 },
    ink: { opacity: 1, flow: 1, buildup: 'accumulate', blend: 'normal' },
    dynamics: {},
    jitter: {},
    spray: {},
    texture: {},
    colorMix: behavior === 'smudge' ? { enabled: true } : {},
    antiOverflow: {},
    stabilization: { amount: 0 },
    antiAlias: { quality: 'high' },
    provenance: { source: 'illustro-runtime-baseline' },
    importCompatibility: {},
    extensions: {},
  });
}
''')

Path('src/app/brush-preset-library.ts').write_text(r'''import {
  BRUSH_V1_SCHEMA,
  createBaselineBrushPresetV1,
  normalizeBrushPresetV1,
  type BrushBehaviorV1,
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
    if (ids.has(item.preset.id)) throw new TypeError(`duplicate brush preset id: ${item.preset.id}`);
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
  if (factoryPresets.length < 1) throw new RangeError('at least one factory brush preset is required');
  const items = factoryPresets.map((preset) =>
    itemV1({ source: 'factory', baseline: preset, locked: false }),
  );
  return stateV1(items, items[0]?.preset.id ?? '');
}

export function selectedBrushPresetItemV1(state: BrushPresetLibraryStateV1): BrushPresetLibraryItemV1 {
  const item = state.items.find((entry) => entry.preset.id === state.selectedPresetId);
  if (item === undefined) throw new RangeError('selected brush preset is missing');
  return item;
}

export function selectBrushPresetV1(
  state: BrushPresetLibraryStateV1,
  presetId: string,
): BrushPresetLibraryStateV1 {
  if (!state.items.some((item) => item.preset.id === presetId)) throw new RangeError('brush preset not found');
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
  if (state.items.some((item) => item.preset.id === normalized)) throw new RangeError('brush preset id already exists');
  return normalized;
}

function clonePresetV1(
  source: BrushPresetV1,
  update: Partial<Pick<BrushPresetV1, 'id' | 'revision' | 'name' | 'category' | 'tags' | 'behavior' | 'defaultSizePx'>>,
): BrushPresetV1 {
  return normalizeBrushPresetV1({ ...source, ...update, schema: BRUSH_V1_SCHEMA });
}

export function createUserBrushPresetV1(
  state: BrushPresetLibraryStateV1,
  input: { readonly id: string; readonly name?: string; readonly behavior?: BrushBehaviorV1 },
): BrushPresetLibraryStateV1 {
  if (state.items.length >= BRUSH_PRESET_LIMIT_V1) throw new RangeError('brush preset library is full');
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
  if (state.items.length >= BRUSH_PRESET_LIMIT_V1) throw new RangeError('brush preset library is full');
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
    return itemV1({ source: item.source, baseline: item.baseline, preset: next, locked: item.locked });
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
    return itemV1({ source: item.source, baseline: item.baseline, preset: item.baseline, locked: item.locked });
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
        .map((item) => Object.freeze({ baseline: item.baseline, preset: item.preset, locked: item.locked })),
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
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new TypeError(`invalid ${label}`);
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
  if (payload.schema !== BRUSH_PRESET_STORAGE_SCHEMA_V1) throw new TypeError('invalid brush preset storage schema');
  if (!Array.isArray(payload.users) || !Array.isArray(payload.factoryOverrides) || typeof payload.selectedPresetId !== 'string') {
    throw new TypeError('invalid brush preset storage payload');
  }
  const overrides = new Map<string, Readonly<Record<string, unknown>>>();
  for (const value of payload.factoryOverrides) {
    const override = recordV1(value, 'factory brush override');
    if (typeof override.id !== 'string' || typeof override.locked !== 'boolean') throw new TypeError('invalid factory brush override');
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
''')

Path('src/app/brush-preset-controller.ts').write_text(r'''import type { BrushBehaviorV1 } from '../domain/brush-schema.js';
import type { PaintSessionControllerV1 } from './paint-session-controller.js';
import {
  brushPresetCategoriesV1,
  createBrushPresetLibraryStateV1,
  createUserBrushPresetV1,
  deleteBrushPresetV1,
  duplicateBrushPresetV1,
  filteredBrushPresetItemsV1,
  parseBrushPresetLibraryV1,
  renameBrushPresetV1,
  resetBrushPresetV1,
  selectBrushPresetV1,
  selectedBrushPresetItemV1,
  serializeBrushPresetLibraryV1,
  setBrushPresetCategoryV1,
  setBrushPresetLockedV1,
  setBrushPresetSearchV1,
  type BrushPresetLibraryStateV1,
} from './brush-preset-library.js';

const STORAGE_KEY = 'illustro.brush-preset-library/1';

function requireElement<T extends Element>(selector: string, ctor: { new (...args: never[]): T }): T {
  const element = document.querySelector(selector);
  if (!(element instanceof ctor)) throw new Error(`missing Brush Presets UI: ${selector}`);
  return element;
}

function loadState(storage: Storage | null): BrushPresetLibraryStateV1 {
  const raw = storage?.getItem(STORAGE_KEY);
  if (raw === null || raw === undefined) return createBrushPresetLibraryStateV1();
  try {
    return parseBrushPresetLibraryV1(raw);
  } catch {
    return createBrushPresetLibraryStateV1();
  }
}

function modeForBehavior(behavior: BrushBehaviorV1): 'raster' | 'eraser' | 'smudge' | 'blur' {
  return behavior === 'paint' ? 'raster' : behavior === 'erase' ? 'eraser' : behavior;
}

export interface BrushPresetControllerV1 {
  snapshot(): BrushPresetLibraryStateV1;
  refresh(): void;
  dispose(): void;
}

export function installBrushPresetControllerV1(input: {
  readonly root: HTMLElement;
  readonly paintSession: PaintSessionControllerV1;
  readonly storage?: Storage | null;
  readonly onBrushModeChanged?: () => void;
}): BrushPresetControllerV1 {
  const storage = input.storage ?? globalThis.localStorage;
  const search = requireElement('#brush-preset-search', HTMLInputElement);
  const category = requireElement('#brush-preset-category', HTMLSelectElement);
  const list = requireElement('#brush-preset-list', HTMLDivElement);
  const name = requireElement('#brush-preset-name', HTMLInputElement);
  const createButton = requireElement('#brush-preset-create', HTMLButtonElement);
  const duplicateButton = requireElement('#brush-preset-duplicate', HTMLButtonElement);
  const renameButton = requireElement('#brush-preset-rename', HTMLButtonElement);
  const deleteButton = requireElement('#brush-preset-delete', HTMLButtonElement);
  const lockButton = requireElement('#brush-preset-lock', HTMLButtonElement);
  const resetButton = requireElement('#brush-preset-reset', HTMLButtonElement);
  const status = requireElement('#brush-preset-status', HTMLOutputElement);
  let state = loadState(storage);
  let idCounter = 0;

  const nextId = (): string => {
    idCounter += 1;
    const uuid = globalThis.crypto?.randomUUID?.();
    return uuid === undefined
      ? `user.brush.${Date.now().toString(36)}.${idCounter.toString(36)}`
      : `user.brush.${uuid}`;
  };

  const persist = (): void => {
    storage?.setItem(STORAGE_KEY, serializeBrushPresetLibraryV1(state));
  };

  const applySelected = (): void => {
    const item = selectedBrushPresetItemV1(state);
    input.paintSession.setBrushMode(modeForBehavior(item.preset.behavior));
    input.root.dataset.illustroBrushPreset = item.preset.id;
    input.root.dataset.illustroBrushPresetSource = item.source;
    input.root.dataset.illustroBrushPresetModified = String(item.modified);
    input.root.dataset.illustroBrushPresetLocked = String(item.locked);
    input.onBrushModeChanged?.();
  };

  const render = (): void => {
    const selected = selectedBrushPresetItemV1(state);
    const categories = brushPresetCategoriesV1(state);
    const previousCategory = state.category;
    category.replaceChildren();
    const all = document.createElement('option');
    all.value = '';
    all.textContent = 'すべて';
    category.append(all);
    for (const value of categories) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = value;
      category.append(option);
    }
    category.value = previousCategory ?? '';
    search.value = state.query;
    name.value = selected.preset.name;
    list.replaceChildren();
    const visible = filteredBrushPresetItemsV1(state);
    for (const item of visible) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'shell-brush-preset-row';
      button.dataset.presetId = item.preset.id;
      button.setAttribute('aria-pressed', String(item.preset.id === state.selectedPresetId));
      if (item.preset.id === state.selectedPresetId) button.classList.add('is-selected');
      const title = document.createElement('span');
      title.className = 'shell-brush-preset-name';
      title.textContent = item.preset.name;
      const meta = document.createElement('span');
      meta.className = 'shell-brush-preset-meta';
      meta.textContent = `${item.preset.category} · ${item.source === 'factory' ? '標準' : 'ユーザー'}${item.modified ? ' · Modified' : ''}${item.locked ? ' · Locked' : ''}`;
      button.append(title, meta);
      button.addEventListener('click', () => {
        state = selectBrushPresetV1(state, item.preset.id);
        persist();
        applySelected();
        render();
      });
      list.append(button);
    }
    if (visible.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'shell-brush-preset-empty';
      empty.textContent = '一致するブラシがありません';
      list.append(empty);
    }
    const locked = selected.locked;
    duplicateButton.disabled = false;
    renameButton.disabled = locked;
    deleteButton.disabled = locked || selected.source === 'factory';
    resetButton.disabled = locked || !selected.modified;
    lockButton.textContent = locked ? '解除' : 'ロック';
    lockButton.setAttribute('aria-pressed', String(locked));
    status.textContent = `${visible.length}/${state.items.length}`;
    input.root.dataset.illustroBrushPresetCount = String(state.items.length);
  };

  const mutate = (operation: () => BrushPresetLibraryStateV1): void => {
    try {
      state = operation();
      persist();
      applySelected();
      status.textContent = '';
      render();
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : '操作に失敗しました';
    }
  };

  const onSearch = (): void => {
    state = setBrushPresetSearchV1(state, search.value);
    render();
  };
  const onCategory = (): void => {
    state = setBrushPresetCategoryV1(state, category.value || null);
    render();
  };
  const onCreate = (): void =>
    mutate(() => createUserBrushPresetV1(state, { id: nextId(), name: '新規ブラシ' }));
  const onDuplicate = (): void =>
    mutate(() => duplicateBrushPresetV1(state, state.selectedPresetId, nextId()));
  const onRename = (): void =>
    mutate(() => renameBrushPresetV1(state, state.selectedPresetId, name.value));
  const onDelete = (): void => mutate(() => deleteBrushPresetV1(state, state.selectedPresetId));
  const onLock = (): void => {
    const selected = selectedBrushPresetItemV1(state);
    mutate(() => setBrushPresetLockedV1(state, selected.preset.id, !selected.locked));
  };
  const onReset = (): void => mutate(() => resetBrushPresetV1(state, state.selectedPresetId));

  search.addEventListener('input', onSearch);
  category.addEventListener('change', onCategory);
  createButton.addEventListener('click', onCreate);
  duplicateButton.addEventListener('click', onDuplicate);
  renameButton.addEventListener('click', onRename);
  deleteButton.addEventListener('click', onDelete);
  lockButton.addEventListener('click', onLock);
  resetButton.addEventListener('click', onReset);

  applySelected();
  render();

  return Object.freeze({
    snapshot: () => state,
    refresh: render,
    dispose: () => {
      search.removeEventListener('input', onSearch);
      category.removeEventListener('change', onCategory);
      createButton.removeEventListener('click', onCreate);
      duplicateButton.removeEventListener('click', onDuplicate);
      renameButton.removeEventListener('click', onRename);
      deleteButton.removeEventListener('click', onDelete);
      lockButton.removeEventListener('click', onLock);
      resetButton.removeEventListener('click', onReset);
    },
  });
}
''')

Path('tests/unit/brush-preset-library.test.ts').write_text(r'''import { describe, expect, it } from 'vitest';
import {
  brushPresetCategoriesV1,
  createBrushPresetLibraryStateV1,
  createUserBrushPresetV1,
  deleteBrushPresetV1,
  duplicateBrushPresetV1,
  filteredBrushPresetItemsV1,
  parseBrushPresetLibraryV1,
  renameBrushPresetV1,
  resetBrushPresetV1,
  selectBrushPresetV1,
  selectedBrushPresetItemV1,
  serializeBrushPresetLibraryV1,
  setBrushPresetCategoryV1,
  setBrushPresetLockedV1,
  setBrushPresetSearchV1,
} from '../../src/app/brush-preset-library.js';

describe('M6A brush preset library', () => {
  it('starts with immutable runtime factory baselines for every implemented behavior', () => {
    const state = createBrushPresetLibraryStateV1();
    expect(state.items.map((item) => item.preset.behavior)).toEqual(['paint', 'erase', 'smudge', 'blur']);
    expect(state.items.every((item) => item.source === 'factory' && !item.modified)).toBe(true);
  });

  it('creates and duplicates user presets without mutating the selected factory preset', () => {
    const original = createBrushPresetLibraryStateV1();
    const created = createUserBrushPresetV1(original, { id: 'user.1', name: 'My Brush' });
    expect(selectedBrushPresetItemV1(created).preset.name).toBe('My Brush');
    expect(original.items).toHaveLength(4);
    const duplicated = duplicateBrushPresetV1(created, 'builtin.runtime.eraser', 'user.2');
    expect(selectedBrushPresetItemV1(duplicated).preset.behavior).toBe('erase');
    expect(selectedBrushPresetItemV1(duplicated).source).toBe('user');
  });

  it('marks rename as Modified and reset restores the exact baseline', () => {
    let state = createBrushPresetLibraryStateV1();
    state = createUserBrushPresetV1(state, { id: 'user.reset', name: 'Baseline Name' });
    state = renameBrushPresetV1(state, 'user.reset', 'Changed Name');
    expect(selectedBrushPresetItemV1(state).modified).toBe(true);
    expect(selectedBrushPresetItemV1(state).preset.revision).toBe(2);
    state = resetBrushPresetV1(state, 'user.reset');
    expect(selectedBrushPresetItemV1(state).preset.name).toBe('Baseline Name');
    expect(selectedBrushPresetItemV1(state).modified).toBe(false);
  });

  it('keeps factory presets undeletable while user presets can be removed', () => {
    const factory = createBrushPresetLibraryStateV1();
    expect(() => deleteBrushPresetV1(factory, 'builtin.runtime.round')).toThrow(/factory/);
    let state = createUserBrushPresetV1(factory, { id: 'user.delete' });
    state = deleteBrushPresetV1(state, 'user.delete');
    expect(state.items).toHaveLength(4);
  });

  it('lock blocks destructive edits but can be explicitly released', () => {
    let state = createBrushPresetLibraryStateV1();
    state = createUserBrushPresetV1(state, { id: 'user.locked', name: 'Lock Me' });
    state = setBrushPresetLockedV1(state, 'user.locked', true);
    expect(() => renameBrushPresetV1(state, 'user.locked', 'No')).toThrow(/locked/);
    expect(() => deleteBrushPresetV1(state, 'user.locked')).toThrow(/locked/);
    state = setBrushPresetLockedV1(state, 'user.locked', false);
    state = renameBrushPresetV1(state, 'user.locked', 'Unlocked');
    expect(selectedBrushPresetItemV1(state).preset.name).toBe('Unlocked');
  });

  it('filters by search text, tags, and normalized categories', () => {
    let state = createBrushPresetLibraryStateV1();
    expect(brushPresetCategoriesV1(state)).toEqual(['ブレンド', '基本', '消去']);
    state = setBrushPresetSearchV1(state, '指先');
    expect(filteredBrushPresetItemsV1(state).map((item) => item.preset.id)).toEqual([
      'builtin.runtime.smudge',
    ]);
    state = setBrushPresetSearchV1(state, '');
    state = setBrushPresetCategoryV1(state, 'ブレンド');
    expect(filteredBrushPresetItemsV1(state)).toHaveLength(2);
  });

  it('persists user presets plus factory Modified/lock metadata without replacing factory baselines', () => {
    let state = createBrushPresetLibraryStateV1();
    state = renameBrushPresetV1(state, 'builtin.runtime.round', '丸ブラシ Modified');
    state = setBrushPresetLockedV1(state, 'builtin.runtime.round', true);
    state = createUserBrushPresetV1(state, { id: 'user.persist', name: 'Persist Me' });
    state = selectBrushPresetV1(state, 'user.persist');
    const restored = parseBrushPresetLibraryV1(serializeBrushPresetLibraryV1(state));
    expect(restored.selectedPresetId).toBe('user.persist');
    expect(restored.items).toHaveLength(5);
    const factory = restored.items.find((item) => item.preset.id === 'builtin.runtime.round');
    expect(factory?.baseline.name).toBe('丸ブラシ');
    expect(factory?.preset.name).toBe('丸ブラシ Modified');
    expect(factory?.modified).toBe(true);
    expect(factory?.locked).toBe(true);
  });
});
''')

replace(
    'src/index.html',
    '          <section class="shell-inspector-card shell-color-panel" aria-label="カラー">',
    '''          <section class="shell-inspector-card shell-brush-presets-panel" aria-label="ブラシプリセット">\n            <header class="shell-brush-presets-header"><strong>ブラシプリセット</strong><output id="brush-preset-status" aria-live="polite"></output></header>\n            <div class="shell-brush-preset-filters">\n              <input id="brush-preset-search" type="search" autocomplete="off" spellcheck="false" placeholder="ブラシを検索" aria-label="ブラシプリセットを検索" />\n              <select id="brush-preset-category" aria-label="ブラシカテゴリ"><option value="">すべて</option></select>\n            </div>\n            <div id="brush-preset-list" class="shell-brush-preset-list" aria-label="ブラシプリセット一覧"></div>\n            <label class="shell-brush-preset-name-edit">名前<input id="brush-preset-name" type="text" maxlength="120" /></label>\n            <div class="shell-brush-preset-actions" aria-label="ブラシプリセット操作">\n              <button id="brush-preset-create" type="button" title="新規プリセット">＋</button>\n              <button id="brush-preset-duplicate" type="button" title="複製">複製</button>\n              <button id="brush-preset-rename" type="button" title="名前を保存">名前</button>\n              <button id="brush-preset-delete" type="button" title="削除">削除</button>\n              <button id="brush-preset-lock" type="button" aria-pressed="false" title="ロック切替">ロック</button>\n              <button id="brush-preset-reset" type="button" title="保存基準へリセット">Reset</button>\n            </div>\n          </section>\n          <section class="shell-inspector-card shell-color-panel" aria-label="カラー">''',
)

replace(
    'public/app-shell.css',
    '\n\n.shell-color-panel {\n',
    r'''

.shell-brush-presets-panel {
  gap: 9px;
  padding: 12px;
  border-bottom: 1px solid #eef1f6;
}

.shell-brush-presets-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.shell-brush-presets-header strong {
  color: #27314a;
  font-size: 12px;
}

.shell-brush-presets-header output {
  color: #7b879d;
  font-size: 9px;
}

.shell-brush-preset-filters {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 92px;
  gap: 6px;
}

.shell-brush-preset-filters input,
.shell-brush-preset-filters select,
.shell-brush-preset-name-edit input {
  min-width: 0;
  min-height: 36px;
  border: 1px solid #dfe5ef;
  border-radius: 9px;
  padding: 0 9px;
  background: #fbfcff;
  color: #26324b;
  font: inherit;
  font-size: 10px;
}

.shell-brush-preset-filters input:focus,
.shell-brush-preset-filters select:focus,
.shell-brush-preset-name-edit input:focus {
  border-color: #a9c8ff;
  outline: 2px solid rgb(59 130 246 / 10%);
}

.shell-brush-preset-list {
  display: grid;
  gap: 5px;
  max-height: 196px;
  overflow-y: auto;
  scrollbar-width: thin;
}

.shell-brush-preset-row {
  display: grid;
  gap: 2px;
  min-height: 44px;
  border: 1px solid transparent;
  border-radius: 9px;
  padding: 6px 9px;
  background: #fff;
  color: #1f2942;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.shell-brush-preset-row:hover {
  background: #f8faff;
}

.shell-brush-preset-row.is-selected {
  border-color: #ffd1e3;
  background: linear-gradient(90deg, #ff4e9a 0 4px, #fff0f6 4px 100%);
}

.shell-brush-preset-row:focus-visible {
  outline: 2px solid #60a5fa;
  outline-offset: 1px;
}

.shell-brush-preset-name {
  overflow: hidden;
  font-size: 11px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.shell-brush-preset-meta,
.shell-brush-preset-empty {
  margin: 0;
  color: #7b879d;
  font-size: 9px;
}

.shell-brush-preset-empty {
  padding: 10px 4px;
  text-align: center;
}

.shell-brush-preset-name-edit {
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr);
  align-items: center;
  gap: 6px;
  color: #718096;
  font-size: 9px;
  font-weight: 700;
}

.shell-brush-preset-actions {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 5px;
}

.shell-brush-preset-actions button {
  min-height: 44px;
  border: 1px solid #e1e6ef;
  border-radius: 9px;
  background: #f8faff;
  color: #46536c;
  font: inherit;
  font-size: 9px;
  font-weight: 700;
  cursor: pointer;
}

.shell-brush-preset-actions button:hover:not(:disabled),
.shell-brush-preset-actions button:focus-visible:not(:disabled) {
  border-color: #ffc0d8;
  background: #fff0f6;
  outline: none;
}

.shell-brush-preset-actions button[aria-pressed='true'] {
  border-color: #ffc0d8;
  background: #ffe5ef;
  color: #a61b58;
}

.shell-brush-preset-actions button:disabled {
  opacity: 0.42;
  cursor: not-allowed;
}

.shell-color-panel {
''',
)

replace(
    'src/app/main.ts',
    "import { canonicalBrushCompositeOperationV1 } from './canonical-raster-brush.js';\n",
    "import { canonicalBrushCompositeOperationV1 } from './canonical-raster-brush.js';\nimport { installBrushPresetControllerV1 } from './brush-preset-controller.js';\n",
)
replace(
    'src/app/main.ts',
    'publishBrushMode();\nconst paintHistory = new PaintHistoryControllerV1(paintSession);',
    '''publishBrushMode();\nconst brushPresets = installBrushPresetControllerV1({\n  root,\n  paintSession,\n  storage: globalThis.localStorage,\n  onBrushModeChanged: publishBrushMode,\n});\nconst paintHistory = new PaintHistoryControllerV1(paintSession);''',
)
replace(
    'src/app/main.ts',
    '    colorWorkflow.dispose();\n',
    '    brushPresets.dispose();\n    colorWorkflow.dispose();\n',
)

replace(
    'IMPLEMENTATION_PROGRESS.md',
    '''M6A-005 preset create:未完了\nM6A-006 preset duplicate:未完了\nM6A-007 preset rename:未完了\nM6A-008 preset delete:未完了\nM6A-009 preset search:未完了\nM6A-010 preset categories:未完了\nM6A-011 preset lock:未完了\nM6A-012 preset reset:未完了''',
    '''M6A-005 preset create:完了\nM6A-006 preset duplicate:完了\nM6A-007 preset rename:完了\nM6A-008 preset delete:完了\nM6A-009 preset search:完了\nM6A-010 preset categories:完了\nM6A-011 preset lock:完了\nM6A-012 preset reset:完了''',
)

verifier = Path('scripts/verify-m6a-brush.mjs').read_text()
old = "requireText(\n  progress,\n  'M6A-004 Blur brush mode:完了',\n  'M6A-004 progress is not complete',\n);"
if old not in verifier:
    raise SystemExit('M6A verifier M6A-004 anchor missing')
new = old + r'''
for (const item of [
  'M6A-005 preset create:完了',
  'M6A-006 preset duplicate:完了',
  'M6A-007 preset rename:完了',
  'M6A-008 preset delete:完了',
  'M6A-009 preset search:完了',
  'M6A-010 preset categories:完了',
  'M6A-011 preset lock:完了',
  'M6A-012 preset reset:完了',
]) {
  requireText(progress, item, `${item.split(':')[0]} progress is not complete`);
}
requireText(
  read('src/domain/brush-schema.ts'),
  'export interface BrushPresetV1',
  'canonical BrushPresetV1 management shape missing',
);
requireText(
  read('src/app/brush-preset-library.ts'),
  'serializeBrushPresetLibraryV1',
  'brush preset persistence missing',
);
requireText(
  read('src/app/brush-preset-library.ts'),
  'factory brush preset cannot be deleted',
  'factory preset protection missing',
);
requireText(
  read('src/app/brush-preset-controller.ts'),
  'paintSession.setBrushMode',
  'preset selection is not connected to production brush behavior',
);
requireText(
  read('src/index.html'),
  'id="brush-preset-list"',
  'reachable Brush Presets panel missing',
);
requireText(
  read('tests/unit/brush-preset-library.test.ts'),
  'factory presets undeletable',
  'preset management regression coverage missing',
);
'''
verifier = verifier.replace(old, new, 1)
verifier = verifier.replace(
    "  'M6A-005 preset create:未完了',\n  'future preset-management status was incorrectly advanced',",
    "  'M6A-013 brush size:未完了',\n  'future brush-size status was incorrectly advanced',",
    1,
)
Path('scripts/verify-m6a-brush.mjs').write_text(verifier)

append(
    'ILLUSTRO_DESIGN_MEMO.md',
    r'''### M6A preset-library implementation semantics — 2026-09-03

- Brush Presets management is application/library state, not document pixel history; selecting a preset changes the active brush behavior but create/rename/delete/search/category/lock/reset operations do not add document Undo/Redo entries.
- The management layer preserves the complete `illustro.brush/1` section envelope even while later M6A items progressively implement deeper parameter semantics.
- Factory preset baseline and current value are stored separately. Editing a factory preset produces an explicit Modified state; factory entries cannot be deleted, and Reset restores the exact baseline instead of destructively rewriting the factory definition.
- User preset persistence stores user entries plus only factory overrides/lock metadata, then merges them over the current factory baseline on load. This prevents persisted old factory copies from silently replacing later built-in pack updates.
- The four current runtime factory entries are bridge defaults for already implemented Paint/Eraser/Smudge/Blur behavior. They are not the final J 48-preset Default Brush Pack and do not advance J-pack implementation status.
- Brush Presets remains a compact Inspector block with search/category filtering and touch-reliable management controls; deep parameter editing stays in the separate Brush Studio progressive-disclosure surface.
''',
)
