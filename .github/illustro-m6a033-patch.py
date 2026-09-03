from pathlib import Path


def read(path: str) -> str:
    return Path(path).read_text(encoding='utf-8')


def write(path: str, content: str) -> None:
    Path(path).write_text(content, encoding='utf-8')


def replace_once(path: str, before: str, after: str) -> None:
    source = read(path)
    count = source.count(before)
    if count != 1:
        raise RuntimeError(f'{path}: expected one replacement, found {count}: {before[:180]!r}')
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


# Canonical preset helper: reuse the already-present stabilization.amount field.
insert_before(
    'src/domain/brush-schema.ts',
    'export type BrushTipSelectionModeV1 =',
    """export const DEFAULT_BRUSH_REALTIME_STABILIZATION_AMOUNT_V1 = 0 as const;

export function brushRealtimeStabilizationAmountV1(preset: BrushPresetV1): number {
  const value = preset.stabilization.amount;
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1
    ? value
    : DEFAULT_BRUSH_REALTIME_STABILIZATION_AMOUNT_V1;
}

export function withBrushRealtimeStabilizationAmountV1(
  preset: BrushPresetV1,
  amount: number,
): BrushPresetV1 {
  if (!Number.isFinite(amount) || amount < 0 || amount > 1) {
    throw new RangeError('brush real-time stabilization amount must be within 0..1');
  }
  return normalizeBrushPresetV1({
    ...preset,
    stabilization: { ...preset.stabilization, amount },
  });
}""",
)

