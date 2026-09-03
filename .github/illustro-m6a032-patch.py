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


# Domain: forced start/end taper is explicit and defaults off so existing presets retain M6A-030/031 minima.
insert_before(
    'src/domain/brush-schema.ts',
    'export type BrushTipSelectionModeV1 =',
    """export interface BrushForcedTaperV1 {
  readonly start: boolean;
  readonly end: boolean;
}

export const DEFAULT_BRUSH_FORCE_TAPER_START_V1 = false as const;
export const DEFAULT_BRUSH_FORCE_TAPER_END_V1 = false as const;

export function brushForcedTaperV1(preset: BrushPresetV1): BrushForcedTaperV1 {
  return Object.freeze({
    start:
      typeof preset.stroke.forceStartTaper === 'boolean'
        ? preset.stroke.forceStartTaper
        : DEFAULT_BRUSH_FORCE_TAPER_START_V1,
    end:
      typeof preset.stroke.forceEndTaper === 'boolean'
        ? preset.stroke.forceEndTaper
        : DEFAULT_BRUSH_FORCE_TAPER_END_V1,
  });
}

export function withBrushForcedTaperV1(
  preset: BrushPresetV1,
  forceStart: boolean,
  forceEnd: boolean,
): BrushPresetV1 {
  if (typeof forceStart !== 'boolean' || typeof forceEnd !== 'boolean') {
    throw new TypeError('brush forced taper flags must be boolean');
  }
  return normalizeBrushPresetV1({
    ...preset,
    stroke: {
      ...preset.stroke,
      forceStartTaper: forceStart,
      forceEndTaper: forceEnd,
    },
  });
}""",
)

