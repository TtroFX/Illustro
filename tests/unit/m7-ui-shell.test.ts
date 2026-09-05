import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { M7_TOOL_FAMILIES_V1 } from '../../src/app/m7-ui-shell.js';

const m7ShellSource = readFileSync(
  new URL('../../src/app/m7-ui-shell.ts', import.meta.url),
  'utf8',
);

describe('M7 UI shell catalog', () => {
  it('keeps the canonical 14-family Tool Rail order', () => {
    expect(M7_TOOL_FAMILIES_V1.map((family) => family.id)).toEqual([
      'brush',
      'eraser',
      'blend',
      'fill',
      'eyedropper',
      'selection',
      'transform',
      'liquify',
      'gradient',
      'shape',
      'text',
      'repair',
      'ruler',
      'navigation',
    ]);
  });

  it('keeps Layer rows clipped to their own scroll region and exposes Brush settings first', () => {
    expect(m7ShellSource).toContain('> #layer-list { min-height: 0; overflow-y: auto;');
    expect(m7ShellSource).toContain(
      '> #layer-actions { min-height: 0; max-height: 156px; overflow: auto;',
    );
    const propertiesMove = m7ShellSource.indexOf(
      "moveInto('.shell-brush-properties-panel', 'brush')",
    );
    const presetsMove = m7ShellSource.indexOf("moveInto('.shell-brush-presets-panel', 'brush')");
    expect(propertiesMove).toBeGreaterThan(-1);
    expect(presetsMove).toBeGreaterThan(propertiesMove);
  });

  it('leaves M7 feature families planned until their milestones connect them', () => {
    expect(
      M7_TOOL_FAMILIES_V1.filter((family) => family.state === 'available').map(
        (family) => family.id,
      ),
    ).toEqual(['brush', 'eraser', 'blend', 'navigation']);
    expect(M7_TOOL_FAMILIES_V1.find((family) => family.id === 'selection')?.progress).toContain(
      'M7A',
    );
    expect(M7_TOOL_FAMILIES_V1.find((family) => family.id === 'fill')?.progress).toContain('M7B');
  });
});
