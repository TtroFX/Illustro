import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function write(path, content) {
  fs.writeFileSync(path, content, 'utf8');
}

function replaceOnce(path, before, after) {
  const source = read(path);
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${path}: expected exactly one replacement, found ${count}`);
  write(path, source.replace(before, after));
}

function insertBefore(path, marker, block) {
  replaceOnce(path, marker, `${block.trimEnd()}\n${marker}`);
}

function appendOnce(path, marker, block) {
  const source = read(path);
  if (source.includes(marker)) return;
  write(path, `${source.trimEnd()}\n\n${block.trim()}\n`);
}

function writeNew(path, content) {
  if (fs.existsSync(path)) throw new Error(`${path}: already exists`);
  write(path, `${content.trim()}\n`);
}

writeNew(
  'src/app/custom-brush-tip.ts',
  `export const CUSTOM_BRUSH_TIP_SIDE_V1 = 5 as const;
export const CUSTOM_BRUSH_TIP_PIXEL_COUNT_V1 = CUSTOM_BRUSH_TIP_SIDE_V1 * CUSTOM_BRUSH_TIP_SIDE_V1;
const MAX_CUSTOM_BRUSH_TIP_FILE_BYTES_V1 = 16 * 1024 * 1024;

function byte(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0 || value > 255) {
    throw new RangeError(label + ' must be within 0..255');
  }
  return Math.round(value);
}

export function customBrushTipAlphaFromRgbaV1(rgba: ArrayLike<number>): readonly number[] {
  if (rgba.length !== CUSTOM_BRUSH_TIP_PIXEL_COUNT_V1 * 4) {
    throw new RangeError('custom brush tip RGBA input must be exactly 5x5');
  }
  const result: number[] = [];
  for (let index = 0; index < CUSTOM_BRUSH_TIP_PIXEL_COUNT_V1; index += 1) {
    const offset = index * 4;
    const red = byte(Number(rgba[offset]), 'custom tip red');
    const green = byte(Number(rgba[offset + 1]), 'custom tip green');
    const blue = byte(Number(rgba[offset + 2]), 'custom tip blue');
    const alpha = byte(Number(rgba[offset + 3]), 'custom tip alpha');
    const luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722;
    result.push(Math.round((alpha * (255 - luminance)) / 255));
  }
  if (!result.some((value) => value > 0)) {
    throw new RangeError('custom brush tip image has no drawable dark coverage');
  }
  return Object.freeze(result);
}

export async function customBrushTipAlphaFromFileV1(file: File): Promise<readonly number[]> {
  if (!file.type.startsWith('image/')) throw new TypeError('custom brush tip requires an image file');
  if (file.size > MAX_CUSTOM_BRUSH_TIP_FILE_BYTES_V1) {
    throw new RangeError('custom brush tip image must be 16 MiB or smaller');
  }
  const bitmap = await createImageBitmap(file);
  try {
    if (bitmap.width < 1 || bitmap.height < 1) throw new RangeError('custom brush tip image is empty');
    const canvas = document.createElement('canvas');
    canvas.width = CUSTOM_BRUSH_TIP_SIDE_V1;
    canvas.height = CUSTOM_BRUSH_TIP_SIDE_V1;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (context === null) throw new Error('custom brush tip image decoder is unavailable');
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    const sourceSide = Math.min(bitmap.width, bitmap.height);
    const sourceX = (bitmap.width - sourceSide) / 2;
    const sourceY = (bitmap.height - sourceSide) / 2;
    context.drawImage(
      bitmap,
      sourceX,
      sourceY,
      sourceSide,
      sourceSide,
      0,
      0,
      CUSTOM_BRUSH_TIP_SIDE_V1,
      CUSTOM_BRUSH_TIP_SIDE_V1,
    );
    return customBrushTipAlphaFromRgbaV1(
      context.getImageData(0, 0, CUSTOM_BRUSH_TIP_SIDE_V1, CUSTOM_BRUSH_TIP_SIDE_V1).data,
    );
  } finally {
    bitmap.close();
  }
}

