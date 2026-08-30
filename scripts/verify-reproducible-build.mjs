import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const dist = new URL('dist/', root);

function resolveSha() {
  if (process.env.ILLUSTRO_BUILD_SHA) return process.env.ILLUSTRO_BUILD_SHA.trim();
  return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
}

function runBuild(buildSha) {
  const result = spawnSync(process.execPath, ['scripts/build.mjs', 'production'], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, ILLUSTRO_BUILD_MODE: 'production', ILLUSTRO_BUILD_SHA: buildSha },
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

async function hashDirectory(directory) {
  const hash = createHash('sha256');

  async function visit(current, prefix) {
    const entries = await readdir(current, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      const url = new URL(entry.isDirectory() ? `${entry.name}/` : entry.name, current);
      if (entry.isDirectory()) await visit(url, relative);
      else {
        hash.update(relative);
        hash.update('\0');
        hash.update(await readFile(url));
        hash.update('\0');
      }
    }
  }

  await visit(directory, '');
  return hash.digest('hex');
}

const buildSha = resolveSha();
runBuild(buildSha);
const firstDigest = await hashDirectory(dist);
runBuild(buildSha);
const secondDigest = await hashDirectory(dist);
assert.equal(
  secondDigest,
  firstDigest,
  'production dist must be reproducible for a fixed commit SHA',
);

const buildInfo = JSON.parse(await readFile(new URL('dist/build-info.json', root), 'utf8'));
assert.equal(buildInfo.buildSha, buildSha);
assert.equal(buildInfo.buildMode, 'production');

console.log(
  JSON.stringify({ event: 'verify.reproducible-build.pass', buildSha, distSha256: secondDigest }),
);
