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


# Brush preset schema: opt-in pressure -> opacity mapping, default false.
replace_once(
    'src/domain/brush-schema.ts',
    "export const DEFAULT_BRUSH_PRESSURE_SIZE_ENABLED_V1 = false as const;\n\nexport function brushPressureSizeEnabledV1(preset: BrushPresetV1): boolean {\n  const value = preset.dynamics.pressureSizeEnabled;\n  return typeof value === 'boolean' ? value : DEFAULT_BRUSH_PRESSURE_SIZE_ENABLED_V1;\n}\n\nexport function withBrushPressureSizeEnabledV1(\n  preset: BrushPresetV1,\n  enabled: boolean,\n): BrushPresetV1 {\n  if (typeof enabled !== 'boolean') throw new TypeError('brush pressure size flag must be boolean');\n  if (enabled === DEFAULT_BRUSH_PRESSURE_SIZE_ENABLED_V1) {\n    const { pressureSizeEnabled: _pressureSizeEnabled, ...dynamics } = preset.dynamics;\n    return normalizeBrushPresetV1({ ...preset, dynamics });\n  }\n  return normalizeBrushPresetV1({\n    ...preset,\n    dynamics: { ...preset.dynamics, pressureSizeEnabled: enabled },\n  });\n}\n",
    "export const DEFAULT_BRUSH_PRESSURE_SIZE_ENABLED_V1 = false as const;\n\nexport function brushPressureSizeEnabledV1(preset: BrushPresetV1): boolean {\n  const value = preset.dynamics.pressureSizeEnabled;\n  return typeof value === 'boolean' ? value : DEFAULT_BRUSH_PRESSURE_SIZE_ENABLED_V1;\n}\n\nexport function withBrushPressureSizeEnabledV1(\n  preset: BrushPresetV1,\n  enabled: boolean,\n): BrushPresetV1 {\n  if (typeof enabled !== 'boolean') throw new TypeError('brush pressure size flag must be boolean');\n  if (enabled === DEFAULT_BRUSH_PRESSURE_SIZE_ENABLED_V1) {\n    const { pressureSizeEnabled: _pressureSizeEnabled, ...dynamics } = preset.dynamics;\n    return normalizeBrushPresetV1({ ...preset, dynamics });\n  }\n  return normalizeBrushPresetV1({\n    ...preset,\n    dynamics: { ...preset.dynamics, pressureSizeEnabled: enabled },\n  });\n}\n\nexport const DEFAULT_BRUSH_PRESSURE_OPACITY_ENABLED_V1 = false as const;\n\nexport function brushPressureOpacityEnabledV1(preset: BrushPresetV1): boolean {\n  const value = preset.dynamics.pressureOpacityEnabled;\n  return typeof value === 'boolean' ? value : DEFAULT_BRUSH_PRESSURE_OPACITY_ENABLED_V1;\n}\n\nexport function withBrushPressureOpacityEnabledV1(\n  preset: BrushPresetV1,\n  enabled: boolean,\n): BrushPresetV1 {\n  if (typeof enabled !== 'boolean') {\n    throw new TypeError('brush pressure opacity flag must be boolean');\n  }\n  if (enabled === DEFAULT_BRUSH_PRESSURE_OPACITY_ENABLED_V1) {\n    const { pressureOpacityEnabled: _pressureOpacityEnabled, ...dynamics } = preset.dynamics;\n    return normalizeBrushPresetV1({ ...preset, dynamics });\n  }\n  return normalizeBrushPresetV1({\n    ...preset,\n    dynamics: { ...preset.dynamics, pressureOpacityEnabled: enabled },\n  });\n}\n",
)

