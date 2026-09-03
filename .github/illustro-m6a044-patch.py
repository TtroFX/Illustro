from pathlib import Path


def replace_once(path: str, before: str, after: str) -> None:
    target = Path(path)
    text = target.read_text()
    count = text.count(before)
    if count != 1:
        raise RuntimeError(f'{path}: expected one replacement, found {count}: {before[:180]!r}')
    target.write_text(text.replace(before, after, 1))


def append_once(path: str, marker: str, addition: str) -> None:
    target = Path(path)
    text = target.read_text()
    if marker in text:
        return
    target.write_text(text.rstrip() + '\n\n' + addition.strip() + '\n')


Path('src/domain/response-curve.ts').write_text(r'''export const RESPONSE_CURVE_MAX_POINTS_V1 = 16 as const;

export interface ResponseCurvePointV1 {
  readonly input: number;
  readonly output: number;
}

export type ResponseCurvePresetIdV1 = 'linear' | 'soft' | 'hard' | 's-curve';

function point(input: number, output: number): ResponseCurvePointV1 {
  return Object.freeze({ input, output });
}

export const LINEAR_RESPONSE_CURVE_V1 = Object.freeze([point(0, 0), point(1, 1)]);

const SOFT_RESPONSE_CURVE_V1 = Object.freeze([
  point(0, 0),
  point(0.35, 0.6),
  point(1, 1),
]);
const HARD_RESPONSE_CURVE_V1 = Object.freeze([
  point(0, 0),
  point(0.65, 0.35),
  point(1, 1),
]);
const S_RESPONSE_CURVE_V1 = Object.freeze([
  point(0, 0),
  point(0.25, 0.1),
  point(0.75, 0.9),
  point(1, 1),
]);

export const RESPONSE_CURVE_PRESETS_V1 = Object.freeze([
  Object.freeze({ id: 'linear' as const, name: 'Linear', points: LINEAR_RESPONSE_CURVE_V1 }),
  Object.freeze({ id: 'soft' as const, name: 'Soft', points: SOFT_RESPONSE_CURVE_V1 }),
  Object.freeze({ id: 'hard' as const, name: 'Hard', points: HARD_RESPONSE_CURVE_V1 }),
  Object.freeze({ id: 's-curve' as const, name: 'S Curve', points: S_RESPONSE_CURVE_V1 }),
]);

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function finiteUnit(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError(`${label} must be a finite value within 0..1`);
  }
  return Object.is(value, -0) ? 0 : value;
}

export function normalizeResponseCurveV1(value: unknown): readonly ResponseCurvePointV1[] {
  if (!Array.isArray(value) || value.length < 2 || value.length > RESPONSE_CURVE_MAX_POINTS_V1) {
    throw new RangeError(`response curve requires 2..${RESPONSE_CURVE_MAX_POINTS_V1} points`);
  }
  const normalized = value.map((entry, index) => {
    if (!isRecord(entry)) throw new TypeError(`response curve point ${index} must be an object`);
    return point(
      finiteUnit(entry.input, `response curve point ${index} input`),
      finiteUnit(entry.output, `response curve point ${index} output`),
    );
  });
  const first = normalized[0];
  const last = normalized.at(-1);
  if (first?.input !== 0 || first.output !== 0 || last?.input !== 1 || last.output !== 1) {
    throw new RangeError('response curve endpoints must be exactly 0→0 and 1→1');
  }
  for (let index = 1; index < normalized.length; index += 1) {
    const previous = normalized[index - 1];
    const current = normalized[index];
    if (previous === undefined || current === undefined) continue;
    if (current.input <= previous.input) {
      throw new RangeError('response curve inputs must be strictly increasing');
    }
    if (current.output < previous.output) {
      throw new RangeError('response curve outputs must be monotonic');
    }
  }
  return Object.freeze(normalized);
}

export function responseCurveEqualsV1(
  left: readonly ResponseCurvePointV1[],
  right: readonly ResponseCurvePointV1[],
): boolean {
  return (
    left.length === right.length &&
    left.every(
      (pointValue, index) =>
        pointValue.input === right[index]?.input && pointValue.output === right[index]?.output,
    )
  );
}

export function responseCurveIsLinearV1(curve: readonly ResponseCurvePointV1[]): boolean {
  const normalized = normalizeResponseCurveV1(curve);
  return normalized.every((pointValue) => Math.abs(pointValue.output - pointValue.input) <= 1e-12);
}

export function responseCurvePresetV1(
  presetId: ResponseCurvePresetIdV1,
): readonly ResponseCurvePointV1[] {
  return RESPONSE_CURVE_PRESETS_V1.find((preset) => preset.id === presetId)?.points ?? LINEAR_RESPONSE_CURVE_V1;
}

export function responseCurvePresetIdV1(
  curve: readonly ResponseCurvePointV1[],
): ResponseCurvePresetIdV1 | null {
  const normalized = normalizeResponseCurveV1(curve);
  return RESPONSE_CURVE_PRESETS_V1.find((preset) => responseCurveEqualsV1(preset.points, normalized))?.id ?? null;
}

export interface CompiledResponseCurveV1 {
  readonly points: readonly ResponseCurvePointV1[];
  sample(input: number): number;
}

function endpointSlope(h0: number, h1: number, delta0: number, delta1: number): number {
  let slope = ((2 * h0 + h1) * delta0 - h0 * delta1) / (h0 + h1);
  if (Math.sign(slope) !== Math.sign(delta0)) return 0;
  if (Math.sign(delta0) !== Math.sign(delta1) && Math.abs(slope) > Math.abs(3 * delta0)) {
    slope = 3 * delta0;
  }
  return slope;
}

/** Monotone PCHIP/Fritsch-Carlson-style interpolation for reusable response functions. */
export function compileResponseCurveV1(value: unknown): CompiledResponseCurveV1 {
  const points = normalizeResponseCurveV1(value);
  const count = points.length;
  const widths: number[] = [];
  const deltas: number[] = [];
  for (let index = 0; index < count - 1; index += 1) {
    const left = points[index]!;
    const right = points[index + 1]!;
    const width = right.input - left.input;
    widths.push(width);
    deltas.push((right.output - left.output) / width);
  }
  const tangents = new Array<number>(count).fill(0);
  if (count === 2) {
    tangents[0] = deltas[0] ?? 1;
    tangents[1] = deltas[0] ?? 1;
  } else {
    tangents[0] = endpointSlope(widths[0]!, widths[1]!, deltas[0]!, deltas[1]!);
    tangents[count - 1] = endpointSlope(
      widths[count - 2]!,
      widths[count - 3]!,
      deltas[count - 2]!,
      deltas[count - 3]!,
    );
    for (let index = 1; index < count - 1; index += 1) {
      const before = deltas[index - 1]!;
      const after = deltas[index]!;
      if (before <= 0 || after <= 0) {
        tangents[index] = 0;
        continue;
      }
      const beforeWidth = widths[index - 1]!;
      const afterWidth = widths[index]!;
      const weight1 = 2 * afterWidth + beforeWidth;
      const weight2 = afterWidth + 2 * beforeWidth;
      tangents[index] = (weight1 + weight2) / (weight1 / before + weight2 / after);
    }
  }

  const sample = (input: number): number => {
    if (!Number.isFinite(input)) throw new TypeError('response curve input must be finite');
    if (input <= 0) return 0;
    if (input >= 1) return 1;
    let segment = 0;
    while (segment < count - 2 && input > points[segment + 1]!.input) segment += 1;
    const left = points[segment]!;
    const right = points[segment + 1]!;
    const width = right.input - left.input;
    const t = (input - left.input) / width;
    const t2 = t * t;
    const t3 = t2 * t;
    const h00 = 2 * t3 - 3 * t2 + 1;
    const h10 = t3 - 2 * t2 + t;
    const h01 = -2 * t3 + 3 * t2;
    const h11 = t3 - t2;
    const output =
      h00 * left.output +
      h10 * width * tangents[segment]! +
      h01 * right.output +
      h11 * width * tangents[segment + 1]!;
    return Math.max(left.output, Math.min(right.output, output));
  };
  return Object.freeze({ points, sample });
}

export function evaluateResponseCurveV1(value: unknown, input: number): number {
  return compileResponseCurveV1(value).sample(input);
}
''')

