from pathlib import Path


def replace_once(path: str, before: str, after: str) -> None:
    p = Path(path)
    text = p.read_text()
    count = text.count(before)
    if count != 1:
        raise SystemExit(f'{path}: expected one anchor, got {count}: {before[:120]!r}')
    p.write_text(text.replace(before, after, 1))


Path('src/app/reference-workspace-state.ts').write_text(r'''import { isUuid } from '../domain/identity.js';
import {
  isSha256Hex,
  type ResourceColorSpaceV1,
  type ResourceV1,
} from '../domain/resources.js';

export const REFERENCE_WORKSPACE_STORAGE_KEY_V1 = 'illustro.reference-workspace.v1';
export const REFERENCE_WORKSPACE_LIMIT_V1 = 24;

export interface ReferenceWorkspaceItemV1 {
  readonly resource: ResourceV1;
  readonly zoom: number;
  readonly rotationQuarterTurns: 0 | 1 | 2 | 3;
}

export interface ReferenceWorkspaceStateV1 {
  readonly schema: 'illustro.reference-workspace/1';
  readonly items: readonly ReferenceWorkspaceItemV1[];
  readonly activeResourceId: string | null;
}

const COLOR_SPACES = new Set<ResourceColorSpaceV1>([
  'none',
  'srgb',
  'display-p3',
  'embedded-profile',
  'data',
]);

function normalizeQuarterTurns(value: number): 0 | 1 | 2 | 3 {
  if (!Number.isInteger(value)) throw new TypeError('reference rotation must be an integer');
  return (((value % 4) + 4) % 4) as 0 | 1 | 2 | 3;
}

function normalizeZoom(value: number): number {
  if (!Number.isFinite(value)) throw new TypeError('reference zoom must be finite');
  return Math.min(8, Math.max(0.25, value));
}

function freezeItem(
  resource: ResourceV1,
  zoom = 1,
  rotationQuarterTurns = 0,
): ReferenceWorkspaceItemV1 {
  return Object.freeze({
    resource,
    zoom: normalizeZoom(zoom),
    rotationQuarterTurns: normalizeQuarterTurns(rotationQuarterTurns),
  });
}

function validateReferenceResource(value: unknown): ResourceV1 {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError('invalid reference resource');
  }
  const record = value as Readonly<Record<string, unknown>>;
  if (!isUuid(record.resourceId)) throw new TypeError('invalid reference resource id');
  if (!Number.isSafeInteger(record.revision) || (record.revision as number) < 0) {
    throw new TypeError('invalid reference resource revision');
  }
  if (record.kind !== 'reference-image') throw new TypeError('resource is not a reference image');
  if (!isSha256Hex(record.contentHash)) throw new TypeError('invalid reference content hash');
  if (typeof record.mimeType !== 'string' || !record.mimeType.startsWith('image/')) {
    throw new TypeError('invalid reference mime type');
  }
  if (!Number.isSafeInteger(record.byteLength) || (record.byteLength as number) < 1) {
    throw new TypeError('invalid reference byte length');
  }
  if (record.originalName !== null && typeof record.originalName !== 'string') {
    throw new TypeError('invalid reference original name');
  }
  if (typeof record.dimensions !== 'object' || record.dimensions === null || Array.isArray(record.dimensions)) {
    throw new TypeError('reference dimensions are required');
  }
  const dimensions = record.dimensions as Readonly<Record<string, unknown>>;
  if (
    !Number.isSafeInteger(dimensions.width) ||
    (dimensions.width as number) < 1 ||
    !Number.isSafeInteger(dimensions.height) ||
    (dimensions.height as number) < 1
  ) {
    throw new TypeError('invalid reference dimensions');
  }
  if (typeof record.colorSpace !== 'string' || !COLOR_SPACES.has(record.colorSpace as ResourceColorSpaceV1)) {
    throw new TypeError('invalid reference color space');
  }
  if (record.channelSemantics !== 'rgb' && record.channelSemantics !== 'rgba') {
    throw new TypeError('invalid reference channel semantics');
  }
  if (record.seamless !== true && record.seamless !== false && record.seamless !== 'unknown') {
    throw new TypeError('invalid reference seamless metadata');
  }
  if (typeof record.provenance !== 'object' || record.provenance === null || Array.isArray(record.provenance)) {
    throw new TypeError('invalid reference provenance');
  }
  if (typeof record.extensions !== 'object' || record.extensions === null || Array.isArray(record.extensions)) {
    throw new TypeError('invalid reference extensions');
  }
  return value as ResourceV1;
}

export function createReferenceWorkspaceStateV1(): ReferenceWorkspaceStateV1 {
  return Object.freeze({
    schema: 'illustro.reference-workspace/1' as const,
    items: Object.freeze([]),
    activeResourceId: null,
  });
}

export function parseReferenceWorkspaceStateV1(value: unknown): ReferenceWorkspaceStateV1 {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError('invalid reference workspace');
  }
  const record = value as Readonly<Record<string, unknown>>;
  if (record.schema !== 'illustro.reference-workspace/1' || !Array.isArray(record.items)) {
    throw new TypeError('invalid reference workspace schema');
  }
  if (record.items.length > REFERENCE_WORKSPACE_LIMIT_V1) {
    throw new RangeError('too many reference images');
  }
  const ids = new Set<string>();
  const items = Object.freeze(
    record.items.map((entry) => {
      if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
        throw new TypeError('invalid reference workspace item');
      }
      const item = entry as Readonly<Record<string, unknown>>;
      const resource = validateReferenceResource(item.resource);
      if (ids.has(resource.resourceId)) throw new TypeError('duplicate reference resource id');
      ids.add(resource.resourceId);
      return freezeItem(
        resource,
        typeof item.zoom === 'number' ? item.zoom : 1,
        typeof item.rotationQuarterTurns === 'number' ? item.rotationQuarterTurns : 0,
      );
    }),
  );
  const activeResourceId = record.activeResourceId;
  if (activeResourceId !== null && typeof activeResourceId !== 'string') {
    throw new TypeError('invalid active reference resource id');
  }
  if (activeResourceId !== null && !ids.has(activeResourceId)) {
    throw new TypeError('active reference resource is missing');
  }
  return Object.freeze({
    schema: 'illustro.reference-workspace/1' as const,
    items,
    activeResourceId: activeResourceId as string | null,
  });
}

export function addReferenceWorkspaceResourceV1(
  state: ReferenceWorkspaceStateV1,
  resource: ResourceV1,
): ReferenceWorkspaceStateV1 {
  if (resource.kind !== 'reference-image') throw new TypeError('resource must be a reference image');
  if (state.items.length >= REFERENCE_WORKSPACE_LIMIT_V1) {
    throw new RangeError(`reference image limit is ${REFERENCE_WORKSPACE_LIMIT_V1}`);
  }
  if (state.items.some((item) => item.resource.resourceId === resource.resourceId)) {
    throw new RangeError('reference resource already exists');
  }
  return Object.freeze({
    ...state,
    items: Object.freeze([...state.items, freezeItem(resource)]),
    activeResourceId: resource.resourceId,
  });
}

export function setActiveReferenceWorkspaceResourceV1(
  state: ReferenceWorkspaceStateV1,
  resourceId: string,
): ReferenceWorkspaceStateV1 {
  if (!state.items.some((item) => item.resource.resourceId === resourceId)) {
    throw new RangeError('reference resource not found');
  }
  if (state.activeResourceId === resourceId) return state;
  return Object.freeze({ ...state, activeResourceId: resourceId });
}

export function removeReferenceWorkspaceResourceV1(
  state: ReferenceWorkspaceStateV1,
  resourceId: string,
): ReferenceWorkspaceStateV1 {
  const index = state.items.findIndex((item) => item.resource.resourceId === resourceId);
  if (index < 0) throw new RangeError('reference resource not found');
  const items = state.items.filter((item) => item.resource.resourceId !== resourceId);
  const activeResourceId =
    state.activeResourceId === resourceId
      ? (items[Math.min(index, items.length - 1)]?.resource.resourceId ?? null)
      : state.activeResourceId;
  return Object.freeze({ ...state, items: Object.freeze(items), activeResourceId });
}

export function updateReferenceWorkspaceViewV1(
  state: ReferenceWorkspaceStateV1,
  resourceId: string,
  input: { readonly zoom?: number; readonly rotationQuarterTurns?: number },
): ReferenceWorkspaceStateV1 {
  let found = false;
  const items = state.items.map((item) => {
    if (item.resource.resourceId !== resourceId) return item;
    found = true;
    return freezeItem(
      item.resource,
      input.zoom ?? item.zoom,
      input.rotationQuarterTurns ?? item.rotationQuarterTurns,
    );
  });
  if (!found) throw new RangeError('reference resource not found');
  return Object.freeze({ ...state, items: Object.freeze(items) });
}

export function activeReferenceWorkspaceItemV1(
  state: ReferenceWorkspaceStateV1,
): ReferenceWorkspaceItemV1 | null {
  if (state.activeResourceId === null) return null;
  return state.items.find((item) => item.resource.resourceId === state.activeResourceId) ?? null;
}
''')