# Low-level dab builder: preserve flow/deposit and map pressure only to the opacity cap.
replace_once(
    'src/gpu/baseline-brush.ts',
    '  readonly #pressureSizeEnabled: boolean;\n  readonly #flow: number;',
    '  readonly #pressureSizeEnabled: boolean;\n  readonly #pressureOpacityEnabled: boolean;\n  readonly #flow: number;',
)
replace_once(
    'src/gpu/baseline-brush.ts',
    '      readonly pressureSizeEnabled?: boolean;\n      readonly hardness?: number;',
    '      readonly pressureSizeEnabled?: boolean;\n      readonly pressureOpacityEnabled?: boolean;\n      readonly hardness?: number;',
)
replace_once(
    'src/gpu/baseline-brush.ts',
    '    const pressureSizeEnabled = options.pressureSizeEnabled ?? false;\n    const hardness = options.hardness ?? BASELINE_BRUSH_HARDNESS;',
    '    const pressureSizeEnabled = options.pressureSizeEnabled ?? false;\n    const pressureOpacityEnabled = options.pressureOpacityEnabled ?? false;\n    const hardness = options.hardness ?? BASELINE_BRUSH_HARDNESS;',
)
replace_once(
    'src/gpu/baseline-brush.ts',
    "    if (typeof pressureSizeEnabled !== 'boolean') {\n      throw new TypeError('baseline brush pressure size flag must be boolean');\n    }\n    if (!Number.isFinite(hardness)",
    "    if (typeof pressureSizeEnabled !== 'boolean') {\n      throw new TypeError('baseline brush pressure size flag must be boolean');\n    }\n    if (typeof pressureOpacityEnabled !== 'boolean') {\n      throw new TypeError('baseline brush pressure opacity flag must be boolean');\n    }\n    if (!Number.isFinite(hardness)",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    '    this.#pressureSizeEnabled = pressureSizeEnabled;\n    this.#flow = flow;',
    '    this.#pressureSizeEnabled = pressureSizeEnabled;\n    this.#pressureOpacityEnabled = pressureOpacityEnabled;\n    this.#flow = flow;',
)
replace_once(
    'src/gpu/baseline-brush.ts',
    "    const pressureSizeScale = this.#pressureSizeEnabled ? stamp.pressure : 1;\n    if (sizeScale <= 0 || opacityScale <= 0 || pressureSizeScale <= 0) return;\n    pushBaselineBrushStampV1(\n      target,\n      stamp.x,\n      stamp.y,\n      this.#radius * sizeScale * pressureSizeScale,\n      this.#flow * opacityScale,\n      this.#strokeOpacity,",
    "    const pressureSizeScale = this.#pressureSizeEnabled ? stamp.pressure : 1;\n    const pressureOpacityScale = this.#pressureOpacityEnabled ? stamp.pressure : 1;\n    if (\n      sizeScale <= 0 ||\n      opacityScale <= 0 ||\n      pressureSizeScale <= 0 ||\n      pressureOpacityScale <= 0\n    ) {\n      return;\n    }\n    pushBaselineBrushStampV1(\n      target,\n      stamp.x,\n      stamp.y,\n      this.#radius * sizeScale * pressureSizeScale,\n      this.#flow * opacityScale,\n      this.#strokeOpacity * pressureOpacityScale,",
)

# Canonical facade forwards the independent opacity mapping flag.
replace_once(
    'src/app/canonical-raster-brush.ts',
    '      readonly pressureSizeEnabled?: boolean;\n      readonly hardness?: number;',
    '      readonly pressureSizeEnabled?: boolean;\n      readonly pressureOpacityEnabled?: boolean;\n      readonly hardness?: number;',
)
replace_once(
    'src/app/canonical-raster-brush.ts',
    "      ...(options.pressureSizeEnabled === undefined\n        ? {}\n        : { pressureSizeEnabled: options.pressureSizeEnabled }),\n      ...(options.hardness === undefined",
    "      ...(options.pressureSizeEnabled === undefined\n        ? {}\n        : { pressureSizeEnabled: options.pressureSizeEnabled }),\n      ...(options.pressureOpacityEnabled === undefined\n        ? {}\n        : { pressureOpacityEnabled: options.pressureOpacityEnabled }),\n      ...(options.hardness === undefined",
)

