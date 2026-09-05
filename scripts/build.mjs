import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const mode = process.argv[2] ?? 'production';
if (mode !== 'production' && mode !== 'development') {
  throw new Error(`unknown build mode: ${mode}`);
}

const buildDir = new URL('../.build/', import.meta.url);
const distDir = new URL('../dist/', import.meta.url);
const publicDir = new URL('../public/', import.meta.url);

async function collectDistFiles(directory, prefix = '') {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relativePath = `${prefix}${entry.name}`;
    if (entry.isDirectory()) {
      files.push(
        ...(await collectDistFiles(new URL(`${entry.name}/`, directory), `${relativePath}/`)),
      );
    } else if (relativePath !== 'service-worker.js') {
      files.push(`./${relativePath}`);
    }
  }
  return files;
}

await rm(buildDir, { recursive: true, force: true });
await rm(distDir, { recursive: true, force: true });
await mkdir(distDir, { recursive: true });

const generatorEnv = { ...process.env, ILLUSTRO_BUILD_MODE: mode };
for (const script of [
  'scripts/generate-m6a-sampled-resources.mjs',
  'scripts/generate-m6a-brush-thumbnails.mjs',
  'scripts/generate-wgsl.mjs',
  'scripts/generate-build-info.mjs',
  'scripts/generate-legal.mjs',
]) {
  const generator = spawnSync(process.execPath, [script], {
    stdio: 'inherit',
    env: generatorEnv,
  });
  if (generator.status !== 0) process.exit(generator.status ?? 1);
}

const tscArgs = [
  'node_modules/typescript/bin/tsc',
  '-p',
  'tsconfig.json',
  '--sourceMap',
  mode === 'development' ? 'true' : 'false',
];
const compiler = spawnSync(process.execPath, tscArgs, { stdio: 'inherit' });
if (compiler.status !== 0) process.exit(compiler.status ?? 1);

await cp(new URL('../.build/app/', import.meta.url), distDir, { recursive: true });
for (const entry of await readdir(publicDir, { withFileTypes: true })) {
  const suffix = entry.isDirectory() ? '/' : '';
  await cp(
    new URL(`${entry.name}${suffix}`, publicDir),
    new URL(`${entry.name}${suffix}`, distDir),
    { recursive: true },
  );
}
await cp(new URL('../.build/generated-public/', import.meta.url), distDir, { recursive: true });

const vendorDistDir = new URL('vendor/', distDir);
await mkdir(vendorDistDir, { recursive: true });
await cp(
  new URL('../node_modules/jsqr/dist/jsQR.js', import.meta.url),
  new URL('jsQR.js', vendorDistDir),
);
await cp(
  new URL('../node_modules/sql.js/dist/sql-wasm.js', import.meta.url),
  new URL('sql-wasm.js', vendorDistDir),
);
await cp(
  new URL('../node_modules/sql.js/dist/sql-wasm.wasm', import.meta.url),
  new URL('sql-wasm.wasm', vendorDistDir),
);
await cp(
  new URL('../.build/meta/build-info.json', import.meta.url),
  new URL('build-info.json', distDir),
);

const legalDistDir = new URL('legal/', distDir);
await mkdir(legalDistDir, { recursive: true });
for (const file of ['LICENSE', 'NOTICE', 'THIRD_PARTY_NOTICES.md', 'bom.cdx.json']) {
  await cp(new URL(`../${file}`, import.meta.url), new URL(file, legalDistDir));
}
await cp(
  new URL('../third_party/licenses/', import.meta.url),
  new URL('third_party/licenses/', legalDistDir),
  { recursive: true },
);

const template = await readFile(new URL('../src/index.html', import.meta.url), 'utf8');
const html = template.replaceAll('__ILLUSTRO_BUILD_MODE__', mode);
await writeFile(new URL('index.html', distDir), html, 'utf8');

const buildInfo = JSON.parse(await readFile(new URL('build-info.json', distDir), 'utf8'));
const serviceWorkerPath = new URL('service-worker.js', distDir);
const serviceWorkerTemplate = await readFile(serviceWorkerPath, 'utf8');
const precacheManifest = Object.freeze((await collectDistFiles(distDir)).sort());
if (!serviceWorkerTemplate.includes('__ILLUSTRO_BUILD_SHA__')) {
  throw new Error('service worker build SHA placeholder is missing');
}
if (!serviceWorkerTemplate.includes('__ILLUSTRO_PRECACHE_MANIFEST__')) {
  throw new Error('service worker precache manifest placeholder is missing');
}
const serviceWorker = serviceWorkerTemplate
  .replaceAll('__ILLUSTRO_BUILD_SHA__', JSON.stringify(buildInfo.buildSha))
  .replaceAll('__ILLUSTRO_PRECACHE_MANIFEST__', JSON.stringify(precacheManifest, null, 2));
await writeFile(serviceWorkerPath, serviceWorker, 'utf8');

console.log(
  JSON.stringify({
    event: 'build.complete',
    mode,
    buildSha: buildInfo.buildSha,
    serviceWorkerPrecacheEntries: precacheManifest.length,
  }),
);
