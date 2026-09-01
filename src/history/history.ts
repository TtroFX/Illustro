import {
  isCommandTransactionId,
  parseCommandId,
  type CommandId,
  type CommandTransactionId,
} from '../domain/command-registry.js';
import { parseRevision, type Revision } from '../domain/identity.js';
import { isSha256Hex } from '../domain/resources.js';
import { serializeJson, toJsonValue, type JsonValue } from '../domain/serialization.js';

export const HISTORY_PAYLOAD_STRATEGIES = Object.freeze([
  'typed-before-after',
  'tile-patch-set',
  'snapshot-ref',
  'object-before-after',
  'lineart-topology',
  'composite',
] as const);

export type HistoryPayloadStrategyV1 = (typeof HISTORY_PAYLOAD_STRATEGIES)[number];
export type HistoryRestoreDirectionV1 = 'undo' | 'redo';

export interface HistoryPayloadV1 {
  readonly schema: 'illustro.history-payload/1';
  readonly strategy: HistoryPayloadStrategyV1;
  readonly before: JsonValue;
  readonly after: JsonValue;
}

export interface HistoryTransactionV1 {
  readonly schema: 'illustro.history-transaction/1';
  readonly transactionId: CommandTransactionId;
  readonly commandId: CommandId;
  readonly beforeRevision: Revision;
  readonly afterRevision: Revision;
  readonly committedAt: string;
  readonly payload: HistoryPayloadV1;
}

export interface HistorySpillReferenceV1 {
  readonly schema: 'illustro.history-spill-ref/1';
  readonly segment: string;
  readonly segmentHash: string;
  readonly index: number;
  readonly transactionId: CommandTransactionId;
  readonly byteLength: number;
}

export type HistoryEntryV1 =
  | {
      readonly storage: 'resident';
      readonly transaction: HistoryTransactionV1;
      readonly byteLength: number;
    }
  | {
      readonly storage: 'spilled';
      readonly reference: HistorySpillReferenceV1;
    };

export interface HistorySpineStateV1 {
  readonly schema: 'illustro.history-spine/1';
  readonly cursor: number;
  readonly entries: readonly HistoryEntryV1[];
}

export interface HistorySpillAdapterV1 {
  spillTransactions(
    transactions: readonly HistoryTransactionV1[],
  ): Promise<readonly HistorySpillReferenceV1[]>;
  loadTransaction(reference: HistorySpillReferenceV1): Promise<HistoryTransactionV1>;
}

export type HistoryRestorerV1 = (
  transaction: HistoryTransactionV1,
  direction: HistoryRestoreDirectionV1,
) => void | Promise<void>;

export const DEFAULT_HISTORY_RETENTION_TRANSACTIONS = 1_000 as const;
export const CONSERVATIVE_HISTORY_HOT_BUDGET_BYTES = 64 * 1024 * 1024;
export const STANDARD_HISTORY_HOT_BUDGET_BYTES = 128 * 1024 * 1024;
export const LARGE_HISTORY_HOT_BUDGET_BYTES = 256 * 1024 * 1024;

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertSafeCount(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new RangeError(`${label} must be a non-negative safe integer`);
  }
  return value as number;
}

function isPayloadStrategy(value: unknown): value is HistoryPayloadStrategyV1 {
  return (
    typeof value === 'string' &&
    HISTORY_PAYLOAD_STRATEGIES.includes(value as HistoryPayloadStrategyV1)
  );
}

export function createHistoryPayloadV1(input: {
  strategy: HistoryPayloadStrategyV1;
  before: unknown;
  after: unknown;
}): HistoryPayloadV1 {
  if (!isPayloadStrategy(input.strategy)) throw new TypeError('unknown history payload strategy');
  return Object.freeze({
    schema: 'illustro.history-payload/1',
    strategy: input.strategy,
    before: toJsonValue(input.before),
    after: toJsonValue(input.after),
  });
}

export function parseHistoryPayloadV1(value: unknown): HistoryPayloadV1 {
  if (!isRecord(value) || value.schema !== 'illustro.history-payload/1') {
    throw new TypeError('invalid history payload schema');
  }
  if (!isPayloadStrategy(value.strategy)) throw new TypeError('unknown history payload strategy');
  return createHistoryPayloadV1({
    strategy: value.strategy,
    before: value.before,
    after: value.after,
  });
}

