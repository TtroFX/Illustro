import { describe, expect, it } from 'vitest';
import {
  acquireCoreWebGpuV1,
  evaluateWebGpuCoreProfileV1,
  WEBGPU_CORE_LIMIT_REQUIREMENTS,
  type IllustroGpuAdapterV1,
  type IllustroGpuV1,
  type WebGpuDeviceLostInfoLikeV1,
  type WebGpuLimitsLikeV1,
} from '../../src/gpu/webgpu-capability.js';

function limits(overrides: Partial<WebGpuLimitsLikeV1> = {}): WebGpuLimitsLikeV1 {
  return {
    ...WEBGPU_CORE_LIMIT_REQUIREMENTS,
    ...overrides,
  };
}

function adapter(
  input: {
    readonly limits?: Partial<WebGpuLimitsLikeV1>;
    readonly shaderF16?: boolean;
    readonly failDevice?: boolean;
  } = {},
): IllustroGpuAdapterV1 {
  return {
    limits: limits(input.limits),
    features: {
      has(feature) {
        return feature === 'shader-f16' && input.shaderF16 === true;
      },
    },
    async requestDevice() {
      if (input.failDevice === true) throw new Error('device rejected');
      return {
        lost: new Promise<WebGpuDeviceLostInfoLikeV1>(() => undefined),
        createShaderModule() {
          return {};
        },
      };
    },
  };
}

function gpu(result: IllustroGpuAdapterV1 | null): IllustroGpuV1 {
  return {
    async requestAdapter() {
      return result;
    },
  };
}

describe('M3 core WebGPU capability profile', () => {
  it('blocks before navigator.gpu probing in an insecure context', async () => {
    let requested = false;
    const surface: IllustroGpuV1 = {
      async requestAdapter() {
        requested = true;
        return adapter();
      },
    };
    const result = await acquireCoreWebGpuV1({ secureContext: false, gpu: surface });
    expect(result.status).toBe('insecure-context');
    expect(requested).toBe(false);
  });

  it('distinguishes missing WebGPU API and missing adapter', async () => {
    await expect(acquireCoreWebGpuV1({ secureContext: true, gpu: null })).resolves.toMatchObject({
      status: 'api-unavailable',
    });
    await expect(
      acquireCoreWebGpuV1({ secureContext: true, gpu: gpu(null) }),
    ).resolves.toMatchObject({ status: 'adapter-unavailable' });
  });

  it('rejects adapters below any frozen Phase-4 core limit', async () => {
    const weak = adapter({ limits: { maxBindGroups: 3 } });
    const profile = evaluateWebGpuCoreProfileV1(weak);
    expect(profile.supported).toBe(false);
    expect(profile.failures).toEqual([
      {
        limit: 'maxBindGroups',
        required: 4,
        actual: 3,
      },
    ]);
    const result = await acquireCoreWebGpuV1({ secureContext: true, gpu: gpu(weak) });
    expect(result.status).toBe('profile-unsupported');
    expect(result.device).toBeNull();
  });

  it('creates a baseline device without making shader-f16 mandatory', async () => {
    const result = await acquireCoreWebGpuV1({
      secureContext: true,
      gpu: gpu(adapter({ shaderF16: false })),
    });
    expect(result.status).toBe('ready');
    expect(result.profile?.shaderF16).toBe(false);
    expect(result.device).not.toBeNull();
  });

  it('records shader-f16 as an optional optimization capability', async () => {
    const result = await acquireCoreWebGpuV1({
      secureContext: true,
      gpu: gpu(adapter({ shaderF16: true })),
    });
    expect(result.status).toBe('ready');
    expect(result.profile?.shaderF16).toBe(true);
  });

  it('reports device creation failure separately from adapter capability', async () => {
    const result = await acquireCoreWebGpuV1({
      secureContext: true,
      gpu: gpu(adapter({ failDevice: true })),
    });
    expect(result.status).toBe('device-failed');
    expect(result.profile?.supported).toBe(true);
    expect(result.errorMessage).toBe('device rejected');
  });

  it('normalizes adapter request rejection as adapter unavailable', async () => {
    const surface: IllustroGpuV1 = {
      async requestAdapter() {
        throw new Error('adapter reset');
      },
    };
    await expect(acquireCoreWebGpuV1({ secureContext: true, gpu: surface })).resolves.toMatchObject({
      status: 'adapter-unavailable',
      errorMessage: 'adapter reset',
    });
  });
});
