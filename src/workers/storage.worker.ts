import '../storage/history-worker-extension.js';
import '../storage/project-worker-extension.js';
import '../storage/storage-maintenance-worker-extension.js';
import {
  getDurableStorageGrowthGuard,
  STORAGE_TRANSACTION_WRITE_OVERHEAD_BYTES,
} from '../storage/storage-growth-guard.js';
import { getProjectWriteCoordinator } from '../storage/project-coordination.js';
import { isCommandTransactionId, type CommandTransactionId } from '../domain/command-registry.js';
import {
  parseProjectId,
  parseRevision,
  type ProjectId,
  type Revision,
} from '../domain/identity.js';
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
import {
  ProjectPersistenceSchedulerV1,
  type PersistenceFlushReasonV1,
} from '../storage/persistence-scheduler.js';
import { probeSyncAccessHandle } from '../storage/sync-access.js';
import {
  persistMaskTile,
  persistRasterTile,
  type TilePixelFormatV1,
} from '../storage/tile-codec.js';
import {
  commitProjectTransaction,
  type ProjectTransactionCommitResultV1,
} from '../storage/transaction.js';

type WorkerMessageEvent<T> = { readonly data: T };
type WorkerScope = {
  addEventListener(type: 'message', listener: (event: WorkerMessageEvent<unknown>) => void): void;
  postMessage(message: unknown): void;
};

interface ScheduledCommitV1 {
  readonly projectId: ProjectId;
  readonly transactionId: CommandTransactionId;
  readonly sequence: number;
  readonly documentRevision: Revision;
  readonly snapshot: unknown;
  readonly createdAt?: string;
}

type StorageRequest =
  | { readonly type: 'ping' }
  | {
      readonly type: 'storage.project.ensure';
      readonly requestId: string;
      readonly projectId: string;
    }
  | {
      readonly type: 'storage.object.put';
      readonly requestId: string;
      readonly bytes: ArrayBuffer;
    }
  | {
      readonly type: 'storage.tile.put';
      readonly requestId: string;
      readonly kind: 'raster' | 'mask';
      readonly width: number;
      readonly height: number;
      readonly pixelFormat: TilePixelFormatV1;
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
    }
  | {
      readonly type: 'storage.transaction.commit';
      readonly requestId: string;
      readonly projectId: string;
      readonly transactionId: string;
      readonly sequence: number;
      readonly documentRevision: number;
      readonly snapshot: unknown;
      readonly createdAt?: string;
    }
  | {
      readonly type: 'storage.persistence.markDirty';
      readonly requestId: string;
      readonly projectId: string;
      readonly transactionId: string;
      readonly sequence: number;
      readonly documentRevision: number;
      readonly snapshot: unknown;
      readonly createdAt?: string;
    }
  | {
      readonly type: 'storage.persistence.flush';
      readonly requestId: string;
      readonly projectId: string;
      readonly reason: PersistenceFlushReasonV1;
    };

const scope = globalThis as unknown as WorkerScope;
const projects = new Map<string, Promise<ProjectDirectoryLayoutV1>>();
const persistenceSchedulers = new Map<
  string,
  ProjectPersistenceSchedulerV1<ScheduledCommitV1, ProjectTransactionCommitResultV1>
>();

const projectWriteCoordinator = getProjectWriteCoordinator();
const storageGrowthGuard = getDurableStorageGrowthGuard();
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

function isFlushReason(value: unknown): value is PersistenceFlushReasonV1 {
  return value === 'recovery' || value === 'autosave';
}

function isTilePixelFormat(value: unknown): value is TilePixelFormatV1 {
  return (
    value === 'r8-unorm' ||
    value === 'r16-float' ||
    value === 'rgba8-unorm' ||
    value === 'rgba16-float'
  );
}

function isRasterPixelFormat(value: TilePixelFormatV1): value is 'rgba8-unorm' | 'rgba16-float' {
  return value === 'rgba8-unorm' || value === 'rgba16-float';
}

function isMaskPixelFormat(value: TilePixelFormatV1): value is 'r8-unorm' | 'r16-float' {
  return value === 'r8-unorm' || value === 'r16-float';
}

