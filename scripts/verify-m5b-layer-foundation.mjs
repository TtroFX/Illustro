import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const requireText = (path, markers) => {
  const text = read(path);
  for (const marker of markers) {
    if (!text.includes(marker)) throw new Error(`${path} is missing ${marker}`);
  }
};

requireText('src/app/layer-creation.ts', [
  'createDefaultLayerV1',
  'createLinkedObjectLayer',
  'insertRootLayerSnapshotV1',
  'attachRasterMaskSnapshotV1',
  'core.identity',
]);
requireText('src/app/layer-workflow-controller.ts', [
  'commitSnapshotTransform',
  'paintPersistence.markDirty',
  'setActiveLayer',
  'mask.create.raster',
  'layer.create.',
]);
requireText('src/app/paint-session-controller.ts', [
  'activeLayerId(): LayerId | null',
  'selectedLayerIds(): readonly LayerId[]',
  'isLayerSelected(layerId: LayerId)',
  'selectLayer(',
  "PaintLayerSelectionModeV1 = 'replace' | 'toggle' | 'range'",
  'setActiveLayer(layerId: LayerId)',
  "activeLayer?.type !== 'raster'",
]);
requireText('src/app/main.ts', ['installLayerWorkflowControllerV1', 'layerWorkflow.dispose()']);
requireText('src/index.html', [
  'id="layer-add-raster"',
  'id="layer-add-folder"',
  'id="layer-add-vector"',
  'id="layer-add-adjustment"',
  'id="layer-add-fill"',
  'id="layer-add-gradient"',
  'id="layer-add-mask"',
  'id="layer-add-linked-object"',
  'id="layer-list"',
]);

