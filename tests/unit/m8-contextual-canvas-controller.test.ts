import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import type { M8ContextualCanvasModeV1 } from '../../src/app/m8-contextual-canvas-controller.js';

describe('M8E contextual canvas controller', () => {
  it('keeps unfinished M7-dependent previews explicitly pending', () => {
    const source = readFileSync('src/app/m8-contextual-canvas-controller.ts', 'utf8');
    expect(source).toContain(
      "export type M8ContextualCanvasModeV1 = 'vector' | 'text' | 'ruler' | 'lineart'",
    );
    expect(source).toContain("host.dataset.productionState = 'pending-dependency'");
    expect(source).toContain("button.dataset.productionState = 'pending-dependency'");
    expect(source).not.toContain('commitSnapshotTransform');
    expect(source).not.toContain('markDirty');
  });

  it('shows vector nodes and Bézier handles as direct canvas geometry', () => {
    const source = readFileSync('src/app/m8-contextual-canvas-controller.ts', 'utf8');
    expect(source).toContain("host.dataset.contextKind = 'vector'");
    expect(source).toContain('m8e-vector-preview-node');
    expect(source).toContain('m8e-vector-preview-handle');
    expect(source).toContain('ノード・Bézierハンドル・スナップはCanvas上で直接操作');
  });

  it('shows an on-canvas text box affordance while keeping typography in Tool Properties', () => {
    const source = readFileSync('src/app/m8-contextual-canvas-controller.ts', 'utf8');
    expect(source).toContain("host.dataset.contextKind = 'text'");
    expect(source).toContain("textBox.className = 'm8e-text-preview-box'");
    expect(source).toContain("textBox.setAttribute('aria-readonly', 'true')");
    expect(source).toContain('文字内容とボックス形状はCanvas上');
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
    for (const mode of ['vector', 'text', 'ruler', 'lineart'] as const) {
      expect(source).toContain(`value === '${mode}'`);
    }
    const values: readonly M8ContextualCanvasModeV1[] = ['vector', 'text', 'ruler', 'lineart'];
    expect(values).toHaveLength(4);
  });

  it('styles the contextual surfaces as lightweight canvas overlays', () => {
    const css = readFileSync('public/m8-selection-launcher.css', 'utf8');
    expect(css).toContain('.m8e-context-preview');
    expect(css).toContain('.m8e-context-preview-toolbar');
    expect(css).toContain('.m8e-vector-preview-curve');
    expect(css).toContain('.m8e-text-preview-box');
    expect(css).toContain('.m8e-ruler-guide-line');
    expect(css).toContain('.m8e-lineart-edge.is-unresolved');
    expect(css).toContain('.m8e-lineart-edge.is-rejected');
    expect(css).toContain('.m8e-lineart-node.is-unresolved');
  });
});
