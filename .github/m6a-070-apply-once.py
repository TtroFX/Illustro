from pathlib import Path


def read(path: str) -> str:
    return Path(path).read_text(encoding='utf-8')


def write(path: str, text: str) -> None:
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    Path(path).write_text(text, encoding='utf-8')


def replace_once(path: str, old: str, new: str) -> None:
    text = read(path)
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{path}: expected one match, found {count}: {old[:120]!r}')
    write(path, text.replace(old, new, 1))


write(
    'src/input/stylus-button-actions.ts',
    """import type { PointerInputBatchV1, PointerInputSampleV1 } from './pointer-input.js';

export const PRIMARY_STYLUS_BARREL_BUTTONS_MASK_V1 = 2;
export const DEFAULT_PRIMARY_STYLUS_BARREL_COMMAND_ID_V1 = 'tool.eyedropper.temporary' as const;

export type CommandBindingArgumentV1 = string | number | boolean | null;

export interface CommandBindingV1 {
  readonly commandId: string;
  readonly args?: Readonly<Record<string, CommandBindingArgumentV1>>;
}

export type StylusButtonSlotV1 = 'barrel-primary';
export type StylusButtonPhaseV1 = 'pressed' | 'released';

export interface StylusButtonTransitionV1 {
  readonly schema: 'illustro.stylus-button-transition/1';
  readonly pointerId: number;
  readonly slot: StylusButtonSlotV1;
  readonly phase: StylusButtonPhaseV1;
}

export interface StylusButtonRouterSnapshotV1 {
  readonly schema: 'illustro.stylus-button-router/1';
  readonly primaryBarrelHeldPointers: number;
}

function normalizeCommandIdV1(value: unknown): string {
  if (typeof value !== 'string') throw new TypeError('command binding id must be a string');
  const normalized = value.trim();
  if (normalized.length < 1 || normalized.length > 160) {
    throw new RangeError('command binding id must contain 1..160 characters');
  }
  return normalized;
}

function normalizeCommandArgsV1(
  value: unknown,
): Readonly<Record<string, CommandBindingArgumentV1>> | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError('command binding args must be a flat object');
  }
  const result: Record<string, CommandBindingArgumentV1> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (key.length < 1 || key.length > 80) throw new RangeError('command binding arg key is invalid');
    if (
      entry !== null &&
      typeof entry !== 'string' &&
      typeof entry !== 'boolean' &&
      !(typeof entry === 'number' && Number.isFinite(entry))
    ) {
      throw new TypeError('command binding arg values must be finite primitive JSON values');
    }
    result[key] = entry as CommandBindingArgumentV1;
  }
  return Object.keys(result).length === 0 ? undefined : Object.freeze(result);
}

export function createCommandBindingV1(
  commandId: string,
  args?: Readonly<Record<string, CommandBindingArgumentV1>>,
): CommandBindingV1 {
  const normalizedArgs = normalizeCommandArgsV1(args);
  return Object.freeze({
    commandId: normalizeCommandIdV1(commandId),
    ...(normalizedArgs === undefined ? {} : { args: normalizedArgs }),
  });
}

export function parseCommandBindingV1(value: unknown): CommandBindingV1 {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError('command binding must be an object');
  }
  const record = value as { readonly commandId?: unknown; readonly args?: unknown };
  return createCommandBindingV1(
    normalizeCommandIdV1(record.commandId),
    normalizeCommandArgsV1(record.args),
  );
}

export const DEFAULT_PRIMARY_STYLUS_BARREL_BINDING_V1: CommandBindingV1 = createCommandBindingV1(
  DEFAULT_PRIMARY_STYLUS_BARREL_COMMAND_ID_V1,
);

function transitionV1(
  pointerId: number,
  phase: StylusButtonPhaseV1,
): StylusButtonTransitionV1 {
  return Object.freeze({
    schema: 'illustro.stylus-button-transition/1' as const,
    pointerId,
    slot: 'barrel-primary' as const,
    phase,
  });
}

function primaryBarrelHeldV1(sample: PointerInputSampleV1): boolean {
  return (sample.buttons & PRIMARY_STYLUS_BARREL_BUTTONS_MASK_V1) !== 0;
}

export class StylusButtonStateRouterV1 {
  readonly #primaryBarrelHeldPointers = new Set<number>();

  route(batch: PointerInputBatchV1): readonly StylusButtonTransitionV1[] {
    const transitions: StylusButtonTransitionV1[] = [];
    for (const sample of batch.confirmed) {
      if (sample.source !== 'pen') continue;
      const wasHeld = this.#primaryBarrelHeldPointers.has(sample.pointerId);
      const isHeld = primaryBarrelHeldV1(sample);
      if (isHeld === wasHeld) continue;
      if (isHeld) this.#primaryBarrelHeldPointers.add(sample.pointerId);
      else this.#primaryBarrelHeldPointers.delete(sample.pointerId);
      transitions.push(transitionV1(sample.pointerId, isHeld ? 'pressed' : 'released'));
    }

    if (
      (batch.eventType === 'pointerup' || batch.eventType === 'pointercancel') &&
      this.#primaryBarrelHeldPointers.delete(batch.pointerId)
    ) {
      transitions.push(transitionV1(batch.pointerId, 'released'));
    }
    return Object.freeze(transitions);
  }

  releaseAll(): readonly StylusButtonTransitionV1[] {
    const transitions = [...this.#primaryBarrelHeldPointers]
      .sort((a, b) => a - b)
      .map((pointerId) => transitionV1(pointerId, 'released'));
    this.#primaryBarrelHeldPointers.clear();
    return Object.freeze(transitions);
  }

  snapshot(): StylusButtonRouterSnapshotV1 {
    return Object.freeze({
      schema: 'illustro.stylus-button-router/1' as const,
      primaryBarrelHeldPointers: this.#primaryBarrelHeldPointers.size,
    });
  }
}
""",
)

