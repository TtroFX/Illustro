import type { Revision } from '../domain/identity.js';
import type { RasterTileReferenceV1 } from '../domain/layers.js';
import {
  CANONICAL_TILE_SIZE_PX,
  tileBoundsForDocumentV1,
  tileGridForDocumentV1,
} from '../gpu/sparse-tile-model.js';
import type { PaintDecodedRasterTileV1 } from './paint-persistence-controller.js';
import {
  type RasterSelectionCoverageV1,
  SelectionCoverageControllerV1,
  type SelectionCoverageSnapshotV1,
} from './selection-coverage-controller.js';
import type {
  PreparedSelectionCoverageV1,
  SelectionCoveragePersistencePortV1,
} from './selection-shape-engine.js';

export const MAX_SELECTION_MODIFIER_RADIUS_PX = 1024 as const;

export type SelectionMorphologyOperationV1 = 'expand' | 'contract' | 'feather';

export interface SelectionModifierStoragePortV1 extends SelectionCoveragePersistencePortV1 {
  readRasterTile(payloadRef: string): Promise<PaintDecodedRasterTileV1>;
}

export interface SelectionModifierInputV1 {
  readonly documentWidth: number;
  readonly documentHeight: number;
  readonly revision: Revision;
  readonly storage: SelectionModifierStoragePortV1;
}

interface DecodedCoverageTileV1 {
  readonly width: number;
  readonly height: number;
  readonly values: Uint8Array<ArrayBuffer>;
}

function tileKey(tx: number, ty: number): string {
  return `${tx}:${ty}`;
}

function validateDimensions(width: number, height: number): void {
  if (!Number.isSafeInteger(width) || width < 1 || !Number.isSafeInteger(height) || height < 1) {
    throw new RangeError('selection modifier dimensions must be positive safe integers');
  }
  tileGridForDocumentV1(width, height);
}

function validateRadius(radiusPx: number): number {
  if (!Number.isSafeInteger(radiusPx) || radiusPx < 0) {
    throw new RangeError('selection modifier radius must be a non-negative safe integer');
  }
  if (radiusPx > MAX_SELECTION_MODIFIER_RADIUS_PX) {
    throw new RangeError(
      `selection modifier radius exceeds the current ${MAX_SELECTION_MODIFIER_RADIUS_PX}px safety limit`,
    );
  }
  return radiusPx;
}

function effectiveDefaultV1(coverage: RasterSelectionCoverageV1): 0 | 1 {
  return coverage.inverted ? (coverage.defaultCoverage === 1 ? 0 : 1) : coverage.defaultCoverage;
}

function assertMorphologyReadyV1(coverage: RasterSelectionCoverageV1): void {
  if (coverage.transformStack.length > 0) {
    throw new Error('selection morphology requires transformed coverage to be baked first');
  }
  if (coverage.effectStack.length > 0) {
    throw new Error('selection morphology requires effected coverage to be baked first');
  }
}

function validateDecodedCoverageTileV1(
  decoded: PaintDecodedRasterTileV1,
  width: number,
  height: number,
): void {
  if (
    decoded.pixelFormat !== 'rgba8-unorm' ||
    decoded.width !== width ||
    decoded.height !== height
  ) {
    throw new Error('selection modifier tile does not match canonical RGBA8 coverage');
  }
  if (decoded.bytes.byteLength !== width * height * 4) {
    throw new Error('selection modifier tile byte length is invalid');
  }
}

