import { describe, expect, it } from 'vitest';
import { setMaskInvertedSnapshotV1 } from '../../src/app/layer-mask-operations.js';
import type { PaintProjectSnapshotV1 } from '../../src/app/paint-session-controller.js';
import { createDocumentV1 } from '../../src/domain/document.js';
import { parseRevision } from '../../src/domain/identity.js';
import { createRasterLayer, createRasterMask } from '../../src/domain/layers.js';

function fixture(): {
  readonly snapshot: PaintProjectSnapshotV1;
  readonly layer: ReturnType<typeof createRasterLayer>;
  readonly mask: ReturnType<typeof createRasterMask>;
} {
  const mask = createRasterMask({ defaultCoverage: 1 });
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

describe('M5B mask invert', () => {
  it('toggles the canonical mask inversion flag without rewriting coverage tiles', () => {
    const { snapshot, layer, mask } = fixture();
    const next = setMaskInvertedSnapshotV1(
      snapshot,
      layer.id,
      mask.id,
      true,
      parseRevision(1),
      new Date(0),
    );
    const nextLayer = next.document.layerTree.layers[layer.id];
    const nextMask = nextLayer?.masks.find((entry) => entry.id === mask.id);
    expect(nextMask?.inverted).toBe(true);
    expect(nextMask?.revision).toBe(1);
    expect(nextMask?.kind === 'raster-mask' ? nextMask.tiles : []).toEqual([]);
    expect(next.document.revision).toBe(1);
    expect(next.document.modifiedAt).toBe(new Date(0).toISOString());
  });

  it('rejects no-op inversion changes', () => {
    const { snapshot, layer, mask } = fixture();
    expect(() =>
      setMaskInvertedSnapshotV1(snapshot, layer.id, mask.id, false, parseRevision(1)),
    ).toThrow(/no changes/);
  });
});
