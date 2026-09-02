import type { DocumentColorSpace } from '../domain/document.js';
import { bootstrapShaderSource } from '../generated/bootstrap-shader.js';
import type { IllustroGpuDeviceV1 } from './webgpu-capability.js';

const GPU_TEXTURE_USAGE_COPY_DST = 0x0002;
const GPU_TEXTURE_USAGE_RENDER_ATTACHMENT = 0x0010;
const ILLUSTRO_CANVAS_TEXTURE_USAGE =
  GPU_TEXTURE_USAGE_COPY_DST | GPU_TEXTURE_USAGE_RENDER_ATTACHMENT;

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
    readonly usage: number;
    readonly colorSpace: DocumentColorSpace;
  }): void;
}

export class RendererPreviewColorSpaceUnavailableErrorV1 extends Error {
  readonly code = 'preview-color-space-unavailable' as const;
  readonly requestedColorSpace: DocumentColorSpace;

  constructor(requestedColorSpace: DocumentColorSpace, cause?: unknown) {
    super(`renderer preview color space is unavailable: ${requestedColorSpace}`, { cause });
    this.name = 'RendererPreviewColorSpaceUnavailableErrorV1';
    this.requestedColorSpace = requestedColorSpace;
  }
}

export interface RendererDeviceResourcesSnapshotV1 {
  readonly schema: 'illustro.renderer-device-resources/1';
  readonly generation: number;
  readonly surfaceConfigured: boolean;
  readonly canvasFormat: string | null;
  readonly canvasColorSpace: DocumentColorSpace | null;
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
  colorSpace: DocumentColorSpace = 'srgb',
): string {
  const context = surface.getContext('webgpu') as WebGpuCanvasContextLikeV1 | null;
  if (context === null || typeof context.configure !== 'function') {
    throw new Error('WebGPU canvas context is unavailable');
  }
  const format = browserPreferredCanvasFormat();
  const configure = (space: DocumentColorSpace): void =>
    context.configure({
      device,
      format,
      alphaMode: 'premultiplied',
      usage: ILLUSTRO_CANVAS_TEXTURE_USAGE,
      colorSpace: space,
    });
  try {
    configure(colorSpace);
  } catch (error) {
    if (colorSpace !== 'display-p3') throw error;
    try {
      configure('srgb');
    } catch {
      // Preserve the original P3 failure as the actionable preview-boundary reason.
    }
    throw new RendererPreviewColorSpaceUnavailableErrorV1(colorSpace, error);
  }
  return format;
}

export function rebuildRendererDeviceResourcesV1(
  device: IllustroGpuDeviceV1,
  generation: number,
  surface: RendererSurfaceLikeV1 | null = null,
  colorSpace: DocumentColorSpace = 'srgb',
): RendererDeviceResourcesSnapshotV1 {
  device.createShaderModule({
    label: `illustro-renderer-bootstrap-g${generation}`,
    code: bootstrapShaderSource,
  });
  const canvasFormat =
    surface === null ? null : configureRendererSurfaceV1(surface, device, colorSpace);
  return Object.freeze({
    schema: 'illustro.renderer-device-resources/1',
    generation,
    surfaceConfigured: surface !== null,
    canvasFormat,
    canvasColorSpace: surface === null ? null : colorSpace,
  });
}
