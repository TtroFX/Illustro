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


# Paper is ResourceV1.kind=grain with subtype paper; extend the single texture-resource slot.
insert_before(
    'src/domain/brush-schema.ts',
    'function normalizedBrushTextureResourceIdV1(value: unknown): string {',
    """export interface BrushBuiltinPaperResourceV1 {
  readonly id: string;
  readonly name: string;
}

export const BUILTIN_BRUSH_PAPER_RESOURCES_V1: readonly BrushBuiltinPaperResourceV1[] =
  Object.freeze(
    Array.from({ length: 12 }, (_, index) => {
      const number = String(index + 1).padStart(2, '0');
      return Object.freeze({ id: `builtin.grain.paper.${number}`, name: `Paper ${number}` });
    }),
  );""",
)
replace_once(
    'src/domain/brush-schema.ts',
    """export function brushGrainResourceIdV1(preset: BrushPresetV1): string | null {
  const kind = preset.texture.resourceKind;
  const resourceId = preset.texture.resourceId;
  if (kind === undefined && resourceId === undefined) return null;
  if (kind !== 'grain') return null;
  return normalizedBrushTextureResourceIdV1(resourceId);
}
""",
    """export function brushGrainResourceIdV1(preset: BrushPresetV1): string | null {
  const kind = preset.texture.resourceKind;
  const subtype = preset.texture.resourceSubtype;
  const resourceId = preset.texture.resourceId;
  if (kind === undefined && resourceId === undefined) return null;
  if (kind !== 'grain' || subtype === 'paper') return null;
  return normalizedBrushTextureResourceIdV1(resourceId);
}
""",
)
replace_once(
    'src/domain/brush-schema.ts',
    """  if (resourceId === null) {
    if (preset.texture.resourceKind !== 'grain') return preset;
    const { resourceId: _resourceId, resourceKind: _resourceKind, ...rest } = preset.texture;
    return normalizeBrushPresetV1({ ...preset, texture: rest });
  }
  const normalized = normalizedBrushTextureResourceIdV1(resourceId);
  return normalizeBrushPresetV1({
    ...preset,
    texture: { ...preset.texture, resourceKind: 'grain', resourceId: normalized },
  });
}
""",
    """  if (resourceId === null) {
    if (preset.texture.resourceKind !== 'grain' || preset.texture.resourceSubtype === 'paper') {
      return preset;
    }
    const {
      resourceId: _resourceId,
      resourceKind: _resourceKind,
      resourceSubtype: _resourceSubtype,
      ...rest
    } = preset.texture;
    return normalizeBrushPresetV1({ ...preset, texture: rest });
  }
  const normalized = normalizedBrushTextureResourceIdV1(resourceId);
  return normalizeBrushPresetV1({
    ...preset,
    texture: {
      ...preset.texture,
      resourceKind: 'grain',
      resourceSubtype: 'grain',
      resourceId: normalized,
    },
  });
}

export function brushPaperTextureResourceIdV1(preset: BrushPresetV1): string | null {
  if (preset.texture.resourceKind !== 'grain' || preset.texture.resourceSubtype !== 'paper') {
    return null;
  }
  return normalizedBrushTextureResourceIdV1(preset.texture.resourceId);
}

export function withBrushPaperTextureResourceIdV1(
  preset: BrushPresetV1,
  resourceId: string | null,
): BrushPresetV1 {
  if (resourceId === null) {
    if (preset.texture.resourceKind !== 'grain' || preset.texture.resourceSubtype !== 'paper') {
      return preset;
    }
    const {
      resourceId: _resourceId,
      resourceKind: _resourceKind,
      resourceSubtype: _resourceSubtype,
      ...rest
    } = preset.texture;
    return normalizeBrushPresetV1({ ...preset, texture: rest });
  }
  const normalized = normalizedBrushTextureResourceIdV1(resourceId);
  return normalizeBrushPresetV1({
    ...preset,
    texture: {
      ...preset.texture,
      resourceKind: 'grain',
      resourceSubtype: 'paper',
      resourceId: normalized,
    },
  });
}
""",
)

