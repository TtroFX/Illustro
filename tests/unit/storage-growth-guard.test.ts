import { describe, expect, it } from 'vitest';
import {
  DurableStorageGrowthGuardV1,
  estimateDurableRawBytes,
  STORAGE_METADATA_WRITE_OVERHEAD_BYTES,
  STORAGE_RAW_WRITE_OVERHEAD_BYTES,
} from '../../src/storage/storage-growth-guard.js';
import type { StorageGrowthPreflightV1 } from '../../src/storage/storage-quota.js';

class RecordingMonitor {
  readonly projected: number[] = [];

  async assertCanGrow(projectedAdditionalBytes: number): Promise<StorageGrowthPreflightV1> {
    this.projected.push(projectedAdditionalBytes);
    return {
      schema: 'illustro.storage-growth-preflight/1',
      allowed: true,
      projectedAdditionalBytes,
      projectedFreeBytes: 1_000_000_000,
      hardReserveBytes: 1,
      reason: 'safe',
      quota: {
        schema: 'illustro.storage-quota/1',
        usageBytes: 0,
        quotaBytes: 1_000_000_000,
        freeBytes: 1_000_000_000,
        warningReserveBytes: 1,
        criticalReserveBytes: 1,
        hardReserveBytes: 1,
        pressure: 'healthy',
        persisted: true,
      },
    };
  }
}

describe('durable storage growth guard', () => {
  it('adds conservative raw-write overhead before quota preflight', async () => {
    const monitor = new RecordingMonitor();
    const guard = new DurableStorageGrowthGuardV1(monitor);
    await guard.assertRawGrowth(4096);
    expect(monitor.projected).toEqual([4096 + STORAGE_RAW_WRITE_OVERHEAD_BYTES]);
    expect(estimateDurableRawBytes(4096)).toBe(4096 + STORAGE_RAW_WRITE_OVERHEAD_BYTES);
  });

  it('estimates canonical JSON plus metadata overhead before quota preflight', async () => {
    const monitor = new RecordingMonitor();
    const guard = new DurableStorageGrowthGuardV1(monitor);
    await guard.assertJsonGrowth({ value: 'abc' });
    expect(monitor.projected).toHaveLength(1);
    expect(monitor.projected[0]).toBeGreaterThan(STORAGE_METADATA_WRITE_OVERHEAD_BYTES);
  });
});
