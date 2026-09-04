import { describe, expect, it } from 'vitest';
import { CanonicalRasterBrushStrokeV1 } from '../../src/app/canonical-raster-brush.js';

function runStablePrefixWorkload(sampleCount: number): {
  readonly stroke: CanonicalRasterBrushStrokeV1;
  readonly emittedDabCount: number;
  readonly maximumDeltaDabCount: number;
} {
  const stroke = new CanonicalRasterBrushStrokeV1();
  let emittedDabCount = stroke.beginConfirmed({ documentX: 0, documentY: 0 }).length;
  let maximumDeltaDabCount = emittedDabCount;

  for (let index = 1; index < sampleCount; index += 1) {
    const delta = stroke.appendConfirmed([{ documentX: index * 4, documentY: 0 }]);
    emittedDabCount += delta.length;
    maximumDeltaDabCount = Math.max(maximumDeltaDabCount, delta.length);
  }

  return Object.freeze({ stroke, emittedDabCount, maximumDeltaDabCount });
}

function mutableTailSizeAfterWorkload(sampleCount: number): number {
  const stroke = new CanonicalRasterBrushStrokeV1({
    sizePx: 8,
    spacingRatio: 0.5,
    endTaperLengthPx: 64,
  });
  stroke.beginConfirmed({ documentX: 0, documentY: 0 });
  for (let index = 1; index < sampleCount; index += 1) {
    stroke.appendConfirmed([{ documentX: index * 4, documentY: 0 }]);
  }
  return stroke.snapshot().mutableTailDabCount;
}

describe('M6A-PERF canonical brush workload invariants', () => {
  it.each([100, 1_000, 10_000])(
    'keeps incremental work bounded for a %i-sample stable prefix',
    (sampleCount) => {
      const workload = runStablePrefixWorkload(sampleCount);
      const snapshot = workload.stroke.snapshot();

      expect(snapshot.confirmedSampleCount).toBe(sampleCount);
      expect(snapshot.generatedDabCount).toBe(sampleCount);
      expect(snapshot.emittedDabCount).toBe(sampleCount);
      expect(snapshot.stablePrefixDabCount).toBe(sampleCount);
      expect(snapshot.mutableTailDabCount).toBe(0);
      expect(snapshot.reprocessedStableDabCount).toBe(0);
      expect(workload.emittedDabCount).toBe(sampleCount);
      expect(workload.maximumDeltaDabCount).toBe(1);
    },
  );

  it('keeps the next delivery constant after a 10,000-sample stable prefix', () => {
    const workload = runStablePrefixWorkload(10_000);
    const delta = workload.stroke.appendConfirmed([{ documentX: 40_000, documentY: 0 }]);

    expect(delta).toHaveLength(1);
    expect(workload.stroke.snapshot()).toMatchObject({
      confirmedSampleCount: 10_001,
      stablePrefixDabCount: 10_001,
      reprocessedStableDabCount: 0,
    });
  });

  it('keeps the mutable end-taper tail bounded while the stable prefix grows', () => {
    const tailSizes = [100, 1_000, 10_000].map(mutableTailSizeAfterWorkload);

    expect(tailSizes[0]).toBeGreaterThan(0);
    expect(new Set(tailSizes).size).toBe(1);
    expect(tailSizes[0]).toBeLessThanOrEqual(16);
  });
});
