import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const DIST_ROOT = new URL('../../dist/', import.meta.url);
const sha256 = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');

interface SampledDescriptor {
  alias: string;
  kind: 'brush-tip' | 'grain' | 'pattern';
  subtype: 'grain' | 'paper' | null;
  payloadPath: string;
  contentHash: string;
  byteLength: number;
}

describe('M6A-071 production sampled resource distribution', () => {
  it('publishes the canonical 77-resource manifest and every verified payload', async () => {
    const manifest = JSON.parse(
      await readFile(new URL('assets/sampled/manifest.json', DIST_ROOT), 'utf8'),
    ) as {
      packageFileName: string;
      packageSha256: string;
      sourceManifestSha256: string;
      resources: SampledDescriptor[];
    };
    expect(manifest.packageFileName).toBe('ILLUSTRO_I_FINAL_PRODUCTION_ASSETS_2026-09-04.zip');
    expect(manifest.packageSha256).toBe('7ba886fd15e22fcce3d6b0ae0004c85eb8370626346a00cff3d40c0955ad2eec');
    expect(manifest.sourceManifestSha256).toBe('97d44976ab0e87b8f3ae5538afa8f5c809b7497a6c060559d74902e0cfaa1355');
    expect(manifest.resources).toHaveLength(77);
    expect(manifest.resources.filter((item) => item.kind === 'brush-tip')).toHaveLength(33);
    expect(manifest.resources.filter((item) => item.kind === 'grain')).toHaveLength(32);
    expect(manifest.resources.filter((item) => item.subtype === 'paper')).toHaveLength(12);
    expect(manifest.resources.filter((item) => item.kind === 'pattern')).toHaveLength(12);

    for (const item of manifest.resources) {
      const relativePath = item.payloadPath.replace(/^\.\//, '');
      const bytes = new Uint8Array(await readFile(new URL(relativePath, DIST_ROOT)));
      expect(bytes.byteLength, item.alias).toBe(item.byteLength);
      expect(sha256(bytes), item.alias).toBe(item.contentHash);
    }

    const qa = JSON.parse(
      await readFile(new URL('assets/sampled/qa-report.json', DIST_ROOT), 'utf8'),
    ) as { maximumSameKindCorrelation: number; maximumSeamScore: number; exactDuplicateGroups: number };
    expect(qa.exactDuplicateGroups).toBe(0);
    expect(qa.maximumSameKindCorrelation).toBeLessThanOrEqual(0.995);
    expect(qa.maximumSeamScore).toBeLessThanOrEqual(0.12);
  });
});
