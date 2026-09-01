import {
  createLayerId,
  createMaskId,
  createNodeId,
  createObjectId,
  type LayerId,
  type NodeId,
  type Revision,
} from '../domain/identity.js';
import type {
  AdjustmentLayerV1,
  EffectMaskAttachmentV1,
  EffectNodeV1,
  FillLayerV1,
  FolderLayerV1,
  GradientLayerV1,
  LayerBaseV1,
  MaskAttachmentV1,
  RasterLayerV1,
  TransformNodeV1,
  VectorLayerV1,
  VectorObjectV1,
} from '../domain/layers.js';
import type { LinkedObjectLayerV1 } from '../domain/special-layers.js';
import type { CompletedPaintStrokeV1, PaintProjectSnapshotV1 } from './paint-session-controller.js';

export interface DuplicateRootLayerResultV1 {
  readonly snapshot: PaintProjectSnapshotV1;
  readonly duplicatedRootLayerId: LayerId;
  readonly layerIdMap: ReadonlyMap<LayerId, LayerId>;
}

function cloneTransformNodeV1(node: TransformNodeV1, revision: Revision): TransformNodeV1 {
  return Object.freeze({
    ...node,
    id: createNodeId(),
    revision,
    parameters: Object.freeze({ ...node.parameters }),
  });
}

function cloneEffectNodeV1(node: EffectNodeV1, revision: Revision): EffectNodeV1 {
  return Object.freeze({
    ...node,
    id: createNodeId(),
    revision,
    parameters: Object.freeze({ ...node.parameters }),
  });
}

function cloneVectorObjectV1(object: VectorObjectV1, revision: Revision): VectorObjectV1 {
  return Object.freeze({
    ...object,
    id: createObjectId(),
    revision,
    geometry: Object.freeze({ ...object.geometry }),
    style: Object.freeze({ ...object.style }),
    transformStack: Object.freeze(
      object.transformStack.map((node) => cloneTransformNodeV1(node, revision)),
    ),
  });
}

function cloneMaskV1(
  mask: MaskAttachmentV1,
  revision: Revision,
  effectIdMap: ReadonlyMap<NodeId, NodeId>,
): MaskAttachmentV1 {
  const common = {
    ...mask,
    id: createMaskId(),
    revision,
    transformStack: Object.freeze(
      mask.transformStack.map((node) => cloneTransformNodeV1(node, revision)),
    ),
    metadata: Object.freeze({ ...mask.metadata }),
  };
  if (mask.kind === 'raster-mask') {
    return Object.freeze({ ...common, tiles: Object.freeze([...mask.tiles]) });
  }
  if (mask.kind === 'vector-mask') {
    return Object.freeze({
      ...common,
      paths: Object.freeze(mask.paths.map((path) => cloneVectorObjectV1(path, revision))),
    });
  }
  const effectMask = mask as EffectMaskAttachmentV1;
  const mappedEffectNodeId = effectIdMap.get(effectMask.effectNodeId) ?? effectMask.effectNodeId;
  const coverage =
    effectMask.coverage.kind === 'raster'
      ? Object.freeze({
          ...effectMask.coverage,
          tiles: Object.freeze([...effectMask.coverage.tiles]),
        })
      : Object.freeze({
          ...effectMask.coverage,
          paths: Object.freeze(
            effectMask.coverage.paths.map((path) => cloneVectorObjectV1(path, revision)),
          ),
        });
  return Object.freeze({
    ...common,
    effectNodeId: mappedEffectNodeId,
    coverage,
  });
}

function documentWithStateV1(
  snapshot: PaintProjectSnapshotV1,
  revision: Revision,
  rootLayerIds: readonly LayerId[],
  layers: Readonly<Record<string, LayerBaseV1>>,
  committedStrokes: readonly CompletedPaintStrokeV1[],
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
    committedStrokes: Object.freeze([...committedStrokes]),
  });
}

function requireLayerV1(snapshot: PaintProjectSnapshotV1, layerId: LayerId): LayerBaseV1 {
  const layer = snapshot.document.layerTree.layers[layerId];
  if (layer === undefined) throw new Error(`layer is missing: ${layerId}`);
  return layer;
}

