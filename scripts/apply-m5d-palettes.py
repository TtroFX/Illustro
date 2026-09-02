from pathlib import Path


def replace_once(path: str, before: str, after: str) -> None:
    p = Path(path)
    text = p.read_text()
    count = text.count(before)
    if count != 1:
        raise SystemExit(f'{path}: expected exactly one anchor, got {count}: {before[:120]!r}')
    p.write_text(text.replace(before, after, 1))


Path('src/app/color-workspace-state.ts').write_text(r'''import {
  BLACK_RGB_UNIT_V1,
  WHITE_RGB_UNIT_V1,
  freezeRgbUnitColorV1,
  rgbUnitColorEqualV1,
  type RgbUnitColorV1,
} from '../domain/color.js';
import type { DocumentColorSpace } from '../domain/document.js';

export const COLOR_HISTORY_LIMIT_V1 = 24;
export const COLOR_PALETTE_LIMIT_V1 = 64;
export const COLOR_PALETTE_COLOR_LIMIT_V1 = 256;
export const DEFAULT_COLOR_PALETTE_ID_V1 = 'palette-default';

export interface ColorPaletteV1 {
  readonly id: string;
  readonly name: string;
  readonly colors: readonly RgbUnitColorV1[];
}

export interface ColorPaletteBundleV1 {
  readonly schema: 'illustro.palette-bundle/1';
  readonly encoding: 'encoded-rgb-unit';
  readonly workingSpace: DocumentColorSpace;
  readonly palettes: readonly ColorPaletteV1[];
}

export interface ColorWorkspaceStateV1 {
  readonly schema: 'illustro.color-workspace/1';
  readonly current: RgbUnitColorV1;
  readonly previous: RgbUnitColorV1;
  readonly history: readonly RgbUnitColorV1[];
  readonly palettes: readonly ColorPaletteV1[];
  readonly activePaletteId: string;
}

function dedupeHistory(
  color: RgbUnitColorV1,
  history: readonly RgbUnitColorV1[],
): readonly RgbUnitColorV1[] {
  return Object.freeze(
    [color, ...history.filter((entry) => !rgbUnitColorEqualV1(entry, color))].slice(
      0,
      COLOR_HISTORY_LIMIT_V1,
    ),
  );
}

function paletteIdV1(value: string): string {
  const id = value.trim();
  if (id.length < 1 || id.length > 120) throw new RangeError('palette id must be 1..120 characters');
  return id;
}

function paletteNameV1(value: string): string {
  const name = value.trim();
  if (name.length < 1 || name.length > 80) throw new RangeError('palette name must be 1..80 characters');
  return name;
}

export function createColorPaletteV1(
  id: string,
  name: string,
  colors: readonly RgbUnitColorV1[] = [],
): ColorPaletteV1 {
  if (colors.length > COLOR_PALETTE_COLOR_LIMIT_V1) {
    throw new RangeError(`palette colors must not exceed ${COLOR_PALETTE_COLOR_LIMIT_V1}`);
  }
  return Object.freeze({
    id: paletteIdV1(id),
    name: paletteNameV1(name),
    colors: Object.freeze(colors.map((color) => freezeRgbUnitColorV1(color))),
  });
}

function defaultPaletteV1(): ColorPaletteV1 {
  return createColorPaletteV1(DEFAULT_COLOR_PALETTE_ID_V1, '基本', [
    BLACK_RGB_UNIT_V1,
    WHITE_RGB_UNIT_V1,
  ]);
}

function withPalettesV1(
  state: ColorWorkspaceStateV1,
  palettes: readonly ColorPaletteV1[],
  activePaletteId: string,
): ColorWorkspaceStateV1 {
  if (palettes.length < 1 || palettes.length > COLOR_PALETTE_LIMIT_V1) {
    throw new RangeError(`workspace palettes must contain 1..${COLOR_PALETTE_LIMIT_V1} entries`);
  }
  const frozen = Object.freeze([...palettes]);
  if (!frozen.some((palette) => palette.id === activePaletteId)) {
    throw new RangeError('active palette must exist');
  }
  return Object.freeze({ ...state, palettes: frozen, activePaletteId });
}

export function createColorWorkspaceStateV1(): ColorWorkspaceStateV1 {
  const palette = defaultPaletteV1();
  return Object.freeze({
    schema: 'illustro.color-workspace/1' as const,
    current: BLACK_RGB_UNIT_V1,
    previous: WHITE_RGB_UNIT_V1,
    history: Object.freeze([BLACK_RGB_UNIT_V1, WHITE_RGB_UNIT_V1]),
    palettes: Object.freeze([palette]),
    activePaletteId: palette.id,
  });
}

export function activeColorPaletteV1(state: ColorWorkspaceStateV1): ColorPaletteV1 {
  const palette = state.palettes.find((entry) => entry.id === state.activePaletteId);
  if (palette === undefined) throw new RangeError('active palette is missing');
  return palette;
}

export function setActiveColorPaletteV1(
  state: ColorWorkspaceStateV1,
  paletteId: string,
): ColorWorkspaceStateV1 {
  const id = paletteIdV1(paletteId);
  if (state.activePaletteId === id) return state;
  if (!state.palettes.some((palette) => palette.id === id)) throw new RangeError('palette not found');
  return withPalettesV1(state, state.palettes, id);
}

export function createColorPaletteInWorkspaceV1(
  state: ColorWorkspaceStateV1,
  paletteId: string,
  name: string,
): ColorWorkspaceStateV1 {
  if (state.palettes.length >= COLOR_PALETTE_LIMIT_V1) {
    throw new RangeError(`workspace palettes must not exceed ${COLOR_PALETTE_LIMIT_V1}`);
  }
  const palette = createColorPaletteV1(paletteId, name);
  if (state.palettes.some((entry) => entry.id === palette.id)) throw new RangeError('palette id already exists');
  return withPalettesV1(state, [...state.palettes, palette], palette.id);
}

export function renameColorPaletteV1(
  state: ColorWorkspaceStateV1,
  paletteId: string,
  name: string,
): ColorWorkspaceStateV1 {
  const normalizedName = paletteNameV1(name);
  let found = false;
  const palettes = state.palettes.map((palette) => {
    if (palette.id !== paletteId) return palette;
    found = true;
    if (palette.name === normalizedName) return palette;
    return createColorPaletteV1(palette.id, normalizedName, palette.colors);
  });
  if (!found) throw new RangeError('palette not found');
  return withPalettesV1(state, palettes, state.activePaletteId);
}

export function deleteColorPaletteV1(
  state: ColorWorkspaceStateV1,
  paletteId: string,
): ColorWorkspaceStateV1 {
  if (state.palettes.length <= 1) throw new RangeError('at least one palette must remain');
  const index = state.palettes.findIndex((palette) => palette.id === paletteId);
  if (index < 0) throw new RangeError('palette not found');
  const palettes = state.palettes.filter((palette) => palette.id !== paletteId);
  const activePaletteId =
    state.activePaletteId === paletteId
      ? (palettes[Math.min(index, palettes.length - 1)]?.id ?? palettes[0]?.id)
      : state.activePaletteId;
  if (activePaletteId === undefined) throw new RangeError('palette deletion left no active palette');
  return withPalettesV1(state, palettes, activePaletteId);
}

function moveItemV1<T>(items: readonly T[], fromIndex: number, toIndex: number): readonly T[] {
  if (!Number.isInteger(fromIndex) || !Number.isInteger(toIndex)) throw new RangeError('reorder indexes must be integers');
  if (fromIndex < 0 || fromIndex >= items.length || toIndex < 0 || toIndex >= items.length) {
    throw new RangeError('reorder index out of range');
  }
  if (fromIndex === toIndex) return items;
  const next = [...items];
  const [item] = next.splice(fromIndex, 1);
  if (item === undefined) throw new RangeError('reorder source missing');
  next.splice(toIndex, 0, item);
  return Object.freeze(next);
}

export function moveColorPaletteV1(
  state: ColorWorkspaceStateV1,
  paletteId: string,
  toIndex: number,
): ColorWorkspaceStateV1 {
  const fromIndex = state.palettes.findIndex((palette) => palette.id === paletteId);
  if (fromIndex < 0) throw new RangeError('palette not found');
  if (fromIndex === toIndex) return state;
  return withPalettesV1(state, moveItemV1(state.palettes, fromIndex, toIndex), state.activePaletteId);
}

export function addColorToPaletteV1(
  state: ColorWorkspaceStateV1,
  paletteId: string,
  color: RgbUnitColorV1,
): ColorWorkspaceStateV1 {
  const frozenColor = freezeRgbUnitColorV1(color);
  let found = false;
  let changed = false;
  const palettes = state.palettes.map((palette) => {
    if (palette.id !== paletteId) return palette;
    found = true;
    if (palette.colors.some((entry) => rgbUnitColorEqualV1(entry, frozenColor))) return palette;
    if (palette.colors.length >= COLOR_PALETTE_COLOR_LIMIT_V1) {
      throw new RangeError(`palette colors must not exceed ${COLOR_PALETTE_COLOR_LIMIT_V1}`);
    }
    changed = true;
    return createColorPaletteV1(palette.id, palette.name, [...palette.colors, frozenColor]);
  });
  if (!found) throw new RangeError('palette not found');
  return changed ? withPalettesV1(state, palettes, state.activePaletteId) : state;
}

export function removeColorFromPaletteV1(
  state: ColorWorkspaceStateV1,
  paletteId: string,
  colorIndex: number,
): ColorWorkspaceStateV1 {
  let found = false;
  const palettes = state.palettes.map((palette) => {
    if (palette.id !== paletteId) return palette;
    found = true;
    if (!Number.isInteger(colorIndex) || colorIndex < 0 || colorIndex >= palette.colors.length) {
      throw new RangeError('palette color index out of range');
    }
    return createColorPaletteV1(
      palette.id,
      palette.name,
      palette.colors.filter((_, index) => index !== colorIndex),
    );
  });
  if (!found) throw new RangeError('palette not found');
  return withPalettesV1(state, palettes, state.activePaletteId);
}

export function moveColorWithinPaletteV1(
  state: ColorWorkspaceStateV1,
  paletteId: string,
  fromIndex: number,
  toIndex: number,
): ColorWorkspaceStateV1 {
  let found = false;
  const palettes = state.palettes.map((palette) => {
    if (palette.id !== paletteId) return palette;
    found = true;
    return createColorPaletteV1(palette.id, palette.name, moveItemV1(palette.colors, fromIndex, toIndex));
  });
  if (!found) throw new RangeError('palette not found');
  return withPalettesV1(state, palettes, state.activePaletteId);
}

export function serializeColorPaletteBundleV1(
  state: ColorWorkspaceStateV1,
  workingSpace: DocumentColorSpace,
): string {
  const bundle: ColorPaletteBundleV1 = Object.freeze({
    schema: 'illustro.palette-bundle/1' as const,
    encoding: 'encoded-rgb-unit' as const,
    workingSpace,
    palettes: state.palettes,
  });
  return JSON.stringify(bundle, null, 2);
}

export function parseColorPaletteBundleV1(value: unknown): ColorPaletteBundleV1 {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new TypeError('invalid palette bundle');
  const record = value as Readonly<Record<string, unknown>>;
  if (record.schema !== 'illustro.palette-bundle/1' || record.encoding !== 'encoded-rgb-unit') {
    throw new TypeError('invalid palette bundle schema');
  }
  if (record.workingSpace !== 'srgb' && record.workingSpace !== 'display-p3') {
    throw new TypeError('invalid palette working space');
  }
  if (!Array.isArray(record.palettes) || record.palettes.length < 1 || record.palettes.length > COLOR_PALETTE_LIMIT_V1) {
    throw new TypeError('invalid palette bundle entries');
  }
  const ids = new Set<string>();
  const palettes = Object.freeze(
    record.palettes.map((entry) => {
      if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) throw new TypeError('invalid palette entry');
      const palette = entry as Readonly<Record<string, unknown>>;
      if (typeof palette.id !== 'string' || typeof palette.name !== 'string' || !Array.isArray(palette.colors)) {
        throw new TypeError('invalid palette entry payload');
      }
      const frozen = createColorPaletteV1(
        palette.id,
        palette.name,
        palette.colors.map((color) => {
          if (!Array.isArray(color)) throw new TypeError('invalid palette color');
          return freezeRgbUnitColorV1(color as number[]);
        }),
      );
      if (ids.has(frozen.id)) throw new TypeError('duplicate palette id in bundle');
      ids.add(frozen.id);
      return frozen;
    }),
  );
  return Object.freeze({
    schema: 'illustro.palette-bundle/1' as const,
    encoding: 'encoded-rgb-unit' as const,
    workingSpace: record.workingSpace,
    palettes,
  });
}

function uniqueImportedPaletteIdV1(existing: ReadonlySet<string>, requested: string): string {
  if (!existing.has(requested)) return requested;
  let suffix = 2;
  while (existing.has(`${requested}-${suffix}`)) suffix += 1;
  return `${requested}-${suffix}`;
}

export function importColorPaletteBundleV1(
  state: ColorWorkspaceStateV1,
  bundle: ColorPaletteBundleV1,
): ColorWorkspaceStateV1 {
  if (state.palettes.length + bundle.palettes.length > COLOR_PALETTE_LIMIT_V1) {
    throw new RangeError(`workspace palettes must not exceed ${COLOR_PALETTE_LIMIT_V1}`);
  }
  const ids = new Set(state.palettes.map((palette) => palette.id));
  const imported = bundle.palettes.map((palette) => {
    const id = uniqueImportedPaletteIdV1(ids, palette.id);
    ids.add(id);
    return createColorPaletteV1(id, palette.name, palette.colors);
  });
  const activePaletteId = imported[0]?.id;
  if (activePaletteId === undefined) return state;
  return withPalettesV1(state, [...state.palettes, ...imported], activePaletteId);
}

export function previewColorWorkspaceCurrentV1(
  state: ColorWorkspaceStateV1,
  color: RgbUnitColorV1,
): ColorWorkspaceStateV1 {
  return Object.freeze({ ...state, current: freezeRgbUnitColorV1(color) });
}

export function commitColorWorkspaceCurrentV1(
  state: ColorWorkspaceStateV1,
  color: RgbUnitColorV1,
  previousOverride: RgbUnitColorV1 = state.current,
): ColorWorkspaceStateV1 {
  const current = freezeRgbUnitColorV1(color);
  const previous = freezeRgbUnitColorV1(previousOverride);
  if (
    rgbUnitColorEqualV1(state.current, current) &&
    rgbUnitColorEqualV1(state.previous, previous)
  ) {
    return state;
  }
  return Object.freeze({
    ...state,
    current,
    previous,
    history: dedupeHistory(current, state.history),
  });
}

export function swapColorWorkspaceColorsV1(state: ColorWorkspaceStateV1): ColorWorkspaceStateV1 {
  return Object.freeze({
    ...state,
    current: state.previous,
    previous: state.current,
    history: dedupeHistory(state.previous, state.history),
  });
}

export function parseColorWorkspaceStateV1(value: unknown): ColorWorkspaceStateV1 {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError('invalid color workspace state');
  }
  const record = value as Readonly<Record<string, unknown>>;
  if (record.schema !== 'illustro.color-workspace/1') throw new TypeError('invalid color workspace schema');
  if (!Array.isArray(record.current) || !Array.isArray(record.previous) || !Array.isArray(record.history)) {
    throw new TypeError('invalid color workspace payload');
  }
  const current = freezeRgbUnitColorV1(record.current as number[]);
  const previous = freezeRgbUnitColorV1(record.previous as number[]);
  const history = Object.freeze(
    (record.history as unknown[]).slice(0, COLOR_HISTORY_LIMIT_V1).map((entry) => {
      if (!Array.isArray(entry)) throw new TypeError('invalid color history entry');
      return freezeRgbUnitColorV1(entry as number[]);
    }),
  );

  if (record.palettes === undefined && record.activePaletteId === undefined) {
    const palette = defaultPaletteV1();
    return Object.freeze({
      schema: 'illustro.color-workspace/1' as const,
      current,
      previous,
      history,
      palettes: Object.freeze([palette]),
      activePaletteId: palette.id,
    });
  }
  if (!Array.isArray(record.palettes) || typeof record.activePaletteId !== 'string') {
    throw new TypeError('invalid color palette workspace payload');
  }
  if (record.palettes.length < 1 || record.palettes.length > COLOR_PALETTE_LIMIT_V1) {
    throw new TypeError('invalid color palette count');
  }
  const ids = new Set<string>();
  const palettes = Object.freeze(
    (record.palettes as unknown[]).map((entry) => {
      if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) throw new TypeError('invalid workspace palette');
      const palette = entry as Readonly<Record<string, unknown>>;
      if (typeof palette.id !== 'string' || typeof palette.name !== 'string' || !Array.isArray(palette.colors)) {
        throw new TypeError('invalid workspace palette payload');
      }
      const frozen = createColorPaletteV1(
        palette.id,
        palette.name,
        palette.colors.map((color) => {
          if (!Array.isArray(color)) throw new TypeError('invalid workspace palette color');
          return freezeRgbUnitColorV1(color as number[]);
        }),
      );
      if (ids.has(frozen.id)) throw new TypeError('duplicate workspace palette id');
      ids.add(frozen.id);
      return frozen;
    }),
  );
  const activePaletteId = ids.has(record.activePaletteId) ? record.activePaletteId : palettes[0]?.id;
  if (activePaletteId === undefined) throw new TypeError('workspace palette missing active id');
  return Object.freeze({
    schema: 'illustro.color-workspace/1' as const,
    current,
    previous,
    history,
    palettes,
    activePaletteId,
  });
}
''')

