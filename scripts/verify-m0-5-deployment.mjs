import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const readText = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const readJson = async (path) => JSON.parse(await readText(path));

const vercel = await readJson('vercel.json');
assert.equal(vercel.buildCommand, 'npm run build');
assert.equal(vercel.outputDirectory, 'dist');
const globalHeaders = vercel.headers?.find((entry) => entry.source === '/(.*)')?.headers ?? [];
const headerMap = new Map(globalHeaders.map((entry) => [entry.key.toLowerCase(), entry.value]));
assert.equal(headerMap.get('cross-origin-opener-policy'), 'same-origin');
assert.equal(headerMap.get('cross-origin-embedder-policy'), 'require-corp');
assert.equal(headerMap.get('cross-origin-resource-policy'), 'same-origin');

for (const path of [
  'dist/index.html',
  'dist/app-shell.css',
  'dist/build-info.json',
  'dist/manifest.webmanifest',
  'dist/diagnostics/index.html',
  'dist/diagnostics/runtime.js',
]) {
  await access(new URL(`../${path}`, import.meta.url));
}

const html = await readText('dist/index.html');
assert.match(html, /id="build-identity"/);
assert.match(html, /href="\.\/diagnostics\/"/);
const main = await readText('dist/app/main.js');
assert.match(main, /buildIdentity\.buildSha\.slice\(0, 8\)/);
assert.match(main, /illustroSecureContext/);
assert.match(main, /illustroCrossOriginIsolated/);

const diagnostics = await readText('dist/diagnostics/runtime.js');
assert.match(diagnostics, /isSecureContext/);
assert.match(diagnostics, /crossOriginIsolated/);
assert.match(diagnostics, /manifest\.webmanifest/);
assert.match(diagnostics, /build-info\.json/);

const serviceWorker = await readText('dist/service-worker.js');
for (const asset of [
  './app-shell.css',
  './build-info.json',
  './manifest.webmanifest',
  './diagnostics/',
  './diagnostics/runtime.js',
]) {
  assert.ok(serviceWorker.includes(asset), `service worker does not precache ${asset}`);
}

for (const path of [
  'dist/index.html',
  'dist/app-shell.css',
  'dist/diagnostics/index.html',
  'dist/diagnostics/runtime.js',
  'dist/manifest.webmanifest',
]) {
  const contents = await readText(path);
  assert.doesNotMatch(contents, /(?:src|href)=["']https?:\/\//i, `${path} contains an external critical asset`);
}

const build = await readJson('dist/build-info.json');
assert.equal(build.buildMode, 'production');
const manifest = await readJson('dist/manifest.webmanifest');
assert.equal(manifest.display, 'standalone');
assert.equal(manifest.start_url, './');

console.log(
  JSON.stringify({
    event: 'verify.m0.5.deployment-contract.pass',
    buildSha: build.buildSha,
    headers: Object.fromEntries(headerMap),
  }),
);
