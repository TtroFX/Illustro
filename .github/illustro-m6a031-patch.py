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


# Domain: opacity/deposit taper minimum remains separate from whole-stroke opacity cap.
insert_before(
    'src/domain/brush-schema.ts',
    'export type BrushTipSelectionModeV1 =',
    """export const DEFAULT_BRUSH_OPACITY_TAPER_MINIMUM_RATIO_V1 = 0 as const;

export function brushOpacityTaperMinimumRatioV1(preset: BrushPresetV1): number {
  const value = preset.stroke.opacityTaperMinimumRatio;
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1
    ? value
    : DEFAULT_BRUSH_OPACITY_TAPER_MINIMUM_RATIO_V1;
}

export function withBrushOpacityTaperMinimumRatioV1(
  preset: BrushPresetV1,
  minimumRatio: number,
): BrushPresetV1 {
  if (!Number.isFinite(minimumRatio) || minimumRatio < 0 || minimumRatio > 1) {
    throw new RangeError('brush opacity taper minimum ratio must be within 0..1');
  }
  return normalizeBrushPresetV1({
    ...preset,
    stroke: { ...preset.stroke, opacityTaperMinimumRatio: minimumRatio },
  });
}""",
)

# Kernel: independently resolve size scale and per-dab deposit scale from the same envelope.
replace_once(
    'src/gpu/baseline-brush.ts',
    """export const BASELINE_BRUSH_SIZE_TAPER_MINIMUM_RATIO = 0 as const;
export const BASELINE_BRUSH_OPACITY = 1 as const;
""",
    """export const BASELINE_BRUSH_SIZE_TAPER_MINIMUM_RATIO = 0 as const;
export const BASELINE_BRUSH_OPACITY_TAPER_MINIMUM_RATIO = 0 as const;
export const BASELINE_BRUSH_OPACITY = 1 as const;
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """  readonly #endTaperLengthPx: number;
  readonly #sizeTaperMinimumRatio: number;
  readonly #flow: number;
""",
    """  readonly #endTaperLengthPx: number;
  readonly #sizeTaperMinimumRatio: number;
  readonly #opacityTaperMinimumRatio: number;
  readonly #flow: number;
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """      readonly endTaperLengthPx?: number;
      readonly sizeTaperMinimumRatio?: number;
      readonly hardness?: number;
""",
    """      readonly endTaperLengthPx?: number;
      readonly sizeTaperMinimumRatio?: number;
      readonly opacityTaperMinimumRatio?: number;
      readonly hardness?: number;
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """    const sizeTaperMinimumRatio =
      options.sizeTaperMinimumRatio ?? BASELINE_BRUSH_SIZE_TAPER_MINIMUM_RATIO;
    const hardness = options.hardness ?? BASELINE_BRUSH_HARDNESS;
""",
    """    const sizeTaperMinimumRatio =
      options.sizeTaperMinimumRatio ?? BASELINE_BRUSH_SIZE_TAPER_MINIMUM_RATIO;
    const opacityTaperMinimumRatio =
      options.opacityTaperMinimumRatio ?? BASELINE_BRUSH_OPACITY_TAPER_MINIMUM_RATIO;
    const hardness = options.hardness ?? BASELINE_BRUSH_HARDNESS;
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """    if (
      !Number.isFinite(sizeTaperMinimumRatio) ||
      sizeTaperMinimumRatio < 0 ||
      sizeTaperMinimumRatio > 1
    ) {
      throw new RangeError('baseline brush size taper minimum ratio must be within 0..1');
    }
    if (!Number.isFinite(hardness) || hardness < 0 || hardness > 1) {
""",
    """    if (
      !Number.isFinite(sizeTaperMinimumRatio) ||
      sizeTaperMinimumRatio < 0 ||
      sizeTaperMinimumRatio > 1
    ) {
      throw new RangeError('baseline brush size taper minimum ratio must be within 0..1');
    }
    if (
      !Number.isFinite(opacityTaperMinimumRatio) ||
      opacityTaperMinimumRatio < 0 ||
      opacityTaperMinimumRatio > 1
    ) {
      throw new RangeError('baseline brush opacity taper minimum ratio must be within 0..1');
    }
    if (!Number.isFinite(hardness) || hardness < 0 || hardness > 1) {
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """    this.#endTaperLengthPx = endTaperLengthPx;
    this.#sizeTaperMinimumRatio = sizeTaperMinimumRatio;
    this.#flow = flow;
""",
    """    this.#endTaperLengthPx = endTaperLengthPx;
    this.#sizeTaperMinimumRatio = sizeTaperMinimumRatio;
    this.#opacityTaperMinimumRatio = opacityTaperMinimumRatio;
    this.#flow = flow;
""",
)
insert_before(
    'src/gpu/baseline-brush.ts',
    '  #emitLogicalStamp(\n',
    """  #opacityTaperScale(envelope: number): number {
    return this.#opacityTaperMinimumRatio + (1 - this.#opacityTaperMinimumRatio) * envelope;
  }""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """  ): void {
    if (envelope <= 0) return;
    const sizeScale = this.#sizeTaperScale(envelope);
    pushBaselineBrushStampV1(
      target,
      stamp.x,
      stamp.y,
      this.#radius * sizeScale,
      this.#flow * envelope,
""",
    """  ): void {
    const sizeScale = this.#sizeTaperScale(envelope);
    const opacityScale = this.#opacityTaperScale(envelope);
    if (sizeScale <= 0 || opacityScale <= 0) return;
    pushBaselineBrushStampV1(
      target,
      stamp.x,
      stamp.y,
      this.#radius * sizeScale,
      this.#flow * opacityScale,
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """  #pushLogicalStamp(x: number, y: number, tipAngleDegrees: number, pathDistancePx: number): void {
    const startEnvelope = this.#startEnvelopeAtDistance(pathDistancePx);
    if (startEnvelope <= 0) return;
    const sampledTipAlpha = this.#sampledTipAlphaForLogicalStamp();
