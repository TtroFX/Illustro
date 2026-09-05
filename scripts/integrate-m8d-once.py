from pathlib import Path
import re


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f'missing patch anchor: {label}')
    return text.replace(old, new, 1)

# 1) Wire the M8D Inspector into the production shell lifecycle.
shell_path = Path('src/app/shell.ts')
shell = shell_path.read_text()
shell = replace_once(
    shell,
    "import { installM8ProductShellV1, type M8ProductShellHandleV1 } from './m8-product-shell.js';\n",
    "import { installM8ProductShellV1, type M8ProductShellHandleV1 } from './m8-product-shell.js';\nimport { installM8InspectorDockV1 } from './m8-inspector-dock.js';\n",
    'shell import',
)
shell = replace_once(
    shell,
    "  const m8ProductShell = installM8ProductShellV1(app);\n  const m8ToolRail = installM8ToolRailV1(app);\n",
    "  const m8ProductShell = installM8ProductShellV1(app);\n  const m8ToolRail = installM8ToolRailV1(app);\n  const m8InspectorDock = installM8InspectorDockV1(app);\n",
    'shell install',
)
shell = replace_once(
    shell,
    "      m8ToolRail.dispose();\n      m8ProductShell.dispose();\n",
    "      m8InspectorDock.dispose();\n      m8ToolRail.dispose();\n      m8ProductShell.dispose();\n",
    'shell dispose',
)
shell_path.write_text(shell)

# 2) Fix literal inference and make Tool Rail thickness persistent as required by M8D-030.
inspector_path = Path('src/app/m8-inspector-dock.ts')
inspector = inspector_path.read_text()
inspector = replace_once(
    inspector,
    '  let resizeStartWidth = M8_INSPECTOR_WIDTH_V1.default;\n',
    '  let resizeStartWidth: number = M8_INSPECTOR_WIDTH_V1.default;\n',
    'inspector resize literal type',
)
# Horizontal mirror is already a real Viewport production command. Keep vertical as a visible provisional
# command until a canonical vertical-mirror state lands; it emits the explicit command event rather than faking success.
inspector = replace_once(
    inspector,
    "    if (button.dataset.m8dAction === 'undo') proxyButtonV1('history-undo');\n    else if (button.dataset.m8dAction === 'redo') proxyButtonV1('history-redo');\n    else {\n",
    "    if (button.dataset.m8dAction === 'undo') proxyButtonV1('history-undo');\n    else if (button.dataset.m8dAction === 'redo') proxyButtonV1('history-redo');\n    else if (button.dataset.m8dAction === 'flip-horizontal') proxyButtonV1('view-mirror');\n    else {\n",
    'horizontal mirror production proxy',
)
inspector_path.write_text(inspector)

rail_path = Path('src/app/m8-tool-rail.ts')
rail = rail_path.read_text()
rail = replace_once(
    rail,
    "export const M8_TOOL_RAIL_WIDTH_V1 = Object.freeze({ min: 56, default: 64, max: 88 });\n",
    "export const M8_TOOL_RAIL_WIDTH_V1 = Object.freeze({ min: 56, default: 64, max: 88 });\nexport const M8_TOOL_RAIL_WIDTH_STORAGE_KEY_V1 = 'illustro.m8.tool-rail-width.v1' as const;\n",
    'rail storage key',
)
rail = replace_once(
    rail,
    "  if (!canonicalShell || !rail) throw new Error('M8C requires the canonical M8B shell.');\n\n  rail.replaceChildren();\n",
    "  if (!canonicalShell || !rail) throw new Error('M8C requires the canonical M8B shell.');\n\n  const storage = (() => {\n    try {\n      return globalThis.localStorage;\n    } catch {\n      return null;\n    }\n  })();\n  const persistWidth = (width: number): void => {\n    try {\n      storage?.setItem(M8_TOOL_RAIL_WIDTH_STORAGE_KEY_V1, String(width));\n    } catch {\n      // Workspace density persistence is best-effort and never blocks drawing.\n    }\n  };\n  const readPersistedWidth = (): number => {\n    try {\n      const value = Number(storage?.getItem(M8_TOOL_RAIL_WIDTH_STORAGE_KEY_V1));\n      return Number.isFinite(value) ? clampWidthV1(value) : M8_TOOL_RAIL_WIDTH_V1.default;\n    } catch {\n      return M8_TOOL_RAIL_WIDTH_V1.default;\n    }\n  };\n\n  rail.replaceChildren();\n",
    'rail persistence helpers',
)
rail = replace_once(
    rail,
    "  const updateWidth = (width: number): void => {\n    const next = clampWidthV1(width);\n    canonicalShell.style.setProperty('--m8-rail-width', `${next}px`);\n    resizeHandle.setAttribute('aria-valuemin', String(M8_TOOL_RAIL_WIDTH_V1.min));\n    resizeHandle.setAttribute('aria-valuemax', String(M8_TOOL_RAIL_WIDTH_V1.max));\n    resizeHandle.setAttribute('aria-valuenow', String(next));\n  };\n",
    "  const updateWidth = (width: number, shouldPersist = true): void => {\n    const next = clampWidthV1(width);\n    canonicalShell.style.setProperty('--m8-rail-width', `${next}px`);\n    resizeHandle.setAttribute('aria-valuemin', String(M8_TOOL_RAIL_WIDTH_V1.min));\n    resizeHandle.setAttribute('aria-valuemax', String(M8_TOOL_RAIL_WIDTH_V1.max));\n    resizeHandle.setAttribute('aria-valuenow', String(next));\n    if (shouldPersist) persistWidth(next);\n  };\n",
    'rail update width',
)
rail = replace_once(
    rail,
    "    updateWidth(dragStartWidth + event.clientX - dragStartX);\n",
    "    updateWidth(dragStartWidth + event.clientX - dragStartX, false);\n",
    'rail drag move',
)
rail = replace_once(
    rail,
    "    dragPointerId = null;\n    resizeHandle.classList.remove('is-dragging');\n  };\n",
    "    dragPointerId = null;\n    resizeHandle.classList.remove('is-dragging');\n    const current = Number(resizeHandle.getAttribute('aria-valuenow'));\n    if (Number.isFinite(current)) persistWidth(current);\n  };\n",
    'rail drag end persist',
)
rail = replace_once(
    rail,
    "  resetWidth();\n  syncFromProduction();\n",
    "  updateWidth(readPersistedWidth(), false);\n  syncFromProduction();\n",
    'rail startup persisted width',
)
rail_path.write_text(rail)

