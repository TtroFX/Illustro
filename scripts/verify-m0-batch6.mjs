import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const index = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8');
const css = await readFile(new URL('../dist/app-shell.css', import.meta.url), 'utf8');
const serviceWorker = await readFile(new URL('../dist/service-worker.js', import.meta.url), 'utf8');
const shellModule = await readFile(new URL('../dist/app/shell.js', import.meta.url), 'utf8');
const buildInfo = JSON.parse(
  await readFile(new URL('../dist/build-info.json', import.meta.url), 'utf8'),
);

assert.match(index, /data-illustro-shell="foundation"/);
assert.match(index, /id="render-surface"/);
assert.match(index, /app-shell\.css/);
assert.doesNotMatch(index, /id="app"[^>]*hidden/);
assert.match(css, /grid-template-columns:/);
assert.match(css, /shell-canvas/);
assert.match(shellModule, /shellState/);
assert.match(shellModule, /ResizeObserver/);
assert.match(serviceWorker, /\.\/app-shell\.css/);
assert.match(serviceWorker, /\.\/app\/shell\.js/);
assert.equal(buildInfo.buildMode, 'production');
if (process.env.ILLUSTRO_BUILD_SHA) {
  assert.equal(buildInfo.buildSha, process.env.ILLUSTRO_BUILD_SHA);
}

for (const path of [
  '../dist/legal/open-source-licenses.json',
  '../dist/legal/LICENSE',
  '../dist/legal/NOTICE',
  '../dist/legal/THIRD_PARTY_NOTICES.md',
  '../dist/legal/bom.cdx.json',
]) {
  await access(new URL(path, import.meta.url));
}

console.log(
  JSON.stringify({
    event: 'verify.m0-batch6.pass',
    buildSha: buildInfo.buildSha,
    shell: 'foundation',
  }),
);
