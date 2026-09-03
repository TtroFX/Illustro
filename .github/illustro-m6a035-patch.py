from pathlib import Path


def read(path: str) -> str:
    return Path(path).read_text(encoding='utf-8')


def write(path: str, content: str) -> None:
    Path(path).write_text(content, encoding='utf-8')


def replace_once(path: str, before: str, after: str) -> None:
    source = read(path)
    count = source.count(before)
    if count != 1:
        raise RuntimeError(f'{path}: expected one replacement, found {count}: {before[:160]!r}')
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


# Canonical grain aliases mirror the final non-paper I inventory counts.
insert_before(
    'src/domain/brush-schema.ts',
    'export type BrushTipSelectionModeV1 =',
    """export type BrushBuiltinGrainFamilyV1 = 'fine' | 'rough' | 'fiber' | 'canvas';

export interface BrushBuiltinGrainResourceV1 {
  readonly id: string;
  readonly name: string;
  readonly family: BrushBuiltinGrainFamilyV1;
}

function builtinGrainFamilyV1(
  family: BrushBuiltinGrainFamilyV1,
  count: number,
): readonly BrushBuiltinGrainResourceV1[] {
  return Object.freeze(
    Array.from({ length: count }, (_, index) => {
      const number = String(index + 1).padStart(2, '0');
      return Object.freeze({
        id: `builtin.grain.${family}.${number}`,
        name: `${family[0]?.toUpperCase() ?? ''}${family.slice(1)} ${number}`,
        family,
      });
    }),
  );
}

export const BUILTIN_BRUSH_GRAIN_RESOURCES_V1: readonly BrushBuiltinGrainResourceV1[] =
  Object.freeze([
    ...builtinGrainFamilyV1('fine', 6),
    ...builtinGrainFamilyV1('rough', 6),
    ...builtinGrainFamilyV1('fiber', 5),
    ...builtinGrainFamilyV1('canvas', 3),
  ]);

function normalizedBrushTextureResourceIdV1(value: unknown): string {
  if (typeof value !== 'string') throw new TypeError('brush texture resource id must be text');
  const normalized = value.trim();
  if (normalized.length < 1 || normalized.length > 160) {
    throw new RangeError('brush texture resource id must be 1..160 characters');
  }
  return normalized;
}

export function brushGrainResourceIdV1(preset: BrushPresetV1): string | null {
  const kind = preset.texture.resourceKind;
  const resourceId = preset.texture.resourceId;
  if (kind === undefined && resourceId === undefined) return null;
  if (kind !== 'grain') return null;
  return normalizedBrushTextureResourceIdV1(resourceId);
}

export function withBrushGrainResourceIdV1(
  preset: BrushPresetV1,
  resourceId: string | null,
): BrushPresetV1 {
  if (resourceId === null) {
    if (preset.texture.resourceKind !== 'grain') return preset;
    const { resourceId: _resourceId, resourceKind: _resourceKind, ...rest } = preset.texture;
    return normalizeBrushPresetV1({ ...preset, texture: rest });
  }
  const normalized = normalizedBrushTextureResourceIdV1(resourceId);
  return normalizeBrushPresetV1({
    ...preset,
    texture: { ...preset.texture, resourceKind: 'grain', resourceId: normalized },
  });
}""",
)

