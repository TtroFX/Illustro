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
  'builder.appendConfirmed(stabilizedAdditions)',
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
requireText(progress, 'M6A-022 tip density:完了', 'M6A-022 progress is not complete');
requireText(
  read('src/domain/brush-schema.ts'),
  'brushTipDensityV1',
  'brush tip density preset helper missing',
);
requireText(
  read('src/gpu/baseline-raster-tile-store.ts'),
  'baselineDabTipDensityV1',
  'canonical raster tip-density coverage missing',
);
requireText(
  read('src/gpu/baseline-paint-renderer.ts'),
  'baselineDabTipDensityV1(dab) !== BASELINE_BRUSH_TIP_DENSITY',
  'non-default tip-density canonical preview fallback missing',
);
requireText(
  read('src/workers/render.worker.ts'),
  '...(hardness === undefined ? {} : { hardness })',
  'worker parser does not preserve brush hardness',
);
requireText(
  read('src/workers/render.worker.ts'),
  '...(tipDensity === undefined ? {} : { tipDensity })',
  'worker parser does not preserve brush tip density',
);
requireText(
  read('src/index.html'),
  'id="brush-tip-density-range"',
  'reachable brush tip-density control missing',
);
requireText(
  read('tests/unit/brush-tip-density.test.ts'),
  'reduces canonical tip mask coverage independently from flow',
  'brush tip-density regression coverage missing',
);

requireText(progress, 'M6A-023 spacing/gap:完了', 'M6A-023 progress is not complete');
requireText(
  read('src/domain/brush-schema.ts'),
  'brushStrokeSpacingV1',
  'brush spacing preset helper missing',
);
requireText(
  read('src/gpu/baseline-brush.ts'),
  'Math.max(minimumStampDistancePx, sizePx * spacingRatio)',
  'brush spacing is not connected to deterministic dab placement',
);
requireText(
  read('src/app/paint-session-controller.ts'),
  'setBrushSpacing',
  'brush spacing is not captured by the paint session',
);
requireText(
  read('src/index.html'),
  'id="brush-spacing-range"',
  'reachable brush spacing control missing',
);
requireText(
  read('tests/unit/brush-spacing.test.ts'),
  'changes deterministic logical stamp gap while retaining the stroke endpoint',
  'brush spacing regression coverage missing',
);

requireText(progress, 'M6A-024 tip angle:完了', 'M6A-024 progress is not complete');
requireText(
  read('src/domain/brush-schema.ts'),
  'brushTipAngleDegreesV1',
  'brush tip angle preset helper missing',
);
requireText(
  read('src/gpu/baseline-brush.ts'),
  'rotatedOffsetX',
  'sampled brush tip angle rotation missing',
);
requireText(
  read('src/gpu/baseline-raster-tile-store.ts'),
  'baselineDabTipAngleDegreesV1',
  'canonical procedural tip angle coverage missing',
);
requireText(
  read('src/workers/render.worker.ts'),
  '...(tipAngleDegrees === undefined ? {} : { tipAngleDegrees })',
  'worker parser does not preserve brush tip angle',
);
requireText(
  read('src/index.html'),
  'id="brush-tip-angle-range"',
  'reachable brush tip angle control missing',
);
requireText(
  read('tests/unit/brush-tip-angle.test.ts'),
  'rotates square canonical coverage and expands dirty bounds for its corners',
  'brush tip angle regression coverage missing',
);

requireText(progress, 'M6A-025 tip direction:完了', 'M6A-025 progress is not complete');
requireText(
  read('src/domain/brush-schema.ts'),
  'brushTipDirectionDegreesV1',
  'brush tip direction preset helper missing',
);
requireText(
  read('src/gpu/baseline-brush.ts'),
  'this.#tipAngleDegrees - this.#tipDirectionDegrees',
  'brush tip direction is not composed into resolved stamp orientation',
);
requireText(
  read('src/app/paint-session-controller.ts'),
  'setBrushTipDirectionDegrees',
  'brush tip direction is not captured by the paint session',
);
requireText(
  read('src/index.html'),
  'id="brush-tip-direction-range"',
  'reachable brush tip direction control missing',
);
requireText(
  read('tests/unit/brush-tip-direction.test.ts'),
  'calibrates an asset-local forward direction before sampled-tip expansion',
  'brush tip direction regression coverage missing',
);

requireText(progress, 'M6A-026 follow stroke rotation:完了', 'M6A-026 progress is not complete');
requireText(
  read('src/domain/brush-schema.ts'),
  'brushFollowStrokeRotationV1',
  'follow-stroke rotation preset helper missing',
);
requireText(
  read('src/gpu/baseline-brush.ts'),
  'this.#followStrokeRotation && strokeDirectionDegrees !== undefined',
  'local stroke tangent is not composed into resolved tip orientation',
);
requireText(
  read('src/app/paint-session-controller.ts'),
  'setBrushFollowStrokeRotation',
  'follow-stroke rotation is not captured by the paint session',
);
requireText(
  read('src/index.html'),
  'id="brush-follow-rotation"',
  'reachable follow-stroke rotation control missing',
);
requireText(
  read('tests/unit/brush-follow-rotation.test.ts'),
  'without rewriting the stable prefix',
  'follow-stroke rotation regression coverage missing',
);

requireText(progress, 'M6A-027 stroke repetition:完了', 'M6A-027 progress is not complete');
requireText(
  read('src/domain/brush-schema.ts'),
  'BrushTipSelectionModeV1',
  'multi-tip selection mode schema missing',
);
requireText(
  read('src/gpu/baseline-brush.ts'),
  'deterministicBrushTipIndexV1',
  'deterministic per-stamp tip selector missing',
);
requireText(
  read('src/app/paint-session-controller.ts'),
  'randomSeed',
  'randomized stroke seed is not persisted',
);
requireText(
  read('src/index.html'),
  'id="brush-tip-repeat-mode"',
  'reachable stroke repetition control missing',
);
requireText(
  read('tests/unit/brush-stroke-repetition.test.ts'),
  'without Dual Brush compositing',
  'stroke repetition regression coverage missing',
);

requireText(progress, 'M6A-028 stroke-start behavior:完了', 'M6A-028 progress is not complete');
requireText(
  read('src/domain/brush-schema.ts'),
  'brushStrokeStartLengthPxV1',
  'stroke-start preset helper missing',
);
requireText(
  read('src/gpu/baseline-brush.ts'),
  '#startEnvelopeAtDistance',
  'incremental stroke-start envelope missing',
);
requireText(
  read('src/app/paint-session-controller.ts'),
  'startTaperLengthPx: this.#brushStartTaperLengthPx',
  'stroke-start behavior is not captured by the paint session',
);
requireText(
  read('src/index.html'),
  'id="brush-start-length-range"',
  'reachable stroke-start control missing',
);
requireText(
  read('tests/unit/brush-stroke-start.test.ts'),
  'without rewriting prior dabs',
  'stroke-start regression coverage missing',
);