export function createHistoryTransactionV1(input: {
  transactionId: CommandTransactionId | string;
  commandId: CommandId | string;
  beforeRevision: Revision | number;
  afterRevision: Revision | number;
  committedAt?: string;
  payload: HistoryPayloadV1;
}): HistoryTransactionV1 {
  if (!isCommandTransactionId(input.transactionId)) {
    throw new TypeError('history transactionId must be a UUID');
  }
  const commandId = parseCommandId(input.commandId);
  const beforeRevision = parseRevision(input.beforeRevision);
  const afterRevision = parseRevision(input.afterRevision);
  if (afterRevision <= beforeRevision) {
    throw new RangeError('history afterRevision must be greater than beforeRevision');
  }
  const committedAt = input.committedAt ?? new Date().toISOString();
  if (Number.isNaN(Date.parse(committedAt))) {
    throw new TypeError('history committedAt must be an ISO-like timestamp');
  }
  return Object.freeze({
    schema: 'illustro.history-transaction/1',
    transactionId: input.transactionId,
    commandId,
    beforeRevision,
    afterRevision,
    committedAt,
    payload: parseHistoryPayloadV1(input.payload),
  });
}

export function parseHistoryTransactionV1(value: unknown): HistoryTransactionV1 {
  if (!isRecord(value) || value.schema !== 'illustro.history-transaction/1') {
    throw new TypeError('invalid history transaction schema');
  }
  return createHistoryTransactionV1({
    transactionId: value.transactionId as string,
    commandId: value.commandId as string,
    beforeRevision: value.beforeRevision as number,
    afterRevision: value.afterRevision as number,
    committedAt: value.committedAt as string,
    payload: parseHistoryPayloadV1(value.payload),
  });
}

export function estimateHistoryTransactionBytes(transaction: HistoryTransactionV1): number {
  return new TextEncoder().encode(serializeJson(transaction)).byteLength;
}

function residentEntry(transaction: HistoryTransactionV1): HistoryEntryV1 {
  const normalized = parseHistoryTransactionV1(transaction);
  return Object.freeze({
    storage: 'resident',
    transaction: normalized,
    byteLength: estimateHistoryTransactionBytes(normalized),
  });
}

export function parseHistorySpillReferenceV1(value: unknown): HistorySpillReferenceV1 {
  if (!isRecord(value) || value.schema !== 'illustro.history-spill-ref/1') {
    throw new TypeError('invalid history spill reference schema');
  }
  if (
    typeof value.segment !== 'string' ||
    value.segment.length === 0 ||
    value.segment.includes('/') ||
    value.segment.includes('\\') ||
    !value.segment.endsWith('.ilh')
  ) {
    throw new TypeError('invalid history spill segment filename');
  }
  if (!isSha256Hex(value.segmentHash)) throw new TypeError('invalid history segment hash');
  if (!isCommandTransactionId(value.transactionId)) {
    throw new TypeError('invalid spilled history transaction ID');
  }
  const index = assertSafeCount(value.index, 'history spill index');
  const byteLength = assertSafeCount(value.byteLength, 'history spill byteLength');
  if (byteLength === 0) throw new RangeError('history spill byteLength must be positive');
  return Object.freeze({
    schema: 'illustro.history-spill-ref/1',
    segment: value.segment,
    segmentHash: value.segmentHash,
    index,
    transactionId: value.transactionId,
    byteLength,
  });
}

function parseHistoryEntryV1(value: unknown): HistoryEntryV1 {
  if (!isRecord(value)) throw new TypeError('invalid history entry');
  if (value.storage === 'resident') {
    const transaction = parseHistoryTransactionV1(value.transaction);
    const byteLength = assertSafeCount(value.byteLength, 'resident history byteLength');
    const expected = estimateHistoryTransactionBytes(transaction);
    if (byteLength !== expected) throw new Error('resident history byteLength mismatch');
    return Object.freeze({ storage: 'resident', transaction, byteLength });
  }
  if (value.storage === 'spilled') {
    return Object.freeze({
      storage: 'spilled',
      reference: parseHistorySpillReferenceV1(value.reference),
    });
  }
  throw new TypeError('unknown history entry storage class');
}

export function parseHistorySpineStateV1(value: unknown): HistorySpineStateV1 {
  if (!isRecord(value) || value.schema !== 'illustro.history-spine/1') {
    throw new TypeError('invalid history spine schema');
  }
  if (!Array.isArray(value.entries)) throw new TypeError('history entries must be an array');
  const entries = Object.freeze(value.entries.map((entry) => parseHistoryEntryV1(entry)));
  const cursor = assertSafeCount(value.cursor, 'history cursor');
  if (cursor > entries.length) throw new RangeError('history cursor exceeds spine length');
  return Object.freeze({ schema: 'illustro.history-spine/1', cursor, entries });
}

export class HistorySpineV1 {
  readonly #entries: HistoryEntryV1[];
  #cursor: number;

  constructor(state?: HistorySpineStateV1) {
    const normalized = state === undefined ? null : parseHistorySpineStateV1(state);
    this.#entries = normalized === null ? [] : [...normalized.entries];
    this.#cursor = normalized?.cursor ?? 0;
  }

  static hydrate(state: unknown): HistorySpineV1 {
    return new HistorySpineV1(parseHistorySpineStateV1(state));
  }

  get length(): number {
    return this.#entries.length;
  }

