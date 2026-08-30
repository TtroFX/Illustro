import type { CommandTransactionId } from '../domain/command-registry.js';
import {
  createProjectId,
  parseProjectId,
  parseResourceId,
  parseRevision,
  type ProjectId,
  type ResourceId,
  type Revision,
} from '../domain/identity.js';
import { isSha256Hex } from '../domain/resources.js';
import {
  createProjectMetadataState,
  type ProjectMetadataState,
} from '../domain/state-boundaries.js';
import { serializeJson, toJsonValue, type JsonValue } from '../domain/serialization.js';
import { readImmutableObject } from './immutable-object-store.js';
import {
  ensureProjectDirectoryLayout,
  type IllustroOpfsRootV1,
  type ProjectDirectoryLayoutV1,
} from './opfs-layout.js';
import { readDualRecoveryState } from './recovery-head.js';
import { openSyncAccessFile } from './sync-access.js';
import { commitProjectTransaction, type ProjectTransactionCommitResultV1 } from './transaction.js';

export type LocalProjectLifecycleV1 = 'active' | 'trashed';

export interface LocalProjectMetadataV1 {
  readonly schema: 'illustro.local-project-metadata/1';
  readonly projectId: ProjectId;
  readonly name: string;
  readonly createdAt: string;
  readonly modifiedAt: string;
  readonly previewResourceId: ResourceId | null;
  readonly compatibilityMetadata: JsonValue;
  readonly provenanceMetadata: JsonValue;
  readonly projectSettings: JsonValue;
  readonly lifecycle: LocalProjectLifecycleV1;
  readonly deletedAt: string | null;
}

export interface LocalProjectLibraryStateV1 {
  readonly schema: 'illustro.local-project-library/1';
  readonly generation: number;
  readonly projects: readonly LocalProjectMetadataV1[];
}

interface LocalProjectLibraryEnvelopeV1 {
  readonly schema: 'illustro.local-project-library-envelope/1';
  readonly state: LocalProjectLibraryStateV1;
  readonly checksum: string;
}

interface CheckpointRootV1 {
  readonly projectId: ProjectId;
  readonly sequence: number;
  readonly documentRevision: Revision;
  readonly rootObjectHash: string;
}

export interface LocalProjectOpenResultV1 {
  readonly metadata: LocalProjectMetadataV1;
  readonly snapshot: JsonValue;
  readonly documentRevision: Revision;
  readonly sequence: number;
  readonly recoveryGeneration: number;
}

export interface LocalProjectCreateResultV1 extends LocalProjectOpenResultV1 {
  readonly commit: ProjectTransactionCommitResultV1;
}

const LIBRARY_FILENAMES = Object.freeze(['library-a.json', 'library-b.json'] as const);
const PROJECT_METADATA_FILENAME = 'project-metadata.json' as const;

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseTimestamp(value: unknown, label: string): string {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
    throw new TypeError(`${label} must be an ISO-like timestamp`);
  }
  return value;
}

function normalizeName(value: unknown): string {
  if (typeof value !== 'string') throw new TypeError('project name must be a string');
  const normalized = value.trim();
  if (normalized.length === 0) throw new TypeError('project name must not be empty');
  if (normalized.length > 200) throw new RangeError('project name must be at most 200 characters');
  return normalized;
}

function jsonRecord(value: unknown, label: string): JsonValue {
  const normalized = toJsonValue(value);
  if (normalized === null || Array.isArray(normalized) || typeof normalized !== 'object') {
    throw new TypeError(`${label} must be a JSON object`);
  }
  return normalized;
}

function metadataFromState(
  metadata: ProjectMetadataState,
  lifecycle: LocalProjectLifecycleV1 = 'active',
  deletedAt: string | null = null,
): LocalProjectMetadataV1 {
  return Object.freeze({
    schema: 'illustro.local-project-metadata/1',
    projectId: parseProjectId(metadata.projectId),
    name: normalizeName(metadata.name),
    createdAt: parseTimestamp(metadata.createdAt, 'createdAt'),
    modifiedAt: parseTimestamp(metadata.modifiedAt, 'modifiedAt'),
    previewResourceId:
      metadata.previewResourceId === null ? null : parseResourceId(metadata.previewResourceId),
    compatibilityMetadata: jsonRecord(metadata.compatibilityMetadata, 'compatibilityMetadata'),
    provenanceMetadata: jsonRecord(metadata.provenanceMetadata, 'provenanceMetadata'),
    projectSettings: jsonRecord(metadata.projectSettings, 'projectSettings'),
    lifecycle,
    deletedAt,
  });
}