# Causal O(1) One-Euro-style geometry filter. Raw samples remain untouched in history.
write_new(
    'src/app/realtime-brush-stabilizer.ts',
    """export interface RealtimeBrushStabilizerSampleV1 {
  readonly documentX: number;
  readonly documentY: number;
  readonly timestampMs: number;
}

export interface RealtimeBrushStabilizedPointV1 {
  readonly documentX: number;
  readonly documentY: number;
}

const DEFAULT_DT_SECONDS = 1 / 120;
const MIN_DT_SECONDS = 1 / 1000;
const MAX_DT_SECONDS = 1 / 20;
const DERIVATIVE_CUTOFF_HZ = 1;
const WEAK_MIN_CUTOFF_HZ = 12;
const STRONG_MIN_CUTOFF_HZ = 0.75;
const WEAK_BETA = 0.08;
const STRONG_BETA = 0.015;
const RELEASE_EPSILON_PX = 1e-6;

function finiteSample(sample: RealtimeBrushStabilizerSampleV1): void {
  if (
    !Number.isFinite(sample.documentX) ||
    !Number.isFinite(sample.documentY) ||
    !Number.isFinite(sample.timestampMs)
  ) {
    throw new TypeError('real-time stabilizer sample must be finite');
  }
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function interpolate(start: number, end: number, amount: number): number {
  return start + (end - start) * amount;
}

function lowPassAlpha(cutoffHz: number, dtSeconds: number): number {
  const timeConstant = 1 / (2 * Math.PI * cutoffHz);
  return 1 / (1 + timeConstant / dtSeconds);
}

/**
 * M6A causal real-time stroke stabilizer.
 *
 * This is an independently implemented One-Euro-style adaptive low-pass filter: slow motion is
 * smoothed strongly, while the cutoff rises with filtered velocity so fast intentional motion
 * stays responsive. It stores only the previous raw/filter state and therefore remains O(1) per
 * sample and never rewrites an already-confirmed stroke prefix.
 */
export class RealtimeBrushStabilizerV1 {
  readonly #amount: number;
  #initialized = false;
  #lastTimestampMs = 0;
  #lastDtSeconds = DEFAULT_DT_SECONDS;
  #lastRawX = 0;
  #lastRawY = 0;
  #filteredX = 0;
  #filteredY = 0;
  #filteredDerivativeX = 0;
  #filteredDerivativeY = 0;

  constructor(amount: number) {
    if (!Number.isFinite(amount) || amount < 0 || amount > 1) {
      throw new RangeError('real-time stabilization amount must be within 0..1');
    }
    this.#amount = amount;
  }

  amount(): number {
    return this.#amount;
  }

  push(sample: RealtimeBrushStabilizerSampleV1): RealtimeBrushStabilizedPointV1 {
    finiteSample(sample);
    if (!this.#initialized) {
      this.#adoptRaw(sample);
      return Object.freeze({ documentX: sample.documentX, documentY: sample.documentY });
    }
    if (this.#amount <= 0) {
      this.#adoptRaw(sample);
      return Object.freeze({ documentX: sample.documentX, documentY: sample.documentY });
    }

    const rawDtSeconds = (sample.timestampMs - this.#lastTimestampMs) / 1000;
    const dtSeconds =
      Number.isFinite(rawDtSeconds) && rawDtSeconds > 0
        ? clamp(rawDtSeconds, MIN_DT_SECONDS, MAX_DT_SECONDS)
        : this.#lastDtSeconds;
    const derivativeX = (sample.documentX - this.#lastRawX) / dtSeconds;
    const derivativeY = (sample.documentY - this.#lastRawY) / dtSeconds;
    const derivativeAlpha = lowPassAlpha(DERIVATIVE_CUTOFF_HZ, dtSeconds);
    this.#filteredDerivativeX = interpolate(
      this.#filteredDerivativeX,
      derivativeX,
      derivativeAlpha,
    );
    this.#filteredDerivativeY = interpolate(
      this.#filteredDerivativeY,
      derivativeY,
      derivativeAlpha,
    );
    const speedPxPerSecond = Math.hypot(this.#filteredDerivativeX, this.#filteredDerivativeY);
    const minimumCutoffHz = interpolate(
      WEAK_MIN_CUTOFF_HZ,
      STRONG_MIN_CUTOFF_HZ,
      this.#amount,
    );
    const beta = interpolate(WEAK_BETA, STRONG_BETA, this.#amount);
    const cutoffHz = minimumCutoffHz + beta * speedPxPerSecond;
    const positionAlpha = lowPassAlpha(cutoffHz, dtSeconds);
    this.#filteredX = interpolate(this.#filteredX, sample.documentX, positionAlpha);
    this.#filteredY = interpolate(this.#filteredY, sample.documentY, positionAlpha);
    this.#lastRawX = sample.documentX;
    this.#lastRawY = sample.documentY;
    this.#lastTimestampMs = sample.timestampMs;
    this.#lastDtSeconds = dtSeconds;
    return Object.freeze({ documentX: this.#filteredX, documentY: this.#filteredY });
  }

  release(sample: RealtimeBrushStabilizerSampleV1): RealtimeBrushStabilizedPointV1 | null {
    finiteSample(sample);
    if (!this.#initialized || this.#amount <= 0) return null;
    const dx = sample.documentX - this.#filteredX;
    const dy = sample.documentY - this.#filteredY;
    if (Math.hypot(dx, dy) <= RELEASE_EPSILON_PX) return null;
    this.#adoptRaw(sample);
    return Object.freeze({ documentX: sample.documentX, documentY: sample.documentY });
  }

  #adoptRaw(sample: RealtimeBrushStabilizerSampleV1): void {
    this.#initialized = true;
    this.#lastRawX = sample.documentX;
    this.#lastRawY = sample.documentY;
    this.#filteredX = sample.documentX;
    this.#filteredY = sample.documentY;
    this.#filteredDerivativeX = 0;
    this.#filteredDerivativeY = 0;
    this.#lastTimestampMs = sample.timestampMs;
    this.#lastDtSeconds = DEFAULT_DT_SECONDS;
  }
}""",
)

