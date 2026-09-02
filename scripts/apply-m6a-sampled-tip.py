from pathlib import Path


def replace(path: str, old: str, new: str, count: int = 1) -> None:
    p = Path(path)
    text = p.read_text()
    if text.count(old) < count:
        raise RuntimeError(f'missing anchor in {path}: {old[:140]!r}')
    p.write_text(text.replace(old, new, count))


def append(path: str, text: str) -> None:
    p = Path(path)
    current = p.read_text()
    if text.strip() in current:
        return
    p.write_text(current.rstrip() + '\n\n' + text.strip() + '\n')

# ---------- brush schema / preset model ----------
replace(
    'src/domain/brush-schema.ts',
    "import { toJsonValue, type JsonValue } from './serialization.js';",
    "import {\n  createBuiltInSampledBrushTipV1,\n  normalizeBrushTipMaskAssetV1,\n  type BrushTipMaskAssetV1,\n} from './brush-tip-mask.js';\nimport { toJsonValue, type JsonValue } from './serialization.js';",
)
replace(
    'src/domain/brush-schema.ts',
    "export function brushProceduralTipShapeV1(preset: BrushPresetV1): BrushProceduralTipShapeV1 {\n  return preset.tip.kind === 'procedural-square' ? 'square' : 'round';\n}\n",
    "export function brushProceduralTipShapeV1(preset: BrushPresetV1): BrushProceduralTipShapeV1 {\n  return preset.tip.kind === 'procedural-square' ? 'square' : 'round';\n}\n\nexport function brushSampledTipAssetsV1(preset: BrushPresetV1): readonly BrushTipMaskAssetV1[] {\n  if (preset.tip.kind !== 'sampled-mask' || !Array.isArray(preset.tip.assets)) return Object.freeze([]);\n  if (preset.tip.assets.length < 1 || preset.tip.assets.length > 8) return Object.freeze([]);\n  try {\n    return Object.freeze(\n      preset.tip.assets.map((asset) =>\n        normalizeBrushTipMaskAssetV1(asset as unknown as BrushTipMaskAssetV1),\n      ),\n    );\n  } catch {\n    return Object.freeze([]);\n  }\n}\n\nexport function withBrushSampledTipV1(\n  preset: BrushPresetV1,\n  asset: BrushTipMaskAssetV1 = createBuiltInSampledBrushTipV1(),\n): BrushPresetV1 {\n  const normalized = normalizeBrushTipMaskAssetV1(asset);\n  return normalizeBrushPresetV1({\n    ...preset,\n    tip: { ...preset.tip, kind: 'sampled-mask', assets: [normalized] },\n  });\n}\n",
)

replace(
    'src/app/brush-preset-library.ts',
    "  withBrushProceduralTipShapeV1,\n  type BrushBehaviorV1,",
    "  withBrushProceduralTipShapeV1,\n  withBrushSampledTipV1,\n  type BrushBehaviorV1,",
)
replace(
    'src/app/brush-preset-library.ts',
    "export function deleteBrushPresetV1(\n",
    "export function updateBrushPresetSampledTipV1(\n  state: BrushPresetLibraryStateV1,\n  presetId: string,\n): BrushPresetLibraryStateV1 {\n  return updateItemV1(state, presetId, (item) => {\n    if (item.locked) throw new Error('locked brush preset cannot be edited');\n    const current = withBrushSampledTipV1(item.preset);\n    if (JSON.stringify(current) === JSON.stringify(item.preset)) return item;\n    const next = normalizeBrushPresetV1({ ...current, revision: item.preset.revision + 1 });\n    return itemV1({\n      source: item.source,\n      baseline: item.baseline,\n      preset: next,\n      locked: item.locked,\n    });\n  });\n}\n\nexport function deleteBrushPresetV1(\n",
)

# ---------- baseline dab identity ----------
replace(
    'src/gpu/baseline-brush.ts',
    "  readonly tipShape?: BaselineBrushTipShapeV1;\n  readonly color?: BaselineBrushColorV1;",
    "  readonly tipShape?: BaselineBrushTipShapeV1;\n  readonly tipMaskIndex?: number;\n  readonly color?: BaselineBrushColorV1;",
)
replace(
    'src/gpu/baseline-brush.ts',
    "  tipShape: BaselineBrushTipShapeV1,\n): BaselineBrushDabV1 {",
    "  tipShape: BaselineBrushTipShapeV1,\n  tipMaskIndex: number | undefined,\n): BaselineBrushDabV1 {",
)
replace(
    'src/gpu/baseline-brush.ts',
    "    tipShape,\n    color,",
    "    tipShape,\n    ...(tipMaskIndex === undefined ? {} : { tipMaskIndex }),\n    color,",
)
replace(
    'src/gpu/baseline-brush.ts',
    "  readonly #tipShape: BaselineBrushTipShapeV1;\n  #lastPoint:",
    "  readonly #tipShape: BaselineBrushTipShapeV1;\n  readonly #sampledTipMaskCount: number;\n  #lastPoint:",
)
replace(
    'src/gpu/baseline-brush.ts',
    "      readonly tipShape?: BaselineBrushTipShapeV1;\n    } = {},",
    "      readonly tipShape?: BaselineBrushTipShapeV1;\n      readonly sampledTipMaskCount?: number;\n    } = {},",
)
replace(
    'src/gpu/baseline-brush.ts',
    "    if (this.#tipShape !== 'round' && this.#tipShape !== 'square') {\n      throw new TypeError('unsupported baseline brush tip shape');\n    }\n    this.#distanceUntilNext = this.#spacing;",
    "    if (this.#tipShape !== 'round' && this.#tipShape !== 'square') {\n      throw new TypeError('unsupported baseline brush tip shape');\n    }\n    this.#sampledTipMaskCount = options.sampledTipMaskCount ?? 0;\n    if (\n      !Number.isSafeInteger(this.#sampledTipMaskCount) ||\n      this.#sampledTipMaskCount < 0 ||\n      this.#sampledTipMaskCount > 8\n    ) {\n      throw new RangeError('sampled brush tip mask count must be within 0..8');\n    }\n    this.#distanceUntilNext = this.#spacing;",
)
# Every freezeDab call currently ends with this.#tipShape; add the sampled index after it.
text = Path('src/gpu/baseline-brush.ts').read_text()
text = text.replace("        this.#tipShape,\n      ),", "        this.#tipShape,\n        this.#sampledTipMaskCount > 0 ? 0 : undefined,\n      ),")
text = text.replace("            this.#tipShape,\n          ),", "            this.#tipShape,\n            this.#sampledTipMaskCount > 0 ? 0 : undefined,\n          ),")
text = text.replace("          this.#tipShape,\n        ),", "          this.#tipShape,\n          this.#sampledTipMaskCount > 0 ? 0 : undefined,\n        ),")
Path('src/gpu/baseline-brush.ts').write_text(text)

