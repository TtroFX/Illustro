export const WEBGPU_CORE_LIMIT_REQUIREMENTS = Object.freeze({
  maxTextureDimension2D: 8_192,
  maxBufferSize: 268_435_456,
  maxStorageBufferBindingSize: 134_217_728,
  maxUniformBufferBindingSize: 65_536,
  maxBindGroups: 4,
  maxComputeInvocationsPerWorkgroup: 256,
} as const);

export type WebGpuCoreLimitNameV1 = keyof typeof WEBGPU_CORE_LIMIT_REQUIREMENTS;

export interface WebGpuLimitsLikeV1 {
  readonly maxTextureDimension2D: number;
  readonly maxBufferSize: number;
  readonly maxStorageBufferBindingSize: number;
  readonly maxUniformBufferBindingSize: number;
  readonly maxBindGroups: number;
  readonly maxComputeInvocationsPerWorkgroup: number;
}

export interface WebGpuFeaturesLikeV1 {
  has(feature: string): boolean;
}

export interface IllustroGpuDeviceV1 {
  createShaderModule(descriptor: { readonly code: string; readonly label?: string }): unknown;
}

export interface IllustroGpuAdapterV1 {
  readonly limits: WebGpuLimitsLikeV1;
  readonly features: WebGpuFeaturesLikeV1;
  requestDevice(): Promise<IllustroGpuDeviceV1>;
}

export interface IllustroGpuV1 {
  requestAdapter(options?: {
    readonly powerPreference?: 'low-power' | 'high-performance';
  }): Promise<IllustroGpuAdapterV1 | null>;
}

export interface WebGpuLimitFailureV1 {
  readonly limit: WebGpuCoreLimitNameV1;
  readonly required: number;
  readonly actual: number;
}

export interface WebGpuCoreProfileV1 {
  readonly schema: 'illustro.webgpu-core-profile/1';
  readonly supported: boolean;
  readonly shaderF16: boolean;
  readonly limits: Readonly<WebGpuLimitsLikeV1>;
  readonly failures: readonly WebGpuLimitFailureV1[];
}

export type WebGpuAcquireStatusV1 =
  | 'ready'
  | 'insecure-context'
  | 'api-unavailable'
  | 'adapter-unavailable'
  | 'profile-unsupported'
  | 'device-failed';

export interface WebGpuAcquireResultV1 {
  readonly schema: 'illustro.webgpu-acquire/1';
  readonly status: WebGpuAcquireStatusV1;
  readonly profile: WebGpuCoreProfileV1 | null;
  readonly adapter: IllustroGpuAdapterV1 | null;
  readonly device: IllustroGpuDeviceV1 | null;
  readonly errorMessage: string | null;
}

function finiteLimit(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;
}

function snapshotLimits(limits: WebGpuLimitsLikeV1): Readonly<WebGpuLimitsLikeV1> {
  return Object.freeze({
    maxTextureDimension2D: finiteLimit(limits.maxTextureDimension2D),
    maxBufferSize: finiteLimit(limits.maxBufferSize),
    maxStorageBufferBindingSize: finiteLimit(limits.maxStorageBufferBindingSize),
    maxUniformBufferBindingSize: finiteLimit(limits.maxUniformBufferBindingSize),
    maxBindGroups: finiteLimit(limits.maxBindGroups),
    maxComputeInvocationsPerWorkgroup: finiteLimit(limits.maxComputeInvocationsPerWorkgroup),
  });
}

export function evaluateWebGpuCoreProfileV1(adapter: IllustroGpuAdapterV1): WebGpuCoreProfileV1 {
  const limits = snapshotLimits(adapter.limits);
  const failures: WebGpuLimitFailureV1[] = [];
  for (const [limit, required] of Object.entries(WEBGPU_CORE_LIMIT_REQUIREMENTS) as readonly [
    WebGpuCoreLimitNameV1,
    number,
  ][]) {
    const actual = limits[limit];
    if (actual < required) failures.push(Object.freeze({ limit, required, actual }));
  }
  return Object.freeze({
    schema: 'illustro.webgpu-core-profile/1',
    supported: failures.length === 0,
    shaderF16: adapter.features.has('shader-f16'),
    limits,
    failures: Object.freeze(failures),
  });
}

function browserGpu(): IllustroGpuV1 | null {
  if (typeof navigator === 'undefined') return null;
  const gpu = (navigator as Navigator & { readonly gpu?: unknown }).gpu;
  return gpu === undefined ? null : (gpu as IllustroGpuV1);
}

export async function acquireCoreWebGpuV1(
  input: { readonly secureContext?: boolean; readonly gpu?: IllustroGpuV1 | null } = {},
): Promise<WebGpuAcquireResultV1> {
  const secureContext = input.secureContext ?? globalThis.isSecureContext;
  if (!secureContext) {
    return Object.freeze({
      schema: 'illustro.webgpu-acquire/1',
      status: 'insecure-context',
      profile: null,
      adapter: null,
      device: null,
      errorMessage: null,
    });
  }

  const gpu = input.gpu === undefined ? browserGpu() : input.gpu;
  if (gpu === null) {
    return Object.freeze({
      schema: 'illustro.webgpu-acquire/1',
      status: 'api-unavailable',
      profile: null,
      adapter: null,
      device: null,
      errorMessage: null,
    });
  }

  const adapter = await gpu.requestAdapter({ powerPreference: 'high-performance' });
  if (adapter === null) {
    return Object.freeze({
      schema: 'illustro.webgpu-acquire/1',
      status: 'adapter-unavailable',
      profile: null,
      adapter: null,
      device: null,
      errorMessage: null,
    });
  }

  const profile = evaluateWebGpuCoreProfileV1(adapter);
  if (!profile.supported) {
    return Object.freeze({
      schema: 'illustro.webgpu-acquire/1',
      status: 'profile-unsupported',
      profile,
      adapter,
      device: null,
      errorMessage: null,
    });
  }

  try {
    const device = await adapter.requestDevice();
    return Object.freeze({
      schema: 'illustro.webgpu-acquire/1',
      status: 'ready',
      profile,
      adapter,
      device,
      errorMessage: null,
    });
  } catch (error) {
    return Object.freeze({
      schema: 'illustro.webgpu-acquire/1',
      status: 'device-failed',
      profile,
      adapter,
      device: null,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
  }
}