write(
    'src/app/stylus-button-action-controller.ts',
    """import type { PointerInputBatchV1 } from '../input/pointer-input.js';
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

export function createStylusButtonSettingsSnapshotV1(input: {
  readonly primaryBarrelBinding?: CommandBindingV1 | null;
} = {}): StylusButtonSettingsSnapshotV1 {
  const binding = input.primaryBarrelBinding === undefined
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
  const primaryBarrelSelect = required<HTMLSelectElement>(input.root, '#stylus-primary-barrel-action');
  const resetButton = required<HTMLButtonElement>(input.root, '#stylus-button-reset');
  const cancelButton = required<HTMLButtonElement>(input.root, '#stylus-button-cancel');
  const status = required<HTMLOutputElement>(input.root, '#stylus-button-status');
  const router = new StylusButtonStateRouterV1();
  const activeBindings = new Map<number, CommandBindingV1>();
  let state = loadSettings(storage);
  let disposed = false;

  const ensureSelectValue = (binding: CommandBindingV1 | null): void => {
    const value = binding?.commandId ?? '';
    if (value !== '' && ![...primaryBarrelSelect.options].some((option) => option.value === value)) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = `登録済みコマンド: ${value}`;
      option.dataset.illustroPersistedBinding = 'true';
      primaryBarrelSelect.append(option);
    }
    primaryBarrelSelect.value = value;
  };

  const publish = (): void => {
    input.root.dataset.illustroStylusPrimaryBarrelBinding = state.primaryBarrelBinding?.commandId ?? 'none';
    input.root.dataset.illustroStylusPrimaryBarrelHeld = String(router.snapshot().primaryBarrelHeldPointers);
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
      storage?.setItem(STYLUS_BUTTON_SETTINGS_STORAGE_KEY_V1, serializeStylusButtonSettingsV1(state));
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
""",
)

