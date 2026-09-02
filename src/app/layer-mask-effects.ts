import { createNodeId, type LayerId, type MaskId, type Revision } from '../domain/identity.js';
import type { EffectNodeV1, LayerBaseV1, RasterMaskAttachmentV1 } from '../domain/layers.js';
import type { PaintProjectSnapshotV1 } from './paint-session-controller.js';

export const MASK_FEATHER_EFFECT_ID_V1 = 'mask.feather';
export const MASK_BLUR_EFFECT_ID_V1 = 'mask.blur';
export type MaskCoverageEffectIdV1 =
  | typeof MASK_FEATHER_EFFECT_ID_V1
  | typeof MASK_BLUR_EFFECT_ID_V1;

export interface MaskCoverageEffectStateV1 {
  readonly schema: 'illustro.mask-coverage-effect-state/1';
  readonly effectId: MaskCoverageEffectIdV1;
  readonly radiusPx: number;
  readonly enabled: boolean;
}

export function maskEffectStackV1(mask: RasterMaskAttachmentV1): readonly EffectNodeV1[] {
  return mask.effectStack ?? Object.freeze([]);
}

export function maskCoverageEffectStateV1(
  mask: RasterMaskAttachmentV1,
  effectId: MaskCoverageEffectIdV1,
): MaskCoverageEffectStateV1 {
  const node = maskEffectStackV1(mask).find((entry) => entry.effectId === effectId);
  const radius = node?.parameters.radiusPx;
  return Object.freeze({
    schema: 'illustro.mask-coverage-effect-state/1' as const,
    effectId,
    radiusPx: typeof radius === 'number' && Number.isFinite(radius) && radius >= 0 ? radius : 0,
    enabled: node?.enabled ?? false,
  });
}

function requireRasterMask(
  snapshot: PaintProjectSnapshotV1,
  layerId: LayerId,
  maskId: MaskId,
): { readonly layer: LayerBaseV1; readonly mask: RasterMaskAttachmentV1 } {
  const layer = snapshot.document.layerTree.layers[layerId];
  if (layer === undefined) throw new Error(`mask layer is missing: ${layerId}`);
  const mask = layer.masks.find((entry) => entry.id === maskId);
  if (mask?.kind !== 'raster-mask') throw new Error('mask coverage effect requires a Raster Mask');
  if (layer.type === 'lineartBoundary') {
    throw new Error('Lineart Boundary mask effects are unavailable');
  }
  if (layer.locks.all) throw new Error('mask coverage effect is blocked by the layer lock');
  return Object.freeze({ layer, mask });
}

function normalizeRadius(radiusPx: number): number {
  if (!Number.isFinite(radiusPx) || radiusPx < 0) {
    throw new RangeError('mask effect radius must be a finite value greater than or equal to zero');
  }
  return radiusPx;
}

function effectParameters(
  effectId: MaskCoverageEffectIdV1,
  radiusPx: number,
): Readonly<Record<string, unknown>> {
  return effectId === MASK_FEATHER_EFFECT_ID_V1
    ? Object.freeze({
        schema: 'illustro.mask-feather/1',
        radiusPx,
        mode: 'symmetric-soft-edge',
      })
    : Object.freeze({
        schema: 'illustro.mask-blur/1',
        radiusPx,
        kernel: 'gaussian-separable',
      });
}

export function setMaskCoverageEffectRadiusSnapshotV1(
  snapshot: PaintProjectSnapshotV1,
  layerId: LayerId,
  maskId: MaskId,
  effectId: MaskCoverageEffectIdV1,
  radiusPx: number,
  revision: Revision,
  now: Date = new Date(),
): PaintProjectSnapshotV1 {
  const { layer, mask } = requireRasterMask(snapshot, layerId, maskId);
  const radius = normalizeRadius(radiusPx);
  const currentStack = maskEffectStackV1(mask);
  const existing = currentStack.find((entry) => entry.effectId === effectId);
  const current = maskCoverageEffectStateV1(mask, effectId);
  if (
    (radius === 0 && existing === undefined) ||
    (radius > 0 && current.enabled && current.radiusPx === radius)
  ) {
    throw new Error('mask coverage effect has no changes');
  }

  let nextStack: readonly EffectNodeV1[];
  if (radius === 0) {
    nextStack = Object.freeze(currentStack.filter((entry) => entry.effectId !== effectId));
  } else if (existing === undefined) {
    const node: EffectNodeV1 = Object.freeze({
      id: createNodeId(),
      revision,
      effectId,
      enabled: true,
      parameters: effectParameters(effectId, radius),
    });
    nextStack = Object.freeze([...currentStack, node]);
  } else {
    const node: EffectNodeV1 = Object.freeze({
      ...existing,
      revision,
      enabled: true,
      parameters: effectParameters(effectId, radius),
    });
    nextStack = Object.freeze(
      currentStack.map((entry) => (entry.id === existing.id ? node : entry)),
    );
  }

  const nextMask: RasterMaskAttachmentV1 = Object.freeze({
    ...mask,
    revision,
    effectStack: nextStack,
  });
  const nextLayer = Object.freeze({
    ...layer,
    revision,
    masks: Object.freeze(layer.masks.map((entry) => (entry.id === maskId ? nextMask : entry))),
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
