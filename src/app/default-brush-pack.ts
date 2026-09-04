import {
  BRUSH_V1_SCHEMA,
  BUILTIN_BRUSH_GRAIN_RESOURCES_V1,
  BUILTIN_BRUSH_PAPER_RESOURCES_V1,
  createBaselineBrushPresetV1,
  normalizeBrushPresetV1,
  withBrushCustomSampledTipV1,
  withBrushColorMixCanvasRatioV1,
  withBrushColorMixCarryAmountV1,
  withBrushColorMixDepositAmountV1,
  withBrushColorMixEnabledV1,
  withBrushColorMixPickupAmountV1,
  withBrushFollowStrokeRotationV1,
  withBrushGrainResourceIdV1,
  withBrushParameterValuesV1,
  withBrushPaperTextureResourceIdV1,
  withBrushPositionJitterV1,
  withBrushPressureOpacityEnabledV1,
  withBrushPressureSizeEnabledV1,
  withBrushRealtimeStabilizationAmountV1,
  withBrushRotationJitterV1,
  withBrushSizeJitterV1,
  withBrushDensityJitterV1,
  withBrushSprayDeviationV1,
  withBrushSprayEnabledV1,
  withBrushSprayParticleDensityV1,
  withBrushSprayParticleSizeRatioV1,
  withBrushSpraySpreadRadiusRatioV1,
  withBrushStrokeSpacingV1,
  withBrushTextureStrengthV1,
  withBrushTipAngleDegreesV1,
  withBrushTipHardnessV1,
  withBrushProceduralTipShapeV1,
  type BrushBehaviorV1,
  type BrushPresetV1,
} from '../domain/brush-schema.js';
import { defaultBrushTipProxyAlphaV1 } from './default-brush-tip-proxies.js';

export const DEFAULT_BRUSH_PACK_SCHEMA_V1 = 'illustro.default-brush-pack/1' as const;
export const DEFAULT_BRUSH_PACK_COUNT_V1 = 48 as const;
export const DEFAULT_BRUSH_PACK_REGENERATION_ID_V1 = '2026-09-04-user-authorized-v1' as const;
export const DEFAULT_BRUSH_TIP_RESOURCE_EXTENSION_KEY_V1 =
  'illustro.defaultBrushTipResourceAlias' as const;
export const DEFAULT_BRUSH_PACK_CATEGORY_COUNTS_V1 = Object.freeze({
  'Ink / Pen': 8,
  Pencil: 6,
  Marker: 5,
  Paint: 9,
  Airbrush: 3,
  'Digital Watercolor-style': 5,
  Eraser: 4,
  'Blend / Smudge / Blur': 3,
  'Scatter / Special': 5,
} as const);