# Keep independent quick-eyedropper sources from clearing one another.
replace_once(
    'src/app/color-sampling.ts',
    """  #explicitEnabled = false;\n  #quickEnabled = false;\n  readonly #ownedPointers = new Set<number>();\n""",
    """  #explicitEnabled = false;\n  readonly #quickSources = new Set<string>();\n  readonly #ownedPointers = new Set<number>();\n""",
)
replace_once(
    'src/app/color-sampling.ts',
    """  setQuickEnabled(enabled: boolean): ColorSamplingOwnershipSnapshotV1 {\n    this.#quickEnabled = enabled;\n    return this.snapshot();\n  }\n\n  snapshot(): ColorSamplingOwnershipSnapshotV1 {\n    return Object.freeze({\n      schema: 'illustro.color-sampling-ownership/1' as const,\n      explicitEnabled: this.#explicitEnabled,\n      quickEnabled: this.#quickEnabled,\n      active: this.#explicitEnabled || this.#quickEnabled,\n      ownedPointerCount: this.#ownedPointers.size,\n    });\n  }\n""",
    """  setQuickEnabled(enabled: boolean): ColorSamplingOwnershipSnapshotV1 {\n    return this.setQuickSourceEnabled('legacy', enabled);\n  }\n\n  setQuickSourceEnabled(sourceId: string, enabled: boolean): ColorSamplingOwnershipSnapshotV1 {\n    const normalized = sourceId.trim();\n    if (normalized.length < 1 || normalized.length > 160) {\n      throw new RangeError('quick eyedropper source id must contain 1..160 characters');\n    }\n    if (enabled) this.#quickSources.add(normalized);\n    else this.#quickSources.delete(normalized);\n    return this.snapshot();\n  }\n\n  snapshot(): ColorSamplingOwnershipSnapshotV1 {\n    const quickEnabled = this.#quickSources.size > 0;\n    return Object.freeze({\n      schema: 'illustro.color-sampling-ownership/1' as const,\n      explicitEnabled: this.#explicitEnabled,\n      quickEnabled,\n      active: this.#explicitEnabled || quickEnabled,\n      ownedPointerCount: this.#ownedPointers.size,\n    });\n  }\n""",
)

# Expose the already-canonical quick eyedropper path to stylus binding plumbing.
replace_once(
    'src/app/color-workflow-controller.ts',
    """  snapshot(): ColorWorkspaceStateV1;\n  ingestPointerBatch(batch: PointerInputBatchV1): boolean;\n""",
    """  snapshot(): ColorWorkspaceStateV1;\n  setQuickEyedropperSourceEnabled(sourceId: string, enabled: boolean): void;\n  ingestPointerBatch(batch: PointerInputBatchV1): boolean;\n""",
)
replace_once(
    'src/app/color-workflow-controller.ts',
    """  const onQuickEyedropperKeyDown = (event: KeyboardEvent): void => {\n    if (event.key !== 'Alt' || isTextEditingTarget(event.target)) return;\n    samplingOwnership.setQuickEnabled(true);\n    publishSamplingState();\n    event.preventDefault();\n  };\n  const onQuickEyedropperKeyUp = (event: KeyboardEvent): void => {\n    if (event.key !== 'Alt') return;\n    samplingOwnership.setQuickEnabled(false);\n    publishSamplingState();\n    event.preventDefault();\n  };\n  const onWindowBlur = (): void => {\n    samplingOwnership.setQuickEnabled(false);\n    publishSamplingState();\n  };\n""",
    """  const setQuickEyedropperSourceEnabled = (sourceId: string, enabled: boolean): void => {\n    samplingOwnership.setQuickSourceEnabled(sourceId, enabled);\n    publishSamplingState();\n  };\n  const onQuickEyedropperKeyDown = (event: KeyboardEvent): void => {\n    if (event.key !== 'Alt' || isTextEditingTarget(event.target)) return;\n    setQuickEyedropperSourceEnabled('keyboard-alt', true);\n    event.preventDefault();\n  };\n  const onQuickEyedropperKeyUp = (event: KeyboardEvent): void => {\n    if (event.key !== 'Alt') return;\n    setQuickEyedropperSourceEnabled('keyboard-alt', false);\n    event.preventDefault();\n  };\n  const onWindowBlur = (): void => {\n    setQuickEyedropperSourceEnabled('keyboard-alt', false);\n  };\n""",
)
replace_once(
    'src/app/color-workflow-controller.ts',
    """    snapshot(): ColorWorkspaceStateV1 {\n      return state;\n    },\n    applyExternalSample(color: RgbUnitColorV1, sourceLabel: string): void {\n""",
    """    snapshot(): ColorWorkspaceStateV1 {\n      return state;\n    },\n    setQuickEyedropperSourceEnabled(sourceId: string, enabled: boolean): void {\n      if (disposed) return;\n      setQuickEyedropperSourceEnabled(sourceId, enabled);\n    },\n    applyExternalSample(color: RgbUnitColorV1, sourceLabel: string): void {\n""",
)

