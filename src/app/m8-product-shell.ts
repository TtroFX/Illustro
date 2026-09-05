export const M8_PRODUCT_REGIONS_V1 = Object.freeze([
  'document-bar',
  'tool-rail',
  'canvas-workspace',
  'inspector-dock',
  'inspector-action-strip',
] as const);

export const M8_TASK_SURFACES_V1 = Object.freeze([
  'new-document',
  'import-report',
  'export',
  'preferences',
  'settings',
  'help',
  'compatibility-diagnostics',
  'shortcut-customization',
  'workspace-customization',
  'destructive-confirmation',
] as const);

export type M8SaveStateV1 = 'saved' | 'saving' | 'recovery' | 'warning';
export type M8TaskSurfaceIdV1 = (typeof M8_TASK_SURFACES_V1)[number];

export interface M8ProductShellHandleV1 {
  showLibrary(): void;
  hideLibrary(): void;
  setDocumentIdentity(name: string): void;
  setSaveState(state: M8SaveStateV1, label?: string): void;
  openTaskSurface(title: string, body: string): void;
  openNamedTaskSurface(surfaceId: M8TaskSurfaceIdV1): void;
  closeTaskSurface(): void;
  showToast(message: string): void;
  dispose(): void;
}

const CANONICAL_SHELL_ID = 'm8-canonical-shell';
const COMPATIBILITY_HOST_ID = 'm8-compatibility-host';
const LIBRARY_ID = 'm8-library-surface';
const TASK_LAYER_ID = 'm8-task-layer';
const TASK_SURFACE_ID = 'm8-task-surface';
const DOCUMENT_IDENTITY_ID = 'm8-document-identity';
const SAVE_STATE_ID = 'm8-save-state';
const TOAST_ID = 'm8-toast';
const DATA_SAFETY_BANNER_ID = 'm8-data-safety-banner';

const TASK_SURFACE_COPY_V1: Readonly<
  Record<
    M8TaskSurfaceIdV1,
    { readonly title: string; readonly body: string; readonly tone?: string }
  >
> = Object.freeze({
  'new-document': {
    title: '新規ドキュメント',
    body: 'サイズ、解像度、背景、カラーモードを設定するタスク面です。production入力は既存Document基盤へ段階的に接続します。',
  },
  'import-report': {
    title: 'インポート結果',
    body: '読み込み結果、変換内容、警告、非対応項目を一か所で確認するレポート面です。',
  },
  export: {
    title: '書き出し',
    body: '形式、サイズ、背景、品質などの書き出し設定をまとめるタスク面です。',
  },
  preferences: {
    title: '環境設定',
    body: '入力、表示、パフォーマンスなどアプリ全体の動作設定をまとめるタスク面です。',
  },
  settings: {
    title: '設定',
    body: 'Illustroのアプリ設定へアクセスする共通タスク面です。',
  },
  help: {
    title: 'ヘルプ',
    body: '操作ガイド、ショートカット、診断への導線をまとめるヘルプ面です。',
  },
  'compatibility-diagnostics': {
    title: '互換性と診断',
    body: 'ブラウザ・GPU・入力・ストレージなどのCapability状態と診断導線を表示する面です。',
  },
  'shortcut-customization': {
    title: 'ショートカット',
    body: 'キーボード・ペンボタン等のCommand bindingを編集する専用面です。詳細配線はM8Gで接続します。',
  },
  'workspace-customization': {
    title: 'ワークスペース',
    body: 'Rail、Inspector、PiP、表示ブロック等のワークスペース構成を編集する面です。詳細配線はM8Dで接続します。',
  },
  'destructive-confirmation': {
    title: '変更を確認',
    body: '元に戻せない、または影響の大きい操作だけに使う確認面です。通常操作を不要に遮断しません。',
    tone: 'danger',
  },
});

function requireElementV1<T extends Element>(root: ParentNode, selector: string, label: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`M8 product shell is missing ${label}.`);
  return element;
}

function makeIconButtonV1(input: {
  readonly label: string;
  readonly glyph: string;
  readonly className?: string;
  readonly tooltip?: string;
}): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = input.className ?? 'm8-icon-button';
  button.setAttribute('aria-label', input.label);
  button.dataset.m8Tooltip = input.tooltip ?? input.label;
  button.innerHTML = `<span aria-hidden="true">${input.glyph}</span>`;
  return button;
}

