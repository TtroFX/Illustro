import type { PaintHistoryControllerV1 } from './paint-history-controller.js';
import type { PaintPersistenceControllerV1 } from './paint-persistence-controller.js';
import type { PaintSessionControllerV1 } from './paint-session-controller.js';
import {
  applyLayerCompSnapshotV1,
  findLayerCompV1,
  layerCompHasChangesV1,
  listLayerCompsV1,
  normalizeLayerCompNameV1,
  saveLayerCompSnapshotV1,
} from './layer-comps.js';

interface LayerCompsControllerOptionsV1 {
  readonly root?: HTMLElement;
  readonly paintSession: PaintSessionControllerV1;
  readonly paintHistory: PaintHistoryControllerV1;
  readonly paintPersistence: PaintPersistenceControllerV1;
  readonly schedule: (operation: () => Promise<void>) => void;
  readonly onHistoryChanged: () => void;
  readonly onLayerStateChanged: () => void;
}

export interface LayerCompsControllerV1 {
  refresh(): void;
  dispose(): void;
}

function requireElement<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (element === null) throw new Error(`Layer Comps UI is missing ${selector}`);
  return element;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function installLayerCompsControllerV1(
  options: LayerCompsControllerOptionsV1,
): LayerCompsControllerV1 {
  const root = options.root ?? document.documentElement;
  const nameInput = requireElement<HTMLInputElement>(root, '#layer-comp-name');
  const saveButton = requireElement<HTMLButtonElement>(root, '#layer-comp-save');
  const select = requireElement<HTMLSelectElement>(root, '#layer-comp-select');
  const applyButton = requireElement<HTMLButtonElement>(root, '#layer-comp-apply');
  const status = requireElement<HTMLOutputElement>(root, '#layer-comp-status');
  let disposed = false;

  const publishError = (error: unknown): void => {
    const message = errorMessage(error);
    status.value = message;
    root.dataset.illustroLayerComps = 'error';
    root.dataset.illustroLayerCompError = message;
  };

  const publishReady = (): void => {
    root.dataset.illustroLayerComps = 'ready';
    root.dataset.illustroLayerCompError = '';
  };

  const refresh = (): void => {
    if (disposed) return;
    try {
      const snapshot = options.paintSession.projectSnapshot();
      const comps = snapshot === null ? [] : listLayerCompsV1(snapshot);
      const selected = select.value;
      select.replaceChildren(new Option('Layer Comp', ''));
      for (const comp of comps) select.add(new Option(comp.name, comp.compId));
      if (comps.some((comp) => comp.compId === selected)) select.value = selected;
      const strokeActive = options.paintSession.activeStrokeId() !== null;
      let hasName = false;
      try {
        normalizeLayerCompNameV1(nameInput.value);
        hasName = true;
      } catch {
        hasName = false;
      }
      saveButton.disabled = snapshot === null || strokeActive || !hasName;
      applyButton.disabled = snapshot === null || strokeActive || select.value.length === 0;
      root.dataset.illustroLayerCompCount = String(comps.length);
      root.dataset.illustroLayerCompSelected = select.value;
      publishReady();
    } catch (error) {
      saveButton.disabled = true;
      applyButton.disabled = true;
      publishError(error);
    }
  };

  const onNameInput = (): void => refresh();
  const onSelect = (): void => {
    root.dataset.illustroLayerCompSelected = select.value;
    refresh();
  };

  const onSave = (): void => {
    options.schedule(async () => {
      try {
        if (options.paintSession.activeStrokeId() !== null) {
          throw new Error('Layer Comp save is unavailable while a stroke is active');
        }
        const name = normalizeLayerCompNameV1(nameInput.value);
        let savedCompId = '';
        const transaction = await options.paintHistory.commitSnapshotTransform(
          'layer.comp.save',
          (before, revision) => {
            const after = saveLayerCompSnapshotV1(before, name, revision);
            savedCompId = listLayerCompsV1(after).find((comp) => comp.name === name)?.compId ?? '';
            return after;
          },
        );
        await options.paintPersistence.markDirty(transaction.transactionId);
        root.dataset.illustroLayerCompTransaction = transaction.transactionId;
        nameInput.value = name;
        status.value = 'Layer Compを保存しました';
        options.onHistoryChanged();
        refresh();
        if (savedCompId.length > 0) {
          select.value = savedCompId;
          root.dataset.illustroLayerCompSelected = savedCompId;
          applyButton.disabled = false;
        }
      } catch (error) {
        publishError(error);
      }
    });
  };

  const onApply = (): void => {
    options.schedule(async () => {
      try {
        if (options.paintSession.activeStrokeId() !== null) {
          throw new Error('Layer Comp switch is unavailable while a stroke is active');
        }
        const snapshot = options.paintSession.projectSnapshot();
        if (snapshot === null) throw new Error('Layer Comp switch requires an active document');
        const compId = select.value;
        const comp = findLayerCompV1(snapshot, compId);
        if (comp === null) throw new Error('Layer Comp not found');
        if (!layerCompHasChangesV1(snapshot, compId)) {
          status.value = 'このLayer Compは既に適用されています';
          publishReady();
          return;
        }
        const transaction = await options.paintHistory.commitSnapshotTransform(
          'layer.comp.switch',
          (before, revision) => applyLayerCompSnapshotV1(before, compId, revision),
        );
        await options.paintPersistence.markDirty(transaction.transactionId);
        root.dataset.illustroLayerCompTransaction = transaction.transactionId;
        status.value = `${comp.name} に切り替えました`;
        options.onLayerStateChanged();
        options.onHistoryChanged();
        refresh();
        select.value = compId;
        root.dataset.illustroLayerCompSelected = compId;
      } catch (error) {
        publishError(error);
      }
    });
  };

  nameInput.addEventListener('input', onNameInput);
  select.addEventListener('change', onSelect);
  saveButton.addEventListener('click', onSave);
  applyButton.addEventListener('click', onApply);
  refresh();

  return Object.freeze({
    refresh,
    dispose() {
      if (disposed) return;
      disposed = true;
      nameInput.removeEventListener('input', onNameInput);
      select.removeEventListener('change', onSelect);
      saveButton.removeEventListener('click', onSave);
      applyButton.removeEventListener('click', onApply);
      root.dataset.illustroLayerComps = 'disposed';
    },
  });
}
