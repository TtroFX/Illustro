import { describe, expect, it } from 'vitest';
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
