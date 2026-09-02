import { freezeRgbUnitColorV1, type RgbUnitColorV1 } from '../domain/color.js';
import { convertEncodedRgbV1 } from '../domain/color-management.js';
import type { DocumentColorSpace } from '../domain/document.js';
import { colorMatchStatisticsFromRgba8V1, type ColorMatchStatisticsV1 } from './color-match.js';
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
  activeReferenceLabel(): string | null;
  activeColorStatistics(targetSpace: DocumentColorSpace): Promise<ColorMatchStatisticsV1 | null>;
  snapshot(): ReferenceWorkspaceStateV1;
}

function requireElement<T extends Element>(
  root: ParentNode,
  selector: string,
  ctor: { new (): T },
): T {
  const element = root.querySelector(selector);
  if (!(element instanceof ctor))
    throw new Error(`missing reference workflow element: ${selector}`);
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
  const rotatedWidth =
    input.rotationQuarterTurns % 2 === 0 ? input.sourceWidth : input.sourceHeight;
  const rotatedHeight =
    input.rotationQuarterTurns % 2 === 0 ? input.sourceHeight : input.sourceWidth;
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
  return freezeRgbUnitColorV1([(rgba[0] ?? 0) / 255, (rgba[1] ?? 0) / 255, (rgba[2] ?? 0) / 255]);
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
  const rotateRightButton = requireElement(
    input.root,
    '#reference-rotate-right',
    HTMLButtonElement,
  );
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
  const statisticsCanvas = document.createElement('canvas');
  const statisticsContext = statisticsCanvas.getContext('2d', { willReadFrequently: true });

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
      context.fillText(
        item === null ? '参照画像を追加' : '参照画像を読み込み中…',
        canvas.width / 2,
        canvas.height / 2,
      );
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
        option.textContent =
          entry.resource.originalName ?? `Reference ${entry.resource.resourceId.slice(0, 8)}`;
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
    input.root.dataset.illustroReferenceRotation =
      item === null ? '' : String(item.rotationQuarterTurns * 90);
    render();
  }

  async function decodeBitmap(
    bytes: Uint8Array<ArrayBuffer>,
    mimeType: string,
  ): Promise<ImageBitmap> {
    if (typeof globalThis.createImageBitmap !== 'function')
      throw new Error('ImageBitmap decode is unavailable');
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
              profileConversion: 'builtin-srgb-reference-baseline',
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
    if (
      item === null ||
      activeBitmap?.resourceId !== item.resource.resourceId ||
      scratchContext === null
    )
      return;
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

  function referenceLabel(): string | null {
    const item = activeItem();
    if (item === null) return null;
    return item.resource.originalName ?? `Reference ${item.resource.resourceId.slice(0, 8)}`;
  }

  async function referenceStatistics(
    targetSpace: DocumentColorSpace,
  ): Promise<ColorMatchStatisticsV1 | null> {
    const item = activeItem();
    if (
      item === null ||
      activeBitmap?.resourceId !== item.resource.resourceId ||
      statisticsContext === null
    ) {
      return null;
    }
    const bitmap = activeBitmap.bitmap;
    const maxDimension = 96;
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    statisticsCanvas.width = width;
    statisticsCanvas.height = height;
    statisticsContext.setTransform(1, 0, 0, 1, 0, 0);
    statisticsContext.clearRect(0, 0, width, height);
    statisticsContext.imageSmoothingEnabled = true;
    statisticsContext.drawImage(bitmap, 0, 0, width, height);
    const rgba = statisticsContext.getImageData(0, 0, width, height).data;
    if (targetSpace === 'srgb') return colorMatchStatisticsFromRgba8V1(rgba, width, height);
    const converted = new Uint8ClampedArray(rgba.length);
    for (let offset = 0; offset < rgba.length; offset += 4) {
      const alpha = rgba[offset + 3] ?? 0;
      converted[offset + 3] = alpha;
      if (alpha <= 0) continue;
      const color = convertEncodedRgbV1(
        freezeRgbUnitColorV1([
          (rgba[offset] ?? 0) / 255,
          (rgba[offset + 1] ?? 0) / 255,
          (rgba[offset + 2] ?? 0) / 255,
        ]),
        'srgb',
        targetSpace,
      );
      converted[offset] = Math.round(color[0] * 255);
      converted[offset + 1] = Math.round(color[1] * 255);
      converted[offset + 2] = Math.round(color[2] * 255);
    }
    return colorMatchStatisticsFromRgba8V1(converted, width, height);
  }

  const onImport = (): void => fileInput.click();
  const onFileChange = (): void => {
    const files = Array.from(fileInput.files ?? []);
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
    activeReferenceLabel(): string | null {
      return referenceLabel();
    },
    activeColorStatistics(targetSpace: DocumentColorSpace): Promise<ColorMatchStatisticsV1 | null> {
      return referenceStatistics(targetSpace);
    },
    snapshot(): ReferenceWorkspaceStateV1 {
      return state;
    },
  });
}
