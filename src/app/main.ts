import { buildIdentity } from '../generated/build-info.js';
import { inspectWebGpuBuildPath } from '../gpu/webgpu-bootstrap.js';
import { PointerHoverTrackerV1 } from '../input/hover-state.js';
import { createPointerInputArbitrationV1 } from '../input/input-arbitration.js';
import { createPointerInputTransportV1 } from '../input/input-transport.js';
import { downloadPngBlobV1, encodePaintSnapshotToPngV1 } from '../export/png-export.js';
import { createLogger } from '../shared/logger.js';
import {
  incrementPerformanceCounter,
  markPerformance,
  measurePerformance,
  startPerformanceInstrumentation,
} from '../shared/performance.js';
import { getRuntimeConfig } from '../shared/runtime-config.js';
import { collectRuntimeCapabilities } from './capabilities.js';
import { getCanvasAdmissionControllerV1 } from './canvas-admission-controller.js';
import { installDiagnosticsHook } from './diagnostics.js';
import { PaintHistoryControllerV1 } from './paint-history-controller.js';
import { PaintPersistenceControllerV1 } from './paint-persistence-controller.js';
import { PaintSessionControllerV1 } from './paint-session-controller.js';
import { installPointerInputControllerV1 } from './pointer-input-controller.js';
import { startRendererController } from './renderer-controller.js';
import {
  createRuntimeCapabilityProfile,
  probeArrayBufferTransferSupport,
  type CapabilityProbeStateV1,
} from './runtime-profile.js';
import { installFoundationShell } from './shell.js';
import { startDedicatedWorkers } from './workers.js';

const logger = createLogger('app.bootstrap');
const stopPerformanceInstrumentation = startPerformanceInstrumentation();
markPerformance('illustro.bootstrap.start');

const root = document.documentElement;
const runtime = getRuntimeConfig();
const capabilities = collectRuntimeCapabilities();
const shell = installFoundationShell();
const workers = startDedicatedWorkers();
const canvasAdmission = getCanvasAdmissionControllerV1();
const renderer = startRendererController(shell, workers.render, root);
const paintSession = new PaintSessionControllerV1(renderer);
const paintHistory = new PaintHistoryControllerV1(paintSession);
const paintPersistence = new PaintPersistenceControllerV1(
  workers.storage,
  paintSession,
  paintHistory,
  {
    resumeStore: globalThis.localStorage,
    onState(snapshot) {
      root.dataset.illustroPersistence = snapshot.status;
      root.dataset.illustroProjectId = snapshot.projectId ?? '';
      root.dataset.illustroProjectSequence = String(snapshot.sequence);
      root.dataset.illustroRecoveryGeneration = String(snapshot.recoveryGeneration);
      root.dataset.illustroPersistenceError = snapshot.lastError ?? '';
    },
  },
);
let paintRenderTask: Promise<void> = Promise.resolve();

function enqueuePaintRender(operation: () => Promise<unknown>): void {
  paintRenderTask = paintRenderTask
    .then(async () => {
      await operation();
    })
    .catch((error: unknown) => {
      root.dataset.illustroPaintVisible = 'error';
      incrementPerformanceCounter('renderer.paint.failure');
      logger.error('renderer.paint-failed', error);
    });
}

function publishPaintHistory(): void {
  const history = paintHistory.snapshot();
  root.dataset.illustroHistoryLength = String(history.length);
  root.dataset.illustroHistoryCursor = String(history.cursor);
  root.dataset.illustroHistoryUndo = history.canUndo ? 'enabled' : 'disabled';
  root.dataset.illustroHistoryRedo = history.canRedo ? 'enabled' : 'disabled';
}

