import { CANONICAL_TILE_SIZE_PX } from './sparse-tile-model.js';

export const GPU_ATLAS_PAGE_SIZE_PX = 2_048 as const;
export const GPU_ATLAS_SLOTS_PER_AXIS = GPU_ATLAS_PAGE_SIZE_PX / CANONICAL_TILE_SIZE_PX;
export const GPU_ATLAS_SLOTS_PER_PAGE = GPU_ATLAS_SLOTS_PER_AXIS * GPU_ATLAS_SLOTS_PER_AXIS;

export type GpuAtlasPixelFormatV1 = 'rgba8-unorm' | 'rgba16-float';

export interface GpuAtlasPageDescriptorV1 {
  readonly pageId: string;
  readonly width: typeof GPU_ATLAS_PAGE_SIZE_PX;
  readonly height: typeof GPU_ATLAS_PAGE_SIZE_PX;
  readonly pixelFormat: GpuAtlasPixelFormatV1;
  readonly byteLength: number;
}

export interface GpuAtlasSlotV1 {
  readonly pageId: string;
  readonly slotIndex: number;
  readonly x: number;
  readonly y: number;
  readonly width: typeof CANONICAL_TILE_SIZE_PX;
  readonly height: typeof CANONICAL_TILE_SIZE_PX;
  readonly pixelFormat: GpuAtlasPixelFormatV1;
}

export interface GpuAtlasPageSnapshotV1 {
  readonly pageId: string;
  readonly pixelFormat: GpuAtlasPixelFormatV1;
  readonly usedSlots: number;
  readonly freeSlots: number;
  readonly byteLength: number;
}

export interface GpuAtlasSnapshotV1 {
  readonly schema: 'illustro.gpu-atlas/1';
  readonly pageCount: number;
  readonly residentBytes: number;
  readonly pages: readonly GpuAtlasPageSnapshotV1[];
}

export interface GpuAtlasResourceFactoryV1<Resource> {
  create(descriptor: GpuAtlasPageDescriptorV1): Resource;
  destroy?(resource: Resource, descriptor: GpuAtlasPageDescriptorV1): void;
}

interface GpuAtlasPageV1<Resource> {
  readonly descriptor: GpuAtlasPageDescriptorV1;
  readonly resource: Resource;
  readonly slots: boolean[];
  usedSlots: number;
}

function atlasPageByteLength(pixelFormat: GpuAtlasPixelFormatV1): number {
  const bytesPerPixel = pixelFormat === 'rgba8-unorm' ? 4 : 8;
  return GPU_ATLAS_PAGE_SIZE_PX * GPU_ATLAS_PAGE_SIZE_PX * bytesPerPixel;
}

export function atlasSlotRectV1(
  pageId: string,
  slotIndex: number,
  pixelFormat: GpuAtlasPixelFormatV1,
): GpuAtlasSlotV1 {
  if (!Number.isSafeInteger(slotIndex) || slotIndex < 0 || slotIndex >= GPU_ATLAS_SLOTS_PER_PAGE) {
    throw new RangeError(`atlas slot index must be in 0..${GPU_ATLAS_SLOTS_PER_PAGE - 1}`);
  }
  const slotX = slotIndex % GPU_ATLAS_SLOTS_PER_AXIS;
  const slotY = Math.floor(slotIndex / GPU_ATLAS_SLOTS_PER_AXIS);
  return Object.freeze({
    pageId,
    slotIndex,
    x: slotX * CANONICAL_TILE_SIZE_PX,
    y: slotY * CANONICAL_TILE_SIZE_PX,
    width: CANONICAL_TILE_SIZE_PX,
    height: CANONICAL_TILE_SIZE_PX,
    pixelFormat,
  });
}

export class GpuAtlasPageManagerV1<Resource> {
  readonly #factory: GpuAtlasResourceFactoryV1<Resource>;
  readonly #pages = new Map<string, GpuAtlasPageV1<Resource>>();
  readonly #assignments = new Map<string, GpuAtlasSlotV1>();
  #nextPageId = 1;

