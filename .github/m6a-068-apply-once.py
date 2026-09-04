from pathlib import Path


def read(path: str) -> str:
    return Path(path).read_text(encoding='utf-8')


def write(path: str, text: str) -> None:
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    Path(path).write_text(text, encoding='utf-8')


def replace_once(path: str, old: str, new: str) -> None:
    text = read(path)
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{path}: expected one match, found {count}: {old[:100]!r}')
    write(path, text.replace(old, new, 1))


# Brush schema: distinguish an explicit per-brush override from inherited global/default state.
replace_once(
    'src/domain/brush-schema.ts',
    """export function brushPressureResponseCurveV1(\n  preset: BrushPresetV1,\n): readonly ResponseCurvePointV1[] {\n  const value = preset.dynamics.pressureResponseCurve;\n  if (value === undefined) return LINEAR_RESPONSE_CURVE_V1;\n  try {\n    return normalizeResponseCurveV1(value);\n  } catch {\n    return LINEAR_RESPONSE_CURVE_V1;\n  }\n}\n\nexport function withBrushPressureResponseCurveV1(\n  preset: BrushPresetV1,\n  curve: readonly ResponseCurvePointV1[],\n): BrushPresetV1 {\n  const normalized = normalizeResponseCurveV1(curve);\n  if (responseCurveIsLinearV1(normalized)) {\n    const { pressureResponseCurve: _pressureResponseCurve, ...dynamics } = preset.dynamics;\n    return normalizeBrushPresetV1({ ...preset, dynamics });\n  }\n  const stored = toJsonValue(\n    normalized.map((pointValue) => ({ input: pointValue.input, output: pointValue.output })),\n  );\n  return normalizeBrushPresetV1({\n    ...preset,\n    dynamics: { ...preset.dynamics, pressureResponseCurve: stored },\n  });\n}\n""",
    """export function brushPressureResponseCurveOverrideV1(\n  preset: BrushPresetV1,\n): readonly ResponseCurvePointV1[] | null {\n  const value = preset.dynamics.pressureResponseCurve;\n  if (value === undefined) return null;\n  try {\n    return normalizeResponseCurveV1(value);\n  } catch {\n    return null;\n  }\n}\n\nexport function brushPressureResponseCurveV1(\n  preset: BrushPresetV1,\n): readonly ResponseCurvePointV1[] {\n  return brushPressureResponseCurveOverrideV1(preset) ?? LINEAR_RESPONSE_CURVE_V1;\n}\n\nexport function resolveBrushPressureResponseCurveV1(\n  preset: BrushPresetV1,\n  defaultCurve: readonly ResponseCurvePointV1[],\n): readonly ResponseCurvePointV1[] {\n  return brushPressureResponseCurveOverrideV1(preset) ?? normalizeResponseCurveV1(defaultCurve);\n}\n\nexport function withBrushPressureResponseCurveV1(\n  preset: BrushPresetV1,\n  curve: readonly ResponseCurvePointV1[],\n): BrushPresetV1 {\n  const normalized = normalizeResponseCurveV1(curve);\n  const stored = toJsonValue(\n    normalized.map((pointValue) => ({ input: pointValue.input, output: pointValue.output })),\n  );\n  return normalizeBrushPresetV1({\n    ...preset,\n    dynamics: { ...preset.dynamics, pressureResponseCurve: stored },\n  });\n}\n\nexport function withoutBrushPressureResponseCurveOverrideV1(\n  preset: BrushPresetV1,\n): BrushPresetV1 {\n  const { pressureResponseCurve: _pressureResponseCurve, ...dynamics } = preset.dynamics;\n  return normalizeBrushPresetV1({ ...preset, dynamics });\n}\n""",
)