replace(
    'src/app/canonical-raster-brush.ts',
    "      readonly tipShape?: BaselineBrushTipShapeV1;\n    } = {},",
    "      readonly tipShape?: BaselineBrushTipShapeV1;\n      readonly sampledTipMaskCount?: number;\n    } = {},",
)
replace(
    'src/app/canonical-raster-brush.ts',
    "      ...(options.tipShape === undefined ? {} : { tipShape: options.tipShape }),\n    });",
    "      ...(options.tipShape === undefined ? {} : { tipShape: options.tipShape }),\n      ...(options.sampledTipMaskCount === undefined\n        ? {}\n        : { sampledTipMaskCount: options.sampledTipMaskCount }),\n    });",
)

# ---------- canonical sampled-mask rasterization ----------
replace(
    'src/gpu/baseline-raster-tile-store.ts',
    "import { isM5cBaseBlendModeV1, type M5cBaseBlendModeV1 } from './blend-modes.js';",
    "import { sampleBrushTipMaskRuntimeV1, type BrushTipMaskRuntimeV1 } from '../domain/brush-tip-mask.js';\nimport { isM5cBaseBlendModeV1, type M5cBaseBlendModeV1 } from './blend-modes.js';",
)
replace(
    'src/gpu/baseline-raster-tile-store.ts',
    "function baselineProceduralTipCoverageV1(\n  dab: BaselineBrushDabV1,\n  localX: number,\n  localY: number,\n): number {\n  const distance = baselineProceduralTipDistanceV1(dab, localX, localY);\n  if (distance >= 1) return 0;\n  return distance <= BASELINE_BRUSH_HARDNESS\n    ? 1\n    : clamp01(1 - smoothstep(BASELINE_BRUSH_HARDNESS, 1, distance));\n}",
    "function baselineBrushTipCoverageV1(\n  dab: BaselineBrushDabV1,\n  localX: number,\n  localY: number,\n  tipMasks: readonly BrushTipMaskRuntimeV1[],\n): number {\n  if (dab.tipMaskIndex !== undefined) {\n    const mask = tipMasks[dab.tipMaskIndex];\n    if (mask === undefined) return 0;\n    return sampleBrushTipMaskRuntimeV1(mask, (localX + 1) * 0.5, (localY + 1) * 0.5);\n  }\n  const distance = baselineProceduralTipDistanceV1(dab, localX, localY);\n  if (distance >= 1) return 0;\n  return distance <= BASELINE_BRUSH_HARDNESS\n    ? 1\n    : clamp01(1 - smoothstep(BASELINE_BRUSH_HARDNESS, 1, distance));\n}",
)
# Add tipMasks to low-level rasterizer signatures and coverage calls.
text = Path('src/gpu/baseline-raster-tile-store.ts').read_text()
text = text.replace(
    "  dab: BaselineBrushDabV1,\n  accumulatedCoverage: Float32Array | null,\n): void {",
    "  dab: BaselineBrushDabV1,\n  accumulatedCoverage: Float32Array | null,\n  tipMasks: readonly BrushTipMaskRuntimeV1[],\n): void {",
    1,
)
text = text.replace(
    "  dab: BaselineBrushDabV1,\n): void {",
    "  dab: BaselineBrushDabV1,\n  tipMasks: readonly BrushTipMaskRuntimeV1[],\n): void {",
    1,
)
# Smudge/blur signatures are unique through their snapshot parameters.
text = text.replace(
    "  documentHeight: number,\n): boolean {",
    "  documentHeight: number,\n  tipMasks: readonly BrushTipMaskRuntimeV1[],\n): boolean {",
    1,
)
# Second boolean rasterizer is Blur.
pos = text.find("  documentHeight: number,\n): boolean {", text.find("rasterizeBlurDab"))
if pos < 0:
    raise RuntimeError('blur rasterizer signature anchor missing')
text = text[:pos] + text[pos:].replace(
    "  documentHeight: number,\n): boolean {",
    "  documentHeight: number,\n  tipMasks: readonly BrushTipMaskRuntimeV1[],\n): boolean {",
    1,
)
text = text.replace("baselineProceduralTipCoverageV1(dab, localX, localY)", "baselineBrushTipCoverageV1(dab, localX, localY, tipMasks)")
Path('src/gpu/baseline-raster-tile-store.ts').write_text(text)

