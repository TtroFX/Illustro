import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { M8_PRODUCT_REGIONS_V1 } from '../../src/app/m8-product-shell.js';

const shellSource = readFileSync(
  new URL('../../src/app/m8-product-shell.ts', import.meta.url),
  'utf8',
);
const shellCss = readFileSync(new URL('../../public/m8-shell.css', import.meta.url), 'utf8');

describe('M8 provisional product shell', () => {
  it('keeps the five canonical persistent editor regions', () => {
    expect([...M8_PRODUCT_REGIONS_V1]).toEqual([
      'document-bar',
      'tool-rail',
      'canvas-workspace',
      'inspector-dock',
      'inspector-action-strip',
    ]);
  });

  it('keeps unconnected Library functions explicitly planned instead of faking production success', () => {
    expect(shellSource).toContain("surface.dataset.m8ProductionState = 'planned'");
    expect(shellSource).toContain('M9Aのproduction pathへ接続後に有効になります');
    expect(shellSource).toContain('type="search" disabled');
  });

  it('provides reusable Library and task-surface shells without persistent canvas utility chrome', () => {
    expect(shellSource).toContain("const LIBRARY_ID = 'm8-library-surface'");
    expect(shellSource).toContain("const TASK_LAYER_ID = 'm8-task-layer'");
    expect(shellCss).toContain('.m8-library-surface[hidden]');
    expect(shellCss).toContain('.m8-task-layer[hidden]');
    expect(shellSource).not.toContain('m8-canvas-toolbar');
  });
});
