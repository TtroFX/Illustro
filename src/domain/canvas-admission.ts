import { MAX_CANVAS_AREA, MAX_CANVAS_DIMENSION, type DocumentPrecision } from './document.js';
import {
  CANONICAL_TILE_AREA_PX,
  tileGridForDocumentV1,
} from '../gpu/sparse-tile-model.js';

export const CANVAS_ADMISSION_V1_SCHEMA = 'illustro.canvas-admission/1' as const;

export type CanvasAdmissionReasonV1 =
  | 'width-out-of-range'
  | 'height-out-of-range'
  | 'logical-area-out-of-range'
  | 'projected-touched-tiles-out-of-range'
  | 'storage-quota-unavailable'
  | 'storage-headroom-insufficient';

export type CanvasAdmissionLimitingResourceV1 =
  | 'canvas-width'
  | 'canvas-height'
  | 'logical-area'
  | 'projected-touched-tiles'
  | 'storage-quota'
  | 'storage-headroom';

export interface CanvasAdmissionStorageContextV1 {
  readonly freeBytes: number | null;
  readonly hardReserveBytes: number | null;
}

export interface CanvasAdmissionRequestV1 {
  readonly width: number;
  readonly height: number;
  readonly precision: DocumentPrecision;
  readonly projectedTouchedTiles: number;
  readonly checkpointJournalHeadroomBytes: number;
  readonly operationScratchBytes: number;
  readonly storage: CanvasAdmissionStorageContextV1;
}

export interface CanvasAdmissionEstimateV1 {
  readonly schema: typeof CANVAS_ADMISSION_V1_SCHEMA;
  readonly allowed: boolean;
  readonly width: number;
  readonly height: number;
  readonly logicalPixels: number | null;
  readonly precision: DocumentPrecision;
  readonly bytesPerPixel: 4 | 8;
  readonly totalTileCapacity: number | null;
  readonly projectedTouchedTiles: number;
  readonly canonicalTouchedTileBytes: number | null;
  readonly checkpointJournalHeadroomBytes: number;
  readonly operationScratchBytes: number;
  readonly projectedAdditionalStorageBytes: number | null;
  readonly storageFreeBytes: number | null;
  readonly storageHardReserveBytes: number | null;
  readonly availableStorageGrowthBytes: number | null;
  readonly reasons: readonly CanvasAdmissionReasonV1[];
  readonly limitingResource: CanvasAdmissionLimitingResourceV1 | null;
}

function isDimensionInRange(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 1 && value <= MAX_CANVAS_DIMENSION;
}

function assertNonNegativeSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${label} must be a non-negative safe integer`);
  }
}

function addSafeBytes(...values: readonly number[]): number {
  let total = 0;
  for (const value of values) {
    assertNonNegativeSafeInteger(value, 'admission byte estimate');
    total += value;
    if (!Number.isSafeInteger(total)) {
      throw new RangeError('canvas admission byte estimate exceeds safe integer range');
    }
  }
  return total;
}

export function bytesPerPixelForDocumentPrecisionV1(precision: DocumentPrecision): 4 | 8 {
  return precision === 'rgba16-float' ? 8 : 4;
}

export function evaluateCanvasAdmissionV1(
  request: CanvasAdmissionRequestV1,
): CanvasAdmissionEstimateV1 {
  assertNonNegativeSafeInteger(
    request.checkpointJournalHeadroomBytes,
    'checkpoint/journal headroom bytes',
  );
  assertNonNegativeSafeInteger(request.operationScratchBytes, 'operation scratch bytes');

  const reasons: CanvasAdmissionReasonV1[] = [];
  let limitingResource: CanvasAdmissionLimitingResourceV1 | null = null;

  const reject = (
    reason: CanvasAdmissionReasonV1,
    resource: CanvasAdmissionLimitingResourceV1,
  ): void => {
    reasons.push(reason);
    limitingResource ??= resource;
  };

  const widthValid = isDimensionInRange(request.width);
  const heightValid = isDimensionInRange(request.height);
  if (!widthValid) reject('width-out-of-range', 'canvas-width');
  if (!heightValid) reject('height-out-of-range', 'canvas-height');

  let logicalPixels: number | null = null;
  let totalTileCapacity: number | null = null;
  if (widthValid && heightValid) {
    logicalPixels = request.width * request.height;
    if (logicalPixels > MAX_CANVAS_AREA) {
      reject('logical-area-out-of-range', 'logical-area');
    }
    const grid = tileGridForDocumentV1(request.width, request.height);
    totalTileCapacity = grid.columns * grid.rows;
  }

  const touchedTilesValid =
    Number.isSafeInteger(request.projectedTouchedTiles) &&
    request.projectedTouchedTiles >= 0 &&
    totalTileCapacity !== null &&
    request.projectedTouchedTiles <= totalTileCapacity;
  if (!touchedTilesValid) {
    reject('projected-touched-tiles-out-of-range', 'projected-touched-tiles');
  }

  const bytesPerPixel = bytesPerPixelForDocumentPrecisionV1(request.precision);
  const canonicalTouchedTileBytes = touchedTilesValid
    ? request.projectedTouchedTiles * CANONICAL_TILE_AREA_PX * bytesPerPixel
    : null;
  const projectedAdditionalStorageBytes =
    canonicalTouchedTileBytes === null
      ? null
      : addSafeBytes(
          canonicalTouchedTileBytes,
          request.checkpointJournalHeadroomBytes,
          request.operationScratchBytes,
        );

  const freeBytes = request.storage.freeBytes;
  const hardReserveBytes = request.storage.hardReserveBytes;
  const storageKnown =
    freeBytes !== null &&
    hardReserveBytes !== null &&
    Number.isFinite(freeBytes) &&
    Number.isFinite(hardReserveBytes) &&
    freeBytes >= 0 &&
    hardReserveBytes >= 0;
  let availableStorageGrowthBytes: number | null = null;
  if (!storageKnown) {
    reject('storage-quota-unavailable', 'storage-quota');
  } else {
    availableStorageGrowthBytes = Math.max(0, freeBytes - hardReserveBytes);
    if (
      projectedAdditionalStorageBytes !== null &&
      projectedAdditionalStorageBytes > availableStorageGrowthBytes
    ) {
      reject('storage-headroom-insufficient', 'storage-headroom');
    }
  }

  return Object.freeze({
    schema: CANVAS_ADMISSION_V1_SCHEMA,
    allowed: reasons.length === 0,
    width: request.width,
    height: request.height,
    logicalPixels,
    precision: request.precision,
    bytesPerPixel,
    totalTileCapacity,
    projectedTouchedTiles: request.projectedTouchedTiles,
    canonicalTouchedTileBytes,
    checkpointJournalHeadroomBytes: request.checkpointJournalHeadroomBytes,
    operationScratchBytes: request.operationScratchBytes,
    projectedAdditionalStorageBytes,
    storageFreeBytes: freeBytes,
    storageHardReserveBytes: hardReserveBytes,
    availableStorageGrowthBytes,
    reasons: Object.freeze(reasons),
    limitingResource,
  });
}