  constructor(factory: GpuAtlasResourceFactoryV1<Resource>) {
    this.#factory = factory;
  }

  snapshot(): GpuAtlasSnapshotV1 {
    const pages = [...this.#pages.values()].map((page) =>
      Object.freeze({
        pageId: page.descriptor.pageId,
        pixelFormat: page.descriptor.pixelFormat,
        usedSlots: page.usedSlots,
        freeSlots: GPU_ATLAS_SLOTS_PER_PAGE - page.usedSlots,
        byteLength: page.descriptor.byteLength,
      }),
    );
    return Object.freeze({
      schema: 'illustro.gpu-atlas/1',
      pageCount: pages.length,
      residentBytes: pages.reduce((total, page) => total + page.byteLength, 0),
      pages: Object.freeze(pages),
    });
  }

  get(tileKey: string): GpuAtlasSlotV1 | null {
    return this.#assignments.get(tileKey) ?? null;
  }

  getPageResource(pageId: string): Resource | null {
    return this.#pages.get(pageId)?.resource ?? null;
  }

  allocate(tileKey: string, pixelFormat: GpuAtlasPixelFormatV1): GpuAtlasSlotV1 {
    if (tileKey.length === 0) throw new TypeError('atlas tile key must not be empty');
    const existing = this.#assignments.get(tileKey);
    if (existing !== undefined) {
      if (existing.pixelFormat !== pixelFormat) {
        throw new Error('atlas tile is already allocated with a different pixel format');
      }
      return existing;
    }

    let page = [...this.#pages.values()].find(
      (candidate) =>
        candidate.descriptor.pixelFormat === pixelFormat &&
        candidate.usedSlots < GPU_ATLAS_SLOTS_PER_PAGE,
    );
    if (page === undefined) page = this.#createPage(pixelFormat);
    const slotIndex = page.slots.findIndex((occupied) => !occupied);
    if (slotIndex < 0) throw new Error('atlas page metadata is inconsistent');
    page.slots[slotIndex] = true;
    page.usedSlots += 1;
    const slot = atlasSlotRectV1(page.descriptor.pageId, slotIndex, pixelFormat);
    this.#assignments.set(tileKey, slot);
    return slot;
  }

  release(tileKey: string): boolean {
    const assignment = this.#assignments.get(tileKey);
    if (assignment === undefined) return false;
    const page = this.#pages.get(assignment.pageId);
    if (page === undefined) throw new Error('atlas assignment references a missing page');
    page.slots[assignment.slotIndex] = false;
    page.usedSlots -= 1;
    this.#assignments.delete(tileKey);
    if (page.usedSlots === 0) {
      this.#pages.delete(page.descriptor.pageId);
      this.#factory.destroy?.(page.resource, page.descriptor);
    }
    return true;
  }

  clear(): void {
    for (const page of this.#pages.values())
      this.#factory.destroy?.(page.resource, page.descriptor);
    this.#pages.clear();
    this.#assignments.clear();
  }

  #createPage(pixelFormat: GpuAtlasPixelFormatV1): GpuAtlasPageV1<Resource> {
    const pageId = `atlas-${this.#nextPageId++}`;
    const descriptor = Object.freeze({
      pageId,
      width: GPU_ATLAS_PAGE_SIZE_PX,
      height: GPU_ATLAS_PAGE_SIZE_PX,
      pixelFormat,
      byteLength: atlasPageByteLength(pixelFormat),
    });
    const page: GpuAtlasPageV1<Resource> = {
      descriptor,
      resource: this.#factory.create(descriptor),
      slots: Array.from({ length: GPU_ATLAS_SLOTS_PER_PAGE }, () => false),
      usedSlots: 0,
    };
    this.#pages.set(pageId, page);
    return page;
  }
}
