from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f'{label} changed; refusing blind patch')
    return text.replace(old, new, 1)

# 1) Expose a production New Document API in the existing workflow controller.
path = Path('src/app/document-workflow-controller.ts')
s = path.read_text()

old = """export interface DocumentWorkflowControllerV1 {
  readonly schema: 'illustro.document-workflow-controller/1';
  openNewDocument(): void;
  openDocumentSettings(): void;
  dispose(): void;
}
"""
new = """export interface NewDocumentRequestV1 {
  readonly name: string;
  readonly width: number;
  readonly height: number;
  readonly ppi: number;
  readonly background: CanvasBackgroundSpec;
  readonly workingSpace: DocumentColorSpace;
  readonly precision: DocumentPrecision;
}

export interface DocumentWorkflowControllerV1 {
  readonly schema: 'illustro.document-workflow-controller/1';
  openNewDocument(): void;
  createNewDocument(input: NewDocumentRequestV1): void;
  openDocumentSettings(): void;
  dispose(): void;
}
"""
s = replace_once(s, old, new, 'DocumentWorkflow interface')

marker = """  const onPresetChange = (): void => applyPreset(presetSelect.value);
"""
addition = """  const performNewDocumentCreation = async (input: NewDocumentRequestV1): Promise<void> => {
    if (!Number.isSafeInteger(input.width) || input.width < 1) {
      throw new RangeError('width must be a positive integer');
    }
    if (!Number.isSafeInteger(input.height) || input.height < 1) {
      throw new RangeError('height must be a positive integer');
    }
    if (!Number.isFinite(input.ppi) || input.ppi <= 0) {
      throw new RangeError('PPI must be a positive finite number');
    }
    if (input.workingSpace !== 'srgb' && input.workingSpace !== 'display-p3') {
      throw new TypeError('unsupported document working space');
    }
    if (input.precision !== 'rgba8-unorm' && input.precision !== 'rgba16-float') {
      throw new TypeError('unsupported document precision');
    }
    const admission = await options.canvasAdmission.preflightDocumentCreate({
      width: input.width,
      height: input.height,
      precision: input.precision,
    });
    if (!admission.allowed) {
      throw new Error(`作成できません: ${admission.reasons.join(', ')}`);
    }
    await options.paintPersistence.createNewProject({
      name: input.name.trim() || 'Untitled',
      document: {
        width: input.width,
        height: input.height,
        ppi: input.ppi,
        background: input.background,
        workingSpace: input.workingSpace,
        precision: input.precision,
      },
    });
    const current = options.paintSession.currentDocument();
    if (current === null) throw new Error('new document creation lost the active document');
    options.onDocumentChanged(current);
    options.onHistoryChanged();
    options.onProjectCreated?.(current);
  };

  const createNewDocument = (input: NewDocumentRequestV1): void => {
    root.dataset.illustroDocumentWorkflowError = '';
    options.schedule(async () => {
      try {
        await performNewDocumentCreation(input);
      } catch (error) {
        root.dataset.illustroDocumentWorkflowError =
          error instanceof Error ? error.message : String(error);
      }
    });
  };

"""
s = replace_once(s, marker, addition + marker, 'DocumentWorkflow creation insertion point')

old = """        } else {
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
          const admission = await options.canvasAdmission.preflightDocumentCreate({
            width,
            height,
            precision,
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
          options.onProjectCreated?.(current);
        }
"""
new = """        } else {
          await performNewDocumentCreation({
            name: nameInput.value,
            width: integerInput(widthInput, 'width'),
            height: integerInput(heightInput, 'height'),
            ppi,
            background,
            workingSpace: workingSpaceSelect.value as DocumentColorSpace,
            precision: precisionSelect.value as DocumentPrecision,
          });
        }
"""
s = replace_once(s, old, new, 'Legacy New Document submission body')

