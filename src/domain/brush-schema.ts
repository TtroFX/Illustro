import { toJsonValue, type JsonValue } from './serialization.js';

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
    extensions: {},
  });
}
