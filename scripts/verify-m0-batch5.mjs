import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const readJson = async (path) => JSON.parse(await readFile(new URL(path, root), 'utf8'));

const license = await readFile(new URL('LICENSE', root), 'utf8');
const template = await readFile(new URL('legal/apache-2.0.txt', root), 'utf8');
assert.equal(license, template, 'LICENSE must exactly match the vendored Apache-2.0 text');

const notice = await readFile(new URL('NOTICE', root), 'utf8');
assert.match(notice, /^Illustro\nCopyright 2026 Illustro contributors/m);
assert.match(notice, /Apache License, Version 2\.0/);

const provenance = await readJson('third_party/provenance.json');
assert.equal(provenance.schemaVersion, 1);
for (const direct of ['@biomejs/biome@2.5.11', 'typescript@5.9.2', 'vitest@4.1.10']) {
  assert.ok(
    provenance.packages.some((entry) => `${entry.component}@${entry.version}` === direct),
    `missing provenance for ${direct}`,
  );
}
assert.ok(provenance.packages.every((entry) => entry.licenseExpression && entry.reviewStatus));
assert.ok(provenance.packages.every((entry) => entry.usage !== 'runtime-distributed' || entry.reviewStatus === 'reviewed'));

const thirdParty = await readFile(new URL('THIRD_PARTY_NOTICES.md', root), 'utf8');
assert.match(thirdParty, /Generated from `third_party\/provenance\.json`/);

const bom = await readJson('bom.cdx.json');
assert.equal(bom.bomFormat, 'CycloneDX');
assert.equal(bom.specVersion, '1.7');
for (const name of ['@biomejs/biome', 'typescript', 'vitest']) {
  assert.ok(bom.components.some((component) => component.name === name), `SBOM missing ${name}`);
}

const offline = await readJson('public/legal/open-source-licenses.json');
assert.equal(offline.generatedFrom, 'third_party/provenance.json');
const runtimeCount = provenance.packages.filter((entry) => entry.usage === 'runtime-distributed').length;
assert.equal(offline.components.length, runtimeCount);

for (const path of [
  'third_party/policy.json',
  'third_party/reviewed-components.json',
  'third_party/licenses/README.md',
  'dist/legal/LICENSE',
  'dist/legal/NOTICE',
  'dist/legal/THIRD_PARTY_NOTICES.md',
  'dist/legal/bom.cdx.json',
  'dist/legal/open-source-licenses.json',
  '.github/workflows/m0-batch5.yml',
]) {
  await access(new URL(path, root));
}

const distLicense = await readFile(new URL('dist/legal/LICENSE', root), 'utf8');
assert.equal(distLicense, license);
const serviceWorker = await readFile(new URL('public/service-worker.js', root), 'utf8');
for (const asset of [
  './legal/open-source-licenses.json',
  './legal/LICENSE',
  './legal/NOTICE',
  './legal/THIRD_PARTY_NOTICES.md',
  './legal/bom.cdx.json',
]) {
  assert.ok(serviceWorker.includes(asset), `service worker does not precache ${asset}`);
}

console.log(
  JSON.stringify({
    event: 'verify.m0-batch5.pass',
    provenancePackages: provenance.packages.length,
    runtimeDistributed: runtimeCount,
    sbomSpecVersion: bom.specVersion,
  }),
);
