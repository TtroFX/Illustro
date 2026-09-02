from pathlib import Path


def replace_once(path: str, before: str, after: str) -> None:
    p = Path(path)
    text = p.read_text()
    count = text.count(before)
    if count != 1:
        raise SystemExit(f"{path}: expected one anchor, found {count}: {before[:180]!r}")
    p.write_text(text.replace(before, after, 1))


def append_once(path: str, marker: str, addition: str) -> None:
    p = Path(path)
    text = p.read_text()
    if addition.strip() in text:
        return
    if marker not in text:
        raise SystemExit(f"{path}: missing append marker {marker!r}")
    p.write_text(text.replace(marker, marker + addition, 1))


Path('src/domain/color.ts').write_text(r'''import type { DocumentColorSpace } from './document.js';

export type RgbUnitColorV1 = readonly [number, number, number];

export interface HsvColorV1 {
  readonly h: number;
  readonly s: number;
  readonly v: number;
}

export const BLACK_RGB_UNIT_V1: RgbUnitColorV1 = Object.freeze([0, 0, 0]);
export const WHITE_RGB_UNIT_V1: RgbUnitColorV1 = Object.freeze([1, 1, 1]);

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function freezeRgbUnitColorV1(value: readonly number[]): RgbUnitColorV1 {
  if (
    value.length !== 3 ||
    value.some((component) => !Number.isFinite(component) || component < 0 || component > 1)
  ) {
    throw new RangeError('RGB components must be finite values in 0..1');
  }
  return Object.freeze([value[0] ?? 0, value[1] ?? 0, value[2] ?? 0]);
}

export function rgbUnitColorEqualV1(left: RgbUnitColorV1, right: RgbUnitColorV1): boolean {
  return left[0] === right[0] && left[1] === right[1] && left[2] === right[2];
}

export function rgbBytesToUnitV1(red: number, green: number, blue: number): RgbUnitColorV1 {
  for (const [label, value] of [
    ['red', red],
    ['green', green],
    ['blue', blue],
  ] as const) {
    if (!Number.isInteger(value) || value < 0 || value > 255) {
      throw new RangeError(`${label} must be an integer in 0..255`);
    }
  }
  return Object.freeze([red / 255, green / 255, blue / 255]);
}

export function rgbUnitToBytesV1(color: RgbUnitColorV1): readonly [number, number, number] {
  return Object.freeze([
    Math.round(clamp01(color[0]) * 255),
    Math.round(clamp01(color[1]) * 255),
    Math.round(clamp01(color[2]) * 255),
  ]);
}

function normalizedHue(value: number): number {
  if (!Number.isFinite(value)) throw new RangeError('HSV hue must be finite');
  const wrapped = value % 360;
  return wrapped < 0 ? wrapped + 360 : wrapped;
}

export function rgbToHsvV1(color: RgbUnitColorV1): HsvColorV1 {
  const [red, green, blue] = color;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  let hue = 0;
  if (delta > 0) {
    if (max === red) hue = 60 * (((green - blue) / delta) % 6);
    else if (max === green) hue = 60 * ((blue - red) / delta + 2);
    else hue = 60 * ((red - green) / delta + 4);
  }
  if (hue < 0) hue += 360;
  return Object.freeze({ h: hue, s: max === 0 ? 0 : delta / max, v: max });
}

export function hsvToRgbV1(input: HsvColorV1): RgbUnitColorV1 {
  if (
    !Number.isFinite(input.s) ||
    !Number.isFinite(input.v) ||
    input.s < 0 ||
    input.s > 1 ||
    input.v < 0 ||
    input.v > 1
  ) {
    throw new RangeError('HSV saturation/value must be finite values in 0..1');
  }
  const hue = normalizedHue(input.h);
  const chroma = input.v * input.s;
  const sector = hue / 60;
  const x = chroma * (1 - Math.abs((sector % 2) - 1));
  let r1 = 0;
  let g1 = 0;
  let b1 = 0;
  if (sector < 1) [r1, g1, b1] = [chroma, x, 0];
  else if (sector < 2) [r1, g1, b1] = [x, chroma, 0];
  else if (sector < 3) [r1, g1, b1] = [0, chroma, x];
  else if (sector < 4) [r1, g1, b1] = [0, x, chroma];
  else if (sector < 5) [r1, g1, b1] = [x, 0, chroma];
  else [r1, g1, b1] = [chroma, 0, x];
  const m = input.v - chroma;
  return freezeRgbUnitColorV1([r1 + m, g1 + m, b1 + m]);
}

export function parseHexRgbV1(value: string): RgbUnitColorV1 {
  const normalized = value.trim().replace(/^#/, '');
  const expanded =
    normalized.length === 3
      ? normalized
          .split('')
          .map((character) => `${character}${character}`)
          .join('')
      : normalized;
  if (!/^[0-9a-fA-F]{6}$/.test(expanded)) {
    throw new TypeError('HEX color must use #RGB or #RRGGBB');
  }
  return rgbBytesToUnitV1(
    Number.parseInt(expanded.slice(0, 2), 16),
    Number.parseInt(expanded.slice(2, 4), 16),
    Number.parseInt(expanded.slice(4, 6), 16),
  );
}

export function formatHexRgbV1(color: RgbUnitColorV1): string {
  return `#${rgbUnitToBytesV1(color)
    .map((component) => component.toString(16).padStart(2, '0'))
    .join('')}`.toUpperCase();
}

export function cssEncodedRgbV1(color: RgbUnitColorV1, workingSpace: DocumentColorSpace): string {
  return workingSpace === 'display-p3'
    ? `color(display-p3 ${color[0]} ${color[1]} ${color[2]})`
    : `rgb(${Math.round(color[0] * 255)} ${Math.round(color[1] * 255)} ${Math.round(color[2] * 255)})`;
}
''')

