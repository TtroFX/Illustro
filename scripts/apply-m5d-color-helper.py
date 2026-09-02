from pathlib import Path
from textwrap import dedent


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    if old not in text:
        if new in text:
            return
        raise SystemExit(f'anchor missing in {path}: {old[:120]!r}')
    file.write_text(text.replace(old, new, 1))


Path('src/app/color-helper-grid.ts').write_text(dedent(r'''
    import {
      freezeRgbUnitColorV1,
      hsvToRgbV1,
      rgbToHsvV1,
      type RgbUnitColorV1,
    } from '../domain/color.js';

    export type ApproximateColorAxisV1 =
      | 'hue'
      | 'saturation'
      | 'value'
      | 'lightness'
      | 'red'
      | 'green'
      | 'blue';

    export interface IntermediateColorCornersV1 {
      readonly topLeft: RgbUnitColorV1;
      readonly topRight: RgbUnitColorV1;
      readonly bottomLeft: RgbUnitColorV1;
      readonly bottomRight: RgbUnitColorV1;
    }

    export interface ApproximateColorGridOptionsV1 {
      readonly base: RgbUnitColorV1;
      readonly xAxis: ApproximateColorAxisV1;
      readonly yAxis: ApproximateColorAxisV1;
      readonly xAmount: number;
      readonly yAmount: number;
      readonly columns?: number;
      readonly rows?: number;
    }

    function clamp01(value: number): number {
      return Math.min(1, Math.max(0, value));
    }

    function validateGridSize(value: number, label: string): number {
      if (!Number.isInteger(value) || value < 2 || value > 64) {
        throw new RangeError(`${label} must be an integer in 2..64`);
      }
      return value;
    }

    function validateAmount(value: number, label: string): number {
      if (!Number.isFinite(value) || value < 0 || value > 1) {
        throw new RangeError(`${label} must be finite in 0..1`);
      }
      return value;
    }

    function lerp(left: number, right: number, amount: number): number {
      return left + (right - left) * amount;
    }

    function lerpColor(
      left: RgbUnitColorV1,
      right: RgbUnitColorV1,
      amount: number,
    ): RgbUnitColorV1 {
      return freezeRgbUnitColorV1([
        lerp(left[0], right[0], amount),
        lerp(left[1], right[1], amount),
        lerp(left[2], right[2], amount),
      ]);
    }

    export function intermediateColorGridV1(
      corners: IntermediateColorCornersV1,
      columns = 9,
      rows = 9,
    ): readonly RgbUnitColorV1[] {
      const width = validateGridSize(columns, 'columns');
      const height = validateGridSize(rows, 'rows');
      const result: RgbUnitColorV1[] = [];
      for (let row = 0; row < height; row += 1) {
        const v = row / (height - 1);
        const left = lerpColor(corners.topLeft, corners.bottomLeft, v);
        const right = lerpColor(corners.topRight, corners.bottomRight, v);
        for (let column = 0; column < width; column += 1) {
          const u = column / (width - 1);
          result.push(lerpColor(left, right, u));
        }
      }
      return Object.freeze(result);
    }

    interface HslColorV1 {
      readonly h: number;
      readonly s: number;
      readonly l: number;
    }

    function rgbToHsl(color: RgbUnitColorV1): HslColorV1 {
      const red = color[0];
      const green = color[1];
      const blue = color[2];
      const max = Math.max(red, green, blue);
      const min = Math.min(red, green, blue);
      const delta = max - min;
      const lightness = (max + min) / 2;
      let hue = 0;
      let saturation = 0;
      if (delta > 0) {
        saturation = delta / (1 - Math.abs(2 * lightness - 1));
        if (max === red) hue = 60 * (((green - blue) / delta) % 6);
        else if (max === green) hue = 60 * ((blue - red) / delta + 2);
        else hue = 60 * ((red - green) / delta + 4);
      }
      if (hue < 0) hue += 360;
      return Object.freeze({ h: hue, s: saturation, l: lightness });
    }

    function hslToRgb(input: HslColorV1): RgbUnitColorV1 {
      const hue = ((input.h % 360) + 360) % 360;
      const saturation = clamp01(input.s);
      const lightness = clamp01(input.l);
      const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
      const sector = hue / 60;
      const x = chroma * (1 - Math.abs((sector % 2) - 1));
      let red = 0;
      let green = 0;
      let blue = 0;
      if (sector < 1) [red, green, blue] = [chroma, x, 0];
      else if (sector < 2) [red, green, blue] = [x, chroma, 0];
      else if (sector < 3) [red, green, blue] = [0, chroma, x];
      else if (sector < 4) [red, green, blue] = [0, x, chroma];
      else if (sector < 5) [red, green, blue] = [x, 0, chroma];
      else [red, green, blue] = [chroma, 0, x];
      const match = lightness - chroma / 2;
      return freezeRgbUnitColorV1([red + match, green + match, blue + match]);
    }

    function adjustApproximateAxis(
      color: RgbUnitColorV1,
      axis: ApproximateColorAxisV1,
      normalizedOffset: number,
      amount: number,
    ): RgbUnitColorV1 {
      const scale = validateAmount(amount, 'axis amount');
      if (scale === 0 || normalizedOffset === 0) return color;
      if (axis === 'hue') {
        const hsv = rgbToHsvV1(color);
        return hsvToRgbV1({ h: hsv.h + normalizedOffset * 120 * scale, s: hsv.s, v: hsv.v });
      }
      if (axis === 'saturation' || axis === 'value') {
        const hsv = rgbToHsvV1(color);
        return hsvToRgbV1({
          h: hsv.h,
          s:
            axis === 'saturation'
              ? clamp01(hsv.s + normalizedOffset * 0.5 * scale)
              : hsv.s,
          v: axis === 'value' ? clamp01(hsv.v + normalizedOffset * 0.5 * scale) : hsv.v,
        });
      }
      if (axis === 'lightness') {
        const hsl = rgbToHsl(color);
        return hslToRgb({
          h: hsl.h,
          s: hsl.s,
          l: clamp01(hsl.l + normalizedOffset * 0.5 * scale),
        });
      }
      const channel = axis === 'red' ? 0 : axis === 'green' ? 1 : 2;
      const next = [color[0], color[1], color[2]];
      next[channel] = clamp01((next[channel] ?? 0) + normalizedOffset * 0.5 * scale);
      return freezeRgbUnitColorV1(next);
    }

    export function approximateColorGridV1(
      options: ApproximateColorGridOptionsV1,
    ): readonly RgbUnitColorV1[] {
      const columns = validateGridSize(options.columns ?? 9, 'columns');
      const rows = validateGridSize(options.rows ?? 9, 'rows');
      validateAmount(options.xAmount, 'xAmount');
      validateAmount(options.yAmount, 'yAmount');
      const result: RgbUnitColorV1[] = [];
      for (let row = 0; row < rows; row += 1) {
        const yOffset = (row / (rows - 1)) * 2 - 1;
        for (let column = 0; column < columns; column += 1) {
          const xOffset = (column / (columns - 1)) * 2 - 1;
          const xAdjusted = adjustApproximateAxis(
            options.base,
            options.xAxis,
            xOffset,
            options.xAmount,
          );
          result.push(
            adjustApproximateAxis(xAdjusted, options.yAxis, -yOffset, options.yAmount),
          );
        }
      }
      return Object.freeze(result);
    }
''').lstrip())

