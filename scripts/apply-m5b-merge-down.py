from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    if old not in text:
        raise SystemExit(f'anchor missing in {path}: {old[:100]}')
    file.write_text(text.replace(old, new, 1))


replace_once(
    'src/app/paint-session-controller.ts',
    "export interface CompletedPaintStrokeV1 {\n  readonly stroke: PaintStrokeV1;\n  readonly dabs: readonly BaselineBrushDabV1[];\n}",
    "export interface CompletedPaintStrokeV1 {\n  readonly stroke: PaintStrokeV1;\n  readonly dabs: readonly BaselineBrushDabV1[];\n  readonly bakedToRasterLayer: boolean;\n}",
)
replace_once(
    'src/app/paint-session-controller.ts',
    "  return freezeCompletedStroke(normalizedStroke, value.dabs.map(parseStoredDab));",
    "  if (value.bakedToRasterLayer !== undefined && typeof value.bakedToRasterLayer !== 'boolean') {\n    throw new TypeError('paint stroke baked raster state must be boolean');\n  }\n  return freezeCompletedStroke(\n    normalizedStroke,\n    value.dabs.map(parseStoredDab),\n    value.bakedToRasterLayer === true,\n  );",
)
replace_once(
    'src/app/paint-session-controller.ts',
    "function freezeCompletedStroke(\n  stroke: PaintStrokeV1,\n  dabs: readonly BaselineBrushDabV1[],\n): CompletedPaintStrokeV1 {\n  return Object.freeze({ stroke, dabs: Object.freeze([...dabs]) });\n}",
    "function freezeCompletedStroke(\n  stroke: PaintStrokeV1,\n  dabs: readonly BaselineBrushDabV1[],\n  bakedToRasterLayer = false,\n): CompletedPaintStrokeV1 {\n  return Object.freeze({\n    stroke,\n    dabs: Object.freeze([...dabs]),\n    bakedToRasterLayer,\n  });\n}",
)
replace_once(
    'src/app/layer-operations.ts',
    "    dabs: Object.freeze([...entry.dabs]),\n  });",
    "    dabs: Object.freeze([...entry.dabs]),\n    bakedToRasterLayer: entry.bakedToRasterLayer,\n  });",
)

replace_once(
    'src/app/layer-workflow-controller.ts',
    "} from './layer-operations.js';\nimport type { PaintHistoryControllerV1 } from './paint-history-controller.js';",
    "} from './layer-operations.js';\nimport {\n  applyPreparedRasterMergeDownV1,\n  prepareRasterMergeDownV1,\n  rasterMergeDownEligibilityV1,\n} from './layer-raster-merge.js';\nimport type { PaintHistoryControllerV1 } from './paint-history-controller.js';",
)
replace_once(
    'src/app/layer-workflow-controller.ts',
    "  const duplicateButton = required<HTMLButtonElement>('#layer-duplicate');\n  const deleteButton",
    "  const duplicateButton = required<HTMLButtonElement>('#layer-duplicate');\n  const mergeDownButton = required<HTMLButtonElement>('#layer-merge-down');\n  const deleteButton",
)
replace_once(
    'src/app/layer-workflow-controller.ts',
    "    duplicateButton.disabled = disabled || active?.layer.type === 'lineartBoundary';\n    deleteButton.disabled = disabled;",
    "    duplicateButton.disabled = disabled || active?.layer.type === 'lineartBoundary';\n    const mergeEligibility =\n      active === null\n        ? null\n        : rasterMergeDownEligibilityV1(options.paintSession.projectSnapshot()!, active.id);\n    mergeDownButton.disabled =\n      mergeEligibility?.eligible !== true || options.paintSession.activeStrokeId() !== null;\n    mergeDownButton.title = mergeEligibility?.reason ?? '下のレイヤーと結合';\n    deleteButton.disabled = disabled;",
)
replace_once(
    'src/app/layer-workflow-controller.ts',
    "  const onDelete = (): void => {",
    "  const onMergeDown = (): void => {\n    const sourceLayerId = options.paintSession.activeLayerId();\n    if (sourceLayerId === null) return;\n    options.schedule(async () => {\n      try {\n        if (options.paintSession.activeStrokeId() !== null) {\n          throw new Error('merge down is unavailable while a stroke is active');\n        }\n        const current = options.paintSession.projectSnapshot();\n        if (current === null) return;\n        const prepared = await prepareRasterMergeDownV1(\n          current,\n          sourceLayerId,\n          options.paintPersistence,\n        );\n        const transaction = await options.paintHistory.commitSnapshotTransform(\n          'layer.mergeDown',\n          (before, revision) => applyPreparedRasterMergeDownV1(before, prepared, revision),\n        );\n        options.paintSession.setActiveLayer(prepared.targetLayerId);\n        await options.paintPersistence.markDirty(transaction.transactionId);\n        root.dataset.illustroLayerTransaction = transaction.transactionId;\n        clearError();\n        refresh();\n        options.onHistoryChanged();\n      } catch (error) {\n        publishError(error);\n      }\n    });\n  };\n\n  const onDelete = (): void => {",
)
replace_once(
    'src/app/layer-workflow-controller.ts',
    "  duplicateButton.addEventListener('click', onDuplicate);\n  deleteButton.addEventListener('click', onDelete);",
    "  duplicateButton.addEventListener('click', onDuplicate);\n  mergeDownButton.addEventListener('click', onMergeDown);\n  deleteButton.addEventListener('click', onDelete);",
)
replace_once(
    'src/app/layer-workflow-controller.ts',
    "      duplicateButton.removeEventListener('click', onDuplicate);\n      deleteButton.removeEventListener('click', onDelete);",
    "      duplicateButton.removeEventListener('click', onDuplicate);\n      mergeDownButton.removeEventListener('click', onMergeDown);\n      deleteButton.removeEventListener('click', onDelete);",
)

