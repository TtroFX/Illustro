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
        raise RuntimeError(f'{path}: expected one match, found {count}: {old[:120]!r}')
    write(path, text.replace(old, new, 1))


# Input arbitration owns touch-tool correction so navigation/pen/mouse stay untouched.
replace_once(
    'src/input/input-arbitration.ts',
    "export const DEFAULT_PALM_CONTACT_THRESHOLD_CSS_PX_V1 = 18;\n",
    "export const DEFAULT_PALM_CONTACT_THRESHOLD_CSS_PX_V1 = 18;\nexport const TOUCH_POSITION_OFFSET_LIMIT_CSS_PX_V1 = 256;\n",
)
replace_once(
    'src/input/input-arbitration.ts',
    """export interface PointerInputArbitrationOptionsV1 {\n  readonly fingerDrawingEnabled?: boolean;\n  readonly recentPenBiasMs?: number;\n  readonly palmContactThresholdCssPx?: number;\n}\n""",
    """export interface PointerInputArbitrationOptionsV1 {\n  readonly fingerDrawingEnabled?: boolean;\n  readonly recentPenBiasMs?: number;\n  readonly palmContactThresholdCssPx?: number;\n  readonly touchOffsetXCssPx?: number;\n  readonly touchOffsetYCssPx?: number;\n}\n""",
)
replace_once(
    'src/input/input-arbitration.ts',
    """  readonly fingerDrawingEnabled: boolean;\n  readonly activePenContacts: number;\n""",
    """  readonly fingerDrawingEnabled: boolean;\n  readonly touchOffsetXCssPx: number;\n  readonly touchOffsetYCssPx: number;\n  readonly activePenContacts: number;\n""",
)
replace_once(
    'src/input/input-arbitration.ts',
    """function mapTouchSampleToToolV1(sample: PointerInputSampleV1): PointerInputSampleV1 {\n  if (sample.source !== 'touch') return sample;\n  return Object.freeze({ ...sample, source: 'mouse' as const });\n}\n\nfunction mapTouchBatchToToolV1(batch: PointerInputBatchV1): PointerInputBatchV1 {\n  return Object.freeze({\n    ...batch,\n    confirmed: Object.freeze(batch.confirmed.map(mapTouchSampleToToolV1)),\n    predicted: Object.freeze(batch.predicted.map(mapTouchSampleToToolV1)),\n  });\n}\n\nfunction cancellationBatchV1(sample: PointerInputSampleV1): PointerInputBatchV1 {\n  const cancelled = mapTouchSampleToToolV1(\n""",
    """function normalizeTouchOffsetCssPxV1(value: number, label: string): number {\n  if (!Number.isFinite(value)) throw new RangeError(`${label} must be finite`);\n  if (Math.abs(value) > TOUCH_POSITION_OFFSET_LIMIT_CSS_PX_V1) {\n    throw new RangeError(\n      `${label} must be within -${TOUCH_POSITION_OFFSET_LIMIT_CSS_PX_V1}..${TOUCH_POSITION_OFFSET_LIMIT_CSS_PX_V1}`,\n    );\n  }\n  return Object.is(value, -0) ? 0 : value;\n}\n\nfunction mapTouchSampleToToolV1(\n  sample: PointerInputSampleV1,\n  offsetXCssPx: number,\n  offsetYCssPx: number,\n): PointerInputSampleV1 {\n  if (sample.source !== 'touch') return sample;\n  return Object.freeze({\n    ...sample,\n    source: 'mouse' as const,\n    clientX: sample.clientX + offsetXCssPx,\n    clientY: sample.clientY + offsetYCssPx,\n    surfaceX: sample.surfaceX + offsetXCssPx,\n    surfaceY: sample.surfaceY + offsetYCssPx,\n  });\n}\n\nfunction mapTouchBatchToToolV1(\n  batch: PointerInputBatchV1,\n  offsetXCssPx: number,\n  offsetYCssPx: number,\n): PointerInputBatchV1 {\n  return Object.freeze({\n    ...batch,\n    confirmed: Object.freeze(\n      batch.confirmed.map((sample) => mapTouchSampleToToolV1(sample, offsetXCssPx, offsetYCssPx)),\n    ),\n    predicted: Object.freeze(\n      batch.predicted.map((sample) => mapTouchSampleToToolV1(sample, offsetXCssPx, offsetYCssPx)),\n    ),\n  });\n}\n\nfunction cancellationBatchV1(\n  sample: PointerInputSampleV1,\n  offsetXCssPx: number,\n  offsetYCssPx: number,\n): PointerInputBatchV1 {\n  const cancelled = mapTouchSampleToToolV1(\n""",
)
replace_once(
    'src/input/input-arbitration.ts',
    """      button: -1,\n    }),\n  );\n""",
    """      button: -1,\n    }),\n    offsetXCssPx,\n    offsetYCssPx,\n  );\n""",
)
replace_once(
    'src/input/input-arbitration.ts',
    """  #fingerDrawingEnabled: boolean;\n  readonly #recentPenBiasMs: number;\n""",
    """  #fingerDrawingEnabled: boolean;\n  #touchOffsetXCssPx: number;\n  #touchOffsetYCssPx: number;\n  readonly #recentPenBiasMs: number;\n""",
)
replace_once(
    'src/input/input-arbitration.ts',
    """  constructor(options: PointerInputArbitrationOptionsV1 = {}) {\n    this.#fingerDrawingEnabled = options.fingerDrawingEnabled ?? defaultFingerDrawingEnabledV1();\n    this.#recentPenBiasMs = options.recentPenBiasMs ?? DEFAULT_RECENT_PEN_BIAS_MS_V1;\n""",
    """  constructor(options: PointerInputArbitrationOptionsV1 = {}) {\n    this.#fingerDrawingEnabled = options.fingerDrawingEnabled ?? defaultFingerDrawingEnabledV1();\n    this.#touchOffsetXCssPx = normalizeTouchOffsetCssPxV1(\n      options.touchOffsetXCssPx ?? 0,\n      'touch offset X',\n    );\n    this.#touchOffsetYCssPx = normalizeTouchOffsetCssPxV1(\n      options.touchOffsetYCssPx ?? 0,\n      'touch offset Y',\n    );\n    this.#recentPenBiasMs = options.recentPenBiasMs ?? DEFAULT_RECENT_PEN_BIAS_MS_V1;\n""",
)
replace_once(
    'src/input/input-arbitration.ts',
    """      fingerDrawingEnabled: this.#fingerDrawingEnabled,\n      activePenContacts: this.#activePenPointers.size,\n""",
    """      fingerDrawingEnabled: this.#fingerDrawingEnabled,\n      touchOffsetXCssPx: this.#touchOffsetXCssPx,\n      touchOffsetYCssPx: this.#touchOffsetYCssPx,\n      activePenContacts: this.#activePenPointers.size,\n""",
)
replace_once(
    'src/input/input-arbitration.ts',
    """  setFingerDrawingEnabled(enabled: boolean): PointerInputArbitrationSnapshotV1 {\n    this.#fingerDrawingEnabled = enabled;\n    return this.snapshot();\n  }\n\n  #routePen(\n""",
    """  setFingerDrawingEnabled(enabled: boolean): PointerInputArbitrationSnapshotV1 {\n    this.#fingerDrawingEnabled = enabled;\n    return this.snapshot();\n  }\n\n  setTouchPositionOffset(\n    offsetXCssPx: number,\n    offsetYCssPx: number,\n  ): PointerInputArbitrationSnapshotV1 {\n    this.#touchOffsetXCssPx = normalizeTouchOffsetCssPxV1(offsetXCssPx, 'touch offset X');\n    this.#touchOffsetYCssPx = normalizeTouchOffsetCssPxV1(offsetYCssPx, 'touch offset Y');\n    return this.snapshot();\n  }\n\n  #routePen(\n""",
)
replace_once(
    'src/input/input-arbitration.ts',
    '              transitionCancelBatch = cancellationBatchV1(previous);\n',
    """              transitionCancelBatch = cancellationBatchV1(\n                previous,\n                this.#touchOffsetXCssPx,\n                this.#touchOffsetYCssPx,\n              );\n""",
)
replace_once(
    'src/input/input-arbitration.ts',
    """    const forwardBatch =\n      transitionCancelBatch ?? (disposition === 'tool' ? mapTouchBatchToToolV1(batch) : null);\n""",
    """    const forwardBatch =\n      transitionCancelBatch ??\n      (disposition === 'tool'\n        ? mapTouchBatchToToolV1(batch, this.#touchOffsetXCssPx, this.#touchOffsetYCssPx)\n        : null);\n""",
)

