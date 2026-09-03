from pathlib import Path


def read(path: str) -> str:
    return Path(path).read_text(encoding='utf-8')


def write(path: str, text: str) -> None:
    Path(path).write_text(text, encoding='utf-8')


def replace_once(path: str, old: str, new: str) -> None:
    text = read(path)
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{path}: expected exactly one anchor, found {count}: {old[:120]!r}')
    write(path, text.replace(old, new, 1))


def append_once(path: str, marker: str, block: str) -> None:
    text = read(path)
    if marker in text:
        return
    if not text.endswith('\n'):
        text += '\n'
    write(path, text + '\n' + block.strip() + '\n')


# Preset schema
replace_once(
    'src/domain/brush-schema.ts',
    "export type BrushTipSelectionModeV1 = 'fixed' | 'sequence' | 'random-per-stamp';",
    """export const DEFAULT_BRUSH_DENSITY_JITTER_V1 = 0 as const;

export function brushDensityJitterV1(preset: BrushPresetV1): number {
  const value = preset.jitter.density;
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1
    ? value
    : DEFAULT_BRUSH_DENSITY_JITTER_V1;
}

export function withBrushDensityJitterV1(preset: BrushPresetV1, amount: number): BrushPresetV1 {
  if (!Number.isFinite(amount) || amount < 0 || amount > 1) {
    throw new RangeError('brush density jitter must be within 0..1');
  }
  if (amount === DEFAULT_BRUSH_DENSITY_JITTER_V1) {
    const { density: _density, ...jitter } = preset.jitter;
    return normalizeBrushPresetV1({ ...preset, jitter });
  }
  return normalizeBrushPresetV1({
    ...preset,
    jitter: { ...preset.jitter, density: amount },
  });
}

export type BrushTipSelectionModeV1 = 'fixed' | 'sequence' | 'random-per-stamp';""",
)

