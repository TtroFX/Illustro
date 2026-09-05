import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  M8_INSPECTOR_BLOCKS_V1,
  M8_INSPECTOR_WIDTH_V1,
  M8_PIP_DEFAULT_WIDTH_V1,
  M8_PIP_MIN_HEIGHT_V1,
  M8_PIP_MIN_WIDTH_V1,
} from '../../src/app/m8-inspector-dock.js';
import {
  M8_TOOL_RAIL_WIDTH_STORAGE_KEY_V1,
  M8_TOOL_RAIL_WIDTH_V1,
} from '../../src/app/m8-tool-rail.js';

const source = readFileSync(new URL('../../src/app/m8-inspector-dock.ts', import.meta.url), 'utf8');
const railSource = readFileSync(new URL('../../src/app/m8-tool-rail.ts', import.meta.url), 'utf8');
const shellSource = readFileSync(new URL('../../src/app/shell.ts', import.meta.url), 'utf8');
const css = readFileSync(new URL('../../public/m8-inspector.css', import.meta.url), 'utf8');

describe('M8D canonical Inspector workspace', () => {
  it('keeps the exact thirteen canonical Inspector blocks and first-run expansion policy', () => {
    expect(M8_INSPECTOR_BLOCKS_V1.map((entry) => entry.id)).toEqual([
      'tool-properties',
      'brush-presets',
      'brush-studio',
      'color',
      'layers',
      'layer-properties',
      'effects-adjustments',
      'navigator',
      'reference-sub-view',
      'history',
      'quick-access',
      'assets',
      'auto-actions-timelapse',
    ]);
    expect(
      M8_INSPECTOR_BLOCKS_V1.filter((entry) => entry.defaultExpanded).map((entry) => entry.id),
    ).toEqual(['tool-properties', 'brush-presets', 'color', 'layers']);
  });

  it('uses the canonical width and PiP geometry contract', () => {
    expect(M8_INSPECTOR_WIDTH_V1).toEqual({ min: 260, default: 320, max: 480 });
    expect(M8_PIP_DEFAULT_WIDTH_V1).toBe(280);
    expect(M8_PIP_MIN_WIDTH_V1).toBe(220);
    expect(M8_PIP_MIN_HEIGHT_V1).toBe(140);
    expect(css).toContain('height: 36px');
    expect(css).toContain('.m8d-floating-layer');
    expect(css).toContain('.m8d-dock-candidate');
  });

  it('supports collapse, reorder, detach, persistent PiP, magnetic redock, and Panel Manager workspaces', () => {
    for (const token of [
      'setBlockCollapsed',
      'onBlockPointerMove',
      'detach',
      'redock',
      'dockIndexCandidate',
      'm8d-dock-candidate',
      'saveCurrentWorkspace',
      'resetWorkspace',
      'data-m8d-workspace-select',
      'M8_INSPECTOR_WORKSPACE_KEY_V1',
    ])
      expect(source).toContain(token);
    expect(css).toContain('.m8d-inspector-collapsed .m8-inspector-dock');
    expect(css).toContain('minmax(320px, 1fr) 42px');
    expect(css).toContain('visibility: visible;');
    expect(css).toContain('[data-m8d-inspector-toggle]');
    expect(css).not.toContain('.m8d-inspector-collapsed .m8d-floating-layer');
  });

  it('uses the exact fixed Inspector action strip and a production horizontal mirror proxy', () => {
    for (const action of ['undo', 'redo', 'flip-horizontal', 'flip-vertical']) {
      expect(source).toContain(`data-m8d-action=\"${action}\"`);
    }
    expect(source).toContain("proxyButtonV1('view-mirror')");
  });

  it('keeps Layer rows scan-first with Blend/Clipping controls and separate selected-layer actions', () => {
    expect(source).toContain('aria-label=\"ブレンドモード\"');
    expect(source).toContain('aria-label=\"クリッピング\"');
    expect(source).toContain('m8d-layer-actions');
    expect(source).toContain('aria-label=\"不透明度\"');
    expect(source).toContain('aria-label=\"マスク\"');
  });

  it('installs the Inspector in the production shell lifecycle', () => {
    expect(shellSource).toContain('installM8InspectorDockV1(app)');
    expect(shellSource).toContain('m8InspectorDock.dispose()');
  });

  it('persists Tool Rail thickness and keeps the 56–88 px M8C bounds', () => {
    expect(M8_TOOL_RAIL_WIDTH_V1).toEqual({ min: 56, default: 64, max: 88 });
    expect(M8_TOOL_RAIL_WIDTH_STORAGE_KEY_V1).toBe('illustro.m8.tool-rail-width.v1');
    expect(railSource).toContain('readPersistedWidth()');
    expect(railSource).toContain('persistWidth(current)');
  });
});
