import { describe, expect, it } from 'vitest';
import {
  brushTextureScaleV1,
  brushTextureStrengthV1,
  createBaselineBrushPresetV1,
  withBrushPaperTextureResourceIdV1,
  withBrushTextureScaleV1,
  withBrushTextureStrengthV1,
} from '../../src/domain/brush-schema.js';
import { PaintSessionControllerV1 } from '../../src/app/paint-session-controller.js';

class FakeRendererDocumentPort {
  async configureDocument(): Promise<void> {}
  async restoreBaselineStrokes(): Promise<void> {}
  async applyBaselineTilePatches(): Promise<void> {}
}

describe('M6A-038 texture scale', () => {
  it('uses one as the canonical identity and validates 0.01..16x', () => {
    const preset = createBaselineBrushPresetV1({
      id: 'texture.scale',
      name: 'Texture Scale',
      category: 'Test',
      behavior: 'paint',
    });
    expect(brushTextureScaleV1(preset)).toBe(1);
    const scaled = withBrushTextureScaleV1(preset, 2.5);
    expect(brushTextureScaleV1(scaled)).toBe(2.5);
    expect(() => withBrushTextureScaleV1(preset, 0)).toThrow(RangeError);
    expect(() => withBrushTextureScaleV1(preset, 16.01)).toThrow(RangeError);
    const reset = withBrushTextureScaleV1(scaled, 1);
    expect(reset.texture.scale).toBeUndefined();
  });

  it('keeps scale orthogonal to resource subtype and strength', () => {
    const preset = withBrushTextureScaleV1(
      withBrushTextureStrengthV1(
        withBrushPaperTextureResourceIdV1(
          createBaselineBrushPresetV1({
            id: 'texture.orthogonal',
            name: 'Texture Orthogonal',
            category: 'Test',
            behavior: 'paint',
          }),
          'builtin.grain.paper.05',
        ),
        0.7,
      ),
      0.25,
    );
    expect(brushTextureScaleV1(preset)).toBe(0.25);
    expect(brushTextureStrengthV1(preset)).toBe(0.7);
    expect(preset.texture.resourceSubtype).toBe('paper');
  });

  it('captures scale in runtime state without inventing a texture payload', () => {
    const session = new PaintSessionControllerV1(new FakeRendererDocumentPort());
    session.setBrushTextureScale(4);
    expect(session.brushTextureScale()).toBe(4);
    expect(session.snapshot().brushTextureScale).toBe(4);
    expect(() => session.setBrushTextureScale(0.001)).toThrow(RangeError);
  });
});
