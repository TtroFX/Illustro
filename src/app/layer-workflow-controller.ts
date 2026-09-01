import { parseLayerId, type LayerId } from '../domain/identity.js';
import type { LayerBaseV1 } from '../domain/layers.js';
import {
  CREATABLE_LAYER_KINDS_V1,
  attachRasterMaskSnapshotV1,
  createDefaultLayerV1,
  defaultLayerNameV1,
  insertRootLayerSnapshotV1,
  type CreatableLayerKindV1,
} from './layer-creation.js';
import {
  deleteRootLayerSnapshotV1,
  duplicateRootLayerSnapshotV1,
  renameLayerSnapshotV1,
  reorderRootLayerSnapshotV1,
  setLayerAllLockSnapshotV1,
  setLayerAlphaLockSnapshotV1,
  setLayerClippingSnapshotV1,
  setLayerOpacitySnapshotV1,
  setLayerVisibilitySnapshotV1,
} from './layer-operations.js';
import type { PaintHistoryControllerV1 } from './paint-history-controller.js';
import type { PaintPersistenceControllerV1 } from './paint-persistence-controller.js';
import type { PaintSessionControllerV1 } from './paint-session-controller.js';

export interface LayerWorkflowControllerV1 {
  readonly schema: 'illustro.layer-workflow/1';
  refresh(): void;
  dispose(): void;
}

interface OptionsV1 {
  readonly root?: HTMLElement;
  readonly paintSession: PaintSessionControllerV1;
  readonly paintHistory: PaintHistoryControllerV1;
  readonly paintPersistence: PaintPersistenceControllerV1;
  readonly schedule: (operation: () => Promise<void>) => void;
  readonly onHistoryChanged: () => void;
}

interface LayerDragStateV1 {
  readonly pointerId: number;
  readonly sourceLayerId: LayerId;
  readonly startX: number;
  readonly startY: number;
  dragging: boolean;
  targetLayerId: LayerId | null;
  beforeOnScreen: boolean;
}

const BUTTON_IDS: Readonly<Record<CreatableLayerKindV1, string>> = Object.freeze({
  raster: '#layer-add-raster',
  folder: '#layer-add-folder',
  vector: '#layer-add-vector',
  adjustment: '#layer-add-adjustment',
  fill: '#layer-add-fill',
  gradient: '#layer-add-gradient',
  'linked-object': '#layer-add-linked-object',
});

const KIND_LABELS: Readonly<Record<string, string>> = Object.freeze({
  raster: 'ラスタ',
  folder: 'フォルダ',
  vector: 'ベクター',
  adjustment: '調整',
  fill: '塗り',
  gradient: 'グラデーション',
  linkedObject: 'リンク',
  lineartBoundary: '境界',
});

function required<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (element === null) throw new Error(`layer workflow is missing ${selector}`);
  return element;
}

function closeMenu(element: Element): void {
  element.closest('details')?.removeAttribute('open');
}

function nextName(
  kind: CreatableLayerKindV1,
  layers: Readonly<Record<string, LayerBaseV1>>,
): string {
  const base = defaultLayerNameV1(kind);
  const used = new Set(Object.values(layers).map((layer) => layer.name));
  if (!used.has(base)) return base;
  for (let suffix = 2; suffix < Number.MAX_SAFE_INTEGER; suffix += 1) {
    const candidate = `${base} ${suffix}`;
    if (!used.has(candidate)) return candidate;
  }
  throw new RangeError('layer name sequence is exhausted');
}

function iconButton(
  action: string,
  label: string,
  glyph: string,
  pressed?: boolean,
): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `shell-layer-icon shell-layer-${action}`;
  button.dataset.layerAction = action;
  button.setAttribute('aria-label', label);
  button.title = label;
  button.textContent = glyph;
  if (pressed !== undefined) button.setAttribute('aria-pressed', pressed ? 'true' : 'false');
  return button;
}