# Install stylus binding before raw pen batches enter ordinary arbitration/tool routing.
replace_once(
    'src/app/main.ts',
    """import { installTouchInputPolicyControllerV1 } from './touch-input-policy-controller.js';\n""",
    """import { installTouchInputPolicyControllerV1 } from './touch-input-policy-controller.js';\nimport { installStylusButtonActionControllerV1 } from './stylus-button-action-controller.js';\n""",
)
replace_once(
    'src/app/main.ts',
    """const touchInputPolicy = installTouchInputPolicyControllerV1({\n  root,\n  arbitration: pointerArbitration,\n  storage: globalThis.localStorage,\n});\nconst pointerHover = new PointerHoverTrackerV1();\n""",
    """const touchInputPolicy = installTouchInputPolicyControllerV1({\n  root,\n  arbitration: pointerArbitration,\n  storage: globalThis.localStorage,\n});\nconst stylusButtonActions = installStylusButtonActionControllerV1({\n  root,\n  storage: globalThis.localStorage,\n  onAction(invocation) {\n    if (invocation.binding.commandId === 'tool.eyedropper.temporary') {\n      colorWorkflow.setQuickEyedropperSourceEnabled(\n        `stylus-barrel-primary:${invocation.pointerId}`,\n        invocation.phase === 'pressed',\n      );\n      root.dataset.illustroStylusAction = `eyedropper-${invocation.phase}`;\n      incrementPerformanceCounter(`input.stylus.barrel.${invocation.phase}`);\n      return;\n    }\n    root.dataset.illustroStylusAction = `unhandled:${invocation.binding.commandId}`;\n  },\n});\nconst pointerHover = new PointerHoverTrackerV1();\n""",
)
replace_once(
    'src/app/main.ts',
    """const pointerInput = installPointerInputControllerV1(shell.canvas, (batch) => {\n  const latest = batch.confirmed.at(-1);\n""",
    """const pointerInput = installPointerInputControllerV1(shell.canvas, (batch) => {\n  stylusButtonActions.ingest(batch);\n  const latest = batch.confirmed.at(-1);\n""",
)
replace_once(
    'src/app/main.ts',
    """    viewport.dispose();\n    touchInputPolicy.dispose();\n    pointerInput.dispose();\n""",
    """    viewport.dispose();\n    stylusButtonActions.dispose();\n    touchInputPolicy.dispose();\n    pointerInput.dispose();\n""",
)

