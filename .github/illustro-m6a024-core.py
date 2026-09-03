from pathlib import Path
import re


def read(path: str) -> str:
    return Path(path).read_text(encoding='utf-8')


def write(path: str, content: str) -> None:
    Path(path).write_text(content, encoding='utf-8')


def replace_once(path: str, before: str, after: str) -> None:
    source = read(path)
    count = source.count(before)
    if count != 1:
        raise RuntimeError(f'{path}: expected exactly one replacement, found {count}: {before[:120]!r}')
    write(path, source.replace(before, after, 1))


def insert_before(path: str, marker: str, block: str) -> None:
    replace_once(path, marker, block.rstrip() + '\n\n' + marker)


# Domain: static angle belongs to tip, normalized to [0, 360).
insert_before(
    'src/domain/brush-schema.ts',
    'export function withBrushParameterValuesV1(',
    """export const DEFAULT_BRUSH_TIP_ANGLE_DEGREES_V1 = 0 as const;

function normalizeBrushTipAngleDegreesV1(angleDegrees: number): number {
  if (!Number.isFinite(angleDegrees)) throw new TypeError('brush tip angle must be finite');
  const normalized = ((angleDegrees % 360) + 360) % 360;
  return Object.is(normalized, -0) ? 0 : normalized;
}

export function brushTipAngleDegreesV1(preset: BrushPresetV1): number {
  const value = preset.tip.angleDegrees;
  return typeof value === 'number' && Number.isFinite(value)
    ? normalizeBrushTipAngleDegreesV1(value)
    : DEFAULT_BRUSH_TIP_ANGLE_DEGREES_V1;
}

export function withBrushTipAngleDegreesV1(
  preset: BrushPresetV1,
  angleDegrees: number,
): BrushPresetV1 {
  const normalized = normalizeBrushTipAngleDegreesV1(angleDegrees);
  return normalizeBrushPresetV1({
    ...preset,
    tip: { ...preset.tip, angleDegrees: normalized },
  });
}""",
)

