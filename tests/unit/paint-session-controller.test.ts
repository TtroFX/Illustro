import { describe, expect, it } from 'vitest';
import { PaintSessionControllerV1 } from '../../src/app/paint-session-controller.js';
import type {
  BaselineRasterLayerDescriptorV1,
  BaselineRasterTilePatchDirectionV1,
  BaselineRasterTilePatchV1,
} from '../../src/gpu/baseline-raster-tile-store.js';
import type {
  PointerInputBatchV1,
  PointerInputEventTypeV1,
  PointerInputSampleV1,
  PointerInputSourceV1,
  PointerSampleOriginV1,
} from '../../src/input/pointer-input.js';

class FakeRendererDocumentPort {
  readonly configured: Array<{
    readonly width: number;
    readonly height: number;
    readonly workingSpace: 'srgb' | 'display-p3';
    readonly precision: 'rgba8-unorm' | 'rgba16-float';
    readonly rasterLayers: readonly BaselineRasterLayerDescriptorV1[];
  }> = [];

  async configureDocument(input: {
    readonly width: number;
    readonly height: number;
    readonly workingSpace: 'srgb' | 'display-p3';
    readonly precision: 'rgba8-unorm' | 'rgba16-float';
    readonly rasterLayers: readonly BaselineRasterLayerDescriptorV1[];
  }): Promise<void> {
    this.configured.push(Object.freeze({ ...input }));
  }

  async restoreBaselineStrokes(): Promise<void> {}
  async applyBaselineTilePatches(
    _patches: readonly BaselineRasterTilePatchV1[],
    _direction: BaselineRasterTilePatchDirectionV1,
  ): Promise<void> {}
}

function sample(
  sequence: number,
  eventType: PointerInputEventTypeV1,
  source: PointerInputSourceV1 = 'pen',
  origin: PointerSampleOriginV1 = 'direct',
  pointerId = 7,
): PointerInputSampleV1 {
  return Object.freeze({
    schema: 'illustro.pointer-sample/1' as const,
    sequence,
    pointerId,
    source,
    eventType,
    origin,
    isPrimary: true,
    timestampMs: 100 + sequence,
    clientX: 10 + sequence,
    clientY: 20 + sequence,
    surfaceX: 30 + sequence,
    surfaceY: 40 + sequence,
    pressure: 0.25 + sequence * 0.01,
    tangentialPressure: 0.1,
    tiltX: 12,
    tiltY: -9,
    twist: 120,
    altitudeAngle: 0.7,
    azimuthAngle: 1.4,
    contactWidth: 2,
    contactHeight: 3,
    buttons: eventType === 'pointerup' ? 0 : 1,
    button: eventType === 'pointerdown' ? 0 : -1,
  });
}

function batch(
  eventType: PointerInputEventTypeV1,
  confirmed: readonly PointerInputSampleV1[],
  predicted: readonly PointerInputSampleV1[] = [],
): PointerInputBatchV1 {
  return Object.freeze({
    schema: 'illustro.pointer-batch/1' as const,
    eventType,
    pointerId: confirmed.at(-1)?.pointerId ?? predicted.at(-1)?.pointerId ?? 7,
    confirmed: Object.freeze([...confirmed]),
    predicted: Object.freeze([...predicted]),
  });
}

describe('M4 paint document vertical slice', () => {
  it('creates one initial canonical raster layer and configures the production renderer port', async () => {
    const renderer = new FakeRendererDocumentPort();
    const session = new PaintSessionControllerV1(renderer);
    const document = await session.createNewDocument({ width: 640, height: 480 });

    expect(renderer.configured).toHaveLength(1);
    expect(renderer.configured[0]).toMatchObject({
      width: 640,
      height: 480,
      workingSpace: 'srgb',
      precision: 'rgba8-unorm',
      rasterLayers: [{ visible: true, opacity: 1 }],
    });
    expect(document.color).toMatchObject({ workingSpace: 'srgb', precision: 'rgba8-unorm' });
    expect(document.layerTree.rootLayerIds).toHaveLength(1);
    const layerId = document.layerTree.rootLayerIds[0];
    expect(layerId).toBeDefined();
    expect(document.layerTree.layers[String(layerId)]).toMatchObject({
      id: layerId,
      type: 'raster',
      name: 'Layer 1',
      tiles: [],
    });
    expect(session.snapshot()).toMatchObject({
      documentId: document.documentId,
      activeLayerId: layerId,
      activeStrokeId: null,
      activeStrokeSampleCount: 0,
    });
  });
});

