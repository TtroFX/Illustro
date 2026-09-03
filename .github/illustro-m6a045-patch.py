from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise RuntimeError(f"anchor not found in {path}: {old[:120]!r}")
    p.write_text(text.replace(old, new, 1))


def append_once(path: str, text: str) -> None:
    p = Path(path)
    current = p.read_text()
    if text in current:
        return
    p.write_text(current + text)


# ---------------- brush schema ----------------
replace_once(
    "src/domain/brush-schema.ts",
    "export type BrushTipSelectionModeV1 = 'fixed' | 'sequence' | 'random-per-stamp';",
    """export const DEFAULT_BRUSH_TILT_SIZE_ENABLED_V1 = false as const;

export function brushTiltSizeEnabledV1(preset: BrushPresetV1): boolean {
  const value = preset.dynamics.tiltSizeEnabled;
  return typeof value === 'boolean' ? value : DEFAULT_BRUSH_TILT_SIZE_ENABLED_V1;
}

export function withBrushTiltSizeEnabledV1(
  preset: BrushPresetV1,
  enabled: boolean,
): BrushPresetV1 {
  if (typeof enabled !== 'boolean') throw new TypeError('brush tilt size flag must be boolean');
  if (enabled === DEFAULT_BRUSH_TILT_SIZE_ENABLED_V1) {
    const { tiltSizeEnabled: _tiltSizeEnabled, ...dynamics } = preset.dynamics;
    return normalizeBrushPresetV1({ ...preset, dynamics });
  }
  return normalizeBrushPresetV1({
    ...preset,
    dynamics: { ...preset.dynamics, tiltSizeEnabled: enabled },
  });
}

export const DEFAULT_BRUSH_TILT_OPACITY_ENABLED_V1 = false as const;

export function brushTiltOpacityEnabledV1(preset: BrushPresetV1): boolean {
  const value = preset.dynamics.tiltOpacityEnabled;
  return typeof value === 'boolean' ? value : DEFAULT_BRUSH_TILT_OPACITY_ENABLED_V1;
}

export function withBrushTiltOpacityEnabledV1(
  preset: BrushPresetV1,
  enabled: boolean,
): BrushPresetV1 {
  if (typeof enabled !== 'boolean') throw new TypeError('brush tilt opacity flag must be boolean');
  if (enabled === DEFAULT_BRUSH_TILT_OPACITY_ENABLED_V1) {
    const { tiltOpacityEnabled: _tiltOpacityEnabled, ...dynamics } = preset.dynamics;
    return normalizeBrushPresetV1({ ...preset, dynamics });
  }
  return normalizeBrushPresetV1({
    ...preset,
    dynamics: { ...preset.dynamics, tiltOpacityEnabled: enabled },
  });
}

export const DEFAULT_BRUSH_TILT_FLOW_ENABLED_V1 = false as const;

export function brushTiltFlowEnabledV1(preset: BrushPresetV1): boolean {
  const value = preset.dynamics.tiltFlowEnabled;
  return typeof value === 'boolean' ? value : DEFAULT_BRUSH_TILT_FLOW_ENABLED_V1;
}

export function withBrushTiltFlowEnabledV1(
  preset: BrushPresetV1,
  enabled: boolean,
): BrushPresetV1 {
  if (typeof enabled !== 'boolean') throw new TypeError('brush tilt flow flag must be boolean');
  if (enabled === DEFAULT_BRUSH_TILT_FLOW_ENABLED_V1) {
    const { tiltFlowEnabled: _tiltFlowEnabled, ...dynamics } = preset.dynamics;
    return normalizeBrushPresetV1({ ...preset, dynamics });
  }
  return normalizeBrushPresetV1({
    ...preset,
    dynamics: { ...preset.dynamics, tiltFlowEnabled: enabled },
  });
}

export function brushTiltResponseCurveV1(preset: BrushPresetV1): readonly ResponseCurvePointV1[] {
  const value = preset.dynamics.tiltResponseCurve;
  if (value === undefined) return LINEAR_RESPONSE_CURVE_V1;
  try {
    return normalizeResponseCurveV1(value);
  } catch {
    return LINEAR_RESPONSE_CURVE_V1;
  }
}

export function withBrushTiltResponseCurveV1(
  preset: BrushPresetV1,
  curve: readonly ResponseCurvePointV1[],
): BrushPresetV1 {
  const normalized = normalizeResponseCurveV1(curve);
  if (responseCurveIsLinearV1(normalized)) {
    const { tiltResponseCurve: _tiltResponseCurve, ...dynamics } = preset.dynamics;
    return normalizeBrushPresetV1({ ...preset, dynamics });
  }
  const stored = toJsonValue(
    normalized.map((pointValue) => ({ input: pointValue.input, output: pointValue.output })),
  );
  return normalizeBrushPresetV1({
    ...preset,
    dynamics: { ...preset.dynamics, tiltResponseCurve: stored },
  });
}

export type BrushTipSelectionModeV1 = 'fixed' | 'sequence' | 'random-per-stamp';""",
)

# ---------------- preset library ----------------
replace_once(
    "src/app/brush-preset-library.ts",
    "  withBrushPressureResponseCurveV1,\n",
    """  withBrushPressureResponseCurveV1,
  withBrushTiltSizeEnabledV1,
  withBrushTiltOpacityEnabledV1,
  withBrushTiltFlowEnabledV1,
  withBrushTiltResponseCurveV1,
""",
)
replace_once(
    "src/app/brush-preset-library.ts",
    "export function updateBrushPresetCustomTipV1(\n",
    """export function updateBrushPresetTiltSizeV1(
  state: BrushPresetLibraryStateV1,
  presetId: string,
  enabled: boolean,
): BrushPresetLibraryStateV1 {
  return updateItemV1(state, presetId, (item) => {
    if (item.locked) throw new Error('locked brush preset cannot be edited');
    const current = withBrushTiltSizeEnabledV1(item.preset, enabled);
    if (JSON.stringify(current) === JSON.stringify(item.preset)) return item;
    const next = normalizeBrushPresetV1({ ...current, revision: item.preset.revision + 1 });
    return itemV1({ source: item.source, baseline: item.baseline, preset: next, locked: item.locked });
  });
}

export function updateBrushPresetTiltOpacityV1(
  state: BrushPresetLibraryStateV1,
  presetId: string,
  enabled: boolean,
): BrushPresetLibraryStateV1 {
  return updateItemV1(state, presetId, (item) => {
    if (item.locked) throw new Error('locked brush preset cannot be edited');
    const current = withBrushTiltOpacityEnabledV1(item.preset, enabled);
    if (JSON.stringify(current) === JSON.stringify(item.preset)) return item;
    const next = normalizeBrushPresetV1({ ...current, revision: item.preset.revision + 1 });
    return itemV1({ source: item.source, baseline: item.baseline, preset: next, locked: item.locked });
  });
}

export function updateBrushPresetTiltFlowV1(
  state: BrushPresetLibraryStateV1,
  presetId: string,
  enabled: boolean,
): BrushPresetLibraryStateV1 {
  return updateItemV1(state, presetId, (item) => {
    if (item.locked) throw new Error('locked brush preset cannot be edited');
    const current = withBrushTiltFlowEnabledV1(item.preset, enabled);
    if (JSON.stringify(current) === JSON.stringify(item.preset)) return item;
    const next = normalizeBrushPresetV1({ ...current, revision: item.preset.revision + 1 });
    return itemV1({ source: item.source, baseline: item.baseline, preset: next, locked: item.locked });
  });
}

export function updateBrushPresetTiltResponseCurveV1(
  state: BrushPresetLibraryStateV1,
  presetId: string,
  curve: readonly ResponseCurvePointV1[],
): BrushPresetLibraryStateV1 {
  return updateItemV1(state, presetId, (item) => {
    if (item.locked) throw new Error('locked brush preset cannot be edited');
    const current = withBrushTiltResponseCurveV1(item.preset, curve);
    if (JSON.stringify(current) === JSON.stringify(item.preset)) return item;
    const next = normalizeBrushPresetV1({ ...current, revision: item.preset.revision + 1 });
    return itemV1({ source: item.source, baseline: item.baseline, preset: next, locked: item.locked });
  });
}

export function updateBrushPresetCustomTipV1(
""",
)

