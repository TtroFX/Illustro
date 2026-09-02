from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    target = Path(path)
    text = target.read_text()
    if old not in text:
        raise RuntimeError(f'missing patch anchor in {path}: {old[:160]!r}')
    target.write_text(text.replace(old, new, 1))


def replace_all(path: str, old: str, new: str, minimum: int = 1) -> None:
    target = Path(path)
    text = target.read_text()
    count = text.count(old)
    if count < minimum:
        raise RuntimeError(f'missing repeated patch anchor in {path}: {old[:160]!r}')
    target.write_text(text.replace(old, new))


# Low-level brush operation vocabulary.
replace_once(
    'src/gpu/baseline-brush.ts',
    "export type BaselineBrushColorV1 = readonly [number, number, number];\n",
    "export type BaselineBrushColorV1 = readonly [number, number, number];\nexport type BaselineBrushCompositeOperationV1 = 'paint' | 'erase';\n",
)

# Canonical brush mode layer: Raster + Eraser share deterministic geometry/dab generation.
path = 'src/app/canonical-raster-brush.ts'
replace_once(
    path,
    "  type BaselineBrushColorV1,\n  type BaselineBrushDabV1,\n",
    "  type BaselineBrushColorV1,\n  type BaselineBrushCompositeOperationV1,\n  type BaselineBrushDabV1,\n",
)
replace_once(path, "export type CanonicalBrushModeV1 = 'raster';", "export type CanonicalBrushModeV1 = 'raster' | 'eraser';")
replace_once(
    path,
    "export const IMPLEMENTED_CANONICAL_BRUSH_MODES_V1 = Object.freeze([\n  'raster',\n] as const satisfies readonly CanonicalBrushModeV1[]);",
    "export const IMPLEMENTED_CANONICAL_BRUSH_MODES_V1 = Object.freeze([\n  'raster',\n  'eraser',\n] as const satisfies readonly CanonicalBrushModeV1[]);",
)
replace_once(
    path,
    "  return value === 'raster';",
    "  return value === 'raster' || value === 'eraser';",
)
replace_once(
    path,
    "export interface CanonicalRasterBrushSampleV1 {",
    "export function canonicalBrushCompositeOperationV1(\n  mode: CanonicalBrushModeV1,\n): BaselineBrushCompositeOperationV1 {\n  return mode === 'eraser' ? 'erase' : 'paint';\n}\n\nexport interface CanonicalRasterBrushSampleV1 {",
)
replace_once(path, "  readonly mode: 'raster';", "  readonly mode: CanonicalBrushModeV1;")
replace_once(
    path,
    "export class CanonicalRasterBrushStrokeV1 {\n  readonly #kernel: BaselineBrushDabBuilderV1;",
    "export class CanonicalRasterBrushStrokeV1 {\n  readonly #kernel: BaselineBrushDabBuilderV1;\n  readonly #mode: CanonicalBrushModeV1;",
)
replace_once(
    path,
    "  constructor(options: { readonly color?: BaselineBrushColorV1 } = {}) {\n    this.#kernel = new BaselineBrushDabBuilderV1(options);\n  }",
    "  constructor(\n    options: { readonly color?: BaselineBrushColorV1; readonly mode?: CanonicalBrushModeV1 } = {},\n  ) {\n    this.#mode = options.mode ?? 'raster';\n    this.#kernel = new BaselineBrushDabBuilderV1({ color: options.color });\n  }",
)
replace_once(path, "      mode: 'raster' as const,", "      mode: this.#mode,")

