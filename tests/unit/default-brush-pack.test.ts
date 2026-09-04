import { describe, expect, it } from 'vitest';
import {
  BRUSH_V1_SCHEMA,
  BUILTIN_BRUSH_GRAIN_RESOURCES_V1,
  BUILTIN_BRUSH_PAPER_RESOURCES_V1,
  brushColorMixEnabledV1,
  brushGrainResourceIdV1,
  brushPaperTextureResourceIdV1,
  brushPressureOpacityEnabledV1,
  brushPressureSizeEnabledV1,
  brushSprayEnabledV1,
  normalizeBrushPresetV1,
} from '../../src/domain/brush-schema.js';
import {
  DEFAULT_BRUSH_PACK_CATEGORY_COUNTS_V1,
  DEFAULT_BRUSH_PACK_COUNT_V1,
  DEFAULT_BRUSH_PACK_REGENERATION_ID_V1,
  createDefaultBrushPackV1,
  defaultBrushPackCanonicalJsonV1,
  defaultBrushTipResourceAliasV1,
} from '../../src/app/default-brush-pack.js';

describe('M6A-076 default brush pack', () => {
  it('materializes the regenerated frozen 48-preset inventory with exact category counts', () => {
    const pack = createDefaultBrushPackV1();
    expect(pack).toHaveLength(DEFAULT_BRUSH_PACK_COUNT_V1);
    expect(new Set(pack.map((preset) => preset.id)).size).toBe(DEFAULT_BRUSH_PACK_COUNT_V1);
    expect(new Set(pack.map((preset) => preset.name)).size).toBe(DEFAULT_BRUSH_PACK_COUNT_V1);
    expect(pack.every((preset) => preset.schema === BRUSH_V1_SCHEMA)).toBe(true);
    for (const [category, expected] of Object.entries(DEFAULT_BRUSH_PACK_CATEGORY_COUNTS_V1)) {
      expect(pack.filter((preset) => preset.category === category)).toHaveLength(expected);
    }
  });

  it('keeps clean line-art, ordinary airbrush, and ordinary eraser defaults procedural-first', () => {
    const pack = createDefaultBrushPackV1();
    for (const name of ['G Pen','Round Pen','Mapping Pen','Technical Pen','Brush Pen','Hard Airbrush','Soft Airbrush','Hard Eraser','Soft Eraser','Precision Eraser']) {
      const preset = pack.find((candidate) => candidate.name === name);
      expect(preset, name).toBeDefined();
      expect(defaultBrushTipResourceAliasV1(preset!)).toBeNull();
      expect(brushGrainResourceIdV1(preset!)).toBeNull();
      expect(brushPaperTextureResourceIdV1(preset!)).toBeNull();
    }
  });

  it('resolves every sampled grain/paper reference against final-I canonical aliases', () => {
    const grains = new Set(BUILTIN_BRUSH_GRAIN_RESOURCES_V1.map((resource) => resource.id));
    const papers = new Set(BUILTIN_BRUSH_PAPER_RESOURCES_V1.map((resource) => resource.id));
    for (const preset of createDefaultBrushPackV1()) {
      const grain = brushGrainResourceIdV1(preset);
      const paper = brushPaperTextureResourceIdV1(preset);
      if (grain !== null) expect(grains.has(grain), `${preset.name}: ${grain}`).toBe(true);
      if (paper !== null) expect(papers.has(paper), `${preset.name}: ${paper}`).toBe(true);
    }
  });

  it('binds retained final-I sampled tips only where irregular material/stamp structure is intrinsic', () => {
    const sampled = createDefaultBrushPackV1().filter((preset) => defaultBrushTipResourceAliasV1(preset) !== null);
    expect(sampled.length).toBeGreaterThanOrEqual(10);
    expect(sampled.some((preset) => preset.category === 'Ink / Pen')).toBe(true);
    expect(sampled.some((preset) => preset.category === 'Pencil')).toBe(true);
    expect(sampled.some((preset) => preset.category === 'Paint')).toBe(true);
    expect(sampled.filter((preset) => preset.category === 'Scatter / Special')).toHaveLength(5);
  });

  it('uses digital mixing and sampled texture for all five digital-watercolor defaults', () => {
    const watercolor = createDefaultBrushPackV1().filter((preset) => preset.category === 'Digital Watercolor');
    expect(watercolor).toHaveLength(5);
    for (const preset of watercolor) {
      expect(brushColorMixEnabledV1(preset), preset.name).toBe(true);
      expect(brushGrainResourceIdV1(preset) !== null || brushPaperTextureResourceIdV1(preset) !== null, preset.name).toBe(true);
    }
  });

  it('preserves stable legacy factory IDs inside the 48-pack for persisted overrides', () => {
    const ids = new Set(createDefaultBrushPackV1().map((preset) => preset.id));
    expect(ids.has('builtin.runtime.round')).toBe(true);
    expect(ids.has('builtin.runtime.eraser')).toBe(true);
    expect(ids.has('builtin.runtime.smudge')).toBe(true);
    expect(ids.has('builtin.runtime.blur')).toBe(true);
  });

  it('keeps randomized/spray semantics in canonical preset data and schema-normalizable', () => {
    const pack = createDefaultBrushPackV1();
    const scatter = pack.filter((preset) => preset.category === 'Scatter / Special');
    expect(scatter.some((preset) => brushSprayEnabledV1(preset))).toBe(true);
    expect(scatter.some((preset) => preset.jitter.rotation !== undefined || preset.jitter.position !== undefined || preset.jitter.size !== undefined)).toBe(true);
    for (const preset of pack) expect(normalizeBrushPresetV1(preset)).toEqual(preset);
    expect(defaultBrushPackCanonicalJsonV1()).toContain(DEFAULT_BRUSH_PACK_REGENERATION_ID_V1);
  });

  it('keeps clean pens pressure-shaped while Technical Pen remains fixed', () => {
    const pack = createDefaultBrushPackV1();
    for (const name of ['G Pen','Round Pen','Mapping Pen','Brush Pen']) {
      const preset = pack.find((candidate) => candidate.name === name)!;
      expect(brushPressureSizeEnabledV1(preset), name).toBe(true);
    }
    const technical = pack.find((candidate) => candidate.name === 'Technical Pen')!;
    expect(brushPressureSizeEnabledV1(technical)).toBe(false);
    expect(brushPressureOpacityEnabledV1(technical)).toBe(false);
  });
});
