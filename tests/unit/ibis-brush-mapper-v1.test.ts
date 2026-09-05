import { describe, expect, it } from 'vitest';
import { brushParameterLimitsV1 } from '../../src/domain/brush-schema.js';
import { IBIS_BRUSH_MAGIC_BYTES_V1 } from '../../src/interchange/ibis-brush-envelope-v1.js';
import {
  IBIS_BRUSH_INNER_SIGNATURE_V1,
  IBIS_BRUSH_NAME_LENGTH_OFFSET_V1,
  IBIS_BRUSH_NAME_OFFSET_V1,
  parseIbisBrushPayloadV1,
} from '../../src/interchange/ibis-brush-parser-v1.js';
import {
  IBIS_BRUSH_IMPORTED_CATEGORY_V1,
  mapIbisBrushToIllustroV1,
} from '../../src/interchange/ibis-brush-mapper-v1.js';

function writeU16BigEndianV1(bytes: Uint8Array, offset: number, value: number): void {
  new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).setUint16(offset, value, false);
}

function writeU32BigEndianV1(bytes: Uint8Array, offset: number, value: number): void {
  new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).setUint32(offset, value, false);
}

function writeFloat32BigEndianV1(bytes: Uint8Array, offset: number, value: number): void {
  new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).setFloat32(offset, value, false);
}

function rawStoredDeflateV1(source: Uint8Array): Uint8Array {
  if (source.byteLength > 0xffff) throw new RangeError('test raw DEFLATE fixture is too large');
  const output = new Uint8Array(source.byteLength + 5);
  output[0] = 0x01;
  output[1] = source.byteLength & 0xff;
  output[2] = (source.byteLength >>> 8) & 0xff;
  const inverseLength = ~source.byteLength & 0xffff;
  output[3] = inverseLength & 0xff;
  output[4] = (inverseLength >>> 8) & 0xff;
  output.set(source, 5);
  return output;
}

function fixtureDecodedV1(input: {
  readonly name?: string;
  readonly sourceTypeId?: number;
  readonly sizeMinPx: number;
  readonly sizeMaxPx: number;
}): Uint8Array {
  const nameBytes = new TextEncoder().encode(input.name ?? 'Imported ibis brush');
  const decoded = new Uint8Array(256);
  decoded.set(IBIS_BRUSH_INNER_SIGNATURE_V1, 0);
  writeU32BigEndianV1(decoded, 4, decoded.byteLength - 12);
  writeU32BigEndianV1(decoded, 16, input.sourceTypeId ?? 4);
  writeFloat32BigEndianV1(decoded, 20, input.sizeMinPx);
  writeFloat32BigEndianV1(decoded, 24, input.sizeMaxPx);
  decoded[40] = 0xa1;
  decoded[80] = 0xb2;
  decoded[IBIS_BRUSH_NAME_LENGTH_OFFSET_V1 - 1] = 0xc3;
  writeU16BigEndianV1(decoded, IBIS_BRUSH_NAME_LENGTH_OFFSET_V1, nameBytes.byteLength);
  decoded.set(nameBytes, IBIS_BRUSH_NAME_OFFSET_V1);
  const nameEnd = IBIS_BRUSH_NAME_OFFSET_V1 + nameBytes.byteLength;
  decoded[nameEnd] = 0xd4;
  decoded[nameEnd + 1] = 0xe5;
  decoded.set([0xff, 0xff, 0xff, 0xff], decoded.byteLength - 4);
  return decoded;
}

function fixtureCarrierV1(
  decoded: Uint8Array,
  carrierHeader: readonly number[] = [0x00, 0x01, 0xd5, 0x88],
): Uint8Array {
  return new Uint8Array([
    ...IBIS_BRUSH_MAGIC_BYTES_V1,
    ...carrierHeader,
    ...rawStoredDeflateV1(decoded),
  ]);
}

async function mappedFixtureV1(input: {
  readonly name?: string;
  readonly sourceTypeId?: number;
  readonly sizeMinPx: number;
  readonly sizeMaxPx: number;
}) {
  const payload = await parseIbisBrushPayloadV1(fixtureCarrierV1(fixtureDecodedV1(input)));
  return {
    payload,
    result: mapIbisBrushToIllustroV1({ payload, presetId: 'user.ibis.fixture' }),
  };
}

