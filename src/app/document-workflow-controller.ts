import type {
  DocumentV1,
  CanvasBackgroundSpec,
  DocumentColorSpace,
  DocumentPrecision,
} from '../domain/document.js';
import { DEFAULT_DOCUMENT_PRESETS_V1, documentPresetByIdV1 } from '../domain/document-presets.js';
import type { CanvasAdmissionControllerV1 } from './canvas-admission-controller.js';
import type { PaintHistoryControllerV1 } from './paint-history-controller.js';
import type { PaintPersistenceControllerV1 } from './paint-persistence-controller.js';
import type { PaintSessionControllerV1 } from './paint-session-controller.js';

export interface DocumentWorkflowControllerV1 {
  readonly schema: 'illustro.document-workflow-controller/1';
  openNewDocument(): void;
  openDocumentSettings(): void;
  dispose(): void;
}

interface DocumentWorkflowOptionsV1 {
  readonly root?: HTMLElement;
  readonly canvasAdmission: CanvasAdmissionControllerV1;
  readonly paintSession: PaintSessionControllerV1;
  readonly paintHistory: PaintHistoryControllerV1;
  readonly paintPersistence: PaintPersistenceControllerV1;
  readonly schedule: (operation: () => Promise<void>) => void;
  readonly onDocumentChanged: (document: DocumentV1) => void;
  readonly onHistoryChanged: () => void;
}

function requireElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (element === null) throw new Error(`document workflow is missing ${selector}`);
  return element;
}

function finiteInput(input: HTMLInputElement, label: string): number {
  const value = Number(input.value);
  if (!Number.isFinite(value)) throw new RangeError(`${label} must be finite`);
  return value;
}

function integerInput(input: HTMLInputElement, label: string): number {
  const value = finiteInput(input, label);
  if (!Number.isSafeInteger(value)) throw new RangeError(`${label} must be an integer`);
  return value;
}

