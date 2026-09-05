import {
  BRUSH_V1_SCHEMA,
  normalizeBrushPresetV1,
  type BrushPresetV1,
} from '../domain/brush-schema.js';
import {
  createCspBrushPropertyReportV1,
  createIbisBrushPropertyReportV1,
  type BrushImportPropertyReportV1,
} from './brush-import-property-report-v1.js';
import { mapCspBrushToIllustroV1 } from './csp-brush-mapper-v1.js';
import type { CspSutParsedV1 } from './csp-sut-parser-v1.js';
import { mapIbisBrushToIllustroV1 } from './ibis-brush-mapper-v1.js';
import type { IbisBrushPayloadV1 } from './ibis-brush-parser-v1.js';

export const IMPORTED_BRUSH_STAGE_SCHEMA_V1 = 'illustro.imported-brush-stage/1' as const;
export const IMPORTED_BRUSH_COMMIT_SCHEMA_V1 = 'illustro.imported-brush-commit/1' as const;

export type ImportedBrushSourceFamilyV1 = BrushImportPropertyReportV1['sourceFamily'];

export interface ImportedBrushStageV1 {
  readonly schema: typeof IMPORTED_BRUSH_STAGE_SCHEMA_V1;
  readonly sourceFamily: ImportedBrushSourceFamilyV1;
  readonly mappedPreset: BrushPresetV1;
  readonly report: BrushImportPropertyReportV1;
}

export interface ImportedBrushCommitV1 {
  readonly schema: typeof IMPORTED_BRUSH_COMMIT_SCHEMA_V1;
  readonly preset: BrushPresetV1;
  readonly report: BrushImportPropertyReportV1;
  readonly acceptedLossyMapping: boolean;
}

export class ImportedBrushAcceptanceRequiredErrorV1 extends Error {
  readonly report: BrushImportPropertyReportV1;

  constructor(report: BrushImportPropertyReportV1) {
    super('imported brush requires explicit acceptance of unsupported properties');
    this.name = 'ImportedBrushAcceptanceRequiredErrorV1';
    this.report = report;
  }
}

function checkedPresetIdV1(value: string): string {
  const normalized = value.trim();
  if (normalized.length < 1 || normalized.length > 160) {
    throw new RangeError('imported brush preset id must contain 1..160 characters');
  }
  return normalized;
}

function stageV1(input: {
  readonly sourceFamily: ImportedBrushSourceFamilyV1;
  readonly mappedPreset: BrushPresetV1;
  readonly report: BrushImportPropertyReportV1;
}): ImportedBrushStageV1 {
  if (input.report.sourceFamily !== input.sourceFamily) {
    throw new TypeError('imported brush source/report family mismatch');
  }
  if (input.report.compatibility.sourceFormat !== input.sourceFamily) {
    throw new TypeError('imported brush compatibility source format mismatch');
  }
  if (input.report.targetSchema !== BRUSH_V1_SCHEMA) {
    throw new TypeError('imported brush compatibility target schema mismatch');
  }
  return Object.freeze({
    schema: IMPORTED_BRUSH_STAGE_SCHEMA_V1,
    sourceFamily: input.sourceFamily,
    mappedPreset: normalizeBrushPresetV1(input.mappedPreset),
    report: input.report,
  });
}

export function stageCspBrushImportV1(input: {
  readonly parsed: CspSutParsedV1;
  readonly presetId: string;
}): ImportedBrushStageV1 {
  const mapping = mapCspBrushToIllustroV1({
    parsed: input.parsed,
    presetId: checkedPresetIdV1(input.presetId),
  });
  return stageV1({
    sourceFamily: 'CLIP-STUDIO-PAINT-SUT',
    mappedPreset: mapping.preset,
    report: createCspBrushPropertyReportV1({ parsed: input.parsed, mapping }),
  });
}

export function stageIbisBrushImportV1(input: {
  readonly payload: IbisBrushPayloadV1;
  readonly presetId: string;
}): ImportedBrushStageV1 {
  const mapping = mapIbisBrushToIllustroV1({
    payload: input.payload,
    presetId: checkedPresetIdV1(input.presetId),
  });
  return stageV1({
    sourceFamily: 'ibisPaint-IPBZ',
    mappedPreset: mapping.preset,
    report: createIbisBrushPropertyReportV1({ payload: input.payload, mapping }),
  });
}

function validateStageAtCommitV1(stage: ImportedBrushStageV1): void {
  if (stage.schema !== IMPORTED_BRUSH_STAGE_SCHEMA_V1) {
    throw new TypeError('unsupported imported brush stage schema');
  }
  if (stage.report.schema !== 'illustro.brush-import-property-report/1') {
    throw new TypeError('unsupported imported brush property report schema');
  }
  if (stage.report.sourceFamily !== stage.sourceFamily) {
    throw new TypeError('imported brush source/report family mismatch');
  }
  if (stage.report.compatibility.sourceFormat !== stage.sourceFamily) {
    throw new TypeError('imported brush compatibility source format mismatch');
  }
  if (stage.report.targetSchema !== BRUSH_V1_SCHEMA) {
    throw new TypeError('imported brush compatibility target schema mismatch');
  }
  if (!stage.report.compatibility.writable) {
    throw new TypeError('imported brush compatibility report rejects canonical commit');
  }
}

export function commitImportedBrushStageV1(input: {
  readonly stage: ImportedBrushStageV1;
  readonly acceptLossyMapping?: boolean;
}): ImportedBrushCommitV1 {
  validateStageAtCommitV1(input.stage);
  const requiresAcceptance = input.stage.report.compatibility.requiresUserAcceptance;
  const acceptedLossyMapping = requiresAcceptance && input.acceptLossyMapping === true;
  if (requiresAcceptance && !acceptedLossyMapping) {
    throw new ImportedBrushAcceptanceRequiredErrorV1(input.stage.report);
  }

  // Canonicalization is intentionally repeated at the commit boundary. Source-format
  // staging objects are never handed directly to the library or renderer.
  const preset = normalizeBrushPresetV1(input.stage.mappedPreset);
  if (preset.schema !== BRUSH_V1_SCHEMA) {
    throw new TypeError('imported brush did not normalize to the canonical brush schema');
  }

  return Object.freeze({
    schema: IMPORTED_BRUSH_COMMIT_SCHEMA_V1,
    preset,
    report: input.stage.report,
    acceptedLossyMapping,
  });
}
