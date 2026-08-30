import { isCommandTransactionId, type CommandTransactionId } from '../domain/command-registry.js';
import { isRevision, type ProjectId, type Revision } from '../domain/identity.js';
import { serializeJson } from '../domain/serialization.js';
import { putImmutableObject, type ImmutableObjectRefV1 } from './immutable-object-store.js';
import type { IllustroOpfsRootV1, ProjectDirectoryLayoutV1 } from './opfs-layout.js';

export interface CheckpointV1 {
  readonly schema: 'illustro.checkpoint/1';
  readonly projectId: ProjectId;
  readonly transactionId: CommandTransactionId;
  readonly sequence: number;
  readonly documentRevision: Revision;
  readonly rootObject: ImmutableObjectRefV1;
  readonly journalByteOffset: number;
  readonly createdAt: string;
}

export interface PublishedCheckpointV1 {
  readonly checkpoint: CheckpointV1;
  readonly object: ImmutableObjectRefV1;
  readonly indexFilename: string;
}

function assertSequence(sequence: number): void {
  if (!Number.isSafeInteger(sequence) || sequence < 1) {
    throw new RangeError('checkpoint sequence must be a positive safe integer');
  }
}

function assertByteOffset(offset: number): void {
  if (!Number.isSafeInteger(offset) || offset < 0) {
    throw new RangeError('checkpoint journal byte offset must be a non-negative safe integer');
  }
}

function indexFilename(sequence: number): string {
  return `${sequence.toString().padStart(16, '0')}.json`;
}

async function readTextIfPresent(
  directory: ProjectDirectoryLayoutV1['directories']['checkpoints'],
  filename: string,
): Promise<string | null> {
  try {
    const file = await directory.getFileHandle(filename);
    return await (await file.getFile()).text();
  } catch (error) {
    if (error instanceof DOMException && error.name === 'NotFoundError') return null;
    throw error;
  }
}

async function writeImmutableIndex(
  directory: ProjectDirectoryLayoutV1['directories']['checkpoints'],
  filename: string,
  text: string,
): Promise<void> {
  const existing = await readTextIfPresent(directory, filename);
  if (existing !== null) {
    if (existing !== text) throw new Error(`checkpoint index collision: ${filename}`);
    return;
  }
  const file = await directory.getFileHandle(filename, { create: true });
  const writable = await file.createWritable({ keepExistingData: false });
  try {
    await writable.write(text);
    await writable.close();
  } catch (error) {
    await writable.abort?.(error);
    throw error;
  }
}

export function createCheckpoint(input: {
  projectId: ProjectId;
  transactionId: CommandTransactionId;
  sequence: number;
  documentRevision: Revision;
  rootObject: ImmutableObjectRefV1;
  journalByteOffset: number;
  createdAt: string;
}): CheckpointV1 {
  if (!isCommandTransactionId(input.transactionId)) {
    throw new TypeError('checkpoint transactionId must be a UUID');
  }
  assertSequence(input.sequence);
  if (!isRevision(input.documentRevision)) throw new RangeError('checkpoint revision is invalid');
  assertByteOffset(input.journalByteOffset);
  if (Number.isNaN(Date.parse(input.createdAt)))
    throw new TypeError('checkpoint createdAt must be ISO-like');
  return Object.freeze({ schema: 'illustro.checkpoint/1', ...input });
}

export async function publishCheckpoint(
  root: IllustroOpfsRootV1,
  project: ProjectDirectoryLayoutV1,
  checkpoint: CheckpointV1,
): Promise<PublishedCheckpointV1> {
  if (checkpoint.projectId !== project.projectId) {
    throw new Error('checkpoint project does not match project directory');
  }
  const serialized = serializeJson(checkpoint);
  const bytes = new TextEncoder().encode(serialized);
  const object = await putImmutableObject(root.sha256Objects, bytes);
  const filename = indexFilename(checkpoint.sequence);
  const index = serializeJson({
    schema: 'illustro.checkpoint-index/1',
    sequence: checkpoint.sequence,
    checkpointObject: {
      algorithm: object.algorithm,
      hash: object.hash,
      byteLength: object.byteLength,
    },
  });
  await writeImmutableIndex(project.directories.checkpoints, filename, index);
  return Object.freeze({ checkpoint, object, indexFilename: filename });
}
