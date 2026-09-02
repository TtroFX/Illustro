import { isUuid } from '../domain/identity.js';
import { isSha256Hex, type ResourceColorSpaceV1, type ResourceV1 } from '../domain/resources.js';

export const REFERENCE_WORKSPACE_STORAGE_KEY_V1 = 'illustro.reference-workspace.v1';
export const REFERENCE_WORKSPACE_LIMIT_V1 = 24;

export interface ReferenceWorkspaceItemV1 {
  readonly resource: ResourceV1;
  readonly zoom: number;
  readonly rotationQuarterTurns: 0 | 1 | 2 | 3;
}

export interface ReferenceWorkspaceStateV1 {
  readonly schema: 'illustro.reference-workspace/1';
  readonly items: readonly ReferenceWorkspaceItemV1[];
  readonly activeResourceId: string | null;
}

const COLOR_SPACES = new Set<ResourceColorSpaceV1>([
  'none',
  'srgb',
  'display-p3',
  'embedded-profile',
  'data',
]);

function normalizeQuarterTurns(value: number): 0 | 1 | 2 | 3 {
  if (!Number.isInteger(value)) throw new TypeError('reference rotation must be an integer');
  return (((value % 4) + 4) % 4) as 0 | 1 | 2 | 3;
}

function normalizeZoom(value: number): number {
  if (!Number.isFinite(value)) throw new TypeError('reference zoom must be finite');
  return Math.min(8, Math.max(0.25, value));
}

function freezeItem(
  resource: ResourceV1,
  zoom = 1,
  rotationQuarterTurns = 0,
): ReferenceWorkspaceItemV1 {
  return Object.freeze({
    resource,
    zoom: normalizeZoom(zoom),
    rotationQuarterTurns: normalizeQuarterTurns(rotationQuarterTurns),
  });
}

function validateReferenceResource(value: unknown): ResourceV1 {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError('invalid reference resource');
  }
  const record = value as Readonly<Record<string, unknown>>;
  if (!isUuid(record.resourceId)) throw new TypeError('invalid reference resource id');
  if (!Number.isSafeInteger(record.revision) || (record.revision as number) < 0) {
    throw new TypeError('invalid reference resource revision');
  }
  if (record.kind !== 'reference-image') throw new TypeError('resource is not a reference image');
  if (!isSha256Hex(record.contentHash)) throw new TypeError('invalid reference content hash');
  if (typeof record.mimeType !== 'string' || !record.mimeType.startsWith('image/')) {
    throw new TypeError('invalid reference mime type');
  }
  if (!Number.isSafeInteger(record.byteLength) || (record.byteLength as number) < 1) {
    throw new TypeError('invalid reference byte length');
  }
  if (record.originalName !== null && typeof record.originalName !== 'string') {
    throw new TypeError('invalid reference original name');
  }
  if (
    typeof record.dimensions !== 'object' ||
    record.dimensions === null ||
    Array.isArray(record.dimensions)
  ) {
    throw new TypeError('reference dimensions are required');
  }
  const dimensions = record.dimensions as Readonly<Record<string, unknown>>;
  if (
    !Number.isSafeInteger(dimensions.width) ||
    (dimensions.width as number) < 1 ||
    !Number.isSafeInteger(dimensions.height) ||
    (dimensions.height as number) < 1
  ) {
    throw new TypeError('invalid reference dimensions');
  }
  if (
    typeof record.colorSpace !== 'string' ||
    !COLOR_SPACES.has(record.colorSpace as ResourceColorSpaceV1)
  ) {
    throw new TypeError('invalid reference color space');
  }
  if (record.channelSemantics !== 'rgb' && record.channelSemantics !== 'rgba') {
    throw new TypeError('invalid reference channel semantics');
  }
  if (record.seamless !== true && record.seamless !== false && record.seamless !== 'unknown') {
    throw new TypeError('invalid reference seamless metadata');
  }
  if (
    typeof record.provenance !== 'object' ||
    record.provenance === null ||
    Array.isArray(record.provenance)
  ) {
    throw new TypeError('invalid reference provenance');
  }
  if (
    typeof record.extensions !== 'object' ||
    record.extensions === null ||
    Array.isArray(record.extensions)
  ) {
    throw new TypeError('invalid reference extensions');
  }
  return value as ResourceV1;
}

export function createReferenceWorkspaceStateV1(): ReferenceWorkspaceStateV1 {
  return Object.freeze({
    schema: 'illustro.reference-workspace/1' as const,
    items: Object.freeze([]),
    activeResourceId: null,
  });
}

