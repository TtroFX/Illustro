import {
  createCanvasSpec,
  createDocumentV1,
  type CanvasBackgroundSpec,
  type DocumentV1,
} from '../domain/document.js';
import {
  DEFAULT_BRUSH_PARAMETER_VALUES_V1,
  DEFAULT_BRUSH_VELOCITY_MAXIMUM_PX_PER_SECOND_V1,
  MIN_BRUSH_VELOCITY_MAXIMUM_PX_PER_SECOND_V1,
  MAX_BRUSH_VELOCITY_MAXIMUM_PX_PER_SECOND_V1,
  type BrushParameterValuesV1,
  type BrushTextureBlendModeV1,
} from '../domain/brush-schema.js';
import {
  LINEAR_RESPONSE_CURVE_V1,
  normalizeResponseCurveV1,
  responseCurveEqualsV1,
  type ResponseCurvePointV1,
} from '../domain/response-curve.js';
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
  BASELINE_BRUSH_MINIMUM_STAMP_DISTANCE_PX,
  BASELINE_BRUSH_SPACING_RATIO,
  BASELINE_BRUSH_START_TAPER_LENGTH_PX,
  BASELINE_BRUSH_END_TAPER_LENGTH_PX,
  BASELINE_BRUSH_SIZE_TAPER_MINIMUM_RATIO,
  BASELINE_BRUSH_OPACITY_TAPER_MINIMUM_RATIO,
  BASELINE_BRUSH_TIP_DENSITY,
  BASELINE_BRUSH_TIP_ANGLE_DEGREES,
  BASELINE_BRUSH_TIP_DIRECTION_DEGREES,
  DEFAULT_BASELINE_BRUSH_COLOR_V1,
  freezeBaselineBrushColorV1,
  freezeBaselineBrushSampledTipAlphaV1,
  normalizeBaselineBrushTipAngleDegreesV1,
  type BaselineBrushColorV1,
  type BaselineBrushCompositeOperationV1,
  type BaselineBrushDabV1,
  type BaselineBrushSampledTipAlphaV1,
  type BaselineBrushTipSelectionModeV1,
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
import { correctPostStrokeGeometryV1 } from './post-stroke-correction.js';

import { RealtimeBrushStabilizerV1 } from './realtime-brush-stabilizer.js';

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
  readonly randomSeed?: number;
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
  readonly brushTipDensity: number;
  readonly brushSpacingRatio: number;
  readonly brushMinimumStampDistancePx: number;
  readonly brushStartTaperLengthPx: number;
  readonly brushEndTaperLengthPx: number;
  readonly brushSizeTaperMinimumRatio: number;
  readonly brushOpacityTaperMinimumRatio: number;
  readonly brushForceStartTaper: boolean;
  readonly brushForceEndTaper: boolean;
  readonly brushRealtimeStabilizationAmount: number;
  readonly brushPostStrokeCorrectionAmount: number;
  readonly brushTextureResourceKind: 'grain' | null;
  readonly brushTextureResourceSubtype: 'grain' | 'paper' | null;
  readonly brushTextureResourceId: string | null;
  readonly brushTextureStrength: number;
  readonly brushTextureScale: number;
  readonly brushTextureRotationDegrees: number;
  readonly brushTextureBlendMode: BrushTextureBlendModeV1;
  readonly brushPressureSizeEnabled: boolean;
  readonly brushPressureOpacityEnabled: boolean;
  readonly brushPressureFlowEnabled: boolean;
  readonly brushPressureResponseCurve: readonly ResponseCurvePointV1[];
  readonly brushTiltSizeEnabled: boolean;
  readonly brushTiltOpacityEnabled: boolean;
  readonly brushTiltFlowEnabled: boolean;
  readonly brushTiltResponseCurve: readonly ResponseCurvePointV1[];
  readonly brushVelocitySizeEnabled: boolean;
  readonly brushVelocityOpacityEnabled: boolean;
  readonly brushVelocityFlowEnabled: boolean;
  readonly brushVelocityResponseCurve: readonly ResponseCurvePointV1[];
  readonly brushVelocityMaximumPxPerSecond: number;
  readonly brushRandomSizeEnabled: boolean;
  readonly brushRandomOpacityEnabled: boolean;
  readonly brushRandomFlowEnabled: boolean;
  readonly brushRandomResponseCurve: readonly ResponseCurvePointV1[];
  readonly brushSizeMinimumResponse: number;
  readonly brushOpacityMinimumResponse: number;
  readonly brushFlowMinimumResponse: number;
  readonly brushTipAngleDegrees: number;
  readonly brushTipDirectionDegrees: number;
  readonly brushFollowStrokeRotation: boolean;
  readonly brushPenOrientationEnabled: boolean;
  readonly brushTipSelectionMode: BaselineBrushTipSelectionModeV1;
  readonly brushTipAlternativeCount: number;
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
function equalSampledTipAlphaSetsV1(
  left: readonly BaselineBrushSampledTipAlphaV1[],
  right: readonly BaselineBrushSampledTipAlphaV1[],
): boolean {
  return (
    left.length === right.length &&
    left.every((alpha, index) => equalSampledTipAlphaV1(alpha, right[index] ?? null))
  );
}

export interface PaintVelocitySampleV1 {
  readonly documentX: number;
  readonly documentY: number;
  readonly timestampMs: number;
}

export function normalizedPaintVelocityV1(
  previous: PaintVelocitySampleV1 | null,
  current: PaintVelocitySampleV1,
  previousNormalizedVelocity: number,
  maximumPxPerSecond: number,
): number {
  if (
    !Number.isFinite(previousNormalizedVelocity) ||
    previousNormalizedVelocity < 0 ||
    previousNormalizedVelocity > 1
  ) {
    throw new RangeError('previous normalized paint velocity must be within 0..1');
  }
  if (
    !Number.isFinite(maximumPxPerSecond) ||
    maximumPxPerSecond < MIN_BRUSH_VELOCITY_MAXIMUM_PX_PER_SECOND_V1 ||
    maximumPxPerSecond > MAX_BRUSH_VELOCITY_MAXIMUM_PX_PER_SECOND_V1
  ) {
    throw new RangeError('paint velocity maximum must be within 100..20000 document px/s');
  }
  if (previous === null) return 0;
  const dtMs = current.timestampMs - previous.timestampMs;
  if (!Number.isFinite(dtMs) || dtMs <= 0) return previousNormalizedVelocity;
  const distancePx = Math.hypot(
    current.documentX - previous.documentX,
    current.documentY - previous.documentY,
  );
  const velocityPxPerSecond = (distancePx * 1000) / dtMs;
  return Math.max(0, Math.min(1, velocityPxPerSecond / maximumPxPerSecond));
}

