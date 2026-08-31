from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    target = Path(path)
    text = target.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"expected one replacement in {path}, found {count}: {old[:120]!r}")
    target.write_text(text.replace(old, new, 1))


Path('src/app/document-geometry.ts').write_text(r'''import { createCanvasSpec, MAX_CANVAS_AREA, MAX_CANVAS_DIMENSION } from '../domain/document.js';
import type { Revision } from '../domain/identity.js';
import { planBaselineBrushTilesV1, type BaselineBrushDabV1 } from '../gpu/baseline-brush.js';
import type {
  CompletedPaintStrokeV1,
  PaintProjectSnapshotV1,
  PaintStrokeSampleV1,
} from './paint-session-controller.js';

export interface CanvasResizeInputV1 {
  readonly width: number;
  readonly height: number;
  readonly offsetX: number;
  readonly offsetY: number;
}

export interface CanvasCropInputV1 {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

function assertDimension(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 1 || value > MAX_CANVAS_DIMENSION) {
    throw new RangeError(`${label} must be an integer in 1..${MAX_CANVAS_DIMENSION}`);
  }
}

function assertOffset(value: number, label: string): void {
  if (!Number.isSafeInteger(value)) throw new RangeError(`${label} must be a safe integer`);
}

function assertCanvasArea(width: number, height: number): void {
  if (width > Math.floor(MAX_CANVAS_AREA / height)) {
    throw new RangeError(`canvas logical area must not exceed ${MAX_CANVAS_AREA}`);
  }
}

function shiftedSample(sample: PaintStrokeSampleV1, offsetX: number, offsetY: number): PaintStrokeSampleV1 {
  return Object.freeze({
    ...sample,
    documentX: sample.documentX + offsetX,
    documentY: sample.documentY + offsetY,
  });
}

function shiftedDab(dab: BaselineBrushDabV1, offsetX: number, offsetY: number): BaselineBrushDabV1 {
  return Object.freeze({ ...dab, x: dab.x + offsetX, y: dab.y + offsetY });
}

function dabIntersectsCanvas(dab: BaselineBrushDabV1, width: number, height: number): boolean {
  return (
    dab.opacity > 0 &&
    dab.x + dab.radius > 0 &&
    dab.y + dab.radius > 0 &&
    dab.x - dab.radius < width &&
    dab.y - dab.radius < height
  );
}

function translateAndClipStroke(
  completed: CompletedPaintStrokeV1,
  width: number,
  height: number,
  offsetX: number,
  offsetY: number,
): CompletedPaintStrokeV1 | null {
  const dabs = completed.dabs
    .map((dab) => shiftedDab(dab, offsetX, offsetY))
    .filter((dab) => dabIntersectsCanvas(dab, width, height));
  if (dabs.length === 0) return null;
  return Object.freeze({
    stroke: Object.freeze({
      ...completed.stroke,
      samples: Object.freeze(
        completed.stroke.samples.map((sample) => shiftedSample(sample, offsetX, offsetY)),
      ),
    }),
    dabs: Object.freeze(dabs),
  });
}

function transformedDocument(
  snapshot: PaintProjectSnapshotV1,
  width: number,
  height: number,
  revision: Revision,
  now: Date,
) {
  const current = snapshot.document;
  return Object.freeze({
    ...current,
    revision,
    modifiedAt: now.toISOString(),
    canvas: createCanvasSpec({
      width,
      height,
      ppi: current.canvas.resolution.ppi,
      background: current.canvas.background,
    }),
  });
}

export function resizeCanvasSnapshotV1(
  snapshot: PaintProjectSnapshotV1,
  input: CanvasResizeInputV1,
  revision: Revision,
  now: Date = new Date(),
): PaintProjectSnapshotV1 {
  assertDimension(input.width, 'canvas width');
  assertDimension(input.height, 'canvas height');
  assertCanvasArea(input.width, input.height);
  assertOffset(input.offsetX, 'canvas offsetX');
  assertOffset(input.offsetY, 'canvas offsetY');
  if (
    input.width === snapshot.document.canvas.width &&
    input.height === snapshot.document.canvas.height &&
    input.offsetX === 0 &&
    input.offsetY === 0
  ) {
    throw new Error('canvas resize has no changes');
  }
  const committedStrokes = snapshot.committedStrokes
    .map((completed) =>
      translateAndClipStroke(
        completed,
        input.width,
        input.height,
        input.offsetX,
        input.offsetY,
      ),
    )
    .filter((completed): completed is CompletedPaintStrokeV1 => completed !== null);
  return Object.freeze({
    schema: 'illustro.paint-project-snapshot/1' as const,
    document: transformedDocument(snapshot, input.width, input.height, revision, now),
    committedStrokes: Object.freeze(committedStrokes),
  });
}

export function cropCanvasSnapshotV1(
  snapshot: PaintProjectSnapshotV1,
  input: CanvasCropInputV1,
  revision: Revision,
  now: Date = new Date(),
): PaintProjectSnapshotV1 {
  assertOffset(input.x, 'crop x');
  assertOffset(input.y, 'crop y');
  assertDimension(input.width, 'crop width');
  assertDimension(input.height, 'crop height');
  if (input.x < 0 || input.y < 0) throw new RangeError('crop origin must be inside the canvas');
  if (
    input.x + input.width > snapshot.document.canvas.width ||
    input.y + input.height > snapshot.document.canvas.height
  ) {
    throw new RangeError('crop rectangle must be inside the canvas');
  }
  if (
    input.x === 0 &&
    input.y === 0 &&
    input.width === snapshot.document.canvas.width &&
    input.height === snapshot.document.canvas.height
  ) {
    throw new Error('crop has no changes');
  }
  return resizeCanvasSnapshotV1(
    snapshot,
    { width: input.width, height: input.height, offsetX: -input.x, offsetY: -input.y },
    revision,
    now,
  );
}

export function transparentContentBoundsV1(snapshot: PaintProjectSnapshotV1): CanvasCropInputV1 | null {
  if (snapshot.document.canvas.background.kind !== 'transparent') return null;
  let left = Number.POSITIVE_INFINITY;
  let top = Number.POSITIVE_INFINITY;
  let right = Number.NEGATIVE_INFINITY;
  let bottom = Number.NEGATIVE_INFINITY;
  for (const completed of snapshot.committedStrokes) {
    for (const dab of completed.dabs) {
      if (dab.opacity <= 0 || !dabIntersectsCanvas(dab, snapshot.document.canvas.width, snapshot.document.canvas.height)) {
        continue;
      }
      left = Math.min(left, Math.floor(dab.x - dab.radius));
      top = Math.min(top, Math.floor(dab.y - dab.radius));
      right = Math.max(right, Math.ceil(dab.x + dab.radius));
      bottom = Math.max(bottom, Math.ceil(dab.y + dab.radius));
    }
  }
  if (!Number.isFinite(left)) return null;
  const x = Math.max(0, left);
  const y = Math.max(0, top);
  const rightEdge = Math.min(snapshot.document.canvas.width, right);
  const bottomEdge = Math.min(snapshot.document.canvas.height, bottom);
  if (rightEdge <= x || bottomEdge <= y) return null;
  return Object.freeze({ x, y, width: rightEdge - x, height: bottomEdge - y });
}

export function trimTransparentCanvasSnapshotV1(
  snapshot: PaintProjectSnapshotV1,
  revision: Revision,
  now: Date = new Date(),
): PaintProjectSnapshotV1 {
  if (snapshot.document.canvas.background.kind !== 'transparent') {
    throw new Error('trim transparent edges requires a transparent canvas background');
  }
  const bounds = transparentContentBoundsV1(snapshot);
  if (bounds === null) throw new Error('trim requires visible painted content');
  if (
    bounds.x === 0 &&
    bounds.y === 0 &&
    bounds.width === snapshot.document.canvas.width &&
    bounds.height === snapshot.document.canvas.height
  ) {
    throw new Error('trim has no transparent border');
  }
  return cropCanvasSnapshotV1(snapshot, bounds, revision, now);
}

export function isCanvasExpansionV1(
  snapshot: PaintProjectSnapshotV1,
  input: CanvasResizeInputV1,
): boolean {
  const oldWidth = snapshot.document.canvas.width;
  const oldHeight = snapshot.document.canvas.height;
  return (
    input.width >= oldWidth &&
    input.height >= oldHeight &&
    input.offsetX >= 0 &&
    input.offsetY >= 0 &&
    input.offsetX + oldWidth <= input.width &&
    input.offsetY + oldHeight <= input.height &&
    (input.width > oldWidth || input.height > oldHeight || input.offsetX > 0 || input.offsetY > 0)
  );
}

export function projectedTouchedTilesForSnapshotV1(snapshot: PaintProjectSnapshotV1): number {
  const dabs = snapshot.committedStrokes.flatMap((completed) => completed.dabs);
  return planBaselineBrushTilesV1(
    dabs,
    snapshot.document.canvas.width,
    snapshot.document.canvas.height,
  ).length;
}
''')

