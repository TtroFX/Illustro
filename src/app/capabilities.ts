type NavigatorCapabilitySurface = Navigator & {
  readonly gpu?: unknown;
  readonly locks?: unknown;
  readonly wakeLock?: unknown;
  readonly deviceMemory?: number;
  readonly storage?: StorageManager & {
    readonly getDirectory?: () => Promise<unknown>;
  };
};

type PointerEventPrototypeSurface = {
  readonly getCoalescedEvents?: unknown;
  readonly getPredictedEvents?: unknown;
};

export interface RuntimeCapabilities {
  readonly secureContext: boolean;
  readonly crossOriginIsolated: boolean;
  readonly webGpu: boolean;
  readonly serviceWorker: boolean;
  readonly dedicatedWorker: boolean;
  readonly offscreenCanvas: boolean;
  readonly opfs: boolean;
  readonly syncAccessHandle: boolean;
  readonly sharedArrayBuffer: boolean;
  readonly atomics: boolean;
  readonly webLocks: boolean;
  readonly broadcastChannel: boolean;
  readonly pointerEvents: boolean;
  readonly coalescedPointerEvents: boolean;
  readonly predictedPointerEvents: boolean;
  readonly pointerRawUpdate: boolean;
  readonly performanceObserver: boolean;
  readonly wakeLock: boolean;
  readonly displayP3: boolean;
  readonly hardwareConcurrency: number;
  readonly deviceMemoryGiB: number | null;
}

export function collectRuntimeCapabilities(): Readonly<RuntimeCapabilities> {
  const nav = navigator as NavigatorCapabilitySurface;
  const pointerPrototype =
    typeof PointerEvent === 'undefined'
      ? undefined
      : (PointerEvent.prototype as unknown as PointerEventPrototypeSurface);

  return Object.freeze({
    secureContext: globalThis.isSecureContext,
    crossOriginIsolated: globalThis.crossOriginIsolated,
    webGpu: nav.gpu !== undefined,
    serviceWorker: 'serviceWorker' in nav,
    dedicatedWorker: typeof Worker !== 'undefined',
    offscreenCanvas: 'OffscreenCanvas' in globalThis,
    opfs: typeof nav.storage?.getDirectory === 'function',
    syncAccessHandle: 'FileSystemSyncAccessHandle' in globalThis,
    sharedArrayBuffer: typeof SharedArrayBuffer !== 'undefined',
    atomics: typeof Atomics !== 'undefined',
    webLocks: nav.locks !== undefined,
    broadcastChannel: typeof BroadcastChannel !== 'undefined',
    pointerEvents: typeof PointerEvent !== 'undefined',
    coalescedPointerEvents: typeof pointerPrototype?.getCoalescedEvents === 'function',
    predictedPointerEvents: typeof pointerPrototype?.getPredictedEvents === 'function',
    pointerRawUpdate: 'onpointerrawupdate' in globalThis,
    performanceObserver: typeof PerformanceObserver !== 'undefined',
    wakeLock: nav.wakeLock !== undefined,
    displayP3:
      typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia('(color-gamut: p3)').matches
        : false,
    hardwareConcurrency: Math.max(1, nav.hardwareConcurrency || 1),
    deviceMemoryGiB: typeof nav.deviceMemory === 'number' ? nav.deviceMemory : null,
  });
}
