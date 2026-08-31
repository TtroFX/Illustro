import { describe, expect, it } from 'vitest';
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

  addEventListener(_type: 'message', listener: (event: MessageEvent<unknown>) => void): void {
    this.listeners.add(listener);
  }

  removeEventListener(_type: 'message', listener: (event: MessageEvent<unknown>) => void): void {
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