# Baseline dab semantics + sampled mask rotation + rotated dirty bounds.
replace_once(
    'src/gpu/baseline-brush.ts',
    'export const BASELINE_BRUSH_TIP_DENSITY = 1 as const;\n',
    'export const BASELINE_BRUSH_TIP_DENSITY = 1 as const;\nexport const BASELINE_BRUSH_TIP_ANGLE_DEGREES = 0 as const;\n',
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """  readonly tipDensity?: number;
  readonly tipShape?: BaselineBrushTipShapeV1;
""",
    """  readonly tipDensity?: number;
  readonly tipAngleDegrees?: number;
  readonly tipShape?: BaselineBrushTipShapeV1;
""",
)
insert_before(
    'src/gpu/baseline-brush.ts',
    'export function baselineDabUsesFlowOpacityV1(dab: BaselineBrushDabV1): boolean {',
    """export function normalizeBaselineBrushTipAngleDegreesV1(angleDegrees: number): number {
  if (!Number.isFinite(angleDegrees)) throw new TypeError('baseline brush tip angle must be finite');
  const normalized = ((angleDegrees % 360) + 360) % 360;
  return Object.is(normalized, -0) ? 0 : normalized;
}

export function baselineDabTipAngleDegreesV1(dab: BaselineBrushDabV1): number {
  return normalizeBaselineBrushTipAngleDegreesV1(
    dab.tipAngleDegrees ?? BASELINE_BRUSH_TIP_ANGLE_DEGREES,
  );
}

export function baselineDabExtentXV1(dab: BaselineBrushDabV1): number {
  const radiusX = baselineDabRadiusXV1(dab);
  const radiusY = baselineDabRadiusYV1(dab);
  const angle = (baselineDabTipAngleDegreesV1(dab) * Math.PI) / 180;
  const cos = Math.abs(Math.cos(angle));
  const sin = Math.abs(Math.sin(angle));
  return dab.tipShape === 'square'
    ? radiusX * cos + radiusY * sin
    : Math.hypot(radiusX * cos, radiusY * sin);
}

export function baselineDabExtentYV1(dab: BaselineBrushDabV1): number {
  const radiusX = baselineDabRadiusXV1(dab);
  const radiusY = baselineDabRadiusYV1(dab);
  const angle = (baselineDabTipAngleDegreesV1(dab) * Math.PI) / 180;
  const cos = Math.abs(Math.cos(angle));
  const sin = Math.abs(Math.sin(angle));
  return dab.tipShape === 'square'
    ? radiusX * sin + radiusY * cos
    : Math.hypot(radiusX * sin, radiusY * cos);
}""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """  hardness: number,
  tipDensity: number,
  color: BaselineBrushColorV1,
""",
    """  hardness: number,
  tipDensity: number,
  tipAngleDegrees: number,
  color: BaselineBrushColorV1,
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """    hardness,
    tipDensity,
    tipShape,
""",
    """    hardness,
    tipDensity,
    tipAngleDegrees,
    tipShape,
""",
)
# pushBaselineBrushStamp has same parameter sequence after freezeDab; replace the remaining signature.
replace_once(
    'src/gpu/baseline-brush.ts',
    """  hardness: number,
  tipDensity: number,
  color: BaselineBrushColorV1,
  tipShape: BaselineBrushTipShapeV1,
""",
    """  hardness: number,
  tipDensity: number,
  tipAngleDegrees: number,
  color: BaselineBrushColorV1,
  tipShape: BaselineBrushTipShapeV1,
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """      freezeDab(x, y, radius, flow, strokeOpacity, hardness, tipDensity, color, tipShape),
""",
    """      freezeDab(
        x,
        y,
        radius,
        flow,
        strokeOpacity,
        hardness,
        tipDensity,
        tipAngleDegrees,
        color,
        tipShape,
      ),
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """  const alphaImage = sampledTipAlpha;
  const microRadius = (radius / side) * 1.1;
""",
    """  const alphaImage = sampledTipAlpha;
  const microRadius = (radius / side) * 1.1;
  const angle = (tipAngleDegrees * Math.PI) / 180;
  const angleCos = Math.cos(angle);
  const angleSin = Math.sin(angle);
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """    const offsetX = ((column + 0.5) / side - 0.5) * radius * 2;
    const offsetY = ((row + 0.5) / side - 0.5) * radius * 2;
    target.push(
      freezeDab(
        x + offsetX,
        y + offsetY,
""",
    """    const offsetX = ((column + 0.5) / side - 0.5) * radius * 2;
    const offsetY = ((row + 0.5) / side - 0.5) * radius * 2;
    const rotatedOffsetX = offsetX * angleCos - offsetY * angleSin;
    const rotatedOffsetY = offsetX * angleSin + offsetY * angleCos;
    target.push(
      freezeDab(
        x + rotatedOffsetX,
        y + rotatedOffsetY,
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """        hardness,
        tipDensity,
        color,
        'round',
""",
    """        hardness,
        tipDensity,
        tipAngleDegrees,
        color,
        'round',
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """  readonly #tipDensity: number;
  readonly #tipShape: BaselineBrushTipShapeV1;
""",
    """  readonly #tipDensity: number;
  readonly #tipAngleDegrees: number;
  readonly #tipShape: BaselineBrushTipShapeV1;
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """      readonly tipDensity?: number;
      readonly tipShape?: BaselineBrushTipShapeV1;
""",
    """      readonly tipDensity?: number;
      readonly tipAngleDegrees?: number;
      readonly tipShape?: BaselineBrushTipShapeV1;
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """    const hardness = options.hardness ?? BASELINE_BRUSH_HARDNESS;
    const tipDensity = options.tipDensity ?? BASELINE_BRUSH_TIP_DENSITY;
""",
    """    const hardness = options.hardness ?? BASELINE_BRUSH_HARDNESS;
    const tipDensity = options.tipDensity ?? BASELINE_BRUSH_TIP_DENSITY;
    const tipAngleDegrees = normalizeBaselineBrushTipAngleDegreesV1(
      options.tipAngleDegrees ?? BASELINE_BRUSH_TIP_ANGLE_DEGREES,
    );
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """    this.#hardness = hardness;
    this.#tipDensity = tipDensity;
    this.#tipShape = options.tipShape ?? 'round';
""",
    """    this.#hardness = hardness;
    this.#tipDensity = tipDensity;
    this.#tipAngleDegrees = tipAngleDegrees;
    this.#tipShape = options.tipShape ?? 'round';
""",
)
# Three logical stamp calls have three indentation levels.
source = read('src/gpu/baseline-brush.ts')
for indent in ('      ', '        ', '          '):
    needle = 'this.#tipDensity,\n' + indent + 'this.#color,'
    count = source.count(needle)
    if count != 1:
        raise RuntimeError('baseline-brush: expected one stamp call for ' + repr(indent) + ', found ' + str(count))
    replacement = (
        'this.#tipDensity,\n'
        + indent
        + 'this.#tipAngleDegrees,\n'
        + indent
        + 'this.#color,'
    )
    source = source.replace(needle, replacement, 1)
write('src/gpu/baseline-brush.ts', source)
replace_once(
    'src/gpu/baseline-brush.ts',
    """function dabDocumentBounds(dab: BaselineBrushDabV1): RectV1 {
  const radiusX = baselineDabRadiusXV1(dab);
  const radiusY = baselineDabRadiusYV1(dab);
  const left = Math.floor(dab.x - radiusX);
  const top = Math.floor(dab.y - radiusY);
  const right = Math.ceil(dab.x + radiusX);
  const bottom = Math.ceil(dab.y + radiusY);
""",
    """function dabDocumentBounds(dab: BaselineBrushDabV1): RectV1 {
  const extentX = baselineDabExtentXV1(dab);
  const extentY = baselineDabExtentYV1(dab);
  const left = Math.floor(dab.x - extentX);
  const top = Math.floor(dab.y - extentY);
  const right = Math.ceil(dab.x + extentX);
  const bottom = Math.ceil(dab.y + extentY);
""",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    """      (dab.tipDensity !== undefined &&
        (!Number.isFinite(dab.tipDensity) || dab.tipDensity < 0 || dab.tipDensity > 1)) ||
      (dab.color !== undefined &&
""",
    """      (dab.tipDensity !== undefined &&
        (!Number.isFinite(dab.tipDensity) || dab.tipDensity < 0 || dab.tipDensity > 1)) ||
      (dab.tipAngleDegrees !== undefined && !Number.isFinite(dab.tipAngleDegrees)) ||
      (dab.color !== undefined &&
""",
)

# Canonical coverage inverse-rotates document-relative coordinates and uses rotated extents.
replace_once(
    'src/gpu/baseline-raster-tile-store.ts',
    """  baselineDabHardnessV1,
  baselineDabTipDensityV1,
  baselineDabRadiusXV1,
""",
    """  baselineDabHardnessV1,
  baselineDabTipDensityV1,
  baselineDabTipAngleDegreesV1,
  baselineDabExtentXV1,
  baselineDabExtentYV1,
  baselineDabRadiusXV1,
""",
)
replace_once(
    'src/gpu/baseline-raster-tile-store.ts',
    """function baselineProceduralTipDistanceV1(
  dab: BaselineBrushDabV1,
  localX: number,
  localY: number,
): number {
  return dab.tipShape === 'square'
    ? Math.max(Math.abs(localX), Math.abs(localY))
    : Math.hypot(localX, localY);
}
""",
    """function baselineProceduralTipDistanceV1(
  dab: BaselineBrushDabV1,
  localX: number,
  localY: number,
): number {
  const radiusX = baselineDabRadiusXV1(dab);
  const radiusY = baselineDabRadiusYV1(dab);
  const angle = (-baselineDabTipAngleDegreesV1(dab) * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const documentX = localX * radiusX;
  const documentY = localY * radiusY;
  const rotatedLocalX = (documentX * cos - documentY * sin) / radiusX;
  const rotatedLocalY = (documentX * sin + documentY * cos) / radiusY;
  return dab.tipShape === 'square'
    ? Math.max(Math.abs(rotatedLocalX), Math.abs(rotatedLocalY))
    : Math.hypot(rotatedLocalX, rotatedLocalY);
}
""",
)
source = read('src/gpu/baseline-raster-tile-store.ts')
pattern = re.compile(
    r"  const radiusX = baselineDabRadiusXV1\(dab\);\n"
    r"  const radiusY = baselineDabRadiusYV1\(dab\);\n"
    r"  const minX = Math\.max\(tileX, Math\.floor\(dab\.x - radiusX\)\);\n"
    r"  const minY = Math\.max\(tileY, Math\.floor\(dab\.y - radiusY\)\);\n"
    r"  const maxX = Math\.min\(tileX \+ tile\.width - 1, Math\.ceil\(dab\.x \+ radiusX\) - 1\);\n"
    r"  const maxY = Math\.min\(tileY \+ tile\.height - 1, Math\.ceil\(dab\.y \+ radiusY\) - 1\);"
)
replacement = """  const radiusX = baselineDabRadiusXV1(dab);
  const radiusY = baselineDabRadiusYV1(dab);
  const extentX = baselineDabExtentXV1(dab);
  const extentY = baselineDabExtentYV1(dab);
  const minX = Math.max(tileX, Math.floor(dab.x - extentX));
  const minY = Math.max(tileY, Math.floor(dab.y - extentY));
  const maxX = Math.min(tileX + tile.width - 1, Math.ceil(dab.x + extentX) - 1);
  const maxY = Math.min(tileY + tile.height - 1, Math.ceil(dab.y + extentY) - 1);"""
source, count = pattern.subn(replacement, source)
if count < 3:
    raise RuntimeError(f'baseline-raster-tile-store: expected >=3 raster bounds blocks, found {count}')
source = source.replace('    if (Math.abs(localY) >= 1) continue;\n', '')
write('src/gpu/baseline-raster-tile-store.ts', source)

# Renderer retains angle in active/committed dabs and prefix equality.
replace_once(
    'src/gpu/baseline-paint-renderer.ts',
    """  baselineDabTipDensityV1,
  baselineDabRadiusXV1,
""",
    """  baselineDabTipDensityV1,
  baselineDabTipAngleDegreesV1,
  baselineDabRadiusXV1,
""",
)
replace_once(
    'src/gpu/baseline-paint-renderer.ts',
    """        ...(dab.tipDensity === undefined ? {} : { tipDensity: dab.tipDensity }),
        ...(dab.tipShape === undefined ? {} : { tipShape: dab.tipShape }),
""",
    """        ...(dab.tipDensity === undefined ? {} : { tipDensity: dab.tipDensity }),
        ...(dab.tipAngleDegrees === undefined ? {} : { tipAngleDegrees: dab.tipAngleDegrees }),
        ...(dab.tipShape === undefined ? {} : { tipShape: dab.tipShape }),
""",
)
replace_once(
    'src/gpu/baseline-paint-renderer.ts',
    """    (dab.tipDensity === undefined ||
      (Number.isFinite(dab.tipDensity) && dab.tipDensity >= 0 && dab.tipDensity <= 1)) &&
    (dab.tipShape === undefined || dab.tipShape === 'round' || dab.tipShape === 'square')
""",
    """    (dab.tipDensity === undefined ||
      (Number.isFinite(dab.tipDensity) && dab.tipDensity >= 0 && dab.tipDensity <= 1)) &&
    (dab.tipAngleDegrees === undefined || Number.isFinite(dab.tipAngleDegrees)) &&
    (dab.tipShape === undefined || dab.tipShape === 'round' || dab.tipShape === 'square')
""",
)
replace_once(
    'src/gpu/baseline-paint-renderer.ts',
    """    baselineDabTipDensityV1(left) === baselineDabTipDensityV1(right) &&
    (left.tipShape ?? 'round') === (right.tipShape ?? 'round') &&
""",
    """    baselineDabTipDensityV1(left) === baselineDabTipDensityV1(right) &&
    baselineDabTipAngleDegreesV1(left) === baselineDabTipAngleDegreesV1(right) &&
    (left.tipShape ?? 'round') === (right.tipShape ?? 'round') &&
""",
)

# Canonical stroke forwards the static angle to the deterministic kernel.
replace_once(
    'src/app/canonical-raster-brush.ts',
    """      readonly tipDensity?: number;
      readonly tipShape?: BaselineBrushTipShapeV1;
""",
    """      readonly tipDensity?: number;
      readonly tipAngleDegrees?: number;
      readonly tipShape?: BaselineBrushTipShapeV1;
""",
)
replace_once(
    'src/app/canonical-raster-brush.ts',
    """      ...(options.tipDensity === undefined ? {} : { tipDensity: options.tipDensity }),
      ...(options.tipShape === undefined ? {} : { tipShape: options.tipShape }),
""",
    """      ...(options.tipDensity === undefined ? {} : { tipDensity: options.tipDensity }),
      ...(options.tipAngleDegrees === undefined ? {} : { tipAngleDegrees: options.tipAngleDegrees }),
      ...(options.tipShape === undefined ? {} : { tipShape: options.tipShape }),
""",
)

print('M6A-024 core patch applied')