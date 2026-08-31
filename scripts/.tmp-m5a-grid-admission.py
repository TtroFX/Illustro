from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    if old not in text:
        raise SystemExit(f'replacement target missing in {path}: {old[:120]!r}')
    file.write_text(text.replace(old, new, 1))


Path('src/app/grid-controller.ts').write_text(r'''import type { ViewportControllerV1, ViewportSnapshotV1 } from './viewport-controller.js';

export const GRID_MIN_SPACING_PX_V1 = 1;
export const GRID_MAX_SPACING_PX_V1 = 32_768;
export const DEFAULT_GRID_SPACING_PX_V1 = 64;
export const DEFAULT_GRID_COLOR_V1 = '#64748b' as const;

export interface GridSettingsSnapshotV1 {
  readonly schema: 'illustro.grid-settings/1';
  readonly enabled: boolean;
  readonly spacing: number;
  readonly offsetX: number;
  readonly offsetY: number;
  readonly color: string;
}

function safeInteger(value: number, label: string): number {
  if (!Number.isSafeInteger(value)) throw new RangeError(`${label} must be a safe integer`);
  return value;
}

function normalizeColor(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!/^#[0-9a-f]{6}$/.test(normalized)) throw new TypeError('grid color must be #RRGGBB');
  return normalized;
}

export class GridSettingsV1 {
  #enabled = false;
  #spacing = DEFAULT_GRID_SPACING_PX_V1;
  #offsetX = 0;
  #offsetY = 0;
  #color = DEFAULT_GRID_COLOR_V1;

  snapshot(): GridSettingsSnapshotV1 {
    return Object.freeze({
      schema: 'illustro.grid-settings/1' as const,
      enabled: this.#enabled,
      spacing: this.#spacing,
      offsetX: this.#offsetX,
      offsetY: this.#offsetY,
      color: this.#color,
    });
  }

  setEnabled(enabled: boolean): GridSettingsSnapshotV1 {
    this.#enabled = enabled;
    return this.snapshot();
  }

  toggle(): GridSettingsSnapshotV1 {
    this.#enabled = !this.#enabled;
    return this.snapshot();
  }

  configure(input: {
    readonly spacing: number;
    readonly offsetX: number;
    readonly offsetY: number;
    readonly color: string;
  }): GridSettingsSnapshotV1 {
    const spacing = safeInteger(input.spacing, 'grid spacing');
    if (spacing < GRID_MIN_SPACING_PX_V1 || spacing > GRID_MAX_SPACING_PX_V1) {
      throw new RangeError(
        `grid spacing must be in ${GRID_MIN_SPACING_PX_V1}..${GRID_MAX_SPACING_PX_V1}`,
      );
    }
    this.#spacing = spacing;
    this.#offsetX = safeInteger(input.offsetX, 'grid offsetX');
    this.#offsetY = safeInteger(input.offsetY, 'grid offsetY');
    this.#color = normalizeColor(input.color);
    return this.snapshot();
  }
}

export interface GridControllerV1 {
  readonly schema: 'illustro.grid-controller/1';
  snapshot(): GridSettingsSnapshotV1;
  dispose(): void;
}

function required<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (element === null) throw new Error(`grid controller is missing ${selector}`);
  return element;
}

function closeMenu(element: Element): void {
  element.closest('details')?.removeAttribute('open');
}

function integerInput(input: HTMLInputElement, label: string): number {
  const value = Number(input.value);
  if (!Number.isSafeInteger(value)) throw new RangeError(`${label} must be an integer`);
  return value;
}

function positiveModulo(value: number, modulus: number): number {
  return ((value % modulus) + modulus) % modulus;
}

export function installGridControllerV1(input: {
  readonly viewport: ViewportControllerV1;
  readonly root?: HTMLElement;
}): GridControllerV1 {
  const root = input.root ?? document.documentElement;
  const viewport = input.viewport;
  const overlay = required<HTMLElement>('#canvas-grid-overlay');
  const toggleButton = required<HTMLButtonElement>('#view-grid-toggle');
  const settingsButton = required<HTMLButtonElement>('#view-grid-settings');
  const dialog = required<HTMLDialogElement>('#grid-dialog');
  const form = required<HTMLFormElement>('#grid-form');
  const spacingInput = required<HTMLInputElement>('#grid-spacing');
  const offsetXInput = required<HTMLInputElement>('#grid-offset-x');
  const offsetYInput = required<HTMLInputElement>('#grid-offset-y');
  const colorInput = required<HTMLInputElement>('#grid-color');
  const status = required<HTMLOutputElement>('#grid-status');
  const cancelButton = required<HTMLButtonElement>('#grid-cancel');
  const state = new GridSettingsV1();

  const publish = (viewportState: ViewportSnapshotV1 = viewport.snapshot()): GridSettingsSnapshotV1 => {
    const grid = state.snapshot();
    overlay.hidden = !grid.enabled;
    toggleButton.dataset.active = grid.enabled ? 'true' : 'false';
    root.dataset.illustroGrid = grid.enabled ? 'enabled' : 'disabled';
    root.dataset.illustroGridSpacing = String(grid.spacing);
    root.dataset.illustroGridOffsetX = String(grid.offsetX);
    root.dataset.illustroGridOffsetY = String(grid.offsetY);
    root.dataset.illustroGridColor = grid.color;
    if (!grid.enabled) return grid;

    const scaleX = viewportState.baseWidth / viewportState.documentWidth;
    const scaleY = viewportState.baseHeight / viewportState.documentHeight;
    const spacingX = Math.max(0.0001, grid.spacing * scaleX);
    const spacingY = Math.max(0.0001, grid.spacing * scaleY);
    const offsetX = positiveModulo(grid.offsetX, grid.spacing) * scaleX;
    const offsetY = positiveModulo(grid.offsetY, grid.spacing) * scaleY;
    const lineX = Math.min(spacingX * 0.25, 1 / viewportState.zoom);
    const lineY = Math.min(spacingY * 0.25, 1 / viewportState.zoom);
    overlay.style.backgroundImage =
      `linear-gradient(to right, ${grid.color} ${lineX}px, transparent ${lineX}px), ` +
      `linear-gradient(to bottom, ${grid.color} ${lineY}px, transparent ${lineY}px)`;
    overlay.style.backgroundSize = `${spacingX}px ${spacingY}px`;
    overlay.style.backgroundPosition = `${offsetX}px ${offsetY}px`;
    return grid;
  };

  const unsubscribe = viewport.subscribe((snapshot) => {
    publish(snapshot);
  });

  const onToggle = (): void => {
    closeMenu(toggleButton);
    state.toggle();
    publish();
  };

  const onSettings = (): void => {
    closeMenu(settingsButton);
    const current = state.snapshot();
    spacingInput.value = String(current.spacing);
    offsetXInput.value = String(current.offsetX);
    offsetYInput.value = String(current.offsetY);
    colorInput.value = current.color;
    status.value = '';
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  };

  const onSubmit = (event: SubmitEvent): void => {
    event.preventDefault();
    try {
      state.configure({
        spacing: integerInput(spacingInput, 'grid spacing'),
        offsetX: integerInput(offsetXInput, 'grid offsetX'),
        offsetY: integerInput(offsetYInput, 'grid offsetY'),
        color: colorInput.value,
      });
      state.setEnabled(true);
      publish();
      status.value = '';
      dialog.close();
    } catch (error) {
      status.value = error instanceof Error ? error.message : String(error);
      root.dataset.illustroGridError = status.value;
    }
  };

  const onCancel = (): void => dialog.close();
  toggleButton.addEventListener('click', onToggle);
  settingsButton.addEventListener('click', onSettings);
  form.addEventListener('submit', onSubmit);
  cancelButton.addEventListener('click', onCancel);
  publish();

  return Object.freeze({
    schema: 'illustro.grid-controller/1' as const,
    snapshot: () => state.snapshot(),
    dispose(): void {
      unsubscribe();
      toggleButton.removeEventListener('click', onToggle);
      settingsButton.removeEventListener('click', onSettings);
      form.removeEventListener('submit', onSubmit);
      cancelButton.removeEventListener('click', onCancel);
      overlay.hidden = true;
      root.dataset.illustroGrid = 'disposed';
    },
  });
}
''')

