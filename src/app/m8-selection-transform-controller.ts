import type { DocumentV1 } from '../domain/document.js';
import type { M8SelectionContextLayerHandleV1 } from './m8-selection-context-layer.js';
import type { PaintHistoryControllerV1 } from './paint-history-controller.js';
import type { PaintPersistenceControllerV1 } from './paint-persistence-controller.js';
import type { PaintSessionControllerV1 } from './paint-session-controller.js';
import {
  applyPreparedSelectionTransformV1,
  prepareSelectionAffineTransformV1,
  selectionTransformEligibilityV1,
  type SelectionAffineTransformInputV1,
} from './selection-transform-engine.js';
import type {
  RasterSelectionCoverageV1,
  SelectionCoverageControllerV1,
} from './selection-coverage-controller.js';
import type {
  SelectionContourBoundsV1,
  SelectionContourPresenterHandleV1,
} from './selection-contour-presenter.js';
import type { ViewportControllerV1, ViewportSnapshotV1 } from './viewport-controller.js';

export type M8SelectionTransformHandleIdV1 =
  | 'move'
  | 'nw'
  | 'n'
  | 'ne'
  | 'e'
  | 'se'
  | 's'
  | 'sw'
  | 'w'
  | 'rotate'
  | 'pivot';

export type M8SelectionTransformStateV1 = SelectionAffineTransformInputV1;

export interface M8SelectionTransformControllerHandleV1 {
  readonly element: HTMLElement;
  active(): boolean;
  available(): boolean;
  begin(): boolean;
  cancel(): void;
  apply(): void;
  refresh(): void;
  subscribe(listener: () => void): () => void;
  dispose(): void;
}

interface DocumentPointV1 {
  readonly x: number;
  readonly y: number;
}

interface StagePointV1 {
  readonly x: number;
  readonly y: number;
}

