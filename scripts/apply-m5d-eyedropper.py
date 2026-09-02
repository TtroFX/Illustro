from pathlib import Path


def replace_once(path: str, before: str, after: str) -> None:
    p = Path(path)
    text = p.read_text()
    count = text.count(before)
    if count != 1:
        raise SystemExit(f'{path}: expected one anchor, got {count}: {before[:120]!r}')
    p.write_text(text.replace(before, after, 1))


Path('src/app/color-sampling.ts').write_text(r'''import { freezeRgbUnitColorV1, type RgbUnitColorV1 } from '../domain/color.js';
import type { CanvasBackgroundSpec } from '../domain/document.js';
import type { PointerInputBatchV1 } from '../input/pointer-input.js';
import {
  readBaselineRasterTilePixelV1,
  type BaselineRasterTileImageV1,
} from '../gpu/baseline-raster-tile-store.js';
import { CANONICAL_TILE_SIZE_PX } from '../gpu/sparse-tile-model.js';

export type ColorSamplingSourceV1 = 'active-layer' | 'merged-canvas';
export type SampledRgbaV1 = readonly [number, number, number, number];

export interface RasterTileSamplingIndexV1 {
  readonly schema: 'illustro.raster-tile-sampling-index/1';
  sampleRgba(documentX: number, documentY: number): SampledRgbaV1 | null;
}

export interface ColorSamplingOwnershipDecisionV1 {
  readonly consumed: boolean;
  readonly shouldSample: boolean;
  readonly finalize: boolean;
  readonly cancel: boolean;
}

export interface ColorSamplingOwnershipSnapshotV1 {
  readonly schema: 'illustro.color-sampling-ownership/1';
  readonly explicitEnabled: boolean;
  readonly quickEnabled: boolean;
  readonly active: boolean;
  readonly ownedPointerCount: number;
}

const PASS_DECISION: ColorSamplingOwnershipDecisionV1 = Object.freeze({
  consumed: false,
  shouldSample: false,
  finalize: false,
  cancel: false,
});

function samplingDecision(
  shouldSample: boolean,
  finalize = false,
  cancel = false,
): ColorSamplingOwnershipDecisionV1 {
  return Object.freeze({ consumed: true, shouldSample, finalize, cancel });
}

export class ColorSamplingOwnershipV1 {
  #explicitEnabled = false;
  #quickEnabled = false;
  readonly #ownedPointers = new Set<number>();

  setExplicitEnabled(enabled: boolean): ColorSamplingOwnershipSnapshotV1 {
    this.#explicitEnabled = enabled;
    return this.snapshot();
  }

  setQuickEnabled(enabled: boolean): ColorSamplingOwnershipSnapshotV1 {
    this.#quickEnabled = enabled;
    return this.snapshot();
  }

  snapshot(): ColorSamplingOwnershipSnapshotV1 {
    return Object.freeze({
      schema: 'illustro.color-sampling-ownership/1' as const,
      explicitEnabled: this.#explicitEnabled,
      quickEnabled: this.#quickEnabled,
      active: this.#explicitEnabled || this.#quickEnabled,
      ownedPointerCount: this.#ownedPointers.size,
    });
  }

  route(batch: PointerInputBatchV1): ColorSamplingOwnershipDecisionV1 {
    if (batch.eventType === 'pointerdown' && this.snapshot().active) {
      this.#ownedPointers.add(batch.pointerId);
    }
    if (!this.#ownedPointers.has(batch.pointerId)) return PASS_DECISION;

    if (batch.eventType === 'pointercancel') {
      this.#ownedPointers.delete(batch.pointerId);
      return samplingDecision(false, false, true);
    }
    if (batch.eventType === 'pointerup') {
      this.#ownedPointers.delete(batch.pointerId);
      return samplingDecision(true, true, false);
    }
    if (
      batch.eventType === 'pointerdown' ||
      batch.eventType === 'pointermove' ||
      batch.eventType === 'pointerrawupdate'
    ) {
      return samplingDecision(batch.eventType !== 'pointerrawupdate');
    }
    return samplingDecision(false);
  }
}

function tileCoordinateKey(tx: number, ty: number): string {
  return `${tx}:${ty}`;
}

export function createRasterTileSamplingIndexV1(
  tiles: readonly BaselineRasterTileImageV1[],
  layerId?: string,
): RasterTileSamplingIndexV1 {
  const tileMap = new Map<string, BaselineRasterTileImageV1>();
  for (const tile of tiles) {
    if (layerId !== undefined && tile.layerId !== layerId) continue;
    tileMap.set(tileCoordinateKey(tile.coordinate.tx, tile.coordinate.ty), tile);
  }
  return Object.freeze({
    schema: 'illustro.raster-tile-sampling-index/1' as const,
    sampleRgba(documentX: number, documentY: number): SampledRgbaV1 | null {
      if (!Number.isFinite(documentX) || !Number.isFinite(documentY)) return null;
      const pixelX = Math.floor(documentX);
      const pixelY = Math.floor(documentY);
      if (pixelX < 0 || pixelY < 0) return null;
      const tx = Math.floor(pixelX / CANONICAL_TILE_SIZE_PX);
      const ty = Math.floor(pixelY / CANONICAL_TILE_SIZE_PX);
      const tile = tileMap.get(tileCoordinateKey(tx, ty));
      if (tile === undefined) return null;
      const localX = pixelX - tx * CANONICAL_TILE_SIZE_PX;
      const localY = pixelY - ty * CANONICAL_TILE_SIZE_PX;
      if (localX < 0 || localY < 0 || localX >= tile.width || localY >= tile.height) return null;
      return readBaselineRasterTilePixelV1(tile, localY * tile.width + localX);
    },
  });
}

function rgbaToRgbOrNull(rgba: SampledRgbaV1 | null): RgbUnitColorV1 | null {
  if (rgba === null || rgba[3] <= 0) return null;
  return freezeRgbUnitColorV1([rgba[0], rgba[1], rgba[2]]);
}

export function sampleActiveLayerColorV1(
  index: RasterTileSamplingIndexV1,
  documentX: number,
  documentY: number,
): RgbUnitColorV1 | null {
  return rgbaToRgbOrNull(index.sampleRgba(documentX, documentY));
}

export function sampleMergedCanvasColorV1(
  index: RasterTileSamplingIndexV1,
  documentX: number,
  documentY: number,
  background: CanvasBackgroundSpec,
): RgbUnitColorV1 | null {
  const source = index.sampleRgba(documentX, documentY);
  if (background.kind === 'transparent') return rgbaToRgbOrNull(source);

  const backdrop = background.rgba;
  if (source === null || source[3] <= 0) {
    if (backdrop[3] <= 0) return null;
    return freezeRgbUnitColorV1([backdrop[0], backdrop[1], backdrop[2]]);
  }
  const sourceAlpha = source[3];
  const backdropWeight = backdrop[3] * (1 - sourceAlpha);
  const outputAlpha = sourceAlpha + backdropWeight;
  if (outputAlpha <= 0) return null;
  return freezeRgbUnitColorV1([
    (source[0] * sourceAlpha + backdrop[0] * backdropWeight) / outputAlpha,
    (source[1] * sourceAlpha + backdrop[1] * backdropWeight) / outputAlpha,
    (source[2] * sourceAlpha + backdrop[2] * backdropWeight) / outputAlpha,
  ]);
}
''')

