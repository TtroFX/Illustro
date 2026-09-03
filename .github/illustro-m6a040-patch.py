from pathlib import Path


def read(path: str) -> str:
    return Path(path).read_text(encoding='utf-8')


def write(path: str, content: str) -> None:
    Path(path).write_text(content, encoding='utf-8')


def replace_once(path: str, before: str, after: str) -> None:
    source = read(path)
    count = source.count(before)
    if count != 1:
        raise RuntimeError(f'{path}: expected one replacement, found {count}: {before[:180]!r}')
    write(path, source.replace(before, after, 1))


def insert_before(path: str, marker: str, block: str) -> None:
    replace_once(path, marker, block.rstrip() + '\n\n' + marker)


def append_once(path: str, marker: str, block: str) -> None:
    source = read(path)
    if marker in source:
        return
    write(path, source.rstrip() + '\n\n' + block.strip() + '\n')


def write_new(path: str, content: str) -> None:
    target = Path(path)
    if target.exists():
        raise RuntimeError(f'{path}: already exists')
    target.write_text(content.strip() + '\n', encoding='utf-8')


# Canonical texture blend identity. This is scalar coverage-domain behavior, not a layer RGB blend mode.
insert_before(
    'src/domain/brush-schema.ts',
    "export type BrushTipSelectionModeV1 = 'fixed' | 'sequence' | 'random-per-stamp';",
    """export type BrushTextureBlendModeV1 = 'multiply' | 'subtract' | 'add';
export const DEFAULT_BRUSH_TEXTURE_BLEND_MODE_V1: BrushTextureBlendModeV1 = 'multiply';

export function brushTextureBlendModeV1(preset: BrushPresetV1): BrushTextureBlendModeV1 {
  const value = preset.texture.blendMode;
  return value === 'subtract' || value === 'add' ? value : DEFAULT_BRUSH_TEXTURE_BLEND_MODE_V1;
}

export function withBrushTextureBlendModeV1(
  preset: BrushPresetV1,
  blendMode: BrushTextureBlendModeV1,
): BrushPresetV1 {
  if (blendMode !== 'multiply' && blendMode !== 'subtract' && blendMode !== 'add') {
    throw new TypeError('unsupported brush texture blend mode');
  }
  if (blendMode === DEFAULT_BRUSH_TEXTURE_BLEND_MODE_V1) {
    const { blendMode: _blendMode, ...texture } = preset.texture;
    return normalizeBrushPresetV1({ ...preset, texture });
  }
  return normalizeBrushPresetV1({
    ...preset,
    texture: { ...preset.texture, blendMode },
  });
}""",
)

write_new(
    'src/gpu/brush-texture-composite.ts',
    """import type { BrushTextureBlendModeV1 } from '../domain/brush-schema.js';

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function requireUnit(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError(`${label} must be within 0..1`);
  }
  return value;
}

/**
 * Combines a scalar sampled texture with already-established brush coverage.
 * This function is deliberately color-space neutral: it never reads or writes RGB.
 */
export function combineBrushTextureCoverageV1(
  brushCoverage: number,
  textureCoverage: number,
  strength: number,
  blendMode: BrushTextureBlendModeV1,
): number {
  const brush = requireUnit(brushCoverage, 'brush coverage');
  const texture = requireUnit(textureCoverage, 'texture coverage');
  const amount = requireUnit(strength, 'texture strength');
  if (blendMode !== 'multiply' && blendMode !== 'subtract' && blendMode !== 'add') {
    throw new TypeError('unsupported brush texture blend mode');
  }
  if (brush <= 0 || amount <= 0) return brush;

  if (blendMode === 'multiply') {
    const modulation = 1 - amount * (1 - texture);
    return clamp01(brush * modulation);
  }
  if (blendMode === 'subtract') {
    return clamp01(brush - amount * (1 - texture));
  }
  return clamp01(brush + (1 - brush) * texture * amount);
}""",
)

