from pathlib import Path


def replace_once(path_s: str, old: str, new: str) -> None:
    path = Path(path_s)
    text = path.read_text(encoding='utf-8')
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path_s}: expected exactly one anchor, found {count}: {old[:140]!r}')
    path.write_text(text.replace(old, new, 1), encoding='utf-8')


def insert_before_once(path_s: str, marker: str, addition: str) -> None:
    replace_once(path_s, marker, addition + marker)


def append_once(path_s: str, marker: str, addition: str) -> None:
    path = Path(path_s)
    text = path.read_text(encoding='utf-8')
    if marker in text:
        raise SystemExit(f'{path_s}: M6A-064 marker already present')
    path.write_text(text.rstrip() + '\n\n' + addition.strip() + '\n', encoding='utf-8')

# Domain preset contract: Ink owns the fixed main/sub contribution.
insert_before_once(
    'src/domain/brush-schema.ts',
    'export const DEFAULT_BRUSH_COLOR_MIX_ENABLED_V1 = false as const;\n',
    '''export const DEFAULT_BRUSH_SUB_COLOR_RATIO_V1 = 0 as const;\n\nexport function brushSubColorRatioV1(preset: BrushPresetV1): number {\n  const value = preset.ink.subColorRatio;\n  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1\n    ? value\n    : DEFAULT_BRUSH_SUB_COLOR_RATIO_V1;\n}\n\nexport function withBrushSubColorRatioV1(\n  preset: BrushPresetV1,\n  subColorRatio: number,\n): BrushPresetV1 {\n  if (!Number.isFinite(subColorRatio) || subColorRatio < 0 || subColorRatio > 1) {\n    throw new RangeError('brush sub color ratio must be within 0..1');\n  }\n  if (subColorRatio === DEFAULT_BRUSH_SUB_COLOR_RATIO_V1) {\n    const { subColorRatio: _subColorRatio, ...ink } = preset.ink;\n    return normalizeBrushPresetV1({ ...preset, ink });\n  }\n  return normalizeBrushPresetV1({ ...preset, ink: { ...preset.ink, subColorRatio } });\n}\n\n''',
)