function velocitySeriesV1(
  samples: readonly PaintStrokeSampleV1[],
  maximumPxPerSecond: number,
  previousSample: PaintStrokeSampleV1 | null = null,
  previousVelocity = 0,
): Readonly<{ values: readonly number[]; lastVelocity: number }> {
  const values: number[] = [];
  let prior = previousSample;
  let velocity = previousVelocity;
  for (const sample of samples) {
    velocity = normalizedPaintVelocityV1(prior, sample, velocity, maximumPxPerSecond);
    values.push(velocity);
    prior = sample;
  }
  return Object.freeze({ values: Object.freeze(values), lastVelocity: velocity });
}

function deterministicPaintStrokeSeedV1(strokeId: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < strokeId.length; index += 1) {
    hash ^= strokeId.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
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
  const tipDensity =
    value.tipDensity === undefined
      ? undefined
      : finiteNumber(value.tipDensity, 'baseline dab tipDensity');
  const tipAngleDegrees =
    value.tipAngleDegrees === undefined
      ? undefined
      : normalizeBaselineBrushTipAngleDegreesV1(
          finiteNumber(value.tipAngleDegrees, 'baseline dab tipAngleDegrees'),
        );
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
    (hardness !== undefined && (hardness < 0 || hardness > 1)) ||
    (tipDensity !== undefined && (tipDensity < 0 || tipDensity > 1))
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
    ...(tipDensity === undefined ? {} : { tipDensity }),
    ...(tipAngleDegrees === undefined ? {} : { tipAngleDegrees }),
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
  const randomSeed =
    stroke.randomSeed === undefined
      ? undefined
      : finiteNumber(stroke.randomSeed, 'paint stroke random seed');
  if (
    randomSeed !== undefined &&
    (!Number.isSafeInteger(randomSeed) || randomSeed < 0 || randomSeed > 0xffffffff)
  ) {
    throw new RangeError('paint stroke random seed must be uint32');
  }
  const normalizedStroke: PaintStrokeV1 = Object.freeze({
    schema: 'illustro.paint-stroke/1' as const,
    strokeId: stroke.strokeId,
    pointerId: stroke.pointerId as number,
    source: stroke.source,
    layerId: parseLayerId(stroke.layerId),
    brushMode: storedBrushMode,
    ...(randomSeed === undefined ? {} : { randomSeed }),
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
  #activeBrushFactory: (() => CanonicalRasterBrushStrokeV1) | null = null;
  #activeRealtimeStabilizer: RealtimeBrushStabilizerV1 | null = null;
  #activeVelocity = 0;
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
  #brushTipDensity: number = BASELINE_BRUSH_TIP_DENSITY;
  #brushSpacingRatio: number = BASELINE_BRUSH_SPACING_RATIO;
  #brushMinimumStampDistancePx: number = BASELINE_BRUSH_MINIMUM_STAMP_DISTANCE_PX;
  #brushStartTaperLengthPx: number = BASELINE_BRUSH_START_TAPER_LENGTH_PX;
  #brushEndTaperLengthPx: number = BASELINE_BRUSH_END_TAPER_LENGTH_PX;
  #brushSizeTaperMinimumRatio: number = BASELINE_BRUSH_SIZE_TAPER_MINIMUM_RATIO;
  #brushOpacityTaperMinimumRatio: number = BASELINE_BRUSH_OPACITY_TAPER_MINIMUM_RATIO;
  #brushForceStartTaper = false;
  #brushForceEndTaper = false;
  #brushRealtimeStabilizationAmount = 0;
  #brushPostStrokeCorrectionAmount = 0;
  #brushTextureResourceKind: 'grain' | null = null;
  #brushTextureResourceSubtype: 'grain' | 'paper' | null = null;
  #brushTextureResourceId: string | null = null;
  #brushTextureStrength = 0;
  #brushTextureScale = 1;
  #brushTextureRotationDegrees = 0;
  #brushTextureBlendMode: BrushTextureBlendModeV1 = 'multiply';
  #brushPressureSizeEnabled = false;
  #brushPressureOpacityEnabled = false;
  #brushPressureFlowEnabled = false;
  #brushPressureResponseCurve: readonly ResponseCurvePointV1[] = LINEAR_RESPONSE_CURVE_V1;
  #brushTiltSizeEnabled = false;
  #brushTiltOpacityEnabled = false;
  #brushTiltFlowEnabled = false;
  #brushTiltResponseCurve: readonly ResponseCurvePointV1[] = LINEAR_RESPONSE_CURVE_V1;
  #brushVelocitySizeEnabled = false;
  #brushVelocityOpacityEnabled = false;
  #brushVelocityFlowEnabled = false;
  #brushVelocityResponseCurve: readonly ResponseCurvePointV1[] = LINEAR_RESPONSE_CURVE_V1;
  #brushVelocityMaximumPxPerSecond: number = DEFAULT_BRUSH_VELOCITY_MAXIMUM_PX_PER_SECOND_V1;
  #brushRandomSizeEnabled = false;
  #brushRandomOpacityEnabled = false;
  #brushRandomFlowEnabled = false;
  #brushRandomResponseCurve: readonly ResponseCurvePointV1[] = LINEAR_RESPONSE_CURVE_V1;
  #brushSizeMinimumResponse = 0;
  #brushOpacityMinimumResponse = 0;
  #brushFlowMinimumResponse = 0;
  #brushTipAngleDegrees: number = BASELINE_BRUSH_TIP_ANGLE_DEGREES;
  #brushTipDirectionDegrees: number = BASELINE_BRUSH_TIP_DIRECTION_DEGREES;
  #brushFollowStrokeRotation = false;
  #brushPenOrientationEnabled = false;
  #brushTipSelectionMode: BaselineBrushTipSelectionModeV1 = 'fixed';
  #brushSampledTipAlphas: readonly BaselineBrushSampledTipAlphaV1[] = Object.freeze([]);
  #brushTipSelectionStartIndex = 0;
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
      brushTipDensity: this.#brushTipDensity,
      brushSpacingRatio: this.#brushSpacingRatio,
      brushMinimumStampDistancePx: this.#brushMinimumStampDistancePx,
      brushStartTaperLengthPx: this.#brushStartTaperLengthPx,
      brushEndTaperLengthPx: this.#brushEndTaperLengthPx,
      brushSizeTaperMinimumRatio: this.#brushSizeTaperMinimumRatio,
      brushOpacityTaperMinimumRatio: this.#brushOpacityTaperMinimumRatio,
      brushForceStartTaper: this.#brushForceStartTaper,
      brushForceEndTaper: this.#brushForceEndTaper,
      brushRealtimeStabilizationAmount: this.#brushRealtimeStabilizationAmount,
      brushPostStrokeCorrectionAmount: this.#brushPostStrokeCorrectionAmount,
      brushTextureResourceKind: this.#brushTextureResourceKind,
      brushTextureResourceSubtype: this.#brushTextureResourceSubtype,
      brushTextureResourceId: this.#brushTextureResourceId,
      brushTextureStrength: this.#brushTextureStrength,
      brushTextureScale: this.#brushTextureScale,
      brushTextureRotationDegrees: this.#brushTextureRotationDegrees,
      brushTextureBlendMode: this.#brushTextureBlendMode,
      brushPressureSizeEnabled: this.#brushPressureSizeEnabled,
      brushPressureOpacityEnabled: this.#brushPressureOpacityEnabled,
      brushPressureFlowEnabled: this.#brushPressureFlowEnabled,
      brushPressureResponseCurve: this.#brushPressureResponseCurve,
      brushTiltSizeEnabled: this.#brushTiltSizeEnabled,
      brushTiltOpacityEnabled: this.#brushTiltOpacityEnabled,
      brushTiltFlowEnabled: this.#brushTiltFlowEnabled,
      brushTiltResponseCurve: this.#brushTiltResponseCurve,
      brushVelocitySizeEnabled: this.#brushVelocitySizeEnabled,
      brushVelocityOpacityEnabled: this.#brushVelocityOpacityEnabled,
      brushVelocityFlowEnabled: this.#brushVelocityFlowEnabled,
      brushVelocityResponseCurve: this.#brushVelocityResponseCurve,
      brushVelocityMaximumPxPerSecond: this.#brushVelocityMaximumPxPerSecond,
      brushRandomSizeEnabled: this.#brushRandomSizeEnabled,
      brushRandomOpacityEnabled: this.#brushRandomOpacityEnabled,
      brushRandomFlowEnabled: this.#brushRandomFlowEnabled,
      brushRandomResponseCurve: this.#brushRandomResponseCurve,
      brushSizeMinimumResponse: this.#brushSizeMinimumResponse,
      brushOpacityMinimumResponse: this.#brushOpacityMinimumResponse,
      brushFlowMinimumResponse: this.#brushFlowMinimumResponse,
      brushTipAngleDegrees: this.#brushTipAngleDegrees,
      brushTipDirectionDegrees: this.#brushTipDirectionDegrees,
      brushFollowStrokeRotation: this.#brushFollowStrokeRotation,
      brushPenOrientationEnabled: this.#brushPenOrientationEnabled,
      brushTipSelectionMode: this.#brushTipSelectionMode,
      brushTipAlternativeCount: this.#brushSampledTipAlphas.length,
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
  setBrushTipDensity(density: number): number {
    if (!Number.isFinite(density) || density < 0 || density > 1) {
      throw new RangeError('invalid runtime brush tip density');
    }
    if (density !== this.#brushTipDensity) this.#clearActiveStroke();
    this.#brushTipDensity = density;
    return this.#brushTipDensity;
  }

  brushTipDensity(): number {
    return this.#brushTipDensity;
  }

  setBrushSpacing(spacingRatio: number, minimumStampDistancePx: number): number {
    if (!Number.isFinite(spacingRatio) || spacingRatio < 0.01 || spacingRatio > 4) {
      throw new RangeError('invalid runtime brush spacing ratio');
    }
    if (
      !Number.isFinite(minimumStampDistancePx) ||
      minimumStampDistancePx <= 0 ||
      minimumStampDistancePx > 4096
    ) {
      throw new RangeError('invalid runtime minimum stamp distance');
    }
    if (
      spacingRatio !== this.#brushSpacingRatio ||
      minimumStampDistancePx !== this.#brushMinimumStampDistancePx
    ) {
      this.#clearActiveStroke();
    }
    this.#brushSpacingRatio = spacingRatio;
    this.#brushMinimumStampDistancePx = minimumStampDistancePx;
    return this.#brushSpacingRatio;
  }

  brushSpacingRatio(): number {
    return this.#brushSpacingRatio;
  }

  setBrushStartTaperLengthPx(lengthPx: number): number {
    if (!Number.isFinite(lengthPx) || lengthPx < 0 || lengthPx > 4096) {
      throw new RangeError('invalid runtime brush start taper length');
    }
    if (lengthPx !== this.#brushStartTaperLengthPx) this.#clearActiveStroke();
    this.#brushStartTaperLengthPx = lengthPx;
    return this.#brushStartTaperLengthPx;
  }

  brushStartTaperLengthPx(): number {
    return this.#brushStartTaperLengthPx;
  }

  setBrushEndTaperLengthPx(lengthPx: number): number {
    if (!Number.isFinite(lengthPx) || lengthPx < 0 || lengthPx > 4096) {
      throw new RangeError('invalid runtime brush end taper length');
    }
    if (lengthPx !== this.#brushEndTaperLengthPx) this.#clearActiveStroke();
    this.#brushEndTaperLengthPx = lengthPx;
    return this.#brushEndTaperLengthPx;
  }

  brushEndTaperLengthPx(): number {
    return this.#brushEndTaperLengthPx;
  }

  setBrushSizeTaperMinimumRatio(minimumRatio: number): number {
    if (!Number.isFinite(minimumRatio) || minimumRatio < 0 || minimumRatio > 1) {
      throw new RangeError('invalid runtime brush size taper minimum ratio');
    }
    if (minimumRatio !== this.#brushSizeTaperMinimumRatio) this.#clearActiveStroke();
    this.#brushSizeTaperMinimumRatio = minimumRatio;
    return this.#brushSizeTaperMinimumRatio;
  }

  brushSizeTaperMinimumRatio(): number {
    return this.#brushSizeTaperMinimumRatio;
  }

  setBrushOpacityTaperMinimumRatio(minimumRatio: number): number {
    if (!Number.isFinite(minimumRatio) || minimumRatio < 0 || minimumRatio > 1) {
      throw new RangeError('invalid runtime brush opacity taper minimum ratio');
    }
    if (minimumRatio !== this.#brushOpacityTaperMinimumRatio) this.#clearActiveStroke();
    this.#brushOpacityTaperMinimumRatio = minimumRatio;
    return this.#brushOpacityTaperMinimumRatio;
  }

  brushOpacityTaperMinimumRatio(): number {
    return this.#brushOpacityTaperMinimumRatio;
  }

  setBrushForcedTaper(
    forceStart: boolean,
    forceEnd: boolean,
  ): Readonly<{ start: boolean; end: boolean }> {
    if (typeof forceStart !== 'boolean' || typeof forceEnd !== 'boolean') {
      throw new TypeError('invalid runtime forced taper flags');
    }
    if (forceStart !== this.#brushForceStartTaper || forceEnd !== this.#brushForceEndTaper) {
      this.#clearActiveStroke();
    }
    this.#brushForceStartTaper = forceStart;
    this.#brushForceEndTaper = forceEnd;
    return Object.freeze({ start: forceStart, end: forceEnd });
  }

  brushForcedTaper(): Readonly<{ start: boolean; end: boolean }> {
    return Object.freeze({ start: this.#brushForceStartTaper, end: this.#brushForceEndTaper });
  }

  setBrushRealtimeStabilizationAmount(amount: number): number {
    if (!Number.isFinite(amount) || amount < 0 || amount > 1) {
      throw new RangeError('invalid runtime real-time stabilization amount');
    }
    if (amount !== this.#brushRealtimeStabilizationAmount) this.#clearActiveStroke();
    this.#brushRealtimeStabilizationAmount = amount;
    return this.#brushRealtimeStabilizationAmount;
  }

  brushRealtimeStabilizationAmount(): number {
    return this.#brushRealtimeStabilizationAmount;
  }

  setBrushPostStrokeCorrectionAmount(amount: number): number {
    if (!Number.isFinite(amount) || amount < 0 || amount > 1) {
      throw new RangeError('invalid runtime post-stroke correction amount');
    }
    if (amount !== this.#brushPostStrokeCorrectionAmount) this.#clearActiveStroke();
    this.#brushPostStrokeCorrectionAmount = amount;
    return this.#brushPostStrokeCorrectionAmount;
  }

  brushPostStrokeCorrectionAmount(): number {
    return this.#brushPostStrokeCorrectionAmount;
  }

  setBrushGrainResourceId(resourceId: string | null): string | null {
    const normalized =
      resourceId === null
        ? null
        : (() => {
            if (typeof resourceId !== 'string')
              throw new TypeError('runtime grain resource id must be text');
            const value = resourceId.trim();
            if (value.length < 1 || value.length > 160) {
              throw new RangeError('runtime grain resource id must be 1..160 characters');
            }
            return value;
          })();
    if (
      this.#brushTextureResourceKind !== (normalized === null ? null : 'grain') ||
      this.#brushTextureResourceSubtype !== (normalized === null ? null : 'grain') ||
      this.#brushTextureResourceId !== normalized
    ) {
      this.#clearActiveStroke();
    }
    this.#brushTextureResourceKind = normalized === null ? null : 'grain';
    this.#brushTextureResourceSubtype = normalized === null ? null : 'grain';
    this.#brushTextureResourceId = normalized;
    return this.#brushTextureResourceId;
  }

  brushGrainResourceId(): string | null {
    return this.#brushTextureResourceKind === 'grain' &&
      this.#brushTextureResourceSubtype !== 'paper'
      ? this.#brushTextureResourceId
      : null;
  }

  setBrushPaperTextureResourceId(resourceId: string | null): string | null {
    const normalized =
      resourceId === null
        ? null
        : (() => {
            if (typeof resourceId !== 'string')
              throw new TypeError('runtime paper resource id must be text');
            const value = resourceId.trim();
            if (value.length < 1 || value.length > 160) {
              throw new RangeError('runtime paper resource id must be 1..160 characters');
            }
            return value;
          })();
    if (
      this.#brushTextureResourceKind !== (normalized === null ? null : 'grain') ||
      this.#brushTextureResourceSubtype !== (normalized === null ? null : 'paper') ||
      this.#brushTextureResourceId !== normalized
    ) {
      this.#clearActiveStroke();
    }
    this.#brushTextureResourceKind = normalized === null ? null : 'grain';
    this.#brushTextureResourceSubtype = normalized === null ? null : 'paper';
    this.#brushTextureResourceId = normalized;
    return this.#brushTextureResourceId;
  }

  brushPaperTextureResourceId(): string | null {
    return this.#brushTextureResourceKind === 'grain' &&
      this.#brushTextureResourceSubtype === 'paper'
      ? this.#brushTextureResourceId
      : null;
  }

  setBrushTextureStrength(strength: number): number {
    if (!Number.isFinite(strength) || strength < 0 || strength > 1) {
      throw new RangeError('invalid runtime brush texture strength');
    }
    if (strength !== this.#brushTextureStrength) this.#clearActiveStroke();
    this.#brushTextureStrength = strength;
    return this.#brushTextureStrength;
  }

  brushTextureStrength(): number {
    return this.#brushTextureStrength;
  }

  setBrushTextureScale(scale: number): number {
    if (!Number.isFinite(scale) || scale < 0.01 || scale > 16) {
      throw new RangeError('invalid runtime brush texture scale');
    }
    if (scale !== this.#brushTextureScale) this.#clearActiveStroke();
    this.#brushTextureScale = scale;
    return this.#brushTextureScale;
  }

  brushTextureScale(): number {
    return this.#brushTextureScale;
  }

  setBrushTextureRotationDegrees(rotationDegrees: number): number {
    if (!Number.isFinite(rotationDegrees)) {
      throw new TypeError('invalid runtime brush texture rotation');
    }
    const normalized = ((rotationDegrees % 360) + 360) % 360;
    const value = Object.is(normalized, -0) ? 0 : normalized;
    if (value !== this.#brushTextureRotationDegrees) this.#clearActiveStroke();
    this.#brushTextureRotationDegrees = value;
    return this.#brushTextureRotationDegrees;
  }

  brushTextureRotationDegrees(): number {
    return this.#brushTextureRotationDegrees;
  }

  setBrushTextureBlendMode(blendMode: BrushTextureBlendModeV1): BrushTextureBlendModeV1 {
    if (blendMode !== 'multiply' && blendMode !== 'subtract' && blendMode !== 'add') {
      throw new TypeError('unsupported runtime brush texture blend mode');
    }
    if (blendMode !== this.#brushTextureBlendMode) this.#clearActiveStroke();
    this.#brushTextureBlendMode = blendMode;
    return this.#brushTextureBlendMode;
  }

  brushTextureBlendMode(): BrushTextureBlendModeV1 {
    return this.#brushTextureBlendMode;
  }

  setBrushPressureSizeEnabled(enabled: boolean): boolean {
    if (typeof enabled !== 'boolean') throw new TypeError('invalid runtime pressure-size flag');
    if (enabled !== this.#brushPressureSizeEnabled) this.#clearActiveStroke();
    this.#brushPressureSizeEnabled = enabled;
    return this.#brushPressureSizeEnabled;
  }

  brushPressureSizeEnabled(): boolean {
    return this.#brushPressureSizeEnabled;
  }

  setBrushPressureOpacityEnabled(enabled: boolean): boolean {
    if (typeof enabled !== 'boolean') throw new TypeError('invalid runtime pressure-opacity flag');
    if (enabled !== this.#brushPressureOpacityEnabled) this.#clearActiveStroke();
    this.#brushPressureOpacityEnabled = enabled;
    return this.#brushPressureOpacityEnabled;
  }

  brushPressureOpacityEnabled(): boolean {
    return this.#brushPressureOpacityEnabled;
  }

  setBrushPressureFlowEnabled(enabled: boolean): boolean {
    if (typeof enabled !== 'boolean') throw new TypeError('invalid runtime pressure-flow flag');
    if (enabled !== this.#brushPressureFlowEnabled) this.#clearActiveStroke();
    this.#brushPressureFlowEnabled = enabled;
    return this.#brushPressureFlowEnabled;
  }

  brushPressureFlowEnabled(): boolean {
    return this.#brushPressureFlowEnabled;
  }

  setBrushPressureResponseCurve(
    curve: readonly ResponseCurvePointV1[],
  ): readonly ResponseCurvePointV1[] {
    const normalized = normalizeResponseCurveV1(curve);
    if (!responseCurveEqualsV1(normalized, this.#brushPressureResponseCurve))
      this.#clearActiveStroke();
    this.#brushPressureResponseCurve = normalized;
    return this.#brushPressureResponseCurve;
  }

  brushPressureResponseCurve(): readonly ResponseCurvePointV1[] {
    return this.#brushPressureResponseCurve;
  }

  setBrushTiltSizeEnabled(enabled: boolean): boolean {
    if (typeof enabled !== 'boolean') throw new TypeError('invalid runtime tilt-size flag');
    if (enabled !== this.#brushTiltSizeEnabled) this.#clearActiveStroke();
    this.#brushTiltSizeEnabled = enabled;
    return this.#brushTiltSizeEnabled;
  }

  brushTiltSizeEnabled(): boolean {
    return this.#brushTiltSizeEnabled;
  }

  setBrushTiltOpacityEnabled(enabled: boolean): boolean {
    if (typeof enabled !== 'boolean') throw new TypeError('invalid runtime tilt-opacity flag');
    if (enabled !== this.#brushTiltOpacityEnabled) this.#clearActiveStroke();
    this.#brushTiltOpacityEnabled = enabled;
    return this.#brushTiltOpacityEnabled;
  }

  brushTiltOpacityEnabled(): boolean {
    return this.#brushTiltOpacityEnabled;
  }

  setBrushTiltFlowEnabled(enabled: boolean): boolean {
    if (typeof enabled !== 'boolean') throw new TypeError('invalid runtime tilt-flow flag');
    if (enabled !== this.#brushTiltFlowEnabled) this.#clearActiveStroke();
    this.#brushTiltFlowEnabled = enabled;
    return this.#brushTiltFlowEnabled;
  }

  brushTiltFlowEnabled(): boolean {
    return this.#brushTiltFlowEnabled;
  }

  setBrushTiltResponseCurve(
    curve: readonly ResponseCurvePointV1[],
  ): readonly ResponseCurvePointV1[] {
    const normalized = normalizeResponseCurveV1(curve);
    if (!responseCurveEqualsV1(normalized, this.#brushTiltResponseCurve)) this.#clearActiveStroke();
    this.#brushTiltResponseCurve = normalized;
    return this.#brushTiltResponseCurve;
  }

  brushTiltResponseCurve(): readonly ResponseCurvePointV1[] {
    return this.#brushTiltResponseCurve;
  }

  setBrushVelocitySizeEnabled(enabled: boolean): boolean {
    if (typeof enabled !== 'boolean') throw new TypeError('invalid runtime velocity-size flag');
    if (enabled !== this.#brushVelocitySizeEnabled) this.#clearActiveStroke();
    this.#brushVelocitySizeEnabled = enabled;
    return this.#brushVelocitySizeEnabled;
  }

  brushVelocitySizeEnabled(): boolean {
    return this.#brushVelocitySizeEnabled;
  }

  setBrushVelocityOpacityEnabled(enabled: boolean): boolean {
    if (typeof enabled !== 'boolean') throw new TypeError('invalid runtime velocity-opacity flag');
    if (enabled !== this.#brushVelocityOpacityEnabled) this.#clearActiveStroke();
    this.#brushVelocityOpacityEnabled = enabled;
    return this.#brushVelocityOpacityEnabled;
  }

  brushVelocityOpacityEnabled(): boolean {
    return this.#brushVelocityOpacityEnabled;
  }

  setBrushVelocityFlowEnabled(enabled: boolean): boolean {
    if (typeof enabled !== 'boolean') throw new TypeError('invalid runtime velocity-flow flag');
    if (enabled !== this.#brushVelocityFlowEnabled) this.#clearActiveStroke();
    this.#brushVelocityFlowEnabled = enabled;
    return this.#brushVelocityFlowEnabled;
  }

  brushVelocityFlowEnabled(): boolean {
    return this.#brushVelocityFlowEnabled;
  }

  setBrushVelocityResponseCurve(
    curve: readonly ResponseCurvePointV1[],
  ): readonly ResponseCurvePointV1[] {
    const normalized = normalizeResponseCurveV1(curve);
    if (!responseCurveEqualsV1(normalized, this.#brushVelocityResponseCurve))
      this.#clearActiveStroke();
    this.#brushVelocityResponseCurve = normalized;
    return this.#brushVelocityResponseCurve;
  }

  brushVelocityResponseCurve(): readonly ResponseCurvePointV1[] {
    return this.#brushVelocityResponseCurve;
  }

  setBrushVelocityMaximumPxPerSecond(maximumPxPerSecond: number): number {
    if (
      !Number.isFinite(maximumPxPerSecond) ||
      maximumPxPerSecond < MIN_BRUSH_VELOCITY_MAXIMUM_PX_PER_SECOND_V1 ||
      maximumPxPerSecond > MAX_BRUSH_VELOCITY_MAXIMUM_PX_PER_SECOND_V1
    ) {
      throw new RangeError('invalid runtime velocity maximum');
    }
    if (maximumPxPerSecond !== this.#brushVelocityMaximumPxPerSecond) this.#clearActiveStroke();
    this.#brushVelocityMaximumPxPerSecond = maximumPxPerSecond;
    return this.#brushVelocityMaximumPxPerSecond;
  }

  brushVelocityMaximumPxPerSecond(): number {
    return this.#brushVelocityMaximumPxPerSecond;
  }

  setBrushRandomSizeEnabled(enabled: boolean): boolean {
    if (typeof enabled !== 'boolean') throw new TypeError('invalid runtime random-size flag');
    if (enabled !== this.#brushRandomSizeEnabled) this.#clearActiveStroke();
    this.#brushRandomSizeEnabled = enabled;
    return this.#brushRandomSizeEnabled;
  }

  brushRandomSizeEnabled(): boolean {
    return this.#brushRandomSizeEnabled;
  }

  setBrushRandomOpacityEnabled(enabled: boolean): boolean {
    if (typeof enabled !== 'boolean') throw new TypeError('invalid runtime random-opacity flag');
    if (enabled !== this.#brushRandomOpacityEnabled) this.#clearActiveStroke();
    this.#brushRandomOpacityEnabled = enabled;
    return this.#brushRandomOpacityEnabled;
  }

  brushRandomOpacityEnabled(): boolean {
    return this.#brushRandomOpacityEnabled;
  }

  setBrushRandomFlowEnabled(enabled: boolean): boolean {
    if (typeof enabled !== 'boolean') throw new TypeError('invalid runtime random-flow flag');
    if (enabled !== this.#brushRandomFlowEnabled) this.#clearActiveStroke();
    this.#brushRandomFlowEnabled = enabled;
    return this.#brushRandomFlowEnabled;
  }

  brushRandomFlowEnabled(): boolean {
    return this.#brushRandomFlowEnabled;
  }

  setBrushRandomResponseCurve(
    curve: readonly ResponseCurvePointV1[],
  ): readonly ResponseCurvePointV1[] {
    const normalized = normalizeResponseCurveV1(curve);
    if (!responseCurveEqualsV1(normalized, this.#brushRandomResponseCurve))
      this.#clearActiveStroke();
    this.#brushRandomResponseCurve = normalized;
    return this.#brushRandomResponseCurve;
  }

  brushRandomResponseCurve(): readonly ResponseCurvePointV1[] {
    return this.#brushRandomResponseCurve;
  }

  setBrushSizeMinimumResponse(minimumResponse: number): number {
    if (!Number.isFinite(minimumResponse) || minimumResponse < 0 || minimumResponse > 1) {
      throw new RangeError('invalid runtime size minimum response');
    }
    if (minimumResponse !== this.#brushSizeMinimumResponse) this.#clearActiveStroke();
    this.#brushSizeMinimumResponse = minimumResponse;
    return this.#brushSizeMinimumResponse;
  }

  brushSizeMinimumResponse(): number {
    return this.#brushSizeMinimumResponse;
  }

  setBrushOpacityMinimumResponse(minimumResponse: number): number {
    if (!Number.isFinite(minimumResponse) || minimumResponse < 0 || minimumResponse > 1) {
      throw new RangeError('invalid runtime opacity minimum response');
    }
    if (minimumResponse !== this.#brushOpacityMinimumResponse) this.#clearActiveStroke();
    this.#brushOpacityMinimumResponse = minimumResponse;
    return this.#brushOpacityMinimumResponse;
  }

  brushOpacityMinimumResponse(): number {
    return this.#brushOpacityMinimumResponse;
  }

  setBrushFlowMinimumResponse(minimumResponse: number): number {
    if (!Number.isFinite(minimumResponse) || minimumResponse < 0 || minimumResponse > 1) {
      throw new RangeError('invalid runtime flow minimum response');
    }
    if (minimumResponse !== this.#brushFlowMinimumResponse) this.#clearActiveStroke();
    this.#brushFlowMinimumResponse = minimumResponse;
    return this.#brushFlowMinimumResponse;
  }

  brushFlowMinimumResponse(): number {
    return this.#brushFlowMinimumResponse;
  }

  setBrushTipAngleDegrees(angleDegrees: number): number {
    const normalized = normalizeBaselineBrushTipAngleDegreesV1(angleDegrees);
    if (normalized !== this.#brushTipAngleDegrees) this.#clearActiveStroke();
    this.#brushTipAngleDegrees = normalized;
    return this.#brushTipAngleDegrees;
  }

  brushTipAngleDegrees(): number {
    return this.#brushTipAngleDegrees;
  }

  setBrushTipDirectionDegrees(directionDegrees: number): number {
    const normalized = normalizeBaselineBrushTipAngleDegreesV1(directionDegrees);
    if (normalized !== this.#brushTipDirectionDegrees) this.#clearActiveStroke();
    this.#brushTipDirectionDegrees = normalized;
    return this.#brushTipDirectionDegrees;
  }

  brushTipDirectionDegrees(): number {
    return this.#brushTipDirectionDegrees;
  }

  setBrushFollowStrokeRotation(enabled: boolean): boolean {
    if (typeof enabled !== 'boolean') throw new TypeError('invalid runtime follow rotation');
    if (enabled !== this.#brushFollowStrokeRotation) this.#clearActiveStroke();
    this.#brushFollowStrokeRotation = enabled;
    return this.#brushFollowStrokeRotation;
  }

  brushFollowStrokeRotation(): boolean {
    return this.#brushFollowStrokeRotation;
  }

  setBrushPenOrientationEnabled(enabled: boolean): boolean {
    if (typeof enabled !== 'boolean') throw new TypeError('invalid runtime pen orientation flag');
    if (enabled !== this.#brushPenOrientationEnabled) this.#clearActiveStroke();
    this.#brushPenOrientationEnabled = enabled;
    return this.#brushPenOrientationEnabled;
  }

  brushPenOrientationEnabled(): boolean {
    return this.#brushPenOrientationEnabled;
  }

  setBrushTipSelection(
    mode: BaselineBrushTipSelectionModeV1,
    sampledTipAlphas: readonly (readonly number[])[],
    startIndex = 0,
  ): BaselineBrushTipSelectionModeV1 {
    if (mode !== 'fixed' && mode !== 'sequence' && mode !== 'random-per-stamp') {
      throw new TypeError('unsupported runtime brush tip selection mode');
    }
    if (sampledTipAlphas.length > 64)
      throw new RangeError('too many runtime brush tip alternatives');
    const normalized = Object.freeze(
      sampledTipAlphas.map((alpha) => freezeBaselineBrushSampledTipAlphaV1(alpha)),
    );
    const normalizedStartIndex = normalized.length === 0 ? 0 : startIndex;
    if (
      !Number.isSafeInteger(normalizedStartIndex) ||
      normalizedStartIndex < 0 ||
      (normalized.length > 0 && normalizedStartIndex >= normalized.length)
    ) {
      throw new RangeError('runtime brush tip selection start index is out of range');
    }
    if (
      mode !== this.#brushTipSelectionMode ||
      normalizedStartIndex !== this.#brushTipSelectionStartIndex ||
      !equalSampledTipAlphaSetsV1(normalized, this.#brushSampledTipAlphas)
    ) {
      this.#clearActiveStroke();
    }
    this.#brushTipSelectionMode = mode;
    this.#brushSampledTipAlphas = normalized;
    this.#brushTipSelectionStartIndex = normalizedStartIndex;
    return this.#brushTipSelectionMode;
  }

  brushTipSelectionMode(): BaselineBrushTipSelectionModeV1 {
    return this.#brushTipSelectionMode;
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
      this.#appendConfirmedSamples(batch, batch.eventType === 'pointerup');
    }

    if (batch.eventType === 'pointerup') {
      const completed = this.activeStroke();
      const builder = this.#activeBrushStroke;
      const createBrush = this.#activeBrushFactory;
      if (completed !== null && builder !== null) {
        builder.finishConfirmed();
        let finalDabs = builder.dabs();
        if (
          this.#brushPostStrokeCorrectionAmount > 0 &&
          createBrush !== null &&
          this.#activeSamples.length >= 3
        ) {
          const replayStabilizer = new RealtimeBrushStabilizerV1(
            this.#activeRealtimeStabilizer?.amount() ?? this.#brushRealtimeStabilizationAmount,
          );
          const replayVelocities = velocitySeriesV1(
            this.#activeSamples,
            this.#brushVelocityMaximumPxPerSecond,
          ).values;
          const liveGeometry = this.#activeSamples.map((sample, index) => {
            const point = replayStabilizer.push(sample);
            return Object.freeze({
              ...point,
              pressure: completed.source === 'pen' ? sample.pressure : 1,
              velocity: replayVelocities[index] ?? 0,
              tiltX: completed.source === 'pen' ? sample.tiltX : 0,
              tiltY: completed.source === 'pen' ? sample.tiltY : 0,
              altitudeAngle: completed.source === 'pen' ? sample.altitudeAngle : Math.PI / 2,
              azimuthAngle: completed.source === 'pen' ? sample.azimuthAngle : 0,
              twist: completed.source === 'pen' ? sample.twist : 0,
            });
          });
          const rawEndpoint = this.#activeSamples.at(-1);
          if (rawEndpoint !== undefined) {
            const releasePoint = replayStabilizer.release(rawEndpoint);
            if (releasePoint !== null) {
              liveGeometry.push(
                Object.freeze({
                  ...releasePoint,
                  pressure: completed.source === 'pen' ? rawEndpoint.pressure : 1,
                  velocity: replayVelocities.at(-1) ?? 0,
                  tiltX: completed.source === 'pen' ? rawEndpoint.tiltX : 0,
                  tiltY: completed.source === 'pen' ? rawEndpoint.tiltY : 0,
                  altitudeAngle:
                    completed.source === 'pen' ? rawEndpoint.altitudeAngle : Math.PI / 2,
                  azimuthAngle: completed.source === 'pen' ? rawEndpoint.azimuthAngle : 0,
                  twist: completed.source === 'pen' ? rawEndpoint.twist : 0,
                }),
              );
            }
          }
          const correctedGeometry = correctPostStrokeGeometryV1(
            liveGeometry,
            this.#brushPostStrokeCorrectionAmount,
          );
          const correctedSamples = correctedGeometry.map((point, index) =>
            Object.freeze({
              ...point,
              pressure: liveGeometry[index]?.pressure ?? 1,
              velocity: liveGeometry[index]?.velocity ?? 0,
              tiltX: liveGeometry[index]?.tiltX ?? 0,
              tiltY: liveGeometry[index]?.tiltY ?? 0,
              altitudeAngle: liveGeometry[index]?.altitudeAngle ?? Math.PI / 2,
              azimuthAngle: liveGeometry[index]?.azimuthAngle ?? 0,
              twist: liveGeometry[index]?.twist ?? 0,
            }),
          );
          const firstCorrected = correctedSamples[0];
          if (firstCorrected !== undefined) {
            const correctedBuilder = createBrush();
            correctedBuilder.beginConfirmed(firstCorrected);
            correctedBuilder.appendConfirmed(correctedSamples.slice(1));
            correctedBuilder.finishConfirmed();
            finalDabs = correctedBuilder.dabs();
          }
        }
        this.#completedStrokes.push(freezeCompletedStroke(completed, finalDabs));
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
    const strokeId = crypto.randomUUID();
    const randomDynamicsEnabled =
      this.#brushRandomSizeEnabled ||
      this.#brushRandomOpacityEnabled ||
      this.#brushRandomFlowEnabled;
    const randomSeed =
      this.#brushTipSelectionMode === 'random-per-stamp' || randomDynamicsEnabled
        ? deterministicPaintStrokeSeedV1(strokeId)
        : undefined;
    this.#activeStroke = Object.freeze({
      schema: 'illustro.paint-stroke/1' as const,
      strokeId,
      pointerId: batch.pointerId,
      source,
      layerId,
      brushMode: this.#brushMode,
      ...(randomSeed === undefined ? {} : { randomSeed }),
      samples: Object.freeze([]),
    });
    const stabilizer = new RealtimeBrushStabilizerV1(this.#brushRealtimeStabilizationAmount);
    const velocitySeries = velocitySeriesV1(samples, this.#brushVelocityMaximumPxPerSecond);
    this.#activeVelocity = velocitySeries.lastVelocity;
    const stabilizedSamples = samples.map((sample, index) => {
      const point = stabilizer.push(sample);
      return Object.freeze({
        ...point,
        pressure: source === 'pen' ? sample.pressure : 1,
        velocity: velocitySeries.values[index] ?? 0,
        tiltX: source === 'pen' ? sample.tiltX : 0,
        tiltY: source === 'pen' ? sample.tiltY : 0,
        altitudeAngle: source === 'pen' ? sample.altitudeAngle : Math.PI / 2,
        azimuthAngle: source === 'pen' ? sample.azimuthAngle : 0,
        twist: source === 'pen' ? sample.twist : 0,
      });
    });
    const firstStabilizedSample = stabilizedSamples[0];
    if (firstStabilizedSample === undefined) return;
    this.#activeRealtimeStabilizer = stabilizer;
    const parameters = this.#brushParameters;
    const createBrush = (): CanonicalRasterBrushStrokeV1 =>
      new CanonicalRasterBrushStrokeV1({
        color: this.#paintColor,
        mode: this.#brushMode,
        sizePx: parameters.sizePx,
        opacity: parameters.opacity,
        flow: parameters.flow,
        spacingRatio: this.#brushSpacingRatio,
        minimumStampDistancePx: this.#brushMinimumStampDistancePx,
        startTaperLengthPx: this.#brushStartTaperLengthPx,
        endTaperLengthPx: this.#brushEndTaperLengthPx,
        sizeTaperMinimumRatio: this.#brushSizeTaperMinimumRatio,
        opacityTaperMinimumRatio: this.#brushOpacityTaperMinimumRatio,
        forceStartTaper: this.#brushForceStartTaper,
        forceEndTaper: this.#brushForceEndTaper,
        pressureSizeEnabled: this.#brushPressureSizeEnabled,
        pressureOpacityEnabled: this.#brushPressureOpacityEnabled,
        pressureFlowEnabled: this.#brushPressureFlowEnabled,
        pressureResponseCurve: this.#brushPressureResponseCurve,
        tiltSizeEnabled: this.#brushTiltSizeEnabled,
        tiltOpacityEnabled: this.#brushTiltOpacityEnabled,
        tiltFlowEnabled: this.#brushTiltFlowEnabled,
        tiltResponseCurve: this.#brushTiltResponseCurve,
        velocitySizeEnabled: this.#brushVelocitySizeEnabled,
        velocityOpacityEnabled: this.#brushVelocityOpacityEnabled,
        velocityFlowEnabled: this.#brushVelocityFlowEnabled,
        velocityResponseCurve: this.#brushVelocityResponseCurve,
        randomSizeEnabled: this.#brushRandomSizeEnabled,
        randomOpacityEnabled: this.#brushRandomOpacityEnabled,
        randomFlowEnabled: this.#brushRandomFlowEnabled,
        randomResponseCurve: this.#brushRandomResponseCurve,
        sizeMinimumResponse: this.#brushSizeMinimumResponse,
        opacityMinimumResponse: this.#brushOpacityMinimumResponse,
        flowMinimumResponse: this.#brushFlowMinimumResponse,
        randomSeed: randomSeed ?? 0,
        hardness: this.#brushHardness,
        tipAngleDegrees: this.#brushTipAngleDegrees,
        tipDirectionDegrees: this.#brushTipDirectionDegrees,
        followStrokeRotation: this.#brushFollowStrokeRotation,
        penOrientationEnabled: this.#brushPenOrientationEnabled,
        tipDensity: this.#brushTipDensity,
        tipShape: this.#brushTipShape,
        tipSelectionMode: this.#brushTipSelectionMode,
        tipSelectionStartIndex: this.#brushTipSelectionStartIndex,
        tipSelectionSeed: randomSeed ?? 0,
        ...(this.#brushSampledTipAlpha === null
          ? {}
          : { sampledTipAlpha: this.#brushSampledTipAlpha }),
        ...(this.#brushSampledTipAlphas.length === 0
          ? {}
          : { sampledTipAlphas: this.#brushSampledTipAlphas }),
      });
    const builder = createBrush();
    this.#activeBrushFactory = createBrush;
    this.#queueActiveDabDelta(builder.beginConfirmed(firstStabilizedSample));
    this.#queueActiveDabDelta(builder.appendConfirmed(stabilizedSamples.slice(1)));
    this.#activeBrushStroke = builder;
  }

  #appendConfirmedSamples(batch: PointerInputBatchV1, release: boolean): void {
    const active = this.#activeStroke;
    const document = this.#document;
    const builder = this.#activeBrushStroke;
    const stabilizer = this.#activeRealtimeStabilizer;
    if (active === null || document === null || builder === null || stabilizer === null) return;
    const additions = batch.confirmed
      .filter((sample) => sample.pointerId === active.pointerId && sample.source === active.source)
      .map((sample) => toStrokeSample(sample, document, this.#mapPointerToDocument));
    if (additions.length === 0) return;
    const previousRawSample = this.#activeSamples.at(-1) ?? null;
    const velocitySeries = velocitySeriesV1(
      additions,
      this.#brushVelocityMaximumPxPerSecond,
      previousRawSample,
      this.#activeVelocity,
    );
    this.#activeVelocity = velocitySeries.lastVelocity;
    this.#activeSamples.push(...additions);
    const stabilizedAdditions = additions.map((sample, index) => {
      const point = stabilizer.push(sample);
      return Object.freeze({
        ...point,
        pressure: active.source === 'pen' ? sample.pressure : 1,
        velocity: velocitySeries.values[index] ?? this.#activeVelocity,
        tiltX: active.source === 'pen' ? sample.tiltX : 0,
        tiltY: active.source === 'pen' ? sample.tiltY : 0,
        altitudeAngle: active.source === 'pen' ? sample.altitudeAngle : Math.PI / 2,
        azimuthAngle: active.source === 'pen' ? sample.azimuthAngle : 0,
        twist: active.source === 'pen' ? sample.twist : 0,
      });
    });
    this.#queueActiveDabDelta(builder.appendConfirmed(stabilizedAdditions));
    if (release) {
      const rawEndpoint = additions.at(-1);
      if (rawEndpoint !== undefined) {
        const releasePoint = stabilizer.release(rawEndpoint);
        if (releasePoint !== null) {
          this.#queueActiveDabDelta(
            builder.appendConfirmed([
              Object.freeze({
                ...releasePoint,
                pressure: active.source === 'pen' ? rawEndpoint.pressure : 1,
                velocity: this.#activeVelocity,
                tiltX: active.source === 'pen' ? rawEndpoint.tiltX : 0,
                tiltY: active.source === 'pen' ? rawEndpoint.tiltY : 0,
                altitudeAngle: active.source === 'pen' ? rawEndpoint.altitudeAngle : Math.PI / 2,
                azimuthAngle: active.source === 'pen' ? rawEndpoint.azimuthAngle : 0,
                twist: active.source === 'pen' ? rawEndpoint.twist : 0,
              }),
            ]),
          );
        }
      }
    }
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
    this.#activeBrushFactory = null;
    this.#activeRealtimeStabilizer = null;
    this.#activeVelocity = 0;
    this.#activeDabDelta = Object.freeze([]);
  }
}
