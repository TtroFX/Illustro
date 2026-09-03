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


insert_before(
    'src/domain/brush-schema.ts',
    "export type BrushTipSelectionModeV1 = 'fixed' | 'sequence' | 'random-per-stamp';",
    """export const DEFAULT_BRUSH_TEXTURE_ROTATION_DEGREES_V1 = 0 as const;

function normalizeBrushTextureRotationDegreesV1(rotationDegrees: number): number {
  if (!Number.isFinite(rotationDegrees)) throw new TypeError('brush texture rotation must be finite');
  const normalized = ((rotationDegrees % 360) + 360) % 360;
  return Object.is(normalized, -0) ? 0 : normalized;
}

export function brushTextureRotationDegreesV1(preset: BrushPresetV1): number {
  const value = preset.texture.rotationDegrees;
  return typeof value === 'number' && Number.isFinite(value)
    ? normalizeBrushTextureRotationDegreesV1(value)
    : DEFAULT_BRUSH_TEXTURE_ROTATION_DEGREES_V1;
}

export function withBrushTextureRotationDegreesV1(
  preset: BrushPresetV1,
  rotationDegrees: number,
): BrushPresetV1 {
  const normalized = normalizeBrushTextureRotationDegreesV1(rotationDegrees);
  if (normalized === DEFAULT_BRUSH_TEXTURE_ROTATION_DEGREES_V1) {
    const { rotationDegrees: _rotationDegrees, ...texture } = preset.texture;
    return normalizeBrushPresetV1({ ...preset, texture });
  }
  return normalizeBrushPresetV1({
    ...preset,
    texture: { ...preset.texture, rotationDegrees: normalized },
  });
}""",
)

replace_once(
    'src/app/paint-session-controller.ts',
    """  readonly brushTextureStrength: number;
  readonly brushTextureScale: number;
  readonly brushTipAngleDegrees: number;
""",
    """  readonly brushTextureStrength: number;
  readonly brushTextureScale: number;
  readonly brushTextureRotationDegrees: number;
  readonly brushTipAngleDegrees: number;
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """  #brushTextureStrength = 0;
  #brushTextureScale = 1;
  #brushTipAngleDegrees: number = BASELINE_BRUSH_TIP_ANGLE_DEGREES;
""",
    """  #brushTextureStrength = 0;
  #brushTextureScale = 1;
  #brushTextureRotationDegrees = 0;
  #brushTipAngleDegrees: number = BASELINE_BRUSH_TIP_ANGLE_DEGREES;
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """      brushTextureStrength: this.#brushTextureStrength,
      brushTextureScale: this.#brushTextureScale,
      brushTipAngleDegrees: this.#brushTipAngleDegrees,
""",
    """      brushTextureStrength: this.#brushTextureStrength,
      brushTextureScale: this.#brushTextureScale,
      brushTextureRotationDegrees: this.#brushTextureRotationDegrees,
      brushTipAngleDegrees: this.#brushTipAngleDegrees,
""",
)
insert_before(
    'src/app/paint-session-controller.ts',
    '  setBrushTipAngleDegrees(angleDegrees: number): number {',
    """  setBrushTextureRotationDegrees(rotationDegrees: number): number {
    if (!Number.isFinite(rotationDegrees)) {
      throw new TypeError('invalid runtime brush texture rotation');
    }
    const normalized = ((rotationDegrees % 360) + 360) % 360;
    const value = Object.is(normalized, -0) ? 0 : normalized;
    if (value !== this.#brushTextureRotationDegrees) this.#clearActiveStroke();
    this.#brushTextureRotationDegrees = value;
    return this.#brushTextureRotationDegrees;
  }

  brushTextureRotationDegrees(): number {
    return this.#brushTextureRotationDegrees;
  }""",
)