# Low-level deterministic kernel resolves main/sub before existing HSV jitter.
replace_once(
    'src/gpu/baseline-brush.ts',
    "} from '../domain/response-curve.js';\n",
    "} from '../domain/response-curve.js';\nimport {\n  decodeSrgbTransferComponentV1,\n  encodeSrgbTransferComponentV1,\n} from '../domain/color-management.js';\n",
)
replace_once(
    'src/gpu/baseline-brush.ts',
    'export const BASELINE_BRUSH_VALUE_JITTER = 0 as const;\n',
    'export const BASELINE_BRUSH_VALUE_JITTER = 0 as const;\nexport const BASELINE_BRUSH_SUB_COLOR_RATIO = 0 as const;\n',
)
insert_before_once(
    'src/gpu/baseline-brush.ts',
    'export interface BaselineBrushSampleV1 {\n',
    '''export function mixBaselineBrushMainSubColorV1(\n  mainColor: BaselineBrushColorV1,\n  subColor: BaselineBrushColorV1,\n  subColorRatio: number,\n): BaselineBrushColorV1 {\n  if (!Number.isFinite(subColorRatio) || subColorRatio < 0 || subColorRatio > 1) {\n    throw new RangeError('baseline brush sub color ratio must be within 0..1');\n  }\n  if (subColorRatio === 0) return mainColor;\n  if (subColorRatio === 1) return subColor;\n  const mainWeight = 1 - subColorRatio;\n  return freezeBaselineBrushColorV1([\n    encodeSrgbTransferComponentV1(\n      decodeSrgbTransferComponentV1(mainColor[0]) * mainWeight +\n        decodeSrgbTransferComponentV1(subColor[0]) * subColorRatio,\n    ),\n    encodeSrgbTransferComponentV1(\n      decodeSrgbTransferComponentV1(mainColor[1]) * mainWeight +\n        decodeSrgbTransferComponentV1(subColor[1]) * subColorRatio,\n    ),\n    encodeSrgbTransferComponentV1(\n      decodeSrgbTransferComponentV1(mainColor[2]) * mainWeight +\n        decodeSrgbTransferComponentV1(subColor[2]) * subColorRatio,\n    ),\n  ]);\n}\n\n''',
)
replace_once(
    'src/gpu/baseline-brush.ts',
    '  readonly #color: BaselineBrushColorV1;\n  readonly #radius: number;\n',
    '  readonly #color: BaselineBrushColorV1;\n  readonly #subColor: BaselineBrushColorV1;\n  readonly #subColorRatio: number;\n  readonly #radius: number;\n',
)
replace_once(
    'src/gpu/baseline-brush.ts',
    '      readonly color?: BaselineBrushColorV1;\n      readonly sizePx?: number;\n',
    '      readonly color?: BaselineBrushColorV1;\n      readonly subColor?: BaselineBrushColorV1;\n      readonly subColorRatio?: number;\n      readonly sizePx?: number;\n',
)
replace_once(
    'src/gpu/baseline-brush.ts',
    '''    this.#color =\n      options.color === undefined\n        ? DEFAULT_BASELINE_BRUSH_COLOR_V1\n        : freezeBaselineBrushColorV1(options.color);\n    const sizePx = options.sizePx ?? BASELINE_BRUSH_RADIUS_PX * 2;\n''',
    '''    this.#color =\n      options.color === undefined\n        ? DEFAULT_BASELINE_BRUSH_COLOR_V1\n        : freezeBaselineBrushColorV1(options.color);\n    this.#subColor =\n      options.subColor === undefined\n        ? DEFAULT_BASELINE_BRUSH_COLOR_V1\n        : freezeBaselineBrushColorV1(options.subColor);\n    const subColorRatio = options.subColorRatio ?? BASELINE_BRUSH_SUB_COLOR_RATIO;\n    if (!Number.isFinite(subColorRatio) || subColorRatio < 0 || subColorRatio > 1) {\n      throw new RangeError('baseline brush sub color ratio must be within 0..1');\n    }\n    this.#subColorRatio = subColorRatio;\n    const sizePx = options.sizePx ?? BASELINE_BRUSH_RADIUS_PX * 2;\n''',
)
replace_once(
    'src/gpu/baseline-brush.ts',
    '''    const resolvedColor =\n      colorJitterRandom === null\n        ? this.#color\n        : applyBaselineBrushColorJitterV1(\n            this.#color,\n            colorJitterRandom,\n            this.#hueJitter,\n            this.#saturationJitter,\n            this.#valueJitter,\n          );\n''',
    '''    const baseColor = mixBaselineBrushMainSubColorV1(\n      this.#color,\n      this.#subColor,\n      this.#subColorRatio,\n    );\n    const resolvedColor =\n      colorJitterRandom === null\n        ? baseColor\n        : applyBaselineBrushColorJitterV1(\n            baseColor,\n            colorJitterRandom,\n            this.#hueJitter,\n            this.#saturationJitter,\n            this.#valueJitter,\n          );\n''',
)

# Canonical facade passes the captured pair to the kernel.
replace_once(
    'src/app/canonical-raster-brush.ts',
    '      readonly color?: BaselineBrushColorV1;\n      readonly mode?: CanonicalBrushModeV1;\n',
    '      readonly color?: BaselineBrushColorV1;\n      readonly subColor?: BaselineBrushColorV1;\n      readonly subColorRatio?: number;\n      readonly mode?: CanonicalBrushModeV1;\n',
)
replace_once(
    'src/app/canonical-raster-brush.ts',
    '      ...(options.color === undefined ? {} : { color: options.color }),\n      ...(options.sizePx === undefined ? {} : { sizePx: options.sizePx }),\n',
    '''      ...(options.color === undefined ? {} : { color: options.color }),\n      ...(options.subColor === undefined ? {} : { subColor: options.subColor }),\n      ...(options.subColorRatio === undefined ? {} : { subColorRatio: options.subColorRatio }),\n      ...(options.sizePx === undefined ? {} : { sizePx: options.sizePx }),\n''',
)

