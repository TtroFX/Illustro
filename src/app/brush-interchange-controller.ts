import { ILLBRUSH_MIME_TYPE } from '../domain/brush-schema.js';
import { selectedBrushPresetItemV1 } from './brush-preset-library.js';
import {
  createIndexedDbBrushPackageAttachmentStoreV1,
  type BrushPackageAttachmentStoreV1,
} from './brush-package-attachment-store.js';
import {
  exportNativeBrushPackageV1,
  importNativeBrushPackageV1,
  nativeBrushFilenameV1,
  type NativeBrushPresetPortV1,
} from './brush-interchange-service.js';

export interface BrushInterchangeControllerV1 {
  dispose(): void;
}

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

export function installBrushInterchangeControllerV1(input: {
  readonly root: ParentNode;
  readonly brushPresets: NativeBrushPresetPortV1;
  readonly attachments?: BrushPackageAttachmentStoreV1;
}): BrushInterchangeControllerV1 {
  const attachments =
    input.attachments ?? createIndexedDbBrushPackageAttachmentStoreV1(globalThis.indexedDB);
  const importButton = requiredElementV1(input.root, '#brush-preset-import', HTMLButtonElement);
  const exportButton = requiredElementV1(input.root, '#brush-preset-export', HTMLButtonElement);
  const importFile = requiredElementV1(input.root, '#brush-preset-import-file', HTMLInputElement);
  const status = requiredElementV1(input.root, '#brush-preset-status', HTMLOutputElement);

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
