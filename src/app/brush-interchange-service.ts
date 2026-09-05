import type { BrushPresetV1 } from '../domain/brush-schema.js';
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
  const normalized = name
    .normalize('NFKC')
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/g, '')
    .slice(0, 96);
  return `${normalized || 'Illustro Brush'}.illbrush`;
}
