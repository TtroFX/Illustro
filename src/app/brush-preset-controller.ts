import type { BrushBehaviorV1 } from '../domain/brush-schema.js';
import type { PaintSessionControllerV1 } from './paint-session-controller.js';
import {
  brushPresetCategoriesV1,
  createBrushPresetLibraryStateV1,
  createUserBrushPresetV1,
  deleteBrushPresetV1,
  duplicateBrushPresetV1,
  filteredBrushPresetItemsV1,
  parseBrushPresetLibraryV1,
  renameBrushPresetV1,
  resetBrushPresetV1,
  selectBrushPresetV1,
  selectedBrushPresetItemV1,
  serializeBrushPresetLibraryV1,
  setBrushPresetCategoryV1,
  setBrushPresetLockedV1,
  setBrushPresetSearchV1,
  type BrushPresetLibraryStateV1,
} from './brush-preset-library.js';

const STORAGE_KEY = 'illustro.brush-preset-library/1';

function requireElement<T extends Element>(
  selector: string,
  ctor: { new (...args: never[]): T },
): T {
  const element = document.querySelector(selector);
  if (!(element instanceof ctor)) throw new Error(`missing Brush Presets UI: ${selector}`);
  return element;
}

function loadState(storage: Storage | null): BrushPresetLibraryStateV1 {
  const raw = storage?.getItem(STORAGE_KEY);
  if (raw === null || raw === undefined) return createBrushPresetLibraryStateV1();
  try {
    return parseBrushPresetLibraryV1(raw);
  } catch {
    return createBrushPresetLibraryStateV1();
  }
}

function modeForBehavior(behavior: BrushBehaviorV1): 'raster' | 'eraser' | 'smudge' | 'blur' {
  return behavior === 'paint' ? 'raster' : behavior === 'erase' ? 'eraser' : behavior;
}

export interface BrushPresetControllerV1 {
  snapshot(): BrushPresetLibraryStateV1;
  refresh(): void;
  dispose(): void;
}

