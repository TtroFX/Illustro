import { isCommandTransactionId, type CommandTransactionId } from '../domain/command-registry.js';
import {
  createProjectId,
  parseLayerId,
  parseProjectId,
  parseRevision,
  type ProjectId,
  type Revision,
} from '../domain/identity.js';
import type { RasterLayerV1 } from '../domain/layers.js';
import { isSha256Hex } from '../domain/resources.js';
import { parseHistorySpineStateV1, type HistorySpineStateV1 } from '../history/history.js';
import type {
  BaselineRasterTileImageV1,
  BaselineRasterTilePatchDirectionV1,
  BaselineRasterTilePatchV1,
} from '../gpu/baseline-raster-tile-store.js';
import { CANONICAL_TILE_SIZE_PX, tileBoundsForDocumentV1 } from '../gpu/sparse-tile-model.js';
import type { TileCodecIdV1 } from '../storage/tile-codec.js';
import type { PaintHistoryControllerV1 } from './paint-history-controller.js';
import {
  type PaintSessionControllerV1,
  parsePaintProjectSnapshotV1,
  type PaintDocumentCreationInputV1,
  type PaintProjectSnapshotV1,
} from './paint-session-controller.js';

export const PAINT_RESUME_PROJECT_KEY_V1 = 'illustro.m4.active-project' as const;
export const PAINT_STORAGE_REQUEST_TIMEOUT_MS = 10_000 as const;
export const PAINT_DIRTY_COALESCE_MS = 120 as const;

export type PaintPersistenceStatusV1 =
  | 'idle'
  | 'initializing'
  | 'ready'
  | 'dirty'
  | 'saving'
  | 'error'
  | 'disposed';

export interface PaintPersistenceSnapshotV1 {
  readonly schema: 'illustro.paint-persistence/1';
  readonly projectId: ProjectId | null;
  readonly sequence: number;
  readonly recoveryGeneration: number;
  readonly status: PaintPersistenceStatusV1;
  readonly lastDurableTransactionId: CommandTransactionId | null;
  readonly lastError: string | null;
}

export interface PaintPersistenceProjectSnapshotV1 {
  readonly schema: 'illustro.paint-persistence-snapshot/1';
  readonly paint: PaintProjectSnapshotV1;
  readonly history: HistorySpineStateV1;
  readonly revisionHighWater: number;
  readonly raster?: PaintPersistenceRasterStateV1;
}

export interface PaintRasterTileVersionReferenceV1 {
  readonly schema: 'illustro.paint-raster-tile-version-ref/1';
  readonly payloadRef: string;
  readonly revision: Revision;
}

export interface PaintRasterTilePatchReferenceV1 {
  readonly schema: 'illustro.paint-raster-tile-patch-ref/1';
  readonly layerId: string;
  readonly coordinate: { readonly tx: number; readonly ty: number };
  readonly before: PaintRasterTileVersionReferenceV1 | null;
  readonly after: PaintRasterTileVersionReferenceV1 | null;
}

export interface PaintRasterTileHistoryReferenceV1 {
  readonly schema: 'illustro.paint-raster-tile-history-ref/1';
  readonly transactionId: CommandTransactionId;
  readonly patches: readonly PaintRasterTilePatchReferenceV1[];
}

export interface PaintPersistenceRasterStateV1 {
  readonly schema: 'illustro.paint-raster-state/1';
  readonly tileSize: typeof CANONICAL_TILE_SIZE_PX;
  readonly history: readonly PaintRasterTileHistoryReferenceV1[];
}

export interface PaintPersistenceInitializeResultV1 {
  readonly schema: 'illustro.paint-persistence-initialize/1';
  readonly mode: 'created' | 'recovered';
  readonly projectId: ProjectId;
  readonly sequence: number;
  readonly recoveryGeneration: number;
  readonly documentRevision: Revision;
}

export interface PaintResumeStoreV1 {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface PaintStorageWorkerLikeV1 {
  postMessage(message: unknown, transfer?: readonly Transferable[]): void;
  addEventListener(type: 'message', listener: (event: MessageEvent<unknown>) => void): void;
  removeEventListener(type: 'message', listener: (event: MessageEvent<unknown>) => void): void;
}

export type PaintPersistenceNewDocumentInputV1 = Omit<PaintDocumentCreationInputV1, 'projectId'>;

export type PaintRasterTilePixelFormatV1 = 'rgba8-unorm' | 'rgba16-float';

export interface PaintPersistedRasterTileV1 {
  readonly schema: 'illustro.paint-persisted-raster-tile/1';
  readonly payloadRef: string;
  readonly objectHash: string;
  readonly codec: TileCodecIdV1;
  readonly pixelFormat: PaintRasterTilePixelFormatV1;
  readonly width: number;
  readonly height: number;
  readonly rawByteLength: number;
  readonly encodedByteLength: number;
}

export interface PaintDecodedRasterTileV1 {
  readonly schema: 'illustro.paint-decoded-raster-tile/1';
  readonly payloadRef: string;
  readonly objectHash: string;
  readonly codec: TileCodecIdV1;
  readonly pixelFormat: PaintRasterTilePixelFormatV1;
  readonly width: number;
  readonly height: number;
  readonly bytes: Uint8Array<ArrayBuffer>;
}

export function paintRasterTilePayloadRefV1(objectHash: string): string {
  if (!isSha256Hex(objectHash))
    throw new TypeError('raster tile object hash must be lowercase SHA-256');
  return `sha256:${objectHash}`;
}

export function parsePaintRasterTilePayloadRefV1(payloadRef: string): string {
  if (!payloadRef.startsWith('sha256:'))
    throw new TypeError('raster tile payloadRef must use sha256');
  const objectHash = payloadRef.slice('sha256:'.length);
  if (!isSha256Hex(objectHash)) throw new TypeError('raster tile payloadRef hash is invalid');
  return objectHash;
}

type PendingStorageRequestV1 = {
  readonly resolve: (result: unknown) => void;
  readonly reject: (error: Error) => void;
  readonly timeout: number;
};

interface StorageProjectStateV1 {
  readonly projectId: ProjectId;
  readonly snapshot: unknown;
  readonly documentRevision: Revision;
  readonly sequence: number;
  readonly recoveryGeneration: number;
}

interface CurrentRasterTileReferenceV1 {
  readonly layerId: string;
  readonly coordinate: { readonly tx: number; readonly ty: number };
  readonly version: PaintRasterTileVersionReferenceV1;
}

function rasterTileKey(layerId: string, tx: number, ty: number): string {
  return `${layerId}/${tx}:${ty}`;
}

async function mapWithConcurrency<Input, Output>(
  values: readonly Input[],
  concurrency: number,
  mapper: (value: Input, index: number) => Promise<Output>,
): Promise<readonly Output[]> {
  const results = new Array<Output>(values.length);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(concurrency, values.length) }, async () => {
    for (;;) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= values.length) return;
      const value = values[index];
      if (value === undefined) throw new Error('concurrent raster tile input is missing');
      results[index] = await mapper(value, index);
    }
  });
  await Promise.all(workers);
  return Object.freeze(results);
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function positiveSequence(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 1) {
    throw new TypeError(`${label} must be a positive safe integer`);
  }
  return value as number;
}

