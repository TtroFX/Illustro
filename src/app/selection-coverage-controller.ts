import type { LayerId, Revision } from '../domain/identity.js';
import {
  createRasterMask,
  type EffectNodeV1,
  type LayerBaseV1,
  type RasterMaskAttachmentV1,
  type RasterTileReferenceV1,
  type TransformNodeV1,
} from '../domain/layers.js';
import type { PaintProjectSnapshotV1 } from './paint-session-controller.js';

export interface RasterSelectionCoverageV1 {
  readonly schema: 'illustro.raster-selection-coverage/1';
  readonly defaultCoverage: 0 | 1;
  readonly tiles: readonly RasterTileReferenceV1[];
  readonly inverted: boolean;
  readonly transformStack: readonly TransformNodeV1[];
  readonly effectStack: readonly EffectNodeV1[];
  readonly sourceRevision: Revision;
}

export interface SelectionCoverageSnapshotV1 {
  readonly schema: 'illustro.selection-coverage-controller/1';
  readonly coverage: RasterSelectionCoverageV1 | null;
}

function freezeCoverage(input: RasterSelectionCoverageV1): RasterSelectionCoverageV1 {
  return Object.freeze({
    ...input,
    tiles: Object.freeze([...input.tiles]),
    transformStack: Object.freeze([...input.transformStack]),
    effectStack: Object.freeze([...input.effectStack]),
  });
}

export function rasterSelectionCoverageFromMaskV1(
  mask: RasterMaskAttachmentV1,
): RasterSelectionCoverageV1 {
  return freezeCoverage({
    schema: 'illustro.raster-selection-coverage/1',
    defaultCoverage: mask.defaultCoverage,
    tiles: mask.tiles,
    inverted: mask.inverted,
    transformStack: mask.transformStack,
    effectStack: mask.effectStack ?? Object.freeze([]),
    sourceRevision: mask.revision,
  });
}

export function attachRasterMaskFromSelectionSnapshotV1(
  snapshot: PaintProjectSnapshotV1,
  targetLayerId: LayerId,
  coverage: RasterSelectionCoverageV1,
  revision: Revision,
  now: Date = new Date(),
): PaintProjectSnapshotV1 {
  const target = snapshot.document.layerTree.layers[targetLayerId];
  if (target === undefined)
    throw new Error(`selection mask target layer is missing: ${targetLayerId}`);
  if (target.type === 'lineartBoundary') {
    throw new Error('Lineart Boundary layers cannot receive artwork masks');
  }
  if (target.locks.all) throw new Error('selection to mask is blocked by the layer lock');
  const base = createRasterMask({
    defaultCoverage: coverage.defaultCoverage,
    tiles: coverage.tiles,
    inverted: coverage.inverted,
    effectStack: coverage.effectStack,
  });
  const mask: RasterMaskAttachmentV1 = Object.freeze({
    ...base,
    revision,
    linkedToLayer: true,
    transformStack: Object.freeze([...coverage.transformStack]),
    effectStack: Object.freeze([...coverage.effectStack]),
    metadata: Object.freeze({
      ...base.metadata,
      'illustro.selection-conversion/1': Object.freeze({ sourceRevision: coverage.sourceRevision }),
    }),
  });
  const nextLayer = Object.freeze({
    ...target,
    revision,
    masks: Object.freeze([...target.masks, mask]),
  }) as LayerBaseV1;
  return Object.freeze({
    ...snapshot,
    document: Object.freeze({
      ...snapshot.document,
      revision,
      modifiedAt: now.toISOString(),
      layerTree: Object.freeze({
        rootLayerIds: snapshot.document.layerTree.rootLayerIds,
        layers: Object.freeze({
          ...snapshot.document.layerTree.layers,
          [targetLayerId]: nextLayer,
        }),
      }),
    }),
    committedStrokes: snapshot.committedStrokes,
  });
}

export class SelectionCoverageControllerV1 {
  #coverage: RasterSelectionCoverageV1 | null = null;

  snapshot(): SelectionCoverageSnapshotV1 {
    return Object.freeze({
      schema: 'illustro.selection-coverage-controller/1' as const,
      coverage: this.#coverage,
    });
  }

  replaceFromRasterMask(mask: RasterMaskAttachmentV1): SelectionCoverageSnapshotV1 {
    this.#coverage = rasterSelectionCoverageFromMaskV1(mask);
    return this.snapshot();
  }

  replace(coverage: RasterSelectionCoverageV1): SelectionCoverageSnapshotV1 {
    this.#coverage = freezeCoverage(coverage);
    return this.snapshot();
  }

  clear(): SelectionCoverageSnapshotV1 {
    this.#coverage = null;
    return this.snapshot();
  }
}
