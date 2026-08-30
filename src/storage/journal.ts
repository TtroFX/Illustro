import { toJsonValue, type JsonValue } from '../domain/serialization.js';
import type { SyncAccessFileV1 } from './sync-access.js';

export const JOURNAL_FRAME_VERSION = 1 as const;
export const JOURNAL_FRAME_HEADER_BYTES = 52 as const;

export type JournalFrameKindV1 = 'prepare' | 'commit';

const FRAME_KIND_CODE: Readonly<Record<JournalFrameKindV1, number>> = Object.freeze({
  prepare: 1,
  commit: 2,
});
const CODE_FRAME_KIND: Readonly<Record<number, JournalFrameKindV1>> = Object.freeze({
  1: 'prepare',
  2: 'commit',
});
const JOURNAL_MAGIC = new Uint8Array([0x49, 0x4c, 0x4a, 0x31]);

export interface JournalFrameV1 {
  readonly version: typeof JOURNAL_FRAME_VERSION;
  readonly kind: JournalFrameKindV1;
  readonly sequence: number;
  readonly payload: JsonValue;
  readonly checksum: string;
}

export interface JournalAppendResultV1 {
  readonly offset: number;
  readonly byteLength: number;
  readonly sequence: number;
  readonly checksum: string;
}

export interface JournalScanResultV1 {
  readonly frames: readonly JournalFrameV1[];
  readonly validByteLength: number;
  readonly truncatedTail: boolean;
}

function assertSequence(sequence: number): void {
  if (!Number.isSafeInteger(sequence) || sequence < 0) {
    throw new RangeError('journal sequence must be a non-negative safe integer');
  }
}

function ownedBytes(data: Uint8Array): Uint8Array<ArrayBuffer> {
  const copy = new Uint8Array(data.byteLength);
  copy.set(data);
  return copy;
}

async function sha256(data: Uint8Array): Promise<Uint8Array<ArrayBuffer>> {
  const bytes = ownedBytes(data);
  const digest = await crypto.subtle.digest('SHA-256', bytes.buffer);
  return new Uint8Array(digest);
}

function hex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false;
  for (let index = 0; index < left.byteLength; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

function checksumInput(prefix: Uint8Array, payload: Uint8Array): Uint8Array<ArrayBuffer> {
  const output = new Uint8Array(prefix.byteLength + payload.byteLength);
  output.set(prefix, 0);
  output.set(payload, prefix.byteLength);
  return output;
}

export async function encodeJournalFrame(input: {
  kind: JournalFrameKindV1;
  sequence: number;
  payload: unknown;
}): Promise<Uint8Array<ArrayBuffer>> {
  assertSequence(input.sequence);
  const payload = toJsonValue(input.payload);
  const payloadBytes = new TextEncoder().encode(JSON.stringify(payload));
  const output = new Uint8Array(JOURNAL_FRAME_HEADER_BYTES + payloadBytes.byteLength);
  output.set(JOURNAL_MAGIC, 0);
  const view = new DataView(output.buffer);
  view.setUint8(4, JOURNAL_FRAME_VERSION);
  view.setUint8(5, FRAME_KIND_CODE[input.kind]);
  view.setUint16(6, 0, false);
  view.setUint32(8, payloadBytes.byteLength, false);
  view.setBigUint64(12, BigInt(input.sequence), false);
  const checksum = await sha256(checksumInput(output.subarray(0, 20), payloadBytes));
  output.set(checksum, 20);
  output.set(payloadBytes, JOURNAL_FRAME_HEADER_BYTES);
  return output;
}

export async function scanJournalFrames(
  data: Uint8Array | ArrayBuffer,
): Promise<JournalScanResultV1> {
  const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
  const frames: JournalFrameV1[] = [];
  let offset = 0;

  while (offset < bytes.byteLength) {
    if (bytes.byteLength - offset < JOURNAL_FRAME_HEADER_BYTES) {
      return Object.freeze({
        frames: Object.freeze(frames),
        validByteLength: offset,
        truncatedTail: true,
      });
    }
    const frameHeader = bytes.subarray(offset, offset + JOURNAL_FRAME_HEADER_BYTES);
    if (!sameBytes(frameHeader.subarray(0, 4), JOURNAL_MAGIC)) {
      throw new Error(`invalid journal magic at byte ${offset}`);
    }
    const view = new DataView(frameHeader.buffer, frameHeader.byteOffset, frameHeader.byteLength);
    const version = view.getUint8(4);
    if (version !== JOURNAL_FRAME_VERSION)
      throw new Error(`unsupported journal frame version: ${version}`);
    const kind = CODE_FRAME_KIND[view.getUint8(5)];
    if (kind === undefined) throw new Error(`unknown journal frame kind at byte ${offset}`);
    const payloadLength = view.getUint32(8, false);
    const sequenceBig = view.getBigUint64(12, false);
    if (sequenceBig > BigInt(Number.MAX_SAFE_INTEGER))
      throw new Error('journal sequence exceeds safe integer range');
    const frameByteLength = JOURNAL_FRAME_HEADER_BYTES + payloadLength;
    if (bytes.byteLength - offset < frameByteLength) {
      return Object.freeze({
        frames: Object.freeze(frames),
        validByteLength: offset,
        truncatedTail: true,
      });
    }
    const payloadBytes = bytes.subarray(
      offset + JOURNAL_FRAME_HEADER_BYTES,
      offset + frameByteLength,
    );
    const observedChecksum = frameHeader.subarray(20, 52);
    const expectedChecksum = await sha256(checksumInput(frameHeader.subarray(0, 20), payloadBytes));
    if (!sameBytes(observedChecksum, expectedChecksum)) {
      throw new Error(`journal checksum mismatch at byte ${offset}`);
    }
    const payload = toJsonValue(JSON.parse(new TextDecoder().decode(payloadBytes)) as unknown);
    frames.push(
      Object.freeze({
        version: JOURNAL_FRAME_VERSION,
        kind,
        sequence: Number(sequenceBig),
        payload,
        checksum: hex(observedChecksum),
      }),
    );
    offset += frameByteLength;
  }

  return Object.freeze({
    frames: Object.freeze(frames),
    validByteLength: offset,
    truncatedTail: false,
  });
}

export async function appendJournalFrame(
  file: SyncAccessFileV1,
  input: { kind: JournalFrameKindV1; sequence: number; payload: unknown },
): Promise<JournalAppendResultV1> {
  const encoded = await encodeJournalFrame(input);
  const offset = file.append(encoded);
  const checksum = hex(encoded.subarray(20, 52));
  return Object.freeze({
    offset,
    byteLength: encoded.byteLength,
    sequence: input.sequence,
    checksum,
  });
}