# ---------------- baseline brush source ----------------
replace_once(
    "src/gpu/baseline-brush.ts",
    """export interface BaselineBrushSampleV1 {
  readonly documentX: number;
  readonly documentY: number;
  readonly pressure?: number;
}

export function baselineBrushSamplePressureV1(sample: BaselineBrushSampleV1): number {
""",
    """export interface BaselineBrushSampleV1 {
  readonly documentX: number;
  readonly documentY: number;
  readonly pressure?: number;
  readonly tiltX?: number;
  readonly tiltY?: number;
  readonly altitudeAngle?: number | null;
}

export function baselineBrushSamplePressureV1(sample: BaselineBrushSampleV1): number {
""",
)
replace_once(
    "src/gpu/baseline-brush.ts",
    """export function baselineBrushSamplePressureV1(sample: BaselineBrushSampleV1): number {
  const pressure = sample.pressure ?? 1;
  if (!Number.isFinite(pressure) || pressure < 0 || pressure > 1) {
    throw new RangeError('baseline brush pressure must be within 0..1');
  }
  return pressure;
}

export interface BaselineBrushDabV1 {
""",
    """export function baselineBrushSamplePressureV1(sample: BaselineBrushSampleV1): number {
  const pressure = sample.pressure ?? 1;
  if (!Number.isFinite(pressure) || pressure < 0 || pressure > 1) {
    throw new RangeError('baseline brush pressure must be within 0..1');
  }
  return pressure;
}

/**
 * Canonical tilt scalar for M6A dynamics: 1 means perpendicular/upright and 0 means parallel.
 * This makes zero/unsupported tilt data neutral by default while still allowing physical tilt to
 * attenuate mapped parameters. altitudeAngle is preferred when available; Pointer Events tiltX/Y
 * are converted to the same altitude-domain fallback otherwise.
 */
export function baselineBrushSampleTiltUprightnessV1(sample: BaselineBrushSampleV1): number {
  const altitude = sample.altitudeAngle;
  if (altitude !== undefined && altitude !== null) {
    if (!Number.isFinite(altitude) || altitude < 0 || altitude > Math.PI / 2) {
      throw new RangeError('baseline brush altitude angle must be within 0..pi/2');
    }
    return Math.max(0, Math.min(1, altitude / (Math.PI / 2)));
  }
  const tiltX = sample.tiltX ?? 0;
  const tiltY = sample.tiltY ?? 0;
  if (!Number.isFinite(tiltX) || tiltX < -90 || tiltX > 90) {
    throw new RangeError('baseline brush tiltX must be within -90..90');
  }
  if (!Number.isFinite(tiltY) || tiltY < -90 || tiltY > 90) {
    throw new RangeError('baseline brush tiltY must be within -90..90');
  }
  const tangentX = Math.tan((tiltX * Math.PI) / 180);
  const tangentY = Math.tan((tiltY * Math.PI) / 180);
  const altitudeFromTilt = Math.atan2(1, Math.hypot(tangentX, tangentY));
  return Math.max(0, Math.min(1, altitudeFromTilt / (Math.PI / 2)));
}

export interface BaselineBrushDabV1 {
""",
)
replace_once(
    "src/gpu/baseline-brush.ts",
    """  baselineBrushSamplePressureV1(sample);
}
""",
    """  baselineBrushSamplePressureV1(sample);
  baselineBrushSampleTiltUprightnessV1(sample);
}
""",
)
replace_once(
    "src/gpu/baseline-brush.ts",
    """interface BaselineLogicalStampRecordV1 {
  readonly x: number;
  readonly y: number;
  readonly pressure: number;
  readonly tipAngleDegrees: number;
""",
    """interface BaselineLogicalStampRecordV1 {
  readonly x: number;
  readonly y: number;
  readonly pressure: number;
  readonly tiltUprightness: number;
  readonly tipAngleDegrees: number;
""",
)
replace_once(
    "src/gpu/baseline-brush.ts",
    """  readonly #pressureFlowEnabled: boolean;
  readonly #pressureResponseCurve: CompiledResponseCurveV1;
  readonly #flow: number;
""",
    """  readonly #pressureFlowEnabled: boolean;
  readonly #pressureResponseCurve: CompiledResponseCurveV1;
  readonly #tiltSizeEnabled: boolean;
  readonly #tiltOpacityEnabled: boolean;
  readonly #tiltFlowEnabled: boolean;
  readonly #tiltResponseCurve: CompiledResponseCurveV1;
  readonly #flow: number;
""",
)
replace_once(
    "src/gpu/baseline-brush.ts",
    """  #lastPoint: { x: number; y: number; pressure: number } | null = null;
""",
    """  #lastPoint: { x: number; y: number; pressure: number; tiltUprightness: number } | null = null;
""",
)
replace_once(
    "src/gpu/baseline-brush.ts",
    """      readonly pressureFlowEnabled?: boolean;
      readonly pressureResponseCurve?: readonly ResponseCurvePointV1[];
      readonly hardness?: number;
""",
    """      readonly pressureFlowEnabled?: boolean;
      readonly pressureResponseCurve?: readonly ResponseCurvePointV1[];
      readonly tiltSizeEnabled?: boolean;
      readonly tiltOpacityEnabled?: boolean;
      readonly tiltFlowEnabled?: boolean;
      readonly tiltResponseCurve?: readonly ResponseCurvePointV1[];
      readonly hardness?: number;
""",
)
replace_once(
    "src/gpu/baseline-brush.ts",
    """    const pressureFlowEnabled = options.pressureFlowEnabled ?? false;
    const hardness = options.hardness ?? BASELINE_BRUSH_HARDNESS;
""",
    """    const pressureFlowEnabled = options.pressureFlowEnabled ?? false;
    const tiltSizeEnabled = options.tiltSizeEnabled ?? false;
    const tiltOpacityEnabled = options.tiltOpacityEnabled ?? false;
    const tiltFlowEnabled = options.tiltFlowEnabled ?? false;
    const hardness = options.hardness ?? BASELINE_BRUSH_HARDNESS;
""",
)
replace_once(
    "src/gpu/baseline-brush.ts",
    """    if (typeof pressureFlowEnabled !== 'boolean') {
      throw new TypeError('baseline brush pressure flow flag must be boolean');
    }
    if (!Number.isFinite(hardness) || hardness < 0 || hardness > 1) {
""",
    """    if (typeof pressureFlowEnabled !== 'boolean') {
      throw new TypeError('baseline brush pressure flow flag must be boolean');
    }
    if (
      typeof tiltSizeEnabled !== 'boolean' ||
      typeof tiltOpacityEnabled !== 'boolean' ||
      typeof tiltFlowEnabled !== 'boolean'
    ) {
      throw new TypeError('baseline brush tilt mapping flags must be boolean');
    }
    if (!Number.isFinite(hardness) || hardness < 0 || hardness > 1) {
""",
)
replace_once(
    "src/gpu/baseline-brush.ts",
    """    this.#pressureResponseCurve = compileResponseCurveV1(
      options.pressureResponseCurve ?? [
        { input: 0, output: 0 },
        { input: 1, output: 1 },
      ],
    );
    this.#flow = flow;
""",
    """    this.#pressureResponseCurve = compileResponseCurveV1(
      options.pressureResponseCurve ?? [
        { input: 0, output: 0 },
        { input: 1, output: 1 },
      ],
    );
    this.#tiltSizeEnabled = tiltSizeEnabled;
    this.#tiltOpacityEnabled = tiltOpacityEnabled;
    this.#tiltFlowEnabled = tiltFlowEnabled;
    this.#tiltResponseCurve = compileResponseCurveV1(
      options.tiltResponseCurve ?? [
        { input: 0, output: 0 },
        { input: 1, output: 1 },
      ],
    );
    this.#flow = flow;
""",
)
replace_once(
    "src/gpu/baseline-brush.ts",
    """    const pressure = baselineBrushSamplePressureV1(sample);
    this.#lastPoint = { x: sample.documentX, y: sample.documentY, pressure };
    this.#pushLogicalStamp(
      sample.documentX,
      sample.documentY,
      pressure,
      this.#resolvedTipAngleDegrees(),
      0,
    );
""",
    """    const pressure = baselineBrushSamplePressureV1(sample);
    const tiltUprightness = baselineBrushSampleTiltUprightnessV1(sample);
    this.#lastPoint = { x: sample.documentX, y: sample.documentY, pressure, tiltUprightness };
    this.#pushLogicalStamp(
      sample.documentX,
      sample.documentY,
      pressure,
      tiltUprightness,
      this.#resolvedTipAngleDegrees(),
      0,
    );
""",
)
replace_once(
    "src/gpu/baseline-brush.ts",
    """        this.#appendPoint(
          sample.documentX,
          sample.documentY,
          baselineBrushSamplePressureV1(sample),
        );
""",
    """        this.#appendPoint(
          sample.documentX,
          sample.documentY,
          baselineBrushSamplePressureV1(sample),
          baselineBrushSampleTiltUprightnessV1(sample),
        );
""",
)
replace_once(
    "src/gpu/baseline-brush.ts",
    """      this.#appendPoint(sample.documentX, sample.documentY, baselineBrushSamplePressureV1(sample));
""",
    """      this.#appendPoint(
        sample.documentX,
        sample.documentY,
        baselineBrushSamplePressureV1(sample),
        baselineBrushSampleTiltUprightnessV1(sample),
      );
""",
)
replace_once(
    "src/gpu/baseline-brush.ts",
    """          lastPoint.pressure,
          this.#resolvedTipAngleDegrees(this.#lastStrokeDirectionDegrees ?? undefined),
""",
    """          lastPoint.pressure,
          lastPoint.tiltUprightness,
          this.#resolvedTipAngleDegrees(this.#lastStrokeDirectionDegrees ?? undefined),
""",
)
replace_once(
    "src/gpu/baseline-brush.ts",
    """      'x' | 'y' | 'pressure' | 'tipAngleDegrees' | 'sampledTipAlpha'
""",
    """      'x' | 'y' | 'pressure' | 'tiltUprightness' | 'tipAngleDegrees' | 'sampledTipAlpha'
""",
)
replace_once(
    "src/gpu/baseline-brush.ts",
    """    const pressureFlowScale = this.#pressureFlowEnabled ? pressureResponse : 1;
    if (
      sizeScale <= 0 ||
      opacityScale <= 0 ||
      pressureSizeScale <= 0 ||
      pressureOpacityScale <= 0 ||
      pressureFlowScale <= 0
    ) {
      return;
    }
    pushBaselineBrushStampV1(
      target,
      stamp.x,
      stamp.y,
      this.#radius * sizeScale * pressureSizeScale,
      this.#flow * opacityScale * pressureFlowScale,
      this.#strokeOpacity * pressureOpacityScale,
""",
    """    const pressureFlowScale = this.#pressureFlowEnabled ? pressureResponse : 1;
    const usesTilt = this.#tiltSizeEnabled || this.#tiltOpacityEnabled || this.#tiltFlowEnabled;
    const tiltResponse = usesTilt
      ? this.#tiltResponseCurve.sample(stamp.tiltUprightness)
      : 1;
    const tiltSizeScale = this.#tiltSizeEnabled ? tiltResponse : 1;
    const tiltOpacityScale = this.#tiltOpacityEnabled ? tiltResponse : 1;
    const tiltFlowScale = this.#tiltFlowEnabled ? tiltResponse : 1;
    if (
      sizeScale <= 0 ||
      opacityScale <= 0 ||
      pressureSizeScale <= 0 ||
      pressureOpacityScale <= 0 ||
      pressureFlowScale <= 0 ||
      tiltSizeScale <= 0 ||
      tiltOpacityScale <= 0 ||
      tiltFlowScale <= 0
    ) {
      return;
    }
    pushBaselineBrushStampV1(
      target,
      stamp.x,
      stamp.y,
      this.#radius * sizeScale * pressureSizeScale * tiltSizeScale,
      this.#flow * opacityScale * pressureFlowScale * tiltFlowScale,
      this.#strokeOpacity * pressureOpacityScale * tiltOpacityScale,
""",
)
replace_once(
    "src/gpu/baseline-brush.ts",
    """  #pushLogicalStamp(
    x: number,
    y: number,
    pressure: number,
    tipAngleDegrees: number,
""",
    """  #pushLogicalStamp(
    x: number,
    y: number,
    pressure: number,
    tiltUprightness: number,
    tipAngleDegrees: number,
""",
)
replace_once(
    "src/gpu/baseline-brush.ts",
    """      x,
      y,
      pressure,
      tipAngleDegrees,
""",
    """      x,
      y,
      pressure,
      tiltUprightness,
      tipAngleDegrees,
""",
)
replace_once(
    "src/gpu/baseline-brush.ts",
    """  #appendPoint(x: number, y: number, pressure: number): void {
""",
    """  #appendPoint(x: number, y: number, pressure: number, tiltUprightness: number): void {
""",
)
replace_once(
    "src/gpu/baseline-brush.ts",
    """    let cursorPressure = lastPoint.pressure;
    const segmentLength = Math.hypot(x - cursorX, y - cursorY);
""",
    """    let cursorPressure = lastPoint.pressure;
    let cursorTiltUprightness = lastPoint.tiltUprightness;
    const segmentLength = Math.hypot(x - cursorX, y - cursorY);
""",
)
replace_once(
    "src/gpu/baseline-brush.ts",
    """      cursorPressure += (pressure - cursorPressure) * ratio;
      segmentAdvancedPx += stepDistancePx;
      this.#pushLogicalStamp(
        cursorX,
        cursorY,
        cursorPressure,
        this.#resolvedTipAngleDegrees(this.#lastStrokeDirectionDegrees ?? undefined),
""",
    """      cursorPressure += (pressure - cursorPressure) * ratio;
      cursorTiltUprightness += (tiltUprightness - cursorTiltUprightness) * ratio;
      segmentAdvancedPx += stepDistancePx;
      this.#pushLogicalStamp(
        cursorX,
        cursorY,
        cursorPressure,
        cursorTiltUprightness,
        this.#resolvedTipAngleDegrees(this.#lastStrokeDirectionDegrees ?? undefined),
""",
)
replace_once(
    "src/gpu/baseline-brush.ts",
    """    this.#lastPoint = { x, y, pressure };
""",
    """    this.#lastPoint = { x, y, pressure, tiltUprightness };
""",
)

