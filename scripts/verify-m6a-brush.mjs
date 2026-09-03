import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function requireText(source, needle, label) {
  if (!source.includes(needle)) {
    throw new Error(`M6A verification failed: ${label}`);
  }
}

const canonical = read('src/app/canonical-raster-brush.ts');
const session = read('src/app/paint-session-controller.ts');
const main = read('src/app/main.ts');
const tests = read('tests/unit/canonical-raster-brush.test.ts');
const progress = read('IMPLEMENTATION_PROGRESS.md');

requireText(
  canonical,
  "export type CanonicalBrushModeV1 = 'raster' | 'eraser' | 'smudge' | 'blur';",
  'Raster/Eraser/Smudge/Blur mode identity missing',
);
requireText(
  canonical,
  'class CanonicalRasterBrushStrokeV1',
  'canonical Raster Brush stroke facade missing',
);
requireText(
  canonical,
  'this.#kernel.appendDelta(samples)',
  'Raster Brush must preserve incremental low-level dab generation',
);
requireText(
  canonical,
  'reprocessedStableDabCount: 0 as const',
  'stable-prefix no-reprocessing counter missing',
);
requireText(
  session,
  'CanonicalRasterBrushStrokeV1',
  'paint session is not wired to canonical Raster Brush',
);
requireText(session, 'brushMode: this.#brushMode', 'paint-session mode state is not exposed');
requireText(
  session,
  'brushMode: this.#brushMode,',
  'new strokes do not persist Raster mode identity',
);
requireText(
  session,
  'builder.appendConfirmed(additions)',
  'confirmed batches do not use canonical incremental append',
);
requireText(main, 'illustroBrushMode', 'runtime Raster Brush diagnostics are not published');
requireText(tests, 'long stable prefix', 'stable-prefix regression coverage missing');
requireText(progress, 'M6A-001 Raster Brush mode:完了', 'M6A-001 progress is not complete');
requireText(progress, 'M6A-002 Eraser mode:完了', 'M6A-002 progress is not complete');
requireText(progress, 'M6A-003 Smudge/Finger mode:完了', 'M6A-003 progress is not complete');
requireText(
  read('src/gpu/baseline-raster-tile-store.ts'),
  'rasterizeEraseDab',
  'canonical eraser rasterization missing',
);
requireText(
  read('src/app/renderer-controller.ts'),
  "operation !== 'paint'",
  'tile-changing brush recomposite presentation path missing',
);
requireText(
  read('src/workers/render.worker.ts'),
  "value.operation === 'erase'",
  'worker eraser protocol missing',
);
requireText(read('src/index.html'), 'id="brush-mode-eraser"', 'reachable Eraser control missing');
requireText(
  read('src/gpu/baseline-raster-tile-store.ts'),
  'rasterizeSmudgeDab',
  'canonical Smudge rasterization missing',
);
requireText(
  read('src/gpu/baseline-raster-tile-store.ts'),
  'sampleSmudgeSnapshot',
  'Smudge snapshot sampling missing',
);
requireText(
  read('src/app/renderer-controller.ts'),
  "operation !== 'paint'",
  'tile-changing brush modes do not use canonical recomposite presentation',
);
requireText(
  read('src/workers/render.worker.ts'),
  "value.operation === 'smudge'",
  'worker Smudge protocol missing',
);
requireText(read('src/index.html'), 'id="brush-mode-smudge"', 'reachable Smudge control missing');
requireText(
  read('tests/unit/smudge-mode.test.ts'),
  'immutable pre-dab snapshot',
  'Smudge snapshot regression coverage missing',
);
requireText(progress, 'M6A-004 Blur brush mode:完了', 'M6A-004 progress is not complete');
for (const item of [
  'M6A-005 preset create:完了',
  'M6A-006 preset duplicate:完了',
  'M6A-007 preset rename:完了',
  'M6A-008 preset delete:完了',
  'M6A-009 preset search:完了',
  'M6A-010 preset categories:完了',
  'M6A-011 preset lock:完了',
  'M6A-012 preset reset:完了',
]) {
  requireText(progress, item, `${item.split(':')[0]} progress is not complete`);
}
requireText(
  read('src/domain/brush-schema.ts'),
  'export interface BrushPresetV1',
  'canonical BrushPresetV1 management shape missing',
);
requireText(
  read('src/app/brush-preset-library.ts'),
  'serializeBrushPresetLibraryV1',
  'brush preset persistence missing',
);
requireText(
  read('src/app/brush-preset-library.ts'),
  'factory brush preset cannot be deleted',
  'factory preset protection missing',
);
requireText(
  read('src/app/brush-preset-controller.ts'),
  'paintSession.setBrushMode',
  'preset selection is not connected to production brush behavior',
);
requireText(
  read('src/index.html'),
  'id="brush-preset-list"',
  'reachable Brush Presets panel missing',
);
requireText(
  read('tests/unit/brush-preset-library.test.ts'),
  'factory presets undeletable',
  'preset management regression coverage missing',
);