# Raster paint semantics: the existing coverage array stores effective stroke coverage.
# For a fixed cap this recurrence is algebraically identical to the previous rawCoverage*cap formula.
# For a varying cap it never rolls back pixels when pressure falls; flow remains the convergence rate.
replace_once(
    'src/gpu/baseline-raster-tile-store.ts',
    '  readonly paintCoverage: Map<string, Float32Array>;\n  paintStrokeOpacity: number | null;\n  lastSmudgeDab: BaselineBrushDabV1 | null;',
    '  readonly paintCoverage: Map<string, Float32Array>;\n  lastSmudgeDab: BaselineBrushDabV1 | null;',
)
replace_once(
    'src/gpu/baseline-raster-tile-store.ts',
    "    const deposit = clamp01(flow * coverage);\n    const previousCoverage = strokeCoverage[pixel] ?? 0;\n    const nextCoverage = previousCoverage + (1 - previousCoverage) * deposit;\n    strokeCoverage[pixel] = nextCoverage;\n    const previousEffective = clamp01(previousCoverage * strokeOpacity);\n    const nextEffective = clamp01(nextCoverage * strokeOpacity);\n    if (nextEffective <= previousEffective || previousEffective >= 1) return 0;\n    return clamp01((nextEffective - previousEffective) / (1 - previousEffective));",
    "    const deposit = clamp01(flow * coverage);\n    const previousEffective = strokeCoverage[pixel] ?? 0;\n    const availableOpacity = Math.max(0, strokeOpacity - previousEffective);\n    const nextEffective = clamp01(previousEffective + availableOpacity * deposit);\n    strokeCoverage[pixel] = nextEffective;\n    if (nextEffective <= previousEffective || previousEffective >= 1) return 0;\n    return clamp01((nextEffective - previousEffective) / (1 - previousEffective));",
)
replace_once(
    'src/gpu/baseline-raster-tile-store.ts',
    '        paintCoverage: new Map(),\n        paintStrokeOpacity: null,\n        lastSmudgeDab: null,',
    '        paintCoverage: new Map(),\n        lastSmudgeDab: null,',
)
replace_once(
    'src/gpu/baseline-raster-tile-store.ts',
    "      if (operation === 'paint' && plan.dabs.some(baselineDabUsesFlowOpacityV1)) {\n        const strokeOpacity = baselineDabStrokeOpacityV1(plan.dabs[0] ?? dabs[0]!);\n        if (this.#active.paintStrokeOpacity === null) {\n          this.#active.paintStrokeOpacity = strokeOpacity;\n        } else if (Math.abs(this.#active.paintStrokeOpacity - strokeOpacity) > 1e-9) {\n          throw new Error('active paint stroke changed opacity cap');\n        }\n        coverage =\n          this.#active.paintCoverage.get(key) ?? new Float32Array(tile.width * tile.height);\n        this.#active.paintCoverage.set(key, coverage);\n      }",
    "      if (operation === 'paint' && plan.dabs.some(baselineDabUsesFlowOpacityV1)) {\n        coverage =\n          this.#active.paintCoverage.get(key) ?? new Float32Array(tile.width * tile.height);\n        this.#active.paintCoverage.set(key, coverage);\n      }",
)

# PaintSession runtime state and stroke-start capture.
replace_once(
    'src/app/paint-session-controller.ts',
    '  readonly brushPressureSizeEnabled: boolean;\n  readonly brushTipAngleDegrees: number;',
    '  readonly brushPressureSizeEnabled: boolean;\n  readonly brushPressureOpacityEnabled: boolean;\n  readonly brushTipAngleDegrees: number;',
)
replace_once(
    'src/app/paint-session-controller.ts',
    "  #brushPressureSizeEnabled = false;\n  #brushTipAngleDegrees: number = BASELINE_BRUSH_TIP_ANGLE_DEGREES;",
    "  #brushPressureSizeEnabled = false;\n  #brushPressureOpacityEnabled = false;\n  #brushTipAngleDegrees: number = BASELINE_BRUSH_TIP_ANGLE_DEGREES;",
)
replace_once(
    'src/app/paint-session-controller.ts',
    '      brushPressureSizeEnabled: this.#brushPressureSizeEnabled,\n      brushTipAngleDegrees: this.#brushTipAngleDegrees,',
    '      brushPressureSizeEnabled: this.#brushPressureSizeEnabled,\n      brushPressureOpacityEnabled: this.#brushPressureOpacityEnabled,\n      brushTipAngleDegrees: this.#brushTipAngleDegrees,',
)
replace_once(
    'src/app/paint-session-controller.ts',
    "  brushPressureSizeEnabled(): boolean {\n    return this.#brushPressureSizeEnabled;\n  }\n\n  setBrushTipAngleDegrees",
    "  brushPressureSizeEnabled(): boolean {\n    return this.#brushPressureSizeEnabled;\n  }\n\n  setBrushPressureOpacityEnabled(enabled: boolean): boolean {\n    if (typeof enabled !== 'boolean') throw new TypeError('invalid runtime pressure-opacity flag');\n    if (enabled !== this.#brushPressureOpacityEnabled) this.#clearActiveStroke();\n    this.#brushPressureOpacityEnabled = enabled;\n    return this.#brushPressureOpacityEnabled;\n  }\n\n  brushPressureOpacityEnabled(): boolean {\n    return this.#brushPressureOpacityEnabled;\n  }\n\n  setBrushTipAngleDegrees",
)
replace_once(
    'src/app/paint-session-controller.ts',
    '        pressureSizeEnabled: this.#brushPressureSizeEnabled,\n        hardness: this.#brushHardness,',
    '        pressureSizeEnabled: this.#brushPressureSizeEnabled,\n        pressureOpacityEnabled: this.#brushPressureOpacityEnabled,\n        hardness: this.#brushHardness,',
)

