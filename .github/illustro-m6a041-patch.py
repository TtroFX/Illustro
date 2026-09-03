from pathlib import Path


def read(path: str) -> str:
    return Path(path).read_text(encoding='utf-8')


def write(path: str, content: str) -> None:
    Path(path).write_text(content, encoding='utf-8')


def replace_once(path: str, before: str, after: str) -> None:
    source = read(path)
    count = source.count(before)
    if count != 1:
        raise RuntimeError(f'{path}: expected one replacement, found {count}: {before[:180]!r}')
    write(path, source.replace(before, after, 1))


def insert_before(path: str, marker: str, block: str) -> None:
    replace_once(path, marker, block.rstrip() + '\n\n' + marker)


def append_once(path: str, marker: str, block: str) -> None:
    source = read(path)
    if marker in source:
        return
    write(path, source.rstrip() + '\n\n' + block.strip() + '\n')


def write_new(path: str, content: str) -> None:
    target = Path(path)
    if target.exists():
        raise RuntimeError(f'{path}: already exists')
    target.write_text(content.strip() + '\n', encoding='utf-8')


# Preset contract: pressure->size starts as an opt-in linear mapping. Curves/min/max remain later items.
insert_before(
    'src/domain/brush-schema.ts',
    "export type BrushTipSelectionModeV1 = 'fixed' | 'sequence' | 'random-per-stamp';",
    """export const DEFAULT_BRUSH_PRESSURE_SIZE_ENABLED_V1 = false as const;

export function brushPressureSizeEnabledV1(preset: BrushPresetV1): boolean {
  const value = preset.dynamics.pressureSizeEnabled;
  return typeof value === 'boolean' ? value : DEFAULT_BRUSH_PRESSURE_SIZE_ENABLED_V1;
}

export function withBrushPressureSizeEnabledV1(
  preset: BrushPresetV1,
  enabled: boolean,
): BrushPresetV1 {
  if (typeof enabled !== 'boolean') throw new TypeError('brush pressure size flag must be boolean');
  if (enabled === DEFAULT_BRUSH_PRESSURE_SIZE_ENABLED_V1) {
    const { pressureSizeEnabled: _pressureSizeEnabled, ...dynamics } = preset.dynamics;
    return normalizeBrushPresetV1({ ...preset, dynamics });
  }
  return normalizeBrushPresetV1({
    ...preset,
    dynamics: { ...preset.dynamics, pressureSizeEnabled: enabled },
  });
}""",
)