Path('tests/unit/color-helper-grid.test.ts').write_text(dedent(r'''
    import { describe, expect, it } from 'vitest';
    import {
      approximateColorGridV1,
      intermediateColorGridV1,
    } from '../../src/app/color-helper-grid.js';
    import { rgbToHsvV1 } from '../../src/domain/color.js';

    describe('M5D intermediate / approximate color helper', () => {
      it('bilinearly interpolates four registered corner colors', () => {
        const grid = intermediateColorGridV1(
          {
            topLeft: [1, 0, 0],
            topRight: [0, 1, 0],
            bottomLeft: [0, 0, 1],
            bottomRight: [1, 1, 1],
          },
          3,
          3,
        );
        expect(grid[0]).toEqual([1, 0, 0]);
        expect(grid[2]).toEqual([0, 1, 0]);
        expect(grid[6]).toEqual([0, 0, 1]);
        expect(grid[8]).toEqual([1, 1, 1]);
        expect(grid[4]).toEqual([0.5, 0.5, 0.5]);
      });

      it('keeps the selected drawing color at the center of the approximate grid', () => {
        const base = [0.25, 0.5, 0.75] as const;
        const grid = approximateColorGridV1({
          base,
          xAxis: 'hue',
          yAxis: 'saturation',
          xAmount: 0.5,
          yAmount: 0.5,
          columns: 5,
          rows: 5,
        });
        expect(grid[12]).toEqual(base);
      });

      it('varies hue horizontally and lightness vertically', () => {
        const base = [0.8, 0.3, 0.2] as const;
        const hueGrid = approximateColorGridV1({
          base,
          xAxis: 'hue',
          yAxis: 'lightness',
          xAmount: 0.5,
          yAmount: 0.5,
          columns: 3,
          rows: 3,
        });
        const leftHue = rgbToHsvV1(hueGrid[3] ?? base).h;
        const rightHue = rgbToHsvV1(hueGrid[5] ?? base).h;
        expect(Math.abs(leftHue - rightHue)).toBeGreaterThan(50);
        const top = hueGrid[1] ?? base;
        const bottom = hueGrid[7] ?? base;
        expect(top[0] + top[1] + top[2]).toBeGreaterThan(bottom[0] + bottom[1] + bottom[2]);
      });

      it('clamps RGB-axis variations into encoded unit range', () => {
        const grid = approximateColorGridV1({
          base: [0.95, 0.02, 0.5],
          xAxis: 'red',
          yAxis: 'green',
          xAmount: 1,
          yAmount: 1,
          columns: 3,
          rows: 3,
        });
        for (const color of grid) {
          expect(color.every((component) => component >= 0 && component <= 1)).toBe(true);
        }
        expect(grid[5]?.[0]).toBe(1);
        expect(grid[7]?.[1]).toBe(0);
      });
    });
''').lstrip())