interface TransformDragV1 {
  readonly pointerId: number;
  readonly handle: M8SelectionTransformHandleIdV1;
  readonly startPoint: DocumentPointV1;
  readonly startState: M8SelectionTransformStateV1;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
const MIN_SCALE = 0.01;
const ROTATE_HANDLE_OFFSET_PX = 30;
const ACTION_MARGIN_PX = 10;

function canonicalZero(value: number): number {
  return Object.is(value, -0) ? 0 : value;
}

function normalizeDegrees(value: number): number {
  let normalized = value % 360;
  if (normalized <= -180) normalized += 360;
  if (normalized > 180) normalized -= 360;
  return canonicalZero(normalized);
}

export function initialSelectionTransformStateV1(
  bounds: SelectionContourBoundsV1,
): M8SelectionTransformStateV1 {
  return Object.freeze({
    translateX: 0,
    translateY: 0,
    scaleX: 1,
    scaleY: 1,
    rotationDeg: 0,
    pivotX: (bounds.minX + bounds.maxX) / 2,
    pivotY: (bounds.minY + bounds.maxY) / 2,
  });
}

export function selectionTransformHasChangesV1(state: M8SelectionTransformStateV1): boolean {
  return (
    state.translateX !== 0 ||
    state.translateY !== 0 ||
    state.scaleX !== 1 ||
    state.scaleY !== 1 ||
    state.rotationDeg !== 0
  );
}

export function selectionTransformPreviewMatrixV1(
  state: M8SelectionTransformStateV1,
): readonly [number, number, number, number, number, number] {
  const radians = (state.rotationDeg * Math.PI) / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  const a = canonicalZero(cosine * state.scaleX);
  const b = canonicalZero(sine * state.scaleX);
  const c = canonicalZero(-sine * state.scaleY);
  const d = canonicalZero(cosine * state.scaleY);
  const e = canonicalZero(
    state.translateX + state.pivotX - a * state.pivotX - c * state.pivotY,
  );
  const f = canonicalZero(
    state.translateY + state.pivotY - b * state.pivotX - d * state.pivotY,
  );
  return Object.freeze([a, b, c, d, e, f]);
}

export function applySelectionTransformPointV1(
  state: M8SelectionTransformStateV1,
  point: DocumentPointV1,
): DocumentPointV1 {
  const matrix = selectionTransformPreviewMatrixV1(state);
  return Object.freeze({
    x: matrix[0] * point.x + matrix[2] * point.y + matrix[4],
    y: matrix[1] * point.x + matrix[3] * point.y + matrix[5],
  });
}

export function projectDocumentPointToStageV1(
  point: DocumentPointV1,
  viewport: ViewportSnapshotV1,
): StagePointV1 {
  const localX = (point.x / viewport.documentWidth - 0.5) * viewport.baseWidth;
  const localY = (point.y / viewport.documentHeight - 0.5) * viewport.baseHeight;
  const scaledX = localX * (viewport.mirrored ? -viewport.zoom : viewport.zoom);
  const scaledY = localY * viewport.zoom;
  const radians = (viewport.rotationDegrees * Math.PI) / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return Object.freeze({
    x: viewport.stageWidth / 2 + viewport.panX + cosine * scaledX - sine * scaledY,
    y: viewport.stageHeight / 2 + viewport.panY + sine * scaledX + cosine * scaledY,
  });
}

function axisScaleRatio(start: number, current: number, pivot: number): number {
  const denominator = start - pivot;
  if (Math.abs(denominator) < 1e-6) return 1;
  return Math.max(MIN_SCALE, Math.abs((current - pivot) / denominator));
}

function radialScaleRatio(
  start: DocumentPointV1,
  current: DocumentPointV1,
  pivot: DocumentPointV1,
): number {
  const startDistance = Math.hypot(start.x - pivot.x, start.y - pivot.y);
  if (startDistance < 1e-6) return 1;
  return Math.max(
    MIN_SCALE,
    Math.hypot(current.x - pivot.x, current.y - pivot.y) / startDistance,
  );
}

function rebasePivotPreservingMatrixV1(
  state: M8SelectionTransformStateV1,
  nextPivot: DocumentPointV1,
): M8SelectionTransformStateV1 {
  const radians = (state.rotationDeg * Math.PI) / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  const a = cosine * state.scaleX;
  const b = sine * state.scaleX;
  const c = -sine * state.scaleY;
  const d = cosine * state.scaleY;
  const deltaX = state.pivotX - nextPivot.x;
  const deltaY = state.pivotY - nextPivot.y;
  return Object.freeze({
    ...state,
    translateX: canonicalZero(state.translateX + deltaX - (a * deltaX + c * deltaY)),
    translateY: canonicalZero(state.translateY + deltaY - (b * deltaX + d * deltaY)),
    pivotX: nextPivot.x,
    pivotY: nextPivot.y,
  });
}

export function updateSelectionTransformDragV1(
  startState: M8SelectionTransformStateV1,
  handle: M8SelectionTransformHandleIdV1,
  startPoint: DocumentPointV1,
  currentPoint: DocumentPointV1,
  lockAspect = false,
): M8SelectionTransformStateV1 {
  if (handle === 'move') {
    return Object.freeze({
      ...startState,
      translateX: canonicalZero(startState.translateX + currentPoint.x - startPoint.x),
      translateY: canonicalZero(startState.translateY + currentPoint.y - startPoint.y),
    });
  }
  if (handle === 'pivot') {
    return rebasePivotPreservingMatrixV1(startState, currentPoint);
  }
  if (handle === 'rotate') {
    const startAngle = Math.atan2(startPoint.y - startState.pivotY, startPoint.x - startState.pivotX);
    const currentAngle = Math.atan2(
      currentPoint.y - startState.pivotY,
      currentPoint.x - startState.pivotX,
    );
    return Object.freeze({
      ...startState,
      rotationDeg: normalizeDegrees(
        startState.rotationDeg + ((currentAngle - startAngle) * 180) / Math.PI,
      ),
    });
  }

  const controlsX = handle.includes('w') || handle.includes('e');
  const controlsY = handle.includes('n') || handle.includes('s');
  let ratioX = controlsX ? axisScaleRatio(startPoint.x, currentPoint.x, startState.pivotX) : 1;
  let ratioY = controlsY ? axisScaleRatio(startPoint.y, currentPoint.y, startState.pivotY) : 1;
  if (lockAspect && controlsX && controlsY) {
    const uniform = radialScaleRatio(startPoint, currentPoint, {
      x: startState.pivotX,
      y: startState.pivotY,
    });
    ratioX = uniform;
    ratioY = uniform;
  }
  return Object.freeze({
    ...startState,
    scaleX: Math.max(MIN_SCALE, startState.scaleX * ratioX),
    scaleY: Math.max(MIN_SCALE, startState.scaleY * ratioY),
  });
}

function coverageIdentityV1(coverage: RasterSelectionCoverageV1): string {
  return [
    coverage.sourceRevision,
    coverage.defaultCoverage,
    coverage.inverted ? 1 : 0,
    ...coverage.tiles.map((tile) => `${tile.x}:${tile.y}:${tile.payloadRef}`),
  ].join('|');
}

function createHandleButtonV1(
  host: HTMLElement,
  handle: Exclude<M8SelectionTransformHandleIdV1, 'move'>,
  label: string,
): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `m8e-transform-handle m8e-transform-handle-${handle}`;
  button.dataset.m8eTransformHandle = handle;
  button.setAttribute('aria-label', label);
  button.title = label;
  host.append(button);
  return button;
}