replace_once(
    'src/gpu/baseline-raster-tile-store.ts',
    '''function writePixel(\n  image: BaselineRasterTileImageV1,\n  pixel: number,\n  rgba: readonly [number, number, number, number],\n): void {''',
    '''export function readBaselineRasterTilePixelV1(\n  image: BaselineRasterTileImageV1,\n  pixel: number,\n): readonly [number, number, number, number] {\n  if (!Number.isSafeInteger(pixel) || pixel < 0 || pixel >= image.width * image.height) {\n    throw new RangeError('baseline raster tile pixel index is out of range');\n  }\n  return Object.freeze(readPixel(image, pixel));\n}\n\nfunction writePixel(\n  image: BaselineRasterTileImageV1,\n  pixel: number,\n  rgba: readonly [number, number, number, number],\n): void {''',
)

replace_once(
    'src/app/color-workflow-controller.ts',
    "import type { PaintSessionControllerV1 } from './paint-session-controller.js';\n",
    """import type { DocumentV1 } from '../domain/document.js';
import type { PointerInputBatchV1, PointerInputSampleV1 } from '../input/pointer-input.js';
import type { PaintSessionControllerV1 } from './paint-session-controller.js';
import {
  ColorSamplingOwnershipV1,
  createRasterTileSamplingIndexV1,
  sampleActiveLayerColorV1,
  sampleMergedCanvasColorV1,
  type ColorSamplingSourceV1,
  type RasterTileSamplingIndexV1,
} from './color-sampling.js';
""",
)