Path('src/app/reference-workflow-controller.ts').write_text(r'''import { freezeRgbUnitColorV1, type RgbUnitColorV1 } from '../domain/color.js';
import { createProvenanceV1, createResourceV1 } from '../domain/resources.js';
import { putImmutableObject, readImmutableObject } from '../storage/immutable-object-store.js';
import { openIllustroOpfsRoot, type IllustroOpfsRootV1 } from '../storage/opfs-layout.js';
import {
  REFERENCE_WORKSPACE_STORAGE_KEY_V1,
  activeReferenceWorkspaceItemV1,
  addReferenceWorkspaceResourceV1,
  createReferenceWorkspaceStateV1,
  parseReferenceWorkspaceStateV1,
  removeReferenceWorkspaceResourceV1,
  setActiveReferenceWorkspaceResourceV1,
  updateReferenceWorkspaceViewV1,
  type ReferenceWorkspaceItemV1,
  type ReferenceWorkspaceStateV1,
} from './reference-workspace-state.js';

export interface ReferenceWorkflowControllerV1 {
  refresh(): void;
  dispose(): void;
  snapshot(): ReferenceWorkspaceStateV1;
}

function requireElement<T extends Element>(root: ParentNode, selector: string, ctor: { new (): T }): T {
  const element = root.querySelector(selector);
  if (!(element instanceof ctor)) throw new Error(`missing reference workflow element: ${selector}`);
  return element;
}

function loadState(storage: Storage | null): ReferenceWorkspaceStateV1 {
  if (storage === null) return createReferenceWorkspaceStateV1();
  const raw = storage.getItem(REFERENCE_WORKSPACE_STORAGE_KEY_V1);
  if (raw === null) return createReferenceWorkspaceStateV1();
  try {
    return parseReferenceWorkspaceStateV1(JSON.parse(raw));
  } catch {
    return createReferenceWorkspaceStateV1();
  }
}

function mimeForReference(file: File): string {
  if (file.type.startsWith('image/')) return file.type;
  throw new TypeError('参照画像は画像ファイルを選択してください');
}

export function referenceViewSourcePointV1(input: {
  readonly viewX: number;
  readonly viewY: number;
  readonly viewWidth: number;
  readonly viewHeight: number;
  readonly sourceWidth: number;
  readonly sourceHeight: number;
  readonly zoom: number;
  readonly rotationQuarterTurns: 0 | 1 | 2 | 3;
}): { readonly x: number; readonly y: number } | null {
  const rotatedWidth = input.rotationQuarterTurns % 2 === 0 ? input.sourceWidth : input.sourceHeight;
  const rotatedHeight = input.rotationQuarterTurns % 2 === 0 ? input.sourceHeight : input.sourceWidth;
  const fit = Math.min(input.viewWidth / rotatedWidth, input.viewHeight / rotatedHeight);
  const scale = fit * input.zoom;
  if (!Number.isFinite(scale) || scale <= 0) return null;
  const dx = input.viewX - input.viewWidth / 2;
  const dy = input.viewY - input.viewHeight / 2;
  const angle = (input.rotationQuarterTurns * Math.PI) / 2;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const localX = (cos * dx + sin * dy) / scale + input.sourceWidth / 2;
  const localY = (-sin * dx + cos * dy) / scale + input.sourceHeight / 2;
  if (localX < 0 || localY < 0 || localX >= input.sourceWidth || localY >= input.sourceHeight) {
    return null;
  }
  return Object.freeze({ x: localX, y: localY });
}

export function referenceRgbaBytesToColorV1(
  rgba: Uint8ClampedArray | readonly number[],
): RgbUnitColorV1 | null {
  if (rgba.length < 4 || rgba[3] === undefined || rgba[3] <= 0) return null;
  return freezeRgbUnitColorV1([
    (rgba[0] ?? 0) / 255,
    (rgba[1] ?? 0) / 255,
    (rgba[2] ?? 0) / 255,
  ]);
}

export function installReferenceWorkflowControllerV1(input: {
  readonly root: HTMLElement;
  readonly onSample: (color: RgbUnitColorV1, label: string) => void;
  readonly storage?: Storage | null;
}): ReferenceWorkflowControllerV1 {
  const storage = input.storage === undefined ? globalThis.localStorage : input.storage;
  const select = requireElement(input.root, '#reference-select', HTMLSelectElement);
  const importButton = requireElement(input.root, '#reference-import', HTMLButtonElement);
  const removeButton = requireElement(input.root, '#reference-remove', HTMLButtonElement);
  const zoomOutButton = requireElement(input.root, '#reference-zoom-out', HTMLButtonElement);
  const zoomResetButton = requireElement(input.root, '#reference-zoom-reset', HTMLButtonElement);
  const zoomInButton = requireElement(input.root, '#reference-zoom-in', HTMLButtonElement);
  const rotateLeftButton = requireElement(input.root, '#reference-rotate-left', HTMLButtonElement);
  const rotateRightButton = requireElement(input.root, '#reference-rotate-right', HTMLButtonElement);
  const fileInput = requireElement(input.root, '#reference-file', HTMLInputElement);
  const canvas = requireElement(input.root, '#reference-canvas', HTMLCanvasElement);
  const status = requireElement(input.root, '#reference-status', HTMLOutputElement);
  let state = loadState(storage);
  let disposed = false;
  let activeBitmap: { readonly resourceId: string; readonly bitmap: ImageBitmap } | null = null;
  let loadSequence = 0;
  let opfsPromise: Promise<IllustroOpfsRootV1> | null = null;
  const scratch = document.createElement('canvas');
  scratch.width = 1;
  scratch.height = 1;
  const scratchContext = scratch.getContext('2d', { willReadFrequently: true });

  const openOpfs = (): Promise<IllustroOpfsRootV1> => {
    opfsPromise ??= openIllustroOpfsRoot();
    return opfsPromise;
  };
  const persist = (): void => {
    try {
      storage?.setItem(REFERENCE_WORKSPACE_STORAGE_KEY_V1, JSON.stringify(state));
    } catch {
      // Reference workspace persistence is best-effort; current editing stays available.
    }
  };

  function activeItem(): ReferenceWorkspaceItemV1 | null {
    return activeReferenceWorkspaceItemV1(state);
  }

  function closeBitmap(): void {
    activeBitmap?.bitmap.close();
    activeBitmap = null;
  }

  function render(): void {
    const context = canvas.getContext('2d');
    if (context === null) return;
    context.save();
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#f6f8fb';
    context.fillRect(0, 0, canvas.width, canvas.height);
    const item = activeItem();
    if (item === null || activeBitmap?.resourceId !== item.resource.resourceId) {
      context.fillStyle = '#667085';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.font = '12px system-ui, sans-serif';
      context.fillText(item === null ? '参照画像を追加' : '参照画像を読み込み中…', canvas.width / 2, canvas.height / 2);
      context.restore();
      return;
    }
    const bitmap = activeBitmap.bitmap;
    const rotatedWidth = item.rotationQuarterTurns % 2 === 0 ? bitmap.width : bitmap.height;
    const rotatedHeight = item.rotationQuarterTurns % 2 === 0 ? bitmap.height : bitmap.width;
    const fit = Math.min(canvas.width / rotatedWidth, canvas.height / rotatedHeight);
    const scale = fit * item.zoom;
    context.translate(canvas.width / 2, canvas.height / 2);
    context.rotate((item.rotationQuarterTurns * Math.PI) / 2);
    context.imageSmoothingEnabled = true;
    context.drawImage(
      bitmap,
      (-bitmap.width * scale) / 2,
      (-bitmap.height * scale) / 2,
      bitmap.width * scale,
      bitmap.height * scale,
    );
    context.restore();
  }

  function publish(): void {
    const item = activeItem();
    select.replaceChildren(
      ...state.items.map((entry) => {
        const option = document.createElement('option');
        option.value = entry.resource.resourceId;
        option.textContent = entry.resource.originalName ?? `Reference ${entry.resource.resourceId.slice(0, 8)}`;
        return option;
      }),
    );
    select.disabled = state.items.length === 0;
    removeButton.disabled = item === null;
    zoomOutButton.disabled = item === null;
    zoomResetButton.disabled = item === null;
    zoomInButton.disabled = item === null;
    rotateLeftButton.disabled = item === null;
    rotateRightButton.disabled = item === null;
    if (item !== null) select.value = item.resource.resourceId;
    input.root.dataset.illustroReferenceCount = String(state.items.length);
    input.root.dataset.illustroReferenceActive = item?.resource.resourceId ?? '';
    input.root.dataset.illustroReferenceZoom = item === null ? '' : String(item.zoom);
    input.root.dataset.illustroReferenceRotation = item === null ? '' : String(item.rotationQuarterTurns * 90);
    render();
  }

  async function decodeBitmap(bytes: Uint8Array<ArrayBuffer>, mimeType: string): Promise<ImageBitmap> {
    if (typeof globalThis.createImageBitmap !== 'function') throw new Error('ImageBitmap decode is unavailable');
    const blob = new Blob([bytes], { type: mimeType });
    return createImageBitmap(blob, { colorSpaceConversion: 'none' });
  }

  async function loadActive(): Promise<void> {
    const item = activeItem();
    const sequence = ++loadSequence;
    closeBitmap();
    publish();
    if (item === null) {
      status.value = '';
      return;
    }
    try {
      const root = await openOpfs();
      const bytes = await readImmutableObject(root.sha256Objects, item.resource.contentHash);
      const bitmap = await decodeBitmap(bytes, item.resource.mimeType);
      if (disposed || sequence !== loadSequence) {
        bitmap.close();
        return;
      }
      activeBitmap = Object.freeze({ resourceId: item.resource.resourceId, bitmap });
      status.value = `${item.resource.originalName ?? 'Reference'} · ${bitmap.width}×${bitmap.height}`;
      render();
    } catch (error) {
      if (sequence !== loadSequence) return;
      status.value = error instanceof Error ? error.message : String(error);
      render();
    }
  }

  async function importFiles(files: readonly File[]): Promise<void> {
    for (const file of files) {
      try {
        const mimeType = mimeForReference(file);
        const sourceBytes = new Uint8Array(await file.arrayBuffer());
        const bitmap = await decodeBitmap(sourceBytes, mimeType);
        const root = await openOpfs();
        const stored = await putImmutableObject(root.sha256Objects, sourceBytes);
        const resource = createResourceV1({
          kind: 'reference-image',
          contentHash: stored.hash,
          mimeType,
          byteLength: stored.byteLength,
          originalName: file.name,
          dimensions: { width: bitmap.width, height: bitmap.height, channels: 4 },
          colorSpace: 'none',
          channelSemantics: 'rgba',
          seamless: 'unknown',
          provenance: createProvenanceV1({
            sourceClass: 'user-imported',
            sourceName: file.name,
            license: 'user-supplied/unknown',
            reuseMode: 'user-supplied',
          }),
          extensions: {
            'illustro.reference-workspace/1': Object.freeze({
              sampling: 'decoded-encoded-components',
              profileConversion: 'pending-m5d-021-025',
            }),
          },
        });
        bitmap.close();
        state = addReferenceWorkspaceResourceV1(state, resource);
        persist();
      } catch (error) {
        status.value = error instanceof Error ? error.message : String(error);
      }
    }
    publish();
    await loadActive();
  }

  function updateView(zoom: number | undefined, rotationQuarterTurns: number | undefined): void {
    const item = activeItem();
    if (item === null) return;
    state = updateReferenceWorkspaceViewV1(state, item.resource.resourceId, {
      ...(zoom === undefined ? {} : { zoom }),
      ...(rotationQuarterTurns === undefined ? {} : { rotationQuarterTurns }),
    });
    persist();
    publish();
  }

  function sampleAtPointer(event: PointerEvent): void {
    const item = activeItem();
    if (item === null || activeBitmap?.resourceId !== item.resource.resourceId || scratchContext === null) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const viewX = ((event.clientX - rect.left) / rect.width) * canvas.width;
    const viewY = ((event.clientY - rect.top) / rect.height) * canvas.height;
    const point = referenceViewSourcePointV1({
      viewX,
      viewY,
      viewWidth: canvas.width,
      viewHeight: canvas.height,
      sourceWidth: activeBitmap.bitmap.width,
      sourceHeight: activeBitmap.bitmap.height,
      zoom: item.zoom,
      rotationQuarterTurns: item.rotationQuarterTurns,
    });
    if (point === null) {
      status.value = '画像外です';
      return;
    }
    const x = Math.min(activeBitmap.bitmap.width - 1, Math.max(0, Math.floor(point.x)));
    const y = Math.min(activeBitmap.bitmap.height - 1, Math.max(0, Math.floor(point.y)));
    scratchContext.setTransform(1, 0, 0, 1, 0, 0);
    scratchContext.clearRect(0, 0, 1, 1);
    scratchContext.imageSmoothingEnabled = false;
    scratchContext.drawImage(activeBitmap.bitmap, x, y, 1, 1, 0, 0, 1, 1);
    const rgba = scratchContext.getImageData(0, 0, 1, 1).data;
    const color = referenceRgbaBytesToColorV1(rgba);
    if (color === null) {
      status.value = '透明ピクセルです';
      return;
    }
    input.onSample(color, item.resource.originalName ?? 'Reference');
    status.value = `参照画像から採色 (${x}, ${y})`;
    input.root.dataset.illustroReferenceSample = `${item.resource.resourceId}:${x}:${y}`;
  }

  const onImport = (): void => fileInput.click();
  const onFileChange = (): void => {
    const files = [...(fileInput.files ?? [])];
    fileInput.value = '';
    void importFiles(files);
  };
  const onSelect = (): void => {
    if (select.value.length === 0) return;
    state = setActiveReferenceWorkspaceResourceV1(state, select.value);
    persist();
    void loadActive();
  };
  const onRemove = (): void => {
    const item = activeItem();
    if (item === null) return;
    state = removeReferenceWorkspaceResourceV1(state, item.resource.resourceId);
    persist();
    void loadActive();
  };
  const onZoomOut = (): void => {
    const item = activeItem();
    if (item !== null) updateView(item.zoom / 1.25, undefined);
  };
  const onZoomReset = (): void => updateView(1, 0);
  const onZoomIn = (): void => {
    const item = activeItem();
    if (item !== null) updateView(item.zoom * 1.25, undefined);
  };
  const onRotateLeft = (): void => {
    const item = activeItem();
    if (item !== null) updateView(undefined, item.rotationQuarterTurns - 1);
  };
  const onRotateRight = (): void => {
    const item = activeItem();
    if (item !== null) updateView(undefined, item.rotationQuarterTurns + 1);
  };
  const onCanvasPointerDown = (event: PointerEvent): void => {
    sampleAtPointer(event);
    event.preventDefault();
  };

  importButton.addEventListener('click', onImport);
  fileInput.addEventListener('change', onFileChange);
  select.addEventListener('change', onSelect);
  removeButton.addEventListener('click', onRemove);
  zoomOutButton.addEventListener('click', onZoomOut);
  zoomResetButton.addEventListener('click', onZoomReset);
  zoomInButton.addEventListener('click', onZoomIn);
  rotateLeftButton.addEventListener('click', onRotateLeft);
  rotateRightButton.addEventListener('click', onRotateRight);
  canvas.addEventListener('pointerdown', onCanvasPointerDown);

  publish();
  void loadActive();
  input.root.dataset.illustroReferenceWorkflow = 'ready';

  return Object.freeze({
    refresh(): void {
      if (!disposed) publish();
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      loadSequence += 1;
      closeBitmap();
      importButton.removeEventListener('click', onImport);
      fileInput.removeEventListener('change', onFileChange);
      select.removeEventListener('change', onSelect);
      removeButton.removeEventListener('click', onRemove);
      zoomOutButton.removeEventListener('click', onZoomOut);
      zoomResetButton.removeEventListener('click', onZoomReset);
      zoomInButton.removeEventListener('click', onZoomIn);
      rotateLeftButton.removeEventListener('click', onRotateLeft);
      rotateRightButton.removeEventListener('click', onRotateRight);
      canvas.removeEventListener('pointerdown', onCanvasPointerDown);
      input.root.dataset.illustroReferenceWorkflow = 'disposed';
    },
    snapshot(): ReferenceWorkspaceStateV1 {
      return state;
    },
  });
}
''')

