import {
  compileResponseCurveV1,
  type CompiledResponseCurveV1,
  type ResponseCurvePointV1,
} from '../domain/response-curve.js';
import {
  decodeSrgbTransferComponentV1,
  encodeSrgbTransferComponentV1,
} from '../domain/color-management.js';
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
export const BASELINE_BRUSH_OPACITY_TAPER_MINIMUM_RATIO = 0 as const;
export const BASELINE_BRUSH_OPACITY = 1 as const;
export const BASELINE_BRUSH_HARDNESS = 0.85 as const;
export const BASELINE_BRUSH_TIP_DENSITY = 1 as const;
export const BASELINE_BRUSH_TIP_ANGLE_DEGREES = 0 as const;
export const BASELINE_BRUSH_TIP_DIRECTION_DEGREES = 0 as const;
export const BASELINE_BRUSH_SIZE_JITTER = 0 as const;
export const BASELINE_BRUSH_OPACITY_JITTER = 0 as const;
export const BASELINE_BRUSH_ROTATION_JITTER = 0 as const;
export const BASELINE_BRUSH_POSITION_JITTER = 0 as const;
export const BASELINE_BRUSH_DENSITY_JITTER = 0 as const;
export const BASELINE_BRUSH_HUE_JITTER = 0 as const;
export const BASELINE_BRUSH_SATURATION_JITTER = 0 as const;
export const BASELINE_BRUSH_VALUE_JITTER = 0 as const;
export const BASELINE_BRUSH_SUB_COLOR_RATIO = 0 as const;
export const BASELINE_BRUSH_SPRAY_ENABLED = false as const;
export const BASELINE_BRUSH_SPRAY_PARTICLE_COUNT_V1 = 4 as const;
export const BASELINE_BRUSH_SPRAY_PARTICLE_COUNT_MIN_V1 = 1 as const;
export const BASELINE_BRUSH_SPRAY_PARTICLE_COUNT_MAX_V1 = 32 as const;
export const BASELINE_BRUSH_SPRAY_PARTICLE_SCALE_V1 = 0.35 as const;
export const BASELINE_BRUSH_SPRAY_PARTICLE_SCALE_MIN_V1 = 0.01 as const;
export const BASELINE_BRUSH_SPRAY_PARTICLE_SCALE_MAX_V1 = 4 as const;
export const BASELINE_BRUSH_SPRAY_SPREAD_RADIUS_RATIO_V1 = 1 as const;
export const BASELINE_BRUSH_SPRAY_SPREAD_RADIUS_RATIO_MIN_V1 = 0 as const;
export const BASELINE_BRUSH_SPRAY_SPREAD_RADIUS_RATIO_MAX_V1 = 4 as const;
export const BASELINE_BRUSH_SPRAY_DEVIATION_V1 = 0 as const;
export const BASELINE_BRUSH_SPRAY_ANGLE_BASED_ON_CENTER_V1 = false as const;
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

export function mixBaselineBrushMainSubColorV1(
  mainColor: BaselineBrushColorV1,
  subColor: BaselineBrushColorV1,
  subColorRatio: number,
): BaselineBrushColorV1 {
  if (!Number.isFinite(subColorRatio) || subColorRatio < 0 || subColorRatio > 1) {
    throw new RangeError('baseline brush sub color ratio must be within 0..1');
  }
  if (subColorRatio === 0) return mainColor;
  if (subColorRatio === 1) return subColor;
  const mainWeight = 1 - subColorRatio;
  return freezeBaselineBrushColorV1([
    encodeSrgbTransferComponentV1(
      decodeSrgbTransferComponentV1(mainColor[0]) * mainWeight +
        decodeSrgbTransferComponentV1(subColor[0]) * subColorRatio,
    ),
    encodeSrgbTransferComponentV1(
      decodeSrgbTransferComponentV1(mainColor[1]) * mainWeight +
        decodeSrgbTransferComponentV1(subColor[1]) * subColorRatio,
    ),
    encodeSrgbTransferComponentV1(
      decodeSrgbTransferComponentV1(mainColor[2]) * mainWeight +
        decodeSrgbTransferComponentV1(subColor[2]) * subColorRatio,
    ),
  ]);
}

export interface BaselineBrushSampleV1 {
  readonly documentX: number;
  readonly documentY: number;
  readonly pressure?: number;
  readonly velocity?: number;
  readonly tiltX?: number;
  readonly tiltY?: number;
  readonly altitudeAngle?: number | null;
  readonly azimuthAngle?: number | null;
  readonly twist?: number;
}

