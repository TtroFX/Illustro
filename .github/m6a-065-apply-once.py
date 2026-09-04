from pathlib import Path


def replace_once(path_s: str, old: str, new: str) -> None:
    path = Path(path_s)
    text = path.read_text(encoding='utf-8')
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path_s}: expected exactly one anchor, found {count}: {old[:180]!r}')
    path.write_text(text.replace(old, new, 1), encoding='utf-8')


def insert_before_once(path_s: str, marker: str, addition: str) -> None:
    replace_once(path_s, marker, addition + marker)


def append_once(path_s: str, marker: str, addition: str) -> None:
    path = Path(path_s)
    text = path.read_text(encoding='utf-8')
    if marker in text:
        raise SystemExit(f'{path_s}: marker already present: {marker}')
    path.write_text(text.rstrip() + '\n\n' + addition.strip() + '\n', encoding='utf-8')


# Brush preset contract: paint-only reference-aware anti-overflow is opt-in and default identity.
insert_before_once(
    'src/domain/brush-schema.ts',
    'export const DEFAULT_BRUSH_SUB_COLOR_RATIO_V1 = 0 as const;\n',
    '''export const DEFAULT_BRUSH_REFERENCE_ANTI_OVERFLOW_V1 = false as const;\n\nexport function brushReferenceAntiOverflowV1(preset: BrushPresetV1): boolean {\n  const value = preset.ink.referenceAntiOverflow;\n  return typeof value === 'boolean' ? value : DEFAULT_BRUSH_REFERENCE_ANTI_OVERFLOW_V1;\n}\n\nexport function withBrushReferenceAntiOverflowV1(\n  preset: BrushPresetV1,\n  enabled: boolean,\n): BrushPresetV1 {\n  if (typeof enabled !== 'boolean') {\n    throw new TypeError('brush reference anti-overflow flag must be boolean');\n  }\n  if (enabled === DEFAULT_BRUSH_REFERENCE_ANTI_OVERFLOW_V1) {\n    const { referenceAntiOverflow: _referenceAntiOverflow, ...ink } = preset.ink;\n    return normalizeBrushPresetV1({ ...preset, ink });\n  }\n  return normalizeBrushPresetV1({\n    ...preset,\n    ink: { ...preset.ink, referenceAntiOverflow: enabled },\n  });\n}\n\n''',
)

# Resolved primitive dabs carry the anti-overflow enable and shared logical-stamp origin.
replace_once(
    'src/gpu/baseline-brush.ts',
    '  readonly colorMixCarryAmount?: number;\n}\n',
    '''  readonly colorMixCarryAmount?: number;\n  readonly referenceAntiOverflow?: boolean;\n  readonly referenceOriginX?: number;\n  readonly referenceOriginY?: number;\n}\n''',
)
insert_before_once(
    'src/gpu/baseline-brush.ts',
    'export function baselineDabColorV1(dab: BaselineBrushDabV1): BaselineBrushColorV1 {\n',
    '''export function baselineDabReferenceAntiOverflowV1(dab: BaselineBrushDabV1): boolean {\n  return dab.referenceAntiOverflow === true;\n}\n\nexport function baselineDabReferenceOriginXV1(dab: BaselineBrushDabV1): number {\n  const value = dab.referenceOriginX;\n  return typeof value === 'number' && Number.isFinite(value) ? value : dab.x;\n}\n\nexport function baselineDabReferenceOriginYV1(dab: BaselineBrushDabV1): number {\n  const value = dab.referenceOriginY;\n  return typeof value === 'number' && Number.isFinite(value) ? value : dab.y;\n}\n\n''',
)
replace_once(
    'src/gpu/baseline-brush.ts',
    '''  color: BaselineBrushColorV1,\n  tipShape: Exclude<BaselineBrushTipShapeV1, 'sampled-image'>,\n): BaselineBrushDabV1 {\n''',
    '''  color: BaselineBrushColorV1,\n  tipShape: Exclude<BaselineBrushTipShapeV1, 'sampled-image'>,\n  referenceAntiOverflow: boolean,\n  referenceOriginX: number,\n  referenceOriginY: number,\n): BaselineBrushDabV1 {\n''',
)
replace_once(
    'src/gpu/baseline-brush.ts',
    '''    tipAngleDegrees,\n    tipShape,\n    color,\n  });\n}\n''',
    '''    tipAngleDegrees,\n    tipShape,\n    color,\n    ...(referenceAntiOverflow\n      ? { referenceAntiOverflow: true, referenceOriginX, referenceOriginY }\n      : {}),\n  });\n}\n''',
)
replace_once(
    'src/gpu/baseline-brush.ts',
    '''  tipShape: BaselineBrushTipShapeV1,\n  sampledTipAlpha: BaselineBrushSampledTipAlphaV1,\n): void {\n''',
    '''  tipShape: BaselineBrushTipShapeV1,\n  sampledTipAlpha: BaselineBrushSampledTipAlphaV1,\n  referenceAntiOverflow: boolean,\n  referenceOriginX: number,\n  referenceOriginY: number,\n): void {\n''',
)
replace_once(
    'src/gpu/baseline-brush.ts',
    '''        color,\n        tipShape,\n      ),\n''',
    '''        color,\n        tipShape,\n        referenceAntiOverflow,\n        referenceOriginX,\n        referenceOriginY,\n      ),\n''',
)
replace_once(
    'src/gpu/baseline-brush.ts',
    '''        color,\n        'round',\n      ),\n''',
    '''        color,\n        'round',\n        referenceAntiOverflow,\n        referenceOriginX,\n        referenceOriginY,\n      ),\n''',
)
replace_once(
    'src/gpu/baseline-brush.ts',
    '  readonly #subColorRatio: number;\n  readonly #radius: number;\n',
    '  readonly #subColorRatio: number;\n  readonly #referenceAntiOverflow: boolean;\n  readonly #radius: number;\n',
)
replace_once(
    'src/gpu/baseline-brush.ts',
    '      readonly subColorRatio?: number;\n      readonly sizePx?: number;\n',
    '      readonly subColorRatio?: number;\n      readonly referenceAntiOverflow?: boolean;\n      readonly sizePx?: number;\n',
)
replace_once(
    'src/gpu/baseline-brush.ts',
    '''    this.#subColorRatio = subColorRatio;\n    const sizePx = options.sizePx ?? BASELINE_BRUSH_RADIUS_PX * 2;\n''',
    '''    this.#subColorRatio = subColorRatio;\n    const referenceAntiOverflow = options.referenceAntiOverflow ?? false;\n    if (typeof referenceAntiOverflow !== 'boolean') {\n      throw new TypeError('baseline brush reference anti-overflow flag must be boolean');\n    }\n    this.#referenceAntiOverflow = referenceAntiOverflow;\n    const sizePx = options.sizePx ?? BASELINE_BRUSH_RADIUS_PX * 2;\n''',
)
replace_once(
    'src/gpu/baseline-brush.ts',
    '''        stamp.color,\n        this.#tipShape,\n        stamp.sampledTipAlpha,\n      );\n''',
    '''        stamp.color,\n        this.#tipShape,\n        stamp.sampledTipAlpha,\n        this.#referenceAntiOverflow,\n        stamp.x,\n        stamp.y,\n      );\n''',
)

