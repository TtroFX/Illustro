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
requireText(
  progress,
  'M6A-013 brush size:未完了',
  'future brush-size status was incorrectly advanced',
);
requireText(
  progress,
  'M6A-PERF-001 incremental active-stroke rendering（stable prefix + bounded mutable tail）:未完了',
  'performance gate must remain separately incomplete',
);

console.log('M6A Raster Brush contract verification: PASS');
