import type { LayerId, Revision } from '../domain/identity.js';
import type { FolderLayerV1, LayerBaseV1, RasterLayerV1, VectorLayerV1 } from '../domain/layers.js';
import type { PaintProjectSnapshotV1 } from './paint-session-controller.js';

export type LayerCleanupModeV1 = 'empty' | 'hidden';

function layer(snapshot: PaintProjectSnapshotV1, layerId: LayerId): LayerBaseV1 {
  const value = snapshot.document.layerTree.layers[layerId];
  if (value === undefined) throw new Error(`layer is missing: ${layerId}`);
  return value;
}

function isProtectedLineartLayerV1(snapshot: PaintProjectSnapshotV1, layerId: LayerId): boolean {
  const visited = new Set<LayerId>();
  let current: LayerId | null = layerId;
  while (current !== null) {
    if (visited.has(current)) throw new Error('layer parent cycle detected during cleanup');
    visited.add(current);
    const currentLayer = layer(snapshot, current);
    if (currentLayer.type === 'lineartBoundary') return true;
    if (
      currentLayer.type === 'folder' &&
      (currentLayer as FolderLayerV1).role === 'lineart-group'
    ) {
      return true;
    }
    current = currentLayer.parentId;
  }
  return false;
}

function collectSubtreeV1(snapshot: PaintProjectSnapshotV1, layerId: LayerId): readonly LayerId[] {
  const result: LayerId[] = [];
  const visit = (currentId: LayerId): void => {
    const current = layer(snapshot, currentId);
    result.push(currentId);
    if (current.type !== 'folder') return;
    for (const childId of (current as FolderLayerV1).childLayerIds) visit(childId);
  };
  visit(layerId);
  return Object.freeze(result);
}

function subtreeContainsProtectedLineartV1(
  snapshot: PaintProjectSnapshotV1,
  layerId: LayerId,
): boolean {
  return collectSubtreeV1(snapshot, layerId).some((id) => isProtectedLineartLayerV1(snapshot, id));
}

function emptyLayerCandidateV1(
  snapshot: PaintProjectSnapshotV1,
  layerId: LayerId,
  committedLayerIds: ReadonlySet<LayerId>,
  memo: Map<LayerId, boolean>,
): boolean {
  const cached = memo.get(layerId);
  if (cached !== undefined) return cached;
  if (isProtectedLineartLayerV1(snapshot, layerId)) {
    memo.set(layerId, false);
    return false;
  }
  const current = layer(snapshot, layerId);
  let empty = false;
  if (current.type === 'raster') {
    empty = (current as RasterLayerV1).tiles.length === 0 && !committedLayerIds.has(layerId);
  } else if (current.type === 'vector') {
    empty = (current as VectorLayerV1).objects.length === 0;
  } else if (current.type === 'folder') {
    const folder = current as FolderLayerV1;
    empty =
      folder.role === 'normal' &&
      folder.childLayerIds.every((childId) =>
        emptyLayerCandidateV1(snapshot, childId, committedLayerIds, memo),
      );
  }
  memo.set(layerId, empty);
  return empty;
}

export function layerCleanupCandidatesV1(
  snapshot: PaintProjectSnapshotV1,
  mode: LayerCleanupModeV1,
): readonly LayerId[] {
  const selected = new Set<LayerId>();
  if (mode === 'empty') {
    const committedLayerIds = new Set(
      snapshot.committedStrokes.map((entry) => entry.stroke.layerId),
    );
    const memo = new Map<LayerId, boolean>();
    for (const layerId of Object.values(snapshot.document.layerTree.layers).map(
      (item) => item.id,
    )) {
      if (emptyLayerCandidateV1(snapshot, layerId, committedLayerIds, memo)) selected.add(layerId);
    }
  } else {
    const visit = (layerId: LayerId): void => {
      if (isProtectedLineartLayerV1(snapshot, layerId)) return;
      const current = layer(snapshot, layerId);
      if (!current.visible && !subtreeContainsProtectedLineartV1(snapshot, layerId)) {
        for (const descendantId of collectSubtreeV1(snapshot, layerId)) selected.add(descendantId);
        return;
      }
      if (current.type === 'folder') {
        for (const childId of (current as FolderLayerV1).childLayerIds) visit(childId);
      }
    };
    for (const rootId of snapshot.document.layerTree.rootLayerIds) visit(rootId);
  }
  return Object.freeze([...selected]);
}

export function applyLayerCleanupSnapshotV1(
  snapshot: PaintProjectSnapshotV1,
  mode: LayerCleanupModeV1,
  revision: Revision,
  now: Date = new Date(),
): PaintProjectSnapshotV1 {
  const removed = new Set(layerCleanupCandidatesV1(snapshot, mode));
  if (removed.size === 0) throw new Error(`${mode} layer cleanup has no changes`);

  const layers: Record<string, LayerBaseV1> = {};
  for (const [id, current] of Object.entries(snapshot.document.layerTree.layers)) {
    if (removed.has(current.id)) continue;
    let next: LayerBaseV1 = current;
    if (current.type === 'folder') {
      const folder = current as FolderLayerV1;
      const childLayerIds = folder.childLayerIds.filter((childId) => !removed.has(childId));
      if (childLayerIds.length !== folder.childLayerIds.length) {
        next = Object.freeze({ ...folder, revision, childLayerIds: Object.freeze(childLayerIds) });
      }
    }
    if (next.clipping !== null && removed.has(next.clipping.baseLayerId)) {
      next = Object.freeze({ ...next, revision, clipping: null });
    }
    layers[id] = next;
  }

  return Object.freeze({
    ...snapshot,
    document: Object.freeze({
      ...snapshot.document,
      revision,
      modifiedAt: now.toISOString(),
      layerTree: Object.freeze({
        rootLayerIds: Object.freeze(
          snapshot.document.layerTree.rootLayerIds.filter((layerId) => !removed.has(layerId)),
        ),
        layers: Object.freeze(layers),
      }),
    }),
    committedStrokes: Object.freeze(
      snapshot.committedStrokes.filter((entry) => !removed.has(entry.stroke.layerId)),
    ),
  });
}