function recoveryGeneration(value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) < 1) {
    throw new TypeError('recovery generation must be a positive safe integer');
  }
  return value as number;
}

function parseStorageProjectState(value: unknown): StorageProjectStateV1 {
  if (!isRecord(value) || !isRecord(value.metadata)) {
    throw new TypeError('invalid storage project response');
  }
  return Object.freeze({
    projectId: parseProjectId(value.metadata.projectId),
    snapshot: value.snapshot,
    documentRevision: parseRevision(value.documentRevision),
    sequence: positiveSequence(value.sequence, 'project sequence'),
    recoveryGeneration: recoveryGeneration(value.recoveryGeneration),
  });
}

function ownedArrayBuffer(value: Uint8Array | ArrayBuffer): ArrayBuffer {
  if (value instanceof ArrayBuffer) return value.slice(0);
  const copy = new Uint8Array(value.byteLength);
  copy.set(value);
  return copy.buffer;
}

function rasterPixelFormat(value: unknown): PaintRasterTilePixelFormatV1 {
  if (value !== 'rgba8-unorm' && value !== 'rgba16-float') {
    throw new TypeError('storage returned a non-raster tile pixel format');
  }
  return value;
}

function tileCodec(value: unknown): TileCodecIdV1 {
  if (value !== 'raw' && value !== 'lz4-block')
    throw new TypeError('storage returned invalid tile codec');
  return value;
}

function positiveTileDimension(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 1) {
    throw new TypeError(`${label} must be a positive safe integer`);
  }
  return value as number;
}

function storageErrorMessage(value: unknown): string {
  if (!isRecord(value)) return String(value ?? 'storage request failed');
  if (isRecord(value.details) && typeof value.details.message === 'string') {
    return value.details.message;
  }
  if (typeof value.code === 'string') return value.code;
  return 'storage request failed';
}

function parseRasterTileVersionReference(value: unknown): PaintRasterTileVersionReferenceV1 | null {
  if (value === null) return null;
  if (
    !isRecord(value) ||
    value.schema !== 'illustro.paint-raster-tile-version-ref/1' ||
    typeof value.payloadRef !== 'string'
  ) {
    throw new TypeError('invalid raster tile version reference');
  }
  parsePaintRasterTilePayloadRefV1(value.payloadRef);
  return Object.freeze({
    schema: 'illustro.paint-raster-tile-version-ref/1' as const,
    payloadRef: value.payloadRef,
    revision: parseRevision(value.revision),
  });
}

function parseRasterTilePatchReference(value: unknown): PaintRasterTilePatchReferenceV1 {
  if (
    !isRecord(value) ||
    value.schema !== 'illustro.paint-raster-tile-patch-ref/1' ||
    !isRecord(value.coordinate) ||
    !Number.isSafeInteger(value.coordinate.tx) ||
    (value.coordinate.tx as number) < 0 ||
    !Number.isSafeInteger(value.coordinate.ty) ||
    (value.coordinate.ty as number) < 0
  ) {
    throw new TypeError('invalid raster tile patch reference');
  }
  const layerId = parseLayerId(value.layerId);
  const before = parseRasterTileVersionReference(value.before);
  const after = parseRasterTileVersionReference(value.after);
  if (before === null && after === null) {
    throw new Error('raster tile patch reference cannot be empty');
  }
  return Object.freeze({
    schema: 'illustro.paint-raster-tile-patch-ref/1' as const,
    layerId,
    coordinate: Object.freeze({
      tx: value.coordinate.tx as number,
      ty: value.coordinate.ty as number,
    }),
    before,
    after,
  });
}

function parsePersistenceRasterState(value: unknown): PaintPersistenceRasterStateV1 {
  if (
    !isRecord(value) ||
    value.schema !== 'illustro.paint-raster-state/1' ||
    value.tileSize !== CANONICAL_TILE_SIZE_PX ||
    !Array.isArray(value.history)
  ) {
    throw new TypeError('invalid paint raster persistence state');
  }
  const seen = new Set<string>();
  const history = value.history.map((entry) => {
    if (
      !isRecord(entry) ||
      entry.schema !== 'illustro.paint-raster-tile-history-ref/1' ||
      !isCommandTransactionId(entry.transactionId) ||
      seen.has(entry.transactionId) ||
      !Array.isArray(entry.patches) ||
      entry.patches.length === 0
    ) {
      throw new TypeError('invalid raster tile history reference');
    }
    seen.add(entry.transactionId);
    return Object.freeze({
      schema: 'illustro.paint-raster-tile-history-ref/1' as const,
      transactionId: entry.transactionId,
      patches: Object.freeze(entry.patches.map(parseRasterTilePatchReference)),
    });
  });
  return Object.freeze({
    schema: 'illustro.paint-raster-state/1' as const,
    tileSize: CANONICAL_TILE_SIZE_PX,
    history: Object.freeze(history),
  });
}