replace_once(
    'src/app/color-workflow-controller.ts',
    "  commitColorWorkspaceCurrentV1,\n  createColorWorkspaceStateV1,\n  parseColorWorkspaceStateV1,\n  previewColorWorkspaceCurrentV1,\n  swapColorWorkspaceColorsV1,\n  type ColorWorkspaceStateV1,\n",
    "  activeColorPaletteV1,\n  addColorToPaletteV1,\n  commitColorWorkspaceCurrentV1,\n  createColorPaletteInWorkspaceV1,\n  createColorWorkspaceStateV1,\n  deleteColorPaletteV1,\n  importColorPaletteBundleV1,\n  moveColorPaletteV1,\n  moveColorWithinPaletteV1,\n  parseColorPaletteBundleV1,\n  parseColorWorkspaceStateV1,\n  previewColorWorkspaceCurrentV1,\n  removeColorFromPaletteV1,\n  renameColorPaletteV1,\n  serializeColorPaletteBundleV1,\n  setActiveColorPaletteV1,\n  swapColorWorkspaceColorsV1,\n  type ColorWorkspaceStateV1,\n",
)

replace_once(
    'src/app/color-workflow-controller.ts',
    "  const history = requireElement('#color-history', HTMLDivElement);\n",
    "  const history = requireElement('#color-history', HTMLDivElement);\n  const paletteSelect = requireElement('#color-palette-select', HTMLSelectElement);\n  const paletteName = requireElement('#color-palette-name', HTMLInputElement);\n  const paletteCreate = requireElement('#color-palette-create', HTMLButtonElement);\n  const paletteDelete = requireElement('#color-palette-delete', HTMLButtonElement);\n  const paletteMoveUp = requireElement('#color-palette-up', HTMLButtonElement);\n  const paletteMoveDown = requireElement('#color-palette-down', HTMLButtonElement);\n  const paletteSwatches = requireElement('#color-palette-swatches', HTMLDivElement);\n  const paletteAddCurrent = requireElement('#color-palette-add-current', HTMLButtonElement);\n  const paletteColorLeft = requireElement('#color-palette-color-left', HTMLButtonElement);\n  const paletteColorRight = requireElement('#color-palette-color-right', HTMLButtonElement);\n  const paletteColorDelete = requireElement('#color-palette-color-delete', HTMLButtonElement);\n  const paletteImport = requireElement('#color-palette-import', HTMLButtonElement);\n  const paletteExport = requireElement('#color-palette-export', HTMLButtonElement);\n  const paletteFile = requireElement('#color-palette-file', HTMLInputElement);\n",
)