# Canonical brush facade forwards the opt-in flag to the deterministic kernel.
replace_once(
    'src/app/canonical-raster-brush.ts',
    '      readonly subColorRatio?: number;\n      readonly mode?: CanonicalBrushModeV1;\n',
    '      readonly subColorRatio?: number;\n      readonly referenceAntiOverflow?: boolean;\n      readonly mode?: CanonicalBrushModeV1;\n',
)
replace_once(
    'src/app/canonical-raster-brush.ts',
    '''      ...(options.subColorRatio === undefined ? {} : { subColorRatio: options.subColorRatio }),\n      ...(options.sizePx === undefined ? {} : { sizePx: options.sizePx }),\n''',
    '''      ...(options.subColorRatio === undefined ? {} : { subColorRatio: options.subColorRatio }),\n      ...(options.referenceAntiOverflow === undefined\n        ? {}\n        : { referenceAntiOverflow: options.referenceAntiOverflow }),\n      ...(options.sizePx === undefined ? {} : { sizePx: options.sizePx }),\n''',
)

# Paint Session owns runtime preset capture; changing the flag terminates the active stroke boundary.
replace_once(
    'src/app/paint-session-controller.ts',
    '  DEFAULT_BRUSH_SUB_COLOR_RATIO_V1,\n',
    '  DEFAULT_BRUSH_SUB_COLOR_RATIO_V1,\n  DEFAULT_BRUSH_REFERENCE_ANTI_OVERFLOW_V1,\n',
)
replace_once(
    'src/app/paint-session-controller.ts',
    '  readonly brushSubColorRatio: number;\n  readonly brushColorMixEnabled: boolean;\n',
    '  readonly brushSubColorRatio: number;\n  readonly brushReferenceAntiOverflow: boolean;\n  readonly brushColorMixEnabled: boolean;\n',
)
replace_once(
    'src/app/paint-session-controller.ts',
    '  #brushSubColorRatio: number = DEFAULT_BRUSH_SUB_COLOR_RATIO_V1;\n  #brushMode: CanonicalBrushModeV1 = \'raster\';\n',
    '  #brushSubColorRatio: number = DEFAULT_BRUSH_SUB_COLOR_RATIO_V1;\n  #brushReferenceAntiOverflow: boolean = DEFAULT_BRUSH_REFERENCE_ANTI_OVERFLOW_V1;\n  #brushMode: CanonicalBrushModeV1 = \'raster\';\n',
)
replace_once(
    'src/app/paint-session-controller.ts',
    '      brushSubColorRatio: this.#brushSubColorRatio,\n      brushColorMixEnabled: this.#brushColorMixEnabled,\n',
    '      brushSubColorRatio: this.#brushSubColorRatio,\n      brushReferenceAntiOverflow: this.#brushReferenceAntiOverflow,\n      brushColorMixEnabled: this.#brushColorMixEnabled,\n',
)
insert_before_once(
    'src/app/paint-session-controller.ts',
    '  setBrushColorMix(\n',
    '''  setBrushReferenceAntiOverflow(enabled: boolean): void {\n    if (typeof enabled !== 'boolean') {\n      throw new TypeError('invalid runtime brush reference anti-overflow flag');\n    }\n    if (enabled !== this.#brushReferenceAntiOverflow) this.#clearActiveStroke();\n    this.#brushReferenceAntiOverflow = enabled;\n  }\n\n  brushReferenceAntiOverflow(): boolean {\n    return this.#brushReferenceAntiOverflow;\n  }\n\n''',
)
replace_once(
    'src/app/paint-session-controller.ts',
    '''        subColor: this.#paintSubColor,\n        subColorRatio: this.#brushSubColorRatio,\n        mode: this.#brushMode,\n''',
    '''        subColor: this.#paintSubColor,\n        subColorRatio: this.#brushSubColorRatio,\n        referenceAntiOverflow: this.#brushReferenceAntiOverflow,\n        mode: this.#brushMode,\n''',
)

# Preset library update follows existing revision/lock semantics.
replace_once(
    'src/app/brush-preset-library.ts',
    '  withBrushSubColorRatioV1,\n',
    '  withBrushSubColorRatioV1,\n  withBrushReferenceAntiOverflowV1,\n',
)
insert_before_once(
    'src/app/brush-preset-library.ts',
    'export function updateBrushPresetColorMixEnabledV1(\n',
    '''export function updateBrushPresetReferenceAntiOverflowV1(\n  state: BrushPresetLibraryStateV1,\n  presetId: string,\n  enabled: boolean,\n): BrushPresetLibraryStateV1 {\n  return updateItemV1(state, presetId, (item) => {\n    if (item.locked) throw new Error('locked brush preset cannot be edited');\n    const current = withBrushReferenceAntiOverflowV1(item.preset, enabled);\n    if (JSON.stringify(current) === JSON.stringify(item.preset)) return item;\n    return itemV1({\n      source: item.source,\n      baseline: item.baseline,\n      preset: normalizeBrushPresetV1({ ...current, revision: item.preset.revision + 1 }),\n      locked: item.locked,\n    });\n  });\n}\n\n''',
)