export function parsePaintPersistenceProjectSnapshotV1(
  value: unknown,
): PaintPersistenceProjectSnapshotV1 {
  if (!isRecord(value) || value.schema !== 'illustro.paint-persistence-snapshot/1') {
    throw new TypeError('invalid paint persistence snapshot schema');
  }
  const paint = parsePaintProjectSnapshotV1(value.paint);
  const history = parseHistorySpineStateV1(value.history);
  if (!Number.isSafeInteger(value.revisionHighWater) || (value.revisionHighWater as number) < 0) {
    throw new TypeError('paint persistence revision high-water must be non-negative');
  }
  const revisionHighWater = value.revisionHighWater as number;
  if (revisionHighWater < paint.document.revision) {
    throw new Error('paint persistence revision high-water trails the document revision');
  }
  const raster = value.raster === undefined ? undefined : parsePersistenceRasterState(value.raster);
  return Object.freeze({
    schema: 'illustro.paint-persistence-snapshot/1' as const,
    paint,
    history,
    revisionHighWater,
    ...(raster === undefined ? {} : { raster }),
  });
}

export class PaintPersistenceControllerV1 {
  readonly #worker: PaintStorageWorkerLikeV1;
  readonly #session: PaintSessionControllerV1;
  readonly #history: PaintHistoryControllerV1;
  readonly #resumeStore: PaintResumeStoreV1 | null;
  readonly #onState: (snapshot: PaintPersistenceSnapshotV1) => void;
  readonly #pending = new Map<string, PendingStorageRequestV1>();
  readonly #messageListener: (event: MessageEvent<unknown>) => void;

  #projectId: ProjectId | null = null;
  #sequence = 0;
  #recoveryGeneration = 0;
  #status: PaintPersistenceStatusV1 = 'idle';
  #lastDurableTransactionId: CommandTransactionId | null = null;
  #lastError: string | null = null;
  #scheduledDirtyTransactionId: CommandTransactionId | null = null;
  #scheduledDirtyTimer: number | null = null;
  #dirtyTail: Promise<void> = Promise.resolve();
  #tileTail: Promise<void> = Promise.resolve();
  readonly #currentTileRefs = new Map<string, CurrentRasterTileReferenceV1>();
  readonly #historyTileRefs = new Map<string, PaintRasterTileHistoryReferenceV1>();
  #rasterStateEnabled = false;
  #disposed = false;

