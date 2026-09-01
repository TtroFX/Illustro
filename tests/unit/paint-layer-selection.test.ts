import { describe, expect, it } from 'vitest';
import { PaintSessionControllerV1 } from '../../src/app/paint-session-controller.js';
import { createRasterLayer } from '../../src/domain/layers.js';

class FakeRendererDocumentPort {
  async configureDocument(): Promise<void> {}
  async restoreBaselineStrokes(): Promise<void> {}
}

async function threeLayerSession(): Promise<{
  readonly session: PaintSessionControllerV1;
  readonly ids: readonly [string, string, string];
}> {
  const session = new PaintSessionControllerV1(new FakeRendererDocumentPort());
  await session.createNewDocument({ width: 64, height: 64 });
  const current = session.projectSnapshot();
  if (current === null) throw new Error('missing project');
  const first = current.document.layerTree.rootLayerIds[0];
  if (first === undefined) throw new Error('missing initial layer');
  const second = createRasterLayer({ name: 'Layer 2' });
  const third = createRasterLayer({ name: 'Layer 3' });
  await session.restoreProjectSnapshot(
    Object.freeze({
      ...current,
      document: Object.freeze({
        ...current.document,
        layerTree: Object.freeze({
          rootLayerIds: Object.freeze([first, second.id, third.id]),
          layers: Object.freeze({
            ...current.document.layerTree.layers,
            [second.id]: second,
            [third.id]: third,
          }),
        }),
      }),
    }),
  );
  return { session, ids: [first, second.id, third.id] as const };
}

describe('M5B multi-layer selection', () => {
  it('keeps one primary active paint target while supporting toggle selection', async () => {
    const { session, ids } = await threeLayerSession();
    session.selectLayer(ids[1] as never, 'toggle');
    expect(session.selectedLayerIds()).toEqual([ids[0], ids[1]]);
    expect(session.activeLayerId()).toBe(ids[1]);
    expect(session.snapshot()).toMatchObject({
      activeLayerId: ids[1],
      selectedLayerIds: [ids[0], ids[1]],
      selectionAnchorLayerId: ids[1],
    });

    session.selectLayer(ids[0] as never, 'toggle');
    expect(session.selectedLayerIds()).toEqual([ids[1]]);
    expect(session.activeLayerId()).toBe(ids[1]);
    session.selectLayer(ids[1] as never, 'toggle');
    expect(session.selectedLayerIds()).toEqual([ids[1]]);
  });

  it('selects a contiguous root-layer range from the anchor and makes the target primary', async () => {
    const { session, ids } = await threeLayerSession();
    session.selectLayer(ids[0] as never, 'replace');
    session.selectLayer(ids[2] as never, 'range');
    expect(session.selectedLayerIds()).toEqual([ids[0], ids[1], ids[2]]);
    expect(session.activeLayerId()).toBe(ids[2]);
    expect(session.snapshot().selectionAnchorLayerId).toBe(ids[0]);
  });

  it('prunes stale selected layers on snapshot restore without persisting selection into the document', async () => {
    const { session, ids } = await threeLayerSession();
    session.selectLayer(ids[1] as never, 'toggle');
    const snapshot = session.projectSnapshot();
    if (snapshot === null) throw new Error('missing snapshot');
    expect('selectedLayerIds' in snapshot).toBe(false);
    const layers = { ...snapshot.document.layerTree.layers };
    delete layers[ids[0]];
    await session.restoreProjectSnapshot(
      Object.freeze({
        ...snapshot,
        document: Object.freeze({
          ...snapshot.document,
          layerTree: Object.freeze({
            rootLayerIds: Object.freeze([ids[1] as never, ids[2] as never]),
            layers: Object.freeze(layers),
          }),
        }),
      }),
    );
    expect(session.selectedLayerIds()).toEqual([ids[1]]);
    expect(session.activeLayerId()).toBe(ids[1]);
  });
});
