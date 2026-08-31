import { describe, expect, it } from 'vitest';
import type {
  IllustroGpuDeviceV1,
  WebGpuAcquireResultV1,
  WebGpuDeviceLostInfoLikeV1,
} from '../../src/gpu/webgpu-capability.js';
import { RendererDeviceManagerV1 } from '../../src/gpu/renderer-device-manager.js';

function deferred<T>(): { readonly promise: Promise<T>; readonly resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

function device(lost: Promise<WebGpuDeviceLostInfoLikeV1>): IllustroGpuDeviceV1 {
  return {
    lost,
    createShaderModule() {
      return {};
    },
  };
}

function ready(deviceValue: IllustroGpuDeviceV1): WebGpuAcquireResultV1 {
  return {
    schema: 'illustro.webgpu-acquire/1',
    status: 'ready',
    profile: null,
    adapter: null,
    device: deviceValue,
    errorMessage: null,
  };
}

function unavailable(): WebGpuAcquireResultV1 {
  return {
    schema: 'illustro.webgpu-acquire/1',
    status: 'device-failed',
    profile: null,
    adapter: null,
    device: null,
    errorMessage: 'device unavailable',
  };
}

describe('M3 renderer device loss lifecycle', () => {
  it('rebuilds all device-dependent resources on a fresh generation after device loss', async () => {
    const firstLoss = deferred<WebGpuDeviceLostInfoLikeV1>();
    const secondLoss = deferred<WebGpuDeviceLostInfoLikeV1>();
    const firstDevice = device(firstLoss.promise);
    const secondDevice = device(secondLoss.promise);
    const acquired = [firstDevice, secondDevice];
    const rebuilt: number[] = [];
    let acquireIndex = 0;
    let discarded = 0;
    let recoveredResolve!: () => void;
    const recovered = new Promise<void>((resolve) => {
      recoveredResolve = resolve;
    });

    const manager = new RendererDeviceManagerV1({
      acquire: async () => ready(acquired[acquireIndex++] ?? secondDevice),
      rebuild: (_device, generation) => {
        rebuilt.push(generation);
      },
      onDiscardProvisional: () => {
        discarded += 1;
      },
      onState: (snapshot) => {
        if (snapshot.state === 'ready' && snapshot.generation === 2) recoveredResolve();
      },
    });

    await expect(manager.start()).resolves.toMatchObject({ state: 'ready', generation: 1 });
    expect(manager.currentDevice()).toBe(firstDevice);

    firstLoss.resolve({ reason: 'unknown', message: 'simulated reset' });
    await recovered;

    expect(manager.snapshot()).toMatchObject({ state: 'ready', generation: 2 });
    expect(manager.currentDevice()).toBe(secondDevice);
    expect(rebuilt).toEqual([1, 2]);
    expect(discarded).toBe(1);
  });

  it('blocks mutation in recovery-required state after bounded automatic reacquisition fails', async () => {
    const firstLoss = deferred<WebGpuDeviceLostInfoLikeV1>();
    const replacementLoss = deferred<WebGpuDeviceLostInfoLikeV1>();
    const firstDevice = device(firstLoss.promise);
    const replacementDevice = device(replacementLoss.promise);
    let acquireCount = 0;
    let allowManualRecovery = false;
    let recoveryRequiredResolve!: () => void;
    const recoveryRequired = new Promise<void>((resolve) => {
      recoveryRequiredResolve = resolve;
    });

    const manager = new RendererDeviceManagerV1({
      maxReacquireAttempts: 2,
      acquire: async () => {
        acquireCount += 1;
        if (acquireCount === 1) return ready(firstDevice);
        if (allowManualRecovery) return ready(replacementDevice);
        return unavailable();
      },
      rebuild: () => undefined,
      onState: (snapshot) => {
        if (snapshot.state === 'recovery-required') recoveryRequiredResolve();
      },
    });

    await manager.start();
    firstLoss.resolve({ reason: 'unknown', message: 'simulated reset' });
    await recoveryRequired;

    expect(manager.snapshot()).toMatchObject({
      state: 'recovery-required',
      generation: 1,
      reacquireAttempt: 2,
    });
    expect(manager.currentDevice()).toBeNull();

    allowManualRecovery = true;
    await expect(manager.start()).resolves.toMatchObject({ state: 'ready', generation: 2 });
    expect(manager.currentDevice()).toBe(replacementDevice);
  });
});