const pointerTransport = createPointerInputTransportV1(workers.render, {
  sharedMemoryFastPath:
    capabilities.crossOriginIsolated && capabilities.sharedArrayBuffer && capabilities.atomics,
});
const pointerArbitration = createPointerInputArbitrationV1();
const pointerHover = new PointerHoverTrackerV1();
const pointerInput = installPointerInputControllerV1(shell.canvas, (batch) => {
  const latest = batch.confirmed.at(-1);
  const hover = pointerHover.ingest(batch);
  const arbitration = pointerArbitration.route(batch);
  root.dataset.illustroPointerEvent = batch.eventType;
  root.dataset.illustroPointerSource = latest?.source ?? 'unknown';
  root.dataset.illustroPointerConfirmedSamples = String(batch.confirmed.length);
  root.dataset.illustroPointerPredictedSamples = String(batch.predicted.length);
  root.dataset.illustroPointerDisposition = arbitration.disposition;
  root.dataset.illustroPointerArbitrationReason = arbitration.reason;
  root.dataset.illustroPointerHover = hover.active ? 'active' : 'inactive';
  root.dataset.illustroPointerHoverSource = hover.source ?? 'none';
  root.dataset.illustroPointerHoverX = hover.surfaceX === null ? '' : String(hover.surfaceX);
  root.dataset.illustroPointerHoverY = hover.surfaceY === null ? '' : String(hover.surfaceY);
  incrementPerformanceCounter('input.pointer.batch');
  if (arbitration.disposition === 'rejected-palm') {
    incrementPerformanceCounter('input.pointer.palm-rejected');
  }
  if (arbitration.forwardBatch !== null) {
    const previousStrokeId = paintSession.activeStroke()?.strokeId ?? null;
    const paint = paintSession.ingestPointerBatch(arbitration.forwardBatch);
    const activeStroke = paintSession.activeStroke();
    root.dataset.illustroPaintStroke =
      paint.activeStrokeId !== null
        ? 'active'
        : paint.pendingCompletedStrokeCount > 0
          ? 'pending-commit'
          : 'idle';
    root.dataset.illustroPaintStrokeSamples = String(paint.activeStrokeSampleCount);
    root.dataset.illustroPaintDabs = String(paint.activeDabCount);

    if (activeStroke !== null) {
      const dabs = paintSession.activeDabs();
      root.dataset.illustroPaintVisible = 'provisional';
      enqueuePaintRender(() => renderer.presentBaselineStroke(activeStroke.strokeId, dabs));
    } else if (
      arbitration.forwardBatch.eventType === 'pointercancel' &&
      previousStrokeId !== null
    ) {
      root.dataset.illustroPaintVisible = 'cancelled';
      enqueuePaintRender(() => renderer.cancelBaselineStroke(previousStrokeId));
    } else if (arbitration.forwardBatch.eventType === 'pointerup' && previousStrokeId !== null) {
      const completed = paintSession.latestCompletedPaintStroke();
      if (completed?.stroke.strokeId === previousStrokeId) {
        const strokeId = completed.stroke.strokeId;
        const dabs = completed.dabs;
        root.dataset.illustroPaintVisible = 'finalizing';
        enqueuePaintRender(async () => {
          const finalization = await renderer.finalizeBaselineStroke(strokeId, dabs);
          const transaction = paintHistory.commitCompletedStroke(strokeId);
          await paintPersistence.markDirty(transaction.transactionId);
          root.dataset.illustroHistoryTransaction = transaction.transactionId;
          publishPaintHistory();
          root.dataset.illustroPaintVisible = 'committed';
          root.dataset.illustroPaintDabs = String(finalization.dabCount);
          root.dataset.illustroPaintDirtyTiles = String(finalization.affectedTiles.length);
          incrementPerformanceCounter('renderer.paint.stroke-finalized');
        });
      }
    }

    pointerTransport.enqueueBatch(arbitration.forwardBatch);
  }
});
root.dataset.illustroPointerInput = 'ready';
root.dataset.illustroPointerTransport = pointerTransport.snapshot().mode;
root.dataset.illustroPointerFingerDrawing = pointerArbitration.snapshot().fingerDrawingEnabled
  ? 'enabled'
  : 'disabled';
root.dataset.illustroCanvasAdmission = canvasAdmission.schema;
root.dataset.illustroPaintSession = 'pending-document';
root.dataset.illustroPaintVisible = 'idle';
root.dataset.illustroPaintDabs = '0';
root.dataset.illustroPaintDirtyTiles = '0';
publishPaintHistory();

