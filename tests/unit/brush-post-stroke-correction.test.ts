import { describe, expect, it } from 'vitest';
import {
  brushPostStrokeCorrectionAmountV1,
  createBaselineBrushPresetV1,
  withBrushPostStrokeCorrectionAmountV1,
} from '../../src/domain/brush-schema.js';
import { correctPostStrokeGeometryV1 } from '../../src/app/post-stroke-correction.js';
import { PaintSessionControllerV1 } from '../../src/app/paint-session-controller.js';
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

function pointer(
  sequence: number,
  eventType: PointerInputEventTypeV1,
  surfaceX: number,
  surfaceY: number,
): PointerInputSampleV1 {
  return Object.freeze({
    schema: 'illustro.pointer-sample/1' as const,
    sequence,
    pointerId: 23,
    source: 'pen' as const,
    eventType,
    origin: 'direct' as const,
    isPrimary: true,
    timestampMs: sequence * 16,
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
    pointerId: 23,
    confirmed: Object.freeze([...confirmed]),
    predicted: Object.freeze([]),
  });
}

async function completedDabs(postAmount: number) {
  const session = new PaintSessionControllerV1(new FakeRendererDocumentPort());
  await session.createNewDocument({ width: 256, height: 256 });
  session.setBrushPostStrokeCorrectionAmount(postAmount);
  session.ingestPointerBatch(batch('pointerdown', [pointer(1, 'pointerdown', 10, 10)]));
  session.ingestPointerBatch(batch('pointermove', [pointer(2, 'pointermove', 20, 22)]));
  session.ingestPointerBatch(batch('pointermove', [pointer(3, 'pointermove', 30, 8)]));
  session.ingestPointerBatch(batch('pointermove', [pointer(4, 'pointermove', 40, 22)]));
  session.ingestPointerBatch(batch('pointerup', [pointer(5, 'pointerup', 50, 10)]));
  const completed = session.takeCompletedPaintStroke();
  if (completed === null) throw new Error('expected completed paint stroke');
  return completed;
}

describe('M6A-034 post-stroke correction', () => {
  it('stores a separate postStrokeAmount with a compatibility default of zero', () => {
    const preset = createBaselineBrushPresetV1({
      id: 'post-correction.paint',
      name: 'Post correction',
      category: 'Test',
      behavior: 'paint',
    });
    expect(brushPostStrokeCorrectionAmountV1(preset)).toBe(0);
    expect(
      brushPostStrokeCorrectionAmountV1(withBrushPostStrokeCorrectionAmountV1(preset, 0.75)),
    ).toBeCloseTo(0.75, 8);
  });

  it('is an exact geometry identity at zero', () => {
    const samples = [
      { documentX: 0, documentY: 0 },
      { documentX: 10, documentY: 4 },
      { documentX: 20, documentY: 0 },
    ];
    expect(correctPostStrokeGeometryV1(samples, 0)).toEqual(samples);
  });

  it('reduces interior jitter while preserving both endpoints exactly', () => {
    const samples = [
      { documentX: 0, documentY: 0 },
      { documentX: 10, documentY: 10 },
      { documentX: 20, documentY: -10 },
      { documentX: 30, documentY: 10 },
      { documentX: 40, documentY: 0 },
    ];
    const corrected = correctPostStrokeGeometryV1(samples, 1);
    expect(corrected[0]).toEqual(samples[0]);
    expect(corrected.at(-1)).toEqual(samples.at(-1));
    const rawVariation = Math.abs(10 - -10) + Math.abs(-10 - 10);
    const correctedVariation =
      Math.abs((corrected[1]?.documentY ?? 0) - (corrected[2]?.documentY ?? 0)) +
      Math.abs((corrected[2]?.documentY ?? 0) - (corrected[3]?.documentY ?? 0));
    expect(correctedVariation).toBeLessThan(rawVariation);
  });

  it('rebuilds only the final dab geometry while preserving canonical raw samples', async () => {
    const raw = await completedDabs(0);
    const corrected = await completedDabs(1);
    expect(corrected.stroke.samples.map((sample) => [sample.documentX, sample.documentY])).toEqual([
      [10, 10],
      [20, 22],
      [30, 8],
      [40, 22],
      [50, 10],
    ]);
    expect(corrected.dabs).not.toEqual(raw.dabs);
    expect(corrected.dabs.at(-1)?.x).toBeCloseTo(50, 6);
    expect(corrected.dabs.at(-1)?.y).toBeCloseTo(10, 6);
  });
});
