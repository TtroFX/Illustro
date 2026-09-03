import { describe, expect, it } from 'vitest';
import {
  brushTextureBlendModeV1,
  brushTextureRotationDegreesV1,
  brushTextureScaleV1,
  brushTextureStrengthV1,
  createBaselineBrushPresetV1,
  withBrushPaperTextureResourceIdV1,
  withBrushTextureBlendModeV1,
  withBrushTextureRotationDegreesV1,
  withBrushTextureScaleV1,
  withBrushTextureStrengthV1,
} from '../../src/domain/brush-schema.js';
import { PaintSessionControllerV1 } from '../../src/app/paint-session-controller.js';
import { combineBrushTextureCoverageV1 } from '../../src/gpu/brush-texture-composite.js';

class FakeRendererDocumentPort {
  async configureDocument(): Promise<void> {}
  async restoreBaselineStrokes(): Promise<void> {}
  async applyBaselineTilePatches(): Promise<void> {}
}

describe('M6A-040 texture blend behavior', () => {
  it('uses multiply as the default and supports only coverage-domain modes', () => {
    const preset = createBaselineBrushPresetV1({
      id: 'texture.blend',
      name: 'Texture Blend',
      category: 'Test',
      behavior: 'paint',
    });
    expect(brushTextureBlendModeV1(preset)).toBe('multiply');
    expect(brushTextureBlendModeV1(withBrushTextureBlendModeV1(preset, 'subtract'))).toBe(
      'subtract',
    );
    expect(brushTextureBlendModeV1(withBrushTextureBlendModeV1(preset, 'add'))).toBe('add');
    expect(withBrushTextureBlendModeV1(preset, 'multiply').texture.blendMode).toBeUndefined();
  });

  it('defines deterministic scalar coverage combination without touching color', () => {
    expect(combineBrushTextureCoverageV1(0.8, 0.25, 0, 'multiply')).toBeCloseTo(0.8);
    expect(combineBrushTextureCoverageV1(0.8, 0.25, 1, 'multiply')).toBeCloseTo(0.2);
    expect(combineBrushTextureCoverageV1(0.8, 0.25, 0.5, 'subtract')).toBeCloseTo(0.425);
    expect(combineBrushTextureCoverageV1(0.8, 0.25, 0.5, 'add')).toBeCloseTo(0.825);
    expect(combineBrushTextureCoverageV1(0, 1, 1, 'add')).toBe(0);
  });

  it('keeps blend mode orthogonal to resource, strength, scale, and rotation', () => {
    const preset = withBrushTextureBlendModeV1(
      withBrushTextureRotationDegreesV1(
        withBrushTextureScaleV1(
          withBrushTextureStrengthV1(
            withBrushPaperTextureResourceIdV1(
              createBaselineBrushPresetV1({
                id: 'texture.blend.orthogonal',
                name: 'Texture Blend Orthogonal',
                category: 'Test',
                behavior: 'paint',
              }),
              'builtin.grain.paper.02',
            ),
            0.6,
          ),
          2,
        ),
        45,
      ),
      'subtract',
    );
    expect(brushTextureBlendModeV1(preset)).toBe('subtract');
    expect(brushTextureStrengthV1(preset)).toBe(0.6);
    expect(brushTextureScaleV1(preset)).toBe(2);
    expect(brushTextureRotationDegreesV1(preset)).toBe(45);
    expect(preset.texture.resourceSubtype).toBe('paper');
  });

  it('captures blend mode in runtime state without requiring a loaded texture', () => {
    const session = new PaintSessionControllerV1(new FakeRendererDocumentPort());
    expect(session.setBrushTextureBlendMode('add')).toBe('add');
    expect(session.brushTextureBlendMode()).toBe('add');
    expect(session.snapshot().brushTextureBlendMode).toBe('add');
  });
});