# Runtime state captures mode independently of the sampled resource payload.
replace_once(
    'src/app/paint-session-controller.ts',
    """import {
  BASELINE_BRUSH_END_TAPER_LENGTH_PX,""",
    """import type { BrushTextureBlendModeV1 } from '../domain/brush-schema.js';
import {
  BASELINE_BRUSH_END_TAPER_LENGTH_PX,""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """  readonly brushTextureScale: number;
  readonly brushTextureRotationDegrees: number;
  readonly brushTipAngleDegrees: number;
""",
    """  readonly brushTextureScale: number;
  readonly brushTextureRotationDegrees: number;
  readonly brushTextureBlendMode: BrushTextureBlendModeV1;
  readonly brushTipAngleDegrees: number;
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """  #brushTextureScale = 1;
  #brushTextureRotationDegrees = 0;
  #brushTipAngleDegrees: number = BASELINE_BRUSH_TIP_ANGLE_DEGREES;
""",
    """  #brushTextureScale = 1;
  #brushTextureRotationDegrees = 0;
  #brushTextureBlendMode: BrushTextureBlendModeV1 = 'multiply';
  #brushTipAngleDegrees: number = BASELINE_BRUSH_TIP_ANGLE_DEGREES;
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """      brushTextureScale: this.#brushTextureScale,
      brushTextureRotationDegrees: this.#brushTextureRotationDegrees,
      brushTipAngleDegrees: this.#brushTipAngleDegrees,
""",
    """      brushTextureScale: this.#brushTextureScale,
      brushTextureRotationDegrees: this.#brushTextureRotationDegrees,
      brushTextureBlendMode: this.#brushTextureBlendMode,
      brushTipAngleDegrees: this.#brushTipAngleDegrees,
""",
)
insert_before(
    'src/app/paint-session-controller.ts',
    '  setBrushTipAngleDegrees(angleDegrees: number): number {',
    """  setBrushTextureBlendMode(blendMode: BrushTextureBlendModeV1): BrushTextureBlendModeV1 {
    if (blendMode !== 'multiply' && blendMode !== 'subtract' && blendMode !== 'add') {
      throw new TypeError('unsupported runtime brush texture blend mode');
    }
    if (blendMode !== this.#brushTextureBlendMode) this.#clearActiveStroke();
    this.#brushTextureBlendMode = blendMode;
    return this.#brushTextureBlendMode;
  }

  brushTextureBlendMode(): BrushTextureBlendModeV1 {
    return this.#brushTextureBlendMode;
  }""",
)

# Preset library mutation.
replace_once(
    'src/app/brush-preset-library.ts',
    """  withBrushTextureScaleV1,
  withBrushTextureRotationDegreesV1,
  withBrushStrokeSpacingV1,
""",
    """  withBrushTextureScaleV1,
  withBrushTextureRotationDegreesV1,
  withBrushTextureBlendModeV1,
  withBrushStrokeSpacingV1,
""",
)
replace_once(
    'src/app/brush-preset-library.ts',
    """  type BrushTipSelectionModeV1,
  type BrushTipShapeV1,
  type BrushPresetV1,
""",
    """  type BrushTipSelectionModeV1,
  type BrushTipShapeV1,
  type BrushTextureBlendModeV1,
  type BrushPresetV1,
""",
)
insert_before(
    'src/app/brush-preset-library.ts',
    'export function updateBrushPresetCustomTipV1(',
    """export function updateBrushPresetTextureBlendModeV1(
  state: BrushPresetLibraryStateV1,
  presetId: string,
  blendMode: BrushTextureBlendModeV1,
): BrushPresetLibraryStateV1 {
  return updateItemV1(state, presetId, (item) => {
    if (item.locked) throw new Error('locked brush preset cannot be edited');
    const current = withBrushTextureBlendModeV1(item.preset, blendMode);
    if (JSON.stringify(current) === JSON.stringify(item.preset)) return item;
    const next = normalizeBrushPresetV1({ ...current, revision: item.preset.revision + 1 });
    return itemV1({
      source: item.source,
      baseline: item.baseline,
      preset: next,
      locked: item.locked,
    });
  });
}""",
)

# Brush Properties controller/UI.
replace_once(
    'src/app/brush-preset-controller.ts',
    """  brushTextureScaleV1,
  brushTextureRotationDegreesV1,
  BUILTIN_BRUSH_GRAIN_RESOURCES_V1,
""",
    """  brushTextureScaleV1,
  brushTextureRotationDegreesV1,
  brushTextureBlendModeV1,
  BUILTIN_BRUSH_GRAIN_RESOURCES_V1,
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  type BrushTipSelectionModeV1,
  type BrushTipShapeV1,
} from '../domain/brush-schema.js';
""",
    """  type BrushTipSelectionModeV1,
  type BrushTipShapeV1,
  type BrushTextureBlendModeV1,
} from '../domain/brush-schema.js';
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  updateBrushPresetTextureScaleV1,
  updateBrushPresetTextureRotationV1,
  updateBrushPresetSpacingV1,
