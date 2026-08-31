import {
  GpuAtlasPageManagerV1,
  type GpuAtlasPixelFormatV1,
  type GpuAtlasSlotV1,
  type GpuAtlasSnapshotV1,
} from './gpu-atlas.js';
import type { IllustroGpuDeviceV1 } from './webgpu-capability.js';
import {
  CpuBackingTileCacheV1,
  gpuSingleAllocationSoftLimitV1,
  GpuTileCacheV1,
  type RendererCacheProfileV1,
  type TileCacheResidencyV1,
  type TileCacheSnapshotV1,
} from './tile-cache.js';
import {
  CANONICAL_TILE_SIZE_PX,
  DirtyTileTrackerV1,
  SparseTileMapV1,
  tileGridForDocumentV1,
  tileKeyV1,
  type DirtyTileStateV1,
  type RectV1,
  type SparseTileEntryV1,
  type TileCoordinateV1,
  type TileGridV1,
} from './sparse-tile-model.js';
import {
  resolveViewportTilesV1,
  type DocumentViewportRectV1,
  type ViewportTileResolutionV1,
} from './viewport-tiles.js';

const GPU_ATLAS_TEXTURE_USAGE = 0x01 | 0x02 | 0x04 | 0x08 | 0x10;

interface RendererGpuTextureLikeV1 {
  destroy?(): void;
}

interface RendererGpuTextureDeviceV1 extends IllustroGpuDeviceV1 {
  createTexture?(descriptor: {
    readonly label: string;
    readonly size: {
      readonly width: number;
      readonly height: number;
      readonly depthOrArrayLayers: number;
    };
    readonly format: 'rgba8unorm' | 'rgba16float';
    readonly usage: number;
  }): RendererGpuTextureLikeV1;
}

export interface RendererLogicalTileV1 {
  readonly schema: 'illustro.renderer-logical-tile/1';
  readonly revision: number;
}

export interface RendererTileStateSnapshotV1 {
  readonly schema: 'illustro.renderer-tile-state/1';
  readonly documentWidth: number;
  readonly documentHeight: number;
  readonly grid: TileGridV1;
  readonly allocatedTileCount: number;
  readonly dirtyTileCount: number;
  readonly cacheProfile: RendererCacheProfileV1;
  readonly gpuCache: TileCacheSnapshotV1;
  readonly cpuCache: TileCacheSnapshotV1;
  readonly atlas: GpuAtlasSnapshotV1;
}

function tileGpuByteLength(pixelFormat: GpuAtlasPixelFormatV1): number {
  return CANONICAL_TILE_SIZE_PX * CANONICAL_TILE_SIZE_PX * (pixelFormat === 'rgba8-unorm' ? 4 : 8);
}

function webGpuAtlasFormat(pixelFormat: GpuAtlasPixelFormatV1): 'rgba8unorm' | 'rgba16float' {
  return pixelFormat === 'rgba8-unorm' ? 'rgba8unorm' : 'rgba16float';
}

export class RendererTileStateV1 {
  readonly #documentWidth: number;
  readonly #documentHeight: number;
  readonly #grid: TileGridV1;
  readonly #tiles: SparseTileMapV1<RendererLogicalTileV1>;
  readonly #dirty: DirtyTileTrackerV1;
  readonly #atlas: GpuAtlasPageManagerV1<RendererGpuTextureLikeV1>;
  readonly #gpuCache: GpuTileCacheV1<GpuAtlasSlotV1>;
  readonly #cpuCache: CpuBackingTileCacheV1<Uint8Array<ArrayBuffer>>;
  #gpuDevice: RendererGpuTextureDeviceV1 | null = null;

