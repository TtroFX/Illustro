import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CANVAS_CHECKPOINT_JOURNAL_HEADROOM_BYTES_V1,
  CanvasAdmissionControllerV1,
} from '../../src/app/canvas-admission-controller.js';
import {
  bytesPerPixelForDocumentPrecisionV1,
  evaluateCanvasAdmissionV1,
} from '../../src/domain/canvas-admission.js';
import { MAX_CANVAS_AREA, MAX_CANVAS_DIMENSION } from '../../src/domain/document.js';
import { CANONICAL_TILE_AREA_PX } from '../../src/gpu/sparse-tile-model.js';
import { calculateStorageQuotaSnapshotV1 } from '../../src/storage/storage-quota.js';

const GIB = 1024 ** 3;

function healthyStorage() {
  const quota = calculateStorageQuotaSnapshotV1({ usage: GIB, quota: 4 * GIB, persisted: true });
  return Object.freeze({ freeBytes: quota.freeBytes, hardReserveBytes: quota.hardReserveBytes });
}

describe('M3 canvas admission hard bounds', () => {
  it('accepts the frozen absolute boundary examples and rejects an oversized dimension', () => {
    const accepted = evaluateCanvasAdmissionV1({
      width: MAX_CANVAS_DIMENSION,
      height: 8192,
      precision: 'rgba8-unorm',
      projectedTouchedTiles: 0,
      checkpointJournalHeadroomBytes: 0,
      operationScratchBytes: 0,
      storage: healthyStorage(),
    });
    expect(accepted.allowed).toBe(true);
    expect(accepted.logicalPixels).toBe(MAX_CANVAS_AREA);

    const rejected = evaluateCanvasAdmissionV1({
      width: MAX_CANVAS_DIMENSION + 1,
      height: 1,
      precision: 'rgba8-unorm',
      projectedTouchedTiles: 0,
      checkpointJournalHeadroomBytes: 0,
      operationScratchBytes: 0,
      storage: healthyStorage(),
    });
    expect(rejected.allowed).toBe(false);
    expect(rejected.reasons).toContain('width-out-of-range');
    expect(rejected.limitingResource).toBe('canvas-width');
  });

  it('enforces the frozen 2^28 logical-pixel area independently of per-axis bounds', () => {
    const rejected = evaluateCanvasAdmissionV1({
      width: 16385,
      height: 16384,
      precision: 'rgba8-unorm',
      projectedTouchedTiles: 0,
      checkpointJournalHeadroomBytes: 0,
      operationScratchBytes: 0,
      storage: healthyStorage(),
    });
    expect(rejected.allowed).toBe(false);
    expect(rejected.reasons).toEqual(['logical-area-out-of-range']);
    expect(rejected.limitingResource).toBe('logical-area');
  });
});

describe('M3 canvas admission resource estimation', () => {
  it('uses precision-aware sparse touched-tile cost instead of charging every logical tile', () => {
    expect(bytesPerPixelForDocumentPrecisionV1('rgba8-unorm')).toBe(4);
    expect(bytesPerPixelForDocumentPrecisionV1('rgba16-float')).toBe(8);

    const rgba8 = evaluateCanvasAdmissionV1({
      width: 4096,
      height: 4096,
      precision: 'rgba8-unorm',
      projectedTouchedTiles: 2,
      checkpointJournalHeadroomBytes: 1024,
      operationScratchBytes: 2048,
      storage: healthyStorage(),
    });
    const rgba16 = evaluateCanvasAdmissionV1({
      width: 4096,
      height: 4096,
      precision: 'rgba16-float',
      projectedTouchedTiles: 2,
      checkpointJournalHeadroomBytes: 1024,
      operationScratchBytes: 2048,
      storage: healthyStorage(),
    });

    expect(rgba8.canonicalTouchedTileBytes).toBe(2 * CANONICAL_TILE_AREA_PX * 4);
    expect(rgba16.canonicalTouchedTileBytes).toBe(2 * CANONICAL_TILE_AREA_PX * 8);
    expect(rgba8.projectedAdditionalStorageBytes).toBe(
      2 * CANONICAL_TILE_AREA_PX * 4 + 1024 + 2048,
    );
    expect(rgba8.totalTileCapacity).toBe(256);
  });

  it('rejects impossible touched-tile projections and unavailable quota evidence', () => {
    const badTiles = evaluateCanvasAdmissionV1({
      width: 256,
      height: 256,
      precision: 'rgba8-unorm',
      projectedTouchedTiles: 2,
      checkpointJournalHeadroomBytes: 0,
      operationScratchBytes: 0,
      storage: healthyStorage(),
    });
    expect(badTiles.reasons).toContain('projected-touched-tiles-out-of-range');

    const noQuota = evaluateCanvasAdmissionV1({
      width: 256,
      height: 256,
      precision: 'rgba8-unorm',
      projectedTouchedTiles: 1,
      checkpointJournalHeadroomBytes: 0,
      operationScratchBytes: 0,
      storage: Object.freeze({ freeBytes: null, hardReserveBytes: null }),
    });
    expect(noQuota.allowed).toBe(false);
    expect(noQuota.reasons).toContain('storage-quota-unavailable');
  });

  it('preserves the hard storage safety reserve after canonical, checkpoint and scratch estimates', () => {
    const storage = Object.freeze({ freeBytes: 10_000_000, hardReserveBytes: 2_000_000 });
    const result = evaluateCanvasAdmissionV1({
      width: 256,
      height: 256,
      precision: 'rgba8-unorm',
      projectedTouchedTiles: 1,
      checkpointJournalHeadroomBytes: 4_000_000,
      operationScratchBytes: 4_000_000,
      storage,
    });
    expect(result.availableStorageGrowthBytes).toBe(8_000_000);
    expect(result.projectedAdditionalStorageBytes).toBe(CANONICAL_TILE_AREA_PX * 4 + 8_000_000);
    expect(result.allowed).toBe(false);
    expect(result.reasons).toContain('storage-headroom-insufficient');
  });

  it('controller reads current quota and applies the existing M2 durable-write headroom defaults', async () => {
    const quota = calculateStorageQuotaSnapshotV1({ usage: GIB, quota: 4 * GIB, persisted: true });
    const controller = new CanvasAdmissionControllerV1({
      inspect: async () => quota,
    });
    const result = await controller.preflight({
      width: 1024,
      height: 1024,
      precision: 'rgba8-unorm',
      projectedTouchedTiles: 1,
      operationScratchBytes: 4096,
    });
    expect(result.allowed).toBe(true);
    expect(result.checkpointJournalHeadroomBytes).toBe(
      DEFAULT_CANVAS_CHECKPOINT_JOURNAL_HEADROOM_BYTES_V1,
    );
    expect(result.storageFreeBytes).toBe(quota.freeBytes);
    expect(result.storageHardReserveBytes).toBe(quota.hardReserveBytes);
  });
});
