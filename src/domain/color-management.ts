import { freezeRgbUnitColorV1, type RgbUnitColorV1 } from './color.js';
import type { DocumentColorProfileV1, DocumentColorSpace } from './document.js';

export type GamutMappingModeV1 = 'clip';
export type IccPcsV1 = 'xyz-d50';

type Matrix3V1 = readonly [number, number, number, number, number, number, number, number, number];

type Vector3V1 = readonly [number, number, number];

export interface IccParametricToneCurveV1 {
  readonly kind: 'parametric';
  readonly functionType: 0 | 1 | 2 | 3 | 4;
  readonly parameters: readonly number[];
}

export interface IccSampledToneCurveV1 {
  readonly kind: 'sampled';
  readonly values: readonly number[];
}

export type IccToneCurveV1 = IccParametricToneCurveV1 | IccSampledToneCurveV1;

export interface IccRgbMatrixProfileV1 {
  readonly schema: 'illustro.icc-rgb-matrix-profile/1';
  readonly kind: 'icc-rgb-matrix-trc';
  readonly versionMajor: number;
  readonly deviceClass: string;
  readonly pcs: IccPcsV1;
  readonly matrixToXyzD50: Matrix3V1;
  readonly redTrc: IccToneCurveV1;
  readonly greenTrc: IccToneCurveV1;
  readonly blueTrc: IccToneCurveV1;
}

export type InputColorProfileV1 = DocumentColorProfileV1 | IccRgbMatrixProfileV1;

export interface EncodedRgbConversionResultV1 {
  readonly color: RgbUnitColorV1;
  readonly sourceSpace: DocumentColorSpace | 'icc-rgb-matrix-trc';
  readonly targetSpace: DocumentColorSpace;
  readonly gamutMapping: GamutMappingModeV1;
  readonly clipped: boolean;
}

export class UnsupportedIccProfileErrorV1 extends Error {
  readonly code = 'unsupported-icc-profile' as const;

  constructor(message: string) {
    super(message);
    this.name = 'UnsupportedIccProfileErrorV1';
  }
}

const SRGB_TO_XYZ_D65: Matrix3V1 = Object.freeze([
  0.4124564, 0.3575761, 0.1804375, 0.2126729, 0.7151522, 0.072175, 0.0193339, 0.119192, 0.9503041,
]);

const XYZ_D65_TO_SRGB: Matrix3V1 = Object.freeze([
  3.2404542, -1.5371385, -0.4985314, -0.969266, 1.8760108, 0.041556, 0.0556434, -0.2040259,
  1.0572252,
]);

const DISPLAY_P3_TO_XYZ_D65: Matrix3V1 = Object.freeze([
  0.4865709486482162, 0.26566769316909306, 0.1982172852343625, 0.2289745640697488,
  0.6917385218365064, 0.079286914093745, 0, 0.04511338185890264, 1.043944368900976,
]);

const XYZ_D65_TO_DISPLAY_P3: Matrix3V1 = Object.freeze([
  2.493496911941425, -0.9313836179191239, -0.40271078445071684, -0.8294889695615747,
  1.7626640603183463, 0.023624685841943577, 0.03584583024378447, -0.07617238926804182,
  0.9568845240076872,
]);

// ICC matrix/TRC profiles use PCS XYZ relative to D50. This Bradford transform
// moves those values into the D65 basis used by the two supported document RGB spaces.
const XYZ_D50_TO_D65: Matrix3V1 = Object.freeze([
  0.9555766, -0.0230393, 0.0631636, -0.0282895, 1.0099416, 0.0210077, 0.0122982, -0.020483,
  1.3299098,
]);

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function multiplyMatrixVector(matrix: Matrix3V1, vector: Vector3V1): Vector3V1 {
  return Object.freeze([
    matrix[0] * vector[0] + matrix[1] * vector[1] + matrix[2] * vector[2],
    matrix[3] * vector[0] + matrix[4] * vector[1] + matrix[5] * vector[2],
    matrix[6] * vector[0] + matrix[7] * vector[1] + matrix[8] * vector[2],
  ]);
}

