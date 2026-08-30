import { INITIAL_REVISION, createResourceId, type ResourceId, type Revision } from './identity.js';

export type ResourceKindV1 =
  | 'brush-tip'
  | 'grain'
  | 'pattern'
  | 'reference-image'
  | 'palette'
  | 'gradient'
  | 'font-ref'
  | 'imported-source'
  | 'other';

export type ResourceColorSpaceV1 = 'none' | 'srgb' | 'display-p3' | 'embedded-profile' | 'data';

export type ResourceChannelSemanticsV1 =
  | 'rgba'
  | 'rgb'
  | 'luminance'
  | 'alpha'
  | 'coverage'
  | 'data';

export type ProvenanceSourceClassV1 = 'builtin' | 'user-created' | 'user-imported' | 'third-party';

export type ProvenanceReuseModeV1 = 'direct-reuse' | 'independent-recreation' | 'user-supplied';

export interface ProvenanceV1 {
  readonly sourceClass: ProvenanceSourceClassV1;
  readonly sourceName: string | null;
  readonly sourceUrl: string | null;
  readonly publication: string | null;
  readonly version: string | null;
  readonly commit: string | null;
  readonly license: string;
  readonly attributionRequired: boolean;
  readonly noticeRequired: boolean;
  readonly reuseMode: ProvenanceReuseModeV1;
  readonly modificationNotes: string | null;
}

export interface ResourceDimensionsV1 {
  readonly width: number;
  readonly height: number;
  readonly channels: number | null;
}

export interface ResourceV1 {
  readonly resourceId: ResourceId;
  readonly revision: Revision;
  readonly kind: ResourceKindV1;
  readonly contentHash: string;
  readonly mimeType: string;
  readonly byteLength: number;
  readonly originalName: string | null;
  readonly dimensions: ResourceDimensionsV1 | null;
  readonly colorSpace: ResourceColorSpaceV1;
  readonly channelSemantics: ResourceChannelSemanticsV1;
  readonly seamless: boolean | 'unknown';
  readonly provenance: ProvenanceV1;
  readonly extensions: Readonly<Record<string, unknown>>;
}

const SHA256_PATTERN = /^[0-9a-f]{64}$/;

export function isSha256Hex(value: unknown): value is string {
  return typeof value === 'string' && SHA256_PATTERN.test(value);
}

export function createProvenanceV1(input: {
  sourceClass: ProvenanceSourceClassV1;
  sourceName?: string | null;
  sourceUrl?: string | null;
  publication?: string | null;
  version?: string | null;
  commit?: string | null;
  license?: string;
  attributionRequired?: boolean;
  noticeRequired?: boolean;
  reuseMode?: ProvenanceReuseModeV1;
  modificationNotes?: string | null;
}): ProvenanceV1 {
  const license = input.license ?? 'user-supplied/unknown';
  if (license.length === 0) throw new TypeError('provenance license must not be empty');

  return Object.freeze({
    sourceClass: input.sourceClass,
    sourceName: input.sourceName ?? null,
    sourceUrl: input.sourceUrl ?? null,
    publication: input.publication ?? null,
    version: input.version ?? null,
    commit: input.commit ?? null,
    license,
    attributionRequired: input.attributionRequired ?? false,
    noticeRequired: input.noticeRequired ?? false,
    reuseMode: input.reuseMode ?? 'user-supplied',
    modificationNotes: input.modificationNotes ?? null,
  });
}

export function createResourceV1(input: {
  kind: ResourceKindV1;
  contentHash: string;
  mimeType: string;
  byteLength: number;
  provenance: ProvenanceV1;
  resourceId?: ResourceId;
  originalName?: string | null;
  dimensions?: ResourceDimensionsV1 | null;
  colorSpace?: ResourceColorSpaceV1;
  channelSemantics?: ResourceChannelSemanticsV1;
  seamless?: boolean | 'unknown';
  extensions?: Readonly<Record<string, unknown>>;
}): ResourceV1 {
  if (!isSha256Hex(input.contentHash)) {
    throw new TypeError('resource contentHash must be lowercase SHA-256 hex');
  }
  if (input.mimeType.length === 0) throw new TypeError('resource mimeType must not be empty');
  if (!Number.isSafeInteger(input.byteLength) || input.byteLength < 0) {
    throw new RangeError('resource byteLength must be a non-negative safe integer');
  }
  if (input.dimensions !== undefined && input.dimensions !== null) {
    if (
      !Number.isSafeInteger(input.dimensions.width) ||
      input.dimensions.width < 1 ||
      !Number.isSafeInteger(input.dimensions.height) ||
      input.dimensions.height < 1
    ) {
      throw new RangeError('resource dimensions must be positive safe integers');
    }
  }

  return Object.freeze({
    resourceId: input.resourceId ?? createResourceId(),
    revision: INITIAL_REVISION,
    kind: input.kind,
    contentHash: input.contentHash,
    mimeType: input.mimeType,
    byteLength: input.byteLength,
    originalName: input.originalName ?? null,
    dimensions: input.dimensions ?? null,
    colorSpace: input.colorSpace ?? 'none',
    channelSemantics: input.channelSemantics ?? 'data',
    seamless: input.seamless ?? 'unknown',
    provenance: input.provenance,
    extensions: Object.freeze({ ...(input.extensions ?? {}) }),
  });
}
