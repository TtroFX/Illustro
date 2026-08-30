import { putImmutableObject, type ImmutableObjectWriteResultV1 } from './immutable-object-store.js';
import { compressLz4Block, decompressLz4Block } from './lz4-block.js';
import type { IllustroOpfsRootV1 } from './opfs-layout.js';

export const TILE_CODEC_VERSION = 1 as const;
export const TILE_ENVELOPE_HEADER_BYTES = 24 as const;

export type TileCodecIdV1 = 'raw' | 'lz4-block';
export type TilePixelFormatV1 = 'r8-unorm' | 'r16-float' | 'rgba8-unorm' | 'rgba16-float';

export interface TileCodecPolicyV1 {
  readonly minSavingsBytes: number;
  readonly minSavingsRatio: number;
}

export interface EncodedTileV1 {
  readonly codec: TileCodecIdV1;
  readonly pixelFormat: TilePixelFormatV1;
  readonly width: number;
  readonly height: number;
  readonly rawByteLength: number;
  readonly bytes: Uint8Array<ArrayBuffer>;
}

export interface DecodedTileV1 {
  readonly codec: TileCodecIdV1;
  readonly pixelFormat: TilePixelFormatV1;
  readonly width: number;
  readonly height: number;
  readonly bytes: Uint8Array<ArrayBuffer>;
}

export interface PersistedTileV1 {
  readonly codec: TileCodecIdV1;
  readonly pixelFormat: TilePixelFormatV1;
  readonly width: number;
  readonly height: number;
  readonly rawByteLength: number;
  readonly encodedByteLength: number;
  readonly object: ImmutableObjectWriteResultV1;
}

export const DEFAULT_TILE_CODEC_POLICY: TileCodecPolicyV1 = Object.freeze({
  minSavingsBytes: 0,
  minSavingsRatio: 0.125,
});

const TILE_MAGIC = new Uint8Array([0x49, 0x4c, 0x54, 0x31]);
const CODEC_CODE: Readonly<Record<TileCodecIdV1, number>> = Object.freeze({
  raw: 0,
  'lz4-block': 1,
});
const CODE_CODEC: Readonly<Record<number, TileCodecIdV1>> = Object.freeze({
  0: 'raw',
  1: 'lz4-block',
});
const PIXEL_FORMAT_CODE: Readonly<Record<TilePixelFormatV1, number>> = Object.freeze({
  'r8-unorm': 1,
  'r16-float': 2,
  'rgba8-unorm': 3,
  'rgba16-float': 4,
});
const CODE_PIXEL_FORMAT: Readonly<Record<number, TilePixelFormatV1>> = Object.freeze({
  1: 'r8-unorm',
  2: 'r16-float',
  3: 'rgba8-unorm',
  4: 'rgba16-float',
});
const PIXEL_BYTES: Readonly<Record<TilePixelFormatV1, number>> = Object.freeze({
  'r8-unorm': 1,
  'r16-float': 2,
  'rgba8-unorm': 4,
  'rgba16-float': 8,
});
const MAX_U32 = 0xffff_ffff;

function ownedBytes(data: Uint8Array | ArrayBuffer): Uint8Array<ArrayBuffer> {
  if (data instanceof ArrayBuffer) return new Uint8Array(data.slice(0));
  const copy = new Uint8Array(data.byteLength);
  copy.set(data);
  return copy;
}

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false;
  for (let index = 0; index < left.byteLength; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

function validateDimension(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 1 || value > MAX_U32) {
    throw new RangeError(`${label} must be an integer in 1..${MAX_U32}`);
  }
}

function validatePolicy(policy: TileCodecPolicyV1): void {
  if (!Number.isSafeInteger(policy.minSavingsBytes) || policy.minSavingsBytes < 0) {
    throw new RangeError('minSavingsBytes must be a non-negative safe integer');
  }
  if (
    !Number.isFinite(policy.minSavingsRatio) ||
    policy.minSavingsRatio < 0 ||
    policy.minSavingsRatio > 1
  ) {
    throw new RangeError('minSavingsRatio must be in 0..1');
  }
}

function expectedByteLength(width: number, height: number, pixelFormat: TilePixelFormatV1): number {
  validateDimension(width, 'tile width');
  validateDimension(height, 'tile height');
  const byteLength = width * height * PIXEL_BYTES[pixelFormat];
  if (!Number.isSafeInteger(byteLength) || byteLength > MAX_U32) {
    throw new RangeError('tile payload exceeds codec length field');
  }
  return byteLength;
}

