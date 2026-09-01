import { createNodeId, type LayerId, type Revision } from '../domain/identity.js';
import type { LayerBaseV1, TransformNodeV1 } from '../domain/layers.js';
import type { PaintProjectSnapshotV1 } from './paint-session-controller.js';

export interface GroupedAffineLayerTransformInputV1 {
  readonly translateX: number;
  readonly translateY: number;
  readonly scaleX: number;
  readonly scaleY: number;
  readonly rotationDeg: number;
  readonly pivotX: number;
  readonly pivotY: number;
}

export interface GroupedLayerTransformEligibilityV1 {
  readonly schema: 'illustro.grouped-layer-transform-eligibility/1';
  readonly eligible: boolean;
  readonly layerIds: readonly LayerId[];
  readonly reason: string | null;
}

function result(
  eligible: boolean,
  layerIds: readonly LayerId[],
  reason: string | null,
): GroupedLayerTransformEligibilityV1 {
  return Object.freeze({
    schema: 'illustro.grouped-layer-transform-eligibility/1' as const,
    eligible,
    layerIds: Object.freeze([...layerIds]),
    reason,
  });
}

function canonicalRootSelection(
  snapshot: PaintProjectSnapshotV1,
  layerIds: readonly LayerId[],
): readonly LayerId[] {
  const selected = new Set(layerIds);
  return Object.freeze(
    snapshot.document.layerTree.rootLayerIds.filter((layerId) => selected.has(layerId)),
  );
}

export function groupedLayerTransformEligibilityV1(
  snapshot: PaintProjectSnapshotV1,
  layerIds: readonly LayerId[],
): GroupedLayerTransformEligibilityV1 {
  const unique = new Set(layerIds);
  const ordered = canonicalRootSelection(snapshot, layerIds);
  if (unique.size !== ordered.length) {
    return result(false, ordered, 'grouped transform requires existing root layers only');
  }
  if (ordered.length < 2) {
    return result(false, ordered, 'grouped transform requires at least two selected layers');
  }
  for (const layerId of ordered) {
    const layer = snapshot.document.layerTree.layers[layerId];
    if (layer === undefined) return result(false, ordered, `layer is missing: ${layerId}`);
    if (layer.type === 'folder') {
      return result(false, ordered, 'folder transforms use the folder-level transform path');
    }
    if (layer.type === 'lineartBoundary') {
      return result(false, ordered, 'Lineart Boundary transform is owned by the Lineart Group');
    }
    if (layer.locks.all || layer.locks.position) {
      return result(false, ordered, `layer position is locked: ${layer.name}`);
    }
  }
  return result(true, ordered, null);
}

function finite(value: number, label: string): number {
  if (!Number.isFinite(value)) throw new RangeError(`${label} must be finite`);
  return value;
}

function normalizedInput(
  input: GroupedAffineLayerTransformInputV1,
): GroupedAffineLayerTransformInputV1 {
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
    throw new RangeError('grouped transform scale must be greater than zero');
  }
  if (
    normalized.translateX === 0 &&
    normalized.translateY === 0 &&
    normalized.scaleX === 1 &&
    normalized.scaleY === 1 &&
    normalized.rotationDeg === 0
  ) {
    throw new Error('grouped transform has no changes');
  }
  return normalized;
}

function affineMatrix(
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

function transformedLayer(
  layer: LayerBaseV1,
  revision: Revision,
  groupTransformId: string,
  input: GroupedAffineLayerTransformInputV1,
): LayerBaseV1 {
  const matrix = affineMatrix(input);
  const node: TransformNodeV1 = Object.freeze({
    id: createNodeId(),
    revision,
    kind: 'affine',
    parameters: Object.freeze({
      schema: 'illustro.grouped-affine-transform/1',
      groupTransformId,
      translateX: input.translateX,
      translateY: input.translateY,
      scaleX: input.scaleX,
      scaleY: input.scaleY,
      rotationDeg: input.rotationDeg,
      pivotX: input.pivotX,
      pivotY: input.pivotY,
      matrix,
    }),
  });
  return Object.freeze({
    ...layer,
    revision,
    transformStack: Object.freeze([...layer.transformStack, node]),
    boundsHint: null,
  });
}

export function applyGroupedAffineLayerTransformSnapshotV1(
  snapshot: PaintProjectSnapshotV1,
  layerIds: readonly LayerId[],
  input: GroupedAffineLayerTransformInputV1,
  revision: Revision,
  now: Date = new Date(),
): PaintProjectSnapshotV1 {
  const eligibility = groupedLayerTransformEligibilityV1(snapshot, layerIds);
  if (!eligibility.eligible) {
    throw new Error(eligibility.reason ?? 'grouped transform is unavailable');
  }
  const normalized = normalizedInput(input);
  const groupTransformId = createNodeId();
  const layers: Record<string, LayerBaseV1> = { ...snapshot.document.layerTree.layers };
  for (const layerId of eligibility.layerIds) {
    const layer = layers[layerId];
    if (layer === undefined) throw new Error(`layer is missing: ${layerId}`);
    layers[layerId] = transformedLayer(layer, revision, groupTransformId, normalized);
  }
  return Object.freeze({
    ...snapshot,
    document: Object.freeze({
      ...snapshot.document,
      revision,
      modifiedAt: now.toISOString(),
      layerTree: Object.freeze({
        rootLayerIds: snapshot.document.layerTree.rootLayerIds,
        layers: Object.freeze(layers),
      }),
    }),
    committedStrokes: snapshot.committedStrokes,
  });
}
