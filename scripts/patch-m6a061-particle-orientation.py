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


# Domain preset.
replace_once(
    'src/domain/brush-schema.ts',
    """export function withBrushSprayDeviationV1(
  preset: BrushPresetV1,
  deviation: number,
): BrushPresetV1 {
  if (!Number.isFinite(deviation) || deviation < -1 || deviation > 1) {
    throw new RangeError('brush spray deviation must be within -1..1');
  }
  if (deviation === DEFAULT_BRUSH_SPRAY_DEVIATION_V1) {
    const { deviation: _deviation, ...spray } = preset.spray;
    return normalizeBrushPresetV1({ ...preset, spray });
  }
  return normalizeBrushPresetV1({
    ...preset,
    spray: { ...preset.spray, deviation },
  });
}

export type BrushTipSelectionModeV1 = 'fixed' | 'sequence' | 'random-per-stamp';
""",
    """export function withBrushSprayDeviationV1(
  preset: BrushPresetV1,
  deviation: number,
): BrushPresetV1 {
  if (!Number.isFinite(deviation) || deviation < -1 || deviation > 1) {
    throw new RangeError('brush spray deviation must be within -1..1');
  }
  if (deviation === DEFAULT_BRUSH_SPRAY_DEVIATION_V1) {
    const { deviation: _deviation, ...spray } = preset.spray;
    return normalizeBrushPresetV1({ ...preset, spray });
  }
  return normalizeBrushPresetV1({
    ...preset,
    spray: { ...preset.spray, deviation },
  });
}

export const DEFAULT_BRUSH_SPRAY_ANGLE_BASED_ON_CENTER_V1 = false as const;

export function brushSprayAngleBasedOnCenterV1(preset: BrushPresetV1): boolean {
  const value = preset.spray.angleBasedOnCenter;
  return typeof value === 'boolean' ? value : DEFAULT_BRUSH_SPRAY_ANGLE_BASED_ON_CENTER_V1;
}

export function withBrushSprayAngleBasedOnCenterV1(
  preset: BrushPresetV1,
  enabled: boolean,
): BrushPresetV1 {
  if (typeof enabled !== 'boolean') {
    throw new TypeError('brush spray angle-based-on-center flag must be boolean');
  }
  if (enabled === DEFAULT_BRUSH_SPRAY_ANGLE_BASED_ON_CENTER_V1) {
    const { angleBasedOnCenter: _angleBasedOnCenter, ...spray } = preset.spray;
    return normalizeBrushPresetV1({ ...preset, spray });
  }
  return normalizeBrushPresetV1({
    ...preset,
    spray: { ...preset.spray, angleBasedOnCenter: enabled },
  });
}

export type BrushTipSelectionModeV1 = 'fixed' | 'sequence' | 'random-per-stamp';
""",
)