# Paint session runtime: capture the selected amount per stroke, keep raw samples canonical, filter only builder geometry.
insert_before(
    'src/app/paint-session-controller.ts',
    "import {\n  hydratePaintRasterLayerDescriptorsV1,",
    """import { RealtimeBrushStabilizerV1 } from './realtime-brush-stabilizer.js';""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """  readonly brushForceStartTaper: boolean;
  readonly brushForceEndTaper: boolean;
  readonly brushTipAngleDegrees: number;
""",
    """  readonly brushForceStartTaper: boolean;
  readonly brushForceEndTaper: boolean;
  readonly brushRealtimeStabilizationAmount: number;
  readonly brushTipAngleDegrees: number;
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """  #activeBrushStroke: CanonicalRasterBrushStrokeV1 | null = null;
  #activeDabDelta: readonly BaselineBrushDabV1[] = Object.freeze([]);
""",
    """  #activeBrushStroke: CanonicalRasterBrushStrokeV1 | null = null;
  #activeRealtimeStabilizer: RealtimeBrushStabilizerV1 | null = null;
  #activeDabDelta: readonly BaselineBrushDabV1[] = Object.freeze([]);
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """  #brushForceStartTaper = false;
  #brushForceEndTaper = false;
  #brushTipAngleDegrees: number = BASELINE_BRUSH_TIP_ANGLE_DEGREES;
""",
    """  #brushForceStartTaper = false;
  #brushForceEndTaper = false;
  #brushRealtimeStabilizationAmount = 0;
  #brushTipAngleDegrees: number = BASELINE_BRUSH_TIP_ANGLE_DEGREES;
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """      brushForceStartTaper: this.#brushForceStartTaper,
      brushForceEndTaper: this.#brushForceEndTaper,
      brushTipAngleDegrees: this.#brushTipAngleDegrees,
""",
    """      brushForceStartTaper: this.#brushForceStartTaper,
      brushForceEndTaper: this.#brushForceEndTaper,
      brushRealtimeStabilizationAmount: this.#brushRealtimeStabilizationAmount,
      brushTipAngleDegrees: this.#brushTipAngleDegrees,
""",
)
insert_before(
    'src/app/paint-session-controller.ts',
    '  setBrushTipAngleDegrees(angleDegrees: number): number {\n',
    """  setBrushRealtimeStabilizationAmount(amount: number): number {
    if (!Number.isFinite(amount) || amount < 0 || amount > 1) {
      throw new RangeError('invalid runtime real-time stabilization amount');
    }
    if (amount !== this.#brushRealtimeStabilizationAmount) this.#clearActiveStroke();
    this.#brushRealtimeStabilizationAmount = amount;
    return this.#brushRealtimeStabilizationAmount;
  }

  brushRealtimeStabilizationAmount(): number {
    return this.#brushRealtimeStabilizationAmount;
  }""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """      this.#appendConfirmedSamples(batch);
""",
    """      this.#appendConfirmedSamples(batch, batch.eventType === 'pointerup');
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """    const parameters = this.#brushParameters;
    const builder = new CanonicalRasterBrushStrokeV1({
""",
    """    const stabilizer = new RealtimeBrushStabilizerV1(this.#brushRealtimeStabilizationAmount);
    const stabilizedSamples = samples.map((sample) => stabilizer.push(sample));
    const firstStabilizedSample = stabilizedSamples[0];
    if (firstStabilizedSample === undefined) return;
    this.#activeRealtimeStabilizer = stabilizer;
    const parameters = this.#brushParameters;
    const builder = new CanonicalRasterBrushStrokeV1({
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """    this.#queueActiveDabDelta(builder.beginConfirmed(firstSample));
    this.#queueActiveDabDelta(builder.appendConfirmed(samples.slice(1)));
    this.#activeBrushStroke = builder;
  }

  #appendConfirmedSamples(batch: PointerInputBatchV1): void {
""",
    """    this.#queueActiveDabDelta(builder.beginConfirmed(firstStabilizedSample));
    this.#queueActiveDabDelta(builder.appendConfirmed(stabilizedSamples.slice(1)));
    this.#activeBrushStroke = builder;
  }

  #appendConfirmedSamples(batch: PointerInputBatchV1, release: boolean): void {
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """    const builder = this.#activeBrushStroke;
    if (active === null || document === null || builder === null) return;
""",
    """    const builder = this.#activeBrushStroke;
    const stabilizer = this.#activeRealtimeStabilizer;
    if (active === null || document === null || builder === null || stabilizer === null) return;
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """    if (additions.length === 0) return;
    this.#activeSamples.push(...additions);
    this.#queueActiveDabDelta(builder.appendConfirmed(additions));
  }