# Canonical Raster Tile alpha erasure. It operates on the active layer before compositing.
path = 'src/gpu/baseline-raster-tile-store.ts'
replace_once(
    path,
    "  type BaselineBrushDabV1,\n} from './baseline-brush.js';",
    "  type BaselineBrushCompositeOperationV1,\n  type BaselineBrushDabV1,\n} from './baseline-brush.js';",
)
replace_once(
    path,
    "interface ActiveTileTransactionV1 {\n  readonly strokeId: string;\n  readonly layerId: string;",
    "interface ActiveTileTransactionV1 {\n  readonly strokeId: string;\n  readonly layerId: string;\n  readonly operation: BaselineBrushCompositeOperationV1;",
)
eraser_function = r'''
function rasterizeEraseDab(
  tile: BaselineRasterTileImageV1,
  tileX: number,
  tileY: number,
  dab: BaselineBrushDabV1,
): void {
  const radiusX = baselineDabRadiusXV1(dab);
  const radiusY = baselineDabRadiusYV1(dab);
  const minX = Math.max(tileX, Math.floor(dab.x - radiusX));
  const minY = Math.max(tileY, Math.floor(dab.y - radiusY));
  const maxX = Math.min(tileX + tile.width - 1, Math.ceil(dab.x + radiusX) - 1);
  const maxY = Math.min(tileY + tile.height - 1, Math.ceil(dab.y + radiusY) - 1);
  const opacity = clamp01(dab.opacity);

  for (let documentY = minY; documentY <= maxY; documentY += 1) {
    const localY = (documentY + 0.5 - dab.y) / radiusY;
    const localYSquared = localY * localY;
    if (localYSquared >= 1) continue;
    for (let documentX = minX; documentX <= maxX; documentX += 1) {
      const localX = (documentX + 0.5 - dab.x) / radiusX;
      const distanceSquared = localX * localX + localYSquared;
      if (distanceSquared >= 1) continue;
      const eraseAlpha =
        distanceSquared <= BASELINE_BRUSH_HARDNESS_SQUARED
          ? opacity
          : clamp01(
              opacity * (1 - smoothstep(BASELINE_BRUSH_HARDNESS, 1, Math.sqrt(distanceSquared))),
            );
      if (eraseAlpha <= 0) continue;
      const pixel = (documentY - tileY) * tile.width + (documentX - tileX);
      const destination = readPixel(tile, pixel);
      if (destination[3] <= 0) continue;
      const outputAlpha = clamp01(destination[3] * (1 - eraseAlpha));
      writePixel(
        tile,
        pixel,
        outputAlpha <= 0
          ? [0, 0, 0, 0]
          : [destination[0], destination[1], destination[2], outputAlpha],
      );
    }
  }
}

'''
replace_once(path, "const MASK_SOFTEN_WEIGHTS", eraser_function + "const MASK_SOFTEN_WEIGHTS")
replace_once(
    path,
    "  applyDabs(layerId: string, strokeId: string, dabs: readonly BaselineBrushDabV1[]): void {",
    "  applyDabs(\n    layerId: string,\n    strokeId: string,\n    dabs: readonly BaselineBrushDabV1[],\n    operation: BaselineBrushCompositeOperationV1 = 'paint',\n  ): void {",
)
replace_once(
    path,
    "        strokeId,\n        layerId,\n        before: new Map(),",
    "        strokeId,\n        layerId,\n        operation,\n        before: new Map(),",
)
replace_once(
    path,
    "    if (this.#active.layerId !== layerId) throw new Error('active stroke changed raster layer');\n\n    for (const plan",
    "    if (this.#active.layerId !== layerId) throw new Error('active stroke changed raster layer');\n    if (this.#active.operation !== operation) throw new Error('active stroke changed brush operation');\n\n    for (const plan",
)
replace_once(
    path,
    "      const key = tileStateKey(layerId, plan.coordinate);\n      if (!this.#active.before.has(key)) {\n        const current = this.#tiles.get(key);\n        this.#active.before.set(key, current === undefined ? null : cloneTile(current));\n        this.#active.affected.set(key, freezeCoordinate(plan.coordinate));\n      }\n      let tile = this.#tiles.get(key);",
    "      const key = tileStateKey(layerId, plan.coordinate);\n      const current = this.#tiles.get(key);\n      if (operation === 'erase' && (current === undefined || isTransparent(current))) continue;\n      if (!this.#active.before.has(key)) {\n        this.#active.before.set(key, current === undefined ? null : cloneTile(current));\n        this.#active.affected.set(key, freezeCoordinate(plan.coordinate));\n      }\n      let tile = current;",
)
replace_once(
    path,
    "      for (const dab of plan.dabs) rasterizeColorDab(tile, bounds.x, bounds.y, dab);",
    "      for (const dab of plan.dabs) {\n        if (operation === 'erase') rasterizeEraseDab(tile, bounds.x, bounds.y, dab);\n        else rasterizeColorDab(tile, bounds.x, bounds.y, dab);\n      }",
)