replace_once(
    'src/app/paint-history-controller.ts',
    "import { parseRevision } from '../domain/identity.js';",
    "import { parseRevision, type Revision } from '../domain/identity.js';",
)
replace_once(
    'src/app/paint-history-controller.ts',
    "  commitDocumentSettings(input: PaintDocumentSettingsUpdateV1): HistoryTransactionV1 {",
    "  async commitSnapshotTransform(\n    commandId: string,\n    transform: (before: ReturnType<PaintSessionControllerV1['projectSnapshot']> extends infer Snapshot ? Exclude<Snapshot, null> : never, revision: Revision) => ReturnType<PaintSessionControllerV1['projectSnapshot']> extends infer Snapshot ? Exclude<Snapshot, null> : never,\n  ): Promise<HistoryTransactionV1> {\n    const before = this.#session.projectSnapshot();\n    if (before === null) throw new Error('document transform history requires an active document');\n    if (this.#revisionHighWater >= Number.MAX_SAFE_INTEGER) {\n      throw new RangeError('paint document revision high-water is exhausted');\n    }\n    const afterRevision = parseRevision(Math.max(this.#revisionHighWater, before.document.revision) + 1);\n    const after = transform(before, afterRevision);\n    if (after.document.documentId !== before.document.documentId || after.document.projectId !== before.document.projectId) {\n      throw new Error('document transform must preserve project/document identity');\n    }\n    if (after.document.revision !== afterRevision) {\n      throw new Error('document transform must use the assigned revision');\n    }\n    const transaction = createHistoryTransactionV1({\n      transactionId: crypto.randomUUID(),\n      commandId,\n      beforeRevision: before.document.revision,\n      afterRevision,\n      payload: createHistoryPayloadV1({ strategy: 'object-before-after', before, after }),\n    });\n    await this.#session.restoreProjectSnapshot(after);\n    this.#spine.commit(transaction);\n    this.#revisionHighWater = Math.max(this.#revisionHighWater, afterRevision);\n    return transaction;\n  }\n\n  commitDocumentSettings(input: PaintDocumentSettingsUpdateV1): HistoryTransactionV1 {",
)