""",
    """  updateBrushPresetTextureScaleV1,
  updateBrushPresetTextureRotationV1,
  updateBrushPresetTextureBlendModeV1,
  updateBrushPresetSpacingV1,
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  const textureRotationRange = requireElement('#brush-texture-rotation-range', HTMLInputElement);
  const textureRotationNumber = requireElement('#brush-texture-rotation-number', HTMLInputElement);
  const tipShape = requireElement('#brush-tip-shape', HTMLSelectElement);
""",
    """  const textureRotationRange = requireElement('#brush-texture-rotation-range', HTMLInputElement);
  const textureRotationNumber = requireElement('#brush-texture-rotation-number', HTMLInputElement);
  const textureBlendMode = requireElement('#brush-texture-blend-mode', HTMLSelectElement);
  const tipShape = requireElement('#brush-tip-shape', HTMLSelectElement);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    const textureRotationDegrees = brushTextureRotationDegreesV1(item.preset);
    input.paintSession.setBrushTextureRotationDegrees(textureRotationDegrees);
    const tipAssets = brushTipAssetsV1(item.preset);
""",
    """    const textureRotationDegrees = brushTextureRotationDegreesV1(item.preset);
    input.paintSession.setBrushTextureRotationDegrees(textureRotationDegrees);
    const textureBlend = brushTextureBlendModeV1(item.preset);
    input.paintSession.setBrushTextureBlendMode(textureBlend);
    const tipAssets = brushTipAssetsV1(item.preset);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    input.root.dataset.illustroBrushTextureRotationDegrees = String(textureRotationDegrees);
    input.root.dataset.illustroBrushTipShape = brushTipShapeV1(item.preset);
""",
    """    input.root.dataset.illustroBrushTextureRotationDegrees = String(textureRotationDegrees);
    input.root.dataset.illustroBrushTextureBlendMode = textureBlend;
    input.root.dataset.illustroBrushTipShape = brushTipShapeV1(item.preset);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    const textureRotationDegrees = brushTextureRotationDegreesV1(selected.preset);
    configurePair(textureRotationRange, textureRotationNumber, 0, 359, 1, textureRotationDegrees);
    tipShape.value = brushTipShapeV1(selected.preset);
""",
    """    const textureRotationDegrees = brushTextureRotationDegreesV1(selected.preset);
    configurePair(textureRotationRange, textureRotationNumber, 0, 359, 1, textureRotationDegrees);
    const textureBlend = brushTextureBlendModeV1(selected.preset);
    textureBlendMode.value = textureBlend;
    tipShape.value = brushTipShapeV1(selected.preset);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    const textureRotationLabel =
      textureRotationDegrees !== 0 ? ` · TexRot${Math.round(textureRotationDegrees)}°` : '';
    propertyStatus.textContent = `${parameters.sizePx.toFixed(1)} px · ${Math.round(parameters.opacity * 100)}% · ${Math.round(parameters.flow * 100)}% · H${Math.round(hardness * 100)}% · D${Math.round(tipDensity * 100)}% · S${Math.round(spacing.spacingRatio * 100)}% · A${Math.round(tipAngleDegrees)}° · F${Math.round(tipDirectionDegrees)}°${followRotation ? ' · Follow' : ''}${repeatLabel}${startLabel}${endLabel}${sizeTaperLabel}${opacityTaperLabel}${forcedTaperLabel}${stabilizationLabel}${postCorrectionLabel}${grainLabel}${paperLabel}${textureStrengthLabel}${textureScaleLabel}${textureRotationLabel}`;
