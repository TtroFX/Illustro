from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    target = Path(path)
    text = target.read_text()
    if new in text:
        return
    if old not in text:
        raise SystemExit(f'anchor not found in {path}: {old[:120]!r}')
    target.write_text(text.replace(old, new, 1))


def insert_before_line(path: str, marker: str, block: str, guard: str) -> None:
    target = Path(path)
    text = target.read_text()
    if guard in text:
        return
    index = text.find(marker)
    if index < 0:
        raise SystemExit(f'marker not found in {path}: {marker!r}')
    line_start = text.rfind('\n', 0, index) + 1
    target.write_text(text[:line_start] + block + text[line_start:])


def append_once(path: str, guard: str, block: str) -> None:
    target = Path(path)
    text = target.read_text()
    if guard in text:
        return
    target.write_text(text.rstrip() + '\n\n' + block.strip() + '\n')


# Reference/Sub View -> profile-aware Color Match statistics.
replace_once(
    'src/app/reference-workflow-controller.ts',
    "import { freezeRgbUnitColorV1, type RgbUnitColorV1 } from '../domain/color.js';\n",
    "import { freezeRgbUnitColorV1, type RgbUnitColorV1 } from '../domain/color.js';\n"
    "import { convertEncodedRgbV1 } from '../domain/color-management.js';\n"
    "import type { DocumentColorSpace } from '../domain/document.js';\n"
    "import {\n"
    "  colorMatchStatisticsFromRgba8V1,\n"
    "  type ColorMatchStatisticsV1,\n"
    "} from './color-match.js';\n",
)
replace_once(
    'src/app/reference-workflow-controller.ts',
    "export interface ReferenceWorkflowControllerV1 {\n  refresh(): void;\n  dispose(): void;\n  snapshot(): ReferenceWorkspaceStateV1;\n}\n",
    "export interface ReferenceWorkflowControllerV1 {\n"
    "  refresh(): void;\n"
    "  dispose(): void;\n"
    "  activeReferenceLabel(): string | null;\n"
    "  activeColorStatistics(targetSpace: DocumentColorSpace): Promise<ColorMatchStatisticsV1 | null>;\n"
    "  snapshot(): ReferenceWorkspaceStateV1;\n"
    "}\n",
)
replace_once(
    'src/app/reference-workflow-controller.ts',
    "  const scratchContext = scratch.getContext('2d', { willReadFrequently: true });\n",
    "  const scratchContext = scratch.getContext('2d', { willReadFrequently: true });\n"
    "  const statisticsCanvas = document.createElement('canvas');\n"
    "  const statisticsContext = statisticsCanvas.getContext('2d', { willReadFrequently: true });\n",
)
replace_once(
    'src/app/reference-workflow-controller.ts',
    "              profileConversion: 'pending-m5d-021-025',\n",
    "              profileConversion: 'builtin-srgb-reference-baseline',\n",
)
insert_before_line(
    'src/app/reference-workflow-controller.ts',
    '  const onImport =',
    r'''  function referenceLabel(): string | null {
    const item = activeItem();
    if (item === null) return null;
    return item.resource.originalName ?? `Reference ${item.resource.resourceId.slice(0, 8)}`;
  }

  async function referenceStatistics(
    targetSpace: DocumentColorSpace,
  ): Promise<ColorMatchStatisticsV1 | null> {
    const item = activeItem();
    if (
      item === null ||
      activeBitmap?.resourceId !== item.resource.resourceId ||
      statisticsContext === null
    ) {
      return null;
    }
    const bitmap = activeBitmap.bitmap;
    const maxDimension = 96;
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    statisticsCanvas.width = width;
    statisticsCanvas.height = height;
    statisticsContext.setTransform(1, 0, 0, 1, 0, 0);
    statisticsContext.clearRect(0, 0, width, height);
    statisticsContext.imageSmoothingEnabled = true;
    statisticsContext.drawImage(bitmap, 0, 0, width, height);
    const rgba = statisticsContext.getImageData(0, 0, width, height).data;
    if (targetSpace === 'srgb') return colorMatchStatisticsFromRgba8V1(rgba, width, height);
    const converted = new Uint8ClampedArray(rgba.length);
    for (let offset = 0; offset < rgba.length; offset += 4) {
      const alpha = rgba[offset + 3] ?? 0;
      converted[offset + 3] = alpha;
      if (alpha <= 0) continue;
      const color = convertEncodedRgbV1(
        freezeRgbUnitColorV1([
          (rgba[offset] ?? 0) / 255,
          (rgba[offset + 1] ?? 0) / 255,
          (rgba[offset + 2] ?? 0) / 255,
        ]),
        'srgb',
        targetSpace,
      );
      converted[offset] = Math.round(color[0] * 255);
      converted[offset + 1] = Math.round(color[1] * 255);
      converted[offset + 2] = Math.round(color[2] * 255);
    }
    return colorMatchStatisticsFromRgba8V1(converted, width, height);
  }

''',
    'async function referenceStatistics(',
)
replace_once(
    'src/app/reference-workflow-controller.ts',
    "    snapshot(): ReferenceWorkspaceStateV1 {\n      return state;\n    },\n",
    "    activeReferenceLabel(): string | null {\n"
    "      return referenceLabel();\n"
    "    },\n"
    "    activeColorStatistics(targetSpace: DocumentColorSpace): Promise<ColorMatchStatisticsV1 | null> {\n"
    "      return referenceStatistics(targetSpace);\n"
    "    },\n"
    "    snapshot(): ReferenceWorkspaceStateV1 {\n"
    "      return state;\n"
    "    },\n",
)