# Renderer keeps active-layer semantics correct: erase patches only affected recomposited tiles.
path = 'src/gpu/baseline-paint-renderer.ts'
replace_once(
    path,
    "  planBaselineBrushTilesV1,\n  type BaselineBrushDabV1,",
    "  planBaselineBrushTilesV1,\n  type BaselineBrushCompositeOperationV1,\n  type BaselineBrushDabV1,",
)
replace_once(
    path,
    "export interface BaselinePaintCommittedStrokeV1 {\n  readonly strokeId: string;\n  readonly layerId?: string;\n  readonly dabs:",
    "export interface BaselinePaintCommittedStrokeV1 {\n  readonly strokeId: string;\n  readonly layerId?: string;\n  readonly operation?: BaselineBrushCompositeOperationV1;\n  readonly dabs:",
)
replace_once(
    path,
    "interface ActiveBaselineStrokeV1 {\n  readonly strokeId: string;\n  readonly dabs:",
    "interface ActiveBaselineStrokeV1 {\n  readonly strokeId: string;\n  readonly operation: BaselineBrushCompositeOperationV1;\n  readonly dabs:",
)
replace_once(
    path,
    "    dabs: readonly BaselineBrushDabV1[],\n    layerId?: string,\n  ): BaselinePaintRendererSnapshotV1 {",
    "    dabs: readonly BaselineBrushDabV1[],\n    layerId?: string,\n    operation: BaselineBrushCompositeOperationV1 = 'paint',\n  ): BaselinePaintRendererSnapshotV1 {",
)
replace_once(
    path,
    "    if (this.#activeStroke === null) {\n      this.#activeStroke = { strokeId, dabs: [] };\n    }\n    canonicalTiles.applyDabs(this.#resolveLayerId(layerId), strokeId, delta);\n    this.#activeStroke.dabs.push(...delta);\n    if (delta.length > 0) this.#appendDabs(delta);",
    "    if (this.#activeStroke === null) {\n      this.#activeStroke = { strokeId, operation, dabs: [] };\n    }\n    if (this.#activeStroke.operation !== operation) {\n      throw new Error('baseline paint stroke changed brush operation');\n    }\n    canonicalTiles.applyDabs(this.#resolveLayerId(layerId), strokeId, delta, operation);\n    this.#activeStroke.dabs.push(...delta);\n    if (delta.length > 0) {\n      if (operation === 'erase') {\n        const { width, height } = this.#requireDocument();\n        this.#patchCompositeTiles(\n          planBaselineBrushTilesV1(delta, width, height).map((plan) => plan.coordinate),\n        );\n      } else {\n        this.#appendDabs(delta);\n      }\n    }",
)
# Finalize signature is a second matching dabs/layerId block; anchor on function name.
replace_once(
    path,
    "  finalizeStroke(\n    strokeId: string,\n    dabs: readonly BaselineBrushDabV1[],\n    layerId?: string,\n  ): BaselinePaintFinalizationV1 {",
    "  finalizeStroke(\n    strokeId: string,\n    dabs: readonly BaselineBrushDabV1[],\n    layerId?: string,\n    operation: BaselineBrushCompositeOperationV1 = 'paint',\n  ): BaselinePaintFinalizationV1 {",
)
replace_once(
    path,
    "    const active = this.#activeStroke;\n    const resolvedLayerId = this.#resolveLayerId(layerId);",
    "    const active = this.#activeStroke;\n    if (active !== null && active.operation !== operation) {\n      throw new Error('baseline finalized stroke changed brush operation');\n    }\n    const resolvedLayerId = this.#resolveLayerId(layerId);",
)
replace_once(
    path,
    "        canonicalTiles.applyDabs(resolvedLayerId, strokeId, missingTail);\n        active.dabs.push(...missingTail);\n        this.#appendDabs(missingTail);",
    "        canonicalTiles.applyDabs(resolvedLayerId, strokeId, missingTail, operation);\n        active.dabs.push(...missingTail);\n        if (operation === 'erase') {\n          this.#patchCompositeTiles(\n            planBaselineBrushTilesV1(missingTail, width, height).map((plan) => plan.coordinate),\n          );\n        } else {\n          this.#appendDabs(missingTail);\n        }",
)
replace_once(
    path,
    "      this.#activeStroke = { strokeId, dabs: [...frozenDabs] };\n      canonicalTiles.applyDabs(resolvedLayerId, strokeId, frozenDabs);\n      if (frozenDabs.length > 0) this.#appendDabs(frozenDabs);",
    "      this.#activeStroke = { strokeId, operation, dabs: [...frozenDabs] };\n      canonicalTiles.applyDabs(resolvedLayerId, strokeId, frozenDabs, operation);\n      if (frozenDabs.length > 0) {\n        if (operation === 'erase') {\n          this.#patchCompositeTiles(\n            planBaselineBrushTilesV1(frozenDabs, width, height).map((plan) => plan.coordinate),\n          );\n        } else {\n          this.#appendDabs(frozenDabs);\n        }\n      }",
)
replace_once(
    path,
    "      this.#canonicalTiles.applyDabs(layerId, stroke.strokeId, dabs);",
    "      this.#canonicalTiles.applyDabs(layerId, stroke.strokeId, dabs, stroke.operation ?? 'paint');",
)

