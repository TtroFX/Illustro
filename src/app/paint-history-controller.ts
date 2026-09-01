import {
  CONSERVATIVE_HISTORY_HOT_BUDGET_BYTES,
  createHistoryPayloadV1,
  createHistoryTransactionV1,
  HistorySpineV1,
  type HistorySpillAdapterV1,
  type HistorySpineStateV1,
  type HistoryTransactionV1,
} from '../history/history.js';
import { isCommandTransactionId } from '../domain/command-registry.js';
import { parseRevision, type Revision } from '../domain/identity.js';
import type {
  BaselineRasterTilePatchDirectionV1,
  BaselineRasterTilePatchV1,
} from '../gpu/baseline-raster-tile-store.js';
import {
  PaintSessionControllerV1,
  parsePaintProjectSnapshotV1,
  parsePaintStrokeHistoryStateV1,
  parsePaintTileHistoryStateV1,
  type PaintDocumentSettingsUpdateV1,
} from './paint-session-controller.js';

export interface PaintHistorySnapshotV1 {
  readonly schema: 'illustro.paint-history/1';
  readonly length: number;
  readonly cursor: number;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly revisionHighWater: number;
}

export interface PaintTileHistoryRestoreV1 {
  readonly transactionId: string;
  readonly direction: BaselineRasterTilePatchDirectionV1;
}

export type PaintTilePatchLoaderV1 = (
  transactionId: string,
) => Promise<readonly BaselineRasterTilePatchV1[] | null>;

function tilePatchByteLength(patches: readonly BaselineRasterTilePatchV1[]): number {
  let total = 0;
  for (const patch of patches) {
    total += patch.before?.bytes.byteLength ?? 0;
    total += patch.after?.bytes.byteLength ?? 0;
  }
  return total;
}

export class PaintHistoryControllerV1 {
  readonly #session: PaintSessionControllerV1;
  #spine = new HistorySpineV1();
  #revisionHighWater = 0;
  readonly #tilePatches = new Map<string, readonly BaselineRasterTilePatchV1[]>();
  readonly #tilePatchBytes = new Map<string, number>();
  readonly #durableTilePatchIds = new Set<string>();
  #residentTilePatchBytes = 0;
  #tilePatchLoader: PaintTilePatchLoaderV1 | null = null;
  #lastTileRestore: PaintTileHistoryRestoreV1 | null = null;

  constructor(session: PaintSessionControllerV1) {
    this.#session = session;
  }

  snapshot(): PaintHistorySnapshotV1 {
    return Object.freeze({
      schema: 'illustro.paint-history/1' as const,
      length: this.#spine.length,
      cursor: this.#spine.cursor,
      canUndo: this.#spine.canUndo,
      canRedo: this.#spine.canRedo,
      revisionHighWater: this.#revisionHighWater,
    });
  }

  reset(): PaintHistorySnapshotV1 {
    this.#spine = new HistorySpineV1();
    this.#clearTilePatches();
    this.#lastTileRestore = null;
    this.#revisionHighWater = this.#session.currentDocument()?.revision ?? 0;
    return this.snapshot();
  }

