from pathlib import Path


def read(path: str) -> str:
    return Path(path).read_text()


def write(path: str, content: str) -> None:
    Path(path).write_text(content)


def replace_once(path: str, old: str, new: str) -> None:
    content = read(path)
    if old not in content:
        raise SystemExit(f'missing anchor in {path}: {old[:120]!r}')
    write(path, content.replace(old, new, 1))


# -----------------------------------------------------------------------------
# Canonical BrushPreset parameter semantics
# -----------------------------------------------------------------------------
replace_once(
    'src/domain/brush-schema.ts',
    "export type BrushPresetSectionV1 = Readonly<Record<string, JsonValue>>;\n\nexport interface BrushPresetV1 {",
    """export type BrushPresetSectionV1 = Readonly<Record<string, JsonValue>>;

export interface BrushParameterRangeV1 {
  readonly min: number;
  readonly max: number;
}

export interface BrushParameterLimitsV1 {
  readonly sizePx: BrushParameterRangeV1;
  readonly opacity: BrushParameterRangeV1;
  readonly flow: BrushParameterRangeV1;
}

export interface BrushParameterValuesV1 {
  readonly sizePx: number;
  readonly opacity: number;
  readonly flow: number;
}

export const DEFAULT_BRUSH_PARAMETER_LIMITS_V1: BrushParameterLimitsV1 = Object.freeze({
  sizePx: Object.freeze({ min: 1, max: 4096 }),
  opacity: Object.freeze({ min: 0.01, max: 1 }),
  flow: Object.freeze({ min: 0.01, max: 1 }),
});

export const DEFAULT_BRUSH_PARAMETER_VALUES_V1: BrushParameterValuesV1 = Object.freeze({
  sizePx: 16,
  opacity: 1,
  flow: 1,
});

function jsonRecord(value: JsonValue | undefined): Readonly<Record<string, JsonValue>> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Readonly<Record<string, JsonValue>>)
    : null;
}

function finiteRange(
  value: JsonValue | undefined,
  fallback: BrushParameterRangeV1,
  absoluteMin: number,
  absoluteMax: number,
): BrushParameterRangeV1 {
  const record = jsonRecord(value);
  const rawMin = record?.min;
  const rawMax = record?.max;
  if (
    typeof rawMin !== 'number' ||
    typeof rawMax !== 'number' ||
    !Number.isFinite(rawMin) ||
    !Number.isFinite(rawMax)
  ) {
    return fallback;
  }
  const min = Math.max(absoluteMin, Math.min(absoluteMax, rawMin));
  const max = Math.max(absoluteMin, Math.min(absoluteMax, rawMax));
  if (max < min) return fallback;
  return Object.freeze({ min, max });
}

export function brushParameterLimitsV1(preset: BrushPresetV1): BrushParameterLimitsV1 {
  const limits = jsonRecord(preset.extensions.parameterLimits);
  return Object.freeze({
    sizePx: finiteRange(
      limits?.sizePx,
      DEFAULT_BRUSH_PARAMETER_LIMITS_V1.sizePx,
      1,
      4096,
    ),
    opacity: finiteRange(
      limits?.opacity,
      DEFAULT_BRUSH_PARAMETER_LIMITS_V1.opacity,
      0.01,
      1,
    ),
    flow: finiteRange(limits?.flow, DEFAULT_BRUSH_PARAMETER_LIMITS_V1.flow, 0.01, 1),
  });
}

function clampToRange(value: number, range: BrushParameterRangeV1): number {
  return Math.min(range.max, Math.max(range.min, value));
}

function numericSectionValue(
  section: BrushPresetSectionV1,
  key: string,
  fallback: number,
): number {
  const value = section[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function brushParameterValuesV1(preset: BrushPresetV1): BrushParameterValuesV1 {
  const limits = brushParameterLimitsV1(preset);
  return Object.freeze({
    sizePx: clampToRange(preset.defaultSizePx, limits.sizePx),
    opacity: clampToRange(numericSectionValue(preset.ink, 'opacity', 1), limits.opacity),
    flow: clampToRange(numericSectionValue(preset.ink, 'flow', 1), limits.flow),
  });
}

export function withBrushParameterValuesV1(
  preset: BrushPresetV1,
  patch: Partial<BrushParameterValuesV1>,
): BrushPresetV1 {
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined && (typeof value !== 'number' || !Number.isFinite(value))) {
      throw new TypeError(`brush ${key} must be finite`);
    }
  }
  const limits = brushParameterLimitsV1(preset);
  const current = brushParameterValuesV1(preset);
  const sizePx = clampToRange(patch.sizePx ?? current.sizePx, limits.sizePx);
  const opacity = clampToRange(patch.opacity ?? current.opacity, limits.opacity);
  const flow = clampToRange(patch.flow ?? current.flow, limits.flow);
  return normalizeBrushPresetV1({
    ...preset,
    defaultSizePx: sizePx,
    ink: { ...preset.ink, opacity, flow },
  });
}

export interface BrushPresetV1 {""",
)

replace_once(
    'src/domain/brush-schema.ts',
    """    extensions: {},
  });
}""",
    """    extensions: {
      parameterLimits: {
        sizePx: { min: 1, max: 4096 },
        opacity: { min: 0.01, max: 1 },
        flow: { min: 0.01, max: 1 },
      },
    },
  });
}""",
)

# -----------------------------------------------------------------------------
# Preset-library parameter mutation (factory baselines remain reset anchors)
# -----------------------------------------------------------------------------
replace_once(
    'src/app/brush-preset-library.ts',
    """  createBaselineBrushPresetV1,
  normalizeBrushPresetV1,
  type BrushBehaviorV1,
  type BrushPresetV1,
} from '../domain/brush-schema.js';""",
    """  createBaselineBrushPresetV1,
  normalizeBrushPresetV1,
  withBrushParameterValuesV1,
  type BrushBehaviorV1,
  type BrushParameterValuesV1,
  type BrushPresetV1,
} from '../domain/brush-schema.js';""",
)
replace_once(
    'src/app/brush-preset-library.ts',
    """export function deleteBrushPresetV1(
  state: BrushPresetLibraryStateV1,
  presetId: string,
): BrushPresetLibraryStateV1 {""",
    """export function updateBrushPresetParametersV1(
  state: BrushPresetLibraryStateV1,
  presetId: string,
  patch: Partial<BrushParameterValuesV1>,
): BrushPresetLibraryStateV1 {
  return updateItemV1(state, presetId, (item) => {
    if (item.locked) throw new Error('locked brush preset cannot be edited');
    const current = withBrushParameterValuesV1(item.preset, patch);
    if (JSON.stringify(current) === JSON.stringify(item.preset)) return item;
    const next = normalizeBrushPresetV1({
      ...current,
      revision: item.preset.revision + 1,
    });
    return itemV1({
      source: item.source,
      baseline: item.baseline,
      preset: next,
      locked: item.locked,
    });
  });
}

export function deleteBrushPresetV1(
  state: BrushPresetLibraryStateV1,
  presetId: string,
): BrushPresetLibraryStateV1 {""",
)

