import type { LayerBaseV1 } from '../domain/layers.js';

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
