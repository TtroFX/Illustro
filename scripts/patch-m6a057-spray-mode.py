from pathlib import Path


def read(path: str) -> str:
    return Path(path).read_text(encoding='utf-8')


def write(path: str, text: str) -> None:
    Path(path).write_text(text, encoding='utf-8')


def replace_once(path: str, old: str, new: str) -> None:
    text = read(path)
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{path}: expected exactly one anchor, found {count}: {old[:160]!r}')
    write(path, text.replace(old, new, 1))


def append_once(path: str, marker: str, block: str) -> None:
    text = read(path)
    if marker in text:
        return
    if not text.endswith('\n'):
        text += '\n'
    write(path, text + '\n' + block.strip() + '\n')


# Canonical preset toggle. M6A-058..061 parameterize the fixed baseline particle properties.
replace_once(
    'src/domain/brush-schema.ts',
    "export type BrushTipSelectionModeV1 = 'fixed' | 'sequence' | 'random-per-stamp';",
    """export const DEFAULT_BRUSH_SPRAY_ENABLED_V1 = false as const;

export function brushSprayEnabledV1(preset: BrushPresetV1): boolean {
  const value = preset.spray.enabled;
  return typeof value === 'boolean' ? value : DEFAULT_BRUSH_SPRAY_ENABLED_V1;
}

export function withBrushSprayEnabledV1(preset: BrushPresetV1, enabled: boolean): BrushPresetV1 {
  if (typeof enabled !== 'boolean') throw new TypeError('brush spray enabled flag must be boolean');
  if (enabled === DEFAULT_BRUSH_SPRAY_ENABLED_V1) {
    const { enabled: _enabled, ...spray } = preset.spray;
    return normalizeBrushPresetV1({ ...preset, spray });
  }
  return normalizeBrushPresetV1({ ...preset, spray: { ...preset.spray, enabled } });
}

export type BrushTipSelectionModeV1 = 'fixed' | 'sequence' | 'random-per-stamp';""",
)

