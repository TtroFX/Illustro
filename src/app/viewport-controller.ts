import type { DocumentV1 } from '../domain/document.js';
import type { PointerInputBatchV1 } from '../input/pointer-input.js';

export const VIEWPORT_MIN_ZOOM_V1 = 0.05;
export const VIEWPORT_MAX_ZOOM_V1 = 64;
export const VIEWPORT_FIT_PADDING_PX_V1 = 16;

export interface ViewportSnapshotV1 {
  readonly schema: 'illustro.viewport-state/1';
  readonly documentWidth: number;
  readonly documentHeight: number;
  readonly stageWidth: number;
  readonly stageHeight: number;
  readonly baseWidth: number;
  readonly baseHeight: number;
  readonly panX: number;
  readonly panY: number;
  readonly zoom: number;
  readonly rotationDegrees: number;
  readonly mirrored: boolean;
  readonly pixelated: boolean;
  readonly workspacePresentation: boolean;
}

export interface ViewportDocumentPointV1 {
  readonly x: number;
  readonly y: number;
}

function finitePositive(value: number, label: string): number {
  if (!Number.isFinite(value) || value <= 0)
    throw new RangeError(`${label} must be finite and > 0`);
  return value;
}

function clampZoom(value: number): number {
  if (!Number.isFinite(value)) throw new RangeError('viewport zoom must be finite');
  return Math.min(VIEWPORT_MAX_ZOOM_V1, Math.max(VIEWPORT_MIN_ZOOM_V1, value));
}

function normalizeRotation(value: number): number {
  if (!Number.isFinite(value)) throw new RangeError('viewport rotation must be finite');
  let normalized = value % 360;
  if (normalized <= -180) normalized += 360;
  if (normalized > 180) normalized -= 360;
  return normalized;
}