# Preset library: explicit action to return a brush to global/default inheritance.
replace_once(
    'src/app/brush-preset-library.ts',
    '  withBrushPressureResponseCurveV1,\n',
    '  withBrushPressureResponseCurveV1,\n  withoutBrushPressureResponseCurveOverrideV1,\n',
)
replace_once(
    'src/app/brush-preset-library.ts',
    """export function updateBrushPresetPressureResponseCurveV1(\n  state: BrushPresetLibraryStateV1,\n  presetId: string,\n  curve: readonly ResponseCurvePointV1[],\n): BrushPresetLibraryStateV1 {\n  return updateItemV1(state, presetId, (item) => {\n    if (item.locked) throw new Error('locked brush preset cannot be edited');\n    const current = withBrushPressureResponseCurveV1(item.preset, curve);\n    if (JSON.stringify(current) === JSON.stringify(item.preset)) return item;\n    const next = normalizeBrushPresetV1({ ...current, revision: item.preset.revision + 1 });\n    return itemV1({\n      source: item.source,\n      baseline: item.baseline,\n      preset: next,\n      locked: item.locked,\n    });\n  });\n}\n""",
    """export function updateBrushPresetPressureResponseCurveV1(\n  state: BrushPresetLibraryStateV1,\n  presetId: string,\n  curve: readonly ResponseCurvePointV1[],\n): BrushPresetLibraryStateV1 {\n  return updateItemV1(state, presetId, (item) => {\n    if (item.locked) throw new Error('locked brush preset cannot be edited');\n    const current = withBrushPressureResponseCurveV1(item.preset, curve);\n    if (JSON.stringify(current) === JSON.stringify(item.preset)) return item;\n    const next = normalizeBrushPresetV1({ ...current, revision: item.preset.revision + 1 });\n    return itemV1({\n      source: item.source,\n      baseline: item.baseline,\n      preset: next,\n      locked: item.locked,\n    });\n  });\n}\n\nexport function clearBrushPresetPressureResponseCurveOverrideV1(\n  state: BrushPresetLibraryStateV1,\n  presetId: string,\n): BrushPresetLibraryStateV1 {\n  return updateItemV1(state, presetId, (item) => {\n    if (item.locked) throw new Error('locked brush preset cannot be edited');\n    const current = withoutBrushPressureResponseCurveOverrideV1(item.preset);\n    if (JSON.stringify(current) === JSON.stringify(item.preset)) return item;\n    const next = normalizeBrushPresetV1({ ...current, revision: item.preset.revision + 1 });\n    return itemV1({\n      source: item.source,\n      baseline: item.baseline,\n      preset: next,\n      locked: item.locked,\n    });\n  });\n}\n""",
)