Path('src/app/shared-curve-editor.ts').write_text(r'''import {
  RESPONSE_CURVE_MAX_POINTS_V1,
  RESPONSE_CURVE_PRESETS_V1,
  compileResponseCurveV1,
  normalizeResponseCurveV1,
  responseCurveEqualsV1,
  responseCurvePresetIdV1,
  responseCurvePresetV1,
  type ResponseCurvePointV1,
  type ResponseCurvePresetIdV1,
} from '../domain/response-curve.js';

export interface SharedCurveEditorV1 {
  setCurve(curve: readonly ResponseCurvePointV1[]): void;
  setDisabled(disabled: boolean): void;
  snapshot(): readonly ResponseCurvePointV1[];
  dispose(): void;
}

interface SharedCurveEditorElementsV1 {
  readonly canvas: HTMLCanvasElement;
  readonly preset: HTMLSelectElement;
  readonly inputNumber: HTMLInputElement;
  readonly outputNumber: HTMLInputElement;
  readonly deleteButton: HTMLButtonElement;
  readonly resetButton: HTMLButtonElement;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function canvasPoint(
  canvas: HTMLCanvasElement,
  point: ResponseCurvePointV1,
): { readonly x: number; readonly y: number } {
  return Object.freeze({ x: point.input * canvas.width, y: (1 - point.output) * canvas.height });
}

export function installSharedCurveEditorV1(input: {
  readonly elements: SharedCurveEditorElementsV1;
  readonly initialCurve: readonly ResponseCurvePointV1[];
  readonly onChange: (curve: readonly ResponseCurvePointV1[]) => void;
}): SharedCurveEditorV1 {
  const { canvas, preset, inputNumber, outputNumber, deleteButton, resetButton } = input.elements;
  let curve = normalizeResponseCurveV1(input.initialCurve);
  let selectedIndex = 0;
  let draggingPointerId: number | null = null;
  let disabled = false;

  const render = (): void => {
    const context = canvas.getContext('2d');
    if (context !== null) {
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.strokeStyle = '#e6ebf3';
      context.lineWidth = 1;
      for (let step = 1; step < 4; step += 1) {
        const x = (canvas.width * step) / 4;
        const y = (canvas.height * step) / 4;
        context.beginPath();
        context.moveTo(x, 0);
        context.lineTo(x, canvas.height);
        context.stroke();
        context.beginPath();
        context.moveTo(0, y);
        context.lineTo(canvas.width, y);
        context.stroke();
      }
      context.strokeStyle = '#cbd5e1';
      context.beginPath();
      context.moveTo(0, canvas.height);
      context.lineTo(canvas.width, 0);
      context.stroke();

      const compiled = compileResponseCurveV1(curve);
      context.strokeStyle = '#2d8cff';
      context.lineWidth = 2.5;
      context.beginPath();
      for (let step = 0; step <= 96; step += 1) {
        const value = step / 96;
        const x = value * canvas.width;
        const y = (1 - compiled.sample(value)) * canvas.height;
        if (step === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      }
      context.stroke();
      curve.forEach((curvePoint, index) => {
        const position = canvasPoint(canvas, curvePoint);
        context.beginPath();
        context.arc(position.x, position.y, index === selectedIndex ? 6.5 : 5, 0, Math.PI * 2);
        context.fillStyle = index === selectedIndex ? '#ff3d8d' : '#ffffff';
        context.fill();
        context.lineWidth = 2;
        context.strokeStyle = index === selectedIndex ? '#c2185b' : '#2d8cff';
        context.stroke();
      });
    }
    const selected = curve[selectedIndex] ?? curve[0]!;
    inputNumber.value = (selected.input * 100).toFixed(1);
    outputNumber.value = (selected.output * 100).toFixed(1);
    const endpoint = selectedIndex === 0 || selectedIndex === curve.length - 1;
    inputNumber.disabled = disabled || endpoint;
    outputNumber.disabled = disabled || endpoint;
    deleteButton.disabled = disabled || endpoint;
    resetButton.disabled = disabled;
    preset.disabled = disabled;
    canvas.setAttribute('aria-disabled', String(disabled));
    const presetId = responseCurvePresetIdV1(curve);
    preset.value = presetId ?? 'custom';
  };

  const emit = (): void => {
    render();
    input.onChange(curve);
  };

  const updateSelected = (nextInput: number, nextOutput: number): void => {
    if (selectedIndex <= 0 || selectedIndex >= curve.length - 1) return;
    const before = curve[selectedIndex - 1]!;
    const after = curve[selectedIndex + 1]!;
    const normalizedInput = clamp(nextInput, before.input + 0.001, after.input - 0.001);
    const normalizedOutput = clamp(nextOutput, before.output, after.output);
    const next = curve.map((curvePoint, index) =>
      index === selectedIndex
        ? Object.freeze({ input: normalizedInput, output: normalizedOutput })
        : curvePoint,
    );
    curve = normalizeResponseCurveV1(next);
    emit();
  };

  const localPointer = (event: PointerEvent): { readonly input: number; readonly output: number } => {
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / Math.max(1, rect.width)) * canvas.width;
    const y = ((event.clientY - rect.top) / Math.max(1, rect.height)) * canvas.height;
    return Object.freeze({
      input: clamp(x / canvas.width, 0, 1),
      output: clamp(1 - y / canvas.height, 0, 1),
    });
  };

  const nearestPointIndex = (event: PointerEvent): number | null => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / Math.max(1, rect.width);
    const scaleY = canvas.height / Math.max(1, rect.height);
    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;
    let bestIndex: number | null = null;
    let bestDistance = 18 * 18;
    curve.forEach((curvePoint, index) => {
      const position = canvasPoint(canvas, curvePoint);
      const distance = (position.x - x) ** 2 + (position.y - y) ** 2;
      if (distance <= bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    });
    return bestIndex;
  };

  const onPointerDown = (event: PointerEvent): void => {
    if (disabled || event.button !== 0) return;
    const nearest = nearestPointIndex(event);
    if (nearest !== null) {
      selectedIndex = nearest;
      draggingPointerId = event.pointerId;
      canvas.setPointerCapture?.(event.pointerId);
      render();
      event.preventDefault();
      return;
    }
    if (curve.length >= RESPONSE_CURVE_MAX_POINTS_V1) return;
    const value = localPointer(event);
    if (value.input <= 0.001 || value.input >= 0.999) return;
    const insertionIndex = curve.findIndex((curvePoint) => curvePoint.input > value.input);
    if (insertionIndex <= 0) return;
    const before = curve[insertionIndex - 1]!;
    const after = curve[insertionIndex]!;
    const inserted = Object.freeze({
      input: value.input,
      output: clamp(value.output, before.output, after.output),
    });
    curve = normalizeResponseCurveV1([
      ...curve.slice(0, insertionIndex),
      inserted,
      ...curve.slice(insertionIndex),
    ]);
    selectedIndex = insertionIndex;
    draggingPointerId = event.pointerId;
    canvas.setPointerCapture?.(event.pointerId);
    emit();
    event.preventDefault();
  };

  const onPointerMove = (event: PointerEvent): void => {
    if (disabled || draggingPointerId !== event.pointerId) return;
    const value = localPointer(event);
    updateSelected(value.input, value.output);
    event.preventDefault();
  };
  const onPointerEnd = (event: PointerEvent): void => {
    if (draggingPointerId !== event.pointerId) return;
    draggingPointerId = null;
    if (canvas.hasPointerCapture?.(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  };
  const onInputNumber = (): void => {
    const selected = curve[selectedIndex];
    if (selected === undefined) return;
    updateSelected(Number(inputNumber.value) / 100, selected.output);
  };
  const onOutputNumber = (): void => {
    const selected = curve[selectedIndex];
    if (selected === undefined) return;
    updateSelected(selected.input, Number(outputNumber.value) / 100);
  };
  const onDelete = (): void => {
    if (disabled || selectedIndex <= 0 || selectedIndex >= curve.length - 1) return;
    curve = normalizeResponseCurveV1(curve.filter((_point, index) => index !== selectedIndex));
    selectedIndex = Math.max(0, selectedIndex - 1);
    emit();
  };
  const onReset = (): void => {
    curve = responseCurvePresetV1('linear');
    selectedIndex = 0;
    emit();
  };
  const onPreset = (): void => {
    if (disabled || preset.value === 'custom') return;
    const presetId = preset.value as ResponseCurvePresetIdV1;
    if (!RESPONSE_CURVE_PRESETS_V1.some((entry) => entry.id === presetId)) return;
    curve = responseCurvePresetV1(presetId);
    selectedIndex = 0;
    emit();
  };

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerEnd);
  canvas.addEventListener('pointercancel', onPointerEnd);
  inputNumber.addEventListener('change', onInputNumber);
  outputNumber.addEventListener('change', onOutputNumber);
  deleteButton.addEventListener('click', onDelete);
  resetButton.addEventListener('click', onReset);
  preset.addEventListener('change', onPreset);
  render();

  return Object.freeze({
    setCurve: (nextCurve: readonly ResponseCurvePointV1[]): void => {
      const normalized = normalizeResponseCurveV1(nextCurve);
      if (responseCurveEqualsV1(curve, normalized)) return;
      curve = normalized;
      selectedIndex = Math.min(selectedIndex, curve.length - 1);
      render();
    },
    setDisabled: (nextDisabled: boolean): void => {
      disabled = nextDisabled;
      render();
    },
    snapshot: (): readonly ResponseCurvePointV1[] => curve,
    dispose: (): void => {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerEnd);
      canvas.removeEventListener('pointercancel', onPointerEnd);
      inputNumber.removeEventListener('change', onInputNumber);
      outputNumber.removeEventListener('change', onOutputNumber);
      deleteButton.removeEventListener('click', onDelete);
      resetButton.removeEventListener('click', onReset);
      preset.removeEventListener('change', onPreset);
    },
  });
}
''')

