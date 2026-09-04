import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function requireText(source, needle, label) {
  if (!source.includes(needle)) {
    throw new Error(`M6A performance verification failed: ${label}`);
  }
}

const canonical = read('src/app/canonical-raster-brush.ts');
const session = read('src/app/paint-session-controller.ts');
const main = read('src/app/main.ts');
const rendererController = read('src/app/renderer-controller.ts');
const paintRenderer = read('src/gpu/baseline-paint-renderer.ts');
const workloadTest = read('tests/unit/m6a-performance-invariants.test.ts');

requireText(
  canonical,
  'this.#kernel.appendDelta(samples)',
  'stable-prefix work is not generated incrementally',
);
requireText(
  canonical,
  'stablePrefixDabCount: this.#kernel.stablePrefixDabCount()',
  'stable-prefix accounting is missing',
);
requireText(
  canonical,
  'mutableTailDabCount: this.#kernel.mutableTailDabCount()',
  'bounded mutable-tail accounting is missing',
);
requireText(
  canonical,
  'reprocessedStableDabCount: 0 as const',
  'stable-prefix no-reprocessing invariant is missing',
);
requireText(
  session,
  'builder.appendConfirmed(stabilizedAdditions)',
  'paint session does not append only newly stabilized samples',
);
requireText(
  session,
  'takeActiveDabDelta()',
  'paint session does not expose incremental dab delivery',
);
requireText(
  main,
  'const dabDelta = paintSession.takeActiveDabDelta();',
  'production input path does not consume the incremental dab delta',
);
requireText(
  main,
  'renderer.presentBaselineStroke(',
  'production input path does not submit active stroke work to the renderer',
);
requireText(
  main,
  'dabDelta,',
  'production renderer submission does not use the incremental dab delta',
);
requireText(
  rendererController,
  "type: 'renderer.paint.present'",
  'Render Worker protocol does not expose incremental paint presentation',
);
requireText(
  paintRenderer,
  'canonicalTiles.applyDabs(',
  'canonical tile state is not updated from incoming dab work',
);
requireText(
  paintRenderer,
  "mode: 'append'",
  'normal WebGPU presentation does not use retained-scene append mode',
);
requireText(
  paintRenderer,
  'baseline retained scene is unavailable for incremental append',
  'retained-scene append failsafe is missing',
);
requireText(
  paintRenderer,
  'baseline retained scene is unavailable for tile patching',
  'retained dirty-tile patch presentation is missing',
);
requireText(
  paintRenderer,
  '#instanceBufferCapacity = 0;',
  'GPU instance-buffer capacity tracking is missing',
);
requireText(
  paintRenderer,
  'this.#instanceBufferCapacity >= requiredBytes',
  'GPU instance buffer is not reused while capacity is sufficient',
);
requireText(
  paintRenderer,
  'this.#instanceBufferCapacity * 2',
  'GPU instance-buffer growth is not amortized',
);
requireText(workloadTest, '10_000', '10,000-sample long-stroke workload coverage is missing');
requireText(
  workloadTest,
  'maximumDeltaDabCount',
  'per-batch incremental workload bound is not asserted',
);
requireText(
  workloadTest,
  'mutableTailDabCount',
  'bounded mutable-tail workload coverage is missing',
);
requireText(
  workloadTest,
  'reprocessedStableDabCount',
  'stable-prefix replay regression coverage is missing',
);

console.log('M6A performance verification passed.');
