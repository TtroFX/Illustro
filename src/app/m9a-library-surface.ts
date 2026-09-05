import type { ProjectId } from '../domain/identity.js';
import type { M8ProductShellHandleV1 } from './m8-product-shell.js';
import {
  type LocalProjectLibraryCardV1,
  type LocalProjectLibraryControllerV1,
  type LocalProjectLibrarySectionV1,
  type LocalProjectLibrarySortV1,
} from './local-project-library-controller.js';
import type { ProjectPreviewStoreV1 } from './project-preview-store.js';

export type M9aLibraryViewV1 = 'grid' | 'list';

export interface M9aLibrarySurfaceOptionsV1 {
  readonly root?: HTMLElement;
  readonly controller: LocalProjectLibraryControllerV1;
  readonly previews: ProjectPreviewStoreV1;
  readonly productShell: M8ProductShellHandleV1;
  readonly onNewProject: () => void;
  readonly onOpenProject: (projectId: ProjectId) => Promise<void>;
  readonly onImport: () => void;
  readonly canReturnToEditor: () => boolean;
  readonly activeProjectId: () => ProjectId | null;
}

export interface M9aLibrarySurfaceHandleV1 {
  readonly schema: 'illustro.m9a-library-surface/1';
  show(section?: LocalProjectLibrarySectionV1): Promise<void>;
  refresh(): Promise<void>;
  dispose(): void;
}

const SECTION_COPY: Readonly<
  Record<
    LocalProjectLibrarySectionV1,
    { readonly title: string; readonly detail: string; readonly short: string }
  >
> = Object.freeze({
  projects: { title: 'Projects', detail: 'この端末に保存されている作品', short: 'P' },
  recent: { title: 'Recent', detail: '最近更新した作品', short: 'R' },
  recovery: { title: 'Recovery', detail: '復元可能な状態が確認できる作品', short: '↺' },
  'recently-deleted': {
    title: 'Recently Deleted',
    detail: '削除後も復元できる作品',
    short: 'D',
  },
});

const SORT_COPY: readonly { readonly value: LocalProjectLibrarySortV1; readonly label: string }[] =
  Object.freeze([
    { value: 'modified-desc', label: '更新日：新しい順' },
    { value: 'modified-asc', label: '更新日：古い順' },
    { value: 'created-desc', label: '作成日：新しい順' },
    { value: 'created-asc', label: '作成日：古い順' },
    { value: 'name-asc', label: '名前：昇順' },
    { value: 'name-desc', label: '名前：降順' },
  ]);

function ensureStylesheet(): void {
  if (document.querySelector('#m9a-library-stylesheet')) return;
  const link = document.createElement('link');
  link.id = 'm9a-library-stylesheet';
  link.rel = 'stylesheet';
  link.href = './m9a-library.css';
  document.head.append(link);
}

function formatDate(value: string): string {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return value;
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(timestamp);
}

function createButton(label: string, className = 'm9a-library-button'): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.textContent = label;
  return button;
}