replace(
    'src/gpu/baseline-raster-tile-store.ts',
    "    operation: BaselineBrushCompositeOperationV1 = 'paint',\n  ): void {",
    "    operation: BaselineBrushCompositeOperationV1 = 'paint',\n    tipMasks: readonly BrushTipMaskRuntimeV1[] = Object.freeze([]),\n  ): void {",
)
replace(
    'src/gpu/baseline-raster-tile-store.ts',
    "      this.#applySmudgeDabs(layerId, dabs);",
    "      this.#applySmudgeDabs(layerId, dabs, tipMasks);",
)
replace(
    'src/gpu/baseline-raster-tile-store.ts',
    "      this.#applyBlurDabs(layerId, dabs);",
    "      this.#applyBlurDabs(layerId, dabs, tipMasks);",
)
replace(
    'src/gpu/baseline-raster-tile-store.ts',
    "        if (operation === 'erase') rasterizeEraseDab(tile, bounds.x, bounds.y, dab);\n        else rasterizeColorDab(tile, bounds.x, bounds.y, dab, coverage);",
    "        if (operation === 'erase') rasterizeEraseDab(tile, bounds.x, bounds.y, dab, tipMasks);\n        else rasterizeColorDab(tile, bounds.x, bounds.y, dab, coverage, tipMasks);",
)
replace(
    'src/gpu/baseline-raster-tile-store.ts',
    "  #applySmudgeDabs(layerId: string, dabs: readonly BaselineBrushDabV1[]): void {",
    "  #applySmudgeDabs(\n    layerId: string,\n    dabs: readonly BaselineBrushDabV1[],\n    tipMasks: readonly BrushTipMaskRuntimeV1[],\n  ): void {",
)
replace(
    'src/gpu/baseline-raster-tile-store.ts',
    "          this.#documentHeight,\n        );\n        if (!changed) continue;",
    "          this.#documentHeight,\n          tipMasks,\n        );\n        if (!changed) continue;",
    1,
)
replace(
    'src/gpu/baseline-raster-tile-store.ts',
    "  #applyBlurDabs(layerId: string, dabs: readonly BaselineBrushDabV1[]): void {",
    "  #applyBlurDabs(\n    layerId: string,\n    dabs: readonly BaselineBrushDabV1[],\n    tipMasks: readonly BrushTipMaskRuntimeV1[],\n  ): void {",
)
# Blur call appears after smudge call; replace next occurrence.
text = Path('src/gpu/baseline-raster-tile-store.ts').read_text()
idx = text.find('const changed = rasterizeBlurDab(')
if idx < 0:
    raise RuntimeError('blur call missing')
tail = text[idx:]
old = "          this.#documentHeight,\n        );"
if old not in tail:
    raise RuntimeError('blur call tail missing')
tail = tail.replace(old, "          this.#documentHeight,\n          tipMasks,\n        );", 1)
Path('src/gpu/baseline-raster-tile-store.ts').write_text(text[:idx] + tail)

