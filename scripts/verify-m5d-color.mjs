import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const requireText = (path, markers) => {
  const text = read(path);
  for (const marker of markers) {
    if (!text.includes(marker)) throw new Error(`${path} is missing ${marker}`);
  }
};

requireText('src/domain/color.ts', ['rgbToHsvV1', 'hsvToRgbV1', 'parseHexRgbV1', 'formatHexRgbV1']);
requireText('src/app/color-workspace-state.ts', [
  'illustro.color-workspace/1',
  'COLOR_HISTORY_LIMIT_V1',
  'current',
  'previous',
  'history',
]);
requireText('src/app/color-workflow-controller.ts', [
  '#color-wheel',
  '#color-sv',
  '#color-r',
  '#color-g',
  '#color-b',
  '#color-h',
  '#color-s',
  '#color-v',
  '#color-hex',
  '#color-current',
  '#color-previous',
  '#color-history',
  'setPaintColor',
]);
requireText('src/gpu/baseline-brush.ts', [
  'readonly color?: BaselineBrushColorV1',
  'baselineDabColorV1',
]);
requireText('src/gpu/baseline-raster-tile-store.ts', ['rasterizeColorDab', 'baselineDabColorV1']);
requireText('src/gpu/shaders/baseline-brush.wgsl', [
  '@location(3) color: vec3f',
  'input.color * alpha',
]);
requireText('src/gpu/baseline-paint-renderer.ts', [
  'const INSTANCE_FLOATS = 8;',
  "format: 'float32x3'",
]);
requireText('src/app/compatibility-raster-presenter.ts', [
  'baselineDabColorV1',
  'gradient.addColorStop',
]);
requireText('src/app/paint-session-controller.ts', [
  'setPaintColor',
  'new BaselineBrushDabBuilderV1({ color: this.#paintColor })',
]);
requireText('src/workers/render.worker.ts', ['freezeBaselineBrushColorV1', 'candidate.color']);
requireText('src/index.html', [
  'id="color-wheel"',
  'id="color-sv"',
  'id="color-r"',
  'id="color-g"',
  'id="color-b"',
  'id="color-h"',
  'id="color-s"',
  'id="color-v"',
  'id="color-hex"',
  'id="color-current"',
  'id="color-previous"',
  'id="color-history"',
]);
requireText('IMPLEMENTATION_PROGRESS.md', [
  'M5D-001 Color Wheel:完了',
  'M5D-002 RGB entry:完了',
  'M5D-003 HSV/HSB entry:完了',
  'M5D-004 HEX entry:完了',
  'M5D-005 current color:完了',
  'M5D-006 previous color:完了',
  'M5D-007 color history:完了',
  'M5D-008 palette create:未完了',
]);
console.log('M5D color foundation verification passed');