# Main/worker renderer protocol carries the low-level paint/erase operation.
path = 'src/app/renderer-controller.ts'
replace_once(
    path,
    "import { planBaselineBrushTilesV1, type BaselineBrushDabV1 } from '../gpu/baseline-brush.js';",
    "import {\n  planBaselineBrushTilesV1,\n  type BaselineBrushCompositeOperationV1,\n  type BaselineBrushDabV1,\n} from '../gpu/baseline-brush.js';",
)
replace_once(
    path,
    "  async presentBaselineStroke(\n    strokeId: string,\n    dabs: readonly BaselineBrushDabV1[],\n    layerId: string,\n  ): Promise<BaselinePaintRendererSnapshotV1> {",
    "  async presentBaselineStroke(\n    strokeId: string,\n    dabs: readonly BaselineBrushDabV1[],\n    layerId: string,\n    operation: BaselineBrushCompositeOperationV1 = 'paint',\n  ): Promise<BaselinePaintRendererSnapshotV1> {",
)
replace_once(path, "        dabs,\n        layerId,\n      });", "        dabs,\n        layerId,\n        operation,\n      });")
replace_once(
    path,
    "    const paint = this.#mainBaselinePaint.presentStroke(strokeId, dabs, layerId);",
    "    const paint = this.#mainBaselinePaint.presentStroke(strokeId, dabs, layerId, operation);",
)
replace_once(
    path,
    "      this.#trackCompatibilityDabs(dabs);\n      this.#compatibilityPresenter.presentDabs(dabs);",
    "      this.#trackCompatibilityDabs(dabs);\n      if (operation === 'erase') {\n        const documentValue = this.#canonicalDocument;\n        if (documentValue !== null) {\n          this.#syncCompatibilityTiles(\n            planBaselineBrushTilesV1(dabs, documentValue.width, documentValue.height).map(\n              (plan) => plan.coordinate,\n            ),\n          );\n        }\n      } else {\n        this.#compatibilityPresenter.presentDabs(dabs);\n      }",
)
replace_once(
    path,
    "  async finalizeBaselineStroke(\n    strokeId: string,\n    dabs: readonly BaselineBrushDabV1[],\n    layerId: string,\n  ): Promise<BaselinePaintFinalizationV1> {",
    "  async finalizeBaselineStroke(\n    strokeId: string,\n    dabs: readonly BaselineBrushDabV1[],\n    layerId: string,\n    operation: BaselineBrushCompositeOperationV1 = 'paint',\n  ): Promise<BaselinePaintFinalizationV1> {",
)
# Replace next finalize worker request marker (first occurrence already changed above, so use function call-specific snippets).
replace_once(
    path,
    "        type: 'renderer.paint.finalize',\n        requestId,\n        strokeId,\n        dabs,\n        layerId,\n      });",
    "        type: 'renderer.paint.finalize',\n        requestId,\n        strokeId,\n        dabs,\n        layerId,\n        operation,\n      });",
)
replace_once(
    path,
    "    const paint = this.#mainBaselinePaint.finalizeStroke(strokeId, dabs, layerId);",
    "    const paint = this.#mainBaselinePaint.finalizeStroke(strokeId, dabs, layerId, operation);",
)

