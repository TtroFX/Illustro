import {
  LINEAR_RESPONSE_CURVE_V1,
  normalizeResponseCurveV1,
  responseCurvePresetIdV1,
  type ResponseCurvePointV1,
} from '../domain/response-curve.js';
import { installSharedCurveEditorV1 } from './shared-curve-editor.js';

export const GLOBAL_PRESSURE_RESPONSE_SCHEMA_V1 = 'illustro.global-pressure-response/1' as const;
export const GLOBAL_PRESSURE_RESPONSE_STORAGE_KEY_V1 =
  'illustro.global-pressure-response/1' as const;

export interface GlobalPressureResponseSnapshotV1 {
  readonly schema: typeof GLOBAL_PRESSURE_RESPONSE_SCHEMA_V1;
  readonly curve: readonly ResponseCurvePointV1[];
}

export function createGlobalPressureResponseSnapshotV1(
  curve: readonly ResponseCurvePointV1[] = LINEAR_RESPONSE_CURVE_V1,
): GlobalPressureResponseSnapshotV1 {
  return Object.freeze({
    schema: GLOBAL_PRESSURE_RESPONSE_SCHEMA_V1,
    curve: normalizeResponseCurveV1(curve),
  });
}

export function serializeGlobalPressureResponseV1(
  snapshot: GlobalPressureResponseSnapshotV1,
): string {
  return JSON.stringify({ schema: snapshot.schema, curve: snapshot.curve });
}

export function parseGlobalPressureResponseV1(raw: string): GlobalPressureResponseSnapshotV1 {
  const value: unknown = JSON.parse(raw);
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError('global pressure response must be an object');
  }
  const record = value as { readonly schema?: unknown; readonly curve?: unknown };
  if (record.schema !== GLOBAL_PRESSURE_RESPONSE_SCHEMA_V1 || !Array.isArray(record.curve)) {
    throw new TypeError('unsupported global pressure response state');
  }
  return createGlobalPressureResponseSnapshotV1(record.curve as readonly ResponseCurvePointV1[]);
}

export interface GlobalPressureResponseControllerV1 {
  readonly schema: 'illustro.global-pressure-response-controller/1';
  snapshot(): GlobalPressureResponseSnapshotV1;
  subscribe(listener: (curve: readonly ResponseCurvePointV1[]) => void): () => void;
  dispose(): void;
}

function required<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector(selector);
  if (element === null) throw new Error(`global pressure response is missing ${selector}`);
  return element as T;
}

export function installGlobalPressureResponseControllerV1(input: {
  readonly root: HTMLElement;
  readonly storage?: Storage | null;
}): GlobalPressureResponseControllerV1 {
  const storage = input.storage ?? globalThis.localStorage;
  let state = createGlobalPressureResponseSnapshotV1();
  const stored = storage?.getItem(GLOBAL_PRESSURE_RESPONSE_STORAGE_KEY_V1);
  if (stored !== null && stored !== undefined) {
    try {
      state = parseGlobalPressureResponseV1(stored);
    } catch {
      state = createGlobalPressureResponseSnapshotV1();
    }
  }
  const listeners = new Set<(curve: readonly ResponseCurvePointV1[]) => void>();
  let disposed = false;

  const publish = (): void => {
    input.root.dataset.illustroGlobalPressureCurve =
      responseCurvePresetIdV1(state.curve) ?? 'custom';
    input.root.dataset.illustroGlobalPressureCurvePoints = String(state.curve.length);
  };

  const editor = installSharedCurveEditorV1({
    elements: {
      canvas: required<HTMLCanvasElement>(input.root, '#global-pressure-curve'),
      preset: required<HTMLSelectElement>(input.root, '#global-pressure-curve-preset'),
      inputNumber: required<HTMLInputElement>(input.root, '#global-pressure-curve-input'),
      outputNumber: required<HTMLInputElement>(input.root, '#global-pressure-curve-output'),
      deleteButton: required<HTMLButtonElement>(input.root, '#global-pressure-curve-delete'),
      resetButton: required<HTMLButtonElement>(input.root, '#global-pressure-curve-reset'),
    },
    initialCurve: state.curve,
    onChange(curve) {
      state = createGlobalPressureResponseSnapshotV1(curve);
      storage?.setItem(
        GLOBAL_PRESSURE_RESPONSE_STORAGE_KEY_V1,
        serializeGlobalPressureResponseV1(state),
      );
      publish();
      for (const listener of listeners) listener(state.curve);
    },
  });
  publish();

  return Object.freeze({
    schema: 'illustro.global-pressure-response-controller/1' as const,
    snapshot: () => state,
    subscribe(listener: (curve: readonly ResponseCurvePointV1[]) => void): () => void {
      listeners.add(listener);
      listener(state.curve);
      return () => listeners.delete(listener);
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      editor.dispose();
      listeners.clear();
      input.root.dataset.illustroGlobalPressureCurve = 'disposed';
    },
  });
}
