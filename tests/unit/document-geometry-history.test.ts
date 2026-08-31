import { describe, expect, it } from 'vitest';
import { PaintHistoryControllerV1 } from '../../src/app/paint-history-controller.js';
import { resizeCanvasSnapshotV1 } from '../../src/app/document-geometry.js';
import { PaintSessionControllerV1 } from '../../src/app/paint-session-controller.js';
import type { BaselineBrushDabV1 } from '../../src/gpu/baseline-brush.js';

class Renderer {
  async configureDocument(): Promise<void> {}
  async restoreBaselineStrokes(
    _strokes: readonly {
      readonly strokeId: string;
      readonly dabs: readonly BaselineBrushDabV1[];
    }[],
  ): Promise<void> {}
}

describe('M5A geometry history', () => {
  it('commits canvas resize as one exact undo/redo transaction', async () => {
    const session = new PaintSessionControllerV1(new Renderer());
    await session.createNewDocument({ width: 100, height: 80 });
    const history = new PaintHistoryControllerV1(session);
    history.reset();
    const transaction = await history.commitSnapshotTransform(
      'document.canvas.resize',
      (before, revision) =>
        resizeCanvasSnapshotV1(
          before,
          { width: 120, height: 90, offsetX: 10, offsetY: 5 },
          revision,
        ),
    );
    expect(transaction.commandId).toBe('document.canvas.resize');
    expect(session.currentDocument()?.canvas).toMatchObject({ width: 120, height: 90 });
    expect(history.snapshot()).toMatchObject({ length: 1, cursor: 1 });
    expect(await history.undo()).toBe(true);
    expect(session.currentDocument()?.canvas).toMatchObject({ width: 100, height: 80 });
    expect(await history.redo()).toBe(true);
    expect(session.currentDocument()?.canvas).toMatchObject({ width: 120, height: 90 });
  });
});
