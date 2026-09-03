export const RESPONSE_CURVE_MAX_POINTS_V1 = 16 as const;

export interface ResponseCurvePointV1 {
  readonly input: number;
  readonly output: number;
}

export type ResponseCurvePresetIdV1 = 'linear' | 'soft' | 'hard' | 's-curve';

function point(input: number, output: number): ResponseCurvePointV1 {
  return Object.freeze({ input, output });
}

export const LINEAR_RESPONSE_CURVE_V1 = Object.freeze([point(0, 0), point(1, 1)]);

const SOFT_RESPONSE_CURVE_V1 = Object.freeze([point(0, 0), point(0.35, 0.6), point(1, 1)]);
const HARD_RESPONSE_CURVE_V1 = Object.freeze([point(0, 0), point(0.65, 0.35), point(1, 1)]);
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
  return (
    RESPONSE_CURVE_PRESETS_V1.find((preset) => preset.id === presetId)?.points ??
    LINEAR_RESPONSE_CURVE_V1
  );
}

export function responseCurvePresetIdV1(
  curve: readonly ResponseCurvePointV1[],
): ResponseCurvePresetIdV1 | null {
  const normalized = normalizeResponseCurveV1(curve);
  return (
    RESPONSE_CURVE_PRESETS_V1.find((preset) => responseCurveEqualsV1(preset.points, normalized))
      ?.id ?? null
  );
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