const RAW = `builtin.ink.g-pen|G Pen|Ink / Pen|paint|7|0.96|0.1|S|-|-|1,1,0,0,0.35,0,0,0,0,4,0.35,1,0,0.5,0.7,0.15,0.85
builtin.runtime.round|Round Pen|Ink / Pen|paint|9|0.9|0.12|S|-|-|1,1,0,0,0.22,0,0,0,0,4,0.35,1,0,0.5,0.7,0.15,0.85
builtin.ink.mapping-pen|Mapping Pen|Ink / Pen|paint|4|0.98|0.08|S|-|-|1,1,0,0,0.52,0,0,0,0,4,0.35,1,0,0.5,0.7,0.15,0.85
builtin.ink.technical-pen|Technical Pen|Ink / Pen|paint|3|1.0|0.07|-|-|-|1,1,0,0,0.6,0,0,0,0,4,0.35,1,0,0.5,0.7,0.15,0.85
builtin.ink.brush-pen|Brush Pen|Ink / Pen|paint|14|0.78|0.12|SO|-|-|1,1,0,0,0.28,0,0,0,0,4,0.35,1,0,0.5,0.7,0.15,0.85
builtin.ink.dry-ink|Dry Ink|Ink / Pen|paint|11|0.62|0.18|S|g:builtin.grain.rough.02|builtin.tip.ink.06|1,1,0.62,0,0.18,0,0,0,0,4,0.35,1,0,0.5,0.7,0.15,0.85
builtin.ink.real-ink|Real Ink|Ink / Pen|paint|15|0.58|0.16|SO|p:builtin.grain.paper.03|builtin.tip.ink.07|1,1,0.48,0,0.2,0,0,0,0,4,0.35,1,0,0.5,0.7,0.15,0.85
builtin.ink.textured-liner|Textured Liner|Ink / Pen|paint|8|0.7|0.14|S|g:builtin.grain.fine.05|builtin.tip.ink.08|1,1,0.42,0,0.36,0,0,0,0,4,0.35,1,0,0.5,0.7,0.15,0.85
builtin.pencil.hb|HB Pencil|Pencil|paint|5|0.58|0.18|SO|g:builtin.grain.fiber.01|builtin.tip.pencil.01|0.82,0.64,0.44,0,0,0,0,0,0,4,0.35,1,0,0.5,0.7,0.15,0.85
builtin.pencil.2b|2B Pencil|Pencil|paint|7|0.46|0.2|SO|p:builtin.grain.paper.04|builtin.tip.pencil.03|0.88,0.72,0.56,0,0,0,0,0,0,4,0.35,1,0,0.5,0.7,0.15,0.85
builtin.pencil.mechanical|Mechanical Pencil|Pencil|paint|3|0.76|0.12|O|g:builtin.grain.fine.02|builtin.tip.pencil.02|0.78,0.7,0.3,0,0,0,0,0,0,4,0.35,1,0,0.5,0.7,0.15,0.85
builtin.pencil.soft-graphite|Soft Graphite|Pencil|paint|11|0.34|0.24|SO|p:builtin.grain.paper.06|builtin.tip.pencil.05|0.78,0.58,0.68,0,0,0,0,0,0,4,0.35,1,0,0.5,0.7,0.15,0.85
builtin.pencil.charcoal|Charcoal Pencil|Pencil|paint|16|0.26|0.3|SO|g:builtin.grain.rough.05|builtin.tip.pencil.08|0.72,0.52,0.78,0,0,0,0.08,0,0,4,0.35,1,0,0.5,0.7,0.15,0.85
builtin.pencil.rough|Rough Pencil|Pencil|paint|9|0.42|0.26|SO|g:builtin.grain.fiber.05|builtin.tip.pencil.10|0.74,0.54,0.72,0,0,0,0,0.04,0,4,0.35,1,0,0.5,0.7,0.15,0.85
builtin.marker.hard|Hard Marker|Marker|paint|20|0.96|0.16|S|-|-|0.92,0.9,0,0,0,0,0,0,0,4,0.35,1,0,0.5,0.7,0.15,0.85
builtin.marker.soft|Soft Marker|Marker|paint|30|0.36|0.18|O|-|-|0.72,0.56,0,0,0,0,0,0,0,4,0.35,1,0,0.5,0.7,0.15,0.85
builtin.marker.chisel|Chisel Marker|Marker|paint|26|0.88|0.15|Q|-|-|0.86,0.82,0,28,0,0,0,0,0,4,0.35,1,0,0.5,0.7,0.15,0.85
builtin.marker.alcohol|Alcohol Marker|Marker|paint|24|0.64|0.17|OM|-|-|0.54,0.44,0,0,0,0,0,0,0,4,0.35,1,0,0.18,0.78,0.15,0.85
builtin.marker.textured|Textured Marker|Marker|paint|22|0.52|0.22|O|g:builtin.grain.fine.06|-|0.76,0.62,0.5,0,0,0,0,0,0,4,0.35,1,0,0.5,0.7,0.15,0.85
builtin.paint.round|Round Brush|Paint|paint|28|0.66|0.16|SO|-|-|1,0.72,0,0,0,0,0,0,0,4,0.35,1,0,0.5,0.7,0.15,0.85
builtin.paint.flat|Flat Brush|Paint|paint|34|0.74|0.18|SQ|-|-|1,0.78,0,18,0,0,0,0,0,4,0.35,1,0,0.5,0.7,0.15,0.85
builtin.paint.filbert|Filbert|Paint|paint|32|0.58|0.17|SO|-|-|1,0.7,0,0,0,0,0,0,0,4,0.35,1,0,0.5,0.7,0.15,0.85
builtin.paint.dry-bristle|Dry Bristle|Paint|paint|36|0.48|0.24|SO|g:builtin.grain.rough.03|builtin.tip.paint.05|1,0.48,0.7,0,0,0,0.05,0,0,4,0.35,1,0,0.5,0.7,0.15,0.85
builtin.paint.wet-bristle|Wet Bristle|Paint|paint|42|0.38|0.18|SOM|p:builtin.grain.paper.07|builtin.tip.paint.07|1,0.56,0.46,0,0,0,0,0,0,4,0.35,1,0,0.32,0.7,0.15,0.85
builtin.paint.gouache|Gouache|Paint|paint|38|0.62|0.16|S|p:builtin.grain.paper.08|builtin.tip.paint.08|0.92,0.76,0.38,0,0,0,0,0,0,4,0.35,1,0,0.5,0.7,0.15,0.85
builtin.paint.oil-like|Oil-like Brush|Paint|paint|48|0.44|0.2|SOM|g:builtin.grain.canvas.02|builtin.tip.paint.10|1,0.54,0.52,0,0,0,0,0,0,4,0.35,1,0,0.42,0.64,0.24,0.92
builtin.paint.sponge|Sponge|Paint|paint|56|0.3|0.34|-|g:builtin.grain.rough.06|builtin.tip.paint.12|0.78,0.66,0.76,0,0,0,0.22,0.1,0.16,4,0.35,1,0,0.5,0.7,0.15,0.85
builtin.paint.palette-knife|Palette Knife|Paint|paint|44|0.9|0.13|QFM|-|-|1,0.82,0,35,0,0,0,0,0,4,0.35,1,0,0.25,0.88,0.15,0.85
builtin.airbrush.hard|Hard Airbrush|Airbrush|paint|52|0.72|0.1|SO|-|-|0.38,0.26,0,0,0,0,0,0,0,4,0.35,1,0,0.5,0.7,0.15,0.85
builtin.airbrush.soft|Soft Airbrush|Airbrush|paint|86|0.12|0.12|SO|-|-|0.28,0.18,0,0,0,0,0,0,0,4,0.35,1,0,0.5,0.7,0.15,0.85
builtin.airbrush.fine|Fine Airbrush|Airbrush|paint|18|0.42|0.09|SO|-|-|0.46,0.3,0,0,0,0,0,0,0,4,0.35,1,0,0.5,0.7,0.15,0.85
builtin.watercolor.round|Watercolor Round|Digital Watercolor-style|paint|38|0.34|0.18|SOM|p:builtin.grain.paper.01|-|0.52,0.36,0.54,0,0,0,0,0,0,4,0.35,1,0,0.48,0.48,0.2,0.88
builtin.watercolor.wash|Watercolor Wash|Digital Watercolor-style|paint|64|0.16|0.22|OM|p:builtin.grain.paper.02|-|0.34,0.24,0.62,0,0,0,0,0,0,4,0.35,1,0,0.6,0.36,0.3,0.94
builtin.watercolor.edge|Watercolor Edge|Digital Watercolor-style|paint|42|0.46|0.2|SM|p:builtin.grain.paper.05|-|0.48,0.3,0.58,0,0,0,0,0,0,4,0.35,1,0,0.44,0.42,0.18,0.84
builtin.watercolor.granulating|Watercolor Granulating|Digital Watercolor-style|paint|46|0.26|0.24|OM|g:builtin.grain.rough.04|-|0.46,0.28,0.8,0,0,0,0,0,0,4,0.35,1,0,0.52,0.4,0.26,0.9
builtin.watercolor.glaze|Watercolor Glaze|Digital Watercolor-style|paint|34|0.22|0.16|OM|p:builtin.grain.paper.09|-|0.3,0.2,0.42,0,0,0,0,0,0,4,0.35,1,0,0.36,0.28,0.16,0.96
builtin.runtime.eraser|Hard Eraser|Eraser|erase|26|0.96|0.12|S|-|-|1,1,0,0,0,0,0,0,0,4,0.35,1,0,0.5,0.7,0.15,0.85
builtin.eraser.soft|Soft Eraser|Eraser|erase|48|0.18|0.14|SO|-|-|1,1,0,0,0,0,0,0,0,4,0.35,1,0,0.5,0.7,0.15,0.85
builtin.eraser.precision|Precision Eraser|Eraser|erase|8|0.88|0.1|S|-|-|1,1,0,0,0.2,0,0,0,0,4,0.35,1,0,0.5,0.7,0.15,0.85
builtin.eraser.kneaded|Kneaded Eraser|Eraser|erase|34|0.32|0.24|SO|g:builtin.grain.fiber.03|-|0.62,0.5,0.4,0,0,0,0,0.05,0,4,0.35,1,0,0.5,0.7,0.15,0.85
builtin.runtime.smudge|Smudge|Blend / Smudge / Blur|smudge|28|0.46|0.16|S|-|-|1,0.72,0,0,0,0,0,0,0,4,0.35,1,0,0.5,0.7,0.15,0.85
builtin.blend.blender|Blender|Blend / Smudge / Blur|smudge|42|0.22|0.18|S|g:builtin.grain.fine.03|-|1,0.58,0.26,0,0,0,0,0,0,4,0.35,1,0,0.5,0.7,0.15,0.85
builtin.runtime.blur|Blur|Blend / Smudge / Blur|blur|36|0.16|0.14|S|-|-|1,0.62,0,0,0,0,0,0,0,4,0.35,1,0,0.5,0.7,0.15,0.85
builtin.scatter.fine|Fine Scatter|Scatter / Special|paint|18|0.72|0.3|P|-|builtin.tip.scatter.01|0.78,0.68,0,0,0,0,0.6,0.3,0,8,0.22,0.7,0.2,0.5,0.7,0.15,0.85
builtin.scatter.coarse|Coarse Scatter|Scatter / Special|paint|34|0.64|0.42|P|-|builtin.tip.scatter.04|0.82,0.72,0,0,0,0,0.75,0.42,0,5,0.45,1.1,0.28,0.5,0.7,0.15,0.85
builtin.scatter.leaf|Leaf Stamp|Scatter / Special|paint|46|0.86|0.7|-|-|builtin.tip.scatter.07|0.94,0.9,0,0,0,0.18,0.55,0.08,0,4,0.35,1,0,0.5,0.7,0.15,0.85
builtin.scatter.star|Star Stamp|Scatter / Special|paint|40|0.92|0.82|-|-|builtin.tip.scatter.10|0.96,0.92,0,0,0,0.12,0.35,0,0,4,0.35,1,0,0.5,0.7,0.15,0.85
builtin.scatter.texture-spray|Texture Spray|Scatter / Special|paint|52|0.5|0.36|P|g:builtin.grain.fine.04|builtin.tip.scatter.12|0.62,0.5,0.58,0,0,0,0.9,0.5,0.2,12,0.3,1.35,0.36,0.5,0.7,0.15,0.85`;
const tipAliases: ReadonlySet<string> = new Set([
  ...Array.from({ length: 3 }, (_, i) => `builtin.tip.ink.${String(i + 6).padStart(2, '0')}`),
  ...Array.from({ length: 10 }, (_, i) => `builtin.tip.pencil.${String(i + 1).padStart(2, '0')}`),
  ...Array.from({ length: 8 }, (_, i) => `builtin.tip.paint.${String(i + 5).padStart(2, '0')}`),
  ...Array.from({ length: 12 }, (_, i) => `builtin.tip.scatter.${String(i + 1).padStart(2, '0')}`),
]);
const grains = new Set(BUILTIN_BRUSH_GRAIN_RESOURCES_V1.map((r) => r.id));
const papers = new Set(BUILTIN_BRUSH_PAPER_RESOURCES_V1.map((r) => r.id));