# Brush schema stores the shared pressure response curve, omitting canonical linear default.
replace_once(
    'src/domain/brush-schema.ts',
    "import { toJsonValue, type JsonValue } from './serialization.js';",
    "import {\n  LINEAR_RESPONSE_CURVE_V1,\n  normalizeResponseCurveV1,\n  responseCurveIsLinearV1,\n  type ResponseCurvePointV1,\n} from './response-curve.js';\nimport { toJsonValue, type JsonValue } from './serialization.js';",
)
replace_once(
    'src/domain/brush-schema.ts',
    "export const DEFAULT_BRUSH_PRESSURE_FLOW_ENABLED_V1 = false as const;\n\nexport function brushPressureFlowEnabledV1(preset: BrushPresetV1): boolean {\n  const value = preset.dynamics.pressureFlowEnabled;\n  return typeof value === 'boolean' ? value : DEFAULT_BRUSH_PRESSURE_FLOW_ENABLED_V1;\n}\n\nexport function withBrushPressureFlowEnabledV1(\n  preset: BrushPresetV1,\n  enabled: boolean,\n): BrushPresetV1 {\n  if (typeof enabled !== 'boolean') throw new TypeError('brush pressure flow flag must be boolean');\n  if (enabled === DEFAULT_BRUSH_PRESSURE_FLOW_ENABLED_V1) {\n    const { pressureFlowEnabled: _pressureFlowEnabled, ...dynamics } = preset.dynamics;\n    return normalizeBrushPresetV1({ ...preset, dynamics });\n  }\n  return normalizeBrushPresetV1({\n    ...preset,\n    dynamics: { ...preset.dynamics, pressureFlowEnabled: enabled },\n  });\n}\n",
    "export const DEFAULT_BRUSH_PRESSURE_FLOW_ENABLED_V1 = false as const;\n\nexport function brushPressureFlowEnabledV1(preset: BrushPresetV1): boolean {\n  const value = preset.dynamics.pressureFlowEnabled;\n  return typeof value === 'boolean' ? value : DEFAULT_BRUSH_PRESSURE_FLOW_ENABLED_V1;\n}\n\nexport function withBrushPressureFlowEnabledV1(\n  preset: BrushPresetV1,\n  enabled: boolean,\n): BrushPresetV1 {\n  if (typeof enabled !== 'boolean') throw new TypeError('brush pressure flow flag must be boolean');\n  if (enabled === DEFAULT_BRUSH_PRESSURE_FLOW_ENABLED_V1) {\n    const { pressureFlowEnabled: _pressureFlowEnabled, ...dynamics } = preset.dynamics;\n    return normalizeBrushPresetV1({ ...preset, dynamics });\n  }\n  return normalizeBrushPresetV1({\n    ...preset,\n    dynamics: { ...preset.dynamics, pressureFlowEnabled: enabled },\n  });\n}\n\nexport function brushPressureResponseCurveV1(\n  preset: BrushPresetV1,\n): readonly ResponseCurvePointV1[] {\n  const value = preset.dynamics.pressureResponseCurve;\n  if (value === undefined) return LINEAR_RESPONSE_CURVE_V1;\n  try {\n    return normalizeResponseCurveV1(value);\n  } catch {\n    return LINEAR_RESPONSE_CURVE_V1;\n  }\n}\n\nexport function withBrushPressureResponseCurveV1(\n  preset: BrushPresetV1,\n  curve: readonly ResponseCurvePointV1[],\n): BrushPresetV1 {\n  const normalized = normalizeResponseCurveV1(curve);\n  if (responseCurveIsLinearV1(normalized)) {\n    const { pressureResponseCurve: _pressureResponseCurve, ...dynamics } = preset.dynamics;\n    return normalizeBrushPresetV1({ ...preset, dynamics });\n  }\n  const stored = toJsonValue(\n    normalized.map((pointValue) => ({ input: pointValue.input, output: pointValue.output })),\n  );\n  return normalizeBrushPresetV1({\n    ...preset,\n    dynamics: { ...preset.dynamics, pressureResponseCurve: stored },\n  });\n}\n",
)