old = """  return Object.freeze({
    schema: 'illustro.document-workflow-controller/1' as const,
    openNewDocument,
    openDocumentSettings,
"""
new = """  return Object.freeze({
    schema: 'illustro.document-workflow-controller/1' as const,
    openNewDocument,
    createNewDocument,
    openDocumentSettings,
"""
s = replace_once(s, old, new, 'DocumentWorkflow return object')
path.write_text(s)

# 2) Turn the canonical M8 New Document task surface into the visible production UI.
path = Path('src/app/m8-product-shell.ts')
s = path.read_text()
imports = """import type { CanvasBackgroundSpec } from '../domain/document.js';
import { DEFAULT_DOCUMENT_PRESETS_V1 } from '../domain/document-presets.js';
import type { NewDocumentRequestV1 } from './document-workflow-controller.js';

"""
if not s.startswith('export const M8_PRODUCT_REGIONS_V1'):
    raise SystemExit('M8 shell imports changed; refusing blind patch')
s = imports + s

old = """export interface M8ProductShellHandleV1 {
  showLibrary(): void;
  hideLibrary(): void;
  setDocumentIdentity(name: string): void;
"""
new = """export interface M8ProductShellHandleV1 {
  showLibrary(): void;
  hideLibrary(): void;
  setNewDocumentSubmitHandler(handler: (input: NewDocumentRequestV1) => void): void;
  setDocumentIdentity(name: string): void;
"""
s = replace_once(s, old, new, 'M8 product shell handle')

marker = """function requireElementV1<T extends Element>(root: ParentNode, selector: string, label: string): T {
"""
helpers = """function colorToHexV1(background: CanvasBackgroundSpec): string {
  if (background.kind === 'transparent') return '#ffffff';
  const [red, green, blue] = background.rgba;
  return `#${[red, green, blue]
    .map((component) =>
      Math.round(component * 255)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}

function backgroundFromHexV1(value: string, alphaPercent: number): CanvasBackgroundSpec {
  const match = /^#([0-9a-f]{6})$/i.exec(value);
  if (match === null || match[1] === undefined) throw new TypeError('background color is invalid');
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

"""
s = replace_once(s, marker, helpers + marker, 'M8 helper insertion point')

old = """  let toastTimer: number | null = null;

  const showLibrary = (): void => {
"""
new = """  let toastTimer: number | null = null;
  let newDocumentSubmitHandler: ((input: NewDocumentRequestV1) => void) | null = null;
  const taskBody = requireElementV1<HTMLElement>(taskSurface, '.m8-task-body', 'Task body');
  const taskPrimary = requireElementV1<HTMLButtonElement>(
    taskSurface,
    '.m8-task-primary',
    'Task primary action',
  );

  const showLibrary = (): void => {
"""
s = replace_once(s, old, new, 'M8 task state insertion point')