function parseRequest(value: unknown): StorageRequest | null {
  if (!isRecord(value) || typeof value.type !== 'string') return null;
  if (value.type === 'ping') return { type: 'ping' };
  if (typeof value.requestId !== 'string') return null;

  if (value.type === 'storage.project.ensure' && typeof value.projectId === 'string') {
    return { type: value.type, requestId: value.requestId, projectId: value.projectId };
  }
  if (value.type === 'storage.object.put' && value.bytes instanceof ArrayBuffer) {
    return { type: value.type, requestId: value.requestId, bytes: value.bytes };
  }
  if (
    value.type === 'storage.tile.put' &&
    (value.kind === 'raster' || value.kind === 'mask') &&
    typeof value.width === 'number' &&
    typeof value.height === 'number' &&
    isTilePixelFormat(value.pixelFormat) &&
    value.bytes instanceof ArrayBuffer
  ) {
    return {
      type: value.type,
      requestId: value.requestId,
      kind: value.kind,
      width: value.width,
      height: value.height,
      pixelFormat: value.pixelFormat,
      bytes: value.bytes,
    };
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
  if (
    (value.type === 'storage.transaction.commit' ||
      value.type === 'storage.persistence.markDirty') &&
    typeof value.projectId === 'string' &&
    typeof value.transactionId === 'string' &&
    typeof value.sequence === 'number' &&
    typeof value.documentRevision === 'number' &&
    (value.createdAt === undefined || typeof value.createdAt === 'string')
  ) {
    return {
      type: value.type,
      requestId: value.requestId,
      projectId: value.projectId,
      transactionId: value.transactionId,
      sequence: value.sequence,
      documentRevision: value.documentRevision,
      snapshot: value.snapshot,
      ...(value.createdAt === undefined ? {} : { createdAt: value.createdAt }),
    };
  }
  if (
    value.type === 'storage.persistence.flush' &&
    typeof value.projectId === 'string' &&
    isFlushReason(value.reason)
  ) {
    return {
      type: value.type,
      requestId: value.requestId,
      projectId: value.projectId,
      reason: value.reason,
    };
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

function postStorageError(operation: string, error: unknown): void {
  scope.postMessage({
    type: 'storage.persistence.error',
    error: createStructuredErrorRecord({
      code: 'storage.persistence.failed',
      severity: 'error',
      operation,
      messageKey: 'error.storage.persistence.failed',
      recoverability: 'retryable',
      details: { message: error instanceof Error ? error.message : String(error) },
    }),
  });
}

function persistenceScheduler(
  projectIdValue: string,
): ProjectPersistenceSchedulerV1<ScheduledCommitV1, ProjectTransactionCommitResultV1> {
  const projectId = parseProjectId(projectIdValue);
  const existing = persistenceSchedulers.get(projectId);
  if (existing !== undefined) return existing;

  const created = new ProjectPersistenceSchedulerV1<
    ScheduledCommitV1,
    ProjectTransactionCommitResultV1
  >({
    async persist(reason, payload) {
      projectWriteCoordinator.assertWriteOwnership(payload.projectId);
      await storageGrowthGuard.assertJsonGrowth(
        payload.snapshot,
        STORAGE_TRANSACTION_WRITE_OVERHEAD_BYTES,
      );
      const [root, project] = await Promise.all([rootPromise, projectLayout(payload.projectId)]);
      const result = await commitProjectTransaction(root, project, {
        transactionId: payload.transactionId,
        sequence: payload.sequence,
        documentRevision: payload.documentRevision,
        snapshot: payload.snapshot,
        ...(payload.createdAt === undefined ? {} : { createdAt: payload.createdAt }),
      });
      scope.postMessage({
        type: 'storage.persistence.flushed',
        reason,
        projectId: payload.projectId,
        result,
      });
      return result;
    },
    onAutosaveSettled(payload, result) {
      scope.postMessage({
        type: 'storage.autosave.settled',
        projectId: payload.projectId,
        transactionId: payload.transactionId,
        result,
      });
    },
    onError(reason, error) {
      postStorageError(`storage.persistence.${reason}`, error);
    },
  });
  persistenceSchedulers.set(projectId, created);
  return created;
}

function scheduledCommit(request: {
  projectId: string;
  transactionId: string;
  sequence: number;
  documentRevision: number;
  snapshot: unknown;
  createdAt?: string;
}): ScheduledCommitV1 {
  if (!isCommandTransactionId(request.transactionId)) {
    throw new TypeError('transactionId must be a UUID');
  }
  return Object.freeze({
    projectId: parseProjectId(request.projectId),
    transactionId: request.transactionId,
    sequence: request.sequence,
    documentRevision: parseRevision(request.documentRevision),
    snapshot: request.snapshot,
    ...(request.createdAt === undefined ? {} : { createdAt: request.createdAt }),
  });
}

function postFailure(requestId: string, operation: string, error: unknown): void {
  const quotaError = error instanceof DOMException && error.name === 'QuotaExceededError';
  scope.postMessage({
    type: 'storage.response',
    requestId,
    ok: false,
    error: createStructuredErrorRecord({
      code: quotaError ? 'storage.quota.unsafeGrowth' : 'storage.request.failed',
      severity: 'error',
      operation,
      messageKey: quotaError ? 'error.storage.quota.unsafeGrowth' : 'error.storage.request.failed',
      recoverability: quotaError ? 'recoverable' : 'retryable',
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
    if (request.type === 'storage.project.ensure') {
      const result = await projectWriteCoordinator.runExclusive(request.projectId, async () => {
        const layout = await projectLayout(request.projectId);
        return { projectId: layout.projectId };
      });
      scope.postMessage({
        type: 'storage.response',
        requestId: request.requestId,
        ok: true,
        result,
      });
      return;
    }

    if (request.type === 'storage.object.put') {
      await storageGrowthGuard.assertRawGrowth(request.bytes.byteLength);
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

    if (request.type === 'storage.tile.put') {
      await storageGrowthGuard.assertRawGrowth(request.bytes.byteLength);
      const root = await rootPromise;
      const result =
        request.kind === 'raster'
          ? isRasterPixelFormat(request.pixelFormat)
            ? await persistRasterTile(root, {
                width: request.width,
                height: request.height,
                pixelFormat: request.pixelFormat,
                bytes: request.bytes,
              })
            : (() => {
                throw new TypeError('raster tile requires RGBA pixel format');
              })()
          : isMaskPixelFormat(request.pixelFormat)
            ? await persistMaskTile(root, {
                width: request.width,
                height: request.height,
                pixelFormat: request.pixelFormat,
                bytes: request.bytes,
              })
            : (() => {
                throw new TypeError('mask tile requires single-channel pixel format');
              })();
      scope.postMessage({
        type: 'storage.response',
        requestId: request.requestId,
        ok: true,
        result,
      });
      return;
    }

    if (request.type === 'storage.entity.persist') {
      projectWriteCoordinator.assertWriteOwnership(request.projectId);
      await storageGrowthGuard.assertJsonGrowth(request.snapshot);
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

    if (request.type === 'storage.transaction.commit') {
      projectWriteCoordinator.assertWriteOwnership(request.projectId);
      await storageGrowthGuard.assertJsonGrowth(
        request.snapshot,
        STORAGE_TRANSACTION_WRITE_OVERHEAD_BYTES,
      );
      const payload = scheduledCommit(request);
      const [root, project] = await Promise.all([rootPromise, projectLayout(payload.projectId)]);
      const result = await commitProjectTransaction(root, project, payload);
      scope.postMessage({
        type: 'storage.response',
        requestId: request.requestId,
        ok: true,
        result,
      });
      return;
    }

    if (request.type === 'storage.persistence.markDirty') {
      projectWriteCoordinator.assertWriteOwnership(request.projectId);
      await storageGrowthGuard.assertJsonGrowth(
        request.snapshot,
        STORAGE_TRANSACTION_WRITE_OVERHEAD_BYTES,
      );
      const payload = scheduledCommit(request);
      const scheduler = persistenceScheduler(payload.projectId);
      const generation = scheduler.markDirty(payload);
      scope.postMessage({
        type: 'storage.response',
        requestId: request.requestId,
        ok: true,
        result: { generation, state: scheduler.state() },
      });
      return;
    }

    if (request.type === 'storage.persistence.flush') {
      projectWriteCoordinator.assertWriteOwnership(request.projectId);
      const scheduler = persistenceScheduler(request.projectId);
      await scheduler.flushNow(request.reason);
      scope.postMessage({
        type: 'storage.response',
        requestId: request.requestId,
        ok: true,
        result: scheduler.state(),
      });
      return;
    }

    const supported = await projectWriteCoordinator.runExclusive(request.projectId, async () => {
      const project = await projectLayout(request.projectId);
      return probeSyncAccessHandle(project.directories.tmp);
    });
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
