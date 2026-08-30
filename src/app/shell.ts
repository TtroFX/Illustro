export interface FoundationShell {
  readonly canvas: HTMLCanvasElement;
  dispose(): void;
}

function syncCanvasBackingStore(canvas: HTMLCanvasElement): void {
  const rect = canvas.getBoundingClientRect();
  const devicePixelRatio = Math.min(Math.max(globalThis.devicePixelRatio || 1, 1), 4);
  const width = Math.max(1, Math.round(rect.width * devicePixelRatio));
  const height = Math.max(1, Math.round(rect.height * devicePixelRatio));

  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  canvas.dataset.pixelRatio = String(devicePixelRatio);
}

export function installFoundationShell(): FoundationShell {
  const app = document.querySelector<HTMLElement>('[data-illustro-shell="foundation"]');
  const canvas = document.querySelector<HTMLCanvasElement>('#render-surface');
  if (!app || !canvas) throw new Error('Illustro foundation shell is missing required DOM nodes.');

  const resize = (): void => syncCanvasBackingStore(canvas);
  const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null;
  if (observer) observer.observe(canvas);
  else globalThis.addEventListener('resize', resize);

  resize();
  app.dataset.shellState = 'ready';

  return {
    canvas,
    dispose(): void {
      observer?.disconnect();
      if (!observer) globalThis.removeEventListener('resize', resize);
      app.dataset.shellState = 'disposed';
    },
  };
}