Path('src/app/color-workspace-state.ts').write_text(r'''import {
  BLACK_RGB_UNIT_V1,
  WHITE_RGB_UNIT_V1,
  freezeRgbUnitColorV1,
  rgbUnitColorEqualV1,
  type RgbUnitColorV1,
} from '../domain/color.js';

export const COLOR_HISTORY_LIMIT_V1 = 24;

export interface ColorWorkspaceStateV1 {
  readonly schema: 'illustro.color-workspace/1';
  readonly current: RgbUnitColorV1;
  readonly previous: RgbUnitColorV1;
  readonly history: readonly RgbUnitColorV1[];
}

function dedupeHistory(
  color: RgbUnitColorV1,
  history: readonly RgbUnitColorV1[],
): readonly RgbUnitColorV1[] {
  return Object.freeze(
    [color, ...history.filter((entry) => !rgbUnitColorEqualV1(entry, color))].slice(
      0,
      COLOR_HISTORY_LIMIT_V1,
    ),
  );
}

export function createColorWorkspaceStateV1(): ColorWorkspaceStateV1 {
  return Object.freeze({
    schema: 'illustro.color-workspace/1' as const,
    current: BLACK_RGB_UNIT_V1,
    previous: WHITE_RGB_UNIT_V1,
    history: Object.freeze([BLACK_RGB_UNIT_V1, WHITE_RGB_UNIT_V1]),
  });
}

export function previewColorWorkspaceCurrentV1(
  state: ColorWorkspaceStateV1,
  color: RgbUnitColorV1,
): ColorWorkspaceStateV1 {
  return Object.freeze({ ...state, current: freezeRgbUnitColorV1(color) });
}

export function commitColorWorkspaceCurrentV1(
  state: ColorWorkspaceStateV1,
  color: RgbUnitColorV1,
  previousOverride: RgbUnitColorV1 = state.current,
): ColorWorkspaceStateV1 {
  const current = freezeRgbUnitColorV1(color);
  const previous = freezeRgbUnitColorV1(previousOverride);
  if (rgbUnitColorEqualV1(state.current, current) && rgbUnitColorEqualV1(state.previous, previous)) {
    return state;
  }
  return Object.freeze({
    schema: 'illustro.color-workspace/1' as const,
    current,
    previous,
    history: dedupeHistory(current, state.history),
  });
}

export function swapColorWorkspaceColorsV1(state: ColorWorkspaceStateV1): ColorWorkspaceStateV1 {
  return Object.freeze({
    schema: 'illustro.color-workspace/1' as const,
    current: state.previous,
    previous: state.current,
    history: dedupeHistory(state.previous, state.history),
  });
}

export function parseColorWorkspaceStateV1(value: unknown): ColorWorkspaceStateV1 {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError('invalid color workspace state');
  }
  const record = value as Readonly<Record<string, unknown>>;
  if (record.schema !== 'illustro.color-workspace/1') throw new TypeError('invalid color workspace schema');
  if (!Array.isArray(record.current) || !Array.isArray(record.previous) || !Array.isArray(record.history)) {
    throw new TypeError('invalid color workspace payload');
  }
  const current = freezeRgbUnitColorV1(record.current as number[]);
  const previous = freezeRgbUnitColorV1(record.previous as number[]);
  const history = Object.freeze(
    (record.history as unknown[])
      .slice(0, COLOR_HISTORY_LIMIT_V1)
      .map((entry) => {
        if (!Array.isArray(entry)) throw new TypeError('invalid color history entry');
        return freezeRgbUnitColorV1(entry as number[]);
      }),
  );
  return Object.freeze({
    schema: 'illustro.color-workspace/1' as const,
    current,
    previous,
    history,
  });
}
''')

Path('src/app/color-workflow-controller.ts').write_text(r'''import {
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

function requireElement<T extends Element>(selector: string, constructor: { new (...args: never[]): T }): T {
  const element = document.querySelector(selector);
  if (!(element instanceof constructor)) throw new Error(`missing color UI: ${selector}`);
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
    clamp(((event.clientY - rect.top) / Math.max(1, rect.height)) * canvas.height, 0, canvas.height),
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

  const commit = (color: RgbUnitColorV1, previousOverride: RgbUnitColorV1 = state.current): void => {
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
    context.arc(cx + Math.cos(angle) * ((inner + outer) / 2), cy + Math.sin(angle) * ((inner + outer) / 2), 5, 0, Math.PI * 2);
    context.lineWidth = 2;
    context.strokeStyle = '#ffffff';
    context.stroke();
    context.beginPath();
    context.arc(cx + Math.cos(angle) * ((inner + outer) / 2), cy + Math.sin(angle) * ((inner + outer) / 2), 7, 0, Math.PI * 2);
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
      commit(rgbBytesToUnitV1(readNumber(redInput, 'R'), readNumber(greenInput, 'G'), readNumber(blueInput, 'B')));
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
''')