""",
    """  #pushLogicalStamp(x: number, y: number, tipAngleDegrees: number, pathDistancePx: number): void {
    const startEnvelope = this.#startEnvelopeAtDistance(pathDistancePx);
    const sampledTipAlpha = this.#sampledTipAlphaForLogicalStamp();
""",
)

# Canonical facade forwards the opacity taper minimum.
replace_once(
    'src/app/canonical-raster-brush.ts',
    """      readonly endTaperLengthPx?: number;
      readonly sizeTaperMinimumRatio?: number;
      readonly hardness?: number;
""",
    """      readonly endTaperLengthPx?: number;
      readonly sizeTaperMinimumRatio?: number;
      readonly opacityTaperMinimumRatio?: number;
      readonly hardness?: number;
""",
)
replace_once(
    'src/app/canonical-raster-brush.ts',
    """      ...(options.sizeTaperMinimumRatio === undefined
        ? {}
        : { sizeTaperMinimumRatio: options.sizeTaperMinimumRatio }),
      ...(options.hardness === undefined ? {} : { hardness: options.hardness }),
""",
    """      ...(options.sizeTaperMinimumRatio === undefined
        ? {}
        : { sizeTaperMinimumRatio: options.sizeTaperMinimumRatio }),
      ...(options.opacityTaperMinimumRatio === undefined
        ? {}
        : { opacityTaperMinimumRatio: options.opacityTaperMinimumRatio }),
      ...(options.hardness === undefined ? {} : { hardness: options.hardness }),
""",
)

# Paint session captures the editable opacity taper minimum at stroke start.
replace_once(
    'src/app/paint-session-controller.ts',
    """  BASELINE_BRUSH_SIZE_TAPER_MINIMUM_RATIO,
  BASELINE_BRUSH_TIP_DENSITY,
""",
    """  BASELINE_BRUSH_SIZE_TAPER_MINIMUM_RATIO,
  BASELINE_BRUSH_OPACITY_TAPER_MINIMUM_RATIO,
  BASELINE_BRUSH_TIP_DENSITY,
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """  readonly brushEndTaperLengthPx: number;
  readonly brushSizeTaperMinimumRatio: number;
  readonly brushTipAngleDegrees: number;
""",
    """  readonly brushEndTaperLengthPx: number;
  readonly brushSizeTaperMinimumRatio: number;
  readonly brushOpacityTaperMinimumRatio: number;
  readonly brushTipAngleDegrees: number;
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """  #brushEndTaperLengthPx: number = BASELINE_BRUSH_END_TAPER_LENGTH_PX;
  #brushSizeTaperMinimumRatio: number = BASELINE_BRUSH_SIZE_TAPER_MINIMUM_RATIO;
  #brushTipAngleDegrees: number = BASELINE_BRUSH_TIP_ANGLE_DEGREES;