export function parseLocalProjectMetadataV1(value: unknown): LocalProjectMetadataV1 {
  if (!isRecord(value) || value.schema !== 'illustro.local-project-metadata/1') {
    throw new TypeError('invalid local project metadata schema');
  }
  if (value.lifecycle !== 'active' && value.lifecycle !== 'trashed') {
    throw new TypeError('invalid local project lifecycle');
  }
  const lifecycle = value.lifecycle;
  const deletedAt = value.deletedAt === null ? null : parseTimestamp(value.deletedAt, 'deletedAt');
  if (
    (lifecycle === 'active' && deletedAt !== null) ||
    (lifecycle === 'trashed' && deletedAt === null)
  ) {
    throw new Error('project lifecycle and deletedAt are inconsistent');
  }
  return Object.freeze({
    schema: 'illustro.local-project-metadata/1',
    projectId: parseProjectId(value.projectId),
    name: normalizeName(value.name),
    createdAt: parseTimestamp(value.createdAt, 'createdAt'),
    modifiedAt: parseTimestamp(value.modifiedAt, 'modifiedAt'),
    previewResourceId:
      value.previewResourceId === null ? null : parseResourceId(value.previewResourceId),
    compatibilityMetadata: jsonRecord(value.compatibilityMetadata, 'compatibilityMetadata'),
    provenanceMetadata: jsonRecord(value.provenanceMetadata, 'provenanceMetadata'),
    projectSettings: jsonRecord(value.projectSettings, 'projectSettings'),
    lifecycle,
    deletedAt,
  });
}

function parseLibraryState(value: unknown): LocalProjectLibraryStateV1 {
  if (!isRecord(value) || value.schema !== 'illustro.local-project-library/1') {
    throw new TypeError('invalid local project library schema');
  }
  if (!Number.isSafeInteger(value.generation) || (value.generation as number) < 0) {
    throw new TypeError('invalid local project library generation');
  }
  if (!Array.isArray(value.projects))
    throw new TypeError('project library entries must be an array');
  const projects = Object.freeze(value.projects.map((item) => parseLocalProjectMetadataV1(item)));
  const ids = new Set<string>();
  for (const project of projects) {
    if (ids.has(project.projectId)) throw new Error('duplicate project ID in local library');
    ids.add(project.projectId);
  }
  return Object.freeze({
    schema: 'illustro.local-project-library/1',
    generation: value.generation as number,
    projects,
  });
}

function ownedBuffer(text: string): ArrayBuffer {
  const bytes = new TextEncoder().encode(text);
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

async function sha256HexText(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', ownedBuffer(text));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function createLibraryEnvelope(
  state: LocalProjectLibraryStateV1,
): Promise<LocalProjectLibraryEnvelopeV1> {
  const normalized = parseLibraryState(state);
  return Object.freeze({
    schema: 'illustro.local-project-library-envelope/1',
    state: normalized,
    checksum: await sha256HexText(serializeJson(normalized)),
  });
}

async function parseLibraryEnvelope(text: string): Promise<LocalProjectLibraryEnvelopeV1> {
  const value = JSON.parse(text) as unknown;
  if (!isRecord(value) || value.schema !== 'illustro.local-project-library-envelope/1') {
    throw new TypeError('invalid local project library envelope');
  }
  if (!isSha256Hex(value.checksum)) throw new TypeError('invalid local project library checksum');
  const state = parseLibraryState(value.state);
  const observed = await sha256HexText(serializeJson(state));
  if (observed !== value.checksum) throw new Error('local project library checksum mismatch');
  return Object.freeze({
    schema: 'illustro.local-project-library-envelope/1',
    state,
    checksum: value.checksum,
  });
}

async function readLibrarySlot(
  root: IllustroOpfsRootV1,
  filename: (typeof LIBRARY_FILENAMES)[number],
): Promise<LocalProjectLibraryStateV1 | null> {
  try {
    const file = await root.root.getFileHandle(filename);
    const envelope = await parseLibraryEnvelope(await (await file.getFile()).text());
    return envelope.state;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'NotFoundError') return null;
    if (error instanceof SyntaxError || error instanceof TypeError || error instanceof RangeError)
      return null;
    if (error instanceof Error && error.message.includes('checksum')) return null;
    throw error;
  }
}