describe('M6B-007 ibis to Illustro parameter mapper', () => {
  it('maps the observed version, source type and exact size range into a canonical preset', async () => {
    const { result } = await mappedFixtureV1({
      name: 'Exact range',
      sourceTypeId: 4,
      sizeMinPx: 12,
      sizeMaxPx: 96,
    });

    expect(result).toMatchObject({
      schema: 'illustro.ibis-brush-mapper/1',
      sizeRangeMapping: 'exact',
      observed: {
        carrierVersionHex: '0001d588',
        sourceTypeId: 4,
        sourceSizeMinPx: 12,
        sourceSizeMaxPx: 96,
      },
    });
    expect(result.preset).toMatchObject({
      id: 'user.ibis.fixture',
      name: 'Exact range',
      category: IBIS_BRUSH_IMPORTED_CATEGORY_V1,
      behavior: 'paint',
      defaultSizePx: 16,
      provenance: {
        sourceFormat: 'ibisPaint-IPBZ',
        sourceCarrierVersion: '0001d588',
        sourceTypeId: 4,
      },
      importCompatibility: {
        sourceName: 'exact',
        sourceSizeRange: 'exact',
        unknownParameters: 'preserved-opaque',
      },
    });
    expect(brushParameterLimitsV1(result.preset).sizePx).toEqual({ min: 12, max: 96 });
  });

  it('converts only out-of-range size limits and keeps a usable deterministic default size', async () => {
    const lowerAndUpper = await mappedFixtureV1({ sizeMinPx: 0.5, sizeMaxPx: 16384 });
    expect(lowerAndUpper.result.sizeRangeMapping).toBe('converted');
    expect(brushParameterLimitsV1(lowerAndUpper.result.preset).sizePx).toEqual({
      min: 1,
      max: 4096,
    });
    expect(lowerAndUpper.result.preset.defaultSizePx).toBe(16);

    const largeOnly = await mappedFixtureV1({ sizeMinPx: 721, sizeMaxPx: 1000 });
    expect(largeOnly.result.sizeRangeMapping).toBe('exact');
    expect(largeOnly.result.preset.defaultSizePx).toBe(721);
  });

  it('preserves unexplained source fields as opaque hexadecimal provenance without semantic guesses', async () => {
    const { payload, result } = await mappedFixtureV1({ sizeMinPx: 1, sizeMaxPx: 64 });
    const sourceExtension = result.preset.extensions.ibisPaintSource;
    expect(sourceExtension).toMatchObject({
      carrierVersionHex: '0001d588',
      sourceTypeId: 4,
      sourceSizeMinPx: 1,
      sourceSizeMaxPx: 64,
    });
    expect(JSON.stringify(sourceExtension)).toContain('a1');
    expect(JSON.stringify(sourceExtension)).toContain('b2');
    expect(JSON.stringify(sourceExtension)).toContain('d4e5');
    expect(JSON.stringify(sourceExtension)).toContain('ffffffff');

    const beforeMutation = JSON.stringify(sourceExtension);
    payload.parameterPrefix.fill(0);
    payload.postNamePayload.fill(0);
    payload.trailer.fill(0);
    expect(JSON.stringify(result.preset.extensions.ibisPaintSource)).toBe(beforeMutation);
  });

  it('rejects carrier versions outside the single observed supported version', async () => {
    const payload = await parseIbisBrushPayloadV1(
      fixtureCarrierV1(fixtureDecodedV1({ sizeMinPx: 1, sizeMaxPx: 64 }), [0, 1, 0, 0]),
    );
    expect(() => mapIbisBrushToIllustroV1({ payload, presetId: 'user.ibis.version' })).toThrow(
      'unsupported ibis brush carrier version',
    );
  });

  it('fails closed on invalid or reversed observed size ranges', async () => {
    const invalid = await parseIbisBrushPayloadV1(
      fixtureCarrierV1(fixtureDecodedV1({ sizeMinPx: Number.NaN, sizeMaxPx: 64 })),
    );
    expect(() => mapIbisBrushToIllustroV1({ payload: invalid, presetId: 'user.ibis.nan' })).toThrow(
      'invalid ibis brush observed size range',
    );

    const reversed = await parseIbisBrushPayloadV1(
      fixtureCarrierV1(fixtureDecodedV1({ sizeMinPx: 64, sizeMaxPx: 1 })),
    );
    expect(() =>
      mapIbisBrushToIllustroV1({ payload: reversed, presetId: 'user.ibis.reversed' }),
    ).toThrow('invalid ibis brush observed size range');
  });
});
