import { describe, expect, it } from 'vitest';
import { paintRasterLayerDescriptorsV1 } from '../../src/app/paint-session-controller.js';
import { createDocumentV1 } from '../../src/domain/document.js';
import { createRasterLayer } from '../../src/domain/layers.js';
import { BaselineRasterTileStoreV1 } from '../../src/gpu/baseline-raster-tile-store.js';

function fixture() {
  const draft = createRasterLayer({ name: 'Sketch', roleFlags: { draft: true } });
  const document = createDocumentV1({ width: 32, height: 32 });
  return {
    draft,
    document: Object.freeze({
      ...document,
      layerTree: Object.freeze({
        rootLayerIds: Object.freeze([draft.id]),
        layers: Object.freeze({ [draft.id]: draft }),
      }),
    }),
  };
}

describe('M5B Draft final-output exclusion', () => {
  it('propagates Draft into renderer descriptors', () => {
    const { document, draft } = fixture();
    expect(paintRasterLayerDescriptorsV1(document)).toEqual([
      expect.objectContaining({ layerId: draft.id, draft: true }),
    ]);
  });

  it('keeps Draft visible in workspace but excludes it from final output', () => {
    const { document, draft } = fixture();
    const store = new BaselineRasterTileStoreV1(
      32,
      32,
      'rgba8-unorm',
      paintRasterLayerDescriptorsV1(document),
    );
    store.applyDabs(draft.id, 'draft-stroke', [
      Object.freeze({
        schema: 'illustro.baseline-brush-dab/1' as const,
        x: 16,
        y: 16,
        radius: 8,
        radiusX: 8,
        radiusY: 8,
        opacity: 1,
      }),
    ]);
    store.finalize('draft-stroke');
    const workspace = store.compositeTiles();
    const finalOutput = store.compositeTiles(undefined, { includeDraft: false });
    expect(workspace[0]?.bytes.some((value, index) => index % 4 === 3 && value > 0)).toBe(true);
    expect(finalOutput[0]?.bytes.every((value) => value === 0)).toBe(true);
  });
});
