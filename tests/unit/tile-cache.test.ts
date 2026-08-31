import { describe, expect, it } from 'vitest';
import {
  BudgetedTileCacheV1,
  gpuSingleAllocationSoftLimitV1,
  MEBIBYTE,
  RENDERER_CACHE_BUDGETS_V1,
} from '../../src/gpu/tile-cache.js';

describe('M3 adaptive tile cache budgets', () => {
  it('starts from the frozen Conservative GPU and CPU budgets', () => {
    expect(RENDERER_CACHE_BUDGETS_V1.conservative).toEqual({
      gpuTileBytes: 128 * MEBIBYTE,
      cpuTileBytes: 192 * MEBIBYTE,
    });
    expect(RENDERER_CACHE_BUDGETS_V1.standard).toEqual({
      gpuTileBytes: 256 * MEBIBYTE,
      cpuTileBytes: 384 * MEBIBYTE,
    });
    expect(RENDERER_CACHE_BUDGETS_V1.large).toEqual({
      gpuTileBytes: 512 * MEBIBYTE,
      cpuTileBytes: 768 * MEBIBYTE,
    });
    expect(gpuSingleAllocationSoftLimitV1('conservative')).toBe(32 * MEBIBYTE);
    expect(gpuSingleAllocationSoftLimitV1('large')).toBe(64 * MEBIBYTE);
  });

  it('evicts background/older cache entries before visible interaction-critical entries', () => {
    const removed: string[] = [];
    const cache = new BudgetedTileCacheV1<string>('gpu', 'conservative', (entry) => {
      removed.push(entry.key);
    });
    cache.put('interaction', 'a', 64 * MEBIBYTE, 'interaction');
    cache.put('background', 'b', 64 * MEBIBYTE, 'background');
    const admitted = cache.put('visible', 'c', 32 * MEBIBYTE, 'visible');
    expect(admitted).not.toBeNull();
    expect(removed).toEqual(['background']);
    expect(cache.peek('interaction')).not.toBeNull();
    expect(cache.peek('background')).toBeNull();
    expect(cache.snapshot().residentBytes).toBe(96 * MEBIBYTE);
  });

  it('does not evict interaction-critical residency to admit background work', () => {
    const cache = new BudgetedTileCacheV1<string>('gpu', 'conservative');
    cache.put('interaction', 'a', 128 * MEBIBYTE, 'interaction');
    expect(cache.put('background', 'b', MEBIBYTE, 'background')).toBeNull();
    expect(cache.peek('interaction')).not.toBeNull();
    expect(cache.peek('background')).toBeNull();
  });

  it('reversibly steps down cache profile and evicts to the new soft budget', () => {
    const cache = new BudgetedTileCacheV1<string>('cpu', 'large');
    cache.put('a', 'a', 300 * MEBIBYTE, 'background');
    cache.put('b', 'b', 300 * MEBIBYTE, 'near');
    expect(cache.snapshot().residentBytes).toBe(600 * MEBIBYTE);
    const snapshot = cache.setProfile('conservative');
    expect(snapshot.profile).toBe('conservative');
    expect(snapshot.residentBytes).toBeLessThanOrEqual(192 * MEBIBYTE);
  });
});
