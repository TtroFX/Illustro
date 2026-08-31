import { buildIdentity } from '../generated/build-info.js';
import { inspectWebGpuBuildPath } from '../gpu/webgpu-bootstrap.js';
import { PointerHoverTrackerV1 } from '../input/hover-state.js';
import { createPointerInputArbitrationV1 } from '../input/input-arbitration.js';
import { createPointerInputTransportV1 } from '../input/input-transport.js';
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
    const paint = paintSession.ingestPointerBatch(arbitration.forwardBatch);
    root.dataset.illustroPaintStroke =
      paint.activeStrokeId !== null
        ? 'active'
        : paint.pendingCompletedStrokeCount > 0
          ? 'pending-commit'
          : 'idle';
    root.dataset.illustroPaintStrokeSamples = String(paint.activeStrokeSampleCount);
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
    const document = await paintSession.createNewDocument({
      width: Math.max(1, Math.round(surfaceSize.width / surfaceSize.pixelRatio)),
      height: Math.max(1, Math.round(surfaceSize.height / surfaceSize.pixelRatio)),
    });
    root.dataset.illustroPaintSession = 'ready';
    root.dataset.illustroDocumentId = document.documentId;
    root.dataset.illustroDocumentWidth = String(document.canvas.width);
    root.dataset.illustroDocumentHeight = String(document.canvas.height);
    root.dataset.illustroActiveLayerId = String(document.layerTree.rootLayerIds[0] ?? '');
    root.dataset.illustroPaintStroke = 'idle';
    root.dataset.illustroPaintStrokeSamples = '0';
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

globalThis.addEventListener(
  'pagehide',
  () => {
    pointerInput.dispose();
    pointerTransport.dispose();
    pointerHover.clear();
    paintSession.dispose();
    root.dataset.illustroPointerInput = 'disposed';
    root.dataset.illustroPaintSession = 'disposed';
    renderer.dispose();
    shell.dispose();
    workers.dispose();
    stopPerformanceInstrumentation();
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
