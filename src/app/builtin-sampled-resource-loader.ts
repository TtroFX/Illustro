import {
  BUILTIN_BRUSH_GRAIN_RESOURCES_V1,
  BUILTIN_BRUSH_PAPER_RESOURCES_V1,
} from '../domain/brush-schema.js';
import { isSha256Hex } from '../domain/resources.js';

export const FINAL_SAMPLED_RESOURCE_PACKAGE_FILENAME_V1 =
  'ILLUSTRO_I_FINAL_PRODUCTION_ASSETS_2026-09-04.zip' as const;
export const FINAL_SAMPLED_RESOURCE_PACKAGE_SHA256_V1 =
  '7ba886fd15e22fcce3d6b0ae0004c85eb8370626346a00cff3d40c0955ad2eec' as const;
export const FINAL_SAMPLED_RESOURCE_SOURCE_MANIFEST_SHA256_V1 =
  '97d44976ab0e87b8f3ae5538afa8f5c809b7497a6c060559d74902e0cfaa1355' as const;
export const FINAL_SAMPLED_RESOURCE_MANIFEST_URL_V1 = './assets/sampled/manifest.json' as const;
export const FINAL_SAMPLED_RESOURCE_COUNT_V1 = 77 as const;
export const FINAL_SAMPLED_BRUSH_TIP_COUNT_V1 = 33 as const;
export const FINAL_SAMPLED_GRAIN_COUNT_V1 = 32 as const;
export const FINAL_SAMPLED_PAPER_COUNT_V1 = 12 as const;
export const FINAL_SAMPLED_PATTERN_COUNT_V1 = 12 as const;

export type BuiltinSampledResourceKindV1 = 'brush-tip' | 'grain' | 'pattern';
export type BuiltinSampledResourceSubtypeV1 = 'grain' | 'paper' | null;

export interface BuiltinSampledResourceDescriptorV1 {
  readonly alias: string;
  readonly kind: BuiltinSampledResourceKindV1;
  readonly subtype: BuiltinSampledResourceSubtypeV1;
  readonly payloadPath: string;
  readonly contentHash: string;
  readonly byteLength: number;
  readonly mimeType: string;
}

export interface FinalBuiltinSampledResourceManifestV1 {
  readonly schema: 'illustro.builtin-sampled-resources/1';
  readonly packageFileName: typeof FINAL_SAMPLED_RESOURCE_PACKAGE_FILENAME_V1;
  readonly packageSha256: typeof FINAL_SAMPLED_RESOURCE_PACKAGE_SHA256_V1;
  readonly sourceManifestSha256: typeof FINAL_SAMPLED_RESOURCE_SOURCE_MANIFEST_SHA256_V1;
  readonly resources: readonly BuiltinSampledResourceDescriptorV1[];
}

export interface LoadedBuiltinSampledResourceV1 {
  readonly descriptor: BuiltinSampledResourceDescriptorV1;
  readonly bytes: Uint8Array;
}

export interface BuiltinSampledResourceLoaderSnapshotV1 {
  readonly schema: 'illustro.builtin-sampled-resource-loader-state/1';
  readonly resourceCount: number;
  readonly cachedResourceCount: number;
}

export interface BuiltinSampledResourceLoaderV1 {
  readonly schema: 'illustro.builtin-sampled-resource-loader/1';
  has(alias: string): boolean;
  descriptor(alias: string): BuiltinSampledResourceDescriptorV1 | null;
  load(alias: string): Promise<LoadedBuiltinSampledResourceV1>;
  snapshot(): BuiltinSampledResourceLoaderSnapshotV1;
}

export type BuiltinSampledResourceFetchV1 = (payloadPath: string) => Promise<Uint8Array>;
export type BuiltinSampledResourceDigestV1 = (bytes: Uint8Array) => Promise<string>;

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0)
    throw new TypeError(`${label} must be a non-empty string`);
  return value;
}

function requireAlias(value: unknown): string {
  const alias = requireString(value, 'sampled resource alias');
  if (!/^builtin\.[a-z0-9.-]+$/i.test(alias)) {
    throw new TypeError('sampled resource alias must use the builtin.* namespace');
  }
  return alias;
}

function requireKind(value: unknown): BuiltinSampledResourceKindV1 {
  if (value === 'brush-tip' || value === 'grain' || value === 'pattern') return value;
  throw new TypeError('sampled resource kind must be brush-tip, grain, or pattern');
}

function requireSubtype(
  value: unknown,
  kind: BuiltinSampledResourceKindV1,
): BuiltinSampledResourceSubtypeV1 {
  if (kind !== 'grain') {
    if (value === null || value === undefined) return null;
    throw new TypeError('only grain resources may declare a sampled-resource subtype');
  }
  if (value === 'grain' || value === 'paper') return value;
  throw new TypeError('grain sampled resources must declare grain or paper subtype');
}

