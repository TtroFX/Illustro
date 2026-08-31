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
  const rect = canvas.getBoundingClientRect();
  const pixelRatio = Math.min(Math.max(globalThis.devicePixelRatio || 1, 1), 4);
  return Object.freeze({
    width: Math.max(1, Math.round(rect.width * pixelRatio)),
    height: Math.max(1, Math.round(rect.height * pixelRatio)),
    pixelRatio,
  });
}

export function installFoundationShell(): FoundationShell {
  const app = document.querySelector<HTMLElement>('[data-illustro-shell="foundation"]');
  const canvas = document.querySelector<HTMLCanvasElement>('#render-surface');
  if (!app || !canvas) throw new Error('Illustro foundation shell is missing required DOM nodes.');

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
      app.dataset.shellState = 'disposed';
    },
  };
}
