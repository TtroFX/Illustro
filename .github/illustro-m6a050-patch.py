from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    if old not in text:
        raise RuntimeError(f"anchor not found in {path}: {old[:180]!r}")
    file.write_text(text.replace(old, new, 1))


# Schema: target-level maximum response, default 1, with min <= max invariant.
for path, label in [
    ('src/domain/brush-schema.ts', 'schema'),
]:
    pass

replace_once(
    'src/domain/brush-schema.ts',
    """  const normalized = requireBrushMinimumResponseV1(minimumResponse, 'size');
  if (normalized === DEFAULT_BRUSH_SIZE_MINIMUM_RESPONSE_V1) {""",
    """  const normalized = requireBrushMinimumResponseV1(minimumResponse, 'size');
  if (normalized > brushSizeMaximumResponseV1(preset)) {
    throw new RangeError('brush size minimum response cannot exceed maximum response');
  }
  if (normalized === DEFAULT_BRUSH_SIZE_MINIMUM_RESPONSE_V1) {""",
)
replace_once(
    'src/domain/brush-schema.ts',
    """  const normalized = requireBrushMinimumResponseV1(minimumResponse, 'opacity');
  if (normalized === DEFAULT_BRUSH_OPACITY_MINIMUM_RESPONSE_V1) {""",
    """  const normalized = requireBrushMinimumResponseV1(minimumResponse, 'opacity');
  if (normalized > brushOpacityMaximumResponseV1(preset)) {
    throw new RangeError('brush opacity minimum response cannot exceed maximum response');
  }
  if (normalized === DEFAULT_BRUSH_OPACITY_MINIMUM_RESPONSE_V1) {""",
)
replace_once(
    'src/domain/brush-schema.ts',
    """  const normalized = requireBrushMinimumResponseV1(minimumResponse, 'flow');
  if (normalized === DEFAULT_BRUSH_FLOW_MINIMUM_RESPONSE_V1) {""",
    """  const normalized = requireBrushMinimumResponseV1(minimumResponse, 'flow');
  if (normalized > brushFlowMaximumResponseV1(preset)) {
    throw new RangeError('brush flow minimum response cannot exceed maximum response');
  }
  if (normalized === DEFAULT_BRUSH_FLOW_MINIMUM_RESPONSE_V1) {""",
)
replace_once(
    'src/domain/brush-schema.ts',
    "export type BrushTipSelectionModeV1 = 'fixed' | 'sequence' | 'random-per-stamp';",
    """export const DEFAULT_BRUSH_SIZE_MAXIMUM_RESPONSE_V1 = 1 as const;
export const DEFAULT_BRUSH_OPACITY_MAXIMUM_RESPONSE_V1 = 1 as const;
export const DEFAULT_BRUSH_FLOW_MAXIMUM_RESPONSE_V1 = 1 as const;

function brushMaximumResponseValueV1(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1
    ? value
    : 1;
}

function requireBrushMaximumResponseV1(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError(`brush ${label} maximum response must be within 0..1`);
  }
  return value;
}

export function brushSizeMaximumResponseV1(preset: BrushPresetV1): number {
  return brushMaximumResponseValueV1(preset.dynamics.sizeMaximumResponse);
}

export function withBrushSizeMaximumResponseV1(
  preset: BrushPresetV1,
  maximumResponse: number,
): BrushPresetV1 {
  const normalized = requireBrushMaximumResponseV1(maximumResponse, 'size');
  if (normalized < brushSizeMinimumResponseV1(preset)) {
    throw new RangeError('brush size maximum response cannot be below minimum response');
  }
  if (normalized === DEFAULT_BRUSH_SIZE_MAXIMUM_RESPONSE_V1) {
    const { sizeMaximumResponse: _sizeMaximumResponse, ...dynamics } = preset.dynamics;
    return normalizeBrushPresetV1({ ...preset, dynamics });
  }
  return normalizeBrushPresetV1({
    ...preset,
    dynamics: { ...preset.dynamics, sizeMaximumResponse: normalized },
  });
}

export function brushOpacityMaximumResponseV1(preset: BrushPresetV1): number {
  return brushMaximumResponseValueV1(preset.dynamics.opacityMaximumResponse);
}

export function withBrushOpacityMaximumResponseV1(
  preset: BrushPresetV1,
  maximumResponse: number,
): BrushPresetV1 {
  const normalized = requireBrushMaximumResponseV1(maximumResponse, 'opacity');
  if (normalized < brushOpacityMinimumResponseV1(preset)) {
    throw new RangeError('brush opacity maximum response cannot be below minimum response');
  }
  if (normalized === DEFAULT_BRUSH_OPACITY_MAXIMUM_RESPONSE_V1) {
    const { opacityMaximumResponse: _opacityMaximumResponse, ...dynamics } = preset.dynamics;
    return normalizeBrushPresetV1({ ...preset, dynamics });
  }
  return normalizeBrushPresetV1({
    ...preset,
    dynamics: { ...preset.dynamics, opacityMaximumResponse: normalized },
  });
}

export function brushFlowMaximumResponseV1(preset: BrushPresetV1): number {
  return brushMaximumResponseValueV1(preset.dynamics.flowMaximumResponse);
}

export function withBrushFlowMaximumResponseV1(
  preset: BrushPresetV1,
  maximumResponse: number,
): BrushPresetV1 {
  const normalized = requireBrushMaximumResponseV1(maximumResponse, 'flow');
  if (normalized < brushFlowMinimumResponseV1(preset)) {
    throw new RangeError('brush flow maximum response cannot be below minimum response');
  }
  if (normalized === DEFAULT_BRUSH_FLOW_MAXIMUM_RESPONSE_V1) {
    const { flowMaximumResponse: _flowMaximumResponse, ...dynamics } = preset.dynamics;
    return normalizeBrushPresetV1({ ...preset, dynamics });
  }
  return normalizeBrushPresetV1({
    ...preset,
    dynamics: { ...preset.dynamics, flowMaximumResponse: normalized },
  });
}

export type BrushTipSelectionModeV1 = 'fixed' | 'sequence' | 'random-per-stamp';""",
)