replace_once(
    'src/app/color-workflow-controller.ts',
    '''export interface ColorWorkflowControllerV1 {\n  refresh(): void;\n  dispose(): void;\n  snapshot(): ColorWorkspaceStateV1;\n  ingestPointerBatch(batch: PointerInputBatchV1): boolean;\n}''',
    '''export interface ColorWorkflowControllerV1 {\n  refresh(): void;\n  dispose(): void;\n  snapshot(): ColorWorkspaceStateV1;\n  ingestPointerBatch(batch: PointerInputBatchV1): boolean;\n  applyExternalSample(color: RgbUnitColorV1, sourceLabel: string): void;\n}''',
)
replace_once(
    'src/app/color-workflow-controller.ts',
    '''    ingestPointerBatch(batch: PointerInputBatchV1): boolean {\n      if (disposed) return false;''',
    '''    applyExternalSample(color: RgbUnitColorV1, sourceLabel: string): void {\n      if (disposed) return;\n      commit(color);\n      status.value = `${sourceLabel}から採色 ${formatHexRgbV1(color)}`;\n      input.root.dataset.illustroColorSamplingSource = 'reference-image';\n    },\n    ingestPointerBatch(batch: PointerInputBatchV1): boolean {\n      if (disposed) return false;''',
)

replace_once(
    'src/app/main.ts',
    "import { installColorWorkflowControllerV1 } from './color-workflow-controller.js';\n",
    "import { installColorWorkflowControllerV1 } from './color-workflow-controller.js';\nimport { installReferenceWorkflowControllerV1 } from './reference-workflow-controller.js';\n",
)
replace_once(
    'src/app/main.ts',
    '''const colorWorkflow = installColorWorkflowControllerV1({\n  root,\n  paintSession,\n  mapPointerToDocument: (sample, documentValue) =>\n    viewport.mapPointerToDocument(sample, documentValue),\n});\nconst selectionCoverage = new SelectionCoverageControllerV1();''',
    '''const colorWorkflow = installColorWorkflowControllerV1({\n  root,\n  paintSession,\n  mapPointerToDocument: (sample, documentValue) =>\n    viewport.mapPointerToDocument(sample, documentValue),\n});\nconst referenceWorkflow = installReferenceWorkflowControllerV1({\n  root,\n  onSample: (color, label) => colorWorkflow.applyExternalSample(color, label),\n});\nvoid referenceWorkflow;\nconst selectionCoverage = new SelectionCoverageControllerV1();''',
)

