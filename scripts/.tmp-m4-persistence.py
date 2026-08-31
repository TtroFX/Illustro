from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    target = Path(path)
    text = target.read_text()
    if text.count(old) != 1:
        raise SystemExit(f"expected exactly one replacement in {path}: {old[:80]!r}")
    target.write_text(text.replace(old, new, 1))


Path("src/app/paint-persistence-controller.ts").write_text(r'''import {
  isCommandTransactionId,
  type CommandTransactionId,
} from '../domain/command-registry.js';
import {
  createProjectId,
  parseProjectId,
  parseRevision,
  type ProjectId,
  type Revision,
} from '../domain/identity.js';
import {
  parseHistorySpineStateV1,
  type HistorySpineStateV1,
} from '../history/history.js';
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
      if (created.projectId !== projectId) throw new Error('storage created an unexpected project ID');
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
    if (!Number.isSafeInteger(nextSequence)) throw new RangeError('paint persistence sequence exhausted');
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
''')

Path("tests/unit/paint-persistence-controller.test.ts").write_text(r'''import { describe, expect, it } from 'vitest';
import { PaintHistoryControllerV1 } from '../../src/app/paint-history-controller.js';
import {
  PAINT_RESUME_PROJECT_KEY_V1,
  PaintPersistenceControllerV1,
  type PaintResumeStoreV1,
  type PaintStorageWorkerLikeV1,
} from '../../src/app/paint-persistence-controller.js';
import { PaintSessionControllerV1 } from '../../src/app/paint-session-controller.js';
import type { BaselineBrushDabV1 } from '../../src/gpu/baseline-brush.js';
import type {
  PointerInputBatchV1,
  PointerInputEventTypeV1,
  PointerInputSampleV1,
} from '../../src/input/pointer-input.js';

class MemoryResumeStore implements PaintResumeStoreV1 {
  readonly values = new Map<string, string>();
  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
  removeItem(key: string): void {
    this.values.delete(key);
  }
}

class FakeRenderer {
  readonly restored: Array<
    readonly { readonly strokeId: string; readonly dabs: readonly BaselineBrushDabV1[] }[]
  > = [];
  async configureDocument(): Promise<void> {}
  async restoreBaselineStrokes(
    strokes: readonly { readonly strokeId: string; readonly dabs: readonly BaselineBrushDabV1[] }[],
  ): Promise<void> {
    this.restored.push(Object.freeze([...strokes]));
  }
}

type StoredProject = {
  snapshot: unknown;
  documentRevision: number;
  sequence: number;
  recoveryGeneration: number;
  pending: {
    snapshot: unknown;
    documentRevision: number;
    sequence: number;
    transactionId: string;
  } | null;
};

class FakeStorageWorker implements PaintStorageWorkerLikeV1 {
  readonly listeners = new Set<(event: MessageEvent<unknown>) => void>();
  readonly projects = new Map<string, StoredProject>();
  readonly messages: Readonly<Record<string, unknown>>[] = [];

  addEventListener(
    _type: 'message',
    listener: (event: MessageEvent<unknown>) => void,
  ): void {
    this.listeners.add(listener);
  }

  removeEventListener(
    _type: 'message',
    listener: (event: MessageEvent<unknown>) => void,
  ): void {
    this.listeners.delete(listener);
  }

  postMessage(message: unknown): void {
    if (typeof message !== 'object' || message === null) throw new TypeError('invalid request');
    const request = message as Readonly<Record<string, unknown>>;
    this.messages.push(request);
    queueMicrotask(() => this.handle(request));
  }

  private emit(data: unknown): void {
    const event = { data } as MessageEvent<unknown>;
    for (const listener of this.listeners) listener(event);
  }

  private respond(requestId: unknown, result: unknown): void {
    this.emit({ type: 'storage.response', requestId, ok: true, result });
  }

  private handle(request: Readonly<Record<string, unknown>>): void {
    const type = request.type;
    if (type === 'storage.project.create') {
      const projectId = String(request.projectId);
      const project: StoredProject = {
        snapshot: request.initialSnapshot,
        documentRevision: Number(request.documentRevision),
        sequence: 1,
        recoveryGeneration: 1,
        pending: null,
      };
      this.projects.set(projectId, project);
      this.respond(request.requestId, {
        metadata: { projectId },
        snapshot: project.snapshot,
        documentRevision: project.documentRevision,
        sequence: project.sequence,
        recoveryGeneration: project.recoveryGeneration,
        access: { mode: 'read-write' },
      });
      return;
    }
    if (type === 'storage.project.open') {
      const projectId = String(request.projectId);
      const project = this.projects.get(projectId);
      if (project === undefined) {
        this.emit({
          type: 'storage.response',
          requestId: request.requestId,
          ok: false,
          error: { code: 'missing', details: { message: 'project missing' } },
        });
        return;
      }
      this.respond(request.requestId, {
        metadata: { projectId },
        snapshot: project.snapshot,
        documentRevision: project.documentRevision,
        sequence: project.sequence,
        recoveryGeneration: project.recoveryGeneration,
        access: { mode: 'read-write' },
      });
      return;
    }
    if (type === 'storage.persistence.markDirty') {
      const projectId = String(request.projectId);
      const project = this.projects.get(projectId);
      if (project === undefined) throw new Error('project missing');
      project.pending = {
        snapshot: request.snapshot,
        documentRevision: Number(request.documentRevision),
        sequence: Number(request.sequence),
        transactionId: String(request.transactionId),
      };
      this.respond(request.requestId, { generation: project.sequence + 1, state: {} });
      return;
    }
    if (type === 'storage.persistence.flush') {
      const projectId = String(request.projectId);
      const project = this.projects.get(projectId);
      if (project === undefined) throw new Error('project missing');
      if (project.pending !== null) {
        const pending = project.pending;
        project.snapshot = pending.snapshot;
        project.documentRevision = pending.documentRevision;
        project.sequence = pending.sequence;
        project.recoveryGeneration += 1;
        project.pending = null;
        this.emit({
          type: 'storage.persistence.flushed',
          reason: request.reason,
          projectId,
          result: {
            transactionId: pending.transactionId,
            sequence: pending.sequence,
            documentRevision: pending.documentRevision,
            recoveryGeneration: project.recoveryGeneration,
          },
        });
      }
      if (request.reason === 'autosave') {
        this.emit({ type: 'storage.autosave.settled', projectId, transactionId: null, result: {} });
      }
      this.respond(request.requestId, {});
      return;
    }
    if (type === 'storage.project.close') {
      this.respond(request.requestId, { closed: true });
      return;
    }
    throw new Error(`unsupported request ${String(type)}`);
  }
}

function sample(sequence: number, eventType: PointerInputEventTypeV1): PointerInputSampleV1 {
  return Object.freeze({
    schema: 'illustro.pointer-sample/1' as const,
    sequence,
    pointerId: 1,
    source: 'pen' as const,
    eventType,
    origin: 'direct' as const,
    isPrimary: true,
    timestampMs: sequence,
    clientX: 20 + sequence,
    clientY: 20,
    surfaceX: 20 + sequence,
    surfaceY: 20,
    pressure: 0.5,
    tangentialPressure: 0,
    tiltX: 0,
    tiltY: 0,
    twist: 0,
    altitudeAngle: null,
    azimuthAngle: null,
    contactWidth: 1,
    contactHeight: 1,
    buttons: eventType === 'pointerup' ? 0 : 1,
    button: eventType === 'pointerdown' ? 0 : -1,
  });
}

function batch(eventType: PointerInputEventTypeV1, sequence: number): PointerInputBatchV1 {
  return Object.freeze({
    schema: 'illustro.pointer-batch/1' as const,
    eventType,
    pointerId: 1,
    confirmed: Object.freeze([sample(sequence, eventType)]),
    predicted: Object.freeze([]),
  });
}

function completeStroke(session: PaintSessionControllerV1, start: number): string {
  session.ingestPointerBatch(batch('pointerdown', start));
  const strokeId = session.activeStroke()?.strokeId;
  if (strokeId === undefined) throw new Error('stroke did not start');
  session.ingestPointerBatch(batch('pointermove', start + 1));
  session.ingestPointerBatch(batch('pointerup', start + 2));
  return strokeId;
}

function createController(
  worker: FakeStorageWorker,
  store: MemoryResumeStore,
): {
  session: PaintSessionControllerV1;
  history: PaintHistoryControllerV1;
  persistence: PaintPersistenceControllerV1;
} {
  const session = new PaintSessionControllerV1(new FakeRenderer());
  const history = new PaintHistoryControllerV1(session);
  const persistence = new PaintPersistenceControllerV1(worker, session, history, {
    resumeStore: store,
  });
  return { session, history, persistence };
}

describe('M4 paint persistence vertical slice', () => {
  it('autosaves one atomic paint + history snapshot and reloads it coherently', async () => {
    const worker = new FakeStorageWorker();
    const store = new MemoryResumeStore();
    const first = createController(worker, store);
    const initialized = await first.persistence.initialize({
      name: 'Untitled',
      document: { width: 256, height: 256 },
    });
    expect(initialized.mode).toBe('created');
    expect(store.getItem(PAINT_RESUME_PROJECT_KEY_V1)).toBe(initialized.projectId);

    const transaction = first.history.commitCompletedStroke(completeStroke(first.session, 1));
    await first.persistence.markDirty(transaction.transactionId);
    expect(first.persistence.snapshot()).toMatchObject({ sequence: 2, status: 'dirty' });
    await first.persistence.flushCheckpoint();
    expect(first.persistence.snapshot()).toMatchObject({
      sequence: 2,
      recoveryGeneration: 2,
      status: 'ready',
      lastDurableTransactionId: transaction.transactionId,
    });
    first.persistence.dispose();

    const second = createController(worker, store);
    const recovered = await second.persistence.initialize({
      name: 'ignored-on-recovery',
      document: { width: 64, height: 64 },
    });
    expect(recovered).toMatchObject({ mode: 'recovered', sequence: 2, documentRevision: 1 });
    expect(second.session.snapshot()).toMatchObject({ committedStrokeCount: 1 });
    expect(second.history.snapshot()).toMatchObject({ cursor: 1, canUndo: true, canRedo: false });
  });

  it('persists an Undo cursor and exact pre-stroke canonical state across another reload', async () => {
    const worker = new FakeStorageWorker();
    const store = new MemoryResumeStore();
    const first = createController(worker, store);
    await first.persistence.initialize({
      name: 'Undo recovery',
      document: { width: 256, height: 256 },
    });
    const transaction = first.history.commitCompletedStroke(completeStroke(first.session, 10));
    await first.persistence.markDirty(transaction.transactionId);
    await first.persistence.flushRecovery();
    expect(await first.history.undo()).toBe(true);
    await first.persistence.markDirty();
    await first.persistence.flushCheckpoint();
    first.persistence.dispose();

    const second = createController(worker, store);
    await second.persistence.initialize({
      name: 'ignored',
      document: { width: 32, height: 32 },
    });
    expect(second.session.snapshot().committedStrokeCount).toBe(0);
    expect(second.history.snapshot()).toMatchObject({ cursor: 0, canUndo: false, canRedo: true });
    expect(second.session.currentDocument()?.revision).toBe(0);
  });
});
''')