# Kernel
replace_once(
    'src/gpu/baseline-brush.ts',
    'export const BASELINE_BRUSH_POSITION_JITTER = 0 as const;\n',
    'export const BASELINE_BRUSH_POSITION_JITTER = 0 as const;\nexport const BASELINE_BRUSH_DENSITY_JITTER = 0 as const;\n',
)
replace_once(
    'src/gpu/baseline-brush.ts',
    'const BASELINE_BRUSH_POSITION_JITTER_RADIUS_SALT_V1 = 0xc2b2ae35 as const;\n',
    'const BASELINE_BRUSH_POSITION_JITTER_RADIUS_SALT_V1 = 0xc2b2ae35 as const;\nconst BASELINE_BRUSH_DENSITY_JITTER_SALT_V1 = 0x165667b1 as const;\n',
)
replace_once(
    'src/gpu/baseline-brush.ts',
    'export function deterministicBaselineBrushRandomV1(seed: number, stampIndex: number): number {',
    """export function deterministicBaselineBrushDensityJitterV1(
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

export function deterministicBaselineBrushRandomV1(seed: number, stampIndex: number): number {""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    '  readonly opacityJitterScale: number;\n  readonly tiltUprightness: number;\n',
    '  readonly opacityJitterScale: number;\n  readonly densityJitterScale: number;\n  readonly tiltUprightness: number;\n',
)
replace_once(
    'src/gpu/baseline-brush.ts',
    '  readonly #positionJitter: number;\n  readonly #randomSeed: number;\n',
    '  readonly #positionJitter: number;\n  readonly #densityJitter: number;\n  readonly #randomSeed: number;\n',
)
replace_once(
    'src/gpu/baseline-brush.ts',
    '  #positionJitterStampIndex = 0;\n  #pathDistancePx = 0;\n',
    '  #positionJitterStampIndex = 0;\n  #densityJitterStampIndex = 0;\n  #pathDistancePx = 0;\n',
)
replace_once(
    'src/gpu/baseline-brush.ts',
    '      readonly positionJitter?: number;\n      readonly randomSeed?: number;\n',
    '      readonly positionJitter?: number;\n      readonly densityJitter?: number;\n      readonly randomSeed?: number;\n',
)
replace_once(
    'src/gpu/baseline-brush.ts',
    '    const positionJitter = options.positionJitter ?? BASELINE_BRUSH_POSITION_JITTER;\n    const randomSeed = options.randomSeed ?? 0;\n',
    '    const positionJitter = options.positionJitter ?? BASELINE_BRUSH_POSITION_JITTER;\n    const densityJitter = options.densityJitter ?? BASELINE_BRUSH_DENSITY_JITTER;\n    const randomSeed = options.randomSeed ?? 0;\n',
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """    if (!Number.isFinite(positionJitter) || positionJitter < 0 || positionJitter > 1) {
      throw new RangeError('baseline brush position jitter must be within 0..1');
    }
""",
    """    if (!Number.isFinite(positionJitter) || positionJitter < 0 || positionJitter > 1) {
      throw new RangeError('baseline brush position jitter must be within 0..1');
    }
    if (!Number.isFinite(densityJitter) || densityJitter < 0 || densityJitter > 1) {
      throw new RangeError('baseline brush density jitter must be within 0..1');
    }
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    '    this.#positionJitter = positionJitter;\n    this.#randomSeed = randomSeed >>> 0;\n',
    '    this.#positionJitter = positionJitter;\n    this.#densityJitter = densityJitter;\n    this.#randomSeed = randomSeed >>> 0;\n',
)
replace_once(
    'src/gpu/baseline-brush.ts',
    "      | 'opacityJitterScale'\n      | 'tiltUprightness'\n",
    "      | 'opacityJitterScale'\n      | 'densityJitterScale'\n      | 'tiltUprightness'\n",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    '      this.#hardness,\n      this.#tipDensity,\n      stamp.tipAngleDegrees,\n',
    '      this.#hardness,\n      this.#tipDensity * stamp.densityJitterScale,\n      stamp.tipAngleDegrees,\n',
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """    const jitteredY =
      positionJitterVector === null ? y : y + positionJitterVector.y * maximumPositionOffsetPx;
    const sampledTipAlpha = this.#sampledTipAlphaForLogicalStamp();
""",
    """    const jitteredY =
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
    const sampledTipAlpha = this.#sampledTipAlphaForLogicalStamp();
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    '      sizeJitterScale,\n      opacityJitterScale,\n      tiltUprightness,\n',
    '      sizeJitterScale,\n      opacityJitterScale,\n      densityJitterScale,\n      tiltUprightness,\n',
)

# Canonical facade
replace_once(
    'src/app/canonical-raster-brush.ts',
    '      readonly positionJitter?: number;\n      readonly randomSeed?: number;\n',
    '      readonly positionJitter?: number;\n      readonly densityJitter?: number;\n      readonly randomSeed?: number;\n',
)
replace_once(
    'src/app/canonical-raster-brush.ts',
    '      ...(options.positionJitter === undefined ? {} : { positionJitter: options.positionJitter }),\n      ...(options.randomSeed === undefined ? {} : { randomSeed: options.randomSeed }),\n',
    '      ...(options.positionJitter === undefined ? {} : { positionJitter: options.positionJitter }),\n      ...(options.densityJitter === undefined ? {} : { densityJitter: options.densityJitter }),\n      ...(options.randomSeed === undefined ? {} : { randomSeed: options.randomSeed }),\n',
)

# Runtime session
replace_once(
    'src/app/paint-session-controller.ts',
    '  BASELINE_BRUSH_POSITION_JITTER,\n  DEFAULT_BASELINE_BRUSH_COLOR_V1,\n',
    '  BASELINE_BRUSH_POSITION_JITTER,\n  BASELINE_BRUSH_DENSITY_JITTER,\n  DEFAULT_BASELINE_BRUSH_COLOR_V1,\n',
)
replace_once(
    'src/app/paint-session-controller.ts',
    '  readonly brushPositionJitter: number;\n  readonly brushTipAngleDegrees: number;\n',
    '  readonly brushPositionJitter: number;\n  readonly brushDensityJitter: number;\n  readonly brushTipAngleDegrees: number;\n',
)
replace_once(
    'src/app/paint-session-controller.ts',
    '  #brushPositionJitter: number = BASELINE_BRUSH_POSITION_JITTER;\n  #brushTipAngleDegrees: number = BASELINE_BRUSH_TIP_ANGLE_DEGREES;\n',
    '  #brushPositionJitter: number = BASELINE_BRUSH_POSITION_JITTER;\n  #brushDensityJitter: number = BASELINE_BRUSH_DENSITY_JITTER;\n  #brushTipAngleDegrees: number = BASELINE_BRUSH_TIP_ANGLE_DEGREES;\n',
)
replace_once(
    'src/app/paint-session-controller.ts',
    '      brushPositionJitter: this.#brushPositionJitter,\n      brushTipAngleDegrees: this.#brushTipAngleDegrees,\n',
    '      brushPositionJitter: this.#brushPositionJitter,\n      brushDensityJitter: this.#brushDensityJitter,\n      brushTipAngleDegrees: this.#brushTipAngleDegrees,\n',
)
replace_once(
    'src/app/paint-session-controller.ts',
    """  brushPositionJitter(): number {
    return this.#brushPositionJitter;
  }

  setBrushTipAngleDegrees(angleDegrees: number): number {
""",
    """  brushPositionJitter(): number {
    return this.#brushPositionJitter;
  }

  setBrushDensityJitter(amount: number): number {
    if (!Number.isFinite(amount) || amount < 0 || amount > 1) {
      throw new RangeError('invalid runtime brush density jitter');
    }
    if (amount !== this.#brushDensityJitter) this.#clearActiveStroke();
    this.#brushDensityJitter = amount;
    return this.#brushDensityJitter;
  }

  brushDensityJitter(): number {
    return this.#brushDensityJitter;
  }

  setBrushTipAngleDegrees(angleDegrees: number): number {
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """    const positionJitterEnabled = this.#brushPositionJitter > 0;
    const randomSeed =
      this.#brushTipSelectionMode === 'random-per-stamp' ||
      randomDynamicsEnabled ||
      sizeJitterEnabled ||
      opacityJitterEnabled ||
      rotationJitterEnabled ||
      positionJitterEnabled
        ? deterministicPaintStrokeSeedV1(strokeId)
        : undefined;
""",
    """    const positionJitterEnabled = this.#brushPositionJitter > 0;
    const densityJitterEnabled = this.#brushDensityJitter > 0;
    const randomSeed =
      this.#brushTipSelectionMode === 'random-per-stamp' ||
      randomDynamicsEnabled ||
      sizeJitterEnabled ||
      opacityJitterEnabled ||
      rotationJitterEnabled ||
      positionJitterEnabled ||
      densityJitterEnabled
        ? deterministicPaintStrokeSeedV1(strokeId)
        : undefined;
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    '        positionJitter: this.#brushPositionJitter,\n        randomSeed: randomSeed ?? 0,\n',
    '        positionJitter: this.#brushPositionJitter,\n        densityJitter: this.#brushDensityJitter,\n        randomSeed: randomSeed ?? 0,\n',
)

# Preset library mutation
replace_once(
    'src/app/brush-preset-library.ts',
    '  withBrushPositionJitterV1,\n  withBrushStrokeSpacingV1,\n',
    '  withBrushPositionJitterV1,\n  withBrushDensityJitterV1,\n  withBrushStrokeSpacingV1,\n',
)
replace_once(
    'src/app/brush-preset-library.ts',
    'export function updateBrushPresetCustomTipV1(\n',
    """export function updateBrushPresetDensityJitterV1(
  state: BrushPresetLibraryStateV1,
  presetId: string,
  amount: number,
): BrushPresetLibraryStateV1 {
  return updateItemV1(state, presetId, (item) => {
    if (item.locked) throw new Error('locked brush preset cannot be edited');
    const current = withBrushDensityJitterV1(item.preset, amount);
    if (JSON.stringify(current) === JSON.stringify(item.preset)) return item;
    const next = normalizeBrushPresetV1({ ...current, revision: item.preset.revision + 1 });
    return itemV1({
      source: item.source,
      baseline: item.baseline,
      preset: next,
      locked: item.locked,
    });
  });
}

export function updateBrushPresetCustomTipV1(
""",
)

# Properties controller
replace_once(
    'src/app/brush-preset-controller.ts',
    '  brushPositionJitterV1,\n  BUILTIN_BRUSH_GRAIN_RESOURCES_V1,\n',
    '  brushPositionJitterV1,\n  brushDensityJitterV1,\n  BUILTIN_BRUSH_GRAIN_RESOURCES_V1,\n',
)
replace_once(
    'src/app/brush-preset-controller.ts',
    '  updateBrushPresetPositionJitterV1,\n  updateBrushPresetSpacingV1,\n',
    '  updateBrushPresetPositionJitterV1,\n  updateBrushPresetDensityJitterV1,\n  updateBrushPresetSpacingV1,\n',
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  const positionJitterRange = requireElement('#brush-position-jitter-range', HTMLInputElement);
  const positionJitterNumber = requireElement('#brush-position-jitter-number', HTMLInputElement);
  const tipShape = requireElement('#brush-tip-shape', HTMLSelectElement);
""",
    """  const positionJitterRange = requireElement('#brush-position-jitter-range', HTMLInputElement);
  const positionJitterNumber = requireElement('#brush-position-jitter-number', HTMLInputElement);
  const densityJitterRange = requireElement('#brush-density-jitter-range', HTMLInputElement);
  const densityJitterNumber = requireElement('#brush-density-jitter-number', HTMLInputElement);
  const tipShape = requireElement('#brush-tip-shape', HTMLSelectElement);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    const positionJitter = brushPositionJitterV1(item.preset);
    input.paintSession.setBrushPositionJitter(positionJitter);
    const tipAssets = brushTipAssetsV1(item.preset);
""",
    """    const positionJitter = brushPositionJitterV1(item.preset);
    input.paintSession.setBrushPositionJitter(positionJitter);
    const densityJitter = brushDensityJitterV1(item.preset);
    input.paintSession.setBrushDensityJitter(densityJitter);
    const tipAssets = brushTipAssetsV1(item.preset);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    '    input.root.dataset.illustroBrushPositionJitter = String(positionJitter);\n    input.root.dataset.illustroBrushTipShape = brushTipShapeV1(item.preset);\n',
    '    input.root.dataset.illustroBrushPositionJitter = String(positionJitter);\n    input.root.dataset.illustroBrushDensityJitter = String(densityJitter);\n    input.root.dataset.illustroBrushTipShape = brushTipShapeV1(item.preset);\n',
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    const positionJitter = brushPositionJitterV1(selected.preset);
    configurePair(positionJitterRange, positionJitterNumber, 0, 100, 1, positionJitter * 100);
    tipShape.value = brushTipShapeV1(selected.preset);
""",
    """    const positionJitter = brushPositionJitterV1(selected.preset);
    configurePair(positionJitterRange, positionJitterNumber, 0, 100, 1, positionJitter * 100);
    const densityJitter = brushDensityJitterV1(selected.preset);
    configurePair(densityJitterRange, densityJitterNumber, 0, 100, 1, densityJitter * 100);
    tipShape.value = brushTipShapeV1(selected.preset);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    const positionJitterLabel =
      positionJitter > 0 ? ` · PositionJitter${Math.round(positionJitter * 100)}%` : '';
    propertyStatus.textContent = `${parameters.sizePx.toFixed(1)} px · ${Math.round(parameters.opacity * 100)}% · ${Math.round(parameters.flow * 100)}% · H${Math.round(hardness * 100)}% · D${Math.round(tipDensity * 100)}% · S${Math.round(spacing.spacingRatio * 100)}% · A${Math.round(tipAngleDegrees)}° · F${Math.round(tipDirectionDegrees)}°${followRotation ? ' · Follow' : ''}${penOrientationEnabled ? ' · PenDir' : ''}${repeatLabel}${startLabel}${endLabel}${sizeTaperLabel}${opacityTaperLabel}${forcedTaperLabel}${stabilizationLabel}${postCorrectionLabel}${grainLabel}${paperLabel}${textureStrengthLabel}${textureScaleLabel}${textureRotationLabel}${textureBlendLabel}${pressureSizeLabel}${pressureOpacityLabel}${pressureFlowLabel}${pressureCurveLabel}${tiltSizeLabel}${tiltOpacityLabel}${tiltFlowLabel}${tiltCurveLabel}${velocitySizeLabel}${velocityOpacityLabel}${velocityFlowLabel}${velocityCurveLabel}${velocityMaximumLabel}${randomSizeLabel}${randomOpacityLabel}${randomFlowLabel}${randomCurveLabel}${minimumResponseLabel}${maximumResponseLabel}${sizeJitterLabel}${opacityJitterLabel}${rotationJitterLabel}${positionJitterLabel}`;
""",
    """    const positionJitterLabel =
      positionJitter > 0 ? ` · PositionJitter${Math.round(positionJitter * 100)}%` : '';
    const densityJitterLabel =
      densityJitter > 0 ? ` · DensityJitter${Math.round(densityJitter * 100)}%` : '';
    propertyStatus.textContent = `${parameters.sizePx.toFixed(1)} px · ${Math.round(parameters.opacity * 100)}% · ${Math.round(parameters.flow * 100)}% · H${Math.round(hardness * 100)}% · D${Math.round(tipDensity * 100)}% · S${Math.round(spacing.spacingRatio * 100)}% · A${Math.round(tipAngleDegrees)}° · F${Math.round(tipDirectionDegrees)}°${followRotation ? ' · Follow' : ''}${penOrientationEnabled ? ' · PenDir' : ''}${repeatLabel}${startLabel}${endLabel}${sizeTaperLabel}${opacityTaperLabel}${forcedTaperLabel}${stabilizationLabel}${postCorrectionLabel}${grainLabel}${paperLabel}${textureStrengthLabel}${textureScaleLabel}${textureRotationLabel}${textureBlendLabel}${pressureSizeLabel}${pressureOpacityLabel}${pressureFlowLabel}${pressureCurveLabel}${tiltSizeLabel}${tiltOpacityLabel}${tiltFlowLabel}${tiltCurveLabel}${velocitySizeLabel}${velocityOpacityLabel}${velocityFlowLabel}${velocityCurveLabel}${velocityMaximumLabel}${randomSizeLabel}${randomOpacityLabel}${randomFlowLabel}${randomCurveLabel}${minimumResponseLabel}${maximumResponseLabel}${sizeJitterLabel}${opacityJitterLabel}${rotationJitterLabel}${positionJitterLabel}${densityJitterLabel}`;
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    '      positionJitterRange,\n      positionJitterNumber,\n      tipShape,\n',
    '      positionJitterRange,\n      positionJitterNumber,\n      densityJitterRange,\n      densityJitterNumber,\n      tipShape,\n',
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  const onPositionJitterRange = (): void => updatePositionJitter(Number(positionJitterRange.value));
  const onPositionJitterNumber = (): void =>
    updatePositionJitter(Number(positionJitterNumber.value));
  const onTipShape = (): void => {
""",
    """  const onPositionJitterRange = (): void => updatePositionJitter(Number(positionJitterRange.value));
  const onPositionJitterNumber = (): void =>
    updatePositionJitter(Number(positionJitterNumber.value));
  const updateDensityJitter = (valuePercent: number): void =>
    mutate(() =>
      updateBrushPresetDensityJitterV1(state, state.selectedPresetId, valuePercent / 100),
    );
  const onDensityJitterRange = (): void => updateDensityJitter(Number(densityJitterRange.value));
  const onDensityJitterNumber = (): void => updateDensityJitter(Number(densityJitterNumber.value));
  const onTipShape = (): void => {
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  positionJitterRange.addEventListener('input', onPositionJitterRange);
  positionJitterNumber.addEventListener('change', onPositionJitterNumber);
  tipShape.addEventListener('change', onTipShape);
""",
    """  positionJitterRange.addEventListener('input', onPositionJitterRange);
  positionJitterNumber.addEventListener('change', onPositionJitterNumber);
  densityJitterRange.addEventListener('input', onDensityJitterRange);
  densityJitterNumber.addEventListener('change', onDensityJitterNumber);
  tipShape.addEventListener('change', onTipShape);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """      positionJitterRange.removeEventListener('input', onPositionJitterRange);
      positionJitterNumber.removeEventListener('change', onPositionJitterNumber);
      pressureCurveEditor?.dispose();
""",
    """      positionJitterRange.removeEventListener('input', onPositionJitterRange);
      positionJitterNumber.removeEventListener('change', onPositionJitterNumber);
      densityJitterRange.removeEventListener('input', onDensityJitterRange);
      densityJitterNumber.removeEventListener('change', onDensityJitterNumber);
      pressureCurveEditor?.dispose();
""",
)

# Reachable UI
replace_once(
    'src/index.html',
    """              <div class="shell-brush-property-row">
                <label for="brush-position-jitter-range">位置ジッター</label>
                <input id="brush-position-jitter-range" type="range" min="0" max="100" step="1" value="0" />
                <span class="shell-brush-property-number shell-brush-property-percent"><input id="brush-position-jitter-number" type="number" inputmode="decimal" min="0" max="100" step="1" value="0" aria-label="ブラシ位置ジッター" /><span>%</span></span>
              </div>
""",
    """              <div class="shell-brush-property-row">
                <label for="brush-position-jitter-range">位置ジッター</label>
                <input id="brush-position-jitter-range" type="range" min="0" max="100" step="1" value="0" />
                <span class="shell-brush-property-number shell-brush-property-percent"><input id="brush-position-jitter-number" type="number" inputmode="decimal" min="0" max="100" step="1" value="0" aria-label="ブラシ位置ジッター" /><span>%</span></span>
              </div>
              <div class="shell-brush-property-row">
                <label for="brush-density-jitter-range">密度ジッター</label>
                <input id="brush-density-jitter-range" type="range" min="0" max="100" step="1" value="0" />
                <span class="shell-brush-property-number shell-brush-property-percent"><input id="brush-density-jitter-number" type="number" inputmode="decimal" min="0" max="100" step="1" value="0" aria-label="ブラシ密度ジッター" /><span>%</span></span>
              </div>
""",
)

# Tests
test_path = Path('tests/unit/brush-density-jitter.test.ts')
if test_path.exists():
    raise RuntimeError('tests/unit/brush-density-jitter.test.ts already exists')
test_path.write_text("""import { describe, expect, it } from 'vitest';
import {
  brushDensityJitterV1,
  createBaselineBrushPresetV1,
  withBrushDensityJitterV1,
} from '../../src/domain/brush-schema.js';
import { PaintSessionControllerV1 } from '../../src/app/paint-session-controller.js';
import {
  BaselineBrushDabBuilderV1,
  deterministicBaselineBrushDensityJitterV1,
} from '../../src/gpu/baseline-brush.js';

class FakeRendererDocumentPort {
  async configureDocument(): Promise<void> {}
  async restoreBaselineStrokes(): Promise<void> {}
  async applyBaselineTilePatches(): Promise<void> {}
  async restoreBaselineCanonicalTiles(): Promise<void> {}
  async exportBaselineCanonicalTiles(): Promise<readonly never[]> {
    return [];
  }
  async exportBaselineCompositeTiles(): Promise<readonly never[]> {
    return [];
  }
}

describe('M6A-055 density jitter', () => {
  it('stores normalized density jitter with an exact zero default', () => {
    const preset = createBaselineBrushPresetV1({
      id: 'test.density-jitter',
      name: 'Density Jitter',
      category: 'Test',
      behavior: 'paint',
    });
    expect(brushDensityJitterV1(preset)).toBe(0);
    const changed = withBrushDensityJitterV1(preset, 0.4);
    expect(brushDensityJitterV1(changed)).toBe(0.4);
    expect(changed.jitter.density).toBe(0.4);
    const reset = withBrushDensityJitterV1(changed, 0);
    expect(brushDensityJitterV1(reset)).toBe(0);
    expect(reset.jitter.density).toBeUndefined();
    expect(() => withBrushDensityJitterV1(preset, -0.01)).toThrow(RangeError);
    expect(() => withBrushDensityJitterV1(preset, 1.01)).toThrow(RangeError);
  });

  it('keeps zero jitter as an exact tip-density identity', () => {
    const baseline = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      spacingRatio: 1,
      tipDensity: 0.8,
      randomSeed: 19,
    });
    const explicitZero = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      spacingRatio: 1,
      tipDensity: 0.8,
      densityJitter: 0,
      randomSeed: 19,
    });
    for (const brush of [baseline, explicitZero]) {
      brush.begin({ documentX: 0, documentY: 0 });
      brush.append([{ documentX: 20, documentY: 0 }]);
      brush.finish();
    }
    expect(explicitZero.dabs()).toEqual(baseline.dabs());
  });

  it('applies deterministic one-sided coverage-density variation without changing flow', () => {
    const seed = 0x12345678;
    const amount = 0.5;
    const baseDensity = 0.8;
    const brush = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      spacingRatio: 1,
      flow: 0.7,
      tipDensity: baseDensity,
      densityJitter: amount,
      randomSeed: seed,
    });
    brush.begin({ documentX: 0, documentY: 0 });
    brush.append([{ documentX: 20, documentY: 0 }]);
    brush.finish();
    const dabs = brush.dabs();
    expect(dabs[0]?.tipDensity).toBeCloseTo(
      baseDensity * (1 - amount * deterministicBaselineBrushDensityJitterV1(seed, 0)),
      10,
    );
    expect(dabs[1]?.tipDensity).toBeCloseTo(
      baseDensity * (1 - amount * deterministicBaselineBrushDensityJitterV1(seed, 1)),
      10,
    );
    expect(dabs.every((dab) => dab.flow === 0.7)).toBe(true);
  });

  it('shares one logical-stamp density sample across sampled-tip micro dabs', () => {
    const seed = 0x2468ace0;
    const amount = 0.6;
    const baseDensity = 0.9;
    const brush = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      tipShape: 'sampled-image',
      tipDensity: baseDensity,
      densityJitter: amount,
      randomSeed: seed,
    });
    const firstStamp = brush.beginDelta({ documentX: 20, documentY: 20 });
    const expected =
      baseDensity * (1 - amount * deterministicBaselineBrushDensityJitterV1(seed, 0));
    expect(firstStamp.length).toBeGreaterThan(1);
    expect(firstStamp.every((dab) => Math.abs((dab.tipDensity ?? 0) - expected) < 1e-10)).toBe(true);
  });

  it('advances the density-jitter attempt index even when taper suppresses a logical stamp', () => {
    const seed = 0x89abcdef;
    const amount = 0.75;
    const baseDensity = 0.8;
    const brush = new BaselineBrushDabBuilderV1({
      sizePx: 10,
      spacingRatio: 1,
      startTaperLengthPx: 10,
      tipDensity: baseDensity,
      densityJitter: amount,
      randomSeed: seed,
    });
    brush.begin({ documentX: 0, documentY: 0 });
    brush.append([{ documentX: 10, documentY: 0 }]);
    const [dab] = brush.dabs();
    expect(dab?.tipDensity).toBeCloseTo(
      baseDensity * (1 - amount * deterministicBaselineBrushDensityJitterV1(seed, 1)),
      10,
    );
  });

  it('keeps its random sequence independent from other randomized brush channels', () => {
    const seed = 0x0badc0de;
    const plain = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      spacingRatio: 1,
      densityJitter: 0.5,
      randomSeed: seed,
    });
    const combined = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      spacingRatio: 1,
      densityJitter: 0.5,
      sizeJitter: 0.5,
      opacityJitter: 0.5,
      rotationJitter: 0.5,
      positionJitter: 0.5,
      randomFlowEnabled: true,
      randomSeed: seed,
    });
    for (const brush of [plain, combined]) {
      brush.begin({ documentX: 0, documentY: 0 });
      brush.append([{ documentX: 20, documentY: 0 }]);
      brush.finish();
    }
    expect(combined.dabs().map((dab) => dab.tipDensity)).toEqual(
      plain.dabs().map((dab) => dab.tipDensity),
    );
  });

  it('reuses the resolved density scale when reconciling the mutable end tail', () => {
    const brush = new BaselineBrushDabBuilderV1({
      sizePx: 10,
      spacingRatio: 1,
      endTaperLengthPx: 10,
      sizeTaperMinimumRatio: 1,
      opacityTaperMinimumRatio: 1,
      tipDensity: 0.8,
      densityJitter: 0.6,
      randomSeed: 0xfeed1234,
    });
    brush.begin({ documentX: 0, documentY: 0 });
    brush.append([
      { documentX: 10, documentY: 0 },
      { documentX: 20, documentY: 0 },
    ]);
    const beforeFinish = brush.dabs().map((dab) => dab.tipDensity);
    brush.finish();
    expect(brush.dabs().map((dab) => dab.tipDensity)).toEqual(beforeFinish);
  });

  it('captures runtime density jitter without adding a density-jitter primitive field', () => {
    const session = new PaintSessionControllerV1(new FakeRendererDocumentPort());
    expect(session.setBrushDensityJitter(0.35)).toBe(0.35);
    expect(session.snapshot().brushDensityJitter).toBe(0.35);
    const [dab] = new BaselineBrushDabBuilderV1({
      densityJitter: 0.35,
      randomSeed: 7,
    }).beginDelta({ documentX: 0, documentY: 0 });
    expect(dab).toBeDefined();
    expect('densityJitter' in (dab ?? {})).toBe(false);
  });
});
""", encoding='utf-8')

# Verification gate
replace_once(
    'scripts/verify-m6a-brush.mjs',
    """requireText(
  progress,
  'M6A-PERF-001 incremental active-stroke rendering（stable prefix + bounded mutable tail）:未完了',
  'performance gate must remain separately incomplete',
);
""",
    """requireText(progress, 'M6A-055 density jitter:完了', 'M6A-055 progress is not complete');
