from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected exactly one anchor, found {count}: {old[:120]!r}')
    file.write_text(text.replace(old, new, 1))


def append_once(path: str, marker: str, addition: str) -> None:
    file = Path(path)
    text = file.read_text()
    if marker in text:
        raise SystemExit(f'{path}: marker already present: {marker}')
    file.write_text(text.rstrip() + '\n\n' + addition.strip() + '\n')


replace_once(
    'src/app/layer-raster-merge.ts',
    "import type { RasterLayerV1, RasterTileReferenceV1 } from '../domain/layers.js';",
    "import {\n  createRasterLayer,\n  type RasterLayerV1,\n  type RasterTileReferenceV1,\n} from '../domain/layers.js';",
)

replace_once(
    'src/app/layer-raster-merge.ts',
    "export interface PreparedRasterMergeDownV1 {\n  readonly schema: 'illustro.prepared-raster-merge-down/1';\n  readonly sourceLayerId: LayerId;\n  readonly targetLayerId: LayerId;\n  readonly sourceLayerRevision: Revision;\n  readonly targetLayerRevision: Revision;\n  readonly documentRevision: Revision;\n  readonly tiles: readonly PreparedRasterMergeTileV1[];\n}\n",
    "export interface PreparedRasterMergeDownV1 {\n  readonly schema: 'illustro.prepared-raster-merge-down/1';\n  readonly sourceLayerId: LayerId;\n  readonly targetLayerId: LayerId;\n  readonly sourceLayerRevision: Revision;\n  readonly targetLayerRevision: Revision;\n  readonly documentRevision: Revision;\n  readonly tiles: readonly PreparedRasterMergeTileV1[];\n}\n\nexport interface RasterMergeVisibleCopyEligibilityV1 {\n  readonly eligible: boolean;\n  readonly visibleLayerIds: readonly LayerId[];\n  readonly reason: string | null;\n}\n\nexport interface PreparedRasterMergeVisibleCopySourceV1 {\n  readonly layerId: LayerId;\n  readonly revision: Revision;\n}\n\nexport interface PreparedRasterMergeVisibleCopyV1 {\n  readonly schema: 'illustro.prepared-raster-merge-visible-copy/1';\n  readonly outputLayerId: LayerId;\n  readonly outputLayerName: string;\n  readonly documentRevision: Revision;\n  readonly sourceLayers: readonly PreparedRasterMergeVisibleCopySourceV1[];\n  readonly tiles: readonly PreparedRasterMergeTileV1[];\n}\n",
)

replace_once(
    'src/app/layer-raster-merge.ts',
    "function tileKey(tx: number, ty: number): string {",
    "function visibleCopyRasterReason(layer: RasterLayerV1): string | null {\n  if (layer.opacity !== 1)\n    return 'merge visible copy opacity baking requires the compositor milestone';\n  if (layer.blendMode !== 'normal')\n    return 'merge visible copy blend baking requires the compositor milestone';\n  if (layer.clipping !== null)\n    return 'merge visible copy clipping baking requires compositor integration';\n  if (layer.masks.length > 0)\n    return 'merge visible copy mask baking requires mask compositor integration';\n  if (layer.transformStack.length > 0)\n    return 'merge visible copy transform baking requires rasterize integration';\n  if (layer.effectStack.length > 0)\n    return 'merge visible copy effect baking requires effect compositor integration';\n  return null;\n}\n\nexport function rasterMergeVisibleCopyEligibilityV1(\n  snapshot: PaintProjectSnapshotV1,\n): RasterMergeVisibleCopyEligibilityV1 {\n  const visibleLayerIds: LayerId[] = [];\n  for (const layerId of snapshot.document.layerTree.rootLayerIds) {\n    const layer = snapshot.document.layerTree.layers[layerId];\n    if (layer === undefined) {\n      return Object.freeze({\n        eligible: false,\n        visibleLayerIds: Object.freeze([...visibleLayerIds]),\n        reason: 'merge visible copy found a missing root layer',\n      });\n    }\n    if (!layer.visible || layer.type === 'lineartBoundary') continue;\n    visibleLayerIds.push(layerId);\n    if (layer.type !== 'raster') {\n      return Object.freeze({\n        eligible: false,\n        visibleLayerIds: Object.freeze([...visibleLayerIds]),\n        reason: 'baseline merge visible copy currently requires visible raster artwork layers',\n      });\n    }\n    const reason = visibleCopyRasterReason(layer as RasterLayerV1);\n    if (reason !== null) {\n      return Object.freeze({\n        eligible: false,\n        visibleLayerIds: Object.freeze([...visibleLayerIds]),\n        reason,\n      });\n    }\n  }\n  if (visibleLayerIds.length === 0) {\n    return Object.freeze({\n      eligible: false,\n      visibleLayerIds: Object.freeze([]),\n      reason: 'merge visible copy requires at least one visible artwork layer',\n    });\n  }\n  return Object.freeze({\n    eligible: true,\n    visibleLayerIds: Object.freeze([...visibleLayerIds]),\n    reason: null,\n  });\n}\n\nfunction tileKey(tx: number, ty: number): string {",
)

