import { bootstrapShaderSource } from '../generated/bootstrap-shader.js';
import type { IllustroGpuDeviceV1 } from './webgpu-capability.js';

export interface RendererSurfaceLikeV1 {
  width: number;
  height: number;
  getContext(contextId: string): unknown;
}

interface WebGpuCanvasContextLikeV1 {
  configure(descriptor: {
    readonly device: IllustroGpuDeviceV1;
    readonly format: string;
    readonly alphaMode: 'premultiplied';
  }): void;
}

export interface RendererDeviceResourcesSnapshotV1 {
  readonly schema: 'illustro.renderer-device-resources/1';
  readonly generation: number;
  readonly surfaceConfigured: boolean;
  readonly canvasFormat: string | null;
}

function browserPreferredCanvasFormat(): string {
  if (typeof navigator === 'undefined') return 'bgra8unorm';
  const gpu = (
    navigator as Navigator & {
      readonly gpu?: { readonly getPreferredCanvasFormat?: () => string };
    }
  ).gpu;
  const format = gpu?.getPreferredCanvasFormat?.();
  return typeof format === 'string' && format.length > 0 ? format : 'bgra8unorm';
}

export function configureRendererSurfaceV1(
  surface: RendererSurfaceLikeV1,
  device: IllustroGpuDeviceV1,
): string {
  const context = surface.getContext('webgpu') as WebGpuCanvasContextLikeV1 | null;
  if (context === null || typeof context.configure !== 'function') {
    throw new Error('WebGPU canvas context is unavailable');
  }
  const format = browserPreferredCanvasFormat();
  context.configure({ device, format, alphaMode: 'premultiplied' });
  return format;
}

export function rebuildRendererDeviceResourcesV1(
  device: IllustroGpuDeviceV1,
  generation: number,
  surface: RendererSurfaceLikeV1 | null = null,
): RendererDeviceResourcesSnapshotV1 {
  device.createShaderModule({
    label: `illustro-renderer-bootstrap-g${generation}`,
    code: bootstrapShaderSource,
  });
  const canvasFormat = surface === null ? null : configureRendererSurfaceV1(surface, device);
  return Object.freeze({
    schema: 'illustro.renderer-device-resources/1',
    generation,
    surfaceConfigured: surface !== null,
    canvasFormat,
  });
}
