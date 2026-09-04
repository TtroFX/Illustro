import type { PointerHoverSnapshotV1 } from '../input/hover-state.js';
import type { PaintSessionControllerV1 } from './paint-session-controller.js';
import type { ViewportControllerV1, ViewportSnapshotV1 } from './viewport-controller.js';

export interface BrushHoverOutlinePresentationV1 {
  readonly visible: boolean;
  readonly xCssPx: number;
  readonly yCssPx: number;
  readonly diameterCssPx: number;
}

const HIDDEN_BRUSH_HOVER_OUTLINE_V1: BrushHoverOutlinePresentationV1 = Object.freeze({
  visible: false,
  xCssPx: 0,
  yCssPx: 0,
  diameterCssPx: 0,
});

export function resolveBrushHoverOutlinePresentationV1(input: {
  readonly hover: PointerHoverSnapshotV1;
  readonly stageLeft: number;
  readonly stageTop: number;
  readonly documentX: number;
  readonly documentY: number;
  readonly documentWidth: number;
  readonly documentHeight: number;
  readonly brushSizePx: number;
  readonly viewport: Pick<
    ViewportSnapshotV1,
    'documentWidth' | 'documentHeight' | 'baseWidth' | 'baseHeight' | 'zoom'
  >;
}): BrushHoverOutlinePresentationV1 {
  const { hover, viewport } = input;
  if (
    !hover.active ||
    hover.clientX === null ||
    hover.clientY === null ||
    !Number.isFinite(hover.clientX) ||
    !Number.isFinite(hover.clientY) ||
    !Number.isFinite(input.stageLeft) ||
    !Number.isFinite(input.stageTop) ||
    !Number.isFinite(input.documentX) ||
    !Number.isFinite(input.documentY) ||
    !Number.isFinite(input.documentWidth) ||
    !Number.isFinite(input.documentHeight) ||
    input.documentWidth <= 0 ||
    input.documentHeight <= 0 ||
    input.documentX < 0 ||
    input.documentY < 0 ||
    input.documentX > input.documentWidth ||
    input.documentY > input.documentHeight ||
    !Number.isFinite(input.brushSizePx) ||
    input.brushSizePx <= 0 ||
    !Number.isFinite(viewport.documentWidth) ||
    !Number.isFinite(viewport.documentHeight) ||
    viewport.documentWidth <= 0 ||
    viewport.documentHeight <= 0 ||
    !Number.isFinite(viewport.baseWidth) ||
    !Number.isFinite(viewport.baseHeight) ||
    viewport.baseWidth <= 0 ||
    viewport.baseHeight <= 0 ||
    !Number.isFinite(viewport.zoom) ||
    viewport.zoom <= 0
  ) {
    return HIDDEN_BRUSH_HOVER_OUTLINE_V1;
  }

  const scaleX = viewport.baseWidth / viewport.documentWidth;
  const scaleY = viewport.baseHeight / viewport.documentHeight;
  const projectedScale = Math.min(scaleX, scaleY) * viewport.zoom;
  const diameterCssPx = input.brushSizePx * projectedScale;
  if (!Number.isFinite(diameterCssPx) || diameterCssPx <= 0) {
    return HIDDEN_BRUSH_HOVER_OUTLINE_V1;
  }

  return Object.freeze({
    visible: true,
    xCssPx: hover.clientX - input.stageLeft,
    yCssPx: hover.clientY - input.stageTop,
    diameterCssPx,
  });
}

export interface BrushHoverDisplaySettingsSnapshotV1 {
  readonly schema: 'illustro.brush-hover-display-settings/1';
  readonly crosshairEnabled: boolean;
}

export class BrushHoverDisplaySettingsV1 {
  #crosshairEnabled = false;

  snapshot(): BrushHoverDisplaySettingsSnapshotV1 {
    return Object.freeze({
      schema: 'illustro.brush-hover-display-settings/1' as const,
      crosshairEnabled: this.#crosshairEnabled,
    });
  }

  setCrosshairEnabled(enabled: boolean): BrushHoverDisplaySettingsSnapshotV1 {
    this.#crosshairEnabled = enabled;
    return this.snapshot();
  }

  toggleCrosshair(): BrushHoverDisplaySettingsSnapshotV1 {
    this.#crosshairEnabled = !this.#crosshairEnabled;
    return this.snapshot();
  }
}

export interface BrushHoverOutlineControllerV1 {
  readonly schema: 'illustro.brush-hover-outline-controller/1';
  updateHover(hover: PointerHoverSnapshotV1): void;
  refresh(): void;
  crosshairEnabled(): boolean;
  setCrosshairEnabled(enabled: boolean): void;
  dispose(): void;
}

