import { describe, expect, it } from 'vitest';
import { CanvasAdmissionControllerV1 } from '../../src/app/canvas-admission-controller.js';

describe('M5A canvas admission operation integration', () => {
  const quota = {
    async inspect() {
      return {
        schema: 'illustro.storage-quota/1' as const,
        quotaBytes: 8 * 1024 * 1024 * 1024,
        usageBytes: 0,
        freeBytes: 8 * 1024 * 1024 * 1024,
        hardReserveBytes: 128 * 1024 * 1024,
        usableGrowthBytes: 8 * 1024 * 1024 * 1024 - 128 * 1024 * 1024,
        persisted: true,
      };
    },
  };

  it('preflights document creation with zero projected raster allocation', async () => {
    const controller = new CanvasAdmissionControllerV1(quota);
    const result = await controller.preflightDocumentCreate({
      width: 2048,
      height: 2048,
      precision: 'rgba8-unorm',
    });
    expect(result.allowed).toBe(true);
    expect(result.projectedTouchedTiles).toBe(0);
  });

  it('preflights resize with the projected sparse tile footprint and tiled scratch', async () => {
    const controller = new CanvasAdmissionControllerV1(quota);
    const result = await controller.preflightDocumentResize({
      width: 4096,
      height: 4096,
      precision: 'rgba16-float',
      projectedTouchedTiles: 4,
    });
    expect(result.allowed).toBe(true);
    expect(result.projectedTouchedTiles).toBe(4);
    expect(result.operationScratchBytes).toBeGreaterThan(0);
  });

  it('preflights future decoded image import as a fully touched raster with decoded scratch', async () => {
    const controller = new CanvasAdmissionControllerV1(quota);
    const result = await controller.preflightImageImport({
      width: 1024,
      height: 768,
      precision: 'rgba8-unorm',
      decodedSourceBytes: 1024 * 768 * 4,
    });
    expect(result.allowed).toBe(true);
    expect(result.projectedTouchedTiles).toBe(12);
    expect(result.operationScratchBytes).toBe(1024 * 768 * 4);
  });
});
