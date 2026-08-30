import { parseProjectId } from '../domain/identity.js';
import { createStructuredErrorRecord } from '../domain/reports.js';
import {
  collectProjectGarbageCollectionRootsV1,
  planGarbageCollectionV1,
  type AdditionalGarbageCollectionRootsV1,
} from './garbage-collection.js';
import {
  ensureProjectDirectoryLayout,
  openIllustroOpfsRoot,
  type ProjectDirectoryLayoutV1,
} from './opfs-layout.js';
import { getStorageQuotaMonitor } from './storage-quota.js';

type WorkerMessageEvent<T> = { readonly data: T };
type WorkerScope = {
  addEventListener(type: 'message', listener: (event: WorkerMessageEvent<unknown>) => void): void;
  postMessage(message: unknown): void;
};

type StorageMaintenanceRequestV1 =
  | { readonly type: 'storage.quota.inspect'; readonly requestId: string }
  | { readonly type: 'storage.quota.persist'; readonly requestId: string }
  | {
      readonly type: 'storage.quota.preflight';
      readonly requestId: string;
      readonly additionalBytes: number;
      readonly safeExport?: boolean;
    }
  | {
      readonly type: 'storage.gc.plan';
      readonly requestId: string;
      readonly projectId: string;
      readonly roots: AdditionalGarbageCollectionRootsV1;
    };

const scope = globalThis as unknown as WorkerScope;
const quotaMonitor = getStorageQuotaMonitor();
const rootPromise = openIllustroOpfsRoot();
const projects = new Map<string, Promise<ProjectDirectoryLayoutV1>>();

void quotaMonitor.requestPersistence().then(
  (result) => scope.postMessage({ type: 'worker.storage.persistence', result }),
  (error: unknown) =>
    scope.postMessage({
      type: 'worker.storage.persistence-error',
      error: createStructuredErrorRecord({
        code: 'storage.persistence.requestFailed',
        severity: 'warning',
        operation: 'storage.quota.persist',
        messageKey: 'error.storage.persistence.requestFailed',
        recoverability: 'retryable',
        details: { message: error instanceof Error ? error.message : String(error) },
      }),
    }),
);

void quotaMonitor.inspect().then(
  (result) => scope.postMessage({ type: 'worker.storage.quota', result }),
  () => undefined,
);

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringArray(value: unknown): readonly string[] | null {
  if (value === undefined) return Object.freeze([]);
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) return null;
  return Object.freeze([...value] as string[]);
}

function parseAdditionalRoots(value: unknown): AdditionalGarbageCollectionRootsV1 | null {
  if (value === undefined) return Object.freeze({});
  if (!isRecord(value)) return null;
  const retainedCheckpoints = stringArray(value.retainedCheckpoints);
  const retainedHistory = stringArray(value.retainedHistory);
  const timelapseAndResources = stringArray(value.timelapseAndResources);
  const activeTransaction = stringArray(value.activeTransaction);
  if (
    retainedCheckpoints === null ||
    retainedHistory === null ||
    timelapseAndResources === null ||
    activeTransaction === null
  ) {
    return null;
  }
  return Object.freeze({
    retainedCheckpoints,
    retainedHistory,
    timelapseAndResources,
    activeTransaction,
  });
}

function parseRequest(value: unknown): StorageMaintenanceRequestV1 | null {
  if (!isRecord(value) || typeof value.type !== 'string' || typeof value.requestId !== 'string') {
    return null;
  }
  if (value.type === 'storage.quota.inspect' || value.type === 'storage.quota.persist') {
    return { type: value.type, requestId: value.requestId };
  }
  if (
    value.type === 'storage.quota.preflight' &&
    typeof value.additionalBytes === 'number' &&
    (value.safeExport === undefined || typeof value.safeExport === 'boolean')
  ) {
    return {
      type: value.type,
      requestId: value.requestId,
      additionalBytes: value.additionalBytes,
      ...(value.safeExport === undefined ? {} : { safeExport: value.safeExport }),
    };
  }
  if (value.type === 'storage.gc.plan' && typeof value.projectId === 'string') {
    const roots = parseAdditionalRoots(value.roots);
    if (roots === null) return null;
    return {
      type: value.type,
      requestId: value.requestId,
      projectId: value.projectId,
      roots,
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

function postFailure(request: StorageMaintenanceRequestV1, error: unknown): void {
  scope.postMessage({
    type: 'storage.response',
    requestId: request.requestId,
    ok: false,
    error: createStructuredErrorRecord({
      code: 'storage.maintenance.failed',
      severity: error instanceof DOMException && error.name === 'QuotaExceededError' ? 'error' : 'warning',
      operation: request.type,
      messageKey: 'error.storage.maintenance.failed',
      recoverability: 'retryable',
      details: { message: error instanceof Error ? error.message : String(error) },
    }),
  });
}

async function handleRequest(request: StorageMaintenanceRequestV1): Promise<void> {
  try {
    let result: unknown;
    if (request.type === 'storage.quota.inspect') {
      result = await quotaMonitor.inspect();
    } else if (request.type === 'storage.quota.persist') {
      result = await quotaMonitor.requestPersistence();
    } else if (request.type === 'storage.quota.preflight') {
      result = await quotaMonitor.preflight(request.additionalBytes, {
        safeExport: request.safeExport === true,
      });
    } else {
      const [root, project] = await Promise.all([rootPromise, projectLayout(request.projectId)]);
      const roots = await collectProjectGarbageCollectionRootsV1(project, request.roots);
      result = await planGarbageCollectionV1(root, roots);
    }
    scope.postMessage({ type: 'storage.response', requestId: request.requestId, ok: true, result });
  } catch (error) {
    postFailure(request, error);
  }
}

scope.addEventListener('message', (event) => {
  const request = parseRequest(event.data);
  if (request === null) return;
  void handleRequest(request);
});
