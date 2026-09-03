import {
  CANONICAL_TILE_SIZE_PX,
  tileBoundsForDocumentV1,
  tileKeyV1,
  type RectV1,
  type TileCoordinateV1,
} from './sparse-tile-model.js';

export const BASELINE_BRUSH_RADIUS_PX = 8 as const;
export const BASELINE_BRUSH_SPACING_PX = 4 as const;
export const BASELINE_BRUSH_SPACING_RATIO = 0.25 as const;
export const BASELINE_BRUSH_MINIMUM_STAMP_DISTANCE_PX = 1 as const;
export const BASELINE_BRUSH_START_TAPER_LENGTH_PX = 0 as const;
export const BASELINE_BRUSH_END_TAPER_LENGTH_PX = 0 as const;
export const BASELINE_BRUSH_SIZE_TAPER_MINIMUM_RATIO = 0 as const;
export const BASELINE_BRUSH_OPACITY = 1 as const;
export const BASELINE_BRUSH_HARDNESS = 0.85 as const;
export const BASELINE_BRUSH_TIP_DENSITY = 1 as const;
export const BASELINE_BRUSH_TIP_ANGLE_DEGREES = 0 as const;
export const BASELINE_BRUSH_TIP_DIRECTION_DEGREES = 0 as const;
export type BaselineBrushColorV1 = readonly [number, number, number];
export type BaselineBrushTipShapeV1 = 'round' | 'square' | 'sampled-image';
export type BaselineBrushTipSelectionModeV1 = 'fixed' | 'sequence' | 'random-per-stamp';

export const BASELINE_SAMPLED_IMAGE_TIP_SIDE_V1 = 5 as const;
export const BASELINE_SAMPLED_IMAGE_TIP_ALPHA_V1 = Object.freeze([
  0, 42, 86, 34, 0, 28, 134, 218, 112, 18, 72, 230, 255, 184, 38, 36, 152, 206, 96, 12, 0, 48, 104,
  24, 0,
] as const);
export type BaselineBrushSampledTipAlphaV1 = readonly number[];

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
export type BaselineBrushCompositeOperationV1 = 'paint' | 'erase' | 'smudge' | 'blur';
export const DEFAULT_BASELINE_BRUSH_COLOR_V1: BaselineBrushColorV1 = Object.freeze([0, 0, 0]);

export function freezeBaselineBrushColorV1(color: readonly number[]): BaselineBrushColorV1 {
  if (
    color.length !== 3 ||
    color.some((component) => !Number.isFinite(component) || component < 0 || component > 1)
  ) {
    throw new RangeError('baseline brush RGB components must be finite values in 0..1');
  }
  return Object.freeze([color[0] ?? 0, color[1] ?? 0, color[2] ?? 0]);
}

export interface BaselineBrushSampleV1 {
  readonly documentX: number;
  readonly documentY: number;
}

export interface BaselineBrushDabV1 {
  readonly schema: 'illustro.baseline-brush-dab/1';
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly radiusX?: number;
  readonly radiusY?: number;
  readonly opacity: number;
  readonly flow?: number;
  readonly strokeOpacity?: number;
  readonly hardness?: number;
  readonly tipDensity?: number;
  readonly tipAngleDegrees?: number;
  readonly tipShape?: BaselineBrushTipShapeV1;
  readonly color?: BaselineBrushColorV1;
}

export function baselineDabColorV1(dab: BaselineBrushDabV1): BaselineBrushColorV1 {
  return dab.color ?? DEFAULT_BASELINE_BRUSH_COLOR_V1;
}

export function baselineDabRadiusXV1(dab: BaselineBrushDabV1): number {
  return dab.radiusX ?? dab.radius;
}

export function baselineDabRadiusYV1(dab: BaselineBrushDabV1): number {
  return dab.radiusY ?? dab.radius;
}

export function baselineDabFlowV1(dab: BaselineBrushDabV1): number {
  return dab.flow ?? dab.opacity;
}

export function baselineDabStrokeOpacityV1(dab: BaselineBrushDabV1): number {
  return dab.strokeOpacity ?? 1;
}

export function baselineDabHardnessV1(dab: BaselineBrushDabV1): number {
  return dab.hardness ?? BASELINE_BRUSH_HARDNESS;
}
export function baselineDabTipDensityV1(dab: BaselineBrushDabV1): number {
  return dab.tipDensity ?? BASELINE_BRUSH_TIP_DENSITY;
}

