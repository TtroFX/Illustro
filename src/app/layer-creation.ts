import { createDocumentV1, type DocumentV1 } from '../domain/document.js';
import type { LayerId, Revision } from '../domain/identity.js';
import {
  createAdjustmentLayer,
  createEffectNode,
  createFillLayer,
  createFolderLayer,
  createGradientLayer,
  createRasterLayer,
  createRasterMask,
  createVectorLayer,
  type AdjustmentLayerV1,
  type FillLayerV1,
  type FolderLayerV1,
  type GradientLayerV1,
  type LayerBaseV1,
  type MaskAttachmentV1,
  type RasterLayerV1,
  type VectorLayerV1,
} from '../domain/layers.js';
import { createLinkedObjectLayer, type LinkedObjectLayerV1 } from '../domain/special-layers.js';
import type { PaintProjectSnapshotV1 } from './paint-session-controller.js';

export const CREATABLE_LAYER_KINDS_V1 = [
  'raster',
  'folder',
  'vector',
  'adjustment',
  'fill',
  'gradient',
  'linked-object',
] as const;

export type CreatableLayerKindV1 = (typeof CREATABLE_LAYER_KINDS_V1)[number];
export type CreatableLayerV1 =
  | RasterLayerV1
  | FolderLayerV1
  | VectorLayerV1
  | AdjustmentLayerV1
  | FillLayerV1
  | GradientLayerV1
  | LinkedObjectLayerV1;

const DEFAULT_NAMES: Readonly<Record<CreatableLayerKindV1, string>> = Object.freeze({
  raster: 'Raster Layer',
  folder: 'Folder',
  vector: 'Vector Layer',
  adjustment: 'Adjustment Layer',
  fill: 'Fill Layer',
  gradient: 'Gradient Layer',
  'linked-object': 'Linked Object',
});

function color(document: DocumentV1, rgba: readonly [number, number, number, number]) {
  return Object.freeze({ space: document.color.workingSpace, rgba: Object.freeze(rgba) });
}

function blankLinkedDocument(document: DocumentV1): DocumentV1 {
  return createDocumentV1({
    width: document.canvas.width,
    height: document.canvas.height,
    ppi: document.canvas.resolution.ppi,
    background: { kind: 'transparent' },
    workingSpace: document.color.workingSpace,
    precision: document.color.precision,
  });
}

export function defaultLayerNameV1(kind: CreatableLayerKindV1): string {
  return DEFAULT_NAMES[kind];
}

export function createDefaultLayerV1(
  kind: CreatableLayerKindV1,
  document: DocumentV1,
  name = defaultLayerNameV1(kind),
): CreatableLayerV1 {
  switch (kind) {
    case 'raster':
      return createRasterLayer({ name });
    case 'folder':
      return createFolderLayer({ name });
    case 'vector':
      return createVectorLayer({ name });
    case 'adjustment':
      return createAdjustmentLayer({
        name,
        adjustment: createEffectNode('core.identity'),
      });
    case 'fill':
      return createFillLayer({
        name,
        fill: { kind: 'solid', color: color(document, [0, 0, 0, 1]) },
      });
    case 'gradient':
      return createGradientLayer({
        name,
        gradient: {
          kind: 'linear',
          stops: Object.freeze([
            Object.freeze({ position: 0, color: color(document, [0, 0, 0, 1]) }),
            Object.freeze({ position: 1, color: color(document, [1, 1, 1, 1]) }),
          ]),
          geometry: Object.freeze({
            start: Object.freeze({ x: 0, y: 0 }),
            end: Object.freeze({ x: document.canvas.width, y: 0 }),
          }),
        },
      });
    case 'linked-object':
      return createLinkedObjectLayer({
        name,
        embeddedSnapshot: blankLinkedDocument(document),
      });
  }
}

function documentWithLayerTree(
  snapshot: PaintProjectSnapshotV1,
  revision: Revision,
  rootLayerIds: readonly LayerId[],
  layers: Readonly<Record<string, LayerBaseV1>>,
  now: Date,
): PaintProjectSnapshotV1 {
  return Object.freeze({
    ...snapshot,
    document: Object.freeze({
      ...snapshot.document,
      revision,
      modifiedAt: now.toISOString(),
      layerTree: Object.freeze({
        rootLayerIds: Object.freeze([...rootLayerIds]),
        layers: Object.freeze({ ...layers }),
      }),
    }),
  });
}

export function insertRootLayerSnapshotV1(
  snapshot: PaintProjectSnapshotV1,
  layer: CreatableLayerV1,
  revision: Revision,
  now: Date = new Date(),
): PaintProjectSnapshotV1 {
  if (layer.parentId !== null) throw new Error('root layer creation requires parentId=null');
  if (layer.id in snapshot.document.layerTree.layers) {
    throw new Error(`layer already exists: ${layer.id}`);
  }
  return documentWithLayerTree(
    snapshot,
    revision,
    [...snapshot.document.layerTree.rootLayerIds, layer.id],
    { ...snapshot.document.layerTree.layers, [layer.id]: layer },
    now,
  );
}

export function attachRasterMaskSnapshotV1(
  snapshot: PaintProjectSnapshotV1,
  targetLayerId: LayerId,
  revision: Revision,
  now: Date = new Date(),
): PaintProjectSnapshotV1 {
  const target = snapshot.document.layerTree.layers[targetLayerId];
  if (target === undefined) throw new Error(`mask target layer is missing: ${targetLayerId}`);
  if (target.type === 'lineartBoundary') {
    throw new Error('Lineart Boundary layers cannot receive artwork masks');
  }
  const mask = createRasterMask({ defaultCoverage: 1 });
  const nextLayer = Object.freeze({
    ...target,
    revision,
    masks: Object.freeze([...target.masks, mask]),
  }) as LayerBaseV1;
  return documentWithLayerTree(
    snapshot,
    revision,
    snapshot.document.layerTree.rootLayerIds,
    { ...snapshot.document.layerTree.layers, [targetLayerId]: nextLayer },
    now,
  );
}

export function layerMasksV1(layer: LayerBaseV1): readonly MaskAttachmentV1[] {
  return layer.masks;
}
