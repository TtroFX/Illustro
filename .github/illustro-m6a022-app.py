from pathlib import Path


def read(path: str) -> str:
    return Path(path).read_text(encoding='utf-8')


def write(path: str, content: str) -> None:
    Path(path).write_text(content, encoding='utf-8')


def replace_once(path: str, before: str, after: str) -> None:
    source = read(path)
    count = source.count(before)
    if count != 1:
        raise RuntimeError(f'{path}: expected exactly one replacement, found {count}: {before[:100]!r}')
    write(path, source.replace(before, after, 1))


def insert_before(path: str, marker: str, block: str) -> None:
    replace_once(path, marker, block.rstrip() + '\n\n' + marker)


replace_once(
    'src/app/paint-session-controller.ts',
    """  BASELINE_BRUSH_HARDNESS,
  DEFAULT_BASELINE_BRUSH_COLOR_V1,
""",
    """  BASELINE_BRUSH_HARDNESS,
  BASELINE_BRUSH_TIP_DENSITY,
  DEFAULT_BASELINE_BRUSH_COLOR_V1,
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """  readonly brushHardness: number;
  readonly brushTipShape: BaselineBrushTipShapeV1;
""",
    """  readonly brushHardness: number;
  readonly brushTipDensity: number;
  readonly brushTipShape: BaselineBrushTipShapeV1;
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """  const hardness =
    value.hardness === undefined
      ? undefined
      : finiteNumber(value.hardness, 'baseline dab hardness');
  const tipShape = value.tipShape === undefined ? undefined : value.tipShape;
""",
    """  const hardness =
    value.hardness === undefined
      ? undefined
      : finiteNumber(value.hardness, 'baseline dab hardness');
  const tipDensity =
    value.tipDensity === undefined
      ? undefined
      : finiteNumber(value.tipDensity, 'baseline dab tipDensity');
  const tipShape = value.tipShape === undefined ? undefined : value.tipShape;
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """    (strokeOpacity !== undefined && (strokeOpacity < 0 || strokeOpacity > 1)) ||
    (hardness !== undefined && (hardness < 0 || hardness > 1))
""",
    """    (strokeOpacity !== undefined && (strokeOpacity < 0 || strokeOpacity > 1)) ||
    (hardness !== undefined && (hardness < 0 || hardness > 1)) ||
    (tipDensity !== undefined && (tipDensity < 0 || tipDensity > 1))
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """    ...(hardness === undefined ? {} : { hardness }),
    ...(tipShape === undefined ? {} : { tipShape }),
""",
    """    ...(hardness === undefined ? {} : { hardness }),
    ...(tipDensity === undefined ? {} : { tipDensity }),
    ...(tipShape === undefined ? {} : { tipShape }),
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """  #brushHardness: number = BASELINE_BRUSH_HARDNESS;
  #brushTipShape: BaselineBrushTipShapeV1 = 'round';
""",
    """  #brushHardness: number = BASELINE_BRUSH_HARDNESS;
  #brushTipDensity: number = BASELINE_BRUSH_TIP_DENSITY;
  #brushTipShape: BaselineBrushTipShapeV1 = 'round';
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """      brushHardness: this.#brushHardness,
      brushTipShape: this.#brushTipShape,
""",
    """      brushHardness: this.#brushHardness,
      brushTipDensity: this.#brushTipDensity,
      brushTipShape: this.#brushTipShape,
""",
)
insert_before(
    'src/app/paint-session-controller.ts',
    '  setBrushTipShape(',
    """  setBrushTipDensity(density: number): number {
    if (!Number.isFinite(density) || density < 0 || density > 1) {
      throw new RangeError('invalid runtime brush tip density');
    }
    if (density !== this.#brushTipDensity) this.#clearActiveStroke();
    this.#brushTipDensity = density;
    return this.#brushTipDensity;
  }

  brushTipDensity(): number {
    return this.#brushTipDensity;
  }""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """      flow: parameters.flow,
      hardness: this.#brushHardness,
      tipShape: this.#brushTipShape,
""",
    """      flow: parameters.flow,
      hardness: this.#brushHardness,
      tipDensity: this.#brushTipDensity,
      tipShape: this.#brushTipShape,
""",
)

replace_once(
    'src/app/brush-preset-library.ts',
    """  withBrushTipHardnessV1,
  withBrushTipAssetAddedV1,
""",
    """  withBrushTipHardnessV1,
  withBrushTipDensityV1,
  withBrushTipAssetAddedV1,
""",
)
insert_before(
    'src/app/brush-preset-library.ts',
    'export function updateBrushPresetCustomTipV1(',
    """export function updateBrushPresetTipDensityV1(
  state: BrushPresetLibraryStateV1,
  presetId: string,
  density: number,
): BrushPresetLibraryStateV1 {
  return updateItemV1(state, presetId, (item) => {
    if (item.locked) throw new Error('locked brush preset cannot be edited');
    const current = withBrushTipDensityV1(item.preset, density);
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

replace_once(
    'src/app/brush-preset-controller.ts',
    """  brushTipHardnessV1,
  brushTipAssetsV1,
""",
    """  brushTipHardnessV1,
  brushTipDensityV1,
  brushTipAssetsV1,
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  updateBrushPresetHardnessV1,
  updateBrushPresetParametersV1,
""",
    """  updateBrushPresetHardnessV1,
  updateBrushPresetTipDensityV1,
  updateBrushPresetParametersV1,
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  const hardnessRange = requireElement('#brush-hardness-range', HTMLInputElement);
  const hardnessNumber = requireElement('#brush-hardness-number', HTMLInputElement);
  const tipShape = requireElement('#brush-tip-shape', HTMLSelectElement);
""",
    """  const hardnessRange = requireElement('#brush-hardness-range', HTMLInputElement);
  const hardnessNumber = requireElement('#brush-hardness-number', HTMLInputElement);
  const tipDensityRange = requireElement('#brush-tip-density-range', HTMLInputElement);
  const tipDensityNumber = requireElement('#brush-tip-density-number', HTMLInputElement);
  const tipShape = requireElement('#brush-tip-shape', HTMLSelectElement);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    input.paintSession.setBrushHardness(brushTipHardnessV1(item.preset));
    input.paintSession.setBrushTipShape(
""",
    """    input.paintSession.setBrushHardness(brushTipHardnessV1(item.preset));
    input.paintSession.setBrushTipDensity(brushTipDensityV1(item.preset));
    input.paintSession.setBrushTipShape(
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    input.root.dataset.illustroBrushHardness = String(brushTipHardnessV1(item.preset));
    input.root.dataset.illustroBrushTipShape = brushTipShapeV1(item.preset);
""",
    """    input.root.dataset.illustroBrushHardness = String(brushTipHardnessV1(item.preset));
    input.root.dataset.illustroBrushTipDensity = String(brushTipDensityV1(item.preset));
    input.root.dataset.illustroBrushTipShape = brushTipShapeV1(item.preset);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    const hardness = brushTipHardnessV1(selected.preset);
    configurePair(hardnessRange, hardnessNumber, 0, 1, 0.01, hardness);
    tipShape.value = brushTipShapeV1(selected.preset);
""",
    """    const hardness = brushTipHardnessV1(selected.preset);
    configurePair(hardnessRange, hardnessNumber, 0, 1, 0.01, hardness);
    const tipDensity = brushTipDensityV1(selected.preset);
    configurePair(tipDensityRange, tipDensityNumber, 0, 1, 0.01, tipDensity);
    tipShape.value = brushTipShapeV1(selected.preset);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    propertyStatus.textContent = `${parameters.sizePx.toFixed(1)} px · ${Math.round(parameters.opacity * 100)}% · ${Math.round(parameters.flow * 100)}% · H${Math.round(hardness * 100)}%`;
""",
    """    propertyStatus.textContent = `${parameters.sizePx.toFixed(1)} px · ${Math.round(parameters.opacity * 100)}% · ${Math.round(parameters.flow * 100)}% · H${Math.round(hardness * 100)}% · D${Math.round(tipDensity * 100)}%`;
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """      hardnessRange,
      hardnessNumber,
      tipShape,
""",
    """      hardnessRange,
      hardnessNumber,
      tipDensityRange,
      tipDensityNumber,
      tipShape,
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  const onHardnessRange = (): void => updateHardness(Number(hardnessRange.value));
  const onHardnessNumber = (): void => updateHardness(Number(hardnessNumber.value));
  const onTipShape = (): void => {
""",
    """  const onHardnessRange = (): void => updateHardness(Number(hardnessRange.value));
  const onHardnessNumber = (): void => updateHardness(Number(hardnessNumber.value));
  const updateTipDensity = (density: number): void =>
    mutate(() => updateBrushPresetTipDensityV1(state, state.selectedPresetId, density));
  const onTipDensityRange = (): void => updateTipDensity(Number(tipDensityRange.value));
  const onTipDensityNumber = (): void => updateTipDensity(Number(tipDensityNumber.value));
  const onTipShape = (): void => {
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  hardnessRange.addEventListener('input', onHardnessRange);
  hardnessNumber.addEventListener('change', onHardnessNumber);
  tipShape.addEventListener('change', onTipShape);
""",
    """  hardnessRange.addEventListener('input', onHardnessRange);
  hardnessNumber.addEventListener('change', onHardnessNumber);
  tipDensityRange.addEventListener('input', onTipDensityRange);
  tipDensityNumber.addEventListener('change', onTipDensityNumber);
  tipShape.addEventListener('change', onTipShape);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """      hardnessRange.removeEventListener('input', onHardnessRange);
      hardnessNumber.removeEventListener('change', onHardnessNumber);
      tipShape.removeEventListener('change', onTipShape);
""",
    """      hardnessRange.removeEventListener('input', onHardnessRange);
      hardnessNumber.removeEventListener('change', onHardnessNumber);
      tipDensityRange.removeEventListener('input', onTipDensityRange);
      tipDensityNumber.removeEventListener('change', onTipDensityNumber);
      tipShape.removeEventListener('change', onTipShape);
""",
)

replace_once(
    'src/index.html',
    """              <div class="shell-brush-property-row">
                <label for="brush-hardness-range">硬さ</label>
                <input id="brush-hardness-range" type="range" min="0" max="1" step="0.01" value="0.85" />
                <span class="shell-brush-property-number shell-brush-property-percent"><input id="brush-hardness-number" type="number" inputmode="decimal" min="0" max="1" step="0.01" value="0.85" aria-label="ブラシ硬さ数値" /><span>×</span></span>
              </div>
              <div class="shell-brush-property-row shell-brush-tip-property-row">
""",
    """              <div class="shell-brush-property-row">
                <label for="brush-hardness-range">硬さ</label>
                <input id="brush-hardness-range" type="range" min="0" max="1" step="0.01" value="0.85" />
                <span class="shell-brush-property-number shell-brush-property-percent"><input id="brush-hardness-number" type="number" inputmode="decimal" min="0" max="1" step="0.01" value="0.85" aria-label="ブラシ硬さ数値" /><span>×</span></span>
              </div>
              <div class="shell-brush-property-row">
                <label for="brush-tip-density-range">先端密度</label>
                <input id="brush-tip-density-range" type="range" min="0" max="1" step="0.01" value="1" />
                <span class="shell-brush-property-number shell-brush-property-percent"><input id="brush-tip-density-number" type="number" inputmode="decimal" min="0" max="1" step="0.01" value="1" aria-label="ブラシ先端密度数値" /><span>×</span></span>
              </div>
              <div class="shell-brush-property-row shell-brush-tip-property-row">
""",
)

replace_once(
    'src/workers/render.worker.ts',
    """    const flow = candidate.flow;
    const strokeOpacity = candidate.strokeOpacity;
    if (
""",
    """    const flow = candidate.flow;
    const strokeOpacity = candidate.strokeOpacity;
    const hardness = candidate.hardness;
    const tipDensity = candidate.tipDensity;
    if (
""",
)
replace_once(
    'src/workers/render.worker.ts',
    """      (strokeOpacity !== undefined &&
        (typeof strokeOpacity !== 'number' ||
          !Number.isFinite(strokeOpacity) ||
          strokeOpacity < 0 ||
          strokeOpacity > 1))
""",
    """      (strokeOpacity !== undefined &&
        (typeof strokeOpacity !== 'number' ||
          !Number.isFinite(strokeOpacity) ||
          strokeOpacity < 0 ||
          strokeOpacity > 1)) ||
      (hardness !== undefined &&
        (typeof hardness !== 'number' || !Number.isFinite(hardness) || hardness < 0 || hardness > 1)) ||
      (tipDensity !== undefined &&
        (typeof tipDensity !== 'number' ||
          !Number.isFinite(tipDensity) ||
          tipDensity < 0 ||
          tipDensity > 1))
""",
)
replace_once(
    'src/workers/render.worker.ts',
    """        ...(flow === undefined ? {} : { flow }),
        ...(strokeOpacity === undefined ? {} : { strokeOpacity }),
        ...(tipShape === undefined ? {} : { tipShape }),
""",
    """        ...(flow === undefined ? {} : { flow }),
        ...(strokeOpacity === undefined ? {} : { strokeOpacity }),
        ...(hardness === undefined ? {} : { hardness }),
        ...(tipDensity === undefined ? {} : { tipDensity }),
        ...(tipShape === undefined ? {} : { tipShape }),
""",
)

print('M6A-022 app and Worker patch applied')