Path('tests/unit/grid-controller.test.ts').write_text(r'''import { describe, expect, it } from 'vitest';
import {
  DEFAULT_GRID_COLOR_V1,
  DEFAULT_GRID_SPACING_PX_V1,
  GridSettingsV1,
} from '../../src/app/grid-controller.js';

describe('M5A grid settings', () => {
  it('defaults to a hidden non-document grid with stable defaults', () => {
    expect(new GridSettingsV1().snapshot()).toEqual({
      schema: 'illustro.grid-settings/1',
      enabled: false,
      spacing: DEFAULT_GRID_SPACING_PX_V1,
      offsetX: 0,
      offsetY: 0,
      color: DEFAULT_GRID_COLOR_V1,
    });
  });

  it('configures spacing, position and color without changing document data', () => {
    const grid = new GridSettingsV1();
    grid.configure({ spacing: 24, offsetX: -5, offsetY: 11, color: '#A0b1C2' });
    grid.setEnabled(true);
    expect(grid.snapshot()).toMatchObject({
      enabled: true,
      spacing: 24,
      offsetX: -5,
      offsetY: 11,
      color: '#a0b1c2',
    });
  });

  it('rejects unusable spacing and malformed color values', () => {
    const grid = new GridSettingsV1();
    expect(() => grid.configure({ spacing: 0, offsetX: 0, offsetY: 0, color: '#000000' })).toThrow();
    expect(() => grid.configure({ spacing: 8, offsetX: 0, offsetY: 0, color: 'black' })).toThrow();
  });
});
''')