""",
    """    const textureRotationLabel =
      textureRotationDegrees !== 0 ? ` · TexRot${Math.round(textureRotationDegrees)}°` : '';
    const textureBlendLabel = textureBlend === 'multiply' ? '' : ` · TexBlend:${textureBlend}`;
    propertyStatus.textContent = `${parameters.sizePx.toFixed(1)} px · ${Math.round(parameters.opacity * 100)}% · ${Math.round(parameters.flow * 100)}% · H${Math.round(hardness * 100)}% · D${Math.round(tipDensity * 100)}% · S${Math.round(spacing.spacingRatio * 100)}% · A${Math.round(tipAngleDegrees)}° · F${Math.round(tipDirectionDegrees)}°${followRotation ? ' · Follow' : ''}${repeatLabel}${startLabel}${endLabel}${sizeTaperLabel}${opacityTaperLabel}${forcedTaperLabel}${stabilizationLabel}${postCorrectionLabel}${grainLabel}${paperLabel}${textureStrengthLabel}${textureScaleLabel}${textureRotationLabel}${textureBlendLabel}`;
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """      textureRotationRange,
      textureRotationNumber,
      tipShape,
""",
    """      textureRotationRange,
      textureRotationNumber,
      textureBlendMode,
      tipShape,
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  const onTextureRotationNumber = (): void =>
    updateTextureRotation(Number(textureRotationNumber.value));
  const onTipShape = (): void => {
""",
    """  const onTextureRotationNumber = (): void =>
    updateTextureRotation(Number(textureRotationNumber.value));
  const onTextureBlendMode = (): void => {
    const blendMode: BrushTextureBlendModeV1 =
      textureBlendMode.value === 'subtract'
        ? 'subtract'
        : textureBlendMode.value === 'add'
          ? 'add'
          : 'multiply';
    mutate(() => updateBrushPresetTextureBlendModeV1(state, state.selectedPresetId, blendMode));
  };
  const onTipShape = (): void => {
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  textureRotationRange.addEventListener('input', onTextureRotationRange);
  textureRotationNumber.addEventListener('change', onTextureRotationNumber);
  tipShape.addEventListener('change', onTipShape);
""",
    """  textureRotationRange.addEventListener('input', onTextureRotationRange);
  textureRotationNumber.addEventListener('change', onTextureRotationNumber);
  textureBlendMode.addEventListener('change', onTextureBlendMode);
  tipShape.addEventListener('change', onTipShape);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """      textureRotationRange.removeEventListener('input', onTextureRotationRange);
      textureRotationNumber.removeEventListener('change', onTextureRotationNumber);
      tipShape.removeEventListener('change', onTipShape);
""",
    """      textureRotationRange.removeEventListener('input', onTextureRotationRange);
      textureRotationNumber.removeEventListener('change', onTextureRotationNumber);
      textureBlendMode.removeEventListener('change', onTextureBlendMode);
      tipShape.removeEventListener('change', onTipShape);
""",
)

replace_once(
    'src/index.html',
    """              <div class=\"shell-brush-property-row\">
                <label for=\"brush-texture-rotation-range\">テクスチャ回転</label>
                <input id=\"brush-texture-rotation-range\" type=\"range\" min=\"0\" max=\"359\" step=\"1\" value=\"0\" />
                <span class=\"shell-brush-property-number\"><input id=\"brush-texture-rotation-number\" type=\"number\" inputmode=\"numeric\" min=\"0\" max=\"359\" step=\"1\" value=\"0\" aria-label=\"ブラシテクスチャ回転\" /><span>°</span></span>
              </div>
              <div class=\"shell-brush-property-row shell-brush-tip-property-row\">
                <label for=\"brush-tip-shape\">ブラシ形状</label>