export function baselineBrushSamplePressureV1(sample: BaselineBrushSampleV1): number {
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

/**
 * Clockwise pen orientation in canvas coordinates. Pointer Events azimuthAngle is preferred;
 * tiltX/tiltY use the W3C conversion fallback. Twist is then added as barrel-axis rotation.
 */
export function baselineBrushSampleOrientationDegreesV1(sample: BaselineBrushSampleV1): number {
  let azimuthRadians: number;
  const azimuth = sample.azimuthAngle;
  if (azimuth !== undefined && azimuth !== null) {
    if (!Number.isFinite(azimuth) || azimuth < 0 || azimuth > Math.PI * 2) {
      throw new RangeError('baseline brush azimuth angle must be within 0..2pi');
    }
    azimuthRadians = azimuth === Math.PI * 2 ? 0 : azimuth;
  } else {
    const tiltX = sample.tiltX ?? 0;
    const tiltY = sample.tiltY ?? 0;
    if (!Number.isFinite(tiltX) || tiltX < -90 || tiltX > 90) {
      throw new RangeError('baseline brush tiltX must be within -90..90');
    }
    if (!Number.isFinite(tiltY) || tiltY < -90 || tiltY > 90) {
      throw new RangeError('baseline brush tiltY must be within -90..90');
    }
    if (tiltX === 0) {
      azimuthRadians = tiltY > 0 ? Math.PI / 2 : tiltY < 0 ? (3 * Math.PI) / 2 : 0;
    } else if (tiltY === 0) {
      azimuthRadians = tiltX < 0 ? Math.PI : 0;
    } else if (Math.abs(tiltX) === 90 || Math.abs(tiltY) === 90) {
      azimuthRadians = 0;
    } else {
      const tangentX = Math.tan((tiltX * Math.PI) / 180);
      const tangentY = Math.tan((tiltY * Math.PI) / 180);
      azimuthRadians = Math.atan2(tangentY, tangentX);
      if (azimuthRadians < 0) azimuthRadians += Math.PI * 2;
    }
  }
  const twist = sample.twist ?? 0;
  if (!Number.isFinite(twist) || twist < 0 || twist > 359) {
    throw new RangeError('baseline brush twist must be within 0..359');
  }
  return normalizeBaselineBrushTipAngleDegreesV1((azimuthRadians * 180) / Math.PI + twist);
}

function shortestAngularDeltaDegreesV1(fromDegrees: number, toDegrees: number): number {
  const from = normalizeBaselineBrushTipAngleDegreesV1(fromDegrees);
  const to = normalizeBaselineBrushTipAngleDegreesV1(toDegrees);
  return ((to - from + 540) % 360) - 180;
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
  readonly colorMixEnabled?: boolean;
  readonly colorMixCanvasRatio?: number;
  readonly colorMixDepositAmount?: number;
  readonly colorMixSampleRadiusRatio?: number;
  readonly colorMixPickupAmount?: number;
  readonly colorMixCarryAmount?: number;
  readonly referenceAntiOverflow?: boolean;
  readonly referenceOriginX?: number;
  readonly referenceOriginY?: number;
}

export const BASELINE_BRUSH_COLOR_MIX_CANVAS_RATIO_V1 = 0.5 as const;
export const BASELINE_BRUSH_COLOR_MIX_DEPOSIT_AMOUNT_V1 = 1 as const;

export function baselineDabColorMixEnabledV1(dab: BaselineBrushDabV1): boolean {
  return dab.colorMixEnabled === true;
}

export function baselineDabColorMixCanvasRatioV1(dab: BaselineBrushDabV1): number {
  const value = dab.colorMixCanvasRatio;
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1
    ? value
    : BASELINE_BRUSH_COLOR_MIX_CANVAS_RATIO_V1;
}

export function baselineDabColorMixDepositAmountV1(dab: BaselineBrushDabV1): number {
  const value = dab.colorMixDepositAmount;
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1
    ? value
    : BASELINE_BRUSH_COLOR_MIX_DEPOSIT_AMOUNT_V1;
}

export const BASELINE_BRUSH_COLOR_MIX_SAMPLE_RADIUS_RATIO_V1 = 0.5 as const;
export const BASELINE_BRUSH_COLOR_MIX_SAMPLE_RADIUS_RATIO_MAX_V1 = 3 as const;
export const BASELINE_BRUSH_COLOR_MIX_PICKUP_AMOUNT_V1 = 0 as const;
export const BASELINE_BRUSH_COLOR_MIX_CARRY_AMOUNT_V1 = 0.85 as const;

export function baselineDabColorMixSampleRadiusRatioV1(dab: BaselineBrushDabV1): number {
  const value = dab.colorMixSampleRadiusRatio;
  return typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= BASELINE_BRUSH_COLOR_MIX_SAMPLE_RADIUS_RATIO_MAX_V1
    ? value
    : BASELINE_BRUSH_COLOR_MIX_SAMPLE_RADIUS_RATIO_V1;
}

export function baselineDabColorMixPickupAmountV1(dab: BaselineBrushDabV1): number {
  const value = dab.colorMixPickupAmount;
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1
    ? value
    : BASELINE_BRUSH_COLOR_MIX_PICKUP_AMOUNT_V1;
}

export function baselineDabColorMixCarryAmountV1(dab: BaselineBrushDabV1): number {
  const value = dab.colorMixCarryAmount;
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1
    ? value
    : BASELINE_BRUSH_COLOR_MIX_CARRY_AMOUNT_V1;
}

export function baselineDabReferenceAntiOverflowV1(dab: BaselineBrushDabV1): boolean {
  return dab.referenceAntiOverflow === true;
}

export function baselineDabReferenceOriginXV1(dab: BaselineBrushDabV1): number {
  const value = dab.referenceOriginX;
  return typeof value === 'number' && Number.isFinite(value) ? value : dab.x;
}

export function baselineDabReferenceOriginYV1(dab: BaselineBrushDabV1): number {
  const value = dab.referenceOriginY;
  return typeof value === 'number' && Number.isFinite(value) ? value : dab.y;
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
  baselineBrushSamplePressureV1(sample);
  baselineBrushSampleVelocityV1(sample);
  baselineBrushSampleTiltUprightnessV1(sample);
  baselineBrushSampleOrientationDegreesV1(sample);
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
  referenceAntiOverflow: boolean,
  referenceOriginX: number,
  referenceOriginY: number,
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
    ...(referenceAntiOverflow
      ? { referenceAntiOverflow: true, referenceOriginX, referenceOriginY }
      : {}),
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
  referenceAntiOverflow: boolean,
  referenceOriginX: number,
  referenceOriginY: number,
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
        referenceAntiOverflow,
        referenceOriginX,
        referenceOriginY,
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
        referenceAntiOverflow,
        referenceOriginX,
        referenceOriginY,
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

const BASELINE_BRUSH_RANDOM_DYNAMICS_SALT_V1 = 0xa511e9b3 as const;
const BASELINE_BRUSH_SIZE_JITTER_SALT_V1 = 0x63d83595 as const;
const BASELINE_BRUSH_OPACITY_JITTER_SALT_V1 = 0x27d4eb2f as const;
const BASELINE_BRUSH_ROTATION_JITTER_SALT_V1 = 0xb5297a4d as const;
const BASELINE_BRUSH_POSITION_JITTER_ANGLE_SALT_V1 = 0x9e6c63d1 as const;
const BASELINE_BRUSH_POSITION_JITTER_RADIUS_SALT_V1 = 0xc2b2ae35 as const;
const BASELINE_BRUSH_DENSITY_JITTER_SALT_V1 = 0x165667b1 as const;
const BASELINE_BRUSH_HUE_JITTER_SALT_V1 = 0xd3a2646c as const;
const BASELINE_BRUSH_SATURATION_JITTER_SALT_V1 = 0xfd7046c5 as const;
const BASELINE_BRUSH_VALUE_JITTER_SALT_V1 = 0xb55a4f09 as const;
const BASELINE_BRUSH_SPRAY_ANGLE_SALT_V1 = 0x94d049bb as const;
const BASELINE_BRUSH_SPRAY_RADIUS_SALT_V1 = 0xed5ad4bb as const;

export function deterministicBaselineBrushSizeJitterV1(seed: number, stampIndex: number): number {
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) {
    throw new RangeError('baseline brush size jitter seed must be uint32');
  }
  if (!Number.isSafeInteger(stampIndex) || stampIndex < 0) {
    throw new RangeError(
      'baseline brush size jitter stamp index must be a non-negative safe integer',
    );
  }
  let value =
    (seed ^ BASELINE_BRUSH_SIZE_JITTER_SALT_V1 ^ Math.imul((stampIndex + 1) >>> 0, 0x9e3779b1)) >>>
    0;
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d) >>> 0;
  value ^= value >>> 15;
  value = Math.imul(value, 0x846ca68b) >>> 0;
  value ^= value >>> 16;
  return (value >>> 0) / 0x100000000;
}