replace_once(
    'src/index.html',
    '''          </section>\n          <div class="shell-layer-search">''',
    '''          </section>\n          <section class="shell-inspector-card shell-reference-panel" aria-label="Reference / Sub View">\n            <header class="shell-reference-header"><strong>Reference / Sub View</strong><output id="reference-status" aria-live="polite"></output></header>\n            <div class="shell-reference-toolbar">\n              <select id="reference-select" aria-label="参照画像" disabled></select>\n              <button id="reference-import" type="button">追加</button>\n              <button id="reference-remove" type="button" aria-label="参照画像を削除" disabled>×</button>\n              <input id="reference-file" type="file" accept="image/*" multiple hidden />\n            </div>\n            <canvas id="reference-canvas" width="280" height="180" aria-label="参照画像。画像上をタップまたはクリックして採色"></canvas>\n            <div class="shell-reference-view-actions" aria-label="参照画像の表示操作">\n              <button id="reference-rotate-left" type="button" aria-label="参照画像を左へ90度回転" disabled>↶</button>\n              <button id="reference-zoom-out" type="button" aria-label="参照画像を縮小" disabled>−</button>\n              <button id="reference-zoom-reset" type="button" aria-label="参照画像の表示をリセット" disabled>1:1</button>\n              <button id="reference-zoom-in" type="button" aria-label="参照画像を拡大" disabled>＋</button>\n              <button id="reference-rotate-right" type="button" aria-label="参照画像を右へ90度回転" disabled>↷</button>\n            </div>\n          </section>\n          <div class="shell-layer-search">''',
)

