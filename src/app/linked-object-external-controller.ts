import type { DocumentV1 } from '../domain/document.js';
import { nextRevision, type ObjectId, type ProjectId } from '../domain/identity.js';
import type {
  LinkedObjectExternalSourceV1,
  LinkedObjectLayerV1,
} from '../domain/special-layers.js';

export interface LinkedObjectExternalFileV1 {
  readonly name: string;
  readonly type: string;
  readonly size: number;
  readonly lastModified: number;
  arrayBuffer(): Promise<ArrayBuffer>;
}

export interface LinkedObjectExternalHandleV1 {
  readonly kind?: string;
  readonly name?: string;
  getFile(): Promise<LinkedObjectExternalFileV1>;
  queryPermission?(options?: { mode?: 'read' }): Promise<'granted' | 'denied' | 'prompt'>;
  requestPermission?(options?: { mode?: 'read' }): Promise<'granted' | 'denied' | 'prompt'>;
}

export interface LinkedObjectExternalHandleStoreV1 {
  load(projectId: ProjectId, objectId: ObjectId): Promise<LinkedObjectExternalHandleV1 | null>;
  save(
    projectId: ProjectId,
    objectId: ObjectId,
    handle: LinkedObjectExternalHandleV1,
  ): Promise<void>;
  remove(projectId: ProjectId, objectId: ObjectId): Promise<void>;
}

export interface LinkedObjectImportResultV1 {
  readonly embeddedSnapshot: DocumentV1;
  readonly incompatibilities?: readonly string[];
  readonly format?: string;
}

export interface LinkedObjectExternalImporterV1 {
  importExternal(file: LinkedObjectExternalFileV1): Promise<LinkedObjectImportResultV1>;
}

export type LinkedObjectRefreshStateV1 =
  | 'ready'
  | 'unchanged'
  | 'missing'
  | 'permission-required'
  | 'permission-lost'
  | 'invalid';

export interface LinkedObjectRefreshStageV1 {
  readonly state: LinkedObjectRefreshStateV1;
  readonly layer: LinkedObjectLayerV1;
  readonly handle: LinkedObjectExternalHandleV1 | null;
  readonly externalSource: LinkedObjectExternalSourceV1 | null;
  readonly candidateSnapshot: DocumentV1 | null;
  readonly incompatibilities: readonly string[];
  readonly message: string | null;
}

export interface LinkedObjectRefreshCommitResultV1 {
  readonly layer: LinkedObjectLayerV1;
  readonly handlePersisted: boolean;
}

export type LinkedObjectPersistentHandleLinkStateV1 =
  | 'linked'
  | 'untracked'
  | 'missing'
  | 'permission-required'
  | 'permission-lost'
  | 'source-mismatch'
  | 'storage-failed';

export interface LinkedObjectPersistentHandleLinkResultV1 {
  readonly state: LinkedObjectPersistentHandleLinkStateV1;
  readonly layer: LinkedObjectLayerV1;
  readonly handlePersisted: boolean;
  readonly sourceHash: string | null;
  readonly message: string | null;
}

const DB_NAME = 'illustro-linked-object-handles-v1';
const STORE_NAME = 'handles';

function handleKey(projectId: ProjectId, objectId: ObjectId): string {
  return `${projectId}/${objectId}`;
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.addEventListener('success', () => resolve(request.result), { once: true });
    request.addEventListener(
      'error',
      () => reject(request.error ?? new Error('IndexedDB request failed')),
      {
        once: true,
      },
    );
  });
}

export class IndexedDbLinkedObjectExternalHandleStoreV1
  implements LinkedObjectExternalHandleStoreV1
{
  readonly #factory: IDBFactory;
  #database: Promise<IDBDatabase> | null = null;

  constructor(factory: IDBFactory = indexedDB) {
    this.#factory = factory;
  }

  #open(): Promise<IDBDatabase> {
    if (this.#database !== null) return this.#database;
    this.#database = new Promise((resolve, reject) => {
      const request = this.#factory.open(DB_NAME, 1);
      request.addEventListener(
        'upgradeneeded',
        () => {
          const database = request.result;
          if (!database.objectStoreNames.contains(STORE_NAME))
            database.createObjectStore(STORE_NAME);
        },
        { once: true },
      );
      request.addEventListener('success', () => resolve(request.result), { once: true });
      request.addEventListener(
        'error',
        () => reject(request.error ?? new Error('unable to open linked-object handle store')),
        { once: true },
      );
    });
    return this.#database;
  }

  async load(
    projectId: ProjectId,
    objectId: ObjectId,
  ): Promise<LinkedObjectExternalHandleV1 | null> {
    const database = await this.#open();
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const result = await requestResult(
      transaction.objectStore(STORE_NAME).get(handleKey(projectId, objectId)),
    );
    return (result as LinkedObjectExternalHandleV1 | undefined) ?? null;
  }

  async save(
    projectId: ProjectId,
    objectId: ObjectId,
    handle: LinkedObjectExternalHandleV1,
  ): Promise<void> {
    const database = await this.#open();
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    await requestResult(
      transaction.objectStore(STORE_NAME).put(handle, handleKey(projectId, objectId)),
    );
  }

  async remove(projectId: ProjectId, objectId: ObjectId): Promise<void> {
    const database = await this.#open();
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    await requestResult(transaction.objectStore(STORE_NAME).delete(handleKey(projectId, objectId)));
  }
}