# Brush Properties exposes a direct paint-only toggle and captures it into Paint Session.
replace_once(
    'src/app/brush-preset-controller.ts',
    '  brushSubColorRatioV1,\n',
    '  brushSubColorRatioV1,\n  brushReferenceAntiOverflowV1,\n',
)
replace_once(
    'src/app/brush-preset-controller.ts',
    '  updateBrushPresetSubColorRatioV1,\n',
    '  updateBrushPresetSubColorRatioV1,\n  updateBrushPresetReferenceAntiOverflowV1,\n',
)
replace_once(
    'src/app/brush-preset-controller.ts',
    '''  const subColorRatioRange = requireElement('#brush-sub-color-ratio-range', HTMLInputElement);\n  const subColorRatioNumber = requireElement('#brush-sub-color-ratio-number', HTMLInputElement);\n  const colorMixEnabledButton = requireElement('#brush-color-mix-enabled', HTMLButtonElement);\n''',
    '''  const subColorRatioRange = requireElement('#brush-sub-color-ratio-range', HTMLInputElement);\n  const subColorRatioNumber = requireElement('#brush-sub-color-ratio-number', HTMLInputElement);\n  const referenceAntiOverflowButton = requireElement(\n    '#brush-reference-anti-overflow',\n    HTMLButtonElement,\n  );\n  const colorMixEnabledButton = requireElement('#brush-color-mix-enabled', HTMLButtonElement);\n''',
)
replace_once(
    'src/app/brush-preset-controller.ts',
    '''    const subColorRatio = brushSubColorRatioV1(item.preset);\n    input.paintSession.setBrushSubColorRatio(subColorRatio);\n    const colorMixEnabled = brushColorMixEnabledV1(item.preset);\n''',
    '''    const subColorRatio = brushSubColorRatioV1(item.preset);\n    input.paintSession.setBrushSubColorRatio(subColorRatio);\n    input.paintSession.setBrushReferenceAntiOverflow(brushReferenceAntiOverflowV1(item.preset));\n    const colorMixEnabled = brushColorMixEnabledV1(item.preset);\n''',
)
replace_once(
    'src/app/brush-preset-controller.ts',
    '''    const subColorRatio = brushSubColorRatioV1(selected.preset);\n    configurePair(subColorRatioRange, subColorRatioNumber, 0, 100, 1, subColorRatio * 100);\n    const colorMixEnabled = brushColorMixEnabledV1(selected.preset);\n''',
    '''    const subColorRatio = brushSubColorRatioV1(selected.preset);\n    configurePair(subColorRatioRange, subColorRatioNumber, 0, 100, 1, subColorRatio * 100);\n    const referenceAntiOverflow = brushReferenceAntiOverflowV1(selected.preset);\n    referenceAntiOverflowButton.textContent = referenceAntiOverflow ? 'ON' : 'OFF';\n    referenceAntiOverflowButton.setAttribute('aria-pressed', String(referenceAntiOverflow));\n    const colorMixEnabled = brushColorMixEnabledV1(selected.preset);\n''',
)
replace_once(
    'src/app/brush-preset-controller.ts',
    '''    subColorRatioRange.disabled = locked || selected.preset.behavior !== 'paint';\n    subColorRatioNumber.disabled = locked || selected.preset.behavior !== 'paint';\n    colorMixCanvasRatioRange.disabled = locked || !colorMixEnabled;\n''',
    '''    subColorRatioRange.disabled = locked || selected.preset.behavior !== 'paint';\n    subColorRatioNumber.disabled = locked || selected.preset.behavior !== 'paint';\n    referenceAntiOverflowButton.disabled = locked || selected.preset.behavior !== 'paint';\n    colorMixCanvasRatioRange.disabled = locked || !colorMixEnabled;\n''',
)
insert_before_once(
    'src/app/brush-preset-controller.ts',
    '  const onColorMixEnabled = (): void =>\n',
    '''  const onReferenceAntiOverflow = (): void =>\n    mutate(() =>\n      updateBrushPresetReferenceAntiOverflowV1(\n        state,\n        state.selectedPresetId,\n        !brushReferenceAntiOverflowV1(selectedBrushPresetItemV1(state).preset),\n      ),\n    );\n''',
)
replace_once(
    'src/app/brush-preset-controller.ts',
    '''  subColorRatioRange.addEventListener('input', onSubColorRatioRange);\n  subColorRatioNumber.addEventListener('change', onSubColorRatioNumber);\n  colorMixEnabledButton.addEventListener('click', onColorMixEnabled);\n''',
    '''  subColorRatioRange.addEventListener('input', onSubColorRatioRange);\n  subColorRatioNumber.addEventListener('change', onSubColorRatioNumber);\n  referenceAntiOverflowButton.addEventListener('click', onReferenceAntiOverflow);\n  colorMixEnabledButton.addEventListener('click', onColorMixEnabled);\n''',
)
replace_once(
    'src/app/brush-preset-controller.ts',
    '''      subColorRatioRange.removeEventListener('input', onSubColorRatioRange);\n      subColorRatioNumber.removeEventListener('change', onSubColorRatioNumber);\n      colorMixEnabledButton.removeEventListener('click', onColorMixEnabled);\n''',
    '''      subColorRatioRange.removeEventListener('input', onSubColorRatioRange);\n      subColorRatioNumber.removeEventListener('change', onSubColorRatioNumber);\n      referenceAntiOverflowButton.removeEventListener('click', onReferenceAntiOverflow);\n      colorMixEnabledButton.removeEventListener('click', onColorMixEnabled);\n''',
)

insert_before_once(
    'src/index.html',
    '''              <div class="shell-brush-property-row shell-brush-tip-property-row">\n                <label for="brush-color-mix-enabled">通常色混ぜ</label>\n''',
    '''              <div class="shell-brush-property-row shell-brush-tip-property-row">\n                <label for="brush-reference-anti-overflow">参照境界</label>\n                <button id="brush-reference-anti-overflow" type="button" aria-pressed="false" title="参照レイヤーの線を越えて塗りがはみ出さないようにする">OFF</button>\n                <span class="shell-brush-tip-kind">Guard</span>\n              </div>\n''',
)

# Existing reference role flows into the canonical raster layer descriptors.
replace_once(
    'src/app/raster-compositor-descriptors.ts',
    '''        ...(layer.roleFlags.draft ? { draft: true } : {}),\n        ...(layer.blendMode === 'normal' ? {} : { blendMode: layer.blendMode }),\n''',
    '''        ...(layer.roleFlags.draft ? { draft: true } : {}),\n        ...(layer.roleFlags.reference ? { reference: true } : {}),\n        ...(layer.blendMode === 'normal' ? {} : { blendMode: layer.blendMode }),\n''',
)

# Canonical Raster Tile anti-overflow implementation. Reference work is local and opt-in.
replace_once(
    'src/gpu/baseline-raster-tile-store.ts',
    '''  baselineDabColorMixCarryAmountV1,\n  baselineDabFlowV1,\n''',
    '''  baselineDabColorMixCarryAmountV1,\n  baselineDabReferenceAntiOverflowV1,\n  baselineDabReferenceOriginXV1,\n  baselineDabReferenceOriginYV1,\n  baselineDabFlowV1,\n''',
)
replace_once(
    'src/gpu/baseline-raster-tile-store.ts',
    '''  readonly draft?: boolean;\n  readonly blendMode?: BlendModeId;\n''',
    '''  readonly draft?: boolean;\n  readonly reference?: boolean;\n  readonly blendMode?: BlendModeId;\n''',
)
replace_once(
    'src/gpu/baseline-raster-tile-store.ts',
    '''  readonly paintCoverage: Map<string, Float32Array>;\n  lastSmudgeDab: BaselineBrushDabV1 | null;\n  colorMixReservoir: readonly [number, number, number, number] | null;\n}\n''',
    '''  readonly paintCoverage: Map<string, Float32Array>;\n  readonly referenceComposite: Map<string, BaselineRasterTileImageV1>;\n  lastSmudgeDab: BaselineBrushDabV1 | null;\n  colorMixReservoir: readonly [number, number, number, number] | null;\n  antiOverflowLastOrigin: Readonly<{ x: number; y: number }> | null;\n}\n''',
)
insert_before_once(
    'src/gpu/baseline-raster-tile-store.ts',
    'function rasterizeColorDab(\n',
    '''export const REFERENCE_ANTI_OVERFLOW_ALPHA_THRESHOLD_V1 = 1 / 255;\n\ninterface ReferenceAntiOverflowClipV1 {\n  readonly left: number;\n  readonly top: number;\n  readonly width: number;\n  readonly height: number;\n  readonly state: Uint8Array;\n}\n\nfunction referenceClipAllowsPixelV1(\n  clip: ReferenceAntiOverflowClipV1,\n  documentX: number,\n  documentY: number,\n): boolean {\n  const localX = documentX - clip.left;\n  const localY = documentY - clip.top;\n  if (localX < 0 || localY < 0 || localX >= clip.width || localY >= clip.height) return false;\n  return clip.state[localY * clip.width + localX] === 2;\n}\n\n''',
)
replace_once(
    'src/gpu/baseline-raster-tile-store.ts',
    '''  strokeCoverage: Float32Array | null = null,\n  reservoir: readonly [number, number, number, number] | null = null,\n): void {\n''',
    '''  strokeCoverage: Float32Array | null = null,\n  reservoir: readonly [number, number, number, number] | null = null,\n  referenceClip: ReferenceAntiOverflowClipV1 | null = null,\n): void {\n''',
)
# There are exactly two paint loops (rgba8 and rgba16) with this local-X anchor.
path = Path('src/gpu/baseline-raster-tile-store.ts')
text = path.read_text(encoding='utf-8')
anchor = '''      const localX = (documentX + 0.5 - dab.x) / radiusX;\n      const tipCoverage = baselineProceduralTipCoverageV1(dab, localX, localY);\n'''
count = text.count(anchor)
if count != 2:
    raise SystemExit(f'src/gpu/baseline-raster-tile-store.ts: expected two paint loop anchors, found {count}')