# ---------- paint renderer: one sampled asset snapshot per stroke ----------
replace(
    'src/gpu/baseline-paint-renderer.ts',
    "import type { DocumentColorSpace, DocumentPrecision } from '../domain/document.js';",
    "import {\n  decodeBrushTipMaskAssetV1,\n  normalizeBrushTipMaskAssetV1,\n  type BrushTipMaskAssetV1,\n  type BrushTipMaskRuntimeV1,\n} from '../domain/brush-tip-mask.js';\nimport type { DocumentColorSpace, DocumentPrecision } from '../domain/document.js';",
)
replace(
    'src/gpu/baseline-paint-renderer.ts',
    "  readonly dabs: readonly BaselineBrushDabV1[];\n}",
    "  readonly dabs: readonly BaselineBrushDabV1[];\n  readonly tipAssets?: readonly BrushTipMaskAssetV1[];\n}",
    1,
)
replace(
    'src/gpu/baseline-paint-renderer.ts',
    "  readonly operation: BaselineBrushCompositeOperationV1;\n  readonly dabs: BaselineBrushDabV1[];\n}",
    "  readonly operation: BaselineBrushCompositeOperationV1;\n  readonly dabs: BaselineBrushDabV1[];\n  readonly tipMasks: readonly BrushTipMaskRuntimeV1[];\n}",
)
replace(
    'src/gpu/baseline-paint-renderer.ts',
    "        ...(dab.tipShape === undefined ? {} : { tipShape: dab.tipShape }),\n        ...(dab.color === undefined",
    "        ...(dab.tipShape === undefined ? {} : { tipShape: dab.tipShape }),\n        ...(dab.tipMaskIndex === undefined ? {} : { tipMaskIndex: dab.tipMaskIndex }),\n        ...(dab.color === undefined",
)
replace(
    'src/gpu/baseline-paint-renderer.ts',
    "    (dab.tipShape === undefined || dab.tipShape === 'round' || dab.tipShape === 'square')\n  );",
    "    (dab.tipShape === undefined || dab.tipShape === 'round' || dab.tipShape === 'square') &&\n    (dab.tipMaskIndex === undefined ||\n      (Number.isSafeInteger(dab.tipMaskIndex) && dab.tipMaskIndex >= 0 && dab.tipMaskIndex < 8))\n  );",
)
replace(
    'src/gpu/baseline-paint-renderer.ts',
    "    (left.tipShape ?? 'round') === (right.tipShape ?? 'round') &&\n    baselineDabColorV1(left).every(",
    "    (left.tipShape ?? 'round') === (right.tipShape ?? 'round') &&\n    left.tipMaskIndex === right.tipMaskIndex &&\n    baselineDabColorV1(left).every(",
)
replace(
    'src/gpu/baseline-paint-renderer.ts',
    "      dab.tipShape === 'square' ||\n      (baselineDabUsesFlowOpacityV1(dab)",
    "      dab.tipShape === 'square' ||\n      dab.tipMaskIndex !== undefined ||\n      (baselineDabUsesFlowOpacityV1(dab)",
)
replace(
    'src/gpu/baseline-paint-renderer.ts',
    "function isDabPrefix(\n",
    "function decodeTipAssetsV1(assets: readonly BrushTipMaskAssetV1[] | undefined): readonly BrushTipMaskRuntimeV1[] {\n  if (assets === undefined || assets.length === 0) return Object.freeze([]);\n  if (assets.length > 8) throw new RangeError('baseline stroke sampled tip asset count exceeds 8');\n  return Object.freeze(assets.map((asset) => decodeBrushTipMaskAssetV1(normalizeBrushTipMaskAssetV1(asset))));\n}\n\nfunction isDabPrefix(\n",
)
replace(
    'src/gpu/baseline-paint-renderer.ts',
    "    operation: BaselineBrushCompositeOperationV1 = 'paint',\n  ): BaselinePaintRendererSnapshotV1 {",
    "    operation: BaselineBrushCompositeOperationV1 = 'paint',\n    tipAssets?: readonly BrushTipMaskAssetV1[],\n  ): BaselinePaintRendererSnapshotV1 {",
    1,
)
replace(
    'src/gpu/baseline-paint-renderer.ts',
    "      this.#activeStroke = { strokeId, operation, dabs: [] };",
    "      this.#activeStroke = { strokeId, operation, dabs: [], tipMasks: decodeTipAssetsV1(tipAssets) };",
)
replace(
    'src/gpu/baseline-paint-renderer.ts',
    "    canonicalTiles.applyDabs(this.#resolveLayerId(layerId), strokeId, delta, operation);",
    "    const tipMasks = this.#activeStroke.tipMasks;\n    if (delta.some((dab) => dab.tipMaskIndex !== undefined && tipMasks[dab.tipMaskIndex] === undefined)) {\n      throw new Error('sampled brush dab references a missing tip mask');\n    }\n    canonicalTiles.applyDabs(this.#resolveLayerId(layerId), strokeId, delta, operation, tipMasks);",
)
replace(
    'src/gpu/baseline-paint-renderer.ts',
    "    operation: BaselineBrushCompositeOperationV1 = 'paint',\n  ): BaselinePaintFinalizationV1 {",
    "    operation: BaselineBrushCompositeOperationV1 = 'paint',\n    tipAssets?: readonly BrushTipMaskAssetV1[],\n  ): BaselinePaintFinalizationV1 {",
)
replace(
    'src/gpu/baseline-paint-renderer.ts',
    "        canonicalTiles.applyDabs(resolvedLayerId, strokeId, missingTail, operation);",
    "        canonicalTiles.applyDabs(resolvedLayerId, strokeId, missingTail, operation, active.tipMasks);",
)
replace(
    'src/gpu/baseline-paint-renderer.ts',
    "      this.#activeStroke = { strokeId, operation, dabs: [...frozenDabs] };\n      canonicalTiles.applyDabs(resolvedLayerId, strokeId, frozenDabs, operation);",
    "      const tipMasks = decodeTipAssetsV1(tipAssets);\n      if (frozenDabs.some((dab) => dab.tipMaskIndex !== undefined && tipMasks[dab.tipMaskIndex] === undefined)) {\n        throw new Error('sampled brush finalization references a missing tip mask');\n      }\n      this.#activeStroke = { strokeId, operation, dabs: [...frozenDabs], tipMasks };\n      canonicalTiles.applyDabs(resolvedLayerId, strokeId, frozenDabs, operation, tipMasks);",
)
replace(
    'src/gpu/baseline-paint-renderer.ts',
    "      this.#canonicalTiles.applyDabs(layerId, stroke.strokeId, dabs, stroke.operation ?? 'paint');",
    "      const tipMasks = decodeTipAssetsV1(stroke.tipAssets);\n      if (dabs.some((dab) => dab.tipMaskIndex !== undefined && tipMasks[dab.tipMaskIndex] === undefined)) {\n        throw new Error('restored sampled brush stroke references a missing tip mask');\n      }\n      this.#canonicalTiles.applyDabs(\n        layerId,\n        stroke.strokeId,\n        dabs,\n        stroke.operation ?? 'paint',\n        tipMasks,\n      );",
)

