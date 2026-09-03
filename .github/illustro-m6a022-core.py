from pathlib import Path


def read(path: str) -> str:
    return Path(path).read_text(encoding='utf-8')


def write(path: str, content: str) -> None:
    Path(path).write_text(content, encoding='utf-8')


def replace_once(path: str, before: str, after: str) -> None:
    source = read(path)
    count = source.count(before)
    if count != 1:
        raise RuntimeError(f'{path}: expected exactly one replacement, found {count}: {before[:100]!r}')
    write(path, source.replace(before, after, 1))


def insert_before(path: str, marker: str, block: str) -> None:
    replace_once(path, marker, block.rstrip() + '\n\n' + marker)


insert_before(
    'src/domain/brush-schema.ts',
    'export function withBrushParameterValuesV1(',
    """export const DEFAULT_BRUSH_TIP_DENSITY_V1 = 1 as const;

export function brushTipDensityV1(preset: BrushPresetV1): number {
  const value = preset.tip.density;
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1
    ? value
    : DEFAULT_BRUSH_TIP_DENSITY_V1;
}

export function withBrushTipDensityV1(preset: BrushPresetV1, density: number): BrushPresetV1 {
  if (!Number.isFinite(density) || density < 0 || density > 1) {
    throw new RangeError('brush tip density must be within 0..1');
  }
  return normalizeBrushPresetV1({
    ...preset,
    tip: { ...preset.tip, density },
  });
}""",
)