# Persistent application-level UI/policy controller.
write(
    'src/app/touch-input-policy-controller.ts',
    """import {\n  TOUCH_POSITION_OFFSET_LIMIT_CSS_PX_V1,\n  type PointerInputArbitrationV1,\n} from '../input/input-arbitration.js';\n\nexport const TOUCH_INPUT_POLICY_SCHEMA_V1 = 'illustro.touch-input-policy/1' as const;\nexport const TOUCH_INPUT_POLICY_STORAGE_KEY_V1 = 'illustro.touch-input-policy/1' as const;\n\nexport interface TouchInputPolicySnapshotV1 {\n  readonly schema: typeof TOUCH_INPUT_POLICY_SCHEMA_V1;\n  readonly fingerDrawingEnabled: boolean;\n  readonly offsetXCssPx: number;\n  readonly offsetYCssPx: number;\n}\n\nfunction normalizeOffset(value: number, label: string): number {\n  if (!Number.isFinite(value) || Math.abs(value) > TOUCH_POSITION_OFFSET_LIMIT_CSS_PX_V1) {\n    throw new RangeError(\n      `${label} must be within -${TOUCH_POSITION_OFFSET_LIMIT_CSS_PX_V1}..${TOUCH_POSITION_OFFSET_LIMIT_CSS_PX_V1}`,\n    );\n  }\n  return Object.is(value, -0) ? 0 : value;\n}\n\nexport function createTouchInputPolicySnapshotV1(input: {\n  readonly fingerDrawingEnabled?: boolean;\n  readonly offsetXCssPx?: number;\n  readonly offsetYCssPx?: number;\n} = {}): TouchInputPolicySnapshotV1 {\n  const fingerDrawingEnabled = input.fingerDrawingEnabled ?? true;\n  if (typeof fingerDrawingEnabled !== 'boolean') {\n    throw new TypeError('finger drawing policy must be boolean');\n  }\n  return Object.freeze({\n    schema: TOUCH_INPUT_POLICY_SCHEMA_V1,\n    fingerDrawingEnabled,\n    offsetXCssPx: normalizeOffset(input.offsetXCssPx ?? 0, 'touch offset X'),\n    offsetYCssPx: normalizeOffset(input.offsetYCssPx ?? 0, 'touch offset Y'),\n  });\n}\n\nexport function serializeTouchInputPolicyV1(snapshot: TouchInputPolicySnapshotV1): string {\n  return JSON.stringify(snapshot);\n}\n\nexport function parseTouchInputPolicyV1(raw: string): TouchInputPolicySnapshotV1 {\n  const value: unknown = JSON.parse(raw);\n  if (typeof value !== 'object' || value === null || Array.isArray(value)) {\n    throw new TypeError('touch input policy must be an object');\n  }\n  const record = value as Record<string, unknown>;\n  if (record.schema !== TOUCH_INPUT_POLICY_SCHEMA_V1) {\n    throw new TypeError('unsupported touch input policy schema');\n  }\n  return createTouchInputPolicySnapshotV1({\n    fingerDrawingEnabled: record.fingerDrawingEnabled as boolean,\n    offsetXCssPx: record.offsetXCssPx as number,\n    offsetYCssPx: record.offsetYCssPx as number,\n  });\n}\n\nexport interface TouchInputPolicyControllerV1 {\n  readonly schema: 'illustro.touch-input-policy-controller/1';\n  snapshot(): TouchInputPolicySnapshotV1;\n  dispose(): void;\n}\n\nfunction required<T extends Element>(root: ParentNode, selector: string): T {\n  const element = root.querySelector(selector);\n  if (element === null) throw new Error(`touch input policy is missing ${selector}`);\n  return element as T;\n}\n\nfunction closeMenu(element: Element): void {\n  element.closest('details')?.removeAttribute('open');\n}\n\nexport function installTouchInputPolicyControllerV1(input: {\n  readonly root: HTMLElement;\n  readonly arbitration: PointerInputArbitrationV1;\n  readonly storage?: Storage | null;\n}): TouchInputPolicyControllerV1 {\n  const storage = input.storage ?? globalThis.localStorage;\n  const openButton = required<HTMLButtonElement>(input.root, '#view-touch-input-settings');\n  const dialog = required<HTMLDialogElement>(input.root, '#touch-input-dialog');\n  const form = required<HTMLFormElement>(input.root, '#touch-input-form');\n  const fingerButton = required<HTMLButtonElement>(input.root, '#touch-finger-drawing');\n  const offsetXRange = required<HTMLInputElement>(input.root, '#touch-offset-x-range');\n  const offsetXNumber = required<HTMLInputElement>(input.root, '#touch-offset-x-number');\n  const offsetYRange = required<HTMLInputElement>(input.root, '#touch-offset-y-range');\n  const offsetYNumber = required<HTMLInputElement>(input.root, '#touch-offset-y-number');\n  const resetButton = required<HTMLButtonElement>(input.root, '#touch-input-reset');\n  const cancelButton = required<HTMLButtonElement>(input.root, '#touch-input-cancel');\n  const status = required<HTMLOutputElement>(input.root, '#touch-input-status');\n  let state = createTouchInputPolicySnapshotV1();\n  let draftFingerDrawingEnabled = state.fingerDrawingEnabled;\n  let disposed = false;\n\n  const stored = storage?.getItem(TOUCH_INPUT_POLICY_STORAGE_KEY_V1);\n  if (stored !== null && stored !== undefined) {\n    try {\n      state = parseTouchInputPolicyV1(stored);\n    } catch {\n      state = createTouchInputPolicySnapshotV1();\n    }\n  }\n\n  const publish = (): void => {\n    input.arbitration.setFingerDrawingEnabled(state.fingerDrawingEnabled);\n    input.arbitration.setTouchPositionOffset(state.offsetXCssPx, state.offsetYCssPx);\n    input.root.dataset.illustroPointerFingerDrawing = state.fingerDrawingEnabled\n      ? 'enabled'\n      : 'disabled';\n    input.root.dataset.illustroTouchOffsetXCssPx = String(state.offsetXCssPx);\n    input.root.dataset.illustroTouchOffsetYCssPx = String(state.offsetYCssPx);\n  };\n\n  const setFingerDraft = (enabled: boolean): void => {\n    draftFingerDrawingEnabled = enabled;\n    fingerButton.textContent = enabled ? 'ON' : 'OFF';\n    fingerButton.setAttribute('aria-pressed', String(enabled));\n  };\n\n  const setOffsetPair = (\n    range: HTMLInputElement,\n    number: HTMLInputElement,\n    value: number,\n  ): void => {\n    range.value = String(value);\n    number.value = String(value);\n  };\n\n  const populate = (): void => {\n    setFingerDraft(state.fingerDrawingEnabled);\n    setOffsetPair(offsetXRange, offsetXNumber, state.offsetXCssPx);\n    setOffsetPair(offsetYRange, offsetYNumber, state.offsetYCssPx);\n    status.value = '';\n  };\n\n  const onOpen = (): void => {\n    closeMenu(openButton);\n    populate();\n    if (typeof dialog.showModal === 'function') dialog.showModal();\n    else dialog.setAttribute('open', '');\n  };\n  const onFingerToggle = (): void => setFingerDraft(!draftFingerDrawingEnabled);\n  const onXRange = (): void => { offsetXNumber.value = offsetXRange.value; };\n  const onXNumber = (): void => { offsetXRange.value = offsetXNumber.value; };\n  const onYRange = (): void => { offsetYNumber.value = offsetYRange.value; };\n  const onYNumber = (): void => { offsetYRange.value = offsetYNumber.value; };\n  const onReset = (): void => {\n    setFingerDraft(true);\n    setOffsetPair(offsetXRange, offsetXNumber, 0);\n    setOffsetPair(offsetYRange, offsetYNumber, 0);\n    status.value = '';\n  };\n  const onCancel = (): void => dialog.close();\n  const onSubmit = (event: SubmitEvent): void => {\n    event.preventDefault();\n    try {\n      state = createTouchInputPolicySnapshotV1({\n        fingerDrawingEnabled: draftFingerDrawingEnabled,\n        offsetXCssPx: Number(offsetXNumber.value),\n        offsetYCssPx: Number(offsetYNumber.value),\n      });\n      storage?.setItem(TOUCH_INPUT_POLICY_STORAGE_KEY_V1, serializeTouchInputPolicyV1(state));\n      publish();\n      status.value = '';\n      dialog.close();\n    } catch (error) {\n      status.value = error instanceof Error ? error.message : String(error);\n      input.root.dataset.illustroTouchInputError = status.value;\n    }\n  };\n\n  openButton.addEventListener('click', onOpen);\n  fingerButton.addEventListener('click', onFingerToggle);\n  offsetXRange.addEventListener('input', onXRange);\n  offsetXNumber.addEventListener('input', onXNumber);\n  offsetYRange.addEventListener('input', onYRange);\n  offsetYNumber.addEventListener('input', onYNumber);\n  resetButton.addEventListener('click', onReset);\n  cancelButton.addEventListener('click', onCancel);\n  form.addEventListener('submit', onSubmit);\n  publish();\n\n  return Object.freeze({\n    schema: 'illustro.touch-input-policy-controller/1' as const,\n    snapshot: () => state,\n    dispose(): void {\n      if (disposed) return;\n      disposed = true;\n      openButton.removeEventListener('click', onOpen);\n      fingerButton.removeEventListener('click', onFingerToggle);\n      offsetXRange.removeEventListener('input', onXRange);\n      offsetXNumber.removeEventListener('input', onXNumber);\n      offsetYRange.removeEventListener('input', onYRange);\n      offsetYNumber.removeEventListener('input', onYNumber);\n      resetButton.removeEventListener('click', onReset);\n      cancelButton.removeEventListener('click', onCancel);\n      form.removeEventListener('submit', onSubmit);\n      input.root.dataset.illustroTouchInputPolicy = 'disposed';\n    },\n  });\n}\n""",
)

