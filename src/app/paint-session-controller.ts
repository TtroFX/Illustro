import {
  createCanvasSpec,
  createDocumentV1,
  type CanvasBackgroundSpec,
  type DocumentV1,
} from '../domain/document.js';
import {
  DEFAULT_BRUSH_PARAMETER_VALUES_V1,
  type BrushParameterValuesV1,
} from '../domain/brush-schema.js';
import {
  isUuid,
  parseDocumentId,
  parseLayerId,
  parseProjectId,
  parseRevision,
  type LayerId,
  type Revision,
} from '../domain/identity.js';
import {
  createRasterLayer,
  type RasterLayerV1,
  type RasterTileReferenceV1,
} from '../domain/layers.js';
import {
  BASELINE_BRUSH_HARDNESS,
  DEFAULT_BASELINE_BRUSH_COLOR_V1,
  freezeBaselineBrushColorV1,
  freezeBaselineBrushSampledTipAlphaV1,
  type BaselineBrushColorV1,
  type BaselineBrushCompositeOperationV1,
  type BaselineBrushDabV1,
  type BaselineBrushSampledTipAlphaV1,
  type BaselineBrushTipShapeV1,
} from '../gpu/baseline-brush.js';
import {
  canonicalBrushCompositeOperationV1,
  CanonicalRasterBrushStrokeV1,
  isImplementedCanonicalBrushModeV1,
  requireImplementedCanonicalBrushModeV1,
  type CanonicalBrushModeIdV1,
  type CanonicalBrushModeV1,
  type CanonicalRasterBrushWorkSnapshotV1,
} from './canonical-raster-brush.js';
import type { BaselineRasterLayerDescriptorV1 } from '../gpu/baseline-raster-tile-store.js';
import type {
  BaselineRasterTileImageV1,
  BaselineRasterTilePatchDirectionV1,
  BaselineRasterTilePatchV1,
} from '../gpu/baseline-raster-tile-store.js';
import type {
  PointerInputBatchV1,
  PointerInputSampleV1,
  PointerInputSourceV1,
} from '../input/pointer-input.js';
import {
  hydratePaintRasterLayerDescriptorsV1,
  type RasterMaskTileLoaderV1,
  type RasterMaskTilePayloadV1,
} from './raster-compositor-descriptors.js';

export interface PaintRendererDocumentPortV1 {
  configureDocument(input: {
    readonly width: number;
    readonly height: number;
    readonly workingSpace: DocumentV1['color']['workingSpace'];
    readonly precision: DocumentV1['color']['precision'];
    readonly rasterLayers: readonly BaselineRasterLayerDescriptorV1[];
  }): Promise<unknown>;
  restoreBaselineStrokes(
    strokes: readonly {
      readonly strokeId: string;
      readonly layerId: string;
      readonly operation: BaselineBrushCompositeOperationV1;
      readonly dabs: readonly BaselineBrushDabV1[];
    }[],
  ): Promise<unknown>;
  applyBaselineTilePatches(
    patches: readonly BaselineRasterTilePatchV1[],
    direction: BaselineRasterTilePatchDirectionV1,
  ): Promise<unknown>;
  restoreBaselineCanonicalTiles(
    tiles: readonly BaselineRasterTileImageV1[],
    rasterLayers: readonly BaselineRasterLayerDescriptorV1[],
  ): Promise<unknown>;
  exportBaselineCanonicalTiles(): Promise<readonly BaselineRasterTileImageV1[]>;
  exportBaselineCompositeTiles(): Promise<readonly BaselineRasterTileImageV1[]>;
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
  readonly brushMode: CanonicalBrushModeV1;
  readonly samples: readonly PaintStrokeSampleV1[];
}

export interface CompletedPaintStrokeV1 {
  readonly stroke: PaintStrokeV1;
  readonly dabs: readonly BaselineBrushDabV1[];
  readonly bakedToRasterLayer?: boolean;
}

export interface PaintProjectSnapshotV1 {
  readonly schema: 'illustro.paint-project-snapshot/1';
  readonly document: DocumentV1;
  readonly committedStrokes: readonly CompletedPaintStrokeV1[];
}

export interface PaintStrokeCommitV1 {
  readonly beforeRevision: Revision;
  readonly afterRevision: Revision;
  readonly beforeModifiedAt: string;
  readonly afterModifiedAt: string;
  readonly strokeIndex: number;
  readonly committed: CompletedPaintStrokeV1;
}

export interface PaintStrokeHistoryStateV1 {
  readonly schema: 'illustro.paint-stroke-history/1';
  readonly revision: Revision;
  readonly modifiedAt: string;
  readonly strokeIndex: number;
  readonly present: boolean;
  readonly stroke: CompletedPaintStrokeV1;
}

export interface PaintTileHistoryStateV1 {
  readonly schema: 'illustro.paint-tile-history/1';
  readonly revision: Revision;
  readonly modifiedAt: string;
  readonly strokeId: string;
  readonly present: boolean;
  readonly affectedTiles: readonly {
    readonly layerId: string;
    readonly tx: number;
    readonly ty: number;
  }[];
}

export interface PaintRasterTileReferenceUpdateV1 {
  readonly layerId: string;
  readonly coordinate: { readonly tx: number; readonly ty: number };
  readonly revision: Revision;
  readonly payloadRef: string | null;
}

export interface PaintDocumentSettingsUpdateV1 {
  readonly ppi?: number;
  readonly background?: CanvasBackgroundSpec;
}

