from pathlib import Path


def read(path: str) -> str:
    return Path(path).read_text(encoding='utf-8')


def write(path: str, content: str) -> None:
    Path(path).write_text(content, encoding='utf-8')


def replace_once(path: str, before: str, after: str) -> None:
    source = read(path)
    count = source.count(before)
    if count != 1:
        raise RuntimeError(f'{path}: expected exactly one replacement, found {count}: {before[:160]!r}')
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


# Domain: start-side stroke envelope. 0 px preserves legacy immediate-start behavior.
insert_before(
    'src/domain/brush-schema.ts',
    'export type BrushTipSelectionModeV1 =',
    """export const DEFAULT_BRUSH_STROKE_START_LENGTH_PX_V1 = 0 as const;
export const MAX_BRUSH_STROKE_START_LENGTH_PX_V1 = 4096 as const;

export function brushStrokeStartLengthPxV1(preset: BrushPresetV1): number {
  const value = preset.stroke.startLengthPx;
  return typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= MAX_BRUSH_STROKE_START_LENGTH_PX_V1
    ? value
    : DEFAULT_BRUSH_STROKE_START_LENGTH_PX_V1;
}

export function withBrushStrokeStartLengthPxV1(
  preset: BrushPresetV1,
  lengthPx: number,
): BrushPresetV1 {
  if (
    !Number.isFinite(lengthPx) ||
    lengthPx < 0 ||
    lengthPx > MAX_BRUSH_STROKE_START_LENGTH_PX_V1
  ) {
    throw new RangeError('brush stroke start length must be within 0..4096 px');
  }
  return normalizeBrushPresetV1({
    ...preset,
    stroke: { ...preset.stroke, startLengthPx: lengthPx },
  });
}""",
)

