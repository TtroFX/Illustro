from pathlib import Path

source = r'''import {
  BUILTIN_BRUSH_GRAIN_RESOURCES_V1,
  BUILTIN_BRUSH_PAPER_RESOURCES_V1,
} from '../domain/brush-schema.js';
import { isSha256Hex } from '../domain/resources.js';

export const FINAL_SAMPLED_RESOURCE_PACKAGE_FILENAME_V1 =
  'ILLUSTRO_I_FINAL_PRODUCTION_ASSETS_2026-08-30.zip' as const;
export const FINAL_SAMPLED_RESOURCE_PACKAGE_SHA256_V1 =
  'c23ccd51d37e6081c21c0961102d1d320e0d6a6e67c9ea97eaaf4828f65ec0f2' as const;
export const FINAL_SAMPLED_RESOURCE_SOURCE_MANIFEST_SHA256_V1 =
  '5db86732c5e8b250599e74b0c85a0474272d48998e0d1863240a40d4d2ff1776' as const;
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
  if (typeof value !== 'string' || value.length === 0) throw new TypeError(`${label} must be a non-empty string`);
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
  if (!Number.isSafeInteger(byteLength) || (byteLength as number) <= 0) {
    throw new RangeError('sampled resource byteLength must be a positive safe integer');
  }
  const mimeType = requireString(value.mimeType, 'sampled resource mimeType');
  return Object.freeze({
    alias: requireAlias(value.alias),
    kind,
    subtype: requireSubtype(value.subtype, kind),
    payloadPath: requirePayloadPath(value.payloadPath),
    contentHash,
    byteLength: byteLength as number,
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
  if (!Array.isArray(value.resources)) throw new TypeError('final sampled-resource resources must be an array');
  const resources = Object.freeze(value.resources.map(parseDescriptor));
  if (resources.length !== FINAL_SAMPLED_RESOURCE_COUNT_V1) {
    throw new RangeError(`final sampled-resource manifest must contain exactly ${FINAL_SAMPLED_RESOURCE_COUNT_V1} resources`);
  }

  const aliases = new Set<string>();
  const payloadPaths = new Set<string>();
  const contentHashes = new Set<string>();
  const counts = { brushTip: 0, grain: 0, paper: 0, pattern: 0 };
  for (const resource of resources) {
    if (aliases.has(resource.alias)) throw new TypeError(`duplicate sampled resource alias: ${resource.alias}`);
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
    throw new TypeError('final sampled-resource grain aliases do not match the frozen M6A selection identities');
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
  if (!response.ok) throw new Error(`sampled resource fetch failed: ${response.status} ${payloadPath}`);
  return new Uint8Array(await response.arrayBuffer());
}

export function createFinalBuiltinSampledResourceLoaderV1(
  manifestValue: unknown,
  fetchPayload: BuiltinSampledResourceFetchV1 = fetchBuiltinSampledResourceBytesV1,
  digest: BuiltinSampledResourceDigestV1 = sha256HexBytesV1,
): BuiltinSampledResourceLoaderV1 {
  const manifest = parseFinalBuiltinSampledResourceManifestV1(manifestValue);
  const descriptors = new Map(manifest.resources.map((resource) => [resource.alias, resource] as const));
  const cache = new Map<string, Uint8Array>();

  const descriptor = (alias: string): BuiltinSampledResourceDescriptorV1 | null => descriptors.get(alias) ?? null;

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
      if (cached !== undefined) return Object.freeze({ descriptor: resource, bytes: cached.slice() });
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
'''

test = r'''import { describe, expect, it } from 'vitest';
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
    expect(parsed.packageSha256).toBe('c23ccd51d37e6081c21c0961102d1d320e0d6a6e67c9ea97eaaf4828f65ec0f2');
    expect(parsed.sourceManifestSha256).toBe('5db86732c5e8b250599e74b0c85a0474272d48998e0d1863240a40d4d2ff1776');
    expect(parsed.resources.filter((resource) => resource.kind === 'brush-tip')).toHaveLength(33);
    expect(parsed.resources.filter((resource) => resource.kind === 'grain')).toHaveLength(32);
    expect(parsed.resources.filter((resource) => resource.subtype === 'paper')).toHaveLength(12);
    expect(parsed.resources.filter((resource) => resource.kind === 'pattern')).toHaveLength(12);
  });

  it('fails closed when the frozen grain/paper alias inventory is incomplete', () => {
    const resources = descriptors();
    const target = resources.find((resource) => resource.alias === 'builtin.grain.fine.01');
    expect(target).toBeDefined();
    if (target === undefined) return;
    target.alias = 'builtin.grain.unapproved.01';
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
    second.contentHash = first.contentHash;
    expect(() => parseFinalBuiltinSampledResourceManifestV1(manifest(resources))).toThrow(
      /duplicate sampled resource content hash/,
    );
  });

  it('loads lazily, validates byte length/hash, and caches only verified payloads', async () => {
    const resources = descriptors();
    const target = resources[0];
    expect(target).toBeDefined();
    if (target === undefined) return;
    target.byteLength = 3;
    target.contentHash = hash(999);
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
    const first = await loader.load(target.alias);
    const second = await loader.load(target.alias);
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
    target.byteLength = 1;
    const loader = createFinalBuiltinSampledResourceLoaderV1(
      manifest(resources),
      async () => new Uint8Array([7]),
      async () => hash(12345),
    );
    await expect(loader.load(target.alias)).rejects.toThrow(/SHA-256 mismatch/);
    expect(loader.snapshot().cachedResourceCount).toBe(0);
  });
});
'''

Path('src/app/builtin-sampled-resource-loader.ts').write_text(source, encoding='utf-8')
Path('tests/unit/builtin-sampled-resource-loader.test.ts').write_text(test, encoding='utf-8')

progress_path = Path('IMPLEMENTATION_PROGRESS.md')
progress = progress_path.read_text(encoding='utf-8')
anchor = 'M6A-071 final 77 sampled resources loader:未完了\n'
note = (
    'M6A-071 final 77 sampled resources loader:未完了\n'
    '再開メモ: M6A-071 checkpointとしてI-FINAL正本package名・ZIP SHA-256・source manifest SHA-256・33 brush-tip / 32 grain（うちpaper 12）/ 12 patternの77件inventoryを固定し、stable grain/paper alias整合・重複hash/path拒否・safe relative payload path・lazy fetch・byteLength/SHA-256検証・verified-only cacheを行うfail-closed loader coreを追加した。accepted本体 `ILLUSTRO_I_FINAL_PRODUCTION_ASSETS_2026-08-30.zip` は設計時sandbox生成物で、現在のGit/File Library/Driveにはclosure report/summaryのみ残りpayload bytesが無いため、凍結hashと異なる代替assetは生成せず本項目は未完了を維持する。正本ZIP再投入後はoriginal manifest→normalized loader manifest adapterと実payload配置を接続してM6A-071を閉じる。M6A-072以降はM6A-071完了後に進める。\n'
)
if progress.count(anchor) != 1:
    raise RuntimeError('expected exactly one M6A-071 progress anchor')
progress_path.write_text(progress.replace(anchor, note, 1), encoding='utf-8')
