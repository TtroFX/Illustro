import { createStructuredErrorRecord } from '../domain/reports.js';
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
    if (value.includeTrashed !== undefined && typeof value.includeTrashed !== 'boolean')
      return null;
    return {
      type: value.type,
      requestId: value.requestId,
      ...(value.includeTrashed === undefined ? {} : { includeTrashed: value.includeTrashed }),
    };
  }
  if (value.type === 'storage.project.create') {
    if (typeof value.name !== 'string') return null;
    if (value.projectId !== undefined && typeof value.projectId !== 'string') return null;
    if (value.documentRevision !== undefined && typeof value.documentRevision !== 'number')
      return null;
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

async function handleRequest(request: ProjectStorageRequestV1): Promise<void> {
  try {
    const library = await libraryPromise;
    let result: unknown;
    if (request.type === 'storage.library.list') {
      result = await library.list({ includeTrashed: request.includeTrashed === true });
    } else if (request.type === 'storage.project.create') {
      result = await library.create({
        name: request.name,
        initialSnapshot: request.initialSnapshot,
        ...(request.projectId === undefined ? {} : { projectId: request.projectId as never }),
        ...(request.documentRevision === undefined
          ? {}
          : { documentRevision: request.documentRevision }),
        ...(request.previewResourceId === undefined
          ? {}
          : { previewResourceId: request.previewResourceId as never }),
        ...(request.now === undefined ? {} : { now: new Date(request.now) }),
      });
    } else if (request.type === 'storage.project.open') {
      result = await library.open(request.projectId);
    } else if (request.type === 'storage.project.close') {
      result = await library.close(request.projectId);
    } else if (request.type === 'storage.project.rename') {
      result = await library.rename(
        request.projectId,
        request.name,
        request.now === undefined ? new Date() : new Date(request.now),
      );
    } else if (request.type === 'storage.project.duplicate') {
      result = await library.duplicate(request.projectId, {
        ...(request.name === undefined ? {} : { name: request.name }),
        ...(request.now === undefined ? {} : { now: new Date(request.now) }),
      });
    } else if (request.type === 'storage.project.preview') {
      result = await library.updatePreview(request.projectId, request.previewResourceId);
    } else if (request.type === 'storage.project.trash') {
      result = await library.trash(
        request.projectId,
        request.now === undefined ? new Date() : new Date(request.now),
      );
    } else {
      result = await library.restore(request.projectId);
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