export function decodeSrgbTransferComponentV1(encoded: number): number {
  if (!Number.isFinite(encoded)) throw new RangeError('encoded RGB component must be finite');
  const value = clamp01(encoded);
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

export function encodeSrgbTransferComponentV1(linear: number): number {
  if (!Number.isFinite(linear)) throw new RangeError('linear RGB component must be finite');
  const value = Math.max(0, linear);
  return value <= 0.0031308 ? 12.92 * value : 1.055 * value ** (1 / 2.4) - 0.055;
}

function decodeEncodedRgbV1(color: RgbUnitColorV1): Vector3V1 {
  return Object.freeze([
    decodeSrgbTransferComponentV1(color[0]),
    decodeSrgbTransferComponentV1(color[1]),
    decodeSrgbTransferComponentV1(color[2]),
  ]);
}

function encodeLinearRgbV1(color: Vector3V1): Vector3V1 {
  return Object.freeze([
    encodeSrgbTransferComponentV1(color[0]),
    encodeSrgbTransferComponentV1(color[1]),
    encodeSrgbTransferComponentV1(color[2]),
  ]);
}

function toXyzD65V1(linear: Vector3V1, sourceSpace: DocumentColorSpace): Vector3V1 {
  return multiplyMatrixVector(
    sourceSpace === 'display-p3' ? DISPLAY_P3_TO_XYZ_D65 : SRGB_TO_XYZ_D65,
    linear,
  );
}

function fromXyzD65V1(xyz: Vector3V1, targetSpace: DocumentColorSpace): Vector3V1 {
  return multiplyMatrixVector(
    targetSpace === 'display-p3' ? XYZ_D65_TO_DISPLAY_P3 : XYZ_D65_TO_SRGB,
    xyz,
  );
}

function clipEncodedV1(encoded: Vector3V1): {
  readonly color: RgbUnitColorV1;
  readonly clipped: boolean;
} {
  const clipped = encoded.some((component) => component < 0 || component > 1);
  return Object.freeze({
    color: freezeRgbUnitColorV1(encoded.map(clamp01)),
    clipped,
  });
}

export function convertEncodedRgbWithReportV1(
  color: RgbUnitColorV1,
  sourceSpace: DocumentColorSpace,
  targetSpace: DocumentColorSpace,
): EncodedRgbConversionResultV1 {
  if (sourceSpace === targetSpace) {
    return Object.freeze({
      color: freezeRgbUnitColorV1(color),
      sourceSpace,
      targetSpace,
      gamutMapping: 'clip' as const,
      clipped: false,
    });
  }
  const xyz = toXyzD65V1(decodeEncodedRgbV1(color), sourceSpace);
  const encoded = encodeLinearRgbV1(fromXyzD65V1(xyz, targetSpace));
  const result = clipEncodedV1(encoded);
  return Object.freeze({
    color: result.color,
    sourceSpace,
    targetSpace,
    gamutMapping: 'clip' as const,
    clipped: result.clipped,
  });
}

export function convertEncodedRgbV1(
  color: RgbUnitColorV1,
  sourceSpace: DocumentColorSpace,
  targetSpace: DocumentColorSpace,
): RgbUnitColorV1 {
  return convertEncodedRgbWithReportV1(color, sourceSpace, targetSpace).color;
}

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  if (offset < 0 || length < 0 || offset + length > bytes.byteLength) {
    throw new UnsupportedIccProfileErrorV1('ICC field is outside the profile byte range');
  }
  return String.fromCharCode(...bytes.subarray(offset, offset + length));
}

function readS15Fixed16(view: DataView, offset: number): number {
  return view.getInt32(offset, false) / 65536;
}