# Runtime distinguishes Resource kind from paper subtype while retaining one active texture resource.
replace_once(
    'src/app/paint-session-controller.ts',
    """  readonly brushTextureResourceKind: 'grain' | null;
  readonly brushTextureResourceId: string | null;
""",
    """  readonly brushTextureResourceKind: 'grain' | null;
  readonly brushTextureResourceSubtype: 'grain' | 'paper' | null;
  readonly brushTextureResourceId: string | null;
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """  #brushTextureResourceKind: 'grain' | null = null;
  #brushTextureResourceId: string | null = null;
""",
    """  #brushTextureResourceKind: 'grain' | null = null;
  #brushTextureResourceSubtype: 'grain' | 'paper' | null = null;
  #brushTextureResourceId: string | null = null;
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """      brushTextureResourceKind: this.#brushTextureResourceKind,
      brushTextureResourceId: this.#brushTextureResourceId,
""",
    """      brushTextureResourceKind: this.#brushTextureResourceKind,
      brushTextureResourceSubtype: this.#brushTextureResourceSubtype,
      brushTextureResourceId: this.#brushTextureResourceId,
""",
)
replace_once(
    'src/app/paint-session-controller.ts',
    """      this.#brushTextureResourceKind !== (normalized === null ? null : 'grain') ||
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
  }
""",
    """      this.#brushTextureResourceKind !== (normalized === null ? null : 'grain') ||
      this.#brushTextureResourceSubtype !== (normalized === null ? null : 'grain') ||
      this.#brushTextureResourceId !== normalized
    ) {
      this.#clearActiveStroke();
    }
    this.#brushTextureResourceKind = normalized === null ? null : 'grain';
    this.#brushTextureResourceSubtype = normalized === null ? null : 'grain';
    this.#brushTextureResourceId = normalized;
    return this.#brushTextureResourceId;
  }

  brushGrainResourceId(): string | null {
    return this.#brushTextureResourceKind === 'grain' && this.#brushTextureResourceSubtype !== 'paper'
      ? this.#brushTextureResourceId
      : null;
  }

  setBrushPaperTextureResourceId(resourceId: string | null): string | null {
    const normalized =
      resourceId === null
        ? null
        : (() => {
            if (typeof resourceId !== 'string') throw new TypeError('runtime paper resource id must be text');
            const value = resourceId.trim();
            if (value.length < 1 || value.length > 160) {
              throw new RangeError('runtime paper resource id must be 1..160 characters');
            }
            return value;
          })();
    if (
      this.#brushTextureResourceKind !== (normalized === null ? null : 'grain') ||
      this.#brushTextureResourceSubtype !== (normalized === null ? null : 'paper') ||
      this.#brushTextureResourceId !== normalized
    ) {
      this.#clearActiveStroke();
    }
    this.#brushTextureResourceKind = normalized === null ? null : 'grain';
    this.#brushTextureResourceSubtype = normalized === null ? null : 'paper';
    this.#brushTextureResourceId = normalized;
    return this.#brushTextureResourceId;
  }

  brushPaperTextureResourceId(): string | null {
    return this.#brushTextureResourceKind === 'grain' && this.#brushTextureResourceSubtype === 'paper'
      ? this.#brushTextureResourceId
      : null;
  }
""",
)

# Preset library.
replace_once(
    'src/app/brush-preset-library.ts',
    """  withBrushGrainResourceIdV1,
  withBrushStrokeSpacingV1,
""",
    """  withBrushGrainResourceIdV1,
  withBrushPaperTextureResourceIdV1,
  withBrushStrokeSpacingV1,
""",
)
insert_before(
    'src/app/brush-preset-library.ts',
    'export function updateBrushPresetCustomTipV1(\n',
    """export function updateBrushPresetPaperTextureResourceV1(
  state: BrushPresetLibraryStateV1,
  presetId: string,
  resourceId: string | null,
): BrushPresetLibraryStateV1 {
  return updateItemV1(state, presetId, (item) => {
    if (item.locked) throw new Error('locked brush preset cannot be edited');
    const current = withBrushPaperTextureResourceIdV1(item.preset, resourceId);
    if (JSON.stringify(current) === JSON.stringify(item.preset)) return item;
    const next = normalizeBrushPresetV1({ ...current, revision: item.preset.revision + 1 });
    return itemV1({ source: item.source, baseline: item.baseline, preset: next, locked: item.locked });
  });
}""",
)

