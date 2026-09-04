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
import type { DocumentV1 } from '../domain/document.js';
import type { PointerInputBatchV1, PointerInputSampleV1 } from '../input/pointer-input.js';
import { convertEncodedRgbV1 } from '../domain/color-management.js';
import type { PaintSessionControllerV1 } from './paint-session-controller.js';
import {
  approximateColorGridV1,
  intermediateColorGridV1,
  type ApproximateColorAxisV1,
} from './color-helper-grid.js';
import {
  ColorMixingSurfaceV1,
  type ColorMixingPointV1,
  type ColorMixingSurfaceSnapshotV1,
  type ColorMixingToolV1,
} from './color-mixing-surface.js';
import {
  ColorSamplingOwnershipV1,
  createRasterTileSamplingIndexV1,
  sampleActiveLayerColorV1,
  sampleMergedCanvasColorV1,
  type ColorSamplingSourceV1,
  type RasterTileSamplingIndexV1,
} from './color-sampling.js';
import {
  activeColorPaletteV1,
  addColorToPaletteV1,
  commitColorWorkspaceCurrentV1,
  convertColorPaletteBundleWorkingSpaceV1,
  createColorPaletteInWorkspaceV1,
  createColorWorkspaceStateV1,
  deleteColorPaletteV1,
  importColorPaletteBundleV1,
  moveColorPaletteV1,
  moveColorWithinPaletteV1,
  parseColorPaletteBundleV1,
  parseColorWorkspaceStateV1,
  previewColorWorkspaceCurrentV1,
  removeColorFromPaletteV1,
  renameColorPaletteV1,
  serializeColorPaletteBundleV1,
  setActiveColorPaletteV1,
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
  ingestPointerBatch(batch: PointerInputBatchV1): boolean;
  applyExternalSample(color: RgbUnitColorV1, sourceLabel: string): void;
}

