import { freezeRgbUnitColorV1, type RgbUnitColorV1 } from '../domain/color.js';
import type { CanvasBackgroundSpec } from '../domain/document.js';
import type { PointerInputBatchV1 } from '../input/pointer-input.js';
import {
  readBaselineRasterTilePixelV1,
  type BaselineRasterTileImageV1,
} from '../gpu/baseline-raster-tile-store.js';
import { CANONICAL_TILE_SIZE_PX } from '../gpu/sparse-tile-model.js';

export type ColorSamplingSourceV1 = 'active-layer' | 'merged-canvas';
export type SampledRgbaV1 = readonly [number, number, number, number];

export interface RasterTileSamplingIndexV1 {
  readonly schema: 'illustro.raster-tile-sampling-index/1';
  sampleRgba(documentX: number, documentY: number): SampledRgbaV1 | null;
}

export interface ColorSamplingOwnershipDecisionV1 {
  readonly consumed: boolean;
  readonly shouldSample: boolean;
  readonly finalize: boolean;
  readonly cancel: boolean;
}

export interface ColorSamplingOwnershipSnapshotV1 {
  readonly schema: 'illustro.color-sampling-ownership/1';
  readonly explicitEnabled: boolean;
  readonly quickEnabled: boolean;
  readonly active: boolean;
  readonly ownedPointerCount: number;
}

const PASS_DECISION: ColorSamplingOwnershipDecisionV1 = Object.freeze({
  consumed: false,
  shouldSample: false,
  finalize: false,
  cancel: false,
});

function samplingDecision(
  shouldSample: boolean,
  finalize = false,
  cancel = false,
): ColorSamplingOwnershipDecisionV1 {
  return Object.freeze({ consumed: true, shouldSample, finalize, cancel });
}

export class ColorSamplingOwnershipV1 {
  #explicitEnabled = false;
  readonly #quickSources = new Set<string>();
  readonly #ownedPointers = new Set<number>();

  setExplicitEnabled(enabled: boolean): ColorSamplingOwnershipSnapshotV1 {
    this.#explicitEnabled = enabled;
    return this.snapshot();
  }

  setQuickEnabled(enabled: boolean): ColorSamplingOwnershipSnapshotV1 {
    return this.setQuickSourceEnabled('legacy', enabled);
  }

  setQuickSourceEnabled(sourceId: string, enabled: boolean): ColorSamplingOwnershipSnapshotV1 {
    const normalized = sourceId.trim();
    if (normalized.length < 1 || normalized.length > 160) {
      throw new RangeError('quick eyedropper source id must contain 1..160 characters');
    }
    if (enabled) this.#quickSources.add(normalized);
    else this.#quickSources.delete(normalized);
    return this.snapshot();
  }

  snapshot(): ColorSamplingOwnershipSnapshotV1 {
    const quickEnabled = this.#quickSources.size > 0;
    return Object.freeze({
      schema: 'illustro.color-sampling-ownership/1' as const,
      explicitEnabled: this.#explicitEnabled,
      quickEnabled,
      active: this.#explicitEnabled || quickEnabled,
      ownedPointerCount: this.#ownedPointers.size,
    });
  }

  route(batch: PointerInputBatchV1): ColorSamplingOwnershipDecisionV1 {
    if (batch.eventType === 'pointerdown' && this.snapshot().active) {
      this.#ownedPointers.add(batch.pointerId);
    }
    if (!this.#ownedPointers.has(batch.pointerId)) return PASS_DECISION;

    if (batch.eventType === 'pointercancel') {
      this.#ownedPointers.delete(batch.pointerId);
      return samplingDecision(false, false, true);
    }
    if (batch.eventType === 'pointerup') {
      this.#ownedPointers.delete(batch.pointerId);
      return samplingDecision(true, true, false);
    }
    if (
      batch.eventType === 'pointerdown' ||
      batch.eventType === 'pointermove' ||
      batch.eventType === 'pointerrawupdate'
    ) {
      return samplingDecision(batch.eventType !== 'pointerrawupdate');
    }
    return samplingDecision(false);
  }
}

function tileCoordinateKey(tx: number, ty: number): string {
  return `${tx}:${ty}`;
}

export function createRasterTileSamplingIndexV1(
  tiles: readonly BaselineRasterTileImageV1[],
  layerId?: string,
): RasterTileSamplingIndexV1 {
  const tileMap = new Map<string, BaselineRasterTileImageV1>();
  for (const tile of tiles) {
    if (layerId !== undefined && tile.layerId !== layerId) continue;
    tileMap.set(tileCoordinateKey(tile.coordinate.tx, tile.coordinate.ty), tile);
  }
  return Object.freeze({
    schema: 'illustro.raster-tile-sampling-index/1' as const,
    sampleRgba(documentX: number, documentY: number): SampledRgbaV1 | null {
      if (!Number.isFinite(documentX) || !Number.isFinite(documentY)) return null;
      const pixelX = Math.floor(documentX);
      const pixelY = Math.floor(documentY);
      if (pixelX < 0 || pixelY < 0) return null;
      const tx = Math.floor(pixelX / CANONICAL_TILE_SIZE_PX);
      const ty = Math.floor(pixelY / CANONICAL_TILE_SIZE_PX);
      const tile = tileMap.get(tileCoordinateKey(tx, ty));
      if (tile === undefined) return null;
      const localX = pixelX - tx * CANONICAL_TILE_SIZE_PX;
      const localY = pixelY - ty * CANONICAL_TILE_SIZE_PX;
      if (localX < 0 || localY < 0 || localX >= tile.width || localY >= tile.height) return null;
      return readBaselineRasterTilePixelV1(tile, localY * tile.width + localX);
    },
  });
}

function rgbaToRgbOrNull(rgba: SampledRgbaV1 | null): RgbUnitColorV1 | null {
  if (rgba === null || rgba[3] <= 0) return null;
  return freezeRgbUnitColorV1([rgba[0], rgba[1], rgba[2]]);
}

export function sampleActiveLayerColorV1(
  index: RasterTileSamplingIndexV1,
  documentX: number,
  documentY: number,
): RgbUnitColorV1 | null {
  return rgbaToRgbOrNull(index.sampleRgba(documentX, documentY));
}

export function sampleMergedCanvasColorV1(
  index: RasterTileSamplingIndexV1,
  documentX: number,
  documentY: number,
  background: CanvasBackgroundSpec,
): RgbUnitColorV1 | null {
  const source = index.sampleRgba(documentX, documentY);
  if (background.kind === 'transparent') return rgbaToRgbOrNull(source);

  const backdrop = background.rgba;
  if (source === null || source[3] <= 0) {
    if (backdrop[3] <= 0) return null;
    return freezeRgbUnitColorV1([backdrop[0], backdrop[1], backdrop[2]]);
  }
  const sourceAlpha = source[3];
  const backdropWeight = backdrop[3] * (1 - sourceAlpha);
  const outputAlpha = sourceAlpha + backdropWeight;
  if (outputAlpha <= 0) return null;
  return freezeRgbUnitColorV1([
    (source[0] * sourceAlpha + backdrop[0] * backdropWeight) / outputAlpha,
    (source[1] * sourceAlpha + backdrop[1] * backdropWeight) / outputAlpha,
    (source[2] * sourceAlpha + backdrop[2] * backdropWeight) / outputAlpha,
  ]);
}
