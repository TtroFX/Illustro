import type { SelectionCombineModeV1 } from './selection-combine-engine.js';
import { applyPreparedSelectionModeV1 } from './selection-combine-engine.js';
import type { M8SelectionContextLayerHandleV1 } from './m8-selection-context-layer.js';
import type { PaintPersistenceControllerV1 } from './paint-persistence-controller.js';
import type { PaintSessionControllerV1 } from './paint-session-controller.js';
import {
  prepareLassoSelectionV1,
  prepareRectangularSelectionV1,
  type SelectionPointV1,
} from './selection-shape-engine.js';
import type { SelectionCoverageControllerV1 } from './selection-coverage-controller.js';
import type { ViewportControllerV1 } from './viewport-controller.js';

export type M8SelectionToolV1 = 'rectangle' | 'lasso';
export type M8SelectionModeV1 = SelectionCombineModeV1;

export const M8_SELECTION_MODE_STORAGE_KEY_V1 = 'illustro.m8.selection-mode.v1' as const;
export const M8_SELECTION_LASSO_SAMPLE_DISTANCE_PX_V1 = 2;

export interface M8SelectionGestureHandleV1 {
  activeTool(): M8SelectionToolV1 | null;
  setActiveTool(tool: M8SelectionToolV1 | null): void;
  mode(): M8SelectionModeV1;
  setMode(mode: M8SelectionModeV1): void;
  dispose(): void;
}

interface CapturedSelectionPointV1 {
  readonly document: SelectionPointV1;
  readonly stageX: number;
  readonly stageY: number;
}

function isSelectionModeV1(value: string | null): value is M8SelectionModeV1 {
  return value === 'replace' || value === 'add' || value === 'subtract' || value === 'intersect';
}

export function resolveSelectionModeForPointerV1(
  persistentMode: M8SelectionModeV1,
  input: Pick<PointerEvent, 'shiftKey' | 'altKey'>,
): M8SelectionModeV1 {
  if (input.shiftKey && input.altKey) return 'intersect';
  if (input.shiftKey) return 'add';
  if (input.altKey) return 'subtract';
  return persistentMode;
}

export function lassoHasNonZeroAreaV1(points: readonly SelectionPointV1[]): boolean {
  const unique = new Map<string, SelectionPointV1>();
  for (const point of points) unique.set(`${point.x}:${point.y}`, point);
  const normalized = [...unique.values()];
  if (normalized.length < 3) return false;
  const origin = normalized[0];
  if (!origin) return false;
  for (let leftIndex = 1; leftIndex < normalized.length - 1; leftIndex += 1) {
    const left = normalized[leftIndex];
    if (!left) continue;
    for (let rightIndex = leftIndex + 1; rightIndex < normalized.length; rightIndex += 1) {
      const right = normalized[rightIndex];
      if (!right) continue;
      const cross =
        (left.x - origin.x) * (right.y - origin.y) - (left.y - origin.y) * (right.x - origin.x);
      if (Math.abs(cross) > Number.EPSILON) return true;
    }
  }
  return false;
}

