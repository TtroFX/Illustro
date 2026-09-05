import {
  createBaselineBrushPresetV1,
  normalizeBrushPresetV1,
  type BrushPresetV1,
} from '../domain/brush-schema.js';
import type { JsonValue } from '../domain/serialization.js';
import type { CspSutParsedV1, CspSutRowV1 } from './csp-sut-parser-v1.js';

export const CSP_BRUSH_MAPPER_SCHEMA_V1 = 'illustro.csp-brush-mapper/1' as const;
export const CSP_BRUSH_IMPORTED_CATEGORY_V1 = 'Imported / CLIP STUDIO PAINT' as const;

const TARGET_SIZE_MIN_PX_V1 = 1;
const TARGET_SIZE_MAX_PX_V1 = 4096;
const TARGET_DEFAULT_SIZE_PX_V1 = 16;
const TARGET_SPACING_MIN_RATIO_V1 = 0.01;
const TARGET_SPACING_MAX_RATIO_V1 = 4;
const SOURCE_BLOB_PREFIX_BYTES_V1 = 32;

export interface CspBrushObservedParametersV1 {
  readonly sourceBrushSizePx: number | null;
  readonly sourceBrushIntervalPx: number | null;
}

export interface CspBrushMapResultV1 {
  readonly schema: typeof CSP_BRUSH_MAPPER_SCHEMA_V1;
  readonly preset: BrushPresetV1;
  readonly observed: CspBrushObservedParametersV1;
  readonly sizeMapping: 'exact' | 'clamped' | 'unavailable';
  readonly spacingMapping: 'direct-ratio' | 'clamped-ratio' | 'unavailable';
  readonly mappedFields: readonly string[];
}

function bytesToHexV1(bytes: Uint8Array): string {
  return [...bytes].map((value) => value.toString(16).padStart(2, '0')).join('');
}

function summarizeSourceValueV1(value: string | number | Uint8Array | null): JsonValue {
  if (value instanceof Uint8Array) {
    const prefix = value.subarray(0, SOURCE_BLOB_PREFIX_BYTES_V1);
    return Object.freeze({
      kind: 'blob',
      byteLength: value.byteLength,
      prefixHex: bytesToHexV1(prefix),
      prefixByteLength: prefix.byteLength,
      truncated: value.byteLength > prefix.byteLength,
    });
  }
  if (typeof value === 'number' && !Number.isFinite(value)) {
    return Object.freeze({ kind: 'non-finite-number', value: String(value) });
  }
  return value;
}

function summarizeSourceRowV1(row: CspSutRowV1): Readonly<Record<string, JsonValue>> {
  return Object.freeze(
    Object.fromEntries(
      Object.keys(row)
        .sort()
        .map((key) => [key, summarizeSourceValueV1(row[key] ?? null)]),
    ),
  );
}

function materialColumnsV1(materials: readonly CspSutRowV1[]): readonly string[] {
  return Object.freeze([...new Set(materials.flatMap((row) => Object.keys(row)))].sort());
}

function optionalFiniteNumberV1(
  row: CspSutRowV1,
  key: string,
  minimum: number,
  minimumInclusive: boolean,
): number | null {
  const value = row[key];
  if (value === undefined || value === null) return null;
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    (minimumInclusive ? value < minimum : value <= minimum)
  ) {
    throw new RangeError(`invalid CSP ${key} value`);
  }
  return value;
}

function clampV1(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function mapCspBrushToIllustroV1(input: {
  readonly parsed: CspSutParsedV1;
  readonly presetId: string;
}): CspBrushMapResultV1 {
  const sourceBrushSizePx = optionalFiniteNumberV1(input.parsed.variant, 'BrushSize', 0, false);
  const sourceBrushIntervalPx = optionalFiniteNumberV1(
    input.parsed.variant,
    'BrushInterval',
    0,
    true,
  );

  const defaultSizePx =
    sourceBrushSizePx === null
      ? TARGET_DEFAULT_SIZE_PX_V1
      : clampV1(sourceBrushSizePx, TARGET_SIZE_MIN_PX_V1, TARGET_SIZE_MAX_PX_V1);
  const sizeMapping =
    sourceBrushSizePx === null
      ? 'unavailable'
      : defaultSizePx === sourceBrushSizePx
        ? 'exact'
        : 'clamped';

  let spacingRatio: number | null = null;
  let spacingMapping: CspBrushMapResultV1['spacingMapping'] = 'unavailable';
  if (sourceBrushIntervalPx !== null && sourceBrushSizePx !== null) {
    const rawSpacingRatio = sourceBrushIntervalPx / sourceBrushSizePx;
    spacingRatio = clampV1(
      rawSpacingRatio,
      TARGET_SPACING_MIN_RATIO_V1,
      TARGET_SPACING_MAX_RATIO_V1,
    );
    spacingMapping = spacingRatio === rawSpacingRatio ? 'direct-ratio' : 'clamped-ratio';
  }

  const baseline = createBaselineBrushPresetV1({
    id: input.presetId,
    name: input.parsed.nodeName,
    category: CSP_BRUSH_IMPORTED_CATEGORY_V1,
    behavior: 'paint',
    defaultSizePx,
  });

  const mappedFields = Object.freeze([
    'Node.NodeName',
    ...(sourceBrushSizePx === null ? [] : ['Variant.BrushSize']),
    ...(spacingRatio === null ? [] : ['Variant.BrushInterval']),
  ]);

  const preset = normalizeBrushPresetV1({
    ...baseline,
    stroke:
      spacingRatio === null
        ? baseline.stroke
        : {
            ...baseline.stroke,
            spacingRatio,
          },
    provenance: {
      ...baseline.provenance,
      sourceFormat: 'CLIP-STUDIO-PAINT-SUT',
      sourceParserSchema: input.parsed.schema,
      sourceVariantId: input.parsed.nodeVariantId,
      sourceInitVariantId: input.parsed.nodeInitVariantId,
    },
    importCompatibility: {
      ...baseline.importCompatibility,
      sourceName: 'exact',
      sourceDefaultSize: sizeMapping,
      sourceSpacing: spacingMapping,
      sourceBehavior: 'unmapped-default-paint',
      sourceParameters: 'partial-known-fields-only',
      mappedFields,
      unknownParameters: 'preserved-source-summary',
    },
    extensions: {
      ...baseline.extensions,
      clipStudioPaintSource: {
        parserSchema: input.parsed.schema,
        sourceByteLength: input.parsed.sourceByteLength,
        nodeVariantId: input.parsed.nodeVariantId,
        nodeInitVariantId: input.parsed.nodeInitVariantId,
        tables: input.parsed.tables,
        node: summarizeSourceRowV1(input.parsed.node),
        variant: summarizeSourceRowV1(input.parsed.variant),
        materialCount: input.parsed.materials.length,
        materialColumns: materialColumnsV1(input.parsed.materials),
      },
    },
  });

  return Object.freeze({
    schema: CSP_BRUSH_MAPPER_SCHEMA_V1,
    preset,
    observed: Object.freeze({ sourceBrushSizePx, sourceBrushIntervalPx }),
    sizeMapping,
    spacingMapping,
    mappedFields,
  });
}