# Low-level kernel: compute start/end contributions independently. Forced side ignores configured minima and reaches zero.
replace_once(
    'src/gpu/baseline-brush.ts',
    """  readonly #sizeTaperMinimumRatio: number;
  readonly #opacityTaperMinimumRatio: number;
  readonly #flow: number;
""",
    """  readonly #sizeTaperMinimumRatio: number;
  readonly #opacityTaperMinimumRatio: number;
  readonly #forceStartTaper: boolean;
  readonly #forceEndTaper: boolean;
  readonly #flow: number;
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """      readonly sizeTaperMinimumRatio?: number;
      readonly opacityTaperMinimumRatio?: number;
      readonly hardness?: number;
""",
    """      readonly sizeTaperMinimumRatio?: number;
      readonly opacityTaperMinimumRatio?: number;
      readonly forceStartTaper?: boolean;
      readonly forceEndTaper?: boolean;
      readonly hardness?: number;
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """    const opacityTaperMinimumRatio =
      options.opacityTaperMinimumRatio ?? BASELINE_BRUSH_OPACITY_TAPER_MINIMUM_RATIO;
    const hardness = options.hardness ?? BASELINE_BRUSH_HARDNESS;
""",
    """    const opacityTaperMinimumRatio =
      options.opacityTaperMinimumRatio ?? BASELINE_BRUSH_OPACITY_TAPER_MINIMUM_RATIO;
    const forceStartTaper = options.forceStartTaper ?? false;
    const forceEndTaper = options.forceEndTaper ?? false;
    const hardness = options.hardness ?? BASELINE_BRUSH_HARDNESS;
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """    if (
      !Number.isFinite(opacityTaperMinimumRatio) ||
      opacityTaperMinimumRatio < 0 ||
      opacityTaperMinimumRatio > 1
    ) {
      throw new RangeError('baseline brush opacity taper minimum ratio must be within 0..1');
    }
    if (!Number.isFinite(hardness) || hardness < 0 || hardness > 1) {
""",
    """    if (
      !Number.isFinite(opacityTaperMinimumRatio) ||
      opacityTaperMinimumRatio < 0 ||
      opacityTaperMinimumRatio > 1
    ) {
      throw new RangeError('baseline brush opacity taper minimum ratio must be within 0..1');
    }
    if (typeof forceStartTaper !== 'boolean' || typeof forceEndTaper !== 'boolean') {
      throw new TypeError('baseline brush forced taper flags must be boolean');
    }
    if (!Number.isFinite(hardness) || hardness < 0 || hardness > 1) {
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """    this.#sizeTaperMinimumRatio = sizeTaperMinimumRatio;
    this.#opacityTaperMinimumRatio = opacityTaperMinimumRatio;
    this.#flow = flow;
""",
    """    this.#sizeTaperMinimumRatio = sizeTaperMinimumRatio;
    this.#opacityTaperMinimumRatio = opacityTaperMinimumRatio;
    this.#forceStartTaper = forceStartTaper;
    this.#forceEndTaper = forceEndTaper;
    this.#flow = flow;
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """  #sizeTaperScale(envelope: number): number {
    return this.#sizeTaperMinimumRatio + (1 - this.#sizeTaperMinimumRatio) * envelope;
  }

  #opacityTaperScale(envelope: number): number {
    return this.#opacityTaperMinimumRatio + (1 - this.#opacityTaperMinimumRatio) * envelope;
  }

  #emitLogicalStamp(
    target: BaselineBrushDabV1[],
    stamp: Pick<BaselineLogicalStampRecordV1, 'x' | 'y' | 'tipAngleDegrees' | 'sampledTipAlpha'>,
    envelope: number,
  ): void {
    const sizeScale = this.#sizeTaperScale(envelope);
    const opacityScale = this.#opacityTaperScale(envelope);
""",
    """  #sizeTaperScale(envelope: number, forced: boolean): number {
    return forced
      ? envelope
      : this.#sizeTaperMinimumRatio + (1 - this.#sizeTaperMinimumRatio) * envelope;
  }

  #opacityTaperScale(envelope: number, forced: boolean): number {
    return forced
      ? envelope
      : this.#opacityTaperMinimumRatio + (1 - this.#opacityTaperMinimumRatio) * envelope;
  }

  #emitLogicalStamp(
    target: BaselineBrushDabV1[],
    stamp: Pick<BaselineLogicalStampRecordV1, 'x' | 'y' | 'tipAngleDegrees' | 'sampledTipAlpha'>,
    startEnvelope: number,
    endEnvelope = 1,
  ): void {
    const sizeScale = Math.min(
      this.#sizeTaperScale(startEnvelope, this.#forceStartTaper),
      this.#sizeTaperScale(endEnvelope, this.#forceEndTaper),
    );
    const opacityScale = Math.min(
      this.#opacityTaperScale(startEnvelope, this.#forceStartTaper),
      this.#opacityTaperScale(endEnvelope, this.#forceEndTaper),
    );
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """    this.#emitLogicalStamp(this.#dabs, record, startEnvelope);
""",
    """    this.#emitLogicalStamp(this.#dabs, record, startEnvelope, 1);
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """      const envelope = Math.min(
        this.#startEnvelopeAtDistance(stamp.pathDistancePx),
        this.#endEnvelopeAtDistance(stamp.pathDistancePx, totalDistancePx),
      );
      this.#emitLogicalStamp(this.#dabs, stamp, envelope);
""",
    """      const startEnvelope = this.#startEnvelopeAtDistance(stamp.pathDistancePx);
      const endEnvelope = this.#endEnvelopeAtDistance(stamp.pathDistancePx, totalDistancePx);
      this.#emitLogicalStamp(this.#dabs, stamp, startEnvelope, endEnvelope);
""",
)

# Canonical facade forwards forced-taper flags into the deterministic kernel.
replace_once(
    'src/app/canonical-raster-brush.ts',
    """      readonly sizeTaperMinimumRatio?: number;
      readonly opacityTaperMinimumRatio?: number;
      readonly hardness?: number;
""",
    """      readonly sizeTaperMinimumRatio?: number;
      readonly opacityTaperMinimumRatio?: number;
      readonly forceStartTaper?: boolean;
      readonly forceEndTaper?: boolean;
      readonly hardness?: number;
""",
)
replace_once(
    'src/app/canonical-raster-brush.ts',
    """      ...(options.opacityTaperMinimumRatio === undefined
        ? {}
        : { opacityTaperMinimumRatio: options.opacityTaperMinimumRatio }),
      ...(options.hardness === undefined ? {} : { hardness: options.hardness }),
""",
    """      ...(options.opacityTaperMinimumRatio === undefined
        ? {}
        : { opacityTaperMinimumRatio: options.opacityTaperMinimumRatio }),
      ...(options.forceStartTaper === undefined ? {} : { forceStartTaper: options.forceStartTaper }),
      ...(options.forceEndTaper === undefined ? {} : { forceEndTaper: options.forceEndTaper }),
      ...(options.hardness === undefined ? {} : { hardness: options.hardness }),
""",
)

# PaintSession captures flags with the stroke; future pressure/dynamics cannot erase the forced zero endpoint contract.
replace_once(
    'src/app/paint-session-controller.ts',
    """  readonly brushSizeTaperMinimumRatio: number;
  readonly brushOpacityTaperMinimumRatio: number;
  readonly brushTipAngleDegrees: number;
""",
    """  readonly brushSizeTaperMinimumRatio: number;
  readonly brushOpacityTaperMinimumRatio: number;
  readonly brushForceStartTaper: boolean;
  readonly brushForceEndTaper: boolean;
  readonly brushTipAngleDegrees: number;
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """  #brushSizeTaperMinimumRatio: number = BASELINE_BRUSH_SIZE_TAPER_MINIMUM_RATIO;
  #brushOpacityTaperMinimumRatio: number = BASELINE_BRUSH_OPACITY_TAPER_MINIMUM_RATIO;
  #brushTipAngleDegrees: number = BASELINE_BRUSH_TIP_ANGLE_DEGREES;
""",
    """  #brushSizeTaperMinimumRatio: number = BASELINE_BRUSH_SIZE_TAPER_MINIMUM_RATIO;
  #brushOpacityTaperMinimumRatio: number = BASELINE_BRUSH_OPACITY_TAPER_MINIMUM_RATIO;
  #brushForceStartTaper = false;
  #brushForceEndTaper = false;
  #brushTipAngleDegrees: number = BASELINE_BRUSH_TIP_ANGLE_DEGREES;
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """      brushSizeTaperMinimumRatio: this.#brushSizeTaperMinimumRatio,
      brushOpacityTaperMinimumRatio: this.#brushOpacityTaperMinimumRatio,
      brushTipAngleDegrees: this.#brushTipAngleDegrees,
""",
    """      brushSizeTaperMinimumRatio: this.#brushSizeTaperMinimumRatio,
      brushOpacityTaperMinimumRatio: this.#brushOpacityTaperMinimumRatio,
      brushForceStartTaper: this.#brushForceStartTaper,
      brushForceEndTaper: this.#brushForceEndTaper,
      brushTipAngleDegrees: this.#brushTipAngleDegrees,
""",
)
insert_before(
    'src/app/paint-session-controller.ts',
    '  setBrushTipAngleDegrees(angleDegrees: number): number {\n',
    """  setBrushForcedTaper(forceStart: boolean, forceEnd: boolean): Readonly<{ start: boolean; end: boolean }> {
    if (typeof forceStart !== 'boolean' || typeof forceEnd !== 'boolean') {
      throw new TypeError('invalid runtime forced taper flags');
    }
    if (forceStart !== this.#brushForceStartTaper || forceEnd !== this.#brushForceEndTaper) {
      this.#clearActiveStroke();
    }
    this.#brushForceStartTaper = forceStart;
    this.#brushForceEndTaper = forceEnd;
    return Object.freeze({ start: forceStart, end: forceEnd });
  }

  brushForcedTaper(): Readonly<{ start: boolean; end: boolean }> {
    return Object.freeze({ start: this.#brushForceStartTaper, end: this.#brushForceEndTaper });
  }""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """      sizeTaperMinimumRatio: this.#brushSizeTaperMinimumRatio,
      opacityTaperMinimumRatio: this.#brushOpacityTaperMinimumRatio,
      hardness: this.#brushHardness,
""",
    """      sizeTaperMinimumRatio: this.#brushSizeTaperMinimumRatio,
      opacityTaperMinimumRatio: this.#brushOpacityTaperMinimumRatio,
      forceStartTaper: this.#brushForceStartTaper,
      forceEndTaper: this.#brushForceEndTaper,
      hardness: this.#brushHardness,
""",
)

# Preset library mutation.
replace_once(
    'src/app/brush-preset-library.ts',
    """  withBrushOpacityTaperMinimumRatioV1,
  withBrushStrokeSpacingV1,
""",
    """  withBrushOpacityTaperMinimumRatioV1,
  withBrushForcedTaperV1,
  withBrushStrokeSpacingV1,
""",
)
insert_before(
    'src/app/brush-preset-library.ts',
    'export function updateBrushPresetCustomTipV1(\n',
    """export function updateBrushPresetForcedTaperV1(
  state: BrushPresetLibraryStateV1,
  presetId: string,
  forceStart: boolean,
  forceEnd: boolean,
): BrushPresetLibraryStateV1 {
  return updateItemV1(state, presetId, (item) => {
    if (item.locked) throw new Error('locked brush preset cannot be edited');
    const current = withBrushForcedTaperV1(item.preset, forceStart, forceEnd);
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

# Preset UI: independent Force In / Force Out toggles.
replace_once(
    'src/app/brush-preset-controller.ts',
    """  brushOpacityTaperMinimumRatioV1,
  brushStrokeSpacingV1,
""",
    """  brushOpacityTaperMinimumRatioV1,
  brushForcedTaperV1,
  brushStrokeSpacingV1,
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  updateBrushPresetOpacityTaperV1,
  updateBrushPresetSpacingV1,
""",
    """  updateBrushPresetOpacityTaperV1,
  updateBrushPresetForcedTaperV1,
  updateBrushPresetSpacingV1,
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  const opacityTaperRange = requireElement('#brush-opacity-taper-range', HTMLInputElement);
  const opacityTaperNumber = requireElement('#brush-opacity-taper-number', HTMLInputElement);
  const tipShape = requireElement('#brush-tip-shape', HTMLSelectElement);
""",
    """  const opacityTaperRange = requireElement('#brush-opacity-taper-range', HTMLInputElement);
  const opacityTaperNumber = requireElement('#brush-opacity-taper-number', HTMLInputElement);
  const forceStartTaperButton = requireElement('#brush-force-start-taper', HTMLButtonElement);
  const forceEndTaperButton = requireElement('#brush-force-end-taper', HTMLButtonElement);
  const tipShape = requireElement('#brush-tip-shape', HTMLSelectElement);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    const opacityTaperMinimumRatio = brushOpacityTaperMinimumRatioV1(item.preset);
    input.paintSession.setBrushOpacityTaperMinimumRatio(opacityTaperMinimumRatio);
    const tipAssets = brushTipAssetsV1(item.preset);
""",
    """    const opacityTaperMinimumRatio = brushOpacityTaperMinimumRatioV1(item.preset);
    input.paintSession.setBrushOpacityTaperMinimumRatio(opacityTaperMinimumRatio);
    const forcedTaper = brushForcedTaperV1(item.preset);
    input.paintSession.setBrushForcedTaper(forcedTaper.start, forcedTaper.end);
    const tipAssets = brushTipAssetsV1(item.preset);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    input.root.dataset.illustroBrushOpacityTaperMinimumRatio = String(opacityTaperMinimumRatio);
    input.root.dataset.illustroBrushTipShape = brushTipShapeV1(item.preset);
""",
    """    input.root.dataset.illustroBrushOpacityTaperMinimumRatio = String(opacityTaperMinimumRatio);
    input.root.dataset.illustroBrushForceStartTaper = String(forcedTaper.start);
    input.root.dataset.illustroBrushForceEndTaper = String(forcedTaper.end);
    input.root.dataset.illustroBrushTipShape = brushTipShapeV1(item.preset);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    const opacityTaperMinimumRatio = brushOpacityTaperMinimumRatioV1(selected.preset);
    configurePair(opacityTaperRange, opacityTaperNumber, 0, 100, 1, opacityTaperMinimumRatio * 100);
    tipShape.value = brushTipShapeV1(selected.preset);
""",
    """    const opacityTaperMinimumRatio = brushOpacityTaperMinimumRatioV1(selected.preset);
    configurePair(opacityTaperRange, opacityTaperNumber, 0, 100, 1, opacityTaperMinimumRatio * 100);
    const forcedTaper = brushForcedTaperV1(selected.preset);
    forceStartTaperButton.textContent = forcedTaper.start ? 'ON' : 'OFF';
    forceStartTaperButton.setAttribute('aria-pressed', String(forcedTaper.start));
    forceEndTaperButton.textContent = forcedTaper.end ? 'ON' : 'OFF';
    forceEndTaperButton.setAttribute('aria-pressed', String(forcedTaper.end));
    tipShape.value = brushTipShapeV1(selected.preset);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    const opacityTaperLabel =
      opacityTaperMinimumRatio > 0
        ? ` · OpacityMin${Math.round(opacityTaperMinimumRatio * 100)}%`
        : '';
    propertyStatus.textContent = `${parameters.sizePx.toFixed(1)} px · ${Math.round(parameters.opacity * 100)}% · ${Math.round(parameters.flow * 100)}% · H${Math.round(hardness * 100)}% · D${Math.round(tipDensity * 100)}% · S${Math.round(spacing.spacingRatio * 100)}% · A${Math.round(tipAngleDegrees)}° · F${Math.round(tipDirectionDegrees)}°${followRotation ? ' · Follow' : ''}${repeatLabel}${startLabel}${endLabel}${sizeTaperLabel}${opacityTaperLabel}`;
""",
    """    const opacityTaperLabel =
      opacityTaperMinimumRatio > 0
        ? ` · OpacityMin${Math.round(opacityTaperMinimumRatio * 100)}%`
        : '';
    const forcedTaperLabel = `${forcedTaper.start ? ' · ForceIn' : ''}${forcedTaper.end ? ' · ForceOut' : ''}`;
    propertyStatus.textContent = `${parameters.sizePx.toFixed(1)} px · ${Math.round(parameters.opacity * 100)}% · ${Math.round(parameters.flow * 100)}% · H${Math.round(hardness * 100)}% · D${Math.round(tipDensity * 100)}% · S${Math.round(spacing.spacingRatio * 100)}% · A${Math.round(tipAngleDegrees)}° · F${Math.round(tipDirectionDegrees)}°${followRotation ? ' · Follow' : ''}${repeatLabel}${startLabel}${endLabel}${sizeTaperLabel}${opacityTaperLabel}${forcedTaperLabel}`;
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """      opacityTaperRange,
      opacityTaperNumber,
      tipShape,
""",
    """      opacityTaperRange,
      opacityTaperNumber,
      forceStartTaperButton,
      forceEndTaperButton,
      tipShape,
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  const onOpacityTaperRange = (): void => updateOpacityTaper(Number(opacityTaperRange.value));
  const onOpacityTaperNumber = (): void => updateOpacityTaper(Number(opacityTaperNumber.value));
  const onTipShape = (): void => {
""",
    """  const onOpacityTaperRange = (): void => updateOpacityTaper(Number(opacityTaperRange.value));
  const onOpacityTaperNumber = (): void => updateOpacityTaper(Number(opacityTaperNumber.value));
  const onForceStartTaper = (): void => {
    const current = brushForcedTaperV1(selectedBrushPresetItemV1(state).preset);
    mutate(() =>
      updateBrushPresetForcedTaperV1(state, state.selectedPresetId, !current.start, current.end),
    );
  };
  const onForceEndTaper = (): void => {
    const current = brushForcedTaperV1(selectedBrushPresetItemV1(state).preset);
    mutate(() =>
      updateBrushPresetForcedTaperV1(state, state.selectedPresetId, current.start, !current.end),
    );
  };
  const onTipShape = (): void => {
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  opacityTaperRange.addEventListener('input', onOpacityTaperRange);
  opacityTaperNumber.addEventListener('change', onOpacityTaperNumber);
  tipShape.addEventListener('change', onTipShape);
""",
    """  opacityTaperRange.addEventListener('input', onOpacityTaperRange);
  opacityTaperNumber.addEventListener('change', onOpacityTaperNumber);
  forceStartTaperButton.addEventListener('click', onForceStartTaper);
  forceEndTaperButton.addEventListener('click', onForceEndTaper);
  tipShape.addEventListener('change', onTipShape);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """      opacityTaperRange.removeEventListener('input', onOpacityTaperRange);
      opacityTaperNumber.removeEventListener('change', onOpacityTaperNumber);
      tipShape.removeEventListener('change', onTipShape);
""",
    """      opacityTaperRange.removeEventListener('input', onOpacityTaperRange);
      opacityTaperNumber.removeEventListener('change', onOpacityTaperNumber);
      forceStartTaperButton.removeEventListener('click', onForceStartTaper);
      forceEndTaperButton.removeEventListener('click', onForceEndTaper);
      tipShape.removeEventListener('change', onTipShape);
""",
)

# UI controls live with taper parameters.
replace_once(
    'src/index.html',
    """              <div class=\"shell-brush-property-row\">
                <label for=\"brush-opacity-taper-range\">テーパー最小不透明度</label>
                <input id=\"brush-opacity-taper-range\" type=\"range\" min=\"0\" max=\"100\" step=\"1\" value=\"0\" />
                <span class=\"shell-brush-property-number shell-brush-property-percent\"><input id=\"brush-opacity-taper-number\" type=\"number\" inputmode=\"numeric\" min=\"0\" max=\"100\" step=\"1\" value=\"0\" aria-label=\"ストロークテーパー最小不透明度\" /><span>%</span></span>
              </div>
              <div class=\"shell-brush-property-row shell-brush-tip-property-row\">
""",
    """              <div class=\"shell-brush-property-row\">
                <label for=\"brush-opacity-taper-range\">テーパー最小不透明度</label>
                <input id=\"brush-opacity-taper-range\" type=\"range\" min=\"0\" max=\"100\" step=\"1\" value=\"0\" />
                <span class=\"shell-brush-property-number shell-brush-property-percent\"><input id=\"brush-opacity-taper-number\" type=\"number\" inputmode=\"numeric\" min=\"0\" max=\"100\" step=\"1\" value=\"0\" aria-label=\"ストロークテーパー最小不透明度\" /><span>%</span></span>
              </div>
              <div class=\"shell-brush-property-row shell-brush-tip-property-row\">
                <label for=\"brush-force-start-taper\">強制入り</label>
                <button id=\"brush-force-start-taper\" type=\"button\" aria-pressed=\"false\" title=\"入り長さの始点をサイズ・不透明度とも0へ強制\">OFF</button>
                <span class=\"shell-brush-tip-kind\">入り</span>
              </div>
              <div class=\"shell-brush-property-row shell-brush-tip-property-row\">
                <label for=\"brush-force-end-taper\">強制抜き</label>
                <button id=\"brush-force-end-taper\" type=\"button\" aria-pressed=\"false\" title=\"抜き長さの終点をサイズ・不透明度とも0へ強制\">OFF</button>
                <span class=\"shell-brush-tip-kind\">抜き</span>
              </div>
              <div class=\"shell-brush-property-row shell-brush-tip-property-row\">
""",
)

write_new(
    'tests/unit/brush-forced-taper.test.ts',
    """import { describe, expect, it } from 'vitest';
import {
  brushForcedTaperV1,
  createBaselineBrushPresetV1,
  withBrushForcedTaperV1,
} from '../../src/domain/brush-schema.js';
import { BaselineBrushDabBuilderV1 } from '../../src/gpu/baseline-brush.js';

describe('M6A-032 forced taper', () => {
  it('stores independent Force In and Force Out flags with compatibility defaults off', () => {
    const preset = createBaselineBrushPresetV1({
      id: 'forced-taper.paint',
      name: 'Forced taper',
      category: 'Test',
      behavior: 'paint',
    });
    expect(brushForcedTaperV1(preset)).toEqual({ start: false, end: false });
    expect(brushForcedTaperV1(withBrushForcedTaperV1(preset, true, false))).toEqual({
      start: true,
      end: false,
    });
    expect(brushForcedTaperV1(withBrushForcedTaperV1(preset, false, true))).toEqual({
      start: false,
      end: true,
    });
  });

  it('forces the stroke start from zero size and deposit even when taper minima are nonzero', () => {
    const builder = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      opacity: 1,
      flow: 1,
      spacingRatio: 0.5,
      startTaperLengthPx: 20,
      sizeTaperMinimumRatio: 0.4,
      opacityTaperMinimumRatio: 0.25,
      forceStartTaper: true,
    });
    expect(builder.beginDelta({ documentX: 0, documentY: 0 })).toEqual([]);
    const half = builder.appendDelta([{ documentX: 10, documentY: 0 }]);
    expect(half[0]?.radius).toBeCloseTo(5, 6);
    expect(half[0]?.flow).toBeCloseTo(0.5, 6);
    expect(half[0]?.strokeOpacity).toBeCloseTo(1, 6);
  });

  it('forces the stroke end down to zero while leaving an unforced start minimum intact', () => {
    const builder = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      opacity: 1,
      flow: 1,
      spacingRatio: 0.5,
      startTaperLengthPx: 20,
      endTaperLengthPx: 20,
      sizeTaperMinimumRatio: 0.4,
      opacityTaperMinimumRatio: 0.25,
      forceStartTaper: false,
      forceEndTaper: true,
    });
    const start = builder.beginDelta({ documentX: 0, documentY: 0 });
    expect(start).toHaveLength(1);
    expect(start[0]?.radius).toBeCloseTo(4, 6);
    expect(start[0]?.flow).toBeCloseTo(0.25, 6);
    builder.appendDelta([{ documentX: 40, documentY: 0 }]);
    builder.finishDelta();
    expect(builder.dabs().map((dab) => dab.x)).toEqual([0, 10, 20, 30]);
    expect(builder.dabs().at(-1)?.radius).toBeCloseTo(5, 6);
    expect(builder.dabs().at(-1)?.flow).toBeCloseTo(0.5, 6);
  });

  it('composes overlapping forced start/end envelopes without weakening either zero-endpoint rule', () => {
    const builder = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      opacity: 1,
      flow: 1,
      spacingRatio: 0.5,
      startTaperLengthPx: 40,
      endTaperLengthPx: 40,
      sizeTaperMinimumRatio: 0.8,
      opacityTaperMinimumRatio: 0.8,
      forceStartTaper: true,
      forceEndTaper: true,
    });
    builder.beginDelta({ documentX: 0, documentY: 0 });
    builder.appendDelta([{ documentX: 40, documentY: 0 }]);
    builder.finishDelta();
    const dabs = builder.dabs();
    expect(dabs.map((dab) => dab.x)).toEqual([10, 20, 30]);
    expect(dabs[0]?.radius).toBeCloseTo(2.5, 6);
    expect(dabs[1]?.radius).toBeCloseTo(5, 6);
    expect(dabs[2]?.radius).toBeCloseTo(2.5, 6);
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
    """requireText(progress, 'M6A-032 forced taper:完了', 'M6A-032 progress is not complete');
requireText(
  read('src/domain/brush-schema.ts'),
  'brushForcedTaperV1',
  'forced-taper preset helper missing',
);
requireText(
  read('src/gpu/baseline-brush.ts'),
  'this.#sizeTaperScale(startEnvelope, this.#forceStartTaper)',
  'forced start taper is not composed into size scaling',
);
requireText(
  read('src/gpu/baseline-brush.ts'),
  'this.#opacityTaperScale(endEnvelope, this.#forceEndTaper)',
  'forced end taper is not composed into deposit scaling',
);
requireText(
  read('src/app/paint-session-controller.ts'),
  'setBrushForcedTaper',
  'forced taper is not captured by the paint session',
);
requireText(
  read('src/index.html'),
  'id=\"brush-force-start-taper\"',
  'reachable Force In control missing',
);
requireText(
  read('src/index.html'),
  'id=\"brush-force-end-taper\"',
  'reachable Force Out control missing',
);
requireText(
  read('tests/unit/brush-forced-taper.test.ts'),
  'forces the stroke start from zero size and deposit',
  'forced-taper regression coverage missing',
);""",
)

