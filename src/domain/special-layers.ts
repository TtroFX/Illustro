import type { DocumentV1 } from './document.js';
import {
  INITIAL_REVISION,
  createNodeId,
  createObjectId,
  type LayerId,
  type NodeId,
  type ObjectId,
  type Revision,
} from './identity.js';
import {
  createFolderLayer,
  createRasterLayer,
  type FolderLayerV1,
  type LayerBaseV1,
  type LayerCommonInput,
  type NamespacedMetadataV1,
} from './layers.js';
import { isSha256Hex } from './resources.js';

export const REFERENCE_LAYER_METADATA_SCHEMA = 'illustro.layer.reference/1' as const;
export const DRAFT_LAYER_METADATA_SCHEMA = 'illustro.layer.draft/1' as const;

export interface ReferenceLayerMetadataV1 {
  readonly schema: typeof REFERENCE_LAYER_METADATA_SCHEMA;
  readonly useForSampling: boolean;
  readonly useForFill: boolean;
  readonly useForAutoSelect: boolean;
  readonly useForAntiOverflow: boolean;
}

export interface DraftLayerMetadataV1 {
  readonly schema: typeof DRAFT_LAYER_METADATA_SCHEMA;
  readonly excludeFromFinalOutput: boolean;
}

export interface LinkedObjectExternalSourceV1 {
  readonly originalName: string;
  readonly format: string;
  readonly sourceHash: string;
}

export interface LinkedObjectLayerV1 extends LayerBaseV1<'linkedObject'> {
  readonly objectId: ObjectId;
  readonly embeddedSnapshot: DocumentV1;
  readonly externalSource: LinkedObjectExternalSourceV1 | null;
}

export interface LineartGroupSpecV1 {
  readonly sourceLayerIds: readonly LayerId[];
  readonly boundaryLayerId: LayerId;
}

export interface LineartGroupLayerV1 extends FolderLayerV1 {
  readonly role: 'lineart-group';
  readonly lineart: LineartGroupSpecV1;
}

export type LineartEdgeProvenanceV1 =
  | 'extracted'
  | 'automatic-gap'
  | 'manual-added'
  | 'manual-connect';

export interface LineartBoundaryPointV1 {
  readonly x: number;
  readonly y: number;
}

export interface LineartBoundaryNodeV1 {
  readonly id: NodeId;
  readonly revision: Revision;
  readonly position: LineartBoundaryPointV1;
}

export interface LineartBoundaryEdgeV1 {
  readonly id: ObjectId;
  readonly revision: Revision;
  readonly startNodeId: NodeId;
  readonly endNodeId: NodeId;
  readonly provenance: LineartEdgeProvenanceV1;
  readonly geometry: readonly LineartBoundaryPointV1[];
  readonly sourceAnchor: NamespacedMetadataV1;
}

export interface LineartNoConnectConstraintV1 {
  readonly id: ObjectId;
  readonly firstNodeId: NodeId;
  readonly secondNodeId: NodeId;
  readonly reason: 'rejected-automatic' | 'manual-disconnect';
}

export interface LineartManualOverridesV1 {
  readonly removedEdgeIds: readonly ObjectId[];
  readonly rejectedAutomaticEdgeIds: readonly ObjectId[];
  readonly noConnectConstraints: readonly LineartNoConnectConstraintV1[];
}

export interface LineartSourceRevisionV1 {
  readonly layerId: LayerId;
  readonly revision: Revision;
}

export interface LineartBoundaryPayloadV1 {
  readonly sourceRevisions: readonly LineartSourceRevisionV1[];
  readonly nodes: readonly LineartBoundaryNodeV1[];
  readonly edges: readonly LineartBoundaryEdgeV1[];
  readonly manualOverrides: LineartManualOverridesV1;
}

export interface LineartBoundaryLayerV1 extends LayerBaseV1<'lineartBoundary'> {
  readonly renderedAsArtwork: false;
  readonly payload: LineartBoundaryPayloadV1;
}

export type LineartNodeClassificationV1 = 'isolated' | 'endpoint' | 'interior' | 'junction';

function createSpecialLayerBase<Type extends 'linkedObject' | 'lineartBoundary'>(
  type: Type,
  input: LayerCommonInput,
): LayerBaseV1<Type> {
  const raster = createRasterLayer(input);
  const { tiles, ...base } = raster;
  void tiles;
  return Object.freeze({ ...base, type });
}

function freezeArray<T>(values: readonly T[]): readonly T[] {
  return Object.freeze([...values]);
}

export function createReferenceLayerMetadata(input: {
  useForSampling?: boolean;
  useForFill?: boolean;
  useForAutoSelect?: boolean;
  useForAntiOverflow?: boolean;
} = {}): ReferenceLayerMetadataV1 {
  return Object.freeze({
    schema: REFERENCE_LAYER_METADATA_SCHEMA,
    useForSampling: input.useForSampling ?? true,
    useForFill: input.useForFill ?? true,
    useForAutoSelect: input.useForAutoSelect ?? true,
    useForAntiOverflow: input.useForAntiOverflow ?? true,
  });
}

export function createDraftLayerMetadata(input: {
  excludeFromFinalOutput?: boolean;
} = {}): DraftLayerMetadataV1 {
  return Object.freeze({
    schema: DRAFT_LAYER_METADATA_SCHEMA,
    excludeFromFinalOutput: input.excludeFromFinalOutput ?? true,
  });
}

