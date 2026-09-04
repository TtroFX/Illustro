import {
  ILLBRUSH_MIME_TYPE,
  ILLBRUSH_PACKAGE_VERSION,
  normalizeBrushPresetV1,
  type BrushPresetV1,
} from '../domain/brush-schema.js';
import { parseResourceId, parseRevision } from '../domain/identity.js';
import {
  isSha256Hex,
  type ProvenanceV1,
  type ResourceChannelSemanticsV1,
  type ResourceColorSpaceV1,
  type ResourceKindV1,
  type ResourceV1,
} from '../domain/resources.js';
import { assertSafeArchivePathV1, readZipEntriesV1, writeStoredZipV1 } from './zip-v1.js';

export const ILLBRUSH_MANIFEST_SCHEMA_V1 = 'illustro.illbrush-manifest/1' as const;
export const ILLBRUSH_MANIFEST_PATH_V1 = 'manifest.json' as const;
export const ILLBRUSH_BRUSH_PATH_V1 = 'brush.json' as const;
export const ILLBRUSH_JSON_BYTE_LIMIT_V1 = 2 * 1024 * 1024;

export type IllbrushEntryRoleV1 = 'brush' | 'resource' | 'preview';

export interface IllbrushManifestEntryV1 {
  readonly path: string;
  readonly role: IllbrushEntryRoleV1;
  readonly sha256: string;
  readonly byteLength: number;
  readonly mimeType: string;
  readonly resource?: ResourceV1;
}

export interface IllbrushManifestV1 {
  readonly schema: typeof ILLBRUSH_MANIFEST_SCHEMA_V1;
  readonly packageVersion: typeof ILLBRUSH_PACKAGE_VERSION;
  readonly mimeType: typeof ILLBRUSH_MIME_TYPE;
  readonly brushPath: typeof ILLBRUSH_BRUSH_PATH_V1;
  readonly entries: readonly IllbrushManifestEntryV1[];
}

export interface IllbrushResourcePayloadV1 {
  readonly descriptor: ResourceV1;
  readonly bytes: Uint8Array;
}

export interface IllbrushPreviewV1 {
  readonly path: string;
  readonly mimeType: string;
  readonly bytes: Uint8Array;
}

export interface IllbrushPackageV1 {
  readonly manifest: IllbrushManifestV1;
  readonly brush: BrushPresetV1;
  readonly resources: readonly IllbrushResourcePayloadV1[];
  readonly preview: IllbrushPreviewV1 | null;
}

export interface WriteIllbrushPackageInputV1 {
  readonly brush: BrushPresetV1;
  readonly resources?: readonly IllbrushResourcePayloadV1[];
  readonly preview?: IllbrushPreviewV1 | null;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });
const RESOURCE_KINDS = new Set<ResourceKindV1>([
  'brush-tip',
  'grain',
  'pattern',
  'imported-source',
  'other',
]);
const COLOR_SPACES = new Set<ResourceColorSpaceV1>([
  'none',
  'srgb',
  'display-p3',
  'embedded-profile',
  'data',
]);
const CHANNEL_SEMANTICS = new Set<ResourceChannelSemanticsV1>([
  'rgba',
  'rgb',
  'luminance',
  'alpha',
  'coverage',
  'data',
]);

function record(value: unknown, label: string): Readonly<Record<string, unknown>> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError(`invalid ${label}`);
  }
  return value as Readonly<Record<string, unknown>>;
}

function stringOrNull(value: unknown, label: string): string | null {
  if (value === null) return null;
  if (typeof value !== 'string') throw new TypeError(`invalid ${label}`);
  return value;
}

function boolean(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') throw new TypeError(`invalid ${label}`);
  return value;
}

