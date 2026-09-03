from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    if old not in text:
        raise RuntimeError(f"anchor not found in {path}: {old[:180]!r}")
    file.write_text(text.replace(old, new, 1))


def append_once(path: str, marker: str, block: str) -> None:
    file = Path(path)
    text = file.read_text()
    if marker in text:
        return
    file.write_text(text.rstrip() + "\n\n" + block.strip() + "\n")


# -----------------------------------------------------------------------------
# Domain schema: random is an opt-in reusable 0..1 dynamics sensor.
# -----------------------------------------------------------------------------
replace_once(
    'src/domain/brush-schema.ts',
    """export type BrushTipSelectionModeV1 = 'fixed' | 'sequence' | 'random-per-stamp';
""",
    """export const DEFAULT_BRUSH_RANDOM_SIZE_ENABLED_V1 = false as const;
export const DEFAULT_BRUSH_RANDOM_OPACITY_ENABLED_V1 = false as const;
export const DEFAULT_BRUSH_RANDOM_FLOW_ENABLED_V1 = false as const;

export function brushRandomSizeEnabledV1(preset: BrushPresetV1): boolean {
  const value = preset.dynamics.randomSizeEnabled;
  return typeof value === 'boolean' ? value : DEFAULT_BRUSH_RANDOM_SIZE_ENABLED_V1;
}

export function withBrushRandomSizeEnabledV1(
  preset: BrushPresetV1,
  enabled: boolean,
): BrushPresetV1 {
  if (typeof enabled !== 'boolean') throw new TypeError('brush random size flag must be boolean');
  if (enabled === DEFAULT_BRUSH_RANDOM_SIZE_ENABLED_V1) {
    const { randomSizeEnabled: _randomSizeEnabled, ...dynamics } = preset.dynamics;
    return normalizeBrushPresetV1({ ...preset, dynamics });
  }
  return normalizeBrushPresetV1({
    ...preset,
    dynamics: { ...preset.dynamics, randomSizeEnabled: enabled },
  });
}

export function brushRandomOpacityEnabledV1(preset: BrushPresetV1): boolean {
  const value = preset.dynamics.randomOpacityEnabled;
  return typeof value === 'boolean' ? value : DEFAULT_BRUSH_RANDOM_OPACITY_ENABLED_V1;
}

export function withBrushRandomOpacityEnabledV1(
  preset: BrushPresetV1,
  enabled: boolean,
): BrushPresetV1 {
  if (typeof enabled !== 'boolean') throw new TypeError('brush random opacity flag must be boolean');
  if (enabled === DEFAULT_BRUSH_RANDOM_OPACITY_ENABLED_V1) {
    const { randomOpacityEnabled: _randomOpacityEnabled, ...dynamics } = preset.dynamics;
    return normalizeBrushPresetV1({ ...preset, dynamics });
  }
  return normalizeBrushPresetV1({
    ...preset,
    dynamics: { ...preset.dynamics, randomOpacityEnabled: enabled },
  });
}

export function brushRandomFlowEnabledV1(preset: BrushPresetV1): boolean {
  const value = preset.dynamics.randomFlowEnabled;
  return typeof value === 'boolean' ? value : DEFAULT_BRUSH_RANDOM_FLOW_ENABLED_V1;
}

export function withBrushRandomFlowEnabledV1(
  preset: BrushPresetV1,
  enabled: boolean,
): BrushPresetV1 {
  if (typeof enabled !== 'boolean') throw new TypeError('brush random flow flag must be boolean');
  if (enabled === DEFAULT_BRUSH_RANDOM_FLOW_ENABLED_V1) {
    const { randomFlowEnabled: _randomFlowEnabled, ...dynamics } = preset.dynamics;
    return normalizeBrushPresetV1({ ...preset, dynamics });
  }
  return normalizeBrushPresetV1({
    ...preset,
    dynamics: { ...preset.dynamics, randomFlowEnabled: enabled },
  });
}

export function brushRandomResponseCurveV1(preset: BrushPresetV1): readonly ResponseCurvePointV1[] {
  const value = preset.dynamics.randomResponseCurve;
  if (value === undefined) return LINEAR_RESPONSE_CURVE_V1;
  try {
    return normalizeResponseCurveV1(value);
  } catch {
    return LINEAR_RESPONSE_CURVE_V1;
  }
}

export function withBrushRandomResponseCurveV1(
  preset: BrushPresetV1,
  curve: readonly ResponseCurvePointV1[],
): BrushPresetV1 {
  const normalized = normalizeResponseCurveV1(curve);
  if (responseCurveIsLinearV1(normalized)) {
    const { randomResponseCurve: _randomResponseCurve, ...dynamics } = preset.dynamics;
    return normalizeBrushPresetV1({ ...preset, dynamics });
  }
  const stored = toJsonValue(
    normalized.map((pointValue) => ({ input: pointValue.input, output: pointValue.output })),
  );
  return normalizeBrushPresetV1({
    ...preset,
    dynamics: { ...preset.dynamics, randomResponseCurve: stored },
  });
}

export type BrushTipSelectionModeV1 = 'fixed' | 'sequence' | 'random-per-stamp';
""",
)