# Runtime captures current/previous workspace colors at stroke creation.
replace_once(
    'src/app/paint-session-controller.ts',
    '  DEFAULT_BRUSH_COLOR_MIX_SAMPLE_RADIUS_RATIO_V1,\n',
    '  DEFAULT_BRUSH_SUB_COLOR_RATIO_V1,\n  DEFAULT_BRUSH_COLOR_MIX_SAMPLE_RADIUS_RATIO_V1,\n',
)
replace_once(
    'src/app/paint-session-controller.ts',
    '  readonly brushColorMixEnabled: boolean;\n',
    '  readonly brushSubColorRatio: number;\n  readonly brushColorMixEnabled: boolean;\n',
)
replace_once(
    'src/app/paint-session-controller.ts',
    '  #paintColor: BaselineBrushColorV1 = DEFAULT_BASELINE_BRUSH_COLOR_V1;\n  #brushMode: CanonicalBrushModeV1 = \'raster\';\n',
    '''  #paintColor: BaselineBrushColorV1 = DEFAULT_BASELINE_BRUSH_COLOR_V1;\n  #paintSubColor: BaselineBrushColorV1 = DEFAULT_BASELINE_BRUSH_COLOR_V1;\n  #brushSubColorRatio: number = DEFAULT_BRUSH_SUB_COLOR_RATIO_V1;\n  #brushMode: CanonicalBrushModeV1 = 'raster';\n''',
)
replace_once(
    'src/app/paint-session-controller.ts',
    '      brushColorMixEnabled: this.#brushColorMixEnabled,\n',
    '      brushSubColorRatio: this.#brushSubColorRatio,\n      brushColorMixEnabled: this.#brushColorMixEnabled,\n',
)
replace_once(
    'src/app/paint-session-controller.ts',
    '''  setPaintColor(color: BaselineBrushColorV1): void {\n    this.#paintColor = freezeBaselineBrushColorV1(color);\n  }\n\n  paintColor(): BaselineBrushColorV1 {\n    return this.#paintColor;\n  }\n''',
    '''  setPaintColor(color: BaselineBrushColorV1): void {\n    this.#paintColor = freezeBaselineBrushColorV1(color);\n  }\n\n  paintColor(): BaselineBrushColorV1 {\n    return this.#paintColor;\n  }\n\n  setPaintSubColor(color: BaselineBrushColorV1): void {\n    this.#paintSubColor = freezeBaselineBrushColorV1(color);\n  }\n\n  paintSubColor(): BaselineBrushColorV1 {\n    return this.#paintSubColor;\n  }\n''',
)
insert_before_once(
    'src/app/paint-session-controller.ts',
    '  setBrushColorMix(\n',
    '''  setBrushSubColorRatio(subColorRatio: number): void {\n    if (!Number.isFinite(subColorRatio) || subColorRatio < 0 || subColorRatio > 1) {\n      throw new RangeError('invalid runtime brush sub color ratio');\n    }\n    if (subColorRatio !== this.#brushSubColorRatio) this.#clearActiveStroke();\n    this.#brushSubColorRatio = subColorRatio;\n  }\n\n  brushSubColorRatio(): number {\n    return this.#brushSubColorRatio;\n  }\n\n''',
)
replace_once(
    'src/app/paint-session-controller.ts',
    '        color: this.#paintColor,\n        mode: this.#brushMode,\n',
    '''        color: this.#paintColor,\n        subColor: this.#paintSubColor,\n        subColorRatio: this.#brushSubColorRatio,\n        mode: this.#brushMode,\n''',
)

# Existing Color Workspace current/previous becomes the brush Main/Sub pair without changing schema.
replace_once(
    'src/app/color-workflow-controller.ts',
    '    input.paintSession.setPaintColor(state.current);\n',
    '    input.paintSession.setPaintColor(state.current);\n    input.paintSession.setPaintSubColor(state.previous);\n',
)

# Preset-library mutation path.
replace_once(
    'src/app/brush-preset-library.ts',
    '  withBrushColorMixEnabledV1,\n',
    '  withBrushSubColorRatioV1,\n  withBrushColorMixEnabledV1,\n',
)
insert_before_once(
    'src/app/brush-preset-library.ts',
    'export function updateBrushPresetColorMixEnabledV1(\n',
    '''export function updateBrushPresetSubColorRatioV1(\n  state: BrushPresetLibraryStateV1,\n  presetId: string,\n  subColorRatio: number,\n): BrushPresetLibraryStateV1 {\n  return updateItemV1(state, presetId, (item) => {\n    if (item.locked) throw new Error('locked brush preset cannot be edited');\n    const current = withBrushSubColorRatioV1(item.preset, subColorRatio);\n    if (JSON.stringify(current) === JSON.stringify(item.preset)) return item;\n    return itemV1({\n      source: item.source,\n      baseline: item.baseline,\n      preset: normalizeBrushPresetV1({ ...current, revision: item.preset.revision + 1 }),\n      locked: item.locked,\n    });\n  });\n}\n\n''',
)