css = Path('public/app-shell.css')
css_text = css.read_text()
if '/* M5D reference sampling */' in css_text:
    raise SystemExit('reference CSS already exists')
css.write_text(css_text + r'''

/* M5D reference sampling */
.shell-reference-panel {
  display: grid;
  gap: 0.5rem;
}

.shell-reference-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.shell-reference-header output {
  min-width: 0;
  overflow: hidden;
  color: var(--text-secondary, #667085);
  font-size: 0.7rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.shell-reference-toolbar {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  gap: 0.35rem;
}

.shell-reference-toolbar select,
.shell-reference-toolbar button,
.shell-reference-view-actions button {
  min-height: 2.75rem;
}

#reference-canvas {
  width: 100%;
  max-width: 100%;
  aspect-ratio: 14 / 9;
  border: 1px solid var(--border-default, #e4e9f1);
  border-radius: 8px;
  background: #f6f8fb;
  touch-action: none;
  cursor: crosshair;
}

.shell-reference-view-actions {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 0.35rem;
}
''')

Path('tests/unit/reference-workspace.test.ts').write_text(r'''import { describe, expect, it } from 'vitest';
import { createProvenanceV1, createResourceV1 } from '../../src/domain/resources.js';
import {
  activeReferenceWorkspaceItemV1,
  addReferenceWorkspaceResourceV1,
  createReferenceWorkspaceStateV1,
  parseReferenceWorkspaceStateV1,
  removeReferenceWorkspaceResourceV1,
  setActiveReferenceWorkspaceResourceV1,
  updateReferenceWorkspaceViewV1,
} from '../../src/app/reference-workspace-state.js';
import {
  referenceRgbaBytesToColorV1,
  referenceViewSourcePointV1,
} from '../../src/app/reference-workflow-controller.js';
import { rgbUnitToBytesV1 } from '../../src/domain/color.js';

function resource(name: string, hashByte: string) {
  return createResourceV1({
    kind: 'reference-image',
    contentHash: hashByte.repeat(64),
    mimeType: 'image/png',
    byteLength: 12,
    originalName: name,
    dimensions: { width: 400, height: 200, channels: 4 },
    colorSpace: 'none',
    channelSemantics: 'rgba',
    provenance: createProvenanceV1({ sourceClass: 'user-imported', sourceName: name }),
  });
}

describe('M5D reference image workspace and sampling', () => {
  it('keeps multiple named references, active selection, and per-reference view state', () => {
    const first = resource('first.png', 'a');
    const second = resource('second.png', 'b');
    let state = addReferenceWorkspaceResourceV1(createReferenceWorkspaceStateV1(), first);
    state = addReferenceWorkspaceResourceV1(state, second);
    expect(state.activeResourceId).toBe(second.resourceId);
    state = setActiveReferenceWorkspaceResourceV1(state, first.resourceId);
    state = updateReferenceWorkspaceViewV1(state, first.resourceId, {
      zoom: 2.5,
      rotationQuarterTurns: -1,
    });
    expect(activeReferenceWorkspaceItemV1(state)).toMatchObject({
      zoom: 2.5,
      rotationQuarterTurns: 3,
    });
    expect(parseReferenceWorkspaceStateV1(JSON.parse(JSON.stringify(state)))).toEqual(state);
  });

  it('chooses a neighboring reference when the active reference is removed', () => {
    const first = resource('first.png', 'c');
    const second = resource('second.png', 'd');
    let state = addReferenceWorkspaceResourceV1(createReferenceWorkspaceStateV1(), first);
    state = addReferenceWorkspaceResourceV1(state, second);
    state = removeReferenceWorkspaceResourceV1(state, second.resourceId);
    expect(state.activeResourceId).toBe(first.resourceId);
  });

  it('maps a rotated reference-view point back into source pixels', () => {
    const point = referenceViewSourcePointV1({
      viewX: 100,
      viewY: 50,
      viewWidth: 200,
      viewHeight: 100,
      sourceWidth: 100,
      sourceHeight: 200,
      zoom: 1,
      rotationQuarterTurns: 1,
    });
    expect(point?.x).toBeCloseTo(50, 6);
    expect(point?.y).toBeCloseTo(100, 6);
  });

  it('converts a visible decoded reference pixel to the canonical color state', () => {
    expect(rgbUnitToBytesV1(referenceRgbaBytesToColorV1(new Uint8ClampedArray([12, 130, 240, 255]))!)).toEqual([
      12,
      130,
      240,
    ]);
    expect(referenceRgbaBytesToColorV1(new Uint8ClampedArray([12, 130, 240, 0]))).toBeNull();
  });
});
''')

