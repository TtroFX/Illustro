import { describe, expect, it } from 'vitest';
import {
  applyIndependentMaskAffineTransformSnapshotV1,
  applyIndependentMaskMoveSnapshotV1,
  independentMaskTransformEligibilityV1,
} from '../../src/app/layer-mask-transform.js';
import { setMaskLinkedToLayerSnapshotV1 } from '../../src/app/layer-mask-operations.js';
import type { PaintProjectSnapshotV1 } from '../../src/app/paint-session-controller.js';
import { createDocumentV1 } from '../../src/domain/document.js';
import { parseRevision } from '../../src/domain/identity.js';
import {
  createRasterLayer,
  createRasterMask,
  createRasterTileReference,
} from '../../src/domain/layers.js';

function fixture(): {
  readonly snapshot: PaintProjectSnapshotV1;
  readonly layer: ReturnType<typeof createRasterLayer>;
  readonly mask: ReturnType<typeof createRasterMask>;
} {
  const tile = createRasterTileReference({ x: 0, y: 0, payloadRef: 'mask-tile-0' });
  const mask = createRasterMask({ defaultCoverage: 1, tiles: [tile] });
  const layer = createRasterLayer({ name: 'Masked', masks: [mask] });
  const document = createDocumentV1({ width: 64, height: 64 });
  return {
    snapshot: Object.freeze({
      schema: 'illustro.paint-project-snapshot/1' as const,
      document: Object.freeze({
        ...document,
        layerTree: Object.freeze({
          rootLayerIds: Object.freeze([layer.id]),
          layers: Object.freeze({ [layer.id]: layer }),
        }),
      }),
      committedStrokes: Object.freeze([]),
    }),
    layer,
    mask,
  };
}

function unlink(
  snapshot: PaintProjectSnapshotV1,
  layer: ReturnType<typeof createRasterLayer>,
  mask: ReturnType<typeof createRasterMask>,
): PaintProjectSnapshotV1 {
  return setMaskLinkedToLayerSnapshotV1(
    snapshot,
    layer.id,
    mask.id,
    false,
    parseRevision(1),
    new Date(0),
  );
}

describe('M5B independent mask move/transform', () => {
  it('requires the Raster Mask to be unlinked from its layer', () => {
    const { snapshot, layer, mask } = fixture();
    const linked = independentMaskTransformEligibilityV1(snapshot, layer.id, mask.id);
    expect(linked.eligible).toBe(false);
    expect(linked.reason).toMatch(/unlink/i);

    const unlinked = unlink(snapshot, layer, mask);
    expect(independentMaskTransformEligibilityV1(unlinked, layer.id, mask.id).eligible).toBe(true);
  });

  it('moves only the mask by appending a non-destructive affine transform node', () => {
    const { snapshot, layer, mask } = fixture();
    const unlinked = unlink(snapshot, layer, mask);
    const moved = applyIndependentMaskMoveSnapshotV1(
      unlinked,
      layer.id,
      mask.id,
      12,
      -7,
      parseRevision(2),
      new Date(1),
    );
    const movedLayer = moved.document.layerTree.layers[layer.id];
    const movedMask = movedLayer?.masks.find((entry) => entry.id === mask.id);
    expect(movedLayer?.transformStack).toEqual(layer.transformStack);
    expect(movedMask?.transformStack).toHaveLength(1);
    expect(movedMask?.transformStack[0]?.parameters).toMatchObject({
      schema: 'illustro.mask-affine-transform/1',
      translateX: 12,
      translateY: -7,
      scaleX: 1,
      scaleY: 1,
      rotationDeg: 0,
      matrix: [1, 0, 0, 1, 12, -7],
    });
    expect(movedMask?.kind === 'raster-mask' ? movedMask.tiles : []).toEqual(mask.tiles);
    expect(moved.document.revision).toBe(2);
  });

  it('applies scale/rotation/pivot to the mask transform stack without rewriting coverage tiles', () => {
    const { snapshot, layer, mask } = fixture();
    const unlinked = unlink(snapshot, layer, mask);
    const transformed = applyIndependentMaskAffineTransformSnapshotV1(
      unlinked,
      layer.id,
      mask.id,
      {
        translateX: 3,
        translateY: 4,
        scaleX: 2,
        scaleY: 0.5,
        rotationDeg: 90,
        pivotX: 8,
        pivotY: 6,
      },
      parseRevision(2),
      new Date(1),
    );
    const transformedMask = transformed.document.layerTree.layers[layer.id]?.masks.find(
      (entry) => entry.id === mask.id,
    );
    expect(transformedMask?.transformStack).toHaveLength(1);
    expect(transformedMask?.transformStack[0]?.parameters).toMatchObject({
      schema: 'illustro.mask-affine-transform/1',
      scaleX: 2,
      scaleY: 0.5,
      rotationDeg: 90,
      pivotX: 8,
      pivotY: 6,
    });
    expect(transformedMask?.kind === 'raster-mask' ? transformedMask.tiles : []).toEqual(
      mask.tiles,
    );
  });

  it('rejects no-op and invalid scale transforms', () => {
    const { snapshot, layer, mask } = fixture();
    const unlinked = unlink(snapshot, layer, mask);
    expect(() =>
      applyIndependentMaskMoveSnapshotV1(unlinked, layer.id, mask.id, 0, 0, parseRevision(2)),
    ).toThrow(/no changes/);
    expect(() =>
      applyIndependentMaskAffineTransformSnapshotV1(
        unlinked,
        layer.id,
        mask.id,
        {
          translateX: 1,
          translateY: 0,
          scaleX: 0,
          scaleY: 1,
          rotationDeg: 0,
          pivotX: 0,
          pivotY: 0,
        },
        parseRevision(2),
      ),
    ).toThrow(/greater than zero/);
  });
});