export function normalizeBaselineBrushTipAngleDegreesV1(angleDegrees: number): number {
  if (!Number.isFinite(angleDegrees))
    throw new TypeError('baseline brush tip angle must be finite');
  const normalized = ((angleDegrees % 360) + 360) % 360;
  return Object.is(normalized, -0) ? 0 : normalized;
}

export function baselineDabTipAngleDegreesV1(dab: BaselineBrushDabV1): number {
  return normalizeBaselineBrushTipAngleDegreesV1(
    dab.tipAngleDegrees ?? BASELINE_BRUSH_TIP_ANGLE_DEGREES,
  );
}

export function baselineDabExtentXV1(dab: BaselineBrushDabV1): number {
  const radiusX = baselineDabRadiusXV1(dab);
  const radiusY = baselineDabRadiusYV1(dab);
  const angle = (baselineDabTipAngleDegreesV1(dab) * Math.PI) / 180;
  const cos = Math.abs(Math.cos(angle));
  const sin = Math.abs(Math.sin(angle));
  return dab.tipShape === 'square'
    ? radiusX * cos + radiusY * sin
    : Math.hypot(radiusX * cos, radiusY * sin);
}

export function baselineDabExtentYV1(dab: BaselineBrushDabV1): number {
  const radiusX = baselineDabRadiusXV1(dab);
  const radiusY = baselineDabRadiusYV1(dab);
  const angle = (baselineDabTipAngleDegreesV1(dab) * Math.PI) / 180;
  const cos = Math.abs(Math.cos(angle));
  const sin = Math.abs(Math.sin(angle));
  return dab.tipShape === 'square'
    ? radiusX * sin + radiusY * cos
    : Math.hypot(radiusX * sin, radiusY * cos);
}

export function baselineDabUsesFlowOpacityV1(dab: BaselineBrushDabV1): boolean {
  return dab.flow !== undefined || dab.strokeOpacity !== undefined;
}

export interface BaselineBrushTilePlanV1 {
  readonly coordinate: TileCoordinateV1;
  readonly dirtyRect: RectV1;
  readonly dabs: readonly BaselineBrushDabV1[];
}

function assertFinitePoint(sample: BaselineBrushSampleV1): void {
  if (!Number.isFinite(sample.documentX) || !Number.isFinite(sample.documentY)) {
    throw new RangeError('baseline brush samples require finite document coordinates');
  }
}

function freezeDab(
  x: number,
  y: number,
  radius: number,
  flow: number,
  strokeOpacity: number,
  hardness: number,
  tipDensity: number,
  tipAngleDegrees: number,
  color: BaselineBrushColorV1,
  tipShape: Exclude<BaselineBrushTipShapeV1, 'sampled-image'>,
): BaselineBrushDabV1 {
  return Object.freeze({
    schema: 'illustro.baseline-brush-dab/1' as const,
    x,
    y,
    radius,
    opacity: flow * strokeOpacity,
    flow,
    strokeOpacity,
    hardness,
    tipDensity,
    tipAngleDegrees,
    tipShape,
    color,
  });
}

function pushBaselineBrushStampV1(
  target: BaselineBrushDabV1[],
  x: number,
  y: number,
  radius: number,
  flow: number,
  strokeOpacity: number,
  hardness: number,
  tipDensity: number,
  tipAngleDegrees: number,
  color: BaselineBrushColorV1,
  tipShape: BaselineBrushTipShapeV1,
  sampledTipAlpha: BaselineBrushSampledTipAlphaV1,
): void {
  if (tipShape !== 'sampled-image') {
    target.push(
      freezeDab(
        x,
        y,
        radius,
        flow,
        strokeOpacity,
        hardness,
        tipDensity,
        tipAngleDegrees,
        color,
        tipShape,
      ),
    );
    return;
  }

  const side = BASELINE_SAMPLED_IMAGE_TIP_SIDE_V1;
  const alphaImage = sampledTipAlpha;
  const microRadius = (radius / side) * 1.1;
  const angle = (tipAngleDegrees * Math.PI) / 180;
  const angleCos = Math.cos(angle);
  const angleSin = Math.sin(angle);
  const centerIndex = Math.floor(side / 2) * side + Math.floor(side / 2);
  const emit = (index: number): void => {
    const alphaByte = alphaImage[index] ?? 0;
    if (alphaByte <= 0) return;
    const row = Math.floor(index / side);
    const column = index % side;
    const offsetX = ((column + 0.5) / side - 0.5) * radius * 2;
    const offsetY = ((row + 0.5) / side - 0.5) * radius * 2;
    const rotatedOffsetX = offsetX * angleCos - offsetY * angleSin;
    const rotatedOffsetY = offsetX * angleSin + offsetY * angleCos;
    target.push(
      freezeDab(
        x + rotatedOffsetX,
        y + rotatedOffsetY,
        microRadius,
        flow * (alphaByte / 255),
        strokeOpacity,
        hardness,
        tipDensity,
        tipAngleDegrees,
        color,
        'round',
      ),
    );
  };

  for (let index = 0; index < alphaImage.length; index += 1) {
    if (index !== centerIndex) emit(index);
  }
  // Keep the center primitive last so existing finish detection remains tied to the logical stamp center.
  emit(centerIndex);
}

