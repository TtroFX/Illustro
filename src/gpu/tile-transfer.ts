import type { GpuAtlasSlotV1 } from './gpu-atlas.js';
import type { TileBoundsV1 } from './sparse-tile-model.js';

export const GPU_COPY_BYTES_PER_ROW_ALIGNMENT = 256 as const;
const GPU_BUFFER_USAGE_MAP_READ = 0x0001;
const GPU_BUFFER_USAGE_COPY_DST = 0x0008;
const GPU_MAP_MODE_READ = 0x0001;

export interface TileUploadResultV1 {
  readonly schema: 'illustro.tile-upload/1';
  readonly width: number;
  readonly height: number;
  readonly bytesTransferred: number;
  readonly bytesPerRow: number;
}

export interface TileReadbackResultV1 {
  readonly schema: 'illustro.tile-readback/1';
  readonly width: number;
  readonly height: number;
  readonly bytesTransferred: number;
  readonly bytesPerRow: number;
  readonly stagingBytesPerRow: number;
  readonly bytes: Uint8Array<ArrayBuffer>;
}

interface TileTransferGpuBufferV1 {
  mapAsync(mode: number): Promise<void>;
  getMappedRange(): ArrayBuffer;
  unmap(): void;
  destroy?(): void;
}

interface TileTransferCommandEncoderV1 {
  copyTextureToBuffer(
    source: {
      readonly texture: object;
      readonly origin: { readonly x: number; readonly y: number; readonly z: number };
    },
    destination: {
      readonly buffer: TileTransferGpuBufferV1;
      readonly offset: number;
      readonly bytesPerRow: number;
      readonly rowsPerImage: number;
    },
    copySize: {
      readonly width: number;
      readonly height: number;
      readonly depthOrArrayLayers: number;
    },
  ): void;
  finish(): object;
}

export interface TileTransferGpuDeviceV1 {
  readonly queue: {
    writeTexture(
      destination: {
        readonly texture: object;
        readonly origin: { readonly x: number; readonly y: number; readonly z: number };
      },
      data: Uint8Array<ArrayBuffer>,
      dataLayout: {
        readonly offset: number;
        readonly bytesPerRow: number;
        readonly rowsPerImage: number;
      },
      writeSize: {
        readonly width: number;
        readonly height: number;
        readonly depthOrArrayLayers: number;
      },
    ): void;
    submit(commandBuffers: readonly object[]): void;
  };
  createBuffer(descriptor: {
    readonly label: string;
    readonly size: number;
    readonly usage: number;
  }): TileTransferGpuBufferV1;
  createCommandEncoder(descriptor: { readonly label: string }): TileTransferCommandEncoderV1;
}

function bytesPerPixel(slot: GpuAtlasSlotV1): number {
  return slot.pixelFormat === 'rgba8-unorm' ? 4 : 8;
}

function validateTransferGeometry(slot: GpuAtlasSlotV1, bounds: TileBoundsV1): void {
  if (
    bounds.validWidth < 1 ||
    bounds.validHeight < 1 ||
    bounds.validWidth > slot.width ||
    bounds.validHeight > slot.height
  ) {
    throw new RangeError('tile transfer bounds exceed atlas slot');
  }
}

function requireTransferDevice(device: TileTransferGpuDeviceV1): void {
  if (
    device.queue === undefined ||
    typeof device.queue.writeTexture !== 'function' ||
    typeof device.queue.submit !== 'function' ||
    typeof device.createBuffer !== 'function' ||
    typeof device.createCommandEncoder !== 'function'
  ) {
    throw new Error('WebGPU tile transfer operations are unavailable');
  }
}

export function alignGpuBytesPerRowV1(byteLength: number): number {
  if (!Number.isSafeInteger(byteLength) || byteLength < 1) {
    throw new RangeError('row byte length must be a positive safe integer');
  }
  return (
    Math.ceil(byteLength / GPU_COPY_BYTES_PER_ROW_ALIGNMENT) * GPU_COPY_BYTES_PER_ROW_ALIGNMENT
  );
}

