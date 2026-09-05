import { createLayerId, parseRevision, type LayerId, type Revision } from '../domain/identity.js';
import {
  createRasterLayer,
  type RasterLayerV1,
  type RasterTileReferenceV1,
} from '../domain/layers.js';
import { tileBoundsForDocumentV1 } from '../gpu/sparse-tile-model.js';
import type {
  RasterMergePersistencePortV1,
  PreparedRasterMergeTileV1,
} from './layer-raster-merge.js';
import type { PaintProjectSnapshotV1 } from './paint-session-controller.js';
import type { SelectionTransferPayloadV1 } from './selection-cut-engine.js';

export interface SelectionPasteEligibilityV1 {
  readonly eligible: boolean;
  readonly reason: string | null;
}

export interface PreparedSelectionPasteV1 {
  readonly schema: 'illustro.prepared-selection-paste/1';
  readonly documentRevision: Revision;
  readonly outputLayerId: LayerId;
  readonly outputLayerName: string;
  readonly anchorLayerId: LayerId | null;
  readonly transfer: SelectionTransferPayloadV1;
  readonly tiles: readonly PreparedRasterMergeTileV1[];
}

export interface PrepareSelectionPasteOptionsV1 {
  readonly anchorLayerId?: LayerId | null;
  readonly outputLayerName?: string;
}

function unavailable(reason: string): SelectionPasteEligibilityV1 {
  return Object.freeze({ eligible: false, reason });
}

function transferTileKeyV1(tile: PreparedRasterMergeTileV1): string {
  return `${tile.x}:${tile.y}`;
}

function defaultPasteLayerNameV1(snapshot: PaintProjectSnapshotV1): string {
  const names = new Set(
    Object.values(snapshot.document.layerTree.layers).map((layer) => layer.name),
  );
  const base = 'Pasted Selection';
  if (!names.has(base)) return base;
  let suffix = 2;
  while (names.has(`${base} ${suffix}`)) suffix += 1;
  return `${base} ${suffix}`;
}

function resolveAnchorLayerIdV1(
  snapshot: PaintProjectSnapshotV1,
  transfer: SelectionTransferPayloadV1,
  requested: LayerId | null | undefined,
): LayerId | null {
  if (requested === null) return null;
  if (requested !== undefined) return requested;
  const source = snapshot.document.layerTree.layers[transfer.sourceLayerId];
  return source?.parentId === null && snapshot.document.layerTree.rootLayerIds.includes(source.id)
    ? source.id
    : null;
}

function validateAnchorV1(snapshot: PaintProjectSnapshotV1, anchorLayerId: LayerId | null): void {
  if (anchorLayerId === null) return;
  const anchor = snapshot.document.layerTree.layers[anchorLayerId];
  if (
    anchor === undefined ||
    anchor.parentId !== null ||
    !snapshot.document.layerTree.rootLayerIds.includes(anchorLayerId)
  ) {
    throw new Error('selection paste anchor must be an existing root layer');
  }
}

export function selectionPasteEligibilityV1(
  snapshot: PaintProjectSnapshotV1,
  transfer: SelectionTransferPayloadV1 | null,
): SelectionPasteEligibilityV1 {
  if (transfer === null) return unavailable('selection paste requires transfer content');
  if (transfer.schema !== 'illustro.selection-transfer/1') {
    return unavailable('selection paste transfer schema is unsupported');
  }
  if (
    transfer.width !== snapshot.document.canvas.width ||
    transfer.height !== snapshot.document.canvas.height
  ) {
    return unavailable('selection paste transfer canvas dimensions do not match the document');
  }
  if (transfer.pixelFormat !== snapshot.document.color.precision) {
    return unavailable('selection paste transfer precision does not match the document');
  }
  if (transfer.tiles.length === 0)
    return unavailable('selection paste transfer contains no raster tiles');

  const keys = new Set<string>();
  try {
    for (const tile of transfer.tiles) {
      if (tile.payloadRef.length === 0)
        return unavailable('selection paste tile payload is missing');
      tileBoundsForDocumentV1(transfer.width, transfer.height, { tx: tile.x, ty: tile.y });
      const key = transferTileKeyV1(tile);
      if (keys.has(key)) return unavailable(`selection paste contains duplicate tile ${key}`);
      keys.add(key);
    }
  } catch (error) {
    return unavailable(
      error instanceof Error ? error.message : 'selection paste tile grid is invalid',
    );
  }

  return Object.freeze({ eligible: true, reason: null });
}