  get cursor(): number {
    return this.#cursor;
  }

  get canUndo(): boolean {
    return this.#cursor > 0;
  }

  get canRedo(): boolean {
    return this.#cursor < this.#entries.length;
  }

  get residentByteLength(): number {
    let total = 0;
    for (const entry of this.#entries) {
      if (entry.storage === 'resident') total += entry.byteLength;
    }
    return total;
  }

  commit(transaction: HistoryTransactionV1): readonly CommandTransactionId[] {
    const normalized = parseHistoryTransactionV1(transaction);
    const truncated = this.#cursor < this.#entries.length ? this.#entries.splice(this.#cursor) : [];
    this.#entries.push(residentEntry(normalized));
    this.#cursor = this.#entries.length;
    return Object.freeze(
      truncated.map((entry) =>
        entry.storage === 'resident'
          ? entry.transaction.transactionId
          : entry.reference.transactionId,
      ),
    );
  }

  async undo(restorer: HistoryRestorerV1, spillAdapter?: HistorySpillAdapterV1): Promise<boolean> {
    if (!this.canUndo) return false;
    const index = this.#cursor - 1;
    const transaction = await this.#resolveEntry(index, spillAdapter);
    await restorer(transaction, 'undo');
    this.#cursor = index;
    return true;
  }

  async redo(restorer: HistoryRestorerV1, spillAdapter?: HistorySpillAdapterV1): Promise<boolean> {
    if (!this.canRedo) return false;
    const index = this.#cursor;
    const transaction = await this.#resolveEntry(index, spillAdapter);
    await restorer(transaction, 'redo');
    this.#cursor = index + 1;
    return true;
  }

  prune(maxTransactions = DEFAULT_HISTORY_RETENTION_TRANSACTIONS): readonly CommandTransactionId[] {
    const maximum = assertSafeCount(maxTransactions, 'history retention');
    const excess = Math.max(0, this.#entries.length - maximum);
    const removable = Math.min(excess, this.#cursor);
    if (removable === 0) return Object.freeze([]);
    const removed = this.#entries.splice(0, removable);
    this.#cursor -= removable;
    return Object.freeze(
      removed.map((entry) =>
        entry.storage === 'resident'
          ? entry.transaction.transactionId
          : entry.reference.transactionId,
      ),
    );
  }

  async spillCold(
    adapter: HistorySpillAdapterV1,
    hotBudgetBytes: number,
  ): Promise<readonly HistorySpillReferenceV1[]> {
    const budget = assertSafeCount(hotBudgetBytes, 'history hot budget');
    let residentBytes = this.residentByteLength;
    if (residentBytes <= budget) return Object.freeze([]);

    const indexes: number[] = [];
    const transactions: HistoryTransactionV1[] = [];
    for (let index = 0; index < this.#entries.length && residentBytes > budget; index += 1) {
      const entry = this.#entries[index];
      if (entry?.storage !== 'resident') continue;
      indexes.push(index);
      transactions.push(entry.transaction);
      residentBytes -= entry.byteLength;
    }
    if (transactions.length === 0) return Object.freeze([]);

    const references = await adapter.spillTransactions(Object.freeze(transactions));
    if (references.length !== indexes.length) {
      throw new Error('history spill adapter returned a mismatched reference count');
    }
    const normalizedReferences = references.map((reference) =>
      parseHistorySpillReferenceV1(reference),
    );
    for (let offset = 0; offset < indexes.length; offset += 1) {
      const index = indexes[offset];
      const reference = normalizedReferences[offset];
      const transaction = transactions[offset];
      if (index === undefined || reference === undefined || transaction === undefined) {
        throw new Error('history spill replacement index is missing');
      }
      if (reference.transactionId !== transaction.transactionId) {
        throw new Error('history spill reference points to the wrong transaction');
      }
      this.#entries[index] = Object.freeze({ storage: 'spilled', reference });
    }
    return Object.freeze(normalizedReferences);
  }

  exportState(): HistorySpineStateV1 {
    return Object.freeze({
      schema: 'illustro.history-spine/1',
      cursor: this.#cursor,
      entries: Object.freeze([...this.#entries]),
    });
  }

  async #resolveEntry(
    index: number,
    spillAdapter?: HistorySpillAdapterV1,
  ): Promise<HistoryTransactionV1> {
    const entry = this.#entries[index];
    if (entry === undefined) throw new RangeError('history entry is missing');
    if (entry.storage === 'resident') return entry.transaction;
    if (spillAdapter === undefined) throw new Error('spilled history requires a storage adapter');
    const transaction = parseHistoryTransactionV1(
      await spillAdapter.loadTransaction(entry.reference),
    );
    if (transaction.transactionId !== entry.reference.transactionId) {
      throw new Error('loaded history transaction does not match spill reference');
    }
    return transaction;
  }
}