# -----------------------------------------------------------------------------
# Low-level dab geometry and explicit flow/stroke-opacity semantics
# -----------------------------------------------------------------------------
replace_once(
    'src/gpu/baseline-brush.ts',
    """  readonly opacity: number;
  readonly color?: BaselineBrushColorV1;
}""",
    """  readonly opacity: number;
  readonly flow?: number;
  readonly strokeOpacity?: number;
  readonly color?: BaselineBrushColorV1;
}""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """export function baselineDabRadiusYV1(dab: BaselineBrushDabV1): number {
  return dab.radiusY ?? dab.radius;
}

export interface BaselineBrushTilePlanV1 {""",
    """export function baselineDabRadiusYV1(dab: BaselineBrushDabV1): number {
  return dab.radiusY ?? dab.radius;
}

export function baselineDabFlowV1(dab: BaselineBrushDabV1): number {
  return dab.flow ?? dab.opacity;
}

export function baselineDabStrokeOpacityV1(dab: BaselineBrushDabV1): number {
  return dab.strokeOpacity ?? 1;
}

export function baselineDabUsesFlowOpacityV1(dab: BaselineBrushDabV1): boolean {
  return dab.flow !== undefined || dab.strokeOpacity !== undefined;
}

export interface BaselineBrushTilePlanV1 {""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """function freezeDab(x: number, y: number, color: BaselineBrushColorV1): BaselineBrushDabV1 {
  return Object.freeze({
    schema: 'illustro.baseline-brush-dab/1' as const,
    x,
    y,
    radius: BASELINE_BRUSH_RADIUS_PX,
    opacity: BASELINE_BRUSH_OPACITY,
    color,
  });
}

export class BaselineBrushDabBuilderV1 {
  readonly #dabs: BaselineBrushDabV1[] = [];
  readonly #color: BaselineBrushColorV1;
  #lastPoint: { x: number; y: number } | null = null;
  #distanceUntilNext = BASELINE_BRUSH_SPACING_PX;
  #finished = false;

  constructor(options: { readonly color?: BaselineBrushColorV1 } = {}) {
    this.#color =
      options.color === undefined
        ? DEFAULT_BASELINE_BRUSH_COLOR_V1
        : freezeBaselineBrushColorV1(options.color);
  }""",
    """function freezeDab(
  x: number,
  y: number,
  radius: number,
  flow: number,
  strokeOpacity: number,
  color: BaselineBrushColorV1,
): BaselineBrushDabV1 {
  return Object.freeze({
    schema: 'illustro.baseline-brush-dab/1' as const,
    x,
    y,
    radius,
    opacity: flow * strokeOpacity,
    flow,
    strokeOpacity,
    color,
  });
}

export class BaselineBrushDabBuilderV1 {
  readonly #dabs: BaselineBrushDabV1[] = [];
  readonly #color: BaselineBrushColorV1;
  readonly #radius: number;
  readonly #spacing: number;
  readonly #flow: number;
  readonly #strokeOpacity: number;
  #lastPoint: { x: number; y: number } | null = null;
  #distanceUntilNext: number;
  #finished = false;

  constructor(
    options: {
      readonly color?: BaselineBrushColorV1;
      readonly sizePx?: number;
      readonly opacity?: number;
      readonly flow?: number;
    } = {},
  ) {
    this.#color =
      options.color === undefined
        ? DEFAULT_BASELINE_BRUSH_COLOR_V1
        : freezeBaselineBrushColorV1(options.color);
    const sizePx = options.sizePx ?? BASELINE_BRUSH_RADIUS_PX * 2;
    const opacity = options.opacity ?? BASELINE_BRUSH_OPACITY;
    const flow = options.flow ?? 1;
    if (!Number.isFinite(sizePx) || sizePx <= 0 || sizePx > 4096) {
      throw new RangeError('baseline brush size must be finite and within 0..4096 px');
    }
    if (!Number.isFinite(opacity) || opacity < 0 || opacity > 1) {
      throw new RangeError('baseline brush opacity must be within 0..1');
    }
    if (!Number.isFinite(flow) || flow < 0 || flow > 1) {
      throw new RangeError('baseline brush flow must be within 0..1');
    }
    this.#radius = sizePx / 2;
    this.#spacing = Math.max(0.25, sizePx * 0.25);
    this.#flow = flow;
    this.#strokeOpacity = opacity;
    this.#distanceUntilNext = this.#spacing;
  }""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """    this.#lastPoint = { x: sample.documentX, y: sample.documentY };
    this.#dabs.push(freezeDab(sample.documentX, sample.documentY, this.#color));
    this.#distanceUntilNext = BASELINE_BRUSH_SPACING_PX;""",
    """    this.#lastPoint = { x: sample.documentX, y: sample.documentY };
    this.#dabs.push(
      freezeDab(
        sample.documentX,
        sample.documentY,
        this.#radius,
        this.#flow,
        this.#strokeOpacity,
        this.#color,
      ),
    );
    this.#distanceUntilNext = this.#spacing;""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """      if (distance > 1e-6) this.#dabs.push(freezeDab(lastPoint.x, lastPoint.y, this.#color));""",
    """      if (distance > 1e-6) {
        this.#dabs.push(
          freezeDab(
            lastPoint.x,
            lastPoint.y,
            this.#radius,
            this.#flow,
            this.#strokeOpacity,
            this.#color,
          ),
        );
      }""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """      this.#dabs.push(freezeDab(cursorX, cursorY, this.#color));
      remaining = Math.hypot(x - cursorX, y - cursorY);
      this.#distanceUntilNext = BASELINE_BRUSH_SPACING_PX;""",
    """      this.#dabs.push(
        freezeDab(
          cursorX,
          cursorY,
          this.#radius,
          this.#flow,
          this.#strokeOpacity,
          this.#color,
        ),
      );
      remaining = Math.hypot(x - cursorX, y - cursorY);
      this.#distanceUntilNext = this.#spacing;""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """      !Number.isFinite(dab.opacity) ||
      dab.opacity < 0 ||
      dab.opacity > 1 ||
      (dab.color !== undefined &&""",
    """      !Number.isFinite(dab.opacity) ||
      dab.opacity < 0 ||
      dab.opacity > 1 ||
      (dab.flow !== undefined &&
        (!Number.isFinite(dab.flow) || dab.flow < 0 || dab.flow > 1)) ||
      (dab.strokeOpacity !== undefined &&
        (!Number.isFinite(dab.strokeOpacity) || dab.strokeOpacity < 0 || dab.strokeOpacity > 1)) ||
      (dab.color !== undefined &&""",
)

# -----------------------------------------------------------------------------
# Canonical stroke facade captures tool parameters once at stroke start
# -----------------------------------------------------------------------------
replace_once(
    'src/app/canonical-raster-brush.ts',
    """  constructor(
    options: { readonly color?: BaselineBrushColorV1; readonly mode?: CanonicalBrushModeV1 } = {},
  ) {
    this.#mode = options.mode ?? 'raster';
    this.#kernel =
      options.color === undefined
        ? new BaselineBrushDabBuilderV1()
        : new BaselineBrushDabBuilderV1({ color: options.color });
  }""",
    """  constructor(
    options: {
      readonly color?: BaselineBrushColorV1;
      readonly mode?: CanonicalBrushModeV1;
      readonly sizePx?: number;
      readonly opacity?: number;
      readonly flow?: number;
    } = {},
  ) {
    this.#mode = options.mode ?? 'raster';
    this.#kernel = new BaselineBrushDabBuilderV1({
      ...(options.color === undefined ? {} : { color: options.color }),
      ...(options.sizePx === undefined ? {} : { sizePx: options.sizePx }),
      ...(options.opacity === undefined ? {} : { opacity: options.opacity }),
      ...(options.flow === undefined ? {} : { flow: options.flow }),
    });
  }""",
)

# -----------------------------------------------------------------------------
# Paint-session runtime parameters + persistence of new dab fields
# -----------------------------------------------------------------------------
replace_once(
    'src/app/paint-session-controller.ts',
    """import {
  createCanvasSpec,
  createDocumentV1,
  type CanvasBackgroundSpec,
  type DocumentV1,
} from '../domain/document.js';""",
    """import {
  createCanvasSpec,
  createDocumentV1,
  type CanvasBackgroundSpec,
  type DocumentV1,
} from '../domain/document.js';
import {
  DEFAULT_BRUSH_PARAMETER_VALUES_V1,
  type BrushParameterValuesV1,
} from '../domain/brush-schema.js';""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """  readonly brushMode: CanonicalBrushModeV1;
  readonly brushWork: CanonicalRasterBrushWorkSnapshotV1 | null;""",
    """  readonly brushMode: CanonicalBrushModeV1;
  readonly brushParameters: BrushParameterValuesV1;
  readonly brushWork: CanonicalRasterBrushWorkSnapshotV1 | null;""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """  const opacity = finiteNumber(value.opacity, 'baseline dab opacity');
  const color =""",
    """  const opacity = finiteNumber(value.opacity, 'baseline dab opacity');
  const flow = value.flow === undefined ? undefined : finiteNumber(value.flow, 'baseline dab flow');
  const strokeOpacity =
    value.strokeOpacity === undefined
      ? undefined
      : finiteNumber(value.strokeOpacity, 'baseline dab strokeOpacity');
  const color =""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """  if (radius <= 0 || radiusX <= 0 || radiusY <= 0 || opacity < 0 || opacity > 1) {
    throw new RangeError('invalid baseline dab range');
  }
  return Object.freeze({
    schema: 'illustro.baseline-brush-dab/1' as const,
    x: finiteNumber(value.x, 'baseline dab x'),
    y: finiteNumber(value.y, 'baseline dab y'),
    radius,
    radiusX,
    radiusY,
    opacity,
    ...(color === undefined ? {} : { color }),
  });""",
    """  if (
    radius <= 0 ||
    radiusX <= 0 ||
    radiusY <= 0 ||
    opacity < 0 ||
    opacity > 1 ||
    (flow !== undefined && (flow < 0 || flow > 1)) ||
    (strokeOpacity !== undefined && (strokeOpacity < 0 || strokeOpacity > 1))
  ) {
    throw new RangeError('invalid baseline dab range');
  }
  return Object.freeze({
    schema: 'illustro.baseline-brush-dab/1' as const,
    x: finiteNumber(value.x, 'baseline dab x'),
    y: finiteNumber(value.y, 'baseline dab y'),
    radius,
    radiusX,
    radiusY,
    opacity,
    ...(flow === undefined ? {} : { flow }),
    ...(strokeOpacity === undefined ? {} : { strokeOpacity }),
    ...(color === undefined ? {} : { color }),
  });""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """  #paintColor: BaselineBrushColorV1 = DEFAULT_BASELINE_BRUSH_COLOR_V1;
  #brushMode: CanonicalBrushModeV1 = 'raster';
  #disposed = false;""",
    """  #paintColor: BaselineBrushColorV1 = DEFAULT_BASELINE_BRUSH_COLOR_V1;
  #brushMode: CanonicalBrushModeV1 = 'raster';
  #brushParameters: BrushParameterValuesV1 = DEFAULT_BRUSH_PARAMETER_VALUES_V1;
  #disposed = false;""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """      selectionAnchorLayerId: this.#selectionAnchorLayerId,
      brushMode: this.#brushMode,
      brushWork: this.#activeBrushStroke?.snapshot() ?? null,""",
    """      selectionAnchorLayerId: this.#selectionAnchorLayerId,
      brushMode: this.#brushMode,
      brushParameters: this.#brushParameters,
      brushWork: this.#activeBrushStroke?.snapshot() ?? null,""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """  brushMode(): CanonicalBrushModeV1 {
    return this.#brushMode;
  }

  setBrushMode(mode: CanonicalBrushModeIdV1): CanonicalBrushModeV1 {""",
    """  brushMode(): CanonicalBrushModeV1 {
    return this.#brushMode;
  }

  brushParameters(): BrushParameterValuesV1 {
    return this.#brushParameters;
  }

  setBrushParameters(parameters: BrushParameterValuesV1): BrushParameterValuesV1 {
    if (
      !Number.isFinite(parameters.sizePx) ||
      parameters.sizePx <= 0 ||
      parameters.sizePx > 4096 ||
      !Number.isFinite(parameters.opacity) ||
      parameters.opacity < 0 ||
      parameters.opacity > 1 ||
      !Number.isFinite(parameters.flow) ||
      parameters.flow < 0 ||
      parameters.flow > 1
    ) {
      throw new RangeError('invalid runtime brush parameters');
    }
    this.#brushParameters = Object.freeze({ ...parameters });
    return this.#brushParameters;
  }

  setBrushMode(mode: CanonicalBrushModeIdV1): CanonicalBrushModeV1 {""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """    const builder = new CanonicalRasterBrushStrokeV1({
      color: this.#paintColor,
      mode: this.#brushMode,
    });""",
    """    const parameters = this.#brushParameters;
    const builder = new CanonicalRasterBrushStrokeV1({
      color: this.#paintColor,
      mode: this.#brushMode,
      sizePx: parameters.sizePx,
      opacity: parameters.opacity,
      flow: parameters.flow,
    });""",
)

# -----------------------------------------------------------------------------
# Canonical tile painting: flow deposits accumulate, opacity caps one stroke
# -----------------------------------------------------------------------------
replace_once(
    'src/gpu/baseline-raster-tile-store.ts',
    """  baselineDabColorV1,
  baselineDabRadiusXV1,
  baselineDabRadiusYV1,
  planBaselineBrushTilesV1,""",
    """  baselineDabColorV1,
  baselineDabFlowV1,
  baselineDabRadiusXV1,
  baselineDabRadiusYV1,
  baselineDabStrokeOpacityV1,
  baselineDabUsesFlowOpacityV1,
  planBaselineBrushTilesV1,""",
)
replace_once(
    'src/gpu/baseline-raster-tile-store.ts',
    """  readonly affected: Map<string, TileCoordinateV1>;
  lastSmudgeDab: BaselineBrushDabV1 | null;
}""",
    """  readonly affected: Map<string, TileCoordinateV1>;
  readonly paintCoverage: Map<string, Float32Array>;
  paintStrokeOpacity: number | null;
  lastSmudgeDab: BaselineBrushDabV1 | null;
}""",
)
replace_once(
    'src/gpu/baseline-raster-tile-store.ts',
    """function rasterizeColorDab(
  tile: BaselineRasterTileImageV1,
  tileX: number,
  tileY: number,
  dab: BaselineBrushDabV1,
): void {
  const radiusX = baselineDabRadiusXV1(dab);""",
    """function rasterizeColorDab(
  tile: BaselineRasterTileImageV1,
  tileX: number,
  tileY: number,
  dab: BaselineBrushDabV1,
  strokeCoverage: Float32Array | null = null,
): void {
  const radiusX = baselineDabRadiusXV1(dab);""",
)
# Replace both sourceAlpha calculations through a helper inserted before the format split.
replace_once(
    'src/gpu/baseline-raster-tile-store.ts',
    """  const opacity = clamp01(dab.opacity);
  const sourceColor = baselineDabColorV1(dab);

  if (tile.pixelFormat === 'rgba8-unorm') {""",
    """  const opacity = clamp01(dab.opacity);
  const sourceColor = baselineDabColorV1(dab);
  const flow = clamp01(baselineDabFlowV1(dab));
  const strokeOpacity = clamp01(baselineDabStrokeOpacityV1(dab));
  const semanticFlowOpacity = strokeCoverage !== null && baselineDabUsesFlowOpacityV1(dab);
  const sourceAlphaForPixel = (pixel: number, coverage: number): number => {
    if (!semanticFlowOpacity || strokeCoverage === null) return clamp01(opacity * coverage);
    const deposit = clamp01(flow * coverage);
    const previousCoverage = strokeCoverage[pixel] ?? 0;
    const nextCoverage = previousCoverage + (1 - previousCoverage) * deposit;
    strokeCoverage[pixel] = nextCoverage;
    const previousEffective = clamp01(previousCoverage * strokeOpacity);
    const nextEffective = clamp01(nextCoverage * strokeOpacity);
    if (nextEffective <= previousEffective || previousEffective >= 1) return 0;
    return clamp01((nextEffective - previousEffective) / (1 - previousEffective));
  };

  if (tile.pixelFormat === 'rgba8-unorm') {""",
)
replace_once(
    'src/gpu/baseline-raster-tile-store.ts',
    """        const sourceAlpha =
          distanceSquared <= BASELINE_BRUSH_HARDNESS_SQUARED
            ? opacity
            : clamp01(
                opacity * (1 - smoothstep(BASELINE_BRUSH_HARDNESS, 1, Math.sqrt(distanceSquared))),
              );
        if (sourceAlpha <= 0) continue;

        const pixelOffset = ((documentY - tileY) * tile.width + (documentX - tileX)) * 4;""",
    """        const tipCoverage =
          distanceSquared <= BASELINE_BRUSH_HARDNESS_SQUARED
            ? 1
            : clamp01(1 - smoothstep(BASELINE_BRUSH_HARDNESS, 1, Math.sqrt(distanceSquared)));
        const pixel = (documentY - tileY) * tile.width + (documentX - tileX);
        const sourceAlpha = sourceAlphaForPixel(pixel, tipCoverage);
        if (sourceAlpha <= 0) continue;

        const pixelOffset = pixel * 4;""",
)
replace_once(
    'src/gpu/baseline-raster-tile-store.ts',
    """      const sourceAlpha =
        distanceSquared <= BASELINE_BRUSH_HARDNESS_SQUARED
          ? opacity
          : clamp01(
              opacity * (1 - smoothstep(BASELINE_BRUSH_HARDNESS, 1, Math.sqrt(distanceSquared))),
            );
      if (sourceAlpha <= 0) continue;
      const pixel = (documentY - tileY) * tile.width + (documentX - tileX);""",
    """      const tipCoverage =
        distanceSquared <= BASELINE_BRUSH_HARDNESS_SQUARED
          ? 1
          : clamp01(1 - smoothstep(BASELINE_BRUSH_HARDNESS, 1, Math.sqrt(distanceSquared)));
      const pixel = (documentY - tileY) * tile.width + (documentX - tileX);
      const sourceAlpha = sourceAlphaForPixel(pixel, tipCoverage);
      if (sourceAlpha <= 0) continue;""",
)
replace_once(
    'src/gpu/baseline-raster-tile-store.ts',
    """        before: new Map(),
        affected: new Map(),
        lastSmudgeDab: null,""",
    """        before: new Map(),
        affected: new Map(),
        paintCoverage: new Map(),
        paintStrokeOpacity: null,
        lastSmudgeDab: null,""",
)
replace_once(
    'src/gpu/baseline-raster-tile-store.ts',
    """      for (const dab of plan.dabs) {
        if (operation === 'erase') rasterizeEraseDab(tile, bounds.x, bounds.y, dab);
        else rasterizeColorDab(tile, bounds.x, bounds.y, dab);
      }""",
    """      let coverage: Float32Array | null = null;
      if (operation === 'paint' && plan.dabs.some(baselineDabUsesFlowOpacityV1)) {
        const strokeOpacity = baselineDabStrokeOpacityV1(plan.dabs[0] ?? dabs[0]!);
        if (this.#active.paintStrokeOpacity === null) {
          this.#active.paintStrokeOpacity = strokeOpacity;
        } else if (Math.abs(this.#active.paintStrokeOpacity - strokeOpacity) > 1e-9) {
          throw new Error('active paint stroke changed opacity cap');
        }
        coverage = this.#active.paintCoverage.get(key) ?? new Float32Array(tile.width * tile.height);
        this.#active.paintCoverage.set(key, coverage);
      }
      for (const dab of plan.dabs) {
        if (operation === 'erase') rasterizeEraseDab(tile, bounds.x, bounds.y, dab);
        else rasterizeColorDab(tile, bounds.x, bounds.y, dab, coverage);
      }""",
)

# -----------------------------------------------------------------------------
# Renderer carries new dab metadata and uses canonical tile preview when needed
# -----------------------------------------------------------------------------
replace_once(
    'src/gpu/baseline-paint-renderer.ts',
    """  baselineDabColorV1,
  baselineDabRadiusXV1,
  baselineDabRadiusYV1,
  planBaselineBrushTilesV1,""",
    """  baselineDabColorV1,
  baselineDabFlowV1,
  baselineDabRadiusXV1,
  baselineDabRadiusYV1,
  baselineDabStrokeOpacityV1,
  baselineDabUsesFlowOpacityV1,
  planBaselineBrushTilesV1,""",
)
replace_once(
    'src/gpu/baseline-paint-renderer.ts',
    """        opacity: dab.opacity,
        ...(dab.color === undefined""",
    """        opacity: dab.opacity,
        ...(dab.flow === undefined ? {} : { flow: dab.flow }),
        ...(dab.strokeOpacity === undefined ? {} : { strokeOpacity: dab.strokeOpacity }),
        ...(dab.color === undefined""",
)
replace_once(
    'src/gpu/baseline-paint-renderer.ts',
    """    Number.isFinite(dab.opacity) &&
    dab.opacity >= 0 &&
    dab.opacity <= 1
  );
}""",
    """    Number.isFinite(dab.opacity) &&
    dab.opacity >= 0 &&
    dab.opacity <= 1 &&
    (dab.flow === undefined ||
      (Number.isFinite(dab.flow) && dab.flow >= 0 && dab.flow <= 1)) &&
    (dab.strokeOpacity === undefined ||
      (Number.isFinite(dab.strokeOpacity) && dab.strokeOpacity >= 0 && dab.strokeOpacity <= 1))
  );
}""",
)
replace_once(
    'src/gpu/baseline-paint-renderer.ts',
    """    left.opacity === right.opacity &&
    baselineDabColorV1(left).every(""",
    """    left.opacity === right.opacity &&
    baselineDabFlowV1(left) === baselineDabFlowV1(right) &&
    baselineDabStrokeOpacityV1(left) === baselineDabStrokeOpacityV1(right) &&
    baselineDabColorV1(left).every(""",
)
replace_once(
    'src/gpu/baseline-paint-renderer.ts',
    """function isDabPrefix(
  prefix: readonly BaselineBrushDabV1[],
  complete: readonly BaselineBrushDabV1[],
): boolean {""",
    """function requiresCanonicalPaintPreview(dabs: readonly BaselineBrushDabV1[]): boolean {
  return dabs.some(
    (dab) =>
      baselineDabUsesFlowOpacityV1(dab) &&
      (baselineDabFlowV1(dab) < 1 || baselineDabStrokeOpacityV1(dab) < 1),
  );
}

function isDabPrefix(
  prefix: readonly BaselineBrushDabV1[],
  complete: readonly BaselineBrushDabV1[],
): boolean {""",
)
replace_once(
    'src/gpu/baseline-paint-renderer.ts',
    """      if (operation !== 'paint') {
        const { width, height } = this.#requireDocument();
        this.#patchCompositeTiles(
          planBaselineBrushTilesV1(delta, width, height).map((plan) => plan.coordinate),
        );
      } else {
        this.#appendDabs(delta);
      }""",
    """      if (operation !== 'paint' || requiresCanonicalPaintPreview(delta)) {
        const { width, height } = this.#requireDocument();
        this.#patchCompositeTiles(
          planBaselineBrushTilesV1(delta, width, height).map((plan) => plan.coordinate),
        );
      } else {
        this.#appendDabs(delta);
      }""",
)
# finalize has two structurally similar paint branches.
content = read('src/gpu/baseline-paint-renderer.ts')
old = """        if (operation !== 'paint') {
          this.#patchCompositeTiles(
            planBaselineBrushTilesV1(missingTail, width, height).map((plan) => plan.coordinate),
          );
        } else {
          this.#appendDabs(missingTail);
        }"""
new = """        if (operation !== 'paint' || requiresCanonicalPaintPreview(missingTail)) {
          this.#patchCompositeTiles(
            planBaselineBrushTilesV1(missingTail, width, height).map((plan) => plan.coordinate),
          );
        } else {
          this.#appendDabs(missingTail);
        }"""
if old not in content:
    raise SystemExit('missing finalize missingTail renderer anchor')
content = content.replace(old, new, 1)
old = """        if (operation !== 'paint') {
          this.#patchCompositeTiles(
            planBaselineBrushTilesV1(frozenDabs, width, height).map((plan) => plan.coordinate),
          );
        } else {
          this.#appendDabs(frozenDabs);
        }"""
new = """        if (operation !== 'paint' || requiresCanonicalPaintPreview(frozenDabs)) {
          this.#patchCompositeTiles(
            planBaselineBrushTilesV1(frozenDabs, width, height).map((plan) => plan.coordinate),
          );
        } else {
          this.#appendDabs(frozenDabs);
        }"""
if old not in content:
    raise SystemExit('missing finalize frozenDabs renderer anchor')
write('src/gpu/baseline-paint-renderer.ts', content.replace(old, new, 1))

# -----------------------------------------------------------------------------
# Worker protocol preserves new optional dab fields
# -----------------------------------------------------------------------------
replace_once(
    'src/workers/render.worker.ts',
    """    const radiusX = candidate.radiusX;
    const radiusY = candidate.radiusY;
    if (
      (radiusX !== undefined &&
        (typeof radiusX !== 'number' || !Number.isFinite(radiusX) || radiusX <= 0)) ||
      (radiusY !== undefined &&
        (typeof radiusY !== 'number' || !Number.isFinite(radiusY) || radiusY <= 0))
    ) {
      return null;
    }""",
    """    const radiusX = candidate.radiusX;
    const radiusY = candidate.radiusY;
    const flow = candidate.flow;
    const strokeOpacity = candidate.strokeOpacity;
    if (
      (radiusX !== undefined &&
        (typeof radiusX !== 'number' || !Number.isFinite(radiusX) || radiusX <= 0)) ||
      (radiusY !== undefined &&
        (typeof radiusY !== 'number' || !Number.isFinite(radiusY) || radiusY <= 0)) ||
      (flow !== undefined &&
        (typeof flow !== 'number' || !Number.isFinite(flow) || flow < 0 || flow > 1)) ||
      (strokeOpacity !== undefined &&
        (typeof strokeOpacity !== 'number' ||
          !Number.isFinite(strokeOpacity) ||
          strokeOpacity < 0 ||
          strokeOpacity > 1))
    ) {
      return null;
    }""",
)
replace_once(
    'src/workers/render.worker.ts',
    """        ...(radiusX === undefined ? {} : { radiusX }),
        ...(radiusY === undefined ? {} : { radiusY }),
        opacity: candidate.opacity,
        ...(color === undefined ? {} : { color }),""",
    """        ...(radiusX === undefined ? {} : { radiusX }),
        ...(radiusY === undefined ? {} : { radiusY }),
        opacity: candidate.opacity,
        ...(flow === undefined ? {} : { flow }),
        ...(strokeOpacity === undefined ? {} : { strokeOpacity }),
        ...(color === undefined ? {} : { color }),""",
)

# -----------------------------------------------------------------------------
# Brush Presets controller: Tool Properties UI + production-session connection
# -----------------------------------------------------------------------------
replace_once(
    'src/app/brush-preset-controller.ts',
    """import type { BrushBehaviorV1 } from '../domain/brush-schema.js';""",
    """import {
  brushParameterLimitsV1,
  brushParameterValuesV1,
  type BrushBehaviorV1,
  type BrushParameterValuesV1,
} from '../domain/brush-schema.js';""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  setBrushPresetLockedV1,
  setBrushPresetSearchV1,
  type BrushPresetLibraryStateV1,""",
    """  setBrushPresetLockedV1,
  setBrushPresetSearchV1,
  updateBrushPresetParametersV1,
  type BrushPresetLibraryStateV1,""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  const resetButton = requireElement('#brush-preset-reset', HTMLButtonElement);
  const status = requireElement('#brush-preset-status', HTMLOutputElement);
  let state = loadState(storage);""",
    """  const resetButton = requireElement('#brush-preset-reset', HTMLButtonElement);
  const status = requireElement('#brush-preset-status', HTMLOutputElement);
  const propertyStatus = requireElement('#brush-property-status', HTMLOutputElement);
  const sizeRange = requireElement('#brush-size-range', HTMLInputElement);
  const sizeNumber = requireElement('#brush-size-number', HTMLInputElement);
  const opacityRange = requireElement('#brush-opacity-range', HTMLInputElement);
  const opacityNumber = requireElement('#brush-opacity-number', HTMLInputElement);
  const flowRange = requireElement('#brush-flow-range', HTMLInputElement);
  const flowNumber = requireElement('#brush-flow-number', HTMLInputElement);
  let state = loadState(storage);""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    const item = selectedBrushPresetItemV1(state);
    input.paintSession.setBrushMode(modeForBehavior(item.preset.behavior));
    input.root.dataset.illustroBrushPreset = item.preset.id;""",
    """    const item = selectedBrushPresetItemV1(state);
    const parameters = brushParameterValuesV1(item.preset);
    input.paintSession.setBrushMode(modeForBehavior(item.preset.behavior));
    input.paintSession.setBrushParameters(parameters);
    input.root.dataset.illustroBrushPreset = item.preset.id;""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    input.root.dataset.illustroBrushPresetLocked = String(item.locked);
    input.onBrushModeChanged?.();""",
    """    input.root.dataset.illustroBrushPresetLocked = String(item.locked);
    input.root.dataset.illustroBrushSize = String(parameters.sizePx);
    input.root.dataset.illustroBrushOpacity = String(parameters.opacity);
    input.root.dataset.illustroBrushFlow = String(parameters.flow);
    input.onBrushModeChanged?.();""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    const locked = selected.locked;
    duplicateButton.disabled = false;""",
    """    const limits = brushParameterLimitsV1(selected.preset);
    const parameters = brushParameterValuesV1(selected.preset);
    const configurePair = (
      range: HTMLInputElement,
      number: HTMLInputElement,
      min: number,
      max: number,
      step: number,
      value: number,
    ): void => {
      const minText = String(min);
      const maxText = String(max);
      const stepText = String(step);
      const valueText = String(value);
      range.min = minText;
      range.max = maxText;
      range.step = stepText;
      range.value = valueText;
      number.min = minText;
      number.max = maxText;
      number.step = stepText;
      number.value = valueText;
    };
    configurePair(sizeRange, sizeNumber, limits.sizePx.min, limits.sizePx.max, 0.5, parameters.sizePx);
    configurePair(opacityRange, opacityNumber, limits.opacity.min, limits.opacity.max, 0.01, parameters.opacity);
    configurePair(flowRange, flowNumber, limits.flow.min, limits.flow.max, 0.01, parameters.flow);
    propertyStatus.textContent = `${parameters.sizePx.toFixed(1)} px · ${Math.round(parameters.opacity * 100)}% · ${Math.round(parameters.flow * 100)}%`;

    const locked = selected.locked;
    for (const control of [
      sizeRange,
      sizeNumber,
      opacityRange,
      opacityNumber,
      flowRange,
      flowNumber,
    ]) {
      control.disabled = locked;
    }
    duplicateButton.disabled = false;""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  const onReset = (): void => mutate(() => resetBrushPresetV1(state, state.selectedPresetId));

  search.addEventListener('input', onSearch);""",
    """  const onReset = (): void => mutate(() => resetBrushPresetV1(state, state.selectedPresetId));
  const updateParameter = (patch: Partial<BrushParameterValuesV1>): void =>
    mutate(() => updateBrushPresetParametersV1(state, state.selectedPresetId, patch));
  const onSizeRange = (): void => updateParameter({ sizePx: Number(sizeRange.value) });
  const onSizeNumber = (): void => updateParameter({ sizePx: Number(sizeNumber.value) });
  const onOpacityRange = (): void => updateParameter({ opacity: Number(opacityRange.value) });
  const onOpacityNumber = (): void => updateParameter({ opacity: Number(opacityNumber.value) });
  const onFlowRange = (): void => updateParameter({ flow: Number(flowRange.value) });
  const onFlowNumber = (): void => updateParameter({ flow: Number(flowNumber.value) });

  search.addEventListener('input', onSearch);""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  resetButton.addEventListener('click', onReset);

  applySelected();""",
    """  resetButton.addEventListener('click', onReset);
  sizeRange.addEventListener('input', onSizeRange);
  sizeNumber.addEventListener('change', onSizeNumber);
  opacityRange.addEventListener('input', onOpacityRange);
  opacityNumber.addEventListener('change', onOpacityNumber);
  flowRange.addEventListener('input', onFlowRange);
  flowNumber.addEventListener('change', onFlowNumber);

  applySelected();""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """      resetButton.removeEventListener('click', onReset);
    },
  });""",
    """      resetButton.removeEventListener('click', onReset);
      sizeRange.removeEventListener('input', onSizeRange);
      sizeNumber.removeEventListener('change', onSizeNumber);
      opacityRange.removeEventListener('input', onOpacityRange);
      opacityNumber.removeEventListener('change', onOpacityNumber);
      flowRange.removeEventListener('input', onFlowRange);
      flowNumber.removeEventListener('change', onFlowNumber);
    },
  });""",
)

# -----------------------------------------------------------------------------
# Inspector Tool Properties panel matching canonical white/blue visual target
# -----------------------------------------------------------------------------
replace_once(
    'src/index.html',
    """          </section>
          <section class=\"shell-inspector-card shell-color-panel\" aria-label=\"カラー\">""",
    """          </section>
          <section class=\"shell-inspector-card shell-brush-properties-panel\" aria-label=\"ブラシ設定\">
            <header class=\"shell-brush-properties-header\"><strong>ブラシ設定</strong><output id=\"brush-property-status\" aria-live=\"polite\"></output></header>
            <div class=\"shell-brush-property-grid\">
              <div class=\"shell-brush-property-row\">
                <label for=\"brush-size-range\">ブラシサイズ</label>
                <input id=\"brush-size-range\" type=\"range\" min=\"1\" max=\"4096\" step=\"0.5\" value=\"16\" />
                <span class=\"shell-brush-property-number\"><input id=\"brush-size-number\" type=\"number\" inputmode=\"decimal\" min=\"1\" max=\"4096\" step=\"0.5\" value=\"16\" aria-label=\"ブラシサイズ数値\" /><span>px</span></span>
              </div>
              <div class=\"shell-brush-property-row\">
                <label for=\"brush-opacity-range\">不透明度</label>
                <input id=\"brush-opacity-range\" type=\"range\" min=\"0.01\" max=\"1\" step=\"0.01\" value=\"1\" />
                <span class=\"shell-brush-property-number shell-brush-property-percent\"><input id=\"brush-opacity-number\" type=\"number\" inputmode=\"decimal\" min=\"0.01\" max=\"1\" step=\"0.01\" value=\"1\" aria-label=\"ブラシ不透明度数値\" /><span>×</span></span>
              </div>
              <div class=\"shell-brush-property-row\">
                <label for=\"brush-flow-range\">流量</label>
                <input id=\"brush-flow-range\" type=\"range\" min=\"0.01\" max=\"1\" step=\"0.01\" value=\"1\" />
                <span class=\"shell-brush-property-number shell-brush-property-percent\"><input id=\"brush-flow-number\" type=\"number\" inputmode=\"decimal\" min=\"0.01\" max=\"1\" step=\"0.01\" value=\"1\" aria-label=\"ブラシ流量数値\" /><span>×</span></span>
              </div>
            </div>
          </section>
          <section class=\"shell-inspector-card shell-color-panel\" aria-label=\"カラー\">""",
)

