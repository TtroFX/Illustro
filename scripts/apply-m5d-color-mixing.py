from pathlib import Path


def write(path: str, content: str) -> None:
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content)


write('src/app/color-mixing-surface.ts', r'''import {
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
    throw new RangeError(`${label} must be a safe integer in 1..${MAX_MIXING_SURFACE_DIMENSION_V1}`);
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
''')

write('tests/unit/color-mixing-surface.test.ts', r'''import { describe, expect, it } from 'vitest';
import { ColorMixingSurfaceV1 } from '../../src/app/color-mixing-surface.js';
import { convertEncodedRgbV1 } from '../../src/domain/color-management.js';
import { freezeRgbUnitColorV1, rgbUnitToBytesV1 } from '../../src/domain/color.js';

function expectNearColor(actual: readonly number[], expected: readonly number[], tolerance = 2): void {
  const actualBytes = rgbUnitToBytesV1(freezeRgbUnitColorV1(actual));
  const expectedBytes = rgbUnitToBytesV1(freezeRgbUnitColorV1(expected));
  expect(Math.abs(actualBytes[0] - expectedBytes[0])).toBeLessThanOrEqual(tolerance);
  expect(Math.abs(actualBytes[1] - expectedBytes[1])).toBeLessThanOrEqual(tolerance);
  expect(Math.abs(actualBytes[2] - expectedBytes[2])).toBeLessThanOrEqual(tolerance);
}

describe('M5D Color Mixing Surface', () => {
  it('paints a bounded direct-manipulation stroke without touching unrelated pixels', () => {
    const surface = new ColorMixingSurfaceV1(16, 12, 'srgb');
    surface.paintLine({ x: 5, y: 6 }, { x: 11, y: 6 }, [1, 0, 0], 5, 1);

    const center = surface.sample(8, 6);
    expect(center[0]).toBeGreaterThan(0.95);
    expect(center[1]).toBeLessThan(0.1);
    expect(center[2]).toBeLessThan(0.1);
    expectNearColor(surface.sample(0, 0), [1, 1, 1], 0);
  });

  it('blends toward a local neighborhood while leaving distant pixels intact', () => {
    const surface = new ColorMixingSurfaceV1(20, 12, 'srgb');
    surface.paintLine({ x: 7, y: 6 }, { x: 7, y: 6 }, [1, 0, 0], 7, 1);
    surface.paintLine({ x: 13, y: 6 }, { x: 13, y: 6 }, [0, 0, 1], 7, 1);
    const before = surface.sample(10, 6);

    surface.blendLine({ x: 10, y: 6 }, { x: 10, y: 6 }, 9, 1);
    const after = surface.sample(10, 6);

    expect(after).not.toEqual(before);
    expect(after[0]).toBeGreaterThan(0.1);
    expect(after[2]).toBeGreaterThan(0.1);
    expectNearColor(surface.sample(0, 0), [1, 1, 1], 0);
  });

  it('restores exact bounded snapshots for workspace undo/redo', () => {
    const surface = new ColorMixingSurfaceV1(10, 10, 'srgb');
    surface.paintLine({ x: 5, y: 5 }, { x: 5, y: 5 }, [0.2, 0.4, 0.8], 6, 1);
    const snapshot = surface.snapshot();
    const expected = surface.sample(5, 5);

    surface.clear([0, 0, 0]);
    surface.restore(snapshot);

    expect(surface.workingSpace()).toBe('srgb');
    expect(surface.sample(5, 5)).toEqual(expected);
    expect(surface.snapshot().pixels).toEqual(snapshot.pixels);
  });

  it('converts the canonical mixing surface when document working space changes', () => {
    const surface = new ColorMixingSurfaceV1(4, 4, 'display-p3');
    surface.clear([1, 0, 0]);
    const expected = convertEncodedRgbV1([1, 0, 0], 'display-p3', 'srgb');

    surface.convertWorkingSpace('srgb');

    expect(surface.workingSpace()).toBe('srgb');
    expectNearColor(surface.sample(2, 2), expected, 1);
  });

  it('converts only presentation bytes when a P3 surface is shown through an sRGB UI canvas', () => {
    const surface = new ColorMixingSurfaceV1(2, 1, 'display-p3');
    surface.clear([1, 0, 0]);
    const expected = rgbUnitToBytesV1(convertEncodedRgbV1([1, 0, 0], 'display-p3', 'srgb'));

    const presentation = surface.presentationRgba8('srgb');

    expect([...presentation.slice(0, 4)]).toEqual([expected[0], expected[1], expected[2], 255]);
    expectNearColor(surface.sample(0, 0), [1, 0, 0], 0);
    expect(surface.workingSpace()).toBe('display-p3');
  });
});
''')

