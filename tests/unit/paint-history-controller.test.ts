import { describe, expect, it } from 'vitest';
import { PaintHistoryControllerV1 } from '../../src/app/paint-history-controller.js';
import { PaintSessionControllerV1 } from '../../src/app/paint-session-controller.js';
import type { BaselineBrushDabV1 } from '../../src/gpu/baseline-brush.js';
import type {
  PointerInputBatchV1,
  PointerInputEventTypeV1,
  PointerInputSampleV1,
} from '../../src/input/pointer-input.js';

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

async function completeStroke(session: PaintSessionControllerV1, start: number): Promise<string> {
  session.ingestPointerBatch(batch('pointerdown', start));
  const strokeId = session.activeStroke()?.strokeId;
  if (strokeId === undefined) throw new Error('stroke did not start');
  session.ingestPointerBatch(batch('pointermove', start + 1));
  session.ingestPointerBatch(batch('pointerup', start + 2));
  return strokeId;
}

describe('M4 stroke history vertical slice', () => {
  it('commits one whole stroke as exactly one history transaction', async () => {
    const renderer = new FakeRenderer();
    const session = new PaintSessionControllerV1(renderer);
    await session.createNewDocument({ width: 256, height: 256 });
    const history = new PaintHistoryControllerV1(session);
    history.reset();

    const strokeId = await completeStroke(session, 1);
    const transaction = history.commitCompletedStroke(strokeId);

    expect(transaction.commandId).toBe('brush.stroke');
    expect(transaction.payload.strategy).toBe('typed-before-after');
    expect(JSON.stringify(transaction.payload)).toContain('illustro.paint-stroke-history/1');
    expect(JSON.stringify(transaction.payload)).not.toContain('illustro.paint-project-snapshot/1');
    expect(transaction.beforeRevision).toBe(0);
    expect(transaction.afterRevision).toBe(1);
    expect(history.snapshot()).toMatchObject({
      length: 1,
      cursor: 1,
      canUndo: true,
      canRedo: false,
    });
    expect(session.snapshot()).toMatchObject({
      pendingCompletedStrokeCount: 0,
      committedStrokeCount: 1,
    });
  });

  it('undoes and redoes the exact committed paint snapshot', async () => {
    const renderer = new FakeRenderer();
    const session = new PaintSessionControllerV1(renderer);
    await session.createNewDocument({ width: 256, height: 256 });
    const history = new PaintHistoryControllerV1(session);
    history.reset();
    history.commitCompletedStroke(await completeStroke(session, 10));

    expect(await history.undo()).toBe(true);
    expect(session.snapshot().committedStrokeCount).toBe(0);
    expect(history.snapshot()).toMatchObject({ cursor: 0, canUndo: false, canRedo: true });
    expect(renderer.restored.at(-1)).toEqual([]);

    expect(await history.redo()).toBe(true);
    expect(session.snapshot().committedStrokeCount).toBe(1);
    expect(history.snapshot()).toMatchObject({ cursor: 1, canUndo: true, canRedo: false });
    expect(renderer.restored.at(-1)).toHaveLength(1);
  });

  it('invalidates redo on a new stroke while keeping revision identities monotonic', async () => {
    const session = new PaintSessionControllerV1(new FakeRenderer());
    await session.createNewDocument({ width: 256, height: 256 });
    const history = new PaintHistoryControllerV1(session);
    history.reset();
    const first = history.commitCompletedStroke(await completeStroke(session, 20));
    expect(first.afterRevision).toBe(1);
    await history.undo();

    const branch = history.commitCompletedStroke(await completeStroke(session, 30));
    expect(branch.beforeRevision).toBe(0);
    expect(branch.afterRevision).toBe(2);
    expect(history.snapshot()).toMatchObject({
      length: 1,
      cursor: 1,
      canRedo: false,
      revisionHighWater: 2,
    });
  });
});
