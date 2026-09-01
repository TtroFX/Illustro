import { describe, expect, it } from 'vitest';
import {
  applyGroupedAffineLayerTransformSnapshotV1,
  groupedLayerTransformEligibilityV1,
} from '../../src/app/layer-group-transform.js';
import type { PaintProjectSnapshotV1 } from '../../src/app/paint-session-controller.js';
import { createDocumentV1 } from '../../src/domain/document.js';
import { parseRevision } from '../../src/domain/identity.js';
import { createFolderLayer, createRasterLayer } from '../../src/domain/layers.js';

function fixture(): {
  readonly snapshot: PaintProjectSnapshotV1;
  readonly first: ReturnType<typeof createRasterLayer>;
  readonly second: ReturnType<typeof createRasterLayer>;
  readonly third: ReturnType<typeof createRasterLayer>;
} {
  const first = createRasterLayer({ name: 'First' });
  const second = createRasterLayer({ name: 'Second' });
  const third = createRasterLayer({ name: 'Third' });
  const document = createDocumentV1({ width: 400, height: 300 });
  return {
    snapshot: Object.freeze({
      schema: 'illustro.paint-project-snapshot/1' as const,
      document: Object.freeze({
        ...document,
        layerTree: Object.freeze({
          rootLayerIds: Object.freeze([first.id, second.id, third.id]),
          layers: Object.freeze({
            [first.id]: first,
            [second.id]: second,
            [third.id]: third,
          }),
        }),
      }),
      committedStrokes: Object.freeze([]),
    }),
    first,
    second,
    third,
  };
}

describe('M5B grouped transform', () => {
  it('adds one shared grouped affine transform transaction to each selected layer', () => {
    const { snapshot, first, second, third } = fixture();
    const transformed = applyGroupedAffineLayerTransformSnapshotV1(
      snapshot,
      [second.id, first.id],
      {
        translateX: 12,
        translateY: -4,
        scaleX: 2,
        scaleY: 0.5,
        rotationDeg: 90,
        pivotX: 200,
        pivotY: 150,
      },
      parseRevision(1),
      new Date(0),
    );
    const firstNode = transformed.document.layerTree.layers[first.id]?.transformStack.at(-1);
    const secondNode = transformed.document.layerTree.layers[second.id]?.transformStack.at(-1);
    expect(firstNode?.kind).toBe('affine');
    expect(secondNode?.kind).toBe('affine');
    expect(firstNode?.id).not.toBe(secondNode?.id);
    expect(firstNode?.parameters.groupTransformId).toBe(secondNode?.parameters.groupTransformId);
    expect(firstNode?.parameters).toMatchObject({
      schema: 'illustro.grouped-affine-transform/1',
      translateX: 12,
      translateY: -4,
      scaleX: 2,
      scaleY: 0.5,
      rotationDeg: 90,
      pivotX: 200,
      pivotY: 150,
    });
    expect(firstNode?.parameters.matrix).toHaveLength(6);
    expect(transformed.document.layerTree.layers[third.id]?.transformStack).toHaveLength(0);
    expect(transformed.document.revision).toBe(1);
    expect(transformed.document.modifiedAt).toBe(new Date(0).toISOString());
  });

  it('requires at least two transformable unlocked root layers', () => {
    const { snapshot, first, second } = fixture();
    expect(groupedLayerTransformEligibilityV1(snapshot, [first.id]).eligible).toBe(false);
    const lockedSecond = Object.freeze({
      ...second,
      locks: Object.freeze({ ...second.locks, position: true }),
    });
    const lockedSnapshot = Object.freeze({
      ...snapshot,
      document: Object.freeze({
        ...snapshot.document,
        layerTree: Object.freeze({
          ...snapshot.document.layerTree,
          layers: Object.freeze({
            ...snapshot.document.layerTree.layers,
            [second.id]: lockedSecond,
          }),
        }),
      }),
    });
    expect(groupedLayerTransformEligibilityV1(lockedSnapshot, [first.id, second.id])).toMatchObject(
      {
        eligible: false,
        reason: 'layer position is locked: Second',
      },
    );
  });

  it('reserves folder transforms for the dedicated folder-level path', () => {
    const { snapshot, first } = fixture();
    const folder = createFolderLayer({ name: 'Folder' });
    const withFolder = Object.freeze({
      ...snapshot,
      document: Object.freeze({
        ...snapshot.document,
        layerTree: Object.freeze({
          rootLayerIds: Object.freeze([...snapshot.document.layerTree.rootLayerIds, folder.id]),
          layers: Object.freeze({ ...snapshot.document.layerTree.layers, [folder.id]: folder }),
        }),
      }),
    });
    expect(groupedLayerTransformEligibilityV1(withFolder, [first.id, folder.id])).toMatchObject({
      eligible: false,
      reason: 'folder transforms use the folder-level transform path',
    });
  });

  it('rejects an identity transform instead of creating empty history work', () => {
    const { snapshot, first, second } = fixture();
    expect(() =>
      applyGroupedAffineLayerTransformSnapshotV1(
        snapshot,
        [first.id, second.id],
        {
          translateX: 0,
          translateY: 0,
          scaleX: 1,
          scaleY: 1,
          rotationDeg: 0,
          pivotX: 200,
          pivotY: 150,
        },
        parseRevision(1),
      ),
    ).toThrow('has no changes');
  });
});