replace_once(
    'src/app/color-workflow-controller.ts',
    '''export interface ColorWorkflowControllerV1 {\n  refresh(): void;\n  dispose(): void;\n  snapshot(): ColorWorkspaceStateV1;\n}\n\nexport function installColorWorkflowControllerV1(input: {\n  readonly root: HTMLElement;\n  readonly paintSession: PaintSessionControllerV1;\n  readonly storage?: Storage | null;\n}): ColorWorkflowControllerV1 {''',
    '''export interface ColorWorkflowControllerV1 {\n  refresh(): void;\n  dispose(): void;\n  snapshot(): ColorWorkspaceStateV1;\n  ingestPointerBatch(batch: PointerInputBatchV1): boolean;\n}\n\nexport function installColorWorkflowControllerV1(input: {\n  readonly root: HTMLElement;\n  readonly paintSession: PaintSessionControllerV1;\n  readonly mapPointerToDocument: (\n    sample: PointerInputSampleV1,\n    documentValue: DocumentV1,\n  ) => { readonly x: number; readonly y: number };\n  readonly storage?: Storage | null;\n}): ColorWorkflowControllerV1 {''',
)

replace_once(
    'src/app/color-workflow-controller.ts',
    "  const previousSwatch = requireElement('#color-previous', HTMLButtonElement);\n  const history = requireElement('#color-history', HTMLDivElement);\n",
    """  const previousSwatch = requireElement('#color-previous', HTMLButtonElement);
  const eyedropper = requireElement('#color-eyedropper', HTMLButtonElement);
  const samplingSourceSelect = requireElement('#color-sampling-source', HTMLSelectElement);
  const history = requireElement('#color-history', HTMLDivElement);
""",
)

replace_once(
    'src/app/color-workflow-controller.ts',
    '''  let state = loadState(storage);\n  let interactionStart: RgbUnitColorV1 | null = null;\n  let selectedPaletteColorIndex: number | null = null;\n  let disposed = false;\n''',
    '''  let state = loadState(storage);\n  let interactionStart: RgbUnitColorV1 | null = null;\n  let selectedPaletteColorIndex: number | null = null;\n  let disposed = false;\n  const samplingOwnership = new ColorSamplingOwnershipV1();\n  let samplingStartColor: RgbUnitColorV1 | null = null;\n  let samplingDocument: DocumentV1 | null = null;\n  let samplingSource: ColorSamplingSourceV1 = 'merged-canvas';\n  let samplingIndexPromise: Promise<RasterTileSamplingIndexV1> | null = null;\n  let samplingRequestSequence = 0;\n''',
)

replace_once(
    'src/app/color-workflow-controller.ts',
    '''    input.root.dataset.illustroColorWorkingSpace = workingSpace();\n  };\n\n  const commit = (''',
    '''    input.root.dataset.illustroColorWorkingSpace = workingSpace();\n    publishSamplingState();\n  };\n\n  function publishSamplingState(): void {\n    const ownership = samplingOwnership.snapshot();\n    const mode = ownership.explicitEnabled\n      ? 'eyedropper'\n      : ownership.quickEnabled\n        ? 'quick-eyedropper'\n        : 'inactive';\n    eyedropper.classList.toggle('is-active', ownership.explicitEnabled);\n    eyedropper.setAttribute('aria-pressed', String(ownership.explicitEnabled));\n    input.root.dataset.illustroColorSamplingMode = mode;\n    input.root.dataset.illustroColorSamplingSource = samplingSourceSelect.value;\n  }\n\n  const commit = (''',
)