function deterministicBrushTipIndexV1(seed: number, stampIndex: number, count: number): number {
  let value = (seed ^ Math.imul((stampIndex + 1) >>> 0, 0x9e3779b1)) >>> 0;
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d) >>> 0;
  value ^= value >>> 15;
  value = Math.imul(value, 0x846ca68b) >>> 0;
  value ^= value >>> 16;
  return value % count;
}

interface BaselineLogicalStampRecordV1 {
  readonly x: number;
  readonly y: number;
  readonly tipAngleDegrees: number;
  readonly pathDistancePx: number;
  readonly sampledTipAlpha: BaselineBrushSampledTipAlphaV1;
  primitiveStart: number;
  primitiveEnd: number;
}

export class BaselineBrushDabBuilderV1 {
  readonly #dabs: BaselineBrushDabV1[] = [];
  readonly #color: BaselineBrushColorV1;
  readonly #radius: number;
  readonly #spacing: number;
  readonly #startTaperLengthPx: number;
  readonly #endTaperLengthPx: number;
  readonly #sizeTaperMinimumRatio: number;
  readonly #flow: number;
  readonly #strokeOpacity: number;
  readonly #hardness: number;
  readonly #tipDensity: number;
  readonly #tipAngleDegrees: number;
  readonly #tipDirectionDegrees: number;
  readonly #followStrokeRotation: boolean;
  readonly #tipShape: BaselineBrushTipShapeV1;
  readonly #sampledTipAlphas: readonly BaselineBrushSampledTipAlphaV1[];
  readonly #tipSelectionMode: BaselineBrushTipSelectionModeV1;
  readonly #tipSelectionStartIndex: number;
  readonly #tipSelectionSeed: number;
  readonly #logicalStamps: BaselineLogicalStampRecordV1[] = [];
  #logicalStampIndex = 0;
  #pathDistancePx = 0;
  #lastPoint: { x: number; y: number } | null = null;
  #lastStampPoint: { x: number; y: number } | null = null;
  #lastStrokeDirectionDegrees: number | null = null;
  #distanceUntilNext: number;
  #finished = false;