export function installColorWorkflowControllerV1(input: {
  readonly root: HTMLElement;
  readonly paintSession: PaintSessionControllerV1;
  readonly mapPointerToDocument: (
    sample: PointerInputSampleV1,
    documentValue: DocumentV1,
  ) => { readonly x: number; readonly y: number };
  readonly storage?: Storage | null;
}): ColorWorkflowControllerV1 {
  const storage = input.storage === undefined ? globalThis.localStorage : input.storage;
  const wheel = requireElement('#color-wheel', HTMLCanvasElement);
  const sv = requireElement('#color-sv', HTMLCanvasElement);
  const currentSwatch = requireElement('#color-current', HTMLButtonElement);
  const previousSwatch = requireElement('#color-previous', HTMLButtonElement);
  const eyedropper = requireElement('#color-eyedropper', HTMLButtonElement);
  const samplingSourceSelect = requireElement('#color-sampling-source', HTMLSelectElement);
  const history = requireElement('#color-history', HTMLDivElement);
  const paletteSelect = requireElement('#color-palette-select', HTMLSelectElement);
  const paletteName = requireElement('#color-palette-name', HTMLInputElement);
  const paletteCreate = requireElement('#color-palette-create', HTMLButtonElement);
  const paletteDelete = requireElement('#color-palette-delete', HTMLButtonElement);
  const paletteMoveUp = requireElement('#color-palette-up', HTMLButtonElement);
  const paletteMoveDown = requireElement('#color-palette-down', HTMLButtonElement);
  const paletteSwatches = requireElement('#color-palette-swatches', HTMLDivElement);
  const paletteAddCurrent = requireElement('#color-palette-add-current', HTMLButtonElement);
  const paletteColorLeft = requireElement('#color-palette-color-left', HTMLButtonElement);
  const paletteColorRight = requireElement('#color-palette-color-right', HTMLButtonElement);
  const paletteColorDelete = requireElement('#color-palette-color-delete', HTMLButtonElement);
  const paletteImport = requireElement('#color-palette-import', HTMLButtonElement);
  const paletteExport = requireElement('#color-palette-export', HTMLButtonElement);
  const paletteFile = requireElement('#color-palette-file', HTMLInputElement);
  const mixingCanvas = requireElement('#color-mixing-canvas', HTMLCanvasElement);
  const mixingColors = requireElement('#color-mixing-colors', HTMLDivElement);
  const mixingBrush = requireElement('#color-mixing-brush', HTMLButtonElement);
  const mixingBlend = requireElement('#color-mixing-blend', HTMLButtonElement);
  const mixingEyedropper = requireElement('#color-mixing-eyedropper', HTMLButtonElement);
  const mixingSize = requireElement('#color-mixing-size', HTMLInputElement);
  const mixingSizeValue = requireElement('#color-mixing-size-value', HTMLOutputElement);
  const mixingUndo = requireElement('#color-mixing-undo', HTMLButtonElement);
  const mixingRedo = requireElement('#color-mixing-redo', HTMLButtonElement);
  const mixingClear = requireElement('#color-mixing-clear', HTMLButtonElement);
  const colorHelper = requireElement('#color-helper', HTMLDetailsElement);
  const helperIntermediateTab = requireElement('#color-helper-intermediate-tab', HTMLButtonElement);
  const helperApproximateTab = requireElement('#color-helper-approximate-tab', HTMLButtonElement);
  const helperIntermediatePanel = requireElement(
    '#color-helper-intermediate-panel',
    HTMLDivElement,
  );
  const helperApproximatePanel = requireElement('#color-helper-approximate-panel', HTMLDivElement);
  const intermediateGridCanvas = requireElement('#color-intermediate-grid', HTMLCanvasElement);
  const approximateGridCanvas = requireElement('#color-approximate-grid', HTMLCanvasElement);
  const intermediateCornerButtons = [
    requireElement('#color-intermediate-tl', HTMLButtonElement),
    requireElement('#color-intermediate-tr', HTMLButtonElement),
    requireElement('#color-intermediate-bl', HTMLButtonElement),
    requireElement('#color-intermediate-br', HTMLButtonElement),
  ] as const;
  const approximateXAxis = requireElement('#color-approximate-x-axis', HTMLSelectElement);
  const approximateYAxis = requireElement('#color-approximate-y-axis', HTMLSelectElement);
  const approximateXAmount = requireElement('#color-approximate-x-amount', HTMLInputElement);
  const approximateYAmount = requireElement('#color-approximate-y-amount', HTMLInputElement);
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
  let selectedPaletteColorIndex: number | null = null;
  let disposed = false;
  const samplingOwnership = new ColorSamplingOwnershipV1();
  let samplingStartColor: RgbUnitColorV1 | null = null;
  let samplingDocument: DocumentV1 | null = null;
  let samplingSource: ColorSamplingSourceV1 = 'merged-canvas';
  let samplingIndexPromise: Promise<RasterTileSamplingIndexV1> | null = null;
  let samplingRequestSequence = 0;
  let mixingTool: ColorMixingToolV1 = 'brush';
  let mixingLastPoint: ColorMixingPointV1 | null = null;
  let mixingGestureStart: ColorMixingSurfaceSnapshotV1 | null = null;
  let mixingUndoStack: ColorMixingSurfaceSnapshotV1[] = [];
  let mixingRedoStack: ColorMixingSurfaceSnapshotV1[] = [];
  type ColorHelperModeV1 = 'intermediate' | 'approximate';
  let colorHelperMode: ColorHelperModeV1 = 'intermediate';
  let colorHelperWorkingSpace = input.paintSession.currentDocument()?.color.workingSpace ?? 'srgb';
  let intermediateCorners: readonly [
    RgbUnitColorV1,
    RgbUnitColorV1,
    RgbUnitColorV1,
    RgbUnitColorV1,
  ] = Object.freeze([
    state.current,
    state.previous,
    Object.freeze([0, 0, 0] as const),
    Object.freeze([1, 1, 1] as const),
  ]);
  let intermediateGridColors: readonly RgbUnitColorV1[] = [];
  let approximateGridColors: readonly RgbUnitColorV1[] = [];

  const workingSpace = () => input.paintSession.currentDocument()?.color.workingSpace ?? 'srgb';
  const mixingSurface = new ColorMixingSurfaceV1(
    mixingCanvas.width,
    mixingCanvas.height,
    workingSpace(),
  );
  const persist = (): void => {
    try {
      storage?.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Workspace color persistence is best-effort; painting remains available.
    }
  };

  const publish = (redrawSv = true): void => {
    if (mixingSurface.workingSpace() !== workingSpace()) {
      mixingSurface.convertWorkingSpace(workingSpace());
      mixingUndoStack = [];
      mixingRedoStack = [];
    }
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
    const activePalette = activeColorPaletteV1(state);
    const activePaletteIndex = state.palettes.findIndex(
      (palette) => palette.id === activePalette.id,
    );
    paletteSelect.replaceChildren(
      ...state.palettes.map((palette) => {
        const option = document.createElement('option');
        option.value = palette.id;
        option.textContent = palette.name;
        return option;
      }),
    );
    paletteSelect.value = activePalette.id;
    paletteName.value = activePalette.name;
    paletteDelete.disabled = state.palettes.length <= 1;
    paletteMoveUp.disabled = activePaletteIndex <= 0;
    paletteMoveDown.disabled =
      activePaletteIndex < 0 || activePaletteIndex >= state.palettes.length - 1;
    if (
      selectedPaletteColorIndex !== null &&
      selectedPaletteColorIndex >= activePalette.colors.length
    ) {
      selectedPaletteColorIndex =
        activePalette.colors.length > 0 ? activePalette.colors.length - 1 : null;
    }
    paletteSwatches.replaceChildren(
      ...activePalette.colors.map((color, index) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'shell-color-palette-swatch';
        if (selectedPaletteColorIndex === index) button.classList.add('is-selected');
        button.style.background = cssEncodedRgbV1(color, workingSpace());
        button.title = `${activePalette.name} ${index + 1}: ${formatHexRgbV1(color)}`;
        button.setAttribute('aria-label', button.title);
        button.addEventListener('click', () => {
          selectedPaletteColorIndex = index;
          commit(color);
        });
        return button;
      }),
    );
    const hasSelectedPaletteColor =
      selectedPaletteColorIndex !== null && activePalette.colors.length > 0;
    paletteColorDelete.disabled = !hasSelectedPaletteColor;
    paletteColorLeft.disabled = !hasSelectedPaletteColor || selectedPaletteColorIndex === 0;
    paletteColorRight.disabled =
      !hasSelectedPaletteColor ||
      selectedPaletteColorIndex === null ||
      selectedPaletteColorIndex >= activePalette.colors.length - 1;
    drawWheel();
    if (redrawSv) drawSv(hsv.h);
    input.paintSession.setPaintColor(state.current);
    input.paintSession.setPaintSubColor(state.previous);
    input.root.dataset.illustroCurrentColor = formatHexRgbV1(state.current);
    input.root.dataset.illustroPreviousColor = formatHexRgbV1(state.previous);
    input.root.dataset.illustroColorHistory = String(state.history.length);
    input.root.dataset.illustroColorPaletteCount = String(state.palettes.length);
    input.root.dataset.illustroActiveColorPalette = activePalette.id;
    input.root.dataset.illustroActiveColorPaletteSize = String(activePalette.colors.length);
    input.root.dataset.illustroColorWorkingSpace = workingSpace();
    publishSamplingState();
    publishMixingState(activePalette.colors);
    publishColorHelperState();
  };

  function renderMixingSurface(): void {
    const context = mixingCanvas.getContext('2d');
    if (context === null) return;
    const image = context.createImageData(mixingCanvas.width, mixingCanvas.height);
    image.data.set(mixingSurface.presentationRgba8('srgb'));
    context.putImageData(image, 0, 0);
  }

  function mixingQuickColors(paletteColors: readonly RgbUnitColorV1[]): readonly RgbUnitColorV1[] {
    const result: RgbUnitColorV1[] = [];
    const seen = new Set<string>();
    for (const color of [state.current, state.previous, ...paletteColors]) {
      const key = `${color[0]}:${color[1]}:${color[2]}`;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(color);
      if (result.length >= 10) break;
    }
    return Object.freeze(result);
  }

  function publishMixingState(paletteColors: readonly RgbUnitColorV1[]): void {
    mixingBrush.setAttribute('aria-pressed', String(mixingTool === 'brush'));
    mixingBlend.setAttribute('aria-pressed', String(mixingTool === 'blend'));
    mixingEyedropper.setAttribute('aria-pressed', String(mixingTool === 'eyedropper'));
    mixingUndo.disabled = mixingUndoStack.length === 0;
    mixingRedo.disabled = mixingRedoStack.length === 0;
    mixingSizeValue.value = mixingSize.value;
    mixingColors.replaceChildren(
      ...mixingQuickColors(paletteColors).map((color, index) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.style.background = cssEncodedRgbV1(color, workingSpace());
        button.title = `色混ぜクイックカラー ${index + 1}: ${formatHexRgbV1(color)}`;
        button.setAttribute('aria-label', button.title);
        button.addEventListener('click', () => commit(color));
        return button;
      }),
    );
    renderMixingSurface();
    input.root.dataset.illustroColorMixingTool = mixingTool;
    input.root.dataset.illustroColorMixingWorkingSpace = mixingSurface.workingSpace();
    input.root.dataset.illustroColorMixingUndo = String(mixingUndoStack.length);
    input.root.dataset.illustroColorMixingRedo = String(mixingRedoStack.length);
  }

  const COLOR_HELPER_GRID_COLUMNS = 9;
  const COLOR_HELPER_GRID_ROWS = 9;
  const approximateAxis = (value: string): ApproximateColorAxisV1 => {
    switch (value) {
      case 'hue':
      case 'saturation':
      case 'value':
      case 'lightness':
      case 'red':
      case 'green':
      case 'blue':
        return value;
      default:
        return 'hue';
    }
  };
  function drawHelperGrid(canvas: HTMLCanvasElement, colors: readonly RgbUnitColorV1[]): void {
    const context = canvas.getContext('2d');
    if (context === null) return;
    const cellWidth = canvas.width / COLOR_HELPER_GRID_COLUMNS;
    const cellHeight = canvas.height / COLOR_HELPER_GRID_ROWS;
    context.clearRect(0, 0, canvas.width, canvas.height);
    colors.forEach((color, index) => {
      const column = index % COLOR_HELPER_GRID_COLUMNS;
      const row = Math.floor(index / COLOR_HELPER_GRID_COLUMNS);
      context.fillStyle = cssEncodedRgbV1(color, workingSpace());
      context.fillRect(
        column * cellWidth + 0.5,
        row * cellHeight + 0.5,
        Math.max(0, cellWidth - 1),
        Math.max(0, cellHeight - 1),
      );
    });
  }
  function ensureHelperWorkingSpace(): void {
    const next = workingSpace();
    if (next === colorHelperWorkingSpace) return;
    intermediateCorners = Object.freeze(
      intermediateCorners.map((color) => convertEncodedRgbV1(color, colorHelperWorkingSpace, next)),
    ) as readonly [RgbUnitColorV1, RgbUnitColorV1, RgbUnitColorV1, RgbUnitColorV1];
    colorHelperWorkingSpace = next;
  }
  function publishColorHelperState(force = false): void {
    ensureHelperWorkingSpace();
    helperIntermediateTab.setAttribute('aria-pressed', String(colorHelperMode === 'intermediate'));
    helperApproximateTab.setAttribute('aria-pressed', String(colorHelperMode === 'approximate'));
    helperIntermediatePanel.hidden = colorHelperMode !== 'intermediate';
    helperApproximatePanel.hidden = colorHelperMode !== 'approximate';
    intermediateCornerButtons.forEach((button, index) => {
      const color = intermediateCorners[index] ?? state.current;
      button.style.background = cssEncodedRgbV1(color, workingSpace());
      button.title = `中間色コーナー ${index + 1}: ${formatHexRgbV1(color)}（タップで現在色を登録）`;
      button.setAttribute('aria-label', button.title);
    });
    input.root.dataset.illustroColorHelperMode = colorHelperMode;
    input.root.dataset.illustroColorHelperWorkingSpace = colorHelperWorkingSpace;
    input.root.dataset.illustroApproximateAxes = `${approximateXAxis.value}:${approximateYAxis.value}`;
    if (!colorHelper.open && !force) return;
    if (colorHelperMode === 'intermediate') {
      intermediateGridColors = intermediateColorGridV1(
        {
          topLeft: intermediateCorners[0],
          topRight: intermediateCorners[1],
          bottomLeft: intermediateCorners[2],
          bottomRight: intermediateCorners[3],
        },
        COLOR_HELPER_GRID_COLUMNS,
        COLOR_HELPER_GRID_ROWS,
      );
      drawHelperGrid(intermediateGridCanvas, intermediateGridColors);
      return;
    }
    approximateGridColors = approximateColorGridV1({
      base: state.current,
      xAxis: approximateAxis(approximateXAxis.value),
      yAxis: approximateAxis(approximateYAxis.value),
      xAmount: Number(approximateXAmount.value),
      yAmount: Number(approximateYAmount.value),
      columns: COLOR_HELPER_GRID_COLUMNS,
      rows: COLOR_HELPER_GRID_ROWS,
    });
    drawHelperGrid(approximateGridCanvas, approximateGridColors);
  }

  function helperGridColorAt(
    event: PointerEvent,
    canvas: HTMLCanvasElement,
    colors: readonly RgbUnitColorV1[],
  ): RgbUnitColorV1 | null {
    const [x, y] = canvasPoint(event, canvas);
    const column = Math.min(
      COLOR_HELPER_GRID_COLUMNS - 1,
      Math.floor((x / Math.max(1, canvas.width)) * COLOR_HELPER_GRID_COLUMNS),
    );
    const row = Math.min(
      COLOR_HELPER_GRID_ROWS - 1,
      Math.floor((y / Math.max(1, canvas.height)) * COLOR_HELPER_GRID_ROWS),
    );
    return colors[row * COLOR_HELPER_GRID_COLUMNS + column] ?? null;
  }

  function publishSamplingState(): void {
    const ownership = samplingOwnership.snapshot();
    const mode = ownership.explicitEnabled
      ? 'eyedropper'
      : ownership.quickEnabled
        ? 'quick-eyedropper'
        : 'inactive';
    eyedropper.classList.toggle('is-active', ownership.explicitEnabled);
    eyedropper.setAttribute('aria-pressed', String(ownership.explicitEnabled));
    input.root.dataset.illustroColorSamplingMode = mode;
    input.root.dataset.illustroColorSamplingSource = samplingSourceSelect.value;
  }

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

  const publishSamplingPreview = (color: RgbUnitColorV1): void => {
    state = previewColorWorkspaceCurrentV1(state, color);
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
    currentSwatch.title = `Current ${hexInput.value}`;
    input.paintSession.setPaintColor(state.current);
    input.root.dataset.illustroCurrentColor = hexInput.value;
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

  const selectedSamplingSource = (): ColorSamplingSourceV1 =>
    samplingSourceSelect.value === 'active-layer' ? 'active-layer' : 'merged-canvas';

  const resetSamplingSession = (): void => {
    samplingRequestSequence += 1;
    samplingStartColor = null;
    samplingDocument = null;
    samplingIndexPromise = null;
  };

  const beginSamplingSession = (): void => {
    if (samplingStartColor !== null) {
      commit(state.current, samplingStartColor);
      resetSamplingSession();
    }
    samplingStartColor = state.current;
    samplingDocument = input.paintSession.currentDocument();
    samplingSource = selectedSamplingSource();
    const activeLayerId = input.paintSession.activeLayerId();
    if (samplingDocument === null) {
      samplingIndexPromise = null;
      return;
    }
    samplingIndexPromise =
      samplingSource === 'active-layer'
        ? input.paintSession
            .exportCanonicalRasterTiles()
            .then((tiles) => createRasterTileSamplingIndexV1(tiles, activeLayerId ?? '__missing__'))
        : input.paintSession
            .exportCompositeRasterTiles()
            .then((tiles) => createRasterTileSamplingIndexV1(tiles));
  };

  const cancelSamplingSession = (): void => {
    const start = samplingStartColor;
    samplingRequestSequence += 1;
    if (start !== null) {
      state = previewColorWorkspaceCurrentV1(state, start);
      status.value = '採色をキャンセルしました';
      publish();
    }
    resetSamplingSession();
  };

  const queueSampling = (sample: PointerInputSampleV1, finalize: boolean): void => {
    const documentValue = samplingDocument;
    const indexPromise = samplingIndexPromise;
    const start = samplingStartColor;
    if (documentValue === null || indexPromise === null || start === null) {
      status.value = '採色には開いているドキュメントが必要です';
      if (finalize) resetSamplingSession();
      return;
    }
    const point = input.mapPointerToDocument(sample, documentValue);
    const requestSequence = ++samplingRequestSequence;
    const source = samplingSource;
    void indexPromise
      .then((index) => {
        if (disposed || requestSequence !== samplingRequestSequence) return;
        const color =
          source === 'active-layer'
            ? sampleActiveLayerColorV1(index, point.x, point.y)
            : sampleMergedCanvasColorV1(index, point.x, point.y, documentValue.canvas.background);
        if (color !== null) {
          publishSamplingPreview(color);
          status.value = `${source === 'active-layer' ? 'アクティブレイヤー' : '結合表示'}から採色 ${formatHexRgbV1(color)}`;
        } else {
          status.value = 'この位置には採色できる色がありません';
        }
        if (finalize) {
          commit(state.current, start);
          status.value =
            color === null
              ? '採色できる色がありませんでした'
              : `採色 ${formatHexRgbV1(state.current)}`;
          resetSamplingSession();
          publishSamplingState();
        }
      })
      .catch((error: unknown) => {
        if (requestSequence !== samplingRequestSequence) return;
        status.value = error instanceof Error ? error.message : String(error);
        if (finalize) {
          state = previewColorWorkspaceCurrentV1(state, start);
          publish();
          resetSamplingSession();
        }
      });
  };

  const onEyedropperToggle = (): void => {
    const snapshot = samplingOwnership.snapshot();
    samplingOwnership.setExplicitEnabled(!snapshot.explicitEnabled);
    status.value = samplingOwnership.snapshot().explicitEnabled ? 'スポイト: ON' : 'スポイト: OFF';
    publishSamplingState();
  };

  const onSamplingSourceChange = (): void => {
    samplingSource = selectedSamplingSource();
    status.value =
      samplingSource === 'active-layer' ? '採色元: アクティブレイヤー' : '採色元: 結合表示';
    publishSamplingState();
  };

  const isTextEditingTarget = (target: EventTarget | null): boolean =>
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable);

  const onQuickEyedropperKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'Alt' || isTextEditingTarget(event.target)) return;
    samplingOwnership.setQuickEnabled(true);
    publishSamplingState();
    event.preventDefault();
  };
  const onQuickEyedropperKeyUp = (event: KeyboardEvent): void => {
    if (event.key !== 'Alt') return;
    samplingOwnership.setQuickEnabled(false);
    publishSamplingState();
    event.preventDefault();
  };
  const onWindowBlur = (): void => {
    samplingOwnership.setQuickEnabled(false);
    publishSamplingState();
  };

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

  const MIXING_HISTORY_LIMIT = 12;
  const mixingPoint = (event: PointerEvent): ColorMixingPointV1 => {
    const [x, y] = canvasPoint(event, mixingCanvas);
    return Object.freeze({ x, y });
  };
  const pushMixingUndo = (snapshot: ColorMixingSurfaceSnapshotV1): void => {
    mixingUndoStack = [...mixingUndoStack, snapshot].slice(-MIXING_HISTORY_LIMIT);
  };
  const applyMixingSegment = (from: ColorMixingPointV1, to: ColorMixingPointV1): void => {
    const diameter = Number(mixingSize.value);
    if (mixingTool === 'brush') {
      mixingSurface.paintLine(from, to, state.current, diameter);
    } else if (mixingTool === 'blend') {
      mixingSurface.blendLine(from, to, diameter);
    }
    renderMixingSurface();
  };
  const selectMixingTool = (tool: ColorMixingToolV1): void => {
    mixingTool = tool;
    publishMixingState(activeColorPaletteV1(state).colors);
  };
  const onMixingBrush = (): void => selectMixingTool('brush');
  const onMixingBlend = (): void => selectMixingTool('blend');
  const onMixingEyedropper = (): void => selectMixingTool('eyedropper');
  const onMixingSize = (): void => {
    mixingSizeValue.value = mixingSize.value;
    input.root.dataset.illustroColorMixingSize = mixingSize.value;
  };
  const onMixingDown = (event: PointerEvent): void => {
    const point = mixingPoint(event);
    if (mixingTool === 'eyedropper') {
      const color = mixingSurface.sample(point.x, point.y);
      commit(color);
      status.value = `色混ぜパレットから採色 ${formatHexRgbV1(color)}`;
      event.preventDefault();
      return;
    }
    mixingGestureStart = mixingSurface.snapshot();
    mixingLastPoint = point;
    mixingCanvas.setPointerCapture(event.pointerId);
    applyMixingSegment(point, point);
    event.preventDefault();
  };
  const onMixingMove = (event: PointerEvent): void => {
    if (!mixingCanvas.hasPointerCapture(event.pointerId) || mixingLastPoint === null) return;
    const point = mixingPoint(event);
    applyMixingSegment(mixingLastPoint, point);
    mixingLastPoint = point;
    event.preventDefault();
  };
  const finishMixingGesture = (event: PointerEvent): void => {
    if (mixingCanvas.hasPointerCapture(event.pointerId)) {
      mixingCanvas.releasePointerCapture(event.pointerId);
    }
    if (mixingGestureStart !== null) {
      pushMixingUndo(mixingGestureStart);
      mixingRedoStack = [];
    }
    mixingGestureStart = null;
    mixingLastPoint = null;
    publishMixingState(activeColorPaletteV1(state).colors);
    event.preventDefault();
  };
  const cancelMixingGesture = (event: PointerEvent): void => {
    if (mixingCanvas.hasPointerCapture(event.pointerId)) {
      mixingCanvas.releasePointerCapture(event.pointerId);
    }
    if (mixingGestureStart !== null) mixingSurface.restore(mixingGestureStart);
    mixingGestureStart = null;
    mixingLastPoint = null;
    renderMixingSurface();
    publishMixingState(activeColorPaletteV1(state).colors);
    event.preventDefault();
  };
  const onMixingUndo = (): void => {
    const previous = mixingUndoStack.at(-1);
    if (previous === undefined) return;
    mixingRedoStack = [...mixingRedoStack, mixingSurface.snapshot()].slice(-MIXING_HISTORY_LIMIT);
    mixingUndoStack = mixingUndoStack.slice(0, -1);
    mixingSurface.restore(previous);
    publishMixingState(activeColorPaletteV1(state).colors);
  };
  const onMixingRedo = (): void => {
    const next = mixingRedoStack.at(-1);
    if (next === undefined) return;
    pushMixingUndo(mixingSurface.snapshot());
    mixingRedoStack = mixingRedoStack.slice(0, -1);
    mixingSurface.restore(next);
    publishMixingState(activeColorPaletteV1(state).colors);
  };
  const onMixingClear = (): void => {
    pushMixingUndo(mixingSurface.snapshot());
    mixingRedoStack = [];
    mixingSurface.clear();
    status.value = '色混ぜパレットをクリアしました';
    publishMixingState(activeColorPaletteV1(state).colors);
  };

  const selectColorHelperMode = (mode: ColorHelperModeV1): void => {
    colorHelperMode = mode;
    publishColorHelperState(true);
  };
  const onHelperIntermediateTab = (): void => selectColorHelperMode('intermediate');
  const onHelperApproximateTab = (): void => selectColorHelperMode('approximate');
  const onColorHelperToggle = (): void => {
    if (colorHelper.open) publishColorHelperState(true);
  };
  const onIntermediateCorner = (index: number): void => {
    const next = [...intermediateCorners] as [
      RgbUnitColorV1,
      RgbUnitColorV1,
      RgbUnitColorV1,
      RgbUnitColorV1,
    ];
    next[index] = state.current;
    intermediateCorners = Object.freeze(next);
    status.value = `中間色コーナー ${index + 1} に ${formatHexRgbV1(state.current)} を登録`;
    publishColorHelperState(true);
  };
  const onIntermediateTopLeft = (): void => onIntermediateCorner(0);
  const onIntermediateTopRight = (): void => onIntermediateCorner(1);
  const onIntermediateBottomLeft = (): void => onIntermediateCorner(2);
  const onIntermediateBottomRight = (): void => onIntermediateCorner(3);
  const onIntermediateGrid = (event: PointerEvent): void => {
    const color = helperGridColorAt(event, intermediateGridCanvas, intermediateGridColors);
    if (color === null) return;
    commit(color);
    status.value = `中間色 ${formatHexRgbV1(color)}`;
    event.preventDefault();
  };
  const onApproximateSettings = (): void => publishColorHelperState(true);
  const onApproximateGrid = (event: PointerEvent): void => {
    const color = helperGridColorAt(event, approximateGridCanvas, approximateGridColors);
    if (color === null) return;
    commit(color);
    status.value = `近似色 ${formatHexRgbV1(color)}`;
    event.preventDefault();
  };

  const paletteUpdate = (next: ColorWorkspaceStateV1, message: string): void => {
    state = next;
    interactionStart = null;
    persist();
    status.value = message;
    publish();
  };
  const onPaletteSelect = (): void => {
    try {
      selectedPaletteColorIndex = null;
      paletteUpdate(setActiveColorPaletteV1(state, paletteSelect.value), '');
    } catch (error) {
      status.value = error instanceof Error ? error.message : String(error);
      publish(false);
    }
  };
  const makePaletteId = (): string => {
    const uuid = globalThis.crypto?.randomUUID?.();
    return `palette-${uuid ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`}`;
  };
  const onPaletteCreate = (): void => {
    try {
      selectedPaletteColorIndex = null;
      paletteUpdate(
        createColorPaletteInWorkspaceV1(
          state,
          makePaletteId(),
          `パレット ${state.palettes.length + 1}`,
        ),
        'パレットを作成しました',
      );
      paletteName.focus();
      paletteName.select();
    } catch (error) {
      status.value = error instanceof Error ? error.message : String(error);
    }
  };
  const onPaletteRename = (): void => {
    try {
      paletteUpdate(
        renameColorPaletteV1(state, state.activePaletteId, paletteName.value),
        'パレット名を変更しました',
      );
    } catch (error) {
      status.value = error instanceof Error ? error.message : String(error);
      publish(false);
    }
  };
  const onPaletteDelete = (): void => {
    try {
      selectedPaletteColorIndex = null;
      paletteUpdate(deleteColorPaletteV1(state, state.activePaletteId), 'パレットを削除しました');
    } catch (error) {
      status.value = error instanceof Error ? error.message : String(error);
    }
  };
  const moveActivePalette = (delta: -1 | 1): void => {
    try {
      const index = state.palettes.findIndex((palette) => palette.id === state.activePaletteId);
      paletteUpdate(
        moveColorPaletteV1(state, state.activePaletteId, index + delta),
        'パレットを並べ替えました',
      );
    } catch (error) {
      status.value = error instanceof Error ? error.message : String(error);
    }
  };
  const onPaletteUp = (): void => moveActivePalette(-1);
  const onPaletteDown = (): void => moveActivePalette(1);
  const onPaletteAddCurrent = (): void => {
    try {
      const before = activeColorPaletteV1(state);
      const existingIndex = before.colors.findIndex(
        (color) =>
          color[0] === state.current[0] &&
          color[1] === state.current[1] &&
          color[2] === state.current[2],
      );
      const next = addColorToPaletteV1(state, state.activePaletteId, state.current);
      const active = activeColorPaletteV1(next);
      selectedPaletteColorIndex = existingIndex >= 0 ? existingIndex : active.colors.length - 1;
      paletteUpdate(
        next,
        existingIndex >= 0 ? '同じ色がパレットにあります' : '現在色をパレットへ追加しました',
      );
    } catch (error) {
      status.value = error instanceof Error ? error.message : String(error);
    }
  };
  const onPaletteColorDelete = (): void => {
    if (selectedPaletteColorIndex === null) return;
    try {
      const index = selectedPaletteColorIndex;
      const next = removeColorFromPaletteV1(state, state.activePaletteId, index);
      const active = activeColorPaletteV1(next);
      selectedPaletteColorIndex =
        active.colors.length === 0 ? null : Math.min(index, active.colors.length - 1);
      paletteUpdate(next, 'パレットから色を削除しました');
    } catch (error) {
      status.value = error instanceof Error ? error.message : String(error);
    }
  };
  const moveSelectedPaletteColor = (delta: -1 | 1): void => {
    if (selectedPaletteColorIndex === null) return;
    try {
      const target = selectedPaletteColorIndex + delta;
      const next = moveColorWithinPaletteV1(
        state,
        state.activePaletteId,
        selectedPaletteColorIndex,
        target,
      );
      selectedPaletteColorIndex = target;
      paletteUpdate(next, 'パレット色を並べ替えました');
    } catch (error) {
      status.value = error instanceof Error ? error.message : String(error);
    }
  };
  const onPaletteColorLeft = (): void => moveSelectedPaletteColor(-1);
  const onPaletteColorRight = (): void => moveSelectedPaletteColor(1);
  const onPaletteImportClick = (): void => paletteFile.click();
  const onPaletteImportChange = async (): Promise<void> => {
    const file = paletteFile.files?.[0];
    if (file === undefined) return;
    try {
      const bundle = parseColorPaletteBundleV1(JSON.parse(await file.text()));
      const targetWorkingSpace = workingSpace();
      const mismatch = bundle.workingSpace !== targetWorkingSpace;
      const converted = convertColorPaletteBundleWorkingSpaceV1(bundle, targetWorkingSpace);
      const next = importColorPaletteBundleV1(state, converted);
      selectedPaletteColorIndex = null;
      paletteUpdate(
        next,
        mismatch
          ? `パレットを読込: ${bundle.workingSpace} → ${targetWorkingSpace} にprofile-aware変換`
          : 'パレットを読み込みました',
      );
    } catch (error) {
      status.value = error instanceof Error ? error.message : String(error);
    } finally {
      paletteFile.value = '';
    }
  };
  const onPaletteExport = (): void => {
    try {
      const payload = serializeColorPaletteBundleV1(state, workingSpace());
      const blob = new Blob([payload], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'illustro-palettes.json';
      anchor.click();
      globalThis.setTimeout(() => URL.revokeObjectURL(url), 0);
      status.value = 'パレットを書き出しました';
    } catch (error) {
      status.value = error instanceof Error ? error.message : String(error);
    }
  };

  paletteSelect.addEventListener('change', onPaletteSelect);
  paletteCreate.addEventListener('click', onPaletteCreate);
  paletteName.addEventListener('change', onPaletteRename);
  paletteDelete.addEventListener('click', onPaletteDelete);
  paletteMoveUp.addEventListener('click', onPaletteUp);
  paletteMoveDown.addEventListener('click', onPaletteDown);
  paletteAddCurrent.addEventListener('click', onPaletteAddCurrent);
  paletteColorDelete.addEventListener('click', onPaletteColorDelete);
  paletteColorLeft.addEventListener('click', onPaletteColorLeft);
  paletteColorRight.addEventListener('click', onPaletteColorRight);
  paletteImport.addEventListener('click', onPaletteImportClick);
  paletteFile.addEventListener('change', onPaletteImportChange);
  paletteExport.addEventListener('click', onPaletteExport);
  mixingBrush.addEventListener('click', onMixingBrush);
  mixingBlend.addEventListener('click', onMixingBlend);
  mixingEyedropper.addEventListener('click', onMixingEyedropper);
  mixingSize.addEventListener('input', onMixingSize);
  mixingUndo.addEventListener('click', onMixingUndo);
  mixingRedo.addEventListener('click', onMixingRedo);
  mixingClear.addEventListener('click', onMixingClear);
  mixingCanvas.addEventListener('pointerdown', onMixingDown);
  mixingCanvas.addEventListener('pointermove', onMixingMove);
  mixingCanvas.addEventListener('pointerup', finishMixingGesture);
  mixingCanvas.addEventListener('pointercancel', cancelMixingGesture);
  colorHelper.addEventListener('toggle', onColorHelperToggle);
  helperIntermediateTab.addEventListener('click', onHelperIntermediateTab);
  helperApproximateTab.addEventListener('click', onHelperApproximateTab);
  intermediateCornerButtons[0].addEventListener('click', onIntermediateTopLeft);
  intermediateCornerButtons[1].addEventListener('click', onIntermediateTopRight);
  intermediateCornerButtons[2].addEventListener('click', onIntermediateBottomLeft);
  intermediateCornerButtons[3].addEventListener('click', onIntermediateBottomRight);
  intermediateGridCanvas.addEventListener('pointerdown', onIntermediateGrid);
  approximateXAxis.addEventListener('change', onApproximateSettings);
  approximateYAxis.addEventListener('change', onApproximateSettings);
  approximateXAmount.addEventListener('input', onApproximateSettings);
  approximateYAmount.addEventListener('input', onApproximateSettings);
  approximateGridCanvas.addEventListener('pointerdown', onApproximateGrid);
  eyedropper.addEventListener('click', onEyedropperToggle);
  samplingSourceSelect.addEventListener('change', onSamplingSourceChange);
  document.addEventListener('keydown', onQuickEyedropperKeyDown);
  document.addEventListener('keyup', onQuickEyedropperKeyUp);
  window.addEventListener('blur', onWindowBlur);

  samplingSource = selectedSamplingSource();
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
      paletteSelect.removeEventListener('change', onPaletteSelect);
      paletteCreate.removeEventListener('click', onPaletteCreate);
      paletteName.removeEventListener('change', onPaletteRename);
      paletteDelete.removeEventListener('click', onPaletteDelete);
      paletteMoveUp.removeEventListener('click', onPaletteUp);
      paletteMoveDown.removeEventListener('click', onPaletteDown);
      paletteAddCurrent.removeEventListener('click', onPaletteAddCurrent);
      paletteColorDelete.removeEventListener('click', onPaletteColorDelete);
      paletteColorLeft.removeEventListener('click', onPaletteColorLeft);
      paletteColorRight.removeEventListener('click', onPaletteColorRight);
      paletteImport.removeEventListener('click', onPaletteImportClick);
      paletteFile.removeEventListener('change', onPaletteImportChange);
      paletteExport.removeEventListener('click', onPaletteExport);
      mixingBrush.removeEventListener('click', onMixingBrush);
      mixingBlend.removeEventListener('click', onMixingBlend);
      mixingEyedropper.removeEventListener('click', onMixingEyedropper);
      mixingSize.removeEventListener('input', onMixingSize);
      mixingUndo.removeEventListener('click', onMixingUndo);
      mixingRedo.removeEventListener('click', onMixingRedo);
      mixingClear.removeEventListener('click', onMixingClear);
      mixingCanvas.removeEventListener('pointerdown', onMixingDown);
      mixingCanvas.removeEventListener('pointermove', onMixingMove);
      mixingCanvas.removeEventListener('pointerup', finishMixingGesture);
      mixingCanvas.removeEventListener('pointercancel', cancelMixingGesture);
      colorHelper.removeEventListener('toggle', onColorHelperToggle);
      helperIntermediateTab.removeEventListener('click', onHelperIntermediateTab);
      helperApproximateTab.removeEventListener('click', onHelperApproximateTab);
      intermediateCornerButtons[0].removeEventListener('click', onIntermediateTopLeft);
      intermediateCornerButtons[1].removeEventListener('click', onIntermediateTopRight);
      intermediateCornerButtons[2].removeEventListener('click', onIntermediateBottomLeft);
      intermediateCornerButtons[3].removeEventListener('click', onIntermediateBottomRight);
      intermediateGridCanvas.removeEventListener('pointerdown', onIntermediateGrid);
      approximateXAxis.removeEventListener('change', onApproximateSettings);
      approximateYAxis.removeEventListener('change', onApproximateSettings);
      approximateXAmount.removeEventListener('input', onApproximateSettings);
      approximateYAmount.removeEventListener('input', onApproximateSettings);
      approximateGridCanvas.removeEventListener('pointerdown', onApproximateGrid);
      eyedropper.removeEventListener('click', onEyedropperToggle);
      samplingSourceSelect.removeEventListener('change', onSamplingSourceChange);
      document.removeEventListener('keydown', onQuickEyedropperKeyDown);
      document.removeEventListener('keyup', onQuickEyedropperKeyUp);
      window.removeEventListener('blur', onWindowBlur);
      resetSamplingSession();
      input.root.dataset.illustroColorWorkflow = 'disposed';
    },
    snapshot(): ColorWorkspaceStateV1 {
      return state;
    },
    applyExternalSample(color: RgbUnitColorV1, sourceLabel: string): void {
      if (disposed) return;
      commit(color);
      status.value = `${sourceLabel}から採色 ${formatHexRgbV1(color)}`;
      input.root.dataset.illustroColorSamplingSource = 'reference-image';
    },
    ingestPointerBatch(batch: PointerInputBatchV1): boolean {
      if (disposed) return false;
      const decision = samplingOwnership.route(batch);
      if (!decision.consumed) return false;
      input.root.dataset.illustroColorSamplingPointer = String(batch.pointerId);
      if (decision.cancel) {
        cancelSamplingSession();
        return true;
      }
      const latest = batch.confirmed.at(-1);
      if (latest === undefined) return true;
      if (batch.eventType === 'pointerdown') beginSamplingSession();
      if (decision.shouldSample) queueSampling(latest, decision.finalize);
      return true;
    },
  };
}