# Reachable Color Mixing Palette UI.
path = Path('src/index.html')
text = path.read_text()
anchor = '''            </details>
          </section>
          <section class="shell-inspector-card shell-reference-panel" aria-label="Reference / Sub View">'''
replacement = '''            </details>
            <details class="shell-color-mixing">
              <summary>色混ぜ</summary>
              <div class="shell-color-mixing-body">
                <canvas id="color-mixing-canvas" width="192" height="112" aria-label="色混ぜパレット。ブラシ、混色、スポイトで操作"></canvas>
                <div id="color-mixing-colors" class="shell-color-mixing-colors" aria-label="色混ぜ用クイックカラー"></div>
                <fieldset class="shell-color-mixing-tools" aria-label="色混ぜツール">
                  <button id="color-mixing-brush" type="button" aria-pressed="true">ブラシ</button>
                  <button id="color-mixing-blend" type="button" aria-pressed="false">混色</button>
                  <button id="color-mixing-eyedropper" type="button" aria-pressed="false">採色</button>
                </fieldset>
                <label class="shell-color-mixing-size">サイズ <input id="color-mixing-size" type="range" min="4" max="40" step="1" value="16" /><output id="color-mixing-size-value">16</output></label>
                <div class="shell-color-mixing-history">
                  <button id="color-mixing-undo" type="button" disabled>戻す</button>
                  <button id="color-mixing-redo" type="button" disabled>進む</button>
                  <button id="color-mixing-clear" type="button">クリア</button>
                </div>
              </div>
            </details>
          </section>
          <section class="shell-inspector-card shell-reference-panel" aria-label="Reference / Sub View">'''
if anchor not in text:
    if 'id="color-mixing-canvas"' not in text:
        raise SystemExit('color mixing HTML anchor missing')
else:
    text = text.replace(anchor, replacement, 1)
path.write_text(text)

