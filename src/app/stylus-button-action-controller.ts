import type { PointerInputBatchV1 } from '../input/pointer-input.js';
import {
  createCommandBindingV1,
  DEFAULT_PRIMARY_STYLUS_BARREL_BINDING_V1,
  parseCommandBindingV1,
  StylusButtonStateRouterV1,
  type CommandBindingV1,
  type StylusButtonPhaseV1,
  type StylusButtonSlotV1,
  type StylusButtonTransitionV1,
} from '../input/stylus-button-actions.js';

export const STYLUS_BUTTON_SETTINGS_SCHEMA_V1 = 'illustro.stylus-button-settings/1' as const;
export const STYLUS_BUTTON_SETTINGS_STORAGE_KEY_V1 = 'illustro.stylus-button-settings/1' as const;

export interface StylusButtonSettingsSnapshotV1 {
  readonly schema: typeof STYLUS_BUTTON_SETTINGS_SCHEMA_V1;
  readonly primaryBarrelBinding: CommandBindingV1 | null;
}

export interface StylusButtonInvocationV1 {
  readonly schema: 'illustro.stylus-button-invocation/1';
  readonly pointerId: number;
  readonly slot: StylusButtonSlotV1;
  readonly phase: StylusButtonPhaseV1;
  readonly binding: CommandBindingV1;
}

export interface StylusButtonActionControllerV1 {
  readonly schema: 'illustro.stylus-button-action-controller/1';
  snapshot(): StylusButtonSettingsSnapshotV1;
  ingest(batch: PointerInputBatchV1): void;
  dispose(): void;
}

export function createStylusButtonSettingsSnapshotV1(
  input: { readonly primaryBarrelBinding?: CommandBindingV1 | null } = {},
): StylusButtonSettingsSnapshotV1 {
  const binding =
    input.primaryBarrelBinding === undefined
      ? DEFAULT_PRIMARY_STYLUS_BARREL_BINDING_V1
      : input.primaryBarrelBinding === null
        ? null
        : parseCommandBindingV1(input.primaryBarrelBinding);
  return Object.freeze({
    schema: STYLUS_BUTTON_SETTINGS_SCHEMA_V1,
    primaryBarrelBinding: binding,
  });
}

export function serializeStylusButtonSettingsV1(snapshot: StylusButtonSettingsSnapshotV1): string {
  return JSON.stringify(snapshot);
}

export function parseStylusButtonSettingsV1(raw: string): StylusButtonSettingsSnapshotV1 {
  const value: unknown = JSON.parse(raw);
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError('stylus button settings must be an object');
  }
  const record = value as { readonly schema?: unknown; readonly primaryBarrelBinding?: unknown };
  if (record.schema !== STYLUS_BUTTON_SETTINGS_SCHEMA_V1) {
    throw new TypeError('unsupported stylus button settings schema');
  }
  if (record.primaryBarrelBinding === null) {
    return createStylusButtonSettingsSnapshotV1({ primaryBarrelBinding: null });
  }
  return createStylusButtonSettingsSnapshotV1({
    primaryBarrelBinding: parseCommandBindingV1(record.primaryBarrelBinding),
  });
}

function required<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector(selector);
  if (element === null) throw new Error(`stylus button settings are missing ${selector}`);
  return element as T;
}

function loadSettings(storage: Storage | null): StylusButtonSettingsSnapshotV1 {
  const raw = storage?.getItem(STYLUS_BUTTON_SETTINGS_STORAGE_KEY_V1);
  if (raw === null || raw === undefined) return createStylusButtonSettingsSnapshotV1();
  try {
    return parseStylusButtonSettingsV1(raw);
  } catch {
    return createStylusButtonSettingsSnapshotV1();
  }
}