requireText(progress, 'M6A-029 stroke-end behavior:完了', 'M6A-029 progress is not complete');
requireText(
  read('src/domain/brush-schema.ts'),
  'brushStrokeEndLengthPxV1',
  'stroke-end preset helper missing',
);
requireText(
  read('src/gpu/baseline-brush.ts'),
  '#reconcileEndTaper',
  'bounded logical end-tail reconciliation missing',
);
requireText(
  read('src/gpu/baseline-paint-renderer.ts'),
  'const rollback = canonicalTiles.cancel(strokeId)',
  'release-time provisional raster reconciliation missing',
);
requireText(
  read('src/app/paint-session-controller.ts'),
  'endTaperLengthPx: this.#brushEndTaperLengthPx',
  'stroke-end behavior is not captured by the paint session',
);
requireText(
  read('src/index.html'),
  'id="brush-end-length-range"',
  'reachable stroke-end control missing',
);
requireText(
  read('tests/unit/brush-stroke-end.test.ts'),
  'regenerates only the bounded release tail',
  'stroke-end regression coverage missing',
);

requireText(progress, 'M6A-030 size taper:完了', 'M6A-030 progress is not complete');
requireText(
  read('src/domain/brush-schema.ts'),
  'brushSizeTaperMinimumRatioV1',
  'size-taper preset helper missing',
);
requireText(
  read('src/gpu/baseline-brush.ts'),
  '#sizeTaperScale',
  'size-taper minimum is not composed with the common stroke envelope',
);
requireText(
  read('src/app/paint-session-controller.ts'),
  'setBrushSizeTaperMinimumRatio',
  'size taper is not captured by the paint session',
);
requireText(
  read('src/index.html'),
  'id="brush-size-taper-range"',
  'reachable size-taper control missing',
);
requireText(
  read('tests/unit/brush-size-taper.test.ts'),
  'keeps opacity taper independent from the size minimum',
  'size-taper regression coverage missing',
);

requireText(progress, 'M6A-031 opacity taper:完了', 'M6A-031 progress is not complete');
requireText(
  read('src/domain/brush-schema.ts'),
  'brushOpacityTaperMinimumRatioV1',
  'opacity-taper preset helper missing',
);
requireText(
  read('src/gpu/baseline-brush.ts'),
  '#opacityTaperScale',
  'opacity/deposit taper minimum is not composed with the common stroke envelope',
);
requireText(
  read('src/app/paint-session-controller.ts'),
  'setBrushOpacityTaperMinimumRatio',
  'opacity taper is not captured by the paint session',
);
requireText(
  read('src/index.html'),
  'id="brush-opacity-taper-range"',
  'reachable opacity-taper control missing',
);
requireText(
  read('tests/unit/brush-opacity-taper.test.ts'),
  'keeps size taper independent from the opacity/deposit minimum',
  'opacity-taper regression coverage missing',
);

requireText(progress, 'M6A-032 forced taper:完了', 'M6A-032 progress is not complete');
requireText(
  read('src/domain/brush-schema.ts'),
  'brushForcedTaperV1',
  'forced-taper preset helper missing',
);
requireText(
  read('src/gpu/baseline-brush.ts'),
  'this.#sizeTaperScale(startEnvelope, this.#forceStartTaper)',
  'forced start taper is not composed into size scaling',
);
requireText(
  read('src/gpu/baseline-brush.ts'),
  'this.#opacityTaperScale(endEnvelope, this.#forceEndTaper)',
  'forced end taper is not composed into deposit scaling',
);
requireText(
  read('src/app/paint-session-controller.ts'),
  'setBrushForcedTaper',
  'forced taper is not captured by the paint session',
);
requireText(
  read('src/index.html'),
  'id="brush-force-start-taper"',
  'reachable Force In control missing',
);
requireText(
  read('src/index.html'),
  'id="brush-force-end-taper"',
  'reachable Force Out control missing',
);
requireText(
  read('tests/unit/brush-forced-taper.test.ts'),
  'forces the stroke start from zero size and deposit',
  'forced-taper regression coverage missing',
);

requireText(progress, 'M6A-033 real-time stabilization:完了', 'M6A-033 progress is not complete');
requireText(
  read('src/domain/brush-schema.ts'),
  'brushRealtimeStabilizationAmountV1',
  'real-time stabilization preset helper missing',
);
requireText(
  read('src/app/realtime-brush-stabilizer.ts'),
  'class RealtimeBrushStabilizerV1',
  'causal real-time stabilizer missing',
);
requireText(
  read('src/app/realtime-brush-stabilizer.ts'),
  'speedPxPerSecond',
  'velocity-adaptive cutoff missing from real-time stabilizer',
);
requireText(
  read('src/app/paint-session-controller.ts'),
  'const stabilizedAdditions = additions.map((sample, index) => {',
  'paint session does not stabilize render geometry incrementally',
);
requireText(
  read('src/app/paint-session-controller.ts'),
  'const releasePoint = stabilizer.release(rawEndpoint);',
  'paint session does not converge release to confirmed raw endpoint',
);
requireText(
  read('src/index.html'),
  'id="brush-stabilization-range"',
  'reachable real-time stabilization control missing',
);
requireText(
  read('tests/unit/brush-realtime-stabilizer.test.ts'),
  'keeps raw stroke samples canonical',
  'real-time stabilization raw/canonical regression coverage missing',
);

requireText(progress, 'M6A-034 post-stroke correction:完了', 'M6A-034 progress is not complete');
requireText(
  read('src/domain/brush-schema.ts'),
  'brushPostStrokeCorrectionAmountV1',
  'post-stroke correction preset helper missing',
);
requireText(
  read('src/app/post-stroke-correction.ts'),
  'correctPostStrokeGeometryV1',
  'release-only post-stroke correction algorithm missing',
);
requireText(
  read('src/app/post-stroke-correction.ts'),
  'const passCount = Math.max',
  'post-stroke correction does not bound smoothing passes',
);
requireText(
  read('src/app/paint-session-controller.ts'),
  'const correctedBuilder = createBrush();',
  'paint session does not rebuild corrected final geometry',
);
requireText(
  read('src/index.html'),
  'id="brush-post-correction-range"',
  'reachable post-stroke correction control missing',
);
requireText(
  read('tests/unit/brush-post-stroke-correction.test.ts'),
  'preserving canonical raw samples',
  'post-stroke raw-sample regression coverage missing',
);

requireText(progress, 'M6A-035 grain selection:完了', 'M6A-035 progress is not complete');
requireText(
  read('src/domain/brush-schema.ts'),
  'BUILTIN_BRUSH_GRAIN_RESOURCES_V1',
  'built-in grain selection catalog missing',
);
requireText(
  read('src/domain/brush-schema.ts'),
  'brushGrainResourceIdV1',
  'grain selection preset helper missing',
);
requireText(
  read('src/app/paint-session-controller.ts'),
  'setBrushGrainResourceId',
  'grain selection is not connected to runtime brush state',
);
requireText(
  read('src/index.html'),
  'id="brush-grain-resource"',
  'reachable grain resource chooser missing',
);
requireText(
  read('tests/unit/brush-grain-selection.test.ts'),
  'final non-paper grain inventory shape',
  'grain inventory regression coverage missing',
);

