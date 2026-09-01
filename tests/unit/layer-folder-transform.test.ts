import { describe, expect, it } from 'vitest';
import {
  applyFolderAffineTransformSnapshotV1,
  folderLayerTransformEligibilityV1,
} from '../../src/app/layer-folder-transform.js';
import type { PaintProjectSnapshotV1 } from '../../src/app/paint-session-controller.js';
import { createDocumentV1 } from '../../src/domain/document.js';
import { parseRevision } from '../../src/domain/identity.js';
import { createFolderLayer, createRasterLayer } from '../../src/domain/layers.js';

function fixture(role: 'normal' | 'lineart-group' = 'normal'): {
  readonly snapshot: PaintProjectSnapshotV1;
  readonly folder: ReturnType<typeof createFolderLayer>;
  readonly child: ReturnType<typeof createRasterLayer>;
} {
  const folder = createFolderLayer({ name: 'Folder', role });
  const child = createRasterLayer({ name: 'Child', parentId: folder.id });
  const folderWithChild = Object.freeze({ ...folder, childLayerIds: Object.freeze([child.id]) });
  const document = createDocumentV1({ width: 320, height: 240 });
  return {
    snapshot: Object.freeze({
      schema: 'illustro.paint-project-snapshot/1' as const,
      document: Object.freeze({
        ...document,
        layerTree: Object.freeze({
          rootLayerIds: Object.freeze([folder.id]),
          layers: Object.freeze({ [folder.id]: folderWithChild, [child.id]: child }),
        }),
      }),
      committedStrokes: Object.freeze([]),
    }),
    folder: folderWithChild,
    child,
  };
}

describe('M5B folder-level transform', () => {
  it('appends a non-destructive affine node to the folder while leaving child content canonical', () => {
    const { snapshot, folder, child } = fixture();
    const transformed = applyFolderAffineTransformSnapshotV1(
      snapshot,
      folder.id,
      {
        translateX: 20,
        translateY: 10,
        scaleX: 1.25,
        scaleY: 0.75,
        rotationDeg: 30,
        pivotX: 160,
        pivotY: 120,
      },
      parseRevision(1),
      new Date(0),
    );
    const folderAfter = transformed.document.layerTree.layers[folder.id];
    const node = folderAfter?.transformStack.at(-1);
    expect(folderAfter?.type).toBe('folder');
    expect(node?.kind).toBe('affine');
    expect(node?.parameters).toMatchObject({
      schema: 'illustro.folder-affine-transform/1',
      translateX: 20,
      translateY: 10,
      scaleX: 1.25,
      scaleY: 0.75,
      rotationDeg: 30,
      pivotX: 160,
      pivotY: 120,
    });
    expect(node?.parameters.matrix).toHaveLength(6);
    expect(transformed.document.layerTree.layers[child.id]).toEqual(child);
    expect(transformed.document.revision).toBe(1);
  });

  it('honors folder position/all locks', () => {
    const { snapshot, folder } = fixture();
    const lockedFolder = Object.freeze({
      ...folder,
      locks: Object.freeze({ ...folder.locks, position: true }),
    });
    const locked = Object.freeze({
      ...snapshot,
      document: Object.freeze({
        ...snapshot.document,
        layerTree: Object.freeze({
          ...snapshot.document.layerTree,
          layers: Object.freeze({
            ...snapshot.document.layerTree.layers,
            [folder.id]: lockedFolder,
          }),
        }),
      }),
    });
    expect(folderLayerTransformEligibilityV1(locked, folder.id)).toMatchObject({
      eligible: false,
      reason: 'folder position is locked: Folder',
    });
  });

  it('reserves Lineart Group transforms for the synchronized lineart path', () => {
    const { snapshot, folder } = fixture('lineart-group');
    expect(folderLayerTransformEligibilityV1(snapshot, folder.id)).toMatchObject({
      eligible: false,
      reason: 'Lineart Group transform requires the synchronized lineart transform path',
    });
  });

  it('rejects identity transforms', () => {
    const { snapshot, folder } = fixture();
    expect(() =>
      applyFolderAffineTransformSnapshotV1(
        snapshot,
        folder.id,
        {
          translateX: 0,
          translateY: 0,
          scaleX: 1,
          scaleY: 1,
          rotationDeg: 0,
          pivotX: 0,
          pivotY: 0,
        },
        parseRevision(1),
      ),
    ).toThrow('has no changes');
  });
});
