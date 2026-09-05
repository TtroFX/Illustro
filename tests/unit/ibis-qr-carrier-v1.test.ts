import { describe, expect, it } from 'vitest';
import { IBIS_BRUSH_MAGIC_BYTES_V1 } from '../../src/interchange/ibis-brush-envelope-v1.js';
import {
  IBIS_QR_IMAGE_MAX_DIMENSION_V1,
  decodeIbisBrushQrPixelsV1,
  type JsQrDecoderV1,
} from '../../src/interchange/ibis-qr-carrier-v1.js';

function pixelsV1(width = 2, height = 2): Uint8ClampedArray {
  return new Uint8ClampedArray(width * height * 4).fill(255);
}

function decoderV1(payload: readonly number[], version = 7): JsQrDecoderV1 {
  return (_rgba, _width, _height, options) => {
    expect(options?.inversionAttempts).toBe('attemptBoth');
    return {
      binaryData: Uint8ClampedArray.from(payload),
      data: 'text representation is intentionally ignored',
      version,
    };
  };
}

describe('M6B-006 ibis QR binary carrier decode', () => {
  it('returns binaryData bytes verbatim instead of lossy QR text', () => {
    const payload = [...IBIS_BRUSH_MAGIC_BYTES_V1, 0x00, 0x01, 0xd5, 0x88, 0xff, 0x80, 0x00];
    const decoded = decodeIbisBrushQrPixelsV1(pixelsV1(), 2, 2, decoderV1(payload));

    expect(decoded.schema).toBe('illustro.ibis-qr-carrier/1');
    expect([...decoded.payload]).toEqual(payload);
    expect(decoded.qrVersion).toBe(7);
  });

  it('rejects QR payloads that are not an IPBZ brush carrier', () => {
    const payload = [0x68, 0x74, 0x74, 0x70, 0x73, 0x3a, 0x2f, 0x2f];
    expect(() => decodeIbisBrushQrPixelsV1(pixelsV1(), 2, 2, decoderV1(payload))).toThrow('magic');
  });

  it('rejects missing QR results and malformed image buffers fail closed', () => {
    const noCode: JsQrDecoderV1 = () => null;
    expect(() => decodeIbisBrushQrPixelsV1(pixelsV1(), 2, 2, noCode)).toThrow('not found');
    expect(() => decodeIbisBrushQrPixelsV1(new Uint8ClampedArray(15), 2, 2, noCode)).toThrow(
      'byte length',
    );
    expect(() => decodeIbisBrushQrPixelsV1(pixelsV1(), 0, 2, noCode)).toThrow('dimensions');
  });

  it('enforces image dimension and pixel safety limits before decoder execution', () => {
    let called = false;
    const decoder: JsQrDecoderV1 = () => {
      called = true;
      return null;
    };
    const tooWide = IBIS_QR_IMAGE_MAX_DIMENSION_V1 + 1;
    expect(() => decodeIbisBrushQrPixelsV1(new Uint8ClampedArray(0), tooWide, 1, decoder)).toThrow(
      'safety limit',
    );
    expect(called).toBe(false);
  });
});
