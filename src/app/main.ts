import { initializeWebGpuBuildPath } from '../gpu/webgpu-bootstrap.js';
import { getRuntimeConfig } from '../shared/runtime-config.js';
import { startDedicatedWorkers } from './workers.js';

const root = document.documentElement;
const runtime = getRuntimeConfig();
root.dataset.illustroRuntime = 'bootstrapped';
root.dataset.illustroBuildMode = runtime.buildMode;

const workers = startDedicatedWorkers();
globalThis.addEventListener('pagehide', () => workers.dispose(), { once: true });

if ('serviceWorker' in navigator) {
  const localDevelopmentHost = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  if (globalThis.isSecureContext || localDevelopmentHost) {
    void navigator.serviceWorker
      .register(runtime.serviceWorkerUrl, { scope: './', updateViaCache: 'none' })
      .then(() => {
        root.dataset.illustroServiceWorker = 'registered';
      })
      .catch((error: unknown) => {
        root.dataset.illustroServiceWorker = 'error';
        console.error('Illustro service worker registration failed', error);
      });
  } else {
    root.dataset.illustroServiceWorker = 'insecure-context';
  }
}

void initializeWebGpuBuildPath()
  .then((status) => {
    root.dataset.illustroWebgpu = status;
  })
  .catch((error: unknown) => {
    root.dataset.illustroWebgpu = 'error';
    console.error('Illustro WebGPU bootstrap failed', error);
  });