Path('tests/unit/canvas-admission-integration.test.ts').write_text(r'''import { describe, expect, it } from 'vitest';
import { CanvasAdmissionControllerV1 } from '../../src/app/canvas-admission-controller.js';

describe('M5A canvas admission operation integration', () => {
  const quota = {
    async inspect() {
      return {
        schema: 'illustro.storage-quota/1' as const,
        quotaBytes: 8 * 1024 * 1024 * 1024,
        usageBytes: 0,
        freeBytes: 8 * 1024 * 1024 * 1024,
        hardReserveBytes: 128 * 1024 * 1024,
        usableGrowthBytes: 8 * 1024 * 1024 * 1024 - 128 * 1024 * 1024,
        persisted: true,
      };
    },
  };

  it('preflights document creation with zero projected raster allocation', async () => {
    const controller = new CanvasAdmissionControllerV1(quota);
    const result = await controller.preflightDocumentCreate({ width: 2048, height: 2048, precision: 'rgba8-unorm' });
    expect(result.allowed).toBe(true);
    expect(result.projectedTouchedTiles).toBe(0);
  });

  it('preflights resize with the projected sparse tile footprint and tiled scratch', async () => {
    const controller = new CanvasAdmissionControllerV1(quota);
    const result = await controller.preflightDocumentResize({
      width: 4096,
      height: 4096,
      precision: 'rgba16-float',
      projectedTouchedTiles: 4,
    });
    expect(result.allowed).toBe(true);
    expect(result.projectedTouchedTiles).toBe(4);
    expect(result.operationScratchBytes).toBeGreaterThan(0);
  });

  it('preflights future decoded image import as a fully touched raster with decoded scratch', async () => {
    const controller = new CanvasAdmissionControllerV1(quota);
    const result = await controller.preflightImageImport({
      width: 1024,
      height: 768,
      precision: 'rgba8-unorm',
      decodedSourceBytes: 1024 * 768 * 4,
    });
    expect(result.allowed).toBe(true);
    expect(result.projectedTouchedTiles).toBe(12);
    expect(result.operationScratchBytes).toBe(1024 * 768 * 4);
  });
});
''')

