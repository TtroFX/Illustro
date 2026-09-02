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
  'palettes',
  'activePaletteId',
  'createColorPaletteInWorkspaceV1',
  'renameColorPaletteV1',
  'deleteColorPaletteV1',
  'moveColorPaletteV1',
  'moveColorWithinPaletteV1',
  'parseColorPaletteBundleV1',
  'serializeColorPaletteBundleV1',
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
  '#color-palette-select',
  '#color-palette-name',
  '#color-palette-swatches',
  '#color-palette-import',
  '#color-palette-export',
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
  'id="color-palette-select"',
  'id="color-palette-name"',
  'id="color-palette-create"',
  'id="color-palette-delete"',
  'id="color-palette-up"',
  'id="color-palette-down"',
  'id="color-palette-swatches"',
  'id="color-palette-add-current"',
  'id="color-palette-color-left"',
  'id="color-palette-color-right"',
  'id="color-palette-color-delete"',
  'id="color-palette-import"',
  'id="color-palette-export"',
]);
requireText('IMPLEMENTATION_PROGRESS.md', [
  'M5D-001 Color Wheel:完了',
  'M5D-002 RGB entry:完了',
  'M5D-003 HSV/HSB entry:完了',
  'M5D-004 HEX entry:完了',
  'M5D-005 current color:完了',
  'M5D-006 previous color:完了',
  'M5D-007 color history:完了',
  'M5D-008 palette create:完了',
  'M5D-009 palette rename:完了',
  'M5D-010 palette delete:完了',
  'M5D-011 multiple named palettes:完了',
  'M5D-012 palette reorder:完了',
  'M5D-013 palette-color reorder:完了',
  'M5D-014 palette import:完了',
  'M5D-015 palette export:完了',
  'M5D-016 Eyedropper:未完了',
]);
console.log('M5D color/palette verification passed');
