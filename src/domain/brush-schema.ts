import { toJsonValue, type JsonValue } from './serialization.js';

export const BRUSH_V1_SCHEMA = 'illustro.brush/1' as const;
export const BRUSH_SCHEMA_VERSION = 1 as const;
export const ILLBRUSH_PACKAGE_VERSION = '1.0' as const;
export const ILLBRUSH_MIME_TYPE = 'application/x-illustro-brush+zip' as const;

export type BrushSchemaIdentifier = typeof BRUSH_V1_SCHEMA;
export type BrushSchemaVersion = typeof BRUSH_SCHEMA_VERSION;
export type BrushBehaviorV1 = 'paint' | 'erase' | 'smudge' | 'blur';
export type BrushProceduralTipShapeV1 = 'round' | 'square';
export type BrushTipShapeV1 = BrushProceduralTipShapeV1 | 'sampled-image';
export const BUILTIN_SAMPLED_IMAGE_BRUSH_TIP_ID_V1 = 'builtin.sampled-tip.ink-v1' as const;
export const CUSTOM_SAMPLED_IMAGE_BRUSH_TIP_SIDE_V1 = 5 as const;
export const CUSTOM_SAMPLED_IMAGE_BRUSH_TIP_PIXEL_COUNT_V1 =
  CUSTOM_SAMPLED_IMAGE_BRUSH_TIP_SIDE_V1 * CUSTOM_SAMPLED_IMAGE_BRUSH_TIP_SIDE_V1;
export type BrushSampledTipAlphaV1 = readonly number[];
export const BRUSH_TIP_ASSET_LIMIT_V1 = 16 as const;
export interface BrushTipAssetV1 {
  readonly id: string;
  readonly name: string;
  readonly alpha: BrushSampledTipAlphaV1;
}
export type BrushPresetSectionV1 = Readonly<Record<string, JsonValue>>;

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
    sizePx: finiteRange(limits?.sizePx, DEFAULT_BRUSH_PARAMETER_LIMITS_V1.sizePx, 1, 4096),
    opacity: finiteRange(limits?.opacity, DEFAULT_BRUSH_PARAMETER_LIMITS_V1.opacity, 0.01, 1),
    flow: finiteRange(limits?.flow, DEFAULT_BRUSH_PARAMETER_LIMITS_V1.flow, 0.01, 1),
  });
}

function clampToRange(value: number, range: BrushParameterRangeV1): number {
  return Math.min(range.max, Math.max(range.min, value));
}