# Reachable Tool Properties control and preset/runtime wiring.
replace_once(
    'src/app/brush-preset-controller.ts',
    '  brushColorMixEnabledV1,\n',
    '  brushSubColorRatioV1,\n  brushColorMixEnabledV1,\n',
)
replace_once(
    'src/app/brush-preset-controller.ts',
    '  updateBrushPresetColorMixEnabledV1,\n',
    '  updateBrushPresetSubColorRatioV1,\n  updateBrushPresetColorMixEnabledV1,\n',
)
insert_before_once(
    'src/app/brush-preset-controller.ts',
    "  const colorMixEnabledButton = requireElement('#brush-color-mix-enabled', HTMLButtonElement);\n",
    '''  const subColorRatioRange = requireElement('#brush-sub-color-ratio-range', HTMLInputElement);\n  const subColorRatioNumber = requireElement('#brush-sub-color-ratio-number', HTMLInputElement);\n''',
)
replace_once(
    'src/app/brush-preset-controller.ts',
    '''    const sprayAngleBasedOnCenter = brushSprayAngleBasedOnCenterV1(item.preset);\n    input.paintSession.setBrushSprayAngleBasedOnCenter(sprayAngleBasedOnCenter);\n    const colorMixEnabled = brushColorMixEnabledV1(item.preset);\n''',
    '''    const sprayAngleBasedOnCenter = brushSprayAngleBasedOnCenterV1(item.preset);\n    input.paintSession.setBrushSprayAngleBasedOnCenter(sprayAngleBasedOnCenter);\n    const subColorRatio = brushSubColorRatioV1(item.preset);\n    input.paintSession.setBrushSubColorRatio(subColorRatio);\n    const colorMixEnabled = brushColorMixEnabledV1(item.preset);\n''',
)
replace_once(
    'src/app/brush-preset-controller.ts',
    '    input.root.dataset.illustroBrushSprayAngleBasedOnCenter = String(sprayAngleBasedOnCenter);\n    input.root.dataset.illustroBrushColorMixEnabled = String(colorMixEnabled);\n',
    '''    input.root.dataset.illustroBrushSprayAngleBasedOnCenter = String(sprayAngleBasedOnCenter);\n    input.root.dataset.illustroBrushSubColorRatio = String(subColorRatio);\n    input.root.dataset.illustroBrushColorMixEnabled = String(colorMixEnabled);\n''',
)
replace_once(
    'src/app/brush-preset-controller.ts',
    '''    const sprayAngleBasedOnCenter = brushSprayAngleBasedOnCenterV1(selected.preset);\n    sprayAngleBasedOnCenterButton.textContent = sprayAngleBasedOnCenter ? 'ON' : 'OFF';\n    sprayAngleBasedOnCenterButton.setAttribute('aria-pressed', String(sprayAngleBasedOnCenter));\n    const colorMixEnabled = brushColorMixEnabledV1(selected.preset);\n''',
    '''    const sprayAngleBasedOnCenter = brushSprayAngleBasedOnCenterV1(selected.preset);\n    sprayAngleBasedOnCenterButton.textContent = sprayAngleBasedOnCenter ? 'ON' : 'OFF';\n    sprayAngleBasedOnCenterButton.setAttribute('aria-pressed', String(sprayAngleBasedOnCenter));\n    const subColorRatio = brushSubColorRatioV1(selected.preset);\n    configurePair(subColorRatioRange, subColorRatioNumber, 0, 100, 1, subColorRatio * 100);\n    const colorMixEnabled = brushColorMixEnabledV1(selected.preset);\n''',
)
replace_once(
    'src/app/brush-preset-controller.ts',
    '    colorMixCanvasRatioRange.disabled = locked || !colorMixEnabled;\n',
    '''    subColorRatioRange.disabled = locked || selected.preset.behavior !== 'paint';\n    subColorRatioNumber.disabled = locked || selected.preset.behavior !== 'paint';\n    colorMixCanvasRatioRange.disabled = locked || !colorMixEnabled;\n''',
)
replace_once(
    'src/app/brush-preset-controller.ts',
    '      sprayAngleBasedOnCenterButton,\n      colorMixEnabledButton,\n',
    '      sprayAngleBasedOnCenterButton,\n      subColorRatioRange,\n      subColorRatioNumber,\n      colorMixEnabledButton,\n',
)
insert_before_once(
    'src/app/brush-preset-controller.ts',
    '  const onColorMixEnabled = (): void =>\n',
    '''  const updateSubColorRatio = (valuePercent: number): void =>\n    mutate(() =>\n      updateBrushPresetSubColorRatioV1(state, state.selectedPresetId, valuePercent / 100),\n    );\n  const onSubColorRatioRange = (): void => updateSubColorRatio(Number(subColorRatioRange.value));\n  const onSubColorRatioNumber = (): void =>\n    updateSubColorRatio(Number(subColorRatioNumber.value));\n''',
)
replace_once(
    'src/app/brush-preset-controller.ts',
    "  colorMixEnabledButton.addEventListener('click', onColorMixEnabled);\n",
    "  subColorRatioRange.addEventListener('input', onSubColorRatioRange);\n  subColorRatioNumber.addEventListener('change', onSubColorRatioNumber);\n  colorMixEnabledButton.addEventListener('click', onColorMixEnabled);\n",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    "      colorMixEnabledButton.removeEventListener('click', onColorMixEnabled);\n",
    "      subColorRatioRange.removeEventListener('input', onSubColorRatioRange);\n      subColorRatioNumber.removeEventListener('change', onSubColorRatioNumber);\n      colorMixEnabledButton.removeEventListener('click', onColorMixEnabled);\n",
)