# Application-level persistent global/default pressure response control.
write(
    'src/app/global-pressure-response-controller.ts',
    """import {\n  LINEAR_RESPONSE_CURVE_V1,\n  normalizeResponseCurveV1,\n  responseCurvePresetIdV1,\n  type ResponseCurvePointV1,\n} from '../domain/response-curve.js';\nimport { installSharedCurveEditorV1 } from './shared-curve-editor.js';\n\nexport const GLOBAL_PRESSURE_RESPONSE_SCHEMA_V1 = 'illustro.global-pressure-response/1' as const;\nexport const GLOBAL_PRESSURE_RESPONSE_STORAGE_KEY_V1 = 'illustro.global-pressure-response/1' as const;\n\nexport interface GlobalPressureResponseSnapshotV1 {\n  readonly schema: typeof GLOBAL_PRESSURE_RESPONSE_SCHEMA_V1;\n  readonly curve: readonly ResponseCurvePointV1[];\n}\n\nexport function createGlobalPressureResponseSnapshotV1(\n  curve: readonly ResponseCurvePointV1[] = LINEAR_RESPONSE_CURVE_V1,\n): GlobalPressureResponseSnapshotV1 {\n  return Object.freeze({\n    schema: GLOBAL_PRESSURE_RESPONSE_SCHEMA_V1,\n    curve: normalizeResponseCurveV1(curve),\n  });\n}\n\nexport function serializeGlobalPressureResponseV1(\n  snapshot: GlobalPressureResponseSnapshotV1,\n): string {\n  return JSON.stringify({ schema: snapshot.schema, curve: snapshot.curve });\n}\n\nexport function parseGlobalPressureResponseV1(raw: string): GlobalPressureResponseSnapshotV1 {\n  const value: unknown = JSON.parse(raw);\n  if (typeof value !== 'object' || value === null || Array.isArray(value)) {\n    throw new TypeError('global pressure response must be an object');\n  }\n  const record = value as { readonly schema?: unknown; readonly curve?: unknown };\n  if (record.schema !== GLOBAL_PRESSURE_RESPONSE_SCHEMA_V1 || !Array.isArray(record.curve)) {\n    throw new TypeError('unsupported global pressure response state');\n  }\n  return createGlobalPressureResponseSnapshotV1(record.curve as readonly ResponseCurvePointV1[]);\n}\n\nexport interface GlobalPressureResponseControllerV1 {\n  readonly schema: 'illustro.global-pressure-response-controller/1';\n  snapshot(): GlobalPressureResponseSnapshotV1;\n  subscribe(listener: (curve: readonly ResponseCurvePointV1[]) => void): () => void;\n  dispose(): void;\n}\n\nfunction required<T extends Element>(root: ParentNode, selector: string): T {\n  const element = root.querySelector(selector);\n  if (element === null) throw new Error(`global pressure response is missing ${selector}`);\n  return element as T;\n}\n\nexport function installGlobalPressureResponseControllerV1(input: {\n  readonly root: HTMLElement;\n  readonly storage?: Storage | null;\n}): GlobalPressureResponseControllerV1 {\n  const storage = input.storage ?? globalThis.localStorage;\n  let state = createGlobalPressureResponseSnapshotV1();\n  const stored = storage?.getItem(GLOBAL_PRESSURE_RESPONSE_STORAGE_KEY_V1);\n  if (stored !== null && stored !== undefined) {\n    try {\n      state = parseGlobalPressureResponseV1(stored);\n    } catch {\n      state = createGlobalPressureResponseSnapshotV1();\n    }\n  }\n  const listeners = new Set<(curve: readonly ResponseCurvePointV1[]) => void>();\n  let disposed = false;\n\n  const publish = (): void => {\n    input.root.dataset.illustroGlobalPressureCurve = responseCurvePresetIdV1(state.curve);\n    input.root.dataset.illustroGlobalPressureCurvePoints = String(state.curve.length);\n  };\n\n  const editor = installSharedCurveEditorV1({\n    elements: {\n      canvas: required<HTMLCanvasElement>(input.root, '#global-pressure-curve'),\n      preset: required<HTMLSelectElement>(input.root, '#global-pressure-curve-preset'),\n      inputNumber: required<HTMLInputElement>(input.root, '#global-pressure-curve-input'),\n      outputNumber: required<HTMLInputElement>(input.root, '#global-pressure-curve-output'),\n      deleteButton: required<HTMLButtonElement>(input.root, '#global-pressure-curve-delete'),\n      resetButton: required<HTMLButtonElement>(input.root, '#global-pressure-curve-reset'),\n    },\n    initialCurve: state.curve,\n    onChange(curve) {\n      state = createGlobalPressureResponseSnapshotV1(curve);\n      storage?.setItem(\n        GLOBAL_PRESSURE_RESPONSE_STORAGE_KEY_V1,\n        serializeGlobalPressureResponseV1(state),\n      );\n      publish();\n      for (const listener of listeners) listener(state.curve);\n    },\n  });\n  publish();\n\n  return Object.freeze({\n    schema: 'illustro.global-pressure-response-controller/1' as const,\n    snapshot: () => state,\n    subscribe(listener: (curve: readonly ResponseCurvePointV1[]) => void): () => void {\n      listeners.add(listener);\n      listener(state.curve);\n      return () => listeners.delete(listener);\n    },\n    dispose(): void {\n      if (disposed) return;\n      disposed = true;\n      editor.dispose();\n      listeners.clear();\n      input.root.dataset.illustroGlobalPressureCurve = 'disposed';\n    },\n  });\n}\n""",
)