replace_once(
    "src/app/main.ts",
    "import { PaintHistoryControllerV1 } from './paint-history-controller.js';\nimport { PaintSessionControllerV1 } from './paint-session-controller.js';",
    "import { PaintHistoryControllerV1 } from './paint-history-controller.js';\nimport { PaintPersistenceControllerV1 } from './paint-persistence-controller.js';\nimport { PaintSessionControllerV1 } from './paint-session-controller.js';",
)

replace_once(
    "src/app/main.ts",
    "const paintSession = new PaintSessionControllerV1(renderer);\nconst paintHistory = new PaintHistoryControllerV1(paintSession);\nlet paintRenderTask: Promise<void> = Promise.resolve();",
    "const paintSession = new PaintSessionControllerV1(renderer);\nconst paintHistory = new PaintHistoryControllerV1(paintSession);\nconst paintPersistence = new PaintPersistenceControllerV1(workers.storage, paintSession, paintHistory, {\n  resumeStore: globalThis.localStorage,\n  onState(snapshot) {\n    root.dataset.illustroPersistence = snapshot.status;\n    root.dataset.illustroProjectId = snapshot.projectId ?? '';\n    root.dataset.illustroProjectSequence = String(snapshot.sequence);\n    root.dataset.illustroRecoveryGeneration = String(snapshot.recoveryGeneration);\n    root.dataset.illustroPersistenceError = snapshot.lastError ?? '';\n  },\n});\nlet paintRenderTask: Promise<void> = Promise.resolve();",
)

