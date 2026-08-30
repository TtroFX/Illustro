import { bootstrapShaderSource } from '../generated/bootstrap-shader.js';
import {
  acquireCoreWebGpuV1,
  type WebGpuAcquireStatusV1,
  type WebGpuCoreProfileV1,
} from './webgpu-capability.js';

export type WebGpuBootstrapStatus = WebGpuAcquireStatusV1 | 'shader-bootstrap-failed';

export interface WebGpuBootstrapResultV1 {
  readonly schema: 'illustro.webgpu-bootstrap/1';
  readonly status: WebGpuBootstrapStatus;
  readonly profile: WebGpuCoreProfileV1 | null;
  readonly shaderF16: boolean;
  readonly errorMessage: string | null;
}

export async function inspectWebGpuBuildPath(): Promise<WebGpuBootstrapResultV1> {
  const acquired = await acquireCoreWebGpuV1();
  if (acquired.status !== 'ready' || acquired.device === null) {
    return Object.freeze({
      schema: 'illustro.webgpu-bootstrap/1',
      status: acquired.status,
      profile: acquired.profile,
      shaderF16: acquired.profile?.shaderF16 ?? false,
      errorMessage: acquired.errorMessage,
    });
  }

  try {
    acquired.device.createShaderModule({
      label: 'illustro-m3-core-bootstrap',
      code: bootstrapShaderSource,
    });
    return Object.freeze({
      schema: 'illustro.webgpu-bootstrap/1',
      status: 'ready',
      profile: acquired.profile,
      shaderF16: acquired.profile?.shaderF16 ?? false,
      errorMessage: null,
    });
  } catch (error) {
    return Object.freeze({
      schema: 'illustro.webgpu-bootstrap/1',
      status: 'shader-bootstrap-failed',
      profile: acquired.profile,
      shaderF16: acquired.profile?.shaderF16 ?? false,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function initializeWebGpuBuildPath(): Promise<WebGpuBootstrapStatus> {
  return (await inspectWebGpuBuildPath()).status;
}
