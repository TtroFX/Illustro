import { createNodeId, type LayerId, type MaskId, type Revision } from '../domain/identity.js';
import type { LayerBaseV1, RasterMaskAttachmentV1, TransformNodeV1 } from '../domain/layers.js';
import type { PaintProjectSnapshotV1 } from './paint-session-controller.js';
import { maskLinkedToLayerV1 } from './layer-mask-operations.js';

export interface IndependentMaskAffineTransformInputV1 {
  readonly translateX: number;
  readonly translateY: number;
  readonly scaleX: number;
  readonly scaleY: number;
  readonly rotationDeg: number;
  readonly pivotX: number;
  readonly pivotY: number;
}

export interface IndependentMaskTransformEligibilityV1 {
  readonly schema: 'illustro.independent-mask-transform-eligibility/1';
  readonly eligible: boolean;
  readonly reason: string | null;
}

function eligibility(
  eligible: boolean,
  reason: string | null,
): IndependentMaskTransformEligibilityV1 {
  return Object.freeze({
    schema: 'illustro.independent-mask-transform-eligibility/1' as const,
    eligible,
    reason,
  });
}

function rasterMask(
  snapshot: PaintProjectSnapshotV1,
  layerId: LayerId,
  maskId: MaskId,
): { readonly layer: LayerBaseV1; readonly mask: RasterMaskAttachmentV1 } | null {
  const layer = snapshot.document.layerTree.layers[layerId];
  if (layer === undefined) return null;
  const mask = layer.masks.find((entry) => entry.id === maskId);
  if (mask?.kind !== 'raster-mask') return null;
  return Object.freeze({ layer, mask });
}

export function independentMaskTransformEligibilityV1(
  snapshot: PaintProjectSnapshotV1,
  layerId: LayerId,
  maskId: MaskId,
): IndependentMaskTransformEligibilityV1 {
  const target = rasterMask(snapshot, layerId, maskId);
  if (target === null) return eligibility(false, 'independent transform requires a Raster Mask');
  if (target.layer.type === 'lineartBoundary') {
    return eligibility(false, 'Lineart Boundary mask transform is unavailable');
  }
  if (target.layer.locks.all || target.layer.locks.position) {
    return eligibility(false, 'mask transform is blocked by the layer position lock');
  }
  if (maskLinkedToLayerV1(target.mask)) {
    return eligibility(false, 'unlink the mask before moving or transforming it independently');
  }
  return eligibility(true, null);
}

function finite(value: number, label: string): number {
  if (!Number.isFinite(value)) throw new RangeError(`${label} must be finite`);
  return value;
}

function normalizeInput(
  input: IndependentMaskAffineTransformInputV1,
): IndependentMaskAffineTransformInputV1 {
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
    throw new RangeError('mask transform scale must be greater than zero');
  }
  if (
    normalized.translateX === 0 &&
    normalized.translateY === 0 &&
    normalized.scaleX === 1 &&
    normalized.scaleY === 1 &&
    normalized.rotationDeg === 0
  ) {
    throw new Error('mask transform has no changes');
  }
  return normalized;
}

function affineMatrix(
  input: IndependentMaskAffineTransformInputV1,
): readonly [number, number, number, number, number, number] {
  const radians = (input.rotationDeg * Math.PI) / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  const a = cosine * input.scaleX;
  const b = sine * input.scaleX;
  const cValue = -sine * input.scaleY;
  const c = Object.is(cValue, -0) ? 0 : cValue;
  const d = cosine * input.scaleY;
  const e = input.translateX + input.pivotX - a * input.pivotX - c * input.pivotY;
  const f = input.translateY + input.pivotY - b * input.pivotX - d * input.pivotY;
  return Object.freeze([a, b, c, d, e, f]);
}

export function applyIndependentMaskAffineTransformSnapshotV1(
  snapshot: PaintProjectSnapshotV1,
  layerId: LayerId,
  maskId: MaskId,
  input: IndependentMaskAffineTransformInputV1,
  revision: Revision,
  now: Date = new Date(),
): PaintProjectSnapshotV1 {
  const check = independentMaskTransformEligibilityV1(snapshot, layerId, maskId);
  if (!check.eligible) throw new Error(check.reason ?? 'independent mask transform is unavailable');
  const target = rasterMask(snapshot, layerId, maskId);
  if (target === null) throw new Error('independent transform lost its Raster Mask target');
  const normalized = normalizeInput(input);
  const node: TransformNodeV1 = Object.freeze({
    id: createNodeId(),
    revision,
    kind: 'affine',
    parameters: Object.freeze({
      schema: 'illustro.mask-affine-transform/1',
      translateX: normalized.translateX,
      translateY: normalized.translateY,
      scaleX: normalized.scaleX,
      scaleY: normalized.scaleY,
      rotationDeg: normalized.rotationDeg,
      pivotX: normalized.pivotX,
      pivotY: normalized.pivotY,
      matrix: affineMatrix(normalized),
    }),
  });
  const nextMask: RasterMaskAttachmentV1 = Object.freeze({
    ...target.mask,
    revision,
    transformStack: Object.freeze([...target.mask.transformStack, node]),
  });
  const nextLayer = Object.freeze({
    ...target.layer,
    revision,
    masks: Object.freeze(
      target.layer.masks.map((entry) => (entry.id === maskId ? nextMask : entry)),
    ),
  }) as LayerBaseV1;
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
          [layerId]: nextLayer,
        }),
      }),
    }),
    committedStrokes: snapshot.committedStrokes,
  });
}

export function applyIndependentMaskMoveSnapshotV1(
  snapshot: PaintProjectSnapshotV1,
  layerId: LayerId,
  maskId: MaskId,
  translateX: number,
  translateY: number,
  revision: Revision,
  now: Date = new Date(),
): PaintProjectSnapshotV1 {
  return applyIndependentMaskAffineTransformSnapshotV1(
    snapshot,
    layerId,
    maskId,
    {
      translateX,
      translateY,
      scaleX: 1,
      scaleY: 1,
      rotationDeg: 0,
      pivotX: 0,
      pivotY: 0,
    },
    revision,
    now,
  );
}