Path('src/app/document-geometry-workflow-controller.ts').write_text(r'''import type { DocumentV1 } from '../domain/document.js';
import type { CanvasAdmissionControllerV1 } from './canvas-admission-controller.js';
import {
  cropCanvasSnapshotV1,
  isCanvasExpansionV1,
  projectedTouchedTilesForSnapshotV1,
  resizeCanvasSnapshotV1,
  trimTransparentCanvasSnapshotV1,
} from './document-geometry.js';
import type { PaintHistoryControllerV1 } from './paint-history-controller.js';
import type { PaintPersistenceControllerV1 } from './paint-persistence-controller.js';
import type { PaintSessionControllerV1 } from './paint-session-controller.js';

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
  const resizeButton = required<HTMLButtonElement>('#canvas-resize');
  const cropButton = required<HTMLButtonElement>('#canvas-crop');
  const trimButton = required<HTMLButtonElement>('#canvas-trim');
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
  const status = required<HTMLOutputElement>('#canvas-geometry-status');
  const submit = required<HTMLButtonElement>('#canvas-geometry-submit');
  const cancel = required<HTMLButtonElement>('#canvas-geometry-cancel');

  const show = (): void => {
    status.value = '';
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
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
    submit.textContent = 'クロップ';
    show();
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
        const admission = await options.canvasAdmission.preflight({
          width: preview.document.canvas.width,
          height: preview.document.canvas.height,
          precision: preview.document.color.precision,
          projectedTouchedTiles: projectedTouchedTilesForSnapshotV1(preview),
          operationScratchBytes: 0,
        });
        if (!admission.allowed) throw new Error(`trim rejected: ${admission.reasons.join(', ')}`);
        const transaction = await options.paintHistory.commitSnapshotTransform(
          'document.canvas.trim',
          (before, revision) => trimTransparentCanvasSnapshotV1(before, revision),
        );
        await options.paintPersistence.markDirty(transaction.transactionId);
        const documentValue = options.paintSession.currentDocument();
        if (documentValue !== null) options.onDocumentChanged(documentValue);
        options.onHistoryChanged();
      } catch (error) {
        root.dataset.illustroCanvasGeometryError = error instanceof Error ? error.message : String(error);
      }
    });
  };

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
        const x = integer(xInput, mode === 'crop' ? 'crop x' : 'offset x');
        const y = integer(yInput, mode === 'crop' ? 'crop y' : 'offset y');
        const width = integer(widthInput, 'width');
        const height = integer(heightInput, 'height');
        const previewRevision = (current.document.revision + 1) as typeof current.document.revision;
        const preview =
          mode === 'crop'
            ? cropCanvasSnapshotV1(current, { x, y, width, height }, previewRevision)
            : resizeCanvasSnapshotV1(
                current,
                { width, height, offsetX: x, offsetY: y },
                previewRevision,
              );
        const admission = await options.canvasAdmission.preflight({
          width,
          height,
          precision: preview.document.color.precision,
          projectedTouchedTiles: projectedTouchedTilesForSnapshotV1(preview),
          operationScratchBytes: 0,
        });
        if (!admission.allowed) {
          status.value = `実行できません: ${admission.reasons.join(', ')}`;
          return;
        }
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
        await options.paintPersistence.markDirty(transaction.transactionId);
        const documentValue = options.paintSession.currentDocument();
        if (documentValue !== null) options.onDocumentChanged(documentValue);
        options.onHistoryChanged();
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
  resizeButton.addEventListener('click', openResize);
  cropButton.addEventListener('click', openCrop);
  trimButton.addEventListener('click', runTrim);
  form.addEventListener('submit', onSubmit);
  cancel.addEventListener('click', onCancel);
  root.dataset.illustroCanvasGeometry = 'ready';

  return Object.freeze({
    schema: 'illustro.document-geometry-workflow/1' as const,
    dispose(): void {
      resizeButton.removeEventListener('click', openResize);
      cropButton.removeEventListener('click', openCrop);
      trimButton.removeEventListener('click', runTrim);
      form.removeEventListener('submit', onSubmit);
      cancel.removeEventListener('click', onCancel);
      root.dataset.illustroCanvasGeometry = 'disposed';
    },
  });
}
''')

