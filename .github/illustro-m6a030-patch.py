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


# Domain: size taper amount is independent from start/end distance envelopes.
insert_before(
    'src/domain/brush-schema.ts',
    'export type BrushTipSelectionModeV1 =',
    """export const DEFAULT_BRUSH_SIZE_TAPER_MINIMUM_RATIO_V1 = 0 as const;

export function brushSizeTaperMinimumRatioV1(preset: BrushPresetV1): number {
  const value = preset.stroke.sizeTaperMinimumRatio;
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1
    ? value
    : DEFAULT_BRUSH_SIZE_TAPER_MINIMUM_RATIO_V1;
}

export function withBrushSizeTaperMinimumRatioV1(
  preset: BrushPresetV1,
  minimumRatio: number,
): BrushPresetV1 {
  if (!Number.isFinite(minimumRatio) || minimumRatio < 0 || minimumRatio > 1) {
    throw new RangeError('brush size taper minimum ratio must be within 0..1');
  }
  return normalizeBrushPresetV1({
    ...preset,
    stroke: { ...preset.stroke, sizeTaperMinimumRatio: minimumRatio },
  });
}""",
)

# Kernel: derive radius from the common envelope while leaving deposit envelope unchanged for M6A-031.
replace_once(
    'src/gpu/baseline-brush.ts',
    """export const BASELINE_BRUSH_END_TAPER_LENGTH_PX = 0 as const;
export const BASELINE_BRUSH_OPACITY = 1 as const;
""",
    """export const BASELINE_BRUSH_END_TAPER_LENGTH_PX = 0 as const;
export const BASELINE_BRUSH_SIZE_TAPER_MINIMUM_RATIO = 0 as const;
export const BASELINE_BRUSH_OPACITY = 1 as const;
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """  readonly #startTaperLengthPx: number;
  readonly #endTaperLengthPx: number;
  readonly #flow: number;
""",
    """  readonly #startTaperLengthPx: number;
  readonly #endTaperLengthPx: number;
  readonly #sizeTaperMinimumRatio: number;
  readonly #flow: number;
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """      readonly startTaperLengthPx?: number;
      readonly endTaperLengthPx?: number;
      readonly hardness?: number;
""",
    """      readonly startTaperLengthPx?: number;
      readonly endTaperLengthPx?: number;
      readonly sizeTaperMinimumRatio?: number;
      readonly hardness?: number;
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """    const startTaperLengthPx = options.startTaperLengthPx ?? BASELINE_BRUSH_START_TAPER_LENGTH_PX;
    const endTaperLengthPx = options.endTaperLengthPx ?? BASELINE_BRUSH_END_TAPER_LENGTH_PX;
    const hardness = options.hardness ?? BASELINE_BRUSH_HARDNESS;
""",
    """    const startTaperLengthPx = options.startTaperLengthPx ?? BASELINE_BRUSH_START_TAPER_LENGTH_PX;
    const endTaperLengthPx = options.endTaperLengthPx ?? BASELINE_BRUSH_END_TAPER_LENGTH_PX;
    const sizeTaperMinimumRatio =
      options.sizeTaperMinimumRatio ?? BASELINE_BRUSH_SIZE_TAPER_MINIMUM_RATIO;
    const hardness = options.hardness ?? BASELINE_BRUSH_HARDNESS;
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """    if (!Number.isFinite(endTaperLengthPx) || endTaperLengthPx < 0 || endTaperLengthPx > 4096) {
      throw new RangeError('baseline brush end taper length must be within 0..4096 px');
    }
    if (!Number.isFinite(hardness) || hardness < 0 || hardness > 1) {
""",
    """    if (!Number.isFinite(endTaperLengthPx) || endTaperLengthPx < 0 || endTaperLengthPx > 4096) {
      throw new RangeError('baseline brush end taper length must be within 0..4096 px');
    }
    if (
      !Number.isFinite(sizeTaperMinimumRatio) ||
      sizeTaperMinimumRatio < 0 ||
      sizeTaperMinimumRatio > 1
    ) {
      throw new RangeError('baseline brush size taper minimum ratio must be within 0..1');
    }
    if (!Number.isFinite(hardness) || hardness < 0 || hardness > 1) {
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """    this.#startTaperLengthPx = startTaperLengthPx;
    this.#endTaperLengthPx = endTaperLengthPx;
    this.#flow = flow;
""",
    """    this.#startTaperLengthPx = startTaperLengthPx;
    this.#endTaperLengthPx = endTaperLengthPx;
    this.#sizeTaperMinimumRatio = sizeTaperMinimumRatio;
    this.#flow = flow;
""",
)
insert_before(
    'src/gpu/baseline-brush.ts',
    '  #emitLogicalStamp(\n',
    """  #sizeTaperScale(envelope: number): number {
    return this.#sizeTaperMinimumRatio + (1 - this.#sizeTaperMinimumRatio) * envelope;
  }""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """    if (envelope <= 0) return;
    pushBaselineBrushStampV1(
      target,
      stamp.x,
      stamp.y,
      this.#radius * envelope,
      this.#flow * envelope,
""",
    """    if (envelope <= 0) return;
    const sizeScale = this.#sizeTaperScale(envelope);
    pushBaselineBrushStampV1(
      target,
      stamp.x,
      stamp.y,
      this.#radius * sizeScale,
      this.#flow * envelope,
""",
)

