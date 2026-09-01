import { acquireCoreWebGpuV1, WEBGPU_CORE_LIMIT_REQUIREMENTS } from '../gpu/webgpu-capability.js';

function adapterInfo(adapter) {
  const info = adapter?.info;
  if (typeof info !== 'object' || info === null) return null;
  const output = {};
  for (const key of ['vendor', 'architecture', 'device', 'description']) {
    const value = info[key];
    if (typeof value === 'string' && value.length > 0) output[key] = value;
  }
  return Object.keys(output).length > 0 ? output : null;
}

function serializeAcquireResult(result) {
  return {
    status: result.status,
    errorMessage: result.errorMessage,
    profile:
      result.profile === null
        ? null
        : {
            supported: result.profile.supported,
            shaderF16: result.profile.shaderF16,
            limits: result.profile.limits,
            failures: result.profile.failures,
          },
    adapterInfo: adapterInfo(result.adapter),
  };
}

function evaluateDeviceLimits(device) {
  if (typeof device?.limits !== 'object' || device.limits === null) return null;
  const limits = {};
  const failures = [];
  for (const [limit, required] of Object.entries(WEBGPU_CORE_LIMIT_REQUIREMENTS)) {
    const actual = device.limits[limit];
    limits[limit] = typeof actual === 'number' && Number.isFinite(actual) ? actual : null;
    if (typeof actual !== 'number' || !Number.isFinite(actual) || actual < required) {
      failures.push({ limit, required, actual: limits[limit] });
    }
  }
  return { supported: failures.length === 0, limits, failures };
}

self.addEventListener('message', async (event) => {
  if (event.data?.type !== 'diagnostics.webgpu.probe') return;
  try {
    const result = await acquireCoreWebGpuV1();
    self.postMessage({
      type: 'diagnostics.webgpu.result',
      ok: true,
      result: {
        environment: {
          secureContext: self.isSecureContext,
          crossOriginIsolated: self.crossOriginIsolated,
          navigatorGpu: navigator.gpu !== undefined,
        },
        ...serializeAcquireResult(result),
        deviceProfile: result.device === null ? null : evaluateDeviceLimits(result.device),
      },
      errorMessage: null,
    });
  } catch (error) {
    self.postMessage({
      type: 'diagnostics.webgpu.result',
      ok: false,
      result: null,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
  }
});
