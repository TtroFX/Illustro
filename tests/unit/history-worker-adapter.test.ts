import { describe, expect, it } from 'vitest';
import {
  createHistoryPayloadV1,
  createHistoryTransactionV1,
  estimateHistoryTransactionBytes,
  HistorySpineV1,
} from '../../src/history/history.js';
import { HistoryStorageWorkerClientV1 } from '../../src/history/storage-worker-adapter.js';
import { createProjectId } from '../../src/domain/identity.js';

class FakeStorageWorker {
  readonly posted: unknown[] = [];
  readonly #listeners = new Set<(event: MessageEvent<unknown>) => void>();
  #transaction: ReturnType<typeof createHistoryTransactionV1> | null = null;

  postMessage(message: unknown): void {
    this.posted.push(message);
    if (typeof message !== 'object' || message === null || !('requestId' in message)) return;
    const record = message as Record<string, unknown>;
    const requestId = record.requestId;
    if (typeof requestId !== 'string') return;
    let result: unknown;
    if (record.type === 'storage.history.spill') {
      const transactions = record.transactions;
      if (!Array.isArray(transactions) || transactions.length !== 1) throw new Error('bad spill');
      this.#transaction = transactions[0] as ReturnType<typeof createHistoryTransactionV1>;
      result = [
        {
          schema: 'illustro.history-spill-ref/1',
          segment: `segment-${'a'.repeat(64)}.ilh`,
          segmentHash: 'a'.repeat(64),
          index: 0,
          transactionId: this.#transaction.transactionId,
          byteLength: estimateHistoryTransactionBytes(this.#transaction),
        },
      ];
    } else if (record.type === 'storage.history.loadTransaction') {
      result = this.#transaction;
    } else if (record.type === 'storage.history.save') {
      result = { checksum: 'b'.repeat(64) };
    } else if (record.type === 'storage.history.load') {
      result = { status: 'missing', state: null, detail: null };
    } else {
      return;
    }
    const event = { data: { type: 'storage.response', requestId, ok: true, result } } as MessageEvent;
    for (const listener of this.#listeners) listener(event);
  }

  addEventListener(type: 'message', listener: (event: MessageEvent<unknown>) => void): void {
    if (type === 'message') this.#listeners.add(listener);
  }

  removeEventListener(type: 'message', listener: (event: MessageEvent<unknown>) => void): void {
    if (type === 'message') this.#listeners.delete(listener);
  }
}

describe('history storage worker client', () => {
  it('routes spill, lazy load, state save, and reload through the storage worker', async () => {
    const worker = new FakeStorageWorker();
    const projectId = createProjectId();
    const client = new HistoryStorageWorkerClientV1(worker, projectId);
    const transaction = createHistoryTransactionV1({
      transactionId: crypto.randomUUID(),
      commandId: 'history.worker-test',
      beforeRevision: 0,
      afterRevision: 1,
      committedAt: '2026-08-30T00:00:00.000Z',
      payload: createHistoryPayloadV1({
        strategy: 'typed-before-after',
        before: { value: 0 },
        after: { value: 1 },
      }),
    });

    const references = await client.spillTransactions([transaction]);
    expect(references).toHaveLength(1);
    expect((await client.loadTransaction(references[0]!)).transactionId).toBe(
      transaction.transactionId,
    );

    const spine = new HistorySpineV1();
    spine.commit(transaction);
    expect(await client.saveState(spine.exportState())).toBe('b'.repeat(64));
    expect((await client.loadState()).status).toBe('missing');
    expect(worker.posted.every((message) => (message as { projectId?: string }).projectId === projectId)).toBe(
      true,
    );

    client.dispose();
    await expect(client.loadState()).rejects.toThrow('disposed');
  });
});
