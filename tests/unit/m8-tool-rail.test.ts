import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  M8_TOOL_FAMILIES_V1,
  M8_TOOL_RAIL_ORDER_V1,
  M8_TOOL_RAIL_WIDTH_V1,
} from '../../src/app/m8-tool-rail.js';

const source = readFileSync(new URL('../../src/app/m8-tool-rail.ts', import.meta.url), 'utf8');
const css = readFileSync(new URL('../../public/m8-tool-rail.css', import.meta.url), 'utf8');

describe('M8C canonical Tool Rail', () => {
  it('keeps exactly fourteen logical Tool Families', () => {
    expect(M8_TOOL_FAMILIES_V1.map((family) => family.id)).toEqual([
      'brush',
      'eraser',
      'blend',
      'fill',
      'selection',
      'transform',
      'liquify',
      'gradient',
      'eyedropper',
      'text',
      'shape-path',
      'repair',
      'ruler-guide',
      'navigation',
    ]);
    expect(M8_TOOL_FAMILIES_V1).toHaveLength(14);
  });

  it('materializes the authoritative Gradient→Eyedropper→Lasso→Text→Shape interval', () => {
    const start = M8_TOOL_RAIL_ORDER_V1.indexOf('gradient');
    expect(M8_TOOL_RAIL_ORDER_V1.slice(start, start + 5)).toEqual([
      'gradient',
      'eyedropper',
      'lasso-direct',
      'text',
      'shape-path',
    ]);
    expect(M8_TOOL_RAIL_ORDER_V1.filter((id) => id !== 'lasso-direct')).toHaveLength(14);
  });

  it('uses the canonical continuous 56–88px geometry with a 64px default', () => {
    expect(M8_TOOL_RAIL_WIDTH_V1).toEqual({ min: 56, default: 64, max: 88 });
    expect(source).toContain("resizeHandle.setAttribute('role', 'separator')");
    expect(source).toContain("event.key === 'ArrowLeft'");
    expect(source).toContain("event.key === 'ArrowRight'");
    expect(source).toContain("resizeHandle.addEventListener('dblclick', resetWidth)");
    expect(css).toContain('--m8-rail-width: 64px');
  });

  it('uses icon-only persistent presentation with accessible identification', () => {
    expect(source).toContain('button.dataset.m8Tooltip = family.label');
    expect(source).toContain("button.setAttribute('aria-label', family.label)");
    expect(source).not.toContain('m8c-family-label');
    expect(css).toContain('width: 22px');
    expect(css).toContain('min-width: 44px');
    expect(css).toContain('.m8c-family-affordance');
  });

  it('uses restrained active tint plus structural indicator rather than saturated rows', () => {
    expect(css).toContain('.m8c-family-button[aria-pressed="true"]');
    expect(css).toContain('background: var(--m8c-soft)');
    expect(css).toContain('box-shadow: inset 3px 0 0 var(--m8c-accent)');
  });

  it('does not fake production paths for unfinished families', () => {
    expect(source).toContain(
      "button.dataset.productionState = hasProductionPath ? 'partial' : 'planned'",
    );
    expect(source).toContain("button.dataset.productionState = proxy ? 'available' : 'planned'");
    expect(source).toContain('button.disabled = true');
    expect(source).toContain('production接続待ち');
    expect(source).toContain("brush: 'brush-mode-raster'");
    expect(source).toContain("eraser: 'brush-mode-eraser'");
    expect(source).toContain("blend: 'brush-mode-smudge'");
  });

  it('provides family flyout discovery through long press and secondary activation', () => {
    expect(source).toContain('}, 460)');
    expect(source).toContain("scroller.addEventListener('contextmenu', onContextMenu)");
    expect(source).toContain("flyout.className = 'm8c-subtool-flyout'");
  });
});
