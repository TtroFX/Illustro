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
  'pointermove',
]);
requireText('src/index.html', [
  'id="layer-duplicate"',
  'id="layer-delete"',
  'id="layer-rename"',
  'id="layer-opacity"',
  'id="layer-lock"',
  'id="layer-alpha-lock"',
  'id="layer-move-up"',
  'id="layer-move-down"',
]);
console.log('M5B layer system verification passed');
