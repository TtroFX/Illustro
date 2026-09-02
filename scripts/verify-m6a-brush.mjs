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

requireText(canonical, "export type CanonicalBrushModeV1 = 'raster';", 'Raster mode identity missing');
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
requireText(session, 'brushMode: this.#brushMode,', 'new strokes do not persist Raster mode identity');
requireText(
  session,
  'builder.appendConfirmed(additions)',
  'confirmed batches do not use canonical incremental append',
);
requireText(main, 'illustroBrushMode', 'runtime Raster Brush diagnostics are not published');
requireText(tests, 'long stable prefix', 'stable-prefix regression coverage missing');
requireText(progress, 'M6A-001 Raster Brush mode:完了', 'M6A-001 progress is not complete');
requireText(progress, 'M6A-002 Eraser mode:未完了', 'future mode status was incorrectly advanced');
requireText(progress, 'M6A-PERF-001 incremental active-stroke rendering（stable prefix + bounded mutable tail）:未完了', 'performance gate must remain separately incomplete');

console.log('M6A Raster Brush contract verification: PASS');
