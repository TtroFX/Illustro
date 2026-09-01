from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    target = Path(path)
    text = target.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'expected one anchor in {path}; found {count}: {old[:180]!r}')
    target.write_text(text.replace(old, new, 1))


Path('src/app/layer-mask-paint.ts').write_text(r'''import type { DocumentV1 } from '../domain/document.js';
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
import type { PaintProjectSnapshotV1, PaintSessionControllerV1 } from './paint-session-controller.js';

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
    const maxX = Math.min(
      input.width - 1,
      Math.ceil(dab.x + radiusX - input.tileDocumentX) - 1,
    );
    const maxY = Math.min(
      input.height - 1,
      Math.ceil(dab.y + radiusY - input.tileDocumentY) - 1,
    );
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
  if (layer.revision !== prepared.sourceLayerRevision || mask.revision !== prepared.sourceMaskRevision) {
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
  readonly #mapPointerToDocument: (sample: PointerInputSampleV1, document: DocumentV1) => {
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
    if (this.#activeStroke !== null) throw new Error('cannot switch masks while a mask stroke is active');
    const snapshot = this.#paintSession.projectSnapshot();
    if (snapshot === null) throw new Error('mask editing requires an active document');
    const { layer } = findRasterMaskV1(snapshot, layerId, maskId);
    assertMaskPaintableV1(layer);
    this.#layerId = layerId;
    this.#maskId = maskId;
    return this.snapshot();
  }

  clearTarget(): MaskPaintControllerSnapshotV1 {
    if (this.#activeStroke !== null) throw new Error('cannot clear mask target while a stroke is active');
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
''')