# Kernel: resolve and retain per-particle orientation on the logical-stamp record.
replace_once(
    'src/gpu/baseline-brush.ts',
    'export const BASELINE_BRUSH_SPRAY_DEVIATION_V1 = 0 as const;\n',
    'export const BASELINE_BRUSH_SPRAY_DEVIATION_V1 = 0 as const;\nexport const BASELINE_BRUSH_SPRAY_ANGLE_BASED_ON_CENTER_V1 = false as const;\n',
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """  readonly sprayParticles: readonly Readonly<{ x: number; y: number }>[] | null;
""",
    """  readonly sprayParticles: readonly Readonly<{
    x: number;
    y: number;
    tipAngleDegrees: number;
  }>[] | null;
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    '  readonly #spraySpreadRadiusRatio: number;\n  readonly #sprayDeviation: number;\n  readonly #randomSeed: number;\n',
    '  readonly #spraySpreadRadiusRatio: number;\n  readonly #sprayDeviation: number;\n  readonly #sprayAngleBasedOnCenter: boolean;\n  readonly #randomSeed: number;\n',
)
replace_once(
    'src/gpu/baseline-brush.ts',
    '      readonly spraySpreadRadiusRatio?: number;\n      readonly sprayDeviation?: number;\n      readonly randomSeed?: number;\n',
    '      readonly spraySpreadRadiusRatio?: number;\n      readonly sprayDeviation?: number;\n      readonly sprayAngleBasedOnCenter?: boolean;\n      readonly randomSeed?: number;\n',
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """    const spraySpreadRadiusRatio =
      options.spraySpreadRadiusRatio ?? BASELINE_BRUSH_SPRAY_SPREAD_RADIUS_RATIO_V1;
    const sprayDeviation = options.sprayDeviation ?? BASELINE_BRUSH_SPRAY_DEVIATION_V1;
    const randomSeed = options.randomSeed ?? 0;
""",
    """    const spraySpreadRadiusRatio =
      options.spraySpreadRadiusRatio ?? BASELINE_BRUSH_SPRAY_SPREAD_RADIUS_RATIO_V1;
    const sprayDeviation = options.sprayDeviation ?? BASELINE_BRUSH_SPRAY_DEVIATION_V1;
    const sprayAngleBasedOnCenter =
      options.sprayAngleBasedOnCenter ?? BASELINE_BRUSH_SPRAY_ANGLE_BASED_ON_CENTER_V1;
    const randomSeed = options.randomSeed ?? 0;
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """    if (!Number.isFinite(sprayDeviation) || sprayDeviation < -1 || sprayDeviation > 1) {
      throw new RangeError('baseline brush spray deviation must be within -1..1');
    }
    if (!Number.isSafeInteger(randomSeed) || randomSeed < 0 || randomSeed > 0xffffffff) {
""",
    """    if (!Number.isFinite(sprayDeviation) || sprayDeviation < -1 || sprayDeviation > 1) {
      throw new RangeError('baseline brush spray deviation must be within -1..1');
    }
    if (typeof sprayAngleBasedOnCenter !== 'boolean') {
      throw new TypeError('baseline brush spray angle-based-on-center flag must be boolean');
    }
    if (!Number.isSafeInteger(randomSeed) || randomSeed < 0 || randomSeed > 0xffffffff) {
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    '    this.#spraySpreadRadiusRatio = spraySpreadRadiusRatio;\n    this.#sprayDeviation = sprayDeviation;\n    this.#randomSeed = randomSeed >>> 0;\n',
    '    this.#spraySpreadRadiusRatio = spraySpreadRadiusRatio;\n    this.#sprayDeviation = sprayDeviation;\n    this.#sprayAngleBasedOnCenter = sprayAngleBasedOnCenter;\n    this.#randomSeed = randomSeed >>> 0;\n',
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """    const emitParticle = (particleX: number, particleY: number, radiusScale: number): void =>
      pushBaselineBrushStampV1(
        target,
        particleX,
        particleY,
        resolvedRadius * radiusScale,
        resolvedFlow,
        resolvedStrokeOpacity,
        this.#hardness,
        resolvedDensity,
        stamp.tipAngleDegrees,
        stamp.color,
        this.#tipShape,
        stamp.sampledTipAlpha,
      );
    if (stamp.sprayParticles === null) {
      emitParticle(stamp.x, stamp.y, 1);
      return;
    }
    for (const particle of stamp.sprayParticles) {
      emitParticle(particle.x, particle.y, this.#sprayParticleSizeRatio);
    }
""",
    """    const emitParticle = (
      particleX: number,
      particleY: number,
      radiusScale: number,
      tipAngleDegrees: number,
    ): void =>
      pushBaselineBrushStampV1(
        target,
        particleX,
        particleY,
        resolvedRadius * radiusScale,
        resolvedFlow,
        resolvedStrokeOpacity,
        this.#hardness,
        resolvedDensity,
        tipAngleDegrees,
        stamp.color,
        this.#tipShape,
        stamp.sampledTipAlpha,
      );
    if (stamp.sprayParticles === null) {
      emitParticle(stamp.x, stamp.y, 1, stamp.tipAngleDegrees);
      return;
    }
    for (const particle of stamp.sprayParticles) {
      emitParticle(
        particle.x,
        particle.y,
        this.#sprayParticleSizeRatio,
        particle.tipAngleDegrees,
      );
    }
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """            const spreadRadiusPx = this.#radius * this.#spraySpreadRadiusRatio;
            return Object.freeze({
              x: jitteredX + unit.x * spreadRadiusPx,
              y: jitteredY + unit.y * spreadRadiusPx,
            });
""",
    """            const spreadRadiusPx = this.#radius * this.#spraySpreadRadiusRatio;
            const particleX = jitteredX + unit.x * spreadRadiusPx;
            const particleY = jitteredY + unit.y * spreadRadiusPx;
            const radialLength = Math.hypot(particleX - jitteredX, particleY - jitteredY);
            const particleTipAngleDegrees =
              this.#sprayAngleBasedOnCenter && radialLength > 1e-12
                ? normalizeBaselineBrushTipAngleDegreesV1(
                    jitteredTipAngleDegrees +
                      (Math.atan2(particleY - jitteredY, particleX - jitteredX) * 180) / Math.PI,
                  )
                : jitteredTipAngleDegrees;
            return Object.freeze({
              x: particleX,
              y: particleY,
              tipAngleDegrees: particleTipAngleDegrees,
            });
""",
)

# Canonical facade.
replace_once(
    'src/app/canonical-raster-brush.ts',
    '      readonly spraySpreadRadiusRatio?: number;\n      readonly sprayDeviation?: number;\n      readonly randomSeed?: number;\n',
    '      readonly spraySpreadRadiusRatio?: number;\n      readonly sprayDeviation?: number;\n      readonly sprayAngleBasedOnCenter?: boolean;\n      readonly randomSeed?: number;\n',
)
replace_once(
    'src/app/canonical-raster-brush.ts',
    """      ...(options.sprayDeviation === undefined ? {} : { sprayDeviation: options.sprayDeviation }),
      ...(options.randomSeed === undefined ? {} : { randomSeed: options.randomSeed }),
""",
    """      ...(options.sprayDeviation === undefined ? {} : { sprayDeviation: options.sprayDeviation }),
      ...(options.sprayAngleBasedOnCenter === undefined
        ? {}
        : { sprayAngleBasedOnCenter: options.sprayAngleBasedOnCenter }),
      ...(options.randomSeed === undefined ? {} : { randomSeed: options.randomSeed }),
""",
)

# Runtime session.
replace_once(
    'src/app/paint-session-controller.ts',
    '  BASELINE_BRUSH_SPRAY_SPREAD_RADIUS_RATIO_V1,\n  BASELINE_BRUSH_SPRAY_DEVIATION_V1,\n  DEFAULT_BASELINE_BRUSH_COLOR_V1,\n',
    '  BASELINE_BRUSH_SPRAY_SPREAD_RADIUS_RATIO_V1,\n  BASELINE_BRUSH_SPRAY_DEVIATION_V1,\n  BASELINE_BRUSH_SPRAY_ANGLE_BASED_ON_CENTER_V1,\n  DEFAULT_BASELINE_BRUSH_COLOR_V1,\n',
)
replace_once(
    'src/app/paint-session-controller.ts',
    '  readonly brushSpraySpreadRadiusRatio: number;\n  readonly brushSprayDeviation: number;\n  readonly brushTipAngleDegrees: number;\n',
    '  readonly brushSpraySpreadRadiusRatio: number;\n  readonly brushSprayDeviation: number;\n  readonly brushSprayAngleBasedOnCenter: boolean;\n  readonly brushTipAngleDegrees: number;\n',
)
replace_once(
    'src/app/paint-session-controller.ts',
    '  #brushSpraySpreadRadiusRatio: number = BASELINE_BRUSH_SPRAY_SPREAD_RADIUS_RATIO_V1;\n  #brushSprayDeviation: number = BASELINE_BRUSH_SPRAY_DEVIATION_V1;\n  #brushTipAngleDegrees: number = BASELINE_BRUSH_TIP_ANGLE_DEGREES;\n',
    '  #brushSpraySpreadRadiusRatio: number = BASELINE_BRUSH_SPRAY_SPREAD_RADIUS_RATIO_V1;\n  #brushSprayDeviation: number = BASELINE_BRUSH_SPRAY_DEVIATION_V1;\n  #brushSprayAngleBasedOnCenter: boolean = BASELINE_BRUSH_SPRAY_ANGLE_BASED_ON_CENTER_V1;\n  #brushTipAngleDegrees: number = BASELINE_BRUSH_TIP_ANGLE_DEGREES;\n',
)
replace_once(
    'src/app/paint-session-controller.ts',
    '      brushSpraySpreadRadiusRatio: this.#brushSpraySpreadRadiusRatio,\n      brushSprayDeviation: this.#brushSprayDeviation,\n      brushTipAngleDegrees: this.#brushTipAngleDegrees,\n',
    '      brushSpraySpreadRadiusRatio: this.#brushSpraySpreadRadiusRatio,\n      brushSprayDeviation: this.#brushSprayDeviation,\n      brushSprayAngleBasedOnCenter: this.#brushSprayAngleBasedOnCenter,\n      brushTipAngleDegrees: this.#brushTipAngleDegrees,\n',
)
replace_once(
    'src/app/paint-session-controller.ts',
    """  brushSpraySpread(): Readonly<{ spreadRadiusRatio: number; deviation: number }> {
    return Object.freeze({
      spreadRadiusRatio: this.#brushSpraySpreadRadiusRatio,
      deviation: this.#brushSprayDeviation,
    });
  }

  setBrushTipAngleDegrees(angleDegrees: number): number {
""",
    """  brushSpraySpread(): Readonly<{ spreadRadiusRatio: number; deviation: number }> {
    return Object.freeze({
      spreadRadiusRatio: this.#brushSpraySpreadRadiusRatio,
      deviation: this.#brushSprayDeviation,
    });
  }

  setBrushSprayAngleBasedOnCenter(enabled: boolean): boolean {
    if (typeof enabled !== 'boolean') {
      throw new TypeError('invalid runtime brush spray angle-based-on-center flag');
    }
    if (enabled !== this.#brushSprayAngleBasedOnCenter) this.#clearActiveStroke();
    this.#brushSprayAngleBasedOnCenter = enabled;
    return this.#brushSprayAngleBasedOnCenter;
  }

  brushSprayAngleBasedOnCenter(): boolean {
    return this.#brushSprayAngleBasedOnCenter;
  }

  setBrushTipAngleDegrees(angleDegrees: number): number {
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    '        spraySpreadRadiusRatio: this.#brushSpraySpreadRadiusRatio,\n        sprayDeviation: this.#brushSprayDeviation,\n        randomSeed: randomSeed ?? 0,\n',
    '        spraySpreadRadiusRatio: this.#brushSpraySpreadRadiusRatio,\n        sprayDeviation: this.#brushSprayDeviation,\n        sprayAngleBasedOnCenter: this.#brushSprayAngleBasedOnCenter,\n        randomSeed: randomSeed ?? 0,\n',
)

# Preset library.
replace_once(
    'src/app/brush-preset-library.ts',
    '  withBrushSpraySpreadRadiusRatioV1,\n  withBrushSprayDeviationV1,\n  withBrushStrokeSpacingV1,\n',
    '  withBrushSpraySpreadRadiusRatioV1,\n  withBrushSprayDeviationV1,\n  withBrushSprayAngleBasedOnCenterV1,\n  withBrushStrokeSpacingV1,\n',
)
append_once(
    'src/app/brush-preset-library.ts',
    'export function updateBrushPresetSprayAngleBasedOnCenterV1(',
    """
export function updateBrushPresetSprayAngleBasedOnCenterV1(
  state: BrushPresetLibraryStateV1,
  presetId: string,
  enabled: boolean,
): BrushPresetLibraryStateV1 {
  return updateItemV1(state, presetId, (item) => {
    if (item.locked) throw new Error('locked brush preset cannot be edited');
    const current = withBrushSprayAngleBasedOnCenterV1(item.preset, enabled);
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
    '  brushSpraySpreadRadiusRatioV1,\n  brushSprayDeviationV1,\n  BUILTIN_BRUSH_GRAIN_RESOURCES_V1,\n',
    '  brushSpraySpreadRadiusRatioV1,\n  brushSprayDeviationV1,\n  brushSprayAngleBasedOnCenterV1,\n  BUILTIN_BRUSH_GRAIN_RESOURCES_V1,\n',
)
replace_once(
    'src/app/brush-preset-controller.ts',
    '  updateBrushPresetSprayParticleDensityV1,\n  updateBrushPresetSpraySpreadV1,\n  updateBrushPresetSpacingV1,\n',
    '  updateBrushPresetSprayParticleDensityV1,\n  updateBrushPresetSpraySpreadV1,\n  updateBrushPresetSprayAngleBasedOnCenterV1,\n  updateBrushPresetSpacingV1,\n',
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  const sprayDeviationRange = requireElement('#brush-spray-deviation-range', HTMLInputElement);
  const sprayDeviationNumber = requireElement('#brush-spray-deviation-number', HTMLInputElement);
  const tipShape = requireElement('#brush-tip-shape', HTMLSelectElement);
""",
    """  const sprayDeviationRange = requireElement('#brush-spray-deviation-range', HTMLInputElement);
  const sprayDeviationNumber = requireElement('#brush-spray-deviation-number', HTMLInputElement);
  const sprayAngleBasedOnCenterButton = requireElement(
    '#brush-spray-angle-based-on-center',
    HTMLButtonElement,
  );
  const tipShape = requireElement('#brush-tip-shape', HTMLSelectElement);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    const spraySpreadRadiusRatio = brushSpraySpreadRadiusRatioV1(item.preset);
    const sprayDeviation = brushSprayDeviationV1(item.preset);
    input.paintSession.setBrushSpraySpread(spraySpreadRadiusRatio, sprayDeviation);
    const tipAssets = brushTipAssetsV1(item.preset);
""",
    """    const spraySpreadRadiusRatio = brushSpraySpreadRadiusRatioV1(item.preset);
    const sprayDeviation = brushSprayDeviationV1(item.preset);
    input.paintSession.setBrushSpraySpread(spraySpreadRadiusRatio, sprayDeviation);
    const sprayAngleBasedOnCenter = brushSprayAngleBasedOnCenterV1(item.preset);
    input.paintSession.setBrushSprayAngleBasedOnCenter(sprayAngleBasedOnCenter);
    const tipAssets = brushTipAssetsV1(item.preset);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    '    input.root.dataset.illustroBrushSpraySpreadRadiusRatio = String(spraySpreadRadiusRatio);\n    input.root.dataset.illustroBrushSprayDeviation = String(sprayDeviation);\n    input.root.dataset.illustroBrushTipShape = brushTipShapeV1(item.preset);\n',
    '    input.root.dataset.illustroBrushSpraySpreadRadiusRatio = String(spraySpreadRadiusRatio);\n    input.root.dataset.illustroBrushSprayDeviation = String(sprayDeviation);\n    input.root.dataset.illustroBrushSprayAngleBasedOnCenter = String(sprayAngleBasedOnCenter);\n    input.root.dataset.illustroBrushTipShape = brushTipShapeV1(item.preset);\n',
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    configurePair(sprayDeviationRange, sprayDeviationNumber, -100, 100, 1, sprayDeviation * 100);
    tipShape.value = brushTipShapeV1(selected.preset);
""",
    """    configurePair(sprayDeviationRange, sprayDeviationNumber, -100, 100, 1, sprayDeviation * 100);
    const sprayAngleBasedOnCenter = brushSprayAngleBasedOnCenterV1(selected.preset);
    sprayAngleBasedOnCenterButton.textContent = sprayAngleBasedOnCenter ? 'ON' : 'OFF';
    sprayAngleBasedOnCenterButton.setAttribute('aria-pressed', String(sprayAngleBasedOnCenter));
    tipShape.value = brushTipShapeV1(selected.preset);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    const spraySpreadLabel = sprayEnabled
      ? ` · Spread${Math.round(spraySpreadRadiusRatio * 100)}%${sprayDeviation === 0 ? '' : `/Dev${Math.round(sprayDeviation * 100)}%`}`
      : '';
    propertyStatus.textContent = """,
    """    const spraySpreadLabel = sprayEnabled
      ? ` · Spread${Math.round(spraySpreadRadiusRatio * 100)}%${sprayDeviation === 0 ? '' : `/Dev${Math.round(sprayDeviation * 100)}%`}`
      : '';
    const sprayOrientationLabel = sprayEnabled && sprayAngleBasedOnCenter ? ' · CenterAngle' : '';
    propertyStatus.textContent = """,
)
replace_once(
    'src/app/brush-preset-controller.ts',
    '${sprayParticleDensityLabel}${spraySpreadLabel}`;\n',
    '${sprayParticleDensityLabel}${spraySpreadLabel}${sprayOrientationLabel}`;\n',
)
replace_once(
    'src/app/brush-preset-controller.ts',
    '      sprayDeviationRange,\n      sprayDeviationNumber,\n      tipShape,\n',
    '      sprayDeviationRange,\n      sprayDeviationNumber,\n      sprayAngleBasedOnCenterButton,\n      tipShape,\n',
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    sprayDeviationRange.disabled = locked || !sprayEnabled;
    sprayDeviationNumber.disabled = locked || !sprayEnabled;
    pressureCurveEditor?.setDisabled(locked);
""",
    """    sprayDeviationRange.disabled = locked || !sprayEnabled;
    sprayDeviationNumber.disabled = locked || !sprayEnabled;
    sprayAngleBasedOnCenterButton.disabled = locked || !sprayEnabled;
    pressureCurveEditor?.setDisabled(locked);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  const onSprayDeviationNumber = (): void =>
    updateSpraySpread(Number(spraySpreadRadiusNumber.value), Number(sprayDeviationNumber.value));
  const onTipShape = (): void => {
""",
    """  const onSprayDeviationNumber = (): void =>
    updateSpraySpread(Number(spraySpreadRadiusNumber.value), Number(sprayDeviationNumber.value));
  const onSprayAngleBasedOnCenter = (): void =>
    mutate(() =>
      updateBrushPresetSprayAngleBasedOnCenterV1(
        state,
        state.selectedPresetId,
        !brushSprayAngleBasedOnCenterV1(selectedBrushPresetItemV1(state).preset),
      ),
    );
  const onTipShape = (): void => {
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  sprayDeviationRange.addEventListener('input', onSprayDeviationRange);
  sprayDeviationNumber.addEventListener('change', onSprayDeviationNumber);
  tipShape.addEventListener('change', onTipShape);
""",
    """  sprayDeviationRange.addEventListener('input', onSprayDeviationRange);
  sprayDeviationNumber.addEventListener('change', onSprayDeviationNumber);
  sprayAngleBasedOnCenterButton.addEventListener('click', onSprayAngleBasedOnCenter);
  tipShape.addEventListener('change', onTipShape);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """      sprayDeviationRange.removeEventListener('input', onSprayDeviationRange);
      sprayDeviationNumber.removeEventListener('change', onSprayDeviationNumber);
      pressureCurveEditor?.dispose();
""",
    """      sprayDeviationRange.removeEventListener('input', onSprayDeviationRange);
      sprayDeviationNumber.removeEventListener('change', onSprayDeviationNumber);
      sprayAngleBasedOnCenterButton.removeEventListener('click', onSprayAngleBasedOnCenter);
      pressureCurveEditor?.dispose();
""",
)

# UI.
replace_once(
    'src/index.html',
    """              <div class="shell-brush-property-row">
                <label for="brush-spray-deviation-range">分布偏り</label>
                <input id="brush-spray-deviation-range" type="range" min="-100" max="100" step="1" value="0" disabled />
                <span class="shell-brush-property-number shell-brush-property-percent"><input id="brush-spray-deviation-number" type="number" inputmode="decimal" min="-100" max="100" step="1" value="0" aria-label="散布分布偏り。負は外周寄り、正は中心寄り" disabled /><span>%</span></span>
              </div>
              <div class="shell-brush-property-row shell-brush-tip-property-row">
""",
    """              <div class="shell-brush-property-row">
                <label for="brush-spray-deviation-range">分布偏り</label>
                <input id="brush-spray-deviation-range" type="range" min="-100" max="100" step="1" value="0" disabled />
                <span class="shell-brush-property-number shell-brush-property-percent"><input id="brush-spray-deviation-number" type="number" inputmode="decimal" min="-100" max="100" step="1" value="0" aria-label="散布分布偏り。負は外周寄り、正は中心寄り" disabled /><span>%</span></span>
              </div>
              <div class="shell-brush-property-row shell-brush-tip-property-row">
                <label for="brush-spray-angle-based-on-center">中心基準角度</label>
                <button id="brush-spray-angle-based-on-center" type="button" aria-pressed="false" title="各粒子の向きを散布中心からの径方向を基準にする" disabled>OFF</button>
                <span class="shell-brush-tip-kind">Orient</span>
              </div>
              <div class="shell-brush-property-row shell-brush-tip-property-row">
""",
)

# Targeted tests.
write(
    'tests/unit/brush-particle-orientation.test.ts',
    """import { describe, expect, it } from 'vitest';
import {
  brushSprayAngleBasedOnCenterV1,
  createBaselineBrushPresetV1,
  withBrushSprayAngleBasedOnCenterV1,
} from '../../src/domain/brush-schema.js';
import { PaintSessionControllerV1 } from '../../src/app/paint-session-controller.js';
import { BaselineBrushDabBuilderV1 } from '../../src/gpu/baseline-brush.js';

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

const normalize = (degrees: number): number => ((degrees % 360) + 360) % 360;

describe('M6A-061 spray particle orientation', () => {
  it('stores center-based orientation as an exact false default', () => {
    const preset = createBaselineBrushPresetV1({
      id: 'test.spray-orientation',
      name: 'Spray Orientation',
      category: 'Test',
      behavior: 'paint',
    });
    expect(brushSprayAngleBasedOnCenterV1(preset)).toBe(false);
    const changed = withBrushSprayAngleBasedOnCenterV1(preset, true);
    expect(brushSprayAngleBasedOnCenterV1(changed)).toBe(true);
    expect(changed.spray.angleBasedOnCenter).toBe(true);
    const reset = withBrushSprayAngleBasedOnCenterV1(changed, false);
    expect(brushSprayAngleBasedOnCenterV1(reset)).toBe(false);
    expect(reset.spray.angleBasedOnCenter).toBeUndefined();
  });

  it('keeps disabled orientation identical to the established spray baseline', () => {
    const implicit = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      tipShape: 'square',
      tipAngleDegrees: 25,
      sprayEnabled: true,
      sprayParticleDensity: 8,
      randomSeed: 0x12345678,
    });
    const explicit = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      tipShape: 'square',
      tipAngleDegrees: 25,
      sprayEnabled: true,
      sprayParticleDensity: 8,
      sprayAngleBasedOnCenter: false,
      randomSeed: 0x12345678,
    });
    expect(explicit.beginDelta({ documentX: 40, documentY: 50 })).toEqual(
      implicit.beginDelta({ documentX: 40, documentY: 50 }),
    );
  });

  it('adds each particle radial angle to the already resolved parent tip angle', () => {
    const centerX = 20;
    const centerY = 30;
    const baseAngle = 25;
    const brush = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      tipShape: 'square',
      tipAngleDegrees: baseAngle,
      sprayEnabled: true,
      sprayParticleDensity: 8,
      sprayAngleBasedOnCenter: true,
      randomSeed: 0x2468ace0,
    });
    const dabs = brush.beginDelta({ documentX: centerX, documentY: centerY });
    expect(dabs).toHaveLength(8);
    for (const dab of dabs) {
      const radial = (Math.atan2(dab.y - centerY, dab.x - centerX) * 180) / Math.PI;
      expect(dab.tipAngleDegrees).toBeCloseTo(normalize(baseAngle + radial), 10);
    }
  });

  it('keeps particle centers, radius, color and count unchanged when center orientation is toggled', () => {
    const options = {
      sizePx: 20,
      tipShape: 'square' as const,
      tipAngleDegrees: 40,
      sprayEnabled: true,
      sprayParticleDensity: 9,
      spraySpreadRadiusRatio: 1.5,
      sprayDeviation: -0.25,
      randomSeed: 0x0badc0de,
    };
    const inherited = new BaselineBrushDabBuilderV1({ ...options, sprayAngleBasedOnCenter: false });
    const centered = new BaselineBrushDabBuilderV1({ ...options, sprayAngleBasedOnCenter: true });
    const inheritedDabs = inherited.beginDelta({ documentX: 0, documentY: 0 });
    const centeredDabs = centered.beginDelta({ documentX: 0, documentY: 0 });
    expect(centeredDabs.map((dab) => [dab.x, dab.y])).toEqual(
      inheritedDabs.map((dab) => [dab.x, dab.y]),
    );
    expect(centeredDabs.map((dab) => dab.radius)).toEqual(inheritedDabs.map((dab) => dab.radius));
    expect(centeredDabs.map((dab) => dab.color)).toEqual(inheritedDabs.map((dab) => dab.color));
    expect(centeredDabs.some((dab, index) => dab.tipAngleDegrees !== inheritedDabs[index]?.tipAngleDegrees)).toBe(true);
  });

  it('uses the inherited parent angle when the particle has no radial displacement', () => {
    const brush = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      tipShape: 'square',
      tipAngleDegrees: 73,
      sprayEnabled: true,
      sprayParticleDensity: 6,
      spraySpreadRadiusRatio: 0,
      sprayAngleBasedOnCenter: true,
      randomSeed: 0x89abcdef,
    });
    const dabs = brush.beginDelta({ documentX: 10, documentY: 15 });
    expect(dabs).toHaveLength(6);
    expect(dabs.every((dab) => dab.x === 10 && dab.y === 15)).toBe(true);
    expect(dabs.every((dab) => dab.tipAngleDegrees === 73)).toBe(true);
  });

  it('is inert when Scatter is off', () => {
    const baseline = new BaselineBrushDabBuilderV1({ sizePx: 20, tipShape: 'square', tipAngleDegrees: 15 });
    const configured = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      tipShape: 'square',
      tipAngleDegrees: 15,
      sprayEnabled: false,
      sprayAngleBasedOnCenter: true,
    });
    expect(configured.beginDelta({ documentX: 10, documentY: 10 })).toEqual(
      baseline.beginDelta({ documentX: 10, documentY: 10 }),
    );
  });

  it('reuses resolved particle angles during mutable end-tail reconciliation', () => {
    const brush = new BaselineBrushDabBuilderV1({
      sizePx: 10,
      spacingRatio: 1,
      endTaperLengthPx: 10,
      sizeTaperMinimumRatio: 1,
      opacityTaperMinimumRatio: 1,
      tipShape: 'square',
      tipAngleDegrees: 20,
      sprayEnabled: true,
      sprayParticleDensity: 7,
      sprayAngleBasedOnCenter: true,
      randomSeed: 0xfeed1234,
    });
    brush.begin({ documentX: 0, documentY: 0 });
    brush.append([
      { documentX: 10, documentY: 0 },
      { documentX: 20, documentY: 0 },
    ]);
    const before = brush.dabs().map((dab) => dab.tipAngleDegrees);
    brush.finish();
    expect(brush.dabs().map((dab) => dab.tipAngleDegrees)).toEqual(before);
  });

  it('captures orientation in runtime state without adding a spray-orientation primitive field', () => {
    const session = new PaintSessionControllerV1(new FakeRendererDocumentPort());
    expect(session.setBrushSprayAngleBasedOnCenter(true)).toBe(true);
    expect(session.snapshot().brushSprayAngleBasedOnCenter).toBe(true);
    const [dab] = new BaselineBrushDabBuilderV1({
      sprayEnabled: true,
      sprayAngleBasedOnCenter: true,
      randomSeed: 7,
    }).beginDelta({ documentX: 0, documentY: 0 });
    expect(dab).toBeDefined();
    expect('sprayAngleBasedOnCenter' in (dab ?? {})).toBe(false);
  });
});
""",
)

append_once(
    'scripts/verify-m6a-brush.mjs',
    'M6A-061 progress is not complete',
    """
