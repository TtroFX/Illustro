import { isCommandTransactionId, type CommandTransactionId } from '../domain/command-registry.js';
import {
  createProjectId,
  parseProjectId,
  parseRevision,
  type ProjectId,
  type Revision,
} from '../domain/identity.js';
import { parseHistorySpineStateV1, type HistorySpineStateV1 } from '../history/history.js';
import { PaintHistoryControllerV1 } from './paint-history-controller.js';
import {
  PaintSessionControllerV1,
  parsePaintProjectSnapshotV1,
  type PaintDocumentCreationInputV1,
  type PaintProjectSnapshotV1,
} from './paint-session-controller.js';

export const PAINT_RESUME_PROJECT_KEY_V1 = 'illustro.m4.active-project' as const;
export const PAINT_STORAGE_REQUEST_TIMEOUT_MS = 10_000 as const;

export type PaintPersistenceStatusV1 =
  | 'idle'
  | 'initializing'
  | 'ready'
  | 'dirty'
  | 'saving'
  | 'error'
  | 'disposed';

export interface PaintPersistenceSnapshotV1 {
  readonly schema: 'illustro.paint-persistence/1';
  readonly projectId: ProjectId | null;
  readonly sequence: number;
  readonly recoveryGeneration: number;
  readonly status: PaintPersistenceStatusV1;
  readonly lastDurableTransactionId: CommandTransactionId | null;
  readonly lastError: string | null;
}

export interface PaintPersistenceProjectSnapshotV1 {
  readonly schema: 'illustro.paint-persistence-snapshot/1';
  readonly paint: PaintProjectSnapshotV1;
  readonly history: HistorySpineStateV1;
  readonly revisionHighWater: number;
}

export interface PaintPersistenceInitializeResultV1 {
  readonly schema: 'illustro.paint-persistence-initialize/1';
  readonly mode: 'created' | 'recovered';
  readonly projectId: ProjectId;
  readonly sequence: number;
  readonly recoveryGeneration: number;
  readonly documentRevision: Revision;
}

export interface PaintResumeStoreV1 {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface PaintStorageWorkerLikeV1 {
  postMessage(message: unknown): void;
  addEventListener(type: 'message', listener: (event: MessageEvent<unknown>) => void): void;
  removeEventListener(type: 'message', listener: (event: MessageEvent<unknown>) => void): void;
}

type PaintPersistenceNewDocumentInputV1 = Omit<PaintDocumentCreationInputV1, 'projectId'>;

type PendingStorageRequestV1 = {
  readonly resolve: (result: unknown) => void;
  readonly reject: (error: Error) => void;
  readonly timeout: number;
};

interface StorageProjectStateV1 {
  readonly projectId: ProjectId;
  readonly snapshot: unknown;
  readonly documentRevision: Revision;
  readonly sequence: number;
  readonly recoveryGeneration: number;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function positiveSequence(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 1) {
    throw new TypeError(`${label} must be a positive safe integer`);
  }
  return value as number;
}

function recoveryGeneration(value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) < 1) {
    throw new TypeError('recovery generation must be a positive safe integer');
  }
  return value as number;
}

function parseStorageProjectState(value: unknown): StorageProjectStateV1 {
  if (!isRecord(value) || !isRecord(value.metadata)) {
    throw new TypeError('invalid storage project response');
  }
  return Object.freeze({
    projectId: parseProjectId(value.metadata.projectId),
    snapshot: value.snapshot,
    documentRevision: parseRevision(value.documentRevision),
    sequence: positiveSequence(value.sequence, 'project sequence'),
    recoveryGeneration: recoveryGeneration(value.recoveryGeneration),
  });
}

function storageErrorMessage(value: unknown): string {
  if (!isRecord(value)) return String(value ?? 'storage request failed');
  if (isRecord(value.details) && typeof value.details.message === 'string') {
    return value.details.message;
  }
  if (typeof value.code === 'string') return value.code;
  return 'storage request failed';
}