text = text.replace(
    anchor,
    '''      if (referenceClip !== null && !referenceClipAllowsPixelV1(referenceClip, documentX, documentY)) {\n        continue;\n      }\n      const localX = (documentX + 0.5 - dab.x) / radiusX;\n      const tipCoverage = baselineProceduralTipCoverageV1(dab, localX, localY);\n''',
    2,
)
path.write_text(text, encoding='utf-8')
replace_once(
    'src/gpu/baseline-raster-tile-store.ts',
    '''        paintCoverage: new Map(),\n        lastSmudgeDab: null,\n        colorMixReservoir: null,\n''',
    '''        paintCoverage: new Map(),\n        referenceComposite: new Map(),\n        lastSmudgeDab: null,\n        colorMixReservoir: null,\n        antiOverflowLastOrigin: null,\n''',
)
insert_before_once(
    'src/gpu/baseline-raster-tile-store.ts',
    '  applyDabs(\n',
    '''  #referenceLayersForTarget(layerId: string): readonly BaselineRasterLayerDescriptorV1[] {\n    return this.#layers.filter(\n      (layer) =>\n        layer.layerId !== layerId &&\n        layer.reference === true &&\n        layer.visible &&\n        layer.opacity > 0,\n    );\n  }\n\n  #referenceCompositeTile(\n    coordinate: TileCoordinateV1,\n    referenceLayers: readonly BaselineRasterLayerDescriptorV1[],\n    cache: Map<string, BaselineRasterTileImageV1>,\n  ): BaselineRasterTileImageV1 {\n    const key = tileKeyV1(coordinate);\n    const cached = cache.get(key);\n    if (cached !== undefined) return cached;\n    const composite = this.#composeCoordinate(coordinate, referenceLayers);\n    cache.set(key, composite);\n    return composite;\n  }\n\n  #referenceAlphaAt(\n    documentX: number,\n    documentY: number,\n    referenceLayers: readonly BaselineRasterLayerDescriptorV1[],\n    cache: Map<string, BaselineRasterTileImageV1>,\n  ): number {\n    const pixelX = Math.floor(documentX);\n    const pixelY = Math.floor(documentY);\n    if (\n      pixelX < 0 ||\n      pixelY < 0 ||\n      pixelX >= this.#documentWidth ||\n      pixelY >= this.#documentHeight\n    ) {\n      return 0;\n    }\n    const coordinate = {\n      tx: Math.floor(pixelX / CANONICAL_TILE_SIZE_PX),\n      ty: Math.floor(pixelY / CANONICAL_TILE_SIZE_PX),\n    };\n    const tile = this.#referenceCompositeTile(coordinate, referenceLayers, cache);\n    const localX = pixelX - coordinate.tx * CANONICAL_TILE_SIZE_PX;\n    const localY = pixelY - coordinate.ty * CANONICAL_TILE_SIZE_PX;\n    return readPixel(tile, localY * tile.width + localX)[3];\n  }\n\n  #referenceSegmentBlocked(\n    from: Readonly<{ x: number; y: number }> | null,\n    to: Readonly<{ x: number; y: number }>,\n    referenceLayers: readonly BaselineRasterLayerDescriptorV1[],\n    cache: Map<string, BaselineRasterTileImageV1>,\n  ): boolean {\n    if (\n      this.#referenceAlphaAt(to.x, to.y, referenceLayers, cache) >\n      REFERENCE_ANTI_OVERFLOW_ALPHA_THRESHOLD_V1\n    ) {\n      return true;\n    }\n    if (from === null) return false;\n    const distance = Math.hypot(to.x - from.x, to.y - from.y);\n    const steps = Math.max(1, Math.ceil(distance * 2));\n    for (let step = 1; step <= steps; step += 1) {\n      const t = step / steps;\n      const x = from.x + (to.x - from.x) * t;\n      const y = from.y + (to.y - from.y) * t;\n      if (\n        this.#referenceAlphaAt(x, y, referenceLayers, cache) >\n        REFERENCE_ANTI_OVERFLOW_ALPHA_THRESHOLD_V1\n      ) {\n        return true;\n      }\n    }\n    return false;\n  }\n\n  #buildReferenceAntiOverflowClip(\n    dabs: readonly BaselineBrushDabV1[],\n    origin: Readonly<{ x: number; y: number }>,\n    referenceLayers: readonly BaselineRasterLayerDescriptorV1[],\n    cache: Map<string, BaselineRasterTileImageV1>,\n  ): ReferenceAntiOverflowClipV1 | null {\n    if (\n      origin.x < 0 ||\n      origin.y < 0 ||\n      origin.x >= this.#documentWidth ||\n      origin.y >= this.#documentHeight\n    ) {\n      return null;\n    }\n    let left = Math.floor(origin.x);\n    let top = Math.floor(origin.y);\n    let right = left;\n    let bottom = top;\n    for (const dab of dabs) {\n      const extentX = baselineDabExtentXV1(dab);\n      const extentY = baselineDabExtentYV1(dab);\n      left = Math.min(left, Math.floor(dab.x - extentX));\n      top = Math.min(top, Math.floor(dab.y - extentY));\n      right = Math.max(right, Math.ceil(dab.x + extentX) - 1);\n      bottom = Math.max(bottom, Math.ceil(dab.y + extentY) - 1);\n    }\n    left = Math.max(0, left);\n    top = Math.max(0, top);\n    right = Math.min(this.#documentWidth - 1, right);\n    bottom = Math.min(this.#documentHeight - 1, bottom);\n    if (right < left || bottom < top) return null;\n    const width = right - left + 1;\n    const height = bottom - top + 1;\n    const state = new Uint8Array(width * height);\n    for (let localY = 0; localY < height; localY += 1) {\n      for (let localX = 0; localX < width; localX += 1) {\n        if (\n          this.#referenceAlphaAt(\n            left + localX + 0.5,\n            top + localY + 0.5,\n            referenceLayers,\n            cache,\n          ) > REFERENCE_ANTI_OVERFLOW_ALPHA_THRESHOLD_V1\n        ) {\n          state[localY * width + localX] = 1;\n        }\n      }\n    }\n    const seedX = Math.floor(origin.x) - left;\n    const seedY = Math.floor(origin.y) - top;\n    const seed = seedY * width + seedX;\n    if (state[seed] !== 0) return null;\n\n    // Scanline flood fill: local only, no canvas-sized region label or global flood operation.\n    const stack: number[] = [seed];\n    while (stack.length > 0) {\n      const index = stack.pop();\n      if (index === undefined || state[index] !== 0) continue;\n      const y = Math.floor(index / width);\n      const x = index - y * width;\n      const row = y * width;\n      let runLeft = x;\n      let runRight = x;\n      while (runLeft > 0 && state[row + runLeft - 1] === 0) runLeft -= 1;\n      while (runRight + 1 < width && state[row + runRight + 1] === 0) runRight += 1;\n      let aboveOpen = false;\n      let belowOpen = false;\n      for (let scanX = runLeft; scanX <= runRight; scanX += 1) {\n        state[row + scanX] = 2;\n        if (y > 0) {\n          const above = row - width + scanX;\n          if (state[above] === 0) {\n            if (!aboveOpen) stack.push(above);\n            aboveOpen = true;\n          } else {\n            aboveOpen = false;\n          }\n        }\n        if (y + 1 < height) {\n          const below = row + width + scanX;\n          if (state[below] === 0) {\n            if (!belowOpen) stack.push(below);\n            belowOpen = true;\n          } else {\n            belowOpen = false;\n          }\n        }\n      }\n    }\n    return Object.freeze({ left, top, width, height, state });\n  }\n\n  #prepareReferenceAntiOverflowDabs(\n    layerId: string,\n    dabs: readonly BaselineBrushDabV1[],\n  ): Readonly<{\n    dabs: readonly BaselineBrushDabV1[];\n    clips: ReadonlyMap<BaselineBrushDabV1, ReferenceAntiOverflowClipV1>;\n  }> {\n    const active = this.#active;\n    if (active === null) throw new Error('reference anti-overflow requires an active transaction');\n    if (!dabs.some(baselineDabReferenceAntiOverflowV1)) {\n      return Object.freeze({ dabs, clips: new Map() });\n    }\n    const referenceLayers = this.#referenceLayersForTarget(layerId);\n    if (referenceLayers.length === 0) return Object.freeze({ dabs, clips: new Map() });\n\n    const accepted: BaselineBrushDabV1[] = [];\n    const clips = new Map<BaselineBrushDabV1, ReferenceAntiOverflowClipV1>();\n    let index = 0;\n    while (index < dabs.length) {\n      const first = dabs[index];\n      if (first === undefined) break;\n      if (!baselineDabReferenceAntiOverflowV1(first)) {\n        accepted.push(first);\n        index += 1;\n        continue;\n      }\n      const origin = Object.freeze({\n        x: baselineDabReferenceOriginXV1(first),\n        y: baselineDabReferenceOriginYV1(first),\n      });\n      let end = index + 1;\n      while (end < dabs.length) {\n        const candidate = dabs[end];\n        if (\n          candidate === undefined ||\n          !baselineDabReferenceAntiOverflowV1(candidate) ||\n          baselineDabReferenceOriginXV1(candidate) !== origin.x ||\n          baselineDabReferenceOriginYV1(candidate) !== origin.y\n        ) {\n          break;\n        }\n        end += 1;\n      }\n      const group = dabs.slice(index, end);\n      const blocked = this.#referenceSegmentBlocked(\n        active.antiOverflowLastOrigin,\n        origin,\n        referenceLayers,\n        active.referenceComposite,\n      );\n      if (!blocked) {\n        const clip = this.#buildReferenceAntiOverflowClip(\n          group,\n          origin,\n          referenceLayers,\n          active.referenceComposite,\n        );\n        if (clip !== null) {\n          for (const dab of group) {\n            accepted.push(dab);\n            clips.set(dab, clip);\n          }\n          active.antiOverflowLastOrigin = origin;\n        }\n      }\n      index = end;\n    }\n    return Object.freeze({ dabs: Object.freeze(accepted), clips });\n  }\n\n''',
)
replace_once(
    'src/gpu/baseline-raster-tile-store.ts',
    '''    if (this.#active.operation !== operation)\n      throw new Error('active stroke changed brush operation');\n    if (operation === 'smudge') {\n''',
    '''    if (this.#active.operation !== operation)\n      throw new Error('active stroke changed brush operation');\n    const antiOverflow =\n      operation === 'paint'\n        ? this.#prepareReferenceAntiOverflowDabs(layerId, dabs)\n        : Object.freeze({ dabs, clips: new Map<BaselineBrushDabV1, ReferenceAntiOverflowClipV1>() });\n    const effectiveDabs = antiOverflow.dabs;\n    if (effectiveDabs.length === 0) return;\n    if (operation === 'smudge') {\n''',
)
# Smudge/blur must receive original effective list (same as dabs because anti-overflow is paint-only).
replace_once(
    'src/gpu/baseline-raster-tile-store.ts',
    '      this.#applySmudgeDabs(layerId, dabs);\n',
    '      this.#applySmudgeDabs(layerId, effectiveDabs);\n',
)
replace_once(
    'src/gpu/baseline-raster-tile-store.ts',
    '      this.#applyBlurDabs(layerId, dabs);\n',
    '      this.#applyBlurDabs(layerId, effectiveDabs);\n',
)
replace_once(
    'src/gpu/baseline-raster-tile-store.ts',
    '''      dabs.some(\n        (dab) => baselineDabColorMixEnabledV1(dab) && baselineDabColorMixPickupAmountV1(dab) > 0,\n      )\n    ) {\n      this.#applyColorMixPickupDabs(layerId, dabs);\n''',
    '''      effectiveDabs.some(\n        (dab) => baselineDabColorMixEnabledV1(dab) && baselineDabColorMixPickupAmountV1(dab) > 0,\n      )\n    ) {\n      this.#applyColorMixPickupDabs(layerId, effectiveDabs, antiOverflow.clips);\n''',
)
replace_once(
    'src/gpu/baseline-raster-tile-store.ts',
    '    for (const plan of planBaselineBrushTilesV1(dabs, this.#documentWidth, this.#documentHeight)) {\n',
    '    for (const plan of planBaselineBrushTilesV1(effectiveDabs, this.#documentWidth, this.#documentHeight)) {\n',
)
replace_once(
    'src/gpu/baseline-raster-tile-store.ts',
    '''        if (operation === 'erase') rasterizeEraseDab(tile, bounds.x, bounds.y, dab);\n        else rasterizeColorDab(tile, bounds.x, bounds.y, dab, coverage);\n''',
    '''        if (operation === 'erase') rasterizeEraseDab(tile, bounds.x, bounds.y, dab);\n        else\n          rasterizeColorDab(\n            tile,\n            bounds.x,\n            bounds.y,\n            dab,\n            coverage,\n            null,\n            antiOverflow.clips.get(dab) ?? null,\n          );\n''',
)
replace_once(
    'src/gpu/baseline-raster-tile-store.ts',
    '  #applyColorMixPickupDabs(layerId: string, dabs: readonly BaselineBrushDabV1[]): void {\n',
    '''  #applyColorMixPickupDabs(\n    layerId: string,\n    dabs: readonly BaselineBrushDabV1[],\n    referenceClips: ReadonlyMap<BaselineBrushDabV1, ReferenceAntiOverflowClipV1>,\n  ): void {\n''',
)
replace_once(
    'src/gpu/baseline-raster-tile-store.ts',
    '''        rasterizeColorDab(tile, bounds.x, bounds.y, dab, coverage, active.colorMixReservoir);\n''',
    '''        rasterizeColorDab(\n          tile,\n          bounds.x,\n          bounds.y,\n          dab,\n          coverage,\n          active.colorMixReservoir,\n          referenceClips.get(dab) ?? null,\n        );\n''',
)
# Normalize descriptor boolean and preserve it.
replace_once(
    'src/gpu/baseline-raster-tile-store.ts',
    '''      if (!Number.isFinite(layer.opacity) || layer.opacity < 0 || layer.opacity > 1) {\n        throw new RangeError('baseline raster layer opacity must be between 0 and 1');\n      }\n''',
    '''      if (!Number.isFinite(layer.opacity) || layer.opacity < 0 || layer.opacity > 1) {\n        throw new RangeError('baseline raster layer opacity must be between 0 and 1');\n      }\n      if (layer.reference !== undefined && typeof layer.reference !== 'boolean') {\n        throw new TypeError('baseline raster layer reference flag must be boolean');\n      }\n''',
)
replace_once(
    'src/gpu/baseline-raster-tile-store.ts',
    '''        opacity: layer.opacity,\n        ...(layer.draft === true ? { draft: true } : {}),\n''',
    '''        opacity: layer.opacity,\n        ...(layer.draft === true ? { draft: true } : {}),\n        ...(layer.reference === true ? { reference: true } : {}),\n''',
)

