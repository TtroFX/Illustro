import {
  cssEncodedRgbV1,
  formatHexRgbV1,
  hsvToRgbV1,
  parseHexRgbV1,
  rgbBytesToUnitV1,
  rgbToHsvV1,
  rgbUnitToBytesV1,
  type HsvColorV1,
  type RgbUnitColorV1,
} from '../domain/color.js';
import type { PaintSessionControllerV1 } from './paint-session-controller.js';
import {
  commitColorWorkspaceCurrentV1,
  createColorWorkspaceStateV1,
  parseColorWorkspaceStateV1,
  previewColorWorkspaceCurrentV1,
  swapColorWorkspaceColorsV1,
  type ColorWorkspaceStateV1,
} from './color-workspace-state.js';

const STORAGE_KEY = 'illustro.color-workspace/1';

function requireElement<T extends Element>(
  selector: string,
  elementType: { new (...args: never[]): T },
): T {
  const element = document.querySelector(selector);
  if (!(element instanceof elementType)) throw new Error(`missing color UI: ${selector}`);
  return element;
}

function readNumber(input: HTMLInputElement, label: string): number {
  const value = Number(input.value);
  if (!Number.isFinite(value)) throw new TypeError(`${label} must be finite`);
  return value;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function canvasPoint(event: PointerEvent, canvas: HTMLCanvasElement): readonly [number, number] {
  const rect = canvas.getBoundingClientRect();
  return Object.freeze([
    clamp(((event.clientX - rect.left) / Math.max(1, rect.width)) * canvas.width, 0, canvas.width),
    clamp(
      ((event.clientY - rect.top) / Math.max(1, rect.height)) * canvas.height,
      0,
      canvas.height,
    ),
  ]);
}

function loadState(storage: Storage | null): ColorWorkspaceStateV1 {
  const raw = storage?.getItem(STORAGE_KEY);
  if (raw === null || raw === undefined) return createColorWorkspaceStateV1();
  try {
    return parseColorWorkspaceStateV1(JSON.parse(raw));
  } catch {
    return createColorWorkspaceStateV1();
  }
}

export interface ColorWorkflowControllerV1 {
  refresh(): void;
  dispose(): void;
  snapshot(): ColorWorkspaceStateV1;
}

export function installColorWorkflowControllerV1(input: {
  readonly root: HTMLElement;
  readonly paintSession: PaintSessionControllerV1;
  readonly storage?: Storage | null;
}): ColorWorkflowControllerV1 {
  const storage = input.storage === undefined ? globalThis.localStorage : input.storage;
  const wheel = requireElement('#color-wheel', HTMLCanvasElement);
  const sv = requireElement('#color-sv', HTMLCanvasElement);
  const currentSwatch = requireElement('#color-current', HTMLButtonElement);
  const previousSwatch = requireElement('#color-previous', HTMLButtonElement);
  const history = requireElement('#color-history', HTMLDivElement);
  const redInput = requireElement('#color-r', HTMLInputElement);
  const greenInput = requireElement('#color-g', HTMLInputElement);
  const blueInput = requireElement('#color-b', HTMLInputElement);
  const hueInput = requireElement('#color-h', HTMLInputElement);
  const saturationInput = requireElement('#color-s', HTMLInputElement);
  const valueInput = requireElement('#color-v', HTMLInputElement);
  const hexInput = requireElement('#color-hex', HTMLInputElement);
  const status = requireElement('#color-status', HTMLOutputElement);
  let state = loadState(storage);
  let interactionStart: RgbUnitColorV1 | null = null;
  let disposed = false;

  const workingSpace = () => input.paintSession.currentDocument()?.color.workingSpace ?? 'srgb';
  const persist = (): void => {
    try {
      storage?.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Workspace color persistence is best-effort; painting remains available.
    }
  };

  const publish = (redrawSv = true): void => {
    const rgbBytes = rgbUnitToBytesV1(state.current);
    const hsv = rgbToHsvV1(state.current);
    redInput.value = String(rgbBytes[0]);
    greenInput.value = String(rgbBytes[1]);
    blueInput.value = String(rgbBytes[2]);
    hueInput.value = String(Math.round(hsv.h));
    saturationInput.value = String(Math.round(hsv.s * 100));
    valueInput.value = String(Math.round(hsv.v * 100));
    hexInput.value = formatHexRgbV1(state.current);
    currentSwatch.style.background = cssEncodedRgbV1(state.current, workingSpace());
    previousSwatch.style.background = cssEncodedRgbV1(state.previous, workingSpace());
    currentSwatch.title = `Current ${hexInput.value}`;
    previousSwatch.title = `Previous ${formatHexRgbV1(state.previous)}`;
    history.replaceChildren(
      ...state.history.map((color, index) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'shell-color-history-swatch';
        button.style.background = cssEncodedRgbV1(color, workingSpace());
        button.title = `履歴 ${index + 1}: ${formatHexRgbV1(color)}`;
        button.setAttribute('aria-label', button.title);
        button.addEventListener('click', () => commit(color));
        return button;
      }),
    );
    drawWheel();
    if (redrawSv) drawSv(hsv.h);
    input.paintSession.setPaintColor(state.current);
    input.root.dataset.illustroCurrentColor = formatHexRgbV1(state.current);
    input.root.dataset.illustroPreviousColor = formatHexRgbV1(state.previous);
    input.root.dataset.illustroColorHistory = String(state.history.length);
    input.root.dataset.illustroColorWorkingSpace = workingSpace();
  };

  const commit = (
    color: RgbUnitColorV1,
    previousOverride: RgbUnitColorV1 = state.current,
  ): void => {
    state = commitColorWorkspaceCurrentV1(state, color, previousOverride);
    interactionStart = null;
    persist();
    status.value = '';
    publish();
  };

  const preview = (color: RgbUnitColorV1, redrawSv = true): void => {
    state = previewColorWorkspaceCurrentV1(state, color);
    status.value = '';
    publish(redrawSv);
  };

  function drawWheel(): void {
    const context = wheel.getContext('2d');
    if (context === null) return;
    const image = context.createImageData(wheel.width, wheel.height);
    const cx = wheel.width / 2;
    const cy = wheel.height / 2;
    const outer = Math.min(cx, cy) - 1;
    const inner = outer * 0.67;
    for (let y = 0; y < wheel.height; y += 1) {
      for (let x = 0; x < wheel.width; x += 1) {
        const dx = x + 0.5 - cx;
        const dy = y + 0.5 - cy;
        const radius = Math.hypot(dx, dy);
        const offset = (y * wheel.width + x) * 4;
        if (radius < inner || radius > outer) continue;
        const hue = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
        const rgb = rgbUnitToBytesV1(hsvToRgbV1({ h: hue, s: 1, v: 1 }));
        image.data[offset] = rgb[0];
        image.data[offset + 1] = rgb[1];
        image.data[offset + 2] = rgb[2];
        image.data[offset + 3] = 255;
      }
    }
    context.clearRect(0, 0, wheel.width, wheel.height);
    context.putImageData(image, 0, 0);
    const hsv = rgbToHsvV1(state.current);
    const angle = (hsv.h * Math.PI) / 180;
    context.beginPath();
    context.arc(
      cx + Math.cos(angle) * ((inner + outer) / 2),
      cy + Math.sin(angle) * ((inner + outer) / 2),
      5,
      0,
      Math.PI * 2,
    );
    context.lineWidth = 2;
    context.strokeStyle = '#ffffff';
    context.stroke();
    context.beginPath();
    context.arc(
      cx + Math.cos(angle) * ((inner + outer) / 2),
      cy + Math.sin(angle) * ((inner + outer) / 2),
      7,
      0,
      Math.PI * 2,
    );
    context.lineWidth = 1;
    context.strokeStyle = '#172033';
    context.stroke();
  }

  function drawSv(hue: number): void {
    const context = sv.getContext('2d');
    if (context === null) return;
    const hueCss = cssEncodedRgbV1(hsvToRgbV1({ h: hue, s: 1, v: 1 }), workingSpace());
    context.clearRect(0, 0, sv.width, sv.height);
    context.fillStyle = hueCss;
    context.fillRect(0, 0, sv.width, sv.height);
    const white = context.createLinearGradient(0, 0, sv.width, 0);
    white.addColorStop(0, 'rgb(255 255 255 / 1)');
    white.addColorStop(1, 'rgb(255 255 255 / 0)');
    context.fillStyle = white;
    context.fillRect(0, 0, sv.width, sv.height);
    const black = context.createLinearGradient(0, 0, 0, sv.height);
    black.addColorStop(0, 'rgb(0 0 0 / 0)');
    black.addColorStop(1, 'rgb(0 0 0 / 1)');
    context.fillStyle = black;
    context.fillRect(0, 0, sv.width, sv.height);
    const hsv = rgbToHsvV1(state.current);
    context.beginPath();
    context.arc(hsv.s * sv.width, (1 - hsv.v) * sv.height, 6, 0, Math.PI * 2);
    context.lineWidth = 2;
    context.strokeStyle = '#ffffff';
    context.stroke();
    context.beginPath();
    context.arc(hsv.s * sv.width, (1 - hsv.v) * sv.height, 8, 0, Math.PI * 2);
    context.lineWidth = 1;
    context.strokeStyle = '#172033';
    context.stroke();
  }

  const beginInteraction = (): void => {
    interactionStart ??= state.current;
  };
  const finishInteraction = (): void => {
    const start = interactionStart;
    if (start === null) return;
    commit(state.current, start);
  };

  const updateWheel = (event: PointerEvent): void => {
    const [x, y] = canvasPoint(event, wheel);
    const dx = x - wheel.width / 2;
    const dy = y - wheel.height / 2;
    if (Math.hypot(dx, dy) < Math.min(wheel.width, wheel.height) * 0.25) return;
    const hsv = rgbToHsvV1(state.current);
    const hue = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
    preview(hsvToRgbV1({ h: hue, s: hsv.s, v: hsv.v }));
  };
  const updateSv = (event: PointerEvent): void => {
    const [x, y] = canvasPoint(event, sv);
    const hsv = rgbToHsvV1(state.current);
    preview(
      hsvToRgbV1({
        h: hsv.h,
        s: clamp(x / Math.max(1, sv.width), 0, 1),
        v: 1 - clamp(y / Math.max(1, sv.height), 0, 1),
      }),
      false,
    );
    drawSv(hsv.h);
  };

  const installCanvasGesture = (
    canvas: HTMLCanvasElement,
    update: (event: PointerEvent) => void,
  ): (() => void) => {
    const down = (event: PointerEvent): void => {
      beginInteraction();
      canvas.setPointerCapture(event.pointerId);
      update(event);
      event.preventDefault();
    };
    const move = (event: PointerEvent): void => {
      if (!canvas.hasPointerCapture(event.pointerId)) return;
      update(event);
      event.preventDefault();
    };
    const up = (event: PointerEvent): void => {
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      finishInteraction();
      event.preventDefault();
    };
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    return () => {
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointercancel', up);
    };
  };

  const removeWheel = installCanvasGesture(wheel, updateWheel);
  const removeSv = installCanvasGesture(sv, updateSv);

  const commitRgb = (): void => {
    try {
      commit(
        rgbBytesToUnitV1(
          readNumber(redInput, 'R'),
          readNumber(greenInput, 'G'),
          readNumber(blueInput, 'B'),
        ),
      );
    } catch (error) {
      status.value = error instanceof Error ? error.message : String(error);
      publish(false);
    }
  };
  const commitHsv = (): void => {
    try {
      const hsv: HsvColorV1 = Object.freeze({
        h: readNumber(hueInput, 'H'),
        s: readNumber(saturationInput, 'S') / 100,
        v: readNumber(valueInput, 'V') / 100,
      });
      commit(hsvToRgbV1(hsv));
    } catch (error) {
      status.value = error instanceof Error ? error.message : String(error);
      publish(false);
    }
  };
  const commitHex = (): void => {
    try {
      commit(parseHexRgbV1(hexInput.value));
    } catch (error) {
      status.value = error instanceof Error ? error.message : String(error);
      publish(false);
    }
  };

  const rgbInputs = [redInput, greenInput, blueInput];
  const hsvInputs = [hueInput, saturationInput, valueInput];
  for (const field of rgbInputs) field.addEventListener('change', commitRgb);
  for (const field of hsvInputs) field.addEventListener('change', commitHsv);
  hexInput.addEventListener('change', commitHex);
  const onPrevious = (): void => {
    state = swapColorWorkspaceColorsV1(state);
    persist();
    publish();
  };
  previousSwatch.addEventListener('click', onPrevious);

  publish();
  input.root.dataset.illustroColorWorkflow = 'ready';

  return {
    refresh(): void {
      if (!disposed) publish();
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      removeWheel();
      removeSv();
      for (const field of rgbInputs) field.removeEventListener('change', commitRgb);
      for (const field of hsvInputs) field.removeEventListener('change', commitHsv);
      hexInput.removeEventListener('change', commitHex);
      previousSwatch.removeEventListener('click', onPrevious);
      input.root.dataset.illustroColorWorkflow = 'disposed';
    },
    snapshot(): ColorWorkspaceStateV1 {
      return state;
    },
  };
}