# Viewport frame allows the non-interactive grid to share exactly the same transform as artwork.
replace_once(
    'src/index.html',
    '''          <div class="shell-canvas-stage">\n            <canvas id="render-surface" class="shell-canvas" width="1" height="1" aria-label="Illustration canvas"></canvas>\n          </div>''',
    '''          <div class="shell-canvas-stage">\n            <div id="canvas-viewport-frame" class="shell-canvas-frame">\n              <canvas id="render-surface" class="shell-canvas" width="1" height="1" aria-label="Illustration canvas"></canvas>\n              <div id="canvas-grid-overlay" class="shell-grid-overlay" aria-hidden="true" hidden></div>\n            </div>\n          </div>''',
)
replace_once(
    'src/index.html',
    '''              <button id="view-pixel" type="button">ピクセル表示</button>\n              <button id="view-workspace" type="button">全画面ワークスペース</button>''',
    '''              <button id="view-pixel" type="button">ピクセル表示</button>\n              <button id="view-grid-toggle" type="button">グリッド表示</button>\n              <button id="view-grid-settings" type="button">グリッド設定…</button>\n              <button id="view-workspace" type="button">全画面ワークスペース</button>''',
)
replace_once(
    'src/index.html',
    '''    <script type="module" src="./app/main.js"></script>''',
    '''    <dialog id="grid-dialog" class="document-dialog" aria-labelledby="grid-dialog-title">\n      <form id="grid-form" method="dialog" class="document-dialog-form">\n        <header><h2 id="grid-dialog-title">グリッド設定</h2></header>\n        <div class="document-dialog-grid">\n          <label>間隔 (px)<input id="grid-spacing" type="number" min="1" max="32768" step="1" value="64" /></label>\n          <label>オフセット X<input id="grid-offset-x" type="number" step="1" value="0" /></label>\n          <label>オフセット Y<input id="grid-offset-y" type="number" step="1" value="0" /></label>\n          <label>色<input id="grid-color" type="color" value="#64748b" /></label>\n        </div>\n        <output id="grid-status" class="document-dialog-status" aria-live="polite"></output>\n        <footer>\n          <button id="grid-cancel" type="button" class="document-dialog-secondary">キャンセル</button>\n          <button type="submit" class="document-dialog-primary">適用</button>\n        </footer>\n      </form>\n    </dialog>\n    <script type="module" src="./app/main.js"></script>''',
)

replace_once(
    'public/app-shell.css',
    '''.shell-canvas {\n  display: block;\n  flex: none;\n  border: 1.5px solid #93c5fd;''',
    '''.shell-canvas-frame {\n  position: relative;\n  display: block;\n  flex: none;\n  transform-origin: center center;\n  will-change: transform;\n}\n\n.shell-canvas {\n  display: block;\n  width: 100%;\n  height: 100%;\n  border: 1.5px solid #93c5fd;''',
)
replace_once(
    'public/app-shell.css',
    '''  transform-origin: center center;\n  will-change: transform;\n}\n\n.shell-canvas[data-pixel-preview='true'] {''',
    '''}\n\n.shell-grid-overlay {\n  position: absolute;\n  inset: 0;\n  z-index: 2;\n  pointer-events: none;\n  border-radius: inherit;\n  opacity: 0.72;\n}\n\n.shell-grid-overlay[hidden] {\n  display: none;\n}\n\n.shell-canvas[data-pixel-preview='true'] {''',
)

# Viewport exposes subscription and transforms the common canvas/grid frame.
replace_once(
    'src/app/viewport-controller.ts',
    '''  isMouseNavigationBatch(batch: PointerInputBatchV1): boolean;\n  dispose(): void;''',
    '''  isMouseNavigationBatch(batch: PointerInputBatchV1): boolean;\n  subscribe(listener: (snapshot: ViewportSnapshotV1) => void): () => void;\n  dispose(): void;''',
)
replace_once(
    'src/app/viewport-controller.ts',
    '''  const canvas = input.canvas;\n  const stage = requireElement<HTMLElement>('.shell-canvas-stage');\n  const app = requireElement<HTMLElement>('#app');\n  const transform = new ViewportTransformV1();''',
    '''  const canvas = input.canvas;\n  const stage = requireElement<HTMLElement>('.shell-canvas-stage');\n  const frame = requireElement<HTMLElement>('#canvas-viewport-frame');\n  const app = requireElement<HTMLElement>('#app');\n  const transform = new ViewportTransformV1();\n  const subscribers = new Set<(snapshot: ViewportSnapshotV1) => void>();''',
)
replace_once(
    'src/app/viewport-controller.ts',
    '''    canvas.style.width = `${snapshot.baseWidth}px`;\n    canvas.style.height = `${snapshot.baseHeight}px`;\n    canvas.style.transform = `translate(${snapshot.panX}px, ${snapshot.panY}px) rotate(${snapshot.rotationDegrees}deg) scale(${snapshot.mirrored ? -snapshot.zoom : snapshot.zoom}, ${snapshot.zoom})`;\n    canvas.dataset.pixelPreview = snapshot.pixelated ? 'true' : 'false';''',
    '''    frame.style.width = `${snapshot.baseWidth}px`;\n    frame.style.height = `${snapshot.baseHeight}px`;\n    frame.style.transform = `translate(${snapshot.panX}px, ${snapshot.panY}px) rotate(${snapshot.rotationDegrees}deg) scale(${snapshot.mirrored ? -snapshot.zoom : snapshot.zoom}, ${snapshot.zoom})`;\n    canvas.dataset.pixelPreview = snapshot.pixelated ? 'true' : 'false';''',
)
replace_once(
    'src/app/viewport-controller.ts',
    '''    root.dataset.illustroWorkspacePresentation = snapshot.workspacePresentation\n      ? 'enabled'\n      : 'disabled';\n    return snapshot;''',
    '''    root.dataset.illustroWorkspacePresentation = snapshot.workspacePresentation\n      ? 'enabled'\n      : 'disabled';\n    for (const listener of subscribers) listener(snapshot);\n    return snapshot;''',
)
replace_once(
    'src/app/viewport-controller.ts',
    '''    handleNavigationBatch,\n    isMouseNavigationBatch,\n    dispose() {''',
    '''    handleNavigationBatch,\n    isMouseNavigationBatch,\n    subscribe(listener: (snapshot: ViewportSnapshotV1) => void) {\n      subscribers.add(listener);\n      listener(transform.snapshot());\n      return () => subscribers.delete(listener);\n    },\n    dispose() {''',
)
replace_once(
    'src/app/viewport-controller.ts',
    '''      activePointers.clear();\n      root.dataset.illustroViewport = 'disposed';''',
    '''      activePointers.clear();\n      subscribers.clear();\n      root.dataset.illustroViewport = 'disposed';''',
)