function parseProvenance(value: unknown): ProvenanceV1 {
  const payload = record(value, 'resource provenance');
  if (
    payload.sourceClass !== 'builtin' &&
    payload.sourceClass !== 'user-created' &&
    payload.sourceClass !== 'user-imported' &&
    payload.sourceClass !== 'third-party'
  ) {
    throw new TypeError('invalid provenance source class');
  }
  if (
    payload.reuseMode !== 'direct-reuse' &&
    payload.reuseMode !== 'independent-recreation' &&
    payload.reuseMode !== 'user-supplied'
  ) {
    throw new TypeError('invalid provenance reuse mode');
  }
  if (typeof payload.license !== 'string' || payload.license.length < 1) {
    throw new TypeError('invalid provenance license');
  }
  return Object.freeze({
    sourceClass: payload.sourceClass,
    sourceName: stringOrNull(payload.sourceName, 'provenance source name'),
    sourceUrl: stringOrNull(payload.sourceUrl, 'provenance source URL'),
    publication: stringOrNull(payload.publication, 'provenance publication'),
    version: stringOrNull(payload.version, 'provenance version'),
    commit: stringOrNull(payload.commit, 'provenance commit'),
    license: payload.license,
    attributionRequired: boolean(payload.attributionRequired, 'provenance attribution flag'),
    noticeRequired: boolean(payload.noticeRequired, 'provenance notice flag'),
    reuseMode: payload.reuseMode,
    modificationNotes: stringOrNull(payload.modificationNotes, 'provenance modification notes'),
  });
}

function parseResourceDescriptor(value: unknown): ResourceV1 {
  const payload = record(value, 'illbrush resource descriptor');
  const resourceId = parseResourceId(payload.resourceId);
  const revision = parseRevision(payload.revision);
  if (typeof payload.kind !== 'string' || !RESOURCE_KINDS.has(payload.kind as ResourceKindV1)) {
    throw new TypeError('invalid illbrush resource kind');
  }
  if (!isSha256Hex(payload.contentHash)) throw new TypeError('invalid illbrush resource hash');
  if (typeof payload.mimeType !== 'string' || payload.mimeType.length < 1) {
    throw new TypeError('invalid illbrush resource MIME type');
  }
  if (!Number.isSafeInteger(payload.byteLength) || (payload.byteLength as number) < 0) {
    throw new RangeError('invalid illbrush resource byte length');
  }
  let dimensions: ResourceV1['dimensions'] = null;
  if (payload.dimensions !== null) {
    const size = record(payload.dimensions, 'resource dimensions');
    if (
      !Number.isSafeInteger(size.width) ||
      (size.width as number) < 1 ||
      !Number.isSafeInteger(size.height) ||
      (size.height as number) < 1 ||
      (size.channels !== null && (!Number.isSafeInteger(size.channels) || (size.channels as number) < 1))
    ) {
      throw new RangeError('invalid illbrush resource dimensions');
    }
    dimensions = Object.freeze({
      width: size.width as number,
      height: size.height as number,
      channels: size.channels as number | null,
    });
  }
  if (
    typeof payload.colorSpace !== 'string' ||
    !COLOR_SPACES.has(payload.colorSpace as ResourceColorSpaceV1)
  ) {
    throw new TypeError('invalid illbrush resource color space');
  }
  if (
    typeof payload.channelSemantics !== 'string' ||
    !CHANNEL_SEMANTICS.has(payload.channelSemantics as ResourceChannelSemanticsV1)
  ) {
    throw new TypeError('invalid illbrush resource channel semantics');
  }
  if (payload.seamless !== true && payload.seamless !== false && payload.seamless !== 'unknown') {
    throw new TypeError('invalid illbrush resource seamless flag');
  }
  const extensions = record(payload.extensions, 'resource extensions');
  return Object.freeze({
    resourceId,
    revision,
    kind: payload.kind as ResourceKindV1,
    contentHash: payload.contentHash,
    mimeType: payload.mimeType,
    byteLength: payload.byteLength as number,
    originalName: stringOrNull(payload.originalName, 'resource original name'),
    dimensions,
    colorSpace: payload.colorSpace as ResourceColorSpaceV1,
    channelSemantics: payload.channelSemantics as ResourceChannelSemanticsV1,
    seamless: payload.seamless,
    provenance: parseProvenance(payload.provenance),
    extensions: Object.freeze({ ...extensions }),
  });
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes.slice().buffer);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
}