# Controller imports.
replace_once(
    'src/app/color-workflow-controller.ts',
    "import type { PaintSessionControllerV1 } from './paint-session-controller.js';\n",
    "import { convertEncodedRgbV1 } from '../domain/color-management.js';\nimport type { PaintSessionControllerV1 } from './paint-session-controller.js';\n",
)
replace_once(
    'src/app/color-workflow-controller.ts',
    "import {\n  ColorMixingSurfaceV1,\n  type ColorMixingPointV1,\n  type ColorMixingSurfaceSnapshotV1,\n  type ColorMixingToolV1,\n} from './color-mixing-surface.js';\n",
    "import {\n  approximateColorGridV1,\n  intermediateColorGridV1,\n  type ApproximateColorAxisV1,\n} from './color-helper-grid.js';\nimport {\n  ColorMixingSurfaceV1,\n  type ColorMixingPointV1,\n  type ColorMixingSurfaceSnapshotV1,\n  type ColorMixingToolV1,\n} from './color-mixing-surface.js';\n",
)

replace_once(
    'src/app/color-workflow-controller.ts',
    "  const mixingClear = requireElement('#color-mixing-clear', HTMLButtonElement);\n",
    "  const mixingClear = requireElement('#color-mixing-clear', HTMLButtonElement);\n  const colorHelper = requireElement('#color-helper', HTMLDetailsElement);\n  const helperIntermediateTab = requireElement('#color-helper-intermediate-tab', HTMLButtonElement);\n  const helperApproximateTab = requireElement('#color-helper-approximate-tab', HTMLButtonElement);\n  const helperIntermediatePanel = requireElement('#color-helper-intermediate-panel', HTMLDivElement);\n  const helperApproximatePanel = requireElement('#color-helper-approximate-panel', HTMLDivElement);\n  const intermediateGridCanvas = requireElement('#color-intermediate-grid', HTMLCanvasElement);\n  const approximateGridCanvas = requireElement('#color-approximate-grid', HTMLCanvasElement);\n  const intermediateCornerButtons = [\n    requireElement('#color-intermediate-tl', HTMLButtonElement),\n    requireElement('#color-intermediate-tr', HTMLButtonElement),\n    requireElement('#color-intermediate-bl', HTMLButtonElement),\n    requireElement('#color-intermediate-br', HTMLButtonElement),\n  ] as const;\n  const approximateXAxis = requireElement('#color-approximate-x-axis', HTMLSelectElement);\n  const approximateYAxis = requireElement('#color-approximate-y-axis', HTMLSelectElement);\n  const approximateXAmount = requireElement('#color-approximate-x-amount', HTMLInputElement);\n  const approximateYAmount = requireElement('#color-approximate-y-amount', HTMLInputElement);\n",
)

