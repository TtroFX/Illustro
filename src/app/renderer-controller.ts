import {
  planBaselineBrushTilesV1,
  type BaselineBrushCompositeOperationV1,
  type BaselineBrushDabV1,
} from '../gpu/baseline-brush.js';
import type { DocumentColorSpace, DocumentPrecision } from '../domain/document.js';
import {
  BaselinePaintRendererV1,
  type BaselinePaintCommittedStrokeV1,
  type BaselinePaintFinalizationV1,
  type BaselinePaintRendererSnapshotV1,
} from '../gpu/baseline-paint-renderer.js';
import type {
  BaselineAffineMatrixV1,
  BaselineRasterLayerDescriptorV1,
  BaselineRasterTileImageV1,
  BaselineRasterTilePatchDirectionV1,
  BaselineRasterTilePatchV1,
} from '../gpu/baseline-raster-tile-store.js';
import type { TileCoordinateV1 } from '../gpu/sparse-tile-model.js';
import { acquireCoreWebGpuV1 } from '../gpu/webgpu-capability.js';
import {
  RendererDeviceManagerV1,
  type RendererDeviceSnapshotV1,
  type RendererDeviceStateV1,
} from '../gpu/renderer-device-manager.js';
import {
  configureRendererSurfaceV1,
  rebuildRendererDeviceResourcesV1,
  RendererPreviewColorSpaceUnavailableErrorV1,
} from '../gpu/renderer-device-resources.js';
import { RendererTileStateV1 } from '../gpu/renderer-tile-state.js';
import { CompatibilityRasterPresenterV1 } from './compatibility-raster-presenter.js';
import type { FoundationShell } from './shell.js';

type RendererOwnerV1 = 'pending' | 'worker' | 'main' | 'compatibility';

type WorkerLikeV1 = {
  postMessage(message: unknown, transfer?: readonly Transferable[]): void;
  addEventListener(type: 'message', listener: (event: MessageEvent<unknown>) => void): void;
  removeEventListener(type: 'message', listener: (event: MessageEvent<unknown>) => void): void;
};

interface RendererWorkerResponseV1 {
  readonly type: 'renderer.response';
  readonly requestId: string;
  readonly ok: boolean;
  readonly result: unknown;
}

interface RendererCanonicalDocumentV1 {
  readonly width: number;
  readonly height: number;
  readonly workingSpace: DocumentColorSpace;
  readonly precision: DocumentPrecision;
  readonly rasterLayers: readonly BaselineRasterLayerDescriptorV1[];
}

export interface RendererControllerSnapshotV1 {
  readonly schema: 'illustro.renderer-controller/1';
  readonly owner: RendererOwnerV1;
  readonly deviceState: RendererDeviceStateV1;
  readonly generation: number;
}

export interface RendererDocumentConfigurationV1 {
  readonly schema: 'illustro.renderer-document-configuration/1';
  readonly owner: Exclude<RendererOwnerV1, 'pending'>;
  readonly width: number;
  readonly height: number;
  readonly workingSpace: DocumentColorSpace;
  readonly precision: DocumentPrecision;
}

const WORKER_RESPONSE_TIMEOUT_MS = 4_000;

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPreviewColorSpaceFailureV1(value: unknown): boolean {
  return isRecord(value) && value.code === 'preview-color-space-unavailable';
}

function tileCoordinateKey(coordinate: TileCoordinateV1): string {
  return `${coordinate.tx}:${coordinate.ty}`;
}

function parseDeviceSnapshot(value: unknown): RendererDeviceSnapshotV1 | null {
  if (
    !isRecord(value) ||
    value.schema !== 'illustro.renderer-device-state/1' ||
    typeof value.state !== 'string' ||
    typeof value.generation !== 'number' ||
    typeof value.reacquireAttempt !== 'number'
  ) {
    return null;
  }
  return value as unknown as RendererDeviceSnapshotV1;
}

function parsePaintSnapshot(value: unknown): BaselinePaintRendererSnapshotV1 | null {
  if (
    !isRecord(value) ||
    value.schema !== 'illustro.baseline-paint-renderer/1' ||
    typeof value.activeDabCount !== 'number' ||
    typeof value.committedStrokeCount !== 'number' ||
    typeof value.committedDabCount !== 'number' ||
    typeof value.surfaceReady !== 'boolean' ||
    typeof value.deviceReady !== 'boolean'
  ) {
    return null;
  }
  return value as unknown as BaselinePaintRendererSnapshotV1;
}

function parsePaintFinalization(value: unknown): BaselinePaintFinalizationV1 | null {
  if (
    !isRecord(value) ||
    value.schema !== 'illustro.baseline-paint-finalization/1' ||
    typeof value.strokeId !== 'string' ||
    typeof value.dabCount !== 'number' ||
    !Array.isArray(value.affectedTiles) ||
    !Array.isArray(value.tilePatches) ||
    parsePaintSnapshot(value.renderer) === null
  ) {
    return null;
  }
  return value as unknown as BaselinePaintFinalizationV1;
}