export async function readLocalProjectLibrary(
  root: IllustroOpfsRootV1,
): Promise<LocalProjectLibraryStateV1> {
  const [a, b] = await Promise.all([
    readLibrarySlot(root, LIBRARY_FILENAMES[0]),
    readLibrarySlot(root, LIBRARY_FILENAMES[1]),
  ]);
  const current = a === null ? b : b === null ? a : a.generation >= b.generation ? a : b;
  return (
    current ??
    Object.freeze({
      schema: 'illustro.local-project-library/1' as const,
      generation: 0,
      projects: Object.freeze([]),
    })
  );
}

async function publishLocalProjectLibrary(
  root: IllustroOpfsRootV1,
  projects: readonly LocalProjectMetadataV1[],
): Promise<LocalProjectLibraryStateV1> {
  const current = await readLocalProjectLibrary(root);
  const state: LocalProjectLibraryStateV1 = Object.freeze({
    schema: 'illustro.local-project-library/1',
    generation: current.generation + 1,
    projects: Object.freeze(
      [...projects]
        .map((project) => parseLocalProjectMetadataV1(project))
        .sort((left, right) => left.projectId.localeCompare(right.projectId)),
    ),
  });
  const envelope = await createLibraryEnvelope(state);
  const slot = state.generation % 2 === 1 ? LIBRARY_FILENAMES[0] : LIBRARY_FILENAMES[1];
  const file = await openSyncAccessFile(root.root, slot);
  try {
    file.replace(new TextEncoder().encode(serializeJson(envelope)));
  } finally {
    file.close();
  }
  const observed = await readLibrarySlot(root, slot);
  if (observed === null || observed.generation !== state.generation) {
    throw new Error('local project library read-back verification failed');
  }
  return observed;
}

async function writeProjectMetadata(
  project: ProjectDirectoryLayoutV1,
  metadata: LocalProjectMetadataV1,
): Promise<void> {
  const normalized = parseLocalProjectMetadataV1(metadata);
  const file = await openSyncAccessFile(project.project, PROJECT_METADATA_FILENAME);
  try {
    file.replace(new TextEncoder().encode(serializeJson(normalized)));
  } finally {
    file.close();
  }
  const observed = parseLocalProjectMetadataV1(
    JSON.parse(
      await (await project.project.getFileHandle(PROJECT_METADATA_FILENAME))
        .getFile()
        .then((blob) => blob.text()),
    ) as unknown,
  );
  if (observed.projectId !== normalized.projectId || observed.lifecycle !== normalized.lifecycle) {
    throw new Error('project metadata read-back verification failed');
  }
}

function replaceProject(
  state: LocalProjectLibraryStateV1,
  project: LocalProjectMetadataV1,
): readonly LocalProjectMetadataV1[] {
  const normalized = parseLocalProjectMetadataV1(project);
  const existingIndex = state.projects.findIndex(
    (entry) => entry.projectId === normalized.projectId,
  );
  if (existingIndex < 0) return Object.freeze([...state.projects, normalized]);
  const next = [...state.projects];
  next[existingIndex] = normalized;
  return Object.freeze(next);
}

function projectRecord(
  state: LocalProjectLibraryStateV1,
  projectId: ProjectId,
): LocalProjectMetadataV1 {
  const project = state.projects.find((entry) => entry.projectId === projectId);
  if (project === undefined) throw new Error(`local project not found: ${projectId}`);
  return project;
}

function parseCheckpointRoot(value: unknown, expectedProjectId: ProjectId): CheckpointRootV1 {
  if (!isRecord(value) || value.schema !== 'illustro.checkpoint/1') {
    throw new TypeError('invalid checkpoint object');
  }
  const projectId = parseProjectId(value.projectId);
  if (projectId !== expectedProjectId) throw new Error('checkpoint belongs to another project');
  if (!Number.isSafeInteger(value.sequence) || (value.sequence as number) < 1) {
    throw new TypeError('invalid checkpoint sequence');
  }
  const documentRevision = parseRevision(value.documentRevision);
  if (!isRecord(value.rootObject) || !isSha256Hex(value.rootObject.hash)) {
    throw new TypeError('invalid checkpoint root object');
  }
  return Object.freeze({
    projectId,
    sequence: value.sequence as number,
    documentRevision,
    rootObjectHash: value.rootObject.hash,
  });
}

