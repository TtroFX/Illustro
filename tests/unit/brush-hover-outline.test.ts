import { describe, expect, it } from 'vitest';
import { resolveBrushHoverOutlinePresentationV1 } from '../../src/app/brush-hover-outline-controller.js';
import type { PointerHoverSnapshotV1 } from '../../src/input/hover-state.js';

function hover(overrides: Partial<PointerHoverSnapshotV1> = {}): PointerHoverSnapshotV1 {
  return Object.freeze({
    schema: 'illustro.pointer-hover-state/1',
    active: true,
    source: 'pen',
    pointerId: 7,
    clientX: 260,
    clientY: 145,
    surfaceX: 250,
    surfaceY: 125,
    pressure: 0,
    tiltX: 0,
    tiltY: 0,
    twist: 0,
    altitudeAngle: null,
    azimuthAngle: null,
    timestampMs: 20,
    ...overrides,
  });
}

const viewport = Object.freeze({
  documentWidth: 1000,
  documentHeight: 500,
  baseWidth: 500,
  baseHeight: 250,
  zoom: 2,
});

describe('M6A hover brush outline presentation', () => {
  it('projects nominal brush diameter through viewport zoom in screen space', () => {
    const presentation = resolveBrushHoverOutlinePresentationV1({
      hover: hover(),
      stageLeft: 10,
      stageTop: 20,
      documentX: 500,
      documentY: 250,
      documentWidth: 1000,
      documentHeight: 500,
      brushSizePx: 64,
      viewport,
    });

    expect(presentation).toEqual({
      visible: true,
      xCssPx: 250,
      yCssPx: 125,
      diameterCssPx: 64,
    });
  });

  it('hides the outline when hover is inactive or mapped outside the document', () => {
    const base = {
      stageLeft: 10,
      stageTop: 20,
      documentWidth: 1000,
      documentHeight: 500,
      brushSizePx: 64,
      viewport,
    } as const;
    expect(
      resolveBrushHoverOutlinePresentationV1({
        ...base,
        hover: hover({ active: false }),
        documentX: 500,
        documentY: 250,
      }).visible,
    ).toBe(false);
    expect(
      resolveBrushHoverOutlinePresentationV1({
        ...base,
        hover: hover(),
        documentX: 1001,
        documentY: 250,
      }).visible,
    ).toBe(false);
  });

  it('keeps pointer center independent from zoom while changing only projected diameter', () => {
    const input = {
      hover: hover(),
      stageLeft: 10,
      stageTop: 20,
      documentX: 500,
      documentY: 250,
      documentWidth: 1000,
      documentHeight: 500,
      brushSizePx: 20,
    } as const;
    const atOne = resolveBrushHoverOutlinePresentationV1({
      ...input,
      viewport: { ...viewport, zoom: 1 },
    });
    const atFour = resolveBrushHoverOutlinePresentationV1({
      ...input,
      viewport: { ...viewport, zoom: 4 },
    });

    expect(atOne.xCssPx).toBe(atFour.xCssPx);
    expect(atOne.yCssPx).toBe(atFour.yCssPx);
    expect(atFour.diameterCssPx).toBe(atOne.diameterCssPx * 4);
  });
});
