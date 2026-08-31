export const MEBIBYTE = 1024 * 1024;

export type RendererCacheProfileV1 = 'conservative' | 'standard' | 'large';
export type TileCacheKindV1 = 'gpu' | 'cpu';
export type TileCacheResidencyV1 = 'interaction' | 'visible' | 'near' | 'background';

export interface RendererCacheBudgetV1 {
  readonly gpuTileBytes: number;
  readonly cpuTileBytes: number;
}

export const RENDERER_CACHE_BUDGETS_V1: Readonly<
  Record<RendererCacheProfileV1, RendererCacheBudgetV1>
> = Object.freeze({
  conservative: Object.freeze({ gpuTileBytes: 128 * MEBIBYTE, cpuTileBytes: 192 * MEBIBYTE }),
  standard: Object.freeze({ gpuTileBytes: 256 * MEBIBYTE, cpuTileBytes: 384 * MEBIBYTE }),
  large: Object.freeze({ gpuTileBytes: 512 * MEBIBYTE, cpuTileBytes: 768 * MEBIBYTE }),
});

export interface TileCacheEntryV1<Value> {
  readonly key: string;
  readonly value: Value;
  readonly byteLength: number;
  readonly residency: TileCacheResidencyV1;
  readonly touchedAt: number;
}

export interface TileCacheSnapshotV1 {
  readonly schema: 'illustro.tile-cache/1';
  readonly kind: TileCacheKindV1;
  readonly profile: RendererCacheProfileV1;
  readonly budgetBytes: number;
  readonly residentBytes: number;
  readonly entryCount: number;
}

export type TileCacheRemovalReasonV1 = 'evicted' | 'deleted' | 'replaced' | 'cleared';

const RESIDENCY_KEEP_RANK: Readonly<Record<TileCacheResidencyV1, number>> = Object.freeze({
  background: 0,
  near: 1,
  visible: 2,
  interaction: 3,
});

function assertByteLength(value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError('cache byteLength must be a non-negative safe integer');
  }
}

function budgetFor(kind: TileCacheKindV1, profile: RendererCacheProfileV1): number {
  const budget = RENDERER_CACHE_BUDGETS_V1[profile];
  return kind === 'gpu' ? budget.gpuTileBytes : budget.cpuTileBytes;
}

export function gpuSingleAllocationSoftLimitV1(profile: RendererCacheProfileV1): number {
  return Math.min(64 * MEBIBYTE, RENDERER_CACHE_BUDGETS_V1[profile].gpuTileBytes * 0.25);
}

export class BudgetedTileCacheV1<Value> {
  readonly #kind: TileCacheKindV1;
  readonly #entries = new Map<string, TileCacheEntryV1<Value>>();
  readonly #onRemove: (entry: TileCacheEntryV1<Value>, reason: TileCacheRemovalReasonV1) => void;
  #profile: RendererCacheProfileV1;
  #residentBytes = 0;
  #clock = 0;

  constructor(
    kind: TileCacheKindV1,
    profile: RendererCacheProfileV1 = 'conservative',
    onRemove: (entry: TileCacheEntryV1<Value>, reason: TileCacheRemovalReasonV1) => void = () =>
      undefined,
  ) {
    this.#kind = kind;
    this.#profile = profile;
    this.#onRemove = onRemove;
  }