function createMenuV1(
  label: string,
  items: readonly {
    readonly label: string;
    readonly task?: M8TaskSurfaceIdV1;
    readonly proxyId?: string;
  }[],
): HTMLDetailsElement {
  const details = document.createElement('details');
  details.className = 'm8-menu';
  const summary = document.createElement('summary');
  summary.textContent = label;
  details.append(summary);
  const popover = document.createElement('div');
  popover.className = 'm8-menu-popover';
  popover.setAttribute('role', 'menu');
  for (const item of items) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = item.label;
    button.setAttribute('role', 'menuitem');
    if (item.task) button.dataset.m8Task = item.task;
    if (item.proxyId) button.dataset.m8ProxyId = item.proxyId;
    popover.append(button);
  }
  details.append(popover);
  return details;
}

function createDocumentBarV1(): HTMLElement {
  const bar = document.createElement('header');
  bar.className = 'm8-document-bar';
  bar.dataset.m8Region = 'document-bar';
  bar.innerHTML = `
    <div class="m8-document-bar-leading">
      <button class="m8-app-menu-button" type="button" aria-label="アプリケーションメニュー" data-m8-tooltip="メニュー">
        <span aria-hidden="true"></span><span aria-hidden="true"></span><span aria-hidden="true"></span>
      </button>
      <button class="m8-wordmark" type="button" data-m8-library-open aria-label="Project Libraryを開く">Illustro</button>
      <output id="${DOCUMENT_IDENTITY_ID}" class="m8-document-identity" aria-label="現在のドキュメント">Illustration</output>
    </div>
    <nav class="m8-application-menus" aria-label="Application menus"></nav>
    <div class="m8-document-bar-actions">
      <button class="m8-icon-button" type="button" data-m8-proxy-id="history-undo" data-m8-tooltip="元に戻す" aria-label="元に戻す"><span aria-hidden="true">↶</span></button>
      <button class="m8-icon-button" type="button" data-m8-proxy-id="history-redo" data-m8-tooltip="やり直す" aria-label="やり直す"><span aria-hidden="true">↷</span></button>
      <button class="m8-icon-button m8-favorite-button" type="button" data-m8-tooltip="クイックアクセス" aria-label="クイックアクセス"><span aria-hidden="true">☆</span></button>
      <output id="${SAVE_STATE_ID}" class="m8-save-state" data-state="saved" aria-label="保存状態">保存済み</output>
      <button class="m8-profile-button" type="button" data-m8-task="settings" data-m8-tooltip="設定" aria-label="設定"><span aria-hidden="true">●</span></button>
    </div>`;

  const nav = requireElementV1<HTMLElement>(bar, '.m8-application-menus', 'Application menus');
  nav.append(
    createMenuV1('ファイル', [
      { label: '新規作成…', task: 'new-document' },
      { label: 'インポート…', task: 'import-report' },
      { label: '書き出し…', task: 'export' },
      { label: 'ライブラリへ戻る', proxyId: 'm8-library-open-proxy' },
    ]),
    createMenuV1('編集', [
      { label: '元に戻す', proxyId: 'history-undo' },
      { label: 'やり直す', proxyId: 'history-redo' },
      { label: 'ショートカット…', task: 'shortcut-customization' },
    ]),
    createMenuV1('ページ', [{ label: 'ドキュメント設定…', task: 'preferences' }]),
    createMenuV1('レイヤー', [{ label: 'レイヤー操作', task: 'preferences' }]),
    createMenuV1('選択範囲', [{ label: '選択範囲操作', task: 'preferences' }]),
    createMenuV1('表示', [
      { label: '表示をリセット', proxyId: 'view-reset' },
      { label: '画面に合わせる', proxyId: 'view-fit' },
      { label: 'ワークスペース…', task: 'workspace-customization' },
    ]),
    createMenuV1('フィルター', [{ label: 'フィルター操作', task: 'preferences' }]),
    createMenuV1('ウィンドウ', [{ label: 'ワークスペース…', task: 'workspace-customization' }]),
    createMenuV1('ヘルプ', [
      { label: 'ヘルプ', task: 'help' },
      { label: '互換性と診断', task: 'compatibility-diagnostics' },
    ]),
  );
  return bar;
}

