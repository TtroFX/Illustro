import { createDocumentV1, type DocumentV1 } from '../domain/document.js';
import type { LayerId } from '../domain/identity.js';
import { createRasterLayer, type RasterLayerV1 } from '../domain/layers.js';
import type {
  PointerInputBatchV1,
  PointerInputSampleV1,
  PointerInputSourceV1,
} from '../input/pointer-input.js';

export interface PaintRendererDocumentPortV1 {
  configureDocument(input: { readonly width: number; readonly height: number }): Promise<unknown>;
}

export interface PaintDocumentPointV1 {
  readonly x: number;
  readonly y: number;
}

export type PaintPointerToDocumentMapperV1 = (
  sample: PointerInputSampleV1,
  document: DocumentV1,
) => PaintDocumentPointV1;

export interface PaintStrokeSampleV1 {
  readonly schema: 'illustro.paint-stroke-sample/1';
  readonly sequence: number;
  readonly timestampMs: number;
  readonly documentX: number;
  readonly documentY: number;
  readonly pressure: number;
  readonly tangentialPressure: number;
  readonly tiltX: number;
  readonly tiltY: number;
  readonly twist: number;
  readonly altitudeAngle: number | null;
  readonly azimuthAngle: number | null;
}

export type PaintStrokeSourceV1 = Extract<PointerInputSourceV1, 'pen' | 'mouse'>;

export interface PaintStrokeV1 {
  readonly schema: 'illustro.paint-stroke/1';
  readonly strokeId: string;
  readonly pointerId: number;
  readonly source: PaintStrokeSourceV1;
  readonly layerId: LayerId;
  readonly samples: readonly PaintStrokeSampleV1[];
}

export interface PaintSessionSnapshotV1 {
  readonly schema: 'illustro.paint-session/1';
  readonly documentId: string | null;
  readonly activeLayerId: LayerId | null;
  readonly activeStrokeId: string | null;
  readonly activeStrokeSampleCount: number;
  readonly pendingCompletedStrokeCount: number;
}

export type PaintDocumentCreationInputV1 = Parameters<typeof createDocumentV1>[0];

function identityPointerToDocument(
  sample: PointerInputSampleV1,
  _document: DocumentV1,
): PaintDocumentPointV1 {
  return Object.freeze({ x: sample.surfaceX, y: sample.surfaceY });
}

function strokeSource(sample: PointerInputSampleV1): PaintStrokeSourceV1 | null {
  return sample.source === 'pen' || sample.source === 'mouse' ? sample.source : null;
}

function toStrokeSample(
  sample: PointerInputSampleV1,
  document: DocumentV1,
  mapper: PaintPointerToDocumentMapperV1,
): PaintStrokeSampleV1 {
  const point = mapper(sample, document);
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
    throw new RangeError('paint document coordinates must be finite');
  }
  return Object.freeze({
    schema: 'illustro.paint-stroke-sample/1' as const,
    sequence: sample.sequence,
    timestampMs: sample.timestampMs,
    documentX: point.x,
    documentY: point.y,
    pressure: sample.pressure,
    tangentialPressure: sample.tangentialPressure,
    tiltX: sample.tiltX,
    tiltY: sample.tiltY,
    twist: sample.twist,
    altitudeAngle: sample.altitudeAngle,
    azimuthAngle: sample.azimuthAngle,
  });
}

function withInitialRasterLayer(document: DocumentV1): {
  readonly document: DocumentV1;
  readonly layer: RasterLayerV1;
} {
  const layer = createRasterLayer({ name: 'Layer 1' });
  const nextDocument = Object.freeze({
    ...document,
    layerTree: Object.freeze({
      rootLayerIds: Object.freeze([layer.id]),
      layers: Object.freeze({ [layer.id]: layer }),
    }),
  });
  return Object.freeze({ document: nextDocument, layer });
}

export class PaintSessionControllerV1 {
  readonly #renderer: PaintRendererDocumentPortV1;
  readonly #mapPointerToDocument: PaintPointerToDocumentMapperV1;
  #document: DocumentV1 | null = null;
  #activeLayerId: LayerId | null = null;
  #activeStroke: PaintStrokeV1 | null = null;
  readonly #completedStrokes: PaintStrokeV1[] = [];
  #disposed = false;

