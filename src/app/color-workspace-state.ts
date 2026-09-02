import {
  BLACK_RGB_UNIT_V1,
  WHITE_RGB_UNIT_V1,
  freezeRgbUnitColorV1,
  rgbUnitColorEqualV1,
  type RgbUnitColorV1,
} from '../domain/color.js';

export const COLOR_HISTORY_LIMIT_V1 = 24;

export interface ColorWorkspaceStateV1 {
  readonly schema: 'illustro.color-workspace/1';
  readonly current: RgbUnitColorV1;
  readonly previous: RgbUnitColorV1;
  readonly history: readonly RgbUnitColorV1[];
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

export function createColorWorkspaceStateV1(): ColorWorkspaceStateV1 {
  return Object.freeze({
    schema: 'illustro.color-workspace/1' as const,
    current: BLACK_RGB_UNIT_V1,
    previous: WHITE_RGB_UNIT_V1,
    history: Object.freeze([BLACK_RGB_UNIT_V1, WHITE_RGB_UNIT_V1]),
  });
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
    schema: 'illustro.color-workspace/1' as const,
    current,
    previous,
    history: dedupeHistory(current, state.history),
  });
}

export function swapColorWorkspaceColorsV1(state: ColorWorkspaceStateV1): ColorWorkspaceStateV1 {
  return Object.freeze({
    schema: 'illustro.color-workspace/1' as const,
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
  return Object.freeze({
    schema: 'illustro.color-workspace/1' as const,
    current,
    previous,
    history,
  });
}
