export type M8InspectorBlockIdV1 =
  | 'tool-properties'
  | 'brush-presets'
  | 'brush-studio'
  | 'color'
  | 'layers'
  | 'layer-properties'
  | 'effects-adjustments'
  | 'navigator'
  | 'reference-sub-view'
  | 'history'
  | 'quick-access'
  | 'assets'
  | 'auto-actions-timelapse';

export interface M8InspectorBlockSpecV1 {
  readonly id: M8InspectorBlockIdV1;
  readonly title: string;
  readonly icon: string;
  readonly tone: string;
  readonly productionState: 'available' | 'planned';
  readonly defaultExpanded: boolean;
}

export const M8_INSPECTOR_WIDTH_V1 = Object.freeze({ min: 260, default: 320, max: 480 });
export const M8_PIP_DEFAULT_WIDTH_V1 = 280;
export const M8_PIP_MIN_WIDTH_V1 = 220;
export const M8_PIP_MIN_HEIGHT_V1 = 140;
export const M8_INSPECTOR_WORKSPACE_KEY_V1 = 'illustro.m8.inspector-workspace.v1';
export const M8_INSPECTOR_SAVED_WORKSPACES_KEY_V1 = 'illustro.m8.saved-workspaces.v1';

export const M8_INSPECTOR_BLOCKS_V1: readonly M8InspectorBlockSpecV1[] = Object.freeze([
  {
    id: 'tool-properties',
    title: 'ツールプロパティ',
    icon: '☷',
    tone: 'blue',
    productionState: 'available',
    defaultExpanded: true,
  },
  {
    id: 'brush-presets',
    title: 'ブラシプリセット',
    icon: '✎',
    tone: 'orange',
    productionState: 'available',
    defaultExpanded: true,
  },
  {
    id: 'brush-studio',
    title: 'ブラシスタジオ',
    icon: '⌘',
    tone: 'violet',
    productionState: 'available',
    defaultExpanded: false,
  },
  {
    id: 'color',
    title: 'カラー',
    icon: '◉',
    tone: 'rainbow',
    productionState: 'available',
    defaultExpanded: true,
  },
  {
    id: 'layers',
    title: 'レイヤー',
    icon: '▱',
    tone: 'pink',
    productionState: 'available',
    defaultExpanded: true,
  },
  {
    id: 'layer-properties',
    title: 'レイヤープロパティ',
    icon: '◇',
    tone: 'cyan',
    productionState: 'available',
    defaultExpanded: false,
  },
  {
    id: 'effects-adjustments',
    title: '効果・調整',
    icon: '✦',
    tone: 'yellow',
    productionState: 'planned',
    defaultExpanded: false,
  },
  {
    id: 'navigator',
    title: 'ナビゲーター',
    icon: '⌖',
    tone: 'blue',
    productionState: 'planned',
    defaultExpanded: false,
  },
  {
    id: 'reference-sub-view',
    title: 'リファレンス / サブビュー',
    icon: '▧',
    tone: 'mint',
    productionState: 'available',
    defaultExpanded: false,
  },
  {
    id: 'history',
    title: '履歴',
    icon: '↶',
    tone: 'violet',
    productionState: 'available',
    defaultExpanded: false,
  },
  {
    id: 'quick-access',
    title: 'クイックアクセス',
    icon: '☆',
    tone: 'yellow',
    productionState: 'planned',
    defaultExpanded: false,
  },
  {
    id: 'assets',
    title: '素材',
    icon: '⬡',
    tone: 'magenta',
    productionState: 'available',
    defaultExpanded: false,
  },
  {
    id: 'auto-actions-timelapse',
    title: 'オートアクション / タイムラプス',
    icon: '◷',
    tone: 'orange',
    productionState: 'planned',
    defaultExpanded: false,
  },
]);

interface DetachedStateV1 {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly dockIndex: number;
}

interface InspectorWorkspaceStateV1 {
  readonly schema: 'illustro.m8.inspector-workspace/1';
  readonly inspectorWidth: number;
  readonly inspectorCollapsed: boolean;
  readonly order: readonly M8InspectorBlockIdV1[];
  readonly collapsed: readonly M8InspectorBlockIdV1[];
  readonly hidden: readonly M8InspectorBlockIdV1[];
  readonly detached: Readonly<Partial<Record<M8InspectorBlockIdV1, DetachedStateV1>>>;
}

interface SavedWorkspaceV1 {
  readonly name: string;
  readonly state: InspectorWorkspaceStateV1;
}

export interface M8InspectorDockHandleV1 {
  readonly element: HTMLElement;
  setWidth(width: number): void;
  toggleInspector(): void;
  openPanelManager(): void;
  resetWorkspace(): void;
  dispose(): void;
}

