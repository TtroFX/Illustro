import type { DocumentV1 } from '../domain/document.js';
import type { LayerId, MaskId, Revision } from '../domain/identity.js';
import type {
  LayerBaseV1,
  RasterMaskAttachmentV1,
  RasterTileReferenceV1,
} from '../domain/layers.js';
import {
  BaselineBrushDabBuilderV1,
  baselineDabRadiusXV1,
  baselineDabRadiusYV1,
  planBaselineBrushTilesV1,
  type BaselineBrushDabV1,
} from '../gpu/baseline-brush.js';
import { tileBoundsForDocumentV1 } from '../gpu/sparse-tile-model.js';
import type { PointerInputBatchV1, PointerInputSampleV1 } from '../input/pointer-input.js';
import type { PaintHistoryControllerV1 } from './paint-history-controller.js';
import type {
  PaintDecodedRasterTileV1,
  PaintPersistenceControllerV1,
  PaintPersistedRasterTileV1,
} from './paint-persistence-controller.js';
import type {
  PaintProjectSnapshotV1,
  PaintSessionControllerV1,
} from './paint-session-controller.js';

export type MaskPaintValueV1 = 0 | 1;

export interface MaskPaintPersistencePortV1 {
  readRasterTile(payloadRef: string): Promise<PaintDecodedRasterTileV1>;
  persistRasterTile(input: {
    readonly width: number;
    readonly height: number;
    readonly pixelFormat: 'rgba8-unorm';
    readonly bytes: Uint8Array | ArrayBuffer;
  }): Promise<PaintPersistedRasterTileV1>;
}

export interface PreparedMaskPaintTileV1 {
  readonly x: number;
  readonly y: number;
  readonly payloadRef: string;
}

export interface PreparedMaskPaintV1 {
  readonly schema: 'illustro.prepared-mask-paint/1';
  readonly layerId: LayerId;
  readonly maskId: MaskId;
  readonly sourceLayerRevision: Revision;
  readonly sourceMaskRevision: Revision;
  readonly documentRevision: Revision;
  readonly paintValue: MaskPaintValueV1;
  readonly tiles: readonly PreparedMaskPaintTileV1[];
}

export interface CompletedMaskPaintStrokeV1 {
  readonly schema: 'illustro.completed-mask-paint-stroke/1';
  readonly strokeId: string;
  readonly layerId: LayerId;
  readonly maskId: MaskId;
  readonly paintValue: MaskPaintValueV1;
  readonly dabs: readonly BaselineBrushDabV1[];
}

export interface MaskPaintControllerSnapshotV1 {
  readonly schema: 'illustro.mask-paint-controller/1';
  readonly layerId: LayerId | null;
  readonly maskId: MaskId | null;
  readonly paintValue: MaskPaintValueV1;
  readonly activePointerId: number | null;
  readonly activeDabCount: number;
}

export interface MaskPaintIngestResultV1 {
  readonly consumed: boolean;
  readonly completed: CompletedMaskPaintStrokeV1 | null;
}

