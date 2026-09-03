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


# Domain preset: parameterize the M6A-057 fixed particle radius scale.
replace_once(
    'src/domain/brush-schema.ts',
    """export function withBrushSprayEnabledV1(preset: BrushPresetV1, enabled: boolean): BrushPresetV1 {
  if (typeof enabled !== 'boolean') throw new TypeError('brush spray enabled flag must be boolean');
  if (enabled === DEFAULT_BRUSH_SPRAY_ENABLED_V1) {
    const { enabled: _enabled, ...spray } = preset.spray;
    return normalizeBrushPresetV1({ ...preset, spray });
  }
  return normalizeBrushPresetV1({ ...preset, spray: { ...preset.spray, enabled } });
}

export type BrushTipSelectionModeV1 = 'fixed' | 'sequence' | 'random-per-stamp';
""",
    """export function withBrushSprayEnabledV1(preset: BrushPresetV1, enabled: boolean): BrushPresetV1 {
  if (typeof enabled !== 'boolean') throw new TypeError('brush spray enabled flag must be boolean');
  if (enabled === DEFAULT_BRUSH_SPRAY_ENABLED_V1) {
    const { enabled: _enabled, ...spray } = preset.spray;
    return normalizeBrushPresetV1({ ...preset, spray });
  }
  return normalizeBrushPresetV1({ ...preset, spray: { ...preset.spray, enabled } });
}

export const DEFAULT_BRUSH_SPRAY_PARTICLE_SIZE_RATIO_V1 = 0.35 as const;
export const MIN_BRUSH_SPRAY_PARTICLE_SIZE_RATIO_V1 = 0.01 as const;
export const MAX_BRUSH_SPRAY_PARTICLE_SIZE_RATIO_V1 = 4 as const;

export function brushSprayParticleSizeRatioV1(preset: BrushPresetV1): number {
  const value = preset.spray.particleSizeRatio;
  return typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= MIN_BRUSH_SPRAY_PARTICLE_SIZE_RATIO_V1 &&
    value <= MAX_BRUSH_SPRAY_PARTICLE_SIZE_RATIO_V1
    ? value
    : DEFAULT_BRUSH_SPRAY_PARTICLE_SIZE_RATIO_V1;
}

export function withBrushSprayParticleSizeRatioV1(
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
)

# Canonical dab kernel.
replace_once(
    'src/gpu/baseline-brush.ts',
    'export const BASELINE_BRUSH_SPRAY_PARTICLE_SCALE_V1 = 0.35 as const;\n',
    """export const BASELINE_BRUSH_SPRAY_PARTICLE_SCALE_V1 = 0.35 as const;
export const BASELINE_BRUSH_SPRAY_PARTICLE_SCALE_MIN_V1 = 0.01 as const;
export const BASELINE_BRUSH_SPRAY_PARTICLE_SCALE_MAX_V1 = 4 as const;
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    '  readonly #sprayEnabled: boolean;\n  readonly #randomSeed: number;\n',
    '  readonly #sprayEnabled: boolean;\n  readonly #sprayParticleSizeRatio: number;\n  readonly #randomSeed: number;\n',
)
replace_once(
    'src/gpu/baseline-brush.ts',
    '      readonly sprayEnabled?: boolean;\n      readonly randomSeed?: number;\n',
    '      readonly sprayEnabled?: boolean;\n      readonly sprayParticleSizeRatio?: number;\n      readonly randomSeed?: number;\n',
)
replace_once(
    'src/gpu/baseline-brush.ts',
    '    const sprayEnabled = options.sprayEnabled ?? BASELINE_BRUSH_SPRAY_ENABLED;\n    const randomSeed = options.randomSeed ?? 0;\n',
    """    const sprayEnabled = options.sprayEnabled ?? BASELINE_BRUSH_SPRAY_ENABLED;
    const sprayParticleSizeRatio =
      options.sprayParticleSizeRatio ?? BASELINE_BRUSH_SPRAY_PARTICLE_SCALE_V1;
    const randomSeed = options.randomSeed ?? 0;
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """    if (typeof sprayEnabled !== 'boolean') {
      throw new TypeError('baseline brush spray enabled flag must be boolean');
    }
    if (!Number.isSafeInteger(randomSeed) || randomSeed < 0 || randomSeed > 0xffffffff) {
""",
    """    if (typeof sprayEnabled !== 'boolean') {
      throw new TypeError('baseline brush spray enabled flag must be boolean');
    }
    if (
      !Number.isFinite(sprayParticleSizeRatio) ||
      sprayParticleSizeRatio < BASELINE_BRUSH_SPRAY_PARTICLE_SCALE_MIN_V1 ||
      sprayParticleSizeRatio > BASELINE_BRUSH_SPRAY_PARTICLE_SCALE_MAX_V1
    ) {
      throw new RangeError('baseline brush spray particle size ratio must be within 0.01..4');
    }
    if (!Number.isSafeInteger(randomSeed) || randomSeed < 0 || randomSeed > 0xffffffff) {
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    '    this.#sprayEnabled = sprayEnabled;\n    this.#randomSeed = randomSeed >>> 0;\n',
    '    this.#sprayEnabled = sprayEnabled;\n    this.#sprayParticleSizeRatio = sprayParticleSizeRatio;\n    this.#randomSeed = randomSeed >>> 0;\n',
)
replace_once(
    'src/gpu/baseline-brush.ts',
    '      emitParticle(particle.x, particle.y, BASELINE_BRUSH_SPRAY_PARTICLE_SCALE_V1);\n',
    '      emitParticle(particle.x, particle.y, this.#sprayParticleSizeRatio);\n',
)

# Canonical facade.
replace_once(
    'src/app/canonical-raster-brush.ts',
    '      readonly sprayEnabled?: boolean;\n      readonly randomSeed?: number;\n',
    '      readonly sprayEnabled?: boolean;\n      readonly sprayParticleSizeRatio?: number;\n      readonly randomSeed?: number;\n',
)
replace_once(
    'src/app/canonical-raster-brush.ts',
    '      ...(options.sprayEnabled === undefined ? {} : { sprayEnabled: options.sprayEnabled }),\n      ...(options.randomSeed === undefined ? {} : { randomSeed: options.randomSeed }),\n',
    """      ...(options.sprayEnabled === undefined ? {} : { sprayEnabled: options.sprayEnabled }),
      ...(options.sprayParticleSizeRatio === undefined
        ? {}
        : { sprayParticleSizeRatio: options.sprayParticleSizeRatio }),
      ...(options.randomSeed === undefined ? {} : { randomSeed: options.randomSeed }),
""",
)

# Runtime session.
replace_once(
    'src/app/paint-session-controller.ts',
    '  BASELINE_BRUSH_SPRAY_ENABLED,\n  DEFAULT_BASELINE_BRUSH_COLOR_V1,\n',
    '  BASELINE_BRUSH_SPRAY_ENABLED,\n  BASELINE_BRUSH_SPRAY_PARTICLE_SCALE_V1,\n  DEFAULT_BASELINE_BRUSH_COLOR_V1,\n',
)
replace_once(
    'src/app/paint-session-controller.ts',
    '  readonly brushSprayEnabled: boolean;\n  readonly brushTipAngleDegrees: number;\n',
    '  readonly brushSprayEnabled: boolean;\n  readonly brushSprayParticleSizeRatio: number;\n  readonly brushTipAngleDegrees: number;\n',
)
replace_once(
    'src/app/paint-session-controller.ts',
    '  #brushSprayEnabled: boolean = BASELINE_BRUSH_SPRAY_ENABLED;\n  #brushTipAngleDegrees: number = BASELINE_BRUSH_TIP_ANGLE_DEGREES;\n',
    '  #brushSprayEnabled: boolean = BASELINE_BRUSH_SPRAY_ENABLED;\n  #brushSprayParticleSizeRatio: number = BASELINE_BRUSH_SPRAY_PARTICLE_SCALE_V1;\n  #brushTipAngleDegrees: number = BASELINE_BRUSH_TIP_ANGLE_DEGREES;\n',
)
replace_once(
    'src/app/paint-session-controller.ts',
    '      brushSprayEnabled: this.#brushSprayEnabled,\n      brushTipAngleDegrees: this.#brushTipAngleDegrees,\n',
    '      brushSprayEnabled: this.#brushSprayEnabled,\n      brushSprayParticleSizeRatio: this.#brushSprayParticleSizeRatio,\n      brushTipAngleDegrees: this.#brushTipAngleDegrees,\n',
)
replace_once(
    'src/app/paint-session-controller.ts',
    """  brushSprayEnabled(): boolean {
    return this.#brushSprayEnabled;
  }

  setBrushTipAngleDegrees(angleDegrees: number): number {
""",
    """  brushSprayEnabled(): boolean {
    return this.#brushSprayEnabled;
  }

  setBrushSprayParticleSizeRatio(particleSizeRatio: number): number {
    if (!Number.isFinite(particleSizeRatio) || particleSizeRatio < 0.01 || particleSizeRatio > 4) {
      throw new RangeError('invalid runtime brush spray particle size ratio');
    }
    if (particleSizeRatio !== this.#brushSprayParticleSizeRatio) this.#clearActiveStroke();
    this.#brushSprayParticleSizeRatio = particleSizeRatio;
    return this.#brushSprayParticleSizeRatio;
  }

  brushSprayParticleSizeRatio(): number {
    return this.#brushSprayParticleSizeRatio;
  }

  setBrushTipAngleDegrees(angleDegrees: number): number {
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    '        sprayEnabled: this.#brushSprayEnabled,\n        randomSeed: randomSeed ?? 0,\n',
    '        sprayEnabled: this.#brushSprayEnabled,\n        sprayParticleSizeRatio: this.#brushSprayParticleSizeRatio,\n        randomSeed: randomSeed ?? 0,\n',
)

# Preset library mutation plumbing.
replace_once(
    'src/app/brush-preset-library.ts',
    '  withBrushSprayEnabledV1,\n  withBrushStrokeSpacingV1,\n',
    '  withBrushSprayEnabledV1,\n  withBrushSprayParticleSizeRatioV1,\n  withBrushStrokeSpacingV1,\n',
)
append_once(
    'src/app/brush-preset-library.ts',
    'export function updateBrushPresetSprayParticleSizeRatioV1(',
    """
export function updateBrushPresetSprayParticleSizeRatioV1(
  state: BrushPresetLibraryStateV1,
  presetId: string,
  particleSizeRatio: number,
): BrushPresetLibraryStateV1 {
  return updateItemV1(state, presetId, (item) => {
    if (item.locked) throw new Error('locked brush preset cannot be edited');
    const current = withBrushSprayParticleSizeRatioV1(item.preset, particleSizeRatio);
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

# Tool Properties / preset UI.
replace_once(
    'src/app/brush-preset-controller.ts',
    '  brushSprayEnabledV1,\n  BUILTIN_BRUSH_GRAIN_RESOURCES_V1,\n',
    '  brushSprayEnabledV1,\n  brushSprayParticleSizeRatioV1,\n  BUILTIN_BRUSH_GRAIN_RESOURCES_V1,\n',
)
replace_once(
    'src/app/brush-preset-controller.ts',
    '  updateBrushPresetSprayEnabledV1,\n  updateBrushPresetSpacingV1,\n',
    '  updateBrushPresetSprayEnabledV1,\n  updateBrushPresetSprayParticleSizeRatioV1,\n  updateBrushPresetSpacingV1,\n',
)
replace_once(
    'src/app/brush-preset-controller.ts',
    "  const sprayEnabledButton = requireElement('#brush-spray-enabled', HTMLButtonElement);\n  const tipShape = requireElement('#brush-tip-shape', HTMLSelectElement);\n",
    """  const sprayEnabledButton = requireElement('#brush-spray-enabled', HTMLButtonElement);
  const sprayParticleSizeRange = requireElement('#brush-spray-particle-size-range', HTMLInputElement);
  const sprayParticleSizeNumber = requireElement('#brush-spray-particle-size-number', HTMLInputElement);
  const tipShape = requireElement('#brush-tip-shape', HTMLSelectElement);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    const sprayEnabled = brushSprayEnabledV1(item.preset);
    input.paintSession.setBrushSprayEnabled(sprayEnabled);
    const tipAssets = brushTipAssetsV1(item.preset);
""",
    """    const sprayEnabled = brushSprayEnabledV1(item.preset);
    input.paintSession.setBrushSprayEnabled(sprayEnabled);
    const sprayParticleSizeRatio = brushSprayParticleSizeRatioV1(item.preset);
    input.paintSession.setBrushSprayParticleSizeRatio(sprayParticleSizeRatio);
    const tipAssets = brushTipAssetsV1(item.preset);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    '    input.root.dataset.illustroBrushSprayEnabled = String(sprayEnabled);\n    input.root.dataset.illustroBrushTipShape = brushTipShapeV1(item.preset);\n',
    '    input.root.dataset.illustroBrushSprayEnabled = String(sprayEnabled);\n    input.root.dataset.illustroBrushSprayParticleSizeRatio = String(sprayParticleSizeRatio);\n    input.root.dataset.illustroBrushTipShape = brushTipShapeV1(item.preset);\n',
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    const sprayEnabled = brushSprayEnabledV1(selected.preset);
    sprayEnabledButton.textContent = sprayEnabled ? 'ON' : 'OFF';
    sprayEnabledButton.setAttribute('aria-pressed', String(sprayEnabled));
    tipShape.value = brushTipShapeV1(selected.preset);
""",
    """    const sprayEnabled = brushSprayEnabledV1(selected.preset);
    sprayEnabledButton.textContent = sprayEnabled ? 'ON' : 'OFF';
    sprayEnabledButton.setAttribute('aria-pressed', String(sprayEnabled));
    const sprayParticleSizeRatio = brushSprayParticleSizeRatioV1(selected.preset);
    configurePair(
      sprayParticleSizeRange,
      sprayParticleSizeNumber,
      1,
      400,
      1,
      sprayParticleSizeRatio * 100,
    );
    tipShape.value = brushTipShapeV1(selected.preset);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    "    const sprayLabel = sprayEnabled ? ' · Spray' : '';\n",
    """    const sprayLabel = sprayEnabled ? ' · Spray' : '';
    const sprayParticleSizeLabel = sprayEnabled
      ? ` · Particle${Math.round(sprayParticleSizeRatio * 100)}%`
      : '';
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    '${densityJitterLabel}${colorJitterLabel}${sprayLabel}`;\n',
    '${densityJitterLabel}${colorJitterLabel}${sprayLabel}${sprayParticleSizeLabel}`;\n',
)
replace_once(
    'src/app/brush-preset-controller.ts',
    '      sprayEnabledButton,\n      tipShape,\n',
    '      sprayEnabledButton,\n      sprayParticleSizeRange,\n      sprayParticleSizeNumber,\n      tipShape,\n',
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    ]) {
      control.disabled = locked;
    }
    pressureCurveEditor?.setDisabled(locked);
""",
    """    ]) {
      control.disabled = locked;
    }
    sprayParticleSizeRange.disabled = locked || !sprayEnabled;
    sprayParticleSizeNumber.disabled = locked || !sprayEnabled;
    pressureCurveEditor?.setDisabled(locked);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  const onSprayEnabled = (): void =>
    mutate(() =>
      updateBrushPresetSprayEnabledV1(
        state,
        state.selectedPresetId,
        !brushSprayEnabledV1(selectedBrushPresetItemV1(state).preset),
      ),
    );
  const onTipShape = (): void => {
""",
    """  const onSprayEnabled = (): void =>
    mutate(() =>
      updateBrushPresetSprayEnabledV1(
        state,
        state.selectedPresetId,
        !brushSprayEnabledV1(selectedBrushPresetItemV1(state).preset),
      ),
    );
  const updateSprayParticleSize = (valuePercent: number): void =>
    mutate(() =>
      updateBrushPresetSprayParticleSizeRatioV1(
        state,
        state.selectedPresetId,
        valuePercent / 100,
      ),
    );
  const onSprayParticleSizeRange = (): void =>
    updateSprayParticleSize(Number(sprayParticleSizeRange.value));
  const onSprayParticleSizeNumber = (): void =>
    updateSprayParticleSize(Number(sprayParticleSizeNumber.value));
  const onTipShape = (): void => {
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    "  sprayEnabledButton.addEventListener('click', onSprayEnabled);\n  tipShape.addEventListener('change', onTipShape);\n",
    """  sprayEnabledButton.addEventListener('click', onSprayEnabled);
  sprayParticleSizeRange.addEventListener('input', onSprayParticleSizeRange);
  sprayParticleSizeNumber.addEventListener('change', onSprayParticleSizeNumber);
  tipShape.addEventListener('change', onTipShape);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    "      sprayEnabledButton.removeEventListener('click', onSprayEnabled);\n      tipShape.removeEventListener('change', onTipShape);\n",
    """      sprayEnabledButton.removeEventListener('click', onSprayEnabled);
      sprayParticleSizeRange.removeEventListener('input', onSprayParticleSizeRange);
      sprayParticleSizeNumber.removeEventListener('change', onSprayParticleSizeNumber);
      tipShape.removeEventListener('change', onTipShape);
""",
)

# UI row: only enabled when Scatter is on, matching the reference-app interaction model.
replace_once(
    'src/index.html',
    """              <div class="shell-brush-property-row shell-brush-tip-property-row">
                <label for="brush-spray-enabled">散布</label>
                <button id="brush-spray-enabled" type="button" aria-pressed="false" title="ブラシパターンを複数粒子として決定論的に散布">OFF</button>
                <span class="shell-brush-tip-kind">Spray</span>
              </div>
              <div class="shell-brush-property-row shell-brush-tip-property-row">
                <label for="brush-tip-shape">ブラシ形状</label>
""",
    """              <div class="shell-brush-property-row shell-brush-tip-property-row">
                <label for="brush-spray-enabled">散布</label>
                <button id="brush-spray-enabled" type="button" aria-pressed="false" title="ブラシパターンを複数粒子として決定論的に散布">OFF</button>
                <span class="shell-brush-tip-kind">Spray</span>
              </div>
              <div class="shell-brush-property-row">
                <label for="brush-spray-particle-size-range">粒子サイズ</label>
                <input id="brush-spray-particle-size-range" type="range" min="1" max="400" step="1" value="35" disabled />
                <span class="shell-brush-property-number shell-brush-property-percent"><input id="brush-spray-particle-size-number" type="number" inputmode="decimal" min="1" max="400" step="1" value="35" aria-label="散布粒子サイズ" disabled /><span>%</span></span>
              </div>
              <div class="shell-brush-property-row shell-brush-tip-property-row">
                <label for="brush-tip-shape">ブラシ形状</label>
""",
)

# Targeted regression coverage.
write(
    'tests/unit/brush-particle-size.test.ts',
    """import { describe, expect, it } from 'vitest';
import {
  brushSprayParticleSizeRatioV1,
  createBaselineBrushPresetV1,
  withBrushSprayParticleSizeRatioV1,
} from '../../src/domain/brush-schema.js';
import { PaintSessionControllerV1 } from '../../src/app/paint-session-controller.js';
import {
  BASELINE_BRUSH_SPRAY_PARTICLE_SCALE_V1,
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

describe('M6A-058 spray particle size', () => {
  it('keeps the M6A-057 35% particle-size baseline as the canonical default', () => {
    const preset = createBaselineBrushPresetV1({
      id: 'test.spray-particle-size',
      name: 'Spray Particle Size',
      category: 'Test',
      behavior: 'paint',
    });
    expect(brushSprayParticleSizeRatioV1(preset)).toBe(BASELINE_BRUSH_SPRAY_PARTICLE_SCALE_V1);
    const changed = withBrushSprayParticleSizeRatioV1(preset, 0.6);
    expect(brushSprayParticleSizeRatioV1(changed)).toBe(0.6);
    expect(changed.spray.particleSizeRatio).toBe(0.6);
    const reset = withBrushSprayParticleSizeRatioV1(changed, 0.35);
    expect(brushSprayParticleSizeRatioV1(reset)).toBe(0.35);
    expect(reset.spray.particleSizeRatio).toBeUndefined();
    expect(() => withBrushSprayParticleSizeRatioV1(preset, 0.009)).toThrow(RangeError);
    expect(() => withBrushSprayParticleSizeRatioV1(preset, 4.01)).toThrow(RangeError);
  });

  it('keeps the existing spray output identical when the size ratio is omitted or explicitly 35%', () => {
    const implicit = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      sprayEnabled: true,
      randomSeed: 0x12345678,
    });
    const explicit = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      sprayEnabled: true,
      sprayParticleSizeRatio: 0.35,
      randomSeed: 0x12345678,
    });
    expect(explicit.beginDelta({ documentX: 40, documentY: 50 })).toEqual(
      implicit.beginDelta({ documentX: 40, documentY: 50 }),
    );
  });

  it('changes particle radius without changing the deterministic particle centers or burst count', () => {
    const seed = 0x2468ace0;
    const small = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      sprayEnabled: true,
      sprayParticleSizeRatio: 0.25,
      randomSeed: seed,
    });
    const large = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      sprayEnabled: true,
      sprayParticleSizeRatio: 0.75,
      randomSeed: seed,
    });
    const smallDabs = small.beginDelta({ documentX: 20, documentY: 30 });
    const largeDabs = large.beginDelta({ documentX: 20, documentY: 30 });
    expect(smallDabs).toHaveLength(4);
    expect(largeDabs).toHaveLength(4);
    expect(largeDabs.map((dab) => [dab.x, dab.y])).toEqual(smallDabs.map((dab) => [dab.x, dab.y]));
    expect(smallDabs.every((dab) => Math.abs(dab.radius - 2.5) < 1e-10)).toBe(true);
    expect(largeDabs.every((dab) => Math.abs(dab.radius - 7.5) < 1e-10)).toBe(true);
  });

  it('applies the particle ratio after parent size dynamics and jitter are resolved', () => {
    const seed = 0x10203040;
    const parent = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      sizeJitter: 0.4,
      randomSeed: seed,
    });
    const spray = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      sizeJitter: 0.4,
      sprayEnabled: true,
      sprayParticleSizeRatio: 0.5,
      randomSeed: seed,
    });
    const [parentDab] = parent.beginDelta({ documentX: 0, documentY: 0 });
    const particles = spray.beginDelta({ documentX: 0, documentY: 0 });
    expect(parentDab).toBeDefined();
    expect(particles.every((dab) => Math.abs(dab.radius - (parentDab?.radius ?? 0) * 0.5) < 1e-10)).toBe(true);
  });

  it('does not affect ordinary non-spray stamps', () => {
    const baseline = new BaselineBrushDabBuilderV1({ sizePx: 20, randomSeed: 5 });
    const configured = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      sprayEnabled: false,
      sprayParticleSizeRatio: 2,
      randomSeed: 5,
    });
    expect(configured.beginDelta({ documentX: 10, documentY: 10 })).toEqual(
      baseline.beginDelta({ documentX: 10, documentY: 10 }),
    );
  });

  it('captures particle size in runtime state without adding a primitive-only field', () => {
    const session = new PaintSessionControllerV1(new FakeRendererDocumentPort());
    expect(session.setBrushSprayParticleSizeRatio(0.8)).toBe(0.8);
    expect(session.snapshot().brushSprayParticleSizeRatio).toBe(0.8);
    const [dab] = new BaselineBrushDabBuilderV1({
      sprayEnabled: true,
      sprayParticleSizeRatio: 0.8,
      randomSeed: 7,
    }).beginDelta({ documentX: 0, documentY: 0 });
    expect(dab).toBeDefined();
    expect('sprayParticleSizeRatio' in (dab ?? {})).toBe(false);
  });
});
""",
)

# Verifier / canonical docs / progress.
append_once(
    'scripts/verify-m6a-brush.mjs',
    "M6A-058 progress is not complete",
    """