export function createLinkedObjectLayer(
  input: LayerCommonInput & {
    embeddedSnapshot: DocumentV1;
    externalSource?: LinkedObjectExternalSourceV1 | null;
  },
): LinkedObjectLayerV1 {
  if (input.externalSource !== undefined && input.externalSource !== null) {
    if (!isSha256Hex(input.externalSource.sourceHash)) {
      throw new TypeError('linked object sourceHash must be lowercase SHA-256 hex');
    }
    if (input.externalSource.originalName.length === 0 || input.externalSource.format.length === 0) {
      throw new TypeError('linked object external source name and format must not be empty');
    }
  }

  return Object.freeze({
    ...createSpecialLayerBase('linkedObject', input),
    objectId: createObjectId(),
    embeddedSnapshot: input.embeddedSnapshot,
    externalSource: input.externalSource ?? null,
  });
}

export function createLineartGroupLayer(
  input: LayerCommonInput & {
    sourceLayerIds: readonly LayerId[];
    boundaryLayerId: LayerId;
    childLayerIds?: readonly LayerId[];
  },
): LineartGroupLayerV1 {
  if (input.sourceLayerIds.length === 0) {
    throw new RangeError('Lineart Group requires at least one source layer');
  }
  if (new Set(input.sourceLayerIds).size !== input.sourceLayerIds.length) {
    throw new TypeError('Lineart Group source layer IDs must be unique');
  }
  if (input.sourceLayerIds.includes(input.boundaryLayerId)) {
    throw new TypeError('Lineart Boundary child cannot also be a source layer');
  }

  const childLayerIds = input.childLayerIds ?? [...input.sourceLayerIds, input.boundaryLayerId];
  const folder = createFolderLayer({
    ...input,
    role: 'lineart-group',
    childLayerIds,
  });
  return Object.freeze({
    ...folder,
    role: 'lineart-group',
    lineart: Object.freeze({
      sourceLayerIds: freezeArray(input.sourceLayerIds),
      boundaryLayerId: input.boundaryLayerId,
    }),
  });
}

export function createLineartBoundaryNode(x: number, y: number): LineartBoundaryNodeV1 {
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new RangeError('Lineart Boundary node coordinates must be finite');
  }
  return Object.freeze({
    id: createNodeId(),
    revision: INITIAL_REVISION,
    position: Object.freeze({ x, y }),
  });
}

export function createLineartBoundaryEdge(input: {
  startNodeId: NodeId;
  endNodeId: NodeId;
  provenance: LineartEdgeProvenanceV1;
  geometry?: readonly LineartBoundaryPointV1[];
  sourceAnchor?: NamespacedMetadataV1;
}): LineartBoundaryEdgeV1 {
  if (input.startNodeId === input.endNodeId) {
    throw new TypeError('Lineart Boundary edge endpoints must be distinct');
  }
  return Object.freeze({
    id: createObjectId(),
    revision: INITIAL_REVISION,
    startNodeId: input.startNodeId,
    endNodeId: input.endNodeId,
    provenance: input.provenance,
    geometry: freezeArray(input.geometry ?? []),
    sourceAnchor: Object.freeze({ ...(input.sourceAnchor ?? {}) }),
  });
}

export function createLineartNoConnectConstraint(input: {
  firstNodeId: NodeId;
  secondNodeId: NodeId;
  reason: LineartNoConnectConstraintV1['reason'];
}): LineartNoConnectConstraintV1 {
  if (input.firstNodeId === input.secondNodeId) {
    throw new TypeError('no-connect constraint requires two distinct nodes');
  }
  return Object.freeze({ id: createObjectId(), ...input });
}

export function classifyLineartBoundaryNode(
  nodeId: NodeId,
  edges: readonly LineartBoundaryEdgeV1[],
): LineartNodeClassificationV1 {
  let degree = 0;
  for (const edge of edges) {
    if (edge.startNodeId === nodeId || edge.endNodeId === nodeId) degree += 1;
  }
  if (degree === 0) return 'isolated';
  if (degree === 1) return 'endpoint';
  if (degree === 2) return 'interior';
  return 'junction';
}

export function createLineartBoundaryLayer(
  input: LayerCommonInput & {
    sourceRevisions?: readonly LineartSourceRevisionV1[];
    nodes?: readonly LineartBoundaryNodeV1[];
    edges?: readonly LineartBoundaryEdgeV1[];
    manualOverrides?: Partial<LineartManualOverridesV1>;
  },
): LineartBoundaryLayerV1 {
  return Object.freeze({
    ...createSpecialLayerBase('lineartBoundary', input),
    renderedAsArtwork: false,
    payload: Object.freeze({
      sourceRevisions: freezeArray(input.sourceRevisions ?? []),
      nodes: freezeArray(input.nodes ?? []),
      edges: freezeArray(input.edges ?? []),
      manualOverrides: Object.freeze({
        removedEdgeIds: freezeArray(input.manualOverrides?.removedEdgeIds ?? []),
        rejectedAutomaticEdgeIds: freezeArray(
          input.manualOverrides?.rejectedAutomaticEdgeIds ?? [],
        ),
        noConnectConstraints: freezeArray(input.manualOverrides?.noConnectConstraints ?? []),
      }),
    }),
  });
}