describe('M4 confirmed pen/mouse stroke session', () => {
  it('starts a pen stroke and accumulates only confirmed samples in document coordinates', async () => {
    const session = new PaintSessionControllerV1(new FakeRendererDocumentPort());
    await session.createNewDocument({ width: 512, height: 512 });

    session.ingestPointerBatch(batch('pointerdown', [sample(1, 'pointerdown')]));
    const predicted = sample(99, 'pointermove', 'pen', 'predicted');
    session.ingestPointerBatch(
      batch(
        'pointermove',
        [
          sample(2, 'pointermove', 'pen', 'coalesced'),
          sample(3, 'pointermove', 'pen', 'coalesced'),
        ],
        [predicted],
      ),
    );

    const active = session.activeStroke();
    expect(active).toMatchObject({ source: 'pen', pointerId: 7 });
    expect(active?.samples.map((entry) => entry.sequence)).toEqual([1, 2, 3]);
    expect(active?.samples.map((entry) => [entry.documentX, entry.documentY])).toEqual([
      [31, 41],
      [32, 42],
      [33, 43],
    ]);
    expect(active?.samples.some((entry) => entry.sequence === predicted.sequence)).toBe(false);
  });

  it('emits only newly generated dabs between input batches while retaining full stroke history', async () => {
    const session = new PaintSessionControllerV1(new FakeRendererDocumentPort());
    await session.createNewDocument({ width: 512, height: 512 });

    session.ingestPointerBatch(batch('pointerdown', [sample(1, 'pointerdown')]));
    expect(session.takeActiveDabDelta().map((entry) => [entry.x, entry.y])).toEqual([[31, 41]]);
    expect(session.takeActiveDabDelta()).toEqual([]);

    session.ingestPointerBatch(batch('pointermove', [sample(5, 'pointermove')]));
    expect(session.takeActiveDabDelta()).toHaveLength(1);
    session.ingestPointerBatch(batch('pointermove', [sample(9, 'pointermove')]));
    expect(session.takeActiveDabDelta()).toHaveLength(1);

    expect(session.snapshot()).toMatchObject({ activeStrokeSampleCount: 3, activeDabCount: 3 });
    expect(session.activeDabs()).toHaveLength(3);
    expect(session.activeStroke()?.samples.map((entry) => entry.sequence)).toEqual([1, 5, 9]);
  });

  it('starts and completes a mouse stroke as one pending stroke unit', async () => {
    const session = new PaintSessionControllerV1(new FakeRendererDocumentPort());
    await session.createNewDocument({ width: 512, height: 512 });

    session.ingestPointerBatch(batch('pointerdown', [sample(1, 'pointerdown', 'mouse')]));
    session.ingestPointerBatch(batch('pointermove', [sample(2, 'pointermove', 'mouse')]));
    session.ingestPointerBatch(batch('pointerup', [sample(3, 'pointerup', 'mouse')]));

    expect(session.activeStroke()).toBeNull();
    expect(session.snapshot()).toMatchObject({ pendingCompletedStrokeCount: 1 });
    const completed = session.takeCompletedStroke();
    expect(completed).toMatchObject({ source: 'mouse', pointerId: 7 });
    expect(completed?.samples.map((entry) => entry.sequence)).toEqual([1, 2, 3]);
    expect(session.snapshot().pendingCompletedStrokeCount).toBe(0);
  });

  it('ignores touch drawing at the M4 pen/mouse boundary and drops cancelled strokes', async () => {
    const session = new PaintSessionControllerV1(new FakeRendererDocumentPort());
    await session.createNewDocument({ width: 512, height: 512 });

    session.ingestPointerBatch(batch('pointerdown', [sample(1, 'pointerdown', 'touch')]));
    expect(session.activeStroke()).toBeNull();

    session.ingestPointerBatch(batch('pointerdown', [sample(2, 'pointerdown', 'pen')]));
    expect(session.activeStroke()).not.toBeNull();
    session.ingestPointerBatch(batch('pointercancel', [sample(3, 'pointercancel', 'pen')]));
    expect(session.activeStroke()).toBeNull();
    expect(session.takeCompletedStroke()).toBeNull();
  });
});
