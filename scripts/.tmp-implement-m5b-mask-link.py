from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    target = Path(path)
    text = target.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'expected one anchor in {path}; found {count}: {old[:180]!r}')
    target.write_text(text.replace(old, new, 1))


replace_once(
    'src/domain/layers.ts',
    "  readonly inverted: boolean;\n  readonly transformStack: readonly TransformNodeV1[];",
    "  readonly inverted: boolean;\n  readonly linkedToLayer?: boolean;\n  readonly transformStack: readonly TransformNodeV1[];",
)
replace_once(
    'src/domain/layers.ts',
    "    readonly inverted?: boolean;\n    readonly transformStack?: readonly TransformNodeV1[];",
    "    readonly inverted?: boolean;\n    readonly linkedToLayer?: boolean;\n    readonly transformStack?: readonly TransformNodeV1[];",
)
replace_once(
    'src/domain/layers.ts',
    "    inverted: input.inverted ?? false,\n    transformStack: freezeArray(input.transformStack ?? []),",
    "    inverted: input.inverted ?? false,\n    linkedToLayer: input.linkedToLayer ?? true,\n    transformStack: freezeArray(input.transformStack ?? []),",
)

path = Path('src/app/layer-mask-operations.ts')
text = path.read_text()
append = r'''

export function maskLinkedToLayerV1(mask: RasterMaskAttachmentV1): boolean {
  return mask.linkedToLayer !== false;
}

export function setMaskLinkedToLayerSnapshotV1(
  snapshot: PaintProjectSnapshotV1,
  layerId: LayerId,
  maskId: MaskId,
  linkedToLayer: boolean,
  revision: Revision,
  now: Date = new Date(),
): PaintProjectSnapshotV1 {
  const { layer, mask } = requireRasterMaskV1(snapshot, layerId, maskId);
  if (maskLinkedToLayerV1(mask) === linkedToLayer) {
    throw new Error('mask link state has no changes');
  }
  const nextMask = Object.freeze({ ...mask, revision, linkedToLayer });
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
'''
if 'export function setMaskLinkedToLayerSnapshotV1' in text:
    raise SystemExit('mask link implementation already present')
path.write_text(text.rstrip() + append)

Path('tests/unit/layer-mask-link.test.ts').write_text(r'''import { describe, expect, it } from 'vitest';
import {
  maskLinkedToLayerV1,
  setMaskLinkedToLayerSnapshotV1,
} from '../../src/app/layer-mask-operations.js';
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

describe('M5B mask link/unlink', () => {
  it('creates raster masks linked to their layer by default', () => {
    const { mask } = fixture();
    expect(mask.linkedToLayer).toBe(true);
    expect(maskLinkedToLayerV1(mask)).toBe(true);
  });

  it('unlinks and relinks without rewriting mask coverage or transform content', () => {
    const { snapshot, layer, mask } = fixture();
    const unlinked = setMaskLinkedToLayerSnapshotV1(
      snapshot,
      layer.id,
      mask.id,
      false,
      parseRevision(1),
      new Date(0),
    );
    const unlinkedMask = unlinked.document.layerTree.layers[layer.id]?.masks.find(
      (entry) => entry.id === mask.id,
    );
    expect(unlinkedMask?.linkedToLayer).toBe(false);
    expect(unlinkedMask?.transformStack).toEqual(mask.transformStack);
    expect(unlinkedMask?.kind === 'raster-mask' ? unlinkedMask.tiles : []).toEqual(mask.tiles);
    expect(unlinked.document.revision).toBe(1);

    const relinked = setMaskLinkedToLayerSnapshotV1(
      unlinked,
      layer.id,
      mask.id,
      true,
      parseRevision(2),
      new Date(1),
    );
    const relinkedMask = relinked.document.layerTree.layers[layer.id]?.masks.find(
      (entry) => entry.id === mask.id,
    );
    expect(relinkedMask?.linkedToLayer).toBe(true);
    expect(relinked.document.revision).toBe(2);
  });

  it('treats legacy masks without the field as linked and rejects no-op changes', () => {
    const { snapshot, layer, mask } = fixture();
    const { linkedToLayer: _linked, ...legacyMask } = mask;
    expect(maskLinkedToLayerV1(legacyMask)).toBe(true);
    const legacyLayer = Object.freeze({ ...layer, masks: Object.freeze([legacyMask]) });
    const legacySnapshot = Object.freeze({
      ...snapshot,
      document: Object.freeze({
        ...snapshot.document,
        layerTree: Object.freeze({
          rootLayerIds: snapshot.document.layerTree.rootLayerIds,
          layers: Object.freeze({ [layer.id]: legacyLayer }),
        }),
      }),
    });
    expect(() =>
      setMaskLinkedToLayerSnapshotV1(legacySnapshot, layer.id, mask.id, true, parseRevision(1)),
    ).toThrow(/no changes/);
  });
});
''')