# Baseline kernel compiles the response once per stroke and samples it once per logical stamp.
replace_once(
    'src/gpu/baseline-brush.ts',
    "import {\n  CANONICAL_TILE_SIZE_PX,",
    "import {\n  compileResponseCurveV1,\n  type CompiledResponseCurveV1,\n  type ResponseCurvePointV1,\n} from '../domain/response-curve.js';\nimport {\n  CANONICAL_TILE_SIZE_PX,",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    '  readonly #pressureFlowEnabled: boolean;\n  readonly #flow: number;',
    '  readonly #pressureFlowEnabled: boolean;\n  readonly #pressureResponseCurve: CompiledResponseCurveV1;\n  readonly #flow: number;',
)
replace_once(
    'src/gpu/baseline-brush.ts',
    '      readonly pressureFlowEnabled?: boolean;\n      readonly hardness?: number;',
    '      readonly pressureFlowEnabled?: boolean;\n      readonly pressureResponseCurve?: readonly ResponseCurvePointV1[];\n      readonly hardness?: number;',
)
replace_once(
    'src/gpu/baseline-brush.ts',
    '    this.#pressureFlowEnabled = pressureFlowEnabled;\n    this.#flow = flow;',
    '    this.#pressureFlowEnabled = pressureFlowEnabled;\n    this.#pressureResponseCurve = compileResponseCurveV1(\n      options.pressureResponseCurve ?? [\n        { input: 0, output: 0 },\n        { input: 1, output: 1 },\n      ],\n    );\n    this.#flow = flow;',
)
replace_once(
    'src/gpu/baseline-brush.ts',
    "    const pressureSizeScale = this.#pressureSizeEnabled ? stamp.pressure : 1;\n    const pressureOpacityScale = this.#pressureOpacityEnabled ? stamp.pressure : 1;\n    const pressureFlowScale = this.#pressureFlowEnabled ? stamp.pressure : 1;",
    "    const usesPressure =\n      this.#pressureSizeEnabled || this.#pressureOpacityEnabled || this.#pressureFlowEnabled;\n    const pressureResponse = usesPressure ? this.#pressureResponseCurve.sample(stamp.pressure) : 1;\n    const pressureSizeScale = this.#pressureSizeEnabled ? pressureResponse : 1;\n    const pressureOpacityScale = this.#pressureOpacityEnabled ? pressureResponse : 1;\n    const pressureFlowScale = this.#pressureFlowEnabled ? pressureResponse : 1;",
)

# Canonical facade forwards the shared curve.
replace_once(
    'src/app/canonical-raster-brush.ts',
    "import {\n  BaselineBrushDabBuilderV1,",
    "import type { ResponseCurvePointV1 } from '../domain/response-curve.js';\nimport {\n  BaselineBrushDabBuilderV1,",
)
replace_once(
    'src/app/canonical-raster-brush.ts',
    '      readonly pressureFlowEnabled?: boolean;\n      readonly hardness?: number;',
    '      readonly pressureFlowEnabled?: boolean;\n      readonly pressureResponseCurve?: readonly ResponseCurvePointV1[];\n      readonly hardness?: number;',
)
replace_once(
    'src/app/canonical-raster-brush.ts',
    "      ...(options.pressureFlowEnabled === undefined\n        ? {}\n        : { pressureFlowEnabled: options.pressureFlowEnabled }),\n      ...(options.hardness === undefined",
    "      ...(options.pressureFlowEnabled === undefined\n        ? {}\n        : { pressureFlowEnabled: options.pressureFlowEnabled }),\n      ...(options.pressureResponseCurve === undefined\n        ? {}\n        : { pressureResponseCurve: options.pressureResponseCurve }),\n      ...(options.hardness === undefined",
)

# PaintSession runtime owns normalized curve and captures it at stroke start.
replace_once(
    'src/app/paint-session-controller.ts',
    "import {\n  isUuid,",
    "import {\n  LINEAR_RESPONSE_CURVE_V1,\n  normalizeResponseCurveV1,\n  responseCurveEqualsV1,\n  type ResponseCurvePointV1,\n} from '../domain/response-curve.js';\nimport {\n  isUuid,",
)
replace_once(
    'src/app/paint-session-controller.ts',
    '  readonly brushPressureFlowEnabled: boolean;\n  readonly brushTipAngleDegrees: number;',
    '  readonly brushPressureFlowEnabled: boolean;\n  readonly brushPressureResponseCurve: readonly ResponseCurvePointV1[];\n  readonly brushTipAngleDegrees: number;',
)
replace_once(
    'src/app/paint-session-controller.ts',
    '  #brushPressureFlowEnabled = false;\n  #brushTipAngleDegrees: number = BASELINE_BRUSH_TIP_ANGLE_DEGREES;',
    '  #brushPressureFlowEnabled = false;\n  #brushPressureResponseCurve: readonly ResponseCurvePointV1[] = LINEAR_RESPONSE_CURVE_V1;\n  #brushTipAngleDegrees: number = BASELINE_BRUSH_TIP_ANGLE_DEGREES;',
)
replace_once(
    'src/app/paint-session-controller.ts',
    '      brushPressureFlowEnabled: this.#brushPressureFlowEnabled,\n      brushTipAngleDegrees: this.#brushTipAngleDegrees,',
    '      brushPressureFlowEnabled: this.#brushPressureFlowEnabled,\n      brushPressureResponseCurve: this.#brushPressureResponseCurve,\n      brushTipAngleDegrees: this.#brushTipAngleDegrees,',
)
replace_once(
    'src/app/paint-session-controller.ts',
    "  brushPressureFlowEnabled(): boolean {\n    return this.#brushPressureFlowEnabled;\n  }\n\n  setBrushTipAngleDegrees",
    "  brushPressureFlowEnabled(): boolean {\n    return this.#brushPressureFlowEnabled;\n  }\n\n  setBrushPressureResponseCurve(curve: readonly ResponseCurvePointV1[]): readonly ResponseCurvePointV1[] {\n    const normalized = normalizeResponseCurveV1(curve);\n    if (!responseCurveEqualsV1(normalized, this.#brushPressureResponseCurve)) this.#clearActiveStroke();\n    this.#brushPressureResponseCurve = normalized;\n    return this.#brushPressureResponseCurve;\n  }\n\n  brushPressureResponseCurve(): readonly ResponseCurvePointV1[] {\n    return this.#brushPressureResponseCurve;\n  }\n\n  setBrushTipAngleDegrees",
)
replace_once(
    'src/app/paint-session-controller.ts',
    '        pressureFlowEnabled: this.#brushPressureFlowEnabled,\n        hardness: this.#brushHardness,',
    '        pressureFlowEnabled: this.#brushPressureFlowEnabled,\n        pressureResponseCurve: this.#brushPressureResponseCurve,\n        hardness: this.#brushHardness,',
)