requireText(progress, 'M6A-061 particle orientation:完了', 'M6A-061 progress is not complete');
requireText(
  read('src/domain/brush-schema.ts'),
  'brushSprayAngleBasedOnCenterV1',
  'spray center-based orientation preset helper missing',
);
requireText(
  read('src/gpu/baseline-brush.ts'),
  'particle.tipAngleDegrees',
  'spray particle-specific orientation is not connected to canonical emission',
);
requireText(
  read('src/app/paint-session-controller.ts'),
  'setBrushSprayAngleBasedOnCenter',
  'spray particle orientation is not captured by the paint session',
);
requireText(
  read('src/index.html'),
  'id="brush-spray-angle-based-on-center"',
  'reachable spray orientation control missing',
);
requireText(
  read('tests/unit/brush-particle-orientation.test.ts'),
  'adds each particle radial angle to the already resolved parent tip angle',
  'spray particle-orientation regression coverage missing',
);
""",
)
replace_once(
    'IMPLEMENTATION_PROGRESS.md',
    'M6A-061 particle orientation:未完了\nM6A-062 ordinary raster color mixing:未完了\n',
    """M6A-061 particle orientation:完了
再開メモ: M6A-061 particle orientationはspray.angleBasedOnCenter boolean（既定false）で実装する。falseはM6A-057〜060と完全互換で全particleが親logical stampの解決済みtipAngleDegreesを継承する。trueではposition jitter / spread / deviation適用後のlogical center→particle center径方向角を親の解決済みtip angleへ加算してnormalizeし、static angle/direction・follow rotation・pen orientation・rotation jitterを相対offsetとして保つ。spread=0やdeviation=+1等で径方向長が0の場合は親角度へfallbackする。particle count/center/radius/color/opacity/densityは変えず、可視logical recordのsprayParticlesへ解決済みparticle tipAngleDegreesを保持するためend-tail reconciliationで角度を再計算・再抽選しない。sampled-image tipもparticle単位で同じ解決角度をmicro-dab expansionへ渡す。Scatter OFFではinert。preset/runtime/facade/UIを接続しprimitive/Worker/Historyには新しい設定fieldを追加せず既存tipAngleDegreesのみ保存する。次はM6A-062 ordinary raster color mixingから再開する。
M6A-062 ordinary raster color mixing:未完了
""",
)
append_once(
    'ILLUSTRO_DESIGN_MEMO.md',
    '## M6A spray particle-orientation boundary — 2026-09-03',
    """
