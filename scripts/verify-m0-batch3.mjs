import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';

const mode = process.argv[2] ?? 'production';
assert.ok(mode === 'production' || mode === 'development');

function expectedBuildSha() {
  const explicit = process.env.ILLUSTRO_BUILD_SHA || process.env.GITHUB_SHA;
  if (explicit) return explicit.trim();
  return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
}

async function text(path) {
  return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

const buildInfo = JSON.parse(await text('dist/build-info.json'));
assert.equal(buildInfo.buildSha, expectedBuildSha());
assert.equal(buildInfo.buildMode, mode);

const main = await text('dist/app/main.js');
assert.match(main, /collectRuntimeCapabilities/);
assert.match(main, /installDiagnosticsHook/);
assert.match(main, /startPerformanceInstrumentation/);
assert.match(main, /illustroBuildSha/);

const capabilities = await text('dist/app/capabilities.js');
assert.match(capabilities, /crossOriginIsolated/);
assert.match(capabilities, /FileSystemSyncAccessHandle/);
assert.match(capabilities, /SharedArrayBuffer/);
assert.match(capabilities, /PerformanceObserver/);

const logger = await text('dist/shared/logger.js');
assert.match(logger, /MAX_LOG_RECORDS/);
assert.match(logger, /JSON\.stringify/);
assert.match(logger, /buildIdentity\.buildSha/);

const diagnostics = await text('dist/app/diagnostics.js');
assert.match(diagnostics, /__ILLUSTRO_DIAGNOSTICS__/);
assert.match(diagnostics, /getPerformanceDiagnostics/);
assert.match(diagnostics, /getRecentLogRecords/);

const instrumentation = await text('dist/shared/performance.js');
assert.match(instrumentation, /PerformanceObserver/);
assert.match(instrumentation, /longtask/);
assert.match(instrumentation, /performance\.measure/);

const fixture = JSON.parse(await text('test/fixtures/m0/runtime-capabilities.json'));
assert.equal(fixture.schema, 'illustro.m0.runtime-capabilities.fixture.v1');
const golden = JSON.parse(await text('test/golden/m0/diagnostics-shape.json'));
assert.deepEqual(golden.requiredTopLevelKeys, [
  'build',
  'runtime',
  'capabilities',
  'performance',
  'logs',
]);

console.log(JSON.stringify({ event: 'm0.batch3.verified', mode, buildSha: buildInfo.buildSha }));