export function defaultBrushTipResourceAliasV1(p: BrushPresetV1): string | null {
  const v = p.extensions[DEFAULT_BRUSH_TIP_RESOURCE_EXTENSION_KEY_V1];
  return typeof v === 'string' && tipAliases.has(v) ? v : null;
}
function n(v: string): number {
  const x = Number(v);
  if (!Number.isFinite(x)) throw new TypeError('invalid default brush numeric field');
  return x;
}
function make(line: string): BrushPresetV1 {
  const [id, name, category, behavior, sizeS, hardS, spaceS, flags, res, tip, ...numbers] =
    line.split('|');
  if (
    !id ||
    !name ||
    !category ||
    !behavior ||
    !sizeS ||
    !hardS ||
    !spaceS ||
    !flags ||
    !res ||
    !tip
  )
    throw new TypeError('invalid default brush row');
  const a = numbers.join('|').split(',').map(n);
  const [
    opacity = 1,
    flow = 1,
    texture = 0,
    angle = 0,
    stabilization = 0,
    sizeJ = 0,
    rotJ = 0,
    posJ = 0,
    densJ = 0,
    particleDensity = 4,
    particleSize = 0.35,
    spread = 1,
    deviation = 0,
    mixCanvas = 0.5,
    mixDeposit = 0.7,
    mixPickup = 0.15,
    mixCarry = 0.85,
  ] = a;
  let p = createBaselineBrushPresetV1({
    id,
    name,
    category,
    behavior: behavior as BrushBehaviorV1,
    defaultSizePx: n(sizeS),
    tags: [category, 'Default Brush Pack'],
  });
  p = withBrushParameterValuesV1(p, { sizePx: n(sizeS), opacity, flow });
  p = withBrushProceduralTipShapeV1(p, flags.includes('Q') ? 'square' : 'round');
  p = withBrushTipHardnessV1(p, n(hardS));
  p = withBrushStrokeSpacingV1(p, n(spaceS));
  p = withBrushPressureSizeEnabledV1(p, flags.includes('S'));
  p = withBrushPressureOpacityEnabledV1(p, flags.includes('O'));
  if (angle !== 0) p = withBrushTipAngleDegreesV1(p, angle);
  if (flags.includes('F')) p = withBrushFollowStrokeRotationV1(p, true);
  if (stabilization !== 0) p = withBrushRealtimeStabilizationAmountV1(p, stabilization);
  if (res.startsWith('g:')) {
    const x = res.slice(2);
    if (!grains.has(x)) throw new RangeError(`unknown grain: ${x}`);
    p = withBrushGrainResourceIdV1(p, x);
  }
  if (res.startsWith('p:')) {
    const x = res.slice(2);
    if (!papers.has(x)) throw new RangeError(`unknown paper: ${x}`);
    p = withBrushPaperTextureResourceIdV1(p, x);
  }
  if (texture !== 0) p = withBrushTextureStrengthV1(p, texture);
  if (tip !== '-') {
    if (!tipAliases.has(tip)) throw new RangeError(`unknown tip: ${tip}`);
    const alpha = defaultBrushTipProxyAlphaV1(tip);
    if (alpha === null) throw new RangeError(`missing sampled-tip proxy: ${tip}`);
    p = withBrushCustomSampledTipV1(p, alpha);
    p = normalizeBrushPresetV1({
      ...p,
      extensions: { ...p.extensions, [DEFAULT_BRUSH_TIP_RESOURCE_EXTENSION_KEY_V1]: tip },
    });
  }
  if (flags.includes('M')) {
    p = withBrushColorMixEnabledV1(p, true);
    p = withBrushColorMixCanvasRatioV1(p, mixCanvas);
    p = withBrushColorMixDepositAmountV1(p, mixDeposit);
    p = withBrushColorMixPickupAmountV1(p, mixPickup);
    p = withBrushColorMixCarryAmountV1(p, mixCarry);
  }
  if (sizeJ !== 0) p = withBrushSizeJitterV1(p, sizeJ);
  if (rotJ !== 0) p = withBrushRotationJitterV1(p, rotJ);
  if (posJ !== 0) p = withBrushPositionJitterV1(p, posJ);
  if (densJ !== 0) p = withBrushDensityJitterV1(p, densJ);
  if (flags.includes('P')) {
    p = withBrushSprayEnabledV1(p, true);
    p = withBrushSprayParticleDensityV1(p, particleDensity);
    p = withBrushSprayParticleSizeRatioV1(p, particleSize);
    p = withBrushSpraySpreadRadiusRatioV1(p, spread);
    p = withBrushSprayDeviationV1(p, deviation);
  }
  return normalizeBrushPresetV1(p);
}
const PACK = Object.freeze(RAW.split('\n').filter(Boolean).map(make));
function validate(): void {
  if (
    PACK.length !== 48 ||
    new Set(PACK.map((p) => p.id)).size !== 48 ||
    new Set(PACK.map((p) => p.name)).size !== 48
  )
    throw new TypeError('invalid 48-preset identity inventory');
  for (const [c, k] of Object.entries(DEFAULT_BRUSH_PACK_CATEGORY_COUNTS_V1))
    if (PACK.filter((p) => p.category === c).length !== k)
      throw new RangeError(`category mismatch: ${c}`);
  for (const p of PACK)
    if (p.schema !== BRUSH_V1_SCHEMA) throw new TypeError('default brush schema mismatch');
  const clean = new Set([
    'G Pen',
    'Round Pen',
    'Mapping Pen',
    'Technical Pen',
    'Brush Pen',
    'Hard Airbrush',
    'Soft Airbrush',
    'Hard Eraser',
    'Soft Eraser',
    'Precision Eraser',
  ]);
  for (const p of PACK)
    if (
      clean.has(p.name) &&
      (defaultBrushTipResourceAliasV1(p) !== null || p.texture.resourceId !== undefined)
    )
      throw new TypeError(`clean procedural brush uses sampled data: ${p.name}`);
}
validate();
export function createDefaultBrushPackV1(): readonly BrushPresetV1[] {
  return Object.freeze([...PACK]);
}
export function defaultBrushPackCanonicalJsonV1(): string {
  return `${JSON.stringify({ schema: DEFAULT_BRUSH_PACK_SCHEMA_V1, regenerationId: DEFAULT_BRUSH_PACK_REGENERATION_ID_V1, presets: PACK })}\n`;
}
