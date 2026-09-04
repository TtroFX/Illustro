import {
  TOUCH_POSITION_OFFSET_LIMIT_CSS_PX_V1,
  type PointerInputArbitrationV1,
} from '../input/input-arbitration.js';

export const TOUCH_INPUT_POLICY_SCHEMA_V1 = 'illustro.touch-input-policy/1' as const;
export const TOUCH_INPUT_POLICY_STORAGE_KEY_V1 = 'illustro.touch-input-policy/1' as const;

export interface TouchInputPolicySnapshotV1 {
  readonly schema: typeof TOUCH_INPUT_POLICY_SCHEMA_V1;
  readonly fingerDrawingEnabled: boolean;
  readonly offsetXCssPx: number;
  readonly offsetYCssPx: number;
}

function normalizeOffset(value: number, label: string): number {
  if (!Number.isFinite(value) || Math.abs(value) > TOUCH_POSITION_OFFSET_LIMIT_CSS_PX_V1) {
    throw new RangeError(
      `${label} must be within -${TOUCH_POSITION_OFFSET_LIMIT_CSS_PX_V1}..${TOUCH_POSITION_OFFSET_LIMIT_CSS_PX_V1}`,
    );
  }
  return Object.is(value, -0) ? 0 : value;
}

export function createTouchInputPolicySnapshotV1(
  input: {
    readonly fingerDrawingEnabled?: boolean;
    readonly offsetXCssPx?: number;
    readonly offsetYCssPx?: number;
  } = {},
): TouchInputPolicySnapshotV1 {
  const fingerDrawingEnabled = input.fingerDrawingEnabled ?? true;
  if (typeof fingerDrawingEnabled !== 'boolean') {
    throw new TypeError('finger drawing policy must be boolean');
  }
  return Object.freeze({
    schema: TOUCH_INPUT_POLICY_SCHEMA_V1,
    fingerDrawingEnabled,
    offsetXCssPx: normalizeOffset(input.offsetXCssPx ?? 0, 'touch offset X'),
    offsetYCssPx: normalizeOffset(input.offsetYCssPx ?? 0, 'touch offset Y'),
  });
}

export function serializeTouchInputPolicyV1(snapshot: TouchInputPolicySnapshotV1): string {
  return JSON.stringify(snapshot);
}

export function parseTouchInputPolicyV1(raw: string): TouchInputPolicySnapshotV1 {
  const value: unknown = JSON.parse(raw);
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError('touch input policy must be an object');
  }
  const record = value as Record<string, unknown>;
  if (record.schema !== TOUCH_INPUT_POLICY_SCHEMA_V1) {
    throw new TypeError('unsupported touch input policy schema');
  }
  return createTouchInputPolicySnapshotV1({
    fingerDrawingEnabled: record.fingerDrawingEnabled as boolean,
    offsetXCssPx: record.offsetXCssPx as number,
    offsetYCssPx: record.offsetYCssPx as number,
  });
}

export interface TouchInputPolicyControllerV1 {
  readonly schema: 'illustro.touch-input-policy-controller/1';
  snapshot(): TouchInputPolicySnapshotV1;
  dispose(): void;
}

function required<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector(selector);
  if (element === null) throw new Error(`touch input policy is missing ${selector}`);
  return element as T;
}

function closeMenu(element: Element): void {
  element.closest('details')?.removeAttribute('open');
}

