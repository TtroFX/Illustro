import type { LayerId, MaskId, Revision } from '../domain/identity.js';
import type { LayerBaseV1, RasterMaskAttachmentV1 } from '../domain/layers.js';
import type { PaintProjectSnapshotV1 } from './paint-session-controller.js';

function requireRasterMaskV1(
  snapshot: PaintProjectSnapshotV1,
  layerId: LayerId,
  maskId: MaskId,
): { readonly layer: LayerBaseV1; readonly mask: RasterMaskAttachmentV1 } {
  const layer = snapshot.document.layerTree.layers[layerId];
  if (layer === undefined) throw new Error(`mask layer is missing: ${layerId}`);
  const mask = layer.masks.find((entry) => entry.id === maskId);
  if (mask === undefined) throw new Error(`mask is missing: ${maskId}`);
  if (mask.kind !== 'raster-mask') throw new Error('mask operation requires a Raster Mask');
  if (layer.type === 'lineartBoundary')
    throw new Error('Lineart Boundary mask operations are unavailable');
  if (layer.locks.all) throw new Error('mask operation is blocked by the layer lock');
  return Object.freeze({ layer, mask });
}

export function setMaskInvertedSnapshotV1(
  snapshot: PaintProjectSnapshotV1,
  layerId: LayerId,
  maskId: MaskId,
  inverted: boolean,
  revision: Revision,
  now: Date = new Date(),
): PaintProjectSnapshotV1 {
  const { layer, mask } = requireRasterMaskV1(snapshot, layerId, maskId);
  if (mask.inverted === inverted) throw new Error('mask invert has no changes');
  const nextMask = Object.freeze({ ...mask, revision, inverted });
  const nextLayer = Object.freeze({
    ...layer,
    revision,
    masks: Object.freeze(layer.masks.map((entry) => (entry.id === mask.id ? nextMask : entry))),
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
  });
}

export function maskLinkedToLayerV1(mask: RasterMaskAttachmentV1): boolean {
  return mask.linkedToLayer !== false;
}

export function setMaskLinkedToLayerSnapshotV1(
  snapshot: PaintProjectSnapshotV1,
  layerId: LayerId,
  maskId: MaskId,
  linkedToLayer: boolean,
  revision: Revision,
  now: Date = new Date(),
): PaintProjectSnapshotV1 {
  const { layer, mask } = requireRasterMaskV1(snapshot, layerId, maskId);
  if (maskLinkedToLayerV1(mask) === linkedToLayer) {
    throw new Error('mask link state has no changes');
  }
  const nextMask = Object.freeze({ ...mask, revision, linkedToLayer });
  const nextLayer = Object.freeze({
    ...layer,
    revision,
    masks: Object.freeze(layer.masks.map((entry) => (entry.id === mask.id ? nextMask : entry))),
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
  });
}
