from pathlib import Path


def read(path: str) -> str:
    return Path(path).read_text(encoding='utf-8')


def write(path: str, text: str) -> None:
    Path(path).write_text(text, encoding='utf-8')


def replace_once(path: str, old: str, new: str) -> None:
    text = read(path)
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{path}: expected exactly one anchor, found {count}: {old[:100]!r}')
    write(path, text.replace(old, new, 1))


def append_once(path: str, marker: str, block: str) -> None:
    text = read(path)
    if marker in text:
        return
    if not text.endswith('\n'):
        text += '\n'
    write(path, text + '\n' + block.strip() + '\n')


# ---------------------------------------------------------------------------
# Canonical preset schema
# ---------------------------------------------------------------------------
replace_once(
    'src/domain/brush-schema.ts',
    "export type BrushTipSelectionModeV1 = 'fixed' | 'sequence' | 'random-per-stamp';",
    """export const DEFAULT_BRUSH_OPACITY_JITTER_V1 = 0 as const;

export function brushOpacityJitterV1(preset: BrushPresetV1): number {
  const value = preset.jitter.opacity;
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1
    ? value
    : DEFAULT_BRUSH_OPACITY_JITTER_V1;
}

export function withBrushOpacityJitterV1(preset: BrushPresetV1, amount: number): BrushPresetV1 {
  if (!Number.isFinite(amount) || amount < 0 || amount > 1) {
    throw new RangeError('brush opacity jitter must be within 0..1');
  }
  if (amount === DEFAULT_BRUSH_OPACITY_JITTER_V1) {
    const { opacity: _opacity, ...jitter } = preset.jitter;
    return normalizeBrushPresetV1({ ...preset, jitter });
  }
  return normalizeBrushPresetV1({
    ...preset,
    jitter: { ...preset.jitter, opacity: amount },
  });
}

export type BrushTipSelectionModeV1 = 'fixed' | 'sequence' | 'random-per-stamp';""",
)

