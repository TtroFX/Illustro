import type { DocumentV1 } from '../domain/document.js';
import type { CanvasAdmissionControllerV1 } from './canvas-admission-controller.js';
import {
  cropCanvasSnapshotV1,
  flipDocumentSnapshotV1,
  imageResizeSnapshotV1,
  isCanvasExpansionV1,
  projectedTouchedTilesForSnapshotV1,
  resizeCanvasSnapshotV1,
  rotateDocumentSnapshotV1,
  trimTransparentCanvasSnapshotV1,
  type DocumentFlipAxisV1,
  type DocumentQuarterTurnV1,
} from './document-geometry.js';
import type { PaintHistoryControllerV1 } from './paint-history-controller.js';
import type { PaintPersistenceControllerV1 } from './paint-persistence-controller.js';
import type {
  PaintProjectSnapshotV1,
  PaintSessionControllerV1,
} from './paint-session-controller.js';

export interface DocumentGeometryWorkflowControllerV1 {
  readonly schema: 'illustro.document-geometry-workflow/1';
  dispose(): void;
}

interface OptionsV1 {
  readonly root?: HTMLElement;
  readonly canvasAdmission: CanvasAdmissionControllerV1;
  readonly paintSession: PaintSessionControllerV1;
  readonly paintHistory: PaintHistoryControllerV1;
  readonly paintPersistence: PaintPersistenceControllerV1;
  readonly schedule: (operation: () => Promise<void>) => void;
  readonly onDocumentChanged: (document: DocumentV1) => void;
  readonly onHistoryChanged: () => void;
}

function required<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (element === null) throw new Error(`document geometry workflow is missing ${selector}`);
  return element;
}

function integer(input: HTMLInputElement, label: string): number {
  const value = Number(input.value);
  if (!Number.isSafeInteger(value)) throw new RangeError(`${label} must be an integer`);
  return value;
}

function closeMenu(element: Element): void {
  element.closest('details')?.removeAttribute('open');
}

