import type { BrushPresetV1 } from '../domain/brush-schema.js';
import type { BrushImportPropertyReportV1 } from '../interchange/brush-import-property-report-v1.js';
import { parseCspSutV1 } from '../interchange/csp-sut-parser-v1.js';
import { decodeIbisBrushQrBlobV1 } from '../interchange/ibis-qr-carrier-v1.js';
import { parseIbisBrushPayloadV1 } from '../interchange/ibis-brush-parser-v1.js';
import {
  commitImportedBrushStageV1,
  stageCspBrushImportV1,
  stageIbisBrushImportV1,
  type ImportedBrushStageV1,
} from '../interchange/imported-brush-normalizer-v1.js';
import {
  parseIllbrushPackageV1,
  writeIllbrushPackageV1,
  type IllbrushPackageV1,
} from '../interchange/illbrush-v1.js';
import type { BrushPackageAttachmentStoreV1 } from './brush-package-attachment-store.js';
import type { BrushPresetLibraryStateV1 } from './brush-preset-library.js';

export interface NativeBrushPresetPortV1 {
  snapshot(): BrushPresetLibraryStateV1;
  importPreset(preset: BrushPresetV1): string;
}

export interface NativeBrushImportResultV1 {
  readonly presetId: string;
  readonly package: IllbrushPackageV1;
}

export interface ExternalBrushImportResultV1 {
  readonly presetId: string;
  readonly preset: BrushPresetV1;
  readonly report: BrushImportPropertyReportV1;
  readonly acceptedLossyMapping: boolean;
}

export async function importNativeBrushPackageV1(input: {
  readonly archiveBytes: Uint8Array;
  readonly brushPresets: NativeBrushPresetPortV1;
  readonly attachments: BrushPackageAttachmentStoreV1;
}): Promise<NativeBrushImportResultV1> {
  const archiveBytes = input.archiveBytes.slice();
  const parsed = await parseIllbrushPackageV1(archiveBytes);
  const presetId = input.brushPresets.importPreset(parsed.brush);
  try {
    await input.attachments.put(presetId, archiveBytes);
  } catch (error) {
    throw new Error('imported brush could not persist its package attachments', { cause: error });
  }
  return Object.freeze({ presetId, package: parsed });
}

export async function stageCspSutBrushFileV1(input: {
  readonly sourceBytes: Uint8Array;
  readonly presetId: string;
}): Promise<ImportedBrushStageV1> {
  const parsed = await parseCspSutV1(input.sourceBytes.slice());
  return stageCspBrushImportV1({ parsed, presetId: input.presetId });
}

export async function stageIbisQrBrushFileV1(input: {
  readonly sourceBlob: Blob;
  readonly presetId: string;
}): Promise<ImportedBrushStageV1> {
  const carrier = await decodeIbisBrushQrBlobV1(input.sourceBlob.slice());
  const payload = await parseIbisBrushPayloadV1(carrier.payload);
  return stageIbisBrushImportV1({ payload, presetId: input.presetId });
}

export function commitExternalBrushImportV1(input: {
  readonly stage: ImportedBrushStageV1;
  readonly brushPresets: NativeBrushPresetPortV1;
  readonly acceptLossyMapping?: boolean;
}): ExternalBrushImportResultV1 {
  const committed = commitImportedBrushStageV1({
    stage: input.stage,
    ...(input.acceptLossyMapping === undefined
      ? {}
      : { acceptLossyMapping: input.acceptLossyMapping }),
  });
  const presetId = input.brushPresets.importPreset(committed.preset);
  return Object.freeze({
    presetId,
    preset: committed.preset,
    report: committed.report,
    acceptedLossyMapping: committed.acceptedLossyMapping,
  });
}

export async function exportNativeBrushPackageV1(input: {
  readonly brush: BrushPresetV1;
  readonly attachments: BrushPackageAttachmentStoreV1;
}): Promise<Uint8Array> {
  const sourceArchive = await input.attachments.get(input.brush.id);
  if (sourceArchive === null) {
    return writeIllbrushPackageV1({ brush: input.brush });
  }
  const sourcePackage = await parseIllbrushPackageV1(sourceArchive);
  return writeIllbrushPackageV1({
    brush: input.brush,
    resources: sourcePackage.resources,
    preview: sourcePackage.preview,
  });
}

export function nativeBrushFilenameV1(name: string): string {
  const withoutControls = [...name.normalize('NFKC')]
    .map((character) => (character.charCodeAt(0) < 32 ? '-' : character))
    .join('');
  const normalized = withoutControls
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/g, '')
    .slice(0, 96);
  return `${normalized || 'Illustro Brush'}.illbrush`;
}
