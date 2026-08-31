import { describe, expect, it } from 'vitest';
import { ViewportTransformV1 } from '../../src/app/viewport-controller.js';

describe('M5A viewport transform', () => {
  it('fits document aspect ratio and maps viewport center to document center', () => {
    const viewport = new ViewportTransformV1();
    viewport.setStageSize(1000, 800);
    const state = viewport.setDocumentSize(2000, 1000);
    expect(state.baseWidth / state.baseHeight).toBeCloseTo(2);
    expect(viewport.mapStageToDocument(500, 400)).toEqual({ x: 1000, y: 500 });
  });

  it('keeps an anchored document point stable while zooming and rotating', () => {
    const viewport = new ViewportTransformV1();
    viewport.setStageSize(1000, 800);
    viewport.setDocumentSize(1000, 1000);
    const before = viewport.mapStageToDocument(650, 430);
    viewport.zoomAt(650, 430, 3);
    viewport.rotateAt(650, 430, 37);
    const after = viewport.mapStageToDocument(650, 430);
    expect(after.x).toBeCloseTo(before.x, 8);
    expect(after.y).toBeCloseTo(before.y, 8);
  });

  it('supports pan, mirror preview, reset and rotated fit without document mutation', () => {
    const viewport = new ViewportTransformV1();
    viewport.setStageSize(900, 700);
    viewport.setDocumentSize(1200, 600);
    viewport.panBy(30, -20);
    expect(viewport.snapshot()).toMatchObject({ panX: 30, panY: -20 });
    const left = viewport.mapStageToDocument(350, 350).x;
    viewport.toggleMirror();
    const mirroredLeft = viewport.mapStageToDocument(350, 350).x;
    expect(mirroredLeft).toBeGreaterThan(left);
    viewport.setRotation(90);
    const fitted = viewport.fitToScreen();
    expect(fitted.zoom).toBeLessThanOrEqual(1);
    viewport.resetView();
    expect(viewport.snapshot()).toMatchObject({
      panX: 0,
      panY: 0,
      zoom: 1,
      rotationDegrees: 0,
      mirrored: true,
    });
  });

  it('clamps zoom to the production viewport bounds', () => {
    const viewport = new ViewportTransformV1();
    viewport.setStageSize(800, 600);
    viewport.setDocumentSize(800, 600);
    viewport.zoomAt(400, 300, 1000);
    expect(viewport.snapshot().zoom).toBe(64);
    viewport.zoomAt(400, 300, 0.0001);
    expect(viewport.snapshot().zoom).toBe(0.05);
  });
});