export function uploadTileToAtlasV1(
  device: TileTransferGpuDeviceV1,
  texture: object,
  slot: GpuAtlasSlotV1,
  bounds: TileBoundsV1,
  bytes: Uint8Array<ArrayBuffer>,
): TileUploadResultV1 {
  requireTransferDevice(device);
  validateTransferGeometry(slot, bounds);
  const rowBytes = bounds.validWidth * bytesPerPixel(slot);
  const expectedBytes = rowBytes * bounds.validHeight;
  if (bytes.byteLength !== expectedBytes) {
    throw new RangeError(
      `tile upload byte length mismatch: expected ${expectedBytes}, got ${bytes.byteLength}`,
    );
  }
  device.queue.writeTexture(
    { texture, origin: { x: slot.x, y: slot.y, z: 0 } },
    bytes,
    { offset: 0, bytesPerRow: rowBytes, rowsPerImage: bounds.validHeight },
    { width: bounds.validWidth, height: bounds.validHeight, depthOrArrayLayers: 1 },
  );
  return Object.freeze({
    schema: 'illustro.tile-upload/1',
    width: bounds.validWidth,
    height: bounds.validHeight,
    bytesTransferred: expectedBytes,
    bytesPerRow: rowBytes,
  });
}

export async function readbackTileFromAtlasV1(
  device: TileTransferGpuDeviceV1,
  texture: object,
  slot: GpuAtlasSlotV1,
  bounds: TileBoundsV1,
): Promise<TileReadbackResultV1> {
  requireTransferDevice(device);
  validateTransferGeometry(slot, bounds);
  const rowBytes = bounds.validWidth * bytesPerPixel(slot);
  const stagingBytesPerRow = alignGpuBytesPerRowV1(rowBytes);
  const stagingByteLength = stagingBytesPerRow * bounds.validHeight;
  const buffer = device.createBuffer({
    label: `illustro-tile-readback-${bounds.coordinate.tx}-${bounds.coordinate.ty}`,
    size: stagingByteLength,
    usage: GPU_BUFFER_USAGE_MAP_READ | GPU_BUFFER_USAGE_COPY_DST,
  });

  try {
    const encoder = device.createCommandEncoder({
      label: `illustro-tile-readback-copy-${bounds.coordinate.tx}-${bounds.coordinate.ty}`,
    });
    encoder.copyTextureToBuffer(
      { texture, origin: { x: slot.x, y: slot.y, z: 0 } },
      {
        buffer,
        offset: 0,
        bytesPerRow: stagingBytesPerRow,
        rowsPerImage: bounds.validHeight,
      },
      { width: bounds.validWidth, height: bounds.validHeight, depthOrArrayLayers: 1 },
    );
    device.queue.submit([encoder.finish()]);
    await buffer.mapAsync(GPU_MAP_MODE_READ);
    const mapped = new Uint8Array(buffer.getMappedRange());
    if (mapped.byteLength < stagingByteLength) {
      throw new RangeError('mapped tile readback buffer is smaller than the requested copy');
    }
    const bytes = new Uint8Array(rowBytes * bounds.validHeight);
    for (let row = 0; row < bounds.validHeight; row += 1) {
      const sourceStart = row * stagingBytesPerRow;
      const targetStart = row * rowBytes;
      bytes.set(mapped.subarray(sourceStart, sourceStart + rowBytes), targetStart);
    }
    buffer.unmap();
    return Object.freeze({
      schema: 'illustro.tile-readback/1',
      width: bounds.validWidth,
      height: bounds.validHeight,
      bytesTransferred: bytes.byteLength,
      bytesPerRow: rowBytes,
      stagingBytesPerRow,
      bytes,
    });
  } finally {
    buffer.destroy?.();
  }
}
