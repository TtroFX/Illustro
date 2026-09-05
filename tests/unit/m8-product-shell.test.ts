import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  M8_PRODUCT_REGIONS_V1,
  M8_TASK_SURFACES_V1,
} from '../../src/app/m8-product-shell.js';

const shellSource = readFileSync(
  new URL('../../src/app/m8-product-shell.ts', import.meta.url),
  'utf8',
);
const shellCss = readFileSync(new URL('../../public/m8-shell.css', import.meta.url), 'utf8');

describe('M8 canonical product shell', () => {
  it('keeps the five canonical persistent editor regions', () => {
    expect([...M8_PRODUCT_REGIONS_V1]).toEqual([
      'document-bar',
      'tool-rail',
      'canvas-workspace',
      'inspector-dock',
      'inspector-action-strip',
    ]);
  });

  it('replaces the legacy visual shell instead of decorating legacy regions', () => {
    expect(shellSource).toContain("const CANONICAL_SHELL_ID = 'm8-canonical-shell'");
    expect(shellSource).toContain("compatibilityHost.hidden = true");
    expect(shellSource).toContain("app.dataset.m8LegacyUi = 'removed-from-production-surface'");
    expect(shellSource).not.toContain("requireElementV1<HTMLElement>(app, '.shell-topbar'");
    expect(shellSource).not.toContain("requireElementV1<HTMLElement>(app, '.shell-tool-rail'");
    expect(shellSource).not.toContain("requireElementV1<HTMLElement>(app, '.shell-inspector'");
    expect(shellCss).toContain('.m8-compatibility-host[hidden]');
    expect(shellCss).not.toContain('.m8-product-shell .shell-topbar');
  });

  it('moves the production canvas into the canonical workspace rather than mocking artwork', () => {
    expect(shellSource).toContain("'#render-surface'");
    expect(shellSource).toContain("frame.append(input.canvas)");
    expect(shellSource).toContain('id="canvas-viewport-frame"');
    expect(shellSource).toContain('m8-canvas-stage shell-canvas-stage');
  });

  it('keeps unconnected Library functions explicitly planned instead of faking production success', () => {
    expect(shellSource).toContain("surface.dataset.m8ProductionState = 'planned'");
    expect(shellSource).toContain('M9Aへ接続後に有効になります');
    expect(shellSource).toContain('type="search" disabled');
  });

  it('provides the complete M8B task-surface taxonomy as shells', () => {
    expect([...M8_TASK_SURFACES_V1]).toEqual([
      'new-document',
      'import-report',
      'export',
      'preferences',
      'settings',
      'help',
      'compatibility-diagnostics',
      'shortcut-customization',
      'workspace-customization',
      'destructive-confirmation',
    ]);
    expect(shellSource).toContain("const TASK_LAYER_ID = 'm8-task-layer'");
    expect(shellSource).toContain("const DATA_SAFETY_BANNER_ID = 'm8-data-safety-banner'");
    expect(shellSource).toContain("const TOAST_ID = 'm8-toast'");
    expect(shellCss).toContain('.m8-menu-popover');
    expect(shellCss).toContain('[data-m8-tooltip]::after');
    expect(shellCss).toContain('.m8-tool-family-flyout');
  });
});