replace_once(
    'src/app/color-workflow-controller.ts',
    "  let interactionStart: RgbUnitColorV1 | null = null;\n  let disposed = false;\n",
    "  let interactionStart: RgbUnitColorV1 | null = null;\n  let selectedPaletteColorIndex: number | null = null;\n  let disposed = false;\n",
)

publish_anchor = """    history.replaceChildren(\n      ...state.history.map((color, index) => {\n        const button = document.createElement('button');\n        button.type = 'button';\n        button.className = 'shell-color-history-swatch';\n        button.style.background = cssEncodedRgbV1(color, workingSpace());\n        button.title = `履歴 ${index + 1}: ${formatHexRgbV1(color)}`;\n        button.setAttribute('aria-label', button.title);\n        button.addEventListener('click', () => commit(color));\n        return button;\n      }),\n    );\n"""
publish_replacement = publish_anchor + """    const activePalette = activeColorPaletteV1(state);\n    const activePaletteIndex = state.palettes.findIndex((palette) => palette.id === activePalette.id);\n    paletteSelect.replaceChildren(\n      ...state.palettes.map((palette) => {\n        const option = document.createElement('option');\n        option.value = palette.id;\n        option.textContent = palette.name;\n        return option;\n      }),\n    );\n    paletteSelect.value = activePalette.id;\n    paletteName.value = activePalette.name;\n    paletteDelete.disabled = state.palettes.length <= 1;\n    paletteMoveUp.disabled = activePaletteIndex <= 0;\n    paletteMoveDown.disabled = activePaletteIndex < 0 || activePaletteIndex >= state.palettes.length - 1;\n    if (selectedPaletteColorIndex !== null && selectedPaletteColorIndex >= activePalette.colors.length) {\n      selectedPaletteColorIndex = activePalette.colors.length > 0 ? activePalette.colors.length - 1 : null;\n    }\n    paletteSwatches.replaceChildren(\n      ...activePalette.colors.map((color, index) => {\n        const button = document.createElement('button');\n        button.type = 'button';\n        button.className = 'shell-color-palette-swatch';\n        if (selectedPaletteColorIndex === index) button.classList.add('is-selected');\n        button.style.background = cssEncodedRgbV1(color, workingSpace());\n        button.title = `${activePalette.name} ${index + 1}: ${formatHexRgbV1(color)}`;\n        button.setAttribute('aria-label', button.title);\n        button.addEventListener('click', () => {\n          selectedPaletteColorIndex = index;\n          commit(color);\n        });\n        return button;\n      }),\n    );\n    const hasSelectedPaletteColor = selectedPaletteColorIndex !== null && activePalette.colors.length > 0;\n    paletteColorDelete.disabled = !hasSelectedPaletteColor;\n    paletteColorLeft.disabled = !hasSelectedPaletteColor || selectedPaletteColorIndex === 0;\n    paletteColorRight.disabled =\n      !hasSelectedPaletteColor ||\n      selectedPaletteColorIndex === null ||\n      selectedPaletteColorIndex >= activePalette.colors.length - 1;\n"""
replace_once('src/app/color-workflow-controller.ts', publish_anchor, publish_replacement)

