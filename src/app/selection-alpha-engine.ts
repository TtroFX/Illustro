import type { LayerId, Revision } from '../domain/identity.js';
import { createRasterLayer, type FillLayerV1, type RasterLayerV1 } from '../domain/layers.js';
import { tileBoundsForDocumentV1, tileGridForDocumentV1 } from '../gpu/sparse-tile-model.js';
import {
  prepareRasterMergeVisibleCopyV1,
  type PreparedRasterMergeTileV1,
  type RasterMergePersistencePortV1,
} from './layer-raster-merge.js';
import type { PaintDecodedRasterTileV1 } from './paint-persistence-controller.js';
import type { PaintProjectSnapshotV1 } from './paint-session-controller.js';
import {
  applyPreparedSelectionModeV1,
  type SelectionCombineModeV1,
  type SelectionCoverageStoragePortV1,
} from './selection-combine-engine.js';
import {
  SelectionCoverageControllerV1,
  type SelectionCoverageSnapshotV1,
} from './selection-coverage-controller.js';
import type { PreparedSelectionCoverageV1 } from './selection-shape-engine.js';

export interface LayerAlphaSelectionEligibilityV1 {
  readonly eligible: boolean;
  readonly layerId: LayerId;
  readonly reason: string | null;
}

export interface LayerAlphaSelectionInputV1 {
  readonly revision: Revision;
  readonly persistence: RasterMergePersistencePortV1;
}

function unavailable(layerId: LayerId, reason: string): LayerAlphaSelectionEligibilityV1 {
  return Object.freeze({ eligible: false, layerId, reason });
}

