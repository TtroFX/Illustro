from pathlib import Path


def replace_once(path: str, before: str, after: str) -> None:
    target = Path(path)
    text = target.read_text()
    count = text.count(before)
    if count != 1:
        raise RuntimeError(f'{path}: expected one replacement, found {count}: {before[:180]!r}')
    target.write_text(text.replace(before, after, 1))


def append_once(path: str, marker: str, addition: str) -> None:
    target = Path(path)
    text = target.read_text()
    if marker in text:
        return
    target.write_text(text.rstrip() + '\n\n' + addition.strip() + '\n')


# Preset schema: independent pressure -> flow flag, opt-in/default false.
replace_once(
    'src/domain/brush-schema.ts',
    "export const DEFAULT_BRUSH_PRESSURE_OPACITY_ENABLED_V1 = false as const;\n\nexport function brushPressureOpacityEnabledV1(preset: BrushPresetV1): boolean {\n  const value = preset.dynamics.pressureOpacityEnabled;\n  return typeof value === 'boolean' ? value : DEFAULT_BRUSH_PRESSURE_OPACITY_ENABLED_V1;\n}\n\nexport function withBrushPressureOpacityEnabledV1(\n  preset: BrushPresetV1,\n  enabled: boolean,\n): BrushPresetV1 {\n  if (typeof enabled !== 'boolean') {\n    throw new TypeError('brush pressure opacity flag must be boolean');\n  }\n  if (enabled === DEFAULT_BRUSH_PRESSURE_OPACITY_ENABLED_V1) {\n    const { pressureOpacityEnabled: _pressureOpacityEnabled, ...dynamics } = preset.dynamics;\n    return normalizeBrushPresetV1({ ...preset, dynamics });\n  }\n  return normalizeBrushPresetV1({\n    ...preset,\n    dynamics: { ...preset.dynamics, pressureOpacityEnabled: enabled },\n  });\n}\n",
    "export const DEFAULT_BRUSH_PRESSURE_OPACITY_ENABLED_V1 = false as const;\n\nexport function brushPressureOpacityEnabledV1(preset: BrushPresetV1): boolean {\n  const value = preset.dynamics.pressureOpacityEnabled;\n  return typeof value === 'boolean' ? value : DEFAULT_BRUSH_PRESSURE_OPACITY_ENABLED_V1;\n}\n\nexport function withBrushPressureOpacityEnabledV1(\n  preset: BrushPresetV1,\n  enabled: boolean,\n): BrushPresetV1 {\n  if (typeof enabled !== 'boolean') {\n    throw new TypeError('brush pressure opacity flag must be boolean');\n  }\n  if (enabled === DEFAULT_BRUSH_PRESSURE_OPACITY_ENABLED_V1) {\n    const { pressureOpacityEnabled: _pressureOpacityEnabled, ...dynamics } = preset.dynamics;\n    return normalizeBrushPresetV1({ ...preset, dynamics });\n  }\n  return normalizeBrushPresetV1({\n    ...preset,\n    dynamics: { ...preset.dynamics, pressureOpacityEnabled: enabled },\n  });\n}\n\nexport const DEFAULT_BRUSH_PRESSURE_FLOW_ENABLED_V1 = false as const;\n\nexport function brushPressureFlowEnabledV1(preset: BrushPresetV1): boolean {\n  const value = preset.dynamics.pressureFlowEnabled;\n  return typeof value === 'boolean' ? value : DEFAULT_BRUSH_PRESSURE_FLOW_ENABLED_V1;\n}\n\nexport function withBrushPressureFlowEnabledV1(\n  preset: BrushPresetV1,\n  enabled: boolean,\n): BrushPresetV1 {\n  if (typeof enabled !== 'boolean') throw new TypeError('brush pressure flow flag must be boolean');\n  if (enabled === DEFAULT_BRUSH_PRESSURE_FLOW_ENABLED_V1) {\n    const { pressureFlowEnabled: _pressureFlowEnabled, ...dynamics } = preset.dynamics;\n    return normalizeBrushPresetV1({ ...preset, dynamics });\n  }\n  return normalizeBrushPresetV1({\n    ...preset,\n    dynamics: { ...preset.dynamics, pressureFlowEnabled: enabled },\n  });\n}\n",
)