# Kernel fields/options/validation.
replace_once(
    'src/gpu/baseline-brush.ts',
    """  readonly #sizeMinimumResponse: number;
  readonly #opacityMinimumResponse: number;
  readonly #flowMinimumResponse: number;
  readonly #randomSeed: number;""",
    """  readonly #sizeMinimumResponse: number;
  readonly #opacityMinimumResponse: number;
  readonly #flowMinimumResponse: number;
  readonly #sizeMaximumResponse: number;
  readonly #opacityMaximumResponse: number;
  readonly #flowMaximumResponse: number;
  readonly #randomSeed: number;""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """      readonly sizeMinimumResponse?: number;
      readonly opacityMinimumResponse?: number;
      readonly flowMinimumResponse?: number;
      readonly randomSeed?: number;""",
    """      readonly sizeMinimumResponse?: number;
      readonly opacityMinimumResponse?: number;
      readonly flowMinimumResponse?: number;
      readonly sizeMaximumResponse?: number;
      readonly opacityMaximumResponse?: number;
      readonly flowMaximumResponse?: number;
      readonly randomSeed?: number;""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """    const sizeMinimumResponse = options.sizeMinimumResponse ?? 0;
    const opacityMinimumResponse = options.opacityMinimumResponse ?? 0;
    const flowMinimumResponse = options.flowMinimumResponse ?? 0;
    const randomSeed = options.randomSeed ?? 0;""",
    """    const sizeMinimumResponse = options.sizeMinimumResponse ?? 0;
    const opacityMinimumResponse = options.opacityMinimumResponse ?? 0;
    const flowMinimumResponse = options.flowMinimumResponse ?? 0;
    const sizeMaximumResponse = options.sizeMaximumResponse ?? 1;
    const opacityMaximumResponse = options.opacityMaximumResponse ?? 1;
    const flowMaximumResponse = options.flowMaximumResponse ?? 1;
    const randomSeed = options.randomSeed ?? 0;""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """      !Number.isFinite(flowMinimumResponse) ||
      flowMinimumResponse < 0 ||
      flowMinimumResponse > 1
    ) {
      throw new RangeError('baseline brush minimum responses must be within 0..1');
    }""",
    """      !Number.isFinite(flowMinimumResponse) ||
      flowMinimumResponse < 0 ||
      flowMinimumResponse > 1
    ) {
      throw new RangeError('baseline brush minimum responses must be within 0..1');
    }
    if (
      !Number.isFinite(sizeMaximumResponse) ||
      sizeMaximumResponse < 0 ||
      sizeMaximumResponse > 1 ||
      !Number.isFinite(opacityMaximumResponse) ||
      opacityMaximumResponse < 0 ||
      opacityMaximumResponse > 1 ||
      !Number.isFinite(flowMaximumResponse) ||
      flowMaximumResponse < 0 ||
      flowMaximumResponse > 1
    ) {
      throw new RangeError('baseline brush maximum responses must be within 0..1');
    }
    if (
      sizeMinimumResponse > sizeMaximumResponse ||
      opacityMinimumResponse > opacityMaximumResponse ||
      flowMinimumResponse > flowMaximumResponse
    ) {
      throw new RangeError('baseline brush minimum response cannot exceed maximum response');
    }""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """    this.#sizeMinimumResponse = sizeMinimumResponse;
    this.#opacityMinimumResponse = opacityMinimumResponse;
    this.#flowMinimumResponse = flowMinimumResponse;
    this.#randomSeed = randomSeed >>> 0;""",
    """    this.#sizeMinimumResponse = sizeMinimumResponse;
    this.#opacityMinimumResponse = opacityMinimumResponse;
    this.#flowMinimumResponse = flowMinimumResponse;
    this.#sizeMaximumResponse = sizeMaximumResponse;
    this.#opacityMaximumResponse = opacityMaximumResponse;
    this.#flowMaximumResponse = flowMaximumResponse;
    this.#randomSeed = randomSeed >>> 0;""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """    const sizeResponse = Math.max(
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
    );""",
    """    const usesSizeDynamics =
      this.#pressureSizeEnabled ||
      this.#tiltSizeEnabled ||
      this.#velocitySizeEnabled ||
      this.#randomSizeEnabled;
    const usesOpacityDynamics =
      this.#pressureOpacityEnabled ||
      this.#tiltOpacityEnabled ||
      this.#velocityOpacityEnabled ||
      this.#randomOpacityEnabled;
    const usesFlowDynamics =
      this.#pressureFlowEnabled ||
      this.#tiltFlowEnabled ||
      this.#velocityFlowEnabled ||
      this.#randomFlowEnabled;
    const sizeResponse = usesSizeDynamics
      ? Math.max(
          this.#sizeMinimumResponse,
          Math.min(
            this.#sizeMaximumResponse,
            pressureSizeScale * tiltSizeScale * velocitySizeScale * randomSizeScale,
          ),
        )
      : 1;
    const opacityResponse = usesOpacityDynamics
      ? Math.max(
          this.#opacityMinimumResponse,
          Math.min(
            this.#opacityMaximumResponse,
            pressureOpacityScale * tiltOpacityScale * velocityOpacityScale * randomOpacityScale,
          ),
        )
      : 1;
    const flowResponse = usesFlowDynamics
      ? Math.max(
          this.#flowMinimumResponse,
          Math.min(
            this.#flowMaximumResponse,
            pressureFlowScale * tiltFlowScale * velocityFlowScale * randomFlowScale,
          ),
        )
      : 1;""",
)

# Canonical facade.
replace_once(
    'src/app/canonical-raster-brush.ts',
    """      readonly sizeMinimumResponse?: number;
      readonly opacityMinimumResponse?: number;
      readonly flowMinimumResponse?: number;
      readonly randomSeed?: number;""",
    """      readonly sizeMinimumResponse?: number;
      readonly opacityMinimumResponse?: number;
      readonly flowMinimumResponse?: number;
      readonly sizeMaximumResponse?: number;
      readonly opacityMaximumResponse?: number;
      readonly flowMaximumResponse?: number;
      readonly randomSeed?: number;""",
)
replace_once(
    'src/app/canonical-raster-brush.ts',
    """      ...(options.flowMinimumResponse === undefined
        ? {}
        : { flowMinimumResponse: options.flowMinimumResponse }),
      ...(options.randomSeed === undefined ? {} : { randomSeed: options.randomSeed }),""",
    """      ...(options.flowMinimumResponse === undefined
        ? {}
        : { flowMinimumResponse: options.flowMinimumResponse }),
      ...(options.sizeMaximumResponse === undefined
        ? {}
        : { sizeMaximumResponse: options.sizeMaximumResponse }),
      ...(options.opacityMaximumResponse === undefined
        ? {}
        : { opacityMaximumResponse: options.opacityMaximumResponse }),
      ...(options.flowMaximumResponse === undefined
        ? {}
        : { flowMaximumResponse: options.flowMaximumResponse }),
      ...(options.randomSeed === undefined ? {} : { randomSeed: options.randomSeed }),""",
)

# Session runtime state/bounds.
replace_once(
    'src/app/paint-session-controller.ts',
    """  readonly brushSizeMinimumResponse: number;
  readonly brushOpacityMinimumResponse: number;
  readonly brushFlowMinimumResponse: number;
  readonly brushTipAngleDegrees: number;""",
    """  readonly brushSizeMinimumResponse: number;
  readonly brushOpacityMinimumResponse: number;
  readonly brushFlowMinimumResponse: number;
  readonly brushSizeMaximumResponse: number;
  readonly brushOpacityMaximumResponse: number;
  readonly brushFlowMaximumResponse: number;
  readonly brushTipAngleDegrees: number;""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """  #brushSizeMinimumResponse = 0;
  #brushOpacityMinimumResponse = 0;
  #brushFlowMinimumResponse = 0;
  #brushTipAngleDegrees: number = BASELINE_BRUSH_TIP_ANGLE_DEGREES;""",
    """  #brushSizeMinimumResponse = 0;
  #brushOpacityMinimumResponse = 0;
  #brushFlowMinimumResponse = 0;
  #brushSizeMaximumResponse = 1;
  #brushOpacityMaximumResponse = 1;
  #brushFlowMaximumResponse = 1;
  #brushTipAngleDegrees: number = BASELINE_BRUSH_TIP_ANGLE_DEGREES;""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """      brushSizeMinimumResponse: this.#brushSizeMinimumResponse,
      brushOpacityMinimumResponse: this.#brushOpacityMinimumResponse,
      brushFlowMinimumResponse: this.#brushFlowMinimumResponse,
      brushTipAngleDegrees: this.#brushTipAngleDegrees,""",
    """      brushSizeMinimumResponse: this.#brushSizeMinimumResponse,
      brushOpacityMinimumResponse: this.#brushOpacityMinimumResponse,
      brushFlowMinimumResponse: this.#brushFlowMinimumResponse,
      brushSizeMaximumResponse: this.#brushSizeMaximumResponse,
      brushOpacityMaximumResponse: this.#brushOpacityMaximumResponse,
      brushFlowMaximumResponse: this.#brushFlowMaximumResponse,
      brushTipAngleDegrees: this.#brushTipAngleDegrees,""",
)
# Add relation checks to existing minimum setters.
replace_once(
    'src/app/paint-session-controller.ts',
    """    if (!Number.isFinite(minimumResponse) || minimumResponse < 0 || minimumResponse > 1) {
      throw new RangeError('invalid runtime size minimum response');
    }
    if (minimumResponse !== this.#brushSizeMinimumResponse) this.#clearActiveStroke();""",
    """    if (!Number.isFinite(minimumResponse) || minimumResponse < 0 || minimumResponse > 1) {
      throw new RangeError('invalid runtime size minimum response');
    }
    if (minimumResponse > this.#brushSizeMaximumResponse) {
      throw new RangeError('runtime size minimum response cannot exceed maximum response');
    }
    if (minimumResponse !== this.#brushSizeMinimumResponse) this.#clearActiveStroke();""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """    if (!Number.isFinite(minimumResponse) || minimumResponse < 0 || minimumResponse > 1) {
      throw new RangeError('invalid runtime opacity minimum response');
    }
    if (minimumResponse !== this.#brushOpacityMinimumResponse) this.#clearActiveStroke();""",
    """    if (!Number.isFinite(minimumResponse) || minimumResponse < 0 || minimumResponse > 1) {
      throw new RangeError('invalid runtime opacity minimum response');
    }
    if (minimumResponse > this.#brushOpacityMaximumResponse) {
      throw new RangeError('runtime opacity minimum response cannot exceed maximum response');
    }
    if (minimumResponse !== this.#brushOpacityMinimumResponse) this.#clearActiveStroke();""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """    if (!Number.isFinite(minimumResponse) || minimumResponse < 0 || minimumResponse > 1) {
      throw new RangeError('invalid runtime flow minimum response');
    }
    if (minimumResponse !== this.#brushFlowMinimumResponse) this.#clearActiveStroke();""",
    """    if (!Number.isFinite(minimumResponse) || minimumResponse < 0 || minimumResponse > 1) {
      throw new RangeError('invalid runtime flow minimum response');
    }
    if (minimumResponse > this.#brushFlowMaximumResponse) {
      throw new RangeError('runtime flow minimum response cannot exceed maximum response');
    }
    if (minimumResponse !== this.#brushFlowMinimumResponse) this.#clearActiveStroke();""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """  brushFlowMinimumResponse(): number {
    return this.#brushFlowMinimumResponse;
  }

  setBrushTipAngleDegrees(angleDegrees: number): number {""",
    """  brushFlowMinimumResponse(): number {
    return this.#brushFlowMinimumResponse;
  }

  setBrushSizeMaximumResponse(maximumResponse: number): number {
    if (!Number.isFinite(maximumResponse) || maximumResponse < 0 || maximumResponse > 1) {
      throw new RangeError('invalid runtime size maximum response');
    }
    if (maximumResponse < this.#brushSizeMinimumResponse) {
      throw new RangeError('runtime size maximum response cannot be below minimum response');
    }
    if (maximumResponse !== this.#brushSizeMaximumResponse) this.#clearActiveStroke();
    this.#brushSizeMaximumResponse = maximumResponse;
    return this.#brushSizeMaximumResponse;
  }

  brushSizeMaximumResponse(): number {
    return this.#brushSizeMaximumResponse;
  }

  setBrushOpacityMaximumResponse(maximumResponse: number): number {
    if (!Number.isFinite(maximumResponse) || maximumResponse < 0 || maximumResponse > 1) {
      throw new RangeError('invalid runtime opacity maximum response');
    }
    if (maximumResponse < this.#brushOpacityMinimumResponse) {
      throw new RangeError('runtime opacity maximum response cannot be below minimum response');
    }
    if (maximumResponse !== this.#brushOpacityMaximumResponse) this.#clearActiveStroke();
    this.#brushOpacityMaximumResponse = maximumResponse;
    return this.#brushOpacityMaximumResponse;
  }

  brushOpacityMaximumResponse(): number {
    return this.#brushOpacityMaximumResponse;
  }

  setBrushFlowMaximumResponse(maximumResponse: number): number {
    if (!Number.isFinite(maximumResponse) || maximumResponse < 0 || maximumResponse > 1) {
      throw new RangeError('invalid runtime flow maximum response');
    }
    if (maximumResponse < this.#brushFlowMinimumResponse) {
      throw new RangeError('runtime flow maximum response cannot be below minimum response');
    }
    if (maximumResponse !== this.#brushFlowMaximumResponse) this.#clearActiveStroke();
    this.#brushFlowMaximumResponse = maximumResponse;
    return this.#brushFlowMaximumResponse;
  }

  brushFlowMaximumResponse(): number {
    return this.#brushFlowMaximumResponse;
  }

  setBrushDynamicResponseBounds(
    size: Readonly<{ minimum: number; maximum: number }>,
    opacity: Readonly<{ minimum: number; maximum: number }>,
    flow: Readonly<{ minimum: number; maximum: number }>,
  ): void {
    for (const [label, bounds] of [
      ['size', size],
      ['opacity', opacity],
      ['flow', flow],
    ] as const) {
      if (
        !Number.isFinite(bounds.minimum) ||
        !Number.isFinite(bounds.maximum) ||
        bounds.minimum < 0 ||
        bounds.maximum > 1 ||
        bounds.minimum > bounds.maximum
      ) {
        throw new RangeError(`invalid runtime ${label} response bounds`);
      }
    }
    if (
      size.minimum !== this.#brushSizeMinimumResponse ||
      size.maximum !== this.#brushSizeMaximumResponse ||
      opacity.minimum !== this.#brushOpacityMinimumResponse ||
      opacity.maximum !== this.#brushOpacityMaximumResponse ||
      flow.minimum !== this.#brushFlowMinimumResponse ||
      flow.maximum !== this.#brushFlowMaximumResponse
    ) {
      this.#clearActiveStroke();
    }
    this.#brushSizeMinimumResponse = size.minimum;
    this.#brushSizeMaximumResponse = size.maximum;
    this.#brushOpacityMinimumResponse = opacity.minimum;
    this.#brushOpacityMaximumResponse = opacity.maximum;
    this.#brushFlowMinimumResponse = flow.minimum;
    this.#brushFlowMaximumResponse = flow.maximum;
  }

  setBrushTipAngleDegrees(angleDegrees: number): number {""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """        sizeMinimumResponse: this.#brushSizeMinimumResponse,
        opacityMinimumResponse: this.#brushOpacityMinimumResponse,
        flowMinimumResponse: this.#brushFlowMinimumResponse,
        randomSeed: randomSeed ?? 0,""",
    """        sizeMinimumResponse: this.#brushSizeMinimumResponse,
        opacityMinimumResponse: this.#brushOpacityMinimumResponse,
        flowMinimumResponse: this.#brushFlowMinimumResponse,
        sizeMaximumResponse: this.#brushSizeMaximumResponse,
        opacityMaximumResponse: this.#brushOpacityMaximumResponse,
        flowMaximumResponse: this.#brushFlowMaximumResponse,
        randomSeed: randomSeed ?? 0,""",
)

# Preset library max mutation APIs.
replace_once(
    'src/app/brush-preset-library.ts',
    """  withBrushSizeMinimumResponseV1,
  withBrushOpacityMinimumResponseV1,
  withBrushFlowMinimumResponseV1,
  withBrushStrokeSpacingV1,""",
    """  withBrushSizeMinimumResponseV1,
  withBrushOpacityMinimumResponseV1,
  withBrushFlowMinimumResponseV1,
  withBrushSizeMaximumResponseV1,
  withBrushOpacityMaximumResponseV1,
  withBrushFlowMaximumResponseV1,
  withBrushStrokeSpacingV1,""",
)
replace_once(
    'src/app/brush-preset-library.ts',
    """export function updateBrushPresetCustomTipV1(
  state: BrushPresetLibraryStateV1,""",
    """export function updateBrushPresetSizeMaximumResponseV1(
  state: BrushPresetLibraryStateV1,
  presetId: string,
  maximumResponse: number,
): BrushPresetLibraryStateV1 {
  return updateItemV1(state, presetId, (item) => {
    if (item.locked) throw new Error('locked brush preset cannot be edited');
    const current = withBrushSizeMaximumResponseV1(item.preset, maximumResponse);
    if (JSON.stringify(current) === JSON.stringify(item.preset)) return item;
    const next = normalizeBrushPresetV1({ ...current, revision: item.preset.revision + 1 });
    return itemV1({ source: item.source, baseline: item.baseline, preset: next, locked: item.locked });
  });
}

export function updateBrushPresetOpacityMaximumResponseV1(
  state: BrushPresetLibraryStateV1,
  presetId: string,
  maximumResponse: number,
): BrushPresetLibraryStateV1 {
  return updateItemV1(state, presetId, (item) => {
    if (item.locked) throw new Error('locked brush preset cannot be edited');
    const current = withBrushOpacityMaximumResponseV1(item.preset, maximumResponse);
    if (JSON.stringify(current) === JSON.stringify(item.preset)) return item;
    const next = normalizeBrushPresetV1({ ...current, revision: item.preset.revision + 1 });
    return itemV1({ source: item.source, baseline: item.baseline, preset: next, locked: item.locked });
  });
}

export function updateBrushPresetFlowMaximumResponseV1(
  state: BrushPresetLibraryStateV1,
  presetId: string,
  maximumResponse: number,
): BrushPresetLibraryStateV1 {
  return updateItemV1(state, presetId, (item) => {
    if (item.locked) throw new Error('locked brush preset cannot be edited');
    const current = withBrushFlowMaximumResponseV1(item.preset, maximumResponse);
    if (JSON.stringify(current) === JSON.stringify(item.preset)) return item;
    const next = normalizeBrushPresetV1({ ...current, revision: item.preset.revision + 1 });
    return itemV1({ source: item.source, baseline: item.baseline, preset: next, locked: item.locked });
  });
}

export function updateBrushPresetCustomTipV1(
  state: BrushPresetLibraryStateV1,""",
)

# Brush UI controller: max controls and atomic application of min/max bounds.
replace_once(
    'src/app/brush-preset-controller.ts',
    """  brushSizeMinimumResponseV1,
  brushOpacityMinimumResponseV1,
  brushFlowMinimumResponseV1,
  BUILTIN_BRUSH_GRAIN_RESOURCES_V1,""",
    """  brushSizeMinimumResponseV1,
  brushOpacityMinimumResponseV1,
  brushFlowMinimumResponseV1,
  brushSizeMaximumResponseV1,
  brushOpacityMaximumResponseV1,
  brushFlowMaximumResponseV1,
  BUILTIN_BRUSH_GRAIN_RESOURCES_V1,""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  updateBrushPresetSizeMinimumResponseV1,
  updateBrushPresetOpacityMinimumResponseV1,
  updateBrushPresetFlowMinimumResponseV1,
  updateBrushPresetSpacingV1,""",
    """  updateBrushPresetSizeMinimumResponseV1,
  updateBrushPresetOpacityMinimumResponseV1,
  updateBrushPresetFlowMinimumResponseV1,
  updateBrushPresetSizeMaximumResponseV1,
  updateBrushPresetOpacityMaximumResponseV1,
  updateBrushPresetFlowMaximumResponseV1,
  updateBrushPresetSpacingV1,""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  const flowMinimumResponseRange = requireElement('#brush-flow-minimum-response-range', HTMLInputElement);
  const flowMinimumResponseNumber = requireElement('#brush-flow-minimum-response-number', HTMLInputElement);
  const tipShape = requireElement('#brush-tip-shape', HTMLSelectElement);""",
    """  const flowMinimumResponseRange = requireElement('#brush-flow-minimum-response-range', HTMLInputElement);
  const flowMinimumResponseNumber = requireElement('#brush-flow-minimum-response-number', HTMLInputElement);
  const sizeMaximumResponseRange = requireElement('#brush-size-maximum-response-range', HTMLInputElement);
  const sizeMaximumResponseNumber = requireElement('#brush-size-maximum-response-number', HTMLInputElement);
  const opacityMaximumResponseRange = requireElement('#brush-opacity-maximum-response-range', HTMLInputElement);
  const opacityMaximumResponseNumber = requireElement('#brush-opacity-maximum-response-number', HTMLInputElement);
  const flowMaximumResponseRange = requireElement('#brush-flow-maximum-response-range', HTMLInputElement);
  const flowMaximumResponseNumber = requireElement('#brush-flow-maximum-response-number', HTMLInputElement);
  const tipShape = requireElement('#brush-tip-shape', HTMLSelectElement);""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    const sizeMinimumResponse = brushSizeMinimumResponseV1(item.preset);
    input.paintSession.setBrushSizeMinimumResponse(sizeMinimumResponse);
    const opacityMinimumResponse = brushOpacityMinimumResponseV1(item.preset);
    input.paintSession.setBrushOpacityMinimumResponse(opacityMinimumResponse);
    const flowMinimumResponse = brushFlowMinimumResponseV1(item.preset);
    input.paintSession.setBrushFlowMinimumResponse(flowMinimumResponse);""",
    """    const sizeMinimumResponse = brushSizeMinimumResponseV1(item.preset);
    const opacityMinimumResponse = brushOpacityMinimumResponseV1(item.preset);
    const flowMinimumResponse = brushFlowMinimumResponseV1(item.preset);
    const sizeMaximumResponse = brushSizeMaximumResponseV1(item.preset);
    const opacityMaximumResponse = brushOpacityMaximumResponseV1(item.preset);
    const flowMaximumResponse = brushFlowMaximumResponseV1(item.preset);
    input.paintSession.setBrushDynamicResponseBounds(
      { minimum: sizeMinimumResponse, maximum: sizeMaximumResponse },
      { minimum: opacityMinimumResponse, maximum: opacityMaximumResponse },
      { minimum: flowMinimumResponse, maximum: flowMaximumResponse },
    );""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    input.root.dataset.illustroBrushFlowMinimumResponse = String(flowMinimumResponse);
    input.root.dataset.illustroBrushTipShape = brushTipShapeV1(item.preset);""",
    """    input.root.dataset.illustroBrushFlowMinimumResponse = String(flowMinimumResponse);
    input.root.dataset.illustroBrushSizeMaximumResponse = String(sizeMaximumResponse);
    input.root.dataset.illustroBrushOpacityMaximumResponse = String(opacityMaximumResponse);
    input.root.dataset.illustroBrushFlowMaximumResponse = String(flowMaximumResponse);
    input.root.dataset.illustroBrushTipShape = brushTipShapeV1(item.preset);""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    const flowMinimumResponse = brushFlowMinimumResponseV1(selected.preset);
    configurePair(flowMinimumResponseRange, flowMinimumResponseNumber, 0, 100, 1, flowMinimumResponse * 100);
    tipShape.value = brushTipShapeV1(selected.preset);""",
    """    const flowMinimumResponse = brushFlowMinimumResponseV1(selected.preset);
    configurePair(flowMinimumResponseRange, flowMinimumResponseNumber, 0, 100, 1, flowMinimumResponse * 100);
    const sizeMaximumResponse = brushSizeMaximumResponseV1(selected.preset);
    configurePair(sizeMaximumResponseRange, sizeMaximumResponseNumber, 0, 100, 1, sizeMaximumResponse * 100);
    sizeMaximumResponseRange.min = String(sizeMinimumResponse * 100);
    sizeMaximumResponseNumber.min = String(sizeMinimumResponse * 100);
    sizeMinimumResponseRange.max = String(sizeMaximumResponse * 100);
    sizeMinimumResponseNumber.max = String(sizeMaximumResponse * 100);
    const opacityMaximumResponse = brushOpacityMaximumResponseV1(selected.preset);
    configurePair(
      opacityMaximumResponseRange,
      opacityMaximumResponseNumber,
      0,
      100,
      1,
      opacityMaximumResponse * 100,
    );
    opacityMaximumResponseRange.min = String(opacityMinimumResponse * 100);
    opacityMaximumResponseNumber.min = String(opacityMinimumResponse * 100);
    opacityMinimumResponseRange.max = String(opacityMaximumResponse * 100);
    opacityMinimumResponseNumber.max = String(opacityMaximumResponse * 100);
    const flowMaximumResponse = brushFlowMaximumResponseV1(selected.preset);
    configurePair(flowMaximumResponseRange, flowMaximumResponseNumber, 0, 100, 1, flowMaximumResponse * 100);
    flowMaximumResponseRange.min = String(flowMinimumResponse * 100);
    flowMaximumResponseNumber.min = String(flowMinimumResponse * 100);
    flowMinimumResponseRange.max = String(flowMaximumResponse * 100);
    flowMinimumResponseNumber.max = String(flowMaximumResponse * 100);
    tipShape.value = brushTipShapeV1(selected.preset);""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    const minimumResponseLabel = `${
      sizeMinimumResponse > 0 ? ` · DynSizeMin${Math.round(sizeMinimumResponse * 100)}%` : ''
    }${
      opacityMinimumResponse > 0 ? ` · DynOpacityMin${Math.round(opacityMinimumResponse * 100)}%` : ''
    }${flowMinimumResponse > 0 ? ` · DynFlowMin${Math.round(flowMinimumResponse * 100)}%` : ''}`;
    propertyStatus.textContent =""",
    """    const minimumResponseLabel = `${
      sizeMinimumResponse > 0 ? ` · DynSizeMin${Math.round(sizeMinimumResponse * 100)}%` : ''
    }${
      opacityMinimumResponse > 0 ? ` · DynOpacityMin${Math.round(opacityMinimumResponse * 100)}%` : ''
    }${flowMinimumResponse > 0 ? ` · DynFlowMin${Math.round(flowMinimumResponse * 100)}%` : ''}`;
    const maximumResponseLabel = `${
      sizeMaximumResponse < 1 ? ` · DynSizeMax${Math.round(sizeMaximumResponse * 100)}%` : ''
    }${
      opacityMaximumResponse < 1 ? ` · DynOpacityMax${Math.round(opacityMaximumResponse * 100)}%` : ''
    }${flowMaximumResponse < 1 ? ` · DynFlowMax${Math.round(flowMaximumResponse * 100)}%` : ''}`;
    propertyStatus.textContent =""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    "${randomCurveLabel}${minimumResponseLabel}`;",
    "${randomCurveLabel}${minimumResponseLabel}${maximumResponseLabel}`;",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """      flowMinimumResponseRange,
      flowMinimumResponseNumber,
      tipShape,""",
    """      flowMinimumResponseRange,
      flowMinimumResponseNumber,
      sizeMaximumResponseRange,
      sizeMaximumResponseNumber,
      opacityMaximumResponseRange,
      opacityMaximumResponseNumber,
      flowMaximumResponseRange,
      flowMaximumResponseNumber,
      tipShape,""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  const onFlowMinimumResponseNumber = (): void =>
    updateFlowMinimumResponse(Number(flowMinimumResponseNumber.value));
  const onTipShape = (): void => {""",
    """  const onFlowMinimumResponseNumber = (): void =>
    updateFlowMinimumResponse(Number(flowMinimumResponseNumber.value));
  const updateSizeMaximumResponse = (valuePercent: number): void =>
    mutate(() => updateBrushPresetSizeMaximumResponseV1(state, state.selectedPresetId, valuePercent / 100));
  const updateOpacityMaximumResponse = (valuePercent: number): void =>
    mutate(() =>
      updateBrushPresetOpacityMaximumResponseV1(state, state.selectedPresetId, valuePercent / 100),
    );
  const updateFlowMaximumResponse = (valuePercent: number): void =>
    mutate(() => updateBrushPresetFlowMaximumResponseV1(state, state.selectedPresetId, valuePercent / 100));
  const onSizeMaximumResponseRange = (): void =>
    updateSizeMaximumResponse(Number(sizeMaximumResponseRange.value));
  const onSizeMaximumResponseNumber = (): void =>
    updateSizeMaximumResponse(Number(sizeMaximumResponseNumber.value));
  const onOpacityMaximumResponseRange = (): void =>
    updateOpacityMaximumResponse(Number(opacityMaximumResponseRange.value));
  const onOpacityMaximumResponseNumber = (): void =>
    updateOpacityMaximumResponse(Number(opacityMaximumResponseNumber.value));
  const onFlowMaximumResponseRange = (): void =>
    updateFlowMaximumResponse(Number(flowMaximumResponseRange.value));
  const onFlowMaximumResponseNumber = (): void =>
    updateFlowMaximumResponse(Number(flowMaximumResponseNumber.value));
  const onTipShape = (): void => {""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  flowMinimumResponseRange.addEventListener('input', onFlowMinimumResponseRange);
  flowMinimumResponseNumber.addEventListener('change', onFlowMinimumResponseNumber);
  tipShape.addEventListener('change', onTipShape);""",
    """  flowMinimumResponseRange.addEventListener('input', onFlowMinimumResponseRange);
  flowMinimumResponseNumber.addEventListener('change', onFlowMinimumResponseNumber);
  sizeMaximumResponseRange.addEventListener('input', onSizeMaximumResponseRange);
  sizeMaximumResponseNumber.addEventListener('change', onSizeMaximumResponseNumber);
  opacityMaximumResponseRange.addEventListener('input', onOpacityMaximumResponseRange);
  opacityMaximumResponseNumber.addEventListener('change', onOpacityMaximumResponseNumber);
  flowMaximumResponseRange.addEventListener('input', onFlowMaximumResponseRange);
  flowMaximumResponseNumber.addEventListener('change', onFlowMaximumResponseNumber);
  tipShape.addEventListener('change', onTipShape);""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """      flowMinimumResponseRange.removeEventListener('input', onFlowMinimumResponseRange);
      flowMinimumResponseNumber.removeEventListener('change', onFlowMinimumResponseNumber);
      pressureCurveEditor?.dispose();""",
    """      flowMinimumResponseRange.removeEventListener('input', onFlowMinimumResponseRange);
      flowMinimumResponseNumber.removeEventListener('change', onFlowMinimumResponseNumber);
      sizeMaximumResponseRange.removeEventListener('input', onSizeMaximumResponseRange);
      sizeMaximumResponseNumber.removeEventListener('change', onSizeMaximumResponseNumber);
      opacityMaximumResponseRange.removeEventListener('input', onOpacityMaximumResponseRange);
      opacityMaximumResponseNumber.removeEventListener('change', onOpacityMaximumResponseNumber);
      flowMaximumResponseRange.removeEventListener('input', onFlowMaximumResponseRange);
      flowMaximumResponseNumber.removeEventListener('change', onFlowMaximumResponseNumber);
      pressureCurveEditor?.dispose();""",
)

# Reachable max controls after the minimum rows.
replace_once(
    'src/index.html',
    """              <div class="shell-brush-property-row">
                <label for="brush-flow-minimum-response-range">動的流量下限</label>
                <input id="brush-flow-minimum-response-range" type="range" min="0" max="100" step="1" value="0" />
                <span class="shell-brush-property-number shell-brush-property-percent"><input id="brush-flow-minimum-response-number" type="number" inputmode="decimal" min="0" max="100" step="1" value="0" aria-label="動的流量最小レスポンス" /><span>%</span></span>
              </div>
              <div class="shell-brush-property-row shell-brush-tip-property-row">""",
    """              <div class="shell-brush-property-row">
                <label for="brush-flow-minimum-response-range">動的流量下限</label>
                <input id="brush-flow-minimum-response-range" type="range" min="0" max="100" step="1" value="0" />
                <span class="shell-brush-property-number shell-brush-property-percent"><input id="brush-flow-minimum-response-number" type="number" inputmode="decimal" min="0" max="100" step="1" value="0" aria-label="動的流量最小レスポンス" /><span>%</span></span>
              </div>
              <div class="shell-brush-property-row">
                <label for="brush-size-maximum-response-range">動的サイズ上限</label>
                <input id="brush-size-maximum-response-range" type="range" min="0" max="100" step="1" value="100" />
                <span class="shell-brush-property-number shell-brush-property-percent"><input id="brush-size-maximum-response-number" type="number" inputmode="decimal" min="0" max="100" step="1" value="100" aria-label="動的サイズ最大レスポンス" /><span>%</span></span>
              </div>
              <div class="shell-brush-property-row">
                <label for="brush-opacity-maximum-response-range">動的不透明度上限</label>
                <input id="brush-opacity-maximum-response-range" type="range" min="0" max="100" step="1" value="100" />
                <span class="shell-brush-property-number shell-brush-property-percent"><input id="brush-opacity-maximum-response-number" type="number" inputmode="decimal" min="0" max="100" step="1" value="100" aria-label="動的不透明度最大レスポンス" /><span>%</span></span>
              </div>
              <div class="shell-brush-property-row">
                <label for="brush-flow-maximum-response-range">動的流量上限</label>
                <input id="brush-flow-maximum-response-range" type="range" min="0" max="100" step="1" value="100" />
                <span class="shell-brush-property-number shell-brush-property-percent"><input id="brush-flow-maximum-response-number" type="number" inputmode="decimal" min="0" max="100" step="1" value="100" aria-label="動的流量最大レスポンス" /><span>%</span></span>
              </div>
              <div class="shell-brush-property-row shell-brush-tip-property-row">""",
)

# Regression coverage.
Path('tests/unit/brush-maximum-response.test.ts').write_text("""import { describe, expect, it } from 'vitest';
import {
  brushFlowMaximumResponseV1,
  brushOpacityMaximumResponseV1,
  brushSizeMaximumResponseV1,
  createBaselineBrushPresetV1,
  withBrushFlowMaximumResponseV1,
  withBrushFlowMinimumResponseV1,
  withBrushOpacityMaximumResponseV1,
  withBrushOpacityMinimumResponseV1,
  withBrushSizeMaximumResponseV1,
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

describe('M6A-050 maximum response', () => {
  it('defaults each dynamic target maximum to one and persists bounded values', () => {
    const preset = createBaselineBrushPresetV1({
      id: 'maximum.response',
      name: 'Maximum Response',
      category: 'Test',
      behavior: 'paint',
    });
    expect(brushSizeMaximumResponseV1(preset)).toBe(1);
    expect(brushOpacityMaximumResponseV1(preset)).toBe(1);
    expect(brushFlowMaximumResponseV1(preset)).toBe(1);
    expect(brushSizeMaximumResponseV1(withBrushSizeMaximumResponseV1(preset, 0.75))).toBe(0.75);
    expect(brushOpacityMaximumResponseV1(withBrushOpacityMaximumResponseV1(preset, 0.6))).toBe(0.6);
    expect(brushFlowMaximumResponseV1(withBrushFlowMaximumResponseV1(preset, 0.5))).toBe(0.5);
  });

  it('enforces minimum less than or equal to maximum in preset helpers', () => {
    const preset = createBaselineBrushPresetV1({
      id: 'bounds.response',
      name: 'Bounds Response',
      category: 'Test',
      behavior: 'paint',
    });
    const sizeMin = withBrushSizeMinimumResponseV1(preset, 0.6);
    expect(() => withBrushSizeMaximumResponseV1(sizeMin, 0.5)).toThrow(RangeError);
    const opacityMax = withBrushOpacityMaximumResponseV1(preset, 0.4);
    expect(() => withBrushOpacityMinimumResponseV1(opacityMax, 0.5)).toThrow(RangeError);
    const flowMin = withBrushFlowMinimumResponseV1(preset, 0.3);
    expect(brushFlowMaximumResponseV1(withBrushFlowMaximumResponseV1(flowMin, 0.3))).toBe(0.3);
  });

  it('caps enabled dynamic target responses after source composition', () => {
    const [dab] = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      opacity: 0.8,
      flow: 0.6,
      pressureSizeEnabled: true,
      pressureOpacityEnabled: true,
      pressureFlowEnabled: true,
      sizeMaximumResponse: 0.5,
      opacityMaximumResponse: 0.5,
      flowMaximumResponse: 0.5,
    }).beginDelta({ documentX: 0, documentY: 0, pressure: 1 });
    expect(dab?.radius).toBeCloseTo(5, 10);
    expect(dab?.strokeOpacity).toBeCloseTo(0.4, 10);
    expect(dab?.flow).toBeCloseTo(0.3, 10);
  });

  it('keeps static targets neutral when no dynamic source is enabled', () => {
    const [dab] = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      opacity: 0.8,
      flow: 0.6,
      sizeMaximumResponse: 0.2,
      opacityMaximumResponse: 0.2,
      flowMaximumResponse: 0.2,
    }).beginDelta({ documentX: 0, documentY: 0 });
    expect(dab?.radius).toBeCloseTo(10, 10);
    expect(dab?.strokeOpacity).toBeCloseTo(0.8, 10);
    expect(dab?.flow).toBeCloseTo(0.6, 10);
  });

  it('clamps within target bounds without changing source composition order', () => {
    const low = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      pressureSizeEnabled: true,
      velocitySizeEnabled: true,
      sizeMinimumResponse: 0.3,
      sizeMaximumResponse: 0.6,
    }).beginDelta({ documentX: 0, documentY: 0, pressure: 0.2, velocity: 0.5 })[0];
    const high = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      pressureSizeEnabled: true,
      velocitySizeEnabled: true,
      sizeMinimumResponse: 0.3,
      sizeMaximumResponse: 0.6,
    }).beginDelta({ documentX: 0, documentY: 0, pressure: 1, velocity: 1 })[0];
    expect(low?.radius).toBeCloseTo(3, 10);
    expect(high?.radius).toBeCloseTo(6, 10);
  });

  it('keeps forced taper zero authoritative outside both response clamps', () => {
    const stroke = new CanonicalRasterBrushStrokeV1({
      sizePx: 20,
      startTaperLengthPx: 10,
      forceStartTaper: true,
      pressureSizeEnabled: true,
      sizeMinimumResponse: 0.4,
      sizeMaximumResponse: 0.6,
    });
    expect(stroke.beginConfirmed({ documentX: 0, documentY: 0, pressure: 1 })).toEqual([]);
  });

  it('updates runtime bounds atomically and stores only resolved primitive values', () => {
    const session = new PaintSessionControllerV1(new FakeRendererDocumentPort());
    session.setBrushDynamicResponseBounds(
      { minimum: 0.2, maximum: 0.7 },
      { minimum: 0.3, maximum: 0.8 },
      { minimum: 0.4, maximum: 0.9 },
    );
    const snapshot = session.snapshot();
    expect(snapshot.brushSizeMaximumResponse).toBe(0.7);
    expect(snapshot.brushOpacityMaximumResponse).toBe(0.8);
    expect(snapshot.brushFlowMaximumResponse).toBe(0.9);
    expect(() => session.setBrushSizeMaximumResponse(0.1)).toThrow(RangeError);
    const [dab] = new CanonicalRasterBrushStrokeV1({
      pressureSizeEnabled: true,
      sizeMaximumResponse: 0.5,
    }).beginConfirmed({ documentX: 0, documentY: 0, pressure: 1 });
    expect(dab).toBeDefined();
    expect('sizeMaximumResponse' in (dab ?? {})).toBe(false);
  });
});
""")

# Verifier.
replace_once(
    'scripts/verify-m6a-brush.mjs',
    """requireText(
  progress,
  'M6A-PERF-001 incremental active-stroke rendering（stable prefix + bounded mutable tail）:未完了',""",
    """requireText(progress, 'M6A-050 maximum response:完了', 'M6A-050 progress is not complete');
requireText(
  read('src/domain/brush-schema.ts'),
  'brushSizeMaximumResponseV1',
  'maximum-response preset helpers missing',
);
requireText(
  read('src/gpu/baseline-brush.ts'),
  'this.#sizeMaximumResponse',
  'size maximum response is not connected to the brush kernel',
);
requireText(
  read('src/gpu/baseline-brush.ts'),
  'const usesSizeDynamics =',
  'maximum response does not preserve neutral static targets',
);
requireText(
  read('src/app/paint-session-controller.ts'),
  'setBrushDynamicResponseBounds',
  'response bounds are not atomically connected to runtime state',
);
requireText(
  read('src/index.html'),
  'id="brush-size-maximum-response-range"',
  'reachable maximum-response control missing',
);
requireText(
  read('tests/unit/brush-maximum-response.test.ts'),
  'keeps static targets neutral when no dynamic source is enabled',
  'maximum-response neutral-target regression missing',
);
requireText(
  read('tests/unit/brush-maximum-response.test.ts'),
  'enforces minimum less than or equal to maximum in preset helpers',
  'minimum/maximum bound-order regression missing',
);

requireText(
  progress,
  'M6A-PERF-001 incremental active-stroke rendering（stable prefix + bounded mutable tail）:未完了',""",
)

# Progress/docs.
replace_once(
    'IMPLEMENTATION_PROGRESS.md',
    'M6A-050 maximum response:未完了\nM6A-051 size jitter:未完了',
    """M6A-050 maximum response:完了
再開メモ: M6A-050 maximum responseはM6A-049と対になるDynamicMappingV1 clamp.maxとしてsizeMaximumResponse / opacityMaximumResponse / flowMaximumResponseを0..1で保持し、既定1を完全互換値とする。各targetにpressure / tilt / velocity / randomのいずれかが有効な場合だけ、source responseを従来どおり乗算した結果へ[min,max] clampを適用する。dynamic sourceが1つも無いtargetはneutral response=1を維持するためmaximumを下げても静的base size/opacity/flowは変化しない。preset/runtimeはminimum <= maximumを強制し、preset切替時は3 targetのboundsをatomicにcaptureする。UIも各minimum/maximumの相互範囲を制約する。start/end/forced taperはresponse clampの外側に残りzero endpointを維持する。primitive dab / Worker / Historyにはbounds専用fieldを追加しない。次はM6A-051 size jitterから再開する。
M6A-051 size jitter:未完了""",
)

memo = Path('ILLUSTRO_DESIGN_MEMO.md')
memo.write_text(
    memo.read_text()
    + """

### M6A dynamic maximum-response clamp boundary — 2026-09-03

- `DynamicMappingV1.clamp.max` complements the M6A-049 target-level minimum with normalized `sizeMaximumResponse`, `opacityMaximumResponse`, and `flowMaximumResponse`; all default to `1`.
- For a target with one or more enabled dynamic sources, source responses compose first using the current multiply semantics, then the result is clamped to the target's `[minimum, maximum]` interval.
- A target with no enabled dynamic source remains neutral at response `1`; reducing its maximum does not silently reduce the static brush base value.
- Preset and runtime APIs enforce `0 <= minimum <= maximum <= 1`. Preset switching captures the three target bound pairs atomically so transient invalid bounds are impossible.
- Start/end taper remains outside the dynamics clamp and therefore retains authority over forced zero endpoints.
- Primitive dabs continue to carry only resolved radius, stroke opacity, and flow. No response-bound fields are added to renderer, Worker, or history payloads.
"""
)

print('M6A-050 patch applied')