# Low-level incremental kernel: resolve the start envelope into ordinary primitive dab radius/opacity.
replace_once(
    'src/gpu/baseline-brush.ts',
    """export const BASELINE_BRUSH_SPACING_RATIO = 0.25 as const;
export const BASELINE_BRUSH_MINIMUM_STAMP_DISTANCE_PX = 1 as const;
export const BASELINE_BRUSH_OPACITY = 1 as const;
""",
    """export const BASELINE_BRUSH_SPACING_RATIO = 0.25 as const;
export const BASELINE_BRUSH_MINIMUM_STAMP_DISTANCE_PX = 1 as const;
export const BASELINE_BRUSH_START_TAPER_LENGTH_PX = 0 as const;
export const BASELINE_BRUSH_OPACITY = 1 as const;
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """  readonly #spacing: number;
  readonly #flow: number;
""",
    """  readonly #spacing: number;
  readonly #startTaperLengthPx: number;
  readonly #flow: number;
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """  #logicalStampIndex = 0;
  #lastPoint: { x: number; y: number } | null = null;
""",
    """  #logicalStampIndex = 0;
  #pathDistancePx = 0;
  #lastPoint: { x: number; y: number } | null = null;
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """      readonly spacingRatio?: number;
      readonly minimumStampDistancePx?: number;
      readonly hardness?: number;
""",
    """      readonly spacingRatio?: number;
      readonly minimumStampDistancePx?: number;
      readonly startTaperLengthPx?: number;
      readonly hardness?: number;
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """    const minimumStampDistancePx =
      options.minimumStampDistancePx ?? BASELINE_BRUSH_MINIMUM_STAMP_DISTANCE_PX;
    const hardness = options.hardness ?? BASELINE_BRUSH_HARDNESS;
""",
    """    const minimumStampDistancePx =
      options.minimumStampDistancePx ?? BASELINE_BRUSH_MINIMUM_STAMP_DISTANCE_PX;
    const startTaperLengthPx =
      options.startTaperLengthPx ?? BASELINE_BRUSH_START_TAPER_LENGTH_PX;
    const hardness = options.hardness ?? BASELINE_BRUSH_HARDNESS;
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """    if (
      !Number.isFinite(minimumStampDistancePx) ||
      minimumStampDistancePx <= 0 ||
      minimumStampDistancePx > 4096
    ) {
      throw new RangeError('baseline brush minimum stamp distance must be within 0..4096 px');
    }
    if (!Number.isFinite(hardness) || hardness < 0 || hardness > 1) {
""",
    """    if (
      !Number.isFinite(minimumStampDistancePx) ||
      minimumStampDistancePx <= 0 ||
      minimumStampDistancePx > 4096
    ) {
      throw new RangeError('baseline brush minimum stamp distance must be within 0..4096 px');
    }
    if (!Number.isFinite(startTaperLengthPx) || startTaperLengthPx < 0 || startTaperLengthPx > 4096) {
      throw new RangeError('baseline brush start taper length must be within 0..4096 px');
    }
    if (!Number.isFinite(hardness) || hardness < 0 || hardness > 1) {
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """    this.#radius = sizePx / 2;
    this.#spacing = Math.max(minimumStampDistancePx, sizePx * spacingRatio);
    this.#flow = flow;
""",
    """    this.#radius = sizePx / 2;
    this.#spacing = Math.max(minimumStampDistancePx, sizePx * spacingRatio);
    this.#startTaperLengthPx = startTaperLengthPx;
    this.#flow = flow;
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """    this.#pushLogicalStamp(sample.documentX, sample.documentY, this.#resolvedTipAngleDegrees());
""",
    """    this.#pushLogicalStamp(
      sample.documentX,
      sample.documentY,
      this.#resolvedTipAngleDegrees(),
      0,
    );
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """        this.#pushLogicalStamp(
          lastPoint.x,
          lastPoint.y,
          this.#resolvedTipAngleDegrees(this.#lastStrokeDirectionDegrees ?? undefined),
        );
""",
    """        this.#pushLogicalStamp(
          lastPoint.x,
          lastPoint.y,
          this.#resolvedTipAngleDegrees(this.#lastStrokeDirectionDegrees ?? undefined),
          this.#pathDistancePx,
        );
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """  #pushLogicalStamp(x: number, y: number, tipAngleDegrees: number): void {
    pushBaselineBrushStampV1(
      this.#dabs,
      x,
      y,
      this.#radius,
      this.#flow,
      this.#strokeOpacity,
      this.#hardness,
      this.#tipDensity,
      tipAngleDegrees,
      this.#color,
      this.#tipShape,
      this.#sampledTipAlphaForLogicalStamp(),
    );
    this.#logicalStampIndex += 1;
  }
""",
    """  #startEnvelopeAtDistance(pathDistancePx: number): number {
    if (this.#startTaperLengthPx <= 0) return 1;
    return Math.max(0, Math.min(1, pathDistancePx / this.#startTaperLengthPx));
  }

  #pushLogicalStamp(
    x: number,
    y: number,
    tipAngleDegrees: number,
    pathDistancePx: number,
  ): void {
    const startEnvelope = this.#startEnvelopeAtDistance(pathDistancePx);
    if (startEnvelope <= 0) return;
    pushBaselineBrushStampV1(
      this.#dabs,
      x,
      y,
      this.#radius * startEnvelope,
      this.#flow,
      this.#strokeOpacity * startEnvelope,
      this.#hardness,
      this.#tipDensity,
      tipAngleDegrees,
      this.#color,
      this.#tipShape,
      this.#sampledTipAlphaForLogicalStamp(),
    );
    this.#logicalStampIndex += 1;
  }
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """    let cursorX = lastPoint.x;
    let cursorY = lastPoint.y;
    let remaining = Math.hypot(x - cursorX, y - cursorY);
    if (remaining > 0) {
""",
    """    let cursorX = lastPoint.x;
    let cursorY = lastPoint.y;
    const segmentLength = Math.hypot(x - cursorX, y - cursorY);
    let remaining = segmentLength;
    let segmentAdvancedPx = 0;
    if (remaining > 0) {
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """    while (remaining + 1e-9 >= this.#distanceUntilNext && remaining > 0) {
      const ratio = this.#distanceUntilNext / remaining;
      cursorX += (x - cursorX) * ratio;
      cursorY += (y - cursorY) * ratio;
      this.#pushLogicalStamp(
        cursorX,
        cursorY,
        this.#resolvedTipAngleDegrees(this.#lastStrokeDirectionDegrees ?? undefined),
      );
      this.#lastStampPoint = { x: cursorX, y: cursorY };
      remaining = Math.hypot(x - cursorX, y - cursorY);
      this.#distanceUntilNext = this.#spacing;
    }

    if (remaining > 0) this.#distanceUntilNext -= remaining;
    this.#lastPoint = { x, y };
""",
    """    while (remaining + 1e-9 >= this.#distanceUntilNext && remaining > 0) {
      const stepDistancePx = this.#distanceUntilNext;
      const ratio = stepDistancePx / remaining;
      cursorX += (x - cursorX) * ratio;
      cursorY += (y - cursorY) * ratio;
      segmentAdvancedPx += stepDistancePx;
      this.#pushLogicalStamp(
        cursorX,
        cursorY,
        this.#resolvedTipAngleDegrees(this.#lastStrokeDirectionDegrees ?? undefined),
        this.#pathDistancePx + segmentAdvancedPx,
      );
      this.#lastStampPoint = { x: cursorX, y: cursorY };
      remaining = Math.hypot(x - cursorX, y - cursorY);
      this.#distanceUntilNext = this.#spacing;
    }

    if (remaining > 0) this.#distanceUntilNext -= remaining;
    this.#pathDistancePx += segmentLength;
    this.#lastPoint = { x, y };
