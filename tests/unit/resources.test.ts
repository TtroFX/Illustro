import { describe, expect, it } from 'vitest';
import {
  createProvenanceV1,
  createResourceV1,
  isSha256Hex,
} from '../../src/domain/resources.js';
import { isUuid } from '../../src/domain/identity.js';
import {
  BRUSH_SCHEMA_VERSION,
  BRUSH_V1_SCHEMA,
  ILLBRUSH_PACKAGE_VERSION,
  isSupportedBrushSchema,
} from '../../src/domain/brush-schema.js';

describe('resource provenance contract', () => {
  it('creates a content-addressed resource with explicit provenance', () => {
    const provenance = createProvenanceV1({
      sourceClass: 'third-party',
      sourceName: 'Example source',
      sourceUrl: 'https://example.test/source',
      version: '1.2.3',
      license: 'Apache-2.0',
      attributionRequired: true,
      noticeRequired: true,
      reuseMode: 'direct-reuse',
      modificationNotes: 'Normalized for Illustro.',
    });
    const resource = createResourceV1({
      kind: 'brush-tip',
      contentHash: 'a'.repeat(64),
      mimeType: 'image/png',
      byteLength: 1024,
      provenance,
      dimensions: { width: 64, height: 64, channels: 1 },
      colorSpace: 'data',
      channelSemantics: 'coverage',
      seamless: false,
    });

    expect(isUuid(resource.resourceId)).toBe(true);
    expect(resource.provenance).toBe(provenance);
    expect(isSha256Hex(resource.contentHash)).toBe(true);
    expect(resource).toMatchObject({ revision: 0, kind: 'brush-tip', byteLength: 1024 });
  });

  it('rejects non-lowercase or malformed content hashes', () => {
    const provenance = createProvenanceV1({ sourceClass: 'user-created' });
    expect(() =>
      createResourceV1({
        kind: 'other',
        contentHash: 'A'.repeat(64),
        mimeType: 'application/octet-stream',
        byteLength: 0,
        provenance,
      }),
    ).toThrow(TypeError);
  });
});

describe('brush schema identity', () => {
  it('pins native brush and package version identifiers', () => {
    expect(BRUSH_V1_SCHEMA).toBe('illustro.brush/1');
    expect(BRUSH_SCHEMA_VERSION).toBe(1);
    expect(ILLBRUSH_PACKAGE_VERSION).toBe('1.0');
    expect(isSupportedBrushSchema('illustro.brush/1')).toBe(true);
    expect(isSupportedBrushSchema('illustro.brush/2')).toBe(false);
  });
});
