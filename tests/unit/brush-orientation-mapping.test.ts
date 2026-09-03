import { describe, expect, it } from 'vitest';
import {
  brushPenOrientationEnabledV1,
  createBaselineBrushPresetV1,
  withBrushPenOrientationEnabledV1,
} from '../../src/domain/brush-schema.js';
import {
  BaselineBrushDabBuilderV1,
  baselineBrushSampleOrientationDegreesV1,
} from '../../src/gpu/baseline-brush.js';
import { CanonicalRasterBrushStrokeV1 } from '../../src/app/canonical-raster-brush.js';
import { PaintSessionControllerV1 } from '../../src/app/paint-session-controller.js';

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

describe('M6A-046 orientation mapping', () => {
  it('is opt-in and keeps legacy fixed/follow behavior by default', () => {
    const preset = createBaselineBrushPresetV1({
      id: 'orientation.mapping',
      name: 'Orientation Mapping',
      category: 'Test',
      behavior: 'paint',
    });
    expect(brushPenOrientationEnabledV1(preset)).toBe(false);
    expect(brushPenOrientationEnabledV1(withBrushPenOrientationEnabledV1(preset, true))).toBe(true);
  });

  it('uses Pointer Events azimuth plus twist and the W3C tilt fallback', () => {
    expect(
      baselineBrushSampleOrientationDegreesV1({
        documentX: 0,
        documentY: 0,
        azimuthAngle: Math.PI / 2,
        twist: 30,
      }),
    ).toBeCloseTo(120, 10);
    expect(
      baselineBrushSampleOrientationDegreesV1({ documentX: 0, documentY: 0, tiltX: 0, tiltY: 45 }),
    ).toBeCloseTo(90, 10);
    expect(
      baselineBrushSampleOrientationDegreesV1({ documentX: 0, documentY: 0, tiltX: 45, tiltY: 45 }),
    ).toBeCloseTo(45, 10);
  });

  it('interpolates orientation on the shortest circular arc at logical stamp positions', () => {
    const builder = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      spacingRatio: 0.25,
      minimumStampDistancePx: 1,
      penOrientationEnabled: true,
    });
    builder.beginDelta({
      documentX: 0,
      documentY: 0,
      azimuthAngle: (350 * Math.PI) / 180,
    });
    builder.appendDelta([{ documentX: 10, documentY: 0, azimuthAngle: (10 * Math.PI) / 180 }]);
    const dabs = builder.dabs();
    expect(dabs[0]?.tipAngleDegrees).toBeCloseTo(350, 8);
    expect(dabs[1]?.tipAngleDegrees).toBeCloseTo(0, 8);
    expect(dabs[2]?.tipAngleDegrees).toBeCloseTo(10, 8);
  });

  it('gives pen orientation priority over stroke-follow and composes static tip offsets once', () => {
    const builder = new BaselineBrushDabBuilderV1({
      sizePx: 20,
      tipAngleDegrees: 10,
      tipDirectionDegrees: 20,
      followStrokeRotation: true,
      penOrientationEnabled: true,
    });
    const [first] = builder.beginDelta({
      documentX: 0,
      documentY: 0,
      azimuthAngle: Math.PI / 2,
      twist: 15,
    });
    expect(first?.tipAngleDegrees).toBeCloseTo(95, 10);
    const appended = builder.appendDelta([
      { documentX: 10, documentY: 0, azimuthAngle: Math.PI / 2, twist: 15 },
    ]);
    expect(appended[0]?.tipAngleDegrees).toBeCloseTo(95, 10);
  });

  it('forwards orientation through the canonical facade and runtime flag', () => {
    const stroke = new CanonicalRasterBrushStrokeV1({
      sizePx: 20,
      penOrientationEnabled: true,
      tipAngleDegrees: 5,
    });
    const [dab] = stroke.beginConfirmed({
      documentX: 1,
      documentY: 1,
      azimuthAngle: Math.PI,
      twist: 10,
    });
    expect(dab?.tipAngleDegrees).toBeCloseTo(195, 10);

    const session = new PaintSessionControllerV1(new FakeRendererDocumentPort());
    expect(session.setBrushPenOrientationEnabled(true)).toBe(true);
    expect(session.snapshot().brushPenOrientationEnabled).toBe(true);
  });
});