# Dab kernel: pressure-flow multiplies deposit only, leaving size and opacity-cap mappings orthogonal.
replace_once(
    'src/gpu/baseline-brush.ts',
    '  readonly #pressureOpacityEnabled: boolean;\n  readonly #flow: number;',
    '  readonly #pressureOpacityEnabled: boolean;\n  readonly #pressureFlowEnabled: boolean;\n  readonly #flow: number;',
)
replace_once(
    'src/gpu/baseline-brush.ts',
    '      readonly pressureOpacityEnabled?: boolean;\n      readonly hardness?: number;',
    '      readonly pressureOpacityEnabled?: boolean;\n      readonly pressureFlowEnabled?: boolean;\n      readonly hardness?: number;',
)
replace_once(
    'src/gpu/baseline-brush.ts',
    '    const pressureOpacityEnabled = options.pressureOpacityEnabled ?? false;\n    const hardness = options.hardness ?? BASELINE_BRUSH_HARDNESS;',
    '    const pressureOpacityEnabled = options.pressureOpacityEnabled ?? false;\n    const pressureFlowEnabled = options.pressureFlowEnabled ?? false;\n    const hardness = options.hardness ?? BASELINE_BRUSH_HARDNESS;',
)
replace_once(
    'src/gpu/baseline-brush.ts',
    "    if (typeof pressureOpacityEnabled !== 'boolean') {\n      throw new TypeError('baseline brush pressure opacity flag must be boolean');\n    }\n    if (!Number.isFinite(hardness)",
    "    if (typeof pressureOpacityEnabled !== 'boolean') {\n      throw new TypeError('baseline brush pressure opacity flag must be boolean');\n    }\n    if (typeof pressureFlowEnabled !== 'boolean') {\n      throw new TypeError('baseline brush pressure flow flag must be boolean');\n    }\n    if (!Number.isFinite(hardness)",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    '    this.#pressureOpacityEnabled = pressureOpacityEnabled;\n    this.#flow = flow;',
    '    this.#pressureOpacityEnabled = pressureOpacityEnabled;\n    this.#pressureFlowEnabled = pressureFlowEnabled;\n    this.#flow = flow;',
)
replace_once(
    'src/gpu/baseline-brush.ts',
    "    const pressureSizeScale = this.#pressureSizeEnabled ? stamp.pressure : 1;\n    const pressureOpacityScale = this.#pressureOpacityEnabled ? stamp.pressure : 1;\n    if (\n      sizeScale <= 0 ||\n      opacityScale <= 0 ||\n      pressureSizeScale <= 0 ||\n      pressureOpacityScale <= 0\n    ) {\n      return;\n    }\n    pushBaselineBrushStampV1(\n      target,\n      stamp.x,\n      stamp.y,\n      this.#radius * sizeScale * pressureSizeScale,\n      this.#flow * opacityScale,\n      this.#strokeOpacity * pressureOpacityScale,",
    "    const pressureSizeScale = this.#pressureSizeEnabled ? stamp.pressure : 1;\n    const pressureOpacityScale = this.#pressureOpacityEnabled ? stamp.pressure : 1;\n    const pressureFlowScale = this.#pressureFlowEnabled ? stamp.pressure : 1;\n    if (\n      sizeScale <= 0 ||\n      opacityScale <= 0 ||\n      pressureSizeScale <= 0 ||\n      pressureOpacityScale <= 0 ||\n      pressureFlowScale <= 0\n    ) {\n      return;\n    }\n    pushBaselineBrushStampV1(\n      target,\n      stamp.x,\n      stamp.y,\n      this.#radius * sizeScale * pressureSizeScale,\n      this.#flow * opacityScale * pressureFlowScale,\n      this.#strokeOpacity * pressureOpacityScale,",
)

# Canonical facade.
replace_once(
    'src/app/canonical-raster-brush.ts',
    '      readonly pressureOpacityEnabled?: boolean;\n      readonly hardness?: number;',
    '      readonly pressureOpacityEnabled?: boolean;\n      readonly pressureFlowEnabled?: boolean;\n      readonly hardness?: number;',
)
replace_once(
    'src/app/canonical-raster-brush.ts',
    "      ...(options.pressureOpacityEnabled === undefined\n        ? {}\n        : { pressureOpacityEnabled: options.pressureOpacityEnabled }),\n      ...(options.hardness === undefined",
    "      ...(options.pressureOpacityEnabled === undefined\n        ? {}\n        : { pressureOpacityEnabled: options.pressureOpacityEnabled }),\n      ...(options.pressureFlowEnabled === undefined\n        ? {}\n        : { pressureFlowEnabled: options.pressureFlowEnabled }),\n      ...(options.hardness === undefined",
)