# ---------- paint session: stroke-level serialized mask snapshot ----------
replace(
    'src/app/paint-session-controller.ts',
    "import {\n  DEFAULT_BRUSH_PARAMETER_VALUES_V1,",
    "import { normalizeBrushTipMaskAssetV1, type BrushTipMaskAssetV1 } from '../domain/brush-tip-mask.js';\nimport {\n  DEFAULT_BRUSH_PARAMETER_VALUES_V1,",
)
replace(
    'src/app/paint-session-controller.ts',
    "      readonly dabs: readonly BaselineBrushDabV1[];\n    }[],",
    "      readonly dabs: readonly BaselineBrushDabV1[];\n      readonly tipAssets?: readonly BrushTipMaskAssetV1[];\n    }[],",
)
replace(
    'src/app/paint-session-controller.ts',
    "  readonly brushMode: CanonicalBrushModeV1;\n  readonly samples: readonly PaintStrokeSampleV1[];",
    "  readonly brushMode: CanonicalBrushModeV1;\n  readonly brushTipAssets?: readonly BrushTipMaskAssetV1[];\n  readonly samples: readonly PaintStrokeSampleV1[];",
)
replace(
    'src/app/paint-session-controller.ts',
    "  readonly brushTipShape: BaselineBrushTipShapeV1;\n  readonly brushWork:",
    "  readonly brushTipShape: BaselineBrushTipShapeV1;\n  readonly brushSampledTipAssetCount: number;\n  readonly brushWork:",
)
replace(
    'src/app/paint-session-controller.ts',
    "    brushMode: storedBrushMode,\n    samples: Object.freeze(stroke.samples.map(parseStoredStrokeSample)),",
    "    brushMode: storedBrushMode,\n    ...(stroke.brushTipAssets === undefined\n      ? {}\n      : {\n          brushTipAssets: Object.freeze(\n            (Array.isArray(stroke.brushTipAssets) ? stroke.brushTipAssets : []).map((asset) =>\n              normalizeBrushTipMaskAssetV1(asset as BrushTipMaskAssetV1),\n            ),\n          ),\n        }),\n    samples: Object.freeze(stroke.samples.map(parseStoredStrokeSample)),",
)
# parse dabs with mask index
replace(
    'src/app/paint-session-controller.ts',
    "  const tipShape = value.tipShape === undefined ? undefined : value.tipShape;\n  if (tipShape !== undefined && tipShape !== 'round' && tipShape !== 'square') {\n    throw new TypeError('invalid baseline dab tip shape');\n  }",
    "  const tipShape = value.tipShape === undefined ? undefined : value.tipShape;\n  if (tipShape !== undefined && tipShape !== 'round' && tipShape !== 'square') {\n    throw new TypeError('invalid baseline dab tip shape');\n  }\n  const tipMaskIndex = value.tipMaskIndex === undefined ? undefined : value.tipMaskIndex;\n  if (\n    tipMaskIndex !== undefined &&\n    (!Number.isSafeInteger(tipMaskIndex) || (tipMaskIndex as number) < 0 || (tipMaskIndex as number) >= 8)\n  ) {\n    throw new TypeError('invalid baseline dab tip mask index');\n  }",
)
replace(
    'src/app/paint-session-controller.ts',
    "    ...(tipShape === undefined ? {} : { tipShape }),\n    ...(color === undefined ? {} : { color }),",
    "    ...(tipShape === undefined ? {} : { tipShape }),\n    ...(tipMaskIndex === undefined ? {} : { tipMaskIndex: tipMaskIndex as number }),\n    ...(color === undefined ? {} : { color }),",
)
replace(
    'src/app/paint-session-controller.ts',
    "  return Object.freeze({\n    stroke,\n    dabs: Object.freeze([...dabs]),\n    bakedToRasterLayer,\n  });",
    "  const storedStroke =\n    bakedToRasterLayer && stroke.brushTipAssets !== undefined\n      ? Object.freeze({\n          schema: stroke.schema,\n          strokeId: stroke.strokeId,\n          pointerId: stroke.pointerId,\n          source: stroke.source,\n          layerId: stroke.layerId,\n          brushMode: stroke.brushMode,\n          samples: stroke.samples,\n        })\n      : stroke;\n  return Object.freeze({\n    stroke: storedStroke,\n    dabs: Object.freeze([...dabs]),\n    bakedToRasterLayer,\n  });",
)
replace(
    'src/app/paint-session-controller.ts',
    "  #brushTipShape: BaselineBrushTipShapeV1 = 'round';\n  #disposed = false;",
    "  #brushTipShape: BaselineBrushTipShapeV1 = 'round';\n  #brushSampledTipAssets: readonly BrushTipMaskAssetV1[] = Object.freeze([]);\n  #disposed = false;",
)
replace(
    'src/app/paint-session-controller.ts',
    "      brushTipShape: this.#brushTipShape,\n      brushWork:",
    "      brushTipShape: this.#brushTipShape,\n      brushSampledTipAssetCount: this.#brushSampledTipAssets.length,\n      brushWork:",
)
replace(
    'src/app/paint-session-controller.ts',
    "  setBrushMode(mode: CanonicalBrushModeIdV1): CanonicalBrushModeV1 {",
    "  setBrushSampledTipAssets(assets: readonly BrushTipMaskAssetV1[]): readonly BrushTipMaskAssetV1[] {\n    if (assets.length > 8) throw new RangeError('sampled brush tip assets exceed 8');\n    const normalized = Object.freeze(assets.map(normalizeBrushTipMaskAssetV1));\n    if (JSON.stringify(normalized) !== JSON.stringify(this.#brushSampledTipAssets)) this.#clearActiveStroke();\n    this.#brushSampledTipAssets = normalized;\n    return this.#brushSampledTipAssets;\n  }\n\n  brushSampledTipAssets(): readonly BrushTipMaskAssetV1[] {\n    return this.#brushSampledTipAssets;\n  }\n\n  activeStrokeBrushTipAssets(): readonly BrushTipMaskAssetV1[] {\n    return this.#activeStroke?.brushTipAssets ?? Object.freeze([]);\n  }\n\n  setBrushMode(mode: CanonicalBrushModeIdV1): CanonicalBrushModeV1 {",
)
replace(
    'src/app/paint-session-controller.ts',
    "      brushMode: this.#brushMode,\n      samples: Object.freeze([]),",
    "      brushMode: this.#brushMode,\n      ...(this.#brushSampledTipAssets.length === 0\n        ? {}\n        : { brushTipAssets: this.#brushSampledTipAssets }),\n      samples: Object.freeze([]),",
)
replace(
    'src/app/paint-session-controller.ts',
    "      tipShape: this.#brushTipShape,\n    });",
    "      tipShape: this.#brushTipShape,\n      sampledTipMaskCount: this.#brushSampledTipAssets.length,\n    });",
)
replace(
    'src/app/paint-session-controller.ts',
    "        dabs: entry.dabs,\n      })),",
    "        dabs: entry.dabs,\n        ...(entry.stroke.brushTipAssets === undefined\n          ? {}\n          : { tipAssets: entry.stroke.brushTipAssets }),\n      })),",
    2,
)