function validateTileInput(input: {
  width: number;
  height: number;
  pixelFormat: TilePixelFormatV1;
  bytes: Uint8Array | ArrayBuffer;
}): Uint8Array<ArrayBuffer> {
  const bytes = ownedBytes(input.bytes);
  const expected = expectedByteLength(input.width, input.height, input.pixelFormat);
  if (bytes.byteLength !== expected) {
    throw new RangeError(
      `tile byte length mismatch: expected ${expected}, got ${bytes.byteLength}`,
    );
  }
  return bytes;
}

function buildEnvelope(input: {
  codec: TileCodecIdV1;
  width: number;
  height: number;
  pixelFormat: TilePixelFormatV1;
  rawByteLength: number;
  payload: Uint8Array<ArrayBuffer>;
}): EncodedTileV1 {
  if (input.payload.byteLength > MAX_U32)
    throw new RangeError('encoded tile exceeds payload length field');
  const output = new Uint8Array(TILE_ENVELOPE_HEADER_BYTES + input.payload.byteLength);
  output.set(TILE_MAGIC, 0);
  const view = new DataView(output.buffer);
  view.setUint8(4, TILE_CODEC_VERSION);
  view.setUint8(5, CODEC_CODE[input.codec]);
  view.setUint8(6, PIXEL_FORMAT_CODE[input.pixelFormat]);
  view.setUint8(7, 0);
  view.setUint32(8, input.width, true);
  view.setUint32(12, input.height, true);
  view.setUint32(16, input.rawByteLength, true);
  view.setUint32(20, input.payload.byteLength, true);
  output.set(input.payload, TILE_ENVELOPE_HEADER_BYTES);
  return Object.freeze({
    codec: input.codec,
    pixelFormat: input.pixelFormat,
    width: input.width,
    height: input.height,
    rawByteLength: input.rawByteLength,
    bytes: output,
  });
}

function isRasterFormat(pixelFormat: TilePixelFormatV1): boolean {
  return pixelFormat === 'rgba8-unorm' || pixelFormat === 'rgba16-float';
}

function isMaskFormat(pixelFormat: TilePixelFormatV1): boolean {
  return pixelFormat === 'r8-unorm' || pixelFormat === 'r16-float';
}

function encodeRaw(input: {
  width: number;
  height: number;
  pixelFormat: TilePixelFormatV1;
  bytes: Uint8Array | ArrayBuffer;
}): EncodedTileV1 {
  const raw = validateTileInput(input);
  return buildEnvelope({
    codec: 'raw',
    width: input.width,
    height: input.height,
    pixelFormat: input.pixelFormat,
    rawByteLength: raw.byteLength,
    payload: raw,
  });
}

function encodeLz4(input: {
  width: number;
  height: number;
  pixelFormat: TilePixelFormatV1;
  bytes: Uint8Array | ArrayBuffer;
}): EncodedTileV1 {
  const raw = validateTileInput(input);
  const compressed = compressLz4Block(raw);
  return buildEnvelope({
    codec: 'lz4-block',
    width: input.width,
    height: input.height,
    pixelFormat: input.pixelFormat,
    rawByteLength: raw.byteLength,
    payload: compressed,
  });
}

function encodeAuto(
  input: {
    width: number;
    height: number;
    pixelFormat: TilePixelFormatV1;
    bytes: Uint8Array | ArrayBuffer;
  },
  policy: TileCodecPolicyV1,
): EncodedTileV1 {
  validatePolicy(policy);
  const raw = validateTileInput(input);
  const compressed = compressLz4Block(raw);
  const savings = raw.byteLength - compressed.byteLength;
  const savingsRatio = raw.byteLength === 0 ? 0 : savings / raw.byteLength;
  const useLz4 = savings >= policy.minSavingsBytes && savingsRatio >= policy.minSavingsRatio;
  return buildEnvelope({
    codec: useLz4 ? 'lz4-block' : 'raw',
    width: input.width,
    height: input.height,
    pixelFormat: input.pixelFormat,
    rawByteLength: raw.byteLength,
    payload: useLz4 ? compressed : raw,
  });
}

export function encodeRasterTileRaw(input: {
  width: number;
  height: number;
  pixelFormat: 'rgba8-unorm' | 'rgba16-float';
  bytes: Uint8Array | ArrayBuffer;
}): EncodedTileV1 {
  return encodeRaw(input);
}