# Main installs the user-level policy before any pointer batch can be routed.
replace_once(
    'src/app/main.ts',
    "import { installGridControllerV1 } from './grid-controller.js';\n",
    "import { installGridControllerV1 } from './grid-controller.js';\nimport { installTouchInputPolicyControllerV1 } from './touch-input-policy-controller.js';\n",
)
replace_once(
    'src/app/main.ts',
    """const pointerArbitration = createPointerInputArbitrationV1();\nconst pointerHover = new PointerHoverTrackerV1();\n""",
    """const pointerArbitration = createPointerInputArbitrationV1();\nconst touchInputPolicy = installTouchInputPolicyControllerV1({\n  root,\n  arbitration: pointerArbitration,\n  storage: globalThis.localStorage,\n});\nconst pointerHover = new PointerHoverTrackerV1();\n""",
)
replace_once(
    'src/app/main.ts',
    """    viewport.dispose();\n    pointerInput.dispose();\n""",
    """    viewport.dispose();\n    touchInputPolicy.dispose();\n    pointerInput.dispose();\n""",
)

# Reachable settings UI with slider+numeric pairs, reusing the normal dialog system.
replace_once(
    'src/index.html',
    """              <button id=\"view-grid-settings\" type=\"button\">グリッド設定…</button>\n              <button id=\"view-brush-crosshair\" type=\"button\" aria-pressed=\"false\">ブラシ中心十字</button>\n""",
    """              <button id=\"view-grid-settings\" type=\"button\">グリッド設定…</button>\n              <button id=\"view-touch-input-settings\" type=\"button\">タッチ入力設定…</button>\n              <button id=\"view-brush-crosshair\" type=\"button\" aria-pressed=\"false\">ブラシ中心十字</button>\n""",
)
replace_once(
    'src/index.html',
    """    <dialog id=\"grid-dialog\" class=\"document-dialog\" aria-labelledby=\"grid-dialog-title\">\n""",
    """    <dialog id=\"touch-input-dialog\" class=\"document-dialog\" aria-labelledby=\"touch-input-dialog-title\">\n      <form id=\"touch-input-form\" method=\"dialog\" class=\"document-dialog-form\">\n        <header><h2 id=\"touch-input-dialog-title\">タッチ入力設定</h2></header>\n        <div class=\"touch-input-policy-grid\">\n          <div class=\"touch-input-policy-toggle\">\n            <span>指で描画</span>\n            <button id=\"touch-finger-drawing\" type=\"button\" aria-pressed=\"true\">ON</button>\n          </div>\n          <div class=\"touch-input-offset-row\">\n            <label for=\"touch-offset-x-range\">横補正</label>\n            <input id=\"touch-offset-x-range\" type=\"range\" min=\"-256\" max=\"256\" step=\"1\" value=\"0\" />\n            <span class=\"touch-input-offset-number\"><input id=\"touch-offset-x-number\" type=\"number\" inputmode=\"decimal\" min=\"-256\" max=\"256\" step=\"1\" value=\"0\" aria-label=\"タッチ横補正\" /><span>px</span></span>\n          </div>\n          <div class=\"touch-input-offset-row\">\n            <label for=\"touch-offset-y-range\">縦補正</label>\n            <input id=\"touch-offset-y-range\" type=\"range\" min=\"-256\" max=\"256\" step=\"1\" value=\"0\" />\n            <span class=\"touch-input-offset-number\"><input id=\"touch-offset-y-number\" type=\"number\" inputmode=\"decimal\" min=\"-256\" max=\"256\" step=\"1\" value=\"0\" aria-label=\"タッチ縦補正\" /><span>px</span></span>\n          </div>\n          <p class=\"document-dialog-help\">単指で描画するタッチ位置だけを補正します。ペン、マウス、ピンチ・パン操作には適用されません。</p>\n        </div>\n        <output id=\"touch-input-status\" class=\"document-dialog-status\" aria-live=\"polite\"></output>\n        <footer>\n          <button id=\"touch-input-reset\" type=\"button\" class=\"document-dialog-secondary\">リセット</button>\n          <button id=\"touch-input-cancel\" type=\"button\" class=\"document-dialog-secondary\">キャンセル</button>\n          <button type=\"submit\" class=\"document-dialog-primary\">適用</button>\n        </footer>\n      </form>\n    </dialog>\n    <dialog id=\"grid-dialog\" class=\"document-dialog\" aria-labelledby=\"grid-dialog-title\">\n""",
)