  constructor(
    options: {
      readonly color?: BaselineBrushColorV1;
      readonly sizePx?: number;
      readonly opacity?: number;
      readonly flow?: number;
      readonly spacingRatio?: number;
      readonly minimumStampDistancePx?: number;
      readonly startTaperLengthPx?: number;
      readonly endTaperLengthPx?: number;
      readonly sizeTaperMinimumRatio?: number;
      readonly hardness?: number;
      readonly tipDensity?: number;
      readonly tipAngleDegrees?: number;
      readonly tipDirectionDegrees?: number;
      readonly followStrokeRotation?: boolean;
      readonly tipShape?: BaselineBrushTipShapeV1;
      readonly sampledTipAlpha?: readonly number[];
      readonly sampledTipAlphas?: readonly (readonly number[])[];
      readonly tipSelectionMode?: BaselineBrushTipSelectionModeV1;
      readonly tipSelectionStartIndex?: number;
      readonly tipSelectionSeed?: number;
    } = {},
  ) {
    this.#color =
      options.color === undefined
        ? DEFAULT_BASELINE_BRUSH_COLOR_V1
        : freezeBaselineBrushColorV1(options.color);
    const sizePx = options.sizePx ?? BASELINE_BRUSH_RADIUS_PX * 2;
    const opacity = options.opacity ?? BASELINE_BRUSH_OPACITY;
    const flow = options.flow ?? 1;
    const spacingRatio = options.spacingRatio ?? BASELINE_BRUSH_SPACING_RATIO;
    const minimumStampDistancePx =
      options.minimumStampDistancePx ?? BASELINE_BRUSH_MINIMUM_STAMP_DISTANCE_PX;
    const startTaperLengthPx = options.startTaperLengthPx ?? BASELINE_BRUSH_START_TAPER_LENGTH_PX;
    const endTaperLengthPx = options.endTaperLengthPx ?? BASELINE_BRUSH_END_TAPER_LENGTH_PX;
    const sizeTaperMinimumRatio =
      options.sizeTaperMinimumRatio ?? BASELINE_BRUSH_SIZE_TAPER_MINIMUM_RATIO;
    const hardness = options.hardness ?? BASELINE_BRUSH_HARDNESS;
    const tipDensity = options.tipDensity ?? BASELINE_BRUSH_TIP_DENSITY;
    const tipAngleDegrees = normalizeBaselineBrushTipAngleDegreesV1(
      options.tipAngleDegrees ?? BASELINE_BRUSH_TIP_ANGLE_DEGREES,
    );
    const tipDirectionDegrees = normalizeBaselineBrushTipAngleDegreesV1(
      options.tipDirectionDegrees ?? BASELINE_BRUSH_TIP_DIRECTION_DEGREES,
    );
    const followStrokeRotation = options.followStrokeRotation ?? false;
    if (typeof followStrokeRotation !== 'boolean') {
      throw new TypeError('baseline brush follow rotation must be boolean');
    }
    if (!Number.isFinite(sizePx) || sizePx <= 0 || sizePx > 4096) {
      throw new RangeError('baseline brush size must be finite and within 0..4096 px');
    }
    if (!Number.isFinite(opacity) || opacity < 0 || opacity > 1) {
      throw new RangeError('baseline brush opacity must be within 0..1');
    }
    if (!Number.isFinite(flow) || flow < 0 || flow > 1) {
      throw new RangeError('baseline brush flow must be within 0..1');
    }
    if (!Number.isFinite(spacingRatio) || spacingRatio < 0.01 || spacingRatio > 4) {
      throw new RangeError('baseline brush spacing ratio must be within 0.01..4');
    }
    if (
      !Number.isFinite(minimumStampDistancePx) ||
      minimumStampDistancePx <= 0 ||
      minimumStampDistancePx > 4096
    ) {
      throw new RangeError('baseline brush minimum stamp distance must be within 0..4096 px');
    }
    if (
      !Number.isFinite(startTaperLengthPx) ||
      startTaperLengthPx < 0 ||
      startTaperLengthPx > 4096
    ) {
      throw new RangeError('baseline brush start taper length must be within 0..4096 px');
    }
    if (!Number.isFinite(endTaperLengthPx) || endTaperLengthPx < 0 || endTaperLengthPx > 4096) {
      throw new RangeError('baseline brush end taper length must be within 0..4096 px');
    }
    if (
      !Number.isFinite(sizeTaperMinimumRatio) ||
      sizeTaperMinimumRatio < 0 ||
      sizeTaperMinimumRatio > 1
    ) {
      throw new RangeError('baseline brush size taper minimum ratio must be within 0..1');
    }
    if (!Number.isFinite(hardness) || hardness < 0 || hardness > 1) {
      throw new RangeError('baseline brush hardness must be within 0..1');
    }
    if (!Number.isFinite(tipDensity) || tipDensity < 0 || tipDensity > 1) {
      throw new RangeError('baseline brush tip density must be within 0..1');
    }
    this.#radius = sizePx / 2;
    this.#spacing = Math.max(minimumStampDistancePx, sizePx * spacingRatio);
    this.#startTaperLengthPx = startTaperLengthPx;
    this.#endTaperLengthPx = endTaperLengthPx;
    this.#sizeTaperMinimumRatio = sizeTaperMinimumRatio;
    this.#flow = flow;
    this.#strokeOpacity = opacity;
    this.#hardness = hardness;
    this.#tipDensity = tipDensity;
    this.#tipAngleDegrees = tipAngleDegrees;
    this.#tipDirectionDegrees = tipDirectionDegrees;
    this.#followStrokeRotation = followStrokeRotation;
    this.#tipShape = options.tipShape ?? 'round';
    if (
      this.#tipShape !== 'round' &&
      this.#tipShape !== 'square' &&
      this.#tipShape !== 'sampled-image'
    ) {
      throw new TypeError('unsupported baseline brush tip shape');
    }
    const primarySampledTipAlpha = freezeBaselineBrushSampledTipAlphaV1(
      options.sampledTipAlpha ?? BASELINE_SAMPLED_IMAGE_TIP_ALPHA_V1,
    );
    const providedAlternatives = options.sampledTipAlphas ?? [];
    if (providedAlternatives.length > 64) {
      throw new RangeError('baseline brush sampled tip alternatives exceed 64 items');
    }
    this.#sampledTipAlphas = Object.freeze(
      providedAlternatives.length === 0
        ? [primarySampledTipAlpha]
        : providedAlternatives.map((alpha) => freezeBaselineBrushSampledTipAlphaV1(alpha)),
    );
    const tipSelectionMode = options.tipSelectionMode ?? 'fixed';
    if (
      tipSelectionMode !== 'fixed' &&
      tipSelectionMode !== 'sequence' &&
      tipSelectionMode !== 'random-per-stamp'
    ) {
      throw new TypeError('unsupported baseline brush tip selection mode');
    }
    const tipSelectionStartIndex = options.tipSelectionStartIndex ?? 0;
    if (
      !Number.isSafeInteger(tipSelectionStartIndex) ||
      tipSelectionStartIndex < 0 ||
      tipSelectionStartIndex >= this.#sampledTipAlphas.length
    ) {
      throw new RangeError('baseline brush tip selection start index is out of range');
    }
    const tipSelectionSeed = options.tipSelectionSeed ?? 0;
    if (
      !Number.isSafeInteger(tipSelectionSeed) ||
      tipSelectionSeed < 0 ||
      tipSelectionSeed > 0xffffffff
    ) {
      throw new RangeError('baseline brush tip selection seed must be uint32');
    }
    this.#tipSelectionMode = tipSelectionMode;
    this.#tipSelectionStartIndex = tipSelectionStartIndex;
    this.#tipSelectionSeed = tipSelectionSeed >>> 0;
    this.#distanceUntilNext = this.#spacing;
  }

  begin(sample: BaselineBrushSampleV1): readonly BaselineBrushDabV1[] {
    this.beginDelta(sample);
    return this.dabs();
  }

  beginDelta(sample: BaselineBrushSampleV1): readonly BaselineBrushDabV1[] {
    if (this.#lastPoint !== null) throw new Error('baseline brush dab builder has already begun');
    if (this.#finished) throw new Error('baseline brush dab builder is finished');
    assertFinitePoint(sample);
    const start = this.#dabs.length;
    this.#lastPoint = { x: sample.documentX, y: sample.documentY };
    this.#pushLogicalStamp(sample.documentX, sample.documentY, this.#resolvedTipAngleDegrees(), 0);
    this.#lastStampPoint = { x: sample.documentX, y: sample.documentY };
    this.#distanceUntilNext = this.#spacing;
    return this.#deltaFrom(start);
  }

  append(samples: readonly BaselineBrushSampleV1[]): readonly BaselineBrushDabV1[] {
    this.appendDelta(samples);
    return this.dabs();
  }

  appendDelta(samples: readonly BaselineBrushSampleV1[]): readonly BaselineBrushDabV1[] {
    if (this.#finished) throw new Error('baseline brush dab builder is finished');
    const start = this.#dabs.length;
    if (this.#lastPoint === null) {
      const first = samples[0];
      if (first === undefined) return Object.freeze([]);
      this.beginDelta(first);
      for (const sample of samples.slice(1)) {
        assertFinitePoint(sample);
        this.#appendPoint(sample.documentX, sample.documentY);
      }
      return this.#deltaFrom(start);
    }

    for (const sample of samples) {
      assertFinitePoint(sample);
      this.#appendPoint(sample.documentX, sample.documentY);
    }
    return this.#deltaFrom(start);
  }

  finish(): readonly BaselineBrushDabV1[] {
    this.finishDelta();
    return this.dabs();
  }

  finishDelta(): readonly BaselineBrushDabV1[] {
    if (this.#finished) return Object.freeze([]);
    const start = this.#dabs.length;
    const lastPoint = this.#lastPoint;
    const lastStampPoint = this.#lastStampPoint;
    if (lastPoint !== null && lastStampPoint !== null) {
      const distance = Math.hypot(lastPoint.x - lastStampPoint.x, lastPoint.y - lastStampPoint.y);
      if (distance > 1e-6) {
        this.#pushLogicalStamp(
          lastPoint.x,
          lastPoint.y,
          this.#resolvedTipAngleDegrees(this.#lastStrokeDirectionDegrees ?? undefined),
          this.#pathDistancePx,
        );
      }
    }
    if (this.#endTaperLengthPx > 0) this.#reconcileEndTaper();
    this.#finished = true;
    return this.#endTaperLengthPx > 0 ? Object.freeze([]) : this.#deltaFrom(start);
  }

  dabCount(): number {
    return this.#dabs.length;
  }

  mutableTailDabCount(): number {
    if (this.#finished || this.#endTaperLengthPx <= 0 || this.#logicalStamps.length === 0) return 0;
    const threshold = this.#pathDistancePx - this.#endTaperLengthPx;
    const firstMutable = this.#logicalStamps.find(
      (stamp) => stamp.pathDistancePx > threshold + 1e-9,
    );
    return firstMutable === undefined ? 0 : this.#dabs.length - firstMutable.primitiveStart;
  }

  stablePrefixDabCount(): number {
    return this.#dabs.length - this.mutableTailDabCount();
  }

  dabs(): readonly BaselineBrushDabV1[] {
    return Object.freeze([...this.#dabs]);
  }

  #deltaFrom(start: number): readonly BaselineBrushDabV1[] {
    return Object.freeze(this.#dabs.slice(start));
  }

  #sampledTipAlphaForLogicalStamp(): BaselineBrushSampledTipAlphaV1 {
    const count = this.#sampledTipAlphas.length;
    let index = this.#tipSelectionStartIndex;
    if (this.#tipSelectionMode === 'sequence') {
      index = (this.#tipSelectionStartIndex + this.#logicalStampIndex) % count;
    } else if (this.#tipSelectionMode === 'random-per-stamp') {
      index = deterministicBrushTipIndexV1(this.#tipSelectionSeed, this.#logicalStampIndex, count);
    }
    return this.#sampledTipAlphas[index] ?? this.#sampledTipAlphas[0]!;
  }

  #startEnvelopeAtDistance(pathDistancePx: number): number {
    if (this.#startTaperLengthPx <= 0) return 1;
    return Math.max(0, Math.min(1, pathDistancePx / this.#startTaperLengthPx));
  }

  #endEnvelopeAtDistance(pathDistancePx: number, totalDistancePx: number): number {
    if (this.#endTaperLengthPx <= 0) return 1;
    return Math.max(0, Math.min(1, (totalDistancePx - pathDistancePx) / this.#endTaperLengthPx));
  }

  #sizeTaperScale(envelope: number): number {
    return this.#sizeTaperMinimumRatio + (1 - this.#sizeTaperMinimumRatio) * envelope;
  }

  #emitLogicalStamp(
    target: BaselineBrushDabV1[],
    stamp: Pick<BaselineLogicalStampRecordV1, 'x' | 'y' | 'tipAngleDegrees' | 'sampledTipAlpha'>,
    envelope: number,
  ): void {
    if (envelope <= 0) return;
    const sizeScale = this.#sizeTaperScale(envelope);
    pushBaselineBrushStampV1(
      target,
      stamp.x,
      stamp.y,
      this.#radius * sizeScale,
      this.#flow * envelope,
      this.#strokeOpacity,
      this.#hardness,
      this.#tipDensity,
      stamp.tipAngleDegrees,
      this.#color,
      this.#tipShape,
      stamp.sampledTipAlpha,
    );
  }

  #pushLogicalStamp(x: number, y: number, tipAngleDegrees: number, pathDistancePx: number): void {
    const startEnvelope = this.#startEnvelopeAtDistance(pathDistancePx);
    if (startEnvelope <= 0) return;
    const sampledTipAlpha = this.#sampledTipAlphaForLogicalStamp();
    const record: BaselineLogicalStampRecordV1 = {
      x,
      y,
      tipAngleDegrees,
      pathDistancePx,
      sampledTipAlpha,
      primitiveStart: this.#dabs.length,
      primitiveEnd: this.#dabs.length,
    };
    this.#emitLogicalStamp(this.#dabs, record, startEnvelope);
    record.primitiveEnd = this.#dabs.length;
    if (record.primitiveEnd === record.primitiveStart) return;
    this.#logicalStamps.push(record);
    this.#logicalStampIndex += 1;
  }

  #reconcileEndTaper(): void {
    if (this.#endTaperLengthPx <= 0 || this.#logicalStamps.length === 0) return;
    const totalDistancePx = this.#pathDistancePx;
    const firstTailIndex = this.#logicalStamps.findIndex(
      (stamp) => this.#endEnvelopeAtDistance(stamp.pathDistancePx, totalDistancePx) < 1 - 1e-9,
    );
    if (firstTailIndex < 0) return;
    const firstTail = this.#logicalStamps[firstTailIndex];
    if (firstTail === undefined) return;
    this.#dabs.length = firstTail.primitiveStart;
    for (let index = firstTailIndex; index < this.#logicalStamps.length; index += 1) {
      const stamp = this.#logicalStamps[index];
      if (stamp === undefined) continue;
      stamp.primitiveStart = this.#dabs.length;
      const envelope = Math.min(
        this.#startEnvelopeAtDistance(stamp.pathDistancePx),
        this.#endEnvelopeAtDistance(stamp.pathDistancePx, totalDistancePx),
      );
      this.#emitLogicalStamp(this.#dabs, stamp, envelope);
      stamp.primitiveEnd = this.#dabs.length;
    }
  }

  #resolvedTipAngleDegrees(strokeDirectionDegrees?: number): number {
    const followAngle =
      this.#followStrokeRotation && strokeDirectionDegrees !== undefined
        ? strokeDirectionDegrees
        : 0;
    return normalizeBaselineBrushTipAngleDegreesV1(
      followAngle + this.#tipAngleDegrees - this.#tipDirectionDegrees,
    );
  }

  #appendPoint(x: number, y: number): void {
    const lastPoint = this.#lastPoint;
    if (lastPoint === null) return;

    let cursorX = lastPoint.x;
    let cursorY = lastPoint.y;
    const segmentLength = Math.hypot(x - cursorX, y - cursorY);
    let remaining = segmentLength;
    let segmentAdvancedPx = 0;
    if (remaining > 0) {
      this.#lastStrokeDirectionDegrees = normalizeBaselineBrushTipAngleDegreesV1(
        (Math.atan2(y - lastPoint.y, x - lastPoint.x) * 180) / Math.PI,
      );
    }

    while (remaining + 1e-9 >= this.#distanceUntilNext && remaining > 0) {
      const stepDistancePx = this.#distanceUntilNext;
      const ratio = stepDistancePx / remaining;
      cursorX += (x - cursorX) * ratio;
      cursorY += (y - cursorY) * ratio;
      segmentAdvancedPx += stepDistancePx;
      this.#pushLogicalStamp(
        cursorX,
        cursorY,
        this.#resolvedTipAngleDegrees(this.#lastStrokeDirectionDegrees ?? undefined),
        this.#pathDistancePx + segmentAdvancedPx,
      );
      this.#lastStampPoint = { x: cursorX, y: cursorY };
      remaining = Math.hypot(x - cursorX, y - cursorY);
      this.#distanceUntilNext = this.#spacing;
    }

    if (remaining > 0) this.#distanceUntilNext -= remaining;
    this.#pathDistancePx += segmentLength;
    this.#lastPoint = { x, y };
  }
}

function unionRect(left: RectV1, right: RectV1): RectV1 {
  const x = Math.min(left.x, right.x);
  const y = Math.min(left.y, right.y);
  const rightEdge = Math.max(left.x + left.width, right.x + right.width);
  const bottomEdge = Math.max(left.y + left.height, right.y + right.height);
  return Object.freeze({ x, y, width: rightEdge - x, height: bottomEdge - y });
}

function intersectRect(left: RectV1, right: RectV1): RectV1 | null {
  const x = Math.max(left.x, right.x);
  const y = Math.max(left.y, right.y);
  const rightEdge = Math.min(left.x + left.width, right.x + right.width);
  const bottomEdge = Math.min(left.y + left.height, right.y + right.height);
  if (rightEdge <= x || bottomEdge <= y) return null;
  return Object.freeze({ x, y, width: rightEdge - x, height: bottomEdge - y });
}

function dabDocumentBounds(dab: BaselineBrushDabV1): RectV1 {
  const extentX = baselineDabExtentXV1(dab);
  const extentY = baselineDabExtentYV1(dab);
  const left = Math.floor(dab.x - extentX);
  const top = Math.floor(dab.y - extentY);
  const right = Math.ceil(dab.x + extentX);
  const bottom = Math.ceil(dab.y + extentY);
  return Object.freeze({
    x: left,
    y: top,
    width: Math.max(1, right - left),
    height: Math.max(1, bottom - top),
  });
}

export function planBaselineBrushTilesV1(
  dabs: readonly BaselineBrushDabV1[],
  documentWidth: number,
  documentHeight: number,
): readonly BaselineBrushTilePlanV1[] {
  if (!Number.isSafeInteger(documentWidth) || documentWidth < 1) {
    throw new RangeError('baseline brush document width must be a positive safe integer');
  }
  if (!Number.isSafeInteger(documentHeight) || documentHeight < 1) {
    throw new RangeError('baseline brush document height must be a positive safe integer');
  }

  const documentRect: RectV1 = Object.freeze({
    x: 0,
    y: 0,
    width: documentWidth,
    height: documentHeight,
  });
  const plans = new Map<
    string,
    {
      coordinate: TileCoordinateV1;
      dirtyRect: RectV1;
      dabs: BaselineBrushDabV1[];
    }
  >();

  for (const dab of dabs) {
    if (
      dab.schema !== 'illustro.baseline-brush-dab/1' ||
      !Number.isFinite(dab.x) ||
      !Number.isFinite(dab.y) ||
      !Number.isFinite(dab.radius) ||
      dab.radius <= 0 ||
      !Number.isFinite(baselineDabRadiusXV1(dab)) ||
      baselineDabRadiusXV1(dab) <= 0 ||
      !Number.isFinite(baselineDabRadiusYV1(dab)) ||
      baselineDabRadiusYV1(dab) <= 0 ||
      !Number.isFinite(dab.opacity) ||
      dab.opacity < 0 ||
      dab.opacity > 1 ||
      (dab.flow !== undefined && (!Number.isFinite(dab.flow) || dab.flow < 0 || dab.flow > 1)) ||
      (dab.strokeOpacity !== undefined &&
        (!Number.isFinite(dab.strokeOpacity) || dab.strokeOpacity < 0 || dab.strokeOpacity > 1)) ||
      (dab.hardness !== undefined &&
        (!Number.isFinite(dab.hardness) || dab.hardness < 0 || dab.hardness > 1)) ||
      (dab.tipDensity !== undefined &&
        (!Number.isFinite(dab.tipDensity) || dab.tipDensity < 0 || dab.tipDensity > 1)) ||
      (dab.tipAngleDegrees !== undefined && !Number.isFinite(dab.tipAngleDegrees)) ||
      (dab.color !== undefined &&
        (dab.color.length !== 3 ||
          dab.color.some(
            (component) => !Number.isFinite(component) || component < 0 || component > 1,
          )))
    ) {
      throw new RangeError('invalid baseline brush dab');
    }

    const clippedDabBounds = intersectRect(dabDocumentBounds(dab), documentRect);
    if (clippedDabBounds === null) continue;
    const minTx = Math.floor(clippedDabBounds.x / CANONICAL_TILE_SIZE_PX);
    const minTy = Math.floor(clippedDabBounds.y / CANONICAL_TILE_SIZE_PX);
    const maxTx = Math.floor(
      (clippedDabBounds.x + clippedDabBounds.width - 1) / CANONICAL_TILE_SIZE_PX,
    );
    const maxTy = Math.floor(
      (clippedDabBounds.y + clippedDabBounds.height - 1) / CANONICAL_TILE_SIZE_PX,
    );

    for (let ty = minTy; ty <= maxTy; ty += 1) {
      for (let tx = minTx; tx <= maxTx; tx += 1) {
        const coordinate = Object.freeze({ tx, ty });
        const bounds = tileBoundsForDocumentV1(documentWidth, documentHeight, coordinate);
        const tileDocumentRect: RectV1 = Object.freeze({
          x: bounds.x,
          y: bounds.y,
          width: bounds.validWidth,
          height: bounds.validHeight,
        });
        const affected = intersectRect(clippedDabBounds, tileDocumentRect);
        if (affected === null) continue;
        const localDirtyRect = Object.freeze({
          x: affected.x - bounds.x,
          y: affected.y - bounds.y,
          width: affected.width,
          height: affected.height,
        });
        const key = tileKeyV1(coordinate);
        const existing = plans.get(key);
        if (existing === undefined) {
          plans.set(key, {
            coordinate,
            dirtyRect: localDirtyRect,
            dabs: [dab],
          });
        } else {
          existing.dirtyRect = unionRect(existing.dirtyRect, localDirtyRect);
          existing.dabs.push(dab);
        }
      }
    }
  }

  return Object.freeze(
    [...plans.values()]
      .sort(
        (left, right) =>
          left.coordinate.ty - right.coordinate.ty || left.coordinate.tx - right.coordinate.tx,
      )
      .map((plan) =>
        Object.freeze({
          coordinate: plan.coordinate,
          dirtyRect: plan.dirtyRect,
          dabs: Object.freeze([...plan.dabs]),
        }),
      ),
  );
}