# Reachable dropdown mapping; current production action catalog is the already-wired temporary eyedropper plus unbound.
replace_once(
    'src/index.html',
    """              <button id=\"view-touch-input-settings\" type=\"button\">タッチ入力設定…</button>\n              <button id=\"view-brush-hover-crosshair\" type=\"button\" aria-pressed=\"false\">ブラシ中心十字</button>\n""",
    """              <button id=\"view-touch-input-settings\" type=\"button\">タッチ入力設定…</button>\n              <button id=\"view-stylus-button-settings\" type=\"button\">ペンボタン設定…</button>\n              <button id=\"view-brush-hover-crosshair\" type=\"button\" aria-pressed=\"false\">ブラシ中心十字</button>\n""",
)
replace_once(
    'src/index.html',
    """    <dialog id=\"touch-input-dialog\" class=\"document-dialog\" aria-labelledby=\"touch-input-dialog-title\">\n""",
    """    <dialog id=\"stylus-button-dialog\" class=\"document-dialog\" aria-labelledby=\"stylus-button-dialog-title\">\n      <form id=\"stylus-button-form\" method=\"dialog\" class=\"document-dialog-form\">\n        <header><h2 id=\"stylus-button-dialog-title\">ペンボタン設定</h2></header>\n        <div class=\"document-dialog-grid\">\n          <label>第1バレルボタン\n            <select id=\"stylus-primary-barrel-action\" aria-label=\"第1スタイラスバレルボタンの操作\">\n              <option value=\"tool.eyedropper.temporary\">押している間だけスポイト</option>\n              <option value=\"\">なし</option>\n            </select>\n          </label>\n        </div>\n        <p class=\"document-dialog-help\">ブラウザーが標準Pointer Eventsとして公開するペンの第1バレルボタンだけを使用します。未公開の端末ボタンはアプリから検出できません。</p>\n        <output id=\"stylus-button-status\" class=\"document-dialog-status\" aria-live=\"polite\"></output>\n        <footer>\n          <button id=\"stylus-button-reset\" type=\"button\" class=\"document-dialog-secondary\">既定に戻す</button>\n          <button id=\"stylus-button-cancel\" type=\"button\" class=\"document-dialog-secondary\">キャンセル</button>\n          <button type=\"submit\" class=\"document-dialog-primary\">適用</button>\n        </footer>\n      </form>\n    </dialog>\n    <dialog id=\"touch-input-dialog\" class=\"document-dialog\" aria-labelledby=\"touch-input-dialog-title\">\n""",
)

