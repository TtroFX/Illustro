import {
  BRUSH_TIP_ASSET_LIMIT_V1,
  brushParameterLimitsV1,
  brushParameterValuesV1,
  brushSampledTipAlphaV1,
  brushSelectedTipAssetIdV1,
  brushTipHardnessV1,
  brushTipDensityV1,
  brushTipAngleDegreesV1,
  brushTipDirectionDegreesV1,
  brushFollowStrokeRotationV1,
  brushPenOrientationEnabledV1,
  brushTipSelectionModeV1,
  brushStrokeStartLengthPxV1,
  brushStrokeEndLengthPxV1,
  brushSizeTaperMinimumRatioV1,
  brushOpacityTaperMinimumRatioV1,
  brushForcedTaperV1,
  brushRealtimeStabilizationAmountV1,
  brushPostStrokeCorrectionAmountV1,
  brushGrainResourceIdV1,
  brushPaperTextureResourceIdV1,
  brushTextureStrengthV1,
  brushTextureScaleV1,
  brushTextureRotationDegreesV1,
  brushTextureBlendModeV1,
  brushPressureSizeEnabledV1,
  brushPressureOpacityEnabledV1,
  brushPressureFlowEnabledV1,
  brushPressureResponseCurveOverrideV1,
  resolveBrushPressureResponseCurveV1,
  brushTiltSizeEnabledV1,
  brushTiltOpacityEnabledV1,
  brushTiltFlowEnabledV1,
  brushTiltResponseCurveV1,
  brushVelocitySizeEnabledV1,
  brushVelocityOpacityEnabledV1,
  brushVelocityFlowEnabledV1,
  brushVelocityResponseCurveV1,
  brushVelocityMaximumPxPerSecondV1,
  brushRandomSizeEnabledV1,
  brushRandomOpacityEnabledV1,
  brushRandomFlowEnabledV1,
  brushRandomResponseCurveV1,
  brushSizeMinimumResponseV1,
  brushOpacityMinimumResponseV1,
  brushFlowMinimumResponseV1,
  brushSizeMaximumResponseV1,
  brushOpacityMaximumResponseV1,
  brushFlowMaximumResponseV1,
  brushSizeJitterV1,
  brushOpacityJitterV1,
  brushRotationJitterV1,
  brushPositionJitterV1,
  brushDensityJitterV1,
  brushHueJitterV1,
  brushSaturationJitterV1,
  brushValueJitterV1,
  brushSprayEnabledV1,
  brushSprayParticleSizeRatioV1,
  brushSprayParticleDensityV1,
  brushSpraySpreadRadiusRatioV1,
  brushSprayDeviationV1,
  brushSprayAngleBasedOnCenterV1,
  brushSubColorRatioV1,
  brushReferenceAntiOverflowV1,
  brushColorMixEnabledV1,
  brushColorMixCanvasRatioV1,
  brushColorMixDepositAmountV1,
  brushColorMixSampleRadiusRatioV1,
  brushColorMixPickupAmountV1,
  brushColorMixCarryAmountV1,
  BUILTIN_BRUSH_GRAIN_RESOURCES_V1,
  BUILTIN_BRUSH_PAPER_RESOURCES_V1,
  brushStrokeSpacingV1,
  brushTipAssetsV1,
  brushTipShapeV1,
  type BrushBehaviorV1,
  type BrushParameterValuesV1,
  type BrushTipSelectionModeV1,
  type BrushTipShapeV1,
  type BrushTextureBlendModeV1,
} from '../domain/brush-schema.js';
import {
  LINEAR_RESPONSE_CURVE_V1,
  responseCurveIsLinearV1,
  type ResponseCurvePointV1,
} from '../domain/response-curve.js';
import { customBrushTipAlphaFromFileV1, drawCustomBrushTipPreviewV1 } from './custom-brush-tip.js';
import type { PaintSessionControllerV1 } from './paint-session-controller.js';
import { installSharedCurveEditorV1, type SharedCurveEditorV1 } from './shared-curve-editor.js';
import {
  addBrushPresetTipAssetV1,
  brushPresetCategoriesV1,
  createBrushPresetLibraryStateV1,
  createUserBrushPresetV1,
  deleteBrushPresetV1,
  duplicateBrushPresetV1,
  filteredBrushPresetItemsV1,
  parseBrushPresetLibraryV1,
  renameBrushPresetV1,
  resetBrushPresetV1,
  selectBrushPresetTipAssetV1,
  selectBrushPresetV1,
  selectedBrushPresetItemV1,
  serializeBrushPresetLibraryV1,
  setBrushPresetCategoryV1,
  setBrushPresetLockedV1,
  setBrushPresetSearchV1,
  deleteBrushPresetTipAssetV1,
  updateBrushPresetCustomTipV1,
  updateBrushPresetHardnessV1,
  updateBrushPresetTipDensityV1,
  updateBrushPresetTipAngleV1,
  updateBrushPresetTipDirectionV1,
  updateBrushPresetRotationSourceV1,
  updateBrushPresetTipSelectionModeV1,
  updateBrushPresetStartLengthV1,
  updateBrushPresetEndLengthV1,
  updateBrushPresetSizeTaperV1,
  updateBrushPresetOpacityTaperV1,
  updateBrushPresetForcedTaperV1,
  updateBrushPresetRealtimeStabilizationV1,
  updateBrushPresetPostStrokeCorrectionV1,
  updateBrushPresetGrainResourceV1,
  updateBrushPresetPaperTextureResourceV1,
  updateBrushPresetTextureStrengthV1,
  updateBrushPresetTextureScaleV1,
  updateBrushPresetTextureRotationV1,
  updateBrushPresetTextureBlendModeV1,
  updateBrushPresetPressureSizeV1,
  updateBrushPresetPressureOpacityV1,
  updateBrushPresetPressureFlowV1,
  updateBrushPresetPressureResponseCurveV1,
  clearBrushPresetPressureResponseCurveOverrideV1,
  updateBrushPresetTiltSizeV1,
  updateBrushPresetTiltOpacityV1,
  updateBrushPresetTiltFlowV1,
  updateBrushPresetTiltResponseCurveV1,
  updateBrushPresetVelocitySizeV1,
  updateBrushPresetVelocityOpacityV1,
  updateBrushPresetVelocityFlowV1,
  updateBrushPresetVelocityResponseCurveV1,
  updateBrushPresetVelocityMaximumV1,
  updateBrushPresetRandomSizeV1,
  updateBrushPresetRandomOpacityV1,
  updateBrushPresetRandomFlowV1,
  updateBrushPresetRandomResponseCurveV1,
  updateBrushPresetSizeMinimumResponseV1,
  updateBrushPresetOpacityMinimumResponseV1,
  updateBrushPresetFlowMinimumResponseV1,
  updateBrushPresetSizeMaximumResponseV1,
  updateBrushPresetOpacityMaximumResponseV1,
  updateBrushPresetFlowMaximumResponseV1,
  updateBrushPresetSizeJitterV1,
  updateBrushPresetOpacityJitterV1,
  updateBrushPresetRotationJitterV1,
  updateBrushPresetPositionJitterV1,
  updateBrushPresetDensityJitterV1,
  updateBrushPresetHueJitterV1,
  updateBrushPresetSaturationJitterV1,
  updateBrushPresetValueJitterV1,
  updateBrushPresetSprayEnabledV1,
  updateBrushPresetSprayParticleSizeRatioV1,
  updateBrushPresetSprayParticleDensityV1,
  updateBrushPresetSpraySpreadV1,
  updateBrushPresetSprayAngleBasedOnCenterV1,
  updateBrushPresetSubColorRatioV1,
  updateBrushPresetReferenceAntiOverflowV1,
  updateBrushPresetColorMixEnabledV1,
  updateBrushPresetColorMixCanvasRatioV1,
  updateBrushPresetColorMixDepositAmountV1,
  updateBrushPresetColorMixSampleRadiusRatioV1,
  updateBrushPresetColorMixPickupAmountV1,
  updateBrushPresetColorMixCarryAmountV1,
  updateBrushPresetSpacingV1,
  updateBrushPresetParametersV1,
  updateBrushPresetTipShapeV1,
  type BrushPresetLibraryStateV1,
} from './brush-preset-library.js';

const STORAGE_KEY = 'illustro.brush-preset-library/1';

function requireElement<T extends Element>(
  selector: string,
  ctor: { new (...args: never[]): T },
): T {
  const element = document.querySelector(selector);
  if (!(element instanceof ctor)) throw new Error(`missing Brush Presets UI: ${selector}`);
  return element;
}

function loadState(storage: Storage | null): BrushPresetLibraryStateV1 {
  const raw = storage?.getItem(STORAGE_KEY);
  if (raw === null || raw === undefined) return createBrushPresetLibraryStateV1();
  try {
    return parseBrushPresetLibraryV1(raw);
  } catch {
    return createBrushPresetLibraryStateV1();
  }
}

function modeForBehavior(behavior: BrushBehaviorV1): 'raster' | 'eraser' | 'smudge' | 'blur' {
  return behavior === 'paint' ? 'raster' : behavior === 'erase' ? 'eraser' : behavior;
}

export interface PressureResponseDefaultSourceV1 {
  snapshot(): { readonly curve: readonly ResponseCurvePointV1[] };
  subscribe(listener: (curve: readonly ResponseCurvePointV1[]) => void): () => void;
}

export interface BrushPresetControllerV1 {
  snapshot(): BrushPresetLibraryStateV1;
  refresh(): void;
  dispose(): void;
}

