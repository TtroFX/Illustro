import type { ViewportControllerV1, ViewportSnapshotV1 } from './viewport-controller.js';

export const GRID_MIN_SPACING_PX_V1 = 1;
export const GRID_MAX_SPACING_PX_V1 = 32_768;
export const DEFAULT_GRID_SPACING_PX_V1 = 64;
export const DEFAULT_GRID_COLOR_V1 = '#64748b' as const;

export interface GridSettingsSnapshotV1 {
  readonly schema: 'illustro.grid-settings/1';
  readonly enabled: boolean;
  readonly spacing: number;
  readonly offsetX: number;
  readonly offsetY: number;
  readonly color: string;
}

function safeInteger(value: number, label: string): number {
  if (!Number.isSafeInteger(value)) throw new RangeError(`${label} must be a safe integer`);
  return value;
}

function normalizeColor(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!/^#[0-9a-f]{6}$/.test(normalized)) throw new TypeError('grid color must be #RRGGBB');
  return normalized;
}

export class GridSettingsV1 {
  #enabled = false;
  #spacing = DEFAULT_GRID_SPACING_PX_V1;
  #offsetX = 0;
  #offsetY = 0;
  #color: string = DEFAULT_GRID_COLOR_V1;

  snapshot(): GridSettingsSnapshotV1 {
    return Object.freeze({
      schema: 'illustro.grid-settings/1' as const,
      enabled: this.#enabled,
      spacing: this.#spacing,
      offsetX: this.#offsetX,
      offsetY: this.#offsetY,
      color: this.#color,
    });
  }

  setEnabled(enabled: boolean): GridSettingsSnapshotV1 {
    this.#enabled = enabled;
    return this.snapshot();
  }

  toggle(): GridSettingsSnapshotV1 {
    this.#enabled = !this.#enabled;
    return this.snapshot();
  }

  configure(input: {
    readonly spacing: number;
    readonly offsetX: number;
    readonly offsetY: number;
    readonly color: string;
  }): GridSettingsSnapshotV1 {
    const spacing = safeInteger(input.spacing, 'grid spacing');
    if (spacing < GRID_MIN_SPACING_PX_V1 || spacing > GRID_MAX_SPACING_PX_V1) {
      throw new RangeError(
        `grid spacing must be in ${GRID_MIN_SPACING_PX_V1}..${GRID_MAX_SPACING_PX_V1}`,
      );
    }
    this.#spacing = spacing;
    this.#offsetX = safeInteger(input.offsetX, 'grid offsetX');
    this.#offsetY = safeInteger(input.offsetY, 'grid offsetY');
    this.#color = normalizeColor(input.color);
    return this.snapshot();
  }
}

export interface GridControllerV1 {
  readonly schema: 'illustro.grid-controller/1';
  snapshot(): GridSettingsSnapshotV1;
  dispose(): void;
}

function required<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (element === null) throw new Error(`grid controller is missing ${selector}`);
  return element;
}

function closeMenu(element: Element): void {
  element.closest('details')?.removeAttribute('open');
}

function integerInput(input: HTMLInputElement, label: string): number {
  const value = Number(input.value);
  if (!Number.isSafeInteger(value)) throw new RangeError(`${label} must be an integer`);
  return value;
}

function positiveModulo(value: number, modulus: number): number {
  return ((value % modulus) + modulus) % modulus;
}