Path('tests/unit/layer-mask-paint.test.ts').write_text(r'''import { describe, expect, it } from 'vitest';
import {
  applyPreparedMaskPaintV1,
  prepareMaskPaintV1,
  rasterizeMaskCoverageTileV1,
  type MaskPaintPersistencePortV1,
} from '../../src/app/layer-mask-paint.js';
import type {
  PaintDecodedRasterTileV1,
  PaintPersistedRasterTileV1,
} from '../../src/app/paint-persistence-controller.js';
import type { PaintProjectSnapshotV1 } from '../../src/app/paint-session-controller.js';
import { createDocumentV1 } from '../../src/domain/document.js';
import { parseRevision } from '../../src/domain/identity.js';
import { createRasterLayer, createRasterMask } from '../../src/domain/layers.js';
import type { BaselineBrushDabV1 } from '../../src/gpu/baseline-brush.js';

class FakePersistence implements MaskPaintPersistencePortV1 {
  readonly tiles = new Map<string, PaintDecodedRasterTileV1>();
  readonly writes: PaintPersistedRasterTileV1[] = [];

  async readRasterTile(payloadRef: string): Promise<PaintDecodedRasterTileV1> {
    const tile = this.tiles.get(payloadRef);
    if (tile === undefined) throw new Error(`missing fake tile: ${payloadRef}`);
    return tile;
  }

  async persistRasterTile(input: {
    readonly width: number;
    readonly height: number;
    readonly pixelFormat: 'rgba8-unorm';
    readonly bytes: Uint8Array | ArrayBuffer;
  }): Promise<PaintPersistedRasterTileV1> {
    const index = this.writes.length + 1;
    const objectHash = String(index).padStart(64, '0');
    const payloadRef = `sha256:${objectHash}`;
    const bytes = input.bytes instanceof Uint8Array ? new Uint8Array(input.bytes) : new Uint8Array(input.bytes);
    const decoded: PaintDecodedRasterTileV1 = Object.freeze({
      schema: 'illustro.paint-decoded-raster-tile/1' as const,
      payloadRef,
      objectHash,
      codec: 'raw' as const,
      pixelFormat: 'rgba8-unorm' as const,
      width: input.width,
      height: input.height,
      bytes,
    });
    this.tiles.set(payloadRef, decoded);
    const persisted: PaintPersistedRasterTileV1 = Object.freeze({
      schema: 'illustro.paint-persisted-raster-tile/1' as const,
      payloadRef,
      objectHash,
      codec: 'raw' as const,
      pixelFormat: 'rgba8-unorm' as const,
      width: input.width,
      height: input.height,
      rawByteLength: bytes.byteLength,
      encodedByteLength: bytes.byteLength,
    });
    this.writes.push(persisted);
    return persisted;
  }
}

function fixture(defaultCoverage: 0 | 1 = 1): {
  readonly snapshot: PaintProjectSnapshotV1;
  readonly layer: ReturnType<typeof createRasterLayer>;
  readonly mask: ReturnType<typeof createRasterMask>;
} {
  const mask = createRasterMask({ defaultCoverage });
  const layer = createRasterLayer({ name: 'Masked', masks: [mask] });
  const document = createDocumentV1({ width: 32, height: 32 });
  return {
    snapshot: Object.freeze({
      schema: 'illustro.paint-project-snapshot/1' as const,
      document: Object.freeze({
        ...document,
        layerTree: Object.freeze({
          rootLayerIds: Object.freeze([layer.id]),
          layers: Object.freeze({ [layer.id]: layer }),
        }),
      }),
      committedStrokes: Object.freeze([]),
    }),
    layer,
    mask,
  };
}

const centerDab: BaselineBrushDabV1 = Object.freeze({
  schema: 'illustro.baseline-brush-dab/1' as const,
  x: 16,
  y: 16,
  radius: 8,
  opacity: 1,
});

describe('M5B mask painting', () => {
  it('paints hide coverage into a canonical RGBA8 mask tile without changing distant pixels', () => {
    const source = new Uint8Array(32 * 32 * 4);
    for (let offset = 0; offset < source.byteLength; offset += 4) {
      source[offset] = 255;
      source[offset + 1] = 255;
      source[offset + 2] = 255;
      source[offset + 3] = 255;
    }
    const result = rasterizeMaskCoverageTileV1(source, {
      tileDocumentX: 0,
      tileDocumentY: 0,
      width: 32,
      height: 32,
      paintValue: 0,
      dabs: [centerDab],
    });
    const center = (16 * 32 + 16) * 4;
    expect(result[center]).toBeLessThan(16);
    expect(result[0]).toBe(255);
    expect(result[center + 3]).toBe(255);
  });

  it('materializes sparse default coverage, persists the edited tile and applies it as one snapshot revision', async () => {
    const { snapshot, layer, mask } = fixture(1);
    const persistence = new FakePersistence();
    const prepared = await prepareMaskPaintV1(snapshot, layer.id, mask.id, 0, [centerDab], persistence);
    expect(prepared.tiles).toHaveLength(1);
    expect(persistence.writes).toHaveLength(1);
    const bytes = persistence.tiles.get(prepared.tiles[0]?.payloadRef ?? '')?.bytes;
    expect(bytes?.[(16 * 32 + 16) * 4]).toBeLessThan(16);
    expect(bytes?.[0]).toBe(255);

    const next = applyPreparedMaskPaintV1(snapshot, prepared, parseRevision(1), new Date(0));
    const nextLayer = next.document.layerTree.layers[layer.id];
    const nextMask = nextLayer?.masks.find((entry) => entry.id === mask.id);
    expect(next.document.revision).toBe(1);
    expect(next.document.modifiedAt).toBe(new Date(0).toISOString());
    expect(nextLayer?.revision).toBe(1);
    expect(nextMask?.revision).toBe(1);
    expect(nextMask?.kind === 'raster-mask' ? nextMask.tiles : []).toHaveLength(1);
  });

  it('can reveal into an existing zero-coverage tile and rejects a stale prepared commit', async () => {
    const { snapshot, layer, mask } = fixture(0);
    const persistence = new FakePersistence();
    const hidden = new Uint8Array(32 * 32 * 4);
    for (let offset = 3; offset < hidden.byteLength; offset += 4) hidden[offset] = 255;
    const existing = await persistence.persistRasterTile({
      width: 32,
      height: 32,
      pixelFormat: 'rgba8-unorm',
      bytes: hidden,
    });
    const existingMask = Object.freeze({
      ...mask,
      tiles: Object.freeze([
        Object.freeze({ x: 0, y: 0, revision: parseRevision(0), payloadRef: existing.payloadRef }),
      ]),
    });
    const existingLayer = Object.freeze({ ...layer, masks: Object.freeze([existingMask]) });
    const existingSnapshot = Object.freeze({
      ...snapshot,
      document: Object.freeze({
        ...snapshot.document,
        layerTree: Object.freeze({
          rootLayerIds: snapshot.document.layerTree.rootLayerIds,
          layers: Object.freeze({ [layer.id]: existingLayer }),
        }),
      }),
    });
    const prepared = await prepareMaskPaintV1(
      existingSnapshot,
      layer.id,
      mask.id,
      1,
      [centerDab],
      persistence,
    );
    const revealed = persistence.tiles.get(prepared.tiles[0]?.payloadRef ?? '')?.bytes;
    expect(revealed?.[(16 * 32 + 16) * 4]).toBeGreaterThan(239);
    const stale = Object.freeze({
      ...existingSnapshot,
      document: Object.freeze({ ...existingSnapshot.document, revision: parseRevision(1) }),
    });
    expect(() => applyPreparedMaskPaintV1(stale, prepared, parseRevision(2))).toThrow(
      /document changed/,
    );
  });
});
''')