old = """  const closeTaskSurface = (): void => {
    taskLayer.hidden = true;
    taskSurface.removeAttribute('data-tone');
    const title = taskSurface.querySelector<HTMLElement>('#m8-task-title');
    const body = taskSurface.querySelector<HTMLElement>('.m8-task-body');
    if (title) title.textContent = '';
    if (body) body.textContent = '';
  };
  const openTaskSurface = (title: string, body: string): void => {
    const titleNode = taskSurface.querySelector<HTMLElement>('#m8-task-title');
    const bodyNode = taskSurface.querySelector<HTMLElement>('.m8-task-body');
    if (titleNode) titleNode.textContent = title;
    if (bodyNode) bodyNode.textContent = body;
    taskLayer.hidden = false;
  };
  const openNamedTaskSurface = (surfaceId: M8TaskSurfaceIdV1): void => {
    const copy = TASK_SURFACE_COPY_V1[surfaceId];
    taskSurface.dataset.surface = surfaceId;
    if (copy.tone) taskSurface.dataset.tone = copy.tone;
    openTaskSurface(copy.title, copy.body);
  };
"""
new = """  const resetTaskPrimary = (): void => {
    taskPrimary.disabled = true;
    taskPrimary.textContent = '適用';
    delete taskPrimary.dataset.m8NewDocumentSubmit;
  };
  const closeTaskSurface = (): void => {
    taskLayer.hidden = true;
    taskSurface.removeAttribute('data-tone');
    taskSurface.removeAttribute('data-surface');
    const title = taskSurface.querySelector<HTMLElement>('#m8-task-title');
    if (title) title.textContent = '';
    taskBody.textContent = '';
    resetTaskPrimary();
  };
  const openTaskSurface = (title: string, body: string): void => {
    const titleNode = taskSurface.querySelector<HTMLElement>('#m8-task-title');
    if (titleNode) titleNode.textContent = title;
    taskBody.textContent = body;
    resetTaskPrimary();
    taskLayer.hidden = false;
  };

  const renderNewDocumentTask = (): void => {
    const presetOptions = [
      ...DEFAULT_DOCUMENT_PRESETS_V1.map(
        (entry) => `<option value=\"${entry.id}\">${entry.label}</option>`,
      ),
      '<option value=\"custom\">カスタム</option>',
    ].join('');
    taskBody.innerHTML = `
      <form id=\"m8-new-document-form\" class=\"m8-new-document-form\" data-m8-new-document-form>
        <label class=\"m8-new-document-wide\"><span>名前</span><input name=\"name\" type=\"text\" maxlength=\"120\" value=\"Untitled\" required /></label>
        <label class=\"m8-new-document-wide\"><span>プリセット</span><select name=\"preset\">${presetOptions}</select></label>
        <div class=\"m8-new-document-grid\">
          <label><span>幅</span><input name=\"width\" type=\"number\" min=\"1\" max=\"32768\" step=\"1\" required /></label>
          <label><span>高さ</span><input name=\"height\" type=\"number\" min=\"1\" max=\"32768\" step=\"1\" required /></label>
          <label><span>PPI</span><input name=\"ppi\" type=\"number\" min=\"0.01\" step=\"0.01\" required /></label>
        </div>
        <div class=\"m8-new-document-grid\">
          <label><span>背景</span><select name=\"backgroundMode\"><option value=\"transparent\">透明</option><option value=\"solid\">単色</option></select></label>
          <label><span>背景色</span><input name=\"backgroundColor\" type=\"color\" value=\"#ffffff\" /></label>
          <label><span>背景不透明度</span><input name=\"backgroundAlpha\" type=\"number\" min=\"0\" max=\"100\" step=\"1\" value=\"100\" /></label>
        </div>
        <div class=\"m8-new-document-grid m8-new-document-grid-two\">
          <label><span>色空間</span><select name=\"workingSpace\"><option value=\"srgb\">sRGB</option><option value=\"display-p3\">Display-P3</option></select></label>
          <label><span>精度</span><select name=\"precision\"><option value=\"rgba8-unorm\">RGBA8</option><option value=\"rgba16-float\">RGBA16F</option></select></label>
        </div>
        <output class=\"m8-new-document-status\" data-m8-new-document-status aria-live=\"polite\"></output>
        <button type=\"submit\" hidden aria-hidden=\"true\"></button>
      </form>`;

    const form = requireElementV1<HTMLFormElement>(taskBody, '[data-m8-new-document-form]', 'New Document form');
    const preset = requireElementV1<HTMLSelectElement>(form, '[name=\"preset\"]', 'New Document preset');
    const width = requireElementV1<HTMLInputElement>(form, '[name=\"width\"]', 'New Document width');
    const height = requireElementV1<HTMLInputElement>(form, '[name=\"height\"]', 'New Document height');
    const ppi = requireElementV1<HTMLInputElement>(form, '[name=\"ppi\"]', 'New Document PPI');
    const backgroundMode = requireElementV1<HTMLSelectElement>(form, '[name=\"backgroundMode\"]', 'New Document background mode');
    const backgroundColor = requireElementV1<HTMLInputElement>(form, '[name=\"backgroundColor\"]', 'New Document background color');
    const backgroundAlpha = requireElementV1<HTMLInputElement>(form, '[name=\"backgroundAlpha\"]', 'New Document background alpha');
    const workingSpace = requireElementV1<HTMLSelectElement>(form, '[name=\"workingSpace\"]', 'New Document working space');
    const precision = requireElementV1<HTMLSelectElement>(form, '[name=\"precision\"]', 'New Document precision');

    const syncBackgroundAvailability = (): void => {
      const solid = backgroundMode.value === 'solid';
      backgroundColor.disabled = !solid;
      backgroundAlpha.disabled = !solid;
    };
    const applyPreset = (): void => {
      const entry = DEFAULT_DOCUMENT_PRESETS_V1.find((candidate) => candidate.id === preset.value);
      if (!entry) return;
      width.value = String(entry.width);
      height.value = String(entry.height);
      ppi.value = String(entry.ppi);
      backgroundMode.value = entry.background.kind;
      backgroundColor.value = colorToHexV1(entry.background);
      backgroundAlpha.value =
        entry.background.kind === 'solid' ? String(entry.background.rgba[3] * 100) : '100';
      workingSpace.value = entry.workingSpace;
      precision.value = entry.precision;
      syncBackgroundAvailability();
    };
    const markCustom = (): void => {
      preset.value = 'custom';
    };
    preset.addEventListener('change', applyPreset);
    backgroundMode.addEventListener('change', () => {
      markCustom();
      syncBackgroundAvailability();
    });
    for (const control of [width, height, ppi, backgroundColor, backgroundAlpha, workingSpace, precision]) {
      control.addEventListener('change', markCustom);
    }
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      taskPrimary.click();
    });
    preset.value = DEFAULT_DOCUMENT_PRESETS_V1[0]?.id ?? 'custom';
    applyPreset();
    taskPrimary.textContent = '作成';
    taskPrimary.dataset.m8NewDocumentSubmit = 'true';
    taskPrimary.disabled = newDocumentSubmitHandler === null;
    requireElementV1<HTMLInputElement>(form, '[name=\"name\"]', 'New Document name').focus();
  };

  const submitNewDocumentTask = (): void => {
    const handler = newDocumentSubmitHandler;
    if (handler === null) return;
    const form = taskBody.querySelector<HTMLFormElement>('[data-m8-new-document-form]');
    if (form === null || !form.reportValidity()) return;
    const name = requireElementV1<HTMLInputElement>(form, '[name=\"name\"]', 'New Document name');
    const width = requireElementV1<HTMLInputElement>(form, '[name=\"width\"]', 'New Document width');
    const height = requireElementV1<HTMLInputElement>(form, '[name=\"height\"]', 'New Document height');
    const ppi = requireElementV1<HTMLInputElement>(form, '[name=\"ppi\"]', 'New Document PPI');
    const backgroundMode = requireElementV1<HTMLSelectElement>(form, '[name=\"backgroundMode\"]', 'New Document background mode');
    const backgroundColor = requireElementV1<HTMLInputElement>(form, '[name=\"backgroundColor\"]', 'New Document background color');
    const backgroundAlpha = requireElementV1<HTMLInputElement>(form, '[name=\"backgroundAlpha\"]', 'New Document background alpha');
    const workingSpace = requireElementV1<HTMLSelectElement>(form, '[name=\"workingSpace\"]', 'New Document working space');
    const precision = requireElementV1<HTMLSelectElement>(form, '[name=\"precision\"]', 'New Document precision');
    const status = requireElementV1<HTMLOutputElement>(form, '[data-m8-new-document-status]', 'New Document status');
    const background: CanvasBackgroundSpec =
      backgroundMode.value === 'transparent'
        ? Object.freeze({ kind: 'transparent' as const })
        : backgroundFromHexV1(backgroundColor.value, Number(backgroundAlpha.value));
    const input: NewDocumentRequestV1 = {
      name: name.value,
      width: Number(width.value),
      height: Number(height.value),
      ppi: Number(ppi.value),
      background,
      workingSpace: workingSpace.value as NewDocumentRequestV1['workingSpace'],
      precision: precision.value as NewDocumentRequestV1['precision'],
    };
    status.value = '作成中…';
    taskPrimary.disabled = true;
    taskPrimary.textContent = '作成中…';
    handler(input);
  };

  const openNamedTaskSurface = (surfaceId: M8TaskSurfaceIdV1): void => {
    const copy = TASK_SURFACE_COPY_V1[surfaceId];
    taskSurface.dataset.surface = surfaceId;
    if (copy.tone) taskSurface.dataset.tone = copy.tone;
    openTaskSurface(copy.title, surfaceId === 'new-document' ? '' : copy.body);
    taskSurface.dataset.surface = surfaceId;
    if (surfaceId === 'new-document') renderNewDocumentTask();
  };
"""
s = replace_once(s, old, new, 'M8 task surface implementation')

