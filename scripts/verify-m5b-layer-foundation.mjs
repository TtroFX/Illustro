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
  'prepareRasterMergeDownV1',
  'prepareRasterMergeVisibleCopyV1',
  'prepareLayerRasterizeV1',
  'prepareLayerInvertV1',
  'prepareLayerRasterFlipV1',
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
console.log('M5B layer system verification passed');
