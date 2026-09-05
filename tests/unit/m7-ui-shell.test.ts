import { describe, expect, it } from 'vitest';
import { M7_TOOL_FAMILIES_V1 } from '../../src/app/m7-ui-shell.js';

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

  it('leaves M7 feature families planned until their milestones connect them', () => {
    expect(
      M7_TOOL_FAMILIES_V1.filter((family) => family.state === 'available').map(
        (family) => family.id,
      ),
    ).toEqual(['brush', 'eraser', 'blend', 'navigation']);
    expect(M7_TOOL_FAMILIES_V1.find((family) => family.id === 'selection')?.progress).toContain(
      'M7A',
    );
    expect(M7_TOOL_FAMILIES_V1.find((family) => family.id === 'fill')?.progress).toContain(
      'M7B',
    );
  });
});
