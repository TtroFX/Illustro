import { BRUSH_V1_SCHEMA } from '../domain/brush-schema.js';
import {
  createCompatibilityReport,
  createStructuredReportIssue,
  type StructuredCompatibilityReportV1,
  type StructuredReportIssueV1,
} from '../domain/reports.js';
import type { JsonValue } from '../domain/serialization.js';
import type { CspBrushMapResultV1 } from './csp-brush-mapper-v1.js';
import type { CspSutParsedV1, CspSutSqlValueV1 } from './csp-sut-parser-v1.js';
import type { IbisBrushMapResultV1 } from './ibis-brush-mapper-v1.js';
import type { IbisBrushPayloadV1 } from './ibis-brush-parser-v1.js';

export const BRUSH_IMPORT_PROPERTY_REPORT_SCHEMA_V1 =
  'illustro.brush-import-property-report/1' as const;

export interface BrushImportPropertyReportV1 {
  readonly schema: typeof BRUSH_IMPORT_PROPERTY_REPORT_SCHEMA_V1;
  readonly sourceFamily: 'ibisPaint-IPBZ' | 'CLIP-STUDIO-PAINT-SUT';
  readonly sourceVersion: string | null;
  readonly targetSchema: typeof BRUSH_V1_SCHEMA;
  readonly mappedFields: readonly string[];
  readonly ignoredFields: readonly string[];
  readonly compatibility: StructuredCompatibilityReportV1;
}

const CSP_STRUCTURAL_VARIANT_FIELDS_V1 = new Set(['VariantId', '_PW_ID']);

function freezeStringsV1(values: Iterable<string>): readonly string[] {
  return Object.freeze([...values]);
}

function summarizeSqlValueV1(value: CspSutSqlValueV1): JsonValue {
  if (value instanceof Uint8Array) {
    return Object.freeze({ kind: 'blob', byteLength: value.byteLength });
  }
  if (typeof value === 'number' && !Number.isFinite(value)) {
    return Object.freeze({ kind: 'non-finite-number' });
  }
  return value;
}

function mappedCspIssueV1(field: string, result: CspBrushMapResultV1): StructuredReportIssueV1 {
  if (field === 'Node.NodeName') {
    return createStructuredReportIssue({
      code: 'BrushImport.Csp.Name.Mapped',
      severity: 'info',
      sourcePath: field,
      sourceFeature: 'brush name',
      mapping: 'exact',
      resultingPath: 'brush.name',
      messageKey: 'BrushImport.Property.Exact',
    });
  }
  if (field === 'Variant.BrushSize') {
    const exact = result.sizeMapping === 'exact';
    return createStructuredReportIssue({
      code: 'BrushImport.Csp.Size.Mapped',
      severity: exact ? 'info' : 'warning',
      sourcePath: field,
      sourceFeature: 'brush size',
      mapping: exact ? 'exact' : 'converted',
      resultingPath: 'brush.defaultSizePx',
      messageKey: exact ? 'BrushImport.Property.Exact' : 'BrushImport.Property.Converted',
      details: { sourceBrushSizePx: result.observed.sourceBrushSizePx },
    });
  }
  if (field === 'Variant.BrushInterval') {
    return createStructuredReportIssue({
      code: 'BrushImport.Csp.Spacing.Mapped',
      severity: result.spacingMapping === 'clamped-ratio' ? 'warning' : 'info',
      sourcePath: field,
      sourceFeature: 'brush interval',
      mapping: 'converted',
      resultingPath: 'brush.stroke.spacingRatio',
      messageKey: 'BrushImport.Property.Converted',
      details: {
        sourceBrushIntervalPx: result.observed.sourceBrushIntervalPx,
        conversion: 'sourceIntervalPx/sourceBrushSizePx',
        clamped: result.spacingMapping === 'clamped-ratio',
      },
    });
  }
  throw new TypeError(`unrecognized mapped CSP field: ${field}`);
}

function ignoredCspFieldsV1(
  parsed: CspSutParsedV1,
  mappedFields: ReadonlySet<string>,
): readonly string[] {
  const fields = Object.keys(parsed.variant)
    .filter((key) => !CSP_STRUCTURAL_VARIANT_FIELDS_V1.has(key))
    .map((key) => `Variant.${key}`)
    .filter((field) => !mappedFields.has(field));
  if (parsed.materials.some((row) => row.FileData instanceof Uint8Array)) {
    fields.push('MaterialFile.FileData');
  }
  return freezeStringsV1([...new Set(fields)].sort());
}

function ignoredCspIssueV1(parsed: CspSutParsedV1, field: string): StructuredReportIssueV1 {
  const key = field.startsWith('Variant.') ? field.slice('Variant.'.length) : null;
  const value = key === null ? null : (parsed.variant[key] ?? null);
  return createStructuredReportIssue({
    code:
      field === 'MaterialFile.FileData'
        ? 'BrushImport.Csp.Material.Ignored'
        : 'BrushImport.Csp.Property.Ignored',
    severity: 'lossy',
    sourcePath: field,
    sourceFeature:
      field === 'MaterialFile.FileData'
        ? 'embedded brush material'
        : `CSP property ${key ?? field}`,
    mapping: 'ignored',
    resultingPath: null,
    messageKey: 'BrushImport.Property.Unsupported',
    details:
      field === 'MaterialFile.FileData'
        ? {
            materialCount: parsed.materials.filter((row) => row.FileData instanceof Uint8Array)
              .length,
            sourcePayloadPreservedByParser: true,
          }
        : { sourceValue: summarizeSqlValueV1(value) },
  });
}