replace_once(
    'src/index.html',
    '<button id="document-settings" type="button">ドキュメント設定…</button>',
    '<button id="document-settings" type="button">ドキュメント設定…</button>\n              <button id="canvas-resize" type="button">キャンバスサイズ…</button>\n              <button id="canvas-crop" type="button">クロップ…</button>\n              <button id="canvas-trim" type="button">透明部分をトリミング</button>',
)
replace_once(
    'src/index.html',
    '    <script type="module" src="./app/main.js"></script>',
    '''    <dialog id="canvas-geometry-dialog" class="document-dialog" aria-labelledby="canvas-geometry-title">
      <form id="canvas-geometry-form" method="dialog" class="document-dialog-form">
        <header><h2 id="canvas-geometry-title">キャンバスサイズ</h2></header>
        <div class="document-dialog-grid">
          <label id="canvas-geometry-x-row"><span id="canvas-geometry-x-label">内容オフセット X</span><input id="canvas-geometry-x" type="number" step="1" value="0" /></label>
          <label id="canvas-geometry-y-row"><span id="canvas-geometry-y-label">内容オフセット Y</span><input id="canvas-geometry-y" type="number" step="1" value="0" /></label>
          <span></span>
          <label>幅 <input id="canvas-geometry-width" type="number" min="1" max="32768" step="1" /></label>
          <label>高さ <input id="canvas-geometry-height" type="number" min="1" max="32768" step="1" /></label>
        </div>
        <p class="document-dialog-help">オフセットは既存内容を新しいキャンバス座標へ移動します。大きくする場合は余白追加として扱われます。</p>
        <output id="canvas-geometry-status" class="document-dialog-status" aria-live="polite"></output>
        <footer>
          <button id="canvas-geometry-cancel" type="button" class="document-dialog-secondary">キャンセル</button>
          <button id="canvas-geometry-submit" type="submit" class="document-dialog-primary">適用</button>
        </footer>
      </form>
    </dialog>
    <script type="module" src="./app/main.js"></script>''',
)