""",
    """    if (additions.length === 0) return;
    this.#activeSamples.push(...additions);
    const stabilizedAdditions = additions.map((sample) => stabilizer.push(sample));
    this.#queueActiveDabDelta(builder.appendConfirmed(stabilizedAdditions));
    if (release) {
      const rawEndpoint = additions.at(-1);
      if (rawEndpoint !== undefined) {
        const releasePoint = stabilizer.release(rawEndpoint);
        if (releasePoint !== null) {
          this.#queueActiveDabDelta(builder.appendConfirmed([releasePoint]));
        }
      }
    }
  }
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """    this.#activeStroke = null;
    this.#activeSamples.length = 0;
    this.#activeBrushStroke = null;
    this.#activeDabDelta = Object.freeze([]);
""",
    """    this.#activeStroke = null;
    this.#activeSamples.length = 0;
    this.#activeBrushStroke = null;
    this.#activeRealtimeStabilizer = null;
    this.#activeDabDelta = Object.freeze([]);
""",
)

# Preset library mutation.
replace_once(
    'src/app/brush-preset-library.ts',
    """  withBrushForcedTaperV1,
  withBrushStrokeSpacingV1,
""",
    """  withBrushForcedTaperV1,
  withBrushRealtimeStabilizationAmountV1,
  withBrushStrokeSpacingV1,
""",
)
insert_before(
    'src/app/brush-preset-library.ts',
    'export function updateBrushPresetCustomTipV1(\n',
    """export function updateBrushPresetRealtimeStabilizationV1(
  state: BrushPresetLibraryStateV1,
  presetId: string,
  amount: number,
): BrushPresetLibraryStateV1 {
  return updateItemV1(state, presetId, (item) => {
    if (item.locked) throw new Error('locked brush preset cannot be edited');
    const current = withBrushRealtimeStabilizationAmountV1(item.preset, amount);
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

# Preset controller + reachable UI.
replace_once(
    'src/app/brush-preset-controller.ts',
    """  brushForcedTaperV1,
  brushStrokeSpacingV1,
""",
    """  brushForcedTaperV1,
  brushRealtimeStabilizationAmountV1,
  brushStrokeSpacingV1,
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  updateBrushPresetForcedTaperV1,
  updateBrushPresetSpacingV1,
""",
    """  updateBrushPresetForcedTaperV1,
  updateBrushPresetRealtimeStabilizationV1,
  updateBrushPresetSpacingV1,
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  const forceStartTaperButton = requireElement('#brush-force-start-taper', HTMLButtonElement);
  const forceEndTaperButton = requireElement('#brush-force-end-taper', HTMLButtonElement);
  const tipShape = requireElement('#brush-tip-shape', HTMLSelectElement);
""",
    """  const forceStartTaperButton = requireElement('#brush-force-start-taper', HTMLButtonElement);
  const forceEndTaperButton = requireElement('#brush-force-end-taper', HTMLButtonElement);
  const stabilizationRange = requireElement('#brush-stabilization-range', HTMLInputElement);
  const stabilizationNumber = requireElement('#brush-stabilization-number', HTMLInputElement);
  const tipShape = requireElement('#brush-tip-shape', HTMLSelectElement);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    const forcedTaper = brushForcedTaperV1(item.preset);
    input.paintSession.setBrushForcedTaper(forcedTaper.start, forcedTaper.end);
    const tipAssets = brushTipAssetsV1(item.preset);
""",
    """    const forcedTaper = brushForcedTaperV1(item.preset);
    input.paintSession.setBrushForcedTaper(forcedTaper.start, forcedTaper.end);
    const stabilizationAmount = brushRealtimeStabilizationAmountV1(item.preset);
    input.paintSession.setBrushRealtimeStabilizationAmount(stabilizationAmount);
    const tipAssets = brushTipAssetsV1(item.preset);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    input.root.dataset.illustroBrushForceStartTaper = String(forcedTaper.start);
    input.root.dataset.illustroBrushForceEndTaper = String(forcedTaper.end);
    input.root.dataset.illustroBrushTipShape = brushTipShapeV1(item.preset);
""",
    """    input.root.dataset.illustroBrushForceStartTaper = String(forcedTaper.start);
    input.root.dataset.illustroBrushForceEndTaper = String(forcedTaper.end);
    input.root.dataset.illustroBrushStabilizationAmount = String(stabilizationAmount);
    input.root.dataset.illustroBrushTipShape = brushTipShapeV1(item.preset);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    forceEndTaperButton.textContent = forcedTaper.end ? 'ON' : 'OFF';
    forceEndTaperButton.setAttribute('aria-pressed', String(forcedTaper.end));
    tipShape.value = brushTipShapeV1(selected.preset);
""",
    """    forceEndTaperButton.textContent = forcedTaper.end ? 'ON' : 'OFF';
    forceEndTaperButton.setAttribute('aria-pressed', String(forcedTaper.end));
    const stabilizationAmount = brushRealtimeStabilizationAmountV1(selected.preset);
    configurePair(
      stabilizationRange,
      stabilizationNumber,
      0,
      100,
      1,
      stabilizationAmount * 100,
    );
    tipShape.value = brushTipShapeV1(selected.preset);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    const forcedTaperLabel = `${forcedTaper.start ? ' · ForceIn' : ''}${forcedTaper.end ? ' · ForceOut' : ''}`;
    propertyStatus.textContent = `${parameters.sizePx.toFixed(1)} px · ${Math.round(parameters.opacity * 100)}% · ${Math.round(parameters.flow * 100)}% · H${Math.round(hardness * 100)}% · D${Math.round(tipDensity * 100)}% · S${Math.round(spacing.spacingRatio * 100)}% · A${Math.round(tipAngleDegrees)}° · F${Math.round(tipDirectionDegrees)}°${followRotation ? ' · Follow' : ''}${repeatLabel}${startLabel}${endLabel}${sizeTaperLabel}${opacityTaperLabel}${forcedTaperLabel}`;
""",
    """    const forcedTaperLabel = `${forcedTaper.start ? ' · ForceIn' : ''}${forcedTaper.end ? ' · ForceOut' : ''}`;
    const stabilizationLabel =
      stabilizationAmount > 0 ? ` · Stab${Math.round(stabilizationAmount * 100)}%` : '';
    propertyStatus.textContent = `${parameters.sizePx.toFixed(1)} px · ${Math.round(parameters.opacity * 100)}% · ${Math.round(parameters.flow * 100)}% · H${Math.round(hardness * 100)}% · D${Math.round(tipDensity * 100)}% · S${Math.round(spacing.spacingRatio * 100)}% · A${Math.round(tipAngleDegrees)}° · F${Math.round(tipDirectionDegrees)}°${followRotation ? ' · Follow' : ''}${repeatLabel}${startLabel}${endLabel}${sizeTaperLabel}${opacityTaperLabel}${forcedTaperLabel}${stabilizationLabel}`;
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """      forceStartTaperButton,
      forceEndTaperButton,
      tipShape,
""",
    """      forceStartTaperButton,
      forceEndTaperButton,
      stabilizationRange,
      stabilizationNumber,
      tipShape,
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  const onForceEndTaper = (): void => {
    const current = brushForcedTaperV1(selectedBrushPresetItemV1(state).preset);
    mutate(() =>
      updateBrushPresetForcedTaperV1(state, state.selectedPresetId, current.start, !current.end),
    );
  };
  const onTipShape = (): void => {
""",
    """  const onForceEndTaper = (): void => {
    const current = brushForcedTaperV1(selectedBrushPresetItemV1(state).preset);
    mutate(() =>
      updateBrushPresetForcedTaperV1(state, state.selectedPresetId, current.start, !current.end),
    );
  };
  const updateStabilization = (percent: number): void =>
    mutate(() =>
      updateBrushPresetRealtimeStabilizationV1(state, state.selectedPresetId, percent / 100),
    );
  const onStabilizationRange = (): void => updateStabilization(Number(stabilizationRange.value));
  const onStabilizationNumber = (): void => updateStabilization(Number(stabilizationNumber.value));
  const onTipShape = (): void => {
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  forceStartTaperButton.addEventListener('click', onForceStartTaper);
  forceEndTaperButton.addEventListener('click', onForceEndTaper);
  tipShape.addEventListener('change', onTipShape);
""",
    """  forceStartTaperButton.addEventListener('click', onForceStartTaper);
  forceEndTaperButton.addEventListener('click', onForceEndTaper);
  stabilizationRange.addEventListener('input', onStabilizationRange);
  stabilizationNumber.addEventListener('change', onStabilizationNumber);
  tipShape.addEventListener('change', onTipShape);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """      forceStartTaperButton.removeEventListener('click', onForceStartTaper);
      forceEndTaperButton.removeEventListener('click', onForceEndTaper);
      tipShape.removeEventListener('change', onTipShape);
""",
    """      forceStartTaperButton.removeEventListener('click', onForceStartTaper);
      forceEndTaperButton.removeEventListener('click', onForceEndTaper);
      stabilizationRange.removeEventListener('input', onStabilizationRange);
      stabilizationNumber.removeEventListener('change', onStabilizationNumber);
      tipShape.removeEventListener('change', onTipShape);
""",
)

replace_once(
    'src/index.html',
    """              <div class=\"shell-brush-property-row shell-brush-tip-property-row\">
                <label for=\"brush-force-end-taper\">強制抜き</label>
                <button id=\"brush-force-end-taper\" type=\"button\" aria-pressed=\"false\" title=\"抜き長さの終点をサイズ・不透明度とも0へ強制\">OFF</button>
                <span class=\"shell-brush-tip-kind\">抜き</span>
              </div>
              <div class=\"shell-brush-property-row shell-brush-tip-property-row\">
                <label for=\"brush-tip-shape\">ブラシ形状</label>
""",
    """              <div class=\"shell-brush-property-row shell-brush-tip-property-row\">
                <label for=\"brush-force-end-taper\">強制抜き</label>
                <button id=\"brush-force-end-taper\" type=\"button\" aria-pressed=\"false\" title=\"抜き長さの終点をサイズ・不透明度とも0へ強制\">OFF</button>
                <span class=\"shell-brush-tip-kind\">抜き</span>
              </div>
              <div class=\"shell-brush-property-row\">
                <label for=\"brush-stabilization-range\">リアルタイム補正</label>
                <input id=\"brush-stabilization-range\" type=\"range\" min=\"0\" max=\"100\" step=\"1\" value=\"0\" />
                <span class=\"shell-brush-property-number shell-brush-property-percent\"><input id=\"brush-stabilization-number\" type=\"number\" inputmode=\"numeric\" min=\"0\" max=\"100\" step=\"1\" value=\"0\" aria-label=\"リアルタイム手ブレ補正\" /><span>%</span></span>
              </div>
              <div class=\"shell-brush-property-row shell-brush-tip-property-row\">
                <label for=\"brush-tip-shape\">ブラシ形状</label>
""",
)

# Regression coverage for the adaptive filter and session-level raw-vs-rendered boundary.
write_new(
    'tests/unit/brush-realtime-stabilizer.test.ts',
    """import { describe, expect, it } from 'vitest';
import {
  brushRealtimeStabilizationAmountV1,
  createBaselineBrushPresetV1,
  withBrushRealtimeStabilizationAmountV1,
} from '../../src/domain/brush-schema.js';
import { PaintSessionControllerV1 } from '../../src/app/paint-session-controller.js';
import { RealtimeBrushStabilizerV1 } from '../../src/app/realtime-brush-stabilizer.js';
import type { BaselineRasterLayerDescriptorV1 } from '../../src/gpu/baseline-raster-tile-store.js';
import type {
  PointerInputBatchV1,
  PointerInputEventTypeV1,
  PointerInputSampleV1,
} from '../../src/input/pointer-input.js';

class FakeRendererDocumentPort {
  async configureDocument(_input: {
    readonly width: number;
    readonly height: number;
    readonly workingSpace: 'srgb' | 'display-p3';
    readonly precision: 'rgba8-unorm' | 'rgba16-float';
    readonly rasterLayers: readonly BaselineRasterLayerDescriptorV1[];
  }): Promise<void> {}
  async restoreBaselineStrokes(): Promise<void> {}
  async applyBaselineTilePatches(): Promise<void> {}
}

function point(documentX: number, documentY: number, timestampMs: number) {
  return Object.freeze({ documentX, documentY, timestampMs });
}

function pointer(
  sequence: number,
  eventType: PointerInputEventTypeV1,
  surfaceX: number,
  surfaceY: number,
  timestampMs: number,
): PointerInputSampleV1 {
  return Object.freeze({
    schema: 'illustro.pointer-sample/1' as const,
    sequence,
    pointerId: 11,
    source: 'pen' as const,
    eventType,
    origin: 'direct' as const,
    isPrimary: true,
    timestampMs,
    clientX: surfaceX,
    clientY: surfaceY,
    surfaceX,
    surfaceY,
    pressure: 0.5,
    tangentialPressure: 0,
    tiltX: 0,
    tiltY: 0,
    twist: 0,
    altitudeAngle: null,
    azimuthAngle: null,
    contactWidth: 1,
    contactHeight: 1,
    buttons: eventType === 'pointerup' ? 0 : 1,
    button: eventType === 'pointerdown' ? 0 : -1,
  });
}

function batch(
  eventType: PointerInputEventTypeV1,
  confirmed: readonly PointerInputSampleV1[],
): PointerInputBatchV1 {
  return Object.freeze({
    schema: 'illustro.pointer-batch/1' as const,
    eventType,
    pointerId: confirmed.at(-1)?.pointerId ?? 11,
    confirmed: Object.freeze([...confirmed]),
    predicted: Object.freeze([]),
  });
}

describe('M6A-033 real-time stabilization', () => {
  it('reuses stabilization.amount with a 0..1 compatibility default', () => {
    const preset = createBaselineBrushPresetV1({
      id: 'stabilizer.paint',
      name: 'Stabilizer',
      category: 'Test',
      behavior: 'paint',
    });
    expect(brushRealtimeStabilizationAmountV1(preset)).toBe(0);
    expect(
      brushRealtimeStabilizationAmountV1(withBrushRealtimeStabilizationAmountV1(preset, 0.65)),
    ).toBeCloseTo(0.65, 8);
  });

  it('is an exact identity path when amount is zero', () => {
    const filter = new RealtimeBrushStabilizerV1(0);
    expect(filter.push(point(0, 0, 0))).toEqual({ documentX: 0, documentY: 0 });
    expect(filter.push(point(7, -3, 16))).toEqual({ documentX: 7, documentY: -3 });
    expect(filter.release(point(7, -3, 16))).toBeNull();
  });

  it('suppresses slow jitter while adapting toward fast intentional motion', () => {
    const slow = new RealtimeBrushStabilizerV1(1);
    slow.push(point(0, 0, 0));
    const slowMove = slow.push(point(1, 0, 16));
    expect(slowMove.documentX).toBeGreaterThan(0);
    expect(slowMove.documentX).toBeLessThan(1);

    const fast = new RealtimeBrushStabilizerV1(1);
    fast.push(point(0, 0, 0));
    const fastMove = fast.push(point(100, 0, 16));
    expect(fastMove.documentX / 100).toBeGreaterThan(slowMove.documentX);
  });

  it('snaps only the release endpoint to raw input without rewriting prior filtered points', () => {
    const filter = new RealtimeBrushStabilizerV1(1);
    filter.push(point(0, 0, 0));
    const filtered = filter.push(point(20, 0, 16));
    expect(filtered.documentX).toBeLessThan(20);
    expect(filter.release(point(20, 0, 16))).toEqual({ documentX: 20, documentY: 0 });
  });

  it('keeps raw stroke samples canonical while feeding stabilized geometry to the brush builder', async () => {
    const session = new PaintSessionControllerV1(new FakeRendererDocumentPort());
    await session.createNewDocument({ width: 256, height: 256 });
    session.setBrushRealtimeStabilizationAmount(1);
    session.ingestPointerBatch(batch('pointerdown', [pointer(1, 'pointerdown', 10, 10, 0)]));
    session.ingestPointerBatch(batch('pointermove', [pointer(2, 'pointermove', 30, 10, 16)]));

    expect(session.activeStroke()?.samples.map((sample) => sample.documentX)).toEqual([10, 30]);
    expect(session.activeDabs().at(-1)?.x).toBeLessThan(30);
    expect(session.snapshot().brushRealtimeStabilizationAmount).toBe(1);
  });
});""",
)

# Verifier contract.
insert_before(
    'scripts/verify-m6a-brush.mjs',
    """requireText(
  progress,
  'M6A-PERF-001 incremental active-stroke rendering（stable prefix + bounded mutable tail）:未完了',
""",
    """requireText(progress, 'M6A-033 real-time stabilization:完了', 'M6A-033 progress is not complete');
requireText(
  read('src/domain/brush-schema.ts'),
  'brushRealtimeStabilizationAmountV1',
  'real-time stabilization preset helper missing',
);
requireText(
  read('src/app/realtime-brush-stabilizer.ts'),
  'class RealtimeBrushStabilizerV1',
  'causal real-time stabilizer missing',
);
requireText(
  read('src/app/realtime-brush-stabilizer.ts'),
  'speedPxPerSecond',
  'velocity-adaptive cutoff missing from real-time stabilizer',
);
requireText(
  read('src/app/paint-session-controller.ts'),
  'const stabilizedAdditions = additions.map((sample) => stabilizer.push(sample));',
  'paint session does not stabilize render geometry incrementally',
);
requireText(
  read('src/app/paint-session-controller.ts'),
  'const releasePoint = stabilizer.release(rawEndpoint);',
  'paint session does not converge release to confirmed raw endpoint',
);
requireText(
  read('src/index.html'),
  'id=\"brush-stabilization-range\"',
  'reachable real-time stabilization control missing',
);
requireText(
  read('tests/unit/brush-realtime-stabilizer.test.ts'),
  'keeps raw stroke samples canonical',
  'real-time stabilization raw/canonical regression coverage missing',
);""",
)

replace_once(
    'IMPLEMENTATION_PROGRESS.md',
    'M6A-033 real-time stabilization:未完了\nM6A-034 post-stroke correction:未完了',
    """M6A-033 real-time stabilization:完了
再開メモ: M6A-033 real-time stabilizationは既存presetのstabilization.amountを0..1 canonical値として接続し、amount=0を完全identity pathとする。描画geometryには独自実装のOne-Euro-style速度適応ローパスを因果的に適用し、低速時はjitterを強く抑え、高速時はfiltered velocityに応じてcutoffを上げ追従性を確保する。状態量と処理量はstroke長に依存せず1 sampleあたりO(1)。PaintStrokeSampleV1のraw confirmed samplesは履歴/保存正本として一切書き換えず、filter出力だけをCanonical Raster Brush builderへ渡すためstable prefixを再計算しない。pointerup時は最後のconfirmed raw座標へ追加segmentで1回だけ収束し、通常入力中の過去dabを巻き戻さない。predicted samplesは引き続きcanonical stateへ混入させない。次はM6A-034 post-stroke correctionから再開する。
M6A-034 post-stroke correction:未完了""",
)
append_once(
    'ILLUSTRO_DESIGN_MEMO.md',
    'M6A real-time stabilization boundary — 2026-09-03',
    """#### M6A real-time stabilization boundary — 2026-09-03

- M6A-033 adopts the already-existing `stabilization.amount` preset field as a normalized 0..1 **real-time stabilization strength**. `0` is an exact compatibility/identity path.
- Real-time stabilization is a causal, independently implemented **One-Euro-style adaptive low-pass filter** on document-space stroke geometry. Slow motion receives stronger smoothing; filtered velocity raises the cutoff during fast motion so intentional motion remains responsive.
- The filter owns O(1) state and O(1) work per confirmed sample. It never scans or rewrites the confirmed stroke prefix, so it is compatible with the M6A incremental stable-prefix invariant.
- `PaintStrokeSampleV1` remains the canonical raw confirmed input record for history, recovery and later post-stroke correction. Stabilized coordinates are presentation/brush-generation geometry only; the low-level primitive dab schema does not gain a stabilizer field.
- Pointer release may append one final geometry segment to the last confirmed raw endpoint so the committed stroke terminates exactly where the user released. This is not permission to re-filter/replay the full stroke.
- Predicted input remains provisional and is not persisted as confirmed stabilizer input. M6A-034 post-stroke correction is a separate release-time operation and must not silently redefine this causal hot path.
- The parameter is exposed in Brush Properties and captured at stroke start. Changing it cannot mutate an already-active stroke.""",
)

print('M6A-033 real-time stabilization patch applied')