from pathlib import Path
import json


def replace_once(path: str, old: str, new: str) -> None:
    target = Path(path)
    text = target.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"expected exactly one replacement in {path}, found {count}: {old[:120]!r}")
    target.write_text(text.replace(old, new, 1))


Path('src/domain/document-presets.ts').write_text(r'''import type {
  CanvasBackgroundSpec,
  DocumentColorSpace,
  DocumentPrecision,
} from './document.js';

export interface DocumentPresetV1 {
  readonly schema: 'illustro.document-preset/1';
  readonly id: string;
  readonly label: string;
  readonly width: number;
  readonly height: number;
  readonly ppi: number;
  readonly background: CanvasBackgroundSpec;
  readonly workingSpace: DocumentColorSpace;
  readonly precision: DocumentPrecision;
}

const TRANSPARENT_BACKGROUND = Object.freeze({ kind: 'transparent' as const });

function preset(
  id: string,
  label: string,
  width: number,
  height: number,
  ppi = 300,
): DocumentPresetV1 {
  return Object.freeze({
    schema: 'illustro.document-preset/1' as const,
    id,
    label,
    width,
    height,
    ppi,
    background: TRANSPARENT_BACKGROUND,
    workingSpace: 'srgb' as const,
    precision: 'rgba8-unorm' as const,
  });
}

export const DEFAULT_DOCUMENT_PRESETS_V1: readonly DocumentPresetV1[] = Object.freeze([
  preset('square-2048', 'Square 2048', 2048, 2048),
  preset('full-hd', 'Full HD', 1920, 1080),
  preset('uhd-4k', '4K UHD', 3840, 2160),
  preset('a4-portrait-300', 'A4 Portrait · 300 ppi', 2480, 3508),
  preset('a4-landscape-300', 'A4 Landscape · 300 ppi', 3508, 2480),
]);

export function documentPresetByIdV1(id: string): DocumentPresetV1 | null {
  return DEFAULT_DOCUMENT_PRESETS_V1.find((entry) => entry.id === id) ?? null;
}
''')

