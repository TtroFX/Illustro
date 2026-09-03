from pathlib import Path


def read(path: str) -> str:
    return Path(path).read_text(encoding='utf-8')


def write(path: str, text: str) -> None:
    Path(path).write_text(text, encoding='utf-8')


def replace_once(path: str, old: str, new: str) -> None:
    text = read(path)
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{path}: expected exactly one anchor, found {count}: {old[:180]!r}')
    write(path, text.replace(old, new, 1))


def append_once(path: str, marker: str, block: str) -> None:
    text = read(path)
    if marker in text:
        return
    if not text.endswith('\n'):
        text += '\n'
    write(path, text + '\n' + block.strip() + '\n')


# Canonical preset schema: density is explicit particles per logical stamp.
replace_once(
    'src/domain/brush-schema.ts',
    """export function withBrushSprayParticleSizeRatioV1(
  preset: BrushPresetV1,
  particleSizeRatio: number,
): BrushPresetV1 {
  if (
    !Number.isFinite(particleSizeRatio) ||
    particleSizeRatio < MIN_BRUSH_SPRAY_PARTICLE_SIZE_RATIO_V1 ||
    particleSizeRatio > MAX_BRUSH_SPRAY_PARTICLE_SIZE_RATIO_V1
  ) {
    throw new RangeError('brush spray particle size ratio must be within 0.01..4');
  }
  if (particleSizeRatio === DEFAULT_BRUSH_SPRAY_PARTICLE_SIZE_RATIO_V1) {
    const { particleSizeRatio: _particleSizeRatio, ...spray } = preset.spray;
    return normalizeBrushPresetV1({ ...preset, spray });
  }
  return normalizeBrushPresetV1({
    ...preset,
    spray: { ...preset.spray, particleSizeRatio },
  });
}

export type BrushTipSelectionModeV1 = 'fixed' | 'sequence' | 'random-per-stamp';
""",
    """export function withBrushSprayParticleSizeRatioV1(
  preset: BrushPresetV1,
  particleSizeRatio: number,
): BrushPresetV1 {
  if (
    !Number.isFinite(particleSizeRatio) ||
    particleSizeRatio < MIN_BRUSH_SPRAY_PARTICLE_SIZE_RATIO_V1 ||
    particleSizeRatio > MAX_BRUSH_SPRAY_PARTICLE_SIZE_RATIO_V1
  ) {
    throw new RangeError('brush spray particle size ratio must be within 0.01..4');
  }
  if (particleSizeRatio === DEFAULT_BRUSH_SPRAY_PARTICLE_SIZE_RATIO_V1) {
    const { particleSizeRatio: _particleSizeRatio, ...spray } = preset.spray;
    return normalizeBrushPresetV1({ ...preset, spray });
  }
  return normalizeBrushPresetV1({
    ...preset,
    spray: { ...preset.spray, particleSizeRatio },
  });
}

export const DEFAULT_BRUSH_SPRAY_PARTICLE_DENSITY_V1 = 4 as const;
export const MIN_BRUSH_SPRAY_PARTICLE_DENSITY_V1 = 1 as const;
export const MAX_BRUSH_SPRAY_PARTICLE_DENSITY_V1 = 32 as const;

export function brushSprayParticleDensityV1(preset: BrushPresetV1): number {
  const value = preset.spray.particleDensity;
  return typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= MIN_BRUSH_SPRAY_PARTICLE_DENSITY_V1 &&
    value <= MAX_BRUSH_SPRAY_PARTICLE_DENSITY_V1
    ? value
    : DEFAULT_BRUSH_SPRAY_PARTICLE_DENSITY_V1;
}

export function withBrushSprayParticleDensityV1(
  preset: BrushPresetV1,
  particleDensity: number,
): BrushPresetV1 {
  if (
    !Number.isSafeInteger(particleDensity) ||
    particleDensity < MIN_BRUSH_SPRAY_PARTICLE_DENSITY_V1 ||
    particleDensity > MAX_BRUSH_SPRAY_PARTICLE_DENSITY_V1
  ) {
    throw new RangeError('brush spray particle density must be an integer within 1..32');
  }
  if (particleDensity === DEFAULT_BRUSH_SPRAY_PARTICLE_DENSITY_V1) {
    const { particleDensity: _particleDensity, ...spray } = preset.spray;
    return normalizeBrushPresetV1({ ...preset, spray });
  }
  return normalizeBrushPresetV1({
    ...preset,
    spray: { ...preset.spray, particleDensity },
  });
}

export type BrushTipSelectionModeV1 = 'fixed' | 'sequence' | 'random-per-stamp';
""",
)

