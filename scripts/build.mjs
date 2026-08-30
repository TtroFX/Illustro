import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const mode = process.argv[2] ?? 'production';
if (mode !== 'production' && mode !== 'development') {
  throw new Error(`unknown build mode: ${mode}`);
}

const buildDir = new URL('../.build/', import.meta.url);
const distDir = new URL('../dist/', import.meta.url);
const publicDir = new URL('../public/', import.meta.url);

await rm(buildDir, { recursive: true, force: true });
await rm(distDir, { recursive: true, force: true });
await mkdir(distDir, { recursive: true });

const generator = spawnSync(process.execPath, ['scripts/generate-wgsl.mjs'], { stdio: 'inherit' });
if (generator.status !== 0) process.exit(generator.status ?? 1);

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
  await cp(new URL(`${entry.name}${suffix}`, publicDir), new URL(`${entry.name}${suffix}`, distDir), {
    recursive: true,
  });
}

const template = await readFile(new URL('../src/index.html', import.meta.url), 'utf8');
const html = template.replaceAll('__ILLUSTRO_BUILD_MODE__', mode);
await writeFile(new URL('index.html', distDir), html, 'utf8');

console.log(JSON.stringify({ event: 'build.complete', mode }));