with Path('public/app-shell.css').open('a', encoding='utf-8') as handle:
    handle.write(
        """\n\n/* M6A-069 touch input correction */\n.touch-input-policy-grid { display: grid; gap: 12px; }\n.touch-input-policy-toggle,\n.touch-input-offset-row {\n  display: grid;\n  grid-template-columns: 72px minmax(120px, 1fr) 86px;\n  gap: 10px;\n  align-items: center;\n}\n.touch-input-policy-toggle > button { grid-column: 2 / -1; min-height: 36px; }\n.touch-input-offset-row > input[type='range'] { width: 100%; min-width: 0; }\n.touch-input-offset-number { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 4px; }\n.touch-input-offset-number input { width: 100%; min-width: 0; }\n@media (max-width: 640px) {\n  .touch-input-policy-toggle,\n  .touch-input-offset-row { grid-template-columns: 64px minmax(0, 1fr); }\n  .touch-input-policy-toggle > button { grid-column: 2; }\n  .touch-input-offset-number { grid-column: 2; }\n}\n"""
    )

# Regression coverage: correction is only on the touch tool bridge and preserves raw input.
with Path('tests/unit/input-arbitration.test.ts').open('a', encoding='utf-8') as handle:
    handle.write(
        """\n\ndescribe('M6A-069 touch-position/input correction policy', () => {\n  it('offsets confirmed and predicted touch tool samples without mutating the raw batch', () => {\n    const arbitration = new PointerInputArbitrationV1({\n      fingerDrawingEnabled: true,\n      touchOffsetXCssPx: 12,\n      touchOffsetYCssPx: -7,\n    });\n    const confirmed = sample('touch', 'pointerdown', {\n      pointerId: 20,\n      clientX: 100,\n      clientY: 80,\n      surfaceX: 90,\n      surfaceY: 70,\n    });\n    const predicted = sample('touch', 'pointerdown', {\n      pointerId: 20,\n      origin: 'predicted',\n      clientX: 104,\n      clientY: 84,\n      surfaceX: 94,\n      surfaceY: 74,\n    });\n    const raw = Object.freeze({\n      schema: 'illustro.pointer-batch/1' as const,\n      eventType: 'pointerdown' as const,\n      pointerId: 20,\n      confirmed: Object.freeze([confirmed]),\n      predicted: Object.freeze([predicted]),\n    });\n\n    const decision = arbitration.route(raw);\n    expect(decision.forwardBatch?.confirmed[0]).toMatchObject({\n      source: 'mouse',\n      clientX: 112,\n      clientY: 73,\n      surfaceX: 102,\n      surfaceY: 63,\n    });\n    expect(decision.forwardBatch?.predicted[0]).toMatchObject({\n      source: 'mouse',\n      clientX: 116,\n      clientY: 77,\n      surfaceX: 106,\n      surfaceY: 67,\n    });\n    expect(raw.confirmed[0]).toBe(confirmed);\n    expect(confirmed).toMatchObject({ clientX: 100, clientY: 80, surfaceX: 90, surfaceY: 70 });\n  });\n\n  it('keeps navigation touch uncorrected and lets the policy update at runtime', () => {\n    const arbitration = new PointerInputArbitrationV1({ fingerDrawingEnabled: false });\n    arbitration.setTouchPositionOffset(-20, 30);\n    expect(arbitration.snapshot()).toMatchObject({\n      fingerDrawingEnabled: false,\n      touchOffsetXCssPx: -20,\n      touchOffsetYCssPx: 30,\n    });\n    const decision = arbitration.route(\n      batch(sample('touch', 'pointerdown', { clientX: 50, clientY: 60 })),\n    );\n    expect(decision).toMatchObject({ disposition: 'navigation', forwardBatch: null });\n  });\n});\n"""
    )