old = """    if (target.hasAttribute('data-m8-task-close')) {
      closeTaskSurface();
      return;
    }
    const taskId = target.dataset.m8Task as M8TaskSurfaceIdV1 | undefined;
"""
new = """    if (target.hasAttribute('data-m8-task-close')) {
      closeTaskSurface();
      return;
    }
    if (target.hasAttribute('data-m8-new-document-submit')) {
      submitNewDocumentTask();
      return;
    }
    const taskId = target.dataset.m8Task as M8TaskSurfaceIdV1 | undefined;
"""
s = replace_once(s, old, new, 'M8 canonical click handler')

old = """    const persistence = root.dataset.illustroPersistence;
    if (persistence === 'error') {
"""
new = """    if (taskSurface.dataset.surface === 'new-document') {
      const workflowError = root.dataset.illustroDocumentWorkflowError;
      const status = taskBody.querySelector<HTMLOutputElement>('[data-m8-new-document-status]');
      if (status && workflowError) {
        status.value = workflowError;
        taskPrimary.textContent = '作成';
        taskPrimary.disabled = newDocumentSubmitHandler === null;
      }
    }

    const persistence = root.dataset.illustroPersistence;
    if (persistence === 'error') {
"""
s = replace_once(s, old, new, 'M8 runtime-state error bridge')

