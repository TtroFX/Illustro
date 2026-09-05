import type { ProjectId, ResourceId, Revision } from '../domain/identity.js';
import type { JsonValue } from '../domain/serialization.js';
import {
  LocalProjectLibraryV1,
  type LocalProjectCreateResultV1,
  type LocalProjectMetadataV1,
  type LocalProjectOpenResultV1,
} from '../storage/project-library.js';
import { ensureProjectDirectoryLayout, type IllustroOpfsRootV1 } from '../storage/opfs-layout.js';
import { readDualRecoveryState } from '../storage/recovery-head.js';

export type LocalProjectLibrarySectionV1 = 'projects' | 'recent' | 'recovery' | 'recently-deleted';

export type LocalProjectLibrarySortV1 =
  | 'modified-desc'
  | 'modified-asc'
  | 'created-desc'
  | 'created-asc'
  | 'name-asc'
  | 'name-desc';

export interface LocalProjectRecoverySummaryV1 {
  readonly coherent: boolean;
  readonly generation: number | null;
  readonly transactionId: string | null;
}

export interface LocalProjectLibraryCardV1 {
  readonly projectId: ProjectId;
  readonly name: string;
  readonly createdAt: string;
  readonly modifiedAt: string;
  readonly lifecycle: LocalProjectMetadataV1['lifecycle'];
  readonly deletedAt: string | null;
  readonly previewResourceId: ResourceId | null;
  readonly recovery: LocalProjectRecoverySummaryV1;
}

export interface LocalProjectLibraryQueryV1 {
  readonly section?: LocalProjectLibrarySectionV1;
  readonly search?: string;
  readonly sort?: LocalProjectLibrarySortV1;
  readonly limit?: number;
}

export interface LocalProjectLibraryQueryResultV1 {
  readonly section: LocalProjectLibrarySectionV1;
  readonly search: string;
  readonly sort: LocalProjectLibrarySortV1;
  readonly total: number;
  readonly cards: readonly LocalProjectLibraryCardV1[];
}

export interface LocalProjectImportAdapterV1 {
  importProject(source: unknown): Promise<{
    readonly name: string;
    readonly snapshot: JsonValue;
    readonly documentRevision?: Revision | number;
    readonly previewResourceId?: ResourceId | null;
  }>;
}

function normalizeSearch(value: string | undefined): string {
  return value?.trim().toLocaleLowerCase() ?? '';
}

function compareNames(left: LocalProjectLibraryCardV1, right: LocalProjectLibraryCardV1): number {
  return left.name.localeCompare(right.name, undefined, { sensitivity: 'base', numeric: true });
}

function compareCards(
  sort: LocalProjectLibrarySortV1,
): (left: LocalProjectLibraryCardV1, right: LocalProjectLibraryCardV1) => number {
  switch (sort) {
    case 'modified-asc':
      return (left, right) =>
        Date.parse(left.modifiedAt) - Date.parse(right.modifiedAt) || compareNames(left, right);
    case 'created-desc':
      return (left, right) =>
        Date.parse(right.createdAt) - Date.parse(left.createdAt) || compareNames(left, right);
    case 'created-asc':
      return (left, right) =>
        Date.parse(left.createdAt) - Date.parse(right.createdAt) || compareNames(left, right);
    case 'name-asc':
      return compareNames;
    case 'name-desc':
      return (left, right) => -compareNames(left, right);
    case 'modified-desc':
    default:
      return (left, right) =>
        Date.parse(right.modifiedAt) - Date.parse(left.modifiedAt) || compareNames(left, right);
  }
}

function assertLimit(limit: number | undefined): number | null {
  if (limit === undefined) return null;
  if (!Number.isSafeInteger(limit) || limit < 1) {
    throw new RangeError('library query limit must be a positive safe integer');
  }
  return limit;
}

export class LocalProjectLibraryControllerV1 {
  readonly #root: IllustroOpfsRootV1;
  readonly #library: LocalProjectLibraryV1;
  readonly #importAdapter: LocalProjectImportAdapterV1 | null;

  constructor(
    root: IllustroOpfsRootV1,
    options: { readonly importAdapter?: LocalProjectImportAdapterV1 } = {},
  ) {
    this.#root = root;
    this.#library = new LocalProjectLibraryV1(root);
    this.#importAdapter = options.importAdapter ?? null;
  }

