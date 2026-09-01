import { describe, expect, it } from 'vitest';
import { createDocumentV1 } from '../../src/domain/document.js';
import { parseRevision } from '../../src/domain/identity.js';
import {
  attachRasterMaskSnapshotV1,
  createDefaultLayerV1,
  insertRootLayerSnapshotV1,
} from '../../src/app/layer-creation.js';
import type { PaintProjectSnapshotV1 } from '../../src/app/paint-session-controller.js';

function snapshot(): PaintProjectSnapshotV1 {
  const document = createDocumentV1({ width: 640, height: 480 });
  return Object.freeze({
    schema: 'illustro.paint-project-snapshot/1' as const,
    document,
    committedStrokes: Object.freeze([]),
  });
}

describe('M5B layer creation foundation', () => {
  it('creates every adopted M5B creation-layer shape with canonical defaults', () => {
    const document = snapshot().document;
    expect(createDefaultLayerV1('raster', document).type).toBe('raster');
    expect(createDefaultLayerV1('folder', document).type).toBe('folder');
    expect(createDefaultLayerV1('vector', document).type).toBe('vector');
    expect(createDefaultLayerV1('adjustment', document)).toMatchObject({
      type: 'adjustment',
      adjustment: { effectId: 'core.identity' },
    });
    expect(createDefaultLayerV1('fill', document)).toMatchObject({
      type: 'fill',
      fill: { kind: 'solid' },
    });
    expect(createDefaultLayerV1('gradient', document)).toMatchObject({
      type: 'gradient',
      gradient: { kind: 'linear' },
    });
    expect(createDefaultLayerV1('linked-object', document)).toMatchObject({
      type: 'linkedObject',
      embeddedSnapshot: { schema: 'illustro.document/1' },
      externalSource: null,
    });
  });

  it('inserts new layers at the canonical root stack top and advances revision', () => {
    const before = snapshot();
    const first = createDefaultLayerV1('raster', before.document, 'Layer A');
    const one = insertRootLayerSnapshotV1(before, first, parseRevision(1), new Date(0));
    const second = createDefaultLayerV1('folder', one.document, 'Folder A');
    const two = insertRootLayerSnapshotV1(one, second, parseRevision(2), new Date(1));
    expect(two.document.layerTree.rootLayerIds).toEqual([first.id, second.id]);
    expect(two.document.layerTree.layers[first.id]).toBe(first);
    expect(two.document.layerTree.layers[second.id]).toBe(second);
    expect(two.document.revision).toBe(2);
    expect(two.committedStrokes).toBe(before.committedStrokes);
  });

  it('attaches an enabled white raster mask without mutating the source snapshot', () => {
    const before = snapshot();
    const layer = createDefaultLayerV1('raster', before.document, 'Paint');
    const inserted = insertRootLayerSnapshotV1(before, layer, parseRevision(1), new Date(0));
    const masked = attachRasterMaskSnapshotV1(inserted, layer.id, parseRevision(2), new Date(1));
    const sourceLayer = inserted.document.layerTree.layers[layer.id];
    const maskedLayer = masked.document.layerTree.layers[layer.id];
    expect(sourceLayer?.masks).toHaveLength(0);
    expect(maskedLayer?.masks).toHaveLength(1);
    expect(maskedLayer?.masks[0]).toMatchObject({
      kind: 'raster-mask',
      enabled: true,
      inverted: false,
      defaultCoverage: 1,
    });
    expect(maskedLayer?.revision).toBe(2);
  });
});