replace_once(
    'src/app/color-workflow-controller.ts',
    "  let mixingRedoStack: ColorMixingSurfaceSnapshotV1[] = [];\n",
    "  let mixingRedoStack: ColorMixingSurfaceSnapshotV1[] = [];\n  type ColorHelperModeV1 = 'intermediate' | 'approximate';\n  let colorHelperMode: ColorHelperModeV1 = 'intermediate';\n  let colorHelperWorkingSpace = workingSpace();\n  let intermediateCorners: readonly [RgbUnitColorV1, RgbUnitColorV1, RgbUnitColorV1, RgbUnitColorV1] =\n    Object.freeze([state.current, state.previous, Object.freeze([0, 0, 0]), Object.freeze([1, 1, 1])]);\n  let intermediateGridColors: readonly RgbUnitColorV1[] = [];\n  let approximateGridColors: readonly RgbUnitColorV1[] = [];\n",
)

replace_once(
    'src/app/color-workflow-controller.ts',
    "    publishMixingState(activePalette.colors);\n",
    "    publishMixingState(activePalette.colors);\n    publishColorHelperState();\n",
)

helper_functions = dedent(r'''

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
  function drawHelperGrid(
    canvas: HTMLCanvasElement,
    colors: readonly RgbUnitColorV1[],
  ): void {
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
      intermediateCorners.map((color) =>
        convertEncodedRgbV1(color, colorHelperWorkingSpace, next),
      ),
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
''')
replace_once(
    'src/app/color-workflow-controller.ts',
    "  function publishSamplingState(): void {\n",
    helper_functions + "\n  function publishSamplingState(): void {\n",
)

helper_handlers = dedent(r'''

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
''')
replace_once(
    'src/app/color-workflow-controller.ts',
    "  const paletteUpdate = (next: ColorWorkspaceStateV1, message: string): void => {\n",
    helper_handlers + "\n  const paletteUpdate = (next: ColorWorkspaceStateV1, message: string): void => {\n",
)

listener_anchor = "  mixingCanvas.addEventListener('pointercancel', cancelMixingGesture);\n"
listener_insert = listener_anchor + dedent(r'''  colorHelper.addEventListener('toggle', onColorHelperToggle);
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
''')
replace_once('src/app/color-workflow-controller.ts', listener_anchor, listener_insert)

dispose_anchor = "      mixingCanvas.removeEventListener('pointercancel', cancelMixingGesture);\n"
dispose_insert = dispose_anchor + dedent(r'''      colorHelper.removeEventListener('toggle', onColorHelperToggle);
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
''')
replace_once('src/app/color-workflow-controller.ts', dispose_anchor, dispose_insert)

