import { toJsonValue, type JsonValue } from './serialization.js';

export const BRUSH_V1_SCHEMA = 'illustro.brush/1' as const;
export const BRUSH_SCHEMA_VERSION = 1 as const;
export const ILLBRUSH_PACKAGE_VERSION = '1.0' as const;
export const ILLBRUSH_MIME_TYPE = 'application/x-illustro-brush+zip' as const;

export type BrushSchemaIdentifier = typeof BRUSH_V1_SCHEMA;
export type BrushSchemaVersion = typeof BRUSH_SCHEMA_VERSION;
export type BrushBehaviorV1 = 'paint' | 'erase' | 'smudge' | 'blur';
export type BrushPresetSectionV1 = Readonly<Record<string, JsonValue>>;

export interface BrushParameterRangeV1 {
  readonly min: number;
  readonly max: number;
}

export interface BrushParameterLimitsV1 {
  readonly sizePx: BrushParameterRangeV1;
  readonly opacity: BrushParameterRangeV1;
  readonly flow: BrushParameterRangeV1;
}

export interface BrushParameterValuesV1 {
  readonly sizePx: number;
  readonly opacity: number;
  readonly flow: number;
}

export const DEFAULT_BRUSH_PARAMETER_LIMITS_V1: BrushParameterLimitsV1 = Object.freeze({
  sizePx: Object.freeze({ min: 1, max: 4096 }),
  opacity: Object.freeze({ min: 0.01, max: 1 }),
  flow: Object.freeze({ min: 0.01, max: 1 }),
});

export const DEFAULT_BRUSH_PARAMETER_VALUES_V1: BrushParameterValuesV1 = Object.freeze({
  sizePx: 16,
  opacity: 1,
  flow: 1,
});

function jsonRecord(value: JsonValue | undefined): Readonly<Record<string, JsonValue>> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Readonly<Record<string, JsonValue>>)
    : null;
}

function finiteRange(
  value: JsonValue | undefined,
  fallback: BrushParameterRangeV1,
  absoluteMin: number,
  absoluteMax: number,
): BrushParameterRangeV1 {
  const record = jsonRecord(value);
  const rawMin = record?.min;
  const rawMax = record?.max;
  if (
    typeof rawMin !== 'number' ||
    typeof rawMax !== 'number' ||
    !Number.isFinite(rawMin) ||
    !Number.isFinite(rawMax)
  ) {
    return fallback;
  }
  const min = Math.max(absoluteMin, Math.min(absoluteMax, rawMin));
  const max = Math.max(absoluteMin, Math.min(absoluteMax, rawMax));
  if (max < min) return fallback;
  return Object.freeze({ min, max });
}

export function brushParameterLimitsV1(preset: BrushPresetV1): BrushParameterLimitsV1 {
  const limits = jsonRecord(preset.extensions.parameterLimits);
  return Object.freeze({
    sizePx: finiteRange(limits?.sizePx, DEFAULT_BRUSH_PARAMETER_LIMITS_V1.sizePx, 1, 4096),
    opacity: finiteRange(limits?.opacity, DEFAULT_BRUSH_PARAMETER_LIMITS_V1.opacity, 0.01, 1),
    flow: finiteRange(limits?.flow, DEFAULT_BRUSH_PARAMETER_LIMITS_V1.flow, 0.01, 1),
  });
}

function clampToRange(value: number, range: BrushParameterRangeV1): number {
  return Math.min(range.max, Math.max(range.min, value));
}

function numericSectionValue(section: BrushPresetSectionV1, key: string, fallback: number): number {
  const value = section[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function brushParameterValuesV1(preset: BrushPresetV1): BrushParameterValuesV1 {
  const limits = brushParameterLimitsV1(preset);
  return Object.freeze({
    sizePx: clampToRange(preset.defaultSizePx, limits.sizePx),
    opacity: clampToRange(numericSectionValue(preset.ink, 'opacity', 1), limits.opacity),
    flow: clampToRange(numericSectionValue(preset.ink, 'flow', 1), limits.flow),
  });
}

export function withBrushParameterValuesV1(
  preset: BrushPresetV1,
  patch: Partial<BrushParameterValuesV1>,
): BrushPresetV1 {
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined && (typeof value !== 'number' || !Number.isFinite(value))) {
      throw new TypeError(`brush ${key} must be finite`);
    }
  }
  const limits = brushParameterLimitsV1(preset);
  const current = brushParameterValuesV1(preset);
  const sizePx = clampToRange(patch.sizePx ?? current.sizePx, limits.sizePx);
  const opacity = clampToRange(patch.opacity ?? current.opacity, limits.opacity);
  const flow = clampToRange(patch.flow ?? current.flow, limits.flow);
  return normalizeBrushPresetV1({
    ...preset,
    defaultSizePx: sizePx,
    ink: { ...preset.ink, opacity, flow },
  });
}

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
  const record = json as { readonly [key: string]: JsonValue };
  return Object.freeze({ ...record });
}

export function normalizeBrushPresetV1(input: BrushPresetV1): BrushPresetV1 {
  if (input.schema !== BRUSH_V1_SCHEMA) throw new TypeError('unsupported brush schema');
  if (!Number.isSafeInteger(input.revision) || input.revision < 1) {
    throw new RangeError('brush revision must be a positive safe integer');
  }
  if (
    !Number.isFinite(input.defaultSizePx) ||
    input.defaultSizePx <= 0 ||
    input.defaultSizePx > 4096
  ) {
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
    extensions: {
      parameterLimits: {
        sizePx: { min: 1, max: 4096 },
        opacity: { min: 0.01, max: 1 },
        flow: { min: 0.01, max: 1 },
      },
    },
  });
}