# Brush controller resolves global/default only when the selected preset lacks an explicit override.
replace_once(
    'src/app/brush-preset-controller.ts',
    '  brushPressureResponseCurveV1,\n',
    '  brushPressureResponseCurveOverrideV1,\n  resolveBrushPressureResponseCurveV1,\n',
)
replace_once(
    'src/app/brush-preset-controller.ts',
    "import { responseCurveIsLinearV1 } from '../domain/response-curve.js';\n",
    "import {\n  LINEAR_RESPONSE_CURVE_V1,\n  responseCurveIsLinearV1,\n  type ResponseCurvePointV1,\n} from '../domain/response-curve.js';\n",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    '  updateBrushPresetPressureResponseCurveV1,\n',
    '  updateBrushPresetPressureResponseCurveV1,\n  clearBrushPresetPressureResponseCurveOverrideV1,\n',
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """export interface BrushPresetControllerV1 {\n  snapshot(): BrushPresetLibraryStateV1;\n  refresh(): void;\n  dispose(): void;\n}\n\nexport function installBrushPresetControllerV1(input: {\n  readonly root: HTMLElement;\n  readonly paintSession: PaintSessionControllerV1;\n  readonly storage?: Storage | null;\n  readonly onBrushModeChanged?: () => void;\n}): BrushPresetControllerV1 {\n  const storage = input.storage ?? globalThis.localStorage;\n""",
    """export interface PressureResponseDefaultSourceV1 {\n  snapshot(): { readonly curve: readonly ResponseCurvePointV1[] };\n  subscribe(listener: (curve: readonly ResponseCurvePointV1[]) => void): () => void;\n}\n\nexport interface BrushPresetControllerV1 {\n  snapshot(): BrushPresetLibraryStateV1;\n  refresh(): void;\n  dispose(): void;\n}\n\nexport function installBrushPresetControllerV1(input: {\n  readonly root: HTMLElement;\n  readonly paintSession: PaintSessionControllerV1;\n  readonly storage?: Storage | null;\n  readonly pressureResponseDefault?: PressureResponseDefaultSourceV1;\n  readonly onBrushModeChanged?: () => void;\n}): BrushPresetControllerV1 {\n  const storage = input.storage ?? globalThis.localStorage;\n  const defaultPressureResponseCurve = (): readonly ResponseCurvePointV1[] =>\n    input.pressureResponseDefault?.snapshot().curve ?? LINEAR_RESPONSE_CURVE_V1;\n""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    "  const pressureCurveReset = requireElement('#brush-pressure-curve-reset', HTMLButtonElement);\n",
    "  const pressureCurveReset = requireElement('#brush-pressure-curve-reset', HTMLButtonElement);\n  const pressureCurveOverrideButton = requireElement(\n    '#brush-pressure-curve-override',\n    HTMLButtonElement,\n  );\n",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    const pressureResponseCurve = brushPressureResponseCurveV1(item.preset);\n    input.paintSession.setBrushPressureResponseCurve(pressureResponseCurve);\n""",
    """    const pressureResponseCurve = resolveBrushPressureResponseCurveV1(\n      item.preset,\n      defaultPressureResponseCurve(),\n    );\n    input.paintSession.setBrushPressureResponseCurve(pressureResponseCurve);\n""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    "    input.root.dataset.illustroBrushPressureCurvePoints = String(pressureResponseCurve.length);\n",
    """    input.root.dataset.illustroBrushPressureCurvePoints = String(pressureResponseCurve.length);\n    input.root.dataset.illustroBrushPressureCurveSource =\n      brushPressureResponseCurveOverrideV1(item.preset) === null ? 'global' : 'preset';\n""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    const pressureResponseCurve = brushPressureResponseCurveV1(selected.preset);\n    pressureCurveEditor?.setCurve(pressureResponseCurve);\n""",
    """    const pressureResponseCurveOverride = brushPressureResponseCurveOverrideV1(selected.preset);\n    const pressureResponseCurve = resolveBrushPressureResponseCurveV1(\n      selected.preset,\n      defaultPressureResponseCurve(),\n    );\n    pressureCurveEditor?.setCurve(pressureResponseCurve);\n    pressureCurveOverrideButton.textContent =\n      pressureResponseCurveOverride === null ? 'このブラシで上書き' : '既定に戻す';\n    pressureCurveOverrideButton.setAttribute(\n      'aria-pressed',\n      String(pressureResponseCurveOverride !== null),\n    );\n""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    '      pressureFlowButton,\n      tiltSizeButton,\n',
    '      pressureFlowButton,\n      pressureCurveOverrideButton,\n      tiltSizeButton,\n',
)
replace_once(
    'src/app/brush-preset-controller.ts',
    '    pressureCurveEditor?.setDisabled(locked);\n',
    '    pressureCurveEditor?.setDisabled(locked || pressureResponseCurveOverride === null);\n',
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """    initialCurve: brushPressureResponseCurveV1(selectedBrushPresetItemV1(state).preset),\n    onChange: (curve) =>\n      mutate(() => updateBrushPresetPressureResponseCurveV1(state, state.selectedPresetId, curve)),\n  });\n""",
    """    initialCurve: resolveBrushPressureResponseCurveV1(\n      selectedBrushPresetItemV1(state).preset,\n      defaultPressureResponseCurve(),\n    ),\n    onChange: (curve) => {\n      if (brushPressureResponseCurveOverrideV1(selectedBrushPresetItemV1(state).preset) === null) {\n        return;\n      }\n      mutate(() => updateBrushPresetPressureResponseCurveV1(state, state.selectedPresetId, curve));\n    },\n  });\n""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  const onSearch = (): void => {\n""",
    """  const unsubscribePressureDefault =\n    input.pressureResponseDefault?.subscribe(() => {\n      if (brushPressureResponseCurveOverrideV1(selectedBrushPresetItemV1(state).preset) !== null) {\n        return;\n      }\n      applySelected();\n      render();\n    }) ?? (() => undefined);\n\n  const onSearch = (): void => {\n""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """  const onFlowNumber = (): void => updateParameter({ flow: Number(flowNumber.value) });\n""",
    """  const onFlowNumber = (): void => updateParameter({ flow: Number(flowNumber.value) });\n  const onPressureCurveOverride = (): void => {\n    const selected = selectedBrushPresetItemV1(state).preset;\n    const override = brushPressureResponseCurveOverrideV1(selected);\n    mutate(() =>\n      override === null\n        ? updateBrushPresetPressureResponseCurveV1(\n            state,\n            state.selectedPresetId,\n            defaultPressureResponseCurve(),\n          )\n        : clearBrushPresetPressureResponseCurveOverrideV1(state, state.selectedPresetId),\n    );\n  };\n""",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    "  pressureFlowButton.addEventListener('click', onPressureFlow);\n",
    "  pressureFlowButton.addEventListener('click', onPressureFlow);\n  pressureCurveOverrideButton.addEventListener('click', onPressureCurveOverride);\n",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    "      pressureFlowButton.removeEventListener('click', onPressureFlow);\n",
    "      pressureFlowButton.removeEventListener('click', onPressureFlow);\n      pressureCurveOverrideButton.removeEventListener('click', onPressureCurveOverride);\n",
)
replace_once(
    'src/app/brush-preset-controller.ts',
    """      pressureCurveEditor?.dispose();\n      pressureCurveEditor = null;\n""",
    """      unsubscribePressureDefault();\n      pressureCurveEditor?.dispose();\n      pressureCurveEditor = null;\n""",
)

# Reachable global/default Curve Editor + explicit per-brush override action.
replace_once(
    'src/index.html',
    """              <fieldset class=\"shell-brush-pressure-curve-editor\" aria-label=\"筆圧レスポンスカーブ\">\n                <div class=\"shell-brush-pressure-curve-header\">\n                  <label for=\"brush-pressure-curve-preset\">筆圧カーブ</label>\n                  <select id=\"brush-pressure-curve-preset\" aria-label=\"筆圧カーブプリセット\">\n""",
    """              <fieldset class=\"shell-brush-pressure-curve-editor\" aria-label=\"既定の筆圧レスポンスカーブ\">\n                <div class=\"shell-brush-pressure-curve-header\">\n                  <label for=\"global-pressure-curve-preset\">既定の筆圧カーブ</label>\n                  <select id=\"global-pressure-curve-preset\" aria-label=\"既定の筆圧カーブプリセット\">\n                    <option value=\"linear\">Linear</option>\n                    <option value=\"soft\">Soft</option>\n                    <option value=\"hard\">Hard</option>\n                    <option value=\"s-curve\">S Curve</option>\n                    <option value=\"custom\">Custom</option>\n                  </select>\n                </div>\n                <canvas id=\"global-pressure-curve\" width=\"240\" height=\"128\" tabindex=\"0\" aria-label=\"既定の筆圧レスポンスカーブ。個別上書きのないブラシへ適用\"></canvas>\n                <div class=\"shell-brush-pressure-curve-values\">\n                  <label>入力 <input id=\"global-pressure-curve-input\" type=\"number\" inputmode=\"decimal\" min=\"0\" max=\"100\" step=\"0.1\" value=\"0\" /><span>%</span></label>\n                  <label>出力 <input id=\"global-pressure-curve-output\" type=\"number\" inputmode=\"decimal\" min=\"0\" max=\"100\" step=\"0.1\" value=\"0\" /><span>%</span></label>\n                  <button id=\"global-pressure-curve-delete\" type=\"button\">点を削除</button>\n                  <button id=\"global-pressure-curve-reset\" type=\"button\">Reset</button>\n                </div>\n              </fieldset>\n              <fieldset class=\"shell-brush-pressure-curve-editor\" aria-label=\"ブラシ個別の筆圧レスポンスカーブ\">\n                <div class=\"shell-brush-pressure-curve-header\">\n                  <label for=\"brush-pressure-curve-preset\">筆圧カーブ</label>\n                  <button id=\"brush-pressure-curve-override\" type=\"button\" aria-pressed=\"false\">このブラシで上書き</button>\n                  <select id=\"brush-pressure-curve-preset\" aria-label=\"筆圧カーブプリセット\">\n""",
)

