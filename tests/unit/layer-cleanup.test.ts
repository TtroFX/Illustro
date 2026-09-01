import { describe, expect, it } from 'vitest';
import {
  applyLayerCleanupSnapshotV1,
  layerCleanupCandidatesV1,
} from '../../src/app/layer-cleanup.js';
import type { PaintProjectSnapshotV1 } from '../../src/app/paint-session-controller.js';
import { createDocumentV1 } from '../../src/domain/document.js';
import { parseRevision } from '../../src/domain/identity.js';
import {
  createFolderLayer,
  createRasterLayer,
  createRasterTileReference,
  createVectorLayer,
} from '../../src/domain/layers.js';

function fixture(): {
  readonly snapshot: PaintProjectSnapshotV1;
  readonly emptyRaster: ReturnType<typeof createRasterLayer>;
  readonly paintedRaster: ReturnType<typeof createRasterLayer>;
  readonly hiddenRaster: ReturnType<typeof createRasterLayer>;
  readonly emptyVector: ReturnType<typeof createVectorLayer>;
  readonly emptyFolder: ReturnType<typeof createFolderLayer>;
  readonly lineartGroup: ReturnType<typeof createFolderLayer>;
} {
  const emptyRaster = createRasterLayer({ name: 'Empty Raster' });
  const paintedRaster = createRasterLayer({
    name: 'Painted',
    tiles: [createRasterTileReference({ x: 0, y: 0, payloadRef: 'tile-painted' })],
  });
  const hiddenRaster = createRasterLayer({
    name: 'Hidden',
    visible: false,
    tiles: [createRasterTileReference({ x: 1, y: 0, payloadRef: 'tile-hidden' })],
  });
  const emptyVector = createVectorLayer({ name: 'Empty Vector' });
  const emptyFolder = createFolderLayer({ name: 'Empty Folder' });
  const lineartGroup = createFolderLayer({
    name: 'Lineart',
    visible: false,
    role: 'lineart-group',
  });
  const document = createDocumentV1({ width: 512, height: 512 });
  const layers = Object.freeze({
    [emptyRaster.id]: emptyRaster,
    [paintedRaster.id]: paintedRaster,
    [hiddenRaster.id]: hiddenRaster,
    [emptyVector.id]: emptyVector,
    [emptyFolder.id]: emptyFolder,
    [lineartGroup.id]: lineartGroup,
  });
  return {
    snapshot: Object.freeze({
      schema: 'illustro.paint-project-snapshot/1' as const,
      document: Object.freeze({
        ...document,
        layerTree: Object.freeze({
          rootLayerIds: Object.freeze([
            emptyRaster.id,
            paintedRaster.id,
            hiddenRaster.id,
            emptyVector.id,
            emptyFolder.id,
            lineartGroup.id,
          ]),
          layers,
        }),
      }),
      committedStrokes: Object.freeze([]),
    }),
    emptyRaster,
    paintedRaster,
    hiddenRaster,
    emptyVector,
    emptyFolder,
    lineartGroup,
  };
}

describe('M5B bulk layer cleanup', () => {
  it('finds empty raster/vector/normal-folder layers without removing generated or protected semantics', () => {
    const { snapshot, emptyRaster, paintedRaster, emptyVector, emptyFolder, lineartGroup } =
      fixture();
    const candidates = layerCleanupCandidatesV1(snapshot, 'empty');
    expect(candidates).toContain(emptyRaster.id);
    expect(candidates).toContain(emptyVector.id);
    expect(candidates).toContain(emptyFolder.id);
    expect(candidates).not.toContain(paintedRaster.id);
    expect(candidates).not.toContain(lineartGroup.id);
  });

  it('removes hidden ordinary layer subtrees but protects Lineart Group state', () => {
    const { snapshot, hiddenRaster, lineartGroup } = fixture();
    const candidates = layerCleanupCandidatesV1(snapshot, 'hidden');
    expect(candidates).toContain(hiddenRaster.id);
    expect(candidates).not.toContain(lineartGroup.id);
    const cleaned = applyLayerCleanupSnapshotV1(snapshot, 'hidden', parseRevision(1), new Date(0));
    expect(cleaned.document.layerTree.layers[hiddenRaster.id]).toBeUndefined();
    expect(cleaned.document.layerTree.layers[lineartGroup.id]).toBeDefined();
    expect(cleaned.document.revision).toBe(1);
    expect(cleaned.document.modifiedAt).toBe(new Date(0).toISOString());
  });

  it('removes empty candidates atomically and rejects a no-op cleanup', () => {
    const { snapshot, emptyRaster, paintedRaster } = fixture();
    const cleaned = applyLayerCleanupSnapshotV1(snapshot, 'empty', parseRevision(1));
    expect(cleaned.document.layerTree.layers[emptyRaster.id]).toBeUndefined();
    expect(cleaned.document.layerTree.layers[paintedRaster.id]).toBeDefined();
    expect(() => applyLayerCleanupSnapshotV1(cleaned, 'empty', parseRevision(2))).toThrow(
      /has no changes/,
    );
  });
});
