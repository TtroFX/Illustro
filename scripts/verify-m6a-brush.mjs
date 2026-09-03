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
  'followAngle + this.#tipAngleDegrees - this.#tipDirectionDegrees',
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
  'const stabilizedAdditions = additions.map((sample) => stabilizer.push(sample));',
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

requireText(
  progress,
  'M6A-PERF-001 incremental active-stroke rendering（stable prefix + bounded mutable tail）:未完了',
  'performance gate must remain separately incomplete',
);

console.log('M6A Raster Brush contract verification: PASS');