function ownedBuffer(buffer: ArrayBuffer): ArrayBuffer {
  return buffer.slice(0);
}

async function sha256Hex(file: LinkedObjectExternalFileV1): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', ownedBuffer(await file.arrayBuffer()));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function inferFormat(file: LinkedObjectExternalFileV1): string {
  const mime = file.type.trim().toLowerCase();
  if (mime.length > 0) return mime;
  const dot = file.name.lastIndexOf('.');
  return dot >= 0 && dot < file.name.length - 1
    ? file.name.slice(dot + 1).toLowerCase()
    : 'application/octet-stream';
}

async function permissionState(
  handle: LinkedObjectExternalHandleV1,
): Promise<'granted' | 'denied' | 'prompt'> {
  if (handle.queryPermission === undefined) return 'granted';
  return handle.queryPermission({ mode: 'read' });
}

function unavailableStage(
  layer: LinkedObjectLayerV1,
  state: Extract<LinkedObjectRefreshStateV1, 'missing' | 'permission-required' | 'permission-lost'>,
  message: string,
): LinkedObjectRefreshStageV1 {
  return Object.freeze({
    state,
    layer,
    handle: null,
    externalSource: layer.externalSource,
    candidateSnapshot: null,
    incompatibilities: Object.freeze([]),
    message,
  });
}

function persistentHandleLinkResult(
  layer: LinkedObjectLayerV1,
  state: LinkedObjectPersistentHandleLinkStateV1,
  handlePersisted: boolean,
  sourceHash: string | null,
  message: string | null,
): LinkedObjectPersistentHandleLinkResultV1 {
  return Object.freeze({ state, layer, handlePersisted, sourceHash, message });
}

function isMissingFileError(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === 'NotFoundError' || error.name === 'NotReadableError')
  );
}

export class LinkedObjectExternalControllerV1 {
  readonly #store: LinkedObjectExternalHandleStoreV1;
  readonly #importer: LinkedObjectExternalImporterV1;

  constructor(input: {
    readonly store: LinkedObjectExternalHandleStoreV1;
    readonly importer: LinkedObjectExternalImporterV1;
  }) {
    this.#store = input.store;
    this.#importer = input.importer;
  }