Path('public/app-shell.css').write_text(Path('public/app-shell.css').read_text() + r'''

.document-dialog-help {
  margin: -4px 0 0;
  color: #75829a;
  font-size: 12px;
  line-height: 1.5;
}
''')

replace_once(
    'src/app/main.ts',
    "import { installDocumentWorkflowControllerV1 } from './document-workflow-controller.js';",
    "import { installDocumentWorkflowControllerV1 } from './document-workflow-controller.js';\nimport { installDocumentGeometryWorkflowControllerV1 } from './document-geometry-workflow-controller.js';",
)
replace_once(
    'src/app/main.ts',
    "const documentWorkflow = installDocumentWorkflowControllerV1({\n  root,\n  canvasAdmission,\n  paintSession,\n  paintHistory,\n  paintPersistence,\n  schedule: enqueuePaintRender,\n  onDocumentChanged: publishDocumentState,\n  onHistoryChanged: publishPaintHistory,\n});",
    "const documentWorkflow = installDocumentWorkflowControllerV1({\n  root,\n  canvasAdmission,\n  paintSession,\n  paintHistory,\n  paintPersistence,\n  schedule: enqueuePaintRender,\n  onDocumentChanged: publishDocumentState,\n  onHistoryChanged: publishPaintHistory,\n});\n\nconst documentGeometryWorkflow = installDocumentGeometryWorkflowControllerV1({\n  root,\n  canvasAdmission,\n  paintSession,\n  paintHistory,\n  paintPersistence,\n  schedule: enqueuePaintRender,\n  onDocumentChanged: publishDocumentState,\n  onHistoryChanged: publishPaintHistory,\n});",
)
replace_once(
    'src/app/main.ts',
    "    documentWorkflow.dispose();\n    pointerInput.dispose();",
    "    documentGeometryWorkflow.dispose();\n    documentWorkflow.dispose();\n    pointerInput.dispose();",
)