function numericSectionValue(section: BrushPresetSectionV1, key: string, fallback: number): number {
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

export const DEFAULT_BRUSH_TIP_HARDNESS_V1 = 0.85 as const;

export function brushTipHardnessV1(preset: BrushPresetV1): number {
  const value = preset.tip.hardness;
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1
    ? value
    : DEFAULT_BRUSH_TIP_HARDNESS_V1;
}

export function withBrushTipHardnessV1(preset: BrushPresetV1, hardness: number): BrushPresetV1 {
  if (!Number.isFinite(hardness) || hardness < 0 || hardness > 1) {
    throw new RangeError('brush tip hardness must be within 0..1');
  }
  return normalizeBrushPresetV1({
    ...preset,
    tip: { ...preset.tip, hardness },
  });
}
export const DEFAULT_BRUSH_TIP_DENSITY_V1 = 1 as const;

export function brushTipDensityV1(preset: BrushPresetV1): number {
  const value = preset.tip.density;
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1
    ? value
    : DEFAULT_BRUSH_TIP_DENSITY_V1;
}

export function withBrushTipDensityV1(preset: BrushPresetV1, density: number): BrushPresetV1 {
  if (!Number.isFinite(density) || density < 0 || density > 1) {
    throw new RangeError('brush tip density must be within 0..1');
  }
  return normalizeBrushPresetV1({
    ...preset,
    tip: { ...preset.tip, density },
  });
}

export const DEFAULT_BRUSH_SPACING_RATIO_V1 = 0.25 as const;
export const MIN_BRUSH_SPACING_RATIO_V1 = 0.01 as const;
export const MAX_BRUSH_SPACING_RATIO_V1 = 4 as const;
export const DEFAULT_BRUSH_MINIMUM_STAMP_DISTANCE_PX_V1 = 1 as const;

export interface BrushStrokeSpacingV1 {
  readonly spacingRatio: number;
  readonly minimumStampDistancePx: number;
}

export function brushStrokeSpacingV1(preset: BrushPresetV1): BrushStrokeSpacingV1 {
  const rawRatio = preset.stroke.spacingRatio;
  const rawMinimum = preset.stroke.minimumStampDistancePx;
  const spacingRatio =
    typeof rawRatio === 'number' &&
    Number.isFinite(rawRatio) &&
    rawRatio >= MIN_BRUSH_SPACING_RATIO_V1 &&
    rawRatio <= MAX_BRUSH_SPACING_RATIO_V1
      ? rawRatio
      : DEFAULT_BRUSH_SPACING_RATIO_V1;
  const minimumStampDistancePx =
    typeof rawMinimum === 'number' &&
    Number.isFinite(rawMinimum) &&
    rawMinimum > 0 &&
    rawMinimum <= 4096
      ? rawMinimum
      : DEFAULT_BRUSH_MINIMUM_STAMP_DISTANCE_PX_V1;
  return Object.freeze({ spacingRatio, minimumStampDistancePx });
}

export function withBrushStrokeSpacingV1(
  preset: BrushPresetV1,
  spacingRatio: number,
): BrushPresetV1 {
  if (
    !Number.isFinite(spacingRatio) ||
    spacingRatio < MIN_BRUSH_SPACING_RATIO_V1 ||
    spacingRatio > MAX_BRUSH_SPACING_RATIO_V1
  ) {
    throw new RangeError('brush spacing ratio must be within 0.01..4');
  }
  const current = brushStrokeSpacingV1(preset);
  return normalizeBrushPresetV1({
    ...preset,
    stroke: {
      ...preset.stroke,
      spacingRatio,
      minimumStampDistancePx: current.minimumStampDistancePx,
    },
  });
}

export const DEFAULT_BRUSH_TIP_ANGLE_DEGREES_V1 = 0 as const;

function normalizeBrushTipAngleDegreesV1(angleDegrees: number): number {
  if (!Number.isFinite(angleDegrees)) throw new TypeError('brush tip angle must be finite');
  const normalized = ((angleDegrees % 360) + 360) % 360;
  return Object.is(normalized, -0) ? 0 : normalized;
}

export function brushTipAngleDegreesV1(preset: BrushPresetV1): number {
  const value = preset.tip.angleDegrees;
  return typeof value === 'number' && Number.isFinite(value)
    ? normalizeBrushTipAngleDegreesV1(value)
    : DEFAULT_BRUSH_TIP_ANGLE_DEGREES_V1;
}

export function withBrushTipAngleDegreesV1(
  preset: BrushPresetV1,
  angleDegrees: number,
): BrushPresetV1 {
  const normalized = normalizeBrushTipAngleDegreesV1(angleDegrees);
  return normalizeBrushPresetV1({
    ...preset,
    tip: { ...preset.tip, angleDegrees: normalized },
  });
}

export const DEFAULT_BRUSH_TIP_DIRECTION_DEGREES_V1 = 0 as const;

function normalizeBrushTipDirectionDegreesV1(directionDegrees: number): number {
  if (!Number.isFinite(directionDegrees)) throw new TypeError('brush tip direction must be finite');
  const normalized = ((directionDegrees % 360) + 360) % 360;
  return Object.is(normalized, -0) ? 0 : normalized;
}

export function brushTipDirectionDegreesV1(preset: BrushPresetV1): number {
  const value = preset.tip.directionDegrees;
  return typeof value === 'number' && Number.isFinite(value)
    ? normalizeBrushTipDirectionDegreesV1(value)
    : DEFAULT_BRUSH_TIP_DIRECTION_DEGREES_V1;
}

export function withBrushTipDirectionDegreesV1(
  preset: BrushPresetV1,
  directionDegrees: number,
): BrushPresetV1 {
  const normalized = normalizeBrushTipDirectionDegreesV1(directionDegrees);
  return normalizeBrushPresetV1({
    ...preset,
    tip: { ...preset.tip, directionDegrees: normalized },
  });
}

export const DEFAULT_BRUSH_FOLLOW_STROKE_ROTATION_V1 = false as const;

export function brushFollowStrokeRotationV1(preset: BrushPresetV1): boolean {
  const value = preset.stroke.followRotation;
  return typeof value === 'boolean' ? value : DEFAULT_BRUSH_FOLLOW_STROKE_ROTATION_V1;
}

export function withBrushFollowStrokeRotationV1(
  preset: BrushPresetV1,
  followRotation: boolean,
): BrushPresetV1 {
  if (typeof followRotation !== 'boolean') {
    throw new TypeError('brush follow rotation must be boolean');
  }
  return normalizeBrushPresetV1({
    ...preset,
    stroke: { ...preset.stroke, followRotation },
  });
}

export const DEFAULT_BRUSH_STROKE_START_LENGTH_PX_V1 = 0 as const;
export const MAX_BRUSH_STROKE_START_LENGTH_PX_V1 = 4096 as const;

export function brushStrokeStartLengthPxV1(preset: BrushPresetV1): number {
  const value = preset.stroke.startLengthPx;
  return typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= MAX_BRUSH_STROKE_START_LENGTH_PX_V1
    ? value
    : DEFAULT_BRUSH_STROKE_START_LENGTH_PX_V1;
}

export function withBrushStrokeStartLengthPxV1(
  preset: BrushPresetV1,
  lengthPx: number,
): BrushPresetV1 {
  if (
    !Number.isFinite(lengthPx) ||
    lengthPx < 0 ||
    lengthPx > MAX_BRUSH_STROKE_START_LENGTH_PX_V1
  ) {
    throw new RangeError('brush stroke start length must be within 0..4096 px');
  }
  return normalizeBrushPresetV1({
    ...preset,
    stroke: { ...preset.stroke, startLengthPx: lengthPx },
  });
}

export const DEFAULT_BRUSH_STROKE_END_LENGTH_PX_V1 = 0 as const;
export const MAX_BRUSH_STROKE_END_LENGTH_PX_V1 = 4096 as const;

export function brushStrokeEndLengthPxV1(preset: BrushPresetV1): number {
  const value = preset.stroke.endLengthPx;
  return typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= MAX_BRUSH_STROKE_END_LENGTH_PX_V1
    ? value
    : DEFAULT_BRUSH_STROKE_END_LENGTH_PX_V1;
}

export function withBrushStrokeEndLengthPxV1(
  preset: BrushPresetV1,
  lengthPx: number,
): BrushPresetV1 {
  if (!Number.isFinite(lengthPx) || lengthPx < 0 || lengthPx > MAX_BRUSH_STROKE_END_LENGTH_PX_V1) {
    throw new RangeError('brush stroke end length must be within 0..4096 px');
  }
  return normalizeBrushPresetV1({
    ...preset,
    stroke: { ...preset.stroke, endLengthPx: lengthPx },
  });
}

export const DEFAULT_BRUSH_SIZE_TAPER_MINIMUM_RATIO_V1 = 0 as const;

export function brushSizeTaperMinimumRatioV1(preset: BrushPresetV1): number {
  const value = preset.stroke.sizeTaperMinimumRatio;
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1
    ? value
    : DEFAULT_BRUSH_SIZE_TAPER_MINIMUM_RATIO_V1;
}

export function withBrushSizeTaperMinimumRatioV1(
  preset: BrushPresetV1,
  minimumRatio: number,
): BrushPresetV1 {
  if (!Number.isFinite(minimumRatio) || minimumRatio < 0 || minimumRatio > 1) {
    throw new RangeError('brush size taper minimum ratio must be within 0..1');
  }
  return normalizeBrushPresetV1({
    ...preset,
    stroke: { ...preset.stroke, sizeTaperMinimumRatio: minimumRatio },
  });
}

export const DEFAULT_BRUSH_OPACITY_TAPER_MINIMUM_RATIO_V1 = 0 as const;

export function brushOpacityTaperMinimumRatioV1(preset: BrushPresetV1): number {
  const value = preset.stroke.opacityTaperMinimumRatio;
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1
    ? value
    : DEFAULT_BRUSH_OPACITY_TAPER_MINIMUM_RATIO_V1;
}

export function withBrushOpacityTaperMinimumRatioV1(
  preset: BrushPresetV1,
  minimumRatio: number,
): BrushPresetV1 {
  if (!Number.isFinite(minimumRatio) || minimumRatio < 0 || minimumRatio > 1) {
    throw new RangeError('brush opacity taper minimum ratio must be within 0..1');
  }
  return normalizeBrushPresetV1({
    ...preset,
    stroke: { ...preset.stroke, opacityTaperMinimumRatio: minimumRatio },
  });
}

export interface BrushForcedTaperV1 {
  readonly start: boolean;
  readonly end: boolean;
}

export const DEFAULT_BRUSH_FORCE_TAPER_START_V1 = false as const;
export const DEFAULT_BRUSH_FORCE_TAPER_END_V1 = false as const;

export function brushForcedTaperV1(preset: BrushPresetV1): BrushForcedTaperV1 {
  return Object.freeze({
    start:
      typeof preset.stroke.forceStartTaper === 'boolean'
        ? preset.stroke.forceStartTaper
        : DEFAULT_BRUSH_FORCE_TAPER_START_V1,
    end:
      typeof preset.stroke.forceEndTaper === 'boolean'
        ? preset.stroke.forceEndTaper
        : DEFAULT_BRUSH_FORCE_TAPER_END_V1,
  });
}

export function withBrushForcedTaperV1(
  preset: BrushPresetV1,
  forceStart: boolean,
  forceEnd: boolean,
): BrushPresetV1 {
  if (typeof forceStart !== 'boolean' || typeof forceEnd !== 'boolean') {
    throw new TypeError('brush forced taper flags must be boolean');
  }
  return normalizeBrushPresetV1({
    ...preset,
    stroke: {
      ...preset.stroke,
      forceStartTaper: forceStart,
      forceEndTaper: forceEnd,
    },
  });
}

export const DEFAULT_BRUSH_REALTIME_STABILIZATION_AMOUNT_V1 = 0 as const;

export function brushRealtimeStabilizationAmountV1(preset: BrushPresetV1): number {
  const value = preset.stabilization.amount;
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1
    ? value
    : DEFAULT_BRUSH_REALTIME_STABILIZATION_AMOUNT_V1;
}

export function withBrushRealtimeStabilizationAmountV1(
  preset: BrushPresetV1,
  amount: number,
): BrushPresetV1 {
  if (!Number.isFinite(amount) || amount < 0 || amount > 1) {
    throw new RangeError('brush real-time stabilization amount must be within 0..1');
  }
  return normalizeBrushPresetV1({
    ...preset,
    stabilization: { ...preset.stabilization, amount },
  });
}

export const DEFAULT_BRUSH_POST_STROKE_CORRECTION_AMOUNT_V1 = 0 as const;

export function brushPostStrokeCorrectionAmountV1(preset: BrushPresetV1): number {
  const value = preset.stabilization.postStrokeAmount;
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1
    ? value
    : DEFAULT_BRUSH_POST_STROKE_CORRECTION_AMOUNT_V1;
}

export function withBrushPostStrokeCorrectionAmountV1(
  preset: BrushPresetV1,
  amount: number,
): BrushPresetV1 {
  if (!Number.isFinite(amount) || amount < 0 || amount > 1) {
    throw new RangeError('brush post-stroke correction amount must be within 0..1');
  }
  return normalizeBrushPresetV1({
    ...preset,
    stabilization: { ...preset.stabilization, postStrokeAmount: amount },
  });
}

export type BrushTipSelectionModeV1 = 'fixed' | 'sequence' | 'random-per-stamp';
export const DEFAULT_BRUSH_TIP_SELECTION_MODE_V1: BrushTipSelectionModeV1 = 'fixed';

export function brushTipSelectionModeV1(preset: BrushPresetV1): BrushTipSelectionModeV1 {
  const value = preset.tip.selectionMode;
  return value === 'sequence' || value === 'random-per-stamp'
    ? value
    : DEFAULT_BRUSH_TIP_SELECTION_MODE_V1;
}

export function withBrushTipSelectionModeV1(
  preset: BrushPresetV1,
  selectionMode: BrushTipSelectionModeV1,
): BrushPresetV1 {
  if (
    selectionMode !== 'fixed' &&
    selectionMode !== 'sequence' &&
    selectionMode !== 'random-per-stamp'
  ) {
    throw new TypeError('unsupported brush tip selection mode');
  }
  return normalizeBrushPresetV1({
    ...preset,
    tip: { ...preset.tip, selectionMode },
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

function brushTipBaseV1(tip: BrushPresetSectionV1): BrushPresetSectionV1 {
  const copy: Record<string, JsonValue> = { ...tip };
  delete copy.kind;
  delete copy.sampleId;
  delete copy.side;
  delete copy.alpha;
  return Object.freeze(copy);
}

function freezeCustomSampledTipAlphaV1(value: unknown): BrushSampledTipAlphaV1 {
  if (!Array.isArray(value) || value.length !== CUSTOM_SAMPLED_IMAGE_BRUSH_TIP_PIXEL_COUNT_V1) {
    throw new RangeError('custom sampled brush tip requires exactly 25 alpha values');
  }
  const alpha = value.map((entry) => {
    if (typeof entry !== 'number' || !Number.isInteger(entry) || entry < 0 || entry > 255) {
      throw new RangeError('custom sampled brush tip alpha values must be integer bytes');
    }
    return entry;
  });
  if (!alpha.some((entry) => entry > 0)) {
    throw new RangeError('custom sampled brush tip cannot be fully transparent');
  }
  return Object.freeze(alpha);
}

function normalizedTipAssetTextV1(value: unknown, label: string, maximum: number): string {
  if (typeof value !== 'string') throw new TypeError(label + ' must be text');
  const normalized = value.trim();
  if (normalized.length < 1 || normalized.length > maximum) {
    throw new RangeError(label + ' must be 1..' + maximum + ' characters');
  }
  return normalized;
}

function normalizeBrushTipAssetV1(value: JsonValue, index: number): BrushTipAssetV1 {
  const record = jsonRecord(value);
  if (record === null) throw new TypeError('brush tip asset ' + index + ' must be an object');
  if (record.side !== CUSTOM_SAMPLED_IMAGE_BRUSH_TIP_SIDE_V1) {
    throw new RangeError('brush tip asset side must be 5');
  }
  return Object.freeze({
    id: normalizedTipAssetTextV1(record.id, 'brush tip asset id', 120),
    name: normalizedTipAssetTextV1(record.name, 'brush tip asset name', 80),
    alpha: freezeCustomSampledTipAlphaV1(record.alpha),
  });
}

function brushTipAssetStateV1(extensions: BrushPresetSectionV1): Readonly<{
  assets: readonly BrushTipAssetV1[];
  selectedAssetId: string | null;
}> {
  const rawAssets = extensions.tipAssets;
  const rawSelected = extensions.selectedTipAssetId;
  if (rawAssets === undefined) {
    if (rawSelected !== undefined)
      throw new TypeError('selected tip asset requires a tip asset collection');
    return Object.freeze({ assets: Object.freeze([]), selectedAssetId: null });
  }
  if (
    !Array.isArray(rawAssets) ||
    rawAssets.length < 1 ||
    rawAssets.length > BRUSH_TIP_ASSET_LIMIT_V1
  ) {
    throw new RangeError('brush tip assets must contain 1..' + BRUSH_TIP_ASSET_LIMIT_V1 + ' items');
  }
  const assets = Object.freeze(
    rawAssets.map((value, index) => normalizeBrushTipAssetV1(value, index)),
  );
  const ids = new Set<string>();
  for (const asset of assets) {
    if (ids.has(asset.id)) throw new TypeError('duplicate brush tip asset id: ' + asset.id);
    ids.add(asset.id);
  }
  if (typeof rawSelected !== 'string' || !ids.has(rawSelected)) {
    throw new RangeError('selected brush tip asset is missing');
  }
  return Object.freeze({ assets, selectedAssetId: rawSelected });
}

export function brushTipAssetsV1(preset: BrushPresetV1): readonly BrushTipAssetV1[] {
  return brushTipAssetStateV1(preset.extensions).assets;
}

export function brushSelectedTipAssetIdV1(preset: BrushPresetV1): string | null {
  return brushTipAssetStateV1(preset.extensions).selectedAssetId;
}
export function brushSampledTipAlphaV1(preset: BrushPresetV1): BrushSampledTipAlphaV1 | null {
  if (preset.tip.kind !== 'sampled-image-custom') return null;
  if (preset.tip.side !== CUSTOM_SAMPLED_IMAGE_BRUSH_TIP_SIDE_V1) {
    throw new RangeError('unsupported custom sampled brush tip side');
  }
  return freezeCustomSampledTipAlphaV1(preset.tip.alpha);
}
export function brushProceduralTipShapeV1(preset: BrushPresetV1): BrushProceduralTipShapeV1 {
  return preset.tip.kind === 'procedural-square' ? 'square' : 'round';
}

export function withBrushProceduralTipShapeV1(
  preset: BrushPresetV1,
  shape: BrushProceduralTipShapeV1,
): BrushPresetV1 {
  if (shape !== 'round' && shape !== 'square')
    throw new TypeError('unsupported procedural tip shape');
  return normalizeBrushPresetV1({
    ...preset,
    tip: {
      ...brushTipBaseV1(preset.tip),
      kind: shape === 'square' ? 'procedural-square' : 'procedural-round',
    },
  });
}

export function brushTipShapeV1(preset: BrushPresetV1): BrushTipShapeV1 {
  if (preset.tip.kind === 'sampled-image-custom') {
    brushSampledTipAlphaV1(preset);
    return 'sampled-image';
  }
  if (preset.tip.kind === 'sampled-image') {
    if (preset.tip.sampleId !== BUILTIN_SAMPLED_IMAGE_BRUSH_TIP_ID_V1) {
      throw new TypeError('unsupported sampled brush tip resource');
    }
    return 'sampled-image';
  }
  return brushProceduralTipShapeV1(preset);
}

export function withBrushTipShapeV1(preset: BrushPresetV1, shape: BrushTipShapeV1): BrushPresetV1 {
  if (shape !== 'sampled-image') return withBrushProceduralTipShapeV1(preset, shape);
  return normalizeBrushPresetV1({
    ...preset,
    tip: {
      ...brushTipBaseV1(preset.tip),
      kind: 'sampled-image',
      sampleId: BUILTIN_SAMPLED_IMAGE_BRUSH_TIP_ID_V1,
    },
  });
}

export function withBrushCustomSampledTipV1(
  preset: BrushPresetV1,
  alpha: readonly number[],
): BrushPresetV1 {
  const normalizedAlpha = freezeCustomSampledTipAlphaV1(alpha);
  return normalizeBrushPresetV1({
    ...preset,
    tip: {
      ...brushTipBaseV1(preset.tip),
      kind: 'sampled-image-custom',
      side: CUSTOM_SAMPLED_IMAGE_BRUSH_TIP_SIDE_V1,
      alpha: [...normalizedAlpha],
    },
  });
}
function serializedBrushTipAssetV1(asset: BrushTipAssetV1): JsonValue {
  return {
    id: asset.id,
    name: asset.name,
    side: CUSTOM_SAMPLED_IMAGE_BRUSH_TIP_SIDE_V1,
    alpha: [...asset.alpha],
  };
}

function withBrushTipAssetStateV1(
  preset: BrushPresetV1,
  assets: readonly BrushTipAssetV1[],
  selectedAssetId: string,
): BrushPresetV1 {
  const selected = assets.find((asset) => asset.id === selectedAssetId);
  if (selected === undefined) throw new RangeError('selected brush tip asset is missing');
  return normalizeBrushPresetV1({
    ...preset,
    tip: {
      ...brushTipBaseV1(preset.tip),
      kind: 'sampled-image-custom',
      side: CUSTOM_SAMPLED_IMAGE_BRUSH_TIP_SIDE_V1,
      alpha: [...selected.alpha],
    },
    extensions: {
      ...preset.extensions,
      tipAssets: assets.map(serializedBrushTipAssetV1),
      selectedTipAssetId: selectedAssetId,
    },
  });
}

export function withBrushTipAssetAddedV1(
  preset: BrushPresetV1,
  asset: BrushTipAssetV1,
): BrushPresetV1 {
  const currentAssets = [...brushTipAssetsV1(preset)];
  if (currentAssets.length === 0 && preset.tip.kind === 'sampled-image-custom') {
    const existingAlpha = brushSampledTipAlphaV1(preset);
    if (existingAlpha !== null) {
      currentAssets.push(
        Object.freeze({ id: 'm6a019-custom', name: '先端 1', alpha: existingAlpha }),
      );
    }
  }
  if (currentAssets.length >= BRUSH_TIP_ASSET_LIMIT_V1) {
    throw new RangeError('brush tip asset limit reached');
  }
  const normalized = normalizeBrushTipAssetV1(
    {
      id: asset.id,
      name: asset.name,
      side: CUSTOM_SAMPLED_IMAGE_BRUSH_TIP_SIDE_V1,
      alpha: [...asset.alpha],
    },
    currentAssets.length,
  );
  if (currentAssets.some((entry) => entry.id === normalized.id)) {
    throw new RangeError('brush tip asset id already exists');
  }
  return withBrushTipAssetStateV1(preset, [...currentAssets, normalized], normalized.id);
}

export function withBrushTipAssetSelectionV1(
  preset: BrushPresetV1,
  assetId: string,
): BrushPresetV1 {
  const assets = brushTipAssetsV1(preset);
  if (!assets.some((asset) => asset.id === assetId))
    throw new RangeError('brush tip asset not found');
  return withBrushTipAssetStateV1(preset, assets, assetId);
}

export function withBrushTipAssetReplacementV1(
  preset: BrushPresetV1,
  assetId: string,
  alpha: BrushSampledTipAlphaV1,
): BrushPresetV1 {
  const normalizedAlpha = freezeCustomSampledTipAlphaV1(alpha);
  const assets = brushTipAssetsV1(preset).map((asset) =>
    asset.id === assetId ? Object.freeze({ ...asset, alpha: normalizedAlpha }) : asset,
  );
  if (!assets.some((asset) => asset.id === assetId))
    throw new RangeError('brush tip asset not found');
  return withBrushTipAssetStateV1(preset, assets, assetId);
}

export function withBrushTipAssetDeletedV1(preset: BrushPresetV1, assetId: string): BrushPresetV1 {
  const assets = brushTipAssetsV1(preset);
  if (!assets.some((asset) => asset.id === assetId))
    throw new RangeError('brush tip asset not found');
  if (assets.length <= 1) throw new RangeError('at least one brush tip asset must remain');
  const remaining = assets.filter((asset) => asset.id !== assetId);
  const selectedAssetId = brushSelectedTipAssetIdV1(preset);
  const nextSelected =
    selectedAssetId === assetId || selectedAssetId === null
      ? (remaining[0]?.id ?? '')
      : selectedAssetId;
  return withBrushTipAssetStateV1(preset, remaining, nextSelected);
}
export interface BrushPresetV1 {
  readonly schema: typeof BRUSH_V1_SCHEMA;
  readonly id: string;
  readonly revision: number;
  readonly name: string;
  readonly category: string;
  readonly tags: readonly string[];
  readonly behavior: BrushBehaviorV1;
  readonly defaultSizePx: number;
  readonly tip: BrushPresetSectionV1;
  readonly stroke: BrushPresetSectionV1;
  readonly ink: BrushPresetSectionV1;
  readonly dynamics: BrushPresetSectionV1;
  readonly jitter: BrushPresetSectionV1;
  readonly spray: BrushPresetSectionV1;
  readonly texture: BrushPresetSectionV1;
  readonly colorMix: BrushPresetSectionV1;
  readonly antiOverflow: BrushPresetSectionV1;
  readonly stabilization: BrushPresetSectionV1;
  readonly antiAlias: BrushPresetSectionV1;
  readonly provenance: BrushPresetSectionV1;
  readonly importCompatibility: BrushPresetSectionV1;
  readonly extensions: BrushPresetSectionV1;
}

export function isSupportedBrushSchema(value: unknown): value is BrushSchemaIdentifier {
  return value === BRUSH_V1_SCHEMA;
}

function normalizedText(value: string, label: string, maximum: number): string {
  const normalized = value.trim();
  if (normalized.length < 1 || normalized.length > maximum) {
    throw new RangeError(`${label} must be 1..${maximum} characters`);
  }
  return normalized;
}

function normalizeSection(value: unknown, label: string): BrushPresetSectionV1 {
  const json = toJsonValue(value);
  if (typeof json !== 'object' || json === null || Array.isArray(json)) {
    throw new TypeError(`${label} must be a JSON object`);
  }
  const record = json as { readonly [key: string]: JsonValue };
  return Object.freeze({ ...record });
}

export function normalizeBrushPresetV1(input: BrushPresetV1): BrushPresetV1 {
  if (input.schema !== BRUSH_V1_SCHEMA) throw new TypeError('unsupported brush schema');
  if (!Number.isSafeInteger(input.revision) || input.revision < 1) {
    throw new RangeError('brush revision must be a positive safe integer');
  }
  if (
    !Number.isFinite(input.defaultSizePx) ||
    input.defaultSizePx <= 0 ||
    input.defaultSizePx > 4096
  ) {
    throw new RangeError('brush default size must be finite and within 0..4096 px');
  }
  if (!['paint', 'erase', 'smudge', 'blur'].includes(input.behavior)) {
    throw new TypeError('unsupported brush behavior');
  }
  const tags = Object.freeze(
    [...new Set(input.tags.map((tag) => normalizedText(tag, 'brush tag', 80)))].slice(0, 64),
  );
  const tip = normalizeSection(input.tip, 'brush tip');
  if (tip.kind === 'sampled-image-custom') {
    if (tip.side !== CUSTOM_SAMPLED_IMAGE_BRUSH_TIP_SIDE_V1) {
      throw new RangeError('unsupported custom sampled brush tip side');
    }
    freezeCustomSampledTipAlphaV1(tip.alpha);
  }
  const extensions = normalizeSection(input.extensions, 'brush extensions');
  brushTipAssetStateV1(extensions);
  return Object.freeze({
    schema: BRUSH_V1_SCHEMA,
    id: normalizedText(input.id, 'brush id', 160),
    revision: input.revision,
    name: normalizedText(input.name, 'brush name', 120),
    category: normalizedText(input.category, 'brush category', 80),
    tags,
    behavior: input.behavior,
    defaultSizePx: input.defaultSizePx,
    tip,
    stroke: normalizeSection(input.stroke, 'brush stroke'),
    ink: normalizeSection(input.ink, 'brush ink'),
    dynamics: normalizeSection(input.dynamics, 'brush dynamics'),
    jitter: normalizeSection(input.jitter, 'brush jitter'),
    spray: normalizeSection(input.spray, 'brush spray'),
    texture: normalizeSection(input.texture, 'brush texture'),
    colorMix: normalizeSection(input.colorMix, 'brush colorMix'),
    antiOverflow: normalizeSection(input.antiOverflow, 'brush antiOverflow'),
    stabilization: normalizeSection(input.stabilization, 'brush stabilization'),
    antiAlias: normalizeSection(input.antiAlias, 'brush antiAlias'),
    provenance: normalizeSection(input.provenance, 'brush provenance'),
    importCompatibility: normalizeSection(input.importCompatibility, 'brush importCompatibility'),
    extensions,
  });
}

export function createBaselineBrushPresetV1(input: {
  readonly id: string;
  readonly name: string;
  readonly category: string;
  readonly behavior: BrushBehaviorV1;
  readonly defaultSizePx?: number;
  readonly tags?: readonly string[];
}): BrushPresetV1 {
  const behavior = input.behavior;
  return normalizeBrushPresetV1({
    schema: BRUSH_V1_SCHEMA,
    id: input.id,
    revision: 1,
    name: input.name,
    category: input.category,
    tags: input.tags ?? [],
    behavior,
    defaultSizePx: input.defaultSizePx ?? (behavior === 'paint' ? 16 : 24),
    tip: { kind: 'procedural-round', hardness: behavior === 'blur' ? 0.35 : 0.85 },
    stroke: { spacingRatio: 0.25, minimumStampDistancePx: 1 },
    ink: { opacity: 1, flow: 1, buildup: 'accumulate', blend: 'normal' },
    dynamics: {},
    jitter: {},
    spray: {},
    texture: {},
    colorMix: behavior === 'smudge' ? { enabled: true } : {},
    antiOverflow: {},
    stabilization: { amount: 0 },
    antiAlias: { quality: 'high' },
    provenance: { source: 'illustro-runtime-baseline' },
    importCompatibility: {},
    extensions: {
      parameterLimits: {
        sizePx: { min: 1, max: 4096 },
        opacity: { min: 0.01, max: 1 },
        flow: { min: 0.01, max: 1 },
      },
    },
  });
}