export function installGridControllerV1(input: {
  readonly viewport: ViewportControllerV1;
  readonly root?: HTMLElement;
}): GridControllerV1 {
  const root = input.root ?? document.documentElement;
  const viewport = input.viewport;
  const overlay = required<HTMLElement>('#canvas-grid-overlay');
  const toggleButton = required<HTMLButtonElement>('#view-grid-toggle');
  const settingsButton = required<HTMLButtonElement>('#view-grid-settings');
  const dialog = required<HTMLDialogElement>('#grid-dialog');
  const form = required<HTMLFormElement>('#grid-form');
  const spacingInput = required<HTMLInputElement>('#grid-spacing');
  const offsetXInput = required<HTMLInputElement>('#grid-offset-x');
  const offsetYInput = required<HTMLInputElement>('#grid-offset-y');
  const colorInput = required<HTMLInputElement>('#grid-color');
  const status = required<HTMLOutputElement>('#grid-status');
  const cancelButton = required<HTMLButtonElement>('#grid-cancel');
  const state = new GridSettingsV1();

  const publish = (
    viewportState: ViewportSnapshotV1 = viewport.snapshot(),
  ): GridSettingsSnapshotV1 => {
    const grid = state.snapshot();
    overlay.hidden = !grid.enabled;
    toggleButton.dataset.active = grid.enabled ? 'true' : 'false';
    root.dataset.illustroGrid = grid.enabled ? 'enabled' : 'disabled';
    root.dataset.illustroGridSpacing = String(grid.spacing);
    root.dataset.illustroGridOffsetX = String(grid.offsetX);
    root.dataset.illustroGridOffsetY = String(grid.offsetY);
    root.dataset.illustroGridColor = grid.color;
    if (!grid.enabled) return grid;

    const scaleX = viewportState.baseWidth / viewportState.documentWidth;
    const scaleY = viewportState.baseHeight / viewportState.documentHeight;
    const spacingX = Math.max(0.0001, grid.spacing * scaleX);
    const spacingY = Math.max(0.0001, grid.spacing * scaleY);
    const offsetX = positiveModulo(grid.offsetX, grid.spacing) * scaleX;
    const offsetY = positiveModulo(grid.offsetY, grid.spacing) * scaleY;
    const lineX = Math.min(spacingX * 0.25, 1 / viewportState.zoom);
    const lineY = Math.min(spacingY * 0.25, 1 / viewportState.zoom);
    overlay.style.backgroundImage =
      `linear-gradient(to right, ${grid.color} ${lineX}px, transparent ${lineX}px), ` +
      `linear-gradient(to bottom, ${grid.color} ${lineY}px, transparent ${lineY}px)`;
    overlay.style.backgroundSize = `${spacingX}px ${spacingY}px`;
    overlay.style.backgroundPosition = `${offsetX}px ${offsetY}px`;
    return grid;
  };

  const unsubscribe = viewport.subscribe((snapshot) => {
    publish(snapshot);
  });

  const onToggle = (): void => {
    closeMenu(toggleButton);
    state.toggle();
    publish();
  };

  const onSettings = (): void => {
    closeMenu(settingsButton);
    const current = state.snapshot();
    spacingInput.value = String(current.spacing);
    offsetXInput.value = String(current.offsetX);
    offsetYInput.value = String(current.offsetY);
    colorInput.value = current.color;
    status.value = '';
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  };

  const onSubmit = (event: SubmitEvent): void => {
    event.preventDefault();
    try {
      state.configure({
        spacing: integerInput(spacingInput, 'grid spacing'),
        offsetX: integerInput(offsetXInput, 'grid offsetX'),
        offsetY: integerInput(offsetYInput, 'grid offsetY'),
        color: colorInput.value,
      });
      state.setEnabled(true);
      publish();
      status.value = '';
      dialog.close();
    } catch (error) {
      status.value = error instanceof Error ? error.message : String(error);
      root.dataset.illustroGridError = status.value;
    }
  };

  const onCancel = (): void => dialog.close();
  toggleButton.addEventListener('click', onToggle);
  settingsButton.addEventListener('click', onSettings);
  form.addEventListener('submit', onSubmit);
  cancelButton.addEventListener('click', onCancel);
  publish();

  return Object.freeze({
    schema: 'illustro.grid-controller/1' as const,
    snapshot: () => state.snapshot(),
    dispose(): void {
      unsubscribe();
      toggleButton.removeEventListener('click', onToggle);
      settingsButton.removeEventListener('click', onSettings);
      form.removeEventListener('submit', onSubmit);
      cancelButton.removeEventListener('click', onCancel);
      overlay.hidden = true;
      root.dataset.illustroGrid = 'disposed';
    },
  });
}
