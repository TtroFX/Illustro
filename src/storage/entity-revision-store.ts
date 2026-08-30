import type { ProjectId, Revision } from '../domain/identity.js';
import { isUuid } from '../domain/identity.js';
import { serializeJson, toJsonValue, type JsonValue } from '../domain/serialization.js';
import type { ImmutableObjectRefV1 } from './immutable-object-store.js';
import { putImmutableObject } from './immutable-object-store.js';
import type { IllustroOpfsRootV1, ProjectDirectoryLayoutV1 } from './opfs-layout.js';

export const ENTITY_KINDS = ['document', 'layer', 'resource', 'object', 'node'] as const;
export type EntityKind = (typeof ENTITY_KINDS)[number];

export interface EntityRevisionRecordV1 {
  readonly schema: 'illustro.entity-revision/1';
  readonly projectId: ProjectId;
  readonly kind: EntityKind;
  readonly entityId: string;
  readonly revision: Revision;
  readonly object: ImmutableObjectRefV1;
}

export interface PersistedEntityRevisionV1 {
  readonly record: EntityRevisionRecordV1;
  readonly snapshot: JsonValue;
}

function assertRevision(revision: Revision): void {
  if (!Number.isSafeInteger(revision) || revision < 0) {
    throw new RangeError('entity revision must be a non-negative safe integer');
  }
}

export function entityRevisionPath(
  kind: EntityKind,
  entityId: string,
  revision: Revision,
): readonly [EntityKind, string, string] {
  if (!ENTITY_KINDS.includes(kind)) throw new TypeError('unsupported entity kind');
  if (!isUuid(entityId)) throw new TypeError('entity ID must be a UUID');
  assertRevision(revision);
  return Object.freeze([kind, entityId, `${revision}.json`]);
}

export async function persistEntityRevision(
  root: IllustroOpfsRootV1,
  project: ProjectDirectoryLayoutV1,
  input: {
    readonly kind: EntityKind;
    readonly entityId: string;
    readonly revision: Revision;
    readonly snapshot: unknown;
  },
): Promise<PersistedEntityRevisionV1> {
  const [kind, entityId, filename] = entityRevisionPath(input.kind, input.entityId, input.revision);
  const snapshot = toJsonValue(input.snapshot);
  const bytes = new TextEncoder().encode(serializeJson(snapshot));
  const object = await putImmutableObject(root.sha256Objects, bytes);
  const record: EntityRevisionRecordV1 = Object.freeze({
    schema: 'illustro.entity-revision/1',
    projectId: project.projectId,
    kind,
    entityId,
    revision: input.revision,
    object: Object.freeze({
      algorithm: object.algorithm,
      hash: object.hash,
      byteLength: object.byteLength,
    }),
  });
  const serializedRecord = serializeJson(record);

  const kindDirectory = await project.directories.entities.getDirectoryHandle(kind, { create: true });
  const entityDirectory = await kindDirectory.getDirectoryHandle(entityId, { create: true });
  try {
    const existingHandle = await entityDirectory.getFileHandle(filename);
    const existing = await existingHandle.getFile();
    const existingText = await existing.text();
    if (existingText !== serializedRecord) {
      throw new Error('entity revision is immutable and already points to different content');
    }
  } catch (error) {
    if (!(error instanceof DOMException) || error.name !== 'NotFoundError') throw error;
    const handle = await entityDirectory.getFileHandle(filename, { create: true });
    const writable = await handle.createWritable({ keepExistingData: false });
    try {
      await writable.write(serializedRecord);
      await writable.close();
    } catch (writeError) {
      await writable.abort?.(writeError);
      throw writeError;
    }
  }

  return Object.freeze({ record, snapshot });
}