old = """      'data-illustro-persistence',
    ],
"""
new = """      'data-illustro-persistence',
      'data-illustro-document-workflow-error',
    ],
"""
s = replace_once(s, old, new, 'M8 runtime observer attributes')

old = """  return {
    showLibrary,
    hideLibrary,
    setDocumentIdentity(name: string): void {
"""
new = """  return {
    showLibrary,
    hideLibrary,
    setNewDocumentSubmitHandler(handler: (input: NewDocumentRequestV1) => void): void {
      newDocumentSubmitHandler = handler;
      if (taskSurface.dataset.surface === 'new-document') {
        taskPrimary.disabled = false;
      }
    },
    setDocumentIdentity(name: string): void {
"""
s = replace_once(s, old, new, 'M8 handle New Document connector')
path.write_text(s)

# 3) Wire main.ts: canonical UI -> DocumentWorkflow -> persistence -> Canvas.
path = Path('src/app/main.ts')
s = path.read_text()
old = """  onProjectCreated(documentValue) {
    activatePaintDocument(documentValue, 'created');
    shell.productShell.hideLibrary();
  },
});

const documentGeometryWorkflow = installDocumentGeometryWorkflowControllerV1({
"""
new = """  onProjectCreated(documentValue) {
    activatePaintDocument(documentValue, 'created');
    shell.productShell.closeTaskSurface();
    shell.productShell.hideLibrary();
  },
});
shell.productShell.setNewDocumentSubmitHandler((input) => documentWorkflow.createNewDocument(input));

const documentGeometryWorkflow = installDocumentGeometryWorkflowControllerV1({
"""
s = replace_once(s, old, new, 'main New Document production connector')
old = """      onNewProject: () => documentWorkflow.openNewDocument(),
"""
new = """      onNewProject: () => shell.productShell.openNamedTaskSurface('new-document'),
"""
s = replace_once(s, old, new, 'M9A New Project route')
path.write_text(s)