function parseRasterTileImages(value: unknown): readonly BaselineRasterTileImageV1[] | null {
  if (!Array.isArray(value)) return null;
  const tiles: BaselineRasterTileImageV1[] = [];
  for (const candidate of value) {
    if (
      !isRecord(candidate) ||
      candidate.schema !== 'illustro.baseline-raster-tile/1' ||
      typeof candidate.layerId !== 'string' ||
      candidate.layerId.length === 0 ||
      !isRecord(candidate.coordinate) ||
      !Number.isSafeInteger(candidate.coordinate.tx) ||
      (candidate.coordinate.tx as number) < 0 ||
      !Number.isSafeInteger(candidate.coordinate.ty) ||
      (candidate.coordinate.ty as number) < 0 ||
      !Number.isSafeInteger(candidate.width) ||
      (candidate.width as number) < 1 ||
      !Number.isSafeInteger(candidate.height) ||
      (candidate.height as number) < 1 ||
      (candidate.pixelFormat !== 'rgba8-unorm' && candidate.pixelFormat !== 'rgba16-float') ||
      !(candidate.bytes instanceof Uint8Array)
    ) {
      return null;
    }
    const bytesPerPixel = candidate.pixelFormat === 'rgba8-unorm' ? 4 : 8;
    if (
      candidate.bytes.byteLength !==
      (candidate.width as number) * (candidate.height as number) * bytesPerPixel
    ) {
      return null;
    }
    tiles.push(
      Object.freeze({
        schema: 'illustro.baseline-raster-tile/1' as const,
        layerId: candidate.layerId,
        coordinate: Object.freeze({
          tx: candidate.coordinate.tx as number,
          ty: candidate.coordinate.ty as number,
        }),
        width: candidate.width as number,
        height: candidate.height as number,
        pixelFormat: candidate.pixelFormat,
        bytes: candidate.bytes as Uint8Array<ArrayBuffer>,
      }),
    );
  }
  return Object.freeze(tiles);
}

function parseWorkerResponse(value: unknown, requestId: string): RendererWorkerResponseV1 | null {
  if (
    !isRecord(value) ||
    value.type !== 'renderer.response' ||
    value.requestId !== requestId ||
    typeof value.ok !== 'boolean'
  ) {
    return null;
  }
  return {
    type: 'renderer.response',
    requestId,
    ok: value.ok,
    result: value.result,
  };
}

async function requestWorker(
  worker: WorkerLikeV1,
  message: Readonly<Record<string, unknown>> & { readonly requestId: string },
  transfer: readonly Transferable[] = [],
): Promise<RendererWorkerResponseV1 | null> {
  return new Promise((resolve) => {
    const listener = (event: MessageEvent<unknown>): void => {
      const response = parseWorkerResponse(event.data, message.requestId);
      if (response === null) return;
      cleanup();
      resolve(response);
    };
    const timeout = globalThis.setTimeout(() => {
      cleanup();
      resolve(null);
    }, WORKER_RESPONSE_TIMEOUT_MS);
    const cleanup = (): void => {
      globalThis.clearTimeout(timeout);
      worker.removeEventListener('message', listener);
    };
    worker.addEventListener('message', listener);
    try {
      worker.postMessage(message, transfer);
    } catch {
      cleanup();
      resolve(null);
    }
  });
}

export function selectRendererExecutionPathV1(input: {
  readonly workerDeviceReady: boolean;
  readonly offscreenTransferAvailable: boolean;
  readonly mainDeviceReady?: boolean;
}): 'worker' | 'main' | 'compatibility' {
  if (input.workerDeviceReady && input.offscreenTransferAvailable) return 'worker';
  return input.mainDeviceReady === false ? 'compatibility' : 'main';
}

export function shouldHandoffRendererToCompatibilityV1(
  owner: RendererOwnerV1,
  state: RendererDeviceStateV1,
): boolean {
  return (owner === 'worker' || owner === 'main') && state === 'recovery-required';
}

