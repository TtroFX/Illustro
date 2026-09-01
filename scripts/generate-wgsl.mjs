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

function typescriptStringLiteral(value) {
  let escaped = '';
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    if (character === '\\') escaped += '\\\\';
    else if (character === "'") escaped += "\\'";
    else if (character === '\n') escaped += '\\n';
    else if (character === '\r') escaped += '\\r';
    else if (character === '\t') escaped += '\\t';
    else if (character === '\b') escaped += '\\b';
    else if (character === '\f') escaped += '\\f';
    else if (
      codePoint !== undefined &&
      (codePoint < 0x20 || codePoint === 0x2028 || codePoint === 0x2029)
    ) {
      escaped += `\\u${codePoint.toString(16).padStart(4, '0')}`;
    } else escaped += character;
  }
  return `'${escaped}'`;
}

await mkdir(new URL('../src/generated/', import.meta.url), { recursive: true });

for (const shader of shaders) {
  const input = new URL(shader.sourcePath, import.meta.url);
  const output = new URL(shader.outputPath, import.meta.url);
  const source = await readFile(input, 'utf8');
  if (!shader.validate(source)) throw new Error(shader.errorMessage);
  await writeFile(
    output,
    `// Generated from ${shader.sourcePath.replace('../src/', 'src/')}. Do not edit.\nexport const ${shader.exportName} =\n  ${typescriptStringLiteral(source)};\n`,
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