replace_once(
    'IMPLEMENTATION_PROGRESS.md',
    'M6A-032 forced taper:未完了\nM6A-033 real-time stabilization:未完了',
    """M6A-032 forced taper:完了
再開メモ: M6A-032 forced taperはstroke.forceStartTaper / stroke.forceEndTaperを独立booleanとして保持する。通常のM6A-030/031ではsizeTaperMinimumRatio / opacityTaperMinimumRatioが各端の最小値を決めるが、Force In側ではstart envelopeそのものをsize/deposit scaleとして使い始点を0へ、Force Out側ではend envelopeそのものを使い終点を0へ強制する。片側だけ有効化可能で、start/end windowが重なる場合は各sideから得たscaleのminを採用して両zero-endpoint契約を保つ。既定false/falseなので既存presetは変更されない。whole-stroke strokeOpacity capは一定、primitive dabには解決済みradius/flowのみ保存する。将来のpressure/velocity dynamicsはforced taperのzero endpointを打ち消してはならない。次はM6A-033 real-time stabilizationから再開する。
M6A-033 real-time stabilization:未完了""",
)
append_once(
    'ILLUSTRO_DESIGN_MEMO.md',
    'M6A forced-taper boundary — 2026-09-03',
    """#### M6A forced-taper boundary — 2026-09-03

- M6A-032 implements independent **Force In** and **Force Out** flags. This follows the previously confirmed Illustro behavior: forced entry begins at zero size/deposit and rises to the configured brush state; forced exit falls to zero size/deposit at release.
- `stroke.forceStartTaper` and `stroke.forceEndTaper` default to `false` so M6A-030/M6A-031 minimum size/deposit ratios remain authoritative for existing presets until a force flag is explicitly enabled.
- On an unforced side, resolved scale remains `minimum + (1-minimum)*sideEnvelope`. On a forced side, resolved scale is the raw side envelope. When start/end windows overlap, the final size and deposit scale are each the minimum of the independently resolved start-side and end-side scales.
- Force In/Out never varies the whole-stroke `strokeOpacity` cap. The forced deposit result is resolved into per-dab flow before persistence, preserving the existing Canonical Raster Tile transaction contract.
- Force flags are captured when the stroke begins. Later pressure/tilt/velocity mappings may multiply or otherwise compose with the brush response, but they must not raise a forced exact start/end endpoint above zero.
- Forced taper reuses the M6A-028/M6A-029 distance windows and bounded end tail. It adds no second path-distance tracker, no new renderer path and no new primitive-dab field.
- UI exposes Force In and Force Out separately; neither is hidden inside the stabilizer implementation. M6A-033/M6A-034 may use the same stroke geometry but must not redefine this taper contract.""",
)

print('M6A-032 forced-taper patch applied')