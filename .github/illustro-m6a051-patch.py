from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    if old not in text:
        raise RuntimeError(f"anchor not found in {path}: {old[:220]!r}")
    file.write_text(text.replace(old, new, 1))


# Canonical preset schema: jitter.size is a direct normalized random variation amount.
replace_once(
    'src/domain/brush-schema.ts',
    """export type BrushTipSelectionModeV1 = 'fixed' | 'sequence' | 'random-per-stamp';""",
    """export const DEFAULT_BRUSH_SIZE_JITTER_V1 = 0 as const;

export function brushSizeJitterV1(preset: BrushPresetV1): number {
  const value = preset.jitter.size;
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1
    ? value
    : DEFAULT_BRUSH_SIZE_JITTER_V1;
}

export function withBrushSizeJitterV1(preset: BrushPresetV1, amount: number): BrushPresetV1 {
  if (!Number.isFinite(amount) || amount < 0 || amount > 1) {
    throw new RangeError('brush size jitter must be within 0..1');
  }
  if (amount === DEFAULT_BRUSH_SIZE_JITTER_V1) {
    const { size: _size, ...jitter } = preset.jitter;
    return normalizeBrushPresetV1({ ...preset, jitter });
  }
  return normalizeBrushPresetV1({
    ...preset,
    jitter: { ...preset.jitter, size: amount },
  });
}

export type BrushTipSelectionModeV1 = 'fixed' | 'sequence' | 'random-per-stamp';""",
)

