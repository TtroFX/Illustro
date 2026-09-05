import { CANONICAL_TILE_SIZE_PX } from '../gpu/sparse-tile-model.js';
import type { ViewportControllerV1, ViewportSnapshotV1 } from './viewport-controller.js';
import {
  type RasterSelectionCoverageV1,
  type SelectionCoverageControllerV1,
} from './selection-coverage-controller.js';
import {
  applySelectionMorphologyV1,
  invertSelectionV1,
  type SelectionMorphologyOperationV1,
} from './selection-modifier-engine.js';
import {
  prepareLassoSelectionV1,
  prepareRectangularSelectionV1,
  type SelectionPointV1,
} from './selection-shape-engine.js';
import {
  prepareSelectionCopyV1,
  selectionCopyEligibilityV1,
} from './selection-copy-engine.js';
import type { SelectionTransferPayloadV1 } from './selection-cut-engine.js';
import type { PaintPersistenceControllerV1 } from './paint-persistence-controller.js';
import type { PaintSessionControllerV1 } from './paint-session-controller.js';

export type M8SelectionToolV1 = 'rectangle' | 'lasso';
export type M8SelectionLauncherCommandV1 =
  | 'transform'
  | 'cut'
  | 'copy'
  | 'clear'
  | 'invert'
  | 'feather'
  | 'expand'
  | 'shrink'
  | 'fill';

export const M8_SELECTION_LAUNCHER_MARGIN_V1 = 12;
export const M8_SELECTION_MORPHOLOGY_STEP_PX_V1 = 1;

export interface M8SelectionLauncherHandleV1 {
  readonly element: HTMLElement;
  activeTool(): M8SelectionToolV1 | null;
  setActiveTool(tool: M8SelectionToolV1 | null): void;
  clipboard(): SelectionTransferPayloadV1 | null;
  refresh(): void;
  dispose(): void;
}