  snapshot(): TileCacheSnapshotV1 {
    return Object.freeze({
      schema: 'illustro.tile-cache/1',
      kind: this.#kind,
      profile: this.#profile,
      budgetBytes: budgetFor(this.#kind, this.#profile),
      residentBytes: this.#residentBytes,
      entryCount: this.#entries.size,
    });
  }

  setProfile(profile: RendererCacheProfileV1): TileCacheSnapshotV1 {
    this.#profile = profile;
    this.#evictToBudget(0, null);
    return this.snapshot();
  }

  peek(key: string): TileCacheEntryV1<Value> | null {
    return this.#entries.get(key) ?? null;
  }

  get(key: string): TileCacheEntryV1<Value> | null {
    const entry = this.#entries.get(key);
    if (entry === undefined) return null;
    const touched = Object.freeze({ ...entry, touchedAt: ++this.#clock });
    this.#entries.set(key, touched);
    return touched;
  }

  prepareAdmission(
    byteLength: number,
    residency: TileCacheResidencyV1,
    excludedKey: string | null = null,
  ): boolean {
    assertByteLength(byteLength);
    const budget = budgetFor(this.#kind, this.#profile);
    if (byteLength > budget) return false;
    const excludedBytes =
      excludedKey === null ? 0 : (this.#entries.get(excludedKey)?.byteLength ?? 0);
    const fits = (): boolean => this.#residentBytes - excludedBytes + byteLength <= budget;
    if (fits()) return true;

    const incomingRank = RESIDENCY_KEEP_RANK[residency];
    const candidates = [...this.#entries.values()]
      .filter(
        (entry) =>
          entry.key !== excludedKey && RESIDENCY_KEEP_RANK[entry.residency] <= incomingRank,
      )
      .sort((left, right) => {
        const priority = RESIDENCY_KEEP_RANK[left.residency] - RESIDENCY_KEEP_RANK[right.residency];
        return priority !== 0 ? priority : left.touchedAt - right.touchedAt;
      });
    for (const candidate of candidates) {
      if (fits()) break;
      this.#remove(candidate, 'evicted');
    }
    return fits();
  }

  put(
    key: string,
    value: Value,
    byteLength: number,
    residency: TileCacheResidencyV1 = 'background',
  ): TileCacheEntryV1<Value> | null {
    if (key.length === 0) throw new TypeError('cache key must not be empty');
    if (!this.prepareAdmission(byteLength, residency, key)) return null;

    const previous = this.#entries.get(key);
    if (previous !== undefined) this.#remove(previous, 'replaced');
    const entry = Object.freeze({
      key,
      value,
      byteLength,
      residency,
      touchedAt: ++this.#clock,
    });
    this.#entries.set(key, entry);
    this.#residentBytes += byteLength;
    return entry;
  }

  delete(key: string): boolean {
    const entry = this.#entries.get(key);
    if (entry === undefined) return false;
    this.#remove(entry, 'deleted');
    return true;
  }

  clear(): void {
    for (const entry of [...this.#entries.values()]) this.#remove(entry, 'cleared');
  }

  entries(): readonly TileCacheEntryV1<Value>[] {
    return Object.freeze([...this.#entries.values()]);
  }

  #remove(entry: TileCacheEntryV1<Value>, reason: TileCacheRemovalReasonV1): void {
    if (!this.#entries.delete(entry.key)) return;
    this.#residentBytes -= entry.byteLength;
    this.#onRemove(entry, reason);
  }

  #evictToBudget(additionalBytes: number, excludedKey: string | null): void {
    const budget = budgetFor(this.#kind, this.#profile);
    if (this.#residentBytes + additionalBytes <= budget) return;
    const candidates = [...this.#entries.values()]
      .filter((entry) => entry.key !== excludedKey)
      .sort((left, right) => {
        const priority = RESIDENCY_KEEP_RANK[left.residency] - RESIDENCY_KEEP_RANK[right.residency];
        return priority !== 0 ? priority : left.touchedAt - right.touchedAt;
      });
    for (const candidate of candidates) {
      if (this.#residentBytes + additionalBytes <= budget) break;
      this.#remove(candidate, 'evicted');
    }
  }
}

export class GpuTileCacheV1<Value> extends BudgetedTileCacheV1<Value> {
  constructor(
    profile: RendererCacheProfileV1 = 'conservative',
    onRemove?: (entry: TileCacheEntryV1<Value>, reason: TileCacheRemovalReasonV1) => void,
  ) {
    super('gpu', profile, onRemove);
  }
}

export class CpuBackingTileCacheV1<Value> extends BudgetedTileCacheV1<Value> {
  constructor(
    profile: RendererCacheProfileV1 = 'conservative',
    onRemove?: (entry: TileCacheEntryV1<Value>, reason: TileCacheRemovalReasonV1) => void,
  ) {
    super('cpu', profile, onRemove);
  }
}
