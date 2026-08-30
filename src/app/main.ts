import { buildIdentity } from '../generated/build-info.js';
import { initializeWebGpuBuildPath } from '../gpu/webgpu-bootstrap.js';
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
import { startDedicatedWorkers } from './workers.js';

const logger = createLogger('app.bootstrap');
const stopPerformanceInstrumentation = startPerformanceInstrumentation();
markPerformance('illustro.bootstrap.start');

const root = document.documentElement;
const runtime = getRuntimeConfig();
const capabilities = collectRuntimeCapabilities();
root.dataset.illustroRuntime = 'bootstrapped';
root.dataset.illustroBuildMode = runtime.buildMode;
root.dataset.illustroBuildSha = buildIdentity.buildSha;
root.dataset.illustroCapabilityProfile = capabilities.webGpu ? 'webgpu-present' : 'webgpu-missing';
installDiagnosticsHook();
logger.info('runtime.bootstrap', { build: buildIdentity, runtime, capabilities });

const workers = startDedicatedWorkers();
globalThis.addEventListener(
  'pagehide',
  () => {
    workers.dispose();
    stopPerformanceInstrumentation();
  },
  { once: true },
);

if ('serviceWorker' in navigator) {
  const localDevelopmentHost = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
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

void initializeWebGpuBuildPath()
  .then((status) => {
    root.dataset.illustroWebgpu = status;
    logger.info('webgpu.bootstrap-complete', { status });
  })
  .catch((error: unknown) => {
    root.dataset.illustroWebgpu = 'error';
    incrementPerformanceCounter('webgpu.bootstrap.failure');
    logger.error('webgpu.bootstrap-failed', error);
  })
  .finally(() => {
    measurePerformance('illustro.bootstrap.webgpu', 'illustro.bootstrap.start');
  });