# ---------- renderer controller / worker protocol ----------
replace(
    'src/app/renderer-controller.ts',
    "import type { DocumentColorSpace, DocumentPrecision } from '../domain/document.js';",
    "import type { BrushTipMaskAssetV1 } from '../domain/brush-tip-mask.js';\nimport type { DocumentColorSpace, DocumentPrecision } from '../domain/document.js';",
)
# Present signature and worker/main call.
replace(
    'src/app/renderer-controller.ts',
    "    operation: BaselineBrushCompositeOperationV1 = 'paint',\n  ): Promise<BaselinePaintRendererSnapshotV1> {",
    "    operation: BaselineBrushCompositeOperationV1 = 'paint',\n    tipAssets?: readonly BrushTipMaskAssetV1[],\n  ): Promise<BaselinePaintRendererSnapshotV1> {",
    1,
)
replace(
    'src/app/renderer-controller.ts',
    "          operation,\n        },",
    "          operation,\n          ...(tipAssets === undefined ? {} : { tipAssets }),\n        },",
    1,
)
replace(
    'src/app/renderer-controller.ts',
    "    const paint = this.#mainBaselinePaint.presentStroke(strokeId, dabs, layerId, operation);",
    "    const paint = this.#mainBaselinePaint.presentStroke(\n      strokeId,\n      dabs,\n      layerId,\n      operation,\n      tipAssets,\n    );",
)
replace(
    'src/app/renderer-controller.ts',
    "      if (operation !== 'paint' || dabs.some((dab) => dab.tipShape === 'square')) {",
    "      if (\n        operation !== 'paint' ||\n        dabs.some((dab) => dab.tipShape === 'square' || dab.tipMaskIndex !== undefined)\n      ) {",
)
# Finalize signature and calls.
replace(
    'src/app/renderer-controller.ts',
    "    operation: BaselineBrushCompositeOperationV1 = 'paint',\n  ): Promise<BaselinePaintFinalizationV1> {",
    "    operation: BaselineBrushCompositeOperationV1 = 'paint',\n    tipAssets?: readonly BrushTipMaskAssetV1[],\n  ): Promise<BaselinePaintFinalizationV1> {",
)
# The second worker object occurrence after finalize signature.
text = Path('src/app/renderer-controller.ts').read_text()
marker = "type: 'renderer.paint.finalize'"
pos = text.find(marker)
if pos < 0:
    raise RuntimeError('renderer finalize request missing')
tail = text[pos:]
old = "        operation,\n      });"
if old not in tail:
    raise RuntimeError('renderer finalize request operation anchor missing')
tail = tail.replace(old, "        operation,\n        ...(tipAssets === undefined ? {} : { tipAssets }),\n      });", 1)
text = text[:pos] + tail
text = text.replace(
    "    const finalization = this.#mainBaselinePaint.finalizeStroke(strokeId, dabs, layerId, operation);",
    "    const finalization = this.#mainBaselinePaint.finalizeStroke(\n      strokeId,\n      dabs,\n      layerId,\n      operation,\n      tipAssets,\n    );",
    1,
)
Path('src/app/renderer-controller.ts').write_text(text)

# Worker protocol imports/type/parser/handler.
replace(
    'src/workers/render.worker.ts',
    "import type { GpuAtlasPixelFormatV1 } from '../gpu/gpu-atlas.js';",
    "import { normalizeBrushTipMaskAssetV1, type BrushTipMaskAssetV1 } from '../domain/brush-tip-mask.js';\nimport type { GpuAtlasPixelFormatV1 } from '../gpu/gpu-atlas.js';",
)
replace(
    'src/workers/render.worker.ts',
    "      readonly operation: BaselineBrushCompositeOperationV1;\n    }",
    "      readonly operation: BaselineBrushCompositeOperationV1;\n      readonly tipAssets?: readonly BrushTipMaskAssetV1[];\n    }",
    1,
)
# Dabs parser includes tipMaskIndex.
replace(
    'src/workers/render.worker.ts',
    "    const tipShape = candidate.tipShape === undefined ? undefined : candidate.tipShape;\n    if (tipShape !== undefined && tipShape !== 'round' && tipShape !== 'square') return null;",
    "    const tipShape = candidate.tipShape === undefined ? undefined : candidate.tipShape;\n    if (tipShape !== undefined && tipShape !== 'round' && tipShape !== 'square') return null;\n    const tipMaskIndex = candidate.tipMaskIndex === undefined ? undefined : candidate.tipMaskIndex;\n    if (\n      tipMaskIndex !== undefined &&\n      (!Number.isSafeInteger(tipMaskIndex) || (tipMaskIndex as number) < 0 || (tipMaskIndex as number) >= 8)\n    ) return null;",
)
replace(
    'src/workers/render.worker.ts',
    "        ...(tipShape === undefined ? {} : { tipShape }),\n        ...(color === undefined ? {} : { color }),",
    "        ...(tipShape === undefined ? {} : { tipShape }),\n        ...(tipMaskIndex === undefined ? {} : { tipMaskIndex: tipMaskIndex as number }),\n        ...(color === undefined ? {} : { color }),",
)
replace(
    'src/workers/render.worker.ts',
    "function parseBaselineCommittedStrokes(\n",
    "function parseTipAssets(value: unknown): readonly BrushTipMaskAssetV1[] | null {\n  if (value === undefined) return Object.freeze([]);\n  if (!Array.isArray(value) || value.length > 8) return null;\n  try {\n    return Object.freeze(value.map((asset) => normalizeBrushTipMaskAssetV1(asset as BrushTipMaskAssetV1)));\n  } catch {\n    return null;\n  }\n}\n\nfunction parseBaselineCommittedStrokes(\n",
)
# Stored stroke parser: add tipAssets to result.
replace(
    'src/workers/render.worker.ts',
    "    const operation = (candidate.operation ?? 'paint') as BaselineBrushCompositeOperationV1;\n    strokes.push(",
    "    const operation = (candidate.operation ?? 'paint') as BaselineBrushCompositeOperationV1;\n    const tipAssets = parseTipAssets(candidate.tipAssets);\n    if (tipAssets === null) return null;\n    strokes.push(",
)
replace(
    'src/workers/render.worker.ts',
    "        ? Object.freeze({ strokeId: candidate.strokeId, operation, dabs })",
    "        ? Object.freeze({\n            strokeId: candidate.strokeId,\n            operation,\n            dabs,\n            ...(tipAssets.length === 0 ? {} : { tipAssets }),\n          })",
)
replace(
    'src/workers/render.worker.ts',
    "            operation,\n            dabs,\n          }),",
    "            operation,\n            dabs,\n            ...(tipAssets.length === 0 ? {} : { tipAssets }),\n          }),",
    1,
)
# paint present/finalize request parser
replace(
    'src/workers/render.worker.ts',
    "    const dabs = parseBaselineDabs(value.dabs);\n    return dabs === null\n      ? null\n      : {",
    "    const dabs = parseBaselineDabs(value.dabs);\n    const tipAssets = parseTipAssets(value.tipAssets);\n    return dabs === null || tipAssets === null\n      ? null\n      : {",
)
replace(
    'src/workers/render.worker.ts',
    "          operation: (value.operation ?? 'paint') as BaselineBrushCompositeOperationV1,\n        };",
    "          operation: (value.operation ?? 'paint') as BaselineBrushCompositeOperationV1,\n          ...(tipAssets.length === 0 ? {} : { tipAssets }),\n        };",
)
# handlers pass assets
replace(
    'src/workers/render.worker.ts',
    "          request.operation,\n        ),",
    "          request.operation,\n          request.tipAssets,\n        ),",
    2,
)