# HTML.
html_anchor = dedent(r'''            </details>
          </section>
          <section class="shell-inspector-card shell-reference-panel" aria-label="Reference / Sub View">
''')
html_new = dedent(r'''            </details>
            <details id="color-helper" class="shell-color-helper">
              <summary>中間・近似色</summary>
              <div class="shell-color-helper-body">
                <div class="shell-color-helper-tabs" role="group" aria-label="色候補モード">
                  <button id="color-helper-intermediate-tab" type="button" aria-pressed="true">中間</button>
                  <button id="color-helper-approximate-tab" type="button" aria-pressed="false">近似</button>
                </div>
                <div id="color-helper-intermediate-panel" class="shell-color-helper-panel">
                  <div class="shell-color-intermediate-corners" aria-label="4隅の登録色">
                    <button id="color-intermediate-tl" type="button"></button>
                    <button id="color-intermediate-tr" type="button"></button>
                    <button id="color-intermediate-bl" type="button"></button>
                    <button id="color-intermediate-br" type="button"></button>
                  </div>
                  <canvas id="color-intermediate-grid" width="180" height="180" aria-label="4隅の登録色から作る中間色。タップして色を選択"></canvas>
                </div>
                <div id="color-helper-approximate-panel" class="shell-color-helper-panel" hidden>
                  <div class="shell-color-approximate-axes">
                    <label>横軸<select id="color-approximate-x-axis"><option value="hue">H</option><option value="saturation">S</option><option value="value">V</option><option value="lightness">L</option><option value="red">R</option><option value="green">G</option><option value="blue">B</option></select></label>
                    <label>縦軸<select id="color-approximate-y-axis"><option value="saturation">S</option><option value="hue">H</option><option value="value">V</option><option value="lightness">L</option><option value="red">R</option><option value="green">G</option><option value="blue">B</option></select></label>
                  </div>
                  <label class="shell-color-approximate-amount">横の変化量<input id="color-approximate-x-amount" type="range" min="0.1" max="1" step="0.05" value="0.5" /></label>
                  <label class="shell-color-approximate-amount">縦の変化量<input id="color-approximate-y-amount" type="range" min="0.1" max="1" step="0.05" value="0.5" /></label>
                  <canvas id="color-approximate-grid" width="180" height="180" aria-label="現在色を基準にした近似色。タップして色を選択"></canvas>
                </div>
              </div>
            </details>
          </section>
          <section class="shell-inspector-card shell-reference-panel" aria-label="Reference / Sub View">
''')
replace_once('src/index.html', html_anchor, html_new)

# CSS append.
css_path = Path('public/app-shell.css')
css = css_path.read_text()
css_marker = '/* M5D intermediate / approximate color helper */'
if css_marker not in css:
    css += dedent(r'''

        /* M5D intermediate / approximate color helper */
        .shell-color-helper {
          border: 1px solid var(--border-default, #e4e9f1);
          border-radius: 8px;
          background: #fff;
        }

        .shell-color-helper > summary {
          min-height: 32px;
          padding: 8px;
          cursor: pointer;
          color: #4b5870;
          font-size: 10px;
          font-weight: 760;
          list-style-position: inside;
        }

        .shell-color-helper-body {
          display: grid;
          gap: 8px;
          padding: 0 8px 8px;
        }

        .shell-color-helper-tabs {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 5px;
        }

        .shell-color-helper-tabs button,
        .shell-color-intermediate-corners button,
        .shell-color-approximate-axes select {
          min-height: 32px;
          border: 1px solid var(--border-default, #e4e9f1);
          border-radius: 8px;
          background: #fff;
          color: #38445d;
          font: inherit;
          font-size: 10px;
        }

        .shell-color-helper-tabs button[aria-pressed='true'] {
          border-color: #8b5cf6;
          background: rgb(139 92 246 / 10%);
          box-shadow: inset 0 0 0 1px #8b5cf6;
        }

        .shell-color-helper-panel {
          display: grid;
          gap: 7px;
        }

        .shell-color-helper-panel[hidden] { display: none; }

        .shell-color-intermediate-corners {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 5px;
        }

        .shell-color-intermediate-corners button {
          min-height: 44px;
          box-shadow: inset 0 0 0 1px rgb(255 255 255 / 75%);
          cursor: pointer;
        }

        #color-intermediate-grid,
        #color-approximate-grid {
          width: min(100%, 180px);
          aspect-ratio: 1;
          justify-self: center;
          border: 1px solid var(--border-default, #e4e9f1);
          border-radius: 8px;
          background: #f6f8fb;
          cursor: crosshair;
          touch-action: none;
        }

        .shell-color-approximate-axes {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 5px;
        }

        .shell-color-approximate-axes label,
        .shell-color-approximate-amount {
          display: grid;
          gap: 3px;
          color: var(--text-secondary, #667085);
          font-size: 9px;
        }

        .shell-color-approximate-axes select {
          width: 100%;
          padding: 0 6px;
        }

        .shell-color-approximate-amount input { width: 100%; }
    ''')
    css_path.write_text(css)