function createToolRailShellV1(): HTMLElement {
  const rail = document.createElement('aside');
  rail.className = 'm8-tool-rail';
  rail.dataset.m8Region = 'tool-rail';
  rail.setAttribute('aria-label', 'Primary Tool Rail');
  rail.innerHTML = `
    <div class="m8-rail-shell-head" aria-hidden="true"><span></span></div>
    <div class="m8-rail-shell-slots" aria-label="Tool Rail shell">
      ${Array.from({ length: 10 }, (_, index) => `<span class="m8-rail-shell-slot" data-slot="${index + 1}" aria-hidden="true"><i></i><b></b></span>`).join('')}
    </div>
    <details class="m8-rail-flyout-demo">
      <summary aria-label="ツールファミリーFlyout基盤" data-m8-tooltip="Tool family flyout">•••</summary>
      <div class="m8-tool-family-flyout"><strong>Tool family</strong><span>M8Cで内容を接続</span></div>
    </details>`;
  return rail;
}

function createCanvasWorkspaceV1(input: {
  readonly canvas: HTMLCanvasElement;
  readonly gridOverlay: HTMLElement | null;
  readonly brushHover: HTMLElement | null;
}): HTMLElement {
  const workspace = document.createElement('main');
  workspace.className = 'm8-canvas-workspace';
  workspace.dataset.m8Region = 'canvas-workspace';
  workspace.setAttribute('aria-label', 'Canvas Workspace');
  workspace.innerHTML = `
    <div class="m8-document-tabs" aria-label="Document">
      <button type="button" class="m8-home-button" data-m8-library-open data-m8-tooltip="Project Library" aria-label="Project Libraryを開く">⌂</button>
      <div class="m8-document-tab is-active"><span>Illustration</span><span aria-hidden="true">×</span></div>
    </div>
    <div class="m8-canvas-stage shell-canvas-stage">
      <div id="canvas-viewport-frame" class="m8-canvas-frame"></div>
      <div class="m8-context-action-surface" data-m8-context-surface hidden aria-label="Contextual actions"></div>
    </div>`;
  const frame = requireElementV1<HTMLElement>(workspace, '#canvas-viewport-frame', 'Canvas frame');
  input.canvas.classList.remove('shell-canvas');
  input.canvas.classList.add('m8-canvas');
  frame.append(input.canvas);
  if (input.gridOverlay) {
    input.gridOverlay.classList.remove('shell-grid-overlay');
    input.gridOverlay.classList.add('m8-grid-overlay');
    frame.append(input.gridOverlay);
  }
  if (input.brushHover) {
    input.brushHover.classList.remove('shell-brush-hover-outline');
    input.brushHover.classList.add('m8-brush-hover-outline');
    requireElementV1<HTMLElement>(workspace, '.m8-canvas-stage', 'Canvas stage').append(
      input.brushHover,
    );
  }
  return workspace;
}

function createInspectorShellV1(): HTMLElement {
  const inspector = document.createElement('aside');
  inspector.className = 'm8-inspector-dock';
  inspector.dataset.m8Region = 'inspector-dock';
  inspector.setAttribute('aria-label', 'Inspector Dock');
  inspector.innerHTML = `
    <div class="m8-inspector-tabs" aria-label="Inspector shell">
      <span class="is-active"></span><span></span><span></span><span></span><span></span>
    </div>
    <section class="m8-inspector-shell-card m8-inspector-shell-primary">
      <header><span></span><span></span></header>
      <div class="m8-inspector-shell-row"></div>
      <div class="m8-inspector-shell-row"></div>
      <div class="m8-inspector-shell-row is-tall"></div>
    </section>
    <section class="m8-inspector-shell-card">
      <header><span></span><span></span></header>
      <div class="m8-inspector-shell-grid">${Array.from({ length: 10 }, () => '<i></i>').join('')}</div>
    </section>
    <section class="m8-inspector-shell-card m8-inspector-shell-compact">
      <header><span></span><span></span></header>
      <div class="m8-inspector-shell-row"></div>
      <div class="m8-inspector-shell-row"></div>
    </section>`;
  return inspector;
}

