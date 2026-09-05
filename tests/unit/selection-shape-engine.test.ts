import { describe, expect, it } from 'vitest';
import { parseRevision } from '../../src/domain/identity.js';
import {
  prepareBrushPaintedSelectionV1,
  prepareEllipticalSelectionV1,
  prepareFreehandSelectionV1,
  prepareLassoSelectionV1,
  prepareRectangularSelectionV1,
  rasterizeSelectionShapeTileV1,
  type SelectionCoveragePersistencePortV1,
} from '../../src/app/selection-shape-engine.js';
import { SelectionCoverageControllerV1 } from '../../src/app/selection-coverage-controller.js';

function coverageAt(bytes: Uint8Array, width: number, x: number, y: number): number {
  return bytes[(y * width + x) * 4] ?? 0;
}

function selectedPixelCount(bytes: Uint8Array): number {
  let count = 0;
  for (let offset = 0; offset < bytes.byteLength; offset += 4) {
    if ((bytes[offset] ?? 0) > 0) count += 1;
  }
  return count;
}

function persistenceRecorder(): {
  readonly port: SelectionCoveragePersistencePortV1;
  readonly calls: Array<{ width: number; height: number; bytes: Uint8Array }>;
} {
  const calls: Array<{ width: number; height: number; bytes: Uint8Array }> = [];
  const port: SelectionCoveragePersistencePortV1 = {
    async persistRasterTile(input) {
      const bytes = input.bytes instanceof Uint8Array ? new Uint8Array(input.bytes) : new Uint8Array(input.bytes.slice(0));
      calls.push({ width: input.width, height: input.height, bytes });
      const objectHash = calls.length.toString(16).padStart(64, '0');
      return Object.freeze({
        schema: 'illustro.paint-persisted-raster-tile/1' as const,
        payloadRef: `sha256:${objectHash}`,
        objectHash,
        codec: 'raw' as const,
        pixelFormat: 'rgba8-unorm' as const,
        width: input.width,
        height: input.height,
        rawByteLength: bytes.byteLength,
        encodedByteLength: bytes.byteLength,
      });
    },
  };
  return { port, calls };
}

