from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    if old not in text:
        raise RuntimeError(f"anchor not found in {path}: {old[:160]!r}")
    file.write_text(text.replace(old, new, 1))


def append_once(path: str, marker: str, block: str) -> None:
    file = Path(path)
    text = file.read_text()
    if marker in text:
        return
    file.write_text(text.rstrip() + "\n\n" + block.strip() + "\n")


# Brush preset schema: opt-in velocity mappings, shared response curve, and explicit normalization speed.
replace_once(
    'src/domain/brush-schema.ts',
    """export type BrushTipSelectionModeV1 = 'fixed' | 'sequence' | 'random-per-stamp';
""",
    """export const DEFAULT_BRUSH_VELOCITY_SIZE_ENABLED_V1 = false as const;
export const DEFAULT_BRUSH_VELOCITY_OPACITY_ENABLED_V1 = false as const;
export const DEFAULT_BRUSH_VELOCITY_FLOW_ENABLED_V1 = false as const;
export const DEFAULT_BRUSH_VELOCITY_MAXIMUM_PX_PER_SECOND_V1 = 2000 as const;
export const MIN_BRUSH_VELOCITY_MAXIMUM_PX_PER_SECOND_V1 = 100 as const;
export const MAX_BRUSH_VELOCITY_MAXIMUM_PX_PER_SECOND_V1 = 20000 as const;

export function brushVelocitySizeEnabledV1(preset: BrushPresetV1): boolean {
  const value = preset.dynamics.velocitySizeEnabled;
  return typeof value === 'boolean' ? value : DEFAULT_BRUSH_VELOCITY_SIZE_ENABLED_V1;
}

export function withBrushVelocitySizeEnabledV1(
  preset: BrushPresetV1,
  enabled: boolean,
): BrushPresetV1 {
  if (typeof enabled !== 'boolean') throw new TypeError('brush velocity size flag must be boolean');
  if (enabled === DEFAULT_BRUSH_VELOCITY_SIZE_ENABLED_V1) {
    const { velocitySizeEnabled: _velocitySizeEnabled, ...dynamics } = preset.dynamics;
    return normalizeBrushPresetV1({ ...preset, dynamics });
  }
  return normalizeBrushPresetV1({
    ...preset,
    dynamics: { ...preset.dynamics, velocitySizeEnabled: enabled },
  });
}

export function brushVelocityOpacityEnabledV1(preset: BrushPresetV1): boolean {
  const value = preset.dynamics.velocityOpacityEnabled;
  return typeof value === 'boolean' ? value : DEFAULT_BRUSH_VELOCITY_OPACITY_ENABLED_V1;
}

export function withBrushVelocityOpacityEnabledV1(
  preset: BrushPresetV1,
  enabled: boolean,
): BrushPresetV1 {
  if (typeof enabled !== 'boolean') {
    throw new TypeError('brush velocity opacity flag must be boolean');
  }
  if (enabled === DEFAULT_BRUSH_VELOCITY_OPACITY_ENABLED_V1) {
    const { velocityOpacityEnabled: _velocityOpacityEnabled, ...dynamics } = preset.dynamics;
    return normalizeBrushPresetV1({ ...preset, dynamics });
  }
  return normalizeBrushPresetV1({
    ...preset,
    dynamics: { ...preset.dynamics, velocityOpacityEnabled: enabled },
  });
}

export function brushVelocityFlowEnabledV1(preset: BrushPresetV1): boolean {
  const value = preset.dynamics.velocityFlowEnabled;
  return typeof value === 'boolean' ? value : DEFAULT_BRUSH_VELOCITY_FLOW_ENABLED_V1;
}

export function withBrushVelocityFlowEnabledV1(
  preset: BrushPresetV1,
  enabled: boolean,
): BrushPresetV1 {
  if (typeof enabled !== 'boolean') throw new TypeError('brush velocity flow flag must be boolean');
  if (enabled === DEFAULT_BRUSH_VELOCITY_FLOW_ENABLED_V1) {
    const { velocityFlowEnabled: _velocityFlowEnabled, ...dynamics } = preset.dynamics;
    return normalizeBrushPresetV1({ ...preset, dynamics });
  }
  return normalizeBrushPresetV1({
    ...preset,
    dynamics: { ...preset.dynamics, velocityFlowEnabled: enabled },
  });
}

export function brushVelocityResponseCurveV1(
  preset: BrushPresetV1,
): readonly ResponseCurvePointV1[] {
  const value = preset.dynamics.velocityResponseCurve;
  if (value === undefined) return LINEAR_RESPONSE_CURVE_V1;
  try {
    return normalizeResponseCurveV1(value);
  } catch {
    return LINEAR_RESPONSE_CURVE_V1;
  }
}

export function withBrushVelocityResponseCurveV1(
  preset: BrushPresetV1,
  curve: readonly ResponseCurvePointV1[],
): BrushPresetV1 {
  const normalized = normalizeResponseCurveV1(curve);
  if (responseCurveIsLinearV1(normalized)) {
    const { velocityResponseCurve: _velocityResponseCurve, ...dynamics } = preset.dynamics;
    return normalizeBrushPresetV1({ ...preset, dynamics });
  }
  const stored = toJsonValue(
    normalized.map((pointValue) => ({ input: pointValue.input, output: pointValue.output })),
  );
  return normalizeBrushPresetV1({
    ...preset,
    dynamics: { ...preset.dynamics, velocityResponseCurve: stored },
  });
}

export function brushVelocityMaximumPxPerSecondV1(preset: BrushPresetV1): number {
  const value = preset.dynamics.velocityMaximumPxPerSecond;
  return typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= MIN_BRUSH_VELOCITY_MAXIMUM_PX_PER_SECOND_V1 &&
    value <= MAX_BRUSH_VELOCITY_MAXIMUM_PX_PER_SECOND_V1
    ? value
    : DEFAULT_BRUSH_VELOCITY_MAXIMUM_PX_PER_SECOND_V1;
}

export function withBrushVelocityMaximumPxPerSecondV1(
  preset: BrushPresetV1,
  maximumPxPerSecond: number,
): BrushPresetV1 {
  if (
    !Number.isFinite(maximumPxPerSecond) ||
    maximumPxPerSecond < MIN_BRUSH_VELOCITY_MAXIMUM_PX_PER_SECOND_V1 ||
    maximumPxPerSecond > MAX_BRUSH_VELOCITY_MAXIMUM_PX_PER_SECOND_V1
  ) {
    throw new RangeError('brush velocity maximum must be within 100..20000 document px/s');
  }
  if (maximumPxPerSecond === DEFAULT_BRUSH_VELOCITY_MAXIMUM_PX_PER_SECOND_V1) {
    const { velocityMaximumPxPerSecond: _velocityMaximumPxPerSecond, ...dynamics } = preset.dynamics;
    return normalizeBrushPresetV1({ ...preset, dynamics });
  }
  return normalizeBrushPresetV1({
    ...preset,
    dynamics: { ...preset.dynamics, velocityMaximumPxPerSecond: maximumPxPerSecond },
  });
}

export type BrushTipSelectionModeV1 = 'fixed' | 'sequence' | 'random-per-stamp';
""",
)