# Kernel: parameterize particle fanout while keeping the first N deterministic positions stable.
replace_once(
    'src/gpu/baseline-brush.ts',
    'export const BASELINE_BRUSH_SPRAY_PARTICLE_COUNT_V1 = 4 as const;\n',
    """export const BASELINE_BRUSH_SPRAY_PARTICLE_COUNT_V1 = 4 as const;
export const BASELINE_BRUSH_SPRAY_PARTICLE_COUNT_MIN_V1 = 1 as const;
export const BASELINE_BRUSH_SPRAY_PARTICLE_COUNT_MAX_V1 = 32 as const;
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    '  readonly #sprayEnabled: boolean;\n  readonly #sprayParticleSizeRatio: number;\n  readonly #randomSeed: number;\n',
    '  readonly #sprayEnabled: boolean;\n  readonly #sprayParticleSizeRatio: number;\n  readonly #sprayParticleDensity: number;\n  readonly #randomSeed: number;\n',
)
replace_once(
    'src/gpu/baseline-brush.ts',
    '      readonly sprayEnabled?: boolean;\n      readonly sprayParticleSizeRatio?: number;\n      readonly randomSeed?: number;\n',
    '      readonly sprayEnabled?: boolean;\n      readonly sprayParticleSizeRatio?: number;\n      readonly sprayParticleDensity?: number;\n      readonly randomSeed?: number;\n',
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """    const sprayParticleSizeRatio =
      options.sprayParticleSizeRatio ?? BASELINE_BRUSH_SPRAY_PARTICLE_SCALE_V1;
    const randomSeed = options.randomSeed ?? 0;
""",
    """    const sprayParticleSizeRatio =
      options.sprayParticleSizeRatio ?? BASELINE_BRUSH_SPRAY_PARTICLE_SCALE_V1;
    const sprayParticleDensity =
      options.sprayParticleDensity ?? BASELINE_BRUSH_SPRAY_PARTICLE_COUNT_V1;
    const randomSeed = options.randomSeed ?? 0;
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """    if (
      !Number.isFinite(sprayParticleSizeRatio) ||
      sprayParticleSizeRatio < BASELINE_BRUSH_SPRAY_PARTICLE_SCALE_MIN_V1 ||
      sprayParticleSizeRatio > BASELINE_BRUSH_SPRAY_PARTICLE_SCALE_MAX_V1
    ) {
      throw new RangeError('baseline brush spray particle size ratio must be within 0.01..4');
    }
    if (!Number.isSafeInteger(randomSeed) || randomSeed < 0 || randomSeed > 0xffffffff) {
""",
    """    if (
      !Number.isFinite(sprayParticleSizeRatio) ||
      sprayParticleSizeRatio < BASELINE_BRUSH_SPRAY_PARTICLE_SCALE_MIN_V1 ||
      sprayParticleSizeRatio > BASELINE_BRUSH_SPRAY_PARTICLE_SCALE_MAX_V1
    ) {
      throw new RangeError('baseline brush spray particle size ratio must be within 0.01..4');
    }
    if (
      !Number.isSafeInteger(sprayParticleDensity) ||
      sprayParticleDensity < BASELINE_BRUSH_SPRAY_PARTICLE_COUNT_MIN_V1 ||
      sprayParticleDensity > BASELINE_BRUSH_SPRAY_PARTICLE_COUNT_MAX_V1
    ) {
      throw new RangeError('baseline brush spray particle density must be an integer within 1..32');
    }
    if (!Number.isSafeInteger(randomSeed) || randomSeed < 0 || randomSeed > 0xffffffff) {
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    '    this.#sprayEnabled = sprayEnabled;\n    this.#sprayParticleSizeRatio = sprayParticleSizeRatio;\n    this.#randomSeed = randomSeed >>> 0;\n',
    '    this.#sprayEnabled = sprayEnabled;\n    this.#sprayParticleSizeRatio = sprayParticleSizeRatio;\n    this.#sprayParticleDensity = sprayParticleDensity;\n    this.#randomSeed = randomSeed >>> 0;\n',
)
replace_once(
    'src/gpu/baseline-brush.ts',
    '          Array.from({ length: BASELINE_BRUSH_SPRAY_PARTICLE_COUNT_V1 }, (_, particleIndex) => {\n',
    '          Array.from({ length: this.#sprayParticleDensity }, (_, particleIndex) => {\n',
)

# Canonical facade.
replace_once(
    'src/app/canonical-raster-brush.ts',
    '      readonly sprayEnabled?: boolean;\n      readonly sprayParticleSizeRatio?: number;\n      readonly randomSeed?: number;\n',
    '      readonly sprayEnabled?: boolean;\n      readonly sprayParticleSizeRatio?: number;\n      readonly sprayParticleDensity?: number;\n      readonly randomSeed?: number;\n',
)
replace_once(
    'src/app/canonical-raster-brush.ts',
    """      ...(options.sprayParticleSizeRatio === undefined
        ? {}
        : { sprayParticleSizeRatio: options.sprayParticleSizeRatio }),
      ...(options.randomSeed === undefined ? {} : { randomSeed: options.randomSeed }),
""",
    """      ...(options.sprayParticleSizeRatio === undefined
        ? {}
        : { sprayParticleSizeRatio: options.sprayParticleSizeRatio }),
      ...(options.sprayParticleDensity === undefined
        ? {}
        : { sprayParticleDensity: options.sprayParticleDensity }),
      ...(options.randomSeed === undefined ? {} : { randomSeed: options.randomSeed }),
""",
)

# Runtime session.
replace_once(
    'src/app/paint-session-controller.ts',
    '  BASELINE_BRUSH_SPRAY_ENABLED,\n  BASELINE_BRUSH_SPRAY_PARTICLE_SCALE_V1,\n  DEFAULT_BASELINE_BRUSH_COLOR_V1,\n',
    '  BASELINE_BRUSH_SPRAY_ENABLED,\n  BASELINE_BRUSH_SPRAY_PARTICLE_SCALE_V1,\n  BASELINE_BRUSH_SPRAY_PARTICLE_COUNT_V1,\n  DEFAULT_BASELINE_BRUSH_COLOR_V1,\n',
)
replace_once(
    'src/app/paint-session-controller.ts',
    '  readonly brushSprayEnabled: boolean;\n  readonly brushSprayParticleSizeRatio: number;\n  readonly brushTipAngleDegrees: number;\n',
    '  readonly brushSprayEnabled: boolean;\n  readonly brushSprayParticleSizeRatio: number;\n  readonly brushSprayParticleDensity: number;\n  readonly brushTipAngleDegrees: number;\n',
)
replace_once(
    'src/app/paint-session-controller.ts',
    '  #brushSprayEnabled: boolean = BASELINE_BRUSH_SPRAY_ENABLED;\n  #brushSprayParticleSizeRatio: number = BASELINE_BRUSH_SPRAY_PARTICLE_SCALE_V1;\n  #brushTipAngleDegrees: number = BASELINE_BRUSH_TIP_ANGLE_DEGREES;\n',
    '  #brushSprayEnabled: boolean = BASELINE_BRUSH_SPRAY_ENABLED;\n  #brushSprayParticleSizeRatio: number = BASELINE_BRUSH_SPRAY_PARTICLE_SCALE_V1;\n  #brushSprayParticleDensity: number = BASELINE_BRUSH_SPRAY_PARTICLE_COUNT_V1;\n  #brushTipAngleDegrees: number = BASELINE_BRUSH_TIP_ANGLE_DEGREES;\n',
)
replace_once(
    'src/app/paint-session-controller.ts',
    '      brushSprayEnabled: this.#brushSprayEnabled,\n      brushSprayParticleSizeRatio: this.#brushSprayParticleSizeRatio,\n      brushTipAngleDegrees: this.#brushTipAngleDegrees,\n',
    '      brushSprayEnabled: this.#brushSprayEnabled,\n      brushSprayParticleSizeRatio: this.#brushSprayParticleSizeRatio,\n      brushSprayParticleDensity: this.#brushSprayParticleDensity,\n      brushTipAngleDegrees: this.#brushTipAngleDegrees,\n',
)
replace_once(
    'src/app/paint-session-controller.ts',
    """  brushSprayParticleSizeRatio(): number {
    return this.#brushSprayParticleSizeRatio;
  }

  setBrushTipAngleDegrees(angleDegrees: number): number {
""",
    """  brushSprayParticleSizeRatio(): number {
    return this.#brushSprayParticleSizeRatio;
  }

  setBrushSprayParticleDensity(particleDensity: number): number {
    if (!Number.isSafeInteger(particleDensity) || particleDensity < 1 || particleDensity > 32) {
      throw new RangeError('invalid runtime brush spray particle density');
    }
    if (particleDensity !== this.#brushSprayParticleDensity) this.#clearActiveStroke();
    this.#brushSprayParticleDensity = particleDensity;
    return this.#brushSprayParticleDensity;
  }

  brushSprayParticleDensity(): number {
    return this.#brushSprayParticleDensity;
  }

  setBrushTipAngleDegrees(angleDegrees: number): number {
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    '        sprayEnabled: this.#brushSprayEnabled,\n        sprayParticleSizeRatio: this.#brushSprayParticleSizeRatio,\n        randomSeed: randomSeed ?? 0,\n',
    '        sprayEnabled: this.#brushSprayEnabled,\n        sprayParticleSizeRatio: this.#brushSprayParticleSizeRatio,\n        sprayParticleDensity: this.#brushSprayParticleDensity,\n        randomSeed: randomSeed ?? 0,\n',
)

# Preset library mutation.
replace_once(
    'src/app/brush-preset-library.ts',
    '  withBrushSprayEnabledV1,\n  withBrushSprayParticleSizeRatioV1,\n  withBrushStrokeSpacingV1,\n',
    '  withBrushSprayEnabledV1,\n  withBrushSprayParticleSizeRatioV1,\n  withBrushSprayParticleDensityV1,\n  withBrushStrokeSpacingV1,\n',
)
append_once(
    'src/app/brush-preset-library.ts',
    'export function updateBrushPresetSprayParticleDensityV1(',
    """
export function updateBrushPresetSprayParticleDensityV1(
  state: BrushPresetLibraryStateV1,
  presetId: string,
  particleDensity: number,
): BrushPresetLibraryStateV1 {
  return updateItemV1(state, presetId, (item) => {
    if (item.locked) throw new Error('locked brush preset cannot be edited');
    const current = withBrushSprayParticleDensityV1(item.preset, particleDensity);
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
""",
)

# Tool Properties.
replace_once(
    'src/app/brush-preset-controller.ts',
    '  brushSprayEnabledV1,\n  brushSprayParticleSizeRatioV1,\n  BUILTIN_BRUSH_GRAIN_RESOURCES_V1,\n',
    '  brushSprayEnabledV1,\n  brushSprayParticleSizeRatioV1,\n  brushSprayParticleDensityV1,\n  BUILTIN_BRUSH_GRAIN_RESOURCES_V1,\n',
)
replace_once(
    'src/app/brush-preset-controller.ts',
    '  updateBrushPresetSprayEnabledV1,\n  updateBrushPresetSprayParticleSizeRatioV1,\n  updateBrushPresetSpacingV1,\n',
    '  updateBrushPresetSprayEnabledV1,\n  updateBrushPresetSprayParticleSizeRatioV1,\n  updateBrushPresetSprayParticleDensityV1,\n  updateBrushPresetSpacingV1,\n',
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  const sprayParticleSizeRange = requireElement('#brush-spray-particle-size-range', HTMLInputElement);
  const sprayParticleSizeNumber = requireElement('#brush-spray-particle-size-number', HTMLInputElement);
  const tipShape = requireElement('#brush-tip-shape', HTMLSelectElement);
""",
    """  const sprayParticleSizeRange = requireElement('#brush-spray-particle-size-range', HTMLInputElement);
  const sprayParticleSizeNumber = requireElement('#brush-spray-particle-size-number', HTMLInputElement);
  const sprayParticleDensityRange = requireElement('#brush-spray-particle-density-range', HTMLInputElement);
  const sprayParticleDensityNumber = requireElement('#brush-spray-particle-density-number', HTMLInputElement);
  const tipShape = requireElement('#brush-tip-shape', HTMLSelectElement);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    const sprayParticleSizeRatio = brushSprayParticleSizeRatioV1(item.preset);
    input.paintSession.setBrushSprayParticleSizeRatio(sprayParticleSizeRatio);
    const tipAssets = brushTipAssetsV1(item.preset);
""",
    """    const sprayParticleSizeRatio = brushSprayParticleSizeRatioV1(item.preset);
    input.paintSession.setBrushSprayParticleSizeRatio(sprayParticleSizeRatio);
    const sprayParticleDensity = brushSprayParticleDensityV1(item.preset);
    input.paintSession.setBrushSprayParticleDensity(sprayParticleDensity);
    const tipAssets = brushTipAssetsV1(item.preset);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    '    input.root.dataset.illustroBrushSprayParticleSizeRatio = String(sprayParticleSizeRatio);\n    input.root.dataset.illustroBrushTipShape = brushTipShapeV1(item.preset);\n',
    '    input.root.dataset.illustroBrushSprayParticleSizeRatio = String(sprayParticleSizeRatio);\n    input.root.dataset.illustroBrushSprayParticleDensity = String(sprayParticleDensity);\n    input.root.dataset.illustroBrushTipShape = brushTipShapeV1(item.preset);\n',
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    configurePair(
      sprayParticleSizeRange,
      sprayParticleSizeNumber,
      1,
      400,
      1,
      sprayParticleSizeRatio * 100,
    );
    tipShape.value = brushTipShapeV1(selected.preset);
""",
    """    configurePair(
      sprayParticleSizeRange,
      sprayParticleSizeNumber,
      1,
      400,
      1,
      sprayParticleSizeRatio * 100,
    );
    const sprayParticleDensity = brushSprayParticleDensityV1(selected.preset);
    configurePair(
      sprayParticleDensityRange,
      sprayParticleDensityNumber,
      1,
      32,
      1,
      sprayParticleDensity,
    );
    tipShape.value = brushTipShapeV1(selected.preset);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    const sprayParticleSizeLabel = sprayEnabled
      ? ` · Particle${Math.round(sprayParticleSizeRatio * 100)}%`
      : '';
    propertyStatus.textContent = """,
    """    const sprayParticleSizeLabel = sprayEnabled
      ? ` · Particle${Math.round(sprayParticleSizeRatio * 100)}%`
      : '';
    const sprayParticleDensityLabel = sprayEnabled ? ` · Density${sprayParticleDensity}` : '';
    propertyStatus.textContent = """,
)
replace_once(
    'src/app/brush-preset-controller.ts',
    '${colorJitterLabel}${sprayLabel}${sprayParticleSizeLabel}`;\n',
    '${colorJitterLabel}${sprayLabel}${sprayParticleSizeLabel}${sprayParticleDensityLabel}`;\n',
)
replace_once(
    'src/app/brush-preset-controller.ts',
    '      sprayParticleSizeRange,\n      sprayParticleSizeNumber,\n      tipShape,\n',
    '      sprayParticleSizeRange,\n      sprayParticleSizeNumber,\n      sprayParticleDensityRange,\n      sprayParticleDensityNumber,\n      tipShape,\n',
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    sprayParticleSizeRange.disabled = locked || !sprayEnabled;
    sprayParticleSizeNumber.disabled = locked || !sprayEnabled;
    pressureCurveEditor?.setDisabled(locked);
""",
    """    sprayParticleSizeRange.disabled = locked || !sprayEnabled;
    sprayParticleSizeNumber.disabled = locked || !sprayEnabled;
    sprayParticleDensityRange.disabled = locked || !sprayEnabled;
    sprayParticleDensityNumber.disabled = locked || !sprayEnabled;
    pressureCurveEditor?.setDisabled(locked);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  const onSprayParticleSizeNumber = (): void =>
    updateSprayParticleSize(Number(sprayParticleSizeNumber.value));
  const onTipShape = (): void => {
""",
    """  const onSprayParticleSizeNumber = (): void =>
    updateSprayParticleSize(Number(sprayParticleSizeNumber.value));
  const updateSprayParticleDensity = (value: number): void =>
    mutate(() => updateBrushPresetSprayParticleDensityV1(state, state.selectedPresetId, value));
  const onSprayParticleDensityRange = (): void =>
    updateSprayParticleDensity(Number(sprayParticleDensityRange.value));
  const onSprayParticleDensityNumber = (): void =>
    updateSprayParticleDensity(Number(sprayParticleDensityNumber.value));
  const onTipShape = (): void => {
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  sprayParticleSizeRange.addEventListener('input', onSprayParticleSizeRange);
  sprayParticleSizeNumber.addEventListener('change', onSprayParticleSizeNumber);
  tipShape.addEventListener('change', onTipShape);
""",
    """  sprayParticleSizeRange.addEventListener('input', onSprayParticleSizeRange);
  sprayParticleSizeNumber.addEventListener('change', onSprayParticleSizeNumber);
  sprayParticleDensityRange.addEventListener('input', onSprayParticleDensityRange);
  sprayParticleDensityNumber.addEventListener('change', onSprayParticleDensityNumber);
  tipShape.addEventListener('change', onTipShape);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """      sprayParticleSizeRange.removeEventListener('input', onSprayParticleSizeRange);
      sprayParticleSizeNumber.removeEventListener('change', onSprayParticleSizeNumber);
      pressureCurveEditor?.dispose();
""",
    """      sprayParticleSizeRange.removeEventListener('input', onSprayParticleSizeRange);
      sprayParticleSizeNumber.removeEventListener('change', onSprayParticleSizeNumber);
      sprayParticleDensityRange.removeEventListener('input', onSprayParticleDensityRange);
      sprayParticleDensityNumber.removeEventListener('change', onSprayParticleDensityNumber);
      pressureCurveEditor?.dispose();
""",
)

# Reachable UI.
replace_once(
    'src/index.html',
    """              <div class="shell-brush-property-row">
                <label for="brush-spray-particle-size-range">粒子サイズ</label>
                <input id="brush-spray-particle-size-range" type="range" min="1" max="400" step="1" value="35" disabled />
                <span class="shell-brush-property-number shell-brush-property-percent"><input id="brush-spray-particle-size-number" type="number" inputmode="decimal" min="1" max="400" step="1" value="35" aria-label="散布粒子サイズ" disabled /><span>%</span></span>
              </div>
              <div class="shell-brush-property-row shell-brush-tip-property-row">
""",
    """              <div class="shell-brush-property-row">
                <label for="brush-spray-particle-size-range">粒子サイズ</label>
                <input id="brush-spray-particle-size-range" type="range" min="1" max="400" step="1" value="35" disabled />
                <span class="shell-brush-property-number shell-brush-property-percent"><input id="brush-spray-particle-size-number" type="number" inputmode="decimal" min="1" max="400" step="1" value="35" aria-label="散布粒子サイズ" disabled /><span>%</span></span>
              </div>
              <div class="shell-brush-property-row">
                <label for="brush-spray-particle-density-range">粒子密度</label>
                <input id="brush-spray-particle-density-range" type="range" min="1" max="32" step="1" value="4" disabled />
                <span class="shell-brush-property-number"><input id="brush-spray-particle-density-number" type="number" inputmode="numeric" min="1" max="32" step="1" value="4" aria-label="散布粒子密度" disabled /><span>粒/stamp</span></span>
              </div>
              <div class="shell-brush-property-row shell-brush-tip-property-row">
""",
)

# Targeted tests.
write(
    'tests/unit/brush-particle-density.test.ts',
    """import { describe, expect, it } from 'vitest';
import {
  brushSprayParticleDensityV1,
  createBaselineBrushPresetV1,
  withBrushSprayParticleDensityV1,
} from '../../src/domain/brush-schema.js';
import { PaintSessionControllerV1 } from '../../src/app/paint-session-controller.js';
import {
  BASELINE_BRUSH_SPRAY_PARTICLE_COUNT_V1,
  BaselineBrushDabBuilderV1,
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

describe('M6A-059 spray particle density', () => {
  it('stores particles per logical stamp with the M6A-057 default of four', () => {
    const preset = createBaselineBrushPresetV1({
      id: 'test.spray-particle-density',
      name: 'Spray Particle Density',
      category: 'Test',
      behavior: 'paint',
    });
    expect(brushSprayParticleDensityV1(preset)).toBe(BASELINE_BRUSH_SPRAY_PARTICLE_COUNT_V1);
    const changed = withBrushSprayParticleDensityV1(preset, 9);
    expect(brushSprayParticleDensityV1(changed)).toBe(9);
    expect(changed.spray.particleDensity).toBe(9);
    const reset = withBrushSprayParticleDensityV1(changed, 4);
    expect(brushSprayParticleDensityV1(reset)).toBe(4);
    expect(reset.spray.particleDensity).toBeUndefined();
    expect(() => withBrushSprayParticleDensityV1(preset, 0)).toThrow(RangeError);
    expect(() => withBrushSprayParticleDensityV1(preset, 33)).toThrow(RangeError);
    expect(() => withBrushSprayParticleDensityV1(preset, 4.5)).toThrow(RangeError);
  });

  it('keeps omitted density identical to the existing four-particle spray baseline', () => {
    const implicit = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      sprayEnabled: true,
      randomSeed: 0x12345678,
    });
    const explicit = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      sprayEnabled: true,
      sprayParticleDensity: 4,
      randomSeed: 0x12345678,
    });
    expect(explicit.beginDelta({ documentX: 40, documentY: 50 })).toEqual(
      implicit.beginDelta({ documentX: 40, documentY: 50 }),
    );
  });

  it('changes only burst count while preserving the deterministic prefix of particle centers', () => {
    const seed = 0x2468ace0;
    const four = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      sprayEnabled: true,
      sprayParticleDensity: 4,
      randomSeed: seed,
    });
    const eight = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      sprayEnabled: true,
      sprayParticleDensity: 8,
      randomSeed: seed,
    });
    const fourDabs = four.beginDelta({ documentX: 20, documentY: 30 });
    const eightDabs = eight.beginDelta({ documentX: 20, documentY: 30 });
    expect(fourDabs).toHaveLength(4);
    expect(eightDabs).toHaveLength(8);
    expect(eightDabs.slice(0, 4).map((dab) => [dab.x, dab.y])).toEqual(
      fourDabs.map((dab) => [dab.x, dab.y]),
    );
    expect(eightDabs.slice(0, 4).map((dab) => dab.radius)).toEqual(fourDabs.map((dab) => dab.radius));
  });

  it('does not reinterpret tip-density jitter as particle density', () => {
    const seed = 0x0badc0de;
    const plain = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      sprayEnabled: true,
      sprayParticleDensity: 6,
      tipDensity: 0.8,
      randomSeed: seed,
    });
    const jittered = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      sprayEnabled: true,
      sprayParticleDensity: 6,
      tipDensity: 0.8,
      densityJitter: 0.5,
      randomSeed: seed,
    });
    const plainDabs = plain.beginDelta({ documentX: 0, documentY: 0 });
    const jitteredDabs = jittered.beginDelta({ documentX: 0, documentY: 0 });
    expect(plainDabs).toHaveLength(6);
    expect(jitteredDabs).toHaveLength(6);
    expect(jitteredDabs.map((dab) => [dab.x, dab.y])).toEqual(plainDabs.map((dab) => [dab.x, dab.y]));
    expect(jitteredDabs.some((dab) => dab.tipDensity !== plainDabs[0]?.tipDensity)).toBe(true);
  });

  it('keeps particle density inert when Scatter is off', () => {
    const baseline = new BaselineBrushDabBuilderV1({ sizePx: 20, randomSeed: 5 });
    const configured = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      sprayEnabled: false,
      sprayParticleDensity: 20,
      randomSeed: 5,
    });
    expect(configured.beginDelta({ documentX: 10, documentY: 10 })).toEqual(
      baseline.beginDelta({ documentX: 10, documentY: 10 }),
    );
  });

  it('reuses resolved particle centers during mutable end-tail reconciliation', () => {
    const brush = new BaselineBrushDabBuilderV1({
      sizePx: 10,
      spacingRatio: 1,
      endTaperLengthPx: 10,
      sizeTaperMinimumRatio: 1,
      opacityTaperMinimumRatio: 1,
      sprayEnabled: true,
      sprayParticleDensity: 7,
      randomSeed: 0xfeed1234,
    });
    brush.begin({ documentX: 0, documentY: 0 });
    brush.append([
      { documentX: 10, documentY: 0 },
      { documentX: 20, documentY: 0 },
    ]);
    const before = brush.dabs().map((dab) => [dab.x, dab.y]);
    brush.finish();
    expect(brush.dabs().map((dab) => [dab.x, dab.y])).toEqual(before);
  });

  it('captures density in runtime state without adding a spray-density primitive field', () => {
    const session = new PaintSessionControllerV1(new FakeRendererDocumentPort());
    expect(session.setBrushSprayParticleDensity(12)).toBe(12);
    expect(session.snapshot().brushSprayParticleDensity).toBe(12);
    const [dab] = new BaselineBrushDabBuilderV1({
      sprayEnabled: true,
      sprayParticleDensity: 12,
      randomSeed: 7,
    }).beginDelta({ documentX: 0, documentY: 0 });
    expect(dab).toBeDefined();
    expect('sprayParticleDensity' in (dab ?? {})).toBe(false);
  });
});
""",
)

append_once(
    'scripts/verify-m6a-brush.mjs',
    'M6A-059 progress is not complete',
    """