with Path('public/app-shell.css').open('a') as handle:
    handle.write("""

/* M6A Tool Properties — canonical white inspector card + blue local controls. */
.shell-brush-properties-panel {
  display: grid;
  gap: 10px;
}

.shell-brush-properties-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.shell-brush-properties-header output {
  color: var(--shell-muted, #5f6f89);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

.shell-brush-property-grid {
  display: grid;
  gap: 9px;
}

.shell-brush-property-row {
  display: grid;
  grid-template-columns: minmax(72px, auto) minmax(90px, 1fr) 82px;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}

.shell-brush-property-row > label {
  color: #1f2e46;
  white-space: nowrap;
}

.shell-brush-property-row > input[type='range'] {
  appearance: none;
  width: 100%;
  height: 18px;
  margin: 0;
  background: transparent;
  cursor: pointer;
}

.shell-brush-property-row > input[type='range']::-webkit-slider-runnable-track {
  height: 3px;
  border-radius: 999px;
  background: #acd0ff;
}

.shell-brush-property-row > input[type='range']::-webkit-slider-thumb {
  appearance: none;
  width: 14px;
  height: 14px;
  margin-top: -5.5px;
  border: 0;
  border-radius: 50%;
  background: #2d8cff;
  box-shadow: 0 0 0 2px #ffffff;
}

.shell-brush-property-row > input[type='range']::-moz-range-track {
  height: 3px;
  border: 0;
  border-radius: 999px;
  background: #acd0ff;
}

.shell-brush-property-row > input[type='range']::-moz-range-thumb {
  width: 14px;
  height: 14px;
  border: 2px solid #ffffff;
  border-radius: 50%;
  background: #2d8cff;
}

.shell-brush-property-number {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 4px;
  min-height: 30px;
  padding: 0 7px;
  border: 1px solid #dfe7f3;
  border-radius: 9px;
  background: #ffffff;
  color: #62718a;
}

.shell-brush-property-number input {
  min-width: 0;
  width: 100%;
  border: 0;
  outline: 0;
  padding: 5px 0;
  background: transparent;
  color: #16243a;
  font: inherit;
  text-align: right;
  font-variant-numeric: tabular-nums;
  appearance: textfield;
}

.shell-brush-property-number input::-webkit-inner-spin-button,
.shell-brush-property-number input::-webkit-outer-spin-button {
  appearance: none;
  margin: 0;
}

.shell-brush-property-row :disabled {
  cursor: default;
  opacity: 0.48;
}
""")

