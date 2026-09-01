from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    if text.count(old) != 1:
        raise SystemExit(f'expected exactly one anchor in {path}: {old[:120]!r}; found {text.count(old)}')
    file.write_text(text.replace(old, new, 1))


Path('src/app/layer-rasterize.ts').write_text(r'''import { parseRevision, type LayerId, type Revision } from '../domain/identity.js';
import {
  createRasterLayer,
  type FillLayerV1,
  type LayerBaseV1,
  type RasterLayerV1,
  type RasterTileReferenceV1,
  type VectorLayerV1,
} from '../domain/layers.js';
import { tileBoundsForDocumentV1, tileGridForDocumentV1 } from '../gpu/sparse-tile-model.js';
import {
  prepareRasterMergeVisibleCopyV1,
  type PreparedRasterMergeTileV1,
  type RasterMergePersistencePortV1,
} from './layer-raster-merge.js';
import type { PaintProjectSnapshotV1 } from './paint-session-controller.js';

export interface LayerRasterizeEligibilityV1 {
  readonly eligible: boolean;
  readonly layerId: LayerId;
  readonly reason: string | null;
}

export interface PreparedLayerRasterizeV1 {
  readonly schema: 'illustro.prepared-layer-rasterize/1';
  readonly layerId: LayerId;
  readonly sourceType: LayerBaseV1['type'];
  readonly sourceRevision: Revision;
  readonly documentRevision: Revision;
  readonly tiles: readonly PreparedRasterMergeTileV1[];
}

function unavailable(layerId: LayerId, reason: string): LayerRasterizeEligibilityV1 {
  return Object.freeze({ eligible: false, layerId, reason });
}

export function layerRasterizeEligibilityV1(
  snapshot: PaintProjectSnapshotV1,
  layerId: LayerId,
): LayerRasterizeEligibilityV1 {
  const layer = snapshot.document.layerTree.layers[layerId];
  if (layer === undefined) return unavailable(layerId, 'rasterize target layer is missing');
  if (layer.type === 'lineartBoundary') {
    return unavailable(layerId, 'Lineart Boundary data is non-rendering topology and cannot be rasterized');
  }
  if (layer.locks.all || layer.locks.pixels) {
    return unavailable(layerId, 'rasterize is blocked by the layer pixel lock');
  }
  if (layer.transformStack.length > 0) {
    return unavailable(layerId, 'rasterize transform baking requires the transform renderer milestone');
  }
  if (layer.effectStack.length > 0) {
    return unavailable(layerId, 'rasterize effect baking requires the effect compositor milestone');
  }

  switch (layer.type) {
    case 'raster': {
      const hasUnbakedStroke = snapshot.committedStrokes.some(
        (entry) => entry.stroke.layerId === layerId && entry.bakedToRasterLayer !== true,
      );
      return hasUnbakedStroke
        ? Object.freeze({ eligible: true, layerId, reason: null })
        : unavailable(layerId, 'raster layer content is already materialized');
    }
    case 'fill': {
      const fill = layer as FillLayerV1;
      if (fill.fill.kind !== 'solid') {
        return unavailable(layerId, 'pattern fill rasterization requires the material renderer milestone');
      }
      if (fill.fill.color.space !== snapshot.document.color.workingSpace) {
        return unavailable(layerId, 'fill color conversion requires the color-management milestone');
      }
      return Object.freeze({ eligible: true, layerId, reason: null });
    }
    case 'vector': {
      const vector = layer as VectorLayerV1;
      return vector.objects.length === 0
        ? Object.freeze({ eligible: true, layerId, reason: null })
        : unavailable(layerId, 'vector artwork rasterization requires the vector renderer milestone');
    }
    case 'gradient':
      return unavailable(layerId, 'gradient rasterization requires the canonical gradient renderer');
    case 'adjustment':
      return unavailable(layerId, 'adjustment rasterization requires the effect compositor milestone');
    case 'folder':
      return unavailable(layerId, 'folder rasterization requires the layer compositor milestone');
    case 'linkedObject':
      return unavailable(
        layerId,
        'linked object rasterization requires canonical embedded representation completion',
      );
    case 'text':
      return unavailable(layerId, 'text rasterization requires the text renderer milestone');
  }
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function floatToHalf(value: number): number {
  const clamped = clamp01(value);
  if (clamped === 0) return 0;
  const float = new Float32Array([clamped]);
  const bits = new Uint32Array(float.buffer)[0] ?? 0;
  const sign = (bits >>> 16) & 0x8000;
  let exponent = ((bits >>> 23) & 0xff) - 127 + 15;
  let fraction = bits & 0x7fffff;
  if (exponent <= 0) {
    if (exponent < -10) return sign;
    fraction = (fraction | 0x800000) >>> (1 - exponent);
    return sign | ((fraction + 0x1000) >>> 13);
  }
  if (exponent >= 31) return sign | 0x7c00;
  fraction += 0x1000;
  if ((fraction & 0x800000) !== 0) {
    fraction = 0;
    exponent += 1;
    if (exponent >= 31) return sign | 0x7c00;
  }
  return sign | (exponent << 10) | (fraction >>> 13);
}

function solidFillBytes(
  width: number,
  height: number,
  precision: PaintProjectSnapshotV1['document']['color']['precision'],
  rgba: readonly [number, number, number, number],
): Uint8Array<ArrayBuffer> {
  const [red, green, blue, alpha] = rgba.map(clamp01) as [number, number, number, number];
  if (precision === 'rgba8-unorm') {
    const bytes = new Uint8Array(width * height * 4);
    const r = Math.round(red * 255);
    const g = Math.round(green * 255);
    const b = Math.round(blue * 255);
    const a = Math.round(alpha * 255);
    for (let offset = 0; offset < bytes.length; offset += 4) {
      bytes[offset] = r;
      bytes[offset + 1] = g;
      bytes[offset + 2] = b;
      bytes[offset + 3] = a;
    }
    return bytes;
  }
  const bytes = new Uint8Array(width * height * 8);
  const view = new DataView(bytes.buffer);
  const r = floatToHalf(red);
  const g = floatToHalf(green);
  const b = floatToHalf(blue);
  const a = floatToHalf(alpha);
  for (let pixel = 0; pixel < width * height; pixel += 1) {
    const offset = pixel * 8;
    view.setUint16(offset, r, true);
    view.setUint16(offset + 2, g, true);
    view.setUint16(offset + 4, b, true);
    view.setUint16(offset + 6, a, true);
  }
  return bytes;
}

async function materializeRasterContentV1(
  snapshot: PaintProjectSnapshotV1,
  layer: RasterLayerV1,
  persistence: RasterMergePersistencePortV1,
): Promise<readonly PreparedRasterMergeTileV1[]> {
  const contentLayer = createRasterLayer({ id: layer.id, name: layer.name, tiles: layer.tiles });
  const isolated: PaintProjectSnapshotV1 = Object.freeze({
    schema: 'illustro.paint-project-snapshot/1' as const,
    document: Object.freeze({
      ...snapshot.document,
      layerTree: Object.freeze({
        rootLayerIds: Object.freeze([layer.id]),
        layers: Object.freeze({ [layer.id]: contentLayer }),
      }),
    }),
    committedStrokes: Object.freeze(
      snapshot.committedStrokes.filter((entry) => entry.stroke.layerId === layer.id),
    ),
  });
  const prepared = await prepareRasterMergeVisibleCopyV1(
    isolated,
    '__rasterize-content__',
    persistence,
  );
  return prepared.tiles;
}

async function materializeSolidFillV1(
  snapshot: PaintProjectSnapshotV1,
  layer: FillLayerV1,
  persistence: RasterMergePersistencePortV1,
): Promise<readonly PreparedRasterMergeTileV1[]> {
  if (layer.fill.kind !== 'solid') throw new Error('solid fill rasterization source changed');
  if (layer.fill.color.space !== snapshot.document.color.workingSpace) {
    throw new Error('solid fill working space changed before rasterization');
  }
  const alpha = clamp01(layer.fill.color.rgba[3]);
  if (alpha === 0) return Object.freeze([]);
  const width = snapshot.document.canvas.width;
  const height = snapshot.document.canvas.height;
  const precision = snapshot.document.color.precision;
  const grid = tileGridForDocumentV1(width, height);
  const tiles: PreparedRasterMergeTileV1[] = [];
  for (let ty = 0; ty < grid.rows; ty += 1) {
    for (let tx = 0; tx < grid.columns; tx += 1) {
      const bounds = tileBoundsForDocumentV1(width, height, { tx, ty });
      const persisted = await persistence.persistRasterTile({
        width: bounds.validWidth,
        height: bounds.validHeight,
        pixelFormat: precision,
        bytes: solidFillBytes(
          bounds.validWidth,
          bounds.validHeight,
          precision,
          layer.fill.color.rgba,
        ),
      });
      tiles.push(Object.freeze({ x: tx, y: ty, payloadRef: persisted.payloadRef }));
    }
  }
  return Object.freeze(tiles);
}

export async function prepareLayerRasterizeV1(
  snapshot: PaintProjectSnapshotV1,
  layerId: LayerId,
  persistence: RasterMergePersistencePortV1,
): Promise<PreparedLayerRasterizeV1> {
  const eligibility = layerRasterizeEligibilityV1(snapshot, layerId);
  if (!eligibility.eligible) throw new Error(eligibility.reason ?? 'rasterize is unavailable');
  const layer = snapshot.document.layerTree.layers[layerId];
  if (layer === undefined) throw new Error('rasterize target disappeared');
  let tiles: readonly PreparedRasterMergeTileV1[];
  if (layer.type === 'raster') {
    tiles = await materializeRasterContentV1(snapshot, layer as RasterLayerV1, persistence);
  } else if (layer.type === 'fill') {
    tiles = await materializeSolidFillV1(snapshot, layer as FillLayerV1, persistence);
  } else if (layer.type === 'vector') {
    tiles = Object.freeze([]);
  } else {
    throw new Error('rasterize source type changed before preparation');
  }
  return Object.freeze({
    schema: 'illustro.prepared-layer-rasterize/1' as const,
    layerId,
    sourceType: layer.type,
    sourceRevision: layer.revision,
    documentRevision: snapshot.document.revision,
    tiles,
  });
}

export function applyPreparedLayerRasterizeV1(
  snapshot: PaintProjectSnapshotV1,
  prepared: PreparedLayerRasterizeV1,
  revisionValue: Revision | number,
  now: Date = new Date(),
): PaintProjectSnapshotV1 {
  const revision = parseRevision(revisionValue);
  if (snapshot.document.revision !== prepared.documentRevision) {
    throw new Error('rasterize document changed before commit');
  }
  const source = snapshot.document.layerTree.layers[prepared.layerId];
  if (
    source === undefined ||
    source.type !== prepared.sourceType ||
    source.revision !== prepared.sourceRevision
  ) {
    throw new Error('rasterize source changed before commit');
  }
  const eligibility = layerRasterizeEligibilityV1(snapshot, prepared.layerId);
  if (!eligibility.eligible) throw new Error(eligibility.reason ?? 'rasterize is unavailable');
  const raster = Object.freeze({
    ...createRasterLayer({
      id: source.id,
      parentId: source.parentId,
      name: source.name,
      visible: source.visible,
      opacity: source.opacity,
      blendMode: source.blendMode,
      locks: source.locks,
      clipping: source.clipping,
      roleFlags: source.roleFlags,
      masks: source.masks,
      transformStack: Object.freeze([]),
      effectStack: Object.freeze([]),
      metadata: source.metadata,
      tiles: prepared.tiles.map(
        (tile): RasterTileReferenceV1 =>
          Object.freeze({ x: tile.x, y: tile.y, revision, payloadRef: tile.payloadRef }),
      ),
    }),
    revision,
    boundsHint: null,
  }) as RasterLayerV1;
  const committedStrokes = snapshot.committedStrokes.map((entry) =>
    entry.stroke.layerId === prepared.layerId
      ? Object.freeze({ ...entry, bakedToRasterLayer: true })
      : entry,
  );
  return Object.freeze({
    schema: 'illustro.paint-project-snapshot/1' as const,
    document: Object.freeze({
      ...snapshot.document,
      revision,
      modifiedAt: now.toISOString(),
      layerTree: Object.freeze({
        rootLayerIds: snapshot.document.layerTree.rootLayerIds,
        layers: Object.freeze({
          ...snapshot.document.layerTree.layers,
          [prepared.layerId]: raster,
        }),
      }),
    }),
    committedStrokes: Object.freeze(committedStrokes),
  });
}
''')