function parseJsonBytes(bytes: Uint8Array, label: string): unknown {
  if (bytes.byteLength > ILLBRUSH_JSON_BYTE_LIMIT_V1) throw new RangeError(`${label} is too large`);
  return JSON.parse(decoder.decode(bytes));
}

function parseManifestEntry(value: unknown): IllbrushManifestEntryV1 {
  const payload = record(value, 'illbrush manifest entry');
  const path = assertSafeArchivePathV1(
    typeof payload.path === 'string' ? payload.path : (() => {
      throw new TypeError('invalid illbrush entry path');
    })(),
  );
  if (payload.role !== 'brush' && payload.role !== 'resource' && payload.role !== 'preview') {
    throw new TypeError('invalid illbrush entry role');
  }
  if (!isSha256Hex(payload.sha256)) throw new TypeError('invalid illbrush entry hash');
  if (!Number.isSafeInteger(payload.byteLength) || (payload.byteLength as number) < 0) {
    throw new RangeError('invalid illbrush entry byte length');
  }
  if (typeof payload.mimeType !== 'string' || payload.mimeType.length < 1) {
    throw new TypeError('invalid illbrush entry MIME type');
  }
  const resource = payload.resource === undefined ? undefined : parseResourceDescriptor(payload.resource);
  if (payload.role === 'resource' && resource === undefined) {
    throw new TypeError('illbrush resource entry is missing its ResourceV1 descriptor');
  }
  if (payload.role !== 'resource' && resource !== undefined) {
    throw new TypeError('non-resource illbrush entry must not contain ResourceV1 metadata');
  }
  return Object.freeze({
    path,
    role: payload.role,
    sha256: payload.sha256,
    byteLength: payload.byteLength as number,
    mimeType: payload.mimeType,
    ...(resource === undefined ? {} : { resource }),
  });
}

function parseManifest(value: unknown): IllbrushManifestV1 {
  const payload = record(value, 'illbrush manifest');
  if (payload.schema !== ILLBRUSH_MANIFEST_SCHEMA_V1) throw new TypeError('unsupported illbrush manifest schema');
  if (payload.packageVersion !== ILLBRUSH_PACKAGE_VERSION) throw new TypeError('unsupported illbrush package version');
  if (payload.mimeType !== ILLBRUSH_MIME_TYPE) throw new TypeError('invalid illbrush MIME identity');
  if (payload.brushPath !== ILLBRUSH_BRUSH_PATH_V1) throw new TypeError('invalid illbrush brush path');
  if (!Array.isArray(payload.entries)) throw new TypeError('invalid illbrush manifest entry list');
  const entries = payload.entries.map(parseManifestEntry);
  if (entries.length < 1 || entries.length > 255) throw new RangeError('invalid illbrush manifest entry count');
  const paths = new Set<string>();
  let brushCount = 0;
  let previewCount = 0;
  const resourceIds = new Set<string>();
  for (const entry of entries) {
    if (entry.path === ILLBRUSH_MANIFEST_PATH_V1) throw new TypeError('manifest must not self-list');
    if (paths.has(entry.path)) throw new TypeError(`duplicate illbrush manifest path: ${entry.path}`);
    paths.add(entry.path);
    if (entry.role === 'brush') {
      brushCount += 1;
      if (entry.path !== ILLBRUSH_BRUSH_PATH_V1 || entry.mimeType !== 'application/json') {
        throw new TypeError('invalid illbrush brush entry');
      }
    }
    if (entry.role === 'preview') {
      previewCount += 1;
      if (!entry.mimeType.startsWith('image/')) throw new TypeError('illbrush preview must be an image');
    }
    if (entry.role === 'resource') {
      const descriptor = entry.resource;
      if (descriptor === undefined) throw new TypeError('illbrush resource descriptor is missing');
      if (entry.path !== `resources/${descriptor.contentHash}`) {
        throw new TypeError('illbrush resource path is not content-addressed');
      }
      if (
        entry.sha256 !== descriptor.contentHash ||
        entry.byteLength !== descriptor.byteLength ||
        entry.mimeType !== descriptor.mimeType
      ) {
        throw new TypeError('illbrush resource manifest metadata mismatch');
      }
      if (resourceIds.has(descriptor.resourceId)) throw new TypeError('duplicate illbrush resource ID');
      resourceIds.add(descriptor.resourceId);
    }
  }
  if (brushCount !== 1) throw new TypeError('illbrush package must contain exactly one brush entry');
  if (previewCount > 1) throw new TypeError('illbrush package may contain at most one preview');
  return Object.freeze({
    schema: ILLBRUSH_MANIFEST_SCHEMA_V1,
    packageVersion: ILLBRUSH_PACKAGE_VERSION,
    mimeType: ILLBRUSH_MIME_TYPE,
    brushPath: ILLBRUSH_BRUSH_PATH_V1,
    entries: Object.freeze(entries),
  });
}

