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

function lerpColor(left: RgbUnitColorV1, right: RgbUnitColorV1, amount: number): RgbUnitColorV1 {
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
      s: axis === 'saturation' ? clamp01(hsv.s + normalizedOffset * 0.5 * scale) : hsv.s,
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
      result.push(adjustApproximateAxis(xAdjusted, options.yAxis, -yOffset, options.yAmount));
    }
  }
  return Object.freeze(result);
}
