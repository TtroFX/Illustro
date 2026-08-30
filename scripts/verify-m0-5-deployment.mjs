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

const targets = await readJson('deployment/targets.json');
assert.equal(targets.schemaVersion, 1);
assert.equal(targets.provider, 'vercel');
assert.equal(targets.projectName, 'illustro');
assert.equal(targets.repository, 'TtroFX/Illustro');
assert.equal(targets.production?.branch, 'main');
assert.equal(targets.production?.automaticDeployment, true);
assert.equal(targets.preview?.branch, 'preview');
assert.equal(
  targets.preview?.fixedUrl,
  'https://illustro-git-preview-ibukioike2009-7645s-projects.vercel.app',
);

const runtimeEvidence = await readJson('verification/m0.5-preview-runtime.json');
assert.equal(runtimeEvidence.evidenceType, 'user-runtime-verification');
assert.match(runtimeEvidence.build?.buildSha ?? '', /^[0-9a-f]{40}$/);
assert.equal(runtimeEvidence.build?.buildMode, 'production');
assert.equal(runtimeEvidence.location?.protocol, 'https:');
assert.equal(runtimeEvidence.location?.secureContext, true);
assert.equal(runtimeEvidence.isolation?.crossOriginIsolated, true);
assert.equal(runtimeEvidence.isolation?.sharedArrayBuffer, true);
assert.equal(runtimeEvidence.serviceWorker?.supported, true);
assert.equal(runtimeEvidence.serviceWorker?.controlled, true);
assert.equal(runtimeEvidence.manifest?.id, './');
assert.equal(runtimeEvidence.manifest?.startUrl, './');
assert.equal(runtimeEvidence.manifest?.display, 'standalone');

const productionEvidence = await readJson('verification/m0.5-production-link.json');
assert.equal(productionEvidence.evidenceType, 'user-confirmed-external-configuration');
assert.equal(productionEvidence.provider, 'vercel');
assert.equal(productionEvidence.projectName, targets.projectName);
assert.equal(productionEvidence.repository, targets.repository);
assert.equal(productionEvidence.productionBranch, targets.production.branch);
assert.equal(productionEvidence.automaticProductionDeployment, true);
assert.equal(productionEvidence.confirmation, 'user-confirmed');

const deploymentGuide = await readText('DEPLOYMENT.md');
assert.ok(deploymentGuide.includes(targets.preview.fixedUrl));
assert.ok(deploymentGuide.includes(`${targets.preview.fixedUrl}/diagnostics/`));

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
  assert.doesNotMatch(
    contents,
    /(?:src|href)=["']https?:\/\//i,
    `${path} contains an external critical asset`,
  );
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
    deploymentTargets: targets,
    runtimeEvidenceBuildSha: runtimeEvidence.build.buildSha,
  }),
);