async function readProjectSnapshot(
  root: IllustroOpfsRootV1,
  project: ProjectDirectoryLayoutV1,
): Promise<{
  snapshot: JsonValue;
  revision: Revision;
  sequence: number;
  recoveryGeneration: number;
}> {
  const recovery = await readDualRecoveryState(project);
  if (recovery.current === null) throw new Error('project has no coherent recovery head');
  const checkpointBytes = await readImmutableObject(
    root.sha256Objects,
    recovery.current.checkpointObject.hash,
  );
  const checkpoint = parseCheckpointRoot(
    JSON.parse(new TextDecoder().decode(checkpointBytes)) as unknown,
    project.projectId,
  );
  const snapshotBytes = await readImmutableObject(root.sha256Objects, checkpoint.rootObjectHash);
  const snapshot = toJsonValue(JSON.parse(new TextDecoder().decode(snapshotBytes)) as unknown);
  return Object.freeze({
    snapshot,
    revision: checkpoint.documentRevision,
    sequence: checkpoint.sequence,
    recoveryGeneration: recovery.current.generation,
  });
}

function updatedMetadata(
  metadata: LocalProjectMetadataV1,
  patch: {
    readonly name?: string;
    readonly modifiedAt?: string;
    readonly previewResourceId?: ResourceId | null;
    readonly lifecycle?: LocalProjectLifecycleV1;
    readonly deletedAt?: string | null;
  },
): LocalProjectMetadataV1 {
  return parseLocalProjectMetadataV1({ ...metadata, ...patch });
}

export class LocalProjectLibraryV1 {
  readonly #root: IllustroOpfsRootV1;

  constructor(root: IllustroOpfsRootV1) {
    this.#root = root;
  }

