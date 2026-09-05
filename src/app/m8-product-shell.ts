export const M8_PRODUCT_REGIONS_V1 = Object.freeze([
  'document-bar',
  'tool-rail',
  'canvas-workspace',
  'inspector-dock',
  'inspector-action-strip',
] as const);

export type M8SaveStateV1 = 'saved' | 'saving' | 'recovery' | 'warning';

export interface M8ProductShellHandleV1 {
  showLibrary(): void;
  hideLibrary(): void;
  setDocumentIdentity(name: string): void;
  setSaveState(state: M8SaveStateV1, label?: string): void;
  openTaskSurface(title: string, body: string): void;
  closeTaskSurface(): void;
  dispose(): void;
}

const LIBRARY_ID = 'm8-library-surface';
const TASK_LAYER_ID = 'm8-task-layer';
const TASK_SURFACE_ID = 'm8-task-surface';
const LIBRARY_BUTTON_ID = 'm8-library-button';
const DOCUMENT_IDENTITY_ID = 'm8-document-identity';
const SAVE_STATE_ID = 'm8-save-state';

function requireElementV1<T extends Element>(root: ParentNode, selector: string, label: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`M8 product shell is missing ${label}.`);
  return element;
}

function createLibrarySurfaceV1(): HTMLElement {
  const surface = document.createElement('section');
  surface.id = LIBRARY_ID;
  surface.className = 'm8-library-surface';
  surface.hidden = true;
  surface.setAttribute('aria-label', 'Project Library');
  surface.innerHTML = `
    <header class="m8-library-header">
      <div>
        <span class="m8-eyebrow">Illustro</span>
        <h1>Project Library</h1>
      </div>
      <button type="button" data-m8-library-close aria-label="エディターへ戻る">エディターへ戻る</button>
    </header>
    <div class="m8-library-toolbar" aria-label="Library controls">
      <label>検索<input type="search" disabled placeholder="プロジェクトを検索" aria-label="プロジェクト検索（M9A接続後に利用可能）" /></label>
      <button type="button" disabled>並び替え</button>
      <button type="button" disabled>新規プロジェクト</button>
    </div>
    <div class="m8-library-body">
      <section class="m8-library-hero" aria-label="Library placeholder">
        <div class="m8-library-mark" aria-hidden="true">I</div>
        <h2>ローカル作品をここに集約</h2>
        <p>M8では最終UIのシェルのみ先行実装しています。プロジェクト一覧・検索・作成・復元はM9Aのproduction pathへ接続後に有効になります。</p>
        <span class="m8-provisional-badge">UI shell · 仮完了対象</span>
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
      <header>
        <h2 id="m8-task-title"></h2>
        <button type="button" data-m8-task-close aria-label="閉じる">×</button>
      </header>
      <div class="m8-task-body"></div>
    </section>`;
  return layer;
}