requireText(progress, 'M6A-058 particle size:完了', 'M6A-058 progress is not complete');
requireText(
  read('src/domain/brush-schema.ts'),
  'brushSprayParticleSizeRatioV1',
  'spray particle-size preset helper missing',
);
requireText(
  read('src/gpu/baseline-brush.ts'),
  'this.#sprayParticleSizeRatio',
  'spray particle-size ratio is not connected to canonical particle radius',
);
requireText(
  read('src/app/paint-session-controller.ts'),
  'setBrushSprayParticleSizeRatio',
  'spray particle size is not captured by the paint session',
);
requireText(
  read('src/index.html'),
  'id="brush-spray-particle-size-range"',
  'reachable spray particle-size control missing',
);
requireText(
  read('tests/unit/brush-particle-size.test.ts'),
  'without changing the deterministic particle centers or burst count',
  'spray particle-size regression coverage missing',
);
""",
)
replace_once(
    'IMPLEMENTATION_PROGRESS.md',
    'M6A-058 particle size:未完了\nM6A-059 particle density:未完了\n',
    """M6A-058 particle size:完了
再開メモ: M6A-058 particle sizeはM6A-057で固定していたparticle radius scale 0.35をspray.particleSizeRatioとして0.01..4でcanonical parameter化し、既定0.35で057出力を完全互換に保つ。値は親logical stampのsize taper / pressure・tilt・velocity・random dynamics / dynamic min-max clamp / size jitterで解決済みradiusへ最後に乗算するため、粒子サイズだけを変更してburst中心・particle count・spread・orientation・color・opacity・densityを変えない。Scatter OFFではこの値を設定しても通常stampへ影響しない。preset/runtime/facade/UIを接続し、primitive dab / Worker / Historyには専用fieldを追加せず解決済みradiusのみ保存する。UIは1..400%で、Scatter OFF時は無効化する。次はM6A-059 particle densityから再開する。
M6A-059 particle density:未完了
""",
)
append_once(
    'ILLUSTRO_DESIGN_MEMO.md',
    '## M6A spray particle-size boundary — 2026-09-03',
    """