  hydrate(state: HistorySpineStateV1, revisionHighWater = 0): PaintHistorySnapshotV1 {
    this.#spine = HistorySpineV1.hydrate(state);
    this.#clearTilePatches();
    this.#lastTileRestore = null;
    this.#revisionHighWater = Math.max(
      revisionHighWater,
      this.#session.currentDocument()?.revision ?? 0,
    );
    return this.snapshot();
  }

  exportState(): HistorySpineStateV1 {
    return this.#spine.exportState();
  }

  commitCompletedStroke(
    strokeId: string,
    tilePatches: readonly BaselineRasterTilePatchV1[],
  ): HistoryTransactionV1 {
    const document = this.#session.currentDocument();
    if (document === null) throw new Error('paint history requires an active document');
    if (tilePatches.length === 0) throw new Error('paint stroke history requires tile patches');
    if (this.#revisionHighWater >= Number.MAX_SAFE_INTEGER) {
      throw new RangeError('paint document revision high-water is exhausted');
    }
    const afterRevision = parseRevision(Math.max(this.#revisionHighWater, document.revision) + 1);
    const committed = this.#session.commitCompletedPaintStroke(strokeId, afterRevision);
    if (committed === null) throw new Error(`completed paint stroke not found: ${strokeId}`);
    const transactionId = crypto.randomUUID();
    const affectedTiles = Object.freeze(
      tilePatches.map((patch) =>
        Object.freeze({
          layerId: patch.layerId,
          tx: patch.coordinate.tx,
          ty: patch.coordinate.ty,
        }),
      ),
    );
    const sharedTileState = {
      schema: 'illustro.paint-tile-history/1' as const,
      strokeId,
      affectedTiles,
    };
    const transaction = createHistoryTransactionV1({
      transactionId,
      commandId: 'brush.stroke',
      beforeRevision: committed.beforeRevision,
      afterRevision: committed.afterRevision,
      payload: createHistoryPayloadV1({
        strategy: 'tile-patch-set',
        before: {
          ...sharedTileState,
          revision: committed.beforeRevision,
          modifiedAt: committed.beforeModifiedAt,
          present: false,
        },
        after: {
          ...sharedTileState,
          revision: committed.afterRevision,
          modifiedAt: committed.afterModifiedAt,
          present: true,
        },
      }),
    });
    const previousState = this.#spine.exportState();
    for (const entry of previousState.entries.slice(previousState.cursor)) {
      this.#deleteTilePatches(
        entry.storage === 'resident'
          ? entry.transaction.transactionId
          : entry.reference.transactionId,
      );
    }
    this.#spine.commit(transaction);
    this.#storeTilePatches(transactionId, tilePatches, false);
    for (const removedId of this.#spine.prune()) this.#deleteTilePatches(removedId);
    this.#revisionHighWater = Math.max(this.#revisionHighWater, committed.afterRevision);
    return transaction;
  }

  bindTilePatches(transactionId: string, patches: readonly BaselineRasterTilePatchV1[]): void {
    if (!isCommandTransactionId(transactionId) || patches.length === 0) {
      throw new TypeError('tile history binding requires an identity and patches');
    }
    this.#storeTilePatches(transactionId, patches, true);
  }

  tilePatches(transactionId: string): readonly BaselineRasterTilePatchV1[] | null {
    return this.#tilePatches.get(transactionId) ?? null;
  }

  setTilePatchLoader(loader: PaintTilePatchLoaderV1 | null): void {
    this.#tilePatchLoader = loader;
  }

  markTilePatchesDurable(transactionId: string): void {
    if (!isCommandTransactionId(transactionId)) {
      throw new TypeError('durable tile history transactionId must be a UUID');
    }
    this.#durableTilePatchIds.add(transactionId);
    this.#enforceTilePatchBudget();
  }

  residentTilePatchByteLength(): number {
    return this.#residentTilePatchBytes;
  }

  takeLastTileRestore(): PaintTileHistoryRestoreV1 | null {
    const restore = this.#lastTileRestore;
    this.#lastTileRestore = null;
    return restore;
  }

  async commitSnapshotTransform(
    commandId: string,
    transform: (
      before: ReturnType<PaintSessionControllerV1['projectSnapshot']> extends infer Snapshot
        ? Exclude<Snapshot, null>
        : never,
      revision: Revision,
    ) => ReturnType<PaintSessionControllerV1['projectSnapshot']> extends infer Snapshot
      ? Exclude<Snapshot, null>
      : never,
  ): Promise<HistoryTransactionV1> {
    const before = this.#session.projectSnapshot();
    if (before === null) throw new Error('document transform history requires an active document');
    if (this.#revisionHighWater >= Number.MAX_SAFE_INTEGER) {
      throw new RangeError('paint document revision high-water is exhausted');
    }
    const afterRevision = parseRevision(
      Math.max(this.#revisionHighWater, before.document.revision) + 1,
    );
    const after = transform(before, afterRevision);
    if (
      after.document.documentId !== before.document.documentId ||
      after.document.projectId !== before.document.projectId
    ) {
      throw new Error('document transform must preserve project/document identity');
    }
    if (after.document.revision !== afterRevision) {
      throw new Error('document transform must use the assigned revision');
    }
    const transaction = createHistoryTransactionV1({
      transactionId: crypto.randomUUID(),
      commandId,
      beforeRevision: before.document.revision,
      afterRevision,
      payload: createHistoryPayloadV1({ strategy: 'object-before-after', before, after }),
    });
    await this.#session.restoreProjectSnapshot(after);
    this.#spine.commit(transaction);
    this.#revisionHighWater = Math.max(this.#revisionHighWater, afterRevision);
    return transaction;
  }

  commitDocumentSettings(input: PaintDocumentSettingsUpdateV1): HistoryTransactionV1 {
    const before = this.#session.projectSnapshot();
    if (before === null) throw new Error('document settings history requires an active document');
    if (this.#revisionHighWater >= Number.MAX_SAFE_INTEGER) {
      throw new RangeError('paint document revision high-water is exhausted');
    }
    const afterRevision = parseRevision(
      Math.max(this.#revisionHighWater, before.document.revision) + 1,
    );
    const committed = this.#session.commitDocumentSettings(input, afterRevision);
    const transaction = createHistoryTransactionV1({
      transactionId: crypto.randomUUID(),
      commandId: 'document.settings.update',
      beforeRevision: committed.before.document.revision,
      afterRevision: committed.after.document.revision,
      payload: createHistoryPayloadV1({
        strategy: 'object-before-after',
        before: committed.before,
        after: committed.after,
      }),
    });
    this.#spine.commit(transaction);
    this.#revisionHighWater = Math.max(this.#revisionHighWater, committed.after.document.revision);
    return transaction;
  }

  async undo(spillAdapter?: HistorySpillAdapterV1): Promise<boolean> {
    this.#lastTileRestore = null;
    return this.#spine.undo(async (transaction, direction) => {
      const value = direction === 'undo' ? transaction.payload.before : transaction.payload.after;
      if (
        transaction.commandId === 'brush.stroke' &&
        transaction.payload.strategy === 'tile-patch-set'
      ) {
        const patches = await this.#resolveTilePatches(transaction.transactionId);
        await this.#session.restoreTileHistoryState(
          parsePaintTileHistoryStateV1(value),
          patches,
          'before',
        );
        this.#lastTileRestore = Object.freeze({
          transactionId: transaction.transactionId,
          direction: 'before',
        });
        return;
      }
      if (
        transaction.commandId === 'brush.stroke' &&
        transaction.payload.strategy === 'typed-before-after'
      ) {
        await this.#session.restoreStrokeHistoryState(parsePaintStrokeHistoryStateV1(value));
        return;
      }
      await this.#session.restoreProjectSnapshot(parsePaintProjectSnapshotV1(value));
    }, spillAdapter);
  }

  async redo(spillAdapter?: HistorySpillAdapterV1): Promise<boolean> {
    this.#lastTileRestore = null;
    return this.#spine.redo(async (transaction, direction) => {
      const value = direction === 'undo' ? transaction.payload.before : transaction.payload.after;
      if (
        transaction.commandId === 'brush.stroke' &&
        transaction.payload.strategy === 'tile-patch-set'
      ) {
        const patches = await this.#resolveTilePatches(transaction.transactionId);
        await this.#session.restoreTileHistoryState(
          parsePaintTileHistoryStateV1(value),
          patches,
          'after',
        );
        this.#lastTileRestore = Object.freeze({
          transactionId: transaction.transactionId,
          direction: 'after',
        });
        return;
      }
      if (
        transaction.commandId === 'brush.stroke' &&
        transaction.payload.strategy === 'typed-before-after'
      ) {
        await this.#session.restoreStrokeHistoryState(parsePaintStrokeHistoryStateV1(value));
        return;
      }
      await this.#session.restoreProjectSnapshot(parsePaintProjectSnapshotV1(value));
    }, spillAdapter);
  }

  #storeTilePatches(
    transactionId: string,
    patches: readonly BaselineRasterTilePatchV1[],
    durable: boolean,
  ): void {
    this.#deleteTilePatches(transactionId);
    const frozen = Object.freeze([...patches]);
    const byteLength = tilePatchByteLength(frozen);
    this.#tilePatches.set(transactionId, frozen);
    this.#tilePatchBytes.set(transactionId, byteLength);
    this.#residentTilePatchBytes += byteLength;
    if (durable) this.#durableTilePatchIds.add(transactionId);
    this.#enforceTilePatchBudget();
  }

  #deleteTilePatches(transactionId: string): void {
    this.#tilePatches.delete(transactionId);
    this.#residentTilePatchBytes -= this.#tilePatchBytes.get(transactionId) ?? 0;
    this.#tilePatchBytes.delete(transactionId);
    this.#durableTilePatchIds.delete(transactionId);
  }

  #clearTilePatches(): void {
    this.#tilePatches.clear();
    this.#tilePatchBytes.clear();
    this.#durableTilePatchIds.clear();
    this.#residentTilePatchBytes = 0;
  }

  #enforceTilePatchBudget(): void {
    if (this.#residentTilePatchBytes <= CONSERVATIVE_HISTORY_HOT_BUDGET_BYTES) return;
    for (const transactionId of this.#tilePatches.keys()) {
      if (!this.#durableTilePatchIds.has(transactionId)) continue;
      this.#deleteTilePatches(transactionId);
      if (this.#residentTilePatchBytes <= CONSERVATIVE_HISTORY_HOT_BUDGET_BYTES) break;
    }
  }

  async #resolveTilePatches(transactionId: string): Promise<readonly BaselineRasterTilePatchV1[]> {
    const resident = this.#tilePatches.get(transactionId);
    if (resident !== undefined) return resident;
    const loaded = await this.#tilePatchLoader?.(transactionId);
    if (loaded === undefined || loaded === null || loaded.length === 0) {
      throw new Error(`paint tile history payload is unavailable: ${transactionId}`);
    }
    this.#storeTilePatches(transactionId, loaded, true);
    return loaded;
  }
}