requireText(progress, 'M6A-059 particle density:完了', 'M6A-059 progress is not complete');
requireText(
  read('src/domain/brush-schema.ts'),
  'brushSprayParticleDensityV1',
  'spray particle-density preset helper missing',
);
requireText(
  read('src/gpu/baseline-brush.ts'),
  'Array.from({ length: this.#sprayParticleDensity }',
  'spray particle density is not connected to canonical burst fanout',
);
requireText(
  read('src/app/paint-session-controller.ts'),
  'setBrushSprayParticleDensity',
  'spray particle density is not captured by the paint session',
);
requireText(
  read('src/index.html'),
  'id="brush-spray-particle-density-range"',
  'reachable spray particle-density control missing',
);
requireText(
  read('tests/unit/brush-particle-density.test.ts'),
  'preserving the deterministic prefix of particle centers',
  'spray particle-density regression coverage missing',
);
""",
)
replace_once(
    'IMPLEMENTATION_PROGRESS.md',
    'M6A-059 particle density:未完了\nM6A-060 particle spread:未完了\n',
    """M6A-059 particle density:完了
再開メモ: M6A-059 particle densityはSprayの散布量を通常tipのM6A-022 tipDensity / M6A-055 density jitterから分離し、spray.particleDensityを1 logical stampあたり1..32 particlesの明示単位として保持する。既定4でM6A-057/058出力を完全互換にする。粒子index 0..N-1へ既存のstroke seed + spray stamp index + particle index決定列を使うため、densityを増やした場合も既存先頭particleの位置・radius・angle・color等は不変で末尾にparticleが増える。spread radius/distributionはM6A-060、orientationはM6A-061の責務として本段階では変更しない。M6A-055 density jitterはtip mask coverageのみを変えparticle countには影響しない。Scatter OFFではparticleDensityはinert。上限32でlogical stamp fanoutを有界化し、sampled-tip micro-dab展開時の過剰fanoutを抑える。preset/runtime/facade/UIを接続し、primitive/Worker/Historyには専用fieldを追加せず解決済みdab列のみ保存する。次はM6A-060 particle spreadから再開する。
M6A-060 particle spread:未完了
""",
)
append_once(
    'ILLUSTRO_DESIGN_MEMO.md',
    '## M6A spray particle-density boundary — 2026-09-03',
    """