requireText(progress, 'M6A-036 paper texture selection:完了', 'M6A-036 progress is not complete');
requireText(
  read('src/domain/brush-schema.ts'),
  'BUILTIN_BRUSH_PAPER_RESOURCES_V1',
  'paper catalog missing',
);
requireText(
  read('src/domain/brush-schema.ts'),
  'brushPaperTextureResourceIdV1',
  'paper selection helper missing',
);
requireText(
  read('src/app/paint-session-controller.ts'),
  'setBrushPaperTextureResourceId',
  'paper runtime state missing',
);
requireText(read('src/index.html'), 'id="brush-paper-resource"', 'reachable paper chooser missing');
requireText(
  read('tests/unit/brush-paper-texture-selection.test.ts'),
  'same single texture slot',
  'paper/grain exclusivity regression missing',
);

requireText(progress, 'M6A-037 texture strength:完了', 'M6A-037 progress is not complete');
requireText(
  read('src/domain/brush-schema.ts'),
  'brushTextureStrengthV1',
  'texture-strength preset helper missing',
);
requireText(
  read('src/app/paint-session-controller.ts'),
  'setBrushTextureStrength',
  'texture strength is not connected to runtime state',
);
requireText(
  read('src/index.html'),
  'id="brush-texture-strength-range"',
  'reachable texture-strength control missing',
);
requireText(
  read('tests/unit/brush-texture-strength.test.ts'),
  'preserves strength while the single texture slot switches between grain and paper',
  'texture strength/resource-identity regression missing',
);

requireText(progress, 'M6A-038 texture scale:完了', 'M6A-038 progress is not complete');
requireText(
  read('src/domain/brush-schema.ts'),
  'brushTextureScaleV1',
  'texture-scale preset helper missing',
);
requireText(
  read('src/app/paint-session-controller.ts'),
  'setBrushTextureScale',
  'texture scale is not connected to runtime state',
);
requireText(
  read('src/index.html'),
  'id="brush-texture-scale-range"',
  'reachable texture-scale control missing',
);
requireText(
  read('tests/unit/brush-texture-scale.test.ts'),
  'keeps scale orthogonal to resource subtype and strength',
  'texture scale orthogonality regression missing',
);

requireText(progress, 'M6A-039 texture rotation:完了', 'M6A-039 progress is not complete');
requireText(
  read('src/domain/brush-schema.ts'),
  'brushTextureRotationDegreesV1',
  'texture-rotation preset helper missing',
);
requireText(
  read('src/app/paint-session-controller.ts'),
  'setBrushTextureRotationDegrees',
  'texture rotation is not connected to runtime state',
);
requireText(
  read('src/index.html'),
  'id="brush-texture-rotation-range"',
  'reachable texture-rotation control missing',
);
requireText(
  read('tests/unit/brush-texture-rotation.test.ts'),
  'keeps rotation orthogonal to paper identity, strength, and scale',
  'texture rotation orthogonality regression missing',
);

requireText(progress, 'M6A-040 texture blend behavior:完了', 'M6A-040 progress is not complete');
requireText(
  read('src/domain/brush-schema.ts'),
  'BrushTextureBlendModeV1',
  'texture blend-mode schema missing',
);
requireText(
  read('src/gpu/brush-texture-composite.ts'),
  'combineBrushTextureCoverageV1',
  'coverage-domain texture combination missing',
);
requireText(
  read('src/app/paint-session-controller.ts'),
  'setBrushTextureBlendMode',
  'texture blend mode is not connected to runtime state',
);
requireText(
  read('src/index.html'),
  'id="brush-texture-blend-mode"',
  'reachable texture blend-mode control missing',
);
requireText(
  read('tests/unit/brush-texture-blend.test.ts'),
  'deterministic scalar coverage combination without touching color',
  'texture blend coverage regression missing',
);

requireText(progress, 'M6A-041 pressure→size:完了', 'M6A-041 progress is not complete');
requireText(
  read('src/domain/brush-schema.ts'),
  'brushPressureSizeEnabledV1',
  'pressure-size preset helper missing',
);
requireText(
  read('src/gpu/baseline-brush.ts'),
  'cursorPressure += (pressure - cursorPressure) * ratio',
  'pressure is not interpolated at logical stamp positions',
);
requireText(
  read('src/gpu/baseline-brush.ts'),
  'const pressureSizeScale = this.#pressureSizeEnabled ? pressureResponse : 1;',
  'pressure-size response is not resolved for logical stamps',
);
requireText(
  read('src/app/paint-session-controller.ts'),
  "pressure: source === 'pen' ? sample.pressure : 1",
  'paint session does not preserve pen pressure into stabilized geometry',
);
requireText(
  read('src/index.html'),
  'id="brush-pressure-size"',
  'reachable pressure-size control missing',
);
requireText(
  read('tests/unit/brush-pressure-size.test.ts'),
  'linearly interpolates pressure at logical stamp positions',
  'pressure-size interpolation regression missing',
);

requireText(progress, 'M6A-042 pressure→opacity:完了', 'M6A-042 progress is not complete');
requireText(
  read('src/domain/brush-schema.ts'),
  'brushPressureOpacityEnabledV1',
  'pressure-opacity preset helper missing',
);
requireText(
  read('src/gpu/baseline-brush.ts'),
  'const pressureOpacityScale = this.#pressureOpacityEnabled ? pressureResponse : 1;',
  'pressure-opacity response is not resolved for logical stamps',
);
requireText(
  read('src/gpu/baseline-raster-tile-store.ts'),
  'const availableOpacity = Math.max(0, strokeOpacity - previousEffective);',
  'variable opacity cap is not monotonic in canonical raster coverage',
);
requireText(
  read('src/app/paint-session-controller.ts'),
  'setBrushPressureOpacityEnabled',
  'pressure-opacity mapping is not connected to runtime state',
);
requireText(
  read('src/index.html'),
  'id="brush-pressure-opacity"',
  'reachable pressure-opacity control missing',
);
requireText(
  read('tests/unit/brush-pressure-opacity.test.ts'),
  'keeps opacity as a monotonic cap while flow controls convergence rate',
  'pressure-opacity raster regression missing',
);

requireText(progress, 'M6A-043 pressure→flow:完了', 'M6A-043 progress is not complete');
requireText(
  read('src/domain/brush-schema.ts'),
  'brushPressureFlowEnabledV1',
  'pressure-flow preset helper missing',
);
requireText(
  read('src/gpu/baseline-brush.ts'),
  'const pressureFlowScale = this.#pressureFlowEnabled ? pressureResponse : 1;',
  'pressure-flow response is not resolved for logical stamps',
);
requireText(
  read('src/app/paint-session-controller.ts'),
  'setBrushPressureFlowEnabled',
  'pressure-flow mapping is not connected to runtime state',
);
requireText(
  read('src/index.html'),
  'id="brush-pressure-flow"',
  'reachable pressure-flow control missing',
);
requireText(
  read('tests/unit/brush-pressure-flow.test.ts'),
  'keeps pressure flow and pressure opacity independent when both are enabled',
  'pressure-flow independence regression missing',
);