# Preset library mutation for direct point/preset edits.
replace_once(
    'src/app/brush-preset-library.ts',
    '  withBrushPressureFlowEnabledV1,\n  withBrushStrokeSpacingV1,',
    '  withBrushPressureFlowEnabledV1,\n  withBrushPressureResponseCurveV1,\n  withBrushStrokeSpacingV1,',
)
replace_once(
    'src/app/brush-preset-library.ts',
    "} from '../domain/brush-schema.js';",
    "} from '../domain/brush-schema.js';\nimport type { ResponseCurvePointV1 } from '../domain/response-curve.js';",
)
replace_once(
    'src/app/brush-preset-library.ts',
    "export function updateBrushPresetPressureFlowV1(\n  state: BrushPresetLibraryStateV1,\n  presetId: string,\n  enabled: boolean,\n): BrushPresetLibraryStateV1 {\n  return updateItemV1(state, presetId, (item) => {\n    if (item.locked) throw new Error('locked brush preset cannot be edited');\n    const current = withBrushPressureFlowEnabledV1(item.preset, enabled);\n    if (JSON.stringify(current) === JSON.stringify(item.preset)) return item;\n    const next = normalizeBrushPresetV1({ ...current, revision: item.preset.revision + 1 });\n    return itemV1({\n      source: item.source,\n      baseline: item.baseline,\n      preset: next,\n      locked: item.locked,\n    });\n  });\n}\n",
    "export function updateBrushPresetPressureFlowV1(\n  state: BrushPresetLibraryStateV1,\n  presetId: string,\n  enabled: boolean,\n): BrushPresetLibraryStateV1 {\n  return updateItemV1(state, presetId, (item) => {\n    if (item.locked) throw new Error('locked brush preset cannot be edited');\n    const current = withBrushPressureFlowEnabledV1(item.preset, enabled);\n    if (JSON.stringify(current) === JSON.stringify(item.preset)) return item;\n    const next = normalizeBrushPresetV1({ ...current, revision: item.preset.revision + 1 });\n    return itemV1({\n      source: item.source,\n      baseline: item.baseline,\n      preset: next,\n      locked: item.locked,\n    });\n  });\n}\n\nexport function updateBrushPresetPressureResponseCurveV1(\n  state: BrushPresetLibraryStateV1,\n  presetId: string,\n  curve: readonly ResponseCurvePointV1[],\n): BrushPresetLibraryStateV1 {\n  return updateItemV1(state, presetId, (item) => {\n    if (item.locked) throw new Error('locked brush preset cannot be edited');\n    const current = withBrushPressureResponseCurveV1(item.preset, curve);\n    if (JSON.stringify(current) === JSON.stringify(item.preset)) return item;\n    const next = normalizeBrushPresetV1({ ...current, revision: item.preset.revision + 1 });\n    return itemV1({\n      source: item.source,\n      baseline: item.baseline,\n      preset: next,\n      locked: item.locked,\n    });\n  });\n}\n",
)