Path('tests/unit/layer-rasterize.test.ts').write_text(r'''import { describe, expect, it } from 'vitest';
import {
  applyPreparedLayerRasterizeV1,
  layerRasterizeEligibilityV1,
  prepareLayerRasterizeV1,
} from '../../src/app/layer-rasterize.js';
import type { RasterMergePersistencePortV1 } from '../../src/app/layer-raster-merge.js';
import type {
  PaintDecodedRasterTileV1,
  PaintPersistedRasterTileV1,
  PaintRasterTilePixelFormatV1,
} from '../../src/app/paint-persistence-controller.js';
import type { PaintProjectSnapshotV1 } from '../../src/app/paint-session-controller.js';
import { createDocumentV1 } from '../../src/domain/document.js';
import { parseRevision } from '../../src/domain/identity.js';
import {
  createFillLayer,
  createRasterLayer,
  createVectorLayer,
  createVectorObject,
} from '../../src/domain/layers.js';

class MemoryRasterPersistence implements RasterMergePersistencePortV1 {
  readonly tiles = new Map<string, PaintDecodedRasterTileV1>();
  readonly writes: PaintPersistedRasterTileV1[] = [];

  async readRasterTile(payloadRef: string): Promise<PaintDecodedRasterTileV1> {
    const tile = this.tiles.get(payloadRef);
    if (tile === undefined) throw new Error(`missing tile ${payloadRef}`);
    return tile;
  }

  async persistRasterTile(input: {
    readonly width: number;
    readonly height: number;
    readonly pixelFormat: PaintRasterTilePixelFormatV1;
    readonly bytes: Uint8Array | ArrayBuffer;
  }): Promise<PaintPersistedRasterTileV1> {
    const index = this.writes.length + 1;
    const objectHash = index.toString(16).padStart(64, '0');
    const payloadRef = `sha256:${objectHash}`;
    const bytes =
      input.bytes instanceof Uint8Array
        ? new Uint8Array(input.bytes)
        : new Uint8Array(input.bytes.slice(0));
    const decoded = Object.freeze({
      schema: 'illustro.paint-decoded-raster-tile/1' as const,
      payloadRef,
      objectHash,
      codec: 'raw' as const,
      pixelFormat: input.pixelFormat,
      width: input.width,
      height: input.height,
      bytes,
    });
    this.tiles.set(payloadRef, decoded);
    const persisted = Object.freeze({
      schema: 'illustro.paint-persisted-raster-tile/1' as const,
      payloadRef,
      objectHash,
      codec: 'raw' as const,
      pixelFormat: input.pixelFormat,
      width: input.width,
      height: input.height,
      rawByteLength: bytes.byteLength,
      encodedByteLength: bytes.byteLength,
    });
    this.writes.push(persisted);
    return persisted;
  }
}

function snapshotWith(layer: ReturnType<typeof createRasterLayer> | ReturnType<typeof createFillLayer> | ReturnType<typeof createVectorLayer>, precision: 'rgba8-unorm' | 'rgba16-float' = 'rgba8-unorm'): PaintProjectSnapshotV1 {
  const document = createDocumentV1({ width: 300, height: 260, precision });
  return Object.freeze({
    schema: 'illustro.paint-project-snapshot/1' as const,
    document: Object.freeze({
      ...document,
      layerTree: Object.freeze({
        rootLayerIds: Object.freeze([layer.id]),
        layers: Object.freeze({ [layer.id]: layer }),
      }),
    }),
    committedStrokes: Object.freeze([]),
  });
}

function stroke(layerId: string) {
  return Object.freeze({
    stroke: Object.freeze({
      schema: 'illustro.paint-stroke/1' as const,
      strokeId: '11111111-1111-4111-8111-111111111111',
      pointerId: 1,
      source: 'pen' as const,
      layerId: layerId as never,
      samples: Object.freeze([]),
    }),
    dabs: Object.freeze([
      Object.freeze({
        schema: 'illustro.baseline-brush-dab/1' as const,
        x: 20,
        y: 20,
        radius: 8,
        radiusX: 8,
        radiusY: 8,
        opacity: 1,
      }),
    ]),
    bakedToRasterLayer: false,
  });
}

describe('M5B layer rasterize', () => {
  it('materializes a solid Fill Layer to sparse RGBA8 tiles while preserving layer identity and attachments', async () => {
    const document = createDocumentV1({ width: 300, height: 260 });
    const fill = createFillLayer({
      name: 'Color',
      opacity: 0.75,
      roleFlags: { reference: true },
      fill: {
        kind: 'solid',
        color: { space: document.color.workingSpace, rgba: [0.25, 0.5, 0.75, 0.5] },
      },
    });
    const snapshot: PaintProjectSnapshotV1 = Object.freeze({
      schema: 'illustro.paint-project-snapshot/1' as const,
      document: Object.freeze({
        ...document,
        layerTree: Object.freeze({
          rootLayerIds: Object.freeze([fill.id]),
          layers: Object.freeze({ [fill.id]: fill }),
        }),
      }),
      committedStrokes: Object.freeze([]),
    });
    const persistence = new MemoryRasterPersistence();
    expect(layerRasterizeEligibilityV1(snapshot, fill.id).eligible).toBe(true);
    const prepared = await prepareLayerRasterizeV1(snapshot, fill.id, persistence);
    expect(prepared.tiles).toHaveLength(4);
    expect(persistence.writes).toHaveLength(4);
    const first = persistence.tiles.get(prepared.tiles[0]!.payloadRef)!;
    expect(first.pixelFormat).toBe('rgba8-unorm');
    expect([...first.bytes.slice(0, 4)]).toEqual([64, 128, 191, 128]);
    const after = applyPreparedLayerRasterizeV1(
      snapshot,
      prepared,
      parseRevision(1),
      new Date(0),
    );
    const raster = after.document.layerTree.layers[fill.id];
    expect(raster).toMatchObject({
      id: fill.id,
      type: 'raster',
      revision: 1,
      opacity: 0.75,
      roleFlags: { reference: true },
    });
    expect(raster?.type === 'raster' ? raster.tiles : []).toHaveLength(4);
  });

  it('preserves RGBA16F precision for solid fill rasterization', async () => {
    const document = createDocumentV1({ width: 300, height: 260, precision: 'rgba16-float' });
    const fill = createFillLayer({
      name: 'HDR Fill',
      fill: {
        kind: 'solid',
        color: { space: document.color.workingSpace, rgba: [1, 0.5, 0.25, 1] },
      },
    });
    const snapshot: PaintProjectSnapshotV1 = Object.freeze({
      schema: 'illustro.paint-project-snapshot/1' as const,
      document: Object.freeze({
        ...document,
        layerTree: Object.freeze({
          rootLayerIds: Object.freeze([fill.id]),
          layers: Object.freeze({ [fill.id]: fill }),
        }),
      }),
      committedStrokes: Object.freeze([]),
    });
    const persistence = new MemoryRasterPersistence();
    await prepareLayerRasterizeV1(snapshot, fill.id, persistence);
    expect(persistence.writes.every((write) => write.pixelFormat === 'rgba16-float')).toBe(true);
    expect(persistence.writes[0]?.rawByteLength).toBe(256 * 256 * 8);
  });

  it('materializes unbaked Raster Layer strokes and marks their canonical history as baked', async () => {
    const raster = createRasterLayer({ name: 'Paint' });
    const base = snapshotWith(raster);
    const snapshot: PaintProjectSnapshotV1 = Object.freeze({
      ...base,
      committedStrokes: Object.freeze([stroke(raster.id)]),
    });
    const persistence = new MemoryRasterPersistence();
    const prepared = await prepareLayerRasterizeV1(snapshot, raster.id, persistence);
    expect(prepared.tiles).toHaveLength(1);
    const after = applyPreparedLayerRasterizeV1(snapshot, prepared, parseRevision(1));
    expect(after.committedStrokes[0]?.bakedToRasterLayer).toBe(true);
    expect(after.document.layerTree.layers[raster.id]?.type).toBe('raster');
  });

  it('allows an empty vector layer to become an empty raster but blocks unsupported live vector geometry', async () => {
    const empty = createVectorLayer({ name: 'Empty Vector' });
    const emptySnapshot = snapshotWith(empty);
    const persistence = new MemoryRasterPersistence();
    const prepared = await prepareLayerRasterizeV1(emptySnapshot, empty.id, persistence);
    const after = applyPreparedLayerRasterizeV1(emptySnapshot, prepared, parseRevision(1));
    expect(after.document.layerTree.layers[empty.id]?.type).toBe('raster');
    expect(persistence.writes).toHaveLength(0);

    const populated = createVectorLayer({
      name: 'Vector',
      objects: [createVectorObject({ kind: 'shape', geometry: { kind: 'rect' } })],
    });
    const populatedSnapshot = snapshotWith(populated);
    expect(layerRasterizeEligibilityV1(populatedSnapshot, populated.id)).toMatchObject({
      eligible: false,
      reason: expect.stringContaining('vector renderer'),
    });
  });
});
''')

