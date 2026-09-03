from pathlib import Path


def read(path: str) -> str:
    return Path(path).read_text(encoding='utf-8')


def write(path: str, text: str) -> None:
    Path(path).write_text(text, encoding='utf-8')


def replace_once(path: str, old: str, new: str) -> None:
    text = read(path)
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{path}: expected exactly one anchor, found {count}: {old[:140]!r}')
    write(path, text.replace(old, new, 1))


def append_once(path: str, marker: str, block: str) -> None:
    text = read(path)
    if marker in text:
        return
    if not text.endswith('\n'):
        text += '\n'
    write(path, text + '\n' + block.strip() + '\n')


# Preset schema: M6A-056 owns HSV jitter only. Main/sub-color semantics remain M6A-064.
replace_once(
    'src/domain/brush-schema.ts',
    "export type BrushTipSelectionModeV1 = 'fixed' | 'sequence' | 'random-per-stamp';",
    """export const DEFAULT_BRUSH_HUE_JITTER_V1 = 0 as const;
export const DEFAULT_BRUSH_SATURATION_JITTER_V1 = 0 as const;
export const DEFAULT_BRUSH_VALUE_JITTER_V1 = 0 as const;

function brushColorJitterValueV1(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1 ? value : 0;
}

export function brushHueJitterV1(preset: BrushPresetV1): number {
  return brushColorJitterValueV1(preset.jitter.hue);
}

export function brushSaturationJitterV1(preset: BrushPresetV1): number {
  return brushColorJitterValueV1(preset.jitter.saturation);
}

export function brushValueJitterV1(preset: BrushPresetV1): number {
  return brushColorJitterValueV1(preset.jitter.value);
}

function withBrushColorJitterFieldV1(
  preset: BrushPresetV1,
  field: 'hue' | 'saturation' | 'value',
  amount: number,
): BrushPresetV1 {
  if (!Number.isFinite(amount) || amount < 0 || amount > 1) {
    throw new RangeError(`brush ${field} jitter must be within 0..1`);
  }
  if (amount === 0) {
    const jitter = { ...preset.jitter } as Record<string, JsonValue>;
    delete jitter[field];
    return normalizeBrushPresetV1({ ...preset, jitter });
  }
  return normalizeBrushPresetV1({
    ...preset,
    jitter: { ...preset.jitter, [field]: amount },
  });
}

export function withBrushHueJitterV1(preset: BrushPresetV1, amount: number): BrushPresetV1 {
  return withBrushColorJitterFieldV1(preset, 'hue', amount);
}

export function withBrushSaturationJitterV1(preset: BrushPresetV1, amount: number): BrushPresetV1 {
  return withBrushColorJitterFieldV1(preset, 'saturation', amount);
}

export function withBrushValueJitterV1(preset: BrushPresetV1, amount: number): BrushPresetV1 {
  return withBrushColorJitterFieldV1(preset, 'value', amount);
}

export type BrushTipSelectionModeV1 = 'fixed' | 'sequence' | 'random-per-stamp';""",
)