# -----------------------------------------------------------------------------
# Brush kernel: deterministic random channel independent from tip-selection RNG.
# -----------------------------------------------------------------------------
replace_once(
    'src/gpu/baseline-brush.ts',
    """function deterministicBrushTipIndexV1(seed: number, stampIndex: number, count: number): number {
  let value = (seed ^ Math.imul((stampIndex + 1) >>> 0, 0x9e3779b1)) >>> 0;
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d) >>> 0;
  value ^= value >>> 15;
  value = Math.imul(value, 0x846ca68b) >>> 0;
  value ^= value >>> 16;
  return value % count;
}

interface BaselineLogicalStampRecordV1 {
""",
    """function deterministicBrushTipIndexV1(seed: number, stampIndex: number, count: number): number {
  let value = (seed ^ Math.imul((stampIndex + 1) >>> 0, 0x9e3779b1)) >>> 0;
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d) >>> 0;
  value ^= value >>> 15;
  value = Math.imul(value, 0x846ca68b) >>> 0;
  value ^= value >>> 16;
  return value % count;
}

const BASELINE_BRUSH_RANDOM_DYNAMICS_SALT_V1 = 0xa511e9b3 as const;

export function deterministicBaselineBrushRandomV1(seed: number, stampIndex: number): number {
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) {
    throw new RangeError('baseline brush random seed must be uint32');
  }
  if (!Number.isSafeInteger(stampIndex) || stampIndex < 0) {
    throw new RangeError('baseline brush random stamp index must be a non-negative safe integer');
  }
  let value =
    (seed ^
      BASELINE_BRUSH_RANDOM_DYNAMICS_SALT_V1 ^
      Math.imul((stampIndex + 1) >>> 0, 0x9e3779b1)) >>>
    0;
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d) >>> 0;
  value ^= value >>> 15;
  value = Math.imul(value, 0x846ca68b) >>> 0;
  value ^= value >>> 16;
  return value / 0x100000000;
}

interface BaselineLogicalStampRecordV1 {
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """  readonly velocity: number;
  readonly tiltUprightness: number;
  readonly tipAngleDegrees: number;
""",
    """  readonly velocity: number;
  readonly randomInput: number;
  readonly tiltUprightness: number;
  readonly tipAngleDegrees: number;
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """  readonly #velocityFlowEnabled: boolean;
  readonly #velocityResponseCurve: CompiledResponseCurveV1;
  readonly #flow: number;
""",
    """  readonly #velocityFlowEnabled: boolean;
  readonly #velocityResponseCurve: CompiledResponseCurveV1;
  readonly #randomSizeEnabled: boolean;
  readonly #randomOpacityEnabled: boolean;
  readonly #randomFlowEnabled: boolean;
  readonly #randomResponseCurve: CompiledResponseCurveV1;
  readonly #randomSeed: number;
  readonly #flow: number;
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """  #logicalStampIndex = 0;
  #pathDistancePx = 0;
""",
    """  #logicalStampIndex = 0;
  #randomStampIndex = 0;
  #pathDistancePx = 0;
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """      readonly velocityFlowEnabled?: boolean;
      readonly velocityResponseCurve?: readonly ResponseCurvePointV1[];
      readonly hardness?: number;
""",
    """      readonly velocityFlowEnabled?: boolean;
      readonly velocityResponseCurve?: readonly ResponseCurvePointV1[];
      readonly randomSizeEnabled?: boolean;
      readonly randomOpacityEnabled?: boolean;
      readonly randomFlowEnabled?: boolean;
      readonly randomResponseCurve?: readonly ResponseCurvePointV1[];
      readonly randomSeed?: number;
      readonly hardness?: number;
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """    const velocitySizeEnabled = options.velocitySizeEnabled ?? false;
    const velocityOpacityEnabled = options.velocityOpacityEnabled ?? false;
    const velocityFlowEnabled = options.velocityFlowEnabled ?? false;
    const hardness = options.hardness ?? BASELINE_BRUSH_HARDNESS;
""",
    """    const velocitySizeEnabled = options.velocitySizeEnabled ?? false;
    const velocityOpacityEnabled = options.velocityOpacityEnabled ?? false;
    const velocityFlowEnabled = options.velocityFlowEnabled ?? false;
    const randomSizeEnabled = options.randomSizeEnabled ?? false;
    const randomOpacityEnabled = options.randomOpacityEnabled ?? false;
    const randomFlowEnabled = options.randomFlowEnabled ?? false;
    const randomSeed = options.randomSeed ?? 0;
    const hardness = options.hardness ?? BASELINE_BRUSH_HARDNESS;
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """    if (
      typeof velocitySizeEnabled !== 'boolean' ||
      typeof velocityOpacityEnabled !== 'boolean' ||
      typeof velocityFlowEnabled !== 'boolean'
    ) {
      throw new TypeError('baseline brush velocity mapping flags must be boolean');
    }
    if (!Number.isFinite(hardness) || hardness < 0 || hardness > 1) {
""",
    """    if (
      typeof velocitySizeEnabled !== 'boolean' ||
      typeof velocityOpacityEnabled !== 'boolean' ||
      typeof velocityFlowEnabled !== 'boolean'
    ) {
      throw new TypeError('baseline brush velocity mapping flags must be boolean');
    }
    if (
      typeof randomSizeEnabled !== 'boolean' ||
      typeof randomOpacityEnabled !== 'boolean' ||
      typeof randomFlowEnabled !== 'boolean'
    ) {
      throw new TypeError('baseline brush random mapping flags must be boolean');
    }
    if (!Number.isSafeInteger(randomSeed) || randomSeed < 0 || randomSeed > 0xffffffff) {
      throw new RangeError('baseline brush random seed must be uint32');
    }
    if (!Number.isFinite(hardness) || hardness < 0 || hardness > 1) {
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """    this.#velocityResponseCurve = compileResponseCurveV1(
      options.velocityResponseCurve ?? [
        { input: 0, output: 0 },
        { input: 1, output: 1 },
      ],
    );
    this.#flow = flow;
