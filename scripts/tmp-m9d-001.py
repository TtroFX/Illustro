from pathlib import Path

# Controller: add an explicit optional handle-only link operation.
p = Path('src/app/linked-object-external-controller.ts')
s = p.read_text()
marker = "export interface LinkedObjectRefreshCommitResultV1 {\n  readonly layer: LinkedObjectLayerV1;\n  readonly handlePersisted: boolean;\n}\n"
assert marker in s
addition = marker + "\nexport type LinkedObjectPersistentHandleLinkStateV1 =\n  | 'linked'\n  | 'untracked'\n  | 'missing'\n  | 'permission-required'\n  | 'permission-lost'\n  | 'source-mismatch'\n  | 'storage-failed';\n\nexport interface LinkedObjectPersistentHandleLinkResultV1 {\n  readonly state: LinkedObjectPersistentHandleLinkStateV1;\n  readonly layer: LinkedObjectLayerV1;\n  readonly handlePersisted: boolean;\n  readonly sourceHash: string | null;\n  readonly message: string | null;\n}\n"
s = s.replace(marker, addition, 1)

helper_marker = "function isMissingFileError(error: unknown): boolean {\n"
assert helper_marker in s
helper = "function persistentHandleLinkResult(\n  layer: LinkedObjectLayerV1,\n  state: LinkedObjectPersistentHandleLinkStateV1,\n  handlePersisted: boolean,\n  sourceHash: string | null,\n  message: string | null,\n): LinkedObjectPersistentHandleLinkResultV1 {\n  return Object.freeze({ state, layer, handlePersisted, sourceHash, message });\n}\n\n"
s = s.replace(helper_marker, helper + helper_marker, 1)

method_marker = "  async stageRefresh(input: {\n"
assert method_marker in s
method = "  async linkPersistentHandle(input: {\n    readonly projectId: ProjectId;\n    readonly layer: LinkedObjectLayerV1;\n    readonly handle: LinkedObjectExternalHandleV1;\n  }): Promise<LinkedObjectPersistentHandleLinkResultV1> {\n    const externalSource = input.layer.externalSource;\n    if (externalSource === null) {\n      return persistentHandleLinkResult(\n        input.layer,\n        'untracked',\n        false,\n        null,\n        'Linked object has no external source descriptor; canonical embedded snapshot remains active.',\n      );\n    }\n\n    const permission = await permissionState(input.handle);\n    if (permission === 'denied') {\n      return persistentHandleLinkResult(\n        input.layer,\n        'permission-lost',\n        false,\n        null,\n        'External source permission is unavailable; canonical embedded snapshot remains active.',\n      );\n    }\n    if (permission === 'prompt') {\n      return persistentHandleLinkResult(\n        input.layer,\n        'permission-required',\n        false,\n        null,\n        'External source permission must be granted before retaining the optional persistent link.',\n      );\n    }\n\n    let file: LinkedObjectExternalFileV1;\n    try {\n      file = await input.handle.getFile();\n    } catch (error) {\n      if (isMissingFileError(error)) {\n        return persistentHandleLinkResult(\n          input.layer,\n          'missing',\n          false,\n          null,\n          'External source is missing; canonical embedded snapshot remains active.',\n        );\n      }\n      throw error;\n    }\n\n    const sourceHash = await sha256Hex(file);\n    if (sourceHash !== externalSource.sourceHash) {\n      return persistentHandleLinkResult(\n        input.layer,\n        'source-mismatch',\n        false,\n        sourceHash,\n        'Selected handle does not match the linked object external source; no persistent link was stored.',\n      );\n    }\n\n    try {\n      await this.#store.save(input.projectId, input.layer.objectId, input.handle);\n      return persistentHandleLinkResult(input.layer, 'linked', true, sourceHash, null);\n    } catch (error) {\n      return persistentHandleLinkResult(\n        input.layer,\n        'storage-failed',\n        false,\n        sourceHash,\n        error instanceof Error ? error.message : String(error),\n      );\n    }\n  }\n\n"
s = s.replace(method_marker, method + method_marker, 1)
p.write_text(s)

# Unit tests: prove the optional link never mutates canonical project state.
p = Path('tests/unit/linked-object-external-controller.test.ts')
s = p.read_text()
insert_marker = "describe('M9D linked object external acceleration', () => {\n"
assert insert_marker in s
helper = "async function hashText(text: string): Promise<string> {\n  const bytes = new TextEncoder().encode(text);\n  const digest = await crypto.subtle.digest('SHA-256', bytes);\n  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');\n}\n\n"
s = s.replace(insert_marker, helper + insert_marker, 1)

tests = r'''  it('links a matching persistent handle without changing canonical linked-object state', async () => {
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
      importer: { async importExternal() { throw new Error('must not import'); } },
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
      importer: { async importExternal() { throw new Error('must not import'); } },
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
      importer: { async importExternal() { throw new Error('must not import'); } },
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

'''
s = s.replace(insert_marker, insert_marker + tests, 1)
p.write_text(s)