# ---------------- canonical facade ----------------
replace_once(
    "src/app/canonical-raster-brush.ts",
    """export interface CanonicalRasterBrushSampleV1 {
  readonly documentX: number;
  readonly documentY: number;
  readonly pressure?: number;
}
""",
    """export interface CanonicalRasterBrushSampleV1 {
  readonly documentX: number;
  readonly documentY: number;
  readonly pressure?: number;
  readonly tiltX?: number;
  readonly tiltY?: number;
  readonly altitudeAngle?: number | null;
}
""",
)
replace_once(
    "src/app/canonical-raster-brush.ts",
    """      readonly pressureResponseCurve?: readonly ResponseCurvePointV1[];
      readonly hardness?: number;
""",
    """      readonly pressureResponseCurve?: readonly ResponseCurvePointV1[];
      readonly tiltSizeEnabled?: boolean;
      readonly tiltOpacityEnabled?: boolean;
      readonly tiltFlowEnabled?: boolean;
      readonly tiltResponseCurve?: readonly ResponseCurvePointV1[];
      readonly hardness?: number;
""",
)
replace_once(
    "src/app/canonical-raster-brush.ts",
    """      ...(options.pressureResponseCurve === undefined
        ? {}
        : { pressureResponseCurve: options.pressureResponseCurve }),
      ...(options.hardness === undefined ? {} : { hardness: options.hardness }),
""",
    """      ...(options.pressureResponseCurve === undefined
        ? {}
        : { pressureResponseCurve: options.pressureResponseCurve }),
      ...(options.tiltSizeEnabled === undefined ? {} : { tiltSizeEnabled: options.tiltSizeEnabled }),
      ...(options.tiltOpacityEnabled === undefined
        ? {}
        : { tiltOpacityEnabled: options.tiltOpacityEnabled }),
      ...(options.tiltFlowEnabled === undefined ? {} : { tiltFlowEnabled: options.tiltFlowEnabled }),
      ...(options.tiltResponseCurve === undefined
        ? {}
        : { tiltResponseCurve: options.tiltResponseCurve }),
      ...(options.hardness === undefined ? {} : { hardness: options.hardness }),
""",
)