requireText(progress, 'M6A-044 pressure response curve:完了', 'M6A-044 progress is not complete');
requireText(
  read('src/domain/response-curve.ts'),
  'compileResponseCurveV1',
  'shared response-curve evaluator missing',
);
requireText(
  read('src/domain/response-curve.ts'),
  'response curve endpoints must be exactly 0→0 and 1→1',
  'pressure curve endpoint contract missing',
);
requireText(
  read('src/domain/brush-schema.ts'),
  'brushPressureResponseCurveV1',
  'pressure response curve is not persisted in brush presets',
);
requireText(
  read('src/gpu/baseline-brush.ts'),
  'const pressureResponse = usesPressure ? this.#pressureResponseCurve.sample(stamp.pressure) : 1;',
  'shared pressure response is not resolved once before mappings',
);
requireText(
  read('src/app/shared-curve-editor.ts'),
  'installSharedCurveEditorV1',
  'shared Curve Editor implementation missing',
);
requireText(
  read('src/index.html'),
  'id="brush-pressure-curve"',
  'reachable pressure Curve Editor canvas missing',
);
requireText(
  read('src/index.html'),
  'id="brush-pressure-curve-input"',
  'exact selected pressure-curve input control missing',
);
requireText(
  read('tests/unit/brush-pressure-response-curve.test.ts'),
  'resolves one shared curve output before independent size, opacity and flow mappings',
  'pressure response mapping regression missing',
);

requireText(progress, 'M6A-045 tilt mapping:完了', 'M6A-045 progress is not complete');
requireText(
  read('src/domain/brush-schema.ts'),
  'brushTiltSizeEnabledV1',
  'tilt mapping preset helpers missing',
);
requireText(
  read('src/gpu/baseline-brush.ts'),
  'baselineBrushSampleTiltUprightnessV1',
  'tilt source normalization missing',
);
requireText(
  read('src/gpu/baseline-brush.ts'),
  'cursorTiltUprightness += (tiltUprightness - cursorTiltUprightness) * ratio',
  'tilt source is not interpolated at logical stamp positions',
);
requireText(
  read('src/app/paint-session-controller.ts'),
  'setBrushTiltResponseCurve',
  'tilt mapping is not connected to runtime state',
);
requireText(read('src/index.html'), 'id="brush-tilt-size"', 'reachable tilt-size control missing');
requireText(read('src/index.html'), 'id="brush-tilt-curve"', 'reachable tilt Curve Editor missing');
requireText(
  read('tests/unit/brush-tilt-mapping.test.ts'),
  'keeps pressure and tilt independent while sharing resolved primitive fields',
  'tilt/pressure composition regression missing',
);

requireText(progress, 'M6A-046 orientation mapping:完了', 'M6A-046 progress is not complete');
requireText(
  read('src/gpu/baseline-brush.ts'),
  'baselineBrushSampleOrientationDegreesV1',
  'pen orientation source resolver missing',
);
requireText(
  read('src/gpu/baseline-brush.ts'),
  'shortestAngularDeltaDegreesV1',
  'circular orientation interpolation missing',
);
requireText(
  read('src/gpu/baseline-brush.ts'),
  'this.#penOrientationEnabled && penOrientationDegrees !== undefined',
  'pen orientation does not take explicit precedence over stroke-follow rotation',
);
requireText(
  read('src/app/paint-session-controller.ts'),
  'setBrushPenOrientationEnabled',
  'pen orientation mapping is not connected to runtime state',
);
requireText(
  read('src/index.html'),
  'id="brush-pen-orientation"',
  'reachable pen-orientation control missing',
);
requireText(
  read('tests/unit/brush-orientation-mapping.test.ts'),
  'interpolates orientation on the shortest circular arc at logical stamp positions',
  'orientation wraparound regression missing',
);

requireText(progress, 'M6A-047 velocity mapping:完了', 'M6A-047 progress is not complete');
requireText(
  read('src/domain/brush-schema.ts'),
  'brushVelocityMaximumPxPerSecondV1',
  'velocity normalization maximum preset helper missing',
);
requireText(
  read('src/app/paint-session-controller.ts'),
  'normalizedPaintVelocityV1',
  'confirmed timestamp velocity resolver missing',
);
requireText(
  read('src/gpu/baseline-brush.ts'),
  'cursorVelocity += (velocity - cursorVelocity) * ratio',
  'velocity is not interpolated at logical stamp positions',
);
requireText(
  read('src/gpu/baseline-brush.ts'),
  'this.#velocityResponseCurve.sample(stamp.velocity)',
  'shared velocity response is not resolved before independent mappings',
);
requireText(
  read('src/app/paint-session-controller.ts'),
  'setBrushVelocityResponseCurve',
  'velocity mapping is not connected to runtime state',
);
requireText(
  read('src/index.html'),
  'id="brush-velocity-size"',
  'reachable velocity-size control missing',
);
requireText(
  read('src/index.html'),
  'id="brush-velocity-maximum-range"',
  'reachable velocity normalization control missing',
);
requireText(
  read('src/index.html'),
  'id="brush-velocity-curve"',
  'reachable velocity Curve Editor missing',
);
requireText(
  read('tests/unit/brush-velocity-mapping.test.ts'),
  'derives document-space velocity only from confirmed sample distance and timestamps',
  'velocity source regression coverage missing',
);
requireText(
  read('tests/unit/brush-velocity-mapping.test.ts'),
  'keeps velocity independent from pressure and tilt while resolving the same primitive fields',
  'velocity composition regression coverage missing',
);

requireText(progress, 'M6A-048 random dynamics:完了', 'M6A-048 progress is not complete');
requireText(
  read('src/domain/brush-schema.ts'),
  'brushRandomResponseCurveV1',
  'random dynamics preset response helper missing',
);
requireText(
  read('src/gpu/baseline-brush.ts'),
  'deterministicBaselineBrushRandomV1',
  'deterministic random dynamics source missing',
);
requireText(
  read('src/gpu/baseline-brush.ts'),
  '#randomStampIndex',
  'random dynamics does not own an attempt index independent from visible tip repetition',
);
requireText(
  read('src/gpu/baseline-brush.ts'),
  'this.#randomResponseCurve.sample(stamp.randomInput)',
  'shared random response is not sampled from the stored logical-stamp random input',
);
requireText(
  read('src/app/paint-session-controller.ts'),
  'randomDynamicsEnabled ||',
  'random dynamics does not capture a persistent deterministic stroke seed',
);
requireText(
  read('src/app/paint-session-controller.ts'),
  'setBrushRandomResponseCurve',
  'random dynamics is not connected to runtime brush state',
);
requireText(
  read('src/index.html'),
  'id="brush-random-size"',
  'reachable random-size control missing',
);
requireText(
  read('src/index.html'),
  'id="brush-random-curve"',
  'reachable random Curve Editor missing',
);
requireText(
  read('tests/unit/brush-random-dynamics.test.ts'),
  'advances the random attempt index even when a taper suppresses the first logical stamp',
  'random attempt-index regression coverage missing',
);
requireText(
  read('tests/unit/brush-random-dynamics.test.ts'),
  'uses an independent random channel without changing random tip-selection order',
  'random/tip-selection channel independence coverage missing',
);

