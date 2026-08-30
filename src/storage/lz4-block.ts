const MIN_MATCH = 4;
const LAST_LITERALS = 5;
const MATCH_START_LIMIT = 12;
const HASH_LOG = 16;
const HASH_SIZE = 1 << HASH_LOG;
const MAX_OFFSET = 0xffff;

class ByteWriter {
  readonly #bytes: Uint8Array<ArrayBuffer>;
  #offset = 0;

  constructor(capacity: number) {
    this.#bytes = new Uint8Array(capacity);
  }

  get length(): number {
    return this.#offset;
  }

  reserveByte(): number {
    const index = this.#offset;
    this.writeByte(0);
    return index;
  }

  setByte(index: number, value: number): void {
    this.#bytes[index] = value & 0xff;
  }

  writeByte(value: number): void {
    if (this.#offset >= this.#bytes.byteLength) throw new RangeError('LZ4 output exceeded compression bound');
    this.#bytes[this.#offset] = value & 0xff;
    this.#offset += 1;
  }

  writeBytes(bytes: Uint8Array): void {
    if (this.#offset + bytes.byteLength > this.#bytes.byteLength) {
      throw new RangeError('LZ4 output exceeded compression bound');
    }
    this.#bytes.set(bytes, this.#offset);
    this.#offset += bytes.byteLength;
  }

  finish(): Uint8Array<ArrayBuffer> {
    return this.#bytes.slice(0, this.#offset);
  }
}

function ownedBytes(data: Uint8Array | ArrayBuffer): Uint8Array<ArrayBuffer> {
  if (data instanceof ArrayBuffer) return new Uint8Array(data.slice(0));
  const copy = new Uint8Array(data.byteLength);
  copy.set(data);
  return copy;
}

function readU32(bytes: Uint8Array, offset: number): number {
  return (
    bytes[offset]! |
    (bytes[offset + 1]! << 8) |
    (bytes[offset + 2]! << 16) |
    (bytes[offset + 3]! << 24)
  ) >>> 0;
}

function hashSequence(bytes: Uint8Array, offset: number): number {
  return (Math.imul(readU32(bytes, offset), 0x9e3779b1) >>> (32 - HASH_LOG)) & (HASH_SIZE - 1);
}

function sameFour(bytes: Uint8Array, first: number, second: number): boolean {
  return readU32(bytes, first) === readU32(bytes, second);
}

function writeExtendedLength(writer: ByteWriter, length: number): void {
  let remaining = length;
  while (remaining >= 255) {
    writer.writeByte(255);
    remaining -= 255;
  }
  writer.writeByte(remaining);
}

export function lz4CompressionBound(inputByteLength: number): number {
  if (!Number.isSafeInteger(inputByteLength) || inputByteLength < 0) {
    throw new RangeError('LZ4 input length must be a non-negative safe integer');
  }
  return inputByteLength + Math.floor(inputByteLength / 255) + 16;
}

export function compressLz4Block(data: Uint8Array | ArrayBuffer): Uint8Array<ArrayBuffer> {
  const input = ownedBytes(data);
  const inputLength = input.byteLength;
  if (inputLength === 0) return new Uint8Array(0);

  const writer = new ByteWriter(lz4CompressionBound(inputLength));
  const table = new Int32Array(HASH_SIZE);
  table.fill(-1);
  let anchor = 0;
  let cursor = 0;
  const latestMatchStart = inputLength - MATCH_START_LIMIT;
  const matchEndLimit = inputLength - LAST_LITERALS;

  while (cursor <= latestMatchStart) {
    const hash = hashSequence(input, cursor);
    const reference = table[hash]!;
    table[hash] = cursor;

    if (
      reference < 0 ||
      cursor - reference > MAX_OFFSET ||
      !sameFour(input, reference, cursor)
    ) {
      cursor += 1;
      continue;
    }

    let matchLength = MIN_MATCH;
    while (
      cursor + matchLength < matchEndLimit &&
      input[reference + matchLength] === input[cursor + matchLength]
    ) {
      matchLength += 1;
    }

    const literalLength = cursor - anchor;
    const encodedMatchLength = matchLength - MIN_MATCH;
    const tokenIndex = writer.reserveByte();
    let token = Math.min(literalLength, 15) << 4;
    token |= Math.min(encodedMatchLength, 15);
    writer.setByte(tokenIndex, token);

    if (literalLength >= 15) writeExtendedLength(writer, literalLength - 15);
    writer.writeBytes(input.subarray(anchor, cursor));

    const offset = cursor - reference;
    writer.writeByte(offset & 0xff);
    writer.writeByte(offset >>> 8);
    if (encodedMatchLength >= 15) writeExtendedLength(writer, encodedMatchLength - 15);

    cursor += matchLength;
    anchor = cursor;
    for (let position = Math.max(anchor - 2, 0); position < anchor; position += 1) {
      if (position <= latestMatchStart) table[hashSequence(input, position)] = position;
    }
  }

  const literalLength = inputLength - anchor;
  const tokenIndex = writer.reserveByte();
  writer.setByte(tokenIndex, Math.min(literalLength, 15) << 4);
  if (literalLength >= 15) writeExtendedLength(writer, literalLength - 15);
  writer.writeBytes(input.subarray(anchor));
  return writer.finish();
}

function readLength(
  input: Uint8Array,
  cursor: { value: number },
  initial: number,
): number {
  let length = initial;
  if (initial !== 15) return length;
  for (;;) {
    if (cursor.value >= input.byteLength) throw new Error('truncated LZ4 length extension');
    const next = input[cursor.value]!;
    cursor.value += 1;
    length += next;
    if (next !== 255) return length;
  }
}

export function decompressLz4Block(
  data: Uint8Array | ArrayBuffer,
  expectedByteLength: number,
): Uint8Array<ArrayBuffer> {
  if (!Number.isSafeInteger(expectedByteLength) || expectedByteLength < 0) {
    throw new RangeError('expected LZ4 output length must be a non-negative safe integer');
  }
  const input = ownedBytes(data);
  if (expectedByteLength === 0) {
    if (input.byteLength !== 0) throw new Error('non-empty LZ4 block for empty output');
    return new Uint8Array(0);
  }

  const output = new Uint8Array(expectedByteLength);
  const cursor = { value: 0 };
  let outputOffset = 0;

  while (cursor.value < input.byteLength) {
    const token = input[cursor.value]!;
    cursor.value += 1;
    const literalLength = readLength(input, cursor, token >>> 4);
    if (cursor.value + literalLength > input.byteLength) throw new Error('truncated LZ4 literals');
    if (outputOffset + literalLength > output.byteLength) throw new Error('LZ4 literals exceed output');
    output.set(input.subarray(cursor.value, cursor.value + literalLength), outputOffset);
    cursor.value += literalLength;
    outputOffset += literalLength;

    if (cursor.value === input.byteLength) break;
    if (cursor.value + 2 > input.byteLength) throw new Error('truncated LZ4 match offset');
    const matchOffset = input[cursor.value]! | (input[cursor.value + 1]! << 8);
    cursor.value += 2;
    if (matchOffset === 0 || matchOffset > outputOffset) throw new Error('invalid LZ4 match offset');

    const matchLength = readLength(input, cursor, token & 0x0f) + MIN_MATCH;
    if (outputOffset + matchLength > output.byteLength) throw new Error('LZ4 match exceeds output');
    const reference = outputOffset - matchOffset;
    for (let index = 0; index < matchLength; index += 1) {
      output[outputOffset + index] = output[reference + index]!;
    }
    outputOffset += matchLength;
  }

  if (outputOffset !== expectedByteLength) {
    throw new Error(`LZ4 output length mismatch: expected ${expectedByteLength}, got ${outputOffset}`);
  }
  return output;
}