# Color panel styling follows existing compact progressive-disclosure language.
path = Path('public/app-shell.css')
text = path.read_text()
anchor = '''/* M5D reference sampling */'''
block = r'''/* M5D color mixing palette */
.shell-color-mixing {
  border: 1px solid #e3e8f1;
  border-radius: 9px;
  background: #fbfcff;
}

.shell-color-mixing > summary {
  min-height: 30px;
  padding: 7px 9px;
  cursor: pointer;
  color: #536079;
  font-size: 10px;
  font-weight: 760;
  list-style-position: inside;
}

.shell-color-mixing-body {
  display: grid;
  gap: 7px;
  padding: 0 8px 8px;
}

#color-mixing-canvas {
  width: 100%;
  max-width: 100%;
  aspect-ratio: 12 / 7;
  border: 1px solid #dfe5ef;
  border-radius: 8px;
  background: #fff;
  cursor: crosshair;
  touch-action: none;
}

.shell-color-mixing-colors {
  display: flex;
  gap: 5px;
  min-height: 30px;
  overflow-x: auto;
  padding: 2px 1px;
  scrollbar-width: thin;
}

.shell-color-mixing-colors button {
  flex: 0 0 28px;
  width: 28px;
  min-height: 28px;
  border: 1px solid #dfe5ef;
  border-radius: 7px;
  padding: 0;
  box-shadow: inset 0 0 0 1px #fff;
  cursor: pointer;
}

.shell-color-mixing-tools {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 5px;
  min-inline-size: 0;
  margin: 0;
  border: 0;
  padding: 0;
}

.shell-color-mixing-tools button,
.shell-color-mixing-history button {
  min-width: 0;
  min-height: 36px;
  border: 1px solid #dfe5ef;
  border-radius: 8px;
  background: #fff;
  color: #38445d;
  font: inherit;
  font-size: 10px;
  cursor: pointer;
}

.shell-color-mixing-tools button[aria-pressed='true'] {
  border-color: #a48af4;
  background: rgb(139 92 246 / 10%);
  color: #6542c6;
  box-shadow: inset 0 0 0 1px rgb(139 92 246 / 24%);
}

.shell-color-mixing-size {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) 2.2rem;
  align-items: center;
  gap: 6px;
  color: #667085;
  font-size: 10px;
}

.shell-color-mixing-size input {
  width: 100%;
  min-height: 32px;
}

.shell-color-mixing-size output {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.shell-color-mixing-history {
  display: grid;
  grid-template-columns: 1fr 1fr 1.2fr;
  gap: 5px;
}

.shell-color-mixing-history button:disabled {
  cursor: default;
  opacity: 0.35;
}

@media (pointer: coarse) {
  .shell-color-mixing-tools button,
  .shell-color-mixing-history button {
    min-height: 44px;
  }
}

'''
if block.strip() not in text:
    if anchor not in text:
        raise SystemExit('color mixing CSS anchor missing')
    text = text.replace(anchor, block + anchor, 1)
path.write_text(text)

# Wire the mixing surface into the existing Color Workspace controller.
path = Path('src/app/color-workflow-controller.ts')
text = path.read_text()
old = "import type { PaintSessionControllerV1 } from './paint-session-controller.js';\n"
new = """import type { PaintSessionControllerV1 } from './paint-session-controller.js';
import {
  ColorMixingSurfaceV1,
  type ColorMixingPointV1,
  type ColorMixingSurfaceSnapshotV1,
  type ColorMixingToolV1,
} from './color-mixing-surface.js';
"""
if old in text:
    text = text.replace(old, new, 1)
elif "from './color-mixing-surface.js';" not in text:
    raise SystemExit('color mixing controller import anchor missing')

old = """  const paletteFile = requireElement('#color-palette-file', HTMLInputElement);
  const redInput = requireElement('#color-r', HTMLInputElement);"""
new = """  const paletteFile = requireElement('#color-palette-file', HTMLInputElement);
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
  const redInput = requireElement('#color-r', HTMLInputElement);"""
if old in text:
    text = text.replace(old, new, 1)
elif "#color-mixing-canvas" not in text:
    raise SystemExit('color mixing DOM anchor missing')

old = """  let samplingRequestSequence = 0;

  const workingSpace = () => input.paintSession.currentDocument()?.color.workingSpace ?? 'srgb';
  const persist = (): void => {"""
new = """  let samplingRequestSequence = 0;
  let mixingTool: ColorMixingToolV1 = 'brush';
  let mixingLastPoint: ColorMixingPointV1 | null = null;
  let mixingGestureStart: ColorMixingSurfaceSnapshotV1 | null = null;
  let mixingUndoStack: ColorMixingSurfaceSnapshotV1[] = [];
  let mixingRedoStack: ColorMixingSurfaceSnapshotV1[] = [];

  const workingSpace = () => input.paintSession.currentDocument()?.color.workingSpace ?? 'srgb';
  const mixingSurface = new ColorMixingSurfaceV1(
    mixingCanvas.width,
    mixingCanvas.height,
    workingSpace(),
  );
  const persist = (): void => {"""
