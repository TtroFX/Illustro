import {
  isCommandTransactionId,
  type CommandTransactionId,
} from '../domain/command-registry.js';
import { isRevision, type Revision } from '../domain/identity.js';
import { toJsonValue } from '../domain/serialization.js';
import { createCheckpoint, publishCheckpoint } from './checkpoint.js';
import { putImmutableObject } from './immutable-object-store.js';
import { appendJournalFrame } from './journal.js';
import type {
  IllustroOpfsRootV1,
  ProjectDirectoryLayoutV1,
} from './opfs-layout.js';
import { publishRecoveryHead } from './recovery-head.js';
import { openSyncAccessFile } from './sync-access.js';

export interface ProjectTransactionCommitResultV1 {
  readonly transactionId: CommandTransactionId;
  readonly sequence: number;
  readonly documentRevision: Revision;
  readonly snapshotObjectHash: string;
  readonly checkpointObjectHash: string;
  readonly journalByteOffset: number;
  readonly recoveryGeneration: number;
}

function assertSequence(sequence: number): void {
  if (!Number.isSafeInteger(sequence) || sequence < 1) {
    throw new RangeError('transaction sequence must be a positive safe integer');
  }
}

export async function commitProjectTransaction(
  root: IllustroOpfsRootV1,
  project: ProjectDirectoryLayoutV1,
  input: {
    transactionId: CommandTransactionId;
    sequence: number;
    documentRevision: Revision;
    snapshot: unknown;
    createdAt?: string;
  },
): Promise<ProjectTransactionCommitResultV1> {
  if (!isCommandTransactionId(input.transactionId)) {
    throw new TypeError('transactionId must be a UUID');
  }
  assertSequence(input.sequence);
  if (!isRevision(input.documentRevision)) throw new RangeError('document revision is invalid');

  const canonicalSnapshot = toJsonValue(input.snapshot);
  const snapshotBytes = new TextEncoder().encode(JSON.stringify(canonicalSnapshot));
  const snapshotObject = await putImmutableObject(root.sha256Objects, snapshotBytes);
  const journal = await openSyncAccessFile(project.directories.journal, 'main.ilj');

  try {
    const prepare = await appendJournalFrame(journal, {
      kind: 'prepare',
      sequence: input.sequence,
      payload: {
        schema: 'illustro.transaction-prepare/1',
        transactionId: input.transactionId,
        documentRevision: input.documentRevision,
        snapshotObject: {
          algorithm: snapshotObject.algorithm,
          hash: snapshotObject.hash,
          byteLength: snapshotObject.byteLength,
        },
      },
    });
    const commit = await appendJournalFrame(journal, {
      kind: 'commit',
      sequence: input.sequence,
      payload: {
        schema: 'illustro.transaction-commit/1',
        transactionId: input.transactionId,
        prepareOffset: prepare.offset,
        prepareChecksum: prepare.checksum,
      },
    });
    const committedByteOffset = commit.offset + commit.byteLength;
    journal.flush();

    const checkpoint = createCheckpoint({
      projectId: project.projectId,
      transactionId: input.transactionId,
      sequence: input.sequence,
      documentRevision: input.documentRevision,
      rootObject: snapshotObject,
      journalByteOffset: committedByteOffset,
      createdAt: input.createdAt ?? new Date().toISOString(),
    });
    const publishedCheckpoint = await publishCheckpoint(root, project, checkpoint);
    const recoveryHead = await publishRecoveryHead(project, {
      transactionId: input.transactionId,
      checkpointObject: publishedCheckpoint.object,
      journalSequence: input.sequence,
      journalByteOffset: committedByteOffset,
    });

    return Object.freeze({
      transactionId: input.transactionId,
      sequence: input.sequence,
      documentRevision: input.documentRevision,
      snapshotObjectHash: snapshotObject.hash,
      checkpointObjectHash: publishedCheckpoint.object.hash,
      journalByteOffset: committedByteOffset,
      recoveryGeneration: recoveryHead.generation,
    });
  } finally {
    journal.close();
  }
}
