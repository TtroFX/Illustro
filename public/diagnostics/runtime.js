const reportElement = document.querySelector('#report');
const stateElement = document.querySelector('#state');

async function fetchJson(url) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.json();
}

async function collect() {
  const [build, manifest] = await Promise.all([
    fetchJson('../build-info.json'),
    fetchJson('../manifest.webmanifest'),
  ]);

  return {
    build,
    location: {
      protocol: location.protocol,
      secureContext: globalThis.isSecureContext,
    },
    isolation: {
      crossOriginIsolated: globalThis.crossOriginIsolated,
      sharedArrayBuffer: typeof globalThis.SharedArrayBuffer === 'function',
    },
    serviceWorker: {
      supported: 'serviceWorker' in navigator,
      controlled: Boolean(navigator.serviceWorker?.controller),
    },
    manifest: {
      id: manifest.id,
      startUrl: manifest.start_url,
      display: manifest.display,
    },
  };
}

try {
  const report = await collect();
  reportElement.textContent = JSON.stringify(report, null, 2);
  stateElement.value = report.location.secureContext
    ? report.isolation.crossOriginIsolated
      ? 'Secure · Isolated'
      : 'Secure · Transferable fallback'
    : 'Insecure context';
} catch (error) {
  reportElement.textContent = error instanceof Error ? error.stack ?? error.message : String(error);
  stateElement.value = 'Diagnostics error';
}
