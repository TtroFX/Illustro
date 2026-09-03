from pathlib import Path


def read(path: str) -> str:
    return Path(path).read_text(encoding='utf-8')


def write(path: str, content: str) -> None:
    Path(path).write_text(content, encoding='utf-8')


def replace_once(path: str, before: str, after: str) -> None:
    source = read(path)
    count = source.count(before)
    if count != 1:
        raise RuntimeError(f'{path}: expected exactly one replacement, found {count}')
    write(path, source.replace(before, after, 1))


def insert_before(path: str, marker: str, block: str) -> None:
    replace_once(path, marker, block.rstrip() + '\n' + marker)


def append_once(path: str, marker: str, block: str) -> None:
    source = read(path)
    if marker in source:
        return
    write(path, source.rstrip() + '\n\n' + block.strip() + '\n')


def write_new(path: str, content: str) -> None:
    target = Path(path)
    if target.exists():
        raise RuntimeError(f'{path}: already exists')
    target.write_text(content.strip() + '\n', encoding='utf-8')


# 1) Preset contract: hardness is a static 0..1 tip property with legacy-safe fallback.
insert_before(
    'src/domain/brush-schema.ts',
    'export function withBrushParameterValuesV1(',
    """export const DEFAULT_BRUSH_TIP_HARDNESS_V1 = 0.85 as const;

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

""",
)

# 2) Canonical dab contract: capture hardness per generated primitive dab.
replace_once(
    'src/gpu/baseline-brush.ts',
    "export const BASELINE_BRUSH_OPACITY = 1 as const;\n",
    "export const BASELINE_BRUSH_OPACITY = 1 as const;\nexport const BASELINE_BRUSH_HARDNESS = 0.85 as const;\n",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """  readonly strokeOpacity?: number;
  readonly tipShape?: BaselineBrushTipShapeV1;
""",
    """  readonly strokeOpacity?: number;
  readonly hardness?: number;
  readonly tipShape?: BaselineBrushTipShapeV1;
""",
)
insert_before(
    'src/gpu/baseline-brush.ts',
    'export function baselineDabUsesFlowOpacityV1(dab: BaselineBrushDabV1): boolean {',
    """export function baselineDabHardnessV1(dab: BaselineBrushDabV1): number {
  return dab.hardness ?? BASELINE_BRUSH_HARDNESS;
}

""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """  strokeOpacity: number,
  color: BaselineBrushColorV1,
  tipShape: Exclude<BaselineBrushTipShapeV1, 'sampled-image'>,
): BaselineBrushDabV1 {
""",
    """  strokeOpacity: number,
  hardness: number,
  color: BaselineBrushColorV1,
  tipShape: Exclude<BaselineBrushTipShapeV1, 'sampled-image'>,
): BaselineBrushDabV1 {
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """    flow,
    strokeOpacity,
    tipShape,
""",
    """    flow,
    strokeOpacity,
    hardness,
    tipShape,
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """  flow: number,
  strokeOpacity: number,
  color: BaselineBrushColorV1,
  tipShape: BaselineBrushTipShapeV1,
""",
    """  flow: number,
  strokeOpacity: number,
  hardness: number,
  color: BaselineBrushColorV1,
  tipShape: BaselineBrushTipShapeV1,
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """  if (tipShape !== 'sampled-image') {
    target.push(freezeDab(x, y, radius, flow, strokeOpacity, color, tipShape));
""",
    """  if (tipShape !== 'sampled-image') {
    target.push(freezeDab(x, y, radius, flow, strokeOpacity, hardness, color, tipShape));
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """        flow * (alphaByte / 255),
        strokeOpacity,
        color,
""",
    """        flow * (alphaByte / 255),
        strokeOpacity,
        hardness,
        color,
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """  readonly #flow: number;
  readonly #strokeOpacity: number;
  readonly #tipShape: BaselineBrushTipShapeV1;
""",
    """  readonly #flow: number;
  readonly #strokeOpacity: number;
  readonly #hardness: number;
  readonly #tipShape: BaselineBrushTipShapeV1;
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """      readonly flow?: number;
      readonly tipShape?: BaselineBrushTipShapeV1;
""",
    """      readonly flow?: number;
      readonly hardness?: number;
      readonly tipShape?: BaselineBrushTipShapeV1;
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """    const opacity = options.opacity ?? BASELINE_BRUSH_OPACITY;
    const flow = options.flow ?? 1;
""",
    """    const opacity = options.opacity ?? BASELINE_BRUSH_OPACITY;
    const flow = options.flow ?? 1;
    const hardness = options.hardness ?? BASELINE_BRUSH_HARDNESS;
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """    if (!Number.isFinite(flow) || flow < 0 || flow > 1) {
      throw new RangeError('baseline brush flow must be within 0..1');
    }
    this.#radius = sizePx / 2;
""",
    """    if (!Number.isFinite(flow) || flow < 0 || flow > 1) {
      throw new RangeError('baseline brush flow must be within 0..1');
    }
    if (!Number.isFinite(hardness) || hardness < 0 || hardness > 1) {
      throw new RangeError('baseline brush hardness must be within 0..1');
    }
    this.#radius = sizePx / 2;
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """    this.#flow = flow;
    this.#strokeOpacity = opacity;
    this.#tipShape = options.tipShape ?? 'round';
""",
    """    this.#flow = flow;
    this.#strokeOpacity = opacity;
    this.#hardness = hardness;
    this.#tipShape = options.tipShape ?? 'round';
""",
)
# Every logical stamp call passes the captured static hardness immediately after strokeOpacity.
source = read('src/gpu/baseline-brush.ts')
needle = """      this.#flow,
      this.#strokeOpacity,
      this.#color,
      this.#tipShape,
      this.#sampledTipAlpha,
"""
count = source.count(needle)
if count != 3:
    raise RuntimeError(f'src/gpu/baseline-brush.ts: expected 3 stamp calls, found {count}')
