import { bootstrapShaderSource } from '../generated/bootstrap-shader.js';

type IllustroGpuDevice = {
  createShaderModule(descriptor: { code: string; label?: string }): unknown;
};

type IllustroGpuAdapter = {
  requestDevice(): Promise<IllustroGpuDevice>;
};

type IllustroGpu = {
  requestAdapter(options?: { powerPreference?: 'low-power' | 'high-performance' }): Promise<IllustroGpuAdapter | null>;
};

type NavigatorWithGpu = Navigator & { gpu?: IllustroGpu };

export type WebGpuBootstrapStatus = 'ready' | 'unsupported';

export async function initializeWebGpuBuildPath(): Promise<WebGpuBootstrapStatus> {
  const gpu = (navigator as NavigatorWithGpu).gpu;
  if (!gpu) return 'unsupported';

  const adapter = await gpu.requestAdapter({ powerPreference: 'high-performance' });
  if (!adapter) return 'unsupported';

  const device = await adapter.requestDevice();
  device.createShaderModule({
    label: 'illustro-m0-bootstrap',
    code: bootstrapShaderSource,
  });
  return 'ready';
}