# PaintSession runtime state/capture.
replace_once(
    'src/app/paint-session-controller.ts',
    '  readonly brushPressureOpacityEnabled: boolean;\n  readonly brushTipAngleDegrees: number;',
    '  readonly brushPressureOpacityEnabled: boolean;\n  readonly brushPressureFlowEnabled: boolean;\n  readonly brushTipAngleDegrees: number;',
)
replace_once(
    'src/app/paint-session-controller.ts',
    '  #brushPressureOpacityEnabled = false;\n  #brushTipAngleDegrees: number = BASELINE_BRUSH_TIP_ANGLE_DEGREES;',
    '  #brushPressureOpacityEnabled = false;\n  #brushPressureFlowEnabled = false;\n  #brushTipAngleDegrees: number = BASELINE_BRUSH_TIP_ANGLE_DEGREES;',
)
replace_once(
    'src/app/paint-session-controller.ts',
    '      brushPressureOpacityEnabled: this.#brushPressureOpacityEnabled,\n      brushTipAngleDegrees: this.#brushTipAngleDegrees,',
    '      brushPressureOpacityEnabled: this.#brushPressureOpacityEnabled,\n      brushPressureFlowEnabled: this.#brushPressureFlowEnabled,\n      brushTipAngleDegrees: this.#brushTipAngleDegrees,',
)
replace_once(
    'src/app/paint-session-controller.ts',
    "  brushPressureOpacityEnabled(): boolean {\n    return this.#brushPressureOpacityEnabled;\n  }\n\n  setBrushTipAngleDegrees",
    "  brushPressureOpacityEnabled(): boolean {\n    return this.#brushPressureOpacityEnabled;\n  }\n\n  setBrushPressureFlowEnabled(enabled: boolean): boolean {\n    if (typeof enabled !== 'boolean') throw new TypeError('invalid runtime pressure-flow flag');\n    if (enabled !== this.#brushPressureFlowEnabled) this.#clearActiveStroke();\n    this.#brushPressureFlowEnabled = enabled;\n    return this.#brushPressureFlowEnabled;\n  }\n\n  brushPressureFlowEnabled(): boolean {\n    return this.#brushPressureFlowEnabled;\n  }\n\n  setBrushTipAngleDegrees",
)
replace_once(
    'src/app/paint-session-controller.ts',
    '        pressureOpacityEnabled: this.#brushPressureOpacityEnabled,\n        hardness: this.#brushHardness,',
    '        pressureOpacityEnabled: this.#brushPressureOpacityEnabled,\n        pressureFlowEnabled: this.#brushPressureFlowEnabled,\n        hardness: this.#brushHardness,',
)