Path('src/app/document-workflow-controller.ts').write_text(r'''import type { DocumentV1, CanvasBackgroundSpec, DocumentColorSpace, DocumentPrecision } from '../domain/document.js';
import {
  DEFAULT_DOCUMENT_PRESETS_V1,
  documentPresetByIdV1,
} from '../domain/document-presets.js';
import type { CanvasAdmissionControllerV1 } from './canvas-admission-controller.js';
import type { PaintHistoryControllerV1 } from './paint-history-controller.js';
import type { PaintPersistenceControllerV1 } from './paint-persistence-controller.js';
import type { PaintSessionControllerV1 } from './paint-session-controller.js';

export interface DocumentWorkflowControllerV1 {
  readonly schema: 'illustro.document-workflow-controller/1';
  openNewDocument(): void;
  openDocumentSettings(): void;
  dispose(): void;
}

interface DocumentWorkflowOptionsV1 {
  readonly root?: HTMLElement;
  readonly canvasAdmission: CanvasAdmissionControllerV1;
  readonly paintSession: PaintSessionControllerV1;
  readonly paintHistory: PaintHistoryControllerV1;
  readonly paintPersistence: PaintPersistenceControllerV1;
  readonly schedule: (operation: () => Promise<void>) => void;
  readonly onDocumentChanged: (document: DocumentV1) => void;
  readonly onHistoryChanged: () => void;
}

function requireElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (element === null) throw new Error(`document workflow is missing ${selector}`);
  return element;
}

function finiteInput(input: HTMLInputElement, label: string): number {
  const value = Number(input.value);
  if (!Number.isFinite(value)) throw new RangeError(`${label} must be finite`);
  return value;
}

function integerInput(input: HTMLInputElement, label: string): number {
  const value = finiteInput(input, label);
  if (!Number.isSafeInteger(value)) throw new RangeError(`${label} must be an integer`);
  return value;
}

function colorToHex(background: CanvasBackgroundSpec): string {
  if (background.kind === 'transparent') return '#ffffff';
  const [red, green, blue] = background.rgba;
  return `#${[red, green, blue]
    .map((component) => Math.round(component * 255).toString(16).padStart(2, '0'))
    .join('')}`;
}

function hexToColor(value: string, alphaPercent: number): CanvasBackgroundSpec {
  const match = /^#([0-9a-f]{6})$/i.exec(value);
  if (match === null) throw new TypeError('background color must be #RRGGBB');
  const digits = match[1];
  const alpha = Math.min(100, Math.max(0, alphaPercent)) / 100;
  return Object.freeze({
    kind: 'solid' as const,
    rgba: Object.freeze([
      Number.parseInt(digits.slice(0, 2), 16) / 255,
      Number.parseInt(digits.slice(2, 4), 16) / 255,
      Number.parseInt(digits.slice(4, 6), 16) / 255,
      alpha,
    ]) as readonly [number, number, number, number],
  });
}

function backgroundFromForm(
  mode: HTMLSelectElement,
  color: HTMLInputElement,
  alpha: HTMLInputElement,
): CanvasBackgroundSpec {
  if (mode.value === 'transparent') return Object.freeze({ kind: 'transparent' as const });
  return hexToColor(color.value, finiteInput(alpha, 'background opacity'));
}

function closeContainingMenu(element: Element): void {
  element.closest('details')?.removeAttribute('open');
}

export function installDocumentWorkflowControllerV1(
  options: DocumentWorkflowOptionsV1,
): DocumentWorkflowControllerV1 {
  const root = options.root ?? document.documentElement;
  const dialog = requireElement<HTMLDialogElement>('#document-dialog');
  const form = requireElement<HTMLFormElement>('#document-form');
  const title = requireElement<HTMLElement>('#document-dialog-title');
  const nameInput = requireElement<HTMLInputElement>('#document-name');
  const presetSelect = requireElement<HTMLSelectElement>('#document-preset');
  const widthInput = requireElement<HTMLInputElement>('#document-width');
  const heightInput = requireElement<HTMLInputElement>('#document-height');
  const ppiInput = requireElement<HTMLInputElement>('#document-ppi');
  const backgroundMode = requireElement<HTMLSelectElement>('#document-background-mode');
  const backgroundColor = requireElement<HTMLInputElement>('#document-background-color');
  const backgroundAlpha = requireElement<HTMLInputElement>('#document-background-alpha');
  const workingSpaceSelect = requireElement<HTMLSelectElement>('#document-working-space');
  const precisionSelect = requireElement<HTMLSelectElement>('#document-precision');
  const status = requireElement<HTMLOutputElement>('#document-dialog-status');
  const submit = requireElement<HTMLButtonElement>('#document-submit');
  const newDocumentButton = requireElement<HTMLButtonElement>('#new-document');
  const settingsButton = requireElement<HTMLButtonElement>('#document-settings');
  const exportMenuButton = requireElement<HTMLButtonElement>('#export-png-menu');
  const exportButton = document.querySelector<HTMLButtonElement>('#export-png');

  for (const entry of DEFAULT_DOCUMENT_PRESETS_V1) {
    const option = document.createElement('option');
    option.value = entry.id;
    option.textContent = entry.label;
    presetSelect.append(option);
  }

  const updateBackgroundControls = (): void => {
    const solid = backgroundMode.value === 'solid';
    backgroundColor.disabled = !solid;
    backgroundAlpha.disabled = !solid;
  };

  const setCreationControlsDisabled = (disabled: boolean): void => {
    nameInput.disabled = disabled;
    presetSelect.disabled = disabled;
    widthInput.disabled = disabled;
    heightInput.disabled = disabled;
    workingSpaceSelect.disabled = disabled;
    precisionSelect.disabled = disabled;
  };

  const applyPreset = (id: string): void => {
    const entry = documentPresetByIdV1(id);
    if (entry === null) return;
    widthInput.value = String(entry.width);
    heightInput.value = String(entry.height);
    ppiInput.value = String(entry.ppi);
    backgroundMode.value = entry.background.kind;
    backgroundColor.value = colorToHex(entry.background);
    backgroundAlpha.value = entry.background.kind === 'solid' ? String(entry.background.rgba[3] * 100) : '100';
    workingSpaceSelect.value = entry.workingSpace;
    precisionSelect.value = entry.precision;
    updateBackgroundControls();
  };

  const showDialog = (): void => {
    status.value = '';
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  };

  const openNewDocument = (): void => {
    dialog.dataset.mode = 'new';
    title.textContent = '新規ドキュメント';
    submit.textContent = '作成';
    setCreationControlsDisabled(false);
    nameInput.value = 'Untitled';
    presetSelect.value = DEFAULT_DOCUMENT_PRESETS_V1[0]?.id ?? 'custom';
    applyPreset(presetSelect.value);
    showDialog();
  };

  const openDocumentSettings = (): void => {
    const current = options.paintSession.currentDocument();
    if (current === null) return;
    dialog.dataset.mode = 'settings';
    title.textContent = 'ドキュメント設定';
    submit.textContent = '適用';
    setCreationControlsDisabled(true);
    nameInput.value = 'Current document';
    presetSelect.value = 'custom';
    widthInput.value = String(current.canvas.width);
    heightInput.value = String(current.canvas.height);
    ppiInput.value = String(current.canvas.resolution.ppi);
    backgroundMode.value = current.canvas.background.kind;
    backgroundColor.value = colorToHex(current.canvas.background);
    backgroundAlpha.value = current.canvas.background.kind === 'solid' ? String(current.canvas.background.rgba[3] * 100) : '100';
    workingSpaceSelect.value = current.color.workingSpace;
    precisionSelect.value = current.color.precision;
    updateBackgroundControls();
    showDialog();
  };

  const onPresetChange = (): void => applyPreset(presetSelect.value);
  const onBackgroundModeChange = (): void => updateBackgroundControls();
  const onNewClick = (): void => {
    closeContainingMenu(newDocumentButton);
    openNewDocument();
  };
  const onSettingsClick = (): void => {
    closeContainingMenu(settingsButton);
    openDocumentSettings();
  };
  const onExportMenuClick = (): void => {
    closeContainingMenu(exportMenuButton);
    exportButton?.click();
  };

  const onSubmit = (event: SubmitEvent): void => {
    event.preventDefault();
    if (submit.disabled) return;
    const mode = dialog.dataset.mode;
    submit.disabled = true;
    status.value = mode === 'settings' ? '更新中…' : '作成中…';

    options.schedule(async () => {
      try {
        const ppi = finiteInput(ppiInput, 'PPI');
        const background = backgroundFromForm(backgroundMode, backgroundColor, backgroundAlpha);
        if (mode === 'settings') {
          const transaction = options.paintHistory.commitDocumentSettings({ ppi, background });
          await options.paintPersistence.markDirty(transaction.transactionId);
          const current = options.paintSession.currentDocument();
          if (current === null) throw new Error('document settings update lost the active document');
          options.onDocumentChanged(current);
          options.onHistoryChanged();
        } else {
          const width = integerInput(widthInput, 'width');
          const height = integerInput(heightInput, 'height');
          const workingSpace = workingSpaceSelect.value as DocumentColorSpace;
          const precision = precisionSelect.value as DocumentPrecision;
          if (workingSpace !== 'srgb' && workingSpace !== 'display-p3') {
            throw new TypeError('unsupported document working space');
          }
          if (precision !== 'rgba8-unorm' && precision !== 'rgba16-float') {
            throw new TypeError('unsupported document precision');
          }
          const admission = await options.canvasAdmission.preflight({
            width,
            height,
            precision,
            projectedTouchedTiles: 0,
            operationScratchBytes: 0,
          });
          if (!admission.allowed) {
            status.value = `作成できません: ${admission.reasons.join(', ')}`;
            return;
          }
          await options.paintPersistence.createNewProject({
            name: nameInput.value.trim() || 'Untitled',
            document: { width, height, ppi, background, workingSpace, precision },
          });
          const current = options.paintSession.currentDocument();
          if (current === null) throw new Error('new document creation lost the active document');
          options.onDocumentChanged(current);
          options.onHistoryChanged();
        }
        status.value = '';
        dialog.close();
      } catch (error) {
        status.value = error instanceof Error ? error.message : String(error);
        root.dataset.illustroDocumentWorkflowError = status.value;
      } finally {
        submit.disabled = false;
      }
    });
  };

  presetSelect.addEventListener('change', onPresetChange);
  backgroundMode.addEventListener('change', onBackgroundModeChange);
  newDocumentButton.addEventListener('click', onNewClick);
  settingsButton.addEventListener('click', onSettingsClick);
  exportMenuButton.addEventListener('click', onExportMenuClick);
  form.addEventListener('submit', onSubmit);
  updateBackgroundControls();
  root.dataset.illustroDocumentWorkflow = 'ready';

  return Object.freeze({
    schema: 'illustro.document-workflow-controller/1' as const,
    openNewDocument,
    openDocumentSettings,
    dispose(): void {
      presetSelect.removeEventListener('change', onPresetChange);
      backgroundMode.removeEventListener('change', onBackgroundModeChange);
      newDocumentButton.removeEventListener('click', onNewClick);
      settingsButton.removeEventListener('click', onSettingsClick);
      exportMenuButton.removeEventListener('click', onExportMenuClick);
      form.removeEventListener('submit', onSubmit);
      root.dataset.illustroDocumentWorkflow = 'disposed';
    },
  });
}
''')