# ---------- main runtime passes assets only on stroke start and at finalization ----------
replace(
    'src/app/main.ts',
    "          if (dabDelta.length > 0) {\n            enqueuePaintRender(() =>\n              renderer.presentBaselineStroke(\n                activeStrokeId,\n                dabDelta,\n                activeLayerId,\n                canonicalBrushCompositeOperationV1(paint.brushMode),\n              ),\n            );\n          }",
    "          if (dabDelta.length > 0) {\n            const tipAssets =\n              previousStrokeId === activeStrokeId\n                ? undefined\n                : paintSession.activeStrokeBrushTipAssets();\n            enqueuePaintRender(() =>\n              renderer.presentBaselineStroke(\n                activeStrokeId,\n                dabDelta,\n                activeLayerId,\n                canonicalBrushCompositeOperationV1(paint.brushMode),\n                tipAssets,\n              ),\n            );\n          }",
)
replace(
    'src/app/main.ts',
    "                canonicalBrushCompositeOperationV1(completed.stroke.brushMode),\n              );",
    "                canonicalBrushCompositeOperationV1(completed.stroke.brushMode),\n                completed.stroke.brushTipAssets,\n              );",
)

# ---------- preset UI: built-in sampled bitmap option ----------
replace(
    'src/app/brush-preset-controller.ts',
    "  brushProceduralTipShapeV1,\n  type BrushBehaviorV1,",
    "  brushProceduralTipShapeV1,\n  brushSampledTipAssetsV1,\n  type BrushBehaviorV1,",
)
replace(
    'src/app/brush-preset-controller.ts',
    "  updateBrushPresetProceduralTipV1,\n  type BrushPresetLibraryStateV1,",
    "  updateBrushPresetProceduralTipV1,\n  updateBrushPresetSampledTipV1,\n  type BrushPresetLibraryStateV1,",
)
replace(
    'src/app/brush-preset-controller.ts',
    "    input.paintSession.setBrushTipShape(brushProceduralTipShapeV1(item.preset));",
    "    const sampledTipAssets = brushSampledTipAssetsV1(item.preset);\n    input.paintSession.setBrushSampledTipAssets(sampledTipAssets);\n    input.paintSession.setBrushTipShape(brushProceduralTipShapeV1(item.preset));",
)
replace(
    'src/app/brush-preset-controller.ts',
    "    input.root.dataset.illustroBrushTipShape = brushProceduralTipShapeV1(item.preset);",
    "    input.root.dataset.illustroBrushTipShape =\n      sampledTipAssets.length > 0 ? 'sampled-mask' : brushProceduralTipShapeV1(item.preset);\n    input.root.dataset.illustroBrushTipAssetCount = String(sampledTipAssets.length);",
)
replace(
    'src/app/brush-preset-controller.ts',
    "    tipShape.value = brushProceduralTipShapeV1(selected.preset);",
    "    tipShape.value =\n      brushSampledTipAssetsV1(selected.preset).length > 0\n        ? 'sampled'\n        : brushProceduralTipShapeV1(selected.preset);",
)
replace(
    'src/app/brush-preset-controller.ts',
    "  const onTipShape = (): void =>\n    mutate(() =>\n      updateBrushPresetProceduralTipV1(\n        state,\n        state.selectedPresetId,\n        tipShape.value === 'square' ? 'square' : 'round',\n      ),\n    );",
    "  const onTipShape = (): void =>\n    mutate(() =>\n      tipShape.value === 'sampled'\n        ? updateBrushPresetSampledTipV1(state, state.selectedPresetId)\n        : updateBrushPresetProceduralTipV1(\n            state,\n            state.selectedPresetId,\n            tipShape.value === 'square' ? 'square' : 'round',\n          ),\n    );",
)
replace(
    'src/index.html',
    "                  <option value=\"square\">四角</option>",
    "                  <option value=\"square\">四角</option>\n                  <option value=\"sampled\">画像サンプル</option>",
)