# Renderer freezes/validates/compares new resolved metadata and routes enabled dabs to canonical preview.
replace_once(
    'src/gpu/baseline-paint-renderer.ts',
    '''  baselineDabColorMixCarryAmountV1,\n  baselineDabColorMixEnabledV1,\n''',
    '''  baselineDabColorMixCarryAmountV1,\n  baselineDabReferenceAntiOverflowV1,\n  baselineDabReferenceOriginXV1,\n  baselineDabReferenceOriginYV1,\n  baselineDabColorMixEnabledV1,\n''',
)
replace_once(
    'src/gpu/baseline-paint-renderer.ts',
    '''        ...(dab.colorMixCarryAmount === undefined\n          ? {}\n          : { colorMixCarryAmount: dab.colorMixCarryAmount }),\n''',
    '''        ...(dab.colorMixCarryAmount === undefined\n          ? {}\n          : { colorMixCarryAmount: dab.colorMixCarryAmount }),\n        ...(dab.referenceAntiOverflow === undefined\n          ? {}\n          : { referenceAntiOverflow: dab.referenceAntiOverflow }),\n        ...(dab.referenceOriginX === undefined ? {} : { referenceOriginX: dab.referenceOriginX }),\n        ...(dab.referenceOriginY === undefined ? {} : { referenceOriginY: dab.referenceOriginY }),\n''',
)
replace_once(
    'src/gpu/baseline-paint-renderer.ts',
    '''    (dab.colorMixCarryAmount === undefined ||\n      (Number.isFinite(dab.colorMixCarryAmount) &&\n        dab.colorMixCarryAmount >= 0 &&\n        dab.colorMixCarryAmount <= 1))\n''',
    '''    (dab.colorMixCarryAmount === undefined ||\n      (Number.isFinite(dab.colorMixCarryAmount) &&\n        dab.colorMixCarryAmount >= 0 &&\n        dab.colorMixCarryAmount <= 1)) &&\n    (dab.referenceAntiOverflow === undefined || typeof dab.referenceAntiOverflow === 'boolean') &&\n    (dab.referenceOriginX === undefined || Number.isFinite(dab.referenceOriginX)) &&\n    (dab.referenceOriginY === undefined || Number.isFinite(dab.referenceOriginY)) &&\n    ((dab.referenceOriginX === undefined) === (dab.referenceOriginY === undefined)) &&\n    (dab.referenceAntiOverflow !== true ||\n      (dab.referenceOriginX !== undefined && dab.referenceOriginY !== undefined))\n''',
)
replace_once(
    'src/gpu/baseline-paint-renderer.ts',
    '''    baselineDabColorMixCarryAmountV1(left) === baselineDabColorMixCarryAmountV1(right) &&\n    baselineDabColorV1(left).every(\n''',
    '''    baselineDabColorMixCarryAmountV1(left) === baselineDabColorMixCarryAmountV1(right) &&\n    baselineDabReferenceAntiOverflowV1(left) === baselineDabReferenceAntiOverflowV1(right) &&\n    baselineDabReferenceOriginXV1(left) === baselineDabReferenceOriginXV1(right) &&\n    baselineDabReferenceOriginYV1(left) === baselineDabReferenceOriginYV1(right) &&\n    baselineDabColorV1(left).every(\n''',
)
replace_once(
    'src/gpu/baseline-paint-renderer.ts',
    '''      baselineDabTipDensityV1(dab) !== BASELINE_BRUSH_TIP_DENSITY ||\n      baselineDabColorMixEnabledV1(dab) ||\n''',
    '''      baselineDabTipDensityV1(dab) !== BASELINE_BRUSH_TIP_DENSITY ||\n      baselineDabReferenceAntiOverflowV1(dab) ||\n      baselineDabColorMixEnabledV1(dab) ||\n''',
)

