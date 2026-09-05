import type { Revision } from '../domain/identity.js';
import type { RasterTileReferenceV1 } from '../domain/layers.js';
import { tileBoundsForDocumentV1, tileGridForDocumentV1 } from '../gpu/sparse-tile-model.js';
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

export type SelectionCombineModeV1 = 'replace' | 'add' | 'subtract' | 'intersect';

export interface SelectionCoverageStoragePortV1 extends SelectionCoveragePersistencePortV1 {
  readRasterTile(payloadRef: string): Promise<PaintDecodedRasterTileV1>;
}

function tileKey(x: number, y: number): string {
  return `${x}:${y}`;
}

function indexTilesV1(
  tiles: readonly RasterTileReferenceV1[],
): ReadonlyMap<string, RasterTileReferenceV1> {
  const indexed = new Map<string, RasterTileReferenceV1>();
  for (const tile of tiles) {
    const key = tileKey(tile.x, tile.y);
    if (indexed.has(key)) throw new Error(`duplicate selection coverage tile: ${key}`);
    indexed.set(key, tile);
  }
  return indexed;
}

function validateDimensions(width: number, height: number): void {
  if (!Number.isSafeInteger(width) || width < 1 || !Number.isSafeInteger(height) || height < 1) {
    throw new RangeError('selection combine dimensions must be positive safe integers');
  }
  tileGridForDocumentV1(width, height);
}

function validateCoverageTileV1(
  tile: PaintDecodedRasterTileV1,
  width: number,
  height: number,
): void {
  if (tile.pixelFormat !== 'rgba8-unorm' || tile.width !== width || tile.height !== height) {
    throw new Error('selection coverage tile does not match the canonical RGBA8 coverage contract');
  }
  if (tile.bytes.byteLength !== width * height * 4) {
    throw new Error('selection coverage tile byte length is invalid');
  }
}

function throwIfAbortedV1(signal: AbortSignal | undefined): void {
  if (!signal?.aborted) return;
  const error = new Error('Selection combine aborted');
  error.name = 'AbortError';
  throw error;
}

async function readCoverageBytesV1(
  reference: RasterTileReferenceV1 | undefined,
  defaultCoverage: 0 | 1,
  inverted: boolean,
  width: number,
  height: number,
  storage: SelectionCoverageStoragePortV1,
  signal?: AbortSignal,
): Promise<Uint8Array<ArrayBuffer>> {
  throwIfAbortedV1(signal);
  const base = defaultCoverage === 1 ? 255 : 0;
  const defaultValue = inverted ? 255 - base : base;
  const result = new Uint8Array(width * height);
  result.fill(defaultValue);
  if (reference === undefined) return result;
  const decoded = await storage.readRasterTile(reference.payloadRef);
  throwIfAbortedV1(signal);
  validateCoverageTileV1(decoded, width, height);
  for (let pixel = 0; pixel < result.length; pixel += 1) {
    const value = decoded.bytes[pixel * 4] ?? 0;
    result[pixel] = inverted ? 255 - value : value;
  }
  return result;
}