replace_once(
    'src/app/paint-session-controller.ts',
    "import { createDocumentV1, type DocumentV1 } from '../domain/document.js';",
    "import {\n  createCanvasSpec,\n  createDocumentV1,\n  type CanvasBackgroundSpec,\n  type DocumentV1,\n} from '../domain/document.js';",
)

replace_once(
    'src/app/paint-session-controller.ts',
    "export interface PaintStrokeCommitV1 {\n  readonly before: PaintProjectSnapshotV1;\n  readonly after: PaintProjectSnapshotV1;\n  readonly committed: CompletedPaintStrokeV1;\n}\n",
    "export interface PaintStrokeCommitV1 {\n  readonly before: PaintProjectSnapshotV1;\n  readonly after: PaintProjectSnapshotV1;\n  readonly committed: CompletedPaintStrokeV1;\n}\n\nexport interface PaintDocumentSettingsUpdateV1 {\n  readonly ppi?: number;\n  readonly background?: CanvasBackgroundSpec;\n}\n\nexport interface PaintDocumentSettingsCommitV1 {\n  readonly before: PaintProjectSnapshotV1;\n  readonly after: PaintProjectSnapshotV1;\n}\n",
)

replace_once(
    'src/app/paint-session-controller.ts',
    "  async restoreProjectSnapshot(snapshot: PaintProjectSnapshotV1): Promise<PaintProjectSnapshotV1> {",
    "  commitDocumentSettings(\n    input: PaintDocumentSettingsUpdateV1,\n    afterRevision: Revision | number,\n    now: Date = new Date(),\n  ): PaintDocumentSettingsCommitV1 {\n    const document = this.#document;\n    if (document === null) throw new Error('document settings require an active document');\n    const revision = parseRevision(afterRevision);\n    if (revision <= document.revision) {\n      throw new RangeError('document settings revision must advance the document');\n    }\n    const ppi = input.ppi ?? document.canvas.resolution.ppi;\n    const background = input.background ?? document.canvas.background;\n    const nextCanvas = createCanvasSpec({\n      width: document.canvas.width,\n      height: document.canvas.height,\n      ppi,\n      background,\n    });\n    const backgroundUnchanged =\n      document.canvas.background.kind === nextCanvas.background.kind &&\n      (document.canvas.background.kind === 'transparent' ||\n        (nextCanvas.background.kind === 'solid' &&\n          document.canvas.background.rgba.every(\n            (component, index) => component === nextCanvas.background.rgba[index],\n          )));\n    if (document.canvas.resolution.ppi === nextCanvas.resolution.ppi && backgroundUnchanged) {\n      throw new Error('document settings update has no changes');\n    }\n    const before = this.projectSnapshot();\n    if (before === null) throw new Error('document settings snapshot is unavailable');\n    this.#document = Object.freeze({\n      ...document,\n      revision,\n      modifiedAt: now.toISOString(),\n      canvas: nextCanvas,\n    });\n    const after = this.projectSnapshot();\n    if (after === null) throw new Error('document settings snapshot disappeared');\n    return Object.freeze({ before, after });\n  }\n\n  async restoreProjectSnapshot(snapshot: PaintProjectSnapshotV1): Promise<PaintProjectSnapshotV1> {",
)

replace_once(
    'src/app/paint-session-controller.ts',
    "    await this.#renderer.configureDocument({\n      width: normalized.document.canvas.width,\n      height: normalized.document.canvas.height,\n    });",
    "    await this.#renderer.configureDocument({\n      width: normalized.document.canvas.width,\n      height: normalized.document.canvas.height,\n      workingSpace: normalized.document.color.workingSpace,\n      precision: normalized.document.color.precision,\n    });",
)

replace_once(
    'src/app/paint-session-controller.ts',
    "    await this.#renderer.configureDocument({\n      width: initial.document.canvas.width,\n      height: initial.document.canvas.height,\n    });",
    "    await this.#renderer.configureDocument({\n      width: initial.document.canvas.width,\n      height: initial.document.canvas.height,\n      workingSpace: initial.document.color.workingSpace,\n      precision: initial.document.color.precision,\n    });",
)

replace_once(
    'src/app/paint-session-controller.ts',
    "export interface PaintRendererDocumentPortV1 {\n  configureDocument(input: { readonly width: number; readonly height: number }): Promise<unknown>;",
    "export interface PaintRendererDocumentPortV1 {\n  configureDocument(input: {\n    readonly width: number;\n    readonly height: number;\n    readonly workingSpace: DocumentV1['color']['workingSpace'];\n    readonly precision: DocumentV1['color']['precision'];\n  }): Promise<unknown>;",
)

