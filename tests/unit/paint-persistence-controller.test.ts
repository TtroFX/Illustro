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
  BaselineRasterLayerDescriptorV1,
  BaselineRasterTileImageV1,
  BaselineRasterTilePatchDirectionV1,
  BaselineRasterTilePatchV1,
} from '../../src/gpu/baseline-raster-tile-store.js';
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
    readonly {
      readonly strokeId: string;
      readonly layerId: string;
      readonly dabs: readonly BaselineBrushDabV1[];
    }[]
  > = [];
  readonly tiles = new Map<string, BaselineRasterTileImageV1>();
  #width = 1;
  #height = 1;
  #pixelFormat: BaselineRasterTileImageV1['pixelFormat'] = 'rgba8-unorm';
  async configureDocument(input: {
    readonly width: number;
    readonly height: number;
    readonly precision: BaselineRasterTileImageV1['pixelFormat'];
  }): Promise<void> {
    this.#width = input.width;
    this.#height = input.height;
    this.#pixelFormat = input.precision;
  }
  async restoreBaselineStrokes(
    strokes: readonly {
      readonly strokeId: string;
      readonly layerId: string;
      readonly dabs: readonly BaselineBrushDabV1[];
    }[],
  ): Promise<void> {
    this.restored.push(Object.freeze([...strokes]));
    this.tiles.clear();
    const stroke = strokes[0];
    if (stroke === undefined) return;
    const width = Math.min(128, this.#width);
    const height = Math.min(128, this.#height);
    const bytes = new Uint8Array(width * height * (this.#pixelFormat === 'rgba8-unorm' ? 4 : 8));
    if (this.#pixelFormat === 'rgba8-unorm') bytes[3] = 255;
    else new DataView(bytes.buffer).setUint16(6, 0x3c00, true);
    const tile = Object.freeze({
      schema: 'illustro.baseline-raster-tile/1' as const,
      layerId: stroke.layerId,
      coordinate: Object.freeze({ tx: 0, ty: 0 }),
      width,
      height,
      pixelFormat: this.#pixelFormat,
      bytes,
    });
    this.tiles.set(`${stroke.layerId}/0:0`, tile);
  }
  async applyBaselineTilePatches(
    patches: readonly BaselineRasterTilePatchV1[],
    direction: BaselineRasterTilePatchDirectionV1,
  ): Promise<void> {
    for (const patch of patches) {
      const key = `${patch.layerId}/${patch.coordinate.tx}:${patch.coordinate.ty}`;
      const selected = direction === 'before' ? patch.before : patch.after;
      if (selected === null) this.tiles.delete(key);
      else this.tiles.set(key, selected);
    }
  }
  async restoreBaselineCanonicalTiles(
    tiles: readonly BaselineRasterTileImageV1[],
    _layers: readonly BaselineRasterLayerDescriptorV1[],
  ): Promise<void> {
    this.tiles.clear();
    for (const tile of tiles) {
      this.tiles.set(`${tile.layerId}/${tile.coordinate.tx}:${tile.coordinate.ty}`, tile);
    }
  }
  async exportBaselineCanonicalTiles(): Promise<readonly BaselineRasterTileImageV1[]> {
    return Object.freeze([...this.tiles.values()]);
  }
  async exportBaselineCompositeTiles(): Promise<readonly BaselineRasterTileImageV1[]> {
    return this.exportBaselineCanonicalTiles();
  }
}

function tilePatches(session: PaintSessionControllerV1): readonly BaselineRasterTilePatchV1[] {
  const layerId = session.activeLayerId();
  if (layerId === null) throw new Error('test paint layer is missing');
  return Object.freeze([
    Object.freeze({
      schema: 'illustro.baseline-raster-tile-patch/1' as const,
      layerId,
      coordinate: Object.freeze({ tx: 0, ty: 0 }),
      before: null,
      after: Object.freeze({
        schema: 'illustro.baseline-raster-tile/1' as const,
        layerId,
        coordinate: Object.freeze({ tx: 0, ty: 0 }),
        width: 128,
        height: 128,
        pixelFormat: 'rgba8-unorm' as const,
        bytes: new Uint8Array(128 * 128 * 4),
      }),
    }),
  ]);
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
  readonly tiles = new Map<
    string,
    {
      readonly pixelFormat: string;
      readonly width: number;
      readonly height: number;
      readonly bytes: Uint8Array;
    }
  >();
  #nextTileHash = 1;

  addEventListener(_type: 'message', listener: (event: MessageEvent<unknown>) => void): void {
    this.listeners.add(listener);
  }

  removeEventListener(_type: 'message', listener: (event: MessageEvent<unknown>) => void): void {
    this.listeners.delete(listener);
  }

  postMessage(message: unknown, _transfer: readonly Transferable[] = []): void {
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
    if (type === 'storage.tile.put') {
      const bytes = new Uint8Array(request.bytes as ArrayBuffer).slice();
      const hash = (this.#nextTileHash++).toString(16).padStart(64, '0');
      this.tiles.set(hash, {
        pixelFormat: String(request.pixelFormat),
        width: Number(request.width),
        height: Number(request.height),
        bytes,
      });
      this.respond(request.requestId, {
        codec: 'raw',
        pixelFormat: request.pixelFormat,
        width: request.width,
        height: request.height,
        rawByteLength: bytes.byteLength,
        encodedByteLength: bytes.byteLength,
        object: {
          hash,
          algorithm: 'sha256',
          byteLength: bytes.byteLength,
          created: true,
        },
      });
      return;
    }
    if (type === 'storage.tile.get') {
      const tile = this.tiles.get(String(request.objectHash));
      if (tile === undefined) throw new Error('tile missing');
      this.respond(request.requestId, {
        codec: 'raw',
        pixelFormat: tile.pixelFormat,
        width: tile.width,
        height: tile.height,
        bytes: tile.bytes.slice().buffer,
      });
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
  renderer: FakeRenderer;
} {
  const renderer = new FakeRenderer();
  const session = new PaintSessionControllerV1(renderer);
  const history = new PaintHistoryControllerV1(session);
  const persistence = new PaintPersistenceControllerV1(worker, session, history, {
    resumeStore: store,
  });
  return { session, history, persistence, renderer };
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

    const strokeId = completeStroke(first.session, 1);
    const patches = tilePatches(first.session);
    const transaction = first.history.commitCompletedStroke(strokeId, patches);
    first.persistence.scheduleRasterTileTransaction({
      transactionId: transaction.transactionId,
      strokeId,
      beforeRevision: transaction.beforeRevision,
      afterRevision: transaction.afterRevision,
      patches,
    });
    await first.persistence.flushCheckpoint();
    expect(first.persistence.snapshot()).toMatchObject({
      sequence: 2,
      recoveryGeneration: 2,
      status: 'ready',
      lastDurableTransactionId: transaction.transactionId,
    });
    expect(worker.messages.filter((message) => message.type === 'storage.tile.put')).toHaveLength(
      1,
    );
    expect(worker.projects.get(initialized.projectId)?.snapshot).toMatchObject({
      paint: { committedStrokes: [] },
      raster: {
        history: [
          { transactionId: transaction.transactionId, patches: [{ layerId: expect.any(String) }] },
        ],
      },
    });
    first.persistence.dispose();

    const second = createController(worker, store);
    const recovered = await second.persistence.initialize({
      name: 'ignored-on-recovery',
      document: { width: 64, height: 64 },
    });
    expect(recovered).toMatchObject({ mode: 'recovered', sequence: 2, documentRevision: 1 });
    expect(second.session.snapshot()).toMatchObject({ committedStrokeCount: 0 });
    expect(second.renderer.tiles.size).toBe(1);
    expect(second.history.snapshot()).toMatchObject({ cursor: 1, canUndo: true, canRedo: false });
    expect(await second.history.undo()).toBe(true);
    expect(second.renderer.tiles.size).toBe(0);
  });

  it('persists an Undo cursor and exact pre-stroke canonical state across another reload', async () => {
    const worker = new FakeStorageWorker();
    const store = new MemoryResumeStore();
    const first = createController(worker, store);
    await first.persistence.initialize({
      name: 'Undo recovery',
      document: { width: 256, height: 256 },
    });
    const strokeId = completeStroke(first.session, 10);
    const patches = tilePatches(first.session);
    const transaction = first.history.commitCompletedStroke(strokeId, patches);
    first.persistence.scheduleRasterTileTransaction({
      transactionId: transaction.transactionId,
      strokeId,
      beforeRevision: transaction.beforeRevision,
      afterRevision: transaction.afterRevision,
      patches,
    });
    await first.persistence.flushRecovery();
    expect(await first.history.undo()).toBe(true);
    const restore = first.history.takeLastTileRestore();
    if (restore === null) throw new Error('tile restore was not recorded');
    first.persistence.scheduleRasterTileRestore(restore.transactionId, restore.direction);
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
    expect(second.renderer.tiles.size).toBe(0);
    expect(await second.history.redo()).toBe(true);
    expect(second.renderer.tiles.size).toBe(1);
  });

  it('replays a legacy stroke snapshot once, then reopens from migrated raster tiles', async () => {
    const worker = new FakeStorageWorker();
    const store = new MemoryResumeStore();
    const first = createController(worker, store);
    const initialized = await first.persistence.initialize({
      name: 'Legacy migration',
      document: { width: 32, height: 32 },
    });
    const transaction = first.history.commitCompletedStroke(
      completeStroke(first.session, 20),
      tilePatches(first.session),
    );
    await first.persistence.markDirty(transaction.transactionId);
    await first.persistence.flushCheckpoint();
    const stored = worker.projects.get(initialized.projectId);
    if (stored === undefined || typeof stored.snapshot !== 'object' || stored.snapshot === null) {
      throw new Error('stored legacy fixture is missing');
    }
    const { raster: _raster, ...legacySnapshot } = stored.snapshot as Record<string, unknown>;
    stored.snapshot = legacySnapshot;
    first.persistence.dispose();

    const migrated = createController(worker, store);
    await migrated.persistence.initialize({
      name: 'ignored',
      document: { width: 1, height: 1 },
    });
    expect(migrated.renderer.restored).toHaveLength(1);
    expect(migrated.renderer.tiles.size).toBe(1);
    expect(worker.projects.get(initialized.projectId)?.snapshot).toMatchObject({
      raster: { schema: 'illustro.paint-raster-state/1', tileSize: 128 },
    });
    migrated.persistence.dispose();

    const reopened = createController(worker, store);
    await reopened.persistence.initialize({
      name: 'ignored again',
      document: { width: 1, height: 1 },
    });
    expect(reopened.renderer.restored).toHaveLength(0);
    expect(reopened.renderer.tiles.size).toBe(1);
  });
});
