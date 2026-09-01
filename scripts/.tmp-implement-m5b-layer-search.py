from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"expected exactly one anchor in {path}; found {count}: {old[:160]!r}")
    p.write_text(text.replace(old, new, 1))


Path('src/app/layer-search.ts').write_text(r'''import type { LayerBaseV1 } from '../domain/layers.js';

export function normalizeLayerSearchQueryV1(value: string): string {
  return value.normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ');
}

export function layerSearchTokensV1(value: string): readonly string[] {
  const normalized = normalizeLayerSearchQueryV1(value);
  return normalized.length === 0 ? Object.freeze([]) : Object.freeze(normalized.split(' '));
}

export function matchesLayerSearchV1(layer: LayerBaseV1, query: string): boolean {
  const tokens = layerSearchTokensV1(query);
  if (tokens.length === 0) return true;
  const searchableName = normalizeLayerSearchQueryV1(layer.name);
  return tokens.every((token) => searchableName.includes(token));
}
''')

replace_once(
    'src/app/layer-workflow-controller.ts',
    "} from './layer-raster-flip.js';\nimport type { PaintHistoryControllerV1 }",
    "} from './layer-raster-flip.js';\nimport { matchesLayerSearchV1, normalizeLayerSearchQueryV1 } from './layer-search.js';\nimport type { PaintHistoryControllerV1 }",
)
replace_once(
    'src/app/layer-workflow-controller.ts',
    "  const list = required<HTMLElement>('#layer-list');\n  const maskButton",
    "  const list = required<HTMLElement>('#layer-list');\n  const searchInput = required<HTMLInputElement>('#layer-search');\n  const searchCount = required<HTMLOutputElement>('#layer-search-count');\n  const maskButton",
)
replace_once(
    'src/app/layer-workflow-controller.ts',
    "  let disposed = false;\n  let drag: LayerDragStateV1 | null = null;",
    "  let disposed = false;\n  let drag: LayerDragStateV1 | null = null;\n  let layerSearchQuery = '';",
)
replace_once(
    'src/app/layer-workflow-controller.ts',
    "      root.dataset.illustroLayerCount = '0';\n      root.dataset.illustroActiveLayerId = '';\n      return;",
    "      root.dataset.illustroLayerCount = '0';\n      root.dataset.illustroLayerSearchMatches = '0';\n      root.dataset.illustroActiveLayerId = '';\n      searchCount.value = '0';\n      return;",
)
replace_once(
    'src/app/layer-workflow-controller.ts',
    "    const canonicalRoots = documentValue.layerTree.rootLayerIds;\n    const ordered = [...canonicalRoots].reverse();\n    for (const layerId of ordered) {\n      const layer = documentValue.layerTree.layers[layerId];\n      if (layer === undefined) continue;",
    "    const canonicalRoots = documentValue.layerTree.rootLayerIds;\n    const ordered = [...canonicalRoots].reverse();\n    let searchMatchCount = 0;\n    for (const layerId of ordered) {\n      const layer = documentValue.layerTree.layers[layerId];\n      if (layer === undefined || !matchesLayerSearchV1(layer, layerSearchQuery)) continue;\n      searchMatchCount += 1;",
)
replace_once(
    'src/app/layer-workflow-controller.ts',
    "    const active = currentActive();\n    const disabled = active === null;",
    "    searchCount.value = String(searchMatchCount);\n    root.dataset.illustroLayerSearchMatches = String(searchMatchCount);\n    root.dataset.illustroLayerSearchQuery = layerSearchQuery;\n    const active = currentActive();\n    const disabled = active === null;",
)
replace_once(
    'src/app/layer-workflow-controller.ts',
    "  const onListClick = (event: MouseEvent): void => {",
    r'''  const onLayerSearchInput = (): void => {
    layerSearchQuery = normalizeLayerSearchQueryV1(searchInput.value);
    refresh();
  };

  const onLayerSearchKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape' || searchInput.value.length === 0) return;
    event.preventDefault();
    searchInput.value = '';
    layerSearchQuery = '';
    refresh();
  };

  const onListClick = (event: MouseEvent): void => {''',
)
replace_once(
    'src/app/layer-workflow-controller.ts',
    "  list.addEventListener('click', onListClick);",
    "  searchInput.addEventListener('input', onLayerSearchInput);\n  searchInput.addEventListener('keydown', onLayerSearchKeyDown);\n  list.addEventListener('click', onListClick);",
)
replace_once(
    'src/app/layer-workflow-controller.ts',
    "      list.removeEventListener('click', onListClick);",
    "      searchInput.removeEventListener('input', onLayerSearchInput);\n      searchInput.removeEventListener('keydown', onLayerSearchKeyDown);\n      list.removeEventListener('click', onListClick);",
)

