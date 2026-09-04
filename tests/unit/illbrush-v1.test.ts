import { describe, expect, it } from 'vitest';
import { createBaselineBrushPresetV1 } from '../../src/domain/brush-schema.js';
import { createProvenanceV1, createResourceV1 } from '../../src/domain/resources.js';
import {
  ILLBRUSH_BRUSH_PATH_V1,
  ILLBRUSH_MANIFEST_PATH_V1,
  parseIllbrushPackageV1,
  writeIllbrushPackageV1,
} from '../../src/interchange/illbrush-v1.js';
import { readZipEntriesV1, writeStoredZipV1 } from '../../src/interchange/zip-v1.js';

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes.slice().buffer);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
}

function fixtureBrush() {
  return createBaselineBrushPresetV1({
    id: 'user.fixture.illbrush',
    name: 'Illbrush Fixture',
    category: 'Test',
    behavior: 'paint',
    defaultSizePx: 23,
    tags: ['native', 'round-trip'],
  });
}

describe('M6B-001/M6B-002 native .illbrush package', () => {
  it('round-trips the canonical BrushPresetV1 through manifest.json and brush.json', async () => {
    const brush = fixtureBrush();
    const archive = await writeIllbrushPackageV1({ brush });
    const parsed = await parseIllbrushPackageV1(archive);

    expect(parsed.brush).toEqual(brush);
    expect(parsed.manifest.brushPath).toBe(ILLBRUSH_BRUSH_PATH_V1);
    expect(parsed.manifest.entries).toHaveLength(1);
    expect(parsed.manifest.entries[0]).toMatchObject({
      path: ILLBRUSH_BRUSH_PATH_V1,
      role: 'brush',
      mimeType: 'application/json',
    });
    expect(parsed.resources).toEqual([]);
    expect(parsed.preview).toBeNull();
  });

  it('round-trips content-addressed ResourceV1 payloads with SHA-256 validation', async () => {
    const bytes = new Uint8Array([4, 8, 15, 16, 23, 42]);
    const descriptor = createResourceV1({
      kind: 'grain',
      contentHash: await sha256Hex(bytes),
      mimeType: 'application/octet-stream',
      byteLength: bytes.byteLength,
      provenance: createProvenanceV1({
        sourceClass: 'user-created',
        sourceName: 'Unit fixture',
        license: 'user-owned',
        reuseMode: 'user-supplied',
      }),
    });
    const archive = await writeIllbrushPackageV1({
      brush: fixtureBrush(),
      resources: [{ descriptor, bytes }],
    });
    const parsed = await parseIllbrushPackageV1(archive);

    expect(parsed.resources).toHaveLength(1);
    expect(parsed.resources[0]?.descriptor).toEqual(descriptor);
    expect([...parsed.resources[0]!.bytes]).toEqual([...bytes]);
    expect(parsed.manifest.entries.find((entry) => entry.role === 'resource')).toMatchObject({
      path: `resources/${descriptor.contentHash}`,
      sha256: descriptor.contentHash,
      byteLength: bytes.byteLength,
    });
  });

  it('writes deterministic ZIP bytes for identical canonical input', async () => {
    const brush = fixtureBrush();
    const first = await writeIllbrushPackageV1({ brush });
    const second = await writeIllbrushPackageV1({ brush });

    expect([...second]).toEqual([...first]);
  });

  it('rejects undeclared package entries so an archive cannot smuggle executable content', async () => {
    const archive = await writeIllbrushPackageV1({ brush: fixtureBrush() });
    const entries = await readZipEntriesV1(archive);
    const withScript = writeStoredZipV1([
      ...entries,
      { path: 'payload.js', bytes: new TextEncoder().encode('globalThis.compromised = true;') },
    ]);

    await expect(parseIllbrushPackageV1(withScript)).rejects.toThrow('undeclared entry');
  });

  it('rejects a resource whose package bytes no longer match the manifest SHA-256', async () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const descriptor = createResourceV1({
      kind: 'brush-tip',
      contentHash: await sha256Hex(bytes),
      mimeType: 'application/octet-stream',
      byteLength: bytes.byteLength,
      provenance: createProvenanceV1({ sourceClass: 'user-created' }),
    });
    const archive = await writeIllbrushPackageV1({
      brush: fixtureBrush(),
      resources: [{ descriptor, bytes }],
    });
    const entries = await readZipEntriesV1(archive);
    const tampered = entries.map((entry) =>
      entry.path.startsWith('resources/')
        ? { path: entry.path, bytes: new Uint8Array([9, 9, 9, 9]) }
        : entry,
    );

    await expect(parseIllbrushPackageV1(writeStoredZipV1(tampered))).rejects.toThrow(
      'entry hash mismatch',
    );
  });

  it('requires the canonical manifest and brush paths', async () => {
    const archive = writeStoredZipV1([
      { path: ILLBRUSH_MANIFEST_PATH_V1, bytes: new TextEncoder().encode('{}') },
    ]);
    await expect(parseIllbrushPackageV1(archive)).rejects.toThrow();

    expect(() => writeStoredZipV1([{ path: '../brush.json', bytes: new Uint8Array([1]) }])).toThrow(
      'unsafe',
    );
  });
});