function createInspectorActionStripV1(): HTMLElement {
  const strip = document.createElement('div');
  strip.className = 'm8-inspector-action-strip';
  strip.dataset.m8Region = 'inspector-action-strip';
  strip.setAttribute('aria-label', 'Inspector actions');
  strip.innerHTML =
    '<button type="button" aria-label="追加">＋</button><button type="button" aria-label="その他">•••</button>';
  return strip;
}

function createLibrarySurfaceV1(): HTMLElement {
  const surface = document.createElement('section');
  surface.id = LIBRARY_ID;
  surface.className = 'm8-library-surface';
  surface.hidden = true;
  surface.setAttribute('aria-label', 'Project Library');
  surface.innerHTML = `
    <header class="m8-library-header">
      <div><span class="m8-eyebrow">Illustro</span><h1>Project Library</h1></div>
      <button type="button" data-m8-library-close>エディターへ戻る</button>
    </header>
    <div class="m8-library-toolbar" aria-label="Library controls">
      <label>検索<input type="search" disabled placeholder="プロジェクトを検索" aria-label="プロジェクト検索（M9A接続後に利用可能）" /></label>
      <button type="button" disabled>並び替え</button>
      <button type="button" data-m8-task="new-document">新規プロジェクト</button>
    </div>
    <div class="m8-library-body">
      <section class="m8-library-hero" aria-label="Library placeholder">
        <div class="m8-library-mark" aria-hidden="true">I</div>
        <h2>作品をここに集約</h2>
        <p>Libraryのproduction一覧・検索・復元はM9Aへ接続後に有効になります。M8Bでは正本UIシェルのみを先行します。</p>
        <span class="m8-provisional-badge">UI shell · 仮完了</span>
      </section>
    </div>`;
  surface.dataset.m8ProductionState = 'planned';
  return surface;
}

function createTaskLayerV1(): HTMLElement {
  const layer = document.createElement('div');
  layer.id = TASK_LAYER_ID;
  layer.className = 'm8-task-layer';
  layer.hidden = true;
  layer.innerHTML = `
    <section id="${TASK_SURFACE_ID}" class="m8-task-surface" role="dialog" aria-modal="true" aria-labelledby="m8-task-title">
      <header><div><span class="m8-task-kicker">Illustro</span><h2 id="m8-task-title"></h2></div><button type="button" data-m8-task-close aria-label="閉じる">×</button></header>
      <div class="m8-task-body"></div>
      <footer class="m8-task-footer"><button type="button" data-m8-task-close>閉じる</button><button type="button" class="m8-task-primary" disabled>適用</button></footer>
    </section>`;
  return layer;
}

function createSafetyBannerV1(): HTMLElement {
  const banner = document.createElement('div');
  banner.id = DATA_SAFETY_BANNER_ID;
  banner.className = 'm8-data-safety-banner';
  banner.hidden = true;
  banner.setAttribute('role', 'status');
  banner.innerHTML =
    '<strong>保存状態を確認してください</strong><span>復元可能な状態を保ったまま作業を続けます。</span>';
  return banner;
}

function createToastV1(): HTMLElement {
  const toast = document.createElement('div');
  toast.id = TOAST_ID;
  toast.className = 'm8-toast';
  toast.hidden = true;
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  return toast;
}

function createCanonicalShellV1(input: {
  readonly canvas: HTMLCanvasElement;
  readonly gridOverlay: HTMLElement | null;
  readonly brushHover: HTMLElement | null;
}): HTMLElement {
  const shell = document.createElement('div');
  shell.id = CANONICAL_SHELL_ID;
  shell.className = 'm8-canonical-shell';
  shell.dataset.m8Canonical = 'true';
  const bar = createDocumentBarV1();
  const workspace = document.createElement('div');
  workspace.className = 'm8-editor-layout';
  workspace.append(
    createToolRailShellV1(),
    createCanvasWorkspaceV1(input),
    createInspectorShellV1(),
  );
  const actionStrip = createInspectorActionStripV1();
  const library = createLibrarySurfaceV1();
  const task = createTaskLayerV1();
  const safety = createSafetyBannerV1();
  const toast = createToastV1();
  shell.append(bar, workspace, actionStrip, library, task, safety, toast);
  return shell;
}