export class RendererControllerV1 {
  readonly #shell: FoundationShell;
  readonly #worker: WorkerLikeV1;
  readonly #root: HTMLElement;
  readonly #workerStateListener: (event: MessageEvent<unknown>) => void;
  readonly #mainBaselinePaint = new BaselinePaintRendererV1();
  readonly #compatibilityPresenter: CompatibilityRasterPresenterV1;
  readonly #compatibilityActiveTiles = new Map<string, TileCoordinateV1>();
  #owner: RendererOwnerV1 = 'pending';
  #deviceState: RendererDeviceStateV1 = 'idle';
  #generation = 0;
  #mainDeviceManager: RendererDeviceManagerV1 | null = null;
  #mainTileState: RendererTileStateV1 | null = null;
  #removeSizeSubscription: (() => void) | null = null;
  #startTask: Promise<RendererControllerSnapshotV1> | null = null;
  #compatibilityDocument: {
    readonly width: number;
    readonly height: number;
    readonly workingSpace: DocumentColorSpace;
  } | null = null;
  #canonicalDocument: RendererCanonicalDocumentV1 | null = null;
  #backendHandoffTask: Promise<void> | null = null;
  #fallbackReason: string | null = null;
  #disposed = false;

  constructor(
    shell: FoundationShell,
    worker: WorkerLikeV1,
    root: HTMLElement = document.documentElement,
  ) {
    this.#shell = shell;
    this.#worker = worker;
    this.#root = root;
    this.#compatibilityPresenter = new CompatibilityRasterPresenterV1(shell.canvas);
    this.#workerStateListener = (event) => {
      if (this.#owner !== 'worker' || !isRecord(event.data)) return;
      if (event.data.type !== 'renderer.device-state') return;
      const snapshot = parseDeviceSnapshot(event.data.snapshot);
      if (snapshot === null) return;
      this.#applyDeviceSnapshot(snapshot);
      if (shouldHandoffRendererToCompatibilityV1(this.#owner, snapshot.state)) {
        this.#scheduleWorkerCompatibilityHandoff(snapshot);
      }
    };
    worker.addEventListener('message', this.#workerStateListener);
    this.#publish();
  }

  snapshot(): RendererControllerSnapshotV1 {
    return Object.freeze({
      schema: 'illustro.renderer-controller/1',
      owner: this.#owner,
      deviceState: this.#deviceState,
      generation: this.#generation,
    });
  }

  start(): Promise<RendererControllerSnapshotV1> {
    if (this.#disposed) return Promise.resolve(this.snapshot());
    if (this.#deviceState === 'ready') return Promise.resolve(this.snapshot());
    if (this.#startTask !== null) return this.#startTask;
    const task = this.#startInternal();
    this.#startTask = task;
    void task.finally(() => {
      if (this.#startTask === task) this.#startTask = null;
    });
    return task;
  }

  async configureDocument(input: {
    readonly width: number;
    readonly height: number;
    readonly workingSpace: DocumentColorSpace;
    readonly precision: DocumentPrecision;
    readonly rasterLayers: readonly BaselineRasterLayerDescriptorV1[];
  }): Promise<RendererDocumentConfigurationV1> {
    if (this.#disposed) throw new Error('renderer controller is disposed');
    const snapshot = await this.start();
    if (snapshot.deviceState !== 'ready') {
      throw new Error(`renderer is not ready for document configuration: ${snapshot.deviceState}`);
    }

    if (snapshot.owner === 'worker') {
      const requestId = crypto.randomUUID();
      const response = await requestWorker(this.#worker, {
        type: 'renderer.tiles.configure',
        requestId,
        width: input.width,
        height: input.height,
        workingSpace: input.workingSpace,
        precision: input.precision,
        rasterLayers: input.rasterLayers,
      });
      if (response?.ok !== true) {
        if (isPreviewColorSpaceFailureV1(response?.result)) {
          this.#worker.postMessage({ type: 'renderer.dispose' });
          this.#startCompatibilityFallback('worker-preview-color-space-unavailable');
          return this.configureDocument(input);
        }
        throw new Error('Render Worker failed to configure document tile state');
      }
      this.#rememberDocumentConfiguration(input);
      this.#publishDocumentConfiguration(input);
      return Object.freeze({
        schema: 'illustro.renderer-document-configuration/1' as const,
        owner: 'worker' as const,
        width: input.width,
        height: input.height,
        workingSpace: input.workingSpace,
        precision: input.precision,
      });
    }

    if (snapshot.owner !== 'main' && snapshot.owner !== 'compatibility') {
      throw new Error('renderer ownership is unresolved');
    }
    const device = this.#mainDeviceManager?.currentDevice() ?? null;
    if (snapshot.owner === 'main' && device === null) {
      throw new Error('main renderer device is unavailable');
    }
    if (snapshot.owner === 'main' && device !== null) {
      try {
        const canvasFormat = configureRendererSurfaceV1(
          this.#shell.canvas,
          device,
          input.workingSpace,
        );
        this.#mainBaselinePaint.attachSurface(this.#shell.canvas, canvasFormat);
      } catch (error) {
        if (error instanceof RendererPreviewColorSpaceUnavailableErrorV1) {
          this.#startCompatibilityFallback('main-preview-color-space-unavailable');
          return this.configureDocument(input);
        }
        throw error;
      }
    }
    this.#mainTileState?.dispose();
    this.#mainTileState = new RendererTileStateV1(input.width, input.height);
    this.#mainTileState.attachGpuDevice(snapshot.owner === 'main' ? device : null);
    if (snapshot.owner === 'compatibility') {
      this.#mainBaselinePaint.attachDevice(null);
      this.#mainBaselinePaint.attachSurface(null, null);
    }
    this.#mainBaselinePaint.configureDocument(
      this.#mainTileState,
      input.width,
      input.height,
      input.precision,
      input.rasterLayers,
      input.workingSpace,
    );
    this.#rememberDocumentConfiguration(input);
    this.#compatibilityActiveTiles.clear();
    if (snapshot.owner === 'compatibility') {
      this.#compatibilityPresenter.configureDocument(input.width, input.height, input.workingSpace);
      this.#redrawCompatibilityAll();
    }
    this.#publishDocumentConfiguration(input);
    return Object.freeze({
      schema: 'illustro.renderer-document-configuration/1' as const,
      owner: snapshot.owner,
      width: input.width,
      height: input.height,
      workingSpace: input.workingSpace,
      precision: input.precision,
    });
  }

  async presentBaselineStroke(
    strokeId: string,
    dabs: readonly BaselineBrushDabV1[],
    layerId: string,
    operation: BaselineBrushCompositeOperationV1 = 'paint',
  ): Promise<BaselinePaintRendererSnapshotV1> {
    const snapshot = await this.#requirePaintReady();
    if (snapshot.owner === 'worker') {
      const requestId = crypto.randomUUID();
      const response = await requestWorker(this.#worker, {
        type: 'renderer.paint.present',
        requestId,
        strokeId,
        dabs,
        layerId,
        operation,
      });
      const paint = response?.ok === true ? parsePaintSnapshot(response.result) : null;
      if (paint === null) throw new Error('Render Worker failed to present baseline stroke');
      return paint;
    }
    const paint = this.#mainBaselinePaint.presentStroke(strokeId, dabs, layerId, operation);
    if (snapshot.owner === 'compatibility') {
      this.#trackCompatibilityDabs(dabs);
      if (operation !== 'paint') {
        const documentValue = this.#canonicalDocument;
        if (documentValue !== null) {
          this.#syncCompatibilityTiles(
            planBaselineBrushTilesV1(dabs, documentValue.width, documentValue.height).map(
              (plan) => plan.coordinate,
            ),
          );
        }
      } else {
        this.#compatibilityPresenter.presentDabs(dabs);
      }
    }
    return paint;
  }

  async cancelBaselineStroke(strokeId: string): Promise<BaselinePaintRendererSnapshotV1> {
    const snapshot = await this.#requirePaintReady();
    if (snapshot.owner === 'worker') {
      const requestId = crypto.randomUUID();
      const response = await requestWorker(this.#worker, {
        type: 'renderer.paint.cancel',
        requestId,
        strokeId,
      });
      const paint = response?.ok === true ? parsePaintSnapshot(response.result) : null;
      if (paint === null) throw new Error('Render Worker failed to cancel baseline stroke');
      return paint;
    }
    const affected = Object.freeze([...this.#compatibilityActiveTiles.values()]);
    const paint = this.#mainBaselinePaint.cancelStroke(strokeId);
    this.#compatibilityActiveTiles.clear();
    if (snapshot.owner === 'compatibility') this.#syncCompatibilityTiles(affected);
    return paint;
  }

  async finalizeBaselineStroke(
    strokeId: string,
    dabs: readonly BaselineBrushDabV1[],
    layerId: string,
    operation: BaselineBrushCompositeOperationV1 = 'paint',
  ): Promise<BaselinePaintFinalizationV1> {
    const snapshot = await this.#requirePaintReady();
    if (snapshot.owner === 'worker') {
      const requestId = crypto.randomUUID();
      const response = await requestWorker(this.#worker, {
        type: 'renderer.paint.finalize',
        requestId,
        strokeId,
        dabs,
        layerId,
        operation,
      });
      const finalization = response?.ok === true ? parsePaintFinalization(response.result) : null;
      if (finalization === null) {
        throw new Error('Render Worker failed to finalize baseline stroke');
      }
      return finalization;
    }
    const finalization = this.#mainBaselinePaint.finalizeStroke(strokeId, dabs, layerId, operation);
    this.#compatibilityActiveTiles.clear();
    if (snapshot.owner === 'compatibility') {
      this.#syncCompatibilityTiles(finalization.affectedTiles.map((entry) => entry.coordinate));
    }
    return finalization;
  }

  async restoreBaselineStrokes(
    strokes: readonly BaselinePaintCommittedStrokeV1[],
  ): Promise<BaselinePaintRendererSnapshotV1> {
    const snapshot = await this.#requirePaintReady();
    if (snapshot.owner === 'worker') {
      const requestId = crypto.randomUUID();
      const response = await requestWorker(this.#worker, {
        type: 'renderer.paint.restore',
        requestId,
        strokes,
      });
      const paint = response?.ok === true ? parsePaintSnapshot(response.result) : null;
      if (paint === null) throw new Error('Render Worker failed to restore baseline strokes');
      return paint;
    }
    const paint = this.#mainBaselinePaint.restoreCommittedStrokes(strokes);
    this.#compatibilityActiveTiles.clear();
    if (snapshot.owner === 'compatibility') this.#redrawCompatibilityAll();
    return paint;
  }

  async restoreBaselineCanonicalTiles(
    tiles: readonly BaselineRasterTileImageV1[],
    rasterLayers: readonly BaselineRasterLayerDescriptorV1[],
  ): Promise<BaselinePaintRendererSnapshotV1> {
    const snapshot = await this.#requirePaintReady();
    if (snapshot.owner === 'worker') {
      const requestId = crypto.randomUUID();
      const transfer = tiles.map((tile) => tile.bytes.buffer);
      const response = await requestWorker(
        this.#worker,
        {
          type: 'renderer.paint.restoreTiles',
          requestId,
          tiles,
          rasterLayers,
        },
        transfer,
      );
      const paint = response?.ok === true ? parsePaintSnapshot(response.result) : null;
      if (paint === null) throw new Error('Render Worker failed to restore canonical raster tiles');
      return paint;
    }
    const paint = this.#mainBaselinePaint.restoreCanonicalTiles(tiles, rasterLayers);
    this.#compatibilityActiveTiles.clear();
    if (snapshot.owner === 'compatibility') this.#redrawCompatibilityAll();
    return paint;
  }

  async exportBaselineCanonicalTiles(): Promise<readonly BaselineRasterTileImageV1[]> {
    const snapshot = await this.#requirePaintReady();
    if (snapshot.owner === 'worker') {
      const requestId = crypto.randomUUID();
      const response = await requestWorker(this.#worker, {
        type: 'renderer.paint.exportTiles',
        requestId,
        composite: false,
      });
      const tiles = response?.ok === true ? parseRasterTileImages(response.result) : null;
      if (tiles === null) throw new Error('Render Worker failed to export canonical raster tiles');
      return tiles;
    }
    return this.#mainBaselinePaint.exportCanonicalTiles();
  }

  async exportBaselineCompositeTiles(): Promise<readonly BaselineRasterTileImageV1[]> {
    const snapshot = await this.#requirePaintReady();
    if (snapshot.owner === 'worker') {
      const requestId = crypto.randomUUID();
      const response = await requestWorker(this.#worker, {
        type: 'renderer.paint.exportTiles',
        requestId,
        composite: true,
        includeDraft: false,
      });
      const tiles = response?.ok === true ? parseRasterTileImages(response.result) : null;
      if (tiles === null) throw new Error('Render Worker failed to export composite raster tiles');
      return tiles;
    }
    return this.#mainBaselinePaint.exportCompositeTiles({ includeDraft: false });
  }

  async applyBaselineTilePatches(
    patches: readonly BaselineRasterTilePatchV1[],
    direction: BaselineRasterTilePatchDirectionV1,
  ): Promise<BaselinePaintRendererSnapshotV1> {
    const snapshot = await this.#requirePaintReady();
    if (snapshot.owner === 'worker') {
      const requestId = crypto.randomUUID();
      const response = await requestWorker(this.#worker, {
        type: 'renderer.paint.applyPatches',
        requestId,
        patches,
        direction,
      });
      const paint = response?.ok === true ? parsePaintSnapshot(response.result) : null;
      if (paint === null) throw new Error('Render Worker failed to apply raster tile patches');
      return paint;
    }
    const paint = this.#mainBaselinePaint.applyTilePatches(patches, direction);
    this.#compatibilityActiveTiles.clear();
    if (snapshot.owner === 'compatibility') {
      this.#syncCompatibilityTiles(patches.map((patch) => patch.coordinate));
    }
    return paint;
  }

  async retry(): Promise<RendererControllerSnapshotV1> {
    if (this.#disposed) return this.snapshot();
    if (this.#owner === 'worker') {
      const requestId = crypto.randomUUID();
      const response = await requestWorker(this.#worker, { type: 'renderer.retry', requestId });
      const snapshot = response === null ? null : parseDeviceSnapshot(response.result);
      if (snapshot !== null) {
        this.#applyDeviceSnapshot(snapshot);
        if (shouldHandoffRendererToCompatibilityV1(this.#owner, snapshot.state)) {
          this.#scheduleWorkerCompatibilityHandoff(snapshot);
        }
      }
      return this.snapshot();
    }
    return this.#startMainFallback();
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#removeSizeSubscription?.();
    this.#removeSizeSubscription = null;
    this.#compatibilityPresenter.dispose();
    this.#compatibilityActiveTiles.clear();
    this.#mainBaselinePaint.dispose();
    this.#mainTileState?.dispose();
    this.#mainTileState = null;
    this.#mainDeviceManager?.dispose();
    this.#mainDeviceManager = null;
    this.#canonicalDocument = null;
    this.#compatibilityDocument = null;
    this.#worker.removeEventListener('message', this.#workerStateListener);
    this.#worker.postMessage({ type: 'renderer.dispose' });
    this.#deviceState = 'disposed';
    this.#publish();
  }

  async #requirePaintReady(): Promise<RendererControllerSnapshotV1> {
    if (this.#disposed) throw new Error('renderer controller is disposed');
    const snapshot = await this.start();
    if (snapshot.deviceState !== 'ready' || snapshot.owner === 'pending') {
      throw new Error(`renderer is not ready for paint presentation: ${snapshot.deviceState}`);
    }
    return snapshot;
  }

  async #startInternal(): Promise<RendererControllerSnapshotV1> {
    this.#owner = 'pending';
    this.#deviceState = 'acquiring';
    this.#fallbackReason = null;
    this.#publish();

    const probeRequestId = crypto.randomUUID();
    const probe = await requestWorker(this.#worker, {
      type: 'renderer.probe',
      requestId: probeRequestId,
    });
    const workerSnapshot = probe === null ? null : parseDeviceSnapshot(probe.result);
    const workerReady = probe?.ok === true && workerSnapshot?.state === 'ready';
    const executionPath = selectRendererExecutionPathV1({
      workerDeviceReady: workerReady,
      offscreenTransferAvailable:
        typeof this.#shell.canvas.transferControlToOffscreen === 'function',
    });

    if (executionPath === 'worker') {
      const offscreen = this.#shell.transferRenderSurface();
      if (offscreen !== null) {
        const size = this.#shell.currentRenderSurfaceSize();
        const attachRequestId = crypto.randomUUID();
        const attached = await requestWorker(
          this.#worker,
          {
            type: 'renderer.attach',
            requestId: attachRequestId,
            canvas: offscreen,
            width: size.width,
            height: size.height,
          },
          [offscreen],
        );
        const attachedSnapshot = attached === null ? null : parseDeviceSnapshot(attached.result);
        if (attached?.ok === true && attachedSnapshot?.state === 'ready') {
          this.#owner = 'worker';
          this.#applyDeviceSnapshot(attachedSnapshot);
          this.#removeSizeSubscription?.();
          this.#removeSizeSubscription = this.#shell.subscribeRenderSurfaceSize((next) => {
            this.#worker.postMessage({
              type: 'renderer.resize',
              width: next.width,
              height: next.height,
            });
          });
          return this.snapshot();
        }
        this.#worker.postMessage({ type: 'renderer.dispose' });
        return this.#startCompatibilityFallback('worker-attach-failed-after-offscreen-transfer');
      }
    }

    this.#worker.postMessage({ type: 'renderer.dispose' });
    return this.#startMainFallback();
  }

  async #startMainFallback(): Promise<RendererControllerSnapshotV1> {
    this.#owner = 'main';
    this.#deviceState = 'acquiring';
    this.#publish();
    this.#mainDeviceManager ??= new RendererDeviceManagerV1({
      acquire: acquireCoreWebGpuV1,
      rebuild: (device, generation) => {
        const resources = rebuildRendererDeviceResourcesV1(
          device,
          generation,
          this.#shell.canvas,
          this.#canonicalDocument?.workingSpace ?? 'srgb',
        );
        this.#mainTileState?.attachGpuDevice(device);
        this.#mainBaselinePaint.attachDevice(device);
        if (resources.canvasFormat === null) {
          throw new Error('main renderer surface format is unavailable after configuration');
        }
        this.#mainBaselinePaint.attachSurface(this.#shell.canvas, resources.canvasFormat);
      },
      onState: (snapshot) => {
        this.#applyDeviceSnapshot(snapshot);
        if (shouldHandoffRendererToCompatibilityV1(this.#owner, snapshot.state)) {
          this.#root.dataset.illustroRendererCanonicalHandoff = 'main-to-compatibility';
          this.#root.dataset.illustroRendererCanonicalHandoffError = '';
          this.#startCompatibilityFallback(
            `main-webgpu-${snapshot.lastAcquireStatus ?? snapshot.state}`,
          );
        }
      },
      onDiscardProvisional: () => {
        this.#mainTileState?.attachGpuDevice(null);
        this.#mainBaselinePaint.attachDevice(null);
        this.#root.dataset.illustroRendererProvisional = 'discarded';
      },
    });
    const snapshot = await this.#mainDeviceManager.start();
    this.#applyDeviceSnapshot(snapshot);
    if (snapshot.state === 'ready') {
      this.#leaveCompatibilityPresentation();
      this.#fallbackReason = null;
      this.#publish();
      return this.snapshot();
    }
    return this.#startCompatibilityFallback(
      `main-webgpu-${snapshot.lastAcquireStatus ?? snapshot.state}`,
    );
  }

  #startCompatibilityFallback(reason: string): RendererControllerSnapshotV1 {
    this.#removeSizeSubscription?.();
    this.#removeSizeSubscription = null;
    this.#owner = 'compatibility';
    this.#fallbackReason = reason;
    this.#mainTileState?.attachGpuDevice(null);
    this.#mainBaselinePaint.attachDevice(null);
    this.#mainBaselinePaint.attachSurface(null, null);
    if (!this.#compatibilityPresenter.attach()) {
      this.#deviceState = 'unavailable';
      this.#fallbackReason = 'canvas2d-unavailable';
      this.#publish();
      return this.snapshot();
    }
    this.#compatibilityPresenter.resize(this.#shell.currentRenderSurfaceSize());
    if (this.#compatibilityDocument !== null) {
      this.#compatibilityPresenter.configureDocument(
        this.#compatibilityDocument.width,
        this.#compatibilityDocument.height,
        this.#compatibilityDocument.workingSpace,
      );
      this.#redrawCompatibilityAll();
    }
    this.#removeSizeSubscription = this.#shell.subscribeRenderSurfaceSize((next) => {
      this.#compatibilityPresenter.resize(next);
      this.#redrawCompatibilityAll();
    });
    this.#deviceState = 'ready';
    this.#publish();
    return this.snapshot();
  }

  #leaveCompatibilityPresentation(): void {
    this.#removeSizeSubscription?.();
    this.#removeSizeSubscription = null;
    this.#compatibilityPresenter.detach();
    this.#compatibilityActiveTiles.clear();
  }

  #rememberDocumentConfiguration(input: {
    readonly width: number;
    readonly height: number;
    readonly workingSpace: DocumentColorSpace;
    readonly precision: DocumentPrecision;
    readonly rasterLayers: readonly BaselineRasterLayerDescriptorV1[];
  }): void {
    this.#canonicalDocument = Object.freeze({
      width: input.width,
      height: input.height,
      workingSpace: input.workingSpace,
      precision: input.precision,
      rasterLayers: Object.freeze(
        input.rasterLayers.map((layer) =>
          Object.freeze({
            layerId: layer.layerId,
            visible: layer.visible,
            opacity: layer.opacity,
            draft: layer.draft ?? false,
            ...(layer.blendMode === undefined ? {} : { blendMode: layer.blendMode }),
            ...(layer.clippingBaseLayerId === undefined
              ? {}
              : { clippingBaseLayerId: layer.clippingBaseLayerId }),
            ...((layer.masks?.length ?? 0) === 0
              ? {}
              : {
                  masks: Object.freeze(
                    (layer.masks ?? []).map((mask) =>
                      Object.freeze({
                        ...mask,
                        effects: Object.freeze(
                          mask.effects.map((effect) => Object.freeze({ ...effect })),
                        ),
                        tiles: Object.freeze(
                          mask.tiles.map((tile) =>
                            Object.freeze({
                              ...tile,
                              coordinate: Object.freeze({ ...tile.coordinate }),
                              bytes: new Uint8Array(tile.bytes),
                            }),
                          ),
                        ),
                        ...(mask.documentToMask === undefined
                          ? {}
                          : {
                              documentToMask: Object.freeze([
                                ...mask.documentToMask,
                              ]) as BaselineAffineMatrixV1,
                            }),
                      }),
                    ),
                  ),
                }),
          }),
        ),
      ),
    });
    this.#compatibilityDocument = Object.freeze({
      width: input.width,
      height: input.height,
      workingSpace: input.workingSpace,
    });
  }

  #scheduleWorkerCompatibilityHandoff(snapshot: RendererDeviceSnapshotV1): void {
    if (this.#disposed || this.#owner !== 'worker' || this.#backendHandoffTask !== null) return;
    const task = this.#handoffWorkerCanonicalTilesToCompatibility(snapshot);
    this.#backendHandoffTask = task;
    void task
      .catch((error: unknown) => {
        if (this.#disposed || this.#owner !== 'worker') return;
        this.#fallbackReason = 'worker-canonical-handoff-failed';
        this.#root.dataset.illustroRendererCanonicalHandoff = 'failed';
        this.#root.dataset.illustroRendererCanonicalHandoffError =
          error instanceof Error ? error.message : String(error);
        this.#deviceState = 'recovery-required';
        this.#publish();
      })
      .finally(() => {
        if (this.#backendHandoffTask === task) this.#backendHandoffTask = null;
      });
  }

  async #handoffWorkerCanonicalTilesToCompatibility(
    snapshot: RendererDeviceSnapshotV1,
  ): Promise<void> {
    if (this.#owner !== 'worker') return;
    const documentValue = this.#canonicalDocument;
    if (documentValue === null) {
      this.#worker.postMessage({ type: 'renderer.dispose' });
      this.#root.dataset.illustroRendererCanonicalHandoff = 'worker-to-compatibility-empty';
      this.#root.dataset.illustroRendererCanonicalHandoffError = '';
      this.#startCompatibilityFallback(
        `worker-webgpu-${snapshot.lastAcquireStatus ?? snapshot.state}`,
      );
      return;
    }

    const requestId = crypto.randomUUID();
    const response = await requestWorker(this.#worker, {
      type: 'renderer.paint.exportTiles',
      requestId,
      composite: false,
    });
    const tiles = response?.ok === true ? parseRasterTileImages(response.result) : null;
    if (tiles === null) {
      throw new Error('Render Worker failed to export canonical raster tiles for fallback');
    }

    this.#mainTileState?.dispose();
    this.#mainTileState = new RendererTileStateV1(documentValue.width, documentValue.height);
    this.#mainTileState.attachGpuDevice(null);
    this.#mainBaselinePaint.attachDevice(null);
    this.#mainBaselinePaint.attachSurface(null, null);
    this.#mainBaselinePaint.configureDocument(
      this.#mainTileState,
      documentValue.width,
      documentValue.height,
      documentValue.precision,
      documentValue.rasterLayers,
      documentValue.workingSpace,
    );
    this.#mainBaselinePaint.restoreCanonicalTiles(tiles, documentValue.rasterLayers);
    this.#compatibilityDocument = Object.freeze({
      width: documentValue.width,
      height: documentValue.height,
      workingSpace: documentValue.workingSpace,
    });
    this.#compatibilityActiveTiles.clear();
    this.#worker.postMessage({ type: 'renderer.dispose' });
    this.#root.dataset.illustroRendererCanonicalHandoff = 'worker-to-compatibility';
    this.#root.dataset.illustroRendererCanonicalHandoffError = '';
    this.#startCompatibilityFallback(
      `worker-webgpu-${snapshot.lastAcquireStatus ?? snapshot.state}`,
    );
  }

  #trackCompatibilityDabs(dabs: readonly BaselineBrushDabV1[]): void {
    const documentValue = this.#compatibilityDocument;
    if (documentValue === null) return;
    for (const plan of planBaselineBrushTilesV1(dabs, documentValue.width, documentValue.height)) {
      this.#compatibilityActiveTiles.set(tileCoordinateKey(plan.coordinate), plan.coordinate);
    }
  }

  #syncCompatibilityTiles(coordinates: readonly TileCoordinateV1[]): void {
    if (this.#owner !== 'compatibility' || coordinates.length === 0) return;
    const selected = new Set(coordinates.map(tileCoordinateKey));
    this.#compatibilityPresenter.clearTiles(coordinates);
    const tiles = this.#mainBaselinePaint
      .exportCompositeTiles()
      .filter((tile) => selected.has(tileCoordinateKey(tile.coordinate)));
    this.#compatibilityPresenter.patchTiles(tiles);
  }

  #redrawCompatibilityAll(): void {
    if (this.#owner !== 'compatibility' || this.#compatibilityDocument === null) return;
    try {
      this.#compatibilityPresenter.presentAll(this.#mainBaselinePaint.exportCompositeTiles());
    } catch {
      this.#compatibilityPresenter.clear();
    }
  }

  #applyDeviceSnapshot(snapshot: RendererDeviceSnapshotV1): void {
    this.#deviceState = snapshot.state;
    this.#generation = snapshot.generation;
    this.#publish();
  }

  #publishDocumentConfiguration(input: {
    readonly width: number;
    readonly height: number;
    readonly workingSpace: DocumentColorSpace;
    readonly precision: DocumentPrecision;
  }): void {
    this.#root.dataset.illustroRendererDocument = 'configured';
    this.#root.dataset.illustroRendererDocumentWidth = String(input.width);
    this.#root.dataset.illustroRendererDocumentHeight = String(input.height);
    this.#root.dataset.illustroRendererWorkingSpace = input.workingSpace;
    this.#root.dataset.illustroRendererPrecision = input.precision;
    const outputSpace =
      this.#owner === 'compatibility'
        ? this.#compatibilityPresenter.outputColorSpace()
        : input.workingSpace;
    this.#root.dataset.illustroRendererPreviewColorSpace = outputSpace;
    this.#root.dataset.illustroRendererPreviewConversion =
      outputSpace === input.workingSpace ? 'none' : `${input.workingSpace}-to-${outputSpace}`;
  }

  #publish(): void {
    this.#root.dataset.illustroRendererOwner = this.#owner;
    this.#root.dataset.illustroRendererBackend =
      this.#owner === 'compatibility' ? 'canvas2d' : this.#owner;
    this.#root.dataset.illustroRendererFallbackReason = this.#fallbackReason ?? '';
    this.#root.dataset.illustroRendererState = this.#deviceState;
    this.#root.dataset.illustroRendererGeneration = String(this.#generation);
    this.#root.dataset.illustroRendererMutationGate =
      this.#deviceState === 'ready' ? 'open' : 'blocked';
  }
}

export function startRendererController(
  shell: FoundationShell,
  worker: Worker,
  root: HTMLElement = document.documentElement,
): RendererControllerV1 {
  return new RendererControllerV1(shell, worker, root);
}
