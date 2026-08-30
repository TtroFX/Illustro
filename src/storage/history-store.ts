import {
  estimateHistoryTransactionBytes,
  parseHistorySpillReferenceV1,
  parseHistorySpineStateV1,
  parseHistoryTransactionV1,
  type HistorySpillAdapterV1,
  type HistorySpillReferenceV1,
  type HistorySpineStateV1,
  type HistoryTransactionV1,
} from '../history/history.js';
import { isSha256Hex } from '../domain/resources.js';
import { serializeJson } from '../domain/serialization.js';
import type { DirectoryHandleLike, ProjectDirectoryLayoutV1 } from './opfs-layout.js';
import { openSyncAccessFile } from './sync-access.js';

interface HistorySegmentV1 {
  readonly schema: 'illustro.history-segment/1';
  readonly transactions: readonly HistoryTransactionV1[];
}

interface HistorySegmentEnvelopeV1 {
  readonly schema: 'illustro.history-segment-envelope/1';
  readonly segment: HistorySegmentV1;
  readonly checksum: string;
}

interface HistoryStateEnvelopeV1 {
  readonly schema: 'illustro.history-state-envelope/1';
  readonly state: HistorySpineStateV1;
  readonly checksum: string;
}

export type HistoryStateLoadResultV1 =
  | { readonly status: 'missing'; readonly state: null; readonly detail: null }
  | { readonly status: 'ok'; readonly state: HistorySpineStateV1; readonly detail: null }
  | { readonly status: 'corrupt'; readonly state: null; readonly detail: string };

export const HISTORY_STATE_FILENAME = 'state.json' as const;

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function ownedBuffer(bytes: Uint8Array<ArrayBuffer>): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

async function sha256HexText(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', ownedBuffer(bytes));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function readText(directory: DirectoryHandleLike, filename: string): Promise<string> {
  const handle = await directory.getFileHandle(filename);
  return (await handle.getFile()).text();
}

async function readTextIfPresent(
  directory: DirectoryHandleLike,
  filename: string,
): Promise<string | null> {
  try {
    return await readText(directory, filename);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'NotFoundError') return null;
    throw error;
  }
}

async function replaceText(
  directory: DirectoryHandleLike,
  filename: string,
  text: string,
): Promise<void> {
  const file = await openSyncAccessFile(directory, filename);
  try {
    file.replace(new TextEncoder().encode(text));
  } finally {
    file.close();
  }
}

async function createSegmentEnvelope(
  transactions: readonly HistoryTransactionV1[],
): Promise<HistorySegmentEnvelopeV1> {
  const segment: HistorySegmentV1 = Object.freeze({
    schema: 'illustro.history-segment/1',
    transactions: Object.freeze(transactions.map((transaction) => parseHistoryTransactionV1(transaction))),
  });
  const checksum = await sha256HexText(serializeJson(segment));
  return Object.freeze({
    schema: 'illustro.history-segment-envelope/1',
    segment,
    checksum,
  });
}

async function parseSegmentEnvelope(
  text: string,
  expectedChecksum?: string,
): Promise<HistorySegmentEnvelopeV1> {
  const value = JSON.parse(text) as unknown;
  if (!isRecord(value) || value.schema !== 'illustro.history-segment-envelope/1') {
    throw new TypeError('invalid history segment envelope schema');
  }
  if (!isSha256Hex(value.checksum)) throw new TypeError('invalid history segment checksum');
  if (expectedChecksum !== undefined && value.checksum !== expectedChecksum) {
    throw new Error('history segment checksum does not match spill reference');
  }
  if (!isRecord(value.segment) || value.segment.schema !== 'illustro.history-segment/1') {
    throw new TypeError('invalid history segment schema');
  }
  if (!Array.isArray(value.segment.transactions)) {
    throw new TypeError('history segment transactions must be an array');
  }
  const transactions = Object.freeze(
    value.segment.transactions.map((transaction) => parseHistoryTransactionV1(transaction)),
  );
  const segment: HistorySegmentV1 = Object.freeze({
    schema: 'illustro.history-segment/1',
    transactions,
  });
  const observed = await sha256HexText(serializeJson(segment));
  if (observed !== value.checksum) throw new Error('history segment checksum mismatch');
  return Object.freeze({
    schema: 'illustro.history-segment-envelope/1',
    segment,
    checksum: value.checksum,
  });
}

