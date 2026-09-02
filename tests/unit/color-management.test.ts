import { describe, expect, it } from 'vitest';
import {
  convertEncodedRgbV1,
  convertEncodedRgbWithReportV1,
  convertProfileEncodedRgbV1,
  decodeSrgbTransferComponentV1,
  encodeSrgbTransferComponentV1,
  parseIccRgbMatrixProfileV1,
  UnsupportedIccProfileErrorV1,
} from '../../src/domain/color-management.js';

function writeSignature(bytes: Uint8Array, offset: number, signature: string): void {
  for (let index = 0; index < 4; index += 1) bytes[offset + index] = signature.charCodeAt(index);
}

function writeFixed(view: DataView, offset: number, value: number): void {
  view.setInt32(offset, Math.round(value * 65536), false);
}

function xyzTag(values: readonly [number, number, number]): Uint8Array {
  const bytes = new Uint8Array(20);
  const view = new DataView(bytes.buffer);
  writeSignature(bytes, 0, 'XYZ ');
  writeFixed(view, 8, values[0]);
  writeFixed(view, 12, values[1]);
  writeFixed(view, 16, values[2]);
  return bytes;
}

function srgbParametricTrc(): Uint8Array {
  const bytes = new Uint8Array(40);
  const view = new DataView(bytes.buffer);
  writeSignature(bytes, 0, 'para');
  view.setUint16(8, 4, false);
  const parameters = [2.4, 1 / 1.055, 0.055 / 1.055, 1 / 12.92, 0.04045, 0, 0];
  parameters.forEach((value, index) => {
    writeFixed(view, 12 + index * 4, value);
  });
  return bytes;
}

function syntheticSrgbMatrixProfile(): Uint8Array {
  const entries = [
    ['rXYZ', xyzTag([0.4360747, 0.2225045, 0.0139322])],
    ['gXYZ', xyzTag([0.3850649, 0.7168786, 0.0971045])],
    ['bXYZ', xyzTag([0.1430804, 0.0606169, 0.7141733])],
    ['rTRC', srgbParametricTrc()],
    ['gTRC', srgbParametricTrc()],
    ['bTRC', srgbParametricTrc()],
  ] as const;
  const tableBytes = 4 + entries.length * 12;
  let cursor = 128 + tableBytes;
  const offsets = entries.map(([, payload]) => {
    const offset = cursor;
    cursor += payload.byteLength;
    cursor = (cursor + 3) & ~3;
    return offset;
  });
  const bytes = new Uint8Array(cursor);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, bytes.byteLength, false);
  bytes[8] = 4;
  writeSignature(bytes, 12, 'mntr');
  writeSignature(bytes, 16, 'RGB ');
  writeSignature(bytes, 20, 'XYZ ');
  view.setUint32(128, entries.length, false);
  entries.forEach(([signature, payload], index) => {
    const entryOffset = 132 + index * 12;
    writeSignature(bytes, entryOffset, signature);
    view.setUint32(entryOffset + 4, offsets[index] ?? 0, false);
    view.setUint32(entryOffset + 8, payload.byteLength, false);
    bytes.set(payload, offsets[index] ?? 0);
  });
  return bytes;
}

describe('M5D color management', () => {
  it('implements the standard sRGB transfer function', () => {
    expect(decodeSrgbTransferComponentV1(0.04045)).toBeCloseTo(0.0031308, 7);
    expect(encodeSrgbTransferComponentV1(0.0031308)).toBeCloseTo(0.0404499, 6);
    const decoded = decodeSrgbTransferComponentV1(0.5);
    expect(encodeSrgbTransferComponentV1(decoded)).toBeCloseTo(0.5, 12);
  });

  it('converts encoded sRGB and Display-P3 through D65 linear RGB', () => {
    const p3 = convertEncodedRgbV1([1, 0, 0], 'srgb', 'display-p3');
    expect(p3[0]).toBeCloseTo(0.9175, 3);
    expect(p3[1]).toBeCloseTo(0.2003, 3);
    expect(p3[2]).toBeCloseTo(0.1386, 3);
    const roundTrip = convertEncodedRgbV1(p3, 'display-p3', 'srgb');
    expect(roundTrip[0]).toBeCloseTo(1, 5);
    expect(roundTrip[1]).toBeCloseTo(0, 5);
    expect(roundTrip[2]).toBeCloseTo(0, 5);
  });

  it('reports clipping when a Display-P3 color is outside sRGB', () => {
    const result = convertEncodedRgbWithReportV1([1, 0, 0], 'display-p3', 'srgb');
    expect(result.clipped).toBe(true);
    expect(result.color).toEqual([1, 0, 0]);
  });

  it('parses a matrix/TRC RGB ICC profile and converts it into the document space', () => {
    const profile = parseIccRgbMatrixProfileV1(syntheticSrgbMatrixProfile());
    expect(profile.kind).toBe('icc-rgb-matrix-trc');
    expect(profile.versionMajor).toBe(4);
    const source = [0.2, 0.4, 0.8] as const;
    const converted = convertProfileEncodedRgbV1(source, profile, 'srgb');
    expect(converted.color[0]).toBeCloseTo(source[0], 2);
    expect(converted.color[1]).toBeCloseTo(source[1], 2);
    expect(converted.color[2]).toBeCloseTo(source[2], 2);
  });

  it('rejects non-RGB ICC profiles instead of silently reinterpreting them', () => {
    const bytes = syntheticSrgbMatrixProfile();
    writeSignature(bytes, 16, 'CMYK');
    expect(() => parseIccRgbMatrixProfileV1(bytes)).toThrow(UnsupportedIccProfileErrorV1);
  });
});