""",
    """  #brushEndTaperLengthPx: number = BASELINE_BRUSH_END_TAPER_LENGTH_PX;
  #brushSizeTaperMinimumRatio: number = BASELINE_BRUSH_SIZE_TAPER_MINIMUM_RATIO;
  #brushOpacityTaperMinimumRatio: number = BASELINE_BRUSH_OPACITY_TAPER_MINIMUM_RATIO;
  #brushTipAngleDegrees: number = BASELINE_BRUSH_TIP_ANGLE_DEGREES;
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """      brushEndTaperLengthPx: this.#brushEndTaperLengthPx,
      brushSizeTaperMinimumRatio: this.#brushSizeTaperMinimumRatio,
      brushTipAngleDegrees: this.#brushTipAngleDegrees,
""",
    """      brushEndTaperLengthPx: this.#brushEndTaperLengthPx,
      brushSizeTaperMinimumRatio: this.#brushSizeTaperMinimumRatio,
      brushOpacityTaperMinimumRatio: this.#brushOpacityTaperMinimumRatio,
      brushTipAngleDegrees: this.#brushTipAngleDegrees,
""",
)
insert_before(
    'src/app/paint-session-controller.ts',
    '  setBrushTipAngleDegrees(angleDegrees: number): number {\n',
    """  setBrushOpacityTaperMinimumRatio(minimumRatio: number): number {
    if (!Number.isFinite(minimumRatio) || minimumRatio < 0 || minimumRatio > 1) {
      throw new RangeError('invalid runtime brush opacity taper minimum ratio');
    }
    if (minimumRatio !== this.#brushOpacityTaperMinimumRatio) this.#clearActiveStroke();
    this.#brushOpacityTaperMinimumRatio = minimumRatio;
    return this.#brushOpacityTaperMinimumRatio;
  }

  brushOpacityTaperMinimumRatio(): number {
    return this.#brushOpacityTaperMinimumRatio;
  }""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """      endTaperLengthPx: this.#brushEndTaperLengthPx,
      sizeTaperMinimumRatio: this.#brushSizeTaperMinimumRatio,
      hardness: this.#brushHardness,
""",
    """      endTaperLengthPx: this.#brushEndTaperLengthPx,
      sizeTaperMinimumRatio: this.#brushSizeTaperMinimumRatio,
      opacityTaperMinimumRatio: this.#brushOpacityTaperMinimumRatio,
      hardness: this.#brushHardness,
""",
)

# Preset library mutation.
replace_once(
    'src/app/brush-preset-library.ts',
    """  withBrushSizeTaperMinimumRatioV1,
  withBrushStrokeSpacingV1,
""",
    """  withBrushSizeTaperMinimumRatioV1,
  withBrushOpacityTaperMinimumRatioV1,
  withBrushStrokeSpacingV1,
""",
)
insert_before(
    'src/app/brush-preset-library.ts',
    'export function updateBrushPresetCustomTipV1(\n',
    """export function updateBrushPresetOpacityTaperV1(
  state: BrushPresetLibraryStateV1,
  presetId: string,
  minimumRatio: number,
): BrushPresetLibraryStateV1 {
  return updateItemV1(state, presetId, (item) => {
    if (item.locked) throw new Error('locked brush preset cannot be edited');
    const current = withBrushOpacityTaperMinimumRatioV1(item.preset, minimumRatio);
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

# Reachable preset UI and runtime binding.
replace_once(
    'src/app/brush-preset-controller.ts',
    """  brushStrokeEndLengthPxV1,
  brushSizeTaperMinimumRatioV1,
  brushStrokeSpacingV1,
""",
    """  brushStrokeEndLengthPxV1,
  brushSizeTaperMinimumRatioV1,
  brushOpacityTaperMinimumRatioV1,
  brushStrokeSpacingV1,
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  updateBrushPresetEndLengthV1,
  updateBrushPresetSizeTaperV1,
  updateBrushPresetSpacingV1,
""",
    """  updateBrushPresetEndLengthV1,
  updateBrushPresetSizeTaperV1,
  updateBrushPresetOpacityTaperV1,
  updateBrushPresetSpacingV1,
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  const sizeTaperRange = requireElement('#brush-size-taper-range', HTMLInputElement);
  const sizeTaperNumber = requireElement('#brush-size-taper-number', HTMLInputElement);
  const tipShape = requireElement('#brush-tip-shape', HTMLSelectElement);
""",
    """  const sizeTaperRange = requireElement('#brush-size-taper-range', HTMLInputElement);
  const sizeTaperNumber = requireElement('#brush-size-taper-number', HTMLInputElement);
  const opacityTaperRange = requireElement('#brush-opacity-taper-range', HTMLInputElement);
  const opacityTaperNumber = requireElement('#brush-opacity-taper-number', HTMLInputElement);
  const tipShape = requireElement('#brush-tip-shape', HTMLSelectElement);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    const sizeTaperMinimumRatio = brushSizeTaperMinimumRatioV1(item.preset);
    input.paintSession.setBrushSizeTaperMinimumRatio(sizeTaperMinimumRatio);
    const tipAssets = brushTipAssetsV1(item.preset);
""",
    """    const sizeTaperMinimumRatio = brushSizeTaperMinimumRatioV1(item.preset);
    input.paintSession.setBrushSizeTaperMinimumRatio(sizeTaperMinimumRatio);
    const opacityTaperMinimumRatio = brushOpacityTaperMinimumRatioV1(item.preset);
    input.paintSession.setBrushOpacityTaperMinimumRatio(opacityTaperMinimumRatio);
    const tipAssets = brushTipAssetsV1(item.preset);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    input.root.dataset.illustroBrushEndLengthPx = String(endLengthPx);
    input.root.dataset.illustroBrushSizeTaperMinimumRatio = String(sizeTaperMinimumRatio);
    input.root.dataset.illustroBrushTipShape = brushTipShapeV1(item.preset);
""",
    """    input.root.dataset.illustroBrushEndLengthPx = String(endLengthPx);
    input.root.dataset.illustroBrushSizeTaperMinimumRatio = String(sizeTaperMinimumRatio);
    input.root.dataset.illustroBrushOpacityTaperMinimumRatio = String(opacityTaperMinimumRatio);
    input.root.dataset.illustroBrushTipShape = brushTipShapeV1(item.preset);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    const sizeTaperMinimumRatio = brushSizeTaperMinimumRatioV1(selected.preset);
    configurePair(sizeTaperRange, sizeTaperNumber, 0, 100, 1, sizeTaperMinimumRatio * 100);
    tipShape.value = brushTipShapeV1(selected.preset);
""",
    """    const sizeTaperMinimumRatio = brushSizeTaperMinimumRatioV1(selected.preset);
    configurePair(sizeTaperRange, sizeTaperNumber, 0, 100, 1, sizeTaperMinimumRatio * 100);
    const opacityTaperMinimumRatio = brushOpacityTaperMinimumRatioV1(selected.preset);
    configurePair(
      opacityTaperRange,
      opacityTaperNumber,
      0,
      100,
      1,
      opacityTaperMinimumRatio * 100,
    );
    tipShape.value = brushTipShapeV1(selected.preset);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    const sizeTaperLabel =
      sizeTaperMinimumRatio > 0 ? ` · SizeMin${Math.round(sizeTaperMinimumRatio * 100)}%` : '';
    propertyStatus.textContent = `${parameters.sizePx.toFixed(1)} px · ${Math.round(parameters.opacity * 100)}% · ${Math.round(parameters.flow * 100)}% · H${Math.round(hardness * 100)}% · D${Math.round(tipDensity * 100)}% · S${Math.round(spacing.spacingRatio * 100)}% · A${Math.round(tipAngleDegrees)}° · F${Math.round(tipDirectionDegrees)}°${followRotation ? ' · Follow' : ''}${repeatLabel}${startLabel}${endLabel}${sizeTaperLabel}`;
""",
    """    const sizeTaperLabel =
      sizeTaperMinimumRatio > 0 ? ` · SizeMin${Math.round(sizeTaperMinimumRatio * 100)}%` : '';
    const opacityTaperLabel =
      opacityTaperMinimumRatio > 0
        ? ` · OpacityMin${Math.round(opacityTaperMinimumRatio * 100)}%`
        : '';
    propertyStatus.textContent = `${parameters.sizePx.toFixed(1)} px · ${Math.round(parameters.opacity * 100)}% · ${Math.round(parameters.flow * 100)}% · H${Math.round(hardness * 100)}% · D${Math.round(tipDensity * 100)}% · S${Math.round(spacing.spacingRatio * 100)}% · A${Math.round(tipAngleDegrees)}° · F${Math.round(tipDirectionDegrees)}°${followRotation ? ' · Follow' : ''}${repeatLabel}${startLabel}${endLabel}${sizeTaperLabel}${opacityTaperLabel}`;
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """      sizeTaperRange,
      sizeTaperNumber,
      tipShape,
""",
    """      sizeTaperRange,
      sizeTaperNumber,
      opacityTaperRange,
      opacityTaperNumber,
      tipShape,
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  const onSizeTaperRange = (): void => updateSizeTaper(Number(sizeTaperRange.value));
  const onSizeTaperNumber = (): void => updateSizeTaper(Number(sizeTaperNumber.value));
  const onTipShape = (): void => {
""",
    """  const onSizeTaperRange = (): void => updateSizeTaper(Number(sizeTaperRange.value));
  const onSizeTaperNumber = (): void => updateSizeTaper(Number(sizeTaperNumber.value));
  const updateOpacityTaper = (percent: number): void =>
    mutate(() => updateBrushPresetOpacityTaperV1(state, state.selectedPresetId, percent / 100));
  const onOpacityTaperRange = (): void => updateOpacityTaper(Number(opacityTaperRange.value));
  const onOpacityTaperNumber = (): void => updateOpacityTaper(Number(opacityTaperNumber.value));
  const onTipShape = (): void => {
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  sizeTaperRange.addEventListener('input', onSizeTaperRange);
  sizeTaperNumber.addEventListener('change', onSizeTaperNumber);
  tipShape.addEventListener('change', onTipShape);
""",
    """  sizeTaperRange.addEventListener('input', onSizeTaperRange);
  sizeTaperNumber.addEventListener('change', onSizeTaperNumber);
  opacityTaperRange.addEventListener('input', onOpacityTaperRange);
  opacityTaperNumber.addEventListener('change', onOpacityTaperNumber);
  tipShape.addEventListener('change', onTipShape);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """      sizeTaperRange.removeEventListener('input', onSizeTaperRange);
      sizeTaperNumber.removeEventListener('change', onSizeTaperNumber);
      tipShape.removeEventListener('change', onTipShape);
""",
    """      sizeTaperRange.removeEventListener('input', onSizeTaperRange);
      sizeTaperNumber.removeEventListener('change', onSizeTaperNumber);
      opacityTaperRange.removeEventListener('input', onOpacityTaperRange);
      opacityTaperNumber.removeEventListener('change', onOpacityTaperNumber);
      tipShape.removeEventListener('change', onTipShape);
""",
)

# UI next to size taper.
replace_once(
    'src/index.html',
    """              <div class=\"shell-brush-property-row\">
                <label for=\"brush-size-taper-range\">テーパー最小サイズ</label>
                <input id=\"brush-size-taper-range\" type=\"range\" min=\"0\" max=\"100\" step=\"1\" value=\"0\" />
                <span class=\"shell-brush-property-number shell-brush-property-percent\"><input id=\"brush-size-taper-number\" type=\"number\" inputmode=\"numeric\" min=\"0\" max=\"100\" step=\"1\" value=\"0\" aria-label=\"ストロークテーパー最小サイズ\" /><span>%</span></span>
              </div>
              <div class=\"shell-brush-property-row shell-brush-tip-property-row\">
""",
    """              <div class=\"shell-brush-property-row\">
                <label for=\"brush-size-taper-range\">テーパー最小サイズ</label>
                <input id=\"brush-size-taper-range\" type=\"range\" min=\"0\" max=\"100\" step=\"1\" value=\"0\" />
                <span class=\"shell-brush-property-number shell-brush-property-percent\"><input id=\"brush-size-taper-number\" type=\"number\" inputmode=\"numeric\" min=\"0\" max=\"100\" step=\"1\" value=\"0\" aria-label=\"ストロークテーパー最小サイズ\" /><span>%</span></span>
              </div>
              <div class=\"shell-brush-property-row\">
                <label for=\"brush-opacity-taper-range\">テーパー最小不透明度</label>
                <input id=\"brush-opacity-taper-range\" type=\"range\" min=\"0\" max=\"100\" step=\"1\" value=\"0\" />
                <span class=\"shell-brush-property-number shell-brush-property-percent\"><input id=\"brush-opacity-taper-number\" type=\"number\" inputmode=\"numeric\" min=\"0\" max=\"100\" step=\"1\" value=\"0\" aria-label=\"ストロークテーパー最小不透明度\" /><span>%</span></span>
              </div>
              <div class=\"shell-brush-property-row shell-brush-tip-property-row\">
""",
)

write_new(
    'tests/unit/brush-opacity-taper.test.ts',
    """import { describe, expect, it } from 'vitest';
import {
  brushOpacityTaperMinimumRatioV1,
  createBaselineBrushPresetV1,
  withBrushOpacityTaperMinimumRatioV1,
} from '../../src/domain/brush-schema.js';
import { BaselineBrushDabBuilderV1 } from '../../src/gpu/baseline-brush.js';

describe('M6A-031 opacity taper', () => {
  it('stores a preset-local minimum deposit ratio with a zero-minimum compatibility default', () => {
    const preset = createBaselineBrushPresetV1({
      id: 'opacity-taper.paint',
      name: 'Opacity taper',
      category: 'Test',
      behavior: 'paint',
    });
    expect(brushOpacityTaperMinimumRatioV1(preset)).toBe(0);
    expect(
      brushOpacityTaperMinimumRatioV1(withBrushOpacityTaperMinimumRatioV1(preset, 0.4)),
    ).toBe(0.4);
    expect(() => withBrushOpacityTaperMinimumRatioV1(preset, -0.01)).toThrow(RangeError);
    expect(() => withBrushOpacityTaperMinimumRatioV1(preset, 1.01)).toThrow(RangeError);
  });

  it('keeps size taper independent from the opacity/deposit minimum on the start envelope', () => {
    const builder = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      opacity: 0.8,
      flow: 1,
      spacingRatio: 0.5,
      startTaperLengthPx: 20,
      sizeTaperMinimumRatio: 1,
      opacityTaperMinimumRatio: 0.4,
    });
    builder.beginDelta({ documentX: 0, documentY: 0 });
    const half = builder.appendDelta([{ documentX: 10, documentY: 0 }]);
    expect(half[0]?.radius).toBeCloseTo(10, 6);
    expect(half[0]?.flow).toBeCloseTo(0.7, 6);
    expect(half[0]?.strokeOpacity).toBeCloseTo(0.8, 6);
    expect(half[0]?.opacity).toBeCloseTo(0.56, 6);
  });

  it('can disable deposit fade while retaining size taper', () => {
    const builder = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      opacity: 1,
      flow: 0.8,
      spacingRatio: 0.5,
      startTaperLengthPx: 20,
      sizeTaperMinimumRatio: 0.4,
      opacityTaperMinimumRatio: 1,
    });
    const start = builder.beginDelta({ documentX: 0, documentY: 0 });
    expect(start).toEqual([]);
    const half = builder.appendDelta([{ documentX: 10, documentY: 0 }]);
    expect(half[0]?.radius).toBeCloseTo(7, 6);
    expect(half[0]?.flow).toBeCloseTo(0.8, 6);
  });

  it('emits a visible zero-envelope endpoint only when both size and deposit minima are nonzero', () => {
    const builder = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      opacity: 1,
      flow: 1,
      spacingRatio: 0.5,
      endTaperLengthPx: 20,
      sizeTaperMinimumRatio: 0.4,
      opacityTaperMinimumRatio: 0.25,
    });
    builder.beginDelta({ documentX: 0, documentY: 0 });
    builder.appendDelta([{ documentX: 40, documentY: 0 }]);
    builder.finishDelta();
    const endpoint = builder.dabs().at(-1);
    expect(endpoint?.x).toBeCloseTo(40, 6);
    expect(endpoint?.radius).toBeCloseTo(4, 6);
    expect(endpoint?.flow).toBeCloseTo(0.25, 6);
    expect(endpoint?.strokeOpacity).toBeCloseTo(1, 6);
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
    """requireText(progress, 'M6A-031 opacity taper:完了', 'M6A-031 progress is not complete');
requireText(
  read('src/domain/brush-schema.ts'),
  'brushOpacityTaperMinimumRatioV1',
  'opacity-taper preset helper missing',
);
requireText(
  read('src/gpu/baseline-brush.ts'),
  '#opacityTaperScale',
  'opacity/deposit taper minimum is not composed with the common stroke envelope',
);
requireText(
  read('src/app/paint-session-controller.ts'),
  'setBrushOpacityTaperMinimumRatio',
  'opacity taper is not captured by the paint session',
);
requireText(
  read('src/index.html'),
  'id=\"brush-opacity-taper-range\"',
  'reachable opacity-taper control missing',
);
requireText(
  read('tests/unit/brush-opacity-taper.test.ts'),
  'keeps size taper independent from the opacity/deposit minimum',
  'opacity-taper regression coverage missing',
);""",
)

replace_once(
    'IMPLEMENTATION_PROGRESS.md',
    'M6A-031 opacity taper:未完了\nM6A-032 forced taper:未完了',
    """M6A-031 opacity taper:完了
再開メモ: M6A-031 opacity taperはstroke.opacityTaperMinimumRatioを0..1で保持し、M6A-028/029の共通start/end envelopeからper-dab deposit scale = minimumRatio + (1-minimumRatio)*envelopeを解決する。既定0は従来どおり0までフェードし、1はopacity/deposit fadeだけを無効化する。whole-stroke strokeOpacity capは一定のまま、base flowへdeposit scaleを掛けるためM6A-030 size taperとは独立する。size minimumとopacity minimumの双方が非0ならraw envelope=0の開始/終端stampも可視になり得るため、その場合だけ通常のlogical stampとして保持・tip selectionを消費する。primitive dabには解決済みflow/opacityのみ保存しWorker/history schema追加は不要。次はM6A-032 forced taperから再開する。
M6A-032 forced taper:未完了""",
)
append_once(
    'ILLUSTRO_DESIGN_MEMO.md',
    'M6A opacity-taper boundary — 2026-09-03',
    """#### M6A opacity-taper boundary — 2026-09-03

- M6A-031 stores `stroke.opacityTaperMinimumRatio` in `0..1` and reuses the same M6A-028/M6A-029 start/end distance envelope as size taper. It does not create a second distance/timing system.
- The per-dab deposit scale is `minimumRatio + (1 - minimumRatio) * envelope`. `0` preserves the previous fade-to-zero behavior; `1` disables deposit fading while size taper can remain active.
- The canonical whole-stroke `strokeOpacity` cap remains invariant for the stroke. Opacity taper is resolved by scaling per-dab flow/deposit before primitive-dab persistence, preventing the Raster Tile transaction from observing a changing stroke opacity cap.
- Size and opacity/deposit minima are independent. A zero-envelope stamp is omitted when either resolved size or resolved deposit is zero; if both minima are positive, that stamp is visible and is retained as a normal logical stamp, including deterministic tip-selection consumption.
- Sampled/custom tip alpha multiplication occurs after the resolved base flow scale, so opacity taper naturally applies to every emitted micro-dab without a new renderer or Worker field.
- The M6A-029 stable-prefix/bounded-tail boundary remains authoritative. End-side opacity changes are reconciled only inside the bounded logical tail, with the existing release-time Raster correctness bridge until the M6A-PERF tail-only raster optimization is implemented.""",
)

print('M6A-031 opacity-taper patch applied')