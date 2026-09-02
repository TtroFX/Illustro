from pathlib import Path


def replace_once(path: str, before: str, after: str) -> None:
    p = Path(path)
    text = p.read_text()
    count = text.count(before)
    if count != 1:
        raise SystemExit(f"expected one anchor in {path}, found {count}: {before[:140]!r}")
    p.write_text(text.replace(before, after, 1))


replace_once(
    "src/gpu/baseline-raster-tile-store.ts",
    "export interface BaselineRasterLayerDescriptorV1 {\n  readonly layerId: string;\n  readonly visible: boolean;\n  readonly opacity: number;\n}",
    "export interface BaselineRasterLayerDescriptorV1 {\n  readonly layerId: string;\n  readonly visible: boolean;\n  readonly opacity: number;\n  readonly draft?: boolean;\n}",
)
replace_once(
    "src/gpu/baseline-raster-tile-store.ts",
    "  compositeTiles(coordinates?: readonly TileCoordinateV1[]): readonly BaselineRasterTileImageV1[] {",
    "  compositeTiles(\n    coordinates?: readonly TileCoordinateV1[],\n    options: { readonly includeDraft?: boolean } = {},\n  ): readonly BaselineRasterTileImageV1[] {",
)
replace_once(
    "src/gpu/baseline-raster-tile-store.ts",
    "    const visibleLayers = this.#layers.filter((layer) => layer.visible && layer.opacity > 0);\n    const result: BaselineRasterTileImageV1[] = [];\n    for (const [key, coordinate] of selected) {\n      let composite = this.#compositeCache.get(key);\n      if (composite === undefined) {\n        composite = this.#composeCoordinate(coordinate, visibleLayers);\n        this.#compositeCache.set(key, composite);\n      }\n      result.push(cloneTile(composite));\n    }",
    "    const includeDraft = options.includeDraft !== false;\n    const visibleLayers = this.#layers.filter(\n      (layer) => layer.visible && layer.opacity > 0 && (includeDraft || layer.draft !== true),\n    );\n    const result: BaselineRasterTileImageV1[] = [];\n    for (const [key, coordinate] of selected) {\n      let composite = includeDraft ? this.#compositeCache.get(key) : undefined;\n      if (composite === undefined) {\n        composite = this.#composeCoordinate(coordinate, visibleLayers);\n        if (includeDraft) this.#compositeCache.set(key, composite);\n      }\n      result.push(cloneTile(composite));\n    }",
)
replace_once(
    "src/gpu/baseline-raster-tile-store.ts",
    "          layerId: layer.layerId,\n          visible: layer.visible,\n          opacity: layer.opacity,",
    "          layerId: layer.layerId,\n          visible: layer.visible,\n          opacity: layer.opacity,\n          draft: layer.draft ?? false,",
)
replace_once(
    "src/gpu/baseline-paint-renderer.ts",
    "  exportCompositeTiles(): readonly BaselineRasterTileImageV1[] {\n    return this.#requireDocument().canonicalTiles.compositeTiles();\n  }",
    "  exportCompositeTiles(\n    options: { readonly includeDraft?: boolean } = {},\n  ): readonly BaselineRasterTileImageV1[] {\n    return this.#requireDocument().canonicalTiles.compositeTiles(undefined, options);\n  }",
)
replace_once(
    "src/app/paint-session-controller.ts",
    "        layerId: layer.id,\n        visible: layer.visible,\n        opacity: layer.opacity,",
    "        layerId: layer.id,\n        visible: layer.visible,\n        opacity: layer.opacity,\n        draft: layer.roleFlags.draft,",
)
replace_once(
    "src/app/renderer-controller.ts",
    "        composite: true,\n      });",
    "        composite: true,\n        includeDraft: false,\n      });",
)
replace_once(
    "src/app/renderer-controller.ts",
    "    return this.#mainBaselinePaint.exportCompositeTiles();\n  }",
    "    return this.#mainBaselinePaint.exportCompositeTiles({ includeDraft: false });\n  }",
)
replace_once(
    "src/app/renderer-controller.ts",
    "            layerId: layer.layerId,\n            visible: layer.visible,\n            opacity: layer.opacity,",
    "            layerId: layer.layerId,\n            visible: layer.visible,\n            opacity: layer.opacity,\n            draft: layer.draft ?? false,",
)
replace_once(
    "src/workers/render.worker.ts",
    "      readonly composite: boolean;\n    }",
    "      readonly composite: boolean;\n      readonly includeDraft?: boolean;\n    }",
)
replace_once(
    "src/workers/render.worker.ts",
    "      typeof candidate.opacity !== 'number' ||\n      !Number.isFinite(candidate.opacity) ||",
    "      typeof candidate.opacity !== 'number' ||\n      (candidate.draft !== undefined && typeof candidate.draft !== 'boolean') ||\n      !Number.isFinite(candidate.opacity) ||",
)
replace_once(
    "src/workers/render.worker.ts",
    "        layerId: candidate.layerId,\n        visible: candidate.visible,\n        opacity: candidate.opacity,",
    "        layerId: candidate.layerId,\n        visible: candidate.visible,\n        opacity: candidate.opacity,\n        draft: candidate.draft ?? false,",
)
replace_once(
    "src/workers/render.worker.ts",
    "    typeof value.requestId === 'string' &&\n    typeof value.composite === 'boolean'\n  ) {\n    return {\n      type: value.type,\n      requestId: value.requestId,\n      composite: value.composite,\n    };",
    "    typeof value.requestId === 'string' &&\n    typeof value.composite === 'boolean' &&\n    (value.includeDraft === undefined || typeof value.includeDraft === 'boolean')\n  ) {\n    const includeDraft = value.includeDraft;\n    return {\n      type: value.type,\n      requestId: value.requestId,\n      composite: value.composite,\n      ...(typeof includeDraft === 'boolean' ? { includeDraft } : {}),\n    };",
)
replace_once(
    "src/workers/render.worker.ts",
    "      const tiles = request.composite\n        ? baselinePaint.exportCompositeTiles()\n        : baselinePaint.exportCanonicalTiles();",
    "      const tiles = request.composite\n        ? baselinePaint.exportCompositeTiles({ includeDraft: request.includeDraft ?? true })\n        : baselinePaint.exportCanonicalTiles();",
)