export function encodeRasterTileLz4(input: {
  width: number;
  height: number;
  pixelFormat: 'rgba8-unorm' | 'rgba16-float';
  bytes: Uint8Array | ArrayBuffer;
}): EncodedTileV1 {
  return encodeLz4(input);
}

export function encodeRasterTileAuto(
  input: {
    width: number;
    height: number;
    pixelFormat: 'rgba8-unorm' | 'rgba16-float';
    bytes: Uint8Array | ArrayBuffer;
  },
  policy: TileCodecPolicyV1 = DEFAULT_TILE_CODEC_POLICY,
): EncodedTileV1 {
  return encodeAuto(input, policy);
}

export function encodeMaskTile(
  input: {
    width: number;
    height: number;
    pixelFormat: 'r8-unorm' | 'r16-float';
    bytes: Uint8Array | ArrayBuffer;
  },
  policy: TileCodecPolicyV1 = DEFAULT_TILE_CODEC_POLICY,
): EncodedTileV1 {
  return encodeAuto(input, policy);
}

export function decodeTile(data: Uint8Array | ArrayBuffer): DecodedTileV1 {
  const encoded = ownedBytes(data);
  if (encoded.byteLength < TILE_ENVELOPE_HEADER_BYTES) throw new Error('truncated tile envelope');
  if (!sameBytes(encoded.subarray(0, 4), TILE_MAGIC))
    throw new Error('invalid tile envelope magic');
  const view = new DataView(encoded.buffer, encoded.byteOffset, encoded.byteLength);
  const version = view.getUint8(4);
  if (version !== TILE_CODEC_VERSION) throw new Error(`unsupported tile codec version: ${version}`);
  const codec = CODE_CODEC[view.getUint8(5)];
  if (codec === undefined) throw new Error('unknown tile codec');
  const pixelFormat = CODE_PIXEL_FORMAT[view.getUint8(6)];
  if (pixelFormat === undefined) throw new Error('unknown tile pixel format');
  if (view.getUint8(7) !== 0) throw new Error('unsupported tile envelope flags');
  const width = view.getUint32(8, true);
  const height = view.getUint32(12, true);
  const rawByteLength = view.getUint32(16, true);
  const payloadByteLength = view.getUint32(20, true);
  const expected = expectedByteLength(width, height, pixelFormat);
  if (rawByteLength !== expected) throw new Error('tile raw byte length does not match dimensions');
  if (encoded.byteLength !== TILE_ENVELOPE_HEADER_BYTES + payloadByteLength) {
    throw new Error('tile payload length does not match envelope');
  }
  const payload = encoded.subarray(TILE_ENVELOPE_HEADER_BYTES);
  const bytes = codec === 'raw' ? ownedBytes(payload) : decompressLz4Block(payload, rawByteLength);
  if (bytes.byteLength !== rawByteLength) throw new Error('decoded tile length mismatch');
  return Object.freeze({ codec, pixelFormat, width, height, bytes });
}

async function persistEncodedTile(
  root: IllustroOpfsRootV1,
  encoded: EncodedTileV1,
): Promise<PersistedTileV1> {
  const object = await putImmutableObject(root.sha256Objects, encoded.bytes);
  return Object.freeze({
    codec: encoded.codec,
    pixelFormat: encoded.pixelFormat,
    width: encoded.width,
    height: encoded.height,
    rawByteLength: encoded.rawByteLength,
    encodedByteLength: encoded.bytes.byteLength,
    object,
  });
}

export async function persistRasterTile(
  root: IllustroOpfsRootV1,
  input: {
    width: number;
    height: number;
    pixelFormat: 'rgba8-unorm' | 'rgba16-float';
    bytes: Uint8Array | ArrayBuffer;
  },
  policy: TileCodecPolicyV1 = DEFAULT_TILE_CODEC_POLICY,
): Promise<PersistedTileV1> {
  if (!isRasterFormat(input.pixelFormat))
    throw new TypeError('raster tiles require an RGBA pixel format');
  return persistEncodedTile(root, encodeRasterTileAuto(input, policy));
}

export async function persistMaskTile(
  root: IllustroOpfsRootV1,
  input: {
    width: number;
    height: number;
    pixelFormat: 'r8-unorm' | 'r16-float';
    bytes: Uint8Array | ArrayBuffer;
  },
  policy: TileCodecPolicyV1 = DEFAULT_TILE_CODEC_POLICY,
): Promise<PersistedTileV1> {
  if (!isMaskFormat(input.pixelFormat))
    throw new TypeError('mask tiles require a single-channel pixel format');
  return persistEncodedTile(root, encodeMaskTile(input, policy));
}