requireText(progress, 'M6A-049 minimum response:完了', 'M6A-049 progress is not complete');
requireText(
  read('src/domain/brush-schema.ts'),
  'brushSizeMinimumResponseV1',
  'minimum-response preset helpers missing',
);
requireText(
  read('src/gpu/baseline-brush.ts'),
  'this.#sizeMinimumResponse,',
  'size minimum response is not applied after source composition',
);
requireText(
  read('src/gpu/baseline-brush.ts'),
  'this.#opacityMinimumResponse,',
  'opacity minimum response is not applied after source composition',
);
requireText(
  read('src/gpu/baseline-brush.ts'),
  'this.#flowMinimumResponse,',
  'flow minimum response is not applied after source composition',
);
requireText(
  read('src/app/paint-session-controller.ts'),
  'setBrushSizeMinimumResponse',
  'minimum response is not connected to runtime brush state',
);
requireText(
  read('src/index.html'),
  'id="brush-size-minimum-response-range"',
  'reachable minimum-response control missing',
);
requireText(
  read('tests/unit/brush-minimum-response.test.ts'),
  'keeps forced taper zero authoritative outside the dynamic minimum clamp',
  'minimum-response taper-priority regression missing',
);
requireText(
  read('tests/unit/brush-minimum-response.test.ts'),
  'applies the minimum after multiplying independent enabled sources',
  'minimum-response source-composition regression missing',
);

requireText(progress, 'M6A-050 maximum response:完了', 'M6A-050 progress is not complete');
requireText(
  read('src/domain/brush-schema.ts'),
  'brushSizeMaximumResponseV1',
  'maximum-response preset helpers missing',
);
requireText(
  read('src/gpu/baseline-brush.ts'),
  'this.#sizeMaximumResponse',
  'size maximum response is not connected to the brush kernel',
);
requireText(
  read('src/gpu/baseline-brush.ts'),
  'const usesSizeDynamics =',
  'maximum response does not preserve neutral static targets',
);
requireText(
  read('src/app/paint-session-controller.ts'),
  'setBrushDynamicResponseBounds',
  'response bounds are not atomically connected to runtime state',
);
requireText(
  read('src/index.html'),
  'id="brush-size-maximum-response-range"',
  'reachable maximum-response control missing',
);
requireText(
  read('tests/unit/brush-maximum-response.test.ts'),
  'keeps static targets neutral when no dynamic source is enabled',
  'maximum-response neutral-target regression missing',
);
requireText(
  read('tests/unit/brush-maximum-response.test.ts'),
  'enforces minimum less than or equal to maximum in preset helpers',
  'minimum/maximum bound-order regression missing',
);

requireText(progress, 'M6A-051 size jitter:完了', 'M6A-051 progress is not complete');
requireText(
  read('src/domain/brush-schema.ts'),
  'brushSizeJitterV1',
  'size-jitter preset helpers missing',
);
requireText(
  read('src/gpu/baseline-brush.ts'),
  'deterministicBaselineBrushSizeJitterV1',
  'deterministic size-jitter channel missing',
);
requireText(
  read('src/gpu/baseline-brush.ts'),
  'stamp.sizeJitterScale',
  'resolved size jitter is not applied to logical-stamp radius',
);
requireText(
  read('src/app/paint-session-controller.ts'),
  'setBrushSizeJitter',
  'size jitter is not connected to runtime brush state',
);
requireText(
  read('src/app/paint-session-controller.ts'),
  'const sizeJitterEnabled = this.#brushSizeJitter > 0;',
  'size jitter does not capture a deterministic persistent stroke seed',
);
requireText(
  read('src/index.html'),
  'id="brush-size-jitter-range"',
  'reachable size-jitter control missing',
);
requireText(
  read('tests/unit/brush-size-jitter.test.ts'),
  'advances the size-jitter attempt index even when taper suppresses a logical stamp',
  'size-jitter attempt-index regression missing',
);
requireText(
  read('tests/unit/brush-size-jitter.test.ts'),
  'uses a random channel independent from generalized random dynamics',
  'size-jitter channel-independence regression missing',
);
requireText(
  read('tests/unit/brush-size-jitter.test.ts'),
  'reuses the stored jitter scale when reconciling the mutable end tail',
  'size-jitter tail reconciliation regression missing',
);

requireText(progress, 'M6A-052 opacity jitter:完了', 'M6A-052 progress is not complete');
requireText(
  read('src/domain/brush-schema.ts'),
  'brushOpacityJitterV1',
  'opacity-jitter preset helpers missing',
);
requireText(
  read('src/gpu/baseline-brush.ts'),
  'deterministicBaselineBrushOpacityJitterV1',
  'deterministic opacity-jitter channel missing',
);
requireText(
  read('src/gpu/baseline-brush.ts'),
  'stamp.opacityJitterScale',
  'resolved opacity jitter is not applied to logical-stamp opacity cap',
);
requireText(
  read('src/app/paint-session-controller.ts'),
  'setBrushOpacityJitter',
  'opacity jitter is not connected to runtime brush state',
);
requireText(
  read('src/app/paint-session-controller.ts'),
  'opacityJitterEnabled',
  'opacity jitter does not capture a deterministic persistent stroke seed',
);
requireText(
  read('src/index.html'),
  'id="brush-opacity-jitter-range"',
  'reachable opacity-jitter control missing',
);
requireText(
  read('tests/unit/brush-opacity-jitter.test.ts'),
  'advances the opacity-jitter attempt index even when taper suppresses a logical stamp',
  'opacity-jitter attempt-index regression missing',
);
requireText(
  read('tests/unit/brush-opacity-jitter.test.ts'),
  'uses a random channel independent from generalized random dynamics and size jitter',
  'opacity-jitter channel-independence regression missing',
);
requireText(
  read('tests/unit/brush-opacity-jitter.test.ts'),
  'reuses the stored opacity-jitter scale when reconciling the mutable end tail',
  'opacity-jitter tail reconciliation regression missing',
);

