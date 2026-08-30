import { describe, expect, it } from 'vitest';
import {
  CONSERVATIVE_HISTORY_HOT_BUDGET_BYTES,
  DEFAULT_HISTORY_RETENTION_TRANSACTIONS,
  LARGE_HISTORY_HOT_BUDGET_BYTES,
  STANDARD_HISTORY_HOT_BUDGET_BYTES,
} from '../../src/history/history.js';

describe('frozen history retention policy', () => {
  it('pins profile hot budgets and default retained transaction count', () => {
    expect(CONSERVATIVE_HISTORY_HOT_BUDGET_BYTES).toBe(64 * 1024 * 1024);
    expect(STANDARD_HISTORY_HOT_BUDGET_BYTES).toBe(128 * 1024 * 1024);
    expect(LARGE_HISTORY_HOT_BUDGET_BYTES).toBe(256 * 1024 * 1024);
    expect(DEFAULT_HISTORY_RETENTION_TRANSACTIONS).toBe(1_000);
  });
});