  constructor(
    renderer: PaintRendererDocumentPortV1,
    options: { readonly mapPointerToDocument?: PaintPointerToDocumentMapperV1 } = {},
  ) {
    this.#renderer = renderer;
    this.#mapPointerToDocument = options.mapPointerToDocument ?? identityPointerToDocument;
  }

  snapshot(): PaintSessionSnapshotV1 {
    return Object.freeze({
      schema: 'illustro.paint-session/1' as const,
      documentId: this.#document?.documentId ?? null,
      activeLayerId: this.#activeLayerId,
      activeStrokeId: this.#activeStroke?.strokeId ?? null,
      activeStrokeSampleCount: this.#activeStroke?.samples.length ?? 0,
      pendingCompletedStrokeCount: this.#completedStrokes.length,
    });
  }

  currentDocument(): DocumentV1 | null {
    return this.#document;
  }

  activeStroke(): PaintStrokeV1 | null {
    return this.#activeStroke;
  }

  takeCompletedStroke(): PaintStrokeV1 | null {
    return this.#completedStrokes.shift() ?? null;
  }

  async createNewDocument(input: PaintDocumentCreationInputV1): Promise<DocumentV1> {
    if (this.#disposed) throw new Error('paint session is disposed');
    const initial = withInitialRasterLayer(createDocumentV1(input));
    await this.#renderer.configureDocument({
      width: initial.document.canvas.width,
      height: initial.document.canvas.height,
    });
    this.#document = initial.document;
    this.#activeLayerId = initial.layer.id;
    this.#activeStroke = null;
    this.#completedStrokes.length = 0;
    return initial.document;
  }

  ingestPointerBatch(batch: PointerInputBatchV1): PaintSessionSnapshotV1 {
    if (this.#disposed || this.#document === null || this.#activeLayerId === null) {
      return this.snapshot();
    }
    const latest = batch.confirmed.at(-1);
    if (latest === undefined) return this.snapshot();
    const source = strokeSource(latest);
    if (source === null) return this.snapshot();

    if (batch.eventType === 'pointerdown') {
      this.#startStroke(batch, source);
      return this.snapshot();
    }

    const active = this.#activeStroke;
    if (
      active === null ||
      active.pointerId !== batch.pointerId ||
      active.source !== source ||
      active.layerId !== this.#activeLayerId
    ) {
      return this.snapshot();
    }

    if (batch.eventType === 'pointercancel') {
      this.#activeStroke = null;
      return this.snapshot();
    }

    if (
      batch.eventType === 'pointermove' ||
      batch.eventType === 'pointerrawupdate' ||
      batch.eventType === 'pointerup'
    ) {
      this.#appendConfirmedSamples(batch);
    }

    if (batch.eventType === 'pointerup') {
      const completed = this.#activeStroke;
      this.#activeStroke = null;
      if (completed !== null) this.#completedStrokes.push(completed);
    }
    return this.snapshot();
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#document = null;
    this.#activeLayerId = null;
    this.#activeStroke = null;
    this.#completedStrokes.length = 0;
  }

  #startStroke(batch: PointerInputBatchV1, source: PaintStrokeSourceV1): void {
    const document = this.#document;
    const layerId = this.#activeLayerId;
    if (document === null || layerId === null) return;
    const samples = batch.confirmed
      .filter((sample) => sample.pointerId === batch.pointerId && sample.source === source)
      .map((sample) => toStrokeSample(sample, document, this.#mapPointerToDocument));
    if (samples.length === 0) return;
    this.#activeStroke = Object.freeze({
      schema: 'illustro.paint-stroke/1' as const,
      strokeId: crypto.randomUUID(),
      pointerId: batch.pointerId,
      source,
      layerId,
      samples: Object.freeze(samples),
    });
  }

  #appendConfirmedSamples(batch: PointerInputBatchV1): void {
    const active = this.#activeStroke;
    const document = this.#document;
    if (active === null || document === null) return;
    const additions = batch.confirmed
      .filter(
        (sample) =>
          sample.pointerId === active.pointerId && sample.source === active.source,
      )
      .map((sample) => toStrokeSample(sample, document, this.#mapPointerToDocument));
    if (additions.length === 0) return;
    this.#activeStroke = Object.freeze({
      ...active,
      samples: Object.freeze([...active.samples, ...additions]),
    });
  }
}