export function installBrushPresetControllerV1(input: {
  readonly root: HTMLElement;
  readonly paintSession: PaintSessionControllerV1;
  readonly storage?: Storage | null;
  readonly onBrushModeChanged?: () => void;
}): BrushPresetControllerV1 {
  const storage = input.storage ?? globalThis.localStorage;
  const search = requireElement('#brush-preset-search', HTMLInputElement);
  const category = requireElement('#brush-preset-category', HTMLSelectElement);
  const list = requireElement('#brush-preset-list', HTMLFieldSetElement);
  const name = requireElement('#brush-preset-name', HTMLInputElement);
  const createButton = requireElement('#brush-preset-create', HTMLButtonElement);
  const duplicateButton = requireElement('#brush-preset-duplicate', HTMLButtonElement);
  const renameButton = requireElement('#brush-preset-rename', HTMLButtonElement);
  const deleteButton = requireElement('#brush-preset-delete', HTMLButtonElement);
  const lockButton = requireElement('#brush-preset-lock', HTMLButtonElement);
  const resetButton = requireElement('#brush-preset-reset', HTMLButtonElement);
  const status = requireElement('#brush-preset-status', HTMLOutputElement);
  let state = loadState(storage);
  let idCounter = 0;

  const nextId = (): string => {
    idCounter += 1;
    const uuid = globalThis.crypto?.randomUUID?.();
    return uuid === undefined
      ? `user.brush.${Date.now().toString(36)}.${idCounter.toString(36)}`
      : `user.brush.${uuid}`;
  };

  const persist = (): void => {
    storage?.setItem(STORAGE_KEY, serializeBrushPresetLibraryV1(state));
  };

  const applySelected = (): void => {
    const item = selectedBrushPresetItemV1(state);
    input.paintSession.setBrushMode(modeForBehavior(item.preset.behavior));
    input.root.dataset.illustroBrushPreset = item.preset.id;
    input.root.dataset.illustroBrushPresetSource = item.source;
    input.root.dataset.illustroBrushPresetModified = String(item.modified);
    input.root.dataset.illustroBrushPresetLocked = String(item.locked);
    input.onBrushModeChanged?.();
  };

  const render = (): void => {
    const selected = selectedBrushPresetItemV1(state);
    const categories = brushPresetCategoriesV1(state);
    const previousCategory = state.category;
    category.replaceChildren();
    const all = document.createElement('option');
    all.value = '';
    all.textContent = 'すべて';
    category.append(all);
    for (const value of categories) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = value;
      category.append(option);
    }
    category.value = previousCategory ?? '';
    search.value = state.query;
    name.value = selected.preset.name;
    list.replaceChildren();
    const visible = filteredBrushPresetItemsV1(state);
    for (const item of visible) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'shell-brush-preset-row';
      button.dataset.presetId = item.preset.id;
      button.setAttribute('aria-pressed', String(item.preset.id === state.selectedPresetId));
      if (item.preset.id === state.selectedPresetId) button.classList.add('is-selected');
      const title = document.createElement('span');
      title.className = 'shell-brush-preset-name';
      title.textContent = item.preset.name;
      const meta = document.createElement('span');
      meta.className = 'shell-brush-preset-meta';
      meta.textContent = `${item.preset.category} · ${item.source === 'factory' ? '標準' : 'ユーザー'}${item.modified ? ' · Modified' : ''}${item.locked ? ' · Locked' : ''}`;
      button.append(title, meta);
      button.addEventListener('click', () => {
        state = selectBrushPresetV1(state, item.preset.id);
        persist();
        applySelected();
        render();
      });
      list.append(button);
    }
    if (visible.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'shell-brush-preset-empty';
      empty.textContent = '一致するブラシがありません';
      list.append(empty);
    }
    const locked = selected.locked;
    duplicateButton.disabled = false;
    renameButton.disabled = locked;
    deleteButton.disabled = locked || selected.source === 'factory';
    resetButton.disabled = locked || !selected.modified;
    lockButton.textContent = locked ? '解除' : 'ロック';
    lockButton.setAttribute('aria-pressed', String(locked));
    status.textContent = `${visible.length}/${state.items.length}`;
    input.root.dataset.illustroBrushPresetCount = String(state.items.length);
  };

  const mutate = (operation: () => BrushPresetLibraryStateV1): void => {
    try {
      state = operation();
      persist();
      applySelected();
      status.textContent = '';
      render();
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : '操作に失敗しました';
    }
  };

  const onSearch = (): void => {
    state = setBrushPresetSearchV1(state, search.value);
    render();
  };
  const onCategory = (): void => {
    state = setBrushPresetCategoryV1(state, category.value || null);
    render();
  };
  const onCreate = (): void =>
    mutate(() => createUserBrushPresetV1(state, { id: nextId(), name: '新規ブラシ' }));
  const onDuplicate = (): void =>
    mutate(() => duplicateBrushPresetV1(state, state.selectedPresetId, nextId()));
  const onRename = (): void =>
    mutate(() => renameBrushPresetV1(state, state.selectedPresetId, name.value));
  const onDelete = (): void => mutate(() => deleteBrushPresetV1(state, state.selectedPresetId));
  const onLock = (): void => {
    const selected = selectedBrushPresetItemV1(state);
    mutate(() => setBrushPresetLockedV1(state, selected.preset.id, !selected.locked));
  };
  const onReset = (): void => mutate(() => resetBrushPresetV1(state, state.selectedPresetId));

  search.addEventListener('input', onSearch);
  category.addEventListener('change', onCategory);
  createButton.addEventListener('click', onCreate);
  duplicateButton.addEventListener('click', onDuplicate);
  renameButton.addEventListener('click', onRename);
  deleteButton.addEventListener('click', onDelete);
  lockButton.addEventListener('click', onLock);
  resetButton.addEventListener('click', onReset);

  applySelected();
  render();

  return Object.freeze({
    snapshot: () => state,
    refresh: render,
    dispose: () => {
      search.removeEventListener('input', onSearch);
      category.removeEventListener('change', onCategory);
      createButton.removeEventListener('click', onCreate);
      duplicateButton.removeEventListener('click', onDuplicate);
      renameButton.removeEventListener('click', onRename);
      deleteButton.removeEventListener('click', onDelete);
      lockButton.removeEventListener('click', onLock);
      resetButton.removeEventListener('click', onReset);
    },
  });
}
