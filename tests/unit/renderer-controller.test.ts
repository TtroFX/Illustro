import { describe, expect, it } from 'vitest';
import { selectRendererExecutionPathV1 } from '../../src/app/renderer-controller.js';

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
});