Path("tests/unit/draft-final-output.test.ts").write_text(r'''import { describe, expect, it } from 'vitest';
import { paintRasterLayerDescriptorsV1 } from '../../src/app/paint-session-controller.js';
import { createDocumentV1 } from '../../src/domain/document.js';
import { createRasterLayer } from '../../src/domain/layers.js';
import { BaselineRasterTileStoreV1 } from '../../src/gpu/baseline-raster-tile-store.js';

function fixture() {
  const draft = createRasterLayer({ name: 'Sketch', roleFlags: { draft: true } });
  const document = createDocumentV1({ width: 32, height: 32 });
  return {
    draft,
    document: Object.freeze({
      ...document,
      layerTree: Object.freeze({
        rootLayerIds: Object.freeze([draft.id]),
        layers: Object.freeze({ [draft.id]: draft }),
      }),
    }),
  };
}

describe('M5B Draft final-output exclusion', () => {
  it('propagates Draft into renderer descriptors', () => {
    const { document, draft } = fixture();
    expect(paintRasterLayerDescriptorsV1(document)).toEqual([
      expect.objectContaining({ layerId: draft.id, draft: true }),
    ]);
  });

  it('keeps Draft visible in workspace but excludes it from final output', () => {
    const { document, draft } = fixture();
    const store = new BaselineRasterTileStoreV1(
      32,
      32,
      'rgba8-unorm',
      paintRasterLayerDescriptorsV1(document),
    );
    store.applyDabs(draft.id, 'draft-stroke', [
      Object.freeze({
        schema: 'illustro.baseline-brush-dab/1' as const,
        x: 16,
        y: 16,
        radius: 8,
        radiusX: 8,
        radiusY: 8,
        opacity: 1,
      }),
    ]);
    store.finalize('draft-stroke');
    const workspace = store.compositeTiles();
    const finalOutput = store.compositeTiles(undefined, { includeDraft: false });
    expect(workspace[0]?.bytes.some((value, index) => index % 4 === 3 && value > 0)).toBe(true);
    expect(finalOutput[0]?.bytes.every((value) => value === 0)).toBe(true);
  });
});
''')
