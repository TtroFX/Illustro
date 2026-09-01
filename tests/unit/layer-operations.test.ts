import { describe, expect, it } from 'vitest';
import { createDocumentV1 } from '../../src/domain/document.js';
import { parseRevision } from '../../src/domain/identity.js';
import { createRasterLayer, createRasterMask } from '../../src/domain/layers.js';
import {
  deleteRootLayerSnapshotV1,
  duplicateRootLayerSnapshotV1,
  renameLayerSnapshotV1,
  reorderRootLayerSnapshotV1,
  setLayerAllLockSnapshotV1,
  setLayerAlphaLockSnapshotV1,
  setLayerClippingSnapshotV1,
  setLayerOpacitySnapshotV1,
  setLayerVisibilitySnapshotV1,
} from '../../src/app/layer-operations.js';
import type { PaintProjectSnapshotV1 } from '../../src/app/paint-session-controller.js';

function snapshotWithLayers(): {
  snapshot: PaintProjectSnapshotV1;
  bottom: ReturnType<typeof createRasterLayer>;
  top: ReturnType<typeof createRasterLayer>;
} {
  const document = createDocumentV1({ width: 128, height: 128 });
  const bottom = createRasterLayer({ name: 'Bottom' });
  const top = createRasterLayer({ name: 'Top', masks: [createRasterMask()] });
  return {
    bottom,
    top,
    snapshot: Object.freeze({
      schema: 'illustro.paint-project-snapshot/1' as const,
      document: Object.freeze({
        ...document,
        layerTree: Object.freeze({
          rootLayerIds: Object.freeze([bottom.id, top.id]),
          layers: Object.freeze({ [bottom.id]: bottom, [top.id]: top }),
        }),
      }),
      committedStrokes: Object.freeze([
        Object.freeze({
          stroke: Object.freeze({
            schema: 'illustro.paint-stroke/1' as const,
            strokeId: '11111111-1111-4111-8111-111111111111',
            pointerId: 1,
            source: 'pen' as const,
            layerId: top.id,
            samples: Object.freeze([]),
          }),
          dabs: Object.freeze([]),
        }),
      ]),
    }),
  };
}

describe('M5B layer editing operations', () => {
  it('duplicates a raster layer with independent identities, masks, and paint history', () => {
    const fixture = snapshotWithLayers();
    const result = duplicateRootLayerSnapshotV1(
      fixture.snapshot,
      fixture.top.id,
      parseRevision(1),
      new Date(0),
    );
    const duplicate = result.snapshot.document.layerTree.layers[result.duplicatedRootLayerId];
    expect(result.snapshot.document.layerTree.rootLayerIds).toEqual([
      fixture.bottom.id,
      fixture.top.id,
      result.duplicatedRootLayerId,
    ]);
    expect(duplicate).toMatchObject({ type: 'raster', name: 'Top copy' });
    expect(duplicate?.id).not.toBe(fixture.top.id);
    expect(duplicate?.masks[0]?.id).not.toBe(fixture.top.masks[0]?.id);
    expect(result.snapshot.committedStrokes).toHaveLength(2);
    expect(result.snapshot.committedStrokes[1]?.stroke.layerId).toBe(result.duplicatedRootLayerId);
    expect(result.snapshot.committedStrokes[1]?.stroke.strokeId).not.toBe(
      fixture.snapshot.committedStrokes[0]?.stroke.strokeId,
    );
  });

  it('deletes a layer and its paint while clearing dangling clipping references', () => {
    const fixture = snapshotWithLayers();
    const clipped = setLayerClippingSnapshotV1(
      fixture.snapshot,
      fixture.top.id,
      fixture.bottom.id,
      parseRevision(1),
      new Date(0),
    );
    const deleted = deleteRootLayerSnapshotV1(
      clipped,
      fixture.bottom.id,
      parseRevision(2),
      new Date(1),
    );
    expect(deleted.document.layerTree.rootLayerIds).toEqual([fixture.top.id]);
    expect(deleted.document.layerTree.layers[fixture.bottom.id]).toBeUndefined();
    expect(deleted.document.layerTree.layers[fixture.top.id]?.clipping).toBeNull();
  });

  it('renames, reorders, and updates visibility/opacity/locks/clipping immutably', () => {
    const fixture = snapshotWithLayers();
    let current = renameLayerSnapshotV1(
      fixture.snapshot,
      fixture.top.id,
      'Paint',
      parseRevision(1),
      new Date(0),
    );
    current = reorderRootLayerSnapshotV1(current, fixture.top.id, 0, parseRevision(2), new Date(1));
    current = setLayerVisibilitySnapshotV1(
      current,
      fixture.top.id,
      false,
      parseRevision(3),
      new Date(2),
    );
    current = setLayerOpacitySnapshotV1(
      current,
      fixture.top.id,
      0.42,
      parseRevision(4),
      new Date(3),
    );
    current = setLayerAllLockSnapshotV1(
      current,
      fixture.top.id,
      true,
      parseRevision(5),
      new Date(4),
    );
    current = setLayerAlphaLockSnapshotV1(
      current,
      fixture.top.id,
      true,
      parseRevision(6),
      new Date(5),
    );
    current = setLayerClippingSnapshotV1(
      current,
      fixture.bottom.id,
      fixture.top.id,
      parseRevision(7),
      new Date(6),
    );
    expect(current.document.layerTree.rootLayerIds).toEqual([fixture.top.id, fixture.bottom.id]);
    expect(current.document.layerTree.layers[fixture.top.id]).toMatchObject({
      name: 'Paint',
      visible: false,
      opacity: 0.42,
      locks: { all: true, alpha: true },
    });
    expect(current.document.layerTree.layers[fixture.bottom.id]?.clipping).toEqual({
      mode: 'alpha',
      baseLayerId: fixture.top.id,
    });
    expect(fixture.snapshot.document.layerTree.layers[fixture.top.id]).toMatchObject({
      name: 'Top',
      visible: true,
      opacity: 1,
      locks: { all: false, alpha: false },
    });
  });
});