requireText(
  read('src/gpu/baseline-raster-tile-store.ts'),
  'rasterizeBlurDab',
  'canonical Blur rasterization missing',
);
requireText(
  read('src/gpu/baseline-raster-tile-store.ts'),
  'BLUR_BRUSH_WEIGHTS',
  'bounded Blur kernel missing',
);
requireText(
  read('src/workers/render.worker.ts'),
  "value.operation === 'blur'",
  'worker Blur protocol missing',
);
requireText(read('src/index.html'), 'id="brush-mode-blur"', 'reachable Blur control missing');
requireText(
  read('tests/unit/blur-brush-mode.test.ts'),
  'premultiplied blur',
  'Blur regression coverage missing',
);
for (const item of [
  'M6A-013 brush size:完了',
  'M6A-014 opacity:完了',
  'M6A-015 flow/density:完了',
  'M6A-016 per-brush parameter limits:完了',
]) {
  requireText(progress, item, `${item.split(':')[0]} progress is not complete`);
}
requireText(
  read('src/domain/brush-schema.ts'),
  'brushParameterLimitsV1',
  'per-brush parameter limits are missing',
);
requireText(
  read('src/app/paint-session-controller.ts'),
  'setBrushParameters',
  'brush properties are not connected to the production paint session',
);
requireText(
  read('src/gpu/baseline-brush.ts'),
  'baselineDabStrokeOpacityV1',
  'flow/stroke-opacity dab semantics are missing',
);
requireText(
  read('src/gpu/baseline-raster-tile-store.ts'),
  'paintCoverage',
  'stroke-opacity accumulation state is missing',
);
requireText(
  read('src/index.html'),
  'id="brush-size-range"',
  'reachable brush-size Tool Properties control missing',
);
requireText(
  read('tests/unit/brush-properties.test.ts'),
  'caps accumulated paint alpha',
  'brush opacity/flow regression coverage missing',
);
requireText(progress, 'M6A-017 procedural tip:完了', 'M6A-017 progress is not complete');
requireText(progress, 'M6A-018 sampled image tip:完了', 'M6A-018 progress is not complete');
requireText(
  read('src/domain/brush-schema.ts'),
  'brushTipShapeV1',
  'sampled brush tip schema normalization missing',
);
requireText(
  read('src/gpu/baseline-brush.ts'),
  'BASELINE_SAMPLED_IMAGE_TIP_ALPHA_V1',
  'sampled brush tip alpha image missing',
);
requireText(
  read('src/app/brush-preset-controller.ts'),
  'updateBrushPresetTipShapeV1',
  'sampled brush tip is not production-connected to the preset UI',
);
requireText(
  read('tests/unit/sampled-image-brush-tip.test.ts'),
  'alpha-weighted primitive dabs',
  'sampled image brush tip regression coverage missing',
);
requireText(
  read('src/domain/brush-schema.ts'),
  'brushProceduralTipShapeV1',
  'procedural tip descriptor normalization missing',
);
requireText(
  read('src/gpu/baseline-raster-tile-store.ts'),
  'baselineProceduralTipCoverageV1',
  'procedural tip raster coverage missing',
);
requireText(
  read('src/index.html'),
  'id="brush-tip-shape"',
  'reachable procedural tip control missing',
);
requireText(
  read('tests/unit/procedural-brush-tip.test.ts'),
  'square corners',
  'procedural tip raster regression coverage missing',
);
requireText(progress, 'M6A-019 custom tip creation:完了', 'M6A-019 progress is not complete');
requireText(
  read('src/domain/brush-schema.ts'),
  'withBrushCustomSampledTipV1',
  'custom sampled tip preset mutation missing',
);
requireText(
  read('src/app/brush-preset-controller.ts'),
  'customBrushTipAlphaFromFileV1',
  'custom sampled tip image creation is not production-connected',
);
requireText(
  read('src/index.html'),
  'id="brush-tip-custom-create"',
  'reachable custom sampled tip creation control missing',
);
requireText(
  read('tests/unit/custom-brush-tip.test.ts'),
  'custom alpha mask',
  'custom sampled tip regression coverage missing',
);
requireText(
  progress,
  'M6A-020 multiple tip assets without Dual Brush semantics:完了',
  'M6A-020 progress is not complete',
);
requireText(
  read('src/domain/brush-schema.ts'),
  'withBrushTipAssetSelectionV1',
  'multiple brush tip asset selection missing',
);
requireText(
  read('src/app/brush-preset-controller.ts'),
  'brush-tip-asset-select',
  'multiple brush tip asset UI is not production-connected',
);
requireText(
  read('src/index.html'),
  'id="brush-tip-asset-add"',
  'reachable multiple tip asset add control missing',
);
requireText(
  read('tests/unit/multiple-brush-tip-assets.test.ts'),
  'never merges two masks as Dual Brush',
  'multiple tip asset regression coverage missing',
);
requireText(progress, 'M6A-021 hardness:完了', 'M6A-021 progress is not complete');
requireText(
  read('src/domain/brush-schema.ts'),
  'brushTipHardnessV1',
  'brush hardness preset helper missing',
);
requireText(
  read('src/gpu/baseline-raster-tile-store.ts'),
  'baselineDabHardnessV1',
  'canonical raster hardness coverage missing',
);
requireText(
  read('src/gpu/baseline-paint-renderer.ts'),
  'baselineDabHardnessV1(dab) !== BASELINE_BRUSH_HARDNESS',
  'non-default hardness canonical preview fallback missing',
);
requireText(
  read('src/index.html'),
  'id="brush-hardness-range"',
  'reachable brush hardness control missing',
);
requireText(
  read('tests/unit/brush-hardness.test.ts'),
  'softens the canonical tip edge',
  'brush hardness regression coverage missing',
);
requireText(
  progress,
  'M6A-PERF-001 incremental active-stroke rendering（stable prefix + bounded mutable tail）:未完了',
  'performance gate must remain separately incomplete',
);

console.log('M6A Raster Brush contract verification: PASS');
