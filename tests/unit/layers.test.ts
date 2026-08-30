import { describe, expect, it } from 'vitest';
import {
  createAdjustmentLayer,
  createEffectMask,
  createEffectNode,
  createFillLayer,
  createFolderLayer,
  createGradientLayer,
  createRasterLayer,
  createRasterMask,
  createRasterTileReference,
  createVectorLayer,
  createVectorMask,
  createVectorObject,
} from '../../src/domain/layers.js';
import { createResourceId, isUuid } from '../../src/domain/identity.js';

describe('canonical layer schemas', () => {
  it('creates a common layer base with stable semantic defaults', () => {
    const layer = createRasterLayer({ name: 'Paint' });

    expect(isUuid(layer.id)).toBe(true);
    expect(layer).toMatchObject({
      type: 'raster',
      revision: 0,
      parentId: null,
      visible: true,
      opacity: 1,
      blendMode: 'normal',
      locks: { all: false, pixels: false, alpha: false, position: false },
      roleFlags: { reference: false, draft: false },
      clipping: null,
      boundsHint: null,
      tiles: [],
    });
  });

  it('keeps raster tile identity sparse and document-space addressed', () => {
    const tile = createRasterTileReference({ x: 3, y: 7, payloadRef: 'tile-payload:3:7' });
    const layer = createRasterLayer({ name: 'Paint', tiles: [tile] });

    expect(layer.tiles).toEqual([tile]);
    expect(() => createRasterTileReference({ x: -1, y: 0, payloadRef: 'bad' })).toThrow(RangeError);
  });

  it('stores folder ordering explicitly by child layer IDs', () => {
    const first = createRasterLayer({ name: 'First' });
    const second = createRasterLayer({ name: 'Second' });
    const folder = createFolderLayer({
      name: 'Group',
      childLayerIds: [second.id, first.id],
    });

    expect(folder.childLayerIds).toEqual([second.id, first.id]);
  });

  it('stores editable vector objects with semantic object IDs', () => {
    const object = createVectorObject({
      kind: 'shape',
      geometry: { primitive: 'rectangle', x: 10, y: 20, width: 30, height: 40 },
      style: { strokeWidth: 2 },
    });
    const layer = createVectorLayer({ name: 'Shapes', objects: [object] });

    expect(isUuid(object.id)).toBe(true);
    expect(layer.objects[0]?.geometry).toMatchObject({ primitive: 'rectangle' });
  });

  it('represents adjustment, fill, and gradient layers parametrically', () => {
    const adjustment = createAdjustmentLayer({
      name: 'Levels',
      adjustment: createEffectNode('illustro.effect.levels', { black: 0, white: 1 }),
    });
    const fill = createFillLayer({
      name: 'Paper',
      fill: {
        kind: 'solid',
        color: { space: 'srgb', rgba: [1, 1, 1, 1] },
      },
    });
    const pattern = createFillLayer({
      name: 'Pattern',
      fill: { kind: 'pattern', resourceId: createResourceId(), transform: null },
    });
    const gradient = createGradientLayer({
      name: 'Sky',
      gradient: {
        kind: 'linear',
        geometry: { x0: 0, y0: 0, x1: 1, y1: 1 },
        stops: [
          { position: 0, color: { space: 'display-p3', rgba: [1, 0, 0, 1] } },
          { position: 1, color: { space: 'display-p3', rgba: [0, 0, 1, 1] } },
        ],
      },
    });

    expect(adjustment.adjustment.effectId).toBe('illustro.effect.levels');
    expect(fill.fill.kind).toBe('solid');
    expect(pattern.fill.kind).toBe('pattern');
    expect(gradient.gradient.kind).toBe('linear');
  });

  it('attaches ordered raster, vector, and effect masks with independent IDs', () => {
    const rasterMask = createRasterMask();
    const vectorMask = createVectorMask({ paths: [createVectorObject({ kind: 'path' })] });
    const effect = createEffectNode('illustro.effect.blur');
    const effectMask = createEffectMask({
      effectNodeId: effect.id,
      coverage: { kind: 'raster', defaultCoverage: 1, tiles: [] },
    });
    const layer = createRasterLayer({
      name: 'Masked',
      masks: [rasterMask, vectorMask, effectMask],
    });

    expect(layer.masks.map((mask) => mask.kind)).toEqual([
      'raster-mask',
      'vector-mask',
      'effect-mask',
    ]);
    expect(new Set(layer.masks.map((mask) => mask.id)).size).toBe(3);
    expect(layer.masks.every((mask) => isUuid(mask.id))).toBe(true);
  });

  it('rejects invalid opacity and gradient stop positions', () => {
    expect(() => createRasterLayer({ name: 'Bad', opacity: 1.1 })).toThrow(RangeError);
    expect(() =>
      createGradientLayer({
        name: 'Bad Gradient',
        gradient: {
          kind: 'linear',
          geometry: {},
          stops: [
            { position: 0, color: { space: 'srgb', rgba: [0, 0, 0, 1] } },
            { position: 2, color: { space: 'srgb', rgba: [1, 1, 1, 1] } },
          ],
        },
      }),
    ).toThrow(RangeError);
  });
});