write(
    'tests/unit/touch-input-policy.test.ts',
    """import { describe, expect, it } from 'vitest';\nimport {\n  createTouchInputPolicySnapshotV1,\n  parseTouchInputPolicyV1,\n  serializeTouchInputPolicyV1,\n} from '../../src/app/touch-input-policy-controller.js';\n\ndescribe('M6A-069 touch input policy persistence', () => {\n  it('defaults to finger drawing with zero position correction', () => {\n    expect(createTouchInputPolicySnapshotV1()).toEqual({\n      schema: 'illustro.touch-input-policy/1',\n      fingerDrawingEnabled: true,\n      offsetXCssPx: 0,\n      offsetYCssPx: 0,\n    });\n  });\n\n  it('round-trips finite CSS-pixel correction settings', () => {\n    const state = createTouchInputPolicySnapshotV1({\n      fingerDrawingEnabled: false,\n      offsetXCssPx: -18,\n      offsetYCssPx: 24,\n    });\n    expect(parseTouchInputPolicyV1(serializeTouchInputPolicyV1(state))).toEqual(state);\n  });\n\n  it('rejects correction outside the bounded application-side range', () => {\n    expect(() => createTouchInputPolicySnapshotV1({ offsetXCssPx: 257 })).toThrow(RangeError);\n  });\n});\n""",
)