describe('M7A selection shape engine', () => {
  it('rasterizes rectangular selection with canonical pixel-center coverage', () => {
    const bytes = rasterizeSelectionShapeTileV1(
      { kind: 'rectangle', start: { x: 2, y: 2 }, end: { x: 6, y: 6 } },
      { tileDocumentX: 0, tileDocumentY: 0, width: 8, height: 8 },
    );
    expect(selectedPixelCount(bytes)).toBe(16);
    expect(coverageAt(bytes, 8, 1, 1)).toBe(0);
    expect(coverageAt(bytes, 8, 2, 2)).toBe(255);
    expect(coverageAt(bytes, 8, 5, 5)).toBe(255);
    expect(coverageAt(bytes, 8, 6, 6)).toBe(0);
  });

  it('rasterizes elliptical selection inside its drag bounds', () => {
    const bytes = rasterizeSelectionShapeTileV1(
      { kind: 'ellipse', start: { x: 1, y: 1 }, end: { x: 7, y: 7 } },
      { tileDocumentX: 0, tileDocumentY: 0, width: 8, height: 8 },
    );
    expect(coverageAt(bytes, 8, 4, 4)).toBe(255);
    expect(coverageAt(bytes, 8, 1, 1)).toBe(0);
    expect(selectedPixelCount(bytes)).toBeGreaterThan(20);
    expect(selectedPixelCount(bytes)).toBeLessThan(36);
  });

  it('closes Lasso polygons and fills their interior', () => {
    const bytes = rasterizeSelectionShapeTileV1(
      {
        kind: 'lasso',
        points: [
          { x: 1, y: 1 },
          { x: 7, y: 1 },
          { x: 1, y: 7 },
        ],
      },
      { tileDocumentX: 0, tileDocumentY: 0, width: 8, height: 8 },
    );
    expect(coverageAt(bytes, 8, 2, 2)).toBe(255);
    expect(coverageAt(bytes, 8, 6, 6)).toBe(0);
  });

  it('accepts freehand paths and removes duplicate consecutive points before polygon fill', () => {
    const bytes = rasterizeSelectionShapeTileV1(
      {
        kind: 'freehand',
        points: [
          { x: 1, y: 1 },
          { x: 1, y: 1 },
          { x: 7, y: 1 },
          { x: 7, y: 7 },
          { x: 1, y: 7 },
        ],
      },
      { tileDocumentX: 0, tileDocumentY: 0, width: 8, height: 8 },
    );
    expect(selectedPixelCount(bytes)).toBe(36);
  });

  it('supports soft brush-painted selection coverage', () => {
    const bytes = rasterizeSelectionShapeTileV1(
      { kind: 'brush', dabs: [{ x: 4, y: 4, radius: 2.5, opacity: 0.5 }] },
      { tileDocumentX: 0, tileDocumentY: 0, width: 8, height: 8 },
    );
    const center = coverageAt(bytes, 8, 3, 3);
    const edge = coverageAt(bytes, 8, 1, 3);
    expect(center).toBeGreaterThanOrEqual(127);
    expect(center).toBeLessThanOrEqual(128);
    expect(edge).toBeGreaterThan(0);
    expect(edge).toBeLessThan(center);
  });

  it('persists sparse coverage tiles and adopts them through SelectionCoverageController', async () => {
    const recorder = persistenceRecorder();
    const revision = parseRevision(7);
    const prepared = await prepareRectangularSelectionV1(
      { x: 120, y: 120 },
      { x: 136, y: 136 },
      {
        documentWidth: 256,
        documentHeight: 256,
        revision,
        persistence: recorder.port,
      },
    );
    expect(prepared.tiles).toHaveLength(4);
    expect(recorder.calls).toHaveLength(4);
    const controller = new SelectionCoverageControllerV1();
    const snapshot = controller.replacePrepared(prepared);
    expect(snapshot.coverage?.defaultCoverage).toBe(0);
    expect(snapshot.coverage?.tiles).toHaveLength(4);
    expect(snapshot.coverage?.sourceRevision).toBe(revision);
  });

  it('exposes all five M7A shape entry points against the same sparse coverage contract', async () => {
    const revision = parseRevision(9);
    const makeInput = () => {
      const recorder = persistenceRecorder();
      return {
        recorder,
        input: {
          documentWidth: 32,
          documentHeight: 32,
          revision,
          persistence: recorder.port,
        },
      };
    };

    const rectangle = makeInput();
    expect(
      (await prepareRectangularSelectionV1({ x: 2, y: 2 }, { x: 10, y: 10 }, rectangle.input)).tiles.length,
    ).toBeGreaterThan(0);

    const ellipse = makeInput();
    expect(
      (await prepareEllipticalSelectionV1({ x: 2, y: 2 }, { x: 10, y: 10 }, ellipse.input)).tiles.length,
    ).toBeGreaterThan(0);

    const lasso = makeInput();
    expect(
      (
        await prepareLassoSelectionV1(
          [
            { x: 2, y: 2 },
            { x: 10, y: 2 },
            { x: 6, y: 10 },
          ],
          lasso.input,
        )
      ).tiles.length,
    ).toBeGreaterThan(0);

    const freehand = makeInput();
    expect(
      (
        await prepareFreehandSelectionV1(
          [
            { x: 2, y: 2 },
            { x: 10, y: 2 },
            { x: 10, y: 10 },
            { x: 2, y: 10 },
          ],
          freehand.input,
        )
      ).tiles.length,
    ).toBeGreaterThan(0);

    const brush = makeInput();
    expect(
      (await prepareBrushPaintedSelectionV1([{ x: 6, y: 6, radius: 4 }], brush.input)).tiles.length,
    ).toBeGreaterThan(0);
  });
});