export function deterministicBaselineBrushOpacityJitterV1(
  seed: number,
  stampIndex: number,
): number {
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) {
    throw new RangeError('baseline brush opacity jitter seed must be uint32');
  }
  if (!Number.isSafeInteger(stampIndex) || stampIndex < 0) {
    throw new RangeError(
      'baseline brush opacity jitter stamp index must be a non-negative safe integer',
    );
  }
  let value =
    (seed ^
      BASELINE_BRUSH_OPACITY_JITTER_SALT_V1 ^
      Math.imul((stampIndex + 1) >>> 0, 0x9e3779b1)) >>>
    0;
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d) >>> 0;
  value ^= value >>> 15;
  value = Math.imul(value, 0x846ca68b) >>> 0;
  value ^= value >>> 16;
  return (value >>> 0) / 0x100000000;
}

export function deterministicBaselineBrushRotationJitterV1(
  seed: number,
  stampIndex: number,
): number {
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) {
    throw new RangeError('baseline brush rotation jitter seed must be uint32');
  }
  if (!Number.isSafeInteger(stampIndex) || stampIndex < 0) {
    throw new RangeError(
      'baseline brush rotation jitter stamp index must be a non-negative safe integer',
    );
  }
  let value =
    (seed ^
      BASELINE_BRUSH_ROTATION_JITTER_SALT_V1 ^
      Math.imul((stampIndex + 1) >>> 0, 0x9e3779b1)) >>>
    0;
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d) >>> 0;
  value ^= value >>> 15;
  value = Math.imul(value, 0x846ca68b) >>> 0;
  value ^= value >>> 16;
  return (value >>> 0) / 0x100000000;
}

function deterministicBaselineBrushPositionComponentV1(
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

export function deterministicBaselineBrushPositionJitterV1(
  seed: number,
  stampIndex: number,
): Readonly<{ x: number; y: number }> {
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) {
    throw new RangeError('baseline brush position jitter seed must be uint32');
  }
  if (!Number.isSafeInteger(stampIndex) || stampIndex < 0) {
    throw new RangeError(
      'baseline brush position jitter stamp index must be a non-negative safe integer',
    );
  }
  const angle =
    deterministicBaselineBrushPositionComponentV1(
      seed,
      stampIndex,
      BASELINE_BRUSH_POSITION_JITTER_ANGLE_SALT_V1,
    ) *
    Math.PI *
    2;
  const radius = Math.sqrt(
    deterministicBaselineBrushPositionComponentV1(
      seed,
      stampIndex,
      BASELINE_BRUSH_POSITION_JITTER_RADIUS_SALT_V1,
    ),
  );
  return Object.freeze({ x: Math.cos(angle) * radius, y: Math.sin(angle) * radius });
}

export function deterministicBaselineBrushDensityJitterV1(
  seed: number,
  stampIndex: number,
): number {
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) {
    throw new RangeError('baseline brush density jitter seed must be uint32');
  }
  if (!Number.isSafeInteger(stampIndex) || stampIndex < 0) {
    throw new RangeError(
      'baseline brush density jitter stamp index must be a non-negative safe integer',
    );
  }
  let value =
    (seed ^
      BASELINE_BRUSH_DENSITY_JITTER_SALT_V1 ^
      Math.imul((stampIndex + 1) >>> 0, 0x9e3779b1)) >>>
    0;
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d) >>> 0;
  value ^= value >>> 15;
  value = Math.imul(value, 0x846ca68b) >>> 0;
  value ^= value >>> 16;
  return (value >>> 0) / 0x100000000;
}

function deterministicBaselineBrushColorComponentV1(
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
    throw new RangeError(
      'baseline brush color jitter stamp index must be a non-negative safe integer',
    );
  }
  return Object.freeze({
    hue: deterministicBaselineBrushColorComponentV1(
      seed,
      stampIndex,
      BASELINE_BRUSH_HUE_JITTER_SALT_V1,
    ),
    saturation: deterministicBaselineBrushColorComponentV1(
      seed,
      stampIndex,
      BASELINE_BRUSH_SATURATION_JITTER_SALT_V1,
    ),
    value: deterministicBaselineBrushColorComponentV1(
      seed,
      stampIndex,
      BASELINE_BRUSH_VALUE_JITTER_SALT_V1,
    ),
  });
}

function baselineBrushRgbToHsvV1(
  color: BaselineBrushColorV1,
): Readonly<{ h: number; s: number; v: number }> {
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
  const hue = (((hsv.h + (random.hue - 0.5) * hueAmount) % 1) + 1) % 1;
  const saturation = Math.max(
    0,
    Math.min(1, hsv.s + (random.saturation - 0.5) * 2 * saturationAmount),
  );
  const value = Math.max(0, Math.min(1, hsv.v + (random.value - 0.5) * 2 * valueAmount));
  return baselineBrushHsvToRgbV1(hue, saturation, value);
}

function deterministicBaselineBrushSprayComponentV1(
  seed: number,
  stampIndex: number,
  particleIndex: number,
  salt: number,
): number {
  let value =
    (seed ^
      salt ^
      Math.imul((stampIndex + 1) >>> 0, 0x9e3779b1) ^
      Math.imul((particleIndex + 1) >>> 0, 0x85ebca6b)) >>>
    0;
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d) >>> 0;
  value ^= value >>> 15;
  value = Math.imul(value, 0x846ca68b) >>> 0;
  value ^= value >>> 16;
  return (value >>> 0) / 0x100000000;
}

export function deterministicBaselineBrushSprayParticleV1(
  seed: number,
  stampIndex: number,
  particleIndex: number,
): Readonly<{ x: number; y: number }> {
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) {
    throw new RangeError('baseline brush spray seed must be uint32');
  }
  if (!Number.isSafeInteger(stampIndex) || stampIndex < 0) {
    throw new RangeError('baseline brush spray stamp index must be a non-negative safe integer');
  }
  if (!Number.isSafeInteger(particleIndex) || particleIndex < 0) {
    throw new RangeError('baseline brush spray particle index must be a non-negative safe integer');
  }
  const angle =
    deterministicBaselineBrushSprayComponentV1(
      seed,
      stampIndex,
      particleIndex,
      BASELINE_BRUSH_SPRAY_ANGLE_SALT_V1,
    ) *
    Math.PI *
    2;
  const radius = Math.sqrt(
    deterministicBaselineBrushSprayComponentV1(
      seed,
      stampIndex,
      particleIndex,
      BASELINE_BRUSH_SPRAY_RADIUS_SALT_V1,
    ),
  );
  return Object.freeze({ x: Math.cos(angle) * radius, y: Math.sin(angle) * radius });
}

