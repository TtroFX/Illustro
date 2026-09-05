import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  initialSelectionTransformStateV1,
  projectDocumentPointToStageV1,
  selectionTransformHasChangesV1,
  selectionTransformPreviewMatrixV1,
  updateSelectionTransformDragV1,
} from '../../src/app/m8-selection-transform-controller.js';
import type { ViewportSnapshotV1 } from '../../src/app/viewport-controller.js';

function viewport(input: Partial<ViewportSnapshotV1> = {}): ViewportSnapshotV1 {
  return Object.freeze({
    schema: 'illustro.viewport-state/1' as const,
    documentWidth: 100,
    documentHeight: 100,
    stageWidth: 200,
    stageHeight: 200,
    baseWidth: 100,
    baseHeight: 100,
    panX: 0,
    panY: 0,
    zoom: 1,
    rotationDegrees: 0,
    mirrored: false,
    pixelated: false,
    workspacePresentation: false,
    ...input,
  });
}

describe('M8E selection transform controller', () => {
  it('starts as an identity transform around the exact contour center', () => {
    const state = initialSelectionTransformStateV1({
      minX: 10,
      minY: 20,
      maxX: 30,
      maxY: 60,
    });
    expect(state).toEqual({
      translateX: 0,
      translateY: 0,
      scaleX: 1,
      scaleY: 1,
      rotationDeg: 0,
      pivotX: 20,
      pivotY: 40,
    });
    expect(selectionTransformHasChangesV1(state)).toBe(false);
    expect(selectionTransformPreviewMatrixV1(state)).toEqual([1, 0, 0, 1, 0, 0]);
  });

  it('updates move, scale and rotation from direct handle drags without rasterizing', () => {
    const base = initialSelectionTransformStateV1({
      minX: 10,
      minY: 20,
      maxX: 30,
      maxY: 60,
    });
    const moved = updateSelectionTransformDragV1(base, 'move', { x: 1, y: 1 }, { x: 6, y: -2 });
    expect(moved.translateX).toBe(5);
    expect(moved.translateY).toBe(-3);

    const scaled = updateSelectionTransformDragV1(base, 'se', { x: 30, y: 60 }, { x: 40, y: 80 });
    expect(scaled.scaleX).toBe(2);
    expect(scaled.scaleY).toBe(2);

    const rotated = updateSelectionTransformDragV1(
      base,
      'rotate',
      { x: 30, y: 40 },
      { x: 20, y: 50 },
    );
    expect(rotated.rotationDeg).toBeCloseTo(90);
  });

  it('moves the pivot without moving the current transformed geometry', () => {
    const state = {
      translateX: 7,
      translateY: -4,
      scaleX: 1.5,
      scaleY: 0.75,
      rotationDeg: 32,
      pivotX: 20,
      pivotY: 40,
    } as const;
    const before = selectionTransformPreviewMatrixV1(state);
    const rebased = updateSelectionTransformDragV1(
      state,
      'pivot',
      { x: 20, y: 40 },
      { x: 13, y: 27 },
    );
    const after = selectionTransformPreviewMatrixV1(rebased);
    for (let index = 0; index < before.length; index += 1) {
      expect(after[index]).toBeCloseTo(before[index] ?? 0, 10);
    }
    expect(rebased.pivotX).toBe(13);
    expect(rebased.pivotY).toBe(27);
  });

  it('projects transform handles through viewport pan, zoom, rotation and mirror geometry', () => {
    expect(projectDocumentPointToStageV1({ x: 50, y: 50 }, viewport())).toEqual({
      x: 100,
      y: 100,
    });
    expect(projectDocumentPointToStageV1({ x: 0, y: 0 }, viewport())).toEqual({
      x: 50,
      y: 50,
    });
    expect(
      projectDocumentPointToStageV1(
        { x: 0, y: 0 },
        viewport({ mirrored: true, panX: 10, panY: -5 }),
      ),
    ).toEqual({ x: 160, y: 45 });
  });

  it('commits only once through the canonical History and Persistence transaction path', () => {
    const source = readFileSync('src/app/m8-selection-transform-controller.ts', 'utf8');
    expect(source).toContain('prepareSelectionAffineTransformV1');
    expect(source).toContain('input.paintHistory.commitSnapshotTransform(');
    expect(source).toContain("'selection.transform'");
    expect(source).toContain('applyPreparedSelectionTransformV1');
    expect(source).toContain('paintPersistence.markDirty(transaction.transactionId)');
    expect(source).toContain('selectionCoverage.clear()');
    const moveStart = source.indexOf('const onPointerMove');
    const moveEnd = source.indexOf('const finishDrag', moveStart);
    expect(moveStart).toBeGreaterThanOrEqual(0);
    expect(moveEnd).toBeGreaterThan(moveStart);
    expect(source.slice(moveStart, moveEnd)).not.toContain('prepareSelectionAffineTransformV1');
  });

  it('uses canonical on-canvas handle styling with coarse-pointer hit targets', () => {
    const css = readFileSync('public/m8-selection-launcher.css', 'utf8');
    expect(css).toContain('.m8e-transform-controls');
    expect(css).toContain('.m8e-transform-move-surface');
    expect(css).toContain('.m8e-transform-handle-rotate');
    expect(css).toContain('.m8e-transform-handle-pivot');
    expect(css).toContain('@media (max-width: 799px), (pointer: coarse)');
  });
});
