import { describe, expect, it } from 'vitest';
import {
  setDraftLayerSnapshotV1,
  setReferenceLayerSnapshotV1,
} from '../../src/app/layer-role-flags.js';
import type { PaintProjectSnapshotV1 } from '../../src/app/paint-session-controller.js';
import { createDocumentV1 } from '../../src/domain/document.js';
import { parseRevision } from '../../src/domain/identity.js';
import { createRasterLayer } from '../../src/domain/layers.js';

function fixture() {
  const layer = createRasterLayer({ name: 'Artwork' });
  const document = createDocumentV1({ width: 64, height: 64 });
  const snapshot: PaintProjectSnapshotV1 = Object.freeze({
    schema: 'illustro.paint-project-snapshot/1' as const,
    document: Object.freeze({
      ...document,
      layerTree: Object.freeze({
        rootLayerIds: Object.freeze([layer.id]),
        layers: Object.freeze({ [layer.id]: layer }),
      }),
    }),
    committedStrokes: Object.freeze([]),
  });
  return { snapshot, layer };
}

describe('M5B Reference / Draft layer roles', () => {
  it('designates and releases Reference independently', () => {
    const { snapshot, layer } = fixture();
    const designated = setReferenceLayerSnapshotV1(snapshot, layer.id, true, parseRevision(1));
    expect(designated.document.layerTree.layers[layer.id]?.roleFlags).toEqual({
      reference: true,
      draft: false,
    });
    const released = setReferenceLayerSnapshotV1(designated, layer.id, false, parseRevision(2));
    expect(released.document.layerTree.layers[layer.id]?.roleFlags).toEqual({
      reference: false,
      draft: false,
    });
  });

  it('toggles Draft without disturbing Reference', () => {
    const { snapshot, layer } = fixture();
    const reference = setReferenceLayerSnapshotV1(snapshot, layer.id, true, parseRevision(1));
    const draft = setDraftLayerSnapshotV1(reference, layer.id, true, parseRevision(2));
    expect(draft.document.layerTree.layers[layer.id]?.roleFlags).toEqual({
      reference: true,
      draft: true,
    });
    const normal = setDraftLayerSnapshotV1(draft, layer.id, false, parseRevision(3));
    expect(normal.document.layerTree.layers[layer.id]?.roleFlags).toEqual({
      reference: true,
      draft: false,
    });
  });
});