# ---------------- paint session ----------------
replace_once(
    "src/app/paint-session-controller.ts",
    """  readonly brushPressureResponseCurve: readonly ResponseCurvePointV1[];
  readonly brushTipAngleDegrees: number;
""",
    """  readonly brushPressureResponseCurve: readonly ResponseCurvePointV1[];
  readonly brushTiltSizeEnabled: boolean;
  readonly brushTiltOpacityEnabled: boolean;
  readonly brushTiltFlowEnabled: boolean;
  readonly brushTiltResponseCurve: readonly ResponseCurvePointV1[];
  readonly brushTipAngleDegrees: number;
""",
)
replace_once(
    "src/app/paint-session-controller.ts",
    """  #brushPressureFlowEnabled = false;
  #brushPressureResponseCurve: readonly ResponseCurvePointV1[] = LINEAR_RESPONSE_CURVE_V1;
  #brushTipAngleDegrees: number = BASELINE_BRUSH_TIP_ANGLE_DEGREES;
""",
    """  #brushPressureFlowEnabled = false;
  #brushPressureResponseCurve: readonly ResponseCurvePointV1[] = LINEAR_RESPONSE_CURVE_V1;
  #brushTiltSizeEnabled = false;
  #brushTiltOpacityEnabled = false;
  #brushTiltFlowEnabled = false;
  #brushTiltResponseCurve: readonly ResponseCurvePointV1[] = LINEAR_RESPONSE_CURVE_V1;
  #brushTipAngleDegrees: number = BASELINE_BRUSH_TIP_ANGLE_DEGREES;
""",
)
replace_once(
    "src/app/paint-session-controller.ts",
    """      brushPressureFlowEnabled: this.#brushPressureFlowEnabled,
      brushPressureResponseCurve: this.#brushPressureResponseCurve,
      brushTipAngleDegrees: this.#brushTipAngleDegrees,
""",
    """      brushPressureFlowEnabled: this.#brushPressureFlowEnabled,
      brushPressureResponseCurve: this.#brushPressureResponseCurve,
      brushTiltSizeEnabled: this.#brushTiltSizeEnabled,
      brushTiltOpacityEnabled: this.#brushTiltOpacityEnabled,
      brushTiltFlowEnabled: this.#brushTiltFlowEnabled,
      brushTiltResponseCurve: this.#brushTiltResponseCurve,
      brushTipAngleDegrees: this.#brushTipAngleDegrees,
""",
)
replace_once(
    "src/app/paint-session-controller.ts",
    """  brushPressureResponseCurve(): readonly ResponseCurvePointV1[] {
    return this.#brushPressureResponseCurve;
  }

  setBrushTipAngleDegrees(angleDegrees: number): number {
""",
    """  brushPressureResponseCurve(): readonly ResponseCurvePointV1[] {
    return this.#brushPressureResponseCurve;
  }

  setBrushTiltSizeEnabled(enabled: boolean): boolean {
    if (typeof enabled !== 'boolean') throw new TypeError('invalid runtime tilt-size flag');
    if (enabled !== this.#brushTiltSizeEnabled) this.#clearActiveStroke();
    this.#brushTiltSizeEnabled = enabled;
    return this.#brushTiltSizeEnabled;
  }

  brushTiltSizeEnabled(): boolean {
    return this.#brushTiltSizeEnabled;
  }

  setBrushTiltOpacityEnabled(enabled: boolean): boolean {
    if (typeof enabled !== 'boolean') throw new TypeError('invalid runtime tilt-opacity flag');
    if (enabled !== this.#brushTiltOpacityEnabled) this.#clearActiveStroke();
    this.#brushTiltOpacityEnabled = enabled;
    return this.#brushTiltOpacityEnabled;
  }

  brushTiltOpacityEnabled(): boolean {
    return this.#brushTiltOpacityEnabled;
  }

  setBrushTiltFlowEnabled(enabled: boolean): boolean {
    if (typeof enabled !== 'boolean') throw new TypeError('invalid runtime tilt-flow flag');
    if (enabled !== this.#brushTiltFlowEnabled) this.#clearActiveStroke();
    this.#brushTiltFlowEnabled = enabled;
    return this.#brushTiltFlowEnabled;
  }

  brushTiltFlowEnabled(): boolean {
    return this.#brushTiltFlowEnabled;
  }

  setBrushTiltResponseCurve(
    curve: readonly ResponseCurvePointV1[],
  ): readonly ResponseCurvePointV1[] {
    const normalized = normalizeResponseCurveV1(curve);
    if (!responseCurveEqualsV1(normalized, this.#brushTiltResponseCurve)) this.#clearActiveStroke();
    this.#brushTiltResponseCurve = normalized;
    return this.#brushTiltResponseCurve;
  }

  brushTiltResponseCurve(): readonly ResponseCurvePointV1[] {
    return this.#brushTiltResponseCurve;
  }

  setBrushTipAngleDegrees(angleDegrees: number): number {
""",
)
replace_once(
    "src/app/paint-session-controller.ts",
    """      return Object.freeze({ ...point, pressure: source === 'pen' ? sample.pressure : 1 });
""",
    """      return Object.freeze({
        ...point,
        pressure: source === 'pen' ? sample.pressure : 1,
        tiltX: source === 'pen' ? sample.tiltX : 0,
        tiltY: source === 'pen' ? sample.tiltY : 0,
        altitudeAngle: source === 'pen' ? sample.altitudeAngle : Math.PI / 2,
      });
""",
)
replace_once(
    "src/app/paint-session-controller.ts",
    """        pressureResponseCurve: this.#brushPressureResponseCurve,
        hardness: this.#brushHardness,
""",
    """        pressureResponseCurve: this.#brushPressureResponseCurve,
        tiltSizeEnabled: this.#brushTiltSizeEnabled,
        tiltOpacityEnabled: this.#brushTiltOpacityEnabled,
        tiltFlowEnabled: this.#brushTiltFlowEnabled,
        tiltResponseCurve: this.#brushTiltResponseCurve,
        hardness: this.#brushHardness,
""",
)
replace_once(
    "src/app/paint-session-controller.ts",
    """      return Object.freeze({ ...point, pressure: active.source === 'pen' ? sample.pressure : 1 });
""",
    """      return Object.freeze({
        ...point,
        pressure: active.source === 'pen' ? sample.pressure : 1,
        tiltX: active.source === 'pen' ? sample.tiltX : 0,
        tiltY: active.source === 'pen' ? sample.tiltY : 0,
        altitudeAngle: active.source === 'pen' ? sample.altitudeAngle : Math.PI / 2,
      });
""",
)
replace_once(
    "src/app/paint-session-controller.ts",
    """                pressure: active.source === 'pen' ? rawEndpoint.pressure : 1,
""",
    """                pressure: active.source === 'pen' ? rawEndpoint.pressure : 1,
                tiltX: active.source === 'pen' ? rawEndpoint.tiltX : 0,
                tiltY: active.source === 'pen' ? rawEndpoint.tiltY : 0,
                altitudeAngle:
                  active.source === 'pen' ? rawEndpoint.altitudeAngle : Math.PI / 2,
""",
)
replace_once(
    "src/app/paint-session-controller.ts",
    """              pressure: completed.source === 'pen' ? sample.pressure : 1,
""",
    """              pressure: completed.source === 'pen' ? sample.pressure : 1,
              tiltX: completed.source === 'pen' ? sample.tiltX : 0,
              tiltY: completed.source === 'pen' ? sample.tiltY : 0,
              altitudeAngle: completed.source === 'pen' ? sample.altitudeAngle : Math.PI / 2,
""",
)
replace_once(
    "src/app/paint-session-controller.ts",
    """                  pressure: completed.source === 'pen' ? rawEndpoint.pressure : 1,
""",
    """                  pressure: completed.source === 'pen' ? rawEndpoint.pressure : 1,
                  tiltX: completed.source === 'pen' ? rawEndpoint.tiltX : 0,
                  tiltY: completed.source === 'pen' ? rawEndpoint.tiltY : 0,
                  altitudeAngle:
                    completed.source === 'pen' ? rawEndpoint.altitudeAngle : Math.PI / 2,
""",
)
replace_once(
    "src/app/paint-session-controller.ts",
    """              pressure: liveGeometry[index]?.pressure ?? 1,
""",
    """              pressure: liveGeometry[index]?.pressure ?? 1,
              tiltX: liveGeometry[index]?.tiltX ?? 0,
              tiltY: liveGeometry[index]?.tiltY ?? 0,
              altitudeAngle: liveGeometry[index]?.altitudeAngle ?? Math.PI / 2,
""",
)

