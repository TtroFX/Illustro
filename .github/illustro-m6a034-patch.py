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


# Preset schema: post-stroke correction is a separate stabilization field, default off.
insert_before(
    'src/domain/brush-schema.ts',
    'export type BrushTipSelectionModeV1 =',
    """export const DEFAULT_BRUSH_POST_STROKE_CORRECTION_AMOUNT_V1 = 0 as const;

export function brushPostStrokeCorrectionAmountV1(preset: BrushPresetV1): number {
  const value = preset.stabilization.postStrokeAmount;
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1
    ? value
    : DEFAULT_BRUSH_POST_STROKE_CORRECTION_AMOUNT_V1;
}

export function withBrushPostStrokeCorrectionAmountV1(
  preset: BrushPresetV1,
  amount: number,
): BrushPresetV1 {
  if (!Number.isFinite(amount) || amount < 0 || amount > 1) {
    throw new RangeError('brush post-stroke correction amount must be within 0..1');
  }
  return normalizeBrushPresetV1({
    ...preset,
    stabilization: { ...preset.stabilization, postStrokeAmount: amount },
  });
}""",
)

# Release-only geometry smoother. Fixed endpoints, bounded pass count, O(n) only when explicitly enabled.
write_new(
    'src/app/post-stroke-correction.ts',
    """export interface PostStrokeCorrectionPointV1 {
  readonly documentX: number;
  readonly documentY: number;
}

const MAX_POST_STROKE_PASSES = 4;
const MAX_PASS_GAIN = 0.6;
const DISTANCE_EPSILON_PX = 1e-9;

function finitePoint(point: PostStrokeCorrectionPointV1): void {
  if (!Number.isFinite(point.documentX) || !Number.isFinite(point.documentY)) {
    throw new TypeError('post-stroke correction point must be finite');
  }
}

function freezePoint(point: PostStrokeCorrectionPointV1): PostStrokeCorrectionPointV1 {
  return Object.freeze({ documentX: point.documentX, documentY: point.documentY });
}

/**
 * Release-only symmetric stroke correction.
 *
 * Interior points move toward the distance-proportional chord between their neighbors. Endpoints are
 * exact invariants. A bounded 1..4 pass count gives useful smoothing without making release work
 * unbounded beyond O(n), and amount=0 is an exact identity path.
 */
export function correctPostStrokeGeometryV1(
  samples: readonly PostStrokeCorrectionPointV1[],
  amount: number,
): readonly PostStrokeCorrectionPointV1[] {
  if (!Number.isFinite(amount) || amount < 0 || amount > 1) {
    throw new RangeError('post-stroke correction amount must be within 0..1');
  }
  for (const sample of samples) finitePoint(sample);
  if (samples.length === 0) return Object.freeze([]);
  let current = samples.map(freezePoint);
  if (amount <= 0 || current.length < 3) return Object.freeze(current);

  const passCount = Math.max(1, Math.min(MAX_POST_STROKE_PASSES, Math.ceil(amount * 4)));
  const gain = MAX_PASS_GAIN * amount;
  for (let pass = 0; pass < passCount; pass += 1) {
    const next = current.map(freezePoint);
    for (let index = 1; index < current.length - 1; index += 1) {
      const previous = current[index - 1];
      const point = current[index];
      const following = current[index + 1];
      if (previous === undefined || point === undefined || following === undefined) continue;
      const leftDistance = Math.hypot(
        point.documentX - previous.documentX,
        point.documentY - previous.documentY,
      );
      const rightDistance = Math.hypot(
        following.documentX - point.documentX,
        following.documentY - point.documentY,
      );
      const totalDistance = leftDistance + rightDistance;
      if (totalDistance <= DISTANCE_EPSILON_PX) continue;
      const ratio = leftDistance / totalDistance;
      const chordX = previous.documentX + (following.documentX - previous.documentX) * ratio;
      const chordY = previous.documentY + (following.documentY - previous.documentY) * ratio;
      next[index] = Object.freeze({
        documentX: point.documentX + (chordX - point.documentX) * gain,
        documentY: point.documentY + (chordY - point.documentY) * gain,
      });
    }
    current = next;
  }
  return Object.freeze(current);
}""",
)

