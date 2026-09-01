import { describe, expect, it } from 'vitest';
import {
  canMoveRootLayerSelectionStepV1,
  moveRootLayerSelectionStepSnapshotV1,
  reorderRootLayerSelectionSnapshotV1,
} from '../../src/app/layer-operations.js';
import type { PaintProjectSnapshotV1 } from '../../src/app/paint-session-controller.js';
import { createDocumentV1 } from '../../src/domain/document.js';
import { parseRevision } from '../../src/domain/identity.js';
import { createRasterLayer } from '../../src/domain/layers.js';

function fixture(): {
  readonly snapshot: PaintProjectSnapshotV1;
  readonly ids: readonly string[];
} {
  const layers = [0, 1, 2, 3, 4].map((index) => createRasterLayer({ name: `L${index}` }));
  const document = createDocumentV1({ width: 64, height: 64 });
  return {
    snapshot: Object.freeze({
      schema: 'illustro.paint-project-snapshot/1' as const,
      document: Object.freeze({
        ...document,
        layerTree: Object.freeze({
          rootLayerIds: Object.freeze(layers.map((layer) => layer.id)),
          layers: Object.freeze(Object.fromEntries(layers.map((layer) => [layer.id, layer]))),
        }),
      }),
      committedStrokes: Object.freeze([]),
    }),
    ids: layers.map((layer) => layer.id),
  };
}

describe('M5B multi-layer move', () => {
  it('moves a non-contiguous selected set one stack step without changing relative order', () => {
    const { snapshot, ids } = fixture();
    const selected = [ids[1], ids[2]] as never[];
    expect(canMoveRootLayerSelectionStepV1(snapshot, selected, 1)).toBe(true);
    const moved = moveRootLayerSelectionStepSnapshotV1(
      snapshot,
      selected,
      1,
      parseRevision(1),
      new Date(0),
    );
    expect(moved.document.layerTree.rootLayerIds).toEqual([ids[0], ids[3], ids[1], ids[2], ids[4]]);
    const movedBack = moveRootLayerSelectionStepSnapshotV1(
      moved,
      selected,
      -1,
      parseRevision(2),
      new Date(1),
    );
    expect(movedBack.document.layerTree.rootLayerIds).toEqual(ids);
  });

  it('moves separated selected layers stably by one step', () => {
    const { snapshot, ids } = fixture();
    const moved = moveRootLayerSelectionStepSnapshotV1(
      snapshot,
      [ids[1], ids[3]] as never[],
      1,
      parseRevision(1),
    );
    expect(moved.document.layerTree.rootLayerIds).toEqual([ids[0], ids[2], ids[1], ids[4], ids[3]]);
  });

  it('drag-reorders the selected layers as one block at the requested remaining-stack index', () => {
    const { snapshot, ids } = fixture();
    const moved = reorderRootLayerSelectionSnapshotV1(
      snapshot,
      [ids[1], ids[3]] as never[],
      3,
      parseRevision(1),
    );
    expect(moved.document.layerTree.rootLayerIds).toEqual([ids[0], ids[2], ids[4], ids[1], ids[3]]);
  });

  it('rejects empty selection and no-op boundary movement', () => {
    const { snapshot, ids } = fixture();
    expect(() =>
      moveRootLayerSelectionStepSnapshotV1(snapshot, [] as never[], 1, parseRevision(1)),
    ).toThrow('cannot be empty');
    expect(canMoveRootLayerSelectionStepV1(snapshot, [ids[4]] as never[], 1)).toBe(false);
    expect(() =>
      moveRootLayerSelectionStepSnapshotV1(snapshot, [ids[4]] as never[], 1, parseRevision(1)),
    ).toThrow('no changes');
  });
});