# Controller and second chooser mapping into the same texture slot.
replace_once(
    'src/app/brush-preset-controller.ts',
    """  brushGrainResourceIdV1,
  BUILTIN_BRUSH_GRAIN_RESOURCES_V1,
  brushStrokeSpacingV1,
""",
    """  brushGrainResourceIdV1,
  brushPaperTextureResourceIdV1,
  BUILTIN_BRUSH_GRAIN_RESOURCES_V1,
  BUILTIN_BRUSH_PAPER_RESOURCES_V1,
  brushStrokeSpacingV1,
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  updateBrushPresetGrainResourceV1,
  updateBrushPresetSpacingV1,
""",
    """  updateBrushPresetGrainResourceV1,
  updateBrushPresetPaperTextureResourceV1,
  updateBrushPresetSpacingV1,
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  const grainResource = requireElement('#brush-grain-resource', HTMLSelectElement);
  const tipShape = requireElement('#brush-tip-shape', HTMLSelectElement);
""",
    """  const grainResource = requireElement('#brush-grain-resource', HTMLSelectElement);
  const paperResource = requireElement('#brush-paper-resource', HTMLSelectElement);
  const tipShape = requireElement('#brush-tip-shape', HTMLSelectElement);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    const grainResourceId = brushGrainResourceIdV1(item.preset);
    input.paintSession.setBrushGrainResourceId(grainResourceId);
    const tipAssets = brushTipAssetsV1(item.preset);
""",
    """    const grainResourceId = brushGrainResourceIdV1(item.preset);
    const paperResourceId = brushPaperTextureResourceIdV1(item.preset);
    if (paperResourceId !== null) {
      input.paintSession.setBrushPaperTextureResourceId(paperResourceId);
    } else {
      input.paintSession.setBrushGrainResourceId(grainResourceId);
    }
    const tipAssets = brushTipAssetsV1(item.preset);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    input.root.dataset.illustroBrushGrainResource = grainResourceId ?? '';
    input.root.dataset.illustroBrushTipShape = brushTipShapeV1(item.preset);
""",
    """    input.root.dataset.illustroBrushGrainResource = grainResourceId ?? '';
    input.root.dataset.illustroBrushPaperResource = paperResourceId ?? '';
    input.root.dataset.illustroBrushTipShape = brushTipShapeV1(item.preset);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    grainResource.value = grainResourceId ?? '';
    tipShape.value = brushTipShapeV1(selected.preset);
""",
    """    grainResource.value = grainResourceId ?? '';
    const paperResourceId = brushPaperTextureResourceIdV1(selected.preset);
    paperResource.replaceChildren();
    const noPaper = document.createElement('option');
    noPaper.value = '';
    noPaper.textContent = 'なし';
    paperResource.append(noPaper);
    for (const resource of BUILTIN_BRUSH_PAPER_RESOURCES_V1) {
      const option = document.createElement('option');
      option.value = resource.id;
      option.textContent = resource.name;
      paperResource.append(option);
    }
    if (
      paperResourceId !== null &&
      !BUILTIN_BRUSH_PAPER_RESOURCES_V1.some((resource) => resource.id === paperResourceId)
    ) {
      const imported = document.createElement('option');
      imported.value = paperResourceId;
      imported.textContent = `Imported · ${paperResourceId}`;
      paperResource.append(imported);
    }
    paperResource.value = paperResourceId ?? '';
    tipShape.value = brushTipShapeV1(selected.preset);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    const grainLabel = grainResourceId === null ? '' : ` · Grain:${grainResourceId.split('.').at(-2) ?? 'custom'}-${grainResourceId.split('.').at(-1) ?? ''}`;
    propertyStatus.textContent = `${parameters.sizePx.toFixed(1)} px · ${Math.round(parameters.opacity * 100)}% · ${Math.round(parameters.flow * 100)}% · H${Math.round(hardness * 100)}% · D${Math.round(tipDensity * 100)}% · S${Math.round(spacing.spacingRatio * 100)}% · A${Math.round(tipAngleDegrees)}° · F${Math.round(tipDirectionDegrees)}°${followRotation ? ' · Follow' : ''}${repeatLabel}${startLabel}${endLabel}${sizeTaperLabel}${opacityTaperLabel}${forcedTaperLabel}${stabilizationLabel}${postCorrectionLabel}${grainLabel}`;
""",
    """    const grainLabel = grainResourceId === null ? '' : ` · Grain:${grainResourceId.split('.').at(-2) ?? 'custom'}-${grainResourceId.split('.').at(-1) ?? ''}`;
    const paperLabel = paperResourceId === null ? '' : ` · Paper:${paperResourceId.split('.').at(-1) ?? 'custom'}`;
    propertyStatus.textContent = `${parameters.sizePx.toFixed(1)} px · ${Math.round(parameters.opacity * 100)}% · ${Math.round(parameters.flow * 100)}% · H${Math.round(hardness * 100)}% · D${Math.round(tipDensity * 100)}% · S${Math.round(spacing.spacingRatio * 100)}% · A${Math.round(tipAngleDegrees)}° · F${Math.round(tipDirectionDegrees)}°${followRotation ? ' · Follow' : ''}${repeatLabel}${startLabel}${endLabel}${sizeTaperLabel}${opacityTaperLabel}${forcedTaperLabel}${stabilizationLabel}${postCorrectionLabel}${grainLabel}${paperLabel}`;
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """      grainResource,
      tipShape,
""",
    """      grainResource,
      paperResource,
      tipShape,
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  const onGrainResource = (): void =>
    mutate(() =>
      updateBrushPresetGrainResourceV1(
        state,
        state.selectedPresetId,
        grainResource.value.length === 0 ? null : grainResource.value,
      ),
    );
  const onTipShape = (): void => {
""",
    """  const onGrainResource = (): void =>
    mutate(() =>
      updateBrushPresetGrainResourceV1(
        state,
        state.selectedPresetId,
        grainResource.value.length === 0 ? null : grainResource.value,
      ),
    );
  const onPaperResource = (): void =>
    mutate(() =>
      updateBrushPresetPaperTextureResourceV1(
        state,
        state.selectedPresetId,
        paperResource.value.length === 0 ? null : paperResource.value,
      ),
    );
  const onTipShape = (): void => {
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  grainResource.addEventListener('change', onGrainResource);
  tipShape.addEventListener('change', onTipShape);
""",
    """  grainResource.addEventListener('change', onGrainResource);
  paperResource.addEventListener('change', onPaperResource);
  tipShape.addEventListener('change', onTipShape);
""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """      grainResource.removeEventListener('change', onGrainResource);
      tipShape.removeEventListener('change', onTipShape);
""",
    """      grainResource.removeEventListener('change', onGrainResource);
      paperResource.removeEventListener('change', onPaperResource);
      tipShape.removeEventListener('change', onTipShape);
""",
)

replace_once(
    'src/index.html',
    """              <div class=\"shell-brush-property-row shell-brush-tip-property-row\">
                <label for=\"brush-grain-resource\">グレイン</label>
                <select id=\"brush-grain-resource\" aria-label=\"ブラシグレイン\"><option value=\"\">なし</option></select>
                <span class=\"shell-brush-tip-kind\">Grain</span>
              </div>
              <div class=\"shell-brush-property-row shell-brush-tip-property-row\">
""",
    """              <div class=\"shell-brush-property-row shell-brush-tip-property-row\">
                <label for=\"brush-grain-resource\">グレイン</label>
                <select id=\"brush-grain-resource\" aria-label=\"ブラシグレイン\"><option value=\"\">なし</option></select>
                <span class=\"shell-brush-tip-kind\">Grain</span>
              </div>
              <div class=\"shell-brush-property-row shell-brush-tip-property-row\">
                <label for=\"brush-paper-resource\">紙テクスチャ</label>
                <select id=\"brush-paper-resource\" aria-label=\"ブラシ紙テクスチャ\"><option value=\"\">なし</option></select>
                <span class=\"shell-brush-tip-kind\">Paper</span>
              </div>
              <div class=\"shell-brush-property-row shell-brush-tip-property-row\">
""",
)

write_new(
    'tests/unit/brush-paper-texture-selection.test.ts',
    """import { describe, expect, it } from 'vitest';
import {
  BUILTIN_BRUSH_PAPER_RESOURCES_V1,
  brushGrainResourceIdV1,
  brushPaperTextureResourceIdV1,
  createBaselineBrushPresetV1,
  withBrushGrainResourceIdV1,
  withBrushPaperTextureResourceIdV1,
} from '../../src/domain/brush-schema.js';
import { PaintSessionControllerV1 } from '../../src/app/paint-session-controller.js';

class FakeRendererDocumentPort {
  async configureDocument(): Promise<void> {}
  async restoreBaselineStrokes(): Promise<void> {}
  async applyBaselineTilePatches(): Promise<void> {}
}

describe('M6A-036 paper texture selection', () => {
  it('publishes exactly the twelve accepted paper-subtype aliases', () => {
    expect(BUILTIN_BRUSH_PAPER_RESOURCES_V1).toHaveLength(12);
    expect(new Set(BUILTIN_BRUSH_PAPER_RESOURCES_V1.map((resource) => resource.id)).size).toBe(12);
    expect(BUILTIN_BRUSH_PAPER_RESOURCES_V1[0]?.id).toBe('builtin.grain.paper.01');
    expect(BUILTIN_BRUSH_PAPER_RESOURCES_V1.at(-1)?.id).toBe('builtin.grain.paper.12');
  });

  it('uses the same single texture slot and distinguishes paper from ordinary grain', () => {
    const preset = createBaselineBrushPresetV1({
      id: 'paper.paint',
      name: 'Paper',
      category: 'Test',
      behavior: 'paint',
    });
    const grain = withBrushGrainResourceIdV1(preset, 'builtin.grain.fine.01');
    expect(brushGrainResourceIdV1(grain)).toBe('builtin.grain.fine.01');
    expect(brushPaperTextureResourceIdV1(grain)).toBeNull();
    const paper = withBrushPaperTextureResourceIdV1(grain, 'builtin.grain.paper.04');
    expect(brushGrainResourceIdV1(paper)).toBeNull();
    expect(brushPaperTextureResourceIdV1(paper)).toBe('builtin.grain.paper.04');
    const backToGrain = withBrushGrainResourceIdV1(paper, 'user.grain.custom');
    expect(brushPaperTextureResourceIdV1(backToGrain)).toBeNull();
    expect(brushGrainResourceIdV1(backToGrain)).toBe('user.grain.custom');
  });

  it('captures paper as grain-kind/paper-subtype runtime resource state', () => {
    const session = new PaintSessionControllerV1(new FakeRendererDocumentPort());
    session.setBrushPaperTextureResourceId('builtin.grain.paper.09');
    expect(session.brushPaperTextureResourceId()).toBe('builtin.grain.paper.09');
    expect(session.brushGrainResourceId()).toBeNull();
    expect(session.snapshot()).toMatchObject({
      brushTextureResourceKind: 'grain',
      brushTextureResourceSubtype: 'paper',
      brushTextureResourceId: 'builtin.grain.paper.09',
    });
  });
});""",
)

insert_before(
    'scripts/verify-m6a-brush.mjs',
    """requireText(
  progress,
  'M6A-PERF-001 incremental active-stroke rendering（stable prefix + bounded mutable tail）:未完了',
""",
    """requireText(progress, 'M6A-036 paper texture selection:完了', 'M6A-036 progress is not complete');
requireText(read('src/domain/brush-schema.ts'), 'BUILTIN_BRUSH_PAPER_RESOURCES_V1', 'paper catalog missing');
requireText(read('src/domain/brush-schema.ts'), 'brushPaperTextureResourceIdV1', 'paper selection helper missing');
requireText(read('src/app/paint-session-controller.ts'), 'setBrushPaperTextureResourceId', 'paper runtime state missing');
requireText(read('src/index.html'), 'id=\"brush-paper-resource\"', 'reachable paper chooser missing');
requireText(read('tests/unit/brush-paper-texture-selection.test.ts'), 'same single texture slot', 'paper/grain exclusivity regression missing');""",
)
replace_once(
    'IMPLEMENTATION_PROGRESS.md',
    'M6A-036 paper texture selection:未完了\nM6A-037 texture strength:未完了',
    """M6A-036 paper texture selection:完了
再開メモ: M6A-036 paper texture selectionはI-FINALの12 paper resourcesにbuiltin.grain.paper.01..12の安定aliasを割当て、ResourceV1.kindはgrainのままBrushPresetV1.texture.resourceSubtype='paper'で識別する。通常grainはresourceSubtype='grain'へ正規化し、grain/paperは同一texture resource slotを排他的に使用するため二重適用スタックにはしない。preset helper・library永続化・PaintSessionのkind/subtype/id snapshot・Brush Properties paper chooserまで接続済み。imported paper IDもcanonical resource identityとして保持可能。次はM6A-037 texture strengthから再開する。
M6A-037 texture strength:未完了""",
)
append_once(
    'ILLUSTRO_DESIGN_MEMO.md',
    'M6A paper-texture-selection boundary — 2026-09-03',
    """#### M6A paper-texture-selection boundary — 2026-09-03

- M6A-036 extends the M6A-035 single brush-texture resource slot to the accepted 12 paper resources. Paper remains `ResourceV1.kind = grain`; `BrushPresetV1.texture.resourceSubtype = 'paper'` distinguishes it from ordinary grain.
- Stable built-in aliases are `builtin.grain.paper.01..12`. Ordinary non-paper grain is normalized to subtype `grain`. Selecting one replaces the other; M6A does not silently introduce a dual grain+paper texture stack.
- Preset persistence and runtime state retain resource kind, subtype and ID independently from the later sampled payload. Imported paper resource IDs remain representable.
- UI exposes separate Grain and Paper chooser rows for recognition, but they map to the same mutually exclusive canonical texture slot. M6A-037 applies the shared strength semantics to whichever resource is selected.""",
)

print('M6A-036 paper texture selection patch applied')