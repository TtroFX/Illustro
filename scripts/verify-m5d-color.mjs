import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const requireText = (path, markers) => {
  const text = read(path);
  for (const marker of markers) {
    if (!text.includes(marker)) throw new Error(`${path} is missing ${marker}`);
  }
};

requireText('src/domain/color.ts', ['rgbToHsvV1', 'hsvToRgbV1', 'parseHexRgbV1', 'formatHexRgbV1']);
requireText('src/app/color-helper-grid.ts', [
  'intermediateColorGridV1',
  'approximateColorGridV1',
  'ApproximateColorAxisV1',
  "'lightness'",
]);
requireText('src/app/color-mixing-surface.ts', [
  'ColorMixingSurfaceV1',
  'paintLine(',
  'blendLine(',
  'presentationRgba8(',
  'convertWorkingSpace(',
]);
requireText('src/domain/color-management.ts', [
  'decodeSrgbTransferComponentV1',
  'convertEncodedRgbV1',
  'parseIccRgbMatrixProfileV1',
  'convertProfileEncodedRgbV1',
  'XYZ_D50_TO_D65',
  'previewOutputColorSpaceV1',
]);
requireText('src/domain/document.ts', [
  'DocumentColorProfileV1',
  'createDocumentColorProfileV1',
  'resolveDocumentColorProfileV1',
]);
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
  '#color-eyedropper',
  '#color-sampling-source',
  'ingestPointerBatch',
  '#color-palette-select',
  '#color-palette-name',
  '#color-palette-swatches',
  '#color-palette-import',
  '#color-palette-export',
  '#color-mixing-canvas',
  '#color-mixing-brush',
  '#color-mixing-blend',
  '#color-mixing-eyedropper',
  'mixingSurface.paintLine',
  'mixingSurface.blendLine',
  '#color-helper',
  '#color-intermediate-grid',
  '#color-approximate-grid',
  'intermediateColorGridV1',
  'approximateColorGridV1',
  'setPaintColor',
]);
requireText('src/gpu/baseline-brush.ts', [
  'readonly color?: BaselineBrushColorV1',
  'baselineDabColorV1',
]);
requireText('src/gpu/baseline-raster-tile-store.ts', [
  'rasterizeColorDab',
  'baselineDabColorV1',
  'readBaselineRasterTilePixelV1',
]);
requireText('src/app/color-sampling.ts', [
  'ColorSamplingOwnershipV1',
  'createRasterTileSamplingIndexV1',
  'sampleActiveLayerColorV1',
  'sampleMergedCanvasColorV1',
]);
requireText('src/app/main.ts', [
  'colorWorkflow.ingestPointerBatch',
  "'eyedropper'",
  'installReferenceWorkflowControllerV1',
  'colorWorkflow.applyExternalSample',
]);
requireText('src/app/reference-workflow-controller.ts', [
  'putImmutableObject',
  'readImmutableObject',
  "kind: 'reference-image'",
  'referenceViewSourcePointV1',
  'referenceRgbaBytesToColorV1',
]);
requireText('src/app/reference-workspace-state.ts', [
  'illustro.reference-workspace/1',
  'REFERENCE_WORKSPACE_LIMIT_V1',
]);

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
  'convertEncodedRgbV1',
  'colorSpace',
  'outputColorSpace',
]);
requireText('src/gpu/renderer-device-resources.ts', [
  'RendererPreviewColorSpaceUnavailableErrorV1',
  'colorSpace',
]);
requireText('src/app/paint-session-controller.ts', ['setPaintColor', 'color: this.#paintColor']);
requireText('src/app/canonical-raster-brush.ts', [
  'BaselineBrushDabBuilderV1',
  'readonly color?: BaselineBrushColorV1',
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
  'id="color-eyedropper"',
  'id="color-sampling-source"',
  'id="color-palette-select"',
  'id="reference-select"',
  'id="reference-import"',
  'id="reference-canvas"',
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
  'id="color-mixing-canvas"',
  'id="color-mixing-brush"',
  'id="color-mixing-blend"',
  'id="color-mixing-eyedropper"',
  'id="color-mixing-undo"',
  'id="color-mixing-redo"',
  'id="color-mixing-clear"',
  'id="color-helper"',
  'id="color-intermediate-grid"',
  'id="color-approximate-grid"',
  'id="color-approximate-x-axis"',
  'id="color-approximate-y-axis"',
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
  'M5D-016 Eyedropper:完了',
  'M5D-017 quick Eyedropper:完了',
  'M5D-018 active-layer sampling:完了',
  'M5D-019 merged-canvas sampling:完了',
  'M5D-020 reference-image sampling:完了',
  'M5D-021 sRGB processing:完了',
  'M5D-022 Display-P3 processing:完了',
  'M5D-023 color-profile metadata:完了',
  'M5D-024 profile-aware conversion:完了',
  'M5D-025 ICC/profile-aware preview boundary:完了',
  'M5D-026 Color Mixing Palette:完了',
  'M5D-027 Intermediate/Approximate Color helper:完了',
]);
requireText('src/app/color-match.ts', [
  'colorMatchStatisticsFromRgba8V1',
  'readLayerColorMatchSourceV1',
  'prepareLayerColorMatchV1',
  'persistPreparedLayerColorMatchV1',
  'applyPersistedLayerColorMatchV1',
  'colorMatchPreviewImageV1',
  'Color Match requires a Raster Layer',
]);
requireText('src/app/color-match-controller.ts', [
  'installColorMatchControllerV1',
  "'color.match'",
  'activeColorStatistics',
  'persistPreparedLayerColorMatchV1',
  'commitSnapshotTransform',
]);
requireText('src/app/reference-workflow-controller.ts', [
  'activeReferenceLabel',
  'activeColorStatistics',
  'convertEncodedRgbV1',
  'colorMatchStatisticsFromRgba8V1',
]);
requireText('src/app/main.ts', ['installColorMatchControllerV1', 'colorMatch.dispose()']);
requireText('src/index.html', [
  'id="color-match-command"',
  'id="color-match-dialog"',
  'id="color-match-strength"',
  'id="color-match-before"',
  'id="color-match-after"',
  'id="color-match-apply"',
]);
requireText('IMPLEMENTATION_PROGRESS.md', [
  'M5D-028 Color Match:完了',
  'M5D-検査 M5D内部検査:完了',
]);

console.log('M5D color/palette verification passed');
