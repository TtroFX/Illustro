import { describe, expect, it } from 'vitest';
import {
  BUILTIN_BRUSH_GRAIN_RESOURCES_V1,
  BUILTIN_BRUSH_PAPER_RESOURCES_V1,
} from '../../src/domain/brush-schema.js';
import {
  createFinalBuiltinSampledResourceLoaderV1,
  FINAL_SAMPLED_RESOURCE_COUNT_V1,
  FINAL_SAMPLED_RESOURCE_PACKAGE_FILENAME_V1,
  FINAL_SAMPLED_RESOURCE_PACKAGE_SHA256_V1,
  FINAL_SAMPLED_RESOURCE_SOURCE_MANIFEST_SHA256_V1,
  parseFinalBuiltinSampledResourceManifestV1,
  type BuiltinSampledResourceDescriptorV1,
} from '../../src/app/builtin-sampled-resource-loader.js';

function hash(index: number): string {
  return index.toString(16).padStart(64, '0');
}

function descriptors(): BuiltinSampledResourceDescriptorV1[] {
  let index = 1;
  const make = (
    alias: string,
    kind: BuiltinSampledResourceDescriptorV1['kind'],
    subtype: BuiltinSampledResourceDescriptorV1['subtype'],
  ): BuiltinSampledResourceDescriptorV1 => {
    const current = index;
    index += 1;
    return {
      alias,
      kind,
      subtype,
      payloadPath: `assets/illustro-i-final/${alias}.png`,
      contentHash: hash(current),
      byteLength: current,
      mimeType: 'image/png',
    };
  };
  return [
    ...Array.from({ length: 33 }, (_, item) =>
      make(`builtin.tip.fixture.${String(item + 1).padStart(2, '0')}`, 'brush-tip', null),
    ),
    ...BUILTIN_BRUSH_GRAIN_RESOURCES_V1.map((resource) => make(resource.id, 'grain', 'grain')),
    ...BUILTIN_BRUSH_PAPER_RESOURCES_V1.map((resource) => make(resource.id, 'grain', 'paper')),
    ...Array.from({ length: 12 }, (_, item) =>
      make(`builtin.pattern.fixture.${String(item + 1).padStart(2, '0')}`, 'pattern', null),
    ),
  ];
}

function manifest(resources = descriptors()) {
  return {
    schema: 'illustro.builtin-sampled-resources/1',
    packageFileName: FINAL_SAMPLED_RESOURCE_PACKAGE_FILENAME_V1,
    packageSha256: FINAL_SAMPLED_RESOURCE_PACKAGE_SHA256_V1,
    sourceManifestSha256: FINAL_SAMPLED_RESOURCE_SOURCE_MANIFEST_SHA256_V1,
    resources,
  };
}

describe('M6A-071 final sampled-resource loader checkpoint', () => {
  it('pins the accepted I-FINAL package identity and exact 33/32/12 inventory', () => {
    const parsed = parseFinalBuiltinSampledResourceManifestV1(manifest());
    expect(parsed.resources).toHaveLength(FINAL_SAMPLED_RESOURCE_COUNT_V1);
    expect(parsed.packageFileName).toBe('ILLUSTRO_I_FINAL_PRODUCTION_ASSETS_2026-08-30.zip');
    expect(parsed.packageSha256).toBe(
      'c23ccd51d37e6081c21c0961102d1d320e0d6a6e67c9ea97eaaf4828f65ec0f2',
    );
    expect(parsed.sourceManifestSha256).toBe(
      '5db86732c5e8b250599e74b0c85a0474272d48998e0d1863240a40d4d2ff1776',
    );
    expect(parsed.resources.filter((resource) => resource.kind === 'brush-tip')).toHaveLength(33);
    expect(parsed.resources.filter((resource) => resource.kind === 'grain')).toHaveLength(32);
    expect(parsed.resources.filter((resource) => resource.subtype === 'paper')).toHaveLength(12);
    expect(parsed.resources.filter((resource) => resource.kind === 'pattern')).toHaveLength(12);
  });

  it('fails closed when the frozen grain/paper alias inventory is incomplete', () => {
    const resources = descriptors();
    const targetIndex = resources.findIndex(
      (resource) => resource.alias === 'builtin.grain.fine.01',
    );
    expect(targetIndex).toBeGreaterThanOrEqual(0);
    const target = resources[targetIndex];
    if (target === undefined) return;
    resources[targetIndex] = { ...target, alias: 'builtin.grain.unapproved.01' };
    expect(() => parseFinalBuiltinSampledResourceManifestV1(manifest(resources))).toThrow(
      /grain aliases/,
    );
  });

  it('rejects duplicate payload hashes instead of accepting an exact duplicate asset', () => {
    const resources = descriptors();
    const first = resources[0];
    const second = resources[1];
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    if (first === undefined || second === undefined) return;
    resources[1] = { ...second, contentHash: first.contentHash };
    expect(() => parseFinalBuiltinSampledResourceManifestV1(manifest(resources))).toThrow(
      /duplicate sampled resource content hash/,
    );
  });

  it('loads lazily, validates byte length/hash, and caches only verified payloads', async () => {
    const resources = descriptors();
    const target = resources[0];
    expect(target).toBeDefined();
    if (target === undefined) return;
    resources[0] = { ...target, byteLength: 3, contentHash: hash(999) };
    const configuredTarget = resources[0];
    if (configuredTarget === undefined) return;
    let fetchCount = 0;
    const loader = createFinalBuiltinSampledResourceLoaderV1(
      manifest(resources),
      async () => {
        fetchCount += 1;
        return new Uint8Array([1, 2, 3]);
      },
      async () => hash(999),
    );
    expect(loader.snapshot()).toMatchObject({ resourceCount: 77, cachedResourceCount: 0 });
    const first = await loader.load(configuredTarget.alias);
    const second = await loader.load(configuredTarget.alias);
    expect([...first.bytes]).toEqual([1, 2, 3]);
    expect([...second.bytes]).toEqual([1, 2, 3]);
    expect(fetchCount).toBe(1);
    expect(loader.snapshot().cachedResourceCount).toBe(1);
  });

  it('does not cache a payload whose digest differs from the frozen descriptor', async () => {
    const resources = descriptors();
    const target = resources[0];
    expect(target).toBeDefined();
    if (target === undefined) return;
    resources[0] = { ...target, byteLength: 1 };
    const configuredTarget = resources[0];
    if (configuredTarget === undefined) return;
    const loader = createFinalBuiltinSampledResourceLoaderV1(
      manifest(resources),
      async () => new Uint8Array([7]),
      async () => hash(12345),
    );
    await expect(loader.load(configuredTarget.alias)).rejects.toThrow(/SHA-256 mismatch/);
    expect(loader.snapshot().cachedResourceCount).toBe(0);
  });
});