# Bootstrap the explicit Color Match task controller.
replace_once(
    'src/app/main.ts',
    "import { installColorWorkflowControllerV1 } from './color-workflow-controller.js';\n",
    "import { installColorMatchControllerV1 } from './color-match-controller.js';\n"
    "import { installColorWorkflowControllerV1 } from './color-workflow-controller.js';\n",
)
replace_once('src/app/main.ts', 'void referenceWorkflow;\n', '')
replace_once(
    'src/app/main.ts',
    ");\nconst maskPaint = new MaskPaintControllerV1({\n",
    ");\n"
    "const colorMatch = installColorMatchControllerV1({\n"
    "  root,\n"
    "  paintSession,\n"
    "  paintHistory,\n"
    "  paintPersistence,\n"
    "  referenceWorkflow,\n"
    "  schedule: enqueuePaintRender,\n"
    "  onHistoryChanged: publishPaintHistory,\n"
    "  onDocumentChanged: publishDocumentState,\n"
    "});\n"
    "const maskPaint = new MaskPaintControllerV1({\n",
)
replace_once(
    'src/app/main.ts',
    "    layerWorkflow.dispose();\n    colorWorkflow.dispose();\n    maskPaint.dispose();\n",
    "    layerWorkflow.dispose();\n"
    "    colorMatch.dispose();\n"
    "    referenceWorkflow.dispose();\n"
    "    colorWorkflow.dispose();\n"
    "    maskPaint.dispose();\n",
)

# Filter menu entry and modal live preview surface.
replace_once(
    'src/index.html',
    '          <span>フィルター</span>\n',
    '''          <details class="shell-menu-dropdown">\n'''
    '''            <summary>フィルター</summary>\n'''
    '''            <div class="shell-menu-popover">\n'''
    '''              <button id="color-match-command" type="button">Color Match…</button>\n'''
    '''            </div>\n'''
    '''          </details>\n''',
)
insert_before_line(
    'src/index.html',
    'id="mask-effect-dialog"',
    r'''    <dialog id="color-match-dialog" class="document-dialog" aria-labelledby="color-match-title">
      <form id="color-match-form" method="dialog" class="document-dialog-form">
        <header><h2 id="color-match-title">Color Match</h2></header>
        <p class="document-dialog-help">Sub Viewのアクティブ参照画像の色分布を、アクティブRaster Layerへローカルかつ決定的に合わせます。プレビュー中はドキュメントを変更しません。</p>
        <div class="color-match-reference-row"><span>参照</span><output id="color-match-reference">—</output></div>
        <label class="color-match-strength">強度 <input id="color-match-strength" type="range" min="0" max="100" step="1" value="100" /><output id="color-match-strength-value">100%</output></label>
        <div class="color-match-preview-grid">
          <figure><figcaption>変更前</figcaption><canvas id="color-match-before" width="192" height="128" aria-label="Color Match変更前プレビュー"></canvas></figure>
          <figure><figcaption>変更後</figcaption><canvas id="color-match-after" width="192" height="128" aria-label="Color Match変更後プレビュー"></canvas></figure>
        </div>
        <output id="color-match-status" class="document-dialog-status" aria-live="polite"></output>
        <footer>
          <button id="color-match-cancel" type="button" class="document-dialog-secondary">キャンセル</button>
          <button id="color-match-apply" type="submit" class="document-dialog-primary" disabled>適用</button>
        </footer>
      </form>
    </dialog>
''',
    'id="color-match-dialog"',
)

