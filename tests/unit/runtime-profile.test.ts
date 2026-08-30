import { describe, expect, it } from 'vitest';
import type { RuntimeCapabilities } from '../../src/app/capabilities.js';
import {
  createRuntimeCapabilityProfile,
  MIN_FULL_EDITOR_VIEWPORT_WIDTH_CSS_PX,
} from '../../src/app/runtime-profile.js';

const BASE_CAPABILITIES: RuntimeCapabilities = {
  secureContext: true,
  crossOriginIsolated: true,
  webGpu: true,
  serviceWorker: true,
  dedicatedWorker: true,
  offscreenCanvas: true,
  opfs: true,
  syncAccessHandle: true,
  sharedArrayBuffer: true,
  atomics: true,
  webLocks: true,
  broadcastChannel: true,
  pointerEvents: true,
  coalescedPointerEvents: true,
  predictedPointerEvents: true,
  pointerRawUpdate: true,
  performanceObserver: true,
  wakeLock: true,
  displayP3: true,
  hardwareConcurrency: 8,
  deviceMemoryGiB: 8,
};

describe('runtime capability profile', () => {
  it('keeps full-editor eligibility pending until storage viability is measured', () => {
    const profile = createRuntimeCapabilityProfile(BASE_CAPABILITIES, {
      coreWebGpuDeviceReady: true,
      transferableArrayBuffer: true,
      storageWriteViable: 'pending',
      viewportWidthCssPx: 1280,
    });

    expect(profile.fullEditorEligibility).toBe('pending');
    expect(profile.blockingReasonCodes).toEqual([]);
    expect(profile.pendingReasonCodes).toEqual(['capability.storageWriteViable']);
    expect(profile.optional.sharedMemoryFastPath).toBe(true);
  });

  it('rejects a narrow shell or failed baseline WebGPU device without disabling optional recovery shell features', () => {
    const profile = createRuntimeCapabilityProfile(BASE_CAPABILITIES, {
      coreWebGpuDeviceReady: false,
      transferableArrayBuffer: true,
      storageWriteViable: true,
      viewportWidthCssPx: MIN_FULL_EDITOR_VIEWPORT_WIDTH_CSS_PX - 1,
    });

    expect(profile.fullEditorEligibility).toBe('ineligible');
    expect(profile.blockingReasonCodes).toEqual([
      'capability.coreWebGpuDevice',
      'capability.fullEditorViewport',
    ]);
    expect(profile.optional.webLocks).toBe(true);
  });

  it('marks the full editor eligible only when every baseline probe passes', () => {
    const profile = createRuntimeCapabilityProfile(BASE_CAPABILITIES, {
      coreWebGpuDeviceReady: true,
      transferableArrayBuffer: true,
      storageWriteViable: true,
      viewportWidthCssPx: 1024,
    });
    expect(profile.fullEditorEligibility).toBe('eligible');
  });
});