replace_once(
    'src/app/paint-history-controller.ts',
    "import {\n  PaintSessionControllerV1,\n  parsePaintProjectSnapshotV1,\n} from './paint-session-controller.js';",
    "import {\n  PaintSessionControllerV1,\n  parsePaintProjectSnapshotV1,\n  type PaintDocumentSettingsUpdateV1,\n} from './paint-session-controller.js';",
)

replace_once(
    'src/app/paint-history-controller.ts',
    "  async undo(spillAdapter?: HistorySpillAdapterV1): Promise<boolean> {",
    "  commitDocumentSettings(input: PaintDocumentSettingsUpdateV1): HistoryTransactionV1 {\n    const before = this.#session.projectSnapshot();\n    if (before === null) throw new Error('document settings history requires an active document');\n    if (this.#revisionHighWater >= Number.MAX_SAFE_INTEGER) {\n      throw new RangeError('paint document revision high-water is exhausted');\n    }\n    const afterRevision = parseRevision(\n      Math.max(this.#revisionHighWater, before.document.revision) + 1,\n    );\n    const committed = this.#session.commitDocumentSettings(input, afterRevision);\n    const transaction = createHistoryTransactionV1({\n      transactionId: crypto.randomUUID(),\n      commandId: 'document.settings.update',\n      beforeRevision: committed.before.document.revision,\n      afterRevision: committed.after.document.revision,\n      payload: createHistoryPayloadV1({\n        strategy: 'object-before-after',\n        before: committed.before,\n        after: committed.after,\n      }),\n    });\n    this.#spine.commit(transaction);\n    this.#revisionHighWater = Math.max(this.#revisionHighWater, committed.after.document.revision);\n    return transaction;\n  }\n\n  async undo(spillAdapter?: HistorySpillAdapterV1): Promise<boolean> {",
)

replace_once(
    'src/app/paint-persistence-controller.ts',
    "type PaintPersistenceNewDocumentInputV1 = Omit<PaintDocumentCreationInputV1, 'projectId'>;",
    "export type PaintPersistenceNewDocumentInputV1 = Omit<PaintDocumentCreationInputV1, 'projectId'>;",
)

replace_once(
    'src/app/paint-persistence-controller.ts',
    "  async markDirty(\n",
    "  async createNewProject(input: {\n    readonly name: string;\n    readonly document: PaintPersistenceNewDocumentInputV1;\n  }): Promise<PaintPersistenceInitializeResultV1> {\n    this.#assertNotDisposed();\n    if (this.#status === 'initializing' || this.#status === 'saving') {\n      throw new Error('paint persistence is busy');\n    }\n    const previousProjectId = this.#projectId;\n    this.#setStatus('initializing');\n    try {\n      if (previousProjectId !== null) {\n        await this.#request({ type: 'storage.persistence.flush', projectId: previousProjectId, reason: 'autosave' });\n        await this.#request({ type: 'storage.project.close', projectId: previousProjectId });\n      }\n      const projectId = createProjectId();\n      const document = await this.#session.createNewDocument({ ...input.document, projectId });\n      this.#history.reset();\n      const created = parseStorageProjectState(\n        await this.#request({\n          type: 'storage.project.create',\n          name: input.name,\n          projectId,\n          initialSnapshot: this.projectSnapshot(),\n          documentRevision: document.revision,\n        }),\n      );\n      if (created.projectId !== projectId) {\n        throw new Error('storage created an unexpected project ID');\n      }\n      this.#adoptProject(created);\n      this.#rememberProject(created.projectId);\n      this.#setStatus('ready');\n      return Object.freeze({\n        schema: 'illustro.paint-persistence-initialize/1' as const,\n        mode: 'created' as const,\n        projectId: created.projectId,\n        sequence: created.sequence,\n        recoveryGeneration: created.recoveryGeneration,\n        documentRevision: created.documentRevision,\n      });\n    } catch (error) {\n      this.#fail(error);\n      throw error;\n    }\n  }\n\n  async markDirty(\n",
)

replace_once(
    'src/app/renderer-controller.ts',
    "import { type BaselineBrushDabV1 } from '../gpu/baseline-brush.js';",
    "import { type BaselineBrushDabV1 } from '../gpu/baseline-brush.js';\nimport type { DocumentColorSpace, DocumentPrecision } from '../domain/document.js';",
)

replace_once(
    'src/app/renderer-controller.ts',
    "  readonly width: number;\n  readonly height: number;\n}\n\nconst WORKER_RESPONSE_TIMEOUT_MS",
    "  readonly width: number;\n  readonly height: number;\n  readonly workingSpace: DocumentColorSpace;\n  readonly precision: DocumentPrecision;\n}\n\nconst WORKER_RESPONSE_TIMEOUT_MS",
)

replace_once(
    'src/app/renderer-controller.ts',
    "  async configureDocument(input: {\n    readonly width: number;\n    readonly height: number;\n  }): Promise<RendererDocumentConfigurationV1> {",
    "  async configureDocument(input: {\n    readonly width: number;\n    readonly height: number;\n    readonly workingSpace: DocumentColorSpace;\n    readonly precision: DocumentPrecision;\n  }): Promise<RendererDocumentConfigurationV1> {",
)

replace_once(
    'src/app/renderer-controller.ts',
    "        width: input.width,\n        height: input.height,\n      });\n      if (response?.ok !== true)",
    "        width: input.width,\n        height: input.height,\n        workingSpace: input.workingSpace,\n        precision: input.precision,\n      });\n      if (response?.ok !== true)",
)

