export const DEFAULT_BRUSH_THUMBNAIL_SCHEMA_V1 = 'illustro.default-brush-thumbnails/1' as const;
export const DEFAULT_BRUSH_THUMBNAIL_GENERATION_ID_V1 =
  '2026-09-05-deterministic-svg-v1' as const;
export const DEFAULT_BRUSH_THUMBNAIL_SIZE_V1 = 256 as const;

const FACTORY_PRESET_ID_V1 = /^builtin\.[a-z0-9.-]+$/;

function assetUrl(presetId: string, suffix: string): string | null {
  if (!FACTORY_PRESET_ID_V1.test(presetId)) return null;
  return `./assets/brush-thumbnails/${presetId}${suffix}.svg`;
}

export function defaultBrushThumbnailUrlV1(presetId: string): string | null {
  return assetUrl(presetId, '');
}

export function defaultBrushPressureReferenceUrlV1(
  presetId: string,
  pressure: 'low' | 'high',
): string | null {
  return assetUrl(presetId, pressure === 'low' ? '.pressure-low' : '.pressure-high');
}
