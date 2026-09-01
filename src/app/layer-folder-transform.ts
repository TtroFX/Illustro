import { createNodeId, type LayerId, type Revision } from '../domain/identity.js';
import type { FolderLayerV1, TransformNodeV1 } from '../domain/layers.js';
import type { GroupedAffineLayerTransformInputV1 } from './layer-group-transform.js';
import type { PaintProjectSnapshotV1 } from './paint-session-controller.js';

export interface FolderLayerTransformEligibilityV1 {
  readonly schema: 'illustro.folder-layer-transform-eligibility/1';
  readonly eligible: boolean;
  readonly layerId: LayerId;
  readonly reason: string | null;
}

function result(
  layerId: LayerId,
  eligible: boolean,
  reason: string | null,
): FolderLayerTransformEligibilityV1 {
  return Object.freeze({
    schema: 'illustro.folder-layer-transform-eligibility/1' as const,
    eligible,
    layerId,
    reason,
  });
}

export function folderLayerTransformEligibilityV1(
  snapshot: PaintProjectSnapshotV1,
  layerId: LayerId,
): FolderLayerTransformEligibilityV1 {
  const layer = snapshot.document.layerTree.layers[layerId];
  if (layer === undefined) return result(layerId, false, `layer is missing: ${layerId}`);
  if (layer.type !== 'folder')
    return result(layerId, false, 'folder-level transform requires a folder');
  const folder = layer as FolderLayerV1;
  if (folder.role !== 'normal') {
    return result(
      layerId,
      false,
      'Lineart Group transform requires the synchronized lineart transform path',
    );
  }
  if (layer.locks.all || layer.locks.position) {
    return result(layerId, false, `folder position is locked: ${layer.name}`);
  }
  return result(layerId, true, null);
}

function finite(value: number, label: string): number {
  if (!Number.isFinite(value)) throw new RangeError(`${label} must be finite`);
  return value;
}

function normalize(input: GroupedAffineLayerTransformInputV1): GroupedAffineLayerTransformInputV1 {
  const normalized = Object.freeze({
    translateX: finite(input.translateX, 'translateX'),
    translateY: finite(input.translateY, 'translateY'),
    scaleX: finite(input.scaleX, 'scaleX'),
    scaleY: finite(input.scaleY, 'scaleY'),
    rotationDeg: finite(input.rotationDeg, 'rotationDeg'),
    pivotX: finite(input.pivotX, 'pivotX'),
    pivotY: finite(input.pivotY, 'pivotY'),
  });
  if (normalized.scaleX <= 0 || normalized.scaleY <= 0) {
    throw new RangeError('folder transform scale must be greater than zero');
  }
  if (
    normalized.translateX === 0 &&
    normalized.translateY === 0 &&
    normalized.scaleX === 1 &&
    normalized.scaleY === 1 &&
    normalized.rotationDeg === 0
  ) {
    throw new Error('folder transform has no changes');
  }
  return normalized;
}

function matrix(
  input: GroupedAffineLayerTransformInputV1,
): readonly [number, number, number, number, number, number] {
  const radians = (input.rotationDeg * Math.PI) / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  const a = cosine * input.scaleX;
  const b = sine * input.scaleX;
  const c = -sine * input.scaleY;
  const d = cosine * input.scaleY;
  const e = input.translateX + input.pivotX - a * input.pivotX - c * input.pivotY;
  const f = input.translateY + input.pivotY - b * input.pivotX - d * input.pivotY;
  return Object.freeze([a, b, c, d, e, f]);
}

export function applyFolderAffineTransformSnapshotV1(
  snapshot: PaintProjectSnapshotV1,
  layerId: LayerId,
  input: GroupedAffineLayerTransformInputV1,
  revision: Revision,
  now: Date = new Date(),
): PaintProjectSnapshotV1 {
  const eligibility = folderLayerTransformEligibilityV1(snapshot, layerId);
  if (!eligibility.eligible) {
    throw new Error(eligibility.reason ?? 'folder-level transform is unavailable');
  }
  const normalized = normalize(input);
  const layer = snapshot.document.layerTree.layers[layerId] as FolderLayerV1;
  const node: TransformNodeV1 = Object.freeze({
    id: createNodeId(),
    revision,
    kind: 'affine',
    parameters: Object.freeze({
      schema: 'illustro.folder-affine-transform/1',
      translateX: normalized.translateX,
      translateY: normalized.translateY,
      scaleX: normalized.scaleX,
      scaleY: normalized.scaleY,
      rotationDeg: normalized.rotationDeg,
      pivotX: normalized.pivotX,
      pivotY: normalized.pivotY,
      matrix: matrix(normalized),
    }),
  });
  const transformed: FolderLayerV1 = Object.freeze({
    ...layer,
    revision,
    transformStack: Object.freeze([...layer.transformStack, node]),
    boundsHint: null,
  });
  return Object.freeze({
    ...snapshot,
    document: Object.freeze({
      ...snapshot.document,
      revision,
      modifiedAt: now.toISOString(),
      layerTree: Object.freeze({
        rootLayerIds: snapshot.document.layerTree.rootLayerIds,
        layers: Object.freeze({
          ...snapshot.document.layerTree.layers,
          [layerId]: transformed,
        }),
      }),
    }),
    committedStrokes: snapshot.committedStrokes,
  });
}