replace_once(
    'src/index.html',
    '              <button id="layer-duplicate" type="button" aria-label="レイヤーを複製" title="複製">⧉</button>\n              <button id="layer-rename"',
    '              <button id="layer-duplicate" type="button" aria-label="レイヤーを複製" title="複製">⧉</button>\n              <button id="layer-merge-down" type="button" aria-label="下のレイヤーと結合" title="下のレイヤーと結合">↧</button>\n              <button id="layer-rename"',
)

replace_once(
    'scripts/verify-m5b-layer-foundation.mjs',
    "  'clearLayerSnapshotV1',\n]);",
    "  'clearLayerSnapshotV1',\n]);\nrequireText('src/app/layer-raster-merge.ts', [\n  'prepareRasterMergeDownV1',\n  'applyPreparedRasterMergeDownV1',\n  'rasterMergeDownEligibilityV1',\n  'bakedToRasterLayer',\n  'persistRasterTile',\n  'readRasterTile',\n]);",
)
replace_once(
    'scripts/verify-m5b-layer-foundation.mjs',
    "  \"'layer.clear'\",\n  'pointermove',",
    "  \"'layer.clear'\",\n  \"'layer.mergeDown'\",\n  'prepareRasterMergeDownV1',\n  'pointermove',",
)
replace_once(
    'scripts/verify-m5b-layer-foundation.mjs',
    "  'id=\"layer-clear\"',\n  'id=\"layer-rename\"',",
    "  'id=\"layer-clear\"',\n  'id=\"layer-merge-down\"',\n  'id=\"layer-rename\"',",
)

