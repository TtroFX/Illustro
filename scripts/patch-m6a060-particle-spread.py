from pathlib import Path


def read(path: str) -> str:
    return Path(path).read_text(encoding='utf-8')


def write(path: str, text: str) -> None:
    Path(path).write_text(text, encoding='utf-8')


def replace_once(path: str, old: str, new: str) -> None:
    text = read(path)
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{path}: expected exactly one anchor, found {count}: {old[:180]!r}')
    write(path, text.replace(old, new, 1))


def append_once(path: str, marker: str, block: str) -> None:
    text = read(path)
    if marker in text:
        return
    if not text.endswith('\n'):
        text += '\n'
    write(path, text + '\n' + block.strip() + '\n')


# Domain: canonical radial spread radius + signed radial deviation.
replace_once(
    'src/domain/brush-schema.ts',
    """export function withBrushSprayParticleDensityV1(
  preset: BrushPresetV1,
  particleDensity: number,
): BrushPresetV1 {
  if (
    !Number.isSafeInteger(particleDensity) ||
    particleDensity < MIN_BRUSH_SPRAY_PARTICLE_DENSITY_V1 ||
    particleDensity > MAX_BRUSH_SPRAY_PARTICLE_DENSITY_V1
  ) {
    throw new RangeError('brush spray particle density must be an integer within 1..32');
  }
  if (particleDensity === DEFAULT_BRUSH_SPRAY_PARTICLE_DENSITY_V1) {
    const { particleDensity: _particleDensity, ...spray } = preset.spray;
    return normalizeBrushPresetV1({ ...preset, spray });
  }
  return normalizeBrushPresetV1({
    ...preset,
    spray: { ...preset.spray, particleDensity },
  });
}

export type BrushTipSelectionModeV1 = 'fixed' | 'sequence' | 'random-per-stamp';
""",
    """export function withBrushSprayParticleDensityV1(
  preset: BrushPresetV1,
  particleDensity: number,
): BrushPresetV1 {
  if (
    !Number.isSafeInteger(particleDensity) ||
    particleDensity < MIN_BRUSH_SPRAY_PARTICLE_DENSITY_V1 ||
    particleDensity > MAX_BRUSH_SPRAY_PARTICLE_DENSITY_V1
  ) {
    throw new RangeError('brush spray particle density must be an integer within 1..32');
  }
  if (particleDensity === DEFAULT_BRUSH_SPRAY_PARTICLE_DENSITY_V1) {
    const { particleDensity: _particleDensity, ...spray } = preset.spray;
    return normalizeBrushPresetV1({ ...preset, spray });
  }
  return normalizeBrushPresetV1({
    ...preset,
    spray: { ...preset.spray, particleDensity },
  });
}

export const DEFAULT_BRUSH_SPRAY_SPREAD_RADIUS_RATIO_V1 = 1 as const;
export const MIN_BRUSH_SPRAY_SPREAD_RADIUS_RATIO_V1 = 0 as const;
export const MAX_BRUSH_SPRAY_SPREAD_RADIUS_RATIO_V1 = 4 as const;
export const DEFAULT_BRUSH_SPRAY_DEVIATION_V1 = 0 as const;

export function brushSpraySpreadRadiusRatioV1(preset: BrushPresetV1): number {
  const value = preset.spray.spreadRadiusRatio;
  return typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= MIN_BRUSH_SPRAY_SPREAD_RADIUS_RATIO_V1 &&
    value <= MAX_BRUSH_SPRAY_SPREAD_RADIUS_RATIO_V1
    ? value
    : DEFAULT_BRUSH_SPRAY_SPREAD_RADIUS_RATIO_V1;
}

export function withBrushSpraySpreadRadiusRatioV1(
  preset: BrushPresetV1,
  spreadRadiusRatio: number,
): BrushPresetV1 {
  if (
    !Number.isFinite(spreadRadiusRatio) ||
    spreadRadiusRatio < MIN_BRUSH_SPRAY_SPREAD_RADIUS_RATIO_V1 ||
    spreadRadiusRatio > MAX_BRUSH_SPRAY_SPREAD_RADIUS_RATIO_V1
  ) {
    throw new RangeError('brush spray spread radius ratio must be within 0..4');
  }
  if (spreadRadiusRatio === DEFAULT_BRUSH_SPRAY_SPREAD_RADIUS_RATIO_V1) {
    const { spreadRadiusRatio: _spreadRadiusRatio, ...spray } = preset.spray;
    return normalizeBrushPresetV1({ ...preset, spray });
  }
  return normalizeBrushPresetV1({
    ...preset,
    spray: { ...preset.spray, spreadRadiusRatio },
  });
}

export function brushSprayDeviationV1(preset: BrushPresetV1): number {
  const value = preset.spray.deviation;
  return typeof value === 'number' && Number.isFinite(value) && value >= -1 && value <= 1
    ? value
    : DEFAULT_BRUSH_SPRAY_DEVIATION_V1;
}

export function withBrushSprayDeviationV1(
  preset: BrushPresetV1,
  deviation: number,
): BrushPresetV1 {
  if (!Number.isFinite(deviation) || deviation < -1 || deviation > 1) {
    throw new RangeError('brush spray deviation must be within -1..1');
  }
  if (deviation === DEFAULT_BRUSH_SPRAY_DEVIATION_V1) {
    const { deviation: _deviation, ...spray } = preset.spray;
    return normalizeBrushPresetV1({ ...preset, spray });
  }
  return normalizeBrushPresetV1({
    ...preset,
    spray: { ...preset.spray, deviation },
  });
}

export type BrushTipSelectionModeV1 = 'fixed' | 'sequence' | 'random-per-stamp';
""",
)

