from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    if old not in text:
        raise RuntimeError(f"anchor not found in {path}: {old[:180]!r}")
    file.write_text(text.replace(old, new, 1))


# Domain schema: target-level minimum response clamps. Default 0 preserves all existing brushes.
replace_once(
    'src/domain/brush-schema.ts',
    "export type BrushTipSelectionModeV1 = 'fixed' | 'sequence' | 'random-per-stamp';",
    """export const DEFAULT_BRUSH_SIZE_MINIMUM_RESPONSE_V1 = 0 as const;
export const DEFAULT_BRUSH_OPACITY_MINIMUM_RESPONSE_V1 = 0 as const;
export const DEFAULT_BRUSH_FLOW_MINIMUM_RESPONSE_V1 = 0 as const;

function brushMinimumResponseValueV1(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1 ? value : 0;
}

function requireBrushMinimumResponseV1(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError(`brush ${label} minimum response must be within 0..1`);
  }
  return Object.is(value, -0) ? 0 : value;
}

export function brushSizeMinimumResponseV1(preset: BrushPresetV1): number {
  return brushMinimumResponseValueV1(preset.dynamics.sizeMinimumResponse);
}

export function withBrushSizeMinimumResponseV1(
  preset: BrushPresetV1,
  minimumResponse: number,
): BrushPresetV1 {
  const normalized = requireBrushMinimumResponseV1(minimumResponse, 'size');
  if (normalized === DEFAULT_BRUSH_SIZE_MINIMUM_RESPONSE_V1) {
    const { sizeMinimumResponse: _sizeMinimumResponse, ...dynamics } = preset.dynamics;
    return normalizeBrushPresetV1({ ...preset, dynamics });
  }
  return normalizeBrushPresetV1({
    ...preset,
    dynamics: { ...preset.dynamics, sizeMinimumResponse: normalized },
  });
}

export function brushOpacityMinimumResponseV1(preset: BrushPresetV1): number {
  return brushMinimumResponseValueV1(preset.dynamics.opacityMinimumResponse);
}

export function withBrushOpacityMinimumResponseV1(
  preset: BrushPresetV1,
  minimumResponse: number,
): BrushPresetV1 {
  const normalized = requireBrushMinimumResponseV1(minimumResponse, 'opacity');
  if (normalized === DEFAULT_BRUSH_OPACITY_MINIMUM_RESPONSE_V1) {
    const { opacityMinimumResponse: _opacityMinimumResponse, ...dynamics } = preset.dynamics;
    return normalizeBrushPresetV1({ ...preset, dynamics });
  }
  return normalizeBrushPresetV1({
    ...preset,
    dynamics: { ...preset.dynamics, opacityMinimumResponse: normalized },
  });
}

export function brushFlowMinimumResponseV1(preset: BrushPresetV1): number {
  return brushMinimumResponseValueV1(preset.dynamics.flowMinimumResponse);
}

export function withBrushFlowMinimumResponseV1(
  preset: BrushPresetV1,
  minimumResponse: number,
): BrushPresetV1 {
  const normalized = requireBrushMinimumResponseV1(minimumResponse, 'flow');
  if (normalized === DEFAULT_BRUSH_FLOW_MINIMUM_RESPONSE_V1) {
    const { flowMinimumResponse: _flowMinimumResponse, ...dynamics } = preset.dynamics;
    return normalizeBrushPresetV1({ ...preset, dynamics });
  }
  return normalizeBrushPresetV1({
    ...preset,
    dynamics: { ...preset.dynamics, flowMinimumResponse: normalized },
  });
}

export type BrushTipSelectionModeV1 = 'fixed' | 'sequence' | 'random-per-stamp';""",
)

