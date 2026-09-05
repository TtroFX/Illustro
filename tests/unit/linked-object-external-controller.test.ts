import { describe, expect, it } from 'vitest';
import type { DocumentV1 } from '../../src/domain/document.js';
import { createProjectId } from '../../src/domain/identity.js';
import { createLinkedObjectLayer } from '../../src/domain/special-layers.js';
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

function handleFixture(
  file: LinkedObjectExternalFileV1,
  permission: 'granted' | 'denied' | 'prompt' = 'granted',
): LinkedObjectExternalHandleV1 {
  return Object.freeze({
    kind: 'file',
    name: file.name,
    async getFile() {
      return file;
    },
    async queryPermission() {
      return permission;
    },
    async requestPermission() {
      return permission;
    },
  });
}

class MemoryHandleStore implements LinkedObjectExternalHandleStoreV1 {
  readonly handles = new Map<string, LinkedObjectExternalHandleV1>();
  failSave = false;

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
    if (this.failSave) throw new Error('quota');
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

describe('M9D linked object external acceleration', () => {
  it('links a matching persistent handle without changing canonical linked-object state', async () => {
    const projectId = createProjectId();
    const snapshot = documentFixture('canonical');
    const sourceHash = await hashText('same source');
    const layer = createLinkedObjectLayer({
      name: 'Linked',
      embeddedSnapshot: snapshot,
      externalSource: {
        originalName: 'source.png',
        format: 'image/png',
        sourceHash,
      },
    });
    const store = new MemoryHandleStore();
    const handle = handleFixture(fileFixture('renamed-source.png', 'same source'));
    const controller = new LinkedObjectExternalControllerV1({
      store,
      importer: {
        async importExternal() {
          throw new Error('handle-only link must not import or replace canonical content');
        },
      },
    });

    const result = await controller.linkPersistentHandle({ projectId, layer, handle });

    expect(result.state).toBe('linked');
    expect(result.handlePersisted).toBe(true);
    expect(result.sourceHash).toBe(sourceHash);
    expect(result.layer).toBe(layer);
    expect(result.layer.revision).toBe(layer.revision);
    expect(result.layer.embeddedSnapshot).toBe(snapshot);
    expect(result.layer.externalSource).toBe(layer.externalSource);
    expect(store.handles.get(store.key(projectId, layer.objectId))).toBe(handle);
  });

  it('rejects a mismatched handle without persisting or replacing the embedded snapshot', async () => {
    const projectId = createProjectId();
    const snapshot = documentFixture('canonical');
    const layer = createLinkedObjectLayer({
      name: 'Linked',
      embeddedSnapshot: snapshot,
      externalSource: {
        originalName: 'source.png',
        format: 'image/png',
        sourceHash: await hashText('expected source'),
      },
    });
    const store = new MemoryHandleStore();
    const controller = new LinkedObjectExternalControllerV1({
      store,
      importer: {
        async importExternal() {
          throw new Error('must not import');
        },
      },
    });

    const result = await controller.linkPersistentHandle({
      projectId,
      layer,
      handle: handleFixture(fileFixture('other.png', 'different source')),
    });

    expect(result.state).toBe('source-mismatch');
    expect(result.handlePersisted).toBe(false);
    expect(result.layer).toBe(layer);
    expect(result.layer.embeddedSnapshot).toBe(snapshot);
    expect(store.handles.size).toBe(0);
  });

  it('keeps the embedded snapshot independent when no external descriptor or permission is available', async () => {
    const projectId = createProjectId();
    const snapshot = documentFixture('canonical');
    const untracked = createLinkedObjectLayer({ name: 'Linked', embeddedSnapshot: snapshot });
    const store = new MemoryHandleStore();
    const controller = new LinkedObjectExternalControllerV1({
      store,
      importer: {
        async importExternal() {
          throw new Error('must not import');
        },
      },
    });
    const file = fileFixture('source.png', 'source');

    const noDescriptor = await controller.linkPersistentHandle({
      projectId,
      layer: untracked,
      handle: handleFixture(file),
    });
    expect(noDescriptor.state).toBe('untracked');
    expect(noDescriptor.layer.embeddedSnapshot).toBe(snapshot);

    const tracked = createLinkedObjectLayer({
      name: 'Tracked',
      embeddedSnapshot: snapshot,
      externalSource: {
        originalName: 'source.png',
        format: 'image/png',
        sourceHash: await hashText('source'),
      },
    });
    const denied = await controller.linkPersistentHandle({
      projectId,
      layer: tracked,
      handle: handleFixture(file, 'denied'),
    });
    const prompt = await controller.linkPersistentHandle({
      projectId,
      layer: tracked,
      handle: handleFixture(file, 'prompt'),
    });
    expect(denied.state).toBe('permission-lost');
    expect(prompt.state).toBe('permission-required');
    expect(store.handles.size).toBe(0);
    expect(tracked.embeddedSnapshot).toBe(snapshot);
  });

  it('reports optional handle-store failure without changing the canonical linked object', async () => {
    const projectId = createProjectId();
    const snapshot = documentFixture('canonical');
    const file = fileFixture('source.png', 'source');
    const layer = createLinkedObjectLayer({
      name: 'Linked',
      embeddedSnapshot: snapshot,
      externalSource: {
        originalName: 'source.png',
        format: 'image/png',
        sourceHash: await hashText('source'),
      },
    });
    const store = new MemoryHandleStore();
    store.failSave = true;
    const controller = new LinkedObjectExternalControllerV1({
      store,
      importer: {
        async importExternal() {
          throw new Error('must not import');
        },
      },
    });

    const result = await controller.linkPersistentHandle({
      projectId,
      layer,
      handle: handleFixture(file),
    });

    expect(result.state).toBe('storage-failed');
    expect(result.handlePersisted).toBe(false);
    expect(result.layer).toBe(layer);
    expect(result.layer.revision).toBe(layer.revision);
    expect(result.layer.embeddedSnapshot).toBe(snapshot);
  });

  it('stages a changed external file without mutating the embedded canonical snapshot, then commits once', async () => {
    const projectId = createProjectId();
    const oldSnapshot = documentFixture('old');
    const nextSnapshot = documentFixture('next');
    const layer = createLinkedObjectLayer({
      name: 'Linked',
      embeddedSnapshot: oldSnapshot,
      externalSource: {
        originalName: 'old.png',
        format: 'image/png',
        sourceHash: '0'.repeat(64),
      },
    });
    const store = new MemoryHandleStore();
    const handle = handleFixture(fileFixture('new.png', 'new bytes'));
    store.handles.set(store.key(projectId, layer.objectId), handle);
    let imports = 0;
    const controller = new LinkedObjectExternalControllerV1({
      store,
      importer: {
        async importExternal() {
          imports += 1;
          return { embeddedSnapshot: nextSnapshot, incompatibilities: ['flattened-test'] };
        },
      },
    });

    const stage = await controller.stageRefresh({ projectId, layer });
    expect(stage.state).toBe('ready');
    expect(stage.layer.embeddedSnapshot).toBe(oldSnapshot);
    expect(stage.candidateSnapshot).toBe(nextSnapshot);
    expect(stage.incompatibilities).toEqual(['flattened-test']);
    expect(imports).toBe(1);

    let committed = 0;
    const result = await controller.commit({
      projectId,
      stage,
      async commitTransaction(nextLayer) {
        committed += 1;
        expect(nextLayer.embeddedSnapshot).toBe(nextSnapshot);
        expect(nextLayer.objectId).toBe(layer.objectId);
        expect(nextLayer.revision).toBe(layer.revision + 1);
      },
    });
    expect(committed).toBe(1);
    expect(result.handlePersisted).toBe(true);
    expect(result.layer.externalSource?.originalName).toBe('new.png');

    const unchanged = await controller.stageRefresh({ projectId, layer: result.layer });
    expect(unchanged.state).toBe('unchanged');
    expect(imports).toBe(1);
  });

  it('reports permission loss and a missing persisted handle without changing project content', async () => {
    const projectId = createProjectId();
    const snapshot = documentFixture('canonical');
    const layer = createLinkedObjectLayer({
      name: 'Linked',
      embeddedSnapshot: snapshot,
      externalSource: {
        originalName: 'source.png',
        format: 'image/png',
        sourceHash: '1'.repeat(64),
      },
    });
    const store = new MemoryHandleStore();
    const controller = new LinkedObjectExternalControllerV1({
      store,
      importer: {
        async importExternal() {
          throw new Error('must not import');
        },
      },
    });

    const missing = await controller.stageRefresh({ projectId, layer });
    expect(missing.state).toBe('missing');
    expect(missing.layer.embeddedSnapshot).toBe(snapshot);

    store.handles.set(
      store.key(projectId, layer.objectId),
      handleFixture(fileFixture('source.png', 'bytes'), 'denied'),
    );
    const denied = await controller.stageRefresh({ projectId, layer });
    expect(denied.state).toBe('permission-lost');
    expect(denied.layer.embeddedSnapshot).toBe(snapshot);
  });

  it('keeps a successful canonical refresh committed even if optional handle persistence fails', async () => {
    const projectId = createProjectId();
    const layer = createLinkedObjectLayer({
      name: 'Linked',
      embeddedSnapshot: documentFixture('old'),
    });
    const store = new MemoryHandleStore();
    store.failSave = true;
    const controller = new LinkedObjectExternalControllerV1({
      store,
      importer: {
        async importExternal() {
          return { embeddedSnapshot: documentFixture('new') };
        },
      },
    });
    const stage = await controller.stageRelink({
      layer,
      handle: handleFixture(fileFixture('new.png', 'new')),
    });
    expect(stage.state).toBe('ready');

    let canonicalCommit = false;
    const result = await controller.commit({
      projectId,
      stage,
      async commitTransaction() {
        canonicalCommit = true;
      },
    });
    expect(canonicalCommit).toBe(true);
    expect(result.handlePersisted).toBe(false);
    expect(result.layer.embeddedSnapshot).toBe(stage.candidateSnapshot);
  });

  it('does not permit an invalid staged import to reach the canonical transaction', async () => {
    const projectId = createProjectId();
    const layer = createLinkedObjectLayer({
      name: 'Linked',
      embeddedSnapshot: documentFixture('old'),
    });
    const store = new MemoryHandleStore();
    const controller = new LinkedObjectExternalControllerV1({
      store,
      importer: {
        async importExternal() {
          throw new Error('unsupported input');
        },
      },
    });
    const stage = await controller.stageRelink({
      layer,
      handle: handleFixture(fileFixture('bad.bin', 'bad')),
    });
    expect(stage.state).toBe('invalid');
    await expect(
      controller.commit({ projectId, stage, async commitTransaction() {} }),
    ).rejects.toThrow('validated ready');
  });
});