# Preset library mutation.
replace_once(
    'src/app/brush-preset-library.ts',
    '  withBrushPressureOpacityEnabledV1,\n  withBrushStrokeSpacingV1,',
    '  withBrushPressureOpacityEnabledV1,\n  withBrushPressureFlowEnabledV1,\n  withBrushStrokeSpacingV1,',
)
replace_once(
    'src/app/brush-preset-library.ts',
    "export function updateBrushPresetPressureOpacityV1(\n  state: BrushPresetLibraryStateV1,\n  presetId: string,\n  enabled: boolean,\n): BrushPresetLibraryStateV1 {\n  return updateItemV1(state, presetId, (item) => {\n    if (item.locked) throw new Error('locked brush preset cannot be edited');\n    const current = withBrushPressureOpacityEnabledV1(item.preset, enabled);\n    if (JSON.stringify(current) === JSON.stringify(item.preset)) return item;\n    const next = normalizeBrushPresetV1({ ...current, revision: item.preset.revision + 1 });\n    return itemV1({\n      source: item.source,\n      baseline: item.baseline,\n      preset: next,\n      locked: item.locked,\n    });\n  });\n}\n",
    "export function updateBrushPresetPressureOpacityV1(\n  state: BrushPresetLibraryStateV1,\n  presetId: string,\n  enabled: boolean,\n): BrushPresetLibraryStateV1 {\n  return updateItemV1(state, presetId, (item) => {\n    if (item.locked) throw new Error('locked brush preset cannot be edited');\n    const current = withBrushPressureOpacityEnabledV1(item.preset, enabled);\n    if (JSON.stringify(current) === JSON.stringify(item.preset)) return item;\n    const next = normalizeBrushPresetV1({ ...current, revision: item.preset.revision + 1 });\n    return itemV1({\n      source: item.source,\n      baseline: item.baseline,\n      preset: next,\n      locked: item.locked,\n    });\n  });\n}\n\nexport function updateBrushPresetPressureFlowV1(\n  state: BrushPresetLibraryStateV1,\n  presetId: string,\n  enabled: boolean,\n): BrushPresetLibraryStateV1 {\n  return updateItemV1(state, presetId, (item) => {\n    if (item.locked) throw new Error('locked brush preset cannot be edited');\n    const current = withBrushPressureFlowEnabledV1(item.preset, enabled);\n    if (JSON.stringify(current) === JSON.stringify(item.preset)) return item;\n    const next = normalizeBrushPresetV1({ ...current, revision: item.preset.revision + 1 });\n    return itemV1({\n      source: item.source,\n      baseline: item.baseline,\n      preset: next,\n      locked: item.locked,\n    });\n  });\n}\n",
)

