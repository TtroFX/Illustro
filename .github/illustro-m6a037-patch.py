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


# Canonical texture-strength parameter. Zero is the exact default/identity and is omitted on mutation.
insert_before(
    'src/domain/brush-schema.ts',
    "export type BrushTipSelectionModeV1 = 'fixed' | 'sequence' | 'random-per-stamp';",
    """export const DEFAULT_BRUSH_TEXTURE_STRENGTH_V1 = 0 as const;

export function brushTextureStrengthV1(preset: BrushPresetV1): number {
  const value = preset.texture.strength;
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1
    ? value
    : DEFAULT_BRUSH_TEXTURE_STRENGTH_V1;
}

export function withBrushTextureStrengthV1(
  preset: BrushPresetV1,
  strength: number,
): BrushPresetV1 {
  if (!Number.isFinite(strength) || strength < 0 || strength > 1) {
    throw new RangeError('brush texture strength must be within 0..1');
  }
  if (strength === DEFAULT_BRUSH_TEXTURE_STRENGTH_V1) {
    const { strength: _strength, ...texture } = preset.texture;
    return normalizeBrushPresetV1({ ...preset, texture });
  }
  return normalizeBrushPresetV1({
    ...preset,
    texture: { ...preset.texture, strength },
  });
}""",
)

# PaintSession captures the parameter separately from resource identity. No surrogate texture is rendered here.
replace_once(
    'src/app/paint-session-controller.ts',
    """  readonly brushTextureResourceSubtype: 'grain' | 'paper' | null;
  readonly brushTextureResourceId: string | null;
  readonly brushTipAngleDegrees: number;
""",
    """  readonly brushTextureResourceSubtype: 'grain' | 'paper' | null;
  readonly brushTextureResourceId: string | null;
  readonly brushTextureStrength: number;
  readonly brushTipAngleDegrees: number;
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """  #brushTextureResourceSubtype: 'grain' | 'paper' | null = null;
  #brushTextureResourceId: string | null = null;
  #brushTipAngleDegrees: number = BASELINE_BRUSH_TIP_ANGLE_DEGREES;
""",
    """  #brushTextureResourceSubtype: 'grain' | 'paper' | null = null;
  #brushTextureResourceId: string | null = null;
  #brushTextureStrength = 0;
  #brushTipAngleDegrees: number = BASELINE_BRUSH_TIP_ANGLE_DEGREES;
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """      brushTextureResourceSubtype: this.#brushTextureResourceSubtype,
      brushTextureResourceId: this.#brushTextureResourceId,
      brushTipAngleDegrees: this.#brushTipAngleDegrees,
""",
    """      brushTextureResourceSubtype: this.#brushTextureResourceSubtype,
      brushTextureResourceId: this.#brushTextureResourceId,
      brushTextureStrength: this.#brushTextureStrength,
      brushTipAngleDegrees: this.#brushTipAngleDegrees,
""",
)
insert_before(
    'src/app/paint-session-controller.ts',
    '  setBrushTipAngleDegrees(angleDegrees: number): number {',
    """  setBrushTextureStrength(strength: number): number {
    if (!Number.isFinite(strength) || strength < 0 || strength > 1) {
      throw new RangeError('invalid runtime brush texture strength');
    }
    if (strength !== this.#brushTextureStrength) this.#clearActiveStroke();
    this.#brushTextureStrength = strength;
    return this.#brushTextureStrength;
  }

  brushTextureStrength(): number {
    return this.#brushTextureStrength;
  }""",
)