export function installBrushPresetControllerV1(input: {
  readonly root: HTMLElement;
  readonly paintSession: PaintSessionControllerV1;
  readonly storage?: Storage | null;
  readonly pressureResponseDefault?: PressureResponseDefaultSourceV1;
  readonly onBrushModeChanged?: () => void;
}): BrushPresetControllerV1 {
  const storage = input.storage ?? globalThis.localStorage;
  const defaultPressureResponseCurve = (): readonly ResponseCurvePointV1[] =>
    input.pressureResponseDefault?.snapshot().curve ?? LINEAR_RESPONSE_CURVE_V1;
  const search = requireElement('#brush-preset-search', HTMLInputElement);
  const category = requireElement('#brush-preset-category', HTMLSelectElement);
  const list = requireElement('#brush-preset-list', HTMLFieldSetElement);
  const name = requireElement('#brush-preset-name', HTMLInputElement);
  const createButton = requireElement('#brush-preset-create', HTMLButtonElement);
  const duplicateButton = requireElement('#brush-preset-duplicate', HTMLButtonElement);
  const renameButton = requireElement('#brush-preset-rename', HTMLButtonElement);
  const deleteButton = requireElement('#brush-preset-delete', HTMLButtonElement);
  const lockButton = requireElement('#brush-preset-lock', HTMLButtonElement);
  const resetButton = requireElement('#brush-preset-reset', HTMLButtonElement);
  const status = requireElement('#brush-preset-status', HTMLOutputElement);
  const propertyStatus = requireElement('#brush-property-status', HTMLOutputElement);
  const sizeRange = requireElement('#brush-size-range', HTMLInputElement);
  const sizeNumber = requireElement('#brush-size-number', HTMLInputElement);
  const opacityRange = requireElement('#brush-opacity-range', HTMLInputElement);
  const opacityNumber = requireElement('#brush-opacity-number', HTMLInputElement);
  const flowRange = requireElement('#brush-flow-range', HTMLInputElement);
  const flowNumber = requireElement('#brush-flow-number', HTMLInputElement);
  const hardnessRange = requireElement('#brush-hardness-range', HTMLInputElement);
  const hardnessNumber = requireElement('#brush-hardness-number', HTMLInputElement);
  const tipDensityRange = requireElement('#brush-tip-density-range', HTMLInputElement);
  const tipDensityNumber = requireElement('#brush-tip-density-number', HTMLInputElement);
  const spacingRange = requireElement('#brush-spacing-range', HTMLInputElement);
  const spacingNumber = requireElement('#brush-spacing-number', HTMLInputElement);
  const tipAngleRange = requireElement('#brush-tip-angle-range', HTMLInputElement);
  const tipAngleNumber = requireElement('#brush-tip-angle-number', HTMLInputElement);
  const tipDirectionRange = requireElement('#brush-tip-direction-range', HTMLInputElement);
  const tipDirectionNumber = requireElement('#brush-tip-direction-number', HTMLInputElement);
  const followRotationButton = requireElement('#brush-follow-rotation', HTMLButtonElement);
  const penOrientationButton = requireElement('#brush-pen-orientation', HTMLButtonElement);
  const tipRepeatMode = requireElement('#brush-tip-repeat-mode', HTMLSelectElement);
  const startLengthRange = requireElement('#brush-start-length-range', HTMLInputElement);
  const startLengthNumber = requireElement('#brush-start-length-number', HTMLInputElement);
  const endLengthRange = requireElement('#brush-end-length-range', HTMLInputElement);
  const endLengthNumber = requireElement('#brush-end-length-number', HTMLInputElement);
  const sizeTaperRange = requireElement('#brush-size-taper-range', HTMLInputElement);
  const sizeTaperNumber = requireElement('#brush-size-taper-number', HTMLInputElement);
  const opacityTaperRange = requireElement('#brush-opacity-taper-range', HTMLInputElement);
  const opacityTaperNumber = requireElement('#brush-opacity-taper-number', HTMLInputElement);
  const forceStartTaperButton = requireElement('#brush-force-start-taper', HTMLButtonElement);
  const forceEndTaperButton = requireElement('#brush-force-end-taper', HTMLButtonElement);
  const stabilizationRange = requireElement('#brush-stabilization-range', HTMLInputElement);
  const stabilizationNumber = requireElement('#brush-stabilization-number', HTMLInputElement);
  const postCorrectionRange = requireElement('#brush-post-correction-range', HTMLInputElement);
  const postCorrectionNumber = requireElement('#brush-post-correction-number', HTMLInputElement);
  const grainResource = requireElement('#brush-grain-resource', HTMLSelectElement);
  const paperResource = requireElement('#brush-paper-resource', HTMLSelectElement);
  const textureStrengthRange = requireElement('#brush-texture-strength-range', HTMLInputElement);
  const textureStrengthNumber = requireElement('#brush-texture-strength-number', HTMLInputElement);
  const textureScaleRange = requireElement('#brush-texture-scale-range', HTMLInputElement);
  const textureScaleNumber = requireElement('#brush-texture-scale-number', HTMLInputElement);
  const textureRotationRange = requireElement('#brush-texture-rotation-range', HTMLInputElement);
  const textureRotationNumber = requireElement('#brush-texture-rotation-number', HTMLInputElement);
  const textureBlendMode = requireElement('#brush-texture-blend-mode', HTMLSelectElement);
  const pressureSizeButton = requireElement('#brush-pressure-size', HTMLButtonElement);
  const pressureOpacityButton = requireElement('#brush-pressure-opacity', HTMLButtonElement);
  const pressureFlowButton = requireElement('#brush-pressure-flow', HTMLButtonElement);
  const pressureCurveCanvas = requireElement('#brush-pressure-curve', HTMLCanvasElement);
  const pressureCurvePreset = requireElement('#brush-pressure-curve-preset', HTMLSelectElement);
  const pressureCurveInput = requireElement('#brush-pressure-curve-input', HTMLInputElement);
  const pressureCurveOutput = requireElement('#brush-pressure-curve-output', HTMLInputElement);
  const pressureCurveDelete = requireElement('#brush-pressure-curve-delete', HTMLButtonElement);
  const pressureCurveReset = requireElement('#brush-pressure-curve-reset', HTMLButtonElement);
  const pressureCurveOverrideButton = requireElement(
    '#brush-pressure-curve-override',
    HTMLButtonElement,
  );
  const tiltSizeButton = requireElement('#brush-tilt-size', HTMLButtonElement);
  const tiltOpacityButton = requireElement('#brush-tilt-opacity', HTMLButtonElement);
  const tiltFlowButton = requireElement('#brush-tilt-flow', HTMLButtonElement);
  const tiltCurveCanvas = requireElement('#brush-tilt-curve', HTMLCanvasElement);
  const tiltCurvePreset = requireElement('#brush-tilt-curve-preset', HTMLSelectElement);
  const tiltCurveInput = requireElement('#brush-tilt-curve-input', HTMLInputElement);
  const tiltCurveOutput = requireElement('#brush-tilt-curve-output', HTMLInputElement);
  const tiltCurveDelete = requireElement('#brush-tilt-curve-delete', HTMLButtonElement);
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
  const randomSizeButton = requireElement('#brush-random-size', HTMLButtonElement);
  const randomOpacityButton = requireElement('#brush-random-opacity', HTMLButtonElement);
  const randomFlowButton = requireElement('#brush-random-flow', HTMLButtonElement);
  const randomCurveCanvas = requireElement('#brush-random-curve', HTMLCanvasElement);
  const randomCurvePreset = requireElement('#brush-random-curve-preset', HTMLSelectElement);
  const randomCurveInput = requireElement('#brush-random-curve-input', HTMLInputElement);
  const randomCurveOutput = requireElement('#brush-random-curve-output', HTMLInputElement);
  const randomCurveDelete = requireElement('#brush-random-curve-delete', HTMLButtonElement);
  const randomCurveReset = requireElement('#brush-random-curve-reset', HTMLButtonElement);
  const sizeMinimumResponseRange = requireElement(
    '#brush-size-minimum-response-range',
    HTMLInputElement,
  );
  const sizeMinimumResponseNumber = requireElement(
    '#brush-size-minimum-response-number',
    HTMLInputElement,
  );
  const opacityMinimumResponseRange = requireElement(
    '#brush-opacity-minimum-response-range',
    HTMLInputElement,
  );
  const opacityMinimumResponseNumber = requireElement(
    '#brush-opacity-minimum-response-number',
    HTMLInputElement,
  );
  const flowMinimumResponseRange = requireElement(
    '#brush-flow-minimum-response-range',
    HTMLInputElement,
  );
  const flowMinimumResponseNumber = requireElement(
    '#brush-flow-minimum-response-number',
    HTMLInputElement,
  );
  const sizeMaximumResponseRange = requireElement(
    '#brush-size-maximum-response-range',
    HTMLInputElement,
  );
  const sizeMaximumResponseNumber = requireElement(
    '#brush-size-maximum-response-number',
    HTMLInputElement,
  );
  const opacityMaximumResponseRange = requireElement(
    '#brush-opacity-maximum-response-range',
    HTMLInputElement,
  );
  const opacityMaximumResponseNumber = requireElement(
    '#brush-opacity-maximum-response-number',
    HTMLInputElement,
  );
  const flowMaximumResponseRange = requireElement(
    '#brush-flow-maximum-response-range',
    HTMLInputElement,
  );
  const flowMaximumResponseNumber = requireElement(
    '#brush-flow-maximum-response-number',
    HTMLInputElement,
  );
  const sizeJitterRange = requireElement('#brush-size-jitter-range', HTMLInputElement);
  const sizeJitterNumber = requireElement('#brush-size-jitter-number', HTMLInputElement);
  const opacityJitterRange = requireElement('#brush-opacity-jitter-range', HTMLInputElement);
  const opacityJitterNumber = requireElement('#brush-opacity-jitter-number', HTMLInputElement);
  const rotationJitterRange = requireElement('#brush-rotation-jitter-range', HTMLInputElement);
  const rotationJitterNumber = requireElement('#brush-rotation-jitter-number', HTMLInputElement);
  const positionJitterRange = requireElement('#brush-position-jitter-range', HTMLInputElement);
  const positionJitterNumber = requireElement('#brush-position-jitter-number', HTMLInputElement);
  const densityJitterRange = requireElement('#brush-density-jitter-range', HTMLInputElement);
  const densityJitterNumber = requireElement('#brush-density-jitter-number', HTMLInputElement);
  const hueJitterRange = requireElement('#brush-hue-jitter-range', HTMLInputElement);
  const hueJitterNumber = requireElement('#brush-hue-jitter-number', HTMLInputElement);
  const saturationJitterRange = requireElement('#brush-saturation-jitter-range', HTMLInputElement);
  const saturationJitterNumber = requireElement(
    '#brush-saturation-jitter-number',
    HTMLInputElement,
  );
  const valueJitterRange = requireElement('#brush-value-jitter-range', HTMLInputElement);
  const valueJitterNumber = requireElement('#brush-value-jitter-number', HTMLInputElement);
  const sprayEnabledButton = requireElement('#brush-spray-enabled', HTMLButtonElement);
  const sprayParticleSizeRange = requireElement(
    '#brush-spray-particle-size-range',
    HTMLInputElement,
  );
  const sprayParticleSizeNumber = requireElement(
    '#brush-spray-particle-size-number',
    HTMLInputElement,
  );
  const sprayParticleDensityRange = requireElement(
    '#brush-spray-particle-density-range',
    HTMLInputElement,
  );
  const sprayParticleDensityNumber = requireElement(
    '#brush-spray-particle-density-number',
    HTMLInputElement,
  );
  const spraySpreadRadiusRange = requireElement(
    '#brush-spray-spread-radius-range',
    HTMLInputElement,
  );
  const spraySpreadRadiusNumber = requireElement(
    '#brush-spray-spread-radius-number',
    HTMLInputElement,
  );
  const sprayDeviationRange = requireElement('#brush-spray-deviation-range', HTMLInputElement);
  const sprayDeviationNumber = requireElement('#brush-spray-deviation-number', HTMLInputElement);
  const sprayAngleBasedOnCenterButton = requireElement(
    '#brush-spray-angle-based-on-center',
    HTMLButtonElement,
  );
  const subColorRatioRange = requireElement('#brush-sub-color-ratio-range', HTMLInputElement);
  const subColorRatioNumber = requireElement('#brush-sub-color-ratio-number', HTMLInputElement);
  const referenceAntiOverflowButton = requireElement(
    '#brush-reference-anti-overflow',
    HTMLButtonElement,
  );
  const colorMixEnabledButton = requireElement('#brush-color-mix-enabled', HTMLButtonElement);
  const colorMixCanvasRatioRange = requireElement(
    '#brush-color-mix-canvas-ratio-range',
    HTMLInputElement,
  );
  const colorMixCanvasRatioNumber = requireElement(
    '#brush-color-mix-canvas-ratio-number',
    HTMLInputElement,
  );
  const colorMixDepositRange = requireElement('#brush-color-mix-deposit-range', HTMLInputElement);
  const colorMixDepositNumber = requireElement('#brush-color-mix-deposit-number', HTMLInputElement);
  const colorMixSampleRadiusRange = requireElement(
    '#brush-color-mix-sample-radius-range',
    HTMLInputElement,
  );
  const colorMixSampleRadiusNumber = requireElement(
    '#brush-color-mix-sample-radius-number',
    HTMLInputElement,
  );
  const colorMixPickupRange = requireElement('#brush-color-mix-pickup-range', HTMLInputElement);
  const colorMixPickupNumber = requireElement('#brush-color-mix-pickup-number', HTMLInputElement);
  const colorMixCarryRange = requireElement('#brush-color-mix-carry-range', HTMLInputElement);
  const colorMixCarryNumber = requireElement('#brush-color-mix-carry-number', HTMLInputElement);
  const tipShape = requireElement('#brush-tip-shape', HTMLSelectElement);
  const customTipCreate = requireElement('#brush-tip-custom-create', HTMLButtonElement);
  const customTipFile = requireElement('#brush-tip-custom-file', HTMLInputElement);
  const customTipStatus = requireElement('#brush-tip-custom-status', HTMLOutputElement);
  const customTipPreview = requireElement('#brush-tip-custom-preview', HTMLCanvasElement);
  const tipAssetSelect = requireElement('#brush-tip-asset-select', HTMLSelectElement);
  const tipAssetAdd = requireElement('#brush-tip-asset-add', HTMLButtonElement);
  const tipAssetDelete = requireElement('#brush-tip-asset-delete', HTMLButtonElement);
  const tipAssetFile = requireElement('#brush-tip-asset-file', HTMLInputElement);
  const tipAssetStatus = requireElement('#brush-tip-asset-status', HTMLOutputElement);
  let state = loadState(storage);
  let pressureCurveEditor: SharedCurveEditorV1 | null = null;
  let tiltCurveEditor: SharedCurveEditorV1 | null = null;
  let velocityCurveEditor: SharedCurveEditorV1 | null = null;
  let randomCurveEditor: SharedCurveEditorV1 | null = null;
  let idCounter = 0;

  const nextId = (): string => {
    idCounter += 1;
    const uuid = globalThis.crypto?.randomUUID?.();
    return uuid === undefined
      ? `user.brush.${Date.now().toString(36)}.${idCounter.toString(36)}`
      : `user.brush.${uuid}`;
  };

  const nextTipAssetId = (): string => {
    idCounter += 1;
    const uuid = globalThis.crypto?.randomUUID?.();
    return uuid === undefined
      ? 'user.tip.' + Date.now().toString(36) + '.' + idCounter.toString(36)
      : 'user.tip.' + uuid;
  };
  const persist = (): void => {
    storage?.setItem(STORAGE_KEY, serializeBrushPresetLibraryV1(state));
  };

  const applySelected = (): void => {
    const item = selectedBrushPresetItemV1(state);
    const parameters = brushParameterValuesV1(item.preset);
    input.paintSession.setBrushMode(modeForBehavior(item.preset.behavior));
    input.paintSession.setBrushParameters(parameters);
    input.paintSession.setBrushHardness(brushTipHardnessV1(item.preset));
    input.paintSession.setBrushTipDensity(brushTipDensityV1(item.preset));
    const spacing = brushStrokeSpacingV1(item.preset);
    input.paintSession.setBrushSpacing(spacing.spacingRatio, spacing.minimumStampDistancePx);
    input.paintSession.setBrushTipAngleDegrees(brushTipAngleDegreesV1(item.preset));
    input.paintSession.setBrushTipDirectionDegrees(brushTipDirectionDegreesV1(item.preset));
    const penOrientationEnabled = brushPenOrientationEnabledV1(item.preset);
    input.paintSession.setBrushPenOrientationEnabled(penOrientationEnabled);
    input.paintSession.setBrushFollowStrokeRotation(
      penOrientationEnabled ? false : brushFollowStrokeRotationV1(item.preset),
    );
    const startLengthPx = brushStrokeStartLengthPxV1(item.preset);
    input.paintSession.setBrushStartTaperLengthPx(startLengthPx);
    const endLengthPx = brushStrokeEndLengthPxV1(item.preset);
    input.paintSession.setBrushEndTaperLengthPx(endLengthPx);
    const sizeTaperMinimumRatio = brushSizeTaperMinimumRatioV1(item.preset);
    input.paintSession.setBrushSizeTaperMinimumRatio(sizeTaperMinimumRatio);
    const opacityTaperMinimumRatio = brushOpacityTaperMinimumRatioV1(item.preset);
    input.paintSession.setBrushOpacityTaperMinimumRatio(opacityTaperMinimumRatio);
    const forcedTaper = brushForcedTaperV1(item.preset);
    input.paintSession.setBrushForcedTaper(forcedTaper.start, forcedTaper.end);
    const stabilizationAmount = brushRealtimeStabilizationAmountV1(item.preset);
    input.paintSession.setBrushRealtimeStabilizationAmount(stabilizationAmount);
    const postCorrectionAmount = brushPostStrokeCorrectionAmountV1(item.preset);
    input.paintSession.setBrushPostStrokeCorrectionAmount(postCorrectionAmount);
    const grainResourceId = brushGrainResourceIdV1(item.preset);
    const paperResourceId = brushPaperTextureResourceIdV1(item.preset);
    if (paperResourceId !== null) {
      input.paintSession.setBrushPaperTextureResourceId(paperResourceId);
    } else {
      input.paintSession.setBrushGrainResourceId(grainResourceId);
    }
    const textureStrength = brushTextureStrengthV1(item.preset);
    input.paintSession.setBrushTextureStrength(textureStrength);
    const textureScale = brushTextureScaleV1(item.preset);
    input.paintSession.setBrushTextureScale(textureScale);
    const textureRotationDegrees = brushTextureRotationDegreesV1(item.preset);
    input.paintSession.setBrushTextureRotationDegrees(textureRotationDegrees);
    const textureBlend = brushTextureBlendModeV1(item.preset);
    input.paintSession.setBrushTextureBlendMode(textureBlend);
    const pressureSizeEnabled = brushPressureSizeEnabledV1(item.preset);
    input.paintSession.setBrushPressureSizeEnabled(pressureSizeEnabled);
    const pressureOpacityEnabled = brushPressureOpacityEnabledV1(item.preset);
    input.paintSession.setBrushPressureOpacityEnabled(pressureOpacityEnabled);
    const pressureFlowEnabled = brushPressureFlowEnabledV1(item.preset);
    input.paintSession.setBrushPressureFlowEnabled(pressureFlowEnabled);
    const pressureResponseCurve = resolveBrushPressureResponseCurveV1(
      item.preset,
      defaultPressureResponseCurve(),
    );
    input.paintSession.setBrushPressureResponseCurve(pressureResponseCurve);
    const tiltSizeEnabled = brushTiltSizeEnabledV1(item.preset);
    input.paintSession.setBrushTiltSizeEnabled(tiltSizeEnabled);
    const tiltOpacityEnabled = brushTiltOpacityEnabledV1(item.preset);
    input.paintSession.setBrushTiltOpacityEnabled(tiltOpacityEnabled);
    const tiltFlowEnabled = brushTiltFlowEnabledV1(item.preset);
    input.paintSession.setBrushTiltFlowEnabled(tiltFlowEnabled);
    const tiltResponseCurve = brushTiltResponseCurveV1(item.preset);
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
    const randomSizeEnabled = brushRandomSizeEnabledV1(item.preset);
    input.paintSession.setBrushRandomSizeEnabled(randomSizeEnabled);
    const randomOpacityEnabled = brushRandomOpacityEnabledV1(item.preset);
    input.paintSession.setBrushRandomOpacityEnabled(randomOpacityEnabled);
    const randomFlowEnabled = brushRandomFlowEnabledV1(item.preset);
    input.paintSession.setBrushRandomFlowEnabled(randomFlowEnabled);
    const randomResponseCurve = brushRandomResponseCurveV1(item.preset);
    input.paintSession.setBrushRandomResponseCurve(randomResponseCurve);
    const sizeMinimumResponse = brushSizeMinimumResponseV1(item.preset);
    const opacityMinimumResponse = brushOpacityMinimumResponseV1(item.preset);
    const flowMinimumResponse = brushFlowMinimumResponseV1(item.preset);
    const sizeMaximumResponse = brushSizeMaximumResponseV1(item.preset);
    const opacityMaximumResponse = brushOpacityMaximumResponseV1(item.preset);
    const flowMaximumResponse = brushFlowMaximumResponseV1(item.preset);
    input.paintSession.setBrushDynamicResponseBounds(
      { minimum: sizeMinimumResponse, maximum: sizeMaximumResponse },
      { minimum: opacityMinimumResponse, maximum: opacityMaximumResponse },
      { minimum: flowMinimumResponse, maximum: flowMaximumResponse },
    );
    const sizeJitter = brushSizeJitterV1(item.preset);
    input.paintSession.setBrushSizeJitter(sizeJitter);
    const opacityJitter = brushOpacityJitterV1(item.preset);
    input.paintSession.setBrushOpacityJitter(opacityJitter);
    const rotationJitter = brushRotationJitterV1(item.preset);
    input.paintSession.setBrushRotationJitter(rotationJitter);
    const positionJitter = brushPositionJitterV1(item.preset);
    input.paintSession.setBrushPositionJitter(positionJitter);
    const densityJitter = brushDensityJitterV1(item.preset);
    input.paintSession.setBrushDensityJitter(densityJitter);
    const hueJitter = brushHueJitterV1(item.preset);
    const saturationJitter = brushSaturationJitterV1(item.preset);
    const valueJitter = brushValueJitterV1(item.preset);
    input.paintSession.setBrushColorJitter(hueJitter, saturationJitter, valueJitter);
    const sprayEnabled = brushSprayEnabledV1(item.preset);
    input.paintSession.setBrushSprayEnabled(sprayEnabled);
    const sprayParticleSizeRatio = brushSprayParticleSizeRatioV1(item.preset);
    input.paintSession.setBrushSprayParticleSizeRatio(sprayParticleSizeRatio);
    const sprayParticleDensity = brushSprayParticleDensityV1(item.preset);
    input.paintSession.setBrushSprayParticleDensity(sprayParticleDensity);
    const spraySpreadRadiusRatio = brushSpraySpreadRadiusRatioV1(item.preset);
    const sprayDeviation = brushSprayDeviationV1(item.preset);
    input.paintSession.setBrushSpraySpread(spraySpreadRadiusRatio, sprayDeviation);
    const sprayAngleBasedOnCenter = brushSprayAngleBasedOnCenterV1(item.preset);
    input.paintSession.setBrushSprayAngleBasedOnCenter(sprayAngleBasedOnCenter);
    const subColorRatio = brushSubColorRatioV1(item.preset);
    input.paintSession.setBrushSubColorRatio(subColorRatio);
    input.paintSession.setBrushReferenceAntiOverflow(brushReferenceAntiOverflowV1(item.preset));
    const colorMixEnabled = brushColorMixEnabledV1(item.preset);
    const colorMixCanvasRatio = brushColorMixCanvasRatioV1(item.preset);
    const colorMixDepositAmount = brushColorMixDepositAmountV1(item.preset);
    const colorMixSampleRadiusRatio = brushColorMixSampleRadiusRatioV1(item.preset);
    const colorMixPickupAmount = brushColorMixPickupAmountV1(item.preset);
    const colorMixCarryAmount = brushColorMixCarryAmountV1(item.preset);
    input.paintSession.setBrushColorMix(
      colorMixEnabled,
      colorMixCanvasRatio,
      colorMixDepositAmount,
      colorMixSampleRadiusRatio,
      colorMixPickupAmount,
      colorMixCarryAmount,
    );
    const tipAssets = brushTipAssetsV1(item.preset);
    const selectedTipAssetId = brushSelectedTipAssetIdV1(item.preset);
    const tipSelectionStartIndex = Math.max(
      0,
      tipAssets.findIndex((asset) => asset.id === selectedTipAssetId),
    );
    input.paintSession.setBrushTipSelection(
      brushTipSelectionModeV1(item.preset),
      tipAssets.map((asset) => asset.alpha),
      tipSelectionStartIndex,
    );
    input.paintSession.setBrushTipShape(
      brushTipShapeV1(item.preset),
      brushSampledTipAlphaV1(item.preset) ?? undefined,
    );
    input.root.dataset.illustroBrushPreset = item.preset.id;
    input.root.dataset.illustroBrushPresetSource = item.source;
    input.root.dataset.illustroBrushPresetModified = String(item.modified);
    input.root.dataset.illustroBrushPresetLocked = String(item.locked);
    input.root.dataset.illustroBrushSize = String(parameters.sizePx);
    input.root.dataset.illustroBrushOpacity = String(parameters.opacity);
    input.root.dataset.illustroBrushFlow = String(parameters.flow);
    input.root.dataset.illustroBrushHardness = String(brushTipHardnessV1(item.preset));
    input.root.dataset.illustroBrushTipDensity = String(brushTipDensityV1(item.preset));
    input.root.dataset.illustroBrushSpacingRatio = String(spacing.spacingRatio);
    input.root.dataset.illustroBrushTipAngleDegrees = String(brushTipAngleDegreesV1(item.preset));
    input.root.dataset.illustroBrushTipDirectionDegrees = String(
      brushTipDirectionDegreesV1(item.preset),
    );
    input.root.dataset.illustroBrushFollowRotation = String(
      penOrientationEnabled ? false : brushFollowStrokeRotationV1(item.preset),
    );
    input.root.dataset.illustroBrushPenOrientation = String(penOrientationEnabled);
    input.root.dataset.illustroBrushTipSelectionMode = brushTipSelectionModeV1(item.preset);
    input.root.dataset.illustroBrushStartLengthPx = String(startLengthPx);
    input.root.dataset.illustroBrushEndLengthPx = String(endLengthPx);
    input.root.dataset.illustroBrushSizeTaperMinimumRatio = String(sizeTaperMinimumRatio);
    input.root.dataset.illustroBrushOpacityTaperMinimumRatio = String(opacityTaperMinimumRatio);
    input.root.dataset.illustroBrushForceStartTaper = String(forcedTaper.start);
    input.root.dataset.illustroBrushForceEndTaper = String(forcedTaper.end);
    input.root.dataset.illustroBrushStabilizationAmount = String(stabilizationAmount);
    input.root.dataset.illustroBrushPostCorrectionAmount = String(postCorrectionAmount);
    input.root.dataset.illustroBrushGrainResource = grainResourceId ?? '';
    input.root.dataset.illustroBrushPaperResource = paperResourceId ?? '';
    input.root.dataset.illustroBrushTextureStrength = String(textureStrength);
    input.root.dataset.illustroBrushTextureScale = String(textureScale);
    input.root.dataset.illustroBrushTextureRotationDegrees = String(textureRotationDegrees);
    input.root.dataset.illustroBrushTextureBlendMode = textureBlend;
    input.root.dataset.illustroBrushPressureSize = String(pressureSizeEnabled);
    input.root.dataset.illustroBrushPressureOpacity = String(pressureOpacityEnabled);
    input.root.dataset.illustroBrushPressureFlow = String(pressureFlowEnabled);
    input.root.dataset.illustroBrushPressureCurvePoints = String(pressureResponseCurve.length);
    input.root.dataset.illustroBrushPressureCurveSource =
      brushPressureResponseCurveOverrideV1(item.preset) === null ? 'global' : 'preset';
    input.root.dataset.illustroBrushTiltSize = String(tiltSizeEnabled);
    input.root.dataset.illustroBrushTiltOpacity = String(tiltOpacityEnabled);
    input.root.dataset.illustroBrushTiltFlow = String(tiltFlowEnabled);
    input.root.dataset.illustroBrushTiltCurvePoints = String(tiltResponseCurve.length);
    input.root.dataset.illustroBrushVelocitySize = String(velocitySizeEnabled);
    input.root.dataset.illustroBrushVelocityOpacity = String(velocityOpacityEnabled);
    input.root.dataset.illustroBrushVelocityFlow = String(velocityFlowEnabled);
    input.root.dataset.illustroBrushVelocityCurvePoints = String(velocityResponseCurve.length);
    input.root.dataset.illustroBrushVelocityMaximumPxPerSecond = String(velocityMaximum);
    input.root.dataset.illustroBrushRandomSize = String(randomSizeEnabled);
    input.root.dataset.illustroBrushRandomOpacity = String(randomOpacityEnabled);
    input.root.dataset.illustroBrushRandomFlow = String(randomFlowEnabled);
    input.root.dataset.illustroBrushRandomCurvePoints = String(randomResponseCurve.length);
    input.root.dataset.illustroBrushSizeMinimumResponse = String(sizeMinimumResponse);
    input.root.dataset.illustroBrushOpacityMinimumResponse = String(opacityMinimumResponse);
    input.root.dataset.illustroBrushFlowMinimumResponse = String(flowMinimumResponse);
    input.root.dataset.illustroBrushSizeMaximumResponse = String(sizeMaximumResponse);
    input.root.dataset.illustroBrushOpacityMaximumResponse = String(opacityMaximumResponse);
    input.root.dataset.illustroBrushFlowMaximumResponse = String(flowMaximumResponse);
    input.root.dataset.illustroBrushSizeJitter = String(sizeJitter);
    input.root.dataset.illustroBrushOpacityJitter = String(opacityJitter);
    input.root.dataset.illustroBrushRotationJitter = String(rotationJitter);
    input.root.dataset.illustroBrushPositionJitter = String(positionJitter);
    input.root.dataset.illustroBrushDensityJitter = String(densityJitter);
    input.root.dataset.illustroBrushHueJitter = String(hueJitter);
    input.root.dataset.illustroBrushSaturationJitter = String(saturationJitter);
    input.root.dataset.illustroBrushValueJitter = String(valueJitter);
    input.root.dataset.illustroBrushSprayEnabled = String(sprayEnabled);
    input.root.dataset.illustroBrushSprayParticleSizeRatio = String(sprayParticleSizeRatio);
    input.root.dataset.illustroBrushSprayParticleDensity = String(sprayParticleDensity);
    input.root.dataset.illustroBrushSpraySpreadRadiusRatio = String(spraySpreadRadiusRatio);
    input.root.dataset.illustroBrushSprayDeviation = String(sprayDeviation);
    input.root.dataset.illustroBrushSprayAngleBasedOnCenter = String(sprayAngleBasedOnCenter);
    input.root.dataset.illustroBrushSubColorRatio = String(subColorRatio);
    input.root.dataset.illustroBrushColorMixEnabled = String(colorMixEnabled);
    input.root.dataset.illustroBrushColorMixCanvasRatio = String(colorMixCanvasRatio);
    input.root.dataset.illustroBrushColorMixDepositAmount = String(colorMixDepositAmount);
    input.root.dataset.illustroBrushTipShape = brushTipShapeV1(item.preset);
    input.onBrushModeChanged?.();
  };

  const render = (): void => {
    const selected = selectedBrushPresetItemV1(state);
    const categories = brushPresetCategoriesV1(state);
    const previousCategory = state.category;
    category.replaceChildren();
    const all = document.createElement('option');
    all.value = '';
    all.textContent = 'すべて';
    category.append(all);
    for (const value of categories) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = value;
      category.append(option);
    }
    category.value = previousCategory ?? '';
    search.value = state.query;
    name.value = selected.preset.name;
    list.replaceChildren();
    const visible = filteredBrushPresetItemsV1(state);
    for (const item of visible) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'shell-brush-preset-row';
      button.dataset.presetId = item.preset.id;
      button.setAttribute('aria-pressed', String(item.preset.id === state.selectedPresetId));
      if (item.preset.id === state.selectedPresetId) button.classList.add('is-selected');
      const title = document.createElement('span');
      title.className = 'shell-brush-preset-name';
      title.textContent = item.preset.name;
      const meta = document.createElement('span');
      meta.className = 'shell-brush-preset-meta';
      meta.textContent = `${item.preset.category} · ${item.source === 'factory' ? '標準' : 'ユーザー'}${item.modified ? ' · Modified' : ''}${item.locked ? ' · Locked' : ''}`;
      button.append(title, meta);
      button.addEventListener('click', () => {
        state = selectBrushPresetV1(state, item.preset.id);
        persist();
        applySelected();
        render();
      });
      list.append(button);
    }
    if (visible.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'shell-brush-preset-empty';
      empty.textContent = '一致するブラシがありません';
      list.append(empty);
    }
    const limits = brushParameterLimitsV1(selected.preset);
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
    configurePair(
      sizeRange,
      sizeNumber,
      limits.sizePx.min,
      limits.sizePx.max,
      0.5,
      parameters.sizePx,
    );
    configurePair(
      opacityRange,
      opacityNumber,
      limits.opacity.min,
      limits.opacity.max,
      0.01,
      parameters.opacity,
    );
    configurePair(flowRange, flowNumber, limits.flow.min, limits.flow.max, 0.01, parameters.flow);
    const hardness = brushTipHardnessV1(selected.preset);
    configurePair(hardnessRange, hardnessNumber, 0, 1, 0.01, hardness);
    const tipDensity = brushTipDensityV1(selected.preset);
    configurePair(tipDensityRange, tipDensityNumber, 0, 1, 0.01, tipDensity);
    const spacing = brushStrokeSpacingV1(selected.preset);
    configurePair(spacingRange, spacingNumber, 1, 400, 1, spacing.spacingRatio * 100);
    const tipAngleDegrees = brushTipAngleDegreesV1(selected.preset);
    configurePair(tipAngleRange, tipAngleNumber, 0, 359, 1, tipAngleDegrees);
    const tipDirectionDegrees = brushTipDirectionDegreesV1(selected.preset);
    configurePair(tipDirectionRange, tipDirectionNumber, 0, 359, 1, tipDirectionDegrees);
    const penOrientationEnabled = brushPenOrientationEnabledV1(selected.preset);
    const followRotation = !penOrientationEnabled && brushFollowStrokeRotationV1(selected.preset);
    followRotationButton.textContent = followRotation ? 'ON' : 'OFF';
    followRotationButton.setAttribute('aria-pressed', String(followRotation));
    penOrientationButton.textContent = penOrientationEnabled ? 'ON' : 'OFF';
    penOrientationButton.setAttribute('aria-pressed', String(penOrientationEnabled));
    const tipSelectionMode = brushTipSelectionModeV1(selected.preset);
    tipRepeatMode.value = tipSelectionMode;
    const startLengthPx = brushStrokeStartLengthPxV1(selected.preset);
    configurePair(startLengthRange, startLengthNumber, 0, 4096, 1, startLengthPx);
    const endLengthPx = brushStrokeEndLengthPxV1(selected.preset);
    configurePair(endLengthRange, endLengthNumber, 0, 4096, 1, endLengthPx);
    const sizeTaperMinimumRatio = brushSizeTaperMinimumRatioV1(selected.preset);
    configurePair(sizeTaperRange, sizeTaperNumber, 0, 100, 1, sizeTaperMinimumRatio * 100);
    const opacityTaperMinimumRatio = brushOpacityTaperMinimumRatioV1(selected.preset);
    configurePair(opacityTaperRange, opacityTaperNumber, 0, 100, 1, opacityTaperMinimumRatio * 100);
    const forcedTaper = brushForcedTaperV1(selected.preset);
    forceStartTaperButton.textContent = forcedTaper.start ? 'ON' : 'OFF';
    forceStartTaperButton.setAttribute('aria-pressed', String(forcedTaper.start));
    forceEndTaperButton.textContent = forcedTaper.end ? 'ON' : 'OFF';
    forceEndTaperButton.setAttribute('aria-pressed', String(forcedTaper.end));
    const stabilizationAmount = brushRealtimeStabilizationAmountV1(selected.preset);
    configurePair(stabilizationRange, stabilizationNumber, 0, 100, 1, stabilizationAmount * 100);
    const postCorrectionAmount = brushPostStrokeCorrectionAmountV1(selected.preset);
    configurePair(postCorrectionRange, postCorrectionNumber, 0, 100, 1, postCorrectionAmount * 100);
    const grainResourceId = brushGrainResourceIdV1(selected.preset);
    grainResource.replaceChildren();
    const noGrain = document.createElement('option');
    noGrain.value = '';
    noGrain.textContent = 'なし';
    grainResource.append(noGrain);
    for (const resource of BUILTIN_BRUSH_GRAIN_RESOURCES_V1) {
      const option = document.createElement('option');
      option.value = resource.id;
      option.textContent = `${resource.family} · ${resource.name}`;
      grainResource.append(option);
    }
    if (
      grainResourceId !== null &&
      !BUILTIN_BRUSH_GRAIN_RESOURCES_V1.some((resource) => resource.id === grainResourceId)
    ) {
      const imported = document.createElement('option');
      imported.value = grainResourceId;
      imported.textContent = `Imported · ${grainResourceId}`;
      grainResource.append(imported);
    }
    grainResource.value = grainResourceId ?? '';
    const paperResourceId = brushPaperTextureResourceIdV1(selected.preset);
    paperResource.replaceChildren();
    const noPaper = document.createElement('option');
    noPaper.value = '';
    noPaper.textContent = 'なし';
    paperResource.append(noPaper);
    for (const resource of BUILTIN_BRUSH_PAPER_RESOURCES_V1) {
      const option = document.createElement('option');
      option.value = resource.id;
      option.textContent = resource.name;
      paperResource.append(option);
    }
    if (
      paperResourceId !== null &&
      !BUILTIN_BRUSH_PAPER_RESOURCES_V1.some((resource) => resource.id === paperResourceId)
    ) {
      const imported = document.createElement('option');
      imported.value = paperResourceId;
      imported.textContent = `Imported · ${paperResourceId}`;
      paperResource.append(imported);
    }
    paperResource.value = paperResourceId ?? '';
    const textureStrength = brushTextureStrengthV1(selected.preset);
    configurePair(textureStrengthRange, textureStrengthNumber, 0, 100, 1, textureStrength * 100);
    const textureScale = brushTextureScaleV1(selected.preset);
    configurePair(textureScaleRange, textureScaleNumber, 1, 1600, 1, textureScale * 100);
    const textureRotationDegrees = brushTextureRotationDegreesV1(selected.preset);
    configurePair(textureRotationRange, textureRotationNumber, 0, 359, 1, textureRotationDegrees);
    const textureBlend = brushTextureBlendModeV1(selected.preset);
    textureBlendMode.value = textureBlend;
    const pressureSizeEnabled = brushPressureSizeEnabledV1(selected.preset);
    pressureSizeButton.textContent = pressureSizeEnabled ? 'ON' : 'OFF';
    pressureSizeButton.setAttribute('aria-pressed', String(pressureSizeEnabled));
    const pressureOpacityEnabled = brushPressureOpacityEnabledV1(selected.preset);
    pressureOpacityButton.textContent = pressureOpacityEnabled ? 'ON' : 'OFF';
    pressureOpacityButton.setAttribute('aria-pressed', String(pressureOpacityEnabled));
    const pressureFlowEnabled = brushPressureFlowEnabledV1(selected.preset);
    pressureFlowButton.textContent = pressureFlowEnabled ? 'ON' : 'OFF';
    pressureFlowButton.setAttribute('aria-pressed', String(pressureFlowEnabled));
    const pressureResponseCurveOverride = brushPressureResponseCurveOverrideV1(selected.preset);
    const pressureResponseCurve = resolveBrushPressureResponseCurveV1(
      selected.preset,
      defaultPressureResponseCurve(),
    );
    pressureCurveEditor?.setCurve(pressureResponseCurve);
    pressureCurveOverrideButton.textContent =
      pressureResponseCurveOverride === null ? 'このブラシで上書き' : '既定に戻す';
    pressureCurveOverrideButton.setAttribute(
      'aria-pressed',
      String(pressureResponseCurveOverride !== null),
    );
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
    const sizeMinimumResponse = brushSizeMinimumResponseV1(selected.preset);
    configurePair(
      sizeMinimumResponseRange,
      sizeMinimumResponseNumber,
      0,
      100,
      1,
      sizeMinimumResponse * 100,
    );
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
    configurePair(
      flowMinimumResponseRange,
      flowMinimumResponseNumber,
      0,
      100,
      1,
      flowMinimumResponse * 100,
    );
    const sizeMaximumResponse = brushSizeMaximumResponseV1(selected.preset);
    configurePair(
      sizeMaximumResponseRange,
      sizeMaximumResponseNumber,
      0,
      100,
      1,
      sizeMaximumResponse * 100,
    );
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
    configurePair(
      flowMaximumResponseRange,
      flowMaximumResponseNumber,
      0,
      100,
      1,
      flowMaximumResponse * 100,
    );
    flowMaximumResponseRange.min = String(flowMinimumResponse * 100);
    flowMaximumResponseNumber.min = String(flowMinimumResponse * 100);
    flowMinimumResponseRange.max = String(flowMaximumResponse * 100);
    flowMinimumResponseNumber.max = String(flowMaximumResponse * 100);
    const sizeJitter = brushSizeJitterV1(selected.preset);
    configurePair(sizeJitterRange, sizeJitterNumber, 0, 100, 1, sizeJitter * 100);
    const opacityJitter = brushOpacityJitterV1(selected.preset);
    configurePair(opacityJitterRange, opacityJitterNumber, 0, 100, 1, opacityJitter * 100);
    const rotationJitter = brushRotationJitterV1(selected.preset);
    configurePair(rotationJitterRange, rotationJitterNumber, 0, 100, 1, rotationJitter * 100);
    const positionJitter = brushPositionJitterV1(selected.preset);
    configurePair(positionJitterRange, positionJitterNumber, 0, 100, 1, positionJitter * 100);
    const densityJitter = brushDensityJitterV1(selected.preset);
    configurePair(densityJitterRange, densityJitterNumber, 0, 100, 1, densityJitter * 100);
    const hueJitter = brushHueJitterV1(selected.preset);
    const saturationJitter = brushSaturationJitterV1(selected.preset);
    const valueJitter = brushValueJitterV1(selected.preset);
    configurePair(hueJitterRange, hueJitterNumber, 0, 100, 1, hueJitter * 100);
    configurePair(saturationJitterRange, saturationJitterNumber, 0, 100, 1, saturationJitter * 100);
    configurePair(valueJitterRange, valueJitterNumber, 0, 100, 1, valueJitter * 100);
    const sprayEnabled = brushSprayEnabledV1(selected.preset);
    sprayEnabledButton.textContent = sprayEnabled ? 'ON' : 'OFF';
    sprayEnabledButton.setAttribute('aria-pressed', String(sprayEnabled));
    const sprayParticleSizeRatio = brushSprayParticleSizeRatioV1(selected.preset);
    configurePair(
      sprayParticleSizeRange,
      sprayParticleSizeNumber,
      1,
      400,
      1,
      sprayParticleSizeRatio * 100,
    );
    const sprayParticleDensity = brushSprayParticleDensityV1(selected.preset);
    configurePair(
      sprayParticleDensityRange,
      sprayParticleDensityNumber,
      1,
      32,
      1,
      sprayParticleDensity,
    );
    const spraySpreadRadiusRatio = brushSpraySpreadRadiusRatioV1(selected.preset);
    const sprayDeviation = brushSprayDeviationV1(selected.preset);
    configurePair(
      spraySpreadRadiusRange,
      spraySpreadRadiusNumber,
      0,
      400,
      1,
      spraySpreadRadiusRatio * 100,
    );
    configurePair(sprayDeviationRange, sprayDeviationNumber, -100, 100, 1, sprayDeviation * 100);
    const sprayAngleBasedOnCenter = brushSprayAngleBasedOnCenterV1(selected.preset);
    sprayAngleBasedOnCenterButton.textContent = sprayAngleBasedOnCenter ? 'ON' : 'OFF';
    sprayAngleBasedOnCenterButton.setAttribute('aria-pressed', String(sprayAngleBasedOnCenter));
    const subColorRatio = brushSubColorRatioV1(selected.preset);
    configurePair(subColorRatioRange, subColorRatioNumber, 0, 100, 1, subColorRatio * 100);
    const referenceAntiOverflow = brushReferenceAntiOverflowV1(selected.preset);
    referenceAntiOverflowButton.textContent = referenceAntiOverflow ? 'ON' : 'OFF';
    referenceAntiOverflowButton.setAttribute('aria-pressed', String(referenceAntiOverflow));
    const colorMixEnabled = brushColorMixEnabledV1(selected.preset);
    colorMixEnabledButton.textContent = colorMixEnabled ? 'ON' : 'OFF';
    colorMixEnabledButton.setAttribute('aria-pressed', String(colorMixEnabled));
    const colorMixCanvasRatio = brushColorMixCanvasRatioV1(selected.preset);
    const colorMixDepositAmount = brushColorMixDepositAmountV1(selected.preset);
    configurePair(
      colorMixCanvasRatioRange,
      colorMixCanvasRatioNumber,
      0,
      100,
      1,
      colorMixCanvasRatio * 100,
    );
    configurePair(
      colorMixDepositRange,
      colorMixDepositNumber,
      0,
      100,
      1,
      colorMixDepositAmount * 100,
    );
    const colorMixSampleRadiusRatio = brushColorMixSampleRadiusRatioV1(selected.preset);
    const colorMixPickupAmount = brushColorMixPickupAmountV1(selected.preset);
    const colorMixCarryAmount = brushColorMixCarryAmountV1(selected.preset);
    configurePair(
      colorMixSampleRadiusRange,
      colorMixSampleRadiusNumber,
      0,
      300,
      1,
      colorMixSampleRadiusRatio * 100,
    );
    configurePair(colorMixPickupRange, colorMixPickupNumber, 0, 100, 1, colorMixPickupAmount * 100);
    configurePair(colorMixCarryRange, colorMixCarryNumber, 0, 100, 1, colorMixCarryAmount * 100);
    tipShape.value = brushTipShapeV1(selected.preset);
    const customTipAlpha = brushSampledTipAlphaV1(selected.preset);
    const tipAssets = brushTipAssetsV1(selected.preset);
    const selectedTipAssetId = brushSelectedTipAssetIdV1(selected.preset);
    customTipStatus.textContent =
      customTipAlpha === null
        ? tipAssets.length > 0
          ? '保存済み ' + tipAssets.length + ' assets'
          : '標準サンプル'
        : tipAssets.length > 0
          ? 'カスタム 5×5 · ' + tipAssets.length + ' assets'
          : 'カスタム 5×5';
    customTipPreview.hidden = customTipAlpha === null;
    drawCustomBrushTipPreviewV1(customTipPreview, customTipAlpha);
    tipAssetSelect.replaceChildren();
    if (tipAssets.length === 0) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = '未登録';
      tipAssetSelect.append(option);
    } else {
      for (const asset of tipAssets) {
        const option = document.createElement('option');
        option.value = asset.id;
        option.textContent = asset.name;
        tipAssetSelect.append(option);
      }
      tipAssetSelect.value = selectedTipAssetId ?? tipAssets[0]?.id ?? '';
    }
    tipAssetStatus.textContent = tipAssets.length + '/' + BRUSH_TIP_ASSET_LIMIT_V1;
    const repeatLabel =
      tipSelectionMode === 'sequence'
        ? ' · Repeat'
        : tipSelectionMode === 'random-per-stamp'
          ? ' · Random'
          : '';
    const startLabel = startLengthPx > 0 ? ` · In${Math.round(startLengthPx)}px` : '';
    const endLabel = endLengthPx > 0 ? ` · Out${Math.round(endLengthPx)}px` : '';
    const sizeTaperLabel =
      sizeTaperMinimumRatio > 0 ? ` · SizeMin${Math.round(sizeTaperMinimumRatio * 100)}%` : '';
    const opacityTaperLabel =
      opacityTaperMinimumRatio > 0
        ? ` · OpacityMin${Math.round(opacityTaperMinimumRatio * 100)}%`
        : '';
    const forcedTaperLabel = `${forcedTaper.start ? ' · ForceIn' : ''}${forcedTaper.end ? ' · ForceOut' : ''}`;
    const stabilizationLabel =
      stabilizationAmount > 0 ? ` · Stab${Math.round(stabilizationAmount * 100)}%` : '';
    const postCorrectionLabel =
      postCorrectionAmount > 0 ? ` · Post${Math.round(postCorrectionAmount * 100)}%` : '';
    const grainLabel =
      grainResourceId === null
        ? ''
        : ` · Grain:${grainResourceId.split('.').at(-2) ?? 'custom'}-${grainResourceId.split('.').at(-1) ?? ''}`;
    const paperLabel =
      paperResourceId === null ? '' : ` · Paper:${paperResourceId.split('.').at(-1) ?? 'custom'}`;
    const textureStrengthLabel =
      textureStrength > 0 ? ` · Tex${Math.round(textureStrength * 100)}%` : '';
    const textureScaleLabel =
      textureScale !== 1 ? ` · TexScale${Math.round(textureScale * 100)}%` : '';
    const textureRotationLabel =
      textureRotationDegrees !== 0 ? ` · TexRot${Math.round(textureRotationDegrees)}°` : '';
    const textureBlendLabel = textureBlend === 'multiply' ? '' : ` · TexBlend:${textureBlend}`;
    const pressureSizeLabel = pressureSizeEnabled ? ' · P→Size' : '';
    const pressureOpacityLabel = pressureOpacityEnabled ? ' · P→Opacity' : '';
    const pressureFlowLabel = pressureFlowEnabled ? ' · P→Flow' : '';
    const pressureCurveLabel = responseCurveIsLinearV1(pressureResponseCurve) ? '' : ' · P-Curve';
    const tiltSizeLabel = tiltSizeEnabled ? ' · T→Size' : '';
    const tiltOpacityLabel = tiltOpacityEnabled ? ' · T→Opacity' : '';
    const tiltFlowLabel = tiltFlowEnabled ? ' · T→Flow' : '';
    const tiltCurveLabel = responseCurveIsLinearV1(tiltResponseCurve) ? '' : ' · T-Curve';
    const velocitySizeLabel = velocitySizeEnabled ? ' · V→Size' : '';
    const velocityOpacityLabel = velocityOpacityEnabled ? ' · V→Opacity' : '';
    const velocityFlowLabel = velocityFlowEnabled ? ' · V→Flow' : '';
    const velocityCurveLabel = responseCurveIsLinearV1(velocityResponseCurve) ? '' : ' · V-Curve';
    const velocityMaximumLabel =
      velocitySizeEnabled || velocityOpacityEnabled || velocityFlowEnabled
        ? ` · Vmax${Math.round(velocityMaximum)}px/s`
        : '';
    const randomSizeLabel = randomSizeEnabled ? ' · R→Size' : '';
    const randomOpacityLabel = randomOpacityEnabled ? ' · R→Opacity' : '';
    const randomFlowLabel = randomFlowEnabled ? ' · R→Flow' : '';
    const randomCurveLabel = responseCurveIsLinearV1(randomResponseCurve) ? '' : ' · R-Curve';
    const minimumResponseLabel = `${
      sizeMinimumResponse > 0 ? ` · DynSizeMin${Math.round(sizeMinimumResponse * 100)}%` : ''
    }${
      opacityMinimumResponse > 0
        ? ` · DynOpacityMin${Math.round(opacityMinimumResponse * 100)}%`
        : ''
    }${flowMinimumResponse > 0 ? ` · DynFlowMin${Math.round(flowMinimumResponse * 100)}%` : ''}`;
    const maximumResponseLabel = `${
      sizeMaximumResponse < 1 ? ` · DynSizeMax${Math.round(sizeMaximumResponse * 100)}%` : ''
    }${
      opacityMaximumResponse < 1
        ? ` · DynOpacityMax${Math.round(opacityMaximumResponse * 100)}%`
        : ''
    }${flowMaximumResponse < 1 ? ` · DynFlowMax${Math.round(flowMaximumResponse * 100)}%` : ''}`;
    const sizeJitterLabel = sizeJitter > 0 ? ` · SizeJitter${Math.round(sizeJitter * 100)}%` : '';
    const opacityJitterLabel =
      opacityJitter > 0 ? ` · OpacityJitter${Math.round(opacityJitter * 100)}%` : '';
    const rotationJitterLabel =
      rotationJitter > 0 ? ` · RotationJitter${Math.round(rotationJitter * 100)}%` : '';
    const positionJitterLabel =
      positionJitter > 0 ? ` · PositionJitter${Math.round(positionJitter * 100)}%` : '';
    const densityJitterLabel =
      densityJitter > 0 ? ` · DensityJitter${Math.round(densityJitter * 100)}%` : '';
    const colorJitterLabel = `${hueJitter > 0 ? ` · HueJitter${Math.round(hueJitter * 100)}%` : ''}${saturationJitter > 0 ? ` · SatJitter${Math.round(saturationJitter * 100)}%` : ''}${valueJitter > 0 ? ` · ValueJitter${Math.round(valueJitter * 100)}%` : ''}`;
    const sprayLabel = sprayEnabled ? ' · Spray' : '';
    const sprayParticleSizeLabel = sprayEnabled
      ? ` · Particle${Math.round(sprayParticleSizeRatio * 100)}%`
      : '';
    const sprayParticleDensityLabel = sprayEnabled ? ` · Density${sprayParticleDensity}` : '';
    const spraySpreadLabel = sprayEnabled
      ? ` · Spread${Math.round(spraySpreadRadiusRatio * 100)}%${sprayDeviation === 0 ? '' : `/Dev${Math.round(sprayDeviation * 100)}%`}`
      : '';
    const sprayOrientationLabel = sprayEnabled && sprayAngleBasedOnCenter ? ' · CenterAngle' : '';
    const colorMixLabel = colorMixEnabled
      ? ` · Mix${Math.round(colorMixCanvasRatio * 100)}%/Deposit${Math.round(colorMixDepositAmount * 100)}%`
      : '';
    propertyStatus.textContent = `${parameters.sizePx.toFixed(1)} px · ${Math.round(parameters.opacity * 100)}% · ${Math.round(parameters.flow * 100)}% · H${Math.round(hardness * 100)}% · D${Math.round(tipDensity * 100)}% · S${Math.round(spacing.spacingRatio * 100)}% · A${Math.round(tipAngleDegrees)}° · F${Math.round(tipDirectionDegrees)}°${followRotation ? ' · Follow' : ''}${penOrientationEnabled ? ' · PenDir' : ''}${repeatLabel}${startLabel}${endLabel}${sizeTaperLabel}${opacityTaperLabel}${forcedTaperLabel}${stabilizationLabel}${postCorrectionLabel}${grainLabel}${paperLabel}${textureStrengthLabel}${textureScaleLabel}${textureRotationLabel}${textureBlendLabel}${pressureSizeLabel}${pressureOpacityLabel}${pressureFlowLabel}${pressureCurveLabel}${tiltSizeLabel}${tiltOpacityLabel}${tiltFlowLabel}${tiltCurveLabel}${velocitySizeLabel}${velocityOpacityLabel}${velocityFlowLabel}${velocityCurveLabel}${velocityMaximumLabel}${randomSizeLabel}${randomOpacityLabel}${randomFlowLabel}${randomCurveLabel}${minimumResponseLabel}${maximumResponseLabel}${sizeJitterLabel}${opacityJitterLabel}${rotationJitterLabel}${positionJitterLabel}${densityJitterLabel}${colorJitterLabel}${sprayLabel}${sprayParticleSizeLabel}${sprayParticleDensityLabel}${spraySpreadLabel}${sprayOrientationLabel}${colorMixLabel}`;

    const locked = selected.locked;
    for (const control of [
      sizeRange,
      sizeNumber,
      opacityRange,
      opacityNumber,
      flowRange,
      flowNumber,
      hardnessRange,
      hardnessNumber,
      tipDensityRange,
      tipDensityNumber,
      spacingRange,
      spacingNumber,
      tipAngleRange,
      tipAngleNumber,
      tipDirectionRange,
      tipDirectionNumber,
      followRotationButton,
      penOrientationButton,
      tipRepeatMode,
      startLengthRange,
      startLengthNumber,
      endLengthRange,
      endLengthNumber,
      sizeTaperRange,
      sizeTaperNumber,
      opacityTaperRange,
      opacityTaperNumber,
      forceStartTaperButton,
      forceEndTaperButton,
      stabilizationRange,
      stabilizationNumber,
      postCorrectionRange,
      postCorrectionNumber,
      grainResource,
      paperResource,
      textureStrengthRange,
      textureStrengthNumber,
      textureScaleRange,
      textureScaleNumber,
      textureRotationRange,
      textureRotationNumber,
      textureBlendMode,
      pressureSizeButton,
      pressureOpacityButton,
      pressureFlowButton,
      pressureCurveOverrideButton,
      tiltSizeButton,
      tiltOpacityButton,
      tiltFlowButton,
      velocitySizeButton,
      velocityOpacityButton,
      velocityFlowButton,
      velocityMaximumRange,
      velocityMaximumNumber,
      randomSizeButton,
      randomOpacityButton,
      randomFlowButton,
      sizeMinimumResponseRange,
      sizeMinimumResponseNumber,
      opacityMinimumResponseRange,
      opacityMinimumResponseNumber,
      flowMinimumResponseRange,
      flowMinimumResponseNumber,
      sizeMaximumResponseRange,
      sizeMaximumResponseNumber,
      opacityMaximumResponseRange,
      opacityMaximumResponseNumber,
      flowMaximumResponseRange,
      flowMaximumResponseNumber,
      sizeJitterRange,
      sizeJitterNumber,
      opacityJitterRange,
      opacityJitterNumber,
      rotationJitterRange,
      rotationJitterNumber,
      positionJitterRange,
      positionJitterNumber,
      densityJitterRange,
      densityJitterNumber,
      hueJitterRange,
      hueJitterNumber,
      saturationJitterRange,
      saturationJitterNumber,
      valueJitterRange,
      valueJitterNumber,
      sprayEnabledButton,
      sprayParticleSizeRange,
      sprayParticleSizeNumber,
      sprayParticleDensityRange,
      sprayParticleDensityNumber,
      spraySpreadRadiusRange,
      spraySpreadRadiusNumber,
      sprayDeviationRange,
      sprayDeviationNumber,
      sprayAngleBasedOnCenterButton,
      subColorRatioRange,
      subColorRatioNumber,
      colorMixEnabledButton,
      colorMixCanvasRatioRange,
      colorMixCanvasRatioNumber,
      colorMixDepositRange,
      colorMixDepositNumber,
      tipShape,
      customTipCreate,
      customTipFile,
    ]) {
      control.disabled = locked;
    }
    sprayParticleSizeRange.disabled = locked || !sprayEnabled;
    sprayParticleSizeNumber.disabled = locked || !sprayEnabled;
    sprayParticleDensityRange.disabled = locked || !sprayEnabled;
    sprayParticleDensityNumber.disabled = locked || !sprayEnabled;
    spraySpreadRadiusRange.disabled = locked || !sprayEnabled;
    spraySpreadRadiusNumber.disabled = locked || !sprayEnabled;
    sprayDeviationRange.disabled = locked || !sprayEnabled;
    sprayDeviationNumber.disabled = locked || !sprayEnabled;
    sprayAngleBasedOnCenterButton.disabled = locked || !sprayEnabled;
    subColorRatioRange.disabled = locked || selected.preset.behavior !== 'paint';
    subColorRatioNumber.disabled = locked || selected.preset.behavior !== 'paint';
    referenceAntiOverflowButton.disabled = locked || selected.preset.behavior !== 'paint';
    colorMixCanvasRatioRange.disabled = locked || !colorMixEnabled;
    colorMixCanvasRatioNumber.disabled = locked || !colorMixEnabled;
    colorMixDepositRange.disabled = locked || !colorMixEnabled;
    colorMixDepositNumber.disabled = locked || !colorMixEnabled;
    colorMixSampleRadiusRange.disabled = locked || !colorMixEnabled;
    colorMixSampleRadiusNumber.disabled = locked || !colorMixEnabled;
    colorMixPickupRange.disabled = locked || !colorMixEnabled;
    colorMixPickupNumber.disabled = locked || !colorMixEnabled;
    colorMixCarryRange.disabled = locked || !colorMixEnabled;
    colorMixCarryNumber.disabled = locked || !colorMixEnabled;
    pressureCurveEditor?.setDisabled(locked || pressureResponseCurveOverride === null);
    tiltCurveEditor?.setDisabled(locked);
    velocityCurveEditor?.setDisabled(locked);
    randomCurveEditor?.setDisabled(locked);
    tipAssetSelect.disabled = locked || tipAssets.length === 0;
    tipAssetAdd.disabled = locked || tipAssets.length >= BRUSH_TIP_ASSET_LIMIT_V1;
    tipAssetDelete.disabled = locked || tipAssets.length <= 1;
    tipAssetFile.disabled = locked;
    duplicateButton.disabled = false;
    renameButton.disabled = locked;
    deleteButton.disabled = locked || selected.source === 'factory';
    resetButton.disabled = locked || !selected.modified;
    lockButton.textContent = locked ? '解除' : 'ロック';
    lockButton.setAttribute('aria-pressed', String(locked));
    status.textContent = `${visible.length}/${state.items.length}`;
    input.root.dataset.illustroBrushPresetCount = String(state.items.length);
  };

  const mutate = (operation: () => BrushPresetLibraryStateV1): void => {
    try {
      state = operation();
      persist();
      applySelected();
      status.textContent = '';
      render();
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : '操作に失敗しました';
    }
  };

  pressureCurveEditor = installSharedCurveEditorV1({
    elements: {
      canvas: pressureCurveCanvas,
      preset: pressureCurvePreset,
      inputNumber: pressureCurveInput,
      outputNumber: pressureCurveOutput,
      deleteButton: pressureCurveDelete,
      resetButton: pressureCurveReset,
    },
    initialCurve: resolveBrushPressureResponseCurveV1(
      selectedBrushPresetItemV1(state).preset,
      defaultPressureResponseCurve(),
    ),
    onChange: (curve) => {
      if (brushPressureResponseCurveOverrideV1(selectedBrushPresetItemV1(state).preset) === null) {
        return;
      }
      mutate(() => updateBrushPresetPressureResponseCurveV1(state, state.selectedPresetId, curve));
    },
  });

  tiltCurveEditor = installSharedCurveEditorV1({
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

  const unsubscribePressureDefault =
    input.pressureResponseDefault?.subscribe(() => {
      if (brushPressureResponseCurveOverrideV1(selectedBrushPresetItemV1(state).preset) !== null) {
        return;
      }
      applySelected();
      render();
    }) ?? (() => undefined);

  const onSearch = (): void => {
    state = setBrushPresetSearchV1(state, search.value);
    render();
  };
  const onCategory = (): void => {
    state = setBrushPresetCategoryV1(state, category.value || null);
    render();
  };
  const onCreate = (): void =>
    mutate(() => createUserBrushPresetV1(state, { id: nextId(), name: '新規ブラシ' }));
  const onDuplicate = (): void =>
    mutate(() => duplicateBrushPresetV1(state, state.selectedPresetId, nextId()));
  const onRename = (): void =>
    mutate(() => renameBrushPresetV1(state, state.selectedPresetId, name.value));
  const onDelete = (): void => mutate(() => deleteBrushPresetV1(state, state.selectedPresetId));
  const onLock = (): void => {
    const selected = selectedBrushPresetItemV1(state);
    mutate(() => setBrushPresetLockedV1(state, selected.preset.id, !selected.locked));
  };
  const onReset = (): void => mutate(() => resetBrushPresetV1(state, state.selectedPresetId));
  const updateParameter = (patch: Partial<BrushParameterValuesV1>): void =>
    mutate(() => updateBrushPresetParametersV1(state, state.selectedPresetId, patch));
  const onSizeRange = (): void => updateParameter({ sizePx: Number(sizeRange.value) });
  const onSizeNumber = (): void => updateParameter({ sizePx: Number(sizeNumber.value) });
  const onOpacityRange = (): void => updateParameter({ opacity: Number(opacityRange.value) });
  const onOpacityNumber = (): void => updateParameter({ opacity: Number(opacityNumber.value) });
  const onFlowRange = (): void => updateParameter({ flow: Number(flowRange.value) });
  const onFlowNumber = (): void => updateParameter({ flow: Number(flowNumber.value) });
  const onPressureCurveOverride = (): void => {
    const selected = selectedBrushPresetItemV1(state).preset;
    const override = brushPressureResponseCurveOverrideV1(selected);
    mutate(() =>
      override === null
        ? updateBrushPresetPressureResponseCurveV1(
            state,
            state.selectedPresetId,
            defaultPressureResponseCurve(),
          )
        : clearBrushPresetPressureResponseCurveOverrideV1(state, state.selectedPresetId),
    );
  };
  const updateHardness = (hardness: number): void =>
    mutate(() => updateBrushPresetHardnessV1(state, state.selectedPresetId, hardness));
  const onHardnessRange = (): void => updateHardness(Number(hardnessRange.value));
  const onHardnessNumber = (): void => updateHardness(Number(hardnessNumber.value));
  const updateTipDensity = (density: number): void =>
    mutate(() => updateBrushPresetTipDensityV1(state, state.selectedPresetId, density));
  const onTipDensityRange = (): void => updateTipDensity(Number(tipDensityRange.value));
  const onTipDensityNumber = (): void => updateTipDensity(Number(tipDensityNumber.value));
  const updateSpacing = (percent: number): void =>
    mutate(() => updateBrushPresetSpacingV1(state, state.selectedPresetId, percent / 100));
  const onSpacingRange = (): void => updateSpacing(Number(spacingRange.value));
  const onSpacingNumber = (): void => updateSpacing(Number(spacingNumber.value));
  const updateTipAngle = (angleDegrees: number): void =>
    mutate(() => updateBrushPresetTipAngleV1(state, state.selectedPresetId, angleDegrees));
  const onTipAngleRange = (): void => updateTipAngle(Number(tipAngleRange.value));
  const onTipAngleNumber = (): void => updateTipAngle(Number(tipAngleNumber.value));
  const updateTipDirection = (directionDegrees: number): void =>
    mutate(() => updateBrushPresetTipDirectionV1(state, state.selectedPresetId, directionDegrees));
  const onTipDirectionRange = (): void => updateTipDirection(Number(tipDirectionRange.value));
  const onTipDirectionNumber = (): void => updateTipDirection(Number(tipDirectionNumber.value));
  const onFollowRotation = (): void => {
    const selected = selectedBrushPresetItemV1(state).preset;
    const enabled =
      !brushPenOrientationEnabledV1(selected) && brushFollowStrokeRotationV1(selected);
    mutate(() =>
      updateBrushPresetRotationSourceV1(
        state,
        state.selectedPresetId,
        enabled ? 'fixed' : 'stroke',
      ),
    );
  };
  const onPenOrientation = (): void => {
    const enabled = brushPenOrientationEnabledV1(selectedBrushPresetItemV1(state).preset);
    mutate(() =>
      updateBrushPresetRotationSourceV1(state, state.selectedPresetId, enabled ? 'fixed' : 'pen'),
    );
  };
  const onTipRepeatMode = (): void => {
    const mode: BrushTipSelectionModeV1 =
      tipRepeatMode.value === 'sequence'
        ? 'sequence'
        : tipRepeatMode.value === 'random-per-stamp'
          ? 'random-per-stamp'
          : 'fixed';
    mutate(() => updateBrushPresetTipSelectionModeV1(state, state.selectedPresetId, mode));
  };
  const updateStartLength = (lengthPx: number): void =>
    mutate(() => updateBrushPresetStartLengthV1(state, state.selectedPresetId, lengthPx));
  const onStartLengthRange = (): void => updateStartLength(Number(startLengthRange.value));
  const onStartLengthNumber = (): void => updateStartLength(Number(startLengthNumber.value));
  const updateEndLength = (lengthPx: number): void =>
    mutate(() => updateBrushPresetEndLengthV1(state, state.selectedPresetId, lengthPx));
  const onEndLengthRange = (): void => updateEndLength(Number(endLengthRange.value));
  const onEndLengthNumber = (): void => updateEndLength(Number(endLengthNumber.value));
  const updateSizeTaper = (percent: number): void =>
    mutate(() => updateBrushPresetSizeTaperV1(state, state.selectedPresetId, percent / 100));
  const onSizeTaperRange = (): void => updateSizeTaper(Number(sizeTaperRange.value));
  const onSizeTaperNumber = (): void => updateSizeTaper(Number(sizeTaperNumber.value));
  const updateOpacityTaper = (percent: number): void =>
    mutate(() => updateBrushPresetOpacityTaperV1(state, state.selectedPresetId, percent / 100));
  const onOpacityTaperRange = (): void => updateOpacityTaper(Number(opacityTaperRange.value));
  const onOpacityTaperNumber = (): void => updateOpacityTaper(Number(opacityTaperNumber.value));
  const onForceStartTaper = (): void => {
    const current = brushForcedTaperV1(selectedBrushPresetItemV1(state).preset);
    mutate(() =>
      updateBrushPresetForcedTaperV1(state, state.selectedPresetId, !current.start, current.end),
    );
  };
  const onForceEndTaper = (): void => {
    const current = brushForcedTaperV1(selectedBrushPresetItemV1(state).preset);
    mutate(() =>
      updateBrushPresetForcedTaperV1(state, state.selectedPresetId, current.start, !current.end),
    );
  };
  const updateStabilization = (percent: number): void =>
    mutate(() =>
      updateBrushPresetRealtimeStabilizationV1(state, state.selectedPresetId, percent / 100),
    );
  const onStabilizationRange = (): void => updateStabilization(Number(stabilizationRange.value));
  const onStabilizationNumber = (): void => updateStabilization(Number(stabilizationNumber.value));
  const updatePostCorrection = (percent: number): void =>
    mutate(() =>
      updateBrushPresetPostStrokeCorrectionV1(state, state.selectedPresetId, percent / 100),
    );
  const onPostCorrectionRange = (): void => updatePostCorrection(Number(postCorrectionRange.value));
  const onPostCorrectionNumber = (): void =>
    updatePostCorrection(Number(postCorrectionNumber.value));
  const onGrainResource = (): void =>
    mutate(() =>
      updateBrushPresetGrainResourceV1(
        state,
        state.selectedPresetId,
        grainResource.value.length === 0 ? null : grainResource.value,
      ),
    );
  const onPaperResource = (): void =>
    mutate(() =>
      updateBrushPresetPaperTextureResourceV1(
        state,
        state.selectedPresetId,
        paperResource.value.length === 0 ? null : paperResource.value,
      ),
    );
  const updateTextureStrength = (percent: number): void =>
    mutate(() => updateBrushPresetTextureStrengthV1(state, state.selectedPresetId, percent / 100));
  const onTextureStrengthRange = (): void =>
    updateTextureStrength(Number(textureStrengthRange.value));
  const onTextureStrengthNumber = (): void =>
    updateTextureStrength(Number(textureStrengthNumber.value));
  const updateTextureScale = (percent: number): void =>
    mutate(() => updateBrushPresetTextureScaleV1(state, state.selectedPresetId, percent / 100));
  const onTextureScaleRange = (): void => updateTextureScale(Number(textureScaleRange.value));
  const onTextureScaleNumber = (): void => updateTextureScale(Number(textureScaleNumber.value));
  const updateTextureRotation = (rotationDegrees: number): void =>
    mutate(() =>
      updateBrushPresetTextureRotationV1(state, state.selectedPresetId, rotationDegrees),
    );
  const onTextureRotationRange = (): void =>
    updateTextureRotation(Number(textureRotationRange.value));
  const onTextureRotationNumber = (): void =>
    updateTextureRotation(Number(textureRotationNumber.value));
  const onTextureBlendMode = (): void => {
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
  const onPressureOpacity = (): void =>
    mutate(() =>
      updateBrushPresetPressureOpacityV1(
        state,
        state.selectedPresetId,
        !brushPressureOpacityEnabledV1(selectedBrushPresetItemV1(state).preset),
      ),
    );
  const onPressureFlow = (): void =>
    mutate(() =>
      updateBrushPresetPressureFlowV1(
        state,
        state.selectedPresetId,
        !brushPressureFlowEnabledV1(selectedBrushPresetItemV1(state).preset),
      ),
    );
  const onTiltSize = (): void =>
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
  const updateSizeMaximumResponse = (valuePercent: number): void =>
    mutate(() =>
      updateBrushPresetSizeMaximumResponseV1(state, state.selectedPresetId, valuePercent / 100),
    );
  const updateOpacityMaximumResponse = (valuePercent: number): void =>
    mutate(() =>
      updateBrushPresetOpacityMaximumResponseV1(state, state.selectedPresetId, valuePercent / 100),
    );
  const updateFlowMaximumResponse = (valuePercent: number): void =>
    mutate(() =>
      updateBrushPresetFlowMaximumResponseV1(state, state.selectedPresetId, valuePercent / 100),
    );
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
  const updateSizeJitter = (valuePercent: number): void =>
    mutate(() => updateBrushPresetSizeJitterV1(state, state.selectedPresetId, valuePercent / 100));
  const onSizeJitterRange = (): void => updateSizeJitter(Number(sizeJitterRange.value));
  const onSizeJitterNumber = (): void => updateSizeJitter(Number(sizeJitterNumber.value));
  const updateOpacityJitter = (valuePercent: number): void =>
    mutate(() =>
      updateBrushPresetOpacityJitterV1(state, state.selectedPresetId, valuePercent / 100),
    );
  const onOpacityJitterRange = (): void => updateOpacityJitter(Number(opacityJitterRange.value));
  const onOpacityJitterNumber = (): void => updateOpacityJitter(Number(opacityJitterNumber.value));
  const updateRotationJitter = (valuePercent: number): void =>
    mutate(() =>
      updateBrushPresetRotationJitterV1(state, state.selectedPresetId, valuePercent / 100),
    );
  const onRotationJitterRange = (): void => updateRotationJitter(Number(rotationJitterRange.value));
  const onRotationJitterNumber = (): void =>
    updateRotationJitter(Number(rotationJitterNumber.value));
  const updatePositionJitter = (valuePercent: number): void =>
    mutate(() =>
      updateBrushPresetPositionJitterV1(state, state.selectedPresetId, valuePercent / 100),
    );
  const onPositionJitterRange = (): void => updatePositionJitter(Number(positionJitterRange.value));
  const onPositionJitterNumber = (): void =>
    updatePositionJitter(Number(positionJitterNumber.value));
  const updateDensityJitter = (valuePercent: number): void =>
    mutate(() =>
      updateBrushPresetDensityJitterV1(state, state.selectedPresetId, valuePercent / 100),
    );
  const onDensityJitterRange = (): void => updateDensityJitter(Number(densityJitterRange.value));
  const onDensityJitterNumber = (): void => updateDensityJitter(Number(densityJitterNumber.value));
  const updateHueJitter = (valuePercent: number): void =>
    mutate(() => updateBrushPresetHueJitterV1(state, state.selectedPresetId, valuePercent / 100));
  const updateSaturationJitter = (valuePercent: number): void =>
    mutate(() =>
      updateBrushPresetSaturationJitterV1(state, state.selectedPresetId, valuePercent / 100),
    );
  const updateValueJitter = (valuePercent: number): void =>
    mutate(() => updateBrushPresetValueJitterV1(state, state.selectedPresetId, valuePercent / 100));
  const onHueJitterRange = (): void => updateHueJitter(Number(hueJitterRange.value));
  const onHueJitterNumber = (): void => updateHueJitter(Number(hueJitterNumber.value));
  const onSaturationJitterRange = (): void =>
    updateSaturationJitter(Number(saturationJitterRange.value));
  const onSaturationJitterNumber = (): void =>
    updateSaturationJitter(Number(saturationJitterNumber.value));
  const onValueJitterRange = (): void => updateValueJitter(Number(valueJitterRange.value));
  const onValueJitterNumber = (): void => updateValueJitter(Number(valueJitterNumber.value));
  const onSprayEnabled = (): void =>
    mutate(() =>
      updateBrushPresetSprayEnabledV1(
        state,
        state.selectedPresetId,
        !brushSprayEnabledV1(selectedBrushPresetItemV1(state).preset),
      ),
    );
  const updateSprayParticleSize = (valuePercent: number): void =>
    mutate(() =>
      updateBrushPresetSprayParticleSizeRatioV1(state, state.selectedPresetId, valuePercent / 100),
    );
  const onSprayParticleSizeRange = (): void =>
    updateSprayParticleSize(Number(sprayParticleSizeRange.value));
  const onSprayParticleSizeNumber = (): void =>
    updateSprayParticleSize(Number(sprayParticleSizeNumber.value));
  const updateSprayParticleDensity = (value: number): void =>
    mutate(() => updateBrushPresetSprayParticleDensityV1(state, state.selectedPresetId, value));
  const onSprayParticleDensityRange = (): void =>
    updateSprayParticleDensity(Number(sprayParticleDensityRange.value));
  const onSprayParticleDensityNumber = (): void =>
    updateSprayParticleDensity(Number(sprayParticleDensityNumber.value));
  const updateSpraySpread = (spreadPercent: number, deviationPercent: number): void =>
    mutate(() =>
      updateBrushPresetSpraySpreadV1(
        state,
        state.selectedPresetId,
        spreadPercent / 100,
        deviationPercent / 100,
      ),
    );
  const onSpraySpreadRadiusRange = (): void =>
    updateSpraySpread(Number(spraySpreadRadiusRange.value), Number(sprayDeviationRange.value));
  const onSpraySpreadRadiusNumber = (): void =>
    updateSpraySpread(Number(spraySpreadRadiusNumber.value), Number(sprayDeviationNumber.value));
  const onSprayDeviationRange = (): void =>
    updateSpraySpread(Number(spraySpreadRadiusRange.value), Number(sprayDeviationRange.value));
  const onSprayDeviationNumber = (): void =>
    updateSpraySpread(Number(spraySpreadRadiusNumber.value), Number(sprayDeviationNumber.value));
  const onSprayAngleBasedOnCenter = (): void =>
    mutate(() =>
      updateBrushPresetSprayAngleBasedOnCenterV1(
        state,
        state.selectedPresetId,
        !brushSprayAngleBasedOnCenterV1(selectedBrushPresetItemV1(state).preset),
      ),
    );
  const updateSubColorRatio = (valuePercent: number): void =>
    mutate(() =>
      updateBrushPresetSubColorRatioV1(state, state.selectedPresetId, valuePercent / 100),
    );
  const onSubColorRatioRange = (): void => updateSubColorRatio(Number(subColorRatioRange.value));
  const onSubColorRatioNumber = (): void => updateSubColorRatio(Number(subColorRatioNumber.value));
  const onReferenceAntiOverflow = (): void =>
    mutate(() =>
      updateBrushPresetReferenceAntiOverflowV1(
        state,
        state.selectedPresetId,
        !brushReferenceAntiOverflowV1(selectedBrushPresetItemV1(state).preset),
      ),
    );
  const onColorMixEnabled = (): void =>
    mutate(() =>
      updateBrushPresetColorMixEnabledV1(
        state,
        state.selectedPresetId,
        !brushColorMixEnabledV1(selectedBrushPresetItemV1(state).preset),
      ),
    );
  const updateColorMixCanvasRatio = (valuePercent: number): void =>
    mutate(() =>
      updateBrushPresetColorMixCanvasRatioV1(state, state.selectedPresetId, valuePercent / 100),
    );
  const updateColorMixDepositAmount = (valuePercent: number): void =>
    mutate(() =>
      updateBrushPresetColorMixDepositAmountV1(state, state.selectedPresetId, valuePercent / 100),
    );
  const updateColorMixSampleRadiusRatio = (valuePercent: number): void =>
    mutate(() =>
      updateBrushPresetColorMixSampleRadiusRatioV1(
        state,
        state.selectedPresetId,
        valuePercent / 100,
      ),
    );
  const updateColorMixPickupAmount = (valuePercent: number): void =>
    mutate(() =>
      updateBrushPresetColorMixPickupAmountV1(state, state.selectedPresetId, valuePercent / 100),
    );
  const updateColorMixCarryAmount = (valuePercent: number): void =>
    mutate(() =>
      updateBrushPresetColorMixCarryAmountV1(state, state.selectedPresetId, valuePercent / 100),
    );
  const onColorMixCanvasRatioRange = (): void =>
    updateColorMixCanvasRatio(Number(colorMixCanvasRatioRange.value));
  const onColorMixCanvasRatioNumber = (): void =>
    updateColorMixCanvasRatio(Number(colorMixCanvasRatioNumber.value));
  const onColorMixDepositRange = (): void =>
    updateColorMixDepositAmount(Number(colorMixDepositRange.value));
  const onColorMixDepositNumber = (): void =>
    updateColorMixDepositAmount(Number(colorMixDepositNumber.value));
  const onColorMixSampleRadiusRange = (): void =>
    updateColorMixSampleRadiusRatio(Number(colorMixSampleRadiusRange.value));
  const onColorMixSampleRadiusNumber = (): void =>
    updateColorMixSampleRadiusRatio(Number(colorMixSampleRadiusNumber.value));
  const onColorMixPickupRange = (): void =>
    updateColorMixPickupAmount(Number(colorMixPickupRange.value));
  const onColorMixPickupNumber = (): void =>
    updateColorMixPickupAmount(Number(colorMixPickupNumber.value));
  const onColorMixCarryRange = (): void =>
    updateColorMixCarryAmount(Number(colorMixCarryRange.value));
  const onColorMixCarryNumber = (): void =>
    updateColorMixCarryAmount(Number(colorMixCarryNumber.value));
  const onTipShape = (): void => {
    const shape: BrushTipShapeV1 =
      tipShape.value === 'sampled-image'
        ? 'sampled-image'
        : tipShape.value === 'square'
          ? 'square'
          : 'round';
    mutate(() => updateBrushPresetTipShapeV1(state, state.selectedPresetId, shape));
  };

  const onCustomTipCreate = (): void => {
    customTipFile.value = '';
    customTipFile.click();
  };
  const onCustomTipFile = async (): Promise<void> => {
    const file = customTipFile.files?.[0];
    if (file === undefined) return;
    try {
      const alpha = await customBrushTipAlphaFromFileV1(file);
      state = updateBrushPresetCustomTipV1(state, state.selectedPresetId, alpha);
      persist();
      applySelected();
      render();
      status.textContent = '画像からカスタム先端を作成しました';
    } catch (error) {
      status.textContent =
        error instanceof Error ? error.message : 'カスタム先端の作成に失敗しました';
    }
  };
  const onTipAssetAdd = (): void => {
    tipAssetFile.value = '';
    tipAssetFile.click();
  };
  const onTipAssetFile = async (): Promise<void> => {
    const file = tipAssetFile.files?.[0];
    if (file === undefined) return;
    try {
      const alpha = await customBrushTipAlphaFromFileV1(file);
      const count = brushTipAssetsV1(selectedBrushPresetItemV1(state).preset).length;
      state = addBrushPresetTipAssetV1(state, state.selectedPresetId, {
        id: nextTipAssetId(),
        name: '先端 ' + (count + 1),
        alpha,
      });
      persist();
      applySelected();
      render();
      status.textContent = '先端アセットを追加しました';
    } catch (error) {
      status.textContent =
        error instanceof Error ? error.message : '先端アセットの追加に失敗しました';
    }
  };
  const onTipAssetSelect = (): void => {
    if (tipAssetSelect.value === '') return;
    mutate(() => selectBrushPresetTipAssetV1(state, state.selectedPresetId, tipAssetSelect.value));
  };
  const onTipAssetDelete = (): void => {
    const assetId = brushSelectedTipAssetIdV1(selectedBrushPresetItemV1(state).preset);
    if (assetId === null) return;
    mutate(() => deleteBrushPresetTipAssetV1(state, state.selectedPresetId, assetId));
  };
  search.addEventListener('input', onSearch);
  category.addEventListener('change', onCategory);
  createButton.addEventListener('click', onCreate);
  duplicateButton.addEventListener('click', onDuplicate);
  renameButton.addEventListener('click', onRename);
  deleteButton.addEventListener('click', onDelete);
  lockButton.addEventListener('click', onLock);
  resetButton.addEventListener('click', onReset);
  sizeRange.addEventListener('input', onSizeRange);
  sizeNumber.addEventListener('change', onSizeNumber);
  opacityRange.addEventListener('input', onOpacityRange);
  opacityNumber.addEventListener('change', onOpacityNumber);
  flowRange.addEventListener('input', onFlowRange);
  flowNumber.addEventListener('change', onFlowNumber);
  hardnessRange.addEventListener('input', onHardnessRange);
  hardnessNumber.addEventListener('change', onHardnessNumber);
  tipDensityRange.addEventListener('input', onTipDensityRange);
  tipDensityNumber.addEventListener('change', onTipDensityNumber);
  spacingRange.addEventListener('input', onSpacingRange);
  spacingNumber.addEventListener('change', onSpacingNumber);
  tipAngleRange.addEventListener('input', onTipAngleRange);
  tipAngleNumber.addEventListener('change', onTipAngleNumber);
  tipDirectionRange.addEventListener('input', onTipDirectionRange);
  tipDirectionNumber.addEventListener('change', onTipDirectionNumber);
  followRotationButton.addEventListener('click', onFollowRotation);
  penOrientationButton.addEventListener('click', onPenOrientation);
  tipRepeatMode.addEventListener('change', onTipRepeatMode);
  startLengthRange.addEventListener('input', onStartLengthRange);
  startLengthNumber.addEventListener('change', onStartLengthNumber);
  endLengthRange.addEventListener('input', onEndLengthRange);
  endLengthNumber.addEventListener('change', onEndLengthNumber);
  sizeTaperRange.addEventListener('input', onSizeTaperRange);
  sizeTaperNumber.addEventListener('change', onSizeTaperNumber);
  opacityTaperRange.addEventListener('input', onOpacityTaperRange);
  opacityTaperNumber.addEventListener('change', onOpacityTaperNumber);
  forceStartTaperButton.addEventListener('click', onForceStartTaper);
  forceEndTaperButton.addEventListener('click', onForceEndTaper);
  stabilizationRange.addEventListener('input', onStabilizationRange);
  stabilizationNumber.addEventListener('change', onStabilizationNumber);
  postCorrectionRange.addEventListener('input', onPostCorrectionRange);
  postCorrectionNumber.addEventListener('change', onPostCorrectionNumber);
  grainResource.addEventListener('change', onGrainResource);
  paperResource.addEventListener('change', onPaperResource);
  textureStrengthRange.addEventListener('input', onTextureStrengthRange);
  textureStrengthNumber.addEventListener('change', onTextureStrengthNumber);
  textureScaleRange.addEventListener('input', onTextureScaleRange);
  textureScaleNumber.addEventListener('change', onTextureScaleNumber);
  textureRotationRange.addEventListener('input', onTextureRotationRange);
  textureRotationNumber.addEventListener('change', onTextureRotationNumber);
  textureBlendMode.addEventListener('change', onTextureBlendMode);
  pressureSizeButton.addEventListener('click', onPressureSize);
  pressureOpacityButton.addEventListener('click', onPressureOpacity);
  pressureFlowButton.addEventListener('click', onPressureFlow);
  pressureCurveOverrideButton.addEventListener('click', onPressureCurveOverride);
  tiltSizeButton.addEventListener('click', onTiltSize);
  tiltOpacityButton.addEventListener('click', onTiltOpacity);
  tiltFlowButton.addEventListener('click', onTiltFlow);
  velocitySizeButton.addEventListener('click', onVelocitySize);
  velocityOpacityButton.addEventListener('click', onVelocityOpacity);
  velocityFlowButton.addEventListener('click', onVelocityFlow);
  velocityMaximumRange.addEventListener('input', onVelocityMaximumRange);
  velocityMaximumNumber.addEventListener('change', onVelocityMaximumNumber);
  randomSizeButton.addEventListener('click', onRandomSize);
  randomOpacityButton.addEventListener('click', onRandomOpacity);
  randomFlowButton.addEventListener('click', onRandomFlow);
  sizeMinimumResponseRange.addEventListener('input', onSizeMinimumResponseRange);
  sizeMinimumResponseNumber.addEventListener('change', onSizeMinimumResponseNumber);
  opacityMinimumResponseRange.addEventListener('input', onOpacityMinimumResponseRange);
  opacityMinimumResponseNumber.addEventListener('change', onOpacityMinimumResponseNumber);
  flowMinimumResponseRange.addEventListener('input', onFlowMinimumResponseRange);
  flowMinimumResponseNumber.addEventListener('change', onFlowMinimumResponseNumber);
  sizeMaximumResponseRange.addEventListener('input', onSizeMaximumResponseRange);
  sizeMaximumResponseNumber.addEventListener('change', onSizeMaximumResponseNumber);
  opacityMaximumResponseRange.addEventListener('input', onOpacityMaximumResponseRange);
  opacityMaximumResponseNumber.addEventListener('change', onOpacityMaximumResponseNumber);
  flowMaximumResponseRange.addEventListener('input', onFlowMaximumResponseRange);
  flowMaximumResponseNumber.addEventListener('change', onFlowMaximumResponseNumber);
  sizeJitterRange.addEventListener('input', onSizeJitterRange);
  sizeJitterNumber.addEventListener('change', onSizeJitterNumber);
  opacityJitterRange.addEventListener('input', onOpacityJitterRange);
  opacityJitterNumber.addEventListener('change', onOpacityJitterNumber);
  rotationJitterRange.addEventListener('input', onRotationJitterRange);
  rotationJitterNumber.addEventListener('change', onRotationJitterNumber);
  positionJitterRange.addEventListener('input', onPositionJitterRange);
  positionJitterNumber.addEventListener('change', onPositionJitterNumber);
  densityJitterRange.addEventListener('input', onDensityJitterRange);
  densityJitterNumber.addEventListener('change', onDensityJitterNumber);
  hueJitterRange.addEventListener('input', onHueJitterRange);
  hueJitterNumber.addEventListener('change', onHueJitterNumber);
  saturationJitterRange.addEventListener('input', onSaturationJitterRange);
  saturationJitterNumber.addEventListener('change', onSaturationJitterNumber);
  valueJitterRange.addEventListener('input', onValueJitterRange);
  valueJitterNumber.addEventListener('change', onValueJitterNumber);
  sprayEnabledButton.addEventListener('click', onSprayEnabled);
  sprayParticleSizeRange.addEventListener('input', onSprayParticleSizeRange);
  sprayParticleSizeNumber.addEventListener('change', onSprayParticleSizeNumber);
  sprayParticleDensityRange.addEventListener('input', onSprayParticleDensityRange);
  sprayParticleDensityNumber.addEventListener('change', onSprayParticleDensityNumber);
  spraySpreadRadiusRange.addEventListener('input', onSpraySpreadRadiusRange);
  spraySpreadRadiusNumber.addEventListener('change', onSpraySpreadRadiusNumber);
  sprayDeviationRange.addEventListener('input', onSprayDeviationRange);
  sprayDeviationNumber.addEventListener('change', onSprayDeviationNumber);
  sprayAngleBasedOnCenterButton.addEventListener('click', onSprayAngleBasedOnCenter);
  subColorRatioRange.addEventListener('input', onSubColorRatioRange);
  subColorRatioNumber.addEventListener('change', onSubColorRatioNumber);
  referenceAntiOverflowButton.addEventListener('click', onReferenceAntiOverflow);
  colorMixEnabledButton.addEventListener('click', onColorMixEnabled);
  colorMixCanvasRatioRange.addEventListener('input', onColorMixCanvasRatioRange);
  colorMixCanvasRatioNumber.addEventListener('change', onColorMixCanvasRatioNumber);
  colorMixDepositRange.addEventListener('input', onColorMixDepositRange);
  colorMixDepositNumber.addEventListener('change', onColorMixDepositNumber);
  colorMixSampleRadiusRange.addEventListener('input', onColorMixSampleRadiusRange);
  colorMixSampleRadiusNumber.addEventListener('change', onColorMixSampleRadiusNumber);
  colorMixPickupRange.addEventListener('input', onColorMixPickupRange);
  colorMixPickupNumber.addEventListener('change', onColorMixPickupNumber);
  colorMixCarryRange.addEventListener('input', onColorMixCarryRange);
  colorMixCarryNumber.addEventListener('change', onColorMixCarryNumber);
  tipShape.addEventListener('change', onTipShape);
  customTipCreate.addEventListener('click', onCustomTipCreate);
  customTipFile.addEventListener('change', onCustomTipFile);
  tipAssetAdd.addEventListener('click', onTipAssetAdd);
  tipAssetFile.addEventListener('change', onTipAssetFile);
  tipAssetSelect.addEventListener('change', onTipAssetSelect);
  tipAssetDelete.addEventListener('click', onTipAssetDelete);

  applySelected();
  render();

  return Object.freeze({
    snapshot: () => state,
    refresh: render,
    dispose: () => {
      search.removeEventListener('input', onSearch);
      category.removeEventListener('change', onCategory);
      createButton.removeEventListener('click', onCreate);
      duplicateButton.removeEventListener('click', onDuplicate);
      renameButton.removeEventListener('click', onRename);
      deleteButton.removeEventListener('click', onDelete);
      lockButton.removeEventListener('click', onLock);
      resetButton.removeEventListener('click', onReset);
      sizeRange.removeEventListener('input', onSizeRange);
      sizeNumber.removeEventListener('change', onSizeNumber);
      opacityRange.removeEventListener('input', onOpacityRange);
      opacityNumber.removeEventListener('change', onOpacityNumber);
      flowRange.removeEventListener('input', onFlowRange);
      flowNumber.removeEventListener('change', onFlowNumber);
      hardnessRange.removeEventListener('input', onHardnessRange);
      hardnessNumber.removeEventListener('change', onHardnessNumber);
      tipDensityRange.removeEventListener('input', onTipDensityRange);
      tipDensityNumber.removeEventListener('change', onTipDensityNumber);
      spacingRange.removeEventListener('input', onSpacingRange);
      spacingNumber.removeEventListener('change', onSpacingNumber);
      tipAngleRange.removeEventListener('input', onTipAngleRange);
      tipAngleNumber.removeEventListener('change', onTipAngleNumber);
      tipDirectionRange.removeEventListener('input', onTipDirectionRange);
      tipDirectionNumber.removeEventListener('change', onTipDirectionNumber);
      followRotationButton.removeEventListener('click', onFollowRotation);
      penOrientationButton.removeEventListener('click', onPenOrientation);
      tipRepeatMode.removeEventListener('change', onTipRepeatMode);
      startLengthRange.removeEventListener('input', onStartLengthRange);
      startLengthNumber.removeEventListener('change', onStartLengthNumber);
      endLengthRange.removeEventListener('input', onEndLengthRange);
      endLengthNumber.removeEventListener('change', onEndLengthNumber);
      sizeTaperRange.removeEventListener('input', onSizeTaperRange);
      sizeTaperNumber.removeEventListener('change', onSizeTaperNumber);
      opacityTaperRange.removeEventListener('input', onOpacityTaperRange);
      opacityTaperNumber.removeEventListener('change', onOpacityTaperNumber);
      forceStartTaperButton.removeEventListener('click', onForceStartTaper);
      forceEndTaperButton.removeEventListener('click', onForceEndTaper);
      stabilizationRange.removeEventListener('input', onStabilizationRange);
      stabilizationNumber.removeEventListener('change', onStabilizationNumber);
      postCorrectionRange.removeEventListener('input', onPostCorrectionRange);
      postCorrectionNumber.removeEventListener('change', onPostCorrectionNumber);
      grainResource.removeEventListener('change', onGrainResource);
      paperResource.removeEventListener('change', onPaperResource);
      textureStrengthRange.removeEventListener('input', onTextureStrengthRange);
      textureStrengthNumber.removeEventListener('change', onTextureStrengthNumber);
      textureScaleRange.removeEventListener('input', onTextureScaleRange);
      textureScaleNumber.removeEventListener('change', onTextureScaleNumber);
      textureRotationRange.removeEventListener('input', onTextureRotationRange);
      textureRotationNumber.removeEventListener('change', onTextureRotationNumber);
      textureBlendMode.removeEventListener('change', onTextureBlendMode);
      pressureSizeButton.removeEventListener('click', onPressureSize);
      pressureOpacityButton.removeEventListener('click', onPressureOpacity);
      pressureFlowButton.removeEventListener('click', onPressureFlow);
      pressureCurveOverrideButton.removeEventListener('click', onPressureCurveOverride);
      tiltSizeButton.removeEventListener('click', onTiltSize);
      tiltOpacityButton.removeEventListener('click', onTiltOpacity);
      tiltFlowButton.removeEventListener('click', onTiltFlow);
      velocitySizeButton.removeEventListener('click', onVelocitySize);
      velocityOpacityButton.removeEventListener('click', onVelocityOpacity);
      velocityFlowButton.removeEventListener('click', onVelocityFlow);
      velocityMaximumRange.removeEventListener('input', onVelocityMaximumRange);
      velocityMaximumNumber.removeEventListener('change', onVelocityMaximumNumber);
      randomSizeButton.removeEventListener('click', onRandomSize);
      randomOpacityButton.removeEventListener('click', onRandomOpacity);
      randomFlowButton.removeEventListener('click', onRandomFlow);
      sizeMinimumResponseRange.removeEventListener('input', onSizeMinimumResponseRange);
      sizeMinimumResponseNumber.removeEventListener('change', onSizeMinimumResponseNumber);
      opacityMinimumResponseRange.removeEventListener('input', onOpacityMinimumResponseRange);
      opacityMinimumResponseNumber.removeEventListener('change', onOpacityMinimumResponseNumber);
      flowMinimumResponseRange.removeEventListener('input', onFlowMinimumResponseRange);
      flowMinimumResponseNumber.removeEventListener('change', onFlowMinimumResponseNumber);
      sizeMaximumResponseRange.removeEventListener('input', onSizeMaximumResponseRange);
      sizeMaximumResponseNumber.removeEventListener('change', onSizeMaximumResponseNumber);
      opacityMaximumResponseRange.removeEventListener('input', onOpacityMaximumResponseRange);
      opacityMaximumResponseNumber.removeEventListener('change', onOpacityMaximumResponseNumber);
      flowMaximumResponseRange.removeEventListener('input', onFlowMaximumResponseRange);
      flowMaximumResponseNumber.removeEventListener('change', onFlowMaximumResponseNumber);
      sizeJitterRange.removeEventListener('input', onSizeJitterRange);
      sizeJitterNumber.removeEventListener('change', onSizeJitterNumber);
      opacityJitterRange.removeEventListener('input', onOpacityJitterRange);
      opacityJitterNumber.removeEventListener('change', onOpacityJitterNumber);
      rotationJitterRange.removeEventListener('input', onRotationJitterRange);
      rotationJitterNumber.removeEventListener('change', onRotationJitterNumber);
      positionJitterRange.removeEventListener('input', onPositionJitterRange);
      positionJitterNumber.removeEventListener('change', onPositionJitterNumber);
      densityJitterRange.removeEventListener('input', onDensityJitterRange);
      densityJitterNumber.removeEventListener('change', onDensityJitterNumber);
      hueJitterRange.removeEventListener('input', onHueJitterRange);
      hueJitterNumber.removeEventListener('change', onHueJitterNumber);
      saturationJitterRange.removeEventListener('input', onSaturationJitterRange);
      saturationJitterNumber.removeEventListener('change', onSaturationJitterNumber);
      valueJitterRange.removeEventListener('input', onValueJitterRange);
      valueJitterNumber.removeEventListener('change', onValueJitterNumber);
      sprayEnabledButton.removeEventListener('click', onSprayEnabled);
      sprayParticleSizeRange.removeEventListener('input', onSprayParticleSizeRange);
      sprayParticleSizeNumber.removeEventListener('change', onSprayParticleSizeNumber);
      sprayParticleDensityRange.removeEventListener('input', onSprayParticleDensityRange);
      sprayParticleDensityNumber.removeEventListener('change', onSprayParticleDensityNumber);
      spraySpreadRadiusRange.removeEventListener('input', onSpraySpreadRadiusRange);
      spraySpreadRadiusNumber.removeEventListener('change', onSpraySpreadRadiusNumber);
      sprayDeviationRange.removeEventListener('input', onSprayDeviationRange);
      sprayDeviationNumber.removeEventListener('change', onSprayDeviationNumber);
      sprayAngleBasedOnCenterButton.removeEventListener('click', onSprayAngleBasedOnCenter);
      subColorRatioRange.removeEventListener('input', onSubColorRatioRange);
      subColorRatioNumber.removeEventListener('change', onSubColorRatioNumber);
      referenceAntiOverflowButton.removeEventListener('click', onReferenceAntiOverflow);
      colorMixEnabledButton.removeEventListener('click', onColorMixEnabled);
      colorMixCanvasRatioRange.removeEventListener('input', onColorMixCanvasRatioRange);
      colorMixCanvasRatioNumber.removeEventListener('change', onColorMixCanvasRatioNumber);
      colorMixDepositRange.removeEventListener('input', onColorMixDepositRange);
      colorMixDepositNumber.removeEventListener('change', onColorMixDepositNumber);
      colorMixSampleRadiusRange.removeEventListener('input', onColorMixSampleRadiusRange);
      colorMixSampleRadiusNumber.removeEventListener('change', onColorMixSampleRadiusNumber);
      colorMixPickupRange.removeEventListener('input', onColorMixPickupRange);
      colorMixPickupNumber.removeEventListener('change', onColorMixPickupNumber);
      colorMixCarryRange.removeEventListener('input', onColorMixCarryRange);
      colorMixCarryNumber.removeEventListener('change', onColorMixCarryNumber);
      unsubscribePressureDefault();
      pressureCurveEditor?.dispose();
      pressureCurveEditor = null;
      tiltCurveEditor?.dispose();
      tiltCurveEditor = null;
      velocityCurveEditor?.dispose();
      velocityCurveEditor = null;
      randomCurveEditor?.dispose();
      randomCurveEditor = null;
      tipShape.removeEventListener('change', onTipShape);
      customTipCreate.removeEventListener('click', onCustomTipCreate);
      customTipFile.removeEventListener('change', onCustomTipFile);
      tipAssetAdd.removeEventListener('click', onTipAssetAdd);
      tipAssetFile.removeEventListener('change', onTipAssetFile);
      tipAssetSelect.removeEventListener('change', onTipAssetSelect);
      tipAssetDelete.removeEventListener('click', onTipAssetDelete);
    },
  });
}
