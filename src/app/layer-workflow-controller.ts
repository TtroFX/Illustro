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
  applyGroupedAffineLayerTransformSnapshotV1,
  groupedLayerTransformEligibilityV1,
} from './layer-group-transform.js';
import {
  canMoveRootLayerSelectionStepV1,
  clearLayerSnapshotV1,
  deleteRootLayerSnapshotV1,
  duplicateRootLayerSnapshotV1,
  moveRootLayerSelectionStepSnapshotV1,
  renameLayerSnapshotV1,
  reorderRootLayerSelectionSnapshotV1,
  reorderRootLayerSnapshotV1,
  setLayerAllLockSnapshotV1,
  setLayerAlphaLockSnapshotV1,
  setLayerClippingSnapshotV1,
  setLayerOpacitySnapshotV1,
  setLayerVisibilitySnapshotV1,
} from './layer-operations.js';
import {
  applyPreparedRasterMergeDownV1,
  applyPreparedRasterMergeVisibleCopyV1,
  prepareRasterMergeDownV1,
  prepareRasterMergeVisibleCopyV1,
  rasterMergeDownEligibilityV1,
  rasterMergeVisibleCopyEligibilityV1,
} from './layer-raster-merge.js';
import {
  applyPreparedLayerRasterizeV1,
  layerRasterizeEligibilityV1,
  prepareLayerRasterizeV1,
} from './layer-rasterize.js';
import {
  applyPreparedLayerInvertV1,
  layerInvertEligibilityV1,
  prepareLayerInvertV1,
} from './layer-raster-invert.js';
import {
  applyPreparedLayerRasterFlipV1,
  layerRasterFlipEligibilityV1,
  prepareLayerRasterFlipV1,
} from './layer-raster-flip.js';
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