# Main application installs the application-level default before preset resolution.
replace_once(
    'src/app/main.ts',
    "import { installGridControllerV1 } from './grid-controller.js';\n",
    "import { installGridControllerV1 } from './grid-controller.js';\nimport { installGlobalPressureResponseControllerV1 } from './global-pressure-response-controller.js';\n",
)
replace_once(
    'src/app/main.ts',
    """publishBrushMode();\nconst brushPresets = installBrushPresetControllerV1({\n  root,\n  paintSession,\n  storage: globalThis.localStorage,\n""",
    """publishBrushMode();\nconst globalPressureResponse = installGlobalPressureResponseControllerV1({\n  root,\n  storage: globalThis.localStorage,\n});\nconst brushPresets = installBrushPresetControllerV1({\n  root,\n  paintSession,\n  storage: globalThis.localStorage,\n  pressureResponseDefault: globalPressureResponse,\n""",
)
replace_once(
    'src/app/main.ts',
    """    referenceWorkflow.dispose();\n    brushPresets.dispose();\n    colorWorkflow.dispose();\n""",
    """    referenceWorkflow.dispose();\n    brushPresets.dispose();\n    globalPressureResponse.dispose();\n    colorWorkflow.dispose();\n""",
)

# Existing M6A-044 regression now preserves explicit linear, while absence means inherit.
replace_once(
    'tests/unit/brush-pressure-response-curve.test.ts',
    """  it('uses linear identity by default and persists only non-linear preset data', () => {\n""",
    """  it('uses linear identity by default and preserves explicit linear override data', () => {\n""",
)
replace_once(
    'tests/unit/brush-pressure-response-curve.test.ts',
    """    expect(\n      withBrushPressureResponseCurveV1(custom, LINEAR_RESPONSE_CURVE_V1).dynamics\n        .pressureResponseCurve,\n    ).toBeUndefined();\n""",
    """    expect(\n      withBrushPressureResponseCurveV1(custom, LINEAR_RESPONSE_CURVE_V1).dynamics\n        .pressureResponseCurve,\n    ).toBeDefined();\n""",
)

