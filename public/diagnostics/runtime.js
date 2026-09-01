const $ = (selector) => document.querySelector(selector);
const reportEl = $('#report');
const stateEl = $('#state');
const copyEl = $('#copy-report');
const TIMEOUT = 5000;
const err = (value) => (value instanceof Error ? value.message : String(value));
const id = (prefix) =>
  `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`}`;

async function json(url) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.json();
}

function adapterInfo(adapter) {
  const info = adapter?.info;
  if (!info || typeof info !== 'object') return null;
  return Object.fromEntries(
    ['vendor', 'architecture', 'device', 'description']
      .map((key) => [key, info[key]])
      .filter(([, value]) => typeof value === 'string' && value.length),
  );
}

function acquireView(result) {
  return {
    status: result.status,
    errorMessage: result.errorMessage,
    profile: result.profile
      ? {
          supported: result.profile.supported,
          shaderF16: result.profile.shaderF16,
          limits: result.profile.limits,
          failures: result.profile.failures,
        }
      : null,
    adapterInfo: adapterInfo(result.adapter),
  };
}

function deviceView(device, requirements) {
  if (!device?.limits) return null;
  const limits = {};
  const failures = [];
  for (const [limit, required] of Object.entries(requirements)) {
    const actual = Number.isFinite(device.limits[limit]) ? device.limits[limit] : null;
    limits[limit] = actual;
    if (actual === null || actual < required) failures.push({ limit, required, actual });
  }
  return { supported: failures.length === 0, limits, failures };
}

async function probeMain() {
  try {
    const [capability, resources] = await Promise.all([
      import('../gpu/webgpu-capability.js'),
      import('../gpu/renderer-device-resources.js'),
    ]);
    const acquired = await capability.acquireCoreWebGpuV1();
    const output = {
      acquire: acquireView(acquired),
      deviceProfile:
        acquired.device === null
          ? null
          : deviceView(acquired.device, capability.WEBGPU_CORE_LIMIT_REQUIREMENTS),
      resourceRebuild: { status: 'not-run', errorMessage: null },
    };
    if (acquired.status !== 'ready' || acquired.device === null) return output;

    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const scoped =
      typeof acquired.device.pushErrorScope === 'function' &&
      typeof acquired.device.popErrorScope === 'function';
    if (scoped) acquired.device.pushErrorScope('validation');
    try {
      const rebuilt = resources.rebuildRendererDeviceResourcesV1(acquired.device, 1, canvas);
      const validation = scoped ? await acquired.device.popErrorScope() : null;
      output.resourceRebuild = {
        status: validation ? 'validation-failed' : 'ready',
        errorMessage: validation?.message ?? null,
        surfaceConfigured: rebuilt.surfaceConfigured,
        canvasFormat: rebuilt.canvasFormat,
      };
    } catch (error) {
      let validation = null;
      if (scoped) {
        try {
          validation = await acquired.device.popErrorScope();
        } catch {}
      }
      output.resourceRebuild = {
        status: 'failed',
        errorMessage: validation?.message ?? err(error),
      };
    }
    return output;
  } catch (error) {
    return {
      acquire: { status: 'probe-threw', errorMessage: err(error), profile: null, adapterInfo: null },
      deviceProfile: null,
      resourceRebuild: { status: 'not-run', errorMessage: null },
    };
  }
}

function waitWorkerReady(worker) {
  return new Promise((resolve) => {
    const done = (result) => {
      clearTimeout(timer);
      worker.removeEventListener('message', message);
      worker.removeEventListener('error', error);
      resolve(result);
    };
    const message = (event) => {
      if (event.data?.type === 'worker.render.ready') done({ status: 'ready', errorMessage: null });
    };
    const error = (event) =>
      done({ status: 'error', errorMessage: event.message || 'Render Worker error' });
    const timer = setTimeout(
      () => done({ status: 'timeout', errorMessage: `No ready signal in ${TIMEOUT} ms` }),
      TIMEOUT,
    );
    worker.addEventListener('message', message);
    worker.addEventListener('error', error);
  });
}

function rendererRequest(worker, message, transfer = []) {
  return new Promise((resolve) => {
    const done = (result) => {
      clearTimeout(timer);
      worker.removeEventListener('message', receive);
      worker.removeEventListener('error', failed);
      resolve(result);
    };
    const receive = (event) => {
      const data = event.data;
      if (data?.type !== 'renderer.response' || data.requestId !== message.requestId) return;
      done({
        status: 'response',
        ok: data.ok,
        result: data.result,
        errorMessage: data.ok ? null : data.result?.message ?? null,
      });
    };
    const failed = (event) =>
      done({ status: 'worker-error', ok: false, result: null, errorMessage: event.message });
    const timer = setTimeout(
      () =>
        done({
          status: 'timeout',
          ok: false,
          result: null,
          errorMessage: `Request timeout after ${TIMEOUT} ms`,
        }),
      TIMEOUT,
    );
    worker.addEventListener('message', receive);
    worker.addEventListener('error', failed);
    try {
      worker.postMessage(message, transfer);
    } catch (error) {
      done({ status: 'post-failed', ok: false, result: null, errorMessage: err(error) });
    }
  });
}

async function probeAcquireWorker() {
  if (typeof Worker === 'undefined') {
    return { status: 'unsupported', result: null, errorMessage: 'Worker unavailable' };
  }
  let worker;
  try {
    worker = new Worker(new URL('./webgpu-worker.js', import.meta.url), { type: 'module' });
  } catch (error) {
    return { status: 'creation-failed', result: null, errorMessage: err(error) };
  }
  try {
    return await new Promise((resolve) => {
      const done = (result) => {
        clearTimeout(timer);
        resolve(result);
      };
      const timer = setTimeout(
        () => done({ status: 'timeout', result: null, errorMessage: `Timeout after ${TIMEOUT} ms` }),
        TIMEOUT,
      );
      worker.addEventListener(
        'message',
        (event) => {
          if (event.data?.type !== 'diagnostics.webgpu.result') return;
          done({
            status: event.data.ok ? 'ready' : 'failed',
            result: event.data.result ?? null,
            errorMessage: event.data.errorMessage ?? null,
          });
        },
        { once: true },
      );
      worker.addEventListener(
        'error',
        (event) => done({ status: 'worker-error', result: null, errorMessage: event.message }),
        { once: true },
      );
      worker.postMessage({ type: 'diagnostics.webgpu.probe' });
    });
  } finally {
    worker.terminate();
  }
}

async function probeRenderWorker() {
  const transfer =
    typeof HTMLCanvasElement !== 'undefined' &&
    typeof HTMLCanvasElement.prototype.transferControlToOffscreen === 'function';
  if (typeof Worker === 'undefined') {
    return { transfer, ready: { status: 'unsupported' }, probe: null, attach: null };
  }
  let worker;
  try {
    worker = new Worker(new URL('../workers/render.worker.js', import.meta.url), { type: 'module' });
  } catch (error) {
    return {
      transfer,
      ready: { status: 'creation-failed', errorMessage: err(error) },
      probe: null,
      attach: null,
    };
  }
  try {
    const ready = await waitWorkerReady(worker);
    if (ready.status !== 'ready') return { transfer, ready, probe: null, attach: null };
    const probe = await rendererRequest(worker, { type: 'renderer.probe', requestId: id('probe') });
    let attach = null;
    if (transfer && probe.ok === true && probe.result?.state === 'ready') {
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      try {
        const offscreen = canvas.transferControlToOffscreen();
        attach = await rendererRequest(
          worker,
          {
            type: 'renderer.attach',
            requestId: id('attach'),
            canvas: offscreen,
            width: 64,
            height: 64,
          },
          [offscreen],
        );
      } catch (error) {
        attach = { status: 'transfer-failed', ok: false, errorMessage: err(error), result: null };
      }
    }
    return { transfer, ready, probe, attach };
  } finally {
    worker.terminate();
  }
}

function snapshot(response) {
  const result = response?.result;
  if (result?.schema === 'illustro.renderer-device-state/1') return result;
  if (result?.snapshot?.schema === 'illustro.renderer-device-state/1') return result.snapshot;
  return null;
}

function failure(acquire) {
  if (!acquire) return 'No WebGPU acquire result';
  if (acquire.errorMessage) return acquire.errorMessage;
  if (acquire.status === 'profile-unsupported') {
    return (acquire.profile?.failures ?? [])
      .map((item) => `${item.limit}: required ${item.required}, actual ${item.actual}`)
      .join('; ');
  }
  return acquire.status;
}

function summarize(report) {
  if (!report.secureContext) {
    return { usable: false, path: 'unavailable', stage: 'secure-context', reason: 'HTTPS required' };
  }
  const workerState = snapshot(report.webGpu.renderWorker.probe);
  const choosesWorker = workerState?.state === 'ready' && report.webGpu.renderWorker.transfer;
  if (choosesWorker) {
    const attach = report.webGpu.renderWorker.attach;
    return attach?.ok === true
      ? { usable: true, path: 'render-worker', stage: null, reason: null }
      : {
          usable: false,
          path: 'unavailable',
          stage: 'render-worker-surface-attach',
          reason: attach?.errorMessage ?? attach?.result?.message ?? 'OffscreenCanvas attach failed',
        };
  }
  const main = report.webGpu.main;
  if (main.acquire?.status !== 'ready') {
    return {
      usable: false,
      path: 'unavailable',
      stage: `main-${main.acquire?.status ?? 'probe'}`,
      reason: failure(main.acquire),
    };
  }
  if (main.resourceRebuild?.status !== 'ready') {
    return {
      usable: false,
      path: 'unavailable',
      stage: 'main-resource-rebuild',
      reason: main.resourceRebuild?.errorMessage ?? 'Renderer resource rebuild failed',
    };
  }
  return { usable: true, path: 'main-thread-fallback', stage: null, reason: null };
}

function briefMain(main) {
  if (main.acquire?.status !== 'ready') return `${main.acquire?.status}: ${failure(main.acquire)}`;
  return main.resourceRebuild?.status === 'ready'
    ? 'ready'
    : `${main.resourceRebuild?.status}: ${main.resourceRebuild?.errorMessage ?? 'unknown'}`;
}

function briefWorker(report) {
  const render = report.webGpu.renderWorker;
  if (render.ready.status !== 'ready') return `${render.ready.status}: ${render.ready.errorMessage ?? ''}`;
  const state = snapshot(render.probe);
  if (state?.state !== 'ready') {
    const acquire = report.webGpu.workerAcquire.result;
    return `${state?.state ?? render.probe?.status}: ${failure(acquire)}`;
  }
  if (render.transfer && render.attach?.ok !== true) {
    return `surface attach failed: ${render.attach?.errorMessage ?? render.attach?.result?.message ?? ''}`;
  }
  return render.transfer ? 'ready' : 'device ready; main-thread surface fallback';
}

try {
  const [build, manifest, main, workerAcquire, renderWorker] = await Promise.all([
    json('../build-info.json'),
    json('../manifest.webmanifest'),
    probeMain(),
    probeAcquireWorker(),
    probeRenderWorker(),
  ]);
  const base = {
    build,
    secureContext: globalThis.isSecureContext,
    crossOriginIsolated: globalThis.crossOriginIsolated,
    browser: {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      vendor: navigator.vendor,
      hardwareConcurrency: navigator.hardwareConcurrency ?? null,
      deviceMemoryGiB: navigator.deviceMemory ?? null,
    },
    serviceWorker: {
      supported: 'serviceWorker' in navigator,
      controlled: Boolean(navigator.serviceWorker?.controller),
      scriptUrl: navigator.serviceWorker?.controller?.scriptURL ?? null,
    },
    manifest: { id: manifest.id, startUrl: manifest.start_url, display: manifest.display },
    webGpu: {
      apiExposed: navigator.gpu !== undefined,
      main,
      workerAcquire,
      renderWorker,
    },
  };
  const report = { ...base, summary: summarize(base) };
  reportEl.textContent = JSON.stringify(report, null, 2);
  stateEl.value = report.summary.usable
    ? `Renderer ready · ${report.summary.path}`
    : `Renderer unavailable · ${report.summary.stage}`;
  $('#renderer-path').textContent = report.summary.path;
  $('#main-webgpu-state').textContent = briefMain(main);
  $('#worker-webgpu-state').textContent = briefWorker(report);
  $('#surface-state').textContent = renderWorker.transfer
    ? renderWorker.attach?.ok === true
      ? 'Render Worker surface ready'
      : `${renderWorker.attach?.status ?? 'not-run'}: ${
          renderWorker.attach?.errorMessage ?? renderWorker.attach?.result?.message ?? ''
        }`
    : `Main surface ${main.resourceRebuild?.status ?? 'not-run'}`;

  copyEl.disabled = false;
  copyEl.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(reportEl.textContent ?? '');
      copyEl.textContent = 'Copied';
      setTimeout(() => (copyEl.textContent = 'Copy report'), 1500);
    } catch (error) {
      copyEl.textContent = `Copy failed: ${err(error)}`;
    }
  });
} catch (error) {
  reportEl.textContent = error instanceof Error ? error.stack ?? error.message : String(error);
  stateEl.value = 'Diagnostics error';
}