# Low-level deterministic color-jitter kernel.
replace_once(
    'src/gpu/baseline-brush.ts',
    'export const BASELINE_BRUSH_DENSITY_JITTER = 0 as const;\n',
    """export const BASELINE_BRUSH_DENSITY_JITTER = 0 as const;
export const BASELINE_BRUSH_HUE_JITTER = 0 as const;
export const BASELINE_BRUSH_SATURATION_JITTER = 0 as const;
export const BASELINE_BRUSH_VALUE_JITTER = 0 as const;
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    'const BASELINE_BRUSH_DENSITY_JITTER_SALT_V1 = 0x165667b1 as const;\n',
    """const BASELINE_BRUSH_DENSITY_JITTER_SALT_V1 = 0x165667b1 as const;
const BASELINE_BRUSH_HUE_JITTER_SALT_V1 = 0xd3a2646c as const;
const BASELINE_BRUSH_SATURATION_JITTER_SALT_V1 = 0xfd7046c5 as const;
const BASELINE_BRUSH_VALUE_JITTER_SALT_V1 = 0xb55a4f09 as const;
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    'export function deterministicBaselineBrushRandomV1(seed: number, stampIndex: number): number {',
    """function deterministicBaselineBrushColorComponentV1(
  seed: number,
  stampIndex: number,
  salt: number,
): number {
  let value = (seed ^ salt ^ Math.imul((stampIndex + 1) >>> 0, 0x9e3779b1)) >>> 0;
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d) >>> 0;
  value ^= value >>> 15;
  value = Math.imul(value, 0x846ca68b) >>> 0;
  value ^= value >>> 16;
  return (value >>> 0) / 0x100000000;
}

export function deterministicBaselineBrushColorJitterV1(
  seed: number,
  stampIndex: number,
): Readonly<{ hue: number; saturation: number; value: number }> {
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) {
    throw new RangeError('baseline brush color jitter seed must be uint32');
  }
  if (!Number.isSafeInteger(stampIndex) || stampIndex < 0) {
    throw new RangeError('baseline brush color jitter stamp index must be a non-negative safe integer');
  }
  return Object.freeze({
    hue: deterministicBaselineBrushColorComponentV1(seed, stampIndex, BASELINE_BRUSH_HUE_JITTER_SALT_V1),
    saturation: deterministicBaselineBrushColorComponentV1(
      seed,
      stampIndex,
      BASELINE_BRUSH_SATURATION_JITTER_SALT_V1,
    ),
    value: deterministicBaselineBrushColorComponentV1(seed, stampIndex, BASELINE_BRUSH_VALUE_JITTER_SALT_V1),
  });
}

function baselineBrushRgbToHsvV1(color: BaselineBrushColorV1): Readonly<{ h: number; s: number; v: number }> {
  const [r, g, b] = color;
  const maximum = Math.max(r, g, b);
  const minimum = Math.min(r, g, b);
  const delta = maximum - minimum;
  let h = 0;
  if (delta > 0) {
    if (maximum === r) h = ((g - b) / delta) % 6;
    else if (maximum === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
    h /= 6;
    if (h < 0) h += 1;
  }
  return Object.freeze({ h, s: maximum <= 0 ? 0 : delta / maximum, v: maximum });
}

function baselineBrushHsvToRgbV1(h: number, s: number, v: number): BaselineBrushColorV1 {
  const normalizedHue = ((h % 1) + 1) % 1;
  const chroma = v * s;
  const sector = normalizedHue * 6;
  const x = chroma * (1 - Math.abs((sector % 2) - 1));
  let r = 0;
  let g = 0;
  let b = 0;
  if (sector < 1) [r, g] = [chroma, x];
  else if (sector < 2) [r, g] = [x, chroma];
  else if (sector < 3) [g, b] = [chroma, x];
  else if (sector < 4) [g, b] = [x, chroma];
  else if (sector < 5) [r, b] = [x, chroma];
  else [r, b] = [chroma, x];
  const match = v - chroma;
  return freezeBaselineBrushColorV1([r + match, g + match, b + match]);
}

export function applyBaselineBrushColorJitterV1(
  color: BaselineBrushColorV1,
  random: Readonly<{ hue: number; saturation: number; value: number }>,
  hueAmount: number,
  saturationAmount: number,
  valueAmount: number,
): BaselineBrushColorV1 {
  for (const [label, amount] of [
    ['hue', hueAmount],
    ['saturation', saturationAmount],
    ['value', valueAmount],
  ] as const) {
    if (!Number.isFinite(amount) || amount < 0 || amount > 1) {
      throw new RangeError(`baseline brush ${label} jitter must be within 0..1`);
    }
  }
  const hsv = baselineBrushRgbToHsvV1(color);
  const hue = ((hsv.h + (random.hue - 0.5) * hueAmount) % 1 + 1) % 1;
  const saturation = Math.max(0, Math.min(1, hsv.s + (random.saturation - 0.5) * 2 * saturationAmount));
  const value = Math.max(0, Math.min(1, hsv.v + (random.value - 0.5) * 2 * valueAmount));
  return baselineBrushHsvToRgbV1(hue, saturation, value);
}

export function deterministicBaselineBrushRandomV1(seed: number, stampIndex: number): number {""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    '  readonly densityJitterScale: number;\n  readonly tiltUprightness: number;\n',
    '  readonly densityJitterScale: number;\n  readonly color: BaselineBrushColorV1;\n  readonly tiltUprightness: number;\n',
)
replace_once(
    'src/gpu/baseline-brush.ts',
    '  readonly #densityJitter: number;\n  readonly #randomSeed: number;\n',
    """  readonly #densityJitter: number;
  readonly #hueJitter: number;
  readonly #saturationJitter: number;
  readonly #valueJitter: number;
  readonly #randomSeed: number;
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    '  #densityJitterStampIndex = 0;\n  #pathDistancePx = 0;\n',
    '  #densityJitterStampIndex = 0;\n  #colorJitterStampIndex = 0;\n  #pathDistancePx = 0;\n',
)
replace_once(
    'src/gpu/baseline-brush.ts',
    '      readonly densityJitter?: number;\n      readonly randomSeed?: number;\n',
    """      readonly densityJitter?: number;
      readonly hueJitter?: number;
      readonly saturationJitter?: number;
      readonly valueJitter?: number;
      readonly randomSeed?: number;
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    '    const densityJitter = options.densityJitter ?? BASELINE_BRUSH_DENSITY_JITTER;\n    const randomSeed = options.randomSeed ?? 0;\n',
    """    const densityJitter = options.densityJitter ?? BASELINE_BRUSH_DENSITY_JITTER;
    const hueJitter = options.hueJitter ?? BASELINE_BRUSH_HUE_JITTER;
    const saturationJitter = options.saturationJitter ?? BASELINE_BRUSH_SATURATION_JITTER;
    const valueJitter = options.valueJitter ?? BASELINE_BRUSH_VALUE_JITTER;
    const randomSeed = options.randomSeed ?? 0;
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """    if (!Number.isFinite(densityJitter) || densityJitter < 0 || densityJitter > 1) {
      throw new RangeError('baseline brush density jitter must be within 0..1');
    }
""",
    """    if (!Number.isFinite(densityJitter) || densityJitter < 0 || densityJitter > 1) {
      throw new RangeError('baseline brush density jitter must be within 0..1');
    }
    for (const [label, amount] of [
      ['hue', hueJitter],
      ['saturation', saturationJitter],
      ['value', valueJitter],
    ] as const) {
      if (!Number.isFinite(amount) || amount < 0 || amount > 1) {
        throw new RangeError(`baseline brush ${label} jitter must be within 0..1`);
      }
    }
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    '    this.#densityJitter = densityJitter;\n    this.#randomSeed = randomSeed >>> 0;\n',
    """    this.#densityJitter = densityJitter;
    this.#hueJitter = hueJitter;
    this.#saturationJitter = saturationJitter;
    this.#valueJitter = valueJitter;
    this.#randomSeed = randomSeed >>> 0;
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    "      | 'densityJitterScale'\n      | 'tiltUprightness'\n",
    "      | 'densityJitterScale'\n      | 'color'\n      | 'tiltUprightness'\n",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    '      stamp.tipAngleDegrees,\n      this.#color,\n      this.#tipShape,\n',
    '      stamp.tipAngleDegrees,\n      stamp.color,\n      this.#tipShape,\n',
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """    if (this.#densityJitter > 0) this.#densityJitterStampIndex += 1;
    const sampledTipAlpha = this.#sampledTipAlphaForLogicalStamp();
""",
    """    if (this.#densityJitter > 0) this.#densityJitterStampIndex += 1;
    const usesColorJitter =
      this.#hueJitter > 0 || this.#saturationJitter > 0 || this.#valueJitter > 0;
    const colorJitterRandom = usesColorJitter
      ? deterministicBaselineBrushColorJitterV1(this.#randomSeed, this.#colorJitterStampIndex)
      : null;
    if (usesColorJitter) this.#colorJitterStampIndex += 1;
    const resolvedColor =
      colorJitterRandom === null
        ? this.#color
        : applyBaselineBrushColorJitterV1(
            this.#color,
            colorJitterRandom,
            this.#hueJitter,
            this.#saturationJitter,
            this.#valueJitter,
          );
    const sampledTipAlpha = this.#sampledTipAlphaForLogicalStamp();
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    '      densityJitterScale,\n      tiltUprightness,\n',
    '      densityJitterScale,\n      color: resolvedColor,\n      tiltUprightness,\n',
)

# Canonical facade
replace_once(
    'src/app/canonical-raster-brush.ts',
    '      readonly densityJitter?: number;\n      readonly randomSeed?: number;\n',
    """      readonly densityJitter?: number;
      readonly hueJitter?: number;
      readonly saturationJitter?: number;
      readonly valueJitter?: number;
      readonly randomSeed?: number;
""",
)
replace_once(
    'src/app/canonical-raster-brush.ts',
    '      ...(options.densityJitter === undefined ? {} : { densityJitter: options.densityJitter }),\n      ...(options.randomSeed === undefined ? {} : { randomSeed: options.randomSeed }),\n',
    """      ...(options.densityJitter === undefined ? {} : { densityJitter: options.densityJitter }),
      ...(options.hueJitter === undefined ? {} : { hueJitter: options.hueJitter }),
      ...(options.saturationJitter === undefined ? {} : { saturationJitter: options.saturationJitter }),
      ...(options.valueJitter === undefined ? {} : { valueJitter: options.valueJitter }),
      ...(options.randomSeed === undefined ? {} : { randomSeed: options.randomSeed }),
""",
)

# Runtime session
replace_once(
    'src/app/paint-session-controller.ts',
    '  BASELINE_BRUSH_DENSITY_JITTER,\n  DEFAULT_BASELINE_BRUSH_COLOR_V1,\n',
    """  BASELINE_BRUSH_DENSITY_JITTER,
  BASELINE_BRUSH_HUE_JITTER,
  BASELINE_BRUSH_SATURATION_JITTER,
  BASELINE_BRUSH_VALUE_JITTER,
  DEFAULT_BASELINE_BRUSH_COLOR_V1,
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    '  readonly brushDensityJitter: number;\n  readonly brushTipAngleDegrees: number;\n',
    """  readonly brushDensityJitter: number;
  readonly brushHueJitter: number;
  readonly brushSaturationJitter: number;
  readonly brushValueJitter: number;
  readonly brushTipAngleDegrees: number;
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    '  #brushDensityJitter: number = BASELINE_BRUSH_DENSITY_JITTER;\n  #brushTipAngleDegrees: number = BASELINE_BRUSH_TIP_ANGLE_DEGREES;\n',
    """  #brushDensityJitter: number = BASELINE_BRUSH_DENSITY_JITTER;
  #brushHueJitter: number = BASELINE_BRUSH_HUE_JITTER;
  #brushSaturationJitter: number = BASELINE_BRUSH_SATURATION_JITTER;
  #brushValueJitter: number = BASELINE_BRUSH_VALUE_JITTER;
  #brushTipAngleDegrees: number = BASELINE_BRUSH_TIP_ANGLE_DEGREES;
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    '      brushDensityJitter: this.#brushDensityJitter,\n      brushTipAngleDegrees: this.#brushTipAngleDegrees,\n',
    """      brushDensityJitter: this.#brushDensityJitter,
      brushHueJitter: this.#brushHueJitter,
      brushSaturationJitter: this.#brushSaturationJitter,
      brushValueJitter: this.#brushValueJitter,
      brushTipAngleDegrees: this.#brushTipAngleDegrees,
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """  brushDensityJitter(): number {
    return this.#brushDensityJitter;
  }

  setBrushTipAngleDegrees(angleDegrees: number): number {
""",
    """  brushDensityJitter(): number {
    return this.#brushDensityJitter;
  }

  setBrushColorJitter(hue: number, saturation: number, value: number): Readonly<{
    hue: number;
    saturation: number;
    value: number;
  }> {
    for (const [label, amount] of [
      ['hue', hue],
      ['saturation', saturation],
      ['value', value],
    ] as const) {
      if (!Number.isFinite(amount) || amount < 0 || amount > 1) {
        throw new RangeError(`invalid runtime brush ${label} jitter`);
      }
    }
    if (
      hue !== this.#brushHueJitter ||
      saturation !== this.#brushSaturationJitter ||
      value !== this.#brushValueJitter
    ) {
      this.#clearActiveStroke();
    }
    this.#brushHueJitter = hue;
    this.#brushSaturationJitter = saturation;
    this.#brushValueJitter = value;
    return Object.freeze({ hue, saturation, value });
  }

  brushColorJitter(): Readonly<{ hue: number; saturation: number; value: number }> {
    return Object.freeze({
      hue: this.#brushHueJitter,
      saturation: this.#brushSaturationJitter,
      value: this.#brushValueJitter,
    });
  }

  setBrushTipAngleDegrees(angleDegrees: number): number {
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """    const densityJitterEnabled = this.#brushDensityJitter > 0;
    const randomSeed =
      this.#brushTipSelectionMode === 'random-per-stamp' ||
      randomDynamicsEnabled ||
      sizeJitterEnabled ||
      opacityJitterEnabled ||
      rotationJitterEnabled ||
      positionJitterEnabled ||
      densityJitterEnabled
        ? deterministicPaintStrokeSeedV1(strokeId)
        : undefined;
""",
    """    const densityJitterEnabled = this.#brushDensityJitter > 0;
    const colorJitterEnabled =
      this.#brushHueJitter > 0 || this.#brushSaturationJitter > 0 || this.#brushValueJitter > 0;
    const randomSeed =
      this.#brushTipSelectionMode === 'random-per-stamp' ||
      randomDynamicsEnabled ||
      sizeJitterEnabled ||
      opacityJitterEnabled ||
      rotationJitterEnabled ||
      positionJitterEnabled ||
      densityJitterEnabled ||
      colorJitterEnabled
        ? deterministicPaintStrokeSeedV1(strokeId)
        : undefined;
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    '        densityJitter: this.#brushDensityJitter,\n        randomSeed: randomSeed ?? 0,\n',
    """        densityJitter: this.#brushDensityJitter,
        hueJitter: this.#brushHueJitter,
        saturationJitter: this.#brushSaturationJitter,
        valueJitter: this.#brushValueJitter,
        randomSeed: randomSeed ?? 0,
""",
)

# Preset library mutations
replace_once(
    'src/app/brush-preset-library.ts',
    '  withBrushDensityJitterV1,\n  withBrushStrokeSpacingV1,\n',
    """  withBrushDensityJitterV1,
  withBrushHueJitterV1,
  withBrushSaturationJitterV1,
  withBrushValueJitterV1,
  withBrushStrokeSpacingV1,
""",
)
replace_once(
    'src/app/brush-preset-library.ts',
    'export function updateBrushPresetCustomTipV1(\n',
    """export function updateBrushPresetHueJitterV1(
  state: BrushPresetLibraryStateV1,
  presetId: string,
  amount: number,
): BrushPresetLibraryStateV1 {
  return updateItemV1(state, presetId, (item) => {
    if (item.locked) throw new Error('locked brush preset cannot be edited');
    const current = withBrushHueJitterV1(item.preset, amount);
    if (JSON.stringify(current) === JSON.stringify(item.preset)) return item;
    const next = normalizeBrushPresetV1({ ...current, revision: item.preset.revision + 1 });
    return itemV1({ source: item.source, baseline: item.baseline, preset: next, locked: item.locked });
  });
}

export function updateBrushPresetSaturationJitterV1(
  state: BrushPresetLibraryStateV1,
  presetId: string,
  amount: number,
): BrushPresetLibraryStateV1 {
  return updateItemV1(state, presetId, (item) => {
    if (item.locked) throw new Error('locked brush preset cannot be edited');
    const current = withBrushSaturationJitterV1(item.preset, amount);
    if (JSON.stringify(current) === JSON.stringify(item.preset)) return item;
    const next = normalizeBrushPresetV1({ ...current, revision: item.preset.revision + 1 });
    return itemV1({ source: item.source, baseline: item.baseline, preset: next, locked: item.locked });
  });
}

export function updateBrushPresetValueJitterV1(
  state: BrushPresetLibraryStateV1,
  presetId: string,
  amount: number,
): BrushPresetLibraryStateV1 {
  return updateItemV1(state, presetId, (item) => {
    if (item.locked) throw new Error('locked brush preset cannot be edited');
    const current = withBrushValueJitterV1(item.preset, amount);
    if (JSON.stringify(current) === JSON.stringify(item.preset)) return item;
    const next = normalizeBrushPresetV1({ ...current, revision: item.preset.revision + 1 });
    return itemV1({ source: item.source, baseline: item.baseline, preset: next, locked: item.locked });
  });
}

export function updateBrushPresetCustomTipV1(
""",
)

# Brush Properties controller
replace_once(
    'src/app/brush-preset-controller.ts',
    '  brushDensityJitterV1,\n  BUILTIN_BRUSH_GRAIN_RESOURCES_V1,\n',
    """  brushDensityJitterV1,
  brushHueJitterV1,
  brushSaturationJitterV1,
  brushValueJitterV1,
  BUILTIN_BRUSH_GRAIN_RESOURCES_V1,
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    '  updateBrushPresetDensityJitterV1,\n  updateBrushPresetSpacingV1,\n',
    """  updateBrushPresetDensityJitterV1,
  updateBrushPresetHueJitterV1,
  updateBrushPresetSaturationJitterV1,
  updateBrushPresetValueJitterV1,
  updateBrushPresetSpacingV1,
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  const densityJitterRange = requireElement('#brush-density-jitter-range', HTMLInputElement);
  const densityJitterNumber = requireElement('#brush-density-jitter-number', HTMLInputElement);
  const tipShape = requireElement('#brush-tip-shape', HTMLSelectElement);
""",
    """  const densityJitterRange = requireElement('#brush-density-jitter-range', HTMLInputElement);
  const densityJitterNumber = requireElement('#brush-density-jitter-number', HTMLInputElement);
  const hueJitterRange = requireElement('#brush-hue-jitter-range', HTMLInputElement);
  const hueJitterNumber = requireElement('#brush-hue-jitter-number', HTMLInputElement);
  const saturationJitterRange = requireElement('#brush-saturation-jitter-range', HTMLInputElement);
  const saturationJitterNumber = requireElement('#brush-saturation-jitter-number', HTMLInputElement);
  const valueJitterRange = requireElement('#brush-value-jitter-range', HTMLInputElement);
  const valueJitterNumber = requireElement('#brush-value-jitter-number', HTMLInputElement);
  const tipShape = requireElement('#brush-tip-shape', HTMLSelectElement);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    const densityJitter = brushDensityJitterV1(item.preset);
    input.paintSession.setBrushDensityJitter(densityJitter);
    const tipAssets = brushTipAssetsV1(item.preset);
""",
    """    const densityJitter = brushDensityJitterV1(item.preset);
    input.paintSession.setBrushDensityJitter(densityJitter);
    const hueJitter = brushHueJitterV1(item.preset);
    const saturationJitter = brushSaturationJitterV1(item.preset);
    const valueJitter = brushValueJitterV1(item.preset);
    input.paintSession.setBrushColorJitter(hueJitter, saturationJitter, valueJitter);
    const tipAssets = brushTipAssetsV1(item.preset);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    '    input.root.dataset.illustroBrushDensityJitter = String(densityJitter);\n    input.root.dataset.illustroBrushTipShape = brushTipShapeV1(item.preset);\n',
    """    input.root.dataset.illustroBrushDensityJitter = String(densityJitter);
    input.root.dataset.illustroBrushHueJitter = String(hueJitter);
    input.root.dataset.illustroBrushSaturationJitter = String(saturationJitter);
    input.root.dataset.illustroBrushValueJitter = String(valueJitter);
    input.root.dataset.illustroBrushTipShape = brushTipShapeV1(item.preset);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    const densityJitter = brushDensityJitterV1(selected.preset);
    configurePair(densityJitterRange, densityJitterNumber, 0, 100, 1, densityJitter * 100);
    tipShape.value = brushTipShapeV1(selected.preset);
""",
    """    const densityJitter = brushDensityJitterV1(selected.preset);
    configurePair(densityJitterRange, densityJitterNumber, 0, 100, 1, densityJitter * 100);
    const hueJitter = brushHueJitterV1(selected.preset);
    const saturationJitter = brushSaturationJitterV1(selected.preset);
    const valueJitter = brushValueJitterV1(selected.preset);
    configurePair(hueJitterRange, hueJitterNumber, 0, 100, 1, hueJitter * 100);
    configurePair(saturationJitterRange, saturationJitterNumber, 0, 100, 1, saturationJitter * 100);
    configurePair(valueJitterRange, valueJitterNumber, 0, 100, 1, valueJitter * 100);
    tipShape.value = brushTipShapeV1(selected.preset);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    const densityJitterLabel =
      densityJitter > 0 ? ` · DensityJitter${Math.round(densityJitter * 100)}%` : '';
    propertyStatus.textContent = `${parameters.sizePx.toFixed(1)} px · ${Math.round(parameters.opacity * 100)}% · ${Math.round(parameters.flow * 100)}% · H${Math.round(hardness * 100)}% · D${Math.round(tipDensity * 100)}% · S${Math.round(spacing.spacingRatio * 100)}% · A${Math.round(tipAngleDegrees)}° · F${Math.round(tipDirectionDegrees)}°${followRotation ? ' · Follow' : ''}${penOrientationEnabled ? ' · PenDir' : ''}${repeatLabel}${startLabel}${endLabel}${sizeTaperLabel}${opacityTaperLabel}${forcedTaperLabel}${stabilizationLabel}${postCorrectionLabel}${grainLabel}${paperLabel}${textureStrengthLabel}${textureScaleLabel}${textureRotationLabel}${textureBlendLabel}${pressureSizeLabel}${pressureOpacityLabel}${pressureFlowLabel}${pressureCurveLabel}${tiltSizeLabel}${tiltOpacityLabel}${tiltFlowLabel}${tiltCurveLabel}${velocitySizeLabel}${velocityOpacityLabel}${velocityFlowLabel}${velocityCurveLabel}${velocityMaximumLabel}${randomSizeLabel}${randomOpacityLabel}${randomFlowLabel}${randomCurveLabel}${minimumResponseLabel}${maximumResponseLabel}${sizeJitterLabel}${opacityJitterLabel}${rotationJitterLabel}${positionJitterLabel}${densityJitterLabel}`;
""",
    """    const densityJitterLabel =
      densityJitter > 0 ? ` · DensityJitter${Math.round(densityJitter * 100)}%` : '';
    const colorJitterLabel = `${hueJitter > 0 ? ` · HueJitter${Math.round(hueJitter * 100)}%` : ''}${saturationJitter > 0 ? ` · SatJitter${Math.round(saturationJitter * 100)}%` : ''}${valueJitter > 0 ? ` · ValueJitter${Math.round(valueJitter * 100)}%` : ''}`;
    propertyStatus.textContent = `${parameters.sizePx.toFixed(1)} px · ${Math.round(parameters.opacity * 100)}% · ${Math.round(parameters.flow * 100)}% · H${Math.round(hardness * 100)}% · D${Math.round(tipDensity * 100)}% · S${Math.round(spacing.spacingRatio * 100)}% · A${Math.round(tipAngleDegrees)}° · F${Math.round(tipDirectionDegrees)}°${followRotation ? ' · Follow' : ''}${penOrientationEnabled ? ' · PenDir' : ''}${repeatLabel}${startLabel}${endLabel}${sizeTaperLabel}${opacityTaperLabel}${forcedTaperLabel}${stabilizationLabel}${postCorrectionLabel}${grainLabel}${paperLabel}${textureStrengthLabel}${textureScaleLabel}${textureRotationLabel}${textureBlendLabel}${pressureSizeLabel}${pressureOpacityLabel}${pressureFlowLabel}${pressureCurveLabel}${tiltSizeLabel}${tiltOpacityLabel}${tiltFlowLabel}${tiltCurveLabel}${velocitySizeLabel}${velocityOpacityLabel}${velocityFlowLabel}${velocityCurveLabel}${velocityMaximumLabel}${randomSizeLabel}${randomOpacityLabel}${randomFlowLabel}${randomCurveLabel}${minimumResponseLabel}${maximumResponseLabel}${sizeJitterLabel}${opacityJitterLabel}${rotationJitterLabel}${positionJitterLabel}${densityJitterLabel}${colorJitterLabel}`;
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    '      densityJitterRange,\n      densityJitterNumber,\n      tipShape,\n',
    """      densityJitterRange,
      densityJitterNumber,
      hueJitterRange,
      hueJitterNumber,
      saturationJitterRange,
      saturationJitterNumber,
      valueJitterRange,
      valueJitterNumber,
      tipShape,
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  const onDensityJitterRange = (): void => updateDensityJitter(Number(densityJitterRange.value));
  const onDensityJitterNumber = (): void => updateDensityJitter(Number(densityJitterNumber.value));
  const onTipShape = (): void => {
""",
    """  const onDensityJitterRange = (): void => updateDensityJitter(Number(densityJitterRange.value));
  const onDensityJitterNumber = (): void => updateDensityJitter(Number(densityJitterNumber.value));
  const updateHueJitter = (valuePercent: number): void =>
    mutate(() => updateBrushPresetHueJitterV1(state, state.selectedPresetId, valuePercent / 100));
  const updateSaturationJitter = (valuePercent: number): void =>
    mutate(() => updateBrushPresetSaturationJitterV1(state, state.selectedPresetId, valuePercent / 100));
  const updateValueJitter = (valuePercent: number): void =>
    mutate(() => updateBrushPresetValueJitterV1(state, state.selectedPresetId, valuePercent / 100));
  const onHueJitterRange = (): void => updateHueJitter(Number(hueJitterRange.value));
  const onHueJitterNumber = (): void => updateHueJitter(Number(hueJitterNumber.value));
  const onSaturationJitterRange = (): void => updateSaturationJitter(Number(saturationJitterRange.value));
  const onSaturationJitterNumber = (): void => updateSaturationJitter(Number(saturationJitterNumber.value));
  const onValueJitterRange = (): void => updateValueJitter(Number(valueJitterRange.value));
  const onValueJitterNumber = (): void => updateValueJitter(Number(valueJitterNumber.value));
  const onTipShape = (): void => {
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  densityJitterRange.addEventListener('input', onDensityJitterRange);
  densityJitterNumber.addEventListener('change', onDensityJitterNumber);
  tipShape.addEventListener('change', onTipShape);
""",
    """  densityJitterRange.addEventListener('input', onDensityJitterRange);
  densityJitterNumber.addEventListener('change', onDensityJitterNumber);
  hueJitterRange.addEventListener('input', onHueJitterRange);
  hueJitterNumber.addEventListener('change', onHueJitterNumber);
  saturationJitterRange.addEventListener('input', onSaturationJitterRange);
  saturationJitterNumber.addEventListener('change', onSaturationJitterNumber);
  valueJitterRange.addEventListener('input', onValueJitterRange);
  valueJitterNumber.addEventListener('change', onValueJitterNumber);
  tipShape.addEventListener('change', onTipShape);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """      densityJitterRange.removeEventListener('input', onDensityJitterRange);
      densityJitterNumber.removeEventListener('change', onDensityJitterNumber);
      pressureCurveEditor?.dispose();
""",
    """      densityJitterRange.removeEventListener('input', onDensityJitterRange);
      densityJitterNumber.removeEventListener('change', onDensityJitterNumber);
      hueJitterRange.removeEventListener('input', onHueJitterRange);
      hueJitterNumber.removeEventListener('change', onHueJitterNumber);
      saturationJitterRange.removeEventListener('input', onSaturationJitterRange);
      saturationJitterNumber.removeEventListener('change', onSaturationJitterNumber);
      valueJitterRange.removeEventListener('input', onValueJitterRange);
      valueJitterNumber.removeEventListener('change', onValueJitterNumber);
      pressureCurveEditor?.dispose();
""",
)

# Reachable Tool Properties UI
replace_once(
    'src/index.html',
    """              <div class="shell-brush-property-row">
                <label for="brush-density-jitter-range">密度ジッター</label>
                <input id="brush-density-jitter-range" type="range" min="0" max="100" step="1" value="0" />
                <span class="shell-brush-property-number shell-brush-property-percent"><input id="brush-density-jitter-number" type="number" inputmode="decimal" min="0" max="100" step="1" value="0" aria-label="ブラシ密度ジッター" /><span>%</span></span>
              </div>
""",
    """              <div class="shell-brush-property-row">
                <label for="brush-density-jitter-range">密度ジッター</label>
                <input id="brush-density-jitter-range" type="range" min="0" max="100" step="1" value="0" />
                <span class="shell-brush-property-number shell-brush-property-percent"><input id="brush-density-jitter-number" type="number" inputmode="decimal" min="0" max="100" step="1" value="0" aria-label="ブラシ密度ジッター" /><span>%</span></span>
              </div>
              <div class="shell-brush-property-row">
                <label for="brush-hue-jitter-range">色相ジッター</label>
                <input id="brush-hue-jitter-range" type="range" min="0" max="100" step="1" value="0" />
                <span class="shell-brush-property-number shell-brush-property-percent"><input id="brush-hue-jitter-number" type="number" inputmode="decimal" min="0" max="100" step="1" value="0" aria-label="ブラシ色相ジッター" /><span>%</span></span>
              </div>
              <div class="shell-brush-property-row">
                <label for="brush-saturation-jitter-range">彩度ジッター</label>
                <input id="brush-saturation-jitter-range" type="range" min="0" max="100" step="1" value="0" />
                <span class="shell-brush-property-number shell-brush-property-percent"><input id="brush-saturation-jitter-number" type="number" inputmode="decimal" min="0" max="100" step="1" value="0" aria-label="ブラシ彩度ジッター" /><span>%</span></span>
              </div>
              <div class="shell-brush-property-row">
                <label for="brush-value-jitter-range">明度ジッター</label>
                <input id="brush-value-jitter-range" type="range" min="0" max="100" step="1" value="0" />
                <span class="shell-brush-property-number shell-brush-property-percent"><input id="brush-value-jitter-number" type="number" inputmode="decimal" min="0" max="100" step="1" value="0" aria-label="ブラシ明度ジッター" /><span>%</span></span>
              </div>
""",
)

# M6A-056 regression tests.
test_path = Path('tests/unit/brush-color-jitter.test.ts')
if test_path.exists():
    raise RuntimeError('tests/unit/brush-color-jitter.test.ts already exists')
test_path.write_text("""import { describe, expect, it } from 'vitest';
import {
  brushHueJitterV1,
  brushSaturationJitterV1,
  brushValueJitterV1,
  createBaselineBrushPresetV1,
  withBrushHueJitterV1,
  withBrushSaturationJitterV1,
  withBrushValueJitterV1,
} from '../../src/domain/brush-schema.js';
import { PaintSessionControllerV1 } from '../../src/app/paint-session-controller.js';
import {
  applyBaselineBrushColorJitterV1,
  BaselineBrushDabBuilderV1,
  deterministicBaselineBrushColorJitterV1,
} from '../../src/gpu/baseline-brush.js';

class FakeRendererDocumentPort {
  async configureDocument(): Promise<void> {}
  async restoreBaselineStrokes(): Promise<void> {}
  async applyBaselineTilePatches(): Promise<void> {}
  async restoreBaselineCanonicalTiles(): Promise<void> {}
  async exportBaselineCanonicalTiles(): Promise<readonly never[]> { return []; }
  async exportBaselineCompositeTiles(): Promise<readonly never[]> { return []; }
}

const baseColor = [0.8, 0.3, 0.15] as const;

describe('M6A-056 color jitter', () => {
  it('stores independent HSV jitter amounts with exact zero defaults', () => {
    const preset = createBaselineBrushPresetV1({
      id: 'test.color-jitter',
      name: 'Color Jitter',
      category: 'Test',
      behavior: 'paint',
    });
    expect([brushHueJitterV1(preset), brushSaturationJitterV1(preset), brushValueJitterV1(preset)]).toEqual([0, 0, 0]);
    const changed = withBrushValueJitterV1(
      withBrushSaturationJitterV1(withBrushHueJitterV1(preset, 0.4), 0.3),
      0.2,
    );
    expect([brushHueJitterV1(changed), brushSaturationJitterV1(changed), brushValueJitterV1(changed)]).toEqual([0.4, 0.3, 0.2]);
    expect(withBrushHueJitterV1(changed, 0).jitter.hue).toBeUndefined();
    expect(() => withBrushSaturationJitterV1(preset, 1.01)).toThrow(RangeError);
  });

  it('keeps all-zero color jitter as an exact RGB identity', () => {
    const baseline = new BaselineBrushDabBuilderV1({ color: baseColor, sizePx: 20, spacingRatio: 1, randomSeed: 7 });
    const explicitZero = new BaselineBrushDabBuilderV1({
      color: baseColor,
      sizePx: 20,
      spacingRatio: 1,
      hueJitter: 0,
      saturationJitter: 0,
      valueJitter: 0,
      randomSeed: 7,
    });
    for (const brush of [baseline, explicitZero]) {
      brush.begin({ documentX: 0, documentY: 0 });
      brush.append([{ documentX: 20, documentY: 0 }]);
      brush.finish();
    }
    expect(explicitZero.dabs()).toEqual(baseline.dabs());
  });

  it('resolves deterministic HSV variation into the existing primitive RGB field', () => {
    const seed = 0x1234abcd;
    const random = deterministicBaselineBrushColorJitterV1(seed, 0);
    const expected = applyBaselineBrushColorJitterV1(baseColor, random, 0.5, 0.4, 0.3);
    const brush = new BaselineBrushDabBuilderV1({
      color: baseColor,
      hueJitter: 0.5,
      saturationJitter: 0.4,
      valueJitter: 0.3,
      randomSeed: seed,
    });
    const [dab] = brush.beginDelta({ documentX: 10, documentY: 12 });
    expect(dab?.color).toEqual(expected);
    expect(dab?.color?.every((component) => component >= 0 && component <= 1)).toBe(true);
    expect('hueJitter' in (dab ?? {})).toBe(false);
    expect('saturationJitter' in (dab ?? {})).toBe(false);
    expect('valueJitter' in (dab ?? {})).toBe(false);
  });

  it('shares one resolved color across sampled-tip micro dabs', () => {
    const brush = new BaselineBrushDabBuilderV1({
      color: baseColor,
      tipShape: 'sampled-image',
      hueJitter: 0.7,
      saturationJitter: 0.5,
      valueJitter: 0.4,
      randomSeed: 0x2468ace0,
    });
    const firstStamp = brush.beginDelta({ documentX: 20, documentY: 20 });
    expect(firstStamp.length).toBeGreaterThan(1);
    expect(firstStamp.every((dab) => JSON.stringify(dab.color) === JSON.stringify(firstStamp[0]?.color))).toBe(true);
  });

  it('advances the color-jitter attempt index even when taper suppresses a logical stamp', () => {
    const seed = 0x89abcdef;
    const reference = new BaselineBrushDabBuilderV1({
      color: baseColor,
      sizePx: 10,
      spacingRatio: 1,
      hueJitter: 0.8,
      saturationJitter: 0.3,
      valueJitter: 0.2,
      randomSeed: seed,
    });
    reference.begin({ documentX: 0, documentY: 0 });
    reference.append([{ documentX: 10, documentY: 0 }]);
    const suppressed = new BaselineBrushDabBuilderV1({
      color: baseColor,
      sizePx: 10,
      spacingRatio: 1,
      startTaperLengthPx: 10,
      hueJitter: 0.8,
      saturationJitter: 0.3,
      valueJitter: 0.2,
      randomSeed: seed,
    });
    suppressed.begin({ documentX: 0, documentY: 0 });
    suppressed.append([{ documentX: 10, documentY: 0 }]);
    expect(suppressed.dabs()[0]?.color).toEqual(reference.dabs()[1]?.color);
  });

  it('keeps its color random sequence independent from geometry and density random channels', () => {
    const seed = 0x0badc0de;
    const plain = new BaselineBrushDabBuilderV1({
      color: baseColor,
      sizePx: 20,
      spacingRatio: 1,
      hueJitter: 0.5,
      saturationJitter: 0.5,
      valueJitter: 0.5,
      randomSeed: seed,
    });
    const combined = new BaselineBrushDabBuilderV1({
      color: baseColor,
      sizePx: 20,
      spacingRatio: 1,
      hueJitter: 0.5,
      saturationJitter: 0.5,
      valueJitter: 0.5,
      sizeJitter: 0.5,
      opacityJitter: 0.5,
      rotationJitter: 0.5,
      positionJitter: 0.5,
      densityJitter: 0.5,
      randomFlowEnabled: true,
      randomSeed: seed,
    });
    for (const brush of [plain, combined]) {
      brush.begin({ documentX: 0, documentY: 0 });
      brush.append([{ documentX: 20, documentY: 0 }]);
      brush.finish();
    }
    expect(combined.dabs().map((dab) => dab.color)).toEqual(plain.dabs().map((dab) => dab.color));
  });

  it('reuses the resolved color when reconciling the mutable end tail', () => {
    const brush = new BaselineBrushDabBuilderV1({
      color: baseColor,
      sizePx: 10,
      spacingRatio: 1,
      endTaperLengthPx: 10,
      sizeTaperMinimumRatio: 1,
      opacityTaperMinimumRatio: 1,
      hueJitter: 0.6,
      saturationJitter: 0.4,
      valueJitter: 0.3,
      randomSeed: 0xfeed1234,
    });
    brush.begin({ documentX: 0, documentY: 0 });
    brush.append([{ documentX: 10, documentY: 0 }, { documentX: 20, documentY: 0 }]);
    const beforeFinish = brush.dabs().map((dab) => dab.color);
    brush.finish();
    expect(brush.dabs().map((dab) => dab.color)).toEqual(beforeFinish);
  });

  it('captures runtime HSV jitter without adding color-jitter primitive fields', () => {
    const session = new PaintSessionControllerV1(new FakeRendererDocumentPort());
    expect(session.setBrushColorJitter(0.25, 0.35, 0.45)).toEqual({ hue: 0.25, saturation: 0.35, value: 0.45 });
    expect(session.snapshot().brushHueJitter).toBe(0.25);
    expect(session.snapshot().brushSaturationJitter).toBe(0.35);
    expect(session.snapshot().brushValueJitter).toBe(0.45);
  });
});
""", encoding='utf-8')

# Contract verifier
replace_once(
    'scripts/verify-m6a-brush.mjs',
    """requireText(
  progress,
  'M6A-PERF-001 incremental active-stroke rendering（stable prefix + bounded mutable tail）:未完了',
""",
    """requireText(progress, 'M6A-056 color jitter:完了', 'M6A-056 progress is not complete');
requireText(
  read('src/domain/brush-schema.ts'),
  'brushHueJitterV1',
  'color-jitter preset helpers missing',
);
requireText(
  read('src/gpu/baseline-brush.ts'),
  'deterministicBaselineBrushColorJitterV1',
  'deterministic HSV color-jitter channel missing',
);
requireText(
  read('src/gpu/baseline-brush.ts'),
  'color: resolvedColor',
  'resolved color jitter is not stored on logical stamps',
);
requireText(
  read('src/gpu/baseline-brush.ts'),
  'stamp.color',
  'resolved logical-stamp color is not forwarded to primitive dabs',
);
requireText(
  read('src/app/paint-session-controller.ts'),
  'setBrushColorJitter',
  'color jitter is not connected to runtime brush state',
);
requireText(
  read('src/app/paint-session-controller.ts'),
  'colorJitterEnabled',
  'color jitter does not capture a deterministic persistent stroke seed',
);
requireText(
  read('src/index.html'),
  'id="brush-hue-jitter-range"',
  'reachable hue-jitter control missing',
);
requireText(
  read('src/index.html'),
  'id="brush-saturation-jitter-range"',
  'reachable saturation-jitter control missing',
);
requireText(
  read('src/index.html'),
  'id="brush-value-jitter-range"',
  'reachable value-jitter control missing',
);
requireText(
  read('tests/unit/brush-color-jitter.test.ts'),
  'shares one resolved color across sampled-tip micro dabs',
  'color-jitter logical-stamp sharing regression missing',
);
requireText(
  read('tests/unit/brush-color-jitter.test.ts'),
  'advances the color-jitter attempt index even when taper suppresses a logical stamp',
  'color-jitter attempt-index regression missing',
);
requireText(
  read('tests/unit/brush-color-jitter.test.ts'),
  'reuses the resolved color when reconciling the mutable end tail',
  'color-jitter tail reconciliation regression missing',
);

requireText(
  progress,
  'M6A-PERF-001 incremental active-stroke rendering（stable prefix + bounded mutable tail）:未完了',
""",
)

# Progress and canonical design memo
replace_once(
    'IMPLEMENTATION_PROGRESS.md',
    'M6A-056 color jitter:未完了\nM6A-057 spray/particle mode:未完了\n',
    """M6A-056 color jitter:完了
再開メモ: M6A-056 color jitterはCanonical Brush Modelのjitter hue / saturation / valueを各0..1で保持し、0を完全identity/defaultとする。main/sub color選択・混合はM6A-064へ残し、本段階では現在のbrush RGBをworking-space RGB上のHSVへ一時変換してlogical stamp attemptごとに色相・彩度・明度を独立に揺らし、再び既存RGB primitive colorへ解決する。色相100%は±180°、彩度/明度100%は各±1.0の対称deltaをclampして使用する。3成分はstroke randomSeed + 成分別saltから同一color-attempt indexで決定し、他のrandom/jitter系列と独立する。非表示attemptでもcolor indexを進め、可視logical recordに解決済みRGBを保持するためend-tail reconciliationで再抽選しない。sampled-image tipのmicro-dab群は同じlogical stamp色を共有する。color jitterが有効なら他random機能がOFFでもstroke randomSeedを保存しpost-stroke correctionでも同一色列を再構築する。primitive dab / Worker / Historyにはcolor-jitter専用fieldを追加せず既存colorだけを保存する。次はM6A-057 spray/particle modeから再開する。
M6A-057 spray/particle mode:未完了
""",
)
append_once(
    'ILLUSTRO_DESIGN_MEMO.md',
    '## M6A color-jitter boundary — 2026-09-03',
    """## M6A color-jitter boundary — 2026-09-03

**AUTHORITATIVE for M6A-056.** Color jitter is represented by normalized `BrushPresetV1.jitter.hue`, `.saturation`, and `.value` amounts in `0..1`; omitted/zero values are exact identity. This stage does **not** implement main/sub-color switching or contribution, which remains M6A-064. The active brush RGB is converted transiently to HSV in the document working RGB coordinate system, varied, clamped, and converted back to the existing resolved RGB dab color. Hue amount `1` spans a symmetric `-180°..+180°` offset; saturation/value amounts use symmetric normalized deltas with final clamp to `0..1`.

Each logical-stamp attempt uses one color-attempt index but three component-specific deterministic salts, so enabling/disabling hue, saturation, or value does not shift the other component sequences. The color-jitter channel is independent from generalized random dynamics, size/opacity/rotation/position/density jitter, and random tip selection. The attempt index advances even if taper/dynamics suppress primitive output. A visible logical-stamp record keeps the already-resolved RGB color, and sampled-image micro-dabs generated by that stamp all share that exact color; bounded mutable-tail/end-taper reconciliation therefore never resamples color.

When any HSV jitter amount is active, the stroke persists its deterministic uint32 random seed even if every other randomized feature is disabled, so post-stroke correction/recovery reconstructs the same color sequence. Primitive dabs, Worker payloads and history keep using the existing resolved `color` field only; no color-jitter-specific renderer/history payload is introduced. HSV math is a brush-parameter transform over the current document working RGB coordinates and does not retag or convert the document color space.
""",
)
