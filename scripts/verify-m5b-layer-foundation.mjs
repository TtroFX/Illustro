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
console.log('M5B layer creation foundation verification passed');
