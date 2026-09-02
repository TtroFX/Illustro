from pathlib import Path


def replace(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise RuntimeError(f'missing anchor in {path}: {old[:120]!r}')
    p.write_text(text.replace(old, new, 1))


def append(path: str, text: str) -> None:
    p = Path(path)
    current = p.read_text()
    if text.strip() in current:
        return
    p.write_text(current.rstrip() + '\n\n' + text.strip() + '\n')

# Brush schema: normalize procedural round/square without changing the v1 envelope.
replace(
    'src/domain/brush-schema.ts',
    "export type BrushBehaviorV1 = 'paint' | 'erase' | 'smudge' | 'blur';\nexport type BrushPresetSectionV1 = Readonly<Record<string, JsonValue>>;",
    "export type BrushBehaviorV1 = 'paint' | 'erase' | 'smudge' | 'blur';\nexport type BrushProceduralTipShapeV1 = 'round' | 'square';\nexport type BrushPresetSectionV1 = Readonly<Record<string, JsonValue>>;",
)
replace(
    'src/domain/brush-schema.ts',
    "export interface BrushPresetV1 {",
    "export function brushProceduralTipShapeV1(preset: BrushPresetV1): BrushProceduralTipShapeV1 {\n  return preset.tip.kind === 'procedural-square' ? 'square' : 'round';\n}\n\nexport function withBrushProceduralTipShapeV1(\n  preset: BrushPresetV1,\n  shape: BrushProceduralTipShapeV1,\n): BrushPresetV1 {\n  if (shape !== 'round' && shape !== 'square') throw new TypeError('unsupported procedural tip shape');\n  return normalizeBrushPresetV1({\n    ...preset,\n    tip: { ...preset.tip, kind: shape === 'square' ? 'procedural-square' : 'procedural-round' },\n  });\n}\n\nexport interface BrushPresetV1 {",
)

# Preset editing keeps the factory baseline immutable and persists the selected procedural shape.
replace(
    'src/app/brush-preset-library.ts',
    "  withBrushParameterValuesV1,\n  type BrushBehaviorV1,\n  type BrushParameterValuesV1,",
    "  withBrushParameterValuesV1,\n  withBrushProceduralTipShapeV1,\n  type BrushBehaviorV1,\n  type BrushParameterValuesV1,\n  type BrushProceduralTipShapeV1,",
)
replace(
    'src/app/brush-preset-library.ts',
    "export function deleteBrushPresetV1(\n",
    "export function updateBrushPresetProceduralTipV1(\n  state: BrushPresetLibraryStateV1,\n  presetId: string,\n  shape: BrushProceduralTipShapeV1,\n): BrushPresetLibraryStateV1 {\n  return updateItemV1(state, presetId, (item) => {\n    if (item.locked) throw new Error('locked brush preset cannot be edited');\n    const current = withBrushProceduralTipShapeV1(item.preset, shape);\n    if (JSON.stringify(current) === JSON.stringify(item.preset)) return item;\n    const next = normalizeBrushPresetV1({ ...current, revision: item.preset.revision + 1 });\n    return itemV1({\n      source: item.source,\n      baseline: item.baseline,\n      preset: next,\n      locked: item.locked,\n    });\n  });\n}\n\nexport function deleteBrushPresetV1(\n",
)

# Runtime dab identity carries the procedural shape so recovery/worker paths stay deterministic.
replace(
    'src/gpu/baseline-brush.ts',
    "export type BaselineBrushColorV1 = readonly [number, number, number];",
    "export type BaselineBrushColorV1 = readonly [number, number, number];\nexport type BaselineBrushTipShapeV1 = 'round' | 'square';",
)
replace(
    'src/gpu/baseline-brush.ts',
    "  readonly strokeOpacity?: number;\n  readonly color?: BaselineBrushColorV1;",
    "  readonly strokeOpacity?: number;\n  readonly tipShape?: BaselineBrushTipShapeV1;\n  readonly color?: BaselineBrushColorV1;",
)
replace(
    'src/gpu/baseline-brush.ts',
    "  strokeOpacity: number,\n  color: BaselineBrushColorV1,\n): BaselineBrushDabV1 {",
    "  strokeOpacity: number,\n  color: BaselineBrushColorV1,\n  tipShape: BaselineBrushTipShapeV1,\n): BaselineBrushDabV1 {",
)
replace(
    'src/gpu/baseline-brush.ts',
    "    strokeOpacity,\n    color,",
    "    strokeOpacity,\n    tipShape,\n    color,",
)
replace(
    'src/gpu/baseline-brush.ts',
    "  readonly #strokeOpacity: number;\n  #lastPoint:",
    "  readonly #strokeOpacity: number;\n  readonly #tipShape: BaselineBrushTipShapeV1;\n  #lastPoint:",
)
replace(
    'src/gpu/baseline-brush.ts',
    "      readonly flow?: number;\n    } = {},",
    "      readonly flow?: number;\n      readonly tipShape?: BaselineBrushTipShapeV1;\n    } = {},",
)
replace(
    'src/gpu/baseline-brush.ts',
    "    this.#flow = flow;\n    this.#strokeOpacity = opacity;",
    "    this.#flow = flow;\n    this.#strokeOpacity = opacity;\n    this.#tipShape = options.tipShape ?? 'round';\n    if (this.#tipShape !== 'round' && this.#tipShape !== 'square') {\n      throw new TypeError('unsupported baseline brush tip shape');\n    }",
)
# All freezeDab call sites gain the captured shape.
text = Path('src/gpu/baseline-brush.ts').read_text()
text = text.replace("        this.#color,\n      ),", "        this.#color,\n        this.#tipShape,\n      ),")
text = text.replace("            this.#color,\n          ),", "            this.#color,\n            this.#tipShape,\n          ),")
text = text.replace("freezeDab(cursorX, cursorY, this.#radius, this.#flow, this.#strokeOpacity, this.#color)", "freezeDab(\n          cursorX,\n          cursorY,\n          this.#radius,\n          this.#flow,\n          this.#strokeOpacity,\n          this.#color,\n          this.#tipShape,\n        )")
Path('src/gpu/baseline-brush.ts').write_text(text)

# Canonical stroke accepts the captured tip shape and forwards it to the deterministic kernel.
replace(
    'src/app/canonical-raster-brush.ts',
    "  type BaselineBrushDabV1,\n} from '../gpu/baseline-brush.js';",
    "  type BaselineBrushDabV1,\n  type BaselineBrushTipShapeV1,\n} from '../gpu/baseline-brush.js';",
)
replace(
    'src/app/canonical-raster-brush.ts',
    "      readonly flow?: number;\n    } = {},",
    "      readonly flow?: number;\n      readonly tipShape?: BaselineBrushTipShapeV1;\n    } = {},",
)
replace(
    'src/app/canonical-raster-brush.ts',
    "      ...(options.flow === undefined ? {} : { flow: options.flow }),\n    });",
    "      ...(options.flow === undefined ? {} : { flow: options.flow }),\n      ...(options.tipShape === undefined ? {} : { tipShape: options.tipShape }),\n    });",
)

# Paint session captures the selected procedural shape at stroke start.
replace(
    'src/app/paint-session-controller.ts',
    "  type BaselineBrushDabV1,\n} from '../gpu/baseline-brush.js';",
    "  type BaselineBrushDabV1,\n  type BaselineBrushTipShapeV1,\n} from '../gpu/baseline-brush.js';",
)
replace(
    'src/app/paint-session-controller.ts',
    "  readonly brushParameters: BrushParameterValuesV1;\n  readonly brushWork:",
    "  readonly brushParameters: BrushParameterValuesV1;\n  readonly brushTipShape: BaselineBrushTipShapeV1;\n  readonly brushWork:",
)
replace(
    'src/app/paint-session-controller.ts',
    "  #brushParameters: BrushParameterValuesV1 = DEFAULT_BRUSH_PARAMETER_VALUES_V1;\n  #disposed = false;",
    "  #brushParameters: BrushParameterValuesV1 = DEFAULT_BRUSH_PARAMETER_VALUES_V1;\n  #brushTipShape: BaselineBrushTipShapeV1 = 'round';\n  #disposed = false;",
)
replace(
    'src/app/paint-session-controller.ts',
    "      brushParameters: this.#brushParameters,\n      brushWork:",
    "      brushParameters: this.#brushParameters,\n      brushTipShape: this.#brushTipShape,\n      brushWork:",
)
replace(
    'src/app/paint-session-controller.ts',
    "  setBrushMode(mode: CanonicalBrushModeIdV1): CanonicalBrushModeV1 {",
    "  setBrushTipShape(shape: BaselineBrushTipShapeV1): BaselineBrushTipShapeV1 {\n    if (shape !== 'round' && shape !== 'square') throw new TypeError('unsupported runtime brush tip shape');\n    if (shape !== this.#brushTipShape) this.#clearActiveStroke();\n    this.#brushTipShape = shape;\n    return this.#brushTipShape;\n  }\n\n  brushTipShape(): BaselineBrushTipShapeV1 {\n    return this.#brushTipShape;\n  }\n\n  setBrushMode(mode: CanonicalBrushModeIdV1): CanonicalBrushModeV1 {",
)
replace(
    'src/app/paint-session-controller.ts',
    "      flow: parameters.flow,\n    });",
    "      flow: parameters.flow,\n      tipShape: this.#brushTipShape,\n    });",
)
# Recovery parser accepts new dabs while missing shape remains round-compatible.
replace(
    'src/app/paint-session-controller.ts',
    "  const color =\n",
    "  const tipShape = value.tipShape === undefined ? undefined : value.tipShape;\n  if (tipShape !== undefined && tipShape !== 'round' && tipShape !== 'square') {\n    throw new TypeError('invalid baseline dab tip shape');\n  }\n  const color =\n",
)
replace(
    'src/app/paint-session-controller.ts',
    "    ...(strokeOpacity === undefined ? {} : { strokeOpacity }),\n    ...(color === undefined ? {} : { color }),",
    "    ...(strokeOpacity === undefined ? {} : { strokeOpacity }),\n    ...(tipShape === undefined ? {} : { tipShape }),\n    ...(color === undefined ? {} : { color }),",
)

# Worker parser mirrors the recovery contract.
replace(
    'src/workers/render.worker.ts',
    "    let color: readonly [number, number, number] | undefined;",
    "    const tipShape = candidate.tipShape === undefined ? undefined : candidate.tipShape;\n    if (tipShape !== undefined && tipShape !== 'round' && tipShape !== 'square') return null;\n    let color: readonly [number, number, number] | undefined;",
)
replace(
    'src/workers/render.worker.ts',
    "        opacity: candidate.opacity,\n        ...(color === undefined ? {} : { color }),",
    "        opacity: candidate.opacity,\n        ...(tipShape === undefined ? {} : { tipShape }),\n        ...(color === undefined ? {} : { color }),",
)

# Canonical rasterizer evaluates either circular radius or Chebyshev square distance.
replace(
    'src/gpu/baseline-raster-tile-store.ts',
    "const BASELINE_BRUSH_HARDNESS = 0.85;\nconst BASELINE_BRUSH_HARDNESS_SQUARED = BASELINE_BRUSH_HARDNESS * BASELINE_BRUSH_HARDNESS;",
    "const BASELINE_BRUSH_HARDNESS = 0.85;\n\nfunction baselineProceduralTipDistanceV1(\n  dab: BaselineBrushDabV1,\n  localX: number,\n  localY: number,\n): number {\n  return dab.tipShape === 'square'\n    ? Math.max(Math.abs(localX), Math.abs(localY))\n    : Math.hypot(localX, localY);\n}\n\nfunction baselineProceduralTipCoverageV1(\n  dab: BaselineBrushDabV1,\n  localX: number,\n  localY: number,\n): number {\n  const distance = baselineProceduralTipDistanceV1(dab, localX, localY);\n  if (distance >= 1) return 0;\n  return distance <= BASELINE_BRUSH_HARDNESS\n    ? 1\n    : clamp01(1 - smoothstep(BASELINE_BRUSH_HARDNESS, 1, distance));\n}",
)
# Rewrite the repeated round-only coverage blocks in color, erase, smudge and blur.
text = Path('src/gpu/baseline-raster-tile-store.ts').read_text()
text = text.replace("      const localYSquared = localY * localY;\n      if (localYSquared >= 1) continue;", "      if (Math.abs(localY) >= 1) continue;")
text = text.replace("    const localYSquared = localY * localY;\n    if (localYSquared >= 1) continue;", "    if (Math.abs(localY) >= 1) continue;")
old = """        const distanceSquared = localX * localX + localYSquared;\n        if (distanceSquared >= 1) continue;\n        const tipCoverage =\n          distanceSquared <= BASELINE_BRUSH_HARDNESS_SQUARED\n            ? 1\n            : clamp01(1 - smoothstep(BASELINE_BRUSH_HARDNESS, 1, Math.sqrt(distanceSquared)));"""
new = """        const tipCoverage = baselineProceduralTipCoverageV1(dab, localX, localY);\n        if (tipCoverage <= 0) continue;"""
text = text.replace(old, new)
old2 = """      const distanceSquared = localX * localX + localYSquared;\n      if (distanceSquared >= 1) continue;\n      const tipCoverage =\n        distanceSquared <= BASELINE_BRUSH_HARDNESS_SQUARED\n          ? 1\n          : clamp01(1 - smoothstep(BASELINE_BRUSH_HARDNESS, 1, Math.sqrt(distanceSquared)));"""
text = text.replace(old2, """      const tipCoverage = baselineProceduralTipCoverageV1(dab, localX, localY);\n      if (tipCoverage <= 0) continue;""")
old3 = """      const distanceSquared = localX * localX + localYSquared;\n      if (distanceSquared >= 1) continue;\n      const eraseAlpha =\n        distanceSquared <= BASELINE_BRUSH_HARDNESS_SQUARED\n          ? opacity\n          : clamp01(\n              opacity * (1 - smoothstep(BASELINE_BRUSH_HARDNESS, 1, Math.sqrt(distanceSquared))),\n            );"""
text = text.replace(old3, """      const eraseAlpha = opacity * baselineProceduralTipCoverageV1(dab, localX, localY);""")
old4 = """      const distanceSquared = localX * localX + localYSquared;\n      if (distanceSquared >= 1) continue;\n      const strength =\n        distanceSquared <= BASELINE_BRUSH_HARDNESS_SQUARED\n          ? opacity\n          : clamp01(\n              opacity * (1 - smoothstep(BASELINE_BRUSH_HARDNESS, 1, Math.sqrt(distanceSquared))),\n            );"""
text = text.replace(old4, """      const strength = opacity * baselineProceduralTipCoverageV1(dab, localX, localY);""")
Path('src/gpu/baseline-raster-tile-store.ts').write_text(text)

# Square paint uses canonical dirty-tile presentation, avoiding the round-only provisional GPU/Canvas2D stamp path.
replace(
    'src/gpu/baseline-paint-renderer.ts',
    "      if (operation !== 'paint') {",
    "      if (operation !== 'paint' || delta.some((dab) => dab.tipShape === 'square')) {",
)
replace(
    'src/app/renderer-controller.ts',
    "      if (operation !== 'paint') {",
    "      if (operation !== 'paint' || dabs.some((dab) => dab.tipShape === 'square')) {",
)

# Inspector/preset controller exposes the procedural shape and pushes it into PaintSession.
replace(
    'src/app/brush-preset-controller.ts',
    "  brushParameterLimitsV1,\n  brushParameterValuesV1,",
    "  brushParameterLimitsV1,\n  brushParameterValuesV1,\n  brushProceduralTipShapeV1,",
)
replace(
    'src/app/brush-preset-controller.ts',
    "  updateBrushPresetParametersV1,\n  type BrushPresetLibraryStateV1,",
    "  updateBrushPresetParametersV1,\n  updateBrushPresetProceduralTipV1,\n  type BrushPresetLibraryStateV1,",
)
replace(
    'src/app/brush-preset-controller.ts',
    "  const flowNumber = requireElement('#brush-flow-number', HTMLInputElement);",
    "  const flowNumber = requireElement('#brush-flow-number', HTMLInputElement);\n  const tipShape = requireElement('#brush-tip-shape', HTMLSelectElement);",
)
replace(
    'src/app/brush-preset-controller.ts',
    "    input.paintSession.setBrushParameters(parameters);",
    "    input.paintSession.setBrushParameters(parameters);\n    input.paintSession.setBrushTipShape(brushProceduralTipShapeV1(item.preset));",
)
replace(
    'src/app/brush-preset-controller.ts',
    "    input.root.dataset.illustroBrushFlow = String(parameters.flow);",
    "    input.root.dataset.illustroBrushFlow = String(parameters.flow);\n    input.root.dataset.illustroBrushTipShape = brushProceduralTipShapeV1(item.preset);",
)
replace(
    'src/app/brush-preset-controller.ts',
    "    propertyStatus.textContent = `${parameters.sizePx.toFixed(1)} px · ${Math.round(parameters.opacity * 100)}% · ${Math.round(parameters.flow * 100)}%`;",
    "    tipShape.value = brushProceduralTipShapeV1(selected.preset);\n    propertyStatus.textContent = `${parameters.sizePx.toFixed(1)} px · ${Math.round(parameters.opacity * 100)}% · ${Math.round(parameters.flow * 100)}%`;",
)
replace(
    'src/app/brush-preset-controller.ts',
    "      flowNumber,\n    ]) {",
    "      flowNumber,\n      tipShape,\n    ]) {",
)
replace(
    'src/app/brush-preset-controller.ts',
    "  const onFlowNumber = (): void => updateParameter({ flow: Number(flowNumber.value) });",
    "  const onFlowNumber = (): void => updateParameter({ flow: Number(flowNumber.value) });\n  const onTipShape = (): void =>\n    mutate(() =>\n      updateBrushPresetProceduralTipV1(\n        state,\n        state.selectedPresetId,\n        tipShape.value === 'square' ? 'square' : 'round',\n      ),\n    );",
)
replace(
    'src/app/brush-preset-controller.ts',
    "  flowNumber.addEventListener('change', onFlowNumber);",
    "  flowNumber.addEventListener('change', onFlowNumber);\n  tipShape.addEventListener('change', onTipShape);",
)
replace(
    'src/app/brush-preset-controller.ts',
    "      flowNumber.removeEventListener('change', onFlowNumber);",
    "      flowNumber.removeEventListener('change', onFlowNumber);\n      tipShape.removeEventListener('change', onTipShape);",
)

replace(
    'src/index.html',
    "              <div class=\"shell-brush-property-row\">\n                <label for=\"brush-flow-range\">流量</label>\n                <input id=\"brush-flow-range\" type=\"range\" min=\"0.01\" max=\"1\" step=\"0.01\" value=\"1\" />\n                <span class=\"shell-brush-property-number shell-brush-property-percent\"><input id=\"brush-flow-number\" type=\"number\" inputmode=\"decimal\" min=\"0.01\" max=\"1\" step=\"0.01\" value=\"1\" aria-label=\"ブラシ流量数値\" /><span>×</span></span>\n              </div>",
    "              <div class=\"shell-brush-property-row\">\n                <label for=\"brush-flow-range\">流量</label>\n                <input id=\"brush-flow-range\" type=\"range\" min=\"0.01\" max=\"1\" step=\"0.01\" value=\"1\" />\n                <span class=\"shell-brush-property-number shell-brush-property-percent\"><input id=\"brush-flow-number\" type=\"number\" inputmode=\"decimal\" min=\"0.01\" max=\"1\" step=\"0.01\" value=\"1\" aria-label=\"ブラシ流量数値\" /><span>×</span></span>\n              </div>\n              <div class=\"shell-brush-property-row shell-brush-tip-property-row\">\n                <label for=\"brush-tip-shape\">ブラシ形状</label>\n                <select id=\"brush-tip-shape\" aria-label=\"自動生成ブラシ形状\">\n                  <option value=\"round\">円形</option>\n                  <option value=\"square\">四角</option>\n                </select>\n                <span class=\"shell-brush-tip-kind\">自動生成</span>\n              </div>",
)
append(
    'public/app-shell.css',
    """/* M6A procedural brush tip */\n.shell-brush-tip-property-row select {\n  min-width: 0;\n  min-height: 32px;\n  border: 1px solid #dfe5ef;\n  border-radius: 8px;\n  padding: 0 8px;\n  background: #fff;\n  color: #38445d;\n  font: inherit;\n}\n\n.shell-brush-tip-kind {\n  color: #8792a6;\n  font-size: 9px;\n  text-align: right;\n}\n""",
)

# Regression coverage: descriptor persistence, runtime dab identity, and square-vs-round raster semantics.
Path('tests/unit/procedural-brush-tip.test.ts').write_text("""import { describe, expect, it } from 'vitest';\nimport {\n  brushProceduralTipShapeV1,\n  createBaselineBrushPresetV1,\n  withBrushProceduralTipShapeV1,\n} from '../../src/domain/brush-schema.js';\nimport { BaselineBrushDabBuilderV1 } from '../../src/gpu/baseline-brush.js';\nimport {\n  BaselineRasterTileStoreV1,\n  readBaselineRasterTilePixelV1,\n} from '../../src/gpu/baseline-raster-tile-store.js';\n\ndescribe('M6A-017 procedural brush tip', () => {\n  it('normalizes round by default and persists square without changing the brush schema', () => {\n    const baseline = createBaselineBrushPresetV1({\n      id: 'tip.test',\n      name: 'Tip Test',\n      category: 'Test',\n      behavior: 'paint',\n    });\n    expect(brushProceduralTipShapeV1(baseline)).toBe('round');\n    const square = withBrushProceduralTipShapeV1(baseline, 'square');\n    expect(square.schema).toBe('illustro.brush/1');\n    expect(square.tip.kind).toBe('procedural-square');\n    expect(brushProceduralTipShapeV1(square)).toBe('square');\n  });\n\n  it('captures the procedural tip identity into every generated dab', () => {\n    const builder = new BaselineBrushDabBuilderV1({ sizePx: 16, tipShape: 'square' });\n    builder.begin({ documentX: 32, documentY: 32 });\n    builder.append([{ documentX: 40, documentY: 32 }]);\n    expect(builder.finish().every((dab) => dab.tipShape === 'square')).toBe(true);\n  });\n\n  it('renders square corners that remain outside the equivalent round tip', () => {\n    const round = new BaselineRasterTileStoreV1(64, 64, 'rgba8-unorm', [\n      { layerId: 'layer', visible: true, opacity: 1 },\n    ]);\n    const square = new BaselineRasterTileStoreV1(64, 64, 'rgba8-unorm', [\n      { layerId: 'layer', visible: true, opacity: 1 },\n    ]);\n    const dab = {\n      schema: 'illustro.baseline-brush-dab/1' as const,\n      x: 32,\n      y: 32,\n      radius: 8,\n      opacity: 1,\n      color: [1, 0, 0] as const,\n    };\n    round.applyDabs('layer', 'round', [Object.freeze({ ...dab, tipShape: 'round' as const })], 'paint');\n    square.applyDabs('layer', 'square', [Object.freeze({ ...dab, tipShape: 'square' as const })], 'paint');\n    round.finalize('round');\n    square.finalize('square');\n    const roundTile = round.exportTiles()[0];\n    const squareTile = square.exportTiles()[0];\n    if (roundTile === undefined || squareTile === undefined) throw new Error('missing raster tile');\n    const cornerPixel = 26 * roundTile.width + 26;\n    expect(readBaselineRasterTilePixelV1(roundTile, cornerPixel)[3]).toBe(0);\n    expect(readBaselineRasterTilePixelV1(squareTile, cornerPixel)[3]).toBeGreaterThan(0);\n  });\n});\n""")

# Contract/progress/design source of truth.
replace(
    'IMPLEMENTATION_PROGRESS.md',
    'M6A-017 procedural tip:未完了',
    'M6A-017 procedural tip:完了',
)
replace(
    'scripts/verify-m6a-brush.mjs',
    "requireText(\n  progress,\n  'M6A-PERF-001 incremental active-stroke rendering（stable prefix + bounded mutable tail）:未完了',",
    "requireText(progress, 'M6A-017 procedural tip:完了', 'M6A-017 progress is not complete');\nrequireText(\n  read('src/domain/brush-schema.ts'),\n  'brushProceduralTipShapeV1',\n  'procedural tip descriptor normalization missing',\n);\nrequireText(\n  read('src/gpu/baseline-raster-tile-store.ts'),\n  'baselineProceduralTipCoverageV1',\n  'procedural tip raster coverage missing',\n);\nrequireText(read('src/index.html'), 'id=\"brush-tip-shape\"', 'reachable procedural tip control missing');\nrequireText(\n  read('tests/unit/procedural-brush-tip.test.ts'),\n  'square corners',\n  'procedural tip raster regression coverage missing',\n);\nrequireText(\n  progress,\n  'M6A-PERF-001 incremental active-stroke rendering（stable prefix + bounded mutable tail）:未完了',",
)
append(
    'ILLUSTRO_DESIGN_MEMO.md',
    """#### M6A procedural-tip boundary — 2026-09-03\n\n- Procedural brush tips are canonical brush-preset data, not UI-only choices. M6A-017 initially supports generated `round` and `square` tip geometry while retaining old `procedural-round` presets as backward-compatible round tips.\n- The selected procedural tip is captured when a stroke begins and is carried by each deterministic dab so Worker/Main/recovery paths cannot reinterpret an existing stroke after the preset changes.\n- Canonical Raster Tile coverage is authoritative. A square paint tip uses incremental affected-tile recomposition rather than the older round-only provisional stamp path, preserving visible/canonical agreement without replaying the full stroke/history.\n- Sampled/custom/multiple tip assets remain separate M6A-018..020 work; M6A-017 does not create a competing resource manager ahead of M6A-072.\n""",
)

print('M6A-017 procedural tip patch applied')
