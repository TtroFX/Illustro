import type { LayerId, Revision } from '../domain/identity.js';
import type { FolderLayerV1, LayerBaseV1 } from '../domain/layers.js';
import type { PaintProjectSnapshotV1 } from './paint-session-controller.js';

export interface FolderPassThroughEligibilityV1 {
  readonly schema: 'illustro.folder-pass-through-eligibility/1';
  readonly eligible: boolean;
  readonly enabled: boolean;
  readonly reason: string | null;
}

export type LayerCompositeStructureStepV1 =
  | Readonly<{ kind: 'layer'; layerId: LayerId }>
  | Readonly<{ kind: 'isolation-begin'; folderId: LayerId }>
  | Readonly<{ kind: 'isolation-end'; folderId: LayerId }>;

function requireLayer(snapshot: PaintProjectSnapshotV1, layerId: LayerId): LayerBaseV1 {
  const layer = snapshot.document.layerTree.layers[layerId];
  if (layer === undefined) throw new Error(`layer is missing: ${layerId}`);
  return layer;
}

export function folderPassThroughEligibilityV1(
  snapshot: PaintProjectSnapshotV1,
  layerId: LayerId,
): FolderPassThroughEligibilityV1 {
  const layer = requireLayer(snapshot, layerId);
  if (layer.type !== 'folder') {
    return Object.freeze({
      schema: 'illustro.folder-pass-through-eligibility/1' as const,
      eligible: false,
      enabled: false,
      reason: 'Pass Through is available only for folders',
    });
  }
  const folder = layer as FolderLayerV1;
  if (folder.role !== 'normal') {
    return Object.freeze({
      schema: 'illustro.folder-pass-through-eligibility/1' as const,
      eligible: false,
      enabled: folder.blendMode === 'pass-through',
      reason: 'Lineart Group Pass Through is managed by the Lineart Group contract',
    });
  }
  if (folder.locks.all) {
    return Object.freeze({
      schema: 'illustro.folder-pass-through-eligibility/1' as const,
      eligible: false,
      enabled: folder.blendMode === 'pass-through',
      reason: 'folder is locked',
    });
  }
  return Object.freeze({
    schema: 'illustro.folder-pass-through-eligibility/1' as const,
    eligible: true,
    enabled: folder.blendMode === 'pass-through',
    reason: null,
  });
}

export function setFolderPassThroughSnapshotV1(
  snapshot: PaintProjectSnapshotV1,
  layerId: LayerId,
  enabled: boolean,
  revision: Revision,
  now: Date = new Date(),
): PaintProjectSnapshotV1 {
  const eligibility = folderPassThroughEligibilityV1(snapshot, layerId);
  if (!eligibility.eligible)
    throw new Error(eligibility.reason ?? 'folder Pass Through is unavailable');
  if (eligibility.enabled === enabled) throw new Error('folder Pass Through has no changes');
  const folder = requireLayer(snapshot, layerId) as FolderLayerV1;
  const nextFolder = Object.freeze({
    ...folder,
    revision,
    blendMode: enabled ? ('pass-through' as const) : ('normal' as const),
  });
  return Object.freeze({
    ...snapshot,
    document: Object.freeze({
      ...snapshot.document,
      revision,
      modifiedAt: now.toISOString(),
      layerTree: Object.freeze({
        rootLayerIds: snapshot.document.layerTree.rootLayerIds,
        layers: Object.freeze({ ...snapshot.document.layerTree.layers, [layerId]: nextFolder }),
      }),
    }),
    committedStrokes: snapshot.committedStrokes,
  });
}

export function buildLayerCompositeStructureV1(
  snapshot: PaintProjectSnapshotV1,
): readonly LayerCompositeStructureStepV1[] {
  const steps: LayerCompositeStructureStepV1[] = [];
  const visited = new Set<LayerId>();
  const visit = (layerId: LayerId): void => {
    if (visited.has(layerId))
      throw new Error('layer tree cycle detected while building composite structure');
    visited.add(layerId);
    const layer = requireLayer(snapshot, layerId);
    if (!layer.visible || layer.type === 'lineartBoundary') {
      visited.delete(layerId);
      return;
    }
    if (layer.type !== 'folder') {
      steps.push(Object.freeze({ kind: 'layer' as const, layerId }));
      visited.delete(layerId);
      return;
    }
    const folder = layer as FolderLayerV1;
    const isolated = folder.blendMode !== 'pass-through';
    if (isolated)
      steps.push(Object.freeze({ kind: 'isolation-begin' as const, folderId: folder.id }));
    for (const childId of folder.childLayerIds) visit(childId);
    if (isolated)
      steps.push(Object.freeze({ kind: 'isolation-end' as const, folderId: folder.id }));
    visited.delete(layerId);
  };
  for (const rootId of snapshot.document.layerTree.rootLayerIds) visit(rootId);
  return Object.freeze(steps);
}
