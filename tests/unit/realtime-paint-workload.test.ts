import { writeFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { BaselinePaintRendererV1 } from '../../src/gpu/baseline-paint-renderer.js';
import { RendererTileStateV1 } from '../../src/gpu/renderer-tile-state.js';
import { gpuHarness } from '../helpers/paint-gpu-harness.js';

describe('realtime renderer measured workload', () => {
  it('records CPU raster and presentation work separately', () => {
    const results = [8, 32, 64].map((radius) => {
      const harness = gpuHarness();
      const renderer = new BaselinePaintRendererV1();
      renderer.attachDevice(harness.device);
      renderer.attachSurface(harness.surface, 'bgra8unorm');
      renderer.configureDocument(new RendererTileStateV1(512, 256), 512, 256);
      const before = renderer.workMetrics.snapshot();
      const start = performance.now();
      for (let i = 0; i < 960; i++)
        renderer.presentStroke('long', [
          {
            schema: 'illustro.baseline-brush-dab/1',
            x: 32 + (i % 440),
            y: 128,
            radius,
            opacity: 0.7,
            flow: 0.4,
            strokeOpacity: 0.7,
            hardness: 0.5,
            tipDensity: 0.8,
          },
        ]);
      const elapsedMs = performance.now() - start;
      const after = renderer.workMetrics.snapshot();
      const delta = Object.fromEntries(
        Object.entries(after).map(([key, value]) => [
          key,
          value - before[key as keyof typeof before],
        ]),
      );
      expect(Number.isFinite(elapsedMs)).toBe(true);
      return { radius, inputBatches: 960, elapsedMs, work: delta };
    });
    if (process.env.ILLUSTRO_WORK_REPORT)
      writeFileSync(
        process.env.ILLUSTRO_WORK_REPORT,
        JSON.stringify(
          {
            environment:
              'Node synthetic, real CPU raster, GPU commands mocked; not visible latency',
            results,
          },
          null,
          2,
        ) + '\n',
      );
  });
});
