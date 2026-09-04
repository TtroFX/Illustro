import { describe, expect, it } from 'vitest';
import {
  FINAL_SAMPLED_PATTERN_COUNT_V1,
  type BuiltinSampledResourceDescriptorV1,
  type BuiltinSampledResourceLoaderV1,
} from '../../src/app/builtin-sampled-resource-loader.js';
import {
  createPatternResourceManagerV1,
  FINAL_BUILTIN_PATTERN_RESOURCE_ALIASES_V1,
} from '../../src/app/pattern-resource-manager.js';

function hash(index: number): string {
  return index.toString(16).padStart(64, '0');
}

function patternDescriptors(): readonly BuiltinSampledResourceDescriptorV1[] {
  return FINAL_BUILTIN_PATTERN_RESOURCE_ALIASES_V1.map((alias, index) => ({
    alias,
    kind: 'pattern' as const,
    subtype: null,
    payloadPath: `assets/sampled/patterns/fixture-${String(index + 1).padStart(2, '0')}.png`,
    contentHash: hash(index + 1),
    byteLength: index + 1,
    mimeType: 'image/png',
  }));
}

function fakeLoader(
  resources: readonly BuiltinSampledResourceDescriptorV1[],
  onLoad?: (alias: string) => void,
): BuiltinSampledResourceLoaderV1 {
  const descriptors = new Map(resources.map((resource) => [resource.alias, resource] as const));
  return Object.freeze({
    schema: 'illustro.builtin-sampled-resource-loader/1' as const,
    has(alias: string): boolean {
      return descriptors.has(alias);
    },
    descriptor(alias: string): BuiltinSampledResourceDescriptorV1 | null {
      return descriptors.get(alias) ?? null;
    },
    async load(alias: string) {
      onLoad?.(alias);
      const descriptor = descriptors.get(alias);
      if (descriptor === undefined) throw new RangeError(`unknown fixture resource: ${alias}`);
      return Object.freeze({
        descriptor,
        bytes: new Uint8Array([descriptor.byteLength & 0xff]),
      });
    },
    snapshot() {
      return Object.freeze({
        schema: 'illustro.builtin-sampled-resource-loader-state/1' as const,
        resourceCount: descriptors.size,
        cachedResourceCount: 0,
      });
    },
  });
}

describe('M6A-075 pattern resource manager', () => {
  it('owns exactly the frozen 12 pattern descriptors in canonical manifest order', () => {
    const resources = patternDescriptors();
    const manager = createPatternResourceManagerV1(fakeLoader(resources), resources);
    expect(FINAL_SAMPLED_PATTERN_COUNT_V1).toBe(12);
    expect(FINAL_BUILTIN_PATTERN_RESOURCE_ALIASES_V1).toEqual([
      'builtin.pattern.geometric.01',
      'builtin.pattern.geometric.02',
      'builtin.pattern.geometric.03',
      'builtin.pattern.geometric.04',
      'builtin.pattern.organic.01',
      'builtin.pattern.organic.02',
      'builtin.pattern.organic.03',
      'builtin.pattern.organic.04',
      'builtin.pattern.texture.01',
      'builtin.pattern.texture.02',
      'builtin.pattern.texture.03',
      'builtin.pattern.texture.04',
    ]);
    expect(manager.descriptors()).toHaveLength(12);
    expect(manager.descriptors().map((resource) => resource.alias)).toEqual(
      resources.map((resource) => resource.alias),
    );
    expect(manager.snapshot()).toEqual({
      schema: 'illustro.pattern-resource-manager-state/1',
      resourceCount: 12,
      loadedResourceCount: 0,
    });
  });

  it('delegates verified lazy payload loading and tracks loaded pattern identities', async () => {
    const resources = patternDescriptors();
    const loaded: string[] = [];
    const manager = createPatternResourceManagerV1(
      fakeLoader(resources, (alias) => loaded.push(alias)),
      resources,
    );
    const target = resources[9];
    expect(target).toBeDefined();
    if (target === undefined) return;
    const result = await manager.load(target.alias);
    expect(result.descriptor).toBe(target);
    expect([...result.bytes]).toEqual([target.byteLength]);
    result.bytes[0] = 0;
    expect(manager.snapshot().loadedResourceCount).toBe(1);
    expect(loaded).toEqual([target.alias]);
  });

  it('fails closed for grain, paper, and brush-tip aliases without touching the loader', async () => {
    const resources = patternDescriptors();
    let loadCount = 0;
    const manager = createPatternResourceManagerV1(
      fakeLoader(resources, () => {
        loadCount += 1;
      }),
      resources,
    );
    await expect(manager.load('builtin.grain.fine.01')).rejects.toThrow(/unknown built-in pattern/);
    await expect(manager.load('builtin.grain.paper.01')).rejects.toThrow(
      /unknown built-in pattern/,
    );
    await expect(manager.load('builtin.tip.ink.06')).rejects.toThrow(/unknown built-in pattern/);
    expect(loadCount).toBe(0);
  });

  it('rejects incomplete inventories, alias drift, subtype drift, and loader descriptor drift', () => {
    const resources = patternDescriptors();
    expect(() =>
      createPatternResourceManagerV1(fakeLoader(resources.slice(0, 11)), resources.slice(0, 11)),
    ).toThrow(/exactly 12/);

    const first = resources[0];
    expect(first).toBeDefined();
    if (first === undefined) return;

    const aliasDrift = [...resources];
    aliasDrift[0] = { ...first, alias: 'builtin.pattern.unfrozen.01' };
    expect(() => createPatternResourceManagerV1(fakeLoader(aliasDrift), aliasDrift)).toThrow(
      /unknown canonical pattern resource alias/,
    );

    const subtypeDrift = [...resources];
    subtypeDrift[0] = { ...first, subtype: 'paper' };
    expect(() => createPatternResourceManagerV1(fakeLoader(subtypeDrift), subtypeDrift)).toThrow(
      /must not declare a subtype/,
    );

    const loaderResources = [...resources];
    loaderResources[0] = { ...first, contentHash: hash(999) };
    expect(() => createPatternResourceManagerV1(fakeLoader(loaderResources), resources)).toThrow(
      /loader descriptor mismatch/,
    );
  });
});
