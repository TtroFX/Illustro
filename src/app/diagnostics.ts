import { buildIdentity } from '../generated/build-info.js';
import { getRecentLogRecords } from '../shared/logger.js';
import { getPerformanceDiagnostics } from '../shared/performance.js';
import { getRuntimeConfig } from '../shared/runtime-config.js';
import { collectRuntimeCapabilities, type RuntimeCapabilities } from './capabilities.js';

export interface DiagnosticsSnapshot {
  readonly build: typeof buildIdentity;
  readonly runtime: ReturnType<typeof getRuntimeConfig>;
  readonly capabilities: Readonly<RuntimeCapabilities>;
  readonly performance: ReturnType<typeof getPerformanceDiagnostics>;
  readonly logs: ReturnType<typeof getRecentLogRecords>;
}

type DiagnosticsGlobal = typeof globalThis & {
  __ILLUSTRO_DIAGNOSTICS__?: () => DiagnosticsSnapshot;
};

export function createDiagnosticsSnapshot(): DiagnosticsSnapshot {
  return {
    build: buildIdentity,
    runtime: getRuntimeConfig(),
    capabilities: collectRuntimeCapabilities(),
    performance: getPerformanceDiagnostics(),
    logs: getRecentLogRecords(),
  };
}

export function installDiagnosticsHook(): void {
  (globalThis as DiagnosticsGlobal).__ILLUSTRO_DIAGNOSTICS__ = createDiagnosticsSnapshot;
}