# Preset library mutation plumbing.
replace_once(
    'src/app/brush-preset-library.ts',
    '  withBrushPressureSizeEnabledV1,\n  withBrushStrokeSpacingV1,',
    '  withBrushPressureSizeEnabledV1,\n  withBrushPressureOpacityEnabledV1,\n  withBrushStrokeSpacingV1,',
)
replace_once(
    'src/app/brush-preset-library.ts',
    "export function updateBrushPresetPressureSizeV1(\n  state: BrushPresetLibraryStateV1,\n  presetId: string,\n  enabled: boolean,\n): BrushPresetLibraryStateV1 {\n  return updateItemV1(state, presetId, (item) => {\n    if (item.locked) throw new Error('locked brush preset cannot be edited');\n    const current = withBrushPressureSizeEnabledV1(item.preset, enabled);\n    if (JSON.stringify(current) === JSON.stringify(item.preset)) return item;\n    const next = normalizeBrushPresetV1({ ...current, revision: item.preset.revision + 1 });\n    return itemV1({\n      source: item.source,\n      baseline: item.baseline,\n      preset: next,\n      locked: item.locked,\n    });\n  });\n}\n",
    "export function updateBrushPresetPressureSizeV1(\n  state: BrushPresetLibraryStateV1,\n  presetId: string,\n  enabled: boolean,\n): BrushPresetLibraryStateV1 {\n  return updateItemV1(state, presetId, (item) => {\n    if (item.locked) throw new Error('locked brush preset cannot be edited');\n    const current = withBrushPressureSizeEnabledV1(item.preset, enabled);\n    if (JSON.stringify(current) === JSON.stringify(item.preset)) return item;\n    const next = normalizeBrushPresetV1({ ...current, revision: item.preset.revision + 1 });\n    return itemV1({\n      source: item.source,\n      baseline: item.baseline,\n      preset: next,\n      locked: item.locked,\n    });\n  });\n}\n\nexport function updateBrushPresetPressureOpacityV1(\n  state: BrushPresetLibraryStateV1,\n  presetId: string,\n  enabled: boolean,\n): BrushPresetLibraryStateV1 {\n  return updateItemV1(state, presetId, (item) => {\n    if (item.locked) throw new Error('locked brush preset cannot be edited');\n    const current = withBrushPressureOpacityEnabledV1(item.preset, enabled);\n    if (JSON.stringify(current) === JSON.stringify(item.preset)) return item;\n    const next = normalizeBrushPresetV1({ ...current, revision: item.preset.revision + 1 });\n    return itemV1({\n      source: item.source,\n      baseline: item.baseline,\n      preset: next,\n      locked: item.locked,\n    });\n  });\n}\n",
)