# Baseline dab gains an optional encoded working-space RGB color. Missing color remains legacy black.
replace_once(
    'src/gpu/baseline-brush.ts',
    """export const BASELINE_BRUSH_OPACITY = 1 as const;\n\nexport interface BaselineBrushSampleV1 {\n""",
    """export const BASELINE_BRUSH_OPACITY = 1 as const;\nexport type BaselineBrushColorV1 = readonly [number, number, number];\nexport const DEFAULT_BASELINE_BRUSH_COLOR_V1: BaselineBrushColorV1 = Object.freeze([0, 0, 0]);\n\nexport function freezeBaselineBrushColorV1(color: readonly number[]): BaselineBrushColorV1 {\n  if (\n    color.length !== 3 ||\n    color.some((component) => !Number.isFinite(component) || component < 0 || component > 1)\n  ) {\n    throw new RangeError('baseline brush RGB components must be finite values in 0..1');\n  }\n  return Object.freeze([color[0] ?? 0, color[1] ?? 0, color[2] ?? 0]);\n}\n\nexport interface BaselineBrushSampleV1 {\n""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """  readonly radiusY?: number;\n  readonly opacity: number;\n}\n\nexport function baselineDabRadiusXV1""",
    """  readonly radiusY?: number;\n  readonly opacity: number;\n  readonly color?: BaselineBrushColorV1;\n}\n\nexport function baselineDabColorV1(dab: BaselineBrushDabV1): BaselineBrushColorV1 {\n  return dab.color ?? DEFAULT_BASELINE_BRUSH_COLOR_V1;\n}\n\nexport function baselineDabRadiusXV1""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """function freezeDab(x: number, y: number): BaselineBrushDabV1 {\n  return Object.freeze({\n    schema: 'illustro.baseline-brush-dab/1' as const,\n    x,\n    y,\n    radius: BASELINE_BRUSH_RADIUS_PX,\n    opacity: BASELINE_BRUSH_OPACITY,\n  });\n}\n\nexport class BaselineBrushDabBuilderV1 {\n  readonly #dabs: BaselineBrushDabV1[] = [];\n""",
    """function freezeDab(x: number, y: number, color: BaselineBrushColorV1): BaselineBrushDabV1 {\n  return Object.freeze({\n    schema: 'illustro.baseline-brush-dab/1' as const,\n    x,\n    y,\n    radius: BASELINE_BRUSH_RADIUS_PX,\n    opacity: BASELINE_BRUSH_OPACITY,\n    color,\n  });\n}\n\nexport class BaselineBrushDabBuilderV1 {\n  readonly #dabs: BaselineBrushDabV1[] = [];\n  readonly #color: BaselineBrushColorV1;\n""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """  #distanceUntilNext = BASELINE_BRUSH_SPACING_PX;\n  #finished = false;\n\n  begin(sample: BaselineBrushSampleV1): readonly BaselineBrushDabV1[] {\n""",
    """  #distanceUntilNext = BASELINE_BRUSH_SPACING_PX;\n  #finished = false;\n\n  constructor(options: { readonly color?: BaselineBrushColorV1 } = {}) {\n    this.#color =\n      options.color === undefined\n        ? DEFAULT_BASELINE_BRUSH_COLOR_V1\n        : freezeBaselineBrushColorV1(options.color);\n  }\n\n  begin(sample: BaselineBrushSampleV1): readonly BaselineBrushDabV1[] {\n""",
)
text = Path('src/gpu/baseline-brush.ts').read_text()
text = text.replace('this.#dabs.push(freezeDab(sample.documentX, sample.documentY));', 'this.#dabs.push(freezeDab(sample.documentX, sample.documentY, this.#color));')
text = text.replace('this.#dabs.push(freezeDab(lastPoint.x, lastPoint.y));', 'this.#dabs.push(freezeDab(lastPoint.x, lastPoint.y, this.#color));')
text = text.replace('this.#dabs.push(freezeDab(cursorX, cursorY));', 'this.#dabs.push(freezeDab(cursorX, cursorY, this.#color));')
# Validate optional color when planning.
text = text.replace(
    """      !Number.isFinite(dab.opacity) ||\n      dab.opacity < 0 ||\n      dab.opacity > 1\n""",
    """      !Number.isFinite(dab.opacity) ||\n      dab.opacity < 0 ||\n      dab.opacity > 1 ||\n      (dab.color !== undefined &&\n        (dab.color.length !== 3 ||\n          dab.color.some((component) => !Number.isFinite(component) || component < 0 || component > 1)))\n""",
    1,
)
Path('src/gpu/baseline-brush.ts').write_text(text)

# Canonical CPU rasterizer uses dab color and straight-alpha source-over.
replace_once(
    'src/gpu/baseline-raster-tile-store.ts',
    """  baselineDabRadiusXV1,\n  baselineDabRadiusYV1,\n""",
    """  baselineDabColorV1,\n  baselineDabRadiusXV1,\n  baselineDabRadiusYV1,\n""",
)
replace_once(
    'src/gpu/baseline-raster-tile-store.ts',
    'function rasterizeBlackDab(\n',
    'function rasterizeColorDab(\n',
)
replace_once(
    'src/gpu/baseline-raster-tile-store.ts',
    """  const opacity = clamp01(dab.opacity);\n\n  if (tile.pixelFormat === 'rgba8-unorm') {\n""",
    """  const opacity = clamp01(dab.opacity);\n  const sourceColor = baselineDabColorV1(dab);\n\n  if (tile.pixelFormat === 'rgba8-unorm') {\n""",
)
replace_once(
    'src/gpu/baseline-raster-tile-store.ts',
    """        const destinationScale =\n          outputAlpha > 0 ? (destinationAlpha * inverseSourceAlpha) / outputAlpha : 0;\n        bytes[pixelOffset] = Math.round((bytes[pixelOffset] ?? 0) * destinationScale);\n        bytes[pixelOffset + 1] = Math.round((bytes[pixelOffset + 1] ?? 0) * destinationScale);\n        bytes[pixelOffset + 2] = Math.round((bytes[pixelOffset + 2] ?? 0) * destinationScale);\n        bytes[pixelOffset + 3] = Math.round(outputAlpha * 255);\n""",
    """        const destinationRed = (bytes[pixelOffset] ?? 0) / 255;\n        const destinationGreen = (bytes[pixelOffset + 1] ?? 0) / 255;\n        const destinationBlue = (bytes[pixelOffset + 2] ?? 0) / 255;\n        const destinationWeight = destinationAlpha * inverseSourceAlpha;\n        const sourceWeight = sourceAlpha;\n        bytes[pixelOffset] = Math.round(\n          (outputAlpha > 0\n            ? (sourceColor[0] * sourceWeight + destinationRed * destinationWeight) / outputAlpha\n            : 0) * 255,\n        );\n        bytes[pixelOffset + 1] = Math.round(\n          (outputAlpha > 0\n            ? (sourceColor[1] * sourceWeight + destinationGreen * destinationWeight) / outputAlpha\n            : 0) * 255,\n        );\n        bytes[pixelOffset + 2] = Math.round(\n          (outputAlpha > 0\n            ? (sourceColor[2] * sourceWeight + destinationBlue * destinationWeight) / outputAlpha\n            : 0) * 255,\n        );\n        bytes[pixelOffset + 3] = Math.round(outputAlpha * 255);\n""",
)
replace_once(
    'src/gpu/baseline-raster-tile-store.ts',
    """      const scale = outputAlpha > 0 ? (destinationAlpha * (1 - sourceAlpha)) / outputAlpha : 0;\n      writePixel(tile, pixel, [\n        destination[0] * scale,\n        destination[1] * scale,\n        destination[2] * scale,\n        outputAlpha,\n      ]);\n""",
    """      const destinationWeight = destinationAlpha * (1 - sourceAlpha);\n      writePixel(tile, pixel, [\n        outputAlpha > 0\n          ? (sourceColor[0] * sourceAlpha + destination[0] * destinationWeight) / outputAlpha\n          : 0,\n        outputAlpha > 0\n          ? (sourceColor[1] * sourceAlpha + destination[1] * destinationWeight) / outputAlpha\n          : 0,\n        outputAlpha > 0\n          ? (sourceColor[2] * sourceAlpha + destination[2] * destinationWeight) / outputAlpha\n          : 0,\n        outputAlpha,\n      ]);\n""",
)
text = Path('src/gpu/baseline-raster-tile-store.ts').read_text().replace('rasterizeBlackDab(tile, bounds.x, bounds.y, dab)', 'rasterizeColorDab(tile, bounds.x, bounds.y, dab)')
Path('src/gpu/baseline-raster-tile-store.ts').write_text(text)