# Brush Properties/controller.
replace_once(
    'src/app/brush-preset-controller.ts',
    '  brushPressureOpacityEnabledV1,\n  BUILTIN_BRUSH_GRAIN_RESOURCES_V1,',
    '  brushPressureOpacityEnabledV1,\n  brushPressureFlowEnabledV1,\n  BUILTIN_BRUSH_GRAIN_RESOURCES_V1,',
)
replace_once(
    'src/app/brush-preset-controller.ts',
    '  updateBrushPresetPressureOpacityV1,\n  updateBrushPresetSpacingV1,',
    '  updateBrushPresetPressureOpacityV1,\n  updateBrushPresetPressureFlowV1,\n  updateBrushPresetSpacingV1,',
)
replace_once(
    'src/app/brush-preset-controller.ts',
    "  const pressureOpacityButton = requireElement('#brush-pressure-opacity', HTMLButtonElement);\n  const tipShape = requireElement",
    "  const pressureOpacityButton = requireElement('#brush-pressure-opacity', HTMLButtonElement);\n  const pressureFlowButton = requireElement('#brush-pressure-flow', HTMLButtonElement);\n  const tipShape = requireElement",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    '    const pressureOpacityEnabled = brushPressureOpacityEnabledV1(item.preset);\n    input.paintSession.setBrushPressureOpacityEnabled(pressureOpacityEnabled);\n    const tipAssets = brushTipAssetsV1(item.preset);',
    '    const pressureOpacityEnabled = brushPressureOpacityEnabledV1(item.preset);\n    input.paintSession.setBrushPressureOpacityEnabled(pressureOpacityEnabled);\n    const pressureFlowEnabled = brushPressureFlowEnabledV1(item.preset);\n    input.paintSession.setBrushPressureFlowEnabled(pressureFlowEnabled);\n    const tipAssets = brushTipAssetsV1(item.preset);',
)
replace_once(
    'src/app/brush-preset-controller.ts',
    '    input.root.dataset.illustroBrushPressureOpacity = String(pressureOpacityEnabled);\n    input.root.dataset.illustroBrushTipShape',
    '    input.root.dataset.illustroBrushPressureOpacity = String(pressureOpacityEnabled);\n    input.root.dataset.illustroBrushPressureFlow = String(pressureFlowEnabled);\n    input.root.dataset.illustroBrushTipShape',
)
replace_once(
    'src/app/brush-preset-controller.ts',
    "    const pressureOpacityEnabled = brushPressureOpacityEnabledV1(selected.preset);\n    pressureOpacityButton.textContent = pressureOpacityEnabled ? 'ON' : 'OFF';\n    pressureOpacityButton.setAttribute('aria-pressed', String(pressureOpacityEnabled));\n    tipShape.value",
    "    const pressureOpacityEnabled = brushPressureOpacityEnabledV1(selected.preset);\n    pressureOpacityButton.textContent = pressureOpacityEnabled ? 'ON' : 'OFF';\n    pressureOpacityButton.setAttribute('aria-pressed', String(pressureOpacityEnabled));\n    const pressureFlowEnabled = brushPressureFlowEnabledV1(selected.preset);\n    pressureFlowButton.textContent = pressureFlowEnabled ? 'ON' : 'OFF';\n    pressureFlowButton.setAttribute('aria-pressed', String(pressureFlowEnabled));\n    tipShape.value",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    "    const pressureOpacityLabel = pressureOpacityEnabled ? ' · P→Opacity' : '';\n    propertyStatus.textContent = `${parameters.sizePx.toFixed(1)} px · ${Math.round(parameters.opacity * 100)}% · ${Math.round(parameters.flow * 100)}% · H${Math.round(hardness * 100)}% · D${Math.round(tipDensity * 100)}% · S${Math.round(spacing.spacingRatio * 100)}% · A${Math.round(tipAngleDegrees)}° · F${Math.round(tipDirectionDegrees)}°${followRotation ? ' · Follow' : ''}${repeatLabel}${startLabel}${endLabel}${sizeTaperLabel}${opacityTaperLabel}${forcedTaperLabel}${stabilizationLabel}${postCorrectionLabel}${grainLabel}${paperLabel}${textureStrengthLabel}${textureScaleLabel}${textureRotationLabel}${textureBlendLabel}${pressureSizeLabel}${pressureOpacityLabel}`;",
    "    const pressureOpacityLabel = pressureOpacityEnabled ? ' · P→Opacity' : '';\n    const pressureFlowLabel = pressureFlowEnabled ? ' · P→Flow' : '';\n    propertyStatus.textContent = `${parameters.sizePx.toFixed(1)} px · ${Math.round(parameters.opacity * 100)}% · ${Math.round(parameters.flow * 100)}% · H${Math.round(hardness * 100)}% · D${Math.round(tipDensity * 100)}% · S${Math.round(spacing.spacingRatio * 100)}% · A${Math.round(tipAngleDegrees)}° · F${Math.round(tipDirectionDegrees)}°${followRotation ? ' · Follow' : ''}${repeatLabel}${startLabel}${endLabel}${sizeTaperLabel}${opacityTaperLabel}${forcedTaperLabel}${stabilizationLabel}${postCorrectionLabel}${grainLabel}${paperLabel}${textureStrengthLabel}${textureScaleLabel}${textureRotationLabel}${textureBlendLabel}${pressureSizeLabel}${pressureOpacityLabel}${pressureFlowLabel}`;",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    '      pressureSizeButton,\n      pressureOpacityButton,\n      tipShape,',
    '      pressureSizeButton,\n      pressureOpacityButton,\n      pressureFlowButton,\n      tipShape,',
)
replace_once(
    'src/app/brush-preset-controller.ts',
    "  const onPressureOpacity = (): void =>\n    mutate(() =>\n      updateBrushPresetPressureOpacityV1(\n        state,\n        state.selectedPresetId,\n        !brushPressureOpacityEnabledV1(selectedBrushPresetItemV1(state).preset),\n      ),\n    );\n  const onTipShape",
    "  const onPressureOpacity = (): void =>\n    mutate(() =>\n      updateBrushPresetPressureOpacityV1(\n        state,\n        state.selectedPresetId,\n        !brushPressureOpacityEnabledV1(selectedBrushPresetItemV1(state).preset),\n      ),\n    );\n  const onPressureFlow = (): void =>\n    mutate(() =>\n      updateBrushPresetPressureFlowV1(\n        state,\n        state.selectedPresetId,\n        !brushPressureFlowEnabledV1(selectedBrushPresetItemV1(state).preset),\n      ),\n    );\n  const onTipShape",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    "  pressureOpacityButton.addEventListener('click', onPressureOpacity);\n  tipShape.addEventListener",
    "  pressureOpacityButton.addEventListener('click', onPressureOpacity);\n  pressureFlowButton.addEventListener('click', onPressureFlow);\n  tipShape.addEventListener",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    "      pressureOpacityButton.removeEventListener('click', onPressureOpacity);\n      tipShape.removeEventListener",
    "      pressureOpacityButton.removeEventListener('click', onPressureOpacity);\n      pressureFlowButton.removeEventListener('click', onPressureFlow);\n      tipShape.removeEventListener",
)

