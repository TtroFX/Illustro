import { describe, expect, it } from 'vitest';
import { rasterizeSelectionShapeTileV1 } from '../../src/app/selection-shape-engine.js';

function coverage(bytes: Uint8Array, width: number, x: number, y: number): number {
  return bytes[(y * width + x) * 4] ?? 0;
}

describe('M7A lasso rasterizer performance contract', () => {
  it('rasterizes a dense 256-point lasso over a 256x256 tile without pixel-times-edge supersampling', () => {
    const size = 256;
    const center = size / 2;
    const radius = 96.25;
    const points = Array.from({ length: 256 }, (_, index) => {
      const angle = (index / 256) * Math.PI * 2;
      return Object.freeze({
        x: center + Math.cos(angle) * radius,
        y: center + Math.sin(angle) * radius,
      });
    });

    const started = performance.now();
    const bytes = rasterizeSelectionShapeTileV1(
      { kind: 'lasso', points },
      { tileDocumentX: 0, tileDocumentY: 0, width: size, height: size },
    );
    const elapsedMs = performance.now() - started;

    expect(coverage(bytes, size, 128, 128)).toBe(255);
    expect(coverage(bytes, size, 0, 0)).toBe(0);

    let fractional = false;
    for (let offset = 0; offset < bytes.length; offset += 4) {
      const value = bytes[offset] ?? 0;
      if (value > 0 && value < 255) {
        fractional = true;
        break;
      }
    }
    expect(fractional).toBe(true);

    // The rejected implementation performed roughly width*height*16*edgeCount
    // point-in-polygon edge checks. This coarse gate intentionally leaves wide
    // CI headroom while catching a regression back to that architecture.
    expect(elapsedMs).toBeLessThan(2_000);
  });
});