write(
    'tests/unit/global-pressure-response.test.ts',
    """import { describe, expect, it } from 'vitest';\nimport {\n  brushPressureResponseCurveOverrideV1,\n  createBaselineBrushPresetV1,\n  resolveBrushPressureResponseCurveV1,\n  withBrushPressureResponseCurveV1,\n  withoutBrushPressureResponseCurveOverrideV1,\n} from '../../src/domain/brush-schema.js';\nimport {\n  createGlobalPressureResponseSnapshotV1,\n  parseGlobalPressureResponseV1,\n  serializeGlobalPressureResponseV1,\n} from '../../src/app/global-pressure-response-controller.js';\nimport { LINEAR_RESPONSE_CURVE_V1 } from '../../src/domain/response-curve.js';\n\nconst SOFT_CURVE = Object.freeze([\n  Object.freeze({ input: 0, output: 0 }),\n  Object.freeze({ input: 0.35, output: 0.6 }),\n  Object.freeze({ input: 1, output: 1 }),\n]);\n\nfunction preset() {\n  return createBaselineBrushPresetV1({\n    id: 'global.pressure.test',\n    name: 'Global Pressure Test',\n    category: 'Test',\n    behavior: 'paint',\n  });\n}\n\ndescribe('M6A-068 global/default pressure response controls', () => {\n  it('inherits the global curve only when a brush has no explicit override', () => {\n    const inherited = preset();\n    expect(brushPressureResponseCurveOverrideV1(inherited)).toBeNull();\n    expect(resolveBrushPressureResponseCurveV1(inherited, SOFT_CURVE)).toEqual(SOFT_CURVE);\n\n    const explicitLinear = withBrushPressureResponseCurveV1(inherited, LINEAR_RESPONSE_CURVE_V1);\n    expect(brushPressureResponseCurveOverrideV1(explicitLinear)).toEqual(\n      LINEAR_RESPONSE_CURVE_V1,\n    );\n    expect(resolveBrushPressureResponseCurveV1(explicitLinear, SOFT_CURVE)).toEqual(\n      LINEAR_RESPONSE_CURVE_V1,\n    );\n  });\n\n  it('returns to global inheritance only through explicit override clearing', () => {\n    const overridden = withBrushPressureResponseCurveV1(preset(), SOFT_CURVE);\n    const cleared = withoutBrushPressureResponseCurveOverrideV1(overridden);\n    expect(brushPressureResponseCurveOverrideV1(cleared)).toBeNull();\n    expect(resolveBrushPressureResponseCurveV1(cleared, SOFT_CURVE)).toEqual(SOFT_CURVE);\n  });\n\n  it('persists one normalized application-level default curve independently from presets', () => {\n    const state = createGlobalPressureResponseSnapshotV1(SOFT_CURVE);\n    expect(parseGlobalPressureResponseV1(serializeGlobalPressureResponseV1(state))).toEqual(state);\n    expect(createGlobalPressureResponseSnapshotV1().curve).toEqual(LINEAR_RESPONSE_CURVE_V1);\n  });\n});\n""",
)