replace_once(
    'src/app/renderer-controller.ts',
    "      this.#publishDocumentConfiguration(input.width, input.height);\n      return Object.freeze({\n        schema: 'illustro.renderer-document-configuration/1' as const,\n        owner: 'worker' as const,\n        width: input.width,\n        height: input.height,\n      });",
    "      this.#publishDocumentConfiguration(input);\n      return Object.freeze({\n        schema: 'illustro.renderer-document-configuration/1' as const,\n        owner: 'worker' as const,\n        width: input.width,\n        height: input.height,\n        workingSpace: input.workingSpace,\n        precision: input.precision,\n      });",
)

replace_once(
    'src/app/renderer-controller.ts',
    "    this.#mainBaselinePaint.configureDocument(this.#mainTileState, input.width, input.height);\n    this.#publishDocumentConfiguration(input.width, input.height);\n    return Object.freeze({\n      schema: 'illustro.renderer-document-configuration/1' as const,\n      owner: 'main' as const,\n      width: input.width,\n      height: input.height,\n    });",
    "    this.#mainBaselinePaint.configureDocument(this.#mainTileState, input.width, input.height);\n    this.#publishDocumentConfiguration(input);\n    return Object.freeze({\n      schema: 'illustro.renderer-document-configuration/1' as const,\n      owner: 'main' as const,\n      width: input.width,\n      height: input.height,\n      workingSpace: input.workingSpace,\n      precision: input.precision,\n    });",
)

replace_once(
    'src/app/renderer-controller.ts',
    "  #publishDocumentConfiguration(width: number, height: number): void {\n    this.#root.dataset.illustroRendererDocument = 'configured';\n    this.#root.dataset.illustroRendererDocumentWidth = String(width);\n    this.#root.dataset.illustroRendererDocumentHeight = String(height);\n  }",
    "  #publishDocumentConfiguration(input: {\n    readonly width: number;\n    readonly height: number;\n    readonly workingSpace: DocumentColorSpace;\n    readonly precision: DocumentPrecision;\n  }): void {\n    this.#root.dataset.illustroRendererDocument = 'configured';\n    this.#root.dataset.illustroRendererDocumentWidth = String(input.width);\n    this.#root.dataset.illustroRendererDocumentHeight = String(input.height);\n    this.#root.dataset.illustroRendererWorkingSpace = input.workingSpace;\n    this.#root.dataset.illustroRendererPrecision = input.precision;\n  }",
)

replace_once(
    'src/workers/render.worker.ts',
    "import type { GpuAtlasPixelFormatV1 } from '../gpu/gpu-atlas.js';",
    "import type { GpuAtlasPixelFormatV1 } from '../gpu/gpu-atlas.js';\nimport type { DocumentColorSpace, DocumentPrecision } from '../domain/document.js';",
)

replace_once(
    'src/workers/render.worker.ts',
    "      readonly width: number;\n      readonly height: number;\n    }\n  | {\n      readonly type:\n        | 'renderer.tiles.allocate'",
    "      readonly width: number;\n      readonly height: number;\n      readonly workingSpace: DocumentColorSpace;\n      readonly precision: DocumentPrecision;\n    }\n  | {\n      readonly type:\n        | 'renderer.tiles.allocate'",
)

replace_once(
    'src/workers/render.worker.ts',
    "function isAtlasPixelFormat(value: unknown): value is GpuAtlasPixelFormatV1 {\n  return value === 'rgba8-unorm' || value === 'rgba16-float';\n}\n",
    "function isAtlasPixelFormat(value: unknown): value is GpuAtlasPixelFormatV1 {\n  return value === 'rgba8-unorm' || value === 'rgba16-float';\n}\n\nfunction isDocumentWorkingSpace(value: unknown): value is DocumentColorSpace {\n  return value === 'srgb' || value === 'display-p3';\n}\n\nfunction isDocumentPrecision(value: unknown): value is DocumentPrecision {\n  return value === 'rgba8-unorm' || value === 'rgba16-float';\n}\n",
)

replace_once(
    'src/workers/render.worker.ts',
    "    typeof value.requestId === 'string' &&\n    positiveDimension(value.width) &&\n    positiveDimension(value.height)\n  ) {\n    return {\n      type: value.type,\n      requestId: value.requestId,\n      width: value.width,\n      height: value.height,\n    };\n  }\n  if (value.type === 'renderer.tiles.viewport'",
    "    typeof value.requestId === 'string' &&\n    positiveDimension(value.width) &&\n    positiveDimension(value.height) &&\n    isDocumentWorkingSpace(value.workingSpace) &&\n    isDocumentPrecision(value.precision)\n  ) {\n    return {\n      type: value.type,\n      requestId: value.requestId,\n      width: value.width,\n      height: value.height,\n      workingSpace: value.workingSpace,\n      precision: value.precision,\n    };\n  }\n  if (value.type === 'renderer.tiles.viewport'",
)

replace_once(
    'src/workers/render.worker.ts',
    "      baselinePaint.configureDocument(tileState, request.width, request.height);\n      postResponse(request.requestId, true, tileState.snapshot());",
    "      baselinePaint.configureDocument(tileState, request.width, request.height);\n      postResponse(request.requestId, true, {\n        ...tileState.snapshot(),\n        workingSpace: request.workingSpace,\n        precision: request.precision,\n      });",
)

replace_once(
    'src/index.html',
    "        <div class=\"shell-topbar-track\" aria-hidden=\"true\">\n          <span></span><span></span><span></span><span></span><span></span><span></span>\n        </div>",
    "        <nav class=\"shell-topbar-menus\" aria-label=\"Application menus\">\n          <details class=\"shell-menu-dropdown\">\n            <summary>ファイル</summary>\n            <div class=\"shell-menu-popover\">\n              <button id=\"new-document\" type=\"button\">新規作成…</button>\n              <button id=\"export-png-menu\" type=\"button\">PNGを書き出し…</button>\n            </div>\n          </details>\n          <span>編集</span>\n          <details class=\"shell-menu-dropdown\">\n            <summary>ページ</summary>\n            <div class=\"shell-menu-popover\">\n              <button id=\"document-settings\" type=\"button\">ドキュメント設定…</button>\n            </div>\n          </details>\n          <span>選択範囲</span><span>表示</span><span>フィルター</span>\n        </nav>",
)

