import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseRevision } from '../../src/domain/identity.js';
import type { RasterSelectionCoverageV1 } from '../../src/app/selection-coverage-controller.js';
import {
  M8_SELECTION_LAUNCHER_MARGIN_V1,
  M8_SELECTION_MORPHOLOGY_STEP_PX_V1,
  hasNonEmptySelectionV1,
  projectSelectionBoundsToStageV1,
  selectionDocumentBoundsV1,
} from '../../src/app/m8-selection-launcher.js';
import type { ViewportSnapshotV1 } from '../../src/app/viewport-controller.js';

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

const identityViewport: ViewportSnapshotV1 = Object.freeze({
  schema: 'illustro.viewport-state/1' as const,
  documentWidth: 100,
  documentHeight: 100,
  stageWidth: 100,
  stageHeight: 100,
  baseWidth: 100,
  baseHeight: 100,
  panX: 0,
  panY: 0,
  zoom: 1,
  rotationDegrees: 0,
  mirrored: false,
  pixelated: false,
  workspacePresentation: false,
});

describe('M8E Selection Launcher', () => {
  it('shows only for a non-empty effective selection', () => {
    expect(hasNonEmptySelectionV1(null)).toBe(false);
    expect(hasNonEmptySelectionV1(coverage())).toBe(false);
    expect(
      hasNonEmptySelectionV1(
        coverage({
          tiles: Object.freeze([
            Object.freeze({
              x: 0,
              y: 0,
              revision: parseRevision(3),
              payloadRef: 'sha256:test',
            }),
          ]),
        }),
      ),
    ).toBe(true);
    expect(hasNonEmptySelectionV1(coverage({ defaultCoverage: 1 }))).toBe(true);
    expect(hasNonEmptySelectionV1(coverage({ defaultCoverage: 1, inverted: true }))).toBe(false);
  });

  it('derives sparse selection bounds without materializing the whole canvas', () => {
    const bounds = selectionDocumentBoundsV1(
      coverage({
        tiles: Object.freeze([
          Object.freeze({
            x: 1,
            y: 2,
            revision: parseRevision(3),
            payloadRef: 'sha256:a',
          }),
          Object.freeze({
            x: 2,
            y: 3,
            revision: parseRevision(3),
            payloadRef: 'sha256:b',
          }),
        ]),
      }),
      500,
      600,
    );
    expect(bounds).toEqual({ minX: 128, minY: 256, maxX: 384, maxY: 512 });
  });

  it('projects selection bounds into stage coordinates through the viewport transform', () => {
    expect(
      projectSelectionBoundsToStageV1({ minX: 20, minY: 30, maxX: 40, maxY: 60 }, identityViewport),
    ).toEqual({ minX: 20, minY: 30, maxX: 40, maxY: 60 });
  });

  it('uses compact canonical placement and morphology constants', () => {
    expect(M8_SELECTION_LAUNCHER_MARGIN_V1).toBe(12);
    expect(M8_SELECTION_MORPHOLOGY_STEP_PX_V1).toBe(1);
  });

  it('keeps unimplemented transform, cut and fill visible but non-fake', () => {
    const source = readFileSync('src/app/m8-selection-launcher.ts', 'utf8');
    expect(source).toContain("createButtonV1('transform'");
    expect(source).toContain("createButtonV1('cut'");
    expect(source).toContain("createButtonV1('fill'");
    expect(source).toContain("'planned'");
    expect(source).not.toContain("command === 'transform'");
    expect(source).not.toContain("command === 'cut'");
    expect(source).not.toContain("command === 'fill'");
  });

  it('connects real selection creation and available M7A operations', () => {
    const source = readFileSync('src/app/m8-selection-launcher.ts', 'utf8');
    for (const token of [
      'prepareRectangularSelectionV1',
      'prepareLassoSelectionV1',
      'prepareSelectionCopyV1',
      'invertSelectionV1',
      'applySelectionMorphologyV1',
      'input.selectionCoverage.clear()',
    ]) {
      expect(source).toContain(token);
    }
    expect(source).toContain("drawing !== 'active'");
    expect(source).toContain('dismissedSignature');
  });

  it('uses the canonical light contextual visual language and quick motion', () => {
    const css = readFileSync('public/m8-selection-launcher.css', 'utf8');
    expect(css).toContain('background: rgb(255 255 255 / 97%)');
    expect(css).toContain('border-radius: 14px');
    expect(css).toContain('120ms');
    expect(css).toContain('pointer-events: auto');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
  });
});