function requireRootLayerV1(snapshot: PaintProjectSnapshotV1, layerId: LayerId): LayerBaseV1 {
  const layer = requireLayerV1(snapshot, layerId);
  if (layer.parentId !== null || !snapshot.document.layerTree.rootLayerIds.includes(layerId)) {
    throw new Error(`layer is not a root layer: ${layerId}`);
  }
  return layer;
}

function replaceLayerV1(
  snapshot: PaintProjectSnapshotV1,
  layerId: LayerId,
  revision: Revision,
  now: Date,
  mutate: (layer: LayerBaseV1) => LayerBaseV1,
): PaintProjectSnapshotV1 {
  const current = requireLayerV1(snapshot, layerId);
  const next = mutate(current);
  if (next.id !== current.id || next.type !== current.type) {
    throw new Error('layer property mutation cannot replace layer identity or type');
  }
  return documentWithStateV1(
    snapshot,
    revision,
    snapshot.document.layerTree.rootLayerIds,
    { ...snapshot.document.layerTree.layers, [layerId]: next },
    snapshot.committedStrokes,
    now,
  );
}

function collectSubtreeV1(
  snapshot: PaintProjectSnapshotV1,
  rootLayerId: LayerId,
): readonly LayerId[] {
  const result: LayerId[] = [];
  const visit = (layerId: LayerId): void => {
    const layer = requireLayerV1(snapshot, layerId);
    result.push(layerId);
    if (layer.type !== 'folder') return;
    const folder = layer as FolderLayerV1;
    for (const childId of folder.childLayerIds) visit(childId);
  };
  visit(rootLayerId);
  return Object.freeze(result);
}

function cloneLayerV1(
  source: LayerBaseV1,
  newLayerId: LayerId,
  parentId: LayerId | null,
  revision: Revision,
  layerIdMap: ReadonlyMap<LayerId, LayerId>,
  rootDuplicate: boolean,
): LayerBaseV1 {
  if (source.type === 'lineartBoundary') {
    throw new Error('Lineart Boundary duplication is owned by the Lineart system');
  }
  if (source.type === 'folder' && (source as FolderLayerV1).role === 'lineart-group') {
    throw new Error('Lineart Group duplication is owned by the Lineart system');
  }
  if (source.type === 'text') {
    throw new Error('text layer duplication requires the text-layer implementation');
  }

  const effectIdMap = new Map<NodeId, NodeId>();
  const effectStack = source.effectStack.map((node) => {
    const clone = cloneEffectNodeV1(node, revision);
    effectIdMap.set(node.id, clone.id);
    return clone;
  });
  const transformStack = source.transformStack.map((node) => cloneTransformNodeV1(node, revision));
  const masks = source.masks.map((mask) => cloneMaskV1(mask, revision, effectIdMap));
  const clipping =
    source.clipping === null
      ? null
      : Object.freeze({
          ...source.clipping,
          baseLayerId: layerIdMap.get(source.clipping.baseLayerId) ?? source.clipping.baseLayerId,
        });
  const base = {
    ...source,
    id: newLayerId,
    revision,
    parentId,
    name: rootDuplicate ? `${source.name} copy` : source.name,
    locks: Object.freeze({ ...source.locks }),
    clipping,
    roleFlags: Object.freeze({ ...source.roleFlags }),
    masks: Object.freeze(masks),
    transformStack: Object.freeze(transformStack),
    effectStack: Object.freeze(effectStack),
    boundsHint: null,
    metadata: Object.freeze({ ...source.metadata }),
  };

  switch (source.type) {
    case 'raster':
      return Object.freeze({
        ...base,
        tiles: Object.freeze([...(source as RasterLayerV1).tiles]),
      }) as RasterLayerV1;
    case 'folder': {
      const folder = source as FolderLayerV1;
      return Object.freeze({
        ...base,
        childLayerIds: Object.freeze(
          folder.childLayerIds.map((id) => {
            const mapped = layerIdMap.get(id);
            if (mapped === undefined) throw new Error(`duplicate child mapping is missing: ${id}`);
            return mapped;
          }),
        ),
      }) as FolderLayerV1;
    }
    case 'vector':
      return Object.freeze({
        ...base,
        objects: Object.freeze(
          (source as VectorLayerV1).objects.map((object) => cloneVectorObjectV1(object, revision)),
        ),
      }) as VectorLayerV1;
    case 'adjustment': {
      const adjustment = cloneEffectNodeV1((source as AdjustmentLayerV1).adjustment, revision);
      return Object.freeze({ ...base, adjustment }) as AdjustmentLayerV1;
    }
    case 'fill': {
      const fill = (source as FillLayerV1).fill;
      const clonedFill =
        fill.kind === 'pattern' && fill.transform !== null
          ? Object.freeze({
              ...fill,
              transform: cloneTransformNodeV1(fill.transform, revision),
            })
          : fill;
      return Object.freeze({ ...base, fill: clonedFill }) as FillLayerV1;
    }
    case 'gradient': {
      const gradient = (source as GradientLayerV1).gradient;
      const clonedGradient =
        gradient.kind === 'freeform'
          ? Object.freeze({
              ...gradient,
              points: Object.freeze([...gradient.points]),
            })
          : Object.freeze({
              ...gradient,
              stops: Object.freeze([...gradient.stops]),
              geometry: Object.freeze({ ...gradient.geometry }),
            });
      return Object.freeze({ ...base, gradient: clonedGradient }) as GradientLayerV1;
    }
    case 'linkedObject': {
      const linked = source as LinkedObjectLayerV1;
      return Object.freeze({
        ...base,
        objectId: createObjectId(),
        embeddedSnapshot: linked.embeddedSnapshot,
        externalSource:
          linked.externalSource === null ? null : Object.freeze({ ...linked.externalSource }),
      }) as LinkedObjectLayerV1;
    }
  }
  throw new Error(`unsupported layer duplicate type: ${source.type}`);
}

