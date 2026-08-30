import { createProjectId, type ProjectId, type ResourceId } from './identity.js';

export interface ProjectMetadataState {
  readonly projectId: ProjectId;
  readonly name: string;
  readonly createdAt: string;
  readonly modifiedAt: string;
  readonly previewResourceId: ResourceId | null;
  readonly compatibilityMetadata: Readonly<Record<string, unknown>>;
  readonly provenanceMetadata: Readonly<Record<string, unknown>>;
  readonly projectSettings: Readonly<Record<string, unknown>>;
}

export interface WorkspaceViewportState {
  readonly zoom: number;
  readonly rotationDegrees: number;
  readonly panX: number;
  readonly panY: number;
}

export interface WorkspaceSessionState {
  readonly activeToolId: string | null;
  readonly viewport: WorkspaceViewportState;
  readonly panelState: Readonly<Record<string, unknown>>;
  readonly quickHoleState: Readonly<Record<string, unknown>>;
  readonly selectionPresentation: unknown | null;
  readonly focusedFieldId: string | null;
}

export interface WorkspaceSessionStore {
  getSnapshot(): WorkspaceSessionState;
  replace(next: WorkspaceSessionState): void;
  update(update: (current: WorkspaceSessionState) => WorkspaceSessionState): void;
  reset(): void;
  subscribe(listener: (snapshot: WorkspaceSessionState) => void): () => void;
}

export interface DerivedCacheState {
  readonly gpuResources: Map<string, unknown>;
  readonly thumbnails: Map<string, unknown>;
  readonly mipAndPreviews: Map<string, unknown>;
  readonly extractedLineart: Map<string, unknown>;
  readonly effectResults: Map<string, unknown>;
  readonly decodedResources: Map<string, unknown>;
  clear(): void;
}

function freezeWorkspaceState(state: WorkspaceSessionState): WorkspaceSessionState {
  return Object.freeze({
    ...state,
    viewport: Object.freeze({ ...state.viewport }),
    panelState: Object.freeze({ ...state.panelState }),
    quickHoleState: Object.freeze({ ...state.quickHoleState }),
  });
}

export function createProjectMetadataState(input: {
  name: string;
  projectId?: ProjectId;
  now?: Date;
  previewResourceId?: ResourceId | null;
}): ProjectMetadataState {
  const timestamp = (input.now ?? new Date()).toISOString();
  return Object.freeze({
    projectId: input.projectId ?? createProjectId(),
    name: input.name,
    createdAt: timestamp,
    modifiedAt: timestamp,
    previewResourceId: input.previewResourceId ?? null,
    compatibilityMetadata: Object.freeze({}),
    provenanceMetadata: Object.freeze({}),
    projectSettings: Object.freeze({}),
  });
}

export function createDefaultWorkspaceSessionState(): WorkspaceSessionState {
  return freezeWorkspaceState({
    activeToolId: null,
    viewport: { zoom: 1, rotationDegrees: 0, panX: 0, panY: 0 },
    panelState: {},
    quickHoleState: {},
    selectionPresentation: null,
    focusedFieldId: null,
  });
}

export function createWorkspaceSessionStore(
  initial: WorkspaceSessionState = createDefaultWorkspaceSessionState(),
): WorkspaceSessionStore {
  const baseline = freezeWorkspaceState(initial);
  let current = baseline;
  const listeners = new Set<(snapshot: WorkspaceSessionState) => void>();

  const publish = (next: WorkspaceSessionState): void => {
    current = freezeWorkspaceState(next);
    for (const listener of listeners) listener(current);
  };

  return {
    getSnapshot: () => current,
    replace: publish,
    update: (update) => publish(update(current)),
    reset: () => publish(baseline),
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export function createDerivedCacheState(): DerivedCacheState {
  const gpuResources = new Map<string, unknown>();
  const thumbnails = new Map<string, unknown>();
  const mipAndPreviews = new Map<string, unknown>();
  const extractedLineart = new Map<string, unknown>();
  const effectResults = new Map<string, unknown>();
  const decodedResources = new Map<string, unknown>();
  const caches = [
    gpuResources,
    thumbnails,
    mipAndPreviews,
    extractedLineart,
    effectResults,
    decodedResources,
  ];

  return {
    gpuResources,
    thumbnails,
    mipAndPreviews,
    extractedLineart,
    effectResults,
    decodedResources,
    clear: () => {
      for (const cache of caches) cache.clear();
    },
  };
}
