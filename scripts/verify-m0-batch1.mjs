import { access, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const run = (script) => {
  const result = spawnSync(npm, ['run', script], { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
};

run('typecheck');
run('build');

const shaderModule = await readFile('dist/generated/bootstrap-shader.js', 'utf8');
const gpuModule = await readFile('dist/gpu/webgpu-bootstrap.js', 'utf8');
const mainModule = await readFile('dist/app/main.js', 'utf8');
if (!shaderModule.includes('@compute') || !shaderModule.includes('@workgroup_size')) {
  throw new Error('WGSL source did not survive the production asset pipeline');
}
if (!gpuModule.includes('createShaderModule')) {
  throw new Error('WebGPU shader-module creation path is absent from production output');
}
if (!mainModule.includes('initializeWebGpuBuildPath')) {
  throw new Error('main production path is not connected to the WebGPU bootstrap');
}
await access('dist/index.html');

run('build:dev');
await access('dist/app/main.js.map');

console.log(JSON.stringify({
  event: 'm0.batch1.verify.pass',
  items: ['M0-001', 'M0-002', 'M0-003', 'M0-004', 'M0-005', 'M0-006'],
}));
