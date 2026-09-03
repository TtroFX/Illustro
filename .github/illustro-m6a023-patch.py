from pathlib import Path


def read(path: str) -> str:
    return Path(path).read_text(encoding='utf-8')


def write(path: str, content: str) -> None:
    Path(path).write_text(content, encoding='utf-8')


def replace_once(path: str, before: str, after: str) -> None:
    source = read(path)
    count = source.count(before)
    if count != 1:
        raise RuntimeError(f'{path}: expected exactly one replacement, found {count}: {before[:120]!r}')
    write(path, source.replace(before, after, 1))


def insert_before(path: str, marker: str, block: str) -> None:
    replace_once(path, marker, block.rstrip() + '\n\n' + marker)


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


# Domain preset spacing contract.
insert_before(
    'src/domain/brush-schema.ts',
    'export function withBrushParameterValuesV1(',
    """export const DEFAULT_BRUSH_SPACING_RATIO_V1 = 0.25 as const;
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
    typeof rawMinimum === 'number' && Number.isFinite(rawMinimum) && rawMinimum > 0 && rawMinimum <= 4096
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
}""",
)

# Low-level deterministic spacing kernel.
replace_once(
    'src/gpu/baseline-brush.ts',
    'export const BASELINE_BRUSH_SPACING_PX = 4 as const;\n',
    """export const BASELINE_BRUSH_SPACING_PX = 4 as const;
export const BASELINE_BRUSH_SPACING_RATIO = 0.25 as const;
export const BASELINE_BRUSH_MINIMUM_STAMP_DISTANCE_PX = 1 as const;
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """      readonly flow?: number;
      readonly hardness?: number;
      readonly tipDensity?: number;
""",
    """      readonly flow?: number;
      readonly spacingRatio?: number;
      readonly minimumStampDistancePx?: number;
      readonly hardness?: number;
      readonly tipDensity?: number;
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """    const flow = options.flow ?? 1;
    const hardness = options.hardness ?? BASELINE_BRUSH_HARDNESS;
""",
    """    const flow = options.flow ?? 1;
    const spacingRatio = options.spacingRatio ?? BASELINE_BRUSH_SPACING_RATIO;
    const minimumStampDistancePx =
      options.minimumStampDistancePx ?? BASELINE_BRUSH_MINIMUM_STAMP_DISTANCE_PX;
    const hardness = options.hardness ?? BASELINE_BRUSH_HARDNESS;
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """    if (!Number.isFinite(flow) || flow < 0 || flow > 1) {
      throw new RangeError('baseline brush flow must be within 0..1');
    }
    if (!Number.isFinite(hardness) || hardness < 0 || hardness > 1) {
""",
    """    if (!Number.isFinite(flow) || flow < 0 || flow > 1) {
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
    if (!Number.isFinite(hardness) || hardness < 0 || hardness > 1) {
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    '    this.#spacing = Math.max(0.25, sizePx * 0.25);\n',
    '    this.#spacing = Math.max(minimumStampDistancePx, sizePx * spacingRatio);\n',
)

# Canonical stroke passes static spacing to the kernel.
replace_once(
    'src/app/canonical-raster-brush.ts',
    """      readonly flow?: number;
      readonly hardness?: number;
""",
    """      readonly flow?: number;
      readonly spacingRatio?: number;
      readonly minimumStampDistancePx?: number;
      readonly hardness?: number;
""",
)
replace_once(
    'src/app/canonical-raster-brush.ts',
    """      ...(options.flow === undefined ? {} : { flow: options.flow }),
      ...(options.hardness === undefined ? {} : { hardness: options.hardness }),
""",
    """      ...(options.flow === undefined ? {} : { flow: options.flow }),
      ...(options.spacingRatio === undefined ? {} : { spacingRatio: options.spacingRatio }),
      ...(options.minimumStampDistancePx === undefined
        ? {}
        : { minimumStampDistancePx: options.minimumStampDistancePx }),
      ...(options.hardness === undefined ? {} : { hardness: options.hardness }),
""",
)

# Session captures spacing at stroke start. Final dab positions remain history/persistence truth.
replace_once(
    'src/app/paint-session-controller.ts',
    """  BASELINE_BRUSH_HARDNESS,
  BASELINE_BRUSH_TIP_DENSITY,
""",
    """  BASELINE_BRUSH_HARDNESS,
  BASELINE_BRUSH_MINIMUM_STAMP_DISTANCE_PX,
  BASELINE_BRUSH_SPACING_RATIO,
  BASELINE_BRUSH_TIP_DENSITY,
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """  readonly brushTipDensity: number;
  readonly brushTipShape: BaselineBrushTipShapeV1;
""",
    """  readonly brushTipDensity: number;
  readonly brushSpacingRatio: number;
  readonly brushMinimumStampDistancePx: number;
  readonly brushTipShape: BaselineBrushTipShapeV1;
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """  #brushTipDensity: number = BASELINE_BRUSH_TIP_DENSITY;
  #brushTipShape: BaselineBrushTipShapeV1 = 'round';
""",
    """  #brushTipDensity: number = BASELINE_BRUSH_TIP_DENSITY;
  #brushSpacingRatio: number = BASELINE_BRUSH_SPACING_RATIO;
  #brushMinimumStampDistancePx: number = BASELINE_BRUSH_MINIMUM_STAMP_DISTANCE_PX;
  #brushTipShape: BaselineBrushTipShapeV1 = 'round';
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """      brushTipDensity: this.#brushTipDensity,
      brushTipShape: this.#brushTipShape,
""",
    """      brushTipDensity: this.#brushTipDensity,
      brushSpacingRatio: this.#brushSpacingRatio,
      brushMinimumStampDistancePx: this.#brushMinimumStampDistancePx,
      brushTipShape: this.#brushTipShape,
""",
)
insert_before(
    'src/app/paint-session-controller.ts',
    '  setBrushTipShape(',
    """  setBrushSpacing(spacingRatio: number, minimumStampDistancePx: number): number {
    if (!Number.isFinite(spacingRatio) || spacingRatio < 0.01 || spacingRatio > 4) {
      throw new RangeError('invalid runtime brush spacing ratio');
    }
    if (
      !Number.isFinite(minimumStampDistancePx) ||
      minimumStampDistancePx <= 0 ||
      minimumStampDistancePx > 4096
    ) {
      throw new RangeError('invalid runtime minimum stamp distance');
    }
    if (
      spacingRatio !== this.#brushSpacingRatio ||
      minimumStampDistancePx !== this.#brushMinimumStampDistancePx
    ) {
      this.#clearActiveStroke();
    }
    this.#brushSpacingRatio = spacingRatio;
    this.#brushMinimumStampDistancePx = minimumStampDistancePx;
    return this.#brushSpacingRatio;
  }

  brushSpacingRatio(): number {
    return this.#brushSpacingRatio;
  }""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """      flow: parameters.flow,
      hardness: this.#brushHardness,
""",
    """      flow: parameters.flow,
      spacingRatio: this.#brushSpacingRatio,
      minimumStampDistancePx: this.#brushMinimumStampDistancePx,
      hardness: this.#brushHardness,
""",
)

# Preset library mutation.
replace_once(
    'src/app/brush-preset-library.ts',
    """  withBrushTipDensityV1,
  withBrushTipAssetAddedV1,
""",
    """  withBrushTipDensityV1,
  withBrushStrokeSpacingV1,
  withBrushTipAssetAddedV1,
""",
)
insert_before(
    'src/app/brush-preset-library.ts',
    'export function updateBrushPresetCustomTipV1(',
    """export function updateBrushPresetSpacingV1(
  state: BrushPresetLibraryStateV1,
  presetId: string,
  spacingRatio: number,
): BrushPresetLibraryStateV1 {
  return updateItemV1(state, presetId, (item) => {
    if (item.locked) throw new Error('locked brush preset cannot be edited');
    const current = withBrushStrokeSpacingV1(item.preset, spacingRatio);
    if (JSON.stringify(current) === JSON.stringify(item.preset)) return item;
    const next = normalizeBrushPresetV1({ ...current, revision: item.preset.revision + 1 });
    return itemV1({
      source: item.source,
      baseline: item.baseline,
      preset: next,
      locked: item.locked,
    });
  });
}""",
)

# Reachable Tool Properties UI and preset/session binding.
replace_once(
    'src/app/brush-preset-controller.ts',
    """  brushTipDensityV1,
  brushTipAssetsV1,
""",
    """  brushTipDensityV1,
  brushStrokeSpacingV1,
  brushTipAssetsV1,
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  updateBrushPresetTipDensityV1,
  updateBrushPresetParametersV1,
""",
    """  updateBrushPresetTipDensityV1,
  updateBrushPresetSpacingV1,
  updateBrushPresetParametersV1,
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  const tipDensityRange = requireElement('#brush-tip-density-range', HTMLInputElement);
  const tipDensityNumber = requireElement('#brush-tip-density-number', HTMLInputElement);
  const tipShape = requireElement('#brush-tip-shape', HTMLSelectElement);
""",
    """  const tipDensityRange = requireElement('#brush-tip-density-range', HTMLInputElement);
  const tipDensityNumber = requireElement('#brush-tip-density-number', HTMLInputElement);
  const spacingRange = requireElement('#brush-spacing-range', HTMLInputElement);
  const spacingNumber = requireElement('#brush-spacing-number', HTMLInputElement);
  const tipShape = requireElement('#brush-tip-shape', HTMLSelectElement);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    input.paintSession.setBrushTipDensity(brushTipDensityV1(item.preset));
    input.paintSession.setBrushTipShape(
""",
    """    input.paintSession.setBrushTipDensity(brushTipDensityV1(item.preset));
    const spacing = brushStrokeSpacingV1(item.preset);
    input.paintSession.setBrushSpacing(spacing.spacingRatio, spacing.minimumStampDistancePx);
    input.paintSession.setBrushTipShape(
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    input.root.dataset.illustroBrushTipDensity = String(brushTipDensityV1(item.preset));
    input.root.dataset.illustroBrushTipShape = brushTipShapeV1(item.preset);
""",
    """    input.root.dataset.illustroBrushTipDensity = String(brushTipDensityV1(item.preset));
    input.root.dataset.illustroBrushSpacingRatio = String(spacing.spacingRatio);
    input.root.dataset.illustroBrushTipShape = brushTipShapeV1(item.preset);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    const tipDensity = brushTipDensityV1(selected.preset);
    configurePair(tipDensityRange, tipDensityNumber, 0, 1, 0.01, tipDensity);
    tipShape.value = brushTipShapeV1(selected.preset);
""",
    """    const tipDensity = brushTipDensityV1(selected.preset);
    configurePair(tipDensityRange, tipDensityNumber, 0, 1, 0.01, tipDensity);
    const spacing = brushStrokeSpacingV1(selected.preset);
    configurePair(spacingRange, spacingNumber, 1, 400, 1, spacing.spacingRatio * 100);
    tipShape.value = brushTipShapeV1(selected.preset);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    propertyStatus.textContent = `${parameters.sizePx.toFixed(1)} px · ${Math.round(parameters.opacity * 100)}% · ${Math.round(parameters.flow * 100)}% · H${Math.round(hardness * 100)}% · D${Math.round(tipDensity * 100)}%`;
""",
    """    propertyStatus.textContent = `${parameters.sizePx.toFixed(1)} px · ${Math.round(parameters.opacity * 100)}% · ${Math.round(parameters.flow * 100)}% · H${Math.round(hardness * 100)}% · D${Math.round(tipDensity * 100)}% · S${Math.round(spacing.spacingRatio * 100)}%`;
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """      tipDensityRange,
      tipDensityNumber,
      tipShape,
""",
    """      tipDensityRange,
      tipDensityNumber,
      spacingRange,
      spacingNumber,
      tipShape,
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  const onTipDensityRange = (): void => updateTipDensity(Number(tipDensityRange.value));
  const onTipDensityNumber = (): void => updateTipDensity(Number(tipDensityNumber.value));
  const onTipShape = (): void => {
""",
    """  const onTipDensityRange = (): void => updateTipDensity(Number(tipDensityRange.value));
  const onTipDensityNumber = (): void => updateTipDensity(Number(tipDensityNumber.value));
  const updateSpacing = (percent: number): void =>
    mutate(() => updateBrushPresetSpacingV1(state, state.selectedPresetId, percent / 100));
  const onSpacingRange = (): void => updateSpacing(Number(spacingRange.value));
  const onSpacingNumber = (): void => updateSpacing(Number(spacingNumber.value));
  const onTipShape = (): void => {
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  tipDensityRange.addEventListener('input', onTipDensityRange);
  tipDensityNumber.addEventListener('change', onTipDensityNumber);
  tipShape.addEventListener('change', onTipShape);
""",
    """  tipDensityRange.addEventListener('input', onTipDensityRange);
  tipDensityNumber.addEventListener('change', onTipDensityNumber);
  spacingRange.addEventListener('input', onSpacingRange);
  spacingNumber.addEventListener('change', onSpacingNumber);
  tipShape.addEventListener('change', onTipShape);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """      tipDensityRange.removeEventListener('input', onTipDensityRange);
      tipDensityNumber.removeEventListener('change', onTipDensityNumber);
      tipShape.removeEventListener('change', onTipShape);
""",
    """      tipDensityRange.removeEventListener('input', onTipDensityRange);
      tipDensityNumber.removeEventListener('change', onTipDensityNumber);
      spacingRange.removeEventListener('input', onSpacingRange);
      spacingNumber.removeEventListener('change', onSpacingNumber);
      tipShape.removeEventListener('change', onTipShape);
""",
)

replace_once(
    'src/index.html',
    """              <div class="shell-brush-property-row">
                <label for="brush-tip-density-range">先端密度</label>
                <input id="brush-tip-density-range" type="range" min="0" max="1" step="0.01" value="1" />
                <span class="shell-brush-property-number shell-brush-property-percent"><input id="brush-tip-density-number" type="number" inputmode="decimal" min="0" max="1" step="0.01" value="1" aria-label="ブラシ先端密度数値" /><span>×</span></span>
              </div>
              <div class="shell-brush-property-row shell-brush-tip-property-row">
""",
    """              <div class="shell-brush-property-row">
                <label for="brush-tip-density-range">先端密度</label>
                <input id="brush-tip-density-range" type="range" min="0" max="1" step="0.01" value="1" />
                <span class="shell-brush-property-number shell-brush-property-percent"><input id="brush-tip-density-number" type="number" inputmode="decimal" min="0" max="1" step="0.01" value="1" aria-label="ブラシ先端密度数値" /><span>×</span></span>
              </div>
              <div class="shell-brush-property-row">
                <label for="brush-spacing-range">間隔</label>
                <input id="brush-spacing-range" type="range" min="1" max="400" step="1" value="25" />
                <span class="shell-brush-property-number shell-brush-property-percent"><input id="brush-spacing-number" type="number" inputmode="decimal" min="1" max="400" step="1" value="25" aria-label="ブラシ間隔パーセント" /><span>%</span></span>
              </div>
              <div class="shell-brush-property-row shell-brush-tip-property-row">
""",
)

# Regression coverage.
write_new(
    'tests/unit/brush-spacing.test.ts',
    """import { describe, expect, it } from 'vitest';
import {
  brushStrokeSpacingV1,
  createBaselineBrushPresetV1,
  withBrushStrokeSpacingV1,
} from '../../src/domain/brush-schema.js';
import { BaselineBrushDabBuilderV1 } from '../../src/gpu/baseline-brush.js';

describe('M6A-023 brush spacing / gap', () => {
  it('uses the canonical 25% / 1px preset fallback and persists spacing ratio', () => {
    const preset = createBaselineBrushPresetV1({
      id: 'spacing.paint',
      name: 'Paint',
      category: 'Test',
      behavior: 'paint',
    });
    expect(brushStrokeSpacingV1(preset)).toEqual({ spacingRatio: 0.25, minimumStampDistancePx: 1 });
    const wide = withBrushStrokeSpacingV1(preset, 0.5);
    expect(brushStrokeSpacingV1(wide)).toEqual({ spacingRatio: 0.5, minimumStampDistancePx: 1 });
    expect(() => withBrushStrokeSpacingV1(preset, 0)).toThrow(RangeError);
    expect(() => withBrushStrokeSpacingV1(preset, 4.01)).toThrow(RangeError);
  });

  it('changes deterministic logical stamp gap while retaining the stroke endpoint', () => {
    const builder = new BaselineBrushDabBuilderV1({
      sizePx: 16,
      spacingRatio: 0.5,
      minimumStampDistancePx: 1,
    });
    builder.begin({ documentX: 0, documentY: 8 });
    builder.append([{ documentX: 20, documentY: 8 }]);
    expect(builder.finish().map((dab) => dab.x)).toEqual([0, 8, 16, 20]);
  });

  it('enforces the preset minimum stamp distance for tiny brush sizes', () => {
    const builder = new BaselineBrushDabBuilderV1({
      sizePx: 1,
      spacingRatio: 0.01,
      minimumStampDistancePx: 1,
    });
    builder.begin({ documentX: 0, documentY: 0 });
    builder.append([{ documentX: 2.5, documentY: 0 }]);
    expect(builder.finish().map((dab) => dab.x)).toEqual([0, 1, 2, 2.5]);
  });
});""",
)

# Verification + checkpoints.
insert_before(
    'scripts/verify-m6a-brush.mjs',
    "requireText(\n  progress,\n  'M6A-PERF-001 incremental active-stroke rendering（stable prefix + bounded mutable tail）:未完了',",
    """requireText(progress, 'M6A-023 spacing/gap:完了', 'M6A-023 progress is not complete');
requireText(
  read('src/domain/brush-schema.ts'),
  'brushStrokeSpacingV1',
  'brush spacing preset helper missing',
);
requireText(
  read('src/gpu/baseline-brush.ts'),
  'Math.max(minimumStampDistancePx, sizePx * spacingRatio)',
  'brush spacing is not connected to deterministic dab placement',
);
requireText(
  read('src/app/paint-session-controller.ts'),
  'setBrushSpacing',
  'brush spacing is not captured by the paint session',
);
requireText(
  read('src/index.html'),
  'id=\"brush-spacing-range\"',
  'reachable brush spacing control missing',
);
requireText(
  read('tests/unit/brush-spacing.test.ts'),
  'changes deterministic logical stamp gap while retaining the stroke endpoint',
  'brush spacing regression coverage missing',
);""",
)
replace_once('IMPLEMENTATION_PROGRESS.md', 'M6A-023 spacing/gap:未完了', 'M6A-023 spacing/gap:完了')
append_once(
    'IMPLEMENTATION_PROGRESS.md',
    'M6A-023 spacing/gap resume memo — 2026-09-03',
    """### M6A-023 spacing/gap resume memo — 2026-09-03

- `stroke.spacingRatio` is the user-facing logical stamp interval relative to current brush size; factory/default value remains `0.25` (25%).
- `stroke.minimumStampDistancePx` is the safety/performance floor; the existing canonical preset value `1px` is now honored by the kernel instead of the old hard-coded `0.25px` floor.
- Spacing is captured when the stroke kernel is created. It is not redundantly serialized onto each dab because the resolved dab coordinates are already the exact history/save/recovery representation.
- The UI exposes 1..400% spacing while the schema stores 0.01..4. Endpoint retention and incremental confirmed-sample processing remain unchanged.
- Next incomplete item is M6A-024 tip angle.""",
)
append_once(
    'ILLUSTRO_DESIGN_MEMO.md',
    'M6A spacing/gap boundary — 2026-09-03',
    """#### M6A spacing/gap boundary — 2026-09-03

- Brush spacing is defined as logical stamp distance `max(minimumStampDistancePx, brushSizePx × spacingRatio)`. The canonical defaults are `spacingRatio=0.25` and `minimumStampDistancePx=1`.
- Spacing is a stroke-placement parameter, distinct from tip density and flow. Density changes per-stamp mask coverage; flow changes ink deposit; spacing changes where logical stamps are emitted.
- The preset stores spacing in the `stroke` section. Runtime captures it when a stroke begins; deterministic resolved dab coordinates are the history/persistence truth, so spacing is not duplicated onto each primitive dab.
- The user-facing Tool Properties control is percentage-based (1..400%) while the canonical ratio remains 0.01..4.
- Endpoint retention and incremental stable-prefix generation remain mandatory when spacing changes.""",
)

print('M6A-023 spacing patch applied')