export function installTouchInputPolicyControllerV1(input: {
  readonly root: HTMLElement;
  readonly arbitration: PointerInputArbitrationV1;
  readonly storage?: Storage | null;
}): TouchInputPolicyControllerV1 {
  const storage = input.storage ?? globalThis.localStorage;
  const openButton = required<HTMLButtonElement>(input.root, '#view-touch-input-settings');
  const dialog = required<HTMLDialogElement>(input.root, '#touch-input-dialog');
  const form = required<HTMLFormElement>(input.root, '#touch-input-form');
  const fingerButton = required<HTMLButtonElement>(input.root, '#touch-finger-drawing');
  const offsetXRange = required<HTMLInputElement>(input.root, '#touch-offset-x-range');
  const offsetXNumber = required<HTMLInputElement>(input.root, '#touch-offset-x-number');
  const offsetYRange = required<HTMLInputElement>(input.root, '#touch-offset-y-range');
  const offsetYNumber = required<HTMLInputElement>(input.root, '#touch-offset-y-number');
  const resetButton = required<HTMLButtonElement>(input.root, '#touch-input-reset');
  const cancelButton = required<HTMLButtonElement>(input.root, '#touch-input-cancel');
  const status = required<HTMLOutputElement>(input.root, '#touch-input-status');
  let state = createTouchInputPolicySnapshotV1();
  let draftFingerDrawingEnabled = state.fingerDrawingEnabled;
  let disposed = false;

  const stored = storage?.getItem(TOUCH_INPUT_POLICY_STORAGE_KEY_V1);
  if (stored !== null && stored !== undefined) {
    try {
      state = parseTouchInputPolicyV1(stored);
    } catch {
      state = createTouchInputPolicySnapshotV1();
    }
  }

  const publish = (): void => {
    input.arbitration.setFingerDrawingEnabled(state.fingerDrawingEnabled);
    input.arbitration.setTouchPositionOffset(state.offsetXCssPx, state.offsetYCssPx);
    input.root.dataset.illustroPointerFingerDrawing = state.fingerDrawingEnabled
      ? 'enabled'
      : 'disabled';
    input.root.dataset.illustroTouchOffsetXCssPx = String(state.offsetXCssPx);
    input.root.dataset.illustroTouchOffsetYCssPx = String(state.offsetYCssPx);
  };

  const setFingerDraft = (enabled: boolean): void => {
    draftFingerDrawingEnabled = enabled;
    fingerButton.textContent = enabled ? 'ON' : 'OFF';
    fingerButton.setAttribute('aria-pressed', String(enabled));
  };

  const setOffsetPair = (
    range: HTMLInputElement,
    number: HTMLInputElement,
    value: number,
  ): void => {
    range.value = String(value);
    number.value = String(value);
  };

  const populate = (): void => {
    setFingerDraft(state.fingerDrawingEnabled);
    setOffsetPair(offsetXRange, offsetXNumber, state.offsetXCssPx);
    setOffsetPair(offsetYRange, offsetYNumber, state.offsetYCssPx);
    status.value = '';
  };

  const onOpen = (): void => {
    closeMenu(openButton);
    populate();
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  };
  const onFingerToggle = (): void => setFingerDraft(!draftFingerDrawingEnabled);
  const onXRange = (): void => {
    offsetXNumber.value = offsetXRange.value;
  };
  const onXNumber = (): void => {
    offsetXRange.value = offsetXNumber.value;
  };
  const onYRange = (): void => {
    offsetYNumber.value = offsetYRange.value;
  };
  const onYNumber = (): void => {
    offsetYRange.value = offsetYNumber.value;
  };
  const onReset = (): void => {
    setFingerDraft(true);
    setOffsetPair(offsetXRange, offsetXNumber, 0);
    setOffsetPair(offsetYRange, offsetYNumber, 0);
    status.value = '';
  };
  const onCancel = (): void => dialog.close();
  const onSubmit = (event: SubmitEvent): void => {
    event.preventDefault();
    try {
      state = createTouchInputPolicySnapshotV1({
        fingerDrawingEnabled: draftFingerDrawingEnabled,
        offsetXCssPx: Number(offsetXNumber.value),
        offsetYCssPx: Number(offsetYNumber.value),
      });
      storage?.setItem(TOUCH_INPUT_POLICY_STORAGE_KEY_V1, serializeTouchInputPolicyV1(state));
      publish();
      status.value = '';
      dialog.close();
    } catch (error) {
      status.value = error instanceof Error ? error.message : String(error);
      input.root.dataset.illustroTouchInputError = status.value;
    }
  };

  openButton.addEventListener('click', onOpen);
  fingerButton.addEventListener('click', onFingerToggle);
  offsetXRange.addEventListener('input', onXRange);
  offsetXNumber.addEventListener('input', onXNumber);
  offsetYRange.addEventListener('input', onYRange);
  offsetYNumber.addEventListener('input', onYNumber);
  resetButton.addEventListener('click', onReset);
  cancelButton.addEventListener('click', onCancel);
  form.addEventListener('submit', onSubmit);
  publish();

  return Object.freeze({
    schema: 'illustro.touch-input-policy-controller/1' as const,
    snapshot: () => state,
    dispose(): void {
      if (disposed) return;
      disposed = true;
      openButton.removeEventListener('click', onOpen);
      fingerButton.removeEventListener('click', onFingerToggle);
      offsetXRange.removeEventListener('input', onXRange);
      offsetXNumber.removeEventListener('input', onXNumber);
      offsetYRange.removeEventListener('input', onYRange);
      offsetYNumber.removeEventListener('input', onYNumber);
      resetButton.removeEventListener('click', onReset);
      cancelButton.removeEventListener('click', onCancel);
      form.removeEventListener('submit', onSubmit);
      input.root.dataset.illustroTouchInputPolicy = 'disposed';
    },
  });
}
