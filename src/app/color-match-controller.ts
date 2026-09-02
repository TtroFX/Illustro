import type { DocumentV1 } from '../domain/document.js';
import {
  applyPersistedLayerColorMatchV1,
  colorMatchPreviewImageV1,
  layerColorMatchEligibilityV1,
  persistPreparedLayerColorMatchV1,
  prepareLayerColorMatchV1,
  readLayerColorMatchSourceV1,
  type ColorMatchStatisticsV1,
  type LayerColorMatchSourceV1,
  type PreparedLayerColorMatchV1,
} from './color-match.js';
import type { PaintHistoryControllerV1 } from './paint-history-controller.js';
import type { PaintPersistenceControllerV1 } from './paint-persistence-controller.js';
import type { PaintSessionControllerV1 } from './paint-session-controller.js';
import type { ReferenceWorkflowControllerV1 } from './reference-workflow-controller.js';

export interface ColorMatchControllerV1 {
  readonly schema: 'illustro.color-match-controller/1';
  dispose(): void;
}

interface OptionsV1 {
  readonly root: HTMLElement;
  readonly paintSession: PaintSessionControllerV1;
  readonly paintHistory: PaintHistoryControllerV1;
  readonly paintPersistence: PaintPersistenceControllerV1;
  readonly referenceWorkflow: ReferenceWorkflowControllerV1;
  readonly schedule: (operation: () => Promise<void>) => void;
  readonly onHistoryChanged: () => void;
  readonly onDocumentChanged: (document: DocumentV1) => void;
}

function required<T extends Element>(
  root: ParentNode,
  selector: string,
  ctor: { new (): T },
): T {
  const element = root.querySelector(selector);
  if (!(element instanceof ctor)) throw new Error(`Color Match is missing ${selector}`);
  return element;
}

function drawPreview(canvas: HTMLCanvasElement, image: ReturnType<typeof colorMatchPreviewImageV1>): void {
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext('2d');
  if (context === null) throw new Error('Color Match preview canvas is unavailable');
  context.putImageData(new ImageData(new Uint8ClampedArray(image.bytes), image.width, image.height), 0, 0);
}

