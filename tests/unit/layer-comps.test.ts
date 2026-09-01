import { describe, expect, it } from 'vitest';
import {
  applyLayerCompSnapshotV1,
  findLayerCompV1,
  layerCompHasChangesV1,
  listLayerCompsV1,
  normalizeLayerCompNameV1,
  saveLayerCompSnapshotV1,
} from '../../src/app/layer-comps.js';
import type { PaintProjectSnapshotV1 } from '../../src/app/paint-session-controller.js';
import { createDocumentV1 } from '../../src/domain/document.js';
import { parseRevision } from '../../src/domain/identity.js';
import { createRasterLayer } from '../../src/domain/layers.js';

function fixture(): {
  readonly snapshot: PaintProjectSnapshotV1;
  readonly firstId: ReturnType<typeof createRasterLayer>['id'];
  readonly secondId: ReturnType<typeof createRasterLayer>['id'];
} {
  const firstBase = createRasterLayer({ name: 'Ink' });
  const secondBase = createRasterLayer({ name: 'Color' });
  const first = Object.freeze({
    ...firstBase,
    visible: true,
    opacity: 0.75,
    blendMode: 'multiply' as const,
  });
  const second = Object.freeze({
    ...secondBase,
    visible: false,
    opacity: 0.4,
    blendMode: 'screen' as const,
  });
  const document = createDocumentV1({ width: 320, height: 240 });
  const snapshot: PaintProjectSnapshotV1 = Object.freeze({
    schema: 'illustro.paint-project-snapshot/1' as const,
    document: Object.freeze({
      ...document,
      extensions: Object.freeze({ 'example.keep': Object.freeze({ value: 7 }) }),
      layerTree: Object.freeze({
        rootLayerIds: Object.freeze([first.id, second.id]),
        layers: Object.freeze({ [first.id]: first, [second.id]: second }),
      }),
    }),
    committedStrokes: Object.freeze([]),
  });
  return { snapshot, firstId: first.id, secondId: second.id };
}

describe('M5B Layer Comps', () => {
  it('creates and updates a named canonical presentation-state snapshot without dropping other extensions', () => {
    const { snapshot, firstId, secondId } = fixture();
    const saved = saveLayerCompSnapshotV1(snapshot, '  Hero View  ', parseRevision(1), new Date(0));
    const comps = listLayerCompsV1(saved);
    expect(comps).toHaveLength(1);
    expect(comps[0]?.name).toBe('Hero View');
    expect(comps[0]?.updatedAt).toBe(new Date(0).toISOString());
    expect(comps[0]?.layerStates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          layerId: firstId,
          visible: true,
          opacity: 0.75,
          blendMode: 'multiply',
        }),
        expect.objectContaining({
          layerId: secondId,
          visible: false,
          opacity: 0.4,
          blendMode: 'screen',
        }),
      ]),
    );
    expect(saved.document.extensions['example.keep']).toEqual({ value: 7 });
    expect(saved.document.revision).toBe(1);

    const originalId = comps[0]?.compId;
    const updated = saveLayerCompSnapshotV1(saved, 'Hero View', parseRevision(2), new Date(1_000));
    expect(listLayerCompsV1(updated)).toHaveLength(1);
    expect(listLayerCompsV1(updated)[0]?.compId).toBe(originalId);
    expect(listLayerCompsV1(updated)[0]?.updatedAt).toBe(new Date(1_000).toISOString());
  });

  it('switches only extant saved layers and leaves later layers untouched', () => {
    const { snapshot, firstId, secondId } = fixture();
    const saved = saveLayerCompSnapshotV1(snapshot, 'A', parseRevision(1), new Date(0));
    const compId = listLayerCompsV1(saved)[0]?.compId;
    if (compId === undefined) throw new Error('fixture Layer Comp missing');
    const newLayer = createRasterLayer({ name: 'Later' });
    const first = saved.document.layerTree.layers[firstId];
    if (first === undefined) throw new Error('fixture layer missing');
    const mutated: PaintProjectSnapshotV1 = Object.freeze({
      ...saved,
      document: Object.freeze({
        ...saved.document,
        revision: parseRevision(2),
        layerTree: Object.freeze({
          rootLayerIds: Object.freeze([firstId, newLayer.id]),
          layers: Object.freeze({
            [firstId]: Object.freeze({
              ...first,
              revision: parseRevision(2),
              visible: false,
              opacity: 1,
              blendMode: 'normal' as const,
            }),
            [newLayer.id]: newLayer,
          }),
        }),
      }),
    });
    expect(mutated.document.layerTree.layers[secondId]).toBeUndefined();
    expect(layerCompHasChangesV1(mutated, compId)).toBe(true);

    const applied = applyLayerCompSnapshotV1(mutated, compId, parseRevision(3), new Date(2_000));
    expect(applied.document.layerTree.layers[firstId]).toMatchObject({
      visible: true,
      opacity: 0.75,
      blendMode: 'multiply',
      revision: 3,
    });
    expect(applied.document.layerTree.layers[newLayer.id]).toEqual(newLayer);
    expect(applied.document.layerTree.layers[secondId]).toBeUndefined();
    expect(layerCompHasChangesV1(applied, compId)).toBe(false);
    expect(findLayerCompV1(applied, compId)?.name).toBe('A');
    expect(applied.document.revision).toBe(3);
    expect(applied.document.modifiedAt).toBe(new Date(2_000).toISOString());
  });

  it('rejects unusable names and no-op switching', () => {
    const { snapshot } = fixture();
    expect(() => normalizeLayerCompNameV1('   ')).toThrow(/must not be empty/);
    expect(() => normalizeLayerCompNameV1('x'.repeat(121))).toThrow(/at most 120/);
    const saved = saveLayerCompSnapshotV1(snapshot, 'Same', parseRevision(1));
    const compId = listLayerCompsV1(saved)[0]?.compId;
    if (compId === undefined) throw new Error('fixture Layer Comp missing');
    expect(layerCompHasChangesV1(saved, compId)).toBe(false);
    expect(() => applyLayerCompSnapshotV1(saved, compId, parseRevision(2))).toThrow(/no changes/);
  });
});
