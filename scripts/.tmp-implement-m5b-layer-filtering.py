from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    target = Path(path)
    text = target.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'expected one anchor in {path}; found {count}: {old[:160]!r}')
    target.write_text(text.replace(old, new, 1))


Path('src/app/layer-filter.ts').write_text(r'''import type { LayerBaseV1, LayerTypeId } from '../domain/layers.js';

export const LAYER_FILTER_IDS_V1 = [
  'all',
  'type:raster',
  'type:vector',
  'type:text',
  'type:fill',
  'type:gradient',
  'type:adjustment',
  'type:folder',
  'type:linkedObject',
  'type:lineartBoundary',
  'state:visible',
  'state:hidden',
  'state:locked',
  'state:reference',
  'state:draft',
  'state:masked',
] as const;

export type LayerFilterIdV1 = (typeof LAYER_FILTER_IDS_V1)[number];

const FILTER_IDS = new Set<string>(LAYER_FILTER_IDS_V1);

export function parseLayerFilterIdV1(value: string): LayerFilterIdV1 {
  if (!FILTER_IDS.has(value)) throw new RangeError(`unsupported layer filter: ${value}`);
  return value as LayerFilterIdV1;
}

function matchesLayerType(layer: LayerBaseV1, filter: LayerFilterIdV1): boolean {
  if (!filter.startsWith('type:')) return false;
  return layer.type === (filter.slice(5) as LayerTypeId);
}

export function matchesLayerFilterV1(layer: LayerBaseV1, filter: LayerFilterIdV1): boolean {
  if (filter === 'all') return true;
  if (filter.startsWith('type:')) return matchesLayerType(layer, filter);
  switch (filter) {
    case 'state:visible':
      return layer.visible;
    case 'state:hidden':
      return !layer.visible;
    case 'state:locked':
      return layer.locks.all || layer.locks.pixels || layer.locks.alpha || layer.locks.position;
    case 'state:reference':
      return layer.roleFlags.reference;
    case 'state:draft':
      return layer.roleFlags.draft;
    case 'state:masked':
      return layer.masks.length > 0;
  }
}
''')

Path('tests/unit/layer-filter.test.ts').write_text(r'''import { describe, expect, it } from 'vitest';
import {
  LAYER_FILTER_IDS_V1,
  matchesLayerFilterV1,
  parseLayerFilterIdV1,
} from '../../src/app/layer-filter.js';
import { createRasterLayer } from '../../src/domain/layers.js';

describe('M5B layer filtering', () => {
  it('accepts only canonical filter IDs', () => {
    for (const filter of LAYER_FILTER_IDS_V1) expect(parseLayerFilterIdV1(filter)).toBe(filter);
    expect(() => parseLayerFilterIdV1('type:unknown')).toThrow(/unsupported layer filter/);
  });

  it('filters by layer type without changing the layer', () => {
    const layer = createRasterLayer({ name: 'Ink' });
    const before = JSON.stringify(layer);
    expect(matchesLayerFilterV1(layer, 'all')).toBe(true);
    expect(matchesLayerFilterV1(layer, 'type:raster')).toBe(true);
    expect(matchesLayerFilterV1(layer, 'type:folder')).toBe(false);
    expect(JSON.stringify(layer)).toBe(before);
  });

  it('filters canonical visibility, lock, role and mask states', () => {
    const base = createRasterLayer({ name: 'State' });
    const hidden = Object.freeze({ ...base, visible: false });
    const locked = Object.freeze({
      ...base,
      locks: Object.freeze({ ...base.locks, position: true }),
    });
    const reference = Object.freeze({
      ...base,
      roleFlags: Object.freeze({ ...base.roleFlags, reference: true }),
    });
    const draft = Object.freeze({
      ...base,
      roleFlags: Object.freeze({ ...base.roleFlags, draft: true }),
    });
    const masked = Object.freeze({ ...base, masks: Object.freeze([{}]) });

    expect(matchesLayerFilterV1(base, 'state:visible')).toBe(true);
    expect(matchesLayerFilterV1(hidden, 'state:hidden')).toBe(true);
    expect(matchesLayerFilterV1(locked, 'state:locked')).toBe(true);
    expect(matchesLayerFilterV1(reference, 'state:reference')).toBe(true);
    expect(matchesLayerFilterV1(draft, 'state:draft')).toBe(true);
    expect(matchesLayerFilterV1(masked, 'state:masked')).toBe(true);
  });
});
''')