requireText(progress, 'M6A-053 rotation jitter:完了', 'M6A-053 progress is not complete');
requireText(
  read('src/domain/brush-schema.ts'),
  'brushRotationJitterV1',
  'rotation-jitter preset helpers missing',
);
requireText(
  read('src/gpu/baseline-brush.ts'),
  'deterministicBaselineBrushRotationJitterV1',
  'deterministic rotation-jitter channel missing',
);
requireText(
  read('src/gpu/baseline-brush.ts'),
  'tipAngleDegrees: jitteredTipAngleDegrees',
  'rotation jitter is not composed into the resolved logical-stamp angle',
);
requireText(
  read('src/app/paint-session-controller.ts'),
  'setBrushRotationJitter',
  'rotation jitter is not connected to runtime brush state',
);
requireText(
  read('src/app/paint-session-controller.ts'),
  'rotationJitterEnabled',
  'rotation jitter does not capture a deterministic persistent stroke seed',
);
requireText(
  read('src/index.html'),
  'id="brush-rotation-jitter-range"',
  'reachable rotation-jitter control missing',
);
requireText(
  read('tests/unit/brush-rotation-jitter.test.ts'),
  'advances the rotation-jitter attempt index even when taper suppresses a logical stamp',
  'rotation-jitter attempt-index regression missing',
);
requireText(
  read('tests/unit/brush-rotation-jitter.test.ts'),
  'uses a random channel independent from generalized, size and opacity random channels',
  'rotation-jitter channel-independence regression missing',
);
requireText(
  read('tests/unit/brush-rotation-jitter.test.ts'),
  'reuses the resolved jittered angle when reconciling the mutable end tail',
  'rotation-jitter tail reconciliation regression missing',
);

requireText(progress, 'M6A-054 position/scatter jitter:完了', 'M6A-054 progress is not complete');
requireText(
  read('src/domain/brush-schema.ts'),
  'brushPositionJitterV1',
  'position-jitter preset helpers missing',
);
requireText(
  read('src/gpu/baseline-brush.ts'),
  'deterministicBaselineBrushPositionJitterV1',
  'deterministic 2D position-jitter channel missing',
);
requireText(
  read('src/gpu/baseline-brush.ts'),
  'maximumPositionOffsetPx = this.#radius * 2 * this.#positionJitter',
  'position jitter is not scaled from the base brush diameter',
);
requireText(
  read('src/app/paint-session-controller.ts'),
  'setBrushPositionJitter',
  'position jitter is not connected to runtime brush state',
);
requireText(
  read('src/app/paint-session-controller.ts'),
  'positionJitterEnabled',
  'position jitter does not capture a deterministic persistent stroke seed',
);
requireText(
  read('src/index.html'),
  'id="brush-position-jitter-range"',
  'reachable position-jitter control missing',
);
requireText(
  read('tests/unit/brush-position-jitter.test.ts'),
  'does not feed jittered centers back into spacing or stroke geometry',
  'position-jitter path-invariance regression missing',
);
requireText(
  read('tests/unit/brush-position-jitter.test.ts'),
  'advances the position-jitter attempt index even when taper suppresses a logical stamp',
  'position-jitter attempt-index regression missing',
);
requireText(
  read('tests/unit/brush-position-jitter.test.ts'),
  'reuses the resolved jittered center when reconciling the mutable end tail',
  'position-jitter tail reconciliation regression missing',
);

requireText(progress, 'M6A-055 density jitter:完了', 'M6A-055 progress is not complete');
requireText(
  read('src/domain/brush-schema.ts'),
  'brushDensityJitterV1',
  'density-jitter preset helpers missing',
);
requireText(
  read('src/gpu/baseline-brush.ts'),
  'deterministicBaselineBrushDensityJitterV1',
  'deterministic density-jitter channel missing',
);
requireText(
  read('src/gpu/baseline-brush.ts'),
  'this.#tipDensity * stamp.densityJitterScale',
  'density jitter is not applied to canonical tip density',
);
requireText(
  read('src/app/paint-session-controller.ts'),
  'setBrushDensityJitter',
  'density jitter is not connected to runtime brush state',
);
requireText(
  read('src/app/paint-session-controller.ts'),
  'densityJitterEnabled',
  'density jitter does not capture a deterministic persistent stroke seed',
);
requireText(
  read('src/index.html'),
  'id="brush-density-jitter-range"',
  'reachable density-jitter control missing',
);
requireText(
  read('tests/unit/brush-density-jitter.test.ts'),
  'shares one logical-stamp density sample across sampled-tip micro dabs',
  'density-jitter logical-stamp sharing regression missing',
);
requireText(
  read('tests/unit/brush-density-jitter.test.ts'),
  'advances the density-jitter attempt index even when taper suppresses a logical stamp',
  'density-jitter attempt-index regression missing',
);
requireText(
  read('tests/unit/brush-density-jitter.test.ts'),
  'reuses the resolved density scale when reconciling the mutable end tail',
  'density-jitter tail reconciliation regression missing',
);

requireText(progress, 'M6A-056 color jitter:完了', 'M6A-056 progress is not complete');
requireText(
  read('src/domain/brush-schema.ts'),
  'brushHueJitterV1',
  'color-jitter preset helpers missing',
);
requireText(
  read('src/gpu/baseline-brush.ts'),
  'deterministicBaselineBrushColorJitterV1',
  'deterministic HSV color-jitter channel missing',
);
requireText(
  read('src/gpu/baseline-brush.ts'),
  'color: resolvedColor',
  'resolved color jitter is not stored on logical stamps',
);
requireText(
  read('src/gpu/baseline-brush.ts'),
  'stamp.color',
  'resolved logical-stamp color is not forwarded to primitive dabs',
);
requireText(
  read('src/app/paint-session-controller.ts'),
  'setBrushColorJitter',
  'color jitter is not connected to runtime brush state',
);
requireText(
  read('src/app/paint-session-controller.ts'),
  'colorJitterEnabled',
  'color jitter does not capture a deterministic persistent stroke seed',
);
requireText(
  read('src/index.html'),
  'id="brush-hue-jitter-range"',
  'reachable hue-jitter control missing',
);
requireText(
  read('src/index.html'),
  'id="brush-saturation-jitter-range"',
  'reachable saturation-jitter control missing',
);
requireText(
  read('src/index.html'),
  'id="brush-value-jitter-range"',
  'reachable value-jitter control missing',
);
requireText(
  read('tests/unit/brush-color-jitter.test.ts'),
  'shares one resolved color across sampled-tip micro dabs',
  'color-jitter logical-stamp sharing regression missing',
);
requireText(
  read('tests/unit/brush-color-jitter.test.ts'),
  'advances the color-jitter attempt index even when taper suppresses a logical stamp',
  'color-jitter attempt-index regression missing',
);
requireText(
  read('tests/unit/brush-color-jitter.test.ts'),
  'reuses the resolved color when reconciling the mutable end tail',
  'color-jitter tail reconciliation regression missing',
);

requireText(progress, 'M6A-057 spray/particle mode:完了', 'M6A-057 progress is not complete');
requireText(
  read('src/domain/brush-schema.ts'),
  'brushSprayEnabledV1',
  'spray preset toggle missing',
);
requireText(
  read('src/gpu/baseline-brush.ts'),
  'deterministicBaselineBrushSprayParticleV1',
  'deterministic spray particle generator missing',
);
requireText(
  read('src/gpu/baseline-brush.ts'),
  'sprayParticles',
  'spray particles are not retained on logical stamp records',
);
requireText(
  read('src/app/paint-session-controller.ts'),
  'setBrushSprayEnabled',
  'spray mode is not connected to runtime brush state',
);
requireText(
  read('src/app/paint-session-controller.ts'),
  'sprayEnabled',
  'spray mode does not participate in deterministic stroke seeding',
);
requireText(read('src/index.html'), 'id="brush-spray-enabled"', 'reachable spray toggle missing');
requireText(
  read('tests/unit/brush-spray-mode.test.ts'),
  'turns one logical stamp into a deterministic bounded multi-particle burst',
  'spray particle-burst regression missing',
);
requireText(
  read('tests/unit/brush-spray-mode.test.ts'),
  'advances the spray attempt index when taper suppresses an ordinary logical stamp',
  'spray attempt-index regression missing',
);
requireText(
  read('tests/unit/brush-spray-mode.test.ts'),
  'reuses resolved particle centers during mutable end-tail reconciliation',
  'spray tail-reconciliation regression missing',
);