  constructor(documentWidth: number, documentHeight: number) {
    this.#grid = tileGridForDocumentV1(documentWidth, documentHeight);
    this.#documentWidth = documentWidth;
    this.#documentHeight = documentHeight;
    this.#tiles = new SparseTileMapV1(documentWidth, documentHeight);
    this.#dirty = new DirtyTileTrackerV1(documentWidth, documentHeight);
    this.#atlas = new GpuAtlasPageManagerV1({
      create: (descriptor) => {
        const device = this.#gpuDevice;
        if (device?.createTexture === undefined) {
          throw new Error('WebGPU texture allocation is unavailable for the renderer tile cache');
        }
        return device.createTexture({
          label: `illustro-tile-${descriptor.pageId}`,
          size: {
            width: descriptor.width,
            height: descriptor.height,
            depthOrArrayLayers: 1,
          },
          format: webGpuAtlasFormat(descriptor.pixelFormat),
          usage: GPU_ATLAS_TEXTURE_USAGE,
        });
      },
      destroy: (texture) => texture.destroy?.(),
    });
    this.#gpuCache = new GpuTileCacheV1('conservative', (entry) => {
      this.#atlas.release(entry.key);
    });
    this.#cpuCache = new CpuBackingTileCacheV1('conservative');
  }

  snapshot(): RendererTileStateSnapshotV1 {
    const gpuCache = this.#gpuCache.snapshot();
    return Object.freeze({
      schema: 'illustro.renderer-tile-state/1',
      documentWidth: this.#documentWidth,
      documentHeight: this.#documentHeight,
      grid: this.#grid,
      allocatedTileCount: this.#tiles.size,
      dirtyTileCount: this.#dirty.size,
      cacheProfile: gpuCache.profile,
      gpuCache,
      cpuCache: this.#cpuCache.snapshot(),
      atlas: this.#atlas.snapshot(),
    });
  }

  attachGpuDevice(device: IllustroGpuDeviceV1 | null): void {
    if (this.#gpuDevice === device) return;
    this.discardGpuResidency();
    this.#gpuDevice = device as RendererGpuTextureDeviceV1 | null;
  }

  setCacheProfile(profile: RendererCacheProfileV1): RendererTileStateSnapshotV1 {
    this.#gpuCache.setProfile(profile);
    this.#cpuCache.setProfile(profile);
    return this.snapshot();
  }

  allocate(coordinate: TileCoordinateV1): SparseTileEntryV1<RendererLogicalTileV1> {
    return this.#tiles.allocate(coordinate, () =>
      Object.freeze({ schema: 'illustro.renderer-logical-tile/1', revision: 0 }),
    );
  }

  deallocate(coordinate: TileCoordinateV1): boolean {
    const key = tileKeyV1(coordinate);
    this.#dirty.clear(coordinate);
    this.#gpuCache.delete(key);
    this.#cpuCache.delete(key);
    return this.#tiles.deallocate(coordinate);
  }

  markDirty(coordinate: TileCoordinateV1, rect: RectV1): DirtyTileStateV1 | null {
    if (!this.#tiles.has(coordinate)) {
      throw new Error('cannot mark an absent sparse tile dirty; allocate it first');
    }
    return this.#dirty.markRect(coordinate, rect);
  }

  clearDirty(coordinate: TileCoordinateV1): boolean {
    return this.#dirty.clear(coordinate);
  }

  reserveGpuTile(
    coordinate: TileCoordinateV1,
    pixelFormat: GpuAtlasPixelFormatV1,
    residency: TileCacheResidencyV1 = 'background',
  ): GpuAtlasSlotV1 {
    if (!this.#tiles.has(coordinate)) {
      throw new Error('cannot reserve GPU cache for an absent sparse tile');
    }
    if (this.#gpuDevice?.createTexture === undefined) {
      throw new Error('renderer GPU device is not attached');
    }
    const key = tileKeyV1(coordinate);
    const existing = this.#gpuCache.get(key);
    if (existing !== null) {
      if (existing.value.pixelFormat !== pixelFormat) {
        throw new Error('GPU tile cache format mismatch for existing tile');
      }
      return existing.value;
    }

    const tileBytes = tileGpuByteLength(pixelFormat);
    if (!this.#gpuCache.prepareAdmission(tileBytes, residency)) {
      throw new RangeError('GPU tile cache cannot evict lower-priority entries for admission');
    }
    const beforeAtlasBytes = this.#atlas.snapshot().residentBytes;
    const slot = this.#atlas.allocate(key, pixelFormat);
    const afterAllocation = this.#atlas.snapshot();
    const pageAllocationBytes = afterAllocation.residentBytes - beforeAtlasBytes;
    const gpuSnapshot = this.#gpuCache.snapshot();
    if (
      pageAllocationBytes > gpuSingleAllocationSoftLimitV1(gpuSnapshot.profile) ||
      afterAllocation.residentBytes > gpuSnapshot.budgetBytes
    ) {
      this.#atlas.release(key);
      throw new RangeError('GPU atlas allocation exceeds active cache profile soft budget');
    }

    const cached = this.#gpuCache.put(key, slot, tileBytes, residency);
    if (cached === null) {
      this.#atlas.release(key);
      throw new RangeError('GPU tile cache admission exceeds active soft budget');
    }
    return slot;
  }

  releaseGpuTile(coordinate: TileCoordinateV1): boolean {
    return this.#gpuCache.delete(tileKeyV1(coordinate));
  }

  discardGpuResidency(): void {
    this.#gpuCache.clear();
    this.#atlas.clear();
  }

  cacheCpuBacking(
    coordinate: TileCoordinateV1,
    bytes: Uint8Array,
    residency: TileCacheResidencyV1 = 'background',
  ): boolean {
    if (!this.#tiles.has(coordinate)) {
      throw new Error('cannot cache CPU backing for an absent sparse tile');
    }
    const owned = new Uint8Array(bytes.byteLength);
    owned.set(bytes);
    return this.#cpuCache.put(tileKeyV1(coordinate), owned, owned.byteLength, residency) !== null;
  }

  getCpuBacking(coordinate: TileCoordinateV1): Uint8Array<ArrayBuffer> | null {
    return this.#cpuCache.get(tileKeyV1(coordinate))?.value ?? null;
  }

  releaseCpuBacking(coordinate: TileCoordinateV1): boolean {
    return this.#cpuCache.delete(tileKeyV1(coordinate));
  }

  getGpuSlot(coordinate: TileCoordinateV1): GpuAtlasSlotV1 | null {
    return this.#gpuCache.peek(tileKeyV1(coordinate))?.value ?? null;
  }

  resolveViewport(viewport: DocumentViewportRectV1): ViewportTileResolutionV1 {
    return resolveViewportTilesV1(this.#documentWidth, this.#documentHeight, viewport);
  }

  getTile(coordinate: TileCoordinateV1): SparseTileEntryV1<RendererLogicalTileV1> | null {
    return this.#tiles.get(coordinate);
  }

  getDirty(coordinate: TileCoordinateV1): DirtyTileStateV1 | null {
    return this.#dirty.get(coordinate);
  }

  dispose(): void {
    this.discardGpuResidency();
    this.#cpuCache.clear();
    this.#gpuDevice = null;
  }
}
