import { ILLBRUSH_MIME_TYPE } from '../domain/brush-schema.js';
import type { BrushImportPropertyReportV1 } from '../interchange/brush-import-property-report-v1.js';
import type { ImportedBrushStageV1 } from '../interchange/imported-brush-normalizer-v1.js';
import { selectedBrushPresetItemV1 } from './brush-preset-library.js';
import {
  createIndexedDbBrushPackageAttachmentStoreV1,
  type BrushPackageAttachmentStoreV1,
} from './brush-package-attachment-store.js';
import {
  commitExternalBrushImportV1,
  exportNativeBrushPackageV1,
  importNativeBrushPackageV1,
  nativeBrushFilenameV1,
  stageCspSutBrushFileV1,
  stageIbisQrBrushFileV1,
  type NativeBrushPresetPortV1,
} from './brush-interchange-service.js';

export interface BrushInterchangeControllerV1 {
  dispose(): void;
}

export type ConfirmLossyBrushImportV1 = (
  report: BrushImportPropertyReportV1,
) => boolean | Promise<boolean>;

function requiredElementV1<T extends Element>(
  root: ParentNode,
  selector: string,
  ctor: { new (...args: never[]): T },
): T {
  const element = root.querySelector(selector);
  if (!(element instanceof ctor)) throw new Error(`missing brush interchange UI: ${selector}`);
  return element;
}

function downloadIllbrushV1(bytes: Uint8Array, filename: string): void {
  const blob = new Blob([bytes.slice()], { type: ILLBRUSH_MIME_TYPE });
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.rel = 'noopener';
    anchor.hidden = true;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    queueMicrotask(() => URL.revokeObjectURL(url));
  }
}

function importedPresetIdV1(source: 'csp' | 'ibis'): string {
  const time = Date.now().toString(36);
  const random = Math.floor(Math.random() * 0x1_0000_0000)
    .toString(36)
    .padStart(7, '0');
  return `user.import.${source}.${time}.${random}`;
}

function defaultConfirmLossyBrushImportV1(report: BrushImportPropertyReportV1): boolean {
  if (typeof globalThis.confirm !== 'function') return false;
  const ignored = report.ignoredFields.length;
  return globalThis.confirm(
    `このブラシにはIllustroで未対応の設定が${ignored}項目あります。未対応項目を除外し、対応済み設定だけで読み込みますか？`,
  );
}

function fileExtensionV1(file: File): string {
  const index = file.name.lastIndexOf('.');
  return index < 0 ? '' : file.name.slice(index).toLowerCase();
}

async function stageExternalBrushFileV1(file: File): Promise<ImportedBrushStageV1 | null> {
  const extension = fileExtensionV1(file);
  if (extension === '.sut') {
    return stageCspSutBrushFileV1({
      sourceBytes: new Uint8Array(await file.arrayBuffer()),
      presetId: importedPresetIdV1('csp'),
    });
  }
  if (file.type.startsWith('image/') || ['.png', '.jpg', '.jpeg', '.webp'].includes(extension)) {
    return stageIbisQrBrushFileV1({
      sourceBlob: file,
      presetId: importedPresetIdV1('ibis'),
    });
  }
  return null;
}

export function installBrushInterchangeControllerV1(input: {
  readonly root: ParentNode;
  readonly brushPresets: NativeBrushPresetPortV1;
  readonly attachments?: BrushPackageAttachmentStoreV1;
  readonly confirmLossyImport?: ConfirmLossyBrushImportV1;
}): BrushInterchangeControllerV1 {
  const attachments =
    input.attachments ?? createIndexedDbBrushPackageAttachmentStoreV1(globalThis.indexedDB);
  const confirmLossyImport = input.confirmLossyImport ?? defaultConfirmLossyBrushImportV1;
  const importButton = requiredElementV1(input.root, '#brush-preset-import', HTMLButtonElement);
  const exportButton = requiredElementV1(input.root, '#brush-preset-export', HTMLButtonElement);
  const importFile = requiredElementV1(input.root, '#brush-preset-import-file', HTMLInputElement);
  const status = requiredElementV1(input.root, '#brush-preset-status', HTMLOutputElement);
  importFile.accept =
    '.illbrush,.sut,image/png,image/jpeg,image/webp,application/x-illustro-brush+zip';
  importButton.title = 'Illustro / CSP / ibisPaintブラシを読み込む';

  const onImportButton = (): void => {
    importFile.value = '';
    importFile.click();
  };
  const onImportFile = async (): Promise<void> => {
    const file = importFile.files?.[0];
    if (file === undefined) return;
    importButton.disabled = true;
    exportButton.disabled = true;
    status.textContent = 'ブラシを検証中…';
    try {
      const stage = await stageExternalBrushFileV1(file);
      if (stage !== null) {
        let acceptLossyMapping = false;
        if (stage.report.compatibility.requiresUserAcceptance) {
          status.textContent = `未対応設定 ${stage.report.ignoredFields.length}項目を確認中…`;
          acceptLossyMapping = await confirmLossyImport(stage.report);
          if (!acceptLossyMapping) {
            status.textContent = '未対応設定があるためブラシの読み込みをキャンセルしました';
            return;
          }
        }
        const result = commitExternalBrushImportV1({
          stage,
          brushPresets: input.brushPresets,
          acceptLossyMapping,
        });
        status.textContent =
          result.report.ignoredFields.length === 0
            ? `${result.preset.name} を読み込みました`
            : `${result.preset.name} を読み込みました（未対応 ${result.report.ignoredFields.length}項目）`;
        return;
      }

      if (fileExtensionV1(file) !== '.illbrush' && file.type !== ILLBRUSH_MIME_TYPE) {
        throw new TypeError('対応形式は .illbrush / .sut / ibisPaintブラシQR画像です');
      }
      const archiveBytes = new Uint8Array(await file.arrayBuffer());
      const result = await importNativeBrushPackageV1({
        archiveBytes,
        brushPresets: input.brushPresets,
        attachments,
      });
      status.textContent = `${result.package.brush.name} を読み込みました`;
    } catch (error) {
      status.textContent =
        error instanceof Error ? error.message : 'ブラシの読み込みに失敗しました';
    } finally {
      importFile.value = '';
      importButton.disabled = false;
      exportButton.disabled = false;
    }
  };
  const onExportButton = async (): Promise<void> => {
    importButton.disabled = true;
    exportButton.disabled = true;
    status.textContent = 'ブラシを書き出し中…';
    try {
      const brush = selectedBrushPresetItemV1(input.brushPresets.snapshot()).preset;
      const bytes = await exportNativeBrushPackageV1({ brush, attachments });
      downloadIllbrushV1(bytes, nativeBrushFilenameV1(brush.name));
      status.textContent = `${brush.name} を書き出しました`;
    } catch (error) {
      status.textContent =
        error instanceof Error ? error.message : 'ブラシの書き出しに失敗しました';
    } finally {
      importButton.disabled = false;
      exportButton.disabled = false;
    }
  };

  importButton.addEventListener('click', onImportButton);
  importFile.addEventListener('change', onImportFile);
  exportButton.addEventListener('click', onExportButton);

  return Object.freeze({
    dispose() {
      importButton.removeEventListener('click', onImportButton);
      importFile.removeEventListener('change', onImportFile);
      exportButton.removeEventListener('click', onExportButton);
    },
  });
}
