import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';

function resolveBuildSha() {
  const explicit = process.env.ILLUSTRO_BUILD_SHA || process.env.GITHUB_SHA;
  if (explicit) return explicit.trim();

  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

const buildMode = process.env.ILLUSTRO_BUILD_MODE === 'production' ? 'production' : 'development';
const buildInfo = Object.freeze({
  buildSha: resolveBuildSha(),
  buildMode,
});

await mkdir(new URL('../src/generated/', import.meta.url), { recursive: true });
await mkdir(new URL('../.build/meta/', import.meta.url), { recursive: true });

const source = `export const buildIdentity = Object.freeze(${JSON.stringify(buildInfo, null, 2)} as const);\nexport type BuildIdentity = typeof buildIdentity;\n`;
await writeFile(new URL('../src/generated/build-info.ts', import.meta.url), source, 'utf8');
await writeFile(
  new URL('../.build/meta/build-info.json', import.meta.url),
  `${JSON.stringify(buildInfo, null, 2)}\n`,
  'utf8',
);

console.log(JSON.stringify({ event: 'build-info.generated', ...buildInfo }));