const onPaintHistoryKeyDown = (event: KeyboardEvent): void => {
  if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
  const target = event.target;
  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  )
    return;
  const key = event.key.toLowerCase();
  const redo = (key === 'z' && event.shiftKey) || key === 'y';
  const undo = key === 'z' && !event.shiftKey;
  if (!undo && !redo) return;
  event.preventDefault();
  enqueuePaintRender(async () => {
    const changed = redo ? await paintHistory.redo() : await paintHistory.undo();
    if (!changed) return;
    await paintPersistence.markDirty();
    root.dataset.illustroPaintVisible = 'committed';
    publishPaintHistory();
    incrementPerformanceCounter(redo ? 'history.paint.redo' : 'history.paint.undo');
  });
};
window.addEventListener('keydown', onPaintHistoryKeyDown);

const exportPngButton = document.querySelector<HTMLButtonElement>('#export-png');
const onExportPngClick = (): void => {
  if (exportPngButton === null || exportPngButton.disabled) return;
  exportPngButton.disabled = true;
  root.dataset.illustroPngExport = 'exporting';
  enqueuePaintRender(async () => {
    try {
      await paintPersistence.flushCheckpoint();
      const snapshot = paintSession.projectSnapshot();
      if (snapshot === null) throw new Error('PNG export requires an active document');
      const blob = await encodePaintSnapshotToPngV1(snapshot);
      downloadPngBlobV1(blob, 'Illustro.png');
      root.dataset.illustroPngExport = 'complete';
      incrementPerformanceCounter('export.png.complete');
    } catch (error) {
      root.dataset.illustroPngExport = 'error';
      incrementPerformanceCounter('export.png.failure');
      logger.error('export.png-failed', error);
    } finally {
      exportPngButton.disabled = false;
    }
  });
};
exportPngButton?.addEventListener('click', onExportPngClick);
root.dataset.illustroPngExport = exportPngButton === null ? 'unavailable' : 'ready';

const buildIdentityOutput = document.querySelector<HTMLOutputElement>('#build-identity');
if (buildIdentityOutput) {
  buildIdentityOutput.value = `Build ${buildIdentity.buildSha.slice(0, 8)}`;
  buildIdentityOutput.title = buildIdentity.buildSha;
}
root.dataset.illustroRuntime = 'bootstrapped';
root.dataset.illustroBuildMode = runtime.buildMode;
root.dataset.illustroBuildSha = buildIdentity.buildSha;
root.dataset.illustroCapabilityProfile = 'pending';
root.dataset.illustroSecureContext = globalThis.isSecureContext ? 'secure' : 'insecure';
root.dataset.illustroCrossOriginIsolated = globalThis.crossOriginIsolated
  ? 'isolated'
  : 'not-isolated';
installDiagnosticsHook();
logger.info('runtime.bootstrap', { build: buildIdentity, runtime, capabilities });

void renderer
  .start()
  .then(async (snapshot) => {
    logger.info('renderer.runtime-ready', { snapshot });
    if (snapshot.deviceState !== 'ready') return;
    const surfaceSize = shell.currentRenderSurfaceSize();
    const persistence = await paintPersistence.initialize({
      name: 'Untitled',
      document: {
        width: Math.max(1, Math.round(surfaceSize.width / surfaceSize.pixelRatio)),
        height: Math.max(1, Math.round(surfaceSize.height / surfaceSize.pixelRatio)),
      },
    });
    const document = paintSession.currentDocument();
    if (document === null) throw new Error('paint persistence initialized without a document');
    root.dataset.illustroPaintRecovery = persistence.mode;
    root.dataset.illustroPaintSession = 'ready';
    root.dataset.illustroDocumentId = document.documentId;
    root.dataset.illustroDocumentWidth = String(document.canvas.width);
    root.dataset.illustroDocumentHeight = String(document.canvas.height);
    root.dataset.illustroActiveLayerId = String(document.layerTree.rootLayerIds[0] ?? '');
    root.dataset.illustroPaintStroke = 'idle';
    root.dataset.illustroPaintStrokeSamples = '0';
    if (exportPngButton !== null) exportPngButton.disabled = false;
    publishPaintHistory();
    logger.info('paint-session.document-ready', {
      documentId: document.documentId,
      activeLayerId: document.layerTree.rootLayerIds[0] ?? null,
      width: document.canvas.width,
      height: document.canvas.height,
    });
  })
  .catch((error: unknown) => {
    root.dataset.illustroPaintSession = 'error';
    incrementPerformanceCounter('renderer.runtime.failure');
    logger.error('renderer.runtime-failed', error);
  });