## M6A spray particle-size boundary — 2026-09-03

**AUTHORITATIVE for M6A-058.** `BrushPresetV1.spray.particleSizeRatio` is the relative radius scale applied to each particle emitted by M6A-057 Spray mode. The domain is `0.01..4`, with `0.35` as the default so every preset that relied on the M6A-057 fixed baseline remains visually and numerically compatible.

Particle size is composed after the parent logical stamp's ordinary size pipeline has resolved stroke taper, pressure/tilt/velocity/random dynamics, dynamic minimum/maximum response, and size jitter. Therefore changing particle size scales only the final particle radius. It does not resample or move particle centers, change burst count/density, alter spread/distribution, change orientation, or modify color/opacity/tip density. M6A-059 through M6A-061 remain solely responsible for those later Spray controls.

When Spray is disabled, `particleSizeRatio` is inert and ordinary raster-stamp output is byte-for-byte/field-for-field unaffected. Primitive dabs, Worker payloads, history and recovery continue to store the resolved radius rather than a Spray-specific parameter. Tool Properties exposes the value as 1..400% and disables the control while Spray is off. This stage defines the relative particle-size contract; exact interoperability for reference-app absolute-pixel particle-size modes must be reported/mapped explicitly during the brush-interoperability audit rather than silently claimed here.
""",
)