insert_before_once(
    'src/index.html',
    '''              <div class="shell-brush-property-row shell-brush-tip-property-row">\n                <label for="brush-color-mix-enabled">通常色混ぜ</label>\n''',
    '''              <div class="shell-brush-property-row">\n                <label for="brush-sub-color-ratio-range">副色比率</label>\n                <input id="brush-sub-color-ratio-range" type="range" min="0" max="100" step="1" value="0" />\n                <span class="shell-brush-property-number shell-brush-property-percent"><input id="brush-sub-color-ratio-number" type="number" inputmode="decimal" min="0" max="100" step="1" value="0" aria-label="ブラシ副色比率" /><span>%</span></span>\n              </div>\n''',
)

# Regression coverage.
Path('tests/unit/brush-main-sub-color.test.ts').write_text('''import { describe, expect, it } from 'vitest';\nimport {\n  BaselineBrushDabBuilderV1,\n  mixBaselineBrushMainSubColorV1,\n} from '../../src/gpu/baseline-brush.js';\n\ndescribe('M6A-064 main/sub brush color', () => {\n  it('keeps ratio zero as exact main-color compatibility and ratio one as sub color', () => {\n    const main = Object.freeze([1, 0, 0] as const);\n    const sub = Object.freeze([0, 0, 1] as const);\n    expect(mixBaselineBrushMainSubColorV1(main, sub, 0)).toBe(main);\n    expect(mixBaselineBrushMainSubColorV1(main, sub, 1)).toBe(sub);\n  });\n\n  it('mixes main and sub colors in linear light before creating resolved dabs', () => {\n    const builder = new BaselineBrushDabBuilderV1({\n      color: [1, 0, 0],\n      subColor: [0, 0, 1],\n      subColorRatio: 0.5,\n      sizePx: 16,\n    });\n    const dabs = builder.begin({ documentX: 8, documentY: 8 });\n    expect(dabs).toHaveLength(1);\n    const color = dabs[0]?.color;\n    expect(color).toBeDefined();\n    expect(color?.[0]).toBeCloseTo(0.735, 2);\n    expect(color?.[1]).toBeCloseTo(0, 4);\n    expect(color?.[2]).toBeCloseTo(0.735, 2);\n  });\n\n  it('applies existing HSV jitter after resolving the fixed main/sub contribution', () => {\n    const base = mixBaselineBrushMainSubColorV1([1, 0, 0], [0, 0, 1], 0.5);\n    const builder = new BaselineBrushDabBuilderV1({\n      color: [1, 0, 0],\n      subColor: [0, 0, 1],\n      subColorRatio: 0.5,\n      hueJitter: 0.2,\n      randomSeed: 123,\n      sizePx: 16,\n    });\n    const color = builder.begin({ documentX: 8, documentY: 8 })[0]?.color;\n    expect(color).toBeDefined();\n    expect(color).not.toEqual(base);\n  });\n});\n''', encoding='utf-8')