export function installColorMatchControllerV1(options: OptionsV1): ColorMatchControllerV1 {
  const commandButton = required(options.root, '#color-match-command', HTMLButtonElement);
  const dialog = required(options.root, '#color-match-dialog', HTMLDialogElement);
  const form = required(options.root, '#color-match-form', HTMLFormElement);
  const cancelButton = required(options.root, '#color-match-cancel', HTMLButtonElement);
  const applyButton = required(options.root, '#color-match-apply', HTMLButtonElement);
  const referenceOutput = required(options.root, '#color-match-reference', HTMLOutputElement);
  const strengthInput = required(options.root, '#color-match-strength', HTMLInputElement);
  const strengthOutput = required(options.root, '#color-match-strength-value', HTMLOutputElement);
  const beforeCanvas = required(options.root, '#color-match-before', HTMLCanvasElement);
  const afterCanvas = required(options.root, '#color-match-after', HTMLCanvasElement);
  const status = required(options.root, '#color-match-status', HTMLOutputElement);

  let disposed = false;
  let loadSequence = 0;
  let source: LayerColorMatchSourceV1 | null = null;
  let targetStatistics: ColorMatchStatisticsV1 | null = null;
  let prepared: PreparedLayerColorMatchV1 | null = null;

  const resetTransient = (): void => {
    source = null;
    targetStatistics = null;
    prepared = null;
    applyButton.disabled = true;
  };

  const publishError = (error: unknown): void => {
    const message = error instanceof Error ? error.message : String(error);
    status.value = message;
    options.root.dataset.illustroColorMatch = 'error';
    options.root.dataset.illustroColorMatchError = message;
    applyButton.disabled = true;
  };

  const refreshPrepared = (): void => {
    if (source === null || targetStatistics === null) return;
    const strengthPercent = Number(strengthInput.value);
    const strength = Number.isFinite(strengthPercent) ? Math.min(100, Math.max(0, strengthPercent)) / 100 : 1;
    strengthInput.value = String(Math.round(strength * 100));
    strengthOutput.value = `${Math.round(strength * 100)}%`;
    prepared = prepareLayerColorMatchV1(source, targetStatistics, strength);
    drawPreview(beforeCanvas, colorMatchPreviewImageV1(prepared, 'before'));
    drawPreview(afterCanvas, colorMatchPreviewImageV1(prepared, 'after'));
    applyButton.disabled = strength <= 0;
    status.value = strength <= 0 ? '強度0%では変更されません。' : 'プレビュー中。適用するまでドキュメントは変更されません。';
    options.root.dataset.illustroColorMatch = 'preview';
    options.root.dataset.illustroColorMatchStrength = String(strength);
  };

  const open = async (): Promise<void> => {
    if (disposed || dialog.open) return;
    const sequence = ++loadSequence;
    resetTransient();
    options.root.dataset.illustroColorMatchError = '';
    options.root.dataset.illustroColorMatch = 'loading';
    referenceOutput.value = '参照画像を確認中…';
    status.value = '色統計を解析中…';
    strengthInput.value = '100';
    strengthOutput.value = '100%';
    commandButton.closest('details')?.removeAttribute('open');
    dialog.showModal();
    try {
      if (options.paintSession.activeStrokeId() !== null) {
        throw new Error('描画中はColor Matchを開始できません');
      }
      const snapshot = options.paintSession.projectSnapshot();
      const layerId = options.paintSession.activeLayerId();
      if (snapshot === null || layerId === null) throw new Error('Color Matchにはアクティブドキュメントが必要です');
      const eligibility = layerColorMatchEligibilityV1(snapshot, layerId);
      if (!eligibility.eligible) throw new Error(eligibility.reason ?? 'Color Match is unavailable');
      const referenceLabel = options.referenceWorkflow.activeReferenceLabel();
      if (referenceLabel === null) throw new Error('Color MatchにはSub Viewの参照画像が必要です');
      referenceOutput.value = referenceLabel;
      const [nextSource, nextTarget] = await Promise.all([
        readLayerColorMatchSourceV1(snapshot, layerId, options.paintPersistence),
        options.referenceWorkflow.activeColorStatistics(snapshot.document.color.workingSpace),
      ]);
      if (disposed || sequence !== loadSequence) return;
      if (nextTarget === null) throw new Error('参照画像から有効な色統計を取得できませんでした');
      source = nextSource;
      targetStatistics = nextTarget;
      refreshPrepared();
    } catch (error) {
      if (!disposed && sequence === loadSequence) publishError(error);
    }
  };

  const cancel = (): void => {
    loadSequence += 1;
    resetTransient();
    status.value = '';
    options.root.dataset.illustroColorMatch = 'cancelled';
    options.root.dataset.illustroColorMatchStrength = '';
    if (dialog.open) dialog.close();
  };

  const onDialogCancel = (event: Event): void => {
    event.preventDefault();
    cancel();
  };

  const onSubmit = (event: SubmitEvent): void => {
    event.preventDefault();
    const pending = prepared;
    if (pending === null || pending.strength <= 0) return;
    applyButton.disabled = true;
    status.value = '適用中…';
    options.root.dataset.illustroColorMatch = 'applying';
    options.schedule(async () => {
      try {
        if (options.paintSession.activeStrokeId() !== null) {
          throw new Error('描画中はColor Matchを適用できません');
        }
        const persisted = await persistPreparedLayerColorMatchV1(pending, options.paintPersistence);
        const transaction = await options.paintHistory.commitSnapshotTransform(
          'color.match',
          (before, revision) => applyPersistedLayerColorMatchV1(before, persisted, revision),
        );
        options.paintSession.setActiveLayer(pending.layerId);
        await options.paintPersistence.markDirty(transaction.transactionId);
        options.root.dataset.illustroColorMatch = 'committed';
        options.root.dataset.illustroColorMatchTransaction = transaction.transactionId;
        const documentValue = options.paintSession.currentDocument();
        if (documentValue !== null) options.onDocumentChanged(documentValue);
        options.onHistoryChanged();
        resetTransient();
        if (dialog.open) dialog.close();
      } catch (error) {
        publishError(error);
      }
    });
  };

  const onOpen = (): void => {
    void open();
  };
  const onStrengthInput = (): void => {
    try {
      refreshPrepared();
    } catch (error) {
      publishError(error);
    }
  };

  commandButton.addEventListener('click', onOpen);
  cancelButton.addEventListener('click', cancel);
  strengthInput.addEventListener('input', onStrengthInput);
  form.addEventListener('submit', onSubmit);
  dialog.addEventListener('cancel', onDialogCancel);
  options.root.dataset.illustroColorMatch = 'ready';

  return Object.freeze({
    schema: 'illustro.color-match-controller/1' as const,
    dispose(): void {
      if (disposed) return;
      disposed = true;
      loadSequence += 1;
      commandButton.removeEventListener('click', onOpen);
      cancelButton.removeEventListener('click', cancel);
      strengthInput.removeEventListener('input', onStrengthInput);
      form.removeEventListener('submit', onSubmit);
      dialog.removeEventListener('cancel', onDialogCancel);
      resetTransient();
      if (dialog.open) dialog.close();
      options.root.dataset.illustroColorMatch = 'disposed';
    },
  });
}
