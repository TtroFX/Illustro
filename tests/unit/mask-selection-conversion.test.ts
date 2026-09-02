import { describe, expect, it } from 'vitest';
import {
  SelectionCoverageControllerV1,
  attachRasterMaskFromSelectionSnapshotV1,
} from '../../src/app/selection-coverage-controller.js';
import type { PaintProjectSnapshotV1 } from '../../src/app/paint-session-controller.js';
import { createDocumentV1 } from '../../src/domain/document.js';
import { parseRevision } from '../../src/domain/identity.js';
import {
  createEffectNode,
  createRasterLayer,
  createRasterMask,
  createRasterTileReference,
  createTransformNode,
} from '../../src/domain/layers.js';

function fixture() {
  const tile = createRasterTileReference({ x: 2, y: 3, payloadRef: 'mask-coverage' });
  const mask = Object.freeze({
    ...createRasterMask({
      defaultCoverage: 0,
      tiles: [tile],
      inverted: true,
      effectStack: [createEffectNode('mask.feather', { radiusPx: 5 })],
    }),
    transformStack: Object.freeze([createTransformNode('affine', { matrix: [1, 0, 0, 1, 4, 8] })]),
  });
  const sourceLayer = createRasterLayer({ name: 'Source', masks: [mask] });
  const targetLayer = createRasterLayer({ name: 'Target' });
  const document = createDocumentV1({ width: 512, height: 512 });
  const snapshot: PaintProjectSnapshotV1 = Object.freeze({
    schema: 'illustro.paint-project-snapshot/1' as const,
    document: Object.freeze({
      ...document,
      layerTree: Object.freeze({
        rootLayerIds: Object.freeze([sourceLayer.id, targetLayer.id]),
        layers: Object.freeze({
          [sourceLayer.id]: sourceLayer,
          [targetLayer.id]: targetLayer,
        }),
      }),
    }),
    committedStrokes: Object.freeze([]),
  });
  return { snapshot, mask, sourceLayer, targetLayer };
}

describe('M5B Mask Selection conversion', () => {
  it('converts Mask to transient Selection coverage without copying raster payloads', () => {
    const { mask } = fixture();
    const controller = new SelectionCoverageControllerV1();
    const selection = controller.replaceFromRasterMask(mask).coverage;
    expect(selection).not.toBeNull();
    expect(selection?.defaultCoverage).toBe(0);
    expect(selection?.inverted).toBe(true);
    expect(selection?.tiles).toEqual(mask.tiles);
    expect(selection?.tiles[0]?.payloadRef).toBe('mask-coverage');
    expect(selection?.transformStack).toEqual(mask.transformStack);
    expect(selection?.effectStack).toEqual(mask.effectStack);
  });

  it('converts Selection coverage back to a linked Raster Mask while preserving semantics', () => {
    const { snapshot, mask, targetLayer } = fixture();
    const controller = new SelectionCoverageControllerV1();
    const selection = controller.replaceFromRasterMask(mask).coverage;
    if (selection === null) throw new Error('expected selection coverage');
    const changed = attachRasterMaskFromSelectionSnapshotV1(
      snapshot,
      targetLayer.id,
      selection,
      parseRevision(3),
      new Date(0),
    );
    const attached = changed.document.layerTree.layers[targetLayer.id]?.masks[0];
    expect(attached?.kind).toBe('raster-mask');
    if (attached?.kind !== 'raster-mask') throw new Error('expected Raster Mask');
    expect(attached.defaultCoverage).toBe(mask.defaultCoverage);
    expect(attached.tiles).toEqual(mask.tiles);
    expect(attached.inverted).toBe(mask.inverted);
    expect(attached.transformStack).toEqual(mask.transformStack);
    expect(attached.effectStack).toEqual(mask.effectStack);
    expect(attached.linkedToLayer).toBe(true);
    expect(changed.document.revision).toBe(3);
  });

  it('clear removes only transient Selection state', () => {
    const { mask } = fixture();
    const controller = new SelectionCoverageControllerV1();
    controller.replaceFromRasterMask(mask);
    expect(controller.clear().coverage).toBeNull();
  });
});