function colorToHex(background: CanvasBackgroundSpec): string {
  if (background.kind === 'transparent') return '#ffffff';
  const [red, green, blue] = background.rgba;
  return `#${[red, green, blue]
    .map((component) =>
      Math.round(component * 255)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}

function hexToColor(value: string, alphaPercent: number): CanvasBackgroundSpec {
  const match = /^#([0-9a-f]{6})$/i.exec(value);
  if (match === null) throw new TypeError('background color must be #RRGGBB');
  const digits = match[1];
  if (digits === undefined) throw new TypeError('background color capture is missing');
  const alpha = Math.min(100, Math.max(0, alphaPercent)) / 100;
  return Object.freeze({
    kind: 'solid' as const,
    rgba: Object.freeze([
      Number.parseInt(digits.slice(0, 2), 16) / 255,
      Number.parseInt(digits.slice(2, 4), 16) / 255,
      Number.parseInt(digits.slice(4, 6), 16) / 255,
      alpha,
    ]) as readonly [number, number, number, number],
  });
}

function backgroundFromForm(
  mode: HTMLSelectElement,
  color: HTMLInputElement,
  alpha: HTMLInputElement,
): CanvasBackgroundSpec {
  if (mode.value === 'transparent') return Object.freeze({ kind: 'transparent' as const });
  return hexToColor(color.value, finiteInput(alpha, 'background opacity'));
}

function closeContainingMenu(element: Element): void {
  element.closest('details')?.removeAttribute('open');
}

export function installDocumentWorkflowControllerV1(
  options: DocumentWorkflowOptionsV1,
): DocumentWorkflowControllerV1 {
  const root = options.root ?? document.documentElement;
  const dialog = requireElement<HTMLDialogElement>('#document-dialog');
  const form = requireElement<HTMLFormElement>('#document-form');
  const title = requireElement<HTMLElement>('#document-dialog-title');
  const nameInput = requireElement<HTMLInputElement>('#document-name');
  const presetSelect = requireElement<HTMLSelectElement>('#document-preset');
  const widthInput = requireElement<HTMLInputElement>('#document-width');
  const heightInput = requireElement<HTMLInputElement>('#document-height');
  const ppiInput = requireElement<HTMLInputElement>('#document-ppi');
  const backgroundMode = requireElement<HTMLSelectElement>('#document-background-mode');
  const backgroundColor = requireElement<HTMLInputElement>('#document-background-color');
  const backgroundAlpha = requireElement<HTMLInputElement>('#document-background-alpha');
  const workingSpaceSelect = requireElement<HTMLSelectElement>('#document-working-space');
  const precisionSelect = requireElement<HTMLSelectElement>('#document-precision');
  const status = requireElement<HTMLOutputElement>('#document-dialog-status');
  const submit = requireElement<HTMLButtonElement>('#document-submit');
  const newDocumentButton = requireElement<HTMLButtonElement>('#new-document');
  const settingsButton = requireElement<HTMLButtonElement>('#document-settings');
  const exportMenuButton = requireElement<HTMLButtonElement>('#export-png-menu');
  const exportButton = document.querySelector<HTMLButtonElement>('#export-png');

  for (const entry of DEFAULT_DOCUMENT_PRESETS_V1) {
    const option = document.createElement('option');
    option.value = entry.id;
    option.textContent = entry.label;
    presetSelect.append(option);
  }

  const updateBackgroundControls = (): void => {
    const solid = backgroundMode.value === 'solid';
    backgroundColor.disabled = !solid;
    backgroundAlpha.disabled = !solid;
  };

  const setCreationControlsDisabled = (disabled: boolean): void => {
    nameInput.disabled = disabled;
    presetSelect.disabled = disabled;
    widthInput.disabled = disabled;
    heightInput.disabled = disabled;
    workingSpaceSelect.disabled = disabled;
    precisionSelect.disabled = disabled;
  };

  const applyPreset = (id: string): void => {
    const entry = documentPresetByIdV1(id);
    if (entry === null) return;
    widthInput.value = String(entry.width);
    heightInput.value = String(entry.height);
    ppiInput.value = String(entry.ppi);
    backgroundMode.value = entry.background.kind;
    backgroundColor.value = colorToHex(entry.background);
    backgroundAlpha.value =
      entry.background.kind === 'solid' ? String(entry.background.rgba[3] * 100) : '100';
    workingSpaceSelect.value = entry.workingSpace;
    precisionSelect.value = entry.precision;
    updateBackgroundControls();
  };

  const showDialog = (): void => {
    status.value = '';
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  };

  const openNewDocument = (): void => {
    dialog.dataset.mode = 'new';
    title.textContent = '新規ドキュメント';
    submit.textContent = '作成';
    setCreationControlsDisabled(false);
    nameInput.value = 'Untitled';
    presetSelect.value = DEFAULT_DOCUMENT_PRESETS_V1[0]?.id ?? 'custom';
    applyPreset(presetSelect.value);
    showDialog();
  };

  const openDocumentSettings = (): void => {
    const current = options.paintSession.currentDocument();
    if (current === null) return;
    dialog.dataset.mode = 'settings';
    title.textContent = 'ドキュメント設定';
    submit.textContent = '適用';
    setCreationControlsDisabled(true);
    nameInput.value = 'Current document';
    presetSelect.value = 'custom';
    widthInput.value = String(current.canvas.width);
    heightInput.value = String(current.canvas.height);
    ppiInput.value = String(current.canvas.resolution.ppi);
    backgroundMode.value = current.canvas.background.kind;
    backgroundColor.value = colorToHex(current.canvas.background);
    backgroundAlpha.value =
      current.canvas.background.kind === 'solid'
        ? String(current.canvas.background.rgba[3] * 100)
        : '100';
    workingSpaceSelect.value = current.color.workingSpace;
    precisionSelect.value = current.color.precision;
    updateBackgroundControls();
    showDialog();
  };

  const onPresetChange = (): void => applyPreset(presetSelect.value);
  const onBackgroundModeChange = (): void => updateBackgroundControls();
  const onNewClick = (): void => {
    closeContainingMenu(newDocumentButton);
    openNewDocument();
  };
  const onSettingsClick = (): void => {
    closeContainingMenu(settingsButton);
    openDocumentSettings();
  };
  const onExportMenuClick = (): void => {
    closeContainingMenu(exportMenuButton);
    exportButton?.click();
  };

  const onSubmit = (event: SubmitEvent): void => {
    event.preventDefault();
    if (submit.disabled) return;
    const mode = dialog.dataset.mode;
    submit.disabled = true;
    status.value = mode === 'settings' ? '更新中…' : '作成中…';

    options.schedule(async () => {
      try {
        const ppi = finiteInput(ppiInput, 'PPI');
        const background = backgroundFromForm(backgroundMode, backgroundColor, backgroundAlpha);
        if (mode === 'settings') {
          const transaction = options.paintHistory.commitDocumentSettings({ ppi, background });
          await options.paintPersistence.markDirty(transaction.transactionId);
          const current = options.paintSession.currentDocument();
          if (current === null)
            throw new Error('document settings update lost the active document');
          options.onDocumentChanged(current);
          options.onHistoryChanged();
        } else {
          const width = integerInput(widthInput, 'width');
          const height = integerInput(heightInput, 'height');
          const workingSpace = workingSpaceSelect.value as DocumentColorSpace;
          const precision = precisionSelect.value as DocumentPrecision;
          if (workingSpace !== 'srgb' && workingSpace !== 'display-p3') {
            throw new TypeError('unsupported document working space');
          }
          if (precision !== 'rgba8-unorm' && precision !== 'rgba16-float') {
            throw new TypeError('unsupported document precision');
          }
          const admission = await options.canvasAdmission.preflight({
            width,
            height,
            precision,
            projectedTouchedTiles: 0,
            operationScratchBytes: 0,
          });
          if (!admission.allowed) {
            status.value = `作成できません: ${admission.reasons.join(', ')}`;
            return;
          }
          await options.paintPersistence.createNewProject({
            name: nameInput.value.trim() || 'Untitled',
            document: { width, height, ppi, background, workingSpace, precision },
          });
          const current = options.paintSession.currentDocument();
          if (current === null) throw new Error('new document creation lost the active document');
          options.onDocumentChanged(current);
          options.onHistoryChanged();
        }
        status.value = '';
        dialog.close();
      } catch (error) {
        status.value = error instanceof Error ? error.message : String(error);
        root.dataset.illustroDocumentWorkflowError = status.value;
      } finally {
        submit.disabled = false;
      }
    });
  };

  presetSelect.addEventListener('change', onPresetChange);
  backgroundMode.addEventListener('change', onBackgroundModeChange);
  newDocumentButton.addEventListener('click', onNewClick);
  settingsButton.addEventListener('click', onSettingsClick);
  exportMenuButton.addEventListener('click', onExportMenuClick);
  form.addEventListener('submit', onSubmit);
  updateBackgroundControls();
  root.dataset.illustroDocumentWorkflow = 'ready';

  return Object.freeze({
    schema: 'illustro.document-workflow-controller/1' as const,
    openNewDocument,
    openDocumentSettings,
    dispose(): void {
      presetSelect.removeEventListener('change', onPresetChange);
      backgroundMode.removeEventListener('change', onBackgroundModeChange);
      newDocumentButton.removeEventListener('click', onNewClick);
      settingsButton.removeEventListener('click', onSettingsClick);
      exportMenuButton.removeEventListener('click', onExportMenuClick);
      form.removeEventListener('submit', onSubmit);
      root.dataset.illustroDocumentWorkflow = 'disposed';
    },
  });
}