replace_once(
    'src/app/color-workflow-controller.ts',
    "    input.root.dataset.illustroColorHistory = String(state.history.length);\n    input.root.dataset.illustroColorWorkingSpace = workingSpace();\n",
    "    input.root.dataset.illustroColorHistory = String(state.history.length);\n    input.root.dataset.illustroColorPaletteCount = String(state.palettes.length);\n    input.root.dataset.illustroActiveColorPalette = activePalette.id;\n    input.root.dataset.illustroActiveColorPaletteSize = String(activePalette.colors.length);\n    input.root.dataset.illustroColorWorkingSpace = workingSpace();\n",
)

action_anchor = """  previousSwatch.addEventListener('click', onPrevious);\n\n  publish();\n"""
action_replacement = r'''  previousSwatch.addEventListener('click', onPrevious);

  const paletteUpdate = (next: ColorWorkspaceStateV1, message: string): void => {
    state = next;
    interactionStart = null;
    persist();
    status.value = message;
    publish();
  };
  const onPaletteSelect = (): void => {
    try {
      selectedPaletteColorIndex = null;
      paletteUpdate(setActiveColorPaletteV1(state, paletteSelect.value), '');
    } catch (error) {
      status.value = error instanceof Error ? error.message : String(error);
      publish(false);
    }
  };
  const makePaletteId = (): string => {
    const uuid = globalThis.crypto?.randomUUID?.();
    return `palette-${uuid ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`}`;
  };
  const onPaletteCreate = (): void => {
    try {
      selectedPaletteColorIndex = null;
      paletteUpdate(
        createColorPaletteInWorkspaceV1(state, makePaletteId(), `パレット ${state.palettes.length + 1}`),
        'パレットを作成しました',
      );
      paletteName.focus();
      paletteName.select();
    } catch (error) {
      status.value = error instanceof Error ? error.message : String(error);
    }
  };
  const onPaletteRename = (): void => {
    try {
      paletteUpdate(renameColorPaletteV1(state, state.activePaletteId, paletteName.value), 'パレット名を変更しました');
    } catch (error) {
      status.value = error instanceof Error ? error.message : String(error);
      publish(false);
    }
  };
  const onPaletteDelete = (): void => {
    try {
      selectedPaletteColorIndex = null;
      paletteUpdate(deleteColorPaletteV1(state, state.activePaletteId), 'パレットを削除しました');
    } catch (error) {
      status.value = error instanceof Error ? error.message : String(error);
    }
  };
  const moveActivePalette = (delta: -1 | 1): void => {
    try {
      const index = state.palettes.findIndex((palette) => palette.id === state.activePaletteId);
      paletteUpdate(moveColorPaletteV1(state, state.activePaletteId, index + delta), 'パレットを並べ替えました');
    } catch (error) {
      status.value = error instanceof Error ? error.message : String(error);
    }
  };
  const onPaletteUp = (): void => moveActivePalette(-1);
  const onPaletteDown = (): void => moveActivePalette(1);
  const onPaletteAddCurrent = (): void => {
    try {
      const before = activeColorPaletteV1(state);
      const existingIndex = before.colors.findIndex(
        (color) => color[0] === state.current[0] && color[1] === state.current[1] && color[2] === state.current[2],
      );
      const next = addColorToPaletteV1(state, state.activePaletteId, state.current);
      const active = activeColorPaletteV1(next);
      selectedPaletteColorIndex = existingIndex >= 0 ? existingIndex : active.colors.length - 1;
      paletteUpdate(next, existingIndex >= 0 ? '同じ色がパレットにあります' : '現在色をパレットへ追加しました');
    } catch (error) {
      status.value = error instanceof Error ? error.message : String(error);
    }
  };
  const onPaletteColorDelete = (): void => {
    if (selectedPaletteColorIndex === null) return;
    try {
      const index = selectedPaletteColorIndex;
      const next = removeColorFromPaletteV1(state, state.activePaletteId, index);
      const active = activeColorPaletteV1(next);
      selectedPaletteColorIndex = active.colors.length === 0 ? null : Math.min(index, active.colors.length - 1);
      paletteUpdate(next, 'パレットから色を削除しました');
    } catch (error) {
      status.value = error instanceof Error ? error.message : String(error);
    }
  };
  const moveSelectedPaletteColor = (delta: -1 | 1): void => {
    if (selectedPaletteColorIndex === null) return;
    try {
      const target = selectedPaletteColorIndex + delta;
      const next = moveColorWithinPaletteV1(state, state.activePaletteId, selectedPaletteColorIndex, target);
      selectedPaletteColorIndex = target;
      paletteUpdate(next, 'パレット色を並べ替えました');
    } catch (error) {
      status.value = error instanceof Error ? error.message : String(error);
    }
  };
  const onPaletteColorLeft = (): void => moveSelectedPaletteColor(-1);
  const onPaletteColorRight = (): void => moveSelectedPaletteColor(1);
  const onPaletteImportClick = (): void => paletteFile.click();
  const onPaletteImportChange = async (): Promise<void> => {
    const file = paletteFile.files?.[0];
    if (file === undefined) return;
    try {
      const bundle = parseColorPaletteBundleV1(JSON.parse(await file.text()));
      const next = importColorPaletteBundleV1(state, bundle);
      selectedPaletteColorIndex = null;
      const mismatch = bundle.workingSpace !== workingSpace();
      paletteUpdate(
        next,
        mismatch
          ? `パレットを読込: ${bundle.workingSpace}値を変換せず保持（profile変換は後続M5D）`
          : 'パレットを読み込みました',
      );
    } catch (error) {
      status.value = error instanceof Error ? error.message : String(error);
    } finally {
      paletteFile.value = '';
    }
  };
  const onPaletteExport = (): void => {
    try {
      const payload = serializeColorPaletteBundleV1(state, workingSpace());
      const blob = new Blob([payload], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'illustro-palettes.json';
      anchor.click();
      globalThis.setTimeout(() => URL.revokeObjectURL(url), 0);
      status.value = 'パレットを書き出しました';
    } catch (error) {
      status.value = error instanceof Error ? error.message : String(error);
    }
  };

  paletteSelect.addEventListener('change', onPaletteSelect);
  paletteCreate.addEventListener('click', onPaletteCreate);
  paletteName.addEventListener('change', onPaletteRename);
  paletteDelete.addEventListener('click', onPaletteDelete);
  paletteMoveUp.addEventListener('click', onPaletteUp);
  paletteMoveDown.addEventListener('click', onPaletteDown);
  paletteAddCurrent.addEventListener('click', onPaletteAddCurrent);
  paletteColorDelete.addEventListener('click', onPaletteColorDelete);
  paletteColorLeft.addEventListener('click', onPaletteColorLeft);
  paletteColorRight.addEventListener('click', onPaletteColorRight);
  paletteImport.addEventListener('click', onPaletteImportClick);
  paletteFile.addEventListener('change', onPaletteImportChange);
  paletteExport.addEventListener('click', onPaletteExport);

  publish();
'''
replace_once('src/app/color-workflow-controller.ts', action_anchor, action_replacement)

