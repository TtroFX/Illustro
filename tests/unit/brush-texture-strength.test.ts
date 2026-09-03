import { describe, expect, it } from 'vitest';
import {
  brushGrainResourceIdV1,
  brushPaperTextureResourceIdV1,
  brushTextureStrengthV1,
  createBaselineBrushPresetV1,
  withBrushGrainResourceIdV1,
  withBrushPaperTextureResourceIdV1,
  withBrushTextureStrengthV1,
} from '../../src/domain/brush-schema.js';
import { PaintSessionControllerV1 } from '../../src/app/paint-session-controller.js';

class FakeRendererDocumentPort {
  async configureDocument(): Promise<void> {}
  async restoreBaselineStrokes(): Promise<void> {}
  async applyBaselineTilePatches(): Promise<void> {}
}

describe('M6A-037 texture strength', () => {
  it('keeps zero as the exact default and validates the canonical 0..1 amount', () => {
    const preset = createBaselineBrushPresetV1({
      id: 'texture.strength',
      name: 'Texture Strength',
      category: 'Test',
      behavior: 'paint',
    });
    expect(brushTextureStrengthV1(preset)).toBe(0);
    const strengthened = withBrushTextureStrengthV1(preset, 0.65);
    expect(brushTextureStrengthV1(strengthened)).toBe(0.65);
    expect(() => withBrushTextureStrengthV1(preset, -0.01)).toThrow(RangeError);
    expect(() => withBrushTextureStrengthV1(preset, 1.01)).toThrow(RangeError);
    const reset = withBrushTextureStrengthV1(strengthened, 0);
    expect(brushTextureStrengthV1(reset)).toBe(0);
    expect(reset.texture.strength).toBeUndefined();
  });

  it('preserves strength while the single texture slot switches between grain and paper', () => {
    const preset = withBrushTextureStrengthV1(
      createBaselineBrushPresetV1({
        id: 'texture.switch',
        name: 'Texture Switch',
        category: 'Test',
        behavior: 'paint',
      }),
      0.42,
    );
    const grain = withBrushGrainResourceIdV1(preset, 'builtin.grain.rough.02');
    expect(brushGrainResourceIdV1(grain)).toBe('builtin.grain.rough.02');
    expect(brushTextureStrengthV1(grain)).toBe(0.42);
    const paper = withBrushPaperTextureResourceIdV1(grain, 'builtin.grain.paper.03');
    expect(brushGrainResourceIdV1(paper)).toBeNull();
    expect(brushPaperTextureResourceIdV1(paper)).toBe('builtin.grain.paper.03');
    expect(brushTextureStrengthV1(paper)).toBe(0.42);
  });

  it('captures strength independently from resource identity in runtime state', () => {
    const session = new PaintSessionControllerV1(new FakeRendererDocumentPort());
    session.setBrushPaperTextureResourceId('builtin.grain.paper.01');
    session.setBrushTextureStrength(0.5);
    expect(session.brushTextureStrength()).toBe(0.5);
    expect(session.snapshot()).toMatchObject({
      brushTextureResourceKind: 'grain',
      brushTextureResourceSubtype: 'paper',
      brushTextureResourceId: 'builtin.grain.paper.01',
      brushTextureStrength: 0.5,
    });
    expect(() => session.setBrushTextureStrength(Number.NaN)).toThrow(RangeError);
  });
});