append_once(
    'src/app/layer-raster-merge.ts',
    'prepareRasterMergeVisibleCopyV1',
    r'''export async function prepareRasterMergeVisibleCopyV1(
  snapshot: PaintProjectSnapshotV1,
  outputLayerName: string,
  persistence: RasterMergePersistencePortV1,
): Promise<PreparedRasterMergeVisibleCopyV1> {
  const eligibility = rasterMergeVisibleCopyEligibilityV1(snapshot);
  if (!eligibility.eligible) {
    throw new Error(eligibility.reason ?? 'merge visible copy is unavailable');
  }
  const outputTemplate = createRasterLayer({ name: outputLayerName });
  const width = snapshot.document.canvas.width;
  const height = snapshot.document.canvas.height;
  const format = snapshot.document.color.precision;
  const sourceStates = eligibility.visibleLayerIds.map((layerId) => {
    const layer = snapshot.document.layerTree.layers[layerId];
    if (layer?.type !== 'raster') throw new Error('merge visible copy source changed');
    const raster = layer as RasterLayerV1;
    return Object.freeze({
      layer: raster,
      strokes: unbakedLayerStrokes(snapshot, layerId),
      refs: indexTileReferences(raster),
    });
  });
  const coordinates = new Map<string, TileCoordinateV1>();
  for (const state of sourceStates) {
    for (const [key, coordinate] of touchedCoordinates(
      state.layer,
      state.strokes,
      width,
      height,
    )) {
      coordinates.set(key, coordinate);
    }
  }
  const tiles: PreparedRasterMergeTileV1[] = [];
  for (const [key, coordinate] of [...coordinates.entries()].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    const bounds = tileBoundsForDocumentV1(width, height, coordinate);
    let composite = new Float32Array(bounds.validWidth * bounds.validHeight * 4);
    for (const state of sourceStates) {
      const layerPixels = await loadLayerTile(
        persistence,
        state.refs.get(key),
        format,
        bounds.validWidth,
        bounds.validHeight,
      );
      rasterizeStrokes(
        layerPixels,
        state.strokes,
        bounds.x,
        bounds.y,
        bounds.validWidth,
        bounds.validHeight,
      );
      composite = sourceOver(composite, layerPixels);
    }
    if (!hasCoverage(composite)) continue;
    const persisted = await persistence.persistRasterTile({
      width: bounds.validWidth,
      height: bounds.validHeight,
      pixelFormat: format,
      bytes: encodePremultipliedToStraight(composite, format),
    });
    tiles.push(
      Object.freeze({ x: coordinate.tx, y: coordinate.ty, payloadRef: persisted.payloadRef }),
    );
  }
  return Object.freeze({
    schema: 'illustro.prepared-raster-merge-visible-copy/1' as const,
    outputLayerId: outputTemplate.id,
    outputLayerName: outputTemplate.name,
    documentRevision: snapshot.document.revision,
    sourceLayers: Object.freeze(
      sourceStates.map((state) =>
        Object.freeze({ layerId: state.layer.id, revision: state.layer.revision }),
      ),
    ),
    tiles: Object.freeze(tiles),
  });
}

export function applyPreparedRasterMergeVisibleCopyV1(
  snapshot: PaintProjectSnapshotV1,
  prepared: PreparedRasterMergeVisibleCopyV1,
  revisionValue: Revision | number,
  now: Date = new Date(),
): PaintProjectSnapshotV1 {
  const revision = parseRevision(revisionValue);
  if (snapshot.document.revision !== prepared.documentRevision) {
    throw new Error('merge visible copy document changed before commit');
  }
  if (prepared.outputLayerId in snapshot.document.layerTree.layers) {
    throw new Error('merge visible copy output layer identity already exists');
  }
  const eligibility = rasterMergeVisibleCopyEligibilityV1(snapshot);
  if (!eligibility.eligible) {
    throw new Error(eligibility.reason ?? 'merge visible copy is unavailable');
  }
  if (
    eligibility.visibleLayerIds.length !== prepared.sourceLayers.length ||
    eligibility.visibleLayerIds.some(
      (layerId, index) => layerId !== prepared.sourceLayers[index]?.layerId,
    )
  ) {
    throw new Error('merge visible copy source set changed before commit');
  }
  for (const source of prepared.sourceLayers) {
    const layer = snapshot.document.layerTree.layers[source.layerId];
    if (layer?.type !== 'raster' || layer.revision !== source.revision) {
      throw new Error('merge visible copy source changed before commit');
    }
  }
  const outputLayer = Object.freeze({
    ...createRasterLayer({ id: prepared.outputLayerId, name: prepared.outputLayerName }),
    revision,
    tiles: Object.freeze(
      prepared.tiles.map(
        (tile): RasterTileReferenceV1 =>
          Object.freeze({ x: tile.x, y: tile.y, revision, payloadRef: tile.payloadRef }),
      ),
    ),
    boundsHint: null,
  }) as RasterLayerV1;
  return Object.freeze({
    schema: 'illustro.paint-project-snapshot/1' as const,
    document: Object.freeze({
      ...snapshot.document,
      revision,
      modifiedAt: now.toISOString(),
      layerTree: Object.freeze({
        rootLayerIds: Object.freeze([
          ...snapshot.document.layerTree.rootLayerIds,
          prepared.outputLayerId,
        ]),
        layers: Object.freeze({
          ...snapshot.document.layerTree.layers,
          [prepared.outputLayerId]: outputLayer,
        }),
      }),
    }),
    committedStrokes: snapshot.committedStrokes,
  });
}''',
)