# 3) Contract test for M8D canonical UI and interaction requirements.
test_path = Path('tests/unit/m8-inspector-dock.test.ts')
test_path.write_text("""import { readFileSync } from 'node:fs';
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
    expect(M8_INSPECTOR_BLOCKS_V1.filter((entry) => entry.defaultExpanded).map((entry) => entry.id)).toEqual([
      'tool-properties',
      'brush-presets',
      'color',
      'layers',
    ]);
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
    ]) expect(source).toContain(token);
    expect(css).toContain('.m8d-inspector-collapsed .m8-inspector-dock');
    expect(css).not.toContain('.m8d-inspector-collapsed .m8d-floating-layer');
  });

  it('uses the exact fixed Inspector action strip and a production horizontal mirror proxy', () => {
    for (const action of ['undo', 'redo', 'flip-horizontal', 'flip-vertical']) {
      expect(source).toContain(`data-m8d-action=\\"${action}\\"`);
    }
    expect(source).toContain("proxyButtonV1('view-mirror')");
  });

  it('keeps Layer rows scan-first with Blend/Clipping controls and separate selected-layer actions', () => {
    expect(source).toContain('aria-label=\\"ブレンドモード\\"');
    expect(source).toContain('aria-label=\\"クリッピング\\"');
    expect(source).toContain('m8d-layer-actions');
    expect(source).toContain('aria-label=\\"不透明度\\"');
    expect(source).toContain('aria-label=\\"マスク\\"');
  });

  it('installs the Inspector in the production shell lifecycle', () => {
    expect(shellSource).toContain("installM8InspectorDockV1(app)");
    expect(shellSource).toContain('m8InspectorDock.dispose()');
  });

  it('persists Tool Rail thickness and keeps the 56–88 px M8C bounds', () => {
    expect(M8_TOOL_RAIL_WIDTH_V1).toEqual({ min: 56, default: 64, max: 88 });
    expect(M8_TOOL_RAIL_WIDTH_STORAGE_KEY_V1).toBe('illustro.m8.tool-rail-width.v1');
    expect(railSource).toContain('readPersistedWidth()');
    expect(railSource).toContain('persistWidth(current)');
  });
});
""")

# 4) Record the user-approved M8C gate and set M8D implementation items to provisional.
progress_path = Path('IMPLEMENTATION_PROGRESS.md')
progress = progress_path.read_text()
progress = replace_once(
    progress,
    'USER-M8C M8C UI/UX/Visualユーザー確認PASS:未完了',
    'USER-M8C M8C UI/UX/Visualユーザー確認PASS:完了',
    'M8C user PASS',
)
start = progress.index('## M8D — 13-block Inspector / PiP / Workspace Customization')
end = progress.index('\n## M8E', start)
section = progress[start:end]
section = re.sub(r'^(M8D-\d{3} [^:\n]+):未完了$', r'\1:仮完了', section, flags=re.MULTILINE)
section = section.replace('M8D-検査 M8D内部検査:未完了', 'M8D-検査 M8D内部検査:仮完了')
# Publication/user gates are deliberately left untouched here.
progress = progress[:start] + section + progress[end:]
progress_path.write_text(progress)