# Install grid after viewport, and dispose it before viewport.
replace_once(
    'src/app/main.ts',
    "import { installDocumentGeometryWorkflowControllerV1 } from './document-geometry-workflow-controller.js';\n",
    "import { installDocumentGeometryWorkflowControllerV1 } from './document-geometry-workflow-controller.js';\nimport { installGridControllerV1 } from './grid-controller.js';\n",
)
replace_once(
    'src/app/main.ts',
    '''const viewport = installViewportControllerV1({ root, canvas: shell.canvas });\nconst workers = startDedicatedWorkers();''',
    '''const viewport = installViewportControllerV1({ root, canvas: shell.canvas });\nconst grid = installGridControllerV1({ root, viewport });\nconst workers = startDedicatedWorkers();''',
)
replace_once(
    'src/app/main.ts',
    '''    documentWorkflow.dispose();\n    viewport.dispose();''',
    '''    documentWorkflow.dispose();\n    grid.dispose();\n    viewport.dispose();''',
)

# Operation-specific admission wrappers make create/resize/import policy explicit and reusable.
replace_once(
    'src/app/canvas-admission-controller.ts',
    "import type { DocumentPrecision } from '../domain/document.js';\n",
    "import type { DocumentPrecision } from '../domain/document.js';\nimport { CANONICAL_TILE_AREA_PX, tileGridForDocumentV1 } from '../gpu/sparse-tile-model.js';\n",
)
replace_once(
    'src/app/canvas-admission-controller.ts',
    '''export interface CanvasAdmissionQuotaReaderV1 {\n  inspect(): ReturnType<StorageQuotaMonitorV1['inspect']>;\n}\n''',
    '''export interface CanvasAdmissionQuotaReaderV1 {\n  inspect(): ReturnType<StorageQuotaMonitorV1['inspect']>;\n}\n\nexport interface CanvasAdmissionDocumentSizeV1 {\n  readonly width: number;\n  readonly height: number;\n  readonly precision: DocumentPrecision;\n}\n\nexport interface CanvasAdmissionResizeInputV1 extends CanvasAdmissionDocumentSizeV1 {\n  readonly projectedTouchedTiles: number;\n}\n\nexport interface CanvasAdmissionImageImportInputV1 extends CanvasAdmissionDocumentSizeV1 {\n  readonly decodedSourceBytes: number;\n}\n\nfunction bytesPerPixel(precision: DocumentPrecision): 4 | 8 {\n  return precision === 'rgba16-float' ? 8 : 4;\n}\n\nfunction tiledMutationScratchBytes(precision: DocumentPrecision): number {\n  return CANONICAL_TILE_AREA_PX * bytesPerPixel(precision) * 2;\n}\n''',
)
replace_once(
    'src/app/canvas-admission-controller.ts',
    '''  async preflight(input: CanvasAdmissionPreflightInputV1): Promise<CanvasAdmissionEstimateV1> {''',
    '''  preflightDocumentCreate(input: CanvasAdmissionDocumentSizeV1): Promise<CanvasAdmissionEstimateV1> {\n    return this.preflight({\n      ...input,\n      projectedTouchedTiles: 0,\n      operationScratchBytes: 0,\n    });\n  }\n\n  preflightDocumentResize(input: CanvasAdmissionResizeInputV1): Promise<CanvasAdmissionEstimateV1> {\n    return this.preflight({\n      ...input,\n      operationScratchBytes: tiledMutationScratchBytes(input.precision),\n    });\n  }\n\n  preflightImageImport(input: CanvasAdmissionImageImportInputV1): Promise<CanvasAdmissionEstimateV1> {\n    if (!Number.isSafeInteger(input.decodedSourceBytes) || input.decodedSourceBytes < 0) {\n      throw new RangeError('decoded image source bytes must be a non-negative safe integer');\n    }\n    const grid = tileGridForDocumentV1(input.width, input.height);\n    return this.preflight({\n      width: input.width,\n      height: input.height,\n      precision: input.precision,\n      projectedTouchedTiles: grid.tilesX * grid.tilesY,\n      operationScratchBytes: input.decodedSourceBytes,\n    });\n  }\n\n  async preflight(input: CanvasAdmissionPreflightInputV1): Promise<CanvasAdmissionEstimateV1> {''',
)

