import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const mode = process.argv[2] ?? 'production';
if (mode !== 'production' && mode !== 'development') {
  throw new Error(`unknown build mode: ${mode}`);
}

await rm(new URL('../.build/', import.meta.url), { recursive: true, force: true });
await rm(new URL('../dist/', import.meta.url), { recursive: true, force: true });
await mkdir(new URL('../dist/', import.meta.url), { recursive: true });

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

await cp(new URL('../.build/app/', import.meta.url), new URL('../dist/', import.meta.url), { recursive: true });
const html = await readFile(new URL('../src/index.html', import.meta.url), 'utf8');
await writeFile(new URL('../dist/index.html', import.meta.url), html, 'utf8');

console.log(JSON.stringify({ event: 'build.complete', mode }));
