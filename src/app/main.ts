import { initializeWebGpuBuildPath } from '../gpu/webgpu-bootstrap.js';

const root = document.documentElement;
root.dataset.illustroRuntime = 'bootstrapped';

void initializeWebGpuBuildPath()
  .then((status) => {
    root.dataset.illustroWebgpu = status;
  })
  .catch((error: unknown) => {
    root.dataset.illustroWebgpu = 'error';
    console.error('Illustro WebGPU bootstrap failed', error);
  });