""",
)

# Canonical brush facade forwards start-side behavior into the existing kernel.
replace_once(
    'src/app/canonical-raster-brush.ts',
    """      readonly spacingRatio?: number;
      readonly minimumStampDistancePx?: number;
      readonly hardness?: number;
""",
    """      readonly spacingRatio?: number;
      readonly minimumStampDistancePx?: number;
      readonly startTaperLengthPx?: number;
      readonly hardness?: number;
""",
)
replace_once(
    'src/app/canonical-raster-brush.ts',
    """      ...(options.minimumStampDistancePx === undefined
        ? {}
        : { minimumStampDistancePx: options.minimumStampDistancePx }),
      ...(options.hardness === undefined ? {} : { hardness: options.hardness }),
""",
    """      ...(options.minimumStampDistancePx === undefined
        ? {}
        : { minimumStampDistancePx: options.minimumStampDistancePx }),
      ...(options.startTaperLengthPx === undefined
        ? {}
        : { startTaperLengthPx: options.startTaperLengthPx }),
      ...(options.hardness === undefined ? {} : { hardness: options.hardness }),
""",
)

# Paint session captures start behavior once at stroke begin.
replace_once(
    'src/app/paint-session-controller.ts',
    """  BASELINE_BRUSH_MINIMUM_STAMP_DISTANCE_PX,
  BASELINE_BRUSH_SPACING_RATIO,
  BASELINE_BRUSH_TIP_DENSITY,
""",
    """  BASELINE_BRUSH_MINIMUM_STAMP_DISTANCE_PX,
  BASELINE_BRUSH_SPACING_RATIO,
  BASELINE_BRUSH_START_TAPER_LENGTH_PX,
  BASELINE_BRUSH_TIP_DENSITY,
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """  readonly brushMinimumStampDistancePx: number;
  readonly brushTipAngleDegrees: number;
""",
    """  readonly brushMinimumStampDistancePx: number;
  readonly brushStartTaperLengthPx: number;
  readonly brushTipAngleDegrees: number;
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """  #brushSpacingRatio: number = BASELINE_BRUSH_SPACING_RATIO;
  #brushMinimumStampDistancePx: number = BASELINE_BRUSH_MINIMUM_STAMP_DISTANCE_PX;
  #brushTipAngleDegrees: number = BASELINE_BRUSH_TIP_ANGLE_DEGREES;