replace_once(
    'src/app/color-workflow-controller.ts',
    '''  const preview = (color: RgbUnitColorV1, redrawSv = true): void => {\n    state = previewColorWorkspaceCurrentV1(state, color);\n    status.value = '';\n    publish(redrawSv);\n  };\n\n  function drawWheel(): void {''',
    '''  const preview = (color: RgbUnitColorV1, redrawSv = true): void => {\n    state = previewColorWorkspaceCurrentV1(state, color);\n    status.value = '';\n    publish(redrawSv);\n  };\n\n  const publishSamplingPreview = (color: RgbUnitColorV1): void => {\n    state = previewColorWorkspaceCurrentV1(state, color);\n    const rgbBytes = rgbUnitToBytesV1(state.current);\n    const hsv = rgbToHsvV1(state.current);\n    redInput.value = String(rgbBytes[0]);\n    greenInput.value = String(rgbBytes[1]);\n    blueInput.value = String(rgbBytes[2]);\n    hueInput.value = String(Math.round(hsv.h));\n    saturationInput.value = String(Math.round(hsv.s * 100));\n    valueInput.value = String(Math.round(hsv.v * 100));\n    hexInput.value = formatHexRgbV1(state.current);\n    currentSwatch.style.background = cssEncodedRgbV1(state.current, workingSpace());\n    currentSwatch.title = `Current ${hexInput.value}`;\n    input.paintSession.setPaintColor(state.current);\n    input.root.dataset.illustroCurrentColor = hexInput.value;\n  };\n\n  function drawWheel(): void {''',
)

sampling_logic = r'''
  const selectedSamplingSource = (): ColorSamplingSourceV1 =>
    samplingSourceSelect.value === 'active-layer' ? 'active-layer' : 'merged-canvas';

  const resetSamplingSession = (): void => {
    samplingRequestSequence += 1;
    samplingStartColor = null;
    samplingDocument = null;
    samplingIndexPromise = null;
  };

  const beginSamplingSession = (): void => {
    if (samplingStartColor !== null) {
      commit(state.current, samplingStartColor);
      resetSamplingSession();
    }
    samplingStartColor = state.current;
    samplingDocument = input.paintSession.currentDocument();
    samplingSource = selectedSamplingSource();
    const activeLayerId = input.paintSession.activeLayerId();
    if (samplingDocument === null) {
      samplingIndexPromise = null;
      return;
    }
    samplingIndexPromise =
      samplingSource === 'active-layer'
        ? input.paintSession
            .exportCanonicalRasterTiles()
            .then((tiles) => createRasterTileSamplingIndexV1(tiles, activeLayerId ?? '__missing__'))
        : input.paintSession
            .exportCompositeRasterTiles()
            .then((tiles) => createRasterTileSamplingIndexV1(tiles));
  };

  const cancelSamplingSession = (): void => {
    const start = samplingStartColor;
    samplingRequestSequence += 1;
    if (start !== null) {
      state = previewColorWorkspaceCurrentV1(state, start);
      status.value = '採色をキャンセルしました';
      publish();
    }
    resetSamplingSession();
  };

  const queueSampling = (sample: PointerInputSampleV1, finalize: boolean): void => {
    const documentValue = samplingDocument;
    const indexPromise = samplingIndexPromise;
    const start = samplingStartColor;
    if (documentValue === null || indexPromise === null || start === null) {
      status.value = '採色には開いているドキュメントが必要です';
      if (finalize) resetSamplingSession();
      return;
    }
    const point = input.mapPointerToDocument(sample, documentValue);
    const requestSequence = ++samplingRequestSequence;
    const source = samplingSource;
    void indexPromise
      .then((index) => {
        if (disposed || requestSequence !== samplingRequestSequence) return;
        const color =
          source === 'active-layer'
            ? sampleActiveLayerColorV1(index, point.x, point.y)
            : sampleMergedCanvasColorV1(index, point.x, point.y, documentValue.canvas.background);
        if (color !== null) {
          publishSamplingPreview(color);
          status.value = `${source === 'active-layer' ? 'アクティブレイヤー' : '結合表示'}から採色 ${formatHexRgbV1(color)}`;
        } else {
          status.value = 'この位置には採色できる色がありません';
        }
        if (finalize) {
          commit(state.current, start);
          status.value = color === null ? '採色できる色がありませんでした' : `採色 ${formatHexRgbV1(state.current)}`;
          resetSamplingSession();
          publishSamplingState();
        }
      })
      .catch((error: unknown) => {
        if (requestSequence !== samplingRequestSequence) return;
        status.value = error instanceof Error ? error.message : String(error);
        if (finalize) {
          state = previewColorWorkspaceCurrentV1(state, start);
          publish();
          resetSamplingSession();
        }
      });
  };

  const onEyedropperToggle = (): void => {
    const snapshot = samplingOwnership.snapshot();
    samplingOwnership.setExplicitEnabled(!snapshot.explicitEnabled);
    status.value = samplingOwnership.snapshot().explicitEnabled ? 'スポイト: ON' : 'スポイト: OFF';
    publishSamplingState();
  };

  const onSamplingSourceChange = (): void => {
    samplingSource = selectedSamplingSource();
    status.value = samplingSource === 'active-layer' ? '採色元: アクティブレイヤー' : '採色元: 結合表示';
    publishSamplingState();
  };

  const isTextEditingTarget = (target: EventTarget | null): boolean =>
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable);

  const onQuickEyedropperKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'Alt' || isTextEditingTarget(event.target)) return;
    samplingOwnership.setQuickEnabled(true);
    publishSamplingState();
    event.preventDefault();
  };
  const onQuickEyedropperKeyUp = (event: KeyboardEvent): void => {
    if (event.key !== 'Alt') return;
    samplingOwnership.setQuickEnabled(false);
    publishSamplingState();
    event.preventDefault();
  };
  const onWindowBlur = (): void => {
    samplingOwnership.setQuickEnabled(false);
    publishSamplingState();
  };
'''