replace_once(
    'src/app/color-workflow-controller.ts',
    "      previousSwatch.removeEventListener('click', onPrevious);\n      input.root.dataset.illustroColorWorkflow = 'disposed';\n",
    "      previousSwatch.removeEventListener('click', onPrevious);\n      paletteSelect.removeEventListener('change', onPaletteSelect);\n      paletteCreate.removeEventListener('click', onPaletteCreate);\n      paletteName.removeEventListener('change', onPaletteRename);\n      paletteDelete.removeEventListener('click', onPaletteDelete);\n      paletteMoveUp.removeEventListener('click', onPaletteUp);\n      paletteMoveDown.removeEventListener('click', onPaletteDown);\n      paletteAddCurrent.removeEventListener('click', onPaletteAddCurrent);\n      paletteColorDelete.removeEventListener('click', onPaletteColorDelete);\n      paletteColorLeft.removeEventListener('click', onPaletteColorLeft);\n      paletteColorRight.removeEventListener('click', onPaletteColorRight);\n      paletteImport.removeEventListener('click', onPaletteImportClick);\n      paletteFile.removeEventListener('change', onPaletteImportChange);\n      paletteExport.removeEventListener('click', onPaletteExport);\n      input.root.dataset.illustroColorWorkflow = 'disposed';\n",
)

