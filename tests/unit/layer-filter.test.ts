import { describe, expect, it } from 'vitest';
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