# ---------------- brush preset controller ----------------
replace_once(
    "src/app/brush-preset-controller.ts",
    """  brushPressureResponseCurveV1,
  BUILTIN_BRUSH_GRAIN_RESOURCES_V1,
""",
    """  brushPressureResponseCurveV1,
  brushTiltSizeEnabledV1,
  brushTiltOpacityEnabledV1,
  brushTiltFlowEnabledV1,
  brushTiltResponseCurveV1,
  BUILTIN_BRUSH_GRAIN_RESOURCES_V1,
""",
)
replace_once(
    "src/app/brush-preset-controller.ts",
    """  updateBrushPresetPressureResponseCurveV1,
  updateBrushPresetSpacingV1,
""",
    """  updateBrushPresetPressureResponseCurveV1,
  updateBrushPresetTiltSizeV1,
  updateBrushPresetTiltOpacityV1,
  updateBrushPresetTiltFlowV1,
  updateBrushPresetTiltResponseCurveV1,
  updateBrushPresetSpacingV1,
""",
)
replace_once(
    "src/app/brush-preset-controller.ts",
    """  const pressureCurveReset = requireElement('#brush-pressure-curve-reset', HTMLButtonElement);
  const tipShape = requireElement('#brush-tip-shape', HTMLSelectElement);
""",
    """  const pressureCurveReset = requireElement('#brush-pressure-curve-reset', HTMLButtonElement);
  const tiltSizeButton = requireElement('#brush-tilt-size', HTMLButtonElement);
  const tiltOpacityButton = requireElement('#brush-tilt-opacity', HTMLButtonElement);
  const tiltFlowButton = requireElement('#brush-tilt-flow', HTMLButtonElement);
  const tiltCurveCanvas = requireElement('#brush-tilt-curve', HTMLCanvasElement);
  const tiltCurvePreset = requireElement('#brush-tilt-curve-preset', HTMLSelectElement);
  const tiltCurveInput = requireElement('#brush-tilt-curve-input', HTMLInputElement);
  const tiltCurveOutput = requireElement('#brush-tilt-curve-output', HTMLInputElement);
  const tiltCurveDelete = requireElement('#brush-tilt-curve-delete', HTMLButtonElement);
  const tiltCurveReset = requireElement('#brush-tilt-curve-reset', HTMLButtonElement);
  const tipShape = requireElement('#brush-tip-shape', HTMLSelectElement);
""",
)
replace_once(
    "src/app/brush-preset-controller.ts",
    """  let pressureCurveEditor: SharedCurveEditorV1 | null = null;
  let idCounter = 0;
""",
    """  let pressureCurveEditor: SharedCurveEditorV1 | null = null;
  let tiltCurveEditor: SharedCurveEditorV1 | null = null;
  let idCounter = 0;
""",
)
replace_once(
    "src/app/brush-preset-controller.ts",
    """    const pressureResponseCurve = brushPressureResponseCurveV1(item.preset);
    input.paintSession.setBrushPressureResponseCurve(pressureResponseCurve);
    const tipAssets = brushTipAssetsV1(item.preset);
""",
    """    const pressureResponseCurve = brushPressureResponseCurveV1(item.preset);
    input.paintSession.setBrushPressureResponseCurve(pressureResponseCurve);
    const tiltSizeEnabled = brushTiltSizeEnabledV1(item.preset);
    input.paintSession.setBrushTiltSizeEnabled(tiltSizeEnabled);
    const tiltOpacityEnabled = brushTiltOpacityEnabledV1(item.preset);
    input.paintSession.setBrushTiltOpacityEnabled(tiltOpacityEnabled);
    const tiltFlowEnabled = brushTiltFlowEnabledV1(item.preset);
    input.paintSession.setBrushTiltFlowEnabled(tiltFlowEnabled);
    const tiltResponseCurve = brushTiltResponseCurveV1(item.preset);
    input.paintSession.setBrushTiltResponseCurve(tiltResponseCurve);
    const tipAssets = brushTipAssetsV1(item.preset);
""",
)
replace_once(
    "src/app/brush-preset-controller.ts",
    """    input.root.dataset.illustroBrushPressureCurvePoints = String(pressureResponseCurve.length);
    input.root.dataset.illustroBrushTipShape = brushTipShapeV1(item.preset);
""",
    """    input.root.dataset.illustroBrushPressureCurvePoints = String(pressureResponseCurve.length);
    input.root.dataset.illustroBrushTiltSize = String(tiltSizeEnabled);
    input.root.dataset.illustroBrushTiltOpacity = String(tiltOpacityEnabled);
    input.root.dataset.illustroBrushTiltFlow = String(tiltFlowEnabled);
    input.root.dataset.illustroBrushTiltCurvePoints = String(tiltResponseCurve.length);
    input.root.dataset.illustroBrushTipShape = brushTipShapeV1(item.preset);
""",
)
replace_once(
    "src/app/brush-preset-controller.ts",
    """    const pressureResponseCurve = brushPressureResponseCurveV1(selected.preset);
    pressureCurveEditor?.setCurve(pressureResponseCurve);
    tipShape.value = brushTipShapeV1(selected.preset);
""",
    """    const pressureResponseCurve = brushPressureResponseCurveV1(selected.preset);
    pressureCurveEditor?.setCurve(pressureResponseCurve);
    const tiltSizeEnabled = brushTiltSizeEnabledV1(selected.preset);
    tiltSizeButton.textContent = tiltSizeEnabled ? 'ON' : 'OFF';
    tiltSizeButton.setAttribute('aria-pressed', String(tiltSizeEnabled));
    const tiltOpacityEnabled = brushTiltOpacityEnabledV1(selected.preset);
    tiltOpacityButton.textContent = tiltOpacityEnabled ? 'ON' : 'OFF';
    tiltOpacityButton.setAttribute('aria-pressed', String(tiltOpacityEnabled));
    const tiltFlowEnabled = brushTiltFlowEnabledV1(selected.preset);
    tiltFlowButton.textContent = tiltFlowEnabled ? 'ON' : 'OFF';
    tiltFlowButton.setAttribute('aria-pressed', String(tiltFlowEnabled));
    const tiltResponseCurve = brushTiltResponseCurveV1(selected.preset);
    tiltCurveEditor?.setCurve(tiltResponseCurve);
    tipShape.value = brushTipShapeV1(selected.preset);
""",
)
replace_once(
    "src/app/brush-preset-controller.ts",
    """    const pressureCurveLabel = responseCurveIsLinearV1(pressureResponseCurve) ? '' : ' · P-Curve';
    propertyStatus.textContent = `${parameters.sizePx.toFixed(1)} px · ${Math.round(parameters.opacity * 100)}% · ${Math.round(parameters.flow * 100)}% · H${Math.round(hardness * 100)}% · D${Math.round(tipDensity * 100)}% · S${Math.round(spacing.spacingRatio * 100)}% · A${Math.round(tipAngleDegrees)}° · F${Math.round(tipDirectionDegrees)}°${followRotation ? ' · Follow' : ''}${repeatLabel}${startLabel}${endLabel}${sizeTaperLabel}${opacityTaperLabel}${forcedTaperLabel}${stabilizationLabel}${postCorrectionLabel}${grainLabel}${paperLabel}${textureStrengthLabel}${textureScaleLabel}${textureRotationLabel}${textureBlendLabel}${pressureSizeLabel}${pressureOpacityLabel}${pressureFlowLabel}${pressureCurveLabel}`;
""",
    """    const pressureCurveLabel = responseCurveIsLinearV1(pressureResponseCurve) ? '' : ' · P-Curve';
    const tiltSizeLabel = tiltSizeEnabled ? ' · T→Size' : '';
    const tiltOpacityLabel = tiltOpacityEnabled ? ' · T→Opacity' : '';
    const tiltFlowLabel = tiltFlowEnabled ? ' · T→Flow' : '';
    const tiltCurveLabel = responseCurveIsLinearV1(tiltResponseCurve) ? '' : ' · T-Curve';
    propertyStatus.textContent = `${parameters.sizePx.toFixed(1)} px · ${Math.round(parameters.opacity * 100)}% · ${Math.round(parameters.flow * 100)}% · H${Math.round(hardness * 100)}% · D${Math.round(tipDensity * 100)}% · S${Math.round(spacing.spacingRatio * 100)}% · A${Math.round(tipAngleDegrees)}° · F${Math.round(tipDirectionDegrees)}°${followRotation ? ' · Follow' : ''}${repeatLabel}${startLabel}${endLabel}${sizeTaperLabel}${opacityTaperLabel}${forcedTaperLabel}${stabilizationLabel}${postCorrectionLabel}${grainLabel}${paperLabel}${textureStrengthLabel}${textureScaleLabel}${textureRotationLabel}${textureBlendLabel}${pressureSizeLabel}${pressureOpacityLabel}${pressureFlowLabel}${pressureCurveLabel}${tiltSizeLabel}${tiltOpacityLabel}${tiltFlowLabel}${tiltCurveLabel}`;
""",
)
replace_once(
    "src/app/brush-preset-controller.ts",
    """      pressureFlowButton,
      tipShape,
""",
    """      pressureFlowButton,
      tiltSizeButton,
      tiltOpacityButton,
      tiltFlowButton,
      tipShape,
""",
)
replace_once(
    "src/app/brush-preset-controller.ts",
    """    pressureCurveEditor?.setDisabled(locked);
    tipAssetSelect.disabled = locked || tipAssets.length === 0;
""",
    """    pressureCurveEditor?.setDisabled(locked);
    tiltCurveEditor?.setDisabled(locked);
    tipAssetSelect.disabled = locked || tipAssets.length === 0;
""",
)
replace_once(
    "src/app/brush-preset-controller.ts",
    """  const onSearch = (): void => {
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

  const onSearch = (): void => {
""",
)
replace_once(
    "src/app/brush-preset-controller.ts",
    """  const onTipShape = (): void => {
""",
    """  const onTiltSize = (): void =>
    mutate(() =>
      updateBrushPresetTiltSizeV1(
        state,
        state.selectedPresetId,
        !brushTiltSizeEnabledV1(selectedBrushPresetItemV1(state).preset),
      ),
    );
  const onTiltOpacity = (): void =>
    mutate(() =>
      updateBrushPresetTiltOpacityV1(
        state,
        state.selectedPresetId,
        !brushTiltOpacityEnabledV1(selectedBrushPresetItemV1(state).preset),
      ),
    );
  const onTiltFlow = (): void =>
    mutate(() =>
      updateBrushPresetTiltFlowV1(
        state,
        state.selectedPresetId,
        !brushTiltFlowEnabledV1(selectedBrushPresetItemV1(state).preset),
      ),
    );
  const onTipShape = (): void => {
""",
)
replace_once(
    "src/app/brush-preset-controller.ts",
    """  pressureFlowButton.addEventListener('click', onPressureFlow);
  tipShape.addEventListener('change', onTipShape);
""",
    """  pressureFlowButton.addEventListener('click', onPressureFlow);
  tiltSizeButton.addEventListener('click', onTiltSize);
  tiltOpacityButton.addEventListener('click', onTiltOpacity);
  tiltFlowButton.addEventListener('click', onTiltFlow);
  tipShape.addEventListener('change', onTipShape);
""",
)
replace_once(
    "src/app/brush-preset-controller.ts",
    """      pressureFlowButton.removeEventListener('click', onPressureFlow);
      tipShape.removeEventListener('change', onTipShape);
""",
    """      pressureFlowButton.removeEventListener('click', onPressureFlow);
      tiltSizeButton.removeEventListener('click', onTiltSize);
      tiltOpacityButton.removeEventListener('click', onTiltOpacity);
      tiltFlowButton.removeEventListener('click', onTiltFlow);
      pressureCurveEditor?.dispose();
      tiltCurveEditor?.dispose();
      tipShape.removeEventListener('change', onTipShape);
""",
)