# Runtime session stores the selected texture identity even though sampling/strength arrive in later M6A items.
replace_once(
    'src/app/paint-session-controller.ts',
    """  readonly brushPostStrokeCorrectionAmount: number;
  readonly brushTipAngleDegrees: number;
""",
    """  readonly brushPostStrokeCorrectionAmount: number;
  readonly brushTextureResourceKind: 'grain' | null;
  readonly brushTextureResourceId: string | null;
  readonly brushTipAngleDegrees: number;
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """  #brushPostStrokeCorrectionAmount = 0;
  #brushTipAngleDegrees: number = BASELINE_BRUSH_TIP_ANGLE_DEGREES;
""",
    """  #brushPostStrokeCorrectionAmount = 0;
  #brushTextureResourceKind: 'grain' | null = null;
  #brushTextureResourceId: string | null = null;
  #brushTipAngleDegrees: number = BASELINE_BRUSH_TIP_ANGLE_DEGREES;
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """      brushPostStrokeCorrectionAmount: this.#brushPostStrokeCorrectionAmount,
      brushTipAngleDegrees: this.#brushTipAngleDegrees,
""",
    """      brushPostStrokeCorrectionAmount: this.#brushPostStrokeCorrectionAmount,
      brushTextureResourceKind: this.#brushTextureResourceKind,
      brushTextureResourceId: this.#brushTextureResourceId,
      brushTipAngleDegrees: this.#brushTipAngleDegrees,
""",
)
insert_before(
    'src/app/paint-session-controller.ts',
    '  setBrushTipAngleDegrees(angleDegrees: number): number {\n',
    """  setBrushGrainResourceId(resourceId: string | null): string | null {
    const normalized =
      resourceId === null
        ? null
        : (() => {
            if (typeof resourceId !== 'string') throw new TypeError('runtime grain resource id must be text');
            const value = resourceId.trim();
            if (value.length < 1 || value.length > 160) {
              throw new RangeError('runtime grain resource id must be 1..160 characters');
            }
            return value;
          })();
    if (
      this.#brushTextureResourceKind !== (normalized === null ? null : 'grain') ||
      this.#brushTextureResourceId !== normalized
    ) {
      this.#clearActiveStroke();
    }
    this.#brushTextureResourceKind = normalized === null ? null : 'grain';
    this.#brushTextureResourceId = normalized;
    return this.#brushTextureResourceId;
  }

  brushGrainResourceId(): string | null {
    return this.#brushTextureResourceKind === 'grain' ? this.#brushTextureResourceId : null;
  }""",
)

