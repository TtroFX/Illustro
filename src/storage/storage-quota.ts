import { serializeJson } from '../domain/serialization.js';

export const MEBIBYTE = 1024 * 1024;
export const QUOTA_WARNING_MIN_BYTES = 512 * MEBIBYTE;
export const QUOTA_CRITICAL_MIN_BYTES = 256 * MEBIBYTE;
export const QUOTA_HARD_MIN_BYTES = 128 * MEBIBYTE;

export type StoragePressureLevelV1 = 'unknown' | 'healthy' | 'warning' | 'critical' | 'hard';

export interface StorageEstimateLikeV1 {
  readonly usage?: number;
  readonly quota?: number;
}

export interface StorageManagerQuotaLikeV1 {
  estimate(): Promise<StorageEstimateLikeV1>;
  persisted?(): Promise<boolean>;
  persist?(): Promise<boolean>;
}

export interface StorageQuotaSnapshotV1 {
  readonly schema: 'illustro.storage-quota/1';
  readonly usageBytes: number | null;
  readonly quotaBytes: number | null;
  readonly freeBytes: number | null;
  readonly warningReserveBytes: number | null;
  readonly criticalReserveBytes: number | null;
  readonly hardReserveBytes: number | null;
  readonly pressure: StoragePressureLevelV1;
  readonly persisted: boolean | null;
}

export interface StorageGrowthPreflightV1 {
  readonly schema: 'illustro.storage-growth-preflight/1';
  readonly allowed: boolean;
  readonly projectedAdditionalBytes: number;
  readonly projectedFreeBytes: number | null;
  readonly hardReserveBytes: number | null;
  readonly reason: 'safe' | 'safe-export' | 'quota-unavailable' | 'hard-reserve-breach';
  readonly quota: StorageQuotaSnapshotV1;
}

export interface PersistentStorageRequestResultV1 {
  readonly schema: 'illustro.persistent-storage-request/1';
  readonly supported: boolean;
  readonly persistedBefore: boolean | null;
  readonly requested: boolean;
  readonly persistedAfter: boolean | null;
}

function finiteNonNegative(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

function reserve(quota: number, minimum: number, ratio: number): number {
  return Math.max(minimum, quota * ratio);
}

export function calculateStorageQuotaSnapshotV1(input: {
  readonly usage?: number | null;
  readonly quota?: number | null;
  readonly persisted?: boolean | null;
}): StorageQuotaSnapshotV1 {
  const usage = finiteNonNegative(input.usage);
  const quota = finiteNonNegative(input.quota);
  if (usage === null || quota === null) {
    return Object.freeze({
      schema: 'illustro.storage-quota/1',
      usageBytes: usage,
      quotaBytes: quota,
      freeBytes: null,
      warningReserveBytes: null,
      criticalReserveBytes: null,
      hardReserveBytes: null,
      pressure: 'unknown',
      persisted: input.persisted ?? null,
    });
  }
  const free = Math.max(0, quota - usage);
  const warningReserve = reserve(quota, QUOTA_WARNING_MIN_BYTES, 0.15);
  const criticalReserve = reserve(quota, QUOTA_CRITICAL_MIN_BYTES, 0.08);
  const hardReserve = reserve(quota, QUOTA_HARD_MIN_BYTES, 0.05);
  const pressure: StoragePressureLevelV1 =
    free < hardReserve
      ? 'hard'
      : free < criticalReserve
        ? 'critical'
        : free < warningReserve
          ? 'warning'
          : 'healthy';
  return Object.freeze({
    schema: 'illustro.storage-quota/1',
    usageBytes: usage,
    quotaBytes: quota,
    freeBytes: free,
    warningReserveBytes: warningReserve,
    criticalReserveBytes: criticalReserve,
    hardReserveBytes: hardReserve,
    pressure,
    persisted: input.persisted ?? null,
  });
}

function browserStorageManager(): StorageManagerQuotaLikeV1 | null {
  if (typeof navigator === 'undefined' || navigator.storage === undefined) return null;
  return navigator.storage as StorageManagerQuotaLikeV1;
}

function assertProjectedBytes(value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError('projected durable bytes must be a non-negative safe integer');
  }
}

export function estimateDurableJsonBytes(value: unknown, overheadBytes = 64 * 1024): number {
  if (!Number.isSafeInteger(overheadBytes) || overheadBytes < 0) {
    throw new RangeError('durable-write overhead must be a non-negative safe integer');
  }
  const encoded = new TextEncoder().encode(serializeJson(value)).byteLength;
  const estimate = encoded + overheadBytes;
  if (!Number.isSafeInteger(estimate))
    throw new RangeError('durable-write estimate exceeds safe range');
  return estimate;
}