function cloneCommittedStrokeV1(
  entry: CompletedPaintStrokeV1,
  layerId: LayerId,
): CompletedPaintStrokeV1 {
  if (typeof globalThis.crypto?.randomUUID !== 'function') {
    throw new Error('secure UUID generation is unavailable for layer duplication');
  }
  return Object.freeze({
    stroke: Object.freeze({
      ...entry.stroke,
      strokeId: globalThis.crypto.randomUUID(),
      layerId,
      samples: Object.freeze([...entry.stroke.samples]),
    }),
    dabs: Object.freeze([...entry.dabs]),
  });
}

export function duplicateRootLayerSnapshotV1(
  snapshot: PaintProjectSnapshotV1,
  sourceLayerId: LayerId,
  revision: Revision,
  now: Date = new Date(),
): DuplicateRootLayerResultV1 {
  requireRootLayerV1(snapshot, sourceLayerId);
  const subtree = collectSubtreeV1(snapshot, sourceLayerId);
  const layerIdMap = new Map<LayerId, LayerId>();
  for (const layerId of subtree) layerIdMap.set(layerId, createLayerId());
  const layers = { ...snapshot.document.layerTree.layers };
  for (const layerId of subtree) {
    const source = requireLayerV1(snapshot, layerId);
    const newLayerId = layerIdMap.get(layerId);
    if (newLayerId === undefined) throw new Error(`duplicate mapping is missing: ${layerId}`);
    const mappedParent =
      source.parentId === null ? null : (layerIdMap.get(source.parentId) ?? source.parentId);
    layers[newLayerId] = cloneLayerV1(
      source,
      newLayerId,
      mappedParent,
      revision,
      layerIdMap,
      layerId === sourceLayerId,
    );
  }
  const duplicatedRootLayerId = layerIdMap.get(sourceLayerId);
  if (duplicatedRootLayerId === undefined) throw new Error('duplicated root mapping is missing');
  const roots = [...snapshot.document.layerTree.rootLayerIds];
  const sourceIndex = roots.indexOf(sourceLayerId);
  if (sourceIndex < 0) throw new Error('duplicate root layer order is missing');
  roots.splice(sourceIndex + 1, 0, duplicatedRootLayerId);

  const duplicatedStrokes: CompletedPaintStrokeV1[] = [];
  for (const entry of snapshot.committedStrokes) {
    const mappedLayerId = layerIdMap.get(entry.stroke.layerId);
    if (mappedLayerId !== undefined) {
      duplicatedStrokes.push(cloneCommittedStrokeV1(entry, mappedLayerId));
    }
  }
  const nextSnapshot = documentWithStateV1(
    snapshot,
    revision,
    roots,
    layers,
    [...snapshot.committedStrokes, ...duplicatedStrokes],
    now,
  );
  return Object.freeze({
    snapshot: nextSnapshot,
    duplicatedRootLayerId,
    layerIdMap,
  });
}