export interface PaintDocumentSettingsCommitV1 {
  readonly before: PaintProjectSnapshotV1;
  readonly after: PaintProjectSnapshotV1;
}

export type PaintLayerSelectionModeV1 = 'replace' | 'toggle' | 'range';

export interface PaintSessionSnapshotV1 {
  readonly schema: 'illustro.paint-session/1';
  readonly documentId: string | null;
  readonly activeLayerId: LayerId | null;
  readonly selectedLayerIds: readonly LayerId[];
  readonly selectionAnchorLayerId: LayerId | null;
  readonly brushMode: CanonicalBrushModeV1;
  readonly brushParameters: BrushParameterValuesV1;
  readonly brushHardness: number;
  readonly brushTipShape: BaselineBrushTipShapeV1;
  readonly brushSampledTipAlpha: BaselineBrushSampledTipAlphaV1 | null;
  readonly brushWork: CanonicalRasterBrushWorkSnapshotV1 | null;
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

function equalSampledTipAlphaV1(
  left: BaselineBrushSampledTipAlphaV1 | null,
  right: BaselineBrushSampledTipAlphaV1 | null,
): boolean {
  if (left === right) return true;
  if (left === null || right === null || left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
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
  const flow = value.flow === undefined ? undefined : finiteNumber(value.flow, 'baseline dab flow');
  const strokeOpacity =
    value.strokeOpacity === undefined
      ? undefined
      : finiteNumber(value.strokeOpacity, 'baseline dab strokeOpacity');
  const hardness =
    value.hardness === undefined
      ? undefined
      : finiteNumber(value.hardness, 'baseline dab hardness');
  const tipShape = value.tipShape === undefined ? undefined : value.tipShape;
  if (tipShape !== undefined && tipShape !== 'round' && tipShape !== 'square') {
    throw new TypeError('invalid baseline dab tip shape');
  }
  const color =
    value.color === undefined
      ? undefined
      : Array.isArray(value.color)
        ? freezeBaselineBrushColorV1(
            value.color.map((component) => finiteNumber(component, 'baseline dab color')),
          )
        : null;
  if (color === null) throw new TypeError('invalid baseline dab color');
  if (
    radius <= 0 ||
    radiusX <= 0 ||
    radiusY <= 0 ||
    opacity < 0 ||
    opacity > 1 ||
    (flow !== undefined && (flow < 0 || flow > 1)) ||
    (strokeOpacity !== undefined && (strokeOpacity < 0 || strokeOpacity > 1)) ||
    (hardness !== undefined && (hardness < 0 || hardness > 1))
  ) {
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
    ...(flow === undefined ? {} : { flow }),
    ...(strokeOpacity === undefined ? {} : { strokeOpacity }),
    ...(hardness === undefined ? {} : { hardness }),
    ...(tipShape === undefined ? {} : { tipShape }),
    ...(color === undefined ? {} : { color }),
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
  const storedBrushMode = stroke.brushMode ?? 'raster';
  if (!isImplementedCanonicalBrushModeV1(storedBrushMode)) {
    throw new TypeError(`unsupported recovered brush mode: ${String(storedBrushMode)}`);
  }
  const normalizedStroke: PaintStrokeV1 = Object.freeze({
    schema: 'illustro.paint-stroke/1' as const,
    strokeId: stroke.strokeId,
    pointerId: stroke.pointerId as number,
    source: stroke.source,
    layerId: parseLayerId(stroke.layerId),
    brushMode: storedBrushMode,
    samples: Object.freeze(stroke.samples.map(parseStoredStrokeSample)),
  });
  if (value.bakedToRasterLayer !== undefined && typeof value.bakedToRasterLayer !== 'boolean') {
    throw new TypeError('paint stroke baked raster state must be boolean');
  }
  return freezeCompletedStroke(
    normalizedStroke,
    value.dabs.map(parseStoredDab),
    value.bakedToRasterLayer === true,
  );
}

export function parsePaintStrokeHistoryStateV1(value: unknown): PaintStrokeHistoryStateV1 {
  if (!isRecord(value) || value.schema !== 'illustro.paint-stroke-history/1') {
    throw new TypeError('invalid paint stroke history schema');
  }
  if (!Number.isSafeInteger(value.strokeIndex) || (value.strokeIndex as number) < 0) {
    throw new TypeError('invalid paint stroke history index');
  }
  if (typeof value.present !== 'boolean') {
    throw new TypeError('invalid paint stroke history presence');
  }
  if (typeof value.modifiedAt !== 'string' || Number.isNaN(Date.parse(value.modifiedAt))) {
    throw new TypeError('invalid paint stroke history timestamp');
  }
  return Object.freeze({
    schema: 'illustro.paint-stroke-history/1' as const,
    revision: parseRevision(value.revision),
    modifiedAt: value.modifiedAt,
    strokeIndex: value.strokeIndex as number,
    present: value.present,
    stroke: parseStoredCompletedStroke(value.stroke),
  });
}

export function parsePaintTileHistoryStateV1(value: unknown): PaintTileHistoryStateV1 {
  if (!isRecord(value) || value.schema !== 'illustro.paint-tile-history/1') {
    throw new TypeError('invalid paint tile history schema');
  }
  if (!isUuid(value.strokeId) || typeof value.present !== 'boolean') {
    throw new TypeError('invalid paint tile history stroke state');
  }
  if (typeof value.modifiedAt !== 'string' || Number.isNaN(Date.parse(value.modifiedAt))) {
    throw new TypeError('invalid paint tile history timestamp');
  }
  if (!Array.isArray(value.affectedTiles)) {
    throw new TypeError('paint tile history affectedTiles must be an array');
  }
  const affectedTiles = value.affectedTiles.map((entry) => {
    if (
      !isRecord(entry) ||
      typeof entry.layerId !== 'string' ||
      entry.layerId.length === 0 ||
      !Number.isSafeInteger(entry.tx) ||
      (entry.tx as number) < 0 ||
      !Number.isSafeInteger(entry.ty) ||
      (entry.ty as number) < 0
    ) {
      throw new TypeError('invalid paint tile history coordinate');
    }
    return Object.freeze({
      layerId: entry.layerId,
      tx: entry.tx as number,
      ty: entry.ty as number,
    });
  });
  return Object.freeze({
    schema: 'illustro.paint-tile-history/1' as const,
    revision: parseRevision(value.revision),
    modifiedAt: value.modifiedAt,
    strokeId: value.strokeId,
    present: value.present,
    affectedTiles: Object.freeze(affectedTiles),
  });
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

export function paintRasterLayerDescriptorsV1(
  document: DocumentV1,
): readonly BaselineRasterLayerDescriptorV1[] {
  const layers: BaselineRasterLayerDescriptorV1[] = [];
  for (const layerId of document.layerTree.rootLayerIds) {
    const layer = document.layerTree.layers[layerId];
    if (layer?.type !== 'raster') continue;
    layers.push(
      Object.freeze({
        layerId: layer.id,
        visible: layer.visible,
        opacity: layer.opacity,
        ...(layer.roleFlags.draft ? { draft: true } : {}),
        ...(layer.blendMode === 'normal' ? {} : { blendMode: layer.blendMode }),
      }),
    );
  }
  if (layers.length === 0) throw new Error('paint document requires a root raster layer');
  return Object.freeze(layers);
}

function freezeCompletedStroke(
  stroke: PaintStrokeV1,
  dabs: readonly BaselineBrushDabV1[],
  bakedToRasterLayer = false,
): CompletedPaintStrokeV1 {
  return Object.freeze({
    stroke,
    dabs: Object.freeze([...dabs]),
    bakedToRasterLayer,
  });
}

export class PaintSessionControllerV1 {
  readonly #renderer: PaintRendererDocumentPortV1;
  readonly #mapPointerToDocument: PaintPointerToDocumentMapperV1;
  #document: DocumentV1 | null = null;
  #activeLayerId: LayerId | null = null;
  readonly #selectedLayerIds = new Set<LayerId>();
  #selectionAnchorLayerId: LayerId | null = null;
  #activeStroke: PaintStrokeV1 | null = null;
  readonly #activeSamples: PaintStrokeSampleV1[] = [];
  #activeBrushStroke: CanonicalRasterBrushStrokeV1 | null = null;
  #activeDabDelta: readonly BaselineBrushDabV1[] = Object.freeze([]);
  readonly #completedStrokes: CompletedPaintStrokeV1[] = [];
  readonly #committedStrokes: CompletedPaintStrokeV1[] = [];
  readonly #committedStrokeById = new Map<string, CompletedPaintStrokeV1>();
  readonly #committedStrokeIndexById = new Map<string, number>();
  readonly #hiddenCommittedStrokeIds = new Set<string>();
  readonly #presentCommittedStrokeIds = new Set<string>();
  readonly #unbakedCommittedStrokeIds = new Set<string>();
  readonly #canonicalRasterTileRefs = new Map<LayerId, Map<string, RasterTileReferenceV1>>();
  readonly #rasterMaskTileCache = new Map<string, RasterMaskTilePayloadV1>();
  #rasterMaskTileLoader: RasterMaskTileLoaderV1 | null = null;
  #paintColor: BaselineBrushColorV1 = DEFAULT_BASELINE_BRUSH_COLOR_V1;
  #brushMode: CanonicalBrushModeV1 = 'raster';
  #brushParameters: BrushParameterValuesV1 = DEFAULT_BRUSH_PARAMETER_VALUES_V1;
  #brushHardness: number = BASELINE_BRUSH_HARDNESS;
  #brushTipShape: BaselineBrushTipShapeV1 = 'round';
  #brushSampledTipAlpha: BaselineBrushSampledTipAlphaV1 | null = null;
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
      selectedLayerIds: Object.freeze([...this.#selectedLayerIds]),
      selectionAnchorLayerId: this.#selectionAnchorLayerId,
      brushMode: this.#brushMode,
      brushParameters: this.#brushParameters,
      brushHardness: this.#brushHardness,
      brushTipShape: this.#brushTipShape,
      brushSampledTipAlpha: this.#brushSampledTipAlpha,
      brushWork: this.#activeBrushStroke?.snapshot() ?? null,
      activeStrokeId: this.#activeStroke?.strokeId ?? null,
      activeStrokeSampleCount: this.#activeSamples.length,
      activeDabCount: this.#activeBrushStroke?.dabCount() ?? 0,
      pendingCompletedStrokeCount: this.#completedStrokes.length,
      committedStrokeCount: this.#presentCommittedStrokeIds.size,
    });
  }

  currentDocument(): DocumentV1 | null {
    return this.#document;
  }

  setRasterMaskTileLoader(loader: RasterMaskTileLoaderV1 | null): void {
    this.#rasterMaskTileLoader = loader;
    this.#rasterMaskTileCache.clear();
  }

  setPaintColor(color: BaselineBrushColorV1): void {
    this.#paintColor = freezeBaselineBrushColorV1(color);
  }

  paintColor(): BaselineBrushColorV1 {
    return this.#paintColor;
  }

  brushMode(): CanonicalBrushModeV1 {
    return this.#brushMode;
  }

  brushParameters(): BrushParameterValuesV1 {
    return this.#brushParameters;
  }

  setBrushParameters(parameters: BrushParameterValuesV1): BrushParameterValuesV1 {
    if (
      !Number.isFinite(parameters.sizePx) ||
      parameters.sizePx <= 0 ||
      parameters.sizePx > 4096 ||
      !Number.isFinite(parameters.opacity) ||
      parameters.opacity < 0 ||
      parameters.opacity > 1 ||
      !Number.isFinite(parameters.flow) ||
      parameters.flow < 0 ||
      parameters.flow > 1
    ) {
      throw new RangeError('invalid runtime brush parameters');
    }
    this.#brushParameters = Object.freeze({ ...parameters });
    return this.#brushParameters;
  }

  setBrushHardness(hardness: number): number {
    if (!Number.isFinite(hardness) || hardness < 0 || hardness > 1) {
      throw new RangeError('invalid runtime brush hardness');
    }
    if (hardness !== this.#brushHardness) this.#clearActiveStroke();
    this.#brushHardness = hardness;
    return this.#brushHardness;
  }

  brushHardness(): number {
    return this.#brushHardness;
  }
  setBrushTipShape(
    shape: BaselineBrushTipShapeV1,
    sampledTipAlpha?: readonly number[],
  ): BaselineBrushTipShapeV1 {
    if (shape !== 'round' && shape !== 'square' && shape !== 'sampled-image') {
      throw new TypeError('unsupported runtime brush tip shape');
    }
    const nextSampledTipAlpha =
      shape === 'sampled-image' && sampledTipAlpha !== undefined
        ? freezeBaselineBrushSampledTipAlphaV1(sampledTipAlpha)
        : null;
    if (
      shape !== this.#brushTipShape ||
      !equalSampledTipAlphaV1(nextSampledTipAlpha, this.#brushSampledTipAlpha)
    ) {
      this.#clearActiveStroke();
    }
    this.#brushTipShape = shape;
    this.#brushSampledTipAlpha = nextSampledTipAlpha;
    return this.#brushTipShape;
  }

  brushTipShape(): BaselineBrushTipShapeV1 {
    return this.#brushTipShape;
  }

  setBrushMode(mode: CanonicalBrushModeIdV1): CanonicalBrushModeV1 {
    const implemented = requireImplementedCanonicalBrushModeV1(mode);
    if (implemented === this.#brushMode) return this.#brushMode;
    this.#clearActiveStroke();
    this.#brushMode = implemented;
    return this.#brushMode;
  }

  activeLayerId(): LayerId | null {
    return this.#activeLayerId;
  }

  selectedLayerIds(): readonly LayerId[] {
    return Object.freeze([...this.#selectedLayerIds]);
  }

  isLayerSelected(layerId: LayerId): boolean {
    return this.#selectedLayerIds.has(layerId);
  }

  setActiveLayer(layerId: LayerId): PaintSessionSnapshotV1 {
    return this.selectLayer(layerId, 'replace');
  }

  selectLayer(
    layerId: LayerId,
    mode: PaintLayerSelectionModeV1 = 'replace',
  ): PaintSessionSnapshotV1 {
    const document = this.#document;
    if (document === null) throw new Error('layer selection requires a document');
    if (!(layerId in document.layerTree.layers)) {
      throw new Error(`selected layer is missing: ${layerId}`);
    }
    const roots = document.layerTree.rootLayerIds;
    const setPrimary = (next: LayerId): void => {
      if (this.#activeLayerId !== next) this.#clearActiveStroke();
      this.#activeLayerId = next;
    };
    if (mode === 'replace') {
      this.#selectedLayerIds.clear();
      this.#selectedLayerIds.add(layerId);
      this.#selectionAnchorLayerId = layerId;
      setPrimary(layerId);
      return this.snapshot();
    }
    if (mode === 'range') {
      const anchor = this.#selectionAnchorLayerId ?? this.#activeLayerId ?? layerId;
      const anchorIndex = roots.indexOf(anchor);
      const targetIndex = roots.indexOf(layerId);
      if (anchorIndex < 0 || targetIndex < 0) {
        return this.selectLayer(layerId, 'replace');
      }
      this.#selectedLayerIds.clear();
      const start = Math.min(anchorIndex, targetIndex);
      const end = Math.max(anchorIndex, targetIndex);
      for (const selectedId of roots.slice(start, end + 1)) {
        this.#selectedLayerIds.add(selectedId);
      }
      this.#selectionAnchorLayerId = anchor;
      setPrimary(layerId);
      return this.snapshot();
    }
    if (mode === 'toggle') {
      if (this.#selectedLayerIds.has(layerId)) {
        if (this.#selectedLayerIds.size === 1) return this.snapshot();
        this.#selectedLayerIds.delete(layerId);
        if (this.#activeLayerId === layerId) {
          const targetIndex = roots.indexOf(layerId);
          const remaining = roots.filter((id) => this.#selectedLayerIds.has(id));
          const next =
            remaining.sort(
              (left, right) =>
                Math.abs(roots.indexOf(left) - targetIndex) -
                Math.abs(roots.indexOf(right) - targetIndex),
            )[0] ?? null;
          if (next !== null) setPrimary(next);
        }
        if (this.#selectionAnchorLayerId === layerId) {
          this.#selectionAnchorLayerId = this.#activeLayerId;
        }
      } else {
        this.#selectedLayerIds.add(layerId);
        this.#selectionAnchorLayerId = layerId;
        setPrimary(layerId);
      }
      return this.snapshot();
    }
    throw new TypeError(`unsupported layer selection mode: ${String(mode)}`);
  }

  activeStrokeId(): string | null {
    return this.#activeStroke?.strokeId ?? null;
  }

  activeStrokeLayerId(): LayerId | null {
    return this.#activeStroke?.layerId ?? null;
  }

  activeStroke(): PaintStrokeV1 | null {
    const active = this.#activeStroke;
    if (active === null) return null;
    return Object.freeze({
      ...active,
      samples: Object.freeze([...this.#activeSamples]),
    });
  }

  projectSnapshot(): PaintProjectSnapshotV1 | null {
    const document = this.#document;
    if (document === null) return null;
    return Object.freeze({
      schema: 'illustro.paint-project-snapshot/1' as const,
      document: this.#documentWithCanonicalRasterTiles(document),
      committedStrokes: this.committedStrokes(),
    });
  }

  persistenceProjectSnapshot(): PaintProjectSnapshotV1 | null {
    const document = this.#document;
    if (document === null) return null;
    const committedStrokes: CompletedPaintStrokeV1[] = [];
    for (const strokeId of this.#unbakedCommittedStrokeIds) {
      if (this.#hiddenCommittedStrokeIds.has(strokeId)) continue;
      const entry = this.#committedStrokeById.get(strokeId);
      if (entry !== undefined) committedStrokes.push(entry);
    }
    return Object.freeze({
      schema: 'illustro.paint-project-snapshot/1' as const,
      document: this.#documentWithCanonicalRasterTiles(document),
      committedStrokes: Object.freeze(committedStrokes),
    });
  }

  committedStrokes(): readonly CompletedPaintStrokeV1[] {
    if (this.#hiddenCommittedStrokeIds.size === 0) {
      return Object.freeze([...this.#committedStrokes]);
    }
    return Object.freeze(
      this.#committedStrokes.filter(
        (entry) => !this.#hiddenCommittedStrokeIds.has(entry.stroke.strokeId),
      ),
    );
  }

  strokeEventLog(): readonly CompletedPaintStrokeV1[] {
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
    const beforeRevision = document.revision;
    const beforeModifiedAt = document.modifiedAt;
    const afterModifiedAt = now.toISOString();
    const strokeIndex = this.#committedStrokes.length;
    const [committed] = this.#completedStrokes.splice(index, 1);
    if (committed === undefined) return null;
    const pendingBake = freezeCompletedStroke(committed.stroke, committed.dabs, false);
    this.#committedStrokes.push(pendingBake);
    this.#committedStrokeById.set(pendingBake.stroke.strokeId, pendingBake);
    this.#committedStrokeIndexById.set(pendingBake.stroke.strokeId, strokeIndex);
    this.#hiddenCommittedStrokeIds.delete(pendingBake.stroke.strokeId);
    this.#presentCommittedStrokeIds.add(pendingBake.stroke.strokeId);
    this.#unbakedCommittedStrokeIds.add(pendingBake.stroke.strokeId);
    this.#document = Object.freeze({ ...document, revision, modifiedAt: afterModifiedAt });
    return Object.freeze({
      beforeRevision,
      afterRevision: revision,
      beforeModifiedAt,
      afterModifiedAt,
      strokeIndex,
      committed: pendingBake,
    });
  }

  markCommittedStrokeBaked(strokeId: string): void {
    const entry = this.#committedStrokeById.get(strokeId);
    const index = this.#committedStrokeIndexById.get(strokeId);
    if (entry === undefined || index === undefined) return;
    if (entry.bakedToRasterLayer === true) {
      this.#unbakedCommittedStrokeIds.delete(strokeId);
      return;
    }
    const baked = freezeCompletedStroke(entry.stroke, entry.dabs, true);
    this.#committedStrokes[index] = baked;
    this.#committedStrokeById.set(strokeId, baked);
    this.#unbakedCommittedStrokeIds.delete(strokeId);
  }

  markAllCommittedStrokesBaked(): void {
    for (const strokeId of [...this.#unbakedCommittedStrokeIds]) {
      this.markCommittedStrokeBaked(strokeId);
    }
  }

  applyCanonicalRasterTileReferences(updates: readonly PaintRasterTileReferenceUpdateV1[]): void {
    const document = this.#document;
    if (document === null) throw new Error('raster tile references require an active document');
    for (const update of updates) {
      const layerId = parseLayerId(update.layerId);
      const layer = document.layerTree.layers[layerId];
      if (layer?.type !== 'raster') {
        throw new Error(`raster tile reference targets a missing raster layer: ${layerId}`);
      }
      if (
        !Number.isSafeInteger(update.coordinate.tx) ||
        update.coordinate.tx < 0 ||
        !Number.isSafeInteger(update.coordinate.ty) ||
        update.coordinate.ty < 0
      ) {
        throw new RangeError('raster tile reference coordinate must be non-negative');
      }
      const revision = parseRevision(update.revision);
      const refs = this.#canonicalRasterTileRefs.get(layerId) ?? new Map();
      this.#canonicalRasterTileRefs.set(layerId, refs);
      const key = `${update.coordinate.tx}:${update.coordinate.ty}`;
      if (update.payloadRef === null) {
        refs.delete(key);
      } else {
        if (update.payloadRef.length === 0) {
          throw new TypeError('raster tile payloadRef must not be empty');
        }
        refs.set(
          key,
          Object.freeze({
            x: update.coordinate.tx,
            y: update.coordinate.ty,
            revision,
            payloadRef: update.payloadRef,
          }),
        );
      }
    }
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
    const rasterLayers = await this.#renderRasterLayerDescriptors(normalized.document);
    await this.#renderer.configureDocument({
      width: normalized.document.canvas.width,
      height: normalized.document.canvas.height,
      workingSpace: normalized.document.color.workingSpace,
      precision: normalized.document.color.precision,
      rasterLayers,
    });
    await this.#renderer.restoreBaselineStrokes(
      normalized.committedStrokes.map((entry) => ({
        strokeId: entry.stroke.strokeId,
        layerId: entry.stroke.layerId,
        operation: canonicalBrushCompositeOperationV1(entry.stroke.brushMode),
        dabs: entry.dabs,
      })),
    );
    return this.#adoptRestoredProjectSnapshot(normalized);
  }

  async restoreCanonicalProjectSnapshot(
    snapshot: PaintProjectSnapshotV1,
    tiles: readonly BaselineRasterTileImageV1[],
  ): Promise<PaintProjectSnapshotV1> {
    if (this.#disposed) throw new Error('paint session is disposed');
    const normalized = parsePaintProjectSnapshotV1(snapshot);
    const rasterLayers = await this.#renderRasterLayerDescriptors(normalized.document);
    await this.#renderer.configureDocument({
      width: normalized.document.canvas.width,
      height: normalized.document.canvas.height,
      workingSpace: normalized.document.color.workingSpace,
      precision: normalized.document.color.precision,
      rasterLayers,
    });
    await this.#renderer.restoreBaselineCanonicalTiles(tiles, rasterLayers);
    return this.#adoptRestoredProjectSnapshot(normalized);
  }

  exportCanonicalRasterTiles(): Promise<readonly BaselineRasterTileImageV1[]> {
    if (this.#disposed) throw new Error('paint session is disposed');
    return this.#renderer.exportBaselineCanonicalTiles();
  }

  exportCompositeRasterTiles(): Promise<readonly BaselineRasterTileImageV1[]> {
    if (this.#disposed) throw new Error('paint session is disposed');
    return this.#renderer.exportBaselineCompositeTiles();
  }

  async restoreStrokeHistoryState(
    state: PaintStrokeHistoryStateV1,
  ): Promise<PaintProjectSnapshotV1> {
    if (this.#disposed) throw new Error('paint session is disposed');
    const normalized = parsePaintStrokeHistoryStateV1(state);
    const document = this.#document;
    if (document === null) throw new Error('paint stroke history requires an active document');
    if (!(normalized.stroke.stroke.layerId in document.layerTree.layers)) {
      throw new Error('paint stroke history targets a missing layer');
    }

    const strokeId = normalized.stroke.stroke.strokeId;
    const existingIndex = this.#committedStrokes.findIndex(
      (entry) => entry.stroke.strokeId === strokeId,
    );
    if (normalized.present) {
      if (existingIndex >= 0) this.#committedStrokes.splice(existingIndex, 1);
      const insertionIndex = Math.min(normalized.strokeIndex, this.#committedStrokes.length);
      this.#committedStrokes.splice(insertionIndex, 0, normalized.stroke);
    } else if (existingIndex >= 0) {
      this.#committedStrokes.splice(existingIndex, 1);
    }

    this.#committedStrokeById.clear();
    this.#committedStrokeIndexById.clear();
    this.#hiddenCommittedStrokeIds.clear();
    this.#presentCommittedStrokeIds.clear();
    this.#unbakedCommittedStrokeIds.clear();
    this.#committedStrokes.forEach((entry, index) => {
      this.#committedStrokeById.set(entry.stroke.strokeId, entry);
      this.#committedStrokeIndexById.set(entry.stroke.strokeId, index);
      this.#presentCommittedStrokeIds.add(entry.stroke.strokeId);
      if (entry.bakedToRasterLayer !== true) {
        this.#unbakedCommittedStrokeIds.add(entry.stroke.strokeId);
      }
    });

    this.#document = Object.freeze({
      ...document,
      revision: normalized.revision,
      modifiedAt: normalized.modifiedAt,
    });
    this.#clearActiveStroke();
    this.#completedStrokes.length = 0;
    await this.#renderer.restoreBaselineStrokes(
      this.#committedStrokes.map((entry) => ({
        strokeId: entry.stroke.strokeId,
        layerId: entry.stroke.layerId,
        operation: canonicalBrushCompositeOperationV1(entry.stroke.brushMode),
        dabs: entry.dabs,
      })),
    );
    const snapshot = this.projectSnapshot();
    if (snapshot === null) throw new Error('paint stroke history restore lost the active document');
    return snapshot;
  }

  async restoreTileHistoryState(
    state: PaintTileHistoryStateV1,
    patches: readonly BaselineRasterTilePatchV1[],
    direction: BaselineRasterTilePatchDirectionV1,
  ): Promise<void> {
    if (this.#disposed) throw new Error('paint session is disposed');
    const normalized = parsePaintTileHistoryStateV1(state);
    const document = this.#document;
    if (document === null) throw new Error('paint tile history requires an active document');
    const present = this.#presentCommittedStrokeIds.has(normalized.strokeId);
    if (normalized.present && !present) {
      this.#presentCommittedStrokeIds.add(normalized.strokeId);
      if (this.#committedStrokeById.has(normalized.strokeId)) {
        this.#hiddenCommittedStrokeIds.delete(normalized.strokeId);
      }
    } else if (!normalized.present && present) {
      this.#presentCommittedStrokeIds.delete(normalized.strokeId);
      if (this.#committedStrokeById.has(normalized.strokeId)) {
        this.#hiddenCommittedStrokeIds.add(normalized.strokeId);
      }
    }
    this.#document = Object.freeze({
      ...document,
      revision: normalized.revision,
      modifiedAt: normalized.modifiedAt,
    });
    this.#clearActiveStroke();
    this.#completedStrokes.length = 0;
    await this.#renderer.applyBaselineTilePatches(patches, direction);
  }

  activeDabs(): readonly BaselineBrushDabV1[] {
    return this.#activeBrushStroke?.dabs() ?? Object.freeze([]);
  }

  takeActiveDabDelta(): readonly BaselineBrushDabV1[] {
    const delta = this.#activeDabDelta;
    this.#activeDabDelta = Object.freeze([]);
    return delta;
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
    const rasterLayers = await this.#renderRasterLayerDescriptors(initial.document);
    await this.#renderer.configureDocument({
      width: initial.document.canvas.width,
      height: initial.document.canvas.height,
      workingSpace: initial.document.color.workingSpace,
      precision: initial.document.color.precision,
      rasterLayers,
    });
    this.#document = initial.document;
    this.#activeLayerId = initial.layer.id;
    this.#selectedLayerIds.clear();
    this.#selectedLayerIds.add(initial.layer.id);
    this.#selectionAnchorLayerId = initial.layer.id;
    this.#clearActiveStroke();
    this.#completedStrokes.length = 0;
    this.#committedStrokes.length = 0;
    this.#committedStrokeById.clear();
    this.#committedStrokeIndexById.clear();
    this.#hiddenCommittedStrokeIds.clear();
    this.#presentCommittedStrokeIds.clear();
    this.#unbakedCommittedStrokeIds.clear();
    this.#resetCanonicalRasterTileReferences(initial.document);
    return initial.document;
  }

  ingestPointerBatch(batch: PointerInputBatchV1): PaintSessionSnapshotV1 {
    if (this.#disposed || this.#document === null || this.#activeLayerId === null) {
      return this.snapshot();
    }
    const activeLayer = this.#document.layerTree.layers[this.#activeLayerId];
    if (activeLayer?.type !== 'raster' || activeLayer.locks.all || activeLayer.locks.pixels)
      return this.snapshot();
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
      const completed = this.activeStroke();
      const builder = this.#activeBrushStroke;
      if (completed !== null && builder !== null) {
        builder.finishConfirmed();
        this.#completedStrokes.push(freezeCompletedStroke(completed, builder.dabs()));
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
    this.#selectedLayerIds.clear();
    this.#selectionAnchorLayerId = null;
    this.#clearActiveStroke();
    this.#completedStrokes.length = 0;
    this.#committedStrokes.length = 0;
    this.#committedStrokeById.clear();
    this.#committedStrokeIndexById.clear();
    this.#hiddenCommittedStrokeIds.clear();
    this.#presentCommittedStrokeIds.clear();
    this.#unbakedCommittedStrokeIds.clear();
    this.#canonicalRasterTileRefs.clear();
    this.#rasterMaskTileCache.clear();
    this.#rasterMaskTileLoader = null;
  }

  async #renderRasterLayerDescriptors(
    document: DocumentV1,
  ): Promise<readonly BaselineRasterLayerDescriptorV1[]> {
    const loader = this.#rasterMaskTileLoader;
    return hydratePaintRasterLayerDescriptorsV1(
      document,
      loader === null
        ? null
        : async (payloadRef) => {
            const cached = this.#rasterMaskTileCache.get(payloadRef);
            if (cached !== undefined) {
              this.#rasterMaskTileCache.delete(payloadRef);
              this.#rasterMaskTileCache.set(payloadRef, cached);
              return cached;
            }
            const loaded = await loader(payloadRef);
            const owned: RasterMaskTilePayloadV1 = Object.freeze({
              pixelFormat: loaded.pixelFormat,
              width: loaded.width,
              height: loaded.height,
              bytes: new Uint8Array(loaded.bytes),
            });
            this.#rasterMaskTileCache.set(payloadRef, owned);
            while (this.#rasterMaskTileCache.size > 128) {
              const oldest = this.#rasterMaskTileCache.keys().next().value as string | undefined;
              if (oldest === undefined) break;
              this.#rasterMaskTileCache.delete(oldest);
            }
            return owned;
          },
    );
  }

  #adoptRestoredProjectSnapshot(normalized: PaintProjectSnapshotV1): PaintProjectSnapshotV1 {
    const previousActiveLayerId = this.#activeLayerId;
    const previousSelectedLayerIds = [...this.#selectedLayerIds];
    const previousAnchorLayerId = this.#selectionAnchorLayerId;
    this.#document = normalized.document;
    this.#activeLayerId =
      previousActiveLayerId !== null &&
      previousActiveLayerId in normalized.document.layerTree.layers
        ? previousActiveLayerId
        : (normalized.document.layerTree.rootLayerIds[0] ?? null);
    this.#selectedLayerIds.clear();
    for (const layerId of previousSelectedLayerIds) {
      if (layerId in normalized.document.layerTree.layers) this.#selectedLayerIds.add(layerId);
    }
    if (this.#activeLayerId !== null) this.#selectedLayerIds.add(this.#activeLayerId);
    this.#selectionAnchorLayerId =
      previousAnchorLayerId !== null &&
      previousAnchorLayerId in normalized.document.layerTree.layers
        ? previousAnchorLayerId
        : this.#activeLayerId;
    this.#clearActiveStroke();
    this.#completedStrokes.length = 0;
    this.#committedStrokes.length = 0;
    this.#committedStrokes.push(...normalized.committedStrokes);
    this.#committedStrokeById.clear();
    this.#committedStrokeIndexById.clear();
    this.#hiddenCommittedStrokeIds.clear();
    this.#presentCommittedStrokeIds.clear();
    this.#unbakedCommittedStrokeIds.clear();
    normalized.committedStrokes.forEach((entry, index) => {
      const strokeId = entry.stroke.strokeId;
      this.#committedStrokeById.set(strokeId, entry);
      this.#committedStrokeIndexById.set(strokeId, index);
      this.#presentCommittedStrokeIds.add(strokeId);
      if (entry.bakedToRasterLayer !== true) this.#unbakedCommittedStrokeIds.add(strokeId);
    });
    this.#resetCanonicalRasterTileReferences(normalized.document);
    const restored = this.projectSnapshot();
    if (restored === null) throw new Error('paint project restore lost the active document');
    return restored;
  }

  #resetCanonicalRasterTileReferences(document: DocumentV1): void {
    this.#canonicalRasterTileRefs.clear();
    for (const layer of Object.values(document.layerTree.layers)) {
      if (layer.type !== 'raster') continue;
      const refs = new Map<string, RasterTileReferenceV1>();
      for (const tile of (layer as RasterLayerV1).tiles) {
        refs.set(`${tile.x}:${tile.y}`, tile);
      }
      this.#canonicalRasterTileRefs.set(layer.id, refs);
    }
  }

  #documentWithCanonicalRasterTiles(document: DocumentV1): DocumentV1 {
    let changed = false;
    const layers = { ...document.layerTree.layers };
    for (const [layerId, refs] of this.#canonicalRasterTileRefs) {
      const layer = layers[layerId];
      if (layer?.type !== 'raster') continue;
      const tiles = Object.freeze(
        [...refs.values()].sort((left, right) => left.y - right.y || left.x - right.x),
      );
      const revision = tiles.reduce<number>(
        (maximum, tile) => Math.max(maximum, tile.revision),
        layer.revision,
      );
      layers[layerId] = Object.freeze({ ...layer, revision: parseRevision(revision), tiles });
      changed = true;
    }
    if (!changed) return document;
    return Object.freeze({
      ...document,
      layerTree: Object.freeze({
        rootLayerIds: document.layerTree.rootLayerIds,
        layers: Object.freeze(layers),
      }),
    });
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

    this.#activeSamples.length = 0;
    this.#activeSamples.push(...samples);
    this.#activeStroke = Object.freeze({
      schema: 'illustro.paint-stroke/1' as const,
      strokeId: crypto.randomUUID(),
      pointerId: batch.pointerId,
      source,
      layerId,
      brushMode: this.#brushMode,
      samples: Object.freeze([]),
    });
    const parameters = this.#brushParameters;
    const builder = new CanonicalRasterBrushStrokeV1({
      color: this.#paintColor,
      mode: this.#brushMode,
      sizePx: parameters.sizePx,
      opacity: parameters.opacity,
      flow: parameters.flow,
      hardness: this.#brushHardness,
      tipShape: this.#brushTipShape,
      ...(this.#brushSampledTipAlpha === null
        ? {}
        : { sampledTipAlpha: this.#brushSampledTipAlpha }),
    });
    this.#queueActiveDabDelta(builder.beginConfirmed(firstSample));
    this.#queueActiveDabDelta(builder.appendConfirmed(samples.slice(1)));
    this.#activeBrushStroke = builder;
  }

  #appendConfirmedSamples(batch: PointerInputBatchV1): void {
    const active = this.#activeStroke;
    const document = this.#document;
    const builder = this.#activeBrushStroke;
    if (active === null || document === null || builder === null) return;
    const additions = batch.confirmed
      .filter((sample) => sample.pointerId === active.pointerId && sample.source === active.source)
      .map((sample) => toStrokeSample(sample, document, this.#mapPointerToDocument));
    if (additions.length === 0) return;
    this.#activeSamples.push(...additions);
    this.#queueActiveDabDelta(builder.appendConfirmed(additions));
  }

  #queueActiveDabDelta(delta: readonly BaselineBrushDabV1[]): void {
    if (delta.length === 0) return;
    if (this.#activeDabDelta.length === 0) {
      this.#activeDabDelta = delta;
      return;
    }
    this.#activeDabDelta = Object.freeze([...this.#activeDabDelta, ...delta]);
  }

  #clearActiveStroke(): void {
    this.#activeStroke = null;
    this.#activeSamples.length = 0;
    this.#activeBrushStroke = null;
    this.#activeDabDelta = Object.freeze([]);
  }
}
