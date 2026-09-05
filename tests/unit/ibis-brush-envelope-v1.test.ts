import { describe, expect, it } from 'vitest';
import {
  IBIS_BRUSH_ENVELOPE_MAX_BYTES_V1,
  IBIS_BRUSH_MAGIC_BYTES_V1,
  parseIbisBrushEnvelopeV1,
} from '../../src/interchange/ibis-brush-envelope-v1.js';

describe('M6B-005 ibis brush IPBZ envelope boundary', () => {
  it('accepts the observed IPBZ carrier magic while preserving unknown body bytes verbatim', () => {
    const source = new Uint8Array([...IBIS_BRUSH_MAGIC_BYTES_V1, 0x00, 0xff, 0x18, 0x42]);
    const parsed = parseIbisBrushEnvelopeV1(source);

    expect(parsed).toMatchObject({
      schema: 'illustro.ibis-brush-envelope/1',
      magic: 'IPBZ',
      byteLength: 8,
    });
    expect([...parsed.body]).toEqual([0x00, 0xff, 0x18, 0x42]);
    expect([...parsed.sourceBytes]).toEqual([...source]);
  });

  it('returns copy-owned source and body bytes', () => {
    const source = new Uint8Array([...IBIS_BRUSH_MAGIC_BYTES_V1, 1, 2, 3]);
    const parsed = parseIbisBrushEnvelopeV1(source);
    source[4] = 9;
    parsed.body[1] = 8;

    expect([...parsed.sourceBytes]).toEqual([...IBIS_BRUSH_MAGIC_BYTES_V1, 1, 2, 3]);
    expect(parsed.sourceBytes[5]).toBe(2);
  });

  it('rejects non-IPBZ, truncated, and oversized carrier payloads fail closed', () => {
    expect(() => parseIbisBrushEnvelopeV1(new Uint8Array([0x49, 0x50, 0x42, 0x59, 1]))).toThrow(
      'magic',
    );
    expect(() => parseIbisBrushEnvelopeV1(new Uint8Array(IBIS_BRUSH_MAGIC_BYTES_V1))).toThrow(
      'truncated',
    );
    const oversized = new Uint8Array(IBIS_BRUSH_ENVELOPE_MAX_BYTES_V1 + 1);
    oversized.set(IBIS_BRUSH_MAGIC_BYTES_V1);
    expect(() => parseIbisBrushEnvelopeV1(oversized)).toThrow('QR envelope limit');
  });
});
