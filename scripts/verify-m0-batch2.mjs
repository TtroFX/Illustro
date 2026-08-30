import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const expectedMode = process.argv[2] ?? 'production';
assert.ok(expectedMode === 'production' || expectedMode === 'development');

const required = [
  'dist/workers/render.worker.js',
  'dist/workers/storage.worker.js',
  'dist/app/workers.js',
  'dist/shared/runtime-config.js',
  'dist/service-worker.js',
  'dist/manifest.webmanifest',
  'dist/assets/README.md',
];
for (const path of required) await access(path);

const main = await readFile('dist/app/main.js', 'utf8');
assert.match(main, /startDedicatedWorkers/);
assert.match(main, /serviceWorker\s*\.\s*register/);

const workers = await readFile('dist/app/workers.js', 'utf8');
assert.match(workers, /render\.worker\.js/);
assert.match(workers, /storage\.worker\.js/);
assert.match(workers, /type:\s*['"]module['"]/);

const renderWorker = await readFile('dist/workers/render.worker.js', 'utf8');
const storageWorker = await readFile('dist/workers/storage.worker.js', 'utf8');
assert.match(renderWorker, /worker\.render\.ready/);
assert.match(storageWorker, /worker\.storage\.ready/);

const serviceWorker = await readFile('dist/service-worker.js', 'utf8');
assert.match(serviceWorker, /addEventListener\(['"]install['"]/);
assert.match(serviceWorker, /addEventListener\(['"]fetch['"]/);

const manifest = JSON.parse(await readFile('dist/manifest.webmanifest', 'utf8'));
assert.equal(manifest.display, 'standalone');
assert.equal(manifest.start_url, './');
assert.equal(manifest.scope, './');

const html = await readFile('dist/index.html', 'utf8');
assert.match(html, /rel="manifest" href="\.\/manifest\.webmanifest"/);
assert.match(html, new RegExp(`name="illustro-build-mode" content="${expectedMode}"`));

const runtimeConfig = await readFile('dist/shared/runtime-config.js', 'utf8');
assert.match(runtimeConfig, /service-worker\.js/);
assert.match(runtimeConfig, /staticAssetBaseUrl/);

console.log(JSON.stringify({ event: 'verify.m0.batch2.pass', expectedMode }));