replace_once(
    'src/index.html',
    '            <div id="color-history" class="shell-color-history"></div>\n',
    '''            <div id="color-history" class="shell-color-history"></div>\n            <details class="shell-color-palettes">\n              <summary>パレット</summary>\n              <div class="shell-color-palette-body">\n                <select id="color-palette-select" aria-label="カラーパレット"></select>\n                <div class="shell-color-palette-name-row">\n                  <input id="color-palette-name" type="text" maxlength="80" aria-label="パレット名" />\n                  <button id="color-palette-create" type="button" title="パレットを作成" aria-label="パレットを作成">＋</button>\n                  <button id="color-palette-delete" type="button" title="パレットを削除" aria-label="パレットを削除">×</button>\n                </div>\n                <div class="shell-color-palette-order" aria-label="パレット順序">\n                  <button id="color-palette-up" type="button" aria-label="パレットを前へ">↑</button>\n                  <button id="color-palette-down" type="button" aria-label="パレットを後へ">↓</button>\n                  <span>順序</span>\n                </div>\n                <div id="color-palette-swatches" class="shell-color-palette-swatches"></div>\n                <div class="shell-color-palette-actions">\n                  <button id="color-palette-add-current" type="button">色＋</button>\n                  <button id="color-palette-color-left" type="button" aria-label="選択色を左へ">←</button>\n                  <button id="color-palette-color-right" type="button" aria-label="選択色を右へ">→</button>\n                  <button id="color-palette-color-delete" type="button" aria-label="選択色を削除">色−</button>\n                </div>\n                <div class="shell-color-palette-io">\n                  <button id="color-palette-import" type="button">読込</button>\n                  <button id="color-palette-export" type="button">書出</button>\n                  <input id="color-palette-file" type="file" accept="application/json,.json" hidden />\n                </div>\n              </div>\n            </details>\n''',
)

css = r'''

.shell-color-palettes {
  border: 1px solid #e3e8f1;
  border-radius: 9px;
  background: #fbfcff;
}

.shell-color-palettes > summary {
  min-height: 30px;
  padding: 7px 9px;
  cursor: pointer;
  color: #536079;
  font-size: 10px;
  font-weight: 760;
  list-style-position: inside;
}

.shell-color-palette-body {
  display: grid;
  gap: 7px;
  padding: 0 8px 8px;
}

#color-palette-select,
#color-palette-name,
.shell-color-palette-body button {
  min-width: 0;
  min-height: 32px;
  border: 1px solid #dfe5ef;
  border-radius: 8px;
  background: #fff;
  color: #38445d;
  font: inherit;
  font-size: 10px;
}

#color-palette-select,
#color-palette-name {
  width: 100%;
  padding: 0 7px;
}

.shell-color-palette-body button {
  padding: 0 8px;
  cursor: pointer;
}

.shell-color-palette-body button:disabled {
  cursor: default;
  opacity: 0.35;
}

.shell-color-palette-name-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 34px 34px;
  gap: 5px;
}

.shell-color-palette-order,
.shell-color-palette-actions,
.shell-color-palette-io {
  display: flex;
  align-items: center;
  gap: 5px;
}

.shell-color-palette-order span {
  margin-left: 2px;
  color: #8792a6;
  font-size: 9px;
}

.shell-color-palette-swatches {
  display: flex;
  gap: 5px;
  min-height: 30px;
  overflow-x: auto;
  padding: 2px 1px 3px;
  scrollbar-width: thin;
}

.shell-color-palette-swatches .shell-color-palette-swatch {
  flex: 0 0 28px;
  width: 28px;
  min-height: 28px;
  padding: 0;
  border-radius: 7px;
  box-shadow: inset 0 0 0 1px #fff;
}

.shell-color-palette-swatch.is-selected {
  outline: 2px solid #3b82f6;
  outline-offset: 1px;
}

.shell-color-palette-actions button:first-child {
  margin-right: auto;
}

.shell-color-palette-io {
  justify-content: flex-end;
}
'''
Path('public/app-shell.css').write_text(Path('public/app-shell.css').read_text() + css)

