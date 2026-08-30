import {
  estimateDurableJsonBytes,
  getStorageQuotaMonitor,
  type StorageGrowthPreflightV1,
  type StorageQuotaMonitorV1,
} from './storage-quota.js';

export const STORAGE_RAW_WRITE_OVERHEAD_BYTES = 64 * 1024;
export const STORAGE_METADATA_WRITE_OVERHEAD_BYTES = 128 * 1024;
export const STORAGE_TRANSACTION_WRITE_OVERHEAD_BYTES = 256 * 1024;

export interface StorageGrowthMonitorV1 {
  assertCanGrow(projectedAdditionalBytes: number): Promise<StorageGrowthPreflightV1>;
}

function safeProjectedBytes(byteLength: number, overheadBytes: number): number {
  if (!Number.isSafeInteger(byteLength) || byteLength < 0) {
    throw new RangeError('durable payload bytes must be a non-negative safe integer');
  }
  if (!Number.isSafeInteger(overheadBytes) || overheadBytes < 0) {
    throw new RangeError('durable overhead bytes must be a non-negative safe integer');
  }
  const projected = byteLength + overheadBytes;
  if (!Number.isSafeInteger(projected)) {
    throw new RangeError('projected durable write exceeds safe integer range');
  }
  return projected;
}

export function estimateDurableRawBytes(
  byteLength: number,
  overheadBytes = STORAGE_RAW_WRITE_OVERHEAD_BYTES,
): number {
  return safeProjectedBytes(byteLength, overheadBytes);
}

export class DurableStorageGrowthGuardV1 {
  readonly #monitor: StorageGrowthMonitorV1;

  constructor(
    monitor: StorageGrowthMonitorV1 = getStorageQuotaMonitor() as Pick<
      StorageQuotaMonitorV1,
      'assertCanGrow'
    >,
  ) {
    this.#monitor = monitor;
  }

  assertRawGrowth(
    byteLength: number,
    overheadBytes = STORAGE_RAW_WRITE_OVERHEAD_BYTES,
  ): Promise<StorageGrowthPreflightV1> {
    return this.#monitor.assertCanGrow(estimateDurableRawBytes(byteLength, overheadBytes));
  }

  assertJsonGrowth(
    value: unknown,
    overheadBytes = STORAGE_METADATA_WRITE_OVERHEAD_BYTES,
  ): Promise<StorageGrowthPreflightV1> {
    return this.#monitor.assertCanGrow(estimateDurableJsonBytes(value, overheadBytes));
  }
}

let sharedDurableStorageGrowthGuard: DurableStorageGrowthGuardV1 | null = null;

export function getDurableStorageGrowthGuard(): DurableStorageGrowthGuardV1 {
  sharedDurableStorageGrowthGuard ??= new DurableStorageGrowthGuardV1();
  return sharedDurableStorageGrowthGuard;
}