# ---------------- index UI ----------------
replace_once(
    "src/index.html",
    """              <div class=\"shell-brush-property-row shell-brush-tip-property-row\">
                <label for=\"brush-tip-shape\">ブラシ形状</label>
""",
    """              <div class=\"shell-brush-property-row shell-brush-tip-property-row\">
                <label for=\"brush-tilt-size\">傾き→サイズ</label>
                <button id=\"brush-tilt-size\" type=\"button\" aria-pressed=\"false\" title=\"ペンの傾き（直立度）をブラシサイズへ反映\">OFF</button>
                <span class=\"shell-brush-tip-kind\">Tilt</span>
              </div>
              <div class=\"shell-brush-property-row shell-brush-tip-property-row\">
                <label for=\"brush-tilt-opacity\">傾き→不透明度</label>
                <button id=\"brush-tilt-opacity\" type=\"button\" aria-pressed=\"false\" title=\"ペンの傾き（直立度）をストローク不透明度上限へ反映\">OFF</button>
                <span class=\"shell-brush-tip-kind\">Tilt</span>
              </div>
              <div class=\"shell-brush-property-row shell-brush-tip-property-row\">
                <label for=\"brush-tilt-flow\">傾き→流量</label>
                <button id=\"brush-tilt-flow\" type=\"button\" aria-pressed=\"false\" title=\"ペンの傾き（直立度）をブラシ流量へ反映\">OFF</button>
                <span class=\"shell-brush-tip-kind\">Tilt</span>
              </div>
              <div class=\"shell-brush-pressure-curve-editor shell-brush-tilt-curve-editor\" aria-label=\"傾きレスポンスカーブ\">
                <div class=\"shell-brush-pressure-curve-header\">
                  <label for=\"brush-tilt-curve-preset\">傾きカーブ</label>
                  <select id=\"brush-tilt-curve-preset\" aria-label=\"傾きカーブプリセット\">
                    <option value=\"linear\">Linear</option>
                    <option value=\"soft\">Soft</option>
                    <option value=\"hard\">Hard</option>
                    <option value=\"s-curve\">S Curve</option>
                    <option value=\"custom\">Custom</option>
                  </select>
                </div>
                <canvas id=\"brush-tilt-curve\" width=\"240\" height=\"128\" tabindex=\"0\" aria-label=\"ペン傾きレスポンスカーブ。入力0は水平、100は直立。空いている場所をタップして点を追加、点をドラッグして編集\"></canvas>
                <div class=\"shell-brush-pressure-curve-values\">
                  <label>入力 <input id=\"brush-tilt-curve-input\" type=\"number\" inputmode=\"decimal\" min=\"0\" max=\"100\" step=\"0.1\" value=\"0\" /><span>%</span></label>
                  <label>出力 <input id=\"brush-tilt-curve-output\" type=\"number\" inputmode=\"decimal\" min=\"0\" max=\"100\" step=\"0.1\" value=\"0\" /><span>%</span></label>
                  <button id=\"brush-tilt-curve-delete\" type=\"button\">点を削除</button>
                  <button id=\"brush-tilt-curve-reset\" type=\"button\">Reset</button>
                </div>
              </div>
              <div class=\"shell-brush-property-row shell-brush-tip-property-row\">
                <label for=\"brush-tip-shape\">ブラシ形状</label>
""",
)