export function deleteRootLayerSnapshotV1(
  snapshot: PaintProjectSnapshotV1,
  layerId: LayerId,
  revision: Revision,
  now: Date = new Date(),
): PaintProjectSnapshotV1 {
  requireRootLayerV1(snapshot, layerId);
  const removed = new Set(collectSubtreeV1(snapshot, layerId));
  const layers: Record<string, LayerBaseV1> = {};
  for (const [id, layer] of Object.entries(snapshot.document.layerTree.layers)) {
    if (removed.has(layer.id)) continue;
    if (layer.clipping !== null && removed.has(layer.clipping.baseLayerId)) {
      layers[id] = Object.freeze({ ...layer, revision, clipping: null });
    } else {
      layers[id] = layer;
    }
  }
  return documentWithStateV1(
    snapshot,
    revision,
    snapshot.document.layerTree.rootLayerIds.filter((id) => id !== layerId),
    layers,
    snapshot.committedStrokes.filter((entry) => !removed.has(entry.stroke.layerId)),
    now,
  );
}

export function reorderRootLayerSnapshotV1(
  snapshot: PaintProjectSnapshotV1,
  layerId: LayerId,
  targetIndex: number,
  revision: Revision,
  now: Date = new Date(),
): PaintProjectSnapshotV1 {
  requireRootLayerV1(snapshot, layerId);
  const roots = [...snapshot.document.layerTree.rootLayerIds];
  if (!Number.isSafeInteger(targetIndex) || targetIndex < 0 || targetIndex >= roots.length) {
    throw new RangeError('root layer reorder targetIndex is outside the layer stack');
  }
  const currentIndex = roots.indexOf(layerId);
  if (currentIndex === targetIndex) throw new Error('root layer reorder has no changes');
  roots.splice(currentIndex, 1);
  roots.splice(targetIndex, 0, layerId);
  return documentWithStateV1(
    snapshot,
    revision,
    roots,
    snapshot.document.layerTree.layers,
    snapshot.committedStrokes,
    now,
  );
}

export function renameLayerSnapshotV1(
  snapshot: PaintProjectSnapshotV1,
  layerId: LayerId,
  name: string,
  revision: Revision,
  now: Date = new Date(),
): PaintProjectSnapshotV1 {
  const normalized = name.trim();
  if (normalized.length === 0 || normalized.length > 120) {
    throw new RangeError('layer name must contain 1..120 non-whitespace characters');
  }
  return replaceLayerV1(snapshot, layerId, revision, now, (layer) => {
    if (layer.name === normalized) throw new Error('layer rename has no changes');
    return Object.freeze({ ...layer, revision, name: normalized });
  });
}

export function setLayerVisibilitySnapshotV1(
  snapshot: PaintProjectSnapshotV1,
  layerId: LayerId,
  visible: boolean,
  revision: Revision,
  now: Date = new Date(),
): PaintProjectSnapshotV1 {
  return replaceLayerV1(snapshot, layerId, revision, now, (layer) => {
    if (layer.visible === visible) throw new Error('layer visibility has no changes');
    return Object.freeze({ ...layer, revision, visible });
  });
}

export function setLayerOpacitySnapshotV1(
  snapshot: PaintProjectSnapshotV1,
  layerId: LayerId,
  opacity: number,
  revision: Revision,
  now: Date = new Date(),
): PaintProjectSnapshotV1 {
  if (!Number.isFinite(opacity) || opacity < 0 || opacity > 1) {
    throw new RangeError('layer opacity must be finite in 0..1');
  }
  return replaceLayerV1(snapshot, layerId, revision, now, (layer) => {
    if (layer.opacity === opacity) throw new Error('layer opacity has no changes');
    return Object.freeze({ ...layer, revision, opacity });
  });
}