replace_once(
    'src/index.html',
    '              <div class="shell-brush-property-row shell-brush-tip-property-row">\n                <label for="brush-pressure-opacity">筆圧→不透明度</label>\n                <button id="brush-pressure-opacity" type="button" aria-pressed="false" title="ペン筆圧をストローク不透明度上限へ反映">OFF</button>\n                <span class="shell-brush-tip-kind">Pressure</span>\n              </div>\n              <div class="shell-brush-property-row shell-brush-tip-property-row">\n                <label for="brush-tip-shape">ブラシ形状</label>',
    '              <div class="shell-brush-property-row shell-brush-tip-property-row">\n                <label for="brush-pressure-opacity">筆圧→不透明度</label>\n                <button id="brush-pressure-opacity" type="button" aria-pressed="false" title="ペン筆圧をストローク不透明度上限へ反映">OFF</button>\n                <span class="shell-brush-tip-kind">Pressure</span>\n              </div>\n              <div class="shell-brush-property-row shell-brush-tip-property-row">\n                <label for="brush-pressure-flow">筆圧→流量</label>\n                <button id="brush-pressure-flow" type="button" aria-pressed="false" title="ペン筆圧をブラシ流量へ反映">OFF</button>\n                <span class="shell-brush-tip-kind">Pressure</span>\n              </div>\n              <div class="shell-brush-property-row shell-brush-tip-property-row">\n                <label for="brush-tip-shape">ブラシ形状</label>',
)

Path('tests/unit/brush-pressure-flow.test.ts').write_text("""import { describe, expect, it } from 'vitest';
import {
  brushPressureFlowEnabledV1,
  createBaselineBrushPresetV1,
  withBrushPressureFlowEnabledV1,
} from '../../src/domain/brush-schema.js';
import { CanonicalRasterBrushStrokeV1 } from '../../src/app/canonical-raster-brush.js';
import { PaintSessionControllerV1 } from '../../src/app/paint-session-controller.js';
import { BaselineBrushDabBuilderV1 } from '../../src/gpu/baseline-brush.js';

class FakeRendererDocumentPort {
  async configureDocument(): Promise<void> {}
  async restoreBaselineStrokes(): Promise<void> {}
  async applyBaselineTilePatches(): Promise<void> {}
}

describe('M6A-043 pressure to flow', () => {
  it('is opt-in in preset data and keeps the legacy default disabled', () => {
    const preset = createBaselineBrushPresetV1({
      id: 'pressure.flow',
      name: 'Pressure Flow',
      category: 'Test',
      behavior: 'paint',
    });
    expect(brushPressureFlowEnabledV1(preset)).toBe(false);
    expect(brushPressureFlowEnabledV1(withBrushPressureFlowEnabledV1(preset, true))).toBe(true);
    expect(withBrushPressureFlowEnabledV1(preset, false).dynamics.pressureFlowEnabled).toBeUndefined();
  });

  it('linearly interpolates pressure into flow while preserving the opacity cap', () => {
    const builder = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      opacity: 0.75,
      flow: 0.8,
      spacingRatio: 0.25,
      minimumStampDistancePx: 1,
      pressureFlowEnabled: true,
    });
    builder.beginDelta({ documentX: 0, documentY: 0, pressure: 0.25 });
    builder.appendDelta([{ documentX: 10, documentY: 0, pressure: 1 }]);
    const dabs = builder.dabs();
    expect(dabs.map((dab) => dab.x)).toEqual([0, 5, 10]);
    expect(dabs.map((dab) => dab.flow)).toEqual([0.2, 0.5, 0.8]);
    expect(dabs.map((dab) => dab.strokeOpacity)).toEqual([0.75, 0.75, 0.75]);
  });

  it('keeps pressure flow and pressure opacity independent when both are enabled', () => {
    const builder = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      opacity: 0.6,
      flow: 0.8,
      pressureFlowEnabled: true,
      pressureOpacityEnabled: true,
    });
    const [dab] = builder.beginDelta({ documentX: 1, documentY: 1, pressure: 0.5 });
    expect(dab?.flow).toBe(0.4);
    expect(dab?.strokeOpacity).toBe(0.3);
    expect(dab?.radius).toBe(10);
  });

  it('forwards pressure flow through the canonical facade and captures runtime state', () => {
    const stroke = new CanonicalRasterBrushStrokeV1({
      flow: 0.8,
      opacity: 0.75,
      pressureFlowEnabled: true,
    });
    const [dab] = stroke.beginConfirmed({ documentX: 1, documentY: 1, pressure: 0.5 });
    expect(dab?.flow).toBe(0.4);
    expect(dab?.strokeOpacity).toBe(0.75);

    const session = new PaintSessionControllerV1(new FakeRendererDocumentPort());
    expect(session.setBrushPressureFlowEnabled(true)).toBe(true);
    expect(session.snapshot().brushPressureFlowEnabled).toBe(true);
  });
});
""")