# Paint session captures the post-correction amount and keeps an exact active brush factory for release rebuilds.
insert_before(
    'src/app/paint-session-controller.ts',
    "import { RealtimeBrushStabilizerV1 } from './realtime-brush-stabilizer.js';",
    """import { correctPostStrokeGeometryV1 } from './post-stroke-correction.js';""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """  readonly brushRealtimeStabilizationAmount: number;
  readonly brushTipAngleDegrees: number;
""",
    """  readonly brushRealtimeStabilizationAmount: number;
  readonly brushPostStrokeCorrectionAmount: number;
  readonly brushTipAngleDegrees: number;
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """  #activeBrushStroke: CanonicalRasterBrushStrokeV1 | null = null;
  #activeRealtimeStabilizer: RealtimeBrushStabilizerV1 | null = null;
  #activeDabDelta: readonly BaselineBrushDabV1[] = Object.freeze([]);
""",
    """  #activeBrushStroke: CanonicalRasterBrushStrokeV1 | null = null;
  #activeBrushFactory: (() => CanonicalRasterBrushStrokeV1) | null = null;
  #activeRealtimeStabilizer: RealtimeBrushStabilizerV1 | null = null;
  #activeDabDelta: readonly BaselineBrushDabV1[] = Object.freeze([]);
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """  #brushRealtimeStabilizationAmount = 0;
  #brushTipAngleDegrees: number = BASELINE_BRUSH_TIP_ANGLE_DEGREES;
""",
    """  #brushRealtimeStabilizationAmount = 0;
  #brushPostStrokeCorrectionAmount = 0;
  #brushTipAngleDegrees: number = BASELINE_BRUSH_TIP_ANGLE_DEGREES;
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """      brushRealtimeStabilizationAmount: this.#brushRealtimeStabilizationAmount,
      brushTipAngleDegrees: this.#brushTipAngleDegrees,
""",
    """      brushRealtimeStabilizationAmount: this.#brushRealtimeStabilizationAmount,
      brushPostStrokeCorrectionAmount: this.#brushPostStrokeCorrectionAmount,
      brushTipAngleDegrees: this.#brushTipAngleDegrees,
""",
)
insert_before(
    'src/app/paint-session-controller.ts',
    '  setBrushTipAngleDegrees(angleDegrees: number): number {\n',
    """  setBrushPostStrokeCorrectionAmount(amount: number): number {
    if (!Number.isFinite(amount) || amount < 0 || amount > 1) {
      throw new RangeError('invalid runtime post-stroke correction amount');
    }
    if (amount !== this.#brushPostStrokeCorrectionAmount) this.#clearActiveStroke();
    this.#brushPostStrokeCorrectionAmount = amount;
    return this.#brushPostStrokeCorrectionAmount;
  }

  brushPostStrokeCorrectionAmount(): number {
    return this.#brushPostStrokeCorrectionAmount;
  }""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """    if (batch.eventType === 'pointerup') {
      const completed = this.activeStroke();
      const builder = this.#activeBrushStroke;
      if (completed !== null && builder !== null) {
        builder.finishConfirmed();
        this.#completedStrokes.push(freezeCompletedStroke(completed, builder.dabs()));
      }
      this.#clearActiveStroke();
    }
""",
    """    if (batch.eventType === 'pointerup') {
      const completed = this.activeStroke();
      const builder = this.#activeBrushStroke;
      const createBrush = this.#activeBrushFactory;
      if (completed !== null && builder !== null) {
        builder.finishConfirmed();
        let finalDabs = builder.dabs();
        if (
          this.#brushPostStrokeCorrectionAmount > 0 &&
          createBrush !== null &&
          this.#activeSamples.length >= 3
        ) {
          const replayStabilizer = new RealtimeBrushStabilizerV1(
            this.#activeRealtimeStabilizer?.amount() ?? this.#brushRealtimeStabilizationAmount,
          );
          const liveGeometry = this.#activeSamples.map((sample) => replayStabilizer.push(sample));
          const rawEndpoint = this.#activeSamples.at(-1);
          if (rawEndpoint !== undefined) {
            const releasePoint = replayStabilizer.release(rawEndpoint);
            if (releasePoint !== null) liveGeometry.push(releasePoint);
          }
          const correctedGeometry = correctPostStrokeGeometryV1(
            liveGeometry,
            this.#brushPostStrokeCorrectionAmount,
          );
          const firstCorrected = correctedGeometry[0];
          if (firstCorrected !== undefined) {
            const correctedBuilder = createBrush();
            correctedBuilder.beginConfirmed(firstCorrected);
            correctedBuilder.appendConfirmed(correctedGeometry.slice(1));
            correctedBuilder.finishConfirmed();
            finalDabs = correctedBuilder.dabs();
          }
        }
        this.#completedStrokes.push(freezeCompletedStroke(completed, finalDabs));
      }
      this.#clearActiveStroke();
    }
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """    const parameters = this.#brushParameters;
    const builder = new CanonicalRasterBrushStrokeV1({
""",
    """    const parameters = this.#brushParameters;
    const createBrush = (): CanonicalRasterBrushStrokeV1 =>
      new CanonicalRasterBrushStrokeV1({
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """      ...(this.#brushSampledTipAlphas.length === 0
        ? {}
        : { sampledTipAlphas: this.#brushSampledTipAlphas }),
    });
    this.#queueActiveDabDelta(builder.beginConfirmed(firstStabilizedSample));
""",
    """        ...(this.#brushSampledTipAlphas.length === 0
          ? {}
          : { sampledTipAlphas: this.#brushSampledTipAlphas }),
      });
    const builder = createBrush();
    this.#activeBrushFactory = createBrush;
    this.#queueActiveDabDelta(builder.beginConfirmed(firstStabilizedSample));
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """    this.#activeBrushStroke = null;
    this.#activeRealtimeStabilizer = null;
    this.#activeDabDelta = Object.freeze([]);
""",
    """    this.#activeBrushStroke = null;
    this.#activeBrushFactory = null;
    this.#activeRealtimeStabilizer = null;
    this.#activeDabDelta = Object.freeze([]);
""",
)