const onPaintVisibilityChange = (): void => {
  if (document.visibilityState !== 'hidden') return;
  void paintRenderTask
    .then(() => paintPersistence.flushRecovery())
    .catch((error: unknown) => logger.error('paint-persistence.lifecycle-flush-failed', error));
};
document.addEventListener('visibilitychange', onPaintVisibilityChange);

globalThis.addEventListener(
  'pagehide',
  () => {
    window.removeEventListener('keydown', onPaintHistoryKeyDown);
    exportPngButton?.removeEventListener('click', onExportPngClick);
    document.removeEventListener('visibilitychange', onPaintVisibilityChange);
    pointerInput.dispose();
    pointerTransport.dispose();
    pointerHover.clear();
    root.dataset.illustroPointerInput = 'disposed';
    root.dataset.illustroPaintSession = 'closing';
    stopPerformanceInstrumentation();
    void paintRenderTask
      .then(() => paintPersistence.close())
      .catch((error: unknown) => logger.error('paint-persistence.close-failed', error))
      .finally(() => {
        paintSession.dispose();
        paintPersistence.dispose();
        renderer.dispose();
        shell.dispose();
        workers.dispose();
        root.dataset.illustroPaintSession = 'disposed';
      });
  },
  { once: true },
);

if ('serviceWorker' in navigator) {
  const localDevelopmentHost =
    location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  if (globalThis.isSecureContext || localDevelopmentHost) {
    void navigator.serviceWorker
      .register(runtime.serviceWorkerUrl, { scope: './', updateViaCache: 'none' })
      .then(() => {
        root.dataset.illustroServiceWorker = 'registered';
        logger.info('service-worker.registered');
      })
      .catch((error: unknown) => {
        root.dataset.illustroServiceWorker = 'error';
        incrementPerformanceCounter('service-worker.registration.failure');
        logger.error('service-worker.registration-failed', error);
      });
  } else {
    root.dataset.illustroServiceWorker = 'insecure-context';
    logger.warn('service-worker.insecure-context');
  }
}

function publishCapabilityProfile(coreWebGpuDeviceReady: CapabilityProbeStateV1): void {
  const profile = createRuntimeCapabilityProfile(capabilities, {
    coreWebGpuDeviceReady,
    transferableArrayBuffer: probeArrayBufferTransferSupport(),
    storageWriteViable: 'pending',
    viewportWidthCssPx: window.innerWidth,
  });
  root.dataset.illustroCapabilityProfile = profile.fullEditorEligibility;
  root.dataset.illustroCapabilityBlockingReasons = profile.blockingReasonCodes.join(',');
  root.dataset.illustroCapabilityPendingReasons = profile.pendingReasonCodes.join(',');
  logger.info('runtime.capability-profile', { profile });
}

publishCapabilityProfile('pending');

void inspectWebGpuBuildPath()
  .then((result) => {
    root.dataset.illustroWebgpu = result.status;
    root.dataset.illustroWebgpuCoreProfile =
      result.profile?.supported === true ? 'supported' : 'unsupported';
    root.dataset.illustroWebgpuShaderF16 = result.shaderF16 ? 'available' : 'unavailable';
    root.dataset.illustroWebgpuLimitFailures =
      result.profile?.failures.map((entry) => entry.limit).join(',') ?? '';
    publishCapabilityProfile(result.status === 'ready');
    logger.info('webgpu.bootstrap-complete', { result });
  })
  .catch((error: unknown) => {
    root.dataset.illustroWebgpu = 'error';
    root.dataset.illustroWebgpuCoreProfile = 'error';
    publishCapabilityProfile(false);
    incrementPerformanceCounter('webgpu.bootstrap.failure');
    logger.error('webgpu.bootstrap-failed', error);
  })
  .finally(() => {
    measurePerformance('illustro.bootstrap.webgpu', 'illustro.bootstrap.start');
  });