# Low-level deterministic kernel.
replace_once(
    'src/gpu/baseline-brush.ts',
    "  readonly #randomResponseCurve: CompiledResponseCurveV1;\n  readonly #randomSeed: number;",
    """  readonly #randomResponseCurve: CompiledResponseCurveV1;
  readonly #sizeMinimumResponse: number;
  readonly #opacityMinimumResponse: number;
  readonly #flowMinimumResponse: number;
  readonly #randomSeed: number;""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    "      readonly randomResponseCurve?: readonly ResponseCurvePointV1[];\n      readonly randomSeed?: number;",
    """      readonly randomResponseCurve?: readonly ResponseCurvePointV1[];
      readonly sizeMinimumResponse?: number;
      readonly opacityMinimumResponse?: number;
      readonly flowMinimumResponse?: number;
      readonly randomSeed?: number;""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    "    const randomFlowEnabled = options.randomFlowEnabled ?? false;\n    const randomSeed = options.randomSeed ?? 0;",
    """    const randomFlowEnabled = options.randomFlowEnabled ?? false;
    const sizeMinimumResponse = options.sizeMinimumResponse ?? 0;
    const opacityMinimumResponse = options.opacityMinimumResponse ?? 0;
    const flowMinimumResponse = options.flowMinimumResponse ?? 0;
    const randomSeed = options.randomSeed ?? 0;""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    "    if (!Number.isSafeInteger(randomSeed) || randomSeed < 0 || randomSeed > 0xffffffff) {\n      throw new RangeError('baseline brush random seed must be uint32');\n    }",
    """    if (
      !Number.isFinite(sizeMinimumResponse) ||
      sizeMinimumResponse < 0 ||
      sizeMinimumResponse > 1 ||
      !Number.isFinite(opacityMinimumResponse) ||
      opacityMinimumResponse < 0 ||
      opacityMinimumResponse > 1 ||
      !Number.isFinite(flowMinimumResponse) ||
      flowMinimumResponse < 0 ||
      flowMinimumResponse > 1
    ) {
      throw new RangeError('baseline brush minimum responses must be within 0..1');
    }
    if (!Number.isSafeInteger(randomSeed) || randomSeed < 0 || randomSeed > 0xffffffff) {
      throw new RangeError('baseline brush random seed must be uint32');
    }""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    "    this.#randomResponseCurve = compileResponseCurveV1(\n      options.randomResponseCurve ?? [\n        { input: 0, output: 0 },\n        { input: 1, output: 1 },\n      ],\n    );\n    this.#randomSeed = randomSeed >>> 0;",
    """    this.#randomResponseCurve = compileResponseCurveV1(
      options.randomResponseCurve ?? [
        { input: 0, output: 0 },
        { input: 1, output: 1 },
      ],
    );
    this.#sizeMinimumResponse = sizeMinimumResponse;
    this.#opacityMinimumResponse = opacityMinimumResponse;
    this.#flowMinimumResponse = flowMinimumResponse;
    this.#randomSeed = randomSeed >>> 0;""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """    const randomSizeScale = this.#randomSizeEnabled ? randomResponse : 1;
    const randomOpacityScale = this.#randomOpacityEnabled ? randomResponse : 1;
    const randomFlowScale = this.#randomFlowEnabled ? randomResponse : 1;
    if (
      sizeScale <= 0 ||
      opacityScale <= 0 ||
      pressureSizeScale <= 0 ||
      pressureOpacityScale <= 0 ||
      pressureFlowScale <= 0 ||
      tiltSizeScale <= 0 ||
      tiltOpacityScale <= 0 ||
      tiltFlowScale <= 0 ||
      velocitySizeScale <= 0 ||
      velocityOpacityScale <= 0 ||
      velocityFlowScale <= 0 ||
      randomSizeScale <= 0 ||
      randomOpacityScale <= 0 ||
      randomFlowScale <= 0
    ) {
      return;
    }
    pushBaselineBrushStampV1(
      target,
      stamp.x,
      stamp.y,
      this.#radius *
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
        randomOpacityScale,""",
    """    const randomSizeScale = this.#randomSizeEnabled ? randomResponse : 1;
    const randomOpacityScale = this.#randomOpacityEnabled ? randomResponse : 1;
    const randomFlowScale = this.#randomFlowEnabled ? randomResponse : 1;
    const sizeResponse = Math.max(
      this.#sizeMinimumResponse,
      pressureSizeScale * tiltSizeScale * velocitySizeScale * randomSizeScale,
    );
    const opacityResponse = Math.max(
      this.#opacityMinimumResponse,
      pressureOpacityScale * tiltOpacityScale * velocityOpacityScale * randomOpacityScale,
    );
    const flowResponse = Math.max(
      this.#flowMinimumResponse,
      pressureFlowScale * tiltFlowScale * velocityFlowScale * randomFlowScale,
    );
    if (
      sizeScale <= 0 ||
      opacityScale <= 0 ||
      sizeResponse <= 0 ||
      opacityResponse <= 0 ||
      flowResponse <= 0
    ) {
      return;
    }
    pushBaselineBrushStampV1(
      target,
      stamp.x,
      stamp.y,
      this.#radius * sizeScale * sizeResponse,
      this.#flow * opacityScale * flowResponse,
      this.#strokeOpacity * opacityResponse,""",
)

# Canonical facade forwards the target clamp configuration.
replace_once(
    'src/app/canonical-raster-brush.ts',
    "      readonly randomResponseCurve?: readonly ResponseCurvePointV1[];\n      readonly randomSeed?: number;",
    """      readonly randomResponseCurve?: readonly ResponseCurvePointV1[];
      readonly sizeMinimumResponse?: number;
      readonly opacityMinimumResponse?: number;
      readonly flowMinimumResponse?: number;
      readonly randomSeed?: number;""",
)
replace_once(
    'src/app/canonical-raster-brush.ts',
    "      ...(options.randomResponseCurve === undefined\n        ? {}\n        : { randomResponseCurve: options.randomResponseCurve }),\n      ...(options.randomSeed === undefined ? {} : { randomSeed: options.randomSeed }),",
    """      ...(options.randomResponseCurve === undefined
        ? {}
        : { randomResponseCurve: options.randomResponseCurve }),
      ...(options.sizeMinimumResponse === undefined
        ? {}
        : { sizeMinimumResponse: options.sizeMinimumResponse }),
      ...(options.opacityMinimumResponse === undefined
        ? {}
        : { opacityMinimumResponse: options.opacityMinimumResponse }),
      ...(options.flowMinimumResponse === undefined
        ? {}
        : { flowMinimumResponse: options.flowMinimumResponse }),
      ...(options.randomSeed === undefined ? {} : { randomSeed: options.randomSeed }),""",
)

# Paint session captures minima at stroke start and exposes runtime state.
replace_once(
    'src/app/paint-session-controller.ts',
    "  readonly brushRandomResponseCurve: readonly ResponseCurvePointV1[];\n  readonly brushTipAngleDegrees: number;",
    """  readonly brushRandomResponseCurve: readonly ResponseCurvePointV1[];
  readonly brushSizeMinimumResponse: number;
  readonly brushOpacityMinimumResponse: number;
  readonly brushFlowMinimumResponse: number;
  readonly brushTipAngleDegrees: number;""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    "  #brushRandomResponseCurve: readonly ResponseCurvePointV1[] = LINEAR_RESPONSE_CURVE_V1;\n  #brushTipAngleDegrees: number = BASELINE_BRUSH_TIP_ANGLE_DEGREES;",
    """  #brushRandomResponseCurve: readonly ResponseCurvePointV1[] = LINEAR_RESPONSE_CURVE_V1;
  #brushSizeMinimumResponse = 0;
  #brushOpacityMinimumResponse = 0;
  #brushFlowMinimumResponse = 0;
  #brushTipAngleDegrees: number = BASELINE_BRUSH_TIP_ANGLE_DEGREES;""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    "      brushRandomResponseCurve: this.#brushRandomResponseCurve,\n      brushTipAngleDegrees: this.#brushTipAngleDegrees,",
    """      brushRandomResponseCurve: this.#brushRandomResponseCurve,
      brushSizeMinimumResponse: this.#brushSizeMinimumResponse,
      brushOpacityMinimumResponse: this.#brushOpacityMinimumResponse,
      brushFlowMinimumResponse: this.#brushFlowMinimumResponse,
      brushTipAngleDegrees: this.#brushTipAngleDegrees,""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """  brushRandomResponseCurve(): readonly ResponseCurvePointV1[] {
    return this.#brushRandomResponseCurve;
  }

  setBrushTipAngleDegrees(angleDegrees: number): number {""",
    """  brushRandomResponseCurve(): readonly ResponseCurvePointV1[] {
    return this.#brushRandomResponseCurve;
  }

  setBrushSizeMinimumResponse(minimumResponse: number): number {
    if (!Number.isFinite(minimumResponse) || minimumResponse < 0 || minimumResponse > 1) {
      throw new RangeError('invalid runtime size minimum response');
    }
    if (minimumResponse !== this.#brushSizeMinimumResponse) this.#clearActiveStroke();
    this.#brushSizeMinimumResponse = minimumResponse;
    return this.#brushSizeMinimumResponse;
  }

  brushSizeMinimumResponse(): number {
    return this.#brushSizeMinimumResponse;
  }

  setBrushOpacityMinimumResponse(minimumResponse: number): number {
    if (!Number.isFinite(minimumResponse) || minimumResponse < 0 || minimumResponse > 1) {
      throw new RangeError('invalid runtime opacity minimum response');
    }
    if (minimumResponse !== this.#brushOpacityMinimumResponse) this.#clearActiveStroke();
    this.#brushOpacityMinimumResponse = minimumResponse;
    return this.#brushOpacityMinimumResponse;
  }

  brushOpacityMinimumResponse(): number {
    return this.#brushOpacityMinimumResponse;
  }

  setBrushFlowMinimumResponse(minimumResponse: number): number {
    if (!Number.isFinite(minimumResponse) || minimumResponse < 0 || minimumResponse > 1) {
      throw new RangeError('invalid runtime flow minimum response');
    }
    if (minimumResponse !== this.#brushFlowMinimumResponse) this.#clearActiveStroke();
    this.#brushFlowMinimumResponse = minimumResponse;
    return this.#brushFlowMinimumResponse;
  }

  brushFlowMinimumResponse(): number {
    return this.#brushFlowMinimumResponse;
  }

  setBrushTipAngleDegrees(angleDegrees: number): number {""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """        randomFlowEnabled: this.#brushRandomFlowEnabled,
        randomResponseCurve: this.#brushRandomResponseCurve,
        randomSeed: randomSeed ?? 0,""",
    """        randomFlowEnabled: this.#brushRandomFlowEnabled,
        randomResponseCurve: this.#brushRandomResponseCurve,
        sizeMinimumResponse: this.#brushSizeMinimumResponse,
        opacityMinimumResponse: this.#brushOpacityMinimumResponse,
        flowMinimumResponse: this.#brushFlowMinimumResponse,
        randomSeed: randomSeed ?? 0,""",
)

# Preset library mutation APIs.
replace_once(
    'src/app/brush-preset-library.ts',
    "  withBrushRandomResponseCurveV1,\n  withBrushStrokeSpacingV1,",
    """  withBrushRandomResponseCurveV1,
  withBrushSizeMinimumResponseV1,
  withBrushOpacityMinimumResponseV1,
  withBrushFlowMinimumResponseV1,
  withBrushStrokeSpacingV1,""",
)
replace_once(
    'src/app/brush-preset-library.ts',
    """export function updateBrushPresetCustomTipV1(
  state: BrushPresetLibraryStateV1,""",
    """export function updateBrushPresetSizeMinimumResponseV1(
  state: BrushPresetLibraryStateV1,
  presetId: string,
  minimumResponse: number,
): BrushPresetLibraryStateV1 {
  return updateItemV1(state, presetId, (item) => {
    if (item.locked) throw new Error('locked brush preset cannot be edited');
    const current = withBrushSizeMinimumResponseV1(item.preset, minimumResponse);
    if (JSON.stringify(current) === JSON.stringify(item.preset)) return item;
    const next = normalizeBrushPresetV1({ ...current, revision: item.preset.revision + 1 });
    return itemV1({ source: item.source, baseline: item.baseline, preset: next, locked: item.locked });
  });
}

export function updateBrushPresetOpacityMinimumResponseV1(
  state: BrushPresetLibraryStateV1,
  presetId: string,
  minimumResponse: number,
): BrushPresetLibraryStateV1 {
  return updateItemV1(state, presetId, (item) => {
    if (item.locked) throw new Error('locked brush preset cannot be edited');
    const current = withBrushOpacityMinimumResponseV1(item.preset, minimumResponse);
    if (JSON.stringify(current) === JSON.stringify(item.preset)) return item;
    const next = normalizeBrushPresetV1({ ...current, revision: item.preset.revision + 1 });
    return itemV1({ source: item.source, baseline: item.baseline, preset: next, locked: item.locked });
  });
}

export function updateBrushPresetFlowMinimumResponseV1(
  state: BrushPresetLibraryStateV1,
  presetId: string,
  minimumResponse: number,
): BrushPresetLibraryStateV1 {
  return updateItemV1(state, presetId, (item) => {
    if (item.locked) throw new Error('locked brush preset cannot be edited');
    const current = withBrushFlowMinimumResponseV1(item.preset, minimumResponse);
    if (JSON.stringify(current) === JSON.stringify(item.preset)) return item;
    const next = normalizeBrushPresetV1({ ...current, revision: item.preset.revision + 1 });
    return itemV1({ source: item.source, baseline: item.baseline, preset: next, locked: item.locked });
  });
}

export function updateBrushPresetCustomTipV1(
  state: BrushPresetLibraryStateV1,""",
)

# Brush Properties UI controller.
replace_once(
    'src/app/brush-preset-controller.ts',
    "  brushRandomResponseCurveV1,\n  BUILTIN_BRUSH_GRAIN_RESOURCES_V1,",
    """  brushRandomResponseCurveV1,
  brushSizeMinimumResponseV1,
  brushOpacityMinimumResponseV1,
  brushFlowMinimumResponseV1,
  BUILTIN_BRUSH_GRAIN_RESOURCES_V1,""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    "  updateBrushPresetRandomResponseCurveV1,\n  updateBrushPresetSpacingV1,",
    """  updateBrushPresetRandomResponseCurveV1,
  updateBrushPresetSizeMinimumResponseV1,
  updateBrushPresetOpacityMinimumResponseV1,
  updateBrushPresetFlowMinimumResponseV1,
  updateBrushPresetSpacingV1,""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    "  const randomCurveReset = requireElement('#brush-random-curve-reset', HTMLButtonElement);\n  const tipShape = requireElement('#brush-tip-shape', HTMLSelectElement);",
    """  const randomCurveReset = requireElement('#brush-random-curve-reset', HTMLButtonElement);
  const sizeMinimumResponseRange = requireElement('#brush-size-minimum-response-range', HTMLInputElement);
  const sizeMinimumResponseNumber = requireElement('#brush-size-minimum-response-number', HTMLInputElement);
  const opacityMinimumResponseRange = requireElement('#brush-opacity-minimum-response-range', HTMLInputElement);
  const opacityMinimumResponseNumber = requireElement('#brush-opacity-minimum-response-number', HTMLInputElement);
  const flowMinimumResponseRange = requireElement('#brush-flow-minimum-response-range', HTMLInputElement);
  const flowMinimumResponseNumber = requireElement('#brush-flow-minimum-response-number', HTMLInputElement);
  const tipShape = requireElement('#brush-tip-shape', HTMLSelectElement);""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    const randomResponseCurve = brushRandomResponseCurveV1(item.preset);
    input.paintSession.setBrushRandomResponseCurve(randomResponseCurve);
    const tipAssets = brushTipAssetsV1(item.preset);""",
    """    const randomResponseCurve = brushRandomResponseCurveV1(item.preset);
    input.paintSession.setBrushRandomResponseCurve(randomResponseCurve);
    const sizeMinimumResponse = brushSizeMinimumResponseV1(item.preset);
    input.paintSession.setBrushSizeMinimumResponse(sizeMinimumResponse);
    const opacityMinimumResponse = brushOpacityMinimumResponseV1(item.preset);
    input.paintSession.setBrushOpacityMinimumResponse(opacityMinimumResponse);
    const flowMinimumResponse = brushFlowMinimumResponseV1(item.preset);
    input.paintSession.setBrushFlowMinimumResponse(flowMinimumResponse);
    const tipAssets = brushTipAssetsV1(item.preset);""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    input.root.dataset.illustroBrushRandomFlow = String(randomFlowEnabled);
    input.root.dataset.illustroBrushRandomCurvePoints = String(randomResponseCurve.length);
    input.root.dataset.illustroBrushTipShape = brushTipShapeV1(item.preset);""",
    """    input.root.dataset.illustroBrushRandomFlow = String(randomFlowEnabled);
    input.root.dataset.illustroBrushRandomCurvePoints = String(randomResponseCurve.length);
    input.root.dataset.illustroBrushSizeMinimumResponse = String(sizeMinimumResponse);
    input.root.dataset.illustroBrushOpacityMinimumResponse = String(opacityMinimumResponse);
    input.root.dataset.illustroBrushFlowMinimumResponse = String(flowMinimumResponse);
    input.root.dataset.illustroBrushTipShape = brushTipShapeV1(item.preset);""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    const randomResponseCurve = brushRandomResponseCurveV1(selected.preset);
    randomCurveEditor?.setCurve(randomResponseCurve);
    tipShape.value = brushTipShapeV1(selected.preset);""",
    """    const randomResponseCurve = brushRandomResponseCurveV1(selected.preset);
    randomCurveEditor?.setCurve(randomResponseCurve);
    const sizeMinimumResponse = brushSizeMinimumResponseV1(selected.preset);
    configurePair(sizeMinimumResponseRange, sizeMinimumResponseNumber, 0, 100, 1, sizeMinimumResponse * 100);
    const opacityMinimumResponse = brushOpacityMinimumResponseV1(selected.preset);
    configurePair(
      opacityMinimumResponseRange,
      opacityMinimumResponseNumber,
      0,
      100,
      1,
      opacityMinimumResponse * 100,
    );
    const flowMinimumResponse = brushFlowMinimumResponseV1(selected.preset);
    configurePair(flowMinimumResponseRange, flowMinimumResponseNumber, 0, 100, 1, flowMinimumResponse * 100);
    tipShape.value = brushTipShapeV1(selected.preset);""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    const randomCurveLabel = responseCurveIsLinearV1(randomResponseCurve) ? '' : ' · R-Curve';
    propertyStatus.textContent = `${parameters.sizePx.toFixed(1)} px""",
    """    const randomCurveLabel = responseCurveIsLinearV1(randomResponseCurve) ? '' : ' · R-Curve';
    const minimumResponseLabel = `${
      sizeMinimumResponse > 0 ? ` · DynSizeMin${Math.round(sizeMinimumResponse * 100)}%` : ''
    }${
      opacityMinimumResponse > 0 ? ` · DynOpacityMin${Math.round(opacityMinimumResponse * 100)}%` : ''
    }${flowMinimumResponse > 0 ? ` · DynFlowMin${Math.round(flowMinimumResponse * 100)}%` : ''}`;
    propertyStatus.textContent = `${parameters.sizePx.toFixed(1)} px""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    "${randomSizeLabel}${randomOpacityLabel}${randomFlowLabel}${randomCurveLabel}`;",
    "${randomSizeLabel}${randomOpacityLabel}${randomFlowLabel}${randomCurveLabel}${minimumResponseLabel}`;",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """      randomSizeButton,
      randomOpacityButton,
      randomFlowButton,
      tipShape,""",
    """      randomSizeButton,
      randomOpacityButton,
      randomFlowButton,
      sizeMinimumResponseRange,
      sizeMinimumResponseNumber,
      opacityMinimumResponseRange,
      opacityMinimumResponseNumber,
      flowMinimumResponseRange,
      flowMinimumResponseNumber,
      tipShape,""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  const onRandomFlow = (): void =>
    mutate(() =>
      updateBrushPresetRandomFlowV1(
        state,
        state.selectedPresetId,
        !brushRandomFlowEnabledV1(selectedBrushPresetItemV1(state).preset),
      ),
    );
  const onTipShape = (): void => {""",
    """  const onRandomFlow = (): void =>
    mutate(() =>
      updateBrushPresetRandomFlowV1(
        state,
        state.selectedPresetId,
        !brushRandomFlowEnabledV1(selectedBrushPresetItemV1(state).preset),
      ),
    );
  const updateSizeMinimumResponse = (valuePercent: number): void =>
    mutate(() =>
      updateBrushPresetSizeMinimumResponseV1(state, state.selectedPresetId, valuePercent / 100),
    );
  const updateOpacityMinimumResponse = (valuePercent: number): void =>
    mutate(() =>
      updateBrushPresetOpacityMinimumResponseV1(state, state.selectedPresetId, valuePercent / 100),
    );
  const updateFlowMinimumResponse = (valuePercent: number): void =>
    mutate(() =>
      updateBrushPresetFlowMinimumResponseV1(state, state.selectedPresetId, valuePercent / 100),
    );
  const onSizeMinimumResponseRange = (): void =>
    updateSizeMinimumResponse(Number(sizeMinimumResponseRange.value));
  const onSizeMinimumResponseNumber = (): void =>
    updateSizeMinimumResponse(Number(sizeMinimumResponseNumber.value));
  const onOpacityMinimumResponseRange = (): void =>
    updateOpacityMinimumResponse(Number(opacityMinimumResponseRange.value));
  const onOpacityMinimumResponseNumber = (): void =>
    updateOpacityMinimumResponse(Number(opacityMinimumResponseNumber.value));
  const onFlowMinimumResponseRange = (): void =>
    updateFlowMinimumResponse(Number(flowMinimumResponseRange.value));
  const onFlowMinimumResponseNumber = (): void =>
    updateFlowMinimumResponse(Number(flowMinimumResponseNumber.value));
  const onTipShape = (): void => {""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  randomSizeButton.addEventListener('click', onRandomSize);
  randomOpacityButton.addEventListener('click', onRandomOpacity);
  randomFlowButton.addEventListener('click', onRandomFlow);
  tipShape.addEventListener('change', onTipShape);""",
    """  randomSizeButton.addEventListener('click', onRandomSize);
  randomOpacityButton.addEventListener('click', onRandomOpacity);
  randomFlowButton.addEventListener('click', onRandomFlow);
  sizeMinimumResponseRange.addEventListener('input', onSizeMinimumResponseRange);
  sizeMinimumResponseNumber.addEventListener('change', onSizeMinimumResponseNumber);
  opacityMinimumResponseRange.addEventListener('input', onOpacityMinimumResponseRange);
  opacityMinimumResponseNumber.addEventListener('change', onOpacityMinimumResponseNumber);
  flowMinimumResponseRange.addEventListener('input', onFlowMinimumResponseRange);
  flowMinimumResponseNumber.addEventListener('change', onFlowMinimumResponseNumber);
  tipShape.addEventListener('change', onTipShape);""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """      randomSizeButton.removeEventListener('click', onRandomSize);
      randomOpacityButton.removeEventListener('click', onRandomOpacity);
      randomFlowButton.removeEventListener('click', onRandomFlow);
      pressureCurveEditor?.dispose();""",
    """      randomSizeButton.removeEventListener('click', onRandomSize);
      randomOpacityButton.removeEventListener('click', onRandomOpacity);
      randomFlowButton.removeEventListener('click', onRandomFlow);
      sizeMinimumResponseRange.removeEventListener('input', onSizeMinimumResponseRange);
      sizeMinimumResponseNumber.removeEventListener('change', onSizeMinimumResponseNumber);
      opacityMinimumResponseRange.removeEventListener('input', onOpacityMinimumResponseRange);
      opacityMinimumResponseNumber.removeEventListener('change', onOpacityMinimumResponseNumber);
      flowMinimumResponseRange.removeEventListener('input', onFlowMinimumResponseRange);
      flowMinimumResponseNumber.removeEventListener('change', onFlowMinimumResponseNumber);
      pressureCurveEditor?.dispose();""",
)

# Reachable compact UI controls.
replace_once(
    'src/index.html',
    """                  <button id="brush-random-curve-reset" type="button">Reset</button>
                </div>
              </div>
              <div class="shell-brush-property-row shell-brush-tip-property-row">
                <label for="brush-tip-shape">ブラシ形状</label>""",
    """                  <button id="brush-random-curve-reset" type="button">Reset</button>
                </div>
              </div>
              <div class="shell-brush-property-row">
                <label for="brush-size-minimum-response-range">動的サイズ下限</label>
                <input id="brush-size-minimum-response-range" type="range" min="0" max="100" step="1" value="0" />
                <span class="shell-brush-property-number shell-brush-property-percent"><input id="brush-size-minimum-response-number" type="number" inputmode="decimal" min="0" max="100" step="1" value="0" aria-label="動的サイズ最小レスポンス" /><span>%</span></span>
              </div>
              <div class="shell-brush-property-row">
                <label for="brush-opacity-minimum-response-range">動的不透明度下限</label>
                <input id="brush-opacity-minimum-response-range" type="range" min="0" max="100" step="1" value="0" />
                <span class="shell-brush-property-number shell-brush-property-percent"><input id="brush-opacity-minimum-response-number" type="number" inputmode="decimal" min="0" max="100" step="1" value="0" aria-label="動的不透明度最小レスポンス" /><span>%</span></span>
              </div>
              <div class="shell-brush-property-row">
                <label for="brush-flow-minimum-response-range">動的流量下限</label>
                <input id="brush-flow-minimum-response-range" type="range" min="0" max="100" step="1" value="0" />
                <span class="shell-brush-property-number shell-brush-property-percent"><input id="brush-flow-minimum-response-number" type="number" inputmode="decimal" min="0" max="100" step="1" value="0" aria-label="動的流量最小レスポンス" /><span>%</span></span>
              </div>
              <div class="shell-brush-property-row shell-brush-tip-property-row">
                <label for="brush-tip-shape">ブラシ形状</label>""",
)

# Focused regression coverage.
Path('tests/unit/brush-minimum-response.test.ts').write_text("""import { describe, expect, it } from 'vitest';
import {
  brushFlowMinimumResponseV1,
  brushOpacityMinimumResponseV1,
  brushSizeMinimumResponseV1,
  createBaselineBrushPresetV1,
  withBrushFlowMinimumResponseV1,
  withBrushOpacityMinimumResponseV1,
  withBrushSizeMinimumResponseV1,
} from '../../src/domain/brush-schema.js';
import { CanonicalRasterBrushStrokeV1 } from '../../src/app/canonical-raster-brush.js';
import { PaintSessionControllerV1 } from '../../src/app/paint-session-controller.js';
import { BaselineBrushDabBuilderV1 } from '../../src/gpu/baseline-brush.js';

class FakeRendererDocumentPort {
  async configureDocument(): Promise<void> {}
  async restoreBaselineStrokes(): Promise<void> {}
  async applyBaselineTilePatches(): Promise<void> {}
  async restoreBaselineCanonicalTiles(): Promise<void> {}
  async exportBaselineCanonicalTiles(): Promise<readonly never[]> { return []; }
  async exportBaselineCompositeTiles(): Promise<readonly never[]> { return []; }
}

describe('M6A-049 minimum response', () => {
  it('defaults each dynamic target minimum to zero and persists nonzero values', () => {
    const preset = createBaselineBrushPresetV1({
      id: 'minimum.response',
      name: 'Minimum Response',
      category: 'Test',
      behavior: 'paint',
    });
    expect(brushSizeMinimumResponseV1(preset)).toBe(0);
    expect(brushOpacityMinimumResponseV1(preset)).toBe(0);
    expect(brushFlowMinimumResponseV1(preset)).toBe(0);
    expect(brushSizeMinimumResponseV1(withBrushSizeMinimumResponseV1(preset, 0.25))).toBe(0.25);
    expect(brushOpacityMinimumResponseV1(withBrushOpacityMinimumResponseV1(preset, 0.4))).toBe(0.4);
    expect(brushFlowMinimumResponseV1(withBrushFlowMinimumResponseV1(preset, 0.6))).toBe(0.6);
    expect(() => withBrushSizeMinimumResponseV1(preset, -0.01)).toThrow(RangeError);
    expect(() => withBrushOpacityMinimumResponseV1(preset, 1.01)).toThrow(RangeError);
  });

  it('clamps combined dynamic response per target after source composition', () => {
    const [dab] = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      opacity: 0.8,
      flow: 0.6,
      pressureSizeEnabled: true,
      pressureOpacityEnabled: true,
      pressureFlowEnabled: true,
      sizeMinimumResponse: 0.3,
      opacityMinimumResponse: 0.4,
      flowMinimumResponse: 0.5,
    }).beginDelta({ documentX: 0, documentY: 0, pressure: 0 });
    expect(dab?.radius).toBeCloseTo(3, 10);
    expect(dab?.strokeOpacity).toBeCloseTo(0.32, 10);
    expect(dab?.flow).toBeCloseTo(0.3, 10);
  });

  it('applies the minimum after multiplying independent enabled sources', () => {
    const [dab] = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      pressureSizeEnabled: true,
      velocitySizeEnabled: true,
      sizeMinimumResponse: 0.4,
    }).beginDelta({ documentX: 0, documentY: 0, pressure: 0.5, velocity: 0.5 });
    expect(dab?.radius).toBeCloseTo(4, 10);
  });

  it('does not lower a neutral target when no dynamic source is enabled', () => {
    const [dab] = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      opacity: 0.8,
      flow: 0.6,
      sizeMinimumResponse: 0.2,
      opacityMinimumResponse: 0.2,
      flowMinimumResponse: 0.2,
    }).beginDelta({ documentX: 0, documentY: 0 });
    expect(dab?.radius).toBeCloseTo(10, 10);
    expect(dab?.strokeOpacity).toBeCloseTo(0.8, 10);
    expect(dab?.flow).toBeCloseTo(0.6, 10);
  });

  it('keeps forced taper zero authoritative outside the dynamic minimum clamp', () => {
    const stroke = new CanonicalRasterBrushStrokeV1({
      sizePx: 20,
      startTaperLengthPx: 10,
      forceStartTaper: true,
      pressureSizeEnabled: true,
      pressureOpacityEnabled: true,
      pressureFlowEnabled: true,
      sizeMinimumResponse: 0.9,
      opacityMinimumResponse: 0.9,
      flowMinimumResponse: 0.9,
    });
    expect(stroke.beginConfirmed({ documentX: 0, documentY: 0, pressure: 0 })).toEqual([]);
  });

  it('captures minimum responses in runtime state without extending primitive dab schema', () => {
    const session = new PaintSessionControllerV1(new FakeRendererDocumentPort());
    expect(session.setBrushSizeMinimumResponse(0.2)).toBe(0.2);
    expect(session.setBrushOpacityMinimumResponse(0.3)).toBe(0.3);
    expect(session.setBrushFlowMinimumResponse(0.4)).toBe(0.4);
    const snapshot = session.snapshot();
    expect(snapshot.brushSizeMinimumResponse).toBe(0.2);
    expect(snapshot.brushOpacityMinimumResponse).toBe(0.3);
    expect(snapshot.brushFlowMinimumResponse).toBe(0.4);
    const [dab] = new CanonicalRasterBrushStrokeV1({
      sizeMinimumResponse: 0.5,
      pressureSizeEnabled: true,
    }).beginConfirmed({ documentX: 0, documentY: 0, pressure: 0 });
    expect(dab).toBeDefined();
    expect('sizeMinimumResponse' in (dab ?? {})).toBe(false);
  });
});
""")

# Verification contract.
replace_once(
    'scripts/verify-m6a-brush.mjs',
    """requireText(
  progress,
  'M6A-PERF-001 incremental active-stroke rendering（stable prefix + bounded mutable tail）:未完了',""",
    """requireText(progress, 'M6A-049 minimum response:完了', 'M6A-049 progress is not complete');
requireText(
  read('src/domain/brush-schema.ts'),
  'brushSizeMinimumResponseV1',
  'minimum-response preset helpers missing',
);
requireText(
  read('src/gpu/baseline-brush.ts'),
  'const sizeResponse = Math.max(',
  'size minimum response is not applied after source composition',
);
requireText(
  read('src/gpu/baseline-brush.ts'),
  'const opacityResponse = Math.max(',
  'opacity minimum response is not applied after source composition',
);
requireText(
  read('src/gpu/baseline-brush.ts'),
  'const flowResponse = Math.max(',
  'flow minimum response is not applied after source composition',
);
requireText(
  read('src/app/paint-session-controller.ts'),
  'setBrushSizeMinimumResponse',
  'minimum response is not connected to runtime brush state',
);
requireText(
  read('src/index.html'),
  'id="brush-size-minimum-response-range"',
  'reachable minimum-response control missing',
);
requireText(
  read('tests/unit/brush-minimum-response.test.ts'),
  'keeps forced taper zero authoritative outside the dynamic minimum clamp',
  'minimum-response taper-priority regression missing',
);
requireText(
  read('tests/unit/brush-minimum-response.test.ts'),
  'applies the minimum after multiplying independent enabled sources',
  'minimum-response source-composition regression missing',
);

requireText(
  progress,
  'M6A-PERF-001 incremental active-stroke rendering（stable prefix + bounded mutable tail）:未完了',""",
)

# Progress and canonical design memo.
replace_once(
    'IMPLEMENTATION_PROGRESS.md',
    'M6A-049 minimum response:未完了\nM6A-050 maximum response:未完了',
    """M6A-049 minimum response:完了
再開メモ: M6A-049 minimum responseはCanonical Brush ModelのDynamicMappingV1 clamp.minに対応し、source個別ではなく動的targetごとのsizeMinimumResponse / opacityMinimumResponse / flowMinimumResponseを0..1で保持する。既定0は従来挙動と完全互換。pressure / tilt / velocity / randomのうち各targetで有効なresponseを従来どおり乗算した後、その合成responseへtarget別minimumを適用し、最後にbase size / strokeOpacity cap / flowへ解決する。動的sourceが無効なtargetはneutral response=1なのでminimumを設定してもbase値を下げない。start/end taperはminimum clampの外側で乗算されるためM6A-032 forced taperの0 endpointを復活させない。primitive dab / Worker / Historyにはminimum専用fieldを追加せず解決済みradius/strokeOpacity/flowのみを保持する。次はM6A-050 maximum responseから再開する。
M6A-050 maximum response:未完了""",
)

memo = Path('ILLUSTRO_DESIGN_MEMO.md')
memo.write_text(
    memo.read_text()
    + """

### M6A dynamic minimum-response clamp boundary — 2026-09-03

- `DynamicMappingV1.clamp.min` is implemented at the mapped **target** boundary, not independently per input source.
- The current scalar targets expose independent `sizeMinimumResponse`, `opacityMinimumResponse`, and `flowMinimumResponse` values in normalized `0..1`; all default to `0` for backward-compatible behavior.
- Enabled pressure, tilt, velocity, and random responses compose first using the current multiply semantics. The target minimum is applied to that composed response before multiplying the base size, opacity cap, or flow.
- A target with no enabled dynamic source retains neutral response `1`; setting a minimum therefore cannot reduce an otherwise static brush parameter.
- Start/end taper remains outside the dynamic clamp. In particular, forced taper zero endpoints stay zero and cannot be revived by minimum response.
- Primitive dabs continue to store only resolved radius, stroke opacity, and flow; no minimum-response field is added to Worker/history payloads.
- M6A-050 owns the complementary target-level maximum-response clamp and remains separate from this stage.
"""
)

print('M6A-049 patch applied')