requireText(
  read('src/domain/brush-schema.ts'),
  'brushDensityJitterV1',
  'density-jitter preset helpers missing',
);
requireText(
  read('src/gpu/baseline-brush.ts'),
  'deterministicBaselineBrushDensityJitterV1',
  'deterministic density-jitter channel missing',
);
requireText(
  read('src/gpu/baseline-brush.ts'),
  'this.#tipDensity * stamp.densityJitterScale',
  'density jitter is not applied to canonical tip density',
);
requireText(
  read('src/app/paint-session-controller.ts'),
  'setBrushDensityJitter',
  'density jitter is not connected to runtime brush state',
);
requireText(
  read('src/app/paint-session-controller.ts'),
  'densityJitterEnabled',
  'density jitter does not capture a deterministic persistent stroke seed',
);
requireText(
  read('src/index.html'),
  'id="brush-density-jitter-range"',
  'reachable density-jitter control missing',
);
requireText(
  read('tests/unit/brush-density-jitter.test.ts'),
  'shares one logical-stamp density sample across sampled-tip micro dabs',
  'density-jitter logical-stamp sharing regression missing',
);
requireText(
  read('tests/unit/brush-density-jitter.test.ts'),
  'advances the density-jitter attempt index even when taper suppresses a logical stamp',
  'density-jitter attempt-index regression missing',
);
requireText(
  read('tests/unit/brush-density-jitter.test.ts'),
  'reuses the resolved density scale when reconciling the mutable end tail',
  'density-jitter tail reconciliation regression missing',
);