# Brush Properties UI/controller.
replace_once(
    'src/app/brush-preset-controller.ts',
    '  brushPressureSizeEnabledV1,\n  BUILTIN_BRUSH_GRAIN_RESOURCES_V1,',
    '  brushPressureSizeEnabledV1,\n  brushPressureOpacityEnabledV1,\n  BUILTIN_BRUSH_GRAIN_RESOURCES_V1,',
)
replace_once(
    'src/app/brush-preset-controller.ts',
    '  updateBrushPresetPressureSizeV1,\n  updateBrushPresetSpacingV1,',
    '  updateBrushPresetPressureSizeV1,\n  updateBrushPresetPressureOpacityV1,\n  updateBrushPresetSpacingV1,',
)
replace_once(
    'src/app/brush-preset-controller.ts',
    "  const pressureSizeButton = requireElement('#brush-pressure-size', HTMLButtonElement);\n  const tipShape = requireElement",
    "  const pressureSizeButton = requireElement('#brush-pressure-size', HTMLButtonElement);\n  const pressureOpacityButton = requireElement('#brush-pressure-opacity', HTMLButtonElement);\n  const tipShape = requireElement",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    '    const pressureSizeEnabled = brushPressureSizeEnabledV1(item.preset);\n    input.paintSession.setBrushPressureSizeEnabled(pressureSizeEnabled);\n    const tipAssets = brushTipAssetsV1(item.preset);',
    '    const pressureSizeEnabled = brushPressureSizeEnabledV1(item.preset);\n    input.paintSession.setBrushPressureSizeEnabled(pressureSizeEnabled);\n    const pressureOpacityEnabled = brushPressureOpacityEnabledV1(item.preset);\n    input.paintSession.setBrushPressureOpacityEnabled(pressureOpacityEnabled);\n    const tipAssets = brushTipAssetsV1(item.preset);',
)
replace_once(
    'src/app/brush-preset-controller.ts',
    '    input.root.dataset.illustroBrushPressureSize = String(pressureSizeEnabled);\n    input.root.dataset.illustroBrushTipShape',
    '    input.root.dataset.illustroBrushPressureSize = String(pressureSizeEnabled);\n    input.root.dataset.illustroBrushPressureOpacity = String(pressureOpacityEnabled);\n    input.root.dataset.illustroBrushTipShape',
)
replace_once(
    'src/app/brush-preset-controller.ts',
    "    const pressureSizeEnabled = brushPressureSizeEnabledV1(selected.preset);\n    pressureSizeButton.textContent = pressureSizeEnabled ? 'ON' : 'OFF';\n    pressureSizeButton.setAttribute('aria-pressed', String(pressureSizeEnabled));\n    tipShape.value",
    "    const pressureSizeEnabled = brushPressureSizeEnabledV1(selected.preset);\n    pressureSizeButton.textContent = pressureSizeEnabled ? 'ON' : 'OFF';\n    pressureSizeButton.setAttribute('aria-pressed', String(pressureSizeEnabled));\n    const pressureOpacityEnabled = brushPressureOpacityEnabledV1(selected.preset);\n    pressureOpacityButton.textContent = pressureOpacityEnabled ? 'ON' : 'OFF';\n    pressureOpacityButton.setAttribute('aria-pressed', String(pressureOpacityEnabled));\n    tipShape.value",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    "    const pressureSizeLabel = pressureSizeEnabled ? ' · P→Size' : '';\n    propertyStatus.textContent = `${parameters.sizePx.toFixed(1)} px · ${Math.round(parameters.opacity * 100)}% · ${Math.round(parameters.flow * 100)}% · H${Math.round(hardness * 100)}% · D${Math.round(tipDensity * 100)}% · S${Math.round(spacing.spacingRatio * 100)}% · A${Math.round(tipAngleDegrees)}° · F${Math.round(tipDirectionDegrees)}°${followRotation ? ' · Follow' : ''}${repeatLabel}${startLabel}${endLabel}${sizeTaperLabel}${opacityTaperLabel}${forcedTaperLabel}${stabilizationLabel}${postCorrectionLabel}${grainLabel}${paperLabel}${textureStrengthLabel}${textureScaleLabel}${textureRotationLabel}${textureBlendLabel}${pressureSizeLabel}`;",
    "    const pressureSizeLabel = pressureSizeEnabled ? ' · P→Size' : '';\n    const pressureOpacityLabel = pressureOpacityEnabled ? ' · P→Opacity' : '';\n    propertyStatus.textContent = `${parameters.sizePx.toFixed(1)} px · ${Math.round(parameters.opacity * 100)}% · ${Math.round(parameters.flow * 100)}% · H${Math.round(hardness * 100)}% · D${Math.round(tipDensity * 100)}% · S${Math.round(spacing.spacingRatio * 100)}% · A${Math.round(tipAngleDegrees)}° · F${Math.round(tipDirectionDegrees)}°${followRotation ? ' · Follow' : ''}${repeatLabel}${startLabel}${endLabel}${sizeTaperLabel}${opacityTaperLabel}${forcedTaperLabel}${stabilizationLabel}${postCorrectionLabel}${grainLabel}${paperLabel}${textureStrengthLabel}${textureScaleLabel}${textureRotationLabel}${textureBlendLabel}${pressureSizeLabel}${pressureOpacityLabel}`;",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    '      textureBlendMode,\n      pressureSizeButton,\n      tipShape,',
    '      textureBlendMode,\n      pressureSizeButton,\n      pressureOpacityButton,\n      tipShape,',
)
replace_once(
    'src/app/brush-preset-controller.ts',
    "  const onPressureSize = (): void =>\n    mutate(() =>\n      updateBrushPresetPressureSizeV1(\n        state,\n        state.selectedPresetId,\n        !brushPressureSizeEnabledV1(selectedBrushPresetItemV1(state).preset),\n      ),\n    );\n  const onTipShape",
    "  const onPressureSize = (): void =>\n    mutate(() =>\n      updateBrushPresetPressureSizeV1(\n        state,\n        state.selectedPresetId,\n        !brushPressureSizeEnabledV1(selectedBrushPresetItemV1(state).preset),\n      ),\n    );\n  const onPressureOpacity = (): void =>\n    mutate(() =>\n      updateBrushPresetPressureOpacityV1(\n        state,\n        state.selectedPresetId,\n        !brushPressureOpacityEnabledV1(selectedBrushPresetItemV1(state).preset),\n      ),\n    );\n  const onTipShape",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    "  pressureSizeButton.addEventListener('click', onPressureSize);\n  tipShape.addEventListener",
    "  pressureSizeButton.addEventListener('click', onPressureSize);\n  pressureOpacityButton.addEventListener('click', onPressureOpacity);\n  tipShape.addEventListener",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    "      pressureSizeButton.removeEventListener('click', onPressureSize);\n      tipShape.removeEventListener",
    "      pressureSizeButton.removeEventListener('click', onPressureSize);\n      pressureOpacityButton.removeEventListener('click', onPressureOpacity);\n      tipShape.removeEventListener",
)