# Verification contract.
replace_once(
    'scripts/verify-m5d-color.mjs',
    "requireText('src/app/color-mixing-surface.ts', [\n",
    "requireText('src/app/color-helper-grid.ts', [\n  'intermediateColorGridV1',\n  'approximateColorGridV1',\n  'ApproximateColorAxisV1',\n  \"'lightness'\",\n]);\nrequireText('src/app/color-mixing-surface.ts', [\n",
)
replace_once(
    'scripts/verify-m5d-color.mjs',
    "  'mixingSurface.blendLine',\n  'setPaintColor',\n",
    "  'mixingSurface.blendLine',\n  '#color-helper',\n  '#color-intermediate-grid',\n  '#color-approximate-grid',\n  'intermediateColorGridV1',\n  'approximateColorGridV1',\n  'setPaintColor',\n",
)
replace_once(
    'scripts/verify-m5d-color.mjs',
    "  'id=\"color-mixing-clear\"',\n]);\n",
    "  'id=\"color-mixing-clear\"',\n  'id=\"color-helper\"',\n  'id=\"color-intermediate-grid\"',\n  'id=\"color-approximate-grid\"',\n  'id=\"color-approximate-x-axis\"',\n  'id=\"color-approximate-y-axis\"',\n]);\n",
)
replace_once(
    'scripts/verify-m5d-color.mjs',
    "  'M5D-026 Color Mixing Palette:完了',\n]);\n",
    "  'M5D-026 Color Mixing Palette:完了',\n  'M5D-027 Intermediate/Approximate Color helper:完了',\n]);\n",
)

# Progress and design memo.
replace_once(
    'IMPLEMENTATION_PROGRESS.md',
    'M5D-027 Intermediate/Approximate Color helper:未完了',
    'M5D-027 Intermediate/Approximate Color helper:完了',
)

memo = Path('ILLUSTRO_DESIGN_MEMO.md')
memo_text = memo.read_text()
section = dedent(r'''

    #### M5D intermediate / approximate color helper semantic boundary — 2026-09-02

    - M5D-027 adds a production-connected color-candidate helper inside the existing Color block. It does not create a second drawing-color state: selecting a candidate commits through the existing Color Workspace current/previous/history path and therefore immediately becomes the canonical paint color.
    - Intermediate Color follows the established four-corner palette interaction used by mature painting software: the user registers the current drawing color into any of four corner swatches, and Illustro generates a bounded 9×9 bilinear grid from those four encoded RGB corner values. The interpolation is intentionally performed in the active document's encoded RGB working space so the result remains compatible with the canonical Color Workspace representation.
    - Approximate Color is centered on the current drawing color and exposes independent horizontal/vertical axes chosen from Hue, Saturation, Value, Lightness, Red, Green and Blue. The current color is always the center cell. Axis variation is bounded and clamped; Hue wraps, HSV axes preserve the remaining HSV components, Lightness uses an HSL-style lightness transform, and RGB axes adjust only their encoded component.
    - Dense candidate grids are canvas-rendered rather than represented as dozens of persistent DOM nodes. This keeps Color Wheel/entry interactions lightweight and avoids adding an avoidable layout/GC hot path. The helper only redraws its candidate grid while its progressive-disclosure panel is open.
    - If the active document working space changes between sRGB and Display-P3, registered intermediate corner colors are profile-aware converted through the centralized M5D color-management path before further interpolation. Candidate selection itself remains in the active document working space.
    - The behavior is an independent implementation informed by the public CLIP STUDIO PAINT Intermediate Color and Approximate Color palette interaction model; no third-party source code or assets are incorporated.
''')
if '#### M5D intermediate / approximate color helper semantic boundary — 2026-09-02' not in memo_text:
    memo.write_text(memo_text.rstrip() + section + '\n')
