import { mkdir, readFile, writeFile } from 'node:fs/promises';

const shaders = [
  {
    sourcePath: '../src/gpu/shaders/bootstrap.wgsl',
    outputPath: '../src/generated/bootstrap-shader.ts',
    exportName: 'bootstrapShaderSource',
    validate(source) {
      return source.includes('@compute') && source.includes('@workgroup_size');
    },
    errorMessage: 'bootstrap WGSL must contain a compute entry point',
  },
  {
    sourcePath: '../src/gpu/shaders/baseline-brush.wgsl',
    outputPath: '../src/generated/baseline-brush-shader.ts',
    exportName: 'baselineBrushShaderSource',
    validate(source) {
      return (
        source.includes('@vertex') &&
        source.includes('@fragment') &&
        source.includes('baseline_brush_vertex') &&
        source.includes('baseline_brush_fragment')
      );
    },
    errorMessage: 'baseline brush WGSL must contain the production vertex/fragment entry points',
  },
];

await mkdir(new URL('../src/generated/', import.meta.url), { recursive: true });

for (const shader of shaders) {
  const input = new URL(shader.sourcePath, import.meta.url);
  const output = new URL(shader.outputPath, import.meta.url);
  const source = await readFile(input, 'utf8');
  if (!shader.validate(source)) throw new Error(shader.errorMessage);
  await writeFile(
    output,
    `// Generated from ${shader.sourcePath.replace('../src/', 'src/')}. Do not edit.\nexport const ${shader.exportName} = ${JSON.stringify(source)};\n`,
    'utf8',
  );
  console.log(
    JSON.stringify({
      event: 'wgsl.generated',
      source: shader.sourcePath,
      bytes: Buffer.byteLength(source),
    }),
  );
}