  constructor(
    worker: PaintStorageWorkerLikeV1,
    session: PaintSessionControllerV1,
    history: PaintHistoryControllerV1,
    options: {
      readonly resumeStore?: PaintResumeStoreV1 | null;
      readonly onState?: (snapshot: PaintPersistenceSnapshotV1) => void;
    } = {},
  ) {
    this.#worker = worker;
    this.#session = session;
    this.#history = history;
    this.#resumeStore = options.resumeStore ?? null;
    this.#onState = options.onState ?? (() => undefined);
    this.#messageListener = (event) => this.#handleWorkerMessage(event.data);
    this.#worker.addEventListener('message', this.#messageListener);
    this.#history.setTilePatchLoader((transactionId) => this.#loadTilePatches(transactionId));
    this.#session.setRasterMaskTileLoader(async (payloadRef) => {
      const tile = await this.readRasterTile(payloadRef);
      if (tile.pixelFormat !== 'rgba8-unorm') {
        throw new Error('Raster Mask persistence payload must use rgba8-unorm');
      }
      return Object.freeze({
        pixelFormat: 'rgba8-unorm' as const,
        width: tile.width,
        height: tile.height,
        bytes: tile.bytes,
      });
    });
    this.#publish();
  }

  snapshot(): PaintPersistenceSnapshotV1 {
    return Object.freeze({
      schema: 'illustro.paint-persistence/1' as const,
      projectId: this.#projectId,
      sequence: this.#sequence,
      recoveryGeneration: this.#recoveryGeneration,
      status: this.#status,
      lastDurableTransactionId: this.#lastDurableTransactionId,
      lastError: this.#lastError,
    });
  }

  projectSnapshot(): PaintPersistenceProjectSnapshotV1 {
    this.#pruneHistoryTileReferences();
    const paint = this.#session.persistenceProjectSnapshot();
    if (paint === null) throw new Error('paint persistence requires an active document');
    const history = this.#history.snapshot();
    const historyState = this.#history.exportState();
    const retainedTransactionIds = new Set(
      historyState.entries.map((entry) =>
        entry.storage === 'resident'
          ? entry.transaction.transactionId
          : entry.reference.transactionId,
      ),
    );
    const rasterHistory = [...this.#historyTileRefs.values()].filter((entry) =>
      retainedTransactionIds.has(entry.transactionId),
    );
    return Object.freeze({
      schema: 'illustro.paint-persistence-snapshot/1' as const,
      paint,
      history: historyState,
      revisionHighWater: history.revisionHighWater,
      ...(this.#rasterStateEnabled
        ? {
            raster: Object.freeze({
              schema: 'illustro.paint-raster-state/1' as const,
              tileSize: CANONICAL_TILE_SIZE_PX,
              history: Object.freeze(rasterHistory),
            }),
          }
        : {}),
    });
  }

  async initialize(input: {
    readonly name: string;
    readonly document: PaintPersistenceNewDocumentInputV1;
  }): Promise<PaintPersistenceInitializeResultV1> {
    this.#assertNotDisposed();
    if (this.#status !== 'idle') throw new Error('paint persistence is already initialized');
    this.#setStatus('initializing');

    const resumeProjectId = this.#readResumeProjectId();
    try {
      if (resumeProjectId !== null) {
        const opened = parseStorageProjectState(
          await this.#request({
            type: 'storage.project.open',
            projectId: resumeProjectId,
          }),
        );
        const durable = parsePaintPersistenceProjectSnapshotV1(opened.snapshot);
        if (durable.paint.document.projectId !== opened.projectId) {
          throw new Error('recovered paint snapshot belongs to another project');
        }
        if (durable.paint.document.revision !== opened.documentRevision) {
          throw new Error('recovered paint revision disagrees with checkpoint metadata');
        }
        this.#adoptProject(opened);
        this.#resetRasterPersistenceState();
        if (durable.raster === undefined) {
          await this.#session.restoreProjectSnapshot(durable.paint);
          this.#history.reset();
          this.#rasterStateEnabled = true;
          await this.#migrateLegacyRasterSnapshot();
          await this.markDirty(crypto.randomUUID());
          await this.#flush('autosave');
        } else {
          this.#rasterStateEnabled = true;
          this.#indexDurableRasterState(durable);
          const tiles = await this.#loadCurrentRasterTiles(durable.paint);
          await this.#session.restoreCanonicalProjectSnapshot(durable.paint, tiles);
          this.#history.hydrate(durable.history, durable.revisionHighWater);
        }
        this.#rememberProject(opened.projectId);
        this.#setStatus('ready');
        return Object.freeze({
          schema: 'illustro.paint-persistence-initialize/1' as const,
          mode: 'recovered' as const,
          projectId: opened.projectId,
          sequence: this.#sequence,
          recoveryGeneration: this.#recoveryGeneration,
          documentRevision: this.#session.currentDocument()?.revision ?? opened.documentRevision,
        });
      }

      const projectId = createProjectId();
      const document = await this.#session.createNewDocument({ ...input.document, projectId });
      this.#history.reset();
      this.#resetRasterPersistenceState();
      this.#rasterStateEnabled = true;
      const created = parseStorageProjectState(
        await this.#request({
          type: 'storage.project.create',
          name: input.name,
          projectId,
          initialSnapshot: this.projectSnapshot(),
          documentRevision: document.revision,
        }),
      );
      if (created.projectId !== projectId)
        throw new Error('storage created an unexpected project ID');
      this.#adoptProject(created);
      this.#rememberProject(created.projectId);
      this.#setStatus('ready');
      return Object.freeze({
        schema: 'illustro.paint-persistence-initialize/1' as const,
        mode: 'created' as const,
        projectId: created.projectId,
        sequence: created.sequence,
        recoveryGeneration: created.recoveryGeneration,
        documentRevision: created.documentRevision,
      });
    } catch (error) {
      this.#fail(error);
      throw error;
    }
  }

  async openProject(
    projectIdValue: ProjectId | string,
  ): Promise<PaintPersistenceInitializeResultV1> {
    this.#assertNotDisposed();
    if (this.#status === 'initializing' || this.#status === 'saving') {
      throw new Error('paint persistence is busy');
    }
    const projectId = parseProjectId(projectIdValue);
    const previousProjectId = this.#projectId;
    try {
      if (previousProjectId !== null) {
        await this.#flush('autosave');
        await this.#request({ type: 'storage.project.close', projectId: previousProjectId });
      }
      this.#setStatus('initializing');
      const opened = parseStorageProjectState(
        await this.#request({ type: 'storage.project.open', projectId }),
      );
      const durable = parsePaintPersistenceProjectSnapshotV1(opened.snapshot);
      if (durable.paint.document.projectId !== opened.projectId) {
        throw new Error('opened paint snapshot belongs to another project');
      }
      if (durable.paint.document.revision !== opened.documentRevision) {
        throw new Error('opened paint revision disagrees with checkpoint metadata');
      }
      this.#adoptProject(opened);
      this.#resetRasterPersistenceState();
      if (durable.raster === undefined) {
        await this.#session.restoreProjectSnapshot(durable.paint);
        this.#history.reset();
        this.#rasterStateEnabled = true;
        await this.#migrateLegacyRasterSnapshot();
        await this.markDirty(crypto.randomUUID());
        await this.#flush('autosave');
      } else {
        this.#rasterStateEnabled = true;
        this.#indexDurableRasterState(durable);
        const tiles = await this.#loadCurrentRasterTiles(durable.paint);
        await this.#session.restoreCanonicalProjectSnapshot(durable.paint, tiles);
        this.#history.hydrate(durable.history, durable.revisionHighWater);
      }
      this.#rememberProject(opened.projectId);
      this.#setStatus('ready');
      return Object.freeze({
        schema: 'illustro.paint-persistence-initialize/1' as const,
        mode: 'recovered' as const,
        projectId: opened.projectId,
        sequence: this.#sequence,
        recoveryGeneration: this.#recoveryGeneration,
        documentRevision: this.#session.currentDocument()?.revision ?? opened.documentRevision,
      });
    } catch (error) {
      this.#fail(error);
      throw error;
    }
  }

  async createNewProject(input: {
    readonly name: string;
    readonly document: PaintPersistenceNewDocumentInputV1;
  }): Promise<PaintPersistenceInitializeResultV1> {
    this.#assertNotDisposed();
    if (this.#status === 'initializing' || this.#status === 'saving') {
      throw new Error('paint persistence is busy');
    }
    const previousProjectId = this.#projectId;
    this.#setStatus('initializing');
    try {
      if (previousProjectId !== null) {
        await this.#flush('autosave');
        await this.#request({ type: 'storage.project.close', projectId: previousProjectId });
      }
      const projectId = createProjectId();
      const document = await this.#session.createNewDocument({ ...input.document, projectId });
      this.#history.reset();
      this.#resetRasterPersistenceState();
      this.#rasterStateEnabled = true;
      const created = parseStorageProjectState(
        await this.#request({
          type: 'storage.project.create',
          name: input.name,
          projectId,
          initialSnapshot: this.projectSnapshot(),
          documentRevision: document.revision,
        }),
      );
      if (created.projectId !== projectId) {
        throw new Error('storage created an unexpected project ID');
      }
      this.#adoptProject(created);
      this.#rememberProject(created.projectId);
      this.#setStatus('ready');
      return Object.freeze({
        schema: 'illustro.paint-persistence-initialize/1' as const,
        mode: 'created' as const,
        projectId: created.projectId,
        sequence: created.sequence,
        recoveryGeneration: created.recoveryGeneration,
        documentRevision: created.documentRevision,
      });
    } catch (error) {
      this.#fail(error);
      throw error;
    }
  }

  async persistRasterTile(input: {
    readonly width: number;
    readonly height: number;
    readonly pixelFormat: PaintRasterTilePixelFormatV1;
    readonly bytes: Uint8Array | ArrayBuffer;
  }): Promise<PaintPersistedRasterTileV1> {
    this.#assertNotDisposed();
    this.#requireProject();
    const bytes = ownedArrayBuffer(input.bytes);
    const result = await this.#request(
      {
        type: 'storage.tile.put',
        kind: 'raster',
        width: input.width,
        height: input.height,
        pixelFormat: input.pixelFormat,
        bytes,
      },
      [bytes],
    );
    if (!isRecord(result) || !isRecord(result.object) || typeof result.object.hash !== 'string') {
      throw new TypeError('invalid persisted raster tile response');
    }
    const objectHash = result.object.hash;
    if (!isSha256Hex(objectHash)) throw new TypeError('persisted raster tile hash is invalid');
    if (!Number.isSafeInteger(result.rawByteLength) || (result.rawByteLength as number) < 1) {
      throw new TypeError('persisted raster tile raw length is invalid');
    }
    if (
      !Number.isSafeInteger(result.encodedByteLength) ||
      (result.encodedByteLength as number) < 1
    ) {
      throw new TypeError('persisted raster tile encoded length is invalid');
    }
    return Object.freeze({
      schema: 'illustro.paint-persisted-raster-tile/1' as const,
      payloadRef: paintRasterTilePayloadRefV1(objectHash),
      objectHash,
      codec: tileCodec(result.codec),
      pixelFormat: rasterPixelFormat(result.pixelFormat),
      width: positiveTileDimension(result.width, 'persisted raster tile width'),
      height: positiveTileDimension(result.height, 'persisted raster tile height'),
      rawByteLength: result.rawByteLength as number,
      encodedByteLength: result.encodedByteLength as number,
    });
  }

  async readRasterTile(payloadRef: string): Promise<PaintDecodedRasterTileV1> {
    this.#assertNotDisposed();
    this.#requireProject();
    const objectHash = parsePaintRasterTilePayloadRefV1(payloadRef);
    const result = await this.#request({
      type: 'storage.tile.get',
      objectHash,
    });
    if (!isRecord(result) || !(result.bytes instanceof ArrayBuffer)) {
      throw new TypeError('invalid decoded raster tile response');
    }
    const bytes = new Uint8Array(result.bytes);
    return Object.freeze({
      schema: 'illustro.paint-decoded-raster-tile/1' as const,
      payloadRef,
      objectHash,
      codec: tileCodec(result.codec),
      pixelFormat: rasterPixelFormat(result.pixelFormat),
      width: positiveTileDimension(result.width, 'decoded raster tile width'),
      height: positiveTileDimension(result.height, 'decoded raster tile height'),
      bytes,
    });
  }

  scheduleRasterTileTransaction(input: {
    readonly transactionId: CommandTransactionId | string;
    readonly strokeId: string;
    readonly beforeRevision: Revision | number;
    readonly afterRevision: Revision | number;
    readonly patches: readonly BaselineRasterTilePatchV1[];
  }): void {
    this.#assertNotDisposed();
    this.#requireProject();
    const transactionId = input.transactionId;
    if (!isCommandTransactionId(transactionId) || input.strokeId.length === 0) {
      throw new TypeError('raster tile transaction requires valid transaction/stroke identities');
    }
    if (input.patches.length === 0) {
      throw new TypeError('raster tile transaction requires affected patches');
    }
    const beforeRevision = parseRevision(input.beforeRevision);
    const afterRevision = parseRevision(input.afterRevision);
    if (afterRevision <= beforeRevision) {
      throw new RangeError('raster tile transaction revision must advance');
    }
    const patches = Object.freeze([...input.patches]);
    this.#enqueueTileTask(() =>
      this.#persistRasterTileTransaction({
        transactionId,
        strokeId: input.strokeId,
        beforeRevision,
        afterRevision,
        patches,
      }),
    );
  }

  scheduleRasterTileRestore(
    transactionId: string,
    direction: BaselineRasterTilePatchDirectionV1,
  ): void {
    this.#assertNotDisposed();
    this.#requireProject();
    if (!isCommandTransactionId(transactionId)) {
      throw new TypeError('raster tile restore transactionId must be a UUID');
    }
    const validatedTransactionId = transactionId;
    this.#enqueueTileTask(() => this.#persistRasterTileRestore(validatedTransactionId, direction));
  }

  async flushPendingRasterTiles(): Promise<void> {
    this.#assertNotDisposed();
    await this.#tileTail;
  }

  scheduleDirty(transactionIdValue: CommandTransactionId | string = crypto.randomUUID()): void {
    this.#assertNotDisposed();
    this.#requireProject();
    if (!isCommandTransactionId(transactionIdValue)) {
      throw new TypeError('paint persistence transactionId must be a UUID');
    }
    this.#scheduledDirtyTransactionId = transactionIdValue;
    if (this.#scheduledDirtyTimer !== null) return;
    this.#scheduledDirtyTimer = globalThis.setTimeout(() => {
      this.#scheduledDirtyTimer = null;
      void this.#flushScheduledDirty().catch(() => undefined);
    }, PAINT_DIRTY_COALESCE_MS);
  }

  async markDirty(
    transactionIdValue: CommandTransactionId | string = crypto.randomUUID(),
  ): Promise<void> {
    this.#assertNotDisposed();
    if (!isCommandTransactionId(transactionIdValue)) {
      throw new TypeError('paint persistence transactionId must be a UUID');
    }
    await this.#tileTail;
    await this.#flushScheduledDirty();
    await this.#enqueueDirtyNow(transactionIdValue);
  }

  #enqueueTileTask(operation: () => Promise<void>): void {
    const task = this.#tileTail.then(operation, operation);
    this.#tileTail = task;
    void task.catch((error: unknown) => this.#fail(error));
  }

  async #persistRasterTileTransaction(input: {
    readonly transactionId: CommandTransactionId;
    readonly strokeId: string;
    readonly beforeRevision: Revision;
    readonly afterRevision: Revision;
    readonly patches: readonly BaselineRasterTilePatchV1[];
  }): Promise<void> {
    const seen = new Set<string>();
    const references = await mapWithConcurrency(input.patches, 8, async (patch) => {
      const layerId = parseLayerId(patch.layerId);
      const key = rasterTileKey(layerId, patch.coordinate.tx, patch.coordinate.ty);
      if (seen.has(key)) throw new Error(`duplicate raster tile patch: ${key}`);
      seen.add(key);
      const current = this.#currentTileRefs.get(key);
      if (patch.before === null && current !== undefined) {
        throw new Error(`raster tile transaction before-state disagrees with storage: ${key}`);
      }
      const before =
        patch.before === null
          ? null
          : (current?.version ??
            (await this.#persistRasterTileVersion(patch.before, input.beforeRevision)));
      const after =
        patch.after === null
          ? null
          : await this.#persistRasterTileVersion(patch.after, input.afterRevision);
      return Object.freeze({
        schema: 'illustro.paint-raster-tile-patch-ref/1' as const,
        layerId,
        coordinate: Object.freeze({
          tx: patch.coordinate.tx,
          ty: patch.coordinate.ty,
        }),
        before,
        after,
      });
    });

    const historyReference = Object.freeze({
      schema: 'illustro.paint-raster-tile-history-ref/1' as const,
      transactionId: input.transactionId,
      patches: Object.freeze(references),
    });
    this.#historyTileRefs.set(input.transactionId, historyReference);
    this.#applyCurrentTileReferences(references, 'after');
    this.#session.markCommittedStrokeBaked(input.strokeId);
    this.#history.markTilePatchesDurable(input.transactionId);
    this.#pruneHistoryTileReferences();
    this.#rasterStateEnabled = true;
    this.scheduleDirty(input.transactionId);
  }

  async #persistRasterTileRestore(
    transactionId: string,
    direction: BaselineRasterTilePatchDirectionV1,
  ): Promise<void> {
    const reference = this.#historyTileRefs.get(transactionId);
    if (reference === undefined) {
      throw new Error(`persisted raster tile history is missing: ${transactionId}`);
    }
    this.#applyCurrentTileReferences(reference.patches, direction);
    this.scheduleDirty(crypto.randomUUID());
  }

  #applyCurrentTileReferences(
    patches: readonly PaintRasterTilePatchReferenceV1[],
    direction: BaselineRasterTilePatchDirectionV1,
  ): void {
    const updates = patches.map((patch) => {
      const selected = direction === 'before' ? patch.before : patch.after;
      const key = rasterTileKey(patch.layerId, patch.coordinate.tx, patch.coordinate.ty);
      if (selected === null) this.#currentTileRefs.delete(key);
      else {
        this.#currentTileRefs.set(
          key,
          Object.freeze({
            layerId: patch.layerId,
            coordinate: patch.coordinate,
            version: selected,
          }),
        );
      }
      return Object.freeze({
        layerId: patch.layerId,
        coordinate: patch.coordinate,
        revision: selected?.revision ?? parseRevision(0),
        payloadRef: selected?.payloadRef ?? null,
      });
    });
    this.#session.applyCanonicalRasterTileReferences(Object.freeze(updates));
  }

  async #persistRasterTileVersion(
    image: BaselineRasterTileImageV1,
    revision: Revision,
  ): Promise<PaintRasterTileVersionReferenceV1> {
    const persisted = await this.persistRasterTile({
      width: image.width,
      height: image.height,
      pixelFormat: image.pixelFormat,
      bytes: image.bytes,
    });
    if (
      persisted.width !== image.width ||
      persisted.height !== image.height ||
      persisted.pixelFormat !== image.pixelFormat
    ) {
      throw new Error('persisted raster tile metadata changed during encoding');
    }
    return Object.freeze({
      schema: 'illustro.paint-raster-tile-version-ref/1' as const,
      payloadRef: persisted.payloadRef,
      revision,
    });
  }

  #pruneHistoryTileReferences(): void {
    for (const transactionId of this.#history.takeRemovedTransactionIds()) {
      this.#historyTileRefs.delete(transactionId);
    }
  }

  #resetRasterPersistenceState(): void {
    this.#currentTileRefs.clear();
    this.#historyTileRefs.clear();
    this.#rasterStateEnabled = false;
  }

  #indexDurableRasterState(snapshot: PaintPersistenceProjectSnapshotV1): void {
    const raster = snapshot.raster;
    if (raster === undefined) throw new Error('durable raster state is missing');
    for (const layer of Object.values(snapshot.paint.document.layerTree.layers)) {
      if (layer.type !== 'raster') continue;
      for (const tile of (layer as RasterLayerV1).tiles) {
        parsePaintRasterTilePayloadRefV1(tile.payloadRef);
        const version = Object.freeze({
          schema: 'illustro.paint-raster-tile-version-ref/1' as const,
          payloadRef: tile.payloadRef,
          revision: parseRevision(tile.revision),
        });
        this.#currentTileRefs.set(
          rasterTileKey(layer.id, tile.x, tile.y),
          Object.freeze({
            layerId: layer.id,
            coordinate: Object.freeze({ tx: tile.x, ty: tile.y }),
            version,
          }),
        );
      }
    }
    for (const entry of raster.history) this.#historyTileRefs.set(entry.transactionId, entry);
  }

  async #migrateLegacyRasterSnapshot(): Promise<void> {
    const document = this.#session.currentDocument();
    if (document === null) throw new Error('legacy raster migration requires an active document');
    const tiles = await this.#session.exportCanonicalRasterTiles();
    const references = await mapWithConcurrency(tiles, 8, async (tile) => {
      const version = await this.#persistRasterTileVersion(tile, document.revision);
      return Object.freeze({
        layerId: tile.layerId,
        coordinate: tile.coordinate,
        version,
      });
    });
    this.#currentTileRefs.clear();
    const updates = references.map((entry) => {
      this.#currentTileRefs.set(
        rasterTileKey(entry.layerId, entry.coordinate.tx, entry.coordinate.ty),
        entry,
      );
      return Object.freeze({
        layerId: entry.layerId,
        coordinate: entry.coordinate,
        revision: entry.version.revision,
        payloadRef: entry.version.payloadRef,
      });
    });
    this.#session.applyCanonicalRasterTileReferences(Object.freeze(updates));
    this.#session.markAllCommittedStrokesBaked();
  }

  async #loadCurrentRasterTiles(
    paint: PaintProjectSnapshotV1,
  ): Promise<readonly BaselineRasterTileImageV1[]> {
    return mapWithConcurrency([...this.#currentTileRefs.values()], 8, (entry) =>
      this.#loadRasterTileImage(paint, entry.layerId, entry.coordinate, entry.version),
    );
  }

  async #loadTilePatches(
    transactionId: string,
  ): Promise<readonly BaselineRasterTilePatchV1[] | null> {
    const reference = this.#historyTileRefs.get(transactionId);
    const paint = this.#session.persistenceProjectSnapshot();
    if (reference === undefined || paint === null) return null;
    return mapWithConcurrency(reference.patches, 8, async (patch) => {
      const [before, after] = await Promise.all([
        patch.before === null
          ? null
          : this.#loadRasterTileImage(paint, patch.layerId, patch.coordinate, patch.before),
        patch.after === null
          ? null
          : this.#loadRasterTileImage(paint, patch.layerId, patch.coordinate, patch.after),
      ]);
      return Object.freeze({
        schema: 'illustro.baseline-raster-tile-patch/1' as const,
        layerId: patch.layerId,
        coordinate: patch.coordinate,
        before,
        after,
      });
    });
  }

  async #loadRasterTileImage(
    paint: PaintProjectSnapshotV1,
    layerIdValue: string,
    coordinate: { readonly tx: number; readonly ty: number },
    version: PaintRasterTileVersionReferenceV1,
  ): Promise<BaselineRasterTileImageV1> {
    const layerId = parseLayerId(layerIdValue);
    if (paint.document.layerTree.layers[layerId]?.type !== 'raster') {
      throw new Error(`persisted raster tile targets a missing layer: ${layerId}`);
    }
    const bounds = tileBoundsForDocumentV1(
      paint.document.canvas.width,
      paint.document.canvas.height,
      coordinate,
    );
    const decoded = await this.readRasterTile(version.payloadRef);
    if (
      decoded.width !== bounds.validWidth ||
      decoded.height !== bounds.validHeight ||
      decoded.pixelFormat !== paint.document.color.precision
    ) {
      throw new Error('decoded raster tile violates the document tile contract');
    }
    return Object.freeze({
      schema: 'illustro.baseline-raster-tile/1' as const,
      layerId,
      coordinate: Object.freeze({ tx: coordinate.tx, ty: coordinate.ty }),
      width: decoded.width,
      height: decoded.height,
      pixelFormat: decoded.pixelFormat,
      bytes: decoded.bytes,
    });
  }

  async #flushScheduledDirty(): Promise<void> {
    const transactionId = this.#scheduledDirtyTransactionId;
    if (transactionId === null) return;
    this.#scheduledDirtyTransactionId = null;
    if (this.#scheduledDirtyTimer !== null) {
      globalThis.clearTimeout(this.#scheduledDirtyTimer);
      this.#scheduledDirtyTimer = null;
    }
    await this.#enqueueDirtyNow(transactionId);
  }

  #enqueueDirtyNow(transactionId: CommandTransactionId): Promise<void> {
    const task = this.#dirtyTail.then(
      () => this.#markDirtyNow(transactionId),
      () => this.#markDirtyNow(transactionId),
    );
    this.#dirtyTail = task;
    return task;
  }

  async #markDirtyNow(transactionId: CommandTransactionId): Promise<void> {
    this.#assertNotDisposed();
    const projectId = this.#requireProject();
    const document = this.#session.currentDocument();
    if (document === null) throw new Error('paint persistence requires an active document');
    const nextSequence = this.#sequence + 1;
    if (!Number.isSafeInteger(nextSequence))
      throw new RangeError('paint persistence sequence exhausted');
    try {
      await this.#request({
        type: 'storage.persistence.markDirty',
        projectId,
        transactionId,
        sequence: nextSequence,
        documentRevision: document.revision,
        snapshot: this.projectSnapshot(),
      });
      this.#sequence = nextSequence;
      this.#lastError = null;
      this.#setStatus('dirty');
    } catch (error) {
      this.#fail(error);
      throw error;
    }
  }

  async flushRecovery(): Promise<void> {
    if (this.#projectId === null) return;
    await this.#flush('recovery');
  }

  async flushCheckpoint(): Promise<void> {
    if (this.#projectId === null) return;
    await this.#flush('autosave');
  }

  async close(): Promise<void> {
    this.#assertNotDisposed();
    const projectId = this.#projectId;
    if (projectId === null) return;
    await this.flushCheckpoint();
    await this.#request({ type: 'storage.project.close', projectId });
    this.#setStatus('idle');
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    if (this.#scheduledDirtyTimer !== null) {
      globalThis.clearTimeout(this.#scheduledDirtyTimer);
      this.#scheduledDirtyTimer = null;
    }
    this.#scheduledDirtyTransactionId = null;
    this.#history.setTilePatchLoader(null);
    this.#session.setRasterMaskTileLoader(null);
    this.#worker.removeEventListener('message', this.#messageListener);
    for (const pending of this.#pending.values()) {
      globalThis.clearTimeout(pending.timeout);
      pending.reject(new Error('paint persistence controller disposed'));
    }
    this.#pending.clear();
    this.#currentTileRefs.clear();
    this.#historyTileRefs.clear();
    this.#status = 'disposed';
    this.#publish();
  }

  async #flush(reason: 'recovery' | 'autosave'): Promise<void> {
    this.#assertNotDisposed();
    await this.#tileTail;
    await this.#flushScheduledDirty();
    await this.#dirtyTail;
    const projectId = this.#requireProject();
    const previousStatus = this.#status;
    this.#setStatus('saving');
    try {
      await this.#request({
        type: 'storage.persistence.flush',
        projectId,
        reason,
      });
      this.#lastError = null;
      this.#setStatus('ready');
    } catch (error) {
      this.#status = previousStatus;
      this.#fail(error);
      throw error;
    }
  }

  #request(
    message: Readonly<Record<string, unknown>>,
    transfer: readonly Transferable[] = [],
  ): Promise<unknown> {
    this.#assertNotDisposed();
    const requestId = crypto.randomUUID();
    return new Promise((resolve, reject) => {
      const timeout = globalThis.setTimeout(() => {
        this.#pending.delete(requestId);
        reject(new Error(`storage request timed out: ${String(message.type)}`));
      }, PAINT_STORAGE_REQUEST_TIMEOUT_MS);
      this.#pending.set(requestId, { resolve, reject, timeout });
      try {
        this.#worker.postMessage({ ...message, requestId }, transfer);
      } catch (error) {
        globalThis.clearTimeout(timeout);
        this.#pending.delete(requestId);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  #handleWorkerMessage(value: unknown): void {
    if (!isRecord(value) || typeof value.type !== 'string') return;
    if (value.type === 'storage.response' && typeof value.requestId === 'string') {
      const pending = this.#pending.get(value.requestId);
      if (pending === undefined) return;
      this.#pending.delete(value.requestId);
      globalThis.clearTimeout(pending.timeout);
      if (value.ok === true) pending.resolve(value.result);
      else pending.reject(new Error(storageErrorMessage(value.error)));
      return;
    }
    if (value.type === 'storage.persistence.flushed') {
      if (value.projectId !== this.#projectId || !isRecord(value.result)) return;
      if (
        Number.isSafeInteger(value.result.recoveryGeneration) &&
        (value.result.recoveryGeneration as number) >= 1
      ) {
        this.#recoveryGeneration = value.result.recoveryGeneration as number;
      }
      if (isCommandTransactionId(value.result.transactionId)) {
        this.#lastDurableTransactionId = value.result.transactionId;
      }
      this.#lastError = null;
      this.#publish();
      return;
    }
    if (value.type === 'storage.autosave.settled' && value.projectId === this.#projectId) {
      this.#lastError = null;
      if (this.#status === 'dirty' || this.#status === 'saving') this.#setStatus('ready');
      else this.#publish();
      return;
    }
    if (value.type === 'storage.persistence.error') {
      this.#fail(new Error(storageErrorMessage(value.error)));
    }
  }

  #adoptProject(project: StorageProjectStateV1): void {
    this.#projectId = project.projectId;
    this.#sequence = project.sequence;
    this.#recoveryGeneration = project.recoveryGeneration;
    this.#lastDurableTransactionId = null;
    this.#lastError = null;
  }

  #readResumeProjectId(): ProjectId | null {
    if (this.#resumeStore === null) return null;
    try {
      const value = this.#resumeStore.getItem(PAINT_RESUME_PROJECT_KEY_V1);
      if (value === null) return null;
      try {
        return parseProjectId(value);
      } catch {
        this.#resumeStore.removeItem(PAINT_RESUME_PROJECT_KEY_V1);
        return null;
      }
    } catch {
      return null;
    }
  }

  #rememberProject(projectId: ProjectId): void {
    if (this.#resumeStore === null) return;
    try {
      this.#resumeStore.setItem(PAINT_RESUME_PROJECT_KEY_V1, projectId);
    } catch {
      // Resume metadata is advisory; OPFS remains canonical.
    }
  }

  #requireProject(): ProjectId {
    if (this.#projectId === null) throw new Error('paint persistence project is not initialized');
    return this.#projectId;
  }

  #assertNotDisposed(): void {
    if (this.#disposed) throw new Error('paint persistence controller is disposed');
  }

  #setStatus(status: PaintPersistenceStatusV1): void {
    this.#status = status;
    this.#publish();
  }

  #fail(error: unknown): void {
    this.#status = 'error';
    this.#lastError = error instanceof Error ? error.message : String(error);
    this.#publish();
  }

  #publish(): void {
    this.#onState(this.snapshot());
  }
}