  async #recoverySummary(projectId: ProjectId): Promise<LocalProjectRecoverySummaryV1> {
    try {
      const project = await ensureProjectDirectoryLayout(this.#root, projectId);
      const state = await readDualRecoveryState(project);
      return Object.freeze({
        coherent: state.current !== null,
        generation: state.current?.generation ?? null,
        transactionId: state.current?.transactionId ?? null,
      });
    } catch {
      return Object.freeze({ coherent: false, generation: null, transactionId: null });
    }
  }

  async query(input: LocalProjectLibraryQueryV1 = {}): Promise<LocalProjectLibraryQueryResultV1> {
    const section = input.section ?? 'projects';
    const search = normalizeSearch(input.search);
    const sort = input.sort ?? 'modified-desc';
    const limit = assertLimit(input.limit);
    const metadata = await this.#library.list({ includeTrashed: true });
    const cards = await Promise.all(
      metadata.map(
        async (project): Promise<LocalProjectLibraryCardV1> =>
          Object.freeze({
            projectId: project.projectId,
            name: project.name,
            createdAt: project.createdAt,
            modifiedAt: project.modifiedAt,
            lifecycle: project.lifecycle,
            deletedAt: project.deletedAt,
            previewResourceId: project.previewResourceId,
            recovery: await this.#recoverySummary(project.projectId),
          }),
      ),
    );

    let filtered = cards.filter((card) => {
      if (section === 'recently-deleted') return card.lifecycle === 'trashed';
      if (card.lifecycle !== 'active') return false;
      if (section === 'recovery') return card.recovery.coherent;
      return true;
    });
    if (search.length > 0) {
      filtered = filtered.filter((card) => card.name.toLocaleLowerCase().includes(search));
    }
    filtered.sort(
      compareCards(section === 'recent' && input.sort === undefined ? 'modified-desc' : sort),
    );
    const total = filtered.length;
    const visible = limit === null ? filtered : filtered.slice(0, limit);
    return Object.freeze({
      section,
      search,
      sort,
      total,
      cards: Object.freeze(visible),
    });
  }

  async create(input: {
    readonly name: string;
    readonly initialSnapshot: unknown;
    readonly projectId?: ProjectId;
    readonly documentRevision?: Revision | number;
    readonly now?: Date;
    readonly previewResourceId?: ResourceId | null;
  }): Promise<LocalProjectCreateResultV1> {
    return this.#library.create(input);
  }

  async open(projectId: ProjectId | string): Promise<LocalProjectOpenResultV1> {
    return this.#library.open(projectId);
  }

  async rename(
    projectId: ProjectId | string,
    name: string,
    now?: Date,
  ): Promise<LocalProjectMetadataV1> {
    return now === undefined
      ? this.#library.rename(projectId, name)
      : this.#library.rename(projectId, name, now);
  }

  async duplicate(
    projectId: ProjectId | string,
    options: { readonly name?: string; readonly now?: Date } = {},
  ): Promise<LocalProjectCreateResultV1> {
    return this.#library.duplicate(projectId, options);
  }

  async updatePreview(
    projectId: ProjectId | string,
    previewResourceId: ResourceId | null,
  ): Promise<LocalProjectMetadataV1> {
    return this.#library.updatePreview(projectId, previewResourceId);
  }

  async trash(projectId: ProjectId | string, now?: Date): Promise<LocalProjectMetadataV1> {
    return now === undefined ? this.#library.trash(projectId) : this.#library.trash(projectId, now);
  }

  async restore(projectId: ProjectId | string): Promise<LocalProjectMetadataV1> {
    return this.#library.restore(projectId);
  }

  async import(source: unknown): Promise<LocalProjectCreateResultV1> {
    if (this.#importAdapter === null) {
      throw new Error('no project import adapter is connected to the Local Project Library');
    }
    const imported = await this.#importAdapter.importProject(source);
    return this.#library.create({
      name: imported.name,
      initialSnapshot: imported.snapshot,
      ...(imported.documentRevision === undefined
        ? {}
        : { documentRevision: imported.documentRevision }),
      ...(imported.previewResourceId === undefined
        ? {}
        : { previewResourceId: imported.previewResourceId }),
    });
  }
}
