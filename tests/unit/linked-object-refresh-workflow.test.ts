import { describe, expect, it } from 'vitest';
import type { DocumentV1 } from '../../src/domain/document.js';
import { createProjectId } from '../../src/domain/identity.js';
import {
  createLinkedObjectLayer,
  type LinkedObjectLayerV1,
} from '../../src/domain/special-layers.js';
import {
  LinkedObjectExternalControllerV1,
  type LinkedObjectExternalFileV1,
  type LinkedObjectExternalHandleStoreV1,
  type LinkedObjectExternalHandleV1,
} from '../../src/app/linked-object-external-controller.js';

function documentFixture(marker: string): DocumentV1 {
  return Object.freeze({ marker }) as unknown as DocumentV1;
}

function fileFixture(name: string, text: string): LinkedObjectExternalFileV1 {
  const bytes = new TextEncoder().encode(text);
  return Object.freeze({
    name,
    type: 'image/png',
    size: bytes.byteLength,
    lastModified: 1,
    async arrayBuffer(): Promise<ArrayBuffer> {
      return bytes.slice().buffer;
    },
  });
}

function handleFixture(file: LinkedObjectExternalFileV1): LinkedObjectExternalHandleV1 {
  return Object.freeze({
    kind: 'file',
    name: file.name,
    async getFile() {
      return file;
    },
    async queryPermission() {
      return 'granted' as const;
    },
  });
}

class MemoryHandleStore implements LinkedObjectExternalHandleStoreV1 {
  readonly handles = new Map<string, LinkedObjectExternalHandleV1>();

  key(projectId: string, objectId: string): string {
    return `${projectId}/${objectId}`;
  }

  async load(
    projectId: Parameters<LinkedObjectExternalHandleStoreV1['load']>[0],
    objectId: Parameters<LinkedObjectExternalHandleStoreV1['load']>[1],
  ) {
    return this.handles.get(this.key(projectId, objectId)) ?? null;
  }

  async save(
    projectId: Parameters<LinkedObjectExternalHandleStoreV1['save']>[0],
    objectId: Parameters<LinkedObjectExternalHandleStoreV1['save']>[1],
    handle: LinkedObjectExternalHandleV1,
  ) {
    this.handles.set(this.key(projectId, objectId), handle);
  }

  async remove(
    projectId: Parameters<LinkedObjectExternalHandleStoreV1['remove']>[0],
    objectId: Parameters<LinkedObjectExternalHandleStoreV1['remove']>[1],
  ) {
    this.handles.delete(this.key(projectId, objectId));
  }
}

async function hashText(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function refreshFixture() {
  const projectId = createProjectId();
  const oldSnapshot = documentFixture('old');
  const nextSnapshot = documentFixture('next');
  const layer = createLinkedObjectLayer({
    name: 'Linked',
    embeddedSnapshot: oldSnapshot,
    externalSource: {
      originalName: 'source.png',
      format: 'image/png',
      sourceHash: '0'.repeat(64),
    },
  });
  const store = new MemoryHandleStore();
  const handle = handleFixture(fileFixture('source.png', 'changed source'));
  store.handles.set(store.key(projectId, layer.objectId), handle);
  const controller = new LinkedObjectExternalControllerV1({
    store,
    importer: {
      async importExternal() {
        return { embeddedSnapshot: nextSnapshot, incompatibilities: ['flattened-test'] };
      },
    },
  });
  return { projectId, oldSnapshot, nextSnapshot, layer, store, handle, controller };
}

describe('M9D-002 linked object refresh workflow', () => {
  it('requires explicit review before one canonical transaction commits the staged refresh', async () => {
    const fixture = refreshFixture();
    let currentLayer: LinkedObjectLayerV1 | null = fixture.layer;
    let reviews = 0;
    let transactions = 0;

    const result = await fixture.controller.refresh({
      projectId: fixture.projectId,
      layer: fixture.layer,
      async review(stage) {
        reviews += 1;
        expect(stage.layer.embeddedSnapshot).toBe(fixture.oldSnapshot);
        expect(stage.candidateSnapshot).toBe(fixture.nextSnapshot);
        expect(stage.incompatibilities).toEqual(['flattened-test']);
        expect(transactions).toBe(0);
        return 'commit';
      },
      getCurrentLayer() {
        return currentLayer;
      },
      async commitTransaction(nextLayer) {
        transactions += 1;
        currentLayer = nextLayer;
      },
    });

    expect(reviews).toBe(1);
    expect(transactions).toBe(1);
    expect(result.state).toBe('committed');
    expect(result.committed).toBe(true);
    expect(result.layer.embeddedSnapshot).toBe(fixture.nextSnapshot);
    expect(result.layer.revision).toBe(fixture.layer.revision + 1);
    expect(fixture.layer.embeddedSnapshot).toBe(fixture.oldSnapshot);
  });

  it('cancels after review without mutating canonical content or creating history', async () => {
    const fixture = refreshFixture();
    let transactions = 0;

    const result = await fixture.controller.refresh({
      projectId: fixture.projectId,
      layer: fixture.layer,
      review() {
        return 'cancel';
      },
      getCurrentLayer() {
        throw new Error('cancelled refresh must not resolve current layer');
      },
      async commitTransaction() {
        transactions += 1;
      },
    });

    expect(result.state).toBe('cancelled');
    expect(result.committed).toBe(false);
    expect(transactions).toBe(0);
    expect(result.layer).toBe(fixture.layer);
    expect(result.layer.embeddedSnapshot).toBe(fixture.oldSnapshot);
  });

  it('rejects a stale reviewed stage instead of overwriting a newer linked-object revision', async () => {
    const fixture = refreshFixture();
    const newerLayer = Object.freeze({
      ...fixture.layer,
      revision: (fixture.layer.revision + 1) as typeof fixture.layer.revision,
    });
    let transactions = 0;

    const result = await fixture.controller.refresh({
      projectId: fixture.projectId,
      layer: fixture.layer,
      review() {
        return 'commit';
      },
      getCurrentLayer() {
        return newerLayer;
      },
      async commitTransaction() {
        transactions += 1;
      },
    });

    expect(result.state).toBe('stale');
    expect(result.committed).toBe(false);
    expect(transactions).toBe(0);
    expect(result.layer.embeddedSnapshot).toBe(fixture.oldSnapshot);
  });

  it('short-circuits unchanged external content without review or a document transaction', async () => {
    const projectId = createProjectId();
    const snapshot = documentFixture('canonical');
    const sourceHash = await hashText('same source');
    const layer = createLinkedObjectLayer({
      name: 'Linked',
      embeddedSnapshot: snapshot,
      externalSource: { originalName: 'source.png', format: 'image/png', sourceHash },
    });
    const store = new MemoryHandleStore();
    store.handles.set(
      store.key(projectId, layer.objectId),
      handleFixture(fileFixture('source.png', 'same source')),
    );
    const controller = new LinkedObjectExternalControllerV1({
      store,
      importer: {
        async importExternal() {
          throw new Error('unchanged source must not be imported');
        },
      },
    });

    const result = await controller.refresh({
      projectId,
      layer,
      review() {
        throw new Error('unchanged source must not request review');
      },
      getCurrentLayer() {
        throw new Error('unchanged source must not resolve current layer');
      },
      async commitTransaction() {
        throw new Error('unchanged source must not create a transaction');
      },
    });

    expect(result.state).toBe('unchanged');
    expect(result.committed).toBe(false);
    expect(result.layer).toBe(layer);
    expect(result.layer.embeddedSnapshot).toBe(snapshot);
  });
});
