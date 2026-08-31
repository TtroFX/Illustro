import {
  evaluateCanvasAdmissionV1,
  type CanvasAdmissionEstimateV1,
  type CanvasAdmissionRequestV1,
} from '../domain/canvas-admission.js';
import type { DocumentPrecision } from '../domain/document.js';
import { CANONICAL_TILE_AREA_PX, tileGridForDocumentV1 } from '../gpu/sparse-tile-model.js';
import {
  STORAGE_METADATA_WRITE_OVERHEAD_BYTES,
  STORAGE_RAW_WRITE_OVERHEAD_BYTES,
  STORAGE_TRANSACTION_WRITE_OVERHEAD_BYTES,
} from '../storage/storage-growth-guard.js';
import { getStorageQuotaMonitor, type StorageQuotaMonitorV1 } from '../storage/storage-quota.js';

export const DEFAULT_CANVAS_CHECKPOINT_JOURNAL_HEADROOM_BYTES_V1 =
  STORAGE_TRANSACTION_WRITE_OVERHEAD_BYTES +
  STORAGE_METADATA_WRITE_OVERHEAD_BYTES +
  STORAGE_RAW_WRITE_OVERHEAD_BYTES;

export interface CanvasAdmissionPreflightInputV1 {
  readonly width: number;
  readonly height: number;
  readonly precision: DocumentPrecision;
  readonly projectedTouchedTiles: number;
  readonly operationScratchBytes: number;
  readonly checkpointJournalHeadroomBytes?: number;
}

export interface CanvasAdmissionQuotaReaderV1 {
  inspect(): ReturnType<StorageQuotaMonitorV1['inspect']>;
}

export interface CanvasAdmissionDocumentSizeV1 {
  readonly width: number;
  readonly height: number;
  readonly precision: DocumentPrecision;
}

export interface CanvasAdmissionResizeInputV1 extends CanvasAdmissionDocumentSizeV1 {
  readonly projectedTouchedTiles: number;
}

export interface CanvasAdmissionImageImportInputV1 extends CanvasAdmissionDocumentSizeV1 {
  readonly decodedSourceBytes: number;
}

function bytesPerPixel(precision: DocumentPrecision): 4 | 8 {
  return precision === 'rgba16-float' ? 8 : 4;
}

function tiledMutationScratchBytes(precision: DocumentPrecision): number {
  return CANONICAL_TILE_AREA_PX * bytesPerPixel(precision) * 2;
}

export class CanvasAdmissionControllerV1 {
  readonly schema = 'illustro.canvas-admission-controller/1' as const;
  readonly #quota: CanvasAdmissionQuotaReaderV1;

  constructor(quota: CanvasAdmissionQuotaReaderV1 = getStorageQuotaMonitor()) {
    this.#quota = quota;
  }

  preflightDocumentCreate(
    input: CanvasAdmissionDocumentSizeV1,
  ): Promise<CanvasAdmissionEstimateV1> {
    return this.preflight({
      ...input,
      projectedTouchedTiles: 0,
      operationScratchBytes: 0,
    });
  }

  preflightDocumentResize(input: CanvasAdmissionResizeInputV1): Promise<CanvasAdmissionEstimateV1> {
    return this.preflight({
      ...input,
      operationScratchBytes: tiledMutationScratchBytes(input.precision),
    });
  }

  preflightImageImport(
    input: CanvasAdmissionImageImportInputV1,
  ): Promise<CanvasAdmissionEstimateV1> {
    if (!Number.isSafeInteger(input.decodedSourceBytes) || input.decodedSourceBytes < 0) {
      throw new RangeError('decoded image source bytes must be a non-negative safe integer');
    }
    const grid = tileGridForDocumentV1(input.width, input.height);
    return this.preflight({
      width: input.width,
      height: input.height,
      precision: input.precision,
      projectedTouchedTiles: grid.columns * grid.rows,
      operationScratchBytes: input.decodedSourceBytes,
    });
  }

  async preflight(input: CanvasAdmissionPreflightInputV1): Promise<CanvasAdmissionEstimateV1> {
    const quota = await this.#quota.inspect();
    const request: CanvasAdmissionRequestV1 = {
      width: input.width,
      height: input.height,
      precision: input.precision,
      projectedTouchedTiles: input.projectedTouchedTiles,
      checkpointJournalHeadroomBytes:
        input.checkpointJournalHeadroomBytes ?? DEFAULT_CANVAS_CHECKPOINT_JOURNAL_HEADROOM_BYTES_V1,
      operationScratchBytes: input.operationScratchBytes,
      storage: Object.freeze({
        freeBytes: quota.freeBytes,
        hardReserveBytes: quota.hardReserveBytes,
      }),
    };
    return evaluateCanvasAdmissionV1(request);
  }
}

let sharedCanvasAdmissionController: CanvasAdmissionControllerV1 | null = null;

export function getCanvasAdmissionControllerV1(): CanvasAdmissionControllerV1 {
  sharedCanvasAdmissionController ??= new CanvasAdmissionControllerV1();
  return sharedCanvasAdmissionController;
}
