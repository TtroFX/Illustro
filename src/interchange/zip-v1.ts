export interface ZipEntryV1 {
  readonly path: string;
  readonly bytes: Uint8Array;
}

export interface ZipReadLimitsV1 {
  readonly maxEntries: number;
  readonly maxEntryBytes: number;
  readonly maxTotalBytes: number;
}

export const DEFAULT_ZIP_READ_LIMITS_V1: ZipReadLimitsV1 = Object.freeze({
  maxEntries: 256,
  maxEntryBytes: 64 * 1024 * 1024,
  maxTotalBytes: 128 * 1024 * 1024,
});

const LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50;
const CENTRAL_DIRECTORY_HEADER_SIGNATURE = 0x02014b50;
const END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;
const ZIP64_END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06064b50;
const ZIP64_END_OF_CENTRAL_DIRECTORY_LOCATOR_SIGNATURE = 0x07064b50;
const ZIP64_EXTRA_FIELD_ID = 0x0001;
const UTF8_FLAG = 0x0800;
const ENCRYPTED_FLAG = 0x0001;
const DATA_DESCRIPTOR_FLAG = 0x0008;
const STORED_METHOD = 0;
const DEFLATE_METHOD = 8;
const EOCD_FIXED_BYTES = 22;
const CENTRAL_FIXED_BYTES = 46;
const LOCAL_FIXED_BYTES = 30;
const ZIP32_SENTINEL = 0xffffffff;
const ZIP16_SENTINEL = 0xffff;

const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });

function viewOf(bytes: Uint8Array): DataView {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

function requireRange(bytes: Uint8Array, offset: number, length: number, label: string): void {
  if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(length) || offset < 0 || length < 0) {
    throw new RangeError(`invalid ${label} range`);
  }
  if (offset + length > bytes.byteLength) throw new RangeError(`truncated ${label}`);
}

function u16(bytes: Uint8Array, offset: number): number {
  requireRange(bytes, offset, 2, 'ZIP uint16');
  return viewOf(bytes).getUint16(offset, true);
}

function u32(bytes: Uint8Array, offset: number): number {
  requireRange(bytes, offset, 4, 'ZIP uint32');
  return viewOf(bytes).getUint32(offset, true);
}

function u64(bytes: Uint8Array, offset: number): bigint {
  requireRange(bytes, offset, 8, 'ZIP uint64');
  return viewOf(bytes).getBigUint64(offset, true);
}

function safeNumber(value: bigint, label: string): number {
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) throw new RangeError(`${label} exceeds safe integer range`);
  return Number(value);
}

function writeU16(bytes: Uint8Array, offset: number, value: number): void {
  viewOf(bytes).setUint16(offset, value, true);
}

function writeU32(bytes: Uint8Array, offset: number, value: number): void {
  viewOf(bytes).setUint32(offset, value, true);
}

function concatBytes(parts: readonly Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.byteLength, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.byteLength;
  }
  return output;
}

