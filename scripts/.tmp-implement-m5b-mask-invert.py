from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    target = Path(path)
    text = target.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'expected one anchor in {path}; found {count}: {old[:180]!r}')
    target.write_text(text.replace(old, new, 1))


Path('src/app/layer-mask-operations.ts').write_text(r'''import type { LayerId, MaskId, Revision } from '../domain/identity.js';
import type { LayerBaseV1, RasterMaskAttachmentV1 } from '../domain/layers.js';
import type { PaintProjectSnapshotV1 } from './paint-session-controller.js';

function requireRasterMaskV1(
  snapshot: PaintProjectSnapshotV1,
  layerId: LayerId,
  maskId: MaskId,
): { readonly layer: LayerBaseV1; readonly mask: RasterMaskAttachmentV1 } {
  const layer = snapshot.document.layerTree.layers[layerId];
  if (layer === undefined) throw new Error(`mask layer is missing: ${layerId}`);
  const mask = layer.masks.find((entry) => entry.id === maskId);
  if (mask === undefined) throw new Error(`mask is missing: ${maskId}`);
  if (mask.kind !== 'raster-mask') throw new Error('mask operation requires a Raster Mask');
  if (layer.type === 'lineartBoundary') throw new Error('Lineart Boundary mask operations are unavailable');
  if (layer.locks.all) throw new Error('mask operation is blocked by the layer lock');
  return Object.freeze({ layer, mask });
}

export function setMaskInvertedSnapshotV1(
  snapshot: PaintProjectSnapshotV1,
  layerId: LayerId,
  maskId: MaskId,
  inverted: boolean,
  revision: Revision,
  now: Date = new Date(),
): PaintProjectSnapshotV1 {
  const { layer, mask } = requireRasterMaskV1(snapshot, layerId, maskId);
  if (mask.inverted === inverted) throw new Error('mask invert has no changes');
  const nextMask = Object.freeze({ ...mask, revision, inverted });
  const nextLayer = Object.freeze({
    ...layer,
    revision,
    masks: Object.freeze(layer.masks.map((entry) => (entry.id === mask.id ? nextMask : entry))),
  }) as LayerBaseV1;
  return Object.freeze({
    ...snapshot,
    document: Object.freeze({
      ...snapshot.document,
      revision,
      modifiedAt: now.toISOString(),
      layerTree: Object.freeze({
        rootLayerIds: snapshot.document.layerTree.rootLayerIds,
        layers: Object.freeze({ ...snapshot.document.layerTree.layers, [layerId]: nextLayer }),
      }),
    }),
  });
}
''')

Path('tests/unit/layer-mask-operations.test.ts').write_text(r'''import { describe, expect, it } from 'vitest';
import { setMaskInvertedSnapshotV1 } from '../../src/app/layer-mask-operations.js';
import type { PaintProjectSnapshotV1 } from '../../src/app/paint-session-controller.js';
import { createDocumentV1 } from '../../src/domain/document.js';
import { parseRevision } from '../../src/domain/identity.js';
import { createRasterLayer, createRasterMask } from '../../src/domain/layers.js';

function fixture(): {
  readonly snapshot: PaintProjectSnapshotV1;
  readonly layer: ReturnType<typeof createRasterLayer>;
  readonly mask: ReturnType<typeof createRasterMask>;
} {
  const mask = createRasterMask({ defaultCoverage: 1 });
  const layer = createRasterLayer({ name: 'Masked', masks: [mask] });
  const document = createDocumentV1({ width: 64, height: 64 });
  return {
    snapshot: Object.freeze({
      schema: 'illustro.paint-project-snapshot/1' as const,
      document: Object.freeze({
        ...document,
        layerTree: Object.freeze({
          rootLayerIds: Object.freeze([layer.id]),
          layers: Object.freeze({ [layer.id]: layer }),
        }),
      }),
      committedStrokes: Object.freeze([]),
    }),
    layer,
    mask,
  };
}

describe('M5B mask invert', () => {
  it('toggles the canonical mask inversion flag without rewriting coverage tiles', () => {
    const { snapshot, layer, mask } = fixture();
    const next = setMaskInvertedSnapshotV1(
      snapshot,
      layer.id,
      mask.id,
      true,
      parseRevision(1),
      new Date(0),
    );
    const nextLayer = next.document.layerTree.layers[layer.id];
    const nextMask = nextLayer?.masks.find((entry) => entry.id === mask.id);
    expect(nextMask?.inverted).toBe(true);
    expect(nextMask?.revision).toBe(1);
    expect(nextMask?.kind === 'raster-mask' ? nextMask.tiles : []).toEqual([]);
    expect(next.document.revision).toBe(1);
    expect(next.document.modifiedAt).toBe(new Date(0).toISOString());
  });

  it('rejects no-op inversion changes', () => {
    const { snapshot, layer, mask } = fixture();
    expect(() =>
      setMaskInvertedSnapshotV1(snapshot, layer.id, mask.id, false, parseRevision(1)),
    ).toThrow(/no changes/);
  });
});
''')

