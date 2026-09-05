import { startProductionBrushTipResourceManagerV1 } from './brush-tip-resource-manager.js';
import { startProductionGrainResourceManagerV1 } from './grain-resource-manager.js';
import { installM7UiSkeletonV1 } from './m7-ui-shell.js';
import { installM8ProductShellV1 } from './m8-product-shell.js';
import { startProductionPaperResourceManagerV1 } from './paper-resource-manager.js';
import { startProductionPatternResourceManagerV1 } from './pattern-resource-manager.js';

export interface CanvasBackingSizeV1 {
  readonly width: number;
  readonly height: number;
  readonly pixelRatio: number;
}

export interface FoundationShell {
  readonly canvas: HTMLCanvasElement;
  currentRenderSurfaceSize(): CanvasBackingSizeV1;
  transferRenderSurface(): OffscreenCanvas | null;
  subscribeRenderSurfaceSize(listener: (size: CanvasBackingSizeV1) => void): () => void;
  dispose(): void;
}

function measureCanvasBackingStore(canvas: HTMLCanvasElement): CanvasBackingSizeV1 {
  const pixelRatio = Math.min(Math.max(globalThis.devicePixelRatio || 1, 1), 4);
  return Object.freeze({
    width: Math.max(1, Math.round(canvas.clientWidth * pixelRatio)),
    height: Math.max(1, Math.round(canvas.clientHeight * pixelRatio)),
    pixelRatio,
  });
}

export function installFoundationShell(): FoundationShell {
  const app = document.querySelector<HTMLElement>('[data-illustro-shell="foundation"]');
  const canvas = document.querySelector<HTMLCanvasElement>('#render-surface');
  if (!app || !canvas) throw new Error('Illustro foundation shell is missing required DOM nodes.');

  const m7UiSkeleton = installM7UiSkeletonV1(app);
  const m8ProductShell = installM8ProductShellV1(app);

  app.dataset.brushTipResources = 'loading';
  void startProductionBrushTipResourceManagerV1()
    .then((manager) => {
      app.dataset.brushTipResources = 'ready';
      app.dataset.brushTipResourceCount = String(manager.snapshot().resourceCount);
    })
    .catch(() => {
      app.dataset.brushTipResources = 'error';
      app.dataset.brushTipResourceCount = '0';
    });

  app.dataset.grainResources = 'loading';
  void startProductionGrainResourceManagerV1()
    .then((manager) => {
      app.dataset.grainResources = 'ready';
      app.dataset.grainResourceCount = String(manager.snapshot().resourceCount);
    })
    .catch(() => {
      app.dataset.grainResources = 'error';
      app.dataset.grainResourceCount = '0';
    });

  app.dataset.paperResources = 'loading';
  void startProductionPaperResourceManagerV1()
    .then((manager) => {
      app.dataset.paperResources = 'ready';
      app.dataset.paperResourceCount = String(manager.snapshot().resourceCount);
    })
    .catch(() => {
      app.dataset.paperResources = 'error';
      app.dataset.paperResourceCount = '0';
    });

  app.dataset.patternResources = 'loading';
  void startProductionPatternResourceManagerV1()
    .then((manager) => {
      app.dataset.patternResources = 'ready';
      app.dataset.patternResourceCount = String(manager.snapshot().resourceCount);
    })
    .catch(() => {
      app.dataset.patternResources = 'error';
      app.dataset.patternResourceCount = '0';
    });

  const listeners = new Set<(size: CanvasBackingSizeV1) => void>();
  let transferred = false;
  let size = measureCanvasBackingStore(canvas);

  const resize = (): void => {
    size = measureCanvasBackingStore(canvas);
    if (!transferred) {
      if (canvas.width !== size.width) canvas.width = size.width;
      if (canvas.height !== size.height) canvas.height = size.height;
    }
    canvas.dataset.pixelRatio = String(size.pixelRatio);
    for (const listener of listeners) listener(size);
  };

  const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null;
  if (observer) observer.observe(canvas);
  else globalThis.addEventListener('resize', resize);

  resize();
  app.dataset.shellState = 'ready';

  return {
    canvas,
    currentRenderSurfaceSize(): CanvasBackingSizeV1 {
      return size;
    },
    transferRenderSurface(): OffscreenCanvas | null {
      if (transferred || typeof canvas.transferControlToOffscreen !== 'function') return null;
      resize();
      const offscreen = canvas.transferControlToOffscreen();
      transferred = true;
      canvas.dataset.renderOwnership = 'offscreen';
      return offscreen;
    },
    subscribeRenderSurfaceSize(listener: (next: CanvasBackingSizeV1) => void): () => void {
      listeners.add(listener);
      listener(size);
      return () => listeners.delete(listener);
    },
    dispose(): void {
      observer?.disconnect();
      if (!observer) globalThis.removeEventListener('resize', resize);
      listeners.clear();
      m8ProductShell.dispose();
      m7UiSkeleton.dispose();
      app.dataset.shellState = 'disposed';
    },
  };
}
