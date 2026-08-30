import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
for (const script of ['format', 'format:check', 'lint', 'typecheck', 'test:unit', 'test:integration']) {
  assert.equal(typeof packageJson.scripts?.[script], 'string', `missing npm script: ${script}`);
}

assert.equal(packageJson.devDependencies?.['@biomejs/biome'], '2.5.11');
assert.equal(packageJson.devDependencies?.vitest, '4.1.10');

const lock = JSON.parse(await readFile(new URL('../package-lock.json', import.meta.url), 'utf8'));
assert.equal(lock.lockfileVersion, 3);
assert.equal(lock.packages?.['']?.devDependencies?.['@biomejs/biome'], '2.5.11');
assert.equal(lock.packages?.['']?.devDependencies?.vitest, '4.1.10');

await access(new URL('../biome.json', import.meta.url));
await access(new URL('../vitest.config.ts', import.meta.url));
await access(new URL('../tests/unit/logger.test.ts', import.meta.url));
await access(new URL('../tests/integration/build-output.test.ts', import.meta.url));
await access(new URL('../.github/workflows/ci.yml', import.meta.url));

console.log(JSON.stringify({ event: 'verify.m0-batch4.pass', lockfileVersion: lock.lockfileVersion }));