function requirePayloadPath(value: unknown): string {
  const path = requireString(value, 'sampled resource payloadPath');
  if (
    path.startsWith('/') ||
    path.includes('\\') ||
    path.includes('://') ||
    path.split('/').some((segment) => segment === '..' || segment === '')
  ) {
    throw new TypeError('sampled resource payloadPath must be a safe relative path');
  }
  return path;
}

function parseDescriptor(value: unknown): BuiltinSampledResourceDescriptorV1 {
  if (!isRecord(value)) throw new TypeError('sampled resource descriptor must be an object');
  const kind = requireKind(value.kind);
  const contentHash = requireString(value.contentHash, 'sampled resource contentHash');
  if (!isSha256Hex(contentHash)) {
    throw new TypeError('sampled resource contentHash must be lowercase SHA-256 hex');
  }
  const byteLength = value.byteLength;
  if (typeof byteLength !== 'number' || !Number.isSafeInteger(byteLength) || byteLength <= 0) {
    throw new RangeError('sampled resource byteLength must be a positive safe integer');
  }
  const mimeType = requireString(value.mimeType, 'sampled resource mimeType');
  return Object.freeze({
    alias: requireAlias(value.alias),
    kind,
    subtype: requireSubtype(value.subtype, kind),
    payloadPath: requirePayloadPath(value.payloadPath),
    contentHash,
    byteLength,
    mimeType,
  });
}

function expectedGrainAliases(): ReadonlySet<string> {
  return new Set([
    ...BUILTIN_BRUSH_GRAIN_RESOURCES_V1.map((resource) => resource.id),
    ...BUILTIN_BRUSH_PAPER_RESOURCES_V1.map((resource) => resource.id),
  ]);
}

export function parseFinalBuiltinSampledResourceManifestV1(
  value: unknown,
): FinalBuiltinSampledResourceManifestV1 {
  if (!isRecord(value)) throw new TypeError('final sampled-resource manifest must be an object');
  if (value.schema !== 'illustro.builtin-sampled-resources/1') {
    throw new TypeError('unsupported final sampled-resource manifest schema');
  }
  if (value.packageFileName !== FINAL_SAMPLED_RESOURCE_PACKAGE_FILENAME_V1) {
    throw new TypeError('final sampled-resource package filename mismatch');
  }
  if (value.packageSha256 !== FINAL_SAMPLED_RESOURCE_PACKAGE_SHA256_V1) {
    throw new TypeError('final sampled-resource package SHA-256 mismatch');
  }
  if (value.sourceManifestSha256 !== FINAL_SAMPLED_RESOURCE_SOURCE_MANIFEST_SHA256_V1) {
    throw new TypeError('final sampled-resource source-manifest SHA-256 mismatch');
  }
  if (!Array.isArray(value.resources))
    throw new TypeError('final sampled-resource resources must be an array');
  const resources = Object.freeze(value.resources.map(parseDescriptor));
  if (resources.length !== FINAL_SAMPLED_RESOURCE_COUNT_V1) {
    throw new RangeError(
      `final sampled-resource manifest must contain exactly ${FINAL_SAMPLED_RESOURCE_COUNT_V1} resources`,
    );
  }

  const aliases = new Set<string>();
  const payloadPaths = new Set<string>();
  const contentHashes = new Set<string>();
  const counts = { brushTip: 0, grain: 0, paper: 0, pattern: 0 };
  for (const resource of resources) {
    if (aliases.has(resource.alias))
      throw new TypeError(`duplicate sampled resource alias: ${resource.alias}`);
    if (payloadPaths.has(resource.payloadPath)) {
      throw new TypeError(`duplicate sampled resource payload path: ${resource.payloadPath}`);
    }
    if (contentHashes.has(resource.contentHash)) {
      throw new TypeError(`duplicate sampled resource content hash: ${resource.contentHash}`);
    }
    aliases.add(resource.alias);
    payloadPaths.add(resource.payloadPath);
    contentHashes.add(resource.contentHash);
    if (resource.kind === 'brush-tip') counts.brushTip += 1;
    if (resource.kind === 'pattern') counts.pattern += 1;
    if (resource.kind === 'grain') {
      counts.grain += 1;
      if (resource.subtype === 'paper') counts.paper += 1;
    }
  }
  if (
    counts.brushTip !== FINAL_SAMPLED_BRUSH_TIP_COUNT_V1 ||
    counts.grain !== FINAL_SAMPLED_GRAIN_COUNT_V1 ||
    counts.paper !== FINAL_SAMPLED_PAPER_COUNT_V1 ||
    counts.pattern !== FINAL_SAMPLED_PATTERN_COUNT_V1
  ) {
    throw new RangeError('final sampled-resource kind/subtype inventory mismatch');
  }

  const actualGrainAliases = new Set(
    resources.filter((resource) => resource.kind === 'grain').map((resource) => resource.alias),
  );
  const canonicalGrainAliases = expectedGrainAliases();
  if (
    actualGrainAliases.size !== canonicalGrainAliases.size ||
    [...canonicalGrainAliases].some((alias) => !actualGrainAliases.has(alias))
  ) {
    throw new TypeError(
      'final sampled-resource grain aliases do not match the frozen M6A selection identities',
    );
  }

  return Object.freeze({
    schema: 'illustro.builtin-sampled-resources/1' as const,
    packageFileName: FINAL_SAMPLED_RESOURCE_PACKAGE_FILENAME_V1,
    packageSha256: FINAL_SAMPLED_RESOURCE_PACKAGE_SHA256_V1,
    sourceManifestSha256: FINAL_SAMPLED_RESOURCE_SOURCE_MANIFEST_SHA256_V1,
    resources,
  });
}

