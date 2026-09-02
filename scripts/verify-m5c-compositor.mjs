import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const requireText = (path, markers) => {
  const text = read(path);
  for (const marker of markers) {
    if (!text.includes(marker)) throw new Error(`${path} is missing ${marker}`);
  }
};

requireText('src/gpu/blend-modes.ts', [
  'M5C_BASE_BLEND_MODE_IDS_V1',
  "'normal'",
  "'darken'",
  "'multiply'",
  "'color-burn'",
  "'linear-burn'",
  "'darker-color'",
  "'lighten'",
  "'screen'",
  "'color-dodge'",
  "'linear-dodge'",
  "'lighter-color'",
  "'overlay'",
  "'soft-light'",
  "'hard-light'",
  "'vivid-light'",
  "'linear-light'",
  "'pin-light'",
  "'hard-mix'",
  'compositeBlendRgbaV1',
  'sourceAlpha + backdropAlpha * (1 - sourceAlpha)',
]);
requireText('src/gpu/baseline-raster-tile-store.ts', [
  'readonly blendMode?: BlendModeId',
  'isM5cBaseBlendModeV1',
  'compositeBlendRgbaV1',
  "layer.blendMode ?? 'normal'",
]);
requireText('src/app/paint-session-controller.ts', [
  "layer.blendMode === 'normal'",
  '{ blendMode: layer.blendMode }',
]);
requireText('src/workers/render.worker.ts', [
  'isM5cBaseBlendModeV1',
  'candidate.blendMode',
  '{ blendMode: candidate.blendMode }',
]);
requireText('src/app/renderer-controller.ts', [
  'layer.blendMode',
  '{ blendMode: layer.blendMode }',
]);
requireText('src/app/layer-operations.ts', [
  'setLayerBlendModeSnapshotV1',
  "blendMode === 'pass-through'",
  'layer blend mode has no changes',
]);
requireText('src/app/layer-workflow-controller.ts', [
  "'#layer-blend-mode'",
  "'layer.blend-mode'",
  'setLayerBlendModeSnapshotV1',
]);
requireText('src/index.html', [
  'id="layer-blend-mode"',
  'value="normal"',
  'value="darken"',
  'value="multiply"',
  'value="color-burn"',
  'value="linear-burn"',
  'value="darker-color"',
  'value="lighten"',
  'value="screen"',
  'value="color-dodge"',
  'value="linear-dodge"',
  'value="lighter-color"',
  'value="overlay"',
  'value="soft-light"',
  'value="hard-light"',
  'value="vivid-light"',
  'value="linear-light"',
  'value="pin-light"',
  'value="hard-mix"',
]);
requireText('tests/unit/blend-modes.test.ts', ['M5C base blend kernels']);
requireText('tests/unit/baseline-blend-compositor.test.ts', [
  'M5C baseline tile compositor integration',
]);
requireText('IMPLEMENTATION_PROGRESS.md', [
  'M5C-001 Normal:完了',
  'M5C-002 Darken:完了',
  'M5C-003 Multiply:完了',
  'M5C-004 Color Burn:完了',
  'M5C-005 Linear Burn:完了',
  'M5C-006 Darker Color:完了',
  'M5C-007 Lighten:完了',
  'M5C-008 Screen:完了',
  'M5C-009 Color Dodge:完了',
  'M5C-010 Linear Dodge/Add:完了',
  'M5C-011 Lighter Color:完了',
  'M5C-012 Overlay:完了',
  'M5C-013 Soft Light:完了',
  'M5C-014 Hard Light:完了',
  'M5C-015 Vivid Light:完了',
  'M5C-016 Linear Light:完了',
  'M5C-017 Pin Light:完了',
  'M5C-018 Hard Mix:完了',
  'M5C-019 Difference:未完了',
]);

console.log('M5C blend compositor verification passed');
