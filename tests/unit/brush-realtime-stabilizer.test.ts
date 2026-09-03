import { describe, expect, it } from 'vitest';
import {
  brushRealtimeStabilizationAmountV1,
  createBaselineBrushPresetV1,
  withBrushRealtimeStabilizationAmountV1,
} from '../../src/domain/brush-schema.js';
import { PaintSessionControllerV1 } from '../../src/app/paint-session-controller.js';
import { RealtimeBrushStabilizerV1 } from '../../src/app/realtime-brush-stabilizer.js';
import type { BaselineRasterLayerDescriptorV1 } from '../../src/gpu/baseline-raster-tile-store.js';
import type {
  PointerInputBatchV1,
  PointerInputEventTypeV1,
  PointerInputSampleV1,
} from '../../src/input/pointer-input.js';

class FakeRendererDocumentPort {
  async configureDocument(_input: {
    readonly width: number;
    readonly height: number;
    readonly workingSpace: 'srgb' | 'display-p3';
    readonly precision: 'rgba8-unorm' | 'rgba16-float';
    readonly rasterLayers: readonly BaselineRasterLayerDescriptorV1[];
  }): Promise<void> {}
  async restoreBaselineStrokes(): Promise<void> {}
  async applyBaselineTilePatches(): Promise<void> {}
}

function point(documentX: number, documentY: number, timestampMs: number) {
  return Object.freeze({ documentX, documentY, timestampMs });
}

function pointer(
  sequence: number,
  eventType: PointerInputEventTypeV1,
  surfaceX: number,
  surfaceY: number,
  timestampMs: number,
): PointerInputSampleV1 {
  return Object.freeze({
    schema: 'illustro.pointer-sample/1' as const,
    sequence,
    pointerId: 11,
    source: 'pen' as const,
    eventType,
    origin: 'direct' as const,
    isPrimary: true,
    timestampMs,
    clientX: surfaceX,
    clientY: surfaceY,
    surfaceX,
    surfaceY,
    pressure: 0.5,
    tangentialPressure: 0,
    tiltX: 0,
    tiltY: 0,
    twist: 0,
    altitudeAngle: null,
    azimuthAngle: null,
    contactWidth: 1,
    contactHeight: 1,
    buttons: eventType === 'pointerup' ? 0 : 1,
    button: eventType === 'pointerdown' ? 0 : -1,
  });
}

function batch(
  eventType: PointerInputEventTypeV1,
  confirmed: readonly PointerInputSampleV1[],
): PointerInputBatchV1 {
  return Object.freeze({
    schema: 'illustro.pointer-batch/1' as const,
    eventType,
    pointerId: confirmed.at(-1)?.pointerId ?? 11,
    confirmed: Object.freeze([...confirmed]),
    predicted: Object.freeze([]),
  });
}

describe('M6A-033 real-time stabilization', () => {
  it('reuses stabilization.amount with a 0..1 compatibility default', () => {
    const preset = createBaselineBrushPresetV1({
      id: 'stabilizer.paint',
      name: 'Stabilizer',
      category: 'Test',
      behavior: 'paint',
    });
    expect(brushRealtimeStabilizationAmountV1(preset)).toBe(0);
    expect(
      brushRealtimeStabilizationAmountV1(withBrushRealtimeStabilizationAmountV1(preset, 0.65)),
    ).toBeCloseTo(0.65, 8);
  });

  it('is an exact identity path when amount is zero', () => {
    const filter = new RealtimeBrushStabilizerV1(0);
    expect(filter.push(point(0, 0, 0))).toEqual({ documentX: 0, documentY: 0 });
    expect(filter.push(point(7, -3, 16))).toEqual({ documentX: 7, documentY: -3 });
    expect(filter.release(point(7, -3, 16))).toBeNull();
  });

  it('suppresses slow jitter while adapting toward fast intentional motion', () => {
    const slow = new RealtimeBrushStabilizerV1(1);
    slow.push(point(0, 0, 0));
    const slowMove = slow.push(point(1, 0, 16));
    expect(slowMove.documentX).toBeGreaterThan(0);
    expect(slowMove.documentX).toBeLessThan(1);

    const fast = new RealtimeBrushStabilizerV1(1);
    fast.push(point(0, 0, 0));
    const fastMove = fast.push(point(100, 0, 16));
    expect(fastMove.documentX / 100).toBeGreaterThan(slowMove.documentX);
  });

  it('snaps only the release endpoint to raw input without rewriting prior filtered points', () => {
    const filter = new RealtimeBrushStabilizerV1(1);
    filter.push(point(0, 0, 0));
    const filtered = filter.push(point(20, 0, 16));
    expect(filtered.documentX).toBeLessThan(20);
    expect(filter.release(point(20, 0, 16))).toEqual({ documentX: 20, documentY: 0 });
  });

  it('keeps raw stroke samples canonical while feeding stabilized geometry to the brush builder', async () => {
    const session = new PaintSessionControllerV1(new FakeRendererDocumentPort());
    await session.createNewDocument({ width: 256, height: 256 });
    session.setBrushRealtimeStabilizationAmount(1);
    session.ingestPointerBatch(batch('pointerdown', [pointer(1, 'pointerdown', 10, 10, 0)]));
    session.ingestPointerBatch(batch('pointermove', [pointer(2, 'pointermove', 30, 10, 16)]));

    expect(session.activeStroke()?.samples.map((sample) => sample.documentX)).toEqual([10, 30]);
    expect(session.activeDabs().at(-1)?.x).toBeLessThan(30);
    expect(session.snapshot().brushRealtimeStabilizationAmount).toBe(1);
  });
});