replace_once(
    'src/app/layer-workflow-controller.ts',
    "import {\n  applyPreparedRasterMergeDownV1,\n  prepareRasterMergeDownV1,\n  rasterMergeDownEligibilityV1,\n} from './layer-raster-merge.js';",
    "import {\n  applyPreparedRasterMergeDownV1,\n  applyPreparedRasterMergeVisibleCopyV1,\n  prepareRasterMergeDownV1,\n  prepareRasterMergeVisibleCopyV1,\n  rasterMergeDownEligibilityV1,\n  rasterMergeVisibleCopyEligibilityV1,\n} from './layer-raster-merge.js';",
)

replace_once(
    'src/app/layer-workflow-controller.ts',
    "function iconButton(\n",
    "function nextMergedVisibleName(layers: Readonly<Record<string, LayerBaseV1>>): string {\n  const base = 'Merged Visible';\n  const used = new Set(Object.values(layers).map((layer) => layer.name));\n  if (!used.has(base)) return base;\n  for (let suffix = 2; suffix < Number.MAX_SAFE_INTEGER; suffix += 1) {\n    const candidate = `${base} ${suffix}`;\n    if (!used.has(candidate)) return candidate;\n  }\n  throw new RangeError('merged visible layer name sequence is exhausted');\n}\n\nfunction iconButton(\n",
)

replace_once(
    'src/app/layer-workflow-controller.ts',
    "  const mergeDownButton = required<HTMLButtonElement>('#layer-merge-down');\n",
    "  const mergeDownButton = required<HTMLButtonElement>('#layer-merge-down');\n  const mergeVisibleCopyButton = required<HTMLButtonElement>('#layer-merge-visible-copy');\n",
)

replace_once(
    'src/app/layer-workflow-controller.ts',
    "    const mergeEligibility =\n      active === null\n        ? null\n        : rasterMergeDownEligibilityV1(options.paintSession.projectSnapshot()!, active.id);\n    mergeDownButton.disabled =\n      mergeEligibility?.eligible !== true || options.paintSession.activeStrokeId() !== null;\n    mergeDownButton.title = mergeEligibility?.reason ?? '下のレイヤーと結合';\n",
    "    const projectSnapshot = options.paintSession.projectSnapshot();\n    const mergeEligibility =\n      active === null || projectSnapshot === null\n        ? null\n        : rasterMergeDownEligibilityV1(projectSnapshot, active.id);\n    mergeDownButton.disabled =\n      mergeEligibility?.eligible !== true || options.paintSession.activeStrokeId() !== null;\n    mergeDownButton.title = mergeEligibility?.reason ?? '下のレイヤーと結合';\n    const mergeVisibleEligibility =\n      projectSnapshot === null ? null : rasterMergeVisibleCopyEligibilityV1(projectSnapshot);\n    mergeVisibleCopyButton.disabled =\n      mergeVisibleEligibility?.eligible !== true || options.paintSession.activeStrokeId() !== null;\n    mergeVisibleCopyButton.title =\n      mergeVisibleEligibility?.reason ?? '表示レイヤーを結合コピー';\n",
)