const BLOCK_IDS = new Set<M8InspectorBlockIdV1>(M8_INSPECTOR_BLOCKS_V1.map((entry) => entry.id));

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function defaultStateV1(): InspectorWorkspaceStateV1 {
  return Object.freeze({
    schema: 'illustro.m8.inspector-workspace/1' as const,
    inspectorWidth: M8_INSPECTOR_WIDTH_V1.default,
    inspectorCollapsed: false,
    order: Object.freeze(M8_INSPECTOR_BLOCKS_V1.map((entry) => entry.id)),
    collapsed: Object.freeze(
      M8_INSPECTOR_BLOCKS_V1.filter((entry) => !entry.defaultExpanded).map((entry) => entry.id),
    ),
    hidden: Object.freeze([]),
    detached: Object.freeze({}),
  });
}

function isBlockIdV1(value: unknown): value is M8InspectorBlockIdV1 {
  return typeof value === 'string' && BLOCK_IDS.has(value as M8InspectorBlockIdV1);
}

function normalizeStateV1(value: unknown): InspectorWorkspaceStateV1 {
  const fallback = defaultStateV1();
  if (typeof value !== 'object' || value === null) return fallback;
  const candidate = value as Partial<InspectorWorkspaceStateV1>;
  const order = Array.isArray(candidate.order)
    ? candidate.order.filter(isBlockIdV1)
    : [...fallback.order];
  for (const id of fallback.order) if (!order.includes(id)) order.push(id);
  const collapsed = Array.isArray(candidate.collapsed)
    ? candidate.collapsed.filter(isBlockIdV1)
    : [...fallback.collapsed];
  const hidden = Array.isArray(candidate.hidden) ? candidate.hidden.filter(isBlockIdV1) : [];
  const detached: Partial<Record<M8InspectorBlockIdV1, DetachedStateV1>> = {};
  if (candidate.detached && typeof candidate.detached === 'object') {
    for (const [rawId, rawState] of Object.entries(candidate.detached)) {
      if (!isBlockIdV1(rawId) || typeof rawState !== 'object' || rawState === null) continue;
      const state = rawState as Partial<DetachedStateV1>;
      detached[rawId] = Object.freeze({
        x: Number.isFinite(state.x) ? Number(state.x) : 24,
        y: Number.isFinite(state.y) ? Number(state.y) : 96,
        width: clamp(Number(state.width) || M8_PIP_DEFAULT_WIDTH_V1, M8_PIP_MIN_WIDTH_V1, 720),
        height: clamp(Number(state.height) || 260, M8_PIP_MIN_HEIGHT_V1, 900),
        dockIndex: Math.max(0, Math.floor(Number(state.dockIndex) || 0)),
      });
    }
  }
  return Object.freeze({
    schema: 'illustro.m8.inspector-workspace/1' as const,
    inspectorWidth: clamp(
      Number(candidate.inspectorWidth) || M8_INSPECTOR_WIDTH_V1.default,
      M8_INSPECTOR_WIDTH_V1.min,
      M8_INSPECTOR_WIDTH_V1.max,
    ),
    inspectorCollapsed: candidate.inspectorCollapsed === true,
    order: Object.freeze(order),
    collapsed: Object.freeze(collapsed),
    hidden: Object.freeze(hidden),
    detached: Object.freeze(detached),
  });
}

function readStateV1(storage: Storage | null): InspectorWorkspaceStateV1 {
  if (!storage) return defaultStateV1();
  try {
    const raw = storage.getItem(M8_INSPECTOR_WORKSPACE_KEY_V1);
    return raw ? normalizeStateV1(JSON.parse(raw)) : defaultStateV1();
  } catch {
    return defaultStateV1();
  }
}

function readSavedWorkspacesV1(storage: Storage | null): readonly SavedWorkspaceV1[] {
  if (!storage) return Object.freeze([]);
  try {
    const raw = storage.getItem(M8_INSPECTOR_SAVED_WORKSPACES_KEY_V1);
    const value = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(value)) return Object.freeze([]);
    return Object.freeze(
      value
        .filter(
          (entry) => typeof entry === 'object' && entry !== null && typeof entry.name === 'string',
        )
        .map((entry) => ({
          name: String(entry.name),
          state: normalizeStateV1((entry as { state?: unknown }).state),
        })),
    );
  } catch {
    return Object.freeze([]);
  }
}

function ensureStylesheetV1(): HTMLLinkElement | null {
  if (typeof document === 'undefined') return null;
  const existing = document.querySelector<HTMLLinkElement>('link[data-m8d-inspector-style]');
  if (existing) return existing;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = './m8-inspector.css';
  link.dataset.m8dInspectorStyle = 'true';
  document.head.append(link);
  return link;
}

function proxyButtonV1(id: string): void {
  const target = document.getElementById(id);
  if (target instanceof HTMLButtonElement && !target.disabled) target.click();
}

