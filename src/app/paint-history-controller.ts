import {
  createHistoryPayloadV1,
  createHistoryTransactionV1,
  HistorySpineV1,
  type HistorySpillAdapterV1,
  type HistorySpineStateV1,
  type HistoryTransactionV1,
} from '../history/history.js';
import { parseRevision } from '../domain/identity.js';
import {
  PaintSessionControllerV1,
  parsePaintProjectSnapshotV1,
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
    this.#revisionHighWater = this.#session.currentDocument()?.revision ?? 0;
    return this.snapshot();
  }

  hydrate(state: HistorySpineStateV1, revisionHighWater = 0): PaintHistorySnapshotV1 {
    this.#spine = HistorySpineV1.hydrate(state);
    this.#revisionHighWater = Math.max(
      revisionHighWater,
      this.#session.currentDocument()?.revision ?? 0,
    );
    return this.snapshot();
  }

  exportState(): HistorySpineStateV1 {
    return this.#spine.exportState();
  }

  commitCompletedStroke(strokeId: string): HistoryTransactionV1 {
    const before = this.#session.projectSnapshot();
    if (before === null) throw new Error('paint history requires an active document');
    if (this.#revisionHighWater >= Number.MAX_SAFE_INTEGER) {
      throw new RangeError('paint document revision high-water is exhausted');
    }
    const afterRevision = parseRevision(
      Math.max(this.#revisionHighWater, before.document.revision) + 1,
    );
    const committed = this.#session.commitCompletedPaintStroke(strokeId, afterRevision);
    if (committed === null) throw new Error(`completed paint stroke not found: ${strokeId}`);
    const transaction = createHistoryTransactionV1({
      transactionId: crypto.randomUUID(),
      commandId: 'brush.stroke',
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
      await this.#session.restoreProjectSnapshot(parsePaintProjectSnapshotV1(value));
    }, spillAdapter);
  }

  async redo(spillAdapter?: HistorySpillAdapterV1): Promise<boolean> {
    return this.#spine.redo(async (transaction, direction) => {
      const value = direction === 'undo' ? transaction.payload.before : transaction.payload.after;
      await this.#session.restoreProjectSnapshot(parsePaintProjectSnapshotV1(value));
    }, spillAdapter);
  }
}