replace_once(
    'src/app/brush-preset-library.ts',
    """  withBrushTextureStrengthV1,
  withBrushTextureScaleV1,
  withBrushStrokeSpacingV1,
""",
    """  withBrushTextureStrengthV1,
  withBrushTextureScaleV1,
  withBrushTextureRotationDegreesV1,
  withBrushStrokeSpacingV1,
""",
)
insert_before(
    'src/app/brush-preset-library.ts',
    'export function updateBrushPresetCustomTipV1(',
    """export function updateBrushPresetTextureRotationV1(
  state: BrushPresetLibraryStateV1,
  presetId: string,
  rotationDegrees: number,
): BrushPresetLibraryStateV1 {
  return updateItemV1(state, presetId, (item) => {
    if (item.locked) throw new Error('locked brush preset cannot be edited');
    const current = withBrushTextureRotationDegreesV1(item.preset, rotationDegrees);
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

replace_once(
    'src/app/brush-preset-controller.ts',
    """  brushTextureStrengthV1,
  brushTextureScaleV1,
  BUILTIN_BRUSH_GRAIN_RESOURCES_V1,
""",
    """  brushTextureStrengthV1,
  brushTextureScaleV1,
  brushTextureRotationDegreesV1,
  BUILTIN_BRUSH_GRAIN_RESOURCES_V1,
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  updateBrushPresetTextureStrengthV1,
  updateBrushPresetTextureScaleV1,
  updateBrushPresetSpacingV1,
""",
    """  updateBrushPresetTextureStrengthV1,
  updateBrushPresetTextureScaleV1,
  updateBrushPresetTextureRotationV1,
  updateBrushPresetSpacingV1,
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  const textureScaleRange = requireElement('#brush-texture-scale-range', HTMLInputElement);
  const textureScaleNumber = requireElement('#brush-texture-scale-number', HTMLInputElement);
  const tipShape = requireElement('#brush-tip-shape', HTMLSelectElement);
""",
    """  const textureScaleRange = requireElement('#brush-texture-scale-range', HTMLInputElement);
  const textureScaleNumber = requireElement('#brush-texture-scale-number', HTMLInputElement);
  const textureRotationRange = requireElement('#brush-texture-rotation-range', HTMLInputElement);
  const textureRotationNumber = requireElement('#brush-texture-rotation-number', HTMLInputElement);
  const tipShape = requireElement('#brush-tip-shape', HTMLSelectElement);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    const textureScale = brushTextureScaleV1(item.preset);
    input.paintSession.setBrushTextureScale(textureScale);
    const tipAssets = brushTipAssetsV1(item.preset);
""",
    """    const textureScale = brushTextureScaleV1(item.preset);
    input.paintSession.setBrushTextureScale(textureScale);
    const textureRotationDegrees = brushTextureRotationDegreesV1(item.preset);
    input.paintSession.setBrushTextureRotationDegrees(textureRotationDegrees);
    const tipAssets = brushTipAssetsV1(item.preset);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    input.root.dataset.illustroBrushTextureScale = String(textureScale);
    input.root.dataset.illustroBrushTipShape = brushTipShapeV1(item.preset);
""",
    """    input.root.dataset.illustroBrushTextureScale = String(textureScale);
    input.root.dataset.illustroBrushTextureRotationDegrees = String(textureRotationDegrees);
    input.root.dataset.illustroBrushTipShape = brushTipShapeV1(item.preset);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    const textureScale = brushTextureScaleV1(selected.preset);
    configurePair(textureScaleRange, textureScaleNumber, 1, 1600, 1, textureScale * 100);
    tipShape.value = brushTipShapeV1(selected.preset);
""",
    """    const textureScale = brushTextureScaleV1(selected.preset);
    configurePair(textureScaleRange, textureScaleNumber, 1, 1600, 1, textureScale * 100);
    const textureRotationDegrees = brushTextureRotationDegreesV1(selected.preset);
    configurePair(textureRotationRange, textureRotationNumber, 0, 359, 1, textureRotationDegrees);
    tipShape.value = brushTipShapeV1(selected.preset);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    const textureScaleLabel =
      textureScale !== 1 ? ` · TexScale${Math.round(textureScale * 100)}%` : '';
    propertyStatus.textContent = `${parameters.sizePx.toFixed(1)} px · ${Math.round(parameters.opacity * 100)}% · ${Math.round(parameters.flow * 100)}% · H${Math.round(hardness * 100)}% · D${Math.round(tipDensity * 100)}% · S${Math.round(spacing.spacingRatio * 100)}% · A${Math.round(tipAngleDegrees)}° · F${Math.round(tipDirectionDegrees)}°${followRotation ? ' · Follow' : ''}${repeatLabel}${startLabel}${endLabel}${sizeTaperLabel}${opacityTaperLabel}${forcedTaperLabel}${stabilizationLabel}${postCorrectionLabel}${grainLabel}${paperLabel}${textureStrengthLabel}${textureScaleLabel}`;
""",
    """    const textureScaleLabel =
      textureScale !== 1 ? ` · TexScale${Math.round(textureScale * 100)}%` : '';
    const textureRotationLabel =
      textureRotationDegrees !== 0 ? ` · TexRot${Math.round(textureRotationDegrees)}°` : '';
    propertyStatus.textContent = `${parameters.sizePx.toFixed(1)} px · ${Math.round(parameters.opacity * 100)}% · ${Math.round(parameters.flow * 100)}% · H${Math.round(hardness * 100)}% · D${Math.round(tipDensity * 100)}% · S${Math.round(spacing.spacingRatio * 100)}% · A${Math.round(tipAngleDegrees)}° · F${Math.round(tipDirectionDegrees)}°${followRotation ? ' · Follow' : ''}${repeatLabel}${startLabel}${endLabel}${sizeTaperLabel}${opacityTaperLabel}${forcedTaperLabel}${stabilizationLabel}${postCorrectionLabel}${grainLabel}${paperLabel}${textureStrengthLabel}${textureScaleLabel}${textureRotationLabel}`;
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """      textureScaleRange,
      textureScaleNumber,
      tipShape,
""",
    """      textureScaleRange,
      textureScaleNumber,
      textureRotationRange,
      textureRotationNumber,
      tipShape,
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  const onTextureScaleNumber = (): void => updateTextureScale(Number(textureScaleNumber.value));
  const onTipShape = (): void => {
""",
    """  const onTextureScaleNumber = (): void => updateTextureScale(Number(textureScaleNumber.value));
  const updateTextureRotation = (rotationDegrees: number): void =>
    mutate(() =>
      updateBrushPresetTextureRotationV1(state, state.selectedPresetId, rotationDegrees),
    );
  const onTextureRotationRange = (): void =>
    updateTextureRotation(Number(textureRotationRange.value));
  const onTextureRotationNumber = (): void =>
    updateTextureRotation(Number(textureRotationNumber.value));
  const onTipShape = (): void => {
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  textureScaleRange.addEventListener('input', onTextureScaleRange);
  textureScaleNumber.addEventListener('change', onTextureScaleNumber);
  tipShape.addEventListener('change', onTipShape);
""",
    """  textureScaleRange.addEventListener('input', onTextureScaleRange);
  textureScaleNumber.addEventListener('change', onTextureScaleNumber);
  textureRotationRange.addEventListener('input', onTextureRotationRange);
  textureRotationNumber.addEventListener('change', onTextureRotationNumber);
  tipShape.addEventListener('change', onTipShape);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """      textureScaleRange.removeEventListener('input', onTextureScaleRange);
      textureScaleNumber.removeEventListener('change', onTextureScaleNumber);
      tipShape.removeEventListener('change', onTipShape);
""",
    """      textureScaleRange.removeEventListener('input', onTextureScaleRange);
      textureScaleNumber.removeEventListener('change', onTextureScaleNumber);
      textureRotationRange.removeEventListener('input', onTextureRotationRange);
      textureRotationNumber.removeEventListener('change', onTextureRotationNumber);
      tipShape.removeEventListener('change', onTipShape);
""",
)

replace_once(
    'src/index.html',
    """              <div class=\"shell-brush-property-row\">
                <label for=\"brush-texture-scale-range\">テクスチャ倍率</label>
                <input id=\"brush-texture-scale-range\" type=\"range\" min=\"1\" max=\"1600\" step=\"1\" value=\"100\" />
                <span class=\"shell-brush-property-number shell-brush-property-percent\"><input id=\"brush-texture-scale-number\" type=\"number\" inputmode=\"numeric\" min=\"1\" max=\"1600\" step=\"1\" value=\"100\" aria-label=\"ブラシテクスチャ倍率\" /><span>%</span></span>
              </div>
              <div class=\"shell-brush-property-row shell-brush-tip-property-row\">
                <label for=\"brush-tip-shape\">ブラシ形状</label>
""",
    """              <div class=\"shell-brush-property-row\">
                <label for=\"brush-texture-scale-range\">テクスチャ倍率</label>
                <input id=\"brush-texture-scale-range\" type=\"range\" min=\"1\" max=\"1600\" step=\"1\" value=\"100\" />
                <span class=\"shell-brush-property-number shell-brush-property-percent\"><input id=\"brush-texture-scale-number\" type=\"number\" inputmode=\"numeric\" min=\"1\" max=\"1600\" step=\"1\" value=\"100\" aria-label=\"ブラシテクスチャ倍率\" /><span>%</span></span>
              </div>
              <div class=\"shell-brush-property-row\">
                <label for=\"brush-texture-rotation-range\">テクスチャ回転</label>
                <input id=\"brush-texture-rotation-range\" type=\"range\" min=\"0\" max=\"359\" step=\"1\" value=\"0\" />
                <span class=\"shell-brush-property-number\"><input id=\"brush-texture-rotation-number\" type=\"number\" inputmode=\"numeric\" min=\"0\" max=\"359\" step=\"1\" value=\"0\" aria-label=\"ブラシテクスチャ回転\" /><span>°</span></span>
              </div>
              <div class=\"shell-brush-property-row shell-brush-tip-property-row\">
                <label for=\"brush-tip-shape\">ブラシ形状</label>
""",
)

write_new(
    'tests/unit/brush-texture-rotation.test.ts',
    """import { describe, expect, it } from 'vitest';
import {
  brushTextureRotationDegreesV1,
  brushTextureScaleV1,
  brushTextureStrengthV1,
  createBaselineBrushPresetV1,
  withBrushPaperTextureResourceIdV1,
  withBrushTextureRotationDegreesV1,
  withBrushTextureScaleV1,
  withBrushTextureStrengthV1,
} from '../../src/domain/brush-schema.js';
import { PaintSessionControllerV1 } from '../../src/app/paint-session-controller.js';

class FakeRendererDocumentPort {
  async configureDocument(): Promise<void> {}
  async restoreBaselineStrokes(): Promise<void> {}
  async applyBaselineTilePatches(): Promise<void> {}
}

describe('M6A-039 texture rotation', () => {
  it('normalizes arbitrary finite degrees into the canonical 0..360 range', () => {
    const preset = createBaselineBrushPresetV1({
      id: 'texture.rotation',
      name: 'Texture Rotation',
      category: 'Test',
      behavior: 'paint',
    });
    expect(brushTextureRotationDegreesV1(preset)).toBe(0);
    expect(brushTextureRotationDegreesV1(withBrushTextureRotationDegreesV1(preset, 450))).toBe(90);
    expect(brushTextureRotationDegreesV1(withBrushTextureRotationDegreesV1(preset, -90))).toBe(270);
    expect(() => withBrushTextureRotationDegreesV1(preset, Number.NaN)).toThrow(TypeError);
    expect(withBrushTextureRotationDegreesV1(preset, 360).texture.rotationDegrees).toBeUndefined();
  });

  it('keeps rotation orthogonal to paper identity, strength, and scale', () => {
    const preset = withBrushTextureRotationDegreesV1(
      withBrushTextureScaleV1(
        withBrushTextureStrengthV1(
          withBrushPaperTextureResourceIdV1(
            createBaselineBrushPresetV1({
              id: 'texture.rotation.orthogonal',
              name: 'Texture Rotation Orthogonal',
              category: 'Test',
              behavior: 'paint',
            }),
            'builtin.grain.paper.08',
          ),
          0.4,
        ),
        3,
      ),
      135,
    );
    expect(brushTextureRotationDegreesV1(preset)).toBe(135);
    expect(brushTextureScaleV1(preset)).toBe(3);
    expect(brushTextureStrengthV1(preset)).toBe(0.4);
    expect(preset.texture.resourceSubtype).toBe('paper');
  });

  it('captures normalized texture rotation in runtime state', () => {
    const session = new PaintSessionControllerV1(new FakeRendererDocumentPort());
    expect(session.setBrushTextureRotationDegrees(-45)).toBe(315);
    expect(session.brushTextureRotationDegrees()).toBe(315);
    expect(session.snapshot().brushTextureRotationDegrees).toBe(315);
    expect(() => session.setBrushTextureRotationDegrees(Number.POSITIVE_INFINITY)).toThrow(TypeError);
  });
});""",
)

insert_before(
    'scripts/verify-m6a-brush.mjs',
    "requireText(\n  progress,\n  'M6A-PERF-001 incremental active-stroke rendering（stable prefix + bounded mutable tail）:未完了',",
    """requireText(progress, 'M6A-039 texture rotation:完了', 'M6A-039 progress is not complete');
requireText(
  read('src/domain/brush-schema.ts'),
  'brushTextureRotationDegreesV1',
  'texture-rotation preset helper missing',
);
requireText(
  read('src/app/paint-session-controller.ts'),
  'setBrushTextureRotationDegrees',
  'texture rotation is not connected to runtime state',
);
requireText(
  read('src/index.html'),
  'id=\"brush-texture-rotation-range\"',
  'reachable texture-rotation control missing',
);
requireText(
  read('tests/unit/brush-texture-rotation.test.ts'),
  'keeps rotation orthogonal to paper identity, strength, and scale',
  'texture rotation orthogonality regression missing',
);""",
)

replace_once(
    'IMPLEMENTATION_PROGRESS.md',
    'M6A-039 texture rotation:未完了\nM6A-040 texture blend behavior:未完了',
    """M6A-039 texture rotation:完了
再開メモ: M6A-039 texture rotationはBrushPresetV1.texture.rotationDegreesを有限degreeとして受け、0..360へ正規化して0°をidentity/defaultとしてfield省略可能にした。UIは0..359°、PaintSessionも同じ正規化済み値を保持し、resource subtype・strength・scaleから独立する。sampled payload未解決中はrotationだけでcanonical pixelsを変えず、M6A-071/073接続後にscaleと合成したsampling transformへ適用する。次はM6A-040 texture blend behaviorから再開する。
M6A-040 texture blend behavior:未完了""",
)
append_once(
    'ILLUSTRO_DESIGN_MEMO.md',
    '#### M6A texture-rotation boundary — 2026-09-03',
    """#### M6A texture-rotation boundary — 2026-09-03

- M6A-039 defines `BrushPresetV1.texture.rotationDegrees` as a finite degree value normalized into `[0, 360)`. `0°` is the exact identity/default and may be omitted from serialized preset data.
- Rotation is orthogonal to grain/paper resource identity, M6A-037 strength and M6A-038 scale. Runtime captures only the normalized value and active strokes are invalidated on configuration changes so one stroke cannot mix sampling transforms.
- No texture pixels are synthesized before M6A-071/073 resource loading. Once payloads are available, rotation composes with scale in the texture sampling transform; it does not rotate the brush tip geometry itself.
- M6A-040 owns the coverage-combination/blend rule and must not redefine strength, scale or rotation semantics.""",
)