function renderBodyV1(spec: M8InspectorBlockSpecV1): string {
  const planned =
    spec.productionState === 'planned' ? '<span class="m8d-production-badge">接続待ち</span>' : '';
  if (spec.id === 'tool-properties') {
    return `<div class="m8d-tool-properties">
      <div class="m8d-property-row"><span>ブラシサイズ</span><div class="m8d-slider"><i style="width:62%"></i></div><strong data-m8d-live="brush-size">—</strong></div>
      <div class="m8d-property-row"><span>不透明度</span><div class="m8d-slider"><i style="width:88%"></i></div><strong>100%</strong></div>
      <div class="m8d-property-row"><span>手ぶれ補正</span><div class="m8d-slider"><i style="width:44%"></i></div><strong>12</strong></div>
      <small class="m8d-production-note">高頻度値。production brush stateと同期する表示面です。</small>
    </div>`;
  }
  if (spec.id === 'brush-presets') {
    return `<div class="m8d-preset-grid">${['鉛筆', 'ペン', 'マーカー', '水彩', 'エアブラシ', 'ぼかし'].map((name, index) => `<button type="button" data-m8d-preset-preview="${index}"><span>${['✎', '✒', '▰', '◒', '◌', '◍'][index]}</span><small>${name}</small></button>`).join('')}</div>`;
  }
  if (spec.id === 'brush-studio') {
    return `<div class="m8d-chip-grid">${['Tip', 'Stroke', 'Ink', 'Dynamics', 'Jitter', 'Spray', 'Texture', 'Mixing', 'Anti-overflow', 'Stabilization'].map((label) => `<span>${label}</span>`).join('')}</div>`;
  }
  if (spec.id === 'color') {
    return `<div class="m8d-color-body"><div class="m8d-color-wheel" aria-hidden="true"><i></i></div><div class="m8d-color-swatches"><button type="button" aria-label="メインカラー"></button><button type="button" aria-label="サブカラー"></button><button type="button" aria-label="前の色"></button></div></div>`;
  }
  if (spec.id === 'layers') {
    return `<div class="m8d-layer-toolbar"><button type="button" data-m8d-proxy="layer-add-raster" aria-label="レイヤー追加">＋</button><button type="button" aria-label="フォルダー">▱</button><button type="button" aria-label="選択レイヤー設定">•••</button></div>
      <div class="m8d-layer-list" data-m8d-layer-list>
        <div class="m8d-layer-row is-selected"><span class="m8d-eye">◉</span><span class="m8d-layer-thumb"></span><span class="m8d-layer-name">選択中レイヤー</span><button type="button" aria-label="ブレンドモード">◫</button><button type="button" aria-label="クリッピング">⌁</button></div>
        <div class="m8d-layer-row"><span class="m8d-eye">◉</span><span class="m8d-layer-thumb"></span><span class="m8d-layer-name">Layer</span><button type="button" aria-label="ブレンドモード">◫</button><button type="button" aria-label="クリッピング">⌁</button></div>
      </div>
      <div class="m8d-layer-actions"><button type="button" aria-label="名前変更">✎</button><button type="button" aria-label="不透明度">◐</button><button type="button" aria-label="ロック">♢</button><button type="button" aria-label="マスク">▣</button><button type="button" aria-label="効果">✦</button></div>`;
  }
  if (spec.id === 'layer-properties') {
    return `<div class="m8d-simple-list"><span>選択レイヤーの詳細</span><span>種類 / メタデータ / マスク</span><span>低頻度設定</span></div>`;
  }
  if (spec.id === 'effects-adjustments') {
    return `<div class="m8d-effect-stack"><span>＋ 効果を追加</span><span>非破壊スタック</span>${planned}</div>`;
  }
  if (spec.id === 'navigator') {
    return `<div class="m8d-navigator-preview"><div></div><span>100%</span>${planned}</div>`;
  }
  if (spec.id === 'reference-sub-view') {
    return `<div class="m8d-reference-preview"><div>Reference</div><div class="m8d-reference-actions"><button type="button">＋</button><button type="button">↺</button><button type="button">⌖</button></div></div>`;
  }
  if (spec.id === 'history') {
    return `<div class="m8d-history-list"><span>現在の状態</span><span>履歴はproduction Historyへ接続</span></div>`;
  }
  if (spec.id === 'quick-access') {
    return `<div class="m8d-quick-grid"><button type="button">↶</button><button type="button">↷</button><button type="button">☆</button><button type="button">＋</button>${planned}</div>`;
  }
  if (spec.id === 'assets') {
    return `<div class="m8d-assets-grid">${Array.from({ length: 6 }, (_, index) => `<span data-index="${index}"></span>`).join('')}</div>`;
  }
  return `<div class="m8d-auto-actions"><button type="button" disabled>● 記録</button><span>Auto Actions / Timelapse</span>${planned}</div>`;
}

function createBlockV1(spec: M8InspectorBlockSpecV1): HTMLElement {
  const block = document.createElement('section');
  block.className = 'm8d-inspector-block';
  block.dataset.m8dBlock = spec.id;
  block.dataset.tone = spec.tone;
  block.dataset.productionState = spec.productionState;
  block.innerHTML = `<header class="m8d-block-header">
    <button class="m8d-drag-handle" type="button" aria-label="${spec.title}を移動">⠿</button>
    <span class="m8d-block-icon" aria-hidden="true">${spec.icon}</span>
    <strong>${spec.title}</strong>
    <button class="m8d-detach" type="button" aria-label="${spec.title}を切り離す">↗</button>
    <button class="m8d-collapse" type="button" aria-label="${spec.title}を折りたたむ" aria-expanded="true">⌄</button>
    <button class="m8d-pip-return" type="button" aria-label="Inspectorへ戻す">×</button>
  </header><div class="m8d-block-body">${renderBodyV1(spec)}</div>`;
  return block;
}