# Preset library mutation.
replace_once(
    'src/app/brush-preset-library.ts',
    """  withBrushPostStrokeCorrectionAmountV1,
  withBrushStrokeSpacingV1,
""",
    """  withBrushPostStrokeCorrectionAmountV1,
  withBrushGrainResourceIdV1,
  withBrushStrokeSpacingV1,
""",
)
insert_before(
    'src/app/brush-preset-library.ts',
    'export function updateBrushPresetCustomTipV1(\n',
    """export function updateBrushPresetGrainResourceV1(
  state: BrushPresetLibraryStateV1,
  presetId: string,
  resourceId: string | null,
): BrushPresetLibraryStateV1 {
  return updateItemV1(state, presetId, (item) => {
    if (item.locked) throw new Error('locked brush preset cannot be edited');
    const current = withBrushGrainResourceIdV1(item.preset, resourceId);
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

# Preset controller and UI.
replace_once(
    'src/app/brush-preset-controller.ts',
    """  brushPostStrokeCorrectionAmountV1,
  brushStrokeSpacingV1,
""",
    """  brushPostStrokeCorrectionAmountV1,
  brushGrainResourceIdV1,
  BUILTIN_BRUSH_GRAIN_RESOURCES_V1,
  brushStrokeSpacingV1,
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  updateBrushPresetPostStrokeCorrectionV1,
  updateBrushPresetSpacingV1,
""",
    """  updateBrushPresetPostStrokeCorrectionV1,
  updateBrushPresetGrainResourceV1,
  updateBrushPresetSpacingV1,
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  const postCorrectionRange = requireElement('#brush-post-correction-range', HTMLInputElement);
  const postCorrectionNumber = requireElement('#brush-post-correction-number', HTMLInputElement);
  const tipShape = requireElement('#brush-tip-shape', HTMLSelectElement);
""",
    """  const postCorrectionRange = requireElement('#brush-post-correction-range', HTMLInputElement);
  const postCorrectionNumber = requireElement('#brush-post-correction-number', HTMLInputElement);
  const grainResource = requireElement('#brush-grain-resource', HTMLSelectElement);
  const tipShape = requireElement('#brush-tip-shape', HTMLSelectElement);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    const postCorrectionAmount = brushPostStrokeCorrectionAmountV1(item.preset);
    input.paintSession.setBrushPostStrokeCorrectionAmount(postCorrectionAmount);
    const tipAssets = brushTipAssetsV1(item.preset);
""",
    """    const postCorrectionAmount = brushPostStrokeCorrectionAmountV1(item.preset);
    input.paintSession.setBrushPostStrokeCorrectionAmount(postCorrectionAmount);
    const grainResourceId = brushGrainResourceIdV1(item.preset);
    input.paintSession.setBrushGrainResourceId(grainResourceId);
    const tipAssets = brushTipAssetsV1(item.preset);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    input.root.dataset.illustroBrushPostCorrectionAmount = String(postCorrectionAmount);
    input.root.dataset.illustroBrushTipShape = brushTipShapeV1(item.preset);
""",
    """    input.root.dataset.illustroBrushPostCorrectionAmount = String(postCorrectionAmount);
    input.root.dataset.illustroBrushGrainResource = grainResourceId ?? '';
    input.root.dataset.illustroBrushTipShape = brushTipShapeV1(item.preset);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    const postCorrectionAmount = brushPostStrokeCorrectionAmountV1(selected.preset);
    configurePair(postCorrectionRange, postCorrectionNumber, 0, 100, 1, postCorrectionAmount * 100);
    tipShape.value = brushTipShapeV1(selected.preset);
""",
    """    const postCorrectionAmount = brushPostStrokeCorrectionAmountV1(selected.preset);
    configurePair(postCorrectionRange, postCorrectionNumber, 0, 100, 1, postCorrectionAmount * 100);
    const grainResourceId = brushGrainResourceIdV1(selected.preset);
    grainResource.replaceChildren();
    const noGrain = document.createElement('option');
    noGrain.value = '';
    noGrain.textContent = 'なし';
    grainResource.append(noGrain);
    for (const resource of BUILTIN_BRUSH_GRAIN_RESOURCES_V1) {
      const option = document.createElement('option');
      option.value = resource.id;
      option.textContent = `${resource.family} · ${resource.name}`;
      grainResource.append(option);
    }
    if (
      grainResourceId !== null &&
      !BUILTIN_BRUSH_GRAIN_RESOURCES_V1.some((resource) => resource.id === grainResourceId)
    ) {
      const imported = document.createElement('option');
      imported.value = grainResourceId;
      imported.textContent = `Imported · ${grainResourceId}`;
      grainResource.append(imported);
    }
    grainResource.value = grainResourceId ?? '';
    tipShape.value = brushTipShapeV1(selected.preset);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    const postCorrectionLabel =
      postCorrectionAmount > 0 ? ` · Post${Math.round(postCorrectionAmount * 100)}%` : '';
    propertyStatus.textContent = `${parameters.sizePx.toFixed(1)} px · ${Math.round(parameters.opacity * 100)}% · ${Math.round(parameters.flow * 100)}% · H${Math.round(hardness * 100)}% · D${Math.round(tipDensity * 100)}% · S${Math.round(spacing.spacingRatio * 100)}% · A${Math.round(tipAngleDegrees)}° · F${Math.round(tipDirectionDegrees)}°${followRotation ? ' · Follow' : ''}${repeatLabel}${startLabel}${endLabel}${sizeTaperLabel}${opacityTaperLabel}${forcedTaperLabel}${stabilizationLabel}${postCorrectionLabel}`;
""",
    """    const postCorrectionLabel =
      postCorrectionAmount > 0 ? ` · Post${Math.round(postCorrectionAmount * 100)}%` : '';
    const grainLabel = grainResourceId === null ? '' : ` · Grain:${grainResourceId.split('.').at(-2) ?? 'custom'}-${grainResourceId.split('.').at(-1) ?? ''}`;
    propertyStatus.textContent = `${parameters.sizePx.toFixed(1)} px · ${Math.round(parameters.opacity * 100)}% · ${Math.round(parameters.flow * 100)}% · H${Math.round(hardness * 100)}% · D${Math.round(tipDensity * 100)}% · S${Math.round(spacing.spacingRatio * 100)}% · A${Math.round(tipAngleDegrees)}° · F${Math.round(tipDirectionDegrees)}°${followRotation ? ' · Follow' : ''}${repeatLabel}${startLabel}${endLabel}${sizeTaperLabel}${opacityTaperLabel}${forcedTaperLabel}${stabilizationLabel}${postCorrectionLabel}${grainLabel}`;
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """      postCorrectionRange,
      postCorrectionNumber,
      tipShape,
""",
    """      postCorrectionRange,
      postCorrectionNumber,
      grainResource,
      tipShape,
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  const onPostCorrectionNumber = (): void => updatePostCorrection(Number(postCorrectionNumber.value));
  const onTipShape = (): void => {
""",
    """  const onPostCorrectionNumber = (): void => updatePostCorrection(Number(postCorrectionNumber.value));
  const onGrainResource = (): void =>
    mutate(() =>
      updateBrushPresetGrainResourceV1(
        state,
        state.selectedPresetId,
        grainResource.value.length === 0 ? null : grainResource.value,
      ),
    );
  const onTipShape = (): void => {
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  postCorrectionRange.addEventListener('input', onPostCorrectionRange);
  postCorrectionNumber.addEventListener('change', onPostCorrectionNumber);
  tipShape.addEventListener('change', onTipShape);
""",
    """  postCorrectionRange.addEventListener('input', onPostCorrectionRange);
  postCorrectionNumber.addEventListener('change', onPostCorrectionNumber);
  grainResource.addEventListener('change', onGrainResource);
  tipShape.addEventListener('change', onTipShape);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """      postCorrectionRange.removeEventListener('input', onPostCorrectionRange);
      postCorrectionNumber.removeEventListener('change', onPostCorrectionNumber);
      tipShape.removeEventListener('change', onTipShape);
""",
    """      postCorrectionRange.removeEventListener('input', onPostCorrectionRange);
      postCorrectionNumber.removeEventListener('change', onPostCorrectionNumber);
      grainResource.removeEventListener('change', onGrainResource);
      tipShape.removeEventListener('change', onTipShape);
""",
)

replace_once(
    'src/index.html',
    """              <div class=\"shell-brush-property-row\">
                <label for=\"brush-post-correction-range\">描画後補正</label>
                <input id=\"brush-post-correction-range\" type=\"range\" min=\"0\" max=\"100\" step=\"1\" value=\"0\" />
                <span class=\"shell-brush-property-number shell-brush-property-percent\"><input id=\"brush-post-correction-number\" type=\"number\" inputmode=\"numeric\" min=\"0\" max=\"100\" step=\"1\" value=\"0\" aria-label=\"ストローク描画後補正\" /><span>%</span></span>
              </div>
              <div class=\"shell-brush-property-row shell-brush-tip-property-row\">
""",
    """              <div class=\"shell-brush-property-row\">
                <label for=\"brush-post-correction-range\">描画後補正</label>
                <input id=\"brush-post-correction-range\" type=\"range\" min=\"0\" max=\"100\" step=\"1\" value=\"0\" />
                <span class=\"shell-brush-property-number shell-brush-property-percent\"><input id=\"brush-post-correction-number\" type=\"number\" inputmode=\"numeric\" min=\"0\" max=\"100\" step=\"1\" value=\"0\" aria-label=\"ストローク描画後補正\" /><span>%</span></span>
              </div>
              <div class=\"shell-brush-property-row shell-brush-tip-property-row\">
                <label for=\"brush-grain-resource\">グレイン</label>
                <select id=\"brush-grain-resource\" aria-label=\"ブラシグレイン\"><option value=\"\">なし</option></select>
                <span class=\"shell-brush-tip-kind\">Grain</span>
              </div>
              <div class=\"shell-brush-property-row shell-brush-tip-property-row\">
""",
)

write_new(
    'tests/unit/brush-grain-selection.test.ts',
    """import { describe, expect, it } from 'vitest';
import {
  BUILTIN_BRUSH_GRAIN_RESOURCES_V1,
  brushGrainResourceIdV1,
  createBaselineBrushPresetV1,
  withBrushGrainResourceIdV1,
} from '../../src/domain/brush-schema.js';
import { PaintSessionControllerV1 } from '../../src/app/paint-session-controller.js';

class FakeRendererDocumentPort {
  async configureDocument(): Promise<void> {}
  async restoreBaselineStrokes(): Promise<void> {}
  async applyBaselineTilePatches(): Promise<void> {}
}

describe('M6A-035 grain selection', () => {
  it('publishes the final non-paper grain inventory shape as stable selection aliases', () => {
    expect(BUILTIN_BRUSH_GRAIN_RESOURCES_V1).toHaveLength(20);
    const counts = new Map<string, number>();
    for (const resource of BUILTIN_BRUSH_GRAIN_RESOURCES_V1) {
      counts.set(resource.family, (counts.get(resource.family) ?? 0) + 1);
    }
    expect(Object.fromEntries(counts)).toEqual({ fine: 6, rough: 6, fiber: 5, canvas: 3 });
    expect(new Set(BUILTIN_BRUSH_GRAIN_RESOURCES_V1.map((resource) => resource.id)).size).toBe(20);
  });

  it('defaults to no grain and persists both built-in and imported resource identities', () => {
    const preset = createBaselineBrushPresetV1({
      id: 'grain.paint',
      name: 'Grain',
      category: 'Test',
      behavior: 'paint',
    });
    expect(brushGrainResourceIdV1(preset)).toBeNull();
    const builtin = withBrushGrainResourceIdV1(preset, 'builtin.grain.fine.01');
    expect(brushGrainResourceIdV1(builtin)).toBe('builtin.grain.fine.01');
    const imported = withBrushGrainResourceIdV1(builtin, 'user.grain.abc123');
    expect(brushGrainResourceIdV1(imported)).toBe('user.grain.abc123');
    expect(brushGrainResourceIdV1(withBrushGrainResourceIdV1(imported, null))).toBeNull();
  });

  it('connects the selected grain identity into runtime stroke configuration state', () => {
    const session = new PaintSessionControllerV1(new FakeRendererDocumentPort());
    expect(session.brushGrainResourceId()).toBeNull();
    expect(session.setBrushGrainResourceId('builtin.grain.rough.02')).toBe('builtin.grain.rough.02');
    expect(session.snapshot()).toMatchObject({
      brushTextureResourceKind: 'grain',
      brushTextureResourceId: 'builtin.grain.rough.02',
    });
    expect(session.setBrushGrainResourceId(null)).toBeNull();
  });
});""",
)

insert_before(
    'scripts/verify-m6a-brush.mjs',
    """requireText(
  progress,
  'M6A-PERF-001 incremental active-stroke rendering（stable prefix + bounded mutable tail）:未完了',
""",
    """requireText(progress, 'M6A-035 grain selection:完了', 'M6A-035 progress is not complete');
requireText(
  read('src/domain/brush-schema.ts'),
  'BUILTIN_BRUSH_GRAIN_RESOURCES_V1',
  'built-in grain selection catalog missing',
);
requireText(
  read('src/domain/brush-schema.ts'),
  'brushGrainResourceIdV1',
  'grain selection preset helper missing',
);
requireText(
  read('src/app/paint-session-controller.ts'),
  'setBrushGrainResourceId',
  'grain selection is not connected to runtime brush state',
);
requireText(
  read('src/index.html'),
  'id=\"brush-grain-resource\"',
  'reachable grain resource chooser missing',
);
requireText(
  read('tests/unit/brush-grain-selection.test.ts'),
  'final non-paper grain inventory shape',
  'grain inventory regression coverage missing',
);""",
)

replace_once(
    'IMPLEMENTATION_PROGRESS.md',
    'M6A-035 grain selection:未完了\nM6A-036 paper texture selection:未完了',
    """M6A-035 grain selection:完了
再開メモ: M6A-035 grain selectionはBrushPresetV1.textureのresourceKind='grain' + resourceIdをcanonical選択契約とし、未選択は両fieldなし/nullで表現する。I-FINALの非paper grain 20件（fine 6 / rough 6 / fiber 5 / canvas 3）にはbuiltin.grain.<family>.<NN>の安定alias IDを確定した。これらはM6A-071/073で実payloadへmapするresource identityであり、schema helperはimport済みuser resource IDも保持できる。選択はpreset library永続化・PaintSession runtime snapshot・Brush Properties UIまで接続済み。M6A-037 strengthが0の間は選択だけで描画結果を変えず、M6A-036では同じtexture resource契約をpaper subtypeへ拡張する。次はM6A-036 paper texture selectionから再開する。
M6A-036 paper texture selection:未完了""",
)
append_once(
    'ILLUSTRO_DESIGN_MEMO.md',
    'M6A grain-selection boundary — 2026-09-03',
    """#### M6A grain-selection boundary — 2026-09-03

- M6A-035 establishes brush texture resource selection without pre-empting later texture strength/rendering or sampled-resource loading items. `BrushPresetV1.texture` stores `resourceKind: 'grain'` and a stable `resourceId`; no selection is represented by the absence of those fields.
- The final I inventory's 20 non-paper grains are assigned stable built-in aliases: `builtin.grain.fine.01..06`, `builtin.grain.rough.01..06`, `builtin.grain.fiber.01..05`, and `builtin.grain.canvas.01..03`. M6A-071/M6A-073 bind these identities to accepted sampled payloads; the identity contract does not depend on a public filename.
- Imported/user resources remain legal: the canonical helper accepts a normalized 1..160-character resource ID rather than restricting persisted presets to built-ins.
- The selection is connected through preset persistence, runtime PaintSession state and the reachable Brush Properties chooser. M6A-035 deliberately does not alter dab coverage while texture strength remains unimplemented/default-zero; M6A-037 owns that rendering effect.
- M6A-036 will extend the same single texture-resource selection contract to the I inventory's paper subtype rather than inventing a second simultaneous texture stack.""",
)

print('M6A-035 grain selection patch applied')