export function parsePaintPersistenceProjectSnapshotV1(
  value: unknown,
): PaintPersistenceProjectSnapshotV1 {
  if (!isRecord(value) || value.schema !== 'illustro.paint-persistence-snapshot/1') {
    throw new TypeError('invalid paint persistence snapshot schema');
  }
  const paint = parsePaintProjectSnapshotV1(value.paint);
  const history = parseHistorySpineStateV1(value.history);
  if (!Number.isSafeInteger(value.revisionHighWater) || (value.revisionHighWater as number) < 0) {
    throw new TypeError('paint persistence revision high-water must be non-negative');
  }
  const revisionHighWater = value.revisionHighWater as number;
  if (revisionHighWater < paint.document.revision) {
    throw new Error('paint persistence revision high-water trails the document revision');
  }
  return Object.freeze({
    schema: 'illustro.paint-persistence-snapshot/1' as const,
    paint,
    history,
    revisionHighWater,
  });
}

export class PaintPersistenceControllerV1 {
  readonly #worker: PaintStorageWorkerLikeV1;
  readonly #session: PaintSessionControllerV1;
  readonly #history: PaintHistoryControllerV1;
  readonly #resumeStore: PaintResumeStoreV1 | null;
  readonly #onState: (snapshot: PaintPersistenceSnapshotV1) => void;
  readonly #pending = new Map<string, PendingStorageRequestV1>();
  readonly #messageListener: (event: MessageEvent<unknown>) => void;

  #projectId: ProjectId | null = null;
  #sequence = 0;
  #recoveryGeneration = 0;
  #status: PaintPersistenceStatusV1 = 'idle';
  #lastDurableTransactionId: CommandTransactionId | null = null;
  #lastError: string | null = null;
  #disposed = false;

  constructor(
    worker: PaintStorageWorkerLikeV1,
    session: PaintSessionControllerV1,
    history: PaintHistoryControllerV1,
    options: {
      readonly resumeStore?: PaintResumeStoreV1 | null;
      readonly onState?: (snapshot: PaintPersistenceSnapshotV1) => void;
    } = {},
  ) {
    this.#worker = worker;
    this.#session = session;
    this.#history = history;
    this.#resumeStore = options.resumeStore ?? null;
    this.#onState = options.onState ?? (() => undefined);
    this.#messageListener = (event) => this.#handleWorkerMessage(event.data);
    this.#worker.addEventListener('message', this.#messageListener);
    this.#publish();
  }

  snapshot(): PaintPersistenceSnapshotV1 {
    return Object.freeze({
      schema: 'illustro.paint-persistence/1' as const,
      projectId: this.#projectId,
      sequence: this.#sequence,
      recoveryGeneration: this.#recoveryGeneration,
      status: this.#status,
      lastDurableTransactionId: this.#lastDurableTransactionId,
      lastError: this.#lastError,
    });
  }

  projectSnapshot(): PaintPersistenceProjectSnapshotV1 {
    const paint = this.#session.projectSnapshot();
    if (paint === null) throw new Error('paint persistence requires an active document');
    const history = this.#history.snapshot();
    return Object.freeze({
      schema: 'illustro.paint-persistence-snapshot/1' as const,
      paint,
      history: this.#history.exportState(),
      revisionHighWater: history.revisionHighWater,
    });
  }