replace_once(
    'src/index.html',
    '              <div class="shell-brush-property-row shell-brush-tip-property-row">\n                <label for="brush-pressure-size">筆圧→サイズ</label>\n                <button id="brush-pressure-size" type="button" aria-pressed="false" title="ペン筆圧をブラシサイズへ反映">OFF</button>\n                <span class="shell-brush-tip-kind">Pressure</span>\n              </div>\n              <div class="shell-brush-property-row shell-brush-tip-property-row">\n                <label for="brush-tip-shape">ブラシ形状</label>',
    '              <div class="shell-brush-property-row shell-brush-tip-property-row">\n                <label for="brush-pressure-size">筆圧→サイズ</label>\n                <button id="brush-pressure-size" type="button" aria-pressed="false" title="ペン筆圧をブラシサイズへ反映">OFF</button>\n                <span class="shell-brush-tip-kind">Pressure</span>\n              </div>\n              <div class="shell-brush-property-row shell-brush-tip-property-row">\n                <label for="brush-pressure-opacity">筆圧→不透明度</label>\n                <button id="brush-pressure-opacity" type="button" aria-pressed="false" title="ペン筆圧をストローク不透明度上限へ反映">OFF</button>\n                <span class="shell-brush-tip-kind">Pressure</span>\n              </div>\n              <div class="shell-brush-property-row shell-brush-tip-property-row">\n                <label for="brush-tip-shape">ブラシ形状</label>',
)

