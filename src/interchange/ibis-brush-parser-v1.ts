import {
  parseIbisBrushEnvelopeV1,
  type IbisBrushEnvelopeV1,
} from './ibis-brush-envelope-v1.js';

export const IBIS_BRUSH_PARSER_SCHEMA_V1 = 'illustro.ibis-brush-parser/1' as const;
export const IBIS_BRUSH_CARRIER_HEADER_BYTES_V1 = 4;
export const IBIS_BRUSH_INNER_HEADER_BYTES_V1 = 8;
export const IBIS_BRUSH_INNER_TRAILER_BYTES_V1 = 4;
export const IBIS_BRUSH_NAME_LENGTH_OFFSET_V1 = 196;
export const IBIS_BRUSH_NAME_OFFSET_V1 = 198;
export const IBIS_BRUSH_DECODED_MAX_BYTES_V1 = 16 * 1024 * 1024;
export const IBIS_BRUSH_INNER_SIGNATURE_V1 = Object.freeze([0x01, 0x00, 0x02, 0x02] as const);

export interface IbisBrushParserOptionsV1 {
  readonly maxDecodedBytes?: number;
}

export interface IbisBrushPayloadV1 {
  readonly schema: typeof IBIS_BRUSH_PARSER_SCHEMA_V1;
  readonly envelope: IbisBrushEnvelopeV1;
  readonly carrierHeader: Uint8Array;
  readonly compressedBody: Uint8Array;
  readonly decodedBytes: Uint8Array;
  readonly innerSignature: Uint8Array;
  readonly declaredPayloadByteLength: number;
  readonly parameterPrefix: Uint8Array;
  readonly name: string;
  readonly nameBytes: Uint8Array;
  readonly postNamePayload: Uint8Array;
  readonly trailer: Uint8Array;
}

const utf8Decoder = new TextDecoder('utf-8', { fatal: true });

function viewOf(bytes: Uint8Array): DataView {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

function readU32BigEndian(bytes: Uint8Array, offset: number): number {
  if (offset < 0 || offset + 4 > bytes.byteLength) throw new RangeError('ibis brush uint32 is truncated');
  return viewOf(bytes).getUint32(offset, false);
}

function readU16BigEndian(bytes: Uint8Array, offset: number): number {
  if (offset < 0 || offset + 2 > bytes.byteLength) throw new RangeError('ibis brush uint16 is truncated');
  return viewOf(bytes).getUint16(offset, false);
}

function hasInnerSignatureV1(bytes: Uint8Array): boolean {
  return IBIS_BRUSH_INNER_SIGNATURE_V1.every((value, index) => bytes[index] === value);
}

function normalizedDecodedLimitV1(value: number | undefined): number {
  const limit = value ?? IBIS_BRUSH_DECODED_MAX_BYTES_V1;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > IBIS_BRUSH_DECODED_MAX_BYTES_V1) {
    throw new RangeError('invalid ibis brush decoded byte limit');
  }
  return limit;
}

async function inflateRawLimitedV1(source: Uint8Array, maxDecodedBytes: number): Promise<Uint8Array> {
  if (typeof DecompressionStream !== 'function') {
    throw new TypeError('raw deflate is unsupported in this runtime');
  }

  const input = new Blob([source.slice()]);
  const stream = input.stream().pipeThrough(new DecompressionStream('deflate-raw'));
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      const chunk = result.value;
      total += chunk.byteLength;
      if (total > maxDecodedBytes) {
        await reader.cancel();
        throw new RangeError('ibis brush decoded payload exceeds the safety limit');
      }
      chunks.push(Uint8Array.from(chunk));
    }
  } finally {
    reader.releaseLock();
  }

  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}

export async function parseIbisBrushPayloadV1(
  source: Uint8Array,
  options: IbisBrushParserOptionsV1 = {},
): Promise<IbisBrushPayloadV1> {
  const envelope = parseIbisBrushEnvelopeV1(source);
  if (envelope.body.byteLength <= IBIS_BRUSH_CARRIER_HEADER_BYTES_V1) {
    throw new RangeError('ibis brush compressed body is truncated');
  }

  const carrierHeader = envelope.body.slice(0, IBIS_BRUSH_CARRIER_HEADER_BYTES_V1);
  const compressedBody = envelope.body.slice(IBIS_BRUSH_CARRIER_HEADER_BYTES_V1);
  const maxDecodedBytes = normalizedDecodedLimitV1(options.maxDecodedBytes);

  let decodedBytes: Uint8Array;
  try {
    decodedBytes = await inflateRawLimitedV1(compressedBody, maxDecodedBytes);
  } catch (error) {
    if (error instanceof RangeError) throw error;
    throw new TypeError('invalid ibis brush raw-deflate body');
  }

  if (decodedBytes.byteLength < IBIS_BRUSH_NAME_OFFSET_V1 + IBIS_BRUSH_INNER_TRAILER_BYTES_V1) {
    throw new RangeError('ibis brush decoded payload is truncated');
  }
  if (!hasInnerSignatureV1(decodedBytes)) {
    throw new TypeError('invalid ibis brush inner signature');
  }

  const declaredPayloadByteLength = readU32BigEndian(decodedBytes, 4);
  const expectedDecodedByteLength =
    IBIS_BRUSH_INNER_HEADER_BYTES_V1 +
    declaredPayloadByteLength +
    IBIS_BRUSH_INNER_TRAILER_BYTES_V1;
  if (expectedDecodedByteLength !== decodedBytes.byteLength) {
    throw new RangeError('ibis brush declared payload length mismatch');
  }

  const payloadEnd = decodedBytes.byteLength - IBIS_BRUSH_INNER_TRAILER_BYTES_V1;
  const nameByteLength = readU16BigEndian(decodedBytes, IBIS_BRUSH_NAME_LENGTH_OFFSET_V1);
  const nameEnd = IBIS_BRUSH_NAME_OFFSET_V1 + nameByteLength;
  if (nameEnd > payloadEnd) throw new RangeError('ibis brush name exceeds declared payload');

  const nameBytes = decodedBytes.slice(IBIS_BRUSH_NAME_OFFSET_V1, nameEnd);
  let name: string;
  try {
    name = utf8Decoder.decode(nameBytes);
  } catch {
    throw new TypeError('ibis brush name is not valid UTF-8');
  }

  return Object.freeze({
    schema: IBIS_BRUSH_PARSER_SCHEMA_V1,
    envelope,
    carrierHeader,
    compressedBody,
    decodedBytes: decodedBytes.slice(),
    innerSignature: decodedBytes.slice(0, IBIS_BRUSH_INNER_SIGNATURE_V1.length),
    declaredPayloadByteLength,
    parameterPrefix: decodedBytes.slice(IBIS_BRUSH_INNER_HEADER_BYTES_V1, IBIS_BRUSH_NAME_LENGTH_OFFSET_V1),
    name,
    nameBytes,
    postNamePayload: decodedBytes.slice(nameEnd, payloadEnd),
    trailer: decodedBytes.slice(payloadEnd),
  });
}