# Low-level kernel: preserve pressure on samples/logical stamps and interpolate it at spacing stamps.
replace_once(
    'src/gpu/baseline-brush.ts',
    """export interface BaselineBrushSampleV1 {
  readonly documentX: number;
  readonly documentY: number;
}
""",
    """export interface BaselineBrushSampleV1 {
  readonly documentX: number;
  readonly documentY: number;
  readonly pressure?: number;
}

export function baselineBrushSamplePressureV1(sample: BaselineBrushSampleV1): number {
  const pressure = sample.pressure ?? 1;
  if (!Number.isFinite(pressure) || pressure < 0 || pressure > 1) {
    throw new RangeError('baseline brush pressure must be within 0..1');
  }
  return pressure;
}
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """function assertFinitePoint(sample: BaselineBrushSampleV1): void {
  if (!Number.isFinite(sample.documentX) || !Number.isFinite(sample.documentY)) {
    throw new RangeError('baseline brush samples require finite document coordinates');
  }
}
""",
    """function assertFinitePoint(sample: BaselineBrushSampleV1): void {
  if (!Number.isFinite(sample.documentX) || !Number.isFinite(sample.documentY)) {
    throw new RangeError('baseline brush samples require finite document coordinates');
  }
  baselineBrushSamplePressureV1(sample);
}
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """interface BaselineLogicalStampRecordV1 {
  readonly x: number;
  readonly y: number;
  readonly tipAngleDegrees: number;
  readonly pathDistancePx: number;
""",
    """interface BaselineLogicalStampRecordV1 {
  readonly x: number;
  readonly y: number;
  readonly pressure: number;
  readonly tipAngleDegrees: number;
  readonly pathDistancePx: number;
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """  readonly #forceStartTaper: boolean;
  readonly #forceEndTaper: boolean;
  readonly #flow: number;
""",
    """  readonly #forceStartTaper: boolean;
  readonly #forceEndTaper: boolean;
  readonly #pressureSizeEnabled: boolean;
  readonly #flow: number;
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """  #lastPoint: { x: number; y: number } | null = null;
  #lastStampPoint: { x: number; y: number } | null = null;
""",
    """  #lastPoint: { x: number; y: number; pressure: number } | null = null;
  #lastStampPoint: { x: number; y: number } | null = null;
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """      readonly forceStartTaper?: boolean;
      readonly forceEndTaper?: boolean;
      readonly hardness?: number;
""",
    """      readonly forceStartTaper?: boolean;
      readonly forceEndTaper?: boolean;
      readonly pressureSizeEnabled?: boolean;
      readonly hardness?: number;
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """    const forceStartTaper = options.forceStartTaper ?? false;
    const forceEndTaper = options.forceEndTaper ?? false;
    const hardness = options.hardness ?? BASELINE_BRUSH_HARDNESS;
""",
    """    const forceStartTaper = options.forceStartTaper ?? false;
    const forceEndTaper = options.forceEndTaper ?? false;
    const pressureSizeEnabled = options.pressureSizeEnabled ?? false;
    const hardness = options.hardness ?? BASELINE_BRUSH_HARDNESS;
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """    if (typeof forceStartTaper !== 'boolean' || typeof forceEndTaper !== 'boolean') {
      throw new TypeError('baseline brush forced taper flags must be boolean');
    }
    if (!Number.isFinite(hardness) || hardness < 0 || hardness > 1) {
""",
    """    if (typeof forceStartTaper !== 'boolean' || typeof forceEndTaper !== 'boolean') {
      throw new TypeError('baseline brush forced taper flags must be boolean');
    }
    if (typeof pressureSizeEnabled !== 'boolean') {
      throw new TypeError('baseline brush pressure size flag must be boolean');
    }
    if (!Number.isFinite(hardness) || hardness < 0 || hardness > 1) {
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """    this.#forceStartTaper = forceStartTaper;
    this.#forceEndTaper = forceEndTaper;
    this.#flow = flow;
""",
    """    this.#forceStartTaper = forceStartTaper;
    this.#forceEndTaper = forceEndTaper;
    this.#pressureSizeEnabled = pressureSizeEnabled;
    this.#flow = flow;
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """    this.#lastPoint = { x: sample.documentX, y: sample.documentY };
    this.#pushLogicalStamp(sample.documentX, sample.documentY, this.#resolvedTipAngleDegrees(), 0);
""",
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
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """        this.#appendPoint(sample.documentX, sample.documentY);
""",
    """        this.#appendPoint(
          sample.documentX,
          sample.documentY,
          baselineBrushSamplePressureV1(sample),
        );
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """      this.#appendPoint(sample.documentX, sample.documentY);
""",
    """      this.#appendPoint(
        sample.documentX,
        sample.documentY,
        baselineBrushSamplePressureV1(sample),
      );
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """          lastPoint.x,
          lastPoint.y,
          this.#resolvedTipAngleDegrees(this.#lastStrokeDirectionDegrees ?? undefined),
""",
    """          lastPoint.x,
          lastPoint.y,
          lastPoint.pressure,
          this.#resolvedTipAngleDegrees(this.#lastStrokeDirectionDegrees ?? undefined),
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """    stamp: Pick<BaselineLogicalStampRecordV1, 'x' | 'y' | 'tipAngleDegrees' | 'sampledTipAlpha'>,
""",
    """    stamp: Pick<
      BaselineLogicalStampRecordV1,
      'x' | 'y' | 'pressure' | 'tipAngleDegrees' | 'sampledTipAlpha'
    >,
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """    if (sizeScale <= 0 || opacityScale <= 0) return;
    pushBaselineBrushStampV1(
      target,
      stamp.x,
      stamp.y,
      this.#radius * sizeScale,
""",
    """    const pressureSizeScale = this.#pressureSizeEnabled ? stamp.pressure : 1;
    if (sizeScale <= 0 || opacityScale <= 0 || pressureSizeScale <= 0) return;
    pushBaselineBrushStampV1(
      target,
      stamp.x,
      stamp.y,
      this.#radius * sizeScale * pressureSizeScale,
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """  #pushLogicalStamp(x: number, y: number, tipAngleDegrees: number, pathDistancePx: number): void {
""",
    """  #pushLogicalStamp(
    x: number,
    y: number,
    pressure: number,
    tipAngleDegrees: number,
    pathDistancePx: number,
  ): void {
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """    const record: BaselineLogicalStampRecordV1 = {
      x,
      y,
      tipAngleDegrees,
""",
    """    const record: BaselineLogicalStampRecordV1 = {
      x,
      y,
      pressure,
      tipAngleDegrees,
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """  #appendPoint(x: number, y: number): void {
    const lastPoint = this.#lastPoint;
    if (lastPoint === null) return;

    let cursorX = lastPoint.x;
    let cursorY = lastPoint.y;
""",
    """  #appendPoint(x: number, y: number, pressure: number): void {
    const lastPoint = this.#lastPoint;
    if (lastPoint === null) return;

    let cursorX = lastPoint.x;
    let cursorY = lastPoint.y;
    let cursorPressure = lastPoint.pressure;
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """      cursorX += (x - cursorX) * ratio;
      cursorY += (y - cursorY) * ratio;
      segmentAdvancedPx += stepDistancePx;
      this.#pushLogicalStamp(
        cursorX,
        cursorY,
        this.#resolvedTipAngleDegrees(this.#lastStrokeDirectionDegrees ?? undefined),
""",
    """      cursorX += (x - cursorX) * ratio;
      cursorY += (y - cursorY) * ratio;
      cursorPressure += (pressure - cursorPressure) * ratio;
      segmentAdvancedPx += stepDistancePx;
      this.#pushLogicalStamp(
        cursorX,
        cursorY,
        cursorPressure,
        this.#resolvedTipAngleDegrees(this.#lastStrokeDirectionDegrees ?? undefined),
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """    this.#pathDistancePx += segmentLength;
    this.#lastPoint = { x, y };
""",
    """    this.#pathDistancePx += segmentLength;
    this.#lastPoint = { x, y, pressure };
""",
)

# Canonical facade forwards pressure data and the opt-in mapping flag.
replace_once(
    'src/app/canonical-raster-brush.ts',
    """export interface CanonicalRasterBrushSampleV1 {
  readonly documentX: number;
  readonly documentY: number;
}
""",
    """export interface CanonicalRasterBrushSampleV1 {
  readonly documentX: number;
  readonly documentY: number;
  readonly pressure?: number;
}
""",
)
replace_once(
    'src/app/canonical-raster-brush.ts',
    """      readonly forceStartTaper?: boolean;
      readonly forceEndTaper?: boolean;
      readonly hardness?: number;
""",
    """      readonly forceStartTaper?: boolean;
      readonly forceEndTaper?: boolean;
      readonly pressureSizeEnabled?: boolean;
      readonly hardness?: number;
""",
)
replace_once(
    'src/app/canonical-raster-brush.ts',
    """      ...(options.forceEndTaper === undefined ? {} : { forceEndTaper: options.forceEndTaper }),
      ...(options.hardness === undefined ? {} : { hardness: options.hardness }),
""",
    """      ...(options.forceEndTaper === undefined ? {} : { forceEndTaper: options.forceEndTaper }),
      ...(options.pressureSizeEnabled === undefined
        ? {}
        : { pressureSizeEnabled: options.pressureSizeEnabled }),
      ...(options.hardness === undefined ? {} : { hardness: options.hardness }),
""",
)

# Runtime state and stabilized/corrected geometry keep raw pressure associated with each sample.
replace_once(
    'src/app/paint-session-controller.ts',
    """  readonly brushTextureBlendMode: BrushTextureBlendModeV1;
  readonly brushTipAngleDegrees: number;
""",
    """  readonly brushTextureBlendMode: BrushTextureBlendModeV1;
  readonly brushPressureSizeEnabled: boolean;
  readonly brushTipAngleDegrees: number;
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """  #brushTextureBlendMode: BrushTextureBlendModeV1 = 'multiply';
  #brushTipAngleDegrees: number = BASELINE_BRUSH_TIP_ANGLE_DEGREES;
""",
    """  #brushTextureBlendMode: BrushTextureBlendModeV1 = 'multiply';
  #brushPressureSizeEnabled = false;
  #brushTipAngleDegrees: number = BASELINE_BRUSH_TIP_ANGLE_DEGREES;
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """      brushTextureBlendMode: this.#brushTextureBlendMode,
      brushTipAngleDegrees: this.#brushTipAngleDegrees,
""",
    """      brushTextureBlendMode: this.#brushTextureBlendMode,
      brushPressureSizeEnabled: this.#brushPressureSizeEnabled,
      brushTipAngleDegrees: this.#brushTipAngleDegrees,
""",
)
insert_before(
    'src/app/paint-session-controller.ts',
    '  setBrushTipAngleDegrees(angleDegrees: number): number {',
    """  setBrushPressureSizeEnabled(enabled: boolean): boolean {
    if (typeof enabled !== 'boolean') throw new TypeError('invalid runtime pressure-size flag');
    if (enabled !== this.#brushPressureSizeEnabled) this.#clearActiveStroke();
    this.#brushPressureSizeEnabled = enabled;
    return this.#brushPressureSizeEnabled;
  }

  brushPressureSizeEnabled(): boolean {
    return this.#brushPressureSizeEnabled;
  }""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """          const liveGeometry = this.#activeSamples.map((sample) => replayStabilizer.push(sample));
          const rawEndpoint = this.#activeSamples.at(-1);
          if (rawEndpoint !== undefined) {
            const releasePoint = replayStabilizer.release(rawEndpoint);
            if (releasePoint !== null) liveGeometry.push(releasePoint);
          }
          const correctedGeometry = correctPostStrokeGeometryV1(
            liveGeometry,
            this.#brushPostStrokeCorrectionAmount,
          );
          const firstCorrected = correctedGeometry[0];
          if (firstCorrected !== undefined) {
            const correctedBuilder = createBrush();
            correctedBuilder.beginConfirmed(firstCorrected);
            correctedBuilder.appendConfirmed(correctedGeometry.slice(1));
""",
    """          const liveGeometry = this.#activeSamples.map((sample) => {
            const point = replayStabilizer.push(sample);
            return Object.freeze({
              ...point,
              pressure: completed.source === 'pen' ? sample.pressure : 1,
            });
          });
          const rawEndpoint = this.#activeSamples.at(-1);
          if (rawEndpoint !== undefined) {
            const releasePoint = replayStabilizer.release(rawEndpoint);
            if (releasePoint !== null) {
              liveGeometry.push(
                Object.freeze({
                  ...releasePoint,
                  pressure: completed.source === 'pen' ? rawEndpoint.pressure : 1,
                }),
              );
            }
          }
          const correctedGeometry = correctPostStrokeGeometryV1(
            liveGeometry,
            this.#brushPostStrokeCorrectionAmount,
          );
          const correctedSamples = correctedGeometry.map((point, index) =>
            Object.freeze({
              ...point,
              pressure: liveGeometry[index]?.pressure ?? 1,
            }),
          );
          const firstCorrected = correctedSamples[0];
          if (firstCorrected !== undefined) {
            const correctedBuilder = createBrush();
            correctedBuilder.beginConfirmed(firstCorrected);
            correctedBuilder.appendConfirmed(correctedSamples.slice(1));
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """    const stabilizedSamples = samples.map((sample) => stabilizer.push(sample));
""",
    """    const stabilizedSamples = samples.map((sample) => {
      const point = stabilizer.push(sample);
      return Object.freeze({ ...point, pressure: source === 'pen' ? sample.pressure : 1 });
    });
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """        forceStartTaper: this.#brushForceStartTaper,
        forceEndTaper: this.#brushForceEndTaper,
        hardness: this.#brushHardness,
""",
    """        forceStartTaper: this.#brushForceStartTaper,
        forceEndTaper: this.#brushForceEndTaper,
        pressureSizeEnabled: this.#brushPressureSizeEnabled,
        hardness: this.#brushHardness,
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """    const stabilizedAdditions = additions.map((sample) => stabilizer.push(sample));
""",
    """    const stabilizedAdditions = additions.map((sample) => {
      const point = stabilizer.push(sample);
      return Object.freeze({ ...point, pressure: active.source === 'pen' ? sample.pressure : 1 });
    });
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """        if (releasePoint !== null) {
          this.#queueActiveDabDelta(builder.appendConfirmed([releasePoint]));
        }
""",
    """        if (releasePoint !== null) {
          this.#queueActiveDabDelta(
            builder.appendConfirmed([
              Object.freeze({
                ...releasePoint,
                pressure: active.source === 'pen' ? rawEndpoint.pressure : 1,
              }),
            ]),
          );
        }
""",
)

# Preset library/controller/UI.
replace_once(
    'src/app/brush-preset-library.ts',
    """  withBrushTextureBlendModeV1,
  withBrushStrokeSpacingV1,
""",
    """  withBrushTextureBlendModeV1,
  withBrushPressureSizeEnabledV1,
  withBrushStrokeSpacingV1,
""",
)
insert_before(
    'src/app/brush-preset-library.ts',
    'export function updateBrushPresetCustomTipV1(',
    """export function updateBrushPresetPressureSizeV1(
  state: BrushPresetLibraryStateV1,
  presetId: string,
  enabled: boolean,
): BrushPresetLibraryStateV1 {
  return updateItemV1(state, presetId, (item) => {
    if (item.locked) throw new Error('locked brush preset cannot be edited');
    const current = withBrushPressureSizeEnabledV1(item.preset, enabled);
    if (JSON.stringify(current) === JSON.stringify(item.preset)) return item;
    const next = normalizeBrushPresetV1({ ...current, revision: item.preset.revision + 1 });
    return itemV1({
      source: item.source,
      baseline: item.baseline,
      preset: next,
      locked: item.locked,
    });
  });
}""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  brushTextureBlendModeV1,
  BUILTIN_BRUSH_GRAIN_RESOURCES_V1,
""",
    """  brushTextureBlendModeV1,
  brushPressureSizeEnabledV1,
  BUILTIN_BRUSH_GRAIN_RESOURCES_V1,
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  updateBrushPresetTextureBlendModeV1,
  updateBrushPresetSpacingV1,
""",
    """  updateBrushPresetTextureBlendModeV1,
  updateBrushPresetPressureSizeV1,
  updateBrushPresetSpacingV1,
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  const textureBlendMode = requireElement('#brush-texture-blend-mode', HTMLSelectElement);
  const tipShape = requireElement('#brush-tip-shape', HTMLSelectElement);
""",
    """  const textureBlendMode = requireElement('#brush-texture-blend-mode', HTMLSelectElement);
  const pressureSizeButton = requireElement('#brush-pressure-size', HTMLButtonElement);
  const tipShape = requireElement('#brush-tip-shape', HTMLSelectElement);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    const textureBlend = brushTextureBlendModeV1(item.preset);
    input.paintSession.setBrushTextureBlendMode(textureBlend);
    const tipAssets = brushTipAssetsV1(item.preset);
""",
    """    const textureBlend = brushTextureBlendModeV1(item.preset);
    input.paintSession.setBrushTextureBlendMode(textureBlend);
    const pressureSizeEnabled = brushPressureSizeEnabledV1(item.preset);
    input.paintSession.setBrushPressureSizeEnabled(pressureSizeEnabled);
    const tipAssets = brushTipAssetsV1(item.preset);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    input.root.dataset.illustroBrushTextureBlendMode = textureBlend;
    input.root.dataset.illustroBrushTipShape = brushTipShapeV1(item.preset);
""",
    """    input.root.dataset.illustroBrushTextureBlendMode = textureBlend;
    input.root.dataset.illustroBrushPressureSize = String(pressureSizeEnabled);
    input.root.dataset.illustroBrushTipShape = brushTipShapeV1(item.preset);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    const textureBlend = brushTextureBlendModeV1(selected.preset);
    textureBlendMode.value = textureBlend;
    tipShape.value = brushTipShapeV1(selected.preset);
""",
    """    const textureBlend = brushTextureBlendModeV1(selected.preset);
    textureBlendMode.value = textureBlend;
    const pressureSizeEnabled = brushPressureSizeEnabledV1(selected.preset);
    pressureSizeButton.textContent = pressureSizeEnabled ? 'ON' : 'OFF';
    pressureSizeButton.setAttribute('aria-pressed', String(pressureSizeEnabled));
    tipShape.value = brushTipShapeV1(selected.preset);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    const textureBlendLabel = textureBlend === 'multiply' ? '' : ` · TexBlend:${textureBlend}`;
    propertyStatus.textContent = `${parameters.sizePx.toFixed(1)} px · ${Math.round(parameters.opacity * 100)}% · ${Math.round(parameters.flow * 100)}% · H${Math.round(hardness * 100)}% · D${Math.round(tipDensity * 100)}% · S${Math.round(spacing.spacingRatio * 100)}% · A${Math.round(tipAngleDegrees)}° · F${Math.round(tipDirectionDegrees)}°${followRotation ? ' · Follow' : ''}${repeatLabel}${startLabel}${endLabel}${sizeTaperLabel}${opacityTaperLabel}${forcedTaperLabel}${stabilizationLabel}${postCorrectionLabel}${grainLabel}${paperLabel}${textureStrengthLabel}${textureScaleLabel}${textureRotationLabel}${textureBlendLabel}`;
""",
    """    const textureBlendLabel = textureBlend === 'multiply' ? '' : ` · TexBlend:${textureBlend}`;
    const pressureSizeLabel = pressureSizeEnabled ? ' · P→Size' : '';
    propertyStatus.textContent = `${parameters.sizePx.toFixed(1)} px · ${Math.round(parameters.opacity * 100)}% · ${Math.round(parameters.flow * 100)}% · H${Math.round(hardness * 100)}% · D${Math.round(tipDensity * 100)}% · S${Math.round(spacing.spacingRatio * 100)}% · A${Math.round(tipAngleDegrees)}° · F${Math.round(tipDirectionDegrees)}°${followRotation ? ' · Follow' : ''}${repeatLabel}${startLabel}${endLabel}${sizeTaperLabel}${opacityTaperLabel}${forcedTaperLabel}${stabilizationLabel}${postCorrectionLabel}${grainLabel}${paperLabel}${textureStrengthLabel}${textureScaleLabel}${textureRotationLabel}${textureBlendLabel}${pressureSizeLabel}`;
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """      textureBlendMode,
      tipShape,
""",
    """      textureBlendMode,
      pressureSizeButton,
      tipShape,
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  const onTextureBlendMode = (): void => {
    const blendMode: BrushTextureBlendModeV1 =
      textureBlendMode.value === 'subtract'
        ? 'subtract'
        : textureBlendMode.value === 'add'
          ? 'add'
          : 'multiply';
    mutate(() => updateBrushPresetTextureBlendModeV1(state, state.selectedPresetId, blendMode));
  };
  const onTipShape = (): void => {
""",
    """  const onTextureBlendMode = (): void => {
    const blendMode: BrushTextureBlendModeV1 =
      textureBlendMode.value === 'subtract'
        ? 'subtract'
        : textureBlendMode.value === 'add'
          ? 'add'
          : 'multiply';
    mutate(() => updateBrushPresetTextureBlendModeV1(state, state.selectedPresetId, blendMode));
  };
  const onPressureSize = (): void =>
    mutate(() =>
      updateBrushPresetPressureSizeV1(
        state,
        state.selectedPresetId,
        !brushPressureSizeEnabledV1(selectedBrushPresetItemV1(state).preset),
      ),
    );
  const onTipShape = (): void => {
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  textureBlendMode.addEventListener('change', onTextureBlendMode);
  tipShape.addEventListener('change', onTipShape);
""",
    """  textureBlendMode.addEventListener('change', onTextureBlendMode);
  pressureSizeButton.addEventListener('click', onPressureSize);
  tipShape.addEventListener('change', onTipShape);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """      textureBlendMode.removeEventListener('change', onTextureBlendMode);
      tipShape.removeEventListener('change', onTipShape);
""",
    """      textureBlendMode.removeEventListener('change', onTextureBlendMode);
      pressureSizeButton.removeEventListener('click', onPressureSize);
      tipShape.removeEventListener('change', onTipShape);
""",
)

replace_once(
    'src/index.html',
    """              <div class=\"shell-brush-property-row shell-brush-tip-property-row\">
                <label for=\"brush-texture-blend-mode\">テクスチャ合成</label>
                <select id=\"brush-texture-blend-mode\" aria-label=\"ブラシテクスチャ合成方法\">
                  <option value=\"multiply\">乗算</option>
                  <option value=\"subtract\">減算</option>
                  <option value=\"add\">加算</option>
                </select>
                <span class=\"shell-brush-tip-kind\">Coverage</span>
              </div>
              <div class=\"shell-brush-property-row shell-brush-tip-property-row\">
                <label for=\"brush-tip-shape\">ブラシ形状</label>
""",
    """              <div class=\"shell-brush-property-row shell-brush-tip-property-row\">
                <label for=\"brush-texture-blend-mode\">テクスチャ合成</label>
                <select id=\"brush-texture-blend-mode\" aria-label=\"ブラシテクスチャ合成方法\">
                  <option value=\"multiply\">乗算</option>
                  <option value=\"subtract\">減算</option>
                  <option value=\"add\">加算</option>
                </select>
                <span class=\"shell-brush-tip-kind\">Coverage</span>
              </div>
              <div class=\"shell-brush-property-row shell-brush-tip-property-row\">
                <label for=\"brush-pressure-size\">筆圧→サイズ</label>
                <button id=\"brush-pressure-size\" type=\"button\" aria-pressed=\"false\" title=\"ペン筆圧をブラシサイズへ反映\">OFF</button>
                <span class=\"shell-brush-tip-kind\">Pressure</span>
              </div>
              <div class=\"shell-brush-property-row shell-brush-tip-property-row\">
                <label for=\"brush-tip-shape\">ブラシ形状</label>
""",
)

write_new(
    'tests/unit/brush-pressure-size.test.ts',
    """import { describe, expect, it } from 'vitest';
import {
  brushPressureSizeEnabledV1,
  createBaselineBrushPresetV1,
  withBrushPressureSizeEnabledV1,
} from '../../src/domain/brush-schema.js';
import { CanonicalRasterBrushStrokeV1 } from '../../src/app/canonical-raster-brush.js';
import { BaselineBrushDabBuilderV1 } from '../../src/gpu/baseline-brush.js';
import { PaintSessionControllerV1 } from '../../src/app/paint-session-controller.js';

class FakeRendererDocumentPort {
  async configureDocument(): Promise<void> {}
  async restoreBaselineStrokes(): Promise<void> {}
  async applyBaselineTilePatches(): Promise<void> {}
}

describe('M6A-041 pressure to size', () => {
  it('is opt-in in preset data and keeps the legacy default disabled', () => {
    const preset = createBaselineBrushPresetV1({
      id: 'pressure.size',
      name: 'Pressure Size',
      category: 'Test',
      behavior: 'paint',
    });
    expect(brushPressureSizeEnabledV1(preset)).toBe(false);
    expect(brushPressureSizeEnabledV1(withBrushPressureSizeEnabledV1(preset, true))).toBe(true);
    expect(withBrushPressureSizeEnabledV1(preset, false).dynamics.pressureSizeEnabled).toBeUndefined();
  });

  it('linearly interpolates pressure at logical stamp positions and resolves it into radius', () => {
    const builder = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      spacingRatio: 0.25,
      minimumStampDistancePx: 1,
      pressureSizeEnabled: true,
    });
    builder.beginDelta({ documentX: 0, documentY: 0, pressure: 0.25 });
    builder.appendDelta([{ documentX: 10, documentY: 0, pressure: 1 }]);
    const dabs = builder.dabs();
    expect(dabs.map((dab) => dab.x)).toEqual([0, 5, 10]);
    expect(dabs.map((dab) => dab.radius)).toEqual([2.5, 6.25, 10]);
  });

  it('ignores sample pressure when the mapping is disabled', () => {
    const builder = new BaselineBrushDabBuilderV1({ sizePx: 20, pressureSizeEnabled: false });
    const [dab] = builder.beginDelta({ documentX: 2, documentY: 3, pressure: 0.1 });
    expect(dab?.radius).toBe(10);
  });

  it('forwards pressure through the canonical facade and captures the runtime flag', () => {
    const stroke = new CanonicalRasterBrushStrokeV1({ sizePx: 20, pressureSizeEnabled: true });
    const [dab] = stroke.beginConfirmed({ documentX: 1, documentY: 1, pressure: 0.4 });
    expect(dab?.radius).toBe(4);

    const session = new PaintSessionControllerV1(new FakeRendererDocumentPort());
    expect(session.setBrushPressureSizeEnabled(true)).toBe(true);
    expect(session.snapshot().brushPressureSizeEnabled).toBe(true);
  });
});""",
)

insert_before(
    'scripts/verify-m6a-brush.mjs',
    "requireText(\n  progress,\n  'M6A-PERF-001 incremental active-stroke rendering（stable prefix + bounded mutable tail）:未完了',",
    """requireText(progress, 'M6A-041 pressure→size:完了', 'M6A-041 progress is not complete');
requireText(
  read('src/domain/brush-schema.ts'),
  'brushPressureSizeEnabledV1',
  'pressure-size preset helper missing',
);
requireText(
  read('src/gpu/baseline-brush.ts'),
  'cursorPressure += (pressure - cursorPressure) * ratio',
  'pressure is not interpolated at logical stamp positions',
);
requireText(
  read('src/gpu/baseline-brush.ts'),
  'this.#radius * sizeScale * pressureSizeScale',
  'pressure is not resolved into dab radius',
);
requireText(
  read('src/app/paint-session-controller.ts'),
  "pressure: source === 'pen' ? sample.pressure : 1",
  'paint session does not preserve pen pressure into stabilized geometry',
);
requireText(
  read('src/index.html'),
  'id=\"brush-pressure-size\"',
  'reachable pressure-size control missing',
);
requireText(
  read('tests/unit/brush-pressure-size.test.ts'),
  'linearly interpolates pressure at logical stamp positions',
  'pressure-size interpolation regression missing',
);""",
)

replace_once(
    'IMPLEMENTATION_PROGRESS.md',
    'M6A-041 pressure→size:未完了\nM6A-042 pressure→opacity:未完了',
    """M6A-041 pressure→size:完了
再開メモ: M6A-041 pressure→sizeはBrushPresetV1.dynamics.pressureSizeEnabledをopt-in booleanとして追加し、既定falseで既存strokeを完全互換にした。有効時はPenの保存済みraw pressure 0..1をstabilized geometryへ対応付け、logical stamp位置で距離比例補間してbase radius × taper size scale × pressureへ解決する。Mouseはpressure対応入力ではないためsize mapping上は1.0扱い。primitive dabには解決済みradiusだけを保存し、新しいdab/history schemaは増やさない。post-stroke correction再構築でも補正前geometry indexに対応するpressureを維持する。M6A-044 curveとM6A-049/050 min/maxはこのlinear 0..1基礎経路を後から拡張し、M6A-032 forced taperのzero endpointを打ち消してはならない。次はM6A-042 pressure→opacityから再開する。
M6A-042 pressure→opacity:未完了""",
)
append_once(
    'ILLUSTRO_DESIGN_MEMO.md',
    '#### M6A pressure-to-size boundary — 2026-09-03',
    """#### M6A pressure-to-size boundary — 2026-09-03

- M6A-041 introduces an opt-in `dynamics.pressureSizeEnabled` mapping. The default is `false`, preserving all existing brush sizes and legacy/recovered stroke behavior.
- Pen pressure is the already-canonical `PaintStrokeSampleV1.pressure` in `0..1`. Real-time stabilization changes only position; the raw pressure paired with each confirmed sample is forwarded alongside stabilized coordinates. Mouse input is treated as full pressure (`1`) for this mapping because mouse contact has no meaningful stylus-pressure semantics.
- Pressure is linearly interpolated by path distance at logical stamp positions. When enabled, resolved radius is `base radius × taper size scale × pressure`; when disabled pressure is ignored. Primitive dabs persist only the resolved radius, so Worker/history/persistence do not gain a competing pressure schema.
- Post-stroke correction keeps pressure associated by sample index while correcting only geometry, then rebuilds final dabs from corrected coordinates plus the same pressure sequence.
- M6A-044 owns pressure response curves and M6A-049/050 own later response bounds. They must extend this pressure resolver rather than duplicate the stamp path. Forced taper zero endpoints remain authoritative and cannot be raised by pressure dynamics.""",
)