# Preset-library mutation/persistence.
replace_once(
    'src/app/brush-preset-library.ts',
    """  withBrushGrainResourceIdV1,
  withBrushPaperTextureResourceIdV1,
  withBrushStrokeSpacingV1,
""",
    """  withBrushGrainResourceIdV1,
  withBrushPaperTextureResourceIdV1,
  withBrushTextureStrengthV1,
  withBrushStrokeSpacingV1,
""",
)
insert_before(
    'src/app/brush-preset-library.ts',
    'export function updateBrushPresetCustomTipV1(',
    """export function updateBrushPresetTextureStrengthV1(
  state: BrushPresetLibraryStateV1,
  presetId: string,
  strength: number,
): BrushPresetLibraryStateV1 {
  return updateItemV1(state, presetId, (item) => {
    if (item.locked) throw new Error('locked brush preset cannot be edited');
    const current = withBrushTextureStrengthV1(item.preset, strength);
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

# Brush Properties controller: preset -> runtime -> diagnostics and editable 0..100% pair.
replace_once(
    'src/app/brush-preset-controller.ts',
    """  brushGrainResourceIdV1,
  brushPaperTextureResourceIdV1,
  BUILTIN_BRUSH_GRAIN_RESOURCES_V1,
""",
    """  brushGrainResourceIdV1,
  brushPaperTextureResourceIdV1,
  brushTextureStrengthV1,
  BUILTIN_BRUSH_GRAIN_RESOURCES_V1,
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  updateBrushPresetGrainResourceV1,
  updateBrushPresetPaperTextureResourceV1,
  updateBrushPresetSpacingV1,
""",
    """  updateBrushPresetGrainResourceV1,
  updateBrushPresetPaperTextureResourceV1,
  updateBrushPresetTextureStrengthV1,
  updateBrushPresetSpacingV1,
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  const grainResource = requireElement('#brush-grain-resource', HTMLSelectElement);
  const paperResource = requireElement('#brush-paper-resource', HTMLSelectElement);
  const tipShape = requireElement('#brush-tip-shape', HTMLSelectElement);
""",
    """  const grainResource = requireElement('#brush-grain-resource', HTMLSelectElement);
  const paperResource = requireElement('#brush-paper-resource', HTMLSelectElement);
  const textureStrengthRange = requireElement('#brush-texture-strength-range', HTMLInputElement);
  const textureStrengthNumber = requireElement('#brush-texture-strength-number', HTMLInputElement);
  const tipShape = requireElement('#brush-tip-shape', HTMLSelectElement);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    if (paperResourceId !== null) {
      input.paintSession.setBrushPaperTextureResourceId(paperResourceId);
    } else {
      input.paintSession.setBrushGrainResourceId(grainResourceId);
    }
    const tipAssets = brushTipAssetsV1(item.preset);
""",
    """    if (paperResourceId !== null) {
      input.paintSession.setBrushPaperTextureResourceId(paperResourceId);
    } else {
      input.paintSession.setBrushGrainResourceId(grainResourceId);
    }
    const textureStrength = brushTextureStrengthV1(item.preset);
    input.paintSession.setBrushTextureStrength(textureStrength);
    const tipAssets = brushTipAssetsV1(item.preset);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    input.root.dataset.illustroBrushGrainResource = grainResourceId ?? '';
    input.root.dataset.illustroBrushPaperResource = paperResourceId ?? '';
    input.root.dataset.illustroBrushTipShape = brushTipShapeV1(item.preset);
""",
    """    input.root.dataset.illustroBrushGrainResource = grainResourceId ?? '';
    input.root.dataset.illustroBrushPaperResource = paperResourceId ?? '';
    input.root.dataset.illustroBrushTextureStrength = String(textureStrength);
    input.root.dataset.illustroBrushTipShape = brushTipShapeV1(item.preset);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    paperResource.value = paperResourceId ?? '';
    tipShape.value = brushTipShapeV1(selected.preset);
""",
    """    paperResource.value = paperResourceId ?? '';
    const textureStrength = brushTextureStrengthV1(selected.preset);
    configurePair(
      textureStrengthRange,
      textureStrengthNumber,
      0,
      100,
      1,
      textureStrength * 100,
    );
    tipShape.value = brushTipShapeV1(selected.preset);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    const paperLabel =
      paperResourceId === null ? '' : ` · Paper:${paperResourceId.split('.').at(-1) ?? 'custom'}`;
    propertyStatus.textContent = `${parameters.sizePx.toFixed(1)} px · ${Math.round(parameters.opacity * 100)}% · ${Math.round(parameters.flow * 100)}% · H${Math.round(hardness * 100)}% · D${Math.round(tipDensity * 100)}% · S${Math.round(spacing.spacingRatio * 100)}% · A${Math.round(tipAngleDegrees)}° · F${Math.round(tipDirectionDegrees)}°${followRotation ? ' · Follow' : ''}${repeatLabel}${startLabel}${endLabel}${sizeTaperLabel}${opacityTaperLabel}${forcedTaperLabel}${stabilizationLabel}${postCorrectionLabel}${grainLabel}${paperLabel}`;
""",
    """    const paperLabel =
      paperResourceId === null ? '' : ` · Paper:${paperResourceId.split('.').at(-1) ?? 'custom'}`;
    const textureStrengthLabel =
      textureStrength > 0 ? ` · Tex${Math.round(textureStrength * 100)}%` : '';
    propertyStatus.textContent = `${parameters.sizePx.toFixed(1)} px · ${Math.round(parameters.opacity * 100)}% · ${Math.round(parameters.flow * 100)}% · H${Math.round(hardness * 100)}% · D${Math.round(tipDensity * 100)}% · S${Math.round(spacing.spacingRatio * 100)}% · A${Math.round(tipAngleDegrees)}° · F${Math.round(tipDirectionDegrees)}°${followRotation ? ' · Follow' : ''}${repeatLabel}${startLabel}${endLabel}${sizeTaperLabel}${opacityTaperLabel}${forcedTaperLabel}${stabilizationLabel}${postCorrectionLabel}${grainLabel}${paperLabel}${textureStrengthLabel}`;
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """      grainResource,
      paperResource,
      tipShape,
""",
    """      grainResource,
      paperResource,
      textureStrengthRange,
      textureStrengthNumber,
      tipShape,
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  const onPaperResource = (): void =>
    mutate(() =>
      updateBrushPresetPaperTextureResourceV1(
        state,
        state.selectedPresetId,
        paperResource.value.length === 0 ? null : paperResource.value,
      ),
    );
  const onTipShape = (): void => {
""",
    """  const onPaperResource = (): void =>
    mutate(() =>
      updateBrushPresetPaperTextureResourceV1(
        state,
        state.selectedPresetId,
        paperResource.value.length === 0 ? null : paperResource.value,
      ),
    );
  const updateTextureStrength = (percent: number): void =>
    mutate(() =>
      updateBrushPresetTextureStrengthV1(state, state.selectedPresetId, percent / 100),
    );
  const onTextureStrengthRange = (): void =>
    updateTextureStrength(Number(textureStrengthRange.value));
  const onTextureStrengthNumber = (): void =>
    updateTextureStrength(Number(textureStrengthNumber.value));
  const onTipShape = (): void => {
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  grainResource.addEventListener('change', onGrainResource);
  paperResource.addEventListener('change', onPaperResource);
  tipShape.addEventListener('change', onTipShape);
""",
    """  grainResource.addEventListener('change', onGrainResource);
  paperResource.addEventListener('change', onPaperResource);
  textureStrengthRange.addEventListener('input', onTextureStrengthRange);
  textureStrengthNumber.addEventListener('change', onTextureStrengthNumber);
  tipShape.addEventListener('change', onTipShape);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """      grainResource.removeEventListener('change', onGrainResource);
      paperResource.removeEventListener('change', onPaperResource);
      tipShape.removeEventListener('change', onTipShape);
""",
    """      grainResource.removeEventListener('change', onGrainResource);
      paperResource.removeEventListener('change', onPaperResource);
      textureStrengthRange.removeEventListener('input', onTextureStrengthRange);
      textureStrengthNumber.removeEventListener('change', onTextureStrengthNumber);
      tipShape.removeEventListener('change', onTipShape);
""",
)

# Reachable control adjacent to the single texture resource selectors.
replace_once(
    'src/index.html',
    """              <div class=\"shell-brush-property-row shell-brush-tip-property-row\">
                <label for=\"brush-paper-resource\">紙テクスチャ</label>
                <select id=\"brush-paper-resource\" aria-label=\"ブラシ紙テクスチャ\"><option value=\"\">なし</option></select>
                <span class=\"shell-brush-tip-kind\">Paper</span>
              </div>
              <div class=\"shell-brush-property-row shell-brush-tip-property-row\">
                <label for=\"brush-tip-shape\">ブラシ形状</label>
""",
    """              <div class=\"shell-brush-property-row shell-brush-tip-property-row\">
                <label for=\"brush-paper-resource\">紙テクスチャ</label>
                <select id=\"brush-paper-resource\" aria-label=\"ブラシ紙テクスチャ\"><option value=\"\">なし</option></select>
                <span class=\"shell-brush-tip-kind\">Paper</span>
              </div>
              <div class=\"shell-brush-property-row\">
                <label for=\"brush-texture-strength-range\">テクスチャ強度</label>
                <input id=\"brush-texture-strength-range\" type=\"range\" min=\"0\" max=\"100\" step=\"1\" value=\"0\" />
                <span class=\"shell-brush-property-number shell-brush-property-percent\"><input id=\"brush-texture-strength-number\" type=\"number\" inputmode=\"numeric\" min=\"0\" max=\"100\" step=\"1\" value=\"0\" aria-label=\"ブラシテクスチャ強度\" /><span>%</span></span>
              </div>
              <div class=\"shell-brush-property-row shell-brush-tip-property-row\">
                <label for=\"brush-tip-shape\">ブラシ形状</label>
""",
)

write_new(
    'tests/unit/brush-texture-strength.test.ts',
    """import { describe, expect, it } from 'vitest';
import {
  brushGrainResourceIdV1,
  brushPaperTextureResourceIdV1,
  brushTextureStrengthV1,
  createBaselineBrushPresetV1,
  withBrushGrainResourceIdV1,
  withBrushPaperTextureResourceIdV1,
  withBrushTextureStrengthV1,
} from '../../src/domain/brush-schema.js';
import { PaintSessionControllerV1 } from '../../src/app/paint-session-controller.js';

class FakeRendererDocumentPort {
  async configureDocument(): Promise<void> {}
  async restoreBaselineStrokes(): Promise<void> {}
  async applyBaselineTilePatches(): Promise<void> {}
}

describe('M6A-037 texture strength', () => {
  it('keeps zero as the exact default and validates the canonical 0..1 amount', () => {
    const preset = createBaselineBrushPresetV1({
      id: 'texture.strength',
      name: 'Texture Strength',
      category: 'Test',
      behavior: 'paint',
    });
    expect(brushTextureStrengthV1(preset)).toBe(0);
    const strengthened = withBrushTextureStrengthV1(preset, 0.65);
    expect(brushTextureStrengthV1(strengthened)).toBe(0.65);
    expect(() => withBrushTextureStrengthV1(preset, -0.01)).toThrow(RangeError);
    expect(() => withBrushTextureStrengthV1(preset, 1.01)).toThrow(RangeError);
    const reset = withBrushTextureStrengthV1(strengthened, 0);
    expect(brushTextureStrengthV1(reset)).toBe(0);
    expect(reset.texture.strength).toBeUndefined();
  });

  it('preserves strength while the single texture slot switches between grain and paper', () => {
    const preset = withBrushTextureStrengthV1(
      createBaselineBrushPresetV1({
        id: 'texture.switch',
        name: 'Texture Switch',
        category: 'Test',
        behavior: 'paint',
      }),
      0.42,
    );
    const grain = withBrushGrainResourceIdV1(preset, 'builtin.grain.rough.02');
    expect(brushGrainResourceIdV1(grain)).toBe('builtin.grain.rough.02');
    expect(brushTextureStrengthV1(grain)).toBe(0.42);
    const paper = withBrushPaperTextureResourceIdV1(grain, 'builtin.grain.paper.03');
    expect(brushGrainResourceIdV1(paper)).toBeNull();
    expect(brushPaperTextureResourceIdV1(paper)).toBe('builtin.grain.paper.03');
    expect(brushTextureStrengthV1(paper)).toBe(0.42);
  });

  it('captures strength independently from resource identity in runtime state', () => {
    const session = new PaintSessionControllerV1(new FakeRendererDocumentPort());
    session.setBrushPaperTextureResourceId('builtin.grain.paper.01');
    session.setBrushTextureStrength(0.5);
    expect(session.brushTextureStrength()).toBe(0.5);
    expect(session.snapshot()).toMatchObject({
      brushTextureResourceKind: 'grain',
      brushTextureResourceSubtype: 'paper',
      brushTextureResourceId: 'builtin.grain.paper.01',
      brushTextureStrength: 0.5,
    });
    expect(() => session.setBrushTextureStrength(Number.NaN)).toThrow(RangeError);
  });
});""",
)

# Verification gate.
insert_before(
    'scripts/verify-m6a-brush.mjs',
    "requireText(\n  progress,\n  'M6A-PERF-001 incremental active-stroke rendering（stable prefix + bounded mutable tail）:未完了',",
    """requireText(progress, 'M6A-037 texture strength:完了', 'M6A-037 progress is not complete');
requireText(
  read('src/domain/brush-schema.ts'),
  'brushTextureStrengthV1',
  'texture-strength preset helper missing',
);
requireText(
  read('src/app/paint-session-controller.ts'),
  'setBrushTextureStrength',
  'texture strength is not connected to runtime state',
);
requireText(
  read('src/index.html'),
  'id=\"brush-texture-strength-range\"',
  'reachable texture-strength control missing',
);
requireText(
  read('tests/unit/brush-texture-strength.test.ts'),
  'preserves strength while the single texture slot switches between grain and paper',
  'texture strength/resource-identity regression missing',
);""",
)

# Progress and canonical design boundary.
replace_once(
    'IMPLEMENTATION_PROGRESS.md',
    'M6A-037 texture strength:未完了\nM6A-038 texture scale:未完了',
    """M6A-037 texture strength:完了
再開メモ: M6A-037 texture strengthはBrushPresetV1.texture.strengthを0..1で保持し、0をexact identity/defaultとしてfield自体を省略可能にした。grain/paperのsingle texture resource slotとは独立parameterとしてpreset persistence・PaintSession snapshot・Brush Propertiesへ接続し、resource subtypeを切替えてもstrengthを保持する。I-FINAL sampled grain/paper payloadはM6A-071/073でロードされるため、この段階では仮procedural textureをcanonical Rasterへ焼き込まず、strength>0でもpayload未解決なら描画結果を変えない。実payload接続後は同じstrengthをcoverage modulationの正本として使う。次はM6A-038 texture scaleから再開する。
M6A-038 texture scale:未完了""",
)
append_once(
    'ILLUSTRO_DESIGN_MEMO.md',
    '#### M6A texture-strength boundary — 2026-09-03',
    """#### M6A texture-strength boundary — 2026-09-03

- M6A-037 defines `BrushPresetV1.texture.strength` as a canonical finite `0..1` amount shared by the single active grain/paper texture slot. `0` is the exact identity/default and may be omitted from serialized preset data.
- Strength is independent from texture resource identity and subtype. Switching between ordinary grain and paper preserves the amount; selecting no resource may also retain it for later reuse.
- M6A-037 does **not** synthesize a surrogate procedural texture. Until M6A-071/073 resolves the accepted sampled grain/paper payload, nonzero strength is stored/runtime-visible but must not alter canonical raster pixels. This prevents saved strokes from changing meaning when the real resource loader arrives.
- Once a texture payload is resolved, this same strength value is the modulation-depth authority. M6A-038, M6A-039 and M6A-040 own scale, rotation and combination/blend behavior respectively and must remain orthogonal to strength.""",
)