export async function parseIllbrushPackageV1(source: Uint8Array): Promise<IllbrushPackageV1> {
  const zipEntries = await readZipEntriesV1(source);
  const files = new Map(zipEntries.map((entry) => [entry.path, entry.bytes] as const));
  const manifestBytes = files.get(ILLBRUSH_MANIFEST_PATH_V1);
  if (manifestBytes === undefined) throw new TypeError('illbrush manifest.json is missing');
  const manifest = parseManifest(parseJsonBytes(manifestBytes, 'illbrush manifest'));
  const expectedPaths = new Set([ILLBRUSH_MANIFEST_PATH_V1, ...manifest.entries.map((entry) => entry.path)]);
  if (files.size !== expectedPaths.size || [...files.keys()].some((path) => !expectedPaths.has(path))) {
    throw new TypeError('illbrush package contains an undeclared entry');
  }

  for (const entry of manifest.entries) {
    const bytes = files.get(entry.path);
    if (bytes === undefined) throw new TypeError(`illbrush entry is missing: ${entry.path}`);
    if (bytes.byteLength !== entry.byteLength) throw new RangeError(`illbrush entry size mismatch: ${entry.path}`);
    if ((await sha256Hex(bytes)) !== entry.sha256) throw new TypeError(`illbrush entry hash mismatch: ${entry.path}`);
  }

  const brushBytes = files.get(ILLBRUSH_BRUSH_PATH_V1);
  if (brushBytes === undefined) throw new TypeError('illbrush brush.json is missing');
  const brushRecord = record(parseJsonBytes(brushBytes, 'illbrush brush'), 'illbrush brush');
  const brush = normalizeBrushPresetV1(brushRecord as unknown as BrushPresetV1);
  const resources: IllbrushResourcePayloadV1[] = [];
  let preview: IllbrushPreviewV1 | null = null;
  for (const entry of manifest.entries) {
    const bytes = files.get(entry.path);
    if (bytes === undefined) throw new TypeError(`illbrush entry is missing: ${entry.path}`);
    if (entry.role === 'resource') {
      if (entry.resource === undefined) throw new TypeError('illbrush resource descriptor is missing');
      resources.push(Object.freeze({ descriptor: entry.resource, bytes: bytes.slice() }));
    } else if (entry.role === 'preview') {
      preview = Object.freeze({ path: entry.path, mimeType: entry.mimeType, bytes: bytes.slice() });
    }
  }
  return Object.freeze({
    manifest,
    brush,
    resources: Object.freeze(resources),
    preview,
  });
}

function previewPathForMimeType(mimeType: string): string {
  if (mimeType === 'image/png') return 'preview.png';
  if (mimeType === 'image/jpeg') return 'preview.jpg';
  if (mimeType === 'image/webp') return 'preview.webp';
  return 'preview.image';
}