# -----------------------------------------------------------------------------
# Focused unit coverage
# -----------------------------------------------------------------------------
write(
    'tests/unit/brush-properties.test.ts',
    """import { describe, expect, it } from 'vitest';
import {
  brushParameterLimitsV1,
  brushParameterValuesV1,
  createBaselineBrushPresetV1,
  normalizeBrushPresetV1,
} from '../../src/domain/brush-schema.js';
import {
  createBrushPresetLibraryStateV1,
  selectedBrushPresetItemV1,
  setBrushPresetLockedV1,
  updateBrushPresetParametersV1,
} from '../../src/app/brush-preset-library.js';
import { CanonicalRasterBrushStrokeV1 } from '../../src/app/canonical-raster-brush.js';
import {
  BaselineRasterTileStoreV1,
  readBaselineRasterTilePixelV1,
} from '../../src/gpu/baseline-raster-tile-store.js';

describe('M6A-013..016 brush properties', () => {
  it('generates size-relative radius and spacing from the captured stroke size', () => {
    const stroke = new CanonicalRasterBrushStrokeV1({ sizePx: 40 });
    stroke.beginConfirmed({ documentX: 0, documentY: 0 });
    stroke.appendConfirmed([{ documentX: 20, documentY: 0 }]);
    expect(stroke.dabs().map((dab) => dab.x)).toEqual([0, 10, 20]);
    expect(stroke.dabs().every((dab) => dab.radius === 20)).toBe(true);
  });

  it('stores opacity as a stroke cap and flow as per-dab deposit', () => {
    const stroke = new CanonicalRasterBrushStrokeV1({ opacity: 0.5, flow: 0.25 });
    const [dab] = stroke.beginConfirmed({ documentX: 16, documentY: 16 });
    expect(dab).toMatchObject({ opacity: 0.125, flow: 0.25, strokeOpacity: 0.5 });
  });

  it('caps accumulated paint alpha at stroke opacity while repeated flow deposits build toward it', () => {
    const stroke = new CanonicalRasterBrushStrokeV1({ sizePx: 16, opacity: 0.5, flow: 0.25 });
    const [dab] = stroke.beginConfirmed({ documentX: 16, documentY: 16 });
    expect(dab).toBeDefined();
    const store = new BaselineRasterTileStoreV1(64, 64, 'rgba8-unorm', [
      Object.freeze({ layerId: 'layer-1', visible: true, opacity: 1 }),
    ]);
    const repeated = Array.from({ length: 32 }, () => dab!);
    store.applyDabs('layer-1', 'stroke-1', repeated, 'paint');
    store.finalize('stroke-1');
    const tile = store.exportTiles()[0];
    expect(tile).toBeDefined();
    const alpha = readBaselineRasterTilePixelV1(tile!, 16 * 64 + 16)[3];
    expect(alpha).toBeGreaterThan(0.45);
    expect(alpha).toBeLessThanOrEqual(0.505);
  });

  it('enforces parameter limits stored per preset and marks edits Modified/resettable', () => {
    const custom = normalizeBrushPresetV1({
      ...createBaselineBrushPresetV1({
        id: 'limited',
        name: 'Limited',
        category: 'Test',
        behavior: 'paint',
      }),
      extensions: {
        parameterLimits: {
          sizePx: { min: 4, max: 64 },
          opacity: { min: 0.2, max: 0.8 },
          flow: { min: 0.1, max: 0.6 },
        },
      },
    });
    expect(brushParameterLimitsV1(custom)).toEqual({
      sizePx: { min: 4, max: 64 },
      opacity: { min: 0.2, max: 0.8 },
      flow: { min: 0.1, max: 0.6 },
    });
    expect(brushParameterValuesV1(custom)).toEqual({ sizePx: 16, opacity: 0.8, flow: 0.6 });

    let state = createBrushPresetLibraryStateV1([custom]);
    state = updateBrushPresetParametersV1(state, 'limited', {
      sizePx: 999,
      opacity: 0.05,
      flow: 1,
    });
    expect(brushParameterValuesV1(selectedBrushPresetItemV1(state).preset)).toEqual({
      sizePx: 64,
      opacity: 0.2,
      flow: 0.6,
    });
    expect(selectedBrushPresetItemV1(state).modified).toBe(true);
    state = setBrushPresetLockedV1(state, 'limited', true);
    expect(() => updateBrushPresetParametersV1(state, 'limited', { sizePx: 32 })).toThrow(/locked/);
  });
});
""",
)