function nextMergedVisibleName(layers: Readonly<Record<string, LayerBaseV1>>): string {
  const base = 'Merged Visible';
  const used = new Set(Object.values(layers).map((layer) => layer.name));
  if (!used.has(base)) return base;
  for (let suffix = 2; suffix < Number.MAX_SAFE_INTEGER; suffix += 1) {
    const candidate = `${base} ${suffix}`;
    if (!used.has(candidate)) return candidate;
  }
  throw new RangeError('merged visible layer name sequence is exhausted');
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
  const mergeDownButton = required<HTMLButtonElement>('#layer-merge-down');
  const mergeVisibleCopyButton = required<HTMLButtonElement>('#layer-merge-visible-copy');
  const rasterizeButton = required<HTMLButtonElement>('#layer-rasterize');
  const invertButton = required<HTMLButtonElement>('#layer-invert');
  const horizontalFlipButton = required<HTMLButtonElement>('#layer-flip-horizontal');
  const verticalFlipButton = required<HTMLButtonElement>('#layer-flip-vertical');
  const groupedTransformButton = required<HTMLButtonElement>('#layer-group-transform');
  const groupedTransformDialog = required<HTMLDialogElement>('#layer-group-transform-dialog');
  const groupedTransformForm = required<HTMLFormElement>('#layer-group-transform-form');
  const groupedTransformCancel = required<HTMLButtonElement>('#layer-group-transform-cancel');
  const groupedTransformX = required<HTMLInputElement>('#layer-group-transform-x');
  const groupedTransformY = required<HTMLInputElement>('#layer-group-transform-y');
  const groupedTransformScaleX = required<HTMLInputElement>('#layer-group-transform-scale-x');
  const groupedTransformScaleY = required<HTMLInputElement>('#layer-group-transform-scale-y');
  const groupedTransformRotation = required<HTMLInputElement>('#layer-group-transform-rotation');
  const groupedTransformPivotX = required<HTMLInputElement>('#layer-group-transform-pivot-x');
  const groupedTransformPivotY = required<HTMLInputElement>('#layer-group-transform-pivot-y');
  const groupedTransformStatus = required<HTMLOutputElement>('#layer-group-transform-status');
  const deleteButton = required<HTMLButtonElement>('#layer-delete');
  const clearButton = required<HTMLButtonElement>('#layer-clear');
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
    groupedTransformStatus.value = message;
  };

  const clearError = (): void => {
    root.dataset.illustroLayerError = '';
    status.value = '';
    groupedTransformStatus.value = '';
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
    const selectedLayerIds = new Set(options.paintSession.selectedLayerIds());
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
      if (selectedLayerIds.has(layerId)) row.classList.add('is-selected');
      if (layerId === activeLayerId) row.classList.add('is-active');

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
      select.setAttribute('aria-pressed', selectedLayerIds.has(layerId) ? 'true' : 'false');
      if (layerId === activeLayerId) select.setAttribute('aria-current', 'true');

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
    const projectSnapshot = options.paintSession.projectSnapshot();
    const mergeEligibility =
      active === null || projectSnapshot === null
        ? null
        : rasterMergeDownEligibilityV1(projectSnapshot, active.id);
    mergeDownButton.disabled =
      mergeEligibility?.eligible !== true || options.paintSession.activeStrokeId() !== null;
    mergeDownButton.title = mergeEligibility?.reason ?? '下のレイヤーと結合';
    const mergeVisibleEligibility =
      projectSnapshot === null ? null : rasterMergeVisibleCopyEligibilityV1(projectSnapshot);
    mergeVisibleCopyButton.disabled =
      mergeVisibleEligibility?.eligible !== true || options.paintSession.activeStrokeId() !== null;
    mergeVisibleCopyButton.title = mergeVisibleEligibility?.reason ?? '表示レイヤーを結合コピー';
    const rasterizeEligibility =
      active === null || projectSnapshot === null
        ? null
        : layerRasterizeEligibilityV1(projectSnapshot, active.id);
    rasterizeButton.disabled =
      rasterizeEligibility?.eligible !== true || options.paintSession.activeStrokeId() !== null;
    rasterizeButton.title = rasterizeEligibility?.reason ?? 'ラスタライズ';
    const invertEligibility =
      active === null || projectSnapshot === null
        ? null
        : layerInvertEligibilityV1(projectSnapshot, active.id);
    invertButton.disabled =
      invertEligibility?.eligible !== true || options.paintSession.activeStrokeId() !== null;
    invertButton.title = invertEligibility?.reason ?? '色反転';
    const flipEligibility =
      active === null || projectSnapshot === null
        ? null
        : layerRasterFlipEligibilityV1(projectSnapshot, active.id);
    horizontalFlipButton.disabled =
      flipEligibility?.eligible !== true || options.paintSession.activeStrokeId() !== null;
    horizontalFlipButton.title = flipEligibility?.reason ?? 'レイヤーを左右反転';
    verticalFlipButton.disabled =
      flipEligibility?.eligible !== true || options.paintSession.activeStrokeId() !== null;
    verticalFlipButton.title = flipEligibility?.reason ?? 'レイヤーを上下反転';
    const groupedTransformLayerIds = options.paintSession
      .selectedLayerIds()
      .filter((id) => documentValue.layerTree.rootLayerIds.includes(id));
    const groupedTransformEligibility =
      projectSnapshot === null
        ? null
        : groupedLayerTransformEligibilityV1(projectSnapshot, groupedTransformLayerIds);
    groupedTransformButton.disabled =
      groupedTransformEligibility?.eligible !== true ||
      options.paintSession.activeStrokeId() !== null;
    groupedTransformButton.title =
      groupedTransformEligibility?.reason ?? '選択中の複数レイヤーをまとめて変形';
    deleteButton.disabled = disabled;
    clearButton.disabled =
      disabled ||
      (active?.layer.type !== 'raster' && active?.layer.type !== 'vector') ||
      active.layer.locks.all ||
      active.layer.locks.pixels;
    renameButton.disabled = disabled;
    lockButton.disabled = disabled;
    alphaLockButton.disabled = disabled;
    opacityInput.disabled = disabled;
    const roots = documentValue.layerTree.rootLayerIds;
    const selectedRoots = options.paintSession
      .selectedLayerIds()
      .filter((id) => roots.includes(id));
    moveUpButton.disabled =
      selectedRoots.length === 0 ||
      !canMoveRootLayerSelectionStepV1(projectSnapshot!, selectedRoots, 1);
    moveDownButton.disabled =
      selectedRoots.length === 0 ||
      !canMoveRootLayerSelectionStepV1(projectSnapshot!, selectedRoots, -1);
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
    root.dataset.illustroSelectedLayerCount = String(selectedLayerIds.size);
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

  const onMergeDown = (): void => {
    const sourceLayerId = options.paintSession.activeLayerId();
    if (sourceLayerId === null) return;
    options.schedule(async () => {
      try {
        if (options.paintSession.activeStrokeId() !== null) {
          throw new Error('merge down is unavailable while a stroke is active');
        }
        const current = options.paintSession.projectSnapshot();
        if (current === null) return;
        const prepared = await prepareRasterMergeDownV1(
          current,
          sourceLayerId,
          options.paintPersistence,
        );
        const transaction = await options.paintHistory.commitSnapshotTransform(
          'layer.mergeDown',
          (before, revision) => applyPreparedRasterMergeDownV1(before, prepared, revision),
        );
        options.paintSession.setActiveLayer(prepared.targetLayerId);
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

  const onMergeVisibleCopy = (): void => {
    options.schedule(async () => {
      try {
        if (options.paintSession.activeStrokeId() !== null) {
          throw new Error('merge visible copy is unavailable while a stroke is active');
        }
        const current = options.paintSession.projectSnapshot();
        if (current === null) return;
        const prepared = await prepareRasterMergeVisibleCopyV1(
          current,
          nextMergedVisibleName(current.document.layerTree.layers),
          options.paintPersistence,
        );
        const transaction = await options.paintHistory.commitSnapshotTransform(
          'layer.mergeVisibleCopy',
          (before, revision) => applyPreparedRasterMergeVisibleCopyV1(before, prepared, revision),
        );
        options.paintSession.setActiveLayer(prepared.outputLayerId);
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

  const onRasterize = (): void => {
    const layerId = options.paintSession.activeLayerId();
    if (layerId === null) return;
    options.schedule(async () => {
      try {
        if (options.paintSession.activeStrokeId() !== null) {
          throw new Error('rasterize is unavailable while a stroke is active');
        }
        const current = options.paintSession.projectSnapshot();
        if (current === null) return;
        const prepared = await prepareLayerRasterizeV1(current, layerId, options.paintPersistence);
        const transaction = await options.paintHistory.commitSnapshotTransform(
          'layer.rasterize',
          (before, revision) => applyPreparedLayerRasterizeV1(before, prepared, revision),
        );
        options.paintSession.setActiveLayer(layerId);
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

  const onInvert = (): void => {
    const layerId = options.paintSession.activeLayerId();
    if (layerId === null) return;
    options.schedule(async () => {
      try {
        if (options.paintSession.activeStrokeId() !== null) {
          throw new Error('layer invert is unavailable while a stroke is active');
        }
        const current = options.paintSession.projectSnapshot();
        if (current === null) return;
        const prepared = await prepareLayerInvertV1(current, layerId, options.paintPersistence);
        const transaction = await options.paintHistory.commitSnapshotTransform(
          'layer.invert',
          (before, revision) => applyPreparedLayerInvertV1(before, prepared, revision),
        );
        options.paintSession.setActiveLayer(layerId);
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

  const onHorizontalFlip = (): void => {
    const layerId = options.paintSession.activeLayerId();
    if (layerId === null) return;
    options.schedule(async () => {
      try {
        if (options.paintSession.activeStrokeId() !== null) {
          throw new Error('layer horizontal flip is unavailable while a stroke is active');
        }
        const current = options.paintSession.projectSnapshot();
        if (current === null) return;
        const prepared = await prepareLayerRasterFlipV1(
          current,
          layerId,
          'horizontal',
          options.paintPersistence,
        );
        const transaction = await options.paintHistory.commitSnapshotTransform(
          'layer.flip.horizontal',
          (before, revision) => applyPreparedLayerRasterFlipV1(before, prepared, revision),
        );
        options.paintSession.setActiveLayer(layerId);
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

  const onVerticalFlip = (): void => {
    const layerId = options.paintSession.activeLayerId();
    if (layerId === null) return;
    options.schedule(async () => {
      try {
        if (options.paintSession.activeStrokeId() !== null) {
          throw new Error('layer vertical flip is unavailable while a stroke is active');
        }
        const current = options.paintSession.projectSnapshot();
        if (current === null) return;
        const prepared = await prepareLayerRasterFlipV1(
          current,
          layerId,
          'vertical',
          options.paintPersistence,
        );
        const transaction = await options.paintHistory.commitSnapshotTransform(
          'layer.flip.vertical',
          (before, revision) => applyPreparedLayerRasterFlipV1(before, prepared, revision),
        );
        options.paintSession.setActiveLayer(layerId);
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

  const numericTransformValue = (input: HTMLInputElement, label: string): number => {
    const value = Number(input.value);
    if (!Number.isFinite(value)) throw new RangeError(`${label} must be finite`);
    return value;
  };

  const onGroupedTransform = (): void => {
    const current = options.paintSession.projectSnapshot();
    if (current === null) return;
    const layerIds = options.paintSession
      .selectedLayerIds()
      .filter((id) => current.document.layerTree.rootLayerIds.includes(id));
    const eligibility = groupedLayerTransformEligibilityV1(current, layerIds);
    if (!eligibility.eligible) {
      publishError(new Error(eligibility.reason ?? 'grouped transform is unavailable'));
      return;
    }
    groupedTransformX.value = '0';
    groupedTransformY.value = '0';
    groupedTransformScaleX.value = '100';
    groupedTransformScaleY.value = '100';
    groupedTransformRotation.value = '0';
    groupedTransformPivotX.value = String(current.document.canvas.width / 2);
    groupedTransformPivotY.value = String(current.document.canvas.height / 2);
    clearError();
    groupedTransformDialog.showModal();
  };

  const onGroupedTransformCancel = (): void => {
    groupedTransformDialog.close();
    clearError();
  };

  const onGroupedTransformSubmit = (event: SubmitEvent): void => {
    event.preventDefault();
    const current = options.paintSession.projectSnapshot();
    if (current === null) return;
    const layerIds = options.paintSession
      .selectedLayerIds()
      .filter((id) => current.document.layerTree.rootLayerIds.includes(id));
    try {
      const input = Object.freeze({
        translateX: numericTransformValue(groupedTransformX, 'translateX'),
        translateY: numericTransformValue(groupedTransformY, 'translateY'),
        scaleX: numericTransformValue(groupedTransformScaleX, 'scaleX') / 100,
        scaleY: numericTransformValue(groupedTransformScaleY, 'scaleY') / 100,
        rotationDeg: numericTransformValue(groupedTransformRotation, 'rotationDeg'),
        pivotX: numericTransformValue(groupedTransformPivotX, 'pivotX'),
        pivotY: numericTransformValue(groupedTransformPivotY, 'pivotY'),
      });
      options.schedule(async () => {
        try {
          if (options.paintSession.activeStrokeId() !== null) {
            throw new Error('grouped transform is unavailable while a stroke is active');
          }
          const transaction = await options.paintHistory.commitSnapshotTransform(
            'layer.transform.grouped',
            (before, revision) =>
              applyGroupedAffineLayerTransformSnapshotV1(before, layerIds, input, revision),
          );
          await options.paintPersistence.markDirty(transaction.transactionId);
          root.dataset.illustroLayerTransaction = transaction.transactionId;
          groupedTransformDialog.close();
          clearError();
          refresh();
          options.onHistoryChanged();
        } catch (error) {
          publishError(error);
        }
      });
    } catch (error) {
      publishError(error);
    }
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

  const onClear = (): void => {
    const layerId = options.paintSession.activeLayerId();
    if (layerId === null) return;
    commitMutation(
      'layer.clear',
      (before, revision) => clearLayerSnapshotV1(before, layerId, revision),
      () => layerId,
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
    const roots = current.document.layerTree.rootLayerIds;
    const selectedRoots = options.paintSession
      .selectedLayerIds()
      .filter((id) => roots.includes(id));
    if (selectedRoots.length <= 1) {
      const index = roots.indexOf(layerId);
      const target = index + delta;
      if (index < 0 || target < 0 || target >= roots.length) return;
      commitMutation(
        'layer.reorder',
        (before, revision) => reorderRootLayerSnapshotV1(before, layerId, target, revision),
        () => layerId,
      );
      return;
    }
    if (!canMoveRootLayerSelectionStepV1(current, selectedRoots, delta)) return;
    options.schedule(async () => {
      try {
        const transaction = await options.paintHistory.commitSnapshotTransform(
          'layer.reorder.multi',
          (before, revision) =>
            moveRootLayerSelectionStepSnapshotV1(before, selectedRoots, delta, revision),
        );
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
        const mode = event.shiftKey
          ? 'range'
          : event.ctrlKey || event.metaKey
            ? 'toggle'
            : 'replace';
        if (mode !== 'replace') event.preventDefault();
        options.paintSession.selectLayer(layerId, mode);
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
      const modifiedSelectionGesture = event.shiftKey || event.ctrlKey || event.metaKey;
      if (!modifiedSelectionGesture && !options.paintSession.isLayerSelected(sourceLayerId)) {
        options.paintSession.setActiveLayer(sourceLayerId);
        refresh();
      }
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
    if (
      targetLayerId === drag.sourceLayerId ||
      (options.paintSession.isLayerSelected(drag.sourceLayerId) &&
        options.paintSession.isLayerSelected(targetLayerId))
    ) {
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
    const roots = current.document.layerTree.rootLayerIds;
    const selectedRoots = options.paintSession.isLayerSelected(finished.sourceLayerId)
      ? options.paintSession.selectedLayerIds().filter((id) => roots.includes(id))
      : [finished.sourceLayerId];
    const selectedSet = new Set(selectedRoots);
    if (selectedSet.has(finished.targetLayerId)) return;
    const rootsWithoutSelection = roots.filter((id) => !selectedSet.has(id));
    const targetIndex = rootsWithoutSelection.indexOf(finished.targetLayerId);
    if (targetIndex < 0) return;
    const finalIndex = finished.beforeOnScreen ? targetIndex + 1 : targetIndex;
    options.schedule(async () => {
      try {
        const transaction = await options.paintHistory.commitSnapshotTransform(
          selectedRoots.length > 1 ? 'layer.reorder.multi' : 'layer.reorder',
          (before, revision) =>
            reorderRootLayerSelectionSnapshotV1(before, selectedRoots, finalIndex, revision),
        );
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

  maskButton.addEventListener('click', onMask);
  duplicateButton.addEventListener('click', onDuplicate);
  mergeDownButton.addEventListener('click', onMergeDown);
  mergeVisibleCopyButton.addEventListener('click', onMergeVisibleCopy);
  rasterizeButton.addEventListener('click', onRasterize);
  invertButton.addEventListener('click', onInvert);
  horizontalFlipButton.addEventListener('click', onHorizontalFlip);
  verticalFlipButton.addEventListener('click', onVerticalFlip);
  groupedTransformButton.addEventListener('click', onGroupedTransform);
  groupedTransformForm.addEventListener('submit', onGroupedTransformSubmit);
  groupedTransformCancel.addEventListener('click', onGroupedTransformCancel);
  deleteButton.addEventListener('click', onDelete);
  clearButton.addEventListener('click', onClear);
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
      mergeDownButton.removeEventListener('click', onMergeDown);
      mergeVisibleCopyButton.removeEventListener('click', onMergeVisibleCopy);
      rasterizeButton.removeEventListener('click', onRasterize);
      invertButton.removeEventListener('click', onInvert);
      horizontalFlipButton.removeEventListener('click', onHorizontalFlip);
      verticalFlipButton.removeEventListener('click', onVerticalFlip);
      groupedTransformButton.removeEventListener('click', onGroupedTransform);
      groupedTransformForm.removeEventListener('submit', onGroupedTransformSubmit);
      groupedTransformCancel.removeEventListener('click', onGroupedTransformCancel);
      deleteButton.removeEventListener('click', onDelete);
      clearButton.removeEventListener('click', onClear);
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