# WebGPU provisional path carries color per dab. The retained scene is premultiplied, including tile patches.
replace_once(
    'src/gpu/baseline-paint-renderer.ts',
    """  baselineDabRadiusXV1,\n  baselineDabRadiusYV1,\n""",
    """  baselineDabColorV1,\n  baselineDabRadiusXV1,\n  baselineDabRadiusYV1,\n""",
)
replace_once('src/gpu/baseline-paint-renderer.ts', 'const INSTANCE_FLOATS = 5;', 'const INSTANCE_FLOATS = 8;')
replace_once(
    'src/gpu/baseline-paint-renderer.ts',
    """            { readonly shaderLocation: 2; readonly offset: 16; readonly format: 'float32' },\n          ];\n""",
    """            { readonly shaderLocation: 2; readonly offset: 16; readonly format: 'float32' },\n            { readonly shaderLocation: 3; readonly offset: 20; readonly format: 'float32x3' },\n          ];\n""",
)
replace_once(
    'src/gpu/baseline-paint-renderer.ts',
    """        opacity: dab.opacity,\n      }),\n""",
    """        opacity: dab.opacity,\n        ...(dab.color === undefined ? {} : { color: Object.freeze([...dab.color]) as readonly [number, number, number] }),\n      }),\n""",
)
replace_once(
    'src/gpu/baseline-paint-renderer.ts',
    """    left.opacity === right.opacity\n  );\n""",
    """    left.opacity === right.opacity &&\n    baselineDabColorV1(left).every((component, index) => component === baselineDabColorV1(right)[index])\n  );\n""",
)
replace_once(
    'src/gpu/baseline-paint-renderer.ts',
    """    values[offset + 4] = dab.opacity;\n  }\n""",
    """    values[offset + 4] = dab.opacity;\n    const color = baselineDabColorV1(dab);\n    values[offset + 5] = color[0];\n    values[offset + 6] = color[1];\n    values[offset + 7] = color[2];\n  }\n""",
)
replace_once(
    'src/gpu/baseline-paint-renderer.ts',
    """      const targetOffset = (targetY * targetWidth + targetX) * 4;\n      result[targetOffset] = bgra ? blue : red;\n      result[targetOffset + 1] = green;\n      result[targetOffset + 2] = bgra ? red : blue;\n      result[targetOffset + 3] = alpha;\n""",
    """      const targetOffset = (targetY * targetWidth + targetX) * 4;\n      const alphaUnit = alpha / 255;\n      const premultipliedRed = Math.round(red * alphaUnit);\n      const premultipliedGreen = Math.round(green * alphaUnit);\n      const premultipliedBlue = Math.round(blue * alphaUnit);\n      result[targetOffset] = bgra ? premultipliedBlue : premultipliedRed;\n      result[targetOffset + 1] = premultipliedGreen;\n      result[targetOffset + 2] = bgra ? premultipliedRed : premultipliedBlue;\n      result[targetOffset + 3] = alpha;\n""",
)
replace_once(
    'src/gpu/baseline-paint-renderer.ts',
    """              { shaderLocation: 2, offset: 16, format: 'float32' },\n            ],\n""",
    """              { shaderLocation: 2, offset: 16, format: 'float32' },\n              { shaderLocation: 3, offset: 20, format: 'float32x3' },\n            ],\n""",
)

Path('src/gpu/shaders/baseline-brush.wgsl').write_text(r'''struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) local_position: vec2f,
  @location(1) opacity: f32,
  @location(2) color: vec3f,
}

@vertex
fn baseline_brush_vertex(
  @builtin(vertex_index) vertex_index: u32,
  @location(0) center_clip: vec2f,
  @location(1) radius_clip: vec2f,
  @location(2) opacity: f32,
  @location(3) color: vec3f,
) -> VertexOutput {
  let corners = array<vec2f, 6>(
    vec2f(-1.0, -1.0),
    vec2f(1.0, -1.0),
    vec2f(-1.0, 1.0),
    vec2f(-1.0, 1.0),
    vec2f(1.0, -1.0),
    vec2f(1.0, 1.0),
  );
  let local_position = corners[vertex_index];
  var output: VertexOutput;
  output.position = vec4f(center_clip + local_position * radius_clip, 0.0, 1.0);
  output.local_position = local_position;
  output.opacity = opacity;
  output.color = color;
  return output;
}

@fragment
fn baseline_brush_fragment(input: VertexOutput) -> @location(0) vec4f {
  let radial_distance = length(input.local_position);
  if (radial_distance >= 1.0) {
    discard;
  }
  let coverage = 1.0 - smoothstep(0.85, 1.0, radial_distance);
  let alpha = clamp(input.opacity * coverage, 0.0, 1.0);
  return vec4f(input.color * alpha, alpha);
}
''')