replace_once(
    'src/app/color-workflow-controller.ts',
    '''  const removeWheel = installCanvasGesture(wheel, updateWheel);\n  const removeSv = installCanvasGesture(sv, updateSv);\n\n  const commitRgb = (): void => {''',
    '''  const removeWheel = installCanvasGesture(wheel, updateWheel);\n  const removeSv = installCanvasGesture(sv, updateSv);\n''' + sampling_logic + '''\n  const commitRgb = (): void => {''',
)

replace_once(
    'src/app/color-workflow-controller.ts',
    '''  paletteExport.addEventListener('click', onPaletteExport);\n\n  publish();''',
    '''  paletteExport.addEventListener('click', onPaletteExport);\n  eyedropper.addEventListener('click', onEyedropperToggle);\n  samplingSourceSelect.addEventListener('change', onSamplingSourceChange);\n  document.addEventListener('keydown', onQuickEyedropperKeyDown);\n  document.addEventListener('keyup', onQuickEyedropperKeyUp);\n  window.addEventListener('blur', onWindowBlur);\n\n  samplingSource = selectedSamplingSource();\n  publish();''',
)

replace_once(
    'src/app/color-workflow-controller.ts',
    '''      paletteFile.removeEventListener('change', onPaletteImportChange);\n      paletteExport.removeEventListener('click', onPaletteExport);\n      input.root.dataset.illustroColorWorkflow = 'disposed';''',
    '''      paletteFile.removeEventListener('change', onPaletteImportChange);\n      paletteExport.removeEventListener('click', onPaletteExport);\n      eyedropper.removeEventListener('click', onEyedropperToggle);\n      samplingSourceSelect.removeEventListener('change', onSamplingSourceChange);\n      document.removeEventListener('keydown', onQuickEyedropperKeyDown);\n      document.removeEventListener('keyup', onQuickEyedropperKeyUp);\n      window.removeEventListener('blur', onWindowBlur);\n      resetSamplingSession();\n      input.root.dataset.illustroColorWorkflow = 'disposed';''',
)

replace_once(
    'src/app/color-workflow-controller.ts',
    '''    snapshot(): ColorWorkspaceStateV1 {\n      return state;\n    },\n  };''',
    '''    snapshot(): ColorWorkspaceStateV1 {\n      return state;\n    },\n    ingestPointerBatch(batch: PointerInputBatchV1): boolean {\n      if (disposed) return false;\n      const decision = samplingOwnership.route(batch);\n      if (!decision.consumed) return false;\n      input.root.dataset.illustroColorSamplingPointer = String(batch.pointerId);\n      if (decision.cancel) {\n        cancelSamplingSession();\n        return true;\n      }\n      const latest = batch.confirmed.at(-1);\n      if (latest === undefined) return true;\n      if (batch.eventType === 'pointerdown') beginSamplingSession();\n      if (decision.shouldSample) queueSampling(latest, decision.finalize);\n      return true;\n    },\n  };''',
)