path = 'src/workers/render.worker.ts'
replace_once(
    path,
    "import { freezeBaselineBrushColorV1, type BaselineBrushDabV1 } from '../gpu/baseline-brush.js';",
    "import {\n  freezeBaselineBrushColorV1,\n  type BaselineBrushCompositeOperationV1,\n  type BaselineBrushDabV1,\n} from '../gpu/baseline-brush.js';",
)
replace_once(
    path,
    "      readonly layerId: string;\n      readonly dabs: readonly BaselineBrushDabV1[];\n    }",
    "      readonly layerId: string;\n      readonly dabs: readonly BaselineBrushDabV1[];\n      readonly operation: BaselineBrushCompositeOperationV1;\n    }",
)
# parser: accept missing operation for old callers as paint.
replace_once(
    path,
    "    typeof value.layerId === 'string' &&\n    value.layerId.length > 0",
    "    typeof value.layerId === 'string' &&\n    value.layerId.length > 0 &&\n    (value.operation === undefined || value.operation === 'paint' || value.operation === 'erase')",
)
replace_once(
    path,
    "      layerId: value.layerId,\n      dabs,\n    };",
    "      layerId: value.layerId,\n      dabs,\n      operation: (value.operation ?? 'paint') as BaselineBrushCompositeOperationV1,\n    };",
)
replace_once(
    path,
    "        baselinePaint.presentStroke(request.strokeId, request.dabs, request.layerId),",
    "        baselinePaint.presentStroke(\n          request.strokeId,\n          request.dabs,\n          request.layerId,\n          request.operation,\n        ),",
)
replace_once(
    path,
    "        baselinePaint.finalizeStroke(request.strokeId, request.dabs, request.layerId),",
    "        baselinePaint.finalizeStroke(\n          request.strokeId,\n          request.dabs,\n          request.layerId,\n          request.operation,\n        ),",
)
# restore parser preserves optional operation.
replace_once(
    path,
    "    if (candidate.layerId !== undefined && typeof candidate.layerId !== 'string') return null;\n    strokes.push(\n      candidate.layerId === undefined\n        ? Object.freeze({ strokeId: candidate.strokeId, dabs })\n        : Object.freeze({ strokeId: candidate.strokeId, layerId: candidate.layerId, dabs }),\n    );",
    "    if (candidate.layerId !== undefined && typeof candidate.layerId !== 'string') return null;\n    if (candidate.operation !== undefined && candidate.operation !== 'paint' && candidate.operation !== 'erase') {\n      return null;\n    }\n    const operation = (candidate.operation ?? 'paint') as BaselineBrushCompositeOperationV1;\n    strokes.push(\n      candidate.layerId === undefined\n        ? Object.freeze({ strokeId: candidate.strokeId, operation, dabs })\n        : Object.freeze({ strokeId: candidate.strokeId, layerId: candidate.layerId, operation, dabs }),\n    );",
)