function combineValueV1(
  mode: Exclude<SelectionCombineModeV1, 'replace'>,
  left: number,
  right: number,
): number {
  switch (mode) {
    case 'add':
      return Math.max(left, right);
    case 'subtract':
      return Math.round((left * (255 - right)) / 255);
    case 'intersect':
      return Math.min(left, right);
  }
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

function equalCoverageValuesV1(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

function effectiveDefaultV1(coverage: RasterSelectionCoverageV1): 0 | 1 {
  return coverage.inverted ? (coverage.defaultCoverage === 1 ? 0 : 1) : coverage.defaultCoverage;
}

function assertCombinableExistingV1(coverage: RasterSelectionCoverageV1): void {
  if (coverage.transformStack.length > 0) {
    throw new Error('combining a transformed selection requires selection transform baking');
  }
  if (coverage.effectStack.length > 0) {
    throw new Error('combining an effected selection requires selection effect baking');
  }
}

function emptyPreparedV1(revision: Revision): PreparedSelectionCoverageV1 {
  return Object.freeze({
    schema: 'illustro.prepared-selection-coverage/1' as const,
    defaultCoverage: 0 as const,
    tiles: Object.freeze([]),
    sourceRevision: revision,
  });
}

function preparedMatchesCoverageV1(
  coverage: RasterSelectionCoverageV1 | null,
  prepared: PreparedSelectionCoverageV1,
): boolean {
  if (
    coverage === null ||
    coverage.inverted ||
    coverage.transformStack.length > 0 ||
    coverage.effectStack.length > 0 ||
    coverage.defaultCoverage !== prepared.defaultCoverage ||
    coverage.sourceRevision !== prepared.sourceRevision ||
    coverage.tiles.length !== prepared.tiles.length
  ) {
    return false;
  }
  const existing = indexTilesV1(coverage.tiles);
  for (const tile of prepared.tiles) {
    const current = existing.get(tileKey(tile.x, tile.y));
    if (!current || current.payloadRef !== tile.payloadRef) return false;
  }
  return true;
}

export async function prepareCombinedSelectionCoverageV1(
  existing: RasterSelectionCoverageV1 | null,
  incoming: PreparedSelectionCoverageV1,
  mode: SelectionCombineModeV1,
  input: {
    readonly documentWidth: number;
    readonly documentHeight: number;
    readonly revision: Revision;
    readonly storage: SelectionCoverageStoragePortV1;
    readonly signal?: AbortSignal;
  },
): Promise<PreparedSelectionCoverageV1> {
  throwIfAbortedV1(input.signal);
  validateDimensions(input.documentWidth, input.documentHeight);
  if (mode === 'replace') {
    return Object.freeze({
      ...incoming,
      tiles: Object.freeze([...incoming.tiles]),
      sourceRevision: input.revision,
    });
  }
  if (existing === null) {
    return mode === 'add'
      ? Object.freeze({
          ...incoming,
          tiles: Object.freeze([...incoming.tiles]),
          sourceRevision: input.revision,
        })
      : emptyPreparedV1(input.revision);
  }
  assertCombinableExistingV1(existing);
  const existingDefault = effectiveDefaultV1(existing);
  const incomingDefault = incoming.defaultCoverage;
  const combinedDefaultValue = combineValueV1(mode, existingDefault * 255, incomingDefault * 255);
  const outputDefault: 0 | 1 = combinedDefaultValue >= 128 ? 1 : 0;
  const existingTiles = indexTilesV1(existing.tiles);
  const incomingTiles = indexTilesV1(incoming.tiles);
  const coordinates = new Map<string, readonly [number, number]>();
  for (const tile of existing.tiles) coordinates.set(tileKey(tile.x, tile.y), [tile.x, tile.y]);
  for (const tile of incoming.tiles) coordinates.set(tileKey(tile.x, tile.y), [tile.x, tile.y]);
  const ordered = [...coordinates.values()].sort(
    (left, right) => left[1] - right[1] || left[0] - right[0],
  );
  const outputTiles: RasterTileReferenceV1[] = [];
  const mayReuseExisting =
    existing.inverted === false && existing.defaultCoverage === outputDefault;

  for (const [tx, ty] of ordered) {
    throwIfAbortedV1(input.signal);
    const key = tileKey(tx, ty);
    const bounds = tileBoundsForDocumentV1(input.documentWidth, input.documentHeight, { tx, ty });
    const leftReference = existingTiles.get(key);
    const left = await readCoverageBytesV1(
      leftReference,
      existing.defaultCoverage,
      existing.inverted,
      bounds.validWidth,
      bounds.validHeight,
      input.storage,
      input.signal,
    );
    const right = await readCoverageBytesV1(
      incomingTiles.get(key),
      incoming.defaultCoverage,
      false,
      bounds.validWidth,
      bounds.validHeight,
      input.storage,
      input.signal,
    );
    const combined = new Uint8Array(left.length);
    for (let pixel = 0; pixel < combined.length; pixel += 1) {
      combined[pixel] = combineValueV1(mode, left[pixel] ?? 0, right[pixel] ?? 0);
    }
    if (!differsFromDefaultV1(combined, outputDefault)) continue;

    if (mayReuseExisting && leftReference && equalCoverageValuesV1(left, combined)) {
      outputTiles.push(leftReference);
      continue;
    }

    throwIfAbortedV1(input.signal);
    const persisted = await input.storage.persistRasterTile({
      width: bounds.validWidth,
      height: bounds.validHeight,
      pixelFormat: 'rgba8-unorm',
      bytes: encodeCoverageBytesV1(combined),
    });
    throwIfAbortedV1(input.signal);
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
    defaultCoverage: outputDefault,
    tiles: Object.freeze(outputTiles),
    sourceRevision: input.revision,
  });
}

export async function applyPreparedSelectionModeV1(
  controller: SelectionCoverageControllerV1,
  incoming: PreparedSelectionCoverageV1,
  mode: SelectionCombineModeV1,
  input: {
    readonly documentWidth: number;
    readonly documentHeight: number;
    readonly revision: Revision;
    readonly storage: SelectionCoverageStoragePortV1;
    readonly signal?: AbortSignal;
  },
): Promise<SelectionCoverageSnapshotV1> {
  const before = controller.snapshot();
  const prepared = await prepareCombinedSelectionCoverageV1(before.coverage, incoming, mode, input);
  throwIfAbortedV1(input.signal);
  if (preparedMatchesCoverageV1(before.coverage, prepared)) return before;
  return controller.replacePrepared(prepared);
}