export function setLayerAllLockSnapshotV1(
  snapshot: PaintProjectSnapshotV1,
  layerId: LayerId,
  locked: boolean,
  revision: Revision,
  now: Date = new Date(),
): PaintProjectSnapshotV1 {
  return replaceLayerV1(snapshot, layerId, revision, now, (layer) => {
    if (layer.locks.all === locked) throw new Error('layer lock has no changes');
    return Object.freeze({
      ...layer,
      revision,
      locks: Object.freeze({ ...layer.locks, all: locked }),
    });
  });
}

export function setLayerAlphaLockSnapshotV1(
  snapshot: PaintProjectSnapshotV1,
  layerId: LayerId,
  locked: boolean,
  revision: Revision,
  now: Date = new Date(),
): PaintProjectSnapshotV1 {
  return replaceLayerV1(snapshot, layerId, revision, now, (layer) => {
    if (layer.locks.alpha === locked) throw new Error('layer alpha lock has no changes');
    return Object.freeze({
      ...layer,
      revision,
      locks: Object.freeze({ ...layer.locks, alpha: locked }),
    });
  });
}

export function setLayerClippingSnapshotV1(
  snapshot: PaintProjectSnapshotV1,
  layerId: LayerId,
  baseLayerId: LayerId | null,
  revision: Revision,
  now: Date = new Date(),
): PaintProjectSnapshotV1 {
  const layer = requireLayerV1(snapshot, layerId);
  if (layer.type === 'lineartBoundary') {
    throw new Error('Lineart Boundary layers cannot participate in artwork clipping');
  }
  if (baseLayerId !== null) {
    const base = requireLayerV1(snapshot, baseLayerId);
    if (baseLayerId === layerId) throw new Error('layer cannot clip to itself');
    if (base.parentId !== layer.parentId) {
      throw new Error('clipping base must share the same layer parent');
    }
  }
  return replaceLayerV1(snapshot, layerId, revision, now, (current) => {
    if (
      current.clipping?.baseLayerId === baseLayerId ||
      (current.clipping === null && baseLayerId === null)
    ) {
      throw new Error('layer clipping has no changes');
    }
    return Object.freeze({
      ...current,
      revision,
      clipping:
        baseLayerId === null ? null : Object.freeze({ mode: 'alpha' as const, baseLayerId }),
    });
  });
}

export function clearLayerSnapshotV1(
  snapshot: PaintProjectSnapshotV1,
  layerId: LayerId,
  revision: Revision,
  now: Date = new Date(),
): PaintProjectSnapshotV1 {
  const layer = requireLayerV1(snapshot, layerId);
  if (layer.locks.all || layer.locks.pixels) {
    throw new Error('layer clear is blocked by the layer pixel lock');
  }

  if (layer.type === 'raster') {
    const raster = layer as RasterLayerV1;
    const hasCommittedPaint = snapshot.committedStrokes.some(
      (entry) => entry.stroke.layerId === layerId,
    );
    if (raster.tiles.length === 0 && !hasCommittedPaint) {
      throw new Error('raster layer clear has no changes');
    }
    const cleared = Object.freeze({
      ...raster,
      revision,
      tiles: Object.freeze([]),
      boundsHint: null,
    }) as RasterLayerV1;
    return documentWithStateV1(
      snapshot,
      revision,
      snapshot.document.layerTree.rootLayerIds,
      { ...snapshot.document.layerTree.layers, [layerId]: cleared },
      snapshot.committedStrokes.filter((entry) => entry.stroke.layerId !== layerId),
      now,
    );
  }

  if (layer.type === 'vector') {
    const vector = layer as VectorLayerV1;
    if (vector.objects.length === 0) throw new Error('vector layer clear has no changes');
    const cleared = Object.freeze({
      ...vector,
      revision,
      objects: Object.freeze([]),
      boundsHint: null,
    }) as VectorLayerV1;
    return documentWithStateV1(
      snapshot,
      revision,
      snapshot.document.layerTree.rootLayerIds,
      { ...snapshot.document.layerTree.layers, [layerId]: cleared },
      snapshot.committedStrokes,
      now,
    );
  }

  throw new Error(`layer clear is not applicable to ${layer.type} layers`);
}
