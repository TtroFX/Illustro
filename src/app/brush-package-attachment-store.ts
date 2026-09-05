export const BRUSH_PACKAGE_ATTACHMENT_STORE_SCHEMA_V1 =
  'illustro.brush-package-attachment-store/1' as const;
export const BRUSH_PACKAGE_ATTACHMENT_MAX_BYTES_V1 = 128 * 1024 * 1024;

export interface BrushPackageAttachmentStoreV1 {
  put(presetId: string, archiveBytes: Uint8Array): Promise<void>;
  get(presetId: string): Promise<Uint8Array | null>;
  delete(presetId: string): Promise<void>;
}

function normalizedPresetIdV1(presetId: string): string {
  const normalized = presetId.trim();
  if (normalized.length < 1 || normalized.length > 512) {
    throw new RangeError('brush package preset id must contain 1..512 characters');
  }
  return normalized;
}

function packageBytesV1(bytes: Uint8Array): Uint8Array {
  if (!(bytes instanceof Uint8Array)) throw new TypeError('brush package bytes must be Uint8Array');
  if (bytes.byteLength < 1 || bytes.byteLength > BRUSH_PACKAGE_ATTACHMENT_MAX_BYTES_V1) {
    throw new RangeError('brush package bytes exceed the persistent attachment limit');
  }
  return Uint8Array.from(bytes);
}

export function createMemoryBrushPackageAttachmentStoreV1(): BrushPackageAttachmentStoreV1 {
  const entries = new Map<string, Uint8Array>();
  return Object.freeze({
    async put(presetId: string, archiveBytes: Uint8Array): Promise<void> {
      entries.set(normalizedPresetIdV1(presetId), packageBytesV1(archiveBytes));
    },
    async get(presetId: string): Promise<Uint8Array | null> {
      const bytes = entries.get(normalizedPresetIdV1(presetId));
      return bytes === undefined ? null : Uint8Array.from(bytes);
    },
    async delete(presetId: string): Promise<void> {
      entries.delete(normalizedPresetIdV1(presetId));
    },
  });
}

const DATABASE_NAME_V1 = 'illustro-brush-package-attachments-v1';
const DATABASE_VERSION_V1 = 1;
const OBJECT_STORE_V1 = 'packages';

interface StoredBrushPackageV1 {
  readonly presetId: string;
  readonly bytes: ArrayBuffer;
}

function requestResultV1<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.addEventListener('success', () => resolve(request.result), { once: true });
    request.addEventListener(
      'error',
      () => reject(request.error ?? new Error('brush package IndexedDB request failed')),
      { once: true },
    );
  });
}

function transactionDoneV1(transaction: IDBTransaction): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    transaction.addEventListener('complete', () => resolve(), { once: true });
    transaction.addEventListener(
      'abort',
      () => reject(transaction.error ?? new Error('brush package IndexedDB transaction aborted')),
      { once: true },
    );
    transaction.addEventListener(
      'error',
      () => reject(transaction.error ?? new Error('brush package IndexedDB transaction failed')),
      { once: true },
    );
  });
}

function openDatabaseV1(indexedDb: IDBFactory): Promise<IDBDatabase> {
  const request = indexedDb.open(DATABASE_NAME_V1, DATABASE_VERSION_V1);
  request.addEventListener('upgradeneeded', () => {
    const database = request.result;
    if (!database.objectStoreNames.contains(OBJECT_STORE_V1)) {
      database.createObjectStore(OBJECT_STORE_V1, { keyPath: 'presetId' });
    }
  });
  return requestResultV1(request);
}

function storedPackageV1(value: unknown): StoredBrushPackageV1 | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const record = value as Readonly<Record<string, unknown>>;
  if (typeof record.presetId !== 'string' || !(record.bytes instanceof ArrayBuffer)) return null;
  return Object.freeze({ presetId: record.presetId, bytes: record.bytes });
}

export function createIndexedDbBrushPackageAttachmentStoreV1(
  indexedDb: IDBFactory = globalThis.indexedDB,
): BrushPackageAttachmentStoreV1 {
  if (indexedDb === undefined)
    throw new Error('IndexedDB is unavailable for brush package persistence');
  const database = openDatabaseV1(indexedDb);
  return Object.freeze({
    async put(presetId: string, archiveBytes: Uint8Array): Promise<void> {
      const id = normalizedPresetIdV1(presetId);
      const bytes = packageBytesV1(archiveBytes);
      const db = await database;
      const transaction = db.transaction(OBJECT_STORE_V1, 'readwrite');
      transaction.objectStore(OBJECT_STORE_V1).put({
        presetId: id,
        bytes: Uint8Array.from(bytes).buffer,
      } satisfies StoredBrushPackageV1);
      await transactionDoneV1(transaction);
    },
    async get(presetId: string): Promise<Uint8Array | null> {
      const id = normalizedPresetIdV1(presetId);
      const db = await database;
      const transaction = db.transaction(OBJECT_STORE_V1, 'readonly');
      const value = await requestResultV1(transaction.objectStore(OBJECT_STORE_V1).get(id));
      await transactionDoneV1(transaction);
      const stored = storedPackageV1(value);
      return stored === null ? null : new Uint8Array(stored.bytes.slice(0));
    },
    async delete(presetId: string): Promise<void> {
      const id = normalizedPresetIdV1(presetId);
      const db = await database;
      const transaction = db.transaction(OBJECT_STORE_V1, 'readwrite');
      transaction.objectStore(OBJECT_STORE_V1).delete(id);
      await transactionDoneV1(transaction);
    },
  });
}