requireText(
  progress,
  'M6A-PERF-001 incremental active-stroke rendering（stable prefix + bounded mutable tail）:未完了',
  'performance gate must remain separately incomplete',
);
""",
)

# Progress/docs
replace_once(
    'IMPLEMENTATION_PROGRESS.md',
    'M6A-055 density jitter:未完了\nM6A-056 color jitter:未完了\n',
    'M6A-055 density jitter:完了\n再開メモ: M6A-055 density jitterはCanonical Brush Modelのjitter.densityを0..1で保持し、M6A-022 tipDensity（先端mask coverage密度）へlogical stamp単位の直接variationとして適用する。0は完全identity/default、scaleは1 - amount * deterministicRandomでbase tipDensityを上回らない。これはM6A-057 Sprayのparticle density/個数ではなく、通常の1 logical stamp = 1 selected tipという境界を維持する。sampled-image tipが複数micro-dabへ展開される場合も1つのlogical stampで解決した同一density scaleを全micro-dabが共有する。Flow/Opacity/Textureとは独立し、M6A-051 size / 052 opacity / 053 rotation / 054 position / 048 generalized random / 027 tip selectionとはsaltとattempt indexを分離する。非表示attemptでもdensity indexを進め、可視logical recordにはdensityJitterScaleを保持するためend-tail reconciliationで再抽選しない。density jitterが有効なら他random機能がOFFでもstroke randomSeedを保存しpost-stroke correctionでも同一coverage列を再構築する。primitive dab / Worker / HistoryにはdensityJitter専用fieldを追加せず解決済みtipDensityだけを保存する。次はM6A-056 color jitterから再開する。\nM6A-056 color jitter:未完了\n',
)
append_once(
    'ILLUSTRO_DESIGN_MEMO.md',
    '## M6A density-jitter boundary — 2026-09-03',
    """