# PaintSession persists canonical mode and converts it only at renderer boundary.
path = 'src/app/paint-session-controller.ts'
replace_once(
    path,
    "  type BaselineBrushColorV1,\n  type BaselineBrushDabV1,",
    "  type BaselineBrushColorV1,\n  type BaselineBrushCompositeOperationV1,\n  type BaselineBrushDabV1,",
)
replace_once(
    path,
    "  CanonicalRasterBrushStrokeV1,\n  isImplementedCanonicalBrushModeV1,",
    "  canonicalBrushCompositeOperationV1,\n  CanonicalRasterBrushStrokeV1,\n  isImplementedCanonicalBrushModeV1,",
)
replace_once(
    path,
    "      readonly layerId: string;\n      readonly dabs: readonly BaselineBrushDabV1[];",
    "      readonly layerId: string;\n      readonly operation: BaselineBrushCompositeOperationV1;\n      readonly dabs: readonly BaselineBrushDabV1[];",
)
replace_all(
    path,
    "        dabs: entry.dabs,\n      })),",
    "        operation: canonicalBrushCompositeOperationV1(entry.stroke.brushMode),\n        dabs: entry.dabs,\n      })),",
    minimum=1,
)
replace_once(
    path,
    "    const builder = new CanonicalRasterBrushStrokeV1({ color: this.#paintColor });",
    "    const builder = new CanonicalRasterBrushStrokeV1({\n      color: this.#paintColor,\n      mode: this.#brushMode,\n    });",
)

# Runtime connects mode controls and passes operation to renderer.
path = 'src/app/main.ts'
replace_once(
    path,
    "import { PaintSessionControllerV1 } from './paint-session-controller.js';",
    "import { PaintSessionControllerV1 } from './paint-session-controller.js';\nimport { canonicalBrushCompositeOperationV1 } from './canonical-raster-brush.js';",
)
replace_once(
    path,
    "const paintHistory = new PaintHistoryControllerV1(paintSession);",
    "const brushRasterButton = document.querySelector<HTMLButtonElement>('#brush-mode-raster');\nconst brushEraserButton = document.querySelector<HTMLButtonElement>('#brush-mode-eraser');\nfunction publishBrushMode(): void {\n  const mode = paintSession.brushMode();\n  root.dataset.illustroBrushMode = mode;\n  brushRasterButton?.setAttribute('aria-pressed', String(mode === 'raster'));\n  brushEraserButton?.setAttribute('aria-pressed', String(mode === 'eraser'));\n}\nbrushRasterButton?.addEventListener('click', () => {\n  paintSession.setBrushMode('raster');\n  publishBrushMode();\n});\nbrushEraserButton?.addEventListener('click', () => {\n  paintSession.setBrushMode('eraser');\n  publishBrushMode();\n});\npublishBrushMode();\nconst paintHistory = new PaintHistoryControllerV1(paintSession);",
)
replace_once(
    path,
    "renderer.presentBaselineStroke(activeStrokeId, dabDelta, activeLayerId),",
    "renderer.presentBaselineStroke(\n                activeStrokeId,\n                dabDelta,\n                activeLayerId,\n                canonicalBrushCompositeOperationV1(paint.brushMode),\n              ),",
)
replace_once(
    path,
    "                completed.stroke.layerId,\n              );",
    "                completed.stroke.layerId,\n                canonicalBrushCompositeOperationV1(completed.stroke.brushMode),\n              );",
)