  async #stageFromHandle(
    layer: LinkedObjectLayerV1,
    handle: LinkedObjectExternalHandleV1,
  ): Promise<LinkedObjectRefreshStageV1> {
    const permission = await permissionState(handle);
    if (permission === 'denied') {
      return unavailableStage(
        layer,
        'permission-lost',
        'External source permission was lost; embedded snapshot remains active.',
      );
    }
    if (permission === 'prompt') {
      return unavailableStage(
        layer,
        'permission-required',
        'External source permission must be granted before refresh.',
      );
    }

    let file: LinkedObjectExternalFileV1;
    try {
      file = await handle.getFile();
    } catch (error) {
      if (isMissingFileError(error)) {
        return unavailableStage(
          layer,
          'missing',
          'External source is missing; embedded snapshot remains active.',
        );
      }
      throw error;
    }

    const sourceHash = await sha256Hex(file);
    if (layer.externalSource?.sourceHash === sourceHash) {
      return Object.freeze({
        state: 'unchanged',
        layer,
        handle,
        externalSource: layer.externalSource,
        candidateSnapshot: null,
        incompatibilities: Object.freeze([]),
        message: null,
      });
    }

    try {
      const imported = await this.#importer.importExternal(file);
      const externalSource = Object.freeze({
        originalName: file.name,
        format: imported.format?.trim() || inferFormat(file),
        sourceHash,
      });
      return Object.freeze({
        state: 'ready',
        layer,
        handle,
        externalSource,
        candidateSnapshot: imported.embeddedSnapshot,
        incompatibilities: Object.freeze([...(imported.incompatibilities ?? [])]),
        message: null,
      });
    } catch (error) {
      return Object.freeze({
        state: 'invalid',
        layer,
        handle,
        externalSource: layer.externalSource,
        candidateSnapshot: null,
        incompatibilities: Object.freeze([]),
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async linkPersistentHandle(input: {
    readonly projectId: ProjectId;
    readonly layer: LinkedObjectLayerV1;
    readonly handle: LinkedObjectExternalHandleV1;
  }): Promise<LinkedObjectPersistentHandleLinkResultV1> {
    const externalSource = input.layer.externalSource;
    if (externalSource === null) {
      return persistentHandleLinkResult(
        input.layer,
        'untracked',
        false,
        null,
        'Linked object has no external source descriptor; canonical embedded snapshot remains active.',
      );
    }

    const permission = await permissionState(input.handle);
    if (permission === 'denied') {
      return persistentHandleLinkResult(
        input.layer,
        'permission-lost',
        false,
        null,
        'External source permission is unavailable; canonical embedded snapshot remains active.',
      );
    }
    if (permission === 'prompt') {
      return persistentHandleLinkResult(
        input.layer,
        'permission-required',
        false,
        null,
        'External source permission must be granted before retaining the optional persistent link.',
      );
    }

    let file: LinkedObjectExternalFileV1;
    try {
      file = await input.handle.getFile();
    } catch (error) {
      if (isMissingFileError(error)) {
        return persistentHandleLinkResult(
          input.layer,
          'missing',
          false,
          null,
          'External source is missing; canonical embedded snapshot remains active.',
        );
      }
      throw error;
    }

    const sourceHash = await sha256Hex(file);
    if (sourceHash !== externalSource.sourceHash) {
      return persistentHandleLinkResult(
        input.layer,
        'source-mismatch',
        false,
        sourceHash,
        'Selected handle does not match the linked object external source; no persistent link was stored.',
      );
    }

    try {
      await this.#store.save(input.projectId, input.layer.objectId, input.handle);
      return persistentHandleLinkResult(input.layer, 'linked', true, sourceHash, null);
    } catch (error) {
      return persistentHandleLinkResult(
        input.layer,
        'storage-failed',
        false,
        sourceHash,
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  async stageRefresh(input: {
    readonly projectId: ProjectId;
    readonly layer: LinkedObjectLayerV1;
  }): Promise<LinkedObjectRefreshStageV1> {
    const handle = await this.#store.load(input.projectId, input.layer.objectId);
    if (handle === null) {
      return unavailableStage(
        input.layer,
        'missing',
        'No persistent external handle is available; embedded snapshot remains active.',
      );
    }
    return this.#stageFromHandle(input.layer, handle);
  }

  async stageRelink(input: {
    readonly layer: LinkedObjectLayerV1;
    readonly handle: LinkedObjectExternalHandleV1;
  }): Promise<LinkedObjectRefreshStageV1> {
    return this.#stageFromHandle(input.layer, input.handle);
  }

  async requestReadPermission(handle: LinkedObjectExternalHandleV1): Promise<boolean> {
    if (handle.requestPermission === undefined) return true;
    return (await handle.requestPermission({ mode: 'read' })) === 'granted';
  }

  async commit(input: {
    readonly projectId: ProjectId;
    readonly stage: LinkedObjectRefreshStageV1;
    readonly commitTransaction: (nextLayer: LinkedObjectLayerV1) => Promise<void>;
  }): Promise<LinkedObjectRefreshCommitResultV1> {
    const { stage } = input;
    if (
      stage.state !== 'ready' ||
      stage.candidateSnapshot === null ||
      stage.externalSource === null ||
      stage.handle === null
    ) {
      throw new Error('only a validated ready linked-object refresh stage can be committed');
    }

    const nextLayer: LinkedObjectLayerV1 = Object.freeze({
      ...stage.layer,
      revision: nextRevision(stage.layer.revision),
      embeddedSnapshot: stage.candidateSnapshot,
      externalSource: stage.externalSource,
    });
    await input.commitTransaction(nextLayer);

    let handlePersisted = true;
    try {
      await this.#store.save(input.projectId, nextLayer.objectId, stage.handle);
    } catch {
      handlePersisted = false;
    }
    return Object.freeze({ layer: nextLayer, handlePersisted });
  }

  async detachExternalAcceleration(input: {
    readonly projectId: ProjectId;
    readonly layer: LinkedObjectLayerV1;
  }): Promise<void> {
    await this.#store.remove(input.projectId, input.layer.objectId);
  }
}