replace_once(
    'src/app/main.ts',
    "const colorWorkflow = installColorWorkflowControllerV1({ root, paintSession });",
    """const colorWorkflow = installColorWorkflowControllerV1({
  root,
  paintSession,
  mapPointerToDocument: (sample, documentValue) =>
    viewport.mapPointerToDocument(sample, documentValue),
});""",
)

replace_once(
    'src/app/main.ts',
    '''  } else if (arbitration.forwardBatch !== null) {\n    const maskPaintResult = maskPaint.ingestPointerBatch(arbitration.forwardBatch);\n    if (maskPaintResult.consumed) {''',
    '''  } else if (arbitration.forwardBatch !== null) {\n    const colorSamplingConsumed = colorWorkflow.ingestPointerBatch(arbitration.forwardBatch);\n    if (colorSamplingConsumed) {\n      root.dataset.illustroPointerDisposition = 'eyedropper';\n      incrementPerformanceCounter('color.sampling.batch');\n    } else {\n      const maskPaintResult = maskPaint.ingestPointerBatch(arbitration.forwardBatch);\n      if (maskPaintResult.consumed) {''',
)

replace_once(
    'src/app/main.ts',
    '''      pointerTransport.enqueueBatch(arbitration.forwardBatch);\n    }\n  }\n});''',
    '''        pointerTransport.enqueueBatch(arbitration.forwardBatch);\n      }\n    }\n  }\n});''',
)

replace_once(
    'src/index.html',
    '''            <div class="shell-color-swatches">\n              <button id="color-current" type="button" aria-label="現在の色"></button>\n              <button id="color-previous" type="button" aria-label="前の色へ交換"></button>\n            </div>\n            <div class="shell-color-entry-grid shell-color-entry-rgb">''',
    '''            <div class="shell-color-swatches">\n              <button id="color-current" type="button" aria-label="現在の色"></button>\n              <button id="color-previous" type="button" aria-label="前の色へ交換"></button>\n            </div>\n            <div class="shell-color-sampling">\n              <button id="color-eyedropper" type="button" aria-pressed="false" title="スポイト（Alt / Optionで一時使用）">スポイト</button>\n              <label>採色元\n                <select id="color-sampling-source">\n                  <option value="merged-canvas">結合表示</option>\n                  <option value="active-layer">アクティブレイヤー</option>\n                </select>\n              </label>\n            </div>\n            <div class="shell-color-entry-grid shell-color-entry-rgb">''',
)

css = Path('public/app-shell.css')
css_text = css.read_text()
css_marker = '/* M5D eyedropper sampling */'
if css_marker in css_text:
    raise SystemExit('M5D eyedropper CSS already exists')
css.write_text(css_text + r'''

/* M5D eyedropper sampling */
.shell-color-sampling {
  display: grid;
  grid-template-columns: minmax(5rem, auto) 1fr;
  gap: 0.4rem;
  align-items: end;
}

.shell-color-sampling > button,
.shell-color-sampling select {
  min-height: 2.75rem;
}

.shell-color-sampling > button.is-active {
  box-shadow: inset 0 0 0 2px currentColor;
  font-weight: 700;
}

.shell-color-sampling label {
  display: grid;
  gap: 0.2rem;
  font-size: 0.72rem;
}
''')