write(
    'src/gpu/baseline-brush.ts',
    source.replace(
        needle,
        """      this.#flow,
      this.#strokeOpacity,
      this.#hardness,
      this.#color,
      this.#tipShape,
      this.#sampledTipAlpha,
""",
    ),
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """      (dab.strokeOpacity !== undefined &&
        (!Number.isFinite(dab.strokeOpacity) || dab.strokeOpacity < 0 || dab.strokeOpacity > 1)) ||
      (dab.color !== undefined &&
""",
    """      (dab.strokeOpacity !== undefined &&
        (!Number.isFinite(dab.strokeOpacity) || dab.strokeOpacity < 0 || dab.strokeOpacity > 1)) ||
      (dab.hardness !== undefined &&
        (!Number.isFinite(dab.hardness) || dab.hardness < 0 || dab.hardness > 1)) ||
      (dab.color !== undefined &&
""",
)

# 3) Canonical Raster Tile coverage owns actual hardness semantics.
replace_once(
    'src/gpu/baseline-raster-tile-store.ts',
    """  baselineDabFlowV1,
  baselineDabRadiusXV1,
""",
    """  baselineDabFlowV1,
  baselineDabHardnessV1,
  baselineDabRadiusXV1,
""",
)
replace_once(
    'src/gpu/baseline-raster-tile-store.ts',
    'const BASELINE_BRUSH_HARDNESS = 0.85;\n\n',
    '',
)
replace_once(
    'src/gpu/baseline-raster-tile-store.ts',
    """  const distance = baselineProceduralTipDistanceV1(dab, localX, localY);
  if (distance >= 1) return 0;
  return distance <= BASELINE_BRUSH_HARDNESS
    ? 1
    : clamp01(1 - smoothstep(BASELINE_BRUSH_HARDNESS, 1, distance));
""",
    """  const distance = baselineProceduralTipDistanceV1(dab, localX, localY);
  if (distance >= 1) return 0;
  const hardness = baselineDabHardnessV1(dab);
  return distance <= hardness ? 1 : clamp01(1 - smoothstep(hardness, 1, distance));
""",
)

