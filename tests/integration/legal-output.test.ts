import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('legal and provenance build output', () => {
  it('ships the generated FI-6 legal data from one provenance path', async () => {
    const [license, notice, thirdParty, bomText, offlineText] = await Promise.all([
      readFile(new URL('../../dist/legal/LICENSE', import.meta.url), 'utf8'),
      readFile(new URL('../../dist/legal/NOTICE', import.meta.url), 'utf8'),
      readFile(new URL('../../dist/legal/THIRD_PARTY_NOTICES.md', import.meta.url), 'utf8'),
      readFile(new URL('../../dist/legal/bom.cdx.json', import.meta.url), 'utf8'),
      readFile(new URL('../../dist/legal/open-source-licenses.json', import.meta.url), 'utf8'),
    ]);

    expect(license).toContain('Apache License');
    expect(notice).toContain('Illustro');
    expect(thirdParty).toContain('third_party/provenance.json');

    const bom = JSON.parse(bomText) as { bomFormat: string; specVersion: string };
    expect(bom.bomFormat).toBe('CycloneDX');
    expect(bom.specVersion).toBe('1.7');

    const offline = JSON.parse(offlineText) as { generatedFrom: string; components: unknown[] };
    expect(offline.generatedFrom).toBe('third_party/provenance.json');
    expect(Array.isArray(offline.components)).toBe(true);
  });
});