# Regression coverage.
write(
    'tests/unit/stylus-button-actions.test.ts',
    """import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PRIMARY_STYLUS_BARREL_COMMAND_ID_V1,
  StylusButtonStateRouterV1,
} from '../../src/input/stylus-button-actions.js';
import {
  createStylusButtonSettingsSnapshotV1,
  parseStylusButtonSettingsV1,
  serializeStylusButtonSettingsV1,
} from '../../src/app/stylus-button-action-controller.js';
import type {
  PointerInputBatchV1,
  PointerInputEventTypeV1,
  PointerInputSampleV1,
  PointerInputSourceV1,
} from '../../src/input/pointer-input.js';

function sample(
  source: PointerInputSourceV1,
  eventType: PointerInputEventTypeV1,
  overrides: Partial<PointerInputSampleV1> = {},
): PointerInputSampleV1 {
  return Object.freeze({
    schema: 'illustro.pointer-sample/1' as const,
    sequence: 0,
    pointerId: 4,
    source,
    eventType,
    origin: 'direct' as const,
    isPrimary: true,
    timestampMs: 100,
    clientX: 10,
    clientY: 20,
    surfaceX: 10,
    surfaceY: 20,
    pressure: 0.5,
    tangentialPressure: 0,
    tiltX: 0,
    tiltY: 0,
    twist: 0,
    altitudeAngle: null,
    azimuthAngle: null,
    contactWidth: 1,
    contactHeight: 1,
    buttons: 1,
    button: -1,
    ...overrides,
  });
}

function batch(value: PointerInputSampleV1): PointerInputBatchV1 {
  return Object.freeze({
    schema: 'illustro.pointer-batch/1' as const,
    eventType: value.eventType,
    pointerId: value.pointerId,
    confirmed: Object.freeze([value]),
    predicted: Object.freeze([]),
  });
}

describe('M6A-070 stylus-button action plumbing', () => {
  it('detects primary barrel state transitions from the Pointer Events buttons bitmask', () => {
    const router = new StylusButtonStateRouterV1();
    expect(router.route(batch(sample('pen', 'pointerdown', { buttons: 1, button: 0 })))).toEqual([]);
    expect(router.route(batch(sample('pen', 'pointermove', { buttons: 3, button: 2 })))).toMatchObject([
      { pointerId: 4, slot: 'barrel-primary', phase: 'pressed' },
    ]);
    expect(router.route(batch(sample('pen', 'pointermove', { buttons: 3, button: -1 })))).toEqual([]);
    expect(router.route(batch(sample('pen', 'pointermove', { buttons: 1, button: 2 })))).toMatchObject([
      { pointerId: 4, slot: 'barrel-primary', phase: 'released' },
    ]);
  });

  it('ignores non-pen secondary-button state and predicted samples', () => {
    const router = new StylusButtonStateRouterV1();
    expect(router.route(batch(sample('mouse', 'pointerdown', { buttons: 2, button: 2 })))).toEqual([]);
    const confirmed = sample('pen', 'pointermove', { buttons: 1 });
    const predicted = sample('pen', 'pointermove', { origin: 'predicted', buttons: 3, button: 2 });
    expect(
      router.route(
        Object.freeze({
          schema: 'illustro.pointer-batch/1' as const,
          eventType: 'pointermove' as const,
          pointerId: 4,
          confirmed: Object.freeze([confirmed]),
          predicted: Object.freeze([predicted]),
        }),
      ),
    ).toEqual([]);
  });

  it('forces a release on terminal/cancel or focus-loss cleanup', () => {
    const router = new StylusButtonStateRouterV1();
    router.route(batch(sample('pen', 'pointermove', { pointerId: 9, buttons: 2, button: 2 })));
    expect(router.releaseAll()).toMatchObject([
      { pointerId: 9, slot: 'barrel-primary', phase: 'released' },
    ]);
    expect(router.snapshot().primaryBarrelHeldPointers).toBe(0);
  });

  it('defaults the first barrel to temporary eyedropper and persists an explicit unbound state', () => {
    const defaults = createStylusButtonSettingsSnapshotV1();
    expect(defaults.primaryBarrelBinding?.commandId).toBe(
      DEFAULT_PRIMARY_STYLUS_BARREL_COMMAND_ID_V1,
    );
    const unbound = createStylusButtonSettingsSnapshotV1({ primaryBarrelBinding: null });
    expect(parseStylusButtonSettingsV1(serializeStylusButtonSettingsV1(unbound))).toEqual(unbound);
  });
});
""",
)

with Path('tests/unit/color-sampling.test.ts').open('a', encoding='utf-8') as handle:
    handle.write(
        """\n\ndescribe('M6A-070 independent temporary eyedropper sources', () => {\n  it('does not clear stylus quick sampling when the keyboard source releases', () => {\n    const ownership = new ColorSamplingOwnershipV1();\n    ownership.setQuickSourceEnabled('keyboard-alt', true);\n    ownership.setQuickSourceEnabled('stylus-barrel-primary:4', true);\n    ownership.setQuickSourceEnabled('keyboard-alt', false);\n    expect(ownership.snapshot().quickEnabled).toBe(true);\n    ownership.setQuickSourceEnabled('stylus-barrel-primary:4', false);\n    expect(ownership.snapshot().quickEnabled).toBe(false);\n  });\n});\n"""
    )