replace_once(
    'src/app/layer-workflow-controller.ts',
    "  const onDelete = (): void => {\n",
    r'''  const onMergeVisibleCopy = (): void => {
    options.schedule(async () => {
      try {
        if (options.paintSession.activeStrokeId() !== null) {
          throw new Error('merge visible copy is unavailable while a stroke is active');
        }
        const current = options.paintSession.projectSnapshot();
        if (current === null) return;
        const prepared = await prepareRasterMergeVisibleCopyV1(
          current,
          nextMergedVisibleName(current.document.layerTree.layers),
          options.paintPersistence,
        );
        const transaction = await options.paintHistory.commitSnapshotTransform(
          'layer.mergeVisibleCopy',
          (before, revision) =>
            applyPreparedRasterMergeVisibleCopyV1(before, prepared, revision),
        );
        options.paintSession.setActiveLayer(prepared.outputLayerId);
        await options.paintPersistence.markDirty(transaction.transactionId);
        root.dataset.illustroLayerTransaction = transaction.transactionId;
        clearError();
        refresh();
        options.onHistoryChanged();
      } catch (error) {
        publishError(error);
      }
    });
  };

  const onDelete = (): void => {
''',
)

replace_once(
    'src/app/layer-workflow-controller.ts',
    "  mergeDownButton.addEventListener('click', onMergeDown);\n",
    "  mergeDownButton.addEventListener('click', onMergeDown);\n  mergeVisibleCopyButton.addEventListener('click', onMergeVisibleCopy);\n",
)

replace_once(
    'src/app/layer-workflow-controller.ts',
    "      mergeDownButton.removeEventListener('click', onMergeDown);\n",
    "      mergeDownButton.removeEventListener('click', onMergeDown);\n      mergeVisibleCopyButton.removeEventListener('click', onMergeVisibleCopy);\n",
)

replace_once(
    'src/index.html',
    '              <button id="layer-merge-down" type="button" aria-label="下のレイヤーと結合" title="下のレイヤーと結合">↧</button>\n',
    '              <button id="layer-merge-down" type="button" aria-label="下のレイヤーと結合" title="下のレイヤーと結合">↧</button>\n              <button id="layer-merge-visible-copy" type="button" aria-label="表示レイヤーを結合コピー" title="表示レイヤーを結合コピー">⇊</button>\n',
)

replace_once(
    'scripts/verify-m5b-layer-foundation.mjs',
    "  'rasterMergeDownEligibilityV1',\n  'bakedToRasterLayer',",
    "  'rasterMergeDownEligibilityV1',\n  'prepareRasterMergeVisibleCopyV1',\n  'applyPreparedRasterMergeVisibleCopyV1',\n  'rasterMergeVisibleCopyEligibilityV1',\n  'bakedToRasterLayer',",
)
replace_once(
    'scripts/verify-m5b-layer-foundation.mjs',
    "  \"'layer.mergeDown'\",\n  'prepareRasterMergeDownV1',",
    "  \"'layer.mergeDown'\",\n  \"'layer.mergeVisibleCopy'\",\n  'prepareRasterMergeDownV1',\n  'prepareRasterMergeVisibleCopyV1',",
)
replace_once(
    'scripts/verify-m5b-layer-foundation.mjs',
    "  'id=\"layer-merge-down\"',\n  'id=\"layer-rename\"',",
    "  'id=\"layer-merge-down\"',\n  'id=\"layer-merge-visible-copy\"',\n  'id=\"layer-rename\"',",
)

replace_once(
    'tests/unit/layer-raster-merge.test.ts',
    "import {\n  applyPreparedRasterMergeDownV1,\n  prepareRasterMergeDownV1,\n  rasterMergeDownEligibilityV1,",
    "import {\n  applyPreparedRasterMergeDownV1,\n  applyPreparedRasterMergeVisibleCopyV1,\n  prepareRasterMergeDownV1,\n  prepareRasterMergeVisibleCopyV1,\n  rasterMergeDownEligibilityV1,\n  rasterMergeVisibleCopyEligibilityV1,",
)
replace_once(
    'tests/unit/layer-raster-merge.test.ts',
    "import { createRasterLayer } from '../../src/domain/layers.js';",
    "import { createRasterLayer, createVectorLayer } from '../../src/domain/layers.js';",
)