export function layerAlphaSelectionEligibilityV1(
  snapshot: PaintProjectSnapshotV1,
  layerId: LayerId,
): LayerAlphaSelectionEligibilityV1 {
  const layer = snapshot.document.layerTree.layers[layerId];
  if (layer === undefined) return unavailable(layerId, 'alpha selection source layer is missing');
  if (layer.transformStack.length > 0) {
    return unavailable(
      layerId,
      'alpha selection from a transformed layer requires canonical transform baking',
    );
  }
  if (layer.effectStack.length > 0) {
    return unavailable(layerId, 'alpha selection from an effected layer requires effect rendering');
  }

  switch (layer.type) {
    case 'raster':
      return Object.freeze({ eligible: true, layerId, reason: null });
    case 'fill':
      return layer.fill.kind === 'solid'
        ? Object.freeze({ eligible: true, layerId, reason: null })
        : unavailable(layerId, 'pattern fill alpha selection requires the material renderer');
    case 'vector':
      return unavailable(layerId, 'vector alpha selection requires the canonical vector renderer');
    case 'gradient':
      return unavailable(layerId, 'gradient alpha selection requires the canonical gradient renderer');
    case 'adjustment':
      return unavailable(layerId, 'adjustment layers do not expose standalone intrinsic alpha');
    case 'folder':
      return unavailable(layerId, 'folder alpha selection requires the canonical layer compositor');
    case 'linkedObject':
      return unavailable(layerId, 'linked-object alpha selection requires canonical object rendering');
    case 'text':
      return unavailable(layerId, 'text alpha selection requires the canonical text renderer');
    case 'lineartBoundary':
      return unavailable(layerId, 'Lineart Boundary layers do not contain artwork alpha');
  }
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function halfToFloat(value: number): number {
  const sign = (value & 0x8000) !== 0 ? -1 : 1;
  const exponent = (value >>> 10) & 0x1f;
  const fraction = value & 0x03ff;
  if (exponent === 0) return sign * 2 ** -14 * (fraction / 1024);
  if (exponent === 0x1f) {
    return fraction === 0 ? sign * Number.POSITIVE_INFINITY : Number.NaN;
  }
  return sign * 2 ** (exponent - 15) * (1 + fraction / 1024);
}

function alphaCoverageByteV1(tile: PaintDecodedRasterTileV1, pixel: number): number {
  if (tile.pixelFormat === 'rgba8-unorm') {
    return tile.bytes[pixel * 4 + 3] ?? 0;
  }
  const view = new DataView(tile.bytes.buffer, tile.bytes.byteOffset, tile.bytes.byteLength);
  const alpha = halfToFloat(view.getUint16(pixel * 8 + 6, true));
  if (!Number.isFinite(alpha)) throw new Error('RGBA16F alpha selection source contains non-finite alpha');
  return Math.round(clamp01(alpha) * 255);
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

function uniformCoverageBytesV1(
  width: number,
  height: number,
  coverage: number,
): Uint8Array<ArrayBuffer> {
  const values = new Uint8Array(width * height);
  values.fill(coverage);
  return encodeCoverageBytesV1(values);
}

function validateSourceTileV1(
  tile: PaintDecodedRasterTileV1,
  expectedFormat: PaintProjectSnapshotV1['document']['color']['precision'],
  width: number,
  height: number,
): void {
  if (tile.pixelFormat !== expectedFormat || tile.width !== width || tile.height !== height) {
    throw new Error('alpha selection source tile does not match the document raster contract');
  }
  const bytesPerPixel = expectedFormat === 'rgba8-unorm' ? 4 : 8;
  if (tile.bytes.byteLength !== width * height * bytesPerPixel) {
    throw new Error('alpha selection source tile byte length is invalid');
  }
}

function hasCoverageV1(values: Uint8Array): boolean {
  return values.some((value) => value !== 0);
}

function tileKeyV1(x: number, y: number): string {
  return `${x}:${y}`;
}

async function materializeRasterAlphaSourceV1(
  snapshot: PaintProjectSnapshotV1,
  layer: RasterLayerV1,
  persistence: RasterMergePersistencePortV1,
): Promise<readonly PreparedRasterMergeTileV1[]> {
  const hasUnbakedStroke = snapshot.committedStrokes.some(
    (entry) => entry.stroke.layerId === layer.id && entry.bakedToRasterLayer !== true,
  );
  if (!hasUnbakedStroke) {
    return Object.freeze(
      layer.tiles.map((tile) =>
        Object.freeze({ x: tile.x, y: tile.y, payloadRef: tile.payloadRef }),
      ),
    );
  }

  const intrinsicLayer = createRasterLayer({ id: layer.id, name: layer.name, tiles: layer.tiles });
  const isolated: PaintProjectSnapshotV1 = Object.freeze({
    schema: 'illustro.paint-project-snapshot/1' as const,
    document: Object.freeze({
      ...snapshot.document,
      layerTree: Object.freeze({
        rootLayerIds: Object.freeze([layer.id]),
        layers: Object.freeze({ [layer.id]: intrinsicLayer }),
      }),
    }),
    committedStrokes: Object.freeze(
      snapshot.committedStrokes.filter((entry) => entry.stroke.layerId === layer.id),
    ),
  });
  const materialized = await prepareRasterMergeVisibleCopyV1(
    isolated,
    '__selection-alpha-source__',
    persistence,
  );
  return materialized.tiles;
}

async function prepareRasterLayerAlphaSelectionV1(
  snapshot: PaintProjectSnapshotV1,
  layer: RasterLayerV1,
  input: LayerAlphaSelectionInputV1,
): Promise<PreparedSelectionCoverageV1> {
  const sourceTiles = await materializeRasterAlphaSourceV1(snapshot, layer, input.persistence);
  const seen = new Set<string>();
  const outputTiles = [];
  const width = snapshot.document.canvas.width;
  const height = snapshot.document.canvas.height;
  const precision = snapshot.document.color.precision;

  for (const source of sourceTiles) {
    const key = tileKeyV1(source.x, source.y);
    if (seen.has(key)) throw new Error(`duplicate alpha selection source tile: ${key}`);
    seen.add(key);
    const bounds = tileBoundsForDocumentV1(width, height, { tx: source.x, ty: source.y });
    const decoded = await input.persistence.readRasterTile(source.payloadRef);
    validateSourceTileV1(decoded, precision, bounds.validWidth, bounds.validHeight);
    const coverage = new Uint8Array(bounds.validWidth * bounds.validHeight);
    for (let pixel = 0; pixel < coverage.length; pixel += 1) {
      coverage[pixel] = alphaCoverageByteV1(decoded, pixel);
    }
    if (!hasCoverageV1(coverage)) continue;
    const persisted = await input.persistence.persistRasterTile({
      width: bounds.validWidth,
      height: bounds.validHeight,
      pixelFormat: 'rgba8-unorm',
      bytes: encodeCoverageBytesV1(coverage),
    });
    outputTiles.push(
      Object.freeze({
        x: source.x,
        y: source.y,
        revision: input.revision,
        payloadRef: persisted.payloadRef,
      }),
    );
  }

  return Object.freeze({
    schema: 'illustro.prepared-selection-coverage/1' as const,
    defaultCoverage: 0 as const,
    tiles: Object.freeze(outputTiles),
    sourceRevision: input.revision,
  });
}

async function prepareSolidFillAlphaSelectionV1(
  snapshot: PaintProjectSnapshotV1,
  layer: FillLayerV1,
  input: LayerAlphaSelectionInputV1,
): Promise<PreparedSelectionCoverageV1> {
  if (layer.fill.kind !== 'solid') throw new Error('solid fill alpha selection source changed');
  const coverage = Math.round(clamp01(layer.fill.color.rgba[3]) * 255);
  if (coverage === 0 || coverage === 255) {
    return Object.freeze({
      schema: 'illustro.prepared-selection-coverage/1' as const,
      defaultCoverage: coverage === 255 ? (1 as const) : (0 as const),
      tiles: Object.freeze([]),
      sourceRevision: input.revision,
    });
  }

  const width = snapshot.document.canvas.width;
  const height = snapshot.document.canvas.height;
  const grid = tileGridForDocumentV1(width, height);
  const tiles = [];
  for (let ty = 0; ty < grid.rows; ty += 1) {
    for (let tx = 0; tx < grid.columns; tx += 1) {
      const bounds = tileBoundsForDocumentV1(width, height, { tx, ty });
      const persisted = await input.persistence.persistRasterTile({
        width: bounds.validWidth,
        height: bounds.validHeight,
        pixelFormat: 'rgba8-unorm',
        bytes: uniformCoverageBytesV1(bounds.validWidth, bounds.validHeight, coverage),
      });
      tiles.push(
        Object.freeze({
          x: tx,
          y: ty,
          revision: input.revision,
          payloadRef: persisted.payloadRef,
        }),
      );
    }
  }
  return Object.freeze({
    schema: 'illustro.prepared-selection-coverage/1' as const,
    defaultCoverage: 0 as const,
    tiles: Object.freeze(tiles),
    sourceRevision: input.revision,
  });
}

export async function prepareLayerAlphaSelectionV1(
  snapshot: PaintProjectSnapshotV1,
  layerId: LayerId,
  input: LayerAlphaSelectionInputV1,
): Promise<PreparedSelectionCoverageV1> {
  const eligibility = layerAlphaSelectionEligibilityV1(snapshot, layerId);
  if (!eligibility.eligible) {
    throw new Error(eligibility.reason ?? 'alpha selection conversion is unavailable');
  }
  const layer = snapshot.document.layerTree.layers[layerId];
  if (layer === undefined) throw new Error('alpha selection source disappeared');
  if (layer.type === 'raster') {
    return prepareRasterLayerAlphaSelectionV1(snapshot, layer, input);
  }
  if (layer.type === 'fill') {
    return prepareSolidFillAlphaSelectionV1(snapshot, layer, input);
  }
  throw new Error('alpha selection source type changed before preparation');
}

export async function applyLayerAlphaSelectionModeV1(
  controller: SelectionCoverageControllerV1,
  snapshot: PaintProjectSnapshotV1,
  layerId: LayerId,
  mode: SelectionCombineModeV1,
  input: LayerAlphaSelectionInputV1,
): Promise<SelectionCoverageSnapshotV1> {
  const prepared = await prepareLayerAlphaSelectionV1(snapshot, layerId, input);
  return applyPreparedSelectionModeV1(controller, prepared, mode, {
    documentWidth: snapshot.document.canvas.width,
    documentHeight: snapshot.document.canvas.height,
    revision: input.revision,
    storage: input.persistence as SelectionCoverageStoragePortV1,
  });
}