export function installM8InspectorDockV1(app: HTMLElement): M8InspectorDockHandleV1 {
  const canonicalShell = app.querySelector<HTMLElement>('#m8-canonical-shell');
  const inspector = app.querySelector<HTMLElement>('.m8-inspector-dock');
  const editorLayout = app.querySelector<HTMLElement>('.m8-editor-layout');
  const actionStrip = app.querySelector<HTMLElement>('.m8-inspector-action-strip');
  if (!canonicalShell || !inspector || !editorLayout || !actionStrip) {
    throw new Error('M8D Inspector requires the canonical M8 shell.');
  }

  const stylesheet = ensureStylesheetV1();
  const storage = (() => {
    try {
      return globalThis.localStorage;
    } catch {
      return null;
    }
  })();
  let state = readStateV1(storage);
  let savedWorkspaces = readSavedWorkspacesV1(storage);

  inspector.classList.add('m8d-inspector-dock');
  inspector.innerHTML = `<div class="m8d-inspector-toolbar">
    <button type="button" data-m8d-inspector-toggle aria-label="Inspectorを折りたたむ">❯</button>
    <span>Inspector</span>
    <button type="button" data-m8d-panel-manager aria-label="パネルマネージャー">☷</button>
  </div><div class="m8d-block-list" data-m8d-block-list></div><div class="m8d-inspector-resize" role="separator" tabindex="0" aria-label="Inspector幅" aria-orientation="vertical"></div>`;

  const list = inspector.querySelector<HTMLElement>('[data-m8d-block-list]');
  const resizeHandle = inspector.querySelector<HTMLElement>('.m8d-inspector-resize');
  if (!list || !resizeHandle) throw new Error('M8D Inspector failed to create core controls.');

  const floatingLayer = document.createElement('div');
  floatingLayer.className = 'm8d-floating-layer';
  floatingLayer.dataset.m8dFloatingLayer = 'true';
  canonicalShell.append(floatingLayer);

  const dockCandidate = document.createElement('div');
  dockCandidate.className = 'm8d-dock-candidate';
  dockCandidate.hidden = true;
  list.append(dockCandidate);

  const panelManager = document.createElement('div');
  panelManager.className = 'm8d-panel-manager-layer';
  panelManager.hidden = true;
  panelManager.innerHTML = `<section class="m8d-panel-manager" role="dialog" aria-modal="true" aria-labelledby="m8d-panel-manager-title">
    <header><div><small>Workspace</small><h2 id="m8d-panel-manager-title">パネルマネージャー</h2></div><button type="button" data-m8d-panel-close aria-label="閉じる">×</button></header>
    <div class="m8d-panel-manager-body">
      <label class="m8d-workspace-select">ワークスペース<select data-m8d-workspace-select><option value="current">現在</option></select></label>
      <div class="m8d-panel-visibility" data-m8d-panel-visibility></div>
      <div class="m8d-panel-manager-actions"><button type="button" data-m8d-workspace-save>現在を保存</button><button type="button" data-m8d-workspace-reset>初期状態に戻す</button></div>
    </div>
  </section>`;
  canonicalShell.append(panelManager);

  const blocks = new Map<M8InspectorBlockIdV1, HTMLElement>();
  for (const spec of M8_INSPECTOR_BLOCKS_V1) blocks.set(spec.id, createBlockV1(spec));

  const snapshotState = (): InspectorWorkspaceStateV1 => {
    const order = Array.from(list.querySelectorAll<HTMLElement>('[data-m8d-block]'))
      .map((element) => element.dataset.m8dBlock)
      .filter(isBlockIdV1);
    for (const id of M8_INSPECTOR_BLOCKS_V1.map((entry) => entry.id))
      if (!order.includes(id)) order.push(id);
    const collapsed = Array.from(blocks.entries())
      .filter(([, block]) => block.classList.contains('is-collapsed'))
      .map(([id]) => id);
    const hidden = Array.from(blocks.entries())
      .filter(([, block]) => block.hidden)
      .map(([id]) => id);
    const detached: Partial<Record<M8InspectorBlockIdV1, DetachedStateV1>> = {};
    for (const [id, block] of blocks) {
      if (!block.classList.contains('is-detached')) continue;
      const rect = block.getBoundingClientRect();
      detached[id] = Object.freeze({
        x: Math.round(rect.left),
        y: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        dockIndex: state.detached[id]?.dockIndex ?? Math.max(0, state.order.indexOf(id)),
      });
    }
    return Object.freeze({
      schema: 'illustro.m8.inspector-workspace/1' as const,
      inspectorWidth: clamp(
        Number.parseFloat(canonicalShell.style.getPropertyValue('--m8-inspector-width')) ||
          state.inspectorWidth,
        M8_INSPECTOR_WIDTH_V1.min,
        M8_INSPECTOR_WIDTH_V1.max,
      ),
      inspectorCollapsed: canonicalShell.classList.contains('m8d-inspector-collapsed'),
      order: Object.freeze(order),
      collapsed: Object.freeze(collapsed),
      hidden: Object.freeze(hidden),
      detached: Object.freeze(detached),
    });
  };

  const persist = (): void => {
    state = snapshotState();
    try {
      storage?.setItem(M8_INSPECTOR_WORKSPACE_KEY_V1, JSON.stringify(state));
    } catch {
      // Workspace persistence is best-effort; editor correctness does not depend on it.
    }
  };

  const applyWidth = (width: number, shouldPersist = true): void => {
    const value = clamp(width, M8_INSPECTOR_WIDTH_V1.min, M8_INSPECTOR_WIDTH_V1.max);
    canonicalShell.style.setProperty('--m8-inspector-width', `${value}px`);
    resizeHandle.setAttribute('aria-valuemin', String(M8_INSPECTOR_WIDTH_V1.min));
    resizeHandle.setAttribute('aria-valuemax', String(M8_INSPECTOR_WIDTH_V1.max));
    resizeHandle.setAttribute('aria-valuenow', String(Math.round(value)));
    if (shouldPersist) persist();
  };

  const setInspectorCollapsed = (collapsed: boolean, shouldPersist = true): void => {
    canonicalShell.classList.toggle('m8d-inspector-collapsed', collapsed);
    const toggle = inspector.querySelector<HTMLButtonElement>('[data-m8d-inspector-toggle]');
    if (toggle) {
      toggle.setAttribute('aria-pressed', String(collapsed));
      toggle.setAttribute('aria-label', collapsed ? 'Inspectorを展開' : 'Inspectorを折りたたむ');
      toggle.textContent = collapsed ? '❮' : '❯';
    }
    if (shouldPersist) persist();
  };

  const setBlockCollapsed = (
    id: M8InspectorBlockIdV1,
    collapsed: boolean,
    shouldPersist = true,
  ): void => {
    const block = blocks.get(id);
    if (!block) return;
    block.classList.toggle('is-collapsed', collapsed);
    const button = block.querySelector<HTMLButtonElement>('.m8d-collapse');
    button?.setAttribute('aria-expanded', String(!collapsed));
    if (button) button.textContent = collapsed ? '›' : '⌄';
    if (shouldPersist) persist();
  };

  const insertAtIndex = (block: HTMLElement, index: number): void => {
    const docked = Array.from(list.querySelectorAll<HTMLElement>('[data-m8d-block]')).filter(
      (candidate) => candidate !== block,
    );
    const before = docked[Math.max(0, Math.min(index, docked.length))] ?? null;
    list.insertBefore(block, before ?? dockCandidate);
  };

  const redock = (id: M8InspectorBlockIdV1, index?: number): void => {
    const block = blocks.get(id);
    if (!block) return;
    block.classList.remove('is-detached');
    block.style.removeProperty('left');
    block.style.removeProperty('top');
    block.style.removeProperty('width');
    block.style.removeProperty('height');
    block.style.removeProperty('z-index');
    insertAtIndex(block, index ?? state.detached[id]?.dockIndex ?? state.order.indexOf(id));
    dockCandidate.hidden = true;
    persist();
  };

  let zCounter = 30;
  const detach = (id: M8InspectorBlockIdV1): void => {
    const block = blocks.get(id);
    if (!block || block.classList.contains('is-detached')) return;
    const docked = Array.from(list.querySelectorAll<HTMLElement>('[data-m8d-block]'));
    const dockIndex = Math.max(0, docked.indexOf(block));
    const rect = block.getBoundingClientRect();
    const previous = state.detached[id];
    floatingLayer.append(block);
    block.classList.add('is-detached');
    block.style.left = `${previous?.x ?? Math.max(20, rect.left - 18)}px`;
    block.style.top = `${previous?.y ?? Math.max(76, rect.top)}px`;
    block.style.width = `${previous?.width ?? M8_PIP_DEFAULT_WIDTH_V1}px`;
    block.style.height = `${previous?.height ?? Math.max(M8_PIP_MIN_HEIGHT_V1, Math.min(360, rect.height))}px`;
    block.style.zIndex = String(++zCounter);
    state = Object.freeze({
      ...snapshotState(),
      detached: Object.freeze({
        ...snapshotState().detached,
        [id]: Object.freeze({
          x: previous?.x ?? Math.max(20, rect.left - 18),
          y: previous?.y ?? Math.max(76, rect.top),
          width: previous?.width ?? M8_PIP_DEFAULT_WIDTH_V1,
          height: previous?.height ?? Math.max(M8_PIP_MIN_HEIGHT_V1, Math.min(360, rect.height)),
          dockIndex,
        }),
      }),
    });
    persist();
  };

  const applyState = (nextState: InspectorWorkspaceStateV1, shouldPersist = true): void => {
    state = normalizeStateV1(nextState);
    applyWidth(state.inspectorWidth, false);
    setInspectorCollapsed(state.inspectorCollapsed, false);
    for (const id of state.order) {
      const block = blocks.get(id);
      if (block) list.insertBefore(block, dockCandidate);
    }
    for (const [id, block] of blocks) {
      block.hidden = state.hidden.includes(id);
      setBlockCollapsed(id, state.collapsed.includes(id), false);
    }
    for (const id of state.order) {
      const detached = state.detached[id];
      if (!detached) continue;
      const block = blocks.get(id);
      if (!block) continue;
      floatingLayer.append(block);
      block.classList.add('is-detached');
      block.style.left = `${detached.x}px`;
      block.style.top = `${detached.y}px`;
      block.style.width = `${detached.width}px`;
      block.style.height = `${detached.height}px`;
      block.style.zIndex = String(++zCounter);
    }
    if (shouldPersist) persist();
  };

  const renderPanelManager = (): void => {
    const visibility = panelManager.querySelector<HTMLElement>('[data-m8d-panel-visibility]');
    const select = panelManager.querySelector<HTMLSelectElement>('[data-m8d-workspace-select]');
    if (!visibility || !select) return;
    visibility.replaceChildren();
    for (const spec of M8_INSPECTOR_BLOCKS_V1) {
      const row = document.createElement('label');
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = !blocks.get(spec.id)?.hidden;
      checkbox.dataset.m8dVisibility = spec.id;
      const icon = document.createElement('span');
      icon.textContent = spec.icon;
      const title = document.createElement('strong');
      title.textContent = spec.title;
      row.append(checkbox, icon, title);
      visibility.append(row);
    }
    select.innerHTML = '<option value="current">現在</option>';
    savedWorkspaces.forEach((workspace, index) => {
      const option = document.createElement('option');
      option.value = String(index);
      option.textContent = workspace.name;
      select.append(option);
    });
  };

  const openPanelManager = (): void => {
    renderPanelManager();
    panelManager.hidden = false;
  };
  const closePanelManager = (): void => {
    panelManager.hidden = true;
  };

  const saveCurrentWorkspace = (): void => {
    const current = snapshotState();
    const nextName = `Workspace ${savedWorkspaces.length + 1}`;
    savedWorkspaces = Object.freeze([
      ...savedWorkspaces,
      Object.freeze({ name: nextName, state: current }),
    ]);
    try {
      storage?.setItem(M8_INSPECTOR_SAVED_WORKSPACES_KEY_V1, JSON.stringify(savedWorkspaces));
    } catch {
      // Best-effort workspace convenience persistence.
    }
    renderPanelManager();
    const select = panelManager.querySelector<HTMLSelectElement>('[data-m8d-workspace-select]');
    if (select) select.value = String(savedWorkspaces.length - 1);
  };

  const resetWorkspace = (): void => {
    for (const id of M8_INSPECTOR_BLOCKS_V1.map((entry) => entry.id)) {
      const block = blocks.get(id);
      if (block?.classList.contains('is-detached'))
        redock(
          id,
          M8_INSPECTOR_BLOCKS_V1.findIndex((entry) => entry.id === id),
        );
    }
    applyState(defaultStateV1());
    renderPanelManager();
  };

  let resizePointerId: number | null = null;
  let resizeStartX = 0;
  let resizeStartWidth = M8_INSPECTOR_WIDTH_V1.default;
  const onResizeDown = (event: PointerEvent): void => {
    if (event.button !== 0) return;
    resizePointerId = event.pointerId;
    resizeStartX = event.clientX;
    resizeStartWidth = inspector.getBoundingClientRect().width;
    resizeHandle.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  };
  const onResizeMove = (event: PointerEvent): void => {
    if (event.pointerId !== resizePointerId) return;
    applyWidth(resizeStartWidth + resizeStartX - event.clientX, false);
  };
  const onResizeEnd = (event: PointerEvent): void => {
    if (event.pointerId !== resizePointerId) return;
    resizePointerId = null;
    persist();
  };
  const onResizeKey = (event: KeyboardEvent): void => {
    const current = Number(resizeHandle.getAttribute('aria-valuenow')) || state.inspectorWidth;
    if (event.key === 'ArrowLeft') {
      applyWidth(current + 8);
      event.preventDefault();
    } else if (event.key === 'ArrowRight') {
      applyWidth(current - 8);
      event.preventDefault();
    } else if (event.key === 'Home') {
      applyWidth(M8_INSPECTOR_WIDTH_V1.min);
      event.preventDefault();
    } else if (event.key === 'End') {
      applyWidth(M8_INSPECTOR_WIDTH_V1.max);
      event.preventDefault();
    }
  };
  resizeHandle.addEventListener('pointerdown', onResizeDown);
  resizeHandle.addEventListener('pointermove', onResizeMove);
  resizeHandle.addEventListener('pointerup', onResizeEnd);
  resizeHandle.addEventListener('pointercancel', onResizeEnd);
  resizeHandle.addEventListener('keydown', onResizeKey);

  let blockPointerId: number | null = null;
  let blockDragId: M8InspectorBlockIdV1 | null = null;
  let pointerOffsetX = 0;
  let pointerOffsetY = 0;
  let dockIndexCandidate: number | null = null;

  const onBlockPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0) return;
    const handle =
      event.target instanceof Element
        ? event.target.closest<HTMLElement>('.m8d-drag-handle')
        : null;
    const block = handle?.closest<HTMLElement>('[data-m8d-block]') ?? null;
    const id = block?.dataset.m8dBlock;
    if (!block || !isBlockIdV1(id)) return;
    blockPointerId = event.pointerId;
    blockDragId = id;
    const rect = block.getBoundingClientRect();
    pointerOffsetX = event.clientX - rect.left;
    pointerOffsetY = event.clientY - rect.top;
    block.style.zIndex = String(++zCounter);
    handle?.setPointerCapture?.(event.pointerId);
    block.classList.add('is-dragging');
    event.preventDefault();
  };

  const onBlockPointerMove = (event: PointerEvent): void => {
    if (event.pointerId !== blockPointerId || !blockDragId) return;
    const block = blocks.get(blockDragId);
    if (!block) return;
    if (block.classList.contains('is-detached')) {
      block.style.left = `${clamp(event.clientX - pointerOffsetX, 0, Math.max(0, innerWidth - M8_PIP_MIN_WIDTH_V1))}px`;
      block.style.top = `${clamp(event.clientY - pointerOffsetY, 64, Math.max(64, innerHeight - M8_PIP_MIN_HEIGHT_V1))}px`;
      const inspectorRect = inspector.getBoundingClientRect();
      const nearDock =
        event.clientX >= inspectorRect.left - 72 && event.clientX <= inspectorRect.right + 28;
      if (nearDock) {
        const docked = Array.from(list.querySelectorAll<HTMLElement>('[data-m8d-block]'));
        dockIndexCandidate = docked.findIndex(
          (candidate) =>
            event.clientY <
            candidate.getBoundingClientRect().top + candidate.getBoundingClientRect().height / 2,
        );
        if (dockIndexCandidate < 0) dockIndexCandidate = docked.length;
        const before = docked[dockIndexCandidate] ?? dockCandidate;
        list.insertBefore(dockCandidate, before);
        dockCandidate.hidden = false;
      } else {
        dockIndexCandidate = null;
        dockCandidate.hidden = true;
      }
      return;
    }
    const element = document.elementFromPoint(event.clientX, event.clientY);
    const target = element?.closest<HTMLElement>('[data-m8d-block]') ?? null;
    if (!target || target === block || target.classList.contains('is-detached')) return;
    const rect = target.getBoundingClientRect();
    if (event.clientY < rect.top + rect.height / 2) list.insertBefore(block, target);
    else list.insertBefore(block, target.nextSibling);
  };

  const onBlockPointerEnd = (event: PointerEvent): void => {
    if (event.pointerId !== blockPointerId || !blockDragId) return;
    const id = blockDragId;
    const block = blocks.get(id);
    block?.classList.remove('is-dragging');
    if (block?.classList.contains('is-detached') && dockIndexCandidate !== null)
      redock(id, dockIndexCandidate);
    else persist();
    dockCandidate.hidden = true;
    dockIndexCandidate = null;
    blockPointerId = null;
    blockDragId = null;
  };

  const onInspectorClick = (event: Event): void => {
    const target =
      event.target instanceof Element ? event.target.closest<HTMLButtonElement>('button') : null;
    if (!target) return;
    const block = target.closest<HTMLElement>('[data-m8d-block]');
    const id = block?.dataset.m8dBlock;
    if (target.matches('[data-m8d-inspector-toggle]')) {
      setInspectorCollapsed(!canonicalShell.classList.contains('m8d-inspector-collapsed'));
      return;
    }
    if (target.matches('[data-m8d-panel-manager]')) {
      openPanelManager();
      return;
    }
    if (!isBlockIdV1(id)) return;
    if (target.matches('.m8d-collapse'))
      setBlockCollapsed(id, !block?.classList.contains('is-collapsed'));
    else if (target.matches('.m8d-detach')) detach(id);
    else if (target.matches('.m8d-pip-return')) redock(id);
    else if (target.dataset.m8dProxy) proxyButtonV1(target.dataset.m8dProxy);
  };

  const onPanelClick = (event: Event): void => {
    const target =
      event.target instanceof Element
        ? event.target.closest<HTMLElement>('button,input,select')
        : null;
    if (!target) return;
    if (target.matches('[data-m8d-panel-close]')) closePanelManager();
    else if (target.matches('[data-m8d-workspace-save]')) saveCurrentWorkspace();
    else if (target.matches('[data-m8d-workspace-reset]')) resetWorkspace();
    else if (target instanceof HTMLInputElement && isBlockIdV1(target.dataset.m8dVisibility)) {
      const id = target.dataset.m8dVisibility;
      const block = blocks.get(id);
      if (block) block.hidden = !target.checked;
      persist();
    }
  };

  const onPanelChange = (event: Event): void => {
    const select =
      event.target instanceof HTMLSelectElement &&
      event.target.matches('[data-m8d-workspace-select]')
        ? event.target
        : null;
    if (!select || select.value === 'current') return;
    const index = Number(select.value);
    const workspace = savedWorkspaces[index];
    if (workspace) applyState(workspace.state);
  };

  inspector.addEventListener('click', onInspectorClick);
  inspector.addEventListener('pointerdown', onBlockPointerDown);
  inspector.addEventListener('pointermove', onBlockPointerMove);
  inspector.addEventListener('pointerup', onBlockPointerEnd);
  inspector.addEventListener('pointercancel', onBlockPointerEnd);
  floatingLayer.addEventListener('click', onInspectorClick);
  floatingLayer.addEventListener('pointerdown', onBlockPointerDown);
  floatingLayer.addEventListener('pointermove', onBlockPointerMove);
  floatingLayer.addEventListener('pointerup', onBlockPointerEnd);
  floatingLayer.addEventListener('pointercancel', onBlockPointerEnd);
  panelManager.addEventListener('click', onPanelClick);
  panelManager.addEventListener('change', onPanelChange);

  const resizeObserver =
    typeof ResizeObserver === 'function'
      ? new ResizeObserver(() => {
          if (Array.from(blocks.values()).some((block) => block.classList.contains('is-detached')))
            persist();
        })
      : null;
  for (const block of blocks.values()) resizeObserver?.observe(block);

  actionStrip.innerHTML = `<button type="button" data-m8d-action="undo" aria-label="元に戻す">↶</button><button type="button" data-m8d-action="redo" aria-label="やり直す">↷</button><button type="button" data-m8d-action="flip-horizontal" aria-label="左右反転表示">⇄</button><button type="button" data-m8d-action="flip-vertical" aria-label="上下反転表示">⇅</button>`;
  const onActionStripClick = (event: Event): void => {
    const button =
      event.target instanceof Element
        ? event.target.closest<HTMLButtonElement>('[data-m8d-action]')
        : null;
    if (!button) return;
    if (button.dataset.m8dAction === 'undo') proxyButtonV1('history-undo');
    else if (button.dataset.m8dAction === 'redo') proxyButtonV1('history-redo');
    else {
      canonicalShell.dataset.m8dViewCommand = button.dataset.m8dAction ?? '';
      canonicalShell.dispatchEvent(
        new CustomEvent('illustro:m8d-view-command', { detail: button.dataset.m8dAction }),
      );
    }
  };
  actionStrip.addEventListener('click', onActionStripClick);

  const runtimeObserver =
    typeof MutationObserver === 'function'
      ? new MutationObserver(() => {
          const brushSize = canonicalShell.querySelector<HTMLElement>(
            '[data-m8d-live="brush-size"]',
          );
          if (brushSize)
            brushSize.textContent = document.documentElement.dataset.illustroBrushSize ?? '—';
          const activeLayerId = document.documentElement.dataset.illustroActiveLayerId;
          const layerName = canonicalShell.querySelector<HTMLElement>(
            '.m8d-layer-row.is-selected .m8d-layer-name',
          );
          if (layerName && activeLayerId)
            layerName.textContent = `Layer · ${activeLayerId.slice(0, 6)}`;
        })
      : null;
  runtimeObserver?.observe(document.documentElement, { attributes: true });

  applyState(state, false);
  renderPanelManager();
  app.dataset.m8InspectorDock = 'provisional';

  return Object.freeze({
    element: inspector,
    setWidth: applyWidth,
    toggleInspector(): void {
      setInspectorCollapsed(!canonicalShell.classList.contains('m8d-inspector-collapsed'));
    },
    openPanelManager,
    resetWorkspace,
    dispose(): void {
      resizeObserver?.disconnect();
      runtimeObserver?.disconnect();
      inspector.removeEventListener('click', onInspectorClick);
      inspector.removeEventListener('pointerdown', onBlockPointerDown);
      inspector.removeEventListener('pointermove', onBlockPointerMove);
      inspector.removeEventListener('pointerup', onBlockPointerEnd);
      inspector.removeEventListener('pointercancel', onBlockPointerEnd);
      floatingLayer.removeEventListener('click', onInspectorClick);
      floatingLayer.removeEventListener('pointerdown', onBlockPointerDown);
      floatingLayer.removeEventListener('pointermove', onBlockPointerMove);
      floatingLayer.removeEventListener('pointerup', onBlockPointerEnd);
      floatingLayer.removeEventListener('pointercancel', onBlockPointerEnd);
      panelManager.removeEventListener('click', onPanelClick);
      panelManager.removeEventListener('change', onPanelChange);
      resizeHandle.removeEventListener('pointerdown', onResizeDown);
      resizeHandle.removeEventListener('pointermove', onResizeMove);
      resizeHandle.removeEventListener('pointerup', onResizeEnd);
      resizeHandle.removeEventListener('pointercancel', onResizeEnd);
      resizeHandle.removeEventListener('keydown', onResizeKey);
      actionStrip.removeEventListener('click', onActionStripClick);
      panelManager.remove();
      floatingLayer.remove();
      canonicalShell.classList.remove('m8d-inspector-collapsed');
      canonicalShell.style.removeProperty('--m8-inspector-width');
      stylesheet?.remove();
      delete app.dataset.m8InspectorDock;
    },
  });
}