# New-document production path uses the explicit create admission contract.
replace_once(
    'src/app/document-workflow-controller.ts',
    '''          const admission = await options.canvasAdmission.preflight({\n            width,\n            height,\n            precision,\n            projectedTouchedTiles: 0,\n            operationScratchBytes: 0,\n          });''',
    '''          const admission = await options.canvasAdmission.preflightDocumentCreate({\n            width,\n            height,\n            precision,\n          });''',
)

# All document geometry mutations use the explicit resize/mutation preflight.
replace_once(
    'src/app/document-geometry-workflow-controller.ts',
    '''    const admission = await options.canvasAdmission.preflight({\n      width: preview.document.canvas.width,\n      height: preview.document.canvas.height,\n      precision: preview.document.color.precision,\n      projectedTouchedTiles: projectedTouchedTilesForSnapshotV1(preview),\n      operationScratchBytes: 0,\n    });''',
    '''    const admission = await options.canvasAdmission.preflightDocumentResize({\n      width: preview.document.canvas.width,\n      height: preview.document.canvas.height,\n      precision: preview.document.color.precision,\n      projectedTouchedTiles: projectedTouchedTilesForSnapshotV1(preview),\n    });''',
)

# Extend durable M5A verifier to cover grid and operation-specific admission hooks.
verify = Path('scripts/verify-m5a-document-foundation.mjs')
text = verify.read_text()
anchor = "required(viewport, 'setPixelated', 'pixel preview state');\n"
if anchor not in text:
    raise SystemExit('M5A viewport verifier anchor missing')
text = text.replace(
    anchor,
    anchor + '''const grid = read('src/app/grid-controller.ts');\nrequired(main, 'installGridControllerV1', 'grid production controller');\nrequired(html, 'id="view-grid-toggle"', 'grid visibility UI');\nrequired(html, 'id="grid-spacing"', 'grid spacing UI');\nrequired(html, 'id="grid-offset-x"', 'grid position X UI');\nrequired(html, 'id="grid-offset-y"', 'grid position Y UI');\nrequired(html, 'id="grid-color"', 'grid color UI');\nrequired(grid, 'backgroundSize', 'grid spacing rendering');\nrequired(grid, 'backgroundPosition', 'grid offset rendering');\nrequired(grid, 'grid.color', 'grid color rendering');\nconst admissionController = read('src/app/canvas-admission-controller.ts');\nrequired(admissionController, 'preflightDocumentCreate', 'create admission integration');\nrequired(admissionController, 'preflightDocumentResize', 'resize admission integration');\nrequired(admissionController, 'preflightImageImport', 'image import admission integration hook');\nrequired(workflow, 'preflightDocumentCreate', 'new document operation admission path');\nrequired(geometryWorkflow, 'preflightDocumentResize', 'geometry operation admission path');\n''',
    1,
)
verify.write_text(text)
