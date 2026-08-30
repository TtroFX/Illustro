import { describe, expect, it, vi } from 'vitest';
import { createDocumentV1 } from '../../src/domain/document.js';
import {
  createDefaultWorkspaceSessionState,
  createDerivedCacheState,
  createProjectMetadataState,
  createWorkspaceSessionStore,
} from '../../src/domain/state-boundaries.js';
import { isUuid } from '../../src/domain/identity.js';

describe('canonical state boundaries', () => {
  it('keeps project metadata outside canonical artwork state', () => {
    const metadata = createProjectMetadataState({
      name: 'Untitled',
      now: new Date('2026-08-30T00:00:00.000Z'),
    });

    expect(isUuid(metadata.projectId)).toBe(true);
    expect(metadata).toMatchObject({
      name: 'Untitled',
      createdAt: '2026-08-30T00:00:00.000Z',
      modifiedAt: '2026-08-30T00:00:00.000Z',
      previewResourceId: null,
    });
  });

  it('updates and resets workspace/session state independently', () => {
    const store = createWorkspaceSessionStore(createDefaultWorkspaceSessionState());
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    store.update((current) => ({
      ...current,
      activeToolId: 'illustro.tool.brush',
      viewport: { ...current.viewport, zoom: 2, rotationDegrees: 15 },
    }));

    expect(store.getSnapshot().activeToolId).toBe('illustro.tool.brush');
    expect(store.getSnapshot().viewport).toMatchObject({ zoom: 2, rotationDegrees: 15 });
    expect(listener).toHaveBeenCalledTimes(1);

    store.reset();
    expect(store.getSnapshot()).toEqual(createDefaultWorkspaceSessionState());
    unsubscribe();
  });

  it('allows every derived cache to be discarded without mutating the document', () => {
    const document = createDocumentV1({ width: 512, height: 512 });
    const before = JSON.stringify(document);
    const cache = createDerivedCacheState();

    cache.gpuResources.set('tile:0:0', { handle: 'transient' });
    cache.thumbnails.set('layer:1', new Uint8Array([1, 2, 3]));
    cache.mipAndPreviews.set('preview:1', true);
    cache.extractedLineart.set('lineart:1', true);
    cache.effectResults.set('effect:1', true);
    cache.decodedResources.set('resource:1', true);

    cache.clear();

    expect([
      cache.gpuResources,
      cache.thumbnails,
      cache.mipAndPreviews,
      cache.extractedLineart,
      cache.effectResults,
      cache.decodedResources,
    ].every((entry) => entry.size === 0)).toBe(true);
    expect(JSON.stringify(document)).toBe(before);
  });
});