replace_once(
    'IMPLEMENTATION_PROGRESS.md',
    'M6A-043 pressure→flow:未完了\nM6A-044 pressure response curve:未完了',
    'M6A-043 pressure→flow:完了\n再開メモ: M6A-043 pressure→flowはBrushPresetV1.dynamics.pressureFlowEnabledをopt-in booleanとして追加し、既定falseで既存strokeを互換維持する。有効時はM6A-041/042と同じPen raw pressureをlogical stamp位置へ距離比例補間し、base flow × taper deposit scale × pressureへ解決する。strokeOpacity capは変更しないためM6A-042とは独立し、Raster paintではflowが現在のeffective coverageからopacity capへ近づく速度だけを制御する。Mouseはneutral 1.0、primitive dabには既存flowへ解決済み値だけを保存するためrenderer/history schema追加は不要。pressure→size/opacity/flowを同時に有効化しても同一pressure scalarから各軸を独立解決する。次はM6A-044 pressure response curveから再開する。\nM6A-044 pressure response curve:未完了',
)
append_once(
    'ILLUSTRO_DESIGN_MEMO.md',
    '## M6A pressure-to-flow boundary — 2026-09-03',
    """## M6A pressure-to-flow boundary — 2026-09-03

- `dynamics.pressureFlowEnabled` is an opt-in boolean and defaults to false.
- Pressure-to-flow multiplies only per-stamp flow/deposit. It does not change the M6A-042 opacity cap and does not change M6A-041 size unless those mappings are separately enabled.
- The same distance-interpolated Pen pressure scalar is reused for size, opacity and flow so the three mappings stay deterministic and aligned at logical stamp positions. Mouse uses neutral pressure 1.0.
- Raster paint semantics remain: flow controls convergence speed toward the current effective opacity cap; opacity controls the cap. No new renderer state, primitive-dab field, Worker ABI or history schema is required.
- M6A-044 supplies a shared response curve before these independent mappings, while M6A-049/050 later bound the response. M6A-032 forced taper zero endpoints remain authoritative.
""",
)

replace_once(
    'scripts/verify-m6a-brush.mjs',
    "requireText(\n  progress,\n  'M6A-PERF-001 incremental active-stroke rendering（stable prefix + bounded mutable tail）:未完了',",
    "requireText(progress, 'M6A-043 pressure→flow:完了', 'M6A-043 progress is not complete');\nrequireText(\n  read('src/domain/brush-schema.ts'),\n  'brushPressureFlowEnabledV1',\n  'pressure-flow preset helper missing',\n);\nrequireText(\n  read('src/gpu/baseline-brush.ts'),\n  'this.#flow * opacityScale * pressureFlowScale',\n  'pressure is not resolved into per-dab flow',\n);\nrequireText(\n  read('src/app/paint-session-controller.ts'),\n  'setBrushPressureFlowEnabled',\n  'pressure-flow mapping is not connected to runtime state',\n);\nrequireText(\n  read('src/index.html'),\n  'id=\"brush-pressure-flow\"',\n  'reachable pressure-flow control missing',\n);\nrequireText(\n  read('tests/unit/brush-pressure-flow.test.ts'),\n  'keeps pressure flow and pressure opacity independent when both are enabled',\n  'pressure-flow independence regression missing',\n);\n\nrequireText(\n  progress,\n  'M6A-PERF-001 incremental active-stroke rendering（stable prefix + bounded mutable tail）:未完了',",
)
