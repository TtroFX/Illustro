from pathlib import Path


def replace_once(path: str, before: str, after: str) -> None:
    file_path = Path(path)
    text = file_path.read_text()
    count = text.count(before)
    if count != 1:
        raise SystemExit(f"{path}: expected one anchor, found {count}: {before[:80]!r}")
    file_path.write_text(text.replace(before, after, 1))


replace_once(
    "tests/unit/blend-modes.test.ts",
    """    expect(result[0]).toBeCloseTo(0.5142857142857143, 8);\n    expect(result[1]).toBeCloseTo(0.32142857142857145, 8);\n    expect(result[2]).toBeCloseTo(0.20714285714285716, 8);\n""",
    """    expect(result[0]).toBeCloseTo(0.4714285714285714, 8);\n    expect(result[1]).toBeCloseTo(0.34285714285714286, 8);\n    expect(result[2]).toBeCloseTo(0.2, 8);\n""",
)

replace_once(
    "src/gpu/baseline-raster-tile-store.ts",
    "import type { DocumentPrecision } from '../domain/document.js';\n",
    "import type { DocumentPrecision } from '../domain/document.js';\nimport type { BlendModeId } from '../domain/layers.js';\n",
)
replace_once(
    "src/gpu/baseline-raster-tile-store.ts",
    "import { tileBoundsForDocumentV1, tileKeyV1, type TileCoordinateV1 } from './sparse-tile-model.js';\n",
    """import {\n  compositeBlendRgbaV1,\n  isM5cBaseBlendModeV1,\n} from './blend-modes.js';\nimport { tileBoundsForDocumentV1, tileKeyV1, type TileCoordinateV1 } from './sparse-tile-model.js';\n""",
)
replace_once(
    "src/gpu/baseline-raster-tile-store.ts",
    """  readonly opacity: number;\n  readonly draft?: boolean;\n""",
    """  readonly opacity: number;\n  readonly draft?: boolean;\n  readonly blendMode?: BlendModeId;\n""",
)
replace_once(
    "src/gpu/baseline-raster-tile-store.ts",
    """        const sourcePixel = readPixel(source, pixel);\n        const destination = readPixel(output, pixel);\n        const sourceAlpha = sourcePixel[3] * layer.opacity;\n        const outputAlpha = sourceAlpha + destination[3] * (1 - sourceAlpha);\n        const red =\n          outputAlpha > 0\n            ? (sourcePixel[0] * sourceAlpha + destination[0] * destination[3] * (1 - sourceAlpha)) /\n              outputAlpha\n            : 0;\n        const green =\n          outputAlpha > 0\n            ? (sourcePixel[1] * sourceAlpha + destination[1] * destination[3] * (1 - sourceAlpha)) /\n              outputAlpha\n            : 0;\n        const blue =\n          outputAlpha > 0\n            ? (sourcePixel[2] * sourceAlpha + destination[2] * destination[3] * (1 - sourceAlpha)) /\n              outputAlpha\n            : 0;\n        writePixel(output, pixel, [red, green, blue, outputAlpha]);\n""",
    """        const sourcePixel = readPixel(source, pixel);\n        const destination = readPixel(output, pixel);\n        const blendMode = layer.blendMode ?? 'normal';\n        if (!isM5cBaseBlendModeV1(blendMode)) {\n          throw new Error(`unsupported baseline blend mode: ${blendMode}`);\n        }\n        writePixel(\n          output,\n          pixel,\n          compositeBlendRgbaV1(destination, sourcePixel, layer.opacity, blendMode),\n        );\n""",
)
replace_once(
    "src/gpu/baseline-raster-tile-store.ts",
    """        seen.add(layer.layerId);\n        return Object.freeze({\n          layerId: layer.layerId,\n          visible: layer.visible,\n          opacity: layer.opacity,\n          draft: layer.draft ?? false,\n        });\n""",
    """        const blendMode = layer.blendMode ?? 'normal';\n        if (!isM5cBaseBlendModeV1(blendMode)) {\n          throw new Error(`unsupported baseline blend mode: ${blendMode}`);\n        }\n        seen.add(layer.layerId);\n        return Object.freeze({\n          layerId: layer.layerId,\n          visible: layer.visible,\n          opacity: layer.opacity,\n          draft: layer.draft ?? false,\n          ...(blendMode === 'normal' ? {} : { blendMode }),\n        });\n""",
)

replace_once(
    "src/app/paint-session-controller.ts",
    """        opacity: layer.opacity,\n        ...(layer.roleFlags.draft ? { draft: true } : {}),\n""",
    """        opacity: layer.opacity,\n        ...(layer.roleFlags.draft ? { draft: true } : {}),\n        ...(layer.blendMode === 'normal' ? {} : { blendMode: layer.blendMode }),\n""",
)