export function drawCustomBrushTipPreviewV1(
  canvas: HTMLCanvasElement,
  alpha: readonly number[] | null,
): void {
  canvas.width = CUSTOM_BRUSH_TIP_SIDE_V1;
  canvas.height = CUSTOM_BRUSH_TIP_SIDE_V1;
  const context = canvas.getContext('2d');
  if (context === null) return;
  context.clearRect(0, 0, canvas.width, canvas.height);
  if (alpha === null) return;
  if (alpha.length !== CUSTOM_BRUSH_TIP_PIXEL_COUNT_V1) {
    throw new RangeError('custom brush tip preview requires exactly 25 alpha values');
  }
  const image = context.createImageData(CUSTOM_BRUSH_TIP_SIDE_V1, CUSTOM_BRUSH_TIP_SIDE_V1);
  for (let index = 0; index < alpha.length; index += 1) {
    const offset = index * 4;
    image.data[offset] = 0;
    image.data[offset + 1] = 0;
    image.data[offset + 2] = 0;
    image.data[offset + 3] = byte(alpha[index] ?? 0, 'custom tip preview alpha');
  }
  context.putImageData(image, 0, 0);
}
`,
);

replaceOnce(
  'src/domain/brush-schema.ts',
  `export type BrushTipShapeV1 = BrushProceduralTipShapeV1 | 'sampled-image';
export const BUILTIN_SAMPLED_IMAGE_BRUSH_TIP_ID_V1 = 'builtin.sampled-tip.ink-v1' as const;
`,
  `export type BrushTipShapeV1 = BrushProceduralTipShapeV1 | 'sampled-image';
export const BUILTIN_SAMPLED_IMAGE_BRUSH_TIP_ID_V1 = 'builtin.sampled-tip.ink-v1' as const;
export const CUSTOM_SAMPLED_IMAGE_BRUSH_TIP_SIDE_V1 = 5 as const;
export const CUSTOM_SAMPLED_IMAGE_BRUSH_TIP_PIXEL_COUNT_V1 =
  CUSTOM_SAMPLED_IMAGE_BRUSH_TIP_SIDE_V1 * CUSTOM_SAMPLED_IMAGE_BRUSH_TIP_SIDE_V1;
