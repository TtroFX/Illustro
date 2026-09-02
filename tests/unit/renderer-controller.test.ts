import { describe, expect, it } from 'vitest';
import {
  selectRendererExecutionPathV1,
  shouldHandoffRendererToCompatibilityV1,
} from '../../src/app/renderer-controller.js';

describe('M3 renderer execution ownership selection', () => {
  it('prefers Render Worker only when both worker WebGPU and OffscreenCanvas transfer are ready', () => {
    expect(
      selectRendererExecutionPathV1({
        workerDeviceReady: true,
        offscreenTransferAvailable: true,
      }),
    ).toBe('worker');
  });

  it('keeps the canvas on main when worker WebGPU or OffscreenCanvas transfer is unavailable', () => {
    expect(
      selectRendererExecutionPathV1({
        workerDeviceReady: false,
        offscreenTransferAvailable: true,
      }),
    ).toBe('main');
    expect(
      selectRendererExecutionPathV1({
        workerDeviceReady: true,
        offscreenTransferAvailable: false,
      }),
    ).toBe('main');
  });

  it('selects compatibility rendering after both WebGPU execution paths are unavailable', () => {
    expect(
      selectRendererExecutionPathV1({
        workerDeviceReady: false,
        offscreenTransferAvailable: true,
        mainDeviceReady: false,
      }),
    ).toBe('compatibility');
  });

  it('hands a live GPU backend to compatibility only after device recovery is exhausted', () => {
    expect(shouldHandoffRendererToCompatibilityV1('worker', 'recovery-required')).toBe(true);
    expect(shouldHandoffRendererToCompatibilityV1('main', 'recovery-required')).toBe(true);
    expect(shouldHandoffRendererToCompatibilityV1('worker', 'recovering')).toBe(false);
    expect(shouldHandoffRendererToCompatibilityV1('main', 'unavailable')).toBe(false);
    expect(shouldHandoffRendererToCompatibilityV1('compatibility', 'recovery-required')).toBe(
      false,
    );
  });
});