# Canvas2D compatibility preview uses the same dab color.
replace_once(
    'src/app/compatibility-raster-presenter.ts',
    """  baselineDabRadiusXV1,\n  baselineDabRadiusYV1,\n""",
    """  baselineDabColorV1,\n  baselineDabRadiusXV1,\n  baselineDabRadiusYV1,\n""",
)
replace_once(
    'src/app/compatibility-raster-presenter.ts',
    """      const gradient = context.createRadialGradient(0, 0, 0, 0, 0, 1);\n      gradient.addColorStop(0, 'rgb(0 0 0 / 1)');\n      gradient.addColorStop(0.85, 'rgb(0 0 0 / 1)');\n      gradient.addColorStop(0.93, 'rgb(0 0 0 / 0.5)');\n      gradient.addColorStop(1, 'rgb(0 0 0 / 0)');\n""",
    """      const gradient = context.createRadialGradient(0, 0, 0, 0, 0, 1);\n      const color = baselineDabColorV1(dab);\n      const red = Math.round(color[0] * 255);\n      const green = Math.round(color[1] * 255);\n      const blue = Math.round(color[2] * 255);\n      gradient.addColorStop(0, `rgb(${red} ${green} ${blue} / 1)`);\n      gradient.addColorStop(0.85, `rgb(${red} ${green} ${blue} / 1)`);\n      gradient.addColorStop(0.93, `rgb(${red} ${green} ${blue} / 0.5)`);\n      gradient.addColorStop(1, `rgb(${red} ${green} ${blue} / 0)`);\n""",
)

