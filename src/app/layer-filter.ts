import type { LayerBaseV1, LayerTypeId } from '../domain/layers.js';

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
  return false;
}
