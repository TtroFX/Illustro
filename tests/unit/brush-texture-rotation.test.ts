import { describe, expect, it } from 'vitest';
import {
  brushTextureRotationDegreesV1,
  brushTextureScaleV1,
  brushTextureStrengthV1,
  createBaselineBrushPresetV1,
  withBrushPaperTextureResourceIdV1,
  withBrushTextureRotationDegreesV1,
  withBrushTextureScaleV1,
  withBrushTextureStrengthV1,
} from '../../src/domain/brush-schema.js';
import { PaintSessionControllerV1 } from '../../src/app/paint-session-controller.js';

class FakeRendererDocumentPort {
  async configureDocument(): Promise<void> {}
  async restoreBaselineStrokes(): Promise<void> {}
  async applyBaselineTilePatches(): Promise<void> {}
}

describe('M6A-039 texture rotation', () => {
  it('normalizes arbitrary finite degrees into the canonical 0..360 range', () => {
    const preset = createBaselineBrushPresetV1({
      id: 'texture.rotation',
      name: 'Texture Rotation',
      category: 'Test',
      behavior: 'paint',
    });
    expect(brushTextureRotationDegreesV1(preset)).toBe(0);
    expect(brushTextureRotationDegreesV1(withBrushTextureRotationDegreesV1(preset, 450))).toBe(90);
    expect(brushTextureRotationDegreesV1(withBrushTextureRotationDegreesV1(preset, -90))).toBe(270);
    expect(() => withBrushTextureRotationDegreesV1(preset, Number.NaN)).toThrow(TypeError);
    expect(withBrushTextureRotationDegreesV1(preset, 360).texture.rotationDegrees).toBeUndefined();
  });

  it('keeps rotation orthogonal to paper identity, strength, and scale', () => {
    const preset = withBrushTextureRotationDegreesV1(
      withBrushTextureScaleV1(
        withBrushTextureStrengthV1(
          withBrushPaperTextureResourceIdV1(
            createBaselineBrushPresetV1({
              id: 'texture.rotation.orthogonal',
              name: 'Texture Rotation Orthogonal',
              category: 'Test',
              behavior: 'paint',
            }),
            'builtin.grain.paper.08',
          ),
          0.4,
        ),
        3,
      ),
      135,
    );
    expect(brushTextureRotationDegreesV1(preset)).toBe(135);
    expect(brushTextureScaleV1(preset)).toBe(3);
    expect(brushTextureStrengthV1(preset)).toBe(0.4);
    expect(preset.texture.resourceSubtype).toBe('paper');
  });

  it('captures normalized texture rotation in runtime state', () => {
    const session = new PaintSessionControllerV1(new FakeRendererDocumentPort());
    expect(session.setBrushTextureRotationDegrees(-45)).toBe(315);
    expect(session.brushTextureRotationDegrees()).toBe(315);
    expect(session.snapshot().brushTextureRotationDegrees).toBe(315);
    expect(() => session.setBrushTextureRotationDegrees(Number.POSITIVE_INFINITY)).toThrow(
      TypeError,
    );
  });
});