# 4) Canonical New Document visual treatment.
path = Path('public/m8-shell.css')
s = path.read_text()
marker = """.m8-data-safety-banner {
"""
css = """.m8-new-document-form {
  display: grid;
  gap: 14px;
  color: #344258;
}

.m8-new-document-form label {
  display: grid;
  gap: 6px;
  min-width: 0;
  color: #667287;
  font-size: 10px;
  font-weight: 720;
}

.m8-new-document-form label > span {
  padding-inline: 2px;
}

.m8-new-document-form input,
.m8-new-document-form select {
  width: 100%;
  min-height: 42px;
  padding: 0 12px;
  border: 1px solid #dfe5ed;
  border-radius: 10px;
  outline: none;
  background: #fff;
  color: #26364d;
  font: inherit;
  font-size: 12px;
}

.m8-new-document-form input:focus,
.m8-new-document-form select:focus {
  border-color: #8fc2ff;
  box-shadow: 0 0 0 3px rgb(143 194 255 / 18%);
}

.m8-new-document-form input[type='color'] {
  padding: 4px 6px;
}

.m8-new-document-form :disabled {
  background: #f4f6f8;
  color: #9aa3b0;
}

.m8-new-document-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.m8-new-document-grid-two {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.m8-new-document-status {
  min-height: 18px;
  color: #c24c65;
  font-size: 10px;
  font-weight: 650;
}

.m8-task-primary:disabled {
  cursor: default;
  opacity: 0.55;
}

@media (max-width: 640px) {
  .m8-new-document-grid,
  .m8-new-document-grid-two {
    grid-template-columns: 1fr;
  }
}

"""
s = replace_once(s, marker, css + marker, 'M8 New Document CSS insertion point')
path.write_text(s)

# 5) Regression tests: M9A route must open canonical production surface, not hidden legacy dialog.
path = Path('tests/unit/m9a-library-production.test.ts')
s = path.read_text()
old = """    expect(mainSource).toContain('onNewProject: () => documentWorkflow.openNewDocument()');
"""
new = """    expect(mainSource).toContain(
      \"onNewProject: () => shell.productShell.openNamedTaskSurface('new-document')\",
    );
    expect(mainSource).toContain('setNewDocumentSubmitHandler');
    expect(mainSource).toContain('documentWorkflow.createNewDocument(input)');
"""
s = replace_once(s, old, new, 'M9A New Project regression assertion')
path.write_text(s)

path = Path('tests/unit/m8-product-shell.test.ts')
s = path.read_text()
marker = """  it('provides the complete M8B task-surface taxonomy as shells', () => {
"""
addition = """  it('connects the canonical New Document surface to production creation without exposing legacy UI', () => {
    expect(shellSource).toContain('data-m8-new-document-form');
    expect(shellSource).toContain('setNewDocumentSubmitHandler');
    expect(shellSource).toContain('handler(input)');
    expect(shellSource).toContain('DEFAULT_DOCUMENT_PRESETS_V1');
    expect(shellSource).not.toContain("proxyLegacyCommandV1('new-document')");
    expect(shellCss).toContain('.m8-new-document-form');
  });

"""
s = replace_once(s, marker, addition + marker, 'M8 New Document regression test insertion')
path.write_text(s)
