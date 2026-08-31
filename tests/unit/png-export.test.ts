import { describe, expect, it } from 'vitest';
import { createDocumentV1 } from '../../src/domain/document.js';
import { createRasterLayer } from '../../src/domain/layers.js';
import type { BaselineBrushDabV1 } from '../../src/gpu/baseline-brush.js';
import {
  PNG_SIGNATURE,
  encodePaintSnapshotToPngV1,
  flattenBaselinePaintTileV1,
  normalizePngFilenameV1,
  type PngRasterSurfaceV1,
} from '../../src/export/png-export.js';
import type {
  CompletedPaintStrokeV1,
  PaintProjectSnapshotV1,
  PaintStrokeV1,
} from '../../src/app/paint-session-controller.js';

function snapshot(
  input: {
    readonly width?: number;
    readonly height?: number;
    readonly background?: Parameters<typeof createDocumentV1>[0]['background'];
    readonly dabs?: readonly BaselineBrushDabV1[];
  } = {},
): PaintProjectSnapshotV1 {
  const base = createDocumentV1({
    width: input.width ?? 32,
    height: input.height ?? 32,
    ...(input.background === undefined ? {} : { background: input.background }),
  });
  const layer = createRasterLayer({ name: 'Layer 1' });
  const document = Object.freeze({
    ...base,
    layerTree: Object.freeze({
      rootLayerIds: Object.freeze([layer.id]),
      layers: Object.freeze({ [layer.id]: layer }),
    }),
  });
  const dabs = input.dabs ?? [];
  const committedStrokes: CompletedPaintStrokeV1[] = [];
  if (dabs.length > 0) {
    const stroke: PaintStrokeV1 = Object.freeze({
      schema: 'illustro.paint-stroke/1',
      strokeId: crypto.randomUUID(),
      pointerId: 1,
      source: 'pen',
      layerId: layer.id,
      samples: Object.freeze([]),
    });
    committedStrokes.push(Object.freeze({ stroke, dabs: Object.freeze([...dabs]) }));
  }
  return Object.freeze({
    schema: 'illustro.paint-project-snapshot/1',
    document,
    committedStrokes: Object.freeze(committedStrokes),
  });
}

function dab(x: number, y: number, opacity = 1): BaselineBrushDabV1 {
  return Object.freeze({
    schema: 'illustro.baseline-brush-dab/1',
    x,
    y,
    radius: 8,
    opacity,
  });
}

function pixel(tile: ReturnType<typeof flattenBaselinePaintTileV1>, x: number, y: number) {
  const offset = (y * tile.width + x) * 4;
  return Array.from(tile.rgba.slice(offset, offset + 4));
}

describe('M4 canonical PNG flatten', () => {
  it('keeps a blank transparent document fully transparent', () => {
    const tile = flattenBaselinePaintTileV1(snapshot({ width: 4, height: 3 }), {
      x: 0,
      y: 0,
      width: 4,
      height: 3,
    });
    expect([...tile.rgba]).toEqual(new Array(4 * 3 * 4).fill(0));
  });

  it('matches the baseline shader hard center and smooth transparent edge semantics', () => {
    const tile = flattenBaselinePaintTileV1(snapshot({ dabs: [dab(16, 16)] }), {
      x: 0,
      y: 0,
      width: 32,
      height: 32,
    });
    expect(pixel(tile, 15, 15)).toEqual([0, 0, 0, 255]);
    expect(pixel(tile, 0, 0)).toEqual([0, 0, 0, 0]);
    const edgeAlpha = pixel(tile, 23, 15)[3];
    expect(edgeAlpha).toBeGreaterThan(0);
    expect(edgeAlpha).toBeLessThan(255);
  });

  it('source-over composites overlapping baseline dabs and solid backgrounds', () => {
    const overlap = flattenBaselinePaintTileV1(
      snapshot({ dabs: [dab(16, 16, 0.5), dab(16, 16, 0.5)] }),
      { x: 0, y: 0, width: 32, height: 32 },
    );
    expect(pixel(overlap, 15, 15)).toEqual([0, 0, 0, 191]);

    const solid = flattenBaselinePaintTileV1(
      snapshot({
        background: { kind: 'solid', rgba: [1, 1, 1, 1] },
        dabs: [dab(16, 16, 0.5)],
      }),
      { x: 0, y: 0, width: 32, height: 32 },
    );
    expect(pixel(solid, 15, 15)).toEqual([128, 128, 128, 255]);
  });

  it('streams flattened tiles into a PNG encoder and validates the PNG signature', async () => {
    const written: Array<{ x: number; y: number; width: number; height: number }> = [];
    let disposed = false;
    const fakePng = new Blob([new Uint8Array([...PNG_SIGNATURE, 0, 0, 0, 0])], {
      type: 'image/png',
    });
    const blob = await encodePaintSnapshotToPngV1(
      snapshot({ width: 300, height: 260, dabs: [dab(20, 20)] }),
      (width, height): PngRasterSurfaceV1 => {
        expect(width).toBe(300);
        expect(height).toBe(260);
        return {
          putTile(tile) {
            written.push({ x: tile.x, y: tile.y, width: tile.width, height: tile.height });
          },
          async encode() {
            return fakePng;
          },
          dispose() {
            disposed = true;
          },
        };
      },
    );
    expect(blob).toBe(fakePng);
    expect(written).toEqual([
      { x: 0, y: 0, width: 256, height: 256 },
      { x: 256, y: 0, width: 44, height: 256 },
      { x: 0, y: 256, width: 256, height: 4 },
      { x: 256, y: 256, width: 44, height: 4 },
    ]);
    expect(disposed).toBe(true);
  });

  it('normalizes exported filenames without path/control characters', () => {
    expect(normalizePngFilenameV1(' Illustration ')).toBe('Illustration.png');
    expect(normalizePngFilenameV1('../bad:name.png')).toBe('..-bad-name.png');
  });
});
