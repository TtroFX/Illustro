import type { GpuAtlasPixelFormatV1 } from './gpu-atlas.js';

export const MAX_DIRECT_TILE_HALO_PX = 64 as const;
export const DEFAULT_TRANSIENT_MAX_DIMENSION_PX = 8_192 as const;

export type TransientTargetKindV1 = 'filter-halo' | 'compositor-intermediate';
export type TransientTargetStrategyV1 =
  | 'direct-tile'
  | 'expanded-region'
  | 'separable'
  | 'multiscale';

export interface TransientTargetRequestV1 {
  readonly kind: TransientTargetKindV1;
  readonly strategy: TransientTargetStrategyV1;
  readonly pixelFormat: GpuAtlasPixelFormatV1;
  readonly coreWidth: number;
  readonly coreHeight: number;
  readonly haloPx: number;
}

export interface TransientTargetDescriptorV1 extends TransientTargetRequestV1 {
  readonly targetId: string;
  readonly width: number;
  readonly height: number;
  readonly byteLength: number;
}

export interface TransientTargetV1<Resource> {
  readonly descriptor: TransientTargetDescriptorV1;
  readonly resource: Resource;
}

export interface TransientTargetSnapshotV1 {
  readonly schema: 'illustro.transient-targets/1';
  readonly activeCount: number;
  readonly residentBytes: number;
}

export interface TransientTargetResourceFactoryV1<Resource> {
  create(descriptor: TransientTargetDescriptorV1): Resource;
  destroy?(resource: Resource, descriptor: TransientTargetDescriptorV1): void;
}

function assertPositiveInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new RangeError(`${label} must be a positive safe integer`);
  }
}

function assertHalo(value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError('haloPx must be a non-negative safe integer');
  }
}

function bytesPerPixel(pixelFormat: GpuAtlasPixelFormatV1): number {
  return pixelFormat === 'rgba8-unorm' ? 4 : 8;
}

export class TransientTargetManagerV1<Resource> {
  readonly #factory: TransientTargetResourceFactoryV1<Resource>;
  readonly #maxDimensionPx: number;
  readonly #active = new Map<string, TransientTargetV1<Resource>>();
  #nextId = 1;
  #residentBytes = 0;

  constructor(
    factory: TransientTargetResourceFactoryV1<Resource>,
    maxDimensionPx: number = DEFAULT_TRANSIENT_MAX_DIMENSION_PX,
  ) {
    assertPositiveInteger(maxDimensionPx, 'maxDimensionPx');
    this.#factory = factory;
    this.#maxDimensionPx = maxDimensionPx;
  }

  snapshot(): TransientTargetSnapshotV1 {
    return Object.freeze({
      schema: 'illustro.transient-targets/1',
      activeCount: this.#active.size,
      residentBytes: this.#residentBytes,
    });
  }

  acquire(request: TransientTargetRequestV1): TransientTargetV1<Resource> {
    assertPositiveInteger(request.coreWidth, 'coreWidth');
    assertPositiveInteger(request.coreHeight, 'coreHeight');
    assertHalo(request.haloPx);
    if (request.strategy === 'direct-tile' && request.haloPx > MAX_DIRECT_TILE_HALO_PX) {
      throw new RangeError(
        `direct-tile halo must be <= ${MAX_DIRECT_TILE_HALO_PX}px; use an expanded/separable/multiscale planner path`,
      );
    }

    const width = request.coreWidth + request.haloPx * 2;
    const height = request.coreHeight + request.haloPx * 2;
    if (width > this.#maxDimensionPx || height > this.#maxDimensionPx) {
      throw new RangeError('transient target exceeds the active WebGPU texture-dimension limit');
    }
    const byteLength = width * height * bytesPerPixel(request.pixelFormat);
    if (!Number.isSafeInteger(byteLength)) {
      throw new RangeError('transient target byte length exceeds the safe integer range');
    }

    const descriptor = Object.freeze({
      ...request,
      targetId: `transient-${this.#nextId++}`,
      width,
      height,
      byteLength,
    });
    const target = Object.freeze({ descriptor, resource: this.#factory.create(descriptor) });
    this.#active.set(descriptor.targetId, target);
    this.#residentBytes += byteLength;
    return target;
  }

  get(targetId: string): TransientTargetV1<Resource> | null {
    return this.#active.get(targetId) ?? null;
  }

  release(targetId: string): boolean {
    const target = this.#active.get(targetId);
    if (target === undefined) return false;
    this.#active.delete(targetId);
    this.#residentBytes -= target.descriptor.byteLength;
    this.#factory.destroy?.(target.resource, target.descriptor);
    return true;
  }

  clear(): void {
    for (const target of [...this.#active.values()]) this.release(target.descriptor.targetId);
  }
}
