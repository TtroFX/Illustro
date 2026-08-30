import {
  createProjectId,
  parseProjectId,
  parseResourceId,
  type ProjectId,
} from '../domain/identity.js';
import { createStructuredErrorRecord } from '../domain/reports.js';
import { getProjectWriteCoordinator, type ProjectAccessStateV1 } from './project-coordination.js';
import { LocalProjectLibraryV1 } from './project-library.js';
import { openIllustroOpfsRoot } from './opfs-layout.js';

type WorkerMessageEvent<T> = { readonly data: T };
type WorkerScope = {
  addEventListener(type: 'message', listener: (event: WorkerMessageEvent<unknown>) => void): void;
  postMessage(message: unknown): void;
};

type ProjectStorageRequestV1 =
  | {
      readonly type: 'storage.library.list';
      readonly requestId: string;
      readonly includeTrashed?: boolean;
    }
  | {
      readonly type: 'storage.project.create';
      readonly requestId: string;
      readonly name: string;
      readonly initialSnapshot: unknown;
      readonly projectId?: string;
      readonly documentRevision?: number;
      readonly previewResourceId?: string | null;
      readonly now?: string;
    }
  | {
      readonly type: 'storage.project.open' | 'storage.project.close';
      readonly requestId: string;
      readonly projectId: string;
    }
  | {
      readonly type: 'storage.project.rename';
      readonly requestId: string;
      readonly projectId: string;
      readonly name: string;
      readonly now?: string;
    }
  | {
      readonly type: 'storage.project.duplicate';
      readonly requestId: string;
      readonly projectId: string;
      readonly name?: string;
      readonly now?: string;
    }
  | {
      readonly type: 'storage.project.preview';
      readonly requestId: string;
      readonly projectId: string;
      readonly previewResourceId: string | null;
    }
  | {
      readonly type: 'storage.project.trash';
      readonly requestId: string;
      readonly projectId: string;
      readonly now?: string;
    }
  | {
      readonly type: 'storage.project.restore';
      readonly requestId: string;
      readonly projectId: string;
    };

const scope = globalThis as unknown as WorkerScope;
const libraryPromise = openIllustroOpfsRoot().then((root) => new LocalProjectLibraryV1(root));
const coordinator = getProjectWriteCoordinator();
coordinator.subscribe((event) => {
  scope.postMessage({ type: 'storage.project.event', event });
});

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function optionalTimestamp(value: unknown): string | undefined | null {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) return null;
  return value;
}

function parseRequest(value: unknown): ProjectStorageRequestV1 | null {
  if (!isRecord(value) || typeof value.type !== 'string' || typeof value.requestId !== 'string') {
    return null;
  }
  if (value.type === 'storage.library.list') {
    if (value.includeTrashed !== undefined && typeof value.includeTrashed !== 'boolean') {
      return null;
    }
    return {
      type: value.type,
      requestId: value.requestId,
      ...(value.includeTrashed === undefined ? {} : { includeTrashed: value.includeTrashed }),
    };
  }
  if (value.type === 'storage.project.create') {
    if (typeof value.name !== 'string') return null;
    if (value.projectId !== undefined && typeof value.projectId !== 'string') return null;
    if (value.documentRevision !== undefined && typeof value.documentRevision !== 'number') {
      return null;
    }
    if (
      value.previewResourceId !== undefined &&
      value.previewResourceId !== null &&
      typeof value.previewResourceId !== 'string'
    ) {
      return null;
    }
    const now = optionalTimestamp(value.now);
    if (now === null) return null;
    return {
      type: value.type,
      requestId: value.requestId,
      name: value.name,
      initialSnapshot: value.initialSnapshot,
      ...(value.projectId === undefined ? {} : { projectId: value.projectId }),
      ...(value.documentRevision === undefined ? {} : { documentRevision: value.documentRevision }),
      ...(value.previewResourceId === undefined
        ? {}
        : { previewResourceId: value.previewResourceId as string | null }),
      ...(now === undefined ? {} : { now }),
    };
  }
  if (
    (value.type === 'storage.project.open' ||
      value.type === 'storage.project.close' ||
      value.type === 'storage.project.restore') &&
    typeof value.projectId === 'string'
  ) {
    return { type: value.type, requestId: value.requestId, projectId: value.projectId };
  }
  if (
    (value.type === 'storage.project.rename' ||
      value.type === 'storage.project.duplicate' ||
      value.type === 'storage.project.trash') &&
    typeof value.projectId === 'string'
  ) {
    if (value.type === 'storage.project.rename' && typeof value.name !== 'string') return null;
    if (
      value.type === 'storage.project.duplicate' &&
      value.name !== undefined &&
      typeof value.name !== 'string'
    ) {
      return null;
    }
    const now = optionalTimestamp(value.now);
    if (now === null) return null;
    if (value.type === 'storage.project.rename') {
      return {
        type: value.type,
        requestId: value.requestId,
        projectId: value.projectId,
        name: value.name as string,
        ...(now === undefined ? {} : { now }),
      };
    }
    if (value.type === 'storage.project.duplicate') {
      return {
        type: value.type,
        requestId: value.requestId,
        projectId: value.projectId,
        ...(value.name === undefined ? {} : { name: value.name as string }),
        ...(now === undefined ? {} : { now }),
      };
    }
    return {
      type: value.type,
      requestId: value.requestId,
      projectId: value.projectId,
      ...(now === undefined ? {} : { now }),
    };
  }
  if (
    value.type === 'storage.project.preview' &&
    typeof value.projectId === 'string' &&
    (value.previewResourceId === null || typeof value.previewResourceId === 'string')
  ) {
    return {
      type: value.type,
      requestId: value.requestId,
      projectId: value.projectId,
      previewResourceId: value.previewResourceId,
    };
  }
  return null;
}

