import { parseLayerId } from '../domain/identity.js';
import type { LayerBaseV1 } from '../domain/layers.js';
import {
  CREATABLE_LAYER_KINDS_V1,
  attachRasterMaskSnapshotV1,
  createDefaultLayerV1,
  defaultLayerNameV1,
  insertRootLayerSnapshotV1,
  type CreatableLayerKindV1,
} from './layer-creation.js';
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

export function installLayerWorkflowControllerV1(options: OptionsV1): LayerWorkflowControllerV1 {
  const root = options.root ?? document.documentElement;
  const list = required<HTMLElement>('#layer-list');
  const maskButton = required<HTMLButtonElement>('#layer-add-mask');
  const buttons = new Map<CreatableLayerKindV1, HTMLButtonElement>();
  for (const kind of CREATABLE_LAYER_KINDS_V1) buttons.set(kind, required(BUTTON_IDS[kind]));
  let disposed = false;

  const publishError = (error: unknown): void => {
    root.dataset.illustroLayerError = error instanceof Error ? error.message : String(error);
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
    const ordered = [...documentValue.layerTree.rootLayerIds].reverse();
    for (const layerId of ordered) {
      const layer = documentValue.layerTree.layers[layerId];
      if (layer === undefined) continue;
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'shell-layer-row';
      row.dataset.layerId = layerId;
      row.dataset.layerType = layer.type;
      row.setAttribute('aria-pressed', layerId === activeLayerId ? 'true' : 'false');
      if (layerId === activeLayerId) row.classList.add('is-selected');

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
      row.append(thumbnail, copy, masks);
      list.append(row);
    }
    const activeLayer =
      activeLayerId === null ? undefined : documentValue.layerTree.layers[activeLayerId];
    maskButton.disabled = activeLayer === undefined || activeLayer.type === 'lineartBoundary';
    root.dataset.illustroLayerCount = String(Object.keys(documentValue.layerTree.layers).length);
    root.dataset.illustroActiveLayerId = activeLayerId ?? '';
    root.dataset.illustroLayerWorkflow = 'ready';
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
        root.dataset.illustroLayerError = '';
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
    options.schedule(async () => {
      try {
        const targetLayerId = options.paintSession.activeLayerId();
        if (targetLayerId === null) throw new Error('Layer Mask requires an active layer');
        const transaction = await options.paintHistory.commitSnapshotTransform(
          'mask.create.raster',
          (before, revision) => attachRasterMaskSnapshotV1(before, targetLayerId, revision),
        );
        options.paintSession.setActiveLayer(targetLayerId);
        await options.paintPersistence.markDirty(transaction.transactionId);
        root.dataset.illustroLayerTransaction = transaction.transactionId;
        root.dataset.illustroLayerError = '';
        refresh();
        options.onHistoryChanged();
      } catch (error) {
        publishError(error);
      }
    });
  };

  const onListClick = (event: MouseEvent): void => {
    const target =
      event.target instanceof Element
        ? event.target.closest<HTMLButtonElement>('[data-layer-id]')
        : null;
    if (target === null || !list.contains(target)) return;
    const value = target.dataset.layerId;
    if (value === undefined) return;
    try {
      options.paintSession.setActiveLayer(parseLayerId(value));
      root.dataset.illustroLayerError = '';
      refresh();
    } catch (error) {
      publishError(error);
    }
  };

  maskButton.addEventListener('click', onMask);
  list.addEventListener('click', onListClick);
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
      list.removeEventListener('click', onListClick);
      root.dataset.illustroLayerWorkflow = 'disposed';
    },
  });
}
