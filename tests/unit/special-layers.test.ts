import { describe, expect, it } from 'vitest';
import { createDocumentV1 } from '../../src/domain/document.js';
import { createRasterLayer } from '../../src/domain/layers.js';
import {
  classifyLineartBoundaryNode,
  createDraftLayerMetadata,
  createLineartBoundaryEdge,
  createLineartBoundaryLayer,
  createLineartBoundaryNode,
  createLineartGroupLayer,
  createLineartNoConnectConstraint,
  createLinkedObjectLayer,
  createReferenceLayerMetadata,
  DRAFT_LAYER_METADATA_SCHEMA,
  REFERENCE_LAYER_METADATA_SCHEMA,
} from '../../src/domain/special-layers.js';
import { isUuid } from '../../src/domain/identity.js';

describe('special canonical layer schemas', () => {
  it('keeps linked object correctness in an embedded canonical snapshot', () => {
    const snapshot = createDocumentV1({ width: 256, height: 256 });
    const layer = createLinkedObjectLayer({
      name: 'Placed image',
      embeddedSnapshot: snapshot,
      externalSource: {
        originalName: 'source.psd',
        format: 'image/vnd.adobe.photoshop',
        sourceHash: 'b'.repeat(64),
      },
    });

    expect(layer.type).toBe('linkedObject');
    expect(isUuid(layer.objectId)).toBe(true);
    expect(layer.embeddedSnapshot).toBe(snapshot);
    expect(layer.externalSource?.sourceHash).toBe('b'.repeat(64));
  });

  it('represents Lineart Group as a folder with explicit sources and one boundary child', () => {
    const sourceA = createRasterLayer({ name: 'Ink A' });
    const sourceB = createRasterLayer({ name: 'Ink B' });
    const boundary = createLineartBoundaryLayer({ name: 'Boundary' });
    const group = createLineartGroupLayer({
      name: 'Lineart Group',
      sourceLayerIds: [sourceA.id, sourceB.id],
      boundaryLayerId: boundary.id,
    });

    expect(group.type).toBe('folder');
    expect(group.role).toBe('lineart-group');
    expect(group.blendMode).toBe('pass-through');
    expect(group.lineart.sourceLayerIds).toEqual([sourceA.id, sourceB.id]);
    expect(group.childLayerIds).toEqual([sourceA.id, sourceB.id, boundary.id]);
  });

  it('derives endpoint/interior/junction classification from graph degree', () => {
    const center = createLineartBoundaryNode(10, 10);
    const a = createLineartBoundaryNode(0, 10);
    const b = createLineartBoundaryNode(20, 10);
    const c = createLineartBoundaryNode(10, 20);
    const first = createLineartBoundaryEdge({
      startNodeId: a.id,
      endNodeId: center.id,
      provenance: 'extracted',
    });
    const second = createLineartBoundaryEdge({
      startNodeId: center.id,
      endNodeId: b.id,
      provenance: 'automatic-gap',
    });
    const third = createLineartBoundaryEdge({
      startNodeId: center.id,
      endNodeId: c.id,
      provenance: 'manual-connect',
    });

    expect(classifyLineartBoundaryNode(a.id, [first])).toBe('endpoint');
    expect(classifyLineartBoundaryNode(center.id, [first, second])).toBe('interior');
    expect(classifyLineartBoundaryNode(center.id, [first, second, third])).toBe('junction');
  });

  it('stores automatic topology provenance separately from manual rejection constraints', () => {
    const a = createLineartBoundaryNode(0, 0);
    const b = createLineartBoundaryNode(1, 0);
    const automatic = createLineartBoundaryEdge({
      startNodeId: a.id,
      endNodeId: b.id,
      provenance: 'automatic-gap',
    });
    const constraint = createLineartNoConnectConstraint({
      firstNodeId: a.id,
      secondNodeId: b.id,
      reason: 'rejected-automatic',
    });
    const boundary = createLineartBoundaryLayer({
      name: 'Boundary',
      nodes: [a, b],
      edges: [automatic],
      manualOverrides: {
        rejectedAutomaticEdgeIds: [automatic.id],
        noConnectConstraints: [constraint],
      },
    });

    expect(boundary.renderedAsArtwork).toBe(false);
    expect(boundary.payload.edges[0]?.provenance).toBe('automatic-gap');
    expect(boundary.payload.manualOverrides.rejectedAutomaticEdgeIds).toEqual([automatic.id]);
    expect(boundary.payload.manualOverrides.noConnectConstraints).toEqual([constraint]);
  });

  it('provides versioned reference and draft metadata for role flags', () => {
    const reference = createReferenceLayerMetadata();
    const draft = createDraftLayerMetadata();

    expect(reference).toMatchObject({
      schema: REFERENCE_LAYER_METADATA_SCHEMA,
      useForSampling: true,
      useForFill: true,
      useForAutoSelect: true,
      useForAntiOverflow: true,
    });
    expect(draft).toEqual({
      schema: DRAFT_LAYER_METADATA_SCHEMA,
      excludeFromFinalOutput: true,
    });
  });
});
