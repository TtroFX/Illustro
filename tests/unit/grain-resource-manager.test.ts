import { describe, expect, it } from 'vitest';
import {
  type BuiltinSampledResourceDescriptorV1,
  type BuiltinSampledResourceLoaderV1,
} from '../../src/app/builtin-sampled-resource-loader.js';
import {
  createGrainResourceManagerV1,
  FINAL_BRUSH_GRAIN_COUNT_V1,
} from '../../src/app/grain-resource-manager.js';
import { BUILTIN_BRUSH_GRAIN_RESOURCES_V1 } from '../../src/domain/brush-schema.js';

function hash(index: number): string {
  return index.toString(16).padStart(64, '0');
}

function grainDescriptors(): readonly BuiltinSampledResourceDescriptorV1[] {
  return BUILTIN_BRUSH_GRAIN_RESOURCES_V1.map((resource, index) => ({
    alias: resource.id,
    kind: 'grain' as const,
    subtype: 'grain' as const,
    payloadPath: `assets/sampled/grains/fixture-${String(index + 1).padStart(2, '0')}.png`,
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

describe('M6A-073 grain resource manager', () => {
  it('owns exactly the frozen 20 non-paper grain descriptors in canonical manifest order', () => {
    const resources = grainDescriptors();
    const manager = createGrainResourceManagerV1(fakeLoader(resources), resources);
    expect(FINAL_BRUSH_GRAIN_COUNT_V1).toBe(20);
    expect(manager.descriptors()).toHaveLength(20);
    expect(manager.descriptors().map((resource) => resource.alias)).toEqual(
      resources.map((resource) => resource.alias),
    );
    expect(manager.snapshot()).toEqual({
      schema: 'illustro.grain-resource-manager-state/1',
      resourceCount: 20,
      loadedResourceCount: 0,
    });
  });

  it('delegates verified lazy payload loading and tracks loaded grain identities', async () => {
    const resources = grainDescriptors();
    const loaded: string[] = [];
    const manager = createGrainResourceManagerV1(
      fakeLoader(resources, (alias) => loaded.push(alias)),
      resources,
    );
    const target = resources[7];
    expect(target).toBeDefined();
    if (target === undefined) return;
    const result = await manager.load(target.alias);
    expect(result.descriptor).toBe(target);
    expect([...result.bytes]).toEqual([target.byteLength]);
    result.bytes[0] = 0;
    expect(manager.snapshot().loadedResourceCount).toBe(1);
    expect(loaded).toEqual([target.alias]);
  });

  it('fails closed for paper and unrelated aliases without touching the loader', async () => {
    const resources = grainDescriptors();
    let loadCount = 0;
    const manager = createGrainResourceManagerV1(
      fakeLoader(resources, () => {
        loadCount += 1;
      }),
      resources,
    );
    await expect(manager.load('builtin.grain.paper.01')).rejects.toThrow(/unknown built-in grain/);
    await expect(manager.load('builtin.tip.fixture.01')).rejects.toThrow(/unknown built-in grain/);
    expect(loadCount).toBe(0);
  });

  it('rejects incomplete inventories, alias drift, subtype drift, and loader descriptor drift', () => {
    const resources = grainDescriptors();
    expect(() =>
      createGrainResourceManagerV1(fakeLoader(resources.slice(0, 19)), resources.slice(0, 19)),
    ).toThrow(/exactly 20/);

    const first = resources[0];
    expect(first).toBeDefined();
    if (first === undefined) return;

    const aliasDrift = [...resources];
    aliasDrift[0] = { ...first, alias: 'builtin.grain.paper.01' };
    expect(() => createGrainResourceManagerV1(fakeLoader(aliasDrift), aliasDrift)).toThrow(
      /unknown canonical brush grain resource alias/,
    );

    const subtypeDrift = [...resources];
    subtypeDrift[0] = { ...first, subtype: 'paper' };
    expect(() => createGrainResourceManagerV1(fakeLoader(subtypeDrift), subtypeDrift)).toThrow(
      /exactly 20/,
    );

    const loaderResources = [...resources];
    loaderResources[0] = { ...first, contentHash: hash(999) };
    expect(() => createGrainResourceManagerV1(fakeLoader(loaderResources), resources)).toThrow(
      /loader descriptor mismatch/,
    );
  });
});