""",
    """    this.#velocityResponseCurve = compileResponseCurveV1(
      options.velocityResponseCurve ?? [
        { input: 0, output: 0 },
        { input: 1, output: 1 },
      ],
    );
    this.#randomSizeEnabled = randomSizeEnabled;
    this.#randomOpacityEnabled = randomOpacityEnabled;
    this.#randomFlowEnabled = randomFlowEnabled;
    this.#randomResponseCurve = compileResponseCurveV1(
      options.randomResponseCurve ?? [
        { input: 0, output: 0 },
        { input: 1, output: 1 },
      ],
    );
    this.#randomSeed = randomSeed >>> 0;
    this.#flow = flow;
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """      | 'velocity'
      | 'tiltUprightness'
""",
    """      | 'velocity'
      | 'randomInput'
      | 'tiltUprightness'
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """    const velocityFlowScale = this.#velocityFlowEnabled ? velocityResponse : 1;
    if (
""",
    """    const velocityFlowScale = this.#velocityFlowEnabled ? velocityResponse : 1;
    const usesRandom = this.#randomSizeEnabled || this.#randomOpacityEnabled || this.#randomFlowEnabled;
    const randomResponse = usesRandom ? this.#randomResponseCurve.sample(stamp.randomInput) : 1;
    const randomSizeScale = this.#randomSizeEnabled ? randomResponse : 1;
    const randomOpacityScale = this.#randomOpacityEnabled ? randomResponse : 1;
    const randomFlowScale = this.#randomFlowEnabled ? randomResponse : 1;
    if (
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """      velocitySizeScale <= 0 ||
      velocityOpacityScale <= 0 ||
      velocityFlowScale <= 0
    ) {
""",
    """      velocitySizeScale <= 0 ||
      velocityOpacityScale <= 0 ||
      velocityFlowScale <= 0 ||
      randomSizeScale <= 0 ||
      randomOpacityScale <= 0 ||
      randomFlowScale <= 0
    ) {
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """      this.#radius * sizeScale * pressureSizeScale * tiltSizeScale * velocitySizeScale,
      this.#flow * opacityScale * pressureFlowScale * tiltFlowScale * velocityFlowScale,
      this.#strokeOpacity * pressureOpacityScale * tiltOpacityScale * velocityOpacityScale,
""",
    """      this.#radius *
        sizeScale *
        pressureSizeScale *
        tiltSizeScale *
        velocitySizeScale *
        randomSizeScale,
      this.#flow *
        opacityScale *
        pressureFlowScale *
        tiltFlowScale *
        velocityFlowScale *
        randomFlowScale,
      this.#strokeOpacity *
        pressureOpacityScale *
        tiltOpacityScale *
        velocityOpacityScale *
        randomOpacityScale,
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """  ): void {
    const startEnvelope = this.#startEnvelopeAtDistance(pathDistancePx);
    const sampledTipAlpha = this.#sampledTipAlphaForLogicalStamp();
    const record: BaselineLogicalStampRecordV1 = {
      x,
      y,
      pressure,
      velocity,
      tiltUprightness,
""",
    """  ): void {
    const startEnvelope = this.#startEnvelopeAtDistance(pathDistancePx);
    const usesRandom = this.#randomSizeEnabled || this.#randomOpacityEnabled || this.#randomFlowEnabled;
    const randomInput = usesRandom
      ? deterministicBaselineBrushRandomV1(this.#randomSeed, this.#randomStampIndex)
      : 1;
    if (usesRandom) this.#randomStampIndex += 1;
    const sampledTipAlpha = this.#sampledTipAlphaForLogicalStamp();
    const record: BaselineLogicalStampRecordV1 = {
      x,
      y,
      pressure,
      velocity,
      randomInput,
      tiltUprightness,
""",
)

# -----------------------------------------------------------------------------
# Canonical facade forwards random configuration and seed; no primitive ABI change.
# -----------------------------------------------------------------------------
replace_once(
    'src/app/canonical-raster-brush.ts',
    """      readonly velocityFlowEnabled?: boolean;
      readonly velocityResponseCurve?: readonly ResponseCurvePointV1[];
      readonly hardness?: number;
""",
    """      readonly velocityFlowEnabled?: boolean;
      readonly velocityResponseCurve?: readonly ResponseCurvePointV1[];
      readonly randomSizeEnabled?: boolean;
      readonly randomOpacityEnabled?: boolean;
      readonly randomFlowEnabled?: boolean;
      readonly randomResponseCurve?: readonly ResponseCurvePointV1[];
      readonly randomSeed?: number;
      readonly hardness?: number;
""",
)
replace_once(
    'src/app/canonical-raster-brush.ts',
    """      ...(options.velocityResponseCurve === undefined
        ? {}
        : { velocityResponseCurve: options.velocityResponseCurve }),
      ...(options.hardness === undefined ? {} : { hardness: options.hardness }),
""",
    """      ...(options.velocityResponseCurve === undefined
        ? {}
        : { velocityResponseCurve: options.velocityResponseCurve }),
      ...(options.randomSizeEnabled === undefined
        ? {}
        : { randomSizeEnabled: options.randomSizeEnabled }),
      ...(options.randomOpacityEnabled === undefined
        ? {}
        : { randomOpacityEnabled: options.randomOpacityEnabled }),
      ...(options.randomFlowEnabled === undefined
        ? {}
        : { randomFlowEnabled: options.randomFlowEnabled }),
      ...(options.randomResponseCurve === undefined
        ? {}
        : { randomResponseCurve: options.randomResponseCurve }),
      ...(options.randomSeed === undefined ? {} : { randomSeed: options.randomSeed }),
      ...(options.hardness === undefined ? {} : { hardness: options.hardness }),
""",
)

# -----------------------------------------------------------------------------
# Paint session runtime state + saved deterministic stroke seed ownership.
# -----------------------------------------------------------------------------
replace_once(
    'src/app/paint-session-controller.ts',
    """  readonly brushVelocityResponseCurve: readonly ResponseCurvePointV1[];
  readonly brushVelocityMaximumPxPerSecond: number;
  readonly brushTipAngleDegrees: number;
""",
    """  readonly brushVelocityResponseCurve: readonly ResponseCurvePointV1[];
  readonly brushVelocityMaximumPxPerSecond: number;
  readonly brushRandomSizeEnabled: boolean;
  readonly brushRandomOpacityEnabled: boolean;
  readonly brushRandomFlowEnabled: boolean;
  readonly brushRandomResponseCurve: readonly ResponseCurvePointV1[];
  readonly brushTipAngleDegrees: number;
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """  #brushVelocityResponseCurve: readonly ResponseCurvePointV1[] = LINEAR_RESPONSE_CURVE_V1;
  #brushVelocityMaximumPxPerSecond: number = DEFAULT_BRUSH_VELOCITY_MAXIMUM_PX_PER_SECOND_V1;
  #brushTipAngleDegrees: number = BASELINE_BRUSH_TIP_ANGLE_DEGREES;
""",
    """  #brushVelocityResponseCurve: readonly ResponseCurvePointV1[] = LINEAR_RESPONSE_CURVE_V1;
  #brushVelocityMaximumPxPerSecond: number = DEFAULT_BRUSH_VELOCITY_MAXIMUM_PX_PER_SECOND_V1;
  #brushRandomSizeEnabled = false;
  #brushRandomOpacityEnabled = false;
  #brushRandomFlowEnabled = false;
  #brushRandomResponseCurve: readonly ResponseCurvePointV1[] = LINEAR_RESPONSE_CURVE_V1;
  #brushTipAngleDegrees: number = BASELINE_BRUSH_TIP_ANGLE_DEGREES;
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """      brushVelocityResponseCurve: this.#brushVelocityResponseCurve,
      brushVelocityMaximumPxPerSecond: this.#brushVelocityMaximumPxPerSecond,
      brushTipAngleDegrees: this.#brushTipAngleDegrees,
""",
    """      brushVelocityResponseCurve: this.#brushVelocityResponseCurve,
      brushVelocityMaximumPxPerSecond: this.#brushVelocityMaximumPxPerSecond,
      brushRandomSizeEnabled: this.#brushRandomSizeEnabled,
      brushRandomOpacityEnabled: this.#brushRandomOpacityEnabled,
      brushRandomFlowEnabled: this.#brushRandomFlowEnabled,
      brushRandomResponseCurve: this.#brushRandomResponseCurve,
      brushTipAngleDegrees: this.#brushTipAngleDegrees,
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """  brushVelocityMaximumPxPerSecond(): number {
    return this.#brushVelocityMaximumPxPerSecond;
  }

  setBrushTipAngleDegrees(angleDegrees: number): number {
""",
    """  brushVelocityMaximumPxPerSecond(): number {
    return this.#brushVelocityMaximumPxPerSecond;
  }

  setBrushRandomSizeEnabled(enabled: boolean): boolean {
    if (typeof enabled !== 'boolean') throw new TypeError('invalid runtime random-size flag');
    if (enabled !== this.#brushRandomSizeEnabled) this.#clearActiveStroke();
    this.#brushRandomSizeEnabled = enabled;
    return this.#brushRandomSizeEnabled;
  }

  brushRandomSizeEnabled(): boolean {
    return this.#brushRandomSizeEnabled;
  }

  setBrushRandomOpacityEnabled(enabled: boolean): boolean {
    if (typeof enabled !== 'boolean') throw new TypeError('invalid runtime random-opacity flag');
    if (enabled !== this.#brushRandomOpacityEnabled) this.#clearActiveStroke();
    this.#brushRandomOpacityEnabled = enabled;
    return this.#brushRandomOpacityEnabled;
  }

  brushRandomOpacityEnabled(): boolean {
    return this.#brushRandomOpacityEnabled;
  }

  setBrushRandomFlowEnabled(enabled: boolean): boolean {
    if (typeof enabled !== 'boolean') throw new TypeError('invalid runtime random-flow flag');
    if (enabled !== this.#brushRandomFlowEnabled) this.#clearActiveStroke();
    this.#brushRandomFlowEnabled = enabled;
    return this.#brushRandomFlowEnabled;
  }

  brushRandomFlowEnabled(): boolean {
    return this.#brushRandomFlowEnabled;
  }

  setBrushRandomResponseCurve(
    curve: readonly ResponseCurvePointV1[],
  ): readonly ResponseCurvePointV1[] {
    const normalized = normalizeResponseCurveV1(curve);
    if (!responseCurveEqualsV1(normalized, this.#brushRandomResponseCurve)) this.#clearActiveStroke();
    this.#brushRandomResponseCurve = normalized;
    return this.#brushRandomResponseCurve;
  }

  brushRandomResponseCurve(): readonly ResponseCurvePointV1[] {
    return this.#brushRandomResponseCurve;
  }

  setBrushTipAngleDegrees(angleDegrees: number): number {
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """    const randomSeed =
      this.#brushTipSelectionMode === 'random-per-stamp'
        ? deterministicPaintStrokeSeedV1(strokeId)
        : undefined;
""",
    """    const randomDynamicsEnabled =
      this.#brushRandomSizeEnabled || this.#brushRandomOpacityEnabled || this.#brushRandomFlowEnabled;
    const randomSeed =
      this.#brushTipSelectionMode === 'random-per-stamp' || randomDynamicsEnabled
        ? deterministicPaintStrokeSeedV1(strokeId)
        : undefined;
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """        velocityFlowEnabled: this.#brushVelocityFlowEnabled,
        velocityResponseCurve: this.#brushVelocityResponseCurve,
        hardness: this.#brushHardness,
""",
    """        velocityFlowEnabled: this.#brushVelocityFlowEnabled,
        velocityResponseCurve: this.#brushVelocityResponseCurve,
        randomSizeEnabled: this.#brushRandomSizeEnabled,
        randomOpacityEnabled: this.#brushRandomOpacityEnabled,
        randomFlowEnabled: this.#brushRandomFlowEnabled,
        randomResponseCurve: this.#brushRandomResponseCurve,
        randomSeed: randomSeed ?? 0,
        hardness: this.#brushHardness,
""",
)

# -----------------------------------------------------------------------------
# Preset library mutation helpers.
# -----------------------------------------------------------------------------
replace_once(
    'src/app/brush-preset-library.ts',
    """  withBrushVelocityResponseCurveV1,
  withBrushVelocityMaximumPxPerSecondV1,
  withBrushStrokeSpacingV1,
""",
    """  withBrushVelocityResponseCurveV1,
  withBrushVelocityMaximumPxPerSecondV1,
  withBrushRandomSizeEnabledV1,
  withBrushRandomOpacityEnabledV1,
  withBrushRandomFlowEnabledV1,
  withBrushRandomResponseCurveV1,
  withBrushStrokeSpacingV1,
""",
)
replace_once(
    'src/app/brush-preset-library.ts',
    """export function updateBrushPresetCustomTipV1(
""",
    """export function updateBrushPresetRandomSizeV1(
  state: BrushPresetLibraryStateV1,
  presetId: string,
  enabled: boolean,
): BrushPresetLibraryStateV1 {
  return updateItemV1(state, presetId, (item) => {
    if (item.locked) throw new Error('locked brush preset cannot be edited');
    const current = withBrushRandomSizeEnabledV1(item.preset, enabled);
    if (JSON.stringify(current) === JSON.stringify(item.preset)) return item;
    const next = normalizeBrushPresetV1({ ...current, revision: item.preset.revision + 1 });
    return itemV1({ source: item.source, baseline: item.baseline, preset: next, locked: item.locked });
  });
}

export function updateBrushPresetRandomOpacityV1(
  state: BrushPresetLibraryStateV1,
  presetId: string,
  enabled: boolean,
): BrushPresetLibraryStateV1 {
  return updateItemV1(state, presetId, (item) => {
    if (item.locked) throw new Error('locked brush preset cannot be edited');
    const current = withBrushRandomOpacityEnabledV1(item.preset, enabled);
    if (JSON.stringify(current) === JSON.stringify(item.preset)) return item;
    const next = normalizeBrushPresetV1({ ...current, revision: item.preset.revision + 1 });
    return itemV1({ source: item.source, baseline: item.baseline, preset: next, locked: item.locked });
  });
}

export function updateBrushPresetRandomFlowV1(
  state: BrushPresetLibraryStateV1,
  presetId: string,
  enabled: boolean,
): BrushPresetLibraryStateV1 {
  return updateItemV1(state, presetId, (item) => {
    if (item.locked) throw new Error('locked brush preset cannot be edited');
    const current = withBrushRandomFlowEnabledV1(item.preset, enabled);
    if (JSON.stringify(current) === JSON.stringify(item.preset)) return item;
    const next = normalizeBrushPresetV1({ ...current, revision: item.preset.revision + 1 });
    return itemV1({ source: item.source, baseline: item.baseline, preset: next, locked: item.locked });
  });
}

export function updateBrushPresetRandomResponseCurveV1(
  state: BrushPresetLibraryStateV1,
  presetId: string,
  curve: readonly ResponseCurvePointV1[],
): BrushPresetLibraryStateV1 {
  return updateItemV1(state, presetId, (item) => {
    if (item.locked) throw new Error('locked brush preset cannot be edited');
    const current = withBrushRandomResponseCurveV1(item.preset, curve);
    if (JSON.stringify(current) === JSON.stringify(item.preset)) return item;
    const next = normalizeBrushPresetV1({ ...current, revision: item.preset.revision + 1 });
    return itemV1({ source: item.source, baseline: item.baseline, preset: next, locked: item.locked });
  });
}

export function updateBrushPresetCustomTipV1(
""",
)

# -----------------------------------------------------------------------------
# Brush Properties controller: random mapping toggles + fourth Shared Curve Editor.
# -----------------------------------------------------------------------------
replace_once(
    'src/app/brush-preset-controller.ts',
    """  brushVelocityResponseCurveV1,
  brushVelocityMaximumPxPerSecondV1,
  BUILTIN_BRUSH_GRAIN_RESOURCES_V1,
""",
    """  brushVelocityResponseCurveV1,
  brushVelocityMaximumPxPerSecondV1,
  brushRandomSizeEnabledV1,
  brushRandomOpacityEnabledV1,
  brushRandomFlowEnabledV1,
  brushRandomResponseCurveV1,
  BUILTIN_BRUSH_GRAIN_RESOURCES_V1,
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  updateBrushPresetVelocityResponseCurveV1,
  updateBrushPresetVelocityMaximumV1,
  updateBrushPresetSpacingV1,
""",
    """  updateBrushPresetVelocityResponseCurveV1,
  updateBrushPresetVelocityMaximumV1,
  updateBrushPresetRandomSizeV1,
  updateBrushPresetRandomOpacityV1,
  updateBrushPresetRandomFlowV1,
  updateBrushPresetRandomResponseCurveV1,
  updateBrushPresetSpacingV1,
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  const velocityCurveDelete = requireElement('#brush-velocity-curve-delete', HTMLButtonElement);
  const velocityCurveReset = requireElement('#brush-velocity-curve-reset', HTMLButtonElement);
  const tipShape = requireElement('#brush-tip-shape', HTMLSelectElement);
""",
    """  const velocityCurveDelete = requireElement('#brush-velocity-curve-delete', HTMLButtonElement);
  const velocityCurveReset = requireElement('#brush-velocity-curve-reset', HTMLButtonElement);
  const randomSizeButton = requireElement('#brush-random-size', HTMLButtonElement);
  const randomOpacityButton = requireElement('#brush-random-opacity', HTMLButtonElement);
  const randomFlowButton = requireElement('#brush-random-flow', HTMLButtonElement);
  const randomCurveCanvas = requireElement('#brush-random-curve', HTMLCanvasElement);
  const randomCurvePreset = requireElement('#brush-random-curve-preset', HTMLSelectElement);
  const randomCurveInput = requireElement('#brush-random-curve-input', HTMLInputElement);
  const randomCurveOutput = requireElement('#brush-random-curve-output', HTMLInputElement);
  const randomCurveDelete = requireElement('#brush-random-curve-delete', HTMLButtonElement);
  const randomCurveReset = requireElement('#brush-random-curve-reset', HTMLButtonElement);
  const tipShape = requireElement('#brush-tip-shape', HTMLSelectElement);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  let velocityCurveEditor: SharedCurveEditorV1 | null = null;
  let idCounter = 0;
""",
    """  let velocityCurveEditor: SharedCurveEditorV1 | null = null;
  let randomCurveEditor: SharedCurveEditorV1 | null = null;
  let idCounter = 0;
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    const velocityMaximum = brushVelocityMaximumPxPerSecondV1(item.preset);
    input.paintSession.setBrushVelocityMaximumPxPerSecond(velocityMaximum);
    const tipAssets = brushTipAssetsV1(item.preset);
""",
    """    const velocityMaximum = brushVelocityMaximumPxPerSecondV1(item.preset);
    input.paintSession.setBrushVelocityMaximumPxPerSecond(velocityMaximum);
    const randomSizeEnabled = brushRandomSizeEnabledV1(item.preset);
    input.paintSession.setBrushRandomSizeEnabled(randomSizeEnabled);
    const randomOpacityEnabled = brushRandomOpacityEnabledV1(item.preset);
    input.paintSession.setBrushRandomOpacityEnabled(randomOpacityEnabled);
    const randomFlowEnabled = brushRandomFlowEnabledV1(item.preset);
    input.paintSession.setBrushRandomFlowEnabled(randomFlowEnabled);
    const randomResponseCurve = brushRandomResponseCurveV1(item.preset);
    input.paintSession.setBrushRandomResponseCurve(randomResponseCurve);
    const tipAssets = brushTipAssetsV1(item.preset);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    input.root.dataset.illustroBrushVelocityMaximumPxPerSecond = String(velocityMaximum);
    input.root.dataset.illustroBrushTipShape = brushTipShapeV1(item.preset);
""",
    """    input.root.dataset.illustroBrushVelocityMaximumPxPerSecond = String(velocityMaximum);
    input.root.dataset.illustroBrushRandomSize = String(randomSizeEnabled);
    input.root.dataset.illustroBrushRandomOpacity = String(randomOpacityEnabled);
    input.root.dataset.illustroBrushRandomFlow = String(randomFlowEnabled);
    input.root.dataset.illustroBrushRandomCurvePoints = String(randomResponseCurve.length);
    input.root.dataset.illustroBrushTipShape = brushTipShapeV1(item.preset);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    const velocityResponseCurve = brushVelocityResponseCurveV1(selected.preset);
    velocityCurveEditor?.setCurve(velocityResponseCurve);
    tipShape.value = brushTipShapeV1(selected.preset);
""",
    """    const velocityResponseCurve = brushVelocityResponseCurveV1(selected.preset);
    velocityCurveEditor?.setCurve(velocityResponseCurve);
    const randomSizeEnabled = brushRandomSizeEnabledV1(selected.preset);
    randomSizeButton.textContent = randomSizeEnabled ? 'ON' : 'OFF';
    randomSizeButton.setAttribute('aria-pressed', String(randomSizeEnabled));
    const randomOpacityEnabled = brushRandomOpacityEnabledV1(selected.preset);
    randomOpacityButton.textContent = randomOpacityEnabled ? 'ON' : 'OFF';
    randomOpacityButton.setAttribute('aria-pressed', String(randomOpacityEnabled));
    const randomFlowEnabled = brushRandomFlowEnabledV1(selected.preset);
    randomFlowButton.textContent = randomFlowEnabled ? 'ON' : 'OFF';
    randomFlowButton.setAttribute('aria-pressed', String(randomFlowEnabled));
    const randomResponseCurve = brushRandomResponseCurveV1(selected.preset);
    randomCurveEditor?.setCurve(randomResponseCurve);
    tipShape.value = brushTipShapeV1(selected.preset);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    const velocityMaximumLabel =
      velocitySizeEnabled || velocityOpacityEnabled || velocityFlowEnabled
        ? ` · Vmax${Math.round(velocityMaximum)}px/s`
        : '';
    propertyStatus.textContent = `${parameters.sizePx.toFixed(1)} px · ${Math.round(parameters.opacity * 100)}% · ${Math.round(parameters.flow * 100)}% · H${Math.round(hardness * 100)}% · D${Math.round(tipDensity * 100)}% · S${Math.round(spacing.spacingRatio * 100)}% · A${Math.round(tipAngleDegrees)}° · F${Math.round(tipDirectionDegrees)}°${followRotation ? ' · Follow' : ''}${penOrientationEnabled ? ' · PenDir' : ''}${repeatLabel}${startLabel}${endLabel}${sizeTaperLabel}${opacityTaperLabel}${forcedTaperLabel}${stabilizationLabel}${postCorrectionLabel}${grainLabel}${paperLabel}${textureStrengthLabel}${textureScaleLabel}${textureRotationLabel}${textureBlendLabel}${pressureSizeLabel}${pressureOpacityLabel}${pressureFlowLabel}${pressureCurveLabel}${tiltSizeLabel}${tiltOpacityLabel}${tiltFlowLabel}${tiltCurveLabel}${velocitySizeLabel}${velocityOpacityLabel}${velocityFlowLabel}${velocityCurveLabel}${velocityMaximumLabel}`;
""",
    """    const velocityMaximumLabel =
      velocitySizeEnabled || velocityOpacityEnabled || velocityFlowEnabled
        ? ` · Vmax${Math.round(velocityMaximum)}px/s`
        : '';
    const randomSizeLabel = randomSizeEnabled ? ' · R→Size' : '';
    const randomOpacityLabel = randomOpacityEnabled ? ' · R→Opacity' : '';
    const randomFlowLabel = randomFlowEnabled ? ' · R→Flow' : '';
    const randomCurveLabel = responseCurveIsLinearV1(randomResponseCurve) ? '' : ' · R-Curve';
    propertyStatus.textContent = `${parameters.sizePx.toFixed(1)} px · ${Math.round(parameters.opacity * 100)}% · ${Math.round(parameters.flow * 100)}% · H${Math.round(hardness * 100)}% · D${Math.round(tipDensity * 100)}% · S${Math.round(spacing.spacingRatio * 100)}% · A${Math.round(tipAngleDegrees)}° · F${Math.round(tipDirectionDegrees)}°${followRotation ? ' · Follow' : ''}${penOrientationEnabled ? ' · PenDir' : ''}${repeatLabel}${startLabel}${endLabel}${sizeTaperLabel}${opacityTaperLabel}${forcedTaperLabel}${stabilizationLabel}${postCorrectionLabel}${grainLabel}${paperLabel}${textureStrengthLabel}${textureScaleLabel}${textureRotationLabel}${textureBlendLabel}${pressureSizeLabel}${pressureOpacityLabel}${pressureFlowLabel}${pressureCurveLabel}${tiltSizeLabel}${tiltOpacityLabel}${tiltFlowLabel}${tiltCurveLabel}${velocitySizeLabel}${velocityOpacityLabel}${velocityFlowLabel}${velocityCurveLabel}${velocityMaximumLabel}${randomSizeLabel}${randomOpacityLabel}${randomFlowLabel}${randomCurveLabel}`;
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """      velocityMaximumRange,
      velocityMaximumNumber,
      tipShape,
""",
    """      velocityMaximumRange,
      velocityMaximumNumber,
      randomSizeButton,
      randomOpacityButton,
      randomFlowButton,
      tipShape,
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    velocityCurveEditor?.setDisabled(locked);
    tipAssetSelect.disabled = locked || tipAssets.length === 0;
""",
    """    velocityCurveEditor?.setDisabled(locked);
    randomCurveEditor?.setDisabled(locked);
    tipAssetSelect.disabled = locked || tipAssets.length === 0;
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  velocityCurveEditor = installSharedCurveEditorV1({
    elements: {
      canvas: velocityCurveCanvas,
      preset: velocityCurvePreset,
      inputNumber: velocityCurveInput,
      outputNumber: velocityCurveOutput,
      deleteButton: velocityCurveDelete,
      resetButton: velocityCurveReset,
    },
    initialCurve: brushVelocityResponseCurveV1(selectedBrushPresetItemV1(state).preset),
    onChange: (curve) =>
      mutate(() => updateBrushPresetVelocityResponseCurveV1(state, state.selectedPresetId, curve)),
  });

  const onSearch = (): void => {
""",
    """  velocityCurveEditor = installSharedCurveEditorV1({
    elements: {
      canvas: velocityCurveCanvas,
      preset: velocityCurvePreset,
      inputNumber: velocityCurveInput,
      outputNumber: velocityCurveOutput,
      deleteButton: velocityCurveDelete,
      resetButton: velocityCurveReset,
    },
    initialCurve: brushVelocityResponseCurveV1(selectedBrushPresetItemV1(state).preset),
    onChange: (curve) =>
      mutate(() => updateBrushPresetVelocityResponseCurveV1(state, state.selectedPresetId, curve)),
  });

  randomCurveEditor = installSharedCurveEditorV1({
    elements: {
      canvas: randomCurveCanvas,
      preset: randomCurvePreset,
      inputNumber: randomCurveInput,
      outputNumber: randomCurveOutput,
      deleteButton: randomCurveDelete,
      resetButton: randomCurveReset,
    },
    initialCurve: brushRandomResponseCurveV1(selectedBrushPresetItemV1(state).preset),
    onChange: (curve) =>
      mutate(() => updateBrushPresetRandomResponseCurveV1(state, state.selectedPresetId, curve)),
  });

  const onSearch = (): void => {
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  const onVelocityMaximumNumber = (): void =>
    updateVelocityMaximum(Number(velocityMaximumNumber.value));
  const onTipShape = (): void => {
""",
    """  const onVelocityMaximumNumber = (): void =>
    updateVelocityMaximum(Number(velocityMaximumNumber.value));
  const onRandomSize = (): void =>
    mutate(() =>
      updateBrushPresetRandomSizeV1(
        state,
        state.selectedPresetId,
        !brushRandomSizeEnabledV1(selectedBrushPresetItemV1(state).preset),
      ),
    );
  const onRandomOpacity = (): void =>
    mutate(() =>
      updateBrushPresetRandomOpacityV1(
        state,
        state.selectedPresetId,
        !brushRandomOpacityEnabledV1(selectedBrushPresetItemV1(state).preset),
      ),
    );
  const onRandomFlow = (): void =>
    mutate(() =>
      updateBrushPresetRandomFlowV1(
        state,
        state.selectedPresetId,
        !brushRandomFlowEnabledV1(selectedBrushPresetItemV1(state).preset),
      ),
    );
  const onTipShape = (): void => {
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  velocityMaximumRange.addEventListener('input', onVelocityMaximumRange);
  velocityMaximumNumber.addEventListener('change', onVelocityMaximumNumber);
  tipShape.addEventListener('change', onTipShape);
""",
    """  velocityMaximumRange.addEventListener('input', onVelocityMaximumRange);
  velocityMaximumNumber.addEventListener('change', onVelocityMaximumNumber);
  randomSizeButton.addEventListener('click', onRandomSize);
  randomOpacityButton.addEventListener('click', onRandomOpacity);
  randomFlowButton.addEventListener('click', onRandomFlow);
  tipShape.addEventListener('change', onTipShape);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """      velocityMaximumRange.removeEventListener('input', onVelocityMaximumRange);
      velocityMaximumNumber.removeEventListener('change', onVelocityMaximumNumber);
      pressureCurveEditor?.dispose();
""",
    """      velocityMaximumRange.removeEventListener('input', onVelocityMaximumRange);
      velocityMaximumNumber.removeEventListener('change', onVelocityMaximumNumber);
      randomSizeButton.removeEventListener('click', onRandomSize);
      randomOpacityButton.removeEventListener('click', onRandomOpacity);
      randomFlowButton.removeEventListener('click', onRandomFlow);
      pressureCurveEditor?.dispose();
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """      velocityCurveEditor?.dispose();
      velocityCurveEditor = null;
      tipShape.removeEventListener('change', onTipShape);
""",
    """      velocityCurveEditor?.dispose();
      velocityCurveEditor = null;
      randomCurveEditor?.dispose();
      randomCurveEditor = null;
      tipShape.removeEventListener('change', onTipShape);
""",
)

# -----------------------------------------------------------------------------
# Reachable UI. No min/max response controls yet; those remain M6A-049/050.
# -----------------------------------------------------------------------------
replace_once(
    'src/index.html',
    """              <div class=\"shell-brush-property-row shell-brush-tip-property-row\">
                <label for=\"brush-tip-shape\">ブラシ形状</label>
""",
    """              <div class=\"shell-brush-property-row shell-brush-tip-property-row\">
                <label for=\"brush-random-size\">ランダム→サイズ</label>
                <button id=\"brush-random-size\" type=\"button\" aria-pressed=\"false\" title=\"ストロークseed由来のランダム値をブラシサイズへ反映\">OFF</button>
                <span class=\"shell-brush-tip-kind\">Random</span>
              </div>
              <div class=\"shell-brush-property-row shell-brush-tip-property-row\">
                <label for=\"brush-random-opacity\">ランダム→不透明度</label>
                <button id=\"brush-random-opacity\" type=\"button\" aria-pressed=\"false\" title=\"ストロークseed由来のランダム値を不透明度へ反映\">OFF</button>
                <span class=\"shell-brush-tip-kind\">Random</span>
              </div>
              <div class=\"shell-brush-property-row shell-brush-tip-property-row\">
                <label for=\"brush-random-flow\">ランダム→流量</label>
                <button id=\"brush-random-flow\" type=\"button\" aria-pressed=\"false\" title=\"ストロークseed由来のランダム値を流量へ反映\">OFF</button>
                <span class=\"shell-brush-tip-kind\">Random</span>
              </div>
              <div class=\"shell-brush-pressure-curve-editor shell-brush-random-curve-editor\" aria-label=\"ランダムレスポンスカーブ\">
                <div class=\"shell-brush-pressure-curve-header\">
                  <label for=\"brush-random-curve-preset\">ランダムカーブ</label>
                  <select id=\"brush-random-curve-preset\" aria-label=\"ランダムカーブプリセット\">
                    <option value=\"linear\">Linear</option>
                    <option value=\"soft\">Soft</option>
                    <option value=\"hard\">Hard</option>
                    <option value=\"s-curve\">S Curve</option>
                    <option value=\"custom\">Custom</option>
                  </select>
                </div>
                <canvas id=\"brush-random-curve\" width=\"240\" height=\"128\" tabindex=\"0\" aria-label=\"ランダムレスポンスカーブ。論理スタンプごとの決定的なランダム入力を出力へ変換\"></canvas>
                <div class=\"shell-brush-pressure-curve-values\">
                  <label>入力 <input id=\"brush-random-curve-input\" type=\"number\" inputmode=\"decimal\" min=\"0\" max=\"100\" step=\"0.1\" value=\"0\" /><span>%</span></label>
                  <label>出力 <input id=\"brush-random-curve-output\" type=\"number\" inputmode=\"decimal\" min=\"0\" max=\"100\" step=\"0.1\" value=\"0\" /><span>%</span></label>
                  <button id=\"brush-random-curve-delete\" type=\"button\">点を削除</button>
                  <button id=\"brush-random-curve-reset\" type=\"button\">Reset</button>
                </div>
              </div>
              <div class=\"shell-brush-property-row shell-brush-tip-property-row\">
                <label for=\"brush-tip-shape\">ブラシ形状</label>
""",
)

# -----------------------------------------------------------------------------
# Regression coverage.
# -----------------------------------------------------------------------------
Path('tests/unit/brush-random-dynamics.test.ts').write_text("""import { describe, expect, it } from 'vitest';
import {
  brushRandomFlowEnabledV1,
  brushRandomOpacityEnabledV1,
  brushRandomResponseCurveV1,
  brushRandomSizeEnabledV1,
  createBaselineBrushPresetV1,
  withBrushRandomFlowEnabledV1,
  withBrushRandomOpacityEnabledV1,
  withBrushRandomResponseCurveV1,
  withBrushRandomSizeEnabledV1,
} from '../../src/domain/brush-schema.js';
import { LINEAR_RESPONSE_CURVE_V1 } from '../../src/domain/response-curve.js';
import {
  BaselineBrushDabBuilderV1,
  deterministicBaselineBrushRandomV1,
} from '../../src/gpu/baseline-brush.js';
import { CanonicalRasterBrushStrokeV1 } from '../../src/app/canonical-raster-brush.js';
import { PaintSessionControllerV1 } from '../../src/app/paint-session-controller.js';

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

const CUSTOM_CURVE = Object.freeze([
  Object.freeze({ input: 0, output: 0 }),
  Object.freeze({ input: 0.5, output: 0.8 }),
  Object.freeze({ input: 1, output: 1 }),
]);

const TIP_A = Object.freeze([
  0, 0, 0, 0, 0,
  0, 0, 255, 0, 0,
  0, 0, 255, 0, 0,
  0, 0, 0, 0, 0,
  0, 0, 0, 0, 0,
]);
const TIP_B = Object.freeze([
  0, 0, 0, 0, 0,
  0, 0, 0, 0, 0,
  0, 255, 255, 255, 0,
  0, 0, 0, 0, 0,
  0, 0, 0, 0, 0,
]);

describe('M6A-048 random dynamics', () => {
  it('keeps random mappings opt-in with one shared linear response curve', () => {
    const preset = createBaselineBrushPresetV1({
      id: 'random.mapping',
      name: 'Random Mapping',
      category: 'Test',
      behavior: 'paint',
    });
    expect(brushRandomSizeEnabledV1(preset)).toBe(false);
    expect(brushRandomOpacityEnabledV1(preset)).toBe(false);
    expect(brushRandomFlowEnabledV1(preset)).toBe(false);
    expect(brushRandomResponseCurveV1(preset)).toEqual(LINEAR_RESPONSE_CURVE_V1);
    expect(brushRandomSizeEnabledV1(withBrushRandomSizeEnabledV1(preset, true))).toBe(true);
    expect(brushRandomOpacityEnabledV1(withBrushRandomOpacityEnabledV1(preset, true))).toBe(true);
    expect(brushRandomFlowEnabledV1(withBrushRandomFlowEnabledV1(preset, true))).toBe(true);
    expect(brushRandomResponseCurveV1(withBrushRandomResponseCurveV1(preset, CUSTOM_CURVE))).toEqual(
      CUSTOM_CURVE,
    );
  });

  it('generates a deterministic per-attempt random sensor from seed and stamp index', () => {
    const sequenceA = Array.from({ length: 6 }, (_, index) => deterministicBaselineBrushRandomV1(123, index));
    const sequenceB = Array.from({ length: 6 }, (_, index) => deterministicBaselineBrushRandomV1(123, index));
    const sequenceC = Array.from({ length: 6 }, (_, index) => deterministicBaselineBrushRandomV1(124, index));
    expect(sequenceA).toEqual(sequenceB);
    expect(sequenceC).not.toEqual(sequenceA);
    expect(sequenceA.every((value) => value >= 0 && value < 1)).toBe(true);
  });

  it('advances the random attempt index even when a taper suppresses the first logical stamp', () => {
    const seed = 77;
    const builder = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      spacingRatio: 0.25,
      minimumStampDistancePx: 1,
      startTaperLengthPx: 5,
      randomSizeEnabled: true,
      randomSeed: seed,
    });
    expect(builder.beginDelta({ documentX: 0, documentY: 0 })).toEqual([]);
    const [dab] = builder.appendDelta([{ documentX: 5, documentY: 0 }]);
    expect(dab?.radius).toBeCloseTo(10 * deterministicBaselineBrushRandomV1(seed, 1), 10);
  });

  it('uses an independent random channel without changing random tip-selection order', () => {
    const baseOptions = {
      sizePx: 20,
      spacingRatio: 0.25,
      minimumStampDistancePx: 1,
      tipShape: 'sampled-image' as const,
      sampledTipAlphas: [TIP_A, TIP_B],
      tipSelectionMode: 'random-per-stamp' as const,
      tipSelectionSeed: 9182,
    };
    const plain = new BaselineBrushDabBuilderV1(baseOptions);
    plain.beginDelta({ documentX: 0, documentY: 0 });
    plain.appendDelta([{ documentX: 15, documentY: 0 }]);
    const randomized = new BaselineBrushDabBuilderV1({
      ...baseOptions,
      randomOpacityEnabled: true,
      randomSeed: 33,
    });
    randomized.beginDelta({ documentX: 0, documentY: 0 });
    randomized.appendDelta([{ documentX: 15, documentY: 0 }]);
    const geometry = (builder: BaselineBrushDabBuilderV1) =>
      builder.dabs().map((dab) => [Number(dab.x.toFixed(6)), Number(dab.y.toFixed(6))]);
    expect(geometry(randomized)).toEqual(geometry(plain));
  });

  it('samples one random response per logical stamp and composes it independently with other dynamics', () => {
    const seed = 51;
    const random = deterministicBaselineBrushRandomV1(seed, 0);
    const builder = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      opacity: 0.8,
      flow: 0.6,
      pressureSizeEnabled: true,
      pressureOpacityEnabled: true,
      pressureFlowEnabled: true,
      tiltSizeEnabled: true,
      tiltOpacityEnabled: true,
      tiltFlowEnabled: true,
      velocitySizeEnabled: true,
      velocityOpacityEnabled: true,
      velocityFlowEnabled: true,
      randomSizeEnabled: true,
      randomOpacityEnabled: true,
      randomFlowEnabled: true,
      randomSeed: seed,
    });
    const [dab] = builder.beginDelta({
      documentX: 1,
      documentY: 1,
      pressure: 0.5,
      velocity: 0.5,
      altitudeAngle: Math.PI / 4,
    });
    expect(dab?.radius).toBeCloseTo(1.25 * random, 10);
    expect(dab?.strokeOpacity).toBeCloseTo(0.1 * random, 10);
    expect(dab?.flow).toBeCloseTo(0.075 * random, 10);
  });

  it('keeps forced taper zero authoritative and stores only resolved primitive values', () => {
    const stroke = new CanonicalRasterBrushStrokeV1({
      sizePx: 20,
      startTaperLengthPx: 10,
      sizeTaperMinimumRatio: 0.5,
      opacityTaperMinimumRatio: 0.5,
      forceStartTaper: true,
      randomSizeEnabled: true,
      randomOpacityEnabled: true,
      randomFlowEnabled: true,
      randomSeed: 8,
    });
    expect(stroke.beginConfirmed({ documentX: 0, documentY: 0 })).toEqual([]);
    const [dab] = stroke.appendConfirmed([{ documentX: 10, documentY: 0 }]);
    expect(dab).toBeDefined();
    expect('randomInput' in (dab ?? {})).toBe(false);

    const session = new PaintSessionControllerV1(new FakeRendererDocumentPort());
    expect(session.setBrushRandomSizeEnabled(true)).toBe(true);
    expect(session.setBrushRandomOpacityEnabled(true)).toBe(true);
    expect(session.setBrushRandomFlowEnabled(true)).toBe(true);
    expect(session.setBrushRandomResponseCurve(CUSTOM_CURVE)).toEqual(CUSTOM_CURVE);
    const snapshot = session.snapshot();
    expect(snapshot.brushRandomSizeEnabled).toBe(true);
    expect(snapshot.brushRandomOpacityEnabled).toBe(true);
    expect(snapshot.brushRandomFlowEnabled).toBe(true);
    expect(snapshot.brushRandomResponseCurve).toEqual(CUSTOM_CURVE);
  });
});
""")

# -----------------------------------------------------------------------------
# Verification gate.
# -----------------------------------------------------------------------------
replace_once(
    'scripts/verify-m6a-brush.mjs',
    """requireText(
  progress,
  'M6A-PERF-001 incremental active-stroke rendering（stable prefix + bounded mutable tail）:未完了',
""",
    """requireText(progress, 'M6A-048 random dynamics:完了', 'M6A-048 progress is not complete');
requireText(
  read('src/domain/brush-schema.ts'),
  'brushRandomResponseCurveV1',
  'random dynamics preset response helper missing',
);
requireText(
  read('src/gpu/baseline-brush.ts'),
  'deterministicBaselineBrushRandomV1',
  'deterministic random dynamics source missing',
);
requireText(
  read('src/gpu/baseline-brush.ts'),
  '#randomStampIndex',
  'random dynamics does not own an attempt index independent from visible tip repetition',
);
requireText(
  read('src/gpu/baseline-brush.ts'),
  'this.#randomResponseCurve.sample(stamp.randomInput)',
  'shared random response is not sampled from the stored logical-stamp random input',
);
requireText(
  read('src/app/paint-session-controller.ts'),
  "this.#brushTipSelectionMode === 'random-per-stamp' || randomDynamicsEnabled",
  'random dynamics does not capture a persistent deterministic stroke seed',
);
requireText(
  read('src/app/paint-session-controller.ts'),
  'setBrushRandomResponseCurve',
  'random dynamics is not connected to runtime brush state',
);
requireText(read('src/index.html'), 'id=\"brush-random-size\"', 'reachable random-size control missing');
requireText(read('src/index.html'), 'id=\"brush-random-curve\"', 'reachable random Curve Editor missing');
requireText(
  read('tests/unit/brush-random-dynamics.test.ts'),
  'advances the random attempt index even when a taper suppresses the first logical stamp',
  'random attempt-index regression coverage missing',
);
requireText(
  read('tests/unit/brush-random-dynamics.test.ts'),
  'uses an independent random channel without changing random tip-selection order',
  'random/tip-selection channel independence coverage missing',
);

requireText(
  progress,
  'M6A-PERF-001 incremental active-stroke rendering（stable prefix + bounded mutable tail）:未完了',
""",
)

# -----------------------------------------------------------------------------
# Progress + canonical design memo.
# -----------------------------------------------------------------------------
replace_once(
    'IMPLEMENTATION_PROGRESS.md',
    """M6A-048 random dynamics:未完了
M6A-049 min response:未完了
""",
    """M6A-048 random dynamics:完了
再開メモ: M6A-048 random dynamicsはstrokeId由来の保存済みuint32 randomSeedからlogical stamp attemptごとに決定的な0..1 random inputを生成する。tip random selectionとは固定saltとattempt indexを分離し、random dynamicsのON/OFFやseedがM6A-027のtip選択順を変えない。randomSizeEnabled / randomOpacityEnabled / randomFlowEnabledは既定false、randomResponseCurveはShared Curve Editorのlinear既定で、1つのrandom responseをsize / strokeOpacity cap / flowへ独立に乗算する。randomStampIndexはtaperやresponseでstampが非表示になってもattemptごとに進み、可視logical stamp recordには生成済みrandomInputを保持するためend-tail reconciliationで再抽選しない。random dynamicsが有効ならtip random未使用でもstroke randomSeedを保存し、post-stroke correctionの再構築も同じseedで決定的に一致する。primitive dab / Worker / Historyにはrandom専用fieldを追加せず解決済みradius/strokeOpacity/flowだけを保存する。M6A-049/050のminimum/maximum responseは未実装のまま保持し、次はM6A-049 min responseから再開する。
M6A-049 min response:未完了
""",
)
append_once(
    'ILLUSTRO_DESIGN_MEMO.md',
    '#### M6A random-dynamics boundary — 2026-09-03',
    """
#### M6A random-dynamics boundary — 2026-09-03

- M6A-048 models Random/Fuzzy dynamics as a deterministic `0..1` sensor sampled once for each **logical stamp attempt**. It never calls global RNG and never depends on presentation frame timing.
- A randomized stroke uses the existing persisted `PaintStrokeV1.randomSeed`. The random-dynamics stream has its own fixed salt and its own attempt index, separate from M6A-027 multi-tip `random-per-stamp` selection. Enabling Random dynamics therefore cannot reorder selected tip assets.
- `dynamics.randomSizeEnabled`, `randomOpacityEnabled`, and `randomFlowEnabled` are independent opt-in mappings and default to `false`. `randomResponseCurve` reuses the IP-12 Shared Curve Editor and defaults to exact linear identity.
- The random attempt index advances even when taper or another response suppresses that stamp. A visible logical-stamp record stores its already-generated `randomInput`, so bounded end-tail reconciliation reuses the same value rather than re-rolling.
- One shared Random response may multiply resolved size, the per-dab stroke-opacity cap, and/or flow. It composes independently with Pressure, Tilt, Velocity and taper; M6A-032 forced zero endpoints remain authoritative because random can only multiply the existing result.
- Primitive dabs persist only resolved `radius`, `strokeOpacity`, and `flow`; Random adds no renderer, Worker, history, or recovery field. Post-stroke correction rebuilds from the same captured seed and therefore reproduces the same random stream.
- M6A-049/M6A-050 own minimum/maximum response remapping. M6A-048 deliberately does not pre-implement either clamp.
""",
)

print('M6A-048 patch applied')
