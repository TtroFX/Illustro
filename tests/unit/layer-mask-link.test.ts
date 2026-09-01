import { describe, expect, it } from 'vitest';
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
