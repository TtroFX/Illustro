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
  BUILTIN_BRUSH_GRAIN_RESOURCES_V1,
  BUILTIN_BRUSH_PAPER_RESOURCES_V1,
  brushStrokeSpacingV1,
  brushTipAssetsV1,
  brushTipShapeV1,
  type BrushBehaviorV1,
  type BrushParameterValuesV1,
  type BrushTipSelectionModeV1,
  type BrushTipShapeV1,
} from '../domain/brush-schema.js';
import { customBrushTipAlphaFromFileV1, drawCustomBrushTipPreviewV1 } from './custom-brush-tip.js';
import type { PaintSessionControllerV1 } from './paint-session-controller.js';
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
  updateBrushPresetFollowRotationV1,
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

export interface BrushPresetControllerV1 {
  snapshot(): BrushPresetLibraryStateV1;
  refresh(): void;
  dispose(): void;
}

export function installBrushPresetControllerV1(input: {
  readonly root: HTMLElement;
  readonly paintSession: PaintSessionControllerV1;
  readonly storage?: Storage | null;
  readonly onBrushModeChanged?: () => void;
}): BrushPresetControllerV1 {
  const storage = input.storage ?? globalThis.localStorage;
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
    input.paintSession.setBrushFollowStrokeRotation(brushFollowStrokeRotationV1(item.preset));
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
      brushFollowStrokeRotationV1(item.preset),
    );
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
    const followRotation = brushFollowStrokeRotationV1(selected.preset);
    followRotationButton.textContent = followRotation ? 'ON' : 'OFF';
    followRotationButton.setAttribute('aria-pressed', String(followRotation));
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
    propertyStatus.textContent = `${parameters.sizePx.toFixed(1)} px · ${Math.round(parameters.opacity * 100)}% · ${Math.round(parameters.flow * 100)}% · H${Math.round(hardness * 100)}% · D${Math.round(tipDensity * 100)}% · S${Math.round(spacing.spacingRatio * 100)}% · A${Math.round(tipAngleDegrees)}° · F${Math.round(tipDirectionDegrees)}°${followRotation ? ' · Follow' : ''}${repeatLabel}${startLabel}${endLabel}${sizeTaperLabel}${opacityTaperLabel}${forcedTaperLabel}${stabilizationLabel}${postCorrectionLabel}${grainLabel}${paperLabel}${textureStrengthLabel}${textureScaleLabel}`;

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
      tipShape,
      customTipCreate,
      customTipFile,
    ]) {
      control.disabled = locked;
    }
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
  const onFollowRotation = (): void =>
    mutate(() =>
      updateBrushPresetFollowRotationV1(
        state,
        state.selectedPresetId,
        !brushFollowStrokeRotationV1(selectedBrushPresetItemV1(state).preset),
      ),
    );
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