Path('tests/unit/layer-raster-merge.test.ts').write_text(r'''import { describe, expect, it } from 'vitest';
import {
  applyPreparedRasterMergeDownV1,
  prepareRasterMergeDownV1,
  rasterMergeDownEligibilityV1,
  type RasterMergePersistencePortV1,
} from '../../src/app/layer-raster-merge.js';
import type {
  PaintDecodedRasterTileV1,
  PaintPersistedRasterTileV1,
  PaintRasterTilePixelFormatV1,
} from '../../src/app/paint-persistence-controller.js';
import type { PaintProjectSnapshotV1 } from '../../src/app/paint-session-controller.js';
import { createDocumentV1 } from '../../src/domain/document.js';
import { parseRevision } from '../../src/domain/identity.js';
import { createRasterLayer } from '../../src/domain/layers.js';

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
    const bytes = input.bytes instanceof Uint8Array ? new Uint8Array(input.bytes) : new Uint8Array(input.bytes.slice(0));
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

function stroke(layerId: string, strokeId: string, x: number, opacity: number) {
  return Object.freeze({
    stroke: Object.freeze({
      schema: 'illustro.paint-stroke/1' as const,
      strokeId,
      pointerId: 1,
      source: 'pen' as const,
      layerId: layerId as never,
      samples: Object.freeze([]),
    }),
    dabs: Object.freeze([
      Object.freeze({
        schema: 'illustro.baseline-brush-dab/1' as const,
        x,
        y: 16,
        radius: 8,
        radiusX: 8,
        radiusY: 8,
        opacity,
      }),
    ]),
    bakedToRasterLayer: false,
  });
}

function fixture(precision: 'rgba8-unorm' | 'rgba16-float' = 'rgba8-unorm') {
  const document = createDocumentV1({ width: 64, height: 64, precision });
  const bottom = createRasterLayer({ name: 'Bottom' });
  const top = createRasterLayer({ name: 'Top' });
  const snapshot: PaintProjectSnapshotV1 = Object.freeze({
    schema: 'illustro.paint-project-snapshot/1' as const,
    document: Object.freeze({
      ...document,
      layerTree: Object.freeze({
        rootLayerIds: Object.freeze([bottom.id, top.id]),
        layers: Object.freeze({ [bottom.id]: bottom, [top.id]: top }),
      }),
    }),
    committedStrokes: Object.freeze([
      stroke(bottom.id, '11111111-1111-4111-8111-111111111111', 16, 0.5),
      stroke(top.id, '22222222-2222-4222-8222-222222222222', 16, 0.5),
    ]),
  });
  return { snapshot, bottom, top };
}

describe('M5B canonical raster merge down', () => {
  it('materializes two raster layers into immutable tile payloads and a single history snapshot', async () => {
    const { snapshot, bottom, top } = fixture();
    const persistence = new MemoryRasterPersistence();
    const eligibility = rasterMergeDownEligibilityV1(snapshot, top.id);
    expect(eligibility).toMatchObject({ eligible: true, targetLayerId: bottom.id });

    const prepared = await prepareRasterMergeDownV1(snapshot, top.id, persistence);
    expect(prepared.tiles).toHaveLength(1);
    expect(persistence.writes).toHaveLength(1);
    const bytes = persistence.tiles.get(prepared.tiles[0]!.payloadRef)?.bytes;
    expect(bytes).toBeDefined();
    const centerAlpha = bytes?.[(16 * 64 + 16) * 4 + 3];
    expect(centerAlpha).toBeGreaterThanOrEqual(190);
    expect(centerAlpha).toBeLessThanOrEqual(192);

    const merged = applyPreparedRasterMergeDownV1(snapshot, prepared, parseRevision(1), new Date(0));
    expect(merged.document.layerTree.rootLayerIds).toEqual([bottom.id]);
    expect(merged.document.layerTree.layers[top.id]).toBeUndefined();
    expect(merged.document.layerTree.layers[bottom.id]).toMatchObject({
      type: 'raster',
      revision: 1,
      tiles: [{ x: 0, y: 0, revision: 1, payloadRef: prepared.tiles[0]!.payloadRef }],
    });
    expect(merged.committedStrokes).toHaveLength(2);
    expect(merged.committedStrokes.every((entry) => entry.stroke.layerId === bottom.id)).toBe(true);
    expect(merged.committedStrokes.every((entry) => entry.bakedToRasterLayer)).toBe(true);
  });

  it('preserves RGBA16F document precision in canonical tile persistence', async () => {
    const { snapshot, top } = fixture('rgba16-float');
    const persistence = new MemoryRasterPersistence();
    await prepareRasterMergeDownV1(snapshot, top.id, persistence);
    expect(persistence.writes[0]?.pixelFormat).toBe('rgba16-float');
    expect(persistence.tiles.get(persistence.writes[0]!.payloadRef)?.bytes.byteLength).toBe(64 * 64 * 8);
  });

  it('defers unsupported blend/opacity semantics to the compositor milestone instead of flattening incorrectly', () => {
    const { snapshot, bottom, top } = fixture();
    const changedTop = Object.freeze({ ...top, opacity: 0.5 });
    const changed: PaintProjectSnapshotV1 = Object.freeze({
      ...snapshot,
      document: Object.freeze({
        ...snapshot.document,
        layerTree: Object.freeze({
          rootLayerIds: snapshot.document.layerTree.rootLayerIds,
          layers: Object.freeze({ [bottom.id]: bottom, [top.id]: changedTop }),
        }),
      }),
    });
    expect(rasterMergeDownEligibilityV1(changed, top.id)).toMatchObject({
      eligible: false,
      reason: expect.stringContaining('compositor'),
    });
  });
});
''')