replace_once(
    'src/app/layer-workflow-controller.ts',
    "import type { MaskPaintControllerV1 } from './layer-mask-paint.js';",
    "import { setMaskInvertedSnapshotV1 } from './layer-mask-operations.js';\nimport type { MaskPaintControllerV1 } from './layer-mask-paint.js';",
)
replace_once(
    'src/app/layer-workflow-controller.ts',
    "  const maskPaintRevealButton = required<HTMLButtonElement>('#mask-paint-reveal');",
    "  const maskPaintRevealButton = required<HTMLButtonElement>('#mask-paint-reveal');\n  const maskInvertButton = required<HTMLButtonElement>('#mask-invert');",
)
replace_once(
    'src/app/layer-workflow-controller.ts',
    "    maskPaintRevealButton.setAttribute(\n      'aria-pressed',\n      activeMaskBelongsToLayer && maskPaintSnapshot.paintValue === 1 ? 'true' : 'false',\n    );",
    "    maskPaintRevealButton.setAttribute(\n      'aria-pressed',\n      activeMaskBelongsToLayer && maskPaintSnapshot.paintValue === 1 ? 'true' : 'false',\n    );\n    const selectedRasterMask = activeMaskBelongsToLayer\n      ? rasterMasks.find((mask) => mask.id === maskPaintSnapshot.maskId)\n      : undefined;\n    maskInvertButton.disabled = selectedRasterMask === undefined;\n    maskInvertButton.setAttribute('aria-pressed', selectedRasterMask?.inverted === true ? 'true' : 'false');\n    maskInvertButton.title = selectedRasterMask?.inverted === true ? 'マスク反転を解除' : 'マスクを反転';",
)
replace_once(
    'src/app/layer-workflow-controller.ts',
    "  const onLayerSearchInput = (): void => {",
    "  const onMaskInvert = (): void => {\n    const target = options.maskPaint.snapshot();\n    if (target.layerId === null || target.maskId === null) return;\n    const current = options.paintSession.projectSnapshot();\n    const layer = current?.document.layerTree.layers[target.layerId];\n    const mask = layer?.masks.find((entry) => entry.id === target.maskId);\n    if (current === null || mask?.kind !== 'raster-mask') return;\n    commitMutation(\n      'mask.invert',\n      (before, revision) =>\n        setMaskInvertedSnapshotV1(before, target.layerId!, target.maskId!, !mask.inverted, revision),\n      () => target.layerId,\n    );\n  };\n\n  const onLayerSearchInput = (): void => {",
)
replace_once(
    'src/app/layer-workflow-controller.ts',
    "  maskPaintRevealButton.addEventListener('click', onMaskPaintReveal);",
    "  maskPaintRevealButton.addEventListener('click', onMaskPaintReveal);\n  maskInvertButton.addEventListener('click', onMaskInvert);",
)
replace_once(
    'src/app/layer-workflow-controller.ts',
    "      maskPaintRevealButton.removeEventListener('click', onMaskPaintReveal);",
    "      maskPaintRevealButton.removeEventListener('click', onMaskPaintReveal);\n      maskInvertButton.removeEventListener('click', onMaskInvert);",
)

replace_once(
    'src/index.html',
    '              <button id="mask-paint-reveal" type="button" aria-label="マスクへ表示を描画" title="マスク: 表示" aria-pressed="false" disabled>M＋</button>',
    '              <button id="mask-paint-reveal" type="button" aria-label="マスクへ表示を描画" title="マスク: 表示" aria-pressed="false" disabled>M＋</button>\n              <button id="mask-invert" type="button" aria-label="マスクを反転" title="マスクを反転" aria-pressed="false" disabled>±</button>',
)
replace_once(
    'public/app-shell.css',
    'grid-template-columns: minmax(0, 1fr) 44px 44px;',
    'grid-template-columns: minmax(0, 1fr) 44px 44px 44px;',
)
replace_once(
    'scripts/verify-m5b-layer-foundation.mjs',
    "requireText('src/index.html', [\n  'id=\"mask-paint-target\"',\n  'id=\"mask-paint-hide\"',\n  'id=\"mask-paint-reveal\"',\n]);\nconsole.log('M5B layer system verification passed');",
    "requireText('src/index.html', [\n  'id=\"mask-paint-target\"',\n  'id=\"mask-paint-hide\"',\n  'id=\"mask-paint-reveal\"',\n]);\nrequireText('src/app/layer-mask-operations.ts', [\n  'setMaskInvertedSnapshotV1',\n  'inverted',\n  'mask invert has no changes',\n]);\nrequireText('src/app/layer-workflow-controller.ts', [\n  \"'#mask-invert'\",\n  \"'mask.invert'\",\n  'setMaskInvertedSnapshotV1',\n]);\nrequireText('src/index.html', ['id=\"mask-invert\"']);\nconsole.log('M5B layer system verification passed');",
)
replace_once('IMPLEMENTATION_PROGRESS.md', 'M5B-037 Mask invert:未完了', 'M5B-037 Mask invert:完了')