replace_once(
    'src/app/layer-workflow-controller.ts',
    "import { setMaskInvertedSnapshotV1 } from './layer-mask-operations.js';",
    "import {\n  maskLinkedToLayerV1,\n  setMaskInvertedSnapshotV1,\n  setMaskLinkedToLayerSnapshotV1,\n} from './layer-mask-operations.js';",
)
replace_once(
    'src/app/layer-workflow-controller.ts',
    "  const maskInvertButton = required<HTMLButtonElement>('#mask-invert');",
    "  const maskInvertButton = required<HTMLButtonElement>('#mask-invert');\n  const maskLinkButton = required<HTMLButtonElement>('#mask-link');",
)
replace_once(
    'src/app/layer-workflow-controller.ts',
    "    maskInvertButton.title = selectedRasterMask?.inverted === true ? 'マスク反転を解除' : 'マスクを反転';",
    "    maskInvertButton.title = selectedRasterMask?.inverted === true ? 'マスク反転を解除' : 'マスクを反転';\n    const maskLinked = selectedRasterMask === undefined ? true : maskLinkedToLayerV1(selectedRasterMask);\n    maskLinkButton.disabled = selectedRasterMask === undefined;\n    maskLinkButton.setAttribute('aria-pressed', maskLinked ? 'true' : 'false');\n    maskLinkButton.title = maskLinked ? 'マスクとレイヤーのリンクを解除' : 'マスクをレイヤーへリンク';",
)
replace_once(
    'src/app/layer-workflow-controller.ts',
    "  const onLayerSearchInput = (): void => {",
    "  const onMaskLink = (): void => {\n    const target = options.maskPaint.snapshot();\n    const layerId = target.layerId;\n    const maskId = target.maskId;\n    if (layerId === null || maskId === null) return;\n    const current = options.paintSession.projectSnapshot();\n    const layer = current?.document.layerTree.layers[layerId];\n    const mask = layer?.masks.find((entry) => entry.id === maskId);\n    if (current === null || mask?.kind !== 'raster-mask') return;\n    const linked = maskLinkedToLayerV1(mask);\n    commitMutation(\n      linked ? 'mask.unlink' : 'mask.link',\n      (before, revision) =>\n        setMaskLinkedToLayerSnapshotV1(before, layerId, maskId, !linked, revision),\n      () => layerId,\n    );\n  };\n\n  const onLayerSearchInput = (): void => {",
)
replace_once(
    'src/app/layer-workflow-controller.ts',
    "  maskInvertButton.addEventListener('click', onMaskInvert);",
    "  maskInvertButton.addEventListener('click', onMaskInvert);\n  maskLinkButton.addEventListener('click', onMaskLink);",
)
replace_once(
    'src/app/layer-workflow-controller.ts',
    "      maskInvertButton.removeEventListener('click', onMaskInvert);",
    "      maskInvertButton.removeEventListener('click', onMaskInvert);\n      maskLinkButton.removeEventListener('click', onMaskLink);",
)

replace_once(
    'src/index.html',
    '              <button id="mask-invert" type="button" aria-label="マスクを反転" title="マスクを反転" aria-pressed="false" disabled>±</button>',
    '              <button id="mask-invert" type="button" aria-label="マスクを反転" title="マスクを反転" aria-pressed="false" disabled>±</button>\n              <button id="mask-link" type="button" aria-label="マスクとレイヤーをリンク" title="マスクとレイヤーをリンク" aria-pressed="true" disabled>⌁</button>',
)
replace_once(
    'public/app-shell.css',
    'grid-template-columns: minmax(0, 1fr) 44px 44px 44px;',
    'grid-template-columns: minmax(0, 1fr) 40px 40px 40px 40px;',
)
replace_once(
    'scripts/verify-m5b-layer-foundation.mjs',
    "requireText('src/index.html', ['id=\"mask-invert\"']);\nconsole.log('M5B layer system verification passed');",
    "requireText('src/index.html', ['id=\"mask-invert\"']);\nrequireText('src/domain/layers.ts', ['linkedToLayer?: boolean', 'linkedToLayer: input.linkedToLayer ?? true']);\nrequireText('src/app/layer-mask-operations.ts', [\n  'maskLinkedToLayerV1',\n  'setMaskLinkedToLayerSnapshotV1',\n  'mask link state has no changes',\n]);\nrequireText('src/app/layer-workflow-controller.ts', [\n  \"'#mask-link'\",\n  \"'mask.unlink'\",\n  \"'mask.link'\",\n  'setMaskLinkedToLayerSnapshotV1',\n]);\nrequireText('src/index.html', ['id=\"mask-link\"']);\nconsole.log('M5B layer system verification passed');",
)
replace_once('IMPLEMENTATION_PROGRESS.md', 'M5B-038 Mask link/unlink:未完了', 'M5B-038 Mask link/unlink:完了')