# Deterministic particle burst kernel. Fixed values are only M6A-057 bootstrap defaults.
replace_once(
    'src/gpu/baseline-brush.ts',
    'export const BASELINE_BRUSH_VALUE_JITTER = 0 as const;\n',
    """export const BASELINE_BRUSH_VALUE_JITTER = 0 as const;
export const BASELINE_BRUSH_SPRAY_ENABLED = false as const;
export const BASELINE_BRUSH_SPRAY_PARTICLE_COUNT_V1 = 4 as const;
export const BASELINE_BRUSH_SPRAY_PARTICLE_SCALE_V1 = 0.35 as const;
export const BASELINE_BRUSH_SPRAY_SPREAD_RADIUS_RATIO_V1 = 1 as const;
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    'const BASELINE_BRUSH_VALUE_JITTER_SALT_V1 = 0xb55a4f09 as const;\n',
    """const BASELINE_BRUSH_VALUE_JITTER_SALT_V1 = 0xb55a4f09 as const;
const BASELINE_BRUSH_SPRAY_ANGLE_SALT_V1 = 0x94d049bb as const;
const BASELINE_BRUSH_SPRAY_RADIUS_SALT_V1 = 0xed5ad4bb as const;
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    'export function deterministicBaselineBrushRandomV1(seed: number, stampIndex: number): number {',
    """function deterministicBaselineBrushSprayComponentV1(
  seed: number,
  stampIndex: number,
  particleIndex: number,
  salt: number,
): number {
  let value =
    (seed ^
      salt ^
      Math.imul((stampIndex + 1) >>> 0, 0x9e3779b1) ^
      Math.imul((particleIndex + 1) >>> 0, 0x85ebca6b)) >>>
    0;
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d) >>> 0;
  value ^= value >>> 15;
  value = Math.imul(value, 0x846ca68b) >>> 0;
  value ^= value >>> 16;
  return (value >>> 0) / 0x100000000;
}

export function deterministicBaselineBrushSprayParticleV1(
  seed: number,
  stampIndex: number,
  particleIndex: number,
): Readonly<{ x: number; y: number }> {
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) {
    throw new RangeError('baseline brush spray seed must be uint32');
  }
  if (!Number.isSafeInteger(stampIndex) || stampIndex < 0) {
    throw new RangeError('baseline brush spray stamp index must be a non-negative safe integer');
  }
  if (!Number.isSafeInteger(particleIndex) || particleIndex < 0) {
    throw new RangeError('baseline brush spray particle index must be a non-negative safe integer');
  }
  const angle =
    deterministicBaselineBrushSprayComponentV1(
      seed,
      stampIndex,
      particleIndex,
      BASELINE_BRUSH_SPRAY_ANGLE_SALT_V1,
    ) *
    Math.PI *
    2;
  const radius = Math.sqrt(
    deterministicBaselineBrushSprayComponentV1(
      seed,
      stampIndex,
      particleIndex,
      BASELINE_BRUSH_SPRAY_RADIUS_SALT_V1,
    ),
  );
  return Object.freeze({ x: Math.cos(angle) * radius, y: Math.sin(angle) * radius });
}

export function deterministicBaselineBrushRandomV1(seed: number, stampIndex: number): number {""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    '  readonly sampledTipAlpha: BaselineBrushSampledTipAlphaV1;\n  primitiveStart: number;\n',
    """  readonly sampledTipAlpha: BaselineBrushSampledTipAlphaV1;
  readonly sprayParticles: readonly Readonly<{ x: number; y: number }>[] | null;
  primitiveStart: number;
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    '  readonly #valueJitter: number;\n  readonly #randomSeed: number;\n',
    '  readonly #valueJitter: number;\n  readonly #sprayEnabled: boolean;\n  readonly #randomSeed: number;\n',
)
replace_once(
    'src/gpu/baseline-brush.ts',
    '  #colorJitterStampIndex = 0;\n  #pathDistancePx = 0;\n',
    '  #colorJitterStampIndex = 0;\n  #sprayStampIndex = 0;\n  #pathDistancePx = 0;\n',
)
replace_once(
    'src/gpu/baseline-brush.ts',
    '      readonly valueJitter?: number;\n      readonly randomSeed?: number;\n',
    '      readonly valueJitter?: number;\n      readonly sprayEnabled?: boolean;\n      readonly randomSeed?: number;\n',
)
replace_once(
    'src/gpu/baseline-brush.ts',
    '    const valueJitter = options.valueJitter ?? BASELINE_BRUSH_VALUE_JITTER;\n    const randomSeed = options.randomSeed ?? 0;\n',
    """    const valueJitter = options.valueJitter ?? BASELINE_BRUSH_VALUE_JITTER;
    const sprayEnabled = options.sprayEnabled ?? BASELINE_BRUSH_SPRAY_ENABLED;
    const randomSeed = options.randomSeed ?? 0;
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """    if (!Number.isSafeInteger(randomSeed) || randomSeed < 0 || randomSeed > 0xffffffff) {
      throw new RangeError('baseline brush random seed must be uint32');
    }
""",
    """    if (typeof sprayEnabled !== 'boolean') {
      throw new TypeError('baseline brush spray enabled flag must be boolean');
    }
    if (!Number.isSafeInteger(randomSeed) || randomSeed < 0 || randomSeed > 0xffffffff) {
      throw new RangeError('baseline brush random seed must be uint32');
    }
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    '    this.#valueJitter = valueJitter;\n    this.#randomSeed = randomSeed >>> 0;\n',
    '    this.#valueJitter = valueJitter;\n    this.#sprayEnabled = sprayEnabled;\n    this.#randomSeed = randomSeed >>> 0;\n',
)
replace_once(
    'src/gpu/baseline-brush.ts',
    "      | 'sampledTipAlpha'\n    >,\n",
    "      | 'sampledTipAlpha'\n      | 'sprayParticles'\n    >,\n",
)
old_emit = """    pushBaselineBrushStampV1(
      target,
      stamp.x,
      stamp.y,
      this.#radius * sizeScale * sizeResponse * stamp.sizeJitterScale,
      this.#flow * opacityScale * flowResponse,
      this.#strokeOpacity * opacityResponse * stamp.opacityJitterScale,
      this.#hardness,
      this.#tipDensity * stamp.densityJitterScale,
      stamp.tipAngleDegrees,
      stamp.color,
      this.#tipShape,
      stamp.sampledTipAlpha,
    );
"""
new_emit = """    const resolvedRadius = this.#radius * sizeScale * sizeResponse * stamp.sizeJitterScale;
    const resolvedFlow = this.#flow * opacityScale * flowResponse;
    const resolvedStrokeOpacity = this.#strokeOpacity * opacityResponse * stamp.opacityJitterScale;
    const resolvedDensity = this.#tipDensity * stamp.densityJitterScale;
    const emitParticle = (particleX: number, particleY: number, radiusScale: number): void =>
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
      emitParticle(particle.x, particle.y, BASELINE_BRUSH_SPRAY_PARTICLE_SCALE_V1);
    }
"""
replace_once('src/gpu/baseline-brush.ts', old_emit, new_emit)
replace_once(
    'src/gpu/baseline-brush.ts',
    """    const sampledTipAlpha = this.#sampledTipAlphaForLogicalStamp();
    const record: BaselineLogicalStampRecordV1 = {
""",
    """    const sprayParticles = this.#sprayEnabled
      ? Object.freeze(
          Array.from({ length: BASELINE_BRUSH_SPRAY_PARTICLE_COUNT_V1 }, (_, particleIndex) => {
            const unit = deterministicBaselineBrushSprayParticleV1(
              this.#randomSeed,
              this.#sprayStampIndex,
              particleIndex,
            );
            const spreadRadiusPx = this.#radius * BASELINE_BRUSH_SPRAY_SPREAD_RADIUS_RATIO_V1;
            return Object.freeze({
              x: jitteredX + unit.x * spreadRadiusPx,
              y: jitteredY + unit.y * spreadRadiusPx,
            });
          }),
        )
      : null;
    if (this.#sprayEnabled) this.#sprayStampIndex += 1;
    const sampledTipAlpha = this.#sampledTipAlphaForLogicalStamp();
    const record: BaselineLogicalStampRecordV1 = {
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    '      sampledTipAlpha,\n      primitiveStart: this.#dabs.length,\n',
    '      sampledTipAlpha,\n      sprayParticles,\n      primitiveStart: this.#dabs.length,\n',
)

# Canonical facade
replace_once(
    'src/app/canonical-raster-brush.ts',
    '      readonly valueJitter?: number;\n      readonly randomSeed?: number;\n',
    '      readonly valueJitter?: number;\n      readonly sprayEnabled?: boolean;\n      readonly randomSeed?: number;\n',
)
replace_once(
    'src/app/canonical-raster-brush.ts',
    '      ...(options.valueJitter === undefined ? {} : { valueJitter: options.valueJitter }),\n      ...(options.randomSeed === undefined ? {} : { randomSeed: options.randomSeed }),\n',
    """      ...(options.valueJitter === undefined ? {} : { valueJitter: options.valueJitter }),
      ...(options.sprayEnabled === undefined ? {} : { sprayEnabled: options.sprayEnabled }),
      ...(options.randomSeed === undefined ? {} : { randomSeed: options.randomSeed }),
""",
)

# Runtime session
replace_once(
    'src/app/paint-session-controller.ts',
    '  BASELINE_BRUSH_VALUE_JITTER,\n  DEFAULT_BASELINE_BRUSH_COLOR_V1,\n',
    '  BASELINE_BRUSH_VALUE_JITTER,\n  BASELINE_BRUSH_SPRAY_ENABLED,\n  DEFAULT_BASELINE_BRUSH_COLOR_V1,\n',
)
replace_once(
    'src/app/paint-session-controller.ts',
    '  readonly brushValueJitter: number;\n  readonly brushTipAngleDegrees: number;\n',
    '  readonly brushValueJitter: number;\n  readonly brushSprayEnabled: boolean;\n  readonly brushTipAngleDegrees: number;\n',
)
replace_once(
    'src/app/paint-session-controller.ts',
    '  #brushValueJitter: number = BASELINE_BRUSH_VALUE_JITTER;\n  #brushTipAngleDegrees: number = BASELINE_BRUSH_TIP_ANGLE_DEGREES;\n',
    '  #brushValueJitter: number = BASELINE_BRUSH_VALUE_JITTER;\n  #brushSprayEnabled = BASELINE_BRUSH_SPRAY_ENABLED;\n  #brushTipAngleDegrees: number = BASELINE_BRUSH_TIP_ANGLE_DEGREES;\n',
)
replace_once(
    'src/app/paint-session-controller.ts',
    '      brushValueJitter: this.#brushValueJitter,\n      brushTipAngleDegrees: this.#brushTipAngleDegrees,\n',
    '      brushValueJitter: this.#brushValueJitter,\n      brushSprayEnabled: this.#brushSprayEnabled,\n      brushTipAngleDegrees: this.#brushTipAngleDegrees,\n',
)
replace_once(
    'src/app/paint-session-controller.ts',
    """  brushColorJitter(): Readonly<{ hue: number; saturation: number; value: number }> {
    return Object.freeze({
      hue: this.#brushHueJitter,
      saturation: this.#brushSaturationJitter,
      value: this.#brushValueJitter,
    });
  }

  setBrushTipAngleDegrees(angleDegrees: number): number {
""",
    """  brushColorJitter(): Readonly<{ hue: number; saturation: number; value: number }> {
    return Object.freeze({
      hue: this.#brushHueJitter,
      saturation: this.#brushSaturationJitter,
      value: this.#brushValueJitter,
    });
  }

  setBrushSprayEnabled(enabled: boolean): boolean {
    if (typeof enabled !== 'boolean') throw new TypeError('invalid runtime brush spray flag');
    if (enabled !== this.#brushSprayEnabled) this.#clearActiveStroke();
    this.#brushSprayEnabled = enabled;
    return this.#brushSprayEnabled;
  }

  brushSprayEnabled(): boolean {
    return this.#brushSprayEnabled;
  }

  setBrushTipAngleDegrees(angleDegrees: number): number {
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """    const colorJitterEnabled =
      this.#brushHueJitter > 0 || this.#brushSaturationJitter > 0 || this.#brushValueJitter > 0;
    const randomSeed =
""",
    """    const colorJitterEnabled =
      this.#brushHueJitter > 0 || this.#brushSaturationJitter > 0 || this.#brushValueJitter > 0;
    const sprayEnabled = this.#brushSprayEnabled;
    const randomSeed =
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    '      densityJitterEnabled ||\n      colorJitterEnabled\n        ? deterministicPaintStrokeSeedV1(strokeId)\n',
    '      densityJitterEnabled ||\n      colorJitterEnabled ||\n      sprayEnabled\n        ? deterministicPaintStrokeSeedV1(strokeId)\n',
)
replace_once(
    'src/app/paint-session-controller.ts',
    '        valueJitter: this.#brushValueJitter,\n        randomSeed: randomSeed ?? 0,\n',
    '        valueJitter: this.#brushValueJitter,\n        sprayEnabled: this.#brushSprayEnabled,\n        randomSeed: randomSeed ?? 0,\n',
)

# Preset library mutation
replace_once(
    'src/app/brush-preset-library.ts',
    '  withBrushValueJitterV1,\n  withBrushStrokeSpacingV1,\n',
    '  withBrushValueJitterV1,\n  withBrushSprayEnabledV1,\n  withBrushStrokeSpacingV1,\n',
)
replace_once(
    'src/app/brush-preset-library.ts',
    'export function updateBrushPresetCustomTipV1(\n',
    """export function updateBrushPresetSprayEnabledV1(
  state: BrushPresetLibraryStateV1,
  presetId: string,
  enabled: boolean,
): BrushPresetLibraryStateV1 {
  return updateItemV1(state, presetId, (item) => {
    if (item.locked) throw new Error('locked brush preset cannot be edited');
    const current = withBrushSprayEnabledV1(item.preset, enabled);
    if (JSON.stringify(current) === JSON.stringify(item.preset)) return item;
    const next = normalizeBrushPresetV1({ ...current, revision: item.preset.revision + 1 });
    return itemV1({ source: item.source, baseline: item.baseline, preset: next, locked: item.locked });
  });
}

export function updateBrushPresetCustomTipV1(
""",
)

# Tool Properties toggle
replace_once(
    'src/app/brush-preset-controller.ts',
    '  brushValueJitterV1,\n  BUILTIN_BRUSH_GRAIN_RESOURCES_V1,\n',
    '  brushValueJitterV1,\n  brushSprayEnabledV1,\n  BUILTIN_BRUSH_GRAIN_RESOURCES_V1,\n',
)
replace_once(
    'src/app/brush-preset-controller.ts',
    '  updateBrushPresetValueJitterV1,\n  updateBrushPresetSpacingV1,\n',
    '  updateBrushPresetValueJitterV1,\n  updateBrushPresetSprayEnabledV1,\n  updateBrushPresetSpacingV1,\n',
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  const valueJitterRange = requireElement('#brush-value-jitter-range', HTMLInputElement);
  const valueJitterNumber = requireElement('#brush-value-jitter-number', HTMLInputElement);
  const tipShape = requireElement('#brush-tip-shape', HTMLSelectElement);
""",
    """  const valueJitterRange = requireElement('#brush-value-jitter-range', HTMLInputElement);
  const valueJitterNumber = requireElement('#brush-value-jitter-number', HTMLInputElement);
  const sprayEnabledButton = requireElement('#brush-spray-enabled', HTMLButtonElement);
  const tipShape = requireElement('#brush-tip-shape', HTMLSelectElement);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    input.paintSession.setBrushColorJitter(hueJitter, saturationJitter, valueJitter);
    const tipAssets = brushTipAssetsV1(item.preset);
""",
    """    input.paintSession.setBrushColorJitter(hueJitter, saturationJitter, valueJitter);
    const sprayEnabled = brushSprayEnabledV1(item.preset);
    input.paintSession.setBrushSprayEnabled(sprayEnabled);
    const tipAssets = brushTipAssetsV1(item.preset);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    '    input.root.dataset.illustroBrushValueJitter = String(valueJitter);\n    input.root.dataset.illustroBrushTipShape = brushTipShapeV1(item.preset);\n',
    '    input.root.dataset.illustroBrushValueJitter = String(valueJitter);\n    input.root.dataset.illustroBrushSprayEnabled = String(sprayEnabled);\n    input.root.dataset.illustroBrushTipShape = brushTipShapeV1(item.preset);\n',
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    configurePair(valueJitterRange, valueJitterNumber, 0, 100, 1, valueJitter * 100);
    tipShape.value = brushTipShapeV1(selected.preset);
""",
    """    configurePair(valueJitterRange, valueJitterNumber, 0, 100, 1, valueJitter * 100);
    const sprayEnabled = brushSprayEnabledV1(selected.preset);
    sprayEnabledButton.textContent = sprayEnabled ? 'ON' : 'OFF';
    sprayEnabledButton.setAttribute('aria-pressed', String(sprayEnabled));
    tipShape.value = brushTipShapeV1(selected.preset);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    const colorJitterLabel = `${hueJitter > 0 ? ` · HueJitter${Math.round(hueJitter * 100)}%` : ''}${saturationJitter > 0 ? ` · SatJitter${Math.round(saturationJitter * 100)}%` : ''}${valueJitter > 0 ? ` · ValueJitter${Math.round(valueJitter * 100)}%` : ''}`;
    propertyStatus.textContent = `${parameters.sizePx.toFixed(1)} px · ${Math.round(parameters.opacity * 100)}% · ${Math.round(parameters.flow * 100)}% · H${Math.round(hardness * 100)}% · D${Math.round(tipDensity * 100)}% · S${Math.round(spacing.spacingRatio * 100)}% · A${Math.round(tipAngleDegrees)}° · F${Math.round(tipDirectionDegrees)}°${followRotation ? ' · Follow' : ''}${penOrientationEnabled ? ' · PenDir' : ''}${repeatLabel}${startLabel}${endLabel}${sizeTaperLabel}${opacityTaperLabel}${forcedTaperLabel}${stabilizationLabel}${postCorrectionLabel}${grainLabel}${paperLabel}${textureStrengthLabel}${textureScaleLabel}${textureRotationLabel}${textureBlendLabel}${pressureSizeLabel}${pressureOpacityLabel}${pressureFlowLabel}${pressureCurveLabel}${tiltSizeLabel}${tiltOpacityLabel}${tiltFlowLabel}${tiltCurveLabel}${velocitySizeLabel}${velocityOpacityLabel}${velocityFlowLabel}${velocityCurveLabel}${velocityMaximumLabel}${randomSizeLabel}${randomOpacityLabel}${randomFlowLabel}${randomCurveLabel}${minimumResponseLabel}${maximumResponseLabel}${sizeJitterLabel}${opacityJitterLabel}${rotationJitterLabel}${positionJitterLabel}${densityJitterLabel}${colorJitterLabel}`;
""",
    """    const colorJitterLabel = `${hueJitter > 0 ? ` · HueJitter${Math.round(hueJitter * 100)}%` : ''}${saturationJitter > 0 ? ` · SatJitter${Math.round(saturationJitter * 100)}%` : ''}${valueJitter > 0 ? ` · ValueJitter${Math.round(valueJitter * 100)}%` : ''}`;
    const sprayLabel = sprayEnabled ? ' · Spray' : '';
    propertyStatus.textContent = `${parameters.sizePx.toFixed(1)} px · ${Math.round(parameters.opacity * 100)}% · ${Math.round(parameters.flow * 100)}% · H${Math.round(hardness * 100)}% · D${Math.round(tipDensity * 100)}% · S${Math.round(spacing.spacingRatio * 100)}% · A${Math.round(tipAngleDegrees)}° · F${Math.round(tipDirectionDegrees)}°${followRotation ? ' · Follow' : ''}${penOrientationEnabled ? ' · PenDir' : ''}${repeatLabel}${startLabel}${endLabel}${sizeTaperLabel}${opacityTaperLabel}${forcedTaperLabel}${stabilizationLabel}${postCorrectionLabel}${grainLabel}${paperLabel}${textureStrengthLabel}${textureScaleLabel}${textureRotationLabel}${textureBlendLabel}${pressureSizeLabel}${pressureOpacityLabel}${pressureFlowLabel}${pressureCurveLabel}${tiltSizeLabel}${tiltOpacityLabel}${tiltFlowLabel}${tiltCurveLabel}${velocitySizeLabel}${velocityOpacityLabel}${velocityFlowLabel}${velocityCurveLabel}${velocityMaximumLabel}${randomSizeLabel}${randomOpacityLabel}${randomFlowLabel}${randomCurveLabel}${minimumResponseLabel}${maximumResponseLabel}${sizeJitterLabel}${opacityJitterLabel}${rotationJitterLabel}${positionJitterLabel}${densityJitterLabel}${colorJitterLabel}${sprayLabel}`;
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    '      valueJitterRange,\n      valueJitterNumber,\n      tipShape,\n',
    '      valueJitterRange,\n      valueJitterNumber,\n      sprayEnabledButton,\n      tipShape,\n',
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  const onValueJitterRange = (): void => updateValueJitter(Number(valueJitterRange.value));
  const onValueJitterNumber = (): void => updateValueJitter(Number(valueJitterNumber.value));
  const onTipShape = (): void => {
""",
    """  const onValueJitterRange = (): void => updateValueJitter(Number(valueJitterRange.value));
  const onValueJitterNumber = (): void => updateValueJitter(Number(valueJitterNumber.value));
  const onSprayEnabled = (): void =>
    mutate(() =>
      updateBrushPresetSprayEnabledV1(
        state,
        state.selectedPresetId,
        !brushSprayEnabledV1(selectedBrushPresetItemV1(state).preset),
      ),
    );
  const onTipShape = (): void => {
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  valueJitterRange.addEventListener('input', onValueJitterRange);
  valueJitterNumber.addEventListener('change', onValueJitterNumber);
  tipShape.addEventListener('change', onTipShape);
""",
    """  valueJitterRange.addEventListener('input', onValueJitterRange);
  valueJitterNumber.addEventListener('change', onValueJitterNumber);
  sprayEnabledButton.addEventListener('click', onSprayEnabled);
  tipShape.addEventListener('change', onTipShape);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """      valueJitterRange.removeEventListener('input', onValueJitterRange);
      valueJitterNumber.removeEventListener('change', onValueJitterNumber);
      pressureCurveEditor?.dispose();
""",
    """      valueJitterRange.removeEventListener('input', onValueJitterRange);
      valueJitterNumber.removeEventListener('change', onValueJitterNumber);
      sprayEnabledButton.removeEventListener('click', onSprayEnabled);
      pressureCurveEditor?.dispose();
""",
)

# Reachable app-owned spray toggle.
replace_once(
    'src/index.html',
    """              <div class="shell-brush-property-row">
                <label for="brush-value-jitter-range">明度ジッター</label>
                <input id="brush-value-jitter-range" type="range" min="0" max="100" step="1" value="0" />
                <span class="shell-brush-property-number shell-brush-property-percent"><input id="brush-value-jitter-number" type="number" inputmode="decimal" min="0" max="100" step="1" value="0" aria-label="ブラシ明度ジッター" /><span>%</span></span>
              </div>
""",
    """              <div class="shell-brush-property-row">
                <label for="brush-value-jitter-range">明度ジッター</label>
                <input id="brush-value-jitter-range" type="range" min="0" max="100" step="1" value="0" />
                <span class="shell-brush-property-number shell-brush-property-percent"><input id="brush-value-jitter-number" type="number" inputmode="decimal" min="0" max="100" step="1" value="0" aria-label="ブラシ明度ジッター" /><span>%</span></span>
              </div>
              <div class="shell-brush-property-row shell-brush-tip-property-row">
                <label for="brush-spray-enabled">散布</label>
                <button id="brush-spray-enabled" type="button" aria-pressed="false" title="ブラシパターンを複数粒子として決定論的に散布">OFF</button>
                <span class="shell-brush-tip-kind">Spray</span>
              </div>
""",
)

# Regression tests for the mode boundary and deterministic particle burst.
test_path = Path('tests/unit/brush-spray-mode.test.ts')
if test_path.exists():
    raise RuntimeError('tests/unit/brush-spray-mode.test.ts already exists')
test_path.write_text("""import { describe, expect, it } from 'vitest';
import {
  brushSprayEnabledV1,
  createBaselineBrushPresetV1,
  withBrushSprayEnabledV1,
} from '../../src/domain/brush-schema.js';
import { PaintSessionControllerV1 } from '../../src/app/paint-session-controller.js';
import {
  BASELINE_BRUSH_SPRAY_PARTICLE_COUNT_V1,
  BASELINE_BRUSH_SPRAY_PARTICLE_SCALE_V1,
  BaselineBrushDabBuilderV1,
  deterministicBaselineBrushSprayParticleV1,
} from '../../src/gpu/baseline-brush.js';

class FakeRendererDocumentPort {
  async configureDocument(): Promise<void> {}
  async restoreBaselineStrokes(): Promise<void> {}
  async applyBaselineTilePatches(): Promise<void> {}
  async restoreBaselineCanonicalTiles(): Promise<void> {}
  async exportBaselineCanonicalTiles(): Promise<readonly never[]> { return []; }
  async exportBaselineCompositeTiles(): Promise<readonly never[]> { return []; }
}

const centers = (dabs: readonly { x: number; y: number }[]) => dabs.map((dab) => [dab.x, dab.y]);

describe('M6A-057 spray/particle mode', () => {
  it('stores a boolean spray toggle with an exact false default', () => {
    const preset = createBaselineBrushPresetV1({
      id: 'test.spray',
      name: 'Spray',
      category: 'Test',
      behavior: 'paint',
    });
    expect(brushSprayEnabledV1(preset)).toBe(false);
    const enabled = withBrushSprayEnabledV1(preset, true);
    expect(brushSprayEnabledV1(enabled)).toBe(true);
    expect(enabled.spray.enabled).toBe(true);
    const reset = withBrushSprayEnabledV1(enabled, false);
    expect(brushSprayEnabledV1(reset)).toBe(false);
    expect(reset.spray.enabled).toBeUndefined();
  });

  it('keeps disabled spray as an exact ordinary-stamp identity', () => {
    const baseline = new BaselineBrushDabBuilderV1({ sizePx: 20, spacingRatio: 1, randomSeed: 7 });
    const explicitOff = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      spacingRatio: 1,
      sprayEnabled: false,
      randomSeed: 7,
    });
    for (const brush of [baseline, explicitOff]) {
      brush.begin({ documentX: 0, documentY: 0 });
      brush.append([{ documentX: 20, documentY: 0 }]);
      brush.finish();
    }
    expect(explicitOff.dabs()).toEqual(baseline.dabs());
  });

  it('turns one logical stamp into a deterministic bounded multi-particle burst', () => {
    const seed = 0x12345678;
    const brush = new BaselineBrushDabBuilderV1({ sizePx: 20, sprayEnabled: true, randomSeed: seed });
    const burst = brush.beginDelta({ documentX: 40, documentY: 30 });
    expect(burst).toHaveLength(BASELINE_BRUSH_SPRAY_PARTICLE_COUNT_V1);
    expect(burst.every((dab) => Math.abs(dab.radius - 10 * BASELINE_BRUSH_SPRAY_PARTICLE_SCALE_V1) < 1e-10)).toBe(true);
    burst.forEach((dab, particleIndex) => {
      const unit = deterministicBaselineBrushSprayParticleV1(seed, 0, particleIndex);
      expect(dab.x).toBeCloseTo(40 + unit.x * 10, 10);
      expect(dab.y).toBeCloseTo(30 + unit.y * 10, 10);
      expect(Math.hypot(dab.x - 40, dab.y - 30)).toBeLessThanOrEqual(10 + 1e-10);
      expect('sprayEnabled' in dab).toBe(false);
    });
  });

  it('keeps spray randomness independent from the existing random and jitter channels', () => {
    const seed = 0x0badc0de;
    const plain = new BaselineBrushDabBuilderV1({ sizePx: 20, spacingRatio: 1, sprayEnabled: true, randomSeed: seed });
    const combined = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      spacingRatio: 1,
      sprayEnabled: true,
      sizeJitter: 0.4,
      opacityJitter: 0.4,
      rotationJitter: 0.4,
      densityJitter: 0.4,
      hueJitter: 0.4,
      saturationJitter: 0.4,
      valueJitter: 0.4,
      randomFlowEnabled: true,
      randomSeed: seed,
    });
    for (const brush of [plain, combined]) {
      brush.begin({ documentX: 0, documentY: 0 });
      brush.append([{ documentX: 20, documentY: 0 }]);
      brush.finish();
    }
    expect(centers(combined.dabs())).toEqual(centers(plain.dabs()));
  });

  it('advances the spray attempt index when taper suppresses an ordinary logical stamp', () => {
    const seed = 0x89abcdef;
    const reference = new BaselineBrushDabBuilderV1({
      sizePx: 10,
      spacingRatio: 1,
      sprayEnabled: true,
      randomSeed: seed,
    });
    reference.begin({ documentX: 0, documentY: 0 });
    reference.append([{ documentX: 10, documentY: 0 }]);
    const expectedSecondBurst = centers(reference.dabs().slice(BASELINE_BRUSH_SPRAY_PARTICLE_COUNT_V1));
    const suppressed = new BaselineBrushDabBuilderV1({
      sizePx: 10,
      spacingRatio: 1,
      startTaperLengthPx: 10,
      sprayEnabled: true,
      randomSeed: seed,
    });
    suppressed.begin({ documentX: 0, documentY: 0 });
    suppressed.append([{ documentX: 10, documentY: 0 }]);
    expect(centers(suppressed.dabs())).toEqual(expectedSecondBurst);
  });

  it('reuses resolved particle centers during mutable end-tail reconciliation', () => {
    const brush = new BaselineBrushDabBuilderV1({
      sizePx: 10,
      spacingRatio: 1,
      endTaperLengthPx: 10,
      sizeTaperMinimumRatio: 1,
      opacityTaperMinimumRatio: 1,
      sprayEnabled: true,
      randomSeed: 0xfeed1234,
    });
    brush.begin({ documentX: 0, documentY: 0 });
    brush.append([{ documentX: 10, documentY: 0 }, { documentX: 20, documentY: 0 }]);
    const beforeFinish = centers(brush.dabs());
    brush.finish();
    expect(centers(brush.dabs())).toEqual(beforeFinish);
  });

  it('captures the runtime mode without adding a spray-specific primitive field', () => {
    const session = new PaintSessionControllerV1(new FakeRendererDocumentPort());
    expect(session.setBrushSprayEnabled(true)).toBe(true);
    expect(session.snapshot().brushSprayEnabled).toBe(true);
    const [dab] = new BaselineBrushDabBuilderV1({ sprayEnabled: true, randomSeed: 17 }).beginDelta({
      documentX: 0,
      documentY: 0,
    });
    expect(dab).toBeDefined();
    expect('spray' in (dab ?? {})).toBe(false);
  });
});
""", encoding='utf-8')

# Verification gate.
replace_once(
    'scripts/verify-m6a-brush.mjs',
    """requireText(
  progress,
  'M6A-PERF-001 incremental active-stroke rendering（stable prefix + bounded mutable tail）:未完了',
""",
    """requireText(progress, 'M6A-057 spray/particle mode:完了', 'M6A-057 progress is not complete');
requireText(
  read('src/domain/brush-schema.ts'),
  'brushSprayEnabledV1',
  'spray preset toggle missing',
);
requireText(
  read('src/gpu/baseline-brush.ts'),
  'deterministicBaselineBrushSprayParticleV1',
  'deterministic spray particle generator missing',
);
requireText(
  read('src/gpu/baseline-brush.ts'),
  'sprayParticles',
  'spray particles are not retained on logical stamp records',
);
requireText(
  read('src/app/paint-session-controller.ts'),
  'setBrushSprayEnabled',
  'spray mode is not connected to runtime brush state',
);
requireText(
  read('src/app/paint-session-controller.ts'),
  'sprayEnabled',
  'spray mode does not participate in deterministic stroke seeding',
);
requireText(
  read('src/index.html'),
  'id="brush-spray-enabled"',
  'reachable spray toggle missing',
);
requireText(
  read('tests/unit/brush-spray-mode.test.ts'),
  'turns one logical stamp into a deterministic bounded multi-particle burst',
  'spray particle-burst regression missing',
);
requireText(
  read('tests/unit/brush-spray-mode.test.ts'),
  'advances the spray attempt index when taper suppresses an ordinary logical stamp',
  'spray attempt-index regression missing',
);
requireText(
  read('tests/unit/brush-spray-mode.test.ts'),
  'reuses resolved particle centers during mutable end-tail reconciliation',
  'spray tail-reconciliation regression missing',
);

requireText(
  progress,
  'M6A-PERF-001 incremental active-stroke rendering（stable prefix + bounded mutable tail）:未完了',
""",
)

# Progress and design documentation.
replace_once(
    'IMPLEMENTATION_PROGRESS.md',
    'M6A-057 spray/particle mode:未完了\nM6A-058 particle size:未完了\n',
    """M6A-057 spray/particle mode:完了
再開メモ: M6A-057 spray/particle modeはCanonical Brush Modelのspray.enabledをbooleanとして保持し、falseを完全identity/defaultとする。ONでは通常の1 logical stamp = 1 tip出力を、同じlogical stamp属性を共有する決定論的multi-particle burstへ切り替える。M6A-057ではモード境界を成立させるため暫定baselineとして4 particles / particle radius scale 0.35 / spread radius = base brush radius / orientationは親logical stamp角度継承を固定使用し、M6A-058 size、059 density/count-rate、060 spread/distribution、061 orientationで各値を順次canonical parameter化する。各particle中心はstroke randomSeed + spray専用angle/radius salt + logical attempt index + particle indexから等方unit-disk上に決定し、position jitter後のlogical centerをburst中心とするがspacing/path/tangentへfeedbackしない。spray attempt indexは非表示attemptでも進み、可視logical recordには解決済みparticle centersを保持するためend-tail reconciliationで再抽選しない。size/opacity/density/color/angle/tip assetは親logical stampで一度解決されburst内で共有し、sampled tipは各particleごとに既存micro-dab展開を使う。sprayがONなら他random機能がOFFでもstroke randomSeedを保存しpost-stroke correctionでも同一particle列を再構築する。primitive dab / Worker / Historyにはspray専用fieldを追加せず既存x/y/radius/color等だけを保存する。次はM6A-058 particle sizeから再開する。
M6A-058 particle size:未完了
""",
)
append_once(
    'ILLUSTRO_DESIGN_MEMO.md',
    '## M6A spray-mode boundary — 2026-09-03',
    """## M6A spray-mode boundary — 2026-09-03

**AUTHORITATIVE for M6A-057.** `BrushPresetV1.spray.enabled` is the ordinary-brush versus particle-burst mode switch and defaults to `false` with exact identity. This is distinct from M6A-054 position jitter: position jitter displaces one ordinary logical stamp, whereas spray mode changes one logical stamp into multiple independently positioned particle instances. The reference behavior follows the established painting-app separation where Scatter is a mode and particle size/density/deviation/orientation are controls available beneath that mode. M6A-058 through M6A-061 own those editable particle parameters.

To make the mode functional before its four parameter stages, M6A-057 uses explicit temporary engine defaults: four particles per logical stamp, particle radius scale `0.35`, maximum spread radius equal to the base brush radius, and inherited parent logical-stamp orientation. These are bootstrap defaults, not the final fixed artistic defaults; M6A-058 parameterizes size, M6A-059 particle count/rate, M6A-060 spread/distribution, and M6A-061 particle orientation.

Each spray logical-stamp attempt generates an isotropic unit-disk position for every particle from the persisted stroke seed plus spray-specific angle/radius salts and separate logical-attempt/particle indexes. The burst is centered on the already-resolved logical draw center (including ordinary position jitter if enabled), but particle positions never feed back into spacing, path distance, tangent, stabilization, velocity, or future logical-stamp placement. The spray attempt index advances even if the parent logical stamp is suppressed before primitive output.

A visible logical-stamp record retains the already-resolved particle centers. End-taper/mutable-tail reconciliation therefore reuses the same burst rather than resampling. Parent logical-stamp size/opacity/density/color/tip selection/orientation are resolved once and shared across that burst; sampled-image particles reuse the existing per-particle micro-dab expansion. When spray mode is enabled, a deterministic uint32 stroke seed is persisted even when all other random features are off. Primitive dabs, Worker payloads, history, recovery and rasterization remain resolved-data consumers and gain no spray-specific persistence field.
""",
)