# -----------------------------------------------------------------------------
# Contract verifier, progress and canonical design memo
# -----------------------------------------------------------------------------
replace_once(
    'scripts/verify-m6a-brush.mjs',
    """requireText(
  progress,
  'M6A-013 brush size:未完了',
  'future brush-size status was incorrectly advanced',
);""",
    """for (const item of [
  'M6A-013 brush size:完了',
  'M6A-014 opacity:完了',
  'M6A-015 flow/density:完了',
  'M6A-016 per-brush parameter limits:完了',
]) {
  requireText(progress, item, `${item.split(':')[0]} progress is not complete`);
}
requireText(
  read('src/domain/brush-schema.ts'),
  'brushParameterLimitsV1',
  'per-brush parameter limits are missing',
);
requireText(
  read('src/app/paint-session-controller.ts'),
  'setBrushParameters',
  'brush properties are not connected to the production paint session',
);
requireText(
  read('src/gpu/baseline-brush.ts'),
  'baselineDabStrokeOpacityV1',
  'flow/stroke-opacity dab semantics are missing',
);
requireText(
  read('src/gpu/baseline-raster-tile-store.ts'),
  'paintCoverage',
  'stroke-opacity accumulation state is missing',
);
requireText(
  read('src/index.html'),
  'id=\"brush-size-range\"',
  'reachable brush-size Tool Properties control missing',
);
requireText(
  read('tests/unit/brush-properties.test.ts'),
  'caps accumulated paint alpha',
  'brush opacity/flow regression coverage missing',
);""",
)

