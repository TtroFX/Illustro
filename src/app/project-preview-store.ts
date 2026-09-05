import {
  createResourceId,
  parseProjectId,
  parseResourceId,
  type ProjectId,
  type ResourceId,
} from '../domain/identity.js';
import { ensureProjectDirectoryLayout, type IllustroOpfsRootV1 } from '../storage/opfs-layout.js';
import { PNG_MIME_TYPE } from '../export/png-export.js';

export const PROJECT_PREVIEW_MAX_EDGE_PX = 480 as const;

function previewFilename(resourceId: ResourceId): string {
  return `${resourceId}.png`;
}

export async function createProjectThumbnailPngV1(
  source: Blob,
  maxEdge = PROJECT_PREVIEW_MAX_EDGE_PX,
): Promise<Blob> {
  if (!Number.isSafeInteger(maxEdge) || maxEdge < 64) {
    throw new RangeError('project preview max edge must be an integer >= 64');
  }
  if (source.type !== PNG_MIME_TYPE) throw new TypeError('project preview source must be PNG');
  if (typeof createImageBitmap !== 'function' || typeof OffscreenCanvas !== 'function') {
    return source;
  }
  const bitmap = await createImageBitmap(source);
  try {
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    if (width === bitmap.width && height === bitmap.height) return source;
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext('2d');
    if (context === null) return source;
    context.drawImage(bitmap, 0, 0, width, height);
    return canvas.convertToBlob({ type: PNG_MIME_TYPE });
  } finally {
    bitmap.close();
  }
}

export class ProjectPreviewStoreV1 {
  readonly #root: IllustroOpfsRootV1;

  constructor(root: IllustroOpfsRootV1) {
    this.#root = root;
  }

  async write(
    projectIdValue: ProjectId | string,
    blob: Blob,
    resourceIdValue?: ResourceId | string,
  ): Promise<ResourceId> {
    const projectId = parseProjectId(projectIdValue);
    if (blob.type !== PNG_MIME_TYPE || blob.size < 8) {
      throw new TypeError('project preview must be a non-empty PNG blob');
    }
    const resourceId =
      resourceIdValue === undefined ? createResourceId() : parseResourceId(resourceIdValue);
    const layout = await ensureProjectDirectoryLayout(this.#root, projectId);
    const file = await layout.directories.previews.getFileHandle(previewFilename(resourceId), {
      create: true,
    });
    const writable = await file.createWritable();
    try {
      await writable.write(blob);
      await writable.close();
    } catch (error) {
      await writable.abort?.(error);
      throw error;
    }
    return resourceId;
  }

  async read(
    projectIdValue: ProjectId | string,
    resourceIdValue: ResourceId | string,
  ): Promise<Blob | null> {
    const projectId = parseProjectId(projectIdValue);
    const resourceId = parseResourceId(resourceIdValue);
    try {
      const layout = await ensureProjectDirectoryLayout(this.#root, projectId);
      const file = await layout.directories.previews.getFileHandle(previewFilename(resourceId));
      const blob = await file.getFile();
      return blob.type === PNG_MIME_TYPE && blob.size >= 8 ? blob : null;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'NotFoundError') return null;
      throw error;
    }
  }
}
