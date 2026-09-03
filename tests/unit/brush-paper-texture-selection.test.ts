import { describe, expect, it } from 'vitest';
import {
  BUILTIN_BRUSH_PAPER_RESOURCES_V1,
  brushGrainResourceIdV1,
  brushPaperTextureResourceIdV1,
  createBaselineBrushPresetV1,
  withBrushGrainResourceIdV1,
  withBrushPaperTextureResourceIdV1,
} from '../../src/domain/brush-schema.js';
import { PaintSessionControllerV1 } from '../../src/app/paint-session-controller.js';

class FakeRendererDocumentPort {
  async configureDocument(): Promise<void> {}
  async restoreBaselineStrokes(): Promise<void> {}
  async applyBaselineTilePatches(): Promise<void> {}
}

describe('M6A-036 paper texture selection', () => {
  it('publishes exactly the twelve accepted paper-subtype aliases', () => {
    expect(BUILTIN_BRUSH_PAPER_RESOURCES_V1).toHaveLength(12);
    expect(new Set(BUILTIN_BRUSH_PAPER_RESOURCES_V1.map((resource) => resource.id)).size).toBe(12);
    expect(BUILTIN_BRUSH_PAPER_RESOURCES_V1[0]?.id).toBe('builtin.grain.paper.01');
    expect(BUILTIN_BRUSH_PAPER_RESOURCES_V1.at(-1)?.id).toBe('builtin.grain.paper.12');
  });

  it('uses the same single texture slot and distinguishes paper from ordinary grain', () => {
    const preset = createBaselineBrushPresetV1({
      id: 'paper.paint',
      name: 'Paper',
      category: 'Test',
      behavior: 'paint',
    });
    const grain = withBrushGrainResourceIdV1(preset, 'builtin.grain.fine.01');
    expect(brushGrainResourceIdV1(grain)).toBe('builtin.grain.fine.01');
    expect(brushPaperTextureResourceIdV1(grain)).toBeNull();
    const paper = withBrushPaperTextureResourceIdV1(grain, 'builtin.grain.paper.04');
    expect(brushGrainResourceIdV1(paper)).toBeNull();
    expect(brushPaperTextureResourceIdV1(paper)).toBe('builtin.grain.paper.04');
    const backToGrain = withBrushGrainResourceIdV1(paper, 'user.grain.custom');
    expect(brushPaperTextureResourceIdV1(backToGrain)).toBeNull();
    expect(brushGrainResourceIdV1(backToGrain)).toBe('user.grain.custom');
  });

  it('captures paper as grain-kind/paper-subtype runtime resource state', () => {
    const session = new PaintSessionControllerV1(new FakeRendererDocumentPort());
    session.setBrushPaperTextureResourceId('builtin.grain.paper.09');
    expect(session.brushPaperTextureResourceId()).toBe('builtin.grain.paper.09');
    expect(session.brushGrainResourceId()).toBeNull();
    expect(session.snapshot()).toMatchObject({
      brushTextureResourceKind: 'grain',
      brushTextureResourceSubtype: 'paper',
      brushTextureResourceId: 'builtin.grain.paper.09',
    });
  });
});
