import { describe, expect, it } from 'vitest';
import { createProvenanceV1, createResourceV1 } from '../../src/domain/resources.js';
import {
  activeReferenceWorkspaceItemV1,
  addReferenceWorkspaceResourceV1,
  createReferenceWorkspaceStateV1,
  parseReferenceWorkspaceStateV1,
  removeReferenceWorkspaceResourceV1,
  setActiveReferenceWorkspaceResourceV1,
  updateReferenceWorkspaceViewV1,
} from '../../src/app/reference-workspace-state.js';
import {
  referenceRgbaBytesToColorV1,
  referenceViewSourcePointV1,
} from '../../src/app/reference-workflow-controller.js';
import { rgbUnitToBytesV1 } from '../../src/domain/color.js';

function resource(name: string, hashByte: string) {
  return createResourceV1({
    kind: 'reference-image',
    contentHash: hashByte.repeat(64),
    mimeType: 'image/png',
    byteLength: 12,
    originalName: name,
    dimensions: { width: 400, height: 200, channels: 4 },
    colorSpace: 'none',
    channelSemantics: 'rgba',
    provenance: createProvenanceV1({ sourceClass: 'user-imported', sourceName: name }),
  });
}

describe('M5D reference image workspace and sampling', () => {
  it('keeps multiple named references, active selection, and per-reference view state', () => {
    const first = resource('first.png', 'a');
    const second = resource('second.png', 'b');
    let state = addReferenceWorkspaceResourceV1(createReferenceWorkspaceStateV1(), first);
    state = addReferenceWorkspaceResourceV1(state, second);
    expect(state.activeResourceId).toBe(second.resourceId);
    state = setActiveReferenceWorkspaceResourceV1(state, first.resourceId);
    state = updateReferenceWorkspaceViewV1(state, first.resourceId, {
      zoom: 2.5,
      rotationQuarterTurns: -1,
    });
    expect(activeReferenceWorkspaceItemV1(state)).toMatchObject({
      zoom: 2.5,
      rotationQuarterTurns: 3,
    });
    expect(parseReferenceWorkspaceStateV1(JSON.parse(JSON.stringify(state)))).toEqual(state);
  });

  it('chooses a neighboring reference when the active reference is removed', () => {
    const first = resource('first.png', 'c');
    const second = resource('second.png', 'd');
    let state = addReferenceWorkspaceResourceV1(createReferenceWorkspaceStateV1(), first);
    state = addReferenceWorkspaceResourceV1(state, second);
    state = removeReferenceWorkspaceResourceV1(state, second.resourceId);
    expect(state.activeResourceId).toBe(first.resourceId);
  });

  it('maps a rotated reference-view point back into source pixels', () => {
    const point = referenceViewSourcePointV1({
      viewX: 100,
      viewY: 50,
      viewWidth: 200,
      viewHeight: 100,
      sourceWidth: 100,
      sourceHeight: 200,
      zoom: 1,
      rotationQuarterTurns: 1,
    });
    expect(point?.x).toBeCloseTo(50, 6);
    expect(point?.y).toBeCloseTo(100, 6);
  });

  it('converts a visible decoded reference pixel to the canonical color state', () => {
    expect(
      rgbUnitToBytesV1(referenceRgbaBytesToColorV1(new Uint8ClampedArray([12, 130, 240, 255]))!),
    ).toEqual([12, 130, 240]);
    expect(referenceRgbaBytesToColorV1(new Uint8ClampedArray([12, 130, 240, 0]))).toBeNull();
  });
});