async function createStateEnvelope(state: HistorySpineStateV1): Promise<HistoryStateEnvelopeV1> {
  const normalized = parseHistorySpineStateV1(state);
  return Object.freeze({
    schema: 'illustro.history-state-envelope/1',
    state: normalized,
    checksum: await sha256HexText(serializeJson(normalized)),
  });
}

async function parseStateEnvelope(text: string): Promise<HistoryStateEnvelopeV1> {
  const value = JSON.parse(text) as unknown;
  if (!isRecord(value) || value.schema !== 'illustro.history-state-envelope/1') {
    throw new TypeError('invalid history state envelope schema');
  }
  if (!isSha256Hex(value.checksum)) throw new TypeError('invalid history state checksum');
  const state = parseHistorySpineStateV1(value.state);
  const observed = await sha256HexText(serializeJson(state));
  if (observed !== value.checksum) throw new Error('history state checksum mismatch');
  return Object.freeze({
    schema: 'illustro.history-state-envelope/1',
    state,
    checksum: value.checksum,
  });
}

export class ProjectHistoryStoreV1 implements HistorySpillAdapterV1 {
  readonly #history: DirectoryHandleLike;

  constructor(project: ProjectDirectoryLayoutV1) {
    this.#history = project.directories.history;
  }

  async spillTransactions(
    transactions: readonly HistoryTransactionV1[],
  ): Promise<readonly HistorySpillReferenceV1[]> {
    if (transactions.length === 0) return Object.freeze([]);
    const envelope = await createSegmentEnvelope(transactions);
    const filename = `segment-${envelope.checksum}.ilh`;
    const encoded = serializeJson(envelope);
    const existing = await readTextIfPresent(this.#history, filename);
    if (existing === null) {
      await replaceText(this.#history, filename, encoded);
    } else {
      await parseSegmentEnvelope(existing, envelope.checksum);
      if (existing !== encoded) {
        throw new Error('immutable history segment conflicts with existing content');
      }
    }

    return Object.freeze(
      envelope.segment.transactions.map((transaction, index) =>
        Object.freeze({
          schema: 'illustro.history-spill-ref/1' as const,
          segment: filename,
          segmentHash: envelope.checksum,
          index,
          transactionId: transaction.transactionId,
          byteLength: estimateHistoryTransactionBytes(transaction),
        }),
      ),
    );
  }

  async loadTransaction(reference: HistorySpillReferenceV1): Promise<HistoryTransactionV1> {
    const normalized = parseHistorySpillReferenceV1(reference);
    const envelope = await parseSegmentEnvelope(
      await readText(this.#history, normalized.segment),
      normalized.segmentHash,
    );
    const transaction = envelope.segment.transactions[normalized.index];
    if (transaction === undefined) throw new RangeError('history spill index exceeds segment length');
    if (transaction.transactionId !== normalized.transactionId) {
      throw new Error('history spill transaction ID mismatch');
    }
    if (estimateHistoryTransactionBytes(transaction) !== normalized.byteLength) {
      throw new Error('history spill transaction byteLength mismatch');
    }
    return transaction;
  }

  async saveState(state: HistorySpineStateV1): Promise<string> {
    const envelope = await createStateEnvelope(state);
    await replaceText(this.#history, HISTORY_STATE_FILENAME, serializeJson(envelope));
    const readBack = await this.loadState();
    if (readBack.status !== 'ok' || readBack.state.cursor !== envelope.state.cursor) {
      throw new Error('history state read-back verification failed');
    }
    return envelope.checksum;
  }

  async loadState(): Promise<HistoryStateLoadResultV1> {
    const text = await readTextIfPresent(this.#history, HISTORY_STATE_FILENAME);
    if (text === null) return Object.freeze({ status: 'missing', state: null, detail: null });
    try {
      const envelope = await parseStateEnvelope(text);
      return Object.freeze({ status: 'ok', state: envelope.state, detail: null });
    } catch (error) {
      return Object.freeze({
        status: 'corrupt',
        state: null,
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
