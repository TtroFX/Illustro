import {
  parseHistorySpillReferenceV1,
  parseHistorySpineStateV1,
  parseHistoryTransactionV1,
} from '../history/history.js';
import { parseProjectId } from '../domain/identity.js';
import { createStructuredErrorRecord } from '../domain/reports.js';
import { ProjectHistoryStoreV1 } from './history-store.js';
import {
  ensureProjectDirectoryLayout,
  openIllustroOpfsRoot,
  type ProjectDirectoryLayoutV1,
} from './opfs-layout.js';
import { getProjectWriteCoordinator } from './project-coordination.js';
import { getDurableStorageGrowthGuard } from './storage-growth-guard.js';

type WorkerMessageEvent<T> = { readonly data: T };
type WorkerScope = {
  addEventListener(type: 'message', listener: (event: WorkerMessageEvent<unknown>) => void): void;
  postMessage(message: unknown): void;
};

type HistoryStorageRequestV1 =
  | {
      readonly type: 'storage.history.spill';
      readonly requestId: string;
      readonly projectId: string;
      readonly transactions: readonly unknown[];
    }
  | {
      readonly type: 'storage.history.save';
      readonly requestId: string;
      readonly projectId: string;
      readonly state: unknown;
    }
  | {
      readonly type: 'storage.history.load';
      readonly requestId: string;
      readonly projectId: string;
    }
  | {
      readonly type: 'storage.history.loadTransaction';
      readonly requestId: string;
      readonly projectId: string;
      readonly reference: unknown;
    };

const scope = globalThis as unknown as WorkerScope;
const rootPromise = openIllustroOpfsRoot();
const projects = new Map<string, Promise<ProjectDirectoryLayoutV1>>();
const coordinator = getProjectWriteCoordinator();
const storageGrowthGuard = getDurableStorageGrowthGuard();

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseRequest(value: unknown): HistoryStorageRequestV1 | null {
  if (
    !isRecord(value) ||
    typeof value.type !== 'string' ||
    typeof value.requestId !== 'string' ||
    typeof value.projectId !== 'string'
  ) {
    return null;
  }
  if (value.type === 'storage.history.spill' && Array.isArray(value.transactions)) {
    return {
      type: value.type,
      requestId: value.requestId,
      projectId: value.projectId,
      transactions: value.transactions,
    };
  }
  if (value.type === 'storage.history.save') {
    return {
      type: value.type,
      requestId: value.requestId,
      projectId: value.projectId,
      state: value.state,
    };
  }
  if (value.type === 'storage.history.load') {
    return { type: value.type, requestId: value.requestId, projectId: value.projectId };
  }
  if (value.type === 'storage.history.loadTransaction') {
    return {
      type: value.type,
      requestId: value.requestId,
      projectId: value.projectId,
      reference: value.reference,
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

function postFailure(request: HistoryStorageRequestV1, error: unknown): void {
  const quotaError = error instanceof DOMException && error.name === 'QuotaExceededError';
  scope.postMessage({
    type: 'storage.response',
    requestId: request.requestId,
    ok: false,
    error: createStructuredErrorRecord({
      code: quotaError ? 'storage.quota.unsafeGrowth' : 'storage.history.failed',
      severity: 'error',
      operation: request.type,
      messageKey: quotaError ? 'error.storage.quota.unsafeGrowth' : 'error.storage.history.failed',
      recoverability: quotaError ? 'recoverable' : 'retryable',
      details: { message: error instanceof Error ? error.message : String(error) },
    }),
  });
}

async function handleRequest(request: HistoryStorageRequestV1): Promise<void> {
  try {
    const projectId = parseProjectId(request.projectId);
    const project = await projectLayout(projectId);
    const store = new ProjectHistoryStoreV1(project);
    let result: unknown;
    if (request.type === 'storage.history.spill') {
      coordinator.assertWriteOwnership(projectId);
      const transactions = request.transactions.map((transaction) =>
        parseHistoryTransactionV1(transaction),
      );
      await storageGrowthGuard.assertJsonGrowth(transactions);
      result = await store.spillTransactions(transactions);
      coordinator.announce('project.changed', projectId, { subsystem: 'history', action: 'spill' });
    } else if (request.type === 'storage.history.save') {
      coordinator.assertWriteOwnership(projectId);
      const state = parseHistorySpineStateV1(request.state);
      await storageGrowthGuard.assertJsonGrowth(state);
      result = { checksum: await store.saveState(state) };
      coordinator.announce('project.save-status', projectId, {
        subsystem: 'history',
        status: 'saved',
      });
    } else if (request.type === 'storage.history.load') {
      result = await store.loadState();
    } else {
      result = await store.loadTransaction(parseHistorySpillReferenceV1(request.reference));
    }
    scope.postMessage({
      type: 'storage.response',
      requestId: request.requestId,
      ok: true,
      result,
    });
  } catch (error) {
    postFailure(request, error);
  }
}

scope.addEventListener('message', (event) => {
  const request = parseRequest(event.data);
  if (request === null) return;
  void handleRequest(request);
});
