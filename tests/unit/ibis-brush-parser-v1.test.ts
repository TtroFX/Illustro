import { describe, expect, it } from 'vitest';
import { IBIS_BRUSH_MAGIC_BYTES_V1 } from '../../src/interchange/ibis-brush-envelope-v1.js';
import {
  IBIS_BRUSH_INNER_SIGNATURE_V1,
  IBIS_BRUSH_NAME_LENGTH_OFFSET_V1,
  IBIS_BRUSH_NAME_OFFSET_V1,
  parseIbisBrushPayloadV1,
} from '../../src/interchange/ibis-brush-parser-v1.js';

function writeU16BigEndian(bytes: Uint8Array, offset: number, value: number): void {
  new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).setUint16(offset, value, false);
}

function writeU32BigEndian(bytes: Uint8Array, offset: number, value: number): void {
  new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).setUint32(offset, value, false);
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

function fixtureDecodedV1(name = 'Synthetic ibis brush'): Uint8Array {
  const encodedName = new TextEncoder().encode(name);
  const decoded = new Uint8Array(256);
  decoded.set(IBIS_BRUSH_INNER_SIGNATURE_V1, 0);
  writeU32BigEndian(decoded, 4, decoded.byteLength - 12);
  decoded[8] = 0x2a;
  decoded[IBIS_BRUSH_NAME_LENGTH_OFFSET_V1 - 1] = 0x7b;
  writeU16BigEndian(decoded, IBIS_BRUSH_NAME_LENGTH_OFFSET_V1, encodedName.byteLength);
  decoded.set(encodedName, IBIS_BRUSH_NAME_OFFSET_V1);
  const nameEnd = IBIS_BRUSH_NAME_OFFSET_V1 + encodedName.byteLength;
  decoded[nameEnd] = 0x91;
  decoded[nameEnd + 1] = 0x92;
  decoded.set([0xff, 0xff, 0xfe, 0xf0], decoded.byteLength - 4);
  return decoded;
}

function fixtureCarrierV1(decoded = fixtureDecodedV1()): Uint8Array {
  return new Uint8Array([
    ...IBIS_BRUSH_MAGIC_BYTES_V1,
    0x00,
    0x01,
    0xd5,
    0x88,
    ...rawStoredDeflateV1(decoded),
  ]);
}

describe('M6B-005 structured ibis IPBZ brush parser', () => {
  it('decodes raw DEFLATE and extracts the observed inner framing and UTF-8 brush name', async () => {
    const parsed = await parseIbisBrushPayloadV1(fixtureCarrierV1());

    expect(parsed).toMatchObject({
      schema: 'illustro.ibis-brush-parser/1',
      declaredPayloadByteLength: 244,
      name: 'Synthetic ibis brush',
    });
    expect([...parsed.carrierHeader]).toEqual([0x00, 0x01, 0xd5, 0x88]);
    expect([...parsed.innerSignature]).toEqual([...IBIS_BRUSH_INNER_SIGNATURE_V1]);
    expect(parsed.parameterPrefix).toHaveLength(IBIS_BRUSH_NAME_LENGTH_OFFSET_V1 - 8);
    expect(parsed.parameterPrefix[0]).toBe(0x2a);
    expect(parsed.parameterPrefix.at(-1)).toBe(0x7b);
    expect([...parsed.postNamePayload.slice(0, 2)]).toEqual([0x91, 0x92]);
    expect([...parsed.trailer]).toEqual([0xff, 0xff, 0xfe, 0xf0]);
  });

  it('preserves copy-owned compressed, decoded, name, parameter, and trailer bytes', async () => {
    const source = fixtureCarrierV1();
    const parsed = await parseIbisBrushPayloadV1(source);
    source.fill(0);
    parsed.decodedBytes.fill(0);

    expect(parsed.envelope.magic).toBe('IPBZ');
    expect(parsed.name).toBe('Synthetic ibis brush');
    expect(parsed.nameBytes.byteLength).toBeGreaterThan(0);
    expect(parsed.parameterPrefix[0]).toBe(0x2a);
    expect([...parsed.trailer]).toEqual([0xff, 0xff, 0xfe, 0xf0]);
  });

  it('rejects an invalid observed inner signature and declared length mismatch', async () => {
    const badSignature = fixtureDecodedV1();
    badSignature[0] = 0x02;
    await expect(parseIbisBrushPayloadV1(fixtureCarrierV1(badSignature))).rejects.toThrow(
      'inner signature',
    );

    const badLength = fixtureDecodedV1();
    writeU32BigEndian(badLength, 4, 1);
    await expect(parseIbisBrushPayloadV1(fixtureCarrierV1(badLength))).rejects.toThrow(
      'length mismatch',
    );
  });

  it('rejects names that exceed the declared payload or are invalid UTF-8', async () => {
    const oversizedName = fixtureDecodedV1('x');
    writeU16BigEndian(oversizedName, IBIS_BRUSH_NAME_LENGTH_OFFSET_V1, 0xffff);
    await expect(parseIbisBrushPayloadV1(fixtureCarrierV1(oversizedName))).rejects.toThrow(
      'name exceeds',
    );

    const invalidUtf8 = fixtureDecodedV1('x');
    writeU16BigEndian(invalidUtf8, IBIS_BRUSH_NAME_LENGTH_OFFSET_V1, 2);
    invalidUtf8[IBIS_BRUSH_NAME_OFFSET_V1] = 0xc3;
    invalidUtf8[IBIS_BRUSH_NAME_OFFSET_V1 + 1] = 0x28;
    await expect(parseIbisBrushPayloadV1(fixtureCarrierV1(invalidUtf8))).rejects.toThrow('UTF-8');
  });

  it('enforces a streaming decoded-size ceiling and rejects malformed raw DEFLATE', async () => {
    await expect(
      parseIbisBrushPayloadV1(fixtureCarrierV1(), { maxDecodedBytes: 128 }),
    ).rejects.toThrow('safety limit');

    const malformed = new Uint8Array([
      ...IBIS_BRUSH_MAGIC_BYTES_V1,
      0x00,
      0x01,
      0xd5,
      0x88,
      0xff,
      0xff,
      0xff,
    ]);
    await expect(parseIbisBrushPayloadV1(malformed)).rejects.toThrow('raw-deflate');
  });
});
