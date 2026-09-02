import { describe, expect, it } from 'vitest';
import {
  DOCUMENT_V1_SCHEMA,
  MAX_CANVAS_AREA,
  MAX_CANVAS_DIMENSION,
  createCanvasSpec,
  createDocumentV1,
} from '../../src/domain/document.js';
import { isUuid } from '../../src/domain/identity.js';

describe('DocumentV1 canonical contract', () => {
  it('creates the frozen v1 root with canonical defaults', () => {
    const document = createDocumentV1({
      width: 4096,
      height: 4096,
      now: new Date('2026-08-30T00:00:00.000Z'),
    });

    expect(document.schema).toBe(DOCUMENT_V1_SCHEMA);
    expect(isUuid(document.documentId)).toBe(true);
    expect(isUuid(document.projectId)).toBe(true);
    expect(document.revision).toBe(0);
    expect(document.createdAt).toBe('2026-08-30T00:00:00.000Z');
    expect(document.modifiedAt).toBe(document.createdAt);
    expect(document.canvas).toMatchObject({
      width: 4096,
      height: 4096,
      resolution: { ppi: 300 },
      background: { kind: 'transparent' },
      bounds: { x: 0, y: 0, width: 4096, height: 4096 },
    });
    expect(document.color).toEqual({
      workingSpace: 'srgb',
      precision: 'rgba8-unorm',
      alphaMode: 'straight',
      profile: { kind: 'builtin-rgb', space: 'srgb', whitePoint: 'd65', transfer: 'srgb' },
    });
    expect(document.layerTree.rootLayerIds).toEqual([]);
    expect(document.featureFlags).toEqual({ required: [], optional: [] });
  });

  it('supports Display-P3 and rgba16-float explicitly', () => {
    const document = createDocumentV1({
      width: 2048,
      height: 2048,
      ppi: 600,
      workingSpace: 'display-p3',
      precision: 'rgba16-float',
      background: { kind: 'solid', rgba: [0.1, 0.2, 0.3, 1] },
    });

    expect(document.color).toEqual({
      workingSpace: 'display-p3',
      precision: 'rgba16-float',
      alphaMode: 'straight',
      profile: {
        kind: 'builtin-rgb',
        space: 'display-p3',
        whitePoint: 'd65',
        transfer: 'srgb',
      },
    });
    expect(document.canvas.resolution.ppi).toBe(600);
  });

  it('enforces v1 dimension and logical-area bounds before allocation', () => {
    expect(() => createCanvasSpec({ width: 0, height: 1 })).toThrow(RangeError);
    expect(() => createCanvasSpec({ width: MAX_CANVAS_DIMENSION + 1, height: 1 })).toThrow(
      RangeError,
    );
    expect(() =>
      createCanvasSpec({ width: MAX_CANVAS_DIMENSION, height: MAX_CANVAS_DIMENSION }),
    ).toThrow(new RegExp(String(MAX_CANVAS_AREA)));
    expect(() => createCanvasSpec({ width: 1024, height: 1024, ppi: 0 })).toThrow(RangeError);
  });
});
