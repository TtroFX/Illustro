import type { M8SelectionContextLayerHandleV1 } from './m8-selection-context-layer.js';

export type M8ContextualCanvasModeV1 = 'ruler' | 'lineart';

export interface M8ContextualCanvasControllerHandleV1 {
  readonly element: HTMLElement;
  mode(): M8ContextualCanvasModeV1 | null;
  showRulerPreview(): void;
  showLineartPreview(): void;
  hide(): void;
  dispose(): void;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

function previewModeFromLocationV1(): M8ContextualCanvasModeV1 | null {
  if (typeof location === 'undefined') return null;
  const value = new URLSearchParams(location.search).get('m8e-preview');
  return value === 'ruler' || value === 'lineart' ? value : null;
}

function createPreviewButtonV1(label: string, glyph: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.disabled = true;
  button.dataset.productionState = 'pending-dependency';
  button.setAttribute('aria-label', label);
  button.title = `${label} — production接続待ち`;
  button.innerHTML = `<span aria-hidden="true">${glyph}</span>`;
  return button;
}

function createToolbarV1(): HTMLElement {
  const toolbar = document.createElement('div');
  toolbar.className = 'm8e-context-preview-toolbar';
  toolbar.setAttribute('role', 'toolbar');
  toolbar.setAttribute('aria-label', 'Contextual canvas controls preview');
  return toolbar;
}

function createSvgV1(className: string): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.classList.add(className);
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('viewBox', '0 0 1000 700');
  svg.setAttribute('preserveAspectRatio', 'none');
  return svg;
}

function renderRulerV1(host: HTMLElement): void {
  host.replaceChildren();
  host.dataset.contextKind = 'ruler';
  host.setAttribute('aria-label', '定規・ガイド contextual controls preview');

  const svg = createSvgV1('m8e-ruler-preview-svg');
  const line = document.createElementNS(SVG_NS, 'line');
  line.classList.add('m8e-ruler-guide-line');
  line.setAttribute('x1', '180');
  line.setAttribute('y1', '500');
  line.setAttribute('x2', '820');
  line.setAttribute('y2', '205');
  const extensionA = document.createElementNS(SVG_NS, 'line');
  extensionA.classList.add('m8e-ruler-guide-extension');
  extensionA.setAttribute('x1', '92');
  extensionA.setAttribute('y1', '540');
  extensionA.setAttribute('x2', '180');
  extensionA.setAttribute('y2', '500');
  const extensionB = document.createElementNS(SVG_NS, 'line');
  extensionB.classList.add('m8e-ruler-guide-extension');
  extensionB.setAttribute('x1', '820');
  extensionB.setAttribute('y1', '205');
  extensionB.setAttribute('x2', '906');
  extensionB.setAttribute('y2', '165');
  svg.append(extensionA, line, extensionB);

  for (const [x, y, kind] of [
    [180, 500, 'start'],
    [500, 352, 'center'],
    [820, 205, 'end'],
  ] as const) {
    const node = document.createElementNS(SVG_NS, 'circle');
    node.classList.add('m8e-ruler-guide-node');
    node.dataset.nodeKind = kind;
    node.setAttribute('cx', String(x));
    node.setAttribute('cy', String(y));
    node.setAttribute('r', kind === 'center' ? '9' : '7');
    svg.append(node);
  }

  const toolbar = createToolbarV1();
  toolbar.dataset.contextKind = 'ruler';
  const identity = document.createElement('span');
  identity.className = 'm8e-context-preview-identity';
  identity.innerHTML = '<strong>直線定規</strong><small>Preview · M7D接続待ち</small>';
  const controls = document.createElement('div');
  controls.className = 'm8e-context-preview-controls';
  controls.append(
    createPreviewButtonV1('定規を移動', '✥'),
    createPreviewButtonV1('角度を編集', '∠'),
    createPreviewButtonV1('中心を移動', '⊙'),
    createPreviewButtonV1('スナップ切替', '⌁'),
  );
  toolbar.append(identity, controls);

  const note = document.createElement('div');
  note.className = 'm8e-context-preview-note';
  note.textContent = 'Canvas上では位置・角度・中心・位相を直接操作。数値値はTool Propertiesへ。';
  host.append(svg, toolbar, note);
}

function createLineartEdgeV1(
  svg: SVGSVGElement,
  state: 'automatic' | 'manual' | 'rejected' | 'unresolved',
  pathValue: string,
): void {
  const path = document.createElementNS(SVG_NS, 'path');
  path.classList.add('m8e-lineart-edge', `is-${state}`);
  path.dataset.boundaryState = state;
  path.setAttribute('d', pathValue);
  svg.append(path);
}