## M6A spray particle-density boundary — 2026-09-03

**AUTHORITATIVE for M6A-059.** `BrushPresetV1.spray.particleDensity` uses the explicit Illustro canonical unit **particles per logical stamp**, stored as an integer in `1..32`; the default is `4` to preserve the M6A-057/058 baseline. Reference applications expose a user-facing particle-density concept, but their internal density-to-count mapping is not assumed to be identical. Interoperability must therefore map/report this field explicitly rather than pretending an undocumented numeric equivalence.

Changing particle density changes only the number of particles in each Spray burst. Particle `0..N-1` continues to use the same deterministic `(stroke seed, spray-stamp index, particle index)` sequence, so increasing density preserves the complete existing particle prefix and appends deterministic particles. It does not alter parent logical-stamp size, particle-size ratio, spread radius/distribution, orientation, color, opacity, flow, or tip-mask coverage. M6A-055 `jitter.density` remains strictly tip-mask coverage variation and never changes Spray particle count.

The `32`-particle ceiling is a deliberate bounded-fanout/performance contract, especially because sampled-image tips may expand every particle into multiple micro-dabs. Scatter OFF makes this parameter inert. End-tail reconciliation reuses the already-resolved particle-center list stored on the logical stamp, so density does not introduce release-time resampling. Primitive dabs, Worker payloads, history, and recovery need no density-specific field; they retain the resolved primitive sequence.
""",
)