function safeStorageV1(): Storage | null {
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

function createModePanelV1(): HTMLElement {
  const panel = document.createElement('section');
  panel.className = 'm8e-selection-tool-properties';
  panel.hidden = true;
  panel.innerHTML = `<div class="m8e-selection-tool-heading"><span data-m8e-selection-tool-name>選択</span><small>選択モード</small></div>
    <div class="m8e-selection-mode-control" role="group" aria-label="選択モード">
      <button type="button" data-m8e-selection-mode="replace" aria-label="新規選択">新規</button>
      <button type="button" data-m8e-selection-mode="add" aria-label="選択範囲に追加">追加</button>
      <button type="button" data-m8e-selection-mode="subtract" aria-label="選択範囲から削除">削除</button>
      <button type="button" data-m8e-selection-mode="intersect" aria-label="選択範囲との共通部分">共通</button>
    </div>
    <small class="m8e-selection-modifier-note">Shift: 追加 / Alt: 削除 / Shift+Alt: 共通</small>`;
  return panel;
}

export function installM8SelectionGestureControllerV1(input: {
  readonly root: HTMLElement;
  readonly context: M8SelectionContextLayerHandleV1;
  readonly paintSession: PaintSessionControllerV1;
  readonly paintPersistence: PaintPersistenceControllerV1;
  readonly selectionCoverage: SelectionCoverageControllerV1;
  readonly viewport: ViewportControllerV1;
}): M8SelectionGestureHandleV1 {
  const { shell, stage, overlay } = input.context;
  const selectionButton = shell.querySelector<HTMLButtonElement>('[data-m8c-family="selection"]');
  const lassoButton = shell.querySelector<HTMLButtonElement>('[data-m8c-entry="lasso-direct"]');
  const rail = shell.querySelector<HTMLElement>('.m8-tool-rail');
  const toolPropertiesBody = shell.querySelector<HTMLElement>(
    '[data-m8d-block="tool-properties"] .m8d-tool-properties',
  );

  const preview = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  preview.classList.add('m8e-selection-drag-preview');
  preview.setAttribute('aria-hidden', 'true');
  preview.setAttribute('hidden', '');
  const previewPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  preview.append(previewPath);
  overlay.append(preview);

  const modePanel = createModePanelV1();
  toolPropertiesBody?.prepend(modePanel);

  const storage = safeStorageV1();
  const storedMode = storage?.getItem(M8_SELECTION_MODE_STORAGE_KEY_V1) ?? null;
  let persistentMode: M8SelectionModeV1 = isSelectionModeV1(storedMode) ? storedMode : 'replace';
  let activeTool: M8SelectionToolV1 | null = null;
  let activePointerId: number | null = null;
  let gestureMode: M8SelectionModeV1 = persistentMode;
  let rectangleStart: CapturedSelectionPointV1 | null = null;
  let rectangleEnd: CapturedSelectionPointV1 | null = null;
  const lassoPoints: CapturedSelectionPointV1[] = [];

  const publishMode = (): void => {
    input.root.dataset.illustroSelectionMode = persistentMode;
    for (const button of modePanel.querySelectorAll<HTMLButtonElement>(
      '[data-m8e-selection-mode]',
    )) {
      const pressed = button.dataset.m8eSelectionMode === persistentMode;
      button.setAttribute('aria-pressed', String(pressed));
    }
  };

  const publishTool = (): void => {
    input.root.dataset.illustroSelectionTool = activeTool ?? 'none';
    selectionButton?.setAttribute('aria-pressed', String(activeTool === 'rectangle'));
    lassoButton?.setAttribute('aria-pressed', String(activeTool === 'lasso'));
    modePanel.hidden = activeTool === null;
    const label = modePanel.querySelector<HTMLElement>('[data-m8e-selection-tool-name]');
    if (label) label.textContent = activeTool === 'lasso' ? '投げ縄選択' : '矩形選択';
  };

  const setMode = (mode: M8SelectionModeV1): void => {
    persistentMode = mode;
    try {
      storage?.setItem(M8_SELECTION_MODE_STORAGE_KEY_V1, mode);
    } catch {
      // Selection mode persistence is best-effort and never blocks input.
    }
    publishMode();
  };

  const setActiveTool = (tool: M8SelectionToolV1 | null): void => {
    activeTool = tool;
    publishTool();
  };

  const capturePoint = (
    event: Pick<PointerEvent, 'clientX' | 'clientY'>,
  ): CapturedSelectionPointV1 | null => {
    const documentValue = input.paintSession.currentDocument();
    if (!documentValue) return null;
    const stageRect = stage.getBoundingClientRect();
    return Object.freeze({
      document: input.viewport.mapPointerToDocument(event, documentValue),
      stageX: event.clientX - stageRect.left,
      stageY: event.clientY - stageRect.top,
    });
  };

  const resetGesture = (): void => {
    activePointerId = null;
    rectangleStart = null;
    rectangleEnd = null;
    lassoPoints.length = 0;
    preview.setAttribute('hidden', '');
    previewPath.setAttribute('d', '');
    input.root.dataset.illustroSelectionGesture = 'idle';
  };

  const updatePreview = (): void => {
    if (activeTool === 'rectangle' && rectangleStart && rectangleEnd) {
      const minX = Math.min(rectangleStart.stageX, rectangleEnd.stageX);
      const minY = Math.min(rectangleStart.stageY, rectangleEnd.stageY);
      const maxX = Math.max(rectangleStart.stageX, rectangleEnd.stageX);
      const maxY = Math.max(rectangleStart.stageY, rectangleEnd.stageY);
      previewPath.setAttribute('d', `M ${minX} ${minY} H ${maxX} V ${maxY} H ${minX} Z`);
      return;
    }
    if (activeTool === 'lasso' && lassoPoints.length > 0) {
      previewPath.setAttribute(
        'd',
        `M ${lassoPoints.map((point) => `${point.stageX} ${point.stageY}`).join(' L ')}`,
      );
    }
  };

  const beginSelection = (event: PointerEvent): void => {
    if (activeTool === null || event.button !== 0) return;
    if (event.target instanceof Element && event.target.closest('.m8e-selection-launcher')) return;
    const captured = capturePoint(event);
    if (!captured) return;
    activePointerId = event.pointerId;
    gestureMode = resolveSelectionModeForPointerV1(persistentMode, event);
    if (activeTool === 'rectangle') {
      rectangleStart = captured;
      rectangleEnd = captured;
    } else {
      lassoPoints.length = 0;
      lassoPoints.push(captured);
    }
    preview.removeAttribute('hidden');
    stage.setPointerCapture?.(event.pointerId);
    input.root.dataset.illustroSelectionGesture = 'active';
    input.root.dataset.illustroSelectionGestureMode = gestureMode;
    updatePreview();
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  };

  const appendLassoSample = (event: PointerEvent): void => {
    const captured = capturePoint(event);
    if (!captured) return;
    const previous = lassoPoints.at(-1);
    if (
      previous &&
      Math.hypot(captured.stageX - previous.stageX, captured.stageY - previous.stageY) <
        M8_SELECTION_LASSO_SAMPLE_DISTANCE_PX_V1
    ) {
      return;
    }
    lassoPoints.push(captured);
  };

  const moveSelection = (event: PointerEvent): void => {
    if (event.pointerId !== activePointerId || activeTool === null) return;
    if (activeTool === 'rectangle') {
      const captured = capturePoint(event);
      if (captured) rectangleEnd = captured;
    } else {
      const samples = event.getCoalescedEvents?.() ?? [];
      const accepted = samples.length > 0 ? samples : [event];
      for (const sample of accepted) appendLassoSample(sample);
    }
    updatePreview();
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  };

  const completeSelection = async (event: PointerEvent): Promise<void> => {
    if (event.pointerId !== activePointerId || activeTool === null) return;
    const tool = activeTool;
    const mode = gestureMode;
    if (tool === 'rectangle') {
      const captured = capturePoint(event);
      if (captured) rectangleEnd = captured;
    } else {
      appendLassoSample(event);
    }
    const start = rectangleStart;
    const end = rectangleEnd;
    const points = lassoPoints.map((point) => point.document);
    resetGesture();
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const documentValue = input.paintSession.currentDocument();
    if (!documentValue) return;
    try {
      const prepared =
        tool === 'rectangle'
          ? start &&
            end &&
            Math.abs(end.stageX - start.stageX) >= 2 &&
            Math.abs(end.stageY - start.stageY) >= 2
            ? await prepareRectangularSelectionV1(start.document, end.document, {
                documentWidth: documentValue.canvas.width,
                documentHeight: documentValue.canvas.height,
                revision: documentValue.revision,
                persistence: input.paintPersistence,
              })
            : null
          : lassoHasNonZeroAreaV1(points)
            ? await prepareLassoSelectionV1(points, {
                documentWidth: documentValue.canvas.width,
                documentHeight: documentValue.canvas.height,
                revision: documentValue.revision,
                persistence: input.paintPersistence,
              })
            : null;
      if (!prepared || (prepared.defaultCoverage === 0 && prepared.tiles.length === 0)) {
        input.context.announce('選択は変更されませんでした');
        return;
      }
      await applyPreparedSelectionModeV1(input.selectionCoverage, prepared, mode, {
        documentWidth: documentValue.canvas.width,
        documentHeight: documentValue.canvas.height,
        revision: documentValue.revision,
        storage: input.paintPersistence,
      });
      input.context.announce('選択範囲を更新しました');
    } catch (error) {
      input.context.announce(
        error instanceof Error ? error.message : '選択範囲を更新できませんでした',
      );
    }
  };

  const cancelSelection = (event: PointerEvent): void => {
    if (event.pointerId !== activePointerId) return;
    resetGesture();
    input.context.announce('選択操作をキャンセルしました');
  };

  const onModeClick = (event: Event): void => {
    const button =
      event.target instanceof Element
        ? event.target.closest<HTMLButtonElement>('[data-m8e-selection-mode]')
        : null;
    const mode = button?.dataset.m8eSelectionMode ?? null;
    if (isSelectionModeV1(mode)) setMode(mode);
  };

  const onRailClick = (event: Event): void => {
    const button =
      event.target instanceof Element
        ? event.target.closest<HTMLButtonElement>('.m8c-family-button')
        : null;
    if (!button) return;
    const entry = button.dataset.m8cEntry ?? button.dataset.m8cFamily ?? null;
    if (entry === 'lasso-direct') {
      setActiveTool('lasso');
      input.context.announce('投げ縄選択ツール');
    } else if (entry === 'selection') {
      setActiveTool('rectangle');
      input.context.announce('矩形選択ツール');
    } else {
      setActiveTool(null);
    }
  };

  const deactivateSelection = (): void => setActiveTool(null);
  const productionToolButtons = Array.from(
    document.querySelectorAll<HTMLButtonElement>(
      '#brush-mode-raster, #brush-mode-eraser, #brush-mode-smudge, #brush-mode-blur',
    ),
  );

  modePanel.addEventListener('click', onModeClick);
  rail?.addEventListener('click', onRailClick, true);
  for (const button of productionToolButtons) button.addEventListener('click', deactivateSelection);
  stage.addEventListener('pointerdown', beginSelection, true);
  stage.addEventListener('pointermove', moveSelection, true);
  const onPointerUp = (event: PointerEvent): void => void completeSelection(event);
  stage.addEventListener('pointerup', onPointerUp, true);
  stage.addEventListener('pointercancel', cancelSelection, true);

  publishMode();
  publishTool();

  return Object.freeze({
    activeTool: () => activeTool,
    setActiveTool,
    mode: () => persistentMode,
    setMode,
    dispose(): void {
      resetGesture();
      modePanel.removeEventListener('click', onModeClick);
      rail?.removeEventListener('click', onRailClick, true);
      for (const button of productionToolButtons)
        button.removeEventListener('click', deactivateSelection);
      stage.removeEventListener('pointerdown', beginSelection, true);
      stage.removeEventListener('pointermove', moveSelection, true);
      stage.removeEventListener('pointerup', onPointerUp, true);
      stage.removeEventListener('pointercancel', cancelSelection, true);
      preview.remove();
      modePanel.remove();
      delete input.root.dataset.illustroSelectionTool;
      delete input.root.dataset.illustroSelectionMode;
      delete input.root.dataset.illustroSelectionGesture;
      delete input.root.dataset.illustroSelectionGestureMode;
    },
  });
}