replace_once(
    "src/workers/render.worker.ts",
    "import type { BaselineBrushDabV1 } from '../gpu/baseline-brush.js';\n",
    "import type { BaselineBrushDabV1 } from '../gpu/baseline-brush.js';\nimport { isM5cBaseBlendModeV1 } from '../gpu/blend-modes.js';\n",
)
replace_once(
    "src/workers/render.worker.ts",
    """      (candidate.draft !== undefined && typeof candidate.draft !== 'boolean') ||\n      !Number.isFinite(candidate.opacity) ||\n""",
    """      (candidate.draft !== undefined && typeof candidate.draft !== 'boolean') ||\n      (candidate.blendMode !== undefined && !isM5cBaseBlendModeV1(candidate.blendMode)) ||\n      !Number.isFinite(candidate.opacity) ||\n""",
)
replace_once(
    "src/workers/render.worker.ts",
    """        opacity: candidate.opacity,\n        draft: candidate.draft ?? false,\n""",
    """        opacity: candidate.opacity,\n        draft: candidate.draft ?? false,\n        ...(candidate.blendMode === undefined ? {} : { blendMode: candidate.blendMode }),\n""",
)

replace_once(
    "src/app/renderer-controller.ts",
    """            opacity: layer.opacity,\n            draft: layer.draft ?? false,\n""",
    """            opacity: layer.opacity,\n            draft: layer.draft ?? false,\n            ...(layer.blendMode === undefined ? {} : { blendMode: layer.blendMode }),\n""",
)

replace_once(
    "src/app/layer-operations.ts",
    """  AdjustmentLayerV1,\n  EffectMaskAttachmentV1,\n""",
    """  AdjustmentLayerV1,\n  BlendModeId,\n  EffectMaskAttachmentV1,\n""",
)
replace_once(
    "src/app/layer-operations.ts",
    "export function setLayerAllLockSnapshotV1(\n",
    """export function setLayerBlendModeSnapshotV1(\n  snapshot: PaintProjectSnapshotV1,\n  layerId: LayerId,\n  blendMode: BlendModeId,\n  revision: Revision,\n  now: Date = new Date(),\n): PaintProjectSnapshotV1 {\n  if (blendMode === 'pass-through') {\n    throw new Error('Folder Pass Through uses the dedicated folder blend command');\n  }\n  return replaceLayerV1(snapshot, layerId, revision, now, (layer) => {\n    if (layer.blendMode === blendMode) throw new Error('layer blend mode has no changes');\n    return Object.freeze({ ...layer, revision, blendMode });\n  });\n}\n\nexport function setLayerAllLockSnapshotV1(\n""",
)

replace_once(
    "src/app/layer-workflow-controller.ts",
    "import type { LayerBaseV1 } from '../domain/layers.js';\n",
    "import type { LayerBaseV1 } from '../domain/layers.js';\nimport { isM5cBaseBlendModeV1 } from '../gpu/blend-modes.js';\n",
)
replace_once(
    "src/app/layer-workflow-controller.ts",
    """  setLayerAlphaLockSnapshotV1,\n  setLayerClippingSnapshotV1,\n  setLayerOpacitySnapshotV1,\n""",
    """  setLayerAlphaLockSnapshotV1,\n  setLayerBlendModeSnapshotV1,\n  setLayerClippingSnapshotV1,\n  setLayerOpacitySnapshotV1,\n""",
)
replace_once(
    "src/app/layer-workflow-controller.ts",
    "  const opacityInput = required<HTMLInputElement>('#layer-opacity');\n",
    "  const opacityInput = required<HTMLInputElement>('#layer-opacity');\n  const blendModeSelect = required<HTMLSelectElement>('#layer-blend-mode');\n",
)
replace_once(
    "src/app/layer-workflow-controller.ts",
    "    opacityInput.disabled = disabled;\n",
    """    opacityInput.disabled = disabled;\n    blendModeSelect.disabled =\n      disabled ||\n      active?.layer.type !== 'raster' ||\n      active.layer.locks.all ||\n      options.paintSession.activeStrokeId() !== null;\n""",
)
replace_once(
    "src/app/layer-workflow-controller.ts",
    """    if (active !== null) {\n      opacityInput.value = String(Math.round(active.layer.opacity * 100));\n""",
    """    if (active !== null) {\n      opacityInput.value = String(Math.round(active.layer.opacity * 100));\n      blendModeSelect.value = active.layer.blendMode;\n""",
)
replace_once(
    "src/app/layer-workflow-controller.ts",
    """    } else {\n      opacityInput.value = '100';\n""",
    """    } else {\n      opacityInput.value = '100';\n      blendModeSelect.value = 'normal';\n""",
)
replace_once(
    "src/app/layer-workflow-controller.ts",
    """    root.dataset.illustroActiveLayerId = activeLayerId ?? '';\n    root.dataset.illustroLayerWorkflow = 'ready';\n""",
    """    root.dataset.illustroActiveLayerId = activeLayerId ?? '';\n    root.dataset.illustroLayerBlendMode = active?.layer.blendMode ?? '';\n    root.dataset.illustroLayerWorkflow = 'ready';\n""",
)
replace_once(
    "src/app/layer-workflow-controller.ts",
    "  const onLock = (): void => {\n",
    """  const onBlendMode = (): void => {\n    const active = currentActive();\n    if (active === null || active.layer.type !== 'raster') return;\n    const blendMode = blendModeSelect.value;\n    if (!isM5cBaseBlendModeV1(blendMode)) {\n      publishError(new Error(`unsupported blend mode: ${blendMode}`));\n      refresh();\n      return;\n    }\n    commitMutation(\n      'layer.blend-mode',\n      (before, revision) =>\n        setLayerBlendModeSnapshotV1(before, active.id, blendMode, revision),\n      () => active.id,\n    );\n  };\n\n  const onLock = (): void => {\n""",
)
replace_once(
    "src/app/layer-workflow-controller.ts",
    """  opacityInput.addEventListener('change', onOpacity);\n  lockButton.addEventListener('click', onLock);\n""",
    """  opacityInput.addEventListener('change', onOpacity);\n  blendModeSelect.addEventListener('change', onBlendMode);\n  lockButton.addEventListener('click', onLock);\n""",
)
replace_once(
    "src/app/layer-workflow-controller.ts",
    """      opacityInput.removeEventListener('change', onOpacity);\n      lockButton.removeEventListener('click', onLock);\n""",
    """      opacityInput.removeEventListener('change', onOpacity);\n      blendModeSelect.removeEventListener('change', onBlendMode);\n      lockButton.removeEventListener('click', onLock);\n""",
)

