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
    """export const DEFAULT_BRUSH_ROTATION_JITTER_V1 = 0 as const;

export function brushRotationJitterV1(preset: BrushPresetV1): number {
  const value = preset.jitter.rotation;
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1
    ? value
    : DEFAULT_BRUSH_ROTATION_JITTER_V1;
}

export function withBrushRotationJitterV1(preset: BrushPresetV1, amount: number): BrushPresetV1 {
  if (!Number.isFinite(amount) || amount < 0 || amount > 1) {
    throw new RangeError('brush rotation jitter must be within 0..1');
  }
  if (amount === DEFAULT_BRUSH_ROTATION_JITTER_V1) {
    const { rotation: _rotation, ...jitter } = preset.jitter;
    return normalizeBrushPresetV1({ ...preset, jitter });
  }
  return normalizeBrushPresetV1({
    ...preset,
    jitter: { ...preset.jitter, rotation: amount },
  });
}

export type BrushTipSelectionModeV1 = 'fixed' | 'sequence' | 'random-per-stamp';""",
)

# Kernel constants/random channel
replace_once(
    'src/gpu/baseline-brush.ts',
    'export const BASELINE_BRUSH_OPACITY_JITTER = 0 as const;\n',
    'export const BASELINE_BRUSH_OPACITY_JITTER = 0 as const;\nexport const BASELINE_BRUSH_ROTATION_JITTER = 0 as const;\n',
)
replace_once(
    'src/gpu/baseline-brush.ts',
    'const BASELINE_BRUSH_OPACITY_JITTER_SALT_V1 = 0x27d4eb2f as const;\n',
    'const BASELINE_BRUSH_OPACITY_JITTER_SALT_V1 = 0x27d4eb2f as const;\nconst BASELINE_BRUSH_ROTATION_JITTER_SALT_V1 = 0xb5297a4d as const;\n',
)
replace_once(
    'src/gpu/baseline-brush.ts',
    'export function deterministicBaselineBrushRandomV1(seed: number, stampIndex: number): number {',
    """export function deterministicBaselineBrushRotationJitterV1(
  seed: number,
  stampIndex: number,
): number {
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) {
    throw new RangeError('baseline brush rotation jitter seed must be uint32');
  }
  if (!Number.isSafeInteger(stampIndex) || stampIndex < 0) {
    throw new RangeError(
      'baseline brush rotation jitter stamp index must be a non-negative safe integer',
    );
  }
  let value =
    (seed ^
      BASELINE_BRUSH_ROTATION_JITTER_SALT_V1 ^
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
    '  readonly #opacityJitter: number;\n  readonly #randomSeed: number;\n',
    '  readonly #opacityJitter: number;\n  readonly #rotationJitter: number;\n  readonly #randomSeed: number;\n',
)
replace_once(
    'src/gpu/baseline-brush.ts',
    '  #opacityJitterStampIndex = 0;\n  #pathDistancePx = 0;\n',
    '  #opacityJitterStampIndex = 0;\n  #rotationJitterStampIndex = 0;\n  #pathDistancePx = 0;\n',
)
replace_once(
    'src/gpu/baseline-brush.ts',
    '      readonly opacityJitter?: number;\n      readonly randomSeed?: number;\n',
    '      readonly opacityJitter?: number;\n      readonly rotationJitter?: number;\n      readonly randomSeed?: number;\n',
)
replace_once(
    'src/gpu/baseline-brush.ts',
    '    const opacityJitter = options.opacityJitter ?? BASELINE_BRUSH_OPACITY_JITTER;\n    const randomSeed = options.randomSeed ?? 0;\n',
    '    const opacityJitter = options.opacityJitter ?? BASELINE_BRUSH_OPACITY_JITTER;\n    const rotationJitter = options.rotationJitter ?? BASELINE_BRUSH_ROTATION_JITTER;\n    const randomSeed = options.randomSeed ?? 0;\n',
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """    if (!Number.isFinite(opacityJitter) || opacityJitter < 0 || opacityJitter > 1) {
      throw new RangeError('baseline brush opacity jitter must be within 0..1');
    }
""",
    """    if (!Number.isFinite(opacityJitter) || opacityJitter < 0 || opacityJitter > 1) {
      throw new RangeError('baseline brush opacity jitter must be within 0..1');
    }
    if (!Number.isFinite(rotationJitter) || rotationJitter < 0 || rotationJitter > 1) {
      throw new RangeError('baseline brush rotation jitter must be within 0..1');
    }
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    '    this.#opacityJitter = opacityJitter;\n    this.#randomSeed = randomSeed >>> 0;\n',
    '    this.#opacityJitter = opacityJitter;\n    this.#rotationJitter = rotationJitter;\n    this.#randomSeed = randomSeed >>> 0;\n',
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """    if (this.#opacityJitter > 0) this.#opacityJitterStampIndex += 1;
    const sampledTipAlpha = this.#sampledTipAlphaForLogicalStamp();
    const record: BaselineLogicalStampRecordV1 = {
""",
    """    if (this.#opacityJitter > 0) this.#opacityJitterStampIndex += 1;
    const jitteredTipAngleDegrees =
      this.#rotationJitter > 0
        ? normalizeBaselineBrushTipAngleDegreesV1(
            tipAngleDegrees +
              (deterministicBaselineBrushRotationJitterV1(
                this.#randomSeed,
                this.#rotationJitterStampIndex,
              ) -
                0.5) *
                360 *
                this.#rotationJitter,
          )
        : tipAngleDegrees;
    if (this.#rotationJitter > 0) this.#rotationJitterStampIndex += 1;
    const sampledTipAlpha = this.#sampledTipAlphaForLogicalStamp();
    const record: BaselineLogicalStampRecordV1 = {
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    '      opacityJitterScale,\n      tiltUprightness,\n      tipAngleDegrees,\n',
    '      opacityJitterScale,\n      tiltUprightness,\n      tipAngleDegrees: jitteredTipAngleDegrees,\n',
)

# Canonical facade
replace_once(
    'src/app/canonical-raster-brush.ts',
    '      readonly opacityJitter?: number;\n      readonly randomSeed?: number;\n',
    '      readonly opacityJitter?: number;\n      readonly rotationJitter?: number;\n      readonly randomSeed?: number;\n',
)
replace_once(
    'src/app/canonical-raster-brush.ts',
    '      ...(options.opacityJitter === undefined ? {} : { opacityJitter: options.opacityJitter }),\n      ...(options.randomSeed === undefined ? {} : { randomSeed: options.randomSeed }),\n',
    '      ...(options.opacityJitter === undefined ? {} : { opacityJitter: options.opacityJitter }),\n      ...(options.rotationJitter === undefined ? {} : { rotationJitter: options.rotationJitter }),\n      ...(options.randomSeed === undefined ? {} : { randomSeed: options.randomSeed }),\n',
)

# Runtime session
replace_once(
    'src/app/paint-session-controller.ts',
    '  BASELINE_BRUSH_OPACITY_JITTER,\n  DEFAULT_BASELINE_BRUSH_COLOR_V1,\n',
    '  BASELINE_BRUSH_OPACITY_JITTER,\n  BASELINE_BRUSH_ROTATION_JITTER,\n  DEFAULT_BASELINE_BRUSH_COLOR_V1,\n',
)
replace_once(
    'src/app/paint-session-controller.ts',
    '  readonly brushOpacityJitter: number;\n  readonly brushTipAngleDegrees: number;\n',
    '  readonly brushOpacityJitter: number;\n  readonly brushRotationJitter: number;\n  readonly brushTipAngleDegrees: number;\n',
)
replace_once(
    'src/app/paint-session-controller.ts',
    '  #brushOpacityJitter: number = BASELINE_BRUSH_OPACITY_JITTER;\n  #brushTipAngleDegrees: number = BASELINE_BRUSH_TIP_ANGLE_DEGREES;\n',
    '  #brushOpacityJitter: number = BASELINE_BRUSH_OPACITY_JITTER;\n  #brushRotationJitter: number = BASELINE_BRUSH_ROTATION_JITTER;\n  #brushTipAngleDegrees: number = BASELINE_BRUSH_TIP_ANGLE_DEGREES;\n',
)
replace_once(
    'src/app/paint-session-controller.ts',
    '      brushOpacityJitter: this.#brushOpacityJitter,\n      brushTipAngleDegrees: this.#brushTipAngleDegrees,\n',
    '      brushOpacityJitter: this.#brushOpacityJitter,\n      brushRotationJitter: this.#brushRotationJitter,\n      brushTipAngleDegrees: this.#brushTipAngleDegrees,\n',
)
replace_once(
    'src/app/paint-session-controller.ts',
    """  brushOpacityJitter(): number {
    return this.#brushOpacityJitter;
  }

  setBrushTipAngleDegrees(angleDegrees: number): number {
""",
    """  brushOpacityJitter(): number {
    return this.#brushOpacityJitter;
  }

  setBrushRotationJitter(amount: number): number {
    if (!Number.isFinite(amount) || amount < 0 || amount > 1) {
      throw new RangeError('invalid runtime brush rotation jitter');
    }
    if (amount !== this.#brushRotationJitter) this.#clearActiveStroke();
    this.#brushRotationJitter = amount;
    return this.#brushRotationJitter;
  }

  brushRotationJitter(): number {
    return this.#brushRotationJitter;
  }

  setBrushTipAngleDegrees(angleDegrees: number): number {
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """    const opacityJitterEnabled = this.#brushOpacityJitter > 0;
    const randomSeed =
      this.#brushTipSelectionMode === 'random-per-stamp' ||
      randomDynamicsEnabled ||
      sizeJitterEnabled ||
      opacityJitterEnabled
        ? deterministicPaintStrokeSeedV1(strokeId)
        : undefined;
""",
    """    const opacityJitterEnabled = this.#brushOpacityJitter > 0;
    const rotationJitterEnabled = this.#brushRotationJitter > 0;
    const randomSeed =
      this.#brushTipSelectionMode === 'random-per-stamp' ||
      randomDynamicsEnabled ||
      sizeJitterEnabled ||
      opacityJitterEnabled ||
      rotationJitterEnabled
        ? deterministicPaintStrokeSeedV1(strokeId)
        : undefined;
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    '        opacityJitter: this.#brushOpacityJitter,\n        randomSeed: randomSeed ?? 0,\n',
    '        opacityJitter: this.#brushOpacityJitter,\n        rotationJitter: this.#brushRotationJitter,\n        randomSeed: randomSeed ?? 0,\n',
)

# Preset library
replace_once(
    'src/app/brush-preset-library.ts',
    '  withBrushOpacityJitterV1,\n  withBrushStrokeSpacingV1,\n',
    '  withBrushOpacityJitterV1,\n  withBrushRotationJitterV1,\n  withBrushStrokeSpacingV1,\n',
)
replace_once(
    'src/app/brush-preset-library.ts',
    'export function updateBrushPresetCustomTipV1(\n',
    """export function updateBrushPresetRotationJitterV1(
  state: BrushPresetLibraryStateV1,
  presetId: string,
  amount: number,
): BrushPresetLibraryStateV1 {
  return updateItemV1(state, presetId, (item) => {
    if (item.locked) throw new Error('locked brush preset cannot be edited');
    const current = withBrushRotationJitterV1(item.preset, amount);
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
    '  brushOpacityJitterV1,\n  BUILTIN_BRUSH_GRAIN_RESOURCES_V1,\n',
    '  brushOpacityJitterV1,\n  brushRotationJitterV1,\n  BUILTIN_BRUSH_GRAIN_RESOURCES_V1,\n',
)
replace_once(
    'src/app/brush-preset-controller.ts',
    '  updateBrushPresetOpacityJitterV1,\n  updateBrushPresetSpacingV1,\n',
    '  updateBrushPresetOpacityJitterV1,\n  updateBrushPresetRotationJitterV1,\n  updateBrushPresetSpacingV1,\n',
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  const opacityJitterRange = requireElement('#brush-opacity-jitter-range', HTMLInputElement);
  const opacityJitterNumber = requireElement('#brush-opacity-jitter-number', HTMLInputElement);
  const tipShape = requireElement('#brush-tip-shape', HTMLSelectElement);
""",
    """  const opacityJitterRange = requireElement('#brush-opacity-jitter-range', HTMLInputElement);
  const opacityJitterNumber = requireElement('#brush-opacity-jitter-number', HTMLInputElement);
  const rotationJitterRange = requireElement('#brush-rotation-jitter-range', HTMLInputElement);
  const rotationJitterNumber = requireElement('#brush-rotation-jitter-number', HTMLInputElement);
  const tipShape = requireElement('#brush-tip-shape', HTMLSelectElement);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    const opacityJitter = brushOpacityJitterV1(item.preset);
    input.paintSession.setBrushOpacityJitter(opacityJitter);
    const tipAssets = brushTipAssetsV1(item.preset);
""",
    """    const opacityJitter = brushOpacityJitterV1(item.preset);
    input.paintSession.setBrushOpacityJitter(opacityJitter);
    const rotationJitter = brushRotationJitterV1(item.preset);
    input.paintSession.setBrushRotationJitter(rotationJitter);
    const tipAssets = brushTipAssetsV1(item.preset);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    '    input.root.dataset.illustroBrushOpacityJitter = String(opacityJitter);\n    input.root.dataset.illustroBrushTipShape = brushTipShapeV1(item.preset);\n',
    '    input.root.dataset.illustroBrushOpacityJitter = String(opacityJitter);\n    input.root.dataset.illustroBrushRotationJitter = String(rotationJitter);\n    input.root.dataset.illustroBrushTipShape = brushTipShapeV1(item.preset);\n',
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    const opacityJitter = brushOpacityJitterV1(selected.preset);
    configurePair(opacityJitterRange, opacityJitterNumber, 0, 100, 1, opacityJitter * 100);
    tipShape.value = brushTipShapeV1(selected.preset);
""",
    """    const opacityJitter = brushOpacityJitterV1(selected.preset);
    configurePair(opacityJitterRange, opacityJitterNumber, 0, 100, 1, opacityJitter * 100);
    const rotationJitter = brushRotationJitterV1(selected.preset);
    configurePair(rotationJitterRange, rotationJitterNumber, 0, 100, 1, rotationJitter * 100);
    tipShape.value = brushTipShapeV1(selected.preset);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    const opacityJitterLabel =
      opacityJitter > 0 ? ` · OpacityJitter${Math.round(opacityJitter * 100)}%` : '';
    propertyStatus.textContent = `${parameters.sizePx.toFixed(1)} px · ${Math.round(parameters.opacity * 100)}% · ${Math.round(parameters.flow * 100)}% · H${Math.round(hardness * 100)}% · D${Math.round(tipDensity * 100)}% · S${Math.round(spacing.spacingRatio * 100)}% · A${Math.round(tipAngleDegrees)}° · F${Math.round(tipDirectionDegrees)}°${followRotation ? ' · Follow' : ''}${penOrientationEnabled ? ' · PenDir' : ''}${repeatLabel}${startLabel}${endLabel}${sizeTaperLabel}${opacityTaperLabel}${forcedTaperLabel}${stabilizationLabel}${postCorrectionLabel}${grainLabel}${paperLabel}${textureStrengthLabel}${textureScaleLabel}${textureRotationLabel}${textureBlendLabel}${pressureSizeLabel}${pressureOpacityLabel}${pressureFlowLabel}${pressureCurveLabel}${tiltSizeLabel}${tiltOpacityLabel}${tiltFlowLabel}${tiltCurveLabel}${velocitySizeLabel}${velocityOpacityLabel}${velocityFlowLabel}${velocityCurveLabel}${velocityMaximumLabel}${randomSizeLabel}${randomOpacityLabel}${randomFlowLabel}${randomCurveLabel}${minimumResponseLabel}${maximumResponseLabel}${sizeJitterLabel}${opacityJitterLabel}`;
""",
    """    const opacityJitterLabel =
      opacityJitter > 0 ? ` · OpacityJitter${Math.round(opacityJitter * 100)}%` : '';
    const rotationJitterLabel =
      rotationJitter > 0 ? ` · RotationJitter${Math.round(rotationJitter * 100)}%` : '';
    propertyStatus.textContent = `${parameters.sizePx.toFixed(1)} px · ${Math.round(parameters.opacity * 100)}% · ${Math.round(parameters.flow * 100)}% · H${Math.round(hardness * 100)}% · D${Math.round(tipDensity * 100)}% · S${Math.round(spacing.spacingRatio * 100)}% · A${Math.round(tipAngleDegrees)}° · F${Math.round(tipDirectionDegrees)}°${followRotation ? ' · Follow' : ''}${penOrientationEnabled ? ' · PenDir' : ''}${repeatLabel}${startLabel}${endLabel}${sizeTaperLabel}${opacityTaperLabel}${forcedTaperLabel}${stabilizationLabel}${postCorrectionLabel}${grainLabel}${paperLabel}${textureStrengthLabel}${textureScaleLabel}${textureRotationLabel}${textureBlendLabel}${pressureSizeLabel}${pressureOpacityLabel}${pressureFlowLabel}${pressureCurveLabel}${tiltSizeLabel}${tiltOpacityLabel}${tiltFlowLabel}${tiltCurveLabel}${velocitySizeLabel}${velocityOpacityLabel}${velocityFlowLabel}${velocityCurveLabel}${velocityMaximumLabel}${randomSizeLabel}${randomOpacityLabel}${randomFlowLabel}${randomCurveLabel}${minimumResponseLabel}${maximumResponseLabel}${sizeJitterLabel}${opacityJitterLabel}${rotationJitterLabel}`;
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    '      opacityJitterRange,\n      opacityJitterNumber,\n      tipShape,\n',
    '      opacityJitterRange,\n      opacityJitterNumber,\n      rotationJitterRange,\n      rotationJitterNumber,\n      tipShape,\n',
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  const onOpacityJitterRange = (): void => updateOpacityJitter(Number(opacityJitterRange.value));
  const onOpacityJitterNumber = (): void => updateOpacityJitter(Number(opacityJitterNumber.value));
  const onTipShape = (): void => {
""",
    """  const onOpacityJitterRange = (): void => updateOpacityJitter(Number(opacityJitterRange.value));
  const onOpacityJitterNumber = (): void => updateOpacityJitter(Number(opacityJitterNumber.value));
  const updateRotationJitter = (valuePercent: number): void =>
    mutate(() =>
      updateBrushPresetRotationJitterV1(state, state.selectedPresetId, valuePercent / 100),
    );
  const onRotationJitterRange = (): void => updateRotationJitter(Number(rotationJitterRange.value));
  const onRotationJitterNumber = (): void => updateRotationJitter(Number(rotationJitterNumber.value));
  const onTipShape = (): void => {
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  opacityJitterRange.addEventListener('input', onOpacityJitterRange);
  opacityJitterNumber.addEventListener('change', onOpacityJitterNumber);
  tipShape.addEventListener('change', onTipShape);
""",
    """  opacityJitterRange.addEventListener('input', onOpacityJitterRange);
  opacityJitterNumber.addEventListener('change', onOpacityJitterNumber);
  rotationJitterRange.addEventListener('input', onRotationJitterRange);
  rotationJitterNumber.addEventListener('change', onRotationJitterNumber);
  tipShape.addEventListener('change', onTipShape);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """      opacityJitterRange.removeEventListener('input', onOpacityJitterRange);
      opacityJitterNumber.removeEventListener('change', onOpacityJitterNumber);
      pressureCurveEditor?.dispose();
""",
    """      opacityJitterRange.removeEventListener('input', onOpacityJitterRange);
      opacityJitterNumber.removeEventListener('change', onOpacityJitterNumber);
      rotationJitterRange.removeEventListener('input', onRotationJitterRange);
      rotationJitterNumber.removeEventListener('change', onRotationJitterNumber);
      pressureCurveEditor?.dispose();
""",
)

# Reachable UI
replace_once(
    'src/index.html',
    """              <div class="shell-brush-property-row">
                <label for="brush-opacity-jitter-range">不透明度ジッター</label>
                <input id="brush-opacity-jitter-range" type="range" min="0" max="100" step="1" value="0" />
                <span class="shell-brush-property-number shell-brush-property-percent"><input id="brush-opacity-jitter-number" type="number" inputmode="decimal" min="0" max="100" step="1" value="0" aria-label="ブラシ不透明度ジッター" /><span>%</span></span>
              </div>
""",
    """              <div class="shell-brush-property-row">
                <label for="brush-opacity-jitter-range">不透明度ジッター</label>
                <input id="brush-opacity-jitter-range" type="range" min="0" max="100" step="1" value="0" />
                <span class="shell-brush-property-number shell-brush-property-percent"><input id="brush-opacity-jitter-number" type="number" inputmode="decimal" min="0" max="100" step="1" value="0" aria-label="ブラシ不透明度ジッター" /><span>%</span></span>
              </div>
              <div class="shell-brush-property-row">
                <label for="brush-rotation-jitter-range">回転ジッター</label>
                <input id="brush-rotation-jitter-range" type="range" min="0" max="100" step="1" value="0" />
                <span class="shell-brush-property-number shell-brush-property-percent"><input id="brush-rotation-jitter-number" type="number" inputmode="decimal" min="0" max="100" step="1" value="0" aria-label="ブラシ回転ジッター" /><span>%</span></span>
              </div>
""",
)

# Tests
test_path = Path('tests/unit/brush-rotation-jitter.test.ts')
if test_path.exists():
    raise RuntimeError('tests/unit/brush-rotation-jitter.test.ts already exists')
test_path.write_text("""import { describe, expect, it } from 'vitest';
import {
  brushRotationJitterV1,
  createBaselineBrushPresetV1,
  withBrushRotationJitterV1,
} from '../../src/domain/brush-schema.js';
import { PaintSessionControllerV1 } from '../../src/app/paint-session-controller.js';
import {
  BaselineBrushDabBuilderV1,
  deterministicBaselineBrushOpacityJitterV1,
  deterministicBaselineBrushRandomV1,
  deterministicBaselineBrushRotationJitterV1,
  deterministicBaselineBrushSizeJitterV1,
  normalizeBaselineBrushTipAngleDegreesV1,
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

function expectedAngle(seed: number, index: number, amount: number, baseDegrees: number): number {
  const offset = (deterministicBaselineBrushRotationJitterV1(seed, index) - 0.5) * 360 * amount;
  return normalizeBaselineBrushTipAngleDegreesV1(baseDegrees + offset);
}

describe('M6A-053 rotation jitter', () => {
  it('stores a normalized random-rotation amount with an exact zero default', () => {
    const preset = createBaselineBrushPresetV1({
      id: 'test.rotation-jitter',
      name: 'Rotation Jitter',
      category: 'Test',
      behavior: 'paint',
    });
    expect(brushRotationJitterV1(preset)).toBe(0);
    const changed = withBrushRotationJitterV1(preset, 0.4);
    expect(brushRotationJitterV1(changed)).toBe(0.4);
    expect(changed.jitter.rotation).toBe(0.4);
    const reset = withBrushRotationJitterV1(changed, 0);
    expect(brushRotationJitterV1(reset)).toBe(0);
    expect(reset.jitter.rotation).toBeUndefined();
    expect(() => withBrushRotationJitterV1(preset, -0.01)).toThrow(RangeError);
    expect(() => withBrushRotationJitterV1(preset, 1.01)).toThrow(RangeError);
  });

  it('keeps zero jitter as an exact tip-angle identity', () => {
    const baseline = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      spacingRatio: 1,
      tipShape: 'square',
      tipAngleDegrees: 32,
      tipDirectionDegrees: 7,
      randomSeed: 19,
    });
    const explicitZero = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      spacingRatio: 1,
      tipShape: 'square',
      tipAngleDegrees: 32,
      tipDirectionDegrees: 7,
      randomSeed: 19,
      rotationJitter: 0,
    });
    for (const brush of [baseline, explicitZero]) {
      brush.begin({ documentX: 0, documentY: 0 });
      brush.append([{ documentX: 20, documentY: 0 }]);
      brush.finish();
    }
    expect(explicitZero.dabs()).toEqual(baseline.dabs());
  });

  it('applies a deterministic symmetric angle offset after the resolved base angle', () => {
    const seed = 0x12345678;
    const amount = 0.5;
    const baseDegrees = 20;
    const brush = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      spacingRatio: 1,
      tipShape: 'square',
      tipAngleDegrees: 30,
      tipDirectionDegrees: 10,
      rotationJitter: amount,
      randomSeed: seed,
    });
    brush.begin({ documentX: 0, documentY: 0 });
    brush.append([{ documentX: 20, documentY: 0 }]);
    brush.finish();
    const dabs = brush.dabs();
    expect(dabs).toHaveLength(2);
    expect(dabs[0]?.tipAngleDegrees).toBeCloseTo(expectedAngle(seed, 0, amount, baseDegrees), 10);
    expect(dabs[1]?.tipAngleDegrees).toBeCloseTo(expectedAngle(seed, 1, amount, baseDegrees), 10);
  });

  it('advances the rotation-jitter attempt index even when taper suppresses a logical stamp', () => {
    const seed = 0x89abcdef;
    const amount = 0.75;
    const brush = new BaselineBrushDabBuilderV1({
      sizePx: 10,
      spacingRatio: 1,
      startTaperLengthPx: 10,
      tipAngleDegrees: 40,
      tipDirectionDegrees: 10,
      rotationJitter: amount,
      randomSeed: seed,
    });
    brush.begin({ documentX: 0, documentY: 0 });
    brush.append([{ documentX: 10, documentY: 0 }]);
    const dabs = brush.dabs();
    expect(dabs).toHaveLength(1);
    expect(dabs[0]?.tipAngleDegrees).toBeCloseTo(expectedAngle(seed, 1, amount, 30), 10);
  });

  it('uses a random channel independent from generalized, size and opacity random channels', () => {
    const seed = 0x0badc0de;
    const value = deterministicBaselineBrushRotationJitterV1(seed, 0);
    expect(value).not.toBe(deterministicBaselineBrushRandomV1(seed, 0));
    expect(value).not.toBe(deterministicBaselineBrushSizeJitterV1(seed, 0));
    expect(value).not.toBe(deterministicBaselineBrushOpacityJitterV1(seed, 0));
    const plain = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      spacingRatio: 1,
      tipShape: 'square',
      rotationJitter: 0.5,
      randomSeed: seed,
    });
    const withOtherRandomChannels = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      spacingRatio: 1,
      tipShape: 'square',
      rotationJitter: 0.5,
      sizeJitter: 0.5,
      opacityJitter: 0.5,
      randomFlowEnabled: true,
      randomSeed: seed,
    });
    for (const brush of [plain, withOtherRandomChannels]) {
      brush.begin({ documentX: 0, documentY: 0 });
      brush.append([{ documentX: 20, documentY: 0 }]);
      brush.finish();
    }
    expect(withOtherRandomChannels.dabs().map((dab) => dab.tipAngleDegrees)).toEqual(
      plain.dabs().map((dab) => dab.tipAngleDegrees),
    );
  });

  it('reuses the resolved jittered angle when reconciling the mutable end tail', () => {
    const brush = new BaselineBrushDabBuilderV1({
      sizePx: 10,
      spacingRatio: 1,
      endTaperLengthPx: 10,
      sizeTaperMinimumRatio: 1,
      opacityTaperMinimumRatio: 1,
      tipShape: 'square',
      rotationJitter: 0.6,
      randomSeed: 0xfeed1234,
    });
    brush.begin({ documentX: 0, documentY: 0 });
    brush.append([
      { documentX: 10, documentY: 0 },
      { documentX: 20, documentY: 0 },
    ]);
    const beforeFinish = brush.dabs().map((dab) => dab.tipAngleDegrees);
    brush.finish();
    expect(brush.dabs().map((dab) => dab.tipAngleDegrees)).toEqual(beforeFinish);
  });

  it('captures the runtime amount without adding a rotation-jitter primitive field', () => {
    const session = new PaintSessionControllerV1(new FakeRendererDocumentPort());
    expect(session.setBrushRotationJitter(0.35)).toBe(0.35);
    expect(session.snapshot().brushRotationJitter).toBe(0.35);
    const [dab] = new BaselineBrushDabBuilderV1({
      rotationJitter: 0.35,
      randomSeed: 7,
    }).beginDelta({ documentX: 0, documentY: 0 });
    expect(dab).toBeDefined();
    expect('rotationJitter' in (dab ?? {})).toBe(false);
    expect(dab?.tipAngleDegrees).toBeDefined();
  });
});
""", encoding='utf-8')

# Verification
replace_once(
    'scripts/verify-m6a-brush.mjs',
    """requireText(
  progress,
  'M6A-PERF-001 incremental active-stroke rendering（stable prefix + bounded mutable tail）:未完了',
  'performance gate must remain separately incomplete',
);
""",
    """requireText(progress, 'M6A-053 rotation jitter:完了', 'M6A-053 progress is not complete');
requireText(
  read('src/domain/brush-schema.ts'),
  'brushRotationJitterV1',
  'rotation-jitter preset helpers missing',
);
requireText(
  read('src/gpu/baseline-brush.ts'),
  'deterministicBaselineBrushRotationJitterV1',
  'deterministic rotation-jitter channel missing',
);
requireText(
  read('src/gpu/baseline-brush.ts'),
  'tipAngleDegrees: jitteredTipAngleDegrees',
  'rotation jitter is not composed into the resolved logical-stamp angle',
);
requireText(
  read('src/app/paint-session-controller.ts'),
  'setBrushRotationJitter',
  'rotation jitter is not connected to runtime brush state',
);
requireText(
  read('src/app/paint-session-controller.ts'),
  'rotationJitterEnabled',
  'rotation jitter does not capture a deterministic persistent stroke seed',
);
requireText(
  read('src/index.html'),
  'id="brush-rotation-jitter-range"',
  'reachable rotation-jitter control missing',
);
requireText(
  read('tests/unit/brush-rotation-jitter.test.ts'),
  'advances the rotation-jitter attempt index even when taper suppresses a logical stamp',
  'rotation-jitter attempt-index regression missing',
);
requireText(
  read('tests/unit/brush-rotation-jitter.test.ts'),
  'uses a random channel independent from generalized, size and opacity random channels',
  'rotation-jitter channel-independence regression missing',
);
requireText(
  read('tests/unit/brush-rotation-jitter.test.ts'),
  'reuses the resolved jittered angle when reconciling the mutable end tail',
  'rotation-jitter tail reconciliation regression missing',
);

requireText(
  progress,
  'M6A-PERF-001 incremental active-stroke rendering（stable prefix + bounded mutable tail）:未完了',
  'performance gate must remain separately incomplete',
);
""",
)

# Progress and canonical design boundary
replace_once(
    'IMPLEMENTATION_PROGRESS.md',
    'M6A-053 rotation jitter:未完了\nM6A-054 position/scatter jitter:未完了\n',
    'M6A-053 rotation jitter:完了\n再開メモ: M6A-053 rotation jitterはCanonical Brush Modelのjitter.rotationを0..1のランダム強度として保持し、0を完全identity/defaultとする。logical stamp attemptごとにstroke randomSeed + rotation-jitter専用saltから決定的0..1値を生成し、(random - 0.5) * 360° * amountをstatic tip angle / intrinsic direction / follow-stroke rotation / pen orientationで解決済みの角度へ最後に加算する。100%は-180°以上+180°未満の全方位offsetを覆い、0%は既存angle pathを一切変更しない。M6A-051 size / M6A-052 opacity / M6A-048 generalized random / M6A-027 tip selectionとはsaltとattempt indexを分離する。taper等で非表示になったlogical attemptでもindexは進め、可視recordにはjitter適用済みtipAngleDegreesを保持するためend-tail reconciliationで再抽選しない。rotation jitterが有効なら他random機能がOFFでもstroke randomSeedを保存しpost-stroke correctionでも同一角度列を再構築する。primitive dab / Worker / HistoryにはrotationJitter専用fieldを追加せず既存tipAngleDegreesだけを保存する。次はM6A-054 position/scatter jitterから再開する。\nM6A-054 position/scatter jitter:未完了\n',
)
append_once(
    'ILLUSTRO_DESIGN_MEMO.md',
    '## M6A rotation-jitter boundary — 2026-09-03',
    """
## M6A rotation-jitter boundary — 2026-09-03

**AUTHORITATIVE for M6A-053.** `BrushPresetV1.jitter.rotation` is a normalized `0..1` random-rotation strength with exact/default identity at `0`. Each logical-stamp attempt uses the persisted stroke `randomSeed`, a rotation-jitter-specific fixed salt, and a rotation-jitter-specific attempt index. The random sample maps symmetrically to `(random - 0.5) * 360° * amount`; therefore `amount = 1` spans the complete `[-180°, +180°)` offset domain without introducing a directional bias.

Rotation jitter is composed **after** the ordinary orientation source has been resolved. The base angle remains the result of static tip angle, intrinsic tip direction, follow-stroke rotation, and explicit pen-orientation precedence. Jitter then offsets that resolved angle and normalizes it into the existing canonical angle domain. This behavior is independently implemented but intentionally matches the established painting-app concept of a random brush-tip angle strength rather than replacing direction-following or pen-orientation modes.

The rotation random channel is independent from generalized random dynamics, size jitter, opacity jitter, and random tip selection. Its attempt index advances even when a stamp attempt is suppressed before primitive output. Visible logical-stamp records retain only the already-resolved jittered `tipAngleDegrees`, so bounded mutable-tail/end-taper reconciliation never resamples rotation. When rotation jitter is active the stroke persists a deterministic uint32 seed even if every other randomized feature is disabled. Primitive dabs, Worker payloads, history, and recovery continue to use the existing resolved `tipAngleDegrees`; no rotation-jitter-specific renderer or persistence field is added.
""",
)

print('M6A-053 rotation jitter patch applied')