replace_once(
    'public/mobile-shell.css',
    "  .shell-color-entry-grid input,\n  .shell-color-hex input,\n  .shell-color-swatches button {\n    min-height: 44px;\n  }\n",
    "  .shell-color-entry-grid input,\n  .shell-color-hex input,\n  .shell-color-swatches button,\n  #color-palette-select,\n  #color-palette-name,\n  .shell-color-palette-body button {\n    min-height: 44px;\n  }\n\n  .shell-color-palette-name-row {\n    grid-template-columns: minmax(0, 1fr) 44px 44px;\n  }\n\n  .shell-color-palette-swatches .shell-color-palette-swatch {\n    flex-basis: 44px;\n    width: 44px;\n    min-height: 44px;\n  }\n",
)

Path('tests/unit/palette-workflow.test.ts').write_text(r'''import { describe, expect, it } from 'vitest';
import { rgbBytesToUnitV1, rgbUnitToBytesV1 } from '../../src/domain/color.js';
import {
  activeColorPaletteV1,
  addColorToPaletteV1,
  createColorPaletteInWorkspaceV1,
  createColorWorkspaceStateV1,
  deleteColorPaletteV1,
  importColorPaletteBundleV1,
  moveColorPaletteV1,
  moveColorWithinPaletteV1,
  parseColorPaletteBundleV1,
  parseColorWorkspaceStateV1,
  removeColorFromPaletteV1,
  renameColorPaletteV1,
  serializeColorPaletteBundleV1,
  setActiveColorPaletteV1,
} from '../../src/app/color-workspace-state.js';

describe('M5D named palettes', () => {
  it('creates, names, selects and deletes multiple palettes while retaining one active palette', () => {
    let state = createColorWorkspaceStateV1();
    state = createColorPaletteInWorkspaceV1(state, 'palette-ink', 'Ink');
    state = createColorPaletteInWorkspaceV1(state, 'palette-skin', 'Skin');
    expect(state.palettes.map((palette) => palette.name)).toEqual(['基本', 'Ink', 'Skin']);
    state = renameColorPaletteV1(state, 'palette-ink', 'Line Art');
    state = setActiveColorPaletteV1(state, 'palette-ink');
    expect(activeColorPaletteV1(state).name).toBe('Line Art');
    state = deleteColorPaletteV1(state, 'palette-skin');
    expect(state.palettes.map((palette) => palette.id)).toEqual(['palette-default', 'palette-ink']);
    state = deleteColorPaletteV1(state, 'palette-default');
    expect(activeColorPaletteV1(state).id).toBe('palette-ink');
    expect(() => deleteColorPaletteV1(state, 'palette-ink')).toThrow(/at least one palette/);
  });

  it('reorders named palettes without changing active identity', () => {
    let state = createColorWorkspaceStateV1();
    state = createColorPaletteInWorkspaceV1(state, 'palette-a', 'A');
    state = createColorPaletteInWorkspaceV1(state, 'palette-b', 'B');
    state = setActiveColorPaletteV1(state, 'palette-a');
    state = moveColorPaletteV1(state, 'palette-a', 0);
    expect(state.palettes.map((palette) => palette.id)).toEqual(['palette-a', 'palette-default', 'palette-b']);
    expect(state.activePaletteId).toBe('palette-a');
  });

  it('adds, removes and reorders palette colors using canonical encoded RGB values', () => {
    let state = createColorWorkspaceStateV1();
    const red = rgbBytesToUnitV1(255, 0, 0);
    const green = rgbBytesToUnitV1(0, 255, 0);
    state = createColorPaletteInWorkspaceV1(state, 'palette-edit', 'Editable');
    state = addColorToPaletteV1(state, 'palette-edit', red);
    state = addColorToPaletteV1(state, 'palette-edit', green);
    state = addColorToPaletteV1(state, 'palette-edit', red);
    expect(activeColorPaletteV1(state).colors).toHaveLength(2);
    state = moveColorWithinPaletteV1(state, 'palette-edit', 1, 0);
    expect(rgbUnitToBytesV1(activeColorPaletteV1(state).colors[0] ?? red)).toEqual([0, 255, 0]);
    state = removeColorFromPaletteV1(state, 'palette-edit', 1);
    expect(activeColorPaletteV1(state).colors).toHaveLength(1);
  });

  it('migrates the pre-palette color-workspace/1 payload without losing color history', () => {
    const legacy = {
      schema: 'illustro.color-workspace/1',
      current: [1, 0, 0],
      previous: [0, 0, 0],
      history: [[1, 0, 0], [0, 0, 0]],
    };
    const state = parseColorWorkspaceStateV1(legacy);
    expect(rgbUnitToBytesV1(state.current)).toEqual([255, 0, 0]);
    expect(state.history).toHaveLength(2);
    expect(state.palettes).toHaveLength(1);
    expect(activeColorPaletteV1(state).name).toBe('基本');
  });

  it('exports/imports versioned palette bundles and resolves imported id collisions deterministically', () => {
    let source = createColorWorkspaceStateV1();
    source = createColorPaletteInWorkspaceV1(source, 'palette-a', 'A');
    source = addColorToPaletteV1(source, 'palette-a', rgbBytesToUnitV1(12, 34, 56));
    const encoded = serializeColorPaletteBundleV1(source, 'display-p3');
    const bundle = parseColorPaletteBundleV1(JSON.parse(encoded));
    expect(bundle.workingSpace).toBe('display-p3');
    expect(bundle.encoding).toBe('encoded-rgb-unit');

    let destination = createColorWorkspaceStateV1();
    destination = createColorPaletteInWorkspaceV1(destination, 'palette-a', 'Existing A');
    destination = importColorPaletteBundleV1(destination, bundle);
    expect(destination.palettes.map((palette) => palette.id)).toEqual([
      'palette-default',
      'palette-a',
      'palette-default-2',
      'palette-a-2',
    ]);
    expect(destination.activePaletteId).toBe('palette-default-2');
  });
});
''')