Path('tests/unit/document-geometry.test.ts').write_text(r'''import { describe, expect, it } from 'vitest';
import { createDocumentV1 } from '../../src/domain/document.js';
import { createRasterLayer } from '../../src/domain/layers.js';
import type { Revision } from '../../src/domain/identity.js';
import {
  cropCanvasSnapshotV1,
  isCanvasExpansionV1,
  resizeCanvasSnapshotV1,
  transparentContentBoundsV1,
  trimTransparentCanvasSnapshotV1,
} from '../../src/app/document-geometry.js';
import type {
  CompletedPaintStrokeV1,
  PaintProjectSnapshotV1,
} from '../../src/app/paint-session-controller.js';

function snapshot(
  dabs: readonly { x: number; y: number; radius: number; opacity?: number }[] = [],
  width = 100,
  height = 80,
  solid = false,
): PaintProjectSnapshotV1 {
  const base = createDocumentV1({
    width,
    height,
    background: solid ? { kind: 'solid', rgba: [1, 1, 1, 1] } : { kind: 'transparent' },
  });
  const layer = createRasterLayer({ name: 'Layer 1' });
  const document = Object.freeze({
    ...base,
    layerTree: Object.freeze({ rootLayerIds: Object.freeze([layer.id]), layers: Object.freeze({ [layer.id]: layer }) }),
  });
  const completed: CompletedPaintStrokeV1[] = dabs.length === 0 ? [] : [Object.freeze({
    stroke: Object.freeze({
      schema: 'illustro.paint-stroke/1' as const,
      strokeId: crypto.randomUUID(),
      pointerId: 1,
      source: 'pen' as const,
      layerId: layer.id,
      samples: Object.freeze([
        Object.freeze({
          schema: 'illustro.paint-stroke-sample/1' as const,
          sequence: 0,
          timestampMs: 1,
          documentX: dabs[0]?.x ?? 0,
          documentY: dabs[0]?.y ?? 0,
          pressure: 1,
          tangentialPressure: 0,
          tiltX: 0,
          tiltY: 0,
          twist: 0,
          altitudeAngle: null,
          azimuthAngle: null,
        }),
      ]),
    }),
    dabs: Object.freeze(dabs.map((dab) => Object.freeze({
      schema: 'illustro.baseline-brush-dab/1' as const,
      x: dab.x,
      y: dab.y,
      radius: dab.radius,
      opacity: dab.opacity ?? 1,
    }))),
  })];
  return Object.freeze({ schema: 'illustro.paint-project-snapshot/1' as const, document, committedStrokes: Object.freeze(completed) });
}

const revision = (value: number) => value as Revision;

describe('M5A canvas geometry', () => {
  it('resizes/expands canvas by translating canonical stroke data', () => {
    const before = snapshot([{ x: 20, y: 30, radius: 5 }]);
    const input = { width: 140, height: 100, offsetX: 10, offsetY: 8 };
    expect(isCanvasExpansionV1(before, input)).toBe(true);
    const after = resizeCanvasSnapshotV1(before, input, revision(1), new Date('2026-01-01T00:00:00Z'));
    expect(after.document.canvas).toMatchObject({ width: 140, height: 100 });
    expect(after.committedStrokes[0]?.dabs[0]).toMatchObject({ x: 30, y: 38, radius: 5 });
    expect(after.committedStrokes[0]?.stroke.samples[0]).toMatchObject({ documentX: 30, documentY: 38 });
  });

  it('clips fully excluded dabs when shrinking and cropping', () => {
    const before = snapshot([
      { x: 15, y: 15, radius: 4 },
      { x: 90, y: 70, radius: 3 },
    ]);
    const cropped = cropCanvasSnapshotV1(before, { x: 10, y: 10, width: 40, height: 30 }, revision(1));
    expect(cropped.document.canvas).toMatchObject({ width: 40, height: 30 });
    expect(cropped.committedStrokes[0]?.dabs).toHaveLength(1);
    expect(cropped.committedStrokes[0]?.dabs[0]).toMatchObject({ x: 5, y: 5 });
  });

  it('computes and applies transparent trim bounds', () => {
    const before = snapshot([{ x: 50, y: 30, radius: 5 }]);
    expect(transparentContentBoundsV1(before)).toEqual({ x: 45, y: 25, width: 10, height: 10 });
    const after = trimTransparentCanvasSnapshotV1(before, revision(1));
    expect(after.document.canvas).toMatchObject({ width: 10, height: 10 });
    expect(after.committedStrokes[0]?.dabs[0]).toMatchObject({ x: 5, y: 5 });
  });

  it('does not pretend a colored background has transparent trim borders', () => {
    const before = snapshot([{ x: 50, y: 30, radius: 5 }], 100, 80, true);
    expect(transparentContentBoundsV1(before)).toBeNull();
    expect(() => trimTransparentCanvasSnapshotV1(before, revision(1))).toThrow(/transparent/);
  });
});
''')