# Canonical low-level brush kernel: interpolate normalized velocity at logical stamp positions.
replace_once(
    'src/gpu/baseline-brush.ts',
    """  readonly pressure?: number;
  readonly tiltX?: number;
""",
    """  readonly pressure?: number;
  readonly velocity?: number;
  readonly tiltX?: number;
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """export function baselineBrushSamplePressureV1(sample: BaselineBrushSampleV1): number {
  const pressure = sample.pressure ?? 1;
  if (!Number.isFinite(pressure) || pressure < 0 || pressure > 1) {
    throw new RangeError('baseline brush pressure must be within 0..1');
  }
  return pressure;
}

/**
 * Canonical tilt scalar for M6A dynamics: 1 means perpendicular/upright and 0 means parallel.
""",
    """export function baselineBrushSamplePressureV1(sample: BaselineBrushSampleV1): number {
  const pressure = sample.pressure ?? 1;
  if (!Number.isFinite(pressure) || pressure < 0 || pressure > 1) {
    throw new RangeError('baseline brush pressure must be within 0..1');
  }
  return pressure;
}

export function baselineBrushSampleVelocityV1(sample: BaselineBrushSampleV1): number {
  const velocity = sample.velocity ?? 0;
  if (!Number.isFinite(velocity) || velocity < 0 || velocity > 1) {
    throw new RangeError('baseline brush normalized velocity must be within 0..1');
  }
  return velocity;
}

/**
 * Canonical tilt scalar for M6A dynamics: 1 means perpendicular/upright and 0 means parallel.
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """  baselineBrushSamplePressureV1(sample);
  baselineBrushSampleTiltUprightnessV1(sample);
""",
    """  baselineBrushSamplePressureV1(sample);
  baselineBrushSampleVelocityV1(sample);
  baselineBrushSampleTiltUprightnessV1(sample);
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """  readonly pressure: number;
  readonly tiltUprightness: number;
  readonly tipAngleDegrees: number;
""",
    """  readonly pressure: number;
  readonly velocity: number;
  readonly tiltUprightness: number;
  readonly tipAngleDegrees: number;
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """  readonly #tiltFlowEnabled: boolean;
  readonly #tiltResponseCurve: CompiledResponseCurveV1;
  readonly #flow: number;
""",
    """  readonly #tiltFlowEnabled: boolean;
  readonly #tiltResponseCurve: CompiledResponseCurveV1;
  readonly #velocitySizeEnabled: boolean;
  readonly #velocityOpacityEnabled: boolean;
  readonly #velocityFlowEnabled: boolean;
  readonly #velocityResponseCurve: CompiledResponseCurveV1;
  readonly #flow: number;
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """    pressure: number;
    tiltUprightness: number;
    orientationDegrees: number;
""",
    """    pressure: number;
    velocity: number;
    tiltUprightness: number;
    orientationDegrees: number;
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """      readonly tiltFlowEnabled?: boolean;
      readonly tiltResponseCurve?: readonly ResponseCurvePointV1[];
      readonly hardness?: number;
""",
    """      readonly tiltFlowEnabled?: boolean;
      readonly tiltResponseCurve?: readonly ResponseCurvePointV1[];
      readonly velocitySizeEnabled?: boolean;
      readonly velocityOpacityEnabled?: boolean;
      readonly velocityFlowEnabled?: boolean;
      readonly velocityResponseCurve?: readonly ResponseCurvePointV1[];
      readonly hardness?: number;
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """    const tiltSizeEnabled = options.tiltSizeEnabled ?? false;
    const tiltOpacityEnabled = options.tiltOpacityEnabled ?? false;
    const tiltFlowEnabled = options.tiltFlowEnabled ?? false;
    const hardness = options.hardness ?? BASELINE_BRUSH_HARDNESS;
""",
    """    const tiltSizeEnabled = options.tiltSizeEnabled ?? false;
    const tiltOpacityEnabled = options.tiltOpacityEnabled ?? false;
    const tiltFlowEnabled = options.tiltFlowEnabled ?? false;
    const velocitySizeEnabled = options.velocitySizeEnabled ?? false;
    const velocityOpacityEnabled = options.velocityOpacityEnabled ?? false;
    const velocityFlowEnabled = options.velocityFlowEnabled ?? false;
    const hardness = options.hardness ?? BASELINE_BRUSH_HARDNESS;
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """    if (
      typeof tiltSizeEnabled !== 'boolean' ||
      typeof tiltOpacityEnabled !== 'boolean' ||
      typeof tiltFlowEnabled !== 'boolean'
    ) {
      throw new TypeError('baseline brush tilt mapping flags must be boolean');
    }
    if (!Number.isFinite(hardness) || hardness < 0 || hardness > 1) {
""",
    """    if (
      typeof tiltSizeEnabled !== 'boolean' ||
      typeof tiltOpacityEnabled !== 'boolean' ||
      typeof tiltFlowEnabled !== 'boolean'
    ) {
      throw new TypeError('baseline brush tilt mapping flags must be boolean');
    }
    if (
      typeof velocitySizeEnabled !== 'boolean' ||
      typeof velocityOpacityEnabled !== 'boolean' ||
      typeof velocityFlowEnabled !== 'boolean'
    ) {
      throw new TypeError('baseline brush velocity mapping flags must be boolean');
    }
    if (!Number.isFinite(hardness) || hardness < 0 || hardness > 1) {
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """    this.#tiltResponseCurve = compileResponseCurveV1(
      options.tiltResponseCurve ?? [
        { input: 0, output: 0 },
        { input: 1, output: 1 },
      ],
    );
    this.#flow = flow;
""",
    """    this.#tiltResponseCurve = compileResponseCurveV1(
      options.tiltResponseCurve ?? [
        { input: 0, output: 0 },
        { input: 1, output: 1 },
      ],
    );
    this.#velocitySizeEnabled = velocitySizeEnabled;
    this.#velocityOpacityEnabled = velocityOpacityEnabled;
    this.#velocityFlowEnabled = velocityFlowEnabled;
    this.#velocityResponseCurve = compileResponseCurveV1(
      options.velocityResponseCurve ?? [
        { input: 0, output: 0 },
        { input: 1, output: 1 },
      ],
    );
    this.#flow = flow;
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """    const pressure = baselineBrushSamplePressureV1(sample);
    const tiltUprightness = baselineBrushSampleTiltUprightnessV1(sample);
    const orientationDegrees = baselineBrushSampleOrientationDegreesV1(sample);
    this.#lastPoint = {
      x: sample.documentX,
      y: sample.documentY,
      pressure,
      tiltUprightness,
      orientationDegrees,
    };
    this.#pushLogicalStamp(
      sample.documentX,
      sample.documentY,
      pressure,
      tiltUprightness,
""",
    """    const pressure = baselineBrushSamplePressureV1(sample);
    const velocity = baselineBrushSampleVelocityV1(sample);
    const tiltUprightness = baselineBrushSampleTiltUprightnessV1(sample);
    const orientationDegrees = baselineBrushSampleOrientationDegreesV1(sample);
    this.#lastPoint = {
      x: sample.documentX,
      y: sample.documentY,
      pressure,
      velocity,
      tiltUprightness,
      orientationDegrees,
    };
    this.#pushLogicalStamp(
      sample.documentX,
      sample.documentY,
      pressure,
      velocity,
      tiltUprightness,
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """          baselineBrushSamplePressureV1(sample),
          baselineBrushSampleTiltUprightnessV1(sample),
          baselineBrushSampleOrientationDegreesV1(sample),
""",
    """          baselineBrushSamplePressureV1(sample),
          baselineBrushSampleVelocityV1(sample),
          baselineBrushSampleTiltUprightnessV1(sample),
          baselineBrushSampleOrientationDegreesV1(sample),
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """        baselineBrushSamplePressureV1(sample),
        baselineBrushSampleTiltUprightnessV1(sample),
        baselineBrushSampleOrientationDegreesV1(sample),
""",
    """        baselineBrushSamplePressureV1(sample),
        baselineBrushSampleVelocityV1(sample),
        baselineBrushSampleTiltUprightnessV1(sample),
        baselineBrushSampleOrientationDegreesV1(sample),
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """          lastPoint.pressure,
          lastPoint.tiltUprightness,
          this.#resolvedTipAngleDegrees(
""",
    """          lastPoint.pressure,
          lastPoint.velocity,
          lastPoint.tiltUprightness,
          this.#resolvedTipAngleDegrees(
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """      'x' | 'y' | 'pressure' | 'tiltUprightness' | 'tipAngleDegrees' | 'sampledTipAlpha'
""",
    """      | 'x'
      | 'y'
      | 'pressure'
      | 'velocity'
      | 'tiltUprightness'
      | 'tipAngleDegrees'
      | 'sampledTipAlpha'
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """    const tiltFlowScale = this.#tiltFlowEnabled ? tiltResponse : 1;
    if (
      sizeScale <= 0 ||
""",
    """    const tiltFlowScale = this.#tiltFlowEnabled ? tiltResponse : 1;
    const usesVelocity =
      this.#velocitySizeEnabled || this.#velocityOpacityEnabled || this.#velocityFlowEnabled;
    const velocityResponse = usesVelocity ? this.#velocityResponseCurve.sample(stamp.velocity) : 1;
    const velocitySizeScale = this.#velocitySizeEnabled ? velocityResponse : 1;
    const velocityOpacityScale = this.#velocityOpacityEnabled ? velocityResponse : 1;
    const velocityFlowScale = this.#velocityFlowEnabled ? velocityResponse : 1;
    if (
      sizeScale <= 0 ||
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """      tiltSizeScale <= 0 ||
      tiltOpacityScale <= 0 ||
      tiltFlowScale <= 0
    ) {
""",
    """      tiltSizeScale <= 0 ||
      tiltOpacityScale <= 0 ||
      tiltFlowScale <= 0 ||
      velocitySizeScale <= 0 ||
      velocityOpacityScale <= 0 ||
      velocityFlowScale <= 0
    ) {
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """      this.#radius * sizeScale * pressureSizeScale * tiltSizeScale,
      this.#flow * opacityScale * pressureFlowScale * tiltFlowScale,
      this.#strokeOpacity * pressureOpacityScale * tiltOpacityScale,
""",
    """      this.#radius * sizeScale * pressureSizeScale * tiltSizeScale * velocitySizeScale,
      this.#flow * opacityScale * pressureFlowScale * tiltFlowScale * velocityFlowScale,
      this.#strokeOpacity * pressureOpacityScale * tiltOpacityScale * velocityOpacityScale,
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """    pressure: number,
    tiltUprightness: number,
    tipAngleDegrees: number,
""",
    """    pressure: number,
    velocity: number,
    tiltUprightness: number,
    tipAngleDegrees: number,
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """      pressure,
      tiltUprightness,
      tipAngleDegrees,
""",
    """      pressure,
      velocity,
      tiltUprightness,
      tipAngleDegrees,
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """    pressure: number,
    tiltUprightness: number,
    orientationDegrees: number,
  ): void {
""",
    """    pressure: number,
    velocity: number,
    tiltUprightness: number,
    orientationDegrees: number,
  ): void {
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """    let cursorPressure = lastPoint.pressure;
    let cursorTiltUprightness = lastPoint.tiltUprightness;
""",
    """    let cursorPressure = lastPoint.pressure;
    let cursorVelocity = lastPoint.velocity;
    let cursorTiltUprightness = lastPoint.tiltUprightness;
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """      cursorPressure += (pressure - cursorPressure) * ratio;
      cursorTiltUprightness += (tiltUprightness - cursorTiltUprightness) * ratio;
""",
    """      cursorPressure += (pressure - cursorPressure) * ratio;
      cursorVelocity += (velocity - cursorVelocity) * ratio;
      cursorTiltUprightness += (tiltUprightness - cursorTiltUprightness) * ratio;
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """        cursorPressure,
        cursorTiltUprightness,
        this.#resolvedTipAngleDegrees(
""",
    """        cursorPressure,
        cursorVelocity,
        cursorTiltUprightness,
        this.#resolvedTipAngleDegrees(
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """    this.#lastPoint = { x, y, pressure, tiltUprightness, orientationDegrees };
""",
    """    this.#lastPoint = { x, y, pressure, velocity, tiltUprightness, orientationDegrees };
""",
)

# Canonical facade forwards normalized velocity and mapping configuration without changing dab ABI.
replace_once(
    'src/app/canonical-raster-brush.ts',
    """  readonly pressure?: number;
  readonly tiltX?: number;
""",
    """  readonly pressure?: number;
  readonly velocity?: number;
  readonly tiltX?: number;
""",
)
replace_once(
    'src/app/canonical-raster-brush.ts',
    """      readonly tiltFlowEnabled?: boolean;
      readonly tiltResponseCurve?: readonly ResponseCurvePointV1[];
      readonly hardness?: number;
""",
    """      readonly tiltFlowEnabled?: boolean;
      readonly tiltResponseCurve?: readonly ResponseCurvePointV1[];
      readonly velocitySizeEnabled?: boolean;
      readonly velocityOpacityEnabled?: boolean;
      readonly velocityFlowEnabled?: boolean;
      readonly velocityResponseCurve?: readonly ResponseCurvePointV1[];
      readonly hardness?: number;
""",
)
replace_once(
    'src/app/canonical-raster-brush.ts',
    """      ...(options.tiltResponseCurve === undefined
        ? {}
        : { tiltResponseCurve: options.tiltResponseCurve }),
      ...(options.hardness === undefined ? {} : { hardness: options.hardness }),
""",
    """      ...(options.tiltResponseCurve === undefined
        ? {}
        : { tiltResponseCurve: options.tiltResponseCurve }),
      ...(options.velocitySizeEnabled === undefined
        ? {}
        : { velocitySizeEnabled: options.velocitySizeEnabled }),
      ...(options.velocityOpacityEnabled === undefined
        ? {}
        : { velocityOpacityEnabled: options.velocityOpacityEnabled }),
      ...(options.velocityFlowEnabled === undefined
        ? {}
        : { velocityFlowEnabled: options.velocityFlowEnabled }),
      ...(options.velocityResponseCurve === undefined
        ? {}
        : { velocityResponseCurve: options.velocityResponseCurve }),
      ...(options.hardness === undefined ? {} : { hardness: options.hardness }),
""",
)

# Paint session: raw confirmed document-space timestamps own velocity measurement.
replace_once(
    'src/app/paint-session-controller.ts',
    """  DEFAULT_BRUSH_PARAMETER_VALUES_V1,
  type BrushParameterValuesV1,
""",
    """  DEFAULT_BRUSH_PARAMETER_VALUES_V1,
  DEFAULT_BRUSH_VELOCITY_MAXIMUM_PX_PER_SECOND_V1,
  MIN_BRUSH_VELOCITY_MAXIMUM_PX_PER_SECOND_V1,
  MAX_BRUSH_VELOCITY_MAXIMUM_PX_PER_SECOND_V1,
  type BrushParameterValuesV1,
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """  readonly brushTiltFlowEnabled: boolean;
  readonly brushTiltResponseCurve: readonly ResponseCurvePointV1[];
  readonly brushTipAngleDegrees: number;
""",
    """  readonly brushTiltFlowEnabled: boolean;
  readonly brushTiltResponseCurve: readonly ResponseCurvePointV1[];
  readonly brushVelocitySizeEnabled: boolean;
  readonly brushVelocityOpacityEnabled: boolean;
  readonly brushVelocityFlowEnabled: boolean;
  readonly brushVelocityResponseCurve: readonly ResponseCurvePointV1[];
  readonly brushVelocityMaximumPxPerSecond: number;
  readonly brushTipAngleDegrees: number;
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """function deterministicPaintStrokeSeedV1(strokeId: string): number {
  let hash = 0x811c9dc5;
""",
    """export interface PaintVelocitySampleV1 {
  readonly documentX: number;
  readonly documentY: number;
  readonly timestampMs: number;
}

export function normalizedPaintVelocityV1(
  previous: PaintVelocitySampleV1 | null,
  current: PaintVelocitySampleV1,
  previousNormalizedVelocity: number,
  maximumPxPerSecond: number,
): number {
  if (
    !Number.isFinite(previousNormalizedVelocity) ||
    previousNormalizedVelocity < 0 ||
    previousNormalizedVelocity > 1
  ) {
    throw new RangeError('previous normalized paint velocity must be within 0..1');
  }
  if (
    !Number.isFinite(maximumPxPerSecond) ||
    maximumPxPerSecond < MIN_BRUSH_VELOCITY_MAXIMUM_PX_PER_SECOND_V1 ||
    maximumPxPerSecond > MAX_BRUSH_VELOCITY_MAXIMUM_PX_PER_SECOND_V1
  ) {
    throw new RangeError('paint velocity maximum must be within 100..20000 document px/s');
  }
  if (previous === null) return 0;
  const dtMs = current.timestampMs - previous.timestampMs;
  if (!Number.isFinite(dtMs) || dtMs <= 0) return previousNormalizedVelocity;
  const distancePx = Math.hypot(
    current.documentX - previous.documentX,
    current.documentY - previous.documentY,
  );
  const velocityPxPerSecond = (distancePx * 1000) / dtMs;
  return Math.max(0, Math.min(1, velocityPxPerSecond / maximumPxPerSecond));
}

function velocitySeriesV1(
  samples: readonly PaintStrokeSampleV1[],
  maximumPxPerSecond: number,
  previousSample: PaintStrokeSampleV1 | null = null,
  previousVelocity = 0,
): Readonly<{ values: readonly number[]; lastVelocity: number }> {
  const values: number[] = [];
  let prior = previousSample;
  let velocity = previousVelocity;
  for (const sample of samples) {
    velocity = normalizedPaintVelocityV1(prior, sample, velocity, maximumPxPerSecond);
    values.push(velocity);
    prior = sample;
  }
  return Object.freeze({ values: Object.freeze(values), lastVelocity: velocity });
}

function deterministicPaintStrokeSeedV1(strokeId: string): number {
  let hash = 0x811c9dc5;
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """  #activeRealtimeStabilizer: RealtimeBrushStabilizerV1 | null = null;
  #activeDabDelta: readonly BaselineBrushDabV1[] = Object.freeze([]);
""",
    """  #activeRealtimeStabilizer: RealtimeBrushStabilizerV1 | null = null;
  #activeVelocity = 0;
  #activeDabDelta: readonly BaselineBrushDabV1[] = Object.freeze([]);
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """  #brushTiltFlowEnabled = false;
  #brushTiltResponseCurve: readonly ResponseCurvePointV1[] = LINEAR_RESPONSE_CURVE_V1;
  #brushTipAngleDegrees: number = BASELINE_BRUSH_TIP_ANGLE_DEGREES;
""",
    """  #brushTiltFlowEnabled = false;
  #brushTiltResponseCurve: readonly ResponseCurvePointV1[] = LINEAR_RESPONSE_CURVE_V1;
  #brushVelocitySizeEnabled = false;
  #brushVelocityOpacityEnabled = false;
  #brushVelocityFlowEnabled = false;
  #brushVelocityResponseCurve: readonly ResponseCurvePointV1[] = LINEAR_RESPONSE_CURVE_V1;
  #brushVelocityMaximumPxPerSecond = DEFAULT_BRUSH_VELOCITY_MAXIMUM_PX_PER_SECOND_V1;
  #brushTipAngleDegrees: number = BASELINE_BRUSH_TIP_ANGLE_DEGREES;
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """      brushTiltFlowEnabled: this.#brushTiltFlowEnabled,
      brushTiltResponseCurve: this.#brushTiltResponseCurve,
      brushTipAngleDegrees: this.#brushTipAngleDegrees,
""",
    """      brushTiltFlowEnabled: this.#brushTiltFlowEnabled,
      brushTiltResponseCurve: this.#brushTiltResponseCurve,
      brushVelocitySizeEnabled: this.#brushVelocitySizeEnabled,
      brushVelocityOpacityEnabled: this.#brushVelocityOpacityEnabled,
      brushVelocityFlowEnabled: this.#brushVelocityFlowEnabled,
      brushVelocityResponseCurve: this.#brushVelocityResponseCurve,
      brushVelocityMaximumPxPerSecond: this.#brushVelocityMaximumPxPerSecond,
      brushTipAngleDegrees: this.#brushTipAngleDegrees,
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """  brushTiltResponseCurve(): readonly ResponseCurvePointV1[] {
    return this.#brushTiltResponseCurve;
  }

  setBrushTipAngleDegrees(angleDegrees: number): number {
""",
    """  brushTiltResponseCurve(): readonly ResponseCurvePointV1[] {
    return this.#brushTiltResponseCurve;
  }

  setBrushVelocitySizeEnabled(enabled: boolean): boolean {
    if (typeof enabled !== 'boolean') throw new TypeError('invalid runtime velocity-size flag');
    if (enabled !== this.#brushVelocitySizeEnabled) this.#clearActiveStroke();
    this.#brushVelocitySizeEnabled = enabled;
    return this.#brushVelocitySizeEnabled;
  }

  brushVelocitySizeEnabled(): boolean {
    return this.#brushVelocitySizeEnabled;
  }

  setBrushVelocityOpacityEnabled(enabled: boolean): boolean {
    if (typeof enabled !== 'boolean') throw new TypeError('invalid runtime velocity-opacity flag');
    if (enabled !== this.#brushVelocityOpacityEnabled) this.#clearActiveStroke();
    this.#brushVelocityOpacityEnabled = enabled;
    return this.#brushVelocityOpacityEnabled;
  }

  brushVelocityOpacityEnabled(): boolean {
    return this.#brushVelocityOpacityEnabled;
  }

  setBrushVelocityFlowEnabled(enabled: boolean): boolean {
    if (typeof enabled !== 'boolean') throw new TypeError('invalid runtime velocity-flow flag');
    if (enabled !== this.#brushVelocityFlowEnabled) this.#clearActiveStroke();
    this.#brushVelocityFlowEnabled = enabled;
    return this.#brushVelocityFlowEnabled;
  }

  brushVelocityFlowEnabled(): boolean {
    return this.#brushVelocityFlowEnabled;
  }

  setBrushVelocityResponseCurve(
    curve: readonly ResponseCurvePointV1[],
  ): readonly ResponseCurvePointV1[] {
    const normalized = normalizeResponseCurveV1(curve);
    if (!responseCurveEqualsV1(normalized, this.#brushVelocityResponseCurve))
      this.#clearActiveStroke();
    this.#brushVelocityResponseCurve = normalized;
    return this.#brushVelocityResponseCurve;
  }

  brushVelocityResponseCurve(): readonly ResponseCurvePointV1[] {
    return this.#brushVelocityResponseCurve;
  }

  setBrushVelocityMaximumPxPerSecond(maximumPxPerSecond: number): number {
    if (
      !Number.isFinite(maximumPxPerSecond) ||
      maximumPxPerSecond < MIN_BRUSH_VELOCITY_MAXIMUM_PX_PER_SECOND_V1 ||
      maximumPxPerSecond > MAX_BRUSH_VELOCITY_MAXIMUM_PX_PER_SECOND_V1
    ) {
      throw new RangeError('invalid runtime velocity maximum');
    }
    if (maximumPxPerSecond !== this.#brushVelocityMaximumPxPerSecond) this.#clearActiveStroke();
    this.#brushVelocityMaximumPxPerSecond = maximumPxPerSecond;
    return this.#brushVelocityMaximumPxPerSecond;
  }

  brushVelocityMaximumPxPerSecond(): number {
    return this.#brushVelocityMaximumPxPerSecond;
  }

  setBrushTipAngleDegrees(angleDegrees: number): number {
""",
)
# Post-stroke replay: recompute exactly from canonical raw samples/timestamps.
replace_once(
    'src/app/paint-session-controller.ts',
    """          const liveGeometry = this.#activeSamples.map((sample) => {
            const point = replayStabilizer.push(sample);
            return Object.freeze({
""",
    """          const replayVelocities = velocitySeriesV1(
            this.#activeSamples,
            this.#brushVelocityMaximumPxPerSecond,
          ).values;
          const liveGeometry = this.#activeSamples.map((sample, index) => {
            const point = replayStabilizer.push(sample);
            return Object.freeze({
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """              pressure: completed.source === 'pen' ? sample.pressure : 1,
              tiltX: completed.source === 'pen' ? sample.tiltX : 0,
""",
    """              pressure: completed.source === 'pen' ? sample.pressure : 1,
              velocity: replayVelocities[index] ?? 0,
              tiltX: completed.source === 'pen' ? sample.tiltX : 0,
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """                  pressure: completed.source === 'pen' ? rawEndpoint.pressure : 1,
                  tiltX: completed.source === 'pen' ? rawEndpoint.tiltX : 0,
""",
    """                  pressure: completed.source === 'pen' ? rawEndpoint.pressure : 1,
                  velocity: replayVelocities.at(-1) ?? 0,
                  tiltX: completed.source === 'pen' ? rawEndpoint.tiltX : 0,
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """              pressure: liveGeometry[index]?.pressure ?? 1,
              tiltX: liveGeometry[index]?.tiltX ?? 0,
""",
    """              pressure: liveGeometry[index]?.pressure ?? 1,
              velocity: liveGeometry[index]?.velocity ?? 0,
              tiltX: liveGeometry[index]?.tiltX ?? 0,
""",
)
# Live start: compute raw velocity series before stabilization, then attach by sample index.
replace_once(
    'src/app/paint-session-controller.ts',
    """    const stabilizer = new RealtimeBrushStabilizerV1(this.#brushRealtimeStabilizationAmount);
    const stabilizedSamples = samples.map((sample) => {
      const point = stabilizer.push(sample);
      return Object.freeze({
        ...point,
        pressure: source === 'pen' ? sample.pressure : 1,
""",
    """    const stabilizer = new RealtimeBrushStabilizerV1(this.#brushRealtimeStabilizationAmount);
    const velocitySeries = velocitySeriesV1(samples, this.#brushVelocityMaximumPxPerSecond);
    this.#activeVelocity = velocitySeries.lastVelocity;
    const stabilizedSamples = samples.map((sample, index) => {
      const point = stabilizer.push(sample);
      return Object.freeze({
        ...point,
        pressure: source === 'pen' ? sample.pressure : 1,
        velocity: velocitySeries.values[index] ?? 0,
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """        tiltFlowEnabled: this.#brushTiltFlowEnabled,
        tiltResponseCurve: this.#brushTiltResponseCurve,
        hardness: this.#brushHardness,
""",
    """        tiltFlowEnabled: this.#brushTiltFlowEnabled,
        tiltResponseCurve: this.#brushTiltResponseCurve,
        velocitySizeEnabled: this.#brushVelocitySizeEnabled,
        velocityOpacityEnabled: this.#brushVelocityOpacityEnabled,
        velocityFlowEnabled: this.#brushVelocityFlowEnabled,
        velocityResponseCurve: this.#brushVelocityResponseCurve,
        hardness: this.#brushHardness,
""",
)
# Live append: continue velocity from the previous canonical raw sample; non-positive dt holds last value.
replace_once(
    'src/app/paint-session-controller.ts',
    """    if (additions.length === 0) return;
    this.#activeSamples.push(...additions);
    const stabilizedAdditions = additions.map((sample) => {
      const point = stabilizer.push(sample);
      return Object.freeze({
        ...point,
        pressure: active.source === 'pen' ? sample.pressure : 1,
""",
    """    if (additions.length === 0) return;
    const previousRawSample = this.#activeSamples.at(-1) ?? null;
    const velocitySeries = velocitySeriesV1(
      additions,
      this.#brushVelocityMaximumPxPerSecond,
      previousRawSample,
      this.#activeVelocity,
    );
    this.#activeVelocity = velocitySeries.lastVelocity;
    this.#activeSamples.push(...additions);
    const stabilizedAdditions = additions.map((sample, index) => {
      const point = stabilizer.push(sample);
      return Object.freeze({
        ...point,
        pressure: active.source === 'pen' ? sample.pressure : 1,
        velocity: velocitySeries.values[index] ?? this.#activeVelocity,
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """                pressure: active.source === 'pen' ? rawEndpoint.pressure : 1,
                tiltX: active.source === 'pen' ? rawEndpoint.tiltX : 0,
""",
    """                pressure: active.source === 'pen' ? rawEndpoint.pressure : 1,
                velocity: this.#activeVelocity,
                tiltX: active.source === 'pen' ? rawEndpoint.tiltX : 0,
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """    this.#activeRealtimeStabilizer = null;
    this.#activeDabDelta = Object.freeze([]);
""",
    """    this.#activeRealtimeStabilizer = null;
    this.#activeVelocity = 0;
    this.#activeDabDelta = Object.freeze([]);
""",
)

# Preset library mutation helpers.
replace_once(
    'src/app/brush-preset-library.ts',
    """  withBrushTiltFlowEnabledV1,
  withBrushTiltResponseCurveV1,
  withBrushStrokeSpacingV1,
""",
    """  withBrushTiltFlowEnabledV1,
  withBrushTiltResponseCurveV1,
  withBrushVelocitySizeEnabledV1,
  withBrushVelocityOpacityEnabledV1,
  withBrushVelocityFlowEnabledV1,
  withBrushVelocityResponseCurveV1,
  withBrushVelocityMaximumPxPerSecondV1,
  withBrushStrokeSpacingV1,
""",
)
replace_once(
    'src/app/brush-preset-library.ts',
    """export function updateBrushPresetCustomTipV1(
""",
    """export function updateBrushPresetVelocitySizeV1(
  state: BrushPresetLibraryStateV1,
  presetId: string,
  enabled: boolean,
): BrushPresetLibraryStateV1 {
  return updateItemV1(state, presetId, (item) => {
    if (item.locked) throw new Error('locked brush preset cannot be edited');
    const current = withBrushVelocitySizeEnabledV1(item.preset, enabled);
    if (JSON.stringify(current) === JSON.stringify(item.preset)) return item;
    const next = normalizeBrushPresetV1({ ...current, revision: item.preset.revision + 1 });
    return itemV1({ source: item.source, baseline: item.baseline, preset: next, locked: item.locked });
  });
}

export function updateBrushPresetVelocityOpacityV1(
  state: BrushPresetLibraryStateV1,
  presetId: string,
  enabled: boolean,
): BrushPresetLibraryStateV1 {
  return updateItemV1(state, presetId, (item) => {
    if (item.locked) throw new Error('locked brush preset cannot be edited');
    const current = withBrushVelocityOpacityEnabledV1(item.preset, enabled);
    if (JSON.stringify(current) === JSON.stringify(item.preset)) return item;
    const next = normalizeBrushPresetV1({ ...current, revision: item.preset.revision + 1 });
    return itemV1({ source: item.source, baseline: item.baseline, preset: next, locked: item.locked });
  });
}

export function updateBrushPresetVelocityFlowV1(
  state: BrushPresetLibraryStateV1,
  presetId: string,
  enabled: boolean,
): BrushPresetLibraryStateV1 {
  return updateItemV1(state, presetId, (item) => {
    if (item.locked) throw new Error('locked brush preset cannot be edited');
    const current = withBrushVelocityFlowEnabledV1(item.preset, enabled);
    if (JSON.stringify(current) === JSON.stringify(item.preset)) return item;
    const next = normalizeBrushPresetV1({ ...current, revision: item.preset.revision + 1 });
    return itemV1({ source: item.source, baseline: item.baseline, preset: next, locked: item.locked });
  });
}

export function updateBrushPresetVelocityResponseCurveV1(
  state: BrushPresetLibraryStateV1,
  presetId: string,
  curve: readonly ResponseCurvePointV1[],
): BrushPresetLibraryStateV1 {
  return updateItemV1(state, presetId, (item) => {
    if (item.locked) throw new Error('locked brush preset cannot be edited');
    const current = withBrushVelocityResponseCurveV1(item.preset, curve);
    if (JSON.stringify(current) === JSON.stringify(item.preset)) return item;
    const next = normalizeBrushPresetV1({ ...current, revision: item.preset.revision + 1 });
    return itemV1({ source: item.source, baseline: item.baseline, preset: next, locked: item.locked });
  });
}

export function updateBrushPresetVelocityMaximumV1(
  state: BrushPresetLibraryStateV1,
  presetId: string,
  maximumPxPerSecond: number,
): BrushPresetLibraryStateV1 {
  return updateItemV1(state, presetId, (item) => {
    if (item.locked) throw new Error('locked brush preset cannot be edited');
    const current = withBrushVelocityMaximumPxPerSecondV1(item.preset, maximumPxPerSecond);
    if (JSON.stringify(current) === JSON.stringify(item.preset)) return item;
    const next = normalizeBrushPresetV1({ ...current, revision: item.preset.revision + 1 });
    return itemV1({ source: item.source, baseline: item.baseline, preset: next, locked: item.locked });
  });
}

export function updateBrushPresetCustomTipV1(
""",
)

# Brush Properties UI/controller: third shared curve editor plus normalization maximum.
replace_once(
    'src/app/brush-preset-controller.ts',
    """  brushTiltFlowEnabledV1,
  brushTiltResponseCurveV1,
  BUILTIN_BRUSH_GRAIN_RESOURCES_V1,
""",
    """  brushTiltFlowEnabledV1,
  brushTiltResponseCurveV1,
  brushVelocitySizeEnabledV1,
  brushVelocityOpacityEnabledV1,
  brushVelocityFlowEnabledV1,
  brushVelocityResponseCurveV1,
  brushVelocityMaximumPxPerSecondV1,
  BUILTIN_BRUSH_GRAIN_RESOURCES_V1,
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  updateBrushPresetTiltFlowV1,
  updateBrushPresetTiltResponseCurveV1,
  updateBrushPresetSpacingV1,
""",
    """  updateBrushPresetTiltFlowV1,
  updateBrushPresetTiltResponseCurveV1,
  updateBrushPresetVelocitySizeV1,
  updateBrushPresetVelocityOpacityV1,
  updateBrushPresetVelocityFlowV1,
  updateBrushPresetVelocityResponseCurveV1,
  updateBrushPresetVelocityMaximumV1,
  updateBrushPresetSpacingV1,
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  const tiltCurveDelete = requireElement('#brush-tilt-curve-delete', HTMLButtonElement);
  const tiltCurveReset = requireElement('#brush-tilt-curve-reset', HTMLButtonElement);
  const tipShape = requireElement('#brush-tip-shape', HTMLSelectElement);
""",
    """  const tiltCurveDelete = requireElement('#brush-tilt-curve-delete', HTMLButtonElement);
  const tiltCurveReset = requireElement('#brush-tilt-curve-reset', HTMLButtonElement);
  const velocitySizeButton = requireElement('#brush-velocity-size', HTMLButtonElement);
  const velocityOpacityButton = requireElement('#brush-velocity-opacity', HTMLButtonElement);
  const velocityFlowButton = requireElement('#brush-velocity-flow', HTMLButtonElement);
  const velocityMaximumRange = requireElement('#brush-velocity-maximum-range', HTMLInputElement);
  const velocityMaximumNumber = requireElement('#brush-velocity-maximum-number', HTMLInputElement);
  const velocityCurveCanvas = requireElement('#brush-velocity-curve', HTMLCanvasElement);
  const velocityCurvePreset = requireElement('#brush-velocity-curve-preset', HTMLSelectElement);
  const velocityCurveInput = requireElement('#brush-velocity-curve-input', HTMLInputElement);
  const velocityCurveOutput = requireElement('#brush-velocity-curve-output', HTMLInputElement);
  const velocityCurveDelete = requireElement('#brush-velocity-curve-delete', HTMLButtonElement);
  const velocityCurveReset = requireElement('#brush-velocity-curve-reset', HTMLButtonElement);
  const tipShape = requireElement('#brush-tip-shape', HTMLSelectElement);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  let pressureCurveEditor: SharedCurveEditorV1 | null = null;
  let tiltCurveEditor: SharedCurveEditorV1 | null = null;
  let idCounter = 0;
""",
    """  let pressureCurveEditor: SharedCurveEditorV1 | null = null;
  let tiltCurveEditor: SharedCurveEditorV1 | null = null;
  let velocityCurveEditor: SharedCurveEditorV1 | null = null;
  let idCounter = 0;
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    const tiltResponseCurve = brushTiltResponseCurveV1(item.preset);
    input.paintSession.setBrushTiltResponseCurve(tiltResponseCurve);
    const tipAssets = brushTipAssetsV1(item.preset);
""",
    """    const tiltResponseCurve = brushTiltResponseCurveV1(item.preset);
    input.paintSession.setBrushTiltResponseCurve(tiltResponseCurve);
    const velocitySizeEnabled = brushVelocitySizeEnabledV1(item.preset);
    input.paintSession.setBrushVelocitySizeEnabled(velocitySizeEnabled);
    const velocityOpacityEnabled = brushVelocityOpacityEnabledV1(item.preset);
    input.paintSession.setBrushVelocityOpacityEnabled(velocityOpacityEnabled);
    const velocityFlowEnabled = brushVelocityFlowEnabledV1(item.preset);
    input.paintSession.setBrushVelocityFlowEnabled(velocityFlowEnabled);
    const velocityResponseCurve = brushVelocityResponseCurveV1(item.preset);
    input.paintSession.setBrushVelocityResponseCurve(velocityResponseCurve);
    const velocityMaximum = brushVelocityMaximumPxPerSecondV1(item.preset);
    input.paintSession.setBrushVelocityMaximumPxPerSecond(velocityMaximum);
    const tipAssets = brushTipAssetsV1(item.preset);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    input.root.dataset.illustroBrushTiltCurvePoints = String(tiltResponseCurve.length);
    input.root.dataset.illustroBrushTipShape = brushTipShapeV1(item.preset);
""",
    """    input.root.dataset.illustroBrushTiltCurvePoints = String(tiltResponseCurve.length);
    input.root.dataset.illustroBrushVelocitySize = String(velocitySizeEnabled);
    input.root.dataset.illustroBrushVelocityOpacity = String(velocityOpacityEnabled);
    input.root.dataset.illustroBrushVelocityFlow = String(velocityFlowEnabled);
    input.root.dataset.illustroBrushVelocityCurvePoints = String(velocityResponseCurve.length);
    input.root.dataset.illustroBrushVelocityMaximumPxPerSecond = String(velocityMaximum);
    input.root.dataset.illustroBrushTipShape = brushTipShapeV1(item.preset);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    const tiltResponseCurve = brushTiltResponseCurveV1(selected.preset);
    tiltCurveEditor?.setCurve(tiltResponseCurve);
    tipShape.value = brushTipShapeV1(selected.preset);
""",
    """    const tiltResponseCurve = brushTiltResponseCurveV1(selected.preset);
    tiltCurveEditor?.setCurve(tiltResponseCurve);
    const velocitySizeEnabled = brushVelocitySizeEnabledV1(selected.preset);
    velocitySizeButton.textContent = velocitySizeEnabled ? 'ON' : 'OFF';
    velocitySizeButton.setAttribute('aria-pressed', String(velocitySizeEnabled));
    const velocityOpacityEnabled = brushVelocityOpacityEnabledV1(selected.preset);
    velocityOpacityButton.textContent = velocityOpacityEnabled ? 'ON' : 'OFF';
    velocityOpacityButton.setAttribute('aria-pressed', String(velocityOpacityEnabled));
    const velocityFlowEnabled = brushVelocityFlowEnabledV1(selected.preset);
    velocityFlowButton.textContent = velocityFlowEnabled ? 'ON' : 'OFF';
    velocityFlowButton.setAttribute('aria-pressed', String(velocityFlowEnabled));
    const velocityMaximum = brushVelocityMaximumPxPerSecondV1(selected.preset);
    configurePair(velocityMaximumRange, velocityMaximumNumber, 100, 20000, 100, velocityMaximum);
    const velocityResponseCurve = brushVelocityResponseCurveV1(selected.preset);
    velocityCurveEditor?.setCurve(velocityResponseCurve);
    tipShape.value = brushTipShapeV1(selected.preset);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    const tiltCurveLabel = responseCurveIsLinearV1(tiltResponseCurve) ? '' : ' · T-Curve';
    propertyStatus.textContent = `${parameters.sizePx.toFixed(1)} px · ${Math.round(parameters.opacity * 100)}% · ${Math.round(parameters.flow * 100)}% · H${Math.round(hardness * 100)}% · D${Math.round(tipDensity * 100)}% · S${Math.round(spacing.spacingRatio * 100)}% · A${Math.round(tipAngleDegrees)}° · F${Math.round(tipDirectionDegrees)}°${followRotation ? ' · Follow' : ''}${penOrientationEnabled ? ' · PenDir' : ''}${repeatLabel}${startLabel}${endLabel}${sizeTaperLabel}${opacityTaperLabel}${forcedTaperLabel}${stabilizationLabel}${postCorrectionLabel}${grainLabel}${paperLabel}${textureStrengthLabel}${textureScaleLabel}${textureRotationLabel}${textureBlendLabel}${pressureSizeLabel}${pressureOpacityLabel}${pressureFlowLabel}${pressureCurveLabel}${tiltSizeLabel}${tiltOpacityLabel}${tiltFlowLabel}${tiltCurveLabel}`;
""",
    """    const tiltCurveLabel = responseCurveIsLinearV1(tiltResponseCurve) ? '' : ' · T-Curve';
    const velocitySizeLabel = velocitySizeEnabled ? ' · V→Size' : '';
    const velocityOpacityLabel = velocityOpacityEnabled ? ' · V→Opacity' : '';
    const velocityFlowLabel = velocityFlowEnabled ? ' · V→Flow' : '';
    const velocityCurveLabel = responseCurveIsLinearV1(velocityResponseCurve) ? '' : ' · V-Curve';
    const velocityMaximumLabel =
      velocitySizeEnabled || velocityOpacityEnabled || velocityFlowEnabled
        ? ` · Vmax${Math.round(velocityMaximum)}px/s`
        : '';
    propertyStatus.textContent = `${parameters.sizePx.toFixed(1)} px · ${Math.round(parameters.opacity * 100)}% · ${Math.round(parameters.flow * 100)}% · H${Math.round(hardness * 100)}% · D${Math.round(tipDensity * 100)}% · S${Math.round(spacing.spacingRatio * 100)}% · A${Math.round(tipAngleDegrees)}° · F${Math.round(tipDirectionDegrees)}°${followRotation ? ' · Follow' : ''}${penOrientationEnabled ? ' · PenDir' : ''}${repeatLabel}${startLabel}${endLabel}${sizeTaperLabel}${opacityTaperLabel}${forcedTaperLabel}${stabilizationLabel}${postCorrectionLabel}${grainLabel}${paperLabel}${textureStrengthLabel}${textureScaleLabel}${textureRotationLabel}${textureBlendLabel}${pressureSizeLabel}${pressureOpacityLabel}${pressureFlowLabel}${pressureCurveLabel}${tiltSizeLabel}${tiltOpacityLabel}${tiltFlowLabel}${tiltCurveLabel}${velocitySizeLabel}${velocityOpacityLabel}${velocityFlowLabel}${velocityCurveLabel}${velocityMaximumLabel}`;
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """      tiltSizeButton,
      tiltOpacityButton,
      tiltFlowButton,
      tipShape,
""",
    """      tiltSizeButton,
      tiltOpacityButton,
      tiltFlowButton,
      velocitySizeButton,
      velocityOpacityButton,
      velocityFlowButton,
      velocityMaximumRange,
      velocityMaximumNumber,
      tipShape,
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    pressureCurveEditor?.setDisabled(locked);
    tiltCurveEditor?.setDisabled(locked);
    tipAssetSelect.disabled = locked || tipAssets.length === 0;
""",
    """    pressureCurveEditor?.setDisabled(locked);
    tiltCurveEditor?.setDisabled(locked);
    velocityCurveEditor?.setDisabled(locked);
    tipAssetSelect.disabled = locked || tipAssets.length === 0;
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  tiltCurveEditor = installSharedCurveEditorV1({
    elements: {
      canvas: tiltCurveCanvas,
      preset: tiltCurvePreset,
      inputNumber: tiltCurveInput,
      outputNumber: tiltCurveOutput,
      deleteButton: tiltCurveDelete,
      resetButton: tiltCurveReset,
    },
    initialCurve: brushTiltResponseCurveV1(selectedBrushPresetItemV1(state).preset),
    onChange: (curve) =>
      mutate(() => updateBrushPresetTiltResponseCurveV1(state, state.selectedPresetId, curve)),
  });

  const onSearch = (): void => {
""",
    """  tiltCurveEditor = installSharedCurveEditorV1({
    elements: {
      canvas: tiltCurveCanvas,
      preset: tiltCurvePreset,
      inputNumber: tiltCurveInput,
      outputNumber: tiltCurveOutput,
      deleteButton: tiltCurveDelete,
      resetButton: tiltCurveReset,
    },
    initialCurve: brushTiltResponseCurveV1(selectedBrushPresetItemV1(state).preset),
    onChange: (curve) =>
      mutate(() => updateBrushPresetTiltResponseCurveV1(state, state.selectedPresetId, curve)),
  });

  velocityCurveEditor = installSharedCurveEditorV1({
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
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  const onTiltFlow = (): void =>
    mutate(() =>
      updateBrushPresetTiltFlowV1(
        state,
        state.selectedPresetId,
        !brushTiltFlowEnabledV1(selectedBrushPresetItemV1(state).preset),
      ),
    );
  const onTipShape = (): void => {
""",
    """  const onTiltFlow = (): void =>
    mutate(() =>
      updateBrushPresetTiltFlowV1(
        state,
        state.selectedPresetId,
        !brushTiltFlowEnabledV1(selectedBrushPresetItemV1(state).preset),
      ),
    );
  const onVelocitySize = (): void =>
    mutate(() =>
      updateBrushPresetVelocitySizeV1(
        state,
        state.selectedPresetId,
        !brushVelocitySizeEnabledV1(selectedBrushPresetItemV1(state).preset),
      ),
    );
  const onVelocityOpacity = (): void =>
    mutate(() =>
      updateBrushPresetVelocityOpacityV1(
        state,
        state.selectedPresetId,
        !brushVelocityOpacityEnabledV1(selectedBrushPresetItemV1(state).preset),
      ),
    );
  const onVelocityFlow = (): void =>
    mutate(() =>
      updateBrushPresetVelocityFlowV1(
        state,
        state.selectedPresetId,
        !brushVelocityFlowEnabledV1(selectedBrushPresetItemV1(state).preset),
      ),
    );
  const updateVelocityMaximum = (value: number): void =>
    mutate(() => updateBrushPresetVelocityMaximumV1(state, state.selectedPresetId, value));
  const onVelocityMaximumRange = (): void =>
    updateVelocityMaximum(Number(velocityMaximumRange.value));
  const onVelocityMaximumNumber = (): void =>
    updateVelocityMaximum(Number(velocityMaximumNumber.value));
  const onTipShape = (): void => {
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  tiltSizeButton.addEventListener('click', onTiltSize);
  tiltOpacityButton.addEventListener('click', onTiltOpacity);
  tiltFlowButton.addEventListener('click', onTiltFlow);
  tipShape.addEventListener('change', onTipShape);
""",
    """  tiltSizeButton.addEventListener('click', onTiltSize);
  tiltOpacityButton.addEventListener('click', onTiltOpacity);
  tiltFlowButton.addEventListener('click', onTiltFlow);
  velocitySizeButton.addEventListener('click', onVelocitySize);
  velocityOpacityButton.addEventListener('click', onVelocityOpacity);
  velocityFlowButton.addEventListener('click', onVelocityFlow);
  velocityMaximumRange.addEventListener('input', onVelocityMaximumRange);
  velocityMaximumNumber.addEventListener('change', onVelocityMaximumNumber);
  tipShape.addEventListener('change', onTipShape);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """      tiltSizeButton.removeEventListener('click', onTiltSize);
      tiltOpacityButton.removeEventListener('click', onTiltOpacity);
      tiltFlowButton.removeEventListener('click', onTiltFlow);
      pressureCurveEditor?.dispose();
""",
    """      tiltSizeButton.removeEventListener('click', onTiltSize);
      tiltOpacityButton.removeEventListener('click', onTiltOpacity);
      tiltFlowButton.removeEventListener('click', onTiltFlow);
      velocitySizeButton.removeEventListener('click', onVelocitySize);
      velocityOpacityButton.removeEventListener('click', onVelocityOpacity);
      velocityFlowButton.removeEventListener('click', onVelocityFlow);
      velocityMaximumRange.removeEventListener('input', onVelocityMaximumRange);
      velocityMaximumNumber.removeEventListener('change', onVelocityMaximumNumber);
      pressureCurveEditor?.dispose();
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """      tiltCurveEditor?.dispose();
      tiltCurveEditor = null;
      tipShape.removeEventListener('change', onTipShape);
""",
    """      tiltCurveEditor?.dispose();
      tiltCurveEditor = null;
      velocityCurveEditor?.dispose();
      velocityCurveEditor = null;
      tipShape.removeEventListener('change', onTipShape);
""",
)

# Reachable compact velocity controls reuse the established Shared Curve Editor grammar.
replace_once(
    'src/index.html',
    """              <div class=\"shell-brush-property-row shell-brush-tip-property-row\">
                <label for=\"brush-tip-shape\">ブラシ形状</label>
""",
    """              <div class=\"shell-brush-property-row shell-brush-tip-property-row\">
                <label for=\"brush-velocity-size\">速度→サイズ</label>
                <button id=\"brush-velocity-size\" type=\"button\" aria-pressed=\"false\" title=\"描画速度をブラシサイズへ反映\">OFF</button>
                <span class=\"shell-brush-tip-kind\">Velocity</span>
              </div>
              <div class=\"shell-brush-property-row shell-brush-tip-property-row\">
                <label for=\"brush-velocity-opacity\">速度→不透明度</label>
                <button id=\"brush-velocity-opacity\" type=\"button\" aria-pressed=\"false\" title=\"描画速度をストローク不透明度上限へ反映\">OFF</button>
                <span class=\"shell-brush-tip-kind\">Velocity</span>
              </div>
              <div class=\"shell-brush-property-row shell-brush-tip-property-row\">
                <label for=\"brush-velocity-flow\">速度→流量</label>
                <button id=\"brush-velocity-flow\" type=\"button\" aria-pressed=\"false\" title=\"描画速度をブラシ流量へ反映\">OFF</button>
                <span class=\"shell-brush-tip-kind\">Velocity</span>
              </div>
              <div class=\"shell-brush-property-row\">
                <label for=\"brush-velocity-maximum-range\">速度100%</label>
                <input id=\"brush-velocity-maximum-range\" type=\"range\" min=\"100\" max=\"20000\" step=\"100\" value=\"2000\" />
                <span class=\"shell-brush-property-number\"><input id=\"brush-velocity-maximum-number\" type=\"number\" inputmode=\"numeric\" min=\"100\" max=\"20000\" step=\"100\" value=\"2000\" aria-label=\"速度レスポンス100パーセント基準\" /><span>px/s</span></span>
              </div>
              <div class=\"shell-brush-pressure-curve-editor shell-brush-velocity-curve-editor\" aria-label=\"速度レスポンスカーブ\">
                <div class=\"shell-brush-pressure-curve-header\">
                  <label for=\"brush-velocity-curve-preset\">速度カーブ</label>
                  <select id=\"brush-velocity-curve-preset\" aria-label=\"速度カーブプリセット\">
                    <option value=\"linear\">Linear</option>
                    <option value=\"soft\">Soft</option>
                    <option value=\"hard\">Hard</option>
                    <option value=\"s-curve\">S Curve</option>
                    <option value=\"custom\">Custom</option>
                  </select>
                </div>
                <canvas id=\"brush-velocity-curve\" width=\"240\" height=\"128\" tabindex=\"0\" aria-label=\"描画速度レスポンスカーブ。入力100パーセントは設定した速度基準。空いている場所をタップして点を追加、点をドラッグして編集\"></canvas>
                <div class=\"shell-brush-pressure-curve-values\">
                  <label>入力 <input id=\"brush-velocity-curve-input\" type=\"number\" inputmode=\"decimal\" min=\"0\" max=\"100\" step=\"0.1\" value=\"0\" /><span>%</span></label>
                  <label>出力 <input id=\"brush-velocity-curve-output\" type=\"number\" inputmode=\"decimal\" min=\"0\" max=\"100\" step=\"0.1\" value=\"0\" /><span>%</span></label>
                  <button id=\"brush-velocity-curve-delete\" type=\"button\">点を削除</button>
                  <button id=\"brush-velocity-curve-reset\" type=\"button\">Reset</button>
                </div>
              </div>
              <div class=\"shell-brush-property-row shell-brush-tip-property-row\">
                <label for=\"brush-tip-shape\">ブラシ形状</label>
""",
)

# Regression test covers preset state, timestamp normalization, interpolation and pressure/tilt composition.
Path('tests/unit/brush-velocity-mapping.test.ts').write_text("""import { describe, expect, it } from 'vitest';
import {
  brushVelocityFlowEnabledV1,
  brushVelocityMaximumPxPerSecondV1,
  brushVelocityOpacityEnabledV1,
  brushVelocityResponseCurveV1,
  brushVelocitySizeEnabledV1,
  createBaselineBrushPresetV1,
  withBrushVelocityFlowEnabledV1,
  withBrushVelocityMaximumPxPerSecondV1,
  withBrushVelocityOpacityEnabledV1,
  withBrushVelocityResponseCurveV1,
  withBrushVelocitySizeEnabledV1,
} from '../../src/domain/brush-schema.js';
import { LINEAR_RESPONSE_CURVE_V1 } from '../../src/domain/response-curve.js';
import { BaselineBrushDabBuilderV1 } from '../../src/gpu/baseline-brush.js';
import { CanonicalRasterBrushStrokeV1 } from '../../src/app/canonical-raster-brush.js';
import {
  normalizedPaintVelocityV1,
  PaintSessionControllerV1,
} from '../../src/app/paint-session-controller.js';

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
  Object.freeze({ input: 0.5, output: 0.75 }),
  Object.freeze({ input: 1, output: 1 }),
]);

describe('M6A-047 velocity mapping', () => {
  it('keeps velocity mappings opt-in with a deterministic 2000 document px/s default', () => {
    const preset = createBaselineBrushPresetV1({
      id: 'velocity.mapping',
      name: 'Velocity Mapping',
      category: 'Test',
      behavior: 'paint',
    });
    expect(brushVelocitySizeEnabledV1(preset)).toBe(false);
    expect(brushVelocityOpacityEnabledV1(preset)).toBe(false);
    expect(brushVelocityFlowEnabledV1(preset)).toBe(false);
    expect(brushVelocityResponseCurveV1(preset)).toEqual(LINEAR_RESPONSE_CURVE_V1);
    expect(brushVelocityMaximumPxPerSecondV1(preset)).toBe(2000);
    expect(brushVelocitySizeEnabledV1(withBrushVelocitySizeEnabledV1(preset, true))).toBe(true);
    expect(brushVelocityOpacityEnabledV1(withBrushVelocityOpacityEnabledV1(preset, true))).toBe(true);
    expect(brushVelocityFlowEnabledV1(withBrushVelocityFlowEnabledV1(preset, true))).toBe(true);
    expect(brushVelocityResponseCurveV1(withBrushVelocityResponseCurveV1(preset, CUSTOM_CURVE))).toEqual(
      CUSTOM_CURVE,
    );
    expect(brushVelocityMaximumPxPerSecondV1(withBrushVelocityMaximumPxPerSecondV1(preset, 4000))).toBe(4000);
  });

  it('derives document-space velocity only from confirmed sample distance and timestamps', () => {
    const first = { documentX: 0, documentY: 0, timestampMs: 100 };
    const second = { documentX: 10, documentY: 0, timestampMs: 110 };
    expect(normalizedPaintVelocityV1(null, first, 0, 2000)).toBe(0);
    expect(normalizedPaintVelocityV1(first, second, 0, 2000)).toBeCloseTo(0.5, 10);
    const duplicateTime = { documentX: 30, documentY: 0, timestampMs: 110 };
    expect(normalizedPaintVelocityV1(second, duplicateTime, 0.5, 2000)).toBe(0.5);
  });

  it('interpolates velocity at logical stamp positions before applying one shared response', () => {
    const builder = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      opacity: 0.8,
      flow: 0.6,
      spacingRatio: 0.25,
      minimumStampDistancePx: 1,
      velocitySizeEnabled: true,
      velocityOpacityEnabled: true,
      velocityFlowEnabled: true,
    });
    builder.beginDelta({ documentX: 0, documentY: 0, velocity: 0.25 });
    builder.appendDelta([{ documentX: 10, documentY: 0, velocity: 0.75 }]);
    const dabs = builder.dabs();
    expect(dabs.map((dab) => dab.x)).toEqual([0, 5, 10]);
    expect(dabs[0]?.radius).toBeCloseTo(2.5, 10);
    expect(dabs[1]?.radius).toBeCloseTo(5, 10);
    expect(dabs[2]?.radius).toBeCloseTo(7.5, 10);
    expect(dabs[1]?.strokeOpacity).toBeCloseTo(0.4, 10);
    expect(dabs[1]?.flow).toBeCloseTo(0.3, 10);
  });

  it('keeps velocity independent from pressure and tilt while resolving the same primitive fields', () => {
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
    });
    const [dab] = builder.beginDelta({
      documentX: 1,
      documentY: 1,
      pressure: 0.5,
      velocity: 0.5,
      altitudeAngle: Math.PI / 4,
    });
    expect(dab?.radius).toBeCloseTo(1.25, 10);
    expect(dab?.strokeOpacity).toBeCloseTo(0.1, 10);
    expect(dab?.flow).toBeCloseTo(0.075, 10);
  });

  it('forwards velocity through canonical and runtime state without adding a new dab field', () => {
    const stroke = new CanonicalRasterBrushStrokeV1({ sizePx: 20, velocitySizeEnabled: true });
    const [dab] = stroke.beginConfirmed({ documentX: 1, documentY: 1, velocity: 0.5 });
    expect(dab?.radius).toBe(5);
    expect('velocity' in (dab ?? {})).toBe(false);

    const session = new PaintSessionControllerV1(new FakeRendererDocumentPort());
    expect(session.setBrushVelocitySizeEnabled(true)).toBe(true);
    expect(session.setBrushVelocityOpacityEnabled(true)).toBe(true);
    expect(session.setBrushVelocityFlowEnabled(true)).toBe(true);
    expect(session.setBrushVelocityResponseCurve(CUSTOM_CURVE)).toEqual(CUSTOM_CURVE);
    expect(session.setBrushVelocityMaximumPxPerSecond(4000)).toBe(4000);
    const snapshot = session.snapshot();
    expect(snapshot.brushVelocitySizeEnabled).toBe(true);
    expect(snapshot.brushVelocityOpacityEnabled).toBe(true);
    expect(snapshot.brushVelocityFlowEnabled).toBe(true);
    expect(snapshot.brushVelocityResponseCurve).toEqual(CUSTOM_CURVE);
    expect(snapshot.brushVelocityMaximumPxPerSecond).toBe(4000);
  });
});
""")

# Verifier gate for the production path.
replace_once(
    'scripts/verify-m6a-brush.mjs',
    """requireText(
  progress,
  'M6A-PERF-001 incremental active-stroke rendering（stable prefix + bounded mutable tail）:未完了',
""",
    """requireText(progress, 'M6A-047 velocity mapping:完了', 'M6A-047 progress is not complete');
requireText(
  read('src/domain/brush-schema.ts'),
  'brushVelocityMaximumPxPerSecondV1',
  'velocity normalization maximum preset helper missing',
);
requireText(
  read('src/app/paint-session-controller.ts'),
  'normalizedPaintVelocityV1',
  'confirmed timestamp velocity resolver missing',
);
requireText(
  read('src/gpu/baseline-brush.ts'),
  'cursorVelocity += (velocity - cursorVelocity) * ratio',
  'velocity is not interpolated at logical stamp positions',
);
requireText(
  read('src/gpu/baseline-brush.ts'),
  'this.#velocityResponseCurve.sample(stamp.velocity)',
  'shared velocity response is not resolved before independent mappings',
);
requireText(
  read('src/app/paint-session-controller.ts'),
  'setBrushVelocityResponseCurve',
  'velocity mapping is not connected to runtime state',
);
requireText(read('src/index.html'), 'id=\"brush-velocity-size\"', 'reachable velocity-size control missing');
requireText(
  read('src/index.html'),
  'id=\"brush-velocity-maximum-range\"',
  'reachable velocity normalization control missing',
);
requireText(read('src/index.html'), 'id=\"brush-velocity-curve\"', 'reachable velocity Curve Editor missing');
requireText(
  read('tests/unit/brush-velocity-mapping.test.ts'),
  'derives document-space velocity only from confirmed sample distance and timestamps',
  'velocity source regression coverage missing',
);
requireText(
  read('tests/unit/brush-velocity-mapping.test.ts'),
  'keeps velocity independent from pressure and tilt while resolving the same primitive fields',
  'velocity composition regression coverage missing',
);

requireText(
  progress,
  'M6A-PERF-001 incremental active-stroke rendering（stable prefix + bounded mutable tail）:未完了',
""",
)

# Canonical progress and restart note.
replace_once(
    'IMPLEMENTATION_PROGRESS.md',
    """M6A-047 velocity mapping:未完了
M6A-048 random dynamics:未完了
""",
    """M6A-047 velocity mapping:完了
再開メモ: M6A-047 velocity mappingはraw confirmed PaintStrokeSampleV1のdocument-space距離とtimestampMs差から速度を算出し、既定2000 document px/s（設定可能100..20000）をnormalized 1.0として0..1へclampする。初回sampleは0、timestampが同一または逆行するsampleは直前normalized速度を保持して無限大spikeを作らない。velocity値はstabilization前のraw入力を正本とし、stabilized geometry上のlogical stamp位置へ線形補間するためFPSや手ブレ補正強度に依存しない。dynamics.velocitySizeEnabled / velocityOpacityEnabled / velocityFlowEnabledは既定false、velocityResponseCurveはShared Curve Editorのlinear既定で、pressure/tiltと独立にsize / strokeOpacity cap / flowへ乗算する。post-stroke correction時もraw samplesから同じ速度列を決定的に再生成する。primitive dabには解決済みradius/strokeOpacity/flowだけを保存しvelocity専用renderer/history fieldは追加しない。次はM6A-048 random dynamicsから再開する。
M6A-048 random dynamics:未完了
""",
)

append_once(
    'ILLUSTRO_DESIGN_MEMO.md',
    '#### M6A velocity-mapping boundary — 2026-09-03',
    """
#### M6A velocity-mapping boundary — 2026-09-03

- M6A-047 defines brush velocity from **raw confirmed document-space samples**, not display-frame timing and not the already-stabilized path. Consecutive `PaintStrokeSampleV1` positions and `timestampMs` determine speed, so a given confirmed input stream remains deterministic across presentation FPS and stabilization settings.
- The preset normalization reference is `dynamics.velocityMaximumPxPerSecond`, default `2000` document px/s and constrained to `100..20000`. Speed is clamped to normalized `0..1`. The first sample resolves to `0`; non-increasing timestamps retain the prior normalized value rather than producing an unbounded spike.
- `dynamics.velocitySizeEnabled`, `velocityOpacityEnabled`, and `velocityFlowEnabled` are independent opt-in mappings and default to `false`. `velocityResponseCurve` reuses the IP-12 Shared Curve Editor and defaults to exact linear identity.
- Normalized velocity is attached only to the transient canonical brush sample and linearly interpolated at logical-stamp positions. It composes multiplicatively and independently with pressure and tilt responses. It may reduce size, the per-dab stroke-opacity cap, and/or flow, but it cannot raise an M6A-032 forced zero taper endpoint above zero.
- Post-stroke correction recomputes the same velocity series from canonical raw samples before rebuilding final dabs. Primitive dabs persist only the already-resolved `radius`, `strokeOpacity`, and `flow`; no velocity-specific renderer, Worker, history, or recovery field is added.
- M6A-049/M6A-050 own later minimum/maximum-response remapping. M6A-047 intentionally does not pre-implement those clamps.
""",
)

print('M6A-047 patch applied')