# Reachable tablet-first mode buttons in the existing primary tool rail.
path = 'src/index.html'
replace_once(
    path,
    """          <div class="shell-rail-slots" aria-hidden="true">
            <span class="is-active"></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span>
          </div>""",
    """          <div class="shell-rail-slots" aria-label="描画ツール">
            <button id="brush-mode-raster" class="shell-brush-mode is-active" type="button" aria-pressed="true" aria-label="ブラシ" title="ブラシ">●</button>
            <button id="brush-mode-eraser" class="shell-brush-mode" type="button" aria-pressed="false" aria-label="消しゴム" title="消しゴム">◇</button>
            <span></span><span></span><span></span><span></span><span></span><span></span><span></span>
          </div>""",
)

css = Path('public/app-shell.css')
text = css.read_text()
marker = '/* M6A canonical brush modes */'
if marker not in text:
    text += r'''

/* M6A canonical brush modes */
.shell-rail-slots .shell-brush-mode {
  width: 48px;
  height: 48px;
  min-width: 48px;
  min-height: 48px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 12px;
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
}

.shell-rail-slots .shell-brush-mode[aria-pressed='true'] {
  border-color: currentColor;
  background: color-mix(in srgb, currentColor 12%, transparent);
}
'''
    css.write_text(text)

# Verification + progress.
Path('tests/unit/eraser-mode.test.ts').write_text(r'''import { describe, expect, it } from 'vitest';
import { CanonicalRasterBrushStrokeV1 } from '../../src/app/canonical-raster-brush.js';
import { BaselineRasterTileStoreV1, readBaselineRasterTilePixelV1 } from '../../src/gpu/baseline-raster-tile-store.js';

describe('M6A-002 Eraser mode', () => {
  it('uses the same incremental geometry kernel while retaining eraser mode identity', () => {
    const stroke = new CanonicalRasterBrushStrokeV1({ mode: 'eraser' });
    stroke.beginConfirmed({ documentX: 64, documentY: 64 });
    const delta = stroke.appendConfirmed([{ documentX: 72, documentY: 64 }]);
    expect(delta).toHaveLength(2);
    expect(stroke.snapshot()).toMatchObject({
      mode: 'eraser',
      stablePrefixDabCount: 3,
      reprocessedStableDabCount: 0,
    });
  });

  it('reduces active-layer alpha instead of painting white', () => {
    const store = new BaselineRasterTileStoreV1(128, 128, 'rgba8-unorm', [
      { layerId: 'layer', visible: true, opacity: 1 },
    ]);
    const paint = new CanonicalRasterBrushStrokeV1({ color: [1, 0, 0] });
    const paintDabs = paint.beginConfirmed({ documentX: 64, documentY: 64 });
    store.applyDabs('layer', 'paint-stroke', paintDabs, 'paint');
    store.finalize('paint-stroke');
    const before = store.exportTiles()[0];
    expect(before).toBeDefined();
    const centerPixel = 64 * 128 + 64;
    expect(readBaselineRasterTilePixelV1(before!, centerPixel)).toEqual([1, 0, 0, 1]);

    const eraser = new CanonicalRasterBrushStrokeV1({ mode: 'eraser' });
    const eraseDabs = eraser.beginConfirmed({ documentX: 64, documentY: 64 });
    store.applyDabs('layer', 'erase-stroke', eraseDabs, 'erase');
    const patches = store.finalize('erase-stroke');
    const after = store.exportTiles()[0];
    expect(after).toBeDefined();
    expect(readBaselineRasterTilePixelV1(after!, centerPixel)[3]).toBe(0);
    expect(patches).toHaveLength(1);
    expect(readBaselineRasterTilePixelV1(patches[0]!.before!, centerPixel)).toEqual([1, 0, 0, 1]);
  });

  it('does not allocate a new canonical tile when erasing empty space', () => {
    const store = new BaselineRasterTileStoreV1(128, 128, 'rgba8-unorm', [
      { layerId: 'layer', visible: true, opacity: 1 },
    ]);
    const eraser = new CanonicalRasterBrushStrokeV1({ mode: 'eraser' });
    store.applyDabs(
      'layer',
      'empty-erase',
      eraser.beginConfirmed({ documentX: 64, documentY: 64 }),
      'erase',
    );
    expect(store.finalize('empty-erase')).toEqual([]);
    expect(store.exportTiles()).toEqual([]);
  });
});
''')