export interface MaskPaintCommitResultV1 {
  readonly transactionId: string;
  readonly affectedTileCount: number;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function findRasterMaskV1(
  snapshot: PaintProjectSnapshotV1,
  layerId: LayerId,
  maskId: MaskId,
): { readonly layer: LayerBaseV1; readonly mask: RasterMaskAttachmentV1 } {
  const layer = snapshot.document.layerTree.layers[layerId];
  if (layer === undefined) throw new Error(`mask paint layer is missing: ${layerId}`);
  const mask = layer.masks.find((entry) => entry.id === maskId);
  if (mask === undefined) throw new Error(`mask paint target is missing: ${maskId}`);
  if (mask.kind !== 'raster-mask') throw new Error('mask painting requires a Raster Mask');
  return Object.freeze({ layer, mask });
}

function assertMaskPaintableV1(layer: LayerBaseV1): void {
  if (layer.type === 'lineartBoundary') {
    throw new Error('Lineart Boundary layers cannot receive artwork mask painting');
  }
  if (layer.locks.all) throw new Error('mask painting is blocked by the layer lock');
}

function maskTileBytesV1(width: number, height: number, coverage: 0 | 1): Uint8Array<ArrayBuffer> {
  const value = coverage * 255;
  const bytes = new Uint8Array(width * height * 4);
  for (let offset = 0; offset < bytes.byteLength; offset += 4) {
    bytes[offset] = value;
    bytes[offset + 1] = value;
    bytes[offset + 2] = value;
    bytes[offset + 3] = 255;
  }
  return bytes;
}

function assertMaskTileV1(tile: PaintDecodedRasterTileV1, width: number, height: number): void {
  if (tile.pixelFormat !== 'rgba8-unorm' || tile.width !== width || tile.height !== height) {
    throw new Error('canonical mask tile does not match the document tile contract');
  }
  if (tile.bytes.byteLength !== width * height * 4) {
    throw new Error('canonical mask tile byte length is invalid');
  }
}

export function rasterizeMaskCoverageTileV1(
  source: Uint8Array,
  input: {
    readonly tileDocumentX: number;
    readonly tileDocumentY: number;
    readonly width: number;
    readonly height: number;
    readonly paintValue: MaskPaintValueV1;
    readonly dabs: readonly BaselineBrushDabV1[];
  },
): Uint8Array<ArrayBuffer> {
  if (source.byteLength !== input.width * input.height * 4) {
    throw new RangeError('mask coverage source byte length does not match dimensions');
  }
  const output = new Uint8Array(source);
  for (const dab of input.dabs) {
    const radiusX = baselineDabRadiusXV1(dab);
    const radiusY = baselineDabRadiusYV1(dab);
    const minX = Math.max(0, Math.floor(dab.x - radiusX - input.tileDocumentX));
    const minY = Math.max(0, Math.floor(dab.y - radiusY - input.tileDocumentY));
    const maxX = Math.min(input.width - 1, Math.ceil(dab.x + radiusX - input.tileDocumentX) - 1);
    const maxY = Math.min(input.height - 1, Math.ceil(dab.y + radiusY - input.tileDocumentY) - 1);
    if (maxX < minX || maxY < minY) continue;
    for (let y = minY; y <= maxY; y += 1) {
      const documentY = input.tileDocumentY + y + 0.5;
      const localY = (documentY - dab.y) / radiusY;
      for (let x = minX; x <= maxX; x += 1) {
        const documentX = input.tileDocumentX + x + 0.5;
        const localX = (documentX - dab.x) / radiusX;
        const radialDistance = Math.hypot(localX, localY);
        if (radialDistance >= 1) continue;
        const coverage = 1 - smoothstep(0.85, 1, radialDistance);
        const strength = clamp01(dab.opacity * coverage);
        if (strength <= 0) continue;
        const offset = (y * input.width + x) * 4;
        const current = (output[offset] ?? 0) / 255;
        const next = current + (input.paintValue - current) * strength;
        const encoded = Math.round(clamp01(next) * 255);
        output[offset] = encoded;
        output[offset + 1] = encoded;
        output[offset + 2] = encoded;
        output[offset + 3] = 255;
      }
    }
  }
  return output;
}

export async function prepareMaskPaintV1(
  snapshot: PaintProjectSnapshotV1,
  layerId: LayerId,
  maskId: MaskId,
  paintValue: MaskPaintValueV1,
  dabs: readonly BaselineBrushDabV1[],
  persistence: MaskPaintPersistencePortV1,
): Promise<PreparedMaskPaintV1> {
  if (paintValue !== 0 && paintValue !== 1) throw new RangeError('mask paint value must be 0 or 1');
  if (dabs.length === 0) throw new Error('mask paint requires at least one confirmed dab');
  const { layer, mask } = findRasterMaskV1(snapshot, layerId, maskId);
  assertMaskPaintableV1(layer);
  const width = snapshot.document.canvas.width;
  const height = snapshot.document.canvas.height;
  const plans = planBaselineBrushTilesV1(dabs, width, height);
  if (plans.length === 0) throw new Error('mask paint stroke does not intersect the document');
  const prepared: PreparedMaskPaintTileV1[] = [];
  for (const plan of plans) {
    const bounds = tileBoundsForDocumentV1(width, height, plan.coordinate);
    const existing = mask.tiles.find(
      (tile) => tile.x === plan.coordinate.tx && tile.y === plan.coordinate.ty,
    );
    let source: Uint8Array<ArrayBuffer>;
    if (existing === undefined) {
      source = maskTileBytesV1(bounds.validWidth, bounds.validHeight, mask.defaultCoverage);
    } else {
      const decoded = await persistence.readRasterTile(existing.payloadRef);
      assertMaskTileV1(decoded, bounds.validWidth, bounds.validHeight);
      source = new Uint8Array(decoded.bytes);
    }
    const bytes = rasterizeMaskCoverageTileV1(source, {
      tileDocumentX: bounds.x,
      tileDocumentY: bounds.y,
      width: bounds.validWidth,
      height: bounds.validHeight,
      paintValue,
      dabs: plan.dabs,
    });
    const persisted = await persistence.persistRasterTile({
      width: bounds.validWidth,
      height: bounds.validHeight,
      pixelFormat: 'rgba8-unorm',
      bytes,
    });
    prepared.push(
      Object.freeze({
        x: plan.coordinate.tx,
        y: plan.coordinate.ty,
        payloadRef: persisted.payloadRef,
      }),
    );
  }
  return Object.freeze({
    schema: 'illustro.prepared-mask-paint/1' as const,
    layerId,
    maskId,
    sourceLayerRevision: layer.revision,
    sourceMaskRevision: mask.revision,
    documentRevision: snapshot.document.revision,
    paintValue,
    tiles: Object.freeze(prepared),
  });
}

export function applyPreparedMaskPaintV1(
  snapshot: PaintProjectSnapshotV1,
  prepared: PreparedMaskPaintV1,
  revision: Revision,
  now: Date = new Date(),
): PaintProjectSnapshotV1 {
  if (snapshot.document.revision !== prepared.documentRevision) {
    throw new Error('mask paint document changed before commit');
  }
  const { layer, mask } = findRasterMaskV1(snapshot, prepared.layerId, prepared.maskId);
  assertMaskPaintableV1(layer);
  if (
    layer.revision !== prepared.sourceLayerRevision ||
    mask.revision !== prepared.sourceMaskRevision
  ) {
    throw new Error('mask paint target changed before commit');
  }
  const tiles = new Map<string, RasterTileReferenceV1>();
  for (const tile of mask.tiles) tiles.set(`${tile.x}:${tile.y}`, tile);
  for (const tile of prepared.tiles) {
    tiles.set(
      `${tile.x}:${tile.y}`,
      Object.freeze({ x: tile.x, y: tile.y, revision, payloadRef: tile.payloadRef }),
    );
  }
  const nextMask = Object.freeze({
    ...mask,
    revision,
    tiles: Object.freeze(
      [...tiles.values()].sort((left, right) => left.y - right.y || left.x - right.x),
    ),
  });
  const nextLayer = Object.freeze({
    ...layer,
    revision,
    masks: Object.freeze(layer.masks.map((entry) => (entry.id === mask.id ? nextMask : entry))),
  }) as LayerBaseV1;
  return Object.freeze({
    ...snapshot,
    document: Object.freeze({
      ...snapshot.document,
      revision,
      modifiedAt: now.toISOString(),
      layerTree: Object.freeze({
        rootLayerIds: snapshot.document.layerTree.rootLayerIds,
        layers: Object.freeze({
          ...snapshot.document.layerTree.layers,
          [prepared.layerId]: nextLayer,
        }),
      }),
    }),
  });
}

interface ActiveStrokeV1 {
  readonly pointerId: number;
  readonly strokeId: string;
  readonly layerId: LayerId;
  readonly maskId: MaskId;
  readonly paintValue: MaskPaintValueV1;
  readonly builder: BaselineBrushDabBuilderV1;
}

export class MaskPaintControllerV1 {
  readonly #paintSession: PaintSessionControllerV1;
  readonly #paintHistory: PaintHistoryControllerV1;
  readonly #paintPersistence: PaintPersistenceControllerV1;
  readonly #mapPointerToDocument: (
    sample: PointerInputSampleV1,
    document: DocumentV1,
  ) => {
    readonly x: number;
    readonly y: number;
  };
  #layerId: LayerId | null = null;
  #maskId: MaskId | null = null;
  #paintValue: MaskPaintValueV1 = 0;
  #activeStroke: ActiveStrokeV1 | null = null;
  #disposed = false;