Path('tests/unit/color-sampling.test.ts').write_text(r'''import { describe, expect, it } from 'vitest';
import {
  ColorSamplingOwnershipV1,
  createRasterTileSamplingIndexV1,
  sampleActiveLayerColorV1,
  sampleMergedCanvasColorV1,
} from '../../src/app/color-sampling.js';
import { rgbUnitToBytesV1 } from '../../src/domain/color.js';
import type { BaselineRasterTileImageV1 } from '../../src/gpu/baseline-raster-tile-store.js';
import type { PointerInputBatchV1 } from '../../src/input/pointer-input.js';

function rgba8Tile(
  layerId: string,
  tx: number,
  ty: number,
  rgba: readonly [number, number, number, number],
): BaselineRasterTileImageV1 {
  return Object.freeze({
    schema: 'illustro.baseline-raster-tile/1' as const,
    layerId,
    coordinate: Object.freeze({ tx, ty }),
    width: 1,
    height: 1,
    pixelFormat: 'rgba8-unorm' as const,
    bytes: new Uint8Array(rgba),
  });
}

function rgba16Tile(layerId: string): BaselineRasterTileImageV1 {
  const bytes = new Uint8Array(8);
  const view = new DataView(bytes.buffer);
  view.setUint16(0, 0x3800, true); // 0.5
  view.setUint16(2, 0x3400, true); // 0.25
  view.setUint16(4, 0x3c00, true); // 1.0
  view.setUint16(6, 0x3c00, true); // alpha 1.0
  return Object.freeze({
    schema: 'illustro.baseline-raster-tile/1' as const,
    layerId,
    coordinate: Object.freeze({ tx: 0, ty: 0 }),
    width: 1,
    height: 1,
    pixelFormat: 'rgba16-float' as const,
    bytes,
  });
}

function batch(eventType: PointerInputBatchV1['eventType'], pointerId = 7): PointerInputBatchV1 {
  return Object.freeze({
    schema: 'illustro.pointer-batch/1' as const,
    eventType,
    pointerId,
    confirmed: Object.freeze([]),
    predicted: Object.freeze([]),
  });
}

describe('M5D eyedropper sampling', () => {
  it('samples only the requested active layer and preserves encoded RGB components', () => {
    const index = createRasterTileSamplingIndexV1(
      [rgba8Tile('other', 0, 0, [255, 0, 0, 255]), rgba8Tile('active', 0, 0, [12, 130, 240, 255])],
      'active',
    );
    expect(rgbUnitToBytesV1(sampleActiveLayerColorV1(index, 0.25, 0.75)!)).toEqual([12, 130, 240]);
  });

  it('returns no active-layer color for transparent pixels', () => {
    const index = createRasterTileSamplingIndexV1([rgba8Tile('active', 0, 0, [200, 10, 40, 0])], 'active');
    expect(sampleActiveLayerColorV1(index, 0, 0)).toBeNull();
  });

  it('decodes rgba16-float tiles through the canonical raster pixel reader', () => {
    const index = createRasterTileSamplingIndexV1([rgba16Tile('active')], 'active');
    const color = sampleActiveLayerColorV1(index, 0, 0);
    expect(color).not.toBeNull();
    expect(color?.[0]).toBeCloseTo(0.5, 4);
    expect(color?.[1]).toBeCloseTo(0.25, 4);
    expect(color?.[2]).toBeCloseTo(1, 4);
  });

  it('samples merged pixels over the canonical solid canvas background', () => {
    const index = createRasterTileSamplingIndexV1([rgba8Tile('__composite__', 0, 0, [255, 0, 0, 128])]);
    const color = sampleMergedCanvasColorV1(index, 0, 0, {
      kind: 'solid',
      rgba: [0, 0, 1, 1],
    });
    expect(color).not.toBeNull();
    expect(color?.[0]).toBeCloseTo(128 / 255, 3);
    expect(color?.[1]).toBeCloseTo(0, 3);
    expect(color?.[2]).toBeCloseTo(127 / 255, 3);
  });

  it('keeps a quick-eyedropper pointer transaction owned until up', () => {
    const ownership = new ColorSamplingOwnershipV1();
    expect(ownership.route(batch('pointerdown')).consumed).toBe(false);
    ownership.setQuickEnabled(true);
    expect(ownership.route(batch('pointerdown'))).toMatchObject({ consumed: true, shouldSample: true });
    ownership.setQuickEnabled(false);
    expect(ownership.route(batch('pointermove'))).toMatchObject({ consumed: true, shouldSample: true });
    expect(ownership.route(batch('pointerup'))).toMatchObject({ consumed: true, finalize: true });
    expect(ownership.snapshot().ownedPointerCount).toBe(0);
  });

  it('reports cancellation so second-touch arbitration can abort sampling atomically', () => {
    const ownership = new ColorSamplingOwnershipV1();
    ownership.setExplicitEnabled(true);
    ownership.route(batch('pointerdown', 3));
    expect(ownership.route(batch('pointercancel', 3))).toMatchObject({
      consumed: true,
      shouldSample: false,
      finalize: false,
      cancel: true,
    });
  });
});
''')