""",
    """  #brushSpacingRatio: number = BASELINE_BRUSH_SPACING_RATIO;
  #brushMinimumStampDistancePx: number = BASELINE_BRUSH_MINIMUM_STAMP_DISTANCE_PX;
  #brushStartTaperLengthPx: number = BASELINE_BRUSH_START_TAPER_LENGTH_PX;
  #brushTipAngleDegrees: number = BASELINE_BRUSH_TIP_ANGLE_DEGREES;
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """      brushSpacingRatio: this.#brushSpacingRatio,
      brushMinimumStampDistancePx: this.#brushMinimumStampDistancePx,
      brushTipAngleDegrees: this.#brushTipAngleDegrees,
""",
    """      brushSpacingRatio: this.#brushSpacingRatio,
      brushMinimumStampDistancePx: this.#brushMinimumStampDistancePx,
      brushStartTaperLengthPx: this.#brushStartTaperLengthPx,
      brushTipAngleDegrees: this.#brushTipAngleDegrees,
""",
)
insert_before(
    'src/app/paint-session-controller.ts',
    '  setBrushTipAngleDegrees(angleDegrees: number): number {',
    """  setBrushStartTaperLengthPx(lengthPx: number): number {
    if (!Number.isFinite(lengthPx) || lengthPx < 0 || lengthPx > 4096) {
      throw new RangeError('invalid runtime brush start taper length');
    }
    if (lengthPx !== this.#brushStartTaperLengthPx) this.#clearActiveStroke();
    this.#brushStartTaperLengthPx = lengthPx;
    return this.#brushStartTaperLengthPx;
  }

  brushStartTaperLengthPx(): number {
    return this.#brushStartTaperLengthPx;
  }""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """      spacingRatio: this.#brushSpacingRatio,
      minimumStampDistancePx: this.#brushMinimumStampDistancePx,
      hardness: this.#brushHardness,
""",
    """      spacingRatio: this.#brushSpacingRatio,
      minimumStampDistancePx: this.#brushMinimumStampDistancePx,
      startTaperLengthPx: this.#brushStartTaperLengthPx,
      hardness: this.#brushHardness,
""",
)

# Preset library mutation.
replace_once(
    'src/app/brush-preset-library.ts',
    """  withBrushTipSelectionModeV1,
  withBrushStrokeSpacingV1,
""",
    """  withBrushTipSelectionModeV1,
  withBrushStrokeStartLengthPxV1,
  withBrushStrokeSpacingV1,
""",
)
insert_before(
    'src/app/brush-preset-library.ts',
    'export function updateBrushPresetCustomTipV1(',
    """export function updateBrushPresetStartLengthV1(
  state: BrushPresetLibraryStateV1,
  presetId: string,
  lengthPx: number,
): BrushPresetLibraryStateV1 {
  return updateItemV1(state, presetId, (item) => {
    if (item.locked) throw new Error('locked brush preset cannot be edited');
    const current = withBrushStrokeStartLengthPxV1(item.preset, lengthPx);
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

# Reachable Inspector control; 0 px is explicit OFF.
replace_once(
    'src/app/brush-preset-controller.ts',
    """  brushTipSelectionModeV1,
  brushStrokeSpacingV1,
""",
    """  brushTipSelectionModeV1,
  brushStrokeStartLengthPxV1,
  brushStrokeSpacingV1,
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  updateBrushPresetTipSelectionModeV1,
  updateBrushPresetSpacingV1,
""",
    """  updateBrushPresetTipSelectionModeV1,
  updateBrushPresetStartLengthV1,
  updateBrushPresetSpacingV1,
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  const tipRepeatMode = requireElement('#brush-tip-repeat-mode', HTMLSelectElement);
  const tipShape = requireElement('#brush-tip-shape', HTMLSelectElement);
""",
    """  const tipRepeatMode = requireElement('#brush-tip-repeat-mode', HTMLSelectElement);
  const startLengthRange = requireElement('#brush-start-length-range', HTMLInputElement);
  const startLengthNumber = requireElement('#brush-start-length-number', HTMLInputElement);
  const tipShape = requireElement('#brush-tip-shape', HTMLSelectElement);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    input.paintSession.setBrushFollowStrokeRotation(brushFollowStrokeRotationV1(item.preset));
    const tipAssets = brushTipAssetsV1(item.preset);
""",
    """    input.paintSession.setBrushFollowStrokeRotation(brushFollowStrokeRotationV1(item.preset));
    const startLengthPx = brushStrokeStartLengthPxV1(item.preset);
    input.paintSession.setBrushStartTaperLengthPx(startLengthPx);
    const tipAssets = brushTipAssetsV1(item.preset);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    input.root.dataset.illustroBrushTipSelectionMode = brushTipSelectionModeV1(item.preset);
    input.root.dataset.illustroBrushTipShape = brushTipShapeV1(item.preset);
""",
    """    input.root.dataset.illustroBrushTipSelectionMode = brushTipSelectionModeV1(item.preset);
    input.root.dataset.illustroBrushStartLengthPx = String(startLengthPx);
    input.root.dataset.illustroBrushTipShape = brushTipShapeV1(item.preset);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    const tipSelectionMode = brushTipSelectionModeV1(selected.preset);
    tipRepeatMode.value = tipSelectionMode;
    tipShape.value = brushTipShapeV1(selected.preset);
""",
    """    const tipSelectionMode = brushTipSelectionModeV1(selected.preset);
    tipRepeatMode.value = tipSelectionMode;
    const startLengthPx = brushStrokeStartLengthPxV1(selected.preset);
    configurePair(startLengthRange, startLengthNumber, 0, 4096, 1, startLengthPx);
    tipShape.value = brushTipShapeV1(selected.preset);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    propertyStatus.textContent = `${parameters.sizePx.toFixed(1)} px · ${Math.round(parameters.opacity * 100)}% · ${Math.round(parameters.flow * 100)}% · H${Math.round(hardness * 100)}% · D${Math.round(tipDensity * 100)}% · S${Math.round(spacing.spacingRatio * 100)}% · A${Math.round(tipAngleDegrees)}° · F${Math.round(tipDirectionDegrees)}°${followRotation ? ' · Follow' : ''}${repeatLabel}`;
""",
    """    const startLabel = startLengthPx > 0 ? ` · In${Math.round(startLengthPx)}px` : '';
    propertyStatus.textContent = `${parameters.sizePx.toFixed(1)} px · ${Math.round(parameters.opacity * 100)}% · ${Math.round(parameters.flow * 100)}% · H${Math.round(hardness * 100)}% · D${Math.round(tipDensity * 100)}% · S${Math.round(spacing.spacingRatio * 100)}% · A${Math.round(tipAngleDegrees)}° · F${Math.round(tipDirectionDegrees)}°${followRotation ? ' · Follow' : ''}${repeatLabel}${startLabel}`;
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """      followRotationButton,
      tipRepeatMode,
      tipShape,
""",
    """      followRotationButton,
      tipRepeatMode,
      startLengthRange,
      startLengthNumber,
      tipShape,
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  const onTipRepeatMode = (): void => {
    const mode: BrushTipSelectionModeV1 =
      tipRepeatMode.value === 'sequence'
        ? 'sequence'
        : tipRepeatMode.value === 'random-per-stamp'
          ? 'random-per-stamp'
          : 'fixed';
    mutate(() => updateBrushPresetTipSelectionModeV1(state, state.selectedPresetId, mode));
  };
  const onTipShape = (): void => {
""",
    """  const onTipRepeatMode = (): void => {
    const mode: BrushTipSelectionModeV1 =
      tipRepeatMode.value === 'sequence'
        ? 'sequence'
        : tipRepeatMode.value === 'random-per-stamp'
          ? 'random-per-stamp'
          : 'fixed';
    mutate(() => updateBrushPresetTipSelectionModeV1(state, state.selectedPresetId, mode));
  };
  const updateStartLength = (lengthPx: number): void =>
    mutate(() => updateBrushPresetStartLengthV1(state, state.selectedPresetId, lengthPx));
  const onStartLengthRange = (): void => updateStartLength(Number(startLengthRange.value));
  const onStartLengthNumber = (): void => updateStartLength(Number(startLengthNumber.value));
  const onTipShape = (): void => {
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  tipRepeatMode.addEventListener('change', onTipRepeatMode);
  tipShape.addEventListener('change', onTipShape);
""",
    """  tipRepeatMode.addEventListener('change', onTipRepeatMode);
  startLengthRange.addEventListener('input', onStartLengthRange);
  startLengthNumber.addEventListener('change', onStartLengthNumber);
  tipShape.addEventListener('change', onTipShape);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """      tipRepeatMode.removeEventListener('change', onTipRepeatMode);
      tipShape.removeEventListener('change', onTipShape);
""",
    """      tipRepeatMode.removeEventListener('change', onTipRepeatMode);
      startLengthRange.removeEventListener('input', onStartLengthRange);
      startLengthNumber.removeEventListener('change', onStartLengthNumber);
      tipShape.removeEventListener('change', onTipShape);
""",
)

replace_once(
    'src/index.html',
    """              <div class="shell-brush-property-row shell-brush-tip-property-row">
                <label for="brush-tip-shape">ブラシ形状</label>
""",
    """              <div class="shell-brush-property-row">
                <label for="brush-start-length-range">入り長さ</label>
                <input id="brush-start-length-range" type="range" min="0" max="4096" step="1" value="0" />
                <span class="shell-brush-property-number"><input id="brush-start-length-number" type="number" inputmode="numeric" min="0" max="4096" step="1" value="0" aria-label="ストローク入り長さ" /><span>px</span></span>
              </div>
              <div class="shell-brush-property-row shell-brush-tip-property-row">
                <label for="brush-tip-shape">ブラシ形状</label>
""",
)

write_new(
    'tests/unit/brush-stroke-start.test.ts',
    """import { describe, expect, it } from 'vitest';
import {
  brushStrokeStartLengthPxV1,
  createBaselineBrushPresetV1,
  withBrushStrokeStartLengthPxV1,
} from '../../src/domain/brush-schema.js';
import { BaselineBrushDabBuilderV1 } from '../../src/gpu/baseline-brush.js';

describe('M6A-028 stroke-start behavior', () => {
  it('preserves immediate legacy starts and validates a preset-local start length', () => {
    const preset = createBaselineBrushPresetV1({
      id: 'start.paint',
      name: 'Start',
      category: 'Test',
      behavior: 'paint',
    });
    expect(brushStrokeStartLengthPxV1(preset)).toBe(0);
    expect(brushStrokeStartLengthPxV1(withBrushStrokeStartLengthPxV1(preset, 48))).toBe(48);
    expect(() => withBrushStrokeStartLengthPxV1(preset, -1)).toThrow(RangeError);
  });

  it('applies the start envelope from cumulative stroke distance without rewriting prior dabs', () => {
    const builder = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      opacity: 1,
      flow: 1,
      spacingRatio: 0.5,
      startTaperLengthPx: 20,
      tipShape: 'round',
    });
    expect(builder.beginDelta({ documentX: 0, documentY: 0 })).toEqual([]);
    const firstDelta = builder.appendDelta([{ documentX: 10, documentY: 0 }]);
    expect(firstDelta).toHaveLength(1);
    expect(firstDelta[0]?.x).toBeCloseTo(10, 6);
    expect(firstDelta[0]?.radius).toBeCloseTo(5, 6);
    expect(firstDelta[0]?.strokeOpacity).toBeCloseTo(0.5, 6);
    const stableFirst = firstDelta[0];
    const secondDelta = builder.appendDelta([{ documentX: 20, documentY: 0 }]);
    expect(secondDelta).toHaveLength(1);
    expect(secondDelta[0]?.radius).toBeCloseTo(10, 6);
    expect(secondDelta[0]?.strokeOpacity).toBeCloseTo(1, 6);
    expect(builder.dabs()[0]).toEqual(stableFirst);
  });

  it('resolves a short stroke endpoint against the same start envelope', () => {
    const builder = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      opacity: 0.8,
      flow: 1,
      spacingRatio: 1,
      startTaperLengthPx: 20,
    });
    builder.beginDelta({ documentX: 0, documentY: 0 });
    builder.appendDelta([{ documentX: 5, documentY: 0 }]);
    const finishDelta = builder.finishDelta();
    expect(finishDelta).toHaveLength(1);
    expect(finishDelta[0]?.radius).toBeCloseTo(2.5, 6);
    expect(finishDelta[0]?.strokeOpacity).toBeCloseTo(0.2, 6);
  });

  it('keeps the first visible repeated tip asset as the sequence anchor', () => {
    const top = Object.freeze(Array.from({ length: 25 }, (_, index) => (index === 2 ? 255 : 0)));
    const right = Object.freeze(Array.from({ length: 25 }, (_, index) => (index === 14 ? 255 : 0)));
    const builder = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      spacingRatio: 0.5,
      startTaperLengthPx: 20,
      tipShape: 'sampled-image',
      sampledTipAlphas: [top, right],
      tipSelectionMode: 'sequence',
    });
    builder.beginDelta({ documentX: 0, documentY: 0 });
    const firstVisible = builder.appendDelta([{ documentX: 10, documentY: 0 }]);
    expect(firstVisible).toHaveLength(1);
    expect(firstVisible[0]?.x).toBeCloseTo(10, 6);
    expect(firstVisible[0]?.y).toBeCloseTo(6, 6);
  });
});""",
)

replace_once(
    'IMPLEMENTATION_PROGRESS.md',
    """M6A-028 stroke-start behavior:未完了
M6A-029 stroke-end behavior:未完了
""",
    """M6A-028 stroke-start behavior:完了
再開メモ: M6A-028 stroke-start behaviorはstroke.startLengthPxを0..4096 document pxで保持し、0は従来どおり即時開始とする。startLengthPx>0では開始からの累積path distanceに対する線形envelopeを各新規logical stamp生成時だけ計算し、現段階ではradiusとstrokeOpacityを0→baseへ同率で解決して既存primitive dabへ焼き込む。開始点0% stampは出力せずtip repetition indexも消費しない。確定済みdabを後から変更しないためstable-prefixを維持する。M6A-030/031ではこの共通envelopeに対するsize/opacity各々の最小比率・強度を独立設定へ拡張する。次はM6A-029 stroke-end behaviorから再開する。
M6A-029 stroke-end behavior:未完了
""",
)
append_once(
    'ILLUSTRO_DESIGN_MEMO.md',
    'M6A stroke-start boundary — 2026-09-03',
    """#### M6A stroke-start boundary — 2026-09-03

- M6A-028 stores start-side stroke behavior as `stroke.startLengthPx` in document-space pixels. `0` is the compatibility/default mode and preserves the immediate-start behavior of older presets.
- A positive start length produces a linear start envelope from `0` at path distance `0` to `1` at `startLengthPx`. The envelope is computed only when a new logical stamp is emitted from confirmed input; already-emitted stable-prefix dabs are never revisited.
- At this stage the common start envelope resolves into both primitive-dab radius and stroke opacity so the behavior is production-visible rather than UI-only. M6A-030 size taper and M6A-031 opacity taper own the later independent minimum/strength controls and may replace the current fixed zero minima without changing start-distance tracking.
- The zero-strength start stamp is omitted instead of creating an invalid zero-radius dab, and it does not consume the M6A-027 sequence/random tip-selection index. The first visible repeated tip therefore remains anchored to the selected asset.
- The runtime persists only the resolved primitive dabs. No new Worker/history dab field is needed, and Main/Worker/canonical raster paths remain compatible.
- End-side behavior is intentionally not inferred from current stroke length. M6A-029 must preserve the incremental-rendering invariant and must not silently rewrite already-presented stable-prefix dabs.""",
)

insert_before(
    'scripts/verify-m6a-brush.mjs',
    """requireText(
  progress,
  'M6A-PERF-001 incremental active-stroke rendering（stable prefix + bounded mutable tail）:未完了',
""",
    """requireText(progress, 'M6A-028 stroke-start behavior:完了', 'M6A-028 progress is not complete');
requireText(
  read('src/domain/brush-schema.ts'),
  'brushStrokeStartLengthPxV1',
  'stroke-start preset helper missing',
);
requireText(
  read('src/gpu/baseline-brush.ts'),
  '#startEnvelopeAtDistance',
  'incremental stroke-start envelope missing',
);
requireText(
  read('src/app/paint-session-controller.ts'),
  'startTaperLengthPx: this.#brushStartTaperLengthPx',
  'stroke-start behavior is not captured by the paint session',
);
requireText(
  read('src/index.html'),
  'id=\"brush-start-length-range\"',
  'reachable stroke-start control missing',
);
requireText(
  read('tests/unit/brush-stroke-start.test.ts'),
  'without rewriting prior dabs',
  'stroke-start regression coverage missing',
);""",
)

print('M6A-028 stroke-start patch applied')