# Low-level deterministic kernel: independent size-jitter random channel and stored logical scale.
replace_once(
    'src/gpu/baseline-brush.ts',
    """export const BASELINE_BRUSH_TIP_DIRECTION_DEGREES = 0 as const;""",
    """export const BASELINE_BRUSH_TIP_DIRECTION_DEGREES = 0 as const;
export const BASELINE_BRUSH_SIZE_JITTER = 0 as const;""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """const BASELINE_BRUSH_RANDOM_DYNAMICS_SALT_V1 = 0xa511e9b3 as const;

export function deterministicBaselineBrushRandomV1(seed: number, stampIndex: number): number {""",
    """const BASELINE_BRUSH_RANDOM_DYNAMICS_SALT_V1 = 0xa511e9b3 as const;
const BASELINE_BRUSH_SIZE_JITTER_SALT_V1 = 0x63d83595 as const;

export function deterministicBaselineBrushSizeJitterV1(seed: number, stampIndex: number): number {
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) {
    throw new RangeError('baseline brush size jitter seed must be uint32');
  }
  if (!Number.isSafeInteger(stampIndex) || stampIndex < 0) {
    throw new RangeError('baseline brush size jitter stamp index must be a non-negative safe integer');
  }
  let value =
    (seed ^
      BASELINE_BRUSH_SIZE_JITTER_SALT_V1 ^
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
    """  readonly randomInput: number;
  readonly tiltUprightness: number;""",
    """  readonly randomInput: number;
  readonly sizeJitterScale: number;
  readonly tiltUprightness: number;""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """  readonly #flowMaximumResponse: number;
  readonly #randomSeed: number;""",
    """  readonly #flowMaximumResponse: number;
  readonly #sizeJitter: number;
  readonly #randomSeed: number;""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """  #logicalStampIndex = 0;
  #randomStampIndex = 0;""",
    """  #logicalStampIndex = 0;
  #randomStampIndex = 0;
  #sizeJitterStampIndex = 0;""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """      readonly flowMaximumResponse?: number;
      readonly randomSeed?: number;""",
    """      readonly flowMaximumResponse?: number;
      readonly sizeJitter?: number;
      readonly randomSeed?: number;""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """    const flowMaximumResponse = options.flowMaximumResponse ?? 1;
    const randomSeed = options.randomSeed ?? 0;""",
    """    const flowMaximumResponse = options.flowMaximumResponse ?? 1;
    const sizeJitter = options.sizeJitter ?? BASELINE_BRUSH_SIZE_JITTER;
    const randomSeed = options.randomSeed ?? 0;""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """    if (
      sizeMinimumResponse > sizeMaximumResponse ||
      opacityMinimumResponse > opacityMaximumResponse ||
      flowMinimumResponse > flowMaximumResponse
    ) {
      throw new RangeError('baseline brush minimum response cannot exceed maximum response');
    }
    if (!Number.isSafeInteger(randomSeed) || randomSeed < 0 || randomSeed > 0xffffffff) {""",
    """    if (
      sizeMinimumResponse > sizeMaximumResponse ||
      opacityMinimumResponse > opacityMaximumResponse ||
      flowMinimumResponse > flowMaximumResponse
    ) {
      throw new RangeError('baseline brush minimum response cannot exceed maximum response');
    }
    if (!Number.isFinite(sizeJitter) || sizeJitter < 0 || sizeJitter > 1) {
      throw new RangeError('baseline brush size jitter must be within 0..1');
    }
    if (!Number.isSafeInteger(randomSeed) || randomSeed < 0 || randomSeed > 0xffffffff) {""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """    this.#flowMaximumResponse = flowMaximumResponse;
    this.#randomSeed = randomSeed >>> 0;""",
    """    this.#flowMaximumResponse = flowMaximumResponse;
    this.#sizeJitter = sizeJitter;
    this.#randomSeed = randomSeed >>> 0;""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """      | 'randomInput'
      | 'tiltUprightness'""",
    """      | 'randomInput'
      | 'sizeJitterScale'
      | 'tiltUprightness'""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """      this.#radius * sizeScale * sizeResponse,""",
    """      this.#radius * sizeScale * sizeResponse * stamp.sizeJitterScale,""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """    if (usesRandom) this.#randomStampIndex += 1;
    const sampledTipAlpha = this.#sampledTipAlphaForLogicalStamp();
    const record: BaselineLogicalStampRecordV1 = {
      x,
      y,
      pressure,
      velocity,
      randomInput,
      tiltUprightness,""",
    """    if (usesRandom) this.#randomStampIndex += 1;
    const sizeJitterScale =
      this.#sizeJitter > 0
        ? 1 -
          this.#sizeJitter *
            deterministicBaselineBrushSizeJitterV1(this.#randomSeed, this.#sizeJitterStampIndex)
        : 1;
    if (this.#sizeJitter > 0) this.#sizeJitterStampIndex += 1;
    const sampledTipAlpha = this.#sampledTipAlphaForLogicalStamp();
    const record: BaselineLogicalStampRecordV1 = {
      x,
      y,
      pressure,
      velocity,
      randomInput,
      sizeJitterScale,
      tiltUprightness,""",
)

# Canonical facade forwards the captured jitter amount without a competing renderer path.
replace_once(
    'src/app/canonical-raster-brush.ts',
    """      readonly flowMaximumResponse?: number;
      readonly randomSeed?: number;""",
    """      readonly flowMaximumResponse?: number;
      readonly sizeJitter?: number;
      readonly randomSeed?: number;""",
)
replace_once(
    'src/app/canonical-raster-brush.ts',
    """      ...(options.flowMaximumResponse === undefined
        ? {}
        : { flowMaximumResponse: options.flowMaximumResponse }),
      ...(options.randomSeed === undefined ? {} : { randomSeed: options.randomSeed }),""",
    """      ...(options.flowMaximumResponse === undefined
        ? {}
        : { flowMaximumResponse: options.flowMaximumResponse }),
      ...(options.sizeJitter === undefined ? {} : { sizeJitter: options.sizeJitter }),
      ...(options.randomSeed === undefined ? {} : { randomSeed: options.randomSeed }),""",
)

# Runtime session captures jitter at stroke start and persists the deterministic seed when needed.
replace_once(
    'src/app/paint-session-controller.ts',
    """  BASELINE_BRUSH_TIP_DIRECTION_DEGREES,
  DEFAULT_BASELINE_BRUSH_COLOR_V1,""",
    """  BASELINE_BRUSH_TIP_DIRECTION_DEGREES,
  BASELINE_BRUSH_SIZE_JITTER,
  DEFAULT_BASELINE_BRUSH_COLOR_V1,""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """  readonly brushFlowMaximumResponse: number;
  readonly brushTipAngleDegrees: number;""",
    """  readonly brushFlowMaximumResponse: number;
  readonly brushSizeJitter: number;
  readonly brushTipAngleDegrees: number;""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """  #brushFlowMaximumResponse = 1;
  #brushTipAngleDegrees: number = BASELINE_BRUSH_TIP_ANGLE_DEGREES;""",
    """  #brushFlowMaximumResponse = 1;
  #brushSizeJitter: number = BASELINE_BRUSH_SIZE_JITTER;
  #brushTipAngleDegrees: number = BASELINE_BRUSH_TIP_ANGLE_DEGREES;""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """      brushFlowMaximumResponse: this.#brushFlowMaximumResponse,
      brushTipAngleDegrees: this.#brushTipAngleDegrees,""",
    """      brushFlowMaximumResponse: this.#brushFlowMaximumResponse,
      brushSizeJitter: this.#brushSizeJitter,
      brushTipAngleDegrees: this.#brushTipAngleDegrees,""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """    this.#brushFlowMinimumResponse = flow.minimum;
    this.#brushFlowMaximumResponse = flow.maximum;
  }

  setBrushTipAngleDegrees(angleDegrees: number): number {""",
    """    this.#brushFlowMinimumResponse = flow.minimum;
    this.#brushFlowMaximumResponse = flow.maximum;
  }

  setBrushSizeJitter(amount: number): number {
    if (!Number.isFinite(amount) || amount < 0 || amount > 1) {
      throw new RangeError('invalid runtime brush size jitter');
    }
    if (amount !== this.#brushSizeJitter) this.#clearActiveStroke();
    this.#brushSizeJitter = amount;
    return this.#brushSizeJitter;
  }

  brushSizeJitter(): number {
    return this.#brushSizeJitter;
  }

  setBrushTipAngleDegrees(angleDegrees: number): number {""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """    const randomSeed =
      this.#brushTipSelectionMode === 'random-per-stamp' || randomDynamicsEnabled
        ? deterministicPaintStrokeSeedV1(strokeId)
        : undefined;""",
    """    const sizeJitterEnabled = this.#brushSizeJitter > 0;
    const randomSeed =
      this.#brushTipSelectionMode === 'random-per-stamp' || randomDynamicsEnabled || sizeJitterEnabled
        ? deterministicPaintStrokeSeedV1(strokeId)
        : undefined;""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """        flowMaximumResponse: this.#brushFlowMaximumResponse,
        randomSeed: randomSeed ?? 0,""",
    """        flowMaximumResponse: this.#brushFlowMaximumResponse,
        sizeJitter: this.#brushSizeJitter,
        randomSeed: randomSeed ?? 0,""",
)

# Preset-library mutation API.
replace_once(
    'src/app/brush-preset-library.ts',
    """  withBrushFlowMaximumResponseV1,
  withBrushStrokeSpacingV1,""",
    """  withBrushFlowMaximumResponseV1,
  withBrushSizeJitterV1,
  withBrushStrokeSpacingV1,""",
)
replace_once(
    'src/app/brush-preset-library.ts',
    """export function updateBrushPresetSpacingV1(""",
    """export function updateBrushPresetSizeJitterV1(
  state: BrushPresetLibraryStateV1,
  presetId: string,
  amount: number,
): BrushPresetLibraryStateV1 {
  return updateItemV1(state, presetId, (item) => {
    if (item.locked) throw new Error('locked brush preset cannot be edited');
    const current = withBrushSizeJitterV1(item.preset, amount);
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

export function updateBrushPresetSpacingV1(""",
)

# Reachable Brush Properties wiring.
replace_once(
    'src/app/brush-preset-controller.ts',
    """  brushFlowMaximumResponseV1,
  BUILTIN_BRUSH_GRAIN_RESOURCES_V1,""",
    """  brushFlowMaximumResponseV1,
  brushSizeJitterV1,
  BUILTIN_BRUSH_GRAIN_RESOURCES_V1,""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  updateBrushPresetFlowMaximumResponseV1,
  updateBrushPresetSpacingV1,""",
    """  updateBrushPresetFlowMaximumResponseV1,
  updateBrushPresetSizeJitterV1,
  updateBrushPresetSpacingV1,""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  const flowMaximumResponseNumber = requireElement(
    '#brush-flow-maximum-response-number',
    HTMLInputElement,
  );
  const tipShape = requireElement('#brush-tip-shape', HTMLSelectElement);""",
    """  const flowMaximumResponseNumber = requireElement(
    '#brush-flow-maximum-response-number',
    HTMLInputElement,
  );
  const sizeJitterRange = requireElement('#brush-size-jitter-range', HTMLInputElement);
  const sizeJitterNumber = requireElement('#brush-size-jitter-number', HTMLInputElement);
  const tipShape = requireElement('#brush-tip-shape', HTMLSelectElement);""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    input.paintSession.setBrushDynamicResponseBounds(
      { minimum: sizeMinimumResponse, maximum: sizeMaximumResponse },
      { minimum: opacityMinimumResponse, maximum: opacityMaximumResponse },
      { minimum: flowMinimumResponse, maximum: flowMaximumResponse },
    );
    const tipAssets = brushTipAssetsV1(item.preset);""",
    """    input.paintSession.setBrushDynamicResponseBounds(
      { minimum: sizeMinimumResponse, maximum: sizeMaximumResponse },
      { minimum: opacityMinimumResponse, maximum: opacityMaximumResponse },
      { minimum: flowMinimumResponse, maximum: flowMaximumResponse },
    );
    const sizeJitter = brushSizeJitterV1(item.preset);
    input.paintSession.setBrushSizeJitter(sizeJitter);
    const tipAssets = brushTipAssetsV1(item.preset);""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    input.root.dataset.illustroBrushFlowMaximumResponse = String(flowMaximumResponse);
    input.root.dataset.illustroBrushTipShape = brushTipShapeV1(item.preset);""",
    """    input.root.dataset.illustroBrushFlowMaximumResponse = String(flowMaximumResponse);
    input.root.dataset.illustroBrushSizeJitter = String(sizeJitter);
    input.root.dataset.illustroBrushTipShape = brushTipShapeV1(item.preset);""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    flowMinimumResponseRange.max = String(flowMaximumResponse * 100);
    flowMinimumResponseNumber.max = String(flowMaximumResponse * 100);
    tipShape.value = brushTipShapeV1(selected.preset);""",
    """    flowMinimumResponseRange.max = String(flowMaximumResponse * 100);
    flowMinimumResponseNumber.max = String(flowMaximumResponse * 100);
    const sizeJitter = brushSizeJitterV1(selected.preset);
    configurePair(sizeJitterRange, sizeJitterNumber, 0, 100, 1, sizeJitter * 100);
    tipShape.value = brushTipShapeV1(selected.preset);""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    const maximumResponseLabel = `${
      sizeMaximumResponse < 1 ? ` · DynSizeMax${Math.round(sizeMaximumResponse * 100)}%` : ''
    }${
      opacityMaximumResponse < 1
        ? ` · DynOpacityMax${Math.round(opacityMaximumResponse * 100)}%`
        : ''
    }${flowMaximumResponse < 1 ? ` · DynFlowMax${Math.round(flowMaximumResponse * 100)}%` : ''}`;
    propertyStatus.textContent =""",
    """    const maximumResponseLabel = `${
      sizeMaximumResponse < 1 ? ` · DynSizeMax${Math.round(sizeMaximumResponse * 100)}%` : ''
    }${
      opacityMaximumResponse < 1
        ? ` · DynOpacityMax${Math.round(opacityMaximumResponse * 100)}%`
        : ''
    }${flowMaximumResponse < 1 ? ` · DynFlowMax${Math.round(flowMaximumResponse * 100)}%` : ''}`;
    const sizeJitterLabel = sizeJitter > 0 ? ` · SizeJitter${Math.round(sizeJitter * 100)}%` : '';
    propertyStatus.textContent =""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """${randomCurveLabel}${minimumResponseLabel}${maximumResponseLabel}`;""",
    """${randomCurveLabel}${minimumResponseLabel}${maximumResponseLabel}${sizeJitterLabel}`;""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """      flowMaximumResponseRange,
      flowMaximumResponseNumber,
      tipShape,""",
    """      flowMaximumResponseRange,
      flowMaximumResponseNumber,
      sizeJitterRange,
      sizeJitterNumber,
      tipShape,""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  const onFlowMaximumResponseNumber = (): void =>
    updateFlowMaximumResponse(Number(flowMaximumResponseNumber.value));
  const onTipShape = (): void => {""",
    """  const onFlowMaximumResponseNumber = (): void =>
    updateFlowMaximumResponse(Number(flowMaximumResponseNumber.value));
  const updateSizeJitter = (valuePercent: number): void =>
    mutate(() => updateBrushPresetSizeJitterV1(state, state.selectedPresetId, valuePercent / 100));
  const onSizeJitterRange = (): void => updateSizeJitter(Number(sizeJitterRange.value));
  const onSizeJitterNumber = (): void => updateSizeJitter(Number(sizeJitterNumber.value));
  const onTipShape = (): void => {""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  flowMaximumResponseRange.addEventListener('input', onFlowMaximumResponseRange);
  flowMaximumResponseNumber.addEventListener('change', onFlowMaximumResponseNumber);
  tipShape.addEventListener('change', onTipShape);""",
    """  flowMaximumResponseRange.addEventListener('input', onFlowMaximumResponseRange);
  flowMaximumResponseNumber.addEventListener('change', onFlowMaximumResponseNumber);
  sizeJitterRange.addEventListener('input', onSizeJitterRange);
  sizeJitterNumber.addEventListener('change', onSizeJitterNumber);
  tipShape.addEventListener('change', onTipShape);""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """      flowMaximumResponseRange.removeEventListener('input', onFlowMaximumResponseRange);
      flowMaximumResponseNumber.removeEventListener('change', onFlowMaximumResponseNumber);
      pressureCurveEditor?.dispose();""",
    """      flowMaximumResponseRange.removeEventListener('input', onFlowMaximumResponseRange);
      flowMaximumResponseNumber.removeEventListener('change', onFlowMaximumResponseNumber);
      sizeJitterRange.removeEventListener('input', onSizeJitterRange);
      sizeJitterNumber.removeEventListener('change', onSizeJitterNumber);
      pressureCurveEditor?.dispose();""",
)

# Tool Properties row.
replace_once(
    'src/index.html',
    """              <div class=\"shell-brush-property-row\">
                <label for=\"brush-flow-maximum-response-range\">動的流量上限</label>
                <input id=\"brush-flow-maximum-response-range\" type=\"range\" min=\"0\" max=\"100\" step=\"1\" value=\"100\" />
                <span class=\"shell-brush-property-number shell-brush-property-percent\"><input id=\"brush-flow-maximum-response-number\" type=\"number\" inputmode=\"decimal\" min=\"0\" max=\"100\" step=\"1\" value=\"100\" aria-label=\"動的流量最大レスポンス\" /><span>%</span></span>
              </div>
              <div class=\"shell-brush-property-row shell-brush-tip-property-row\">""",
    """              <div class=\"shell-brush-property-row\">
                <label for=\"brush-flow-maximum-response-range\">動的流量上限</label>
                <input id=\"brush-flow-maximum-response-range\" type=\"range\" min=\"0\" max=\"100\" step=\"1\" value=\"100\" />
                <span class=\"shell-brush-property-number shell-brush-property-percent\"><input id=\"brush-flow-maximum-response-number\" type=\"number\" inputmode=\"decimal\" min=\"0\" max=\"100\" step=\"1\" value=\"100\" aria-label=\"動的流量最大レスポンス\" /><span>%</span></span>
              </div>
              <div class=\"shell-brush-property-row\">
                <label for=\"brush-size-jitter-range\">サイズジッター</label>
                <input id=\"brush-size-jitter-range\" type=\"range\" min=\"0\" max=\"100\" step=\"1\" value=\"0\" />
                <span class=\"shell-brush-property-number shell-brush-property-percent\"><input id=\"brush-size-jitter-number\" type=\"number\" inputmode=\"decimal\" min=\"0\" max=\"100\" step=\"1\" value=\"0\" aria-label=\"ブラシサイズジッター\" /><span>%</span></span>
              </div>
              <div class=\"shell-brush-property-row shell-brush-tip-property-row\">""",
)

# Regression coverage.
Path('tests/unit/brush-size-jitter.test.ts').write_text("""import { describe, expect, it } from 'vitest';
import {
  brushSizeJitterV1,
  createBaselineBrushPresetV1,
  withBrushSizeJitterV1,
} from '../../src/domain/brush-schema.js';
import {
  BaselineBrushDabBuilderV1,
  deterministicBaselineBrushRandomV1,
  deterministicBaselineBrushSizeJitterV1,
} from '../../src/gpu/baseline-brush.js';

describe('M6A-051 size jitter', () => {
  it('stores a normalized direct jitter amount with an exact zero default', () => {
    const preset = createBaselineBrushPresetV1({ id: 'test.size-jitter', name: 'Size Jitter' });
    expect(brushSizeJitterV1(preset)).toBe(0);
    const changed = withBrushSizeJitterV1(preset, 0.4);
    expect(brushSizeJitterV1(changed)).toBe(0.4);
    expect(changed.jitter.size).toBe(0.4);
    const reset = withBrushSizeJitterV1(changed, 0);
    expect(brushSizeJitterV1(reset)).toBe(0);
    expect(reset.jitter.size).toBeUndefined();
    expect(() => withBrushSizeJitterV1(preset, -0.01)).toThrow(RangeError);
    expect(() => withBrushSizeJitterV1(preset, 1.01)).toThrow(RangeError);
  });

  it('keeps zero jitter as an exact radius identity', () => {
    const baseline = new BaselineBrushDabBuilderV1({ sizePx: 20, spacingRatio: 1, randomSeed: 19 });
    baseline.begin({ documentX: 0, documentY: 0 });
    baseline.append([{ documentX: 20, documentY: 0 }]);
    baseline.finish();
    const explicitZero = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      spacingRatio: 1,
      randomSeed: 19,
      sizeJitter: 0,
    });
    explicitZero.begin({ documentX: 0, documentY: 0 });
    explicitZero.append([{ documentX: 20, documentY: 0 }]);
    explicitZero.finish();
    expect(explicitZero.dabs()).toEqual(baseline.dabs());
  });

  it('applies deterministic one-sided size variation per logical stamp attempt', () => {
    const seed = 0x12345678;
    const amount = 0.5;
    const brush = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      spacingRatio: 1,
      sizeJitter: amount,
      randomSeed: seed,
    });
    brush.begin({ documentX: 0, documentY: 0 });
    brush.append([{ documentX: 20, documentY: 0 }]);
    brush.finish();
    const dabs = brush.dabs();
    expect(dabs).toHaveLength(2);
    expect(dabs[0]?.radius).toBeCloseTo(
      10 * (1 - amount * deterministicBaselineBrushSizeJitterV1(seed, 0)),
      10,
    );
    expect(dabs[1]?.radius).toBeCloseTo(
      10 * (1 - amount * deterministicBaselineBrushSizeJitterV1(seed, 1)),
      10,
    );
  });

  it('advances the size-jitter attempt index even when taper suppresses a logical stamp', () => {
    const seed = 0x89abcdef;
    const amount = 0.75;
    const brush = new BaselineBrushDabBuilderV1({
      sizePx: 10,
      spacingRatio: 1,
      startTaperLengthPx: 10,
      sizeJitter: amount,
      randomSeed: seed,
    });
    brush.begin({ documentX: 0, documentY: 0 });
    brush.append([{ documentX: 10, documentY: 0 }]);
    const dabs = brush.dabs();
    expect(dabs).toHaveLength(1);
    expect(dabs[0]?.radius).toBeCloseTo(
      5 * (1 - amount * deterministicBaselineBrushSizeJitterV1(seed, 1)),
      10,
    );
  });

  it('uses a random channel independent from generalized random dynamics', () => {
    const seed = 0x0badc0de;
    expect(deterministicBaselineBrushSizeJitterV1(seed, 0)).not.toBe(
      deterministicBaselineBrushRandomV1(seed, 0),
    );
    const plain = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      spacingRatio: 1,
      sizeJitter: 0.5,
      randomSeed: seed,
    });
    const withDynamics = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      spacingRatio: 1,
      sizeJitter: 0.5,
      randomSeed: seed,
      randomFlowEnabled: true,
    });
    for (const brush of [plain, withDynamics]) {
      brush.begin({ documentX: 0, documentY: 0 });
      brush.append([{ documentX: 20, documentY: 0 }]);
      brush.finish();
    }
    expect(withDynamics.dabs().map((dab) => dab.radius)).toEqual(
      plain.dabs().map((dab) => dab.radius),
    );
  });

  it('reuses the stored jitter scale when reconciling the mutable end tail', () => {
    const seed = 0xfeed1234;
    const amount = 0.6;
    const brush = new BaselineBrushDabBuilderV1({
      sizePx: 10,
      spacingRatio: 1,
      endTaperLengthPx: 10,
      sizeTaperMinimumRatio: 1,
      opacityTaperMinimumRatio: 1,
      sizeJitter: amount,
      randomSeed: seed,
    });
    brush.begin({ documentX: 0, documentY: 0 });
    brush.append([{ documentX: 10, documentY: 0 }, { documentX: 20, documentY: 0 }]);
    const beforeFinish = brush.dabs().map((dab) => dab.radius);
    brush.finish();
    expect(brush.dabs().map((dab) => dab.radius)).toEqual(beforeFinish);
  });
});
""")

# Progress and restart boundary.
replace_once(
    'IMPLEMENTATION_PROGRESS.md',
    """M6A-051 size jitter:未完了
M6A-052 opacity jitter:未完了""",
    """M6A-051 size jitter:完了
再開メモ: M6A-051 size jitterはCanonical Brush Modelのjitter.sizeを0..1の直接変動量として保持し、0を完全identity/defaultとする。logical stamp attemptごとにstroke randomSeed + size-jitter専用saltから決定的0..1値を生成し、最終radiusへ(1 - amount * random)を乗算するためbase sizeを上回らない一方向variationとなる。M6A-048 generalized random dynamicsとはrandom channelとattempt indexを分離し、tip random selectionとも独立する。start/end taper・dynamic min/max responseの外側でサイズへ乗算するためforced taperの0 endpointを復活させない。可視logical stamp recordには解決済みsizeJitterScaleを保持し、end-tail reconciliationで再抽選しない。size jitterが有効なら他のrandom機能がOFFでもstrokeId由来uint32 randomSeedを保存し、post-stroke correction再構築でも同一結果を得る。primitive dab / Worker / Historyにはjitter専用fieldを追加せず解決済みradiusのみを保存する。次はM6A-052 opacity jitterから再開する。
M6A-052 opacity jitter:未完了""",
)

# Canonical design memo boundary.
design = Path('ILLUSTRO_DESIGN_MEMO.md')
text = design.read_text()
heading = '## M6A size-jitter boundary — 2026-09-03'
if heading not in text:
    design.write_text(text.rstrip() + """

## M6A size-jitter boundary — 2026-09-03

- `jitter.size` is a normalized `0..1` direct per-logical-stamp size-variation amount. `0` is exact identity and may be omitted from serialized presets.
- The resolved scale is `1 - amount * random`, so M6A-051 varies from `(1-amount) * base` through `base` and does not enlarge above the captured base size. Expansion-style size variance is not introduced implicitly.
- Size jitter is distinct from generalized `dynamics.random*`: it owns a separate deterministic salt/channel and attempt index. Enabling/disabling random dynamics or random tip selection must not reorder size-jitter values.
- A logical-stamp attempt consumes one size-jitter value even when taper or another response suppresses visible primitive output. Visible logical records retain the resolved scale so bounded end-tail reconciliation never re-rolls randomness.
- The jitter scale multiplies resolved radius outside dynamic target min/max clamping and alongside the taper result. Therefore forced-taper zero endpoints remain authoritative.
- When size jitter is active, the committed stroke stores the existing deterministic uint32 `randomSeed` even if no other random brush feature is active. Primitive dabs keep only resolved radius; no jitter-only renderer/history schema is added.
- Tool Properties exposes a compact Size Jitter percentage control. M6A-052+ extend the same `jitter` section for other independent variation targets.
""".rstrip() + '\n')

# Verification gate.
replace_once(
    'scripts/verify-m6a-brush.mjs',
    """requireText(
  progress,
  'M6A-PERF-001 incremental active-stroke rendering（stable prefix + bounded mutable tail）:未完了',""",
    """requireText(progress, 'M6A-051 size jitter:完了', 'M6A-051 progress is not complete');
requireText(
  read('src/domain/brush-schema.ts'),
  'brushSizeJitterV1',
  'size-jitter preset helpers missing',
);
requireText(
  read('src/gpu/baseline-brush.ts'),
  'deterministicBaselineBrushSizeJitterV1',
  'deterministic size-jitter channel missing',
);
requireText(
  read('src/gpu/baseline-brush.ts'),
  'stamp.sizeJitterScale',
  'resolved size jitter is not applied to logical-stamp radius',
);
requireText(
  read('src/app/paint-session-controller.ts'),
  'setBrushSizeJitter',
  'size jitter is not connected to runtime brush state',
);
requireText(
  read('src/app/paint-session-controller.ts'),
  'randomDynamicsEnabled || sizeJitterEnabled',
  'size jitter does not capture a deterministic persistent stroke seed',
);
requireText(
  read('src/index.html'),
  'id=\"brush-size-jitter-range\"',
  'reachable size-jitter control missing',
);
requireText(
  read('tests/unit/brush-size-jitter.test.ts'),
  'advances the size-jitter attempt index even when taper suppresses a logical stamp',
  'size-jitter attempt-index regression missing',
);
requireText(
  read('tests/unit/brush-size-jitter.test.ts'),
  'uses a random channel independent from generalized random dynamics',
  'size-jitter channel-independence regression missing',
);
requireText(
  read('tests/unit/brush-size-jitter.test.ts'),
  'reuses the stored jitter scale when reconciling the mutable end tail',
  'size-jitter tail reconciliation regression missing',
);

requireText(
  progress,
  'M6A-PERF-001 incremental active-stroke rendering（stable prefix + bounded mutable tail）:未完了',""",
)

print('M6A-051 patch applied')
