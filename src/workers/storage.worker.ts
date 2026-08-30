import { parseProjectId, parseRevision } from '../domain/identity.js';
import { createStructuredErrorRecord } from '../domain/reports.js';
import {
  ENTITY_KINDS,
  persistEntityRevision,
  type EntityKind,
} from '../storage/entity-revision-store.js';
import { putImmutableObject } from '../storage/immutable-object-store.js';
import {
  ensureProjectDirectoryLayout,
  openIllustroOpfsRoot,
  type IllustroOpfsRootV1,
  type ProjectDirectoryLayoutV1,
} from '../storage/opfs-layout.js';
import { probeSyncAccessHandle } from '../storage/sync-access.js';

type WorkerMessageEvent<T> = { readonly data: T };
type WorkerScope = {
  addEventListener(type: 'message', listener: (event: WorkerMessageEvent<unknown>) => void): void;
  postMessage(message: unknown): void;
};

type StorageRequest =
  | { readonly type: 'ping' }
  | {
      readonly type: 'storage.project.open';
      readonly requestId: string;
      readonly projectId: string;
    }
  | {
      readonly type: 'storage.object.put';
      readonly requestId: string;
      readonly bytes: ArrayBuffer;
    }
  | {
      readonly type: 'storage.entity.persist';
      readonly requestId: string;
      readonly projectId: string;
      readonly kind: EntityKind;
      readonly entityId: string;
      readonly revision: number;
      readonly snapshot: unknown;
    }
  | {
      readonly type: 'storage.sync.probe';
      readonly requestId: string;
      readonly projectId: string;
    };

const scope = globalThis as unknown as WorkerScope;
const projects = new Map<string, Promise<ProjectDirectoryLayoutV1>>();

const rootPromise: Promise<IllustroOpfsRootV1> = openIllustroOpfsRoot();
void rootPromise.then(
  () => scope.postMessage({ type: 'worker.storage.ready', opfs: true }),
  (error: unknown) =>
    scope.postMessage({
      type: 'worker.storage.error',
      error: createStructuredErrorRecord({
        code: 'storage.opfs.initializeFailed',
        severity: 'error',
        operation: 'storage.opfs.initialize',
        messageKey: 'error.storage.opfs.initializeFailed',
        recoverability: 'retryable',
        details: { message: error instanceof Error ? error.message : String(error) },
      }),
    }),
);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseRequest(value: unknown): StorageRequest | null {
  if (!isRecord(value) || typeof value.type !== 'string') return null;
  if (value.type === 'ping') return { type: 'ping' };
  if (typeof value.requestId !== 'string') return null;

  if (value.type === 'storage.project.open' && typeof value.projectId === 'string') {
    return { type: value.type, requestId: value.requestId, projectId: value.projectId };
  }
  if (value.type === 'storage.object.put' && value.bytes instanceof ArrayBuffer) {
    return { type: value.type, requestId: value.requestId, bytes: value.bytes };
  }
  if (
    value.type === 'storage.entity.persist' &&
    typeof value.projectId === 'string' &&
    typeof value.kind === 'string' &&
    ENTITY_KINDS.includes(value.kind as EntityKind) &&
    typeof value.entityId === 'string' &&
    typeof value.revision === 'number'
  ) {
    return {
      type: value.type,
      requestId: value.requestId,
      projectId: value.projectId,
      kind: value.kind as EntityKind,
      entityId: value.entityId,
      revision: value.revision,
      snapshot: value.snapshot,
    };
  }
  if (value.type === 'storage.sync.probe' && typeof value.projectId === 'string') {
    return { type: value.type, requestId: value.requestId, projectId: value.projectId };
  }
  return null;
}

async function projectLayout(projectIdValue: string): Promise<ProjectDirectoryLayoutV1> {
  const projectId = parseProjectId(projectIdValue);
  let pending = projects.get(projectId);
  if (pending === undefined) {
    pending = rootPromise.then((root) => ensureProjectDirectoryLayout(root, projectId));
    projects.set(projectId, pending);
  }
  return pending;
}

function postFailure(requestId: string, operation: string, error: unknown): void {
  scope.postMessage({
    type: 'storage.response',
    requestId,
    ok: false,
    error: createStructuredErrorRecord({
      code: 'storage.request.failed',
      severity: 'error',
      operation,
      messageKey: 'error.storage.request.failed',
      recoverability: 'retryable',
      details: { message: error instanceof Error ? error.message : String(error) },
    }),
  });
}

async function handleRequest(request: StorageRequest): Promise<void> {
  if (request.type === 'ping') {
    scope.postMessage({ type: 'pong', subsystem: 'storage' });
    return;
  }

  try {
    if (request.type === 'storage.project.open') {
      const layout = await projectLayout(request.projectId);
      scope.postMessage({
        type: 'storage.response',
        requestId: request.requestId,
        ok: true,
        result: { projectId: layout.projectId },
      });
      return;
    }

    if (request.type === 'storage.object.put') {
      const root = await rootPromise;
      const result = await putImmutableObject(root.sha256Objects, request.bytes);
      scope.postMessage({
        type: 'storage.response',
        requestId: request.requestId,
        ok: true,
        result,
      });
      return;
    }

    if (request.type === 'storage.entity.persist') {
      const [root, project] = await Promise.all([rootPromise, projectLayout(request.projectId)]);
      const result = await persistEntityRevision(root, project, {
        kind: request.kind,
        entityId: request.entityId,
        revision: parseRevision(request.revision),
        snapshot: request.snapshot,
      });
      scope.postMessage({
        type: 'storage.response',
        requestId: request.requestId,
        ok: true,
        result: result.record,
      });
      return;
    }

    const project = await projectLayout(request.projectId);
    const supported = await probeSyncAccessHandle(project.directories.tmp);
    scope.postMessage({
      type: 'storage.response',
      requestId: request.requestId,
      ok: true,
      result: { supported },
    });
  } catch (error) {
    postFailure(request.requestId, request.type, error);
  }
}

scope.addEventListener('message', (event) => {
  const request = parseRequest(event.data);
  if (request === null) return;
  void handleRequest(request);
});
