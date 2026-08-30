import {
  parseHistorySpillReferenceV1,
  parseHistorySpineStateV1,
  parseHistoryTransactionV1,
  type HistorySpillAdapterV1,
  type HistorySpillReferenceV1,
  type HistorySpineStateV1,
  type HistoryTransactionV1,
} from './history.js';
import { parseProjectId, type ProjectId } from '../domain/identity.js';
import type { HistoryStateLoadResultV1 } from '../storage/history-store.js';

interface WorkerLikeV1 {
  postMessage(message: unknown): void;
  addEventListener(type: 'message', listener: (event: MessageEvent<unknown>) => void): void;
  removeEventListener(type: 'message', listener: (event: MessageEvent<unknown>) => void): void;
}

interface PendingRequestV1 {
  readonly resolve: (value: unknown) => void;
  readonly reject: (reason: unknown) => void;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function responseError(value: unknown): Error {
  if (isRecord(value) && typeof value.code === 'string') {
    const details = isRecord(value.details) ? value.details : null;
    const message = details !== null && typeof details.message === 'string' ? details.message : value.code;
    return new Error(message);
  }
  return new Error('storage history request failed');
}

function parseLoadResult(value: unknown): HistoryStateLoadResultV1 {
  if (!isRecord(value) || typeof value.status !== 'string') {
    throw new TypeError('invalid history load result');
  }
  if (value.status === 'missing') {
    return Object.freeze({ status: 'missing', state: null, detail: null });
  }
  if (value.status === 'corrupt') {
    if (typeof value.detail !== 'string') throw new TypeError('invalid corrupt history detail');
    return Object.freeze({ status: 'corrupt', state: null, detail: value.detail });
  }
  if (value.status === 'ok') {
    return Object.freeze({
      status: 'ok',
      state: parseHistorySpineStateV1(value.state),
      detail: null,
    });
  }
  throw new TypeError('unknown history load status');
}

export class HistoryStorageWorkerClientV1 implements HistorySpillAdapterV1 {
  readonly #worker: WorkerLikeV1;
  readonly #projectId: ProjectId;
  readonly #pending = new Map<string, PendingRequestV1>();
  readonly #listener: (event: MessageEvent<unknown>) => void;
  #disposed = false;

  constructor(worker: WorkerLikeV1, projectId: ProjectId | string) {
    this.#worker = worker;
    this.#projectId = parseProjectId(projectId);
    this.#listener = (event) => {
      const message = event.data;
      if (
        !isRecord(message) ||
        message.type !== 'storage.response' ||
        typeof message.requestId !== 'string'
      ) {
        return;
      }
      const pending = this.#pending.get(message.requestId);
      if (pending === undefined) return;
      this.#pending.delete(message.requestId);
      if (message.ok === true) pending.resolve(message.result);
      else pending.reject(responseError(message.error));
    };
    this.#worker.addEventListener('message', this.#listener);
  }

  async spillTransactions(
    transactions: readonly HistoryTransactionV1[],
  ): Promise<readonly HistorySpillReferenceV1[]> {
    const result = await this.#request({
      type: 'storage.history.spill',
      transactions: transactions.map((transaction) => parseHistoryTransactionV1(transaction)),
    });
    if (!Array.isArray(result)) throw new TypeError('history spill response must be an array');
    return Object.freeze(result.map((reference) => parseHistorySpillReferenceV1(reference)));
  }

  async loadTransaction(reference: HistorySpillReferenceV1): Promise<HistoryTransactionV1> {
    return parseHistoryTransactionV1(
      await this.#request({
        type: 'storage.history.loadTransaction',
        reference: parseHistorySpillReferenceV1(reference),
      }),
    );
  }

  async saveState(state: HistorySpineStateV1): Promise<string> {
    const result = await this.#request({
      type: 'storage.history.save',
      state: parseHistorySpineStateV1(state),
    });
    if (!isRecord(result) || typeof result.checksum !== 'string') {
      throw new TypeError('history save response is missing checksum');
    }
    return result.checksum;
  }

  async loadState(): Promise<HistoryStateLoadResultV1> {
    return parseLoadResult(await this.#request({ type: 'storage.history.load' }));
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#worker.removeEventListener('message', this.#listener);
    for (const pending of this.#pending.values()) {
      pending.reject(new Error('history storage worker client disposed'));
    }
    this.#pending.clear();
  }

  #request(payload: Readonly<Record<string, unknown>>): Promise<unknown> {
    if (this.#disposed) return Promise.reject(new Error('history storage worker client disposed'));
    const requestId = crypto.randomUUID();
    return new Promise((resolve, reject) => {
      this.#pending.set(requestId, { resolve, reject });
      try {
        this.#worker.postMessage({
          ...payload,
          requestId,
          projectId: this.#projectId,
        });
      } catch (error) {
        this.#pending.delete(requestId);
        reject(error);
      }
    });
  }
}