# Worker validates and preserves both reference layer role and resolved dab metadata.
replace_once(
    'src/workers/render.worker.ts',
    '''      (candidate.draft !== undefined && typeof candidate.draft !== 'boolean') ||\n      (candidate.blendMode !== undefined && !isM5cBaseBlendModeV1(candidate.blendMode)) ||\n''',
    '''      (candidate.draft !== undefined && typeof candidate.draft !== 'boolean') ||\n      (candidate.reference !== undefined && typeof candidate.reference !== 'boolean') ||\n      (candidate.blendMode !== undefined && !isM5cBaseBlendModeV1(candidate.blendMode)) ||\n''',
)
replace_once(
    'src/workers/render.worker.ts',
    '''        draft: candidate.draft ?? false,\n        ...(candidate.blendMode === undefined ? {} : { blendMode: candidate.blendMode }),\n''',
    '''        draft: candidate.draft ?? false,\n        reference: candidate.reference ?? false,\n        ...(candidate.blendMode === undefined ? {} : { blendMode: candidate.blendMode }),\n''',
)
replace_once(
    'src/workers/render.worker.ts',
    '''    const colorMixPickupAmount = candidate.colorMixPickupAmount;\n    const colorMixCarryAmount = candidate.colorMixCarryAmount;\n    if (\n''',
    '''    const colorMixPickupAmount = candidate.colorMixPickupAmount;\n    const colorMixCarryAmount = candidate.colorMixCarryAmount;\n    const referenceAntiOverflow = candidate.referenceAntiOverflow;\n    const referenceOriginX = candidate.referenceOriginX;\n    const referenceOriginY = candidate.referenceOriginY;\n    if (\n''',
)
replace_once(
    'src/workers/render.worker.ts',
    '''      (colorMixCarryAmount !== undefined &&\n        (typeof colorMixCarryAmount !== 'number' ||\n          !Number.isFinite(colorMixCarryAmount) ||\n          colorMixCarryAmount < 0 ||\n          colorMixCarryAmount > 1))\n''',
    '''      (colorMixCarryAmount !== undefined &&\n        (typeof colorMixCarryAmount !== 'number' ||\n          !Number.isFinite(colorMixCarryAmount) ||\n          colorMixCarryAmount < 0 ||\n          colorMixCarryAmount > 1)) ||\n      (referenceAntiOverflow !== undefined && typeof referenceAntiOverflow !== 'boolean') ||\n      (referenceOriginX !== undefined &&\n        (typeof referenceOriginX !== 'number' || !Number.isFinite(referenceOriginX))) ||\n      (referenceOriginY !== undefined &&\n        (typeof referenceOriginY !== 'number' || !Number.isFinite(referenceOriginY))) ||\n      ((referenceOriginX === undefined) !== (referenceOriginY === undefined)) ||\n      (referenceAntiOverflow === true &&\n        (referenceOriginX === undefined || referenceOriginY === undefined))\n''',
)
replace_once(
    'src/workers/render.worker.ts',
    '''        ...(colorMixCarryAmount === undefined ? {} : { colorMixCarryAmount }),\n''',
    '''        ...(colorMixCarryAmount === undefined ? {} : { colorMixCarryAmount }),\n        ...(referenceAntiOverflow === undefined ? {} : { referenceAntiOverflow }),\n        ...(referenceOriginX === undefined ? {} : { referenceOriginX }),\n        ...(referenceOriginY === undefined ? {} : { referenceOriginY }),\n''',
)

