import { parseRevision, type LayerId, type Revision } from '../domain/identity.js';
import type { RasterLayerV1, RasterTileReferenceV1 } from '../domain/layers.js';
import type {
  PreparedRasterMergeTileV1,
  RasterMergePersistencePortV1,
} from './layer-raster-merge.js';
import type { PaintProjectSnapshotV1 } from './paint-session-controller.js';
import type { RasterSelectionCoverageV1 } from './selection-coverage-controller.js';
import {
  prepareSelectionCutV1,
  selectionCutEligibilityV1,
} from './selection-cut-engine.js';
import {
  prepareSelectionScopedFilterV1,
  selectionScopedFilterEligibilityV1,
} from './selection-filter-engine.js';

export const SELECTION_SCOPED_LAYER_OPERATION_IDS_V1 = ['clear', 'invert-color'] as const;
export type SelectionScopedLayerOperationIdV1 =
  (typeof SELECTION_SCOPED_LAYER_OPERATION_IDS_V1)[number];

export interface SelectionScopedLayerOperationEligibilityV1 {
  readonly eligible: boolean;
  readonly layerId: LayerId;
  readonly operationId: SelectionScopedLayerOperationIdV1;
  readonly reason: string | null;
}

export interface PreparedSelectionScopedLayerOperationV1 {
  readonly schema: 'illustro.prepared-selection-scoped-layer-operation/1';
  readonly layerId: LayerId;
  readonly operationId: SelectionScopedLayerOperationIdV1;
  readonly sourceRevision: Revision;
  readonly documentRevision: Revision;
  readonly selectionSourceRevision: Revision;
  readonly tiles: readonly PreparedRasterMergeTileV1[];
}

function assertSupportedOperationV1(
  operationId: SelectionScopedLayerOperationIdV1,
): SelectionScopedLayerOperationIdV1 {
  if (!SELECTION_SCOPED_LAYER_OPERATION_IDS_V1.includes(operationId)) {
    throw new RangeError(`unsupported selection-scoped layer operation: ${String(operationId)}`);
  }
  return operationId;
}

export function selectionScopedLayerOperationEligibilityV1(
  snapshot: PaintProjectSnapshotV1,
  layerId: LayerId,
  coverage: RasterSelectionCoverageV1 | null,
  operationId: SelectionScopedLayerOperationIdV1,
): SelectionScopedLayerOperationEligibilityV1 {
  assertSupportedOperationV1(operationId);
  const eligibility =
    operationId === 'clear'
      ? selectionCutEligibilityV1(snapshot, layerId, coverage)
      : selectionScopedFilterEligibilityV1(snapshot, layerId, coverage);
  return Object.freeze({
    eligible: eligibility.eligible,
    layerId,
    operationId,
    reason: eligibility.reason,
  });
}

export async function prepareSelectionScopedLayerOperationV1(
  snapshot: PaintProjectSnapshotV1,
  layerId: LayerId,
  coverage: RasterSelectionCoverageV1 | null,
  operationId: SelectionScopedLayerOperationIdV1,
  persistence: RasterMergePersistencePortV1,
): Promise<PreparedSelectionScopedLayerOperationV1> {
  assertSupportedOperationV1(operationId);
  const eligibility = selectionScopedLayerOperationEligibilityV1(
    snapshot,
    layerId,
    coverage,
    operationId,
  );
  if (!eligibility.eligible) {
    throw new Error(eligibility.reason ?? 'selection-scoped layer operation is unavailable');
  }
  if (coverage === null) {
    throw new Error('selection-scoped layer operation selection disappeared');
  }

  if (operationId === 'clear') {
    const prepared = await prepareSelectionCutV1(snapshot, layerId, coverage, persistence);
    return Object.freeze({
      schema: 'illustro.prepared-selection-scoped-layer-operation/1' as const,
      layerId,
      operationId,
      sourceRevision: prepared.sourceRevision,
      documentRevision: prepared.documentRevision,
      selectionSourceRevision: prepared.selectionSourceRevision,
      tiles: prepared.remainingTiles,
    });
  }

  const prepared = await prepareSelectionScopedFilterV1(
    snapshot,
    layerId,
    coverage,
    'invert-rgb',
    persistence,
  );
  return Object.freeze({
    schema: 'illustro.prepared-selection-scoped-layer-operation/1' as const,
    layerId,
    operationId,
    sourceRevision: prepared.sourceRevision,
    documentRevision: prepared.documentRevision,
    selectionSourceRevision: prepared.selectionSourceRevision,
    tiles: prepared.tiles,
  });
}

export function applyPreparedSelectionScopedLayerOperationV1(
  snapshot: PaintProjectSnapshotV1,
  prepared: PreparedSelectionScopedLayerOperationV1,
  revisionValue: Revision | number,
  now: Date = new Date(),
): PaintProjectSnapshotV1 {
  assertSupportedOperationV1(prepared.operationId);
  const revision = parseRevision(revisionValue);
  if (snapshot.document.revision !== prepared.documentRevision) {
    throw new Error('selection-scoped layer operation document changed before commit');
  }
  const source = snapshot.document.layerTree.layers[prepared.layerId];
  if (source?.type !== 'raster' || source.revision !== prepared.sourceRevision) {
    throw new Error('selection-scoped layer operation source changed before commit');
  }
  if (source.locks.all || source.locks.pixels) {
    throw new Error('selection-scoped layer operation became blocked by the layer pixel lock');
  }
  if (prepared.operationId === 'clear' && source.locks.alpha) {
    throw new Error('selection-scoped layer clear became blocked by the layer alpha lock');
  }
  if (source.transformStack.length > 0 || source.effectStack.length > 0) {
    throw new Error(
      'selection-scoped layer operation source gained an unbaked transform/effect before commit',
    );
  }

  const operatedLayer = Object.freeze({
    ...source,
    revision,
    boundsHint: null,
    tiles: Object.freeze(
      prepared.tiles.map(
        (tile): RasterTileReferenceV1 =>
          Object.freeze({
            x: tile.x,
            y: tile.y,
            revision,
            payloadRef: tile.payloadRef,
          }),
      ),
    ),
  }) as RasterLayerV1;
  const committedStrokes = snapshot.committedStrokes.map((entry) =>
    entry.stroke.layerId === prepared.layerId
      ? Object.freeze({ ...entry, bakedToRasterLayer: true })
      : entry,
  );

  return Object.freeze({
    schema: 'illustro.paint-project-snapshot/1' as const,
    document: Object.freeze({
      ...snapshot.document,
      revision,
      modifiedAt: now.toISOString(),
      layerTree: Object.freeze({
        rootLayerIds: snapshot.document.layerTree.rootLayerIds,
        layers: Object.freeze({
          ...snapshot.document.layerTree.layers,
          [prepared.layerId]: operatedLayer,
        }),
      }),
    }),
    committedStrokes: Object.freeze(committedStrokes),
  });
}