# Brush controller wires the reusable direct-manipulation Curve Editor.
replace_once(
    'src/app/brush-preset-controller.ts',
    '  brushPressureFlowEnabledV1,\n  BUILTIN_BRUSH_GRAIN_RESOURCES_V1,',
    '  brushPressureFlowEnabledV1,\n  brushPressureResponseCurveV1,\n  BUILTIN_BRUSH_GRAIN_RESOURCES_V1,',
)
replace_once(
    'src/app/brush-preset-controller.ts',
    "} from '../domain/brush-schema.js';\nimport { customBrushTipAlphaFromFileV1",
    "} from '../domain/brush-schema.js';\nimport { responseCurveIsLinearV1 } from '../domain/response-curve.js';\nimport { customBrushTipAlphaFromFileV1",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    "import type { PaintSessionControllerV1 } from './paint-session-controller.js';",
    "import type { PaintSessionControllerV1 } from './paint-session-controller.js';\nimport {\n  installSharedCurveEditorV1,\n  type SharedCurveEditorV1,\n} from './shared-curve-editor.js';",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    '  updateBrushPresetPressureFlowV1,\n  updateBrushPresetSpacingV1,',
    '  updateBrushPresetPressureFlowV1,\n  updateBrushPresetPressureResponseCurveV1,\n  updateBrushPresetSpacingV1,',
)
replace_once(
    'src/app/brush-preset-controller.ts',
    "  const pressureFlowButton = requireElement('#brush-pressure-flow', HTMLButtonElement);\n  const tipShape = requireElement",
    "  const pressureFlowButton = requireElement('#brush-pressure-flow', HTMLButtonElement);\n  const pressureCurveCanvas = requireElement('#brush-pressure-curve', HTMLCanvasElement);\n  const pressureCurvePreset = requireElement('#brush-pressure-curve-preset', HTMLSelectElement);\n  const pressureCurveInput = requireElement('#brush-pressure-curve-input', HTMLInputElement);\n  const pressureCurveOutput = requireElement('#brush-pressure-curve-output', HTMLInputElement);\n  const pressureCurveDelete = requireElement('#brush-pressure-curve-delete', HTMLButtonElement);\n  const pressureCurveReset = requireElement('#brush-pressure-curve-reset', HTMLButtonElement);\n  const tipShape = requireElement",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    '  let state = loadState(storage);\n  let idCounter = 0;',
    '  let state = loadState(storage);\n  let pressureCurveEditor: SharedCurveEditorV1 | null = null;\n  let idCounter = 0;',
)
replace_once(
    'src/app/brush-preset-controller.ts',
    '    const pressureFlowEnabled = brushPressureFlowEnabledV1(item.preset);\n    input.paintSession.setBrushPressureFlowEnabled(pressureFlowEnabled);\n    const tipAssets = brushTipAssetsV1(item.preset);',
    '    const pressureFlowEnabled = brushPressureFlowEnabledV1(item.preset);\n    input.paintSession.setBrushPressureFlowEnabled(pressureFlowEnabled);\n    const pressureResponseCurve = brushPressureResponseCurveV1(item.preset);\n    input.paintSession.setBrushPressureResponseCurve(pressureResponseCurve);\n    const tipAssets = brushTipAssetsV1(item.preset);',
)
replace_once(
    'src/app/brush-preset-controller.ts',
    '    input.root.dataset.illustroBrushPressureFlow = String(pressureFlowEnabled);\n    input.root.dataset.illustroBrushTipShape',
    '    input.root.dataset.illustroBrushPressureFlow = String(pressureFlowEnabled);\n    input.root.dataset.illustroBrushPressureCurvePoints = String(pressureResponseCurve.length);\n    input.root.dataset.illustroBrushTipShape',
)
replace_once(
    'src/app/brush-preset-controller.ts',
    "    const pressureFlowEnabled = brushPressureFlowEnabledV1(selected.preset);\n    pressureFlowButton.textContent = pressureFlowEnabled ? 'ON' : 'OFF';\n    pressureFlowButton.setAttribute('aria-pressed', String(pressureFlowEnabled));\n    tipShape.value",
    "    const pressureFlowEnabled = brushPressureFlowEnabledV1(selected.preset);\n    pressureFlowButton.textContent = pressureFlowEnabled ? 'ON' : 'OFF';\n    pressureFlowButton.setAttribute('aria-pressed', String(pressureFlowEnabled));\n    const pressureResponseCurve = brushPressureResponseCurveV1(selected.preset);\n    pressureCurveEditor?.setCurve(pressureResponseCurve);\n    tipShape.value",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    "    const pressureFlowLabel = pressureFlowEnabled ? ' · P→Flow' : '';\n    propertyStatus.textContent = `${parameters.sizePx.toFixed(1)} px · ${Math.round(parameters.opacity * 100)}% · ${Math.round(parameters.flow * 100)}% · H${Math.round(hardness * 100)}% · D${Math.round(tipDensity * 100)}% · S${Math.round(spacing.spacingRatio * 100)}% · A${Math.round(tipAngleDegrees)}° · F${Math.round(tipDirectionDegrees)}°${followRotation ? ' · Follow' : ''}${repeatLabel}${startLabel}${endLabel}${sizeTaperLabel}${opacityTaperLabel}${forcedTaperLabel}${stabilizationLabel}${postCorrectionLabel}${grainLabel}${paperLabel}${textureStrengthLabel}${textureScaleLabel}${textureRotationLabel}${textureBlendLabel}${pressureSizeLabel}${pressureOpacityLabel}${pressureFlowLabel}`;",
    "    const pressureFlowLabel = pressureFlowEnabled ? ' · P→Flow' : '';\n    const pressureCurveLabel = responseCurveIsLinearV1(pressureResponseCurve) ? '' : ' · P-Curve';\n    propertyStatus.textContent = `${parameters.sizePx.toFixed(1)} px · ${Math.round(parameters.opacity * 100)}% · ${Math.round(parameters.flow * 100)}% · H${Math.round(hardness * 100)}% · D${Math.round(tipDensity * 100)}% · S${Math.round(spacing.spacingRatio * 100)}% · A${Math.round(tipAngleDegrees)}° · F${Math.round(tipDirectionDegrees)}°${followRotation ? ' · Follow' : ''}${repeatLabel}${startLabel}${endLabel}${sizeTaperLabel}${opacityTaperLabel}${forcedTaperLabel}${stabilizationLabel}${postCorrectionLabel}${grainLabel}${paperLabel}${textureStrengthLabel}${textureScaleLabel}${textureRotationLabel}${textureBlendLabel}${pressureSizeLabel}${pressureOpacityLabel}${pressureFlowLabel}${pressureCurveLabel}`;",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    '    tipAssetSelect.disabled = locked || tipAssets.length === 0;',
    '    pressureCurveEditor?.setDisabled(locked);\n    tipAssetSelect.disabled = locked || tipAssets.length === 0;',
)
replace_once(
    'src/app/brush-preset-controller.ts',
    "  const mutate = (operation: () => BrushPresetLibraryStateV1): void => {\n    try {\n      state = operation();\n      persist();\n      applySelected();\n      status.textContent = '';\n      render();\n    } catch (error) {\n      status.textContent = error instanceof Error ? error.message : '操作に失敗しました';\n    }\n  };",
    "  const mutate = (operation: () => BrushPresetLibraryStateV1): void => {\n    try {\n      state = operation();\n      persist();\n      applySelected();\n      status.textContent = '';\n      render();\n    } catch (error) {\n      status.textContent = error instanceof Error ? error.message : '操作に失敗しました';\n    }\n  };\n\n  pressureCurveEditor = installSharedCurveEditorV1({\n    elements: {\n      canvas: pressureCurveCanvas,\n      preset: pressureCurvePreset,\n      inputNumber: pressureCurveInput,\n      outputNumber: pressureCurveOutput,\n      deleteButton: pressureCurveDelete,\n      resetButton: pressureCurveReset,\n    },\n    initialCurve: brushPressureResponseCurveV1(selectedBrushPresetItemV1(state).preset),\n    onChange: (curve) =>\n      mutate(() => updateBrushPresetPressureResponseCurveV1(state, state.selectedPresetId, curve)),\n  });",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    "      pressureFlowButton.removeEventListener('click', onPressureFlow);\n      tipShape.removeEventListener",
    "      pressureFlowButton.removeEventListener('click', onPressureFlow);\n      pressureCurveEditor?.dispose();\n      pressureCurveEditor = null;\n      tipShape.removeEventListener",
)

