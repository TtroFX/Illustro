import { describe, expect, it } from 'vitest';
import {
  brushFlowMaximumResponseV1,
  brushOpacityMaximumResponseV1,
  brushSizeMaximumResponseV1,
  createBaselineBrushPresetV1,
  withBrushFlowMaximumResponseV1,
  withBrushFlowMinimumResponseV1,
  withBrushOpacityMaximumResponseV1,
  withBrushOpacityMinimumResponseV1,
  withBrushSizeMaximumResponseV1,
  withBrushSizeMinimumResponseV1,
} from '../../src/domain/brush-schema.js';
import { CanonicalRasterBrushStrokeV1 } from '../../src/app/canonical-raster-brush.js';
import { PaintSessionControllerV1 } from '../../src/app/paint-session-controller.js';
import { BaselineBrushDabBuilderV1 } from '../../src/gpu/baseline-brush.js';

class FakeRendererDocumentPort {
  async configureDocument(): Promise<void> {}
  async restoreBaselineStrokes(): Promise<void> {}
  async applyBaselineTilePatches(): Promise<void> {}
  async restoreBaselineCanonicalTiles(): Promise<void> {}
  async exportBaselineCanonicalTiles(): Promise<readonly never[]> {
    return [];
  }
  async exportBaselineCompositeTiles(): Promise<readonly never[]> {
    return [];
  }
}

describe('M6A-050 maximum response', () => {
  it('defaults each dynamic target maximum to one and persists bounded values', () => {
    const preset = createBaselineBrushPresetV1({
      id: 'maximum.response',
      name: 'Maximum Response',
      category: 'Test',
      behavior: 'paint',
    });
    expect(brushSizeMaximumResponseV1(preset)).toBe(1);
    expect(brushOpacityMaximumResponseV1(preset)).toBe(1);
    expect(brushFlowMaximumResponseV1(preset)).toBe(1);
    expect(brushSizeMaximumResponseV1(withBrushSizeMaximumResponseV1(preset, 0.75))).toBe(0.75);
    expect(brushOpacityMaximumResponseV1(withBrushOpacityMaximumResponseV1(preset, 0.6))).toBe(0.6);
    expect(brushFlowMaximumResponseV1(withBrushFlowMaximumResponseV1(preset, 0.5))).toBe(0.5);
  });

  it('enforces minimum less than or equal to maximum in preset helpers', () => {
    const preset = createBaselineBrushPresetV1({
      id: 'bounds.response',
      name: 'Bounds Response',
      category: 'Test',
      behavior: 'paint',
    });
    const sizeMin = withBrushSizeMinimumResponseV1(preset, 0.6);
    expect(() => withBrushSizeMaximumResponseV1(sizeMin, 0.5)).toThrow(RangeError);
    const opacityMax = withBrushOpacityMaximumResponseV1(preset, 0.4);
    expect(() => withBrushOpacityMinimumResponseV1(opacityMax, 0.5)).toThrow(RangeError);
    const flowMin = withBrushFlowMinimumResponseV1(preset, 0.3);
    expect(brushFlowMaximumResponseV1(withBrushFlowMaximumResponseV1(flowMin, 0.3))).toBe(0.3);
  });

  it('caps enabled dynamic target responses after source composition', () => {
    const [dab] = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      opacity: 0.8,
      flow: 0.6,
      pressureSizeEnabled: true,
      pressureOpacityEnabled: true,
      pressureFlowEnabled: true,
      sizeMaximumResponse: 0.5,
      opacityMaximumResponse: 0.5,
      flowMaximumResponse: 0.5,
    }).beginDelta({ documentX: 0, documentY: 0, pressure: 1 });
    expect(dab?.radius).toBeCloseTo(5, 10);
    expect(dab?.strokeOpacity).toBeCloseTo(0.4, 10);
    expect(dab?.flow).toBeCloseTo(0.3, 10);
  });

  it('keeps static targets neutral when no dynamic source is enabled', () => {
    const [dab] = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      opacity: 0.8,
      flow: 0.6,
      sizeMaximumResponse: 0.2,
      opacityMaximumResponse: 0.2,
      flowMaximumResponse: 0.2,
    }).beginDelta({ documentX: 0, documentY: 0 });
    expect(dab?.radius).toBeCloseTo(10, 10);
    expect(dab?.strokeOpacity).toBeCloseTo(0.8, 10);
    expect(dab?.flow).toBeCloseTo(0.6, 10);
  });

  it('clamps within target bounds without changing source composition order', () => {
    const low = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      pressureSizeEnabled: true,
      velocitySizeEnabled: true,
      sizeMinimumResponse: 0.3,
      sizeMaximumResponse: 0.6,
    }).beginDelta({ documentX: 0, documentY: 0, pressure: 0.2, velocity: 0.5 })[0];
    const high = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      pressureSizeEnabled: true,
      velocitySizeEnabled: true,
      sizeMinimumResponse: 0.3,
      sizeMaximumResponse: 0.6,
    }).beginDelta({ documentX: 0, documentY: 0, pressure: 1, velocity: 1 })[0];
    expect(low?.radius).toBeCloseTo(3, 10);
    expect(high?.radius).toBeCloseTo(6, 10);
  });

  it('keeps forced taper zero authoritative outside both response clamps', () => {
    const stroke = new CanonicalRasterBrushStrokeV1({
      sizePx: 20,
      startTaperLengthPx: 10,
      forceStartTaper: true,
      pressureSizeEnabled: true,
      sizeMinimumResponse: 0.4,
      sizeMaximumResponse: 0.6,
    });
    expect(stroke.beginConfirmed({ documentX: 0, documentY: 0, pressure: 1 })).toEqual([]);
  });

  it('updates runtime bounds atomically and stores only resolved primitive values', () => {
    const session = new PaintSessionControllerV1(new FakeRendererDocumentPort());
    session.setBrushDynamicResponseBounds(
      { minimum: 0.2, maximum: 0.7 },
      { minimum: 0.3, maximum: 0.8 },
      { minimum: 0.4, maximum: 0.9 },
    );
    const snapshot = session.snapshot();
    expect(snapshot.brushSizeMaximumResponse).toBe(0.7);
    expect(snapshot.brushOpacityMaximumResponse).toBe(0.8);
    expect(snapshot.brushFlowMaximumResponse).toBe(0.9);
    expect(() => session.setBrushSizeMaximumResponse(0.1)).toThrow(RangeError);
    const [dab] = new CanonicalRasterBrushStrokeV1({
      pressureSizeEnabled: true,
      sizeMaximumResponse: 0.5,
    }).beginConfirmed({ documentX: 0, documentY: 0, pressure: 1 });
    expect(dab).toBeDefined();
    expect('sizeMaximumResponse' in (dab ?? {})).toBe(false);
  });
});