export function installDocumentGeometryWorkflowControllerV1(
  options: OptionsV1,
): DocumentGeometryWorkflowControllerV1 {
  const root = options.root ?? document.documentElement;
  const imageResizeButton = required<HTMLButtonElement>('#image-resize');
  const resizeButton = required<HTMLButtonElement>('#canvas-resize');
  const cropButton = required<HTMLButtonElement>('#canvas-crop');
  const trimButton = required<HTMLButtonElement>('#canvas-trim');
  const rotateCwButton = required<HTMLButtonElement>('#document-rotate-cw');
  const rotateCcwButton = required<HTMLButtonElement>('#document-rotate-ccw');
  const rotate180Button = required<HTMLButtonElement>('#document-rotate-180');
  const flipHorizontalButton = required<HTMLButtonElement>('#document-flip-horizontal');
  const flipVerticalButton = required<HTMLButtonElement>('#document-flip-vertical');
  const dialog = required<HTMLDialogElement>('#canvas-geometry-dialog');
  const form = required<HTMLFormElement>('#canvas-geometry-form');
  const title = required<HTMLElement>('#canvas-geometry-title');
  const xRow = required<HTMLElement>('#canvas-geometry-x-row');
  const yRow = required<HTMLElement>('#canvas-geometry-y-row');
  const xLabel = required<HTMLElement>('#canvas-geometry-x-label');
  const yLabel = required<HTMLElement>('#canvas-geometry-y-label');
  const xInput = required<HTMLInputElement>('#canvas-geometry-x');
  const yInput = required<HTMLInputElement>('#canvas-geometry-y');
  const widthInput = required<HTMLInputElement>('#canvas-geometry-width');
  const heightInput = required<HTMLInputElement>('#canvas-geometry-height');
  const help = required<HTMLElement>('#canvas-geometry-help');
  const status = required<HTMLOutputElement>('#canvas-geometry-status');
  const submit = required<HTMLButtonElement>('#canvas-geometry-submit');
  const cancel = required<HTMLButtonElement>('#canvas-geometry-cancel');

  const show = (): void => {
    status.value = '';
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  };

  const openImageResize = (): void => {
    const current = options.paintSession.currentDocument();
    if (current === null) return;
    closeMenu(imageResizeButton);
    dialog.dataset.mode = 'image-resize';
    title.textContent = '画像サイズ';
    xRow.hidden = true;
    yRow.hidden = true;
    widthInput.value = String(current.canvas.width);
    heightInput.value = String(current.canvas.height);
    help.textContent = '画像内容とブラシ形状を新しいピクセル寸法へスケールします。';
    submit.textContent = 'リサイズ';
    show();
  };

  const openResize = (): void => {
    const current = options.paintSession.currentDocument();
    if (current === null) return;
    closeMenu(resizeButton);
    dialog.dataset.mode = 'resize';
    title.textContent = 'キャンバスサイズ';
    xRow.hidden = false;
    yRow.hidden = false;
    xLabel.textContent = '内容オフセット X';
    yLabel.textContent = '内容オフセット Y';
    xInput.value = '0';
    yInput.value = '0';
    widthInput.value = String(current.canvas.width);
    heightInput.value = String(current.canvas.height);
    help.textContent =
      'オフセットは既存内容を新しいキャンバス座標へ移動します。大きくする場合は余白追加として扱われます。';
    submit.textContent = '適用';
    show();
  };

  const openCrop = (): void => {
    const current = options.paintSession.currentDocument();
    if (current === null) return;
    closeMenu(cropButton);
    dialog.dataset.mode = 'crop';
    title.textContent = 'クロップ';
    xRow.hidden = false;
    yRow.hidden = false;
    xLabel.textContent = '左';
    yLabel.textContent = '上';
    xInput.value = '0';
    yInput.value = '0';
    widthInput.value = String(current.canvas.width);
    heightInput.value = String(current.canvas.height);
    help.textContent = '指定矩形の外側を切り落とします。';
    submit.textContent = 'クロップ';
    show();
  };

  const publishTransform = async (transactionId: string): Promise<void> => {
    await options.paintPersistence.markDirty(transactionId);
    const documentValue = options.paintSession.currentDocument();
    if (documentValue !== null) options.onDocumentChanged(documentValue);
    options.onHistoryChanged();
  };

  const assertAdmission = async (preview: PaintProjectSnapshotV1, label: string): Promise<void> => {
    const admission = await options.canvasAdmission.preflightDocumentResize({
      width: preview.document.canvas.width,
      height: preview.document.canvas.height,
      precision: preview.document.color.precision,
      projectedTouchedTiles: projectedTouchedTilesForSnapshotV1(preview),
    });
    if (!admission.allowed) throw new Error(`${label} rejected: ${admission.reasons.join(', ')}`);
  };

  const runSnapshotTransform = (
    sourceButton: HTMLButtonElement,
    commandId: string,
    label: string,
    transform: (
      before: PaintProjectSnapshotV1,
      revision: PaintProjectSnapshotV1['document']['revision'],
    ) => PaintProjectSnapshotV1,
  ): void => {
    closeMenu(sourceButton);
    options.schedule(async () => {
      const current = options.paintSession.projectSnapshot();
      if (current === null) return;
      try {
        const previewRevision = (current.document.revision + 1) as typeof current.document.revision;
        const preview = transform(current, previewRevision);
        await assertAdmission(preview, label);
        const transaction = await options.paintHistory.commitSnapshotTransform(
          commandId,
          transform,
        );
        await publishTransform(transaction.transactionId);
      } catch (error) {
        root.dataset.illustroCanvasGeometryError =
          error instanceof Error ? error.message : String(error);
      }
    });
  };

  const runTrim = (): void => {
    closeMenu(trimButton);
    options.schedule(async () => {
      const current = options.paintSession.projectSnapshot();
      if (current === null) return;
      try {
        const preview = trimTransparentCanvasSnapshotV1(
          current,
          (current.document.revision + 1) as typeof current.document.revision,
        );
        await assertAdmission(preview, 'trim');
        const transaction = await options.paintHistory.commitSnapshotTransform(
          'document.canvas.trim',
          (before, revision) => trimTransparentCanvasSnapshotV1(before, revision),
        );
        await publishTransform(transaction.transactionId);
      } catch (error) {
        root.dataset.illustroCanvasGeometryError =
          error instanceof Error ? error.message : String(error);
      }
    });
  };

  const runRotate = (button: HTMLButtonElement, turn: DocumentQuarterTurnV1): void =>
    runSnapshotTransform(button, `document.rotate.${turn}`, 'rotate', (before, revision) =>
      rotateDocumentSnapshotV1(before, turn, revision),
    );

  const runFlip = (button: HTMLButtonElement, axis: DocumentFlipAxisV1): void =>
    runSnapshotTransform(button, `document.flip.${axis}`, 'flip', (before, revision) =>
      flipDocumentSnapshotV1(before, axis, revision),
    );

  const onSubmit = (event: SubmitEvent): void => {
    event.preventDefault();
    if (submit.disabled) return;
    const mode = dialog.dataset.mode;
    const current = options.paintSession.projectSnapshot();
    if (current === null) return;
    submit.disabled = true;
    status.value = '処理中…';
    options.schedule(async () => {
      try {
        const width = integer(widthInput, 'width');
        const height = integer(heightInput, 'height');
        const previewRevision = (current.document.revision + 1) as typeof current.document.revision;
        if (mode === 'image-resize') {
          const preview = imageResizeSnapshotV1(current, { width, height }, previewRevision);
          await assertAdmission(preview, 'image resize');
          const transaction = await options.paintHistory.commitSnapshotTransform(
            'document.image.resize',
            (before, revision) => imageResizeSnapshotV1(before, { width, height }, revision),
          );
          await publishTransform(transaction.transactionId);
        } else {
          const x = integer(xInput, mode === 'crop' ? 'crop x' : 'offset x');
          const y = integer(yInput, mode === 'crop' ? 'crop y' : 'offset y');
          const preview =
            mode === 'crop'
              ? cropCanvasSnapshotV1(current, { x, y, width, height }, previewRevision)
              : resizeCanvasSnapshotV1(
                  current,
                  { width, height, offsetX: x, offsetY: y },
                  previewRevision,
                );
          await assertAdmission(preview, mode === 'crop' ? 'crop' : 'canvas resize');
          const commandId =
            mode === 'crop'
              ? 'document.canvas.crop'
              : isCanvasExpansionV1(current, { width, height, offsetX: x, offsetY: y })
                ? 'document.canvas.expand'
                : 'document.canvas.resize';
          const transaction = await options.paintHistory.commitSnapshotTransform(
            commandId,
            (before, revision) =>
              mode === 'crop'
                ? cropCanvasSnapshotV1(before, { x, y, width, height }, revision)
                : resizeCanvasSnapshotV1(
                    before,
                    { width, height, offsetX: x, offsetY: y },
                    revision,
                  ),
          );
          await publishTransform(transaction.transactionId);
        }
        status.value = '';
        dialog.close();
      } catch (error) {
        status.value = error instanceof Error ? error.message : String(error);
        root.dataset.illustroCanvasGeometryError = status.value;
      } finally {
        submit.disabled = false;
      }
    });
  };

  const onCancel = (): void => dialog.close();
  const onRotateCw = (): void => runRotate(rotateCwButton, 'clockwise-90');
  const onRotateCcw = (): void => runRotate(rotateCcwButton, 'counterclockwise-90');
  const onRotate180 = (): void => runRotate(rotate180Button, 'rotate-180');
  const onFlipHorizontal = (): void => runFlip(flipHorizontalButton, 'horizontal');
  const onFlipVertical = (): void => runFlip(flipVerticalButton, 'vertical');

  imageResizeButton.addEventListener('click', openImageResize);
  resizeButton.addEventListener('click', openResize);
  cropButton.addEventListener('click', openCrop);
  trimButton.addEventListener('click', runTrim);
  rotateCwButton.addEventListener('click', onRotateCw);
  rotateCcwButton.addEventListener('click', onRotateCcw);
  rotate180Button.addEventListener('click', onRotate180);
  flipHorizontalButton.addEventListener('click', onFlipHorizontal);
  flipVerticalButton.addEventListener('click', onFlipVertical);
  form.addEventListener('submit', onSubmit);
  cancel.addEventListener('click', onCancel);
  root.dataset.illustroCanvasGeometry = 'ready';

  return Object.freeze({
    schema: 'illustro.document-geometry-workflow/1' as const,
    dispose(): void {
      imageResizeButton.removeEventListener('click', openImageResize);
      resizeButton.removeEventListener('click', openResize);
      cropButton.removeEventListener('click', openCrop);
      trimButton.removeEventListener('click', runTrim);
      rotateCwButton.removeEventListener('click', onRotateCw);
      rotateCcwButton.removeEventListener('click', onRotateCcw);
      rotate180Button.removeEventListener('click', onRotate180);
      flipHorizontalButton.removeEventListener('click', onFlipHorizontal);
      flipVerticalButton.removeEventListener('click', onFlipVertical);
      form.removeEventListener('submit', onSubmit);
      cancel.removeEventListener('click', onCancel);
      root.dataset.illustroCanvasGeometry = 'disposed';
    },
  });
}
