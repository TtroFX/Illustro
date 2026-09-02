import { describe, expect, it } from 'vitest';
import { createDocumentV1 } from '../../src/domain/document.js';
import { parseRevision } from '../../src/domain/identity.js';
import { createRasterLayer } from '../../src/domain/layers.js';
import { setLayerBlendModeSnapshotV1 } from '../../src/app/layer-operations.js';
import type { PaintProjectSnapshotV1 } from '../../src/app/paint-session-controller.js';

function snapshot(): { readonly value: PaintProjectSnapshotV1; readonly layerId: string } {
  const document = createDocumentV1({
    name: 'blend-test',
    width: 32,
    height: 32,
    background: { kind: 'transparent' },
  });
  const layer = createRasterLayer({ name: 'Layer 1' });
  return {
    layerId: layer.id,
    value: Object.freeze({
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
  };
}

describe('M5C layer blend-mode mutation', () => {
  it('changes blend mode as one immutable document mutation', () => {
    const fixture = snapshot();
    const updated = setLayerBlendModeSnapshotV1(
      fixture.value,
      fixture.layerId as never,
      'multiply',
      parseRevision(1),
      new Date('2026-09-02T00:00:00.000Z'),
    );
    expect(fixture.value.document.layerTree.layers[fixture.layerId]?.blendMode).toBe('normal');
    expect(updated.document.layerTree.layers[fixture.layerId]?.blendMode).toBe('multiply');
    expect(updated.document.revision).toBe(1);
  });

  it('keeps folder pass-through on its dedicated command path', () => {
    const fixture = snapshot();
    expect(() =>
      setLayerBlendModeSnapshotV1(
        fixture.value,
        fixture.layerId as never,
        'pass-through',
        parseRevision(1),
      ),
    ).toThrow(/Pass Through/);
  });
});