export class StorageQuotaMonitorV1 {
  readonly #storage: StorageManagerQuotaLikeV1 | null;

  constructor(storage: StorageManagerQuotaLikeV1 | null = browserStorageManager()) {
    this.#storage = storage;
  }

  async inspect(): Promise<StorageQuotaSnapshotV1> {
    if (this.#storage === null) return calculateStorageQuotaSnapshotV1({});
    const estimate = await this.#storage.estimate();
    const persisted =
      typeof this.#storage.persisted === 'function' ? await this.#storage.persisted() : null;
    return calculateStorageQuotaSnapshotV1({
      ...(estimate.usage === undefined ? {} : { usage: estimate.usage }),
      ...(estimate.quota === undefined ? {} : { quota: estimate.quota }),
      persisted,
    });
  }

  async preflight(
    projectedAdditionalBytes: number,
    options: { readonly safeExport?: boolean } = {},
  ): Promise<StorageGrowthPreflightV1> {
    assertProjectedBytes(projectedAdditionalBytes);
    const quota = await this.inspect();
    if (options.safeExport === true) {
      return Object.freeze({
        schema: 'illustro.storage-growth-preflight/1',
        allowed: true,
        projectedAdditionalBytes,
        projectedFreeBytes: quota.freeBytes,
        hardReserveBytes: quota.hardReserveBytes,
        reason: 'safe-export',
        quota,
      });
    }
    if (quota.freeBytes === null || quota.hardReserveBytes === null) {
      return Object.freeze({
        schema: 'illustro.storage-growth-preflight/1',
        allowed: false,
        projectedAdditionalBytes,
        projectedFreeBytes: null,
        hardReserveBytes: null,
        reason: 'quota-unavailable',
        quota,
      });
    }
    const projectedFreeBytes = Math.max(0, quota.freeBytes - projectedAdditionalBytes);
    const allowed = projectedFreeBytes >= quota.hardReserveBytes;
    return Object.freeze({
      schema: 'illustro.storage-growth-preflight/1',
      allowed,
      projectedAdditionalBytes,
      projectedFreeBytes,
      hardReserveBytes: quota.hardReserveBytes,
      reason: allowed ? 'safe' : 'hard-reserve-breach',
      quota,
    });
  }

  async assertCanGrow(
    projectedAdditionalBytes: number,
    options: { readonly safeExport?: boolean } = {},
  ): Promise<StorageGrowthPreflightV1> {
    const preflight = await this.preflight(projectedAdditionalBytes, options);
    if (!preflight.allowed) {
      throw new DOMException(
        preflight.reason === 'quota-unavailable'
          ? 'storage quota is unavailable; durable growth cannot be proven safe'
          : 'projected durable write would breach the hard storage safety reserve',
        'QuotaExceededError',
      );
    }
    return preflight;
  }

  async requestPersistence(): Promise<PersistentStorageRequestResultV1> {
    if (this.#storage === null) {
      return Object.freeze({
        schema: 'illustro.persistent-storage-request/1',
        supported: false,
        persistedBefore: null,
        requested: false,
        persistedAfter: null,
      });
    }
    const readPersisted = this.#storage.persisted?.bind(this.#storage);
    const requestPersist = this.#storage.persist?.bind(this.#storage);
    const before = readPersisted === undefined ? null : await readPersisted();
    if (before === true || requestPersist === undefined) {
      return Object.freeze({
        schema: 'illustro.persistent-storage-request/1',
        supported: readPersisted !== undefined || requestPersist !== undefined,
        persistedBefore: before,
        requested: false,
        persistedAfter: before,
      });
    }
    const requestedResult = await requestPersist();
    const after = readPersisted === undefined ? requestedResult : await readPersisted();
    return Object.freeze({
      schema: 'illustro.persistent-storage-request/1',
      supported: true,
      persistedBefore: before,
      requested: true,
      persistedAfter: after,
    });
  }
}

let sharedStorageQuotaMonitor: StorageQuotaMonitorV1 | null = null;

export function getStorageQuotaMonitor(): StorageQuotaMonitorV1 {
  sharedStorageQuotaMonitor ??= new StorageQuotaMonitorV1();
  return sharedStorageQuotaMonitor;
}
