import {
  createHistoryPayloadV1,
  createHistoryTransactionV1,
  HistorySpineV1,
  type HistorySpillAdapterV1,
  type HistorySpineStateV1,
  type HistoryTransactionV1,
} from '../history/history.js';
import { parseRevision, type Revision } from '../domain/identity.js';
import type { BaselineRasterTilePatchV1 } from '../gpu/baseline-raster-tile-store.js';
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

export class PaintHistoryControllerV1 {
  readonly #session: PaintSessionControllerV1;
  #spine = new HistorySpineV1();
  #revisionHighWater = 0;
  readonly #tilePatches = new Map<string, readonly BaselineRasterTilePatchV1[]>();

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
    this.#tilePatches.clear();
    this.#revisionHighWater = this.#session.currentDocument()?.revision ?? 0;
    return this.snapshot();
  }

  hydrate(state: HistorySpineStateV1, revisionHighWater = 0): PaintHistorySnapshotV1 {
    this.#spine = HistorySpineV1.hydrate(state);
    this.#tilePatches.clear();
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
      this.#tilePatches.delete(
        entry.storage === 'resident'
          ? entry.transaction.transactionId
          : entry.reference.transactionId,
      );
    }
    this.#spine.commit(transaction);
    this.#tilePatches.set(transactionId, Object.freeze([...tilePatches]));
    for (const removedId of this.#spine.prune()) this.#tilePatches.delete(removedId);
    this.#revisionHighWater = Math.max(this.#revisionHighWater, committed.afterRevision);
    return transaction;
  }

  bindTilePatches(transactionId: string, patches: readonly BaselineRasterTilePatchV1[]): void {
    if (transactionId.length === 0 || patches.length === 0) {
      throw new TypeError('tile history binding requires an identity and patches');
    }
    this.#tilePatches.set(transactionId, Object.freeze([...patches]));
  }

  tilePatches(transactionId: string): readonly BaselineRasterTilePatchV1[] | null {
    return this.#tilePatches.get(transactionId) ?? null;
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
    return this.#spine.undo(async (transaction, direction) => {
      const value = direction === 'undo' ? transaction.payload.before : transaction.payload.after;
      if (
        transaction.commandId === 'brush.stroke' &&
        transaction.payload.strategy === 'tile-patch-set'
      ) {
        const patches = this.#tilePatches.get(transaction.transactionId);
        if (patches === undefined) {
          throw new Error(
            `paint tile history payload is not resident: ${transaction.transactionId}`,
          );
        }
        await this.#session.restoreTileHistoryState(
          parsePaintTileHistoryStateV1(value),
          patches,
          'before',
        );
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
    return this.#spine.redo(async (transaction, direction) => {
      const value = direction === 'undo' ? transaction.payload.before : transaction.payload.after;
      if (
        transaction.commandId === 'brush.stroke' &&
        transaction.payload.strategy === 'tile-patch-set'
      ) {
        const patches = this.#tilePatches.get(transaction.transactionId);
        if (patches === undefined) {
          throw new Error(
            `paint tile history payload is not resident: ${transaction.transactionId}`,
          );
        }
        await this.#session.restoreTileHistoryState(
          parsePaintTileHistoryStateV1(value),
          patches,
          'after',
        );
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
}
