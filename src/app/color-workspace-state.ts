import {
  BLACK_RGB_UNIT_V1,
  WHITE_RGB_UNIT_V1,
  freezeRgbUnitColorV1,
  rgbUnitColorEqualV1,
  type RgbUnitColorV1,
} from '../domain/color.js';
import { convertEncodedRgbV1 } from '../domain/color-management.js';
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
  if (id.length < 1 || id.length > 120)
    throw new RangeError('palette id must be 1..120 characters');
  return id;
}

function paletteNameV1(value: string): string {
  const name = value.trim();
  if (name.length < 1 || name.length > 80)
    throw new RangeError('palette name must be 1..80 characters');
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
  if (!state.palettes.some((palette) => palette.id === id))
    throw new RangeError('palette not found');
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
  if (state.palettes.some((entry) => entry.id === palette.id))
    throw new RangeError('palette id already exists');
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
  if (activePaletteId === undefined)
    throw new RangeError('palette deletion left no active palette');
  return withPalettesV1(state, palettes, activePaletteId);
}

function moveItemV1<T>(items: readonly T[], fromIndex: number, toIndex: number): readonly T[] {
  if (!Number.isInteger(fromIndex) || !Number.isInteger(toIndex))
    throw new RangeError('reorder indexes must be integers');
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
  return withPalettesV1(
    state,
    moveItemV1(state.palettes, fromIndex, toIndex),
    state.activePaletteId,
  );
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
    return createColorPaletteV1(
      palette.id,
      palette.name,
      moveItemV1(palette.colors, fromIndex, toIndex),
    );
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
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new TypeError('invalid palette bundle');
  const record = value as Readonly<Record<string, unknown>>;
  if (record.schema !== 'illustro.palette-bundle/1' || record.encoding !== 'encoded-rgb-unit') {
    throw new TypeError('invalid palette bundle schema');
  }
  if (record.workingSpace !== 'srgb' && record.workingSpace !== 'display-p3') {
    throw new TypeError('invalid palette working space');
  }
  if (
    !Array.isArray(record.palettes) ||
    record.palettes.length < 1 ||
    record.palettes.length > COLOR_PALETTE_LIMIT_V1
  ) {
    throw new TypeError('invalid palette bundle entries');
  }
  const ids = new Set<string>();
  const palettes = Object.freeze(
    record.palettes.map((entry) => {
      if (typeof entry !== 'object' || entry === null || Array.isArray(entry))
        throw new TypeError('invalid palette entry');
      const palette = entry as Readonly<Record<string, unknown>>;
      if (
        typeof palette.id !== 'string' ||
        typeof palette.name !== 'string' ||
        !Array.isArray(palette.colors)
      ) {
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

export function convertColorPaletteBundleWorkingSpaceV1(
  bundle: ColorPaletteBundleV1,
  targetWorkingSpace: DocumentColorSpace,
): ColorPaletteBundleV1 {
  if (bundle.workingSpace === targetWorkingSpace) return bundle;
  return Object.freeze({
    ...bundle,
    workingSpace: targetWorkingSpace,
    palettes: Object.freeze(
      bundle.palettes.map((palette) =>
        createColorPaletteV1(
          palette.id,
          palette.name,
          palette.colors.map((color) =>
            convertEncodedRgbV1(color, bundle.workingSpace, targetWorkingSpace),
          ),
        ),
      ),
    ),
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
  if (record.schema !== 'illustro.color-workspace/1')
    throw new TypeError('invalid color workspace schema');
  if (
    !Array.isArray(record.current) ||
    !Array.isArray(record.previous) ||
    !Array.isArray(record.history)
  ) {
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
      if (typeof entry !== 'object' || entry === null || Array.isArray(entry))
        throw new TypeError('invalid workspace palette');
      const palette = entry as Readonly<Record<string, unknown>>;
      if (
        typeof palette.id !== 'string' ||
        typeof palette.name !== 'string' ||
        !Array.isArray(palette.colors)
      ) {
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
  const activePaletteId = ids.has(record.activePaletteId)
    ? record.activePaletteId
    : palettes[0]?.id;
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
