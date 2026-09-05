import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseRevision } from '../../src/domain/identity.js';
import {
  lassoHasNonZeroAreaV1,
  resolveSelectionModeForPointerV1,
} from '../../src/app/m8-selection-gesture-controller.js';
import {
  M8_SELECTION_LAUNCHER_MARGIN_V1,
  M8_SELECTION_MORPHOLOGY_STEP_PX_V1,
  hasNonEmptySelectionV1,
  placeSelectionLauncherV1,
} from '../../src/app/m8-selection-launcher.js';
import type { RasterSelectionCoverageV1 } from '../../src/app/selection-coverage-controller.js';
import {
  selectionContourKeyV1,
  stitchSelectionContourSegmentsV1,
} from '../../src/app/selection-contour-presenter.js';

function coverage(input: Partial<RasterSelectionCoverageV1> = {}): RasterSelectionCoverageV1 {
  return Object.freeze({
    schema: 'illustro.raster-selection-coverage/1' as const,
    defaultCoverage: 0 as const,
    tiles: Object.freeze([]),
    inverted: false,
    transformStack: Object.freeze([]),
    effectStack: Object.freeze([]),
    sourceRevision: parseRevision(3),
    ...input,
  });
}

describe('M8E rebuilt selection interaction', () => {
  it('treats effective coverage rather than a tile rectangle as selection existence', () => {
    expect(hasNonEmptySelectionV1(null)).toBe(false);
    expect(hasNonEmptySelectionV1(coverage())).toBe(false);
    expect(hasNonEmptySelectionV1(coverage({ defaultCoverage: 1 }))).toBe(true);
    expect(hasNonEmptySelectionV1(coverage({ defaultCoverage: 1, inverted: true }))).toBe(false);
    expect(hasNonEmptySelectionV1(coverage({ defaultCoverage: 0, inverted: true }))).toBe(true);
    expect(
      hasNonEmptySelectionV1(
        coverage({
          tiles: Object.freeze([
            Object.freeze({
              x: 4,
              y: 9,
              revision: parseRevision(3),
              payloadRef: 'sha256:coverage',
            }),
          ]),
        }),
      ),
    ).toBe(true);
  });

  it('latches standard selection modifiers at gesture start', () => {
    expect(resolveSelectionModeForPointerV1('replace', { shiftKey: false, altKey: false })).toBe(
      'replace',
    );
    expect(resolveSelectionModeForPointerV1('replace', { shiftKey: true, altKey: false })).toBe(
      'add',
    );
    expect(resolveSelectionModeForPointerV1('replace', { shiftKey: false, altKey: true })).toBe(
      'subtract',
    );
    expect(resolveSelectionModeForPointerV1('replace', { shiftKey: true, altKey: true })).toBe(
      'intersect',
    );
    expect(resolveSelectionModeForPointerV1('subtract', { shiftKey: false, altKey: false })).toBe(
      'subtract',
    );
  });

  it('rejects degenerate lasso gestures without asking M7 to replace the selection', () => {
    expect(lassoHasNonZeroAreaV1([])).toBe(false);
    expect(
      lassoHasNonZeroAreaV1([
        { x: 1, y: 1 },
        { x: 8, y: 8 },
        { x: 14, y: 14 },
      ]),
    ).toBe(false);
    expect(
      lassoHasNonZeroAreaV1([
        { x: 1, y: 1 },
        { x: 12, y: 2 },
        { x: 5, y: 13 },
      ]),
    ).toBe(true);
  });

  it('stitches contour segments into an actual polyline instead of an enclosing AABB', () => {
    const contours = stitchSelectionContourSegmentsV1([
      { a: { x: 1, y: 1 }, b: { x: 4, y: 1 } },
      { a: { x: 4, y: 1 }, b: { x: 5, y: 3 } },
      { a: { x: 5, y: 3 }, b: { x: 2, y: 5 } },
      { a: { x: 2, y: 5 }, b: { x: 1, y: 1 } },
    ]);
    expect(contours).toHaveLength(1);
    expect(contours[0]?.length).toBeGreaterThanOrEqual(5);
    expect(contours[0]?.[0]).toEqual(contours[0]?.at(-1));
    expect(contours[0]).toContainEqual({ x: 5, y: 3 });
  });

  it('invalidates contour identity when effective selection content changes', () => {
    const first = coverage({
      tiles: Object.freeze([
        Object.freeze({
          x: 0,
          y: 0,
          revision: parseRevision(3),
          payloadRef: 'sha256:first',
        }),
      ]),
    });
    expect(selectionContourKeyV1(first)).not.toBe(
      selectionContourKeyV1({ ...first, inverted: true }),
    );
    expect(selectionContourKeyV1(first)).not.toBe(
      selectionContourKeyV1({
        ...first,
        tiles: Object.freeze([{ ...first.tiles[0]!, payloadRef: 'sha256:second' }]),
      }),
    );
  });

  it('places the Launcher around exact contour bounds and keeps it inside workspace', () => {
    expect(
      placeSelectionLauncherV1(
        { minX: 120, minY: 100, maxX: 180, maxY: 160 },
        { width: 320, height: 240 },
        { width: 140, height: 44 },
      ),
    ).toEqual({ left: 80, top: 44, placement: 'above' });

    const nearTop = placeSelectionLauncherV1(
      { minX: 5, minY: 8, maxX: 25, maxY: 38 },
      { width: 180, height: 120 },
      { width: 140, height: 44 },
    );
    expect(nearTop.placement).toBe('below');
    expect(nearTop.left).toBe(M8_SELECTION_LAUNCHER_MARGIN_V1);
    expect(nearTop.top).toBeGreaterThanOrEqual(M8_SELECTION_LAUNCHER_MARGIN_V1);
  });

  it('keeps selection-mask and selected-content commands distinct', () => {
    const source = readFileSync('src/app/m8-selection-launcher.ts', 'utf8');
    expect(source).toContain("dataset.commandGroup = 'content'");
    expect(source).toContain("dataset.commandGroup = 'mask'");
    expect(source).toContain("setAvailability('transform', input.transformController.available())");
    expect(source).toContain('input.transformController.begin()');
    expect(source).toContain("setAvailability('cut', false, 'pending-dependency')");
    expect(source).toContain("setAvailability('fill', false, 'pending-dependency')");
    expect(source).not.toContain('prepareLassoSelectionV1');
    expect(source).not.toContain('prepareRectangularSelectionV1');
  });

  it('removes the rejected tile-AABB selection presentation', () => {
    const css = readFileSync('public/m8-selection-launcher.css', 'utf8');
    expect(css).not.toContain('.m8e-selection-bounds');
    expect(css).toContain('.m8e-selection-contour-ants');
    expect(css).toContain('@keyframes m8e-marching-ants');
    expect(css).toContain('stroke-dashoffset');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
  });

  it('uses the fixed selection morphology step without conflating it with image inversion', () => {
    expect(M8_SELECTION_MORPHOLOGY_STEP_PX_V1).toBe(1);
    const source = readFileSync('src/app/m8-selection-launcher.ts', 'utf8');
    expect(source).toContain('invertSelectionV1');
    expect(source).toContain('applySelectionMorphologyV1');
    expect(source).not.toContain('image invert');
  });
});