if old in text:
    text = text.replace(old, new, 1)
elif 'let mixingTool:' not in text:
    raise SystemExit('color mixing state anchor missing')

old = """  const publish = (redrawSv = true): void => {
    const rgbBytes = rgbUnitToBytesV1(state.current);"""
new = """  const publish = (redrawSv = true): void => {
    if (mixingSurface.workingSpace() !== workingSpace()) {
      mixingSurface.convertWorkingSpace(workingSpace());
      mixingUndoStack = [];
      mixingRedoStack = [];
    }
    const rgbBytes = rgbUnitToBytesV1(state.current);"""
if old in text:
    text = text.replace(old, new, 1)
elif 'mixingSurface.workingSpace() !== workingSpace()' not in text:
    raise SystemExit('color mixing publish sync anchor missing')

old = """    input.root.dataset.illustroColorWorkingSpace = workingSpace();
    publishSamplingState();
  };

  function publishSamplingState(): void {"""
new = """    input.root.dataset.illustroColorWorkingSpace = workingSpace();
    publishSamplingState();
    publishMixingState(activePalette.colors);
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

  function publishSamplingState(): void {"""
if old in text:
    text = text.replace(old, new, 1)
elif 'function renderMixingSurface()' not in text:
    raise SystemExit('color mixing publish helper anchor missing')

# Insert interaction logic immediately before palette handlers.
old = """  const paletteUpdate = (next: ColorWorkspaceStateV1, message: string): void => {
    state = next;"""
new = """  const MIXING_HISTORY_LIMIT = 12;
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

  const paletteUpdate = (next: ColorWorkspaceStateV1, message: string): void => {
    state = next;"""
if old in text:
    text = text.replace(old, new, 1)
elif 'const MIXING_HISTORY_LIMIT = 12;' not in text:
    raise SystemExit('color mixing interaction anchor missing')

old = """  paletteExport.addEventListener('click', onPaletteExport);
  eyedropper.addEventListener('click', onEyedropperToggle);"""
new = """  paletteExport.addEventListener('click', onPaletteExport);
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
  eyedropper.addEventListener('click', onEyedropperToggle);"""
if old in text:
    text = text.replace(old, new, 1)
elif "mixingCanvas.addEventListener('pointerdown'" not in text:
    raise SystemExit('color mixing event registration anchor missing')

old = """      paletteExport.removeEventListener('click', onPaletteExport);
      eyedropper.removeEventListener('click', onEyedropperToggle);"""
new = """      paletteExport.removeEventListener('click', onPaletteExport);
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
      eyedropper.removeEventListener('click', onEyedropperToggle);"""
if old in text:
    text = text.replace(old, new, 1)
elif "mixingCanvas.removeEventListener('pointerdown'" not in text:
    raise SystemExit('color mixing dispose anchor missing')
path.write_text(text)

# Extend the M5D contract inspection with production wiring, not only helper existence.
path = Path('scripts/verify-m5d-color.mjs')
text = path.read_text()
insert_after = "requireText('src/domain/color.ts', ['rgbToHsvV1', 'hsvToRgbV1', 'parseHexRgbV1', 'formatHexRgbV1']);\n"
block = """requireText('src/app/color-mixing-surface.ts', [
  'ColorMixingSurfaceV1',
  'paintLine(',
  'blendLine(',
  'presentationRgba8(',
  'convertWorkingSpace(',
]);
"""
if block not in text:
    if insert_after not in text:
        raise SystemExit('verify M5D color mixing module anchor missing')
    text = text.replace(insert_after, insert_after + block, 1)
old = """  '#color-palette-export',
  'setPaintColor',
]);"""
new = """  '#color-palette-export',
  '#color-mixing-canvas',
  '#color-mixing-brush',
  '#color-mixing-blend',
  '#color-mixing-eyedropper',
  'mixingSurface.paintLine',
  'mixingSurface.blendLine',
  'setPaintColor',
]);"""
if old in text:
    text = text.replace(old, new, 1)
