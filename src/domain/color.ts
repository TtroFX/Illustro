import type { DocumentColorSpace } from './document.js';

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