# Canonical facade forwards the captured size-taper minimum to the deterministic kernel.
replace_once(
    'src/app/canonical-raster-brush.ts',
    """      readonly startTaperLengthPx?: number;
      readonly endTaperLengthPx?: number;
      readonly hardness?: number;
""",
    """      readonly startTaperLengthPx?: number;
      readonly endTaperLengthPx?: number;
      readonly sizeTaperMinimumRatio?: number;
      readonly hardness?: number;
""",
)
replace_once(
    'src/app/canonical-raster-brush.ts',
    """      ...(options.endTaperLengthPx === undefined
        ? {}
        : { endTaperLengthPx: options.endTaperLengthPx }),
      ...(options.hardness === undefined ? {} : { hardness: options.hardness }),
""",
    """      ...(options.endTaperLengthPx === undefined
        ? {}
        : { endTaperLengthPx: options.endTaperLengthPx }),
      ...(options.sizeTaperMinimumRatio === undefined
        ? {}
        : { sizeTaperMinimumRatio: options.sizeTaperMinimumRatio }),
      ...(options.hardness === undefined ? {} : { hardness: options.hardness }),
""",
)

# Paint session captures size taper when a stroke begins.
replace_once(
    'src/app/paint-session-controller.ts',
    """  BASELINE_BRUSH_END_TAPER_LENGTH_PX,
  BASELINE_BRUSH_TIP_DENSITY,
""",
    """  BASELINE_BRUSH_END_TAPER_LENGTH_PX,
  BASELINE_BRUSH_SIZE_TAPER_MINIMUM_RATIO,
  BASELINE_BRUSH_TIP_DENSITY,
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """  readonly brushStartTaperLengthPx: number;
  readonly brushEndTaperLengthPx: number;
  readonly brushTipAngleDegrees: number;
""",
    """  readonly brushStartTaperLengthPx: number;
  readonly brushEndTaperLengthPx: number;
  readonly brushSizeTaperMinimumRatio: number;
  readonly brushTipAngleDegrees: number;
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """  #brushStartTaperLengthPx: number = BASELINE_BRUSH_START_TAPER_LENGTH_PX;
  #brushEndTaperLengthPx: number = BASELINE_BRUSH_END_TAPER_LENGTH_PX;
  #brushTipAngleDegrees: number = BASELINE_BRUSH_TIP_ANGLE_DEGREES;
""",
    """  #brushStartTaperLengthPx: number = BASELINE_BRUSH_START_TAPER_LENGTH_PX;
  #brushEndTaperLengthPx: number = BASELINE_BRUSH_END_TAPER_LENGTH_PX;
  #brushSizeTaperMinimumRatio: number = BASELINE_BRUSH_SIZE_TAPER_MINIMUM_RATIO;
  #brushTipAngleDegrees: number = BASELINE_BRUSH_TIP_ANGLE_DEGREES;
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """      brushStartTaperLengthPx: this.#brushStartTaperLengthPx,
      brushEndTaperLengthPx: this.#brushEndTaperLengthPx,
      brushTipAngleDegrees: this.#brushTipAngleDegrees,
""",
    """      brushStartTaperLengthPx: this.#brushStartTaperLengthPx,
      brushEndTaperLengthPx: this.#brushEndTaperLengthPx,
      brushSizeTaperMinimumRatio: this.#brushSizeTaperMinimumRatio,
      brushTipAngleDegrees: this.#brushTipAngleDegrees,
""",
)
insert_before(
    'src/app/paint-session-controller.ts',
    '  setBrushTipAngleDegrees(angleDegrees: number): number {\n',
    """  setBrushSizeTaperMinimumRatio(minimumRatio: number): number {
    if (!Number.isFinite(minimumRatio) || minimumRatio < 0 || minimumRatio > 1) {
      throw new RangeError('invalid runtime brush size taper minimum ratio');
    }
    if (minimumRatio !== this.#brushSizeTaperMinimumRatio) this.#clearActiveStroke();
    this.#brushSizeTaperMinimumRatio = minimumRatio;
    return this.#brushSizeTaperMinimumRatio;
  }

  brushSizeTaperMinimumRatio(): number {
    return this.#brushSizeTaperMinimumRatio;
  }""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """      startTaperLengthPx: this.#brushStartTaperLengthPx,
      endTaperLengthPx: this.#brushEndTaperLengthPx,
      hardness: this.#brushHardness,
""",
    """      startTaperLengthPx: this.#brushStartTaperLengthPx,
      endTaperLengthPx: this.#brushEndTaperLengthPx,
      sizeTaperMinimumRatio: this.#brushSizeTaperMinimumRatio,
      hardness: this.#brushHardness,
""",
)

# Preset library mutation.
replace_once(
    'src/app/brush-preset-library.ts',
    """  withBrushStrokeEndLengthPxV1,
  withBrushStrokeSpacingV1,
""",
    """  withBrushStrokeEndLengthPxV1,
  withBrushSizeTaperMinimumRatioV1,
  withBrushStrokeSpacingV1,
""",
)
insert_before(
    'src/app/brush-preset-library.ts',
    'export function updateBrushPresetCustomTipV1(\n',
    """export function updateBrushPresetSizeTaperV1(
  state: BrushPresetLibraryStateV1,
  presetId: string,
  minimumRatio: number,
): BrushPresetLibraryStateV1 {
  return updateItemV1(state, presetId, (item) => {
    if (item.locked) throw new Error('locked brush preset cannot be edited');
    const current = withBrushSizeTaperMinimumRatioV1(item.preset, minimumRatio);
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

# Reachable preset UI and production runtime binding.
replace_once(
    'src/app/brush-preset-controller.ts',
    """  brushStrokeStartLengthPxV1,
  brushStrokeEndLengthPxV1,
  brushStrokeSpacingV1,
""",
    """  brushStrokeStartLengthPxV1,
  brushStrokeEndLengthPxV1,
  brushSizeTaperMinimumRatioV1,
  brushStrokeSpacingV1,
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  updateBrushPresetStartLengthV1,
  updateBrushPresetEndLengthV1,
  updateBrushPresetSpacingV1,
""",
    """  updateBrushPresetStartLengthV1,
  updateBrushPresetEndLengthV1,
  updateBrushPresetSizeTaperV1,
  updateBrushPresetSpacingV1,
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  const endLengthRange = requireElement('#brush-end-length-range', HTMLInputElement);
  const endLengthNumber = requireElement('#brush-end-length-number', HTMLInputElement);
  const tipShape = requireElement('#brush-tip-shape', HTMLSelectElement);
""",
    """  const endLengthRange = requireElement('#brush-end-length-range', HTMLInputElement);
  const endLengthNumber = requireElement('#brush-end-length-number', HTMLInputElement);
  const sizeTaperRange = requireElement('#brush-size-taper-range', HTMLInputElement);
  const sizeTaperNumber = requireElement('#brush-size-taper-number', HTMLInputElement);
  const tipShape = requireElement('#brush-tip-shape', HTMLSelectElement);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    const endLengthPx = brushStrokeEndLengthPxV1(item.preset);
    input.paintSession.setBrushEndTaperLengthPx(endLengthPx);
    const tipAssets = brushTipAssetsV1(item.preset);
""",
    """    const endLengthPx = brushStrokeEndLengthPxV1(item.preset);
    input.paintSession.setBrushEndTaperLengthPx(endLengthPx);
    const sizeTaperMinimumRatio = brushSizeTaperMinimumRatioV1(item.preset);
    input.paintSession.setBrushSizeTaperMinimumRatio(sizeTaperMinimumRatio);
    const tipAssets = brushTipAssetsV1(item.preset);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    input.root.dataset.illustroBrushStartLengthPx = String(startLengthPx);
    input.root.dataset.illustroBrushEndLengthPx = String(endLengthPx);
    input.root.dataset.illustroBrushTipShape = brushTipShapeV1(item.preset);
""",
    """    input.root.dataset.illustroBrushStartLengthPx = String(startLengthPx);
    input.root.dataset.illustroBrushEndLengthPx = String(endLengthPx);
    input.root.dataset.illustroBrushSizeTaperMinimumRatio = String(sizeTaperMinimumRatio);
    input.root.dataset.illustroBrushTipShape = brushTipShapeV1(item.preset);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    const endLengthPx = brushStrokeEndLengthPxV1(selected.preset);
    configurePair(endLengthRange, endLengthNumber, 0, 4096, 1, endLengthPx);
    tipShape.value = brushTipShapeV1(selected.preset);
""",
    """    const endLengthPx = brushStrokeEndLengthPxV1(selected.preset);
    configurePair(endLengthRange, endLengthNumber, 0, 4096, 1, endLengthPx);
    const sizeTaperMinimumRatio = brushSizeTaperMinimumRatioV1(selected.preset);
    configurePair(
      sizeTaperRange,
      sizeTaperNumber,
      0,
      100,
      1,
      sizeTaperMinimumRatio * 100,
    );
    tipShape.value = brushTipShapeV1(selected.preset);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    const startLabel = startLengthPx > 0 ? ` · In${Math.round(startLengthPx)}px` : '';
    const endLabel = endLengthPx > 0 ? ` · Out${Math.round(endLengthPx)}px` : '';
    propertyStatus.textContent = `${parameters.sizePx.toFixed(1)} px · ${Math.round(parameters.opacity * 100)}% · ${Math.round(parameters.flow * 100)}% · H${Math.round(hardness * 100)}% · D${Math.round(tipDensity * 100)}% · S${Math.round(spacing.spacingRatio * 100)}% · A${Math.round(tipAngleDegrees)}° · F${Math.round(tipDirectionDegrees)}°${followRotation ? ' · Follow' : ''}${repeatLabel}${startLabel}${endLabel}`;
""",
    """    const startLabel = startLengthPx > 0 ? ` · In${Math.round(startLengthPx)}px` : '';
    const endLabel = endLengthPx > 0 ? ` · Out${Math.round(endLengthPx)}px` : '';
    const sizeTaperLabel =
      sizeTaperMinimumRatio > 0 ? ` · SizeMin${Math.round(sizeTaperMinimumRatio * 100)}%` : '';
    propertyStatus.textContent = `${parameters.sizePx.toFixed(1)} px · ${Math.round(parameters.opacity * 100)}% · ${Math.round(parameters.flow * 100)}% · H${Math.round(hardness * 100)}% · D${Math.round(tipDensity * 100)}% · S${Math.round(spacing.spacingRatio * 100)}% · A${Math.round(tipAngleDegrees)}° · F${Math.round(tipDirectionDegrees)}°${followRotation ? ' · Follow' : ''}${repeatLabel}${startLabel}${endLabel}${sizeTaperLabel}`;
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """      endLengthRange,
      endLengthNumber,
      tipShape,
""",
    """      endLengthRange,
      endLengthNumber,
      sizeTaperRange,
      sizeTaperNumber,
      tipShape,
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  const onEndLengthRange = (): void => updateEndLength(Number(endLengthRange.value));
  const onEndLengthNumber = (): void => updateEndLength(Number(endLengthNumber.value));
  const onTipShape = (): void => {
""",
    """  const onEndLengthRange = (): void => updateEndLength(Number(endLengthRange.value));
  const onEndLengthNumber = (): void => updateEndLength(Number(endLengthNumber.value));
  const updateSizeTaper = (percent: number): void =>
    mutate(() => updateBrushPresetSizeTaperV1(state, state.selectedPresetId, percent / 100));
  const onSizeTaperRange = (): void => updateSizeTaper(Number(sizeTaperRange.value));
  const onSizeTaperNumber = (): void => updateSizeTaper(Number(sizeTaperNumber.value));
  const onTipShape = (): void => {
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  endLengthRange.addEventListener('input', onEndLengthRange);
  endLengthNumber.addEventListener('change', onEndLengthNumber);
  tipShape.addEventListener('change', onTipShape);
""",
    """  endLengthRange.addEventListener('input', onEndLengthRange);
  endLengthNumber.addEventListener('change', onEndLengthNumber);
  sizeTaperRange.addEventListener('input', onSizeTaperRange);
  sizeTaperNumber.addEventListener('change', onSizeTaperNumber);
  tipShape.addEventListener('change', onTipShape);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """      endLengthRange.removeEventListener('input', onEndLengthRange);
      endLengthNumber.removeEventListener('change', onEndLengthNumber);
      tipShape.removeEventListener('change', onTipShape);
""",
    """      endLengthRange.removeEventListener('input', onEndLengthRange);
      endLengthNumber.removeEventListener('change', onEndLengthNumber);
      sizeTaperRange.removeEventListener('input', onSizeTaperRange);
      sizeTaperNumber.removeEventListener('change', onSizeTaperNumber);
      tipShape.removeEventListener('change', onTipShape);
""",
)

# UI control is placed next to the existing start/end taper distance controls.
replace_once(
    'src/index.html',
    """              <div class=\"shell-brush-property-row\">
                <label for=\"brush-end-length-range\">抜き長さ</label>
                <input id=\"brush-end-length-range\" type=\"range\" min=\"0\" max=\"4096\" step=\"1\" value=\"0\" />
                <span class=\"shell-brush-property-number\"><input id=\"brush-end-length-number\" type=\"number\" inputmode=\"numeric\" min=\"0\" max=\"4096\" step=\"1\" value=\"0\" aria-label=\"ストローク抜き長さ\" /><span>px</span></span>
              </div>
              <div class=\"shell-brush-property-row shell-brush-tip-property-row\">
""",
    """              <div class=\"shell-brush-property-row\">
                <label for=\"brush-end-length-range\">抜き長さ</label>
                <input id=\"brush-end-length-range\" type=\"range\" min=\"0\" max=\"4096\" step=\"1\" value=\"0\" />
                <span class=\"shell-brush-property-number\"><input id=\"brush-end-length-number\" type=\"number\" inputmode=\"numeric\" min=\"0\" max=\"4096\" step=\"1\" value=\"0\" aria-label=\"ストローク抜き長さ\" /><span>px</span></span>
              </div>
              <div class=\"shell-brush-property-row\">
                <label for=\"brush-size-taper-range\">テーパー最小サイズ</label>
                <input id=\"brush-size-taper-range\" type=\"range\" min=\"0\" max=\"100\" step=\"1\" value=\"0\" />
                <span class=\"shell-brush-property-number shell-brush-property-percent\"><input id=\"brush-size-taper-number\" type=\"number\" inputmode=\"numeric\" min=\"0\" max=\"100\" step=\"1\" value=\"0\" aria-label=\"ストロークテーパー最小サイズ\" /><span>%</span></span>
              </div>
              <div class=\"shell-brush-property-row shell-brush-tip-property-row\">
""",
)

# Focused M6A-030 regression coverage.
write_new(
    'tests/unit/brush-size-taper.test.ts',
    """import { describe, expect, it } from 'vitest';
import {
  brushSizeTaperMinimumRatioV1,
  createBaselineBrushPresetV1,
  withBrushSizeTaperMinimumRatioV1,
} from '../../src/domain/brush-schema.js';
import { BaselineBrushDabBuilderV1 } from '../../src/gpu/baseline-brush.js';

describe('M6A-030 size taper', () => {
  it('stores a preset-local minimum size ratio with the current zero-minimum compatibility default', () => {
    const preset = createBaselineBrushPresetV1({
      id: 'size-taper.paint',
      name: 'Size taper',
      category: 'Test',
      behavior: 'paint',
    });
    expect(brushSizeTaperMinimumRatioV1(preset)).toBe(0);
    expect(brushSizeTaperMinimumRatioV1(withBrushSizeTaperMinimumRatioV1(preset, 0.4))).toBe(0.4);
    expect(() => withBrushSizeTaperMinimumRatioV1(preset, -0.01)).toThrow(RangeError);
    expect(() => withBrushSizeTaperMinimumRatioV1(preset, 1.01)).toThrow(RangeError);
  });

  it('keeps opacity taper independent from the size minimum on the stroke start envelope', () => {
    const builder = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      opacity: 1,
      flow: 1,
      spacingRatio: 0.5,
      startTaperLengthPx: 20,
      sizeTaperMinimumRatio: 0.4,
    });
    expect(builder.beginDelta({ documentX: 0, documentY: 0 })).toEqual([]);
    const half = builder.appendDelta([{ documentX: 10, documentY: 0 }]);
    expect(half).toHaveLength(1);
    expect(half[0]?.radius).toBeCloseTo(7, 6);
    expect(half[0]?.flow).toBeCloseTo(0.5, 6);
    expect(half[0]?.strokeOpacity).toBeCloseTo(1, 6);
    const full = builder.appendDelta([{ documentX: 20, documentY: 0 }]);
    expect(full[0]?.radius).toBeCloseTo(10, 6);
    expect(full[0]?.flow).toBeCloseTo(1, 6);
  });

  it('can disable size shrink while retaining the same deposit envelope', () => {
    const builder = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      opacity: 1,
      flow: 1,
      spacingRatio: 0.5,
      startTaperLengthPx: 20,
      sizeTaperMinimumRatio: 1,
    });
    builder.beginDelta({ documentX: 0, documentY: 0 });
    const half = builder.appendDelta([{ documentX: 10, documentY: 0 }]);
    expect(half[0]?.radius).toBeCloseTo(10, 6);
    expect(half[0]?.flow).toBeCloseTo(0.5, 6);
  });

  it('applies the same size minimum to the bounded stroke-end tail without changing stable dabs', () => {
    const builder = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      opacity: 1,
      flow: 1,
      spacingRatio: 0.5,
      endTaperLengthPx: 20,
      sizeTaperMinimumRatio: 0.4,
    });
    builder.beginDelta({ documentX: 0, documentY: 0 });
    builder.appendDelta([{ documentX: 40, documentY: 0 }]);
    expect(builder.dabs().map((dab) => dab.radius)).toEqual([10, 10, 10, 10, 10]);
    builder.finishDelta();
    expect(builder.dabs().map((dab) => dab.x)).toEqual([0, 10, 20, 30]);
    expect(builder.dabs()[2]?.radius).toBeCloseTo(10, 6);
    expect(builder.dabs()[3]?.radius).toBeCloseTo(7, 6);
    expect(builder.dabs()[3]?.flow).toBeCloseTo(0.5, 6);
  });
});""",
)

# M6A verifier contract.
insert_before(
    'scripts/verify-m6a-brush.mjs',
    """requireText(
  progress,
  'M6A-PERF-001 incremental active-stroke rendering（stable prefix + bounded mutable tail）:未完了',
""",
    """requireText(progress, 'M6A-030 size taper:完了', 'M6A-030 progress is not complete');
requireText(
  read('src/domain/brush-schema.ts'),
  'brushSizeTaperMinimumRatioV1',
  'size-taper preset helper missing',
);
requireText(
  read('src/gpu/baseline-brush.ts'),
  '#sizeTaperScale',
  'size-taper minimum is not composed with the common stroke envelope',
);
requireText(
  read('src/app/paint-session-controller.ts'),
  'setBrushSizeTaperMinimumRatio',
  'size taper is not captured by the paint session',
);
requireText(
  read('src/index.html'),
  'id=\"brush-size-taper-range\"',
  'reachable size-taper control missing',
);
requireText(
  read('tests/unit/brush-size-taper.test.ts'),
  'keeps opacity taper independent from the size minimum',
  'size-taper regression coverage missing',
);""",
)

# Progress checkpoint and design rationale.
replace_once(
    'IMPLEMENTATION_PROGRESS.md',
    'M6A-030 size taper:未完了\nM6A-031 opacity taper:未完了',
    """M6A-030 size taper:完了
再開メモ: M6A-030 size taperはstartLengthPx/endLengthPxが定義する共通0..1距離envelopeとは独立に、stroke.sizeTaperMinimumRatioを0..1で保持する。size scaleはminimumRatio + (1-minimumRatio)*envelopeで解決し、既定0はM6A-028/029の従来テーパーを保持、1はサイズ縮小だけを無効化する。per-dab flow/depositはまだ共通envelopeをそのまま使いwhole-stroke opacity capは一定なので、サイズとopacity/depositの責務を分離した。sampled/custom tipもmicro-dab展開前のlogical radiusへ同じsize scaleを適用する。primitive dabへ解決済みradiusを保存するためWorker/history schema追加は不要。次はM6A-031 opacity taperから再開する。
M6A-031 opacity taper:未完了""",
)
append_once(
    'ILLUSTRO_DESIGN_MEMO.md',
    'M6A size-taper boundary — 2026-09-03',
    """#### M6A size-taper boundary — 2026-09-03

- M6A-030 reuses the M6A-028/M6A-029 start/end distance envelopes instead of introducing a second distance tracker. Size taper amount is stored separately as `stroke.sizeTaperMinimumRatio` in the inclusive range `0..1`.
- The resolved logical-stamp size scale is `minimumRatio + (1 - minimumRatio) * envelope`. `0` preserves the current zero-minimum taper behavior; `1` disables size shrink while leaving the shared deposit envelope active.
- M6A-030 changes only logical radius. Per-dab flow/deposit continues to use the raw common envelope and the whole-stroke opacity cap remains constant. M6A-031 owns the independent opacity/deposit minimum semantics.
- Sampled/custom tips inherit size taper before micro-dab expansion, so both micro-dab radius and mask offsets scale from the same resolved logical radius without a new renderer path.
- Persistence/history/Worker continue to store only resolved primitive dabs; no new dab field is introduced for size taper. The preset retains the editable semantic parameter.
- The endpoint remains omitted while the current deposit envelope is zero even if the minimum size ratio is nonzero, because it is invisible until M6A-031 defines any nonzero opacity/deposit minimum.
- M6A-029 stable-prefix and bounded-mutable-tail rules are unchanged. Size taper must not cause stable-prefix regeneration or per-input whole-stroke replay.""",
)

print('M6A-030 size-taper patch applied')