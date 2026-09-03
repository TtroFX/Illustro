import { describe, expect, it } from 'vitest';
import {
  brushPressureFlowEnabledV1,
  createBaselineBrushPresetV1,
  withBrushPressureFlowEnabledV1,
} from '../../src/domain/brush-schema.js';
import { CanonicalRasterBrushStrokeV1 } from '../../src/app/canonical-raster-brush.js';
import { PaintSessionControllerV1 } from '../../src/app/paint-session-controller.js';
import { BaselineBrushDabBuilderV1 } from '../../src/gpu/baseline-brush.js';

class FakeRendererDocumentPort {
  async configureDocument(): Promise<void> {}
  async restoreBaselineStrokes(): Promise<void> {}
  async applyBaselineTilePatches(): Promise<void> {}
}

describe('M6A-043 pressure to flow', () => {
  it('is opt-in in preset data and keeps the legacy default disabled', () => {
    const preset = createBaselineBrushPresetV1({
      id: 'pressure.flow',
      name: 'Pressure Flow',
      category: 'Test',
      behavior: 'paint',
    });
    expect(brushPressureFlowEnabledV1(preset)).toBe(false);
    expect(brushPressureFlowEnabledV1(withBrushPressureFlowEnabledV1(preset, true))).toBe(true);
    expect(
      withBrushPressureFlowEnabledV1(preset, false).dynamics.pressureFlowEnabled,
    ).toBeUndefined();
  });

  it('linearly interpolates pressure into flow while preserving the opacity cap', () => {
    const builder = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      opacity: 0.75,
      flow: 0.8,
      spacingRatio: 0.25,
      minimumStampDistancePx: 1,
      pressureFlowEnabled: true,
    });
    builder.beginDelta({ documentX: 0, documentY: 0, pressure: 0.25 });
    builder.appendDelta([{ documentX: 10, documentY: 0, pressure: 1 }]);
    const dabs = builder.dabs();
    expect(dabs.map((dab) => dab.x)).toEqual([0, 5, 10]);
    expect(dabs.map((dab) => dab.flow)).toEqual([0.2, 0.5, 0.8]);
    expect(dabs.map((dab) => dab.strokeOpacity)).toEqual([0.75, 0.75, 0.75]);
  });

  it('keeps pressure flow and pressure opacity independent when both are enabled', () => {
    const builder = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      opacity: 0.6,
      flow: 0.8,
      pressureFlowEnabled: true,
      pressureOpacityEnabled: true,
    });
    const [dab] = builder.beginDelta({ documentX: 1, documentY: 1, pressure: 0.5 });
    expect(dab?.flow).toBe(0.4);
    expect(dab?.strokeOpacity).toBe(0.3);
    expect(dab?.radius).toBe(10);
  });

  it('forwards pressure flow through the canonical facade and captures runtime state', () => {
    const stroke = new CanonicalRasterBrushStrokeV1({
      flow: 0.8,
      opacity: 0.75,
      pressureFlowEnabled: true,
    });
    const [dab] = stroke.beginConfirmed({ documentX: 1, documentY: 1, pressure: 0.5 });
    expect(dab?.flow).toBe(0.4);
    expect(dab?.strokeOpacity).toBe(0.75);

    const session = new PaintSessionControllerV1(new FakeRendererDocumentPort());
    expect(session.setBrushPressureFlowEnabled(true)).toBe(true);
    expect(session.snapshot().brushPressureFlowEnabled).toBe(true);
  });
});
