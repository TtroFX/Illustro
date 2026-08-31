import {
  createCanvasSpec,
  createDocumentV1,
  type CanvasBackgroundSpec,
  type DocumentV1,
} from '../domain/document.js';
import {
  isUuid,
  parseDocumentId,
  parseLayerId,
  parseProjectId,
  parseRevision,
  type LayerId,
  type Revision,
} from '../domain/identity.js';
import { createRasterLayer, type RasterLayerV1 } from '../domain/layers.js';
import { BaselineBrushDabBuilderV1, type BaselineBrushDabV1 } from '../gpu/baseline-brush.js';
import type {
  PointerInputBatchV1,
  PointerInputSampleV1,
  PointerInputSourceV1,
} from '../input/pointer-input.js';

export interface PaintRendererDocumentPortV1 {
  configureDocument(input: {
    readonly width: number;
    readonly height: number;
    readonly workingSpace: DocumentV1['color']['workingSpace'];
    readonly precision: DocumentV1['color']['precision'];
  }): Promise<unknown>;
  restoreBaselineStrokes(
    strokes: readonly { readonly strokeId: string; readonly dabs: readonly BaselineBrushDabV1[] }[],
  ): Promise<unknown>;
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

export interface CompletedPaintStrokeV1 {
  readonly stroke: PaintStrokeV1;
  readonly dabs: readonly BaselineBrushDabV1[];
}

export interface PaintProjectSnapshotV1 {
  readonly schema: 'illustro.paint-project-snapshot/1';
  readonly document: DocumentV1;
  readonly committedStrokes: readonly CompletedPaintStrokeV1[];
}

export interface PaintStrokeCommitV1 {
  readonly before: PaintProjectSnapshotV1;
  readonly after: PaintProjectSnapshotV1;
  readonly committed: CompletedPaintStrokeV1;
}

export interface PaintDocumentSettingsUpdateV1 {
  readonly ppi?: number;
  readonly background?: CanvasBackgroundSpec;
}

export interface PaintDocumentSettingsCommitV1 {
  readonly before: PaintProjectSnapshotV1;
  readonly after: PaintProjectSnapshotV1;
}

export interface PaintSessionSnapshotV1 {
  readonly schema: 'illustro.paint-session/1';
  readonly documentId: string | null;
  readonly activeLayerId: LayerId | null;
  readonly activeStrokeId: string | null;
  readonly activeStrokeSampleCount: number;
  readonly activeDabCount: number;
  readonly pendingCompletedStrokeCount: number;
  readonly committedStrokeCount: number;
}

export type PaintDocumentCreationInputV1 = Parameters<typeof createDocumentV1>[0];

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function finiteNumber(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`${label} must be finite`);
  }
  return value;
}

function parseStoredStrokeSample(value: unknown): PaintStrokeSampleV1 {
  if (!isRecord(value) || value.schema !== 'illustro.paint-stroke-sample/1') {
    throw new TypeError('invalid paint stroke sample schema');
  }
  if (!Number.isSafeInteger(value.sequence) || (value.sequence as number) < 0) {
    throw new TypeError('invalid paint stroke sample sequence');
  }
  const nullableAngle = (angle: unknown, label: string): number | null =>
    angle === null ? null : finiteNumber(angle, label);
  return Object.freeze({
    schema: 'illustro.paint-stroke-sample/1' as const,
    sequence: value.sequence as number,
    timestampMs: finiteNumber(value.timestampMs, 'stroke timestamp'),
    documentX: finiteNumber(value.documentX, 'stroke x'),
    documentY: finiteNumber(value.documentY, 'stroke y'),
    pressure: finiteNumber(value.pressure, 'stroke pressure'),
    tangentialPressure: finiteNumber(value.tangentialPressure, 'stroke tangential pressure'),
    tiltX: finiteNumber(value.tiltX, 'stroke tiltX'),
    tiltY: finiteNumber(value.tiltY, 'stroke tiltY'),
    twist: finiteNumber(value.twist, 'stroke twist'),
    altitudeAngle: nullableAngle(value.altitudeAngle, 'stroke altitude'),
    azimuthAngle: nullableAngle(value.azimuthAngle, 'stroke azimuth'),
  });
}