replace_once(
    'scripts/verify-m5d-color.mjs',
    "  'history',\n]);\n",
    "  'history',\n  'palettes',\n  'activePaletteId',\n  'createColorPaletteInWorkspaceV1',\n  'renameColorPaletteV1',\n  'deleteColorPaletteV1',\n  'moveColorPaletteV1',\n  'moveColorWithinPaletteV1',\n  'parseColorPaletteBundleV1',\n  'serializeColorPaletteBundleV1',\n]);\n",
)
replace_once(
    'scripts/verify-m5d-color.mjs',
    "  '#color-history',\n  'setPaintColor',\n]);\n",
    "  '#color-history',\n  '#color-palette-select',\n  '#color-palette-name',\n  '#color-palette-swatches',\n  '#color-palette-import',\n  '#color-palette-export',\n  'setPaintColor',\n]);\n",
)
replace_once(
    'scripts/verify-m5d-color.mjs',
    "  'id=\"color-history\"',\n]);\n",
    "  'id=\"color-history\"',\n  'id=\"color-palette-select\"',\n  'id=\"color-palette-name\"',\n  'id=\"color-palette-create\"',\n  'id=\"color-palette-delete\"',\n  'id=\"color-palette-up\"',\n  'id=\"color-palette-down\"',\n  'id=\"color-palette-swatches\"',\n  'id=\"color-palette-add-current\"',\n  'id=\"color-palette-color-left\"',\n  'id=\"color-palette-color-right\"',\n  'id=\"color-palette-color-delete\"',\n  'id=\"color-palette-import\"',\n  'id=\"color-palette-export\"',\n]);\n",
)
replace_once(
    'scripts/verify-m5d-color.mjs',
    "  'M5D-007 color history:完了',\n  'M5D-008 palette create:未完了',\n]);\nconsole.log('M5D color foundation verification passed');\n",
    "  'M5D-007 color history:完了',\n  'M5D-008 palette create:完了',\n  'M5D-009 palette rename:完了',\n  'M5D-010 palette delete:完了',\n  'M5D-011 multiple named palettes:完了',\n  'M5D-012 palette reorder:完了',\n  'M5D-013 palette-color reorder:完了',\n  'M5D-014 palette import:完了',\n  'M5D-015 palette export:完了',\n  'M5D-016 Eyedropper:未完了',\n]);\nconsole.log('M5D color/palette verification passed');\n",
)

progress = Path('IMPLEMENTATION_PROGRESS.md').read_text()
for item in range(8, 16):
    tag = f'M5D-{item:03d}'
    progress = progress.replace(f'{tag} palette', f'{tag} palette')
progress = progress.replace('M5D-008 palette create:未完了', 'M5D-008 palette create:完了')
progress = progress.replace('M5D-009 palette rename:未完了', 'M5D-009 palette rename:完了')
progress = progress.replace('M5D-010 palette delete:未完了', 'M5D-010 palette delete:完了')
progress = progress.replace('M5D-011 multiple named palettes:未完了', 'M5D-011 multiple named palettes:完了')
progress = progress.replace('M5D-012 palette reorder:未完了', 'M5D-012 palette reorder:完了')
progress = progress.replace('M5D-013 palette-color reorder:未完了', 'M5D-013 palette-color reorder:完了')
progress = progress.replace('M5D-014 palette import:未完了', 'M5D-014 palette import:完了')
progress = progress.replace('M5D-015 palette export:未完了', 'M5D-015 palette export:完了')
Path('IMPLEMENTATION_PROGRESS.md').write_text(progress)

memo = Path('ILLUSTRO_DESIGN_MEMO.md').read_text()
memo += r'''

#### M5D named-palette semantic boundary — 2026-09-02

- M5D-008 through M5D-015 implement editable **workspace/user named palettes** without changing the canonical native document schema. Palette creation, rename, deletion, active-palette selection, palette ordering and per-palette color ordering persist through the existing local color-workspace state.
- Palette colors use the same canonical `RgbUnitColorV1` encoded-component representation as current/previous/history. Applying a swatch enters the normal current-color commit path, so subsequent baseline painting captures exactly the palette-selected encoded RGB value.
- Palette file interchange uses versioned JSON `illustro.palette-bundle/1` with `encoding: encoded-rgb-unit`, source `workingSpace` metadata and one or more named palettes. Import validates structure/ranges, preserves palette order, and resolves ID collisions without overwriting existing palettes. Export writes the complete named-palette workspace as normal JSON file interchange. QR-code palette sharing remains explicitly excluded.
- Until M5D-021 through M5D-025 are complete, palette import **does not claim profile conversion**. If source and active document working spaces differ, encoded component values remain intact and the UI reports that profile-aware conversion is deferred to the later color-management stage.
- Palette controls are placed under compact progressive disclosure inside the Color block so the existing selector/current/history hierarchy remains primary. The visual implementation was checked against canonical visual reference `ILLUSTRO_UI_VISUAL_TARGET_2026-08-30.png`, whose materialized bytes matched SHA-256 `32a6cb3991c9baa5b5e097943ce0550a3968d2dcde1be68e132f30ce03341a13` before this UI change.
'''
Path('ILLUSTRO_DESIGN_MEMO.md').write_text(memo)