replace_once(
    'src/app/layer-workflow-controller.ts',
    "} from './layer-raster-merge.js';\nimport type { PaintHistoryControllerV1 }",
    "} from './layer-raster-merge.js';\nimport {\n  applyPreparedLayerRasterizeV1,\n  layerRasterizeEligibilityV1,\n  prepareLayerRasterizeV1,\n} from './layer-rasterize.js';\nimport type { PaintHistoryControllerV1 }",
)
replace_once(
    'src/app/layer-workflow-controller.ts',
    "  const mergeVisibleCopyButton = required<HTMLButtonElement>('#layer-merge-visible-copy');\n  const deleteButton",
    "  const mergeVisibleCopyButton = required<HTMLButtonElement>('#layer-merge-visible-copy');\n  const rasterizeButton = required<HTMLButtonElement>('#layer-rasterize');\n  const deleteButton",
)
replace_once(
    'src/app/layer-workflow-controller.ts',
    "    mergeVisibleCopyButton.title = mergeVisibleEligibility?.reason ?? '表示レイヤーを結合コピー';\n    deleteButton.disabled = disabled;",
    "    mergeVisibleCopyButton.title = mergeVisibleEligibility?.reason ?? '表示レイヤーを結合コピー';\n    const rasterizeEligibility =\n      active === null || projectSnapshot === null\n        ? null\n        : layerRasterizeEligibilityV1(projectSnapshot, active.id);\n    rasterizeButton.disabled =\n      rasterizeEligibility?.eligible !== true || options.paintSession.activeStrokeId() !== null;\n    rasterizeButton.title = rasterizeEligibility?.reason ?? 'ラスタライズ';\n    deleteButton.disabled = disabled;",
)
replace_once(
    'src/app/layer-workflow-controller.ts',
    "  const onDelete = (): void => {",
    "  const onRasterize = (): void => {\n    const layerId = options.paintSession.activeLayerId();\n    if (layerId === null) return;\n    options.schedule(async () => {\n      try {\n        if (options.paintSession.activeStrokeId() !== null) {\n          throw new Error('rasterize is unavailable while a stroke is active');\n        }\n        const current = options.paintSession.projectSnapshot();\n        if (current === null) return;\n        const prepared = await prepareLayerRasterizeV1(\n          current,\n          layerId,\n          options.paintPersistence,\n        );\n        const transaction = await options.paintHistory.commitSnapshotTransform(\n          'layer.rasterize',\n          (before, revision) => applyPreparedLayerRasterizeV1(before, prepared, revision),\n        );\n        options.paintSession.setActiveLayer(layerId);\n        await options.paintPersistence.markDirty(transaction.transactionId);\n        root.dataset.illustroLayerTransaction = transaction.transactionId;\n        clearError();\n        refresh();\n        options.onHistoryChanged();\n      } catch (error) {\n        publishError(error);\n      }\n    });\n  };\n\n  const onDelete = (): void => {",
)
replace_once(
    'src/app/layer-workflow-controller.ts',
    "  mergeVisibleCopyButton.addEventListener('click', onMergeVisibleCopy);\n  deleteButton.addEventListener",
    "  mergeVisibleCopyButton.addEventListener('click', onMergeVisibleCopy);\n  rasterizeButton.addEventListener('click', onRasterize);\n  deleteButton.addEventListener",
)
replace_once(
    'src/app/layer-workflow-controller.ts',
    "      mergeVisibleCopyButton.removeEventListener('click', onMergeVisibleCopy);\n      deleteButton.removeEventListener",
    "      mergeVisibleCopyButton.removeEventListener('click', onMergeVisibleCopy);\n      rasterizeButton.removeEventListener('click', onRasterize);\n      deleteButton.removeEventListener",
)
replace_once(
    'src/index.html',
    '              <button id="layer-merge-visible-copy" type="button" aria-label="表示レイヤーを結合コピー" title="表示レイヤーを結合コピー">⇊</button>\n              <button id="layer-rename"',
    '              <button id="layer-merge-visible-copy" type="button" aria-label="表示レイヤーを結合コピー" title="表示レイヤーを結合コピー">⇊</button>\n              <button id="layer-rasterize" type="button" aria-label="選択レイヤーをラスタライズ" title="ラスタライズ">▦</button>\n              <button id="layer-rename"',
)
replace_once(
    'scripts/verify-m5b-layer-foundation.mjs',
    "requireText('src/app/layer-workflow-controller.ts', [\n  \"'layer.duplicate'\"",
    "requireText('src/app/layer-rasterize.ts', [\n  'prepareLayerRasterizeV1',\n  'applyPreparedLayerRasterizeV1',\n  'layerRasterizeEligibilityV1',\n  \"'illustro.prepared-layer-rasterize/1'\",\n  'persistRasterTile',\n  'rgba16-float',\n]);\nrequireText('src/app/layer-workflow-controller.ts', [\n  \"'layer.duplicate'\"",
)
replace_once(
    'scripts/verify-m5b-layer-foundation.mjs',
    "  \"'layer.mergeDown'\",\n  'prepareRasterMergeDownV1',",
    "  \"'layer.mergeDown'\",\n  \"'layer.rasterize'\",\n  'prepareRasterMergeDownV1',\n  'prepareLayerRasterizeV1',",
)
replace_once(
    'scripts/verify-m5b-layer-foundation.mjs',
    "  'id=\"layer-merge-down\"',\n  'id=\"layer-rename\"',",
    "  'id=\"layer-merge-down\"',\n  'id=\"layer-rasterize\"',\n  'id=\"layer-rename\"',",
)
