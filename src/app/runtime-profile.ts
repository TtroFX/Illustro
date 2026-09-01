import type { RuntimeCapabilities } from './capabilities.js';
import { parseInternalId, type InternalId } from '../domain/internal-id.js';

export const NARROW_LAYOUT_BREAKPOINT_CSS_PX = 600;

/**
 * @deprecated Viewport width no longer gates full-editor eligibility.
 * Use NARROW_LAYOUT_BREAKPOINT_CSS_PX only for responsive presentation decisions.
 */
export const MIN_FULL_EDITOR_VIEWPORT_WIDTH_CSS_PX = NARROW_LAYOUT_BREAKPOINT_CSS_PX;

export type CapabilityProbeStateV1 = boolean | 'pending';
export type FullEditorEligibilityV1 = 'eligible' | 'ineligible' | 'pending';

export interface RuntimeProbeResultsV1 {
  readonly coreWebGpuDeviceReady: CapabilityProbeStateV1;
  readonly transferableArrayBuffer: boolean;
  readonly storageWriteViable: CapabilityProbeStateV1;
  readonly viewportWidthCssPx: number;
}

export interface RuntimeCapabilityProfileV1 {
  readonly schema: 'illustro.runtime-capabilities/1';
  readonly required: {
    readonly secureContext: boolean;
    /** Legacy schema field. WebGPU is preferred acceleration, not editor admission. */
    readonly webGpuApi: boolean;
    /** Legacy schema field. A compatibility renderer may satisfy editor availability. */
    readonly coreWebGpuDeviceReady: CapabilityProbeStateV1;
    readonly opfs: boolean;
    readonly dedicatedWorker: boolean;
    readonly transferableArrayBuffer: boolean;
    /** Legacy compatibility field. Phone-class viewports are valid full-editor targets. */
    readonly fullEditorViewport: boolean;
    readonly storageWriteViable: CapabilityProbeStateV1;
  };
  readonly optional: {
    /** Responsive-layout signal only; this must never block editor eligibility. */
    readonly narrowViewport: boolean;
    readonly sharedMemoryFastPath: boolean;
    readonly workerOffscreenCanvas: boolean;
    readonly syncAccessHandle: boolean;
    readonly webLocks: boolean;
    readonly broadcastChannel: boolean;
    readonly coalescedPointerEvents: boolean;
    readonly predictedPointerEvents: boolean;
    readonly pointerRawUpdate: boolean;
    readonly performanceObserver: boolean;
    readonly wakeLock: boolean;
    readonly displayP3: boolean;
  };
  readonly fullEditorEligibility: FullEditorEligibilityV1;
  readonly blockingReasonCodes: readonly InternalId[];
  readonly pendingReasonCodes: readonly InternalId[];
}

function reason(code: string): InternalId {
  return parseInternalId(code, 'capability reason code');
}

export function probeArrayBufferTransferSupport(): boolean {
  if (typeof structuredClone !== 'function') return false;
  try {
    const source = new ArrayBuffer(1);
    const clone = structuredClone(source, { transfer: [source] });
    return source.byteLength === 0 && clone.byteLength === 1;
  } catch {
    return false;
  }
}

export function createRuntimeCapabilityProfile(
  capabilities: RuntimeCapabilities,
  probes: RuntimeProbeResultsV1,
): RuntimeCapabilityProfileV1 {
  const narrowViewport =
    Number.isFinite(probes.viewportWidthCssPx) &&
    probes.viewportWidthCssPx < NARROW_LAYOUT_BREAKPOINT_CSS_PX;
  const required = Object.freeze({
    secureContext: capabilities.secureContext,
    webGpuApi: capabilities.webGpu,
    coreWebGpuDeviceReady: probes.coreWebGpuDeviceReady,
    opfs: capabilities.opfs,
    dedicatedWorker: capabilities.dedicatedWorker,
    transferableArrayBuffer: probes.transferableArrayBuffer,
    // Kept for schema compatibility. Viewport width is no longer an editor-admission gate.
    fullEditorViewport: true,
    storageWriteViable: probes.storageWriteViable,
  });

  const blockingReasonCodes: InternalId[] = [];
  const pendingReasonCodes: InternalId[] = [];
  // WebGPU API/device readiness intentionally does not participate here. The renderer
  // controller owns the WebGPU Worker -> WebGPU Main -> compatibility backend chain.
  const checks: readonly [keyof typeof required, CapabilityProbeStateV1, string][] = [
    ['secureContext', required.secureContext, 'capability.secureContext'],
    ['opfs', required.opfs, 'capability.opfs'],
    ['dedicatedWorker', required.dedicatedWorker, 'capability.dedicatedWorker'],
    [
      'transferableArrayBuffer',
      required.transferableArrayBuffer,
      'capability.transferableArrayBuffer',
    ],
    ['storageWriteViable', required.storageWriteViable, 'capability.storageWriteViable'],
  ];
  for (const [, value, code] of checks) {
    if (value === false) blockingReasonCodes.push(reason(code));
    if (value === 'pending') pendingReasonCodes.push(reason(code));
  }

  const fullEditorEligibility: FullEditorEligibilityV1 =
    blockingReasonCodes.length > 0
      ? 'ineligible'
      : pendingReasonCodes.length > 0
        ? 'pending'
        : 'eligible';

  return Object.freeze({
    schema: 'illustro.runtime-capabilities/1',
    required,
    optional: Object.freeze({
      narrowViewport,
      sharedMemoryFastPath:
        capabilities.crossOriginIsolated && capabilities.sharedArrayBuffer && capabilities.atomics,
      workerOffscreenCanvas: capabilities.dedicatedWorker && capabilities.offscreenCanvas,
      syncAccessHandle: capabilities.syncAccessHandle,
      webLocks: capabilities.webLocks,
      broadcastChannel: capabilities.broadcastChannel,
      coalescedPointerEvents: capabilities.coalescedPointerEvents,
      predictedPointerEvents: capabilities.predictedPointerEvents,
      pointerRawUpdate: capabilities.pointerRawUpdate,
      performanceObserver: capabilities.performanceObserver,
      wakeLock: capabilities.wakeLock,
      displayP3: capabilities.displayP3,
    }),
    fullEditorEligibility,
    blockingReasonCodes: Object.freeze(blockingReasonCodes),
    pendingReasonCodes: Object.freeze(pendingReasonCodes),
  });
}
