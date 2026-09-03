from pathlib import Path


def read(path: str) -> str:
    return Path(path).read_text(encoding='utf-8')


def write(path: str, content: str) -> None:
    Path(path).write_text(content, encoding='utf-8')


def replace_once(path: str, before: str, after: str) -> None:
    source = read(path)
    count = source.count(before)
    if count != 1:
        raise RuntimeError(f'{path}: expected exactly one replacement, found {count}: {before[:140]!r}')
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


# Domain: asset-local forward direction. It composes with, rather than replaces, static angle.
insert_before(
    'src/domain/brush-schema.ts',
    'export function withBrushParameterValuesV1(',
    """export const DEFAULT_BRUSH_TIP_DIRECTION_DEGREES_V1 = 0 as const;

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
}""",
)

# Low-level brush kernel: keep direction as configuration and emit only resolved tipAngleDegrees.
replace_once(
    'src/gpu/baseline-brush.ts',
    'export const BASELINE_BRUSH_TIP_ANGLE_DEGREES = 0 as const;\n',
    """export const BASELINE_BRUSH_TIP_ANGLE_DEGREES = 0 as const;
export const BASELINE_BRUSH_TIP_DIRECTION_DEGREES = 0 as const;
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """  readonly #tipDensity: number;
  readonly #tipAngleDegrees: number;
  readonly #tipShape: BaselineBrushTipShapeV1;
""",
    """  readonly #tipDensity: number;
  readonly #tipAngleDegrees: number;
  readonly #tipDirectionDegrees: number;
  readonly #tipShape: BaselineBrushTipShapeV1;
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """      readonly tipDensity?: number;
      readonly tipAngleDegrees?: number;
      readonly tipShape?: BaselineBrushTipShapeV1;
""",
    """      readonly tipDensity?: number;
      readonly tipAngleDegrees?: number;
      readonly tipDirectionDegrees?: number;
      readonly tipShape?: BaselineBrushTipShapeV1;
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """    const tipAngleDegrees = normalizeBaselineBrushTipAngleDegreesV1(
      options.tipAngleDegrees ?? BASELINE_BRUSH_TIP_ANGLE_DEGREES,
    );
    if (!Number.isFinite(sizePx) || sizePx <= 0 || sizePx > 4096) {
""",
    """    const tipAngleDegrees = normalizeBaselineBrushTipAngleDegreesV1(
      options.tipAngleDegrees ?? BASELINE_BRUSH_TIP_ANGLE_DEGREES,
    );
    const tipDirectionDegrees = normalizeBaselineBrushTipAngleDegreesV1(
      options.tipDirectionDegrees ?? BASELINE_BRUSH_TIP_DIRECTION_DEGREES,
    );
    if (!Number.isFinite(sizePx) || sizePx <= 0 || sizePx > 4096) {
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """    this.#tipDensity = tipDensity;
    this.#tipAngleDegrees = tipAngleDegrees;
    this.#tipShape = options.tipShape ?? 'round';
""",
    """    this.#tipDensity = tipDensity;
    this.#tipAngleDegrees = tipAngleDegrees;
    this.#tipDirectionDegrees = tipDirectionDegrees;
    this.#tipShape = options.tipShape ?? 'round';
""",
)
# Replace only the three logical stamp calls, preserving other angle uses.
source = read('src/gpu/baseline-brush.ts')
for indent in ('      ', '        ', '          '):
    needle = 'this.#tipDensity,\n' + indent + 'this.#tipAngleDegrees,\n' + indent + 'this.#color,'
    count = source.count(needle)
    if count != 1:
        raise RuntimeError('baseline-brush: expected one logical stamp call for indent ' + repr(indent) + ', found ' + str(count))
    replacement = (
        'this.#tipDensity,\n'
        + indent
        + 'this.#resolvedTipAngleDegrees(),\n'
        + indent
        + 'this.#color,'
    )
    source = source.replace(needle, replacement, 1)
write('src/gpu/baseline-brush.ts', source)
insert_before(
    'src/gpu/baseline-brush.ts',
    '  #appendPoint(x: number, y: number): void {',
    """  #resolvedTipAngleDegrees(): number {
    return normalizeBaselineBrushTipAngleDegreesV1(
      this.#tipAngleDegrees - this.#tipDirectionDegrees,
    );
  }""",
)

# Canonical stroke forwards direction without changing the persisted dab contract.
replace_once(
    'src/app/canonical-raster-brush.ts',
    """      readonly tipDensity?: number;
      readonly tipAngleDegrees?: number;
      readonly tipShape?: BaselineBrushTipShapeV1;
""",
    """      readonly tipDensity?: number;
      readonly tipAngleDegrees?: number;
      readonly tipDirectionDegrees?: number;
      readonly tipShape?: BaselineBrushTipShapeV1;
""",
)
replace_once(
    'src/app/canonical-raster-brush.ts',
    """      ...(options.tipAngleDegrees === undefined
        ? {}
        : { tipAngleDegrees: options.tipAngleDegrees }),
      ...(options.tipShape === undefined ? {} : { tipShape: options.tipShape }),
""",
    """      ...(options.tipAngleDegrees === undefined
        ? {}
        : { tipAngleDegrees: options.tipAngleDegrees }),
      ...(options.tipDirectionDegrees === undefined
        ? {}
        : { tipDirectionDegrees: options.tipDirectionDegrees }),
      ...(options.tipShape === undefined ? {} : { tipShape: options.tipShape }),
""",
)

# Paint session captures both base angle and asset-local forward direction at stroke start.
replace_once(
    'src/app/paint-session-controller.ts',
    """  BASELINE_BRUSH_TIP_DENSITY,
  BASELINE_BRUSH_TIP_ANGLE_DEGREES,
  DEFAULT_BASELINE_BRUSH_COLOR_V1,
""",
    """  BASELINE_BRUSH_TIP_DENSITY,
  BASELINE_BRUSH_TIP_ANGLE_DEGREES,
  BASELINE_BRUSH_TIP_DIRECTION_DEGREES,
  DEFAULT_BASELINE_BRUSH_COLOR_V1,
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """  readonly brushMinimumStampDistancePx: number;
  readonly brushTipAngleDegrees: number;
  readonly brushTipShape: BaselineBrushTipShapeV1;
""",
    """  readonly brushMinimumStampDistancePx: number;
  readonly brushTipAngleDegrees: number;
  readonly brushTipDirectionDegrees: number;
  readonly brushTipShape: BaselineBrushTipShapeV1;
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """  #brushMinimumStampDistancePx: number = BASELINE_BRUSH_MINIMUM_STAMP_DISTANCE_PX;
  #brushTipAngleDegrees: number = BASELINE_BRUSH_TIP_ANGLE_DEGREES;
  #brushTipShape: BaselineBrushTipShapeV1 = 'round';
""",
    """  #brushMinimumStampDistancePx: number = BASELINE_BRUSH_MINIMUM_STAMP_DISTANCE_PX;
  #brushTipAngleDegrees: number = BASELINE_BRUSH_TIP_ANGLE_DEGREES;
  #brushTipDirectionDegrees: number = BASELINE_BRUSH_TIP_DIRECTION_DEGREES;
  #brushTipShape: BaselineBrushTipShapeV1 = 'round';
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """      brushMinimumStampDistancePx: this.#brushMinimumStampDistancePx,
      brushTipAngleDegrees: this.#brushTipAngleDegrees,
      brushTipShape: this.#brushTipShape,
""",
    """      brushMinimumStampDistancePx: this.#brushMinimumStampDistancePx,
      brushTipAngleDegrees: this.#brushTipAngleDegrees,
      brushTipDirectionDegrees: this.#brushTipDirectionDegrees,
      brushTipShape: this.#brushTipShape,
""",
)
insert_before(
    'src/app/paint-session-controller.ts',
    '  setBrushTipShape(',
    """  setBrushTipDirectionDegrees(directionDegrees: number): number {
    const normalized = normalizeBaselineBrushTipAngleDegreesV1(directionDegrees);
    if (normalized !== this.#brushTipDirectionDegrees) this.#clearActiveStroke();
    this.#brushTipDirectionDegrees = normalized;
    return this.#brushTipDirectionDegrees;
  }

  brushTipDirectionDegrees(): number {
    return this.#brushTipDirectionDegrees;
  }""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """      hardness: this.#brushHardness,
      tipAngleDegrees: this.#brushTipAngleDegrees,
      tipDensity: this.#brushTipDensity,
""",
    """      hardness: this.#brushHardness,
      tipAngleDegrees: this.#brushTipAngleDegrees,
      tipDirectionDegrees: this.#brushTipDirectionDegrees,
      tipDensity: this.#brushTipDensity,
""",
)

# Preset library mutation.
replace_once(
    'src/app/brush-preset-library.ts',
    """  withBrushTipDensityV1,
  withBrushTipAngleDegreesV1,
  withBrushStrokeSpacingV1,
""",
    """  withBrushTipDensityV1,
  withBrushTipAngleDegreesV1,
  withBrushTipDirectionDegreesV1,
  withBrushStrokeSpacingV1,
""",
)
insert_before(
    'src/app/brush-preset-library.ts',
    'export function updateBrushPresetCustomTipV1(',
    """export function updateBrushPresetTipDirectionV1(
  state: BrushPresetLibraryStateV1,
  presetId: string,
  directionDegrees: number,
): BrushPresetLibraryStateV1 {
  return updateItemV1(state, presetId, (item) => {
    if (item.locked) throw new Error('locked brush preset cannot be edited');
    const current = withBrushTipDirectionDegreesV1(item.preset, directionDegrees);
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

# Reachable Tool Properties UI and preset/session wiring.
replace_once(
    'src/app/brush-preset-controller.ts',
    """  brushTipDensityV1,
  brushTipAngleDegreesV1,
  brushStrokeSpacingV1,
""",
    """  brushTipDensityV1,
  brushTipAngleDegreesV1,
  brushTipDirectionDegreesV1,
  brushStrokeSpacingV1,
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  updateBrushPresetTipDensityV1,
  updateBrushPresetTipAngleV1,
  updateBrushPresetSpacingV1,
""",
    """  updateBrushPresetTipDensityV1,
  updateBrushPresetTipAngleV1,
  updateBrushPresetTipDirectionV1,
  updateBrushPresetSpacingV1,
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  const tipAngleRange = requireElement('#brush-tip-angle-range', HTMLInputElement);
  const tipAngleNumber = requireElement('#brush-tip-angle-number', HTMLInputElement);
  const tipShape = requireElement('#brush-tip-shape', HTMLSelectElement);
""",
    """  const tipAngleRange = requireElement('#brush-tip-angle-range', HTMLInputElement);
  const tipAngleNumber = requireElement('#brush-tip-angle-number', HTMLInputElement);
  const tipDirectionRange = requireElement('#brush-tip-direction-range', HTMLInputElement);
  const tipDirectionNumber = requireElement('#brush-tip-direction-number', HTMLInputElement);
  const tipShape = requireElement('#brush-tip-shape', HTMLSelectElement);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    input.paintSession.setBrushSpacing(spacing.spacingRatio, spacing.minimumStampDistancePx);
    input.paintSession.setBrushTipAngleDegrees(brushTipAngleDegreesV1(item.preset));
    input.paintSession.setBrushTipShape(
""",
    """    input.paintSession.setBrushSpacing(spacing.spacingRatio, spacing.minimumStampDistancePx);
    input.paintSession.setBrushTipAngleDegrees(brushTipAngleDegreesV1(item.preset));
    input.paintSession.setBrushTipDirectionDegrees(brushTipDirectionDegreesV1(item.preset));
    input.paintSession.setBrushTipShape(
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    input.root.dataset.illustroBrushSpacingRatio = String(spacing.spacingRatio);
    input.root.dataset.illustroBrushTipAngleDegrees = String(brushTipAngleDegreesV1(item.preset));
    input.root.dataset.illustroBrushTipShape = brushTipShapeV1(item.preset);
""",
    """    input.root.dataset.illustroBrushSpacingRatio = String(spacing.spacingRatio);
    input.root.dataset.illustroBrushTipAngleDegrees = String(brushTipAngleDegreesV1(item.preset));
    input.root.dataset.illustroBrushTipDirectionDegrees = String(
      brushTipDirectionDegreesV1(item.preset),
    );
    input.root.dataset.illustroBrushTipShape = brushTipShapeV1(item.preset);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    const tipAngleDegrees = brushTipAngleDegreesV1(selected.preset);
    configurePair(tipAngleRange, tipAngleNumber, 0, 359, 1, tipAngleDegrees);
    tipShape.value = brushTipShapeV1(selected.preset);
""",
    """    const tipAngleDegrees = brushTipAngleDegreesV1(selected.preset);
    configurePair(tipAngleRange, tipAngleNumber, 0, 359, 1, tipAngleDegrees);
    const tipDirectionDegrees = brushTipDirectionDegreesV1(selected.preset);
    configurePair(tipDirectionRange, tipDirectionNumber, 0, 359, 1, tipDirectionDegrees);
    tipShape.value = brushTipShapeV1(selected.preset);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    propertyStatus.textContent = `${parameters.sizePx.toFixed(1)} px · ${Math.round(parameters.opacity * 100)}% · ${Math.round(parameters.flow * 100)}% · H${Math.round(hardness * 100)}% · D${Math.round(tipDensity * 100)}% · S${Math.round(spacing.spacingRatio * 100)}% · A${Math.round(tipAngleDegrees)}°`;
""",
    """    propertyStatus.textContent = `${parameters.sizePx.toFixed(1)} px · ${Math.round(parameters.opacity * 100)}% · ${Math.round(parameters.flow * 100)}% · H${Math.round(hardness * 100)}% · D${Math.round(tipDensity * 100)}% · S${Math.round(spacing.spacingRatio * 100)}% · A${Math.round(tipAngleDegrees)}° · F${Math.round(tipDirectionDegrees)}°`;
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """      tipAngleRange,
      tipAngleNumber,
      tipShape,
""",
    """      tipAngleRange,
      tipAngleNumber,
      tipDirectionRange,
      tipDirectionNumber,
      tipShape,
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  const onTipAngleRange = (): void => updateTipAngle(Number(tipAngleRange.value));
  const onTipAngleNumber = (): void => updateTipAngle(Number(tipAngleNumber.value));
  const onTipShape = (): void => {
""",
    """  const onTipAngleRange = (): void => updateTipAngle(Number(tipAngleRange.value));
  const onTipAngleNumber = (): void => updateTipAngle(Number(tipAngleNumber.value));
  const updateTipDirection = (directionDegrees: number): void =>
    mutate(() =>
      updateBrushPresetTipDirectionV1(state, state.selectedPresetId, directionDegrees),
    );
  const onTipDirectionRange = (): void => updateTipDirection(Number(tipDirectionRange.value));
  const onTipDirectionNumber = (): void => updateTipDirection(Number(tipDirectionNumber.value));
  const onTipShape = (): void => {
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  tipAngleRange.addEventListener('input', onTipAngleRange);
  tipAngleNumber.addEventListener('change', onTipAngleNumber);
  tipShape.addEventListener('change', onTipShape);
""",
    """  tipAngleRange.addEventListener('input', onTipAngleRange);
  tipAngleNumber.addEventListener('change', onTipAngleNumber);
  tipDirectionRange.addEventListener('input', onTipDirectionRange);
  tipDirectionNumber.addEventListener('change', onTipDirectionNumber);
  tipShape.addEventListener('change', onTipShape);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """      tipAngleRange.removeEventListener('input', onTipAngleRange);
      tipAngleNumber.removeEventListener('change', onTipAngleNumber);
      tipShape.removeEventListener('change', onTipShape);
""",
    """      tipAngleRange.removeEventListener('input', onTipAngleRange);
      tipAngleNumber.removeEventListener('change', onTipAngleNumber);
      tipDirectionRange.removeEventListener('input', onTipDirectionRange);
      tipDirectionNumber.removeEventListener('change', onTipDirectionNumber);
      tipShape.removeEventListener('change', onTipShape);
""",
)

replace_once(
    'src/index.html',
    """              <div class="shell-brush-property-row">
                <label for="brush-tip-angle-range">先端角度</label>
                <input id="brush-tip-angle-range" type="range" min="0" max="359" step="1" value="0" />
                <span class="shell-brush-property-number"><input id="brush-tip-angle-number" type="number" inputmode="numeric" min="0" max="359" step="1" value="0" aria-label="ブラシ先端角度" /><span>°</span></span>
              </div>
              <div class="shell-brush-property-row shell-brush-tip-property-row">
""",
    """              <div class="shell-brush-property-row">
                <label for="brush-tip-angle-range">先端角度</label>
                <input id="brush-tip-angle-range" type="range" min="0" max="359" step="1" value="0" />
                <span class="shell-brush-property-number"><input id="brush-tip-angle-number" type="number" inputmode="numeric" min="0" max="359" step="1" value="0" aria-label="ブラシ先端角度" /><span>°</span></span>
              </div>
              <div class="shell-brush-property-row">
                <label for="brush-tip-direction-range">先端基準方向</label>
                <input id="brush-tip-direction-range" type="range" min="0" max="359" step="1" value="0" />
                <span class="shell-brush-property-number"><input id="brush-tip-direction-number" type="number" inputmode="numeric" min="0" max="359" step="1" value="0" aria-label="ブラシ先端基準方向" /><span>°</span></span>
              </div>
              <div class="shell-brush-property-row shell-brush-tip-property-row">
""",
)

write_new(
    'tests/unit/brush-tip-direction.test.ts',
    """import { describe, expect, it } from 'vitest';
import {
  brushTipDirectionDegreesV1,
  createBaselineBrushPresetV1,
  withBrushTipDirectionDegreesV1,
} from '../../src/domain/brush-schema.js';
import { BaselineBrushDabBuilderV1 } from '../../src/gpu/baseline-brush.js';

describe('M6A-025 brush tip direction', () => {
  it('normalizes the asset-local forward direction independently from tip angle', () => {
    const preset = createBaselineBrushPresetV1({
      id: 'direction.paint',
      name: 'Paint',
      category: 'Test',
      behavior: 'paint',
    });
    expect(brushTipDirectionDegreesV1(preset)).toBe(0);
    expect(brushTipDirectionDegreesV1(withBrushTipDirectionDegreesV1(preset, 450))).toBe(90);
    expect(brushTipDirectionDegreesV1(withBrushTipDirectionDegreesV1(preset, -90))).toBe(270);
  });

  it('calibrates an asset-local forward direction before sampled-tip expansion', () => {
    const alpha = Array.from({ length: 25 }, () => 0);
    alpha[2] = 255;
    const direct = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      tipShape: 'sampled-image',
      sampledTipAlpha: alpha,
      tipAngleDegrees: 270,
    }).begin({ documentX: 20, documentY: 20 });
    const calibrated = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      tipShape: 'sampled-image',
      sampledTipAlpha: alpha,
      tipAngleDegrees: 0,
      tipDirectionDegrees: 90,
    }).begin({ documentX: 20, documentY: 20 });
    expect(calibrated).toHaveLength(1);
    expect(calibrated[0]?.x).toBeCloseTo(direct[0]?.x ?? Number.NaN, 6);
    expect(calibrated[0]?.y).toBeCloseTo(direct[0]?.y ?? Number.NaN, 6);
    expect(calibrated[0]?.tipAngleDegrees).toBe(270);
  });

  it('composes static tip angle minus forward direction into the resolved dab angle', () => {
    const [dab] = new BaselineBrushDabBuilderV1({
      tipShape: 'square',
      tipAngleDegrees: 45,
      tipDirectionDegrees: 90,
    }).begin({ documentX: 10, documentY: 10 });
    expect(dab?.tipAngleDegrees).toBe(315);
  });
});""",
)

# Progress and canonical design memo.
replace_once(
    'IMPLEMENTATION_PROGRESS.md',
    """M6A-024 tip angle:完了
M6A-025 tip direction:未完了
M6A-026 follow stroke rotation:未完了
""",
    """M6A-024 tip angle:完了
M6A-025 tip direction:完了
再開メモ: M6A-025 tip directionはtip.directionDegreesを先端アセット固有の前方向として0..360°に正規化し、固定モードの実効角をtip.angleDegrees - tip.directionDegreesとしてstroke開始時に解決する。primitive dabには既存tipAngleDegreesへ解決済み角度だけを保存し、directionをdab schemaへ重複保存しない。procedural/sampled/custom tipはM6A-024の同一回転経路を共有する。次はM6A-026 follow stroke rotationから再開し、stroke tangentをこの固定角へ合成する。
M6A-026 follow stroke rotation:未完了
""",
)
append_once(
    'ILLUSTRO_DESIGN_MEMO.md',
    'M6A tip-direction boundary — 2026-09-03',
    """#### M6A tip-direction boundary — 2026-09-03

- `tip.directionDegrees` defines the intrinsic forward axis of a brush-tip resource/preset. It is normalized to `[0, 360)` and defaults to `0°` for legacy presets.
- `tip.angleDegrees` remains the user/static rotation from M6A-024. In non-follow mode the resolved orientation is `tip.angleDegrees - tip.directionDegrees`, normalized to `[0, 360)`.
- Direction is preset/session configuration, not a second per-dab orientation field. Primitive dabs store the resolved `tipAngleDegrees`, preserving the existing Worker/history/recovery contract and deterministic replay.
- Procedural, sampled and custom tips share the same resolved-angle path. No separate rendering branch is introduced for direction.
- M6A-026 follow-stroke rotation must compose stroke tangent with this calibration (`stroke tangent + static angle - tip direction`) rather than replacing either M6A-024 or M6A-025 semantics.""",
)

# Extend the M6A contract verifier before the independent performance gate.
insert_before(
    'scripts/verify-m6a-brush.mjs',
    """requireText(
  progress,
  'M6A-PERF-001 incremental active-stroke rendering（stable prefix + bounded mutable tail）:未完了',
""",
    """requireText(progress, 'M6A-025 tip direction:完了', 'M6A-025 progress is not complete');
requireText(
  read('src/domain/brush-schema.ts'),
  'brushTipDirectionDegreesV1',
  'brush tip direction preset helper missing',
);
requireText(
  read('src/gpu/baseline-brush.ts'),
  'this.#tipAngleDegrees - this.#tipDirectionDegrees',
  'brush tip direction is not composed into resolved stamp orientation',
);
requireText(
  read('src/app/paint-session-controller.ts'),
  'setBrushTipDirectionDegrees',
  'brush tip direction is not captured by the paint session',
);
requireText(
  read('src/index.html'),
  'id=\"brush-tip-direction-range\"',
  'reachable brush tip direction control missing',
);
requireText(
  read('tests/unit/brush-tip-direction.test.ts'),
  'calibrates an asset-local forward direction before sampled-tip expansion',
  'brush tip direction regression coverage missing',
);""",
)

print('M6A-025 tip direction patch applied')