function parseStoredDab(value: unknown): BaselineBrushDabV1 {
  if (!isRecord(value) || value.schema !== 'illustro.baseline-brush-dab/1') {
    throw new TypeError('invalid baseline dab schema');
  }
  const radius = finiteNumber(value.radius, 'baseline dab radius');
  const radiusX =
    value.radiusX === undefined ? radius : finiteNumber(value.radiusX, 'baseline dab radiusX');
  const radiusY =
    value.radiusY === undefined ? radius : finiteNumber(value.radiusY, 'baseline dab radiusY');
  const opacity = finiteNumber(value.opacity, 'baseline dab opacity');
  if (radius <= 0 || radiusX <= 0 || radiusY <= 0 || opacity < 0 || opacity > 1) {
    throw new RangeError('invalid baseline dab range');
  }
  return Object.freeze({
    schema: 'illustro.baseline-brush-dab/1' as const,
    x: finiteNumber(value.x, 'baseline dab x'),
    y: finiteNumber(value.y, 'baseline dab y'),
    radius,
    radiusX,
    radiusY,
    opacity,
  });
}

function parseStoredCompletedStroke(value: unknown): CompletedPaintStrokeV1 {
  if (!isRecord(value) || !isRecord(value.stroke) || !Array.isArray(value.dabs)) {
    throw new TypeError('invalid completed paint stroke');
  }
  const stroke = value.stroke;
  if (stroke.schema !== 'illustro.paint-stroke/1' || !isUuid(stroke.strokeId)) {
    throw new TypeError('invalid paint stroke identity');
  }
  if (!Number.isSafeInteger(stroke.pointerId) || (stroke.pointerId as number) < 0) {
    throw new TypeError('invalid paint stroke pointerId');
  }
  if (stroke.source !== 'pen' && stroke.source !== 'mouse')
    throw new TypeError('invalid paint stroke source');
  if (!Array.isArray(stroke.samples)) throw new TypeError('paint stroke samples must be an array');
  const normalizedStroke: PaintStrokeV1 = Object.freeze({
    schema: 'illustro.paint-stroke/1' as const,
    strokeId: stroke.strokeId,
    pointerId: stroke.pointerId as number,
    source: stroke.source,
    layerId: parseLayerId(stroke.layerId),
    samples: Object.freeze(stroke.samples.map(parseStoredStrokeSample)),
  });
  return freezeCompletedStroke(normalizedStroke, value.dabs.map(parseStoredDab));
}

export function parsePaintProjectSnapshotV1(value: unknown): PaintProjectSnapshotV1 {
  if (!isRecord(value) || value.schema !== 'illustro.paint-project-snapshot/1') {
    throw new TypeError('invalid paint project snapshot schema');
  }
  if (!isRecord(value.document) || value.document.schema !== 'illustro.document/1') {
    throw new TypeError('invalid paint project document');
  }
  const documentValue = value.document;
  if (!isRecord(documentValue.canvas) || !isRecord(documentValue.layerTree)) {
    throw new TypeError('invalid paint project document structure');
  }
  if (
    !Number.isSafeInteger(documentValue.canvas.width) ||
    (documentValue.canvas.width as number) < 1 ||
    !Number.isSafeInteger(documentValue.canvas.height) ||
    (documentValue.canvas.height as number) < 1
  ) {
    throw new RangeError('invalid recovered canvas dimensions');
  }
  if (
    !Array.isArray(documentValue.layerTree.rootLayerIds) ||
    !isRecord(documentValue.layerTree.layers)
  ) {
    throw new TypeError('invalid recovered layer tree');
  }
  const rootLayerIds = Object.freeze(documentValue.layerTree.rootLayerIds.map(parseLayerId));
  if (rootLayerIds.length === 0) throw new Error('paint snapshot requires an active raster layer');
  for (const layerId of rootLayerIds) {
    if (!(layerId in documentValue.layerTree.layers))
      throw new Error('paint snapshot root layer is missing');
  }
  const document = Object.freeze({
    ...documentValue,
    documentId: parseDocumentId(documentValue.documentId),
    projectId: parseProjectId(documentValue.projectId),
    revision: parseRevision(documentValue.revision),
    layerTree: Object.freeze({
      rootLayerIds,
      layers: Object.freeze({ ...documentValue.layerTree.layers }),
    }),
  }) as unknown as DocumentV1;
  if (!Array.isArray(value.committedStrokes)) {
    throw new TypeError('paint snapshot committed strokes must be an array');
  }
  const committedStrokes = Object.freeze(value.committedStrokes.map(parseStoredCompletedStroke));
  for (const completed of committedStrokes) {
    if (!(completed.stroke.layerId in document.layerTree.layers)) {
      throw new Error('paint stroke targets a missing layer');
    }
  }
  return Object.freeze({
    schema: 'illustro.paint-project-snapshot/1' as const,
    document,
    committedStrokes,
  });
}

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

