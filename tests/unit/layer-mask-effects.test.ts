import { describe, expect, it } from 'vitest';
import {
  MASK_BLUR_EFFECT_ID_V1,
  MASK_FEATHER_EFFECT_ID_V1,
  maskCoverageEffectStateV1,
  setMaskCoverageEffectRadiusSnapshotV1,
} from '../../src/app/layer-mask-effects.js';
import type { PaintProjectSnapshotV1 } from '../../src/app/paint-session-controller.js';
import { createDocumentV1 } from '../../src/domain/document.js';
import { parseRevision } from '../../src/domain/identity.js';
import {
  createRasterLayer,
  createRasterMask,
  createRasterTileReference,
} from '../../src/domain/layers.js';

function fixture() {
  const tile = createRasterTileReference({ x: 0, y: 0, payloadRef: 'coverage' });
  const mask = createRasterMask({ tiles: [tile] });
  const layer = createRasterLayer({ name: 'Masked', masks: [mask] });
  const document = createDocumentV1({ width: 128, height: 128 });
  const snapshot: PaintProjectSnapshotV1 = Object.freeze({
    schema: 'illustro.paint-project-snapshot/1' as const,
    document: Object.freeze({
      ...document,
      layerTree: Object.freeze({
        rootLayerIds: Object.freeze([layer.id]),
        layers: Object.freeze({ [layer.id]: layer }),
      }),
    }),
    committedStrokes: Object.freeze([]),
  });
  return { snapshot, layer, mask };
}

describe('M5B mask feather / blur', () => {
  it('stores feather as a non-destructive mask coverage effect', () => {
    const { snapshot, layer, mask } = fixture();
    const changed = setMaskCoverageEffectRadiusSnapshotV1(
      snapshot,
      layer.id,
      mask.id,
      MASK_FEATHER_EFFECT_ID_V1,
      6.5,
      parseRevision(1),
      new Date(0),
    );
    const changedLayer = changed.document.layerTree.layers[layer.id];
    const changedMask = changedLayer?.masks.find((entry) => entry.id === mask.id);
    expect(changedLayer?.effectStack).toEqual(layer.effectStack);
    expect(changedMask?.transformStack).toEqual(mask.transformStack);
    expect(changedMask?.kind === 'raster-mask' ? changedMask.tiles : []).toEqual(mask.tiles);
    expect(changedMask?.kind).toBe('raster-mask');
    if (changedMask?.kind !== 'raster-mask') throw new Error('expected Raster Mask');
    expect(maskCoverageEffectStateV1(changedMask, MASK_FEATHER_EFFECT_ID_V1)).toMatchObject({
      radiusPx: 6.5,
      enabled: true,
    });
    expect(changedMask.effectStack?.[0]?.parameters).toMatchObject({
      schema: 'illustro.mask-feather/1',
      radiusPx: 6.5,
      mode: 'symmetric-soft-edge',
    });
  });

  it('stores blur independently and updates without duplicating the node', () => {
    const { snapshot, layer, mask } = fixture();
    const blurred = setMaskCoverageEffectRadiusSnapshotV1(
      snapshot,
      layer.id,
      mask.id,
      MASK_BLUR_EFFECT_ID_V1,
      4,
      parseRevision(1),
    );
    const updated = setMaskCoverageEffectRadiusSnapshotV1(
      blurred,
      layer.id,
      mask.id,
      MASK_BLUR_EFFECT_ID_V1,
      9,
      parseRevision(2),
    );
    const updatedMask = updated.document.layerTree.layers[layer.id]?.masks.find(
      (entry) => entry.id === mask.id,
    );
    if (updatedMask?.kind !== 'raster-mask') throw new Error('expected Raster Mask');
    expect(updatedMask.effectStack).toHaveLength(1);
    expect(maskCoverageEffectStateV1(updatedMask, MASK_BLUR_EFFECT_ID_V1)).toMatchObject({
      radiusPx: 9,
      enabled: true,
    });
    expect(updatedMask.effectStack?.[0]?.parameters).toMatchObject({
      schema: 'illustro.mask-blur/1',
      kernel: 'gaussian-separable',
    });
  });

  it('uses radius zero to remove an existing effect and rejects invalid values', () => {
    const { snapshot, layer, mask } = fixture();
    const feathered = setMaskCoverageEffectRadiusSnapshotV1(
      snapshot,
      layer.id,
      mask.id,
      MASK_FEATHER_EFFECT_ID_V1,
      3,
      parseRevision(1),
    );
    const cleared = setMaskCoverageEffectRadiusSnapshotV1(
      feathered,
      layer.id,
      mask.id,
      MASK_FEATHER_EFFECT_ID_V1,
      0,
      parseRevision(2),
    );
    const clearedMask = cleared.document.layerTree.layers[layer.id]?.masks.find(
      (entry) => entry.id === mask.id,
    );
    if (clearedMask?.kind !== 'raster-mask') throw new Error('expected Raster Mask');
    expect(clearedMask.effectStack).toEqual([]);
    expect(() =>
      setMaskCoverageEffectRadiusSnapshotV1(
        snapshot,
        layer.id,
        mask.id,
        MASK_BLUR_EFFECT_ID_V1,
        -1,
        parseRevision(1),
      ),
    ).toThrow(/greater than or equal to zero/);
  });
});