""",
    """              <div class=\"shell-brush-property-row\">
                <label for=\"brush-texture-rotation-range\">テクスチャ回転</label>
                <input id=\"brush-texture-rotation-range\" type=\"range\" min=\"0\" max=\"359\" step=\"1\" value=\"0\" />
                <span class=\"shell-brush-property-number\"><input id=\"brush-texture-rotation-number\" type=\"number\" inputmode=\"numeric\" min=\"0\" max=\"359\" step=\"1\" value=\"0\" aria-label=\"ブラシテクスチャ回転\" /><span>°</span></span>
              </div>
              <div class=\"shell-brush-property-row shell-brush-tip-property-row\">
                <label for=\"brush-texture-blend-mode\">テクスチャ合成</label>
                <select id=\"brush-texture-blend-mode\" aria-label=\"ブラシテクスチャ合成方法\">
                  <option value=\"multiply\">乗算</option>
                  <option value=\"subtract\">減算</option>
                  <option value=\"add\">加算</option>
                </select>
                <span class=\"shell-brush-tip-kind\">Coverage</span>
              </div>
              <div class=\"shell-brush-property-row shell-brush-tip-property-row\">
                <label for=\"brush-tip-shape\">ブラシ形状</label>
""",
)

write_new(
    'tests/unit/brush-texture-blend.test.ts',
    """import { describe, expect, it } from 'vitest';
import {
  brushTextureBlendModeV1,
  brushTextureRotationDegreesV1,
  brushTextureScaleV1,
  brushTextureStrengthV1,
  createBaselineBrushPresetV1,
  withBrushPaperTextureResourceIdV1,
  withBrushTextureBlendModeV1,
  withBrushTextureRotationDegreesV1,
  withBrushTextureScaleV1,
  withBrushTextureStrengthV1,
} from '../../src/domain/brush-schema.js';
import { PaintSessionControllerV1 } from '../../src/app/paint-session-controller.js';
import { combineBrushTextureCoverageV1 } from '../../src/gpu/brush-texture-composite.js';

class FakeRendererDocumentPort {
  async configureDocument(): Promise<void> {}
  async restoreBaselineStrokes(): Promise<void> {}
  async applyBaselineTilePatches(): Promise<void> {}
}

describe('M6A-040 texture blend behavior', () => {
  it('uses multiply as the default and supports only coverage-domain modes', () => {
    const preset = createBaselineBrushPresetV1({
      id: 'texture.blend',
      name: 'Texture Blend',
      category: 'Test',
      behavior: 'paint',
    });
    expect(brushTextureBlendModeV1(preset)).toBe('multiply');
    expect(brushTextureBlendModeV1(withBrushTextureBlendModeV1(preset, 'subtract'))).toBe('subtract');
    expect(brushTextureBlendModeV1(withBrushTextureBlendModeV1(preset, 'add'))).toBe('add');
    expect(withBrushTextureBlendModeV1(preset, 'multiply').texture.blendMode).toBeUndefined();
  });

  it('defines deterministic scalar coverage combination without touching color', () => {
    expect(combineBrushTextureCoverageV1(0.8, 0.25, 0, 'multiply')).toBeCloseTo(0.8);
    expect(combineBrushTextureCoverageV1(0.8, 0.25, 1, 'multiply')).toBeCloseTo(0.2);
    expect(combineBrushTextureCoverageV1(0.8, 0.25, 0.5, 'subtract')).toBeCloseTo(0.425);
    expect(combineBrushTextureCoverageV1(0.8, 0.25, 0.5, 'add')).toBeCloseTo(0.825);
    expect(combineBrushTextureCoverageV1(0, 1, 1, 'add')).toBe(0);
  });

  it('keeps blend mode orthogonal to resource, strength, scale, and rotation', () => {
    const preset = withBrushTextureBlendModeV1(
      withBrushTextureRotationDegreesV1(
        withBrushTextureScaleV1(
          withBrushTextureStrengthV1(
            withBrushPaperTextureResourceIdV1(
              createBaselineBrushPresetV1({
                id: 'texture.blend.orthogonal',
                name: 'Texture Blend Orthogonal',
                category: 'Test',
                behavior: 'paint',
              }),
              'builtin.grain.paper.02',
            ),
            0.6,
          ),
          2,
        ),
        45,
      ),
      'subtract',
    );
    expect(brushTextureBlendModeV1(preset)).toBe('subtract');
    expect(brushTextureStrengthV1(preset)).toBe(0.6);
    expect(brushTextureScaleV1(preset)).toBe(2);
    expect(brushTextureRotationDegreesV1(preset)).toBe(45);
    expect(preset.texture.resourceSubtype).toBe('paper');
  });

  it('captures blend mode in runtime state without requiring a loaded texture', () => {
    const session = new PaintSessionControllerV1(new FakeRendererDocumentPort());
    expect(session.setBrushTextureBlendMode('add')).toBe('add');
    expect(session.brushTextureBlendMode()).toBe('add');
    expect(session.snapshot().brushTextureBlendMode).toBe('add');
  });
});""",
)

insert_before(
    'scripts/verify-m6a-brush.mjs',
    "requireText(\n  progress,\n  'M6A-PERF-001 incremental active-stroke rendering（stable prefix + bounded mutable tail）:未完了',",
    """requireText(progress, 'M6A-040 texture blend behavior:完了', 'M6A-040 progress is not complete');