# Dedicated regression coverage for shared logical origins, radius clipping, and center crossing.
Path('tests/unit/brush-reference-anti-overflow.test.ts').write_text(
    '''import { describe, expect, it } from 'vitest';\nimport {\n  brushReferenceAntiOverflowV1,\n  createBaselineBrushPresetV1,\n  withBrushReferenceAntiOverflowV1,\n} from '../../src/domain/brush-schema.js';\nimport { BaselineBrushDabBuilderV1, type BaselineBrushDabV1 } from '../../src/gpu/baseline-brush.js';\nimport {\n  BaselineRasterTileStoreV1,\n  readBaselineRasterTilePixelV1,\n  type BaselineRasterTileImageV1,\n} from '../../src/gpu/baseline-raster-tile-store.js';\n\nfunction referenceTile(): BaselineRasterTileImageV1 {\n  const bytes = new Uint8Array(16 * 16 * 4);\n  for (let y = 0; y < 16; y += 1) bytes[(y * 16 + 8) * 4 + 3] = 255;\n  return Object.freeze({\n    schema: 'illustro.baseline-raster-tile/1' as const,\n    layerId: 'reference',\n    coordinate: Object.freeze({ tx: 0, ty: 0 }),\n    width: 16,\n    height: 16,\n    pixelFormat: 'rgba8-unorm' as const,\n    bytes,\n  });\n}\n\nconst layers = Object.freeze([\n  Object.freeze({ layerId: 'paint', visible: true, opacity: 1 }),\n  Object.freeze({ layerId: 'reference', visible: true, opacity: 1, reference: true }),\n]);\n\nfunction guardedDab(x: number, y: number, radius: number): BaselineBrushDabV1 {\n  return Object.freeze({\n    schema: 'illustro.baseline-brush-dab/1' as const,\n    x,\n    y,\n    radius,\n    opacity: 1,\n    color: Object.freeze([1, 0, 0] as const),\n    referenceAntiOverflow: true,\n    referenceOriginX: x,\n    referenceOriginY: y,\n  });\n}\n\nfunction paintTile(store: BaselineRasterTileStoreV1): BaselineRasterTileImageV1 {\n  const tile = store.exportTiles().find((candidate) => candidate.layerId === 'paint');\n  if (tile === undefined) throw new Error('expected painted tile');\n  return tile;\n}\n\ndescribe('reference-aware anti-overflow painting', () => {\n  it('keeps the preset opt-in and default identity', () => {\n    const base = createBaselineBrushPresetV1({\n      id: 'anti-overflow-test',\n      name: 'Anti Overflow',\n      category: 'test',\n      behavior: 'paint',\n      defaultSizePx: 16,\n      tags: ['test'],\n    });\n    expect(brushReferenceAntiOverflowV1(base)).toBe(false);\n    expect(brushReferenceAntiOverflowV1(withBrushReferenceAntiOverflowV1(base, true))).toBe(true);\n  });\n\n  it('shares one logical reference origin across sampled-image micro dabs', () => {\n    const builder = new BaselineBrushDabBuilderV1({\n      sizePx: 10,\n      tipShape: 'sampled-image',\n      referenceAntiOverflow: true,\n    });\n    const dabs = builder.begin({ documentX: 7, documentY: 9 });\n    expect(dabs.length).toBeGreaterThan(1);\n    expect(\n      dabs.every(\n        (dab) =>\n          dab.referenceAntiOverflow === true &&\n          dab.referenceOriginX === 7 &&\n          dab.referenceOriginY === 9,\n      ),\n    ).toBe(true);\n  });\n\n  it('clips brush-radius overflow to the connected side of a reference line', () => {\n    const guarded = new BaselineRasterTileStoreV1(16, 16, 'rgba8-unorm', layers);\n    guarded.restore([referenceTile()]);\n    guarded.applyDabs('paint', 'guarded-radius', [guardedDab(6, 8, 5)]);\n    guarded.finalize('guarded-radius');\n    const guardedTile = paintTile(guarded);\n    expect(readBaselineRasterTilePixelV1(guardedTile, 8 * 16 + 6)[3]).toBeGreaterThan(0);\n    expect(readBaselineRasterTilePixelV1(guardedTile, 8 * 16 + 9)[3]).toBe(0);\n\n    const legacy = new BaselineRasterTileStoreV1(16, 16, 'rgba8-unorm', layers);\n    legacy.restore([referenceTile()]);\n    legacy.applyDabs('paint', 'legacy-radius', [\n      Object.freeze({ ...guardedDab(6, 8, 5), referenceAntiOverflow: false }),\n    ]);\n    legacy.finalize('legacy-radius');\n    expect(readBaselineRasterTilePixelV1(paintTile(legacy), 8 * 16 + 9)[3]).toBeGreaterThan(0);\n  });\n\n  it('rejects a later logical origin that crosses the reference boundary', () => {\n    const store = new BaselineRasterTileStoreV1(16, 16, 'rgba8-unorm', layers);\n    store.restore([referenceTile()]);\n    store.applyDabs('paint', 'crossing', [guardedDab(6, 8, 2)]);\n    store.applyDabs('paint', 'crossing', [guardedDab(10, 8, 2)]);\n    store.finalize('crossing');\n    const tile = paintTile(store);\n    expect(readBaselineRasterTilePixelV1(tile, 8 * 16 + 6)[3]).toBeGreaterThan(0);\n    expect(readBaselineRasterTilePixelV1(tile, 8 * 16 + 10)[3]).toBe(0);\n  });\n});\n''',
    encoding='utf-8',
)