replace_once(
    'scripts/verify-m5d-color.mjs',
    '''requireText('src/app/main.ts', ['colorWorkflow.ingestPointerBatch', "'eyedropper'"]);''',
    '''requireText('src/app/main.ts', [\n  'colorWorkflow.ingestPointerBatch',\n  "'eyedropper'",\n  'installReferenceWorkflowControllerV1',\n  'colorWorkflow.applyExternalSample',\n]);\nrequireText('src/app/reference-workflow-controller.ts', [\n  'putImmutableObject',\n  'readImmutableObject',\n  "kind: 'reference-image'",\n  'referenceViewSourcePointV1',\n  'referenceRgbaBytesToColorV1',\n]);\nrequireText('src/app/reference-workspace-state.ts', [\n  "illustro.reference-workspace/1",\n  'REFERENCE_WORKSPACE_LIMIT_V1',\n]);''',
)
replace_once(
    'scripts/verify-m5d-color.mjs',
    '''  'id="color-palette-select"',''',
    '''  'id="color-palette-select"',\n  'id="reference-select"',\n  'id="reference-import"',\n  'id="reference-canvas"',''',
)
replace_once(
    'scripts/verify-m5d-color.mjs',
    '''  'M5D-020 reference-image sampling:未完了',''',
    '''  'M5D-020 reference-image sampling:完了',\n  'M5D-021 sRGB processing:未完了',''',
)