requireText(
  read('src/domain/brush-schema.ts'),
  'BrushTextureBlendModeV1',
  'texture blend-mode schema missing',
);
requireText(
  read('src/gpu/brush-texture-composite.ts'),
  'combineBrushTextureCoverageV1',
  'coverage-domain texture combination missing',
);
requireText(
  read('src/app/paint-session-controller.ts'),
  'setBrushTextureBlendMode',
  'texture blend mode is not connected to runtime state',
);
requireText(
  read('src/index.html'),
  'id=\"brush-texture-blend-mode\"',
  'reachable texture blend-mode control missing',
);
requireText(
  read('tests/unit/brush-texture-blend.test.ts'),
  'deterministic scalar coverage combination without touching color',
  'texture blend coverage regression missing',
);""",
)

replace_once(
    'IMPLEMENTATION_PROGRESS.md',
    'M6A-040 texture blend behavior:未完了\nM6A-041 pressure→size:未完了',
    """M6A-040 texture blend behavior:完了
再開メモ: M6A-040 texture blend behaviorはBrushPresetV1.texture.blendModeをmultiply/subtract/addの3種coverage-domain modeとして定義し、multiplyをdefault/field省略値にした。layer RGB Blend Modeとは別系統で、pure helper combineBrushTextureCoverageV1がbrush coverage・sampled texture scalar・strengthだけを0..1で決定論的に合成し、RGB/色空間へ触れない。preset persistence・PaintSession snapshot・Brush Properties chooserへ接続済み。M6A-071/073で実sampled payloadが解決されるまではこのhelperをcanonical raster hot pathへ接続せず、既存stroke pixelsを変更しない。次はM6A-041 pressure→sizeから再開する。
M6A-041 pressure→size:未完了""",
)
append_once(
    'ILLUSTRO_DESIGN_MEMO.md',
    '#### M6A texture-blend boundary — 2026-09-03',
    """#### M6A texture-blend boundary — 2026-09-03

- M6A-040 defines texture combination as **scalar coverage-domain behavior**, not layer/RGB blending. The supported v1 modes are `multiply`, `subtract`, and `add`; `multiply` is the default and may be omitted from serialized preset data.
- `combineBrushTextureCoverageV1` is the canonical deterministic combination rule. It consumes only brush coverage, sampled texture coverage and M6A-037 strength, clamps the result to `0..1`, and never reads or modifies RGB or document color-space metadata.
- `multiply` attenuates brush coverage by the sampled texture; `subtract` performs a stronger cutout from low texture coverage; `add` raises coverage only inside an already-covered brush footprint. Strength `0` is exact identity for every mode.
- Blend mode is orthogonal to resource identity/subtype, scale and rotation. Changing it during an active stroke invalidates that stroke configuration rather than mixing two texture semantics.
- M6A-071/073 remains responsible for sampled resource payload resolution and the actual call-site in canonical rasterization. Until then, no surrogate texture is generated and existing raster output stays unchanged.""",
)