function proxyLegacyCommandV1(proxyId: string): void {
  if (proxyId === 'm8-library-open-proxy') return;
  const target = document.getElementById(proxyId);
  if (target instanceof HTMLButtonElement && !target.disabled) target.click();
}

export function installM8ProductShellV1(app: HTMLElement): M8ProductShellHandleV1 {
  const canvas = requireElementV1<HTMLCanvasElement>(app, '#render-surface', 'production canvas');
  const gridOverlay = app.querySelector<HTMLElement>('#canvas-grid-overlay');
  const brushHover = app.querySelector<HTMLElement>('#brush-hover-outline');
  const legacyFrame = app.querySelector<HTMLElement>('#canvas-viewport-frame');
  legacyFrame?.removeAttribute('id');

  const compatibilityHost = document.createElement('div');
  compatibilityHost.id = COMPATIBILITY_HOST_ID;
  compatibilityHost.className = 'm8-compatibility-host';
  compatibilityHost.hidden = true;
  compatibilityHost.setAttribute('aria-hidden', 'true');
  compatibilityHost.dataset.m8Role = 'nonvisual-legacy-controller-bridge';
  for (const child of [...app.childNodes]) compatibilityHost.append(child);

  const canonicalShell = createCanonicalShellV1({ canvas, gridOverlay, brushHover });
  app.prepend(canonicalShell);
  app.append(compatibilityHost);
  app.classList.add('m8-canonical-host');
  app.dataset.m8ShellState = 'provisional';
  app.dataset.m8LegacyUi = 'removed-from-production-surface';

  const library = requireElementV1<HTMLElement>(canonicalShell, `#${LIBRARY_ID}`, 'Library shell');
  const taskLayer = requireElementV1<HTMLElement>(
    canonicalShell,
    `#${TASK_LAYER_ID}`,
    'Task layer',
  );
  const taskSurface = requireElementV1<HTMLElement>(
    taskLayer,
    `#${TASK_SURFACE_ID}`,
    'Task surface',
  );
  const documentIdentity = requireElementV1<HTMLOutputElement>(
    canonicalShell,
    `#${DOCUMENT_IDENTITY_ID}`,
    'Document identity',
  );
  const saveState = requireElementV1<HTMLOutputElement>(
    canonicalShell,
    `#${SAVE_STATE_ID}`,
    'Save state',
  );
  const safetyBanner = requireElementV1<HTMLElement>(
    canonicalShell,
    `#${DATA_SAFETY_BANNER_ID}`,
    'data-safety banner',
  );
  const toast = requireElementV1<HTMLElement>(canonicalShell, `#${TOAST_ID}`, 'toast');

  let toastTimer: number | null = null;

  const showLibrary = (): void => {
    library.hidden = false;
    canonicalShell.classList.add('is-library-open');
  };
  const hideLibrary = (): void => {
    library.hidden = true;
    canonicalShell.classList.remove('is-library-open');
  };
  const closeTaskSurface = (): void => {
    taskLayer.hidden = true;
    taskSurface.removeAttribute('data-tone');
    const title = taskSurface.querySelector<HTMLElement>('#m8-task-title');
    const body = taskSurface.querySelector<HTMLElement>('.m8-task-body');
    if (title) title.textContent = '';
    if (body) body.textContent = '';
  };
  const openTaskSurface = (title: string, body: string): void => {
    const titleNode = taskSurface.querySelector<HTMLElement>('#m8-task-title');
    const bodyNode = taskSurface.querySelector<HTMLElement>('.m8-task-body');
    if (titleNode) titleNode.textContent = title;
    if (bodyNode) bodyNode.textContent = body;
    taskLayer.hidden = false;
  };
  const openNamedTaskSurface = (surfaceId: M8TaskSurfaceIdV1): void => {
    const copy = TASK_SURFACE_COPY_V1[surfaceId];
    taskSurface.dataset.surface = surfaceId;
    if (copy.tone) taskSurface.dataset.tone = copy.tone;
    openTaskSurface(copy.title, copy.body);
  };
  const showToast = (message: string): void => {
    toast.textContent = message;
    toast.hidden = false;
    if (toastTimer !== null) globalThis.clearTimeout(toastTimer);
    toastTimer = globalThis.setTimeout(() => {
      toast.hidden = true;
      toastTimer = null;
    }, 2400);
  };

  const onCanonicalClick = (event: Event): void => {
    const target =
      event.target instanceof Element
        ? event.target.closest<HTMLElement>('button,[data-m8-task]')
        : null;
    if (!target) return;
    if (target.hasAttribute('data-m8-library-open')) {
      showLibrary();
      return;
    }
    if (target.hasAttribute('data-m8-library-close')) {
      hideLibrary();
      return;
    }
    if (target.hasAttribute('data-m8-task-close')) {
      closeTaskSurface();
      return;
    }
    const taskId = target.dataset.m8Task as M8TaskSurfaceIdV1 | undefined;
    if (taskId && M8_TASK_SURFACES_V1.includes(taskId)) {
      openNamedTaskSurface(taskId);
      target.closest('details')?.removeAttribute('open');
      return;
    }
    const proxyId = target.dataset.m8ProxyId;
    if (proxyId === 'm8-library-open-proxy') {
      showLibrary();
      target.closest('details')?.removeAttribute('open');
      return;
    }
    if (proxyId) {
      proxyLegacyCommandV1(proxyId);
      target.closest('details')?.removeAttribute('open');
    }
  };
  canonicalShell.addEventListener('click', onCanonicalClick);

  const root = document.documentElement;
  const syncRuntimeState = (): void => {
    const undoState = root.dataset.illustroHistoryUndo;
    const redoState = root.dataset.illustroHistoryRedo;
    const undo = canonicalShell.querySelector<HTMLButtonElement>(
      '[data-m8-proxy-id="history-undo"]',
    );
    const redo = canonicalShell.querySelector<HTMLButtonElement>(
      '[data-m8-proxy-id="history-redo"]',
    );
    if (undo) undo.disabled = undoState !== 'enabled';
    if (redo) redo.disabled = redoState !== 'enabled';

    const persistence = root.dataset.illustroPersistence;
    if (persistence === 'error') {
      saveState.dataset.state = 'warning';
      saveState.value = '保存を確認';
      safetyBanner.hidden = false;
    } else if (persistence === 'saving' || persistence === 'pending') {
      saveState.dataset.state = 'saving';
      saveState.value = '保存中…';
      safetyBanner.hidden = true;
    } else if (persistence === 'recovery') {
      saveState.dataset.state = 'recovery';
      saveState.value = '復元可能';
      safetyBanner.hidden = false;
    } else if (persistence) {
      saveState.dataset.state = 'saved';
      saveState.value = '保存済み';
      safetyBanner.hidden = true;
    }
  };
  const runtimeObserver = new MutationObserver(syncRuntimeState);
  runtimeObserver.observe(root, {
    attributes: true,
    attributeFilter: [
      'data-illustro-history-undo',
      'data-illustro-history-redo',
      'data-illustro-persistence',
    ],
  });
  syncRuntimeState();

  return {
    showLibrary,
    hideLibrary,
    setDocumentIdentity(name: string): void {
      const normalized = name.trim();
      documentIdentity.value = normalized || 'Untitled';
    },
    setSaveState(state: M8SaveStateV1, label?: string): void {
      const defaultLabel: Record<M8SaveStateV1, string> = {
        saved: '保存済み',
        saving: '保存中…',
        recovery: '復元可能',
        warning: '保存を確認',
      };
      saveState.dataset.state = state;
      saveState.value = label?.trim() || defaultLabel[state];
      safetyBanner.hidden = state !== 'warning' && state !== 'recovery';
    },
    openTaskSurface,
    openNamedTaskSurface,
    closeTaskSurface,
    showToast,
    dispose(): void {
      runtimeObserver.disconnect();
      canonicalShell.removeEventListener('click', onCanonicalClick);
      if (toastTimer !== null) globalThis.clearTimeout(toastTimer);
      canonicalShell.remove();
      for (const child of [...compatibilityHost.childNodes]) app.append(child);
      compatibilityHost.remove();
      app.classList.remove('m8-canonical-host');
      delete app.dataset.m8ShellState;
      delete app.dataset.m8LegacyUi;
    },
  };
}