progress = Path('IMPLEMENTATION_PROGRESS.md')
progress_text = progress.read_text()
old = 'M5D-020 reference-image sampling:未完了'
if progress_text.count(old) != 1:
    raise SystemExit('M5D-020 progress anchor missing')
progress.write_text(progress_text.replace(old, 'M5D-020 reference-image sampling:完了', 1))

memo = Path('ILLUSTRO_DESIGN_MEMO.md')
memo_text = memo.read_text()
marker = '#### M5D reference-image sampling production boundary — 2026-09-02'
if marker in memo_text:
    raise SystemExit('reference sampling memo already exists')
memo.write_text(memo_text + r'''


#### M5D reference-image sampling production boundary — 2026-09-02

- M5D-020 is production-connected through a real Reference / Sub View block rather than a dead sampler helper. Users can import multiple local image references, switch the active reference, remove references, zoom, rotate/reset the reference view, and tap/click the visible reference image to commit its sampled color into the same canonical Color Workspace current/previous/history path used by canvas Eyedropper and painting.
- Reference source bytes are stored once in the existing OPFS SHA-256 immutable-object store. Workspace reference metadata persists separately as `illustro.reference-workspace/1` and carries a real `ResourceV1(kind = reference-image)` record with content hash, MIME type, dimensions and user-import provenance. Switching/reloading reads bytes back by content hash; object URLs or transient DOM handles are never the persisted source of truth.
- The Reference workspace is user/workspace presentation state in M5D-020 and therefore does not create document Undo entries merely for zoom/rotation/switching. Reference bytes remain compatible with the canonical Resource schema so later project/native-format Reference/Sub View integration does not require inventing an incompatible asset representation.
- At most one active decoded `ImageBitmap` is retained by this initial Reference panel controller; switching or disposing closes the previous bitmap. This prevents multiple large reference images from being eagerly decoded into resident memory merely because their metadata remains in the workspace list.
- Reference sampling maps the visible transformed view point back to the source image pixel and samples a one-pixel scratch surface, avoiding a permanent full-size CPU `ImageData` copy. Transparent pixels do not change the current color.
- M5D-020 deliberately labels imported reference color space as unresolved (`none`) and requests decode without browser-side color-space conversion where the platform supports `createImageBitmap` options. The sampled component values are treated as decoded encoded RGB values only. **No ICC/profile-aware conversion claim is made here**; sRGB, Display-P3, metadata, conversion and preview-boundary semantics remain M5D-021 through M5D-025.
''')