export function installStylusButtonActionControllerV1(input: {
  readonly root: HTMLElement;
  readonly storage?: Storage | null;
  readonly onAction: (invocation: StylusButtonInvocationV1) => void;
}): StylusButtonActionControllerV1 {
  const storage = input.storage ?? globalThis.localStorage;
  const openButton = required<HTMLButtonElement>(input.root, '#view-stylus-button-settings');
  const dialog = required<HTMLDialogElement>(input.root, '#stylus-button-dialog');
  const form = required<HTMLFormElement>(input.root, '#stylus-button-form');
  const primaryBarrelSelect = required<HTMLSelectElement>(
    input.root,
    '#stylus-primary-barrel-action',
  );
  const resetButton = required<HTMLButtonElement>(input.root, '#stylus-button-reset');
  const cancelButton = required<HTMLButtonElement>(input.root, '#stylus-button-cancel');
  const status = required<HTMLOutputElement>(input.root, '#stylus-button-status');
  const router = new StylusButtonStateRouterV1();
  const activeBindings = new Map<number, CommandBindingV1>();
  let state = loadSettings(storage);
  let disposed = false;

  const ensureSelectValue = (binding: CommandBindingV1 | null): void => {
    const value = binding?.commandId ?? '';
    if (
      value !== '' &&
      !Array.from(primaryBarrelSelect.options).some((option) => option.value === value)
    ) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = `登録済みコマンド: ${value}`;
      option.dataset.illustroPersistedBinding = 'true';
      primaryBarrelSelect.append(option);
    }
    primaryBarrelSelect.value = value;
  };

  const publish = (): void => {
    input.root.dataset.illustroStylusPrimaryBarrelBinding =
      state.primaryBarrelBinding?.commandId ?? 'none';
    input.root.dataset.illustroStylusPrimaryBarrelHeld = String(
      router.snapshot().primaryBarrelHeldPointers,
    );
    ensureSelectValue(state.primaryBarrelBinding);
  };

  const dispatch = (transition: StylusButtonTransitionV1): void => {
    let binding: CommandBindingV1 | undefined;
    if (transition.phase === 'pressed') {
      binding = state.primaryBarrelBinding ?? undefined;
      if (binding === undefined) return;
      activeBindings.set(transition.pointerId, binding);
    } else {
      binding = activeBindings.get(transition.pointerId);
      activeBindings.delete(transition.pointerId);
      if (binding === undefined) return;
    }
    input.onAction(
      Object.freeze({
        schema: 'illustro.stylus-button-invocation/1' as const,
        pointerId: transition.pointerId,
        slot: transition.slot,
        phase: transition.phase,
        binding,
      }),
    );
  };

  const ingest = (batch: PointerInputBatchV1): void => {
    if (disposed) return;
    for (const transition of router.route(batch)) dispatch(transition);
    publish();
  };

  const releaseAll = (): void => {
    for (const transition of router.releaseAll()) dispatch(transition);
    publish();
  };

  const persist = (): void => {
    try {
      storage?.setItem(
        STYLUS_BUTTON_SETTINGS_STORAGE_KEY_V1,
        serializeStylusButtonSettingsV1(state),
      );
    } catch {
      // Input preference persistence is best-effort; drawing remains available.
    }
  };

  const onOpen = (): void => {
    ensureSelectValue(state.primaryBarrelBinding);
    status.value = '第1バレルボタンの割り当てを選択してください';
    dialog.showModal();
  };
  const onSubmit = (event: SubmitEvent): void => {
    event.preventDefault();
    const commandId = primaryBarrelSelect.value;
    state = createStylusButtonSettingsSnapshotV1({
      primaryBarrelBinding: commandId === '' ? null : createCommandBindingV1(commandId),
    });
    persist();
    publish();
    status.value = commandId === '' ? '第1バレル: なし' : '第1バレル: 一時スポイト';
    dialog.close();
  };
  const onReset = (): void => {
    state = createStylusButtonSettingsSnapshotV1();
    persist();
    publish();
    status.value = '既定: 一時スポイト';
  };
  const onCancel = (): void => {
    ensureSelectValue(state.primaryBarrelBinding);
    dialog.close();
  };
  const onWindowBlur = (): void => releaseAll();

  openButton.addEventListener('click', onOpen);
  form.addEventListener('submit', onSubmit);
  resetButton.addEventListener('click', onReset);
  cancelButton.addEventListener('click', onCancel);
  window.addEventListener('blur', onWindowBlur);
  publish();

  return Object.freeze({
    schema: 'illustro.stylus-button-action-controller/1' as const,
    snapshot: () => state,
    ingest,
    dispose(): void {
      if (disposed) return;
      releaseAll();
      disposed = true;
      openButton.removeEventListener('click', onOpen);
      form.removeEventListener('submit', onSubmit);
      resetButton.removeEventListener('click', onReset);
      cancelButton.removeEventListener('click', onCancel);
      window.removeEventListener('blur', onWindowBlur);
      activeBindings.clear();
      input.root.dataset.illustroStylusPrimaryBarrelBinding = 'disposed';
    },
  });
}
