export const IBIS_BRUSH_ENVELOPE_SCHEMA_V1 = 'illustro.ibis-brush-envelope/1' as const;
export const IBIS_BRUSH_MAGIC_V1 = 'IPBZ' as const;
export const IBIS_BRUSH_MAGIC_BYTES_V1 = Object.freeze([0x49, 0x50, 0x42, 0x5a] as const);
export const IBIS_BRUSH_ENVELOPE_MAX_BYTES_V1 = 4096;

export interface IbisBrushEnvelopeV1 {
  readonly schema: typeof IBIS_BRUSH_ENVELOPE_SCHEMA_V1;
  readonly magic: typeof IBIS_BRUSH_MAGIC_V1;
  readonly byteLength: number;
  readonly body: Uint8Array;
  readonly sourceBytes: Uint8Array;
}

function hasMagicV1(bytes: Uint8Array): boolean {
  return IBIS_BRUSH_MAGIC_BYTES_V1.every((value, index) => bytes[index] === value);
}

export function parseIbisBrushEnvelopeV1(source: Uint8Array): IbisBrushEnvelopeV1 {
  if (!(source instanceof Uint8Array)) throw new TypeError('ibis brush payload must be Uint8Array');
  if (source.byteLength <= IBIS_BRUSH_MAGIC_BYTES_V1.length) {
    throw new RangeError('ibis brush payload is truncated');
  }
  if (source.byteLength > IBIS_BRUSH_ENVELOPE_MAX_BYTES_V1) {
    throw new RangeError('ibis brush payload exceeds the QR envelope limit');
  }
  if (!hasMagicV1(source)) throw new TypeError('invalid ibis brush payload magic');

  const sourceBytes = Uint8Array.from(source);
  return Object.freeze({
    schema: IBIS_BRUSH_ENVELOPE_SCHEMA_V1,
    magic: IBIS_BRUSH_MAGIC_V1,
    byteLength: sourceBytes.byteLength,
    body: sourceBytes.slice(IBIS_BRUSH_MAGIC_BYTES_V1.length),
    sourceBytes,
  });
}