for (const line of [
  'M6A-PERF-001 incremental active-stroke rendering（stable prefix + bounded mutable tail）:完了',
  'M6A-PERF-002 retained tile/dirty-region presentation（normal hot pathでwhole-stroke/whole-history replay禁止）:完了',
  'M6A-PERF-003 incremental GPU/transfer submission（累積stroke比例の毎回allocate/copy/destroy禁止）:完了',
  'M6A-PERF-004 long-stroke scaling workload verification:完了',
  'M6A-検査 M6A内部検査:完了',
]) {
  requireText(progress, line, `M6A completion marker missing: ${line}`);
}

console.log('M6A Raster Brush contract verification: PASS');

requireText(progress, 'M6A-058 particle size:完了', 'M6A-058 progress is not complete');
requireText(
  read('src/domain/brush-schema.ts'),
  'brushSprayParticleSizeRatioV1',
  'spray particle-size preset helper missing',
);
requireText(
  read('src/gpu/baseline-brush.ts'),
  'this.#sprayParticleSizeRatio',
  'spray particle-size ratio is not connected to canonical particle radius',
);
requireText(
  read('src/app/paint-session-controller.ts'),
  'setBrushSprayParticleSizeRatio',
  'spray particle size is not captured by the paint session',
);
requireText(
  read('src/index.html'),
  'id="brush-spray-particle-size-range"',
  'reachable spray particle-size control missing',
);
requireText(
  read('tests/unit/brush-particle-size.test.ts'),
  'without changing the deterministic particle centers or burst count',
  'spray particle-size regression coverage missing',
);

requireText(progress, 'M6A-059 particle density:完了', 'M6A-059 progress is not complete');
requireText(
  read('src/domain/brush-schema.ts'),
  'brushSprayParticleDensityV1',
  'spray particle-density preset helper missing',
);
requireText(
  read('src/gpu/baseline-brush.ts'),
  'Array.from({ length: this.#sprayParticleDensity }',
  'spray particle density is not connected to canonical burst fanout',
);
requireText(
  read('src/app/paint-session-controller.ts'),
  'setBrushSprayParticleDensity',
  'spray particle density is not captured by the paint session',
);
requireText(
  read('src/index.html'),
  'id="brush-spray-particle-density-range"',
  'reachable spray particle-density control missing',
);
requireText(
  read('tests/unit/brush-particle-density.test.ts'),
  'preserving the deterministic prefix of particle centers',
  'spray particle-density regression coverage missing',
);

requireText(progress, 'M6A-060 particle spread:完了', 'M6A-060 progress is not complete');
requireText(
  read('src/domain/brush-schema.ts'),
  'brushSpraySpreadRadiusRatioV1',
  'spray spread-radius preset helper missing',
);
requireText(
  read('src/domain/brush-schema.ts'),
  'brushSprayDeviationV1',
  'spray radial-deviation preset helper missing',
);
requireText(
  read('src/gpu/baseline-brush.ts'),
  'applyBaselineBrushSprayDeviationV1',
  'spray radial distribution transform missing',
);
requireText(
  read('src/gpu/baseline-brush.ts'),
  'this.#radius * this.#spraySpreadRadiusRatio',
  'spray spread radius is not connected to canonical particle centers',
);
requireText(
  read('src/index.html'),
  'id="brush-spray-spread-radius-range"',
  'reachable spray spread-radius control missing',
);
requireText(
  read('src/index.html'),
  'id="brush-spray-deviation-range"',
  'reachable spray distribution-deviation control missing',
);
requireText(
  read('tests/unit/brush-particle-spread.test.ts'),
  'positive deviation for center bias and negative deviation for edge bias',
  'spray particle-spread regression coverage missing',
);

requireText(progress, 'M6A-061 particle orientation:完了', 'M6A-061 progress is not complete');
requireText(
  read('src/domain/brush-schema.ts'),
  'brushSprayAngleBasedOnCenterV1',
  'spray center-based orientation preset helper missing',
);
requireText(
  read('src/gpu/baseline-brush.ts'),
  'particle.tipAngleDegrees',
  'spray particle-specific orientation is not connected to canonical emission',
);
requireText(
  read('src/app/paint-session-controller.ts'),
  'setBrushSprayAngleBasedOnCenter',
  'spray particle orientation is not captured by the paint session',
);
requireText(
  read('src/index.html'),
  'id="brush-spray-angle-based-on-center"',
  'reachable spray orientation control missing',
);
requireText(
  read('tests/unit/brush-particle-orientation.test.ts'),
  'adds each particle radial angle to the already resolved parent tip angle',
  'spray particle-orientation regression coverage missing',
);

requireText(progress, 'M6A-063 wet/smudge-style pickup:完了', 'M6A-063 progress is not complete');
requireText(
  read('src/domain/brush-schema.ts'),
  'brushColorMixPickupAmountV1',
  'wet color pickup preset contract missing',
);
requireText(
  read('src/gpu/baseline-raster-tile-store.ts'),
  'COLOR_MIX_SAMPLE_OFFSETS_V1',
  'bounded deterministic color pickup sampling missing',
);
requireText(
  read('src/gpu/baseline-raster-tile-store.ts'),
  'colorMixReservoir',
  'stateful carried-color reservoir missing',
);
requireText(
  read('src/workers/render.worker.ts'),
  'colorMixCarryAmount',
  'worker does not preserve wet color pickup settings',
);
requireText(
  read('src/index.html'),
  'id="brush-color-mix-pickup-range"',
  'reachable wet color pickup control missing',
);
requireText(
  read('tests/unit/baseline-raster-tile-store.test.ts'),
  'carries picked-up active-layer color across later paint dabs',
  'wet color pickup regression coverage missing',
);

requireText(progress, 'M6A-064 main/sub color behavior:完了', 'M6A-064 progress is not complete');
requireText(
  read('src/domain/brush-schema.ts'),
  'brushSubColorRatioV1',
  'main/sub brush preset contract missing',
);
requireText(
  read('src/gpu/baseline-brush.ts'),
  'mixBaselineBrushMainSubColorV1',
  'main/sub brush kernel resolution missing',
);
requireText(
  read('src/app/color-workflow-controller.ts'),
  'setPaintSubColor(state.previous)',
  'Color Workspace previous color is not connected as brush Sub color',
);
requireText(
  read('src/index.html'),
  'id="brush-sub-color-ratio-range"',
  'reachable Sub Color Ratio control missing',
);
requireText(
  read('tests/unit/brush-main-sub-color.test.ts'),
  'mixes main and sub colors in linear light before creating resolved dabs',
  'main/sub brush regression coverage missing',
);