function createLineartNodeV1(
  svg: SVGSVGElement,
  x: number,
  y: number,
  state: 'endpoint' | 'junction' | 'rejected' | 'unresolved',
): void {
  if (state === 'rejected') {
    const group = document.createElementNS(SVG_NS, 'g');
    group.classList.add('m8e-lineart-node', 'is-rejected');
    group.dataset.nodeState = state;
    for (const [dx1, dy1, dx2, dy2] of [
      [-8, -8, 8, 8],
      [-8, 8, 8, -8],
    ] as const) {
      const line = document.createElementNS(SVG_NS, 'line');
      line.setAttribute('x1', String(x + dx1));
      line.setAttribute('y1', String(y + dy1));
      line.setAttribute('x2', String(x + dx2));
      line.setAttribute('y2', String(y + dy2));
      group.append(line);
    }
    svg.append(group);
    return;
  }
  if (state === 'unresolved') {
    const diamond = document.createElementNS(SVG_NS, 'rect');
    diamond.classList.add('m8e-lineart-node', 'is-unresolved');
    diamond.dataset.nodeState = state;
    diamond.setAttribute('x', String(x - 7));
    diamond.setAttribute('y', String(y - 7));
    diamond.setAttribute('width', '14');
    diamond.setAttribute('height', '14');
    diamond.setAttribute('transform', `rotate(45 ${x} ${y})`);
    svg.append(diamond);
    return;
  }
  const circle = document.createElementNS(SVG_NS, 'circle');
  circle.classList.add('m8e-lineart-node', `is-${state}`);
  circle.dataset.nodeState = state;
  circle.setAttribute('cx', String(x));
  circle.setAttribute('cy', String(y));
  circle.setAttribute('r', state === 'junction' ? '9' : '6');
  svg.append(circle);
}

function renderLineartV1(host: HTMLElement): void {
  host.replaceChildren();
  host.dataset.contextKind = 'lineart';
  host.setAttribute('aria-label', 'Lineart Boundary contextual overlay preview');

  const svg = createSvgV1('m8e-lineart-preview-svg');
  createLineartEdgeV1(svg, 'automatic', 'M 190 490 C 310 420 360 330 500 340');
  createLineartEdgeV1(svg, 'manual', 'M 500 340 C 635 350 690 260 820 210');
  createLineartEdgeV1(svg, 'unresolved', 'M 500 340 C 530 455 635 505 760 530');
  createLineartEdgeV1(svg, 'rejected', 'M 500 340 C 420 250 335 220 255 165');
  createLineartNodeV1(svg, 190, 490, 'endpoint');
  createLineartNodeV1(svg, 500, 340, 'junction');
  createLineartNodeV1(svg, 820, 210, 'endpoint');
  createLineartNodeV1(svg, 760, 530, 'unresolved');
  createLineartNodeV1(svg, 255, 165, 'rejected');

  const toolbar = createToolbarV1();
  toolbar.dataset.contextKind = 'lineart';
  const identity = document.createElement('span');
  identity.className = 'm8e-context-preview-identity';
  identity.innerHTML = '<strong>Lineart Boundary</strong><small>Topology Preview · M7F接続待ち</small>';
  const controls = document.createElement('div');
  controls.className = 'm8e-context-preview-controls';
  controls.append(
    createPreviewButtonV1('境界を接続', '⌁'),
    createPreviewButtonV1('境界を分離', '⌇'),
    createPreviewButtonV1('境界を分割', '✂'),
    createPreviewButtonV1('境界候補を拒否', '×'),
    createPreviewButtonV1('未解決を確認', '◇'),
  );
  toolbar.append(identity, controls);

  const legend = document.createElement('div');
  legend.className = 'm8e-lineart-preview-legend';
  legend.innerHTML = [
    '<span data-state="automatic"><i></i>自動</span>',
    '<span data-state="manual"><i></i>手動</span>',
    '<span data-state="unresolved"><i></i>未解決</span>',
    '<span data-state="rejected"><i></i>除外</span>',
  ].join('');
  host.append(svg, toolbar, legend);
}

export function installM8ContextualCanvasControllerV1(input: {
  readonly root: HTMLElement;
  readonly context: M8SelectionContextLayerHandleV1;
}): M8ContextualCanvasControllerHandleV1 {
  const host = document.createElement('section');
  host.className = 'm8e-context-preview';
  host.hidden = true;
  host.dataset.productionState = 'pending-dependency';
  input.context.overlay.append(host);

  let currentMode: M8ContextualCanvasModeV1 | null = null;
  let disposed = false;

  const show = (mode: M8ContextualCanvasModeV1): void => {
    if (disposed) return;
    currentMode = mode;
    if (mode === 'ruler') renderRulerV1(host);
    else renderLineartV1(host);
    host.hidden = false;
    input.root.dataset.illustroM8ContextPreview = mode;
    input.context.announce(
      mode === 'ruler'
        ? '定規 contextual controls preview。production接続待ちです'
        : 'Lineart Boundary contextual overlay preview。production接続待ちです',
    );
  };

  const hide = (): void => {
    currentMode = null;
    host.hidden = true;
    host.replaceChildren();
    delete input.root.dataset.illustroM8ContextPreview;
  };

  const requestedPreview = previewModeFromLocationV1();
  if (requestedPreview !== null) show(requestedPreview);

  return Object.freeze({
    element: host,
    mode: () => currentMode,
    showRulerPreview: () => show('ruler'),
    showLineartPreview: () => show('lineart'),
    hide,
    dispose(): void {
      if (disposed) return;
      disposed = true;
      hide();
      host.remove();
    },
  });
}
