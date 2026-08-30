import { mkdir, readFile, writeFile } from 'node:fs/promises';

const input = new URL('../src/gpu/shaders/bootstrap.wgsl', import.meta.url);
const output = new URL('../src/generated/bootstrap-shader.ts', import.meta.url);
const source = await readFile(input, 'utf8');

if (!source.includes('@compute') || !source.includes('@workgroup_size')) {
  throw new Error('bootstrap WGSL must contain a compute entry point');
}

await mkdir(new URL('../src/generated/', import.meta.url), { recursive: true });
await writeFile(
  output,
  `// Generated from src/gpu/shaders/bootstrap.wgsl. Do not edit.\nexport const bootstrapShaderSource = ${JSON.stringify(source)};\n`,
  'utf8',
);

console.log(JSON.stringify({ event: 'wgsl.generated', bytes: Buffer.byteLength(source) }));