# 4) Existing direct WebGPU shader stays valid for legacy/default 0.85. Non-default hardness uses canonical preview.
replace_once(
    'src/gpu/baseline-paint-renderer.ts',
    """import {
  baselineDabColorV1,
  baselineDabFlowV1,
""",
    """import {
  BASELINE_BRUSH_HARDNESS,
  baselineDabColorV1,
  baselineDabFlowV1,
  baselineDabHardnessV1,
""",
)
replace_once(
    'src/gpu/baseline-paint-renderer.ts',
    """        ...(dab.strokeOpacity === undefined ? {} : { strokeOpacity: dab.strokeOpacity }),
        ...(dab.tipShape === undefined ? {} : { tipShape: dab.tipShape }),
""",
    """        ...(dab.strokeOpacity === undefined ? {} : { strokeOpacity: dab.strokeOpacity }),
        ...(dab.hardness === undefined ? {} : { hardness: dab.hardness }),
        ...(dab.tipShape === undefined ? {} : { tipShape: dab.tipShape }),
""",
)
replace_once(
    'src/gpu/baseline-paint-renderer.ts',
    """    (dab.strokeOpacity === undefined ||
      (Number.isFinite(dab.strokeOpacity) && dab.strokeOpacity >= 0 && dab.strokeOpacity <= 1)) &&
    (dab.tipShape === undefined || dab.tipShape === 'round' || dab.tipShape === 'square')
""",
    """    (dab.strokeOpacity === undefined ||
      (Number.isFinite(dab.strokeOpacity) && dab.strokeOpacity >= 0 && dab.strokeOpacity <= 1)) &&
    (dab.hardness === undefined ||
      (Number.isFinite(dab.hardness) && dab.hardness >= 0 && dab.hardness <= 1)) &&
    (dab.tipShape === undefined || dab.tipShape === 'round' || dab.tipShape === 'square')
""",
)
replace_once(
    'src/gpu/baseline-paint-renderer.ts',
    """    baselineDabStrokeOpacityV1(left) === baselineDabStrokeOpacityV1(right) &&
    (left.tipShape ?? 'round') === (right.tipShape ?? 'round') &&
""",
    """    baselineDabStrokeOpacityV1(left) === baselineDabStrokeOpacityV1(right) &&
    baselineDabHardnessV1(left) === baselineDabHardnessV1(right) &&
    (left.tipShape ?? 'round') === (right.tipShape ?? 'round') &&
""",
)
replace_once(
    'src/gpu/baseline-paint-renderer.ts',
    """    (dab) =>
      dab.tipShape === 'square' ||
      (baselineDabUsesFlowOpacityV1(dab) &&
""",
    """    (dab) =>
      dab.tipShape === 'square' ||
      baselineDabHardnessV1(dab) !== BASELINE_BRUSH_HARDNESS ||
      (baselineDabUsesFlowOpacityV1(dab) &&
""",
)