replace_once(
    'src/index.html',
    "    </div>\n    <script type=\"module\" src=\"./app/main.js\"></script>",
    "    </div>\n    <dialog id=\"document-dialog\" class=\"document-dialog\" aria-labelledby=\"document-dialog-title\">\n      <form id=\"document-form\" method=\"dialog\" class=\"document-dialog-form\">\n        <header><h2 id=\"document-dialog-title\">新規ドキュメント</h2></header>\n        <label>名前<input id=\"document-name\" type=\"text\" value=\"Untitled\" maxlength=\"120\" /></label>\n        <label>プリセット<select id=\"document-preset\"><option value=\"custom\">カスタム</option></select></label>\n        <div class=\"document-dialog-grid\">\n          <label>幅 <input id=\"document-width\" type=\"number\" min=\"1\" max=\"32768\" step=\"1\" value=\"2048\" /></label>\n          <label>高さ <input id=\"document-height\" type=\"number\" min=\"1\" max=\"32768\" step=\"1\" value=\"2048\" /></label>\n          <label>PPI <input id=\"document-ppi\" type=\"number\" min=\"0.01\" step=\"0.01\" value=\"300\" /></label>\n        </div>\n        <div class=\"document-dialog-grid document-dialog-grid-wide\">\n          <label>背景<select id=\"document-background-mode\"><option value=\"transparent\">透明</option><option value=\"solid\">単色</option></select></label>\n          <label>背景色<input id=\"document-background-color\" type=\"color\" value=\"#ffffff\" /></label>\n          <label>背景不透明度<input id=\"document-background-alpha\" type=\"number\" min=\"0\" max=\"100\" step=\"1\" value=\"100\" /></label>\n        </div>\n        <div class=\"document-dialog-grid\">\n          <label>色空間<select id=\"document-working-space\"><option value=\"srgb\">sRGB</option><option value=\"display-p3\">Display-P3</option></select></label>\n          <label>精度<select id=\"document-precision\"><option value=\"rgba8-unorm\">RGBA8</option><option value=\"rgba16-float\">RGBA16F</option></select></label>\n        </div>\n        <output id=\"document-dialog-status\" class=\"document-dialog-status\" aria-live=\"polite\"></output>\n        <footer>\n          <button type=\"button\" class=\"document-dialog-secondary\" onclick=\"this.closest('dialog').close()\">キャンセル</button>\n          <button id=\"document-submit\" type=\"submit\" class=\"document-dialog-primary\">作成</button>\n        </footer>\n      </form>\n    </dialog>\n    <script type=\"module\" src=\"./app/main.js\"></script>",
)

Path('public/app-shell.css').write_text(Path('public/app-shell.css').read_text() + r'''

.shell-topbar-menus {
  display: flex;
  align-items: center;
  gap: 22px;
  min-width: 0;
  color: #18233f;
  font-size: 13px;
  font-weight: 650;
  white-space: nowrap;
}

.shell-menu-dropdown {
  position: relative;
}

.shell-menu-dropdown > summary {
  cursor: pointer;
  list-style: none;
  border-radius: 8px;
  padding: 8px 4px;
}

.shell-menu-dropdown > summary::-webkit-details-marker {
  display: none;
}

.shell-menu-dropdown > summary:focus-visible {
  outline: 2px solid #60a5fa;
  outline-offset: 2px;
}

.shell-menu-popover {
  position: absolute;
  z-index: 30;
  top: calc(100% + 8px);
  left: -8px;
  display: grid;
  min-width: 190px;
  padding: 8px;
  border: 1px solid #e5eaf3;
  border-radius: 12px;
  background: rgb(255 255 255 / 98%);
  box-shadow: 0 14px 36px rgb(36 52 91 / 16%);
}

.shell-menu-popover button {
  min-height: 40px;
  border: 0;
  border-radius: 8px;
  padding: 0 12px;
  background: transparent;
  color: #18233f;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.shell-menu-popover button:hover,
.shell-menu-popover button:focus-visible {
  background: #f2f7ff;
  outline: none;
}

.shell-canvas[data-background-kind='transparent'] {
  background-color: #fff;
  background-image:
    linear-gradient(45deg, #e8edf4 25%, transparent 25%),
    linear-gradient(-45deg, #e8edf4 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #e8edf4 75%),
    linear-gradient(-45deg, transparent 75%, #e8edf4 75%);
  background-position: 0 0, 0 8px, 8px -8px, -8px 0;
  background-size: 16px 16px;
}

.shell-canvas[data-background-kind='solid'] {
  background: var(--illustro-canvas-background, #fff);
}

.document-dialog {
  width: min(620px, calc(100vw - 32px));
  max-height: calc(100dvh - 48px);
  border: 1px solid #e5eaf3;
  border-radius: 18px;
  padding: 0;
  color: #18233f;
  background: #fff;
  box-shadow: 0 24px 70px rgb(33 49 85 / 24%);
}

.document-dialog::backdrop {
  background: rgb(30 41 59 / 24%);
  backdrop-filter: blur(3px);
}

.document-dialog-form {
  display: grid;
  gap: 16px;
  padding: 22px;
}

.document-dialog-form header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.document-dialog-form h2 {
  margin: 0;
  font-size: 20px;
  letter-spacing: -0.4px;
}

.document-dialog-form label {
  display: grid;
  gap: 7px;
  color: #52617c;
  font-size: 12px;
  font-weight: 650;
}

.document-dialog-form input,
.document-dialog-form select {
  width: 100%;
  min-height: 42px;
  border: 1px solid #dfe6f1;
  border-radius: 10px;
  padding: 0 11px;
  background: #fbfcff;
  color: #18233f;
  font: inherit;
}

.document-dialog-form input:focus,
.document-dialog-form select:focus {
  border-color: #8bbcff;
  outline: 3px solid rgb(59 130 246 / 12%);
}

.document-dialog-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.document-dialog-grid-wide {
  grid-template-columns: 1fr 0.8fr 1fr;
}

.document-dialog-status {
  min-height: 20px;
  color: #b42318;
  font-size: 12px;
}

.document-dialog-form footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.document-dialog-form footer button {
  min-width: 96px;
  min-height: 42px;
  border-radius: 11px;
  padding: 0 16px;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.document-dialog-secondary {
  border: 1px solid #dfe6f1;
  background: #fff;
  color: #52617c;
}

.document-dialog-primary {
  border: 1px solid #6aa8ff;
  background: linear-gradient(135deg, #4f9cff, #7c83ff);
  color: #fff;
  box-shadow: 0 6px 16px rgb(79 156 255 / 20%);
}

@media (max-width: 900px) {
  .shell-topbar-menus > span:nth-of-type(n + 3) {
    display: none;
  }

  .document-dialog-grid,
  .document-dialog-grid-wide {
    grid-template-columns: 1fr;
  }
}
''')

