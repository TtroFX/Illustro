import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import type { M8ContextualCanvasModeV1 } from '../../src/app/m8-contextual-canvas-controller.js';

describe('M8E contextual canvas controller', () => {
  it('keeps ruler and lineart previews explicitly pending on unfinished M7 dependencies', () => {
    const source = readFileSync('src/app/m8-contextual-canvas-controller.ts', 'utf8');
    expect(source).toContain("export type M8ContextualCanvasModeV1 = 'ruler' | 'lineart'");
    expect(source).toContain("host.dataset.productionState = 'pending-dependency'");
    expect(source).toContain("button.dataset.productionState = 'pending-dependency'");
    expect(source).not.toContain('commitSnapshotTransform');
    expect(source).not.toContain('markDirty');
  });

  it('exposes ruler spatial controls without inventing a document mutation path', () => {
    const source = readFileSync('src/app/m8-contextual-canvas-controller.ts', 'utf8');
    expect(source).toContain("host.dataset.contextKind = 'ruler'");
    expect(source).toContain('定規を移動');
    expect(source).toContain('角度を編集');
    expect(source).toContain('中心を移動');
    expect(source).toContain('スナップ切替');
    expect(source).toContain('Canvas上では位置・角度・中心・位相を直接操作');
  });

  it('renders lineart topology states with non-color-only edge and node semantics', () => {
    const source = readFileSync('src/app/m8-contextual-canvas-controller.ts', 'utf8');
    expect(source).toContain("host.dataset.contextKind = 'lineart'");
    expect(source).toContain("'automatic' | 'manual' | 'rejected' | 'unresolved'");
    expect(source).toContain("'endpoint' | 'junction' | 'rejected' | 'unresolved'");
    expect(source).toContain("group.classList.add('m8e-lineart-node', 'is-rejected')");
    expect(source).toContain("diamond.classList.add('m8e-lineart-node', 'is-unresolved')");
  });

  it('supports isolated user-review URLs without changing the normal canvas context', () => {
    const source = readFileSync('src/app/m8-contextual-canvas-controller.ts', 'utf8');
    expect(source).toContain("new URLSearchParams(location.search).get('m8e-preview')");
    expect(source).toContain("value === 'ruler' || value === 'lineart'");
    const values: readonly M8ContextualCanvasModeV1[] = ['ruler', 'lineart'];
    expect(values).toEqual(['ruler', 'lineart']);
  });

  it('styles the contextual surfaces as lightweight canvas overlays', () => {
    const css = readFileSync('public/m8-selection-launcher.css', 'utf8');
    expect(css).toContain('.m8e-context-preview');
    expect(css).toContain('.m8e-context-preview-toolbar');
    expect(css).toContain('.m8e-ruler-guide-line');
    expect(css).toContain('.m8e-lineart-edge.is-unresolved');
    expect(css).toContain('.m8e-lineart-edge.is-rejected');
    expect(css).toContain('.m8e-lineart-node.is-unresolved');
  });
});