## M6A spray particle-orientation boundary — 2026-09-03

**AUTHORITATIVE for M6A-061.** `BrushPresetV1.spray.angleBasedOnCenter` is a boolean with exact/default `false`. Disabled Spray orientation preserves the M6A-057 through M6A-060 behavior: every particle inherits the parent logical stamp's already-resolved `tipAngleDegrees`.

When enabled, each particle uses the direction from the final Spray center to its final particle center as an additional orientation basis. The radial direction is added to the parent's resolved angle and normalized through the existing canonical angle domain. Consequently static tip angle/intrinsic direction, follow-stroke rotation or pen orientation, and M6A-053 rotation jitter remain composable relative offsets rather than being silently discarded. A 90-degree static offset naturally produces a tangential appearance without introducing a second tangential mode. If the particle has no radial displacement, the radial basis is undefined and the parent angle is retained.

The orientation calculation occurs after position jitter and M6A-060 spread/deviation have resolved particle centers but does not move those centers or alter particle count, size, color, opacity, flow or tip-mask density. The resolved per-particle angle is retained alongside the internal logical-stamp particle center so bounded mutable-tail reconciliation does not recompute orientation. Sampled-image micro-dabs use the same resolved angle for every micro-dab belonging to that particle. Primitive dabs, Worker payloads, history and recovery continue to use the existing resolved `tipAngleDegrees` field; no Spray-orientation-specific primitive field is introduced.
""",
)