replace_once(
    "src/index.html",
    """              <label class=\"shell-layer-opacity\" title=\"不透明度\"><span aria-hidden=\"true\">◐</span><input id=\"layer-opacity\" type=\"number\" min=\"0\" max=\"100\" step=\"1\" value=\"100\" aria-label=\"レイヤー不透明度 パーセント\" /></label>\n""",
    """              <label class=\"shell-layer-opacity\" title=\"不透明度\"><span aria-hidden=\"true\">◐</span><input id=\"layer-opacity\" type=\"number\" min=\"0\" max=\"100\" step=\"1\" value=\"100\" aria-label=\"レイヤー不透明度 パーセント\" /></label>\n              <label class=\"shell-layer-blend\" title=\"描画モード\"><span>描画</span><select id=\"layer-blend-mode\" aria-label=\"レイヤー描画モード\"><option value=\"normal\">通常</option><option value=\"darken\">比較（暗）</option><option value=\"multiply\">乗算</option><option value=\"color-burn\">焼き込みカラー</option><option value=\"linear-burn\">焼き込み（リニア）</option><option value=\"darker-color\">カラー比較（暗）</option><option value=\"lighten\">比較（明）</option><option value=\"screen\">スクリーン</option><option value=\"color-dodge\">覆い焼きカラー</option><option value=\"linear-dodge\">覆い焼き（リニア）/加算</option></select></label>\n""",
)
css = Path("public/app-shell.css")
css.write_text(
    css.read_text()
    + """

.shell-layer-blend {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  min-width: 10.5rem;
}

.shell-layer-blend > span {
  font-size: 0.72rem;
  color: var(--shell-muted, #5b6475);
}

.shell-layer-blend select {
  min-width: 0;
  max-width: 11rem;
  height: 2rem;
  border: 1px solid rgba(83, 94, 122, 0.24);
  border-radius: 0.5rem;
  background: #fff;
  font: inherit;
}
"""
)

replace_once(
    "package.json",
    '    "verify:m5b": "node scripts/verify-m5b-layer-foundation.mjs"\n',
    '    "verify:m5b": "node scripts/verify-m5b-layer-foundation.mjs",\n    "verify:m5c": "node scripts/verify-m5c-compositor.mjs"\n',
)
replace_once(
    ".github/workflows/ci.yml",
    """      - name: M5B layer creation inspection\n        run: npm run verify:m5b\n      - name: Production build\n""",
    """      - name: M5B layer creation inspection\n        run: npm run verify:m5b\n      - name: M5C blend compositor inspection\n        run: npm run verify:m5c\n      - name: Production build\n""",
)

progress = Path("IMPLEMENTATION_PROGRESS.md")
text = progress.read_text()
for label in [
    "M5C-001 Normal",
    "M5C-002 Darken",
    "M5C-003 Multiply",
    "M5C-004 Color Burn",
    "M5C-005 Linear Burn",
    "M5C-006 Darker Color",
    "M5C-007 Lighten",
    "M5C-008 Screen",
    "M5C-009 Color Dodge",
    "M5C-010 Linear Dodge/Add",
]:
    before = f"{label}:未完了"
    after = f"{label}:完了"
    if text.count(before) != 1:
        raise SystemExit(f"progress anchor missing: {before}")
    text = text.replace(before, after, 1)
text = text.replace(
    "次はM5C-001 Normal blend modeから再開する。",
    "M5C-001〜010のbase blend modeはcanonical Raster Tile compositorへ接続済み。次はM5C-011 Lighter Colorから再開する。",
    1,
)
progress.write_text(text)
