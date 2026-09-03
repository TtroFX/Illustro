import { describe, expect, it } from 'vitest';
import {
  brushPressureOpacityEnabledV1,
  createBaselineBrushPresetV1,
  withBrushPressureOpacityEnabledV1,
} from '../../src/domain/brush-schema.js';
import { CanonicalRasterBrushStrokeV1 } from '../../src/app/canonical-raster-brush.js';
import { PaintSessionControllerV1 } from '../../src/app/paint-session-controller.js';
import {
  BaselineBrushDabBuilderV1,
  type BaselineBrushDabV1,
} from '../../src/gpu/baseline-brush.js';
import {
  BaselineRasterTileStoreV1,
  readBaselineRasterTilePixelV1,
} from '../../src/gpu/baseline-raster-tile-store.js';

class FakeRendererDocumentPort {
  async configureDocument(): Promise<void> {}
  async restoreBaselineStrokes(): Promise<void> {}
  async applyBaselineTilePatches(): Promise<void> {}
}

const layers = Object.freeze([Object.freeze({ layerId: 'layer-a', visible: true, opacity: 1 })]);

function paintDab(strokeOpacity: number, flow = 0.5): BaselineBrushDabV1 {
  return Object.freeze({
    schema: 'illustro.baseline-brush-dab/1' as const,
    x: 32,
    y: 32,
    radius: 8,
    opacity: flow * strokeOpacity,
    flow,
    strokeOpacity,
    hardness: 1,
    tipDensity: 1,
    tipShape: 'round' as const,
  });
}

function centerAlpha(store: BaselineRasterTileStoreV1): number {
  const tile = store.exportTiles()[0];
  if (tile === undefined) return 0;
  return readBaselineRasterTilePixelV1(tile, 32 * tile.width + 32)[3];
}

describe('M6A-042 pressure to opacity', () => {
  it('is opt-in in preset data and keeps the legacy default disabled', () => {
    const preset = createBaselineBrushPresetV1({
      id: 'pressure.opacity',
      name: 'Pressure Opacity',
      category: 'Test',
      behavior: 'paint',
    });
    expect(brushPressureOpacityEnabledV1(preset)).toBe(false);
    expect(brushPressureOpacityEnabledV1(withBrushPressureOpacityEnabledV1(preset, true))).toBe(
      true,
    );
    expect(
      withBrushPressureOpacityEnabledV1(preset, false).dynamics.pressureOpacityEnabled,
    ).toBeUndefined();
  });

  it('interpolates pressure into the opacity cap without changing flow', () => {
    const builder = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      opacity: 0.8,
      flow: 0.25,
      spacingRatio: 0.25,
      minimumStampDistancePx: 1,
      pressureOpacityEnabled: true,
    });
    builder.beginDelta({ documentX: 0, documentY: 0, pressure: 0.25 });
    builder.appendDelta([{ documentX: 10, documentY: 0, pressure: 1 }]);
    const dabs = builder.dabs();
    expect(dabs.map((dab) => dab.x)).toEqual([0, 5, 10]);
    expect(dabs.map((dab) => dab.flow)).toEqual([0.25, 0.25, 0.25]);
    expect(dabs.map((dab) => dab.strokeOpacity)).toEqual([0.2, 0.5, 0.8]);
  });

  it('keeps opacity as a monotonic cap while flow controls convergence rate', () => {
    const store = new BaselineRasterTileStoreV1(128, 128, 'rgba8-unorm', layers);
    store.applyDabs('layer-a', 'stroke-variable-opacity', [paintDab(0.8)]);
    const first = centerAlpha(store);
    expect(first).toBeCloseTo(0.4, 2);

    store.applyDabs('layer-a', 'stroke-variable-opacity', [paintDab(0.2)]);
    const afterLowerPressure = centerAlpha(store);
    expect(afterLowerPressure).toBeCloseTo(first, 4);

    store.applyDabs('layer-a', 'stroke-variable-opacity', [paintDab(1)]);
    const afterHigherPressure = centerAlpha(store);
    expect(afterHigherPressure).toBeCloseTo(0.7, 2);
    expect(afterHigherPressure).toBeGreaterThan(afterLowerPressure);
  });

  it('keeps the fixed-opacity recurrence compatible and captures the runtime flag', () => {
    const store = new BaselineRasterTileStoreV1(128, 128, 'rgba8-unorm', layers);
    store.applyDabs('layer-a', 'stroke-fixed-opacity', [paintDab(0.8), paintDab(0.8)]);
    expect(centerAlpha(store)).toBeCloseTo(0.6, 2);

    const stroke = new CanonicalRasterBrushStrokeV1({
      opacity: 0.8,
      flow: 0.25,
      pressureOpacityEnabled: true,
    });
    const [dab] = stroke.beginConfirmed({ documentX: 1, documentY: 1, pressure: 0.5 });
    expect(dab?.flow).toBe(0.25);
    expect(dab?.strokeOpacity).toBe(0.4);

    const session = new PaintSessionControllerV1(new FakeRendererDocumentPort());
    expect(session.setBrushPressureOpacityEnabled(true)).toBe(true);
    expect(session.snapshot().brushPressureOpacityEnabled).toBe(true);
  });
});