async function decodeCoverageTilesV1(
  coverage: RasterSelectionCoverageV1,
  width: number,
  height: number,
  storage: SelectionModifierStoragePortV1,
): Promise<ReadonlyMap<string, DecodedCoverageTileV1>> {
  const result = new Map<string, DecodedCoverageTileV1>();
  for (const reference of coverage.tiles) {
    const key = tileKey(reference.x, reference.y);
    if (result.has(key)) throw new Error(`duplicate selection coverage tile: ${key}`);
    const bounds = tileBoundsForDocumentV1(width, height, { tx: reference.x, ty: reference.y });
    const decoded = await storage.readRasterTile(reference.payloadRef);
    validateDecodedCoverageTileV1(decoded, bounds.validWidth, bounds.validHeight);
    const values = new Uint8Array(bounds.validWidth * bounds.validHeight);
    for (let pixel = 0; pixel < values.length; pixel += 1) {
      const offset = pixel * 4;
      const red = decoded.bytes[offset] ?? 0;
      const green = decoded.bytes[offset + 1] ?? 0;
      const blue = decoded.bytes[offset + 2] ?? 0;
      const alpha = decoded.bytes[offset + 3] ?? 0;
      if (red !== green || red !== blue || alpha !== 255) {
        throw new Error('selection modifier tile violates canonical grayscale coverage encoding');
      }
      values[pixel] = coverage.inverted ? 255 - red : red;
    }
    result.set(
      key,
      Object.freeze({
        width: bounds.validWidth,
        height: bounds.validHeight,
        values,
      }),
    );
  }
  return result;
}

function sampleCoverageV1(
  x: number,
  y: number,
  documentWidth: number,
  documentHeight: number,
  defaultCoverage: 0 | 1,
  tiles: ReadonlyMap<string, DecodedCoverageTileV1>,
): number {
  if (x < 0 || y < 0 || x >= documentWidth || y >= documentHeight) return 0;
  const tx = Math.floor(x / CANONICAL_TILE_SIZE_PX);
  const ty = Math.floor(y / CANONICAL_TILE_SIZE_PX);
  const tile = tiles.get(tileKey(tx, ty));
  if (tile === undefined) return defaultCoverage === 1 ? 255 : 0;
  const localX = x - tx * CANONICAL_TILE_SIZE_PX;
  const localY = y - ty * CANONICAL_TILE_SIZE_PX;
  return tile.values[localY * tile.width + localX] ?? 0;
}

function addCandidate(
  candidates: Map<string, readonly [number, number]>,
  tx: number,
  ty: number,
  columns: number,
  rows: number,
): void {
  if (tx < 0 || ty < 0 || tx >= columns || ty >= rows) return;
  candidates.set(tileKey(tx, ty), Object.freeze([tx, ty] as const));
}

function candidateTilesV1(
  coverage: RasterSelectionCoverageV1,
  operation: SelectionMorphologyOperationV1,
  radiusPx: number,
  columns: number,
  rows: number,
  defaultCoverage: 0 | 1,
): readonly (readonly [number, number])[] {
  const candidates = new Map<string, readonly [number, number]>();
  const halo = Math.ceil(radiusPx / CANONICAL_TILE_SIZE_PX);
  for (const tile of coverage.tiles) {
    for (let dy = -halo; dy <= halo; dy += 1) {
      for (let dx = -halo; dx <= halo; dx += 1) {
        addCandidate(candidates, tile.x + dx, tile.y + dy, columns, rows);
      }
    }
    if (halo === 0) addCandidate(candidates, tile.x, tile.y, columns, rows);
  }

  // Contracting or feathering an all-selected/default-selected canvas must still
  // see the unselected area outside the document. Only the boundary band can
  // differ from the default, so keep this sparse rather than materializing all tiles.
  if (radiusPx > 0 && defaultCoverage === 1 && operation !== 'expand') {
    const boundaryBand = Math.max(1, halo);
    for (let ty = 0; ty < rows; ty += 1) {
      for (let tx = 0; tx < columns; tx += 1) {
        if (
          tx < boundaryBand ||
          ty < boundaryBand ||
          tx >= columns - boundaryBand ||
          ty >= rows - boundaryBand
        ) {
          addCandidate(candidates, tx, ty, columns, rows);
        }
      }
    }
  }

  return Object.freeze(
    [...candidates.values()].sort((left, right) => left[1] - right[1] || left[0] - right[0]),
  );
}

