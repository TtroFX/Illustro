import {
  createFinalBuiltinSampledResourceLoaderV1,
  fetchFinalBuiltinSampledResourceManifestV1,
  FINAL_SAMPLED_GRAIN_COUNT_V1,
  FINAL_SAMPLED_PAPER_COUNT_V1,
  FINAL_SAMPLED_RESOURCE_MANIFEST_URL_V1,
  type BuiltinSampledResourceDescriptorV1,
  type BuiltinSampledResourceLoaderV1,
  type LoadedBuiltinSampledResourceV1,
} from './builtin-sampled-resource-loader.js';
import { BUILTIN_BRUSH_GRAIN_RESOURCES_V1 } from '../domain/brush-schema.js';

export const FINAL_BRUSH_GRAIN_COUNT_V1 =
  FINAL_SAMPLED_GRAIN_COUNT_V1 - FINAL_SAMPLED_PAPER_COUNT_V1;

export interface GrainResourceManagerSnapshotV1 {
  readonly schema: 'illustro.grain-resource-manager-state/1';
  readonly resourceCount: number;
  readonly loadedResourceCount: number;
}

export interface GrainResourceManagerV1 {
  readonly schema: 'illustro.grain-resource-manager/1';
  descriptors(): readonly BuiltinSampledResourceDescriptorV1[];
  has(alias: string): boolean;
  descriptor(alias: string): BuiltinSampledResourceDescriptorV1 | null;
  load(alias: string): Promise<LoadedBuiltinSampledResourceV1>;
  snapshot(): GrainResourceManagerSnapshotV1;
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

export function createGrainResourceManagerV1(
  loader: BuiltinSampledResourceLoaderV1,
  resources: readonly BuiltinSampledResourceDescriptorV1[],
): GrainResourceManagerV1 {
  const expectedAliases = new Set(BUILTIN_BRUSH_GRAIN_RESOURCES_V1.map((resource) => resource.id));
  if (expectedAliases.size !== FINAL_BRUSH_GRAIN_COUNT_V1) {
    throw new RangeError(
      `canonical brush grain inventory must contain exactly ${FINAL_BRUSH_GRAIN_COUNT_V1} resources`,
    );
  }

  const grains = resources.filter(
    (resource) => resource.kind === 'grain' && resource.subtype === 'grain',
  );
  if (grains.length !== FINAL_BRUSH_GRAIN_COUNT_V1) {
    throw new RangeError(
      `grain resource manager requires exactly ${FINAL_BRUSH_GRAIN_COUNT_V1} resources`,
    );
  }

  const descriptors = new Map<string, BuiltinSampledResourceDescriptorV1>();
  for (const resource of grains) {
    if (!expectedAliases.has(resource.alias)) {
      throw new TypeError(`unknown canonical brush grain resource alias: ${resource.alias}`);
    }
    if (descriptors.has(resource.alias)) {
      throw new TypeError(`duplicate grain resource alias: ${resource.alias}`);
    }
    const loaderDescriptor = loader.descriptor(resource.alias);
    if (loaderDescriptor === null || !descriptorsMatch(resource, loaderDescriptor)) {
      throw new TypeError(`grain resource loader descriptor mismatch: ${resource.alias}`);
    }
    descriptors.set(resource.alias, resource);
  }
  for (const alias of expectedAliases) {
    if (!descriptors.has(alias)) {
      throw new TypeError(`missing canonical brush grain resource alias: ${alias}`);
    }
  }

  const orderedDescriptors = Object.freeze([...descriptors.values()]);
  const loadedAliases = new Set<string>();

  const descriptor = (alias: string): BuiltinSampledResourceDescriptorV1 | null =>
    descriptors.get(alias) ?? null;

  return Object.freeze({
    schema: 'illustro.grain-resource-manager/1' as const,
    descriptors(): readonly BuiltinSampledResourceDescriptorV1[] {
      return orderedDescriptors;
    },
    has(alias: string): boolean {
      return descriptors.has(alias);
    },
    descriptor,
    async load(alias: string): Promise<LoadedBuiltinSampledResourceV1> {
      const expected = descriptor(alias);
      if (expected === null) throw new RangeError(`unknown built-in grain resource: ${alias}`);
      const loaded = await loader.load(alias);
      if (!descriptorsMatch(expected, loaded.descriptor)) {
        throw new Error(`loaded grain resource descriptor mismatch: ${alias}`);
      }
      loadedAliases.add(alias);
      return Object.freeze({ descriptor: expected, bytes: loaded.bytes.slice() });
    },
    snapshot(): GrainResourceManagerSnapshotV1 {
      return Object.freeze({
        schema: 'illustro.grain-resource-manager-state/1' as const,
        resourceCount: orderedDescriptors.length,
        loadedResourceCount: loadedAliases.size,
      });
    },
  });
}

export async function createProductionGrainResourceManagerV1(): Promise<GrainResourceManagerV1> {
  const manifest = await fetchFinalBuiltinSampledResourceManifestV1(
    FINAL_SAMPLED_RESOURCE_MANIFEST_URL_V1,
  );
  const loader = createFinalBuiltinSampledResourceLoaderV1(manifest);
  return createGrainResourceManagerV1(loader, manifest.resources);
}

let productionGrainResourceManagerPromise: Promise<GrainResourceManagerV1> | null = null;

export function startProductionGrainResourceManagerV1(): Promise<GrainResourceManagerV1> {
  if (productionGrainResourceManagerPromise === null) {
    productionGrainResourceManagerPromise = createProductionGrainResourceManagerV1();
  }
  return productionGrainResourceManagerPromise;
}

export function getProductionGrainResourceManagerV1(): Promise<GrainResourceManagerV1> | null {
  return productionGrainResourceManagerPromise;
}