function freezeCompletedStroke(
  stroke: PaintStrokeV1,
  dabs: readonly BaselineBrushDabV1[],
): CompletedPaintStrokeV1 {
  return Object.freeze({ stroke, dabs: Object.freeze([...dabs]) });
}

export class PaintSessionControllerV1 {
  readonly #renderer: PaintRendererDocumentPortV1;
  readonly #mapPointerToDocument: PaintPointerToDocumentMapperV1;
  #document: DocumentV1 | null = null;
  #activeLayerId: LayerId | null = null;
  #activeStroke: PaintStrokeV1 | null = null;
  #activeDabBuilder: BaselineBrushDabBuilderV1 | null = null;
  #activeDabs: readonly BaselineBrushDabV1[] = Object.freeze([]);
  readonly #completedStrokes: CompletedPaintStrokeV1[] = [];
  readonly #committedStrokes: CompletedPaintStrokeV1[] = [];
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
      activeDabCount: this.#activeDabs.length,
      pendingCompletedStrokeCount: this.#completedStrokes.length,
      committedStrokeCount: this.#committedStrokes.length,
    });
  }

  currentDocument(): DocumentV1 | null {
    return this.#document;
  }

  activeStroke(): PaintStrokeV1 | null {
    return this.#activeStroke;
  }

  projectSnapshot(): PaintProjectSnapshotV1 | null {
    const document = this.#document;
    if (document === null) return null;
    return Object.freeze({
      schema: 'illustro.paint-project-snapshot/1' as const,
      document,
      committedStrokes: Object.freeze([...this.#committedStrokes]),
    });
  }

  committedStrokes(): readonly CompletedPaintStrokeV1[] {
    return Object.freeze([...this.#committedStrokes]);
  }

  commitCompletedPaintStroke(
    strokeId: string,
    afterRevision: Revision | number,
    now: Date = new Date(),
  ): PaintStrokeCommitV1 | null {
    const document = this.#document;
    if (document === null) return null;
    const index = this.#completedStrokes.findIndex((entry) => entry.stroke.strokeId === strokeId);
    if (index < 0) return null;
    const revision = parseRevision(afterRevision);
    if (revision <= document.revision) {
      throw new RangeError('committed paint stroke revision must advance the document');
    }
    const timestamp = now.toISOString();
    const before = this.projectSnapshot();
    if (before === null) return null;
    const [committed] = this.#completedStrokes.splice(index, 1);
    if (committed === undefined) return null;
    this.#committedStrokes.push(committed);
    this.#document = Object.freeze({ ...document, revision, modifiedAt: timestamp });
    const after = this.projectSnapshot();
    if (after === null) throw new Error('paint project snapshot disappeared during commit');
    return Object.freeze({ before, after, committed });
  }

  commitDocumentSettings(
    input: PaintDocumentSettingsUpdateV1,
    afterRevision: Revision | number,
    now: Date = new Date(),
  ): PaintDocumentSettingsCommitV1 {
    const document = this.#document;
    if (document === null) throw new Error('document settings require an active document');
    const revision = parseRevision(afterRevision);
    if (revision <= document.revision) {
      throw new RangeError('document settings revision must advance the document');
    }
    const ppi = input.ppi ?? document.canvas.resolution.ppi;
    const background = input.background ?? document.canvas.background;
    const nextCanvas = createCanvasSpec({
      width: document.canvas.width,
      height: document.canvas.height,
      ppi,
      background,
    });
    const currentBackground = document.canvas.background;
    const nextBackground = nextCanvas.background;
    let backgroundUnchanged = false;
    if (currentBackground.kind === 'transparent' && nextBackground.kind === 'transparent') {
      backgroundUnchanged = true;
    } else if (currentBackground.kind === 'solid' && nextBackground.kind === 'solid') {
      backgroundUnchanged = currentBackground.rgba.every(
        (component, index) => component === nextBackground.rgba[index],
      );
    }
    if (document.canvas.resolution.ppi === nextCanvas.resolution.ppi && backgroundUnchanged) {
      throw new Error('document settings update has no changes');
    }
    const before = this.projectSnapshot();
    if (before === null) throw new Error('document settings snapshot is unavailable');
    this.#document = Object.freeze({
      ...document,
      revision,
      modifiedAt: now.toISOString(),
      canvas: nextCanvas,
    });
    const after = this.projectSnapshot();
    if (after === null) throw new Error('document settings snapshot disappeared');
    return Object.freeze({ before, after });
  }

  async restoreProjectSnapshot(snapshot: PaintProjectSnapshotV1): Promise<PaintProjectSnapshotV1> {
    if (this.#disposed) throw new Error('paint session is disposed');
    const normalized = parsePaintProjectSnapshotV1(snapshot);
    await this.#renderer.configureDocument({
      width: normalized.document.canvas.width,
      height: normalized.document.canvas.height,
      workingSpace: normalized.document.color.workingSpace,
      precision: normalized.document.color.precision,
    });
    await this.#renderer.restoreBaselineStrokes(
      normalized.committedStrokes.map((entry) => ({
        strokeId: entry.stroke.strokeId,
        dabs: entry.dabs,
      })),
    );
    this.#document = normalized.document;
    this.#activeLayerId = normalized.document.layerTree.rootLayerIds[0] ?? null;
    this.#clearActiveStroke();
    this.#completedStrokes.length = 0;
    this.#committedStrokes.length = 0;
    this.#committedStrokes.push(...normalized.committedStrokes);
    return this.projectSnapshot()!;
  }

  activeDabs(): readonly BaselineBrushDabV1[] {
    return this.#activeDabs;
  }

  latestCompletedPaintStroke(): CompletedPaintStrokeV1 | null {
    return this.#completedStrokes.at(-1) ?? null;
  }

  takeCompletedPaintStroke(): CompletedPaintStrokeV1 | null {
    return this.#completedStrokes.shift() ?? null;
  }

  takeCompletedStroke(): PaintStrokeV1 | null {
    return this.takeCompletedPaintStroke()?.stroke ?? null;
  }

  async createNewDocument(input: PaintDocumentCreationInputV1): Promise<DocumentV1> {
    if (this.#disposed) throw new Error('paint session is disposed');
    const initial = withInitialRasterLayer(createDocumentV1(input));
    await this.#renderer.configureDocument({
      width: initial.document.canvas.width,
      height: initial.document.canvas.height,
      workingSpace: initial.document.color.workingSpace,
      precision: initial.document.color.precision,
    });
    this.#document = initial.document;
    this.#activeLayerId = initial.layer.id;
    this.#clearActiveStroke();
    this.#completedStrokes.length = 0;
    this.#committedStrokes.length = 0;
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
      this.#clearActiveStroke();
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
      const builder = this.#activeDabBuilder;
      if (completed !== null && builder !== null) {
        this.#activeDabs = builder.finish();
        this.#completedStrokes.push(freezeCompletedStroke(completed, this.#activeDabs));
      }
      this.#clearActiveStroke();
    }
    return this.snapshot();
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#document = null;
    this.#activeLayerId = null;
    this.#clearActiveStroke();
    this.#completedStrokes.length = 0;
    this.#committedStrokes.length = 0;
  }

  #startStroke(batch: PointerInputBatchV1, source: PaintStrokeSourceV1): void {
    const document = this.#document;
    const layerId = this.#activeLayerId;
    if (document === null || layerId === null) return;
    const samples = batch.confirmed
      .filter((sample) => sample.pointerId === batch.pointerId && sample.source === source)
      .map((sample) => toStrokeSample(sample, document, this.#mapPointerToDocument));
    const firstSample = samples[0];
    if (firstSample === undefined) return;

    this.#activeStroke = Object.freeze({
      schema: 'illustro.paint-stroke/1' as const,
      strokeId: crypto.randomUUID(),
      pointerId: batch.pointerId,
      source,
      layerId,
      samples: Object.freeze(samples),
    });
    const builder = new BaselineBrushDabBuilderV1();
    builder.begin(firstSample);
    builder.append(samples.slice(1));
    this.#activeDabBuilder = builder;
    this.#activeDabs = builder.dabs();
  }

  #appendConfirmedSamples(batch: PointerInputBatchV1): void {
    const active = this.#activeStroke;
    const document = this.#document;
    const builder = this.#activeDabBuilder;
    if (active === null || document === null || builder === null) return;
    const additions = batch.confirmed
      .filter((sample) => sample.pointerId === active.pointerId && sample.source === active.source)
      .map((sample) => toStrokeSample(sample, document, this.#mapPointerToDocument));
    if (additions.length === 0) return;
    this.#activeStroke = Object.freeze({
      ...active,
      samples: Object.freeze([...active.samples, ...additions]),
    });
    this.#activeDabs = builder.append(additions);
  }

  #clearActiveStroke(): void {
    this.#activeStroke = null;
    this.#activeDabBuilder = null;
    this.#activeDabs = Object.freeze([]);
  }
}