  async initialize(input: {
    readonly name: string;
    readonly document: PaintPersistenceNewDocumentInputV1;
  }): Promise<PaintPersistenceInitializeResultV1> {
    this.#assertNotDisposed();
    if (this.#status !== 'idle') throw new Error('paint persistence is already initialized');
    this.#setStatus('initializing');

    const resumeProjectId = this.#readResumeProjectId();
    try {
      if (resumeProjectId !== null) {
        const opened = parseStorageProjectState(
          await this.#request({
            type: 'storage.project.open',
            projectId: resumeProjectId,
          }),
        );
        const durable = parsePaintPersistenceProjectSnapshotV1(opened.snapshot);
        if (durable.paint.document.projectId !== opened.projectId) {
          throw new Error('recovered paint snapshot belongs to another project');
        }
        if (durable.paint.document.revision !== opened.documentRevision) {
          throw new Error('recovered paint revision disagrees with checkpoint metadata');
        }
        await this.#session.restoreProjectSnapshot(durable.paint);
        this.#history.hydrate(durable.history, durable.revisionHighWater);
        this.#adoptProject(opened);
        this.#rememberProject(opened.projectId);
        this.#setStatus('ready');
        return Object.freeze({
          schema: 'illustro.paint-persistence-initialize/1' as const,
          mode: 'recovered' as const,
          projectId: opened.projectId,
          sequence: opened.sequence,
          recoveryGeneration: opened.recoveryGeneration,
          documentRevision: opened.documentRevision,
        });
      }

      const projectId = createProjectId();
      const document = await this.#session.createNewDocument({ ...input.document, projectId });
      this.#history.reset();
      const created = parseStorageProjectState(
        await this.#request({
          type: 'storage.project.create',
          name: input.name,
          projectId,
          initialSnapshot: this.projectSnapshot(),
          documentRevision: document.revision,
        }),
      );
      if (created.projectId !== projectId)
        throw new Error('storage created an unexpected project ID');
      this.#adoptProject(created);
      this.#rememberProject(created.projectId);
      this.#setStatus('ready');
      return Object.freeze({
        schema: 'illustro.paint-persistence-initialize/1' as const,
        mode: 'created' as const,
        projectId: created.projectId,
        sequence: created.sequence,
        recoveryGeneration: created.recoveryGeneration,
        documentRevision: created.documentRevision,
      });
    } catch (error) {
      this.#fail(error);
      throw error;
    }
  }

  async markDirty(
    transactionIdValue: CommandTransactionId | string = crypto.randomUUID(),
  ): Promise<void> {
    this.#assertNotDisposed();
    const projectId = this.#requireProject();
    if (!isCommandTransactionId(transactionIdValue)) {
      throw new TypeError('paint persistence transactionId must be a UUID');
    }
    const document = this.#session.currentDocument();
    if (document === null) throw new Error('paint persistence requires an active document');
    const nextSequence = this.#sequence + 1;
    if (!Number.isSafeInteger(nextSequence))
      throw new RangeError('paint persistence sequence exhausted');
    try {
      await this.#request({
        type: 'storage.persistence.markDirty',
        projectId,
        transactionId: transactionIdValue,
        sequence: nextSequence,
        documentRevision: document.revision,
        snapshot: this.projectSnapshot(),
      });
      this.#sequence = nextSequence;
      this.#lastError = null;
      this.#setStatus('dirty');
    } catch (error) {
      this.#fail(error);
      throw error;
    }
  }

  async flushRecovery(): Promise<void> {
    await this.#flush('recovery');
  }

  async flushCheckpoint(): Promise<void> {
    await this.#flush('autosave');
  }

  async close(): Promise<void> {
    this.#assertNotDisposed();
    const projectId = this.#projectId;
    if (projectId === null) return;
    await this.flushCheckpoint();
    await this.#request({ type: 'storage.project.close', projectId });
    this.#setStatus('idle');
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#worker.removeEventListener('message', this.#messageListener);
    for (const pending of this.#pending.values()) {
      globalThis.clearTimeout(pending.timeout);
      pending.reject(new Error('paint persistence controller disposed'));
    }
    this.#pending.clear();
    this.#status = 'disposed';
    this.#publish();
  }

  async #flush(reason: 'recovery' | 'autosave'): Promise<void> {
    this.#assertNotDisposed();
    const projectId = this.#requireProject();
    const previousStatus = this.#status;
    this.#setStatus('saving');
    try {
      await this.#request({
        type: 'storage.persistence.flush',
        projectId,
        reason,
      });
      this.#lastError = null;
      this.#setStatus('ready');
    } catch (error) {
      this.#status = previousStatus;
      this.#fail(error);
      throw error;
    }
  }

  #request(message: Readonly<Record<string, unknown>>): Promise<unknown> {
    this.#assertNotDisposed();
    const requestId = crypto.randomUUID();
    return new Promise((resolve, reject) => {
      const timeout = globalThis.setTimeout(() => {
        this.#pending.delete(requestId);
        reject(new Error(`storage request timed out: ${String(message.type)}`));
      }, PAINT_STORAGE_REQUEST_TIMEOUT_MS);
      this.#pending.set(requestId, { resolve, reject, timeout });
      try {
        this.#worker.postMessage({ ...message, requestId });
      } catch (error) {
        globalThis.clearTimeout(timeout);
        this.#pending.delete(requestId);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  #handleWorkerMessage(value: unknown): void {
    if (!isRecord(value) || typeof value.type !== 'string') return;
    if (value.type === 'storage.response' && typeof value.requestId === 'string') {
      const pending = this.#pending.get(value.requestId);
      if (pending === undefined) return;
      this.#pending.delete(value.requestId);
      globalThis.clearTimeout(pending.timeout);
      if (value.ok === true) pending.resolve(value.result);
      else pending.reject(new Error(storageErrorMessage(value.error)));
      return;
    }
    if (value.type === 'storage.persistence.flushed') {
      if (value.projectId !== this.#projectId || !isRecord(value.result)) return;
      if (
        Number.isSafeInteger(value.result.recoveryGeneration) &&
        (value.result.recoveryGeneration as number) >= 1
      ) {
        this.#recoveryGeneration = value.result.recoveryGeneration as number;
      }
      if (isCommandTransactionId(value.result.transactionId)) {
        this.#lastDurableTransactionId = value.result.transactionId;
      }
      this.#lastError = null;
      this.#publish();
      return;
    }
    if (value.type === 'storage.autosave.settled' && value.projectId === this.#projectId) {
      this.#lastError = null;
      if (this.#status === 'dirty' || this.#status === 'saving') this.#setStatus('ready');
      else this.#publish();
      return;
    }
    if (value.type === 'storage.persistence.error') {
      this.#fail(new Error(storageErrorMessage(value.error)));
    }
  }

  #adoptProject(project: StorageProjectStateV1): void {
    this.#projectId = project.projectId;
    this.#sequence = project.sequence;
    this.#recoveryGeneration = project.recoveryGeneration;
    this.#lastDurableTransactionId = null;
    this.#lastError = null;
  }

  #readResumeProjectId(): ProjectId | null {
    if (this.#resumeStore === null) return null;
    try {
      const value = this.#resumeStore.getItem(PAINT_RESUME_PROJECT_KEY_V1);
      if (value === null) return null;
      try {
        return parseProjectId(value);
      } catch {
        this.#resumeStore.removeItem(PAINT_RESUME_PROJECT_KEY_V1);
        return null;
      }
    } catch {
      return null;
    }
  }

  #rememberProject(projectId: ProjectId): void {
    if (this.#resumeStore === null) return;
    try {
      this.#resumeStore.setItem(PAINT_RESUME_PROJECT_KEY_V1, projectId);
    } catch {
      // Resume metadata is advisory; OPFS remains canonical.
    }
  }

  #requireProject(): ProjectId {
    if (this.#projectId === null) throw new Error('paint persistence project is not initialized');
    return this.#projectId;
  }

  #assertNotDisposed(): void {
    if (this.#disposed) throw new Error('paint persistence controller is disposed');
  }

  #setStatus(status: PaintPersistenceStatusV1): void {
    this.#status = status;
    this.#publish();
  }

  #fail(error: unknown): void {
    this.#status = 'error';
    this.#lastError = error instanceof Error ? error.message : String(error);
    this.#publish();
  }

  #publish(): void {
    this.#onState(this.snapshot());
  }
}
