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
    """export const DEFAULT_BRUSH_TEXTURE_SCALE_V1 = 1 as const;
export const MIN_BRUSH_TEXTURE_SCALE_V1 = 0.01 as const;
export const MAX_BRUSH_TEXTURE_SCALE_V1 = 16 as const;

export function brushTextureScaleV1(preset: BrushPresetV1): number {
  const value = preset.texture.scale;
  return typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= MIN_BRUSH_TEXTURE_SCALE_V1 &&
    value <= MAX_BRUSH_TEXTURE_SCALE_V1
    ? value
    : DEFAULT_BRUSH_TEXTURE_SCALE_V1;
}

export function withBrushTextureScaleV1(preset: BrushPresetV1, scale: number): BrushPresetV1 {
  if (
    !Number.isFinite(scale) ||
    scale < MIN_BRUSH_TEXTURE_SCALE_V1 ||
    scale > MAX_BRUSH_TEXTURE_SCALE_V1
  ) {
    throw new RangeError('brush texture scale must be within 0.01..16');
  }
  if (scale === DEFAULT_BRUSH_TEXTURE_SCALE_V1) {
    const { scale: _scale, ...texture } = preset.texture;
    return normalizeBrushPresetV1({ ...preset, texture });
  }
  return normalizeBrushPresetV1({
    ...preset,
    texture: { ...preset.texture, scale },
  });
}""",
)

replace_once(
    'src/app/paint-session-controller.ts',
    """  readonly brushTextureResourceId: string | null;
  readonly brushTextureStrength: number;
  readonly brushTipAngleDegrees: number;
""",
    """  readonly brushTextureResourceId: string | null;
  readonly brushTextureStrength: number;
  readonly brushTextureScale: number;
  readonly brushTipAngleDegrees: number;
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """  #brushTextureResourceId: string | null = null;
  #brushTextureStrength = 0;
  #brushTipAngleDegrees: number = BASELINE_BRUSH_TIP_ANGLE_DEGREES;
""",
    """  #brushTextureResourceId: string | null = null;
  #brushTextureStrength = 0;
  #brushTextureScale = 1;
  #brushTipAngleDegrees: number = BASELINE_BRUSH_TIP_ANGLE_DEGREES;
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """      brushTextureResourceId: this.#brushTextureResourceId,
      brushTextureStrength: this.#brushTextureStrength,
      brushTipAngleDegrees: this.#brushTipAngleDegrees,
""",
    """      brushTextureResourceId: this.#brushTextureResourceId,
      brushTextureStrength: this.#brushTextureStrength,
      brushTextureScale: this.#brushTextureScale,
      brushTipAngleDegrees: this.#brushTipAngleDegrees,
""",
)
insert_before(
    'src/app/paint-session-controller.ts',
    '  setBrushTipAngleDegrees(angleDegrees: number): number {',
    """  setBrushTextureScale(scale: number): number {
    if (!Number.isFinite(scale) || scale < 0.01 || scale > 16) {
      throw new RangeError('invalid runtime brush texture scale');
    }
    if (scale !== this.#brushTextureScale) this.#clearActiveStroke();
    this.#brushTextureScale = scale;
    return this.#brushTextureScale;
  }

  brushTextureScale(): number {
    return this.#brushTextureScale;
  }""",
)

