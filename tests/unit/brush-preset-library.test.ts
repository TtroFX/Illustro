import { describe, expect, it } from 'vitest';
import {
  brushPresetCategoriesV1,
  createBrushPresetLibraryStateV1,
  createUserBrushPresetV1,
  deleteBrushPresetV1,
  duplicateBrushPresetV1,
  filteredBrushPresetItemsV1,
  parseBrushPresetLibraryV1,
  renameBrushPresetV1,
  resetBrushPresetV1,
  selectBrushPresetV1,
  selectedBrushPresetItemV1,
  serializeBrushPresetLibraryV1,
  setBrushPresetCategoryV1,
  setBrushPresetLockedV1,
  setBrushPresetSearchV1,
} from '../../src/app/brush-preset-library.js';
import {
  DEFAULT_BRUSH_PACK_CATEGORY_COUNTS_V1,
  DEFAULT_BRUSH_PACK_COUNT_V1,
} from '../../src/app/default-brush-pack.js';

describe('M6A brush preset library', () => {
  it('starts with immutable runtime factory baselines for every implemented behavior', () => {
    const state = createBrushPresetLibraryStateV1();
    expect(state.items).toHaveLength(DEFAULT_BRUSH_PACK_COUNT_V1);
    expect(new Set(state.items.map((item) => item.preset.behavior))).toEqual(
      new Set(['paint', 'erase', 'smudge', 'blur']),
    );
    expect(state.items.every((item) => item.source === 'factory' && !item.modified)).toBe(true);
  });

  it('creates and duplicates user presets without mutating the selected factory preset', () => {
    const original = createBrushPresetLibraryStateV1();
    const created = createUserBrushPresetV1(original, { id: 'user.1', name: 'My Brush' });
    expect(selectedBrushPresetItemV1(created).preset.name).toBe('My Brush');
    expect(original.items).toHaveLength(DEFAULT_BRUSH_PACK_COUNT_V1);
    const duplicated = duplicateBrushPresetV1(created, 'builtin.runtime.eraser', 'user.2');
    expect(selectedBrushPresetItemV1(duplicated).preset.behavior).toBe('erase');
    expect(selectedBrushPresetItemV1(duplicated).source).toBe('user');
  });

  it('marks rename as Modified and reset restores the exact baseline', () => {
    let state = createBrushPresetLibraryStateV1();
    state = createUserBrushPresetV1(state, { id: 'user.reset', name: 'Baseline Name' });
    state = renameBrushPresetV1(state, 'user.reset', 'Changed Name');
    expect(selectedBrushPresetItemV1(state).modified).toBe(true);
    expect(selectedBrushPresetItemV1(state).preset.revision).toBe(2);
    state = resetBrushPresetV1(state, 'user.reset');
    expect(selectedBrushPresetItemV1(state).preset.name).toBe('Baseline Name');
    expect(selectedBrushPresetItemV1(state).modified).toBe(false);
  });

  it('keeps factory presets undeletable while user presets can be removed', () => {
    const factory = createBrushPresetLibraryStateV1();
    expect(() => deleteBrushPresetV1(factory, 'builtin.runtime.round')).toThrow(/factory/);
    let state = createUserBrushPresetV1(factory, { id: 'user.delete' });
    state = deleteBrushPresetV1(state, 'user.delete');
    expect(state.items).toHaveLength(DEFAULT_BRUSH_PACK_COUNT_V1);
  });

  it('lock blocks destructive edits but can be explicitly released', () => {
    let state = createBrushPresetLibraryStateV1();
    state = createUserBrushPresetV1(state, { id: 'user.locked', name: 'Lock Me' });
    state = setBrushPresetLockedV1(state, 'user.locked', true);
    expect(() => renameBrushPresetV1(state, 'user.locked', 'No')).toThrow(/locked/);
    expect(() => deleteBrushPresetV1(state, 'user.locked')).toThrow(/locked/);
    state = setBrushPresetLockedV1(state, 'user.locked', false);
    state = renameBrushPresetV1(state, 'user.locked', 'Unlocked');
    expect(selectedBrushPresetItemV1(state).preset.name).toBe('Unlocked');
  });

  it('filters by search text, tags, and normalized categories', () => {
    let state = createBrushPresetLibraryStateV1();
    expect(new Set(brushPresetCategoriesV1(state))).toEqual(
      new Set(Object.keys(DEFAULT_BRUSH_PACK_CATEGORY_COUNTS_V1)),
    );
    state = setBrushPresetSearchV1(state, 'Smudge');
    expect(filteredBrushPresetItemsV1(state).map((item) => item.preset.id)).toEqual([
      'builtin.runtime.smudge',
      'builtin.blend.blender',
      'builtin.runtime.blur',
    ]);
    state = setBrushPresetSearchV1(state, '');
    state = setBrushPresetCategoryV1(state, 'Pencil');
    expect(filteredBrushPresetItemsV1(state)).toHaveLength(6);
  });

  it('persists user presets plus factory Modified/lock metadata without replacing factory baselines', () => {
    let state = createBrushPresetLibraryStateV1();
    state = renameBrushPresetV1(state, 'builtin.runtime.round', 'Round Pen Modified');
    state = setBrushPresetLockedV1(state, 'builtin.runtime.round', true);
    state = createUserBrushPresetV1(state, { id: 'user.persist', name: 'Persist Me' });
    state = selectBrushPresetV1(state, 'user.persist');
    const restored = parseBrushPresetLibraryV1(serializeBrushPresetLibraryV1(state));
    expect(restored.selectedPresetId).toBe('user.persist');
    expect(restored.items).toHaveLength(DEFAULT_BRUSH_PACK_COUNT_V1 + 1);
    const factory = restored.items.find((item) => item.preset.id === 'builtin.runtime.round');
    expect(factory?.baseline.name).toBe('Round Pen');
    expect(factory?.preset.name).toBe('Round Pen Modified');
    expect(factory?.modified).toBe(true);
    expect(factory?.locked).toBe(true);
  });
});