function buildPatchV1(
  originX: number,
  originY: number,
  outputWidth: number,
  outputHeight: number,
  radiusPx: number,
  documentWidth: number,
  documentHeight: number,
  defaultCoverage: 0 | 1,
  tiles: ReadonlyMap<string, DecodedCoverageTileV1>,
): { readonly width: number; readonly height: number; readonly values: Uint8Array<ArrayBuffer> } {
  const width = outputWidth + radiusPx * 2;
  const height = outputHeight + radiusPx * 2;
  const values = new Uint8Array(width * height);
  for (let py = 0; py < height; py += 1) {
    const y = originY + py - radiusPx;
    for (let px = 0; px < width; px += 1) {
      const x = originX + px - radiusPx;
      values[py * width + px] = sampleCoverageV1(
        x,
        y,
        documentWidth,
        documentHeight,
        defaultCoverage,
        tiles,
      );
    }
  }
  return Object.freeze({ width, height, values });
}

function horizontalExtremaV1(
  patch: Uint8Array,
  patchWidth: number,
  patchHeight: number,
  outputWidth: number,
  radiusPx: number,
  mode: 'max' | 'min',
): Uint8Array<ArrayBuffer> {
  const result = new Uint8Array(patchHeight * outputWidth);
  const window = radiusPx * 2 + 1;
  const deque = new Int32Array(patchWidth);
  for (let y = 0; y < patchHeight; y += 1) {
    let head = 0;
    let tail = 0;
    const rowOffset = y * patchWidth;
    for (let x = 0; x < patchWidth; x += 1) {
      const value = patch[rowOffset + x] ?? 0;
      while (tail > head) {
        const previousIndex = deque[tail - 1] ?? 0;
        const previous = patch[rowOffset + previousIndex] ?? 0;
        if (mode === 'max' ? previous > value : previous < value) break;
        tail -= 1;
      }
      deque[tail] = x;
      tail += 1;
      const expired = x - window;
      while (tail > head && (deque[head] ?? 0) <= expired) head += 1;
      if (x >= window - 1) {
        const outputX = x - (window - 1);
        if (outputX < outputWidth) {
          const best = deque[head] ?? 0;
          result[y * outputWidth + outputX] = patch[rowOffset + best] ?? 0;
        }
      }
    }
  }
  return result;
}

function verticalExtremaV1(
  horizontal: Uint8Array,
  patchHeight: number,
  outputWidth: number,
  outputHeight: number,
  radiusPx: number,
  mode: 'max' | 'min',
): Uint8Array<ArrayBuffer> {
  const result = new Uint8Array(outputWidth * outputHeight);
  const window = radiusPx * 2 + 1;
  const deque = new Int32Array(patchHeight);
  for (let x = 0; x < outputWidth; x += 1) {
    let head = 0;
    let tail = 0;
    for (let y = 0; y < patchHeight; y += 1) {
      const value = horizontal[y * outputWidth + x] ?? 0;
      while (tail > head) {
        const previousIndex = deque[tail - 1] ?? 0;
        const previous = horizontal[previousIndex * outputWidth + x] ?? 0;
        if (mode === 'max' ? previous > value : previous < value) break;
        tail -= 1;
      }
      deque[tail] = y;
      tail += 1;
      const expired = y - window;
      while (tail > head && (deque[head] ?? 0) <= expired) head += 1;
      if (y >= window - 1) {
        const outputY = y - (window - 1);
        if (outputY < outputHeight) {
          const best = deque[head] ?? 0;
          result[outputY * outputWidth + x] = horizontal[best * outputWidth + x] ?? 0;
        }
      }
    }
  }
  return result;
}

function morphologyTileV1(
  patch: Uint8Array,
  patchWidth: number,
  patchHeight: number,
  outputWidth: number,
  outputHeight: number,
  radiusPx: number,
  mode: 'max' | 'min',
): Uint8Array<ArrayBuffer> {
  const horizontal = horizontalExtremaV1(
    patch,
    patchWidth,
    patchHeight,
    outputWidth,
    radiusPx,
    mode,
  );
  return verticalExtremaV1(horizontal, patchHeight, outputWidth, outputHeight, radiusPx, mode);
}