# Canonical memo + restart ledger.
with Path('ILLUSTRO_DESIGN_MEMO.md').open('a', encoding='utf-8') as handle:
    handle.write(
        """\n\n## M6A global/default pressure-response boundary — 2026-09-04\n\nM6A-068 adopts one application-level **global/default pressure response curve** in addition to the existing per-brush pressure response curve. The global curve is a persistent user preference and defaults to linear identity. A brush preset with no explicit `dynamics.pressureResponseCurve` inherits the current global curve; a preset with an explicit curve overrides it. Explicit linear override is valid and must remain distinguishable from inheritance when the global curve is non-linear. Returning a brush to inheritance is therefore an explicit override-clear action rather than an implicit consequence of choosing Linear.\n\nBoth global/default and per-brush response use the existing shared Curve Editor interaction. Global changes immediately re-resolve the currently selected brush only when it inherits the default; they do not rewrite brush preset payloads. The resolved curve continues to enter the existing `PaintSessionControllerV1` before canonical stroke construction, so Renderer/Worker/History/Persistence primitive ABIs do not change. M6A-068 does not redefine pressure minimum/maximum response bounds, tilt/velocity/random curves, device calibration, touch correction, or OS/driver behavior.\n"""
    )

replace_once(
    'IMPLEMENTATION_PROGRESS.md',
    'M6A-068 global/default pressure response controls:未完了\n',
    'M6A-068 global/default pressure response controls:完了\n再開メモ: M6A-068はapplication-levelのglobal/default pressure response curve（既定linear、localStorage永続）をShared Curve Editorへ接続した。Brush presetに`dynamics.pressureResponseCurve`が無い場合だけglobalを継承し、明示curveはglobalをoverrideする。globalがnon-linearでもper-brush explicit Linearを表現できるようLinear選択でもoverride fieldを保持し、「既定に戻す」でのみfieldを削除する。global変更はinherit中の選択brushへ即時再解決するがpreset payload自体は書換えず、解決後curveは既存PaintSessionへ渡すためRenderer/Worker/History/Persistence ABIは不変。次はM6A-069 touch-position/input correction policyから再開する。\n',
)

