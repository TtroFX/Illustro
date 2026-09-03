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
    """export const DEFAULT_BRUSH_POSITION_JITTER_V1 = 0 as const;

export function brushPositionJitterV1(preset: BrushPresetV1): number {
  const value = preset.jitter.position;
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1
    ? value
    : DEFAULT_BRUSH_POSITION_JITTER_V1;
}

export function withBrushPositionJitterV1(preset: BrushPresetV1, amount: number): BrushPresetV1 {
  if (!Number.isFinite(amount) || amount < 0 || amount > 1) {
    throw new RangeError('brush position jitter must be within 0..1');
  }
  if (amount === DEFAULT_BRUSH_POSITION_JITTER_V1) {
    const { position: _position, ...jitter } = preset.jitter;
    return normalizeBrushPresetV1({ ...preset, jitter });
  }
  return normalizeBrushPresetV1({
    ...preset,
    jitter: { ...preset.jitter, position: amount },
  });
}

export type BrushTipSelectionModeV1 = 'fixed' | 'sequence' | 'random-per-stamp';""",
)

# Kernel
replace_once(
    'src/gpu/baseline-brush.ts',
    'export const BASELINE_BRUSH_ROTATION_JITTER = 0 as const;\n',
    'export const BASELINE_BRUSH_ROTATION_JITTER = 0 as const;\nexport const BASELINE_BRUSH_POSITION_JITTER = 0 as const;\n',
)
replace_once(
    'src/gpu/baseline-brush.ts',
    'const BASELINE_BRUSH_ROTATION_JITTER_SALT_V1 = 0xb5297a4d as const;\n',
    """const BASELINE_BRUSH_ROTATION_JITTER_SALT_V1 = 0xb5297a4d as const;
const BASELINE_BRUSH_POSITION_JITTER_ANGLE_SALT_V1 = 0x9e6c63d1 as const;
const BASELINE_BRUSH_POSITION_JITTER_RADIUS_SALT_V1 = 0xc2b2ae35 as const;
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    'export function deterministicBaselineBrushRandomV1(seed: number, stampIndex: number): number {',
    """function deterministicBaselineBrushPositionComponentV1(
  seed: number,
  stampIndex: number,
  salt: number,
): number {
  let value = (seed ^ salt ^ Math.imul((stampIndex + 1) >>> 0, 0x9e3779b1)) >>> 0;
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d) >>> 0;
  value ^= value >>> 15;
  value = Math.imul(value, 0x846ca68b) >>> 0;
  value ^= value >>> 16;
  return (value >>> 0) / 0x100000000;
}

export function deterministicBaselineBrushPositionJitterV1(
  seed: number,
  stampIndex: number,
): Readonly<{ x: number; y: number }> {
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) {
    throw new RangeError('baseline brush position jitter seed must be uint32');
  }
  if (!Number.isSafeInteger(stampIndex) || stampIndex < 0) {
    throw new RangeError(
      'baseline brush position jitter stamp index must be a non-negative safe integer',
    );
  }
  const angle =
    deterministicBaselineBrushPositionComponentV1(
      seed,
      stampIndex,
      BASELINE_BRUSH_POSITION_JITTER_ANGLE_SALT_V1,
    ) *
    Math.PI *
    2;
  const radius = Math.sqrt(
    deterministicBaselineBrushPositionComponentV1(
      seed,
      stampIndex,
      BASELINE_BRUSH_POSITION_JITTER_RADIUS_SALT_V1,
    ),
  );
  return Object.freeze({ x: Math.cos(angle) * radius, y: Math.sin(angle) * radius });
}

