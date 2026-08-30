import { isUuid, type ProjectId } from '../domain/identity.js';

export const ILLUSTRO_OPFS_ROOT_NAME = 'illustro' as const;
export const PROJECTS_DIRECTORY_NAME = 'projects' as const;
export const OBJECTS_DIRECTORY_NAME = 'objects' as const;
export const TRASH_DIRECTORY_NAME = 'trash' as const;
export const SHA256_DIRECTORY_NAME = 'sha256' as const;

export const PROJECT_DIRECTORY_NAMES = [
  'heads',
  'journal',
  'checkpoints',
  'entities',
  'workspace',
  'previews',
  'tmp',
] as const;

export type ProjectDirectoryName = (typeof PROJECT_DIRECTORY_NAMES)[number];

export interface DirectoryHandleLike {
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<DirectoryHandleLike>;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FileHandleLike>;
}

export interface FileHandleLike {
  getFile(): Promise<Blob>;
  createWritable(options?: { keepExistingData?: boolean }): Promise<WritableFileStreamLike>;
}

export interface WritableFileStreamLike {
  write(data: BufferSource | Blob | string): Promise<void>;
  close(): Promise<void>;
  abort?(reason?: unknown): Promise<void>;
}

export interface StorageManagerLike {
  getDirectory(): Promise<DirectoryHandleLike>;
}

export interface IllustroOpfsRootV1 {
  readonly root: DirectoryHandleLike;
  readonly projects: DirectoryHandleLike;
  readonly objects: DirectoryHandleLike;
  readonly sha256Objects: DirectoryHandleLike;
  readonly trash: DirectoryHandleLike;
}

export interface ProjectDirectoryLayoutV1 {
  readonly projectId: ProjectId;
  readonly project: DirectoryHandleLike;
  readonly directories: Readonly<Record<ProjectDirectoryName, DirectoryHandleLike>>;
}

function browserStorageManager(): StorageManagerLike {
  const storage = navigator.storage as StorageManager & { getDirectory?: () => Promise<FileSystemDirectoryHandle> };
  if (typeof storage.getDirectory !== 'function') {
    throw new Error('OPFS is unavailable in this runtime');
  }
  return storage as unknown as StorageManagerLike;
}

export async function openIllustroOpfsRoot(
  storage: StorageManagerLike = browserStorageManager(),
): Promise<IllustroOpfsRootV1> {
  const originRoot = await storage.getDirectory();
  const root = await originRoot.getDirectoryHandle(ILLUSTRO_OPFS_ROOT_NAME, { create: true });
  const [projects, objects, trash] = await Promise.all([
    root.getDirectoryHandle(PROJECTS_DIRECTORY_NAME, { create: true }),
    root.getDirectoryHandle(OBJECTS_DIRECTORY_NAME, { create: true }),
    root.getDirectoryHandle(TRASH_DIRECTORY_NAME, { create: true }),
  ]);
  const sha256Objects = await objects.getDirectoryHandle(SHA256_DIRECTORY_NAME, { create: true });
  return Object.freeze({ root, projects, objects, sha256Objects, trash });
}

export async function ensureProjectDirectoryLayout(
  root: IllustroOpfsRootV1,
  projectId: ProjectId,
): Promise<ProjectDirectoryLayoutV1> {
  if (!isUuid(projectId)) throw new TypeError('projectId must be a UUID');
  const project = await root.projects.getDirectoryHandle(projectId, { create: true });
  const entries = await Promise.all(
    PROJECT_DIRECTORY_NAMES.map(async (name) => [
      name,
      await project.getDirectoryHandle(name, { create: true }),
    ] as const),
  );
  return Object.freeze({
    projectId,
    project,
    directories: Object.freeze(Object.fromEntries(entries) as Record<ProjectDirectoryName, DirectoryHandleLike>),
  });
}