# Extend the M6A contract verifier with the new inheritance boundary.
with Path('scripts/verify-m6a-brush.mjs').open('a', encoding='utf-8') as handle:
    handle.write(
        """\n\nrequireText(progress, 'M6A-068 global/default pressure response controls:完了', 'M6A-068 progress is not complete');\nrequireText(\n  read('src/domain/brush-schema.ts'),\n  'brushPressureResponseCurveOverrideV1',\n  'per-brush pressure response override identity missing',\n);\nrequireText(\n  read('src/domain/brush-schema.ts'),\n  'resolveBrushPressureResponseCurveV1',\n  'global/default pressure response resolver missing',\n);\nrequireText(\n  read('src/app/global-pressure-response-controller.ts'),\n  'GLOBAL_PRESSURE_RESPONSE_STORAGE_KEY_V1',\n  'persistent global pressure response controller missing',\n);\nrequireText(\n  read('src/app/brush-preset-controller.ts'),\n  'pressureResponseDefault',\n  'brush preset controller does not consume global pressure default',\n);\nrequireText(\n  read('src/index.html'),\n  'id=\"global-pressure-curve\"',\n  'reachable global pressure Curve Editor missing',\n);\nrequireText(\n  read('src/index.html'),\n  'id=\"brush-pressure-curve-override\"',\n  'reachable per-brush pressure override control missing',\n);\nrequireText(\n  read('tests/unit/global-pressure-response.test.ts'),\n  'inherits the global curve only when a brush has no explicit override',\n  'global/default pressure inheritance regression coverage missing',\n);\n"""
    )