export type BrushSampledTipAlphaV1 = readonly number[];
`,
);

insertBefore(
  'src/domain/brush-schema.ts',
  `export function brushProceduralTipShapeV1(preset: BrushPresetV1): BrushProceduralTipShapeV1 {`,
  `function brushTipBaseV1(tip: BrushPresetSectionV1): BrushPresetSectionV1 {
  const copy: Record<string, JsonValue> = { ...tip };
  delete copy.kind;
  delete copy.sampleId;
  delete copy.side;
  delete copy.alpha;
  return Object.freeze(copy);
}

function freezeCustomSampledTipAlphaV1(value: unknown): BrushSampledTipAlphaV1 {
  if (!Array.isArray(value) || value.length !== CUSTOM_SAMPLED_IMAGE_BRUSH_TIP_PIXEL_COUNT_V1) {
    throw new RangeError('custom sampled brush tip requires exactly 25 alpha values');
  }
  const alpha = value.map((entry) => {
    if (typeof entry !== 'number' || !Number.isInteger(entry) || entry < 0 || entry > 255) {
      throw new RangeError('custom sampled brush tip alpha values must be integer bytes');
    }
    return entry;
  });
  if (!alpha.some((entry) => entry > 0)) {
    throw new RangeError('custom sampled brush tip cannot be fully transparent');
  }
  return Object.freeze(alpha);
}

export function brushSampledTipAlphaV1(preset: BrushPresetV1): BrushSampledTipAlphaV1 | null {
  if (preset.tip.kind !== 'sampled-image-custom') return null;
  if (preset.tip.side !== CUSTOM_SAMPLED_IMAGE_BRUSH_TIP_SIDE_V1) {
    throw new RangeError('unsupported custom sampled brush tip side');
  }
  return freezeCustomSampledTipAlphaV1(preset.tip.alpha);
}
`,
);

replaceOnce(
  'src/domain/brush-schema.ts',
  `    tip: { ...preset.tip, kind: shape === 'square' ? 'procedural-square' : 'procedural-round' },`,
  `    tip: {
      ...brushTipBaseV1(preset.tip),
      kind: shape === 'square' ? 'procedural-square' : 'procedural-round',
    },`,
);

replaceOnce(
  'src/domain/brush-schema.ts',
  `export function brushTipShapeV1(preset: BrushPresetV1): BrushTipShapeV1 {
  if (preset.tip.kind === 'sampled-image') {`,
  `export function brushTipShapeV1(preset: BrushPresetV1): BrushTipShapeV1 {
  if (preset.tip.kind === 'sampled-image-custom') {
    brushSampledTipAlphaV1(preset);
    return 'sampled-image';
  }
  if (preset.tip.kind === 'sampled-image') {`,
);

replaceOnce(
  'src/domain/brush-schema.ts',
  `      ...preset.tip,
      kind: 'sampled-image',`,
  `      ...brushTipBaseV1(preset.tip),
      kind: 'sampled-image',`,
);

insertBefore(
  'src/domain/brush-schema.ts',
  `export interface BrushPresetV1 {`,
  `export function withBrushCustomSampledTipV1(
  preset: BrushPresetV1,
  alpha: readonly number[],
): BrushPresetV1 {
  const normalizedAlpha = freezeCustomSampledTipAlphaV1(alpha);
  return normalizeBrushPresetV1({
    ...preset,
    tip: {
      ...brushTipBaseV1(preset.tip),
      kind: 'sampled-image-custom',
      side: CUSTOM_SAMPLED_IMAGE_BRUSH_TIP_SIDE_V1,
      alpha: [...normalizedAlpha],
    },
  });
}
`,
);

replaceOnce(
  'src/domain/brush-schema.ts',
  `  const tags = Object.freeze(
    [...new Set(input.tags.map((tag) => normalizedText(tag, 'brush tag', 80)))].slice(0, 64),
  );
  return Object.freeze({`,
  `  const tags = Object.freeze(
    [...new Set(input.tags.map((tag) => normalizedText(tag, 'brush tag', 80)))].slice(0, 64),
  );
  const tip = normalizeSection(input.tip, 'brush tip');
  if (tip.kind === 'sampled-image-custom') {
    if (tip.side !== CUSTOM_SAMPLED_IMAGE_BRUSH_TIP_SIDE_V1) {
      throw new RangeError('unsupported custom sampled brush tip side');
    }
    freezeCustomSampledTipAlphaV1(tip.alpha);
  }
  return Object.freeze({`,
);
replaceOnce(
  'src/domain/brush-schema.ts',
  `    tip: normalizeSection(input.tip, 'brush tip'),`,
  `    tip,`,
);

insertBefore(
  'src/gpu/baseline-brush.ts',
  `export type BaselineBrushCompositeOperationV1 = 'paint' | 'erase' | 'smudge' | 'blur';`,
  `export type BaselineBrushSampledTipAlphaV1 = readonly number[];

export function freezeBaselineBrushSampledTipAlphaV1(
  alpha: readonly number[],
): BaselineBrushSampledTipAlphaV1 {
  if (alpha.length !== BASELINE_SAMPLED_IMAGE_TIP_SIDE_V1 * BASELINE_SAMPLED_IMAGE_TIP_SIDE_V1) {
    throw new RangeError('sampled brush tip requires exactly 25 alpha values');
  }
  const normalized = alpha.map((value) => {
    if (!Number.isInteger(value) || value < 0 || value > 255) {
      throw new RangeError('sampled brush tip alpha values must be integer bytes');
    }
    return value;
  });
  if (!normalized.some((value) => value > 0)) {
    throw new RangeError('sampled brush tip cannot be fully transparent');
  }
  return Object.freeze(normalized);
}
`,
);

replaceOnce(
  'src/gpu/baseline-brush.ts',
  `  color: BaselineBrushColorV1,
  tipShape: BaselineBrushTipShapeV1,
): void {`,
  `  color: BaselineBrushColorV1,
  tipShape: BaselineBrushTipShapeV1,
  sampledTipAlpha: BaselineBrushSampledTipAlphaV1,
): void {`,
);
replaceOnce(
  'src/gpu/baseline-brush.ts',
  `  const side = BASELINE_SAMPLED_IMAGE_TIP_SIDE_V1;
  const microRadius = (radius / side) * 1.1;`,
  `  const side = BASELINE_SAMPLED_IMAGE_TIP_SIDE_V1;
  const alphaImage = sampledTipAlpha;
  const microRadius = (radius / side) * 1.1;`,
);
replaceOnce(
  'src/gpu/baseline-brush.ts',
  `    const alphaByte = BASELINE_SAMPLED_IMAGE_TIP_ALPHA_V1[index] ?? 0;`,
  `    const alphaByte = alphaImage[index] ?? 0;`,
);
replaceOnce(
  'src/gpu/baseline-brush.ts',
  `  for (let index = 0; index < BASELINE_SAMPLED_IMAGE_TIP_ALPHA_V1.length; index += 1) {`,
  `  for (let index = 0; index < alphaImage.length; index += 1) {`,
);
replaceOnce(
  'src/gpu/baseline-brush.ts',
  `  readonly #tipShape: BaselineBrushTipShapeV1;
  #lastPoint: { x: number; y: number } | null = null;`,
  `  readonly #tipShape: BaselineBrushTipShapeV1;
  readonly #sampledTipAlpha: BaselineBrushSampledTipAlphaV1;
  #lastPoint: { x: number; y: number } | null = null;
  #lastStampPoint: { x: number; y: number } | null = null;`,
);
replaceOnce(
  'src/gpu/baseline-brush.ts',
  `      readonly tipShape?: BaselineBrushTipShapeV1;
    } = {},`,
  `      readonly tipShape?: BaselineBrushTipShapeV1;
      readonly sampledTipAlpha?: readonly number[];
    } = {},`,
);
replaceOnce(
  'src/gpu/baseline-brush.ts',
  `    if (
      this.#tipShape !== 'round' &&
      this.#tipShape !== 'square' &&
      this.#tipShape !== 'sampled-image'
    ) {
      throw new TypeError('unsupported baseline brush tip shape');
    }
    this.#distanceUntilNext = this.#spacing;`,
  `    if (
      this.#tipShape !== 'round' &&
      this.#tipShape !== 'square' &&
      this.#tipShape !== 'sampled-image'
    ) {
      throw new TypeError('unsupported baseline brush tip shape');
    }
    this.#sampledTipAlpha = freezeBaselineBrushSampledTipAlphaV1(
      options.sampledTipAlpha ?? BASELINE_SAMPLED_IMAGE_TIP_ALPHA_V1,
    );
    this.#distanceUntilNext = this.#spacing;`,
);
replaceOnce(
  'src/gpu/baseline-brush.ts',
  `      this.#color,
      this.#tipShape,
    );
    this.#distanceUntilNext = this.#spacing;`,
  `      this.#color,
      this.#tipShape,
      this.#sampledTipAlpha,
    );
    this.#lastStampPoint = { x: sample.documentX, y: sample.documentY };
    this.#distanceUntilNext = this.#spacing;`,
);
replaceOnce(
  'src/gpu/baseline-brush.ts',
  `    const lastPoint = this.#lastPoint;
    const lastDab = this.#dabs.at(-1);
    if (lastPoint !== null && lastDab !== undefined) {
      const distance = Math.hypot(lastPoint.x - lastDab.x, lastPoint.y - lastDab.y);`,
  `    const lastPoint = this.#lastPoint;
    const lastStampPoint = this.#lastStampPoint;
    if (lastPoint !== null && lastStampPoint !== null) {
      const distance = Math.hypot(lastPoint.x - lastStampPoint.x, lastPoint.y - lastStampPoint.y);`,
);
replaceOnce(
  'src/gpu/baseline-brush.ts',
  `          this.#color,
          this.#tipShape,
        );`,
  `          this.#color,
          this.#tipShape,
          this.#sampledTipAlpha,
        );`,
);
replaceOnce(
  'src/gpu/baseline-brush.ts',
  `        this.#color,
        this.#tipShape,
      );
      remaining = Math.hypot(x - cursorX, y - cursorY);`,
  `        this.#color,
        this.#tipShape,
        this.#sampledTipAlpha,
      );
      this.#lastStampPoint = { x: cursorX, y: cursorY };
      remaining = Math.hypot(x - cursorX, y - cursorY);`,
);

replaceOnce(
  'src/app/canonical-raster-brush.ts',
  `  type BaselineBrushDabV1,
  type BaselineBrushTipShapeV1,`,
  `  type BaselineBrushDabV1,
  type BaselineBrushSampledTipAlphaV1,
  type BaselineBrushTipShapeV1,`,
);
replaceOnce(
  'src/app/canonical-raster-brush.ts',
  `      readonly tipShape?: BaselineBrushTipShapeV1;
    } = {},`,
  `      readonly tipShape?: BaselineBrushTipShapeV1;
      readonly sampledTipAlpha?: BaselineBrushSampledTipAlphaV1;
    } = {},`,
);
replaceOnce(
  'src/app/canonical-raster-brush.ts',
  `      ...(options.tipShape === undefined ? {} : { tipShape: options.tipShape }),
    });`,
  `      ...(options.tipShape === undefined ? {} : { tipShape: options.tipShape }),
      ...(options.sampledTipAlpha === undefined
        ? {}
        : { sampledTipAlpha: options.sampledTipAlpha }),
    });`,
);

replaceOnce(
  'src/app/paint-session-controller.ts',
  `  DEFAULT_BASELINE_BRUSH_COLOR_V1,
  freezeBaselineBrushColorV1,`,
  `  DEFAULT_BASELINE_BRUSH_COLOR_V1,
  freezeBaselineBrushColorV1,
  freezeBaselineBrushSampledTipAlphaV1,`,
);
replaceOnce(
  'src/app/paint-session-controller.ts',
  `  type BaselineBrushDabV1,
  type BaselineBrushTipShapeV1,`,
  `  type BaselineBrushDabV1,
  type BaselineBrushSampledTipAlphaV1,
  type BaselineBrushTipShapeV1,`,
);
replaceOnce(
  'src/app/paint-session-controller.ts',
  `  readonly brushParameters: BrushParameterValuesV1;
  readonly brushTipShape: BaselineBrushTipShapeV1;`,
  `  readonly brushParameters: BrushParameterValuesV1;
  readonly brushTipShape: BaselineBrushTipShapeV1;
  readonly brushSampledTipAlpha: BaselineBrushSampledTipAlphaV1 | null;`,
);
insertBefore(
  'src/app/paint-session-controller.ts',
  `function parseStoredStrokeSample(value: unknown): PaintStrokeSampleV1 {`,
  `function equalSampledTipAlphaV1(
  left: BaselineBrushSampledTipAlphaV1 | null,
  right: BaselineBrushSampledTipAlphaV1 | null,
): boolean {
  if (left === right) return true;
  if (left === null || right === null || left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}
`,
);
replaceOnce(
  'src/app/paint-session-controller.ts',
  `  #brushParameters: BrushParameterValuesV1 = DEFAULT_BRUSH_PARAMETER_VALUES_V1;
  #brushTipShape: BaselineBrushTipShapeV1 = 'round';`,
  `  #brushParameters: BrushParameterValuesV1 = DEFAULT_BRUSH_PARAMETER_VALUES_V1;
  #brushTipShape: BaselineBrushTipShapeV1 = 'round';
  #brushSampledTipAlpha: BaselineBrushSampledTipAlphaV1 | null = null;`,
);
replaceOnce(
  'src/app/paint-session-controller.ts',
  `      brushParameters: this.#brushParameters,
      brushTipShape: this.#brushTipShape,`,
  `      brushParameters: this.#brushParameters,
      brushTipShape: this.#brushTipShape,
      brushSampledTipAlpha: this.#brushSampledTipAlpha,`,
);
replaceOnce(
  'src/app/paint-session-controller.ts',
  `  setBrushTipShape(shape: BaselineBrushTipShapeV1): BaselineBrushTipShapeV1 {
    if (shape !== 'round' && shape !== 'square' && shape !== 'sampled-image')
      throw new TypeError('unsupported runtime brush tip shape');
    if (shape !== this.#brushTipShape) this.#clearActiveStroke();
    this.#brushTipShape = shape;
    return this.#brushTipShape;
  }`,
  `  setBrushTipShape(
    shape: BaselineBrushTipShapeV1,
    sampledTipAlpha?: readonly number[],
  ): BaselineBrushTipShapeV1 {
    if (shape !== 'round' && shape !== 'square' && shape !== 'sampled-image') {
      throw new TypeError('unsupported runtime brush tip shape');
    }
    const nextSampledTipAlpha =
      shape === 'sampled-image' && sampledTipAlpha !== undefined
        ? freezeBaselineBrushSampledTipAlphaV1(sampledTipAlpha)
        : null;
    if (
      shape !== this.#brushTipShape ||
      !equalSampledTipAlphaV1(nextSampledTipAlpha, this.#brushSampledTipAlpha)
    ) {
      this.#clearActiveStroke();
    }
    this.#brushTipShape = shape;
    this.#brushSampledTipAlpha = nextSampledTipAlpha;
    return this.#brushTipShape;
  }`,
);
replaceOnce(
  'src/app/paint-session-controller.ts',
  `      flow: parameters.flow,
      tipShape: this.#brushTipShape,
    });`,
  `      flow: parameters.flow,
      tipShape: this.#brushTipShape,
      ...(this.#brushSampledTipAlpha === null
        ? {}
        : { sampledTipAlpha: this.#brushSampledTipAlpha }),
    });`,
);

replaceOnce(
  'src/app/brush-preset-library.ts',
  `  withBrushParameterValuesV1,
  withBrushProceduralTipShapeV1,
  withBrushTipShapeV1,`,
  `  withBrushCustomSampledTipV1,
  withBrushParameterValuesV1,
  withBrushProceduralTipShapeV1,
  withBrushTipShapeV1,`,
);
replaceOnce(
  'src/app/brush-preset-library.ts',
  `  type BrushParameterValuesV1,
  type BrushProceduralTipShapeV1,`,
  `  type BrushParameterValuesV1,
  type BrushProceduralTipShapeV1,
  type BrushSampledTipAlphaV1,`,
);
insertBefore(
  'src/app/brush-preset-library.ts',
  `export function deleteBrushPresetV1(`,
  `export function updateBrushPresetCustomTipV1(
  state: BrushPresetLibraryStateV1,
  presetId: string,
  alpha: BrushSampledTipAlphaV1,
): BrushPresetLibraryStateV1 {
  return updateItemV1(state, presetId, (item) => {
    if (item.locked) throw new Error('locked brush preset cannot be edited');
    const current = withBrushCustomSampledTipV1(item.preset, alpha);
    if (JSON.stringify(current) === JSON.stringify(item.preset)) return item;
    const next = normalizeBrushPresetV1({ ...current, revision: item.preset.revision + 1 });
    return itemV1({
      source: item.source,
      baseline: item.baseline,
      preset: next,
      locked: item.locked,
    });
  });
}
`,
);

replaceOnce(
  'src/app/brush-preset-controller.ts',
  `  brushParameterValuesV1,
  brushTipShapeV1,`,
  `  brushParameterValuesV1,
  brushSampledTipAlphaV1,
  brushTipShapeV1,`,
);
insertBefore(
  'src/app/brush-preset-controller.ts',
  `import type { PaintSessionControllerV1 } from './paint-session-controller.js';`,
  `import {
  customBrushTipAlphaFromFileV1,
  drawCustomBrushTipPreviewV1,
} from './custom-brush-tip.js';
`,
);
replaceOnce(
  'src/app/brush-preset-controller.ts',
  `  updateBrushPresetParametersV1,
  updateBrushPresetTipShapeV1,`,
  `  updateBrushPresetCustomTipV1,
  updateBrushPresetParametersV1,
  updateBrushPresetTipShapeV1,`,
);
replaceOnce(
  'src/app/brush-preset-controller.ts',
  `  const tipShape = requireElement('#brush-tip-shape', HTMLSelectElement);
  let state = loadState(storage);`,
  `  const tipShape = requireElement('#brush-tip-shape', HTMLSelectElement);
  const customTipCreate = requireElement('#brush-tip-custom-create', HTMLButtonElement);
  const customTipFile = requireElement('#brush-tip-custom-file', HTMLInputElement);
  const customTipStatus = requireElement('#brush-tip-custom-status', HTMLOutputElement);
  const customTipPreview = requireElement('#brush-tip-custom-preview', HTMLCanvasElement);
  let state = loadState(storage);`,
);
replaceOnce(
  'src/app/brush-preset-controller.ts',
  `    input.paintSession.setBrushTipShape(brushTipShapeV1(item.preset));`,
  `    input.paintSession.setBrushTipShape(
      brushTipShapeV1(item.preset),
      brushSampledTipAlphaV1(item.preset) ?? undefined,
    );`,
);
replaceOnce(
  'src/app/brush-preset-controller.ts',
  `    tipShape.value = brushTipShapeV1(selected.preset);
    propertyStatus.textContent =`,
  `    tipShape.value = brushTipShapeV1(selected.preset);
    const customTipAlpha = brushSampledTipAlphaV1(selected.preset);
    customTipStatus.textContent = customTipAlpha === null ? '標準サンプル' : 'カスタム 5×5';
    customTipPreview.hidden = customTipAlpha === null;
    drawCustomBrushTipPreviewV1(customTipPreview, customTipAlpha);
    propertyStatus.textContent =`,
);
replaceOnce(
  'src/app/brush-preset-controller.ts',
  `      flowNumber,
      tipShape,
    ]) {`,
  `      flowNumber,
      tipShape,
      customTipCreate,
      customTipFile,
    ]) {`,
);
insertBefore(
  'src/app/brush-preset-controller.ts',
  `  search.addEventListener('input', onSearch);`,
  `  const onCustomTipCreate = (): void => {
    customTipFile.value = '';
    customTipFile.click();
  };
  const onCustomTipFile = async (): Promise<void> => {
    const file = customTipFile.files?.[0];
    if (file === undefined) return;
    try {
      const alpha = await customBrushTipAlphaFromFileV1(file);
      state = updateBrushPresetCustomTipV1(state, state.selectedPresetId, alpha);
      persist();
      applySelected();
      render();
      status.textContent = '画像からカスタム先端を作成しました';
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : 'カスタム先端の作成に失敗しました';
    }
  };
`,
);
replaceOnce(
  'src/app/brush-preset-controller.ts',
  `  tipShape.addEventListener('change', onTipShape);
`,
  `  tipShape.addEventListener('change', onTipShape);
  customTipCreate.addEventListener('click', onCustomTipCreate);
  customTipFile.addEventListener('change', onCustomTipFile);
`,
);
replaceOnce(
  'src/app/brush-preset-controller.ts',
  `      tipShape.removeEventListener('change', onTipShape);
`,
  `      tipShape.removeEventListener('change', onTipShape);
      customTipCreate.removeEventListener('click', onCustomTipCreate);
      customTipFile.removeEventListener('change', onCustomTipFile);
`,
);

replaceOnce(
  'src/index.html',
  `              <div class="shell-brush-property-row shell-brush-tip-property-row">
                <label for="brush-tip-shape">ブラシ形状</label>
                <select id="brush-tip-shape" aria-label="ブラシ先端形状">
                  <option value="round">円形</option>
                  <option value="square">四角</option>
                  <option value="sampled-image">サンプル画像</option>
                </select>
                <span class="shell-brush-tip-kind">先端</span>
              </div>`,
  `              <div class="shell-brush-property-row shell-brush-tip-property-row">
                <label for="brush-tip-shape">ブラシ形状</label>
                <select id="brush-tip-shape" aria-label="ブラシ先端形状">
                  <option value="round">円形</option>
                  <option value="square">四角</option>
                  <option value="sampled-image">サンプル画像</option>
                </select>
                <span class="shell-brush-tip-kind">先端</span>
              </div>
              <div class="shell-brush-custom-tip-row">
                <span class="shell-brush-custom-tip-label">カスタム先端</span>
                <button id="brush-tip-custom-create" type="button" title="黒い部分ほど強い先端として画像から作成">画像から作成</button>
                <input id="brush-tip-custom-file" type="file" accept="image/png,image/jpeg,image/webp" hidden />
                <canvas id="brush-tip-custom-preview" width="5" height="5" aria-label="カスタムブラシ先端プレビュー" hidden></canvas>
                <output id="brush-tip-custom-status" aria-live="polite">標準サンプル</output>
              </div>`,
);

appendOnce(
  'public/app-shell.css',
  '/* M6A custom sampled brush tip */',
  `/* M6A custom sampled brush tip */
.shell-brush-custom-tip-row {
  display: grid;
  grid-template-columns: minmax(72px, 1fr) auto auto;
  align-items: center;
  gap: 6px;
  min-height: 38px;
}

.shell-brush-custom-tip-label,
#brush-tip-custom-status {
  color: #68758c;
  font-size: 10px;
}

#brush-tip-custom-create {
  min-height: 32px;
  border: 1px solid #dfe5ef;
  border-radius: 8px;
  padding: 0 9px;
  background: #fff;
  color: #38445d;
  font: inherit;
}

#brush-tip-custom-preview {
  width: 32px;
  height: 32px;
  border: 1px solid #dfe5ef;
  border-radius: 6px;
  background: #fff;
  image-rendering: pixelated;
}

#brush-tip-custom-status {
  grid-column: 1 / -1;
  text-align: right;
}
`,
);

writeNew(
  'tests/unit/custom-brush-tip.test.ts',
  `import { describe, expect, it } from 'vitest';
import { customBrushTipAlphaFromRgbaV1 } from '../../src/app/custom-brush-tip.js';
import {
  brushSampledTipAlphaV1,
  brushTipShapeV1,
  createBaselineBrushPresetV1,
  withBrushCustomSampledTipV1,
} from '../../src/domain/brush-schema.js';
import {
  createBrushPresetLibraryStateV1,
  parseBrushPresetLibraryV1,
  selectedBrushPresetItemV1,
  serializeBrushPresetLibraryV1,
  updateBrushPresetCustomTipV1,
} from '../../src/app/brush-preset-library.js';
import { BaselineBrushDabBuilderV1 } from '../../src/gpu/baseline-brush.js';

function maskAt(index: number, value = 255): readonly number[] {
  const alpha = Array.from({ length: 25 }, () => 0);
  alpha[index] = value;
  return Object.freeze(alpha);
}

describe('M6A-019 custom brush tip creation', () => {
  it('converts a 5x5 RGBA image into a deterministic custom alpha mask', () => {
    const rgba = new Uint8ClampedArray(25 * 4);
    for (let index = 0; index < 25; index += 1) {
      const offset = index * 4;
      rgba[offset] = 255;
      rgba[offset + 1] = 255;
      rgba[offset + 2] = 255;
      rgba[offset + 3] = 255;
    }
    rgba[0] = 0;
    rgba[1] = 0;
    rgba[2] = 0;
    rgba[3] = 255;
    rgba[4] = 0;
    rgba[5] = 0;
    rgba[6] = 0;
    rgba[7] = 128;
    const alpha = customBrushTipAlphaFromRgbaV1(rgba);
    expect(alpha).toHaveLength(25);
    expect(alpha[0]).toBe(255);
    expect(alpha[1]).toBe(128);
    expect(alpha[2]).toBe(0);
  });

  it('stores one custom sampled tip directly in the selected illustro.brush/1 preset', () => {
    const baseline = createBaselineBrushPresetV1({
      id: 'custom.tip.test',
      name: 'Custom Tip',
      category: 'Test',
      behavior: 'paint',
    });
    const alpha = maskAt(12);
    const custom = withBrushCustomSampledTipV1(baseline, alpha);
    expect(custom.schema).toBe('illustro.brush/1');
    expect(custom.tip.kind).toBe('sampled-image-custom');
    expect(custom.tip.side).toBe(5);
    expect(brushTipShapeV1(custom)).toBe('sampled-image');
    expect(brushSampledTipAlphaV1(custom)).toEqual(alpha);
  });

  it('persists the selected custom tip through the existing preset-library storage envelope', () => {
    const state = createBrushPresetLibraryStateV1();
    const changed = updateBrushPresetCustomTipV1(state, state.selectedPresetId, maskAt(7, 192));
    const restored = parseBrushPresetLibraryV1(serializeBrushPresetLibraryV1(changed));
    const preset = selectedBrushPresetItemV1(restored).preset;
    expect(preset.tip.kind).toBe('sampled-image-custom');
    expect(brushSampledTipAlphaV1(preset)?.[7]).toBe(192);
  });

  it('uses the custom alpha mask for primitive expansion without duplicating a center-empty endpoint', () => {
    const alpha = maskAt(0);
    const builder = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      tipShape: 'sampled-image',
      sampledTipAlpha: alpha,
    });
    builder.begin({ documentX: 32, documentY: 32 });
    const dabs = builder.finish();
    expect(dabs).toHaveLength(1);
    expect(dabs[0]?.tipShape).toBe('round');
    expect(dabs[0]?.x).toBeLessThan(32);
    expect(dabs[0]?.y).toBeLessThan(32);
  });
});
`,
);

insertBefore(
  'scripts/verify-m6a-brush.mjs',
  `requireText(
  progress,
  'M6A-PERF-001 incremental active-stroke rendering（stable prefix + bounded mutable tail）:未完了',`,
  `requireText(progress, 'M6A-019 custom tip creation:完了', 'M6A-019 progress is not complete');
requireText(
  read('src/domain/brush-schema.ts'),
  'withBrushCustomSampledTipV1',
  'custom sampled tip preset mutation missing',
);
requireText(
  read('src/app/brush-preset-controller.ts'),
  'customBrushTipAlphaFromFileV1',
  'custom sampled tip image creation is not production-connected',
);
requireText(
  read('src/index.html'),
  'id="brush-tip-custom-create"',
  'reachable custom sampled tip creation control missing',
);
requireText(
  read('tests/unit/custom-brush-tip.test.ts'),
  'custom alpha mask',
  'custom sampled tip regression coverage missing',
);
`,
);

replaceOnce(
  'IMPLEMENTATION_PROGRESS.md',
  `M6A-019 custom tip creation:未完了
M6A-020 multiple tip assets without Dual Brush semantics:未完了`,
  `M6A-019 custom tip creation:完了
再開メモ: M6A-019 custom tip creationは選択preset内に単一5×5 alpha maskを保持し、画像入力を中央square crop→5×5へ縮小→黒/暗部をcoverageとして正規化する。stroke開始時にcustom alphaをcaptureし、M6A-018と同じprimitive round dab展開へ流すためrenderer/History/Persistenceの別経路は追加しない。centerが透明なcustom tipでも終端重複しないようlogical stamp位置をdab列とは別に追跡する。次はM6A-020 multiple tip assets without Dual Brush semanticsから再開する。
M6A-020 multiple tip assets without Dual Brush semantics:未完了`,
);

appendOnce(
  'ILLUSTRO_DESIGN_MEMO.md',
  '#### M6A custom-tip-creation boundary — 2026-09-03',
  `#### M6A custom-tip-creation boundary — 2026-09-03

- M6A-019 creates exactly one custom sampled tip for the selected brush preset. The custom tip is stored inside that preset as a fixed 5×5 alpha mask (`sampled-image-custom`); it does not introduce a global asset collection or multiple active tips, which remain M6A-020/M6A-072 responsibilities.
- Image creation uses a centered square crop, browser downsampling to 5×5, and grayscale-darkness multiplied by source alpha. Black opaque pixels produce full tip coverage; white or transparent pixels produce no coverage. Empty masks and oversized (>16 MiB) source files are rejected before preset mutation.
- Runtime captures the custom alpha mask when the stroke begins and resolves it through the existing M6A-018 sampled-image primitive-dab expansion. Persisted strokes therefore continue to contain resolved primitive dabs, leaving Worker/Main WebGPU, Canvas2D compatibility, canonical Raster Tile History, save/recovery, and export contracts unchanged.
- Logical stamp position is tracked independently from the last emitted primitive dab. This is required because a valid custom tip may have a transparent center; endpoint detection must not accidentally duplicate the final logical stamp based on the geometry of the last non-transparent micro-dab.
- Selecting procedural or built-in sampled tip kinds removes stale custom sampled identity fields from the effective preset tip descriptor. Reset/duplicate/persistence continue to use the existing Brush Preset library semantics.
`,
);

fs.rmSync('scripts/apply-m6a019-patch.mjs');
fs.rmSync('.github/workflows/illustro-m6a019-patch.yml');