export function installBrushHoverOutlineControllerV1(input: {
  readonly root: HTMLElement;
  readonly surface: HTMLElement;
  readonly paintSession: PaintSessionControllerV1;
  readonly viewport: ViewportControllerV1;
}): BrushHoverOutlineControllerV1 {
  const stage = input.root.querySelector<HTMLElement>('.shell-canvas-stage');
  const outline = input.root.querySelector<HTMLElement>('#brush-hover-outline');
  const crosshairButton = input.root.querySelector<HTMLButtonElement>(
    '#view-brush-hover-crosshair',
  );
  if (stage === null || outline === null || crosshairButton === null) {
    throw new Error('brush hover outline requires canvas stage, overlay, and display controls');
  }

  const settings = new BrushHoverDisplaySettingsV1();
  let currentHover: PointerHoverSnapshotV1 | null = null;
  let disposed = false;

  const hide = (): void => {
    outline.hidden = true;
    input.root.dataset.illustroBrushHoverOutline = 'hidden';
    input.root.dataset.illustroBrushHoverDiameterCssPx = '';
  };

  const publishCrosshair = (): void => {
    const enabled = settings.snapshot().crosshairEnabled;
    outline.dataset.crosshair = String(enabled);
    crosshairButton.setAttribute('aria-pressed', String(enabled));
    crosshairButton.dataset.active = String(enabled);
    input.root.dataset.illustroBrushHoverCrosshair = enabled ? 'enabled' : 'disabled';
  };

  const refresh = (): void => {
    if (disposed) return;
    const hover = currentHover;
    const documentValue = input.paintSession.currentDocument();
    if (
      hover === null ||
      !hover.active ||
      hover.clientX === null ||
      hover.clientY === null ||
      documentValue === null
    ) {
      hide();
      return;
    }

    const viewport = input.viewport.snapshot();
    if (
      viewport.documentWidth !== documentValue.canvas.width ||
      viewport.documentHeight !== documentValue.canvas.height
    ) {
      hide();
      return;
    }

    const documentPoint = input.viewport.mapPointerToDocument(
      { clientX: hover.clientX, clientY: hover.clientY },
      documentValue,
    );
    const stageRect = stage.getBoundingClientRect();
    const presentation = resolveBrushHoverOutlinePresentationV1({
      hover,
      stageLeft: stageRect.left,
      stageTop: stageRect.top,
      documentX: documentPoint.x,
      documentY: documentPoint.y,
      documentWidth: documentValue.canvas.width,
      documentHeight: documentValue.canvas.height,
      brushSizePx: input.paintSession.snapshot().brushParameters.sizePx,
      viewport,
    });
    if (!presentation.visible) {
      hide();
      return;
    }

    outline.style.left = `${presentation.xCssPx}px`;
    outline.style.top = `${presentation.yCssPx}px`;
    outline.style.width = `${presentation.diameterCssPx}px`;
    outline.style.height = `${presentation.diameterCssPx}px`;
    outline.hidden = false;
    input.root.dataset.illustroBrushHoverOutline = 'visible';
    input.root.dataset.illustroBrushHoverDiameterCssPx = String(presentation.diameterCssPx);
  };

  const onPointerLeave = (): void => {
    currentHover = null;
    hide();
  };
  const onCrosshairToggle = (): void => {
    settings.toggleCrosshair();
    publishCrosshair();
    crosshairButton.closest('details')?.removeAttribute('open');
  };
  input.surface.addEventListener('pointerleave', onPointerLeave);
  crosshairButton.addEventListener('click', onCrosshairToggle);
  const unsubscribeViewport = input.viewport.subscribe(() => refresh());
  publishCrosshair();
  hide();

  return Object.freeze({
    schema: 'illustro.brush-hover-outline-controller/1' as const,
    updateHover(hover: PointerHoverSnapshotV1): void {
      currentHover = hover.active ? hover : null;
      refresh();
    },
    refresh,
    crosshairEnabled(): boolean {
      return settings.snapshot().crosshairEnabled;
    },
    setCrosshairEnabled(enabled: boolean): void {
      settings.setCrosshairEnabled(enabled);
      publishCrosshair();
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      currentHover = null;
      input.surface.removeEventListener('pointerleave', onPointerLeave);
      crosshairButton.removeEventListener('click', onCrosshairToggle);
      unsubscribeViewport();
      hide();
    },
  });
}
