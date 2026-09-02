import { describe, expect, it } from 'vitest';
import type {
  IllustroGpuDeviceV1,
  WebGpuDeviceLostInfoLikeV1,
} from '../../src/gpu/webgpu-capability.js';
import {
  configureRendererSurfaceV1,
  rebuildRendererDeviceResourcesV1,
  RendererPreviewColorSpaceUnavailableErrorV1,
} from '../../src/gpu/renderer-device-resources.js';

function testDevice(): { readonly device: IllustroGpuDeviceV1; readonly labels: string[] } {
  const labels: string[] = [];
  return {
    labels,
    device: {
      lost: new Promise<WebGpuDeviceLostInfoLikeV1>(() => undefined),
      createShaderModule(descriptor) {
        labels.push(descriptor.label ?? '');
        return {};
      },
    },
  };
}

describe('M3/M5D renderer device-dependent resource rebuild', () => {
  it('reconfigures replacement devices with an explicit sRGB preview boundary', () => {
    const configurations: unknown[] = [];
    const surface = {
      width: 640,
      height: 480,
      getContext(contextId: string) {
        expect(contextId).toBe('webgpu');
        return {
          configure(descriptor: unknown) {
            configurations.push(descriptor);
          },
        };
      },
    };
    const first = testDevice();
    const second = testDevice();

    const firstSnapshot = rebuildRendererDeviceResourcesV1(first.device, 1, surface);
    const secondSnapshot = rebuildRendererDeviceResourcesV1(second.device, 2, surface);

    expect(firstSnapshot).toMatchObject({
      generation: 1,
      surfaceConfigured: true,
      canvasColorSpace: 'srgb',
    });
    expect(secondSnapshot).toMatchObject({
      generation: 2,
      surfaceConfigured: true,
      canvasColorSpace: 'srgb',
    });
    expect(first.labels).toEqual(['illustro-renderer-bootstrap-g1']);
    expect(second.labels).toEqual(['illustro-renderer-bootstrap-g2']);
    expect(configurations).toHaveLength(2);
    expect(configurations[0]).toMatchObject({
      device: first.device,
      usage: 0x12,
      colorSpace: 'srgb',
    });
    expect(configurations[1]).toMatchObject({
      device: second.device,
      usage: 0x12,
      colorSpace: 'srgb',
    });
  });

  it('requests Display-P3 when the document working space is Display-P3', () => {
    const configurations: unknown[] = [];
    const { device } = testDevice();
    configureRendererSurfaceV1(
      {
        width: 1,
        height: 1,
        getContext() {
          return {
            configure(descriptor: unknown) {
              configurations.push(descriptor);
            },
          };
        },
      },
      device,
      'display-p3',
    );
    expect(configurations).toHaveLength(1);
    expect(configurations[0]).toMatchObject({ colorSpace: 'display-p3' });
  });

  it('reports an unavailable Display-P3 boundary and restores sRGB configuration', () => {
    const spaces: string[] = [];
    const { device } = testDevice();
    expect(() =>
      configureRendererSurfaceV1(
        {
          width: 1,
          height: 1,
          getContext() {
            return {
              configure(descriptor: { readonly colorSpace: string }) {
                spaces.push(descriptor.colorSpace);
                if (descriptor.colorSpace === 'display-p3') throw new Error('unsupported');
              },
            };
          },
        },
        device,
        'display-p3',
      ),
    ).toThrow(RendererPreviewColorSpaceUnavailableErrorV1);
    expect(spaces).toEqual(['display-p3', 'srgb']);
  });

  it('rejects a surface without a WebGPU canvas context', () => {
    const { device } = testDevice();
    expect(() =>
      configureRendererSurfaceV1(
        {
          width: 1,
          height: 1,
          getContext() {
            return null;
          },
        },
        device,
      ),
    ).toThrow('WebGPU canvas context is unavailable');
  });
});