replace_once(
    'scripts/verify-m5d-color.mjs',
    "requireText('src/gpu/baseline-raster-tile-store.ts', ['rasterizeColorDab', 'baselineDabColorV1']);",
    """requireText('src/gpu/baseline-raster-tile-store.ts', [
  'rasterizeColorDab',
  'baselineDabColorV1',
  'readBaselineRasterTilePixelV1',
]);
requireText('src/app/color-sampling.ts', [
  'ColorSamplingOwnershipV1',
  'createRasterTileSamplingIndexV1',
  'sampleActiveLayerColorV1',
  'sampleMergedCanvasColorV1',
]);
requireText('src/app/main.ts', ['colorWorkflow.ingestPointerBatch', "'eyedropper'"]);
""",
)

replace_once(
    'scripts/verify-m5d-color.mjs',
    "  '#color-history',\n  '#color-palette-select',",
    "  '#color-history',\n  '#color-eyedropper',\n  '#color-sampling-source',\n  'ingestPointerBatch',\n  '#color-palette-select',",
)

replace_once(
    'scripts/verify-m5d-color.mjs',
    "  'id=\"color-history\"',\n  'id=\"color-palette-select\"',",
    "  'id=\"color-history\"',\n  'id=\"color-eyedropper\"',\n  'id=\"color-sampling-source\"',\n  'id=\"color-palette-select\"',",
)

replace_once(
    'scripts/verify-m5d-color.mjs',
    "  'M5D-015 palette export:完了',\n  'M5D-016 Eyedropper:未完了',",
    "  'M5D-015 palette export:完了',\n  'M5D-016 Eyedropper:完了',\n  'M5D-017 quick Eyedropper:完了',\n  'M5D-018 active-layer sampling:完了',\n  'M5D-019 merged-canvas sampling:完了',\n  'M5D-020 reference-image sampling:未完了',",
)

progress = Path('IMPLEMENTATION_PROGRESS.md')
progress_text = progress.read_text()
for item in [
    'M5D-016 Eyedropper',
    'M5D-017 quick Eyedropper',
    'M5D-018 active-layer sampling',
    'M5D-019 merged-canvas sampling',
]:
    before = f'{item}:未完了'
    after = f'{item}:完了'
    if progress_text.count(before) != 1:
        raise SystemExit(f'progress anchor missing: {before}')
    progress_text = progress_text.replace(before, after, 1)
progress.write_text(progress_text)

memo = Path('ILLUSTRO_DESIGN_MEMO.md')
memo_text = memo.read_text()
memo_marker = '#### M5D eyedropper sampling semantic boundary — 2026-09-02'
if memo_marker in memo_text:
    raise SystemExit('M5D sampling memo already exists')
memo.write_text(memo_text + r'''


#### M5D eyedropper sampling semantic boundary — 2026-09-02

- M5D-016 through M5D-019 add a production-connected Eyedropper without creating a parallel input stack. Eyedropper ownership is evaluated after Pointer Arbitration and before Mask Paint / normal Paint ingestion, so a consumed sampling transaction cannot simultaneously create or finalize a paint stroke.
- Explicit Eyedropper mode and quick Eyedropper (`Alt` / `Option` while held) use the same pointer-transaction ownership state. Once sampling owns a pointer-down transaction it retains that pointer until up/cancel; a cancellation restores the pre-sampling color and does not commit color history. This allows the existing second-Touch cancellation path to transfer ownership to multi-touch navigation atomically.
- `active-layer` sampling reads the canonical sparse Raster Tile state for the active layer only. A fully transparent active-layer pixel produces no color sample. `merged-canvas` sampling reads the canonical compositor output after visibility, layer opacity, blend modes, masks and clipping; the document's solid canvas background is composited for the sampled display color when present.
- Sampling supports both canonical `rgba8-unorm` and `rgba16-float` tile precision through one exported canonical raster-pixel reader. A per-gesture tile-coordinate index is built once so pointer-move sampling does not linearly rescan all sparse tiles on every sample.
- Sampled RGB components remain encoded values in the active document working space. M5D-016 through M5D-019 do **not** claim sRGB/Display-P3 conversion or ICC/profile conversion; those semantics remain assigned to M5D-021 through M5D-025.
- Reference-image sampling remains intentionally separate as M5D-020 and must not be marked complete until the Reference/Sub View resource path is production-connected.
''')
