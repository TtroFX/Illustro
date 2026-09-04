import { describe, expect, it } from 'vitest';
import { createDefaultBrushPackV1 } from '../../src/app/default-brush-pack.js';
import {
  DEFAULT_BRUSH_THUMBNAIL_GENERATION_ID_V1,
  DEFAULT_BRUSH_THUMBNAIL_SIZE_V1,
  defaultBrushPressureReferenceUrlV1,
  defaultBrushThumbnailUrlV1,
} from '../../src/app/default-brush-thumbnails.js';

describe('default brush thumbnail contract', () => {
  it('maps all 48 factory presets to deterministic 256px presentation assets', () => {
    const presets = createDefaultBrushPackV1();
    expect(presets).toHaveLength(48);
    expect(DEFAULT_BRUSH_THUMBNAIL_SIZE_V1).toBe(256);
    expect(DEFAULT_BRUSH_THUMBNAIL_GENERATION_ID_V1).toBe('2026-09-05-deterministic-svg-v1');
    const urls = presets.map((preset) => defaultBrushThumbnailUrlV1(preset.id));
    expect(urls.every((url) => url?.endsWith('.svg'))).toBe(true);
    expect(new Set(urls).size).toBe(48);
    for (const preset of presets) {
      expect(defaultBrushPressureReferenceUrlV1(preset.id, 'low')).toContain('.pressure-low.svg');
      expect(defaultBrushPressureReferenceUrlV1(preset.id, 'high')).toContain('.pressure-high.svg');
    }
  });

  it('fails closed for user IDs and path-like input', () => {
    for (const id of ['user.brush.1', '../builtin.ink.g-pen', 'builtin/ink/g-pen', 'builtin.ink.g-pen?x=1']) {
      expect(defaultBrushThumbnailUrlV1(id)).toBeNull();
      expect(defaultBrushPressureReferenceUrlV1(id, 'low')).toBeNull();
    }
  });
});
