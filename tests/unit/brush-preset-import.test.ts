import { describe, expect, it } from 'vitest';
import { createBaselineBrushPresetV1 } from '../../src/domain/brush-schema.js';
import {
  createBrushPresetLibraryStateV1,
  importBrushPresetV1,
  selectedBrushPresetItemV1,
} from '../../src/app/brush-preset-library.js';

function importedFixture() {
  return createBaselineBrushPresetV1({
    id: 'user.imported.native',
    name: 'Imported Native',
    category: 'Imported',
    behavior: 'paint',
    defaultSizePx: 31,
    tags: ['native', 'imported'],
  });
}

describe('M6B-003 canonical native brush library import', () => {
  it('adds a normalized native preset as an unlocked user baseline and selects it', () => {
    const initial = createBrushPresetLibraryStateV1();
    const preset = importedFixture();
    const next = importBrushPresetV1(initial, preset);
    const selected = selectedBrushPresetItemV1(next);

    expect(next.items).toHaveLength(initial.items.length + 1);
    expect(next.selectedPresetId).toBe(preset.id);
    expect(selected).toMatchObject({ source: 'user', locked: false, modified: false });
    expect(selected.baseline).toEqual(preset);
    expect(selected.preset).toEqual(preset);
  });

  it('supports a collision-safe replacement id without mutating canonical brush parameters', () => {
    const initial = createBrushPresetLibraryStateV1();
    const source = importedFixture();
    const next = importBrushPresetV1(initial, source, 'user.imported.collision-safe');
    const selected = selectedBrushPresetItemV1(next).preset;

    expect(selected.id).toBe('user.imported.collision-safe');
    expect(selected.revision).toBe(1);
    expect({ ...selected, id: source.id }).toEqual(source);
    expect(() => importBrushPresetV1(next, source, selected.id)).toThrow('already exists');
  });
});