# Verification contract, progress, and authoritative design boundary.
append_once(
    'scripts/verify-m6a-brush.mjs',
    'M6A-065 progress is not complete',
    '''requireText(\n  progress,\n  'M6A-065 reference-aware anti-overflow painting:完了',\n  'M6A-065 progress is not complete',\n);\nrequireText(\n  read('src/domain/brush-schema.ts'),\n  'brushReferenceAntiOverflowV1',\n  'reference anti-overflow brush preset contract missing',\n);\nrequireText(\n  read('src/app/raster-compositor-descriptors.ts'),\n  'reference: true',\n  'Reference Layer role is not carried to the raster compositor',\n);\nrequireText(\n  read('src/gpu/baseline-raster-tile-store.ts'),\n  '#buildReferenceAntiOverflowClip',\n  'local reference anti-overflow connectivity clip missing',\n);\nrequireText(\n  read('src/gpu/baseline-paint-renderer.ts'),\n  'baselineDabReferenceAntiOverflowV1(dab)',\n  'anti-overflow paint is not routed through canonical preview',\n);\nrequireText(\n  read('src/index.html'),\n  'id=\"brush-reference-anti-overflow\"',\n  'reachable reference anti-overflow control missing',\n);\nrequireText(\n  read('tests/unit/brush-reference-anti-overflow.test.ts'),\n  'clips brush-radius overflow to the connected side of a reference line',\n  'reference anti-overflow regression coverage missing',\n);''',
)
replace_once(
    'IMPLEMENTATION_PROGRESS.md',
    'M6A-065 reference-aware anti-overflow painting:未完了\nM6A-066 hover brush outline:未完了\n',
    '''M6A-065 reference-aware anti-overflow painting:完了\n再開メモ: M6A-065はBrush ink.referenceAntiOverflow boolean（既定false）を通常Raster paintへ接続し、既存roleFlags.referenceのvisible root Raster Layersを境界sourceとして再利用する。active target layerは自己生成pixelを境界化しないよう除外し、参照Rasterが無い場合とOFF時は既存出力を完全identityに保つ。各logical stampは解決済みreference originをprimitive dabへ共有し、sampled-tip micro dab/Spray particleも同一origin判定を使う。参照alpha>1/255をbarrierとし、前回受理origin→新originのsegmentがbarrierを横切るstampを拒否、受理stampはprimitive union bounds内だけscanline 4-connect flood fillしてoriginから到達可能な非barrier pixelへcoverageをclipするため、中心の飛び越しとbrush-radiusの線越えを両方防ぐ。whole canvas flood fill/region labelは作らず有効時のlocal boundsだけ処理する。anti-overflow dabはcanonical Raster Tile previewへ切替え、resolved enable/originをWorker/History/Recoveryへ保持する。Eraser/Smudge/Blur、M6A-062/063 reservoir、将来のLineart Boundary topology unionは別責務。次はM6A-066 hover brush outlineから再開する。\nM6A-066 hover brush outline:未完了\n''',
)
append_once(
    'ILLUSTRO_DESIGN_MEMO.md',
    '## M6A reference-aware anti-overflow boundary — 2026-09-04',
    '''## M6A reference-aware anti-overflow boundary — 2026-09-04\n\n**AUTHORITATIVE for M6A-065.** `BrushPresetV1.ink.referenceAntiOverflow` is a paint-only boolean and defaults to `false`; OFF is an exact compatibility boundary. When enabled, ordinary Raster paint uses visible root Raster Layers already marked with the canonical `roleFlags.reference` role as boundary input. The active target Raster Layer is excluded so a stroke never turns its own newly deposited pixels into new barriers. If no eligible Reference Raster Layer exists, output is unchanged. M6A-065 reuses the existing Reference Layer registry/UI rather than creating a second reference system, and it does not claim the future Lineart Boundary topology/union semantics.\n\nReference boundary pixels are derived deterministically from canonical reference-layer alpha after the baseline Raster compositor's visibility/opacity/mask behavior; alpha above `1/255` is closed. Every primitive emitted by one logical stamp carries the same resolved reference origin, so sampled-image micro-dabs and Spray particles cannot independently jump to the opposite side of a line. A new logical origin is rejected if the segment from the last accepted origin crosses the reference boundary. For an accepted logical stamp, paint coverage is clipped to the 4-connected non-barrier region reachable from that origin within the union of the current primitive bounds. This blocks both center crossing and brush-radius overflow while still allowing paint to move around a genuinely open line endpoint.\n\nConnectivity is computed only inside the current logical-stamp primitive bounds with a scanline flood fill. Illustro does not flood-fill or label the whole document for each brush stamp, so cost remains proportional to the local enabled-brush footprint rather than canvas size. Anti-overflow paint uses the canonical Raster Tile preview because the additive WebGPU fast path cannot sample Reference Layer alpha; OFF keeps the existing fast path unchanged. The resolved enable flag and logical origin are carried on canonical dabs so Worker, History, Undo/Redo and recovery reconstruct the same boundary decisions. Eraser, Smudge, Blur and the M6A-062/063 wet-color reservoir remain separate operations; later Lineart Boundary topology may provide an additional boundary source without changing this paint-side contract.''',
)