append_once(
    'ILLUSTRO_DESIGN_MEMO.md',
    '## M6A main/sub-color boundary — 2026-09-04',
    '''## M6A main/sub-color boundary — 2026-09-04\n\n**AUTHORITATIVE for M6A-064.** Brush `ink.subColorRatio` is the fixed contribution of the Color Workspace secondary/swap color to ordinary Raster paint. It is normalized `0..1` and defaults to `0`; `0` is an exact compatibility boundary that uses only the current/Main drawing color, while `1` uses only the previous/Sub drawing color. M6A-064 reuses the existing M5D `current / previous / history` workspace state rather than creating a second color database: current is captured as Main and previous as Sub when a canonical stroke begins, and the existing previous-swatch swap interaction switches the pair.\n\nIntermediate ratios combine Main and Sub in linear-light RGB through the shared document RGB transfer function and return to the existing encoded RGB dab representation. This is a deterministic digital drawing-color contribution, not physical pigment simulation. Main/Sub resolution happens before M6A-056 HSV jitter, so existing hue/saturation/value variation transforms the already-resolved two-color base. The resolved final RGB is stored on each primitive dab; Worker, History, Undo/Redo and recovery therefore require no new main/sub fields and remain independent of later workspace color changes.\n\nTool Properties exposes a compact 0–100% Sub Color Ratio slider plus exact numeric companion for paint presets. Preset switching captures the ratio into Paint Session runtime state. Changing the workspace colors during an already-active stroke does not recolor its confirmed prefix because the canonical brush instance captures both colors at stroke creation. M6A-062/063 canvas pickup/mixing remains a later rasterization-stage operation over the resolved dab color and is not replaced by Main/Sub contribution.''',
)
replace_once(
    'IMPLEMENTATION_PROGRESS.md',
    'M6A-064 main/sub color behavior:未完了\n',
    '''M6A-064 main/sub color behavior:完了\n再開メモ: M6A-064はBrush ink.subColorRatio（0..1、既定0）を実装し、既存M5D Color WorkspaceのcurrentをMain、previousをSub/Swap色としてcanonical stroke開始時にcaptureする。0は既存Main-only出力と完全互換、1はSub-only、中間値はshared RGB transferによるlinear-light補間。main/sub解決後にM6A-056 HSV jitterを適用し、primitive dabには最終RGBだけを保存するためWorker/History/Undo/Redo/Recovery ABIは増やさない。Tool Propertiesへ副色比率slider+数値入力を接続しpreset/runtimeへ保存する。次はM6A-065 reference-aware anti-overflow paintingから再開する。\n''',
)

append_once(
    'scripts/verify-m6a-brush.mjs',
    'M6A-064 progress is not complete',
    '''requireText(progress, 'M6A-064 main/sub color behavior:完了', 'M6A-064 progress is not complete');\nrequireText(\n  read('src/domain/brush-schema.ts'),\n  'brushSubColorRatioV1',\n  'main/sub brush preset contract missing',\n);\nrequireText(\n  read('src/gpu/baseline-brush.ts'),\n  'mixBaselineBrushMainSubColorV1',\n  'main/sub brush kernel resolution missing',\n);\nrequireText(\n  read('src/app/color-workflow-controller.ts'),\n  'setPaintSubColor(state.previous)',\n  'Color Workspace previous color is not connected as brush Sub color',\n);\nrequireText(\n  read('src/index.html'),\n  'id="brush-sub-color-ratio-range"',\n  'reachable Sub Color Ratio control missing',\n);\nrequireText(\n  read('tests/unit/brush-main-sub-color.test.ts'),\n  'mixes main and sub colors in linear light before creating resolved dabs',\n  'main/sub brush regression coverage missing',\n);''',
)