export async function prepareSelectionPasteV1(
  snapshot: PaintProjectSnapshotV1,
  transfer: SelectionTransferPayloadV1,
  persistence: RasterMergePersistencePortV1,
  options: PrepareSelectionPasteOptionsV1 = {},
): Promise<PreparedSelectionPasteV1> {
  const eligibility = selectionPasteEligibilityV1(snapshot, transfer);
  if (!eligibility.eligible)
    throw new Error(eligibility.reason ?? 'selection paste is unavailable');

  const anchorLayerId = resolveAnchorLayerIdV1(snapshot, transfer, options.anchorLayerId);
  validateAnchorV1(snapshot, anchorLayerId);
  const outputLayerName = options.outputLayerName ?? defaultPasteLayerNameV1(snapshot);
  if (outputLayerName.trim().length === 0) {
    throw new TypeError('selection paste output layer name must not be empty');
  }

  const validatedTiles: PreparedRasterMergeTileV1[] = [];
  for (const tile of [...transfer.tiles].sort(
    (left, right) => left.y - right.y || left.x - right.x,
  )) {
    const bounds = tileBoundsForDocumentV1(transfer.width, transfer.height, {
      tx: tile.x,
      ty: tile.y,
    });
    const decoded = await persistence.readRasterTile(tile.payloadRef);
    if (
      decoded.pixelFormat !== transfer.pixelFormat ||
      decoded.width !== bounds.validWidth ||
      decoded.height !== bounds.validHeight
    ) {
      throw new Error('selection paste tile does not match the transfer raster contract');
    }
    const bytesPerPixel = transfer.pixelFormat === 'rgba8-unorm' ? 4 : 8;
    if (decoded.bytes.byteLength !== bounds.validWidth * bounds.validHeight * bytesPerPixel) {
      throw new Error('selection paste tile byte length is invalid');
    }
    validatedTiles.push(Object.freeze({ x: tile.x, y: tile.y, payloadRef: tile.payloadRef }));
  }

  let outputLayerId = createLayerId();
  while (outputLayerId in snapshot.document.layerTree.layers) outputLayerId = createLayerId();

  return Object.freeze({
    schema: 'illustro.prepared-selection-paste/1' as const,
    documentRevision: snapshot.document.revision,
    outputLayerId,
    outputLayerName,
    anchorLayerId,
    transfer,
    tiles: Object.freeze(validatedTiles),
  });
}

function rasterTileReferencesV1(
  prepared: PreparedSelectionPasteV1,
  revision: Revision,
): readonly RasterTileReferenceV1[] {
  return Object.freeze(
    prepared.tiles.map((tile) =>
      Object.freeze({
        x: tile.x,
        y: tile.y,
        revision,
        payloadRef: tile.payloadRef,
      }),
    ),
  );
}

export function applyPreparedSelectionPasteV1(
  snapshot: PaintProjectSnapshotV1,
  prepared: PreparedSelectionPasteV1,
  revisionValue: Revision | number,
  now: Date = new Date(),
): PaintProjectSnapshotV1 {
  const revision = parseRevision(revisionValue);
  if (snapshot.document.revision !== prepared.documentRevision) {
    throw new Error('selection paste target changed before commit');
  }
  if (prepared.outputLayerId in snapshot.document.layerTree.layers) {
    throw new Error('selection paste output layer already exists');
  }
  const eligibility = selectionPasteEligibilityV1(snapshot, prepared.transfer);
  if (!eligibility.eligible)
    throw new Error(eligibility.reason ?? 'selection paste is unavailable');
  validateAnchorV1(snapshot, prepared.anchorLayerId);

  const baseLayer = createRasterLayer({
    id: prepared.outputLayerId,
    name: prepared.outputLayerName,
  });
  const outputLayer = Object.freeze({
    ...baseLayer,
    revision,
    tiles: rasterTileReferencesV1(prepared, revision),
  }) as RasterLayerV1;

  const rootLayerIds = [...snapshot.document.layerTree.rootLayerIds];
  if (prepared.anchorLayerId === null) {
    rootLayerIds.push(outputLayer.id);
  } else {
    const anchorIndex = rootLayerIds.indexOf(prepared.anchorLayerId);
    if (anchorIndex < 0) throw new Error('selection paste anchor order is missing');
    rootLayerIds.splice(anchorIndex + 1, 0, outputLayer.id);
  }

  return Object.freeze({
    ...snapshot,
    document: Object.freeze({
      ...snapshot.document,
      revision,
      modifiedAt: now.toISOString(),
      layerTree: Object.freeze({
        rootLayerIds: Object.freeze(rootLayerIds),
        layers: Object.freeze({
          ...snapshot.document.layerTree.layers,
          [outputLayer.id]: outputLayer,
        }),
      }),
    }),
  });
}