export function installM8ProductShellV1(app: HTMLElement): M8ProductShellHandleV1 {
  const topbar = requireElementV1<HTMLElement>(app, '.shell-topbar', 'Application / Document Bar');
  const brand = requireElementV1<HTMLElement>(topbar, '.shell-brand', 'Document Bar left cluster');
  const actions = requireElementV1<HTMLElement>(topbar, '.shell-topbar-actions', 'Document Bar action cluster');
  const rail = requireElementV1<HTMLElement>(app, '.shell-tool-rail', 'Primary Tool Rail');
  const canvasWorkspace = requireElementV1<HTMLElement>(app, '.shell-document', 'Canvas Workspace');
  const inspector = requireElementV1<HTMLElement>(app, '.shell-inspector', 'Inspector Dock');
  const inspectorActionStrip = requireElementV1<HTMLElement>(
    app,
    '.m7-inspector-action-strip',
    'Inspector Action Strip',
  );

  app.classList.add('m8-product-shell');
  topbar.dataset.m8Region = 'document-bar';
  rail.dataset.m8Region = 'tool-rail';
  canvasWorkspace.dataset.m8Region = 'canvas-workspace';
  inspector.dataset.m8Region = 'inspector-dock';
  inspectorActionStrip.dataset.m8Region = 'inspector-action-strip';

  let libraryButton = document.getElementById(LIBRARY_BUTTON_ID) as HTMLButtonElement | null;
  if (!libraryButton) {
    libraryButton = document.createElement('button');
    libraryButton.id = LIBRARY_BUTTON_ID;
    libraryButton.className = 'm8-library-button';
    libraryButton.type = 'button';
    libraryButton.title = 'Project Library';
    libraryButton.setAttribute('aria-label', 'Project Libraryを開く');
    libraryButton.innerHTML = '<span aria-hidden="true">⌂</span>';
    brand.prepend(libraryButton);
  }

  let documentIdentity = document.getElementById(DOCUMENT_IDENTITY_ID) as HTMLOutputElement | null;
  if (!documentIdentity) {
    documentIdentity = document.createElement('output');
    documentIdentity.id = DOCUMENT_IDENTITY_ID;
    documentIdentity.className = 'm8-document-identity';
    documentIdentity.value = 'Illustration';
    documentIdentity.setAttribute('aria-label', '現在のドキュメント');
    brand.append(documentIdentity);
  }

  let saveState = document.getElementById(SAVE_STATE_ID) as HTMLOutputElement | null;
  if (!saveState) {
    saveState = document.createElement('output');
    saveState.id = SAVE_STATE_ID;
    saveState.className = 'm8-save-state';
    saveState.value = '保存済み';
    saveState.dataset.state = 'saved';
    saveState.setAttribute('aria-label', '保存状態');
    actions.prepend(saveState);
  }

  let library = document.getElementById(LIBRARY_ID) as HTMLElement | null;
  if (!library) {
    library = createLibrarySurfaceV1();
    app.append(library);
  }

  let taskLayer = document.getElementById(TASK_LAYER_ID) as HTMLElement | null;
  if (!taskLayer) {
    taskLayer = createTaskLayerV1();
    app.append(taskLayer);
  }

  const showLibrary = (): void => {
    if (!library) return;
    library.hidden = false;
    app.classList.add('is-m8-library-open');
    libraryButton?.setAttribute('aria-expanded', 'true');
  };
  const hideLibrary = (): void => {
    if (!library) return;
    library.hidden = true;
    app.classList.remove('is-m8-library-open');
    libraryButton?.setAttribute('aria-expanded', 'false');
  };
  const closeTaskSurface = (): void => {
    if (!taskLayer) return;
    taskLayer.hidden = true;
    const title = taskLayer.querySelector<HTMLElement>('#m8-task-title');
    const body = taskLayer.querySelector<HTMLElement>('.m8-task-body');
    if (title) title.textContent = '';
    if (body) body.textContent = '';
  };

  const onLibraryButton = (): void => showLibrary();
  const onLibraryClose = (): void => hideLibrary();
  const onTaskClose = (): void => closeTaskSurface();
  libraryButton.addEventListener('click', onLibraryButton);
  library.querySelector<HTMLButtonElement>('[data-m8-library-close]')?.addEventListener(
    'click',
    onLibraryClose,
  );
  taskLayer.querySelector<HTMLButtonElement>('[data-m8-task-close]')?.addEventListener(
    'click',
    onTaskClose,
  );

  app.dataset.m8ShellState = 'provisional';

  return {
    showLibrary,
    hideLibrary,
    setDocumentIdentity(name: string): void {
      if (!documentIdentity) return;
      const normalized = name.trim();
      documentIdentity.value = normalized || 'Untitled';
    },
    setSaveState(state: M8SaveStateV1, label?: string): void {
      if (!saveState) return;
      const defaultLabel: Record<M8SaveStateV1, string> = {
        saved: '保存済み',
        saving: '保存中…',
        recovery: '復元可能',
        warning: '保存を確認',
      };
      saveState.dataset.state = state;
      saveState.value = label?.trim() || defaultLabel[state];
    },
    openTaskSurface(title: string, body: string): void {
      if (!taskLayer) return;
      const titleNode = taskLayer.querySelector<HTMLElement>('#m8-task-title');
      const bodyNode = taskLayer.querySelector<HTMLElement>('.m8-task-body');
      if (titleNode) titleNode.textContent = title;
      if (bodyNode) bodyNode.textContent = body;
      taskLayer.hidden = false;
    },
    closeTaskSurface,
    dispose(): void {
      libraryButton?.removeEventListener('click', onLibraryButton);
      library?.querySelector<HTMLButtonElement>('[data-m8-library-close]')?.removeEventListener(
        'click',
        onLibraryClose,
      );
      taskLayer?.querySelector<HTMLButtonElement>('[data-m8-task-close]')?.removeEventListener(
        'click',
        onTaskClose,
      );
      hideLibrary();
      closeTaskSurface();
      app.classList.remove('m8-product-shell');
      delete app.dataset.m8ShellState;
    },
  };
}