# 5) Canonical stroke facade + paint session capture hardness at stroke start and persist it on dabs.
replace_once(
    'src/app/canonical-raster-brush.ts',
    """      readonly opacity?: number;
      readonly flow?: number;
      readonly tipShape?: BaselineBrushTipShapeV1;
""",
    """      readonly opacity?: number;
      readonly flow?: number;
      readonly hardness?: number;
      readonly tipShape?: BaselineBrushTipShapeV1;
""",
)
replace_once(
    'src/app/canonical-raster-brush.ts',
    """      ...(options.flow === undefined ? {} : { flow: options.flow }),
      ...(options.tipShape === undefined ? {} : { tipShape: options.tipShape }),
""",
    """      ...(options.flow === undefined ? {} : { flow: options.flow }),
      ...(options.hardness === undefined ? {} : { hardness: options.hardness }),
      ...(options.tipShape === undefined ? {} : { tipShape: options.tipShape }),
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """import {
  DEFAULT_BASELINE_BRUSH_COLOR_V1,
""",
    """import {
  BASELINE_BRUSH_HARDNESS,
  DEFAULT_BASELINE_BRUSH_COLOR_V1,
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """  readonly brushParameters: BrushParameterValuesV1;
  readonly brushTipShape: BaselineBrushTipShapeV1;
""",
    """  readonly brushParameters: BrushParameterValuesV1;
  readonly brushHardness: number;
  readonly brushTipShape: BaselineBrushTipShapeV1;
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """  const strokeOpacity =
    value.strokeOpacity === undefined
      ? undefined
      : finiteNumber(value.strokeOpacity, 'baseline dab strokeOpacity');
  const tipShape = value.tipShape === undefined ? undefined : value.tipShape;
""",
    """  const strokeOpacity =
    value.strokeOpacity === undefined
      ? undefined
      : finiteNumber(value.strokeOpacity, 'baseline dab strokeOpacity');
  const hardness =
    value.hardness === undefined ? undefined : finiteNumber(value.hardness, 'baseline dab hardness');
  const tipShape = value.tipShape === undefined ? undefined : value.tipShape;
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """    (strokeOpacity !== undefined && (strokeOpacity < 0 || strokeOpacity > 1))
  ) {
""",
    """    (strokeOpacity !== undefined && (strokeOpacity < 0 || strokeOpacity > 1)) ||
    (hardness !== undefined && (hardness < 0 || hardness > 1))
  ) {
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """    ...(strokeOpacity === undefined ? {} : { strokeOpacity }),
    ...(tipShape === undefined ? {} : { tipShape }),
""",
    """    ...(strokeOpacity === undefined ? {} : { strokeOpacity }),
    ...(hardness === undefined ? {} : { hardness }),
    ...(tipShape === undefined ? {} : { tipShape }),
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """  #brushMode: CanonicalBrushModeV1 = 'raster';
  #brushParameters: BrushParameterValuesV1 = DEFAULT_BRUSH_PARAMETER_VALUES_V1;
  #brushTipShape: BaselineBrushTipShapeV1 = 'round';
""",
    """  #brushMode: CanonicalBrushModeV1 = 'raster';
  #brushParameters: BrushParameterValuesV1 = DEFAULT_BRUSH_PARAMETER_VALUES_V1;
  #brushHardness = BASELINE_BRUSH_HARDNESS;
  #brushTipShape: BaselineBrushTipShapeV1 = 'round';
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """      brushMode: this.#brushMode,
      brushParameters: this.#brushParameters,
      brushTipShape: this.#brushTipShape,
""",
    """      brushMode: this.#brushMode,
      brushParameters: this.#brushParameters,
      brushHardness: this.#brushHardness,
      brushTipShape: this.#brushTipShape,
""",
)
insert_before(
    'src/app/paint-session-controller.ts',
    '  setBrushTipShape(',
    """  setBrushHardness(hardness: number): number {
    if (!Number.isFinite(hardness) || hardness < 0 || hardness > 1) {
      throw new RangeError('invalid runtime brush hardness');
    }
    if (hardness !== this.#brushHardness) this.#clearActiveStroke();
    this.#brushHardness = hardness;
    return this.#brushHardness;
  }

  brushHardness(): number {
    return this.#brushHardness;
  }

""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """      opacity: parameters.opacity,
      flow: parameters.flow,
      tipShape: this.#brushTipShape,
""",
    """      opacity: parameters.opacity,
      flow: parameters.flow,
      hardness: this.#brushHardness,
      tipShape: this.#brushTipShape,
""",
)

# 6) Preset library and Inspector controls.
replace_once(
    'src/app/brush-preset-library.ts',
    """  normalizeBrushPresetV1,
  withBrushCustomSampledTipV1,
""",
    """  normalizeBrushPresetV1,
  withBrushCustomSampledTipV1,
  withBrushTipHardnessV1,
""",
)
insert_before(
    'src/app/brush-preset-library.ts',
    'export function updateBrushPresetCustomTipV1(',
    """export function updateBrushPresetHardnessV1(
  state: BrushPresetLibraryStateV1,
  presetId: string,
  hardness: number,
): BrushPresetLibraryStateV1 {
  return updateItemV1(state, presetId, (item) => {
    if (item.locked) throw new Error('locked brush preset cannot be edited');
    const current = withBrushTipHardnessV1(item.preset, hardness);
    if (JSON.stringify(current) === JSON.stringify(item.preset)) return item;
    const next = normalizeBrushPresetV1({ ...current, revision: item.preset.revision + 1 });
    return itemV1({ source: item.source, baseline: item.baseline, preset: next, locked: item.locked });
  });
}

""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  brushSampledTipAlphaV1,
  brushSelectedTipAssetIdV1,
""",
    """  brushSampledTipAlphaV1,
  brushSelectedTipAssetIdV1,
  brushTipHardnessV1,
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  updateBrushPresetCustomTipV1,
  updateBrushPresetParametersV1,
""",
    """  updateBrushPresetCustomTipV1,
  updateBrushPresetHardnessV1,
  updateBrushPresetParametersV1,
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  const flowRange = requireElement('#brush-flow-range', HTMLInputElement);
  const flowNumber = requireElement('#brush-flow-number', HTMLInputElement);
  const tipShape = requireElement('#brush-tip-shape', HTMLSelectElement);
""",
    """  const flowRange = requireElement('#brush-flow-range', HTMLInputElement);
  const flowNumber = requireElement('#brush-flow-number', HTMLInputElement);
  const hardnessRange = requireElement('#brush-hardness-range', HTMLInputElement);
  const hardnessNumber = requireElement('#brush-hardness-number', HTMLInputElement);
  const tipShape = requireElement('#brush-tip-shape', HTMLSelectElement);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    input.paintSession.setBrushMode(modeForBehavior(item.preset.behavior));
    input.paintSession.setBrushParameters(parameters);
    input.paintSession.setBrushTipShape(
""",
    """    input.paintSession.setBrushMode(modeForBehavior(item.preset.behavior));
    input.paintSession.setBrushParameters(parameters);
    input.paintSession.setBrushHardness(brushTipHardnessV1(item.preset));
    input.paintSession.setBrushTipShape(
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    input.root.dataset.illustroBrushFlow = String(parameters.flow);
    input.root.dataset.illustroBrushTipShape = brushTipShapeV1(item.preset);
""",
    """    input.root.dataset.illustroBrushFlow = String(parameters.flow);
    input.root.dataset.illustroBrushHardness = String(brushTipHardnessV1(item.preset));
    input.root.dataset.illustroBrushTipShape = brushTipShapeV1(item.preset);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    configurePair(flowRange, flowNumber, limits.flow.min, limits.flow.max, 0.01, parameters.flow);
    tipShape.value = brushTipShapeV1(selected.preset);
""",
    """    configurePair(flowRange, flowNumber, limits.flow.min, limits.flow.max, 0.01, parameters.flow);
    const hardness = brushTipHardnessV1(selected.preset);
    configurePair(hardnessRange, hardnessNumber, 0, 1, 0.01, hardness);
    tipShape.value = brushTipShapeV1(selected.preset);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    propertyStatus.textContent = `${parameters.sizePx.toFixed(1)} px · ${Math.round(parameters.opacity * 100)}% · ${Math.round(parameters.flow * 100)}%`;
""",
    """    propertyStatus.textContent = `${parameters.sizePx.toFixed(1)} px · ${Math.round(parameters.opacity * 100)}% · ${Math.round(parameters.flow * 100)}% · H${Math.round(hardness * 100)}%`;
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """      flowRange,
      flowNumber,
      tipShape,
""",
    """      flowRange,
      flowNumber,
      hardnessRange,
      hardnessNumber,
      tipShape,
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  const onFlowRange = (): void => updateParameter({ flow: Number(flowRange.value) });
  const onFlowNumber = (): void => updateParameter({ flow: Number(flowNumber.value) });
  const onTipShape = (): void => {
""",
    """  const onFlowRange = (): void => updateParameter({ flow: Number(flowRange.value) });
  const onFlowNumber = (): void => updateParameter({ flow: Number(flowNumber.value) });
  const updateHardness = (hardness: number): void =>
    mutate(() => updateBrushPresetHardnessV1(state, state.selectedPresetId, hardness));
  const onHardnessRange = (): void => updateHardness(Number(hardnessRange.value));
  const onHardnessNumber = (): void => updateHardness(Number(hardnessNumber.value));
  const onTipShape = (): void => {
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  flowRange.addEventListener('input', onFlowRange);
  flowNumber.addEventListener('change', onFlowNumber);
  tipShape.addEventListener('change', onTipShape);
""",
    """  flowRange.addEventListener('input', onFlowRange);
  flowNumber.addEventListener('change', onFlowNumber);
  hardnessRange.addEventListener('input', onHardnessRange);
  hardnessNumber.addEventListener('change', onHardnessNumber);
  tipShape.addEventListener('change', onTipShape);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """      flowRange.removeEventListener('input', onFlowRange);
      flowNumber.removeEventListener('change', onFlowNumber);
      tipShape.removeEventListener('change', onTipShape);
""",
    """      flowRange.removeEventListener('input', onFlowRange);
      flowNumber.removeEventListener('change', onFlowNumber);
      hardnessRange.removeEventListener('input', onHardnessRange);
      hardnessNumber.removeEventListener('change', onHardnessNumber);
      tipShape.removeEventListener('change', onTipShape);
""",
)

replace_once(
    'src/index.html',
    """              <div class="shell-brush-property-row">
                <label for="brush-flow-range">流量</label>
                <input id="brush-flow-range" type="range" min="0.01" max="1" step="0.01" value="1" />
                <span class="shell-brush-property-number shell-brush-property-percent"><input id="brush-flow-number" type="number" inputmode="decimal" min="0.01" max="1" step="0.01" value="1" aria-label="ブラシ流量数値" /><span>×</span></span>
              </div>
""",
    """              <div class="shell-brush-property-row">
                <label for="brush-flow-range">流量</label>
                <input id="brush-flow-range" type="range" min="0.01" max="1" step="0.01" value="1" />
                <span class="shell-brush-property-number shell-brush-property-percent"><input id="brush-flow-number" type="number" inputmode="decimal" min="0.01" max="1" step="0.01" value="1" aria-label="ブラシ流量数値" /><span>×</span></span>
              </div>
              <div class="shell-brush-property-row">
                <label for="brush-hardness-range">硬さ</label>
                <input id="brush-hardness-range" type="range" min="0" max="1" step="0.01" value="0.85" />
                <span class="shell-brush-property-number shell-brush-property-percent"><input id="brush-hardness-number" type="number" inputmode="decimal" min="0" max="1" step="0.01" value="0.85" aria-label="ブラシ硬さ数値" /><span>×</span></span>
              </div>
""",
)

# 7) Regression coverage: preset, dab capture, canonical edge, sampled primitives.
write_new(
    'tests/unit/brush-hardness.test.ts',
    """import { describe, expect, it } from 'vitest';
import {
  brushTipHardnessV1,
  createBaselineBrushPresetV1,
  withBrushTipHardnessV1,
} from '../../src/domain/brush-schema.js';
import { BaselineBrushDabBuilderV1 } from '../../src/gpu/baseline-brush.js';
import {
  BaselineRasterTileStoreV1,
  readBaselineRasterTilePixelV1,
} from '../../src/gpu/baseline-raster-tile-store.js';

describe('M6A-021 brush hardness', () => {
  it('reads existing baseline hardness and persists a static 0..1 preset value', () => {
    const paint = createBaselineBrushPresetV1({
      id: 'hardness.paint',
      name: 'Paint',
      category: 'Test',
      behavior: 'paint',
    });
    const blur = createBaselineBrushPresetV1({
      id: 'hardness.blur',
      name: 'Blur',
      category: 'Test',
      behavior: 'blur',
    });
    expect(brushTipHardnessV1(paint)).toBe(0.85);
    expect(brushTipHardnessV1(blur)).toBe(0.35);
    const soft = withBrushTipHardnessV1(paint, 0.2);
    expect(soft.schema).toBe('illustro.brush/1');
    expect(brushTipHardnessV1(soft)).toBe(0.2);
    expect(() => withBrushTipHardnessV1(paint, 1.01)).toThrow(RangeError);
  });

  it('captures hardness into every primitive dab, including sampled image micro dabs', () => {
    const round = new BaselineBrushDabBuilderV1({ sizePx: 16, hardness: 0.3 });
    round.begin({ documentX: 24, documentY: 24 });
    round.append([{ documentX: 36, documentY: 24 }]);
    expect(round.finish().every((dab) => dab.hardness === 0.3)).toBe(true);

    const sampled = new BaselineBrushDabBuilderV1({
      sizePx: 16,
      hardness: 0.1,
      tipShape: 'sampled-image',
    });
    expect(sampled.begin({ documentX: 24, documentY: 24 }).every((dab) => dab.hardness === 0.1)).toBe(
      true,
    );
  });

  it('softens the canonical tip edge while hardness 1 keeps full interior coverage', () => {
    const soft = new BaselineRasterTileStoreV1(64, 64, 'rgba8-unorm', [
      { layerId: 'layer', visible: true, opacity: 1 },
    ]);
    const hard = new BaselineRasterTileStoreV1(64, 64, 'rgba8-unorm', [
      { layerId: 'layer', visible: true, opacity: 1 },
    ]);
    const base = {
      schema: 'illustro.baseline-brush-dab/1' as const,
      x: 32,
      y: 32,
      radius: 10,
      opacity: 1,
      flow: 1,
      strokeOpacity: 1,
      tipShape: 'round' as const,
      color: [1, 0, 0] as const,
    };
    soft.applyDabs('layer', 'soft', [Object.freeze({ ...base, hardness: 0 })], 'paint');
    hard.applyDabs('layer', 'hard', [Object.freeze({ ...base, hardness: 1 })], 'paint');
    soft.finalize('soft');
    hard.finalize('hard');
    const softTile = soft.exportTiles()[0];
    const hardTile = hard.exportTiles()[0];
    if (softTile === undefined || hardTile === undefined) throw new Error('missing raster tile');
    const nearEdgePixel = 32 * softTile.width + 40;
    const softAlpha = readBaselineRasterTilePixelV1(softTile, nearEdgePixel)[3];
    const hardAlpha = readBaselineRasterTilePixelV1(hardTile, nearEdgePixel)[3];
    expect(softAlpha).toBeGreaterThan(0);
    expect(hardAlpha).toBeGreaterThan(softAlpha);
  });
});
""",
)

# 8) Verification + canonical documentation/progress.
insert_before(
    'scripts/verify-m6a-brush.mjs',
    """requireText(
  progress,
  'M6A-PERF-001 incremental active-stroke rendering（stable prefix + bounded mutable tail）:未完了',
""",
    """requireText(progress, 'M6A-021 hardness:完了', 'M6A-021 progress is not complete');
requireText(
  read('src/domain/brush-schema.ts'),
  'brushTipHardnessV1',
  'brush hardness preset helper missing',
);
requireText(
  read('src/gpu/baseline-raster-tile-store.ts'),
  'baselineDabHardnessV1',
  'canonical raster hardness coverage missing',
);
requireText(
  read('src/gpu/baseline-paint-renderer.ts'),
  'baselineDabHardnessV1(dab) !== BASELINE_BRUSH_HARDNESS',
  'non-default hardness canonical preview fallback missing',
);
requireText(
  read('src/index.html'),
  'id="brush-hardness-range"',
  'reachable brush hardness control missing',
);
requireText(
  read('tests/unit/brush-hardness.test.ts'),
  'softens the canonical tip edge',
  'brush hardness regression coverage missing',
);
""",
)
replace_once(
    'IMPLEMENTATION_PROGRESS.md',
    'M6A-021 hardness:未完了\nM6A-022 tip density:未完了',
    """M6A-021 hardness:完了
再開メモ: M6A-021 hardnessはtip.hardnessの0..1静的値をpreset正本として扱い、stroke開始時にcaptureして全primitive dabへ保存する。旧strokeでhardness未保存の場合は0.85へfallbackする。Canonical Raster Tileのedge coverageがhardness正本で、既存WebGPU shaderが持つ0.85 fast pathはdefault値だけ維持し、非default hardnessはcanonical previewへ切替えて表示と保存結果の不一致を避ける。sampled/custom tipのmicro dabにも同じhardnessを伝播する。次はM6A-022 tip densityから再開する。
M6A-022 tip density:未完了""",
)
append_once(
    'ILLUSTRO_DESIGN_MEMO.md',
    '#### M6A hardness boundary — 2026-09-03',
    """#### M6A hardness boundary — 2026-09-03

- M6A-021 defines static brush-tip hardness as a preset-local value in the closed range 0..1. Existing presets already carrying tip.hardness become authoritative without a schema-version fork; missing legacy values resolve to 0.85.
- Hardness is captured when a stroke begins and is persisted on each resolved primitive dab. Recovery and old stored strokes remain compatible because omitted dab hardness falls back to 0.85.
- Canonical Raster Tile coverage is authoritative: hardness 1 keeps full coverage throughout the interior, lower values move the smooth falloff inward. Round and square procedural primitives use the same normalized hardness contract, and sampled/custom tips propagate hardness to every alpha-weighted micro-dab.
- The existing direct WebGPU baseline shader encodes the historical 0.85 edge. It remains the fast path only for default hardness; any non-default hardness uses the existing canonical-tile preview path so presentation cannot diverge from History/Persistence/Export. This avoids prematurely expanding the renderer ABI solely for M6A-021.
- M6A-021 is a static preset property only. Pressure/dynamics modulation of hardness, tip density, spacing, and other stroke dynamics remain assigned to later M6A items.
""",
)

Path('.github/illustro-m6a021-patch.py').unlink()
Path('.github/workflows/illustro-m6a021-patch.yml').unlink()