function parseXyzTag(bytes: Uint8Array, offset: number, size: number): Vector3V1 {
  if (size < 20 || ascii(bytes, offset, 4) !== 'XYZ ') {
    throw new UnsupportedIccProfileErrorV1('ICC matrix colorant tag must use XYZType');
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return Object.freeze([
    readS15Fixed16(view, offset + 8),
    readS15Fixed16(view, offset + 12),
    readS15Fixed16(view, offset + 16),
  ]);
}

function parseCurveTag(bytes: Uint8Array, offset: number, size: number): IccToneCurveV1 {
  if (size < 12) throw new UnsupportedIccProfileErrorV1('ICC TRC tag is truncated');
  const signature = ascii(bytes, offset, 4);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (signature === 'curv') {
    const count = view.getUint32(offset + 8, false);
    if (count === 0) {
      return Object.freeze({ kind: 'sampled' as const, values: Object.freeze([0, 1]) });
    }
    if (count === 1) {
      if (size < 14) throw new UnsupportedIccProfileErrorV1('ICC gamma curve is truncated');
      const gamma = view.getUint16(offset + 12, false) / 256;
      return Object.freeze({
        kind: 'parametric' as const,
        functionType: 0 as const,
        parameters: Object.freeze([gamma]),
      });
    }
    if (count > 65536 || 12 + count * 2 > size) {
      throw new UnsupportedIccProfileErrorV1('ICC sampled TRC count is invalid');
    }
    const values: number[] = [];
    for (let index = 0; index < count; index += 1) {
      values.push(view.getUint16(offset + 12 + index * 2, false) / 65535);
    }
    return Object.freeze({ kind: 'sampled' as const, values: Object.freeze(values) });
  }
  if (signature !== 'para') {
    throw new UnsupportedIccProfileErrorV1('ICC TRC must use curveType or parametricCurveType');
  }
  const functionType = view.getUint16(offset + 8, false);
  if (functionType < 0 || functionType > 4) {
    throw new UnsupportedIccProfileErrorV1(
      `ICC parametric TRC type ${functionType} is unsupported`,
    );
  }
  const parameterCounts = [1, 3, 4, 5, 7] as const;
  const count = parameterCounts[functionType];
  if (count === undefined || 12 + count * 4 > size) {
    throw new UnsupportedIccProfileErrorV1('ICC parametric TRC is truncated');
  }
  const parameters = Object.freeze(
    Array.from({ length: count }, (_, index) => readS15Fixed16(view, offset + 12 + index * 4)),
  );
  return Object.freeze({
    kind: 'parametric' as const,
    functionType: functionType as 0 | 1 | 2 | 3 | 4,
    parameters,
  });
}

function evaluateParametricCurve(curve: IccParametricToneCurveV1, input: number): number {
  const x = clamp01(input);
  const [g = 1, a = 1, b = 0, c = 0, d = 0, e = 0, f = 0] = curve.parameters;
  let output: number;
  switch (curve.functionType) {
    case 0:
      output = x ** g;
      break;
    case 1:
      output = a !== 0 && x >= -b / a ? (a * x + b) ** g : 0;
      break;
    case 2:
      output = a !== 0 && x >= -b / a ? (a * x + b) ** g + c : c;
      break;
    case 3:
      output = x >= d ? (a * x + b) ** g : c * x;
      break;
    case 4:
      output = x >= d ? (a * x + b) ** g + e : c * x + f;
      break;
  }
  return Number.isFinite(output) ? clamp01(output) : 0;
}

export function evaluateIccToneCurveV1(curve: IccToneCurveV1, input: number): number {
  if (!Number.isFinite(input)) throw new RangeError('ICC TRC input must be finite');
  if (curve.kind === 'parametric') return evaluateParametricCurve(curve, input);
  if (curve.values.length < 2) return clamp01(input);
  const position = clamp01(input) * (curve.values.length - 1);
  const lower = Math.floor(position);
  const upper = Math.min(curve.values.length - 1, lower + 1);
  const fraction = position - lower;
  const left = curve.values[lower] ?? 0;
  const right = curve.values[upper] ?? left;
  return clamp01(left + (right - left) * fraction);
}

export function parseIccRgbMatrixProfileV1(bytes: Uint8Array): IccRgbMatrixProfileV1 {
  if (bytes.byteLength < 132) throw new UnsupportedIccProfileErrorV1('ICC profile is too small');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const declaredSize = view.getUint32(0, false);
  if (declaredSize < 132 || declaredSize > bytes.byteLength) {
    throw new UnsupportedIccProfileErrorV1('ICC profile size field is invalid');
  }
  if (ascii(bytes, 16, 4) !== 'RGB ') {
    throw new UnsupportedIccProfileErrorV1('only RGB ICC input profiles are supported');
  }
  if (ascii(bytes, 20, 4) !== 'XYZ ') {
    throw new UnsupportedIccProfileErrorV1('only XYZ PCS matrix/TRC ICC profiles are supported');
  }
  const tagCount = view.getUint32(128, false);
  if (tagCount > 256 || 132 + tagCount * 12 > declaredSize) {
    throw new UnsupportedIccProfileErrorV1('ICC tag table is invalid');
  }
  const tags = new Map<string, { readonly offset: number; readonly size: number }>();
  for (let index = 0; index < tagCount; index += 1) {
    const entryOffset = 132 + index * 12;
    const signature = ascii(bytes, entryOffset, 4);
    const offset = view.getUint32(entryOffset + 4, false);
    const size = view.getUint32(entryOffset + 8, false);
    if (size === 0 || offset < 128 || offset + size > declaredSize) {
      throw new UnsupportedIccProfileErrorV1(`ICC tag ${signature} has an invalid range`);
    }
    tags.set(signature, Object.freeze({ offset, size }));
  }
  const required = (signature: string): { readonly offset: number; readonly size: number } => {
    const tag = tags.get(signature);
    if (tag === undefined) {
      throw new UnsupportedIccProfileErrorV1(`ICC matrix/TRC profile is missing ${signature}`);
    }
    return tag;
  };
  const redXyz = required('rXYZ');
  const greenXyz = required('gXYZ');
  const blueXyz = required('bXYZ');
  const red = parseXyzTag(bytes, redXyz.offset, redXyz.size);
  const green = parseXyzTag(bytes, greenXyz.offset, greenXyz.size);
  const blue = parseXyzTag(bytes, blueXyz.offset, blueXyz.size);
  const redTrc = required('rTRC');
  const greenTrc = required('gTRC');
  const blueTrc = required('bTRC');
  return Object.freeze({
    schema: 'illustro.icc-rgb-matrix-profile/1' as const,
    kind: 'icc-rgb-matrix-trc' as const,
    versionMajor: bytes[8] ?? 0,
    deviceClass: ascii(bytes, 12, 4),
    pcs: 'xyz-d50' as const,
    matrixToXyzD50: Object.freeze([
      red[0],
      green[0],
      blue[0],
      red[1],
      green[1],
      blue[1],
      red[2],
      green[2],
      blue[2],
    ]) as Matrix3V1,
    redTrc: parseCurveTag(bytes, redTrc.offset, redTrc.size),
    greenTrc: parseCurveTag(bytes, greenTrc.offset, greenTrc.size),
    blueTrc: parseCurveTag(bytes, blueTrc.offset, blueTrc.size),
  });
}

function convertIccToDocumentWithReportV1(
  color: RgbUnitColorV1,
  profile: IccRgbMatrixProfileV1,
  targetSpace: DocumentColorSpace,
): EncodedRgbConversionResultV1 {
  const sourceLinear: Vector3V1 = Object.freeze([
    evaluateIccToneCurveV1(profile.redTrc, color[0]),
    evaluateIccToneCurveV1(profile.greenTrc, color[1]),
    evaluateIccToneCurveV1(profile.blueTrc, color[2]),
  ]);
  const xyzD50 = multiplyMatrixVector(profile.matrixToXyzD50, sourceLinear);
  const xyzD65 = multiplyMatrixVector(XYZ_D50_TO_D65, xyzD50);
  const encoded = encodeLinearRgbV1(fromXyzD65V1(xyzD65, targetSpace));
  const result = clipEncodedV1(encoded);
  return Object.freeze({
    color: result.color,
    sourceSpace: 'icc-rgb-matrix-trc' as const,
    targetSpace,
    gamutMapping: 'clip' as const,
    clipped: result.clipped,
  });
}

export function convertProfileEncodedRgbV1(
  color: RgbUnitColorV1,
  sourceProfile: InputColorProfileV1,
  targetSpace: DocumentColorSpace,
): EncodedRgbConversionResultV1 {
  return sourceProfile.kind === 'builtin-rgb'
    ? convertEncodedRgbWithReportV1(color, sourceProfile.space, targetSpace)
    : convertIccToDocumentWithReportV1(color, sourceProfile, targetSpace);
}

export function previewOutputColorSpaceV1(
  documentSpace: DocumentColorSpace,
  displayP3Available: boolean,
): DocumentColorSpace {
  return documentSpace === 'display-p3' && displayP3Available ? 'display-p3' : 'srgb';
}