with Path('ILLUSTRO_DESIGN_MEMO.md').open('a', encoding='utf-8') as handle:
    handle.write(
        """\n\n## M6A touch-position/input-correction boundary — 2026-09-04\n\nM6A-069 makes the existing application-side touch policy user-reachable and adds persistent touch-position correction. The user may enable/disable one-finger drawing and set X/Y offsets in CSS pixels; the default is finger drawing enabled with 0/0 offset. Offsets are bounded to ±256 CSS px and are applied consistently to `clientX/clientY` and `surfaceX/surfaceY` on both confirmed and predicted samples only after a touch pointer has been classified as a **tool** input. The raw Pointer Event batch remains immutable.\n\nPen and mouse input are never position-corrected by this policy. Touches classified as navigation, multi-touch pinch/pan, or rejected palm contacts are not corrected; existing application-side palm rejection remains authoritative before the touch-to-tool bridge. This policy does not claim or attempt control over OS/driver-level palm rejection, digitizer calibration, browser coordinate generation, or platform behavior that is not exposed to the web application. Settings are user/application preferences rather than brush preset or document state.\n"""
    )

replace_once(
    'IMPLEMENTATION_PROGRESS.md',
    'M6A-069 touch-position/input correction policy:未完了\n',
    'M6A-069 touch-position/input correction policy:完了\n再開メモ: M6A-069は既存PointerInputArbitrationV1のpalm rejection/finger-drawing境界を維持し、application-level touch policyをlocalStorage永続UIへ接続した。指描画ON/OFFとX/Y補正（各±256 CSS px、既定0）を設定でき、補正はtouchが単指toolと判定された後のbridgeだけでconfirmed/predicted双方のclientX/clientYとsurfaceX/surfaceYへ適用する。raw batchはimmutable、pen/mouse・palm reject・multi-touch navigation/pinch/panは完全identity。OS/driver/browser内部の未公開palm rejectionやdigitizer calibrationは制御対象外。次はM6A-070 configurable stylus-button action plumbingから再開する。\n',
)