replace_once(
    'src/index.html',
    '          <fieldset id="layer-list" class="shell-inspector-list" aria-label="レイヤー一覧"></fieldset>',
    r'''          <div class="shell-layer-search">
            <span aria-hidden="true">⌕</span>
            <input id="layer-search" type="search" autocomplete="off" spellcheck="false" placeholder="レイヤーを検索" aria-label="レイヤー名を検索" aria-controls="layer-list" />
            <output id="layer-search-count" aria-label="検索結果件数">0</output>
          </div>
          <fieldset id="layer-list" class="shell-inspector-list" aria-label="レイヤー一覧"></fieldset>''',
)

css = Path('public/app-shell.css')
text = css.read_text()
anchor = ".shell-inspector-list {\n"
if text.count(anchor) != 1:
    raise SystemExit('layer search css anchor mismatch')
styles = r'''.shell-layer-search {
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr) max-content;
  align-items: center;
  gap: 6px;
  margin: 8px 8px 0;
  min-height: 34px;
  padding: 0 9px;
  border: 1px solid #e2e7f0;
  border-radius: 9px;
  background: #f8faff;
  color: #7b879d;
}

.shell-layer-search input {
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: #1f2942;
  font: inherit;
  font-size: 11px;
}

.shell-layer-search input::placeholder {
  color: #98a3b6;
}

.shell-layer-search:focus-within {
  border-color: #a9c8ff;
  box-shadow: 0 0 0 2px rgb(59 130 246 / 10%);
}

.shell-layer-search output {
  min-width: 18px;
  color: #8a96aa;
  font-size: 9px;
  text-align: right;
}

'''
css.write_text(text.replace(anchor, styles + anchor, 1))

Path('tests/unit/layer-search.test.ts').write_text(r'''import { describe, expect, it } from 'vitest';
import {
  layerSearchTokensV1,
  matchesLayerSearchV1,
  normalizeLayerSearchQueryV1,
} from '../../src/app/layer-search.js';
import { createRasterLayer } from '../../src/domain/layers.js';

describe('M5B layer search', () => {
  it('normalizes width, case, surrounding whitespace and repeated spaces', () => {
    expect(normalizeLayerSearchQueryV1('  ＬＡＹＥＲ   One  ')).toBe('layer one');
    expect(layerSearchTokensV1('  Blue   SKY ')).toEqual(['blue', 'sky']);
  });

  it('matches every search token against the layer name without mutating the layer', () => {
    const layer = createRasterLayer({ name: 'Blue Sky Highlights' });
    const before = JSON.stringify(layer);
    expect(matchesLayerSearchV1(layer, 'sky blue')).toBe(true);
    expect(matchesLayerSearchV1(layer, 'blue shadow')).toBe(false);
    expect(matchesLayerSearchV1(layer, '')).toBe(true);
    expect(JSON.stringify(layer)).toBe(before);
  });

  it('does not search layer type metadata because filtering is owned by M5B-030', () => {
    const layer = createRasterLayer({ name: 'Ink' });
    expect(matchesLayerSearchV1(layer, 'raster')).toBe(false);
  });
});
''')

replace_once(
    'scripts/verify-m5b-layer-foundation.mjs',
    "console.log('M5B layer system verification passed');",
    r'''requireText('src/app/layer-search.ts', [
  'normalizeLayerSearchQueryV1',
  'layerSearchTokensV1',
  'matchesLayerSearchV1',
  "normalize('NFKC')",
]);
requireText('src/app/layer-workflow-controller.ts', [
  "'#layer-search'",
  "'#layer-search-count'",
  'matchesLayerSearchV1',
  'illustroLayerSearchMatches',
]);
requireText('src/index.html', ['id="layer-search"', 'id="layer-search-count"']);
console.log('M5B layer system verification passed');''',
)
replace_once(
    'IMPLEMENTATION_PROGRESS.md',
    'M5B-029 layer search:未完了',
    'M5B-029 layer search:完了',
)