Path('tests/unit/document-geometry-history.test.ts').write_text(r'''import { describe, expect, it } from 'vitest';
import { PaintHistoryControllerV1 } from '../../src/app/paint-history-controller.js';
import { resizeCanvasSnapshotV1 } from '../../src/app/document-geometry.js';
import { PaintSessionControllerV1 } from '../../src/app/paint-session-controller.js';
import type { BaselineBrushDabV1 } from '../../src/gpu/baseline-brush.js';

class Renderer {
  async configureDocument(): Promise<void> {}
  async restoreBaselineStrokes(
    _strokes: readonly { readonly strokeId: string; readonly dabs: readonly BaselineBrushDabV1[] }[],
  ): Promise<void> {}
}

describe('M5A geometry history', () => {
  it('commits canvas resize as one exact undo/redo transaction', async () => {
    const session = new PaintSessionControllerV1(new Renderer());
    await session.createNewDocument({ width: 100, height: 80 });
    const history = new PaintHistoryControllerV1(session);
    history.reset();
    const transaction = await history.commitSnapshotTransform(
      'document.canvas.resize',
      (before, revision) =>
        resizeCanvasSnapshotV1(before, { width: 120, height: 90, offsetX: 10, offsetY: 5 }, revision),
    );
    expect(transaction.commandId).toBe('document.canvas.resize');
    expect(session.currentDocument()?.canvas).toMatchObject({ width: 120, height: 90 });
    expect(history.snapshot()).toMatchObject({ length: 1, cursor: 1 });
    expect(await history.undo()).toBe(true);
    expect(session.currentDocument()?.canvas).toMatchObject({ width: 100, height: 80 });
    expect(await history.redo()).toBe(true);
    expect(session.currentDocument()?.canvas).toMatchObject({ width: 120, height: 90 });
  });
});
''')

verify = Path('scripts/verify-m5a-document-foundation.mjs').read_text()
verify = verify.replace(
    "const presets = read('src/domain/document-presets.ts');",
    "const presets = read('src/domain/document-presets.ts');\nconst geometry = read('src/app/document-geometry.ts');\nconst geometryWorkflow = read('src/app/document-geometry-workflow-controller.ts');",
)
verify = verify.replace(
    "required(presets, 'uhd-4k', 'screen preset');\n\nconsole.log('M5A document foundation verification passed');",
    "required(presets, 'uhd-4k', 'screen preset');\nrequired(geometry, 'resizeCanvasSnapshotV1', 'canvas resize operation');\nrequired(geometry, 'cropCanvasSnapshotV1', 'crop operation');\nrequired(geometry, 'trimTransparentCanvasSnapshotV1', 'trim operation');\nrequired(geometry, 'isCanvasExpansionV1', 'canvas expansion classification');\nrequired(geometryWorkflow, 'canvasAdmission.preflight', 'geometry admission preflight');\nrequired(geometryWorkflow, 'commitSnapshotTransform', 'geometry history transaction path');\nrequired(html, 'id=\"canvas-resize\"', 'canvas resize UI');\nrequired(html, 'id=\"canvas-crop\"', 'crop UI');\nrequired(html, 'id=\"canvas-trim\"', 'trim UI');\n\nconsole.log('M5A document/canvas foundation verification passed');",
)
Path('scripts/verify-m5a-document-foundation.mjs').write_text(verify)
