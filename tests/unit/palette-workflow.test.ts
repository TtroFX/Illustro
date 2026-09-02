import { describe, expect, it } from 'vitest';
import { rgbBytesToUnitV1, rgbUnitToBytesV1 } from '../../src/domain/color.js';
import {
  activeColorPaletteV1,
  addColorToPaletteV1,
  createColorPaletteInWorkspaceV1,
  createColorWorkspaceStateV1,
  deleteColorPaletteV1,
  importColorPaletteBundleV1,
  moveColorPaletteV1,
  moveColorWithinPaletteV1,
  parseColorPaletteBundleV1,
  parseColorWorkspaceStateV1,
  removeColorFromPaletteV1,
  renameColorPaletteV1,
  serializeColorPaletteBundleV1,
  setActiveColorPaletteV1,
} from '../../src/app/color-workspace-state.js';

describe('M5D named palettes', () => {
  it('creates, names, selects and deletes multiple palettes while retaining one active palette', () => {
    let state = createColorWorkspaceStateV1();
    state = createColorPaletteInWorkspaceV1(state, 'palette-ink', 'Ink');
    state = createColorPaletteInWorkspaceV1(state, 'palette-skin', 'Skin');
    expect(state.palettes.map((palette) => palette.name)).toEqual(['基本', 'Ink', 'Skin']);
    state = renameColorPaletteV1(state, 'palette-ink', 'Line Art');
    state = setActiveColorPaletteV1(state, 'palette-ink');
    expect(activeColorPaletteV1(state).name).toBe('Line Art');
    state = deleteColorPaletteV1(state, 'palette-skin');
    expect(state.palettes.map((palette) => palette.id)).toEqual(['palette-default', 'palette-ink']);
    state = deleteColorPaletteV1(state, 'palette-default');
    expect(activeColorPaletteV1(state).id).toBe('palette-ink');
    expect(() => deleteColorPaletteV1(state, 'palette-ink')).toThrow(/at least one palette/);
  });

  it('reorders named palettes without changing active identity', () => {
    let state = createColorWorkspaceStateV1();
    state = createColorPaletteInWorkspaceV1(state, 'palette-a', 'A');
    state = createColorPaletteInWorkspaceV1(state, 'palette-b', 'B');
    state = setActiveColorPaletteV1(state, 'palette-a');
    state = moveColorPaletteV1(state, 'palette-a', 0);
    expect(state.palettes.map((palette) => palette.id)).toEqual([
      'palette-a',
      'palette-default',
      'palette-b',
    ]);
    expect(state.activePaletteId).toBe('palette-a');
  });

  it('adds, removes and reorders palette colors using canonical encoded RGB values', () => {
    let state = createColorWorkspaceStateV1();
    const red = rgbBytesToUnitV1(255, 0, 0);
    const green = rgbBytesToUnitV1(0, 255, 0);
    state = createColorPaletteInWorkspaceV1(state, 'palette-edit', 'Editable');
    state = addColorToPaletteV1(state, 'palette-edit', red);
    state = addColorToPaletteV1(state, 'palette-edit', green);
    state = addColorToPaletteV1(state, 'palette-edit', red);
    expect(activeColorPaletteV1(state).colors).toHaveLength(2);
    state = moveColorWithinPaletteV1(state, 'palette-edit', 1, 0);
    expect(rgbUnitToBytesV1(activeColorPaletteV1(state).colors[0] ?? red)).toEqual([0, 255, 0]);
    state = removeColorFromPaletteV1(state, 'palette-edit', 1);
    expect(activeColorPaletteV1(state).colors).toHaveLength(1);
  });

  it('migrates the pre-palette color-workspace/1 payload without losing color history', () => {
    const legacy = {
      schema: 'illustro.color-workspace/1',
      current: [1, 0, 0],
      previous: [0, 0, 0],
      history: [
        [1, 0, 0],
        [0, 0, 0],
      ],
    };
    const state = parseColorWorkspaceStateV1(legacy);
    expect(rgbUnitToBytesV1(state.current)).toEqual([255, 0, 0]);
    expect(state.history).toHaveLength(2);
    expect(state.palettes).toHaveLength(1);
    expect(activeColorPaletteV1(state).name).toBe('基本');
  });

  it('exports/imports versioned palette bundles and resolves imported id collisions deterministically', () => {
    let source = createColorWorkspaceStateV1();
    source = createColorPaletteInWorkspaceV1(source, 'palette-a', 'A');
    source = addColorToPaletteV1(source, 'palette-a', rgbBytesToUnitV1(12, 34, 56));
    const encoded = serializeColorPaletteBundleV1(source, 'display-p3');
    const bundle = parseColorPaletteBundleV1(JSON.parse(encoded));
    expect(bundle.workingSpace).toBe('display-p3');
    expect(bundle.encoding).toBe('encoded-rgb-unit');

    let destination = createColorWorkspaceStateV1();
    destination = createColorPaletteInWorkspaceV1(destination, 'palette-a', 'Existing A');
    destination = importColorPaletteBundleV1(destination, bundle);
    expect(destination.palettes.map((palette) => palette.id)).toEqual([
      'palette-default',
      'palette-a',
      'palette-default-2',
      'palette-a-2',
    ]);
    expect(destination.activePaletteId).toBe('palette-default-2');
  });
});
