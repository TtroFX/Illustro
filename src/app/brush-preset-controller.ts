import {
  appendSampledBrushTipAssetsV1,
  BRUSH_TIP_MAX_ASSETS_V1,
  BRUSH_TIP_MAX_MASK_EDGE_V1,
  brushTipDescriptorV1,
  createBrushTipMaskAssetV1,
  type BrushProceduralTipShapeV1,
  type BrushTipMaskAssetV1,
} from '../domain/brush-tip.js';
import {
  brushParameterLimitsV1,
  brushParameterValuesV1,
  type BrushBehaviorV1,
  type BrushParameterValuesV1,
} from '../domain/brush-schema.js';
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
  updateBrushPresetParametersV1,
  updateBrushPresetTipV1,
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

async function brushTipMaskFromFileV1(file: File): Promise<BrushTipMaskAssetV1> {
  if (!file.type.startsWith('image/'))
    throw new TypeError('ブラシ先端には画像ファイルを指定してください');
  if (typeof globalThis.createImageBitmap !== 'function') {
    throw new Error('このブラウザでは画像ブラシ先端を作成できません');
  }
  const bitmap = await globalThis.createImageBitmap(file);
  try {
    const scale = Math.min(
      1,
      BRUSH_TIP_MAX_MASK_EDGE_V1 / bitmap.width,
      BRUSH_TIP_MAX_MASK_EDGE_V1 / bitmap.height,
    );
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (context === null) throw new Error('ブラシ先端画像を読み取れません');
    context.clearRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);
    const pixels = context.getImageData(0, 0, width, height).data;
    let hasTransparency = false;
    for (let offset = 3; offset < pixels.length; offset += 4) {
      if ((pixels[offset] ?? 255) < 250) {
        hasTransparency = true;
        break;
      }
    }
    const alpha = new Uint8Array(width * height);
    for (let pixel = 0; pixel < alpha.length; pixel += 1) {
      const offset = pixel * 4;
      const red = pixels[offset] ?? 0;
      const green = pixels[offset + 1] ?? 0;
      const blue = pixels[offset + 2] ?? 0;
      const sourceAlpha = pixels[offset + 3] ?? 0;
      const luminance = Math.round(red * 0.2126 + green * 0.7152 + blue * 0.0722);
      alpha[pixel] = hasTransparency ? sourceAlpha : 255 - luminance;
    }
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', alpha));
    const hash = [...digest.slice(0, 10)]
      .map((value) => value.toString(16).padStart(2, '0'))
      .join('');
    return createBrushTipMaskAssetV1({ id: `user-tip-${hash}`, width, height, alpha });
  } finally {
    bitmap.close();
  }
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
  const propertyStatus = requireElement('#brush-property-status', HTMLOutputElement);
  const sizeRange = requireElement('#brush-size-range', HTMLInputElement);
  const sizeNumber = requireElement('#brush-size-number', HTMLInputElement);
  const opacityRange = requireElement('#brush-opacity-range', HTMLInputElement);
  const opacityNumber = requireElement('#brush-opacity-number', HTMLInputElement);
  const flowRange = requireElement('#brush-flow-range', HTMLInputElement);
  const flowNumber = requireElement('#brush-flow-number', HTMLInputElement);
  const tipKind = requireElement('#brush-tip-kind', HTMLSelectElement);
  const tipImport = requireElement('#brush-tip-import', HTMLInputElement);
  const tipRemove = requireElement('#brush-tip-remove', HTMLButtonElement);
  const tipStatus = requireElement('#brush-tip-status', HTMLOutputElement);
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
    const parameters = brushParameterValuesV1(item.preset);
    input.paintSession.setBrushMode(modeForBehavior(item.preset.behavior));
    input.paintSession.setBrushParameters(parameters);
    input.paintSession.setBrushTip(brushTipDescriptorV1(item.preset));
    input.root.dataset.illustroBrushPreset = item.preset.id;
    input.root.dataset.illustroBrushPresetSource = item.source;
    input.root.dataset.illustroBrushPresetModified = String(item.modified);
    input.root.dataset.illustroBrushPresetLocked = String(item.locked);
    input.root.dataset.illustroBrushSize = String(parameters.sizePx);
    input.root.dataset.illustroBrushOpacity = String(parameters.opacity);
    input.root.dataset.illustroBrushFlow = String(parameters.flow);
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
    const limits = brushParameterLimitsV1(selected.preset);
    const parameters = brushParameterValuesV1(selected.preset);
    const configurePair = (
      range: HTMLInputElement,
      number: HTMLInputElement,
      min: number,
      max: number,
      step: number,
      value: number,
    ): void => {
      const minText = String(min);
      const maxText = String(max);
      const stepText = String(step);
      const valueText = String(value);
      range.min = minText;
      range.max = maxText;
      range.step = stepText;
      range.value = valueText;
      number.min = minText;
      number.max = maxText;
      number.step = stepText;
      number.value = valueText;
    };
    configurePair(
      sizeRange,
      sizeNumber,
      limits.sizePx.min,
      limits.sizePx.max,
      0.5,
      parameters.sizePx,
    );
    configurePair(
      opacityRange,
      opacityNumber,
      limits.opacity.min,
      limits.opacity.max,
      0.01,
      parameters.opacity,
    );
    configurePair(flowRange, flowNumber, limits.flow.min, limits.flow.max, 0.01, parameters.flow);
    propertyStatus.textContent = `${parameters.sizePx.toFixed(1)} px · ${Math.round(parameters.opacity * 100)}% · ${Math.round(parameters.flow * 100)}%`;
    const tip = brushTipDescriptorV1(selected.preset);
    tipKind.value = tip.kind === 'sampled' ? 'sampled' : tip.shape;
    tipStatus.textContent =
      tip.kind === 'sampled'
        ? `画像 ${tip.assets.length}/${BRUSH_TIP_MAX_ASSETS_V1} · dabごとに順送り`
        : tip.shape === 'square'
          ? '解析的・角型'
          : '解析的・丸型';
    tipRemove.disabled = selected.locked || tip.kind !== 'sampled';
    tipImport.disabled = selected.locked;
    tipKind.disabled = selected.locked;

    const locked = selected.locked;
    for (const control of [
      sizeRange,
      sizeNumber,
      opacityRange,
      opacityNumber,
      flowRange,
      flowNumber,
    ]) {
      control.disabled = locked;
    }
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
  const updateParameter = (patch: Partial<BrushParameterValuesV1>): void =>
    mutate(() => updateBrushPresetParametersV1(state, state.selectedPresetId, patch));
  const onSizeRange = (): void => updateParameter({ sizePx: Number(sizeRange.value) });
  const onSizeNumber = (): void => updateParameter({ sizePx: Number(sizeNumber.value) });
  const onOpacityRange = (): void => updateParameter({ opacity: Number(opacityRange.value) });
  const onOpacityNumber = (): void => updateParameter({ opacity: Number(opacityNumber.value) });
  const onFlowRange = (): void => updateParameter({ flow: Number(flowRange.value) });
  const onFlowNumber = (): void => updateParameter({ flow: Number(flowNumber.value) });
  const onTipKind = (): void => {
    const selected = selectedBrushPresetItemV1(state);
    const current = brushTipDescriptorV1(selected.preset);
    if (tipKind.value === 'sampled') {
      if (current.kind !== 'sampled') {
        tipStatus.textContent = '画像を追加すると画像先端へ切り替わります';
        render();
      }
      return;
    }
    const shape = tipKind.value as BrushProceduralTipShapeV1;
    const hardness = current.kind === 'procedural' ? current.hardness : 0.85;
    mutate(() =>
      updateBrushPresetTipV1(state, state.selectedPresetId, {
        kind: 'procedural',
        shape,
        hardness,
      }),
    );
  };
  const onTipImport = async (): Promise<void> => {
    const files = Array.from(tipImport.files ?? []);
    if (files.length === 0) return;
    try {
      const selected = selectedBrushPresetItemV1(state);
      if (selected.locked) throw new Error('locked brush preset cannot be edited');
      const additions: BrushTipMaskAssetV1[] = [];
      for (const file of files.slice(0, BRUSH_TIP_MAX_ASSETS_V1)) {
        additions.push(await brushTipMaskFromFileV1(file));
      }
      const nextTip = appendSampledBrushTipAssetsV1(
        brushTipDescriptorV1(selected.preset),
        additions,
      );
      state = updateBrushPresetTipV1(state, selected.preset.id, nextTip);
      persist();
      applySelected();
      render();
    } catch (error) {
      tipStatus.textContent =
        error instanceof Error ? error.message : '画像先端の作成に失敗しました';
    } finally {
      tipImport.value = '';
    }
  };
  const onTipRemove = (): void => {
    const selected = selectedBrushPresetItemV1(state);
    const current = brushTipDescriptorV1(selected.preset);
    if (current.kind !== 'sampled') return;
    if (current.assets.length <= 1) {
      mutate(() =>
        updateBrushPresetTipV1(state, selected.preset.id, {
          kind: 'procedural',
          shape: 'round',
          hardness: 0.85,
        }),
      );
      return;
    }
    mutate(() =>
      updateBrushPresetTipV1(state, selected.preset.id, {
        ...current,
        assets: Object.freeze(current.assets.slice(0, -1)),
      }),
    );
  };

  search.addEventListener('input', onSearch);
  category.addEventListener('change', onCategory);
  createButton.addEventListener('click', onCreate);
  duplicateButton.addEventListener('click', onDuplicate);
  renameButton.addEventListener('click', onRename);
  deleteButton.addEventListener('click', onDelete);
  lockButton.addEventListener('click', onLock);
  resetButton.addEventListener('click', onReset);
  sizeRange.addEventListener('input', onSizeRange);
  sizeNumber.addEventListener('change', onSizeNumber);
  opacityRange.addEventListener('input', onOpacityRange);
  opacityNumber.addEventListener('change', onOpacityNumber);
  flowRange.addEventListener('input', onFlowRange);
  flowNumber.addEventListener('change', onFlowNumber);
  const onTipImportChange = (): void => void onTipImport();
  tipKind.addEventListener('change', onTipKind);
  tipImport.addEventListener('change', onTipImportChange);
  tipRemove.addEventListener('click', onTipRemove);

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
      sizeRange.removeEventListener('input', onSizeRange);
      sizeNumber.removeEventListener('change', onSizeNumber);
      opacityRange.removeEventListener('input', onOpacityRange);
      opacityNumber.removeEventListener('change', onOpacityNumber);
      flowRange.removeEventListener('input', onFlowRange);
      flowNumber.removeEventListener('change', onFlowNumber);
      tipKind.removeEventListener('change', onTipKind);
      tipImport.removeEventListener('change', onTipImportChange);
      tipRemove.removeEventListener('click', onTipRemove);
    },
  });
}