replace_once(
    "src/app/main.ts",
    "          const transaction = paintHistory.commitCompletedStroke(strokeId);\n          root.dataset.illustroHistoryTransaction = transaction.transactionId;\n          publishPaintHistory();",
    "          const transaction = paintHistory.commitCompletedStroke(strokeId);\n          await paintPersistence.markDirty(transaction.transactionId);\n          root.dataset.illustroHistoryTransaction = transaction.transactionId;\n          publishPaintHistory();",
)

replace_once(
    "src/app/main.ts",
    "    const changed = redo ? await paintHistory.redo() : await paintHistory.undo();\n    if (!changed) return;\n    root.dataset.illustroPaintVisible = 'committed';",
    "    const changed = redo ? await paintHistory.redo() : await paintHistory.undo();\n    if (!changed) return;\n    await paintPersistence.markDirty();\n    root.dataset.illustroPaintVisible = 'committed';",
)

replace_once(
    "src/app/main.ts",
    "    const document = await paintSession.createNewDocument({\n      width: Math.max(1, Math.round(surfaceSize.width / surfaceSize.pixelRatio)),\n      height: Math.max(1, Math.round(surfaceSize.height / surfaceSize.pixelRatio)),\n    });\n    root.dataset.illustroPaintSession = 'ready';",
    "    const persistence = await paintPersistence.initialize({\n      name: 'Untitled',\n      document: {\n        width: Math.max(1, Math.round(surfaceSize.width / surfaceSize.pixelRatio)),\n        height: Math.max(1, Math.round(surfaceSize.height / surfaceSize.pixelRatio)),\n      },\n    });\n    const document = paintSession.currentDocument();\n    if (document === null) throw new Error('paint persistence initialized without a document');\n    root.dataset.illustroPaintRecovery = persistence.mode;\n    root.dataset.illustroPaintSession = 'ready';",
)