replace_once(
    'src/app/layer-workflow-controller.ts',
    "import { parseLayerId, type LayerId } from '../domain/identity.js';",
    "import { parseLayerId, parseMaskId, type LayerId } from '../domain/identity.js';",
)
replace_once(
    'src/app/layer-workflow-controller.ts',
    "import { matchesLayerSearchV1, normalizeLayerSearchQueryV1 } from './layer-search.js';",
    "import { matchesLayerSearchV1, normalizeLayerSearchQueryV1 } from './layer-search.js';\nimport type { MaskPaintControllerV1 } from './layer-mask-paint.js';",
)
replace_once(
    'src/app/layer-workflow-controller.ts',
    "  readonly paintPersistence: PaintPersistenceControllerV1;\n  readonly schedule:",
    "  readonly paintPersistence: PaintPersistenceControllerV1;\n  readonly maskPaint: MaskPaintControllerV1;\n  readonly schedule:",
)
replace_once(
    'src/app/layer-workflow-controller.ts',
    "  const folderPassThroughButton = required<HTMLButtonElement>('#layer-folder-pass-through');",
    "  const folderPassThroughButton = required<HTMLButtonElement>('#layer-folder-pass-through');\n  const maskPaintTarget = required<HTMLSelectElement>('#mask-paint-target');\n  const maskPaintHideButton = required<HTMLButtonElement>('#mask-paint-hide');\n  const maskPaintRevealButton = required<HTMLButtonElement>('#mask-paint-reveal');",
)
replace_once(
    'src/app/layer-workflow-controller.ts',
    "    const active = currentActive();\n    const disabled = active === null;",
    "    const active = currentActive();\n    const disabled = active === null;\n    const maskPaintSnapshot = options.maskPaint.validateTarget();\n    const rasterMasks = active?.layer.masks.filter((mask) => mask.kind === 'raster-mask') ?? [];\n    const previousMaskTarget = maskPaintTarget.value;\n    maskPaintTarget.replaceChildren();\n    const placeholder = document.createElement('option');\n    placeholder.value = '';\n    placeholder.textContent = rasterMasks.length === 0 ? 'マスクなし' : 'マスクを編集';\n    maskPaintTarget.append(placeholder);\n    rasterMasks.forEach((mask, index) => {\n      const option = document.createElement('option');\n      option.value = mask.id;\n      option.textContent = `Mask ${index + 1}`;\n      maskPaintTarget.append(option);\n    });\n    const activeMaskBelongsToLayer =\n      active !== null &&\n      maskPaintSnapshot.layerId === active.id &&\n      maskPaintSnapshot.maskId !== null &&\n      rasterMasks.some((mask) => mask.id === maskPaintSnapshot.maskId);\n    maskPaintTarget.value = activeMaskBelongsToLayer\n      ? (maskPaintSnapshot.maskId ?? '')\n      : rasterMasks.some((mask) => mask.id === previousMaskTarget)\n        ? previousMaskTarget\n        : '';\n    maskPaintTarget.disabled = rasterMasks.length === 0 || options.paintSession.activeStrokeId() !== null;\n    maskPaintHideButton.disabled = !activeMaskBelongsToLayer;\n    maskPaintRevealButton.disabled = !activeMaskBelongsToLayer;\n    maskPaintHideButton.setAttribute(\n      'aria-pressed',\n      activeMaskBelongsToLayer && maskPaintSnapshot.paintValue === 0 ? 'true' : 'false',\n    );\n    maskPaintRevealButton.setAttribute(\n      'aria-pressed',\n      activeMaskBelongsToLayer && maskPaintSnapshot.paintValue === 1 ? 'true' : 'false',\n    );\n    root.dataset.illustroMaskPaintLayerId = maskPaintSnapshot.layerId ?? '';\n    root.dataset.illustroMaskPaintMaskId = maskPaintSnapshot.maskId ?? '';\n    root.dataset.illustroMaskPaintValue = String(maskPaintSnapshot.paintValue);",
)
replace_once(
    'src/app/layer-workflow-controller.ts',
    "  const onLayerSearchInput = (): void => {",
    "  const onMaskPaintTargetChange = (): void => {\n    const layerId = options.paintSession.activeLayerId();\n    try {\n      if (layerId === null || maskPaintTarget.value.length === 0) {\n        options.maskPaint.clearTarget();\n      } else {\n        options.maskPaint.selectMask(layerId, parseMaskId(maskPaintTarget.value));\n      }\n      clearError();\n      refresh();\n    } catch (error) {\n      publishError(error);\n      refresh();\n    }\n  };\n\n  const onMaskPaintHide = (): void => {\n    options.maskPaint.setPaintValue(0);\n    refresh();\n  };\n\n  const onMaskPaintReveal = (): void => {\n    options.maskPaint.setPaintValue(1);\n    refresh();\n  };\n\n  const onLayerSearchInput = (): void => {",
)
replace_once(
    'src/app/layer-workflow-controller.ts',
    "  filterSelect.addEventListener('change', onLayerFilterChange);",
    "  filterSelect.addEventListener('change', onLayerFilterChange);\n  maskPaintTarget.addEventListener('change', onMaskPaintTargetChange);\n  maskPaintHideButton.addEventListener('click', onMaskPaintHide);\n  maskPaintRevealButton.addEventListener('click', onMaskPaintReveal);",
)
replace_once(
    'src/app/layer-workflow-controller.ts',
    "      filterSelect.removeEventListener('change', onLayerFilterChange);",
    "      filterSelect.removeEventListener('change', onLayerFilterChange);\n      maskPaintTarget.removeEventListener('change', onMaskPaintTargetChange);\n      maskPaintHideButton.removeEventListener('click', onMaskPaintHide);\n      maskPaintRevealButton.removeEventListener('click', onMaskPaintReveal);",
)