replace_once(
    'src/app/main.ts',
    "import { collectRuntimeCapabilities } from './capabilities.js';",
    "import { collectRuntimeCapabilities } from './capabilities.js';\nimport type { DocumentV1 } from '../domain/document.js';\nimport { installDocumentWorkflowControllerV1 } from './document-workflow-controller.js';",
)

replace_once(
    'src/app/main.ts',
    "function publishPaintHistory(): void {\n  const history = paintHistory.snapshot();\n  root.dataset.illustroHistoryLength = String(history.length);\n  root.dataset.illustroHistoryCursor = String(history.cursor);\n  root.dataset.illustroHistoryUndo = history.canUndo ? 'enabled' : 'disabled';\n  root.dataset.illustroHistoryRedo = history.canRedo ? 'enabled' : 'disabled';\n}\n",
    "function publishPaintHistory(): void {\n  const history = paintHistory.snapshot();\n  root.dataset.illustroHistoryLength = String(history.length);\n  root.dataset.illustroHistoryCursor = String(history.cursor);\n  root.dataset.illustroHistoryUndo = history.canUndo ? 'enabled' : 'disabled';\n  root.dataset.illustroHistoryRedo = history.canRedo ? 'enabled' : 'disabled';\n}\n\nfunction publishDocumentState(documentValue: DocumentV1): void {\n  root.dataset.illustroDocumentId = documentValue.documentId;\n  root.dataset.illustroDocumentWidth = String(documentValue.canvas.width);\n  root.dataset.illustroDocumentHeight = String(documentValue.canvas.height);\n  root.dataset.illustroDocumentPpi = String(documentValue.canvas.resolution.ppi);\n  root.dataset.illustroDocumentWorkingSpace = documentValue.color.workingSpace;\n  root.dataset.illustroDocumentPrecision = documentValue.color.precision;\n  root.dataset.illustroDocumentBackground = documentValue.canvas.background.kind;\n  shell.canvas.dataset.backgroundKind = documentValue.canvas.background.kind;\n  if (documentValue.canvas.background.kind === 'solid') {\n    const [red, green, blue, alpha] = documentValue.canvas.background.rgba;\n    const cssColor =\n      documentValue.color.workingSpace === 'display-p3'\n        ? `color(display-p3 ${red} ${green} ${blue} / ${alpha})`\n        : `rgb(${Math.round(red * 255)} ${Math.round(green * 255)} ${Math.round(blue * 255)} / ${alpha})`;\n    shell.canvas.style.setProperty('--illustro-canvas-background', cssColor);\n  } else {\n    shell.canvas.style.removeProperty('--illustro-canvas-background');\n  }\n}\n\nconst documentWorkflow = installDocumentWorkflowControllerV1({\n  root,\n  canvasAdmission,\n  paintSession,\n  paintHistory,\n  paintPersistence,\n  schedule: enqueuePaintRender,\n  onDocumentChanged: publishDocumentState,\n  onHistoryChanged: publishPaintHistory,\n});\n",
)

replace_once(
    'src/app/main.ts',
    "    root.dataset.illustroPaintVisible = 'committed';\n    publishPaintHistory();",
    "    root.dataset.illustroPaintVisible = 'committed';\n    const documentValue = paintSession.currentDocument();\n    if (documentValue !== null) publishDocumentState(documentValue);\n    publishPaintHistory();",
)

replace_once(
    'src/app/main.ts',
    "    root.dataset.illustroDocumentId = document.documentId;\n    root.dataset.illustroDocumentWidth = String(document.canvas.width);\n    root.dataset.illustroDocumentHeight = String(document.canvas.height);",
    "    publishDocumentState(document);",
)

replace_once(
    'src/app/main.ts',
    "    pointerInput.dispose();\n    pointerTransport.dispose();",
    "    documentWorkflow.dispose();\n    pointerInput.dispose();\n    pointerTransport.dispose();",
)