with Path('ILLUSTRO_DESIGN_MEMO.md').open('a', encoding='utf-8') as handle:
    handle.write(
        """\n\n## M6A configurable stylus-button plumbing boundary — 2026-09-04\n\n**AUTHORITATIVE for M6A-070.** Illustro consumes only stylus-button state that the browser/platform exposes through standard Pointer Events. The primary barrel button follows the standard Pointer Events secondary-button mapping (`button=2`, current-state `buttons` bit `2`); detection is based on the `buttons` state transition across confirmed Pen samples so chorded Pen-contact + barrel state is supported without depending on an extra `pointerdown`/`pointerup`. Predicted samples never trigger commands. Mouse secondary-button state is not treated as a stylus binding. Browser/OS/driver buttons that are not exposed to Pointer Events remain outside application control.\n\nThe application persists a user-level primary-barrel `CommandBinding`-compatible record using a stable `commandId` plus optional flat primitive arguments. The default binding is `tool.eyedropper.temporary`; the current M6A UI may also explicitly unbind the button. Press/release transitions are emitted as generic stylus-button invocations before ordinary Pen tool routing, while the default action reuses the existing quick-Eyedropper ownership path instead of implementing a private sampler. Keyboard Alt and stylus temporary sampling use independent source ownership so releasing one cannot disable the other. Focus loss/cancel releases held temporary actions to prevent a stuck mode.\n\nM6A-070 is the input/action **plumbing** boundary, not a duplicate Command Registry. The persisted binding shape and generic invocation are intentionally ready for the canonical Command Registry/shortcut editor to provide the full eligible-command chooser in M8G; until that registry is production-connected, the reachable M6A selector exposes only actions already wired through canonical production paths (`temporary Eyedropper` and `none`). This item does not synthesize proprietary hardware APIs or claim support for buttons the browser does not report. The separately specified eraser-end (`button=5` / `buttons` bit `32` when exposed) remains canonical Eraser behavior and is not reclassified as the first barrel button.\n"""
    )

replace_once(
    'IMPLEMENTATION_PROGRESS.md',
    'M6A-070 configurable stylus-button action plumbing:未完了\n',
    'M6A-070 configurable stylus-button action plumbing:完了\n再開メモ: M6A-070は標準Pointer Eventsで公開されるPen第1バレル（buttons bit 2）をconfirmed sampleの状態遷移で検出し、generic commandId binding + press/release invocationへ接続した。既定はtool.eyedropper.temporaryで、既存ColorSamplingOwnershipのquick pathを再利用する。keyboard Altとstylusは独立source ownershipなので片方のreleaseが他方を解除しない。設定はlocalStorage永続・View→ペンボタン設定から一時スポイト/なしを選択可能。predicted/mouseはactionを発火せず、blur/cancelでheld actionを解放する。完全なCommand Registry選択肢はM8Gへ接続するがbinding形式は同じcommandId境界を使用する。次はM6A-071 final 77 sampled resources loaderから再開する。\n',
)

with Path('scripts/verify-m6a-brush.mjs').open('a', encoding='utf-8') as handle:
    handle.write(
        """\n\nrequireText(progress, 'M6A-070 configurable stylus-button action plumbing:完了', 'M6A-070 progress is not complete');\nrequireText(\n  read('src/input/stylus-button-actions.ts'),\n  'PRIMARY_STYLUS_BARREL_BUTTONS_MASK_V1 = 2',\n  'primary stylus barrel Pointer Events mapping missing',\n);\nrequireText(\n  read('src/app/stylus-button-action-controller.ts'),\n  \"DEFAULT_PRIMARY_STYLUS_BARREL_BINDING_V1\",\n  'persistent stylus binding controller missing',\n);\nrequireText(\n  read('src/app/main.ts'),\n  \"tool.eyedropper.temporary\",\n  'default stylus temporary eyedropper action is not production-wired',\n);\nrequireText(\n  read('src/app/color-sampling.ts'),\n  'setQuickSourceEnabled',\n  'independent quick-eyedropper source ownership missing',\n);\nrequireText(\n  read('src/index.html'),\n  'id=\"stylus-primary-barrel-action\"',\n  'reachable stylus binding selector missing',\n);\nrequireText(\n  read('tests/unit/stylus-button-actions.test.ts'),\n  'detects primary barrel state transitions from the Pointer Events buttons bitmask',\n  'stylus barrel transition regression coverage missing',\n);\n"""
    )