export function parseReferenceWorkspaceStateV1(value: unknown): ReferenceWorkspaceStateV1 {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError('invalid reference workspace');
  }
  const record = value as Readonly<Record<string, unknown>>;
  if (record.schema !== 'illustro.reference-workspace/1' || !Array.isArray(record.items)) {
    throw new TypeError('invalid reference workspace schema');
  }
  if (record.items.length > REFERENCE_WORKSPACE_LIMIT_V1) {
    throw new RangeError('too many reference images');
  }
  const ids = new Set<string>();
  const items = Object.freeze(
    record.items.map((entry) => {
      if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
        throw new TypeError('invalid reference workspace item');
      }
      const item = entry as Readonly<Record<string, unknown>>;
      const resource = validateReferenceResource(item.resource);
      if (ids.has(resource.resourceId)) throw new TypeError('duplicate reference resource id');
      ids.add(resource.resourceId);
      return freezeItem(
        resource,
        typeof item.zoom === 'number' ? item.zoom : 1,
        typeof item.rotationQuarterTurns === 'number' ? item.rotationQuarterTurns : 0,
      );
    }),
  );
  const activeResourceId = record.activeResourceId;
  if (activeResourceId !== null && typeof activeResourceId !== 'string') {
    throw new TypeError('invalid active reference resource id');
  }
  if (activeResourceId !== null && !ids.has(activeResourceId)) {
    throw new TypeError('active reference resource is missing');
  }
  return Object.freeze({
    schema: 'illustro.reference-workspace/1' as const,
    items,
    activeResourceId: activeResourceId as string | null,
  });
}

export function addReferenceWorkspaceResourceV1(
  state: ReferenceWorkspaceStateV1,
  resource: ResourceV1,
): ReferenceWorkspaceStateV1 {
  if (resource.kind !== 'reference-image')
    throw new TypeError('resource must be a reference image');
  if (state.items.length >= REFERENCE_WORKSPACE_LIMIT_V1) {
    throw new RangeError(`reference image limit is ${REFERENCE_WORKSPACE_LIMIT_V1}`);
  }
  if (state.items.some((item) => item.resource.resourceId === resource.resourceId)) {
    throw new RangeError('reference resource already exists');
  }
  return Object.freeze({
    ...state,
    items: Object.freeze([...state.items, freezeItem(resource)]),
    activeResourceId: resource.resourceId,
  });
}

export function setActiveReferenceWorkspaceResourceV1(
  state: ReferenceWorkspaceStateV1,
  resourceId: string,
): ReferenceWorkspaceStateV1 {
  if (!state.items.some((item) => item.resource.resourceId === resourceId)) {
    throw new RangeError('reference resource not found');
  }
  if (state.activeResourceId === resourceId) return state;
  return Object.freeze({ ...state, activeResourceId: resourceId });
}

export function removeReferenceWorkspaceResourceV1(
  state: ReferenceWorkspaceStateV1,
  resourceId: string,
): ReferenceWorkspaceStateV1 {
  const index = state.items.findIndex((item) => item.resource.resourceId === resourceId);
  if (index < 0) throw new RangeError('reference resource not found');
  const items = state.items.filter((item) => item.resource.resourceId !== resourceId);
  const activeResourceId =
    state.activeResourceId === resourceId
      ? (items[Math.min(index, items.length - 1)]?.resource.resourceId ?? null)
      : state.activeResourceId;
  return Object.freeze({ ...state, items: Object.freeze(items), activeResourceId });
}

export function updateReferenceWorkspaceViewV1(
  state: ReferenceWorkspaceStateV1,
  resourceId: string,
  input: { readonly zoom?: number; readonly rotationQuarterTurns?: number },
): ReferenceWorkspaceStateV1 {
  let found = false;
  const items = state.items.map((item) => {
    if (item.resource.resourceId !== resourceId) return item;
    found = true;
    return freezeItem(
      item.resource,
      input.zoom ?? item.zoom,
      input.rotationQuarterTurns ?? item.rotationQuarterTurns,
    );
  });
  if (!found) throw new RangeError('reference resource not found');
  return Object.freeze({ ...state, items: Object.freeze(items) });
}

export function activeReferenceWorkspaceItemV1(
  state: ReferenceWorkspaceStateV1,
): ReferenceWorkspaceItemV1 | null {
  if (state.activeResourceId === null) return null;
  return state.items.find((item) => item.resource.resourceId === state.activeResourceId) ?? null;
}
