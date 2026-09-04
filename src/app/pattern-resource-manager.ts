import {
  createFinalBuiltinSampledResourceLoaderV1,
  fetchFinalBuiltinSampledResourceManifestV1,
  FINAL_SAMPLED_PATTERN_COUNT_V1,
  FINAL_SAMPLED_RESOURCE_MANIFEST_URL_V1,
  type BuiltinSampledResourceDescriptorV1,
  type BuiltinSampledResourceLoaderV1,
  type LoadedBuiltinSampledResourceV1,
} from './builtin-sampled-resource-loader.js';

export const FINAL_BUILTIN_PATTERN_RESOURCE_ALIASES_V1: readonly string[] = Object.freeze([
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

export interface PatternResourceManagerSnapshotV1 {
  readonly schema: 'illustro.pattern-resource-manager-state/1';
  readonly resourceCount: number;
  readonly loadedResourceCount: number;
}

export interface PatternResourceManagerV1 {
  readonly schema: 'illustro.pattern-resource-manager/1';
  descriptors(): readonly BuiltinSampledResourceDescriptorV1[];
  has(alias: string): boolean;
  descriptor(alias: string): BuiltinSampledResourceDescriptorV1 | null;
  load(alias: string): Promise<LoadedBuiltinSampledResourceV1>;
  snapshot(): PatternResourceManagerSnapshotV1;
}

function descriptorsMatch(
  expected: BuiltinSampledResourceDescriptorV1,
  actual: BuiltinSampledResourceDescriptorV1,
): boolean {
  return (
    expected.alias === actual.alias &&
    expected.kind === actual.kind &&
    expected.subtype === actual.subtype &&
    expected.payloadPath === actual.payloadPath &&
    expected.contentHash === actual.contentHash &&
    expected.byteLength === actual.byteLength &&
    expected.mimeType === actual.mimeType
  );
}

export function createPatternResourceManagerV1(
  loader: BuiltinSampledResourceLoaderV1,
  resources: readonly BuiltinSampledResourceDescriptorV1[],
): PatternResourceManagerV1 {
  const expectedAliases = new Set(FINAL_BUILTIN_PATTERN_RESOURCE_ALIASES_V1);
  if (expectedAliases.size !== FINAL_SAMPLED_PATTERN_COUNT_V1) {
    throw new RangeError(
      `canonical pattern inventory must contain exactly ${FINAL_SAMPLED_PATTERN_COUNT_V1} resources`,
    );
  }

  const patterns = resources.filter((resource) => resource.kind === 'pattern');
  if (patterns.length !== FINAL_SAMPLED_PATTERN_COUNT_V1) {
    throw new RangeError(
      `pattern resource manager requires exactly ${FINAL_SAMPLED_PATTERN_COUNT_V1} resources`,
    );
  }

  const descriptors = new Map<string, BuiltinSampledResourceDescriptorV1>();
  for (const resource of patterns) {
    if (resource.subtype !== null) {
      throw new TypeError(`pattern resource must not declare a subtype: ${resource.alias}`);
    }
    if (!expectedAliases.has(resource.alias)) {
      throw new TypeError(`unknown canonical pattern resource alias: ${resource.alias}`);
    }
    if (descriptors.has(resource.alias)) {
      throw new TypeError(`duplicate pattern resource alias: ${resource.alias}`);
    }
    const loaderDescriptor = loader.descriptor(resource.alias);
    if (loaderDescriptor === null || !descriptorsMatch(resource, loaderDescriptor)) {
      throw new TypeError(`pattern resource loader descriptor mismatch: ${resource.alias}`);
    }
    descriptors.set(resource.alias, resource);
  }
  for (const alias of expectedAliases) {
    if (!descriptors.has(alias)) {
      throw new TypeError(`missing canonical pattern resource alias: ${alias}`);
    }
  }

  const orderedDescriptors = Object.freeze([...descriptors.values()]);
  const loadedAliases = new Set<string>();

  const descriptor = (alias: string): BuiltinSampledResourceDescriptorV1 | null =>
    descriptors.get(alias) ?? null;

  return Object.freeze({
    schema: 'illustro.pattern-resource-manager/1' as const,
    descriptors(): readonly BuiltinSampledResourceDescriptorV1[] {
      return orderedDescriptors;
    },
    has(alias: string): boolean {
      return descriptors.has(alias);
    },
    descriptor,
    async load(alias: string): Promise<LoadedBuiltinSampledResourceV1> {
      const expected = descriptor(alias);
      if (expected === null) throw new RangeError(`unknown built-in pattern resource: ${alias}`);
      const loaded = await loader.load(alias);
      if (!descriptorsMatch(expected, loaded.descriptor)) {
        throw new Error(`loaded pattern resource descriptor mismatch: ${alias}`);
      }
      loadedAliases.add(alias);
      return Object.freeze({ descriptor: expected, bytes: loaded.bytes.slice() });
    },
    snapshot(): PatternResourceManagerSnapshotV1 {
      return Object.freeze({
        schema: 'illustro.pattern-resource-manager-state/1' as const,
        resourceCount: orderedDescriptors.length,
        loadedResourceCount: loadedAliases.size,
      });
    },
  });
}

export async function createProductionPatternResourceManagerV1(): Promise<PatternResourceManagerV1> {
  const manifest = await fetchFinalBuiltinSampledResourceManifestV1(
    FINAL_SAMPLED_RESOURCE_MANIFEST_URL_V1,
  );
  const loader = createFinalBuiltinSampledResourceLoaderV1(manifest);
  return createPatternResourceManagerV1(loader, manifest.resources);
}

let productionPatternResourceManagerPromise: Promise<PatternResourceManagerV1> | null = null;

export function startProductionPatternResourceManagerV1(): Promise<PatternResourceManagerV1> {
  if (productionPatternResourceManagerPromise === null) {
    productionPatternResourceManagerPromise = createProductionPatternResourceManagerV1();
  }
  return productionPatternResourceManagerPromise;
}

export function getProductionPatternResourceManagerV1(): Promise<PatternResourceManagerV1> | null {
  return productionPatternResourceManagerPromise;
}