path = 'scripts/verify-m6a-brush.mjs'
replace_once(
    path,
    "requireText(canonical, \"export type CanonicalBrushModeV1 = 'raster';\", 'Raster mode identity missing');",
    "requireText(\n  canonical,\n  \"export type CanonicalBrushModeV1 = 'raster' | 'eraser';\",\n  'Raster/Eraser mode identity missing',\n);",
)
replace_once(
    path,
    "requireText(progress, 'M6A-002 Eraser mode:未完了', 'future mode status was incorrectly advanced');",
    "requireText(progress, 'M6A-002 Eraser mode:完了', 'M6A-002 progress is not complete');\nrequireText(progress, 'M6A-003 Smudge/Finger mode:未完了', 'future mode status was incorrectly advanced');\nrequireText('src/gpu/baseline-raster-tile-store.ts', 'rasterizeEraseDab', 'canonical eraser rasterization missing');\nrequireText('src/app/renderer-controller.ts', \"operation === 'erase'\", 'eraser recomposite presentation path missing');\nrequireText('src/workers/render.worker.ts', \"value.operation === 'erase'\", 'worker eraser protocol missing');\nrequireText('src/index.html', 'id=\\\"brush-mode-eraser\\\"', 'reachable Eraser control missing');",
)

path = 'IMPLEMENTATION_PROGRESS.md'
replace_once(path, 'M6A-002 Eraser mode:未完了', 'M6A-002 Eraser mode:完了')
replace_once(
    path,
    "M6A-002 Eraser mode:完了\nM6A-003 Smudge/Finger mode:未完了",
    "M6A-002 Eraser mode:完了\n再開メモ: M6A-002 Eraser modeはRaster Brushと同じ増分dab geometryを共有し、canonical Raster Tile上でactive layerのalphaをdestination-out相当で削る。flatten済みsceneを直接消さず、影響Tileのみ再compositeして下層レイヤーを正しく露出する。Worker/Main/Canvas2D fallback・stroke永続化/旧raster互換・Tile差分Undo/Redoへoperationを接続し、Primary Tool RailからBrush/Eraserを48pxボタンで切替可能。次はM6A-003 Smudge/Finger modeから再開する。\nM6A-003 Smudge/Finger mode:未完了",
)

memo = Path('ILLUSTRO_DESIGN_MEMO.md')
text = memo.read_text()
marker = '### 2026-09-02 — M6A Eraser compositing semantics'
if marker not in text:
    text += r'''

### 2026-09-02 — M6A Eraser compositing semantics

- Canonical Eraser is an alpha-removal operation on the targeted Raster Layer, never a white-paint approximation.
- Eraser shares Raster Brush geometry/spacing and the incremental confirmed-sample path, but its canonical pixel operation reduces destination alpha by brush coverage while preserving surviving RGB values.
- Because the visible retained scene is a composite of multiple layers, erasing the flattened presentation directly is incorrect: it would punch through lower layers. Eraser therefore mutates only the active layer's canonical Raster Tiles and recomposites/presents only affected tile coordinates so lower layers are revealed correctly.
- Erasing an already-transparent/unallocated tile is a no-op and must not allocate a canonical tile or history payload.
'''
    memo.write_text(text)