# Reachable shared Curve Editor UI with direct points, exact selected values and reusable presets.
replace_once(
    'src/index.html',
    '              <div class="shell-brush-property-row shell-brush-tip-property-row">\n                <label for="brush-pressure-flow">筆圧→流量</label>\n                <button id="brush-pressure-flow" type="button" aria-pressed="false" title="ペン筆圧をブラシ流量へ反映">OFF</button>\n                <span class="shell-brush-tip-kind">Pressure</span>\n              </div>\n              <div class="shell-brush-property-row shell-brush-tip-property-row">\n                <label for="brush-tip-shape">ブラシ形状</label>',
    '              <div class="shell-brush-property-row shell-brush-tip-property-row">\n                <label for="brush-pressure-flow">筆圧→流量</label>\n                <button id="brush-pressure-flow" type="button" aria-pressed="false" title="ペン筆圧をブラシ流量へ反映">OFF</button>\n                <span class="shell-brush-tip-kind">Pressure</span>\n              </div>\n              <div class="shell-brush-pressure-curve-editor" aria-label="筆圧レスポンスカーブ">\n                <div class="shell-brush-pressure-curve-header">\n                  <label for="brush-pressure-curve-preset">筆圧カーブ</label>\n                  <select id="brush-pressure-curve-preset" aria-label="筆圧カーブプリセット">\n                    <option value="linear">Linear</option>\n                    <option value="soft">Soft</option>\n                    <option value="hard">Hard</option>\n                    <option value="s-curve">S Curve</option>\n                    <option value="custom">Custom</option>\n                  </select>\n                </div>\n                <canvas id="brush-pressure-curve" width="240" height="128" tabindex="0" aria-label="筆圧レスポンスカーブ。空いている場所をタップして点を追加、点をドラッグして編集"></canvas>\n                <div class="shell-brush-pressure-curve-values">\n                  <label>入力 <input id="brush-pressure-curve-input" type="number" inputmode="decimal" min="0" max="100" step="0.1" value="0" /><span>%</span></label>\n                  <label>出力 <input id="brush-pressure-curve-output" type="number" inputmode="decimal" min="0" max="100" step="0.1" value="0" /><span>%</span></label>\n                  <button id="brush-pressure-curve-delete" type="button">点を削除</button>\n                  <button id="brush-pressure-curve-reset" type="button">Reset</button>\n                </div>\n              </div>\n              <div class="shell-brush-property-row shell-brush-tip-property-row">\n                <label for="brush-tip-shape">ブラシ形状</label>',
)

append_once(
    'public/app-shell.css',
    '/* M6A shared pressure response Curve Editor */',
    r'''/* M6A shared pressure response Curve Editor */
.shell-brush-pressure-curve-editor {
  display: grid;
  gap: 7px;
  padding: 8px;
  border: 1px solid #e2e7ef;
  border-radius: 9px;
  background: #fbfcff;
}

.shell-brush-pressure-curve-header {
  display: grid;
  grid-template-columns: minmax(72px, auto) minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  color: #1f2e46;
  font-size: 11px;
}

.shell-brush-pressure-curve-header select,
.shell-brush-pressure-curve-values input,
.shell-brush-pressure-curve-values button {
  min-width: 0;
  min-height: 34px;
  border: 1px solid #dfe5ef;
  border-radius: 8px;
  background: #fff;
  color: #38445d;
  font: inherit;
  font-size: 10px;
}

#brush-pressure-curve {
  display: block;
  width: 100%;
  height: auto;
  aspect-ratio: 15 / 8;
  border: 1px solid #dfe5ef;
  border-radius: 8px;
  background: #fff;
  touch-action: none;
  cursor: crosshair;
}

#brush-pressure-curve:focus-visible {
  outline: 2px solid #60a5fa;
  outline-offset: 2px;
}

.shell-brush-pressure-curve-values {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 5px;
}

.shell-brush-pressure-curve-values label {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 4px;
  color: #718096;
  font-size: 9px;
  font-weight: 700;
}

.shell-brush-pressure-curve-values input {
  width: 100%;
  padding: 0 5px;
}

.shell-brush-pressure-curve-values button {
  padding: 0 7px;
  cursor: pointer;
}

.shell-brush-pressure-curve-editor :disabled {
  cursor: default;
  opacity: 0.46;
}
''',
)

# Pure curve and brush integration regression coverage.
Path('tests/unit/response-curve.test.ts').write_text(r'''import { describe, expect, it } from 'vitest';
import {
  LINEAR_RESPONSE_CURVE_V1,
  compileResponseCurveV1,
  normalizeResponseCurveV1,
  responseCurvePresetV1,
} from '../../src/domain/response-curve.js';

describe('shared response curve', () => {
  it('keeps the canonical linear curve as exact identity', () => {
    const compiled = compileResponseCurveV1(LINEAR_RESPONSE_CURVE_V1);
    for (const value of [0, 0.1, 0.25, 0.5, 0.8, 1]) {
      expect(compiled.sample(value)).toBeCloseTo(value, 10);
    }
  });

  it('offers monotonic soft, hard and S presets with exact endpoints', () => {
    const soft = compileResponseCurveV1(responseCurvePresetV1('soft'));
    const hard = compileResponseCurveV1(responseCurvePresetV1('hard'));
    const sCurve = compileResponseCurveV1(responseCurvePresetV1('s-curve'));
    expect(soft.sample(0.35)).toBeCloseTo(0.6, 10);
    expect(hard.sample(0.65)).toBeCloseTo(0.35, 10);
    expect(sCurve.sample(0)).toBe(0);
    expect(sCurve.sample(1)).toBe(1);
    let previous = 0;
    for (let step = 1; step <= 100; step += 1) {
      const value = sCurve.sample(step / 100);
      expect(value).toBeGreaterThanOrEqual(previous - 1e-10);
      previous = value;
    }
  });

  it('rejects curves that break fixed endpoints, input order or monotonic output', () => {
    expect(() => normalizeResponseCurveV1([{ input: 0, output: 0.1 }, { input: 1, output: 1 }])).toThrow();
    expect(() => normalizeResponseCurveV1([{ input: 0, output: 0 }, { input: 0, output: 0.5 }, { input: 1, output: 1 }])).toThrow();
    expect(() => normalizeResponseCurveV1([{ input: 0, output: 0 }, { input: 0.5, output: 0.8 }, { input: 1, output: 0.7 }])).toThrow();
  });
});
''')