interface DocumentBoundsV1 {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

interface StagePointV1 {
  readonly x: number;
  readonly y: number;
}

const STYLE_ID = 'm8-selection-launcher-style';

function ensureStylesheetV1(): HTMLLinkElement | null {
  if (typeof document === 'undefined') return null;
  const existing = document.getElementById(STYLE_ID);
  if (existing instanceof HTMLLinkElement) return existing;
  const link = document.createElement('link');
  link.id = STYLE_ID;
  link.rel = 'stylesheet';
  link.href = './m8-selection-launcher.css';
  document.head.append(link);
  return link;
}

function effectiveDefaultCoverageV1(coverage: RasterSelectionCoverageV1): 0 | 1 {
  return coverage.inverted ? (coverage.defaultCoverage === 1 ? 0 : 1) : coverage.defaultCoverage;
}

export function hasNonEmptySelectionV1(coverage: RasterSelectionCoverageV1 | null): boolean {
  if (coverage === null) return false;
  return effectiveDefaultCoverageV1(coverage) === 1 || coverage.tiles.length > 0;
}

export function selectionDocumentBoundsV1(
  coverage: RasterSelectionCoverageV1,
  documentWidth: number,
  documentHeight: number,
): DocumentBoundsV1 | null {
  if (effectiveDefaultCoverageV1(coverage) === 1) {
    return Object.freeze({ minX: 0, minY: 0, maxX: documentWidth, maxY: documentHeight });
  }
  if (coverage.tiles.length === 0) return null;
  let minTx = Number.POSITIVE_INFINITY;
  let minTy = Number.POSITIVE_INFINITY;
  let maxTx = Number.NEGATIVE_INFINITY;
  let maxTy = Number.NEGATIVE_INFINITY;
  for (const tile of coverage.tiles) {
    minTx = Math.min(minTx, tile.x);
    minTy = Math.min(minTy, tile.y);
    maxTx = Math.max(maxTx, tile.x);
    maxTy = Math.max(maxTy, tile.y);
  }
  return Object.freeze({
    minX: Math.max(0, minTx * CANONICAL_TILE_SIZE_PX),
    minY: Math.max(0, minTy * CANONICAL_TILE_SIZE_PX),
    maxX: Math.min(documentWidth, (maxTx + 1) * CANONICAL_TILE_SIZE_PX),
    maxY: Math.min(documentHeight, (maxTy + 1) * CANONICAL_TILE_SIZE_PX),
  });
}

function documentPointToStageV1(
  point: SelectionPointV1,
  viewport: ViewportSnapshotV1,
): StagePointV1 {
  const localX = (point.x / viewport.documentWidth - 0.5) * viewport.baseWidth;
  const localY = (point.y / viewport.documentHeight - 0.5) * viewport.baseHeight;
  const scaledX = localX * (viewport.mirrored ? -viewport.zoom : viewport.zoom);
  const scaledY = localY * viewport.zoom;
  const angle = (viewport.rotationDegrees * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return Object.freeze({
    x: viewport.stageWidth / 2 + viewport.panX + cos * scaledX - sin * scaledY,
    y: viewport.stageHeight / 2 + viewport.panY + sin * scaledX + cos * scaledY,
  });
}

export function projectSelectionBoundsToStageV1(
  bounds: DocumentBoundsV1,
  viewport: ViewportSnapshotV1,
): DocumentBoundsV1 {
  const points = [
    documentPointToStageV1({ x: bounds.minX, y: bounds.minY }, viewport),
    documentPointToStageV1({ x: bounds.maxX, y: bounds.minY }, viewport),
    documentPointToStageV1({ x: bounds.maxX, y: bounds.maxY }, viewport),
    documentPointToStageV1({ x: bounds.minX, y: bounds.maxY }, viewport),
  ];
  return Object.freeze({
    minX: Math.min(...points.map((point) => point.x)),
    minY: Math.min(...points.map((point) => point.y)),
    maxX: Math.max(...points.map((point) => point.x)),
    maxY: Math.max(...points.map((point) => point.y)),
  });
}

function selectionSignatureV1(coverage: RasterSelectionCoverageV1): string {
  return [
    coverage.sourceRevision,
    coverage.defaultCoverage,
    coverage.inverted ? 1 : 0,
    ...coverage.tiles.map((tile) => `${tile.x}:${tile.y}:${tile.payloadRef}`),
  ].join('|');
}

function createButtonV1(
  command: M8SelectionLauncherCommandV1,
  label: string,
  glyph: string,
  availability: 'available' | 'partial' | 'planned' = 'available',
): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.m8eCommand = command;
  button.dataset.productionState = availability;
  button.setAttribute('aria-label', label);
  button.title = label;
  button.innerHTML = `<span aria-hidden="true">${glyph}</span>`;
  if (availability === 'planned') button.disabled = true;
  return button;
}

export function installM8SelectionLauncherV1(input: {
  readonly root: HTMLElement;
  readonly paintSession: PaintSessionControllerV1;
  readonly paintPersistence: PaintPersistenceControllerV1;
  readonly selectionCoverage: SelectionCoverageControllerV1;
  readonly viewport: ViewportControllerV1;
}): M8SelectionLauncherHandleV1 {
  const stylesheet = ensureStylesheetV1();
  const shell = document.querySelector<HTMLElement>('#m8-canonical-shell');
  const stage = shell?.querySelector<HTMLElement>('.m8-canvas-stage');
  const frame = stage?.querySelector<HTMLElement>('#canvas-viewport-frame');
  if (!shell || !stage || !frame) throw new Error('M8E requires the canonical canvas workspace.');

  const overlay = document.createElement('div');
  overlay.className = 'm8e-context-layer';
  overlay.dataset.m8eContextLayer = 'true';

  const selectionBounds = document.createElement('div');
  selectionBounds.className = 'm8e-selection-bounds';
  selectionBounds.hidden = true;
  selectionBounds.setAttribute('aria-hidden', 'true');

  const dragPreview = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  dragPreview.classList.add('m8e-selection-drag-preview');
  dragPreview.setAttribute('aria-hidden', 'true');
  dragPreview.hidden = true;
  const dragPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  dragPreview.append(dragPath);

  const launcher = document.createElement('div');
  launcher.className = 'm8e-selection-launcher';
  launcher.hidden = true;
  launcher.setAttribute('role', 'toolbar');
  launcher.setAttribute('aria-label', '選択範囲の操作');
  launcher.append(
    createButtonV1('transform', '変形（M7C接続後に利用可能）', '↗', 'planned'),
    createButtonV1('cut', '切り取り（History接続後に利用可能）', '✂', 'planned'),
    createButtonV1('copy', 'コピー', '⧉', 'partial'),
    createButtonV1('clear', '選択解除', '×'),
    createButtonV1('invert', '選択範囲を反転', '◐'),
    createButtonV1('fill', '塗りつぶし（M7B接続後に利用可能）', '▣', 'planned'),
  );

  const more = document.createElement('details');
  more.className = 'm8e-selection-more';
  const moreSummary = document.createElement('summary');
  moreSummary.setAttribute('aria-label', '選択範囲を調整');
  moreSummary.title = '選択範囲を調整';
  moreSummary.textContent = '•••';
  const morePanel = document.createElement('div');
  morePanel.className = 'm8e-selection-more-panel';
  morePanel.append(
    createButtonV1('feather', `境界をぼかす ${M8_SELECTION_MORPHOLOGY_STEP_PX_V1}px`, '◌'),
    createButtonV1('expand', `選択範囲を拡張 ${M8_SELECTION_MORPHOLOGY_STEP_PX_V1}px`, '⊕'),
    createButtonV1('shrink', `選択範囲を縮小 ${M8_SELECTION_MORPHOLOGY_STEP_PX_V1}px`, '⊖'),
  );
  more.append(moreSummary, morePanel);

  const dismiss = document.createElement('button');
  dismiss.type = 'button';
  dismiss.className = 'm8e-selection-dismiss';
  dismiss.dataset.m8eDismiss = 'true';
  dismiss.setAttribute('aria-label', 'Selection Launcherを閉じる');
  dismiss.title = '閉じる';
  dismiss.textContent = '×';
  launcher.append(more, dismiss);

  const live = document.createElement('div');
  live.className = 'm8e-sr-only';
  live.setAttribute('aria-live', 'polite');

  const transformHost = document.createElement('div');
  transformHost.className = 'm8e-context-host';
  transformHost.dataset.m8eContext = 'transform';
  transformHost.dataset.productionState = 'planned';
  transformHost.hidden = true;
  const rulerHost = document.createElement('div');
  rulerHost.className = 'm8e-context-host';
  rulerHost.dataset.m8eContext = 'ruler';
  rulerHost.dataset.productionState = 'planned';
  rulerHost.hidden = true;
  const lineartHost = document.createElement('div');
  lineartHost.className = 'm8e-context-host';
  lineartHost.dataset.m8eContext = 'lineart';
  lineartHost.dataset.productionState = 'planned';
  lineartHost.hidden = true;

  overlay.append(
    selectionBounds,
    dragPreview,
    launcher,
    live,
    transformHost,
    rulerHost,
    lineartHost,
  );
  stage.append(overlay);
  shell.dataset.m8eState = 'provisional';

  const selectionButton = shell.querySelector<HTMLButtonElement>('[data-m8c-family="selection"]');
  const lassoButton = shell.querySelector<HTMLButtonElement>('[data-m8c-entry="lasso-direct"]');
  if (selectionButton) selectionButton.dataset.productionState = 'partial';
  if (lassoButton) lassoButton.dataset.productionState = 'partial';

  let activeTool: M8SelectionToolV1 | null = null;
  let clipboard: SelectionTransferPayloadV1 | null = null;
  let dismissedSignature: string | null = null;
  let activePointerId: number | null = null;
  let dragStart: StagePointV1 | null = null;
  let dragCurrent: StagePointV1 | null = null;
  const lassoClientPoints: SelectionPointV1[] = [];
  let commandBusy = false;

  const announce = (message: string): void => {
    live.textContent = message;
  };

  const setActiveTool = (tool: M8SelectionToolV1 | null): void => {
    activeTool = tool;
    input.root.dataset.illustroSelectionTool = tool ?? 'none';
    selectionButton?.setAttribute('aria-pressed', String(tool === 'rectangle'));
    lassoButton?.setAttribute('aria-pressed', String(tool === 'lasso'));
  };

  const coverageSnapshot = (): RasterSelectionCoverageV1 | null =>
    input.selectionCoverage.snapshot().coverage;

  const refreshCommandAvailability = (): void => {
    const coverage = coverageSnapshot();
    const snapshot = input.paintSession.projectSnapshot();
    const activeLayerId = input.paintSession.snapshot().activeLayerId;
    const copyButton = launcher.querySelector<HTMLButtonElement>('[data-m8e-command="copy"]');
    if (!copyButton) return;
    const eligibility =
      snapshot !== null && activeLayerId !== null
        ? selectionCopyEligibilityV1(snapshot, activeLayerId, coverage)
        : null;
    copyButton.disabled = eligibility?.eligible !== true;
    copyButton.dataset.productionState = eligibility?.eligible === true ? 'available' : 'partial';
  };

  const reposition = (): void => {
    const coverage = coverageSnapshot();
    const documentValue = input.paintSession.currentDocument();
    const drawing = input.root.dataset.illustroPaintStroke;
    const visible =
      documentValue !== null &&
      coverage !== null &&
      hasNonEmptySelectionV1(coverage) &&
      drawing !== 'active' &&
      drawing !== 'pending-commit' &&
      dismissedSignature !== selectionSignatureV1(coverage);
    selectionBounds.hidden = !visible;
    launcher.hidden = !visible;
    if (!visible || !coverage || !documentValue) return;

    const bounds = selectionDocumentBoundsV1(
      coverage,
      documentValue.canvas.width,
      documentValue.canvas.height,
    );
    if (!bounds) {
      selectionBounds.hidden = true;
      launcher.hidden = true;
      return;
    }
    const stageBounds = projectSelectionBoundsToStageV1(bounds, input.viewport.snapshot());
    selectionBounds.style.left = `${stageBounds.minX}px`;
    selectionBounds.style.top = `${stageBounds.minY}px`;
    selectionBounds.style.width = `${Math.max(1, stageBounds.maxX - stageBounds.minX)}px`;
    selectionBounds.style.height = `${Math.max(1, stageBounds.maxY - stageBounds.minY)}px`;

    const stageRect = stage.getBoundingClientRect();
    const launcherRect = launcher.getBoundingClientRect();
    const launcherWidth = Math.max(launcherRect.width, 250);
    const launcherHeight = Math.max(launcherRect.height, 44);
    const margin = M8_SELECTION_LAUNCHER_MARGIN_V1;
    const targetCenter = (stageBounds.minX + stageBounds.maxX) / 2;
    let left = targetCenter - launcherWidth / 2;
    left = Math.max(margin, Math.min(stageRect.width - launcherWidth - margin, left));
    let top = stageBounds.minY - launcherHeight - margin;
    if (top < margin) top = stageBounds.maxY + margin;
    top = Math.max(margin, Math.min(stageRect.height - launcherHeight - margin, top));
    launcher.style.left = `${left}px`;
    launcher.style.top = `${top}px`;
    refreshCommandAvailability();
  };

  const refresh = (): void => reposition();

  const beginSelection = (event: PointerEvent): void => {
    if (activeTool === null || event.button !== 0) return;
    if (event.target instanceof Element && event.target.closest('.m8e-selection-launcher')) return;
    const documentValue = input.paintSession.currentDocument();
    if (!documentValue) return;
    const rect = stage.getBoundingClientRect();
    activePointerId = event.pointerId;
    dragStart = Object.freeze({ x: event.clientX - rect.left, y: event.clientY - rect.top });
    dragCurrent = dragStart;
    lassoClientPoints.length = 0;
    lassoClientPoints.push(Object.freeze({ x: event.clientX, y: event.clientY }));
    dragPreview.hidden = false;
    stage.setPointerCapture?.(event.pointerId);
    input.root.dataset.illustroSelectionGesture = 'active';
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  };

  const updateDragPreview = (): void => {
    if (!dragStart || !dragCurrent || !activeTool) return;
    if (activeTool === 'rectangle') {
      const minX = Math.min(dragStart.x, dragCurrent.x);
      const minY = Math.min(dragStart.y, dragCurrent.y);
      const maxX = Math.max(dragStart.x, dragCurrent.x);
      const maxY = Math.max(dragStart.y, dragCurrent.y);
      dragPath.setAttribute(
        'd',
        `M ${minX} ${minY} H ${maxX} V ${maxY} H ${minX} Z`,
      );
      return;
    }
    const rect = stage.getBoundingClientRect();
    const points = lassoClientPoints.map(
      (point) => `${point.x - rect.left} ${point.y - rect.top}`,
    );
    dragPath.setAttribute('d', points.length === 0 ? '' : `M ${points.join(' L ')}`);
  };

  const moveSelection = (event: PointerEvent): void => {
    if (event.pointerId !== activePointerId || !dragStart) return;
    const rect = stage.getBoundingClientRect();
    dragCurrent = Object.freeze({ x: event.clientX - rect.left, y: event.clientY - rect.top });
    if (activeTool === 'lasso') {
      const previous = lassoClientPoints.at(-1);
      if (!previous || Math.hypot(event.clientX - previous.x, event.clientY - previous.y) >= 3) {
        lassoClientPoints.push(Object.freeze({ x: event.clientX, y: event.clientY }));
      }
    }
    updateDragPreview();
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  };

  const completeSelection = async (event: PointerEvent): Promise<void> => {
    if (event.pointerId !== activePointerId || !dragStart || !dragCurrent || !activeTool) return;
    const tool = activeTool;
    const start = dragStart;
    const end = dragCurrent;
    const points = [...lassoClientPoints];
    activePointerId = null;
    dragStart = null;
    dragCurrent = null;
    dragPreview.hidden = true;
    dragPath.setAttribute('d', '');
    input.root.dataset.illustroSelectionGesture = 'idle';
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const documentValue = input.paintSession.currentDocument();
    if (!documentValue) return;
    const stageRect = stage.getBoundingClientRect();
    const mapPoint = (point: StagePointV1): SelectionPointV1 =>
      input.viewport.mapPointerToDocument(
        { clientX: point.x + stageRect.left, clientY: point.y + stageRect.top },
        documentValue,
      );
    try {
      let prepared;
      if (tool === 'rectangle') {
        if (Math.abs(end.x - start.x) < 2 || Math.abs(end.y - start.y) < 2) return;
        prepared = await prepareRectangularSelectionV1(mapPoint(start), mapPoint(end), {
          documentWidth: documentValue.canvas.width,
          documentHeight: documentValue.canvas.height,
          revision: documentValue.revision,
          persistence: input.paintPersistence,
        });
      } else {
        if (points.length < 3) return;
        prepared = await prepareLassoSelectionV1(
          points.map((point) =>
            input.viewport.mapPointerToDocument(
              { clientX: point.x, clientY: point.y },
              documentValue,
            ),
          ),
          {
            documentWidth: documentValue.canvas.width,
            documentHeight: documentValue.canvas.height,
            revision: documentValue.revision,
            persistence: input.paintPersistence,
          },
        );
      }
      dismissedSignature = null;
      input.selectionCoverage.replacePrepared(prepared);
      announce('選択範囲を作成しました');
    } catch (error) {
      announce(error instanceof Error ? error.message : '選択範囲を作成できませんでした');
    }
  };

  const cancelSelection = (event: PointerEvent): void => {
    if (event.pointerId !== activePointerId) return;
    activePointerId = null;
    dragStart = null;
    dragCurrent = null;
    lassoClientPoints.length = 0;
    dragPreview.hidden = true;
    dragPath.setAttribute('d', '');
    input.root.dataset.illustroSelectionGesture = 'idle';
  };

  const runMorphology = async (operation: SelectionMorphologyOperationV1): Promise<void> => {
    const documentValue = input.paintSession.currentDocument();
    if (!documentValue) return;
    await applySelectionMorphologyV1(
      input.selectionCoverage,
      operation,
      M8_SELECTION_MORPHOLOGY_STEP_PX_V1,
      {
        documentWidth: documentValue.canvas.width,
        documentHeight: documentValue.canvas.height,
        revision: documentValue.revision,
        storage: input.paintPersistence,
      },
    );
  };

  const runCommand = async (command: M8SelectionLauncherCommandV1): Promise<void> => {
    if (commandBusy) return;
    const coverage = coverageSnapshot();
    const documentValue = input.paintSession.currentDocument();
    if (!coverage || !documentValue) return;
    commandBusy = true;
    launcher.dataset.busy = 'true';
    try {
      if (command === 'clear') {
        input.selectionCoverage.clear();
        announce('選択を解除しました');
      } else if (command === 'invert') {
        invertSelectionV1(input.selectionCoverage, documentValue.revision);
        announce('選択範囲を反転しました');
      } else if (command === 'copy') {
        const snapshot = input.paintSession.projectSnapshot();
        const layerId = input.paintSession.snapshot().activeLayerId;
        if (!snapshot || !layerId) throw new Error('コピー対象のレイヤーがありません');
        clipboard = await prepareSelectionCopyV1(snapshot, layerId, coverage, input.paintPersistence);
        input.root.dataset.illustroSelectionClipboard = 'ready';
        announce('選択範囲をコピーしました');
      } else if (command === 'feather' || command === 'expand' || command === 'shrink') {
        await runMorphology(command === 'shrink' ? 'contract' : command);
        more.removeAttribute('open');
        announce('選択範囲を調整しました');
      }
    } catch (error) {
      announce(error instanceof Error ? error.message : '選択操作に失敗しました');
    } finally {
      commandBusy = false;
      launcher.dataset.busy = 'false';
      refresh();
    }
  };

  const onLauncherClick = (event: Event): void => {
    const button =
      event.target instanceof Element
        ? event.target.closest<HTMLButtonElement>('[data-m8e-command], [data-m8e-dismiss]')
        : null;
    if (!button) return;
    if (button.dataset.m8eDismiss === 'true') {
      const coverage = coverageSnapshot();
      dismissedSignature = coverage ? selectionSignatureV1(coverage) : null;
      launcher.hidden = true;
      selectionBounds.hidden = true;
      more.removeAttribute('open');
      announce('Selection Launcherを閉じました。選択範囲は維持されています');
      return;
    }
    const command = button.dataset.m8eCommand as M8SelectionLauncherCommandV1 | undefined;
    if (command && !button.disabled) void runCommand(command);
  };

  const onSelectionToolClick = (event: Event): void => {
    event.preventDefault();
    event.stopPropagation();
    setActiveTool('rectangle');
    announce('矩形選択ツール');
  };
  const onLassoToolClick = (event: Event): void => {
    event.preventDefault();
    event.stopPropagation();
    setActiveTool('lasso');
    announce('投げ縄選択ツール');
  };

  launcher.addEventListener('click', onLauncherClick);
  selectionButton?.addEventListener('click', onSelectionToolClick);
  lassoButton?.addEventListener('click', onLassoToolClick);
  stage.addEventListener('pointerdown', beginSelection, true);
  stage.addEventListener('pointermove', moveSelection, true);
  stage.addEventListener('pointerup', (event) => void completeSelection(event), true);
  stage.addEventListener('pointercancel', cancelSelection, true);

  const unsubscribeCoverage = input.selectionCoverage.subscribe((snapshot) => {
    if (snapshot.coverage === null) dismissedSignature = null;
    refresh();
  });
  const unsubscribeViewport = input.viewport.subscribe(() => refresh());
  const rootObserver = new MutationObserver(() => refresh());
  rootObserver.observe(input.root, {
    attributes: true,
    attributeFilter: [
      'data-illustro-paint-stroke',
      'data-illustro-document-id',
      'data-illustro-active-layer-id',
    ],
  });
  const onResize = (): void => refresh();
  globalThis.addEventListener('resize', onResize);

  setActiveTool(null);
  refresh();

  return Object.freeze({
    element: launcher,
    activeTool: () => activeTool,
    setActiveTool,
    clipboard: () => clipboard,
    refresh,
    dispose(): void {
      launcher.removeEventListener('click', onLauncherClick);
      selectionButton?.removeEventListener('click', onSelectionToolClick);
      lassoButton?.removeEventListener('click', onLassoToolClick);
      stage.removeEventListener('pointerdown', beginSelection, true);
      stage.removeEventListener('pointermove', moveSelection, true);
      stage.removeEventListener('pointercancel', cancelSelection, true);
      unsubscribeCoverage();
      unsubscribeViewport();
      rootObserver.disconnect();
      globalThis.removeEventListener('resize', onResize);
      overlay.remove();
      stylesheet?.remove();
      delete shell.dataset.m8eState;
    },
  });
}