# Preset mutation.
replace_once(
    'src/app/brush-preset-library.ts',
    """  withBrushRealtimeStabilizationAmountV1,
  withBrushStrokeSpacingV1,
""",
    """  withBrushRealtimeStabilizationAmountV1,
  withBrushPostStrokeCorrectionAmountV1,
  withBrushStrokeSpacingV1,
""",
)
insert_before(
    'src/app/brush-preset-library.ts',
    'export function updateBrushPresetCustomTipV1(\n',
    """export function updateBrushPresetPostStrokeCorrectionV1(
  state: BrushPresetLibraryStateV1,
  presetId: string,
  amount: number,
): BrushPresetLibraryStateV1 {
  return updateItemV1(state, presetId, (item) => {
    if (item.locked) throw new Error('locked brush preset cannot be edited');
    const current = withBrushPostStrokeCorrectionAmountV1(item.preset, amount);
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

# Preset controller + UI.
replace_once(
    'src/app/brush-preset-controller.ts',
    """  brushRealtimeStabilizationAmountV1,
  brushStrokeSpacingV1,
""",
    """  brushRealtimeStabilizationAmountV1,
  brushPostStrokeCorrectionAmountV1,
  brushStrokeSpacingV1,
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  updateBrushPresetRealtimeStabilizationV1,
  updateBrushPresetSpacingV1,
""",
    """  updateBrushPresetRealtimeStabilizationV1,
  updateBrushPresetPostStrokeCorrectionV1,
  updateBrushPresetSpacingV1,
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  const stabilizationRange = requireElement('#brush-stabilization-range', HTMLInputElement);
  const stabilizationNumber = requireElement('#brush-stabilization-number', HTMLInputElement);
  const tipShape = requireElement('#brush-tip-shape', HTMLSelectElement);
""",
    """  const stabilizationRange = requireElement('#brush-stabilization-range', HTMLInputElement);
  const stabilizationNumber = requireElement('#brush-stabilization-number', HTMLInputElement);
  const postCorrectionRange = requireElement('#brush-post-correction-range', HTMLInputElement);
  const postCorrectionNumber = requireElement('#brush-post-correction-number', HTMLInputElement);
  const tipShape = requireElement('#brush-tip-shape', HTMLSelectElement);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    const stabilizationAmount = brushRealtimeStabilizationAmountV1(item.preset);
    input.paintSession.setBrushRealtimeStabilizationAmount(stabilizationAmount);
    const tipAssets = brushTipAssetsV1(item.preset);
""",
    """    const stabilizationAmount = brushRealtimeStabilizationAmountV1(item.preset);
    input.paintSession.setBrushRealtimeStabilizationAmount(stabilizationAmount);
    const postCorrectionAmount = brushPostStrokeCorrectionAmountV1(item.preset);
    input.paintSession.setBrushPostStrokeCorrectionAmount(postCorrectionAmount);
    const tipAssets = brushTipAssetsV1(item.preset);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    input.root.dataset.illustroBrushStabilizationAmount = String(stabilizationAmount);
    input.root.dataset.illustroBrushTipShape = brushTipShapeV1(item.preset);
""",
    """    input.root.dataset.illustroBrushStabilizationAmount = String(stabilizationAmount);
    input.root.dataset.illustroBrushPostCorrectionAmount = String(postCorrectionAmount);
    input.root.dataset.illustroBrushTipShape = brushTipShapeV1(item.preset);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    const stabilizationAmount = brushRealtimeStabilizationAmountV1(selected.preset);
    configurePair(stabilizationRange, stabilizationNumber, 0, 100, 1, stabilizationAmount * 100);
    tipShape.value = brushTipShapeV1(selected.preset);
""",
    """    const stabilizationAmount = brushRealtimeStabilizationAmountV1(selected.preset);
    configurePair(stabilizationRange, stabilizationNumber, 0, 100, 1, stabilizationAmount * 100);
    const postCorrectionAmount = brushPostStrokeCorrectionAmountV1(selected.preset);
    configurePair(postCorrectionRange, postCorrectionNumber, 0, 100, 1, postCorrectionAmount * 100);
    tipShape.value = brushTipShapeV1(selected.preset);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    const stabilizationLabel =
      stabilizationAmount > 0 ? ` · Stab${Math.round(stabilizationAmount * 100)}%` : '';
    propertyStatus.textContent = `${parameters.sizePx.toFixed(1)} px · ${Math.round(parameters.opacity * 100)}% · ${Math.round(parameters.flow * 100)}% · H${Math.round(hardness * 100)}% · D${Math.round(tipDensity * 100)}% · S${Math.round(spacing.spacingRatio * 100)}% · A${Math.round(tipAngleDegrees)}° · F${Math.round(tipDirectionDegrees)}°${followRotation ? ' · Follow' : ''}${repeatLabel}${startLabel}${endLabel}${sizeTaperLabel}${opacityTaperLabel}${forcedTaperLabel}${stabilizationLabel}`;
""",
    """    const stabilizationLabel =
      stabilizationAmount > 0 ? ` · Stab${Math.round(stabilizationAmount * 100)}%` : '';
    const postCorrectionLabel =
      postCorrectionAmount > 0 ? ` · Post${Math.round(postCorrectionAmount * 100)}%` : '';
    propertyStatus.textContent = `${parameters.sizePx.toFixed(1)} px · ${Math.round(parameters.opacity * 100)}% · ${Math.round(parameters.flow * 100)}% · H${Math.round(hardness * 100)}% · D${Math.round(tipDensity * 100)}% · S${Math.round(spacing.spacingRatio * 100)}% · A${Math.round(tipAngleDegrees)}° · F${Math.round(tipDirectionDegrees)}°${followRotation ? ' · Follow' : ''}${repeatLabel}${startLabel}${endLabel}${sizeTaperLabel}${opacityTaperLabel}${forcedTaperLabel}${stabilizationLabel}${postCorrectionLabel}`;
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """      stabilizationRange,
      stabilizationNumber,
      tipShape,
""",
    """      stabilizationRange,
      stabilizationNumber,
      postCorrectionRange,
      postCorrectionNumber,
      tipShape,
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  const onStabilizationRange = (): void => updateStabilization(Number(stabilizationRange.value));
  const onStabilizationNumber = (): void => updateStabilization(Number(stabilizationNumber.value));
  const onTipShape = (): void => {
""",
    """  const onStabilizationRange = (): void => updateStabilization(Number(stabilizationRange.value));
  const onStabilizationNumber = (): void => updateStabilization(Number(stabilizationNumber.value));
  const updatePostCorrection = (percent: number): void =>
    mutate(() =>
      updateBrushPresetPostStrokeCorrectionV1(state, state.selectedPresetId, percent / 100),
    );
  const onPostCorrectionRange = (): void => updatePostCorrection(Number(postCorrectionRange.value));
  const onPostCorrectionNumber = (): void => updatePostCorrection(Number(postCorrectionNumber.value));
  const onTipShape = (): void => {
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  stabilizationRange.addEventListener('input', onStabilizationRange);
  stabilizationNumber.addEventListener('change', onStabilizationNumber);
  tipShape.addEventListener('change', onTipShape);
""",
    """  stabilizationRange.addEventListener('input', onStabilizationRange);
  stabilizationNumber.addEventListener('change', onStabilizationNumber);
  postCorrectionRange.addEventListener('input', onPostCorrectionRange);
  postCorrectionNumber.addEventListener('change', onPostCorrectionNumber);
  tipShape.addEventListener('change', onTipShape);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """      stabilizationRange.removeEventListener('input', onStabilizationRange);
      stabilizationNumber.removeEventListener('change', onStabilizationNumber);
      tipShape.removeEventListener('change', onTipShape);
""",
    """      stabilizationRange.removeEventListener('input', onStabilizationRange);
      stabilizationNumber.removeEventListener('change', onStabilizationNumber);
      postCorrectionRange.removeEventListener('input', onPostCorrectionRange);
      postCorrectionNumber.removeEventListener('change', onPostCorrectionNumber);
      tipShape.removeEventListener('change', onTipShape);
""",
)
replace_once(
    'src/index.html',
    """              <div class=\"shell-brush-property-row\">
                <label for=\"brush-stabilization-range\">リアルタイム補正</label>
                <input id=\"brush-stabilization-range\" type=\"range\" min=\"0\" max=\"100\" step=\"1\" value=\"0\" />
                <span class=\"shell-brush-property-number shell-brush-property-percent\"><input id=\"brush-stabilization-number\" type=\"number\" inputmode=\"numeric\" min=\"0\" max=\"100\" step=\"1\" value=\"0\" aria-label=\"リアルタイム手ブレ補正\" /><span>%</span></span>
              </div>
              <div class=\"shell-brush-property-row shell-brush-tip-property-row\">
""",
    """              <div class=\"shell-brush-property-row\">
                <label for=\"brush-stabilization-range\">リアルタイム補正</label>
                <input id=\"brush-stabilization-range\" type=\"range\" min=\"0\" max=\"100\" step=\"1\" value=\"0\" />
                <span class=\"shell-brush-property-number shell-brush-property-percent\"><input id=\"brush-stabilization-number\" type=\"number\" inputmode=\"numeric\" min=\"0\" max=\"100\" step=\"1\" value=\"0\" aria-label=\"リアルタイム手ブレ補正\" /><span>%</span></span>
              </div>
              <div class=\"shell-brush-property-row\">
                <label for=\"brush-post-correction-range\">描画後補正</label>
                <input id=\"brush-post-correction-range\" type=\"range\" min=\"0\" max=\"100\" step=\"1\" value=\"0\" />
                <span class=\"shell-brush-property-number shell-brush-property-percent\"><input id=\"brush-post-correction-number\" type=\"number\" inputmode=\"numeric\" min=\"0\" max=\"100\" step=\"1\" value=\"0\" aria-label=\"ストローク描画後補正\" /><span>%</span></span>
              </div>
              <div class=\"shell-brush-property-row shell-brush-tip-property-row\">
""",
)

# Regression tests: exact identity at zero, endpoints fixed, interior jitter reduced, session raw samples unchanged.
write_new(
    'tests/unit/brush-post-stroke-correction.test.ts',
    """import { describe, expect, it } from 'vitest';
import {
  brushPostStrokeCorrectionAmountV1,
  createBaselineBrushPresetV1,
  withBrushPostStrokeCorrectionAmountV1,
} from '../../src/domain/brush-schema.js';
import { correctPostStrokeGeometryV1 } from '../../src/app/post-stroke-correction.js';
import { PaintSessionControllerV1 } from '../../src/app/paint-session-controller.js';
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

function pointer(
  sequence: number,
  eventType: PointerInputEventTypeV1,
  surfaceX: number,
  surfaceY: number,
): PointerInputSampleV1 {
  return Object.freeze({
    schema: 'illustro.pointer-sample/1' as const,
    sequence,
    pointerId: 23,
    source: 'pen' as const,
    eventType,
    origin: 'direct' as const,
    isPrimary: true,
    timestampMs: sequence * 16,
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
    pointerId: 23,
    confirmed: Object.freeze([...confirmed]),
    predicted: Object.freeze([]),
  });
}

async function completedDabs(postAmount: number) {
  const session = new PaintSessionControllerV1(new FakeRendererDocumentPort());
  await session.createNewDocument({ width: 256, height: 256 });
  session.setBrushPostStrokeCorrectionAmount(postAmount);
  session.ingestPointerBatch(batch('pointerdown', [pointer(1, 'pointerdown', 10, 10)]));
  session.ingestPointerBatch(batch('pointermove', [pointer(2, 'pointermove', 20, 22)]));
  session.ingestPointerBatch(batch('pointermove', [pointer(3, 'pointermove', 30, 8)]));
  session.ingestPointerBatch(batch('pointermove', [pointer(4, 'pointermove', 40, 22)]));
  session.ingestPointerBatch(batch('pointerup', [pointer(5, 'pointerup', 50, 10)]));
  const completed = session.takeCompletedPaintStroke();
  if (completed === null) throw new Error('expected completed paint stroke');
  return completed;
}

describe('M6A-034 post-stroke correction', () => {
  it('stores a separate postStrokeAmount with a compatibility default of zero', () => {
    const preset = createBaselineBrushPresetV1({
      id: 'post-correction.paint',
      name: 'Post correction',
      category: 'Test',
      behavior: 'paint',
    });
    expect(brushPostStrokeCorrectionAmountV1(preset)).toBe(0);
    expect(
      brushPostStrokeCorrectionAmountV1(withBrushPostStrokeCorrectionAmountV1(preset, 0.75)),
    ).toBeCloseTo(0.75, 8);
  });

  it('is an exact geometry identity at zero', () => {
    const samples = [
      { documentX: 0, documentY: 0 },
      { documentX: 10, documentY: 4 },
      { documentX: 20, documentY: 0 },
    ];
    expect(correctPostStrokeGeometryV1(samples, 0)).toEqual(samples);
  });

  it('reduces interior jitter while preserving both endpoints exactly', () => {
    const samples = [
      { documentX: 0, documentY: 0 },
      { documentX: 10, documentY: 10 },
      { documentX: 20, documentY: -10 },
      { documentX: 30, documentY: 10 },
      { documentX: 40, documentY: 0 },
    ];
    const corrected = correctPostStrokeGeometryV1(samples, 1);
    expect(corrected[0]).toEqual(samples[0]);
    expect(corrected.at(-1)).toEqual(samples.at(-1));
    const rawVariation = Math.abs(10 - -10) + Math.abs(-10 - 10);
    const correctedVariation =
      Math.abs((corrected[1]?.documentY ?? 0) - (corrected[2]?.documentY ?? 0)) +
      Math.abs((corrected[2]?.documentY ?? 0) - (corrected[3]?.documentY ?? 0));
    expect(correctedVariation).toBeLessThan(rawVariation);
  });

  it('rebuilds only the final dab geometry while preserving canonical raw samples', async () => {
    const raw = await completedDabs(0);
    const corrected = await completedDabs(1);
    expect(corrected.stroke.samples.map((sample) => [sample.documentX, sample.documentY])).toEqual([
      [10, 10],
      [20, 22],
      [30, 8],
      [40, 22],
      [50, 10],
    ]);
    expect(corrected.dabs).not.toEqual(raw.dabs);
    expect(corrected.dabs.at(-1)?.x).toBeCloseTo(50, 6);
    expect(corrected.dabs.at(-1)?.y).toBeCloseTo(10, 6);
  });
});""",
)

# Verifier.
insert_before(
    'scripts/verify-m6a-brush.mjs',
    """requireText(
  progress,
  'M6A-PERF-001 incremental active-stroke rendering（stable prefix + bounded mutable tail）:未完了',
""",
    """requireText(progress, 'M6A-034 post-stroke correction:完了', 'M6A-034 progress is not complete');
requireText(
  read('src/domain/brush-schema.ts'),
  'brushPostStrokeCorrectionAmountV1',
  'post-stroke correction preset helper missing',
);
requireText(
  read('src/app/post-stroke-correction.ts'),
  'correctPostStrokeGeometryV1',
  'release-only post-stroke correction algorithm missing',
);
requireText(
  read('src/app/post-stroke-correction.ts'),
  'const passCount = Math.max',
  'post-stroke correction does not bound smoothing passes',
);
requireText(
  read('src/app/paint-session-controller.ts'),
  'const correctedBuilder = createBrush();',
  'paint session does not rebuild corrected final geometry',
);
requireText(
  read('src/index.html'),
  'id=\"brush-post-correction-range\"',
  'reachable post-stroke correction control missing',
);
requireText(
  read('tests/unit/brush-post-stroke-correction.test.ts'),
  'preserving canonical raw samples',
  'post-stroke raw-sample regression coverage missing',
);""",
)

replace_once(
    'IMPLEMENTATION_PROGRESS.md',
    'M6A-034 post-stroke correction:未完了\nM6A-035 grain selection:未完了',
    """M6A-034 post-stroke correction:完了
再開メモ: M6A-034 post-stroke correctionはpreset.stabilization.postStrokeAmountを0..1で保持し、0を完全identity/defaultとする。補正ON時だけpointerup後にraw confirmed samplesからM6A-033の因果filter geometryを決定的に再現し、そのgeometryへ距離比を使う対称neighbor-chord補正を最大4passで適用する。始点/終点は固定し、特に終点はconfirmed raw release位置を維持する。raw PaintStrokeSampleV1は変更せず、補正済みgeometryから同じstroke-start時brush config/random seedで最終dab列だけを1回再構築し、既存renderer.finalizeBaselineStrokeのrelease reconciliationへ渡す。通常入力中のincremental hot pathにはpost correctionのO(n)処理を入れない。M6A-033 real-time stabilizationとM6A-034 post correctionは独立設定で、後者は明示的に有効なstrokeだけrelease時O(n)、pass数は定数上限4。次はM6A-035 grain selectionから再開する。
M6A-035 grain selection:未完了""",
)
append_once(
    'ILLUSTRO_DESIGN_MEMO.md',
    'M6A post-stroke correction boundary — 2026-09-03',
    """#### M6A post-stroke correction boundary — 2026-09-03

- M6A-034 defines `stabilization.postStrokeAmount` as a separate normalized 0..1 **release-time correction strength**. It does not alias or replace M6A-033 real-time stabilization; both default to zero.
- Post-stroke correction runs only after confirmed pointer release and only when explicitly enabled. It is therefore outside the ordinary per-input hot path.
- The correction input is a deterministic reconstruction of the live M6A-033 causal geometry from canonical raw confirmed samples, including exact release-endpoint convergence. The correction then moves interior points toward the distance-proportional chord between their immediate neighbors while preserving the first and last coordinates exactly.
- Work is O(n) in stroke sample count with a hard maximum of four smoothing passes. No iterative convergence loop or unbounded release-time refinement is allowed.
- Canonical raw `PaintStrokeSampleV1` history remains untouched. The final primitive dabs are regenerated once from the corrected geometry using the brush configuration and random seed captured at stroke start, then passed through the existing release reconciliation/finalization path.
- This explicit opt-in release rebuild does not authorize whole-stroke replay during normal active presentation. M6A-PERF retained-tile/incremental rules remain authoritative for the hot path.
- The parameter is independently exposed in Brush Properties as post-stroke correction strength.""",
)

print('M6A-034 post-stroke correction patch applied')