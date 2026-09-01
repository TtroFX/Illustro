import { describe, expect, it } from 'vitest';
import type { RuntimeCapabilities } from '../../src/app/capabilities.js';
import {
  createRuntimeCapabilityProfile,
  NARROW_LAYOUT_BREAKPOINT_CSS_PX,
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
    expect(profile.optional.narrowViewport).toBe(false);
    expect(profile.optional.sharedMemoryFastPath).toBe(true);
  });

  it('treats a phone-width viewport as responsive layout state rather than an editor blocker', () => {
    const profile = createRuntimeCapabilityProfile(BASE_CAPABILITIES, {
      coreWebGpuDeviceReady: true,
      transferableArrayBuffer: true,
      storageWriteViable: true,
      viewportWidthCssPx: NARROW_LAYOUT_BREAKPOINT_CSS_PX - 1,
    });

    expect(profile.fullEditorEligibility).toBe('eligible');
    expect(profile.required.fullEditorViewport).toBe(true);
    expect(profile.optional.narrowViewport).toBe(true);
    expect(profile.blockingReasonCodes).toEqual([]);
  });

  it('keeps renderer capability failures independent from viewport width', () => {
    const profile = createRuntimeCapabilityProfile(BASE_CAPABILITIES, {
      coreWebGpuDeviceReady: false,
      transferableArrayBuffer: true,
      storageWriteViable: true,
      viewportWidthCssPx: NARROW_LAYOUT_BREAKPOINT_CSS_PX - 1,
    });

    expect(profile.fullEditorEligibility).toBe('ineligible');
    expect(profile.optional.narrowViewport).toBe(true);
    expect(profile.blockingReasonCodes).toEqual(['capability.coreWebGpuDevice']);
  });
});