# ---------- tests ----------
Path('tests/unit/sampled-brush-tip.test.ts').write_text("""import { describe, expect, it } from 'vitest';\nimport {\n  brushSampledTipAssetsV1,\n  createBaselineBrushPresetV1,\n  withBrushSampledTipV1,\n} from '../../src/domain/brush-schema.js';\nimport {\n  createBuiltInSampledBrushTipV1,\n  decodeBrushTipMaskAssetV1,\n  sampleBrushTipMaskRuntimeV1,\n} from '../../src/domain/brush-tip-mask.js';\nimport { BaselineBrushDabBuilderV1 } from '../../src/gpu/baseline-brush.js';\nimport {\n  BaselineRasterTileStoreV1,\n  readBaselineRasterTilePixelV1,\n} from '../../src/gpu/baseline-raster-tile-store.js';\n\ndescribe('M6A-018 sampled image tip', () => {\n  it('round-trips the bounded sampled mask through canonical brush preset data', () => {\n    const baseline = createBaselineBrushPresetV1({\n      id: 'sampled.test',\n      name: 'Sampled',\n      category: 'Test',\n      behavior: 'paint',\n    });\n    const asset = createBuiltInSampledBrushTipV1();\n    const sampled = withBrushSampledTipV1(baseline, asset);\n    expect(sampled.tip.kind).toBe('sampled-mask');\n    expect(brushSampledTipAssetsV1(sampled)).toEqual([asset]);\n  });\n\n  it('uses bilinear alpha-mask sampling at normalized brush-tip coordinates', () => {\n    const mask = decodeBrushTipMaskAssetV1(createBuiltInSampledBrushTipV1());\n    expect(sampleBrushTipMaskRuntimeV1(mask, 0.5, 0.5)).toBe(1);\n    expect(sampleBrushTipMaskRuntimeV1(mask, 0, 0)).toBe(0);\n  });\n\n  it('stores only a sampled-mask index on each dab, not a repeated bitmap payload', () => {\n    const builder = new BaselineBrushDabBuilderV1({ sampledTipMaskCount: 1 });\n    builder.begin({ documentX: 32, documentY: 32 });\n    builder.append([{ documentX: 48, documentY: 32 }]);\n    const dabs = builder.finish();\n    expect(dabs.length).toBeGreaterThan(1);\n    expect(dabs.every((dab) => dab.tipMaskIndex === 0)).toBe(true);\n    expect(dabs.some((dab) => 'tipAssets' in dab)).toBe(false);\n  });\n\n  it('rasterizes the sampled diamond mask rather than procedural radial coverage', () => {\n    const asset = createBuiltInSampledBrushTipV1();\n    const mask = decodeBrushTipMaskAssetV1(asset);\n    const store = new BaselineRasterTileStoreV1(64, 64, 'rgba8-unorm', [\n      { layerId: 'layer', visible: true, opacity: 1 },\n    ]);\n    const dab = Object.freeze({\n      schema: 'illustro.baseline-brush-dab/1' as const,\n      x: 32,\n      y: 32,\n      radius: 12,\n      opacity: 1,\n      tipMaskIndex: 0,\n      color: [1, 0, 0] as const,\n    });\n    store.applyDabs('layer', 'sampled', [dab], 'paint', [mask]);\n    store.finalize('sampled');\n    const tile = store.exportTiles()[0];\n    if (tile === undefined) throw new Error('missing sampled-tip tile');\n    expect(readBaselineRasterTilePixelV1(tile, 32 * tile.width + 32)[3]).toBeGreaterThan(0.9);\n    expect(readBaselineRasterTilePixelV1(tile, 22 * tile.width + 22)[3]).toBe(0);\n  });\n});\n""")

# ---------- progress / verifier / design memo ----------
replace('IMPLEMENTATION_PROGRESS.md', 'M6A-018 sampled image tip:未完了', 'M6A-018 sampled image tip:完了')
replace(
    'scripts/verify-m6a-brush.mjs',
    "requireText(progress, 'M6A-017 procedural tip:完了', 'M6A-017 progress is not complete');",
    "requireText(progress, 'M6A-017 procedural tip:完了', 'M6A-017 progress is not complete');\nrequireText(progress, 'M6A-018 sampled image tip:完了', 'M6A-018 progress is not complete');\nrequireText(\n  read('src/domain/brush-tip-mask.ts'),\n  'sampleBrushTipMaskRuntimeV1',\n  'sampled brush-tip bilinear mask sampler missing',\n);\nrequireText(\n  read('src/gpu/baseline-brush.ts'),\n  'tipMaskIndex',\n  'sampled brush dabs do not carry compact mask identity',\n);\nrequireText(\n  read('src/gpu/baseline-raster-tile-store.ts'),\n  'sampleBrushTipMaskRuntimeV1',\n  'sampled brush mask is not connected to canonical rasterization',\n);\nrequireText(read('src/index.html'), '<option value=\"sampled\">', 'sampled brush-tip UI is unreachable');\nrequireText(\n  read('tests/unit/sampled-brush-tip.test.ts'),\n  'not a repeated bitmap payload',\n  'sampled brush-tip storage regression coverage missing',\n);",
)
append(
    'ILLUSTRO_DESIGN_MEMO.md',
    """#### M6A sampled-image-tip boundary — 2026-09-03\n\n- M6A-018 represents a sampled brush tip as a bounded canonical grayscale/alpha mask asset in brush-preset data. The runtime decodes the mask once per active/restored stroke and samples it bilinearly in normalized tip coordinates.\n- Raster dabs carry only a small `tipMaskIndex`; the bitmap payload is snapshotted once at the stroke level rather than duplicated into every dab. After the stroke is durably baked into canonical Raster Tiles, the heavy tip-asset snapshot is removed from the long-lived stroke record.\n- Sampled-mask paint uses canonical affected-Tile presentation instead of the round-only provisional stamp shader, so Worker/Main/compatibility paths share the same visible and persisted coverage semantics.\n- M6A-018 exposes one built-in sampled-mask option to make the production path reachable. User-created image-to-mask conversion remains M6A-019, and multiple sampled assets/selection remain M6A-020. M6A-072 will later own shared resource loading/management rather than duplicating this stroke-local snapshot boundary.\n""",
)

print('M6A-018 sampled image tip patch applied')
