import { describe, expect, it } from 'vitest';
import {
  FINAL_SAMPLED_BRUSH_TIP_COUNT_V1,
  type BuiltinSampledResourceDescriptorV1,
  type BuiltinSampledResourceLoaderV1,
} from '../../src/app/builtin-sampled-resource-loader.js';
import { createBrushTipResourceManagerV1 } from '../../src/app/brush-tip-resource-manager.js';

function hash(index: number): string {
  return index.toString(16).padStart(64, '0');
}

function brushTipDescriptors(): readonly BuiltinSampledResourceDescriptorV1[] {
  return Array.from({ length: FINAL_SAMPLED_BRUSH_TIP_COUNT_V1 }, (_, index) => ({
    alias: `builtin.tip.fixture.${String(index + 1).padStart(2, '0')}`,
    kind: 'brush-tip' as const,
    subtype: null,
    payloadPath: `./assets/sampled/tips/fixture-${String(index + 1).padStart(2, '0')}.png`,
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

describe('M6A-072 brush-tip resource manager', () => {
  it('owns exactly the frozen 33 brush-tip descriptors in canonical order', () => {
    const resources = brushTipDescriptors();
    const manager = createBrushTipResourceManagerV1(fakeLoader(resources), resources);
    expect(manager.descriptors()).toHaveLength(33);
    expect(manager.descriptors().map((resource) => resource.alias)).toEqual(
      resources.map((resource) => resource.alias),
    );
    expect(manager.snapshot()).toEqual({
      schema: 'illustro.brush-tip-resource-manager-state/1',
      resourceCount: 33,
      loadedResourceCount: 0,
    });
  });

  it('delegates verified lazy payload loading and tracks loaded brush-tip identities', async () => {
    const resources = brushTipDescriptors();
    const loaded: string[] = [];
    const manager = createBrushTipResourceManagerV1(
      fakeLoader(resources, (alias) => loaded.push(alias)),
      resources,
    );
    const target = resources[4];
    expect(target).toBeDefined();
    if (target === undefined) return;
    const result = await manager.load(target.alias);
    expect(result.descriptor).toBe(target);
    expect([...result.bytes]).toEqual([target.byteLength]);
    result.bytes[0] = 0;
    expect(manager.snapshot().loadedResourceCount).toBe(1);
    expect(loaded).toEqual([target.alias]);
  });

  it('fails closed for aliases outside the brush-tip inventory without touching the loader', async () => {
    const resources = brushTipDescriptors();
    let loadCount = 0;
    const manager = createBrushTipResourceManagerV1(
      fakeLoader(resources, () => {
        loadCount += 1;
      }),
      resources,
    );
    await expect(manager.load('builtin.grain.fine.01')).rejects.toThrow(
      /unknown built-in brush-tip/,
    );
    expect(loadCount).toBe(0);
  });

  it('rejects incomplete inventories and loader descriptor drift', () => {
    const resources = brushTipDescriptors();
    expect(() =>
      createBrushTipResourceManagerV1(fakeLoader(resources.slice(0, 32)), resources.slice(0, 32)),
    ).toThrow(/exactly 33/);

    const drifted = [...resources];
    const first = drifted[0];
    expect(first).toBeDefined();
    if (first === undefined) return;
    const loaderResources = [...resources];
    loaderResources[0] = { ...first, contentHash: hash(999) };
    expect(() => createBrushTipResourceManagerV1(fakeLoader(loaderResources), drifted)).toThrow(
      /loader descriptor mismatch/,
    );
  });
});