function horizontalBoxAverageV1(
  patch: Uint8Array,
  patchWidth: number,
  patchHeight: number,
  outputWidth: number,
  radiusPx: number,
): Float64Array<ArrayBuffer> {
  const result = new Float64Array(patchHeight * outputWidth);
  const window = radiusPx * 2 + 1;
  for (let y = 0; y < patchHeight; y += 1) {
    const rowOffset = y * patchWidth;
    let sum = 0;
    for (let x = 0; x < window; x += 1) sum += patch[rowOffset + x] ?? 0;
    result[y * outputWidth] = sum / window;
    for (let outputX = 1; outputX < outputWidth; outputX += 1) {
      sum -= patch[rowOffset + outputX - 1] ?? 0;
      sum += patch[rowOffset + outputX + window - 1] ?? 0;
      result[y * outputWidth + outputX] = sum / window;
    }
  }
  return result;
}

function verticalBoxAverageV1(
  horizontal: Float64Array,
  patchHeight: number,
  outputWidth: number,
  outputHeight: number,
  radiusPx: number,
): Uint8Array<ArrayBuffer> {
  const result = new Uint8Array(outputWidth * outputHeight);
  const window = radiusPx * 2 + 1;
  for (let x = 0; x < outputWidth; x += 1) {
    let sum = 0;
    for (let y = 0; y < window; y += 1) sum += horizontal[y * outputWidth + x] ?? 0;
    result[x] = Math.round(sum / window);
    for (let outputY = 1; outputY < outputHeight; outputY += 1) {
      sum -= horizontal[(outputY - 1) * outputWidth + x] ?? 0;
      sum += horizontal[(outputY + window - 1) * outputWidth + x] ?? 0;
      result[outputY * outputWidth + x] = Math.round(sum / window);
    }
  }
  return result;
}

function featherTileV1(
  patch: Uint8Array,
  patchWidth: number,
  patchHeight: number,
  outputWidth: number,
  outputHeight: number,
  radiusPx: number,
): Uint8Array<ArrayBuffer> {
  if (radiusPx === 0) {
    const result = new Uint8Array(outputWidth * outputHeight);
    for (let y = 0; y < outputHeight; y += 1) {
      const sourceOffset = y * patchWidth;
      result.set(patch.subarray(sourceOffset, sourceOffset + outputWidth), y * outputWidth);
    }
    return result;
  }
  const horizontal = horizontalBoxAverageV1(patch, patchWidth, patchHeight, outputWidth, radiusPx);
  return verticalBoxAverageV1(horizontal, patchHeight, outputWidth, outputHeight, radiusPx);
}

function encodeCoverageBytesV1(values: Uint8Array): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(values.length * 4);
  for (let pixel = 0; pixel < values.length; pixel += 1) {
    const value = values[pixel] ?? 0;
    const offset = pixel * 4;
    bytes[offset] = value;
    bytes[offset + 1] = value;
    bytes[offset + 2] = value;
    bytes[offset + 3] = 255;
  }
  return bytes;
}

function differsFromDefaultV1(values: Uint8Array, defaultCoverage: 0 | 1): boolean {
  const expected = defaultCoverage === 1 ? 255 : 0;
  return values.some((value) => value !== expected);
}

export function deselectSelectionV1(
  controller: SelectionCoverageControllerV1,
): SelectionCoverageSnapshotV1 {
  return controller.clear();
}

export function invertSelectionV1(
  controller: SelectionCoverageControllerV1,
  revision: Revision,
): SelectionCoverageSnapshotV1 {
  const coverage = controller.snapshot().coverage;
  if (coverage === null) throw new Error('invert selection requires an active selection');
  return controller.replace(
    Object.freeze({
      ...coverage,
      inverted: !coverage.inverted,
      sourceRevision: revision,
    }),
  );
}