export async function writeIllbrushPackageV1(input: WriteIllbrushPackageInputV1): Promise<Uint8Array> {
  const brush = normalizeBrushPresetV1(input.brush);
  const brushBytes = encoder.encode(JSON.stringify(brush));
  if (brushBytes.byteLength > ILLBRUSH_JSON_BYTE_LIMIT_V1) throw new RangeError('illbrush brush.json is too large');
  const manifestEntries: IllbrushManifestEntryV1[] = [
    Object.freeze({
      path: ILLBRUSH_BRUSH_PATH_V1,
      role: 'brush',
      sha256: await sha256Hex(brushBytes),
      byteLength: brushBytes.byteLength,
      mimeType: 'application/json',
    }),
  ];
  const zipEntries: { path: string; bytes: Uint8Array }[] = [
    { path: ILLBRUSH_BRUSH_PATH_V1, bytes: brushBytes },
  ];
  const resourceIds = new Set<string>();
  const resourceHashes = new Set<string>();
  for (const resourceInput of input.resources ?? []) {
    const descriptor = parseResourceDescriptor(resourceInput.descriptor);
    const bytes = resourceInput.bytes.slice();
    if (resourceIds.has(descriptor.resourceId)) throw new TypeError('duplicate illbrush resource ID');
    if (resourceHashes.has(descriptor.contentHash)) throw new TypeError('duplicate illbrush resource content hash');
    resourceIds.add(descriptor.resourceId);
    resourceHashes.add(descriptor.contentHash);
    if (bytes.byteLength !== descriptor.byteLength) throw new RangeError('illbrush resource byte length mismatch');
    if ((await sha256Hex(bytes)) !== descriptor.contentHash) throw new TypeError('illbrush resource SHA-256 mismatch');
    const path = `resources/${descriptor.contentHash}`;
    manifestEntries.push(
      Object.freeze({
        path,
        role: 'resource',
        sha256: descriptor.contentHash,
        byteLength: descriptor.byteLength,
        mimeType: descriptor.mimeType,
        resource: descriptor,
      }),
    );
    zipEntries.push({ path, bytes });
  }

  const previewInput = input.preview ?? null;
  if (previewInput !== null) {
    if (!previewInput.mimeType.startsWith('image/')) throw new TypeError('illbrush preview must be an image');
    const previewBytes = previewInput.bytes.slice();
    const requestedPath = previewInput.path.trim();
    const path = assertSafeArchivePathV1(
      requestedPath.length === 0 ? previewPathForMimeType(previewInput.mimeType) : requestedPath,
    );
    if (path === ILLBRUSH_MANIFEST_PATH_V1 || path === ILLBRUSH_BRUSH_PATH_V1 || path.startsWith('resources/')) {
      throw new TypeError('illbrush preview path collides with a reserved package path');
    }
    manifestEntries.push(
      Object.freeze({
        path,
        role: 'preview',
        sha256: await sha256Hex(previewBytes),
        byteLength: previewBytes.byteLength,
        mimeType: previewInput.mimeType,
      }),
    );
    zipEntries.push({ path, bytes: previewBytes });
  }

  const manifest: IllbrushManifestV1 = Object.freeze({
    schema: ILLBRUSH_MANIFEST_SCHEMA_V1,
    packageVersion: ILLBRUSH_PACKAGE_VERSION,
    mimeType: ILLBRUSH_MIME_TYPE,
    brushPath: ILLBRUSH_BRUSH_PATH_V1,
    entries: Object.freeze(manifestEntries),
  });
  const manifestBytes = encoder.encode(JSON.stringify(manifest));
  if (manifestBytes.byteLength > ILLBRUSH_JSON_BYTE_LIMIT_V1) throw new RangeError('illbrush manifest.json is too large');
  return writeStoredZipV1([
    { path: ILLBRUSH_MANIFEST_PATH_V1, bytes: manifestBytes },
    ...zipEntries,
  ]);
}