export function assertSafeArchivePathV1(path: string): string {
  if (path.length < 1 || path.length > 1024) throw new RangeError('archive path length is invalid');
  if (path.includes('\0') || path.includes('\\')) throw new TypeError('archive path contains unsafe characters');
  if (path.startsWith('/') || /^[a-zA-Z]:/.test(path)) throw new TypeError('archive path must be relative');
  const segments = path.split('/');
  if (segments.some((segment) => segment.length === 0 || segment === '.' || segment === '..')) {
    throw new TypeError('archive path contains an unsafe segment');
  }
  return path;
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function findEndOfCentralDirectory(bytes: Uint8Array): number {
  const minimum = Math.max(0, bytes.byteLength - EOCD_FIXED_BYTES - ZIP16_SENTINEL);
  for (let offset = bytes.byteLength - EOCD_FIXED_BYTES; offset >= minimum; offset -= 1) {
    if (u32(bytes, offset) === END_OF_CENTRAL_DIRECTORY_SIGNATURE) {
      const commentLength = u16(bytes, offset + 20);
      if (offset + EOCD_FIXED_BYTES + commentLength === bytes.byteLength) return offset;
    }
  }
  throw new TypeError('ZIP end-of-central-directory record is missing');
}

interface CentralDirectoryLocationV1 {
  readonly entryCount: number;
  readonly offset: number;
  readonly size: number;
}

function centralDirectoryLocation(bytes: Uint8Array, eocdOffset: number): CentralDirectoryLocationV1 {
  const diskNumber = u16(bytes, eocdOffset + 4);
  const centralDisk = u16(bytes, eocdOffset + 6);
  const diskEntries = u16(bytes, eocdOffset + 8);
  const totalEntries = u16(bytes, eocdOffset + 10);
  const centralSize = u32(bytes, eocdOffset + 12);
  const centralOffset = u32(bytes, eocdOffset + 16);
  const needsZip64 =
    diskEntries === ZIP16_SENTINEL ||
    totalEntries === ZIP16_SENTINEL ||
    centralSize === ZIP32_SENTINEL ||
    centralOffset === ZIP32_SENTINEL;

  if (!needsZip64) {
    if (diskNumber !== 0 || centralDisk !== 0 || diskEntries !== totalEntries) {
      throw new TypeError('multi-disk ZIP archives are unsupported');
    }
    return Object.freeze({ entryCount: totalEntries, offset: centralOffset, size: centralSize });
  }

  const locatorOffset = eocdOffset - 20;
  requireRange(bytes, locatorOffset, 20, 'ZIP64 locator');
  if (u32(bytes, locatorOffset) !== ZIP64_END_OF_CENTRAL_DIRECTORY_LOCATOR_SIGNATURE) {
    throw new TypeError('ZIP64 locator is missing');
  }
  if (u32(bytes, locatorOffset + 4) !== 0 || u32(bytes, locatorOffset + 16) !== 1) {
    throw new TypeError('multi-disk ZIP64 archives are unsupported');
  }
  const zip64Offset = safeNumber(u64(bytes, locatorOffset + 8), 'ZIP64 EOCD offset');
  requireRange(bytes, zip64Offset, 56, 'ZIP64 end-of-central-directory');
  if (u32(bytes, zip64Offset) !== ZIP64_END_OF_CENTRAL_DIRECTORY_SIGNATURE) {
    throw new TypeError('ZIP64 end-of-central-directory record is missing');
  }
  if (u32(bytes, zip64Offset + 16) !== 0 || u32(bytes, zip64Offset + 20) !== 0) {
    throw new TypeError('multi-disk ZIP64 archives are unsupported');
  }
  const zip64DiskEntries = u64(bytes, zip64Offset + 24);
  const zip64TotalEntries = u64(bytes, zip64Offset + 32);
  if (zip64DiskEntries !== zip64TotalEntries) throw new TypeError('split ZIP64 archive is unsupported');
  return Object.freeze({
    entryCount: safeNumber(zip64TotalEntries, 'ZIP64 entry count'),
    size: safeNumber(u64(bytes, zip64Offset + 40), 'ZIP64 central-directory size'),
    offset: safeNumber(u64(bytes, zip64Offset + 48), 'ZIP64 central-directory offset'),
  });
}

interface Zip64CentralValuesV1 {
  readonly uncompressedSize?: number;
  readonly compressedSize?: number;
  readonly localHeaderOffset?: number;
  readonly diskStart?: number;
}

function parseZip64CentralExtra(
  extra: Uint8Array,
  needs: {
    readonly uncompressedSize: boolean;
    readonly compressedSize: boolean;
    readonly localHeaderOffset: boolean;
    readonly diskStart: boolean;
  },
): Zip64CentralValuesV1 {
  let offset = 0;
  while (offset + 4 <= extra.byteLength) {
    const fieldId = u16(extra, offset);
    const fieldLength = u16(extra, offset + 2);
    const dataOffset = offset + 4;
    requireRange(extra, dataOffset, fieldLength, 'ZIP extra field');
    if (fieldId === ZIP64_EXTRA_FIELD_ID) {
      let cursor = dataOffset;
      const end = dataOffset + fieldLength;
      const result: {
        uncompressedSize?: number;
        compressedSize?: number;
        localHeaderOffset?: number;
        diskStart?: number;
      } = {};
      const takeU64 = (label: string): number => {
        if (cursor + 8 > end) throw new RangeError(`truncated ZIP64 ${label}`);
        const value = safeNumber(u64(extra, cursor), `ZIP64 ${label}`);
        cursor += 8;
        return value;
      };
      if (needs.uncompressedSize) result.uncompressedSize = takeU64('uncompressed size');
      if (needs.compressedSize) result.compressedSize = takeU64('compressed size');
      if (needs.localHeaderOffset) result.localHeaderOffset = takeU64('local header offset');
      if (needs.diskStart) {
        if (cursor + 4 > end) throw new RangeError('truncated ZIP64 disk start');
        result.diskStart = u32(extra, cursor);
      }
      return Object.freeze(result);
    }
    offset = dataOffset + fieldLength;
  }
  throw new TypeError('required ZIP64 extra field is missing');
}

async function inflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream !== 'function') {
    throw new TypeError('deflate ZIP entry is unsupported in this runtime');
  }
  const input = new Blob([bytes.slice()]);
  const stream = input.stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function readZipEntriesV1(
  source: Uint8Array,
  limits: ZipReadLimitsV1 = DEFAULT_ZIP_READ_LIMITS_V1,
): Promise<readonly ZipEntryV1[]> {
  const bytes = source.slice();
  if (bytes.byteLength < EOCD_FIXED_BYTES) throw new TypeError('ZIP archive is truncated');
  const eocdOffset = findEndOfCentralDirectory(bytes);
  const central = centralDirectoryLocation(bytes, eocdOffset);
  if (central.entryCount > limits.maxEntries) throw new RangeError('ZIP archive has too many entries');
  requireRange(bytes, central.offset, central.size, 'ZIP central directory');

  const entries: ZipEntryV1[] = [];
  const paths = new Set<string>();
  let totalUncompressedBytes = 0;
  let cursor = central.offset;
  for (let index = 0; index < central.entryCount; index += 1) {
    requireRange(bytes, cursor, CENTRAL_FIXED_BYTES, 'ZIP central-directory entry');
    if (u32(bytes, cursor) !== CENTRAL_DIRECTORY_HEADER_SIGNATURE) {
      throw new TypeError('invalid ZIP central-directory entry signature');
    }
    const flags = u16(bytes, cursor + 8);
    const method = u16(bytes, cursor + 10);
    const expectedCrc = u32(bytes, cursor + 16);
    const compressed32 = u32(bytes, cursor + 20);
    const uncompressed32 = u32(bytes, cursor + 24);
    const nameLength = u16(bytes, cursor + 28);
    const extraLength = u16(bytes, cursor + 30);
    const commentLength = u16(bytes, cursor + 32);
    const diskStart32 = u16(bytes, cursor + 34);
    const localOffset32 = u32(bytes, cursor + 42);
    const variableOffset = cursor + CENTRAL_FIXED_BYTES;
    requireRange(
      bytes,
      variableOffset,
      nameLength + extraLength + commentLength,
      'ZIP central-directory variable data',
    );
    const nameBytes = bytes.subarray(variableOffset, variableOffset + nameLength);
    const path = assertSafeArchivePathV1(decoder.decode(nameBytes));
    if (paths.has(path)) throw new TypeError(`duplicate ZIP entry path: ${path}`);
    paths.add(path);
    if ((flags & ENCRYPTED_FLAG) !== 0) throw new TypeError('encrypted ZIP entries are unsupported');
    if (method !== STORED_METHOD && method !== DEFLATE_METHOD) {
      throw new TypeError(`unsupported ZIP compression method: ${method}`);
    }
    const extra = bytes.subarray(
      variableOffset + nameLength,
      variableOffset + nameLength + extraLength,
    );
    const needsZip64 = {
      uncompressedSize: uncompressed32 === ZIP32_SENTINEL,
      compressedSize: compressed32 === ZIP32_SENTINEL,
      localHeaderOffset: localOffset32 === ZIP32_SENTINEL,
      diskStart: diskStart32 === ZIP16_SENTINEL,
    };
    const zip64 = Object.values(needsZip64).some(Boolean)
      ? parseZip64CentralExtra(extra, needsZip64)
      : {};
    const uncompressedSize = zip64.uncompressedSize ?? uncompressed32;
    const compressedSize = zip64.compressedSize ?? compressed32;
    const localHeaderOffset = zip64.localHeaderOffset ?? localOffset32;
    const diskStart = zip64.diskStart ?? diskStart32;
    if (diskStart !== 0) throw new TypeError('multi-disk ZIP entries are unsupported');
    if (uncompressedSize > limits.maxEntryBytes) throw new RangeError(`ZIP entry is too large: ${path}`);
    totalUncompressedBytes += uncompressedSize;
    if (totalUncompressedBytes > limits.maxTotalBytes) {
      throw new RangeError('ZIP archive expands beyond the configured byte limit');
    }

    requireRange(bytes, localHeaderOffset, LOCAL_FIXED_BYTES, 'ZIP local-file header');
    if (u32(bytes, localHeaderOffset) !== LOCAL_FILE_HEADER_SIGNATURE) {
      throw new TypeError(`invalid local ZIP header: ${path}`);
    }
    const localFlags = u16(bytes, localHeaderOffset + 6);
    const localMethod = u16(bytes, localHeaderOffset + 8);
    if (localFlags !== flags || localMethod !== method) {
      throw new TypeError(`ZIP local/central metadata mismatch: ${path}`);
    }
    const localNameLength = u16(bytes, localHeaderOffset + 26);
    const localExtraLength = u16(bytes, localHeaderOffset + 28);
    const localNameOffset = localHeaderOffset + LOCAL_FIXED_BYTES;
    requireRange(
      bytes,
      localNameOffset,
      localNameLength + localExtraLength,
      'ZIP local-file variable data',
    );
    if (decoder.decode(bytes.subarray(localNameOffset, localNameOffset + localNameLength)) !== path) {
      throw new TypeError(`ZIP local/central path mismatch: ${path}`);
    }
    const dataOffset = localNameOffset + localNameLength + localExtraLength;
    requireRange(bytes, dataOffset, compressedSize, `ZIP entry payload ${path}`);
    const compressed = bytes.subarray(dataOffset, dataOffset + compressedSize);
    const payload = method === STORED_METHOD ? compressed.slice() : await inflateRaw(compressed);
    if (payload.byteLength !== uncompressedSize) {
      throw new RangeError(`ZIP uncompressed size mismatch: ${path}`);
    }
    if (crc32(payload) !== expectedCrc) throw new TypeError(`ZIP CRC-32 mismatch: ${path}`);
    entries.push(Object.freeze({ path, bytes: payload }));

    cursor = variableOffset + nameLength + extraLength + commentLength;
    if ((flags & DATA_DESCRIPTOR_FLAG) !== 0) {
      // The central directory remains authoritative; the descriptor follows payload data and needs no scan.
    }
  }
  if (cursor !== central.offset + central.size) {
    throw new TypeError('ZIP central-directory size does not match parsed entries');
  }
  return Object.freeze(entries);
}