export async function prepareSelectionMorphologyV1(
  coverage: RasterSelectionCoverageV1,
  operation: SelectionMorphologyOperationV1,
  radiusPxInput: number,
  input: SelectionModifierInputV1,
): Promise<PreparedSelectionCoverageV1> {
  validateDimensions(input.documentWidth, input.documentHeight);
  const radiusPx = validateRadius(radiusPxInput);
  assertMorphologyReadyV1(coverage);
  const grid = tileGridForDocumentV1(input.documentWidth, input.documentHeight);
  const defaultCoverage = effectiveDefaultV1(coverage);
  const decodedTiles = await decodeCoverageTilesV1(
    coverage,
    input.documentWidth,
    input.documentHeight,
    input.storage,
  );
  const candidates = candidateTilesV1(
    coverage,
    operation,
    radiusPx,
    grid.columns,
    grid.rows,
    defaultCoverage,
  );
  const outputTiles: RasterTileReferenceV1[] = [];

  for (const [tx, ty] of candidates) {
    const bounds = tileBoundsForDocumentV1(input.documentWidth, input.documentHeight, { tx, ty });
    const patch = buildPatchV1(
      bounds.x,
      bounds.y,
      bounds.validWidth,
      bounds.validHeight,
      radiusPx,
      input.documentWidth,
      input.documentHeight,
      defaultCoverage,
      decodedTiles,
    );
    let values: Uint8Array<ArrayBuffer>;
    if (operation === 'feather') {
      values = featherTileV1(
        patch.values,
        patch.width,
        patch.height,
        bounds.validWidth,
        bounds.validHeight,
        radiusPx,
      );
    } else {
      values = morphologyTileV1(
        patch.values,
        patch.width,
        patch.height,
        bounds.validWidth,
        bounds.validHeight,
        radiusPx,
        operation === 'expand' ? 'max' : 'min',
      );
    }
    if (!differsFromDefaultV1(values, defaultCoverage)) continue;
    const persisted = await input.storage.persistRasterTile({
      width: bounds.validWidth,
      height: bounds.validHeight,
      pixelFormat: 'rgba8-unorm',
      bytes: encodeCoverageBytesV1(values),
    });
    outputTiles.push(
      Object.freeze({
        x: tx,
        y: ty,
        revision: input.revision,
        payloadRef: persisted.payloadRef,
      }),
    );
  }

  return Object.freeze({
    schema: 'illustro.prepared-selection-coverage/1' as const,
    defaultCoverage,
    tiles: Object.freeze(outputTiles),
    sourceRevision: input.revision,
  });
}

export function prepareExpandedSelectionCoverageV1(
  coverage: RasterSelectionCoverageV1,
  radiusPx: number,
  input: SelectionModifierInputV1,
): Promise<PreparedSelectionCoverageV1> {
  return prepareSelectionMorphologyV1(coverage, 'expand', radiusPx, input);
}

export function prepareContractedSelectionCoverageV1(
  coverage: RasterSelectionCoverageV1,
  radiusPx: number,
  input: SelectionModifierInputV1,
): Promise<PreparedSelectionCoverageV1> {
  return prepareSelectionMorphologyV1(coverage, 'contract', radiusPx, input);
}

export function prepareFeatheredSelectionCoverageV1(
  coverage: RasterSelectionCoverageV1,
  radiusPx: number,
  input: SelectionModifierInputV1,
): Promise<PreparedSelectionCoverageV1> {
  return prepareSelectionMorphologyV1(coverage, 'feather', radiusPx, input);
}

export async function applySelectionMorphologyV1(
  controller: SelectionCoverageControllerV1,
  operation: SelectionMorphologyOperationV1,
  radiusPx: number,
  input: SelectionModifierInputV1,
): Promise<SelectionCoverageSnapshotV1> {
  const coverage = controller.snapshot().coverage;
  if (coverage === null) throw new Error('selection morphology requires an active selection');
  const prepared = await prepareSelectionMorphologyV1(coverage, operation, radiusPx, input);
  return controller.replacePrepared(prepared);
}
