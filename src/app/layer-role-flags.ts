import type { LayerId, Revision } from '../domain/identity.js';
import type { LayerBaseV1 } from '../domain/layers.js';
import type { PaintProjectSnapshotV1 } from './paint-session-controller.js';

export type ArtworkLayerRoleFlagV1 = 'reference' | 'draft';

function updateLayerRoleFlagSnapshotV1(
  snapshot: PaintProjectSnapshotV1,
  layerId: LayerId,
  flag: ArtworkLayerRoleFlagV1,
  enabled: boolean,
  revision: Revision,
  now: Date,
): PaintProjectSnapshotV1 {
  const layer = snapshot.document.layerTree.layers[layerId];
  if (layer === undefined) throw new Error(`layer role target is missing: ${layerId}`);
  if (layer.type === 'lineartBoundary') {
    throw new Error('Lineart Boundary uses dedicated boundary semantics, not artwork role flags');
  }
  if (layer.locks.all) throw new Error('layer role update is blocked by the layer lock');
  if (layer.roleFlags[flag] === enabled) throw new Error('layer role update has no changes');
  const nextLayer = Object.freeze({
    ...layer,
    revision,
    roleFlags: Object.freeze({ ...layer.roleFlags, [flag]: enabled }),
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
    committedStrokes: snapshot.committedStrokes,
  });
}

export function setReferenceLayerSnapshotV1(
  snapshot: PaintProjectSnapshotV1,
  layerId: LayerId,
  enabled: boolean,
  revision: Revision,
  now: Date = new Date(),
): PaintProjectSnapshotV1 {
  return updateLayerRoleFlagSnapshotV1(snapshot, layerId, 'reference', enabled, revision, now);
}

export function setDraftLayerSnapshotV1(
  snapshot: PaintProjectSnapshotV1,
  layerId: LayerId,
  enabled: boolean,
  revision: Revision,
  now: Date = new Date(),
): PaintProjectSnapshotV1 {
  return updateLayerRoleFlagSnapshotV1(snapshot, layerId, 'draft', enabled, revision, now);
}