replace_once(
    'src/app/main.ts',
    "import { PaintHistoryControllerV1 } from './paint-history-controller.js';",
    "import { PaintHistoryControllerV1 } from './paint-history-controller.js';\nimport { MaskPaintControllerV1 } from './layer-mask-paint.js';",
)
replace_once(
    'src/app/main.ts',
    ");\nlet paintRenderTask: Promise<void> = Promise.resolve();",
    ");\nconst maskPaint = new MaskPaintControllerV1({\n  paintSession,\n  paintHistory,\n  paintPersistence,\n  mapPointerToDocument: (sample, documentValue) =>\n    viewport.mapPointerToDocument(sample, documentValue),\n});\nlet paintRenderTask: Promise<void> = Promise.resolve();",
)
replace_once(
    'src/app/main.ts',
    "  paintPersistence,\n  schedule: enqueuePaintRender,\n  onHistoryChanged: publishPaintHistory,\n});\nconst layerComps",
    "  paintPersistence,\n  maskPaint,\n  schedule: enqueuePaintRender,\n  onHistoryChanged: publishPaintHistory,\n});\nconst layerComps",
)
replace_once(
    'src/app/main.ts',
    "  } else if (arbitration.forwardBatch !== null) {\n    const previousStrokeId = paintSession.activeStrokeId();",
    "  } else if (arbitration.forwardBatch !== null) {\n    const maskPaintResult = maskPaint.ingestPointerBatch(arbitration.forwardBatch);\n    if (maskPaintResult.consumed) {\n      root.dataset.illustroPointerDisposition = 'mask-paint';\n      const maskState = maskPaint.snapshot();\n      root.dataset.illustroMaskPaintState =\n        maskState.activePointerId === null ? 'idle' : 'active';\n      root.dataset.illustroMaskPaintDabs = String(maskState.activeDabCount);\n      if (maskPaintResult.completed !== null) {\n        const completed = maskPaintResult.completed;\n        root.dataset.illustroMaskPaintState = 'finalizing';\n        enqueuePaintRender(async () => {\n          const committed = await maskPaint.commitCompletedStroke(completed);\n          root.dataset.illustroMaskPaintState = 'committed';\n          root.dataset.illustroMaskPaintDirtyTiles = String(committed.affectedTileCount);\n          root.dataset.illustroHistoryTransaction = committed.transactionId;\n          const documentValue = paintSession.currentDocument();\n          if (documentValue !== null) publishDocumentState(documentValue);\n          publishPaintHistory();\n          incrementPerformanceCounter('mask.paint.stroke-finalized');\n        });\n      }\n    } else {\n      const previousStrokeId = paintSession.activeStrokeId();",
)
replace_once(
    'src/app/main.ts',
    "    pointerTransport.enqueueBatch(arbitration.forwardBatch);\n  }\n});",
    "      pointerTransport.enqueueBatch(arbitration.forwardBatch);\n    }\n  }\n});",
)
replace_once(
    'src/app/main.ts',
    "root.dataset.illustroPaintDirtyTiles = '0';\npublishPaintHistory();",
    "root.dataset.illustroPaintDirtyTiles = '0';\nroot.dataset.illustroMaskPaintState = 'idle';\nroot.dataset.illustroMaskPaintDabs = '0';\nroot.dataset.illustroMaskPaintDirtyTiles = '0';\npublishPaintHistory();",
)
replace_once(
    'src/app/main.ts',
    "    layerComps.dispose();\n    layerWorkflow.dispose();",
    "    layerComps.dispose();\n    layerWorkflow.dispose();\n    maskPaint.dispose();",
)