progress = read('IMPLEMENTATION_PROGRESS.md')
for old, new in [
    ('M6A-013 brush size:未完了', 'M6A-013 brush size:完了'),
    ('M6A-014 opacity:未完了', 'M6A-014 opacity:完了'),
    ('M6A-015 flow/density:未完了', 'M6A-015 flow/density:完了'),
    ('M6A-016 per-brush parameter limits:未完了', 'M6A-016 per-brush parameter limits:完了'),
]:
    if old not in progress:
        raise SystemExit(f'missing progress marker: {old}')
    progress = progress.replace(old, new, 1)
resume = 'M6A-012 preset reset:完了\n'
if resume in progress:
    progress = progress.replace(
        resume,
        resume
        + '再開メモ: M6A-005〜012 Brush Preset管理はfactory baselineを不変reset anchorとして保持し、user/factory overrideをlocal persistenceへ保存する構成で完了。M6A-013〜016ではTool Propertiesのsize/opacity/flowを選択presetへ保存し、stroke開始時に値をcaptureする。flowはdabごとのdeposit、opacityはpaint stroke全体のalpha上限としてcanonical Raster Tile上で累積し、低opacity/flow時のinteractive previewはcanonical changed Tileをpatchして最終結果と一致させる。各presetはextensions.parameterLimitsに独立したmin/maxを保持でき、UIと更新APIがその範囲を強制する。次はM6A-017 procedural tipから再開する。\n',
        1,
    )