Path('tests/unit/document-workflow-foundation.test.ts').write_text(r'''import { describe, expect, it } from 'vitest';
import { PaintHistoryControllerV1 } from '../../src/app/paint-history-controller.js';
import { PaintSessionControllerV1 } from '../../src/app/paint-session-controller.js';
import {
  DEFAULT_DOCUMENT_PRESETS_V1,
  documentPresetByIdV1,
} from '../../src/domain/document-presets.js';
import type { BaselineBrushDabV1 } from '../../src/gpu/baseline-brush.js';

class FakeRenderer {
  readonly configurations: Array<{
    width: number;
    height: number;
    workingSpace: string;
    precision: string;
  }> = [];
  async configureDocument(input: {
    readonly width: number;
    readonly height: number;
    readonly workingSpace: 'srgb' | 'display-p3';
    readonly precision: 'rgba8-unorm' | 'rgba16-float';
  }): Promise<void> {
    this.configurations.push({ ...input });
  }
  async restoreBaselineStrokes(
    _strokes: readonly { readonly strokeId: string; readonly dabs: readonly BaselineBrushDabV1[] }[],
  ): Promise<void> {}
}

describe('M5A document creation and metadata foundation', () => {
  it('ships bounded document presets with canonical default color/precision metadata', () => {
    expect(DEFAULT_DOCUMENT_PRESETS_V1.length).toBeGreaterThanOrEqual(4);
    const ids = new Set<string>();
    for (const preset of DEFAULT_DOCUMENT_PRESETS_V1) {
      expect(ids.has(preset.id)).toBe(false);
      ids.add(preset.id);
      expect(preset.width).toBeGreaterThan(0);
      expect(preset.height).toBeGreaterThan(0);
      expect(preset.width * preset.height).toBeLessThanOrEqual(2 ** 28);
      expect(preset.ppi).toBeGreaterThan(0);
      expect(preset.workingSpace).toBe('srgb');
      expect(preset.precision).toBe('rgba8-unorm');
    }
    expect(documentPresetByIdV1('a4-portrait-300')).toMatchObject({
      width: 2480,
      height: 3508,
      ppi: 300,
    });
  });

  it('creates custom Display-P3 RGBA16F documents and propagates mode to renderer configuration', async () => {
    const renderer = new FakeRenderer();
    const session = new PaintSessionControllerV1(renderer);
    const document = await session.createNewDocument({
      width: 4096,
      height: 3072,
      ppi: 144,
      background: { kind: 'solid', rgba: [0.25, 0.5, 0.75, 0.8] },
      workingSpace: 'display-p3',
      precision: 'rgba16-float',
    });
    expect(document.canvas).toMatchObject({
      width: 4096,
      height: 3072,
      resolution: { ppi: 144 },
      background: { kind: 'solid', rgba: [0.25, 0.5, 0.75, 0.8] },
    });
    expect(document.color).toEqual({
      workingSpace: 'display-p3',
      precision: 'rgba16-float',
      alphaMode: 'straight',
    });
    expect(renderer.configurations.at(-1)).toEqual({
      width: 4096,
      height: 3072,
      workingSpace: 'display-p3',
      precision: 'rgba16-float',
    });
  });

  it('edits PPI/background as one undoable document transaction', async () => {
    const renderer = new FakeRenderer();
    const session = new PaintSessionControllerV1(renderer);
    await session.createNewDocument({ width: 512, height: 512, ppi: 300 });
    const history = new PaintHistoryControllerV1(session);
    history.reset();

    const transaction = history.commitDocumentSettings({
      ppi: 600,
      background: { kind: 'solid', rgba: [1, 0.5, 0, 1] },
    });
    expect(transaction.commandId).toBe('document.settings.update');
    expect(session.currentDocument()?.canvas).toMatchObject({
      resolution: { ppi: 600 },
      background: { kind: 'solid', rgba: [1, 0.5, 0, 1] },
    });
    expect(history.snapshot()).toMatchObject({ length: 1, cursor: 1, canUndo: true });

    expect(await history.undo()).toBe(true);
    expect(session.currentDocument()?.canvas).toMatchObject({
      resolution: { ppi: 300 },
      background: { kind: 'transparent' },
    });
    expect(await history.redo()).toBe(true);
    expect(session.currentDocument()?.canvas).toMatchObject({
      resolution: { ppi: 600 },
      background: { kind: 'solid', rgba: [1, 0.5, 0, 1] },
    });
  });
});
''')

Path('scripts/verify-m5a-document-foundation.mjs').write_text(r'''import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const required = (text, token, label) => {
  if (!text.includes(token)) throw new Error(`M5A document foundation missing ${label}: ${token}`);
};

const html = read('src/index.html');
const main = read('src/app/main.ts');
const workflow = read('src/app/document-workflow-controller.ts');
const session = read('src/app/paint-session-controller.ts');
const history = read('src/app/paint-history-controller.ts');
const persistence = read('src/app/paint-persistence-controller.ts');
const renderer = read('src/app/renderer-controller.ts');
const worker = read('src/workers/render.worker.ts');
const presets = read('src/domain/document-presets.ts');

for (const id of [
  'new-document',
  'document-settings',
  'document-width',
  'document-height',
  'document-ppi',
  'document-background-mode',
  'document-working-space',
  'document-precision',
]) required(html, `id="${id}"`, `UI ${id}`);
required(main, 'installDocumentWorkflowControllerV1', 'production workflow installation');
required(workflow, 'canvasAdmission.preflight', 'create admission preflight');
required(workflow, 'createNewProject', 'persistent new-project path');
required(session, 'commitDocumentSettings', 'document metadata mutation');
required(history, "commandId: 'document.settings.update'", 'history transaction');
required(persistence, 'async createNewProject', 'new persistent project operation');
required(renderer, 'illustroRendererWorkingSpace', 'renderer working-space diagnostics');
required(renderer, 'illustroRendererPrecision', 'renderer precision diagnostics');
required(worker, 'isDocumentWorkingSpace', 'worker working-space validation');
required(worker, 'isDocumentPrecision', 'worker precision validation');
required(presets, 'a4-portrait-300', 'print preset');
required(presets, 'uhd-4k', 'screen preset');

console.log('M5A document foundation verification passed');
''')

package = json.loads(Path('package.json').read_text())
package['scripts']['verify:m5a'] = 'node scripts/verify-m5a-document-foundation.mjs'
Path('package.json').write_text(json.dumps(package, ensure_ascii=False, indent=2) + '\n')

replace_once(
    '.github/workflows/ci.yml',
    "      - name: M1 contract inspection\n        run: npm run verify:m1\n      - name: M3 foundation inspection\n        run: npm run verify:m3\n",
    "      - name: M1 contract inspection\n        run: npm run verify:m1\n      - name: M2 persistence inspection\n        run: npm run verify:m2\n      - name: M3 foundation inspection\n        run: npm run verify:m3\n      - name: M4 vertical-slice inspection\n        run: npm run verify:m4\n      - name: M5A document foundation inspection\n        run: npm run verify:m5a\n",
)
