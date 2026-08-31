import { buildIdentity } from '../generated/build-info.js';
import { inspectWebGpuBuildPath } from '../gpu/webgpu-bootstrap.js';
import { createLogger } from '../shared/logger.js';
import {
  incrementPerformanceCounter,
  markPerformance,
  measurePerformance,
  startPerformanceInstrumentation,
} from '../shared/performance.js';
import { getRuntimeConfig } from '../shared/runtime-config.js';
import { collectRuntimeCapabilities } from './capabilities.js';
import { installDiagnosticsHook } from './diagnostics.js';
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
const pointerInput = installPointerInputControllerV1(shell.canvas, (batch) => {
  const latest = batch.confirmed.at(-1);
  root.dataset.illustroPointerEvent = batch.eventType;
  root.dataset.illustroPointerSource = latest?.source ?? 'unknown';
  root.dataset.illustroPointerConfirmedSamples = String(batch.confirmed.length);
  root.dataset.illustroPointerPredictedSamples = String(batch.predicted.length);
  incrementPerformanceCounter('input.pointer.batch');
});
root.dataset.illustroPointerInput = 'ready';
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

const workers = startDedicatedWorkers();
const renderer = startRendererController(shell, workers.render, root);
void renderer
  .start()
  .then((snapshot) => logger.info('renderer.runtime-ready', { snapshot }))
  .catch((error: unknown) => {
    incrementPerformanceCounter('renderer.runtime.failure');
    logger.error('renderer.runtime-failed', error);
  });

globalThis.addEventListener(
  'pagehide',
  () => {
    pointerInput.dispose();
    root.dataset.illustroPointerInput = 'disposed';
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
