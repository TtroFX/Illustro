import { describe, expect, it } from 'vitest';
import { createDocumentV1 } from '../../src/domain/document.js';
import { createRasterLayer } from '../../src/domain/layers.js';
import type { Revision } from '../../src/domain/identity.js';
import {
  cropCanvasSnapshotV1,
  isCanvasExpansionV1,
  resizeCanvasSnapshotV1,
  transparentContentBoundsV1,
  trimTransparentCanvasSnapshotV1,
} from '../../src/app/document-geometry.js';
import type {
  CompletedPaintStrokeV1,
  PaintProjectSnapshotV1,
} from '../../src/app/paint-session-controller.js';

function snapshot(
  dabs: readonly { x: number; y: number; radius: number; opacity?: number }[] = [],
  width = 100,
  height = 80,
  solid = false,
): PaintProjectSnapshotV1 {
  const base = createDocumentV1({
    width,
    height,
    background: solid ? { kind: 'solid', rgba: [1, 1, 1, 1] } : { kind: 'transparent' },
  });
  const layer = createRasterLayer({ name: 'Layer 1' });
  const document = Object.freeze({
    ...base,
    layerTree: Object.freeze({
      rootLayerIds: Object.freeze([layer.id]),
      layers: Object.freeze({ [layer.id]: layer }),
    }),
  });
  const completed: CompletedPaintStrokeV1[] =
    dabs.length === 0
      ? []
      : [
          Object.freeze({
            stroke: Object.freeze({
              schema: 'illustro.paint-stroke/1' as const,
              strokeId: crypto.randomUUID(),
              pointerId: 1,
              source: 'pen' as const,
              layerId: layer.id,
              samples: Object.freeze([
                Object.freeze({
                  schema: 'illustro.paint-stroke-sample/1' as const,
                  sequence: 0,
                  timestampMs: 1,
                  documentX: dabs[0]?.x ?? 0,
                  documentY: dabs[0]?.y ?? 0,
                  pressure: 1,
                  tangentialPressure: 0,
                  tiltX: 0,
                  tiltY: 0,
                  twist: 0,
                  altitudeAngle: null,
                  azimuthAngle: null,
                }),
              ]),
            }),
            dabs: Object.freeze(
              dabs.map((dab) =>
                Object.freeze({
                  schema: 'illustro.baseline-brush-dab/1' as const,
                  x: dab.x,
                  y: dab.y,
                  radius: dab.radius,
                  opacity: dab.opacity ?? 1,
                }),
              ),
            ),
          }),
        ];
  return Object.freeze({
    schema: 'illustro.paint-project-snapshot/1' as const,
    document,
    committedStrokes: Object.freeze(completed),
  });
}

const revision = (value: number) => value as Revision;

describe('M5A canvas geometry', () => {
  it('resizes/expands canvas by translating canonical stroke data', () => {
    const before = snapshot([{ x: 20, y: 30, radius: 5 }]);
    const input = { width: 140, height: 100, offsetX: 10, offsetY: 8 };
    expect(isCanvasExpansionV1(before, input)).toBe(true);
    const after = resizeCanvasSnapshotV1(
      before,
      input,
      revision(1),
      new Date('2026-01-01T00:00:00Z'),
    );
    expect(after.document.canvas).toMatchObject({ width: 140, height: 100 });
    expect(after.committedStrokes[0]?.dabs[0]).toMatchObject({ x: 30, y: 38, radius: 5 });
    expect(after.committedStrokes[0]?.stroke.samples[0]).toMatchObject({
      documentX: 30,
      documentY: 38,
    });
  });

  it('clips fully excluded dabs when shrinking and cropping', () => {
    const before = snapshot([
      { x: 15, y: 15, radius: 4 },
      { x: 90, y: 70, radius: 3 },
    ]);
    const cropped = cropCanvasSnapshotV1(
      before,
      { x: 10, y: 10, width: 40, height: 30 },
      revision(1),
    );
    expect(cropped.document.canvas).toMatchObject({ width: 40, height: 30 });
    expect(cropped.committedStrokes[0]?.dabs).toHaveLength(1);
    expect(cropped.committedStrokes[0]?.dabs[0]).toMatchObject({ x: 5, y: 5 });
  });

  it('computes and applies transparent trim bounds', () => {
    const before = snapshot([{ x: 50, y: 30, radius: 5 }]);
    expect(transparentContentBoundsV1(before)).toEqual({ x: 45, y: 25, width: 10, height: 10 });
    const after = trimTransparentCanvasSnapshotV1(before, revision(1));
    expect(after.document.canvas).toMatchObject({ width: 10, height: 10 });
    expect(after.committedStrokes[0]?.dabs[0]).toMatchObject({ x: 5, y: 5 });
  });

  it('does not pretend a colored background has transparent trim borders', () => {
    const before = snapshot([{ x: 50, y: 30, radius: 5 }], 100, 80, true);
    expect(transparentContentBoundsV1(before)).toBeNull();
    expect(() => trimTransparentCanvasSnapshotV1(before, revision(1))).toThrow(/transparent/);
  });
});
