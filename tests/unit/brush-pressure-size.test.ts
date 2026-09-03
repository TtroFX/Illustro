import { describe, expect, it } from 'vitest';
import {
  brushPressureSizeEnabledV1,
  createBaselineBrushPresetV1,
  withBrushPressureSizeEnabledV1,
} from '../../src/domain/brush-schema.js';
import { CanonicalRasterBrushStrokeV1 } from '../../src/app/canonical-raster-brush.js';
import { BaselineBrushDabBuilderV1 } from '../../src/gpu/baseline-brush.js';
import { PaintSessionControllerV1 } from '../../src/app/paint-session-controller.js';

class FakeRendererDocumentPort {
  async configureDocument(): Promise<void> {}
  async restoreBaselineStrokes(): Promise<void> {}
  async applyBaselineTilePatches(): Promise<void> {}
}

describe('M6A-041 pressure to size', () => {
  it('is opt-in in preset data and keeps the legacy default disabled', () => {
    const preset = createBaselineBrushPresetV1({
      id: 'pressure.size',
      name: 'Pressure Size',
      category: 'Test',
      behavior: 'paint',
    });
    expect(brushPressureSizeEnabledV1(preset)).toBe(false);
    expect(brushPressureSizeEnabledV1(withBrushPressureSizeEnabledV1(preset, true))).toBe(true);
    expect(
      withBrushPressureSizeEnabledV1(preset, false).dynamics.pressureSizeEnabled,
    ).toBeUndefined();
  });

  it('linearly interpolates pressure at logical stamp positions and resolves it into radius', () => {
    const builder = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      spacingRatio: 0.25,
      minimumStampDistancePx: 1,
      pressureSizeEnabled: true,
    });
    builder.beginDelta({ documentX: 0, documentY: 0, pressure: 0.25 });
    builder.appendDelta([{ documentX: 10, documentY: 0, pressure: 1 }]);
    const dabs = builder.dabs();
    expect(dabs.map((dab) => dab.x)).toEqual([0, 5, 10]);
    expect(dabs.map((dab) => dab.radius)).toEqual([2.5, 6.25, 10]);
  });

  it('ignores sample pressure when the mapping is disabled', () => {
    const builder = new BaselineBrushDabBuilderV1({ sizePx: 20, pressureSizeEnabled: false });
    const [dab] = builder.beginDelta({ documentX: 2, documentY: 3, pressure: 0.1 });
    expect(dab?.radius).toBe(10);
  });

  it('forwards pressure through the canonical facade and captures the runtime flag', () => {
    const stroke = new CanonicalRasterBrushStrokeV1({ sizePx: 20, pressureSizeEnabled: true });
    const [dab] = stroke.beginConfirmed({ documentX: 1, documentY: 1, pressure: 0.4 });
    expect(dab?.radius).toBe(4);

    const session = new PaintSessionControllerV1(new FakeRendererDocumentPort());
    expect(session.setBrushPressureSizeEnabled(true)).toBe(true);
    expect(session.snapshot().brushPressureSizeEnabled).toBe(true);
  });
});
