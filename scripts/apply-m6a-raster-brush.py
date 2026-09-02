from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    target = Path(path)
    text = target.read_text()
    if old not in text:
        raise RuntimeError(f'missing patch anchor in {path}: {old[:120]!r}')
    target.write_text(text.replace(old, new, 1))


session_path = 'src/app/paint-session-controller.ts'
replace_once(
    session_path,
    """import {\n  BaselineBrushDabBuilderV1,\n  DEFAULT_BASELINE_BRUSH_COLOR_V1,\n  freezeBaselineBrushColorV1,\n  type BaselineBrushColorV1,\n  type BaselineBrushDabV1,\n} from '../gpu/baseline-brush.js';\n""",
    """import {\n  DEFAULT_BASELINE_BRUSH_COLOR_V1,\n  freezeBaselineBrushColorV1,\n  type BaselineBrushColorV1,\n  type BaselineBrushDabV1,\n} from '../gpu/baseline-brush.js';\nimport {\n  CanonicalRasterBrushStrokeV1,\n  isImplementedCanonicalBrushModeV1,\n  requireImplementedCanonicalBrushModeV1,\n  type CanonicalBrushModeIdV1,\n  type CanonicalBrushModeV1,\n  type CanonicalRasterBrushWorkSnapshotV1,\n} from './canonical-raster-brush.js';\n""",
)
replace_once(
    session_path,
    """  readonly source: PaintStrokeSourceV1;\n  readonly layerId: LayerId;\n  readonly samples: readonly PaintStrokeSampleV1[];\n""",
    """  readonly source: PaintStrokeSourceV1;\n  readonly layerId: LayerId;\n  readonly brushMode: CanonicalBrushModeV1;\n  readonly samples: readonly PaintStrokeSampleV1[];\n""",
)
replace_once(
    session_path,
    """  readonly selectedLayerIds: readonly LayerId[];\n  readonly selectionAnchorLayerId: LayerId | null;\n  readonly activeStrokeId: string | null;\n""",
    """  readonly selectedLayerIds: readonly LayerId[];\n  readonly selectionAnchorLayerId: LayerId | null;\n  readonly brushMode: CanonicalBrushModeV1;\n  readonly brushWork: CanonicalRasterBrushWorkSnapshotV1 | null;\n  readonly activeStrokeId: string | null;\n""",
)
replace_once(
    session_path,
    """  if (!Array.isArray(stroke.samples)) throw new TypeError('paint stroke samples must be an array');\n  const normalizedStroke: PaintStrokeV1 = Object.freeze({\n""",
    """  if (!Array.isArray(stroke.samples)) throw new TypeError('paint stroke samples must be an array');\n  const storedBrushMode = stroke.brushMode ?? 'raster';\n  if (!isImplementedCanonicalBrushModeV1(storedBrushMode)) {\n    throw new TypeError(`unsupported recovered brush mode: ${String(storedBrushMode)}`);\n  }\n  const normalizedStroke: PaintStrokeV1 = Object.freeze({\n""",
)
replace_once(
    session_path,
    """    source: stroke.source,\n    layerId: parseLayerId(stroke.layerId),\n    samples: Object.freeze(stroke.samples.map(parseStoredStrokeSample)),\n""",
    """    source: stroke.source,\n    layerId: parseLayerId(stroke.layerId),\n    brushMode: storedBrushMode,\n    samples: Object.freeze(stroke.samples.map(parseStoredStrokeSample)),\n""",
)

session = Path(session_path)
text = session.read_text()
text = text.replace('#activeDabBuilder', '#activeBrushStroke')
session.write_text(text)

replace_once(
    session_path,
    "#activeBrushStroke: BaselineBrushDabBuilderV1 | null = null;",
    "#activeBrushStroke: CanonicalRasterBrushStrokeV1 | null = null;",
)
replace_once(
    session_path,
    """  #rasterMaskTileLoader: RasterMaskTileLoaderV1 | null = null;\n  #paintColor: BaselineBrushColorV1 = DEFAULT_BASELINE_BRUSH_COLOR_V1;\n  #disposed = false;\n""",
    """  #rasterMaskTileLoader: RasterMaskTileLoaderV1 | null = null;\n  #paintColor: BaselineBrushColorV1 = DEFAULT_BASELINE_BRUSH_COLOR_V1;\n  #brushMode: CanonicalBrushModeV1 = 'raster';\n  #disposed = false;\n""",
)
replace_once(
    session_path,
    """      selectedLayerIds: Object.freeze([...this.#selectedLayerIds]),\n      selectionAnchorLayerId: this.#selectionAnchorLayerId,\n      activeStrokeId: this.#activeStroke?.strokeId ?? null,\n""",
    """      selectedLayerIds: Object.freeze([...this.#selectedLayerIds]),\n      selectionAnchorLayerId: this.#selectionAnchorLayerId,\n      brushMode: this.#brushMode,\n      brushWork: this.#activeBrushStroke?.snapshot() ?? null,\n      activeStrokeId: this.#activeStroke?.strokeId ?? null,\n""",
)
replace_once(
    session_path,
    """  paintColor(): BaselineBrushColorV1 {\n    return this.#paintColor;\n  }\n\n  activeLayerId(): LayerId | null {\n""",
    """  paintColor(): BaselineBrushColorV1 {\n    return this.#paintColor;\n  }\n\n  brushMode(): CanonicalBrushModeV1 {\n    return this.#brushMode;\n  }\n\n  setBrushMode(mode: CanonicalBrushModeIdV1): CanonicalBrushModeV1 {\n    const implemented = requireImplementedCanonicalBrushModeV1(mode);\n    if (implemented === this.#brushMode) return this.#brushMode;\n    this.#clearActiveStroke();\n    this.#brushMode = implemented;\n    return this.#brushMode;\n  }\n\n  activeLayerId(): LayerId | null {\n""",
)
replace_once(
    session_path,
    """      source,\n      layerId,\n      samples: Object.freeze([]),\n    });\n    const builder = new BaselineBrushDabBuilderV1({ color: this.#paintColor });\n    this.#queueActiveDabDelta(builder.beginDelta(firstSample));\n    this.#queueActiveDabDelta(builder.appendDelta(samples.slice(1)));\n""",
    """      source,\n      layerId,\n      brushMode: this.#brushMode,\n      samples: Object.freeze([]),\n    });\n    const builder = new CanonicalRasterBrushStrokeV1({ color: this.#paintColor });\n    this.#queueActiveDabDelta(builder.beginConfirmed(firstSample));\n    this.#queueActiveDabDelta(builder.appendConfirmed(samples.slice(1)));\n""",
)
replace_once(
    session_path,
    "this.#queueActiveDabDelta(builder.appendDelta(additions));",
    "this.#queueActiveDabDelta(builder.appendConfirmed(additions));",
)
replace_once(session_path, 'builder.finishDelta();', 'builder.finishConfirmed();')