  constructor(options: {
    readonly paintSession: PaintSessionControllerV1;
    readonly paintHistory: PaintHistoryControllerV1;
    readonly paintPersistence: PaintPersistenceControllerV1;
    readonly mapPointerToDocument: (
      sample: PointerInputSampleV1,
      document: DocumentV1,
    ) => { readonly x: number; readonly y: number };
  }) {
    this.#paintSession = options.paintSession;
    this.#paintHistory = options.paintHistory;
    this.#paintPersistence = options.paintPersistence;
    this.#mapPointerToDocument = options.mapPointerToDocument;
  }

  snapshot(): MaskPaintControllerSnapshotV1 {
    return Object.freeze({
      schema: 'illustro.mask-paint-controller/1' as const,
      layerId: this.#layerId,
      maskId: this.#maskId,
      paintValue: this.#paintValue,
      activePointerId: this.#activeStroke?.pointerId ?? null,
      activeDabCount: this.#activeStroke?.builder.dabCount() ?? 0,
    });
  }

  isTarget(layerId: LayerId, maskId: MaskId): boolean {
    return this.#layerId === layerId && this.#maskId === maskId;
  }

  selectMask(layerId: LayerId, maskId: MaskId): MaskPaintControllerSnapshotV1 {
    this.#assertReady();
    if (this.#activeStroke !== null)
      throw new Error('cannot switch masks while a mask stroke is active');
    const snapshot = this.#paintSession.projectSnapshot();
    if (snapshot === null) throw new Error('mask editing requires an active document');
    const { layer } = findRasterMaskV1(snapshot, layerId, maskId);
    assertMaskPaintableV1(layer);
    this.#layerId = layerId;
    this.#maskId = maskId;
    return this.snapshot();
  }

  clearTarget(): MaskPaintControllerSnapshotV1 {
    if (this.#activeStroke !== null)
      throw new Error('cannot clear mask target while a stroke is active');
    this.#layerId = null;
    this.#maskId = null;
    return this.snapshot();
  }

  setPaintValue(value: MaskPaintValueV1): MaskPaintControllerSnapshotV1 {
    if (value !== 0 && value !== 1) throw new RangeError('mask paint value must be 0 or 1');
    this.#paintValue = value;
    return this.snapshot();
  }

  validateTarget(): MaskPaintControllerSnapshotV1 {
    if (this.#layerId === null || this.#maskId === null) return this.snapshot();
    const snapshot = this.#paintSession.projectSnapshot();
    try {
      if (snapshot === null) throw new Error('no document');
      findRasterMaskV1(snapshot, this.#layerId, this.#maskId);
    } catch {
      if (this.#activeStroke === null) {
        this.#layerId = null;
        this.#maskId = null;
      }
    }
    return this.snapshot();
  }

  ingestPointerBatch(batch: PointerInputBatchV1): MaskPaintIngestResultV1 {
    this.#assertReady();
    if (this.#layerId === null || this.#maskId === null) {
      return Object.freeze({ consumed: false, completed: null });
    }
    const document = this.#paintSession.currentDocument();
    if (document === null) return Object.freeze({ consumed: false, completed: null });
    const confirmed = batch.confirmed.filter(
      (sample) => sample.source === 'pen' || sample.source === 'mouse',
    );
    if (batch.eventType === 'pointerdown') {
      if (confirmed.length === 0 || this.#activeStroke !== null) {
        return Object.freeze({ consumed: false, completed: null });
      }
      const builder = new BaselineBrushDabBuilderV1();
      const points = confirmed.map((sample) => {
        const point = this.#mapPointerToDocument(sample, document);
        return Object.freeze({ documentX: point.x, documentY: point.y });
      });
      const first = points[0];
      if (first === undefined) return Object.freeze({ consumed: false, completed: null });
      builder.beginDelta(first);
      builder.appendDelta(points.slice(1));
      this.#activeStroke = Object.freeze({
        pointerId: batch.pointerId,
        strokeId: crypto.randomUUID(),
        layerId: this.#layerId,
        maskId: this.#maskId,
        paintValue: this.#paintValue,
        builder,
      });
      return Object.freeze({ consumed: true, completed: null });
    }
    const active = this.#activeStroke;
    if (active === null || active.pointerId !== batch.pointerId) {
      return Object.freeze({ consumed: false, completed: null });
    }
    if (batch.eventType === 'pointercancel') {
      this.#activeStroke = null;
      return Object.freeze({ consumed: true, completed: null });
    }
    const points = confirmed.map((sample) => {
      const point = this.#mapPointerToDocument(sample, document);
      return Object.freeze({ documentX: point.x, documentY: point.y });
    });
    active.builder.appendDelta(points);
    if (batch.eventType !== 'pointerup') {
      return Object.freeze({ consumed: true, completed: null });
    }
    active.builder.finishDelta();
    this.#activeStroke = null;
    return Object.freeze({
      consumed: true,
      completed: Object.freeze({
        schema: 'illustro.completed-mask-paint-stroke/1' as const,
        strokeId: active.strokeId,
        layerId: active.layerId,
        maskId: active.maskId,
        paintValue: active.paintValue,
        dabs: active.builder.dabs(),
      }),
    });
  }

  async commitCompletedStroke(
    completed: CompletedMaskPaintStrokeV1,
  ): Promise<MaskPaintCommitResultV1> {
    this.#assertReady();
    const snapshot = this.#paintSession.projectSnapshot();
    if (snapshot === null) throw new Error('mask paint commit requires an active document');
    const prepared = await prepareMaskPaintV1(
      snapshot,
      completed.layerId,
      completed.maskId,
      completed.paintValue,
      completed.dabs,
      this.#paintPersistence,
    );
    const transaction = await this.#paintHistory.commitSnapshotTransform(
      'mask.paint',
      (before, revision) => applyPreparedMaskPaintV1(before, prepared, revision),
    );
    await this.#paintPersistence.markDirty(transaction.transactionId);
    return Object.freeze({
      transactionId: transaction.transactionId,
      affectedTileCount: prepared.tiles.length,
    });
  }

  dispose(): void {
    this.#activeStroke = null;
    this.#layerId = null;
    this.#maskId = null;
    this.#disposed = true;
  }

  #assertReady(): void {
    if (this.#disposed) throw new Error('mask paint controller is disposed');
  }
}