append_once(
    'tests/unit/layer-raster-merge.test.ts',
    "describe('M5B canonical merge visible copy'",
    r'''describe('M5B canonical merge visible copy', () => {
  it('creates a new top raster copy while preserving every source layer and stroke', async () => {
    const { snapshot, bottom, top } = fixture();
    const persistence = new MemoryRasterPersistence();
    const eligibility = rasterMergeVisibleCopyEligibilityV1(snapshot);
    expect(eligibility).toMatchObject({
      eligible: true,
      visibleLayerIds: [bottom.id, top.id],
    });

    const prepared = await prepareRasterMergeVisibleCopyV1(
      snapshot,
      'Merged Visible',
      persistence,
    );
    expect(prepared.sourceLayers.map((source) => source.layerId)).toEqual([bottom.id, top.id]);
    expect(prepared.tiles).toHaveLength(1);
    const firstTile = prepared.tiles[0];
    expect(firstTile).toBeDefined();
    const bytes = firstTile === undefined ? undefined : persistence.tiles.get(firstTile.payloadRef)?.bytes;
    const centerAlpha = bytes?.[(16 * 64 + 16) * 4 + 3];
    expect(centerAlpha).toBeGreaterThanOrEqual(190);
    expect(centerAlpha).toBeLessThanOrEqual(192);

    const merged = applyPreparedRasterMergeVisibleCopyV1(
      snapshot,
      prepared,
      parseRevision(1),
      new Date(0),
    );
    expect(merged.document.layerTree.rootLayerIds).toEqual([
      bottom.id,
      top.id,
      prepared.outputLayerId,
    ]);
    expect(merged.document.layerTree.layers[bottom.id]).toEqual(bottom);
    expect(merged.document.layerTree.layers[top.id]).toEqual(top);
    expect(merged.document.layerTree.layers[prepared.outputLayerId]).toMatchObject({
      id: prepared.outputLayerId,
      type: 'raster',
      name: 'Merged Visible',
      revision: 1,
      visible: true,
      tiles: [{ x: 0, y: 0, revision: 1, payloadRef: firstTile?.payloadRef }],
    });
    expect(merged.committedStrokes).toEqual(snapshot.committedStrokes);
    expect(
      merged.committedStrokes.some((entry) => entry.stroke.layerId === prepared.outputLayerId),
    ).toBe(false);
  });

  it('preserves RGBA16F precision for merged-visible canonical tiles', async () => {
    const { snapshot } = fixture('rgba16-float');
    const persistence = new MemoryRasterPersistence();
    await prepareRasterMergeVisibleCopyV1(snapshot, 'Merged Visible', persistence);
    expect(persistence.writes[0]?.pixelFormat).toBe('rgba16-float');
    const firstWrite = persistence.writes[0];
    const bytes =
      firstWrite === undefined ? undefined : persistence.tiles.get(firstWrite.payloadRef)?.bytes;
    expect(bytes?.byteLength).toBe(64 * 64 * 8);
  });

  it('ignores hidden unsupported layers but refuses visible semantics not yet owned by M5B', () => {
    const { snapshot, bottom, top } = fixture();
    const vector = createVectorLayer({ name: 'Vector', visible: false });
    const hiddenVectorSnapshot: PaintProjectSnapshotV1 = Object.freeze({
      ...snapshot,
      document: Object.freeze({
        ...snapshot.document,
        layerTree: Object.freeze({
          rootLayerIds: Object.freeze([bottom.id, vector.id, top.id]),
          layers: Object.freeze({
            [bottom.id]: bottom,
            [vector.id]: vector,
            [top.id]: top,
          }),
        }),
      }),
    });
    expect(rasterMergeVisibleCopyEligibilityV1(hiddenVectorSnapshot)).toMatchObject({
      eligible: true,
      visibleLayerIds: [bottom.id, top.id],
    });

    const visibleVector = Object.freeze({ ...vector, visible: true });
    const visibleVectorSnapshot: PaintProjectSnapshotV1 = Object.freeze({
      ...hiddenVectorSnapshot,
      document: Object.freeze({
        ...hiddenVectorSnapshot.document,
        layerTree: Object.freeze({
          rootLayerIds: hiddenVectorSnapshot.document.layerTree.rootLayerIds,
          layers: Object.freeze({
            [bottom.id]: bottom,
            [vector.id]: visibleVector,
            [top.id]: top,
          }),
        }),
      }),
    });
    expect(rasterMergeVisibleCopyEligibilityV1(visibleVectorSnapshot)).toMatchObject({
      eligible: false,
      reason: expect.stringContaining('raster'),
    });
  });
});''',
)
