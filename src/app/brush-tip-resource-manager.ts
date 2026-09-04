import {
  createFinalBuiltinSampledResourceLoaderV1,
  fetchFinalBuiltinSampledResourceManifestV1,
  FINAL_SAMPLED_BRUSH_TIP_COUNT_V1,
  FINAL_SAMPLED_RESOURCE_MANIFEST_URL_V1,
  type BuiltinSampledResourceDescriptorV1,
  type BuiltinSampledResourceLoaderV1,
  type LoadedBuiltinSampledResourceV1,
} from './builtin-sampled-resource-loader.js';

export interface BrushTipResourceManagerSnapshotV1 {
  readonly schema: 'illustro.brush-tip-resource-manager-state/1';
  readonly resourceCount: number;
  readonly loadedResourceCount: number;
}

export interface BrushTipResourceManagerV1 {
  readonly schema: 'illustro.brush-tip-resource-manager/1';
  descriptors(): readonly BuiltinSampledResourceDescriptorV1[];
  has(alias: string): boolean;
  descriptor(alias: string): BuiltinSampledResourceDescriptorV1 | null;
  load(alias: string): Promise<LoadedBuiltinSampledResourceV1>;
  snapshot(): BrushTipResourceManagerSnapshotV1;
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

export function createBrushTipResourceManagerV1(
  loader: BuiltinSampledResourceLoaderV1,
  resources: readonly BuiltinSampledResourceDescriptorV1[],
): BrushTipResourceManagerV1 {
  const brushTips = resources.filter((resource) => resource.kind === 'brush-tip');
  if (brushTips.length !== FINAL_SAMPLED_BRUSH_TIP_COUNT_V1) {
    throw new RangeError(
      `brush-tip resource manager requires exactly ${FINAL_SAMPLED_BRUSH_TIP_COUNT_V1} resources`,
    );
  }

  const descriptors = new Map<string, BuiltinSampledResourceDescriptorV1>();
  for (const resource of brushTips) {
    if (resource.subtype !== null) {
      throw new TypeError(`brush-tip resource must not declare a subtype: ${resource.alias}`);
    }
    if (descriptors.has(resource.alias)) {
      throw new TypeError(`duplicate brush-tip resource alias: ${resource.alias}`);
    }
    const loaderDescriptor = loader.descriptor(resource.alias);
    if (loaderDescriptor === null || !descriptorsMatch(resource, loaderDescriptor)) {
      throw new TypeError(`brush-tip resource loader descriptor mismatch: ${resource.alias}`);
    }
    descriptors.set(resource.alias, resource);
  }

  const orderedDescriptors = Object.freeze([...descriptors.values()]);
  const loadedAliases = new Set<string>();

  const descriptor = (alias: string): BuiltinSampledResourceDescriptorV1 | null =>
    descriptors.get(alias) ?? null;

  return Object.freeze({
    schema: 'illustro.brush-tip-resource-manager/1' as const,
    descriptors(): readonly BuiltinSampledResourceDescriptorV1[] {
      return orderedDescriptors;
    },
    has(alias: string): boolean {
      return descriptors.has(alias);
    },
    descriptor,
    async load(alias: string): Promise<LoadedBuiltinSampledResourceV1> {
      const expected = descriptor(alias);
      if (expected === null) throw new RangeError(`unknown built-in brush-tip resource: ${alias}`);
      const loaded = await loader.load(alias);
      if (!descriptorsMatch(expected, loaded.descriptor)) {
        throw new Error(`loaded brush-tip resource descriptor mismatch: ${alias}`);
      }
      loadedAliases.add(alias);
      return Object.freeze({ descriptor: expected, bytes: loaded.bytes.slice() });
    },
    snapshot(): BrushTipResourceManagerSnapshotV1 {
      return Object.freeze({
        schema: 'illustro.brush-tip-resource-manager-state/1' as const,
        resourceCount: orderedDescriptors.length,
        loadedResourceCount: loadedAliases.size,
      });
    },
  });
}

export async function createProductionBrushTipResourceManagerV1(): Promise<BrushTipResourceManagerV1> {
  const manifest = await fetchFinalBuiltinSampledResourceManifestV1(
    FINAL_SAMPLED_RESOURCE_MANIFEST_URL_V1,
  );
  const loader = createFinalBuiltinSampledResourceLoaderV1(manifest);
  return createBrushTipResourceManagerV1(loader, manifest.resources);
}

let productionBrushTipResourceManagerPromise: Promise<BrushTipResourceManagerV1> | null = null;

export function startProductionBrushTipResourceManagerV1(): Promise<BrushTipResourceManagerV1> {
  if (productionBrushTipResourceManagerPromise === null) {
    productionBrushTipResourceManagerPromise = createProductionBrushTipResourceManagerV1();
  }
  return productionBrushTipResourceManagerPromise;
}

export function getProductionBrushTipResourceManagerV1(): Promise<BrushTipResourceManagerV1> | null {
  return productionBrushTipResourceManagerPromise;
}