replace_once(
    "src/app/main.ts",
    "    paintHistory.reset();\n    publishPaintHistory();",
    "    publishPaintHistory();",
)

old_pagehide = '''globalThis.addEventListener(
  'pagehide',
  () => {
    window.removeEventListener('keydown', onPaintHistoryKeyDown);
    pointerInput.dispose();
    pointerTransport.dispose();
    pointerHover.clear();
    paintSession.dispose();
    root.dataset.illustroPointerInput = 'disposed';
    root.dataset.illustroPaintSession = 'disposed';
    renderer.dispose();
    shell.dispose();
    workers.dispose();
    stopPerformanceInstrumentation();
  },
  { once: true },
);'''
new_pagehide = '''const onPaintVisibilityChange = (): void => {
  if (document.visibilityState !== 'hidden') return;
  void paintRenderTask
    .then(() => paintPersistence.flushRecovery())
    .catch((error: unknown) => logger.error('paint-persistence.lifecycle-flush-failed', error));
};
document.addEventListener('visibilitychange', onPaintVisibilityChange);

globalThis.addEventListener(
  'pagehide',
  () => {
    window.removeEventListener('keydown', onPaintHistoryKeyDown);
    document.removeEventListener('visibilitychange', onPaintVisibilityChange);
    pointerInput.dispose();
    pointerTransport.dispose();
    pointerHover.clear();
    root.dataset.illustroPointerInput = 'disposed';
    root.dataset.illustroPaintSession = 'closing';
    stopPerformanceInstrumentation();
    void paintRenderTask
      .then(() => paintPersistence.close())
      .catch((error: unknown) => logger.error('paint-persistence.close-failed', error))
      .finally(() => {
        paintSession.dispose();
        paintPersistence.dispose();
        renderer.dispose();
        shell.dispose();
        workers.dispose();
        root.dataset.illustroPaintSession = 'disposed';
      });
  },
  { once: true },
);'''
replace_once("src/app/main.ts", old_pagehide, new_pagehide)

replace_once(
    "src/storage/persistence-scheduler.ts",
    "  recoveryQuietMs: 1_500,\n  recoveryMaxMs: 5_000,",
    "  recoveryQuietMs: 2_000,\n  recoveryMaxMs: 2_000,",
)

baseline_test = Path("tests/unit/baseline-paint-renderer.test.ts")
baseline_text = baseline_test.read_text()
needle = "\n});\n"
position = baseline_text.rfind(needle)
if position < 0:
    raise SystemExit("baseline renderer test terminator not found")
rebuild_test = r'''

  it('re-presents canonical committed strokes after a GPU device rebuild', () => {
    const first = gpuHarness();
    const tileState = new RendererTileStateV1(512, 256);
    const renderer = new BaselinePaintRendererV1();
    tileState.attachGpuDevice(first.device);
    renderer.attachDevice(first.device);
    renderer.attachSurface(first.surface, 'bgra8unorm');
    renderer.configureDocument(tileState, 512, 256);
    renderer.finalizeStroke('stroke-rebuild', [dab(80, 90)]);

    const second = gpuHarness();
    tileState.attachGpuDevice(null);
    renderer.attachDevice(null);
    tileState.attachGpuDevice(second.device);
    renderer.attachDevice(second.device);

    expect(renderer.snapshot()).toMatchObject({
      committedStrokeCount: 1,
      committedDabCount: 1,
      deviceReady: true,
    });
    expect(second.counts()).toMatchObject({
      drawCalls: 1,
      renderPasses: 1,
      submits: 1,
      instanceCount: 1,
    });
  });
'''
baseline_test.write_text(baseline_text[:position] + rebuild_test + baseline_text[position:])