export async function sha256HexBytesV1(bytes: Uint8Array): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes.slice().buffer);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
}

export async function fetchBuiltinSampledResourceBytesV1(payloadPath: string): Promise<Uint8Array> {
  const response = await fetch(payloadPath);
  if (!response.ok)
    throw new Error(`sampled resource fetch failed: ${response.status} ${payloadPath}`);
  return new Uint8Array(await response.arrayBuffer());
}

export type BuiltinSampledResourceManifestFetchV1 = (url: string) => Promise<unknown>;

async function fetchBuiltinSampledResourceManifestValueV1(url: string): Promise<unknown> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`sampled resource manifest fetch failed: ${response.status} ${url}`);
  }
  return response.json() as Promise<unknown>;
}

export async function fetchFinalBuiltinSampledResourceManifestV1(
  manifestUrl: string = FINAL_SAMPLED_RESOURCE_MANIFEST_URL_V1,
  fetchManifest: BuiltinSampledResourceManifestFetchV1 = fetchBuiltinSampledResourceManifestValueV1,
): Promise<FinalBuiltinSampledResourceManifestV1> {
  return parseFinalBuiltinSampledResourceManifestV1(await fetchManifest(manifestUrl));
}

export async function createProductionFinalBuiltinSampledResourceLoaderV1(
  manifestUrl: string = FINAL_SAMPLED_RESOURCE_MANIFEST_URL_V1,
  fetchManifest: BuiltinSampledResourceManifestFetchV1 = fetchBuiltinSampledResourceManifestValueV1,
  fetchPayload: BuiltinSampledResourceFetchV1 = fetchBuiltinSampledResourceBytesV1,
  digest: BuiltinSampledResourceDigestV1 = sha256HexBytesV1,
): Promise<BuiltinSampledResourceLoaderV1> {
  const manifest = await fetchFinalBuiltinSampledResourceManifestV1(manifestUrl, fetchManifest);
  return createFinalBuiltinSampledResourceLoaderV1(manifest, fetchPayload, digest);
}

export function createFinalBuiltinSampledResourceLoaderV1(
  manifestValue: unknown,
  fetchPayload: BuiltinSampledResourceFetchV1 = fetchBuiltinSampledResourceBytesV1,
  digest: BuiltinSampledResourceDigestV1 = sha256HexBytesV1,
): BuiltinSampledResourceLoaderV1 {
  const manifest = parseFinalBuiltinSampledResourceManifestV1(manifestValue);
  const descriptors = new Map(
    manifest.resources.map((resource) => [resource.alias, resource] as const),
  );
  const cache = new Map<string, Uint8Array>();

  const descriptor = (alias: string): BuiltinSampledResourceDescriptorV1 | null =>
    descriptors.get(alias) ?? null;

  return Object.freeze({
    schema: 'illustro.builtin-sampled-resource-loader/1' as const,
    has(alias: string): boolean {
      return descriptors.has(alias);
    },
    descriptor,
    async load(alias: string): Promise<LoadedBuiltinSampledResourceV1> {
      const resource = descriptor(alias);
      if (resource === null) throw new RangeError(`unknown built-in sampled resource: ${alias}`);
      const cached = cache.get(alias);
      if (cached !== undefined)
        return Object.freeze({ descriptor: resource, bytes: cached.slice() });
      const bytes = await fetchPayload(resource.payloadPath);
      if (bytes.byteLength !== resource.byteLength) {
        throw new Error(`sampled resource byte length mismatch: ${alias}`);
      }
      const actualHash = await digest(bytes);
      if (actualHash !== resource.contentHash) {
        throw new Error(`sampled resource SHA-256 mismatch: ${alias}`);
      }
      cache.set(alias, bytes.slice());
      return Object.freeze({ descriptor: resource, bytes: bytes.slice() });
    },
    snapshot(): BuiltinSampledResourceLoaderSnapshotV1 {
      return Object.freeze({
        schema: 'illustro.builtin-sampled-resource-loader-state/1' as const,
        resourceCount: descriptors.size,
        cachedResourceCount: cache.size,
      });
    },
  });
}
