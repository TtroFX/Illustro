import {
  convertEncodedRgbV1,
  decodeSrgbTransferComponentV1,
  encodeSrgbTransferComponentV1,
} from '../domain/color-management.js';
import { freezeRgbUnitColorV1, type RgbUnitColorV1 } from '../domain/color.js';
import type { DocumentColorSpace } from '../domain/document.js';

export type ColorMixingToolV1 = 'brush' | 'blend' | 'eyedropper';

export interface ColorMixingPointV1 {
  readonly x: number;
  readonly y: number;
}

export interface ColorMixingSurfaceSnapshotV1 {
  readonly schema: 'illustro.color-mixing-surface/1';
  readonly width: number;
  readonly height: number;
  readonly workingSpace: DocumentColorSpace;
  readonly pixels: Uint8ClampedArray;
}

const MAX_MIXING_SURFACE_DIMENSION_V1 = 512;
const WHITE_RGB_UNIT: RgbUnitColorV1 = Object.freeze([1, 1, 1]);

type LinearRgbV1 = readonly [number, number, number];

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function validateDimension(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < 1 || value > MAX_MIXING_SURFACE_DIMENSION_V1) {
    throw new RangeError(
      `${label} must be a safe integer in 1..${MAX_MIXING_SURFACE_DIMENSION_V1}`,
    );
  }
  return value;
}

function validateStrength(value: number): number {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError('mixing strength must be a finite value in 0..1');
  }
  return value;
}

function validateDiameter(value: number): number {
  if (!Number.isFinite(value) || value < 1 || value > 96) {
    throw new RangeError('mixing brush diameter must be a finite value in 1..96');
  }
  return value;
}

function encodedToLinear(color: RgbUnitColorV1): LinearRgbV1 {
  return Object.freeze([
    decodeSrgbTransferComponentV1(color[0]),
    decodeSrgbTransferComponentV1(color[1]),
    decodeSrgbTransferComponentV1(color[2]),
  ]);
}

function linearToEncoded(color: LinearRgbV1): RgbUnitColorV1 {
  return freezeRgbUnitColorV1([
    clamp(encodeSrgbTransferComponentV1(color[0]), 0, 1),
    clamp(encodeSrgbTransferComponentV1(color[1]), 0, 1),
    clamp(encodeSrgbTransferComponentV1(color[2]), 0, 1),
  ]);
}

function byteToEncoded(value: number): number {
  return clamp(value, 0, 255) / 255;
}

function encodedToByte(value: number): number {
  return Math.round(clamp(value, 0, 1) * 255);
}

export class ColorMixingSurfaceV1 {
  readonly #width: number;
  readonly #height: number;
  readonly #pixels: Uint8ClampedArray;
  #workingSpace: DocumentColorSpace;

  constructor(width: number, height: number, workingSpace: DocumentColorSpace) {
    this.#width = validateDimension(width, 'mixing surface width');
    this.#height = validateDimension(height, 'mixing surface height');
    this.#workingSpace = workingSpace;
    this.#pixels = new Uint8ClampedArray(this.#width * this.#height * 4);
    this.clear();
  }

  width(): number {
    return this.#width;
  }

  height(): number {
    return this.#height;
  }

  workingSpace(): DocumentColorSpace {
    return this.#workingSpace;
  }

