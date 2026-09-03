import { describe, expect, it } from 'vitest';
import {
  brushFlowMinimumResponseV1,
  brushOpacityMinimumResponseV1,
  brushSizeMinimumResponseV1,
  createBaselineBrushPresetV1,
  withBrushFlowMinimumResponseV1,
  withBrushOpacityMinimumResponseV1,
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

describe('M6A-049 minimum response', () => {
  it('defaults each dynamic target minimum to zero and persists nonzero values', () => {
    const preset = createBaselineBrushPresetV1({
      id: 'minimum.response',
      name: 'Minimum Response',
      category: 'Test',
      behavior: 'paint',
    });
    expect(brushSizeMinimumResponseV1(preset)).toBe(0);
    expect(brushOpacityMinimumResponseV1(preset)).toBe(0);
    expect(brushFlowMinimumResponseV1(preset)).toBe(0);
    expect(brushSizeMinimumResponseV1(withBrushSizeMinimumResponseV1(preset, 0.25))).toBe(0.25);
    expect(brushOpacityMinimumResponseV1(withBrushOpacityMinimumResponseV1(preset, 0.4))).toBe(0.4);
    expect(brushFlowMinimumResponseV1(withBrushFlowMinimumResponseV1(preset, 0.6))).toBe(0.6);
    expect(() => withBrushSizeMinimumResponseV1(preset, -0.01)).toThrow(RangeError);
    expect(() => withBrushOpacityMinimumResponseV1(preset, 1.01)).toThrow(RangeError);
  });

  it('clamps combined dynamic response per target after source composition', () => {
    const [dab] = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      opacity: 0.8,
      flow: 0.6,
      pressureSizeEnabled: true,
      pressureOpacityEnabled: true,
      pressureFlowEnabled: true,
      sizeMinimumResponse: 0.3,
      opacityMinimumResponse: 0.4,
      flowMinimumResponse: 0.5,
    }).beginDelta({ documentX: 0, documentY: 0, pressure: 0 });
    expect(dab?.radius).toBeCloseTo(3, 10);
    expect(dab?.strokeOpacity).toBeCloseTo(0.32, 10);
    expect(dab?.flow).toBeCloseTo(0.3, 10);
  });

  it('applies the minimum after multiplying independent enabled sources', () => {
    const [dab] = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      pressureSizeEnabled: true,
      velocitySizeEnabled: true,
      sizeMinimumResponse: 0.4,
    }).beginDelta({ documentX: 0, documentY: 0, pressure: 0.5, velocity: 0.5 });
    expect(dab?.radius).toBeCloseTo(4, 10);
  });

  it('does not lower a neutral target when no dynamic source is enabled', () => {
    const [dab] = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      opacity: 0.8,
      flow: 0.6,
      sizeMinimumResponse: 0.2,
      opacityMinimumResponse: 0.2,
      flowMinimumResponse: 0.2,
    }).beginDelta({ documentX: 0, documentY: 0 });
    expect(dab?.radius).toBeCloseTo(10, 10);
    expect(dab?.strokeOpacity).toBeCloseTo(0.8, 10);
    expect(dab?.flow).toBeCloseTo(0.6, 10);
  });

  it('keeps forced taper zero authoritative outside the dynamic minimum clamp', () => {
    const stroke = new CanonicalRasterBrushStrokeV1({
      sizePx: 20,
      startTaperLengthPx: 10,
      forceStartTaper: true,
      pressureSizeEnabled: true,
      pressureOpacityEnabled: true,
      pressureFlowEnabled: true,
      sizeMinimumResponse: 0.9,
      opacityMinimumResponse: 0.9,
      flowMinimumResponse: 0.9,
    });
    expect(stroke.beginConfirmed({ documentX: 0, documentY: 0, pressure: 0 })).toEqual([]);
  });

  it('captures minimum responses in runtime state without extending primitive dab schema', () => {
    const session = new PaintSessionControllerV1(new FakeRendererDocumentPort());
    expect(session.setBrushSizeMinimumResponse(0.2)).toBe(0.2);
    expect(session.setBrushOpacityMinimumResponse(0.3)).toBe(0.3);
    expect(session.setBrushFlowMinimumResponse(0.4)).toBe(0.4);
    const snapshot = session.snapshot();
    expect(snapshot.brushSizeMinimumResponse).toBe(0.2);
    expect(snapshot.brushOpacityMinimumResponse).toBe(0.3);
    expect(snapshot.brushFlowMinimumResponse).toBe(0.4);
    const [dab] = new CanonicalRasterBrushStrokeV1({
      sizeMinimumResponse: 0.5,
      pressureSizeEnabled: true,
    }).beginConfirmed({ documentX: 0, documentY: 0, pressure: 0 });
    expect(dab).toBeDefined();
    expect('sizeMinimumResponse' in (dab ?? {})).toBe(false);
  });
});