export function installM8SelectionTransformControllerV1(input: {
  readonly root: HTMLElement;
  readonly context: M8SelectionContextLayerHandleV1;
  readonly contourPresenter: SelectionContourPresenterHandleV1;
  readonly paintSession: PaintSessionControllerV1;
  readonly paintHistory: PaintHistoryControllerV1;
  readonly paintPersistence: PaintPersistenceControllerV1;
  readonly selectionCoverage: SelectionCoverageControllerV1;
  readonly viewport: ViewportControllerV1;
  readonly deactivateSelectionTool: () => void;
  readonly schedule: (operation: () => Promise<unknown>) => void;
  readonly onHistoryChanged: () => void;
  readonly onDocumentChanged: (documentValue: DocumentV1) => void;
}): M8SelectionTransformControllerHandleV1 {
  const { overlay } = input.context;
  const host = document.createElement('div');
  host.className = 'm8e-transform-controls';
  host.hidden = true;
  host.dataset.m8eTransformState = 'idle';

  const frame = document.createElementNS(SVG_NS, 'svg');
  frame.classList.add('m8e-transform-frame');
  frame.setAttribute('aria-hidden', 'true');
  const moveSurface = document.createElementNS(SVG_NS, 'polygon');
  moveSurface.classList.add('m8e-transform-move-surface');
  moveSurface.dataset.m8eTransformHandle = 'move';
  const outline = document.createElementNS(SVG_NS, 'polyline');
  outline.classList.add('m8e-transform-outline');
  const rotateStem = document.createElementNS(SVG_NS, 'line');
  rotateStem.classList.add('m8e-transform-rotate-stem');
  frame.append(moveSurface, outline, rotateStem);
  host.append(frame);

  const handleLabels: readonly [Exclude<M8SelectionTransformHandleIdV1, 'move'>, string][] = [
    ['nw', '左上から拡大縮小'],
    ['n', '上辺から拡大縮小'],
    ['ne', '右上から拡大縮小'],
    ['e', '右辺から拡大縮小'],
    ['se', '右下から拡大縮小'],
    ['s', '下辺から拡大縮小'],
    ['sw', '左下から拡大縮小'],
    ['w', '左辺から拡大縮小'],
    ['rotate', '回転'],
    ['pivot', '変形中心を移動'],
  ];
  const handles = new Map<Exclude<M8SelectionTransformHandleIdV1, 'move'>, HTMLButtonElement>();
  for (const [handle, label] of handleLabels) {
    handles.set(handle, createHandleButtonV1(host, handle, label));
  }

  const actions = document.createElement('div');
  actions.className = 'm8e-transform-actions';
  const cancelButton = document.createElement('button');
  cancelButton.type = 'button';
  cancelButton.dataset.m8eTransformAction = 'cancel';
  cancelButton.setAttribute('aria-label', '変形をキャンセル');
  cancelButton.title = 'キャンセル';
  cancelButton.textContent = '×';
  const applyButton = document.createElement('button');
  applyButton.type = 'button';
  applyButton.dataset.m8eTransformAction = 'apply';
  applyButton.setAttribute('aria-label', '変形を適用');
  applyButton.title = '適用';
  applyButton.textContent = '✓';
  actions.append(cancelButton, applyButton);
  host.append(actions);
  overlay.append(host);

  const listeners = new Set<() => void>();
  let active = false;
  let busy = false;
  let disposed = false;
  let state: M8SelectionTransformStateV1 | null = null;
  let sourceBounds: SelectionContourBoundsV1 | null = null;
  let sourceCoverageIdentity: string | null = null;
  let drag: TransformDragV1 | null = null;

  const publishState = (): void => {
    for (const listener of listeners) listener();
  };

  const availability = (): boolean => {
    if (disposed || active || busy || input.paintSession.activeStrokeId() !== null) return false;
    const snapshot = input.paintSession.projectSnapshot();
    const layerId = input.paintSession.activeLayerId();
    const coverage = input.selectionCoverage.snapshot().coverage;
    const contour = input.contourPresenter.snapshot();
    if (snapshot === null || layerId === null || coverage === null || contour.documentBounds === null) {
      return false;
    }
    return selectionTransformEligibilityV1(snapshot, layerId, coverage).eligible;
  };

  const setPoint = (element: HTMLElement, point: StagePointV1): void => {
    element.style.left = `${point.x}px`;
    element.style.top = `${point.y}px`;
  };

  const refresh = (): void => {
    if (!active || state === null || sourceBounds === null) {
      host.hidden = true;
      return;
    }
    const viewport = input.viewport.snapshot();
    frame.setAttribute('viewBox', `0 0 ${viewport.stageWidth} ${viewport.stageHeight}`);
    const documentCorners = [
      { x: sourceBounds.minX, y: sourceBounds.minY },
      { x: sourceBounds.maxX, y: sourceBounds.minY },
      { x: sourceBounds.maxX, y: sourceBounds.maxY },
      { x: sourceBounds.minX, y: sourceBounds.maxY },
    ] as const;
    const corners = documentCorners.map((point) =>
      projectDocumentPointToStageV1(applySelectionTransformPointV1(state, point), viewport),
    );
    const [nw, ne, se, sw] = corners;
    if (!nw || !ne || !se || !sw) return;
    const points = `${nw.x},${nw.y} ${ne.x},${ne.y} ${se.x},${se.y} ${sw.x},${sw.y}`;
    moveSurface.setAttribute('points', points);
    outline.setAttribute('points', `${points} ${nw.x},${nw.y}`);

    const midpoint = (a: StagePointV1, b: StagePointV1): StagePointV1 =>
      Object.freeze({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
    const north = midpoint(nw, ne);
    const east = midpoint(ne, se);
    const south = midpoint(sw, se);
    const west = midpoint(nw, sw);
    const center = Object.freeze({
      x: (nw.x + ne.x + se.x + sw.x) / 4,
      y: (nw.y + ne.y + se.y + sw.y) / 4,
    });
    const topVectorX = north.x - center.x;
    const topVectorY = north.y - center.y;
    const topLength = Math.max(1, Math.hypot(topVectorX, topVectorY));
    const rotatePoint = Object.freeze({
      x: north.x + (topVectorX / topLength) * ROTATE_HANDLE_OFFSET_PX,
      y: north.y + (topVectorY / topLength) * ROTATE_HANDLE_OFFSET_PX,
    });
    const transformedPivot = projectDocumentPointToStageV1(
      applySelectionTransformPointV1(state, { x: state.pivotX, y: state.pivotY }),
      viewport,
    );

    const positions: readonly [M8SelectionTransformHandleIdV1, StagePointV1][] = [
      ['nw', nw],
      ['n', north],
      ['ne', ne],
      ['e', east],
      ['se', se],
      ['s', south],
      ['sw', sw],
      ['w', west],
      ['rotate', rotatePoint],
      ['pivot', transformedPivot],
    ];
    for (const [handle, point] of positions) {
      if (handle === 'move') continue;
      const element = handles.get(handle);
      if (element) setPoint(element, point);
    }
    rotateStem.setAttribute('x1', String(north.x));
    rotateStem.setAttribute('y1', String(north.y));
    rotateStem.setAttribute('x2', String(rotatePoint.x));
    rotateStem.setAttribute('y2', String(rotatePoint.y));

    const maxX = Math.max(...corners.map((point) => point.x));
    const minY = Math.min(...corners.map((point) => point.y));
    const actionWidth = Math.max(actions.offsetWidth, 76);
    const actionHeight = Math.max(actions.offsetHeight, 38);
    actions.style.left = `${Math.max(ACTION_MARGIN_PX, Math.min(viewport.stageWidth - actionWidth - ACTION_MARGIN_PX, maxX - actionWidth))}px`;
    actions.style.top = `${Math.max(ACTION_MARGIN_PX, Math.min(viewport.stageHeight - actionHeight - ACTION_MARGIN_PX, minY - actionHeight - ACTION_MARGIN_PX))}px`;
    host.hidden = false;
    host.dataset.m8eTransformState = busy ? 'busy' : 'active';
    applyButton.disabled = busy || !selectionTransformHasChangesV1(state);
    cancelButton.disabled = busy;
    input.root.dataset.illustroSelectionTransform = busy ? 'committing' : 'active';
  };

  const finishSession = (status: 'cancelled' | 'committed'): void => {
    active = false;
    busy = false;
    state = null;
    sourceBounds = null;
    sourceCoverageIdentity = null;
    drag = null;
    host.hidden = true;
    host.dataset.m8eTransformState = 'idle';
    input.root.dataset.illustroSelectionTransform = status;
    publishState();
  };

  const cancel = (): void => {
    if (!active || busy) return;
    finishSession('cancelled');
    input.context.announce('変形をキャンセルしました');
  };

  const begin = (): boolean => {
    if (!availability()) return false;
    const contour = input.contourPresenter.snapshot();
    const coverage = input.selectionCoverage.snapshot().coverage;
    if (contour.documentBounds === null || coverage === null) return false;
    input.deactivateSelectionTool();
    sourceBounds = contour.documentBounds;
    state = initialSelectionTransformStateV1(sourceBounds);
    sourceCoverageIdentity = coverageIdentityV1(coverage);
    active = true;
    busy = false;
    drag = null;
    input.root.dataset.illustroSelectionTransform = 'active';
    refresh();
    publishState();
    input.context.announce('変形モード。ハンドルで移動・拡大縮小・回転できます');
    return true;
  };

  const apply = (): void => {
    if (!active || busy || state === null || !selectionTransformHasChangesV1(state)) return;
    const coverage = input.selectionCoverage.snapshot().coverage;
    const snapshot = input.paintSession.projectSnapshot();
    const layerId = input.paintSession.activeLayerId();
    const pendingState = state;
    if (
      coverage === null ||
      snapshot === null ||
      layerId === null ||
      coverageIdentityV1(coverage) !== sourceCoverageIdentity
    ) {
      cancel();
      input.context.announce('選択範囲が変わったため変形を終了しました');
      return;
    }
    busy = true;
    refresh();
    void prepareSelectionAffineTransformV1(
      snapshot,
      layerId,
      coverage,
      pendingState,
      input.paintPersistence,
    )
      .then((prepared) => {
        if (!active || disposed) return;
        input.schedule(async () => {
          try {
            const transaction = await input.paintHistory.commitSnapshotTransform(
              'selection.transform',
              (before, revision) => applyPreparedSelectionTransformV1(before, prepared, revision),
            );
            input.paintSession.setActiveLayer(layerId);
            await input.paintPersistence.markDirty(transaction.transactionId);
            input.root.dataset.illustroSelectionTransformTransaction = transaction.transactionId;
            input.selectionCoverage.clear();
            const documentValue = input.paintSession.currentDocument();
            if (documentValue !== null) input.onDocumentChanged(documentValue);
            input.onHistoryChanged();
            finishSession('committed');
            input.context.announce('変形を適用しました');
          } catch (error) {
            finishSession('cancelled');
            input.context.announce(error instanceof Error ? error.message : '変形を適用できませんでした');
          }
        });
      })
      .catch((error) => {
        busy = false;
        refresh();
        input.context.announce(error instanceof Error ? error.message : '変形を準備できませんでした');
      });
  };

  const pointerDocumentPoint = (
    event: Pick<PointerEvent, 'clientX' | 'clientY'>,
  ): DocumentPointV1 | null => {
    const documentValue = input.paintSession.currentDocument();
    if (documentValue === null) return null;
    return input.viewport.mapPointerToDocument(event, documentValue);
  };

  const onPointerDown = (event: PointerEvent): void => {
    if (!active || busy || event.button !== 0 || state === null) return;
    const target =
      event.target instanceof Element
        ? event.target.closest<Element>('[data-m8e-transform-handle]')
        : null;
    const handle = target?.getAttribute('data-m8e-transform-handle') as
      | M8SelectionTransformHandleIdV1
      | null;
    if (!handle) return;
    const point = pointerDocumentPoint(event);
    if (point === null) return;
    drag = Object.freeze({
      pointerId: event.pointerId,
      handle,
      startPoint: point,
      startState: state,
    });
    (target as Element & { setPointerCapture?: (pointerId: number) => void }).setPointerCapture?.(
      event.pointerId,
    );
    input.root.dataset.illustroSelectionTransformGesture = handle;
    event.preventDefault();
    event.stopPropagation();
  };

  const onPointerMove = (event: PointerEvent): void => {
    if (!active || busy || drag === null || event.pointerId !== drag.pointerId) return;
    const point = pointerDocumentPoint(event);
    if (point === null) return;
    state = updateSelectionTransformDragV1(
      drag.startState,
      drag.handle,
      drag.startPoint,
      point,
      event.shiftKey,
    );
    refresh();
    event.preventDefault();
    event.stopPropagation();
  };

  const finishDrag = (event: PointerEvent): void => {
    if (drag === null || event.pointerId !== drag.pointerId) return;
    drag = null;
    delete input.root.dataset.illustroSelectionTransformGesture;
    refresh();
    event.preventDefault();
    event.stopPropagation();
  };

  const onActionClick = (event: Event): void => {
    const button =
      event.target instanceof Element
        ? event.target.closest<HTMLButtonElement>('[data-m8e-transform-action]')
        : null;
    if (!button) return;
    if (button.dataset.m8eTransformAction === 'apply') apply();
    else cancel();
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    if (!active || busy) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      cancel();
    } else if (event.key === 'Enter' && state !== null && selectionTransformHasChangesV1(state)) {
      event.preventDefault();
      apply();
    }
  };

  host.addEventListener('pointerdown', onPointerDown);
  host.addEventListener('pointermove', onPointerMove);
  host.addEventListener('pointerup', finishDrag);
  host.addEventListener('pointercancel', finishDrag);
  actions.addEventListener('click', onActionClick);
  globalThis.addEventListener('keydown', onKeyDown);
  const unsubscribeContour = input.contourPresenter.subscribe(() => refresh());
  const unsubscribeViewport = input.viewport.subscribe(() => refresh());
  const unsubscribeCoverage = input.selectionCoverage.subscribe((snapshot) => {
    if (
      active &&
      snapshot.coverage !== null &&
      sourceCoverageIdentity !== null &&
      coverageIdentityV1(snapshot.coverage) !== sourceCoverageIdentity
    ) {
      finishSession('cancelled');
      input.context.announce('選択範囲が変わったため変形を終了しました');
    } else if (active && snapshot.coverage === null && !busy) {
      finishSession('cancelled');
    }
    publishState();
  });
  const onResize = (): void => refresh();
  globalThis.addEventListener('resize', onResize);

  return Object.freeze({
    element: host,
    active: () => active,
    available: availability,
    begin,
    cancel,
    apply,
    refresh,
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      host.removeEventListener('pointerdown', onPointerDown);
      host.removeEventListener('pointermove', onPointerMove);
      host.removeEventListener('pointerup', finishDrag);
      host.removeEventListener('pointercancel', finishDrag);
      actions.removeEventListener('click', onActionClick);
      globalThis.removeEventListener('keydown', onKeyDown);
      globalThis.removeEventListener('resize', onResize);
      unsubscribeContour();
      unsubscribeViewport();
      unsubscribeCoverage();
      listeners.clear();
      host.remove();
      delete input.root.dataset.illustroSelectionTransform;
      delete input.root.dataset.illustroSelectionTransformGesture;
      delete input.root.dataset.illustroSelectionTransformTransaction;
    },
  });
}