requireText(
  progress,
  'M6A-065 reference-aware anti-overflow painting:完了',
  'M6A-065 progress is not complete',
);
requireText(
  read('src/domain/brush-schema.ts'),
  'brushReferenceAntiOverflowV1',
  'reference anti-overflow brush preset contract missing',
);
requireText(
  read('src/app/raster-compositor-descriptors.ts'),
  'reference: true',
  'Reference Layer role is not carried to the raster compositor',
);
requireText(
  read('src/gpu/baseline-raster-tile-store.ts'),
  '#buildReferenceAntiOverflowClip',
  'local reference anti-overflow connectivity clip missing',
);
requireText(
  read('src/gpu/baseline-paint-renderer.ts'),
  'baselineDabReferenceAntiOverflowV1(dab)',
  'anti-overflow paint is not routed through canonical preview',
);
requireText(
  read('src/index.html'),
  'id="brush-reference-anti-overflow"',
  'reachable reference anti-overflow control missing',
);
requireText(
  read('tests/unit/brush-reference-anti-overflow.test.ts'),
  'clips brush-radius overflow to the connected side of a reference line',
  'reference anti-overflow regression coverage missing',
);

requireText(progress, 'M6A-066 hover brush outline:完了', 'M6A-066 progress is not complete');
requireText(
  read('src/input/hover-state.ts'),
  'readonly clientX: number | null;',
  'hover state does not retain client coordinates for transformed viewport mapping',
);
requireText(
  read('src/app/brush-hover-outline-controller.ts'),
  'resolveBrushHoverOutlinePresentationV1',
  'hover brush outline presentation resolver missing',
);
requireText(
  read('src/app/main.ts'),
  'brushHoverOutline.updateHover(hover)',
  'production pointer hover is not connected to brush outline',
);
requireText(
  read('src/index.html'),
  'id="brush-hover-outline"',
  'brush hover outline overlay is not reachable in the canvas stage',
);
requireText(
  read('public/app-shell.css'),
  '.shell-brush-hover-outline',
  'brush hover outline styling missing',
);
requireText(
  read('tests/unit/brush-hover-outline.test.ts'),
  'projects nominal brush diameter through viewport zoom in screen space',
  'hover brush outline regression coverage missing',
);

requireText(progress, 'M6A-067 hover crosshair option:完了', 'M6A-067 progress is not complete');
requireText(
  read('src/app/brush-hover-outline-controller.ts'),
  'class BrushHoverDisplaySettingsV1',
  'hover display settings state missing',
);
requireText(
  read('src/app/brush-hover-outline-controller.ts'),
  'outline.dataset.crosshair = String(enabled)',
  'crosshair setting is not connected to hover overlay',
);
requireText(
  read('src/index.html'),
  'id="view-brush-hover-crosshair"',
  'reachable hover crosshair display control missing',
);
requireText(
  read('public/app-shell.css'),
  ".shell-brush-hover-outline[data-crosshair='true']::before",
  'hover crosshair presentation styling missing',
);
requireText(
  read('tests/unit/brush-hover-outline.test.ts'),
  'keeps hover crosshair optional and disabled by default',
  'hover crosshair regression coverage missing',
);

requireText(
  progress,
  'M6A-068 global/default pressure response controls:完了',
  'M6A-068 progress is not complete',
);
requireText(
  read('src/domain/brush-schema.ts'),
  'brushPressureResponseCurveOverrideV1',
  'per-brush pressure response override identity missing',
);
requireText(
  read('src/domain/brush-schema.ts'),
  'resolveBrushPressureResponseCurveV1',
  'global/default pressure response resolver missing',
);
requireText(
  read('src/app/global-pressure-response-controller.ts'),
  'GLOBAL_PRESSURE_RESPONSE_STORAGE_KEY_V1',
  'persistent global pressure response controller missing',
);
requireText(
  read('src/app/brush-preset-controller.ts'),
  'pressureResponseDefault',
  'brush preset controller does not consume global pressure default',
);
requireText(
  read('src/index.html'),
  'id="global-pressure-curve"',
  'reachable global pressure Curve Editor missing',
);
requireText(
  read('src/index.html'),
  'id="brush-pressure-curve-override"',
  'reachable per-brush pressure override control missing',
);
requireText(
  read('tests/unit/global-pressure-response.test.ts'),
  'inherits the global curve only when a brush has no explicit override',
  'global/default pressure inheritance regression coverage missing',
);

requireText(
  progress,
  'M6A-069 touch-position/input correction policy:完了',
  'M6A-069 progress is not complete',
);
requireText(
  read('src/input/input-arbitration.ts'),
  'setTouchPositionOffset',
  'touch-position correction is not connected to input arbitration',
);
requireText(
  read('src/input/input-arbitration.ts'),
  'mapTouchBatchToToolV1(batch, this.#touchOffsetXCssPx, this.#touchOffsetYCssPx)',
  'touch tool bridge does not apply configured correction',
);
requireText(
  read('src/app/touch-input-policy-controller.ts'),
  'TOUCH_INPUT_POLICY_STORAGE_KEY_V1',
  'persistent touch input policy controller missing',
);
requireText(
  read('src/index.html'),
  'id="view-touch-input-settings"',
  'reachable touch input settings command missing',
);
requireText(
  read('src/index.html'),
  'id="touch-offset-x-range"',
  'intuitive touch X correction slider missing',
);
requireText(
  read('tests/unit/input-arbitration.test.ts'),
  'offsets confirmed and predicted touch tool samples without mutating the raw batch',
  'touch tool correction regression coverage missing',
);

requireText(
  progress,
  'M6A-070 configurable stylus-button action plumbing:完了',
  'M6A-070 progress is not complete',
);
requireText(
  read('src/input/stylus-button-actions.ts'),
  'PRIMARY_STYLUS_BARREL_BUTTONS_MASK_V1 = 2',
  'primary stylus barrel Pointer Events mapping missing',
);
requireText(
  read('src/app/stylus-button-action-controller.ts'),
  'DEFAULT_PRIMARY_STYLUS_BARREL_BINDING_V1',
  'persistent stylus binding controller missing',
);
requireText(
  read('src/app/main.ts'),
  'tool.eyedropper.temporary',
  'default stylus temporary eyedropper action is not production-wired',
);
requireText(
  read('src/app/color-sampling.ts'),
  'setQuickSourceEnabled',
  'independent quick-eyedropper source ownership missing',
);
requireText(
  read('src/index.html'),
  'id="stylus-primary-barrel-action"',
  'reachable stylus binding selector missing',
);
requireText(
  read('tests/unit/stylus-button-actions.test.ts'),
  'detects primary barrel state transitions from the Pointer Events buttons bitmask',
  'stylus barrel transition regression coverage missing',
);