export function deterministicBaselineBrushRandomV1(seed: number, stampIndex: number): number {""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    '  readonly #rotationJitter: number;\n  readonly #randomSeed: number;\n',
    '  readonly #rotationJitter: number;\n  readonly #positionJitter: number;\n  readonly #randomSeed: number;\n',
)
replace_once(
    'src/gpu/baseline-brush.ts',
    '  #rotationJitterStampIndex = 0;\n  #pathDistancePx = 0;\n',
    '  #rotationJitterStampIndex = 0;\n  #positionJitterStampIndex = 0;\n  #pathDistancePx = 0;\n',
)
replace_once(
    'src/gpu/baseline-brush.ts',
    '      readonly rotationJitter?: number;\n      readonly randomSeed?: number;\n',
    '      readonly rotationJitter?: number;\n      readonly positionJitter?: number;\n      readonly randomSeed?: number;\n',
)
replace_once(
    'src/gpu/baseline-brush.ts',
    '    const rotationJitter = options.rotationJitter ?? BASELINE_BRUSH_ROTATION_JITTER;\n    const randomSeed = options.randomSeed ?? 0;\n',
    '    const rotationJitter = options.rotationJitter ?? BASELINE_BRUSH_ROTATION_JITTER;\n    const positionJitter = options.positionJitter ?? BASELINE_BRUSH_POSITION_JITTER;\n    const randomSeed = options.randomSeed ?? 0;\n',
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """    if (!Number.isFinite(rotationJitter) || rotationJitter < 0 || rotationJitter > 1) {
      throw new RangeError('baseline brush rotation jitter must be within 0..1');
    }
""",
    """    if (!Number.isFinite(rotationJitter) || rotationJitter < 0 || rotationJitter > 1) {
      throw new RangeError('baseline brush rotation jitter must be within 0..1');
    }
    if (!Number.isFinite(positionJitter) || positionJitter < 0 || positionJitter > 1) {
      throw new RangeError('baseline brush position jitter must be within 0..1');
    }
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    '    this.#rotationJitter = rotationJitter;\n    this.#randomSeed = randomSeed >>> 0;\n',
    '    this.#rotationJitter = rotationJitter;\n    this.#positionJitter = positionJitter;\n    this.#randomSeed = randomSeed >>> 0;\n',
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """    if (this.#rotationJitter > 0) this.#rotationJitterStampIndex += 1;
    const sampledTipAlpha = this.#sampledTipAlphaForLogicalStamp();
    const record: BaselineLogicalStampRecordV1 = {
      x,
      y,
""",
    """    if (this.#rotationJitter > 0) this.#rotationJitterStampIndex += 1;
    const positionJitterVector =
      this.#positionJitter > 0
        ? deterministicBaselineBrushPositionJitterV1(
            this.#randomSeed,
            this.#positionJitterStampIndex,
          )
        : null;
    if (this.#positionJitter > 0) this.#positionJitterStampIndex += 1;
    const maximumPositionOffsetPx = this.#radius * 2 * this.#positionJitter;
    const jitteredX =
      positionJitterVector === null ? x : x + positionJitterVector.x * maximumPositionOffsetPx;
    const jitteredY =
      positionJitterVector === null ? y : y + positionJitterVector.y * maximumPositionOffsetPx;
    const sampledTipAlpha = this.#sampledTipAlphaForLogicalStamp();
    const record: BaselineLogicalStampRecordV1 = {
      x: jitteredX,
      y: jitteredY,
""",
)

# Canonical facade
replace_once(
    'src/app/canonical-raster-brush.ts',
    '      readonly rotationJitter?: number;\n      readonly randomSeed?: number;\n',
    '      readonly rotationJitter?: number;\n      readonly positionJitter?: number;\n      readonly randomSeed?: number;\n',
)
replace_once(
    'src/app/canonical-raster-brush.ts',
    '      ...(options.rotationJitter === undefined ? {} : { rotationJitter: options.rotationJitter }),\n      ...(options.randomSeed === undefined ? {} : { randomSeed: options.randomSeed }),\n',
    '      ...(options.rotationJitter === undefined ? {} : { rotationJitter: options.rotationJitter }),\n      ...(options.positionJitter === undefined ? {} : { positionJitter: options.positionJitter }),\n      ...(options.randomSeed === undefined ? {} : { randomSeed: options.randomSeed }),\n',
)

# Runtime session
replace_once(
    'src/app/paint-session-controller.ts',
    '  BASELINE_BRUSH_ROTATION_JITTER,\n  DEFAULT_BASELINE_BRUSH_COLOR_V1,\n',
    '  BASELINE_BRUSH_ROTATION_JITTER,\n  BASELINE_BRUSH_POSITION_JITTER,\n  DEFAULT_BASELINE_BRUSH_COLOR_V1,\n',
)
replace_once(
    'src/app/paint-session-controller.ts',
    '  readonly brushRotationJitter: number;\n  readonly brushTipAngleDegrees: number;\n',
    '  readonly brushRotationJitter: number;\n  readonly brushPositionJitter: number;\n  readonly brushTipAngleDegrees: number;\n',
)
replace_once(
    'src/app/paint-session-controller.ts',
    '  #brushRotationJitter: number = BASELINE_BRUSH_ROTATION_JITTER;\n  #brushTipAngleDegrees: number = BASELINE_BRUSH_TIP_ANGLE_DEGREES;\n',
    '  #brushRotationJitter: number = BASELINE_BRUSH_ROTATION_JITTER;\n  #brushPositionJitter: number = BASELINE_BRUSH_POSITION_JITTER;\n  #brushTipAngleDegrees: number = BASELINE_BRUSH_TIP_ANGLE_DEGREES;\n',
)
replace_once(
    'src/app/paint-session-controller.ts',
    '      brushRotationJitter: this.#brushRotationJitter,\n      brushTipAngleDegrees: this.#brushTipAngleDegrees,\n',
    '      brushRotationJitter: this.#brushRotationJitter,\n      brushPositionJitter: this.#brushPositionJitter,\n      brushTipAngleDegrees: this.#brushTipAngleDegrees,\n',
)
replace_once(
    'src/app/paint-session-controller.ts',
    """  brushRotationJitter(): number {
    return this.#brushRotationJitter;
  }

  setBrushTipAngleDegrees(angleDegrees: number): number {
""",
    """  brushRotationJitter(): number {
    return this.#brushRotationJitter;
  }

  setBrushPositionJitter(amount: number): number {
    if (!Number.isFinite(amount) || amount < 0 || amount > 1) {
      throw new RangeError('invalid runtime brush position jitter');
    }
    if (amount !== this.#brushPositionJitter) this.#clearActiveStroke();
    this.#brushPositionJitter = amount;
    return this.#brushPositionJitter;
  }

  brushPositionJitter(): number {
    return this.#brushPositionJitter;
  }

  setBrushTipAngleDegrees(angleDegrees: number): number {
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """    const rotationJitterEnabled = this.#brushRotationJitter > 0;
    const randomSeed =
      this.#brushTipSelectionMode === 'random-per-stamp' ||
      randomDynamicsEnabled ||
      sizeJitterEnabled ||
      opacityJitterEnabled ||
      rotationJitterEnabled
        ? deterministicPaintStrokeSeedV1(strokeId)
        : undefined;
""",
    """    const rotationJitterEnabled = this.#brushRotationJitter > 0;
    const positionJitterEnabled = this.#brushPositionJitter > 0;
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
)
replace_once(
    'src/app/paint-session-controller.ts',
    '        rotationJitter: this.#brushRotationJitter,\n        randomSeed: randomSeed ?? 0,\n',
    '        rotationJitter: this.#brushRotationJitter,\n        positionJitter: this.#brushPositionJitter,\n        randomSeed: randomSeed ?? 0,\n',
)

# Preset library mutation
replace_once(
    'src/app/brush-preset-library.ts',
    '  withBrushRotationJitterV1,\n  withBrushStrokeSpacingV1,\n',
    '  withBrushRotationJitterV1,\n  withBrushPositionJitterV1,\n  withBrushStrokeSpacingV1,\n',
)
replace_once(
    'src/app/brush-preset-library.ts',
    'export function updateBrushPresetCustomTipV1(\n',
    """export function updateBrushPresetPositionJitterV1(
  state: BrushPresetLibraryStateV1,
  presetId: string,
  amount: number,
): BrushPresetLibraryStateV1 {
  return updateItemV1(state, presetId, (item) => {
    if (item.locked) throw new Error('locked brush preset cannot be edited');
    const current = withBrushPositionJitterV1(item.preset, amount);
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
    '  brushRotationJitterV1,\n  BUILTIN_BRUSH_GRAIN_RESOURCES_V1,\n',
    '  brushRotationJitterV1,\n  brushPositionJitterV1,\n  BUILTIN_BRUSH_GRAIN_RESOURCES_V1,\n',
)
replace_once(
    'src/app/brush-preset-controller.ts',
    '  updateBrushPresetRotationJitterV1,\n  updateBrushPresetSpacingV1,\n',
    '  updateBrushPresetRotationJitterV1,\n  updateBrushPresetPositionJitterV1,\n  updateBrushPresetSpacingV1,\n',
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  const rotationJitterRange = requireElement('#brush-rotation-jitter-range', HTMLInputElement);
  const rotationJitterNumber = requireElement('#brush-rotation-jitter-number', HTMLInputElement);
  const tipShape = requireElement('#brush-tip-shape', HTMLSelectElement);
""",
    """  const rotationJitterRange = requireElement('#brush-rotation-jitter-range', HTMLInputElement);
  const rotationJitterNumber = requireElement('#brush-rotation-jitter-number', HTMLInputElement);
  const positionJitterRange = requireElement('#brush-position-jitter-range', HTMLInputElement);
  const positionJitterNumber = requireElement('#brush-position-jitter-number', HTMLInputElement);
  const tipShape = requireElement('#brush-tip-shape', HTMLSelectElement);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    const rotationJitter = brushRotationJitterV1(item.preset);
    input.paintSession.setBrushRotationJitter(rotationJitter);
    const tipAssets = brushTipAssetsV1(item.preset);
""",
    """    const rotationJitter = brushRotationJitterV1(item.preset);
    input.paintSession.setBrushRotationJitter(rotationJitter);
    const positionJitter = brushPositionJitterV1(item.preset);
    input.paintSession.setBrushPositionJitter(positionJitter);
    const tipAssets = brushTipAssetsV1(item.preset);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    '    input.root.dataset.illustroBrushRotationJitter = String(rotationJitter);\n    input.root.dataset.illustroBrushTipShape = brushTipShapeV1(item.preset);\n',
    '    input.root.dataset.illustroBrushRotationJitter = String(rotationJitter);\n    input.root.dataset.illustroBrushPositionJitter = String(positionJitter);\n    input.root.dataset.illustroBrushTipShape = brushTipShapeV1(item.preset);\n',
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    const rotationJitter = brushRotationJitterV1(selected.preset);
    configurePair(rotationJitterRange, rotationJitterNumber, 0, 100, 1, rotationJitter * 100);
    tipShape.value = brushTipShapeV1(selected.preset);
""",
    """    const rotationJitter = brushRotationJitterV1(selected.preset);
    configurePair(rotationJitterRange, rotationJitterNumber, 0, 100, 1, rotationJitter * 100);
    const positionJitter = brushPositionJitterV1(selected.preset);
    configurePair(positionJitterRange, positionJitterNumber, 0, 100, 1, positionJitter * 100);
    tipShape.value = brushTipShapeV1(selected.preset);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    const rotationJitterLabel =
      rotationJitter > 0 ? ` · RotationJitter${Math.round(rotationJitter * 100)}%` : '';
    propertyStatus.textContent = `${parameters.sizePx.toFixed(1)} px · ${Math.round(parameters.opacity * 100)}% · ${Math.round(parameters.flow * 100)}% · H${Math.round(hardness * 100)}% · D${Math.round(tipDensity * 100)}% · S${Math.round(spacing.spacingRatio * 100)}% · A${Math.round(tipAngleDegrees)}° · F${Math.round(tipDirectionDegrees)}°${followRotation ? ' · Follow' : ''}${penOrientationEnabled ? ' · PenDir' : ''}${repeatLabel}${startLabel}${endLabel}${sizeTaperLabel}${opacityTaperLabel}${forcedTaperLabel}${stabilizationLabel}${postCorrectionLabel}${grainLabel}${paperLabel}${textureStrengthLabel}${textureScaleLabel}${textureRotationLabel}${textureBlendLabel}${pressureSizeLabel}${pressureOpacityLabel}${pressureFlowLabel}${pressureCurveLabel}${tiltSizeLabel}${tiltOpacityLabel}${tiltFlowLabel}${tiltCurveLabel}${velocitySizeLabel}${velocityOpacityLabel}${velocityFlowLabel}${velocityCurveLabel}${velocityMaximumLabel}${randomSizeLabel}${randomOpacityLabel}${randomFlowLabel}${randomCurveLabel}${minimumResponseLabel}${maximumResponseLabel}${sizeJitterLabel}${opacityJitterLabel}${rotationJitterLabel}`;
""",
    """    const rotationJitterLabel =
      rotationJitter > 0 ? ` · RotationJitter${Math.round(rotationJitter * 100)}%` : '';
    const positionJitterLabel =
      positionJitter > 0 ? ` · PositionJitter${Math.round(positionJitter * 100)}%` : '';
    propertyStatus.textContent = `${parameters.sizePx.toFixed(1)} px · ${Math.round(parameters.opacity * 100)}% · ${Math.round(parameters.flow * 100)}% · H${Math.round(hardness * 100)}% · D${Math.round(tipDensity * 100)}% · S${Math.round(spacing.spacingRatio * 100)}% · A${Math.round(tipAngleDegrees)}° · F${Math.round(tipDirectionDegrees)}°${followRotation ? ' · Follow' : ''}${penOrientationEnabled ? ' · PenDir' : ''}${repeatLabel}${startLabel}${endLabel}${sizeTaperLabel}${opacityTaperLabel}${forcedTaperLabel}${stabilizationLabel}${postCorrectionLabel}${grainLabel}${paperLabel}${textureStrengthLabel}${textureScaleLabel}${textureRotationLabel}${textureBlendLabel}${pressureSizeLabel}${pressureOpacityLabel}${pressureFlowLabel}${pressureCurveLabel}${tiltSizeLabel}${tiltOpacityLabel}${tiltFlowLabel}${tiltCurveLabel}${velocitySizeLabel}${velocityOpacityLabel}${velocityFlowLabel}${velocityCurveLabel}${velocityMaximumLabel}${randomSizeLabel}${randomOpacityLabel}${randomFlowLabel}${randomCurveLabel}${minimumResponseLabel}${maximumResponseLabel}${sizeJitterLabel}${opacityJitterLabel}${rotationJitterLabel}${positionJitterLabel}`;
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    '      rotationJitterRange,\n      rotationJitterNumber,\n      tipShape,\n',
    '      rotationJitterRange,\n      rotationJitterNumber,\n      positionJitterRange,\n      positionJitterNumber,\n      tipShape,\n',
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  const onRotationJitterRange = (): void => updateRotationJitter(Number(rotationJitterRange.value));
  const onRotationJitterNumber = (): void => updateRotationJitter(Number(rotationJitterNumber.value));
  const onTipShape = (): void => {
""",
    """  const onRotationJitterRange = (): void => updateRotationJitter(Number(rotationJitterRange.value));
  const onRotationJitterNumber = (): void => updateRotationJitter(Number(rotationJitterNumber.value));
  const updatePositionJitter = (valuePercent: number): void =>
    mutate(() =>
      updateBrushPresetPositionJitterV1(state, state.selectedPresetId, valuePercent / 100),
    );
  const onPositionJitterRange = (): void => updatePositionJitter(Number(positionJitterRange.value));
  const onPositionJitterNumber = (): void => updatePositionJitter(Number(positionJitterNumber.value));
  const onTipShape = (): void => {
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  rotationJitterRange.addEventListener('input', onRotationJitterRange);
  rotationJitterNumber.addEventListener('change', onRotationJitterNumber);
  tipShape.addEventListener('change', onTipShape);
""",
    """  rotationJitterRange.addEventListener('input', onRotationJitterRange);
  rotationJitterNumber.addEventListener('change', onRotationJitterNumber);
  positionJitterRange.addEventListener('input', onPositionJitterRange);
  positionJitterNumber.addEventListener('change', onPositionJitterNumber);
  tipShape.addEventListener('change', onTipShape);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """      rotationJitterRange.removeEventListener('input', onRotationJitterRange);
      rotationJitterNumber.removeEventListener('change', onRotationJitterNumber);
      pressureCurveEditor?.dispose();
""",
    """      rotationJitterRange.removeEventListener('input', onRotationJitterRange);
      rotationJitterNumber.removeEventListener('change', onRotationJitterNumber);
      positionJitterRange.removeEventListener('input', onPositionJitterRange);
      positionJitterNumber.removeEventListener('change', onPositionJitterNumber);
      pressureCurveEditor?.dispose();
""",
)

# Reachable UI
replace_once(
    'src/index.html',
    """              <div class="shell-brush-property-row">
                <label for="brush-rotation-jitter-range">回転ジッター</label>
                <input id="brush-rotation-jitter-range" type="range" min="0" max="100" step="1" value="0" />
                <span class="shell-brush-property-number shell-brush-property-percent"><input id="brush-rotation-jitter-number" type="number" inputmode="decimal" min="0" max="100" step="1" value="0" aria-label="ブラシ回転ジッター" /><span>%</span></span>
              </div>
""",
    """              <div class="shell-brush-property-row">
                <label for="brush-rotation-jitter-range">回転ジッター</label>
                <input id="brush-rotation-jitter-range" type="range" min="0" max="100" step="1" value="0" />
                <span class="shell-brush-property-number shell-brush-property-percent"><input id="brush-rotation-jitter-number" type="number" inputmode="decimal" min="0" max="100" step="1" value="0" aria-label="ブラシ回転ジッター" /><span>%</span></span>
              </div>
              <div class="shell-brush-property-row">
                <label for="brush-position-jitter-range">位置ジッター</label>
                <input id="brush-position-jitter-range" type="range" min="0" max="100" step="1" value="0" />
                <span class="shell-brush-property-number shell-brush-property-percent"><input id="brush-position-jitter-number" type="number" inputmode="decimal" min="0" max="100" step="1" value="0" aria-label="ブラシ位置ジッター" /><span>%</span></span>
              </div>
""",
)

# Tests
test_path = Path('tests/unit/brush-position-jitter.test.ts')
if test_path.exists():
    raise RuntimeError('tests/unit/brush-position-jitter.test.ts already exists')
test_path.write_text("""import { describe, expect, it } from 'vitest';
import {
  brushPositionJitterV1,
  createBaselineBrushPresetV1,
  withBrushPositionJitterV1,
} from '../../src/domain/brush-schema.js';
import { PaintSessionControllerV1 } from '../../src/app/paint-session-controller.js';
import {
  BaselineBrushDabBuilderV1,
  deterministicBaselineBrushPositionJitterV1,
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

describe('M6A-054 position/scatter jitter', () => {
  it('stores normalized position jitter with an exact zero default', () => {
    const preset = createBaselineBrushPresetV1({
      id: 'test.position-jitter',
      name: 'Position Jitter',
      category: 'Test',
      behavior: 'paint',
    });
    expect(brushPositionJitterV1(preset)).toBe(0);
    const changed = withBrushPositionJitterV1(preset, 0.4);
    expect(brushPositionJitterV1(changed)).toBe(0.4);
    expect(changed.jitter.position).toBe(0.4);
    const reset = withBrushPositionJitterV1(changed, 0);
    expect(brushPositionJitterV1(reset)).toBe(0);
    expect(reset.jitter.position).toBeUndefined();
    expect(() => withBrushPositionJitterV1(preset, -0.01)).toThrow(RangeError);
    expect(() => withBrushPositionJitterV1(preset, 1.01)).toThrow(RangeError);
  });

  it('keeps zero jitter as an exact stamp-position identity', () => {
    const baseline = new BaselineBrushDabBuilderV1({ sizePx: 20, spacingRatio: 1, randomSeed: 19 });
    const explicitZero = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      spacingRatio: 1,
      randomSeed: 19,
      positionJitter: 0,
    });
    for (const brush of [baseline, explicitZero]) {
      brush.begin({ documentX: 0, documentY: 0 });
      brush.append([{ documentX: 20, documentY: 0 }]);
      brush.finish();
    }
    expect(explicitZero.dabs()).toEqual(baseline.dabs());
  });

  it('uses a deterministic isotropic unit-disk vector scaled by base brush diameter', () => {
    const seed = 0x12345678;
    const amount = 0.5;
    const sizePx = 20;
    const brush = new BaselineBrushDabBuilderV1({
      sizePx,
      spacingRatio: 1,
      positionJitter: amount,
      randomSeed: seed,
    });
    brush.begin({ documentX: 0, documentY: 0 });
    brush.append([{ documentX: 20, documentY: 0 }]);
    brush.finish();
    const first = deterministicBaselineBrushPositionJitterV1(seed, 0);
    const second = deterministicBaselineBrushPositionJitterV1(seed, 1);
    expect(Math.hypot(first.x, first.y)).toBeLessThanOrEqual(1);
    expect(Math.hypot(second.x, second.y)).toBeLessThanOrEqual(1);
    expect(brush.dabs()[0]?.x).toBeCloseTo(first.x * sizePx * amount, 10);
    expect(brush.dabs()[0]?.y).toBeCloseTo(first.y * sizePx * amount, 10);
    expect(brush.dabs()[1]?.x).toBeCloseTo(20 + second.x * sizePx * amount, 10);
    expect(brush.dabs()[1]?.y).toBeCloseTo(second.y * sizePx * amount, 10);
  });

  it('does not feed jittered centers back into spacing or stroke geometry', () => {
    const brush = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      spacingRatio: 1,
      positionJitter: 1,
      randomSeed: 0x2468ace0,
    });
    brush.begin({ documentX: 0, documentY: 0 });
    brush.append([{ documentX: 40, documentY: 0 }]);
    brush.finish();
    expect(brush.dabs()).toHaveLength(3);
  });

  it('advances the position-jitter attempt index even when taper suppresses a logical stamp', () => {
    const seed = 0x89abcdef;
    const amount = 0.75;
    const sizePx = 10;
    const brush = new BaselineBrushDabBuilderV1({
      sizePx,
      spacingRatio: 1,
      startTaperLengthPx: 10,
      positionJitter: amount,
      randomSeed: seed,
    });
    brush.begin({ documentX: 0, documentY: 0 });
    brush.append([{ documentX: 10, documentY: 0 }]);
    const vector = deterministicBaselineBrushPositionJitterV1(seed, 1);
    const [dab] = brush.dabs();
    expect(dab).toBeDefined();
    expect(dab?.x).toBeCloseTo(10 + vector.x * sizePx * amount, 10);
    expect(dab?.y).toBeCloseTo(vector.y * sizePx * amount, 10);
  });

  it('keeps its random sequence independent from other randomized brush channels', () => {
    const seed = 0x0badc0de;
    const plain = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      spacingRatio: 1,
      positionJitter: 0.5,
      randomSeed: seed,
    });
    const combined = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      spacingRatio: 1,
      positionJitter: 0.5,
      sizeJitter: 0.5,
      opacityJitter: 0.5,
      rotationJitter: 0.5,
      randomFlowEnabled: true,
      randomSeed: seed,
    });
    for (const brush of [plain, combined]) {
      brush.begin({ documentX: 0, documentY: 0 });
      brush.append([{ documentX: 20, documentY: 0 }]);
      brush.finish();
    }
    expect(combined.dabs().map((dab) => [dab.x, dab.y])).toEqual(
      plain.dabs().map((dab) => [dab.x, dab.y]),
    );
  });

  it('reuses the resolved jittered center when reconciling the mutable end tail', () => {
    const brush = new BaselineBrushDabBuilderV1({
      sizePx: 10,
      spacingRatio: 1,
      endTaperLengthPx: 10,
      sizeTaperMinimumRatio: 1,
      opacityTaperMinimumRatio: 1,
      positionJitter: 0.6,
      randomSeed: 0xfeed1234,
    });
    brush.begin({ documentX: 0, documentY: 0 });
    brush.append([
      { documentX: 10, documentY: 0 },
      { documentX: 20, documentY: 0 },
    ]);
    const beforeFinish = brush.dabs().map((dab) => [dab.x, dab.y]);
    brush.finish();
    expect(brush.dabs().map((dab) => [dab.x, dab.y])).toEqual(beforeFinish);
  });

  it('captures runtime position jitter without extending the primitive dab schema', () => {
    const session = new PaintSessionControllerV1(new FakeRendererDocumentPort());
    expect(session.setBrushPositionJitter(0.35)).toBe(0.35);
    expect(session.snapshot().brushPositionJitter).toBe(0.35);
    const [dab] = new BaselineBrushDabBuilderV1({
      positionJitter: 0.35,
      randomSeed: 7,
    }).beginDelta({ documentX: 0, documentY: 0 });
    expect(dab).toBeDefined();
    expect('positionJitter' in (dab ?? {})).toBe(false);
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
    """requireText(progress, 'M6A-054 position/scatter jitter:完了', 'M6A-054 progress is not complete');
requireText(
  read('src/domain/brush-schema.ts'),
  'brushPositionJitterV1',
  'position-jitter preset helpers missing',
);
requireText(
  read('src/gpu/baseline-brush.ts'),
  'deterministicBaselineBrushPositionJitterV1',
  'deterministic 2D position-jitter channel missing',
);
requireText(
  read('src/gpu/baseline-brush.ts'),
  'maximumPositionOffsetPx = this.#radius * 2 * this.#positionJitter',
  'position jitter is not scaled from the base brush diameter',
);
requireText(
  read('src/app/paint-session-controller.ts'),
  'setBrushPositionJitter',
  'position jitter is not connected to runtime brush state',
);
requireText(
  read('src/app/paint-session-controller.ts'),
  'positionJitterEnabled',
  'position jitter does not capture a deterministic persistent stroke seed',
);
requireText(
  read('src/index.html'),
  'id="brush-position-jitter-range"',
  'reachable position-jitter control missing',
);
requireText(
  read('tests/unit/brush-position-jitter.test.ts'),
  'does not feed jittered centers back into spacing or stroke geometry',
  'position-jitter path-invariance regression missing',
);
requireText(
  read('tests/unit/brush-position-jitter.test.ts'),
  'advances the position-jitter attempt index even when taper suppresses a logical stamp',
  'position-jitter attempt-index regression missing',
);
requireText(
  read('tests/unit/brush-position-jitter.test.ts'),
  'reuses the resolved jittered center when reconciling the mutable end tail',
  'position-jitter tail reconciliation regression missing',
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
    'M6A-054 position/scatter jitter:未完了\nM6A-055 density jitter:未完了\n',
    'M6A-054 position/scatter jitter:完了\n再開メモ: M6A-054 position/scatter jitterはCanonical Brush Modelのjitter.positionを0..1で保持し、0を完全identity/defaultとする。M6A-057のSpray/particle modeとは分離し、本段階ではlogical stamp中心だけを2Dランダム移動する。stroke randomSeed + position-jitter専用angle/radius saltからlogical stamp attemptごとに等方なunit-disk vectorを決定論的に生成し、base brush diameter * amountを最大半径としてdocument-spaceへ加算する。spacing、path distance、stroke tangent、stabilization geometry、velocity計算にはjitter後座標をfeedbackせず、元のcanonical stroke centerlineを維持する。M6A-051 size / M6A-052 opacity / M6A-053 rotation / M6A-048 generalized random / M6A-027 tip selectionとはrandom channelとattempt indexを分離し、非表示attemptでもposition indexを進める。可視logical recordへjitter済みx/yを保存するためend-tail reconciliationで再抽選しない。position jitterが有効なら他random機能がOFFでもstroke randomSeedを保存しpost-stroke correctionでも同一位置列を再構築する。primitive dab / Worker / HistoryにはpositionJitter専用fieldを追加せず解決済みx/yだけを保存する。次はM6A-055 density jitterから再開する。\nM6A-055 density jitter:未完了\n',
)
append_once(
    'ILLUSTRO_DESIGN_MEMO.md',
    '## M6A position-jitter boundary — 2026-09-03',
    """
## M6A position-jitter boundary — 2026-09-03

**AUTHORITATIVE for M6A-054.** `BrushPresetV1.jitter.position` is a normalized `0..1` position-randomization amount with exact/default identity at `0`. This stage implements ordinary **position jitter**, not M6A-057 Spray/particle mode: there remains exactly one selected tip per ordinary logical stamp, and only that logical stamp's draw center is displaced.

Each logical-stamp attempt obtains a deterministic isotropic unit-disk vector from the persisted stroke `randomSeed`, position-jitter-specific angle/radius salts, and a position-jitter-specific attempt index. The vector uses uniform angle and square-root radial sampling so area density is not biased toward the center. Its maximum document-space displacement is `base brush diameter * amount`, matching the canonical/reference concept that position randomization is expressed relative to brush thickness. The displaced draw center is **not** fed back into spacing, path distance, stroke tangent, stabilization, velocity, or later logical-stamp placement; the canonical stroke centerline remains the geometry source of truth.

Position jitter has an independent random sequence from generalized random dynamics, size jitter, opacity jitter, rotation jitter, and random tip selection. Its attempt index advances even when the attempt is suppressed before primitive output. Visible logical-stamp records retain the already-resolved jittered `x/y`, so bounded mutable-tail/end-taper reconciliation never resamples the position. When position jitter is active, the stroke persists the deterministic uint32 seed even if every other random feature is disabled. Primitive dabs/history/Worker payloads store only resolved coordinates; no position-jitter-specific persistence or renderer field is added.
""",
)

print('M6A-054 position jitter patch applied')