export function installLayerWorkflowControllerV1(options: OptionsV1): LayerWorkflowControllerV1 {
  const root = options.root ?? document.documentElement;
  const list = required<HTMLElement>('#layer-list');
  const maskButton = required<HTMLButtonElement>('#layer-add-mask');
  const duplicateButton = required<HTMLButtonElement>('#layer-duplicate');
  const deleteButton = required<HTMLButtonElement>('#layer-delete');
  const renameButton = required<HTMLButtonElement>('#layer-rename');
  const moveUpButton = required<HTMLButtonElement>('#layer-move-up');
  const moveDownButton = required<HTMLButtonElement>('#layer-move-down');
  const lockButton = required<HTMLButtonElement>('#layer-lock');
  const alphaLockButton = required<HTMLButtonElement>('#layer-alpha-lock');
  const opacityInput = required<HTMLInputElement>('#layer-opacity');
  const renameForm = required<HTMLFormElement>('#layer-rename-editor');
  const renameInput = required<HTMLInputElement>('#layer-rename-input');
  const renameCancel = required<HTMLButtonElement>('#layer-rename-cancel');
  const status = required<HTMLOutputElement>('#layer-action-status');
  const buttons = new Map<CreatableLayerKindV1, HTMLButtonElement>();
  for (const kind of CREATABLE_LAYER_KINDS_V1) buttons.set(kind, required(BUTTON_IDS[kind]));
  let disposed = false;
  let drag: LayerDragStateV1 | null = null;

  const publishError = (error: unknown): void => {
    const message = error instanceof Error ? error.message : String(error);
    root.dataset.illustroLayerError = message;
    status.value = message;
  };

  const clearError = (): void => {
    root.dataset.illustroLayerError = '';
    status.value = '';
  };

  const currentActive = (): { id: LayerId; layer: LayerBaseV1 } | null => {
    const documentValue = options.paintSession.currentDocument();
    const activeLayerId = options.paintSession.activeLayerId();
    if (documentValue === null || activeLayerId === null) return null;
    const layer = documentValue.layerTree.layers[activeLayerId];
    return layer === undefined ? null : { id: activeLayerId, layer };
  };

  const refresh = (): void => {
    if (disposed) return;
    const documentValue = options.paintSession.currentDocument();
    const activeLayerId = options.paintSession.activeLayerId();
    list.replaceChildren();
    if (documentValue === null) {
      root.dataset.illustroLayerCount = '0';
      root.dataset.illustroActiveLayerId = '';
      return;
    }
    const canonicalRoots = documentValue.layerTree.rootLayerIds;
    const ordered = [...canonicalRoots].reverse();
    for (const layerId of ordered) {
      const layer = documentValue.layerTree.layers[layerId];
      if (layer === undefined) continue;
      const row = document.createElement('div');
      row.className = 'shell-layer-row';
      row.dataset.layerId = layerId;
      row.dataset.layerType = layer.type;
      if (layerId === activeLayerId) row.classList.add('is-selected');

      const visibility = iconButton(
        'visibility',
        layer.visible ? `${layer.name}を非表示` : `${layer.name}を表示`,
        layer.visible ? '●' : '○',
        layer.visible,
      );
      const select = document.createElement('button');
      select.type = 'button';
      select.className = 'shell-layer-select';
      select.dataset.layerAction = 'select';
      select.setAttribute('aria-label', `${layer.name}を選択`);
      select.setAttribute('aria-pressed', layerId === activeLayerId ? 'true' : 'false');

      const thumbnail = document.createElement('span');
      thumbnail.className = 'shell-layer-thumbnail';
      thumbnail.dataset.layerType = layer.type;
      const copy = document.createElement('span');
      copy.className = 'shell-layer-copy';
      const name = document.createElement('span');
      name.className = 'shell-layer-name';
      name.textContent = layer.name;
      const kind = document.createElement('span');
      kind.className = 'shell-layer-kind';
      kind.textContent = KIND_LABELS[layer.type] ?? layer.type;
      copy.append(name, kind);
      const masks = document.createElement('span');
      masks.className = 'shell-layer-mask-count';
      masks.textContent = layer.masks.length === 0 ? '' : `M ${layer.masks.length}`;
      select.append(thumbnail, copy, masks);

      const rootIndex = canonicalRoots.indexOf(layerId);
      const canClip = rootIndex > 0 && layer.type !== 'lineartBoundary';
      const clipping = iconButton(
        'clipping',
        layer.clipping === null
          ? `${layer.name}を下のレイヤーでクリッピング`
          : `${layer.name}のクリッピングを解除`,
        '⌁',
        layer.clipping !== null,
      );
      clipping.disabled = layer.clipping === null && !canClip;
      row.append(visibility, select, clipping);
      list.append(row);
    }

    const active = currentActive();
    const disabled = active === null;
    maskButton.disabled = disabled || active?.layer.type === 'lineartBoundary';
    duplicateButton.disabled = disabled || active?.layer.type === 'lineartBoundary';
    deleteButton.disabled = disabled;
    renameButton.disabled = disabled;
    lockButton.disabled = disabled;
    alphaLockButton.disabled = disabled;
    opacityInput.disabled = disabled;
    const roots = documentValue.layerTree.rootLayerIds;
    const activeIndex = active === null ? -1 : roots.indexOf(active.id);
    moveUpButton.disabled = activeIndex < 0 || activeIndex >= roots.length - 1;
    moveDownButton.disabled = activeIndex <= 0;
    if (active !== null) {
      opacityInput.value = String(Math.round(active.layer.opacity * 100));
      lockButton.setAttribute('aria-pressed', active.layer.locks.all ? 'true' : 'false');
      alphaLockButton.setAttribute('aria-pressed', active.layer.locks.alpha ? 'true' : 'false');
      lockButton.dataset.active = active.layer.locks.all ? 'true' : 'false';
      alphaLockButton.dataset.active = active.layer.locks.alpha ? 'true' : 'false';
    } else {
      opacityInput.value = '100';
      lockButton.setAttribute('aria-pressed', 'false');
      alphaLockButton.setAttribute('aria-pressed', 'false');
      lockButton.dataset.active = 'false';
      alphaLockButton.dataset.active = 'false';
    }
    root.dataset.illustroLayerCount = String(Object.keys(documentValue.layerTree.layers).length);
    root.dataset.illustroActiveLayerId = activeLayerId ?? '';
    root.dataset.illustroLayerWorkflow = 'ready';
  };

  const commitMutation = (
    commandId: string,
    transform: Parameters<PaintHistoryControllerV1['commitSnapshotTransform']>[1],
    selectAfter?: () => LayerId | null,
  ): void => {
    options.schedule(async () => {
      try {
        const transaction = await options.paintHistory.commitSnapshotTransform(
          commandId,
          transform,
        );
        const selection = selectAfter?.() ?? options.paintSession.activeLayerId();
        const documentValue = options.paintSession.currentDocument();
        if (
          selection !== null &&
          documentValue !== null &&
          selection in documentValue.layerTree.layers
        ) {
          options.paintSession.setActiveLayer(selection);
        }
        await options.paintPersistence.markDirty(transaction.transactionId);
        root.dataset.illustroLayerTransaction = transaction.transactionId;
        clearError();
        refresh();
        options.onHistoryChanged();
      } catch (error) {
        publishError(error);
      }
    });
  };

  const runCreate = (kind: CreatableLayerKindV1, source: HTMLButtonElement): void => {
    closeMenu(source);
    options.schedule(async () => {
      try {
        const current = options.paintSession.projectSnapshot();
        if (current === null) return;
        const layer = createDefaultLayerV1(
          kind,
          current.document,
          nextName(kind, current.document.layerTree.layers),
        );
        const transaction = await options.paintHistory.commitSnapshotTransform(
          `layer.create.${kind}`,
          (before, revision) => insertRootLayerSnapshotV1(before, layer, revision),
        );
        options.paintSession.setActiveLayer(layer.id);
        await options.paintPersistence.markDirty(transaction.transactionId);
        root.dataset.illustroLayerTransaction = transaction.transactionId;
        clearError();
        refresh();
        options.onHistoryChanged();
      } catch (error) {
        publishError(error);
      }
    });
  };

  const createHandlers = new Map<CreatableLayerKindV1, () => void>();
  for (const kind of CREATABLE_LAYER_KINDS_V1) {
    const button = buttons.get(kind);
    if (button === undefined) continue;
    const handler = (): void => runCreate(kind, button);
    createHandlers.set(kind, handler);
    button.addEventListener('click', handler);
  }

  const onMask = (): void => {
    closeMenu(maskButton);
    const targetLayerId = options.paintSession.activeLayerId();
    if (targetLayerId === null) return;
    commitMutation(
      'mask.create.raster',
      (before, revision) => attachRasterMaskSnapshotV1(before, targetLayerId, revision),
      () => targetLayerId,
    );
  };

  const onDuplicate = (): void => {
    const sourceLayerId = options.paintSession.activeLayerId();
    if (sourceLayerId === null) return;
    let duplicatedLayerId: LayerId | null = null;
    commitMutation(
      'layer.duplicate',
      (before, revision) => {
        const result = duplicateRootLayerSnapshotV1(before, sourceLayerId, revision);
        duplicatedLayerId = result.duplicatedRootLayerId;
        return result.snapshot;
      },
      () => duplicatedLayerId,
    );
  };

  const onDelete = (): void => {
    const current = options.paintSession.projectSnapshot();
    const layerId = options.paintSession.activeLayerId();
    if (current === null || layerId === null) return;
    const roots = current.document.layerTree.rootLayerIds;
    const index = roots.indexOf(layerId);
    const remaining = roots.filter((id) => id !== layerId);
    const fallback = remaining[Math.min(Math.max(index, 0), remaining.length - 1)] ?? null;
    commitMutation(
      'layer.delete',
      (before, revision) => deleteRootLayerSnapshotV1(before, layerId, revision),
      () => fallback,
    );
  };

  const onRename = (): void => {
    const active = currentActive();
    if (active === null) return;
    renameInput.value = active.layer.name;
    renameForm.hidden = false;
    renameInput.focus();
    renameInput.select();
  };

  const onRenameSubmit = (event: SubmitEvent): void => {
    event.preventDefault();
    const layerId = options.paintSession.activeLayerId();
    if (layerId === null) return;
    const name = renameInput.value;
    commitMutation(
      'layer.rename',
      (before, revision) => renameLayerSnapshotV1(before, layerId, name, revision),
      () => layerId,
    );
    renameForm.hidden = true;
  };

  const onRenameCancel = (): void => {
    renameForm.hidden = true;
    clearError();
  };

  const onOpacity = (): void => {
    const layerId = options.paintSession.activeLayerId();
    if (layerId === null) return;
    const percent = Number(opacityInput.value);
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
      publishError(new RangeError('layer opacity must be 0..100%'));
      refresh();
      return;
    }
    commitMutation(
      'layer.opacity',
      (before, revision) => setLayerOpacitySnapshotV1(before, layerId, percent / 100, revision),
      () => layerId,
    );
  };

  const onLock = (): void => {
    const active = currentActive();
    if (active === null) return;
    commitMutation(
      'layer.lock',
      (before, revision) =>
        setLayerAllLockSnapshotV1(before, active.id, !active.layer.locks.all, revision),
      () => active.id,
    );
  };

  const onAlphaLock = (): void => {
    const active = currentActive();
    if (active === null) return;
    commitMutation(
      'layer.alpha-lock',
      (before, revision) =>
        setLayerAlphaLockSnapshotV1(before, active.id, !active.layer.locks.alpha, revision),
      () => active.id,
    );
  };

  const runMove = (delta: -1 | 1): void => {
    const current = options.paintSession.projectSnapshot();
    const layerId = options.paintSession.activeLayerId();
    if (current === null || layerId === null) return;
    const index = current.document.layerTree.rootLayerIds.indexOf(layerId);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= current.document.layerTree.rootLayerIds.length) return;
    commitMutation(
      'layer.reorder',
      (before, revision) => reorderRootLayerSnapshotV1(before, layerId, target, revision),
      () => layerId,
    );
  };

  const onMoveUp = (): void => runMove(1);
  const onMoveDown = (): void => runMove(-1);

  const onListClick = (event: MouseEvent): void => {
    const actionButton =
      event.target instanceof Element
        ? event.target.closest<HTMLButtonElement>('[data-layer-action]')
        : null;
    const row =
      actionButton?.closest<HTMLElement>('[data-layer-id]') ??
      (event.target instanceof Element
        ? event.target.closest<HTMLElement>('[data-layer-id]')
        : null);
    if (row === null || !list.contains(row)) return;
    const value = row.dataset.layerId;
    const action = actionButton?.dataset.layerAction;
    if (value === undefined || action === undefined) return;
    try {
      const layerId = parseLayerId(value);
      if (action === 'select') {
        options.paintSession.setActiveLayer(layerId);
        clearError();
        renameForm.hidden = true;
        refresh();
        return;
      }
      const documentValue = options.paintSession.currentDocument();
      if (documentValue === null) return;
      const layer = documentValue.layerTree.layers[layerId];
      if (layer === undefined) return;
      if (action === 'visibility') {
        commitMutation(
          'layer.visibility',
          (before, revision) =>
            setLayerVisibilitySnapshotV1(before, layerId, !layer.visible, revision),
          () => layerId,
        );
        return;
      }
      if (action === 'clipping') {
        const roots = documentValue.layerTree.rootLayerIds;
        const index = roots.indexOf(layerId);
        const baseLayerId = layer.clipping === null ? (roots[index - 1] ?? null) : null;
        if (layer.clipping === null && baseLayerId === null) return;
        commitMutation(
          'layer.clipping',
          (before, revision) => setLayerClippingSnapshotV1(before, layerId, baseLayerId, revision),
          () => layerId,
        );
      }
    } catch (error) {
      publishError(error);
    }
  };

  const clearDropIndicator = (): void => {
    list.querySelectorAll<HTMLElement>('[data-layer-id]').forEach((row) => {
      delete row.dataset.dropPosition;
    });
  };

  const onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0 || drag !== null) return;
    const select =
      event.target instanceof Element
        ? event.target.closest<HTMLButtonElement>('[data-layer-action="select"]')
        : null;
    const row = select?.closest<HTMLElement>('[data-layer-id]') ?? null;
    const value = row?.dataset.layerId;
    if (select === null || row === null || value === undefined || !list.contains(row)) return;
    const sourceLayerId = parseLayerId(value);
    try {
      options.paintSession.setActiveLayer(sourceLayerId);
      refresh();
    } catch (error) {
      publishError(error);
      return;
    }
    drag = {
      pointerId: event.pointerId,
      sourceLayerId,
      startX: event.clientX,
      startY: event.clientY,
      dragging: false,
      targetLayerId: null,
      beforeOnScreen: false,
    };
    list.setPointerCapture?.(event.pointerId);
  };

  const onPointerMove = (event: PointerEvent): void => {
    if (drag === null || drag.pointerId !== event.pointerId) return;
    if (!drag.dragging && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 8)
      return;
    drag.dragging = true;
    event.preventDefault();
    clearDropIndicator();
    const target = document.elementFromPoint(event.clientX, event.clientY);
    const row = target?.closest<HTMLElement>('[data-layer-id]') ?? null;
    const value = row?.dataset.layerId;
    if (row === null || value === undefined || !list.contains(row)) {
      drag.targetLayerId = null;
      return;
    }
    const targetLayerId = parseLayerId(value);
    if (targetLayerId === drag.sourceLayerId) {
      drag.targetLayerId = null;
      return;
    }
    const rect = row.getBoundingClientRect();
    drag.targetLayerId = targetLayerId;
    drag.beforeOnScreen = event.clientY < rect.top + rect.height / 2;
    row.dataset.dropPosition = drag.beforeOnScreen ? 'before' : 'after';
  };

  const finishPointerDrag = (event: PointerEvent): void => {
    if (drag === null || drag.pointerId !== event.pointerId) return;
    const finished = drag;
    drag = null;
    try {
      if (list.hasPointerCapture?.(event.pointerId)) list.releasePointerCapture?.(event.pointerId);
    } catch {
      // Pointer capture may already be released by the UA.
    }
    clearDropIndicator();
    if (!finished.dragging || finished.targetLayerId === null) return;
    const current = options.paintSession.projectSnapshot();
    if (current === null) return;
    const rootsWithoutSource = current.document.layerTree.rootLayerIds.filter(
      (id) => id !== finished.sourceLayerId,
    );
    const targetIndex = rootsWithoutSource.indexOf(finished.targetLayerId);
    if (targetIndex < 0) return;
    const finalIndex = finished.beforeOnScreen ? targetIndex + 1 : targetIndex;
    commitMutation(
      'layer.reorder',
      (before, revision) =>
        reorderRootLayerSnapshotV1(before, finished.sourceLayerId, finalIndex, revision),
      () => finished.sourceLayerId,
    );
  };

  maskButton.addEventListener('click', onMask);
  duplicateButton.addEventListener('click', onDuplicate);
  deleteButton.addEventListener('click', onDelete);
  renameButton.addEventListener('click', onRename);
  renameForm.addEventListener('submit', onRenameSubmit);
  renameCancel.addEventListener('click', onRenameCancel);
  opacityInput.addEventListener('change', onOpacity);
  lockButton.addEventListener('click', onLock);
  alphaLockButton.addEventListener('click', onAlphaLock);
  moveUpButton.addEventListener('click', onMoveUp);
  moveDownButton.addEventListener('click', onMoveDown);
  list.addEventListener('click', onListClick);
  list.addEventListener('pointerdown', onPointerDown);
  list.addEventListener('pointermove', onPointerMove);
  list.addEventListener('pointerup', finishPointerDrag);
  list.addEventListener('pointercancel', finishPointerDrag);
  refresh();

  return Object.freeze({
    schema: 'illustro.layer-workflow/1' as const,
    refresh,
    dispose(): void {
      if (disposed) return;
      disposed = true;
      for (const [kind, handler] of createHandlers)
        buttons.get(kind)?.removeEventListener('click', handler);
      maskButton.removeEventListener('click', onMask);
      duplicateButton.removeEventListener('click', onDuplicate);
      deleteButton.removeEventListener('click', onDelete);
      renameButton.removeEventListener('click', onRename);
      renameForm.removeEventListener('submit', onRenameSubmit);
      renameCancel.removeEventListener('click', onRenameCancel);
      opacityInput.removeEventListener('change', onOpacity);
      lockButton.removeEventListener('click', onLock);
      alphaLockButton.removeEventListener('click', onAlphaLock);
      moveUpButton.removeEventListener('click', onMoveUp);
      moveDownButton.removeEventListener('click', onMoveDown);
      list.removeEventListener('click', onListClick);
      list.removeEventListener('pointerdown', onPointerDown);
      list.removeEventListener('pointermove', onPointerMove);
      list.removeEventListener('pointerup', finishPointerDrag);
      list.removeEventListener('pointercancel', finishPointerDrag);
      root.dataset.illustroLayerWorkflow = 'disposed';
    },
  });
}