Path('tests/unit/brush-pressure-response-curve.test.ts').write_text(r'''import { describe, expect, it } from 'vitest';
import {
  brushPressureResponseCurveV1,
  createBaselineBrushPresetV1,
  withBrushPressureResponseCurveV1,
} from '../../src/domain/brush-schema.js';
import { LINEAR_RESPONSE_CURVE_V1 } from '../../src/domain/response-curve.js';
import { BaselineBrushDabBuilderV1 } from '../../src/gpu/baseline-brush.js';
import { CanonicalRasterBrushStrokeV1 } from '../../src/app/canonical-raster-brush.js';
import { PaintSessionControllerV1 } from '../../src/app/paint-session-controller.js';

class FakeRendererDocumentPort {
  async configureDocument(): Promise<void> {}
  async restoreBaselineStrokes(): Promise<void> {}
  async applyBaselineTilePatches(): Promise<void> {}
}

const CUSTOM_CURVE = Object.freeze([
  Object.freeze({ input: 0, output: 0 }),
  Object.freeze({ input: 0.5, output: 0.8 }),
  Object.freeze({ input: 1, output: 1 }),
]);

describe('M6A-044 pressure response curve', () => {
  it('uses linear identity by default and persists only non-linear preset data', () => {
    const preset = createBaselineBrushPresetV1({
      id: 'pressure.curve',
      name: 'Pressure Curve',
      category: 'Test',
      behavior: 'paint',
    });
    expect(brushPressureResponseCurveV1(preset)).toEqual(LINEAR_RESPONSE_CURVE_V1);
    const custom = withBrushPressureResponseCurveV1(preset, CUSTOM_CURVE);
    expect(brushPressureResponseCurveV1(custom)).toEqual(CUSTOM_CURVE);
    expect(custom.dynamics.pressureResponseCurve).toBeDefined();
    expect(withBrushPressureResponseCurveV1(custom, LINEAR_RESPONSE_CURVE_V1).dynamics.pressureResponseCurve).toBeUndefined();
  });

  it('resolves one shared curve output before independent size, opacity and flow mappings', () => {
    const builder = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      opacity: 0.75,
      flow: 0.5,
      pressureSizeEnabled: true,
      pressureOpacityEnabled: true,
      pressureFlowEnabled: true,
      pressureResponseCurve: CUSTOM_CURVE,
    });
    const [dab] = builder.beginDelta({ documentX: 2, documentY: 2, pressure: 0.5 });
    expect(dab?.radius).toBeCloseTo(8, 10);
    expect(dab?.strokeOpacity).toBeCloseTo(0.6, 10);
    expect(dab?.flow).toBeCloseTo(0.4, 10);
  });

  it('does not change painting when pressure mappings are disabled', () => {
    const builder = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      opacity: 0.75,
      flow: 0.5,
      pressureResponseCurve: CUSTOM_CURVE,
    });
    const [dab] = builder.beginDelta({ documentX: 2, documentY: 2, pressure: 0.5 });
    expect(dab?.radius).toBe(10);
    expect(dab?.strokeOpacity).toBe(0.75);
    expect(dab?.flow).toBe(0.5);
  });

  it('forwards the curve through canonical/runtime state without a new primitive schema', () => {
    const stroke = new CanonicalRasterBrushStrokeV1({
      sizePx: 20,
      pressureSizeEnabled: true,
      pressureResponseCurve: CUSTOM_CURVE,
    });
    const [dab] = stroke.beginConfirmed({ documentX: 1, documentY: 1, pressure: 0.5 });
    expect(dab?.radius).toBeCloseTo(8, 10);

    const session = new PaintSessionControllerV1(new FakeRendererDocumentPort());
    expect(session.setBrushPressureResponseCurve(CUSTOM_CURVE)).toEqual(CUSTOM_CURVE);
    expect(session.snapshot().brushPressureResponseCurve).toEqual(CUSTOM_CURVE);
  });
});
''')

replace_once(
    'IMPLEMENTATION_PROGRESS.md',
    'M6A-044 pressure response curve:未完了\nM6A-045 tilt mapping:未完了',
    'M6A-044 pressure response curve:完了\n再開メモ: M6A-044 pressure response curveはIP-12 Shared Curve Editor契約に従い、0→0 / 1→1固定・input昇順・output単調の2..16 node canonical curveを追加した。runtime評価はmonotone PCHIP/Fritsch-Carlson-style補間をstroke開始時にcompileし、logical stampごとに補間済みraw pressureをcurveへ1回だけ通して、その同一responseをM6A-041 size / 042 opacity / 043 flowの各opt-in mappingへ配る。linearはexact identity/defaultでpreset fieldを省略する。Tool Propertiesには共有Curve Editorを接続し、canvas上tapでnode追加、drag編集、選択nodeの正確な入出力%、Delete、Reset、Linear/Soft/Hard/S presetsを提供する。Mouseはneutral 1.0のまま。M6A-049/050のminimum/maximum responseは未適用で、forced taper zero endpointは引き続き優先する。次はM6A-045 tilt mappingから再開する。\nM6A-045 tilt mapping:未完了',
)
append_once(
    'ILLUSTRO_DESIGN_MEMO.md',
    '## M6A pressure-response-curve boundary — 2026-09-03',
    r'''## M6A pressure-response-curve boundary — 2026-09-03

- M6A-044 implements pressure response through the IP-12 Shared Curve Editor contract rather than inventing a pressure-only nonlinear slider. The reusable canonical curve uses 2..16 direct-edit nodes, fixed `0→0` / `1→1` endpoints, strictly increasing input and monotonic output.
- The canonical default is exact linear identity and is omitted from stored brush preset JSON. Useful Linear / Soft / Hard / S Curve families are available as editor presets; direct canvas tap adds a node, drag edits it, selected-node input/output percentages provide the exact numeric path, Delete removes eligible interior nodes and Reset restores linear.
- Runtime evaluation uses a monotone PCHIP/Fritsch-Carlson-style cubic compiled once at stroke construction. The interpolated raw Pen pressure is evaluated once per logical stamp and the same resolved response is then supplied independently to size, opacity-cap and flow mappings. Curves therefore do not fork the stamp path or add renderer/history schema.
- If no pressure mapping is enabled, a non-linear stored curve has no raster effect. Mouse remains neutral response `1.0` because it has no stylus-pressure semantics.
- M6A-049/050 still own minimum/maximum response bounds and are not encoded into the curve here. Later bounds must compose with this shared response rather than rewriting curve nodes. M6A-032 forced taper zero endpoints remain authoritative.
''',
)

replace_once(
    'scripts/verify-m6a-brush.mjs',
    "requireText(\n  progress,\n  'M6A-PERF-001 incremental active-stroke rendering（stable prefix + bounded mutable tail）:未完了',",
    "requireText(progress, 'M6A-044 pressure response curve:完了', 'M6A-044 progress is not complete');\nrequireText(\n  read('src/domain/response-curve.ts'),\n  'compileResponseCurveV1',\n  'shared response-curve evaluator missing',\n);\nrequireText(\n  read('src/domain/response-curve.ts'),\n  'response curve endpoints must be exactly 0→0 and 1→1',\n  'pressure curve endpoint contract missing',\n);\nrequireText(\n  read('src/domain/brush-schema.ts'),\n  'brushPressureResponseCurveV1',\n  'pressure response curve is not persisted in brush presets',\n);\nrequireText(\n  read('src/gpu/baseline-brush.ts'),\n  'const pressureResponse = usesPressure ? this.#pressureResponseCurve.sample(stamp.pressure) : 1;',\n  'shared pressure response is not resolved once before mappings',\n);\nrequireText(\n  read('src/app/shared-curve-editor.ts'),\n  'installSharedCurveEditorV1',\n  'shared Curve Editor implementation missing',\n);\nrequireText(\n  read('src/index.html'),\n  'id=\"brush-pressure-curve\"',\n  'reachable pressure Curve Editor canvas missing',\n);\nrequireText(\n  read('src/index.html'),\n  'id=\"brush-pressure-curve-input\"',\n  'exact selected pressure-curve input control missing',\n);\nrequireText(\n  read('tests/unit/brush-pressure-response-curve.test.ts'),\n  'resolves one shared curve output before independent size, opacity and flow mappings',\n  'pressure response mapping regression missing',\n);\n\nrequireText(\n  progress,\n  'M6A-PERF-001 incremental active-stroke rendering（stable prefix + bounded mutable tail）:未完了',",
)