export function createCspBrushPropertyReportV1(input: {
  readonly parsed: CspSutParsedV1;
  readonly mapping: CspBrushMapResultV1;
}): BrushImportPropertyReportV1 {
  if (input.mapping.preset.provenance.sourceParserSchema !== input.parsed.schema) {
    throw new TypeError('CSP mapping/parser provenance mismatch');
  }
  const mappedFields = freezeStringsV1(input.mapping.mappedFields);
  const mappedSet = new Set(mappedFields);
  const ignoredFields = ignoredCspFieldsV1(input.parsed, mappedSet);
  const issues = [
    ...mappedFields.map((field) => mappedCspIssueV1(field, input.mapping)),
    ...ignoredFields.map((field) => ignoredCspIssueV1(input.parsed, field)),
  ];
  const compatibility = createCompatibilityReport({
    sourceFormat: 'CLIP-STUDIO-PAINT-SUT',
    sourceVersion: null,
    issues,
  });
  return Object.freeze({
    schema: BRUSH_IMPORT_PROPERTY_REPORT_SCHEMA_V1,
    sourceFamily: 'CLIP-STUDIO-PAINT-SUT',
    sourceVersion: null,
    targetSchema: BRUSH_V1_SCHEMA,
    mappedFields,
    ignoredFields,
    compatibility,
  });
}

function ibisMappedIssuesV1(mapping: IbisBrushMapResultV1): readonly StructuredReportIssueV1[] {
  return Object.freeze([
    createStructuredReportIssue({
      code: 'BrushImport.Ibis.Name.Mapped',
      severity: 'info',
      sourcePath: 'payload.name',
      sourceFeature: 'brush name',
      mapping: 'exact',
      resultingPath: 'brush.name',
      messageKey: 'BrushImport.Property.Exact',
    }),
    createStructuredReportIssue({
      code: 'BrushImport.Ibis.SizeRange.Mapped',
      severity: mapping.sizeRangeMapping === 'exact' ? 'info' : 'warning',
      sourcePath: 'payload.sizeRange',
      sourceFeature: 'brush size range',
      mapping: mapping.sizeRangeMapping === 'exact' ? 'exact' : 'converted',
      resultingPath: 'brush.extensions.parameterLimits.sizePx',
      messageKey:
        mapping.sizeRangeMapping === 'exact'
          ? 'BrushImport.Property.Exact'
          : 'BrushImport.Property.Converted',
      details: {
        sourceSizeMinPx: mapping.observed.sourceSizeMinPx,
        sourceSizeMaxPx: mapping.observed.sourceSizeMaxPx,
      },
    }),
  ]);
}

export function createIbisBrushPropertyReportV1(input: {
  readonly payload: IbisBrushPayloadV1;
  readonly mapping: IbisBrushMapResultV1;
}): BrushImportPropertyReportV1 {
  const mappedFields = freezeStringsV1(['payload.name', 'payload.sizeRange']);
  const opaqueByteLength =
    input.payload.parameterPrefix.byteLength +
    input.payload.postNamePayload.byteLength +
    input.payload.trailer.byteLength;
  const ignoredFields = freezeStringsV1(
    opaqueByteLength === 0 ? [] : ['payload.unmappedParameterBytes'],
  );
  const issues: StructuredReportIssueV1[] = [...ibisMappedIssuesV1(input.mapping)];
  if (opaqueByteLength > 0) {
    issues.push(
      createStructuredReportIssue({
        code: 'BrushImport.Ibis.Parameters.Ignored',
        severity: 'lossy',
        sourcePath: 'payload.unmappedParameterBytes',
        sourceFeature: 'unmapped ibisPaint brush parameters',
        mapping: 'ignored',
        resultingPath: null,
        messageKey: 'BrushImport.Property.Unsupported',
        details: {
          parameterPrefixByteLength: input.payload.parameterPrefix.byteLength,
          postNamePayloadByteLength: input.payload.postNamePayload.byteLength,
          trailerByteLength: input.payload.trailer.byteLength,
          opaqueByteLength,
          rawBytesIncludedInReport: false,
        },
      }),
    );
  }
  const sourceVersion = input.mapping.observed.carrierVersionHex;
  const compatibility = createCompatibilityReport({
    sourceFormat: 'ibisPaint-IPBZ',
    sourceVersion,
    issues,
  });
  return Object.freeze({
    schema: BRUSH_IMPORT_PROPERTY_REPORT_SCHEMA_V1,
    sourceFamily: 'ibisPaint-IPBZ',
    sourceVersion,
    targetSchema: BRUSH_V1_SCHEMA,
    mappedFields,
    ignoredFields,
    compatibility,
  });
}