# Kernel: preserve deterministic angle/random sequence, transform only radial distance.
replace_once(
    'src/gpu/baseline-brush.ts',
    'export const BASELINE_BRUSH_SPRAY_SPREAD_RADIUS_RATIO_V1 = 1 as const;\n',
    """export const BASELINE_BRUSH_SPRAY_SPREAD_RADIUS_RATIO_V1 = 1 as const;
export const BASELINE_BRUSH_SPRAY_SPREAD_RADIUS_RATIO_MIN_V1 = 0 as const;
export const BASELINE_BRUSH_SPRAY_SPREAD_RADIUS_RATIO_MAX_V1 = 4 as const;
export const BASELINE_BRUSH_SPRAY_DEVIATION_V1 = 0 as const;
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """export function deterministicBaselineBrushRandomV1(seed: number, stampIndex: number): number {
""",
    """export function applyBaselineBrushSprayDeviationV1(
  unit: Readonly<{ x: number; y: number }>,
  deviation: number,
): Readonly<{ x: number; y: number }> {
  if (!Number.isFinite(deviation) || deviation < -1 || deviation > 1) {
    throw new RangeError('baseline brush spray deviation must be within -1..1');
  }
  if (deviation === 0) return unit;
  const radius = Math.hypot(unit.x, unit.y);
  if (radius <= 1e-12) return Object.freeze({ x: 0, y: 0 });
  const adjustedRadius =
    deviation > 0
      ? radius * (1 - deviation)
      : radius + -deviation * (1 - radius);
  const scale = adjustedRadius / radius;
  return Object.freeze({ x: unit.x * scale, y: unit.y * scale });
}

export function deterministicBaselineBrushRandomV1(seed: number, stampIndex: number): number {
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    '  readonly #sprayParticleSizeRatio: number;\n  readonly #sprayParticleDensity: number;\n  readonly #randomSeed: number;\n',
    '  readonly #sprayParticleSizeRatio: number;\n  readonly #sprayParticleDensity: number;\n  readonly #spraySpreadRadiusRatio: number;\n  readonly #sprayDeviation: number;\n  readonly #randomSeed: number;\n',
)
replace_once(
    'src/gpu/baseline-brush.ts',
    '      readonly sprayParticleSizeRatio?: number;\n      readonly sprayParticleDensity?: number;\n      readonly randomSeed?: number;\n',
    '      readonly sprayParticleSizeRatio?: number;\n      readonly sprayParticleDensity?: number;\n      readonly spraySpreadRadiusRatio?: number;\n      readonly sprayDeviation?: number;\n      readonly randomSeed?: number;\n',
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """    const sprayParticleDensity =
      options.sprayParticleDensity ?? BASELINE_BRUSH_SPRAY_PARTICLE_COUNT_V1;
    const randomSeed = options.randomSeed ?? 0;
""",
    """    const sprayParticleDensity =
      options.sprayParticleDensity ?? BASELINE_BRUSH_SPRAY_PARTICLE_COUNT_V1;
    const spraySpreadRadiusRatio =
      options.spraySpreadRadiusRatio ?? BASELINE_BRUSH_SPRAY_SPREAD_RADIUS_RATIO_V1;
    const sprayDeviation = options.sprayDeviation ?? BASELINE_BRUSH_SPRAY_DEVIATION_V1;
    const randomSeed = options.randomSeed ?? 0;
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """    if (
      !Number.isSafeInteger(sprayParticleDensity) ||
      sprayParticleDensity < BASELINE_BRUSH_SPRAY_PARTICLE_COUNT_MIN_V1 ||
      sprayParticleDensity > BASELINE_BRUSH_SPRAY_PARTICLE_COUNT_MAX_V1
    ) {
      throw new RangeError('baseline brush spray particle density must be an integer within 1..32');
    }
    if (!Number.isSafeInteger(randomSeed) || randomSeed < 0 || randomSeed > 0xffffffff) {
""",
    """    if (
      !Number.isSafeInteger(sprayParticleDensity) ||
      sprayParticleDensity < BASELINE_BRUSH_SPRAY_PARTICLE_COUNT_MIN_V1 ||
      sprayParticleDensity > BASELINE_BRUSH_SPRAY_PARTICLE_COUNT_MAX_V1
    ) {
      throw new RangeError('baseline brush spray particle density must be an integer within 1..32');
    }
    if (
      !Number.isFinite(spraySpreadRadiusRatio) ||
      spraySpreadRadiusRatio < BASELINE_BRUSH_SPRAY_SPREAD_RADIUS_RATIO_MIN_V1 ||
      spraySpreadRadiusRatio > BASELINE_BRUSH_SPRAY_SPREAD_RADIUS_RATIO_MAX_V1
    ) {
      throw new RangeError('baseline brush spray spread radius ratio must be within 0..4');
    }
    if (!Number.isFinite(sprayDeviation) || sprayDeviation < -1 || sprayDeviation > 1) {
      throw new RangeError('baseline brush spray deviation must be within -1..1');
    }
    if (!Number.isSafeInteger(randomSeed) || randomSeed < 0 || randomSeed > 0xffffffff) {
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    '    this.#sprayParticleSizeRatio = sprayParticleSizeRatio;\n    this.#sprayParticleDensity = sprayParticleDensity;\n    this.#randomSeed = randomSeed >>> 0;\n',
    '    this.#sprayParticleSizeRatio = sprayParticleSizeRatio;\n    this.#sprayParticleDensity = sprayParticleDensity;\n    this.#spraySpreadRadiusRatio = spraySpreadRadiusRatio;\n    this.#sprayDeviation = sprayDeviation;\n    this.#randomSeed = randomSeed >>> 0;\n',
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """            const unit = deterministicBaselineBrushSprayParticleV1(
              this.#randomSeed,
              this.#sprayStampIndex,
              particleIndex,
            );
            const spreadRadiusPx = this.#radius * BASELINE_BRUSH_SPRAY_SPREAD_RADIUS_RATIO_V1;
            return Object.freeze({
              x: jitteredX + unit.x * spreadRadiusPx,
              y: jitteredY + unit.y * spreadRadiusPx,
            });
""",
    """            const baseUnit = deterministicBaselineBrushSprayParticleV1(
              this.#randomSeed,
              this.#sprayStampIndex,
              particleIndex,
            );
            const unit = applyBaselineBrushSprayDeviationV1(baseUnit, this.#sprayDeviation);
            const spreadRadiusPx = this.#radius * this.#spraySpreadRadiusRatio;
            return Object.freeze({
              x: jitteredX + unit.x * spreadRadiusPx,
              y: jitteredY + unit.y * spreadRadiusPx,
            });
""",
)

# Canonical facade.
replace_once(
    'src/app/canonical-raster-brush.ts',
    '      readonly sprayParticleSizeRatio?: number;\n      readonly sprayParticleDensity?: number;\n      readonly randomSeed?: number;\n',
    '      readonly sprayParticleSizeRatio?: number;\n      readonly sprayParticleDensity?: number;\n      readonly spraySpreadRadiusRatio?: number;\n      readonly sprayDeviation?: number;\n      readonly randomSeed?: number;\n',
)
replace_once(
    'src/app/canonical-raster-brush.ts',
    """      ...(options.sprayParticleDensity === undefined
        ? {}
        : { sprayParticleDensity: options.sprayParticleDensity }),
      ...(options.randomSeed === undefined ? {} : { randomSeed: options.randomSeed }),
""",
    """      ...(options.sprayParticleDensity === undefined
        ? {}
        : { sprayParticleDensity: options.sprayParticleDensity }),
      ...(options.spraySpreadRadiusRatio === undefined
        ? {}
        : { spraySpreadRadiusRatio: options.spraySpreadRadiusRatio }),
      ...(options.sprayDeviation === undefined ? {} : { sprayDeviation: options.sprayDeviation }),
      ...(options.randomSeed === undefined ? {} : { randomSeed: options.randomSeed }),
""",
)

# Runtime session.
replace_once(
    'src/app/paint-session-controller.ts',
    '  BASELINE_BRUSH_SPRAY_PARTICLE_SCALE_V1,\n  BASELINE_BRUSH_SPRAY_PARTICLE_COUNT_V1,\n  DEFAULT_BASELINE_BRUSH_COLOR_V1,\n',
    '  BASELINE_BRUSH_SPRAY_PARTICLE_SCALE_V1,\n  BASELINE_BRUSH_SPRAY_PARTICLE_COUNT_V1,\n  BASELINE_BRUSH_SPRAY_SPREAD_RADIUS_RATIO_V1,\n  BASELINE_BRUSH_SPRAY_DEVIATION_V1,\n  DEFAULT_BASELINE_BRUSH_COLOR_V1,\n',
)
replace_once(
    'src/app/paint-session-controller.ts',
    '  readonly brushSprayParticleSizeRatio: number;\n  readonly brushSprayParticleDensity: number;\n  readonly brushTipAngleDegrees: number;\n',
    '  readonly brushSprayParticleSizeRatio: number;\n  readonly brushSprayParticleDensity: number;\n  readonly brushSpraySpreadRadiusRatio: number;\n  readonly brushSprayDeviation: number;\n  readonly brushTipAngleDegrees: number;\n',
)
replace_once(
    'src/app/paint-session-controller.ts',
    '  #brushSprayParticleSizeRatio: number = BASELINE_BRUSH_SPRAY_PARTICLE_SCALE_V1;\n  #brushSprayParticleDensity: number = BASELINE_BRUSH_SPRAY_PARTICLE_COUNT_V1;\n  #brushTipAngleDegrees: number = BASELINE_BRUSH_TIP_ANGLE_DEGREES;\n',
    '  #brushSprayParticleSizeRatio: number = BASELINE_BRUSH_SPRAY_PARTICLE_SCALE_V1;\n  #brushSprayParticleDensity: number = BASELINE_BRUSH_SPRAY_PARTICLE_COUNT_V1;\n  #brushSpraySpreadRadiusRatio: number = BASELINE_BRUSH_SPRAY_SPREAD_RADIUS_RATIO_V1;\n  #brushSprayDeviation: number = BASELINE_BRUSH_SPRAY_DEVIATION_V1;\n  #brushTipAngleDegrees: number = BASELINE_BRUSH_TIP_ANGLE_DEGREES;\n',
)
replace_once(
    'src/app/paint-session-controller.ts',
    '      brushSprayParticleSizeRatio: this.#brushSprayParticleSizeRatio,\n      brushSprayParticleDensity: this.#brushSprayParticleDensity,\n      brushTipAngleDegrees: this.#brushTipAngleDegrees,\n',
    '      brushSprayParticleSizeRatio: this.#brushSprayParticleSizeRatio,\n      brushSprayParticleDensity: this.#brushSprayParticleDensity,\n      brushSpraySpreadRadiusRatio: this.#brushSpraySpreadRadiusRatio,\n      brushSprayDeviation: this.#brushSprayDeviation,\n      brushTipAngleDegrees: this.#brushTipAngleDegrees,\n',
)
replace_once(
    'src/app/paint-session-controller.ts',
    """  brushSprayParticleDensity(): number {
    return this.#brushSprayParticleDensity;
  }

  setBrushTipAngleDegrees(angleDegrees: number): number {
""",
    """  brushSprayParticleDensity(): number {
    return this.#brushSprayParticleDensity;
  }

  setBrushSpraySpread(
    spreadRadiusRatio: number,
    deviation: number,
  ): Readonly<{ spreadRadiusRatio: number; deviation: number }> {
    if (!Number.isFinite(spreadRadiusRatio) || spreadRadiusRatio < 0 || spreadRadiusRatio > 4) {
      throw new RangeError('invalid runtime brush spray spread radius ratio');
    }
    if (!Number.isFinite(deviation) || deviation < -1 || deviation > 1) {
      throw new RangeError('invalid runtime brush spray deviation');
    }
    if (
      spreadRadiusRatio !== this.#brushSpraySpreadRadiusRatio ||
      deviation !== this.#brushSprayDeviation
    ) {
      this.#clearActiveStroke();
    }
    this.#brushSpraySpreadRadiusRatio = spreadRadiusRatio;
    this.#brushSprayDeviation = deviation;
    return Object.freeze({ spreadRadiusRatio, deviation });
  }

  brushSpraySpread(): Readonly<{ spreadRadiusRatio: number; deviation: number }> {
    return Object.freeze({
      spreadRadiusRatio: this.#brushSpraySpreadRadiusRatio,
      deviation: this.#brushSprayDeviation,
    });
  }

  setBrushTipAngleDegrees(angleDegrees: number): number {
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    '        sprayParticleSizeRatio: this.#brushSprayParticleSizeRatio,\n        sprayParticleDensity: this.#brushSprayParticleDensity,\n        randomSeed: randomSeed ?? 0,\n',
    '        sprayParticleSizeRatio: this.#brushSprayParticleSizeRatio,\n        sprayParticleDensity: this.#brushSprayParticleDensity,\n        spraySpreadRadiusRatio: this.#brushSpraySpreadRadiusRatio,\n        sprayDeviation: this.#brushSprayDeviation,\n        randomSeed: randomSeed ?? 0,\n',
)

# Preset library mutation plumbing.
replace_once(
    'src/app/brush-preset-library.ts',
    '  withBrushSprayParticleSizeRatioV1,\n  withBrushSprayParticleDensityV1,\n  withBrushStrokeSpacingV1,\n',
    '  withBrushSprayParticleSizeRatioV1,\n  withBrushSprayParticleDensityV1,\n  withBrushSpraySpreadRadiusRatioV1,\n  withBrushSprayDeviationV1,\n  withBrushStrokeSpacingV1,\n',
)
append_once(
    'src/app/brush-preset-library.ts',
    'export function updateBrushPresetSpraySpreadV1(',
    """
export function updateBrushPresetSpraySpreadV1(
  state: BrushPresetLibraryStateV1,
  presetId: string,
  spreadRadiusRatio: number,
  deviation: number,
): BrushPresetLibraryStateV1 {
  return updateItemV1(state, presetId, (item) => {
    if (item.locked) throw new Error('locked brush preset cannot be edited');
    const withRadius = withBrushSpraySpreadRadiusRatioV1(item.preset, spreadRadiusRatio);
    const current = withBrushSprayDeviationV1(withRadius, deviation);
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
""",
)

# Tool Properties controller.
replace_once(
    'src/app/brush-preset-controller.ts',
    '  brushSprayParticleSizeRatioV1,\n  brushSprayParticleDensityV1,\n  BUILTIN_BRUSH_GRAIN_RESOURCES_V1,\n',
    '  brushSprayParticleSizeRatioV1,\n  brushSprayParticleDensityV1,\n  brushSpraySpreadRadiusRatioV1,\n  brushSprayDeviationV1,\n  BUILTIN_BRUSH_GRAIN_RESOURCES_V1,\n',
)
replace_once(
    'src/app/brush-preset-controller.ts',
    '  updateBrushPresetSprayParticleSizeRatioV1,\n  updateBrushPresetSprayParticleDensityV1,\n  updateBrushPresetSpacingV1,\n',
    '  updateBrushPresetSprayParticleSizeRatioV1,\n  updateBrushPresetSprayParticleDensityV1,\n  updateBrushPresetSpraySpreadV1,\n  updateBrushPresetSpacingV1,\n',
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  const sprayParticleDensityNumber = requireElement(
    '#brush-spray-particle-density-number',
    HTMLInputElement,
  );
  const tipShape = requireElement('#brush-tip-shape', HTMLSelectElement);
""",
    """  const sprayParticleDensityNumber = requireElement(
    '#brush-spray-particle-density-number',
    HTMLInputElement,
  );
  const spraySpreadRadiusRange = requireElement('#brush-spray-spread-radius-range', HTMLInputElement);
  const spraySpreadRadiusNumber = requireElement('#brush-spray-spread-radius-number', HTMLInputElement);
  const sprayDeviationRange = requireElement('#brush-spray-deviation-range', HTMLInputElement);
  const sprayDeviationNumber = requireElement('#brush-spray-deviation-number', HTMLInputElement);
  const tipShape = requireElement('#brush-tip-shape', HTMLSelectElement);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    const sprayParticleDensity = brushSprayParticleDensityV1(item.preset);
    input.paintSession.setBrushSprayParticleDensity(sprayParticleDensity);
    const tipAssets = brushTipAssetsV1(item.preset);
""",
    """    const sprayParticleDensity = brushSprayParticleDensityV1(item.preset);
    input.paintSession.setBrushSprayParticleDensity(sprayParticleDensity);
    const spraySpreadRadiusRatio = brushSpraySpreadRadiusRatioV1(item.preset);
    const sprayDeviation = brushSprayDeviationV1(item.preset);
    input.paintSession.setBrushSpraySpread(spraySpreadRadiusRatio, sprayDeviation);
    const tipAssets = brushTipAssetsV1(item.preset);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    '    input.root.dataset.illustroBrushSprayParticleDensity = String(sprayParticleDensity);\n    input.root.dataset.illustroBrushTipShape = brushTipShapeV1(item.preset);\n',
    '    input.root.dataset.illustroBrushSprayParticleDensity = String(sprayParticleDensity);\n    input.root.dataset.illustroBrushSpraySpreadRadiusRatio = String(spraySpreadRadiusRatio);\n    input.root.dataset.illustroBrushSprayDeviation = String(sprayDeviation);\n    input.root.dataset.illustroBrushTipShape = brushTipShapeV1(item.preset);\n',
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    configurePair(
      sprayParticleDensityRange,
      sprayParticleDensityNumber,
      1,
      32,
      1,
      sprayParticleDensity,
    );
    tipShape.value = brushTipShapeV1(selected.preset);
""",
    """    configurePair(
      sprayParticleDensityRange,
      sprayParticleDensityNumber,
      1,
      32,
      1,
      sprayParticleDensity,
    );
    const spraySpreadRadiusRatio = brushSpraySpreadRadiusRatioV1(selected.preset);
    const sprayDeviation = brushSprayDeviationV1(selected.preset);
    configurePair(
      spraySpreadRadiusRange,
      spraySpreadRadiusNumber,
      0,
      400,
      1,
      spraySpreadRadiusRatio * 100,
    );
    configurePair(sprayDeviationRange, sprayDeviationNumber, -100, 100, 1, sprayDeviation * 100);
    tipShape.value = brushTipShapeV1(selected.preset);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    const sprayParticleDensityLabel = sprayEnabled ? ` · Density${sprayParticleDensity}` : '';
    propertyStatus.textContent = """,
    """    const sprayParticleDensityLabel = sprayEnabled ? ` · Density${sprayParticleDensity}` : '';
    const spraySpreadLabel = sprayEnabled
      ? ` · Spread${Math.round(spraySpreadRadiusRatio * 100)}%${sprayDeviation === 0 ? '' : `/Dev${Math.round(sprayDeviation * 100)}%`}`
      : '';
    propertyStatus.textContent = """,
)
replace_once(
    'src/app/brush-preset-controller.ts',
    '${sprayLabel}${sprayParticleSizeLabel}${sprayParticleDensityLabel}`;\n',
    '${sprayLabel}${sprayParticleSizeLabel}${sprayParticleDensityLabel}${spraySpreadLabel}`;\n',
)
replace_once(
    'src/app/brush-preset-controller.ts',
    '      sprayParticleDensityRange,\n      sprayParticleDensityNumber,\n      tipShape,\n',
    '      sprayParticleDensityRange,\n      sprayParticleDensityNumber,\n      spraySpreadRadiusRange,\n      spraySpreadRadiusNumber,\n      sprayDeviationRange,\n      sprayDeviationNumber,\n      tipShape,\n',
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    sprayParticleDensityRange.disabled = locked || !sprayEnabled;
    sprayParticleDensityNumber.disabled = locked || !sprayEnabled;
    pressureCurveEditor?.setDisabled(locked);
""",
    """    sprayParticleDensityRange.disabled = locked || !sprayEnabled;
    sprayParticleDensityNumber.disabled = locked || !sprayEnabled;
    spraySpreadRadiusRange.disabled = locked || !sprayEnabled;
    spraySpreadRadiusNumber.disabled = locked || !sprayEnabled;
    sprayDeviationRange.disabled = locked || !sprayEnabled;
    sprayDeviationNumber.disabled = locked || !sprayEnabled;
    pressureCurveEditor?.setDisabled(locked);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  const onSprayParticleDensityNumber = (): void =>
    updateSprayParticleDensity(Number(sprayParticleDensityNumber.value));
  const onTipShape = (): void => {
""",
    """  const onSprayParticleDensityNumber = (): void =>
    updateSprayParticleDensity(Number(sprayParticleDensityNumber.value));
  const updateSpraySpread = (spreadPercent: number, deviationPercent: number): void =>
    mutate(() =>
      updateBrushPresetSpraySpreadV1(
        state,
        state.selectedPresetId,
        spreadPercent / 100,
        deviationPercent / 100,
      ),
    );
  const onSpraySpreadRadiusRange = (): void =>
    updateSpraySpread(Number(spraySpreadRadiusRange.value), Number(sprayDeviationRange.value));
  const onSpraySpreadRadiusNumber = (): void =>
    updateSpraySpread(Number(spraySpreadRadiusNumber.value), Number(sprayDeviationNumber.value));
  const onSprayDeviationRange = (): void =>
    updateSpraySpread(Number(spraySpreadRadiusRange.value), Number(sprayDeviationRange.value));
  const onSprayDeviationNumber = (): void =>
    updateSpraySpread(Number(spraySpreadRadiusNumber.value), Number(sprayDeviationNumber.value));
  const onTipShape = (): void => {
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  sprayParticleDensityRange.addEventListener('input', onSprayParticleDensityRange);
  sprayParticleDensityNumber.addEventListener('change', onSprayParticleDensityNumber);
  tipShape.addEventListener('change', onTipShape);
""",
    """  sprayParticleDensityRange.addEventListener('input', onSprayParticleDensityRange);
  sprayParticleDensityNumber.addEventListener('change', onSprayParticleDensityNumber);
  spraySpreadRadiusRange.addEventListener('input', onSpraySpreadRadiusRange);
  spraySpreadRadiusNumber.addEventListener('change', onSpraySpreadRadiusNumber);
  sprayDeviationRange.addEventListener('input', onSprayDeviationRange);
  sprayDeviationNumber.addEventListener('change', onSprayDeviationNumber);
  tipShape.addEventListener('change', onTipShape);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """      sprayParticleDensityRange.removeEventListener('input', onSprayParticleDensityRange);
      sprayParticleDensityNumber.removeEventListener('change', onSprayParticleDensityNumber);
      pressureCurveEditor?.dispose();
""",
    """      sprayParticleDensityRange.removeEventListener('input', onSprayParticleDensityRange);
      sprayParticleDensityNumber.removeEventListener('change', onSprayParticleDensityNumber);
      spraySpreadRadiusRange.removeEventListener('input', onSpraySpreadRadiusRange);
      spraySpreadRadiusNumber.removeEventListener('change', onSpraySpreadRadiusNumber);
      sprayDeviationRange.removeEventListener('input', onSprayDeviationRange);
      sprayDeviationNumber.removeEventListener('change', onSprayDeviationNumber);
      pressureCurveEditor?.dispose();
""",
)

# Reachable UI rows, under the existing Spray controls.
replace_once(
    'src/index.html',
    """              <div class="shell-brush-property-row">
                <label for="brush-spray-particle-density-range">粒子密度</label>
                <input id="brush-spray-particle-density-range" type="range" min="1" max="32" step="1" value="4" disabled />
                <span class="shell-brush-property-number"><input id="brush-spray-particle-density-number" type="number" inputmode="numeric" min="1" max="32" step="1" value="4" aria-label="散布粒子密度" disabled /><span>粒/stamp</span></span>
              </div>
              <div class="shell-brush-property-row shell-brush-tip-property-row">
""",
    """              <div class="shell-brush-property-row">
                <label for="brush-spray-particle-density-range">粒子密度</label>
                <input id="brush-spray-particle-density-range" type="range" min="1" max="32" step="1" value="4" disabled />
                <span class="shell-brush-property-number"><input id="brush-spray-particle-density-number" type="number" inputmode="numeric" min="1" max="32" step="1" value="4" aria-label="散布粒子密度" disabled /><span>粒/stamp</span></span>
              </div>
              <div class="shell-brush-property-row">
                <label for="brush-spray-spread-radius-range">散布範囲</label>
                <input id="brush-spray-spread-radius-range" type="range" min="0" max="400" step="1" value="100" disabled />
                <span class="shell-brush-property-number shell-brush-property-percent"><input id="brush-spray-spread-radius-number" type="number" inputmode="decimal" min="0" max="400" step="1" value="100" aria-label="散布範囲" disabled /><span>%</span></span>
              </div>
              <div class="shell-brush-property-row">
                <label for="brush-spray-deviation-range">分布偏り</label>
                <input id="brush-spray-deviation-range" type="range" min="-100" max="100" step="1" value="0" disabled />
                <span class="shell-brush-property-number shell-brush-property-percent"><input id="brush-spray-deviation-number" type="number" inputmode="decimal" min="-100" max="100" step="1" value="0" aria-label="散布分布偏り。負は外周寄り、正は中心寄り" disabled /><span>%</span></span>
              </div>
              <div class="shell-brush-property-row shell-brush-tip-property-row">
""",
)

# Focused regression coverage.
write(
    'tests/unit/brush-particle-spread.test.ts',
    """import { describe, expect, it } from 'vitest';
import {
  brushSprayDeviationV1,
  brushSpraySpreadRadiusRatioV1,
  createBaselineBrushPresetV1,
  withBrushSprayDeviationV1,
  withBrushSpraySpreadRadiusRatioV1,
} from '../../src/domain/brush-schema.js';
import { PaintSessionControllerV1 } from '../../src/app/paint-session-controller.js';
import { BaselineBrushDabBuilderV1 } from '../../src/gpu/baseline-brush.js';

class FakeRendererDocumentPort {
  async configureDocument(): Promise<void> {}
  async restoreBaselineStrokes(): Promise<void> {}
  async applyBaselineTilePatches(): Promise<void> {}
  async restoreBaselineCanonicalTiles(): Promise<void> {}
  async exportBaselineCanonicalTiles(): Promise<readonly never[]> {
    return [];
  }
  async exportBaselineCompositeTiles(): Promise<readonly never[]> {
    return [];
  }
}

function radiiFrom(centerX: number, centerY: number, dabs: readonly { x: number; y: number }[]): number[] {
  return dabs.map((dab) => Math.hypot(dab.x - centerX, dab.y - centerY));
}

describe('M6A-060 spray particle spread', () => {
  it('stores a 1x spread radius and uniform distribution as exact defaults', () => {
    const preset = createBaselineBrushPresetV1({
      id: 'test.spray-spread',
      name: 'Spray Spread',
      category: 'Test',
      behavior: 'paint',
    });
    expect(brushSpraySpreadRadiusRatioV1(preset)).toBe(1);
    expect(brushSprayDeviationV1(preset)).toBe(0);
    const changed = withBrushSprayDeviationV1(withBrushSpraySpreadRadiusRatioV1(preset, 2.5), -0.4);
    expect(brushSpraySpreadRadiusRatioV1(changed)).toBe(2.5);
    expect(brushSprayDeviationV1(changed)).toBe(-0.4);
    expect(changed.spray.spreadRadiusRatio).toBe(2.5);
    expect(changed.spray.deviation).toBe(-0.4);
    const reset = withBrushSprayDeviationV1(withBrushSpraySpreadRadiusRatioV1(changed, 1), 0);
    expect(reset.spray.spreadRadiusRatio).toBeUndefined();
    expect(reset.spray.deviation).toBeUndefined();
    expect(() => withBrushSpraySpreadRadiusRatioV1(preset, -0.01)).toThrow(RangeError);
    expect(() => withBrushSpraySpreadRadiusRatioV1(preset, 4.01)).toThrow(RangeError);
    expect(() => withBrushSprayDeviationV1(preset, -1.01)).toThrow(RangeError);
    expect(() => withBrushSprayDeviationV1(preset, 1.01)).toThrow(RangeError);
  });

  it('keeps 1x spread and zero deviation identical to the established spray baseline', () => {
    const implicit = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      sprayEnabled: true,
      sprayParticleDensity: 8,
      randomSeed: 0x12345678,
    });
    const explicit = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      sprayEnabled: true,
      sprayParticleDensity: 8,
      spraySpreadRadiusRatio: 1,
      sprayDeviation: 0,
      randomSeed: 0x12345678,
    });
    expect(explicit.beginDelta({ documentX: 40, documentY: 50 })).toEqual(
      implicit.beginDelta({ documentX: 40, documentY: 50 }),
    );
  });

  it('scales only particle-center offsets when spread radius changes', () => {
    const seed = 0x2468ace0;
    const one = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      sprayEnabled: true,
      sprayParticleDensity: 8,
      spraySpreadRadiusRatio: 1,
      randomSeed: seed,
    });
    const two = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      sprayEnabled: true,
      sprayParticleDensity: 8,
      spraySpreadRadiusRatio: 2,
      randomSeed: seed,
    });
    const oneDabs = one.beginDelta({ documentX: 20, documentY: 30 });
    const twoDabs = two.beginDelta({ documentX: 20, documentY: 30 });
    const oneRadii = radiiFrom(20, 30, oneDabs);
    const twoRadii = radiiFrom(20, 30, twoDabs);
    expect(twoDabs).toHaveLength(oneDabs.length);
    for (let index = 0; index < oneDabs.length; index += 1) {
      expect(twoRadii[index]).toBeCloseTo((oneRadii[index] ?? 0) * 2, 10);
      expect(twoDabs[index]?.radius).toBeCloseTo(oneDabs[index]?.radius ?? 0, 10);
      expect(twoDabs[index]?.tipAngleDegrees).toBe(oneDabs[index]?.tipAngleDegrees);
    }
  });

  it('uses positive deviation for center bias and negative deviation for edge bias', () => {
    const seed = 0x0badc0de;
    const make = (deviation: number) => {
      const brush = new BaselineBrushDabBuilderV1({
        sizePx: 20,
        sprayEnabled: true,
        sprayParticleDensity: 12,
        spraySpreadRadiusRatio: 1,
        sprayDeviation: deviation,
        randomSeed: seed,
      });
      return brush.beginDelta({ documentX: 0, documentY: 0 });
    };
    const uniform = radiiFrom(0, 0, make(0));
    const inward = radiiFrom(0, 0, make(0.5));
    const outward = radiiFrom(0, 0, make(-0.5));
    expect(inward.every((radius, index) => radius <= (uniform[index] ?? 0) + 1e-10)).toBe(true);
    expect(outward.every((radius, index) => radius >= (uniform[index] ?? 0) - 1e-10)).toBe(true);
    expect(inward.some((radius, index) => radius < (uniform[index] ?? 0) - 1e-8)).toBe(true);
    expect(outward.some((radius, index) => radius > (uniform[index] ?? 0) + 1e-8)).toBe(true);
  });

  it('keeps count and deterministic particle ordering stable across spread settings', () => {
    const seed = 0x89abcdef;
    const compact = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      sprayEnabled: true,
      sprayParticleDensity: 6,
      spraySpreadRadiusRatio: 0.5,
      sprayDeviation: 0.25,
      randomSeed: seed,
    });
    const broad = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      sprayEnabled: true,
      sprayParticleDensity: 6,
      spraySpreadRadiusRatio: 3,
      sprayDeviation: -0.25,
      randomSeed: seed,
    });
    const compactDabs = compact.beginDelta({ documentX: 0, documentY: 0 });
    const broadDabs = broad.beginDelta({ documentX: 0, documentY: 0 });
    expect(compactDabs).toHaveLength(6);
    expect(broadDabs).toHaveLength(6);
    expect(broadDabs.map((dab) => dab.radius)).toEqual(compactDabs.map((dab) => dab.radius));
    expect(broadDabs.map((dab) => dab.color)).toEqual(compactDabs.map((dab) => dab.color));
  });

  it('is inert when Scatter is off', () => {
    const baseline = new BaselineBrushDabBuilderV1({ sizePx: 20, randomSeed: 5 });
    const configured = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      sprayEnabled: false,
      spraySpreadRadiusRatio: 4,
      sprayDeviation: -1,
      randomSeed: 5,
    });
    expect(configured.beginDelta({ documentX: 10, documentY: 10 })).toEqual(
      baseline.beginDelta({ documentX: 10, documentY: 10 }),
    );
  });

  it('reuses resolved spread centers during mutable end-tail reconciliation', () => {
    const brush = new BaselineBrushDabBuilderV1({
      sizePx: 10,
      spacingRatio: 1,
      endTaperLengthPx: 10,
      sizeTaperMinimumRatio: 1,
      opacityTaperMinimumRatio: 1,
      sprayEnabled: true,
      sprayParticleDensity: 7,
      spraySpreadRadiusRatio: 2,
      sprayDeviation: -0.35,
      randomSeed: 0xfeed1234,
    });
    brush.begin({ documentX: 0, documentY: 0 });
    brush.append([
      { documentX: 10, documentY: 0 },
      { documentX: 20, documentY: 0 },
    ]);
    const before = brush.dabs().map((dab) => [dab.x, dab.y]);
    brush.finish();
    expect(brush.dabs().map((dab) => [dab.x, dab.y])).toEqual(before);
  });

  it('captures spread in runtime state without adding spread fields to primitive dabs', () => {
    const session = new PaintSessionControllerV1(new FakeRendererDocumentPort());
    expect(session.setBrushSpraySpread(1.75, -0.3)).toEqual({ spreadRadiusRatio: 1.75, deviation: -0.3 });
    expect(session.snapshot().brushSpraySpreadRadiusRatio).toBe(1.75);
    expect(session.snapshot().brushSprayDeviation).toBe(-0.3);
    const [dab] = new BaselineBrushDabBuilderV1({
      sprayEnabled: true,
      spraySpreadRadiusRatio: 1.75,
      sprayDeviation: -0.3,
      randomSeed: 7,
    }).beginDelta({ documentX: 0, documentY: 0 });
    expect(dab).toBeDefined();
    expect('spraySpreadRadiusRatio' in (dab ?? {})).toBe(false);
    expect('sprayDeviation' in (dab ?? {})).toBe(false);
  });
});
""",
)

append_once(
    'scripts/verify-m6a-brush.mjs',
    'M6A-060 progress is not complete',
    """
requireText(progress, 'M6A-060 particle spread:完了', 'M6A-060 progress is not complete');
requireText(
  read('src/domain/brush-schema.ts'),
  'brushSpraySpreadRadiusRatioV1',
  'spray spread-radius preset helper missing',
);
requireText(
  read('src/domain/brush-schema.ts'),
  'brushSprayDeviationV1',
  'spray radial-deviation preset helper missing',
);
requireText(
  read('src/gpu/baseline-brush.ts'),
  'applyBaselineBrushSprayDeviationV1',
  'spray radial distribution transform missing',
);
requireText(
  read('src/gpu/baseline-brush.ts'),
  'this.#radius * this.#spraySpreadRadiusRatio',
  'spray spread radius is not connected to canonical particle centers',
);
requireText(
  read('src/index.html'),
  'id="brush-spray-spread-radius-range"',
  'reachable spray spread-radius control missing',
);
requireText(
  read('src/index.html'),
  'id="brush-spray-deviation-range"',
  'reachable spray distribution-deviation control missing',
);
requireText(
  read('tests/unit/brush-particle-spread.test.ts'),
  'positive deviation for center bias and negative deviation for edge bias',
  'spray particle-spread regression coverage missing',
);
""",
)
replace_once(
    'IMPLEMENTATION_PROGRESS.md',
    'M6A-060 particle spread:未完了\nM6A-061 particle orientation:未完了\n',
    """M6A-060 particle spread:完了
再開メモ: M6A-060 particle spreadはCanonical Brush Modelのradial scatter distributionをspray.spreadRadiusRatio（base brush radius比0..4、既定1）とspray.deviation（-1..1、既定0）で実装する。既定1/0ではM6A-057〜059のunit-disk散布を完全互換に維持する。spreadRadiusRatioはposition-jitter後のlogical centerからの最大散布半径だけをscaleし、粒子radius/count/angle/color/opacity/densityやstroke spacing/path/tangentへfeedbackしない。deviationは同じdeterministic particle angle/radial sampleを再利用し、正値ではradiusを中心側へ線形圧縮、負値では外周側へ線形補間するため新しい乱数系列を追加しない。0は既存uniform-area unit-diskをそのまま返し、+1は中心、-1は外周へ極限化する。可視logical recordは変換後particle centerを保持するためend-tail reconciliationで再抽選しない。Scatter OFFでは両値ともinert。preset/runtime/facade/UIを接続しprimitive/Worker/Historyには専用fieldを追加しない。次はM6A-061 particle orientationから再開する。
M6A-061 particle orientation:未完了
""",
)
append_once(
    'ILLUSTRO_DESIGN_MEMO.md',
    '## M6A spray particle-spread boundary — 2026-09-03',
    """
## M6A spray particle-spread boundary — 2026-09-03

**AUTHORITATIVE for M6A-060.** Spray radial scatter is represented by two orthogonal canonical values: `spray.spreadRadiusRatio` (`0..4`, default `1`) controls the maximum scatter radius relative to the base brush radius, while `spray.deviation` (`-1..1`, default `0`) controls radial distribution bias. The default pair reproduces the M6A-057 through M6A-059 unit-disk output exactly.

The deterministic particle generator continues to provide the same isotropic unit-disk sample for each `(stroke seed, spray-stamp index, particle index)`. Spread does not create another random channel. A zero deviation returns that sample unchanged. Positive deviation linearly compresses its radial distance toward the center; negative deviation linearly interpolates the distance toward the outer boundary. Thus positive means center-biased, negative means edge-biased, matching the adopted reference-app sign convention while keeping Illustro's exact numeric mapping explicit and testable rather than claiming undocumented source equivalence.

`spreadRadiusRatio` is applied only when converting the resolved unit vector to a document-space particle center around the already position-jittered logical center. It never feeds back into stroke spacing, path length, tangent/orientation, stabilization, velocity or subsequent stamp placement. Particle size, count/density, orientation, color, opacity, flow and tip-mask density remain unchanged. M6A-061 owns particle orientation.

Resolved particle centers remain on the logical-stamp record and are reused during bounded mutable-tail reconciliation. Scatter OFF makes both parameters inert. Primitive dabs, Worker payloads, history and recovery continue to persist only resolved primitive coordinates and need no spread-specific field.
""",
)