with Path('scripts/verify-m6a-brush.mjs').open('a', encoding='utf-8') as handle:
    handle.write(
        """\n\nrequireText(progress, 'M6A-069 touch-position/input correction policy:完了', 'M6A-069 progress is not complete');\nrequireText(\n  read('src/input/input-arbitration.ts'),\n  'setTouchPositionOffset',\n  'touch-position correction is not connected to input arbitration',\n);\nrequireText(\n  read('src/input/input-arbitration.ts'),\n  'mapTouchBatchToToolV1(batch, this.#touchOffsetXCssPx, this.#touchOffsetYCssPx)',\n  'touch tool bridge does not apply configured correction',\n);\nrequireText(\n  read('src/app/touch-input-policy-controller.ts'),\n  'TOUCH_INPUT_POLICY_STORAGE_KEY_V1',\n  'persistent touch input policy controller missing',\n);\nrequireText(\n  read('src/index.html'),\n  'id=\"view-touch-input-settings\"',\n  'reachable touch input settings command missing',\n);\nrequireText(\n  read('src/index.html'),\n  'id=\"touch-offset-x-range\"',\n  'intuitive touch X correction slider missing',\n);\nrequireText(\n  read('tests/unit/input-arbitration.test.ts'),\n  'offsets confirmed and predicted touch tool samples without mutating the raw batch',\n  'touch tool correction regression coverage missing',\n);\n"""
    )
