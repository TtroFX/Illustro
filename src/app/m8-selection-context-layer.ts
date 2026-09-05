export interface M8SelectionContextLayerHandleV1 {
  readonly shell: HTMLElement;
  readonly stage: HTMLElement;
  readonly overlay: HTMLElement;
  readonly live: HTMLElement;
  announce(message: string): void;
  dispose(): void;
}

const STYLE_ID = 'm8-selection-style';
const CONTEXT_LAYER_ID = 'm8-selection-context-layer';

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

export function installM8SelectionContextLayerV1(): M8SelectionContextLayerHandleV1 {
  const stylesheet = ensureStylesheetV1();
  const shell = document.querySelector<HTMLElement>('#m8-canonical-shell');
  const stage = shell?.querySelector<HTMLElement>('.m8-canvas-stage');
  if (!shell || !stage) throw new Error('M8E requires the canonical canvas workspace.');

  document.getElementById(CONTEXT_LAYER_ID)?.remove();

  const overlay = document.createElement('div');
  overlay.id = CONTEXT_LAYER_ID;
  overlay.className = 'm8e-context-layer';
  overlay.dataset.m8eContextLayer = 'true';

  const live = document.createElement('div');
  live.className = 'm8e-sr-only';
  live.setAttribute('aria-live', 'polite');
  overlay.append(live);
  stage.append(overlay);
  shell.dataset.m8eState = 'provisional';

  return Object.freeze({
    shell,
    stage,
    overlay,
    live,
    announce(message: string): void {
      live.textContent = message;
    },
    dispose(): void {
      overlay.remove();
      stylesheet?.remove();
      delete shell.dataset.m8eState;
    },
  });
}