requireText('src/app/layer-operations.ts', [
  'duplicateRootLayerSnapshotV1',
  'deleteRootLayerSnapshotV1',
  'renameLayerSnapshotV1',
  'reorderRootLayerSnapshotV1',
  'reorderRootLayerSelectionSnapshotV1',
  'moveRootLayerSelectionStepSnapshotV1',
  'canMoveRootLayerSelectionStepV1',
  'setLayerVisibilitySnapshotV1',
  'setLayerOpacitySnapshotV1',
  'setLayerAllLockSnapshotV1',
  'setLayerAlphaLockSnapshotV1',
  'setLayerClippingSnapshotV1',
  'clearLayerSnapshotV1',
]);
requireText('src/app/layer-raster-merge.ts', [
  'prepareRasterMergeDownV1',
  'applyPreparedRasterMergeDownV1',
  'rasterMergeDownEligibilityV1',
  'prepareRasterMergeVisibleCopyV1',
  'applyPreparedRasterMergeVisibleCopyV1',
  'rasterMergeVisibleCopyEligibilityV1',
  'bakedToRasterLayer',
  'persistRasterTile',
  'readRasterTile',
]);
requireText('src/app/layer-rasterize.ts', [
  'prepareLayerRasterizeV1',
  'applyPreparedLayerRasterizeV1',
  'layerRasterizeEligibilityV1',
  "'illustro.prepared-layer-rasterize/1'",
  'persistRasterTile',
  'solidFillBytes',
]);
requireText('src/app/layer-raster-invert.ts', [
  'prepareLayerInvertV1',
  'applyPreparedLayerInvertV1',
  'layerInvertEligibilityV1',
  'invertStraightRgbaBytesV1',
  "'illustro.prepared-layer-invert/1'",
  'bakedToRasterLayer',
  'persistRasterTile',
  'readRasterTile',
]);
requireText('src/app/layer-raster-flip.ts', [
  'prepareLayerRasterFlipV1',
  'applyPreparedLayerRasterFlipV1',
  'layerRasterFlipEligibilityV1',
  "'illustro.prepared-layer-raster-flip/1'",
  'CANONICAL_TILE_SIZE_PX',
  'bakedToRasterLayer',
  'persistRasterTile',
  'readRasterTile',
]);
requireText('src/app/layer-workflow-controller.ts', [
  "'layer.duplicate'",
  "'layer.delete'",
  "'layer.rename'",
  "'layer.reorder'",
  "'layer.visibility'",
  "'layer.opacity'",
  "'layer.lock'",
  "'layer.alpha-lock'",
  "'layer.clipping'",
  "'layer.clear'",
  "'layer.mergeDown'",
  "'layer.mergeVisibleCopy'",
  "'layer.rasterize'",
  "'layer.invert'",
  "'layer.flip.horizontal'",
  "'layer.flip.vertical'",
  "'layer.reorder.multi'",
  'prepareRasterMergeDownV1',
  'prepareRasterMergeVisibleCopyV1',
  'prepareLayerRasterizeV1',
  'prepareLayerInvertV1',
  'prepareLayerRasterFlipV1',
  'selectedLayerIds',
  'selectLayer(layerId, mode)',
  'pointermove',
]);
requireText('src/index.html', [
  'id="layer-duplicate"',
  'id="layer-delete"',
  'id="layer-clear"',
  'id="layer-merge-down"',
  'id="layer-merge-visible-copy"',
  'id="layer-rasterize"',
  'id="layer-invert"',
  'id="layer-flip-horizontal"',
  'id="layer-flip-vertical"',
  'id="layer-rename"',
  'id="layer-opacity"',
  'id="layer-lock"',
  'id="layer-alpha-lock"',
  'id="layer-move-up"',
  'id="layer-move-down"',
]);
requireText('src/workers/storage.worker.ts', [
  "type: 'storage.tile.put'",
  "type: 'storage.tile.get'",
  'persistRasterTile',
  'readImmutableObject',
  'decodeTile',
]);
requireText('src/app/paint-persistence-controller.ts', [
  'paintRasterTilePayloadRefV1',
  'parsePaintRasterTilePayloadRefV1',
  'persistRasterTile(input:',
  'readRasterTile(payloadRef:',
  "type: 'storage.tile.get'",
]);
requireText('src/app/layer-group-transform.ts', [
  'groupedLayerTransformEligibilityV1',
  'applyGroupedAffineLayerTransformSnapshotV1',
  "'illustro.grouped-affine-transform/1'",
  "kind: 'affine'",
  'transformStack',
]);
requireText('src/app/layer-workflow-controller.ts', [
  "'layer.transform.grouped'",
  'groupedLayerTransformEligibilityV1',
  'applyGroupedAffineLayerTransformSnapshotV1',
  'layer-group-transform-dialog',
]);
requireText('src/index.html', [
  'id="layer-group-transform"',
  'id="layer-group-transform-dialog"',
  'id="layer-group-transform-x"',
  'id="layer-group-transform-y"',
  'id="layer-group-transform-scale-x"',
  'id="layer-group-transform-scale-y"',
  'id="layer-group-transform-rotation"',
  'id="layer-group-transform-pivot-x"',
  'id="layer-group-transform-pivot-y"',
]);
requireText('src/app/layer-folder-transform.ts', [
  'folderLayerTransformEligibilityV1',
  'applyFolderAffineTransformSnapshotV1',
  "'illustro.folder-affine-transform/1'",
  "kind: 'affine'",
  'transformStack',
  'Lineart Group transform requires the synchronized lineart transform path',
]);
requireText('src/app/layer-workflow-controller.ts', [
  "'layer.transform.folder'",
  'folderLayerTransformEligibilityV1',
  'applyFolderAffineTransformSnapshotV1',
]);
requireText('src/app/layer-search.ts', [
  'normalizeLayerSearchQueryV1',
  'layerSearchTokensV1',
  'matchesLayerSearchV1',
  "normalize('NFKC')",
]);
requireText('src/app/layer-workflow-controller.ts', [
  "'#layer-search'",
  "'#layer-search-count'",
  'matchesLayerSearchV1',
  'illustroLayerSearchMatches',
]);
requireText('src/index.html', ['id="layer-search"', 'id="layer-search-count"']);
requireText('src/app/layer-filter.ts', [
  'LAYER_FILTER_IDS_V1',
  'parseLayerFilterIdV1',
  'matchesLayerFilterV1',
  "'state:hidden'",
  "'state:masked'",
]);
requireText('src/app/layer-workflow-controller.ts', [
  "'#layer-filter'",
  'matchesLayerFilterV1',
  'parseLayerFilterIdV1',
  'illustroLayerFilter',
]);
requireText('src/index.html', ['id="layer-filter"', 'value="state:hidden"', 'value="type:raster"']);
requireText('src/app/layer-cleanup.ts', [
  'layerCleanupCandidatesV1',
  'applyLayerCleanupSnapshotV1',
  "LayerCleanupModeV1 = 'empty' | 'hidden'",
  'lineart-group',
  'committedStrokes.filter',
]);
requireText('src/app/layer-workflow-controller.ts', [
  "'#layer-cleanup-empty'",
  "'#layer-cleanup-hidden'",
  "'layer.cleanup.empty'",
  "'layer.cleanup.hidden'",
  'applyLayerCleanupSnapshotV1',
]);
requireText('src/index.html', ['id="layer-cleanup-empty"', 'id="layer-cleanup-hidden"']);
console.log('M5B layer system verification passed');