function radians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export class ViewportTransformV1 {
  #documentWidth = 1;
  #documentHeight = 1;
  #stageWidth = 1;
  #stageHeight = 1;
  #baseWidth = 1;
  #baseHeight = 1;
  #panX = 0;
  #panY = 0;
  #zoom = 1;
  #rotationDegrees = 0;
  #mirrored = false;
  #pixelated = false;
  #workspacePresentation = false;

  snapshot(): ViewportSnapshotV1 {
    return Object.freeze({
      schema: 'illustro.viewport-state/1' as const,
      documentWidth: this.#documentWidth,
      documentHeight: this.#documentHeight,
      stageWidth: this.#stageWidth,
      stageHeight: this.#stageHeight,
      baseWidth: this.#baseWidth,
      baseHeight: this.#baseHeight,
      panX: this.#panX,
      panY: this.#panY,
      zoom: this.#zoom,
      rotationDegrees: this.#rotationDegrees,
      mirrored: this.#mirrored,
      pixelated: this.#pixelated,
      workspacePresentation: this.#workspacePresentation,
    });
  }

  setDocumentSize(width: number, height: number): ViewportSnapshotV1 {
    finitePositive(width, 'document width');
    finitePositive(height, 'document height');
    const changed = width !== this.#documentWidth || height !== this.#documentHeight;
    this.#documentWidth = width;
    this.#documentHeight = height;
    this.#recomputeBaseSize();
    if (changed) {
      this.#panX = 0;
      this.#panY = 0;
      this.#zoom = 1;
      this.#rotationDegrees = 0;
    }
    return this.snapshot();
  }

  setStageSize(width: number, height: number): ViewportSnapshotV1 {
    this.#stageWidth = finitePositive(width, 'stage width');
    this.#stageHeight = finitePositive(height, 'stage height');
    this.#recomputeBaseSize();
    return this.snapshot();
  }

  panBy(deltaX: number, deltaY: number): ViewportSnapshotV1 {
    if (!Number.isFinite(deltaX) || !Number.isFinite(deltaY)) {
      throw new RangeError('viewport pan delta must be finite');
    }
    this.#panX += deltaX;
    this.#panY += deltaY;
    return this.snapshot();
  }

  setPan(panX: number, panY: number): ViewportSnapshotV1 {
    if (!Number.isFinite(panX) || !Number.isFinite(panY))
      throw new RangeError('viewport pan must be finite');
    this.#panX = panX;
    this.#panY = panY;
    return this.snapshot();
  }

  setRotation(degrees: number): ViewportSnapshotV1 {
    this.#rotationDegrees = normalizeRotation(degrees);
    return this.snapshot();
  }

  rotateAt(stageX: number, stageY: number, degrees: number): ViewportSnapshotV1 {
    const anchor = this.mapStageToDocument(stageX, stageY);
    this.#rotationDegrees = normalizeRotation(degrees);
    this.#placeDocumentPointAt(anchor, stageX, stageY);
    return this.snapshot();
  }

  zoomAt(stageX: number, stageY: number, zoom: number): ViewportSnapshotV1 {
    const anchor = this.mapStageToDocument(stageX, stageY);
    this.#zoom = clampZoom(zoom);
    this.#placeDocumentPointAt(anchor, stageX, stageY);
    return this.snapshot();
  }

  setZoomRotationAtDocumentPoint(
    anchor: ViewportDocumentPointV1,
    stageX: number,
    stageY: number,
    zoom: number,
    rotationDegrees: number,
  ): ViewportSnapshotV1 {
    this.#zoom = clampZoom(zoom);
    this.#rotationDegrees = normalizeRotation(rotationDegrees);
    this.#placeDocumentPointAt(anchor, stageX, stageY);
    return this.snapshot();
  }

  resetView(): ViewportSnapshotV1 {
    this.#panX = 0;
    this.#panY = 0;
    this.#zoom = 1;
    this.#rotationDegrees = 0;
    return this.snapshot();
  }

  fitToScreen(): ViewportSnapshotV1 {
    this.#panX = 0;
    this.#panY = 0;
    const angle = radians(this.#rotationDegrees);
    const cos = Math.abs(Math.cos(angle));
    const sin = Math.abs(Math.sin(angle));
    const rotatedWidth = this.#baseWidth * cos + this.#baseHeight * sin;
    const rotatedHeight = this.#baseWidth * sin + this.#baseHeight * cos;
    const availableWidth = Math.max(1, this.#stageWidth - VIEWPORT_FIT_PADDING_PX_V1 * 2);
    const availableHeight = Math.max(1, this.#stageHeight - VIEWPORT_FIT_PADDING_PX_V1 * 2);
    this.#zoom = clampZoom(
      Math.min(availableWidth / rotatedWidth, availableHeight / rotatedHeight),
    );
    return this.snapshot();
  }

  toggleMirror(): ViewportSnapshotV1 {
    this.#mirrored = !this.#mirrored;
    return this.snapshot();
  }

  setPixelated(enabled: boolean): ViewportSnapshotV1 {
    this.#pixelated = enabled;
    return this.snapshot();
  }

  setWorkspacePresentation(enabled: boolean): ViewportSnapshotV1 {
    this.#workspacePresentation = enabled;
    return this.snapshot();
  }

  mapStageToDocument(stageX: number, stageY: number): ViewportDocumentPointV1 {
    if (!Number.isFinite(stageX) || !Number.isFinite(stageY)) {
      throw new RangeError('viewport stage coordinate must be finite');
    }
    const translatedX = stageX - this.#stageWidth / 2 - this.#panX;
    const translatedY = stageY - this.#stageHeight / 2 - this.#panY;
    const angle = radians(this.#rotationDegrees);
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const rotatedX = cos * translatedX + sin * translatedY;
    const rotatedY = -sin * translatedX + cos * translatedY;
    const mirrorScale = this.#mirrored ? -this.#zoom : this.#zoom;
    const localX = rotatedX / mirrorScale;
    const localY = rotatedY / this.#zoom;
    return Object.freeze({
      x: ((localX + this.#baseWidth / 2) / this.#baseWidth) * this.#documentWidth,
      y: ((localY + this.#baseHeight / 2) / this.#baseHeight) * this.#documentHeight,
    });
  }

  #placeDocumentPointAt(anchor: ViewportDocumentPointV1, stageX: number, stageY: number): void {
    const localX = (anchor.x / this.#documentWidth - 0.5) * this.#baseWidth;
    const localY = (anchor.y / this.#documentHeight - 0.5) * this.#baseHeight;
    const scaledX = localX * (this.#mirrored ? -this.#zoom : this.#zoom);
    const scaledY = localY * this.#zoom;
    const angle = radians(this.#rotationDegrees);
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const rotatedX = cos * scaledX - sin * scaledY;
    const rotatedY = sin * scaledX + cos * scaledY;
    this.#panX = stageX - this.#stageWidth / 2 - rotatedX;
    this.#panY = stageY - this.#stageHeight / 2 - rotatedY;
  }

  #recomputeBaseSize(): void {
    const availableWidth = Math.max(1, this.#stageWidth - VIEWPORT_FIT_PADDING_PX_V1 * 2);
    const availableHeight = Math.max(1, this.#stageHeight - VIEWPORT_FIT_PADDING_PX_V1 * 2);
    const scale = Math.min(
      availableWidth / this.#documentWidth,
      availableHeight / this.#documentHeight,
    );
    this.#baseWidth = Math.max(1, this.#documentWidth * scale);
    this.#baseHeight = Math.max(1, this.#documentHeight * scale);
  }
}

export interface ViewportControllerV1 {
  readonly schema: 'illustro.viewport-controller/1';
  snapshot(): ViewportSnapshotV1;
  setDocumentSize(width: number, height: number): ViewportSnapshotV1;
  mapPointerToDocument(
    sample: { readonly clientX: number; readonly clientY: number },
    document: DocumentV1,
  ): ViewportDocumentPointV1;
  handleNavigationBatch(batch: PointerInputBatchV1): boolean;
  isMouseNavigationBatch(batch: PointerInputBatchV1): boolean;
  dispose(): void;
}

interface GestureBaselineV1 {
  readonly count: number;
  readonly centroidX: number;
  readonly centroidY: number;
  readonly distance: number;
  readonly angle: number;
  readonly panX: number;
  readonly panY: number;
  readonly zoom: number;
  readonly rotationDegrees: number;
  readonly anchor: ViewportDocumentPointV1;
}

function requireElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (element === null) throw new Error(`viewport controller is missing ${selector}`);
  return element;
}

function closeMenu(element: Element): void {
  element.closest('details')?.removeAttribute('open');
}

export function installViewportControllerV1(input: {
  readonly root?: HTMLElement;
  readonly canvas: HTMLCanvasElement;
}): ViewportControllerV1 {
  const root = input.root ?? document.documentElement;
  const canvas = input.canvas;
  const stage = requireElement<HTMLElement>('.shell-canvas-stage');
  const app = requireElement<HTMLElement>('#app');
  const transform = new ViewportTransformV1();
  const activePointers = new Map<number, { x: number; y: number }>();
  let gesture: GestureBaselineV1 | null = null;
  let disposed = false;
  let fullscreenRequested = false;

  const stagePoint = (clientX: number, clientY: number): { x: number; y: number } => {
    const rect = stage.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const publish = (): ViewportSnapshotV1 => {
    const snapshot = transform.snapshot();
    canvas.style.width = `${snapshot.baseWidth}px`;
    canvas.style.height = `${snapshot.baseHeight}px`;
    canvas.style.transform = `translate(${snapshot.panX}px, ${snapshot.panY}px) rotate(${snapshot.rotationDegrees}deg) scale(${snapshot.mirrored ? -snapshot.zoom : snapshot.zoom}, ${snapshot.zoom})`;
    canvas.dataset.pixelPreview = snapshot.pixelated ? 'true' : 'false';
    root.dataset.illustroViewportPanX = String(snapshot.panX);
    root.dataset.illustroViewportPanY = String(snapshot.panY);
    root.dataset.illustroViewportZoom = String(snapshot.zoom);
    root.dataset.illustroViewportRotation = String(snapshot.rotationDegrees);
    root.dataset.illustroViewportMirror = snapshot.mirrored ? 'enabled' : 'disabled';
    root.dataset.illustroViewportPixelPreview = snapshot.pixelated ? 'enabled' : 'disabled';
    root.dataset.illustroWorkspacePresentation = snapshot.workspacePresentation
      ? 'enabled'
      : 'disabled';
    return snapshot;
  };

  const syncStage = (): void => {
    const width = Math.max(1, stage.clientWidth);
    const height = Math.max(1, stage.clientHeight);
    transform.setStageSize(width, height);
    publish();
  };
  syncStage();
  const stageObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(syncStage) : null;
  stageObserver?.observe(stage);
  if (stageObserver === null) globalThis.addEventListener('resize', syncStage);

  const pointSummary = (): {
    centroidX: number;
    centroidY: number;
    distance: number;
    angle: number;
  } | null => {
    const points = [...activePointers.values()];
    if (points.length === 0) return null;
    if (points.length === 1) {
      const point = points[0];
      if (point === undefined) return null;
      return { centroidX: point.x, centroidY: point.y, distance: 0, angle: 0 };
    }
    const left = points[0];
    const right = points[1];
    if (left === undefined || right === undefined) return null;
    return {
      centroidX: (left.x + right.x) / 2,
      centroidY: (left.y + right.y) / 2,
      distance: Math.max(1e-6, Math.hypot(right.x - left.x, right.y - left.y)),
      angle: Math.atan2(right.y - left.y, right.x - left.x),
    };
  };

  const restartGesture = (): void => {
    const summary = pointSummary();
    if (summary === null) {
      gesture = null;
      return;
    }
    const snapshot = transform.snapshot();
    gesture = {
      count: Math.min(2, activePointers.size),
      ...summary,
      panX: snapshot.panX,
      panY: snapshot.panY,
      zoom: snapshot.zoom,
      rotationDegrees: snapshot.rotationDegrees,
      anchor: transform.mapStageToDocument(summary.centroidX, summary.centroidY),
    };
  };

  const updateGesture = (): void => {
    const summary = pointSummary();
    if (summary === null) return;
    if (gesture === null || gesture.count !== Math.min(2, activePointers.size)) {
      restartGesture();
      return;
    }
    if (gesture.count === 1) {
      transform.setPan(
        gesture.panX + summary.centroidX - gesture.centroidX,
        gesture.panY + summary.centroidY - gesture.centroidY,
      );
    } else {
      const ratio = summary.distance / gesture.distance;
      const deltaDegrees = ((summary.angle - gesture.angle) * 180) / Math.PI;
      transform.setZoomRotationAtDocumentPoint(
        gesture.anchor,
        summary.centroidX,
        summary.centroidY,
        gesture.zoom * ratio,
        gesture.rotationDegrees + deltaDegrees,
      );
    }
    publish();
  };

  const isMouseNavigationBatch = (batch: PointerInputBatchV1): boolean => {
    const latest = batch.confirmed.at(-1);
    return latest?.source === 'mouse' && ((latest.buttons & 4) !== 0 || latest.button === 1);
  };

  const handleNavigationBatch = (batch: PointerInputBatchV1): boolean => {
    const latest = batch.confirmed.at(-1);
    if (latest === undefined) return false;
    const eligible = latest.source === 'touch' || isMouseNavigationBatch(batch);
    if (!eligible) return false;
    const point = stagePoint(latest.clientX, latest.clientY);
    if (batch.eventType === 'pointerdown') {
      activePointers.set(batch.pointerId, point);
      restartGesture();
      return true;
    }
    if (batch.eventType === 'pointermove' || batch.eventType === 'pointerrawupdate') {
      if (!activePointers.has(batch.pointerId)) activePointers.set(batch.pointerId, point);
      else activePointers.set(batch.pointerId, point);
      updateGesture();
      return true;
    }
    if (batch.eventType === 'pointerup' || batch.eventType === 'pointercancel') {
      activePointers.delete(batch.pointerId);
      restartGesture();
      return true;
    }
    return false;
  };

  const onWheel = (event: WheelEvent): void => {
    if (disposed) return;
    event.preventDefault();
    const point = stagePoint(event.clientX, event.clientY);
    const snapshot = transform.snapshot();
    transform.zoomAt(point.x, point.y, snapshot.zoom * Math.exp(-event.deltaY * 0.0015));
    publish();
  };
  stage.addEventListener('wheel', onWheel, { passive: false });

  const buttons = {
    zoomIn: requireElement<HTMLButtonElement>('#view-zoom-in'),
    zoomOut: requireElement<HTMLButtonElement>('#view-zoom-out'),
    rotateLeft: requireElement<HTMLButtonElement>('#view-rotate-left'),
    rotateRight: requireElement<HTMLButtonElement>('#view-rotate-right'),
    reset: requireElement<HTMLButtonElement>('#view-reset'),
    fit: requireElement<HTMLButtonElement>('#view-fit'),
    mirror: requireElement<HTMLButtonElement>('#view-mirror'),
    pixel: requireElement<HTMLButtonElement>('#view-pixel'),
    workspace: requireElement<HTMLButtonElement>('#view-workspace'),
  };

  const center = (): { x: number; y: number } => ({
    x: stage.clientWidth / 2,
    y: stage.clientHeight / 2,
  });
  const actions = {
    zoomIn: () => {
      const point = center();
      transform.zoomAt(point.x, point.y, transform.snapshot().zoom * 1.25);
      publish();
    },
    zoomOut: () => {
      const point = center();
      transform.zoomAt(point.x, point.y, transform.snapshot().zoom / 1.25);
      publish();
    },
    rotateLeft: () => {
      const point = center();
      transform.rotateAt(point.x, point.y, transform.snapshot().rotationDegrees - 15);
      publish();
    },
    rotateRight: () => {
      const point = center();
      transform.rotateAt(point.x, point.y, transform.snapshot().rotationDegrees + 15);
      publish();
    },
    reset: () => {
      transform.resetView();
      publish();
    },
    fit: () => {
      transform.fitToScreen();
      publish();
    },
    mirror: () => {
      transform.toggleMirror();
      publish();
    },
    pixel: () => {
      transform.setPixelated(!transform.snapshot().pixelated);
      publish();
    },
    workspace: () => {
      const enabled = !transform.snapshot().workspacePresentation;
      transform.setWorkspacePresentation(enabled);
      app.classList.toggle('is-workspace-presentation', enabled);
      publish();
      syncStage();
      if (enabled && typeof app.requestFullscreen === 'function') {
        fullscreenRequested = true;
        void app.requestFullscreen().catch(() => {
          fullscreenRequested = false;
        });
      } else if (!enabled && document.fullscreenElement !== null) {
        void document.exitFullscreen().catch(() => undefined);
      }
    },
  };

  const listeners = new Map<HTMLButtonElement, () => void>();
  for (const [key, button] of Object.entries(buttons) as [
    keyof typeof buttons,
    HTMLButtonElement,
  ][]) {
    const action = actions[key];
    const listener = (): void => {
      closeMenu(button);
      action();
    };
    button.addEventListener('click', listener);
    listeners.set(button, listener);
  }

  const onFullscreenChange = (): void => {
    if (!fullscreenRequested) return;
    if (document.fullscreenElement === null) {
      fullscreenRequested = false;
      transform.setWorkspacePresentation(false);
      app.classList.remove('is-workspace-presentation');
      publish();
      syncStage();
    }
  };
  document.addEventListener('fullscreenchange', onFullscreenChange);
  root.dataset.illustroViewport = 'ready';

  return Object.freeze({
    schema: 'illustro.viewport-controller/1' as const,
    snapshot: () => transform.snapshot(),
    setDocumentSize(width: number, height: number) {
      transform.setDocumentSize(width, height);
      return publish();
    },
    mapPointerToDocument(
      sample: { readonly clientX: number; readonly clientY: number },
      documentValue: DocumentV1,
    ) {
      if (
        documentValue.canvas.width !== transform.snapshot().documentWidth ||
        documentValue.canvas.height !== transform.snapshot().documentHeight
      ) {
        transform.setDocumentSize(documentValue.canvas.width, documentValue.canvas.height);
        publish();
      }
      const point = stagePoint(sample.clientX, sample.clientY);
      return transform.mapStageToDocument(point.x, point.y);
    },
    handleNavigationBatch,
    isMouseNavigationBatch,
    dispose() {
      if (disposed) return;
      disposed = true;
      stageObserver?.disconnect();
      if (stageObserver === null) globalThis.removeEventListener('resize', syncStage);
      stage.removeEventListener('wheel', onWheel);
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      for (const [button, listener] of listeners) button.removeEventListener('click', listener);
      activePointers.clear();
      root.dataset.illustroViewport = 'disposed';
    },
  });
}