export function writeStoredZipV1(entriesInput: readonly ZipEntryV1[]): Uint8Array {
  if (entriesInput.length > ZIP16_SENTINEL - 1) throw new RangeError('too many ZIP entries for ZIP32 writer');
  const seen = new Set<string>();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let localOffset = 0;

  for (const entry of entriesInput) {
    const path = assertSafeArchivePathV1(entry.path);
    if (seen.has(path)) throw new TypeError(`duplicate ZIP entry path: ${path}`);
    seen.add(path);
    const name = encoder.encode(path);
    const payload = entry.bytes.slice();
    if (payload.byteLength >= ZIP32_SENTINEL) {
      throw new RangeError('ZIP32 writer entry exceeds 4 GiB; ZIP64 output is required');
    }
    if (localOffset >= ZIP32_SENTINEL) {
      throw new RangeError('ZIP32 writer archive exceeds 4 GiB; ZIP64 output is required');
    }
    const checksum = crc32(payload);
    const localHeader = new Uint8Array(LOCAL_FIXED_BYTES + name.byteLength);
    writeU32(localHeader, 0, LOCAL_FILE_HEADER_SIGNATURE);
    writeU16(localHeader, 4, 20);
    writeU16(localHeader, 6, UTF8_FLAG);
    writeU16(localHeader, 8, STORED_METHOD);
    writeU16(localHeader, 10, 0);
    writeU16(localHeader, 12, 0x0021);
    writeU32(localHeader, 14, checksum);
    writeU32(localHeader, 18, payload.byteLength);
    writeU32(localHeader, 22, payload.byteLength);
    writeU16(localHeader, 26, name.byteLength);
    writeU16(localHeader, 28, 0);
    localHeader.set(name, LOCAL_FIXED_BYTES);
    localParts.push(localHeader, payload);

    const centralHeader = new Uint8Array(CENTRAL_FIXED_BYTES + name.byteLength);
    writeU32(centralHeader, 0, CENTRAL_DIRECTORY_HEADER_SIGNATURE);
    writeU16(centralHeader, 4, 20);
    writeU16(centralHeader, 6, 20);
    writeU16(centralHeader, 8, UTF8_FLAG);
    writeU16(centralHeader, 10, STORED_METHOD);
    writeU16(centralHeader, 12, 0);
    writeU16(centralHeader, 14, 0x0021);
    writeU32(centralHeader, 16, checksum);
    writeU32(centralHeader, 20, payload.byteLength);
    writeU32(centralHeader, 24, payload.byteLength);
    writeU16(centralHeader, 28, name.byteLength);
    writeU16(centralHeader, 30, 0);
    writeU16(centralHeader, 32, 0);
    writeU16(centralHeader, 34, 0);
    writeU16(centralHeader, 36, 0);
    writeU32(centralHeader, 38, 0);
    writeU32(centralHeader, 42, localOffset);
    centralHeader.set(name, CENTRAL_FIXED_BYTES);
    centralParts.push(centralHeader);
    localOffset += localHeader.byteLength + payload.byteLength;
  }

  const localBytes = concatBytes(localParts);
  const centralBytes = concatBytes(centralParts);
  if (centralBytes.byteLength >= ZIP32_SENTINEL || localBytes.byteLength >= ZIP32_SENTINEL) {
    throw new RangeError('ZIP32 writer archive exceeds 4 GiB; ZIP64 output is required');
  }
  const eocd = new Uint8Array(EOCD_FIXED_BYTES);
  writeU32(eocd, 0, END_OF_CENTRAL_DIRECTORY_SIGNATURE);
  writeU16(eocd, 4, 0);
  writeU16(eocd, 6, 0);
  writeU16(eocd, 8, entriesInput.length);
  writeU16(eocd, 10, entriesInput.length);
  writeU32(eocd, 12, centralBytes.byteLength);
  writeU32(eocd, 16, localBytes.byteLength);
  writeU16(eocd, 20, 0);
  return concatBytes([localBytes, centralBytes, eocd]);
}