replace_once(
    'src/app/layer-workflow-controller.ts',
    "import { matchesLayerSearchV1, normalizeLayerSearchQueryV1 } from './layer-search.js';",
    "import {\n  matchesLayerFilterV1,\n  parseLayerFilterIdV1,\n  type LayerFilterIdV1,\n} from './layer-filter.js';\nimport { matchesLayerSearchV1, normalizeLayerSearchQueryV1 } from './layer-search.js';",
)
replace_once(
    'src/app/layer-workflow-controller.ts',
    "  const searchInput = required<HTMLInputElement>('#layer-search');\n  const searchCount = required<HTMLOutputElement>('#layer-search-count');",
    "  const searchInput = required<HTMLInputElement>('#layer-search');\n  const filterSelect = required<HTMLSelectElement>('#layer-filter');\n  const searchCount = required<HTMLOutputElement>('#layer-search-count');",
)
replace_once(
    'src/app/layer-workflow-controller.ts',
    "  let layerSearchQuery = '';",
    "  let layerSearchQuery = '';\n  let layerFilter: LayerFilterIdV1 = 'all';",
)
replace_once(
    'src/app/layer-workflow-controller.ts',
    "      root.dataset.illustroLayerSearchMatches = '0';\n      root.dataset.illustroActiveLayerId = '';",
    "      root.dataset.illustroLayerSearchMatches = '0';\n      root.dataset.illustroLayerFilter = layerFilter;\n      root.dataset.illustroActiveLayerId = '';",
)
replace_once(
    'src/app/layer-workflow-controller.ts',
    "      if (layer === undefined || !matchesLayerSearchV1(layer, layerSearchQuery)) continue;",
    "      if (\n        layer === undefined ||\n        !matchesLayerSearchV1(layer, layerSearchQuery) ||\n        !matchesLayerFilterV1(layer, layerFilter)\n      )\n        continue;",
)
replace_once(
    'src/app/layer-workflow-controller.ts',
    "    root.dataset.illustroLayerSearchQuery = layerSearchQuery;",
    "    root.dataset.illustroLayerSearchQuery = layerSearchQuery;\n    root.dataset.illustroLayerFilter = layerFilter;",
)
replace_once(
    'src/app/layer-workflow-controller.ts',
    "  const onLayerSearchKeyDown = (event: KeyboardEvent): void => {",
    "  const onLayerFilterChange = (): void => {\n    try {\n      layerFilter = parseLayerFilterIdV1(filterSelect.value);\n      clearError();\n      refresh();\n    } catch (error) {\n      filterSelect.value = layerFilter;\n      publishError(error);\n    }\n  };\n\n  const onLayerSearchKeyDown = (event: KeyboardEvent): void => {",
)
replace_once(
    'src/app/layer-workflow-controller.ts',
    "  searchInput.addEventListener('input', onLayerSearchInput);\n  searchInput.addEventListener('keydown', onLayerSearchKeyDown);",
    "  searchInput.addEventListener('input', onLayerSearchInput);\n  searchInput.addEventListener('keydown', onLayerSearchKeyDown);\n  filterSelect.addEventListener('change', onLayerFilterChange);",
)
replace_once(
    'src/app/layer-workflow-controller.ts',
    "      searchInput.removeEventListener('input', onLayerSearchInput);\n      searchInput.removeEventListener('keydown', onLayerSearchKeyDown);",
    "      searchInput.removeEventListener('input', onLayerSearchInput);\n      searchInput.removeEventListener('keydown', onLayerSearchKeyDown);\n      filterSelect.removeEventListener('change', onLayerFilterChange);",
)

replace_once(
    'src/index.html',
    '''            <input id="layer-search" type="search" autocomplete="off" spellcheck="false" placeholder="レイヤーを検索" aria-label="レイヤー名を検索" aria-controls="layer-list" />\n            <output id="layer-search-count" aria-label="検索結果件数">0</output>''',
    '''            <input id="layer-search" type="search" autocomplete="off" spellcheck="false" placeholder="レイヤーを検索" aria-label="レイヤー名を検索" aria-controls="layer-list" />\n            <select id="layer-filter" aria-label="レイヤーを絞り込み" aria-controls="layer-list">\n              <option value="all">すべて</option>\n              <optgroup label="種類">\n                <option value="type:raster">ラスタ</option>\n                <option value="type:vector">ベクター</option>\n                <option value="type:text">テキスト</option>\n                <option value="type:fill">塗り</option>\n                <option value="type:gradient">グラデーション</option>\n                <option value="type:adjustment">調整</option>\n                <option value="type:folder">フォルダ</option>\n                <option value="type:linkedObject">リンク</option>\n                <option value="type:lineartBoundary">境界</option>\n              </optgroup>\n              <optgroup label="状態">\n                <option value="state:visible">表示</option>\n                <option value="state:hidden">非表示</option>\n                <option value="state:locked">ロックあり</option>\n                <option value="state:reference">参照</option>\n                <option value="state:draft">下書き</option>\n                <option value="state:masked">マスクあり</option>\n              </optgroup>\n            </select>\n            <output id="layer-search-count" aria-label="表示レイヤー件数">0</output>''',
)

replace_once(
    'public/app-shell.css',
    '  grid-template-columns: 18px minmax(0, 1fr) max-content;',
    '  grid-template-columns: 18px minmax(0, 1fr) minmax(76px, max-content) max-content;',
)
replace_once(
    'public/app-shell.css',
    '''.shell-layer-search input::placeholder {\n  color: #98a3b6;\n}\n''',
    '''.shell-layer-search input::placeholder {\n  color: #98a3b6;\n}\n\n.shell-layer-search select {\n  max-width: 112px;\n  min-height: 24px;\n  border: 1px solid #dfe5ef;\n  border-radius: 7px;\n  outline: 0;\n  background: #fff;\n  color: #56627a;\n  font: inherit;\n  font-size: 9px;\n}\n''',
)

replace_once(
    'scripts/verify-m5b-layer-foundation.mjs',
    "requireText('src/index.html', ['id=\"layer-search\"', 'id=\"layer-search-count\"']);\nconsole.log('M5B layer system verification passed');",
    "requireText('src/index.html', ['id=\"layer-search\"', 'id=\"layer-search-count\"']);\nrequireText('src/app/layer-filter.ts', [\n  'LAYER_FILTER_IDS_V1',\n  'parseLayerFilterIdV1',\n  'matchesLayerFilterV1',\n  \"'state:hidden'\",\n  \"'state:masked'\",\n]);\nrequireText('src/app/layer-workflow-controller.ts', [\n  \"'#layer-filter'\",\n  'matchesLayerFilterV1',\n  'parseLayerFilterIdV1',\n  'illustroLayerFilter',\n]);\nrequireText('src/index.html', ['id=\"layer-filter\"', 'value=\"state:hidden\"', 'value=\"type:raster\"']);\nconsole.log('M5B layer system verification passed');",
)

replace_once(
    'IMPLEMENTATION_PROGRESS.md',
    'M5B-030 layer filtering:未完了',
    'M5B-030 layer filtering:完了',
)