# ---------------------------------------------------------------------------
# Canonical dab kernel
# ---------------------------------------------------------------------------
replace_once(
    'src/gpu/baseline-brush.ts',
    'export const BASELINE_BRUSH_SIZE_JITTER = 0 as const;\n',
    'export const BASELINE_BRUSH_SIZE_JITTER = 0 as const;\nexport const BASELINE_BRUSH_OPACITY_JITTER = 0 as const;\n',
)
replace_once(
    'src/gpu/baseline-brush.ts',
    'const BASELINE_BRUSH_SIZE_JITTER_SALT_V1 = 0x63d83595 as const;\n',
    'const BASELINE_BRUSH_SIZE_JITTER_SALT_V1 = 0x63d83595 as const;\nconst BASELINE_BRUSH_OPACITY_JITTER_SALT_V1 = 0x27d4eb2f as const;\n',
)
replace_once(
    'src/gpu/baseline-brush.ts',
    'export function deterministicBaselineBrushRandomV1(seed: number, stampIndex: number): number {',
    """export function deterministicBaselineBrushOpacityJitterV1(
  seed: number,
  stampIndex: number,
): number {
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) {
    throw new RangeError('baseline brush opacity jitter seed must be uint32');
  }
  if (!Number.isSafeInteger(stampIndex) || stampIndex < 0) {
    throw new RangeError(
      'baseline brush opacity jitter stamp index must be a non-negative safe integer',
    );
  }
  let value =
    (seed ^
      BASELINE_BRUSH_OPACITY_JITTER_SALT_V1 ^
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
    '  readonly sizeJitterScale: number;\n  readonly tiltUprightness: number;\n',
    '  readonly sizeJitterScale: number;\n  readonly opacityJitterScale: number;\n  readonly tiltUprightness: number;\n',
)
replace_once(
    'src/gpu/baseline-brush.ts',
    '  readonly #sizeJitter: number;\n  readonly #randomSeed: number;\n',
    '  readonly #sizeJitter: number;\n  readonly #opacityJitter: number;\n  readonly #randomSeed: number;\n',
)
replace_once(
    'src/gpu/baseline-brush.ts',
    '  #sizeJitterStampIndex = 0;\n  #pathDistancePx = 0;\n',
    '  #sizeJitterStampIndex = 0;\n  #opacityJitterStampIndex = 0;\n  #pathDistancePx = 0;\n',
)
replace_once(
    'src/gpu/baseline-brush.ts',
    '      readonly sizeJitter?: number;\n      readonly randomSeed?: number;\n',
    '      readonly sizeJitter?: number;\n      readonly opacityJitter?: number;\n      readonly randomSeed?: number;\n',
)
replace_once(
    'src/gpu/baseline-brush.ts',
    '    const sizeJitter = options.sizeJitter ?? BASELINE_BRUSH_SIZE_JITTER;\n    const randomSeed = options.randomSeed ?? 0;\n',
    '    const sizeJitter = options.sizeJitter ?? BASELINE_BRUSH_SIZE_JITTER;\n    const opacityJitter = options.opacityJitter ?? BASELINE_BRUSH_OPACITY_JITTER;\n    const randomSeed = options.randomSeed ?? 0;\n',
)
replace_once(
    'src/gpu/baseline-brush.ts',
    "    if (!Number.isFinite(sizeJitter) || sizeJitter < 0 || sizeJitter > 1) {\n      throw new RangeError('baseline brush size jitter must be within 0..1');\n    }\n",
    """    if (!Number.isFinite(sizeJitter) || sizeJitter < 0 || sizeJitter > 1) {
      throw new RangeError('baseline brush size jitter must be within 0..1');
    }
    if (!Number.isFinite(opacityJitter) || opacityJitter < 0 || opacityJitter > 1) {
      throw new RangeError('baseline brush opacity jitter must be within 0..1');
    }
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    '    this.#sizeJitter = sizeJitter;\n    this.#randomSeed = randomSeed >>> 0;\n',
    '    this.#sizeJitter = sizeJitter;\n    this.#opacityJitter = opacityJitter;\n    this.#randomSeed = randomSeed >>> 0;\n',
)
replace_once(
    'src/gpu/baseline-brush.ts',
    "      | 'sizeJitterScale'\n      | 'tiltUprightness'\n",
    "      | 'sizeJitterScale'\n      | 'opacityJitterScale'\n      | 'tiltUprightness'\n",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    '      this.#strokeOpacity * opacityResponse,\n',
    '      this.#strokeOpacity * opacityResponse * stamp.opacityJitterScale,\n',
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """    if (this.#sizeJitter > 0) this.#sizeJitterStampIndex += 1;
    const sampledTipAlpha = this.#sampledTipAlphaForLogicalStamp();
""",
    """    if (this.#sizeJitter > 0) this.#sizeJitterStampIndex += 1;
    const opacityJitterScale =
      this.#opacityJitter > 0
        ? 1 -
          this.#opacityJitter *
            deterministicBaselineBrushOpacityJitterV1(
              this.#randomSeed,
              this.#opacityJitterStampIndex,
            )
        : 1;
    if (this.#opacityJitter > 0) this.#opacityJitterStampIndex += 1;
    const sampledTipAlpha = this.#sampledTipAlphaForLogicalStamp();
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    '      randomInput,\n      sizeJitterScale,\n      tiltUprightness,\n',
    '      randomInput,\n      sizeJitterScale,\n      opacityJitterScale,\n      tiltUprightness,\n',
)

# ---------------------------------------------------------------------------
# Canonical facade
# ---------------------------------------------------------------------------
replace_once(
    'src/app/canonical-raster-brush.ts',
    '      readonly sizeJitter?: number;\n      readonly randomSeed?: number;\n',
    '      readonly sizeJitter?: number;\n      readonly opacityJitter?: number;\n      readonly randomSeed?: number;\n',
)
replace_once(
    'src/app/canonical-raster-brush.ts',
    '      ...(options.sizeJitter === undefined ? {} : { sizeJitter: options.sizeJitter }),\n      ...(options.randomSeed === undefined ? {} : { randomSeed: options.randomSeed }),\n',
    '      ...(options.sizeJitter === undefined ? {} : { sizeJitter: options.sizeJitter }),\n      ...(options.opacityJitter === undefined ? {} : { opacityJitter: options.opacityJitter }),\n      ...(options.randomSeed === undefined ? {} : { randomSeed: options.randomSeed }),\n',
)

# ---------------------------------------------------------------------------
# Runtime session
# ---------------------------------------------------------------------------
replace_once(
    'src/app/paint-session-controller.ts',
    '  BASELINE_BRUSH_SIZE_JITTER,\n  DEFAULT_BASELINE_BRUSH_COLOR_V1,\n',
    '  BASELINE_BRUSH_SIZE_JITTER,\n  BASELINE_BRUSH_OPACITY_JITTER,\n  DEFAULT_BASELINE_BRUSH_COLOR_V1,\n',
)
replace_once(
    'src/app/paint-session-controller.ts',
    '  readonly brushSizeJitter: number;\n  readonly brushTipAngleDegrees: number;\n',
    '  readonly brushSizeJitter: number;\n  readonly brushOpacityJitter: number;\n  readonly brushTipAngleDegrees: number;\n',
)
replace_once(
    'src/app/paint-session-controller.ts',
    '  #brushSizeJitter: number = BASELINE_BRUSH_SIZE_JITTER;\n  #brushTipAngleDegrees: number = BASELINE_BRUSH_TIP_ANGLE_DEGREES;\n',
    '  #brushSizeJitter: number = BASELINE_BRUSH_SIZE_JITTER;\n  #brushOpacityJitter: number = BASELINE_BRUSH_OPACITY_JITTER;\n  #brushTipAngleDegrees: number = BASELINE_BRUSH_TIP_ANGLE_DEGREES;\n',
)
replace_once(
    'src/app/paint-session-controller.ts',
    '      brushSizeJitter: this.#brushSizeJitter,\n      brushTipAngleDegrees: this.#brushTipAngleDegrees,\n',
    '      brushSizeJitter: this.#brushSizeJitter,\n      brushOpacityJitter: this.#brushOpacityJitter,\n      brushTipAngleDegrees: this.#brushTipAngleDegrees,\n',
)
replace_once(
    'src/app/paint-session-controller.ts',
    """  brushSizeJitter(): number {
    return this.#brushSizeJitter;
  }

  setBrushTipAngleDegrees(angleDegrees: number): number {
""",
    """  brushSizeJitter(): number {
    return this.#brushSizeJitter;
  }

  setBrushOpacityJitter(amount: number): number {
    if (!Number.isFinite(amount) || amount < 0 || amount > 1) {
      throw new RangeError('invalid runtime brush opacity jitter');
    }
    if (amount !== this.#brushOpacityJitter) this.#clearActiveStroke();
    this.#brushOpacityJitter = amount;
    return this.#brushOpacityJitter;
  }

  brushOpacityJitter(): number {
    return this.#brushOpacityJitter;
  }

  setBrushTipAngleDegrees(angleDegrees: number): number {
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """    const sizeJitterEnabled = this.#brushSizeJitter > 0;
    const randomSeed =
      this.#brushTipSelectionMode === 'random-per-stamp' ||
      randomDynamicsEnabled ||
      sizeJitterEnabled
        ? deterministicPaintStrokeSeedV1(strokeId)
        : undefined;
""",
    """    const sizeJitterEnabled = this.#brushSizeJitter > 0;
    const opacityJitterEnabled = this.#brushOpacityJitter > 0;
    const randomSeed =
      this.#brushTipSelectionMode === 'random-per-stamp' ||
      randomDynamicsEnabled ||
      sizeJitterEnabled ||
      opacityJitterEnabled
        ? deterministicPaintStrokeSeedV1(strokeId)
        : undefined;
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    '        sizeJitter: this.#brushSizeJitter,\n        randomSeed: randomSeed ?? 0,\n',
    '        sizeJitter: this.#brushSizeJitter,\n        opacityJitter: this.#brushOpacityJitter,\n        randomSeed: randomSeed ?? 0,\n',
)

# ---------------------------------------------------------------------------
# Preset library mutation
# ---------------------------------------------------------------------------
replace_once(
    'src/app/brush-preset-library.ts',
    '  withBrushSizeJitterV1,\n  withBrushStrokeSpacingV1,\n',
    '  withBrushSizeJitterV1,\n  withBrushOpacityJitterV1,\n  withBrushStrokeSpacingV1,\n',
)
replace_once(
    'src/app/brush-preset-library.ts',
    'export function updateBrushPresetCustomTipV1(\n',
    """export function updateBrushPresetOpacityJitterV1(
  state: BrushPresetLibraryStateV1,
  presetId: string,
  amount: number,
): BrushPresetLibraryStateV1 {
  return updateItemV1(state, presetId, (item) => {
    if (item.locked) throw new Error('locked brush preset cannot be edited');
    const current = withBrushOpacityJitterV1(item.preset, amount);
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

# ---------------------------------------------------------------------------
# Brush Properties controller
# ---------------------------------------------------------------------------
replace_once(
    'src/app/brush-preset-controller.ts',
    '  brushSizeJitterV1,\n  BUILTIN_BRUSH_GRAIN_RESOURCES_V1,\n',
    '  brushSizeJitterV1,\n  brushOpacityJitterV1,\n  BUILTIN_BRUSH_GRAIN_RESOURCES_V1,\n',
)
replace_once(
    'src/app/brush-preset-controller.ts',
    '  updateBrushPresetSizeJitterV1,\n  updateBrushPresetSpacingV1,\n',
    '  updateBrushPresetSizeJitterV1,\n  updateBrushPresetOpacityJitterV1,\n  updateBrushPresetSpacingV1,\n',
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  const sizeJitterRange = requireElement('#brush-size-jitter-range', HTMLInputElement);
  const sizeJitterNumber = requireElement('#brush-size-jitter-number', HTMLInputElement);
  const tipShape = requireElement('#brush-tip-shape', HTMLSelectElement);
""",
    """  const sizeJitterRange = requireElement('#brush-size-jitter-range', HTMLInputElement);
  const sizeJitterNumber = requireElement('#brush-size-jitter-number', HTMLInputElement);
  const opacityJitterRange = requireElement('#brush-opacity-jitter-range', HTMLInputElement);
  const opacityJitterNumber = requireElement('#brush-opacity-jitter-number', HTMLInputElement);
  const tipShape = requireElement('#brush-tip-shape', HTMLSelectElement);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    const sizeJitter = brushSizeJitterV1(item.preset);
    input.paintSession.setBrushSizeJitter(sizeJitter);
    const tipAssets = brushTipAssetsV1(item.preset);
""",
    """    const sizeJitter = brushSizeJitterV1(item.preset);
    input.paintSession.setBrushSizeJitter(sizeJitter);
    const opacityJitter = brushOpacityJitterV1(item.preset);
    input.paintSession.setBrushOpacityJitter(opacityJitter);
    const tipAssets = brushTipAssetsV1(item.preset);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    '    input.root.dataset.illustroBrushSizeJitter = String(sizeJitter);\n    input.root.dataset.illustroBrushTipShape = brushTipShapeV1(item.preset);\n',
    '    input.root.dataset.illustroBrushSizeJitter = String(sizeJitter);\n    input.root.dataset.illustroBrushOpacityJitter = String(opacityJitter);\n    input.root.dataset.illustroBrushTipShape = brushTipShapeV1(item.preset);\n',
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    const sizeJitter = brushSizeJitterV1(selected.preset);
    configurePair(sizeJitterRange, sizeJitterNumber, 0, 100, 1, sizeJitter * 100);
    tipShape.value = brushTipShapeV1(selected.preset);
""",
    """    const sizeJitter = brushSizeJitterV1(selected.preset);
    configurePair(sizeJitterRange, sizeJitterNumber, 0, 100, 1, sizeJitter * 100);
    const opacityJitter = brushOpacityJitterV1(selected.preset);
    configurePair(opacityJitterRange, opacityJitterNumber, 0, 100, 1, opacityJitter * 100);
    tipShape.value = brushTipShapeV1(selected.preset);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    const sizeJitterLabel = sizeJitter > 0 ? ` · SizeJitter${Math.round(sizeJitter * 100)}%` : '';
    propertyStatus.textContent = `${parameters.sizePx.toFixed(1)} px · ${Math.round(parameters.opacity * 100)}% · ${Math.round(parameters.flow * 100)}% · H${Math.round(hardness * 100)}% · D${Math.round(tipDensity * 100)}% · S${Math.round(spacing.spacingRatio * 100)}% · A${Math.round(tipAngleDegrees)}° · F${Math.round(tipDirectionDegrees)}°${followRotation ? ' · Follow' : ''}${penOrientationEnabled ? ' · PenDir' : ''}${repeatLabel}${startLabel}${endLabel}${sizeTaperLabel}${opacityTaperLabel}${forcedTaperLabel}${stabilizationLabel}${postCorrectionLabel}${grainLabel}${paperLabel}${textureStrengthLabel}${textureScaleLabel}${textureRotationLabel}${textureBlendLabel}${pressureSizeLabel}${pressureOpacityLabel}${pressureFlowLabel}${pressureCurveLabel}${tiltSizeLabel}${tiltOpacityLabel}${tiltFlowLabel}${tiltCurveLabel}${velocitySizeLabel}${velocityOpacityLabel}${velocityFlowLabel}${velocityCurveLabel}${velocityMaximumLabel}${randomSizeLabel}${randomOpacityLabel}${randomFlowLabel}${randomCurveLabel}${minimumResponseLabel}${maximumResponseLabel}${sizeJitterLabel}`;
""",
    """    const sizeJitterLabel = sizeJitter > 0 ? ` · SizeJitter${Math.round(sizeJitter * 100)}%` : '';
    const opacityJitterLabel =
      opacityJitter > 0 ? ` · OpacityJitter${Math.round(opacityJitter * 100)}%` : '';
    propertyStatus.textContent = `${parameters.sizePx.toFixed(1)} px · ${Math.round(parameters.opacity * 100)}% · ${Math.round(parameters.flow * 100)}% · H${Math.round(hardness * 100)}% · D${Math.round(tipDensity * 100)}% · S${Math.round(spacing.spacingRatio * 100)}% · A${Math.round(tipAngleDegrees)}° · F${Math.round(tipDirectionDegrees)}°${followRotation ? ' · Follow' : ''}${penOrientationEnabled ? ' · PenDir' : ''}${repeatLabel}${startLabel}${endLabel}${sizeTaperLabel}${opacityTaperLabel}${forcedTaperLabel}${stabilizationLabel}${postCorrectionLabel}${grainLabel}${paperLabel}${textureStrengthLabel}${textureScaleLabel}${textureRotationLabel}${textureBlendLabel}${pressureSizeLabel}${pressureOpacityLabel}${pressureFlowLabel}${pressureCurveLabel}${tiltSizeLabel}${tiltOpacityLabel}${tiltFlowLabel}${tiltCurveLabel}${velocitySizeLabel}${velocityOpacityLabel}${velocityFlowLabel}${velocityCurveLabel}${velocityMaximumLabel}${randomSizeLabel}${randomOpacityLabel}${randomFlowLabel}${randomCurveLabel}${minimumResponseLabel}${maximumResponseLabel}${sizeJitterLabel}${opacityJitterLabel}`;
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    '      sizeJitterRange,\n      sizeJitterNumber,\n      tipShape,\n',
    '      sizeJitterRange,\n      sizeJitterNumber,\n      opacityJitterRange,\n      opacityJitterNumber,\n      tipShape,\n',
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  const onSizeJitterRange = (): void => updateSizeJitter(Number(sizeJitterRange.value));
  const onSizeJitterNumber = (): void => updateSizeJitter(Number(sizeJitterNumber.value));
  const onTipShape = (): void => {
""",
    """  const onSizeJitterRange = (): void => updateSizeJitter(Number(sizeJitterRange.value));
  const onSizeJitterNumber = (): void => updateSizeJitter(Number(sizeJitterNumber.value));
  const updateOpacityJitter = (valuePercent: number): void =>
    mutate(() =>
      updateBrushPresetOpacityJitterV1(state, state.selectedPresetId, valuePercent / 100),
    );
  const onOpacityJitterRange = (): void => updateOpacityJitter(Number(opacityJitterRange.value));
  const onOpacityJitterNumber = (): void => updateOpacityJitter(Number(opacityJitterNumber.value));
  const onTipShape = (): void => {
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  sizeJitterRange.addEventListener('input', onSizeJitterRange);
  sizeJitterNumber.addEventListener('change', onSizeJitterNumber);
  tipShape.addEventListener('change', onTipShape);
""",
    """  sizeJitterRange.addEventListener('input', onSizeJitterRange);
  sizeJitterNumber.addEventListener('change', onSizeJitterNumber);
  opacityJitterRange.addEventListener('input', onOpacityJitterRange);
  opacityJitterNumber.addEventListener('change', onOpacityJitterNumber);
  tipShape.addEventListener('change', onTipShape);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """      sizeJitterRange.removeEventListener('input', onSizeJitterRange);
      sizeJitterNumber.removeEventListener('change', onSizeJitterNumber);
      pressureCurveEditor?.dispose();
""",
    """      sizeJitterRange.removeEventListener('input', onSizeJitterRange);
      sizeJitterNumber.removeEventListener('change', onSizeJitterNumber);
      opacityJitterRange.removeEventListener('input', onOpacityJitterRange);
      opacityJitterNumber.removeEventListener('change', onOpacityJitterNumber);
      pressureCurveEditor?.dispose();
""",
)

# ---------------------------------------------------------------------------
# Reachable UI
# ---------------------------------------------------------------------------
replace_once(
    'src/index.html',
    """              <div class="shell-brush-property-row">
                <label for="brush-size-jitter-range">サイズジッター</label>
                <input id="brush-size-jitter-range" type="range" min="0" max="100" step="1" value="0" />
                <span class="shell-brush-property-number shell-brush-property-percent"><input id="brush-size-jitter-number" type="number" inputmode="decimal" min="0" max="100" step="1" value="0" aria-label="ブラシサイズジッター" /><span>%</span></span>
              </div>
""",
    """              <div class="shell-brush-property-row">
                <label for="brush-size-jitter-range">サイズジッター</label>
                <input id="brush-size-jitter-range" type="range" min="0" max="100" step="1" value="0" />
                <span class="shell-brush-property-number shell-brush-property-percent"><input id="brush-size-jitter-number" type="number" inputmode="decimal" min="0" max="100" step="1" value="0" aria-label="ブラシサイズジッター" /><span>%</span></span>
              </div>
              <div class="shell-brush-property-row">
                <label for="brush-opacity-jitter-range">不透明度ジッター</label>
                <input id="brush-opacity-jitter-range" type="range" min="0" max="100" step="1" value="0" />
                <span class="shell-brush-property-number shell-brush-property-percent"><input id="brush-opacity-jitter-number" type="number" inputmode="decimal" min="0" max="100" step="1" value="0" aria-label="ブラシ不透明度ジッター" /><span>%</span></span>
              </div>
""",
)

# ---------------------------------------------------------------------------
# Regression coverage
# ---------------------------------------------------------------------------
test_path = Path('tests/unit/brush-opacity-jitter.test.ts')
if test_path.exists():
    raise RuntimeError('tests/unit/brush-opacity-jitter.test.ts already exists')
test_path.write_text("""import { describe, expect, it } from 'vitest';
import {
  brushOpacityJitterV1,
  createBaselineBrushPresetV1,
  withBrushOpacityJitterV1,
} from '../../src/domain/brush-schema.js';
import { PaintSessionControllerV1 } from '../../src/app/paint-session-controller.js';
import {
  BaselineBrushDabBuilderV1,
  deterministicBaselineBrushOpacityJitterV1,
  deterministicBaselineBrushRandomV1,
  deterministicBaselineBrushSizeJitterV1,
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

describe('M6A-052 opacity jitter', () => {
  it('stores a normalized direct jitter amount with an exact zero default', () => {
    const preset = createBaselineBrushPresetV1({
      id: 'test.opacity-jitter',
      name: 'Opacity Jitter',
      category: 'Test',
      behavior: 'paint',
    });
    expect(brushOpacityJitterV1(preset)).toBe(0);
    const changed = withBrushOpacityJitterV1(preset, 0.4);
    expect(brushOpacityJitterV1(changed)).toBe(0.4);
    expect(changed.jitter.opacity).toBe(0.4);
    const reset = withBrushOpacityJitterV1(changed, 0);
    expect(brushOpacityJitterV1(reset)).toBe(0);
    expect(reset.jitter.opacity).toBeUndefined();
    expect(() => withBrushOpacityJitterV1(preset, -0.01)).toThrow(RangeError);
    expect(() => withBrushOpacityJitterV1(preset, 1.01)).toThrow(RangeError);
  });

  it('keeps zero jitter as an exact stroke-opacity identity', () => {
    const baseline = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      opacity: 0.8,
      spacingRatio: 1,
      randomSeed: 19,
    });
    baseline.begin({ documentX: 0, documentY: 0 });
    baseline.append([{ documentX: 20, documentY: 0 }]);
    baseline.finish();
    const explicitZero = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      opacity: 0.8,
      spacingRatio: 1,
      randomSeed: 19,
      opacityJitter: 0,
    });
    explicitZero.begin({ documentX: 0, documentY: 0 });
    explicitZero.append([{ documentX: 20, documentY: 0 }]);
    explicitZero.finish();
    expect(explicitZero.dabs()).toEqual(baseline.dabs());
  });

  it('applies deterministic one-sided opacity variation per logical stamp attempt', () => {
    const seed = 0x12345678;
    const amount = 0.5;
    const brush = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      opacity: 0.8,
      spacingRatio: 1,
      opacityJitter: amount,
      randomSeed: seed,
    });
    brush.begin({ documentX: 0, documentY: 0 });
    brush.append([{ documentX: 20, documentY: 0 }]);
    brush.finish();
    const dabs = brush.dabs();
    expect(dabs).toHaveLength(2);
    expect(dabs[0]?.strokeOpacity).toBeCloseTo(
      0.8 * (1 - amount * deterministicBaselineBrushOpacityJitterV1(seed, 0)),
      10,
    );
    expect(dabs[1]?.strokeOpacity).toBeCloseTo(
      0.8 * (1 - amount * deterministicBaselineBrushOpacityJitterV1(seed, 1)),
      10,
    );
  });

  it('advances the opacity-jitter attempt index even when taper suppresses a logical stamp', () => {
    const seed = 0x89abcdef;
    const amount = 0.75;
    const brush = new BaselineBrushDabBuilderV1({
      sizePx: 10,
      opacity: 1,
      spacingRatio: 1,
      startTaperLengthPx: 10,
      opacityJitter: amount,
      randomSeed: seed,
    });
    brush.begin({ documentX: 0, documentY: 0 });
    brush.append([{ documentX: 10, documentY: 0 }]);
    const dabs = brush.dabs();
    expect(dabs).toHaveLength(1);
    expect(dabs[0]?.strokeOpacity).toBeCloseTo(
      1 - amount * deterministicBaselineBrushOpacityJitterV1(seed, 1),
      10,
    );
  });

  it('uses a random channel independent from generalized random dynamics and size jitter', () => {
    const seed = 0x0badc0de;
    expect(deterministicBaselineBrushOpacityJitterV1(seed, 0)).not.toBe(
      deterministicBaselineBrushRandomV1(seed, 0),
    );
    expect(deterministicBaselineBrushOpacityJitterV1(seed, 0)).not.toBe(
      deterministicBaselineBrushSizeJitterV1(seed, 0),
    );
    const plain = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      spacingRatio: 1,
      opacityJitter: 0.5,
      randomSeed: seed,
    });
    const withOtherRandomChannels = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      spacingRatio: 1,
      opacityJitter: 0.5,
      sizeJitter: 0.5,
      randomSeed: seed,
      randomFlowEnabled: true,
    });
    for (const brush of [plain, withOtherRandomChannels]) {
      brush.begin({ documentX: 0, documentY: 0 });
      brush.append([{ documentX: 20, documentY: 0 }]);
      brush.finish();
    }
    expect(withOtherRandomChannels.dabs().map((dab) => dab.strokeOpacity)).toEqual(
      plain.dabs().map((dab) => dab.strokeOpacity),
    );
  });

  it('reuses the stored opacity-jitter scale when reconciling the mutable end tail', () => {
    const seed = 0xfeed1234;
    const amount = 0.6;
    const brush = new BaselineBrushDabBuilderV1({
      sizePx: 10,
      opacity: 0.8,
      spacingRatio: 1,
      endTaperLengthPx: 10,
      sizeTaperMinimumRatio: 1,
      opacityTaperMinimumRatio: 1,
      opacityJitter: amount,
      randomSeed: seed,
    });
    brush.begin({ documentX: 0, documentY: 0 });
    brush.append([
      { documentX: 10, documentY: 0 },
      { documentX: 20, documentY: 0 },
    ]);
    const beforeFinish = brush.dabs().map((dab) => dab.strokeOpacity);
    brush.finish();
    expect(brush.dabs().map((dab) => dab.strokeOpacity)).toEqual(beforeFinish);
  });

  it('captures the runtime amount without extending the primitive dab schema', () => {
    const session = new PaintSessionControllerV1(new FakeRendererDocumentPort());
    expect(session.setBrushOpacityJitter(0.35)).toBe(0.35);
    expect(session.snapshot().brushOpacityJitter).toBe(0.35);
    const [dab] = new BaselineBrushDabBuilderV1({ opacityJitter: 0.35, randomSeed: 7 }).beginDelta({
      documentX: 0,
      documentY: 0,
    });
    expect(dab).toBeDefined();
    expect('opacityJitter' in (dab ?? {})).toBe(false);
  });
});
""", encoding='utf-8')

# ---------------------------------------------------------------------------
# Verification gate
# ---------------------------------------------------------------------------
replace_once(
    'scripts/verify-m6a-brush.mjs',
    """requireText(
  progress,
  'M6A-PERF-001 incremental active-stroke rendering（stable prefix + bounded mutable tail）:未完了',
  'performance gate must remain separately incomplete',
);
""",
    """requireText(progress, 'M6A-052 opacity jitter:完了', 'M6A-052 progress is not complete');
requireText(
  read('src/domain/brush-schema.ts'),
  'brushOpacityJitterV1',
  'opacity-jitter preset helpers missing',
);
requireText(
  read('src/gpu/baseline-brush.ts'),
  'deterministicBaselineBrushOpacityJitterV1',
  'deterministic opacity-jitter channel missing',
);
requireText(
  read('src/gpu/baseline-brush.ts'),
  'stamp.opacityJitterScale',
  'resolved opacity jitter is not applied to logical-stamp opacity cap',
);
requireText(
  read('src/app/paint-session-controller.ts'),
  'setBrushOpacityJitter',
  'opacity jitter is not connected to runtime brush state',
);
requireText(
  read('src/app/paint-session-controller.ts'),
  'opacityJitterEnabled',
  'opacity jitter does not capture a deterministic persistent stroke seed',
);
requireText(
  read('src/index.html'),
  'id="brush-opacity-jitter-range"',
  'reachable opacity-jitter control missing',
);
requireText(
  read('tests/unit/brush-opacity-jitter.test.ts'),
  'advances the opacity-jitter attempt index even when taper suppresses a logical stamp',
  'opacity-jitter attempt-index regression missing',
);
requireText(
  read('tests/unit/brush-opacity-jitter.test.ts'),
  'uses a random channel independent from generalized random dynamics and size jitter',
  'opacity-jitter channel-independence regression missing',
);
requireText(
  read('tests/unit/brush-opacity-jitter.test.ts'),
  'reuses the stored opacity-jitter scale when reconciling the mutable end tail',
  'opacity-jitter tail reconciliation regression missing',
);

requireText(
  progress,
  'M6A-PERF-001 incremental active-stroke rendering（stable prefix + bounded mutable tail）:未完了',
  'performance gate must remain separately incomplete',
);
""",
)

# ---------------------------------------------------------------------------
# Canonical docs / recovery checkpoint
# ---------------------------------------------------------------------------
replace_once(
    'IMPLEMENTATION_PROGRESS.md',
    'M6A-052 opacity jitter:未完了\nM6A-053 rotation jitter:未完了\n',
    'M6A-052 opacity jitter:完了\n再開メモ: M6A-052 opacity jitterはCanonical Brush Modelのjitter.opacityを0..1の直接変動量として保持し、0を完全identity/defaultとする。logical stamp attemptごとにstroke randomSeed + opacity-jitter専用saltから決定的0..1値を生成し、dynamic responseで解決したstrokeOpacity capへ(1 - amount * random)を乗算するためbase opacityを上回らない一方向variationとなる。M6A-051 size jitter / M6A-048 generalized random dynamics / M6A-027 random tip selectionとはsaltとattempt indexを分離し、各機能のON/OFFで他系列をずらさない。start/end/forced taperはper-dab flow側の責務を維持し、opacity jitterはflow/depositを変更しない。可視logical stamp recordには解決済みopacityJitterScaleを保持しend-tail reconciliationで再抽選しない。opacity jitterが有効なら他のrandom機能がOFFでもstrokeId由来uint32 randomSeedを保存し、post-stroke correction再構築でも同一結果を得る。primitive dab / Worker / Historyにはjitter専用fieldを追加せず解決済みstrokeOpacityだけを保存する。次はM6A-053 rotation jitterから再開する。\nM6A-053 rotation jitter:未完了\n',
)
append_once(
    'ILLUSTRO_DESIGN_MEMO.md',
    '## M6A opacity-jitter boundary — 2026-09-03',
    """
## M6A opacity-jitter boundary — 2026-09-03

**AUTHORITATIVE for M6A-052.** `BrushPresetV1.jitter.opacity` is a normalized `0..1` direct variation amount with exact/default identity at `0`. Each logical-stamp **attempt** resolves one deterministic opacity-jitter sample from the persisted stroke `randomSeed`, an opacity-jitter-specific fixed salt, and an opacity-jitter-specific attempt index. The resolved scale is `1 - amount * random`, so this stage never raises the configured base opacity cap.

Opacity jitter is an independent random channel from M6A-051 size jitter, M6A-048 generalized random dynamics, and M6A-027 random tip selection. Enabling/disabling one channel must not advance or reseed another channel. Attempt indices advance even when a logical stamp is suppressed before primitive output, and visible logical-stamp records retain the already-resolved opacity-jitter scale so bounded mutable-tail/end-taper reconciliation never resamples randomness.

The resolved opacity-jitter scale multiplies the logical stamp's **stroke-opacity cap after dynamic-response resolution**. It does not alter flow/deposit, size, texture, tip selection, or geometry. Existing start/end/forced taper continues to own per-dab deposit fade, and dynamic minimum/maximum response keeps its existing source-composition semantics. Primitive dabs/history/Worker payloads store only the resolved `strokeOpacity`; no jitter-specific renderer or persistence schema is introduced. When opacity jitter is active, the paint stroke must persist the deterministic uint32 random seed even if every other random feature is disabled, so release reconciliation and post-stroke correction rebuild the same result.
""",
)

print('M6A-052 opacity jitter patch applied')