export function applyBaselineBrushSprayDeviationV1(
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
    deviation > 0 ? radius * (1 - deviation) : radius + -deviation * (1 - radius);
  const scale = adjustedRadius / radius;
  return Object.freeze({ x: unit.x * scale, y: unit.y * scale });
}

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
  return (value >>> 0) / 0x100000000;
}

interface BaselineLogicalStampRecordV1 {
  readonly x: number;
  readonly y: number;
  readonly pressure: number;
  readonly velocity: number;
  readonly randomInput: number;
  readonly sizeJitterScale: number;
  readonly opacityJitterScale: number;
  readonly densityJitterScale: number;
  readonly color: BaselineBrushColorV1;
  readonly tiltUprightness: number;
  readonly tipAngleDegrees: number;
  readonly pathDistancePx: number;
  readonly sampledTipAlpha: BaselineBrushSampledTipAlphaV1;
  readonly sprayParticles:
    | readonly Readonly<{
        x: number;
        y: number;
        tipAngleDegrees: number;
      }>[]
    | null;
  primitiveStart: number;
  primitiveEnd: number;
}

export class BaselineBrushDabBuilderV1 {
  readonly #dabs: BaselineBrushDabV1[] = [];
  readonly #color: BaselineBrushColorV1;
  readonly #subColor: BaselineBrushColorV1;
  readonly #subColorRatio: number;
  readonly #referenceAntiOverflow: boolean;
  readonly #radius: number;
  readonly #spacing: number;
  readonly #startTaperLengthPx: number;
  readonly #endTaperLengthPx: number;
  readonly #sizeTaperMinimumRatio: number;
  readonly #opacityTaperMinimumRatio: number;
  readonly #forceStartTaper: boolean;
  readonly #forceEndTaper: boolean;
  readonly #pressureSizeEnabled: boolean;
  readonly #pressureOpacityEnabled: boolean;
  readonly #pressureFlowEnabled: boolean;
  readonly #pressureResponseCurve: CompiledResponseCurveV1;
  readonly #tiltSizeEnabled: boolean;
  readonly #tiltOpacityEnabled: boolean;
  readonly #tiltFlowEnabled: boolean;
  readonly #tiltResponseCurve: CompiledResponseCurveV1;
  readonly #velocitySizeEnabled: boolean;
  readonly #velocityOpacityEnabled: boolean;
  readonly #velocityFlowEnabled: boolean;
  readonly #velocityResponseCurve: CompiledResponseCurveV1;
  readonly #randomSizeEnabled: boolean;
  readonly #randomOpacityEnabled: boolean;
  readonly #randomFlowEnabled: boolean;
  readonly #randomResponseCurve: CompiledResponseCurveV1;
  readonly #sizeMinimumResponse: number;
  readonly #opacityMinimumResponse: number;
  readonly #flowMinimumResponse: number;
  readonly #sizeMaximumResponse: number;
  readonly #opacityMaximumResponse: number;
  readonly #flowMaximumResponse: number;
  readonly #sizeJitter: number;
  readonly #opacityJitter: number;
  readonly #rotationJitter: number;
  readonly #positionJitter: number;
  readonly #densityJitter: number;
  readonly #hueJitter: number;
  readonly #saturationJitter: number;
  readonly #valueJitter: number;
  readonly #sprayEnabled: boolean;
  readonly #sprayParticleSizeRatio: number;
  readonly #sprayParticleDensity: number;
  readonly #spraySpreadRadiusRatio: number;
  readonly #sprayDeviation: number;
  readonly #sprayAngleBasedOnCenter: boolean;
  readonly #randomSeed: number;
  readonly #flow: number;
  readonly #strokeOpacity: number;
  readonly #hardness: number;
  readonly #tipDensity: number;
  readonly #tipAngleDegrees: number;
  readonly #tipDirectionDegrees: number;
  readonly #followStrokeRotation: boolean;
  readonly #penOrientationEnabled: boolean;
  readonly #tipShape: BaselineBrushTipShapeV1;
  readonly #sampledTipAlphas: readonly BaselineBrushSampledTipAlphaV1[];
  readonly #tipSelectionMode: BaselineBrushTipSelectionModeV1;
  readonly #tipSelectionStartIndex: number;
  readonly #tipSelectionSeed: number;
  readonly #logicalStamps: BaselineLogicalStampRecordV1[] = [];
  #logicalStampIndex = 0;
  #randomStampIndex = 0;
  #sizeJitterStampIndex = 0;
  #opacityJitterStampIndex = 0;
  #rotationJitterStampIndex = 0;
  #positionJitterStampIndex = 0;
  #densityJitterStampIndex = 0;
  #colorJitterStampIndex = 0;
  #sprayStampIndex = 0;
  #pathDistancePx = 0;
  #lastPoint: {
    x: number;
    y: number;
    pressure: number;
    velocity: number;
    tiltUprightness: number;
    orientationDegrees: number;
  } | null = null;
  #lastStampPoint: { x: number; y: number } | null = null;
  #lastStrokeDirectionDegrees: number | null = null;
  #distanceUntilNext: number;
  #finished = false;

  constructor(
    options: {
      readonly color?: BaselineBrushColorV1;
      readonly subColor?: BaselineBrushColorV1;
      readonly subColorRatio?: number;
      readonly referenceAntiOverflow?: boolean;
      readonly sizePx?: number;
      readonly opacity?: number;
      readonly flow?: number;
      readonly spacingRatio?: number;
      readonly minimumStampDistancePx?: number;
      readonly startTaperLengthPx?: number;
      readonly endTaperLengthPx?: number;
      readonly sizeTaperMinimumRatio?: number;
      readonly opacityTaperMinimumRatio?: number;
      readonly forceStartTaper?: boolean;
      readonly forceEndTaper?: boolean;
      readonly pressureSizeEnabled?: boolean;
      readonly pressureOpacityEnabled?: boolean;
      readonly pressureFlowEnabled?: boolean;
      readonly pressureResponseCurve?: readonly ResponseCurvePointV1[];
      readonly tiltSizeEnabled?: boolean;
      readonly tiltOpacityEnabled?: boolean;
      readonly tiltFlowEnabled?: boolean;
      readonly tiltResponseCurve?: readonly ResponseCurvePointV1[];
      readonly velocitySizeEnabled?: boolean;
      readonly velocityOpacityEnabled?: boolean;
      readonly velocityFlowEnabled?: boolean;
      readonly velocityResponseCurve?: readonly ResponseCurvePointV1[];
      readonly randomSizeEnabled?: boolean;
      readonly randomOpacityEnabled?: boolean;
      readonly randomFlowEnabled?: boolean;
      readonly randomResponseCurve?: readonly ResponseCurvePointV1[];
      readonly sizeMinimumResponse?: number;
      readonly opacityMinimumResponse?: number;
      readonly flowMinimumResponse?: number;
      readonly sizeMaximumResponse?: number;
      readonly opacityMaximumResponse?: number;
      readonly flowMaximumResponse?: number;
      readonly sizeJitter?: number;
      readonly opacityJitter?: number;
      readonly rotationJitter?: number;
      readonly positionJitter?: number;
      readonly densityJitter?: number;
      readonly hueJitter?: number;
      readonly saturationJitter?: number;
      readonly valueJitter?: number;
      readonly sprayEnabled?: boolean;
      readonly sprayParticleSizeRatio?: number;
      readonly sprayParticleDensity?: number;
      readonly spraySpreadRadiusRatio?: number;
      readonly sprayDeviation?: number;
      readonly sprayAngleBasedOnCenter?: boolean;
      readonly randomSeed?: number;
      readonly hardness?: number;
      readonly tipDensity?: number;
      readonly tipAngleDegrees?: number;
      readonly tipDirectionDegrees?: number;
      readonly followStrokeRotation?: boolean;
      readonly penOrientationEnabled?: boolean;
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
    this.#subColor =
      options.subColor === undefined
        ? DEFAULT_BASELINE_BRUSH_COLOR_V1
        : freezeBaselineBrushColorV1(options.subColor);
    const subColorRatio = options.subColorRatio ?? BASELINE_BRUSH_SUB_COLOR_RATIO;
    if (!Number.isFinite(subColorRatio) || subColorRatio < 0 || subColorRatio > 1) {
      throw new RangeError('baseline brush sub color ratio must be within 0..1');
    }
    this.#subColorRatio = subColorRatio;
    const referenceAntiOverflow = options.referenceAntiOverflow ?? false;
    if (typeof referenceAntiOverflow !== 'boolean') {
      throw new TypeError('baseline brush reference anti-overflow flag must be boolean');
    }
    this.#referenceAntiOverflow = referenceAntiOverflow;
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
    const opacityTaperMinimumRatio =
      options.opacityTaperMinimumRatio ?? BASELINE_BRUSH_OPACITY_TAPER_MINIMUM_RATIO;
    const forceStartTaper = options.forceStartTaper ?? false;
    const forceEndTaper = options.forceEndTaper ?? false;
    const pressureSizeEnabled = options.pressureSizeEnabled ?? false;
    const pressureOpacityEnabled = options.pressureOpacityEnabled ?? false;
    const pressureFlowEnabled = options.pressureFlowEnabled ?? false;
    const tiltSizeEnabled = options.tiltSizeEnabled ?? false;
    const tiltOpacityEnabled = options.tiltOpacityEnabled ?? false;
    const tiltFlowEnabled = options.tiltFlowEnabled ?? false;
    const velocitySizeEnabled = options.velocitySizeEnabled ?? false;
    const velocityOpacityEnabled = options.velocityOpacityEnabled ?? false;
    const velocityFlowEnabled = options.velocityFlowEnabled ?? false;
    const randomSizeEnabled = options.randomSizeEnabled ?? false;
    const randomOpacityEnabled = options.randomOpacityEnabled ?? false;
    const randomFlowEnabled = options.randomFlowEnabled ?? false;
    const sizeMinimumResponse = options.sizeMinimumResponse ?? 0;
    const opacityMinimumResponse = options.opacityMinimumResponse ?? 0;
    const flowMinimumResponse = options.flowMinimumResponse ?? 0;
    const sizeMaximumResponse = options.sizeMaximumResponse ?? 1;
    const opacityMaximumResponse = options.opacityMaximumResponse ?? 1;
    const flowMaximumResponse = options.flowMaximumResponse ?? 1;
    const sizeJitter = options.sizeJitter ?? BASELINE_BRUSH_SIZE_JITTER;
    const opacityJitter = options.opacityJitter ?? BASELINE_BRUSH_OPACITY_JITTER;
    const rotationJitter = options.rotationJitter ?? BASELINE_BRUSH_ROTATION_JITTER;
    const positionJitter = options.positionJitter ?? BASELINE_BRUSH_POSITION_JITTER;
    const densityJitter = options.densityJitter ?? BASELINE_BRUSH_DENSITY_JITTER;
    const hueJitter = options.hueJitter ?? BASELINE_BRUSH_HUE_JITTER;
    const saturationJitter = options.saturationJitter ?? BASELINE_BRUSH_SATURATION_JITTER;
    const valueJitter = options.valueJitter ?? BASELINE_BRUSH_VALUE_JITTER;
    const sprayEnabled = options.sprayEnabled ?? BASELINE_BRUSH_SPRAY_ENABLED;
    const sprayParticleSizeRatio =
      options.sprayParticleSizeRatio ?? BASELINE_BRUSH_SPRAY_PARTICLE_SCALE_V1;
    const sprayParticleDensity =
      options.sprayParticleDensity ?? BASELINE_BRUSH_SPRAY_PARTICLE_COUNT_V1;
    const spraySpreadRadiusRatio =
      options.spraySpreadRadiusRatio ?? BASELINE_BRUSH_SPRAY_SPREAD_RADIUS_RATIO_V1;
    const sprayDeviation = options.sprayDeviation ?? BASELINE_BRUSH_SPRAY_DEVIATION_V1;
    const sprayAngleBasedOnCenter =
      options.sprayAngleBasedOnCenter ?? BASELINE_BRUSH_SPRAY_ANGLE_BASED_ON_CENTER_V1;
    const randomSeed = options.randomSeed ?? 0;
    const hardness = options.hardness ?? BASELINE_BRUSH_HARDNESS;
    const tipDensity = options.tipDensity ?? BASELINE_BRUSH_TIP_DENSITY;
    const tipAngleDegrees = normalizeBaselineBrushTipAngleDegreesV1(
      options.tipAngleDegrees ?? BASELINE_BRUSH_TIP_ANGLE_DEGREES,
    );
    const tipDirectionDegrees = normalizeBaselineBrushTipAngleDegreesV1(
      options.tipDirectionDegrees ?? BASELINE_BRUSH_TIP_DIRECTION_DEGREES,
    );
    const followStrokeRotation = options.followStrokeRotation ?? false;
    const penOrientationEnabled = options.penOrientationEnabled ?? false;
    if (typeof followStrokeRotation !== 'boolean') {
      throw new TypeError('baseline brush follow rotation must be boolean');
    }
    if (typeof penOrientationEnabled !== 'boolean') {
      throw new TypeError('baseline brush pen orientation flag must be boolean');
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
    if (
      !Number.isFinite(opacityTaperMinimumRatio) ||
      opacityTaperMinimumRatio < 0 ||
      opacityTaperMinimumRatio > 1
    ) {
      throw new RangeError('baseline brush opacity taper minimum ratio must be within 0..1');
    }
    if (typeof forceStartTaper !== 'boolean' || typeof forceEndTaper !== 'boolean') {
      throw new TypeError('baseline brush forced taper flags must be boolean');
    }
    if (typeof pressureSizeEnabled !== 'boolean') {
      throw new TypeError('baseline brush pressure size flag must be boolean');
    }
    if (typeof pressureOpacityEnabled !== 'boolean') {
      throw new TypeError('baseline brush pressure opacity flag must be boolean');
    }
    if (typeof pressureFlowEnabled !== 'boolean') {
      throw new TypeError('baseline brush pressure flow flag must be boolean');
    }
    if (
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
    if (
      typeof randomSizeEnabled !== 'boolean' ||
      typeof randomOpacityEnabled !== 'boolean' ||
      typeof randomFlowEnabled !== 'boolean'
    ) {
      throw new TypeError('baseline brush random mapping flags must be boolean');
    }
    if (
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
    }
    if (!Number.isFinite(sizeJitter) || sizeJitter < 0 || sizeJitter > 1) {
      throw new RangeError('baseline brush size jitter must be within 0..1');
    }
    if (!Number.isFinite(opacityJitter) || opacityJitter < 0 || opacityJitter > 1) {
      throw new RangeError('baseline brush opacity jitter must be within 0..1');
    }
    if (!Number.isFinite(rotationJitter) || rotationJitter < 0 || rotationJitter > 1) {
      throw new RangeError('baseline brush rotation jitter must be within 0..1');
    }
    if (!Number.isFinite(positionJitter) || positionJitter < 0 || positionJitter > 1) {
      throw new RangeError('baseline brush position jitter must be within 0..1');
    }
    if (!Number.isFinite(densityJitter) || densityJitter < 0 || densityJitter > 1) {
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
    if (typeof sprayEnabled !== 'boolean') {
      throw new TypeError('baseline brush spray enabled flag must be boolean');
    }
    if (
      !Number.isFinite(sprayParticleSizeRatio) ||
      sprayParticleSizeRatio < BASELINE_BRUSH_SPRAY_PARTICLE_SCALE_MIN_V1 ||
      sprayParticleSizeRatio > BASELINE_BRUSH_SPRAY_PARTICLE_SCALE_MAX_V1
    ) {
      throw new RangeError('baseline brush spray particle size ratio must be within 0.01..4');
    }
    if (
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
    if (typeof sprayAngleBasedOnCenter !== 'boolean') {
      throw new TypeError('baseline brush spray angle-based-on-center flag must be boolean');
    }
    if (!Number.isSafeInteger(randomSeed) || randomSeed < 0 || randomSeed > 0xffffffff) {
      throw new RangeError('baseline brush random seed must be uint32');
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
    this.#opacityTaperMinimumRatio = opacityTaperMinimumRatio;
    this.#forceStartTaper = forceStartTaper;
    this.#forceEndTaper = forceEndTaper;
    this.#pressureSizeEnabled = pressureSizeEnabled;
    this.#pressureOpacityEnabled = pressureOpacityEnabled;
    this.#pressureFlowEnabled = pressureFlowEnabled;
    this.#pressureResponseCurve = compileResponseCurveV1(
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
    this.#velocitySizeEnabled = velocitySizeEnabled;
    this.#velocityOpacityEnabled = velocityOpacityEnabled;
    this.#velocityFlowEnabled = velocityFlowEnabled;
    this.#velocityResponseCurve = compileResponseCurveV1(
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
    this.#sizeMinimumResponse = sizeMinimumResponse;
    this.#opacityMinimumResponse = opacityMinimumResponse;
    this.#flowMinimumResponse = flowMinimumResponse;
    this.#sizeMaximumResponse = sizeMaximumResponse;
    this.#opacityMaximumResponse = opacityMaximumResponse;
    this.#flowMaximumResponse = flowMaximumResponse;
    this.#sizeJitter = sizeJitter;
    this.#opacityJitter = opacityJitter;
    this.#rotationJitter = rotationJitter;
    this.#positionJitter = positionJitter;
    this.#densityJitter = densityJitter;
    this.#hueJitter = hueJitter;
    this.#saturationJitter = saturationJitter;
    this.#valueJitter = valueJitter;
    this.#sprayEnabled = sprayEnabled;
    this.#sprayParticleSizeRatio = sprayParticleSizeRatio;
    this.#sprayParticleDensity = sprayParticleDensity;
    this.#spraySpreadRadiusRatio = spraySpreadRadiusRatio;
    this.#sprayDeviation = sprayDeviation;
    this.#sprayAngleBasedOnCenter = sprayAngleBasedOnCenter;
    this.#randomSeed = randomSeed >>> 0;
    this.#flow = flow;
    this.#strokeOpacity = opacity;
    this.#hardness = hardness;
    this.#tipDensity = tipDensity;
    this.#tipAngleDegrees = tipAngleDegrees;
    this.#tipDirectionDegrees = tipDirectionDegrees;
    this.#followStrokeRotation = followStrokeRotation;
    this.#penOrientationEnabled = penOrientationEnabled;
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
    const pressure = baselineBrushSamplePressureV1(sample);
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
      this.#resolvedTipAngleDegrees(undefined, orientationDegrees),
      0,
    );
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
        this.#appendPoint(
          sample.documentX,
          sample.documentY,
          baselineBrushSamplePressureV1(sample),
          baselineBrushSampleVelocityV1(sample),
          baselineBrushSampleTiltUprightnessV1(sample),
          baselineBrushSampleOrientationDegreesV1(sample),
        );
      }
      return this.#deltaFrom(start);
    }

    for (const sample of samples) {
      assertFinitePoint(sample);
      this.#appendPoint(
        sample.documentX,
        sample.documentY,
        baselineBrushSamplePressureV1(sample),
        baselineBrushSampleVelocityV1(sample),
        baselineBrushSampleTiltUprightnessV1(sample),
        baselineBrushSampleOrientationDegreesV1(sample),
      );
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
          lastPoint.pressure,
          lastPoint.velocity,
          lastPoint.tiltUprightness,
          this.#resolvedTipAngleDegrees(
            this.#lastStrokeDirectionDegrees ?? undefined,
            lastPoint.orientationDegrees,
          ),
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

  #sizeTaperScale(envelope: number, forced: boolean): number {
    return forced
      ? envelope
      : this.#sizeTaperMinimumRatio + (1 - this.#sizeTaperMinimumRatio) * envelope;
  }

  #opacityTaperScale(envelope: number, forced: boolean): number {
    return forced
      ? envelope
      : this.#opacityTaperMinimumRatio + (1 - this.#opacityTaperMinimumRatio) * envelope;
  }

  #emitLogicalStamp(
    target: BaselineBrushDabV1[],
    stamp: Pick<
      BaselineLogicalStampRecordV1,
      | 'x'
      | 'y'
      | 'pressure'
      | 'velocity'
      | 'randomInput'
      | 'sizeJitterScale'
      | 'opacityJitterScale'
      | 'densityJitterScale'
      | 'color'
      | 'tiltUprightness'
      | 'tipAngleDegrees'
      | 'sampledTipAlpha'
      | 'sprayParticles'
    >,
    startEnvelope: number,
    endEnvelope = 1,
  ): void {
    const sizeScale = Math.min(
      this.#sizeTaperScale(startEnvelope, this.#forceStartTaper),
      this.#sizeTaperScale(endEnvelope, this.#forceEndTaper),
    );
    const opacityScale = Math.min(
      this.#opacityTaperScale(startEnvelope, this.#forceStartTaper),
      this.#opacityTaperScale(endEnvelope, this.#forceEndTaper),
    );
    const usesPressure =
      this.#pressureSizeEnabled || this.#pressureOpacityEnabled || this.#pressureFlowEnabled;
    const pressureResponse = usesPressure ? this.#pressureResponseCurve.sample(stamp.pressure) : 1;
    const pressureSizeScale = this.#pressureSizeEnabled ? pressureResponse : 1;
    const pressureOpacityScale = this.#pressureOpacityEnabled ? pressureResponse : 1;
    const pressureFlowScale = this.#pressureFlowEnabled ? pressureResponse : 1;
    const usesTilt = this.#tiltSizeEnabled || this.#tiltOpacityEnabled || this.#tiltFlowEnabled;
    const tiltResponse = usesTilt ? this.#tiltResponseCurve.sample(stamp.tiltUprightness) : 1;
    const tiltSizeScale = this.#tiltSizeEnabled ? tiltResponse : 1;
    const tiltOpacityScale = this.#tiltOpacityEnabled ? tiltResponse : 1;
    const tiltFlowScale = this.#tiltFlowEnabled ? tiltResponse : 1;
    const usesVelocity =
      this.#velocitySizeEnabled || this.#velocityOpacityEnabled || this.#velocityFlowEnabled;
    const velocityResponse = usesVelocity ? this.#velocityResponseCurve.sample(stamp.velocity) : 1;
    const velocitySizeScale = this.#velocitySizeEnabled ? velocityResponse : 1;
    const velocityOpacityScale = this.#velocityOpacityEnabled ? velocityResponse : 1;
    const velocityFlowScale = this.#velocityFlowEnabled ? velocityResponse : 1;
    const usesRandom =
      this.#randomSizeEnabled || this.#randomOpacityEnabled || this.#randomFlowEnabled;
    const randomResponse = usesRandom ? this.#randomResponseCurve.sample(stamp.randomInput) : 1;
    const randomSizeScale = this.#randomSizeEnabled ? randomResponse : 1;
    const randomOpacityScale = this.#randomOpacityEnabled ? randomResponse : 1;
    const randomFlowScale = this.#randomFlowEnabled ? randomResponse : 1;
    const usesSizeDynamics =
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
      : 1;
    if (
      sizeScale <= 0 ||
      opacityScale <= 0 ||
      sizeResponse <= 0 ||
      opacityResponse <= 0 ||
      flowResponse <= 0
    ) {
      return;
    }
    const resolvedRadius = this.#radius * sizeScale * sizeResponse * stamp.sizeJitterScale;
    const resolvedFlow = this.#flow * opacityScale * flowResponse;
    const resolvedStrokeOpacity = this.#strokeOpacity * opacityResponse * stamp.opacityJitterScale;
    const resolvedDensity = this.#tipDensity * stamp.densityJitterScale;
    const emitParticle = (
      particleX: number,
      particleY: number,
      radiusScale: number,
      tipAngleDegrees: number,
    ): void =>
      pushBaselineBrushStampV1(
        target,
        particleX,
        particleY,
        resolvedRadius * radiusScale,
        resolvedFlow,
        resolvedStrokeOpacity,
        this.#hardness,
        resolvedDensity,
        tipAngleDegrees,
        stamp.color,
        this.#tipShape,
        stamp.sampledTipAlpha,
        this.#referenceAntiOverflow,
        stamp.x,
        stamp.y,
      );
    if (stamp.sprayParticles === null) {
      emitParticle(stamp.x, stamp.y, 1, stamp.tipAngleDegrees);
      return;
    }
    for (const particle of stamp.sprayParticles) {
      emitParticle(particle.x, particle.y, this.#sprayParticleSizeRatio, particle.tipAngleDegrees);
    }
  }

  #pushLogicalStamp(
    x: number,
    y: number,
    pressure: number,
    velocity: number,
    tiltUprightness: number,
    tipAngleDegrees: number,
    pathDistancePx: number,
  ): void {
    const startEnvelope = this.#startEnvelopeAtDistance(pathDistancePx);
    const usesRandom =
      this.#randomSizeEnabled || this.#randomOpacityEnabled || this.#randomFlowEnabled;
    const randomInput = usesRandom
      ? deterministicBaselineBrushRandomV1(this.#randomSeed, this.#randomStampIndex)
      : 1;
    if (usesRandom) this.#randomStampIndex += 1;
    const sizeJitterScale =
      this.#sizeJitter > 0
        ? 1 -
          this.#sizeJitter *
            deterministicBaselineBrushSizeJitterV1(this.#randomSeed, this.#sizeJitterStampIndex)
        : 1;
    if (this.#sizeJitter > 0) this.#sizeJitterStampIndex += 1;
    const opacityJitterScale =
      this.#opacityJitter > 0
        ? 1 -
          this.#opacityJitter *
            deterministicBaselineBrushOpacityJitterV1(
              this.#randomSeed,
              this.#opacityJitterStampIndex,
            )
        : 1;
    if (this.#opacityJitter > 0) this.#opacityJitterStampIndex += 1;
    const jitteredTipAngleDegrees =
      this.#rotationJitter > 0
        ? normalizeBaselineBrushTipAngleDegreesV1(
            tipAngleDegrees +
              (deterministicBaselineBrushRotationJitterV1(
                this.#randomSeed,
                this.#rotationJitterStampIndex,
              ) -
                0.5) *
                360 *
                this.#rotationJitter,
          )
        : tipAngleDegrees;
    if (this.#rotationJitter > 0) this.#rotationJitterStampIndex += 1;
    const positionJitterVector =
      this.#positionJitter > 0
        ? deterministicBaselineBrushPositionJitterV1(
            this.#randomSeed,
            this.#positionJitterStampIndex,
          )
        : null;
    if (this.#positionJitter > 0) this.#positionJitterStampIndex += 1;
    const maximumPositionOffsetPx = this.#radius * 2 * this.#positionJitter;
    const jitteredX =
      positionJitterVector === null ? x : x + positionJitterVector.x * maximumPositionOffsetPx;
    const jitteredY =
      positionJitterVector === null ? y : y + positionJitterVector.y * maximumPositionOffsetPx;
    const densityJitterScale =
      this.#densityJitter > 0
        ? 1 -
          this.#densityJitter *
            deterministicBaselineBrushDensityJitterV1(
              this.#randomSeed,
              this.#densityJitterStampIndex,
            )
        : 1;
    if (this.#densityJitter > 0) this.#densityJitterStampIndex += 1;
    const usesColorJitter =
      this.#hueJitter > 0 || this.#saturationJitter > 0 || this.#valueJitter > 0;
    const colorJitterRandom = usesColorJitter
      ? deterministicBaselineBrushColorJitterV1(this.#randomSeed, this.#colorJitterStampIndex)
      : null;
    if (usesColorJitter) this.#colorJitterStampIndex += 1;
    const baseColor = mixBaselineBrushMainSubColorV1(
      this.#color,
      this.#subColor,
      this.#subColorRatio,
    );
    const resolvedColor =
      colorJitterRandom === null
        ? baseColor
        : applyBaselineBrushColorJitterV1(
            baseColor,
            colorJitterRandom,
            this.#hueJitter,
            this.#saturationJitter,
            this.#valueJitter,
          );
    const sprayParticles = this.#sprayEnabled
      ? Object.freeze(
          Array.from({ length: this.#sprayParticleDensity }, (_, particleIndex) => {
            const baseUnit = deterministicBaselineBrushSprayParticleV1(
              this.#randomSeed,
              this.#sprayStampIndex,
              particleIndex,
            );
            const unit = applyBaselineBrushSprayDeviationV1(baseUnit, this.#sprayDeviation);
            const spreadRadiusPx = this.#radius * this.#spraySpreadRadiusRatio;
            const particleX = jitteredX + unit.x * spreadRadiusPx;
            const particleY = jitteredY + unit.y * spreadRadiusPx;
            const radialLength = Math.hypot(particleX - jitteredX, particleY - jitteredY);
            const particleTipAngleDegrees =
              this.#sprayAngleBasedOnCenter && radialLength > 1e-12
                ? normalizeBaselineBrushTipAngleDegreesV1(
                    jitteredTipAngleDegrees +
                      (Math.atan2(particleY - jitteredY, particleX - jitteredX) * 180) / Math.PI,
                  )
                : jitteredTipAngleDegrees;
            return Object.freeze({
              x: particleX,
              y: particleY,
              tipAngleDegrees: particleTipAngleDegrees,
            });
          }),
        )
      : null;
    if (this.#sprayEnabled) this.#sprayStampIndex += 1;
    const sampledTipAlpha = this.#sampledTipAlphaForLogicalStamp();
    const record: BaselineLogicalStampRecordV1 = {
      x: jitteredX,
      y: jitteredY,
      pressure,
      velocity,
      randomInput,
      sizeJitterScale,
      opacityJitterScale,
      densityJitterScale,
      color: resolvedColor,
      tiltUprightness,
      tipAngleDegrees: jitteredTipAngleDegrees,
      pathDistancePx,
      sampledTipAlpha,
      sprayParticles,
      primitiveStart: this.#dabs.length,
      primitiveEnd: this.#dabs.length,
    };
    this.#emitLogicalStamp(this.#dabs, record, startEnvelope, 1);
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
      const startEnvelope = this.#startEnvelopeAtDistance(stamp.pathDistancePx);
      const endEnvelope = this.#endEnvelopeAtDistance(stamp.pathDistancePx, totalDistancePx);
      this.#emitLogicalStamp(this.#dabs, stamp, startEnvelope, endEnvelope);
      stamp.primitiveEnd = this.#dabs.length;
    }
  }

  #resolvedTipAngleDegrees(
    strokeDirectionDegrees?: number,
    penOrientationDegrees?: number,
  ): number {
    const sourceAngle =
      this.#penOrientationEnabled && penOrientationDegrees !== undefined
        ? penOrientationDegrees
        : this.#followStrokeRotation && strokeDirectionDegrees !== undefined
          ? strokeDirectionDegrees
          : 0;
    return normalizeBaselineBrushTipAngleDegreesV1(
      sourceAngle + this.#tipAngleDegrees - this.#tipDirectionDegrees,
    );
  }

  #appendPoint(
    x: number,
    y: number,
    pressure: number,
    velocity: number,
    tiltUprightness: number,
    orientationDegrees: number,
  ): void {
    const lastPoint = this.#lastPoint;
    if (lastPoint === null) return;

    let cursorX = lastPoint.x;
    let cursorY = lastPoint.y;
    let cursorPressure = lastPoint.pressure;
    let cursorVelocity = lastPoint.velocity;
    let cursorTiltUprightness = lastPoint.tiltUprightness;
    let cursorOrientationDegrees = lastPoint.orientationDegrees;
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
      cursorPressure += (pressure - cursorPressure) * ratio;
      cursorVelocity += (velocity - cursorVelocity) * ratio;
      cursorTiltUprightness += (tiltUprightness - cursorTiltUprightness) * ratio;
      cursorOrientationDegrees = normalizeBaselineBrushTipAngleDegreesV1(
        cursorOrientationDegrees +
          shortestAngularDeltaDegreesV1(cursorOrientationDegrees, orientationDegrees) * ratio,
      );
      segmentAdvancedPx += stepDistancePx;
      this.#pushLogicalStamp(
        cursorX,
        cursorY,
        cursorPressure,
        cursorVelocity,
        cursorTiltUprightness,
        this.#resolvedTipAngleDegrees(
          this.#lastStrokeDirectionDegrees ?? undefined,
          cursorOrientationDegrees,
        ),
        this.#pathDistancePx + segmentAdvancedPx,
      );
      this.#lastStampPoint = { x: cursorX, y: cursorY };
      remaining = Math.hypot(x - cursorX, y - cursorY);
      this.#distanceUntilNext = this.#spacing;
    }

    if (remaining > 0) this.#distanceUntilNext -= remaining;
    this.#pathDistancePx += segmentLength;
    this.#lastPoint = { x, y, pressure, velocity, tiltUprightness, orientationDegrees };
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