# Regression coverage.
Path('tests/unit/brush-pressure-opacity.test.ts').write_text("""import { describe, expect, it } from 'vitest';
import {
  brushPressureOpacityEnabledV1,
  createBaselineBrushPresetV1,
  withBrushPressureOpacityEnabledV1,
} from '../../src/domain/brush-schema.js';
import { CanonicalRasterBrushStrokeV1 } from '../../src/app/canonical-raster-brush.js';
import { PaintSessionControllerV1 } from '../../src/app/paint-session-controller.js';
import {
  BaselineBrushDabBuilderV1,
  type BaselineBrushDabV1,
} from '../../src/gpu/baseline-brush.js';
import {
  BaselineRasterTileStoreV1,
  readBaselineRasterTilePixelV1,
} from '../../src/gpu/baseline-raster-tile-store.js';

class FakeRendererDocumentPort {
  async configureDocument(): Promise<void> {}
  async restoreBaselineStrokes(): Promise<void> {}
  async applyBaselineTilePatches(): Promise<void> {}
}

const layers = Object.freeze([Object.freeze({ layerId: 'layer-a', visible: true, opacity: 1 })]);

function paintDab(strokeOpacity: number, flow = 0.5): BaselineBrushDabV1 {
  return Object.freeze({
    schema: 'illustro.baseline-brush-dab/1' as const,
    x: 32,
    y: 32,
    radius: 8,
    opacity: flow * strokeOpacity,
    flow,
    strokeOpacity,
    hardness: 1,
    tipDensity: 1,
    tipShape: 'round' as const,
  });
}

function centerAlpha(store: BaselineRasterTileStoreV1): number {
  const tile = store.exportTiles()[0];
  if (tile === undefined) return 0;
  return readBaselineRasterTilePixelV1(tile, 32 * tile.width + 32)[3];
}

describe('M6A-042 pressure to opacity', () => {
  it('is opt-in in preset data and keeps the legacy default disabled', () => {
    const preset = createBaselineBrushPresetV1({
      id: 'pressure.opacity',
      name: 'Pressure Opacity',
      category: 'Test',
      behavior: 'paint',
    });
    expect(brushPressureOpacityEnabledV1(preset)).toBe(false);
    expect(brushPressureOpacityEnabledV1(withBrushPressureOpacityEnabledV1(preset, true))).toBe(
      true,
    );
    expect(
      withBrushPressureOpacityEnabledV1(preset, false).dynamics.pressureOpacityEnabled,
    ).toBeUndefined();
  });

  it('interpolates pressure into the opacity cap without changing flow', () => {
    const builder = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      opacity: 0.8,
      flow: 0.25,
      spacingRatio: 0.25,
      minimumStampDistancePx: 1,
      pressureOpacityEnabled: true,
    });
    builder.beginDelta({ documentX: 0, documentY: 0, pressure: 0.25 });
    builder.appendDelta([{ documentX: 10, documentY: 0, pressure: 1 }]);
    const dabs = builder.dabs();
    expect(dabs.map((dab) => dab.x)).toEqual([0, 5, 10]);
    expect(dabs.map((dab) => dab.flow)).toEqual([0.25, 0.25, 0.25]);
    expect(dabs.map((dab) => dab.strokeOpacity)).toEqual([0.2, 0.5, 0.8]);
  });

  it('keeps opacity as a monotonic cap while flow controls convergence rate', () => {
    const store = new BaselineRasterTileStoreV1(128, 128, 'rgba8-unorm', layers);
    store.applyDabs('layer-a', 'stroke-variable-opacity', [paintDab(0.8)]);
    const first = centerAlpha(store);
    expect(first).toBeCloseTo(0.4, 2);

    store.applyDabs('layer-a', 'stroke-variable-opacity', [paintDab(0.2)]);
    const afterLowerPressure = centerAlpha(store);
    expect(afterLowerPressure).toBeCloseTo(first, 4);

    store.applyDabs('layer-a', 'stroke-variable-opacity', [paintDab(1)]);
    const afterHigherPressure = centerAlpha(store);
    expect(afterHigherPressure).toBeCloseTo(0.7, 2);
    expect(afterHigherPressure).toBeGreaterThan(afterLowerPressure);
  });

  it('keeps the fixed-opacity recurrence compatible and captures the runtime flag', () => {
    const store = new BaselineRasterTileStoreV1(128, 128, 'rgba8-unorm', layers);
    store.applyDabs('layer-a', 'stroke-fixed-opacity', [paintDab(0.8), paintDab(0.8)]);
    expect(centerAlpha(store)).toBeCloseTo(0.6, 2);

    const stroke = new CanonicalRasterBrushStrokeV1({
      opacity: 0.8,
      flow: 0.25,
      pressureOpacityEnabled: true,
    });
    const [dab] = stroke.beginConfirmed({ documentX: 1, documentY: 1, pressure: 0.5 });
    expect(dab?.flow).toBe(0.25);
    expect(dab?.strokeOpacity).toBe(0.4);

    const session = new PaintSessionControllerV1(new FakeRendererDocumentPort());
    expect(session.setBrushPressureOpacityEnabled(true)).toBe(true);
    expect(session.snapshot().brushPressureOpacityEnabled).toBe(true);
  });
});
""")