replace_once(
    'src/app/brush-preset-library.ts',
    """  withBrushPaperTextureResourceIdV1,
  withBrushTextureStrengthV1,
  withBrushStrokeSpacingV1,
""",
    """  withBrushPaperTextureResourceIdV1,
  withBrushTextureStrengthV1,
  withBrushTextureScaleV1,
  withBrushStrokeSpacingV1,
""",
)
insert_before(
    'src/app/brush-preset-library.ts',
    'export function updateBrushPresetCustomTipV1(',
    """export function updateBrushPresetTextureScaleV1(
  state: BrushPresetLibraryStateV1,
  presetId: string,
  scale: number,
): BrushPresetLibraryStateV1 {
  return updateItemV1(state, presetId, (item) => {
    if (item.locked) throw new Error('locked brush preset cannot be edited');
    const current = withBrushTextureScaleV1(item.preset, scale);
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
    """  brushPaperTextureResourceIdV1,
  brushTextureStrengthV1,
  BUILTIN_BRUSH_GRAIN_RESOURCES_V1,
""",
    """  brushPaperTextureResourceIdV1,
  brushTextureStrengthV1,
  brushTextureScaleV1,
  BUILTIN_BRUSH_GRAIN_RESOURCES_V1,
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  updateBrushPresetPaperTextureResourceV1,
  updateBrushPresetTextureStrengthV1,
  updateBrushPresetSpacingV1,
""",
    """  updateBrushPresetPaperTextureResourceV1,
  updateBrushPresetTextureStrengthV1,
  updateBrushPresetTextureScaleV1,
  updateBrushPresetSpacingV1,
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  const textureStrengthRange = requireElement('#brush-texture-strength-range', HTMLInputElement);
  const textureStrengthNumber = requireElement('#brush-texture-strength-number', HTMLInputElement);
  const tipShape = requireElement('#brush-tip-shape', HTMLSelectElement);
""",
    """  const textureStrengthRange = requireElement('#brush-texture-strength-range', HTMLInputElement);
  const textureStrengthNumber = requireElement('#brush-texture-strength-number', HTMLInputElement);
  const textureScaleRange = requireElement('#brush-texture-scale-range', HTMLInputElement);
  const textureScaleNumber = requireElement('#brush-texture-scale-number', HTMLInputElement);
  const tipShape = requireElement('#brush-tip-shape', HTMLSelectElement);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    const textureStrength = brushTextureStrengthV1(item.preset);
    input.paintSession.setBrushTextureStrength(textureStrength);
    const tipAssets = brushTipAssetsV1(item.preset);
""",
    """    const textureStrength = brushTextureStrengthV1(item.preset);
    input.paintSession.setBrushTextureStrength(textureStrength);
    const textureScale = brushTextureScaleV1(item.preset);
    input.paintSession.setBrushTextureScale(textureScale);
    const tipAssets = brushTipAssetsV1(item.preset);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    input.root.dataset.illustroBrushTextureStrength = String(textureStrength);
    input.root.dataset.illustroBrushTipShape = brushTipShapeV1(item.preset);
""",
    """    input.root.dataset.illustroBrushTextureStrength = String(textureStrength);
    input.root.dataset.illustroBrushTextureScale = String(textureScale);
    input.root.dataset.illustroBrushTipShape = brushTipShapeV1(item.preset);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    const textureStrength = brushTextureStrengthV1(selected.preset);
    configurePair(textureStrengthRange, textureStrengthNumber, 0, 100, 1, textureStrength * 100);
    tipShape.value = brushTipShapeV1(selected.preset);
""",
    """    const textureStrength = brushTextureStrengthV1(selected.preset);
    configurePair(textureStrengthRange, textureStrengthNumber, 0, 100, 1, textureStrength * 100);
    const textureScale = brushTextureScaleV1(selected.preset);
    configurePair(textureScaleRange, textureScaleNumber, 1, 1600, 1, textureScale * 100);
    tipShape.value = brushTipShapeV1(selected.preset);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    const textureStrengthLabel =
      textureStrength > 0 ? ` · Tex${Math.round(textureStrength * 100)}%` : '';
    propertyStatus.textContent = `${parameters.sizePx.toFixed(1)} px · ${Math.round(parameters.opacity * 100)}% · ${Math.round(parameters.flow * 100)}% · H${Math.round(hardness * 100)}% · D${Math.round(tipDensity * 100)}% · S${Math.round(spacing.spacingRatio * 100)}% · A${Math.round(tipAngleDegrees)}° · F${Math.round(tipDirectionDegrees)}°${followRotation ? ' · Follow' : ''}${repeatLabel}${startLabel}${endLabel}${sizeTaperLabel}${opacityTaperLabel}${forcedTaperLabel}${stabilizationLabel}${postCorrectionLabel}${grainLabel}${paperLabel}${textureStrengthLabel}`;
""",
    """    const textureStrengthLabel =
      textureStrength > 0 ? ` · Tex${Math.round(textureStrength * 100)}%` : '';
    const textureScaleLabel =
      textureScale !== 1 ? ` · TexScale${Math.round(textureScale * 100)}%` : '';
    propertyStatus.textContent = `${parameters.sizePx.toFixed(1)} px · ${Math.round(parameters.opacity * 100)}% · ${Math.round(parameters.flow * 100)}% · H${Math.round(hardness * 100)}% · D${Math.round(tipDensity * 100)}% · S${Math.round(spacing.spacingRatio * 100)}% · A${Math.round(tipAngleDegrees)}° · F${Math.round(tipDirectionDegrees)}°${followRotation ? ' · Follow' : ''}${repeatLabel}${startLabel}${endLabel}${sizeTaperLabel}${opacityTaperLabel}${forcedTaperLabel}${stabilizationLabel}${postCorrectionLabel}${grainLabel}${paperLabel}${textureStrengthLabel}${textureScaleLabel}`;
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """      textureStrengthRange,
      textureStrengthNumber,
      tipShape,
""",
    """      textureStrengthRange,
      textureStrengthNumber,
      textureScaleRange,
      textureScaleNumber,
      tipShape,
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  const onTextureStrengthNumber = (): void =>
    updateTextureStrength(Number(textureStrengthNumber.value));
  const onTipShape = (): void => {
""",
    """  const onTextureStrengthNumber = (): void =>
    updateTextureStrength(Number(textureStrengthNumber.value));
  const updateTextureScale = (percent: number): void =>
    mutate(() => updateBrushPresetTextureScaleV1(state, state.selectedPresetId, percent / 100));
  const onTextureScaleRange = (): void => updateTextureScale(Number(textureScaleRange.value));
  const onTextureScaleNumber = (): void => updateTextureScale(Number(textureScaleNumber.value));
  const onTipShape = (): void => {
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  textureStrengthRange.addEventListener('input', onTextureStrengthRange);
  textureStrengthNumber.addEventListener('change', onTextureStrengthNumber);
  tipShape.addEventListener('change', onTipShape);
""",
    """  textureStrengthRange.addEventListener('input', onTextureStrengthRange);
  textureStrengthNumber.addEventListener('change', onTextureStrengthNumber);
  textureScaleRange.addEventListener('input', onTextureScaleRange);
  textureScaleNumber.addEventListener('change', onTextureScaleNumber);
  tipShape.addEventListener('change', onTipShape);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """      textureStrengthRange.removeEventListener('input', onTextureStrengthRange);
      textureStrengthNumber.removeEventListener('change', onTextureStrengthNumber);
      tipShape.removeEventListener('change', onTipShape);
""",
    """      textureStrengthRange.removeEventListener('input', onTextureStrengthRange);
      textureStrengthNumber.removeEventListener('change', onTextureStrengthNumber);
      textureScaleRange.removeEventListener('input', onTextureScaleRange);
      textureScaleNumber.removeEventListener('change', onTextureScaleNumber);
      tipShape.removeEventListener('change', onTipShape);
""",
)

replace_once(
    'src/index.html',
    """              <div class=\"shell-brush-property-row\">
                <label for=\"brush-texture-strength-range\">テクスチャ強度</label>
                <input id=\"brush-texture-strength-range\" type=\"range\" min=\"0\" max=\"100\" step=\"1\" value=\"0\" />
                <span class=\"shell-brush-property-number shell-brush-property-percent\"><input id=\"brush-texture-strength-number\" type=\"number\" inputmode=\"numeric\" min=\"0\" max=\"100\" step=\"1\" value=\"0\" aria-label=\"ブラシテクスチャ強度\" /><span>%</span></span>
              </div>
              <div class=\"shell-brush-property-row shell-brush-tip-property-row\">
                <label for=\"brush-tip-shape\">ブラシ形状</label>
""",
    """              <div class=\"shell-brush-property-row\">
                <label for=\"brush-texture-strength-range\">テクスチャ強度</label>
                <input id=\"brush-texture-strength-range\" type=\"range\" min=\"0\" max=\"100\" step=\"1\" value=\"0\" />
                <span class=\"shell-brush-property-number shell-brush-property-percent\"><input id=\"brush-texture-strength-number\" type=\"number\" inputmode=\"numeric\" min=\"0\" max=\"100\" step=\"1\" value=\"0\" aria-label=\"ブラシテクスチャ強度\" /><span>%</span></span>
              </div>
              <div class=\"shell-brush-property-row\">
                <label for=\"brush-texture-scale-range\">テクスチャ倍率</label>
                <input id=\"brush-texture-scale-range\" type=\"range\" min=\"1\" max=\"1600\" step=\"1\" value=\"100\" />
                <span class=\"shell-brush-property-number shell-brush-property-percent\"><input id=\"brush-texture-scale-number\" type=\"number\" inputmode=\"numeric\" min=\"1\" max=\"1600\" step=\"1\" value=\"100\" aria-label=\"ブラシテクスチャ倍率\" /><span>%</span></span>
              </div>
              <div class=\"shell-brush-property-row shell-brush-tip-property-row\">
                <label for=\"brush-tip-shape\">ブラシ形状</label>
""",
)

write_new(
    'tests/unit/brush-texture-scale.test.ts',
    """import { describe, expect, it } from 'vitest';
import {
  brushTextureScaleV1,
  brushTextureStrengthV1,
  createBaselineBrushPresetV1,
  withBrushPaperTextureResourceIdV1,
  withBrushTextureScaleV1,
  withBrushTextureStrengthV1,
} from '../../src/domain/brush-schema.js';
import { PaintSessionControllerV1 } from '../../src/app/paint-session-controller.js';

class FakeRendererDocumentPort {
  async configureDocument(): Promise<void> {}
  async restoreBaselineStrokes(): Promise<void> {}
  async applyBaselineTilePatches(): Promise<void> {}
}

describe('M6A-038 texture scale', () => {
  it('uses one as the canonical identity and validates 0.01..16x', () => {
    const preset = createBaselineBrushPresetV1({
      id: 'texture.scale',
      name: 'Texture Scale',
      category: 'Test',
      behavior: 'paint',
    });
    expect(brushTextureScaleV1(preset)).toBe(1);
    const scaled = withBrushTextureScaleV1(preset, 2.5);
    expect(brushTextureScaleV1(scaled)).toBe(2.5);
    expect(() => withBrushTextureScaleV1(preset, 0)).toThrow(RangeError);
    expect(() => withBrushTextureScaleV1(preset, 16.01)).toThrow(RangeError);
    const reset = withBrushTextureScaleV1(scaled, 1);
    expect(reset.texture.scale).toBeUndefined();
  });

  it('keeps scale orthogonal to resource subtype and strength', () => {
    const preset = withBrushTextureScaleV1(
      withBrushTextureStrengthV1(
        withBrushPaperTextureResourceIdV1(
          createBaselineBrushPresetV1({
            id: 'texture.orthogonal',
            name: 'Texture Orthogonal',
            category: 'Test',
            behavior: 'paint',
          }),
          'builtin.grain.paper.05',
        ),
        0.7,
      ),
      0.25,
    );
    expect(brushTextureScaleV1(preset)).toBe(0.25);
    expect(brushTextureStrengthV1(preset)).toBe(0.7);
    expect(preset.texture.resourceSubtype).toBe('paper');
  });

  it('captures scale in runtime state without inventing a texture payload', () => {
    const session = new PaintSessionControllerV1(new FakeRendererDocumentPort());
    session.setBrushTextureScale(4);
    expect(session.brushTextureScale()).toBe(4);
    expect(session.snapshot().brushTextureScale).toBe(4);
    expect(() => session.setBrushTextureScale(0.001)).toThrow(RangeError);
  });
});""",
)

insert_before(
    'scripts/verify-m6a-brush.mjs',
    "requireText(\n  progress,\n  'M6A-PERF-001 incremental active-stroke rendering（stable prefix + bounded mutable tail）:未完了',",
    """requireText(progress, 'M6A-038 texture scale:完了', 'M6A-038 progress is not complete');
requireText(
  read('src/domain/brush-schema.ts'),
  'brushTextureScaleV1',
  'texture-scale preset helper missing',
);
requireText(
  read('src/app/paint-session-controller.ts'),
  'setBrushTextureScale',
  'texture scale is not connected to runtime state',
);
requireText(
  read('src/index.html'),
  'id=\"brush-texture-scale-range\"',
  'reachable texture-scale control missing',
);
requireText(
  read('tests/unit/brush-texture-scale.test.ts'),
  'keeps scale orthogonal to resource subtype and strength',
  'texture scale orthogonality regression missing',
);""",
)

replace_once(
    'IMPLEMENTATION_PROGRESS.md',
    'M6A-038 texture scale:未完了\nM6A-039 texture rotation:未完了',
    """M6A-038 texture scale:完了
再開メモ: M6A-038 texture scaleはBrushPresetV1.texture.scaleをtexture-space倍率として0.01..16で保持し、1.0をidentity/defaultとしてfield省略可能にした。UIは1..1600%で編集し、grain/paper resource identity・strengthとは独立にpreset persistenceとPaintSession snapshotへcaptureする。M6A-071/073のsampled payloadが未解決な間はscaleだけで描画結果を変えず、実payload接続後に同じ倍率をsampling transformへ適用する。次はM6A-039 texture rotationから再開する。
M6A-039 texture rotation:未完了""",
)
append_once(
    'ILLUSTRO_DESIGN_MEMO.md',
    '#### M6A texture-scale boundary — 2026-09-03',
    """#### M6A texture-scale boundary — 2026-09-03

- M6A-038 defines `BrushPresetV1.texture.scale` as a texture-space multiplier in the finite range `0.01..16`. `1` is the exact identity/default and may be omitted from serialized preset data.
- Scale is orthogonal to resource identity/subtype and M6A-037 strength. Switching grain/paper resources must not silently reset it.
- The Brush Properties UI exposes the same range as `1..1600%`. Runtime captures the multiplier at brush-configuration time and changing it invalidates an active stroke so one stroke cannot mix sampling transforms.
- As with strength, M6A-038 does not invent a surrogate texture before M6A-071/073 resolves the accepted sampled resource. When payload loading is connected, this multiplier becomes the sampling-scale authority without changing stored parameter semantics.""",
)