export function installM9aLibrarySurfaceV1(
  options: M9aLibrarySurfaceOptionsV1,
): M9aLibrarySurfaceHandleV1 {
  ensureStylesheet();
  const root = options.root ?? document.documentElement;
  const surface = document.querySelector<HTMLElement>('#m8-library-surface');
  if (surface === null) throw new Error('M9A requires the M8 Project Library surface host');

  let section: LocalProjectLibrarySectionV1 = 'projects';
  let search = '';
  let sort: LocalProjectLibrarySortV1 = 'modified-desc';
  let view: M9aLibraryViewV1 = 'grid';
  let disposed = false;
  let renderGeneration = 0;
  const previewUrls = new Set<string>();

  surface.dataset.m8ProductionState = 'connected';
  surface.dataset.m9aProductionState = 'ready';
  surface.innerHTML = `
    <header class="m9a-library-header">
      <div class="m9a-library-brand">
        <span class="m9a-library-mark" aria-hidden="true">I</span>
        <span class="m9a-library-brand-copy"><strong>Illustro</strong><span>Local Project Library</span></span>
      </div>
      <div class="m9a-library-header-actions">
        <button type="button" class="m9a-library-button m9a-secondary-action" data-m9a-settings>設定</button>
        <button type="button" class="m9a-library-button" data-m9a-return>キャンバスへ</button>
        <button type="button" class="m9a-library-button is-primary" data-m9a-new>新規作成</button>
      </div>
    </header>
    <div class="m9a-library-layout">
      <aside class="m9a-library-sidebar" aria-label="Library navigation">
        <nav class="m9a-library-nav">
          <button type="button" data-section="projects" data-short="P"><span>Projects</span><small></small></button>
          <button type="button" data-section="recent" data-short="R"><span>Recent</span><small></small></button>
          <button type="button" data-section="recovery" data-short="↺"><span>Recovery</span><small></small></button>
          <button type="button" data-section="recently-deleted" data-short="D"><span>Recently Deleted</span><small></small></button>
          <button type="button" data-section="import" data-short="I"><span>Import</span><small></small></button>
        </nav>
        <div class="m9a-library-sidebar-footer">
          <button type="button" class="m9a-library-button" data-m9a-settings><span>Settings</span></button>
        </div>
      </aside>
      <main class="m9a-library-main">
        <div class="m9a-library-title-row">
          <div><h1 data-m9a-title>Projects</h1><p data-m9a-detail></p></div>
        </div>
        <div class="m9a-library-toolbar" data-m9a-toolbar>
          <label class="m9a-library-search"><input type="search" data-m9a-search placeholder="プロジェクトを検索" aria-label="プロジェクトを検索" /></label>
          <select data-m9a-sort aria-label="プロジェクトの並び替え"></select>
          <div class="m9a-view-switch" aria-label="表示形式">
            <button type="button" data-m9a-view="grid" aria-label="グリッド表示" aria-pressed="true">▦</button>
            <button type="button" data-m9a-view="list" aria-label="リスト表示" aria-pressed="false">☷</button>
          </div>
        </div>
        <p class="m9a-library-status" data-m9a-status role="status" aria-live="polite"></p>
        <div data-m9a-error></div>
        <section class="m9a-projects" data-m9a-projects data-view="grid" aria-live="polite"></section>
      </main>
    </div>`;

  const title = surface.querySelector<HTMLElement>('[data-m9a-title]');
  const detail = surface.querySelector<HTMLElement>('[data-m9a-detail]');
  const toolbar = surface.querySelector<HTMLElement>('[data-m9a-toolbar]');
  const searchInput = surface.querySelector<HTMLInputElement>('[data-m9a-search]');
  const sortSelect = surface.querySelector<HTMLSelectElement>('[data-m9a-sort]');
  const projectsHost = surface.querySelector<HTMLElement>('[data-m9a-projects]');
  const status = surface.querySelector<HTMLElement>('[data-m9a-status]');
  const errorHost = surface.querySelector<HTMLElement>('[data-m9a-error]');
  const returnButton = surface.querySelector<HTMLButtonElement>('[data-m9a-return]');
  if (
    title === null ||
    detail === null ||
    toolbar === null ||
    searchInput === null ||
    sortSelect === null ||
    projectsHost === null ||
    status === null ||
    errorHost === null ||
    returnButton === null
  ) {
    throw new Error('M9A Library production surface is incomplete');
  }

  for (const entry of SORT_COPY) {
    const option = document.createElement('option');
    option.value = entry.value;
    option.textContent = entry.label;
    sortSelect.append(option);
  }
  sortSelect.value = sort;

  const clearPreviewUrls = (): void => {
    for (const url of previewUrls) URL.revokeObjectURL(url);
    previewUrls.clear();
  };

  const setError = (error: unknown): void => {
    errorHost.replaceChildren();
    if (error === null) return;
    const box = document.createElement('div');
    box.className = 'm9a-library-error';
    box.setAttribute('role', 'alert');
    box.textContent = error instanceof Error ? error.message : String(error);
    errorHost.append(box);
    root.dataset.illustroLibraryError = box.textContent;
  };

  const setBusy = (busy: boolean): void => {
    surface.classList.toggle('m9a-library-loading', busy);
    surface.setAttribute('aria-busy', String(busy));
  };

  const renderPreview = async (
    preview: HTMLElement,
    card: LocalProjectLibraryCardV1,
    generation: number,
  ): Promise<void> => {
    if (card.previewResourceId === null) return;
    const blob = await options.previews.read(card.projectId, card.previewResourceId);
    if (blob === null || disposed || generation !== renderGeneration || !preview.isConnected)
      return;
    const url = URL.createObjectURL(blob);
    previewUrls.add(url);
    const image = document.createElement('img');
    image.src = url;
    image.alt = `${card.name} のサムネイル`;
    image.decoding = 'async';
    preview.replaceChildren(image);
  };

  const refresh = async (): Promise<void> => {
    if (disposed) return;
    renderGeneration += 1;
    const generation = renderGeneration;
    clearPreviewUrls();
    setError(null);
    setBusy(true);
    const hasActiveEditor = options.canReturnToEditor();
    returnButton.hidden = false;
    returnButton.textContent = hasActiveEditor ? 'エディターへ戻る' : 'キャンバスへ';
    try {
      const navButtons = surface.querySelectorAll<HTMLButtonElement>('[data-section]');
      for (const button of Array.from(navButtons)) {
        button.setAttribute('aria-current', button.dataset.section === section ? 'page' : 'false');
      }
      const copy = SECTION_COPY[section];
      title.textContent = copy.title;
      detail.textContent = copy.detail;
      toolbar.hidden = false;
      const result = await options.controller.query({ section, search, sort });
      if (disposed || generation !== renderGeneration) return;
      status.textContent = `${result.total} project${result.total === 1 ? '' : 's'}`;
      projectsHost.dataset.view = view;
      projectsHost.replaceChildren();
      if (result.cards.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'm9a-empty';
        const message =
          section === 'recently-deleted'
            ? 'Recently Deleted は空です。'
            : section === 'recovery'
              ? '復元候補はありません。'
              : search.length > 0
                ? '検索条件に一致するプロジェクトはありません。'
                : 'まだプロジェクトがありません。';
        empty.innerHTML = `<div><strong>${message}</strong><span>新規作成またはImportから始められます。</span></div>`;
        projectsHost.append(empty);
        return;
      }
      for (const card of result.cards) {
        const article = document.createElement('article');
        article.className = 'm9a-project-card';
        article.dataset.projectId = card.projectId;
        article.tabIndex = 0;
        const isActiveProject = options.activeProjectId() === card.projectId;
        const preview = document.createElement('div');
        preview.className = 'm9a-project-preview';
        const fallback = document.createElement('span');
        fallback.setAttribute('aria-hidden', 'true');
        fallback.textContent = card.name.trim().slice(0, 1).toUpperCase() || 'I';
        preview.append(fallback);
        const body = document.createElement('div');
        body.className = 'm9a-project-card-body';
        const heading = document.createElement('div');
        heading.className = 'm9a-project-card-title';
        const name = document.createElement('strong');
        name.textContent = card.name;
        heading.append(name);
        if (isActiveProject) {
          const editing = document.createElement('span');
          editing.className = 'm9a-recovery-badge';
          editing.textContent = 'Editing';
          editing.title = '現在エディターで開いているため削除できません';
          heading.append(editing);
        }
        if (card.recovery.coherent) {
          const recovery = document.createElement('span');
          recovery.className = 'm9a-recovery-badge';
          recovery.textContent = 'Recovery';
          recovery.title = '復元可能なcheckpointがあります';
          heading.append(recovery);
        }
        const meta = document.createElement('div');
        meta.className = 'm9a-project-meta';
        const modified = document.createElement('span');
        modified.textContent = formatDate(card.modifiedAt);
        const lifecycle = document.createElement('span');
        lifecycle.textContent =
          card.lifecycle === 'trashed' && card.deletedAt !== null
            ? `削除 ${formatDate(card.deletedAt)}`
            : card.recovery.coherent
              ? `復元世代 ${card.recovery.generation ?? '-'}`
              : 'Local';
        meta.append(modified, lifecycle);
        const actions = document.createElement('div');
        actions.className = 'm9a-project-actions';
        if (card.lifecycle === 'trashed') {
          const restore = createButton('復元', 'm9a-card-action');
          restore.addEventListener('click', async () => {
            setBusy(true);
            try {
              await options.controller.restore(card.projectId);
              options.productShell.showToast('プロジェクトを復元しました');
              await refresh();
            } catch (error) {
              setError(error);
            } finally {
              setBusy(false);
            }
          });
          actions.append(restore);
        } else {
          const open = createButton('開く', 'm9a-card-action');
          open.addEventListener('click', async () => {
            setBusy(true);
            try {
              await options.onOpenProject(card.projectId);
            } catch (error) {
              setError(error);
              setBusy(false);
            }
          });
          const rename = createButton('名前変更', 'm9a-card-action');
          rename.addEventListener('click', () => {
            const input = document.createElement('input');
            input.value = card.name;
            input.setAttribute('aria-label', 'プロジェクト名');
            const save = createButton('保存', 'm9a-card-action');
            const cancel = createButton('取消', 'm9a-card-action');
            const editor = document.createElement('span');
            editor.className = 'm9a-inline-rename';
            editor.append(input, save, cancel);
            heading.replaceChildren(editor);
            input.focus();
            input.select();
            const finish = async (commit: boolean): Promise<void> => {
              if (!commit) {
                heading.replaceChildren(name);
                return;
              }
              const nextName = input.value.trim();
              if (nextName.length === 0 || nextName === card.name) {
                heading.replaceChildren(name);
                return;
              }
              try {
                await options.controller.rename(card.projectId, nextName);
                await refresh();
              } catch (error) {
                setError(error);
              }
            };
            save.addEventListener('click', () => void finish(true));
            cancel.addEventListener('click', () => void finish(false));
            input.addEventListener('keydown', (event) => {
              if (event.key === 'Enter') void finish(true);
              if (event.key === 'Escape') void finish(false);
            });
          });
          const duplicate = createButton('複製', 'm9a-card-action');
          duplicate.addEventListener('click', async () => {
            setBusy(true);
            try {
              await options.controller.duplicate(card.projectId);
              options.productShell.showToast('プロジェクトを複製しました');
              await refresh();
            } catch (error) {
              setError(error);
            } finally {
              setBusy(false);
            }
          });
          actions.append(open, rename, duplicate);
          if (!isActiveProject) {
            const remove = createButton('削除', 'm9a-card-action is-danger');
            remove.addEventListener('click', async () => {
              setBusy(true);
              try {
                await options.controller.trash(card.projectId);
                options.productShell.showToast('Recently Deletedへ移動しました');
                await refresh();
              } catch (error) {
                setError(error);
              } finally {
                setBusy(false);
              }
            });
            actions.append(remove);
          }
          article.addEventListener('dblclick', () => open.click());
        }
        body.append(heading, meta, actions);
        article.append(preview, body);
        projectsHost.append(article);
        void renderPreview(preview, card, generation).catch(setError);
      }
    } catch (error) {
      setError(error);
    } finally {
      setBusy(false);
    }
  };

  const renderImport = (): void => {
    renderGeneration += 1;
    clearPreviewUrls();
    title.textContent = 'Import';
    detail.textContent = '外部ファイルをIllustroのstaging importへ渡します';
    toolbar.hidden = true;
    status.textContent = '';
    projectsHost.replaceChildren();
    const panel = document.createElement('section');
    panel.className = 'm9a-import-panel';
    const heading = document.createElement('h2');
    heading.textContent = 'Import Project';
    const description = document.createElement('p');
    description.textContent =
      'ImportはLibraryから常時到達できます。ファイル形式ごとの解析・変換は対応するImport機能へ引き渡し、canonical projectを黙って変更しません。';
    const button = createButton('ファイルを選択…', 'm9a-library-button is-primary');
    button.addEventListener('click', options.onImport);
    panel.append(heading, description, button);
    projectsHost.append(panel);
  };

  const setSection = (next: string): void => {
    if (next === 'import') {
      renderImport();
      for (const button of Array.from(
        surface.querySelectorAll<HTMLButtonElement>('[data-section]'),
      )) {
        button.setAttribute('aria-current', button.dataset.section === 'import' ? 'page' : 'false');
      }
      return;
    }
    if (!(next in SECTION_COPY)) return;
    section = next as LocalProjectLibrarySectionV1;
    void refresh();
  };

  const onClick = (event: MouseEvent): void => {
    const target = event.target instanceof Element ? event.target : null;
    const sectionButton = target?.closest<HTMLButtonElement>('[data-section]');
    if (sectionButton?.dataset.section) {
      setSection(sectionButton.dataset.section);
      return;
    }
    if (target?.closest('[data-m9a-new]')) {
      options.onNewProject();
      return;
    }
    if (target?.closest('[data-m9a-settings]')) {
      options.productShell.openNamedTaskSurface('settings');
      return;
    }
    if (target?.closest('[data-m9a-return]')) {
      options.productShell.hideLibrary();
    }
  };

  const onSearch = (): void => {
    search = searchInput.value;
    void refresh();
  };
  const onSort = (): void => {
    sort = sortSelect.value as LocalProjectLibrarySortV1;
    void refresh();
  };
  const onView = (event: MouseEvent): void => {
    const target =
      event.target instanceof Element
        ? event.target.closest<HTMLButtonElement>('[data-m9a-view]')
        : null;
    if (target === null) return;
    view = target.dataset.m9aView === 'list' ? 'list' : 'grid';
    projectsHost.dataset.view = view;
    for (const button of Array.from(
      surface.querySelectorAll<HTMLButtonElement>('[data-m9a-view]'),
    )) {
      button.setAttribute('aria-pressed', String(button.dataset.m9aView === view));
    }
  };

  surface.addEventListener('click', onClick);
  searchInput.addEventListener('input', onSearch);
  sortSelect.addEventListener('change', onSort);
  surface.querySelector<HTMLElement>('.m9a-view-switch')?.addEventListener('click', onView);

  const observer = new MutationObserver(() => {
    if (!surface.hidden) void refresh();
  });
  observer.observe(surface, { attributes: true, attributeFilter: ['hidden'] });
  root.dataset.illustroLocalProjectLibrary = 'ready';

  return Object.freeze({
    schema: 'illustro.m9a-library-surface/1' as const,
    async show(nextSection = section): Promise<void> {
      section = nextSection;
      options.productShell.showLibrary();
      await refresh();
    },
    refresh,
    dispose(): void {
      if (disposed) return;
      disposed = true;
      renderGeneration += 1;
      observer.disconnect();
      clearPreviewUrls();
      surface.removeEventListener('click', onClick);
      searchInput.removeEventListener('input', onSearch);
      sortSelect.removeEventListener('change', onSort);
      surface.querySelector<HTMLElement>('.m9a-view-switch')?.removeEventListener('click', onView);
      delete root.dataset.illustroLocalProjectLibrary;
    },
  });
}