replace_once(
    'src/index.html',
    '              <label class="shell-layer-opacity" title="不透明度"><span aria-hidden="true">◐</span><input id="layer-opacity" type="number" min="0" max="100" step="1" value="100" aria-label="レイヤー不透明度 パーセント" /></label>\n            </div>',
    '              <label class="shell-layer-opacity" title="不透明度"><span aria-hidden="true">◐</span><input id="layer-opacity" type="number" min="0" max="100" step="1" value="100" aria-label="レイヤー不透明度 パーセント" /></label>\n            </div>\n            <div class="shell-mask-paint-controls" aria-label="レイヤーマスク描画">\n              <select id="mask-paint-target" aria-label="編集するレイヤーマスク"><option value="">マスクなし</option></select>\n              <button id="mask-paint-hide" type="button" aria-label="マスクへ非表示を描画" title="マスク: 隠す" aria-pressed="false" disabled>M−</button>\n              <button id="mask-paint-reveal" type="button" aria-label="マスクへ表示を描画" title="マスク: 表示" aria-pressed="false" disabled>M＋</button>\n            </div>',
)

replace_once(
    'public/app-shell.css',
    ".shell-layer-opacity input {\n  width: 48px;",
    ".shell-mask-paint-controls {\n  display: grid;\n  grid-template-columns: minmax(0, 1fr) 44px 44px;\n  gap: 4px;\n  align-items: center;\n}\n\n.shell-mask-paint-controls select,\n.shell-mask-paint-controls button {\n  min-height: 27px;\n  border: 1px solid #e2e7ef;\n  border-radius: 7px;\n  background: #f7f8fb;\n  color: #536078;\n  font: 600 10px/1 system-ui, sans-serif;\n}\n\n.shell-mask-paint-controls select { min-width: 0; padding: 0 6px; background: #fff; }\n.shell-mask-paint-controls button[aria-pressed='true'] {\n  border-color: #ffd1e3;\n  background: #ffe8f2;\n  color: #d92b73;\n}\n.shell-mask-paint-controls button:disabled,\n.shell-mask-paint-controls select:disabled { opacity: 0.35; }\n\n.shell-layer-opacity input {\n  width: 48px;",
)

replace_once(
    'scripts/verify-m5b-layer-foundation.mjs',
    "requireText('src/index.html', [\n  'id=\"layer-comp-name\"',\n  'id=\"layer-comp-save\"',\n  'id=\"layer-comp-select\"',\n  'id=\"layer-comp-apply\"',\n]);\nconsole.log('M5B layer system verification passed');",
    "requireText('src/index.html', [\n  'id=\"layer-comp-name\"',\n  'id=\"layer-comp-save\"',\n  'id=\"layer-comp-select\"',\n  'id=\"layer-comp-apply\"',\n]);\nrequireText('src/app/layer-mask-paint.ts', [\n  'MaskPaintControllerV1',\n  'prepareMaskPaintV1',\n  'applyPreparedMaskPaintV1',\n  'rasterizeMaskCoverageTileV1',\n  \"'mask.paint'\",\n  \"pixelFormat: 'rgba8-unorm'\",\n  'planBaselineBrushTilesV1',\n]);\nrequireText('src/app/main.ts', [\n  'MaskPaintControllerV1',\n  'maskPaint.ingestPointerBatch',\n  'maskPaint.commitCompletedStroke',\n  \"illustroPointerDisposition = 'mask-paint'\",\n]);\nrequireText('src/app/layer-workflow-controller.ts', [\n  \"'#mask-paint-target'\",\n  \"'#mask-paint-hide'\",\n  \"'#mask-paint-reveal'\",\n  'maskPaint.selectMask',\n  'maskPaint.setPaintValue',\n]);\nrequireText('src/index.html', [\n  'id=\"mask-paint-target\"',\n  'id=\"mask-paint-hide\"',\n  'id=\"mask-paint-reveal\"',\n]);\nconsole.log('M5B layer system verification passed');",
)

replace_once('IMPLEMENTATION_PROGRESS.md', 'M5B-036 Mask painting:未完了', 'M5B-036 Mask painting:完了')
