import { describe, expect, it } from 'vitest';
import {
  BUILTIN_BRUSH_GRAIN_RESOURCES_V1,
  brushGrainResourceIdV1,
  createBaselineBrushPresetV1,
  withBrushGrainResourceIdV1,
} from '../../src/domain/brush-schema.js';
import { PaintSessionControllerV1 } from '../../src/app/paint-session-controller.js';

class FakeRendererDocumentPort {
  async configureDocument(): Promise<void> {}
  async restoreBaselineStrokes(): Promise<void> {}
  async applyBaselineTilePatches(): Promise<void> {}
}

describe('M6A-035 grain selection', () => {
  it('publishes the final non-paper grain inventory shape as stable selection aliases', () => {
    expect(BUILTIN_BRUSH_GRAIN_RESOURCES_V1).toHaveLength(20);
    const counts = new Map<string, number>();
    for (const resource of BUILTIN_BRUSH_GRAIN_RESOURCES_V1) {
      counts.set(resource.family, (counts.get(resource.family) ?? 0) + 1);
    }
    expect(Object.fromEntries(counts)).toEqual({ fine: 6, rough: 6, fiber: 5, canvas: 3 });
    expect(new Set(BUILTIN_BRUSH_GRAIN_RESOURCES_V1.map((resource) => resource.id)).size).toBe(20);
  });

  it('defaults to no grain and persists both built-in and imported resource identities', () => {
    const preset = createBaselineBrushPresetV1({
      id: 'grain.paint',
      name: 'Grain',
      category: 'Test',
      behavior: 'paint',
    });
    expect(brushGrainResourceIdV1(preset)).toBeNull();
    const builtin = withBrushGrainResourceIdV1(preset, 'builtin.grain.fine.01');
    expect(brushGrainResourceIdV1(builtin)).toBe('builtin.grain.fine.01');
    const imported = withBrushGrainResourceIdV1(builtin, 'user.grain.abc123');
    expect(brushGrainResourceIdV1(imported)).toBe('user.grain.abc123');
    expect(brushGrainResourceIdV1(withBrushGrainResourceIdV1(imported, null))).toBeNull();
  });

  it('connects the selected grain identity into runtime stroke configuration state', () => {
    const session = new PaintSessionControllerV1(new FakeRendererDocumentPort());
    expect(session.brushGrainResourceId()).toBeNull();
    expect(session.setBrushGrainResourceId('builtin.grain.rough.02')).toBe(
      'builtin.grain.rough.02',
    );
    expect(session.snapshot()).toMatchObject({
      brushTextureResourceKind: 'grain',
      brushTextureResourceId: 'builtin.grain.rough.02',
    });
    expect(session.setBrushGrainResourceId(null)).toBeNull();
  });
});
