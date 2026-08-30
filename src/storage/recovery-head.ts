import { isCommandTransactionId, type CommandTransactionId } from '../domain/command-registry.js';
import { isSha256Hex } from '../domain/resources.js';
import { serializeJson } from '../domain/serialization.js';
import type { ImmutableObjectRefV1 } from './immutable-object-store.js';
import type { ProjectDirectoryLayoutV1 } from './opfs-layout.js';
import { openSyncAccessFile } from './sync-access.js';

export type RecoveryHeadSlotV1 = 'a' | 'b';

export interface RecoveryHeadV1 {
  readonly schema: 'illustro.recovery-head/1';
  readonly slot: RecoveryHeadSlotV1;
  readonly generation: number;
  readonly transactionId: CommandTransactionId;
  readonly checkpointObject: ImmutableObjectRefV1;
  readonly journalSequence: number;
  readonly journalByteOffset: number;
}

export interface RecoveryHeadEnvelopeV1 {
  readonly schema: 'illustro.recovery-head-envelope/1';
  readonly head: RecoveryHeadV1;
  readonly checksum: string;
}

export interface DualRecoveryStateV1 {
  readonly a: RecoveryHeadV1 | null;
  readonly b: RecoveryHeadV1 | null;
  readonly current: RecoveryHeadV1 | null;
}

const HEAD_FILENAMES: Readonly<Record<RecoveryHeadSlotV1, string>> = Object.freeze({
  a: 'head-a.json',
  b: 'head-b.json',
});

function assertCounter(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0)
    throw new RangeError(`${label} must be non-negative`);
}

function ownedBuffer(text: string): ArrayBuffer {
  const bytes = new TextEncoder().encode(text);
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

async function sha256HexText(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', ownedBuffer(text));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseObjectRef(value: unknown): ImmutableObjectRefV1 {
  if (!isRecord(value) || value.algorithm !== 'sha256' || !isSha256Hex(value.hash)) {
    throw new TypeError('invalid recovery checkpoint object reference');
  }
  if (!Number.isSafeInteger(value.byteLength) || (value.byteLength as number) < 0) {
    throw new TypeError('invalid recovery checkpoint byte length');
  }
  return Object.freeze({
    algorithm: 'sha256',
    hash: value.hash,
    byteLength: value.byteLength as number,
  });
}

function canonicalObjectRef(value: ImmutableObjectRefV1): ImmutableObjectRefV1 {
  return Object.freeze({
    algorithm: 'sha256',
    hash: value.hash,
    byteLength: value.byteLength,
  });
}

function parseHead(value: unknown): RecoveryHeadV1 {
  if (!isRecord(value) || value.schema !== 'illustro.recovery-head/1') {
    throw new TypeError('invalid recovery head schema');
  }
  if (value.slot !== 'a' && value.slot !== 'b') throw new TypeError('invalid recovery head slot');
  if (!Number.isSafeInteger(value.generation) || (value.generation as number) < 1) {
    throw new TypeError('invalid recovery head generation');
  }
  if (!isCommandTransactionId(value.transactionId)) {
    throw new TypeError('invalid recovery transaction ID');
  }
  if (!Number.isSafeInteger(value.journalSequence) || (value.journalSequence as number) < 1) {
    throw new TypeError('invalid recovery journal sequence');
  }
  if (!Number.isSafeInteger(value.journalByteOffset) || (value.journalByteOffset as number) < 0) {
    throw new TypeError('invalid recovery journal byte offset');
  }
  return Object.freeze({
    schema: 'illustro.recovery-head/1',
    slot: value.slot,
    generation: value.generation as number,
    transactionId: value.transactionId,
    checkpointObject: parseObjectRef(value.checkpointObject),
    journalSequence: value.journalSequence as number,
    journalByteOffset: value.journalByteOffset as number,
  });
}

async function envelopeFor(head: RecoveryHeadV1): Promise<RecoveryHeadEnvelopeV1> {
  const body = serializeJson(head);
  return Object.freeze({
    schema: 'illustro.recovery-head-envelope/1',
    head,
    checksum: await sha256HexText(body),
  });
}

async function readSlot(
  project: ProjectDirectoryLayoutV1,
  slot: RecoveryHeadSlotV1,
): Promise<RecoveryHeadV1 | null> {
  try {
    const handle = await project.directories.heads.getFileHandle(HEAD_FILENAMES[slot]);
    const text = await (await handle.getFile()).text();
    const value = JSON.parse(text) as unknown;
    if (!isRecord(value) || value.schema !== 'illustro.recovery-head-envelope/1') return null;
    if (typeof value.checksum !== 'string' || !isSha256Hex(value.checksum)) return null;
    const head = parseHead(value.head);
    if (head.slot !== slot) return null;
    const expected = await sha256HexText(serializeJson(head));
    return expected === value.checksum ? head : null;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'NotFoundError') return null;
    if (error instanceof SyntaxError || error instanceof TypeError) return null;
    throw error;
  }
}

export async function readDualRecoveryState(
  project: ProjectDirectoryLayoutV1,
): Promise<DualRecoveryStateV1> {
  const [a, b] = await Promise.all([readSlot(project, 'a'), readSlot(project, 'b')]);
  let current: RecoveryHeadV1 | null = null;
  if (a !== null && b !== null) current = a.generation >= b.generation ? a : b;
  else current = a ?? b;
  return Object.freeze({ a, b, current });
}

export async function publishRecoveryHead(
  project: ProjectDirectoryLayoutV1,
  input: {
    transactionId: CommandTransactionId;
    checkpointObject: ImmutableObjectRefV1;
    journalSequence: number;
    journalByteOffset: number;
  },
): Promise<RecoveryHeadV1> {
  if (!isCommandTransactionId(input.transactionId))
    throw new TypeError('invalid recovery transaction ID');
  if (!isSha256Hex(input.checkpointObject.hash))
    throw new TypeError('invalid checkpoint object hash');
  assertCounter(input.journalSequence, 'journal sequence');
  if (input.journalSequence < 1) throw new RangeError('journal sequence must be positive');
  assertCounter(input.journalByteOffset, 'journal byte offset');

  const state = await readDualRecoveryState(project);
  const slot: RecoveryHeadSlotV1 = state.current?.slot === 'a' ? 'b' : 'a';
  const generation = (state.current?.generation ?? 0) + 1;
  const head: RecoveryHeadV1 = Object.freeze({
    schema: 'illustro.recovery-head/1',
    slot,
    generation,
    transactionId: input.transactionId,
    checkpointObject: canonicalObjectRef(input.checkpointObject),
    journalSequence: input.journalSequence,
    journalByteOffset: input.journalByteOffset,
  });
  const envelope = await envelopeFor(head);
  const file = await openSyncAccessFile(project.directories.heads, HEAD_FILENAMES[slot]);
  try {
    file.replace(new TextEncoder().encode(serializeJson(envelope)));
  } finally {
    file.close();
  }
  const observed = await readSlot(project, slot);
  if (
    observed === null ||
    observed.generation !== generation ||
    observed.transactionId !== head.transactionId
  ) {
    throw new Error('recovery head read-back verification failed');
  }
  return observed;
}