write('IMPLEMENTATION_PROGRESS.md', progress)

with Path('ILLUSTRO_DESIGN_MEMO.md').open('a') as handle:
    handle.write("""

### M6A Brush Tool Properties semantic boundary — 2026-09-03

- Brush size, opacity and flow are selected-brush parameters, persisted with the Brush Preset workspace library rather than document history. Selecting a preset applies its effective values to the production PaintSession; the values are captured when a stroke starts so later UI edits do not mutate an in-progress or already persisted stroke.
- `sizePx` is brush diameter in document pixels. The current procedural round kernel derives radius as `sizePx / 2`; its baseline spacing remains the already-adopted 25% size ratio until the dedicated M6A-023 spacing control supersedes that default.
- Paint `flow` is per-dab pigment/alpha deposit. Paint `opacity` is a whole-stroke alpha cap. Repeated overlapping dabs therefore build toward, but do not exceed, the selected stroke opacity. This distinction is canonical Raster Tile behavior, not merely UI labeling.
- For Eraser/Smudge/Blur at this stage, the same captured opacity and flow values combine into the per-dab effect strength. Their deeper pickup/dynamics semantics remain assigned to later dedicated M6A items.
- Each `illustro.brush/1` preset may carry independent size/opacity/flow min/max limits in `extensions.parameterLimits`. Runtime controls and preset mutation clamp to those limits. Missing/invalid limits fall back to safe canonical defaults, preserving compatibility with older stored/imported presets.
- Tool Properties UI follows the canonical visual reference: compact white Inspector card, thin separators, blue local slider accents, numeric entry beside direct manipulation, and no Android-native color/control surface substituted for application UI.
""")