main_path = 'src/app/main.ts'
replace_once(
    main_path,
    """        root.dataset.illustroPaintStrokeSamples = String(paint.activeStrokeSampleCount);\n        root.dataset.illustroPaintDabs = String(paint.activeDabCount);\n\n        if (activeStrokeId !== null) {\n""",
    """        root.dataset.illustroPaintStrokeSamples = String(paint.activeStrokeSampleCount);\n        root.dataset.illustroPaintDabs = String(paint.activeDabCount);\n        root.dataset.illustroBrushMode = paint.brushMode;\n        root.dataset.illustroBrushStableDabs = String(paint.brushWork?.stablePrefixDabCount ?? 0);\n        root.dataset.illustroBrushMutableTailDabs = String(paint.brushWork?.mutableTailDabCount ?? 0);\n        root.dataset.illustroBrushReprocessedStableDabs = String(\n          paint.brushWork?.reprocessedStableDabCount ?? 0,\n        );\n\n        if (activeStrokeId !== null) {\n""",
)
replace_once(
    main_path,
    """root.dataset.illustroPaintVisible = 'idle';\nroot.dataset.illustroPaintDabs = '0';\nroot.dataset.illustroPaintDirtyTiles = '0';\n""",
    """root.dataset.illustroPaintVisible = 'idle';\nroot.dataset.illustroPaintDabs = '0';\nroot.dataset.illustroPaintDirtyTiles = '0';\nroot.dataset.illustroBrushMode = paintSession.brushMode();\nroot.dataset.illustroBrushStableDabs = '0';\nroot.dataset.illustroBrushMutableTailDabs = '0';\nroot.dataset.illustroBrushReprocessedStableDabs = '0';\n""",
)

progress_path = 'IMPLEMENTATION_PROGRESS.md'
replace_once(progress_path, 'M6A-001 Raster Brush mode:未完了', 'M6A-001 Raster Brush mode:完了')
replace_once(
    progress_path,
    """M6A-001 Raster Brush mode:完了\nM6A-002 Eraser mode:未完了\n""",
    """M6A-001 Raster Brush mode:完了\n再開メモ: M6A-001 Raster Brush modeはproduction PaintSessionをCanonicalRasterBrushStrokeV1へ接続し、既存M4 dab builderを低レベル決定論kernelとして再利用する構成で完了。strokeにはbrushMode=rasterを保存し、旧snapshotはmode欠落時にrasterへ互換復元する。通常pointer batchは新規confirmed sampleだけをappendConfirmedへ渡し、stable-prefix再処理数を0として観測可能にした。M6A-PERF-001〜004は専用scaling/renderer検証が必要なため未完了のまま。次はM6A-002 Eraser modeから再開する。\nM6A-002 Eraser mode:未完了\n""",
)

package_path = 'package.json'
replace_once(
    package_path,
    '    "verify:m5d": "node scripts/verify-m5d-color.mjs"\n',
    '    "verify:m5d": "node scripts/verify-m5d-color.mjs",\n    "verify:m6a": "node scripts/verify-m6a-brush.mjs"\n',
)

memo = Path('ILLUSTRO_DESIGN_MEMO.md')
text = memo.read_text()
marker = '### 2026-09-02 — M6A Raster Brush production boundary'
if marker not in text:
    text += """\n\n### 2026-09-02 — M6A Raster Brush production boundary\n\n- M6A starts by promoting the already-proven incremental M4 raster dab path behind an explicit Canonical Brush Engine facade rather than replacing its deterministic low-level raster kernel.\n- The production stroke record carries an explicit `brushMode`; legacy M4/M5 snapshots without that field normalize to `raster`, preserving recovery compatibility while creating the extension boundary for Eraser, Smudge/Finger and Blur modes.\n- Raster Brush sends only newly confirmed samples into the incremental dab kernel. Its current mutable stabilization tail is zero, so all emitted raster dabs immediately become stable-prefix work; stable-prefix reprocessing is instrumented explicitly and must remain zero on the ordinary path.\n- This M6A-001 promotion does not by itself close M6A-PERF-001〜004. Those gates remain separate and require renderer/transfer counters plus the authoritative long-stroke scaling workload before being marked complete.\n"""
    memo.write_text(text)