function requireWrite(access: ProjectAccessStateV1): void {
  if (access.mode === 'read-write') return;
  throw new Error(
    access.reason === 'locks-unavailable'
      ? 'Web Locks unavailable; project can only open read-only'
      : 'project is locked by another writer',
  );
}

function postFailure(request: ProjectStorageRequestV1, error: unknown): void {
  scope.postMessage({
    type: 'storage.response',
    requestId: request.requestId,
    ok: false,
    error: createStructuredErrorRecord({
      code: 'storage.project.failed',
      severity: 'error',
      operation: request.type,
      messageKey: 'error.storage.project.failed',
      recoverability: 'retryable',
      details: { message: error instanceof Error ? error.message : String(error) },
    }),
  });
}

async function createProject(
  request: Extract<ProjectStorageRequestV1, { readonly type: 'storage.project.create' }>,
): Promise<unknown> {
  const library = await libraryPromise;
  const projectId =
    request.projectId === undefined ? createProjectId() : parseProjectId(request.projectId);
  const access = await coordinator.acquire(projectId);
  requireWrite(access);
  try {
    const created = await library.create({
      name: request.name,
      initialSnapshot: request.initialSnapshot,
      projectId,
      ...(request.documentRevision === undefined
        ? {}
        : { documentRevision: request.documentRevision }),
      ...(request.previewResourceId === undefined
        ? {}
        : {
            previewResourceId:
              request.previewResourceId === null
                ? null
                : parseResourceId(request.previewResourceId),
          }),
      ...(request.now === undefined ? {} : { now: new Date(request.now) }),
    });
    coordinator.announce('project.created', projectId, { name: created.metadata.name });
    coordinator.announce('project.opened', projectId, { mode: access.mode, reason: access.reason });
    return Object.freeze({ ...created, access });
  } catch (error) {
    await coordinator.release(projectId);
    throw error;
  }
}

async function openProject(projectIdValue: string): Promise<unknown> {
  const library = await libraryPromise;
  const projectId = parseProjectId(projectIdValue);
  const access = await coordinator.acquire(projectId);
  try {
    const opened = await library.open(projectId);
    coordinator.announce(
      access.mode === 'read-write' ? 'project.opened' : 'project.read-only',
      projectId,
      { mode: access.mode, reason: access.reason },
    );
    return Object.freeze({ ...opened, access });
  } catch (error) {
    if (access.mode === 'read-write') await coordinator.release(projectId);
    throw error;
  }
}

async function duplicateProject(
  request: Extract<ProjectStorageRequestV1, { readonly type: 'storage.project.duplicate' }>,
): Promise<unknown> {
  const library = await libraryPromise;
  const sourceProjectId = parseProjectId(request.projectId);
  const duplicate = await library.duplicate(sourceProjectId, {
    ...(request.name === undefined ? {} : { name: request.name }),
    ...(request.now === undefined ? {} : { now: new Date(request.now) }),
  });
  const access = await coordinator.acquire(duplicate.metadata.projectId);
  coordinator.announce('project.duplicated', duplicate.metadata.projectId, {
    sourceProjectId,
    mode: access.mode,
    reason: access.reason,
  });
  return Object.freeze({ ...duplicate, access });
}

async function handleRequest(request: ProjectStorageRequestV1): Promise<void> {
  try {
    const library = await libraryPromise;
    let result: unknown;
    if (request.type === 'storage.library.list') {
      result = await library.list({ includeTrashed: request.includeTrashed === true });
    } else if (request.type === 'storage.project.create') {
      result = await createProject(request);
    } else if (request.type === 'storage.project.open') {
      result = await openProject(request.projectId);
    } else if (request.type === 'storage.project.close') {
      const projectId = parseProjectId(request.projectId);
      result = await library.close(projectId);
      await coordinator.closeProject(projectId);
    } else if (request.type === 'storage.project.rename') {
      const projectId = parseProjectId(request.projectId);
      result = await coordinator.runExclusive(projectId, () =>
        library.rename(
          projectId,
          request.name,
          request.now === undefined ? new Date() : new Date(request.now),
        ),
      );
      coordinator.announce('project.renamed', projectId, {
        name: (result as { name: string }).name,
      });
    } else if (request.type === 'storage.project.duplicate') {
      result = await duplicateProject(request);
    } else if (request.type === 'storage.project.preview') {
      const projectId = parseProjectId(request.projectId);
      result = await coordinator.runExclusive(projectId, () =>
        library.updatePreview(
          projectId,
          request.previewResourceId === null ? null : parseResourceId(request.previewResourceId),
        ),
      );
      coordinator.announce('project.preview-updated', projectId, {
        previewResourceId: request.previewResourceId,
      });
    } else if (request.type === 'storage.project.trash') {
      const projectId = parseProjectId(request.projectId);
      result = await coordinator.runExclusive(projectId, () =>
        library.trash(projectId, request.now === undefined ? new Date() : new Date(request.now)),
      );
      await coordinator.release(projectId);
      coordinator.announce('project.trashed', projectId, {
        deletedAt: (result as { deletedAt: string | null }).deletedAt,
      });
    } else {
      const projectId = parseProjectId(request.projectId);
      result = await coordinator.runExclusive(projectId, () => library.restore(projectId));
      coordinator.announce('project.restored', projectId, null);
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