## M6A density-jitter boundary — 2026-09-03

**AUTHORITATIVE for M6A-055.** `BrushPresetV1.jitter.density` is a normalized `0..1` direct variation amount for the existing M6A-022 **tip mask coverage density**. `0` is exact/default identity. Each logical-stamp attempt resolves `densityScale = 1 - amount * random` from the persisted stroke seed, a density-jitter-specific salt, and a density-jitter-specific attempt index. The resolved scale multiplies the static `tipDensity`, never raises it above the configured base value, and does not modify flow, stroke opacity, texture strength, or geometry.

This setting is explicitly **not** Spray particle density. Ordinary strokes still produce one selected tip resource per logical stamp; when a sampled-image tip expands into several micro-dabs, all those primitives share the one resolved logical-stamp density scale. M6A-057 remains responsible for actual particle/scatter-mode multiplicity and particle density controls.

Density jitter has a random sequence independent from generalized random dynamics, size, opacity, rotation, position jitter, and random tip selection. Its attempt index advances even when a logical stamp is suppressed before primitive output. Visible logical-stamp records retain the resolved density scale so bounded mutable-tail/end-taper reconciliation does not resample. When enabled, density jitter requires the deterministic uint32 stroke seed even when every other random feature is disabled. Primitive dabs/history/Worker payloads continue to store only the resolved `tipDensity`; no density-jitter-specific renderer or persistence field is introduced.
""",
)

print('M6A-055 density jitter patch applied')
