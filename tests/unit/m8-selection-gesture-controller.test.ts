import { describe, expect, it } from 'vitest';
import {
  LatestSelectionCommitGateV1,
  M8_SELECTION_DEFAULT_MODE_V1,
  lassoHasNonZeroAreaV1,
  mapStagePointToDocumentV1,
  resolveSelectionModeForPointerV1,
} from '../../src/app/m8-selection-gesture-controller.js';
import type { ViewportSnapshotV1 } from '../../src/app/viewport-controller.js';

function viewport(overrides: Partial<ViewportSnapshotV1> = {}): ViewportSnapshotV1 {
  return Object.freeze({
    schema: 'illustro.viewport-state/1' as const,
    documentWidth: 100,
    documentHeight: 100,
    stageWidth: 100,
    stageHeight: 100,
    baseWidth: 100,
    baseHeight: 100,
    panX: 0,
    panY: 0,
    zoom: 1,
    rotationDegrees: 0,
    mirrored: false,
    pixelated: false,
    workspacePresentation: false,
    ...overrides,
  });
}

describe('M8E lasso gesture contract', () => {
  it('defaults to additive union behavior while retaining explicit Set/Subtract/Intersect modes', () => {
    expect(M8_SELECTION_DEFAULT_MODE_V1).toBe('add');
    expect(
      resolveSelectionModeForPointerV1(M8_SELECTION_DEFAULT_MODE_V1, {
        shiftKey: false,
        altKey: false,
      }),
    ).toBe('add');
    expect(resolveSelectionModeForPointerV1('replace', { shiftKey: true, altKey: false })).toBe(
      'add',
    );
    expect(resolveSelectionModeForPointerV1('add', { shiftKey: false, altKey: true })).toBe(
      'subtract',
    );
    expect(resolveSelectionModeForPointerV1('add', { shiftKey: true, altKey: true })).toBe(
      'intersect',
    );
  });

  it('invalidates older asynchronous commits as soon as a newer lasso starts', () => {
    const gate = new LatestSelectionCommitGateV1();
    const first = gate.begin();
    expect(first.signal.aborted).toBe(false);
    expect(gate.isCurrent(first.generation)).toBe(true);

    const second = gate.begin();
    expect(first.signal.aborted).toBe(true);
    expect(gate.isCurrent(first.generation)).toBe(false);
    expect(second.signal.aborted).toBe(false);
    expect(gate.isCurrent(second.generation)).toBe(true);

    gate.invalidate();
    expect(second.signal.aborted).toBe(true);
    expect(gate.isCurrent(second.generation)).toBe(false);
  });

  it('rejects degenerate collinear lassos in linear time semantics', () => {
    expect(
      lassoHasNonZeroAreaV1([
        { x: 0, y: 0 },
        { x: 1, y: 1 },
        { x: 2, y: 2 },
        { x: 3, y: 3 },
      ]),
    ).toBe(false);
    expect(
      lassoHasNonZeroAreaV1([
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 6, y: 8 },
      ]),
    ).toBe(true);
  });

  it('maps captured stage samples into stable document coordinates through viewport transforms', () => {
    expect(mapStagePointToDocumentV1(25, 75, viewport())).toEqual({ x: 25, y: 75 });
    expect(mapStagePointToDocumentV1(75, 50, viewport({ mirrored: true }))).toEqual({
      x: 25,
      y: 50,
    });
    const rotated = mapStagePointToDocumentV1(50, 25, viewport({ rotationDegrees: 90 }));
    expect(rotated.x).toBeCloseTo(25, 8);
    expect(rotated.y).toBeCloseTo(50, 8);
  });
});