  snapshot(): ColorMixingSurfaceSnapshotV1 {
    return Object.freeze({
      schema: 'illustro.color-mixing-surface/1' as const,
      width: this.#width,
      height: this.#height,
      workingSpace: this.#workingSpace,
      pixels: new Uint8ClampedArray(this.#pixels),
    });
  }

  restore(snapshot: ColorMixingSurfaceSnapshotV1): void {
    if (
      snapshot.schema !== 'illustro.color-mixing-surface/1' ||
      snapshot.width !== this.#width ||
      snapshot.height !== this.#height ||
      snapshot.pixels.byteLength !== this.#pixels.byteLength
    ) {
      throw new TypeError('mixing surface snapshot is incompatible');
    }
    this.#workingSpace = snapshot.workingSpace;
    this.#pixels.set(snapshot.pixels);
  }

  clear(color: RgbUnitColorV1 = WHITE_RGB_UNIT): void {
    const red = encodedToByte(color[0]);
    const green = encodedToByte(color[1]);
    const blue = encodedToByte(color[2]);
    for (let offset = 0; offset < this.#pixels.length; offset += 4) {
      this.#pixels[offset] = red;
      this.#pixels[offset + 1] = green;
      this.#pixels[offset + 2] = blue;
      this.#pixels[offset + 3] = 255;
    }
  }

  sample(x: number, y: number): RgbUnitColorV1 {
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      throw new RangeError('mixing sample coordinates must be finite');
    }
    const ix = Math.floor(clamp(x, 0, this.#width - 1));
    const iy = Math.floor(clamp(y, 0, this.#height - 1));
    const offset = (iy * this.#width + ix) * 4;
    return freezeRgbUnitColorV1([
      byteToEncoded(this.#pixels[offset] ?? 255),
      byteToEncoded(this.#pixels[offset + 1] ?? 255),
      byteToEncoded(this.#pixels[offset + 2] ?? 255),
    ]);
  }

  convertWorkingSpace(targetSpace: DocumentColorSpace): void {
    if (targetSpace === this.#workingSpace) return;
    const sourceSpace = this.#workingSpace;
    for (let offset = 0; offset < this.#pixels.length; offset += 4) {
      const converted = convertEncodedRgbV1(
        freezeRgbUnitColorV1([
          byteToEncoded(this.#pixels[offset] ?? 255),
          byteToEncoded(this.#pixels[offset + 1] ?? 255),
          byteToEncoded(this.#pixels[offset + 2] ?? 255),
        ]),
        sourceSpace,
        targetSpace,
      );
      this.#pixels[offset] = encodedToByte(converted[0]);
      this.#pixels[offset + 1] = encodedToByte(converted[1]);
      this.#pixels[offset + 2] = encodedToByte(converted[2]);
    }
    this.#workingSpace = targetSpace;
  }

  paintLine(
    from: ColorMixingPointV1,
    to: ColorMixingPointV1,
    color: RgbUnitColorV1,
    diameter: number,
    strength = 0.78,
  ): void {
    const brushDiameter = validateDiameter(diameter);
    const normalizedStrength = validateStrength(strength);
    const sourceLinear = encodedToLinear(color);
    this.#walkLine(from, to, brushDiameter, (point) => {
      this.#paintLinearDab(point, sourceLinear, brushDiameter, normalizedStrength);
    });
  }

  blendLine(
    from: ColorMixingPointV1,
    to: ColorMixingPointV1,
    diameter: number,
    strength = 0.46,
  ): void {
    const brushDiameter = validateDiameter(diameter);
    const normalizedStrength = validateStrength(strength);
    this.#walkLine(from, to, brushDiameter, (point) => {
      const local = this.#localLinearAverage(point, Math.max(1, Math.min(5, brushDiameter / 5)));
      this.#paintLinearDab(point, local, brushDiameter, normalizedStrength);
    });
  }

  presentationRgba8(targetSpace: DocumentColorSpace = 'srgb'): Uint8ClampedArray {
    if (targetSpace === this.#workingSpace) return new Uint8ClampedArray(this.#pixels);
    const output = new Uint8ClampedArray(this.#pixels.length);
    for (let offset = 0; offset < this.#pixels.length; offset += 4) {
      const converted = convertEncodedRgbV1(
        freezeRgbUnitColorV1([
          byteToEncoded(this.#pixels[offset] ?? 255),
          byteToEncoded(this.#pixels[offset + 1] ?? 255),
          byteToEncoded(this.#pixels[offset + 2] ?? 255),
        ]),
        this.#workingSpace,
        targetSpace,
      );
      output[offset] = encodedToByte(converted[0]);
      output[offset + 1] = encodedToByte(converted[1]);
      output[offset + 2] = encodedToByte(converted[2]);
      output[offset + 3] = 255;
    }
    return output;
  }

  #walkLine(
    from: ColorMixingPointV1,
    to: ColorMixingPointV1,
    diameter: number,
    visit: (point: ColorMixingPointV1) => void,
  ): void {
    if (![from.x, from.y, to.x, to.y].every(Number.isFinite)) {
      throw new RangeError('mixing stroke coordinates must be finite');
    }
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const distance = Math.hypot(dx, dy);
    const stepLength = Math.max(1, diameter * 0.28);
    const steps = Math.max(1, Math.ceil(distance / stepLength));
    for (let step = 0; step <= steps; step += 1) {
      const t = step / steps;
      visit(Object.freeze({ x: from.x + dx * t, y: from.y + dy * t }));
    }
  }

  #paintLinearDab(
    point: ColorMixingPointV1,
    sourceLinear: LinearRgbV1,
    diameter: number,
    strength: number,
  ): void {
    const radius = diameter / 2;
    const minX = Math.max(0, Math.floor(point.x - radius));
    const maxX = Math.min(this.#width - 1, Math.ceil(point.x + radius));
    const minY = Math.max(0, Math.floor(point.y - radius));
    const maxY = Math.min(this.#height - 1, Math.ceil(point.y + radius));
    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const distance = Math.hypot(x + 0.5 - point.x, y + 0.5 - point.y);
        if (distance > radius) continue;
        const falloff = radius <= 0 ? 1 : 1 - distance / radius;
        const amount = clamp(strength * (0.2 + 0.8 * falloff), 0, 1);
        const offset = (y * this.#width + x) * 4;
        const targetLinear = encodedToLinear(
          freezeRgbUnitColorV1([
            byteToEncoded(this.#pixels[offset] ?? 255),
            byteToEncoded(this.#pixels[offset + 1] ?? 255),
            byteToEncoded(this.#pixels[offset + 2] ?? 255),
          ]),
        );
        const mixed = linearToEncoded(
          Object.freeze([
            targetLinear[0] + (sourceLinear[0] - targetLinear[0]) * amount,
            targetLinear[1] + (sourceLinear[1] - targetLinear[1]) * amount,
            targetLinear[2] + (sourceLinear[2] - targetLinear[2]) * amount,
          ]),
        );
        this.#pixels[offset] = encodedToByte(mixed[0]);
        this.#pixels[offset + 1] = encodedToByte(mixed[1]);
        this.#pixels[offset + 2] = encodedToByte(mixed[2]);
      }
    }
  }

  #localLinearAverage(point: ColorMixingPointV1, radius: number): LinearRgbV1 {
    const minX = Math.max(0, Math.floor(point.x - radius));
    const maxX = Math.min(this.#width - 1, Math.ceil(point.x + radius));
    const minY = Math.max(0, Math.floor(point.y - radius));
    const maxY = Math.min(this.#height - 1, Math.ceil(point.y + radius));
    let red = 0;
    let green = 0;
    let blue = 0;
    let count = 0;
    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const offset = (y * this.#width + x) * 4;
        red += decodeSrgbTransferComponentV1(byteToEncoded(this.#pixels[offset] ?? 255));
        green += decodeSrgbTransferComponentV1(byteToEncoded(this.#pixels[offset + 1] ?? 255));
        blue += decodeSrgbTransferComponentV1(byteToEncoded(this.#pixels[offset + 2] ?? 255));
        count += 1;
      }
    }
    const denominator = Math.max(1, count);
    return Object.freeze([red / denominator, green / denominator, blue / denominator]);
  }
}