# Progress and canonical design boundary.
replace_once(
    'IMPLEMENTATION_PROGRESS.md',
    'M6A-042 pressure→opacity:未完了\nM6A-043 pressure→flow:未完了',
    'M6A-042 pressure→opacity:完了\n再開メモ: M6A-042 pressure→opacityはBrushPresetV1.dynamics.pressureOpacityEnabledをopt-in booleanとして追加し、既定falseで既存strokeを互換維持する。有効時はM6A-041と同じPen raw pressure 0..1をlogical stamp位置へ距離比例補間し、base strokeOpacity cap × pressureへ解決する一方、per-dab flow/depositは変更しない。Raster paintのcoverage累積は固定opacityで従来式と代数的に等価なeffectiveNext = effectivePrev + max(0, opacityCap-effectivePrev) × depositへ整理し、pressure低下で既描画alphaを巻き戻さず、pressure上昇時はflowで新しいcapへ収束する。追加per-tile bufferは不要。Mouseはpressure mapping上1.0、primitive dabは既存strokeOpacityへ解決済み値を保存するためdab/history schema追加はない。次はM6A-043 pressure→flowから再開する。\nM6A-043 pressure→flow:未完了',
)
append_once(
    'ILLUSTRO_DESIGN_MEMO.md',
    '## M6A pressure-to-opacity boundary — 2026-09-03',
    """## M6A pressure-to-opacity boundary — 2026-09-03

- `dynamics.pressureOpacityEnabled` is opt-in and defaults to false; legacy presets therefore retain the previous fixed opacity-cap behavior.
- Pressure-to-opacity changes the resolved per-stamp **opacity cap**, not flow. Flow/deposit remains the convergence rate toward that cap and is reserved for M6A-043 pressure→flow.
- Pen raw pressure is associated with stabilized geometry and distance-interpolated at logical stamp positions by the same M6A-041 pressure path. Mouse contributes a neutral pressure factor of 1.0.
- Canonical Raster paint stores effective stroke coverage per pixel. For fixed opacity the recurrence `E_next = E_prev + (O - E_prev) * deposit` is algebraically identical to the previous raw-coverage-times-opacity result. With a varying cap it uses `max(0, O - E_prev)` so lowering pressure never erases or rolls back already committed alpha.
- No second per-tile pressure buffer is allocated. Primitive dabs retain only the already-existing resolved `strokeOpacity`, preserving Worker/history/recovery schema compactness.
- M6A-044 pressure response curve and M6A-049/050 response bounds extend the shared pressure scalar later; they must not make M6A-032 forced zero endpoints non-zero.
""",
)

# M6A contract verifier.
replace_once(
    'scripts/verify-m6a-brush.mjs',
    "requireText(\n  progress,\n  'M6A-PERF-001 incremental active-stroke rendering（stable prefix + bounded mutable tail）:未完了',",
    "requireText(progress, 'M6A-042 pressure→opacity:完了', 'M6A-042 progress is not complete');\nrequireText(\n  read('src/domain/brush-schema.ts'),\n  'brushPressureOpacityEnabledV1',\n  'pressure-opacity preset helper missing',\n);\nrequireText(\n  read('src/gpu/baseline-brush.ts'),\n  'this.#strokeOpacity * pressureOpacityScale',\n  'pressure is not resolved into the opacity cap',\n);\nrequireText(\n  read('src/gpu/baseline-raster-tile-store.ts'),\n  'const availableOpacity = Math.max(0, strokeOpacity - previousEffective);',\n  'variable opacity cap is not monotonic in canonical raster coverage',\n);\nrequireText(\n  read('src/app/paint-session-controller.ts'),\n  'setBrushPressureOpacityEnabled',\n  'pressure-opacity mapping is not connected to runtime state',\n);\nrequireText(\n  read('src/index.html'),\n  'id=\"brush-pressure-opacity\"',\n  'reachable pressure-opacity control missing',\n);\nrequireText(\n  read('tests/unit/brush-pressure-opacity.test.ts'),\n  'keeps opacity as a monotonic cap while flow controls convergence rate',\n  'pressure-opacity raster regression missing',\n);\n\nrequireText(\n  progress,\n  'M6A-PERF-001 incremental active-stroke rendering（stable prefix + bounded mutable tail）:未完了',",
)