elif "'#color-mixing-canvas'" not in text:
    raise SystemExit('verify M5D controller anchor missing')
old = """  'id=\"color-palette-export\"',
]);"""
new = """  'id=\"color-palette-export\"',
  'id=\"color-mixing-canvas\"',
  'id=\"color-mixing-brush\"',
  'id=\"color-mixing-blend\"',
  'id=\"color-mixing-eyedropper\"',
  'id=\"color-mixing-undo\"',
  'id=\"color-mixing-redo\"',
  'id=\"color-mixing-clear\"',
]);"""
if old in text:
    text = text.replace(old, new, 1)
elif "'id=\"color-mixing-canvas\"'" not in text:
    raise SystemExit('verify M5D HTML anchor missing')
text = text.replace("  'M5D-026 Color Mixing Palette:未完了',", "  'M5D-026 Color Mixing Palette:完了',")
path.write_text(text)

# Progress truth: only M5D-026 closes in this unit.
path = Path('IMPLEMENTATION_PROGRESS.md')
text = path.read_text()
old = 'M5D-026 Color Mixing Palette:未完了'
if old in text:
    text = text.replace(old, 'M5D-026 Color Mixing Palette:完了', 1)
elif 'M5D-026 Color Mixing Palette:完了' not in text:
    raise SystemExit('M5D-026 progress anchor missing')
path.write_text(text)

# Record the semantic boundary so later work does not turn the mixer into document state.
path = Path('ILLUSTRO_DESIGN_MEMO.md')
text = path.read_text()
marker = '#### M5D Color Mixing Palette semantic boundary — 2026-09-02'
if marker not in text:
    text += r'''

#### M5D Color Mixing Palette semantic boundary — 2026-09-02

- M5D-026 provides a reachable **Color Mixing Palette** inside the existing Color inspector through progressive disclosure. It is a dedicated digital mixing workspace inspired by established illustration-editor workflows: Brush lays down the current Color Workspace color, Blend locally mixes colors already on the mixing surface, and Eyedropper commits a sampled mixing-surface color through the same canonical current/previous/history path used by the normal color picker.
- The mixing surface is **workspace/presentation state, not document or layer image state**. Painting, blending, clearing and mixer Undo/Redo never create document history transactions, mutate canonical Raster Tiles, alter layer data or participate in PNG/native output. Mixer Undo/Redo is separately bounded to 12 snapshots so repeated experimentation cannot grow without bound.
- The initial canonical mixer surface is a compact opaque RGBA8 encoded-RGB buffer. Brush and Blend touch only their bounded brush footprints; ordinary pointer movement never scans or rerenders the document. Blend uses a bounded local neighborhood average plus soft dab application rather than a full-surface blur, keeping work proportional to the local tool footprint.
- Mixer interpolation is performed through the shared sRGB-style transfer decode/encode used by the current sRGB and Display-P3 document spaces. This is a **digital color-mixing helper**, not a physical pigment/Kubelka-Munk simulation; no claim of real-media spectral mixing is made.
- Mixer pixels are interpreted in the active document working space. Switching between sRGB and Display-P3 converts the small mixing buffer through the centralized M5D profile-aware conversion service and clears mixer-local history. The Color UI canvas remains an sRGB presentation surface in this implementation, so Display-P3 mixer pixels are converted only for presentation; the mixer's canonical encoded values are not silently reinterpreted.
- Pointer Events provide direct manipulation for mouse, Pen and Touch. A canceled pointer gesture restores its pre-gesture mixer snapshot and creates no mixer-history entry. Coarse-pointer buttons preserve the adopted 44 CSS px touch target minimum.
- The compact quick-color row is derived from current color, previous color and the active named palette. It creates no second palette database and therefore preserves the M5D-008 through M5D-015 named-palette semantic boundary.
'''
path.write_text(text)