# ---------------- tests ----------------
Path("tests/unit/brush-tilt-mapping.test.ts").write_text("""import { describe, expect, it } from 'vitest';
import {
  brushTiltFlowEnabledV1,
  brushTiltOpacityEnabledV1,
  brushTiltResponseCurveV1,
  brushTiltSizeEnabledV1,
  createBaselineBrushPresetV1,
  withBrushTiltFlowEnabledV1,
  withBrushTiltOpacityEnabledV1,
  withBrushTiltResponseCurveV1,
  withBrushTiltSizeEnabledV1,
} from '../../src/domain/brush-schema.js';
import { LINEAR_RESPONSE_CURVE_V1 } from '../../src/domain/response-curve.js';
import {
  BaselineBrushDabBuilderV1,
  baselineBrushSampleTiltUprightnessV1,
} from '../../src/gpu/baseline-brush.js';
import { CanonicalRasterBrushStrokeV1 } from '../../src/app/canonical-raster-brush.js';
import { PaintSessionControllerV1 } from '../../src/app/paint-session-controller.js';

class FakeRendererDocumentPort {
  async configureDocument(): Promise<void> {}
  async restoreBaselineStrokes(): Promise<void> {}
  async applyBaselineTilePatches(): Promise<void> {}
  async restoreBaselineCanonicalTiles(): Promise<void> {}
  async exportBaselineCanonicalTiles(): Promise<readonly never[]> { return []; }
  async exportBaselineCompositeTiles(): Promise<readonly never[]> { return []; }
}

const CUSTOM_CURVE = Object.freeze([
  Object.freeze({ input: 0, output: 0 }),
  Object.freeze({ input: 0.5, output: 0.75 }),
  Object.freeze({ input: 1, output: 1 }),
]);

describe('M6A-045 tilt mapping', () => {
  it('is opt-in in preset data and keeps linear upright-neutral defaults', () => {
    const preset = createBaselineBrushPresetV1({
      id: 'tilt.mapping', name: 'Tilt Mapping', category: 'Test', behavior: 'paint',
    });
    expect(brushTiltSizeEnabledV1(preset)).toBe(false);
    expect(brushTiltOpacityEnabledV1(preset)).toBe(false);
    expect(brushTiltFlowEnabledV1(preset)).toBe(false);
    expect(brushTiltResponseCurveV1(preset)).toEqual(LINEAR_RESPONSE_CURVE_V1);
    expect(brushTiltSizeEnabledV1(withBrushTiltSizeEnabledV1(preset, true))).toBe(true);
    expect(brushTiltOpacityEnabledV1(withBrushTiltOpacityEnabledV1(preset, true))).toBe(true);
    expect(brushTiltFlowEnabledV1(withBrushTiltFlowEnabledV1(preset, true))).toBe(true);
    expect(brushTiltResponseCurveV1(withBrushTiltResponseCurveV1(preset, CUSTOM_CURVE))).toEqual(
      CUSTOM_CURVE,
    );
  });

  it('prefers altitudeAngle and derives the same uprightness domain from tiltX/tiltY', () => {
    expect(
      baselineBrushSampleTiltUprightnessV1({
        documentX: 0, documentY: 0, altitudeAngle: Math.PI / 4,
      }),
    ).toBeCloseTo(0.5, 10);
    expect(
      baselineBrushSampleTiltUprightnessV1({ documentX: 0, documentY: 0, tiltX: 60, tiltY: 0 }),
    ).toBeCloseTo(1 / 3, 10);
    expect(
      baselineBrushSampleTiltUprightnessV1({ documentX: 0, documentY: 0, tiltX: 0, tiltY: 0 }),
    ).toBe(1);
  });

  it('linearly interpolates tilt at logical stamps and maps one shared response independently', () => {
    const builder = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      opacity: 0.8,
      flow: 0.6,
      spacingRatio: 0.25,
      minimumStampDistancePx: 1,
      tiltSizeEnabled: true,
      tiltOpacityEnabled: true,
      tiltFlowEnabled: true,
    });
    builder.beginDelta({ documentX: 0, documentY: 0, altitudeAngle: Math.PI / 2 });
    builder.appendDelta([{ documentX: 10, documentY: 0, altitudeAngle: 0 }]);
    const dabs = builder.dabs();
    expect(dabs.map((dab) => dab.x)).toEqual([0, 5]);
    expect(dabs[0]?.radius).toBe(10);
    expect(dabs[1]?.radius).toBeCloseTo(5, 10);
    expect(dabs[1]?.strokeOpacity).toBeCloseTo(0.4, 10);
    expect(dabs[1]?.flow).toBeCloseTo(0.3, 10);
  });

  it('keeps pressure and tilt independent while sharing resolved primitive fields', () => {
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
    });
    const [dab] = builder.beginDelta({
      documentX: 1,
      documentY: 1,
      pressure: 0.5,
      altitudeAngle: Math.PI / 4,
    });
    expect(dab?.radius).toBeCloseTo(2.5, 10);
    expect(dab?.strokeOpacity).toBeCloseTo(0.2, 10);
    expect(dab?.flow).toBeCloseTo(0.15, 10);
  });

  it('forwards tilt through canonical/runtime state and keeps mouse-style zero tilt neutral', () => {
    const stroke = new CanonicalRasterBrushStrokeV1({ sizePx: 20, tiltSizeEnabled: true });
    const [dab] = stroke.beginConfirmed({ documentX: 1, documentY: 1, tiltX: 0, tiltY: 0 });
    expect(dab?.radius).toBe(10);

    const session = new PaintSessionControllerV1(new FakeRendererDocumentPort());
    expect(session.setBrushTiltSizeEnabled(true)).toBe(true);
    expect(session.setBrushTiltOpacityEnabled(true)).toBe(true);
    expect(session.setBrushTiltFlowEnabled(true)).toBe(true);
    expect(session.setBrushTiltResponseCurve(CUSTOM_CURVE)).toEqual(CUSTOM_CURVE);
    const snapshot = session.snapshot();
    expect(snapshot.brushTiltSizeEnabled).toBe(true);
    expect(snapshot.brushTiltOpacityEnabled).toBe(true);
    expect(snapshot.brushTiltFlowEnabled).toBe(true);
    expect(snapshot.brushTiltResponseCurve).toEqual(CUSTOM_CURVE);
  });
});
""")