# Paint session stores a workspace current color and captures it at stroke start.
replace_once(
    'src/app/paint-session-controller.ts',
    """import { BaselineBrushDabBuilderV1, type BaselineBrushDabV1 } from '../gpu/baseline-brush.js';\n""",
    """import {\n  BaselineBrushDabBuilderV1,\n  DEFAULT_BASELINE_BRUSH_COLOR_V1,\n  freezeBaselineBrushColorV1,\n  type BaselineBrushColorV1,\n  type BaselineBrushDabV1,\n} from '../gpu/baseline-brush.js';\n""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """  const opacity = finiteNumber(value.opacity, 'baseline dab opacity');\n  if (radius <= 0 || radiusX <= 0 || radiusY <= 0 || opacity < 0 || opacity > 1) {\n""",
    """  const opacity = finiteNumber(value.opacity, 'baseline dab opacity');\n  const color =\n    value.color === undefined\n      ? undefined\n      : Array.isArray(value.color)\n        ? freezeBaselineBrushColorV1(value.color.map((component) => finiteNumber(component, 'baseline dab color')))\n        : null;\n  if (color === null) throw new TypeError('invalid baseline dab color');\n  if (radius <= 0 || radiusX <= 0 || radiusY <= 0 || opacity < 0 || opacity > 1) {\n""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """    radiusY,\n    opacity,\n  });\n}\n""",
    """    radiusY,\n    opacity,\n    ...(color === undefined ? {} : { color }),\n  });\n}\n""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """  #rasterMaskTileLoader: RasterMaskTileLoaderV1 | null = null;\n  #disposed = false;\n""",
    """  #rasterMaskTileLoader: RasterMaskTileLoaderV1 | null = null;\n  #paintColor: BaselineBrushColorV1 = DEFAULT_BASELINE_BRUSH_COLOR_V1;\n  #disposed = false;\n""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """  setRasterMaskTileLoader(loader: RasterMaskTileLoaderV1 | null): void {\n    this.#rasterMaskTileLoader = loader;\n    this.#rasterMaskTileCache.clear();\n  }\n\n  activeLayerId(): LayerId | null {\n""",
    """  setRasterMaskTileLoader(loader: RasterMaskTileLoaderV1 | null): void {\n    this.#rasterMaskTileLoader = loader;\n    this.#rasterMaskTileCache.clear();\n  }\n\n  setPaintColor(color: BaselineBrushColorV1): void {\n    this.#paintColor = freezeBaselineBrushColorV1(color);\n  }\n\n  paintColor(): BaselineBrushColorV1 {\n    return this.#paintColor;\n  }\n\n  activeLayerId(): LayerId | null {\n""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """    const builder = new BaselineBrushDabBuilderV1();\n""",
    """    const builder = new BaselineBrushDabBuilderV1({ color: this.#paintColor });\n""",
)

# Worker parser preserves optional radii and color instead of stripping them during clone validation.
replace_once(
    'src/workers/render.worker.ts',
    """import type { BaselineBrushDabV1 } from '../gpu/baseline-brush.js';\n""",
    """import { freezeBaselineBrushColorV1, type BaselineBrushDabV1 } from '../gpu/baseline-brush.js';\n""",
)
replace_once(
    'src/workers/render.worker.ts',
    """    dabs.push(\n      Object.freeze({\n        schema: 'illustro.baseline-brush-dab/1' as const,\n        x: candidate.x,\n        y: candidate.y,\n        radius: candidate.radius,\n        opacity: candidate.opacity,\n      }),\n    );\n""",
    """    const radiusX = candidate.radiusX;\n    const radiusY = candidate.radiusY;\n    if (\n      (radiusX !== undefined && (typeof radiusX !== 'number' || !Number.isFinite(radiusX) || radiusX <= 0)) ||\n      (radiusY !== undefined && (typeof radiusY !== 'number' || !Number.isFinite(radiusY) || radiusY <= 0))\n    ) {\n      return null;\n    }\n    let color: readonly [number, number, number] | undefined;\n    if (candidate.color !== undefined) {\n      if (!Array.isArray(candidate.color)) return null;\n      try {\n        color = freezeBaselineBrushColorV1(candidate.color as number[]);\n      } catch {\n        return null;\n      }\n    }\n    dabs.push(\n      Object.freeze({\n        schema: 'illustro.baseline-brush-dab/1' as const,\n        x: candidate.x,\n        y: candidate.y,\n        radius: candidate.radius,\n        ...(radiusX === undefined ? {} : { radiusX }),\n        ...(radiusY === undefined ? {} : { radiusY }),\n        opacity: candidate.opacity,\n        ...(color === undefined ? {} : { color }),\n      }),\n    );\n""",
)

# Replace placeholder inspector card with production color controls.
replace_once(
    'src/index.html',
    """          <div class=\"shell-inspector-card\" aria-hidden=\"true\">\n            <span class=\"shell-line shell-line-wide\"></span>\n            <span class=\"shell-line\"></span>\n            <span class=\"shell-line shell-line-short\"></span>\n          </div>\n""",
    """          <section class=\"shell-inspector-card shell-color-panel\" aria-label=\"カラー\">\n            <header class=\"shell-color-header\"><strong>カラー</strong><output id=\"color-status\" aria-live=\"polite\"></output></header>\n            <div class=\"shell-color-picker\">\n              <canvas id=\"color-wheel\" width=\"168\" height=\"168\" aria-label=\"色相環\"></canvas>\n              <canvas id=\"color-sv\" width=\"168\" height=\"120\" aria-label=\"彩度と明度\"></canvas>\n            </div>\n            <div class=\"shell-color-swatches\">\n              <button id=\"color-current\" type=\"button\" aria-label=\"現在の色\"></button>\n              <button id=\"color-previous\" type=\"button\" aria-label=\"前の色へ交換\"></button>\n            </div>\n            <div class=\"shell-color-entry-grid shell-color-entry-rgb\" aria-label=\"RGB入力\">\n              <label>R<input id=\"color-r\" type=\"number\" min=\"0\" max=\"255\" step=\"1\" value=\"0\" /></label>\n              <label>G<input id=\"color-g\" type=\"number\" min=\"0\" max=\"255\" step=\"1\" value=\"0\" /></label>\n              <label>B<input id=\"color-b\" type=\"number\" min=\"0\" max=\"255\" step=\"1\" value=\"0\" /></label>\n            </div>\n            <div class=\"shell-color-entry-grid shell-color-entry-hsv\" aria-label=\"HSV入力\">\n              <label>H<input id=\"color-h\" type=\"number\" min=\"0\" max=\"359\" step=\"1\" value=\"0\" /></label>\n              <label>S<input id=\"color-s\" type=\"number\" min=\"0\" max=\"100\" step=\"1\" value=\"0\" /></label>\n              <label>V<input id=\"color-v\" type=\"number\" min=\"0\" max=\"100\" step=\"1\" value=\"0\" /></label>\n            </div>\n            <label class=\"shell-color-hex\">HEX<input id=\"color-hex\" type=\"text\" inputmode=\"text\" maxlength=\"7\" value=\"#000000\" /></label>\n            <div id=\"color-history\" class=\"shell-color-history\" aria-label=\"色履歴\"></div>\n          </section>\n""",
)

# Install/dispose color workflow and refresh it when document working space changes.
replace_once(
    'src/app/main.ts',
    """import { collectRuntimeCapabilities } from './capabilities.js';\n""",
    """import { collectRuntimeCapabilities } from './capabilities.js';\nimport { installColorWorkflowControllerV1 } from './color-workflow-controller.js';\n""",
)
replace_once(
    'src/app/main.ts',
    """const paintHistory = new PaintHistoryControllerV1(paintSession);\nconst selectionCoverage = new SelectionCoverageControllerV1();\n""",
    """const paintHistory = new PaintHistoryControllerV1(paintSession);\nconst colorWorkflow = installColorWorkflowControllerV1({ root, paintSession });\nconst selectionCoverage = new SelectionCoverageControllerV1();\n""",
)
replace_once(
    'src/app/main.ts',
    """  refreshLayerUi();\n  syncPngExportAvailability();\n}\n""",
    """  refreshLayerUi();\n  colorWorkflow.refresh();\n  syncPngExportAvailability();\n}\n""",
)
replace_once(
    'src/app/main.ts',
    """    layerComps.dispose();\n    layerWorkflow.dispose();\n""",
    """    layerComps.dispose();\n    layerWorkflow.dispose();\n    colorWorkflow.dispose();\n""",
)

# Color panel styles, preserving the existing visual language.
append_once(
    'public/app-shell.css',
    ".shell-line-short {\n  width: 42%;\n}\n",
    r'''

.shell-color-panel {
  gap: 10px;
  padding: 12px;
}

.shell-color-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.shell-color-header strong {
  font-size: 12px;
  color: #27314a;
}

.shell-color-header output {
  max-width: 190px;
  overflow: hidden;
  color: #b42318;
  font-size: 9px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.shell-color-picker {
  display: grid;
  grid-template-columns: minmax(112px, 1fr) minmax(112px, 1fr);
  gap: 9px;
  align-items: center;
}

.shell-color-picker canvas {
  display: block;
  width: 100%;
  height: auto;
  border-radius: 10px;
  touch-action: none;
  cursor: crosshair;
}

#color-sv {
  aspect-ratio: 7 / 5;
  border: 1px solid #e1e6ef;
}

.shell-color-swatches {
  display: grid;
  grid-template-columns: 1.7fr 1fr;
  gap: 8px;
}

.shell-color-swatches button {
  min-height: 34px;
  border: 1px solid #d9e0eb;
  border-radius: 9px;
  box-shadow: inset 0 0 0 2px #fff;
  cursor: pointer;
}

.shell-color-entry-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
}

.shell-color-entry-grid label,
.shell-color-hex {
  display: grid;
  grid-template-columns: 16px minmax(0, 1fr);
  align-items: center;
  gap: 3px;
  color: #718096;
  font-size: 9px;
  font-weight: 700;
}

.shell-color-entry-grid input,
.shell-color-hex input {
  min-width: 0;
  height: 28px;
  border: 1px solid #dfe5ef;
  border-radius: 7px;
  padding: 0 5px;
  background: #fbfcff;
  color: #26324b;
  font: inherit;
  font-size: 10px;
}

.shell-color-hex {
  grid-template-columns: 28px minmax(0, 1fr);
}

.shell-color-history {
  display: flex;
  gap: 5px;
  min-height: 26px;
  overflow-x: auto;
  padding-bottom: 2px;
  scrollbar-width: thin;
}

.shell-color-history-swatch {
  flex: 0 0 24px;
  width: 24px;
  height: 24px;
  border: 1px solid #d9e0eb;
  border-radius: 7px;
  padding: 0;
  box-shadow: inset 0 0 0 1px #fff;
  cursor: pointer;
}
''',
)
append_once(
    'public/mobile-shell.css',
    """  .shell-inspector-tabs,\n  .shell-inspector-card {\n    display: none;\n  }\n""",
    r'''

  .shell-inspector-card.shell-color-panel {
    display: grid;
    max-height: 36dvh;
    overflow: auto;
  }

  .shell-color-picker {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .shell-color-entry-grid input,
  .shell-color-hex input,
  .shell-color-swatches button {
    min-height: 44px;
  }
''',
)

# Tests for conversion/state and actual canonical color painting/backward compatibility.
Path('tests/unit/color-workflow.test.ts').write_text(r'''import { describe, expect, it } from 'vitest';
import {
  formatHexRgbV1,
  hsvToRgbV1,
  parseHexRgbV1,
  rgbBytesToUnitV1,
  rgbToHsvV1,
  rgbUnitToBytesV1,
} from '../../src/domain/color.js';
import {
  COLOR_HISTORY_LIMIT_V1,
  commitColorWorkspaceCurrentV1,
  createColorWorkspaceStateV1,
  parseColorWorkspaceStateV1,
  swapColorWorkspaceColorsV1,
} from '../../src/app/color-workspace-state.js';

describe('M5D color model foundation', () => {
  it('round-trips RGB and HSV without changing encoded component intent', () => {
    expect(rgbUnitToBytesV1(hsvToRgbV1({ h: 0, s: 1, v: 1 }))).toEqual([255, 0, 0]);
    expect(rgbUnitToBytesV1(hsvToRgbV1({ h: 120, s: 1, v: 1 }))).toEqual([0, 255, 0]);
    expect(rgbUnitToBytesV1(hsvToRgbV1({ h: 240, s: 1, v: 1 }))).toEqual([0, 0, 255]);
    const source = rgbBytesToUnitV1(31, 137, 219);
    const roundTrip = hsvToRgbV1(rgbToHsvV1(source));
    expect(rgbUnitToBytesV1(roundTrip)).toEqual([31, 137, 219]);
  });

  it('parses short/full HEX and formats the canonical full form', () => {
    expect(rgbUnitToBytesV1(parseHexRgbV1('#0af'))).toEqual([0, 170, 255]);
    expect(formatHexRgbV1(parseHexRgbV1('12abEF'))).toBe('#12ABEF');
    expect(() => parseHexRgbV1('#abcd')).toThrow(/HEX/);
  });

  it('tracks current, previous and bounded de-duplicated history', () => {
    let state = createColorWorkspaceStateV1();
    state = commitColorWorkspaceCurrentV1(state, rgbBytesToUnitV1(255, 0, 0));
    expect(rgbUnitToBytesV1(state.current)).toEqual([255, 0, 0]);
    expect(rgbUnitToBytesV1(state.previous)).toEqual([0, 0, 0]);
    state = swapColorWorkspaceColorsV1(state);
    expect(rgbUnitToBytesV1(state.current)).toEqual([0, 0, 0]);
    for (let value = 0; value < COLOR_HISTORY_LIMIT_V1 + 8; value += 1) {
      state = commitColorWorkspaceCurrentV1(state, rgbBytesToUnitV1(value, 40, 80));
    }
    expect(state.history).toHaveLength(COLOR_HISTORY_LIMIT_V1);
    const restored = parseColorWorkspaceStateV1(JSON.parse(JSON.stringify(state)));
    expect(restored).toEqual(state);
  });
});
''')

Path('tests/unit/baseline-color-paint.test.ts').write_text(r'''import { describe, expect, it } from 'vitest';
import { BaselineBrushDabBuilderV1, type BaselineBrushDabV1 } from '../../src/gpu/baseline-brush.js';
import { BaselineRasterTileStoreV1 } from '../../src/gpu/baseline-raster-tile-store.js';

describe('M5D baseline paint color integration', () => {
  it('captures the chosen encoded RGB color in every new dab', () => {
    const builder = new BaselineBrushDabBuilderV1({ color: [1, 0.25, 0] });
    builder.begin({ documentX: 8, documentY: 8 });
    expect(builder.dabs()[0]?.color).toEqual([1, 0.25, 0]);
  });

  it('writes colored straight-alpha pixels into canonical raster tiles', () => {
    const store = new BaselineRasterTileStoreV1(32, 32, 'rgba8-unorm', [
      { layerId: 'paint', visible: true, opacity: 1 },
    ]);
    const dab: BaselineBrushDabV1 = Object.freeze({
      schema: 'illustro.baseline-brush-dab/1',
      x: 16,
      y: 16,
      radius: 8,
      opacity: 1,
      color: Object.freeze([1, 0, 0]),
    });
    store.applyDabs('paint', 'red', [dab]);
    store.finalize('red');
    const tile = store.exportTiles()[0];
    const offset = (16 * 32 + 16) * 4;
    expect(tile?.bytes[offset]).toBe(255);
    expect(tile?.bytes[offset + 1]).toBe(0);
    expect(tile?.bytes[offset + 2]).toBe(0);
    expect(tile?.bytes[offset + 3]).toBe(255);
  });

  it('keeps legacy colorless dabs black for recovery compatibility', () => {
    const store = new BaselineRasterTileStoreV1(32, 32, 'rgba8-unorm', [
      { layerId: 'paint', visible: true, opacity: 1 },
    ]);
    const legacy: BaselineBrushDabV1 = Object.freeze({
      schema: 'illustro.baseline-brush-dab/1',
      x: 16,
      y: 16,
      radius: 8,
      opacity: 1,
    });
    store.applyDabs('paint', 'legacy', [legacy]);
    store.finalize('legacy');
    const tile = store.exportTiles()[0];
    const offset = (16 * 32 + 16) * 4;
    expect([...((tile?.bytes.slice(offset, offset + 4)) ?? [])]).toEqual([0, 0, 0, 255]);
  });
});
''')

# Verify script and package/CI wiring.
Path('scripts/verify-m5d-color.mjs').write_text(r'''import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const requireText = (path, markers) => {
  const text = read(path);
  for (const marker of markers) {
    if (!text.includes(marker)) throw new Error(`${path} is missing ${marker}`);
  }
};

requireText('src/domain/color.ts', ['rgbToHsvV1', 'hsvToRgbV1', 'parseHexRgbV1', 'formatHexRgbV1']);
requireText('src/app/color-workspace-state.ts', [
  'illustro.color-workspace/1',
  'COLOR_HISTORY_LIMIT_V1',
  'current',
  'previous',
  'history',
]);
requireText('src/app/color-workflow-controller.ts', [
  '#color-wheel',
  '#color-sv',
  '#color-r',
  '#color-g',
  '#color-b',
  '#color-h',
  '#color-s',
  '#color-v',
  '#color-hex',
  '#color-current',
  '#color-previous',
  '#color-history',
  'setPaintColor',
]);
requireText('src/gpu/baseline-brush.ts', ['readonly color?: BaselineBrushColorV1', 'baselineDabColorV1']);
requireText('src/gpu/baseline-raster-tile-store.ts', ['rasterizeColorDab', 'baselineDabColorV1']);
requireText('src/gpu/shaders/baseline-brush.wgsl', ['@location(3) color: vec3f', 'input.color * alpha']);
requireText('src/gpu/baseline-paint-renderer.ts', ['const INSTANCE_FLOATS = 8;', "format: 'float32x3'"]);
requireText('src/app/compatibility-raster-presenter.ts', ['baselineDabColorV1', 'gradient.addColorStop']);
requireText('src/app/paint-session-controller.ts', ['setPaintColor', 'new BaselineBrushDabBuilderV1({ color: this.#paintColor })']);
requireText('src/workers/render.worker.ts', ['freezeBaselineBrushColorV1', 'candidate.color']);
requireText('src/index.html', [
  'id="color-wheel"',
  'id="color-sv"',
  'id="color-r"',
  'id="color-g"',
  'id="color-b"',
  'id="color-h"',
  'id="color-s"',
  'id="color-v"',
  'id="color-hex"',
  'id="color-current"',
  'id="color-previous"',
  'id="color-history"',
]);
requireText('IMPLEMENTATION_PROGRESS.md', [
  'M5D-001 Color Wheel:完了',
  'M5D-002 RGB entry:完了',
  'M5D-003 HSV/HSB entry:完了',
  'M5D-004 HEX entry:完了',
  'M5D-005 current color:完了',
  'M5D-006 previous color:完了',
  'M5D-007 color history:完了',
  'M5D-008 palette create:未完了',
]);
console.log('M5D color foundation verification passed');
''')

replace_once(
    'package.json',
    '"verify:m5c": "node scripts/verify-m5c-compositor.mjs"',
    '"verify:m5c": "node scripts/verify-m5c-compositor.mjs",\n    "verify:m5d": "node scripts/verify-m5d-color.mjs"',
)
replace_once(
    '.github/workflows/ci.yml',
    """      - name: M5C blend compositor inspection\n        run: npm run verify:m5c\n""",
    """      - name: M5C blend compositor inspection\n        run: npm run verify:m5c\n      - name: M5D color foundation inspection\n        run: npm run verify:m5d\n""",
)

# Progress only after the production paths and tests exist in the resulting tree.
for item in [
    'M5D-001 Color Wheel',
    'M5D-002 RGB entry',
    'M5D-003 HSV/HSB entry',
    'M5D-004 HEX entry',
    'M5D-005 current color',
    'M5D-006 previous color',
    'M5D-007 color history',
]:
    replace_once('IMPLEMENTATION_PROGRESS.md', f'{item}:未完了', f'{item}:完了')

# Record the implementation boundary: these controls operate on encoded components of the active working space;
# profile conversion/ICC preview stays in M5D-021..025.
append_once(
    'ILLUSTRO_DESIGN_MEMO.md',
    """### 6. Color system — ADOPTED\n""",
    r'''

#### M5D color-control semantic boundary — 2026-09-02

- Color Wheel, RGB, HSV/HSB and HEX controls share one canonical workspace color state with current/previous/history semantics; normal changes update all representations immediately rather than maintaining independent per-widget colors.
- For M5D-001 through M5D-007, numeric RGB/HSV/HEX values are interpreted as **encoded component values in the active document working space**. This keeps UI state compatible with both sRGB and Display-P3 documents without falsely claiming profile conversion has already been completed.
- The current color is production-connected to baseline raster painting and is captured at stroke start. Canonical CPU tile rasterization, WebGPU provisional presentation and Canvas2D compatibility presentation use the same per-dab encoded RGB value. Legacy recovered dabs without a color field retain black semantics.
- Color workspace state (current/previous/history) is user/workspace state and may persist locally without changing the native document schema. Document color-profile conversion, ICC-aware preview boundaries and profile metadata remain the responsibility of M5D-021 through M5D-025.
''',
)
