import { describe, expect, it } from 'vitest';
import {
  buildLayerCompositeStructureV1,
  folderPassThroughEligibilityV1,
  setFolderPassThroughSnapshotV1,
} from '../../src/app/layer-folder-pass-through.js';
import type { PaintProjectSnapshotV1 } from '../../src/app/paint-session-controller.js';
import { createDocumentV1 } from '../../src/domain/document.js';
import { parseRevision } from '../../src/domain/identity.js';
import { createFolderLayer, createRasterLayer } from '../../src/domain/layers.js';

function fixture(passThrough = false): {
  readonly snapshot: PaintProjectSnapshotV1;
  readonly folder: ReturnType<typeof createFolderLayer>;
  readonly child: ReturnType<typeof createRasterLayer>;
} {
  const initialFolder = createFolderLayer({
    name: 'Folder',
    blendMode: passThrough ? 'pass-through' : 'normal',
  });
  const child = createRasterLayer({ name: 'Child', parentId: initialFolder.id });
  const folder = Object.freeze({ ...initialFolder, childLayerIds: Object.freeze([child.id]) });
  const document = createDocumentV1({ width: 300, height: 200 });
  return {
    snapshot: Object.freeze({
      schema: 'illustro.paint-project-snapshot/1' as const,
      document: Object.freeze({
        ...document,
        layerTree: Object.freeze({
          rootLayerIds: Object.freeze([folder.id]),
          layers: Object.freeze({ [folder.id]: folder, [child.id]: child }),
        }),
      }),
      committedStrokes: Object.freeze([]),
    }),
    folder,
    child,
  };
}

describe('M5B Folder Pass Through', () => {
  it('toggles a normal folder as one canonical snapshot mutation', () => {
    const { snapshot, folder } = fixture();
    expect(folderPassThroughEligibilityV1(snapshot, folder.id)).toMatchObject({
      eligible: true,
      enabled: false,
    });
    const enabled = setFolderPassThroughSnapshotV1(
      snapshot,
      folder.id,
      true,
      parseRevision(1),
      new Date(0),
    );
    expect(enabled.document.layerTree.layers[folder.id]?.blendMode).toBe('pass-through');
    expect(enabled.document.revision).toBe(1);
    expect(enabled.document.modifiedAt).toBe(new Date(0).toISOString());
    expect(() =>
      setFolderPassThroughSnapshotV1(enabled, folder.id, true, parseRevision(2)),
    ).toThrow(/no changes/);
  });

  it('removes the folder isolation boundary from the compositor structure when Pass Through is enabled', () => {
    const isolated = fixture(false);
    expect(buildLayerCompositeStructureV1(isolated.snapshot)).toEqual([
      { kind: 'isolation-begin', folderId: isolated.folder.id },
      { kind: 'layer', layerId: isolated.child.id },
      { kind: 'isolation-end', folderId: isolated.folder.id },
    ]);
    const passThrough = fixture(true);
    expect(buildLayerCompositeStructureV1(passThrough.snapshot)).toEqual([
      { kind: 'layer', layerId: passThrough.child.id },
    ]);
  });

  it('keeps Lineart Group Pass Through owned by its specialized contract', () => {
    const { snapshot, folder } = fixture();
    const lineart = createFolderLayer({ id: folder.id, name: 'Lineart', role: 'lineart-group' });
    const specialized = Object.freeze({
      ...snapshot,
      document: Object.freeze({
        ...snapshot.document,
        layerTree: Object.freeze({
          ...snapshot.document.layerTree,
          layers: Object.freeze({ ...snapshot.document.layerTree.layers, [folder.id]: lineart }),
        }),
      }),
    });
    expect(folderPassThroughEligibilityV1(specialized, folder.id)).toMatchObject({
      eligible: false,
      enabled: true,
    });
  });
});