# ---------------- verifier ----------------
replace_once(
    "scripts/verify-m6a-brush.mjs",
    """requireText(
  progress,
  'M6A-PERF-001 incremental active-stroke rendering（stable prefix + bounded mutable tail）:未完了',
""",
    """requireText(progress, 'M6A-045 tilt mapping:完了', 'M6A-045 progress is not complete');
requireText(
  read('src/domain/brush-schema.ts'),
  'brushTiltSizeEnabledV1',
  'tilt mapping preset helpers missing',
);
requireText(
  read('src/gpu/baseline-brush.ts'),
  'baselineBrushSampleTiltUprightnessV1',
  'tilt source normalization missing',
);
requireText(
  read('src/gpu/baseline-brush.ts'),
  'cursorTiltUprightness += (tiltUprightness - cursorTiltUprightness) * ratio',
  'tilt source is not interpolated at logical stamp positions',
);
requireText(
  read('src/app/paint-session-controller.ts'),
  'setBrushTiltResponseCurve',
  'tilt mapping is not connected to runtime state',
);
requireText(read('src/index.html'), 'id=\"brush-tilt-size\"', 'reachable tilt-size control missing');
requireText(read('src/index.html'), 'id=\"brush-tilt-curve\"', 'reachable tilt Curve Editor missing');
requireText(
  read('tests/unit/brush-tilt-mapping.test.ts'),
  'keeps pressure and tilt independent while sharing resolved primitive fields',
  'tilt/pressure composition regression missing',
);

requireText(
  progress,
  'M6A-PERF-001 incremental active-stroke rendering（stable prefix + bounded mutable tail）:未完了',
""",
)

# ---------------- progress/docs ----------------
replace_once(
    "IMPLEMENTATION_PROGRESS.md",
    "M6A-045 tilt mapping:未完了",
    """M6A-045 tilt mapping:完了
再開メモ: M6A-045 tilt mappingはPenのaltitudeAngleを優先し、未提供時はPointer Events tiltX/tiltYから同じ高度角へ変換して、0=水平・1=直立のnormalized tilt uprightnessをlogical stamp位置へ距離比例補間する。直立/tilt未報告/Mouseは1.0となるため既存ブラシはneutral fallbackを維持する。BrushPresetV1.dynamicsにはtiltSizeEnabled / tiltOpacityEnabled / tiltFlowEnabled（既定false）とtiltResponseCurve（linear既定）を追加し、shared Curve Editorを再利用する。各mappingはpressureとは独立に同じtilt responseをsize / opacity cap / flowへ乗算し、primitive dabには解決済みradius/strokeOpacity/flowのみを残す。M6A-046 orientation mappingがazimuth/pen direction/twist系の角度方向を所有し、M6A-049/050が後続のminimum/maximum responseを所有する。次はM6A-046 orientation mappingから再開する。""",
)
append_once(
    "ILLUSTRO_DESIGN_MEMO.md",
    """

## M6A tilt mapping boundary — 2026-09-03

- `tilt` source is normalized as **uprightness** in `0..1`: `1` means the pen is perpendicular to the surface and `0` means parallel. `PointerEvent.altitudeAngle` is preferred; when absent, `tiltX`/`tiltY` are converted to the equivalent altitude domain.
- This polarity intentionally makes upright, zero-tilt and unavailable-tilt data neutral (`1`) for multiplicative mappings, so optional hardware cannot make a brush disappear merely because the browser reports no usable tilt. Mouse is also neutral.
- `dynamics.tiltSizeEnabled`, `tiltOpacityEnabled` and `tiltFlowEnabled` are independent opt-in mappings, all defaulting to false. A single `tiltResponseCurve` is evaluated once per logical stamp and then distributed to the enabled targets, matching the shared response-function architecture used by pressure.
- Tilt is distance-interpolated at logical stamp positions and is carried alongside stabilized geometry; post-stroke correction changes geometry only and preserves the corresponding tilt source values by sample index.
- Tilt response affects resolved size, opacity cap and flow only. Primitive dabs continue to store only resolved `radius`, `strokeOpacity` and `flow`; no renderer/history/Worker tilt ABI is introduced.
- M6A-046 owns directional orientation inputs such as azimuth/twist/pen direction; M6A-049/050 own minimum/maximum response bounds. Those stages must extend this source pipeline rather than duplicate input sampling.
- The UI reuses the IP-12 Shared Curve Editor grammar (direct node editing, exact input/output values, presets and Reset) rather than inventing a tilt-specific nonlinear control.
""",
)

print('M6A-045 patch applied')
