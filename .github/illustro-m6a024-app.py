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


# Paint session: restore/persist and capture static angle at stroke start.
replace_once(
    'src/app/paint-session-controller.ts',
    """  BASELINE_BRUSH_TIP_DENSITY,
  DEFAULT_BASELINE_BRUSH_COLOR_V1,
""",
    """  BASELINE_BRUSH_TIP_DENSITY,
  BASELINE_BRUSH_TIP_ANGLE_DEGREES,
  DEFAULT_BASELINE_BRUSH_COLOR_V1,
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """  freezeBaselineBrushSampledTipAlphaV1,
  type BaselineBrushColorV1,
""",
    """  freezeBaselineBrushSampledTipAlphaV1,
  normalizeBaselineBrushTipAngleDegreesV1,
  type BaselineBrushColorV1,
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """  readonly brushMinimumStampDistancePx: number;
  readonly brushTipShape: BaselineBrushTipShapeV1;
""",
    """  readonly brushMinimumStampDistancePx: number;
  readonly brushTipAngleDegrees: number;
  readonly brushTipShape: BaselineBrushTipShapeV1;
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """  const tipDensity =
    value.tipDensity === undefined
      ? undefined
      : finiteNumber(value.tipDensity, 'baseline dab tipDensity');
  const tipShape = value.tipShape === undefined ? undefined : value.tipShape;
""",
    """  const tipDensity =
    value.tipDensity === undefined
      ? undefined
      : finiteNumber(value.tipDensity, 'baseline dab tipDensity');
  const tipAngleDegrees =
    value.tipAngleDegrees === undefined
      ? undefined
      : normalizeBaselineBrushTipAngleDegreesV1(
          finiteNumber(value.tipAngleDegrees, 'baseline dab tipAngleDegrees'),
        );
  const tipShape = value.tipShape === undefined ? undefined : value.tipShape;
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """    ...(tipDensity === undefined ? {} : { tipDensity }),
    ...(tipShape === undefined ? {} : { tipShape }),
""",
    """    ...(tipDensity === undefined ? {} : { tipDensity }),
    ...(tipAngleDegrees === undefined ? {} : { tipAngleDegrees }),
    ...(tipShape === undefined ? {} : { tipShape }),
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """  #brushMinimumStampDistancePx: number = BASELINE_BRUSH_MINIMUM_STAMP_DISTANCE_PX;
  #brushTipShape: BaselineBrushTipShapeV1 = 'round';
""",
    """  #brushMinimumStampDistancePx: number = BASELINE_BRUSH_MINIMUM_STAMP_DISTANCE_PX;
  #brushTipAngleDegrees: number = BASELINE_BRUSH_TIP_ANGLE_DEGREES;
  #brushTipShape: BaselineBrushTipShapeV1 = 'round';
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """      brushMinimumStampDistancePx: this.#brushMinimumStampDistancePx,
      brushTipShape: this.#brushTipShape,
""",
    """      brushMinimumStampDistancePx: this.#brushMinimumStampDistancePx,
      brushTipAngleDegrees: this.#brushTipAngleDegrees,
      brushTipShape: this.#brushTipShape,
""",
)
insert_before(
    'src/app/paint-session-controller.ts',
    '  setBrushTipShape(',
    """  setBrushTipAngleDegrees(angleDegrees: number): number {
    const normalized = normalizeBaselineBrushTipAngleDegreesV1(angleDegrees);
    if (normalized !== this.#brushTipAngleDegrees) this.#clearActiveStroke();
    this.#brushTipAngleDegrees = normalized;
    return this.#brushTipAngleDegrees;
  }

  brushTipAngleDegrees(): number {
    return this.#brushTipAngleDegrees;
  }""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """      minimumStampDistancePx: this.#brushMinimumStampDistancePx,
      hardness: this.#brushHardness,
""",
    """      minimumStampDistancePx: this.#brushMinimumStampDistancePx,
      hardness: this.#brushHardness,
      tipAngleDegrees: this.#brushTipAngleDegrees,
""",
)

# Preset library mutation.
replace_once(
    'src/app/brush-preset-library.ts',
    """  withBrushTipDensityV1,
  withBrushStrokeSpacingV1,
""",
    """  withBrushTipDensityV1,
  withBrushTipAngleDegreesV1,
  withBrushStrokeSpacingV1,
""",
)
insert_before(
    'src/app/brush-preset-library.ts',
    'export function updateBrushPresetCustomTipV1(',
    """export function updateBrushPresetTipAngleV1(
  state: BrushPresetLibraryStateV1,
  presetId: string,
  angleDegrees: number,
): BrushPresetLibraryStateV1 {
  return updateItemV1(state, presetId, (item) => {
    if (item.locked) throw new Error('locked brush preset cannot be edited');
    const current = withBrushTipAngleDegreesV1(item.preset, angleDegrees);
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

# UI controller.
replace_once(
    'src/app/brush-preset-controller.ts',
    """  brushTipDensityV1,
  brushStrokeSpacingV1,
""",
    """  brushTipDensityV1,
  brushTipAngleDegreesV1,
  brushStrokeSpacingV1,
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  updateBrushPresetTipDensityV1,
  updateBrushPresetSpacingV1,
""",
    """  updateBrushPresetTipDensityV1,
  updateBrushPresetTipAngleV1,
  updateBrushPresetSpacingV1,
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  const spacingRange = requireElement('#brush-spacing-range', HTMLInputElement);
  const spacingNumber = requireElement('#brush-spacing-number', HTMLInputElement);
  const tipShape = requireElement('#brush-tip-shape', HTMLSelectElement);
""",
    """  const spacingRange = requireElement('#brush-spacing-range', HTMLInputElement);
  const spacingNumber = requireElement('#brush-spacing-number', HTMLInputElement);
  const tipAngleRange = requireElement('#brush-tip-angle-range', HTMLInputElement);
  const tipAngleNumber = requireElement('#brush-tip-angle-number', HTMLInputElement);
  const tipShape = requireElement('#brush-tip-shape', HTMLSelectElement);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    input.paintSession.setBrushSpacing(spacing.spacingRatio, spacing.minimumStampDistancePx);
    input.paintSession.setBrushTipShape(
""",
    """    input.paintSession.setBrushSpacing(spacing.spacingRatio, spacing.minimumStampDistancePx);
    input.paintSession.setBrushTipAngleDegrees(brushTipAngleDegreesV1(item.preset));
    input.paintSession.setBrushTipShape(
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    input.root.dataset.illustroBrushSpacingRatio = String(spacing.spacingRatio);
    input.root.dataset.illustroBrushTipShape = brushTipShapeV1(item.preset);
""",
    """    input.root.dataset.illustroBrushSpacingRatio = String(spacing.spacingRatio);
    input.root.dataset.illustroBrushTipAngleDegrees = String(brushTipAngleDegreesV1(item.preset));
    input.root.dataset.illustroBrushTipShape = brushTipShapeV1(item.preset);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    const spacing = brushStrokeSpacingV1(selected.preset);
    configurePair(spacingRange, spacingNumber, 1, 400, 1, spacing.spacingRatio * 100);
    tipShape.value = brushTipShapeV1(selected.preset);
""",
    """    const spacing = brushStrokeSpacingV1(selected.preset);
    configurePair(spacingRange, spacingNumber, 1, 400, 1, spacing.spacingRatio * 100);
    const tipAngleDegrees = brushTipAngleDegreesV1(selected.preset);
    configurePair(tipAngleRange, tipAngleNumber, 0, 359, 1, tipAngleDegrees);
    tipShape.value = brushTipShapeV1(selected.preset);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    propertyStatus.textContent = `${parameters.sizePx.toFixed(1)} px · ${Math.round(parameters.opacity * 100)}% · ${Math.round(parameters.flow * 100)}% · H${Math.round(hardness * 100)}% · D${Math.round(tipDensity * 100)}% · S${Math.round(spacing.spacingRatio * 100)}%`;
""",
    """    propertyStatus.textContent = `${parameters.sizePx.toFixed(1)} px · ${Math.round(parameters.opacity * 100)}% · ${Math.round(parameters.flow * 100)}% · H${Math.round(hardness * 100)}% · D${Math.round(tipDensity * 100)}% · S${Math.round(spacing.spacingRatio * 100)}% · A${Math.round(tipAngleDegrees)}°`;
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """      spacingRange,
      spacingNumber,
      tipShape,
""",
    """      spacingRange,
      spacingNumber,
      tipAngleRange,
      tipAngleNumber,
      tipShape,
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  const onSpacingRange = (): void => updateSpacing(Number(spacingRange.value));
  const onSpacingNumber = (): void => updateSpacing(Number(spacingNumber.value));
  const onTipShape = (): void => {
""",
    """  const onSpacingRange = (): void => updateSpacing(Number(spacingRange.value));
  const onSpacingNumber = (): void => updateSpacing(Number(spacingNumber.value));
  const updateTipAngle = (angleDegrees: number): void =>
    mutate(() => updateBrushPresetTipAngleV1(state, state.selectedPresetId, angleDegrees));
  const onTipAngleRange = (): void => updateTipAngle(Number(tipAngleRange.value));
  const onTipAngleNumber = (): void => updateTipAngle(Number(tipAngleNumber.value));
  const onTipShape = (): void => {
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  spacingRange.addEventListener('input', onSpacingRange);
  spacingNumber.addEventListener('change', onSpacingNumber);
  tipShape.addEventListener('change', onTipShape);
""",
    """  spacingRange.addEventListener('input', onSpacingRange);
  spacingNumber.addEventListener('change', onSpacingNumber);
  tipAngleRange.addEventListener('input', onTipAngleRange);
  tipAngleNumber.addEventListener('change', onTipAngleNumber);
  tipShape.addEventListener('change', onTipShape);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """      spacingRange.removeEventListener('input', onSpacingRange);
      spacingNumber.removeEventListener('change', onSpacingNumber);
      tipShape.removeEventListener('change', onTipShape);
""",
    """      spacingRange.removeEventListener('input', onSpacingRange);
      spacingNumber.removeEventListener('change', onSpacingNumber);
      tipAngleRange.removeEventListener('input', onTipAngleRange);
      tipAngleNumber.removeEventListener('change', onTipAngleNumber);
      tipShape.removeEventListener('change', onTipShape);
""",
)

replace_once(
    'src/index.html',
    """              <div class="shell-brush-property-row">
                <label for="brush-spacing-range">間隔</label>
                <input id="brush-spacing-range" type="range" min="1" max="400" step="1" value="25" />
                <span class="shell-brush-property-number shell-brush-property-percent"><input id="brush-spacing-number" type="number" inputmode="decimal" min="1" max="400" step="1" value="25" aria-label="ブラシ間隔パーセント" /><span>%</span></span>
              </div>
              <div class="shell-brush-property-row shell-brush-tip-property-row">
""",
    """              <div class="shell-brush-property-row">
                <label for="brush-spacing-range">間隔</label>
                <input id="brush-spacing-range" type="range" min="1" max="400" step="1" value="25" />
                <span class="shell-brush-property-number shell-brush-property-percent"><input id="brush-spacing-number" type="number" inputmode="decimal" min="1" max="400" step="1" value="25" aria-label="ブラシ間隔パーセント" /><span>%</span></span>
              </div>
              <div class="shell-brush-property-row">
                <label for="brush-tip-angle-range">先端角度</label>
                <input id="brush-tip-angle-range" type="range" min="0" max="359" step="1" value="0" />
                <span class="shell-brush-property-number"><input id="brush-tip-angle-number" type="number" inputmode="numeric" min="0" max="359" step="1" value="0" aria-label="ブラシ先端角度" /><span>°</span></span>
              </div>
              <div class="shell-brush-property-row shell-brush-tip-property-row">
""",
)

# Worker message parsing keeps the angle exactly like hardness/density.
replace_once(
    'src/workers/render.worker.ts',
    """    const hardness = candidate.hardness;
    const tipDensity = candidate.tipDensity;
    if (
""",
    """    const hardness = candidate.hardness;
    const tipDensity = candidate.tipDensity;
    const tipAngleDegrees = candidate.tipAngleDegrees;
    if (
""",
)
replace_once(
    'src/workers/render.worker.ts',
    """      (tipDensity !== undefined &&
        (typeof tipDensity !== 'number' ||
          !Number.isFinite(tipDensity) ||
          tipDensity < 0 ||
          tipDensity > 1))
""",
    """      (tipDensity !== undefined &&
        (typeof tipDensity !== 'number' ||
          !Number.isFinite(tipDensity) ||
          tipDensity < 0 ||
          tipDensity > 1)) ||
      (tipAngleDegrees !== undefined &&
        (typeof tipAngleDegrees !== 'number' || !Number.isFinite(tipAngleDegrees)))
""",
)
replace_once(
    'src/workers/render.worker.ts',
    """        ...(tipDensity === undefined ? {} : { tipDensity }),
        ...(tipShape === undefined ? {} : { tipShape }),
""",
    """        ...(tipDensity === undefined ? {} : { tipDensity }),
        ...(tipAngleDegrees === undefined ? {} : { tipAngleDegrees }),
        ...(tipShape === undefined ? {} : { tipShape }),
""",
)

# Regression tests.
write_new(
    'tests/unit/brush-tip-angle.test.ts',
    """import { describe, expect, it } from 'vitest';
import {
  brushTipAngleDegreesV1,
  createBaselineBrushPresetV1,
  withBrushTipAngleDegreesV1,
} from '../../src/domain/brush-schema.js';
import { BaselineBrushDabBuilderV1 } from '../../src/gpu/baseline-brush.js';
import {
  BaselineRasterTileStoreV1,
  readBaselineRasterTilePixelV1,
} from '../../src/gpu/baseline-raster-tile-store.js';

describe('M6A-024 static brush tip angle', () => {
  it('normalizes preset angle to a deterministic 0..360 degree domain', () => {
    const preset = createBaselineBrushPresetV1({
      id: 'angle.paint',
      name: 'Paint',
      category: 'Test',
      behavior: 'paint',
    });
    expect(brushTipAngleDegreesV1(preset)).toBe(0);
    expect(brushTipAngleDegreesV1(withBrushTipAngleDegreesV1(preset, 450))).toBe(90);
    expect(brushTipAngleDegreesV1(withBrushTipAngleDegreesV1(preset, -90))).toBe(270);
  });

  it('rotates an asymmetric sampled tip before primitive-dab expansion', () => {
    const alpha = Array.from({ length: 25 }, () => 0);
    alpha[2] = 255;
    const vertical = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      tipShape: 'sampled-image',
      sampledTipAlpha: alpha,
      tipAngleDegrees: 0,
    }).begin({ documentX: 20, documentY: 20 });
    const rotated = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      tipShape: 'sampled-image',
      sampledTipAlpha: alpha,
      tipAngleDegrees: 90,
    }).begin({ documentX: 20, documentY: 20 });
    expect(vertical).toHaveLength(1);
    expect(rotated).toHaveLength(1);
    expect(vertical[0]?.x).toBeCloseTo(20, 6);
    expect(vertical[0]?.y).toBeCloseTo(12, 6);
    expect(rotated[0]?.x).toBeCloseTo(28, 6);
    expect(rotated[0]?.y).toBeCloseTo(20, 6);
  });

  it('rotates square canonical coverage and expands dirty bounds for its corners', () => {
    const axis = new BaselineRasterTileStoreV1(64, 64, 'rgba8-unorm', [
      { layerId: 'layer', visible: true, opacity: 1 },
    ]);
    const rotated = new BaselineRasterTileStoreV1(64, 64, 'rgba8-unorm', [
      { layerId: 'layer', visible: true, opacity: 1 },
    ]);
    const base = {
      schema: 'illustro.baseline-brush-dab/1' as const,
      x: 32,
      y: 32,
      radius: 10,
      opacity: 1,
      hardness: 1,
      tipDensity: 1,
      tipShape: 'square' as const,
      color: [0, 0, 0] as const,
    };
    axis.applyDabs('layer', 'axis', [Object.freeze({ ...base, tipAngleDegrees: 0 })], 'paint');
    rotated.applyDabs(
      'layer',
      'rotated',
      [Object.freeze({ ...base, tipAngleDegrees: 45 })],
      'paint',
    );
    axis.finalize('axis');
    rotated.finalize('rotated');
    const axisTile = axis.exportTiles()[0];
    const rotatedTile = rotated.exportTiles()[0];
    if (axisTile === undefined || rotatedTile === undefined) throw new Error('missing raster tile');
    const outerAxisPixel = 32 * axisTile.width + 45;
    expect(readBaselineRasterTilePixelV1(axisTile, outerAxisPixel)[3]).toBe(0);
    expect(readBaselineRasterTilePixelV1(rotatedTile, outerAxisPixel)[3]).toBeGreaterThan(0);
  });
});""",
)

# Verification and checkpoints.
insert_before(
    'scripts/verify-m6a-brush.mjs',
    "requireText(\n  progress,\n  'M6A-PERF-001 incremental active-stroke rendering（stable prefix + bounded mutable tail）:未完了',",
    """requireText(progress, 'M6A-024 tip angle:完了', 'M6A-024 progress is not complete');
requireText(
  read('src/domain/brush-schema.ts'),
  'brushTipAngleDegreesV1',
  'brush tip angle preset helper missing',
);
requireText(
  read('src/gpu/baseline-brush.ts'),
  'rotatedOffsetX',
  'sampled brush tip angle rotation missing',
);
requireText(
  read('src/gpu/baseline-raster-tile-store.ts'),
  'baselineDabTipAngleDegreesV1',
  'canonical procedural tip angle coverage missing',
);
requireText(
  read('src/workers/render.worker.ts'),
  '...(tipAngleDegrees === undefined ? {} : { tipAngleDegrees })',
  'worker parser does not preserve brush tip angle',
);
requireText(
  read('src/index.html'),
  'id=\"brush-tip-angle-range\"',
  'reachable brush tip angle control missing',
);
requireText(
  read('tests/unit/brush-tip-angle.test.ts'),
  'rotates square canonical coverage and expands dirty bounds for its corners',
  'brush tip angle regression coverage missing',
);""",
)
replace_once('IMPLEMENTATION_PROGRESS.md', 'M6A-024 tip angle:未完了', 'M6A-024 tip angle:完了')
append_once(
    'IMPLEMENTATION_PROGRESS.md',
    'M6A-024 tip-angle resume memo — 2026-09-03',
    """### M6A-024 tip-angle resume memo — 2026-09-03

- `tip.angleDegrees` is a static preset-local angle normalized to `0 <= angle < 360`; legacy presets/dabs resolve to `0°`.
- Procedural square coverage inverse-rotates pixel coordinates in Canonical Raster and rotated dirty bounds prevent clipped corners. Round tips remain visually invariant under angle.
- Sampled/custom tips rotate the logical 5×5 mask offsets before primitive round-dab expansion, preserving the existing renderer/history architecture.
- The resolved angle is copied to primitive dabs and preserved through save/recovery and Worker parsing. This remains static angle only; M6A-025 direction and M6A-026 follow-stroke rotation are not implemented here.
- Next incomplete item is M6A-025 tip direction.""",
)
append_once(
    'ILLUSTRO_DESIGN_MEMO.md',
    'M6A static tip-angle boundary — 2026-09-03',
    """#### M6A static tip-angle boundary — 2026-09-03

- Static brush-tip angle is stored as `tip.angleDegrees`, normalized to `[0, 360)`, with `0°` legacy fallback.
- Procedural tip coverage uses inverse rotation in document space before radius normalization. Rotated bounds are used for sparse-tile planning and per-tile raster loops so square corners are never clipped.
- Sampled/custom mask assets rotate their logical micro-dab offsets before expansion; downstream rendering continues to consume ordinary primitive dabs.
- Static angle is captured at stroke start and preserved on primitive dabs for deterministic Main/Worker/history/recovery behavior.
- Tip direction and stroke-follow rotation remain separate subsequent parameters and must compose with, not silently replace, this static angle.""",
)

print('M6A-024 app/tests/docs patch applied')