replace_once(
    'src/gpu/baseline-brush.ts',
    'export const BASELINE_BRUSH_HARDNESS = 0.85 as const;\n',
    'export const BASELINE_BRUSH_HARDNESS = 0.85 as const;\nexport const BASELINE_BRUSH_TIP_DENSITY = 1 as const;\n',
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """  readonly hardness?: number;
  readonly tipShape?: BaselineBrushTipShapeV1;
""",
    """  readonly hardness?: number;
  readonly tipDensity?: number;
  readonly tipShape?: BaselineBrushTipShapeV1;
""",
)
insert_before(
    'src/gpu/baseline-brush.ts',
    'export function baselineDabUsesFlowOpacityV1(dab: BaselineBrushDabV1): boolean {',
    """export function baselineDabTipDensityV1(dab: BaselineBrushDabV1): number {
  return dab.tipDensity ?? BASELINE_BRUSH_TIP_DENSITY;
}""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """  strokeOpacity: number,
  hardness: number,
  color: BaselineBrushColorV1,
""",
    """  strokeOpacity: number,
  hardness: number,
  tipDensity: number,
  color: BaselineBrushColorV1,
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """    strokeOpacity,
    hardness,
    tipShape,
""",
    """    strokeOpacity,
    hardness,
    tipDensity,
    tipShape,
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """  strokeOpacity: number,
  hardness: number,
  color: BaselineBrushColorV1,
  tipShape: BaselineBrushTipShapeV1,
""",
    """  strokeOpacity: number,
  hardness: number,
  tipDensity: number,
  color: BaselineBrushColorV1,
  tipShape: BaselineBrushTipShapeV1,
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    'target.push(freezeDab(x, y, radius, flow, strokeOpacity, hardness, color, tipShape));',
    'target.push(freezeDab(x, y, radius, flow, strokeOpacity, hardness, tipDensity, color, tipShape));',
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """        strokeOpacity,
        hardness,
        color,
        'round',
""",
    """        strokeOpacity,
        hardness,
        tipDensity,
        color,
        'round',
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """  readonly #strokeOpacity: number;
  readonly #hardness: number;
  readonly #tipShape: BaselineBrushTipShapeV1;
""",
    """  readonly #strokeOpacity: number;
  readonly #hardness: number;
  readonly #tipDensity: number;
  readonly #tipShape: BaselineBrushTipShapeV1;
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """      readonly flow?: number;
      readonly hardness?: number;
      readonly tipShape?: BaselineBrushTipShapeV1;
""",
    """      readonly flow?: number;
      readonly hardness?: number;
      readonly tipDensity?: number;
      readonly tipShape?: BaselineBrushTipShapeV1;
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """    const flow = options.flow ?? 1;
    const hardness = options.hardness ?? BASELINE_BRUSH_HARDNESS;
""",
    """    const flow = options.flow ?? 1;
    const hardness = options.hardness ?? BASELINE_BRUSH_HARDNESS;
    const tipDensity = options.tipDensity ?? BASELINE_BRUSH_TIP_DENSITY;
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """    if (!Number.isFinite(hardness) || hardness < 0 || hardness > 1) {
      throw new RangeError('baseline brush hardness must be within 0..1');
    }
    this.#radius = sizePx / 2;
""",
    """    if (!Number.isFinite(hardness) || hardness < 0 || hardness > 1) {
      throw new RangeError('baseline brush hardness must be within 0..1');
    }
    if (!Number.isFinite(tipDensity) || tipDensity < 0 || tipDensity > 1) {
      throw new RangeError('baseline brush tip density must be within 0..1');
    }
    this.#radius = sizePx / 2;
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """    this.#strokeOpacity = opacity;
    this.#hardness = hardness;
    this.#tipShape = options.tipShape ?? 'round';
""",
    """    this.#strokeOpacity = opacity;
    this.#hardness = hardness;
    this.#tipDensity = tipDensity;
    this.#tipShape = options.tipShape ?? 'round';
""",
)
source = read('src/gpu/baseline-brush.ts')
needle = """this.#hardness,
      this.#color,"""
count = source.count(needle)
if count != 2:
    raise RuntimeError(f'src/gpu/baseline-brush.ts: expected two standard stamp calls, found {count}')
source = source.replace(needle, """this.#hardness,
      this.#tipDensity,
      this.#color,""")
needle = """this.#hardness,
          this.#color,"""
count = source.count(needle)
if count != 1:
    raise RuntimeError(f'src/gpu/baseline-brush.ts: expected one nested stamp call, found {count}')
source = source.replace(needle, """this.#hardness,
          this.#tipDensity,
          this.#color,""", 1)
write('src/gpu/baseline-brush.ts', source)
replace_once(
    'src/gpu/baseline-brush.ts',
    """      (dab.hardness !== undefined &&
        (!Number.isFinite(dab.hardness) || dab.hardness < 0 || dab.hardness > 1)) ||
      (dab.color !== undefined &&
""",
    """      (dab.hardness !== undefined &&
        (!Number.isFinite(dab.hardness) || dab.hardness < 0 || dab.hardness > 1)) ||
      (dab.tipDensity !== undefined &&
        (!Number.isFinite(dab.tipDensity) || dab.tipDensity < 0 || dab.tipDensity > 1)) ||
      (dab.color !== undefined &&
""",
)

replace_once(
    'src/gpu/baseline-raster-tile-store.ts',
    """  baselineDabHardnessV1,
  baselineDabRadiusXV1,
""",
    """  baselineDabHardnessV1,
  baselineDabTipDensityV1,
  baselineDabRadiusXV1,
""",
)
replace_once(
    'src/gpu/baseline-raster-tile-store.ts',
    """  const hardness = baselineDabHardnessV1(dab);
  return distance <= hardness ? 1 : clamp01(1 - smoothstep(hardness, 1, distance));
""",
    """  const hardness = baselineDabHardnessV1(dab);
  const edgeCoverage = distance <= hardness ? 1 : clamp01(1 - smoothstep(hardness, 1, distance));
  return edgeCoverage * baselineDabTipDensityV1(dab);
""",
)

replace_once(
    'src/gpu/baseline-paint-renderer.ts',
    """  BASELINE_BRUSH_HARDNESS,
  baselineDabColorV1,
""",
    """  BASELINE_BRUSH_HARDNESS,
  BASELINE_BRUSH_TIP_DENSITY,
  baselineDabColorV1,
""",
)
replace_once(
    'src/gpu/baseline-paint-renderer.ts',
    """  baselineDabHardnessV1,
  baselineDabRadiusXV1,
""",
    """  baselineDabHardnessV1,
  baselineDabTipDensityV1,
  baselineDabRadiusXV1,
""",
)
replace_once(
    'src/gpu/baseline-paint-renderer.ts',
    """        ...(dab.hardness === undefined ? {} : { hardness: dab.hardness }),
        ...(dab.tipShape === undefined ? {} : { tipShape: dab.tipShape }),
""",
    """        ...(dab.hardness === undefined ? {} : { hardness: dab.hardness }),
        ...(dab.tipDensity === undefined ? {} : { tipDensity: dab.tipDensity }),
        ...(dab.tipShape === undefined ? {} : { tipShape: dab.tipShape }),
""",
)
replace_once(
    'src/gpu/baseline-paint-renderer.ts',
    """    (dab.hardness === undefined ||
      (Number.isFinite(dab.hardness) && dab.hardness >= 0 && dab.hardness <= 1)) &&
    (dab.tipShape === undefined || dab.tipShape === 'round' || dab.tipShape === 'square')
""",
    """    (dab.hardness === undefined ||
      (Number.isFinite(dab.hardness) && dab.hardness >= 0 && dab.hardness <= 1)) &&
    (dab.tipDensity === undefined ||
      (Number.isFinite(dab.tipDensity) && dab.tipDensity >= 0 && dab.tipDensity <= 1)) &&
    (dab.tipShape === undefined || dab.tipShape === 'round' || dab.tipShape === 'square')
""",
)
replace_once(
    'src/gpu/baseline-paint-renderer.ts',
    """    baselineDabHardnessV1(left) === baselineDabHardnessV1(right) &&
    (left.tipShape ?? 'round') === (right.tipShape ?? 'round') &&
""",
    """    baselineDabHardnessV1(left) === baselineDabHardnessV1(right) &&
    baselineDabTipDensityV1(left) === baselineDabTipDensityV1(right) &&
    (left.tipShape ?? 'round') === (right.tipShape ?? 'round') &&
""",
)
replace_once(
    'src/gpu/baseline-paint-renderer.ts',
    """      dab.tipShape === 'square' ||
      baselineDabHardnessV1(dab) !== BASELINE_BRUSH_HARDNESS ||
      (baselineDabUsesFlowOpacityV1(dab) &&
""",
    """      dab.tipShape === 'square' ||
      baselineDabHardnessV1(dab) !== BASELINE_BRUSH_HARDNESS ||
      baselineDabTipDensityV1(dab) !== BASELINE_BRUSH_TIP_DENSITY ||
      (baselineDabUsesFlowOpacityV1(dab) &&
""",
)

replace_once(
    'src/app/canonical-raster-brush.ts',
    """      readonly flow?: number;
      readonly hardness?: number;
      readonly tipShape?: BaselineBrushTipShapeV1;
""",
    """      readonly flow?: number;
      readonly hardness?: number;
      readonly tipDensity?: number;
      readonly tipShape?: BaselineBrushTipShapeV1;
""",
)
replace_once(
    'src/app/canonical-raster-brush.ts',
    """      ...(options.hardness === undefined ? {} : { hardness: options.hardness }),
      ...(options.tipShape === undefined ? {} : { tipShape: options.tipShape }),
""",
    """      ...(options.hardness === undefined ? {} : { hardness: options.hardness }),
      ...(options.tipDensity === undefined ? {} : { tipDensity: options.tipDensity }),
      ...(options.tipShape === undefined ? {} : { tipShape: options.tipShape }),
""",
)

print('M6A-022 core patch applied')