append_once(
    'public/app-shell.css',
    '/* M5D Color Match */',
    r'''/* M5D Color Match */
.color-match-reference-row,
.color-match-strength {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
}

.color-match-reference-row output {
  grid-column: 2 / -1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.color-match-strength input[type='range'] {
  width: 100%;
  min-width: 120px;
}

.color-match-preview-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.color-match-preview-grid figure {
  margin: 0;
  min-width: 0;
}

.color-match-preview-grid figcaption {
  margin-bottom: 6px;
  font-size: 12px;
  color: var(--illustro-muted, #667085);
}

.color-match-preview-grid canvas {
  display: block;
  width: 100%;
  max-height: 180px;
  object-fit: contain;
  image-rendering: auto;
  border: 1px solid rgba(15, 23, 42, 0.14);
  border-radius: 8px;
  background:
    linear-gradient(45deg, #e5e7eb 25%, transparent 25%),
    linear-gradient(-45deg, #e5e7eb 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #e5e7eb 75%),
    linear-gradient(-45deg, transparent 75%, #e5e7eb 75%), #fff;
  background-position: 0 0, 0 6px, 6px -6px, -6px 0;
  background-size: 12px 12px;
}

@media (max-width: 640px) {
  .color-match-preview-grid {
    grid-template-columns: 1fr;
  }
}
''',
)

# M5D verification contract and progress bookkeeping.
insert_before_line(
    'scripts/verify-m5d-color.mjs',
    "console.log('M5D color/palette verification passed');",
    r'''requireText('src/app/color-match.ts', [
  'colorMatchStatisticsFromRgba8V1',
  'readLayerColorMatchSourceV1',
  'prepareLayerColorMatchV1',
  'persistPreparedLayerColorMatchV1',
  'applyPersistedLayerColorMatchV1',
  'colorMatchPreviewImageV1',
  'Color Match requires a Raster Layer',
]);
requireText('src/app/color-match-controller.ts', [
  'installColorMatchControllerV1',
  "'color.match'",
  'activeColorStatistics',
  'persistPreparedLayerColorMatchV1',
  'commitSnapshotTransform',
]);
requireText('src/app/reference-workflow-controller.ts', [
  'activeReferenceLabel',
  'activeColorStatistics',
  'convertEncodedRgbV1',
  'colorMatchStatisticsFromRgba8V1',
]);
requireText('src/app/main.ts', ['installColorMatchControllerV1', 'colorMatch.dispose()']);
requireText('src/index.html', [
  'id="color-match-command"',
  'id="color-match-dialog"',
  'id="color-match-strength"',
  'id="color-match-before"',
  'id="color-match-after"',
  'id="color-match-apply"',
]);
requireText('IMPLEMENTATION_PROGRESS.md', [
  'M5D-028 Color Match:完了',
  'M5D-検査 M5D内部検査:完了',
]);

''',
    "requireText('src/app/color-match.ts'",
)
replace_once(
    'IMPLEMENTATION_PROGRESS.md',
    'M5D-028 Color Match:未完了\nM5D-検査 M5D内部検査:未完了\n',
    'M5D-028 Color Match:完了\nM5D-検査 M5D内部検査:完了\n'
    '再開メモ: M5D-001〜028は完了。Color MatchはSub View参照画像を既存Color Managementでドキュメント色空間へ正規化し、alpha-weighted RGB統計を用いたローカル決定論的matchingをpreview-onlyで調整後、Apply時のみcanonical Raster Tileへ永続化して単一History transactionとしてcommitする。Cancelはdocument/historyを変更しない。次はM6A-001 Raster Brush modeから再開する。\n',
)
replace_once(
    'IMPLEMENTATION_PROGRESS.md',
    '次はM5D-001 Color Wheelから再開する。',
    'M5D-001〜028とM5D内部検査まで完了。次はM6A-001 Raster Brush modeから再開する。',
)

append_once(
    'ILLUSTRO_DESIGN_MEMO.md',
    '### 2026-09-02 — M5D Color Match implementation boundary',
    r'''### 2026-09-02 — M5D Color Match implementation boundary

- Color Match is an explicit document/layer task, not a persistent rail tool. Its initial production source is the active Sub View/reference image and its target is the active editable Raster Layer.
- Reference pixels are decoded locally, treated as the reference-workspace sRGB baseline, and converted through the existing Color Management path into the active document working space before statistics are computed. No cloud or generative-AI dependency is used.
- The deterministic baseline uses alpha-weighted per-channel first/second moments (mean and standard deviation), with a bounded contrast-ratio transfer to avoid pathological amplification. This follows the classical statistical color-transfer family (Reinhard et al., 2001, DOI 10.1109/38.946629) as an algorithmic reference; no external implementation source code is copied.
- Preview preparation reads canonical Raster Tiles and keeps transformed bytes in memory only. Strength changes recompute the in-memory preview. Cancel creates no document mutation and no History transaction.
- Apply persists the prepared Raster Tiles, then commits exactly one `color.match` History transaction through the existing snapshot/history/persistence path. Existing layer identity/properties are preserved; pending compatible stroke content is materialized through the existing Rasterize path when required.
''',
)

print('M5D Color Match patch applied')
