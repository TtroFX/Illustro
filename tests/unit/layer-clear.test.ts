import { describe, expect, it } from 'vitest';
import { clearLayerSnapshotV1 } from '../../src/app/layer-operations.js';
import type { PaintProjectSnapshotV1 } from '../../src/app/paint-session-controller.js';
import { createDocumentV1 } from '../../src/domain/document.js';
import { parseRevision } from '../../src/domain/identity.js';
import {
  createRasterLayer,
  createRasterMask,
  createRasterTileReference,
  createVectorLayer,
  createVectorObject,
  type LayerBaseV1,
} from '../../src/domain/layers.js';

function snapshotWith(
  layer: LayerBaseV1,
  committedStrokes: PaintProjectSnapshotV1['committedStrokes'] = Object.freeze([]),
): PaintProjectSnapshotV1 {
  const document = createDocumentV1({ width: 128, height: 96 });
  return Object.freeze({
    schema: 'illustro.paint-project-snapshot/1' as const,
    document: Object.freeze({
      ...document,
      layerTree: Object.freeze({
        rootLayerIds: Object.freeze([layer.id]),
        layers: Object.freeze({ [layer.id]: layer }),
      }),
    }),
    committedStrokes,
  });
}

describe('M5B layer clear', () => {
  it('clears raster tile references and canonical baseline paint while retaining layer attachments', () => {
    const layer = createRasterLayer({
      name: 'Paint',
      masks: [createRasterMask()],
      tiles: [createRasterTileReference({ x: 0, y: 0, payloadRef: 'sha256:fixture' })],
    });
    const before = snapshotWith(
      layer,
      Object.freeze([
        Object.freeze({
          stroke: Object.freeze({
            schema: 'illustro.paint-stroke/1' as const,
            strokeId: '11111111-1111-4111-8111-111111111111',
            pointerId: 1,
            source: 'pen' as const,
            layerId: layer.id,
            samples: Object.freeze([]),
          }),
          dabs: Object.freeze([]),
        }),
      ]),
    );
    const after = clearLayerSnapshotV1(before, layer.id, parseRevision(1), new Date(0));
    const cleared = after.document.layerTree.layers[layer.id];
    expect(cleared?.type).toBe('raster');
    expect(cleared?.masks).toHaveLength(1);
    expect(cleared?.revision).toBe(1);
    expect((cleared as typeof layer).tiles).toEqual([]);
    expect(after.committedStrokes).toEqual([]);
    expect(before.committedStrokes).toHaveLength(1);
    expect(layer.tiles).toHaveLength(1);
  });

  it('clears vector objects without changing the original snapshot', () => {
    const layer = createVectorLayer({
      name: 'Vector',
      objects: [createVectorObject({ kind: 'shape', geometry: { shape: 'rect' } })],
    });
    const before = snapshotWith(layer);
    const after = clearLayerSnapshotV1(before, layer.id, parseRevision(1), new Date(0));
    expect((after.document.layerTree.layers[layer.id] as typeof layer).objects).toEqual([]);
    expect(layer.objects).toHaveLength(1);
  });

  it('rejects pixel-locked and already-empty layers', () => {
    const locked = createRasterLayer({ name: 'Locked', locks: { pixels: true } });
    expect(() => clearLayerSnapshotV1(snapshotWith(locked), locked.id, parseRevision(1))).toThrow(
      /pixel lock/,
    );
    const empty = createRasterLayer({ name: 'Empty' });
    expect(() => clearLayerSnapshotV1(snapshotWith(empty), empty.id, parseRevision(1))).toThrow(
      /no changes/,
    );
  });
});