  async list(
    options: { includeTrashed?: boolean } = {},
  ): Promise<readonly LocalProjectMetadataV1[]> {
    const state = await readLocalProjectLibrary(this.#root);
    const visible =
      options.includeTrashed === true
        ? state.projects
        : state.projects.filter((item) => item.lifecycle === 'active');
    return Object.freeze([...visible]);
  }

  async create(input: {
    readonly name: string;
    readonly initialSnapshot: unknown;
    readonly projectId?: ProjectId;
    readonly documentRevision?: Revision | number;
    readonly now?: Date;
    readonly previewResourceId?: ResourceId | null;
  }): Promise<LocalProjectCreateResultV1> {
    const state = await readLocalProjectLibrary(this.#root);
    const projectId = input.projectId ?? createProjectId();
    if (state.projects.some((entry) => entry.projectId === projectId)) {
      throw new Error(`project already exists: ${projectId}`);
    }
    const metadata = metadataFromState(
      createProjectMetadataState({
        name: normalizeName(input.name),
        projectId,
        now: input.now,
        previewResourceId: input.previewResourceId ?? null,
      }),
    );
    const project = await ensureProjectDirectoryLayout(this.#root, projectId);
    const transactionId = crypto.randomUUID() as CommandTransactionId;
    const commit = await commitProjectTransaction(this.#root, project, {
      transactionId,
      sequence: 1,
      documentRevision: parseRevision(input.documentRevision ?? 0),
      snapshot: input.initialSnapshot,
      createdAt: metadata.createdAt,
    });
    await writeProjectMetadata(project, metadata);
    await publishLocalProjectLibrary(this.#root, replaceProject(state, metadata));
    const opened = await this.open(projectId);
    return Object.freeze({ ...opened, commit });
  }

  async open(projectIdValue: ProjectId | string): Promise<LocalProjectOpenResultV1> {
    const projectId = parseProjectId(projectIdValue);
    const state = await readLocalProjectLibrary(this.#root);
    const metadata = projectRecord(state, projectId);
    if (metadata.lifecycle !== 'active') throw new Error('project is in Recently Deleted');
    const project = await ensureProjectDirectoryLayout(this.#root, projectId);
    const snapshot = await readProjectSnapshot(this.#root, project);
    return Object.freeze({
      metadata,
      snapshot: snapshot.snapshot,
      documentRevision: snapshot.revision,
      sequence: snapshot.sequence,
      recoveryGeneration: snapshot.recoveryGeneration,
    });
  }

  async close(projectIdValue: ProjectId | string): Promise<LocalProjectMetadataV1> {
    const projectId = parseProjectId(projectIdValue);
    const state = await readLocalProjectLibrary(this.#root);
    const metadata = projectRecord(state, projectId);
    const project = await ensureProjectDirectoryLayout(this.#root, projectId);
    const recovery = await readDualRecoveryState(project);
    if (metadata.lifecycle === 'active' && recovery.current === null) {
      throw new Error('cannot close an active project without a coherent recovery head');
    }
    return metadata;
  }

  async rename(
    projectIdValue: ProjectId | string,
    name: string,
    now: Date = new Date(),
  ): Promise<LocalProjectMetadataV1> {
    const projectId = parseProjectId(projectIdValue);
    const state = await readLocalProjectLibrary(this.#root);
    const current = projectRecord(state, projectId);
    if (current.lifecycle !== 'active') throw new Error('cannot rename a trashed project');
    const metadata = updatedMetadata(current, {
      name: normalizeName(name),
      modifiedAt: now.toISOString(),
    });
    const project = await ensureProjectDirectoryLayout(this.#root, projectId);
    await writeProjectMetadata(project, metadata);
    await publishLocalProjectLibrary(this.#root, replaceProject(state, metadata));
    return metadata;
  }

  async duplicate(
    projectIdValue: ProjectId | string,
    input: { readonly name?: string; readonly now?: Date } = {},
  ): Promise<LocalProjectCreateResultV1> {
    const source = await this.open(parseProjectId(projectIdValue));
    const name = input.name ?? `${source.metadata.name} copy`;
    return this.create({
      name,
      initialSnapshot: source.snapshot,
      documentRevision: source.documentRevision,
      now: input.now,
      previewResourceId: source.metadata.previewResourceId,
    });
  }

  async updatePreview(
    projectIdValue: ProjectId | string,
    previewResourceId: ResourceId | string | null,
  ): Promise<LocalProjectMetadataV1> {
    const projectId = parseProjectId(projectIdValue);
    const state = await readLocalProjectLibrary(this.#root);
    const current = projectRecord(state, projectId);
    const metadata = updatedMetadata(current, {
      previewResourceId: previewResourceId === null ? null : parseResourceId(previewResourceId),
    });
    const project = await ensureProjectDirectoryLayout(this.#root, projectId);
    await writeProjectMetadata(project, metadata);
    await publishLocalProjectLibrary(this.#root, replaceProject(state, metadata));
    return metadata;
  }

  async trash(
    projectIdValue: ProjectId | string,
    now: Date = new Date(),
  ): Promise<LocalProjectMetadataV1> {
    const projectId = parseProjectId(projectIdValue);
    const state = await readLocalProjectLibrary(this.#root);
    const current = projectRecord(state, projectId);
    if (current.lifecycle === 'trashed') return current;
    const timestamp = now.toISOString();
    const metadata = updatedMetadata(current, { lifecycle: 'trashed', deletedAt: timestamp });
    const project = await ensureProjectDirectoryLayout(this.#root, projectId);
    const recovery = await readDualRecoveryState(project);
    if (recovery.current === null)
      throw new Error('refusing to trash a project without a coherent recovery head');
    await writeProjectMetadata(project, metadata);
    await publishLocalProjectLibrary(this.#root, replaceProject(state, metadata));
    return metadata;
  }

  async restore(projectIdValue: ProjectId | string): Promise<LocalProjectMetadataV1> {
    const projectId = parseProjectId(projectIdValue);
    const state = await readLocalProjectLibrary(this.#root);
    const current = projectRecord(state, projectId);
    if (current.lifecycle === 'active') return current;
    const project = await ensureProjectDirectoryLayout(this.#root, projectId);
    const recovery = await readDualRecoveryState(project);
    if (recovery.current === null)
      throw new Error('cannot restore a project without a coherent recovery head');
    const metadata = updatedMetadata(current, { lifecycle: 'active', deletedAt: null });
    await writeProjectMetadata(project, metadata);
    await publishLocalProjectLibrary(this.#root, replaceProject(state, metadata));
    return metadata;
  }
}
