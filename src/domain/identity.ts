declare const semanticIdBrand: unique symbol;
declare const revisionBrand: unique symbol;

type SemanticId<Kind extends string> = string & {
  readonly [semanticIdBrand]: Kind;
};

export type DocumentId = SemanticId<'DocumentId'>;
export type ProjectId = SemanticId<'ProjectId'>;
export type LayerId = SemanticId<'LayerId'>;
export type ResourceId = SemanticId<'ResourceId'>;
export type ObjectId = SemanticId<'ObjectId'>;
export type NodeId = SemanticId<'NodeId'>;
export type Revision = number & { readonly [revisionBrand]: 'Revision' };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const INITIAL_REVISION = 0 as Revision;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

function parseSemanticId<Kind extends string>(value: unknown, label: Kind): SemanticId<Kind> {
  if (!isUuid(value)) {
    throw new TypeError(`${label} must be a standards-shaped UUID string`);
  }
  return value as SemanticId<Kind>;
}

function createSemanticId<Kind extends string>(): SemanticId<Kind> {
  return crypto.randomUUID() as SemanticId<Kind>;
}

export const parseDocumentId = (value: unknown): DocumentId => parseSemanticId(value, 'DocumentId');
export const parseProjectId = (value: unknown): ProjectId => parseSemanticId(value, 'ProjectId');
export const parseLayerId = (value: unknown): LayerId => parseSemanticId(value, 'LayerId');
export const parseResourceId = (value: unknown): ResourceId => parseSemanticId(value, 'ResourceId');
export const parseObjectId = (value: unknown): ObjectId => parseSemanticId(value, 'ObjectId');
export const parseNodeId = (value: unknown): NodeId => parseSemanticId(value, 'NodeId');

export const createDocumentId = (): DocumentId => createSemanticId();
export const createProjectId = (): ProjectId => createSemanticId();
export const createLayerId = (): LayerId => createSemanticId();
export const createResourceId = (): ResourceId => createSemanticId();
export const createObjectId = (): ObjectId => createSemanticId();
export const createNodeId = (): NodeId => createSemanticId();

export function isRevision(value: unknown): value is Revision {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

export function parseRevision(value: unknown): Revision {
  if (!isRevision(value)) {
    throw new RangeError('revision must be a non-negative safe integer');
  }
  return value;
}

export function nextRevision(revision: Revision): Revision {
  if (revision === Number.MAX_SAFE_INTEGER) {
    throw new RangeError('revision exhausted JavaScript safe-integer range');
  }
  return (revision + 1) as Revision;
}
